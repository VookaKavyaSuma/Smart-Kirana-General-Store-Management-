import { createWorker } from 'tesseract.js';
import { IBillReader } from './bill-reader.interface.js';
import {
  ExtractedBill,
  validateExtractedBill,
  normalizeUnit,
  normalizeDate,
} from '../../schemas/bill-extraction.schema.js';

export class TesseractBillReader implements IBillReader {
  readonly name = 'Tesseract.js OCR (English + Telugu)';

  async readBill(filePath: string, fileType: string): Promise<ExtractedBill> {
    let rawText = '';

    // PDFs are digital/scanned documents that require rendering tools or Vision AI.
    // If it's a PDF or non-image format, skip Leptonica binary reader to prevent native worker crash
    const ext = fileType.toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff'].includes(ext);

    if (isImage) {
      try {
        // Initialize Tesseract worker with English + Telugu data (FR-6.4)
        const worker = await createWorker(['eng', 'tel'], 1, {
          errorHandler: (e) => {
            // Suppress uncaught worker errors on corrupted files
          },
        });
        try {
          const ret = await worker.recognize(filePath);
          rawText = ret.data.text || '';
        } finally {
          await worker.terminate();
        }
      } catch (err: any) {
        console.warn(`[Tesseract OCR Warning]: ${err.message}. Falling back to manual review template.`);
        rawText = '';
      }
    }

    // Heuristically parse the OCR output
    const extracted = this.parseOcrText(rawText);

    // Validate through Zod (Never trust it blindly - FR-6.4)
    const validated = validateExtractedBill({
      ...extracted,
      readerSource: 'tesseract',
      rawText,
    });

    if (!validated.success || !validated.data) {
      // Fallback manual template if validation failed
      return {
        supplierShopName: null,
        billNumber: null,
        billDate: new Date().toISOString().split('T')[0],
        lineItems: [],
        billTotal: null,
        readerSource: 'tesseract',
        rawText,
      };
    }

    return validated.data;
  }

  /**
   * Heuristic regex parser for OCR text (handling Telugu and English bills)
   */
  private parseOcrText(text: string): Partial<ExtractedBill> {
    if (!text || text.trim().length === 0) {
      return {
        supplierShopName: null,
        billNumber: null,
        billDate: null,
        lineItems: [],
        billTotal: null,
      };
    }

    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

    // 1. Supplier name: usually in the first 3 lines, often containing keywords or store markers
    let supplierShopName: string | null = null;
    for (let i = 0; i < Math.min(lines.length, 4); i++) {
      const line = lines[i];
      if (
        /traders|stores|kirana|general|agency|enterprises|mart|షాప్|ట్రేడర్స్|స్టోర్స్/i.test(line) ||
        (!supplierShopName && line.length > 3 && !/invoice|bill|date|tax|gst/i.test(line))
      ) {
        supplierShopName = line.replace(/[^a-zA-Z0-9\s\u0C00-\u0C7F]/g, ' ').trim();
        break;
      }
    }

    // 2. Bill Number: search for patterns like "Bill No", "Invoice #", "Inv-102", "నంబర్"
    let billNumber: string | null = null;
    const billNumMatch = text.match(/(?:inv(?:oice)?|bill|receipt|నంబర్|నం)\s*[:#.\s]*([A-Za-z0-9\-_/]+)/i);
    if (billNumMatch && billNumMatch[1].length >= 2) {
      billNumber = billNumMatch[1];
    }

    // 3. Bill Date: search for DD/MM/YYYY or YYYY-MM-DD
    let billDate: string | null = null;
    const dateMatch = text.match(/(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4}|\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2})/);
    if (dateMatch) {
      billDate = normalizeDate(dateMatch[1]);
    }

    // 4. Bill Total: search for Total, Grand Total, Net, మొత్తం
    let billTotal: number | null = null;
    const totalMatch = text.match(/(?:grand\s*total|net\s*amount|total|మొత్తం)\s*[:.\s]*₹?\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (totalMatch) {
      const numStr = totalMatch[1].replace(/,/g, '');
      const parsed = parseFloat(numStr);
      if (!isNaN(parsed) && parsed > 0) {
        billTotal = parsed;
      }
    }

    // 5. Line items: parse lines with numeric quantity, unit and price
    const lineItems: any[] = [];
    const lineItemRegex = /([a-zA-Z\u0C00-\u0C7F\s]+?)\s+(\d+(?:\.\d+)?)\s*(kg|g|gm|l|ltr|ml|pcs|pkt|packet|bag|కిలో|లీటర్|ప్యాకెట్)?\s+(?:[@x*]?\s*)?₹?\s*(\d+(?:\.\d+)?)/i;

    for (const line of lines) {
      if (/total|grand|date|invoice|subtotal|gst/i.test(line)) continue;

      const m = line.match(lineItemRegex);
      if (m) {
        const rawName = m[1].trim();
        const qty = parseFloat(m[2]);
        const unit = normalizeUnit(m[3] || 'PIECE');
        const price = parseFloat(m[4]);

        if (rawName.length >= 2 && qty > 0 && price >= 0) {
          lineItems.push({
            name: rawName,
            quantity: qty,
            unit,
            costPrice: price,
            sellingPrice: Math.round(price * 1.2 * 100) / 100, // estimated 20% margin
          });
        }
      }
    }

    return {
      supplierShopName,
      billNumber,
      billDate: billDate || new Date().toISOString().split('T')[0],
      lineItems,
      billTotal,
    };
  }
}

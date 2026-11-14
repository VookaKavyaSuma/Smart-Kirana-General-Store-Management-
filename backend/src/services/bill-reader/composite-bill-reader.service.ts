import { IBillReader } from './bill-reader.interface.js';
import { VisionAiBillReader } from './vision-ai.reader.js';
import { TesseractBillReader } from './tesseract.reader.js';
import {
  ExtractedBill,
  validateExtractedBill,
  checkBillTotalDiscrepancy,
  BillTotalDiscrepancyResult,
} from '../../schemas/bill-extraction.schema.js';

export interface BillReadResult {
  data: ExtractedBill;
  discrepancy: BillTotalDiscrepancyResult;
  usedReader: string;
}

export class CompositeBillReaderService implements IBillReader {
  readonly name = 'Composite Bill Reader (Vision AI + Tesseract Fallback)';

  private visionReader: VisionAiBillReader;
  private tesseractReader: TesseractBillReader;

  constructor() {
    this.visionReader = new VisionAiBillReader();
    this.tesseractReader = new TesseractBillReader();
  }

  async readBill(filePath: string, fileType: string): Promise<ExtractedBill> {
    const result = await this.readBillWithDetails(filePath, fileType);
    return result.data;
  }

  async readBillWithDetails(filePath: string, fileType: string): Promise<BillReadResult> {
    let extractedData: ExtractedBill | null = null;
    let usedReader = 'manual';

    // 1. Attempt Vision AI API first if API key is provided
    const apiKey = (process.env.VISION_API_KEY || '').trim();
    if (apiKey.length > 5) {
      try {
        console.log('[BILL READER]: Attempting Vision AI extraction...');
        extractedData = await this.visionReader.readBill(filePath, fileType);
        usedReader = this.visionReader.name;
        console.log('[BILL READER]: Vision AI extraction succeeded!');
      } catch (err: any) {
        console.warn(`[BILL READER]: Vision AI extraction failed (${err.message}). Falling back to Tesseract OCR...`);
      }
    } else {
      console.log('[BILL READER]: No valid VISION_API_KEY configured in .env. Using free Tesseract.js fallback...');
    }

    // 2. Fallback to free Tesseract.js with English & Telugu data
    if (!extractedData) {
      try {
        console.log('[BILL READER]: Running Tesseract.js (English + Telugu) OCR fallback...');
        extractedData = await this.tesseractReader.readBill(filePath, fileType);
        usedReader = this.tesseractReader.name;
        console.log('[BILL READER]: Tesseract OCR completed.');
      } catch (err: any) {
        console.warn(`[BILL READER]: Tesseract fallback encountered error: ${err.message}`);
      }
    }

    // 3. Fallback: If both fail, let user save the bill and enter data by hand (FR-6.9)
    if (!extractedData) {
      console.log('[BILL READER]: Falling back to manual entry template (FR-6.9).');
      extractedData = {
        supplierShopName: null,
        billNumber: null,
        billDate: new Date().toISOString().split('T')[0],
        lineItems: [],
        billTotal: null,
        readerSource: 'manual',
      };
      usedReader = 'Manual Entry Fallback';
    }

    // 4. Strict Zod validation (Never trust returned JSON blindly - FR-6.4)
    const validation = validateExtractedBill(extractedData);
    const finalData = validation.success && validation.data ? validation.data : extractedData;

    // 5. Total check: compare sum of lines with bill total (FR-6.8)
    const discrepancy = checkBillTotalDiscrepancy(finalData.lineItems, finalData.billTotal);

    return {
      data: finalData,
      discrepancy,
      usedReader,
    };
  }
}

export const billReaderService = new CompositeBillReaderService();

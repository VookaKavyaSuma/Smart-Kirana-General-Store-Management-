import fs from 'fs/promises';
import { IBillReader } from './bill-reader.interface.js';
import { ExtractedBill, validateExtractedBill } from '../../schemas/bill-extraction.schema.js';

export class VisionAiBillReader implements IBillReader {
  readonly name = 'Vision AI API';

  private getApiKey(): string | null {
    return process.env.VISION_API_KEY || process.env.GEMINI_API_KEY || null;
  }

  async readBill(filePath: string, fileType: string): Promise<ExtractedBill> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('Vision AI API key is not configured in .env (VISION_API_KEY).');
    }

    // 1. Read file bytes and encode to base64
    const fileBuffer = await fs.readFile(filePath);
    const base64Data = fileBuffer.toString('base64');

    let mimeType = 'image/jpeg';
    const ext = fileType.toLowerCase();
    if (ext === 'png') mimeType = 'image/png';
    else if (ext === 'pdf') mimeType = 'application/pdf';
    else if (ext === 'webp') mimeType = 'image/webp';

    // 2. Build Vision AI prompt
    const prompt = `You are an expert OCR & Kirana store invoice extraction AI.
Analyze this supplier bill or invoice image/document (which may contain text in Telugu and/or English, handwritten or printed).
Extract:
1. supplierShopName: Supplier or wholesaler shop name (string or null)
2. billNumber: Invoice or bill number (string or null)
3. billDate: Date of the bill in YYYY-MM-DD format (string or null)
4. lineItems: Array of items, each with:
   - name: Item name (Telugu or English)
   - quantity: Numeric quantity (number)
   - unit: ONE of: "KG", "G", "LITRE", "ML", "PIECE", "PACKET"
   - costPrice: Unit cost price in Rupees (number)
   - sellingPrice: Suggested or marked selling price in Rupees (number or null)
5. billTotal: Grand total of the bill in Rupees (number or null)

Return ONLY valid JSON with this exact structure:
{
  "supplierShopName": "Sri Venkateshwara Traders",
  "billNumber": "INV-1024",
  "billDate": "2026-11-14",
  "lineItems": [
    {
      "name": "Sugar (చక్కెర)",
      "quantity": 10,
      "unit": "KG",
      "costPrice": 42.00,
      "sellingPrice": 48.00
    }
  ],
  "billTotal": 420.00
}
Strictly return raw JSON only. Do not wrap in markdown or markdown fences.`;

    // 3. Call Google Gemini 1.5 Flash Vision Endpoint
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const payload = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Vision AI request failed with HTTP ${response.status}: ${errText}`);
    }

    const resJson: any = await response.json();
    const rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error('Vision AI returned empty response.');
    }

    // Clean potential markdown quotes
    const cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    let parsed: any;
    try {
      parsed = JSON.parse(cleanedText);
    } catch (err: any) {
      throw new Error(`Failed to parse Vision AI JSON response: ${err.message}`);
    }

    // 4. Validate strictly with Zod (Never trust it blindly - FR-6.4)
    parsed.readerSource = 'vision_ai';
    parsed.rawText = rawText;

    const validation = validateExtractedBill(parsed);
    if (!validation.success || !validation.data) {
      throw new Error(`Vision AI extraction validation failed: ${validation.errors?.join(', ')}`);
    }

    return validation.data;
  }
}


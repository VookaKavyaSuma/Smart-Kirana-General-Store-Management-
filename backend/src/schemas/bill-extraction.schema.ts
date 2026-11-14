import { z } from 'zod';

export type ItemUnitType = 'KG' | 'G' | 'LITRE' | 'ML' | 'PIECE' | 'PACKET';

/**
 * Normalizes loose OCR or raw unit strings to valid ItemUnit enum values
 */
export function normalizeUnit(rawUnit: unknown): ItemUnitType {
  if (!rawUnit || typeof rawUnit !== 'string') {
    return 'PIECE';
  }

  const cleaned = rawUnit.trim().toLowerCase();

  // Kilograms
  if (['kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms', 'కిలో', 'కేజీ', 'కిలోలు'].includes(cleaned)) {
    return 'KG';
  }

  // Grams
  if (['g', 'gm', 'gms', 'gram', 'grams', 'గ్రాం', 'గ్రాములు', 'గ్రా'].includes(cleaned)) {
    return 'G';
  }

  // Litres
  if (['l', 'lt', 'ltr', 'ltrs', 'litre', 'litres', 'liter', 'liters', 'లీటరు', 'లీటర్', 'లీటర్లు'].includes(cleaned)) {
    return 'LITRE';
  }

  // Millilitres
  if (['ml', 'mls', 'millilitre', 'millilitres', 'మిల్లీ', 'మి.లీ'].includes(cleaned)) {
    return 'ML';
  }

  // Packets / Bags / Boxes
  if (['pkt', 'pkts', 'packet', 'packets', 'pack', 'packs', 'bag', 'bags', 'box', 'boxes', 'ప్యాకెట్', 'ప్యాకెట్లు'].includes(cleaned)) {
    return 'PACKET';
  }

  // Pieces / Nos / Units
  if (['pc', 'pcs', 'piece', 'pieces', 'nos', 'no', 'unit', 'units', 'item', 'items', 'పీస్', 'నెంబర్'].includes(cleaned)) {
    return 'PIECE';
  }

  return 'PIECE';
}

/**
 * Normalizes date strings (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD) to standard YYYY-MM-DD
 */
export function normalizeDate(rawDate?: unknown): string | null {
  if (!rawDate) return null;
  if (typeof rawDate !== 'string') {
    if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
      return rawDate.toISOString().split('T')[0];
    }
    return null;
  }

  const str = rawDate.trim();

  // Matches YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Matches DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, '0');
    const month = ddmmyyyy[2].padStart(2, '0');
    const year = ddmmyyyy[3];
    return `${year}-${month}-${day}`;
  }

  // Fallback try standard Date parsing
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Zod Schema for individual bill line items
 */
export const ExtractedLineItemSchema = z.object({
  name: z.string().min(1, 'Item name cannot be empty').transform((v) => v.trim()),
  quantity: z.preprocess((val) => {
    if (typeof val === 'string') {
      const num = parseFloat(val.replace(/,/g, ''));
      return isNaN(num) ? 0 : num;
    }
    return val;
  }, z.number().positive('Quantity must be greater than 0')),
  unit: z.preprocess((val) => normalizeUnit(val), z.enum(['KG', 'G', 'LITRE', 'ML', 'PIECE', 'PACKET'])),
  costPrice: z.preprocess((val) => {
    if (typeof val === 'string') {
      const num = parseFloat(val.replace(/[^0-9.]/g, ''));
      return isNaN(num) ? 0 : num;
    }
    return val;
  }, z.number().min(0, 'Cost price cannot be negative')),
  sellingPrice: z.preprocess((val) => {
    if (val === undefined || val === null || val === '') return undefined;
    if (typeof val === 'string') {
      const num = parseFloat(val.replace(/[^0-9.]/g, ''));
      return isNaN(num) ? undefined : num;
    }
    return val;
  }, z.number().min(0, 'Selling price cannot be negative').optional()),
  existingItemId: z.string().optional().nullable(),
});

export type ExtractedLineItem = z.infer<typeof ExtractedLineItemSchema>;

/**
 * Strict Zod Schema for complete extracted bill data
 * Never trust external Vision AI or OCR blindly! (FR-6.4, FR-6.5)
 */
export const ExtractedBillSchema = z.object({
  supplierShopName: z.preprocess((val) => {
    if (typeof val === 'string') {
      const trimmed = val.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    return val || null;
  }, z.string().nullable().optional()),

  billNumber: z.preprocess((val) => {
    if (typeof val === 'string') {
      const trimmed = val.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    return val || null;
  }, z.string().nullable().optional()),

  billDate: z.preprocess((val) => normalizeDate(val), z.string().nullable().optional()),

  lineItems: z.array(ExtractedLineItemSchema).default([]),

  billTotal: z.preprocess((val) => {
    if (val === undefined || val === null || val === '') return null;
    if (typeof val === 'string') {
      const num = parseFloat(val.replace(/[^0-9.]/g, ''));
      return isNaN(num) ? null : Math.round(num * 100) / 100;
    }
    if (typeof val === 'number') {
      return Math.round(val * 100) / 100;
    }
    return null;
  }, z.number().min(0).nullable().optional()),

  readerSource: z.enum(['vision_ai', 'tesseract', 'manual']).default('vision_ai'),
  rawText: z.string().optional().nullable(),
});

export type ExtractedBill = z.infer<typeof ExtractedBillSchema>;

/**
 * Validates raw extracted data with Zod (Never trust it blindly - FR-6.4)
 */
export function validateExtractedBill(rawData: unknown): {
  success: boolean;
  data?: ExtractedBill;
  errors?: string[];
} {
  const result = ExtractedBillSchema.safeParse(rawData);
  if (!result.success) {
    const errorMessages = result.error.errors.map(
      (err) => `${err.path.join('.') || 'root'}: ${err.message}`
    );
    return {
      success: false,
      errors: errorMessages,
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

export interface BillTotalDiscrepancyResult {
  sumLines: number;
  billTotal: number | null;
  hasWarning: boolean;
  diff: number;
  message?: string;
  teluguMessage?: string;
}

/**
 * Compares the sum of the extracted lines with the bill total (FR-6.8)
 * Warns when the sum differs from the bill total.
 */
export function checkBillTotalDiscrepancy(
  lineItems: Array<{ quantity: number; costPrice: number }>,
  billTotal?: number | null
): BillTotalDiscrepancyResult {
  // Calculate sum of line item totals: sum(quantity * costPrice)
  const rawSum = lineItems.reduce((acc, item) => {
    const qty = Number(item.quantity) || 0;
    const cp = Number(item.costPrice) || 0;
    return acc + qty * cp;
  }, 0);

  const sumLines = Math.round(rawSum * 100) / 100;

  if (billTotal == null || isNaN(billTotal) || billTotal <= 0) {
    return {
      sumLines,
      billTotal: null,
      hasWarning: false,
      diff: 0,
    };
  }

  const roundedTotal = Math.round(billTotal * 100) / 100;
  const diff = Math.round(Math.abs(sumLines - roundedTotal) * 100) / 100;

  // If difference is greater than 50 paise (tolerance for small rounding/taxes)
  const hasWarning = diff > 0.50;

  if (hasWarning) {
    return {
      sumLines,
      billTotal: roundedTotal,
      hasWarning: true,
      diff,
      message: `Warning: Total of line items (₹${sumLines.toFixed(2)}) differs from the bill total (₹${roundedTotal.toFixed(2)}) by ₹${diff.toFixed(2)}.`,
      teluguMessage: `హెచ్చరిక: వస్తువుల మొత్తం మొత్తం (₹${sumLines.toFixed(2)}) మరియు బిల్లు మొత్తం (₹${roundedTotal.toFixed(2)}) మధ్య ₹${diff.toFixed(2)} తేడా ఉంది.`,
    };
  }

  return {
    sumLines,
    billTotal: roundedTotal,
    hasWarning: false,
    diff,
  };
}


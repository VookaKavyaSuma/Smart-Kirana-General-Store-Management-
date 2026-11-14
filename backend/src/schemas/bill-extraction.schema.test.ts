import { describe, it, expect } from 'vitest';
import {
  validateExtractedBill,
  normalizeUnit,
  normalizeDate,
  checkBillTotalDiscrepancy,
} from './bill-extraction.schema.js';

describe('Smart Kirana - Bill Extraction Schema & Validation (FR-6.4, FR-6.8)', () => {
  it('validates a complete, valid extracted bill JSON with Zod', () => {
    const sampleVisionOutput = {
      supplierShopName: 'Sri Venkateshwara Traders',
      billNumber: 'INV-2026-904',
      billDate: '2026-11-14',
      lineItems: [
        {
          name: 'Sugar (చక్కెర)',
          quantity: 25,
          unit: 'KG',
          costPrice: 42.5,
          sellingPrice: 48,
        },
        {
          name: 'Sunflower Oil 1L (సన్‌ఫ్లవర్ నూనె)',
          quantity: 10,
          unit: 'LITRE',
          costPrice: 110,
          sellingPrice: 125,
        },
      ],
      billTotal: 2162.5,
      readerSource: 'vision_ai',
    };

    const res = validateExtractedBill(sampleVisionOutput);
    expect(res.success).toBe(true);
    expect(res.data?.supplierShopName).toBe('Sri Venkateshwara Traders');
    expect(res.data?.billNumber).toBe('INV-2026-904');
    expect(res.data?.billDate).toBe('2026-11-14');
    expect(res.data?.lineItems).toHaveLength(2);
    expect(res.data?.lineItems[0].unit).toBe('KG');
    expect(res.data?.lineItems[1].unit).toBe('LITRE');
    expect(res.data?.billTotal).toBe(2162.5);
  });

  it('normalizes various unit representations including Telugu and abbreviations', () => {
    expect(normalizeUnit('kg')).toBe('KG');
    expect(normalizeUnit('KGS')).toBe('KG');
    expect(normalizeUnit('kilogram')).toBe('KG');
    expect(normalizeUnit('కిలో')).toBe('KG');
    expect(normalizeUnit('కేజీ')).toBe('KG');

    expect(normalizeUnit('gm')).toBe('G');
    expect(normalizeUnit('grams')).toBe('G');
    expect(normalizeUnit('గ్రాములు')).toBe('G');

    expect(normalizeUnit('ltr')).toBe('LITRE');
    expect(normalizeUnit('liter')).toBe('LITRE');
    expect(normalizeUnit('లీటర్')).toBe('LITRE');

    expect(normalizeUnit('ml')).toBe('ML');
    expect(normalizeUnit('మి.లీ')).toBe('ML');

    expect(normalizeUnit('pcs')).toBe('PIECE');
    expect(normalizeUnit('nos')).toBe('PIECE');
    expect(normalizeUnit('పీస్')).toBe('PIECE');

    expect(normalizeUnit('pkts')).toBe('PACKET');
    expect(normalizeUnit('box')).toBe('PACKET');
    expect(normalizeUnit('ప్యాకెట్')).toBe('PACKET');

    // Unknown unit defaults safely to PIECE
    expect(normalizeUnit('unknown_unit')).toBe('PIECE');
  });

  it('normalizes various date formats to standard YYYY-MM-DD', () => {
    expect(normalizeDate('2026-11-14')).toBe('2026-11-14');
    expect(normalizeDate('14/11/2026')).toBe('2026-11-14');
    expect(normalizeDate('14-11-2026')).toBe('2026-11-14');
    expect(normalizeDate(new Date('2026-11-14T00:00:00.000Z'))).toBe('2026-11-14');
    expect(normalizeDate('')).toBeNull();
  });

  it('never trusts invalid JSON blindly: rejects negative quantity, missing names or malformed data', () => {
    const invalidSample = {
      supplierShopName: 'Test Shop',
      lineItems: [
        {
          name: '', // Empty name not allowed
          quantity: -5, // Negative quantity not allowed
          unit: 'KG',
          costPrice: 50,
        },
      ],
    };

    const res = validateExtractedBill(invalidSample);
    expect(res.success).toBe(false);
    expect(res.errors).toBeDefined();
    expect(res.errors?.some((e) => e.includes('Item name cannot be empty'))).toBe(true);
    expect(res.errors?.some((e) => e.includes('Quantity must be greater than 0'))).toBe(true);
  });

  it('handles string numbers with commas and currency symbols gracefully in Zod schema', () => {
    const rawWithStrings = {
      supplierShopName: 'Sri Lakshmi Store',
      billTotal: '₹ 1,500.50',
      lineItems: [
        {
          name: 'Toor Dal (కందిపప్పు)',
          quantity: '10',
          unit: 'kg',
          costPrice: '₹ 150.05',
        },
      ],
    };

    const res = validateExtractedBill(rawWithStrings);
    expect(res.success).toBe(true);
    expect(res.data?.billTotal).toBe(1500.5);
    expect(res.data?.lineItems[0].quantity).toBe(10);
    expect(res.data?.lineItems[0].costPrice).toBe(150.05);
    expect(res.data?.lineItems[0].unit).toBe('KG');
  });

  describe('Total check and discrepancy warning (FR-6.8)', () => {
    it('passes when line items total matches the bill total', () => {
      // 10 kg @ ₹40 = 400, 5 L @ ₹120 = 600. Total = 1000.
      const lines = [
        { quantity: 10, costPrice: 40 },
        { quantity: 5, costPrice: 120 },
      ];
      const result = checkBillTotalDiscrepancy(lines, 1000);
      expect(result.hasWarning).toBe(false);
      expect(result.sumLines).toBe(1000);
      expect(result.billTotal).toBe(1000);
      expect(result.diff).toBe(0);
    });

    it('warns when the sum of the lines differs from the bill total (FR-6.8)', () => {
      // 10 kg @ ₹40 = 400. Total on bill says 550 (e.g. missing line or tax/delivery mismatch).
      const lines = [{ quantity: 10, costPrice: 40 }];
      const result = checkBillTotalDiscrepancy(lines, 550);

      expect(result.hasWarning).toBe(true);
      expect(result.sumLines).toBe(400);
      expect(result.billTotal).toBe(550);
      expect(result.diff).toBe(150);
      expect(result.message).toContain('Warning: Total of line items (₹400.00) differs from the bill total (₹550.00) by ₹150.00');
      expect(result.teluguMessage).toContain('హెచ్చరిక: వస్తువుల మొత్తం మొత్తం (₹400.00)');
    });

    it('tolerates small rounding differences within 50 paise', () => {
      const lines = [{ quantity: 3, costPrice: 33.33 }]; // 99.99
      const result = checkBillTotalDiscrepancy(lines, 100.0); // diff = 0.01

      expect(result.hasWarning).toBe(false);
      expect(result.diff).toBe(0.01);
    });

    it('handles missing bill total gracefully without throwing error', () => {
      const lines = [{ quantity: 2, costPrice: 50 }];
      const result = checkBillTotalDiscrepancy(lines, null);

      expect(result.hasWarning).toBe(false);
      expect(result.sumLines).toBe(100);
      expect(result.billTotal).toBeNull();
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  calculatePriceForQuantity,
  calculateQuantityForAmount,
  generateReadyPriceChart,
  calculatePurchaseTotals,
  calculateProfitPerUnit,
  calculateMarginPercentage,
  calculateUnitsSold,
  calculateProfitEarned,
} from './calculations.util.js';

describe('Smart Kirana - Unit & Price Conversion Formulas (FR-4 & Examples)', () => {
  describe('Quantity to Price Conversion (FR-4.1, FR-4.5)', () => {
    // Requirements example: SP ₹60 per kg; 1 kg = ₹60, 1/2 kg = ₹30, 1/4 kg = ₹15, 100 g = ₹6.
    const spPerKg = 60;

    it('calculates price for 1 kg at SP ₹60/kg', () => {
      expect(calculatePriceForQuantity(spPerKg, 1, 'KG')).toBe(60.0);
    });

    it('calculates price for 1/2 kg (0.5 kg or 500 g) at SP ₹60/kg', () => {
      expect(calculatePriceForQuantity(spPerKg, 0.5, 'KG')).toBe(30.0);
      expect(calculatePriceForQuantity(spPerKg, 500, 'G')).toBe(30.0);
    });

    it('calculates price for 1/4 kg (0.25 kg or 250 g) at SP ₹60/kg', () => {
      expect(calculatePriceForQuantity(spPerKg, 0.25, 'KG')).toBe(15.0);
      expect(calculatePriceForQuantity(spPerKg, 250, 'G')).toBe(15.0);
    });

    it('calculates price for 100 g at SP ₹60/kg', () => {
      expect(calculatePriceForQuantity(spPerKg, 100, 'G')).toBe(6.0);
      expect(calculatePriceForQuantity(spPerKg, 0.1, 'KG')).toBe(6.0);
    });

    it('rounds money results to 2 decimal places (FR-4.5)', () => {
      // SP ₹45 per kg, 350 grams: 0.35 * 45 = 15.75
      expect(calculatePriceForQuantity(45, 350, 'G')).toBe(15.75);

      // SP ₹33 per kg, 150 grams: 0.15 * 33 = 4.95
      expect(calculatePriceForQuantity(33, 150, 'G')).toBe(4.95);
    });
  });

  describe('Amount to Quantity Conversion (FR-4.2, FR-4.5)', () => {
    // Requirements example: SP ₹60 per kg; ₹10 buys 166.7 g.
    const spPerKg = 60;

    it('calculates weight in grams for ₹10 at SP ₹60/kg (166.7 g)', () => {
      const result = calculateQuantityForAmount(spPerKg, 10, 'KG');
      expect(result.quantityInSubUnit).toBe(166.7);
      expect(result.subUnitName).toBe('g');
      expect(result.formattedString).toBe('166.7 g');
    });

    it('calculates weight for ₹5, ₹20, ₹50, and ₹100', () => {
      // ₹5 at ₹60/kg: (5/60)*1000 = 83.333... -> 83.3 g
      expect(calculateQuantityForAmount(spPerKg, 5, 'KG').quantityInSubUnit).toBe(83.3);

      // ₹20 at ₹60/kg: (20/60)*1000 = 333.333... -> 333.3 g
      expect(calculateQuantityForAmount(spPerKg, 20, 'KG').quantityInSubUnit).toBe(333.3);

      // ₹50 at ₹60/kg: (50/60)*1000 = 833.333... -> 833.3 g
      expect(calculateQuantityForAmount(spPerKg, 50, 'KG').quantityInSubUnit).toBe(833.3);

      // ₹100 at ₹60/kg: (100/60)*1000 = 1666.666... -> 1666.7 g (1.67 kg)
      const res100 = calculateQuantityForAmount(spPerKg, 100, 'KG');
      expect(res100.quantityInSubUnit).toBe(1666.7);
      expect(res100.quantityInBaseUnit).toBe(1.667);
    });

    it('rounds weight results to 1 decimal place (FR-4.5)', () => {
      // SP ₹45/kg, ₹15 -> 333.3 g
      expect(calculateQuantityForAmount(45, 15, 'KG').quantityInSubUnit).toBe(333.3);
    });
  });

  describe('Litre and Millilitre Conversion (FR-4.4)', () => {
    // Same rules apply to litres and millilitres
    const spPerLitre = 80;

    it('calculates price for 1 litre, 1/2 litre, 1/4 litre, and 100 ml', () => {
      // 1 L = ₹80.00
      expect(calculatePriceForQuantity(spPerLitre, 1, 'LITRE')).toBe(80.0);

      // 1/2 L (500 ml) = ₹40.00
      expect(calculatePriceForQuantity(spPerLitre, 0.5, 'LITRE')).toBe(40.0);
      expect(calculatePriceForQuantity(spPerLitre, 500, 'ML')).toBe(40.0);

      // 1/4 L (250 ml) = ₹20.00
      expect(calculatePriceForQuantity(spPerLitre, 0.25, 'LITRE')).toBe(20.0);
      expect(calculatePriceForQuantity(spPerLitre, 250, 'ML')).toBe(20.0);

      // 100 ml = ₹8.00
      expect(calculatePriceForQuantity(spPerLitre, 100, 'ML')).toBe(8.0);
    });

    it('calculates volume in ml for amount with rounding to 1 decimal', () => {
      // SP ₹60/L, ₹10 buys 166.7 ml
      const result = calculateQuantityForAmount(60, 10, 'LITRE');
      expect(result.quantityInSubUnit).toBe(166.7);
      expect(result.subUnitName).toBe('ml');
      expect(result.formattedString).toBe('166.7 ml');

      // SP ₹80/L, ₹20 buys 250 ml
      const res20 = calculateQuantityForAmount(80, 20, 'LITRE');
      expect(res20.quantityInSubUnit).toBe(250.0);
      expect(res20.subUnitName).toBe('ml');
    });
  });

  describe('Ready Price Chart Generator (FR-4.3)', () => {
    it('generates standard loose price chart for kg item at SP ₹60', () => {
      const chart = generateReadyPriceChart(60, 'KG');

      expect(chart.baseUnit).toBe('KG');
      expect(chart.standardWeights).toHaveLength(4);
      expect(chart.standardWeights[0].price).toBe(60.0); // 1 kg
      expect(chart.standardWeights[1].price).toBe(30.0); // 1/2 kg
      expect(chart.standardWeights[2].price).toBe(15.0); // 1/4 kg
      expect(chart.standardWeights[3].price).toBe(6.0);  // 100 g

      expect(chart.standardAmounts).toHaveLength(5);
      expect(chart.standardAmounts[0]).toEqual({
        amount: 5,
        quantity: 83.3,
        unit: 'g',
        formatted: '83.3 g',
      });
      expect(chart.standardAmounts[1]).toEqual({
        amount: 10,
        quantity: 166.7,
        unit: 'g',
        formatted: '166.7 g',
      });
      expect(chart.standardAmounts[2].amount).toBe(20);
      expect(chart.standardAmounts[3].amount).toBe(50);
      expect(chart.standardAmounts[4].amount).toBe(100);
    });

    it('generates standard loose price chart for litre item at SP ₹120', () => {
      const chart = generateReadyPriceChart(120, 'LITRE');

      expect(chart.baseUnit).toBe('LITRE');
      expect(chart.standardWeights[0].price).toBe(120.0); // 1 L
      expect(chart.standardWeights[1].price).toBe(60.0);  // 500 ml
      expect(chart.standardWeights[2].price).toBe(30.0);  // 250 ml
      expect(chart.standardWeights[3].price).toBe(12.0);  // 100 ml
      expect(chart.standardAmounts[1].unit).toBe('ml');
    });
  });

  describe('Purchase Totals (FR-5.4)', () => {
    it('calculates total purchase amount and expected profit for multiple item lines', () => {
      const lines = [
        { quantity: 20, costPrice: 40, sellingPrice: 50 }, // cost 800, profit 200
        { quantity: 10, costPrice: 90, sellingPrice: 110 }, // cost 900, profit 200
        { quantity: 5, costPrice: 150, sellingPrice: 180 },  // cost 750, profit 150
      ];

      const totals = calculatePurchaseTotals(lines);

      expect(totals.totalAmount).toBe(2450.0); // 800 + 900 + 750
      expect(totals.expectedProfit).toBe(550.0); // 200 + 200 + 150
      expect(totals.totalQuantity).toBe(35);
    });
  });
});


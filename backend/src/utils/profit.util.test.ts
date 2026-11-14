import { describe, it, expect } from 'vitest';
import {
  calculateProfitPerUnit,
  calculateMarginPercentage,
  calculateUnitsSold,
  calculateProfitEarned,
  calculateExpectedProfit,
  calculateTotalCost,
  calculateSupplierTotals,
  ItemFinancials,
} from './profit.util.js';

describe('Smart Kirana - Profit & Financial Formulas (Requirements 5.2, FR-5.7)', () => {
  describe('calculateProfitPerUnit()', () => {
    it('calculates profit per unit as SP - CP', () => {
      // Cost price: ₹40, Selling price: ₹50 -> Profit = ₹10
      expect(calculateProfitPerUnit(40, 50)).toBe(10);

      // Cost price: ₹32.50, Selling price: ₹45.00 -> Profit = ₹12.50
      expect(calculateProfitPerUnit(32.5, 45)).toBe(12.5);
    });

    it('handles negative profit if item is sold below cost price', () => {
      expect(calculateProfitPerUnit(50, 45)).toBe(-5);
    });

    it('handles zero profit when CP equals SP', () => {
      expect(calculateProfitPerUnit(60, 60)).toBe(0);
    });
  });

  describe('calculateMarginPercentage()', () => {
    it('calculates margin percentage as ((SP - CP) / SP) * 100', () => {
      // CP 40, SP 50 -> Margin = (10/50)*100 = 20%
      expect(calculateMarginPercentage(40, 50)).toBe(20);

      // CP 75, SP 100 -> Margin = 25%
      expect(calculateMarginPercentage(75, 100)).toBe(25);
    });

    it('handles zero or negative SP safely', () => {
      expect(calculateMarginPercentage(50, 0)).toBe(0);
    });
  });

  describe('calculateUnitsSold() and calculateProfitEarned()', () => {
    it('calculates units sold and realized profit earned so far', () => {
      // Bought 20 kg, 12 kg remaining -> 8 kg sold
      const unitsSold = calculateUnitsSold(20, 12);
      expect(unitsSold).toBe(8);

      // CP ₹40, SP ₹60 -> Profit per unit ₹20
      // 8 kg sold * ₹20 = ₹160 profit earned
      const profitEarned = calculateProfitEarned(40, 60, 20, 12);
      expect(profitEarned).toBe(160);

      // Expected profit on all 20 units = 20 * 20 = ₹400
      const expectedProfit = calculateExpectedProfit(40, 60, 20);
      expect(expectedProfit).toBe(400);

      // Total money spent on 20 units at CP ₹40 = ₹800
      const totalCost = calculateTotalCost(40, 20);
      expect(totalCost).toBe(800);
    });

    it('supports fractional quantities (e.g. 0.5 kg, 2.750 kg)', () => {
      expect(calculateUnitsSold(5.0, 2.5)).toBe(2.5);
      // 2.5 kg sold * ₹20 profit per kg = ₹50
      expect(calculateProfitEarned(30, 50, 5.0, 2.5)).toBe(50);
    });
  });

  describe('calculateSupplierTotals() (FR-5.7)', () => {
    it('aggregates total spent and total profit earned for a supplier across multiple items', () => {
      const supplierItems: ItemFinancials[] = [
        {
          // Item 1: Sugar - Bought 50 kg at ₹35, SP ₹42. 20 kg remaining (30 kg sold)
          // CP=35, SP=42 -> Profit/unit = 7
          // Spent = 50 * 35 = 1750
          // Profit earned = 30 * 7 = 210
          // Expected profit = 50 * 7 = 350
          quantityPurchased: 50,
          quantityRemaining: 20,
          costPrice: 35,
          sellingPrice: 42,
        },
        {
          // Item 2: Toor Dal - Bought 30 kg at ₹110, SP ₹135. 10 kg remaining (20 kg sold)
          // CP=110, SP=135 -> Profit/unit = 25
          // Spent = 30 * 110 = 3300
          // Profit earned = 20 * 25 = 500
          // Expected profit = 30 * 25 = 750
          quantityPurchased: 30,
          quantityRemaining: 10,
          costPrice: 110,
          sellingPrice: 135,
        },
        {
          // Item 3: Sunflower Oil - Bought 20 packets at ₹105, SP ₹120. 5 remaining (15 sold)
          // CP=105, SP=120 -> Profit/unit = 15
          // Spent = 20 * 105 = 2100
          // Profit earned = 15 * 15 = 225
          // Expected profit = 20 * 15 = 300
          quantityPurchased: 20,
          quantityRemaining: 5,
          costPrice: 105,
          sellingPrice: 120,
        },
      ];

      const totals = calculateSupplierTotals(supplierItems);

      expect(totals.totalItems).toBe(3);
      expect(totals.totalQuantityPurchased).toBe(100); // 50 + 30 + 20
      expect(totals.totalQuantityRemaining).toBe(35);   // 20 + 10 + 5
      expect(totals.totalUnitsSold).toBe(65);          // 100 - 35
      expect(totals.totalSpent).toBe(7150);            // 1750 + 3300 + 2100
      expect(totals.totalProfitEarned).toBe(935);       // 210 + 500 + 225
      expect(totals.totalExpectedProfit).toBe(1400);    // 350 + 750 + 300
    });

    it('returns zeroes for a supplier with no items', () => {
      const totals = calculateSupplierTotals([]);
      expect(totals.totalItems).toBe(0);
      expect(totals.totalSpent).toBe(0);
      expect(totals.totalProfitEarned).toBe(0);
      expect(totals.totalExpectedProfit).toBe(0);
    });
  });
});


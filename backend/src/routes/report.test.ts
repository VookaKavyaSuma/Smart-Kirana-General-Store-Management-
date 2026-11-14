import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import { AuthService } from '../services/auth.service.js';
import { generateOtp, resetOtpState } from '../services/otp.service.js';
import { ItemService, memoryItems, memoryStockAdjustments } from '../services/item.service.js';
import { SupplierService, memorySuppliers } from '../services/supplier.service.js';
import { CreditService, memoryCustomers, memoryCreditEntries, memoryCreditPayments } from '../services/credit.service.js';
import { OnlineService, memoryDailyOnlineEntries, memoryOnlineTransactions, memorySupplierPayments } from '../services/online.service.js';
import { ReportService } from '../services/report.service.js';

describe('Smart Kirana - Phase 10: Reports & Analytics (FR-8)', () => {
  let sessionToken: string;
  let authHeader: { Authorization: string };
  let storeId: string;
  let lakshmiSupplierId: string;
  let krishnaSupplierId: string;
  let sugarItemId: string;
  let riceItemId: string;
  let oilItemId: string;

  /**
   * Fixed Data Set (Worked out by hand):
   *
   * Store: Sri Balaji Kirana
   *
   * Suppliers:
   * 1. Lakshmi Wholesalers
   * 2. Krishna Oil Traders
   *
   * Items:
   * 1. Sugar (పంచదార) - Supplier: Lakshmi Wholesalers
   *    - Unit: KG
   *    - Quantity Purchased: 100 kg
   *    - Cost Price: Rs. 40.00
   *    - Selling Price: Rs. 50.00
   *    - Profit Per Unit: 50 - 40 = Rs. 10.00
   *    - Margin %: (10 / 50) * 100 = 20.00%
   *    - Overall Cost: 100 * 40 = Rs. 4,000.00
   *    - Expected Profit: 100 * 10 = Rs. 1,000.00
   *    - Sales:
   *      - 30 kg sold on 2026-10-15 (Oct 2026): Profit = 30 * 10 = Rs. 300.00
   *      - 10 kg sold on 2026-11-10 (Nov 2026): Profit = 10 * 10 = Rs. 100.00
   *    - Total Units Sold: 40 kg
   *    - Total Profit Earned: 40 * 10 = Rs. 400.00
   *    - Quantity Remaining: 100 - 40 = 60 kg
   *    - Stock Value: 60 * 40 = Rs. 2,400.00
   *
   * 2. Rice (బియ్యం) - Supplier: Lakshmi Wholesalers
   *    - Unit: KG
   *    - Quantity Purchased: 50 kg
   *    - Cost Price: Rs. 50.00
   *    - Selling Price: Rs. 60.00
   *    - Profit Per Unit: 60 - 50 = Rs. 10.00
   *    - Margin %: (10 / 60) * 100 = 16.67%
   *    - Overall Cost: 50 * 50 = Rs. 2,500.00
   *    - Expected Profit: 50 * 10 = Rs. 500.00
   *    - Sales:
   *      - 10 kg sold on 2026-11-12 (Nov 2026): Profit = 10 * 10 = Rs. 100.00
   *    - Total Units Sold: 10 kg
   *    - Total Profit Earned: 10 * 10 = Rs. 100.00
   *    - Quantity Remaining: 50 - 10 = 40 kg
   *    - Stock Value: 40 * 50 = Rs. 2,000.00
   *
   * 3. Sunflower Oil (నూనె) - Supplier: Krishna Oil Traders
   *    - Unit: LITRE
   *    - Quantity Purchased: 20 L
   *    - Cost Price: Rs. 120.00
   *    - Selling Price: Rs. 150.00
   *    - Profit Per Unit: 150 - 120 = Rs. 30.00
   *    - Margin %: (30 / 150) * 100 = 20.00%
   *    - Overall Cost: 20 * 120 = Rs. 2,400.00
   *    - Expected Profit: 20 * 30 = Rs. 600.00
   *    - Sales:
   *      - 5 L sold on 2026-11-14 (Nov 2026): Profit = 5 * 30 = Rs. 150.00
   *    - Total Units Sold: 5 L
   *    - Total Profit Earned: 5 * 30 = Rs. 150.00
   *    - Quantity Remaining: 20 - 5 = 15 L
   *    - Stock Value: 15 * 120 = Rs. 1,800.00
   *
   * Credit:
   * - 1 Customer (Ramu)
   *   - Takes credit of Rs. 300.00
   *   - Pays Rs. 100.00
   *   - Balance Due = Rs. 200.00
   *
   * Online Payments:
   * - Daily entry = Rs. 5,000.00
   * - Paid to Krishna Oil Traders = Rs. 2,000.00
   * - Remaining Online Amount = 5,000 - 2,000 = Rs. 3,000.00
   *
   * Overall Expected Dashboard Totals:
   * - Overall Cost: 4,000 + 2,500 + 2,400 = Rs. 8,900.00
   * - Total Items: 3
   * - Total Purchased Units: 100 + 50 + 20 = 170.000
   * - Quantity Remaining: 60 + 40 + 15 = 115.000
   * - Stock Value: 2,400 + 2,000 + 1,800 = Rs. 6,200.00
   * - Expected Profit: 1,000 + 500 + 600 = Rs. 2,100.00
   * - Profit Earned: 400 + 100 + 150 = Rs. 650.00
   * - Total Credit Due: Rs. 200.00
   * - Remaining Online Amount: Rs. 3,000.00
   *
   * Top & Bottom Items:
   * - Max Profit Item: Sugar (Rs. 400.00)
   * - Min Profit Item: Rice (Rs. 100.00)
   *
   * Supplier Breakdown:
   * - Lakshmi Wholesalers: Total Spent = Rs. 6,500.00, Profit Earned = Rs. 500.00
   * - Krishna Oil Traders: Total Spent = Rs. 2,400.00, Profit Earned = Rs. 150.00
   * - Max Profit Supplier: Lakshmi Wholesalers (Rs. 500.00)
   * - Min Profit Supplier: Krishna Oil Traders (Rs. 150.00)
   *
   * Monthly Comparison (Nov 2026 vs Oct 2026):
   * - Oct 2026 Profit = Rs. 300.00
   * - Nov 2026 Profit = 100 + 100 + 150 = Rs. 350.00
   * - Difference = 350 - 300 = Rs. 50.00
   * - Percentage Change = (50 / 300) * 100 = 16.67%
   * - Trend = UP
   */

  beforeEach(async () => {
    // Reset all memories
    resetOtpState();
    AuthService.resetMemoryState();
    SupplierService.resetMemoryState();
    CreditService.resetMemoryState();
    OnlineService.resetMemoryState();
    ReportService.resetMemoryState();
    memoryItems.clear();
    memorySuppliers.clear();
    memoryStockAdjustments.length = 0;

    // Register store
    const mobile = '9876543210';
    const otp = generateOtp(mobile, 'REGISTRATION');
    const regRes = await AuthService.registerStore({
      shopName: 'Sri Balaji Kirana',
      password: 'Password123!',
      mobileNumber: mobile,
      otpCode: otp.code!,
      language: 'TE',
    });
    storeId = regRes.store!.id;
    sessionToken = regRes.sessionToken!;
    authHeader = { Authorization: `Bearer ${sessionToken}` };

    // Create Supplier 1: Lakshmi Wholesalers
    const lakshmi = await SupplierService.findOrCreateSupplier(storeId, 'Lakshmi Wholesalers');
    lakshmiSupplierId = lakshmi!.id;

    // Create Supplier 2: Krishna Oil Traders
    const krishna = await SupplierService.findOrCreateSupplier(storeId, 'Krishna Oil Traders');
    krishnaSupplierId = krishna!.id;

    // Create Item 1: Sugar (100 kg @ 40 CP, 50 SP)
    const sugarRes = await ItemService.createItem(storeId, {
      name: 'Sugar (పంచదార)',
      category: 'Groceries',
      unit: 'KG',
      costPrice: 40.0,
      sellingPrice: 50.0,
      quantity: 100.0,
      supplierShopName: 'Lakshmi Wholesalers',
    });
    sugarItemId = sugarRes.item.id;

    // Create Item 2: Rice (50 kg @ 50 CP, 60 SP)
    const riceRes = await ItemService.createItem(storeId, {
      name: 'Rice (బియ్యం)',
      category: 'Grains',
      unit: 'KG',
      costPrice: 50.0,
      sellingPrice: 60.0,
      quantity: 50.0,
      supplierShopName: 'Lakshmi Wholesalers',
    });
    riceItemId = riceRes.item.id;

    // Create Item 3: Sunflower Oil (20 L @ 120 CP, 150 SP)
    const oilRes = await ItemService.createItem(storeId, {
      name: 'Sunflower Oil (నూనె)',
      category: 'Edible Oils',
      unit: 'LITRE',
      costPrice: 120.0,
      sellingPrice: 150.0,
      quantity: 20.0,
      supplierShopName: 'Krishna Oil Traders',
    });
    oilItemId = oilRes.item.id;

    // Record sales in specific months:
    // 1. Sugar: 30 kg sold in Oct 2026, 10 kg sold in Nov 2026
    const memSugar = memoryItems.get(sugarItemId)!;
    memSugar.quantityRemaining = 60.0;
    memoryStockAdjustments.push({
      id: 'adj-sugar-oct',
      itemId: sugarItemId,
      unitsChanged: -30.0,
      reason: 'QUICK_SOLD',
      date: new Date('2026-10-15T10:00:00.000Z'),
      createdAt: new Date('2026-10-15T10:00:00.000Z'),
    });
    memoryStockAdjustments.push({
      id: 'adj-sugar-nov',
      itemId: sugarItemId,
      unitsChanged: -10.0,
      reason: 'QUICK_SOLD',
      date: new Date('2026-11-10T10:00:00.000Z'),
      createdAt: new Date('2026-11-10T10:00:00.000Z'),
    });

    // 2. Rice: 10 kg sold in Nov 2026
    const memRice = memoryItems.get(riceItemId)!;
    memRice.quantityRemaining = 40.0;
    memoryStockAdjustments.push({
      id: 'adj-rice-nov',
      itemId: riceItemId,
      unitsChanged: -10.0,
      reason: 'QUICK_SOLD',
      date: new Date('2026-11-12T10:00:00.000Z'),
      createdAt: new Date('2026-11-12T10:00:00.000Z'),
    });

    // 3. Oil: 5 L sold in Nov 2026
    const memOil = memoryItems.get(oilItemId)!;
    memOil.quantityRemaining = 15.0;
    memoryStockAdjustments.push({
      id: 'adj-oil-nov',
      itemId: oilItemId,
      unitsChanged: -5.0,
      reason: 'QUICK_SOLD',
      date: new Date('2026-11-14T10:00:00.000Z'),
      createdAt: new Date('2026-11-14T10:00:00.000Z'),
    });

    // Setup Credit: Ramu takes Rs. 300, pays Rs. 100 -> Balance due = Rs. 200
    const custRes = await CreditService.createCustomer(storeId, { name: 'Ramu' });
    const ramuId = custRes.customer.id;
    await CreditService.addCreditEntry(storeId, ramuId, {
      itemName: 'Snacks',
      quantity: 1,
      costPrice: 300,
      sellingPrice: 300,
      dateTaken: '2026-11-14',
    });
    await CreditService.recordPayment(storeId, ramuId, {
      amount: 100,
      mode: 'CASH',
      date: '2026-11-14',
    });

    // Setup Online: Daily entry Rs. 5,000, paid Rs. 2,000 to Krishna -> Remaining = Rs. 3,000
    await OnlineService.upsertDailyEntry(storeId, {
      date: '2026-11-14',
      totalAmount: 5000,
    });
    await OnlineService.createSupplierPayment(storeId, {
      supplierId: krishnaSupplierId,
      amount: 2000,
      date: '2026-11-14',
    });
  });

  it('calculates Dashboard totals exactly matching hand-worked figures (FR-8.1, FR-8.8)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/dashboard')
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const metrics = res.body.metrics;

    // Hand-calculated assertions:
    // overallCost = 100*40 + 50*50 + 20*120 = 4000 + 2500 + 2400 = 8,900
    expect(metrics.overallCost).toBe(8900);

    // totalItems = 3
    expect(metrics.totalItems).toBe(3);

    // totalPurchasedUnits = 100 + 50 + 20 = 170
    expect(metrics.totalPurchasedUnits).toBe(170);

    // quantityRemaining = 60 + 40 + 15 = 115
    expect(metrics.quantityRemaining).toBe(115);

    // stockValue = 60*40 + 40*50 + 15*120 = 2400 + 2000 + 1800 = 6,200
    expect(metrics.stockValue).toBe(6200);

    // expectedProfit = 100*10 + 50*10 + 20*30 = 1000 + 500 + 600 = 2,100
    expect(metrics.expectedProfit).toBe(2100);

    // profitEarned = 40*10 + 10*10 + 5*30 = 400 + 100 + 150 = 650
    expect(metrics.profitEarned).toBe(650);

    // totalCreditDue = 300 - 100 = 200
    expect(metrics.totalCreditDue).toBe(200);

    // remainingOnlineAmount = 5,000 - 2,000 = 3,000
    expect(metrics.remainingOnlineAmount).toBe(3000);
  });

  it('calculates profit per unit, margin %, and identifies maximum/minimum profit items (FR-8.2, FR-8.3)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/items')
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { maxProfitItem, minProfitItem, rankedItems } = res.body;

    // Maximum profit item must be Sugar (Rs. 400.00 profit earned)
    expect(maxProfitItem).not.toBeNull();
    expect(maxProfitItem.name).toBe('Sugar (పంచదార)');
    expect(maxProfitItem.profitPerUnit).toBe(10);
    expect(maxProfitItem.marginPercent).toBe(20);
    expect(maxProfitItem.unitsSold).toBe(40);
    expect(maxProfitItem.profitEarned).toBe(400);

    // Minimum profit item must be Rice (Rs. 100.00 profit earned)
    expect(minProfitItem).not.toBeNull();
    expect(minProfitItem.name).toBe('Rice (బియ్యం)');
    expect(minProfitItem.profitPerUnit).toBe(10);
    expect(maxProfitItem.marginPercent).toBe(20);
    expect(minProfitItem.unitsSold).toBe(10);
    expect(minProfitItem.profitEarned).toBe(100);

    // Oil Item validation
    const oilItem = rankedItems.find((i: any) => i.id === oilItemId);
    expect(oilItem).toBeDefined();
    expect(oilItem.profitPerUnit).toBe(30); // 150 - 120
    expect(oilItem.marginPercent).toBe(20); // (30 / 150) * 100
    expect(oilItem.profitEarned).toBe(150); // 5 * 30

    // Ranked order check: Sugar (400) -> Oil (150) -> Rice (100)
    expect(rankedItems.map((i: any) => i.name)).toEqual([
      'Sugar (పంచదార)',
      'Sunflower Oil (నూనె)',
      'Rice (బియ్యం)',
    ]);
  });

  it('calculates supplier-wise profit, total spent, and identifies maximum/minimum supplier (FR-8.4, FR-8.6)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/suppliers')
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { maxProfitSupplier, minProfitSupplier, suppliers } = res.body;

    // Max Profit Supplier: Lakshmi Wholesalers (Rs. 500.00 profit earned)
    expect(maxProfitSupplier).not.toBeNull();
    expect(maxProfitSupplier.shopName).toBe('Lakshmi Wholesalers');
    expect(maxProfitSupplier.itemCount).toBe(2);
    expect(maxProfitSupplier.totalSpent).toBe(6500); // 4000 + 2500
    expect(maxProfitSupplier.profitEarned).toBe(500); // 400 + 100
    expect(maxProfitSupplier.expectedProfit).toBe(1500); // 1000 + 500

    // Min Profit Supplier: Krishna Oil Traders (Rs. 150.00 profit earned)
    expect(minProfitSupplier).not.toBeNull();
    expect(minProfitSupplier.shopName).toBe('Krishna Oil Traders');
    expect(minProfitSupplier.itemCount).toBe(1);
    expect(minProfitSupplier.totalSpent).toBe(2400);
    expect(minProfitSupplier.profitEarned).toBe(150);
    expect(minProfitSupplier.expectedProfit).toBe(600);
    expect(minProfitSupplier.totalPaidOnline).toBe(2000); // Paid Rs. 2,000 online

    expect(suppliers.length).toBe(2);
  });

  it('calculates profit for selected month and compares with previous month (FR-8.5)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/monthly?month=2026-11')
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const comp = res.body;
    expect(comp.selectedMonth).toBe('2026-11');
    expect(comp.previousMonth).toBe('2026-10');

    // Hand-calculated:
    // Oct 2026: Sugar 30 kg * 10 = Rs. 300.00
    expect(comp.previousMonthProfit).toBe(300);

    // Nov 2026: Sugar (10*10=100) + Rice (10*10=100) + Oil (5*30=150) = Rs. 350.00
    expect(comp.selectedMonthProfit).toBe(350);

    // Difference: 350 - 300 = Rs. 50.00
    expect(comp.difference).toBe(50);

    // Percentage change: (50 / 300) * 100 = 16.67%
    expect(comp.percentageChange).toBe(16.67);
    expect(comp.trend).toBe('UP');

    // Monthly history should contain at least 6 months ending in 2026-11
    expect(comp.monthlyHistory.length).toBe(6);
    expect(comp.monthlyHistory[comp.monthlyHistory.length - 1].month).toBe('2026-11');
  });

  it('serves full combined report with all sub-modules (FR-8.1 to FR-8.8)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/full?month=2026-11')
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.report.metrics.overallCost).toBe(8900);
    expect(res.body.report.itemRankings.rankedItems.length).toBe(3);
    expect(res.body.report.supplierBreakdown.suppliers.length).toBe(2);
    expect(res.body.report.monthlyComparison.selectedMonthProfit).toBe(350);
  });

  it('exports comprehensive CSV report with all financial figures (FR-8.7)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/export/csv?month=2026-11')
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('SMART KIRANA - FINANCIAL & PROFIT ANALYSIS REPORT');
    expect(res.text).toContain('Overall Cost (Purchases Spent),Rs. 8900');
    expect(res.text).toContain('Value of Remaining Stock,Rs. 6200');
    expect(res.text).toContain('Profit Earned on Units Sold,Rs. 650');
    expect(res.text).toContain('Total Customer Credit Due,Rs. 200');
    expect(res.text).toContain('Remaining Online Amount,Rs. 3000');
    expect(res.text).toContain('Sugar (పంచదార)');
    expect(res.text).toContain('Lakshmi Wholesalers');
    expect(res.text).toContain('Krishna Oil Traders');
  });
});

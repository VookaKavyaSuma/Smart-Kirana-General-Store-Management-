import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import { AuthService } from '../services/auth.service.js';
import { generateOtp, resetOtpState } from '../services/otp.service.js';
import { ItemService, memoryItems, memoryStockAdjustments } from '../services/item.service.js';
import { SupplierService, memorySuppliers } from '../services/supplier.service.js';
import { PurchaseService, memoryPurchases } from '../services/purchase.service.js';
import { CreditService } from '../services/credit.service.js';
import { OnlineService } from '../services/online.service.js';
import { SUGGESTIONS_CONFIG } from '../config/suggestions.config.js';

describe('Smart Kirana - Phase 11: Suggested Items & 3 Lists (FR-9)', () => {
  let sessionToken: string;
  let authHeader: { Authorization: string };
  let storeId: string;
  let supplierAId: string;
  let supplierBId: string;

  beforeEach(async () => {
    resetOtpState();
    AuthService.resetMemoryState();
    SupplierService.resetMemoryState();
    CreditService.resetMemoryState();
    OnlineService.resetMemoryState();
    memoryItems.clear();
    memorySuppliers.clear();
    memoryStockAdjustments.length = 0;
    memoryPurchases.clear();

    const mobile = '9876543210';
    const otp = generateOtp(mobile, 'REGISTRATION');
    const regRes = await AuthService.registerStore({
      shopName: 'Sri Raghavendra Store',
      password: 'password123',
      mobileNumber: mobile,
      otpCode: otp.code!,
      language: 'TE',
    });
    storeId = regRes.store!.id;
    sessionToken = regRes.sessionToken!;
    authHeader = { Authorization: `Bearer ${sessionToken}` };

    // Setup 2 Suppliers
    const supA = await SupplierService.createSupplier(storeId, 'Wholesaler A');
    supplierAId = supA.supplier!.id;
    const supB = await SupplierService.createSupplier(storeId, 'Wholesaler B');
    supplierBId = supB.supplier!.id;
  });

  it('exposes weights configuration in config endpoint (FR-9.2)', async () => {
    const res = await request(app)
      .get('/api/v1/suggestions/weights')
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.weights.MARGIN).toBe(0.4);
    expect(res.body.weights.TOTAL_PROFIT).toBe(0.4);
    expect(res.body.weights.UNITS_PER_WEEK).toBe(0.2);
  });

  it('handles new store with zero items gracefully without errors (Acceptance Criteria)', async () => {
    const res = await request(app)
      .get('/api/v1/suggestions')
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.totalItems).toBe(0);
    expect(res.body.worthBuyingMore).toEqual([]);
    expect(res.body.fastSellingRunningLow).toEqual([]);
    expect(res.body.lowProfitOrSlow).toEqual([]);
    expect(res.body.allRanked).toEqual([]);
  });

  it('computes scores using 0.4*margin + 0.4*profit + 0.2*velocity and sorts ranked list (FR-9.2)', async () => {
    // Item 1: High performer (Sugar)
    // CP: 40, SP: 60 -> Margin = (20/60)*100 = 33.33%, profit = 20/unit
    // 50 units sold in 30 days -> profit = 50 * 20 = 1000
    const item1 = await ItemService.createItem(storeId, {
      name: 'Sugar (పంచదార)',
      category: 'Groceries',
      unit: 'KG',
      costPrice: 40,
      sellingPrice: 60,
      quantity: 100,
      supplierShopName: 'Wholesaler A',
    });

    // Item 2: Medium performer (Rice)
    // CP: 50, SP: 60 -> Margin = (10/60)*100 = 16.67%, profit = 10/unit
    // 20 units sold in 30 days -> profit = 20 * 10 = 200
    const item2 = await ItemService.createItem(storeId, {
      name: 'Rice (బియ్యం)',
      category: 'Grains',
      unit: 'KG',
      costPrice: 50,
      sellingPrice: 60,
      quantity: 50,
      supplierShopName: 'Wholesaler A',
    });

    // Record sales via adjustments in the last 30 days
    memoryStockAdjustments.push({
      id: 'adj-sugar',
      itemId: item1.item.id,
      unitsChanged: -50,
      reason: 'QUICK_SOLD',
      date: new Date(),
      createdAt: new Date(),
    });
    const mem1 = memoryItems.get(item1.item.id)!;
    mem1.quantityRemaining = 50;

    memoryStockAdjustments.push({
      id: 'adj-rice',
      itemId: item2.item.id,
      unitsChanged: -20,
      reason: 'QUICK_SOLD',
      date: new Date(),
      createdAt: new Date(),
    });
    const mem2 = memoryItems.get(item2.item.id)!;
    mem2.quantityRemaining = 30;

    const res = await request(app)
      .get('/api/v1/suggestions?period=last_30_days')
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.totalItems).toBe(2);

    const sugar = res.body.allRanked.find((i: any) => i.id === item1.item.id);
    const rice = res.body.allRanked.find((i: any) => i.id === item2.item.id);

    expect(sugar).toBeDefined();
    expect(rice).toBeDefined();

    // Sugar has max margin (33.33%), max profit (1000), max velocity (50 / 4.29)
    // Normalized values are 1.0 for each dimension -> Score = 0.4(1) + 0.4(1) + 0.2(1) = 1.0 -> 100.0
    expect(sugar.score).toBe(100);

    // Rice has min margin (16.67%), min profit (200), min velocity (20 / 4.29)
    // Normalized values are 0.0 for each dimension -> Score = 0.0
    expect(rice.score).toBe(0);

    // Sugar ranked higher than Rice
    expect(res.body.allRanked[0].id).toBe(item1.item.id);
  });

  it('classifies items into three distinct lists with one-line reasons (FR-9.3, FR-9.4)', async () => {
    // 1. High profit star item: worth buying more of
    const starRes = await ItemService.createItem(storeId, {
      name: 'Cashews (జీడిపప్పు)',
      category: 'Dry Fruits',
      unit: 'KG',
      costPrice: 600,
      sellingPrice: 900,
      quantity: 50,
      supplierShopName: 'Wholesaler A',
    });
    memoryStockAdjustments.push({
      id: 'adj-star',
      itemId: starRes.item.id,
      unitsChanged: -25,
      reason: 'QUICK_SOLD',
      date: new Date(),
      createdAt: new Date(),
    });
    memoryItems.get(starRes.item.id)!.quantityRemaining = 25;

    // 2. Fast-selling item running low (stock <= 5)
    const fastLowRes = await ItemService.createItem(storeId, {
      name: 'Milk Packets (పాలు)',
      category: 'Dairy',
      unit: 'PACKET',
      costPrice: 25,
      sellingPrice: 30,
      quantity: 100,
      supplierShopName: 'Wholesaler A',
    });
    memoryStockAdjustments.push({
      id: 'adj-milk',
      itemId: fastLowRes.item.id,
      unitsChanged: -97,
      reason: 'QUICK_SOLD',
      date: new Date(),
      createdAt: new Date(),
    });
    memoryItems.get(fastLowRes.item.id)!.quantityRemaining = 3; // only 3 left!

    // 3. Slow/low-profit item (0 sold, low margin)
    const slowRes = await ItemService.createItem(storeId, {
      name: 'Matches (అగ్గిపెట్టెలు)',
      category: 'Household',
      unit: 'PIECE',
      costPrice: 9,
      sellingPrice: 10, // only 10% margin
      quantity: 100,
      supplierShopName: 'Wholesaler A',
    });

    const res = await request(app)
      .get('/api/v1/suggestions?period=last_30_days')
      .set(authHeader);

    expect(res.status).toBe(200);

    const { worthBuyingMore, fastSellingRunningLow, lowProfitOrSlow } = res.body;

    // List 1: Cashews should be in worthBuyingMore
    const inWorthBuying = worthBuyingMore.some((i: any) => i.id === starRes.item.id);
    expect(inWorthBuying).toBe(true);

    // List 2: Milk must be in fastSellingRunningLow
    const inFastLow = fastSellingRunningLow.some((i: any) => i.id === fastLowRes.item.id);
    expect(inFastLow).toBe(true);

    // List 3: Matches must be in lowProfitOrSlow
    const inSlow = lowProfitOrSlow.some((i: any) => i.id === slowRes.item.id);
    expect(inSlow).toBe(true);

    // Reason checks (FR-9.4)
    const starItem = worthBuyingMore.find((i: any) => i.id === starRes.item.id);
    expect(starItem.reason).toContain('Margin');

    const milkItem = fastSellingRunningLow.find((i: any) => i.id === fastLowRes.item.id);
    expect(milkItem.reason).toContain('Fast seller');
    expect(milkItem.reason).toContain('left');

    const matchesItem = lowProfitOrSlow.find((i: any) => i.id === slowRes.item.id);
    expect(matchesItem.reason).toContain('Slow mover');
  });

  it('identifies the cheapest supplier when item is bought from multiple suppliers (FR-9.6)', async () => {
    // 1. First purchase for Sunflower Oil from Wholesaler A @ CP 130
    const purA = await PurchaseService.createPurchase(storeId, {
      supplierId: supplierAId,
      supplierShopName: 'Wholesaler A',
      purchaseDate: new Date('2026-10-01'),
      items: [
        {
          name: 'Sunflower Oil (నూనె)',
          category: 'Edible Oils',
          unit: 'LITRE',
          quantity: 20,
          costPrice: 130,
          sellingPrice: 150,
        },
      ],
    });
    const oilId = purA.purchase.items[0].itemId;

    // 2. Second purchase for same oil from Wholesaler B @ CP 120 (Cheaper!)
    await PurchaseService.createPurchase(storeId, {
      supplierId: supplierBId,
      supplierShopName: 'Wholesaler B',
      purchaseDate: new Date('2026-10-15'),
      items: [
        {
          itemId: oilId,
          quantity: 20,
          costPrice: 120, // ₹120 vs ₹130
          sellingPrice: 150,
        },
      ],
    });

    const res = await request(app)
      .get('/api/v1/suggestions')
      .set(authHeader);

    expect(res.status).toBe(200);

    const oilItem = res.body.allRanked.find((i: any) => i.id === oilId);
    expect(oilItem).toBeDefined();
    expect(oilItem.cheapestSupplier).not.toBeNull();
    expect(oilItem.cheapestSupplier.hasMultipleSuppliers).toBe(true);
    expect(oilItem.cheapestSupplier.supplierName).toBe('Wholesaler B');
    expect(oilItem.cheapestSupplier.costPrice).toBe(120);
    expect(oilItem.cheapestSupplier.savingsPerUnit).toBe(10); // 130 - 120 = 10 savings!
  });

  it('supports period selector across last_30_days, last_90_days, and all_time (FR-9.5)', async () => {
    const res30 = await request(app)
      .get('/api/v1/suggestions?period=last_30_days')
      .set(authHeader);
    expect(res30.body.period).toBe('last_30_days');

    const res90 = await request(app)
      .get('/api/v1/suggestions?period=last_90_days')
      .set(authHeader);
    expect(res90.body.period).toBe('last_90_days');

    const resAll = await request(app)
      .get('/api/v1/suggestions?period=all_time')
      .set(authHeader);
    expect(resAll.body.period).toBe('all_time');
  });
});

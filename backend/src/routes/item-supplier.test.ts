import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import { AuthService } from '../services/auth.service.js';
import { ItemService } from '../services/item.service.js';
import { SupplierService } from '../services/supplier.service.js';
import { generateOtp, resetOtpState } from '../services/otp.service.js';

describe('Smart Kirana - Phase 2: Items & Suppliers Integration (FR-3, FR-5.1, FR-5.7)', () => {
  let sessionToken: string;

  beforeEach(async () => {
    resetOtpState();
    AuthService.resetMemoryState();
    ItemService.resetMemoryState();
    SupplierService.resetMemoryState();

    // Register store and get session
    const mobile = '9876543210';
    const otp = generateOtp(mobile, 'REGISTRATION');
    const regRes = await AuthService.registerStore({
      shopName: 'Sri Lakshmi Stores',
      password: 'password123',
      mobileNumber: mobile,
      otpCode: otp.code!,
    });
    sessionToken = regRes.sessionToken!;
  });

  it('creates an item with supplier shop name, auto-creating the supplier (FR-3.1, FR-3.8)', async () => {
    const res = await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({
        name: 'Sugar (చక్కెర)',
        category: 'Grains & Groceries',
        unit: 'KG',
        costPrice: 38.0,
        sellingPrice: 45.0,
        quantity: 50,
        supplierShopName: 'Sri Venkateshwara Traders',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.item.name).toBe('Sugar (చక్కెర)');
    expect(res.body.item.supplierShopName).toBe('Sri Venkateshwara Traders');
    expect(res.body.item.quantityPurchased).toBe(50);
    expect(res.body.item.quantityRemaining).toBe(50);

    // Verify profit per unit = 45 - 38 = 7.00
    expect(res.body.item.profitPerUnit).toBe(7);
    // Margin % = (7 / 45) * 100 = 15.56%
    expect(res.body.item.marginPercentage).toBe(15.56);
  });

  it('files an item under "No supplier" when supplier name is left blank (FR-3.8)', async () => {
    const res = await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({
        name: 'Loose Salt',
        category: 'Groceries',
        unit: 'PACKET',
        costPrice: 8.0,
        sellingPrice: 10.0,
        quantity: 20,
        supplierShopName: '', // blank
      });

    expect(res.status).toBe(201);
    expect(res.body.item.supplierId).toBeNull();
    expect(res.body.item.supplierShopName).toBe('No supplier');
  });

  it('allows moving an item later to a supplier (FR-3.8)', async () => {
    // 1. Create item with No supplier
    const createRes = await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({
        name: 'Turmeric Powder',
        category: 'Spices',
        unit: 'PACKET',
        costPrice: 20.0,
        sellingPrice: 30.0,
        quantity: 15,
      });

    const itemId = createRes.body.item.id;
    expect(createRes.body.item.supplierShopName).toBe('No supplier');

    // 2. Update item with supplier shop name
    const updateRes = await request(app)
      .put(`/api/v1/items/${itemId}`)
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({
        supplierShopName: 'Balaji Wholesale Mart',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.item.supplierShopName).toBe('Balaji Wholesale Mart');
    expect(updateRes.body.item.supplierId).not.toBeNull();
  });

  it('reduces remaining stock on quick sold entry and rejects going below zero (FR-3.5)', async () => {
    const createRes = await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({
        name: 'Basmati Rice',
        category: 'Grains',
        unit: 'KG',
        costPrice: 80.0,
        sellingPrice: 110.0,
        quantity: 25,
      });

    const itemId = createRes.body.item.id;

    // Quick sold: 10 units
    const soldRes = await request(app)
      .post(`/api/v1/items/${itemId}/sold`)
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ unitsSold: 10 });

    expect(soldRes.status).toBe(200);
    expect(soldRes.body.item.quantityRemaining).toBe(15);
    expect(soldRes.body.item.unitsSold).toBe(10);
    // Profit earned so far = 10 sold * (110 - 80) = ₹300
    expect(soldRes.body.item.profitEarned).toBe(300);

    // Attempt to sell more than remaining (16 > 15) must fail
    const overSoldRes = await request(app)
      .post(`/api/v1/items/${itemId}/sold`)
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ unitsSold: 16 });

    expect(overSoldRes.status).toBe(400);
    expect(overSoldRes.body.error).toContain('Only 15 KG remaining in stock');
  });

  it('marks items with remaining quantity below threshold as low stock (FR-3.7)', async () => {
    const createRes = await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({
        name: 'Mustard Seeds',
        category: 'Spices',
        unit: 'PACKET',
        costPrice: 15.0,
        sellingPrice: 20.0,
        quantity: 4, // Below default threshold 5
      });

    expect(createRes.body.item.isLowStock).toBe(true);

    // List with low stock filter
    const listRes = await request(app)
      .get('/api/v1/items?lowStockOnly=true')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.items.some((i: any) => i.name === 'Mustard Seeds')).toBe(true);
  });

  it('computes supplier page showing all items, profit per item, and supplier total profit (FR-5.7)', async () => {
    const supplierShopName = 'Annapurna Wholesalers';

    // Item 1: Atta - Bought 40 kg at ₹30, SP ₹40 (Profit/unit = ₹10). 15 sold, 25 remaining
    const item1Res = await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({
        name: 'Wheat Atta',
        category: 'Flour',
        unit: 'KG',
        costPrice: 30.0,
        sellingPrice: 40.0,
        quantity: 40,
        supplierShopName,
      });

    await request(app)
      .post(`/api/v1/items/${item1Res.body.item.id}/sold`)
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ unitsSold: 15 });

    // Item 2: Groundnut Oil - Bought 20 litres at ₹140, SP ₹170 (Profit/unit = ₹30). 5 sold, 15 remaining
    const item2Res = await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({
        name: 'Groundnut Oil',
        category: 'Oils',
        unit: 'LITRE',
        costPrice: 140.0,
        sellingPrice: 170.0,
        quantity: 20,
        supplierShopName,
      });

    await request(app)
      .post(`/api/v1/items/${item2Res.body.item.id}/sold`)
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ unitsSold: 5 });

    // Query supplier list
    const listRes = await request(app)
      .get('/api/v1/suppliers')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(listRes.status).toBe(200);
    const supplierSummary = listRes.body.suppliers.find((s: any) => s.shopName === supplierShopName);
    expect(supplierSummary).toBeDefined();

    // Verification of Supplier Totals (FR-5.7):
    // Total spent: (40 * 30) + (20 * 140) = 1200 + 2800 = 4000
    expect(supplierSummary.totalSpent).toBe(4000);

    // Total profit earned: (15 * 10) + (5 * 30) = 150 + 150 = 300
    expect(supplierSummary.totalProfitEarned).toBe(300);

    // Total expected profit: (40 * 10) + (20 * 30) = 400 + 600 = 1000
    expect(supplierSummary.totalExpectedProfit).toBe(1000);

    // Query single supplier detail (FR-5.7)
    const detailRes = await request(app)
      .get(`/api/v1/suppliers/${supplierSummary.id}`)
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.supplier.shopName).toBe(supplierShopName);
    expect(detailRes.body.items.length).toBe(2);
    expect(detailRes.body.totals.totalProfitEarned).toBe(300);
    expect(detailRes.body.totals.totalSpent).toBe(4000);
  });
});


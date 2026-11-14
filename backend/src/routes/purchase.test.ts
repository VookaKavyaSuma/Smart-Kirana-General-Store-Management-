import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import { AuthService } from '../services/auth.service.js';
import { ItemService } from '../services/item.service.js';
import { SupplierService } from '../services/supplier.service.js';
import { PurchaseService } from '../services/purchase.service.js';
import { generateOtp, resetOtpState } from '../services/otp.service.js';

describe('Smart Kirana - Phase 3: Purchases & Conversion Integration (FR-5.2 to FR-5.6, FR-4)', () => {
  let sessionToken: string;

  beforeEach(async () => {
    resetOtpState();
    AuthService.resetMemoryState();
    ItemService.resetMemoryState();
    SupplierService.resetMemoryState();
    PurchaseService.resetMemoryState();

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

  it('records a new purchase with supplier, purchase date, and multiple items (FR-5.2 to FR-5.5, FR-3.6)', async () => {
    // 1. Create a pre-existing item with 10 kg
    const itemRes = await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({
        name: 'Sona Masoori Rice',
        category: 'Grains',
        unit: 'KG',
        costPrice: 50.0,
        sellingPrice: 65.0,
        quantity: 10,
        supplierShopName: 'Sri Venkateshwara Traders',
      });

    const existingItemId = itemRes.body.item.id;

    // 2. Record new purchase of 2 items: 40 kg more of existing rice, plus a new item (Sugar 50 kg)
    const purchaseRes = await request(app)
      .post('/api/v1/purchases')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({
        supplierShopName: 'Sri Venkateshwara Traders',
        purchaseDate: '2026-11-14',
        type: 'SHOP',
        note: 'Weekly replenishment invoice #1042',
        items: [
          {
            itemId: existingItemId,
            quantity: 40,
            costPrice: 52.0, // slight cost increase
            sellingPrice: 68.0,
          },
          {
            name: 'Fine Sugar',
            category: 'Groceries',
            unit: 'KG',
            quantity: 50,
            costPrice: 38.0,
            sellingPrice: 45.0,
          },
        ],
      });

    expect(purchaseRes.status).toBe(201);
    expect(purchaseRes.body.success).toBe(true);

    const purchase = purchaseRes.body.purchase;
    expect(purchase.supplierShopName).toBe('Sri Venkateshwara Traders');
    expect(purchase.items.length).toBe(2);

    // Total purchase amount = (40 * 52) + (50 * 38) = 2080 + 1900 = 3980
    expect(purchase.totalAmount).toBe(3980);
    // Expected profit = (40 * 16) + (50 * 7) = 640 + 350 = 990
    expect(purchase.expectedProfit).toBe(990);

    // 3. Verify stock increased on existing item: was 10, added 40 -> total 50 purchased and in stock (FR-3.6)
    const updatedItemRes = await request(app)
      .get(`/api/v1/items/${existingItemId}`)
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(updatedItemRes.body.item.quantityPurchased).toBe(50);
    expect(updatedItemRes.body.item.quantityRemaining).toBe(50);
    // Cost price and selling price updated on the item
    expect(updatedItemRes.body.item.currentCostPrice).toBe(52);
    expect(updatedItemRes.body.item.currentSellingPrice).toBe(68);
  });

  it('keeps prices on purchase lines so later item price changes do not alter old profit (FR-5.5)', async () => {
    // 1. Record purchase
    const purchaseRes = await request(app)
      .post('/api/v1/purchases')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({
        supplierShopName: 'Balaji Wholesalers',
        items: [
          {
            name: 'Sunflower Oil 1L',
            category: 'Oils',
            unit: 'PACKET',
            quantity: 20,
            costPrice: 110.0,
            sellingPrice: 130.0, // Expected profit = 20 * 20 = 400
          },
        ],
      });

    const purchaseId = purchaseRes.body.purchase.id;
    const itemId = purchaseRes.body.purchase.items[0].itemId;

    // 2. Change item selling price to ₹150 in the store catalogue
    await request(app)
      .put(`/api/v1/items/${itemId}`)
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({
        sellingPrice: 150.0,
      });

    // 3. Fetch purchase history: purchase line item prices and expected profit must remain intact!
    const fetchedPurchaseRes = await request(app)
      .get(`/api/v1/purchases/${purchaseId}`)
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(fetchedPurchaseRes.body.purchase.items[0].costPrice).toBe(110.0);
    expect(fetchedPurchaseRes.body.purchase.items[0].sellingPrice).toBe(130.0);
    expect(fetchedPurchaseRes.body.purchase.expectedProfit).toBe(400.0);
  });

  it('adjusts stock correctly when a purchase is deleted (FR-5.6)', async () => {
    // 1. Create purchase of 30 kg Toor Dal
    const purchaseRes = await request(app)
      .post('/api/v1/purchases')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({
        supplierShopName: 'National Pulses Mart',
        items: [
          {
            name: 'Toor Dal Premium',
            category: 'Pulses',
            unit: 'KG',
            quantity: 30,
            costPrice: 120.0,
            sellingPrice: 145.0,
          },
        ],
      });

    const purchaseId = purchaseRes.body.purchase.id;
    const itemId = purchaseRes.body.purchase.items[0].itemId;

    // Item has 30 kg remaining
    let item = (await request(app).get(`/api/v1/items/${itemId}`).set('Authorization', `Bearer ${sessionToken}`))
      .body.item;
    expect(item.quantityRemaining).toBe(30);

    // 2. Delete the purchase (FR-5.6)
    const deleteRes = await request(app)
      .delete(`/api/v1/purchases/${purchaseId}`)
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(deleteRes.status).toBe(200);

    // 3. Stock must drop back by 30 kg to 0
    item = (await request(app).get(`/api/v1/items/${itemId}`).set('Authorization', `Bearer ${sessionToken}`))
      .body.item;
    expect(item.quantityRemaining).toBe(0);
    expect(item.quantityPurchased).toBe(0);
  });

  it('filters purchase history by supplier, item, and date (FR-5.6)', async () => {
    // Create 2 purchases with different suppliers and dates
    await request(app)
      .post('/api/v1/purchases')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({
        supplierShopName: 'Supplier A',
        purchaseDate: '2026-11-10',
        items: [{ name: 'Item Alpha', quantity: 10, costPrice: 20, sellingPrice: 25 }],
      });

    await request(app)
      .post('/api/v1/purchases')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({
        supplierShopName: 'Supplier B',
        purchaseDate: '2026-11-14',
        items: [{ name: 'Item Beta', quantity: 15, costPrice: 40, sellingPrice: 50 }],
      });

    // Query all purchases
    const allRes = await request(app)
      .get('/api/v1/purchases')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(allRes.body.purchases.length).toBe(2);

    // Filter by date range (only 2026-11-12 onwards)
    const dateFilteredRes = await request(app)
      .get('/api/v1/purchases?dateFrom=2026-11-12')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(dateFilteredRes.body.purchases.length).toBe(1);
    expect(dateFilteredRes.body.purchases[0].supplierShopName).toBe('Supplier B');
  });

  it('provides 2-way live conversion and ready price charts via conversion endpoint (FR-4)', async () => {
    // 1. Quantity to Price: SP ₹60 per kg -> 1/2 kg = ₹30, 1/4 kg = ₹15, 100 g = ₹6
    const halfKgRes = await request(app)
      .get('/api/v1/purchases/convert?mode=quantity-to-price&pricePerUnit=60&quantity=0.5&unit=KG')
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(halfKgRes.body.price).toBe(30.0);

    const quarterKgRes = await request(app)
      .get('/api/v1/purchases/convert?mode=quantity-to-price&pricePerUnit=60&quantity=250&unit=G')
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(quarterKgRes.body.price).toBe(15.0);

    const hundredGRes = await request(app)
      .get('/api/v1/purchases/convert?mode=quantity-to-price&pricePerUnit=60&quantity=100&unit=G')
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(hundredGRes.body.price).toBe(6.0);

    // 2. Amount to Quantity: SP ₹60 per kg, ₹10 buys 166.7 g
    const amtRes = await request(app)
      .get('/api/v1/purchases/convert?mode=amount-to-quantity&pricePerUnit=60&amount=10&baseUnit=KG')
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(amtRes.body.quantityInSubUnit).toBe(166.7);
    expect(amtRes.body.subUnitName).toBe('g');

    // 3. Ready price chart
    const chartRes = await request(app)
      .get('/api/v1/purchases/convert?mode=chart&pricePerUnit=60&baseUnit=KG')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(chartRes.body.chart.standardWeights.length).toBe(4);
    expect(chartRes.body.chart.standardAmounts.length).toBe(5);
  });
});


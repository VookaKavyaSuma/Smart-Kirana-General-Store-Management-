import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import { AuthService } from '../services/auth.service.js';
import { ItemService } from '../services/item.service.js';
import { SupplierService } from '../services/supplier.service.js';
import { PurchaseService } from '../services/purchase.service.js';
import { BillService } from '../services/bill.service.js';
import { generateOtp, resetOtpState } from '../services/otp.service.js';

describe('Smart Kirana - Phase 5: Automatic Bill Reading, Review & Confirm (FR-6.4 to FR-6.9)', () => {
  let sessionToken: string;

  // Minimal valid 1x1 PNG image buffer for clean OCR testing
  const validPngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  beforeEach(async () => {
    resetOtpState();
    AuthService.resetMemoryState();
    ItemService.resetMemoryState();
    SupplierService.resetMemoryState();
    PurchaseService.resetMemoryState();
    BillService.resetMemoryState();

    const mobile = '9876543210';
    const otp = generateOtp(mobile, 'REGISTRATION');
    const regRes = await AuthService.registerStore({
      shopName: 'Sri Raghavendra Kirana',
      password: 'password123',
      mobileNumber: mobile,
      otpCode: otp.code!,
    });

    sessionToken = regRes.sessionToken!;
  });

  it('reads an uploaded bill, extracts data, and caches the result for subsequent calls (FR-6.4)', async () => {
    // 1. Upload a bill
    const uploadRes = await request(app)
      .post('/api/v1/bills/upload')
      .set('Authorization', `Bearer ${sessionToken}`)
      .attach('billFile', validPngBuffer, 'supplier_invoice.png')
      .field('billType', 'SHOP')
      .field('supplierName', 'Sri Balaji Wholesalers')
      .field('billNumber', 'INV-5501')
      .field('billDate', '2026-11-14')
      .field('totalAmount', '1200.00');

    expect(uploadRes.status).toBe(201);
    const billId = uploadRes.body.bill.id;

    // 2. First call to read endpoint (FR-6.4)
    const readRes1 = await request(app)
      .post(`/api/v1/bills/${billId}/read`)
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(readRes1.status).toBe(200);
    expect(readRes1.body.success).toBe(true);
    expect(readRes1.body.billId).toBe(billId);
    expect(readRes1.body.extractedData).toBeDefined();
    expect(readRes1.body.cached).toBe(false);

    // 3. Second call to read endpoint MUST return cached: true without re-reading! (FR-6.4 cache)
    const readRes2 = await request(app)
      .post(`/api/v1/bills/${billId}/read`)
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(readRes2.status).toBe(200);
    expect(readRes2.body.success).toBe(true);
    expect(readRes2.body.cached).toBe(true);
  });

  it('enforces that nothing changes stock until the user presses Confirm (FR-6.5)', async () => {
    // 1. Create an existing item in store
    const itemRes = await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({
        name: 'Wheat Flour (గోధుమ పిండి)',
        category: 'Grains & Pulses',
        unit: 'KG',
        costPrice: 35,
        sellingPrice: 42,
        quantity: 20, // initial stock
      });
    expect(itemRes.status).toBe(201);
    const itemId = itemRes.body.item.id;

    // 2. Upload and read a bill mentioning 50 kg Wheat Flour
    const uploadRes = await request(app)
      .post('/api/v1/bills/upload')
      .set('Authorization', `Bearer ${sessionToken}`)
      .attach('billFile', validPngBuffer, 'flour_bill.png')
      .field('billType', 'SHOP');

    const billId = uploadRes.body.bill.id;
    await request(app).post(`/api/v1/bills/${billId}/read`).set('Authorization', `Bearer ${sessionToken}`);

    // 3. Verify stock has NOT changed! (FR-6.5)
    const checkItemBefore = await request(app)
      .get(`/api/v1/items/${itemId}`)
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(checkItemBefore.body.item.quantityRemaining).toBe(20);
    expect(checkItemBefore.body.item.quantityPurchased).toBe(20);
  });

  it('on Confirm: creates purchase, links existing items, creates new items, and adds to stock (FR-6.6, FR-6.7)', async () => {
    // 1. Pre-existing item in store
    const itemRes = await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({
        name: 'Sunflower Oil 1L',
        category: 'Oils',
        unit: 'LITRE',
        costPrice: 110,
        sellingPrice: 130,
        quantity: 15,
      });
    const existingItemId = itemRes.body.item.id;

    // 2. Upload a bill
    const uploadRes = await request(app)
      .post('/api/v1/bills/upload')
      .set('Authorization', `Bearer ${sessionToken}`)
      .attach('billFile', validPngBuffer, 'oil_spices_invoice.png')
      .field('billType', 'SHOP');
    const billId = uploadRes.body.bill.id;

    // 3. User reviews and confirms the bill:
    // - Line 1: Existing item "Sunflower Oil 1L" (+20 L @ ₹112)
    // - Line 2: Brand new item "Cumin Seeds (జీలకర్ర)" (10 kg @ ₹240)
    const reviewData = {
      supplierShopName: 'Sri Venkateshwara Oil & Spices',
      billNumber: 'INV-2026-88',
      billDate: '2026-11-14',
      billTotal: 4640.0, // 20 * 112 = 2240, 10 * 240 = 2400. Total = 4640.
      lineItems: [
        {
          name: 'Sunflower Oil 1L',
          existingItemId,
          quantity: 20,
          unit: 'LITRE',
          costPrice: 112,
          sellingPrice: 135,
        },
        {
          name: 'Cumin Seeds (జీలకర్ర)',
          quantity: 10,
          unit: 'KG',
          costPrice: 240,
          sellingPrice: 280,
        },
      ],
    };

    const confirmRes = await request(app)
      .post(`/api/v1/bills/${billId}/confirm`)
      .set('Authorization', `Bearer ${sessionToken}`)
      .send(reviewData);

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.success).toBe(true);
    expect(confirmRes.body.purchase).toBeDefined();
    expect(confirmRes.body.purchase.totalAmount).toBe(4640);

    // 4. Verify existing item stock was incremented by 20 (15 + 20 = 35) (FR-6.6)
    const existingCheck = await request(app)
      .get(`/api/v1/items/${existingItemId}`)
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(existingCheck.body.item.quantityRemaining).toBe(35);
    expect(existingCheck.body.item.quantityPurchased).toBe(35);
    expect(existingCheck.body.item.currentCostPrice).toBe(112);

    // 5. Verify new item was created and has 10 kg in stock (FR-6.6, FR-6.7)
    const itemsListRes = await request(app)
      .get('/api/v1/items?search=Cumin')
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(itemsListRes.body.items).toHaveLength(1);
    expect(itemsListRes.body.items[0].name).toBe('Cumin Seeds (జీలకర్ర)');
    expect(itemsListRes.body.items[0].quantityRemaining).toBe(10);

    // 6. Verify supplier was created automatically (FR-6.6)
    const suppliersRes = await request(app)
      .get('/api/v1/suppliers')
      .set('Authorization', `Bearer ${sessionToken}`);
    const createdSupplier = suppliersRes.body.suppliers.find(
      (s: any) => s.shopName === 'Sri Venkateshwara Oil & Spices'
    );
    expect(createdSupplier).toBeDefined();

    // 7. Verify bill is marked CONFIRMED
    const billCheck = await request(app)
      .get(`/api/v1/bills/${billId}`)
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(billCheck.body.bill.status).toBe('CONFIRMED');
    expect(billCheck.body.bill.supplierName).toBe('Sri Venkateshwara Oil & Spices');
  });

  it('allows manual entry and confirmation when reading needs manual entry (FR-6.9)', async () => {
    const uploadRes = await request(app)
      .post('/api/v1/bills/upload')
      .set('Authorization', `Bearer ${sessionToken}`)
      .attach('billFile', validPngBuffer, 'handwritten.png')
      .field('billType', 'SHOP');

    const billId = uploadRes.body.bill.id;

    // User fills in manual data while looking at bill (FR-6.9)
    const manualReview = {
      supplierShopName: 'Local Farmer Direct',
      billNumber: 'MANUAL-001',
      billDate: '2026-11-14',
      billTotal: 600,
      lineItems: [
        {
          name: 'Fresh Lemons (నిమ్మకాయలు)',
          quantity: 100,
          unit: 'PIECE',
          costPrice: 3,
          sellingPrice: 5,
        },
        {
          name: 'Ginger (అల్లం)',
          quantity: 5,
          unit: 'KG',
          costPrice: 60,
          sellingPrice: 80,
        },
      ],
    };

    const confirmRes = await request(app)
      .post(`/api/v1/bills/${billId}/confirm`)
      .set('Authorization', `Bearer ${sessionToken}`)
      .send(manualReview);

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.success).toBe(true);

    const itemsRes = await request(app)
      .get('/api/v1/items?search=Ginger')
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(itemsRes.body.items).toHaveLength(1);
    expect(itemsRes.body.items[0].quantityRemaining).toBe(5);
  });
});

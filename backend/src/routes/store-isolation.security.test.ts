import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import { memoryStores, memorySessions } from '../services/auth.service.js';
import { memoryItems } from '../services/item.service.js';
import { memorySuppliers } from '../services/supplier.service.js';
import { memoryPurchases } from '../services/purchase.service.js';
import { CreditService } from '../services/credit.service.js';
import { OnlineService } from '../services/online.service.js';
import { resetOtpState } from '../services/otp.service.js';

describe('Smart Kirana - Multi-Tenant Data Isolation Security Tests', () => {
  let tokenA: string;
  let tokenB: string;
  let itemAId: string;
  let supplierAId: string;
  let customerAId: string;

  beforeEach(async () => {
    // Clear all in-memory tables
    memoryStores.clear();
    memorySessions.clear();
    memoryItems.clear();
    memorySuppliers.clear();
    memoryPurchases.clear();
    CreditService.resetMemoryState();
    OnlineService.resetMemoryState();
    resetOtpState();

    // 1. Register Store A ("Sri Lakshmi Store")
    const otpResA = await request(app)
      .post('/api/v1/auth/send-otp')
      .send({ mobileNumber: '9991110001', purpose: 'REGISTRATION' });
    const otpA = otpResA.body.devCode;

    const resA = await request(app)
      .post('/api/v1/auth/register')
      .send({
        shopName: 'Sri Lakshmi Store',
        password: 'Password123!',
        mobileNumber: '9991110001',
        otpCode: otpA,
      });
    expect(resA.status).toBe(201);
    tokenA = resA.body.sessionToken;

    // 2. Register Store B ("Balaji Traders")
    const otpResB = await request(app)
      .post('/api/v1/auth/send-otp')
      .send({ mobileNumber: '9992220002', purpose: 'REGISTRATION' });
    const otpB = otpResB.body.devCode;

    const resB = await request(app)
      .post('/api/v1/auth/register')
      .send({
        shopName: 'Balaji Traders',
        password: 'Password123!',
        mobileNumber: '9992220002',
        otpCode: otpB,
      });
    expect(resB.status).toBe(201);
    tokenB = resB.body.sessionToken;

    // 3. Populate private data under Store A
    // Create Supplier for Store A
    const suppRes = await request(app)
      .post('/api/v1/suppliers')
      .set('Cookie', [`kirana_session=${tokenA}`])
      .send({
        shopName: 'Ramu Rice Mill',
        contactPerson: 'Ramu',
        mobileNumber: '9848012345',
        city: 'Vijayawada',
      });
    expect(suppRes.status).toBe(201);
    supplierAId = suppRes.body.supplier.id;

    // Create Item for Store A
    const itemRes = await request(app)
      .post('/api/v1/items')
      .set('Cookie', [`kirana_session=${tokenA}`])
      .send({
        name: 'Sona Masoori Raw Rice',
        category: 'Grains',
        unit: 'KG',
        costPrice: 50,
        sellingPrice: 60,
        quantity: 100,
        supplierShopName: 'Ramu Rice Mill',
      });
    expect(itemRes.status).toBe(201);
    itemAId = itemRes.body.item.id;

    // Create Customer for Store A
    const custRes = await request(app)
      .post('/api/v1/credit')
      .set('Cookie', [`kirana_session=${tokenA}`])
      .send({
        name: 'Venkata Rao',
        mobile: '9849098490',
      });
    expect(custRes.status).toBe(201);
    customerAId = custRes.body.customer.id;

    // Add Credit Entry for Store A
    await request(app)
      .post(`/api/v1/credit/${customerAId}/entries`)
      .set('Cookie', [`kirana_session=${tokenA}`])
      .send({
        itemId: itemAId,
        quantity: 5,
        sellingPrice: 60,
        costPrice: 50,
      });

    // Add Daily Online Entry for Store A
    await request(app)
      .post('/api/v1/online/daily-entries')
      .set('Cookie', [`kirana_session=${tokenA}`])
      .send({
        date: new Date().toISOString().split('T')[0],
        totalAmount: 5000,
      });
  });

  it('prevents Store B from listing Store A items (FR-3)', async () => {
    const res = await request(app)
      .get('/api/v1/items')
      .set('Cookie', [`kirana_session=${tokenB}`]);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
  });

  it('prevents Store B from reading Store A item by ID (FR-3)', async () => {
    const res = await request(app)
      .get(`/api/v1/items/${itemAId}`)
      .set('Cookie', [`kirana_session=${tokenB}`]);

    expect(res.status).toBe(404);
  });

  it('prevents Store B from editing or deleting Store A item (FR-3)', async () => {
    // Attempt edit
    const editRes = await request(app)
      .put(`/api/v1/items/${itemAId}`)
      .set('Cookie', [`kirana_session=${tokenB}`])
      .send({ sellingPrice: 999 });
    expect([400, 404]).toContain(editRes.status);

    // Attempt delete
    const deleteRes = await request(app)
      .delete(`/api/v1/items/${itemAId}`)
      .set('Cookie', [`kirana_session=${tokenB}`]);
    expect([400, 404]).toContain(deleteRes.status);

    // Verify Store A's item remains intact
    const verifyRes = await request(app)
      .get(`/api/v1/items/${itemAId}`)
      .set('Cookie', [`kirana_session=${tokenA}`]);
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.item.currentSellingPrice).toBe(60);
  });

  it('prevents Store B from viewing Store A suppliers (FR-2)', async () => {
    const listRes = await request(app)
      .get('/api/v1/suppliers')
      .set('Cookie', [`kirana_session=${tokenB}`]);

    expect(listRes.status).toBe(200);
    expect(listRes.body.suppliers).toHaveLength(0);

    const getRes = await request(app)
      .get(`/api/v1/suppliers/${supplierAId}`)
      .set('Cookie', [`kirana_session=${tokenB}`]);
    expect(getRes.status).toBe(404);
  });

  it('prevents Store B from viewing Store A customers and debt records (FR-10)', async () => {
    const listRes = await request(app)
      .get('/api/v1/credit')
      .set('Cookie', [`kirana_session=${tokenB}`]);

    expect(listRes.status).toBe(200);
    expect(listRes.body.customers).toHaveLength(0);
    expect(listRes.body.totalCreditDue).toBe(0);

    const getRes = await request(app)
      .get(`/api/v1/credit/${customerAId}`)
      .set('Cookie', [`kirana_session=${tokenB}`]);
    expect(getRes.status).toBe(404);
  });

  it('prevents Store B from seeing Store A daily online amounts and transactions (FR-11)', async () => {
    const onlineRes = await request(app)
      .get('/api/v1/online/summary')
      .set('Cookie', [`kirana_session=${tokenB}`]);

    expect(onlineRes.status).toBe(200);
    expect(onlineRes.body.summary.remainingOnlineAmount).toBe(0);
    expect(onlineRes.body.summary.totalOnlineReceived).toBe(0);
  });

  it('prevents Store B from seeing Store A business figures in Reports and Dashboard (FR-8)', async () => {
    const reportRes = await request(app)
      .get('/api/v1/reports/dashboard')
      .set('Cookie', [`kirana_session=${tokenB}`]);

    expect(reportRes.status).toBe(200);
    expect(reportRes.body.metrics.overallCost).toBe(0);
    expect(reportRes.body.metrics.totalItems).toBe(0);
    expect(reportRes.body.metrics.totalCreditDue).toBe(0);
  });

  it('prevents Store B from viewing or modifying Store A settings and profile (FR-12)', async () => {
    const profRes = await request(app)
      .get('/api/v1/settings/profile')
      .set('Cookie', [`kirana_session=${tokenB}`]);

    expect(profRes.status).toBe(200);
    expect(profRes.body.store.shopName).toBe('Balaji Traders');
    expect(profRes.body.store.shopName).not.toBe('Sri Lakshmi Store');
  });
});

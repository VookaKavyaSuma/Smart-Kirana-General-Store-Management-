import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import { AuthService } from '../services/auth.service.js';
import { ItemService } from '../services/item.service.js';
import { CreditService, memoryOnlineTransactions } from '../services/credit.service.js';
import { generateOtp, resetOtpState } from '../services/otp.service.js';

describe('Smart Kirana - Phase 8: Customer Credit / Debts (FR-10)', () => {
  let sessionToken: string;
  let testItemId: string;

  beforeEach(async () => {
    resetOtpState();
    AuthService.resetMemoryState();
    ItemService.resetMemoryState();
    CreditService.resetMemoryState();

    const mobile = '9876543210';
    const otp = generateOtp(mobile, 'REGISTRATION');
    const regRes = await AuthService.registerStore({
      shopName: 'Maha Lakshmi Kirana',
      password: 'initialPassword123',
      mobileNumber: mobile,
      otpCode: otp.code!,
      language: 'TE',
    });
    sessionToken = regRes.sessionToken!;

    // Create a test item with 10 units in stock
    const itemRes = await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({
        name: 'Sugar (చక్కెర)',
        category: 'General Stores',
        unit: 'KG',
        costPrice: 40,
        sellingPrice: 50,
        quantity: 10,
      });

    testItemId = itemRes.body.item.id;
  });

  it('creates customer, records credit entry, reduces stock, and refuses quantity exceeding stock (FR-10.2, FR-10.3, FR-10.5)', async () => {
    // 1. Add customer (FR-10.2)
    const custRes = await request(app)
      .post('/api/v1/credit')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({
        name: 'Ramesh Kumar',
        mobileNumber: '9848022338',
      });
    expect(custRes.status).toBe(201);
    const customerId = custRes.body.customer.id;

    // 2. Refuse credit entry if quantity exceeds remaining stock (FR-10.5)
    // Stock is 10 KG. Attempting 15 KG should be refused!
    const overStockRes = await request(app)
      .post(`/api/v1/credit/${customerId}/entries`)
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({
        itemId: testItemId,
        quantity: 15,
      });
    expect(overStockRes.status).toBe(400);
    expect(overStockRes.body.error).toContain('remaining in stock');

    // 3. Take 4 KG on credit - should succeed and reduce remaining quantity from 10 to 6 (FR-10.5)
    const creditRes = await request(app)
      .post(`/api/v1/credit/${customerId}/entries`)
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({
        itemId: testItemId,
        quantity: 4,
        dateTaken: '2026-11-14',
      });
    expect(creditRes.status).toBe(201);
    expect(creditRes.body.entry.totalAmount).toBe(200); // 4 KG * ₹50 = ₹200
    expect(creditRes.body.entry.cost).toBe(160); // 4 KG * ₹40 = ₹160
    expect(creditRes.body.entry.profit).toBe(40); // ₹200 - ₹160 = ₹40 (FR-10.4, FR-10.10)

    // Check item remaining quantity has reduced to 6
    const itemCheck = await request(app)
      .get(`/api/v1/items/${testItemId}`)
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(itemCheck.body.item.quantityRemaining).toBe(6);
  });

  it('calculates balance due = total credit - payments, with partial cash & online payments (FR-10.6, FR-10.7)', async () => {
    // 1. Create Customer
    const custRes = await request(app)
      .post('/api/v1/credit')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ name: 'Suresh Reddy' });
    const customerId = custRes.body.customer.id;

    // 2. Add Credit Entry for 2 KG Sugar (2 * 50 = ₹100 due)
    await request(app)
      .post(`/api/v1/credit/${customerId}/entries`)
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({
        itemId: testItemId,
        quantity: 2,
      });

    // Check balance due is ₹100
    const check1 = await request(app)
      .get(`/api/v1/credit/${customerId}`)
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(check1.body.summary.totalCredit).toBe(100);
    expect(check1.body.summary.totalPaid).toBe(0);
    expect(check1.body.summary.balanceDue).toBe(100);

    // 3. Partial cash payment of ₹40
    const pay1 = await request(app)
      .post(`/api/v1/credit/${customerId}/payments`)
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({
        amount: 40,
        mode: 'CASH',
        note: 'Part payment',
      });
    expect(pay1.status).toBe(201);

    // Balance due should now be ₹60 (100 - 40)
    const check2 = await request(app)
      .get(`/api/v1/credit/${customerId}`)
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(check2.body.summary.totalPaid).toBe(40);
    expect(check2.body.summary.balanceDue).toBe(60);

    // 4. Second payment of ₹60 via ONLINE (FR-10.6, FR-11.8)
    const pay2 = await request(app)
      .post(`/api/v1/credit/${customerId}/payments`)
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({
        amount: 60,
        mode: 'ONLINE',
        referenceNumber: 'UPI-99887766',
      });
    expect(pay2.status).toBe(201);

    // Balance due should now be ₹0 (fully paid)
    const check3 = await request(app)
      .get(`/api/v1/credit/${customerId}`)
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(check3.body.summary.totalPaid).toBe(100);
    expect(check3.body.summary.balanceDue).toBe(0);

    // Verify online transaction record was automatically created (FR-10.6, FR-11.8)
    const onlineTx = Array.from(memoryOnlineTransactions.values()).find(
      (tx) => tx.creditPaymentId === pay2.body.payment.id
    );
    expect(onlineTx).toBeDefined();
    expect(onlineTx?.amount).toBe(60);
    expect(onlineTx?.fromCustomer).toBe('Suresh Reddy');
  });

  it('deleting a credit entry restores item stock back to inventory (FR-10.5)', async () => {
    // 1. Create customer
    const custRes = await request(app)
      .post('/api/v1/credit')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ name: 'Venkat Rao' });
    const customerId = custRes.body.customer.id;

    // 2. Take 5 KG on credit. Remaining stock drops from 10 to 5.
    const entryRes = await request(app)
      .post(`/api/v1/credit/${customerId}/entries`)
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({
        itemId: testItemId,
        quantity: 5,
      });
    const entryId = entryRes.body.entry.id;

    const itemMid = await request(app)
      .get(`/api/v1/items/${testItemId}`)
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(itemMid.body.item.quantityRemaining).toBe(5);

    // 3. Delete credit entry (FR-10.5: Deleting an entry puts the quantity back)
    const deleteRes = await request(app)
      .delete(`/api/v1/credit/${customerId}/entries/${entryId}`)
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(deleteRes.status).toBe(200);

    // 4. Verify item stock is fully restored back to 10
    const itemRestored = await request(app)
      .get(`/api/v1/items/${testItemId}`)
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(itemRestored.body.item.quantityRemaining).toBe(10);
  });

  it('lists customers with total credit due at top, filterable by paid and unpaid, sortable by highest due (FR-10.9)', async () => {
    // Customer 1: Unpaid ₹150
    const c1 = await request(app)
      .post('/api/v1/credit')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ name: 'Anil (Unpaid ₹150)' });
    await request(app)
      .post(`/api/v1/credit/${c1.body.customer.id}/entries`)
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ itemId: testItemId, quantity: 3 }); // 3 * 50 = ₹150

    // Customer 2: Unpaid ₹50
    const c2 = await request(app)
      .post('/api/v1/credit')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ name: 'Bhavani (Unpaid ₹50)' });
    await request(app)
      .post(`/api/v1/credit/${c2.body.customer.id}/entries`)
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ itemId: testItemId, quantity: 1 }); // 1 * 50 = ₹50

    // Customer 3: Paid (due = 0)
    const c3 = await request(app)
      .post('/api/v1/credit')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ name: 'Chandra (Fully Paid)' });
    await request(app)
      .post(`/api/v1/credit/${c3.body.customer.id}/entries`)
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ itemId: testItemId, quantity: 1 }); // 1 * 50 = 50
    await request(app)
      .post(`/api/v1/credit/${c3.body.customer.id}/payments`)
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ amount: 50, mode: 'CASH' }); // Paid ₹50 -> balance 0

    // Total credit due at top across all customers = 150 + 50 + 0 = ₹200 (FR-10.9)
    const listAll = await request(app)
      .get('/api/v1/credit?sort=highest_due')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(listAll.status).toBe(200);
    expect(listAll.body.totalCreditDue).toBe(200);
    expect(listAll.body.unpaidCount).toBe(2);
    expect(listAll.body.paidCount).toBe(1);

    // Sorted by highest due: Anil (150) should be first, then Bhavani (50), then Chandra (0)
    expect(listAll.body.customers[0].balanceDue).toBe(150);
    expect(listAll.body.customers[1].balanceDue).toBe(50);
    expect(listAll.body.customers[2].balanceDue).toBe(0);

    // Filter by unpaid
    const listUnpaid = await request(app)
      .get('/api/v1/credit?filter=unpaid')
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(listUnpaid.body.customers.length).toBe(2);

    // Filter by paid
    const listPaid = await request(app)
      .get('/api/v1/credit?filter=paid')
      .set('Authorization', `Bearer ${sessionToken}`);
    expect(listPaid.body.customers.length).toBe(1);
    expect(listPaid.body.customers[0].name).toContain('Chandra');
  });
});


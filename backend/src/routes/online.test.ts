import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import { AuthService } from '../services/auth.service.js';
import { SupplierService } from '../services/supplier.service.js';
import { CreditService } from '../services/credit.service.js';
import { OnlineService } from '../services/online.service.js';
import { generateOtp, resetOtpState } from '../services/otp.service.js';

describe('Smart Kirana - Phase 9: Online Payments & Daily Entry (FR-11)', () => {
  let sessionToken: string;
  let testSupplierId: string;

  beforeEach(async () => {
    resetOtpState();
    AuthService.resetMemoryState();
    SupplierService.resetMemoryState();
    CreditService.resetMemoryState();
    OnlineService.resetMemoryState();

    const mobile = '9876543210';
    const otp = generateOtp(mobile, 'REGISTRATION');
    const regRes = await AuthService.registerStore({
      shopName: 'Ganesh General Stores',
      password: 'password123',
      mobileNumber: mobile,
      otpCode: otp.code!,
      language: 'TE',
    });
    sessionToken = regRes.sessionToken!;

    // Create a test supplier
    const supRes = await SupplierService.createSupplier(regRes.store!.id, 'Sri Balaji Wholesale');
    testSupplierId = supRes.supplier!.id;
  });

  describe('Daily Entry Rule & Discrepancy Warning (FR-11.1, FR-11.3)', () => {
    it('counts transaction sum if no daily entry, and daily entry when entered (FR-11.3)', async () => {
      const dateStr = '2026-11-10';

      // 1. Add 2 online transactions on 2026-11-10: ₹500 and ₹300
      await request(app)
        .post('/api/v1/online/transactions')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          dateTime: `${dateStr}T10:30:00.000Z`,
          amount: 500,
          fromCustomer: 'Customer A',
        });

      await request(app)
        .post('/api/v1/online/transactions')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          dateTime: `${dateStr}T15:45:00.000Z`,
          amount: 300,
          fromCustomer: 'Customer B',
        });

      // Without daily entry, counted online received for 2026-11-10 must be ₹800 (500 + 300)
      const ledger1 = await request(app)
        .get(`/api/v1/online/running-balance?startDate=${dateStr}&endDate=${dateStr}`)
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(ledger1.status).toBe(200);
      const day1 = ledger1.body.days.find((d: any) => d.date === dateStr);
      expect(day1).toBeDefined();
      expect(day1.hasDailyEntry).toBe(false);
      expect(day1.transactionsSum).toBe(800);
      expect(day1.effectiveReceived).toBe(800);
      expect(day1.hasDiscrepancy).toBe(false);

      // 2. Now record a Daily Entry of ₹1,000 for that date
      const dailyEntryRes = await request(app)
        .post('/api/v1/online/daily-entries')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          date: dateStr,
          totalAmount: 1000,
          note: 'Full day QR code settlement',
        });

      expect(dailyEntryRes.status).toBe(200);
      expect(dailyEntryRes.body.entry.totalAmount).toBe(1000);

      // With daily entry, counted amount for the day is the daily entry = ₹1,000 (FR-11.3)
      const ledger2 = await request(app)
        .get(`/api/v1/online/running-balance?startDate=${dateStr}&endDate=${dateStr}`)
        .set('Authorization', `Bearer ${sessionToken}`);

      const day2 = ledger2.body.days.find((d: any) => d.date === dateStr);
      expect(day2.hasDailyEntry).toBe(true);
      expect(day2.dailyEntryAmount).toBe(1000);
      expect(day2.transactionsSum).toBe(800);
      expect(day2.effectiveReceived).toBe(1000);
      expect(day2.hasDiscrepancy).toBe(false);
    });

    it('warns when a day\'s transactions add up to more than its daily entry (FR-11.3)', async () => {
      const dateStr = '2026-11-12';

      // 1. Enter transactions summing to ₹1,500
      await request(app)
        .post('/api/v1/online/transactions')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          dateTime: `${dateStr}T11:00:00.000Z`,
          amount: 1500,
        });

      // 2. Daily entry is entered as only ₹1,000 (transactions > daily entry)
      const res = await request(app)
        .post('/api/v1/online/daily-entries')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          date: dateStr,
          totalAmount: 1000,
        });

      expect(res.status).toBe(200);
      expect(res.body.hasDiscrepancy).toBe(true);
      expect(res.body.transactionsTotal).toBe(1500);

      // In running ledger, discrepancy flag is set
      const ledger = await request(app)
        .get(`/api/v1/online/running-balance?startDate=${dateStr}&endDate=${dateStr}`)
        .set('Authorization', `Bearer ${sessionToken}`);

      const day = ledger.body.days.find((d: any) => d.date === dateStr);
      expect(day.hasDiscrepancy).toBe(true);
    });
  });

  describe('Remaining Online Amount Balance Formula & Confirmation (FR-11.5, FR-11.6, FR-11.7)', () => {
    it('calculates remaining online amount = online received minus online paid to suppliers (FR-11.5, Acceptance Criteria)', async () => {
      // 1. Day 1: Daily online entry of ₹5,000
      await request(app)
        .post('/api/v1/online/daily-entries')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          date: '2026-11-13',
          totalAmount: 5000,
        });

      // 2. Pay ₹2,000 to supplier
      const payRes = await request(app)
        .post('/api/v1/online/supplier-payments')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          supplierId: testSupplierId,
          amount: 2000,
          date: '2026-11-13',
          referenceNumber: 'NEFT-12345',
        });
      expect(payRes.status).toBe(201);

      // 3. Verify Remaining Online Amount = ₹5,000 - ₹2,000 = ₹3,000 (Acceptance Criteria)
      const summaryRes = await request(app)
        .get('/api/v1/online/summary')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(summaryRes.status).toBe(200);
      expect(summaryRes.body.summary.totalOnlineReceived).toBe(5000);
      expect(summaryRes.body.summary.totalOnlinePaidToSuppliers).toBe(2000);
      expect(summaryRes.body.summary.remainingOnlineAmount).toBe(3000);
    });

    it('asks for confirmation if a supplier payment is larger than remaining online amount (FR-11.7)', async () => {
      // Current online balance is ₹1,000
      await request(app)
        .post('/api/v1/online/daily-entries')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          date: '2026-11-14',
          totalAmount: 1000,
        });

      // Attempting to pay ₹2,500 without force should return 409 Conflict with exceedsBalance: true (FR-11.7)
      const warnRes = await request(app)
        .post('/api/v1/online/supplier-payments')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          supplierId: testSupplierId,
          amount: 2500,
        });

      expect(warnRes.status).toBe(409);
      expect(warnRes.body.exceedsBalance).toBe(true);
      expect(warnRes.body.remainingBalance).toBe(1000);
      expect(warnRes.body.error).toContain('exceeds remaining online balance');

      // Now confirm and send with force: true
      const confirmedRes = await request(app)
        .post('/api/v1/online/supplier-payments')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          supplierId: testSupplierId,
          amount: 2500,
          force: true,
        });

      expect(confirmedRes.status).toBe(201);
      expect(confirmedRes.body.payment.amount).toBe(2500);

      // Online balance now becomes negative (-₹1,500)
      const summaryAfter = await request(app)
        .get('/api/v1/online/summary')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(summaryAfter.body.summary.remainingOnlineAmount).toBe(-1500);
    });
  });

  describe('Integration with Customer Credit & Supplier Online Total (FR-10.6, FR-11.8, FR-11.9)', () => {
    it('customer credit payment marked online appears in online transactions automatically (FR-10.6, FR-11.8)', async () => {
      // 1. Create a customer
      const custRes = await request(app)
        .post('/api/v1/credit')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({ name: 'Narayana Swamy' });
      const customerId = custRes.body.customer.id;

      // 2. Record a credit payment of ₹750 marked ONLINE
      const payRes = await request(app)
        .post(`/api/v1/credit/${customerId}/payments`)
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          amount: 750,
          mode: 'ONLINE',
          referenceNumber: 'UPI-778899',
        });
      expect(payRes.status).toBe(201);

      // 3. Verify it appears in online transactions list (FR-11.8)
      const txsRes = await request(app)
        .get('/api/v1/online/transactions')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(txsRes.status).toBe(200);
      const foundTx = txsRes.body.transactions.find((t: any) => t.amount === 750);
      expect(foundTx).toBeDefined();
      expect(foundTx.fromCustomer).toBe('Narayana Swamy');
      expect(foundTx.referenceNumber).toBe('UPI-778899');
    });

    it('returns total paid online to a supplier (FR-11.9)', async () => {
      // Make two payments to supplier: ₹800 and ₹1,200
      await request(app)
        .post('/api/v1/online/supplier-payments')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          supplierId: testSupplierId,
          amount: 800,
          force: true,
        });

      await request(app)
        .post('/api/v1/online/supplier-payments')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          supplierId: testSupplierId,
          amount: 1200,
          force: true,
        });

      const totalRes = await request(app)
        .get(`/api/v1/online/supplier-total/${testSupplierId}`)
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(totalRes.status).toBe(200);
      expect(totalRes.body.totalPaidOnline).toBe(2000);
    });

    it('exports all online data as a structured CSV report (FR-11.10)', async () => {
      const csvRes = await request(app)
        .get('/api/v1/online/export-csv')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(csvRes.status).toBe(200);
      expect(csvRes.headers['content-type']).toContain('text/csv');
      expect(csvRes.text).toContain('=== SMART KIRANA ONLINE PAYMENTS REPORT ===');
      expect(csvRes.text).toContain('=== DAY-BY-DAY ONLINE LEDGER & RUNNING BALANCE ===');
      expect(csvRes.text).toContain('=== MONTH-WISE TOTALS ===');
    });
  });
});


import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import { AuthService } from '../services/auth.service.js';
import { BillService } from '../services/bill.service.js';
import { generateOtp, resetOtpState } from '../services/otp.service.js';

describe('Smart Kirana - Phase 4: Bills & Private File Storage (FR-6.1 to FR-6.3, FR-6.10)', () => {
  let sessionToken: string;

  beforeEach(async () => {
    resetOtpState();
    AuthService.resetMemoryState();
    BillService.resetMemoryState();

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

  it('uploads a shop bill image (JPG/PNG) up to 10 MB (FR-6.1, FR-6.3)', async () => {
    const fakeImageBuffer = Buffer.from('fake-jpeg-image-content-binary-data');

    const res = await request(app)
      .post('/api/v1/bills/upload')
      .set('Authorization', `Bearer ${sessionToken}`)
      .field('billType', 'SHOP')
      .field('billNumber', 'INV-2026-001')
      .field('supplierName', 'Sri Venkateshwara Traders')
      .field('totalAmount', '4500.00')
      .field('billDate', '2026-11-14')
      .attach('billFile', fakeImageBuffer, {
        filename: 'paper_bill_photo.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.bill).toBeDefined();
    expect(res.body.bill.billType).toBe('SHOP');
    expect(res.body.bill.billNumber).toBe('INV-2026-001');
    expect(res.body.bill.supplierName).toBe('Sri Venkateshwara Traders');
    expect(res.body.bill.totalAmount).toBe(4500.0);
    expect(res.body.bill.fileType).toBe('jpg');

    // Signed link generated, never raw public path! (FR-6.3)
    expect(res.body.bill.signedUrl).toContain('/api/v1/bills/');
    expect(res.body.bill.signedUrl).toContain('token=');
  });

  it('uploads an online invoice document (PDF) marked as Online (FR-6.2)', async () => {
    const fakePdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');

    const res = await request(app)
      .post('/api/v1/bills/upload')
      .set('Authorization', `Bearer ${sessionToken}`)
      .field('billType', 'ONLINE')
      .field('billNumber', 'AMZN-99823')
      .field('supplierName', 'Amazon Business Wholesale')
      .field('totalAmount', '12500.50')
      .attach('billFile', fakePdfBuffer, {
        filename: 'tax_invoice.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.bill.billType).toBe('ONLINE');
    expect(res.body.bill.fileType).toBe('pdf');
  });

  it('enforces server-side validation: rejects disallowed file types (FR-6.3)', async () => {
    const fakeTxtBuffer = Buffer.from('plain text file');

    const res = await request(app)
      .post('/api/v1/bills/upload')
      .set('Authorization', `Bearer ${sessionToken}`)
      .field('billType', 'SHOP')
      .attach('billFile', fakeTxtBuffer, {
        filename: 'document.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Only JPG, PNG images and PDF documents are allowed');
  });

  it('protects private bills: enforces short-lived signed HMAC links (FR-6.3)', async () => {
    // 1. Upload private bill
    const fakeBuffer = Buffer.from('secure-bill-pdf-content');
    const uploadRes = await request(app)
      .post('/api/v1/bills/upload')
      .set('Authorization', `Bearer ${sessionToken}`)
      .field('billType', 'SHOP')
      .attach('billFile', fakeBuffer, {
        filename: 'private_receipt.pdf',
        contentType: 'application/pdf',
      });

    const billId = uploadRes.body.bill.id;
    const signedUrl = uploadRes.body.bill.signedUrl;

    // 2. Direct access without token must be rejected (403 Forbidden)
    const unauthorizedRes = await request(app).get(`/api/v1/bills/${billId}/access`);
    expect(unauthorizedRes.status).toBe(403);
    expect(unauthorizedRes.body.error).toContain('Missing signed token');

    // 3. Direct access with a tampered token must be rejected (403 Forbidden)
    const tamperedRes = await request(app).get(`/api/v1/bills/${billId}/access?token=1999999999.invalid_signature`);
    expect(tamperedRes.status).toBe(403);
    expect(tamperedRes.body.error).toContain('Invalid or expired link');

    // 4. Access with valid signed link succeeds!
    const validRes = await request(app).get(signedUrl);
    expect(validRes.status).toBe(200);
    expect(validRes.headers['content-type']).toContain('application/pdf');
    expect(validRes.headers['cache-control']).toContain('no-store');
  });

  it('filters bills by supplier, date, bill number, and Shop/Online type (FR-6.10)', async () => {
    const fakeBuffer = Buffer.from('test-bill');

    // Upload Shop bill
    await request(app)
      .post('/api/v1/bills/upload')
      .set('Authorization', `Bearer ${sessionToken}`)
      .field('billType', 'SHOP')
      .field('billNumber', 'SHOP-100')
      .field('supplierName', 'Balaji Traders')
      .field('billDate', '2026-11-10')
      .attach('billFile', fakeBuffer, { filename: 'b1.jpg', contentType: 'image/jpeg' });

    // Upload Online invoice
    await request(app)
      .post('/api/v1/bills/upload')
      .set('Authorization', `Bearer ${sessionToken}`)
      .field('billType', 'ONLINE')
      .field('billNumber', 'ONL-200')
      .field('supplierName', 'Flipkart Wholesale')
      .field('billDate', '2026-11-14')
      .attach('billFile', fakeBuffer, { filename: 'b2.pdf', contentType: 'application/pdf' });

    // Filter by Online type only
    const onlineRes = await request(app)
      .get('/api/v1/bills?billType=ONLINE')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(onlineRes.body.bills.length).toBe(1);
    expect(onlineRes.body.bills[0].billNumber).toBe('ONL-200');

    // Filter by supplier name
    const supRes = await request(app)
      .get('/api/v1/bills?supplierName=Balaji')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(supRes.body.bills.length).toBe(1);
    expect(supRes.body.bills[0].supplierName).toBe('Balaji Traders');

    // Filter by bill number
    const billNumRes = await request(app)
      .get('/api/v1/bills?billNumber=100')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(billNumRes.body.bills.length).toBe(1);
    expect(billNumRes.body.bills[0].billNumber).toBe('SHOP-100');
  });
});


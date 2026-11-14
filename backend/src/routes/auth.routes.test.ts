import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import { AuthService } from '../services/auth.service.js';
import { resetOtpState } from '../services/otp.service.js';

describe('Smart Kirana - Auth API Routes Integration Tests', () => {
  beforeEach(() => {
    resetOtpState();
    AuthService.resetMemoryState();
  });

  it('POST /api/v1/auth/check-username derives lowercase username with no spaces', async () => {
    const res = await request(app)
      .post('/api/v1/auth/check-username')
      .send({ shopName: 'Sri Lakshmi Stores' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.available).toBe(true);
    expect(res.body.derivedUsername).toBe('srilakshmistores');
  });

  it('Full registration, case-insensitive login, and session validation flow', async () => {
    // 1. Request OTP for registration
    const otpRes = await request(app)
      .post('/api/v1/auth/send-otp')
      .send({ mobileNumber: '9876543210', purpose: 'REGISTRATION' });

    expect(otpRes.status).toBe(200);
    const devOtp = otpRes.body.devCode;
    expect(devOtp).toBeDefined();

    // 2. Register store
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .set('User-Agent', 'Test Phone Chrome')
      .send({
        shopName: 'Sri Lakshmi Stores',
        password: 'password123',
        mobileNumber: '9876543210',
        otpCode: devOtp,
        language: 'TE',
      });

    expect(regRes.status).toBe(201);
    expect(regRes.body.success).toBe(true);
    expect(regRes.body.store.username).toBe('srilakshmistores');
    expect(regRes.body.sessionToken).toBeDefined();

    // Cookie must be set
    const cookies = regRes.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toContain('kirana_session');

    // 3. Log in with UPPERCASE username "SRILAKSHMISTORES" (FR-1.3)
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('User-Agent', 'Shop Tablet Device')
      .send({
        username: 'SRILAKSHMISTORES',
        password: 'password123',
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.store.username).toBe('srilakshmistores');
    const tabletSessionToken = loginRes.body.sessionToken;

    // 4. Validate /auth/me with Bearer token
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tabletSessionToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.store.shopName).toBe('Sri Lakshmi Stores');
    expect(meRes.body.session.deviceName).toContain('Tablet');

    // 5. Query active devices (FR-12.7)
    const devicesRes = await request(app)
      .get('/api/v1/auth/devices')
      .set('Authorization', `Bearer ${tabletSessionToken}`);

    expect(devicesRes.status).toBe(200);
    expect(devicesRes.body.devices.length).toBe(2); // Phone + Tablet

    // 6. Log out from current device
    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${tabletSessionToken}`);

    expect(logoutRes.status).toBe(200);

    // 7. Verify tablet token is now rejected
    const meAfterLogout = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tabletSessionToken}`);

    expect(meAfterLogout.status).toBe(401);
  });
});

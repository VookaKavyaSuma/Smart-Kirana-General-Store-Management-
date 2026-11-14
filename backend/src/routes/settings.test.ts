import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import { AuthService } from '../services/auth.service.js';
import { resetOtpState, generateOtp } from '../services/otp.service.js';

describe('Smart Kirana - Phase 7: Settings & Multi-Device Sessions (FR-12, FR-1.8 to FR-1.10)', () => {
  beforeEach(() => {
    resetOtpState();
    AuthService.resetMemoryState();
  });

  const setupStore = async (mobile = '9876543210', shop = 'Sri Krishna Kirana') => {
    const otp = generateOtp(mobile, 'REGISTRATION');
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        shopName: shop,
        password: 'initialPassword123',
        mobileNumber: mobile,
        otpCode: otp.code,
        language: 'TE',
      });
    return {
      store: res.body.store,
      token: res.body.sessionToken,
    };
  };

  describe('Multi-Device Session Isolation (FR-1.8, FR-1.9, FR-1.10, FR-12.5, FR-12.6)', () => {
    it('logout on one device does not end the other devices (FR-1.9, FR-12.5)', async () => {
      // 1. Device 1 registers
      const { store, token: tokenDevice1 } = await setupStore('9876543210', 'Venkateshwara Stores');

      // 2. Device 2 logs in with same account
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .set('User-Agent', 'Tablet Chrome')
        .send({
          username: store.username,
          password: 'initialPassword123',
        });
      expect(loginRes.status).toBe(200);
      const tokenDevice2 = loginRes.body.sessionToken;

      // Both devices are active
      const dev1Check = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tokenDevice1}`);
      expect(dev1Check.status).toBe(200);

      const dev2Check = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tokenDevice2}`);
      expect(dev2Check.status).toBe(200);

      // 3. Logout ONLY on Device 1
      const logoutDev1 = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${tokenDevice1}`);
      expect(logoutDev1.status).toBe(200);

      // 4. Verify Device 1 is ended
      const dev1After = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tokenDevice1}`);
      expect(dev1After.status).toBe(401);

      // 5. Verify Device 2 remains completely logged in and functional
      const dev2After = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tokenDevice2}`);
      expect(dev2After.status).toBe(200);
      expect(dev2After.body.store.username).toBe(store.username);
    });

    it('logout on all devices ends them all (FR-1.10, FR-12.6)', async () => {
      // 1. Device 1 registers
      const { store, token: tokenDev1 } = await setupStore('9876543210', 'Balaji Provisions');

      // 2. Device 2 logs in
      const login2 = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: store.username,
          password: 'initialPassword123',
        });
      const tokenDev2 = login2.body.sessionToken;

      // 3. Device 3 logs in
      const login3 = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: store.username,
          password: 'initialPassword123',
        });
      const tokenDev3 = login3.body.sessionToken;

      // All 3 devices are active
      expect((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${tokenDev1}`)).status).toBe(200);
      expect((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${tokenDev2}`)).status).toBe(200);
      expect((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${tokenDev3}`)).status).toBe(200);

      // 4. Trigger "Log out from all devices" from Device 1
      const logoutAllRes = await request(app)
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${tokenDev1}`);
      expect(logoutAllRes.status).toBe(200);

      // 5. Verify ALL devices are now ended (401 Unauthorized)
      expect((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${tokenDev1}`)).status).toBe(401);
      expect((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${tokenDev2}`)).status).toBe(401);
      expect((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${tokenDev3}`)).status).toBe(401);
    });

    it('lists logged-in devices and allows revoking an individual session (FR-12.7)', async () => {
      const { store, token: tokenDev1 } = await setupStore('9876543210', 'Raghavendra Kirana');

      const loginDev2 = await request(app)
        .post('/api/v1/auth/login')
        .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile')
        .send({
          username: store.username,
          password: 'initialPassword123',
        });
      const tokenDev2 = loginDev2.body.sessionToken;

      // Fetch active devices from Device 1
      const devicesRes = await request(app)
        .get('/api/v1/auth/devices')
        .set('Authorization', `Bearer ${tokenDev1}`);
      expect(devicesRes.status).toBe(200);
      expect(devicesRes.body.devices.length).toBe(2);

      const dev2Session = devicesRes.body.devices.find((d: any) => !d.isCurrentDevice);
      expect(dev2Session).toBeDefined();

      // Revoke Device 2 from Device 1
      const revokeRes = await request(app)
        .delete(`/api/v1/auth/devices/${dev2Session.id}`)
        .set('Authorization', `Bearer ${tokenDev1}`);
      expect(revokeRes.status).toBe(200);

      // Device 2 should now be revoked
      expect((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${tokenDev2}`)).status).toBe(401);
      // Device 1 should still be active
      expect((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${tokenDev1}`)).status).toBe(200);
    });
  });

  describe('Settings Profile & Shop Photo (FR-12.2, FR-12.3)', () => {
    it('returns complete profile information with read-only fields and creation date', async () => {
      const { store, token } = await setupStore('9876543210', 'Sai Baba Supermarket');

      const res = await request(app)
        .get('/api/v1/settings/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.store.shopName).toBe('Sai Baba Supermarket');
      expect(res.body.store.username).toBe('saibabasupermarket');
      expect(res.body.store.mobileNumber).toBe('9876543210');
      expect(res.body.store.createdAt).toBeDefined();
      expect(res.body.store.lowStockThreshold).toBeDefined();
    });

    it('uploads, updates, and removes shop photo (FR-12.3)', async () => {
      const { token } = await setupStore('9876543210', 'Photo Test Kirana');

      // 1. Upload/update shop photo URL
      const updatePhoto = await request(app)
        .post('/api/v1/settings/photo')
        .set('Authorization', `Bearer ${token}`)
        .send({ photoUrl: '/uploads/shops/sample-store-front.jpg' });

      expect(updatePhoto.status).toBe(200);
      expect(updatePhoto.body.photoUrl).toBe('/uploads/shops/sample-store-front.jpg');

      // Verify in profile
      const prof1 = await request(app)
        .get('/api/v1/settings/profile')
        .set('Authorization', `Bearer ${token}`);
      expect(prof1.body.store.shopPhotoUrl).toBe('/uploads/shops/sample-store-front.jpg');

      // 2. Remove shop photo
      const removePhoto = await request(app)
        .delete('/api/v1/settings/photo')
        .set('Authorization', `Bearer ${token}`);

      expect(removePhoto.status).toBe(200);
      expect(removePhoto.body.photoUrl).toBeNull();

      // Verify removed in profile
      const prof2 = await request(app)
        .get('/api/v1/settings/profile')
        .set('Authorization', `Bearer ${token}`);
      expect(prof2.body.store.shopPhotoUrl).toBeNull();
    });
  });

  describe('Change Password & Preferences (FR-12.4, FR-12.8)', () => {
    it('changes password and verifies new password works while old password fails', async () => {
      const { store, token } = await setupStore('9876543210', 'Password Test Store');

      // Attempt with wrong current password
      const wrongAttempt = await request(app)
        .post('/api/v1/settings/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'wrongPassword!',
          newPassword: 'brandNewPassword999',
          confirmPassword: 'brandNewPassword999',
        });
      expect(wrongAttempt.status).toBe(400);
      expect(wrongAttempt.body.error).toContain('does not match');

      // Successful change
      const successChange = await request(app)
        .post('/api/v1/settings/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'initialPassword123',
          newPassword: 'brandNewPassword999',
          confirmPassword: 'brandNewPassword999',
          logoutAllDevices: false,
        });
      expect(successChange.status).toBe(200);

      // Verify old password fails at login
      const oldLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: store.username,
          password: 'initialPassword123',
        });
      expect(oldLogin.status).toBe(401);

      // Verify new password succeeds at login
      const newLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: store.username,
          password: 'brandNewPassword999',
        });
      expect(newLogin.status).toBe(200);
    });

    it('updates preferences: language, low-stock limit, and daily reminder (FR-12.8)', async () => {
      const { token } = await setupStore('9876543210', 'Preferences Store');

      const res = await request(app)
        .put('/api/v1/settings/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({
          language: 'EN',
          lowStockThreshold: 10,
          dailyReminderEnabled: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.store.language).toBe('EN');
      expect(res.body.store.lowStockThreshold).toBe(10);
      expect(res.body.store.dailyReminderEnabled).toBe(false);
    });
  });

  describe('Change Mobile Number with OTP (FR-12.9)', () => {
    it('requests OTP and verifies mobile number change to a new number', async () => {
      const { token } = await setupStore('9876543210', 'Mobile Change Store');
      const newMobile = '9123456780';

      // 1. Request OTP to new number
      const reqOtpRes = await request(app)
        .post('/api/v1/settings/change-mobile/request-otp')
        .set('Authorization', `Bearer ${token}`)
        .send({ newMobileNumber: newMobile });

      expect(reqOtpRes.status).toBe(200);
      const devCode = reqOtpRes.body.devCode;
      expect(devCode).toBeDefined();

      // 2. Verify OTP and finalize change
      const verifyRes = await request(app)
        .post('/api/v1/settings/change-mobile/verify-otp')
        .set('Authorization', `Bearer ${token}`)
        .send({
          newMobileNumber: newMobile,
          otpCode: devCode,
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.newMobileNumber).toBe(newMobile);

      // 3. Verify in profile
      const prof = await request(app)
        .get('/api/v1/settings/profile')
        .set('Authorization', `Bearer ${token}`);
      expect(prof.body.store.mobileNumber).toBe(newMobile);
    });
  });

  describe('Export to CSV and Delete Account (FR-12.10)', () => {
    it('exports all store data as a CSV file attachment', async () => {
      const { token } = await setupStore('9876543210', 'CSV Export Store');

      const res = await request(app)
        .get('/api/v1/settings/export-csv')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('=== SMART KIRANA STORE DATA EXPORT ===');
      expect(res.text).toContain('=== INVENTORY ITEMS ===');
      expect(res.text).toContain('=== SUPPLIERS ===');
    });

    it('requires password and OTP to delete account permanently', async () => {
      const { store, token } = await setupStore('9876543210', 'Delete Test Store');

      // 1. Request deletion OTP with correct password
      const otpReq = await request(app)
        .post('/api/v1/settings/delete-account/request-otp')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'initialPassword123' });

      expect(otpReq.status).toBe(200);
      const devCode = otpReq.body.devCode;

      // 2. Confirm account deletion
      const deleteConfirm = await request(app)
        .post('/api/v1/settings/delete-account/confirm')
        .set('Authorization', `Bearer ${token}`)
        .send({
          password: 'initialPassword123',
          otpCode: devCode,
        });

      expect(deleteConfirm.status).toBe(200);
      expect(deleteConfirm.body.success).toBe(true);

      // 3. Attempting login should now fail because account is deleted
      const loginAttempt = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: store.username,
          password: 'initialPassword123',
        });
      expect(loginAttempt.status).toBe(401);
    });
  });
});

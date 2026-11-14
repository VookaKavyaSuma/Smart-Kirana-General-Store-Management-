import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from './auth.service.js';
import { generateOtp, resetOtpState } from './otp.service.js';

describe('Smart Kirana - Authentication & Sessions (FR-1)', () => {
  beforeEach(() => {
    resetOtpState();
    AuthService.resetMemoryState();
  });

  it('registers with shop name "Sri Lakshmi Stores" and derives username "srilakshmistores" (Acceptance Criteria)', async () => {
    const mobile = '9876543210';
    const otp = generateOtp(mobile, 'REGISTRATION');

    const result = await AuthService.registerStore({
      shopName: 'Sri Lakshmi Stores',
      password: 'password123',
      mobileNumber: mobile,
      otpCode: otp.code!,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    });

    expect(result.success).toBe(true);
    expect(result.store).toBeDefined();
    expect(result.store?.shopName).toBe('Sri Lakshmi Stores');
    expect(result.store?.username).toBe('srilakshmistores');
    expect(result.sessionToken).toBeDefined();
  });

  it('refuses registration if username is already taken (FR-1.4)', async () => {
    const mobile1 = '9876543210';
    const otp1 = generateOtp(mobile1, 'REGISTRATION');

    await AuthService.registerStore({
      shopName: 'Sri Lakshmi Stores',
      password: 'password123',
      mobileNumber: mobile1,
      otpCode: otp1.code!,
    });

    // Attempt second registration with slightly different casing or spacing but same derived username
    const mobile2 = '9876543211';
    const otp2 = generateOtp(mobile2, 'REGISTRATION');

    const duplicateResult = await AuthService.registerStore({
      shopName: 'SRI LAKSHMI STORES',
      password: 'password456',
      mobileNumber: mobile2,
      otpCode: otp2.code!,
    });

    expect(duplicateResult.success).toBe(false);
    expect(duplicateResult.error).toContain('already taken');
  });

  it('allows login with UPPERCASE username (case-insensitive login FR-1.3, Acceptance Criteria)', async () => {
    const mobile = '9876543210';
    const otp = generateOtp(mobile, 'REGISTRATION');

    await AuthService.registerStore({
      shopName: 'Sri Lakshmi Stores',
      password: 'mypassword88',
      mobileNumber: mobile,
      otpCode: otp.code!,
    });

    // Log in with all caps "SRILAKSHMISTORES"
    const loginResult = await AuthService.login({
      username: 'SRILAKSHMISTORES',
      password: 'mypassword88',
      userAgent: 'Android Mobile Device',
    });

    expect(loginResult.success).toBe(true);
    expect(loginResult.store?.username).toBe('srilakshmistores');
    expect(loginResult.sessionToken).toBeDefined();
  });

  it('supports sessions that last on many devices at once (FR-1.8, FR-1.9, Acceptance Criteria)', async () => {
    const mobile = '9876543210';
    const otp = generateOtp(mobile, 'REGISTRATION');

    // Register on Phone 1
    const reg = await AuthService.registerStore({
      shopName: 'Balaji Kirana',
      password: 'securePassword1',
      mobileNumber: mobile,
      otpCode: otp.code!,
      userAgent: 'Android Mobile',
    });
    const phoneToken = reg.sessionToken!;

    // Log in on Shop Tablet
    const tabletLogin = await AuthService.login({
      username: 'balajikirana',
      password: 'securePassword1',
      userAgent: 'Shop Tablet (iPad)',
    });
    const tabletToken = tabletLogin.sessionToken!;

    // Both sessions should be simultaneously active
    const phoneSession = await AuthService.validateSession(phoneToken);
    const tabletSession = await AuthService.validateSession(tabletToken);

    expect(phoneSession.valid).toBe(true);
    expect(tabletSession.valid).toBe(true);

    // Logout on Phone 1 only (FR-1.9: Logout on one device shall not log out the others)
    await AuthService.logout(phoneToken);

    const phoneAfterLogout = await AuthService.validateSession(phoneToken);
    const tabletAfterLogout = await AuthService.validateSession(tabletToken);

    expect(phoneAfterLogout.valid).toBe(false); // Phone is logged out
    expect(tabletAfterLogout.valid).toBe(true);  // Tablet remains logged in!
  });

  it('allows logging out from all devices at once (FR-1.10)', async () => {
    const mobile = '9876543210';
    const otp = generateOtp(mobile, 'REGISTRATION');

    const reg = await AuthService.registerStore({
      shopName: 'Krishna General Store',
      password: 'securePassword1',
      mobileNumber: mobile,
      otpCode: otp.code!,
    });

    const login2 = await AuthService.login({
      username: 'krishnageneralstore',
      password: 'securePassword1',
    });

    const token1 = reg.sessionToken!;
    const token2 = login2.sessionToken!;

    // Both valid
    expect((await AuthService.validateSession(token1)).valid).toBe(true);
    expect((await AuthService.validateSession(token2)).valid).toBe(true);

    // Log out all devices
    await AuthService.logoutAll(reg.store!.id);

    expect((await AuthService.validateSession(token1)).valid).toBe(false);
    expect((await AuthService.validateSession(token2)).valid).toBe(false);
  });

  it('resets password via OTP and allows login with the new password (FR-1.7)', async () => {
    const mobile = '9876543210';
    const regOtp = generateOtp(mobile, 'REGISTRATION');

    await AuthService.registerStore({
      shopName: 'Ganesh Kirana',
      password: 'oldPassword123',
      mobileNumber: mobile,
      otpCode: regOtp.code!,
    });

    // Request forgot password OTP
    const forgotOtpReq = await AuthService.requestForgotPasswordOtp('ganeshkirana', mobile);
    expect(forgotOtpReq.success).toBe(true);

    // Reset password
    const resetResult = await AuthService.resetPasswordWithOtp({
      username: 'ganeshkirana',
      mobileNumber: mobile,
      otpCode: forgotOtpReq.code!,
      newPassword: 'newBrandPassword456',
      logoutAllDevices: true,
    });
    expect(resetResult.success).toBe(true);

    // Old password should fail
    const oldLogin = await AuthService.login({
      username: 'ganeshkirana',
      password: 'oldPassword123',
    });
    expect(oldLogin.success).toBe(false);

    // New password should succeed
    const newLogin = await AuthService.login({
      username: 'ganeshkirana',
      password: 'newBrandPassword456',
    });
    expect(newLogin.success).toBe(true);
  });
});


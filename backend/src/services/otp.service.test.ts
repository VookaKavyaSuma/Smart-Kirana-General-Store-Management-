import { describe, it, expect, beforeEach } from 'vitest';
import { generateOtp, verifyOtp, resetOtpState, hashOtp } from './otp.service.js';

describe('Smart Kirana - OTP Service (FR-1.5, FR-1.7)', () => {
  const testMobile = '9876543210';

  beforeEach(() => {
    resetOtpState();
  });

  it('generates a 6-digit numeric OTP code', () => {
    const result = generateOtp(testMobile, 'REGISTRATION');
    expect(result.success).toBe(true);
    expect(result.code).toBeDefined();
    expect(result.code).toMatch(/^\d{6}$/);
  });

  it('verifies the correct OTP code successfully', () => {
    const { code } = generateOtp(testMobile, 'REGISTRATION');
    const verifyResult = verifyOtp(testMobile, code!, 'REGISTRATION');
    expect(verifyResult.success).toBe(true);
  });

  it('enforces single-use policy (FR-1.7)', () => {
    const { code } = generateOtp(testMobile, 'REGISTRATION');
    const firstAttempt = verifyOtp(testMobile, code!, 'REGISTRATION');
    expect(firstAttempt.success).toBe(true);

    // Second attempt with same code must fail
    const secondAttempt = verifyOtp(testMobile, code!, 'REGISTRATION');
    expect(secondAttempt.success).toBe(false);
    expect(secondAttempt.error).toContain('already been used');
  });

  it('enforces maximum 5 wrong attempts limit (FR-1.7)', () => {
    const { code } = generateOtp(testMobile, 'FORGOT_PASSWORD');
    const wrongCode = '000000';

    for (let i = 1; i <= 4; i++) {
      const attempt = verifyOtp(testMobile, wrongCode, 'FORGOT_PASSWORD');
      expect(attempt.success).toBe(false);
      expect(attempt.error).toContain(`${5 - i} attempts remaining`);
    }

    // 5th wrong attempt should invalidate the OTP
    const fifthAttempt = verifyOtp(testMobile, wrongCode, 'FORGOT_PASSWORD');
    expect(fifthAttempt.success).toBe(false);
    expect(fifthAttempt.error).toContain('Maximum wrong attempts');

    // Even with the correct code now, it should fail
    const correctAfterLimit = verifyOtp(testMobile, code!, 'FORGOT_PASSWORD');
    expect(correctAfterLimit.success).toBe(false);
  });

  it('enforces rate limit of 3 requests per hour (FR-1.7)', () => {
    const mobile = '9123456789';

    // 1st request
    const r1 = generateOtp(mobile, 'REGISTRATION');
    expect(r1.success).toBe(true);

    // 2nd request
    const r2 = generateOtp(mobile, 'REGISTRATION');
    expect(r2.success).toBe(true);

    // 3rd request
    const r3 = generateOtp(mobile, 'REGISTRATION');
    expect(r3.success).toBe(true);

    // 4th request must be rejected
    const r4 = generateOtp(mobile, 'REGISTRATION');
    expect(r4.success).toBe(false);
    expect(r4.error).toContain('Too many OTP requests');
    expect(r4.remainingWaitMinutes).toBeGreaterThan(0);
  });

  it('hashes OTP codes consistently with SHA-256', () => {
    const hash1 = hashOtp('123456');
    const hash2 = hashOtp('123456');
    const hash3 = hashOtp('654321');

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1.length).toBe(64); // sha256 hex length
  });
});


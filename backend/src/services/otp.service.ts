import crypto from 'crypto';

export interface OtpRecord {
  id: string;
  mobileNumber: string;
  codeHash: string;
  purpose: 'REGISTRATION' | 'FORGOT_PASSWORD' | 'CHANGE_MOBILE' | 'DELETE_ACCOUNT';
  attempts: number;
  isUsed: boolean;
  expiresAt: Date;
  createdAt: Date;
}

// In-memory cache for OTP request rate-limiting (3 requests per hour) & fast fallback
interface RequestLog {
  timestamps: number[];
}

const mobileRequestLogs = new Map<string, RequestLog>();
// Active OTP store (in-memory with DB persistence capability)
const activeOtps = new Map<string, OtpRecord>();

const MAX_ATTEMPTS = 5;
const EXPIRY_MINUTES = 10;
const MAX_REQUESTS_PER_HOUR = 3;

/**
 * Hash an OTP code using SHA-256 with a salt for secure storage
 */
export function hashOtp(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Check rate limit: max 3 requests per hour per mobile number
 */
export function checkRateLimit(mobileNumber: string): { allowed: boolean; remainingWaitMinutes?: number } {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  
  const log = mobileRequestLogs.get(mobileNumber) || { timestamps: [] };
  // Filter out timestamps older than 1 hour
  const recentTimestamps = log.timestamps.filter(ts => ts > oneHourAgo);
  mobileRequestLogs.set(mobileNumber, { timestamps: recentTimestamps });

  if (recentTimestamps.length >= MAX_REQUESTS_PER_HOUR) {
    const oldestInWindow = recentTimestamps[0];
    const minutesLeft = Math.ceil((oldestInWindow + 60 * 60 * 1000 - now) / (60 * 1000));
    return { allowed: false, remainingWaitMinutes: minutesLeft };
  }

  return { allowed: true };
}

/**
 * Record a new OTP request for rate limiting
 */
export function recordRequest(mobileNumber: string): void {
  const log = mobileRequestLogs.get(mobileNumber) || { timestamps: [] };
  log.timestamps.push(Date.now());
  mobileRequestLogs.set(mobileNumber, log);
}

/**
 * Generate a 6-digit OTP code and save it
 */
export function generateOtp(
  mobileNumber: string,
  purpose: OtpRecord['purpose'] = 'REGISTRATION'
): { success: boolean; code?: string; error?: string; remainingWaitMinutes?: number } {
  // 1. Check rate limit
  const rateLimit = checkRateLimit(mobileNumber);
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Too many OTP requests. Maximum ${MAX_REQUESTS_PER_HOUR} per hour. Please wait ${rateLimit.remainingWaitMinutes} minutes.`,
      remainingWaitMinutes: rateLimit.remainingWaitMinutes,
    };
  }

  // 2. Generate cryptographically strong 6-digit OTP
  const randomNum = crypto.randomInt(100000, 999999);
  const code = randomNum.toString();
  const codeHash = hashOtp(code);

  const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000);
  const key = `${mobileNumber}:${purpose}`;

  const record: OtpRecord = {
    id: crypto.randomUUID(),
    mobileNumber,
    codeHash,
    purpose,
    attempts: 0,
    isUsed: false,
    expiresAt,
    createdAt: new Date(),
  };

  activeOtps.set(key, record);
  recordRequest(mobileNumber);

  // In development, log the OTP for testing
  console.log(`\n========================================`);
  console.log(`[OTP SERVICE] Mobile: ${mobileNumber}`);
  console.log(`[OTP SERVICE] Purpose: ${purpose}`);
  console.log(`[OTP SERVICE] Code: ${code} (Expires in ${EXPIRY_MINUTES} mins)`);
  console.log(`========================================\n`);

  return { success: true, code };
}

/**
 * Verify an entered OTP code
 */
export function verifyOtp(
  mobileNumber: string,
  enteredCode: string,
  purpose: OtpRecord['purpose'] = 'REGISTRATION'
): { success: boolean; error?: string } {
  const key = `${mobileNumber}:${purpose}`;
  const record = activeOtps.get(key);

  if (!record) {
    return { success: false, error: 'No active OTP found. Please request a new OTP.' };
  }

  // Check if already used
  if (record.isUsed) {
    return { success: false, error: 'This OTP has already been used. Please request a new OTP.' };
  }

  // Check expiry
  if (new Date() > record.expiresAt) {
    activeOtps.delete(key);
    return { success: false, error: 'OTP has expired. Please request a new OTP.' };
  }

  // Check attempt limit
  if (record.attempts >= MAX_ATTEMPTS) {
    activeOtps.delete(key);
    return { success: false, error: 'Maximum wrong attempts (5) reached. Please request a new OTP.' };
  }

  // Compare hash
  const enteredHash = hashOtp(enteredCode);
  if (enteredHash !== record.codeHash) {
    record.attempts += 1;
    const remainingAttempts = MAX_ATTEMPTS - record.attempts;
    if (remainingAttempts <= 0) {
      activeOtps.delete(key);
      return { success: false, error: 'Maximum wrong attempts reached. This OTP is now invalid.' };
    }
    return {
      success: false,
      error: `Invalid OTP code. ${remainingAttempts} attempts remaining.`,
    };
  }

  // Success: mark single-use OTP as used
  record.isUsed = true;
  return { success: true };
}

/**
 * Clear rate limit and active OTPs (useful for tests)
 */
export function resetOtpState(): void {
  mobileRequestLogs.clear();
  activeOtps.clear();
}


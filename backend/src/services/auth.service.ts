import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma, getDatabaseStatus } from '../config/db.js';
import { deriveUsername, normalizeUsername } from '../utils/username.util.js';
import { generateOtp, verifyOtp } from './otp.service.js';

export interface StoreProfile {
  id: string;
  shopName: string;
  username: string;
  mobileNumber: string;
  language: 'EN' | 'TE';
  shopPhotoUrl: string | null;
  lowStockThreshold: number;
  dailyReminderEnabled: boolean;
  createdAt: Date;
}

export interface SessionInfo {
  id: string;
  deviceName: string;
  createdAt: Date;
  lastUsedAt: Date;
  isCurrentDevice?: boolean;
}

// In-Memory store fallback when PostgreSQL is not running locally
export interface InMemoryStore extends StoreProfile {
  passwordHash: string;
}

export interface InMemorySession {
  id: string;
  storeId: string;
  sessionToken: string;
  deviceName: string;
  ipAddress: string | null;
  isRevoked: boolean;
  createdAt: Date;
  lastUsedAt: Date;
}

export const memoryStores = new Map<string, InMemoryStore>();
export const memorySessions = new Map<string, InMemorySession>();

export class AuthService {
  /**
   * Helper to clean device name from user-agent
   */
  private static parseDeviceName(userAgent?: string): string {
    if (!userAgent) return 'Unknown Device';
    if (userAgent.includes('Tablet') || userAgent.includes('iPad')) return 'Tablet Device';
    if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
      if (userAgent.includes('Android')) return 'Android Mobile';
      if (userAgent.includes('iPhone')) return 'iPhone Mobile';
      return 'Mobile Device';
    }
    if (userAgent.includes('Windows')) return 'Windows PC';
    if (userAgent.includes('Macintosh')) return 'Mac PC';
    if (userAgent.includes('Linux')) return 'Linux PC';
    return 'Desktop Browser';
  }

  /**
   * Check if a shop name / username is available (FR-1.4)
   */
  static async checkUsernameAvailability(shopNameOrUsername: string): Promise<{
    available: boolean;
    derivedUsername: string;
    message?: string;
  }> {
    const derived = deriveUsername(shopNameOrUsername);
    if (!derived || derived.length < 3) {
      return {
        available: false,
        derivedUsername: derived,
        message: 'Shop name must generate a username of at least 3 characters.',
      };
    }

    if (getDatabaseStatus()) {
      try {
        const existing = await prisma.store.findUnique({
          where: { username: derived },
        });
        return {
          available: !existing,
          derivedUsername: derived,
          message: existing
            ? 'This shop name / user name is already taken. Please choose a different shop name.'
            : undefined,
        };
      } catch (err) {
        console.error('Prisma username check error, falling back to memory store', err);
      }
    }

    // In-memory fallback
    const existsInMemory = Array.from(memoryStores.values()).some(
      (s) => s.username === derived
    );
    return {
      available: !existsInMemory,
      derivedUsername: derived,
      message: existsInMemory
        ? 'This shop name / user name is already taken. Please choose a different shop name.'
        : undefined,
    };
  }

  /**
   * Request OTP for Registration or Password Reset (FR-1.5, FR-1.7)
   */
  static requestOtp(mobileNumber: string, purpose: 'REGISTRATION' | 'FORGOT_PASSWORD') {
    // Validate 10-digit mobile number
    const cleanedMobile = mobileNumber.replace(/\D/g, '');
    if (cleanedMobile.length !== 10) {
      return { success: false, error: 'Mobile number must be a valid 10-digit number.' };
    }
    return generateOtp(cleanedMobile, purpose);
  }

  /**
   * Register a new Store (FR-1.1 to FR-1.6)
   */
  static async registerStore(data: {
    shopName: string;
    password: string;
    mobileNumber: string;
    otpCode: string;
    language?: 'EN' | 'TE';
    userAgent?: string;
    ipAddress?: string;
  }): Promise<{ success: boolean; store?: StoreProfile; sessionToken?: string; error?: string }> {
    const { shopName, password, otpCode, language = 'TE', userAgent, ipAddress } = data;
    const mobileNumber = data.mobileNumber.replace(/\D/g, '');

    // 1. Validate inputs
    if (!shopName || shopName.trim().length === 0) {
      return { success: false, error: 'Shop name is required.' };
    }
    if (!password || password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long.' };
    }
    if (mobileNumber.length !== 10) {
      return { success: false, error: 'Mobile number must be 10 digits.' };
    }

    // 2. Verify OTP (FR-1.5)
    const otpVerification = verifyOtp(mobileNumber, otpCode, 'REGISTRATION');
    if (!otpVerification.success) {
      return { success: false, error: otpVerification.error || 'Invalid or expired OTP.' };
    }

    // 3. Derive username rule: all spaces removed, lowercase (FR-1.2, FR-1.3)
    const username = deriveUsername(shopName);

    // 4. Check uniqueness (FR-1.4)
    const availability = await this.checkUsernameAvailability(username);
    if (!availability.available) {
      return {
        success: false,
        error: availability.message || 'This shop name is already taken. Please choose a different shop name.',
      };
    }

    // 5. Hash password with bcrypt salt (FR-1.6)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const storeId = crypto.randomUUID();
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const deviceName = this.parseDeviceName(userAgent);

    if (getDatabaseStatus()) {
      try {
        // Check if mobile already exists
        const mobileExists = await prisma.store.findUnique({
          where: { mobileNumber },
        });
        if (mobileExists) {
          return { success: false, error: 'This mobile number is already registered to another store.' };
        }

        const store = await prisma.store.create({
          data: {
            id: storeId,
            shopName: shopName.trim(),
            username,
            passwordHash,
            mobileNumber,
            language: language as any,
          },
        });

        // Create initial session (FR-1.8, FR-1.9)
        await prisma.session.create({
          data: {
            storeId: store.id,
            sessionToken,
            deviceName,
            ipAddress: ipAddress || null,
          },
        });

        return {
          success: true,
          store: {
            id: store.id,
            shopName: store.shopName,
            username: store.username,
            mobileNumber: store.mobileNumber,
            language: store.language as 'EN' | 'TE',
            shopPhotoUrl: store.shopPhotoUrl,
            lowStockThreshold: Number(store.lowStockThreshold),
            dailyReminderEnabled: store.dailyReminderEnabled,
            createdAt: store.createdAt,
          },
          sessionToken,
        };
      } catch (err: any) {
        console.error('Prisma register error, falling back to memory store:', err.message);
      }
    }

    // In-memory fallback
    const mobileExistsInMemory = Array.from(memoryStores.values()).some((s) => s.mobileNumber === mobileNumber);
    if (mobileExistsInMemory) {
      return { success: false, error: 'This mobile number is already registered to another store.' };
    }

    const newStore: InMemoryStore = {
      id: storeId,
      shopName: shopName.trim(),
      username,
      passwordHash,
      mobileNumber,
      language,
      shopPhotoUrl: null,
      lowStockThreshold: 5,
      dailyReminderEnabled: true,
      createdAt: new Date(),
    };
    memoryStores.set(storeId, newStore);

    const newSession: InMemorySession = {
      id: crypto.randomUUID(),
      storeId,
      sessionToken,
      deviceName,
      ipAddress: ipAddress || null,
      isRevoked: false,
      createdAt: new Date(),
      lastUsedAt: new Date(),
    };
    memorySessions.set(sessionToken, newSession);

    const { passwordHash: _, ...profile } = newStore;
    return {
      success: true,
      store: profile,
      sessionToken,
    };
  }

  /**
   * Log In Store (FR-1.3, FR-1.8, FR-1.9)
   * User names are case-insensitive.
   */
  static async login(data: {
    username: string;
    password: string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<{ success: boolean; store?: StoreProfile; sessionToken?: string; error?: string }> {
    const { username: rawUsername, password, userAgent, ipAddress } = data;

    if (!rawUsername || !password) {
      return { success: false, error: 'Username and password are required.' };
    }

    // FR-1.3: Compare in lowercase
    const normalized = normalizeUsername(rawUsername);
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const deviceName = this.parseDeviceName(userAgent);

    if (getDatabaseStatus()) {
      try {
        const store = await prisma.store.findUnique({
          where: { username: normalized },
        });

        if (store) {
          const isPasswordValid = await bcrypt.compare(password, store.passwordHash);
          if (!isPasswordValid) {
            return { success: false, error: 'Wrong user name or password.' };
          }

          // Create new session record for this device (FR-1.9: many devices at once)
          await prisma.session.create({
            data: {
              storeId: store.id,
              sessionToken,
              deviceName,
              ipAddress: ipAddress || null,
            },
          });

          return {
            success: true,
            store: {
              id: store.id,
              shopName: store.shopName,
              username: store.username,
              mobileNumber: store.mobileNumber,
              language: store.language as 'EN' | 'TE',
              shopPhotoUrl: store.shopPhotoUrl,
              lowStockThreshold: Number(store.lowStockThreshold),
              dailyReminderEnabled: store.dailyReminderEnabled,
              createdAt: store.createdAt,
            },
            sessionToken,
          };
        }
      } catch (err: any) {
        console.error('Prisma login error, falling back to memory store:', err.message);
      }
    }

    // In-memory fallback
    const store = Array.from(memoryStores.values()).find((s) => s.username === normalized);
    if (!store) {
      return { success: false, error: 'Wrong user name or password.' };
    }

    const isPasswordValid = await bcrypt.compare(password, store.passwordHash);
    if (!isPasswordValid) {
      return { success: false, error: 'Wrong user name or password.' };
    }

    const newSession: InMemorySession = {
      id: crypto.randomUUID(),
      storeId: store.id,
      sessionToken,
      deviceName,
      ipAddress: ipAddress || null,
      isRevoked: false,
      createdAt: new Date(),
      lastUsedAt: new Date(),
    };
    memorySessions.set(sessionToken, newSession);

    const { passwordHash: _, ...profile } = store;
    return {
      success: true,
      store: profile,
      sessionToken,
    };
  }

  /**
   * Validate an active session token (FR-1.8)
   */
  static async validateSession(
    sessionToken: string
  ): Promise<{ valid: boolean; store?: StoreProfile; session?: SessionInfo }> {
    if (!sessionToken) return { valid: false };

    if (getDatabaseStatus()) {
      try {
        const session = await prisma.session.findUnique({
          where: { sessionToken },
          include: { store: true },
        });

        if (!session || session.isRevoked) {
          return { valid: false };
        }

        // Update lastUsedAt
        await prisma.session.update({
          where: { id: session.id },
          data: { lastUsedAt: new Date() },
        });

        return {
          valid: true,
          store: {
            id: session.store.id,
            shopName: session.store.shopName,
            username: session.store.username,
            mobileNumber: session.store.mobileNumber,
            language: session.store.language as 'EN' | 'TE',
            shopPhotoUrl: session.store.shopPhotoUrl,
            lowStockThreshold: Number(session.store.lowStockThreshold),
            dailyReminderEnabled: session.store.dailyReminderEnabled,
            createdAt: session.store.createdAt,
          },
          session: {
            id: session.id,
            deviceName: session.deviceName,
            createdAt: session.createdAt,
            lastUsedAt: session.lastUsedAt,
            isCurrentDevice: true,
          },
        };
      } catch (err: any) {
        console.error('Prisma validateSession error, falling back to memory store:', err.message);
      }
    }

    // In-memory fallback
    const session = memorySessions.get(sessionToken);
    if (!session || session.isRevoked) {
      return { valid: false };
    }

    session.lastUsedAt = new Date();
    const store = memoryStores.get(session.storeId);
    if (!store) return { valid: false };

    const { passwordHash: _, ...profile } = store;
    return {
      valid: true,
      store: profile,
      session: {
        id: session.id,
        deviceName: session.deviceName,
        createdAt: session.createdAt,
        lastUsedAt: session.lastUsedAt,
        isCurrentDevice: true,
      },
    };
  }

  /**
   * Logout from this device only (FR-1.8, FR-1.9)
   */
  static async logout(sessionToken: string): Promise<boolean> {
    if (!sessionToken) return true;

    if (getDatabaseStatus()) {
      try {
        await prisma.session.updateMany({
          where: { sessionToken },
          data: { isRevoked: true },
        });
        return true;
      } catch (err: any) {
        console.error('Prisma logout error:', err.message);
      }
    }

    const session = memorySessions.get(sessionToken);
    if (session) {
      session.isRevoked = true;
    }
    return true;
  }

  /**
   * Logout from all devices at once (FR-1.10)
   */
  static async logoutAll(storeId: string): Promise<boolean> {
    if (!storeId) return false;

    if (getDatabaseStatus()) {
      try {
        await prisma.session.updateMany({
          where: { storeId },
          data: { isRevoked: true },
        });
        return true;
      } catch (err: any) {
        console.error('Prisma logoutAll error:', err.message);
      }
    }

    for (const session of memorySessions.values()) {
      if (session.storeId === storeId) {
        session.isRevoked = true;
      }
    }
    return true;
  }

  /**
   * Get all active devices for the store (FR-12.7)
   */
  static async getActiveSessions(storeId: string, currentSessionToken: string): Promise<SessionInfo[]> {
    if (getDatabaseStatus()) {
      try {
        const sessions = await prisma.session.findMany({
          where: { storeId, isRevoked: false },
          orderBy: { lastUsedAt: 'desc' },
        });

        return sessions.map((s) => ({
          id: s.id,
          deviceName: s.deviceName,
          createdAt: s.createdAt,
          lastUsedAt: s.lastUsedAt,
          isCurrentDevice: s.sessionToken === currentSessionToken,
        }));
      } catch (err: any) {
        console.error('Prisma getActiveSessions error:', err.message);
      }
    }

    return Array.from(memorySessions.values())
      .filter((s) => s.storeId === storeId && !s.isRevoked)
      .sort((a, b) => b.lastUsedAt.getTime() - a.lastUsedAt.getTime())
      .map((s) => ({
        id: s.id,
        deviceName: s.deviceName,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt,
        isCurrentDevice: s.sessionToken === currentSessionToken,
      }));
  }

  /**
   * Revoke a specific device session (FR-12.7)
   */
  static async revokeSession(storeId: string, sessionId: string): Promise<boolean> {
    if (getDatabaseStatus()) {
      try {
        const result = await prisma.session.updateMany({
          where: { id: sessionId, storeId },
          data: { isRevoked: true },
        });
        return result.count > 0;
      } catch (err: any) {
        console.error('Prisma revokeSession error:', err.message);
      }
    }

    for (const session of memorySessions.values()) {
      if (session.id === sessionId && session.storeId === storeId) {
        session.isRevoked = true;
        return true;
      }
    }
    return false;
  }

  /**
   * Request OTP for Forgot Password (FR-1.7)
   */
  static async requestForgotPasswordOtp(rawUsername: string, rawMobile: string) {
    const normalizedUsername = normalizeUsername(rawUsername);
    const mobileNumber = rawMobile.replace(/\D/g, '');

    if (!normalizedUsername || mobileNumber.length !== 10) {
      return { success: false, error: 'Please enter a valid user name and 10-digit mobile number.' };
    }

    // Verify user exists and matches mobile number
    let storeExists = false;

    if (getDatabaseStatus()) {
      try {
        const store = await prisma.store.findFirst({
          where: {
            username: normalizedUsername,
            mobileNumber,
          },
        });
        if (store) storeExists = true;
      } catch (err: any) {
        console.error('Prisma forgot password check error:', err.message);
      }
    }

    if (!storeExists) {
      storeExists = Array.from(memoryStores.values()).some(
        (s) => s.username === normalizedUsername && s.mobileNumber === mobileNumber
      );
    }

    if (!storeExists) {
      return {
        success: false,
        error: 'No account found matching this user name and mobile number.',
      };
    }

    return generateOtp(mobileNumber, 'FORGOT_PASSWORD');
  }

  /**
   * Reset Password with verified OTP (FR-1.7, FR-1.10)
   */
  static async resetPasswordWithOtp(data: {
    username: string;
    mobileNumber: string;
    otpCode: string;
    newPassword: string;
    logoutAllDevices?: boolean;
  }): Promise<{ success: boolean; error?: string }> {
    const { username: rawUsername, otpCode, newPassword, logoutAllDevices = true } = data;
    const mobileNumber = data.mobileNumber.replace(/\D/g, '');
    const normalizedUsername = normalizeUsername(rawUsername);

    if (newPassword.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long.' };
    }

    // Verify OTP (10 mins, single use, max 5 attempts)
    const otpVerification = verifyOtp(mobileNumber, otpCode, 'FORGOT_PASSWORD');
    if (!otpVerification.success) {
      return { success: false, error: otpVerification.error || 'Invalid or expired OTP.' };
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    if (getDatabaseStatus()) {
      try {
        const store = await prisma.store.findFirst({
          where: { username: normalizedUsername, mobileNumber },
        });

        if (store) {
          await prisma.store.update({
            where: { id: store.id },
            data: { passwordHash },
          });

          if (logoutAllDevices) {
            await this.logoutAll(store.id);
          }

          return { success: true };
        }
      } catch (err: any) {
        console.error('Prisma resetPassword error, falling back to memory store:', err.message);
      }
    }

    // In-memory fallback
    const store = Array.from(memoryStores.values()).find(
      (s) => s.username === normalizedUsername && s.mobileNumber === mobileNumber
    );

    if (!store) {
      return { success: false, error: 'Account not found.' };
    }

    store.passwordHash = passwordHash;
    if (logoutAllDevices) {
      await this.logoutAll(store.id);
    }

    return { success: true };
  }

  /**
   * Helper to reset memory store for unit testing
   */
  static resetMemoryState() {
    memoryStores.clear();
    memorySessions.clear();
  }
}

import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service.js';
import { AuthenticatedRequest, SESSION_COOKIE_NAME } from '../middlewares/auth.middleware.js';

const isProd = process.env.NODE_ENV === 'production';
// Cookie configuration for long-lived multi-device session (FR-1.8)
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 10 * 365 * 24 * 60 * 60 * 1000, // 10 years (never expires until logout)
  path: '/',
};

export class AuthController {
  /**
   * Check if shop name / username is available
   */
  static async checkUsername(req: Request, res: Response): Promise<void> {
    const { shopName } = req.body;
    if (!shopName) {
      res.status(400).json({ success: false, error: 'Shop name is required.' });
      return;
    }

    const result = await AuthService.checkUsernameAvailability(shopName);
    res.json({
      success: true,
      available: result.available,
      derivedUsername: result.derivedUsername,
      message: result.message,
    });
  }

  /**
   * Request OTP for Registration or Password Reset
   */
  static async sendOtp(req: Request, res: Response): Promise<void> {
    const { mobileNumber, purpose } = req.body;
    if (!mobileNumber) {
      res.status(400).json({ success: false, error: 'Mobile number is required.' });
      return;
    }

    const result = AuthService.requestOtp(mobileNumber, purpose || 'REGISTRATION');
    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    // In development mode, return code in response to ease testing
    res.json({
      success: true,
      message: `OTP sent to +91 ${mobileNumber.slice(-10)}`,
      devCode: process.env.NODE_ENV !== 'production' ? result.code : undefined,
    });
  }

  /**
   * Register new store
   */
  static async register(req: Request, res: Response): Promise<void> {
    const { shopName, password, mobileNumber, otpCode, language } = req.body;
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket.remoteAddress;

    const result = await AuthService.registerStore({
      shopName,
      password,
      mobileNumber,
      otpCode,
      language,
      userAgent,
      ipAddress,
    });

    if (!result.success || !result.sessionToken) {
      res.status(400).json(result);
      return;
    }

    // Set permanent session cookie
    res.cookie(SESSION_COOKIE_NAME, result.sessionToken, COOKIE_OPTIONS);
    res.status(201).json({
      success: true,
      store: result.store,
      sessionToken: result.sessionToken,
    });
  }

  /**
   * Login to store (case-insensitive username)
   */
  static async login(req: Request, res: Response): Promise<void> {
    const { username, password } = req.body;
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket.remoteAddress;

    const result = await AuthService.login({
      username,
      password,
      userAgent,
      ipAddress,
    });

    if (!result.success || !result.sessionToken) {
      res.status(401).json(result);
      return;
    }

    // Set permanent session cookie
    res.cookie(SESSION_COOKIE_NAME, result.sessionToken, COOKIE_OPTIONS);
    res.json({
      success: true,
      store: result.store,
      sessionToken: result.sessionToken,
    });
  }

  /**
   * Get current authenticated store and device session info
   */
  static async getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
    res.json({
      success: true,
      store: req.store,
      session: req.sessionInfo,
    });
  }

  /**
   * Logout from this device
   */
  static async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    const token = req.sessionToken || req.cookies?.[SESSION_COOKIE_NAME];
    if (token) {
      await AuthService.logout(token);
    }
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.json({ success: true, message: 'Logged out successfully from this device.' });
  }

  /**
   * Logout from all devices (FR-1.10)
   */
  static async logoutAll(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (req.store?.id) {
      await AuthService.logoutAll(req.store.id);
    }
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.json({ success: true, message: 'Logged out successfully from all devices.' });
  }

  /**
   * Get list of active logged-in devices
   */
  static async getDevices(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.store?.id) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const token = req.sessionToken || req.cookies?.[SESSION_COOKIE_NAME];
    const sessions = await AuthService.getActiveSessions(req.store.id, token || '');
    res.json({ success: true, devices: sessions });
  }

  /**
   * Revoke a specific device session
   */
  static async revokeDevice(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { sessionId } = req.params;
    if (!req.store?.id || !sessionId) {
      res.status(400).json({ success: false, error: 'Session ID is required.' });
      return;
    }

    const success = await AuthService.revokeSession(req.store.id, sessionId);
    if (!success) {
      res.status(404).json({ success: false, error: 'Session not found or already revoked.' });
      return;
    }

    res.json({ success: true, message: 'Device disconnected successfully.' });
  }

  /**
   * Request OTP for forgot password
   */
  static async forgotPasswordRequest(req: Request, res: Response): Promise<void> {
    const { username, mobileNumber } = req.body;
    if (!username || !mobileNumber) {
      res.status(400).json({ success: false, error: 'User name and mobile number are required.' });
      return;
    }

    const result = await AuthService.requestForgotPasswordOtp(username, mobileNumber);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json({
      success: true,
      message: `Password reset OTP sent to +91 ${mobileNumber.slice(-10)}`,
      devCode: process.env.NODE_ENV !== 'production' ? result.code : undefined,
    });
  }

  /**
   * Reset password with OTP
   */
  static async resetPassword(req: Request, res: Response): Promise<void> {
    const { username, mobileNumber, otpCode, newPassword, logoutAllDevices } = req.body;
    const result = await AuthService.resetPasswordWithOtp({
      username,
      mobileNumber,
      otpCode,
      newPassword,
      logoutAllDevices: logoutAllDevices ?? true,
    });

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json({
      success: true,
      message: 'Password has been reset successfully. Please log in with your new password.',
    });
  }
}


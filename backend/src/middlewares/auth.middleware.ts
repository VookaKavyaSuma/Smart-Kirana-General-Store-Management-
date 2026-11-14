import { Request, Response, NextFunction } from 'express';
import { AuthService, StoreProfile, SessionInfo } from '../services/auth.service.js';

export interface AuthenticatedRequest extends Request {
  store?: StoreProfile;
  sessionInfo?: SessionInfo;
  sessionToken?: string;
}

export const SESSION_COOKIE_NAME = 'kirana_session';

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Check HTTP-only cookie first, then Authorization Bearer header
    let token = req.cookies?.[SESSION_COOKIE_NAME];
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Authentication required. No active session found.',
      });
      return;
    }

    // 2. Validate against database/session store
    const sessionCheck = await AuthService.validateSession(token);
    if (!sessionCheck.valid || !sessionCheck.store) {
      res.clearCookie(SESSION_COOKIE_NAME);
      res.status(401).json({
        success: false,
        error: 'Session has ended or been revoked. Please log in again.',
      });
      return;
    }

    // 3. Attach authenticated store and session to request
    req.store = sessionCheck.store;
    req.sessionInfo = sessionCheck.session;
    req.sessionToken = token;
    next();
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Authentication check failed: ' + error.message,
    });
  }
}


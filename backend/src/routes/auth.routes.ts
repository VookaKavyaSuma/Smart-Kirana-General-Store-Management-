import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

export const authRouter = Router();

// Public auth endpoints
authRouter.post('/check-username', AuthController.checkUsername);
authRouter.post('/send-otp', AuthController.sendOtp);
authRouter.post('/register', AuthController.register);
authRouter.post('/login', AuthController.login);
authRouter.post('/forgot-password/request', AuthController.forgotPasswordRequest);
authRouter.post('/forgot-password/reset', AuthController.resetPassword);

// Protected endpoints (require active session)
authRouter.get('/me', requireAuth, AuthController.getMe);
authRouter.post('/logout', requireAuth, AuthController.logout);
authRouter.post('/logout-all', requireAuth, AuthController.logoutAll);
authRouter.get('/devices', requireAuth, AuthController.getDevices);
authRouter.delete('/devices/:sessionId', requireAuth, AuthController.revokeDevice);


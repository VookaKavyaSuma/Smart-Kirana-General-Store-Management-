import { Router } from 'express';
import { SettingsController } from '../controllers/settings.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { uploadImageMiddleware } from '../middlewares/upload.middleware.js';

export const settingsRouter = Router();

// All settings routes require authentication
settingsRouter.use(requireAuth);

// Profile & Shop Photo (FR-12.2, FR-12.3)
settingsRouter.get('/profile', SettingsController.getProfile);
settingsRouter.post('/photo', uploadImageMiddleware.single('photo'), SettingsController.uploadPhoto);
settingsRouter.delete('/photo', SettingsController.removePhoto);

// Change Password (FR-12.4, FR-1.10)
settingsRouter.post('/change-password', SettingsController.changePassword);

// Preferences: Language, Low Stock Limit, Daily Online Reminder (FR-12.8)
settingsRouter.put('/preferences', SettingsController.updatePreferences);

// Change Mobile Number with OTP (FR-12.9)
settingsRouter.post('/change-mobile/request-otp', SettingsController.requestChangeMobileOtp);
settingsRouter.post('/change-mobile/verify-otp', SettingsController.verifyChangeMobileOtp);

// Export All Data to CSV (FR-12.10)
settingsRouter.get('/export-csv', SettingsController.exportCsv);

// Account Deletion with Password & OTP (FR-12.10)
settingsRouter.post('/delete-account/request-otp', SettingsController.requestDeleteAccountOtp);
settingsRouter.post('/delete-account/confirm', SettingsController.confirmDeleteAccount);

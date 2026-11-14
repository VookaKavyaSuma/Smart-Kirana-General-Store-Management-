import { Response } from 'express';
import { SettingsService } from '../services/settings.service.js';
import { storageService } from '../services/storage.service.js';
import { AuthenticatedRequest, SESSION_COOKIE_NAME } from '../middlewares/auth.middleware.js';

export class SettingsController {
  /**
   * Get store profile (FR-12.2)
   */
  static async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const profile = await SettingsService.getProfile(storeId);
    if (!profile) {
      res.status(404).json({ success: false, error: 'Store not found' });
      return;
    }

    res.json({ success: true, store: profile });
  }

  /**
   * Upload or change shop photo (FR-12.3)
   */
  static async uploadPhoto(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    try {
      let photoUrl = req.body?.photoUrl;

      // If file was uploaded via multipart/form-data
      if (req.file) {
        const uploadResult = await storageService.uploadFile(req.file, 'shops');
        photoUrl = uploadResult.url;
      }

      if (!photoUrl) {
        res.status(400).json({ success: false, error: 'No image file or photo URL provided.' });
        return;
      }

      const updated = await SettingsService.updateShopPhoto(storeId, photoUrl);
      if (!updated) {
        res.status(400).json({ success: false, error: 'Failed to update shop photo.' });
        return;
      }

      res.json({
        success: true,
        message: 'Shop photo updated successfully.',
        photoUrl,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to upload photo.' });
    }
  }

  /**
   * Remove shop photo (FR-12.3)
   */
  static async removePhoto(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const updated = await SettingsService.updateShopPhoto(storeId, null);
    if (!updated) {
      res.status(400).json({ success: false, error: 'Failed to remove shop photo.' });
      return;
    }

    res.json({ success: true, message: 'Shop photo removed successfully.', photoUrl: null });
  }

  /**
   * Change password (FR-12.4, FR-1.10)
   */
  static async changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { currentPassword, newPassword, confirmPassword, logoutAllDevices = false } = req.body;

    if (!newPassword || newPassword.length < 8) {
      res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters long.',
      });
      return;
    }

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      res.status(400).json({
        success: false,
        error: 'New passwords do not match.',
      });
      return;
    }

    const result = await SettingsService.changePassword(
      storeId,
      currentPassword,
      newPassword,
      logoutAllDevices
    );

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    if (logoutAllDevices) {
      res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    }

    res.json({
      success: true,
      message: 'Password changed successfully.',
      loggedOutAll: logoutAllDevices,
    });
  }

  /**
   * Update preferences (Language, low stock threshold, reminder) (FR-12.8)
   */
  static async updatePreferences(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { language, lowStockThreshold, dailyReminderEnabled } = req.body;
    const result = await SettingsService.updatePreferences(storeId, {
      language,
      lowStockThreshold,
      dailyReminderEnabled,
    });

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json({
      success: true,
      message: 'Preferences updated successfully.',
      store: result.store,
    });
  }

  /**
   * Request OTP to change mobile number (FR-12.9)
   */
  static async requestChangeMobileOtp(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { newMobileNumber } = req.body;
    if (!newMobileNumber) {
      res.status(400).json({ success: false, error: 'New mobile number is required.' });
      return;
    }

    const result = await SettingsService.requestChangeMobileOtp(storeId, newMobileNumber);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json({
      success: true,
      message: `OTP sent to new mobile number +91 ${newMobileNumber.slice(-10)}`,
      devCode: process.env.NODE_ENV !== 'production' ? result.code : undefined,
    });
  }

  /**
   * Verify OTP and finalize mobile number change (FR-12.9)
   */
  static async verifyChangeMobileOtp(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { newMobileNumber, otpCode } = req.body;
    if (!newMobileNumber || !otpCode) {
      res.status(400).json({ success: false, error: 'New mobile number and OTP code are required.' });
      return;
    }

    const result = await SettingsService.verifyChangeMobileOtp(storeId, newMobileNumber, otpCode);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json({
      success: true,
      message: 'Mobile number updated successfully.',
      newMobileNumber: result.newMobileNumber,
    });
  }

  /**
   * Export all data to CSV (FR-12.10)
   */
  static async exportCsv(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    try {
      const csvData = await SettingsService.exportAllDataCsv(storeId);
      const filename = `smart-kirana-${req.store?.username || 'store'}-${new Date().toISOString().slice(0, 10)}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csvData);
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'Failed to export CSV: ' + err.message });
    }
  }

  /**
   * Request OTP for account deletion (FR-12.10)
   */
  static async requestDeleteAccountOtp(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { password } = req.body;
    if (!password) {
      res.status(400).json({ success: false, error: 'Current password is required to initiate account deletion.' });
      return;
    }

    const result = await SettingsService.requestDeleteAccountOtp(storeId, password);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json({
      success: true,
      message: `Account deletion OTP sent to registered mobile number`,
      devCode: process.env.NODE_ENV !== 'production' ? result.code : undefined,
    });
  }

  /**
   * Confirm account deletion (FR-12.10)
   */
  static async confirmDeleteAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { password, otpCode } = req.body;
    if (!password || !otpCode) {
      res.status(400).json({ success: false, error: 'Password and OTP code are required.' });
      return;
    }

    const result = await SettingsService.confirmDeleteAccount(storeId, password, otpCode);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.json({
      success: true,
      message: 'Store account and all associated data deleted permanently.',
    });
  }
}

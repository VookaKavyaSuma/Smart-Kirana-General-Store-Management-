import bcrypt from 'bcryptjs';
import { prisma, getDatabaseStatus } from '../config/db.js';
import { AuthService, memoryStores, memorySessions, StoreProfile } from './auth.service.js';
import { generateOtp, verifyOtp } from './otp.service.js';

export class SettingsService {
  /**
   * Get store profile information (FR-12.2)
   */
  static async getProfile(storeId: string): Promise<StoreProfile | null> {
    if (getDatabaseStatus()) {
      try {
        const store = await prisma.store.findUnique({
          where: { id: storeId },
        });
        if (!store) return null;
        return {
          id: store.id,
          shopName: store.shopName,
          username: store.username,
          mobileNumber: store.mobileNumber,
          language: store.language as 'EN' | 'TE',
          shopPhotoUrl: store.shopPhotoUrl,
          lowStockThreshold: Number(store.lowStockThreshold),
          dailyReminderEnabled: store.dailyReminderEnabled,
          createdAt: store.createdAt,
        };
      } catch (err: any) {
        console.error('Prisma getProfile error:', err.message);
      }
    }

    const mem = memoryStores.get(storeId);
    if (!mem) return null;
    const { passwordHash: _, ...profile } = mem;
    return profile;
  }

  /**
   * Upload or update shop photo (FR-12.3)
   */
  static async updateShopPhoto(storeId: string, photoUrl: string | null): Promise<boolean> {
    if (getDatabaseStatus()) {
      try {
        await prisma.store.update({
          where: { id: storeId },
          data: { shopPhotoUrl: photoUrl },
        });
        return true;
      } catch (err: any) {
        console.error('Prisma updateShopPhoto error:', err.message);
      }
    }

    const mem = memoryStores.get(storeId);
    if (mem) {
      mem.shopPhotoUrl = photoUrl;
      return true;
    }
    return false;
  }

  /**
   * Change store password (FR-12.4, FR-1.10)
   */
  static async changePassword(
    storeId: string,
    currentPassword: string,
    newPassword: string,
    logoutAllDevices: boolean = false
  ): Promise<{ success: boolean; error?: string }> {
    if (!currentPassword || !newPassword) {
      return { success: false, error: 'Current password and new password are required.' };
    }

    if (newPassword.length < 8) {
      return { success: false, error: 'New password must be at least 8 characters long.' };
    }

    let currentHash = '';
    if (getDatabaseStatus()) {
      try {
        const store = await prisma.store.findUnique({
          where: { id: storeId },
        });
        if (!store) return { success: false, error: 'Store not found.' };
        currentHash = store.passwordHash;
      } catch (err: any) {
        console.error('Prisma changePassword error:', err.message);
      }
    } else {
      const mem = memoryStores.get(storeId);
      if (!mem) return { success: false, error: 'Store not found.' };
      currentHash = mem.passwordHash;
    }

    const isMatch = await bcrypt.compare(currentPassword, currentHash);
    if (!isMatch) {
      return { success: false, error: 'Current password does not match.' };
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    if (getDatabaseStatus()) {
      try {
        await prisma.store.update({
          where: { id: storeId },
          data: { passwordHash: newHash },
        });

        if (logoutAllDevices) {
          await AuthService.logoutAll(storeId);
        }

        return { success: true };
      } catch (err: any) {
        console.error('Prisma update password error:', err.message);
      }
    }

    const mem = memoryStores.get(storeId);
    if (mem) {
      mem.passwordHash = newHash;
    }
    if (logoutAllDevices) {
      await AuthService.logoutAll(storeId);
    }

    return { success: true };
  }

  /**
   * Update store preferences (Language, low stock threshold, reminder) (FR-12.8)
   */
  static async updatePreferences(
    storeId: string,
    data: {
      language?: 'EN' | 'TE';
      lowStockThreshold?: number;
      dailyReminderEnabled?: boolean;
    }
  ): Promise<{ success: boolean; store?: StoreProfile; error?: string }> {
    const updateData: any = {};
    if (data.language) {
      if (data.language !== 'EN' && data.language !== 'TE') {
        return { success: false, error: 'Language must be EN or TE.' };
      }
      updateData.language = data.language;
    }

    if (data.lowStockThreshold !== undefined) {
      const threshold = Number(data.lowStockThreshold);
      if (isNaN(threshold) || threshold < 0) {
        return { success: false, error: 'Low stock limit must be a positive number.' };
      }
      updateData.lowStockThreshold = threshold;
    }

    if (data.dailyReminderEnabled !== undefined) {
      updateData.dailyReminderEnabled = Boolean(data.dailyReminderEnabled);
    }

    if (getDatabaseStatus()) {
      try {
        const updated = await prisma.store.update({
          where: { id: storeId },
          data: updateData,
        });

        return {
          success: true,
          store: {
            id: updated.id,
            shopName: updated.shopName,
            username: updated.username,
            mobileNumber: updated.mobileNumber,
            language: updated.language as 'EN' | 'TE',
            shopPhotoUrl: updated.shopPhotoUrl,
            lowStockThreshold: Number(updated.lowStockThreshold),
            dailyReminderEnabled: updated.dailyReminderEnabled,
            createdAt: updated.createdAt,
          },
        };
      } catch (err: any) {
        console.error('Prisma updatePreferences error:', err.message);
      }
    }

    const mem = memoryStores.get(storeId);
    if (mem) {
      if (updateData.language) mem.language = updateData.language;
      if (updateData.lowStockThreshold !== undefined) mem.lowStockThreshold = updateData.lowStockThreshold;
      if (updateData.dailyReminderEnabled !== undefined) mem.dailyReminderEnabled = updateData.dailyReminderEnabled;

      const { passwordHash: _, ...profile } = mem;
      return { success: true, store: profile };
    }

    return { success: false, error: 'Store not found.' };
  }

  /**
   * Request OTP to change mobile number (FR-12.9)
   */
  static async requestChangeMobileOtp(
    storeId: string,
    rawNewMobile: string
  ): Promise<{ success: boolean; code?: string; error?: string }> {
    const newMobile = rawNewMobile.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(newMobile)) {
      return { success: false, error: 'Please enter a valid 10-digit Indian mobile number.' };
    }

    // Check if current mobile is identical
    const current = await this.getProfile(storeId);
    if (current && current.mobileNumber === newMobile) {
      return { success: false, error: 'The new mobile number is the same as the current number.' };
    }

    // Check if another store already uses this number
    if (getDatabaseStatus()) {
      try {
        const existing = await prisma.store.findFirst({
          where: { mobileNumber: newMobile, NOT: { id: storeId } },
        });
        if (existing) {
          return { success: false, error: 'This mobile number is already registered to another store.' };
        }
      } catch (err: any) {
        console.error('Prisma mobile check error:', err.message);
      }
    } else {
      const exists = Array.from(memoryStores.values()).some(
        (s) => s.id !== storeId && s.mobileNumber === newMobile
      );
      if (exists) {
        return { success: false, error: 'This mobile number is already registered to another store.' };
      }
    }

    return generateOtp(newMobile, 'CHANGE_MOBILE');
  }

  /**
   * Verify OTP and update mobile number (FR-12.9)
   */
  static async verifyChangeMobileOtp(
    storeId: string,
    rawNewMobile: string,
    otpCode: string
  ): Promise<{ success: boolean; newMobileNumber?: string; error?: string }> {
    const newMobile = rawNewMobile.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(newMobile)) {
      return { success: false, error: 'Invalid 10-digit mobile number.' };
    }

    const verify = verifyOtp(newMobile, otpCode, 'CHANGE_MOBILE');
    if (!verify.success) {
      return { success: false, error: verify.error || 'Invalid or expired OTP.' };
    }

    if (getDatabaseStatus()) {
      try {
        await prisma.store.update({
          where: { id: storeId },
          data: { mobileNumber: newMobile },
        });
        return { success: true, newMobileNumber: newMobile };
      } catch (err: any) {
        console.error('Prisma update mobile error:', err.message);
      }
    }

    const mem = memoryStores.get(storeId);
    if (mem) {
      mem.mobileNumber = newMobile;
      return { success: true, newMobileNumber: newMobile };
    }

    return { success: false, error: 'Store not found.' };
  }

  /**
   * Export all store data to CSV (FR-12.10)
   */
  static async exportAllDataCsv(storeId: string): Promise<string> {
    const profile = await this.getProfile(storeId);

    let items: any[] = [];
    let suppliers: any[] = [];
    let purchases: any[] = [];
    let bills: any[] = [];

    if (getDatabaseStatus()) {
      try {
        items = await prisma.item.findMany({
          where: { storeId },
          include: { supplier: true },
          orderBy: { name: 'asc' },
        });

        suppliers = await prisma.supplier.findMany({
          where: { storeId },
          include: {
            _count: { select: { items: true, purchases: true } },
          },
          orderBy: { shopName: 'asc' },
        });

        purchases = await prisma.purchase.findMany({
          where: { storeId },
          include: { supplier: true, items: true },
          orderBy: { purchaseDate: 'desc' },
        });

        bills = await prisma.billFile.findMany({
          where: { storeId },
          orderBy: { billDate: 'desc' },
        });
      } catch (err: any) {
        console.error('Prisma export data error:', err.message);
      }
    }

    // Escape CSV cell helper
    const esc = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const lines: string[] = [];

    // Header & Store Info
    lines.push('=== SMART KIRANA STORE DATA EXPORT ===');
    lines.push(`Exported At,${esc(new Date().toISOString())}`);
    lines.push(`Shop Name,${esc(profile?.shopName || '')}`);
    lines.push(`Username,${esc(profile?.username || '')}`);
    lines.push(`Mobile Number,${esc(profile?.mobileNumber || '')}`);
    lines.push(`Language,${esc(profile?.language || 'TE')}`);
    lines.push(`Account Created,${esc(profile?.createdAt?.toISOString() || '')}`);
    lines.push('');

    // Section 1: Items Inventory
    lines.push('=== INVENTORY ITEMS ===');
    lines.push(
      'Item ID,Item Name,Category,Unit,Cost Price (₹),Selling Price (₹),Purchased Quantity,Remaining Quantity,Low Stock Marker,Supplier'
    );
    for (const it of items) {
      const isLow = Number(it.quantityRemaining) <= Number(profile?.lowStockThreshold || 5);
      lines.push(
        [
          esc(it.id),
          esc(it.name),
          esc(it.category),
          esc(it.unit),
          esc(Number(it.currentCostPrice).toFixed(2)),
          esc(Number(it.currentSellingPrice).toFixed(2)),
          esc(Number(it.quantityPurchased).toFixed(2)),
          esc(Number(it.quantityRemaining).toFixed(2)),
          esc(isLow ? 'YES' : 'NO'),
          esc(it.supplier?.shopName || 'No supplier'),
        ].join(',')
      );
    }
    lines.push('');

    // Section 2: Suppliers
    lines.push('=== SUPPLIERS ===');
    lines.push('Supplier ID,Supplier Shop Name,Items Count,Purchases Count');
    for (const sup of suppliers) {
      lines.push(
        [
          esc(sup.id),
          esc(sup.shopName),
          esc(sup._count?.items || 0),
          esc(sup._count?.purchases || 0),
        ].join(',')
      );
    }
    lines.push('');

    // Section 3: Purchases
    lines.push('=== PURCHASES ===');
    lines.push('Purchase ID,Purchase Date,Supplier,Type,Total Amount (₹),Items Count');
    for (const p of purchases) {
      lines.push(
        [
          esc(p.id),
          esc(new Date(p.purchaseDate).toISOString().slice(0, 10)),
          esc(p.supplier?.shopName || 'No supplier'),
          esc(p.type),
          esc(Number(p.totalAmount || 0).toFixed(2)),
          esc(p.items?.length || 0),
        ].join(',')
      );
    }
    lines.push('');

    // Section 4: Bills
    lines.push('=== BILLS & INVOICES ===');
    lines.push('Bill ID,Bill Number,Bill Date,Supplier,Type,Total (₹),Status');
    for (const b of bills) {
      lines.push(
        [
          esc(b.id),
          esc(b.billNumber || 'N/A'),
          esc(b.billDate ? new Date(b.billDate).toISOString().slice(0, 10) : 'N/A'),
          esc(b.supplier?.shopName || 'No supplier'),
          esc(b.type),
          esc(b.totalAmount != null ? Number(b.totalAmount).toFixed(2) : '0.00'),
          esc(b.status),
        ].join(',')
      );
    }

    return lines.join('\n');
  }

  /**
   * Request OTP to delete account (FR-12.10)
   */
  static async requestDeleteAccountOtp(
    storeId: string,
    password: string
  ): Promise<{ success: boolean; code?: string; error?: string }> {
    if (!password) {
      return { success: false, error: 'Password is required to request account deletion.' };
    }

    let passwordHash = '';
    let mobileNumber = '';

    if (getDatabaseStatus()) {
      try {
        const store = await prisma.store.findUnique({
          where: { id: storeId },
        });
        if (!store) return { success: false, error: 'Store not found.' };
        passwordHash = store.passwordHash;
        mobileNumber = store.mobileNumber;
      } catch (err: any) {
        console.error('Prisma requestDeleteAccountOtp error:', err.message);
      }
    } else {
      const mem = memoryStores.get(storeId);
      if (!mem) return { success: false, error: 'Store not found.' };
      passwordHash = mem.passwordHash;
      mobileNumber = mem.mobileNumber;
    }

    const isMatch = await bcrypt.compare(password, passwordHash);
    if (!isMatch) {
      return { success: false, error: 'Incorrect password.' };
    }

    return generateOtp(mobileNumber, 'DELETE_ACCOUNT');
  }

  /**
   * Confirm account deletion after password and OTP (FR-12.10)
   */
  static async confirmDeleteAccount(
    storeId: string,
    password: string,
    otpCode: string
  ): Promise<{ success: boolean; error?: string }> {
    let passwordHash = '';
    let mobileNumber = '';

    if (getDatabaseStatus()) {
      try {
        const store = await prisma.store.findUnique({
          where: { id: storeId },
        });
        if (!store) return { success: false, error: 'Store not found.' };
        passwordHash = store.passwordHash;
        mobileNumber = store.mobileNumber;
      } catch (err: any) {
        console.error('Prisma confirmDeleteAccount check error:', err.message);
      }
    } else {
      const mem = memoryStores.get(storeId);
      if (!mem) return { success: false, error: 'Store not found.' };
      passwordHash = mem.passwordHash;
      mobileNumber = mem.mobileNumber;
    }

    const isMatch = await bcrypt.compare(password, passwordHash);
    if (!isMatch) {
      return { success: false, error: 'Incorrect password.' };
    }

    const verify = verifyOtp(mobileNumber, otpCode, 'DELETE_ACCOUNT');
    if (!verify.success) {
      return { success: false, error: verify.error || 'Invalid or expired OTP.' };
    }

    if (getDatabaseStatus()) {
      try {
        // Cascade delete on Store
        await prisma.store.delete({
          where: { id: storeId },
        });
      } catch (err: any) {
        console.error('Prisma store deletion error:', err.message);
      }
    }

    // Clean memory
    memoryStores.delete(storeId);
    for (const [token, session] of memorySessions.entries()) {
      if (session.storeId === storeId) {
        memorySessions.delete(token);
      }
    }

    return { success: true };
  }
}


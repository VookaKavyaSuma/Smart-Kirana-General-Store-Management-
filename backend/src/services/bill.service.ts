import crypto from 'crypto';
import path from 'path';
import { prisma, getDatabaseStatus } from '../config/db.js';
import { storageService } from './storage.service.js';

export interface BillRecord {
  id: string;
  storeId: string;
  purchaseId?: string | null;
  filePath: string;
  fileName: string;
  fileType: string; // 'pdf' | 'jpg' | 'png'
  billType: 'SHOP' | 'ONLINE';
  billNumber: string | null;
  billDate: Date;
  supplierName: string | null;
  totalAmount: number | null;
  status: 'PENDING_REVIEW' | 'CONFIRMED' | 'FAILED';
  createdAt: Date;
  updatedAt: Date;
}

// In-Memory store fallback
const memoryBills = new Map<string, BillRecord>();

export class BillService {
  /**
   * Upload supplier bill or online purchase document (FR-6.1, FR-6.2, FR-6.3)
   */
  static async uploadBill(
    storeId: string,
    file: Express.Multer.File,
    metadata: {
      billType?: 'SHOP' | 'ONLINE';
      billNumber?: string | null;
      billDate?: string | Date;
      supplierName?: string | null;
      totalAmount?: number | null;
      purchaseId?: string | null;
    }
  ): Promise<{ success: boolean; bill?: any; error?: string }> {
    try {
      const uploadRes = await storageService.uploadPrivateFile(file, 'bills');

      const fileExt = path.extname(uploadRes.fileName).replace('.', '').toLowerCase();
      const finalDate = metadata.billDate ? new Date(metadata.billDate) : new Date();
      const billId = crypto.randomUUID();
      const amount = metadata.totalAmount != null ? Number(Number(metadata.totalAmount).toFixed(2)) : null;

      if (getDatabaseStatus()) {
        try {
          const dbBill = await prisma.billFile.create({
            data: {
              id: billId,
              storeId,
              filePath: uploadRes.filePath,
              fileType: fileExt,
              billType: (metadata.billType as any) || 'SHOP',
              billNumber: metadata.billNumber?.trim() || null,
              billDate: finalDate,
              supplierName: metadata.supplierName?.trim() || null,
              totalAmount: amount,
            },
          });

          const signed = storageService.generateSignedToken(dbBill.id, storeId, 30);

          return {
            success: true,
            bill: {
              id: dbBill.id,
              storeId: dbBill.storeId,
              purchaseId: null,
              fileType: dbBill.fileType,
              fileName: uploadRes.fileName,
              fileSize: uploadRes.fileSize,
              billType: dbBill.billType,
              billNumber: dbBill.billNumber,
              billDate: dbBill.billDate,
              supplierName: dbBill.supplierName || 'No supplier',
              totalAmount: dbBill.totalAmount ? Number(dbBill.totalAmount) : null,
              status: dbBill.status,
              signedUrl: signed.signedUrl,
              expiresAt: signed.expiresAt,
              createdAt: dbBill.createdAt,
            },
          };
        } catch (err: any) {
          console.error('Prisma uploadBill error, falling back to memory:', err.message);
        }
      }

      // In-memory fallback
      const memRecord: BillRecord = {
        id: billId,
        storeId,
        purchaseId: metadata.purchaseId || null,
        filePath: uploadRes.filePath,
        fileName: uploadRes.fileName,
        fileType: fileExt,
        billType: metadata.billType || 'SHOP',
        billNumber: metadata.billNumber?.trim() || null,
        billDate: finalDate,
        supplierName: metadata.supplierName?.trim() || 'No supplier',
        totalAmount: amount,
        status: 'PENDING_REVIEW',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryBills.set(billId, memRecord);

      const signed = storageService.generateSignedToken(billId, storeId, 30);

      return {
        success: true,
        bill: {
          ...memRecord,
          signedUrl: signed.signedUrl,
          expiresAt: signed.expiresAt,
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Bill upload failed' };
    }
  }

  /**
   * List bills with filters (supplier, date, bill number, billType) (FR-6.10)
   */
  static async listBills(
    storeId: string,
    filters: {
      supplierName?: string;
      billType?: 'SHOP' | 'ONLINE';
      dateFrom?: string;
      dateTo?: string;
      billNumber?: string;
    } = {}
  ): Promise<any[]> {
    let bills: any[] = [];

    if (getDatabaseStatus()) {
      try {
        const whereClause: any = { storeId };
        if (filters.billType) {
          whereClause.billType = filters.billType;
        }
        if (filters.supplierName) {
          whereClause.supplierName = { contains: filters.supplierName, mode: 'insensitive' };
        }
        if (filters.billNumber) {
          whereClause.billNumber = { contains: filters.billNumber, mode: 'insensitive' };
        }
        if (filters.dateFrom || filters.dateTo) {
          whereClause.billDate = {};
          if (filters.dateFrom) whereClause.billDate.gte = new Date(filters.dateFrom);
          if (filters.dateTo) whereClause.billDate.lte = new Date(filters.dateTo);
        }

        const dbBills = await prisma.billFile.findMany({
          where: whereClause,
          orderBy: { billDate: 'desc' },
        });

        bills = dbBills.map((b) => ({
          id: b.id,
          storeId: b.storeId,
          fileType: b.fileType,
          filePath: b.filePath,
          fileName: path.basename(b.filePath),
          billType: b.billType,
          billNumber: b.billNumber,
          billDate: b.billDate,
          supplierName: b.supplierName || 'No supplier',
          totalAmount: b.totalAmount ? Number(b.totalAmount) : null,
          status: b.status,
          createdAt: b.createdAt,
        }));
      } catch (err: any) {
        console.error('Prisma listBills error, falling back to memory:', err.message);
      }
    }

    if (bills.length === 0 && memoryBills.size > 0) {
      bills = Array.from(memoryBills.values()).filter((b) => b.storeId === storeId);
      if (filters.billType) {
        bills = bills.filter((b) => b.billType === filters.billType);
      }
      if (filters.supplierName) {
        const q = filters.supplierName.toLowerCase();
        bills = bills.filter((b) => b.supplierName?.toLowerCase().includes(q));
      }
      if (filters.billNumber) {
        const q = filters.billNumber.toLowerCase();
        bills = bills.filter((b) => b.billNumber?.toLowerCase().includes(q));
      }
      if (filters.dateFrom) {
        const from = new Date(filters.dateFrom);
        bills = bills.filter((b) => new Date(b.billDate) >= from);
      }
      if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        bills = bills.filter((b) => new Date(b.billDate) <= to);
      }
    }

    // Attach signed access URL for each bill (valid for 30 minutes)
    return bills.map((b) => {
      const signed = storageService.generateSignedToken(b.id, storeId, 30);
      return {
        ...b,
        signedUrl: signed.signedUrl,
        expiresAt: signed.expiresAt,
      };
    });
  }

  /**
   * Get single bill by ID
   */
  static async getBillById(storeId: string, billId: string): Promise<any | null> {
    const list = await this.listBills(storeId);
    return list.find((b) => b.id === billId) || null;
  }

  /**
   * Generate a fresh signed URL for view or download (FR-6.3)
   */
  static getSignedUrl(storeId: string, billId: string, mode: 'view' | 'download' = 'view') {
    const signed = storageService.generateSignedToken(billId, storeId, 15);
    return {
      signedUrl: `${signed.signedUrl}&mode=${mode}`,
      expiresAt: signed.expiresAt,
    };
  }

  /**
   * Verify signed token and return private file details for streaming
   */
  static async verifyAndGetPrivateFile(
    billId: string,
    token: string
  ): Promise<{ valid: boolean; filePath?: string; fileType?: string; fileName?: string; error?: string }> {
    // 1. Find bill in database or memory
    let bill: any = null;

    if (getDatabaseStatus()) {
      try {
        bill = await prisma.billFile.findUnique({ where: { id: billId } });
      } catch (err: any) {
        bill = memoryBills.get(billId) || null;
      }
    } else {
      bill = memoryBills.get(billId) || null;
    }

    if (!bill) {
      return { valid: false, error: 'Bill file not found' };
    }

    // 2. Verify cryptographically signed token (FR-6.3)
    const isTokenValid = storageService.verifySignedToken(billId, bill.storeId, token);
    if (!isTokenValid) {
      return { valid: false, error: 'Invalid or expired link or token. Please request a new link.' };
    }

    return {
      valid: true,
      filePath: bill.filePath,
      fileType: bill.fileType,
      fileName: path.basename(bill.filePath),
    };
  }

  /**
   * Delete bill
   */
  static async deleteBill(storeId: string, billId: string): Promise<{ success: boolean; error?: string }> {
    const bill = await this.getBillById(storeId, billId);
    if (!bill) {
      return { success: false, error: 'Bill not found' };
    }

    await storageService.deleteFile(bill.filePath);

    if (getDatabaseStatus()) {
      try {
        await prisma.billFile.deleteMany({ where: { id: billId, storeId } });
        return { success: true };
      } catch (err: any) {
        console.error('Prisma deleteBill error:', err.message);
      }
    }

    memoryBills.delete(billId);
    return { success: true };
  }

  static resetMemoryState() {
    memoryBills.clear();
  }
}

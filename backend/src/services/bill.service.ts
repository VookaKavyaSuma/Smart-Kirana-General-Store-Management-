import crypto from 'crypto';
import path from 'path';
import { prisma, getDatabaseStatus } from '../config/db.js';
import { storageService } from './storage.service.js';
import { billReaderService } from './bill-reader/composite-bill-reader.service.js';
import { checkBillTotalDiscrepancy } from '../schemas/bill-extraction.schema.js';
import { ItemService } from './item.service.js';
import { PurchaseService } from './purchase.service.js';

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
  extractedData?: any | null;
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
        extractedData: null,
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
          extractedData: b.extractedData,
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
   * Automatically read bill file via Vision AI or Tesseract fallback (FR-6.4, FR-6.9)
   * Read each bill only once and cache the result!
   */
  static async readBill(
    storeId: string,
    billId: string
  ): Promise<{
    success: boolean;
    billId: string;
    extractedData?: any;
    discrepancy?: any;
    cached: boolean;
    error?: string;
  }> {
    const bill = await this.getBillById(storeId, billId);
    if (!bill) {
      return { success: false, billId, cached: false, error: 'Bill file not found' };
    }

    // 1. If already cached, return immediately without re-reading! (FR-6.4 caching)
    if (bill.extractedData) {
      const discrepancy = checkBillTotalDiscrepancy(
        bill.extractedData.lineItems || [],
        bill.extractedData.billTotal
      );
      return {
        success: true,
        billId,
        extractedData: bill.extractedData,
        discrepancy,
        cached: true,
      };
    }

    // 2. Perform OCR / Vision AI reading
    const readResult = await billReaderService.readBillWithDetails(bill.filePath, bill.fileType);

    // 3. Match line items to existing store items by name (FR-6.7)
    let existingItems: any[] = [];
    try {
      existingItems = await ItemService.listItems(storeId);
    } catch (err: any) {
      console.warn('Could not fetch existing items for linking:', err.message);
    }

    const linkedLineItems = (readResult.data.lineItems || []).map((line) => {
      const match = existingItems.find(
        (i) => i.name.trim().toLowerCase() === line.name.trim().toLowerCase()
      );
      if (match) {
        return {
          ...line,
          existingItemId: match.id,
          existingItemName: match.name,
          sellingPrice: line.sellingPrice || match.currentSellingPrice,
          isNewItem: false,
        };
      }
      return {
        ...line,
        existingItemId: null,
        sellingPrice: line.sellingPrice || Math.round(line.costPrice * 1.2 * 100) / 100,
        isNewItem: true,
      };
    });

    const finalExtracted = {
      ...readResult.data,
      supplierShopName: readResult.data.supplierShopName || bill.supplierName || null,
      billNumber: readResult.data.billNumber || bill.billNumber || null,
      billDate: readResult.data.billDate || (bill.billDate ? new Date(bill.billDate).toISOString().split('T')[0] : null),
      billTotal: readResult.data.billTotal != null ? readResult.data.billTotal : bill.totalAmount,
      lineItems: linkedLineItems,
    };

    // 4. Cache extracted data on the bill record in DB and memory
    if (getDatabaseStatus()) {
      try {
        await prisma.billFile.update({
          where: { id: billId },
          data: {
            extractedData: finalExtracted as any,
            supplierName: finalExtracted.supplierShopName || bill.supplierName,
            billNumber: finalExtracted.billNumber || bill.billNumber,
            totalAmount: finalExtracted.billTotal != null ? finalExtracted.billTotal : bill.totalAmount,
          },
        });
      } catch (err: any) {
        console.error('Prisma cache extractedData error:', err.message);
      }
    }

    const mem = memoryBills.get(billId);
    if (mem) {
      mem.extractedData = finalExtracted;
      if (finalExtracted.supplierShopName) mem.supplierName = finalExtracted.supplierShopName;
      if (finalExtracted.billNumber) mem.billNumber = finalExtracted.billNumber;
      if (finalExtracted.billTotal != null) mem.totalAmount = finalExtracted.billTotal;
    }

    const discrepancy = checkBillTotalDiscrepancy(
      finalExtracted.lineItems,
      finalExtracted.billTotal
    );

    return {
      success: true,
      billId,
      extractedData: finalExtracted,
      discrepancy,
      cached: false,
    };
  }

  /**
   * Confirm bill review screen and apply changes to stock and purchases (FR-6.5, FR-6.6, FR-6.7)
   * Nothing changes stock until the user presses Confirm!
   */
  static async confirmBill(
    storeId: string,
    billId: string,
    reviewData: {
      supplierShopName?: string | null;
      billNumber?: string | null;
      billDate?: string | Date;
      billTotal?: number | null;
      lineItems: Array<{
        name: string;
        quantity: number;
        unit: any;
        costPrice: number;
        sellingPrice?: number;
        existingItemId?: string | null;
      }>;
    }
  ): Promise<{ success: boolean; purchase?: any; error?: string }> {
    const bill = await this.getBillById(storeId, billId);
    if (!bill) {
      return { success: false, error: 'Bill file not found' };
    }

    if (!reviewData.lineItems || reviewData.lineItems.length === 0) {
      return { success: false, error: 'Cannot confirm bill without any item lines. Please enter at least one item.' };
    }

    // 1. Resolve Supplier (FR-6.6: creates supplier if missing)
    const supplierShopName = reviewData.supplierShopName?.trim() || bill.supplierName || 'No supplier';

    // 2. Prepare purchase lines
    const purchaseLines = reviewData.lineItems.map((line) => ({
      name: line.name.trim(),
      itemId: line.existingItemId || undefined,
      quantity: Number(line.quantity),
      unit: line.unit,
      costPrice: Number(line.costPrice),
      sellingPrice: Number(line.sellingPrice || line.costPrice * 1.2),
      category: 'General Stores',
    }));

    // 3. Create the purchase and add quantities to stock (FR-6.6: using bill date as purchase date)
    const purchaseRes = await PurchaseService.createPurchase(storeId, {
      supplierShopName,
      purchaseDate: reviewData.billDate || bill.billDate,
      type: bill.billType,
      note: reviewData.billNumber ? `Bill #${reviewData.billNumber}` : (bill.billNumber ? `Bill #${bill.billNumber}` : null),
      items: purchaseLines,
    });

    if (!purchaseRes.success || !purchaseRes.purchase) {
      return { success: false, error: purchaseRes.error || 'Failed to create purchase from confirmed bill.' };
    }

    // 4. Update bill record: mark CONFIRMED and link purchaseId
    const confirmedDate = reviewData.billDate ? new Date(reviewData.billDate) : new Date(bill.billDate);
    const confirmedTotal = reviewData.billTotal != null ? Number(reviewData.billTotal) : Number(purchaseRes.purchase.totalAmount);

    if (getDatabaseStatus()) {
      try {
        await prisma.billFile.update({
          where: { id: billId },
          data: {
            status: 'CONFIRMED',
            supplierName: supplierShopName,
            billNumber: reviewData.billNumber || bill.billNumber,
            billDate: confirmedDate,
            totalAmount: confirmedTotal,
            extractedData: reviewData as any,
          },
        });

        // Link purchase.billFileId to this bill
        await prisma.purchase.update({
          where: { id: purchaseRes.purchase.id },
          data: { billFileId: billId },
        });
      } catch (err: any) {
        console.error('Prisma confirmBill status update error:', err.message);
      }
    }

    const mem = memoryBills.get(billId);
    if (mem) {
      mem.status = 'CONFIRMED';
      mem.purchaseId = purchaseRes.purchase.id;
      mem.supplierName = supplierShopName;
      mem.billNumber = reviewData.billNumber || bill.billNumber;
      mem.billDate = confirmedDate;
      mem.totalAmount = confirmedTotal;
      mem.extractedData = reviewData;
    }

    return {
      success: true,
      purchase: purchaseRes.purchase,
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

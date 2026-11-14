import { Request, Response } from 'express';
import { BillService } from '../services/bill.service.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';

export class BillController {
  /**
   * Upload bill file (photo/image/PDF, up to 10 MB) (FR-6.1 to FR-6.3)
   */
  static async uploadBill(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ success: false, error: 'No bill file uploaded. Please select a JPG, PNG, or PDF file.' });
      return;
    }

    const { billType, billNumber, billDate, supplierName, totalAmount, purchaseId } = req.body;

    const result = await BillService.uploadBill(storeId, req.file, {
      billType,
      billNumber,
      billDate,
      supplierName,
      totalAmount: totalAmount ? Number(totalAmount) : null,
      purchaseId,
    });

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(201).json(result);
  }

  /**
   * List bills with filters (supplier, date, bill number, Online/Shop) (FR-6.10)
   */
  static async listBills(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { supplierName, billType, dateFrom, dateTo, billNumber } = req.query;

    const bills = await BillService.listBills(storeId, {
      supplierName: supplierName as string,
      billType: billType as any,
      dateFrom: dateFrom as string,
      dateTo: dateTo as string,
      billNumber: billNumber as string,
    });

    res.json({ success: true, bills });
  }

  /**
   * Get single bill
   */
  static async getBillById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    const { id } = req.params;

    const bill = await BillService.getBillById(storeId!, id);
    if (!bill) {
      res.status(404).json({ success: false, error: 'Bill not found' });
      return;
    }

    res.json({ success: true, bill });
  }

  /**
   * Get a fresh signed access URL (FR-6.3)
   */
  static async getSignedUrl(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    const { id } = req.params;
    const { mode } = req.query;

    const result = BillService.getSignedUrl(storeId!, id, (mode as any) || 'view');
    res.json({ success: true, ...result });
  }

  /**
   * Secure access endpoint: streams private bill using short-lived signed HMAC token (FR-6.3)
   * Never public URLs! Token required and validated.
   */
  static async accessPrivateFile(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { token, mode } = req.query;

    if (!token || typeof token !== 'string') {
      res.status(403).json({ success: false, error: 'Access denied. Missing signed token.' });
      return;
    }

    const verification = await BillService.verifyAndGetPrivateFile(id, token);
    if (!verification.valid || !verification.filePath) {
      res.status(403).json({ success: false, error: verification.error || 'Access denied. Invalid or expired link.' });
      return;
    }

    // Set MIME type
    const ext = verification.fileType?.toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === 'pdf') contentType = 'application/pdf';
    else if (ext === 'png') contentType = 'image/png';
    else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

    const disposition = mode === 'download' ? 'attachment' : 'inline';
    res.setHeader('Content-Disposition', `${disposition}; filename="${verification.fileName}"`);

    res.sendFile(verification.filePath);
  }

  /**
   * Delete bill
   */
  static async deleteBill(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    const { id } = req.params;

    const result = await BillService.deleteBill(storeId!, id);
    if (!result.success) {
      res.status(404).json(result);
      return;
    }

    res.json({ success: true, message: 'Bill deleted successfully.' });
  }
}


import { Response } from 'express';
import { OnlineService } from '../services/online.service.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';

export class OnlineController {
  /**
   * Overall online payment summary & reminder status (FR-11.5, FR-11.6, FR-11.10)
   */
  static async getSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const summary = await OnlineService.getSummary(storeId, { startDate, endDate });

    res.json({
      success: true,
      summary,
    });
  }

  /**
   * Get list of daily entries (FR-11.1)
   */
  static async getDailyEntries(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const entries = await OnlineService.getDailyEntries(storeId, { startDate, endDate });

    res.json({
      success: true,
      entries,
    });
  }

  /**
   * Save or edit daily entry for a date (FR-11.1, FR-11.3)
   */
  static async upsertDailyEntry(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { date, totalAmount, note } = req.body;
    const result = await OnlineService.upsertDailyEntry(storeId, { date, totalAmount, note });

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json(result);
  }

  /**
   * Get online transactions list (FR-11.2, FR-11.8)
   */
  static async getTransactions(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const transactions = await OnlineService.getTransactions(storeId, { startDate, endDate });

    res.json({
      success: true,
      transactions,
    });
  }

  /**
   * Record individual online transaction (FR-11.2)
   */
  static async createTransaction(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { dateTime, amount, fromCustomer, referenceNumber, note } = req.body;
    const result = await OnlineService.createTransaction(storeId, {
      dateTime,
      amount,
      fromCustomer,
      referenceNumber,
      note,
    });

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(201).json(result);
  }

  /**
   * Get supplier online payments list (FR-11.4)
   */
  static async getSupplierPayments(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { supplierId, startDate, endDate } = req.query as {
      supplierId?: string;
      startDate?: string;
      endDate?: string;
    };

    const payments = await OnlineService.getSupplierPayments(storeId, {
      supplierId,
      startDate,
      endDate,
    });

    res.json({
      success: true,
      payments,
    });
  }

  /**
   * Record payment to supplier with balance check (FR-11.4, FR-11.7)
   */
  static async createSupplierPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { supplierId, purchaseId, amount, date, referenceNumber, note, force } = req.body;
    const result = await OnlineService.createSupplierPayment(storeId, {
      supplierId,
      purchaseId,
      amount,
      date,
      referenceNumber,
      note,
      force,
    });

    if (!result.success) {
      // If exceeds balance, return 409 Conflict with exceedsBalance: true so frontend asks for confirmation (FR-11.7)
      if (result.exceedsBalance) {
        res.status(409).json(result);
        return;
      }
      res.status(400).json(result);
      return;
    }

    res.status(201).json(result);
  }

  /**
   * Get day-by-day running balance and month summaries (FR-11.5, FR-11.6, FR-11.10)
   */
  static async getRunningBalance(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const ledger = await OnlineService.getRunningBalance(storeId, { startDate, endDate });

    res.json({
      success: true,
      ...ledger,
    });
  }

  /**
   * Get total paid online to a supplier (FR-11.9)
   */
  static async getSupplierOnlineTotal(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    const { supplierId } = req.params;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const totalPaidOnline = await OnlineService.getTotalPaidOnlineToSupplier(storeId, supplierId);

    res.json({
      success: true,
      totalPaidOnline,
    });
  }

  /**
   * Export all online data to CSV (FR-11.10)
   */
  static async exportCsv(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    try {
      const csvData = await OnlineService.exportOnlineDataCsv(storeId, { startDate, endDate });
      const filename = `smart-kirana-online-report-${new Date().toISOString().slice(0, 10)}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csvData);
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'Failed to export CSV: ' + err.message });
    }
  }
}


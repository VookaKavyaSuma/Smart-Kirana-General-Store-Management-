import { Request, Response } from 'express';
import { ReportService } from '../services/report.service.js';

export class ReportController {
  /**
   * GET /api/v1/reports/dashboard
   * Dashboard overall metrics
   */
  static async getDashboardMetrics(req: Request, res: Response): Promise<void> {
    const storeId = (req as any).store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    try {
      const metrics = await ReportService.getDashboardMetrics(storeId);
      res.json({ success: true, metrics });
    } catch (err: any) {
      console.error('getDashboardMetrics error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch dashboard metrics' });
    }
  }

  /**
   * GET /api/v1/reports/items
   * Item profit rankings & max/min profit items
   */
  static async getItemRankings(req: Request, res: Response): Promise<void> {
    const storeId = (req as any).store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    try {
      const rankings = await ReportService.getItemProfitRankings(storeId);
      res.json({ success: true, ...rankings });
    } catch (err: any) {
      console.error('getItemRankings error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch item profit rankings' });
    }
  }

  /**
   * GET /api/v1/reports/suppliers
   * Supplier profit breakdown, total spent & max/min supplier
   */
  static async getSupplierBreakdown(req: Request, res: Response): Promise<void> {
    const storeId = (req as any).store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    try {
      const breakdown = await ReportService.getSupplierProfitBreakdown(storeId);
      res.json({ success: true, ...breakdown });
    } catch (err: any) {
      console.error('getSupplierBreakdown error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch supplier profit breakdown' });
    }
  }

  /**
   * GET /api/v1/reports/monthly?month=YYYY-MM
   * Monthly profit report & month-over-month comparison
   */
  static async getMonthlyReport(req: Request, res: Response): Promise<void> {
    const storeId = (req as any).store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const month = typeof req.query.month === 'string' ? req.query.month : undefined;

    try {
      const monthlyComparison = await ReportService.getMonthlyProfitReport(storeId, month);
      res.json({ success: true, ...monthlyComparison });
    } catch (err: any) {
      console.error('getMonthlyReport error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch monthly profit report' });
    }
  }

  /**
   * GET /api/v1/reports/full?month=YYYY-MM
   * Comprehensive report with all sections
   */
  static async getFullReport(req: Request, res: Response): Promise<void> {
    const storeId = (req as any).store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const month = typeof req.query.month === 'string' ? req.query.month : undefined;

    try {
      const report = await ReportService.getFullReport(storeId, month);
      res.json({ success: true, report });
    } catch (err: any) {
      console.error('getFullReport error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch full report' });
    }
  }

  /**
   * GET /api/v1/reports/export/csv?month=YYYY-MM
   * Download financial & profit report CSV
   */
  static async exportCsv(req: Request, res: Response): Promise<void> {
    const storeId = (req as any).store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const month = typeof req.query.month === 'string' ? req.query.month : undefined;

    try {
      const csv = await ReportService.generateReportCsv(storeId, month);
      const filename = `kirana-profit-report-${month || 'all'}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (err: any) {
      console.error('exportCsv error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to export CSV report' });
    }
  }
}


import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { ReportController } from '../controllers/report.controller.js';

export const reportRouter = Router();

// All reporting endpoints require authentication
reportRouter.use(requireAuth);

// 1. Dashboard summary metrics (FR-8.1, FR-8.8)
reportRouter.get('/dashboard', ReportController.getDashboardMetrics);

// 2. Item profit rankings & max/min items (FR-8.2, FR-8.3)
reportRouter.get('/items', ReportController.getItemRankings);

// 3. Supplier profit breakdown & max/min suppliers (FR-8.4, FR-8.6)
reportRouter.get('/suppliers', ReportController.getSupplierBreakdown);

// 4. Monthly profit comparison & history (FR-8.5)
reportRouter.get('/monthly', ReportController.getMonthlyReport);

// 5. Full combined report (FR-8.1 - FR-8.8)
reportRouter.get('/full', ReportController.getFullReport);

// 6. CSV Export (FR-8.7)
reportRouter.get('/export/csv', ReportController.exportCsv);

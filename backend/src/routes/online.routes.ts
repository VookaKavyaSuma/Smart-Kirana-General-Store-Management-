import { Router } from 'express';
import { OnlineController } from '../controllers/online.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

export const onlineRouter = Router();

// All online payment routes require store authentication
onlineRouter.use(requireAuth);

onlineRouter.get('/summary', OnlineController.getSummary);
onlineRouter.get('/daily-entries', OnlineController.getDailyEntries);
onlineRouter.post('/daily-entries', OnlineController.upsertDailyEntry);
onlineRouter.get('/transactions', OnlineController.getTransactions);
onlineRouter.post('/transactions', OnlineController.createTransaction);
onlineRouter.get('/supplier-payments', OnlineController.getSupplierPayments);
onlineRouter.post('/supplier-payments', OnlineController.createSupplierPayment);
onlineRouter.get('/running-balance', OnlineController.getRunningBalance);
onlineRouter.get('/supplier-total/:supplierId', OnlineController.getSupplierOnlineTotal);
onlineRouter.get('/export-csv', OnlineController.exportCsv);


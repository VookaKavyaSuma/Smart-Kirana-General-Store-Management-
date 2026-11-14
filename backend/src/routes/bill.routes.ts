import { Router } from 'express';
import { BillController } from '../controllers/bill.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { uploadBillMiddleware } from '../middlewares/bill-upload.middleware.js';

export const billRouter = Router();

// Private file access via short-lived HMAC signed token (FR-6.3)
billRouter.get('/:id/access', BillController.accessPrivateFile);

// Protected routes (require store session)
billRouter.use(requireAuth);

billRouter.get('/', BillController.listBills);
billRouter.post('/upload', uploadBillMiddleware.single('billFile'), BillController.uploadBill);
billRouter.get('/:id', BillController.getBillById);
billRouter.get('/:id/signed-url', BillController.getSignedUrl);
billRouter.post('/:id/read', BillController.readBill);
billRouter.post('/:id/confirm', BillController.confirmBill);
billRouter.delete('/:id', BillController.deleteBill);


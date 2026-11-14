import { Router } from 'express';
import { PurchaseController } from '../controllers/purchase.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

export const purchaseRouter = Router();

purchaseRouter.use(requireAuth);

purchaseRouter.get('/', PurchaseController.listPurchases);
purchaseRouter.post('/', PurchaseController.createPurchase);
purchaseRouter.get('/convert', PurchaseController.convert);
purchaseRouter.get('/:id', PurchaseController.getPurchaseById);
purchaseRouter.put('/:id', PurchaseController.updatePurchase);
purchaseRouter.delete('/:id', PurchaseController.deletePurchase);


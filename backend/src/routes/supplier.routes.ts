import { Router } from 'express';
import { SupplierController } from '../controllers/supplier.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

export const supplierRouter = Router();

supplierRouter.use(requireAuth);

supplierRouter.get('/', SupplierController.listSuppliers);
supplierRouter.post('/', SupplierController.createSupplier);
supplierRouter.get('/:id', SupplierController.getSupplierDetail);


import { Router } from 'express';
import { CreditController } from '../controllers/credit.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

export const creditRouter = Router();

// All customer credit routes require store authentication
creditRouter.use(requireAuth);

creditRouter.get('/', CreditController.listCustomers);
creditRouter.post('/', CreditController.createCustomer);
creditRouter.get('/:id', CreditController.getCustomer);
creditRouter.post('/:id/entries', CreditController.addCreditEntry);
creditRouter.delete('/:id/entries/:entryId', CreditController.deleteCreditEntry);
creditRouter.post('/:id/payments', CreditController.recordPayment);

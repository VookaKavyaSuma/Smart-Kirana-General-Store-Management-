import { Response } from 'express';
import { CreditService } from '../services/credit.service.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';

export class CreditController {
  /**
   * List customers with balances and total credit due (FR-10.9)
   */
  static async listCustomers(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { filter, sort, search } = req.query as {
      filter?: 'all' | 'unpaid' | 'paid';
      sort?: 'highest_due' | 'name' | 'recent';
      search?: string;
    };

    const result = await CreditService.getCustomers(storeId, { filter, sort, search });
    res.json({
      success: true,
      ...result,
    });
  }

  /**
   * Get single customer with items taken, payments, and balance (FR-10.8)
   */
  static async getCustomer(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    const { id } = req.params;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const result = await CreditService.getCustomerById(storeId, id);
    if (!result) {
      res.status(404).json({ success: false, error: 'Customer not found' });
      return;
    }

    res.json({
      success: true,
      ...result,
    });
  }

  /**
   * Add a new customer (FR-10.2)
   */
  static async createCustomer(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { name, mobileNumber } = req.body;
    const result = await CreditService.createCustomer(storeId, { name, mobileNumber });
    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(201).json(result);
  }

  /**
   * Add credit entry: reduces stock, validates stock availability (FR-10.3 to FR-10.5)
   */
  static async addCreditEntry(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    const { id: customerId } = req.params;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { itemId, itemName, quantity, costPrice, sellingPrice, dateTaken } = req.body;
    const result = await CreditService.addCreditEntry(storeId, customerId, {
      itemId,
      itemName,
      quantity,
      costPrice,
      sellingPrice,
      dateTaken,
    });

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(201).json(result);
  }

  /**
   * Delete credit entry and restore item stock (FR-10.5)
   */
  static async deleteCreditEntry(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    const { id: customerId, entryId } = req.params;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const result = await CreditService.deleteCreditEntry(storeId, customerId, entryId);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json(result);
  }

  /**
   * Record payment (cash or online, online adds to online transactions) (FR-10.6)
   */
  static async recordPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    const { id: customerId } = req.params;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { amount, date, mode, referenceNumber, note } = req.body;
    const result = await CreditService.recordPayment(storeId, customerId, {
      amount,
      date,
      mode,
      referenceNumber,
      note,
    });

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(201).json(result);
  }
}

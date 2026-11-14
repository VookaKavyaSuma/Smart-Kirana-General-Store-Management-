import { Response } from 'express';
import { SupplierService } from '../services/supplier.service.js';
import { ItemService } from '../services/item.service.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';

export class SupplierController {
  /**
   * List all suppliers with aggregated metrics (FR-5.1, FR-5.7)
   */
  static async listSuppliers(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    // Fetch store's items to calculate supplier aggregates
    const items = await ItemService.listItems(storeId);
    const suppliers = await SupplierService.listSuppliersWithTotals(storeId, items);

    res.json({ success: true, suppliers });
  }

  /**
   * Get single supplier detail with all items bought from them and profit metrics (FR-5.7)
   */
  static async getSupplierDetail(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    const { id } = req.params;

    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const items = await ItemService.listItems(storeId);
    const detail = await SupplierService.getSupplierDetail(storeId, id, items);

    if (!detail) {
      res.status(404).json({ success: false, error: 'Supplier not found' });
      return;
    }

    res.json({ success: true, ...detail });
  }

  /**
   * Create a new supplier manually (FR-5.1)
   */
  static async createSupplier(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    const { shopName, phone } = req.body;

    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const result = await SupplierService.createSupplier(storeId, shopName, phone);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(201).json(result);
  }
}


import { Response } from 'express';
import { ItemService } from '../services/item.service.js';
import { storageService } from '../services/storage.service.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';

export class ItemController {
  /**
   * Upload item photo (JPG/PNG, up to 5MB, shrunk in browser)
   */
  static async uploadPhoto(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'No image file uploaded.' });
        return;
      }

      const uploadResult = await storageService.uploadFile(req.file, 'items');
      res.status(201).json({
        success: true,
        photoUrl: uploadResult.url,
        fileName: uploadResult.fileName,
        fileSize: uploadResult.fileSize,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Image upload failed' });
    }
  }

  /**
   * Create new item (FR-3.1, FR-3.4, FR-3.8)
   */
  static async createItem(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const {
      name,
      category,
      unit,
      costPrice,
      sellingPrice,
      quantity,
      supplierShopName,
      photoUrl,
    } = req.body;

    const result = await ItemService.createItem(storeId, {
      name,
      category,
      unit,
      costPrice: Number(costPrice),
      sellingPrice: Number(sellingPrice),
      quantity: Number(quantity),
      supplierShopName,
      photoUrl,
    });

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(201).json(result);
  }

  /**
   * List items with search, category, and low stock filters (FR-3.4, FR-3.7)
   */
  static async listItems(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { category, lowStockOnly, search } = req.query;
    const threshold = req.store?.lowStockThreshold ?? 5;

    const items = await ItemService.listItems(storeId, {
      category: category as string,
      lowStockOnly: lowStockOnly === 'true',
      search: search as string,
      lowStockThreshold: Number(threshold),
    });

    res.json({ success: true, items });
  }

  /**
   * Get single item
   */
  static async getItemById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    const { id } = req.params;

    const item = await ItemService.getItemById(storeId!, id, req.store?.lowStockThreshold ?? 5);
    if (!item) {
      res.status(404).json({ success: false, error: 'Item not found' });
      return;
    }

    res.json({ success: true, item });
  }

  /**
   * Update item
   */
  static async updateItem(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    const { id } = req.params;

    const result = await ItemService.updateItem(storeId!, id, req.body);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json(result);
  }

  /**
   * Delete item
   */
  static async deleteItem(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    const { id } = req.params;

    const result = await ItemService.deleteItem(storeId!, id);
    if (!result.success) {
      res.status(404).json(result);
      return;
    }

    res.json({ success: true, message: 'Item deleted successfully.' });
  }

  /**
   * Quick "units sold" entry (FR-3.5)
   */
  static async recordUnitsSold(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    const { id } = req.params;
    const { unitsSold } = req.body;

    const result = await ItemService.recordUnitsSold(storeId!, id, Number(unitsSold));
    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json(result);
  }

  /**
   * Direct stock count adjustment (FR-3.5)
   */
  static async updateStockCount(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    const { id } = req.params;
    const { newCount } = req.body;

    const result = await ItemService.updateStockCount(storeId!, id, Number(newCount));
    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json(result);
  }

  /**
   * Restock / add more stock (FR-3.6)
   */
  static async restockItem(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    const { id } = req.params;
    const { quantity, costPrice } = req.body;

    const result = await ItemService.restockItem(
      storeId!,
      id,
      Number(quantity),
      costPrice != null ? Number(costPrice) : undefined
    );
    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json(result);
  }
}


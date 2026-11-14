import { Response } from 'express';
import { PurchaseService } from '../services/purchase.service.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import {
  calculatePriceForQuantity,
  calculateQuantityForAmount,
  generateReadyPriceChart,
} from '../utils/calculations.util.js';

export class PurchaseController {
  /**
   * Record new purchase (FR-5.2 to FR-5.5)
   */
  static async createPurchase(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { supplierShopName, supplierId, purchaseDate, type, note, items } = req.body;

    const result = await PurchaseService.createPurchase(storeId, {
      supplierShopName,
      supplierId,
      purchaseDate,
      type,
      note,
      items,
    });

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(201).json(result);
  }

  /**
   * List purchases with filters (date, supplier, item, type) (FR-5.6)
   */
  static async listPurchases(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { supplierId, itemId, type, dateFrom, dateTo } = req.query;

    const purchases = await PurchaseService.listPurchases(storeId, {
      supplierId: supplierId as string,
      itemId: itemId as string,
      type: type as any,
      dateFrom: dateFrom as string,
      dateTo: dateTo as string,
    });

    res.json({ success: true, purchases });
  }

  /**
   * Get single purchase
   */
  static async getPurchaseById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    const { id } = req.params;

    const purchase = await PurchaseService.getPurchaseById(storeId!, id);
    if (!purchase) {
      res.status(404).json({ success: false, error: 'Purchase not found' });
      return;
    }

    res.json({ success: true, purchase });
  }

  /**
   * Update purchase (FR-5.6)
   */
  static async updatePurchase(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    const { id } = req.params;

    const result = await PurchaseService.updatePurchase(storeId!, id, req.body);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json(result);
  }

  /**
   * Delete purchase and adjust stock (FR-5.6)
   */
  static async deletePurchase(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    const { id } = req.params;

    const result = await PurchaseService.deletePurchase(storeId!, id);
    if (!result.success) {
      res.status(404).json(result);
      return;
    }

    res.json({ success: true, message: 'Purchase deleted and stock adjusted successfully.' });
  }

  /**
   * 2-Way Price & Quantity Conversion API (FR-4)
   */
  static async convert(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { mode, pricePerUnit, quantity, amount, unit, baseUnit } = req.query;

    const sp = parseFloat(pricePerUnit as string) || 0;

    if (mode === 'quantity-to-price') {
      const qty = parseFloat(quantity as string) || 0;
      const price = calculatePriceForQuantity(sp, qty, (unit as any) || 'KG');
      res.json({ success: true, price, pricePerUnit: sp, quantity: qty, unit: unit || 'KG' });
      return;
    }

    if (mode === 'amount-to-quantity') {
      const amt = parseFloat(amount as string) || 0;
      const result = calculateQuantityForAmount(sp, amt, (baseUnit as any) || 'KG');
      res.json({ success: true, ...result, amount: amt, pricePerUnit: sp });
      return;
    }

    if (mode === 'chart') {
      const chart = generateReadyPriceChart(sp, (baseUnit as any) || 'KG');
      res.json({ success: true, chart });
      return;
    }

    res.status(400).json({
      success: false,
      error: 'Invalid conversion mode. Use "quantity-to-price", "amount-to-quantity", or "chart".',
    });
  }
}


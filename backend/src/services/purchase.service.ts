import crypto from 'crypto';
import { prisma, getDatabaseStatus } from '../config/db.js';
import { SupplierService } from './supplier.service.js';
import { ItemService } from './item.service.js';
import { calculatePurchaseTotals, calculateProfitPerUnit, calculateMarginPercentage } from '../utils/calculations.util.js';

export interface PurchaseLineInput {
  itemId?: string;
  name?: string;
  category?: string;
  unit?: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
}

export interface PurchaseRecord {
  id: string;
  storeId: string;
  supplierId: string | null;
  supplierShopName?: string;
  purchaseDate: Date;
  type: 'SHOP' | 'ONLINE';
  totalAmount: number;
  expectedProfit: number;
  note: string | null;
  items: Array<{
    id: string;
    itemId: string;
    itemName: string;
    category: string;
    unit: string;
    quantity: number;
    costPrice: number;
    sellingPrice: number;
    profitPerUnit: number;
    marginPercentage: number;
    totalCost: number;
    expectedProfit: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

// In-Memory store fallback for Purchases
const memoryPurchases = new Map<string, PurchaseRecord>();

export class PurchaseService {
  /**
   * Record a new purchase (FR-5.2 to FR-5.5, FR-3.6)
   */
  static async createPurchase(
    storeId: string,
    data: {
      supplierShopName?: string | null;
      supplierId?: string | null;
      purchaseDate?: string | Date;
      type?: 'SHOP' | 'ONLINE';
      note?: string | null;
      items: PurchaseLineInput[];
    }
  ): Promise<{ success: boolean; purchase?: any; error?: string }> {
    const { supplierShopName, purchaseDate, type = 'SHOP', note, items } = data;

    if (!items || items.length === 0) {
      return { success: false, error: 'At least one item line is required for a purchase.' };
    }

    // 1. Resolve Supplier (FR-5.1, FR-3.8)
    let finalSupplierId = data.supplierId || null;
    let finalSupplierShopName = 'No supplier';

    if (supplierShopName && supplierShopName.trim()) {
      const supplier = await SupplierService.findOrCreateSupplier(storeId, supplierShopName.trim());
      if (supplier) {
        finalSupplierId = supplier.id;
        finalSupplierShopName = supplier.shopName;
      }
    } else if (finalSupplierId) {
      const sup = await SupplierService.getSupplierDetail(storeId, finalSupplierId, []);
      if (sup?.supplier) {
        finalSupplierShopName = sup.supplier.shopName;
      }
    }

    // 2. Resolve Purchase Date (FR-5.3: defaults to today, editable)
    const finalDate = purchaseDate ? new Date(purchaseDate) : new Date();

    // 3. Process items and update stock (FR-3.6, FR-5.5)
    const purchaseLines: PurchaseRecord['items'] = [];

    for (const line of items) {
      const qty = Number(Number(line.quantity).toFixed(3));
      const cp = Number(Number(line.costPrice).toFixed(2));
      const sp = Number(Number(line.sellingPrice).toFixed(2));

      if (qty <= 0) {
        return { success: false, error: 'Quantity on each item line must be positive.' };
      }
      if (cp < 0 || sp < 0) {
        return { success: false, error: 'Cost price and selling price cannot be negative.' };
      }

      let resolvedItem: any = null;

      // Existing item by ID
      if (line.itemId) {
        resolvedItem = await ItemService.getItemById(storeId, line.itemId);
      }

      // Existing or new item by Name
      if (!resolvedItem && line.name) {
        const existingList = await ItemService.listItems(storeId, { search: line.name.trim() });
        const exactMatch = existingList.find(
          (i) => i.name.toLowerCase() === line.name!.trim().toLowerCase()
        );
        if (exactMatch) {
          resolvedItem = exactMatch;
        } else {
          // Create new item on the fly
          const created = await ItemService.createItem(storeId, {
            name: line.name.trim(),
            category: line.category?.trim() || 'General',
            unit: (line.unit?.toUpperCase() || 'PIECE') as any,
            costPrice: cp,
            sellingPrice: sp,
            quantity: qty, // Initial stock
            supplierShopName: finalSupplierShopName !== 'No supplier' ? finalSupplierShopName : null,
          });
          if (created.success && created.item) {
            resolvedItem = created.item;
          }
        }
      }

      if (!resolvedItem) {
        return { success: false, error: `Could not resolve or create item: ${line.name || line.itemId}` };
      }

      // Add to quantity purchased and quantity remaining (FR-3.6)
      // Note: If item was just created above, its initial quantity was set to qty. If existing, restock:
      if (line.itemId || resolvedItem.quantityPurchased !== qty) {
        await ItemService.restockItem(storeId, resolvedItem.id, qty, cp);
      }

      // Also ensure item has selling price updated if changed
      await ItemService.updateItem(storeId, resolvedItem.id, {
        costPrice: cp,
        sellingPrice: sp,
        supplierShopName: finalSupplierShopName !== 'No supplier' ? finalSupplierShopName : undefined,
      });

      const profitPerUnit = calculateProfitPerUnit(cp, sp);
      const marginPct = calculateMarginPercentage(cp, sp);

      purchaseLines.push({
        id: crypto.randomUUID(),
        itemId: resolvedItem.id,
        itemName: resolvedItem.name,
        category: resolvedItem.category,
        unit: resolvedItem.unit,
        quantity: qty,
        costPrice: cp,
        sellingPrice: sp,
        profitPerUnit,
        marginPercentage: marginPct,
        totalCost: Number((qty * cp).toFixed(2)),
        expectedProfit: Number((qty * profitPerUnit).toFixed(2)),
      });
    }

    // 4. Calculate Purchase Totals (FR-5.4)
    const totals = calculatePurchaseTotals(
      purchaseLines.map((l) => ({
        quantity: l.quantity,
        costPrice: l.costPrice,
        sellingPrice: l.sellingPrice,
      }))
    );

    const purchaseId = crypto.randomUUID();

    if (getDatabaseStatus()) {
      try {
        const purchase = await prisma.purchase.create({
          data: {
            id: purchaseId,
            storeId,
            supplierId: finalSupplierId,
            purchaseDate: finalDate,
            type: type as any,
            totalAmount: totals.totalAmount,
            note: note || null,
            items: {
              create: purchaseLines.map((l) => ({
                id: l.id,
                itemId: l.itemId,
                quantity: l.quantity,
                unit: l.unit as any,
                costPrice: l.costPrice,
                sellingPrice: l.sellingPrice,
              })),
            },
          },
          include: {
            supplier: true,
            items: { include: { item: true } },
          },
        });

        return {
          success: true,
          purchase: {
            id: purchase.id,
            storeId: purchase.storeId,
            supplierId: purchase.supplierId,
            supplierShopName: purchase.supplier?.shopName || 'No supplier',
            purchaseDate: purchase.purchaseDate,
            type: purchase.type,
            totalAmount: Number(purchase.totalAmount),
            expectedProfit: totals.expectedProfit,
            note: purchase.note,
            items: purchaseLines,
            createdAt: purchase.createdAt,
          },
        };
      } catch (err: any) {
        console.error('Prisma createPurchase error, falling back to memory:', err.message);
      }
    }

    // In-memory fallback
    const memoryRecord: PurchaseRecord = {
      id: purchaseId,
      storeId,
      supplierId: finalSupplierId,
      supplierShopName: finalSupplierShopName,
      purchaseDate: finalDate,
      type,
      totalAmount: totals.totalAmount,
      expectedProfit: totals.expectedProfit,
      note: note || null,
      items: purchaseLines,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryPurchases.set(purchaseId, memoryRecord);

    return {
      success: true,
      purchase: memoryRecord,
    };
  }

  /**
   * List past purchases with filters (FR-5.6)
   */
  static async listPurchases(
    storeId: string,
    filters: {
      supplierId?: string;
      itemId?: string;
      type?: 'SHOP' | 'ONLINE';
      dateFrom?: string;
      dateTo?: string;
    } = {}
  ): Promise<any[]> {
    if (getDatabaseStatus()) {
      try {
        const whereClause: any = { storeId };
        if (filters.supplierId) {
          whereClause.supplierId = filters.supplierId;
        }
        if (filters.type) {
          whereClause.type = filters.type;
        }
        if (filters.dateFrom || filters.dateTo) {
          whereClause.purchaseDate = {};
          if (filters.dateFrom) whereClause.purchaseDate.gte = new Date(filters.dateFrom);
          if (filters.dateTo) whereClause.purchaseDate.lte = new Date(filters.dateTo);
        }

        const purchases = await prisma.purchase.findMany({
          where: whereClause,
          include: {
            supplier: true,
            items: { include: { item: true } },
          },
          orderBy: { purchaseDate: 'desc' },
        });

        let results = purchases.map((p) => {
          const lines = p.items.map((pi) => {
            const qty = Number(pi.quantity);
            const cp = Number(pi.costPrice);
            const sp = Number(pi.sellingPrice);
            const profitPerUnit = calculateProfitPerUnit(cp, sp);
            return {
              id: pi.id,
              itemId: pi.itemId,
              itemName: pi.item.name,
              category: pi.item.category,
              unit: pi.unit,
              quantity: qty,
              costPrice: cp,
              sellingPrice: sp,
              profitPerUnit,
              marginPercentage: calculateMarginPercentage(cp, sp),
              totalCost: Number((qty * cp).toFixed(2)),
              expectedProfit: Number((qty * profitPerUnit).toFixed(2)),
            };
          });

          const totals = calculatePurchaseTotals(
            lines.map((l) => ({ quantity: l.quantity, costPrice: l.costPrice, sellingPrice: l.sellingPrice }))
          );

          return {
            id: p.id,
            storeId: p.storeId,
            supplierId: p.supplierId,
            supplierShopName: p.supplier?.shopName || 'No supplier',
            purchaseDate: p.purchaseDate,
            type: p.type,
            totalAmount: Number(p.totalAmount),
            expectedProfit: totals.expectedProfit,
            note: p.note,
            itemCount: p.items.length,
            items: lines,
            createdAt: p.createdAt,
          };
        });

        if (filters.itemId) {
          results = results.filter((p) => p.items.some((i: any) => i.itemId === filters.itemId));
        }

        return results;
      } catch (err: any) {
        console.error('Prisma listPurchases error, falling back to memory:', err.message);
      }
    }

    // In-memory fallback
    let list = Array.from(memoryPurchases.values()).filter((p) => p.storeId === storeId);

    if (filters.supplierId) {
      list = list.filter((p) => p.supplierId === filters.supplierId);
    }
    if (filters.type) {
      list = list.filter((p) => p.type === filters.type);
    }
    if (filters.itemId) {
      list = list.filter((p) => p.items.some((i) => i.itemId === filters.itemId));
    }
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      list = list.filter((p) => new Date(p.purchaseDate) >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      list = list.filter((p) => new Date(p.purchaseDate) <= to);
    }

    return list.sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
  }

  /**
   * Get purchase by ID
   */
  static async getPurchaseById(storeId: string, purchaseId: string): Promise<any | null> {
    const list = await this.listPurchases(storeId);
    return list.find((p) => p.id === purchaseId) || null;
  }

  /**
   * Delete purchase and adjust stock (FR-5.6)
   */
  static async deletePurchase(storeId: string, purchaseId: string): Promise<{ success: boolean; error?: string }> {
    const purchase = await this.getPurchaseById(storeId, purchaseId);
    if (!purchase) {
      return { success: false, error: 'Purchase not found.' };
    }

    // Reverse added stock for each item in the purchase (FR-5.6)
    for (const line of purchase.items) {
      await ItemService.adjustStockQuantities(
        storeId,
        line.itemId,
        -line.quantity,
        -line.quantity
      );
    }

    if (getDatabaseStatus()) {
      try {
        await prisma.purchase.deleteMany({
          where: { id: purchaseId, storeId },
        });
        return { success: true };
      } catch (err: any) {
        console.error('Prisma deletePurchase error:', err.message);
      }
    }

    memoryPurchases.delete(purchaseId);
    return { success: true };
  }

  /**
   * Edit/Update purchase and re-adjust stock (FR-5.6)
   */
  static async updatePurchase(
    storeId: string,
    purchaseId: string,
    data: {
      supplierShopName?: string | null;
      purchaseDate?: string | Date;
      type?: 'SHOP' | 'ONLINE';
      note?: string | null;
      items: PurchaseLineInput[];
    }
  ): Promise<{ success: boolean; purchase?: any; error?: string }> {
    // 1. Delete old purchase and reverse stock
    const deleteResult = await this.deletePurchase(storeId, purchaseId);
    if (!deleteResult.success) {
      return deleteResult;
    }

    // 2. Re-create purchase with updated values
    const createResult = await this.createPurchase(storeId, data);
    return createResult;
  }

  static resetMemoryState() {
    memoryPurchases.clear();
  }
}

import crypto from 'crypto';
import { prisma, getDatabaseStatus } from '../config/db.js';
import { SupplierService } from './supplier.service.js';
import {
  calculateProfitPerUnit,
  calculateMarginPercentage,
  calculateUnitsSold,
  calculateProfitEarned,
  calculateExpectedProfit,
  calculateTotalCost,
} from '../utils/profit.util.js';

export type ItemUnit = 'KG' | 'G' | 'LITRE' | 'ML' | 'PIECE' | 'PACKET';

export interface ItemRecord {
  id: string;
  storeId: string;
  supplierId: string | null;
  name: string;
  category: string;
  unit: ItemUnit;
  photoUrl: string | null;
  currentCostPrice: number;
  currentSellingPrice: number;
  quantityPurchased: number;
  quantityRemaining: number;
  createdAt: Date;
  updatedAt: Date;
  supplierShopName?: string;
}

// In-Memory store fallback for items
const memoryItems = new Map<string, ItemRecord>();

export class ItemService {
  /**
   * Create new item (FR-3.1, FR-3.4, FR-3.8)
   */
  static async createItem(
    storeId: string,
    data: {
      name: string;
      category: string;
      unit: ItemUnit;
      costPrice: number;
      sellingPrice: number;
      quantity: number;
      supplierShopName?: string | null;
      photoUrl?: string | null;
    }
  ): Promise<{ success: boolean; item?: any; error?: string }> {
    const { name, category, unit, costPrice, sellingPrice, quantity, supplierShopName, photoUrl } = data;

    if (!name || !name.trim()) {
      return { success: false, error: 'Item name is required.' };
    }
    if (!category || !category.trim()) {
      return { success: false, error: 'Category is required.' };
    }
    if (costPrice == null || costPrice < 0) {
      return { success: false, error: 'Valid cost price is required.' };
    }
    if (sellingPrice == null || sellingPrice < 0) {
      return { success: false, error: 'Valid selling price is required.' };
    }
    if (quantity == null || quantity < 0) {
      return { success: false, error: 'Valid quantity is required.' };
    }

    // FR-3.8: Find or create supplier by shop name
    const supplier = await SupplierService.findOrCreateSupplier(storeId, supplierShopName);
    const supplierId = supplier ? supplier.id : null;

    const initialQuantity = Number(Number(quantity).toFixed(3));
    const cp = Number(Number(costPrice).toFixed(2));
    const sp = Number(Number(sellingPrice).toFixed(2));

    if (getDatabaseStatus()) {
      try {
        const item = await prisma.item.create({
          data: {
            id: crypto.randomUUID(),
            storeId,
            supplierId,
            name: name.trim(),
            category: category.trim(),
            unit,
            photoUrl: photoUrl || null,
            currentCostPrice: cp,
            currentSellingPrice: sp,
            quantityPurchased: initialQuantity,
            quantityRemaining: initialQuantity,
          },
          include: { supplier: true },
        });

        return {
          success: true,
          item: this.formatItemOutput(item, item.supplier?.shopName),
        };
      } catch (err: any) {
        console.error('Prisma createItem error, falling back to memory:', err.message);
      }
    }

    // In-memory fallback
    const newItem: ItemRecord = {
      id: crypto.randomUUID(),
      storeId,
      supplierId,
      name: name.trim(),
      category: category.trim(),
      unit,
      photoUrl: photoUrl || null,
      currentCostPrice: cp,
      currentSellingPrice: sp,
      quantityPurchased: initialQuantity,
      quantityRemaining: initialQuantity,
      supplierShopName: supplier ? supplier.shopName : 'No supplier',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    memoryItems.set(newItem.id, newItem);

    return {
      success: true,
      item: this.formatItemOutput(newItem, newItem.supplierShopName),
    };
  }

  /**
   * List all items for store with financial calculations and low-stock flag (FR-3.4, FR-3.7)
   */
  static async listItems(
    storeId: string,
    options: {
      category?: string;
      lowStockOnly?: boolean;
      search?: string;
      lowStockThreshold?: number;
    } = {}
  ): Promise<any[]> {
    const threshold = options.lowStockThreshold != null ? options.lowStockThreshold : 5;
    let items: any[] = [];

    if (getDatabaseStatus()) {
      try {
        const whereClause: any = { storeId };
        if (options.category) {
          whereClause.category = options.category;
        }
        if (options.search) {
          whereClause.name = { contains: options.search, mode: 'insensitive' };
        }

        const dbItems = await prisma.item.findMany({
          where: whereClause,
          include: { supplier: true },
          orderBy: { createdAt: 'desc' },
        });

        items = dbItems.map((item) =>
          this.formatItemOutput(item, item.supplier?.shopName, threshold)
        );
      } catch (err: any) {
        console.error('Prisma listItems error, falling back to memory:', err.message);
        items = this.getMemoryItemsList(storeId, threshold, options);
      }
    } else {
      items = this.getMemoryItemsList(storeId, threshold, options);
    }

    if (options.lowStockOnly) {
      items = items.filter((item) => item.isLowStock);
    }

    return items;
  }

  /**
   * Get single item by ID
   */
  static async getItemById(storeId: string, itemId: string, lowStockThreshold = 5): Promise<any | null> {
    if (getDatabaseStatus()) {
      try {
        const item = await prisma.item.findFirst({
          where: { id: itemId, storeId },
          include: { supplier: true },
        });
        if (item) {
          return this.formatItemOutput(item, item.supplier?.shopName, lowStockThreshold);
        }
      } catch (err: any) {
        console.error('Prisma getItemById error, falling back to memory:', err.message);
      }
    }

    const item = memoryItems.get(itemId);
    if (!item || item.storeId !== storeId) return null;
    return this.formatItemOutput(item, item.supplierShopName, lowStockThreshold);
  }

  /**
   * Update item details (FR-3.3, FR-3.8: can move to a different supplier or to "No supplier")
   */
  static async updateItem(
    storeId: string,
    itemId: string,
    data: {
      name?: string;
      category?: string;
      unit?: ItemUnit;
      costPrice?: number;
      sellingPrice?: number;
      supplierShopName?: string | null;
      photoUrl?: string | null;
    }
  ): Promise<{ success: boolean; item?: any; error?: string }> {
    const item = await this.getItemById(storeId, itemId);
    if (!item) {
      return { success: false, error: 'Item not found.' };
    }

    let supplierId = item.supplierId;
    let supplierName = item.supplierShopName;

    // Check if supplier changed
    if (data.supplierShopName !== undefined) {
      if (!data.supplierShopName || !data.supplierShopName.trim()) {
        supplierId = null;
        supplierName = 'No supplier';
      } else {
        const sup = await SupplierService.findOrCreateSupplier(storeId, data.supplierShopName);
        supplierId = sup ? sup.id : null;
        supplierName = sup ? sup.shopName : 'No supplier';
      }
    }

    const updatedData: any = {};
    if (data.name) updatedData.name = data.name.trim();
    if (data.category) updatedData.category = data.category.trim();
    if (data.unit) updatedData.unit = data.unit;
    if (data.costPrice != null) updatedData.currentCostPrice = Number(Number(data.costPrice).toFixed(2));
    if (data.sellingPrice != null) updatedData.currentSellingPrice = Number(Number(data.sellingPrice).toFixed(2));
    if (data.photoUrl !== undefined) updatedData.photoUrl = data.photoUrl;
    updatedData.supplierId = supplierId;

    if (getDatabaseStatus()) {
      try {
        const updated = await prisma.item.update({
          where: { id: itemId },
          data: updatedData,
          include: { supplier: true },
        });
        return {
          success: true,
          item: this.formatItemOutput(updated, updated.supplier?.shopName),
        };
      } catch (err: any) {
        console.error('Prisma updateItem error, falling back to memory:', err.message);
      }
    }

    const memItem = memoryItems.get(itemId);
    if (memItem) {
      Object.assign(memItem, updatedData);
      memItem.supplierShopName = supplierName;
      memItem.updatedAt = new Date();
      return {
        success: true,
        item: this.formatItemOutput(memItem, memItem.supplierShopName),
      };
    }

    return { success: false, error: 'Failed to update item.' };
  }

  /**
   * Adjust both quantityPurchased and quantityRemaining directly (e.g. on purchase deletion/edit)
   */
  static async adjustStockQuantities(
    storeId: string,
    itemId: string,
    purchasedChange: number,
    remainingChange: number
  ): Promise<boolean> {
    const item = await this.getItemById(storeId, itemId);
    if (!item) return false;

    const newPurchased = Math.max(0, Number((Number(item.quantityPurchased) + purchasedChange).toFixed(3)));
    const newRemaining = Math.max(0, Number((Number(item.quantityRemaining) + remainingChange).toFixed(3)));

    if (getDatabaseStatus()) {
      try {
        await prisma.item.update({
          where: { id: itemId },
          data: {
            quantityPurchased: newPurchased,
            quantityRemaining: newRemaining,
          },
        });
        return true;
      } catch (err: any) {
        console.error('Prisma adjustStockQuantities error:', err.message);
      }
    }

    const memItem = memoryItems.get(itemId);
    if (memItem) {
      memItem.quantityPurchased = newPurchased;
      memItem.quantityRemaining = newRemaining;
      memItem.updatedAt = new Date();
      return true;
    }
    return false;
  }

  /**
   * Delete item (FR-3.3)
   */
  static async deleteItem(storeId: string, itemId: string): Promise<{ success: boolean; error?: string }> {
    if (getDatabaseStatus()) {
      try {
        await prisma.item.deleteMany({
          where: { id: itemId, storeId },
        });
        return { success: true };
      } catch (err: any) {
        console.error('Prisma deleteItem error, falling back to memory:', err.message);
      }
    }

    const item = memoryItems.get(itemId);
    if (item && item.storeId === storeId) {
      memoryItems.delete(itemId);
      return { success: true };
    }

    return { success: false, error: 'Item not found.' };
  }

  /**
   * Quick "units sold" entry (FR-3.5)
   * Deducts units sold from remaining stock. Cannot go below zero.
   */
  static async recordUnitsSold(
    storeId: string,
    itemId: string,
    unitsSold: number
  ): Promise<{ success: boolean; item?: any; error?: string }> {
    const item = await this.getItemById(storeId, itemId);
    if (!item) {
      return { success: false, error: 'Item not found.' };
    }

    const sold = Number(unitsSold);
    if (isNaN(sold) || sold <= 0) {
      return { success: false, error: 'Units sold must be a positive number.' };
    }

    const currentRemaining = Number(item.quantityRemaining);
    if (sold > currentRemaining) {
      return {
        success: false,
        error: `Cannot sell ${sold} ${item.unit}. Only ${currentRemaining} ${item.unit} remaining in stock.`,
      };
    }

    const newRemaining = Number((currentRemaining - sold).toFixed(3));

    if (getDatabaseStatus()) {
      try {
        const updated = await prisma.item.update({
          where: { id: itemId },
          data: { quantityRemaining: newRemaining },
          include: { supplier: true },
        });

        // Record stock adjustment log
        await prisma.stockAdjustment.create({
          data: {
            id: crypto.randomUUID(),
            itemId,
            unitsChanged: -sold,
            reason: 'QUICK_SOLD',
          },
        });

        return {
          success: true,
          item: this.formatItemOutput(updated, updated.supplier?.shopName),
        };
      } catch (err: any) {
        console.error('Prisma recordUnitsSold error, falling back to memory:', err.message);
      }
    }

    const memItem = memoryItems.get(itemId);
    if (memItem) {
      memItem.quantityRemaining = newRemaining;
      memItem.updatedAt = new Date();
      return {
        success: true,
        item: this.formatItemOutput(memItem, memItem.supplierShopName),
      };
    }

    return { success: false, error: 'Item not found.' };
  }

  /**
   * Set new stock count directly (FR-3.5)
   * Remaining quantity can never go below zero.
   */
  static async updateStockCount(
    storeId: string,
    itemId: string,
    newCount: number
  ): Promise<{ success: boolean; item?: any; error?: string }> {
    const item = await this.getItemById(storeId, itemId);
    if (!item) {
      return { success: false, error: 'Item not found.' };
    }

    const count = Number(newCount);
    if (isNaN(count) || count < 0) {
      return { success: false, error: 'Stock count cannot be negative.' };
    }

    const finalCount = Number(count.toFixed(3));

    if (getDatabaseStatus()) {
      try {
        const updated = await prisma.item.update({
          where: { id: itemId },
          data: { quantityRemaining: finalCount },
          include: { supplier: true },
        });

        await prisma.stockAdjustment.create({
          data: {
            id: crypto.randomUUID(),
            itemId,
            unitsChanged: finalCount - Number(item.quantityRemaining),
            reason: 'MANUAL_COUNT',
          },
        });

        return {
          success: true,
          item: this.formatItemOutput(updated, updated.supplier?.shopName),
        };
      } catch (err: any) {
        console.error('Prisma updateStockCount error, falling back to memory:', err.message);
      }
    }

    const memItem = memoryItems.get(itemId);
    if (memItem) {
      memItem.quantityRemaining = finalCount;
      memItem.updatedAt = new Date();
      return {
        success: true,
        item: this.formatItemOutput(memItem, memItem.supplierShopName),
      };
    }

    return { success: false, error: 'Item not found.' };
  }

  /**
   * Add more stock to existing item (FR-3.6)
   */
  static async restockItem(
    storeId: string,
    itemId: string,
    additionalQuantity: number,
    newCostPrice?: number
  ): Promise<{ success: boolean; item?: any; error?: string }> {
    const item = await this.getItemById(storeId, itemId);
    if (!item) {
      return { success: false, error: 'Item not found.' };
    }

    const qty = Number(additionalQuantity);
    if (isNaN(qty) || qty <= 0) {
      return { success: false, error: 'Quantity to add must be positive.' };
    }

    const newPurchased = Number((Number(item.quantityPurchased) + qty).toFixed(3));
    const newRemaining = Number((Number(item.quantityRemaining) + qty).toFixed(3));

    const updateData: any = {
      quantityPurchased: newPurchased,
      quantityRemaining: newRemaining,
    };
    if (newCostPrice != null && newCostPrice >= 0) {
      updateData.currentCostPrice = Number(Number(newCostPrice).toFixed(2));
    }

    if (getDatabaseStatus()) {
      try {
        const updated = await prisma.item.update({
          where: { id: itemId },
          data: updateData,
          include: { supplier: true },
        });
        return {
          success: true,
          item: this.formatItemOutput(updated, updated.supplier?.shopName),
        };
      } catch (err: any) {
        console.error('Prisma restockItem error, falling back to memory:', err.message);
      }
    }

    const memItem = memoryItems.get(itemId);
    if (memItem) {
      memItem.quantityPurchased = newPurchased;
      memItem.quantityRemaining = newRemaining;
      if (updateData.currentCostPrice) {
        memItem.currentCostPrice = updateData.currentCostPrice;
      }
      memItem.updatedAt = new Date();
      return {
        success: true,
        item: this.formatItemOutput(memItem, memItem.supplierShopName),
      };
    }

    return { success: false, error: 'Item not found.' };
  }

  /**
   * Formats item data with real-time financial metrics (FR-3.7, Section 5.2)
   */
  private static formatItemOutput(item: any, supplierShopName?: string | null, threshold = 5): any {
    const cp = Number(item.currentCostPrice);
    const sp = Number(item.currentSellingPrice);
    const purchased = Number(item.quantityPurchased);
    const remaining = Number(item.quantityRemaining);

    const unitsSold = calculateUnitsSold(purchased, remaining);
    const profitPerUnit = calculateProfitPerUnit(cp, sp);
    const marginPct = calculateMarginPercentage(cp, sp);
    const profitEarned = calculateProfitEarned(cp, sp, purchased, remaining);
    const expectedProfit = calculateExpectedProfit(cp, sp, purchased);
    const totalCost = calculateTotalCost(cp, purchased);
    const isLowStock = remaining <= threshold;

    return {
      id: item.id,
      storeId: item.storeId,
      supplierId: item.supplierId || null,
      supplierShopName: supplierShopName || item.supplierShopName || 'No supplier',
      name: item.name,
      category: item.category,
      unit: item.unit,
      photoUrl: item.photoUrl || null,
      currentCostPrice: cp,
      currentSellingPrice: sp,
      quantityPurchased: purchased,
      quantityRemaining: remaining,
      unitsSold,
      profitPerUnit,
      marginPercentage: marginPct,
      profitEarned,
      expectedProfit,
      totalCost,
      isLowStock,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private static getMemoryItemsList(storeId: string, threshold: number, options: any): any[] {
    let list = Array.from(memoryItems.values()).filter((item) => item.storeId === storeId);
    if (options.category) {
      list = list.filter((i) => i.category === options.category);
    }
    if (options.search) {
      const q = options.search.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q));
    }
    return list.map((item) => this.formatItemOutput(item, item.supplierShopName, threshold));
  }

  static getRawMemoryItems(): ItemRecord[] {
    return Array.from(memoryItems.values());
  }

  static resetMemoryState() {
    memoryItems.clear();
  }
}


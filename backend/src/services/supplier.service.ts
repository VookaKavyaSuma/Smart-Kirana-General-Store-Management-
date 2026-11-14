import crypto from 'crypto';
import { prisma, getDatabaseStatus } from '../config/db.js';
import { calculateSupplierTotals, calculateProfitPerUnit, calculateMarginPercentage, calculateUnitsSold, calculateProfitEarned, calculateExpectedProfit, calculateTotalCost } from '../utils/profit.util.js';

export interface SupplierRecord {
  id: string;
  storeId: string;
  shopName: string;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// In-Memory store fallback
export const memorySuppliers = new Map<string, SupplierRecord>();

export class SupplierService {
  /**
   * Find existing or create new supplier by shop name for this store (FR-3.8, FR-5.1)
   */
  static async findOrCreateSupplier(
    storeId: string,
    rawShopName?: string | null
  ): Promise<SupplierRecord | null> {
    if (!rawShopName || !rawShopName.trim()) {
      return null; // "No supplier"
    }

    const shopName = rawShopName.trim();

    if (getDatabaseStatus()) {
      try {
        let supplier = await prisma.supplier.findFirst({
          where: {
            storeId,
            shopName: {
              equals: shopName,
              mode: 'insensitive',
            },
          },
        });

        if (!supplier) {
          supplier = await prisma.supplier.create({
            data: {
              id: crypto.randomUUID(),
              storeId,
              shopName,
            },
          });
        }

        return supplier;
      } catch (err: any) {
        console.error('Prisma findOrCreateSupplier error, falling back to memory:', err.message);
      }
    }

    // In-memory fallback
    const existing = Array.from(memorySuppliers.values()).find(
      (s) => s.storeId === storeId && s.shopName.toLowerCase() === shopName.toLowerCase()
    );

    if (existing) {
      return existing;
    }

    const newSupplier: SupplierRecord = {
      id: crypto.randomUUID(),
      storeId,
      shopName,
      phone: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memorySuppliers.set(newSupplier.id, newSupplier);
    return newSupplier;
  }

  /**
   * Create a supplier manually (FR-5.1)
   */
  static async createSupplier(
    storeId: string,
    shopName: string,
    phone?: string
  ): Promise<{ success: boolean; supplier?: SupplierRecord; error?: string }> {
    if (!shopName || !shopName.trim()) {
      return { success: false, error: 'Supplier shop name is required.' };
    }

    const trimmed = shopName.trim();

    if (getDatabaseStatus()) {
      try {
        const existing = await prisma.supplier.findFirst({
          where: {
            storeId,
            shopName: { equals: trimmed, mode: 'insensitive' },
          },
        });

        if (existing) {
          return { success: false, error: 'A supplier with this shop name already exists.' };
        }

        const supplier = await prisma.supplier.create({
          data: {
            id: crypto.randomUUID(),
            storeId,
            shopName: trimmed,
            phone: phone?.trim() || null,
          },
        });
        return { success: true, supplier };
      } catch (err: any) {
        console.error('Prisma createSupplier error, falling back to memory:', err.message);
      }
    }

    const existingMem = Array.from(memorySuppliers.values()).find(
      (s) => s.storeId === storeId && s.shopName.toLowerCase() === trimmed.toLowerCase()
    );
    if (existingMem) {
      return { success: false, error: 'A supplier with this shop name already exists.' };
    }

    const newSupplier: SupplierRecord = {
      id: crypto.randomUUID(),
      storeId,
      shopName: trimmed,
      phone: phone?.trim() || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memorySuppliers.set(newSupplier.id, newSupplier);
    return { success: true, supplier: newSupplier };
  }

  /**
   * List suppliers with their summary financials and metrics (FR-5.1, FR-5.7)
   */
  static async listSuppliersWithTotals(storeId: string, itemsList: any[]): Promise<any[]> {
    let suppliers: SupplierRecord[] = [];

    if (getDatabaseStatus()) {
      try {
        suppliers = await prisma.supplier.findMany({
          where: { storeId },
          orderBy: { shopName: 'asc' },
        });
      } catch (err: any) {
        console.error('Prisma listSuppliers error, falling back to memory:', err.message);
        suppliers = Array.from(memorySuppliers.values()).filter((s) => s.storeId === storeId);
      }
    } else {
      suppliers = Array.from(memorySuppliers.values()).filter((s) => s.storeId === storeId);
    }

    // Map each supplier with its calculated totals
    const result: any[] = suppliers.map((supplier) => {
      const supplierItems = itemsList.filter((item) => item.supplierId === supplier.id);
      const totals = calculateSupplierTotals(
        supplierItems.map((i) => ({
          quantityPurchased: Number(i.quantityPurchased),
          quantityRemaining: Number(i.quantityRemaining),
          costPrice: Number(i.currentCostPrice),
          sellingPrice: Number(i.currentSellingPrice),
        }))
      );

      return {
        id: supplier.id,
        shopName: supplier.shopName,
        phone: supplier.phone,
        createdAt: supplier.createdAt,
        isUnassigned: false,
        ...totals,
      };
    });

    // Also include "No supplier" summary if there are unassigned items
    const unassignedItems = itemsList.filter((item) => !item.supplierId);
    if (unassignedItems.length > 0) {
      const unassignedTotals = calculateSupplierTotals(
        unassignedItems.map((i) => ({
          quantityPurchased: Number(i.quantityPurchased),
          quantityRemaining: Number(i.quantityRemaining),
          costPrice: Number(i.currentCostPrice),
          sellingPrice: Number(i.currentSellingPrice),
        }))
      );

      result.push({
        id: 'no-supplier',
        shopName: 'No supplier',
        phone: null,
        createdAt: new Date(),
        isUnassigned: true,
        ...unassignedTotals,
      });
    }

    return result;
  }

  /**
   * Get single supplier detail with all items and financial breakdown (FR-5.7)
   */
  static async getSupplierDetail(storeId: string, supplierId: string, itemsList: any[]): Promise<any | null> {
    let supplier: SupplierRecord | null = null;

    if (supplierId === 'no-supplier') {
      supplier = {
        id: 'no-supplier',
        storeId,
        shopName: 'No supplier',
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } else if (getDatabaseStatus()) {
      try {
        supplier = await prisma.supplier.findFirst({
          where: { id: supplierId, storeId },
        });
      } catch (err: any) {
        supplier = memorySuppliers.get(supplierId) || null;
      }
    } else {
      supplier = memorySuppliers.get(supplierId) || null;
    }

    if (!supplier) {
      return null;
    }

    // Filter items belonging to this supplier
    const supplierItems = itemsList.filter((item) =>
      supplierId === 'no-supplier' ? !item.supplierId : item.supplierId === supplierId
    );

    // Compute detailed item breakdown
    const detailedItems = supplierItems.map((item) => {
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

      return {
        id: item.id,
        name: item.name,
        category: item.category,
        unit: item.unit,
        photoUrl: item.photoUrl,
        quantityPurchased: purchased,
        quantityRemaining: remaining,
        unitsSold,
        costPrice: cp,
        sellingPrice: sp,
        profitPerUnit,
        marginPercentage: marginPct,
        profitEarned,
        expectedProfit,
        totalCost,
      };
    });

    const totals = calculateSupplierTotals(
      supplierItems.map((i) => ({
        quantityPurchased: Number(i.quantityPurchased),
        quantityRemaining: Number(i.quantityRemaining),
        costPrice: Number(i.currentCostPrice),
        sellingPrice: Number(i.currentSellingPrice),
      }))
    );

    return {
      supplier,
      items: detailedItems,
      totals,
    };
  }

  static resetMemoryState() {
    memorySuppliers.clear();
  }
}

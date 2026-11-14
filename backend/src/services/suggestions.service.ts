import { prisma, getDatabaseStatus } from '../config/db.js';
import { SUGGESTIONS_CONFIG } from '../config/suggestions.config.js';
import {
  calculateProfitPerUnit,
  calculateMarginPercentage,
  calculateUnitsSold,
} from '../utils/profit.util.js';
import { ItemService, memoryItems, memoryStockAdjustments } from './item.service.js';
import { memoryPurchases } from './purchase.service.js';
import { memoryCreditEntries, memoryCustomers } from './credit.service.js';
import { memorySuppliers } from './supplier.service.js';

export type SuggestionPeriod = 'last_30_days' | 'last_90_days' | 'all_time';

export interface CheapestSupplierInfo {
  hasMultipleSuppliers: boolean;
  supplierId: string;
  supplierName: string;
  costPrice: number;
  highestCostPrice?: number;
  savingsPerUnit?: number;
}

export interface SuggestedItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  photoUrl: string | null;
  costPrice: number;
  sellingPrice: number;
  profitPerUnit: number;
  marginPercent: number;
  quantityRemaining: number;
  quantityPurchased: number;
  unitsSoldInPeriod: number;
  profitEarnedInPeriod: number;
  unitsSoldPerWeek: number;
  stockValue: number;
  score: number; // 0 to 100
  reason: string;
  supplierName: string;
  cheapestSupplier?: CheapestSupplierInfo | null;
  stockRunoutDays?: number | null;
}

export interface SuggestionsResponse {
  period: SuggestionPeriod;
  totalItems: number;
  worthBuyingMore: SuggestedItem[];
  fastSellingRunningLow: SuggestedItem[];
  lowProfitOrSlow: SuggestedItem[];
  allRanked: SuggestedItem[];
  weightsUsed: {
    margin: number;
    totalProfit: number;
    unitsPerWeek: number;
  };
}

export class SuggestionsService {
  /**
   * Calculate suggestions and rank items based on the period (FR-9.1 to FR-9.6)
   */
  static async getSuggestions(
    storeId: string,
    period: SuggestionPeriod = 'last_30_days'
  ): Promise<SuggestionsResponse> {
    const weights = SUGGESTIONS_CONFIG.WEIGHTS;

    // 1. Fetch all items for this store
    let rawItems: any[] = [];
    if (getDatabaseStatus()) {
      try {
        rawItems = await prisma.item.findMany({
          where: { storeId },
          include: { supplier: true },
        });
      } catch (err: any) {
        console.error('Prisma getSuggestions items error, using memory:', err.message);
      }
    }

    if (rawItems.length === 0) {
      rawItems = Array.from(memoryItems.values()).filter((i) => i.storeId === storeId);
    }

    // Handle empty store without error
    if (rawItems.length === 0) {
      return {
        period,
        totalItems: 0,
        worthBuyingMore: [],
        fastSellingRunningLow: [],
        lowProfitOrSlow: [],
        allRanked: [],
        weightsUsed: {
          margin: weights.MARGIN,
          totalProfit: weights.TOTAL_PROFIT,
          unitsPerWeek: weights.UNITS_PER_WEEK,
        },
      };
    }

    // Determine low stock threshold
    let lowStockThreshold = 5;
    if (getDatabaseStatus()) {
      try {
        const store = await prisma.store.findUnique({
          where: { id: storeId },
          select: { lowStockThreshold: true },
        });
        if (store) lowStockThreshold = Number(store.lowStockThreshold);
      } catch (_) {}
    }

    // 2. Determine period dates and weeks
    const now = new Date();
    let startDate: Date | null = null;
    let weeksInPeriod = 4.286; // default ~30 days

    if (period === 'last_30_days') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      weeksInPeriod = 30 / 7;
    } else if (period === 'last_90_days') {
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      weeksInPeriod = 90 / 7;
    } else {
      // all_time
      weeksInPeriod = 12.0; // standard quarter baseline for rate
    }

    // 3. For each item, compute period metrics and multi-supplier price check
    const itemsData: Array<{
      item: any;
      marginPercent: number;
      unitsSoldInPeriod: number;
      profitEarnedInPeriod: number;
      unitsSoldPerWeek: number;
      stockValue: number;
      cheapestSupplier: CheapestSupplierInfo | null;
    }> = [];

    for (const item of rawItems) {
      const cp = Number(item.currentCostPrice ?? item.costPrice ?? 0);
      const sp = Number(item.currentSellingPrice ?? item.sellingPrice ?? 0);
      const remaining = Number(item.quantityRemaining ?? 0);
      const purchased = Number(item.quantityPurchased ?? 0);
      const margin = calculateMarginPercentage(cp, sp);
      const profitPerUnit = calculateProfitPerUnit(cp, sp);
      const stockVal = Number((remaining * cp).toFixed(2));

      // Compute sales within period
      let soldInPeriod = 0;
      let profitInPeriod = 0;

      // 3.a Stock Adjustments
      if (getDatabaseStatus()) {
        try {
          const adjustments = await prisma.stockAdjustment.findMany({
            where: {
              itemId: item.id,
              unitsChanged: { lt: 0 },
              ...(startDate ? { date: { gte: startDate } } : {}),
            },
          });
          for (const adj of adjustments) {
            const sold = Math.abs(Number(adj.unitsChanged));
            soldInPeriod += sold;
            profitInPeriod += sold * profitPerUnit;
          }
        } catch (_) {}
      } else {
        for (const adj of memoryStockAdjustments) {
          if (adj.itemId === item.id && adj.unitsChanged < 0) {
            const adjDate = new Date(adj.date);
            if (!startDate || adjDate >= startDate) {
              const sold = Math.abs(adj.unitsChanged);
              soldInPeriod += sold;
              profitInPeriod += sold * profitPerUnit;
            }
          }
        }
      }

      // 3.b Credit Entries
      if (getDatabaseStatus()) {
        try {
          const creditEntries = await prisma.creditEntry.findMany({
            where: {
              itemId: item.id,
              ...(startDate ? { dateTaken: { gte: startDate } } : {}),
            },
          });
          for (const ce of creditEntries) {
            const qty = Number(ce.quantity);
            const prof = Number(ce.totalAmount) - qty * Number(ce.costPrice);
            soldInPeriod += qty;
            profitInPeriod += prof;
          }
        } catch (_) {}
      } else {
        for (const ce of memoryCreditEntries.values()) {
          if (ce.itemId === item.id) {
            const ceDate = new Date(ce.dateTaken);
            if (!startDate || ceDate >= startDate) {
              soldInPeriod += ce.quantity;
              profitInPeriod += ce.totalAmount - ce.quantity * ce.costPrice;
            }
          }
        }
      }

      // 3.c Fallback: If no explicit adjustments found
      if (soldInPeriod === 0) {
        const totalSold = calculateUnitsSold(purchased, remaining);
        if (period === 'all_time') {
          soldInPeriod = totalSold;
          profitInPeriod = Number((totalSold * profitPerUnit).toFixed(2));
        } else {
          // If item was created within the window, use total sold
          const createdAt = new Date(item.createdAt);
          if (startDate && createdAt >= startDate) {
            soldInPeriod = totalSold;
            profitInPeriod = Number((totalSold * profitPerUnit).toFixed(2));
          }
        }
      }

      // Compute units per week
      let effectiveWeeks = weeksInPeriod;
      if (period === 'all_time') {
        const itemCreated = new Date(item.createdAt || now);
        const daysOld = Math.max(7, Math.ceil((now.getTime() - itemCreated.getTime()) / (24 * 60 * 60 * 1000)));
        effectiveWeeks = Math.max(1, daysOld / 7);
      }
      const unitsSoldPerWeek = Number((soldInPeriod / effectiveWeeks).toFixed(2));

      // 3.d Find cheapest supplier (FR-9.6)
      const cheapestSupplier = await this.findCheapestSupplierForItem(storeId, item.id, cp, item.supplierId);

      itemsData.push({
        item,
        marginPercent: margin,
        unitsSoldInPeriod: Number(soldInPeriod.toFixed(3)),
        profitEarnedInPeriod: Number(profitInPeriod.toFixed(2)),
        unitsSoldPerWeek,
        stockValue: stockVal,
        cheapestSupplier,
      });
    }

    // 4. Normalization across items for scoring (FR-9.2)
    // Extract min/max values
    let minMargin = Infinity, maxMargin = -Infinity;
    let minProfit = Infinity, maxProfit = -Infinity;
    let minVelocity = Infinity, maxVelocity = -Infinity;

    for (const d of itemsData) {
      if (d.marginPercent < minMargin) minMargin = d.marginPercent;
      if (d.marginPercent > maxMargin) maxMargin = d.marginPercent;

      if (d.profitEarnedInPeriod < minProfit) minProfit = d.profitEarnedInPeriod;
      if (d.profitEarnedInPeriod > maxProfit) maxProfit = d.profitEarnedInPeriod;

      if (d.unitsSoldPerWeek < minVelocity) minVelocity = d.unitsSoldPerWeek;
      if (d.unitsSoldPerWeek > maxVelocity) maxVelocity = d.unitsSoldPerWeek;
    }

    const normalize = (val: number, min: number, max: number): number => {
      if (max === min) return val > 0 ? 1 : 0;
      return Math.max(0, Math.min(1, (val - min) / (max - min)));
    };

    // 5. Score items & generate dynamic one-line reason (FR-9.2, FR-9.4)
    const scoredItems: SuggestedItem[] = itemsData.map((d) => {
      const it = d.item;
      const cp = Number(it.currentCostPrice ?? it.costPrice ?? 0);
      const sp = Number(it.currentSellingPrice ?? it.sellingPrice ?? 0);
      const remaining = Number(it.quantityRemaining ?? 0);
      const purchased = Number(it.quantityPurchased ?? 0);
      const profitPerUnit = calculateProfitPerUnit(cp, sp);

      const normMargin = normalize(d.marginPercent, minMargin, maxMargin);
      const normProfit = normalize(d.profitEarnedInPeriod, minProfit, maxProfit);
      const normVelocity = normalize(d.unitsSoldPerWeek, minVelocity, maxVelocity);

      // Score = 0.4 * normMargin + 0.4 * normProfit + 0.2 * normVelocity
      const rawScore =
        weights.MARGIN * normMargin +
        weights.TOTAL_PROFIT * normProfit +
        weights.UNITS_PER_WEEK * normVelocity;
      const score = Number((rawScore * 100).toFixed(1));

      // Days of stock remaining based on weekly velocity
      let stockRunoutDays: number | null = null;
      if (d.unitsSoldPerWeek > 0) {
        const dailyBurn = d.unitsSoldPerWeek / 7;
        stockRunoutDays = Math.ceil(remaining / dailyBurn);
      }

      // Dynamic one-line reason (FR-9.4)
      const periodLabel =
        period === 'last_30_days' ? 'this month' : period === 'last_90_days' ? 'last 90 days' : 'all time';

      let reason = '';
      if (d.unitsSoldInPeriod > 0) {
        reason = `Margin ${d.marginPercent}%, sold ${d.unitsSoldInPeriod} units ${periodLabel} (Profit: ₹${d.profitEarnedInPeriod})`;
      } else {
        reason = `Margin ${d.marginPercent}%, 0 units sold ${periodLabel} with ₹${d.stockValue} stock`;
      }

      const supplierName = it.supplier?.shopName || it.supplierShopName || 'No supplier';

      return {
        id: it.id,
        name: it.name,
        category: it.category,
        unit: it.unit,
        photoUrl: it.photoUrl || null,
        costPrice: cp,
        sellingPrice: sp,
        profitPerUnit,
        marginPercent: d.marginPercent,
        quantityRemaining: remaining,
        quantityPurchased: purchased,
        unitsSoldInPeriod: d.unitsSoldInPeriod,
        profitEarnedInPeriod: d.profitEarnedInPeriod,
        unitsSoldPerWeek: d.unitsSoldPerWeek,
        stockValue: d.stockValue,
        score,
        reason,
        supplierName,
        cheapestSupplier: d.cheapestSupplier,
        stockRunoutDays,
      };
    });

    // Sort all ranked items by score descending
    scoredItems.sort((a, b) => b.score - a.score);

    // 6. Partition into the Three Lists (FR-9.3)
    // List 1: Items worth buying more of
    // Score >= 50 or top scoring items with good margin & sales
    const worthBuyingMore: SuggestedItem[] = scoredItems
      .filter((i) => i.score >= SUGGESTIONS_CONFIG.THRESHOLDS.WORTH_BUYING_SCORE || i.marginPercent >= 20)
      .map((item) => ({
        ...item,
        reason: `Top performer: Margin ${item.marginPercent}%, sold ${item.unitsSoldInPeriod} units (Score: ${item.score}/100)`,
      }))
      .slice(0, 10);

    // List 2: Fast-selling items running low
    // Velocity >= threshold or in top velocity, and quantityRemaining <= threshold
    const fastSellingRunningLow: SuggestedItem[] = scoredItems
      .filter(
        (i) =>
          (i.unitsSoldPerWeek >= SUGGESTIONS_CONFIG.THRESHOLDS.FAST_SELLING_VELOCITY || i.unitsSoldInPeriod > 0) &&
          (i.quantityRemaining <= lowStockThreshold || (i.stockRunoutDays !== null && i.stockRunoutDays <= 14))
      )
      .sort((a, b) => (a.stockRunoutDays ?? 999) - (b.stockRunoutDays ?? 999))
      .map((item) => ({
        ...item,
        reason: `Fast seller (${item.unitsSoldPerWeek} units/wk) with only ${item.quantityRemaining} ${item.unit} left${
          item.stockRunoutDays != null ? ` (~${item.stockRunoutDays} days left)` : ''
        }`,
      }))
      .slice(0, 10);

    // List 3: Low-profit or slow items to review
    // Low margin OR slow velocity
    const lowProfitOrSlow: SuggestedItem[] = scoredItems
      .filter(
        (i) =>
          i.marginPercent <= SUGGESTIONS_CONFIG.THRESHOLDS.LOW_MARGIN_PERCENT ||
          i.unitsSoldPerWeek <= SUGGESTIONS_CONFIG.THRESHOLDS.SLOW_VELOCITY ||
          i.score < 35
      )
      .sort((a, b) => a.score - b.score)
      .map((item) => ({
        ...item,
        reason:
          item.unitsSoldInPeriod === 0
            ? `Slow mover: 0 units sold in period with ₹${item.stockValue} stock tied up`
            : `Low margin (${item.marginPercent}%) and low velocity (${item.unitsSoldPerWeek} units/week)`,
      }))
      .slice(0, 10);

    return {
      period,
      totalItems: scoredItems.length,
      worthBuyingMore,
      fastSellingRunningLow,
      lowProfitOrSlow,
      allRanked: scoredItems,
      weightsUsed: {
        margin: weights.MARGIN,
        totalProfit: weights.TOTAL_PROFIT,
        unitsPerWeek: weights.UNITS_PER_WEEK,
      },
    };
  }

  /**
   * Helper: Check if item was bought from multiple suppliers and identify cheapest supplier (FR-9.6)
   */
  static async findCheapestSupplierForItem(
    storeId: string,
    itemId: string,
    currentCostPrice: number,
    primarySupplierId: string | null
  ): Promise<CheapestSupplierInfo | null> {
    const supplierPrices = new Map<string, { supplierId: string; supplierName: string; costPrice: number }>();

    // 1. Check primary supplier from item
    if (primarySupplierId) {
      let supName = 'Primary Supplier';
      if (getDatabaseStatus()) {
        try {
          const sup = await prisma.supplier.findUnique({ where: { id: primarySupplierId } });
          if (sup) supName = sup.shopName;
        } catch (_) {}
      } else {
        const sup = memorySuppliers.get(primarySupplierId);
        if (sup) supName = sup.shopName;
      }
      supplierPrices.set(primarySupplierId, {
        supplierId: primarySupplierId,
        supplierName: supName,
        costPrice: currentCostPrice,
      });
    }

    // 2. Check purchase items across purchases (FR-9.6)
    if (getDatabaseStatus()) {
      try {
        const purchaseItems = await prisma.purchaseItem.findMany({
          where: { itemId, purchase: { storeId } },
          include: { purchase: { include: { supplier: true } } },
        });

        for (const pi of purchaseItems) {
          const sId = pi.purchase.supplierId;
          const sName = pi.purchase.supplier?.shopName;
          if (sId && sName) {
            const price = Number(pi.costPrice);
            if (!supplierPrices.has(sId) || price < supplierPrices.get(sId)!.costPrice) {
              supplierPrices.set(sId, {
                supplierId: sId,
                supplierName: sName,
                costPrice: price,
              });
            }
          }
        }
      } catch (_) {}
    } else {
      // Memory check
      for (const pur of memoryPurchases.values()) {
        if (pur.storeId === storeId && pur.supplierId) {
          const line = pur.items.find((i) => i.itemId === itemId);
          if (line) {
            const sId = pur.supplierId;
            const sName = pur.supplierShopName || 'Wholesaler';
            const price = Number(line.costPrice);
            if (!supplierPrices.has(sId) || price < supplierPrices.get(sId)!.costPrice) {
              supplierPrices.set(sId, {
                supplierId: sId,
                supplierName: sName,
                costPrice: price,
              });
            }
          }
        }
      }
    }

    // If bought from only 1 or 0 suppliers, FR-9.6 only applies when bought from > 1 supplier
    if (supplierPrices.size <= 1) {
      return null;
    }

    // Find supplier with minimum cost price
    const suppliers = Array.from(supplierPrices.values());
    suppliers.sort((a, b) => a.costPrice - b.costPrice);

    const cheapest = suppliers[0];
    const mostExpensive = suppliers[suppliers.length - 1];
    const savings = Number((mostExpensive.costPrice - cheapest.costPrice).toFixed(2));

    return {
      hasMultipleSuppliers: true,
      supplierId: cheapest.supplierId,
      supplierName: cheapest.supplierName,
      costPrice: cheapest.costPrice,
      highestCostPrice: mostExpensive.costPrice,
      savingsPerUnit: savings > 0 ? savings : 0,
    };
  }
}


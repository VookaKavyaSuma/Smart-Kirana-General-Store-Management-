import { prisma, getDatabaseStatus } from '../config/db.js';
import {
  calculateProfitPerUnit,
  calculateMarginPercentage,
  calculateUnitsSold,
  calculateProfitEarned,
  calculateExpectedProfit,
  calculateTotalCost,
} from '../utils/profit.util.js';
import { ItemService, memoryItems, memoryStockAdjustments } from './item.service.js';
import { SupplierService, memorySuppliers } from './supplier.service.js';
import { CreditService, memoryCustomers, memoryCreditEntries, memoryCreditPayments } from './credit.service.js';
import { OnlineService, memoryDailyOnlineEntries, memorySupplierPayments } from './online.service.js';

export interface DashboardMetrics {
  overallCost: number;
  totalItems: number;
  totalPurchasedUnits: number;
  quantityRemaining: number;
  stockValue: number;
  expectedProfit: number;
  profitEarned: number;
  totalCreditDue: number;
  remainingOnlineAmount: number;
  lowStockCount: number;
}

export interface ItemProfitMetric {
  id: string;
  name: string;
  category: string;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  profitPerUnit: number;
  marginPercent: number;
  quantityPurchased: number;
  quantityRemaining: number;
  unitsSold: number;
  profitEarned: number;
  expectedProfit: number;
  stockValue: number;
  supplierId: string | null;
  supplierName: string;
}

export interface SupplierProfitMetric {
  id: string;
  shopName: string;
  itemCount: number;
  totalPurchasedUnits: number;
  totalUnitsSold: number;
  totalSpent: number;
  profitEarned: number;
  expectedProfit: number;
  totalPaidOnline: number;
}

export interface MonthlyComparison {
  selectedMonth: string; // YYYY-MM
  previousMonth: string; // YYYY-MM
  selectedMonthProfit: number;
  previousMonthProfit: number;
  difference: number;
  percentageChange: number;
  trend: 'UP' | 'DOWN' | 'EQUAL';
  monthlyHistory: Array<{
    month: string;
    profitEarned: number;
    unitsSold: number;
  }>;
}

export interface FullReportData {
  metrics: DashboardMetrics;
  itemRankings: {
    maxProfitItem: ItemProfitMetric | null;
    minProfitItem: ItemProfitMetric | null;
    rankedItems: ItemProfitMetric[];
  };
  supplierBreakdown: {
    maxProfitSupplier: SupplierProfitMetric | null;
    minProfitSupplier: SupplierProfitMetric | null;
    suppliers: SupplierProfitMetric[];
  };
  monthlyComparison: MonthlyComparison;
}

export class ReportService {
  /**
   * Reset in-memory state for report tests
   */
  static resetMemoryState() {
    memoryStockAdjustments.length = 0;
  }

  /**
   * Helper: calculate previous month string (YYYY-MM -> YYYY-MM)
   */
  static getPreviousMonth(monthStr: string): string {
    const [year, month] = monthStr.split('-').map(Number);
    if (month === 1) {
      return `${year - 1}-12`;
    }
    const prevMonth = month - 1;
    return `${year}-${prevMonth < 10 ? '0' : ''}${prevMonth}`;
  }

  /**
   * Helper: get current month string (YYYY-MM)
   */
  static getCurrentMonth(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    return `${y}-${m < 10 ? '0' : ''}${m}`;
  }

  /**
   * 1. Dashboard summary metrics (FR-8.1, FR-8.8)
   */
  static async getDashboardMetrics(storeId: string): Promise<DashboardMetrics> {
    const itemMetrics = await this.getAllItemMetrics(storeId);

    let overallCost = 0;
    let totalPurchasedUnits = 0;
    let quantityRemaining = 0;
    let stockValue = 0;
    let expectedProfit = 0;
    let profitEarned = 0;

    for (const item of itemMetrics) {
      overallCost += item.quantityPurchased * item.costPrice;
      totalPurchasedUnits += item.quantityPurchased;
      quantityRemaining += item.quantityRemaining;
      stockValue += item.stockValue;
      expectedProfit += item.expectedProfit;
      profitEarned += item.profitEarned;
    }

    // Credit Due from Customers (FR-10.7, FR-8.8)
    const creditList = await CreditService.getCustomers(storeId);
    const totalCreditDue = creditList.totalCreditDue || 0;

    // Remaining Online Balance (FR-11.5, FR-8.8)
    const onlineSummary = await OnlineService.getSummary(storeId);
    const remainingOnlineAmount = onlineSummary.remainingOnlineAmount || 0;

    // Low stock count (FR-3.7)
    let lowStockThreshold = 5;
    if (getDatabaseStatus()) {
      try {
        const store = await prisma.store.findUnique({
          where: { id: storeId },
          select: { lowStockThreshold: true },
        });
        if (store) lowStockThreshold = Number(store.lowStockThreshold);
      } catch (err: any) {
        console.error('Prisma store threshold error:', err.message);
      }
    }

    const lowStockCount = itemMetrics.filter((i) => i.quantityRemaining <= lowStockThreshold).length;

    return {
      overallCost: Number(overallCost.toFixed(2)),
      totalItems: itemMetrics.length,
      totalPurchasedUnits: Number(totalPurchasedUnits.toFixed(3)),
      quantityRemaining: Number(quantityRemaining.toFixed(3)),
      stockValue: Number(stockValue.toFixed(2)),
      expectedProfit: Number(expectedProfit.toFixed(2)),
      profitEarned: Number(profitEarned.toFixed(2)),
      totalCreditDue: Number(totalCreditDue.toFixed(2)),
      remainingOnlineAmount: Number(remainingOnlineAmount.toFixed(2)),
      lowStockCount,
    };
  }

  /**
   * Helper: Get computed metrics for all items of a store (FR-8.2)
   */
  static async getAllItemMetrics(storeId: string): Promise<ItemProfitMetric[]> {
    let rawItems: any[] = [];

    if (getDatabaseStatus()) {
      try {
        rawItems = await prisma.item.findMany({
          where: { storeId },
          include: { supplier: true },
        });
      } catch (err: any) {
        console.error('Prisma get items error, falling back to memory:', err.message);
      }
    }

    if (rawItems.length === 0) {
      rawItems = Array.from(memoryItems.values()).filter((i) => i.storeId === storeId);
    }

    return rawItems.map((item) => {
      const cp = Number(item.currentCostPrice ?? item.costPrice ?? 0);
      const sp = Number(item.currentSellingPrice ?? item.sellingPrice ?? 0);
      const purchased = Number(item.quantityPurchased ?? 0);
      const remaining = Number(item.quantityRemaining ?? 0);
      const unitsSold = calculateUnitsSold(purchased, remaining);

      const profitPerUnit = calculateProfitPerUnit(cp, sp);
      const marginPercent = calculateMarginPercentage(cp, sp);
      const itemProfitEarned = Number((unitsSold * profitPerUnit).toFixed(2));
      const itemExpectedProfit = Number((purchased * profitPerUnit).toFixed(2));
      const stockVal = Number((remaining * cp).toFixed(2));

      return {
        id: item.id,
        name: item.name,
        category: item.category,
        unit: item.unit,
        costPrice: cp,
        sellingPrice: sp,
        profitPerUnit,
        marginPercent,
        quantityPurchased: purchased,
        quantityRemaining: remaining,
        unitsSold,
        profitEarned: itemProfitEarned,
        expectedProfit: itemExpectedProfit,
        stockValue: stockVal,
        supplierId: item.supplierId || null,
        supplierName: item.supplier?.shopName || item.supplierShopName || 'No supplier',
      };
    });
  }

  /**
   * 2. Item Profit Rankings with Max & Min Profit items (FR-8.2, FR-8.3)
   */
  static async getItemProfitRankings(storeId: string): Promise<{
    maxProfitItem: ItemProfitMetric | null;
    minProfitItem: ItemProfitMetric | null;
    rankedItems: ItemProfitMetric[];
  }> {
    const items = await this.getAllItemMetrics(storeId);

    if (items.length === 0) {
      return {
        maxProfitItem: null,
        minProfitItem: null,
        rankedItems: [],
      };
    }

    // Sort by profit earned descending; tie-break by expected profit, then name
    const sorted = [...items].sort((a, b) => {
      if (b.profitEarned !== a.profitEarned) {
        return b.profitEarned - a.profitEarned;
      }
      if (b.expectedProfit !== a.expectedProfit) {
        return b.expectedProfit - a.expectedProfit;
      }
      return a.name.localeCompare(b.name);
    });

    const maxProfitItem = sorted[0];
    const minProfitItem = sorted[sorted.length - 1];

    return {
      maxProfitItem,
      minProfitItem,
      rankedItems: sorted,
    };
  }

  /**
   * 3. Supplier-wise profit with Max & Min supplier and total spent (FR-8.4, FR-8.6)
   */
  static async getSupplierProfitBreakdown(storeId: string): Promise<{
    maxProfitSupplier: SupplierProfitMetric | null;
    minProfitSupplier: SupplierProfitMetric | null;
    suppliers: SupplierProfitMetric[];
  }> {
    const itemMetrics = await this.getAllItemMetrics(storeId);

    // Get all suppliers for store
    let supplierList: any[] = [];
    if (getDatabaseStatus()) {
      try {
        supplierList = await prisma.supplier.findMany({
          where: { storeId },
        });
      } catch (err: any) {
        console.error('Prisma suppliers list error, falling back to memory:', err.message);
      }
    }

    if (supplierList.length === 0) {
      supplierList = Array.from(memorySuppliers.values()).filter((s) => s.storeId === storeId);
    }

    // Build map for each supplier
    const supplierMap = new Map<string, SupplierProfitMetric>();
    for (const s of supplierList) {
      supplierMap.set(s.id, {
        id: s.id,
        shopName: s.shopName,
        itemCount: 0,
        totalPurchasedUnits: 0,
        totalUnitsSold: 0,
        totalSpent: 0,
        profitEarned: 0,
        expectedProfit: 0,
        totalPaidOnline: 0,
      });
    }

    // Fetch total paid online per supplier (FR-11.9, FR-8.6)
    for (const [sId, sMetric] of supplierMap.entries()) {
      const onlineTotal = await OnlineService.getTotalPaidOnlineToSupplier(storeId, sId);
      sMetric.totalPaidOnline = onlineTotal;
    }

    // Accumulate items for each supplier
    for (const item of itemMetrics) {
      if (item.supplierId && supplierMap.has(item.supplierId)) {
        const s = supplierMap.get(item.supplierId)!;
        s.itemCount += 1;
        s.totalPurchasedUnits += item.quantityPurchased;
        s.totalUnitsSold += item.unitsSold;
        s.totalSpent += item.quantityPurchased * item.costPrice;
        s.profitEarned += item.profitEarned;
        s.expectedProfit += item.expectedProfit;
      }
    }

    // Format decimals
    const suppliers: SupplierProfitMetric[] = Array.from(supplierMap.values()).map((s) => ({
      ...s,
      totalPurchasedUnits: Number(s.totalPurchasedUnits.toFixed(3)),
      totalUnitsSold: Number(s.totalUnitsSold.toFixed(3)),
      totalSpent: Number(s.totalSpent.toFixed(2)),
      profitEarned: Number(s.profitEarned.toFixed(2)),
      expectedProfit: Number(s.expectedProfit.toFixed(2)),
      totalPaidOnline: Number(s.totalPaidOnline.toFixed(2)),
    }));

    if (suppliers.length === 0) {
      return {
        maxProfitSupplier: null,
        minProfitSupplier: null,
        suppliers: [],
      };
    }

    // Sort by profit earned descending
    suppliers.sort((a, b) => {
      if (b.profitEarned !== a.profitEarned) {
        return b.profitEarned - a.profitEarned;
      }
      return b.totalSpent - a.totalSpent;
    });

    const maxProfitSupplier = suppliers[0];
    const minProfitSupplier = suppliers[suppliers.length - 1];

    return {
      maxProfitSupplier,
      minProfitSupplier,
      suppliers,
    };
  }

  /**
   * 4. Monthly Profit Analysis & Comparison (FR-8.5)
   */
  static async getMonthlyProfitReport(storeId: string, inputMonth?: string): Promise<MonthlyComparison> {
    const selectedMonth = inputMonth && /^\d{4}-\d{2}$/.test(inputMonth) ? inputMonth : this.getCurrentMonth();
    const previousMonth = this.getPreviousMonth(selectedMonth);

    // Compute profit for a given YYYY-MM
    const calculateMonthProfit = async (yearMonth: string) => {
      const [year, month] = yearMonth.split('-').map(Number);
      const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
      const endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0));

      let monthProfit = 0;
      let monthUnitsSold = 0;

      // 1. Stock adjustments (QUICK_SOLD, MANUAL_COUNT reduction)
      if (getDatabaseStatus()) {
        try {
          const adjustments = await prisma.stockAdjustment.findMany({
            where: {
              date: { gte: startDate, lt: endDate },
              unitsChanged: { lt: 0 },
              item: { storeId },
            },
            include: { item: true },
          });

          for (const adj of adjustments) {
            const sold = Math.abs(Number(adj.unitsChanged));
            const cp = Number(adj.item.currentCostPrice);
            const sp = Number(adj.item.currentSellingPrice);
            monthUnitsSold += sold;
            monthProfit += sold * (sp - cp);
          }
        } catch (err: any) {
          console.error('Prisma monthly adjustments error:', err.message);
        }
      }

      // In-memory stock adjustments
      const memItemsForStore = new Set(
        Array.from(memoryItems.values())
          .filter((i) => i.storeId === storeId)
          .map((i) => i.id)
      );

      for (const adj of memoryStockAdjustments) {
        if (memItemsForStore.has(adj.itemId) && adj.unitsChanged < 0) {
          const adjDate = new Date(adj.date);
          if (adjDate >= startDate && adjDate < endDate) {
            const item = memoryItems.get(adj.itemId);
            if (item) {
              const sold = Math.abs(adj.unitsChanged);
              const cp = Number(item.currentCostPrice);
              const sp = Number(item.currentSellingPrice);
              monthUnitsSold += sold;
              monthProfit += sold * (sp - cp);
            }
          }
        }
      }

      // 2. Customer Credit Entries taken in this month (FR-10.4: profit counts on date taken)
      if (getDatabaseStatus()) {
        try {
          const creditEntries = await prisma.creditEntry.findMany({
            where: {
              dateTaken: { gte: startDate, lt: endDate },
              customer: { storeId },
            },
          });
          for (const ce of creditEntries) {
            const profit = Number(ce.totalAmount) - Number(ce.quantity) * Number(ce.costPrice);
            monthProfit += profit;
            monthUnitsSold += Number(ce.quantity);
          }
        } catch (err: any) {
          console.error('Prisma monthly credit entries error:', err.message);
        }
      }

      // In-memory credit entries
      const memCustomersForStore = new Set(
        Array.from(memoryCustomers.values())
          .filter((c) => c.storeId === storeId)
          .map((c) => c.id)
      );

      for (const ce of memoryCreditEntries.values()) {
        if (memCustomersForStore.has(ce.customerId)) {
          const ceDate = new Date(ce.dateTaken);
          if (ceDate >= startDate && ceDate < endDate) {
            const profit = Number(ce.totalAmount) - Number(ce.quantity) * Number(ce.costPrice);
            monthProfit += profit;
            monthUnitsSold += Number(ce.quantity);
          }
        }
      }

      // Fallback: If no explicit adjustment records exist in this month, but an item with unitsSold was created in this month
      if (monthUnitsSold === 0) {
        const allItems = await this.getAllItemMetrics(storeId);
        for (const it of allItems) {
          if (it.unitsSold > 0) {
            // Check item creation date in database or memory
            let itemCreatedAt: Date | null = null;
            if (getDatabaseStatus()) {
              try {
                const dbItem = await prisma.item.findUnique({ where: { id: it.id }, select: { createdAt: true } });
                if (dbItem) itemCreatedAt = dbItem.createdAt;
              } catch (_) {}
            }
            if (!itemCreatedAt) {
              const memIt = memoryItems.get(it.id);
              if (memIt) itemCreatedAt = memIt.createdAt;
            }

            if (itemCreatedAt && itemCreatedAt >= startDate && itemCreatedAt < endDate) {
              monthProfit += it.profitEarned;
              monthUnitsSold += it.unitsSold;
            }
          }
        }
      }

      return {
        profit: Number(monthProfit.toFixed(2)),
        unitsSold: Number(monthUnitsSold.toFixed(3)),
      };
    };

    const currentResult = await calculateMonthProfit(selectedMonth);
    const previousResult = await calculateMonthProfit(previousMonth);

    const selectedMonthProfit = currentResult.profit;
    const previousMonthProfit = previousResult.profit;
    const difference = Number((selectedMonthProfit - previousMonthProfit).toFixed(2));

    let percentageChange = 0;
    if (previousMonthProfit > 0) {
      percentageChange = Number((((selectedMonthProfit - previousMonthProfit) / previousMonthProfit) * 100).toFixed(2));
    } else if (selectedMonthProfit > 0) {
      percentageChange = 100;
    }

    let trend: 'UP' | 'DOWN' | 'EQUAL' = 'EQUAL';
    if (difference > 0) trend = 'UP';
    else if (difference < 0) trend = 'DOWN';

    // Generate 6-month history ending at selectedMonth
    const monthlyHistory: Array<{ month: string; profitEarned: number; unitsSold: number }> = [];
    let curM = selectedMonth;
    const monthsQueue = [curM];
    for (let i = 1; i < 6; i++) {
      curM = this.getPreviousMonth(curM);
      monthsQueue.unshift(curM);
    }

    for (const mStr of monthsQueue) {
      if (mStr === selectedMonth) {
        monthlyHistory.push({ month: mStr, profitEarned: selectedMonthProfit, unitsSold: currentResult.unitsSold });
      } else if (mStr === previousMonth) {
        monthlyHistory.push({ month: mStr, profitEarned: previousMonthProfit, unitsSold: previousResult.unitsSold });
      } else {
        const histResult = await calculateMonthProfit(mStr);
        monthlyHistory.push({ month: mStr, profitEarned: histResult.profit, unitsSold: histResult.unitsSold });
      }
    }

    return {
      selectedMonth,
      previousMonth,
      selectedMonthProfit,
      previousMonthProfit,
      difference,
      percentageChange,
      trend,
      monthlyHistory,
    };
  }

  /**
   * 5. Get Full Report aggregate (FR-8.1 - FR-8.8)
   */
  static async getFullReport(storeId: string, month?: string): Promise<FullReportData> {
    const [metrics, itemRankings, supplierBreakdown, monthlyComparison] = await Promise.all([
      this.getDashboardMetrics(storeId),
      this.getItemProfitRankings(storeId),
      this.getSupplierProfitBreakdown(storeId),
      this.getMonthlyProfitReport(storeId, month),
    ]);

    return {
      metrics,
      itemRankings,
      supplierBreakdown,
      monthlyComparison,
    };
  }

  /**
   * 6. Generate CSV Report (FR-8.7)
   */
  static async generateReportCsv(storeId: string, month?: string): Promise<string> {
    const report = await this.getFullReport(storeId, month);
    const { metrics, itemRankings, supplierBreakdown, monthlyComparison } = report;

    const lines: string[] = [];

    // Header & Summary
    lines.push('SMART KIRANA - FINANCIAL & PROFIT ANALYSIS REPORT');
    lines.push(`Generated At,${new Date().toISOString()}`);
    lines.push(`Selected Month,${monthlyComparison.selectedMonth}`);
    lines.push('');

    // Dashboard Overview
    lines.push('--- DASHBOARD OVERVIEW ---');
    lines.push('Metric,Value');
    lines.push(`Overall Cost (Purchases Spent),Rs. ${metrics.overallCost}`);
    lines.push(`Total Items Count,${metrics.totalItems}`);
    lines.push(`Total Purchased Units,${metrics.totalPurchasedUnits}`);
    lines.push(`Quantity Remaining,${metrics.quantityRemaining}`);
    lines.push(`Value of Remaining Stock,Rs. ${metrics.stockValue}`);
    lines.push(`Expected Profit,Rs. ${metrics.expectedProfit}`);
    lines.push(`Profit Earned on Units Sold,Rs. ${metrics.profitEarned}`);
    lines.push(`Total Customer Credit Due,Rs. ${metrics.totalCreditDue}`);
    lines.push(`Remaining Online Amount,Rs. ${metrics.remainingOnlineAmount}`);
    lines.push(`Low Stock Items,${metrics.lowStockCount}`);
    lines.push('');

    // Month Comparison
    lines.push('--- MONTH-OVER-MONTH PROFIT ---');
    lines.push('Month,Profit Earned');
    lines.push(`${monthlyComparison.selectedMonth} (Selected),Rs. ${monthlyComparison.selectedMonthProfit}`);
    lines.push(`${monthlyComparison.previousMonth} (Previous),Rs. ${monthlyComparison.previousMonthProfit}`);
    lines.push(`Difference,Rs. ${monthlyComparison.difference} (${monthlyComparison.percentageChange}%)`);
    lines.push('');

    // Top & Bottom Items
    lines.push('--- MAXIMUM & MINIMUM PROFIT ITEMS ---');
    lines.push(`Max Profit Item,"${itemRankings.maxProfitItem ? itemRankings.maxProfitItem.name : 'N/A'}",Rs. ${itemRankings.maxProfitItem?.profitEarned ?? 0}`);
    lines.push(`Min Profit Item,"${itemRankings.minProfitItem ? itemRankings.minProfitItem.name : 'N/A'}",Rs. ${itemRankings.minProfitItem?.profitEarned ?? 0}`);
    lines.push('');

    // Item Rankings
    lines.push('--- ITEM-WISE PROFIT & MARGIN RANKINGS ---');
    lines.push('Rank,Item Name,Category,Unit,Cost Price,Selling Price,Profit Per Unit,Margin %,Units Purchased,Units Sold,Units Remaining,Profit Earned,Expected Profit,Supplier');
    itemRankings.rankedItems.forEach((item, index) => {
      lines.push(
        [
          index + 1,
          `"${item.name.replace(/"/g, '""')}"`,
          `"${item.category.replace(/"/g, '""')}"`,
          item.unit,
          item.costPrice,
          item.sellingPrice,
          item.profitPerUnit,
          `${item.marginPercent}%`,
          item.quantityPurchased,
          item.unitsSold,
          item.quantityRemaining,
          item.profitEarned,
          item.expectedProfit,
          `"${item.supplierName.replace(/"/g, '""')}"`,
        ].join(',')
      );
    });
    lines.push('');

    // Suppliers
    lines.push('--- SUPPLIER-WISE PROFIT & SPENT ---');
    lines.push('Supplier Name,Items Count,Total Spent,Profit Earned,Expected Profit,Total Paid Online');
    supplierBreakdown.suppliers.forEach((s) => {
      lines.push(
        [
          `"${s.shopName.replace(/"/g, '""')}"`,
          s.itemCount,
          s.totalSpent,
          s.profitEarned,
          s.expectedProfit,
          s.totalPaidOnline,
        ].join(',')
      );
    });

    return lines.join('\n');
  }
}

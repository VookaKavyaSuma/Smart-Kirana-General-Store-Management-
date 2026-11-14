import crypto from 'crypto';
import { prisma, getDatabaseStatus } from '../config/db.js';
import { memoryOnlineTransactions, InMemoryOnlineTransaction } from './credit.service.js';

export interface DailyOnlineEntryRecord {
  id: string;
  storeId: string;
  date: string; // YYYY-MM-DD
  totalAmount: number;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  transactionsTotal?: number;
  hasDiscrepancy?: boolean;
}

export interface OnlineTransactionRecord {
  id: string;
  storeId: string;
  creditPaymentId: string | null;
  dateTime: Date;
  amount: number;
  fromCustomer: string | null;
  referenceNumber: string | null;
  note: string | null;
  createdAt: Date;
}

export interface SupplierPaymentRecord {
  id: string;
  storeId: string;
  supplierId: string;
  supplierShopName?: string;
  purchaseId: string | null;
  amount: number;
  date: Date;
  referenceNumber: string | null;
  note: string | null;
  createdAt: Date;
}

export interface DayLedgerItem {
  date: string; // YYYY-MM-DD
  hasDailyEntry: boolean;
  dailyEntryAmount: number;
  transactionsSum: number;
  transactionsCount: number;
  effectiveReceived: number; // Counted amount (FR-11.3)
  paidSuppliers: number;
  supplierPaymentsCount: number;
  netChange: number;
  runningBalance: number;
  hasDiscrepancy: boolean;
}

export interface MonthSummaryItem {
  month: string; // YYYY-MM
  totalReceived: number;
  totalPaidSuppliers: number;
  netChange: number;
  daysCount: number;
}

// In-Memory store fallbacks for online payments
interface InMemoryDailyOnlineEntry {
  id: string;
  storeId: string;
  date: string; // YYYY-MM-DD
  totalAmount: number;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface InMemorySupplierPayment {
  id: string;
  storeId: string;
  supplierId: string;
  purchaseId: string | null;
  amount: number;
  date: Date;
  referenceNumber: string | null;
  note: string | null;
  createdAt: Date;
}

export const memoryDailyEntries = new Map<string, InMemoryDailyOnlineEntry>();
export const memoryDailyOnlineEntries = memoryDailyEntries;
export const memorySupplierPayments = new Map<string, InMemorySupplierPayment>();
export { memoryOnlineTransactions } from './credit.service.js';

export class OnlineService {
  /**
   * Reset in-memory maps for tests
   */
  static resetMemoryState() {
    memoryDailyEntries.clear();
    memorySupplierPayments.clear();
  }

  /**
   * Helper to normalize Date to YYYY-MM-DD string
   */
  static formatDateStr(d: Date | string): string {
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      return d;
    }
    const dt = new Date(d);
    return dt.toISOString().slice(0, 10);
  }

  /**
   * Get Overall Online Summary (FR-11.5, FR-11.6, FR-11.10)
   */
  static async getSummary(
    storeId: string,
    options: { startDate?: string; endDate?: string } = {}
  ): Promise<{
    totalOnlineReceived: number;
    totalOnlinePaidToSuppliers: number;
    remainingOnlineAmount: number;
    todayReceived: number;
    todayPaidSuppliers: number;
    hasTodayEntry: boolean;
    dailyReminderEnabled: boolean;
    isTodayMissing: boolean;
  }> {
    // 1. Get running ledger across all dates
    const ledger = await this.getRunningBalance(storeId, options);

    const totalOnlineReceived = Number(
      ledger.days.reduce((sum, d) => sum + d.effectiveReceived, 0).toFixed(2)
    );
    const totalOnlinePaidToSuppliers = Number(
      ledger.days.reduce((sum, d) => sum + d.paidSuppliers, 0).toFixed(2)
    );
    const remainingOnlineAmount = Number(
      (totalOnlineReceived - totalOnlinePaidToSuppliers).toFixed(2)
    );

    // 2. Today's stats & reminder check (FR-11.10)
    const todayStr = this.formatDateStr(new Date());
    const todayDay = ledger.days.find((d) => d.date === todayStr);

    let dailyReminderEnabled = true;
    if (getDatabaseStatus()) {
      try {
        const store = await prisma.store.findUnique({
          where: { id: storeId },
          select: { dailyReminderEnabled: true },
        });
        if (store) dailyReminderEnabled = store.dailyReminderEnabled;
      } catch (err) {
        console.warn('Could not read dailyReminderEnabled', err);
      }
    }

    const hasTodayEntry = !!todayDay?.hasDailyEntry;
    const isTodayMissing = dailyReminderEnabled && !hasTodayEntry;

    return {
      totalOnlineReceived,
      totalOnlinePaidToSuppliers,
      remainingOnlineAmount,
      todayReceived: todayDay?.effectiveReceived || 0,
      todayPaidSuppliers: todayDay?.paidSuppliers || 0,
      hasTodayEntry,
      dailyReminderEnabled,
      isTodayMissing,
    };
  }

  /**
   * Upsert a Daily Online Entry for a given date (FR-11.1, FR-11.3)
   */
  static async upsertDailyEntry(
    storeId: string,
    data: { date: string; totalAmount: number; note?: string }
  ): Promise<{
    success: boolean;
    entry?: DailyOnlineEntryRecord;
    hasDiscrepancy?: boolean;
    transactionsTotal?: number;
    error?: string;
  }> {
    const dateStr = this.formatDateStr(data.date || new Date());
    const amount = Number(data.totalAmount);
    if (isNaN(amount) || amount < 0) {
      return { success: false, error: 'Total amount must be a positive number.' };
    }

    // Check transactions sum for this day to detect discrepancy (FR-11.3)
    const txs = await this.getTransactions(storeId, { startDate: dateStr, endDate: dateStr });
    const txTotal = Number(txs.reduce((sum, t) => sum + t.amount, 0).toFixed(2));
    const hasDiscrepancy = txTotal > amount;

    if (getDatabaseStatus()) {
      try {
        const dateObj = new Date(dateStr);
        const existing = await prisma.dailyOnlineEntry.findFirst({
          where: { storeId, date: dateObj },
        });

        let saved;
        if (existing) {
          saved = await prisma.dailyOnlineEntry.update({
            where: { id: existing.id },
            data: {
              totalAmount: amount,
              note: data.note !== undefined ? data.note : existing.note,
            },
          });
        } else {
          saved = await prisma.dailyOnlineEntry.create({
            data: {
              id: crypto.randomUUID(),
              storeId,
              date: dateObj,
              totalAmount: amount,
              note: data.note || null,
            },
          });
        }

        return {
          success: true,
          entry: {
            id: saved.id,
            storeId: saved.storeId,
            date: dateStr,
            totalAmount: Number(saved.totalAmount),
            note: saved.note,
            createdAt: saved.createdAt,
            updatedAt: saved.updatedAt,
            transactionsTotal: txTotal,
            hasDiscrepancy,
          },
          hasDiscrepancy,
          transactionsTotal: txTotal,
        };
      } catch (err: any) {
        console.error('Prisma upsertDailyEntry error:', err.message);
      }
    }

    // In-Memory fallback
    let existingMem = Array.from(memoryDailyEntries.values()).find(
      (e) => e.storeId === storeId && e.date === dateStr
    );

    if (existingMem) {
      existingMem.totalAmount = amount;
      if (data.note !== undefined) existingMem.note = data.note || null;
      existingMem.updatedAt = new Date();
    } else {
      existingMem = {
        id: crypto.randomUUID(),
        storeId,
        date: dateStr,
        totalAmount: amount,
        note: data.note || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryDailyEntries.set(existingMem.id, existingMem);
    }

    return {
      success: true,
      entry: {
        ...existingMem,
        transactionsTotal: txTotal,
        hasDiscrepancy,
      },
      hasDiscrepancy,
      transactionsTotal: txTotal,
    };
  }

  /**
   * Get list of daily entries (FR-11.1)
   */
  static async getDailyEntries(
    storeId: string,
    options: { startDate?: string; endDate?: string } = {}
  ): Promise<DailyOnlineEntryRecord[]> {
    if (getDatabaseStatus()) {
      try {
        const where: any = { storeId };
        if (options.startDate || options.endDate) {
          where.date = {};
          if (options.startDate) where.date.gte = new Date(options.startDate);
          if (options.endDate) where.date.lte = new Date(options.endDate);
        }

        const entries = await prisma.dailyOnlineEntry.findMany({
          where,
          orderBy: { date: 'desc' },
        });

        return entries.map((e) => ({
          id: e.id,
          storeId: e.storeId,
          date: this.formatDateStr(e.date),
          totalAmount: Number(e.totalAmount),
          note: e.note,
          createdAt: e.createdAt,
          updatedAt: e.updatedAt,
        }));
      } catch (err: any) {
        console.error('Prisma getDailyEntries error:', err.message);
      }
    }

    return Array.from(memoryDailyEntries.values())
      .filter((e) => {
        if (e.storeId !== storeId) return false;
        if (options.startDate && e.date < options.startDate) return false;
        if (options.endDate && e.date > options.endDate) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  /**
   * Record individual online transaction (FR-11.2)
   */
  static async createTransaction(
    storeId: string,
    data: {
      dateTime?: string | Date;
      amount: number;
      fromCustomer?: string;
      referenceNumber?: string;
      note?: string;
    }
  ): Promise<{ success: boolean; transaction?: OnlineTransactionRecord; error?: string }> {
    const amount = Number(data.amount);
    if (isNaN(amount) || amount <= 0) {
      return { success: false, error: 'Amount must be greater than zero.' };
    }

    const dt = data.dateTime ? new Date(data.dateTime) : new Date();

    if (getDatabaseStatus()) {
      try {
        const created = await prisma.onlineTransaction.create({
          data: {
            id: crypto.randomUUID(),
            storeId,
            dateTime: dt,
            amount,
            fromCustomer: data.fromCustomer || null,
            referenceNumber: data.referenceNumber || null,
            note: data.note || null,
          },
        });

        return {
          success: true,
          transaction: {
            id: created.id,
            storeId: created.storeId,
            creditPaymentId: created.creditPaymentId,
            dateTime: created.dateTime,
            amount: Number(created.amount),
            fromCustomer: created.fromCustomer,
            referenceNumber: created.referenceNumber,
            note: created.note,
            createdAt: created.createdAt,
          },
        };
      } catch (err: any) {
        console.error('Prisma createTransaction error:', err.message);
      }
    }

    const newTx: InMemoryOnlineTransaction = {
      id: crypto.randomUUID(),
      storeId,
      creditPaymentId: null,
      dateTime: dt,
      amount,
      fromCustomer: data.fromCustomer || null,
      referenceNumber: data.referenceNumber || null,
      note: data.note || null,
      createdAt: new Date(),
    };
    memoryOnlineTransactions.set(newTx.id, newTx);

    return {
      success: true,
      transaction: newTx,
    };
  }

  /**
   * Get Online Transactions list (FR-11.2, FR-11.8)
   */
  static async getTransactions(
    storeId: string,
    options: { startDate?: string; endDate?: string } = {}
  ): Promise<OnlineTransactionRecord[]> {
    if (getDatabaseStatus()) {
      try {
        const where: any = { storeId };
        if (options.startDate || options.endDate) {
          where.dateTime = {};
          if (options.startDate) where.dateTime.gte = new Date(`${options.startDate}T00:00:00.000Z`);
          if (options.endDate) where.dateTime.lte = new Date(`${options.endDate}T23:59:59.999Z`);
        }

        const txs = await prisma.onlineTransaction.findMany({
          where,
          orderBy: { dateTime: 'desc' },
        });

        return txs.map((t) => ({
          id: t.id,
          storeId: t.storeId,
          creditPaymentId: t.creditPaymentId,
          dateTime: t.dateTime,
          amount: Number(t.amount),
          fromCustomer: t.fromCustomer,
          referenceNumber: t.referenceNumber,
          note: t.note,
          createdAt: t.createdAt,
        }));
      } catch (err: any) {
        console.error('Prisma getTransactions error:', err.message);
      }
    }

    return Array.from(memoryOnlineTransactions.values())
      .filter((t) => {
        if (t.storeId !== storeId) return false;
        const dStr = this.formatDateStr(t.dateTime);
        if (options.startDate && dStr < options.startDate) return false;
        if (options.endDate && dStr > options.endDate) return false;
        return true;
      })
      .sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime());
  }

  /**
   * Record Supplier Online Payment with balance check (FR-11.4, FR-11.7)
   */
  static async createSupplierPayment(
    storeId: string,
    data: {
      supplierId: string;
      purchaseId?: string;
      amount: number;
      date?: string | Date;
      referenceNumber?: string;
      note?: string;
      force?: boolean; // When user confirms after balance warning (FR-11.7)
    }
  ): Promise<{
    success: boolean;
    payment?: SupplierPaymentRecord;
    exceedsBalance?: boolean;
    remainingBalance?: number;
    error?: string;
  }> {
    const amount = Number(data.amount);
    if (isNaN(amount) || amount <= 0) {
      return { success: false, error: 'Payment amount must be greater than zero.' };
    }

    if (!data.supplierId) {
      return { success: false, error: 'Supplier is required.' };
    }

    // Check remaining online balance (FR-11.7)
    const summary = await this.getSummary(storeId);
    const remaining = summary.remainingOnlineAmount;

    // FR-11.7: If supplier payment is more than remaining online amount, ask for confirmation
    if (amount > remaining && !data.force) {
      return {
        success: false,
        exceedsBalance: true,
        remainingBalance: remaining,
        error: `Payment amount (₹${amount}) exceeds remaining online balance (₹${remaining}). Please confirm to proceed.`,
      };
    }

    const dt = data.date ? new Date(data.date) : new Date();

    if (getDatabaseStatus()) {
      try {
        const created = await prisma.supplierPayment.create({
          data: {
            id: crypto.randomUUID(),
            storeId,
            supplierId: data.supplierId,
            purchaseId: data.purchaseId || null,
            amount,
            date: dt,
            referenceNumber: data.referenceNumber || null,
            note: data.note || null,
          },
          include: { supplier: true },
        });

        return {
          success: true,
          payment: {
            id: created.id,
            storeId: created.storeId,
            supplierId: created.supplierId,
            supplierShopName: created.supplier?.shopName,
            purchaseId: created.purchaseId,
            amount: Number(created.amount),
            date: created.date,
            referenceNumber: created.referenceNumber,
            note: created.note,
            createdAt: created.createdAt,
          },
        };
      } catch (err: any) {
        console.error('Prisma createSupplierPayment error:', err.message);
      }
    }

    const newPayment: InMemorySupplierPayment = {
      id: crypto.randomUUID(),
      storeId,
      supplierId: data.supplierId,
      purchaseId: data.purchaseId || null,
      amount,
      date: dt,
      referenceNumber: data.referenceNumber || null,
      note: data.note || null,
      createdAt: new Date(),
    };
    memorySupplierPayments.set(newPayment.id, newPayment);

    return {
      success: true,
      payment: newPayment,
    };
  }

  /**
   * Get list of payments to suppliers (FR-11.4)
   */
  static async getSupplierPayments(
    storeId: string,
    options: { supplierId?: string; startDate?: string; endDate?: string } = {}
  ): Promise<SupplierPaymentRecord[]> {
    if (getDatabaseStatus()) {
      try {
        const where: any = { storeId };
        if (options.supplierId) where.supplierId = options.supplierId;
        if (options.startDate || options.endDate) {
          where.date = {};
          if (options.startDate) where.date.gte = new Date(`${options.startDate}T00:00:00.000Z`);
          if (options.endDate) where.date.lte = new Date(`${options.endDate}T23:59:59.999Z`);
        }

        const list = await prisma.supplierPayment.findMany({
          where,
          include: { supplier: true },
          orderBy: { date: 'desc' },
        });

        return list.map((p) => ({
          id: p.id,
          storeId: p.storeId,
          supplierId: p.supplierId,
          supplierShopName: p.supplier?.shopName,
          purchaseId: p.purchaseId,
          amount: Number(p.amount),
          date: p.date,
          referenceNumber: p.referenceNumber,
          note: p.note,
          createdAt: p.createdAt,
        }));
      } catch (err: any) {
        console.error('Prisma getSupplierPayments error:', err.message);
      }
    }

    return Array.from(memorySupplierPayments.values())
      .filter((p) => {
        if (p.storeId !== storeId) return false;
        if (options.supplierId && p.supplierId !== options.supplierId) return false;
        const dStr = this.formatDateStr(p.date);
        if (options.startDate && dStr < options.startDate) return false;
        if (options.endDate && dStr > options.endDate) return false;
        return true;
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  /**
   * Calculate day-by-day running balance and month summaries (FR-11.3, FR-11.5, FR-11.6, FR-11.10)
   */
  static async getRunningBalance(
    storeId: string,
    options: { startDate?: string; endDate?: string } = {}
  ): Promise<{
    days: DayLedgerItem[];
    months: MonthSummaryItem[];
  }> {
    // 1. Fetch all raw data for store
    const [dailyEntries, transactions, supplierPayments] = await Promise.all([
      this.getDailyEntries(storeId),
      this.getTransactions(storeId),
      this.getSupplierPayments(storeId),
    ]);

    // 2. Gather set of all unique dates
    const dateSet = new Set<string>();
    dailyEntries.forEach((e) => dateSet.add(e.date));
    transactions.forEach((t) => dateSet.add(this.formatDateStr(t.dateTime)));
    supplierPayments.forEach((p) => dateSet.add(this.formatDateStr(p.date)));

    // Ensure today is included
    const todayStr = this.formatDateStr(new Date());
    dateSet.add(todayStr);

    const sortedDates = Array.from(dateSet).sort((a, b) => a.localeCompare(b)); // Ascending chronological

    // 3. Compute day by day running balance
    let running = 0;
    const allDays: DayLedgerItem[] = [];

    for (const dateStr of sortedDates) {
      const dailyEntry = dailyEntries.find((e) => e.date === dateStr);
      const dayTxs = transactions.filter((t) => this.formatDateStr(t.dateTime) === dateStr);
      const daySuppPayments = supplierPayments.filter(
        (p) => this.formatDateStr(p.date) === dateStr
      );

      const txSum = Number(dayTxs.reduce((sum, t) => sum + t.amount, 0).toFixed(2));
      const suppSum = Number(daySuppPayments.reduce((sum, p) => sum + p.amount, 0).toFixed(2));

      // FR-11.3: Amount counted for a day is the daily entry; if none exists, the sum of transactions.
      let effectiveReceived = 0;
      let hasDiscrepancy = false;
      const hasDailyEntry = !!dailyEntry;
      const dailyEntryAmount = dailyEntry ? dailyEntry.totalAmount : 0;

      if (hasDailyEntry) {
        effectiveReceived = dailyEntryAmount;
        if (txSum > dailyEntryAmount) {
          hasDiscrepancy = true;
        }
      } else {
        effectiveReceived = txSum;
      }

      const netChange = Number((effectiveReceived - suppSum).toFixed(2));
      running = Number((running + netChange).toFixed(2));

      allDays.push({
        date: dateStr,
        hasDailyEntry,
        dailyEntryAmount,
        transactionsSum: txSum,
        transactionsCount: dayTxs.length,
        effectiveReceived,
        paidSuppliers: suppSum,
        supplierPaymentsCount: daySuppPayments.length,
        netChange,
        runningBalance: running,
        hasDiscrepancy,
      });
    }

    // 4. Compute month summaries
    const monthMap = new Map<
      string,
      { totalReceived: number; totalPaidSuppliers: number; daysCount: number }
    >();

    allDays.forEach((d) => {
      const mStr = d.date.slice(0, 7); // YYYY-MM
      const current = monthMap.get(mStr) || {
        totalReceived: 0,
        totalPaidSuppliers: 0,
        daysCount: 0,
      };
      current.totalReceived = Number((current.totalReceived + d.effectiveReceived).toFixed(2));
      current.totalPaidSuppliers = Number((current.totalPaidSuppliers + d.paidSuppliers).toFixed(2));
      current.daysCount += 1;
      monthMap.set(mStr, current);
    });

    const months: MonthSummaryItem[] = Array.from(monthMap.entries())
      .map(([m, val]) => ({
        month: m,
        totalReceived: val.totalReceived,
        totalPaidSuppliers: val.totalPaidSuppliers,
        netChange: Number((val.totalReceived - val.totalPaidSuppliers).toFixed(2)),
        daysCount: val.daysCount,
      }))
      .sort((a, b) => b.month.localeCompare(a.month)); // Most recent month first

    // 5. Apply date range filters on days (returned in descending order for recent view)
    let filteredDays = allDays;
    if (options.startDate) {
      filteredDays = filteredDays.filter((d) => d.date >= options.startDate!);
    }
    if (options.endDate) {
      filteredDays = filteredDays.filter((d) => d.date <= options.endDate!);
    }

    // Return days descending for latest date at top of table
    return {
      days: [...filteredDays].reverse(),
      months,
    };
  }

  /**
   * Total paid online to a specific supplier (FR-11.9)
   */
  static async getTotalPaidOnlineToSupplier(storeId: string, supplierId: string): Promise<number> {
    const payments = await this.getSupplierPayments(storeId, { supplierId });
    return Number(payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2));
  }

  /**
   * Export all online payments, daily entries, and running ledger to CSV (FR-11.10)
   */
  static async exportOnlineDataCsv(
    storeId: string,
    options: { startDate?: string; endDate?: string } = {}
  ): Promise<string> {
    const ledger = await this.getRunningBalance(storeId, options);
    const txs = await this.getTransactions(storeId, options);
    const suppPayments = await this.getSupplierPayments(storeId, options);

    const esc = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const lines: string[] = [];

    lines.push('=== SMART KIRANA ONLINE PAYMENTS REPORT ===');
    lines.push(`Generated At,${esc(new Date().toISOString())}`);
    lines.push('');

    // Section 1: Day-by-Day Running Ledger
    lines.push('=== DAY-BY-DAY ONLINE LEDGER & RUNNING BALANCE ===');
    lines.push(
      'Date,Counted Online Received (₹),Daily Entry (₹),Transactions Sum (₹),Paid to Suppliers (₹),Net Day Change (₹),Running Online Balance (₹),Discrepancy Warning'
    );
    for (const d of ledger.days) {
      lines.push(
        [
          esc(d.date),
          esc(d.effectiveReceived.toFixed(2)),
          esc(d.hasDailyEntry ? d.dailyEntryAmount.toFixed(2) : 'No Daily Entry'),
          esc(d.transactionsSum.toFixed(2)),
          esc(d.paidSuppliers.toFixed(2)),
          esc(d.netChange.toFixed(2)),
          esc(d.runningBalance.toFixed(2)),
          esc(d.hasDiscrepancy ? 'WARNING: Txs > Daily Entry' : 'OK'),
        ].join(',')
      );
    }
    lines.push('');

    // Section 2: Month-wise Totals
    lines.push('=== MONTH-WISE TOTALS ===');
    lines.push('Month,Total Online Received (₹),Total Paid Suppliers (₹),Net Monthly Change (₹)');
    for (const m of ledger.months) {
      lines.push(
        [
          esc(m.month),
          esc(m.totalReceived.toFixed(2)),
          esc(m.totalPaidSuppliers.toFixed(2)),
          esc(m.netChange.toFixed(2)),
        ].join(',')
      );
    }
    lines.push('');

    // Section 3: Online Transactions (Customer Receipts)
    lines.push('=== ONLINE TRANSACTIONS (CUSTOMER RECEIPTS) ===');
    lines.push('Transaction ID,Date & Time,Amount (₹),From Customer,Reference Number,Note');
    for (const t of txs) {
      lines.push(
        [
          esc(t.id),
          esc(new Date(t.dateTime).toLocaleString()),
          esc(t.amount.toFixed(2)),
          esc(t.fromCustomer || 'General Customer'),
          esc(t.referenceNumber || 'N/A'),
          esc(t.note || ''),
        ].join(',')
      );
    }
    lines.push('');

    // Section 4: Supplier Payments
    lines.push('=== ONLINE PAYMENTS TO SUPPLIERS ===');
    lines.push('Payment ID,Date,Supplier,Amount (₹),Reference Number,Note');
    for (const p of suppPayments) {
      lines.push(
        [
          esc(p.id),
          esc(new Date(p.date).toLocaleDateString()),
          esc(p.supplierShopName || 'Supplier'),
          esc(p.amount.toFixed(2)),
          esc(p.referenceNumber || 'N/A'),
          esc(p.note || ''),
        ].join(',')
      );
    }

    return lines.join('\n');
  }
}


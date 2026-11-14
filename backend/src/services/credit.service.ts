import crypto from 'crypto';
import { prisma, getDatabaseStatus } from '../config/db.js';
import { ItemService, memoryItems } from './item.service.js';

export interface CustomerSummary {
  id: string;
  storeId: string;
  name: string;
  mobileNumber: string | null;
  totalCredit: number;
  totalPaid: number;
  balanceDue: number;
  entriesCount: number;
  paymentsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreditEntryRecord {
  id: string;
  customerId: string;
  itemId: string | null;
  itemName: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  totalAmount: number;
  cost: number;
  profit: number;
  dateTaken: Date;
  createdAt: Date;
}

export interface CreditPaymentRecord {
  id: string;
  customerId: string;
  amount: number;
  date: Date;
  mode: 'CASH' | 'ONLINE';
  referenceNumber: string | null;
  note: string | null;
  createdAt: Date;
}

// In-Memory store fallbacks for credit data
interface InMemoryCustomer {
  id: string;
  storeId: string;
  name: string;
  mobileNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface InMemoryCreditEntry {
  id: string;
  customerId: string;
  itemId: string | null;
  itemName: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  totalAmount: number;
  dateTaken: Date;
  createdAt: Date;
}

interface InMemoryCreditPayment {
  id: string;
  customerId: string;
  amount: number;
  date: Date;
  mode: 'CASH' | 'ONLINE';
  referenceNumber: string | null;
  note: string | null;
  createdAt: Date;
}

interface InMemoryOnlineTransaction {
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

export const memoryCustomers = new Map<string, InMemoryCustomer>();
export const memoryCreditEntries = new Map<string, InMemoryCreditEntry>();
export const memoryCreditPayments = new Map<string, InMemoryCreditPayment>();
export const memoryOnlineTransactions = new Map<string, InMemoryOnlineTransaction>();

export class CreditService {
  /**
   * Reset in-memory maps for tests
   */
  static resetMemoryState() {
    memoryCustomers.clear();
    memoryCreditEntries.clear();
    memoryCreditPayments.clear();
    memoryOnlineTransactions.clear();
  }

  /**
   * Helper to compute customer totals
   */
  private static calculateCustomerTotals(
    entries: { totalAmount: any }[],
    payments: { amount: any }[]
  ) {
    const totalCredit = entries.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);
    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const rawBalance = totalCredit - totalPaid;
    const balanceDue = Number(rawBalance.toFixed(2));
    return {
      totalCredit: Number(totalCredit.toFixed(2)),
      totalPaid: Number(totalPaid.toFixed(2)),
      balanceDue,
    };
  }

  /**
   * List all customers with balances and total credit due (FR-10.9)
   */
  static async getCustomers(
    storeId: string,
    options: {
      filter?: 'all' | 'unpaid' | 'paid';
      sort?: 'highest_due' | 'name' | 'recent';
      search?: string;
    } = {}
  ): Promise<{
    customers: CustomerSummary[];
    totalCreditDue: number;
    totalCustomers: number;
    unpaidCount: number;
    paidCount: number;
  }> {
    const { filter = 'all', sort = 'highest_due', search = '' } = options;

    let customerSummaries: CustomerSummary[] = [];

    if (getDatabaseStatus()) {
      try {
        const rawCustomers = await prisma.customer.findMany({
          where: { storeId },
          include: {
            creditEntries: true,
            payments: true,
          },
          orderBy: { createdAt: 'desc' },
        });

        customerSummaries = rawCustomers.map((c) => {
          const { totalCredit, totalPaid, balanceDue } = this.calculateCustomerTotals(
            c.creditEntries,
            c.payments
          );
          return {
            id: c.id,
            storeId: c.storeId,
            name: c.name,
            mobileNumber: c.mobileNumber,
            totalCredit,
            totalPaid,
            balanceDue,
            entriesCount: c.creditEntries.length,
            paymentsCount: c.payments.length,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
          };
        });
      } catch (err: any) {
        console.error('Prisma getCustomers error, using memory:', err.message);
      }
    }

    if (customerSummaries.length === 0 && memoryCustomers.size > 0) {
      const storeCusts = Array.from(memoryCustomers.values()).filter((c) => c.storeId === storeId);
      customerSummaries = storeCusts.map((c) => {
        const entries = Array.from(memoryCreditEntries.values()).filter((e) => e.customerId === c.id);
        const payments = Array.from(memoryCreditPayments.values()).filter((p) => p.customerId === c.id);
        const { totalCredit, totalPaid, balanceDue } = this.calculateCustomerTotals(entries, payments);
        return {
          id: c.id,
          storeId: c.storeId,
          name: c.name,
          mobileNumber: c.mobileNumber,
          totalCredit,
          totalPaid,
          balanceDue,
          entriesCount: entries.length,
          paymentsCount: payments.length,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        };
      });
    }

    // Global totals before filtering
    const totalCreditDue = Number(
      customerSummaries.reduce((sum, c) => sum + Math.max(0, c.balanceDue), 0).toFixed(2)
    );
    const totalCustomers = customerSummaries.length;
    const unpaidCount = customerSummaries.filter((c) => c.balanceDue > 0).length;
    const paidCount = customerSummaries.filter((c) => c.balanceDue <= 0).length;

    // Apply Search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      customerSummaries = customerSummaries.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.mobileNumber && c.mobileNumber.includes(q))
      );
    }

    // Apply Filter
    if (filter === 'unpaid') {
      customerSummaries = customerSummaries.filter((c) => c.balanceDue > 0);
    } else if (filter === 'paid') {
      customerSummaries = customerSummaries.filter((c) => c.balanceDue <= 0);
    }

    // Apply Sort (highest_due, name, recent)
    if (sort === 'highest_due') {
      customerSummaries.sort((a, b) => b.balanceDue - a.balanceDue);
    } else if (sort === 'name') {
      customerSummaries.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'recent') {
      customerSummaries.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    }

    return {
      customers: customerSummaries,
      totalCreditDue,
      totalCustomers,
      unpaidCount,
      paidCount,
    };
  }

  /**
   * Get single customer with items taken, payments, and balance due (FR-10.8)
   */
  static async getCustomerById(
    storeId: string,
    customerId: string
  ): Promise<{
    customer: InMemoryCustomer;
    summary: { totalCredit: number; totalPaid: number; balanceDue: number };
    entries: CreditEntryRecord[];
    payments: CreditPaymentRecord[];
  } | null> {
    if (getDatabaseStatus()) {
      try {
        const cust = await prisma.customer.findFirst({
          where: { id: customerId, storeId },
          include: {
            creditEntries: { orderBy: { dateTaken: 'desc' } },
            payments: { orderBy: { date: 'desc' } },
          },
        });

        if (cust) {
          const { totalCredit, totalPaid, balanceDue } = this.calculateCustomerTotals(
            cust.creditEntries,
            cust.payments
          );

          const formattedEntries: CreditEntryRecord[] = cust.creditEntries.map((e) => {
            const qty = Number(e.quantity);
            const cp = Number(e.costPrice);
            const sp = Number(e.sellingPrice);
            const total = Number(e.totalAmount);
            const cost = Number((qty * cp).toFixed(2));
            const profit = Number((total - cost).toFixed(2));
            return {
              id: e.id,
              customerId: e.customerId,
              itemId: e.itemId,
              itemName: e.itemName,
              quantity: qty,
              costPrice: cp,
              sellingPrice: sp,
              totalAmount: total,
              cost,
              profit,
              dateTaken: e.dateTaken,
              createdAt: e.createdAt,
            };
          });

          const formattedPayments: CreditPaymentRecord[] = cust.payments.map((p) => ({
            id: p.id,
            customerId: p.customerId,
            amount: Number(p.amount),
            date: p.date,
            mode: p.mode as 'CASH' | 'ONLINE',
            referenceNumber: p.referenceNumber,
            note: p.note,
            createdAt: p.createdAt,
          }));

          return {
            customer: {
              id: cust.id,
              storeId: cust.storeId,
              name: cust.name,
              mobileNumber: cust.mobileNumber,
              createdAt: cust.createdAt,
              updatedAt: cust.updatedAt,
            },
            summary: { totalCredit, totalPaid, balanceDue },
            entries: formattedEntries,
            payments: formattedPayments,
          };
        }
      } catch (err: any) {
        console.error('Prisma getCustomerById error:', err.message);
      }
    }

    const memCust = memoryCustomers.get(customerId);
    if (!memCust || memCust.storeId !== storeId) return null;

    const entries = Array.from(memoryCreditEntries.values())
      .filter((e) => e.customerId === customerId)
      .sort((a, b) => b.dateTaken.getTime() - a.dateTaken.getTime());

    const payments = Array.from(memoryCreditPayments.values())
      .filter((p) => p.customerId === customerId)
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    const { totalCredit, totalPaid, balanceDue } = this.calculateCustomerTotals(entries, payments);

    const formattedEntries: CreditEntryRecord[] = entries.map((e) => {
      const cost = Number((e.quantity * e.costPrice).toFixed(2));
      const profit = Number((e.totalAmount - cost).toFixed(2));
      return {
        ...e,
        cost,
        profit,
      };
    });

    return {
      customer: memCust,
      summary: { totalCredit, totalPaid, balanceDue },
      entries: formattedEntries,
      payments,
    };
  }

  /**
   * Add a new customer (FR-10.2)
   */
  static async createCustomer(
    storeId: string,
    data: { name: string; mobileNumber?: string | null }
  ): Promise<{ success: boolean; customer?: any; error?: string }> {
    const name = data.name?.trim();
    if (!name) {
      return { success: false, error: 'Customer name is required.' };
    }

    const mobileNumber = data.mobileNumber ? data.mobileNumber.replace(/\D/g, '') : null;

    if (getDatabaseStatus()) {
      try {
        const created = await prisma.customer.create({
          data: {
            id: crypto.randomUUID(),
            storeId,
            name,
            mobileNumber: mobileNumber || null,
          },
        });
        return { success: true, customer: created };
      } catch (err: any) {
        console.error('Prisma createCustomer error:', err.message);
      }
    }

    const newCustomer: InMemoryCustomer = {
      id: crypto.randomUUID(),
      storeId,
      name,
      mobileNumber: mobileNumber || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryCustomers.set(newCustomer.id, newCustomer);

    return { success: true, customer: newCustomer };
  }

  /**
   * Add a credit entry: reduces stock, refuses if exceeding remaining (FR-10.3, FR-10.4, FR-10.5, FR-10.10)
   */
  static async addCreditEntry(
    storeId: string,
    customerId: string,
    data: {
      itemId?: string | null;
      itemName?: string;
      quantity: number;
      costPrice?: number;
      sellingPrice?: number;
      dateTaken?: string | Date;
    }
  ): Promise<{ success: boolean; entry?: CreditEntryRecord; error?: string }> {
    const qty = Number(data.quantity);
    if (isNaN(qty) || qty <= 0) {
      return { success: false, error: 'Quantity must be a positive number.' };
    }

    // Verify customer belongs to this store
    let customerName = '';
    if (getDatabaseStatus()) {
      try {
        const cust = await prisma.customer.findFirst({ where: { id: customerId, storeId } });
        if (!cust) return { success: false, error: 'Customer not found.' };
        customerName = cust.name;
      } catch (err: any) {
        console.error('Prisma customer verify error:', err.message);
      }
    } else {
      const cust = memoryCustomers.get(customerId);
      if (!cust || cust.storeId !== storeId) return { success: false, error: 'Customer not found.' };
      customerName = cust.name;
    }

    let itemName = data.itemName?.trim() || '';
    let costPrice = data.costPrice != null ? Number(data.costPrice) : 0;
    let sellingPrice = data.sellingPrice != null ? Number(data.sellingPrice) : 0;
    let itemId = data.itemId || null;

    // If itemId provided, lookup item and check stock (FR-10.5)
    if (itemId) {
      const item = await ItemService.getItemById(storeId, itemId);
      if (!item) {
        return { success: false, error: 'Selected item not found in store inventory.' };
      }

      if (!itemName) itemName = item.name;
      if (data.costPrice == null) costPrice = Number(item.currentCostPrice);
      if (data.sellingPrice == null) sellingPrice = Number(item.currentSellingPrice);

      const remainingStock = Number(item.quantityRemaining);
      // FR-10.5: Refuse quantity above the remaining stock
      if (qty > remainingStock) {
        return {
          success: false,
          error: `Cannot take ${qty} ${item.unit}. Only ${remainingStock} ${item.unit} remaining in stock.`,
        };
      }

      // Reduce item's remaining quantity (FR-10.5)
      const newRemaining = Number((remainingStock - qty).toFixed(3));
      if (getDatabaseStatus()) {
        try {
          await prisma.item.update({
            where: { id: itemId },
            data: { quantityRemaining: newRemaining },
          });
        } catch (err: any) {
          console.error('Prisma item stock update error:', err.message);
        }
      }

      const memItem = memoryItems.get(itemId);
      if (memItem) {
        memItem.quantityRemaining = newRemaining;
      }
    }

    if (!itemName) {
      return { success: false, error: 'Item name is required.' };
    }

    const totalAmount = Number((qty * sellingPrice).toFixed(2));
    const cost = Number((qty * costPrice).toFixed(2));
    const profit = Number((totalAmount - cost).toFixed(2));
    const dateTaken = data.dateTaken ? new Date(data.dateTaken) : new Date();

    if (getDatabaseStatus()) {
      try {
        const created = await prisma.creditEntry.create({
          data: {
            id: crypto.randomUUID(),
            customerId,
            itemId,
            itemName,
            quantity: qty,
            costPrice,
            sellingPrice,
            totalAmount,
            dateTaken,
          },
        });

        return {
          success: true,
          entry: {
            id: created.id,
            customerId: created.customerId,
            itemId: created.itemId,
            itemName: created.itemName,
            quantity: Number(created.quantity),
            costPrice: Number(created.costPrice),
            sellingPrice: Number(created.sellingPrice),
            totalAmount: Number(created.totalAmount),
            cost,
            profit,
            dateTaken: created.dateTaken,
            createdAt: created.createdAt,
          },
        };
      } catch (err: any) {
        console.error('Prisma create creditEntry error:', err.message);
      }
    }

    const newEntry: InMemoryCreditEntry = {
      id: crypto.randomUUID(),
      customerId,
      itemId,
      itemName,
      quantity: qty,
      costPrice,
      sellingPrice,
      totalAmount,
      dateTaken,
      createdAt: new Date(),
    };
    memoryCreditEntries.set(newEntry.id, newEntry);

    return {
      success: true,
      entry: {
        ...newEntry,
        cost,
        profit,
      },
    };
  }

  /**
   * Delete a credit entry and restore item stock (FR-10.5)
   */
  static async deleteCreditEntry(
    storeId: string,
    customerId: string,
    entryId: string
  ): Promise<{ success: boolean; error?: string }> {
    let entry: { itemId: string | null; quantity: number } | null = null;

    if (getDatabaseStatus()) {
      try {
        const found = await prisma.creditEntry.findFirst({
          where: { id: entryId, customerId },
        });
        if (found) {
          entry = {
            itemId: found.itemId,
            quantity: Number(found.quantity),
          };
          await prisma.creditEntry.delete({ where: { id: entryId } });
        }
      } catch (err: any) {
        console.error('Prisma delete creditEntry error:', err.message);
      }
    } else {
      const found = memoryCreditEntries.get(entryId);
      if (found && found.customerId === customerId) {
        entry = {
          itemId: found.itemId,
          quantity: found.quantity,
        };
        memoryCreditEntries.delete(entryId);
      }
    }

    if (!entry) {
      return { success: false, error: 'Credit entry not found.' };
    }

    // FR-10.5: Deleting an entry puts the quantity back
    if (entry.itemId) {
      if (getDatabaseStatus()) {
        try {
          const item = await prisma.item.findUnique({ where: { id: entry.itemId } });
          if (item) {
            const restored = Number((Number(item.quantityRemaining) + entry.quantity).toFixed(3));
            await prisma.item.update({
              where: { id: entry.itemId },
              data: { quantityRemaining: restored },
            });
          }
        } catch (err: any) {
          console.error('Prisma restore stock error:', err.message);
        }
      }

      const memItem = memoryItems.get(entry.itemId);
      if (memItem) {
        memItem.quantityRemaining = Number((memItem.quantityRemaining + entry.quantity).toFixed(3));
      }
    }

    return { success: true };
  }

  /**
   * Record payment (part or full); online payment creates OnlineTransaction (FR-10.6)
   */
  static async recordPayment(
    storeId: string,
    customerId: string,
    data: {
      amount: number;
      date?: string | Date;
      mode: 'CASH' | 'ONLINE';
      referenceNumber?: string | null;
      note?: string | null;
    }
  ): Promise<{ success: boolean; payment?: CreditPaymentRecord; error?: string }> {
    const amount = Number(data.amount);
    if (isNaN(amount) || amount <= 0) {
      return { success: false, error: 'Payment amount must be greater than zero.' };
    }

    const mode = data.mode === 'ONLINE' ? 'ONLINE' : 'CASH';
    const date = data.date ? new Date(data.date) : new Date();

    // Verify customer
    let customerName = '';
    if (getDatabaseStatus()) {
      try {
        const cust = await prisma.customer.findFirst({ where: { id: customerId, storeId } });
        if (!cust) return { success: false, error: 'Customer not found.' };
        customerName = cust.name;
      } catch (err: any) {
        console.error('Prisma customer verify error:', err.message);
      }
    } else {
      const cust = memoryCustomers.get(customerId);
      if (!cust || cust.storeId !== storeId) return { success: false, error: 'Customer not found.' };
      customerName = cust.name;
    }

    if (getDatabaseStatus()) {
      try {
        const payment = await prisma.creditPayment.create({
          data: {
            id: crypto.randomUUID(),
            customerId,
            amount,
            date,
            mode,
            referenceNumber: data.referenceNumber || null,
            note: data.note || null,
          },
        });

        // FR-10.6, FR-11.8: An online payment must also create an online transaction record
        if (mode === 'ONLINE') {
          await prisma.onlineTransaction.create({
            data: {
              id: crypto.randomUUID(),
              storeId,
              creditPaymentId: payment.id,
              dateTime: date,
              amount,
              fromCustomer: customerName,
              referenceNumber: data.referenceNumber || null,
              note: data.note || `Customer credit payment: ${customerName}`,
            },
          });
        }

        return {
          success: true,
          payment: {
            id: payment.id,
            customerId: payment.customerId,
            amount: Number(payment.amount),
            date: payment.date,
            mode: payment.mode as 'CASH' | 'ONLINE',
            referenceNumber: payment.referenceNumber,
            note: payment.note,
            createdAt: payment.createdAt,
          },
        };
      } catch (err: any) {
        console.error('Prisma recordPayment error:', err.message);
      }
    }

    const newPayment: InMemoryCreditPayment = {
      id: crypto.randomUUID(),
      customerId,
      amount,
      date,
      mode,
      referenceNumber: data.referenceNumber || null,
      note: data.note || null,
      createdAt: new Date(),
    };
    memoryCreditPayments.set(newPayment.id, newPayment);

    // FR-10.6, FR-11.8: An online payment must also create an online transaction record
    if (mode === 'ONLINE') {
      const newTx: InMemoryOnlineTransaction = {
        id: crypto.randomUUID(),
        storeId,
        creditPaymentId: newPayment.id,
        dateTime: date,
        amount,
        fromCustomer: customerName,
        referenceNumber: data.referenceNumber || null,
        note: data.note || `Customer credit payment: ${customerName}`,
        createdAt: new Date(),
      };
      memoryOnlineTransactions.set(newTx.id, newTx);
    }

    return {
      success: true,
      payment: newPayment,
    };
  }
}

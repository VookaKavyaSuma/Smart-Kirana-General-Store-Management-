import crypto from 'crypto';
import { prisma, getDatabaseStatus } from '../config/db.js';
import { matchScore } from '../utils/fuzzy.util.js';
import { ItemService } from './item.service.js';
import { calculateExpectedProfit, calculateProfitEarned } from '../utils/calculations.util.js';

export interface SearchHistoryRecord {
  id: string;
  storeId: string;
  searchWord: string;
  count: number;
  lastSearchedAt: Date;
}

// In-Memory fallback for Search History
const memorySearchHistory = new Map<string, SearchHistoryRecord>();

export class SearchService {
  /**
   * Fast, fuzzy search for items across English and Telugu scripts (FR-7.1, FR-7.2, FR-7.5, FR-7.6)
   * Target < 300 ms response time for 10,000 items.
   */
  static async searchItems(
    storeId: string,
    query: string
  ): Promise<{ items: any[]; durationMs: number }> {
    const startTime = Date.now();
    const cleanQuery = query.trim();

    if (!cleanQuery) {
      return { items: [], durationMs: 0 };
    }

    let items: any[] = [];

    // Attempt PostgreSQL with pg_trgm if database is connected
    if (getDatabaseStatus()) {
      try {
        const rawResults: any[] = await prisma.$queryRaw`
          SELECT id, store_id as "storeId", name, category, unit, photo_url as "photoUrl",
                 current_cost_price as "currentCostPrice",
                 current_selling_price as "currentSellingPrice",
                 quantity_remaining as "quantityRemaining",
                 quantity_purchased as "quantityPurchased",
                 similarity(name, ${cleanQuery}) as sim
          FROM items
          WHERE store_id = ${storeId}
            AND (name ILIKE ${'%' + cleanQuery + '%'} OR similarity(name, ${cleanQuery}) > 0.15)
          ORDER BY (CASE WHEN name ILIKE ${cleanQuery + '%'} THEN 1 WHEN name ILIKE ${'%' + cleanQuery + '%'} THEN 2 ELSE 3 END),
                   sim DESC, name ASC
          LIMIT 25;
        `;

        items = rawResults.map((r) => ({
          id: r.id,
          name: r.name,
          category: r.category,
          unit: r.unit,
          photoUrl: r.photoUrl,
          currentCostPrice: Number(r.currentCostPrice),
          costPrice: Number(r.currentCostPrice),
          currentSellingPrice: Number(r.currentSellingPrice),
          sellingPrice: Number(r.currentSellingPrice),
          quantityRemaining: Number(r.quantityRemaining),
          quantityPurchased: Number(r.quantityPurchased),
          isLowStock: Number(r.quantityRemaining) < 5,
        }));
      } catch (err: any) {
        // Fallback to in-memory/standard Prisma query if pg_trgm raw query fails
        items = [];
      }
    }

    // In-memory / JS fallback fuzzy matching
    if (items.length === 0) {
      const allItems = await ItemService.listItems(storeId);
      const scored: Array<{ item: any; score: number }> = [];

      for (const item of allItems) {
        const result = matchScore(item.name, cleanQuery);
        if (result.matches) {
          scored.push({ item, score: result.score });
        }
      }

      scored.sort((a, b) => b.score - a.score);
      items = scored.slice(0, 25).map((s) => ({
        id: s.item.id,
        name: s.item.name,
        category: s.item.category,
        unit: s.item.unit,
        photoUrl: s.item.photoUrl,
        currentCostPrice: Number(s.item.currentCostPrice),
        costPrice: Number(s.item.currentCostPrice),
        currentSellingPrice: Number(s.item.currentSellingPrice),
        sellingPrice: Number(s.item.currentSellingPrice),
        quantityRemaining: Number(s.item.quantityRemaining),
        quantityPurchased: Number(s.item.quantityPurchased),
        isLowStock: Boolean(s.item.isLowStock),
      }));
    }

    const durationMs = Date.now() - startTime;
    return { items, durationMs };
  }

  /**
   * Record search term or opened item to SearchHistory (FR-7.4)
   * Every search or opened result increments frequency count.
   */
  static async recordSearchHistory(
    storeId: string,
    rawWord: string,
    itemId?: string
  ): Promise<SearchHistoryRecord> {
    const searchWord = rawWord.trim().toLowerCase();
    if (!searchWord) {
      throw new Error('Search word cannot be empty');
    }

    if (getDatabaseStatus()) {
      try {
        const record = await prisma.searchHistory.upsert({
          where: {
            storeId_searchWord: {
              storeId,
              searchWord,
            },
          },
          create: {
            id: crypto.randomUUID(),
            storeId,
            searchWord,
            count: 1,
            lastSearchedAt: new Date(),
          },
          update: {
            count: { increment: 1 },
            lastSearchedAt: new Date(),
          },
        });

        return {
          id: record.id,
          storeId: record.storeId,
          searchWord: record.searchWord,
          count: record.count,
          lastSearchedAt: record.lastSearchedAt,
        };
      } catch (err: any) {
        console.warn('Prisma recordSearchHistory error, falling back to memory:', err.message);
      }
    }

    // In-memory fallback
    const memKey = `${storeId}:::${searchWord}`;
    let record = memorySearchHistory.get(memKey);

    if (record) {
      record.count += 1;
      record.lastSearchedAt = new Date();
    } else {
      record = {
        id: crypto.randomUUID(),
        storeId,
        searchWord,
        count: 1,
        lastSearchedAt: new Date(),
      };
      memorySearchHistory.set(memKey, record);
    }

    return { ...record };
  }

  /**
   * Get suggestions ordered by how often that user searched them (most frequent first - FR-7.3)
   */
  static async getSuggestions(
    storeId: string,
    prefix?: string,
    limit: number = 10
  ): Promise<SearchHistoryRecord[]> {
    const cleanPrefix = prefix ? prefix.trim().toLowerCase() : '';

    if (getDatabaseStatus()) {
      try {
        const whereClause: any = { storeId };
        if (cleanPrefix) {
          whereClause.searchWord = { contains: cleanPrefix, mode: 'insensitive' };
        }

        const results = await prisma.searchHistory.findMany({
          where: whereClause,
          orderBy: [
            { count: 'desc' },
            { lastSearchedAt: 'desc' },
          ],
          take: limit,
        });

        return results.map((r) => ({
          id: r.id,
          storeId: r.storeId,
          searchWord: r.searchWord,
          count: r.count,
          lastSearchedAt: r.lastSearchedAt,
        }));
      } catch (err: any) {
        console.warn('Prisma getSuggestions error, falling back to memory:', err.message);
      }
    }

    // In-memory fallback
    let list = Array.from(memorySearchHistory.values()).filter((r) => r.storeId === storeId);

    if (cleanPrefix) {
      list = list.filter((r) => r.searchWord.toLowerCase().includes(cleanPrefix));
    }

    // Order by most frequent first (count DESC), then lastSearchedAt DESC (FR-7.3)
    list.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.lastSearchedAt.getTime() - a.lastSearchedAt.getTime();
    });

    return list.slice(0, limit);
  }

  /**
   * Delete a suggestion from search history (FR-7.7)
   */
  static async deleteSuggestion(storeId: string, idOrWord: string): Promise<boolean> {
    if (getDatabaseStatus()) {
      try {
        await prisma.searchHistory.deleteMany({
          where: {
            storeId,
            OR: [
              { id: idOrWord },
              { searchWord: idOrWord.trim().toLowerCase() },
            ],
          },
        });
        return true;
      } catch (err: any) {
        console.warn('Prisma deleteSuggestion error:', err.message);
      }
    }

    // In-memory fallback
    for (const [key, val] of memorySearchHistory.entries()) {
      if (val.storeId === storeId && (val.id === idOrWord || val.searchWord === idOrWord.trim().toLowerCase())) {
        memorySearchHistory.delete(key);
        return true;
      }
    }

    return true;
  }

  /**
   * Process voice input commands (FR-2.5, FR-2.6)
   * Supports: "search rice", "how much sugar is left", "add item", "profit this month" in English and Telugu.
   */
  static async handleVoiceCommand(
    storeId: string,
    rawCommand: string,
    language: 'en' | 'te' = 'en'
  ): Promise<{
    action: 'search' | 'stock_check' | 'add_item' | 'profit_report' | 'unknown';
    query?: string;
    item?: any;
    spokenAnswer: string;
    displayText: string;
    data?: any;
  }> {
    const text = rawCommand.trim().toLowerCase();

    // 1. Voice Command: Add item ("add item", "కొత్త వస్తువు", "వస్తువును జోడించండి")
    if (
      text.includes('add item') ||
      text.includes('create item') ||
      text.includes('new item') ||
      text.includes('కొత్త వస్తువు') ||
      text.includes('వస్తువును జోడించండి') ||
      text.includes('ఐటమ్ జోడించు')
    ) {
      const spokenAnswer = language === 'te'
        ? 'కొత్త వస్తువును నమోదు చేసే ఫారమ్ తెరవబడింది.'
        : 'Opening the add item form.';
      return {
        action: 'add_item',
        spokenAnswer,
        displayText: spokenAnswer,
      };
    }

    // 2. Voice Command: Profit this month ("profit this month", "ఈ నెల లాభం", "monthly profit")
    if (
      text.includes('profit this month') ||
      text.includes('monthly profit') ||
      text.includes('this month profit') ||
      text.includes('ఈ నెల లాభం') ||
      text.includes('నెల లాభం')
    ) {
      // Calculate current month's profit from items
      const items = await ItemService.listItems(storeId);
      const totalProfit = items.reduce((acc, item) => {
        const unitsSold = Math.max(0, (Number(item.quantityPurchased) || 0) - (Number(item.quantityRemaining) || 0));
        const profitPerUnit = (Number(item.currentSellingPrice) || 0) - (Number(item.currentCostPrice) || 0);
        return acc + unitsSold * profitPerUnit;
      }, 0);

      const roundedProfit = Math.round(totalProfit * 100) / 100;

      const spokenAnswer = language === 'te'
        ? `ఈ నెల మీ మొత్తం లాభం ₹${roundedProfit.toLocaleString('en-IN')}.`
        : `Your total earned profit this month is ₹${roundedProfit.toLocaleString('en-IN')}.`;

      return {
        action: 'profit_report',
        spokenAnswer,
        displayText: spokenAnswer,
        data: { profit: roundedProfit },
      };
    }

    // 3. Voice Command: Stock check ("how much sugar is left", "stock of rice", "చక్కెర ఎంత మిగిలి ఉంది")
    const stockPatterns = [
      /how much (.+?) is left/i,
      /how much (.+?) left/i,
      /how much (.+?) do we have/i,
      /stock of (.+)/i,
      /(.+?) stock/i,
      /(.+?) ఎంత మిగిలి ఉంది/i,
      /(.+?) ఎంత ఉంది/i,
      /(.+?) స్టాక్ ఎంత/i,
    ];

    for (const pat of stockPatterns) {
      const m = text.match(pat);
      if (m && m[1]) {
        const itemQuery = m[1].replace(/left|is|the|available|మిగిలి|ఉంది|స్టాక్/gi, '').trim();
        if (itemQuery.length >= 2) {
          const searchRes = await this.searchItems(storeId, itemQuery);
          if (searchRes.items.length > 0) {
            const foundItem = searchRes.items[0];
            const spokenAnswer = language === 'te'
              ? `మీ వద్ద ${foundItem.name} స్టాక్ ${foundItem.quantityRemaining} ${foundItem.unit} మిగిలి ఉంది.`
              : `You have ${foundItem.quantityRemaining} ${foundItem.unit} of ${foundItem.name} left in stock.`;

            return {
              action: 'stock_check',
              item: foundItem,
              query: itemQuery,
              spokenAnswer,
              displayText: spokenAnswer,
              data: { item: foundItem },
            };
          } else {
            const spokenAnswer = language === 'te'
              ? `${itemQuery} మీ దుకాణం వస్తువులలో కనిపించలేదు.`
              : `Item ${itemQuery} was not found in your inventory.`;

            return {
              action: 'stock_check',
              query: itemQuery,
              spokenAnswer,
              displayText: spokenAnswer,
            };
          }
        }
      }
    }

    // 4. Voice Command: Search item ("search rice", "find sugar", "బియ్యం వెతకండి")
    let searchQuery = text
      .replace(/^(search for|search|find|look up|show me|వెతకండి|చూపించండి|వెతుకు)\s+/i, '')
      .replace(/\s+(వెతకండి|చూపించండి|వెతుకు)$/i, '')
      .trim();

    if (!searchQuery) {
      searchQuery = text;
    }

    const searchRes = await this.searchItems(storeId, searchQuery);
    // Record into search history
    await this.recordSearchHistory(storeId, searchQuery);

    const spokenAnswer = language === 'te'
      ? `${searchQuery} కోసం ${searchRes.items.length} వస్తువులు కనుగొనబడ్డాయి.`
      : `Found ${searchRes.items.length} items for ${searchQuery}.`;

    return {
      action: 'search',
      query: searchQuery,
      spokenAnswer,
      displayText: spokenAnswer,
      data: { items: searchRes.items },
    };
  }

  static resetMemoryState() {
    memorySearchHistory.clear();
  }
}

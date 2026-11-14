import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import { SearchService } from './search.service.js';
import { memoryItems, ItemRecord } from './item.service.js';

describe('Smart Kirana - Search Performance Benchmark (FR-7.6)', () => {
  const storeId = 'store-benchmark-' + crypto.randomUUID();
  const TOTAL_ITEMS = 10000;

  beforeAll(async () => {
    // Populate 10,000 realistic Kirana items into inventory
    const prefixes = ['Fresh', 'Premium', 'Organic', 'Royal', 'Standard', 'Super', 'Classic', 'Best'];
    const products = [
      { en: 'Sona Masoori Rice', te: 'సోనా మసూరి బియ్యం' },
      { en: 'Toor Dal', te: 'కందిపప్పు' },
      { en: 'Moong Dal', te: 'పెసరపప్పు' },
      { en: 'Sunflower Oil 1L', te: 'సన్ ఫ్లవర్ నూనె' },
      { en: 'Refined Sugar', te: 'చక్కెర' },
      { en: 'Wheat Flour Atta', te: 'గోధుమ పిండి' },
      { en: 'Chana Dal', te: 'శనగపప్పు' },
      { en: 'Mustard Seeds', te: 'ఆవాలు' },
      { en: 'Cumin Seeds Jeera', te: 'జీలకర్ర' },
      { en: 'Red Chilli Powder', te: 'కారం పొడి' },
      { en: 'Turmeric Powder', te: 'పసుపు పొడి' },
      { en: 'Tata Salt', te: 'ఉప్పు' },
      { en: 'Groundnut Oil', te: 'వేరుశనగ నూనె' },
      { en: 'Garam Masala', te: 'గరం మసాలా' },
      { en: 'Tea Powder', te: 'టీ పొడి' },
      { en: 'Coffee Powder', te: 'కాఫీ పొడి' },
      { en: 'Ghee 500ml', te: 'నెయ్యి' },
      { en: 'Basmati Rice', te: 'బాస్మతి బియ్యం' },
      { en: 'Urad Dal Gundu', te: 'మినప గుండ్లు' },
      { en: 'Cardamom Elaichi', te: 'యాలకులు' },
    ];

    for (let i = 0; i < TOTAL_ITEMS; i++) {
      const prod = products[i % products.length];
      const prefix = prefixes[i % prefixes.length];
      const isTeluguName = i % 3 === 0; // Coprime to products.length (20) so both English & Telugu generated
      const itemName = isTeluguName
        ? `${prod.te} #${i + 1}`
        : `${prefix} ${prod.en} - Batch ${i + 1}`;

      const item: ItemRecord = {
        id: `item-bench-${i}`,
        storeId,
        supplierId: null,
        name: itemName,
        category: 'Groceries',
        unit: 'KG',
        photoUrl: null,
        currentCostPrice: 40 + (i % 50),
        currentSellingPrice: 50 + (i % 60),
        quantityPurchased: 100,
        quantityRemaining: 75,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      memoryItems.set(item.id, item);
    }

    // Warm-up call so V8 compiles fuzzy matching hot paths
    await SearchService.searchItems(storeId, 'Warmup');
  });

  it('searches across 10,000 items in under 300 ms for English prefix (FR-7.6)', async () => {
    const start = performance.now();
    const result = await SearchService.searchItems(storeId, 'Sona Masoori');
    const elapsed = performance.now() - start;

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].name.toLowerCase()).toContain('sona');
    expect(elapsed).toBeLessThan(300); // FR-7.6 target < 300 ms
  });

  it('searches across 10,000 items in under 300 ms for Telugu script query (FR-7.6)', async () => {
    const start = performance.now();
    const result = await SearchService.searchItems(storeId, 'బియ్యం');
    const elapsed = performance.now() - start;

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].name).toContain('బియ్యం');
    expect(elapsed).toBeLessThan(300);
  });

  it('searches across 10,000 items in under 300 ms with typos / fuzzy matching (FR-7.6)', async () => {
    const start = performance.now();
    const result = await SearchService.searchItems(storeId, 'Sunflowr');
    const elapsed = performance.now() - start;

    expect(result.items.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(300);
  });

  it('returns empty result set quickly (<50 ms) for empty or whitespace query', async () => {
    const start = performance.now();
    const result = await SearchService.searchItems(storeId, '   ');
    const elapsed = performance.now() - start;

    expect(result.items).toHaveLength(0);
    expect(elapsed).toBeLessThan(50);
  });
});

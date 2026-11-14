import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import { AuthService } from '../services/auth.service.js';
import { ItemService } from '../services/item.service.js';
import { SearchService } from '../services/search.service.js';
import { generateOtp, resetOtpState } from '../services/otp.service.js';

describe('Smart Kirana - Phase 6: Search with Suggestions & Voice Commands (FR-7, FR-2.4 to FR-2.7)', () => {
  let sessionToken: string;

  beforeEach(async () => {
    resetOtpState();
    AuthService.resetMemoryState();
    ItemService.resetMemoryState();
    SearchService.resetMemoryState();

    const mobile = '9876543210';
    const otp = generateOtp(mobile, 'REGISTRATION');
    const regRes = await AuthService.registerStore({
      shopName: 'Sri Balaji Super Store',
      password: 'Password123!',
      mobileNumber: mobile,
      otpCode: otp.code!,
    });
    sessionToken = regRes.sessionToken!;

    // Seed test items
    await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({
        name: 'Sugar (చక్కెర)',
        category: 'General Stores',
        unit: 'KG',
        costPrice: 40,
        sellingPrice: 48,
        quantity: 30,
      });

    await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({
        name: 'Sona Masoori Rice (బియ్యం)',
        category: 'Grains & Pulses',
        unit: 'KG',
        costPrice: 55,
        sellingPrice: 65,
        quantity: 100,
      });

    await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({
        name: 'Sunflower Oil 1L (నూనె)',
        category: 'Oils',
        unit: 'LITRE',
        costPrice: 110,
        sellingPrice: 130,
        quantity: 25,
      });
  });

  describe('Suggestion Ordering and Frequency Count (FR-7.3, FR-7.4, FR-7.7)', () => {
    it('orders suggestions by how often that user searched them (most frequent first) (FR-7.3, FR-7.4)', async () => {
      // Simulate searches:
      // "rice" searched 2 times
      // "sugar" searched 5 times
      // "oil" searched 1 time
      for (let i = 0; i < 2; i++) {
        await request(app)
          .post('/api/v1/search/history')
          .set('Authorization', `Bearer ${sessionToken}`)
          .send({ searchWord: 'rice' });
      }

      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/search/history')
          .set('Authorization', `Bearer ${sessionToken}`)
          .send({ searchWord: 'sugar' });
      }

      await request(app)
        .post('/api/v1/search/history')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({ searchWord: 'oil' });

      // Fetch all suggestions (empty query)
      const suggestionsRes = await request(app)
        .get('/api/v1/search/suggestions')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(suggestionsRes.status).toBe(200);
      expect(suggestionsRes.body.success).toBe(true);
      const suggestions = suggestionsRes.body.suggestions;

      expect(suggestions).toHaveLength(3);

      // Most frequent FIRST: Sugar (5) -> Rice (2) -> Oil (1)
      expect(suggestions[0].searchWord).toBe('sugar');
      expect(suggestions[0].count).toBe(5);

      expect(suggestions[1].searchWord).toBe('rice');
      expect(suggestions[1].count).toBe(2);

      expect(suggestions[2].searchWord).toBe('oil');
      expect(suggestions[2].count).toBe(1);
    });

    it('filters suggestions when the user types the first letters (FR-7.3)', async () => {
      await request(app)
        .post('/api/v1/search/history')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({ searchWord: 'soap' });

      await request(app)
        .post('/api/v1/search/history')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({ searchWord: 'soap' });

      await request(app)
        .post('/api/v1/search/history')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({ searchWord: 'sugar' });

      await request(app)
        .post('/api/v1/search/history')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({ searchWord: 'rice' });

      // Query prefix "so" -> should only return soap
      const res = await request(app)
        .get('/api/v1/search/suggestions?q=so')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(res.status).toBe(200);
      expect(res.body.suggestions).toHaveLength(1);
      expect(res.body.suggestions[0].searchWord).toBe('soap');
    });

    it('allows deleting a suggestion from history (FR-7.7)', async () => {
      const histRes = await request(app)
        .post('/api/v1/search/history')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({ searchWord: 'toothpaste' });

      const suggestionId = histRes.body.record.id;

      // Delete suggestion
      const deleteRes = await request(app)
        .delete(`/api/v1/search/suggestions/${suggestionId}`)
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      // Verify it is gone
      const checkRes = await request(app)
        .get('/api/v1/search/suggestions?q=tooth')
        .set('Authorization', `Bearer ${sessionToken}`);
      expect(checkRes.body.suggestions).toHaveLength(0);
    });
  });

  describe('Instant Fuzzy & Multilingual Item Search (FR-7.1, FR-7.2, FR-7.5, FR-7.6)', () => {
    it('ignores case and returns item photo, name, quantity remaining, selling price, and cost price (FR-7.2, FR-7.5)', async () => {
      const res = await request(app)
        .get('/api/v1/search?q=SUGAR')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      const item = res.body.items[0];

      expect(item.name).toContain('Sugar');
      expect(item.quantityRemaining).toBe(30);
      expect(item.costPrice).toBe(40);
      expect(item.sellingPrice).toBe(48);
      expect(res.body.durationMs).toBeLessThan(300); // under 300 ms target
    });

    it('accepts part of a word and tolerates small spelling mistakes (FR-7.5)', async () => {
      // Partial word "masoori"
      const resPartial = await request(app)
        .get('/api/v1/search?q=masoori')
        .set('Authorization', `Bearer ${sessionToken}`);
      expect(resPartial.body.items.length).toBeGreaterThanOrEqual(1);
      expect(resPartial.body.items[0].name).toContain('Sona Masoori Rice');

      // Small spelling mistake: "sugr" instead of "sugar"
      const resTypo = await request(app)
        .get('/api/v1/search?q=sugr')
        .set('Authorization', `Bearer ${sessionToken}`);
      expect(resTypo.body.items.length).toBeGreaterThanOrEqual(1);
      expect(resTypo.body.items[0].name).toContain('Sugar');
    });

    it('searches seamlessly in Telugu script (FR-2.3, FR-7.5)', async () => {
      // Searching "చక్కెర" (Sugar)
      const resTelugu = await request(app)
        .get('/api/v1/search?q=చక్కెర')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(resTelugu.status).toBe(200);
      expect(resTelugu.body.items.length).toBeGreaterThanOrEqual(1);
      expect(resTelugu.body.items[0].name).toContain('చక్కెర');

      // Searching "బియ్యం" (Rice)
      const resRice = await request(app)
        .get('/api/v1/search?q=బియ్యం')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(resRice.body.items.length).toBeGreaterThanOrEqual(1);
      expect(resRice.body.items[0].name).toContain('బియ్యం');
    });
  });

  describe('Voice Input Commands & Speech Synthesis (FR-2.4 to FR-2.7)', () => {
    it('executes "how much sugar is left" and returns speech synthesis text (FR-2.5, FR-2.6)', async () => {
      const res = await request(app)
        .post('/api/v1/search/voice-command')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          command: 'how much sugar is left',
          language: 'en',
        });

      expect(res.status).toBe(200);
      expect(res.body.action).toBe('stock_check');
      expect(res.body.spokenAnswer).toContain('30 KG');
      expect(res.body.spokenAnswer).toContain('Sugar');
      expect(res.body.displayText).toBe(res.body.spokenAnswer);
    });

    it('executes stock check command in Telugu (FR-2.5, FR-2.6)', async () => {
      const res = await request(app)
        .post('/api/v1/search/voice-command')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          command: 'చక్కెర ఎంత మిగిలి ఉంది',
          language: 'te',
        });

      expect(res.status).toBe(200);
      expect(res.body.action).toBe('stock_check');
      expect(res.body.spokenAnswer).toContain('30 KG');
      expect(res.body.spokenAnswer).toContain('మిగిలి ఉంది');
    });

    it('executes "search rice" voice command (FR-2.5)', async () => {
      const res = await request(app)
        .post('/api/v1/search/voice-command')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          command: 'search rice',
          language: 'en',
        });

      expect(res.status).toBe(200);
      expect(res.body.action).toBe('search');
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.items[0].name).toContain('Rice');
    });

    it('executes "add item" voice command (FR-2.5)', async () => {
      const res = await request(app)
        .post('/api/v1/search/voice-command')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          command: 'add item',
          language: 'en',
        });

      expect(res.status).toBe(200);
      expect(res.body.action).toBe('add_item');
      expect(res.body.spokenAnswer).toContain('Opening the add item form');
    });

    it('executes "profit this month" voice command (FR-2.5, FR-2.6)', async () => {
      const res = await request(app)
        .post('/api/v1/search/voice-command')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          command: 'profit this month',
          language: 'en',
        });

      expect(res.status).toBe(200);
      expect(res.body.action).toBe('profit_report');
      expect(res.body.spokenAnswer).toContain('profit');
    });
  });
});


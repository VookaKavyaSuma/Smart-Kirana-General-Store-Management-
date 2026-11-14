import { describe, it, expect } from 'vitest';
import { deriveUsername, normalizeUsername, areUsernamesEqual, validateUsername } from './username.util.js';

describe('Smart Kirana - User Name Rules (FR-1.2, FR-1.3)', () => {
  describe('deriveUsername()', () => {
    it('derives username by removing all spaces and converting to lowercase', () => {
      // From requirements: shop name "Sri Lakshmi Stores" gives user name "srilakshmistores"
      expect(deriveUsername('Sri Lakshmi Stores')).toBe('srilakshmistores');
    });

    it('handles multiple consecutive spaces and tabs/newlines', () => {
      expect(deriveUsername('  Sri   Lakshmi   Stores  \t\n ')).toBe('srilakshmistores');
    });

    it('handles single word shop names', () => {
      expect(deriveUsername('Kirana')).toBe('kirana');
      expect(deriveUsername('D-Mart')).toBe('d-mart');
    });

    it('handles uppercase and mixed case shop names', () => {
      expect(deriveUsername('SRI LAKSHMI STORES')).toBe('srilakshmistores');
      expect(deriveUsername('sRi LaKsHmI sToReS')).toBe('srilakshmistores');
    });

    it('handles Telugu shop names (preserves Telugu characters without spaces)', () => {
      // "శ్రీ లక్ష్మి స్టోర్స్" -> "శ్రీలక్ష్మిస్టోర్స్"
      expect(deriveUsername('శ్రీ లక్ష్మి స్టోర్స్')).toBe('శ్రీలక్ష్మిస్టోర్స్');
    });

    it('handles empty or non-string inputs safely', () => {
      expect(deriveUsername('')).toBe('');
      // @ts-expect-error test invalid types
      expect(deriveUsername(null)).toBe('');
      // @ts-expect-error test invalid types
      expect(deriveUsername(undefined)).toBe('');
    });
  });

  describe('Case-Insensitivity & Equality (FR-1.3, Acceptance Criteria)', () => {
    it('treats SriLakshmiStores, srilakshmistores, and SRILAKSHMISTORES as the exact same username', () => {
      const canonical = 'srilakshmistores';
      const variant1 = 'SriLakshmiStores';
      const variant2 = 'srilakshmistores';
      const variant3 = 'SRILAKSHMISTORES';
      const variantWithSpaces = 'Sri Lakshmi Stores';

      expect(normalizeUsername(variant1)).toBe(canonical);
      expect(normalizeUsername(variant2)).toBe(canonical);
      expect(normalizeUsername(variant3)).toBe(canonical);
      expect(deriveUsername(variantWithSpaces)).toBe(canonical);

      expect(areUsernamesEqual(variant1, variant2)).toBe(true);
      expect(areUsernamesEqual(variant2, variant3)).toBe(true);
      expect(areUsernamesEqual(variant1, variant3)).toBe(true);
      expect(areUsernamesEqual(variant3, canonical)).toBe(true);
    });

    it('correctly compares user input login against stored lowercase username', () => {
      const storedDbUsername = 'srilakshmistores';
      const userLoginInput = 'SRILAKSHMISTORES';

      expect(normalizeUsername(userLoginInput)).toBe(storedDbUsername);
      expect(areUsernamesEqual(userLoginInput, storedDbUsername)).toBe(true);
    });

    it('distinguishes different shop usernames', () => {
      expect(areUsernamesEqual('Sri Lakshmi Stores', 'Sri Venkateshwara Stores')).toBe(false);
      expect(areUsernamesEqual('kirana1', 'kirana2')).toBe(false);
    });
  });

  describe('validateUsername()', () => {
    it('accepts valid derived usernames', () => {
      expect(validateUsername('srilakshmistores').isValid).toBe(true);
      expect(validateUsername('kirana').isValid).toBe(true);
    });

    it('rejects empty or too short usernames', () => {
      expect(validateUsername('').isValid).toBe(false);
      expect(validateUsername('ab').isValid).toBe(false);
    });

    it('rejects raw username strings containing spaces', () => {
      const result = validateUsername('sri lakshmi');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('spaces');
    });
  });
});


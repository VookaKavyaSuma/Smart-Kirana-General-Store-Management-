import { describe, it, expect } from 'vitest';
import {
  trigramSimilarity,
  levenshteinDistance,
  matchScore,
  normalizeString,
} from './fuzzy.util.js';

describe('Smart Kirana - Fuzzy & Trigram Search Utility (FR-7.5)', () => {
  it('normalizes strings properly', () => {
    expect(normalizeString('  Sugar  ')).toBe('sugar');
    expect(normalizeString('')).toBe('');
    expect(normalizeString(null)).toBe('');
  });

  it('calculates trigram similarity correctly', () => {
    // Exact match = 1.0
    expect(trigramSimilarity('sugar', 'sugar')).toBe(1.0);

    // Substring match gets high similarity
    expect(trigramSimilarity('sugar', 'sug')).toBeGreaterThanOrEqual(0.8);

    // Completely different strings
    expect(trigramSimilarity('apple', 'zebra')).toBe(0);
  });

  it('calculates Levenshtein edit distance for typos', () => {
    // 1 typo: 'sugr' vs 'sugar'
    expect(levenshteinDistance('sugr', 'sugar')).toBe(1);

    // 1 typo: 'rise' vs 'rice'
    expect(levenshteinDistance('rise', 'rice')).toBe(1);

    // Exact match = 0
    expect(levenshteinDistance('dal', 'dal')).toBe(0);
  });

  it('matches prefix, substring, typos and multilingual names (FR-7.5)', () => {
    // Prefix match
    const prefixRes = matchScore('Sunflower Oil', 'sun');
    expect(prefixRes.matches).toBe(true);
    expect(prefixRes.score).toBeGreaterThanOrEqual(0.9);

    // Substring match
    const subRes = matchScore('Sona Masoori Rice', 'masoori');
    expect(subRes.matches).toBe(true);
    expect(subRes.score).toBeGreaterThanOrEqual(0.8);

    // Typo tolerance
    const typoRes = matchScore('Sugar (చక్కెర)', 'sugr');
    expect(typoRes.matches).toBe(true);
    expect(typoRes.score).toBeGreaterThanOrEqual(0.65);

    // Telugu match
    const teluguRes = matchScore('చక్కెర / Sugar', 'చక్కెర');
    expect(teluguRes.matches).toBe(true);
    expect(teluguRes.score).toBeGreaterThanOrEqual(0.9);
  });
});

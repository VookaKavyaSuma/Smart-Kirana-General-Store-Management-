/**
 * Fuzzy text matching and Trigram similarity utility (FR-7.5)
 * Ignores case, accepts part of a word, tolerates small spelling mistakes,
 * and works for both Telugu and English script names.
 */

export function normalizeString(str?: string | null): string {
  if (!str) return '';
  return str.toLowerCase().trim();
}

/**
 * Computes trigrams for a given string (matching PostgreSQL pg_trgm logic)
 */
export function getTrigrams(str: string): Set<string> {
  const normalized = `  ${normalizeString(str)} `;
  const trigrams = new Set<string>();
  for (let i = 0; i < normalized.length - 2; i++) {
    trigrams.add(normalized.substring(i, i + 3));
  }
  return trigrams;
}

/**
 * Calculates trigram similarity between two strings (0.0 to 1.0)
 */
export function trigramSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);

  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.8 + (Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length)) * 0.2;
  }

  const tg1 = getTrigrams(s1);
  const tg2 = getTrigrams(s2);

  if (tg1.size === 0 || tg2.size === 0) return 0;

  let common = 0;
  for (const tg of tg1) {
    if (tg2.has(tg)) common++;
  }

  return (2 * common) / (tg1.size + tg2.size);
}

/**
 * Computes Levenshtein edit distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const s1 = normalizeString(a);
  const s2 = normalizeString(b);

  const m = s1.length;
  const n = s2.length;
  const d: number[][] = [];

  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return d[m][n];
}

/**
 * Checks whether target string matches the search query:
 * - Prefix match (starts with) -> score: 1.0
 * - Substring match (contains) -> score: 0.8
 * - Trigram similarity >= 0.25 -> score: similarity
 * - Small spelling mistake (Levenshtein distance <= 2 for words >= 4 chars)
 */
export function matchScore(target: string, query: string): { matches: boolean; score: number } {
  const t = normalizeString(target);
  const q = normalizeString(query);

  if (!t || !q) return { matches: false, score: 0 };

  // Exact match
  if (t === q) return { matches: true, score: 1.0 };

  // Prefix match (highest priority)
  if (t.startsWith(q)) return { matches: true, score: 0.95 };

  // Substring match (part of a word - FR-7.5)
  if (t.includes(q)) return { matches: true, score: 0.85 };

  // Check individual words in target
  const words = t.split(/\s+/);
  for (const word of words) {
    if (word.startsWith(q)) return { matches: true, score: 0.9 };
    if (word.includes(q)) return { matches: true, score: 0.8 };

    // Small spelling mistakes (FR-7.5: tolerance for typos)
    if (q.length >= 3 && word.length >= 3) {
      const dist = levenshteinDistance(word, q);
      if (dist <= 1) return { matches: true, score: 0.75 };
      if (q.length >= 5 && dist <= 2) return { matches: true, score: 0.65 };
    }
  }

  // Trigram similarity
  const sim = trigramSimilarity(t, q);
  if (sim >= 0.25) {
    return { matches: true, score: sim };
  }

  return { matches: false, score: 0 };
}


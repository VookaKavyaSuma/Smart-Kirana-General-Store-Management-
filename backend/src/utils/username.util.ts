/**
 * User Name Utilities for Smart Kirana (FR-1.2, FR-1.3)
 *
 * Rules:
 * 1. The user name shall be the shop name with all spaces removed.
 *    Example: "Sri Lakshmi Stores" -> "srilakshmistores"
 * 2. User names are case-insensitive. Stored in lower-case form and compared in lower-case at login.
 *    Example: "SriLakshmiStores", "srilakshmistores", and "SRILAKSHMISTORES" are identical.
 */

/**
 * Derives a normalized username from a shop name by removing all spaces and converting to lowercase.
 */
export function deriveUsername(shopName: string): string {
  if (!shopName || typeof shopName !== 'string') {
    return '';
  }
  // Remove all whitespace (spaces, tabs, line breaks, non-breaking spaces) and convert to lowercase
  return shopName.replace(/\s+/gu, '').toLowerCase();
}

/**
 * Normalizes an input username for search, comparison, and storage.
 */
export function normalizeUsername(username: string): string {
  if (!username || typeof username !== 'string') {
    return '';
  }
  return username.replace(/\s+/gu, '').toLowerCase();
}

/**
 * Checks whether two usernames or shop names evaluate to the same username.
 */
export function areUsernamesEqual(name1: string, name2: string): boolean {
  return normalizeUsername(name1) === normalizeUsername(name2);
}

/**
 * Validates whether a derived or provided username meets the minimum constraints.
 */
export function validateUsername(username: string): { isValid: boolean; error?: string } {
  if (!username || typeof username !== 'string') {
    return { isValid: false, error: 'Username is required' };
  }
  
  const normalized = normalizeUsername(username);
  if (normalized.length < 3) {
    return { isValid: false, error: 'Username must be at least 3 characters long' };
  }

  // Reject usernames that still contain whitespace (if raw input was passed without stripping)
  if (/\s/u.test(username)) {
    return { isValid: false, error: 'Username must not contain any spaces' };
  }

  return { isValid: true };
}


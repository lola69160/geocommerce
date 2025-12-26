/**
 * String Normalization Utility
 *
 * Normalizes business names for accurate matching across French and international names.
 * Used by Places scoring system to differentiate businesses at the same address.
 */

export interface NameMatchDetails {
  businessName: string;
  googleName: string;
  normalized: {
    business: string;
    google: string;
  };
  matchType: 'exact' | 'substring' | 'partial' | 'none';
  confidence: number; // 0-1
}

/**
 * Normalize business name for comparison
 *
 * Steps:
 * 1. Convert to lowercase
 * 2. Remove accents (é → e, à → a, etc.) using NFD decomposition
 * 3. Remove common French articles (le, la, les, l', un, une, des)
 * 4. Remove common English articles (the, a, an)
 * 5. Remove business entity suffixes (SARL, SAS, EURL, etc.)
 * 6. Remove punctuation and special characters (keep only letters, numbers, spaces)
 * 7. Collapse multiple spaces to single space
 * 8. Trim whitespace
 *
 * @param name - Business name to normalize
 * @returns Normalized name string
 *
 * @example
 * normalizeBusinessName("Café de la Gare SARL") → "cafe gare"
 * normalizeBusinessName("L'Épicerie du Coin") → "epicerie coin"
 */
export function normalizeBusinessName(name: string | null | undefined): string {
  if (!name) return '';

  let normalized = name.toLowerCase().trim();

  // Remove accents using NFD decomposition
  // NFD separates base characters from diacritical marks
  // Then we remove the marks (unicode range U+0300 to U+036F)
  normalized = normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Remove common French articles at start
  // Pattern: le/la/les/l'/l /un/une/des followed by space
  normalized = normalized.replace(/^(le|la|les|l'|l |un|une|des)\s+/i, '');

  // Remove common English articles at start
  normalized = normalized.replace(/^(the|a|an)\s+/i, '');

  // Remove business entity suffixes (French)
  // SARL, SAS, EURL, EIRL, SA, SNC, SCS, SCA, SCM, SCI
  normalized = normalized.replace(/\s+(sarl|sas|eurl|eirl|sa|snc|scs|sca|scm|sci)$/i, '');

  // Remove punctuation and special characters
  // Keep only: letters (a-z), numbers (0-9), and spaces
  normalized = normalized.replace(/[^a-z0-9\s]/g, ' ');

  // Collapse multiple spaces to single space
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Score business name match (0-30 points)
 *
 * Scoring tiers:
 * - Exact match (normalized): 30 points
 * - Substring match (either direction): 20 points
 * - Partial word overlap (>50% Jaccard similarity): 10 points
 * - No match: 0 points
 *
 * @param businessName - Name from OpenData (enseigne, nom_complet, etc.)
 * @param googleName - Name from Google Places (displayName.text)
 * @returns Score from 0 to 30
 *
 * @example
 * scoreBusinessName("AU FIL DE L'O", "AU FIL DE L'O") → 30 (exact)
 * scoreBusinessName("DRUGSTORE", "Le Drugstore du Barriot") → 20 (substring)
 * scoreBusinessName("Café de la Gare", "Café Station") → 10 (word overlap)
 * scoreBusinessName("Boulangerie", "Pharmacie") → 0 (no match)
 */
export function scoreBusinessName(
  businessName: string | null | undefined,
  googleName: string | null | undefined
): number {
  // No business name or Google name available → return 0 (not penalized, just no bonus)
  if (!businessName || !googleName) {
    return 0;
  }

  const normBusiness = normalizeBusinessName(businessName);
  const normGoogle = normalizeBusinessName(googleName);

  // Edge case: empty after normalization
  if (!normBusiness || !normGoogle) {
    return 0;
  }

  // TIER 1: Exact match → 30 points
  if (normBusiness === normGoogle) {
    return 30;
  }

  // TIER 2: Substring match (either direction) → 20 points
  // Check if business name appears in Google name OR vice versa
  if (normGoogle.includes(normBusiness) || normBusiness.includes(normGoogle)) {
    return 20;
  }

  // TIER 3: Partial word overlap → 10 points
  // Calculate Jaccard similarity: intersection / union
  // Filter out short words (<3 chars) to avoid false positives

  const businessWords = new Set(
    normBusiness.split(' ').filter(w => w.length > 2)
  );
  const googleWords = new Set(
    normGoogle.split(' ').filter(w => w.length > 2)
  );

  // If no significant words, can't calculate overlap
  if (businessWords.size === 0 || googleWords.size === 0) {
    return 0;
  }

  // Calculate intersection (common words)
  const intersection = new Set(
    Array.from(businessWords).filter(w => googleWords.has(w))
  );

  // Calculate union (all unique words)
  const union = new Set(Array.from(businessWords).concat(Array.from(googleWords)));

  // Jaccard similarity = |intersection| / |union|
  const similarity = intersection.size / union.size;

  // If > 50% word overlap, award 10 points
  if (similarity > 0.5) {
    return 10;
  }

  // TIER 4: No match → 0 points
  return 0;
}

/**
 * Get detailed name match information for debugging and logging
 *
 * @param businessName - Name from OpenData
 * @param googleName - Name from Google Places
 * @returns Match details object or undefined if names are missing
 *
 * @example
 * getNameMatchDetails("AU FIL DE L'O", "Au Fil de l'O")
 * → {
 *     businessName: "AU FIL DE L'O",
 *     googleName: "Au Fil de l'O",
 *     normalized: { business: "au fil o", google: "au fil o" },
 *     matchType: "exact",
 *     confidence: 1.0
 *   }
 */
export function getNameMatchDetails(
  businessName: string | null | undefined,
  googleName: string | null | undefined
): NameMatchDetails | undefined {
  if (!businessName || !googleName) return undefined;

  const normBusiness = normalizeBusinessName(businessName);
  const normGoogle = normalizeBusinessName(googleName);
  const score = scoreBusinessName(businessName, googleName);

  let matchType: 'exact' | 'substring' | 'partial' | 'none';
  let confidence: number;

  if (normBusiness === normGoogle) {
    matchType = 'exact';
    confidence = 1.0;
  } else if (normGoogle.includes(normBusiness) || normBusiness.includes(normGoogle)) {
    matchType = 'substring';
    confidence = 0.7;
  } else if (score > 0) {
    matchType = 'partial';
    confidence = 0.4;
  } else {
    matchType = 'none';
    confidence = 0.0;
  }

  return {
    businessName,
    googleName,
    normalized: {
      business: normBusiness,
      google: normGoogle
    },
    matchType,
    confidence
  };
}

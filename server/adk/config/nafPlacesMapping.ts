/**
 * NAF → Google Places Type Mapping
 *
 * Maps French NAF/APE codes to Google Places API type taxonomy.
 * Based on 2025 Google Places type system (Table A).
 *
 * Used by Places scoring system to award bonus points for type matching.
 */

export interface NAFMapping {
  nafCode: string;
  label: string;
  primaryTypes: string[];    // Most likely Google Places types (20 points)
  relatedTypes: string[];    // Secondary/related types (10 points)
}

export interface TypeMatchDetails {
  nafCode: string;
  expectedTypes: string[];
  actualTypes: string[];
  matchedTypes: string[];
  matchStrength: 'exact' | 'related' | 'none';
}

/**
 * Comprehensive NAF → Google Places type mapping
 * Covers 28 NAF codes currently used in the application
 */
export const NAF_PLACES_MAPPING: Record<string, NAFMapping> = {
  // ========== FOOD & BEVERAGE ==========

  '10.71C': {
    nafCode: '10.71C',
    label: 'Boulangerie et boulangerie-pâtisserie',
    primaryTypes: ['bakery'],
    relatedTypes: ['cafe', 'coffee_shop', 'meal_takeaway']
  },

  '10.71D': {
    nafCode: '10.71D',
    label: 'Pâtisserie',
    primaryTypes: ['bakery'],
    relatedTypes: ['cafe', 'coffee_shop', 'ice_cream_shop']
  },

  '56.10A': {
    nafCode: '56.10A',
    label: 'Restauration traditionnelle',
    primaryTypes: ['restaurant', 'french_restaurant'],
    relatedTypes: ['fine_dining_restaurant', 'meal_delivery', 'meal_takeaway']
  },

  '56.10B': {
    nafCode: '56.10B',
    label: 'Cafétéria et autres libres-services',
    primaryTypes: ['cafe', 'cafeteria'],
    relatedTypes: ['restaurant', 'fast_food_restaurant']
  },

  '56.10C': {
    nafCode: '56.10C',
    label: 'Restauration de type rapide',
    primaryTypes: ['fast_food_restaurant', 'meal_takeaway'],
    relatedTypes: ['sandwich_shop', 'hamburger_restaurant', 'pizza_restaurant']
  },

  '56.30Z': {
    nafCode: '56.30Z',
    label: 'Débits de boissons',
    primaryTypes: ['bar', 'cafe'],
    relatedTypes: ['night_club', 'liquor_store']
  },

  // ========== RETAIL - FOOD ==========

  '47.11F': {
    nafCode: '47.11F',
    label: 'Hypermarchés',
    primaryTypes: ['supermarket', 'department_store'],
    relatedTypes: ['grocery_store', 'shopping_mall']
  },

  '47.11D': {
    nafCode: '47.11D',
    label: 'Supermarchés',
    primaryTypes: ['supermarket'],
    relatedTypes: ['grocery_store', 'convenience_store']
  },

  '47.11B': {
    nafCode: '47.11B',
    label: 'Commerce d\'alimentation générale',
    primaryTypes: ['grocery_store', 'convenience_store'],
    relatedTypes: ['supermarket']
  },

  '47.25Z': {
    nafCode: '47.25Z',
    label: 'Commerce de détail de boissons',
    primaryTypes: ['liquor_store'],
    relatedTypes: ['convenience_store', 'grocery_store', 'wine_shop']
  },

  '47.24Z': {
    nafCode: '47.24Z',
    label: 'Commerce de détail de pain, pâtisserie et confiserie',
    primaryTypes: ['bakery'],
    relatedTypes: ['candy_store', 'chocolate_shop']
  },

  '47.29Z': {
    nafCode: '47.29Z',
    label: 'Autres commerces de détail alimentaires',
    primaryTypes: ['grocery_store'],
    relatedTypes: ['specialty_food_store', 'organic_food_store', 'health_food_store']
  },

  // ========== RETAIL - NON-FOOD ==========

  '47.26Z': {
    nafCode: '47.26Z',
    label: 'Commerce de détail de produits à base de tabac en magasin spécialisé',
    primaryTypes: ['tobacco_shop', 'newsstand'],
    relatedTypes: ['convenience_store', 'lottery_retailer']
  },

  '47.62Z': {
    nafCode: '47.62Z',
    label: 'Commerce de détail de journaux et papeterie',
    primaryTypes: ['book_store', 'newsstand'],
    relatedTypes: ['stationery_store', 'gift_shop']
  },

  '47.71Z': {
    nafCode: '47.71Z',
    label: 'Commerce de détail d\'habillement',
    primaryTypes: ['clothing_store'],
    relatedTypes: ['shoe_store', 'boutique', 'fashion_accessories_store']
  },

  '47.76Z': {
    nafCode: '47.76Z',
    label: 'Commerce de détail de fleurs, plantes, graines',
    primaryTypes: ['florist'],
    relatedTypes: ['garden_center', 'gift_shop']
  },

  '47.51Z': {
    nafCode: '47.51Z',
    label: 'Commerce de détail de textiles',
    primaryTypes: ['fabric_store', 'clothing_store'],
    relatedTypes: ['craft_store', 'home_goods_store']
  },

  '47.59B': {
    nafCode: '47.59B',
    label: 'Commerce de détail de meubles',
    primaryTypes: ['furniture_store', 'home_goods_store'],
    relatedTypes: ['interior_design_service']
  },

  '47.61Z': {
    nafCode: '47.61Z',
    label: 'Commerce de détail de livres',
    primaryTypes: ['book_store'],
    relatedTypes: ['library', 'newsstand']
  },

  '47.78C': {
    nafCode: '47.78C',
    label: 'Autres commerces de détail spécialisés divers',
    primaryTypes: ['store'],
    relatedTypes: ['gift_shop', 'variety_store', 'specialty_store']
  },

  '47.30Z': {
    nafCode: '47.30Z',
    label: 'Commerce de détail de carburants en magasin spécialisé',
    primaryTypes: ['gas_station'],
    relatedTypes: ['convenience_store', 'car_wash']
  },

  // ========== SERVICES - PERSONAL CARE ==========

  '96.02A': {
    nafCode: '96.02A',
    label: 'Coiffure',
    primaryTypes: ['hair_salon', 'hair_care'],
    relatedTypes: ['barber_shop', 'beauty_salon']
  },

  '96.02B': {
    nafCode: '96.02B',
    label: 'Soins de beauté',
    primaryTypes: ['beauty_salon', 'spa'],
    relatedTypes: ['nail_salon', 'hair_salon', 'skin_care', 'massage']
  },

  // ========== SERVICES - HEALTH ==========

  '86.21Z': {
    nafCode: '86.21Z',
    label: 'Activité des médecins généralistes',
    primaryTypes: ['doctor', 'medical_clinic'],
    relatedTypes: ['hospital', 'health']
  },

  '86.23Z': {
    nafCode: '86.23Z',
    label: 'Pratique dentaire',
    primaryTypes: ['dentist', 'dental_clinic'],
    relatedTypes: ['orthodontist']
  },

  // ========== SERVICES - REPAIR & MAINTENANCE ==========

  '95.12Z': {
    nafCode: '95.12Z',
    label: 'Réparation d\'équipements de communication',
    primaryTypes: ['electronics_repair_shop', 'cell_phone_store'],
    relatedTypes: ['electronics_store']
  }
};

/**
 * Get expected Google Places types for a NAF code
 *
 * Handles:
 * - Single NAF code: "47.26Z"
 * - Multiple NAF codes: "47.26Z,47.62Z"
 * - Unknown NAF codes: returns empty array
 *
 * @param nafCode - NAF/APE code(s) from OpenData
 * @returns Array of expected Google Places types (primary + related)
 *
 * @example
 * getPlacesTypesForNAF("10.71C") → ["bakery", "cafe", "coffee_shop", "meal_takeaway"]
 * getPlacesTypesForNAF("47.26Z,47.62Z") → ["tobacco_shop", "newsstand", "convenience_store", "book_store", ...]
 * getPlacesTypesForNAF("99.99Z") → []
 */
export function getPlacesTypesForNAF(nafCode: string | null | undefined): string[] {
  if (!nafCode) return [];

  // Handle multi-code NAF (e.g., "47.26Z,47.62Z")
  const codes = nafCode.split(',').map(c => c.trim());

  const allTypes = new Set<string>();

  for (const code of codes) {
    const mapping = NAF_PLACES_MAPPING[code];
    if (mapping) {
      // Add both primary and related types
      mapping.primaryTypes.forEach(t => allTypes.add(t));
      mapping.relatedTypes.forEach(t => allTypes.add(t));
    }
  }

  return Array.from(allTypes);
}

/**
 * Score business type match (0-20 points)
 *
 * Scoring tiers:
 * - Primary type match: 20 points
 * - Related type match: 10 points
 * - No match: 0 points
 *
 * @param nafCode - NAF/APE code from OpenData
 * @param googleTypes - types[] array from Google Places
 * @returns Score from 0 to 20
 *
 * @example
 * scoreBusinessType("10.71C", ["bakery", "cafe"]) → 20 (primary match)
 * scoreBusinessType("10.71C", ["meal_takeaway"]) → 10 (related match)
 * scoreBusinessType("10.71C", ["pharmacy"]) → 0 (no match)
 * scoreBusinessType(null, ["bakery"]) → 0 (no NAF code)
 */
export function scoreBusinessType(
  nafCode: string | null | undefined,
  googleTypes: string[] | null | undefined
): number {
  // No NAF code or no Google types → return 0 (not penalized, just no bonus)
  if (!nafCode || !googleTypes || googleTypes.length === 0) {
    return 0;
  }

  // Handle multi-code NAF
  const codes = nafCode.split(',').map(c => c.trim());
  const googleTypeSet = new Set(googleTypes);

  // TIER 1: Check for primary type match (20 points)
  for (const code of codes) {
    const mapping = NAF_PLACES_MAPPING[code];
    if (mapping) {
      // Check if any primary type matches
      const primaryMatch = mapping.primaryTypes.some(t => googleTypeSet.has(t));
      if (primaryMatch) {
        return 20;
      }
    }
  }

  // TIER 2: Check for related type match (10 points)
  for (const code of codes) {
    const mapping = NAF_PLACES_MAPPING[code];
    if (mapping) {
      // Check if any related type matches
      const relatedMatch = mapping.relatedTypes.some(t => googleTypeSet.has(t));
      if (relatedMatch) {
        return 10;
      }
    }
  }

  // TIER 3: No match → 0 points
  return 0;
}

/**
 * Get detailed type match information for debugging and logging
 *
 * @param nafCode - NAF/APE code from OpenData
 * @param googleTypes - types[] array from Google Places
 * @returns Match details object or undefined if data is missing
 *
 * @example
 * getTypeMatchDetails("10.71C", ["bakery", "cafe", "point_of_interest"])
 * → {
 *     nafCode: "10.71C",
 *     expectedTypes: ["bakery", "cafe", "coffee_shop", "meal_takeaway"],
 *     actualTypes: ["bakery", "cafe", "point_of_interest"],
 *     matchedTypes: ["bakery", "cafe"],
 *     matchStrength: "exact"
 *   }
 */
export function getTypeMatchDetails(
  nafCode: string | null | undefined,
  googleTypes: string[] | null | undefined
): TypeMatchDetails | undefined {
  if (!nafCode || !googleTypes) return undefined;

  const expectedTypes = getPlacesTypesForNAF(nafCode);
  const matchedTypes = googleTypes.filter(t => expectedTypes.includes(t));

  let matchStrength: 'exact' | 'related' | 'none';
  const score = scoreBusinessType(nafCode, googleTypes);

  if (score === 20) {
    matchStrength = 'exact';
  } else if (score === 10) {
    matchStrength = 'related';
  } else {
    matchStrength = 'none';
  }

  return {
    nafCode,
    expectedTypes,
    actualTypes: googleTypes,
    matchedTypes,
    matchStrength
  };
}

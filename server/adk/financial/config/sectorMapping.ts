/**
 * Sector Mapping - Central source of truth for business sectors
 *
 * Maps user-friendly display names to NAF codes (internal sector codes).
 * This mapping is used across frontend (dropdown) and backend (benchmarks).
 */

export const SECTOR_MAPPING = {
  'Commerce non spécialisé (Superette, Alimentation générale)': '47.11',
  'Tabac / Presse / Loto': '47.26',
  'Boulangerie-Pâtisserie': '10.71',
  'Restauration traditionnelle': '56.10',
  'Débits de boissons (Bar, Café)': '56.30',
  'Coiffure': '96.02',
  'Commerce spécialisé habillement': '47.7',
  'Pharmacie': '47.73',
  'Hôtellerie': '55.10',
} as const;

export type SectorDisplayName = keyof typeof SECTOR_MAPPING;
export type SectorCode = typeof SECTOR_MAPPING[SectorDisplayName];

/**
 * Get sector code from display name
 * @param displayName - User-friendly sector name
 * @returns NAF code (e.g., '47.26')
 */
export function getSectorCode(displayName: SectorDisplayName): SectorCode {
  return SECTOR_MAPPING[displayName];
}

/**
 * Get display name from sector code (for backward compatibility)
 * @param code - NAF code (e.g., '47.26')
 * @returns Display name or null if not found
 */
export function getSectorDisplayName(code: SectorCode): SectorDisplayName | null {
  const entry = Object.entries(SECTOR_MAPPING).find(([_, sectorCode]) => sectorCode === code);
  return entry ? (entry[0] as SectorDisplayName) : null;
}

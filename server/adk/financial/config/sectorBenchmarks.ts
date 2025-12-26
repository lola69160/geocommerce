/**
 * Sector Benchmarks Configuration
 *
 * Ratios moyens par code NAF pour comparaison sectorielle.
 * Sources: INSEE, Banque de France, données sectorielles 2023-2024
 */

export interface SectorBenchmark {
  nafCode: string;
  sector: string;
  ratios: {
    marge_brute_pct: number;      // Marge brute / CA
    marge_ebe_pct: number;         // EBE / CA
    marge_nette_pct: number;       // Résultat net / CA
    taux_va_pct: number;           // Valeur ajoutée / CA
    rotation_stocks_jours: number; // Stocks / (CA / 365)
    delai_clients_jours: number;   // Créances clients / (CA / 365)
    delai_fournisseurs_jours: number; // Dettes fournisseurs / (Achats / 365)
    bfr_jours_ca: number;          // BFR / (CA / 365)
    taux_endettement_pct: number;  // Dettes / Capitaux propres
  };
}

export const SECTOR_BENCHMARKS: SectorBenchmark[] = [
  // Commerce de détail alimentaire
  {
    nafCode: '47.11',
    sector: 'Commerce en magasin non spécialisé (supermarchés)',
    ratios: {
      marge_brute_pct: 22,
      marge_ebe_pct: 4.5,
      marge_nette_pct: 1.8,
      taux_va_pct: 18,
      rotation_stocks_jours: 20,
      delai_clients_jours: 5,
      delai_fournisseurs_jours: 45,
      bfr_jours_ca: -15,
      taux_endettement_pct: 120
    }
  },
  // Boulangerie-pâtisserie
  {
    nafCode: '10.71',
    sector: 'Boulangerie et boulangerie-pâtisserie',
    ratios: {
      marge_brute_pct: 65,
      marge_ebe_pct: 18,
      marge_nette_pct: 8,
      taux_va_pct: 55,
      rotation_stocks_jours: 3,
      delai_clients_jours: 2,
      delai_fournisseurs_jours: 30,
      bfr_jours_ca: -20,
      taux_endettement_pct: 80
    }
  },
  // Restaurant traditionnel
  {
    nafCode: '56.10',
    sector: 'Restauration traditionnelle',
    ratios: {
      marge_brute_pct: 70,
      marge_ebe_pct: 12,
      marge_nette_pct: 4,
      taux_va_pct: 60,
      rotation_stocks_jours: 7,
      delai_clients_jours: 3,
      delai_fournisseurs_jours: 30,
      bfr_jours_ca: -15,
      taux_endettement_pct: 100
    }
  },
  // Bar, café
  {
    nafCode: '56.30',
    sector: 'Débits de boissons',
    ratios: {
      marge_brute_pct: 75,
      marge_ebe_pct: 15,
      marge_nette_pct: 5,
      taux_va_pct: 65,
      rotation_stocks_jours: 10,
      delai_clients_jours: 2,
      delai_fournisseurs_jours: 30,
      bfr_jours_ca: -12,
      taux_endettement_pct: 90
    }
  },
  // Coiffure
  {
    nafCode: '96.02',
    sector: 'Coiffure',
    ratios: {
      marge_brute_pct: 80,
      marge_ebe_pct: 20,
      marge_nette_pct: 10,
      taux_va_pct: 70,
      rotation_stocks_jours: 30,
      delai_clients_jours: 1,
      delai_fournisseurs_jours: 30,
      bfr_jours_ca: -10,
      taux_endettement_pct: 60
    }
  },
  // Commerce de détail non alimentaire
  {
    nafCode: '47.7',
    sector: 'Commerce de détail spécialisé (habillement, chaussures)',
    ratios: {
      marge_brute_pct: 50,
      marge_ebe_pct: 8,
      marge_nette_pct: 3,
      taux_va_pct: 40,
      rotation_stocks_jours: 90,
      delai_clients_jours: 10,
      delai_fournisseurs_jours: 60,
      bfr_jours_ca: 35,
      taux_endettement_pct: 110
    }
  },
  // Pharmacie
  {
    nafCode: '47.73',
    sector: 'Commerce de détail de produits pharmaceutiques',
    ratios: {
      marge_brute_pct: 28,
      marge_ebe_pct: 10,
      marge_nette_pct: 5,
      taux_va_pct: 25,
      rotation_stocks_jours: 60,
      delai_clients_jours: 15,
      delai_fournisseurs_jours: 45,
      bfr_jours_ca: 25,
      taux_endettement_pct: 70
    }
  },
  // Hôtellerie
  {
    nafCode: '55.10',
    sector: 'Hôtels et hébergement similaire',
    ratios: {
      marge_brute_pct: 85,
      marge_ebe_pct: 25,
      marge_nette_pct: 8,
      taux_va_pct: 75,
      rotation_stocks_jours: 5,
      delai_clients_jours: 10,
      delai_fournisseurs_jours: 30,
      bfr_jours_ca: -5,
      taux_endettement_pct: 150
    }
  }
];

/**
 * Trouve le benchmark sectoriel pour un code NAF donné.
 * Supporte les matchs partiels (ex: "47.11F" matchera "47.11")
 */
export function findSectorBenchmark(nafCode: string): SectorBenchmark | null {
  if (!nafCode) return null;

  // Normaliser le code NAF (enlever lettres, espaces)
  const normalized = nafCode.replace(/[A-Z\s]/gi, '').trim();

  // Chercher match exact
  let match = SECTOR_BENCHMARKS.find(b => b.nafCode === normalized);
  if (match) return match;

  // Chercher match partiel (ex: "47.11" pour "47.11F")
  // Essayer avec les 4 premiers caractères
  const prefix4 = normalized.substring(0, 4);
  match = SECTOR_BENCHMARKS.find(b => b.nafCode.startsWith(prefix4));
  if (match) return match;

  // Essayer avec les 2 premiers (division NAF)
  const prefix2 = normalized.substring(0, 2);
  match = SECTOR_BENCHMARKS.find(b => b.nafCode.startsWith(prefix2));
  if (match) return match;

  return null;
}

/**
 * Benchmark par défaut pour secteurs non référencés
 */
export const DEFAULT_BENCHMARK: SectorBenchmark = {
  nafCode: 'DEFAULT',
  sector: 'Commerce et services (moyenne générale)',
  ratios: {
    marge_brute_pct: 45,
    marge_ebe_pct: 10,
    marge_nette_pct: 3,
    taux_va_pct: 40,
    rotation_stocks_jours: 45,
    delai_clients_jours: 30,
    delai_fournisseurs_jours: 45,
    bfr_jours_ca: 15,
    taux_endettement_pct: 100
  }
};

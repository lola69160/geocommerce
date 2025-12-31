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
  // Tabac Presse Loto (NAF 47.26Z)
  {
    nafCode: '47.26',
    sector: 'Commerce de détail de produits à base de tabac, presse et loterie',
    ratios: {
      marge_brute_pct: 66,          // Marge globale (commissions réglementées + boutique)
      marge_ebe_pct: 18,             // EBE moyen pour tabac-presse
      marge_nette_pct: 10,           // Marge nette typique
      taux_va_pct: 50,               // Forte VA car peu d'achats externes
      rotation_stocks_jours: 25,     // Stock boutique + marchandises
      delai_clients_jours: 3,        // Beaucoup de ventes cash
      delai_fournisseurs_jours: 30,  // Paiement fournisseurs standard
      bfr_jours_ca: -10,             // BFR négatif grâce au cash
      taux_endettement_pct: 90       // Endettement modéré
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
 * Find sector benchmark by exact sector code
 * @param sectorCode - NAF code (e.g., '47.26') from user selection
 * @returns SectorBenchmark or null if not found
 */
export function findSectorBenchmark(sectorCode: string): SectorBenchmark | null {
  if (!sectorCode) return null;

  // Direct lookup - user has selected exact sector from dropdown
  const benchmark = SECTOR_BENCHMARKS.find(b => b.nafCode === sectorCode);

  if (!benchmark) {
    console.warn(`⚠️ [findSectorBenchmark] No benchmark found for sector: ${sectorCode}`);
    console.warn(`Available sectors: ${SECTOR_BENCHMARKS.map(b => b.nafCode).join(', ')}`);
    return null;
  }

  console.log(`✅ [findSectorBenchmark] Found: ${benchmark.sector} (${sectorCode})`);
  return benchmark;
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

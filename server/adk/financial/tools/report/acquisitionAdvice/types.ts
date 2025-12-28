/**
 * Acquisition Advice Types
 *
 * Interfaces and constants for the acquisition advice section of financial reports.
 */

// ========================================
// BENCHMARKS SECTORIELS (Multiples de valorisation par NAF)
// ========================================
export interface SectorBenchmark {
  label: string;
  multipleEBE: { min: number; max: number };
  multipleCA: { min: number; max: number };
  specificites: string;
}

export const SECTOR_BENCHMARKS: Record<string, SectorBenchmark> = {
  '47.26Z': {
    label: 'Tabac/Presse',
    multipleEBE: { min: 3, max: 4 },
    multipleCA: { min: 0.8, max: 1.0 },
    specificites: 'Bloc reglemente valorise separement (80-100% CA tabac). Licence = barriere a l\'entree.'
  },
  '5610A': {
    label: 'Restaurant traditionnel',
    multipleEBE: { min: 3, max: 5 },
    multipleCA: { min: 0.5, max: 0.8 },
    specificites: 'Emplacement critique. Licence IV = +20-50k. Personnel cle.'
  },
  '4724Z': {
    label: 'Boulangerie-Patisserie',
    multipleEBE: { min: 3, max: 4 },
    multipleCA: { min: 0.6, max: 1.0 },
    specificites: 'Production valorisee. Equipement technique important. Savoir-faire transferable.'
  },
  '5630Z': {
    label: 'Bar/Debit de boissons',
    multipleEBE: { min: 2, max: 4 },
    multipleCA: { min: 0.4, max: 0.7 },
    specificites: 'Licence IV = +20-50k. Clientele volatile. Horaires contraignants.'
  },
  '4771Z': {
    label: 'Commerce vetements',
    multipleEBE: { min: 2, max: 3 },
    multipleCA: { min: 0.3, max: 0.5 },
    specificites: 'Stock valorise separement. Saisonnalite forte. Concurrence e-commerce.'
  },
  '4773Z': {
    label: 'Pharmacie',
    multipleEBE: { min: 5, max: 8 },
    multipleCA: { min: 0.7, max: 0.9 },
    specificites: 'Activite reglementee (diplome requis). Quotas geographiques. Marge securisee.'
  },
  '4711D': {
    label: 'Supermarche/Epicerie',
    multipleEBE: { min: 3, max: 5 },
    multipleCA: { min: 0.3, max: 0.5 },
    specificites: 'Stock important. Enseigne = franchise. Localisation critique.'
  },
  'default': {
    label: 'Commerce general',
    multipleEBE: { min: 2.5, max: 4 },
    multipleCA: { min: 0.4, max: 0.7 },
    specificites: 'Valorisation standard. Adapter selon specificites locales.'
  }
};

// ========================================
// INTERFACE POUR LE RAPPORT PROFESSIONNEL
// ========================================
export interface ProfessionalReportData {
  commune: {
    nom: string;
    population: number;
    densite: string;
    csp: string;
  };
  dynamisme: string;
  saisonnalite: {
    touristique: boolean;
    variation: string;
  };
  scores: {
    location: number;
    market: number;
    operational: number;
    financial: number;
  };
  swot: {
    forces: string[];
    faiblesses: string[];
    opportunites: string[];
    menaces: string[];
  };
  risques: Array<{
    type: string;
    severity: string;
    description: string;
    mitigation: string;
  }>;
}

// ========================================
// PARAMETRES POUR GENERATION ACQUISITION ADVICE
// ========================================
export interface AcquisitionAdviceParams {
  comptable: any;
  valorisation: any;
  immobilier: any;
  businessInfo: any;
  userComments: any;
  businessPlan: any;
  professionalData: ProfessionalReportData | null;
}

/**
 * Recupere le benchmark sectoriel pour un code NAF
 */
export function getBenchmarkByNaf(nafCode: string): SectorBenchmark {
  const cleanNaf = nafCode?.replace(/[\s.]/g, '').toUpperCase() || '';
  return SECTOR_BENCHMARKS[cleanNaf] || SECTOR_BENCHMARKS['default'];
}

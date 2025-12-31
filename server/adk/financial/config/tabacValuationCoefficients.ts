/**
 * Tabac/Presse/FDJ Valuation Coefficients Configuration
 *
 * Barèmes spécifiques pour la valorisation HYBRIDE des commerces réglementés.
 * La valorisation se base sur les COMMISSIONS NETTES (pas le CA total).
 *
 * Méthode Hybride = Bloc Réglementé (commissions × coef) + Bloc Commercial (CA × %)
 *
 * Sources:
 * - Transactions réelles tabacs-presse 2023-2024
 * - Cabinets d'expertise spécialisés (Cession de Tabac, France Presse)
 * - Bases de données professionnelles BODACC
 */

export interface TabacValuationCoefficients {
  type: string;                    // Type de commerce (urbain premium, centre-ville, etc.)
  description: string;             // Description détaillée

  // Bloc 1: Activité Réglementée (Tabac/Loto/Presse)
  blocReglemente: {
    coefficientMin: number;        // Coefficient minimum sur commissions nettes
    coefficientMedian: number;     // Coefficient médian (marché)
    coefficientMax: number;        // Coefficient maximum (transactions premium)
  };

  // Bloc 2: Activité Commerciale (Souvenirs/Confiserie/Vape/Téléphonie)
  blocCommercial: {
    pourcentageMin: number;        // % minimum sur CA boutique
    pourcentageMedian: number;     // % médian
    pourcentageMax: number;        // % maximum
  };

  // Critères de sélection automatique
  criteres: {
    population?: string;           // Ex: ">50k habitants", "10k-50k", "<10k"
    zone?: string;                 // Ex: "centre-ville", "périphérie", "rural"
    tourisme?: boolean;            // Zone touristique
    proximite?: string;            // Ex: "gare", "autoroute", "université"
  };

  // Facteurs de valorisation spécifiques
  facteursValorisants?: string[];
}

/**
 * Barèmes de valorisation Tabac/Presse/FDJ par type de commerce
 */
export const TABAC_VALUATION_COEFFICIENTS: TabacValuationCoefficients[] = [
  // 1. Tabac urbain premium
  {
    type: 'tabac_urbain_premium',
    description: 'Tabac situé en zone urbaine premium (grande ville, quartier central)',
    blocReglemente: {
      coefficientMin: 2.8,
      coefficientMedian: 3.0,
      coefficientMax: 3.2
    },
    blocCommercial: {
      pourcentageMin: 20,
      pourcentageMedian: 22,
      pourcentageMax: 25
    },
    criteres: {
      population: '>100k habitants',
      zone: 'centre-ville',
      proximite: 'commerces/bureaux'
    },
    facteursValorisants: [
      'Fort flux piéton quotidien',
      'Clientèle aisée et régulière',
      'CA FDJ/PMU élevé',
      'Diversification produits (cave à vin, épicerie fine)'
    ]
  },

  // 2. Tabac centre-ville
  {
    type: 'tabac_centre_ville',
    description: 'Tabac situé en centre-ville de ville moyenne',
    blocReglemente: {
      coefficientMin: 2.5,
      coefficientMedian: 2.65,
      coefficientMax: 2.8
    },
    blocCommercial: {
      pourcentageMin: 18,
      pourcentageMedian: 20,
      pourcentageMax: 22
    },
    criteres: {
      population: '20k-100k habitants',
      zone: 'centre-ville'
    },
    facteursValorisants: [
      'Emplacement commercial principal',
      'Clientèle mixte (résidents + passants)',
      'Bon niveau de commissions Presse/FDJ'
    ]
  },

  // 3. Tabac périphérie / zone commerciale
  {
    type: 'tabac_peripherie',
    description: 'Tabac situé en périphérie ou zone commerciale',
    blocReglemente: {
      coefficientMin: 2.0,
      coefficientMedian: 2.25,
      coefficientMax: 2.5
    },
    blocCommercial: {
      pourcentageMin: 15,
      pourcentageMedian: 17,
      pourcentageMax: 20
    },
    criteres: {
      population: '>10k habitants',
      zone: 'périphérie'
    },
    facteursValorisants: [
      'Parking disponible',
      'Clientèle motorisée',
      'Concurrence limitée à proximité'
    ]
  },

  // 4. Tabac rural
  {
    type: 'tabac_rural',
    description: 'Tabac situé en zone rurale ou petit bourg',
    blocReglemente: {
      coefficientMin: 1.8,
      coefficientMedian: 2.0,
      coefficientMax: 2.2
    },
    blocCommercial: {
      pourcentageMin: 12,
      pourcentageMedian: 15,
      pourcentageMax: 18
    },
    criteres: {
      population: '<10k habitants',
      zone: 'rural'
    },
    facteursValorisants: [
      'Monopole de fait (pas de concurrence)',
      'Clientèle très fidèle',
      'Rôle de commerce de proximité essentiel'
    ]
  },

  // 5. Tabac zone touristique / saisonnière
  {
    type: 'tabac_touristique',
    description: 'Tabac situé en zone touristique (bord de mer, montagne, etc.)',
    blocReglemente: {
      coefficientMin: 2.3,
      coefficientMedian: 2.55,
      coefficientMax: 2.8
    },
    blocCommercial: {
      pourcentageMin: 20,
      pourcentageMedian: 22,
      pourcentageMax: 25
    },
    criteres: {
      tourisme: true,
      zone: 'touristique'
    },
    facteursValorisants: [
      'Forte saisonnalité (été ou hiver)',
      'CA souvenirs et confiserie élevé',
      'Clientèle touristique à fort pouvoir d\'achat',
      'ATTENTION: Vérifier rentabilité hors saison'
    ]
  },

  // 6. Tabac gare / autoroute / aéroport
  {
    type: 'tabac_transit',
    description: 'Tabac situé en zone de transit (gare, autoroute, aéroport)',
    blocReglemente: {
      coefficientMin: 2.6,
      coefficientMedian: 2.8,
      coefficientMax: 3.0
    },
    blocCommercial: {
      pourcentageMin: 18,
      pourcentageMedian: 20,
      pourcentageMax: 23
    },
    criteres: {
      proximite: 'gare/autoroute/aéroport'
    },
    facteursValorisants: [
      'Flux de passage très important',
      'Horaires étendus (ouverture dimanche/jours fériés)',
      'CA presse journaux élevé',
      'Impulsivité d\'achat élevée'
    ]
  },

  // 7. Tabac université / zone étudiante
  {
    type: 'tabac_etudiant',
    description: 'Tabac situé à proximité d\'université ou zone étudiante',
    blocReglemente: {
      coefficientMin: 2.2,
      coefficientMedian: 2.4,
      coefficientMax: 2.6
    },
    blocCommercial: {
      pourcentageMin: 15,
      pourcentageMedian: 18,
      pourcentageMax: 20
    },
    criteres: {
      proximite: 'université'
    },
    facteursValorisants: [
      'Clientèle jeune et régulière',
      'CA tabac roulé et vape élevé',
      'FDJ limité (pouvoir d\'achat étudiant)',
      'ATTENTION: Fermeture vacances scolaires'
    ]
  }
];

/**
 * Détecte automatiquement le type de commerce Tabac en fonction des critères.
 *
 * @param population - Population de la commune (nombre d'habitants)
 * @param zone - Type de zone (centre-ville, périphérie, rural, touristique)
 * @param tourisme - Zone touristique (true/false)
 * @param proximite - Proximité d'un élément clé (gare, autoroute, université, etc.)
 * @returns Le barème de valorisation le plus adapté
 */
export function detectTabacType(params: {
  population?: number;
  zone?: string;
  tourisme?: boolean;
  proximite?: string;
}): TabacValuationCoefficients {
  const { population, zone, tourisme, proximite } = params;

  // Priorité 1: Zone de transit (gare, autoroute, aéroport)
  if (proximite && ['gare', 'autoroute', 'aéroport'].some(p => proximite.toLowerCase().includes(p))) {
    return TABAC_VALUATION_COEFFICIENTS.find(c => c.type === 'tabac_transit')!;
  }

  // Priorité 2: Zone touristique
  if (tourisme === true || (zone && zone.toLowerCase().includes('touristique'))) {
    return TABAC_VALUATION_COEFFICIENTS.find(c => c.type === 'tabac_touristique')!;
  }

  // Priorité 3: Zone étudiante
  if (proximite && proximite.toLowerCase().includes('université')) {
    return TABAC_VALUATION_COEFFICIENTS.find(c => c.type === 'tabac_etudiant')!;
  }

  // Priorité 4: Basé sur population et zone
  if (population) {
    if (population > 100000 && zone === 'centre-ville') {
      return TABAC_VALUATION_COEFFICIENTS.find(c => c.type === 'tabac_urbain_premium')!;
    } else if (population >= 20000 && zone === 'centre-ville') {
      return TABAC_VALUATION_COEFFICIENTS.find(c => c.type === 'tabac_centre_ville')!;
    } else if (population >= 10000 && zone === 'périphérie') {
      return TABAC_VALUATION_COEFFICIENTS.find(c => c.type === 'tabac_peripherie')!;
    } else if (population < 10000) {
      return TABAC_VALUATION_COEFFICIENTS.find(c => c.type === 'tabac_rural')!;
    }
  }

  // Priorité 5: Basé sur zone uniquement
  if (zone) {
    if (zone.toLowerCase().includes('centre')) {
      return TABAC_VALUATION_COEFFICIENTS.find(c => c.type === 'tabac_centre_ville')!;
    } else if (zone.toLowerCase().includes('périphérie')) {
      return TABAC_VALUATION_COEFFICIENTS.find(c => c.type === 'tabac_peripherie')!;
    } else if (zone.toLowerCase().includes('rural')) {
      return TABAC_VALUATION_COEFFICIENTS.find(c => c.type === 'tabac_rural')!;
    }
  }

  // Par défaut: Tabac centre-ville (profil moyen)
  return TABAC_VALUATION_COEFFICIENTS.find(c => c.type === 'tabac_centre_ville')!;
}

/**
 * Codes NAF correspondant aux commerces Tabac/Presse/FDJ
 */
export const TABAC_NAF_CODES = [
  '47.26',   // Commerce de détail de produits à base de tabac en magasin spécialisé
  '47.26Z',  // Idem (avec lettre)
  '47.62',   // Commerce de détail de journaux et papeterie (Presse)
  '47.62Z'   // Idem (avec lettre)
];

/**
 * Mots-clés indiquant un commerce Tabac/Presse/FDJ dans l'activité
 */
export const TABAC_ACTIVITY_KEYWORDS = ['tabac', 'presse', 'fdj', 'loto', 'pmu'];

/**
 * Détecte si un commerce est de type Tabac/Presse/Loto
 *
 * ⚠️ RÈGLE STRICTE (2025-12-31):
 * - Source unique: secteur sélectionné par l'utilisateur (businessInfo.secteurActivite)
 * - Ne JAMAIS utiliser le code NAF de l'API
 * - Vérification par égalité stricte (pas de .includes() ou .startsWith())
 *
 * @param sectorCode - Code secteur du formulaire (ex: '47.26', '47.62')
 * @returns true si secteur Tabac/Presse détecté
 */
export function isTabacCommerce(sectorCode: string): boolean {
  if (!sectorCode) {
    console.warn('[isTabacCommerce] ⚠️ sectorCode vide - retour false');
    return false;
  }

  // Normaliser (retirer espaces et lettres pour gérer '47.26Z' comme '47.26')
  const normalized = sectorCode.replace(/[A-Z\s]/gi, '').trim();

  // Vérification stricte: égalité exacte avec les codes Tabac
  const isTabac = normalized === '47.26' || normalized === '47.62';

  if (isTabac) {
    console.log(`[isTabacCommerce] ✅ TABAC détecté: secteur=${sectorCode}`);
  }

  return isTabac;
}

/**
 * Barème par défaut pour Tabac (centre-ville moyen)
 */
export const DEFAULT_TABAC_COEFFICIENTS = TABAC_VALUATION_COEFFICIENTS.find(
  c => c.type === 'tabac_centre_ville'
)!;

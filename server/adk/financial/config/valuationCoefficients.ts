/**
 * Valuation Coefficients Configuration
 *
 * Coefficients de valorisation par code NAF (multiples d'EBE, % CA).
 * Sources: Transactions réelles (BODACC), cabinets d'expertise, bases de données professionnelles 2023-2024
 */

export interface ValuationCoefficients {
  nafCode: string;
  sector: string;

  // Multiple d'EBE (la plus utilisée)
  ebeMultiple: {
    bas: number;      // Multiple bas (transactions défavorables)
    median: number;   // Multiple médian (marché)
    haut: number;     // Multiple haut (transactions premium)
  };

  // Pourcentage du CA
  caPercentage: {
    bas: number;      // % bas
    median: number;   // % médian
    haut: number;     // % haut
  };

  // Facteurs spécifiques au secteur
  specificFactors?: string[];
}

export const VALUATION_COEFFICIENTS: ValuationCoefficients[] = [
  // Tabac-presse
  {
    nafCode: '47.26',
    sector: 'Commerce de détail de produits à base de tabac',
    ebeMultiple: { bas: 2.5, median: 3.5, haut: 4.5 },
    caPercentage: { bas: 50, median: 65, haut: 80 },
    specificFactors: ['Emplacement critique', 'Licence tabac valorisée', 'Clientèle fidèle']
  },

  // Restaurant traditionnel
  {
    nafCode: '56.10',
    sector: 'Restauration traditionnelle',
    ebeMultiple: { bas: 2.0, median: 3.0, haut: 4.0 },
    caPercentage: { bas: 50, median: 70, haut: 90 },
    specificFactors: ['Qualité emplacement', 'Réputation établie', 'Terrasse/parking']
  },

  // Boulangerie-pâtisserie
  {
    nafCode: '10.71',
    sector: 'Boulangerie et boulangerie-pâtisserie',
    ebeMultiple: { bas: 3.0, median: 4.0, haut: 5.0 },
    caPercentage: { bas: 60, median: 80, haut: 100 },
    specificFactors: ['Zone chalandise', 'Qualité produits', 'Main d\'œuvre qualifiée']
  },

  // Épicerie
  {
    nafCode: '47.11',
    sector: 'Commerce en magasin non spécialisé',
    ebeMultiple: { bas: 2.0, median: 2.5, haut: 3.0 },
    caPercentage: { bas: 30, median: 40, haut: 50 },
    specificFactors: ['Concurrence supermarché', 'Clientèle proximité', 'Horaires étendus']
  },

  // Bar, café
  {
    nafCode: '56.30',
    sector: 'Débits de boissons',
    ebeMultiple: { bas: 2.5, median: 3.5, haut: 4.5 },
    caPercentage: { bas: 60, median: 75, haut: 90 },
    specificFactors: ['Licence IV valorisée', 'Terrasse', 'Flux de passage']
  },

  // Coiffure
  {
    nafCode: '96.02',
    sector: 'Coiffure',
    ebeMultiple: { bas: 2.0, median: 3.0, haut: 4.0 },
    caPercentage: { bas: 40, median: 55, haut: 70 },
    specificFactors: ['Clientèle fidèle', 'Équipe qualifiée', 'Modernité équipements']
  },

  // Commerce de détail habillement
  {
    nafCode: '47.71',
    sector: 'Commerce de détail d\'habillement',
    ebeMultiple: { bas: 1.5, median: 2.5, haut: 3.5 },
    caPercentage: { bas: 30, median: 45, haut: 60 },
    specificFactors: ['Zone commerciale', 'Marques distribuées', 'Stocks à valoriser séparément']
  },

  // Pharmacie
  {
    nafCode: '47.73',
    sector: 'Commerce de détail de produits pharmaceutiques',
    ebeMultiple: { bas: 4.0, median: 5.5, haut: 7.0 },
    caPercentage: { bas: 70, median: 90, haut: 110 },
    specificFactors: ['Licence valorisée', 'Zone de chalandise', 'Ordonnancier']
  },

  // Hôtellerie
  {
    nafCode: '55.10',
    sector: 'Hôtels et hébergement similaire',
    ebeMultiple: { bas: 3.5, median: 5.0, haut: 7.0 },
    caPercentage: { bas: 80, median: 120, haut: 160 },
    specificFactors: ['Murs souvent inclus', 'Classification étoiles', 'Taux d\'occupation']
  },

  // Boucherie-charcuterie
  {
    nafCode: '47.22',
    sector: 'Boucherie-charcuterie',
    ebeMultiple: { bas: 2.5, median: 3.5, haut: 4.5 },
    caPercentage: { bas: 50, median: 65, haut: 80 },
    specificFactors: ['Savoir-faire', 'Clientèle fidèle', 'Hygiène irréprochable']
  },

  // Fleuriste
  {
    nafCode: '47.76',
    sector: 'Commerce de détail de fleurs',
    ebeMultiple: { bas: 2.0, median: 3.0, haut: 4.0 },
    caPercentage: { bas: 40, median: 55, haut: 70 },
    specificFactors: ['Emplacement', 'Événementiel (mariages)', 'Périssabilité stocks']
  }
];

/**
 * Trouve les coefficients de valorisation pour un code NAF donné.
 * Supporte les matchs partiels (ex: "47.26Z" matchera "47.26")
 */
export function findValuationCoefficients(nafCode: string): ValuationCoefficients | null {
  if (!nafCode) return null;

  // Normaliser le code NAF (enlever lettres, espaces)
  const normalized = nafCode.replace(/[A-Z\s]/gi, '').trim();

  // Chercher match exact
  let match = VALUATION_COEFFICIENTS.find(c => c.nafCode === normalized);
  if (match) return match;

  // Chercher match partiel (ex: "47.26" pour "47.26Z")
  // Essayer avec les 5 premiers caractères
  const prefix5 = normalized.substring(0, 5);
  match = VALUATION_COEFFICIENTS.find(c => c.nafCode === prefix5);
  if (match) return match;

  // Essayer avec les 4 premiers caractères
  const prefix4 = normalized.substring(0, 4);
  match = VALUATION_COEFFICIENTS.find(c => c.nafCode.startsWith(prefix4));
  if (match) return match;

  // Essayer avec les 2 premiers (division NAF)
  const prefix2 = normalized.substring(0, 2);
  match = VALUATION_COEFFICIENTS.find(c => c.nafCode.startsWith(prefix2));
  if (match) return match;

  return null;
}

/**
 * Coefficients par défaut pour secteurs non référencés
 */
export const DEFAULT_VALUATION_COEFFICIENTS: ValuationCoefficients = {
  nafCode: 'DEFAULT',
  sector: 'Commerce et services (coefficients moyens)',
  ebeMultiple: { bas: 2.0, median: 3.0, haut: 4.0 },
  caPercentage: { bas: 40, median: 60, haut: 80 },
  specificFactors: ['Valorisation générique', 'À affiner selon spécificités']
};

/**
 * Retraitements comptables standards pour EBE
 * (à ajouter ou retrancher de l'EBE comptable pour obtenir l'EBE économique)
 */
export const STANDARD_RETRAITEMENTS = {
  // Salaire de gérant non rémunéré (à ajouter)
  SALAIRE_GERANT_ESTIMATION: 35000,

  // Loyer commercial vs loyer de marché (à ajuster)
  LOYER_MARCHE_RATIO: 1.0, // À ajuster selon contexte

  // Charges exceptionnelles non récurrentes (à retrancher)
  // Ex: travaux, litiges, etc.
};

/**
 * Alert Rules Schema
 *
 * Interfaces TypeScript pour le systeme d'alertes deterministes.
 * Les alertes sont generees par des regles avec seuils fixes,
 * garantissant la reproductibilite des resultats.
 */

/**
 * Categories d'alertes pour le regroupement
 */
export type AlertCategory =
  | 'rentabilite'      // Problemes de rentabilite (EBE, marges, resultat)
  | 'endettement'      // Problemes d'endettement/solvabilite
  | 'croissance'       // Problemes de croissance/activite
  | 'tresorerie'       // Problemes de tresorerie/liquidite
  | 'valorisation'     // Incoherences de valorisation
  | 'immobilier'       // Problemes immobiliers
  | 'donnees';         // Problemes de qualite des donnees

/**
 * Niveaux de severite
 */
export type AlertSeverity = 'critical' | 'warning' | 'info';

/**
 * Structure d'une alerte deterministe
 */
export interface DeterministicAlert {
  id: string;                    // Identifiant unique (ex: "RENT_001")
  category: AlertCategory;       // Categorie de l'alerte
  severity: AlertSeverity;       // Niveau de severite
  title: string;                 // Titre court
  message: string;               // Message detaille avec valeurs
  impact: string;                // Impact business
  recommendation: string;        // Action recommandee
  values: Record<string, any>;   // Valeurs qui ont declenche l'alerte
}

/**
 * Contexte pour l'evaluation des regles
 * Contient toutes les donnees necessaires depuis le state
 */
export interface AlertEvaluationContext {
  comptable: {
    sig?: Record<string, {
      chiffre_affaires: number;
      marge_commerciale: number;
      valeur_ajoutee: number;
      ebe: number;
      resultat_exploitation: number;
      resultat_net: number;
    }>;
    ratios?: {
      marge_brute_pct: number;
      marge_ebe_pct: number;
      marge_nette_pct: number;
      taux_va_pct: number;
      rotation_stocks_jours: number;
      delai_clients_jours: number;
      delai_fournisseurs_jours: number;
      bfr_jours_ca: number;
      taux_endettement_pct: number;
      capacite_autofinancement: number;
    };
    evolution?: {
      tendance: 'croissance' | 'stable' | 'declin';
      ca_evolution_pct: number;
      ebe_evolution_pct: number;
    };
    ebeRetraitement?: {
      ebe_comptable: number;
      ebe_normatif: number;
      annee_reference: string;
    };
    yearsAnalyzed?: string[];
    benchmark?: {
      nafCode: string;
      sector: string;
      comparisons: Array<{
        ratio: string;
        value: number;
        sectorAverage: number;
        position: 'superieur' | 'conforme' | 'inferieur';
        deviation_pct: number;
      }>;
    };
  } | null;
  valorisation: {
    methodes?: {
      ebe?: { valorisation: number; ebe_reference: number };
      ca?: { valorisation: number };
      patrimoniale?: { valorisation: number };
    };
    synthese?: {
      valeur_recommandee: number;
      fourchette_basse: number;
      fourchette_haute: number;
    };
    methodeHybride?: {
      valorisationTotale: {
        valeurMediane: number;
        valeurBasse: number;
        valeurHaute: number;
      };
    };
  } | null;
  immobilier: {
    synthese?: {
      loyer_mensuel: number;
      murs_prix_estime: number;
      bail_duree_restante_mois: number;
      bail_present: boolean;
    };
  } | null;
  documentExtraction: {
    documents?: Array<{
      documentType: string;
      year: number;
    }>;
  } | null;
  businessInfo: {
    nafCode: string;
    activity: string;
    name: string;
    siret: string;
    prixDemande?: number;
  } | null;
  benchmark: {
    nafCode: string;
    sector: string;
    ratios: {
      marge_brute_pct: number;
      marge_ebe_pct: number;
      marge_nette_pct: number;
      taux_va_pct: number;
      rotation_stocks_jours: number;
      delai_clients_jours: number;
      delai_fournisseurs_jours: number;
      bfr_jours_ca: number;
      taux_endettement_pct: number;
    };
  } | null;
}

/**
 * Definition d'une regle d'alerte
 */
export interface AlertRule {
  id: string;                                                    // Identifiant unique
  category: AlertCategory;                                       // Categorie
  severity: AlertSeverity;                                       // Severite
  condition: (ctx: AlertEvaluationContext) => boolean;           // Condition d'activation
  extractValues: (ctx: AlertEvaluationContext) => Record<string, any>; // Extraction des valeurs
  titleTemplate: string;                                         // Template du titre
  messageTemplate: (values: Record<string, any>) => string;      // Template du message
  impactTemplate: string;                                        // Impact business
  recommendationTemplate: string;                                // Recommandation
}

/**
 * Resultat de la generation d'alertes
 */
export interface DeterministicAlertsResult {
  alerts: DeterministicAlert[];
  summary: {
    totalAlerts: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    categoryCounts: Record<AlertCategory, number>;
  };
  pointsVigilance: string[];  // Pour compatibilite avec le format actuel
}

import type {
  Conflict,
  ConflictType,
  ConflictSeverity,
  Resolution,
  ResolutionType
} from '../schemas';

/**
 * Types liés aux conflits et à l'arbitrage
 */

/**
 * Détecteur de conflit - fonction qui compare deux sources de données
 */
export type ConflictDetector = (
  sourceA: any,
  sourceB: any,
  context?: any
) => Conflict | null;

/**
 * Résolveur de conflit - fonction qui arbitre un conflit
 */
export type ConflictResolver = (
  conflict: Conflict,
  state: any
) => Promise<Resolution>;

/**
 * Registre de détecteurs de conflits par type
 */
export interface ConflictDetectorRegistry {
  POPULATION_POI_MISMATCH: ConflictDetector;
  CSP_PRICING_MISMATCH: ConflictDetector;
  RATING_PHOTOS_MISMATCH: ConflictDetector;
  DATA_INCONSISTENCY: ConflictDetector;
  SCORE_MISMATCH: ConflictDetector;
  GEOGRAPHIC_MISMATCH: ConflictDetector;
}

/**
 * Règle de priorité des sources
 */
export interface SourcePriority {
  agent: string;
  reliability: number; // 0-1 (1 = max fiabilité)
  dataType: 'measurement' | 'estimation' | 'external_api' | 'ai_analysis';
  reason: string;
}

/**
 * Matrice de priorité des sources par type de conflit
 */
export type SourcePriorityMatrix = Record<ConflictType, SourcePriority[]>;

/**
 * Résultat de validation croisée
 */
export interface CrossValidationResult {
  pairA: string; // Agent A
  pairB: string; // Agent B
  field: string; // Champ comparé
  valueA: any;
  valueB: any;
  consistent: boolean;
  deviation?: number; // Écart si numérique
  conflict?: Conflict;
}

/**
 * Configuration de seuils pour détection de conflits
 */
export interface ConflictThresholds {
  // Seuils numériques
  population_poi_ratio_min: number;
  population_poi_ratio_max: number;
  price_csp_mismatch_threshold: number;
  rating_photo_gap_threshold: number;
  geographic_distance_max: number; // mètres

  // Seuils de sévérité
  severity_thresholds: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

/**
 * Export des types from schemas
 */
export type { Conflict, ConflictType, ConflictSeverity, Resolution, ResolutionType };

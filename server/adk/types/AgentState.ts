import type {
  BusinessInput,
  PreparationOutput,
  DemographicOutput,
  PlacesOutput,
  PhotoAnalysisOutput,
  CompetitorOutput,
  ValidationOutput,
  GapOutput,
  ArbitrationOutput,
  StrategicOutput,
  ReportOutput
} from '../schemas';

/**
 * AgentState - État partagé central du pipeline
 *
 * Chaque agent reçoit le state complet et ajoute ses résultats via outputKey.
 * Le state est immutable - ADK gère automatiquement les mises à jour.
 *
 * Flux:
 * 1. business (input initial)
 * 2. preparation → state.preparation
 * 3. demographic → state.demographic
 * 4. places → state.places
 * 5. photo → state.photo
 * 6. competitor → state.competitor
 * 7. validation → state.validation (NOUVEAU - détecte conflits)
 * 8. gap → state.gap
 * 9. arbitration → state.arbitration (NOUVEAU - résout conflits)
 * 10. strategic → state.strategic
 * 11. report → state.report
 */

export interface AgentState {
  // Input initial (obligatoire)
  business: BusinessInput;

  // Outputs agents (tous optionnels - ajoutés progressivement)
  preparation?: PreparationOutput;
  demographic?: DemographicOutput;
  places?: PlacesOutput;
  photo?: PhotoAnalysisOutput;
  competitor?: CompetitorOutput;
  validation?: ValidationOutput;       // NOUVEAU
  gap?: GapOutput;
  arbitration?: ArbitrationOutput;     // NOUVEAU
  strategic?: StrategicOutput;
  report?: ReportOutput;

  // Métadonnées pipeline
  metadata?: {
    startTime: number;
    duration?: number;
    completedAt?: string;
    siret: string;
    agentsExecuted?: number;
    agentsFailed?: number;
  };

  // Historique erreurs (pour debugging)
  errors?: Array<{
    agent: string;
    error: string;
    timestamp: string;
  }>;
}

/**
 * Type helper pour state partiel (utile pour tests)
 */
export type PartialAgentState = Partial<AgentState> & {
  business: BusinessInput;
};

/**
 * Type pour callbacks de progression
 */
export type ProgressCallback = (
  agentName: string,
  status: 'running' | 'completed' | 'failed',
  result?: any
) => void;

/**
 * Config globale du pipeline
 */
export interface PipelineConfig {
  enableValidation?: boolean;
  enableArbitration?: boolean;
  maxClarifications?: number;
  conflictSeverityThreshold?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  continueOnError?: boolean;
  timeout?: number;
}

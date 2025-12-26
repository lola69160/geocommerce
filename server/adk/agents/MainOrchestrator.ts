import { SequentialAgent } from '@google/adk';
import { PreparationAgent } from './PreparationAgent.js';
import { DemographicAgent } from './DemographicAgent.js';
import { PlacesAgent } from './PlacesAgent.js';
import { PhotoAnalysisAgent } from './PhotoAnalysisAgent.js';
import { CompetitorAgent } from './CompetitorAgent.js';
import { ValidationAgent } from './ValidationAgent.js';
import { GapAnalysisAgent } from './GapAnalysisAgent.js';
import { ArbitratorAgent } from './ArbitratorAgent.js';
import { StrategicAgent } from './StrategicAgent.js';
import { ReportAgent } from './ReportAgent.js';
import type { AgentState } from '../types/index.js';

/**
 * MainOrchestrator - Orchestrateur principal du pipeline (ADK)
 *
 * SequentialAgent pur suivant les patterns ADK officiels (état de l'art).
 * Orchestre 10 agents spécialisés dans l'ordre séquentiel pour produire
 * une analyse professionnelle complète.
 *
 * Pipeline (ordre d'exécution):
 * 1. PreparationAgent - Normalisation adresse + extraction GPS
 * 2. DemographicAgent - Analyse démographique + potentiel zone
 * 3. PlacesAgent - Enrichissement Google Places (photos, avis)
 * 4. PhotoAnalysisAgent - Analyse Gemini Vision (état, travaux)
 * 5. CompetitorAgent - Analyse concurrentielle POI
 * 6. ValidationAgent - Validation croisée + détection conflits
 * 7. GapAnalysisAgent - Scores multi-dimensionnels + risques
 * 8. ArbitratorAgent - Résolution conflits détectés
 * 9. StrategicAgent - Recommandation GO/NO-GO finale
 * 10. ReportAgent - Génération rapport HTML
 *
 * Pattern ADK (État de l'art):
 * - SequentialAgent directement comme root agent (pas de wrapper LlmAgent)
 * - Pas de handoff inutile (évite UNKNOWN_ERROR)
 * - Runner créé au niveau application (endpoint Express)
 * - State flow automatique via outputKey de chaque agent
 * - Callbacks standard ADK (beforeAgentRun, afterAgentRun)
 * - continueOnError: true pour résilience
 *
 * Usage (dans endpoint Express):
 * ```javascript
 * const orchestrator = createMainOrchestrator({
 *   beforeAgentRun: (agentName, state) => logger.info(`Starting ${agentName}`),
 *   afterAgentRun: (agentName, state, result, error) => {
 *     if (error) logger.error(`${agentName} failed`, error);
 *   }
 * });
 *
 * const runner = new Runner({ appName, agent: orchestrator, sessionService });
 * for await (const event of runner.runAsync(...)) { ... }
 * ```
 */

/**
 * Crée l'orchestrateur principal - SequentialAgent direct (État de l'art ADK)
 *
 * Plus de wrapper LlmAgent = plus de handoff inutile = plus d'UNKNOWN_ERROR
 *
 * Les callbacks beforeAgentRun/afterAgentRun sont gérés au niveau du Runner (dans server.js)
 */
export function createMainOrchestrator(): SequentialAgent {
  return new SequentialAgent({
    name: 'professional_analysis_pipeline',
    description: 'Sequential execution of 10 specialized agents for professional business analysis',

    subAgents: [
      new PreparationAgent(),
      new DemographicAgent(),
      new PlacesAgent(),
      new PhotoAnalysisAgent(),
      new CompetitorAgent(),
      new ValidationAgent(),
      new GapAnalysisAgent(),
      new ArbitratorAgent(),
      new StrategicAgent(),
      new ReportAgent()
    ]
  });
}

/**
 * Export pour compatibilité avec ancien code
 * @deprecated Use createMainOrchestrator() instead
 */
export const MainOrchestrator = createMainOrchestrator;

export default createMainOrchestrator;

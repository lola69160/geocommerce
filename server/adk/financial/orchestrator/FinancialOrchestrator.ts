import { SequentialAgent } from '@google/adk';
import { ComptaPreprocessingAgent } from '../agents/ComptaPreprocessingAgent';
import { DocumentExtractionAgent } from '../agents/DocumentExtractionAgent';
import { ComptableAgent } from '../agents/ComptableAgent';
import { ValorisationAgent } from '../agents/ValorisationAgent';
import { ImmobilierAgent } from '../agents/ImmobilierAgent';
import { FinancialValidationAgent } from '../agents/FinancialValidationAgent';
import { FinancialReportAgent } from '../agents/FinancialReportAgent';

/**
 * FinancialOrchestrator - Orchestrateur du Pipeline Financier (ADK)
 *
 * SequentialAgent pur suivant les patterns ADK officiels (état de l'art).
 * Orchestre 7 agents spécialisés dans l'ordre séquentiel pour produire
 * une analyse financière complète avec rapport HTML professionnel.
 *
 * Pipeline (ordre d'exécution):
 * 0. ComptaPreprocessingAgent - Preprocessing documents COMPTA (extraction pages pertinentes)
 * 1. DocumentExtractionAgent - Extraction et classification documents PDF
 * 2. ComptableAgent - Analyse comptable (SIG, ratios, benchmark, santé)
 * 3. ValorisationAgent - Valorisation entreprise (3 méthodes: EBE, CA, Patrimoniale)
 * 4. ImmobilierAgent - Analyse immobilière (bail, murs, travaux)
 * 5. FinancialValidationAgent - Validation croisée et contrôle qualité
 * 6. FinancialReportAgent - Génération rapport HTML professionnel
 *
 * Pattern ADK (État de l'art):
 * - SequentialAgent directement comme root agent (pas de wrapper LlmAgent)
 * - Pas de handoff inutile (évite UNKNOWN_ERROR)
 * - Runner créé au niveau application (endpoint Express)
 * - State flow automatique via outputKey de chaque agent
 * - Callbacks standard ADK (beforeAgentRun, afterAgentRun)
 * - continueOnError: true pour résilience
 *
 * Input State attendu:
 * {
 *   documents: [
 *     { filename: string, content?: Buffer|string, filePath?: string }
 *   ],
 *   businessInfo: {
 *     name: string,
 *     siret: string,
 *     nafCode: string,
 *     activity: string
 *   },
 *   options?: {
 *     prixAffiche?: number,
 *     includeImmobilier?: boolean
 *   }
 * }
 *
 * Output State (après exécution):
 * {
 *   comptaPreprocessing: { skipped: boolean, originalDocuments: [...], consolidatedDocuments: [...] },
 *   documentExtraction: { documents: [...], summary: {...} },
 *   comptable: { sig: {...}, ratios: {...}, evolution: {...}, benchmark: {...}, healthScore: {...} },
 *   valorisation: { methodes: {...}, synthese: {...}, comparaisonPrix: {...} },
 *   immobilier: { bail: {...}, murs: {...}, travaux: {...}, synthese: {...} },
 *   financialValidation: { coherenceChecks: [...], anomalies: [...], confidenceScore: {...} },
 *   financialReport: { generated: true, filepath: "...", filename: "...", size_bytes: ... }
 * }
 *
 * Usage (dans endpoint Express):
 * ```javascript
 * const orchestrator = createFinancialOrchestrator();
 *
 * const runner = new Runner({
 *   appName: 'financial',
 *   agent: orchestrator,
 *   sessionService: new InMemorySessionService()
 * });
 *
 * for await (const event of runner.runAsync({
 *   userId: 'user1',
 *   sessionId: 'session1',
 *   stateDelta: { documents: [...], businessInfo: {...} }
 * })) {
 *   if (event.actions?.stateDelta) {
 *     console.log('State updated:', Object.keys(event.actions.stateDelta));
 *   }
 * }
 * ```
 */

/**
 * Crée l'orchestrateur du pipeline financier - SequentialAgent direct (État de l'art ADK)
 *
 * Plus de wrapper LlmAgent = plus de handoff inutile = plus d'UNKNOWN_ERROR
 *
 * Les callbacks beforeAgentRun/afterAgentRun sont gérés au niveau du Runner (dans server.js)
 *
 * @param options - Options de configuration du pipeline
 * @param options.extractionOnly - Si true, exécute uniquement DocumentExtractionAgent (debug)
 */
export function createFinancialOrchestrator(options?: { extractionOnly?: boolean }): SequentialAgent {
  // Mode debug : seulement extraction pour tester Gemini Vision
  if (options?.extractionOnly) {
    console.log('🔧 [FinancialOrchestrator] Mode EXTRACTION ONLY activé (debug)');
    return new SequentialAgent({
      name: 'financial_extraction_only',
      description: 'Extraction only mode - runs DocumentExtractionAgent for debugging Gemini Vision',

      subAgents: [
        new DocumentExtractionAgent()   // 1. Extract PDF data (ONLY)
      ]
    });
  }

  // Mode complet : tous les 7 agents
  return new SequentialAgent({
    name: 'financial_analysis_pipeline',
    description: 'Sequential execution of 7 specialized agents for complete financial analysis with professional HTML report',

    subAgents: [
      new ComptaPreprocessingAgent(),  // 0. Preprocess COMPTA documents (extract relevant pages)
      new DocumentExtractionAgent(),   // 1. Extract PDF data
      new ComptableAgent(),             // 2. Accounting analysis
      new ValorisationAgent(),          // 3. Business valuation (3 methods)
      new ImmobilierAgent(),            // 4. Real estate analysis
      new FinancialValidationAgent(),   // 5. Cross-validation & quality control
      new FinancialReportAgent()        // 6. HTML report generation
    ]
  });
}

/**
 * Export pour compatibilité
 */
export const FinancialOrchestrator = createFinancialOrchestrator;

export default createFinancialOrchestrator;

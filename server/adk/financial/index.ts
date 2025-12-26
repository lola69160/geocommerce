/**
 * Financial Pipeline - Entry Point
 *
 * Pipeline autonome pour l'analyse de documents comptables (bilans, liasses fiscales)
 * Produit une analyse de niveau expert-comptable avec rapport HTML indépendant.
 *
 * ARCHITECTURE:
 * - Orchestrator: SequentialAgent avec 6 agents spécialisés
 * - State: AgentState partagé via outputKey (pattern ADK officiel)
 * - Tools: FunctionTool avec validation Zod
 * - Model: Gemini 2.5 Flash Lite (multimodal, 1M tokens, gratuit)
 */

import { SequentialAgent } from '@google/adk';
import { DocumentExtractionAgent } from './agents/DocumentExtractionAgent';
import { ComptableAgent } from './agents/ComptableAgent';
import { ValorisationAgent } from './agents/ValorisationAgent';
import { ImmobilierAgent } from './agents/ImmobilierAgent';

/**
 * Financial Orchestrator (placeholder)
 *
 * À implémenter: SequentialAgent orchestrant 6 agents
 * 1. DocumentExtractionAgent - Extraction données PDF ✅ IMPLEMENTED
 * 2. ComptableAgent - Analyse comptable ratios ✅ IMPLEMENTED
 * 3. ValorisationAgent - Valorisation entreprise ✅ IMPLEMENTED
 * 4. ImmobilierAgent - Analyse immobilier pro ✅ IMPLEMENTED
 * 5. FinancialValidationAgent - Validation cohérence
 * 6. FinancialReportAgent - Génération rapport HTML
 */
export function createFinancialOrchestrator(): SequentialAgent {
  // Placeholder - sera implémenté avec les agents
  throw new Error('FinancialOrchestrator not yet implemented - structure ready for agent implementation');
}

// Export agents
export { DocumentExtractionAgent } from './agents/DocumentExtractionAgent';
export { ComptableAgent } from './agents/ComptableAgent';
export { ValorisationAgent } from './agents/ValorisationAgent';
export { ImmobilierAgent } from './agents/ImmobilierAgent';

// Export types
export type FinancialInput = {
  businessId: string;
  documents: Array<{
    filename: string;
    filePath?: string;
    content?: Buffer | string;
  }>;
  businessInfo?: {
    name: string;
    siret: string;
    nafCode: string;
    activity: string;
  };
};

export type FinancialState = {
  documentExtraction?: any;
  comptable?: any;
  valorisation?: any;
  immobilier?: any;
  financialValidation?: any;
  financialReport?: any;
};

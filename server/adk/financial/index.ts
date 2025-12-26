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

import { SequentialAgent } from '@googleadk/agent';

/**
 * Financial Orchestrator (placeholder)
 *
 * À implémenter: SequentialAgent orchestrant 6 agents
 * 1. DocumentExtractionAgent - Extraction données PDF
 * 2. ComptableAgent - Analyse comptable ratios
 * 3. ValorisationAgent - Valorisation entreprise
 * 4. ImmobilierAgent - Analyse immobilier pro
 * 5. FinancialValidationAgent - Validation cohérence
 * 6. FinancialReportAgent - Génération rapport HTML
 */
export function createFinancialOrchestrator(): SequentialAgent {
  // Placeholder - sera implémenté avec les agents
  throw new Error('FinancialOrchestrator not yet implemented - structure ready for agent implementation');
}

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

/**
 * Financial Pipeline - Entry Point
 *
 * Pipeline autonome pour l'analyse de documents comptables (bilans, liasses fiscales)
 * Produit une analyse de niveau expert-comptable avec rapport HTML indépendant.
 *
 * ARCHITECTURE:
 * - Orchestrator: SequentialAgent avec 7 agents spécialisés
 * - State: AgentState partagé via outputKey (pattern ADK officiel)
 * - Tools: FunctionTool avec validation Zod
 * - Model: Gemini 2.5 Flash Lite (multimodal, 1M tokens, gratuit)
 */

import { SequentialAgent } from '@google/adk';
import { ComptaPreprocessingAgent } from './agents/ComptaPreprocessingAgent';
import { DocumentExtractionAgent } from './agents/DocumentExtractionAgent';
import { ComptableAgent } from './agents/ComptableAgent';
import { ValorisationAgent } from './agents/ValorisationAgent';
import { ImmobilierAgent } from './agents/ImmobilierAgent';
import { FinancialValidationAgent } from './agents/FinancialValidationAgent';
import { FinancialReportAgent } from './agents/FinancialReportAgent';

/**
 * Financial Orchestrator
 *
 * SequentialAgent orchestrant 7 agents spécialisés :
 * 0. ComptaPreprocessingAgent - Preprocessing documents COMPTA ✅ IMPLEMENTED
 * 1. DocumentExtractionAgent - Extraction données PDF ✅ IMPLEMENTED
 * 2. ComptableAgent - Analyse comptable ratios ✅ IMPLEMENTED
 * 3. ValorisationAgent - Valorisation entreprise ✅ IMPLEMENTED
 * 4. ImmobilierAgent - Analyse immobilier pro ✅ IMPLEMENTED
 * 5. FinancialValidationAgent - Validation cohérence ✅ IMPLEMENTED
 * 6. FinancialReportAgent - Génération rapport HTML ✅ IMPLEMENTED
 */
export { createFinancialOrchestrator, FinancialOrchestrator } from './orchestrator/FinancialOrchestrator';

// Export agents
export { ComptaPreprocessingAgent } from './agents/ComptaPreprocessingAgent';
export { DocumentExtractionAgent } from './agents/DocumentExtractionAgent';
export { ComptableAgent } from './agents/ComptableAgent';
export { ValorisationAgent } from './agents/ValorisationAgent';
export { ImmobilierAgent } from './agents/ImmobilierAgent';
export { FinancialValidationAgent } from './agents/FinancialValidationAgent';
export { FinancialReportAgent } from './agents/FinancialReportAgent';

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
    nafCode?: string;              // NAF code from API (for audit trail only)
    secteurActivite: string;       // User-selected sector (NAF code format)
    activity: string;
  };
  userComments?: {
    frais_personnel_N1?: number;       // ✅ NOUVEAU (2025-12-30): Estimation frais personnel année N+1 (€/an)
    reprise_salaries?: boolean;        // ✅ NOUVEAU (2025-12-30): Reprise des salariés du cédant (true=oui, false=non)
    loyer?: {
      loyer_actuel?: number;            // ✅ NOUVEAU (2025-12-30): Loyer actuel mensuel (€/mois, structuré)
      loyer_negocie?: number;           // ✅ NOUVEAU (2025-12-30): Loyer négocié mensuel (€/mois, structuré)
      futur_loyer_commercial?: number;  // LEGACY: Ex: 1500 (nouveau loyer commercial mensuel en €)
      loyer_actuel_mensuel?: number;    // LEGACY: Backward compat with NLP extraction
      loyer_futur_mensuel?: number;     // LEGACY: Backward compat with NLP extraction
      loyer_logement_perso?: number;    // Ex: 600 (part logement personnel mensuel en €)
      commentaire?: string;              // Ex: "le loyer sera baissé à 2100 euros dans le prochain bail"
    };
    travaux?: {
      budget_prevu?: number;
      commentaire?: string;
    };
    conditions_vente?: {
      negociation_possible?: boolean;
      commentaire?: string;
    };
    autres?: string;  // Commentaires libres
  };
};

export type FinancialState = {
  comptaPreprocessing?: {
    skipped: boolean;
    reason?: string;
    originalDocuments?: string[];
    pagesAnalyzed?: number;
    pagesKept?: number;
    pagesIgnored?: number;
    consolidatedDocuments?: Array<{
      filename: string;
      year: number;
      pageTypes: string[];
      pageCount: number;
    }>;
    savedTo?: string;
    documentsUpdated: boolean;
  };
  documentExtraction?: any;
  comptable?: any;
  valorisation?: any;
  immobilier?: any;
  financialValidation?: any;
  financialReport?: any;
  userComments?: {
    frais_personnel_N1?: number;       // ✅ NOUVEAU (2025-12-30): Estimation frais personnel année N+1 (€/an)
    reprise_salaries?: boolean;        // ✅ NOUVEAU (2025-12-30): Reprise des salariés du cédant (true=oui, false=non)
    loyer?: {
      loyer_actuel?: number;            // ✅ NOUVEAU (2025-12-30): Loyer actuel mensuel (€/mois, structuré)
      loyer_negocie?: number;           // ✅ NOUVEAU (2025-12-30): Loyer négocié mensuel (€/mois, structuré)
      futur_loyer_commercial?: number;  // LEGACY: Backward compat
      loyer_actuel_mensuel?: number;    // LEGACY: Backward compat
      loyer_futur_mensuel?: number;     // LEGACY: Backward compat
      loyer_logement_perso?: number;
      commentaire?: string;
    };
    travaux?: {
      budget_prevu?: number;
      commentaire?: string;
    };
    conditions_vente?: {
      negociation_possible?: boolean;
      commentaire?: string;
    };
    autres?: string;
  };
  transactionCosts?: {
    prix_fonds: number;
    honoraires_ht: number;
    frais_acte_ht: number;
    debours: number;
    droits_enregistrement: number;
    tva: number;
    stock_fonds_roulement: number;
    loyer_avance: number;
    total_investissement: number;
    apport_requis: number;
    credit_sollicite: number;
    duree_credit_mois: number;
    taux_credit: number;
    mensualites: number;
  };
};

import { z } from 'zod';

/**
 * Data Completeness Schema
 *
 * Tracks field-level completeness for each section of the Financial Pipeline.
 * Enables users to understand exactly what data is missing to reach 100%.
 *
 * Used by:
 * - assessDataQualityTool.ts: Computes field-level completeness
 * - generateFinancialHtmlTool.ts: Renders completeness blocks in report
 */

// Status of a single data field
export const DataFieldStatusSchema = z.enum(['present', 'missing', 'partial']);

// Individual data field with tracking metadata
export const DataFieldSchema = z.object({
  name: z.string().describe('Internal field name (e.g., "bilan_n")'),
  label: z.string().describe('French display name (e.g., "Bilan comptable N")'),
  status: DataFieldStatusSchema,
  source: z.string().optional().describe('Document source (e.g., "COMPTA2023.pdf")'),
  impact: z.number().describe('Points contributed when present (or lost when missing)'),
  details: z.string().optional().describe('Additional context (e.g., "estimée mais non vérifiée")')
});

// Priority document to collect
export const PriorityDocumentSchema = z.object({
  document: z.string().describe('Document name in French'),
  criticite: z.enum(['bloquant', 'important', 'utile']),
  impact: z.number().describe('Expected score improvement if provided'),
  section: z.string().optional().describe('Which section benefits from this document')
});

// Completeness tracking for a single section
export const DataCompletenessSchema = z.object({
  section: z.string().describe('Section name (e.g., "Extraction Données")'),
  sectionKey: z.string().describe('State key (e.g., "documentExtraction")'),
  expectedFields: z.array(DataFieldSchema),
  presentFields: z.array(DataFieldSchema),
  missingFields: z.array(DataFieldSchema),
  partialFields: z.array(DataFieldSchema),
  score: z.number().min(0).max(100),
  maxScore: z.number(),
  recommendations: z.array(z.string()).describe('Actionable recommendations in French')
});

// Complete data completeness report
export const DataCompletenessReportSchema = z.object({
  sections: z.array(DataCompletenessSchema),
  overallScore: z.number().min(0).max(100),
  overallMaxScore: z.number(),
  priorityDocuments: z.array(PriorityDocumentSchema),
  generatedAt: z.string()
});

// Export types
export type DataFieldStatus = z.infer<typeof DataFieldStatusSchema>;
export type DataField = z.infer<typeof DataFieldSchema>;
export type PriorityDocument = z.infer<typeof PriorityDocumentSchema>;
export type DataCompleteness = z.infer<typeof DataCompletenessSchema>;
export type DataCompletenessReport = z.infer<typeof DataCompletenessReportSchema>;

// ============================================================================
// EXPECTED FIELDS DEFINITIONS
// ============================================================================

/**
 * Expected fields for "Extraction Données" section (30 pts max)
 */
export const EXTRACTION_EXPECTED_FIELDS: Omit<DataField, 'status' | 'source' | 'details'>[] = [
  { name: 'bilan_n', label: 'Bilan comptable N', impact: 5 },
  { name: 'bilan_n1', label: 'Bilan comptable N-1', impact: 3 },
  { name: 'bilan_n2', label: 'Bilan comptable N-2', impact: 2 },
  { name: 'compte_resultat_n', label: 'Compte de résultat N', impact: 5 },
  { name: 'compte_resultat_n1', label: 'Compte de résultat N-1', impact: 3 },
  { name: 'liasse_fiscale', label: 'Liasse fiscale certifiée', impact: 4 },
  { name: 'detail_immobilisations', label: 'Détail des immobilisations', impact: 2 },
  { name: 'etat_stocks', label: 'État des stocks valorisé', impact: 2 },
  { name: 'contrats_fournisseurs', label: 'Contrats fournisseurs', impact: 1 },
  { name: 'releves_bancaires', label: 'Relevés bancaires/trésorerie', impact: 2 },
  { name: 'masse_salariale', label: 'Masse salariale détaillée', impact: 1 }
];

/**
 * Expected fields for "Analyse Immobilière" section (20 pts in global scoring)
 */
export const IMMOBILIER_EXPECTED_FIELDS: (Omit<DataField, 'status' | 'source' | 'details'> & { category: string })[] = [
  // Bail (40 pts in detailed scoring)
  { name: 'bail_commercial', label: 'Bail commercial original', impact: 10, category: 'bail' },
  { name: 'bail_type', label: 'Type de bail (3-6-9, dérogatoire)', impact: 2, category: 'bail' },
  { name: 'bail_loyer', label: 'Loyer annuel HC', impact: 3, category: 'bail' },
  { name: 'bail_charges', label: 'Charges annuelles', impact: 1, category: 'bail' },
  { name: 'bail_indexation', label: 'Clause indexation (ILC/ILAT)', impact: 1, category: 'bail' },
  { name: 'bail_date_renouvellement', label: 'Date de renouvellement', impact: 2, category: 'bail' },
  { name: 'bail_surface', label: 'Surface commerciale détaillée', impact: 2, category: 'bail' },

  // Travaux / Diagnostics (30 pts in detailed scoring)
  { name: 'diagnostic_amiante', label: 'Diagnostic amiante', impact: 2, category: 'travaux' },
  { name: 'diagnostic_electricite', label: 'Diagnostic électricité', impact: 2, category: 'travaux' },
  { name: 'diagnostic_dpe', label: 'DPE (performance énergétique)', impact: 1, category: 'travaux' },
  { name: 'conformite_erp', label: 'Conformité ERP', impact: 3, category: 'travaux' },
  { name: 'conformite_pmr', label: 'Accessibilité PMR', impact: 2, category: 'travaux' },
  { name: 'travaux_realises', label: 'Historique travaux réalisés', impact: 1, category: 'travaux' },

  // Murs (30 pts in detailed scoring)
  { name: 'loyer_vs_marche', label: 'Comparaison loyer/marché', impact: 2, category: 'murs' },
  { name: 'proprietaire_type', label: 'Type de propriétaire', impact: 1, category: 'murs' }
];

/**
 * Max scores for each section
 */
export const SECTION_MAX_SCORES = {
  extraction: 30,  // In global scoring
  immobilier: 20   // In global scoring (100 in detailed)
};

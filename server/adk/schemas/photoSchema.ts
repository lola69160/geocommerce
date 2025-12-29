import { z } from 'zod';

/**
 * Photo Analysis Agent Output Schema
 *
 * Analyse Gemini Vision de l'état physique du commerce
 */

export const EtatGeneralSchema = z.object({
  note_globale: z.number().min(0).max(10),
  devanture: z.enum(['excellent', 'bon', 'moyen', 'mauvais', 'très mauvais']),
  interieur: z.enum(['excellent', 'bon', 'moyen', 'mauvais', 'très mauvais']),
  equipement: z.enum(['excellent', 'bon', 'moyen', 'mauvais', 'très mauvais']),

  // REQUIS - Focus retail
  proprete: z.enum(['excellent', 'bon', 'moyen', 'mauvais', 'très mauvais']),
  modernite: z.enum(['excellent', 'bon', 'moyen', 'mauvais', 'très mauvais']),

  // OPTIONNELS - Nouveaux critères retail
  eclairage: z.enum(['excellent', 'bon', 'moyen', 'mauvais', 'très mauvais']).optional(),
  presentation_produits: z.enum(['excellent', 'bon', 'moyen', 'mauvais', 'très mauvais']).optional(),
  experience_client: z.enum(['excellent', 'bon', 'moyen', 'mauvais', 'très mauvais']).optional()
});

export const TravauxSchema = z.object({
  urgents: z.array(z.string()),
  recommandes: z.array(z.string()),
  optionnels: z.array(z.string())
});

export const BudgetTravauxSchema = z.object({
  fourchette_basse: z.number(),
  fourchette_haute: z.number(),
  detail_postes: z.array(z.object({
    categorie: z.string(),
    montant_min: z.number(),
    montant_max: z.number(),
    priorite: z.enum(['urgente', 'recommandée', 'optionnelle'])
  }))
});

export const PhotoAnalysisOutputSchema = z.object({
  analyzed: z.boolean(),
  photos_analyzed: z.number().optional(),
  etat_general: EtatGeneralSchema.optional(),
  points_forts: z.array(z.string()).optional(),
  points_faibles: z.array(z.string()).optional(),
  travaux: TravauxSchema.optional(),
  budget_travaux: BudgetTravauxSchema.optional(),
  risques: z.array(z.object({
    type: z.string(),
    description: z.string(),
    impact: z.enum(['faible', 'moyen', 'élevé', 'critique'])
  })).optional(),
  opportunites: z.array(z.string()).optional(),
  analyse_detaillee: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  reason: z.string().optional(),
  error: z.boolean().optional(),
  message: z.string().optional()
});

export type PhotoAnalysisOutput = z.infer<typeof PhotoAnalysisOutputSchema>;
export type EtatGeneral = z.infer<typeof EtatGeneralSchema>;
export type Travaux = z.infer<typeof TravauxSchema>;
export type BudgetTravaux = z.infer<typeof BudgetTravauxSchema>;

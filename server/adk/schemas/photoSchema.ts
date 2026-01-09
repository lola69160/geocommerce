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

  // ✅ NOUVEAU: 3 critères simples (boolean)
  propre: z.boolean().describe('L\'intérieur est-il propre ?'),
  lumineux: z.boolean().describe('L\'intérieur est-il bien éclairé ?'),
  range: z.boolean().describe('L\'intérieur est-il bien rangé/organisé ?'),

  // ❌ ANCIENS CRITÈRES COMPLEXES (optionnels pour rétrocompatibilité)
  proprete: z.enum(['excellent', 'bon', 'moyen', 'mauvais', 'très mauvais']).optional(),
  modernite: z.enum(['excellent', 'bon', 'moyen', 'mauvais', 'très mauvais']).optional(),
  eclairage: z.enum(['excellent', 'bon', 'moyen', 'mauvais', 'très mauvais']).optional(),
  presentation_produits: z.enum(['excellent', 'bon', 'moyen', 'mauvais', 'très mauvais']).optional(),
  experience_client: z.enum(['excellent', 'bon', 'moyen', 'mauvais', 'très mauvais']).optional(),

  // OPTIONNELS - Dual scores (Amélioration 5)
  score_qualite_retail: z.number().min(0).max(10).optional()
    .describe('Merchandising, présentation, modernité commerciale'),
  score_etat_physique: z.number().min(0).max(10).optional()
    .describe('Fixtures, propreté, usure du bâtiment')
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

// ✅ NOUVEAU: Schéma pour classification des photos
export const PhotoClassificationSchema = z.object({
  index: z.number().min(0).max(7),
  type: z.enum(['facade', 'interieur', 'detail', 'non_classifiable'])
});

// ✅ NOUVEAU (2026-01-09): Schéma pour photos sélectionnées (2 meilleures)
export const SelectedPhotoSchema = z.object({
  index: z.number().describe('Index de la photo dans le tableau places.photos'),
  type: z.enum(['interieur', 'facade']).describe('Type de photo sélectionnée'),
  url: z.string().describe('URL de la photo'),
  reason: z.string().describe('Raison de la sélection (ex: "Meilleur éclairage + rangement")'),
  score: z.number().optional().describe('Score de sélection (0-10)')
});

export const PhotoAnalysisOutputSchema = z.object({
  analyzed: z.boolean(),
  photos_analyzed: z.number().optional(),

  // ✅ NOUVEAU: Classification et détection façade
  photo_classifications: z.array(PhotoClassificationSchema).optional(),
  facade_visible: z.boolean().optional(),

  // ✅ NOUVEAU (2026-01-09): Photos sélectionnées pour le rapport final
  selectedPhotos: z.array(SelectedPhotoSchema).optional(),

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
export type PhotoClassification = z.infer<typeof PhotoClassificationSchema>;
export type SelectedPhoto = z.infer<typeof SelectedPhotoSchema>;
export type EtatGeneral = z.infer<typeof EtatGeneralSchema>;
export type Travaux = z.infer<typeof TravauxSchema>;
export type BudgetTravaux = z.infer<typeof BudgetTravauxSchema>;

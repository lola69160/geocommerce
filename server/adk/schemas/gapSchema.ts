import { z } from 'zod';

/**
 * Gap Analysis Agent Output Schema
 *
 * Scoring global multi-critères et recommandation GO/NO-GO
 */

export const ScoresDetailSchema = z.object({
  demographic: z.number().min(0).max(100),
  competition: z.number().min(0).max(100),
  physical_state: z.number().min(0).max(100),
  reputation: z.number().min(0).max(100),
  location: z.number().min(0).max(100)
});

export const WeightedScoreSchema = z.object({
  score: z.number(),
  weight: z.number(),
  weighted_value: z.number()
});

export const GapOutputSchema = z.object({
  analyzed: z.boolean(),
  global_score: z.number().min(0).max(100),
  recommendation: z.enum(['GO', 'GO AVEC PRUDENCE', 'NO-GO']),
  risk_level: z.enum(['faible', 'moyen', 'élevé', 'critique']),
  scores_detail: ScoresDetailSchema.optional(),
  weighted_scores: z.record(z.string(), WeightedScoreSchema).optional(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  critical_factors: z.array(z.object({
    factor: z.string(),
    impact: z.enum(['positif', 'négatif']),
    severity: z.enum(['faible', 'moyen', 'élevé', 'critique']),
    description: z.string()
  })).optional(),
  interpretation: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  reason: z.string().optional(),
  error: z.boolean().optional(),
  message: z.string().optional()
});

export type GapOutput = z.infer<typeof GapOutputSchema>;
export type ScoresDetail = z.infer<typeof ScoresDetailSchema>;

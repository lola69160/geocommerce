import { z } from 'zod';

/**
 * Validation Agent Output Schema - NOUVEAU
 *
 * Validation croisée entre agents pour détecter les incohérences
 */

export const ConflictTypeEnum = z.enum([
  'POPULATION_POI_MISMATCH',
  'CSP_PRICING_MISMATCH',
  'RATING_PHOTOS_MISMATCH',
  'DATA_INCONSISTENCY',
  'SCORE_MISMATCH',
  'GEOGRAPHIC_MISMATCH'
]);

export const ConflictSeverityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export const ConflictSchema = z.object({
  id: z.string().uuid(),
  type: ConflictTypeEnum,
  severity: ConflictSeverityEnum,
  sources: z.record(z.string(), z.any()), // { agentA: value, agentB: value }
  description: z.string(),
  impact: z.string().optional(),
  detectedAt: z.string().datetime(),
  resolved: z.boolean().default(false)
});

export const CoherenceScoreSchema = z.object({
  overall: z.number().min(0).max(100),
  by_category: z.object({
    demographic_consistency: z.number(),
    physical_consistency: z.number(),
    reputation_consistency: z.number(),
    geographic_consistency: z.number()
  })
});

export const ValidationOutputSchema = z.object({
  analyzed: z.boolean(),
  coherence_score: CoherenceScoreSchema.optional(),
  conflicts_detected: z.number().default(0),
  conflicts: z.array(ConflictSchema).optional(),
  validation_summary: z.string().optional(),
  recommendations: z.array(z.string()).optional(), // Recommandations pour résoudre conflits
  reason: z.string().optional(),
  error: z.boolean().optional(),
  message: z.string().optional()
});

export type ValidationOutput = z.infer<typeof ValidationOutputSchema>;
export type Conflict = z.infer<typeof ConflictSchema>;
export type ConflictType = z.infer<typeof ConflictTypeEnum>;
export type ConflictSeverity = z.infer<typeof ConflictSeverityEnum>;
export type CoherenceScore = z.infer<typeof CoherenceScoreSchema>;

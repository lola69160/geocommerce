import { z } from 'zod';
import { ConflictSchema } from './validationSchema';

/**
 * Arbitration Agent Output Schema - NOUVEAU
 *
 * Résolution de conflits détectés par ValidationAgent
 */

export const ResolutionTypeEnum = z.enum([
  'CONFIRMED',           // Source A correcte, rejeter B
  'REJECTED',           // Source B correcte, rejeter A
  'HYBRID',             // Les deux sources valides avec nuances
  'NEEDS_REVALIDATION', // Données insuffisantes, revalider
  'IGNORED'             // Conflit non critique, ignorer
]);

export const ResolutionSchema = z.object({
  conflict_id: z.string().uuid(),
  resolution_type: ResolutionTypeEnum,
  explanation: z.string(),
  confidence: z.number().min(0).max(1),
  chosen_source: z.string().optional(), // Agent source prioritaire
  updated_data: z.record(z.string(), z.any()).optional(), // Données corrigées/arbitrées
  action_required: z.string().optional() // Action manuelle nécessaire
});

export const ArbitrationOutputSchema = z.object({
  analyzed: z.boolean(),
  conflicts_resolved: z.number().default(0),
  resolutions: z.array(ResolutionSchema).optional(),
  unresolved_conflicts: z.array(ConflictSchema).optional(),
  arbitration_summary: z.string().optional(),
  global_confidence: z.number().min(0).max(1).optional(),
  reason: z.string().optional(),
  error: z.boolean().optional(),
  message: z.string().optional()
});

export type ArbitrationOutput = z.infer<typeof ArbitrationOutputSchema>;
export type Resolution = z.infer<typeof ResolutionSchema>;
export type ResolutionType = z.infer<typeof ResolutionTypeEnum>;

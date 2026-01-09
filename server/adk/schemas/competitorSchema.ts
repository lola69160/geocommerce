import { z } from 'zod';

/**
 * Competitor Agent Output Schema
 *
 * Analyse de la concurrence et attractivité de la zone
 */

export const CompetitorSchema = z.object({
  place_id: z.string(),
  name: z.string(),
  address: z.string(),
  distance: z.number(), // mètres
  rating: z.number().optional(),
  userRatingsTotal: z.number().optional(),
  priceLevel: z.number().optional(),
  types: z.array(z.string()).optional()
});

export const CompetitionAnalysisSchema = z.object({
  count: z.number(),
  closest_distance: z.number(), // mètres
  average_distance: z.number(),
  average_rating: z.number(),
  density_score: z.number().min(0).max(100), // 0 = saturé, 100 = peu de concurrence
  competitive_intensity: z.enum(['faible', 'moyenne', 'forte', 'très forte'])
});

export const POICategorySchema = z.object({
  count: z.number(),
  closest_distance: z.number(),
  types: z.array(z.string()),
  // Amélioration 4: Classification intelligente
  category: z.enum(['direct_competitor', 'complementary', 'other']).optional(),
  impact: z.enum(['negative', 'neutral', 'positive']).optional()
});

export const AttractivenessSchema = z.object({
  overall_score: z.number().min(0).max(100),
  category: z.enum(['très faible', 'faible', 'moyenne', 'forte', 'très forte']),
  factors: z.object({
    transport_score: z.number(),
    commerce_score: z.number(),
    services_score: z.number(),
    culture_score: z.number()
  })
});

export const CategorizationSchema = z.object({
  // Nouveaux champs (système buckets 2026-01-09)
  bucket_a_competitors: z.number().optional().describe('Concurrents directs (impact négatif)'),
  bucket_b_locomotives: z.number().optional().describe('Locomotives de trafic (impact très positif)'),
  bucket_c_services: z.number().optional().describe('Services & Horeca (impact positif modéré)'),

  // Anciens champs (rétrocompatibilité - déprécié)
  direct_competitors: z.number().describe('Legacy: = bucket_a_competitors'),
  complementary: z.number().describe('Legacy: = bucket_b_locomotives + bucket_c_services'),
  other_services: z.number().describe('Legacy: = bucket_c_services')
});

export const CompetitorOutputSchema = z.object({
  analyzed: z.boolean(),
  competitors: z.array(CompetitorSchema).optional(),
  competition: CompetitionAnalysisSchema.optional(),
  nearby_poi: z.record(z.string(), POICategorySchema).optional(), // Clé = catégorie POI
  categorization: CategorizationSchema.optional(), // Amélioration 4
  attractiveness: AttractivenessSchema.optional(),
  interpretation: z.string().optional(),
  reason: z.string().optional(),
  error: z.boolean().optional(),
  message: z.string().optional()
});

export type CompetitorOutput = z.infer<typeof CompetitorOutputSchema>;
export type Competitor = z.infer<typeof CompetitorSchema>;
export type CompetitionAnalysis = z.infer<typeof CompetitionAnalysisSchema>;
export type Attractiveness = z.infer<typeof AttractivenessSchema>;

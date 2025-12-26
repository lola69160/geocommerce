import { z } from 'zod';

/**
 * Demographic Agent Output Schema
 *
 * Données d'analyse démographique de la zone
 */

export const CommuneDataSchema = z.object({
  nom: z.string(),
  code: z.string(),
  codePostal: z.string(),
  population: z.number(),
  surface: z.number(),
  density: z.number()
});

export const CSPProfileSchema = z.object({
  dominant: z.enum(['high', 'middle', 'low']),
  high_percentage: z.number(),
  middle_percentage: z.number(),
  low_percentage: z.number()
});

export const TradeAreaSchema = z.object({
  walking_500m: z.number(), // Population à 500m
  driving_1km: z.number(),  // Population à 1km
  driving_3km: z.number()   // Population à 3km
});

export const DemographicProfileSchema = z.object({
  urban_level: z.enum(['rural', 'low', 'medium', 'high', 'very_high']),
  density_category: z.string(),
  estimated_csp: CSPProfileSchema,
  population_size: z.string(),
  trade_area_potential: TradeAreaSchema
});

export const DemographicScoreSchema = z.object({
  overall: z.number().min(0).max(100),
  density_match: z.number().min(0).max(100),
  population_size: z.number().min(0).max(100),
  csp_adequacy: z.number().min(0).max(100)
});

export const DemographicOutputSchema = z.object({
  analyzed: z.boolean(),
  commune: CommuneDataSchema.optional(),
  profile: DemographicProfileSchema.optional(),
  score: DemographicScoreSchema.optional(),
  interpretation: z.string().optional(),
  reason: z.string().optional(),
  error: z.boolean().optional(),
  message: z.string().optional()
});

export type DemographicOutput = z.infer<typeof DemographicOutputSchema>;
export type CommuneData = z.infer<typeof CommuneDataSchema>;
export type CSPProfile = z.infer<typeof CSPProfileSchema>;
export type DemographicProfile = z.infer<typeof DemographicProfileSchema>;
export type DemographicScore = z.infer<typeof DemographicScoreSchema>;

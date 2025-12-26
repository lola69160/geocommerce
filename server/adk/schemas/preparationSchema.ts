import { z } from 'zod';
import { NormalizedAddressSchema, CoordinatesSchema, CommuneInfoSchema } from './businessSchema';

/**
 * Preparation Agent Output Schema
 *
 * Données normalisées et préparées pour le pipeline
 */

export const SearchParamsSchema = z.object({
  radius: z.number().default(1000),
  poiRadius: z.number().default(500),
  maxCompetitors: z.number().default(20),
  maxPhotos: z.number().default(8)
});

export const PreparationOutputSchema = z.object({
  businessId: z.string(),
  normalizedAddress: NormalizedAddressSchema,
  coordinates: CoordinatesSchema,
  commune: CommuneInfoSchema,
  searchParams: SearchParamsSchema,
  cacheKey: z.string(),
  timestamp: z.string(),
  googlePlaceId: z.string().optional()
});

export type PreparationOutput = z.infer<typeof PreparationOutputSchema>;
export type SearchParams = z.infer<typeof SearchParamsSchema>;

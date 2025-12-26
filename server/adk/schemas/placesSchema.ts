import { z } from 'zod';

/**
 * Places Agent Output Schema
 *
 * Données Google Places enrichies
 */

export const PlacesReviewSchema = z.object({
  author: z.string(),
  rating: z.number(),
  text: z.string(),
  time: z.number(),
  relativeTime: z.string()
});

export const PlacesPhotoSchema = z.object({
  name: z.string(),
  widthPx: z.number(),
  heightPx: z.number(),
  url: z.string().optional()
});

export const OpeningHoursSchema = z.object({
  openNow: z.boolean().optional(),
  periods: z.array(z.any()).optional(),
  weekdayDescriptions: z.array(z.string()).optional()
});

export const NameMatchDetailsSchema = z.object({
  businessName: z.string(),
  googleName: z.string(),
  normalized: z.object({
    business: z.string(),
    google: z.string()
  }),
  matchType: z.enum(['exact', 'substring', 'partial', 'none']),
  confidence: z.number()
});

export const TypeMatchDetailsSchema = z.object({
  nafCode: z.string(),
  expectedTypes: z.array(z.string()),
  actualTypes: z.array(z.string()),
  matchedTypes: z.array(z.string()),
  matchStrength: z.enum(['exact', 'related', 'none'])
});

export const PlacesOutputSchema = z.object({
  found: z.boolean(),
  place_id: z.string().optional(),
  name: z.string().optional(),
  rating: z.number().optional(),
  userRatingsTotal: z.number().optional(),
  priceLevel: z.number().optional(),
  businessStatus: z.string().optional(),
  location: z.object({
    lat: z.number(),
    lon: z.number()
  }).optional(),
  formattedAddress: z.string().optional(),
  reviews: z.array(PlacesReviewSchema).optional(),
  photos: z.array(PlacesPhotoSchema).optional(),
  openingHours: OpeningHoursSchema.optional(),
  types: z.array(z.string()).optional(),
  matchScore: z.number().optional(), // Score multi-dimensionnel (0-150)
  matchDetails: z.object({
    streetNumberMatch: z.number(),
    zipCodeMatch: z.number(),
    distanceScore: z.number(),
    streetNameScore: z.number(),
    nameScore: z.number().optional(),
    typeScore: z.number().optional(),
    identityScore: z.number().optional()
  }).optional(),
  nameMatchDetails: NameMatchDetailsSchema.optional(),
  typeMatchDetails: TypeMatchDetailsSchema.optional(),
  isAmbiguous: z.boolean().optional(),
  reason: z.string().optional(),
  error: z.boolean().optional(),
  message: z.string().optional()
});

export type PlacesOutput = z.infer<typeof PlacesOutputSchema>;
export type PlacesReview = z.infer<typeof PlacesReviewSchema>;
export type PlacesPhoto = z.infer<typeof PlacesPhotoSchema>;
export type NameMatchDetails = z.infer<typeof NameMatchDetailsSchema>;
export type TypeMatchDetails = z.infer<typeof TypeMatchDetailsSchema>;

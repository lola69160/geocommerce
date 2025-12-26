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
  matchScore: z.number().optional(), // Score multi-résultats (0-100)
  matchDetails: z.object({
    streetNumberMatch: z.number(),
    zipCodeMatch: z.number(),
    distanceScore: z.number(),
    streetNameScore: z.number()
  }).optional(),
  reason: z.string().optional(),
  error: z.boolean().optional(),
  message: z.string().optional()
});

export type PlacesOutput = z.infer<typeof PlacesOutputSchema>;
export type PlacesReview = z.infer<typeof PlacesReviewSchema>;
export type PlacesPhoto = z.infer<typeof PlacesPhotoSchema>;

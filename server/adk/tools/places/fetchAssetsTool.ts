import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import { zToGen } from '../../utils/schemaHelper.js';
import axios from 'axios';

/**
 * Fetch Assets Tool
 *
 * Récupère photos, avis et détails supplémentaires depuis Google Places
 */

const FetchAssetsInputSchema = z.object({
  placeId: z.string().describe('Google Place ID (format: places/XXXXX)')
});

export const fetchAssetsTool = new FunctionTool({
  name: 'fetchAssets',
  description: 'Récupère photos (max 5), avis (max 5 significatifs), et détails depuis Google Places. Retourne { photos: [...], reviews: [...], rating, userRatingsTotal }',
  parameters: zToGen(FetchAssetsInputSchema),

  execute: async ({ placeId }: z.infer<typeof FetchAssetsInputSchema>) => {
    const PLACE_API_KEY = process.env.PLACE_API_KEY;

    if (!placeId || !PLACE_API_KEY) {
      return {
        photos: [],
        reviews: [],
        rating: null,
        userRatingsTotal: 0
      };
    }

    // Ensure placeId is in correct format (places/ID)
    const resourceName = placeId.startsWith('places/') ? placeId : `places/${placeId}`;

    const fields = [
      'photos',
      'reviews',
      'rating',
      'userRatingCount',
      'regularOpeningHours',
      'editorialSummary'
    ];

    try {
      const response = await axios.get(
        `https://places.googleapis.com/v1/${resourceName}`,
        {
          params: {
            key: PLACE_API_KEY,
            fields: fields.join(','),
            languageCode: 'fr'
          },
          timeout: 5000
        }
      );

      const place = response.data;

      // Process Photos (Max 5 for analysis - optimized token consumption)
      const photos = (place.photos || []).slice(0, 5).map((photo: any) => ({
        name: photo.name,
        widthPx: photo.widthPx,
        heightPx: photo.heightPx,
        url: `https://places.googleapis.com/v1/${photo.name}/media?key=${PLACE_API_KEY}&maxHeightPx=800&maxWidthPx=800`
      }));

      // Process Reviews (Max 5, filter non-empty)
      const reviews = (place.reviews || [])
        .filter((r: any) => r.text && r.text.text && r.text.text.trim().length > 0)
        .slice(0, 5)
        .map((review: any) => ({
          author: review.authorAttribution?.displayName || 'Anonymous',
          rating: review.rating,
          text: review.text.text,
          time: review.publishTime,
          relativeTime: review.relativePublishTimeDescription
        }));

      return {
        photos,
        reviews,
        // ⚠️ CRITICAL (2026-01-09): Use native API fields (place.rating, place.userRatingCount)
        // NEVER recalculate from reviews[] array (limited to 5 items by API)
        // This ensures accurate e-reputation data regardless of sample size
        rating: place.rating || null,
        userRatingsTotal: place.userRatingCount || 0,
        openingHours: place.regularOpeningHours?.weekdayDescriptions || null,
        editorialSummary: place.editorialSummary?.text || null
      };

    } catch (error: any) {
      console.error('Error fetching assets:', error.message);
      return {
        photos: [],
        reviews: [],
        rating: null,
        userRatingsTotal: 0,
        error: true,
        message: error.message
      };
    }
  }
});

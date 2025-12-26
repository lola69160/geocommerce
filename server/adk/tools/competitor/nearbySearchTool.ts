import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../utils/schemaHelper.js';
import type { PreparationOutput } from '../../schemas';
import axios from 'axios';

/**
 * Nearby Search Tool
 *
 * Recherche les POI (Points of Interest) concurrents à proximité via Google Places API Nearby Search.
 * Lit coordinates depuis state.preparation via ToolContext.
 *
 * Paramètres:
 * - radius: Rayon de recherche en mètres (default: 500m)
 * - includedTypes: Types de commerces à rechercher (optionnel)
 *
 * Retourne:
 * - nearby_poi: Dictionnaire des POI trouvés
 * - total_competitors: Nombre total de concurrents
 * - by_type: Distribution par type de commerce
 */

const NearbySearchInputSchema = z.object({
  // coordinates lu depuis state.preparation.coordinates via ToolContext
  radius: z.number().default(200).describe('Rayon de recherche en mètres (standard retail: 200m)'),
  includedTypes: z.array(z.string()).optional().describe('Types de commerces spécifiques (ex: ["bakery", "restaurant"])')
});

export const nearbySearchTool = new FunctionTool({
  name: 'nearbySearch',
  description: 'Recherche POI concurrents à proximité via Google Places. Lit coordinates depuis state.preparation. Retourne { nearby_poi: {...}, total_competitors, by_type, density_level }',
  parameters: zToGen(NearbySearchInputSchema),

  execute: async ({ radius, includedTypes }: z.infer<typeof NearbySearchInputSchema>, toolContext?: ToolContext) => {
    // Lire preparation depuis state
    let preparation = toolContext?.state.get('preparation') as PreparationOutput | undefined | string;

    // Parser JSON string si nécessaire (ADK peut stocker en string)
    if (typeof preparation === 'string') {
      try {
        preparation = JSON.parse(preparation) as PreparationOutput;
      } catch (e) {
        return {
          nearby_poi: {},
          total_competitors: 0,
          by_type: {},
          density_level: 'unknown',
          error: 'Failed to parse preparation state (invalid JSON)'
        };
      }
    }

    if (!preparation?.coordinates) {
      return {
        nearby_poi: {},
        total_competitors: 0,
        by_type: {},
        density_level: 'unknown',
        error: 'preparation.coordinates not found in state'
      };
    }

    const coordinates = preparation.coordinates;

    const PLACE_API_KEY = process.env.PLACE_API_KEY;

    if (!PLACE_API_KEY) {
      return {
        nearby_poi: {},
        total_competitors: 0,
        by_type: {},
        density_level: 'unknown',
        error: 'PLACE_API_KEY not configured'
      };
    }

    if (!coordinates || !coordinates.lat || !coordinates.lon) {
      return {
        nearby_poi: {},
        total_competitors: 0,
        by_type: {},
        density_level: 'unknown',
        error: 'Invalid coordinates'
      };
    }

    try {
      // Construire requête Nearby Search
      const requestBody: any = {
        locationRestriction: {
          circle: {
            center: {
              latitude: coordinates.lat,
              longitude: coordinates.lon
            },
            radius: radius
          }
        },
        maxResultCount: 20 // Limite API
      };

      // Ajouter types si spécifiés
      if (includedTypes && includedTypes.length > 0) {
        requestBody.includedTypes = includedTypes;
      }

      // Appel Google Places API Nearby Search
      const response = await axios.post(
        'https://places.googleapis.com/v1/places:searchNearby',
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': PLACE_API_KEY,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.types,places.location,places.rating,places.userRatingCount,places.priceLevel,places.businessStatus'
          },
          timeout: 10000
        }
      );

      const places = response.data.places || [];

      // Traiter les POI
      const nearbyPOI: Record<string, any> = {};
      const typeCount: Record<string, number> = {};

      places.forEach((place: any, index: number) => {
        const placeId = place.id || `place_${index}`;

        nearbyPOI[placeId] = {
          name: place.displayName?.text || 'Unknown',
          types: place.types || [],
          location: {
            lat: place.location?.latitude,
            lon: place.location?.longitude
          },
          rating: place.rating || null,
          userRatingCount: place.userRatingCount || 0,
          priceLevel: place.priceLevel || null,
          businessStatus: place.businessStatus || 'UNKNOWN'
        };

        // Compter par type
        (place.types || []).forEach((type: string) => {
          typeCount[type] = (typeCount[type] || 0) + 1;
        });
      });

      // Calculer niveau de densité
      let densityLevel: 'very_low' | 'low' | 'moderate' | 'high' | 'very_high';
      const totalPOI = places.length;

      if (totalPOI === 0) {
        densityLevel = 'very_low';
      } else if (totalPOI < 5) {
        densityLevel = 'low';
      } else if (totalPOI < 10) {
        densityLevel = 'moderate';
      } else if (totalPOI < 15) {
        densityLevel = 'high';
      } else {
        densityLevel = 'very_high';
      }

      return {
        nearby_poi: nearbyPOI,
        total_competitors: totalPOI,
        by_type: typeCount,
        density_level: densityLevel,
        search_radius_meters: radius,
        coordinates_searched: coordinates
      };

    } catch (error: any) {
      console.error('Nearby search failed:', error.message);
      return {
        nearby_poi: {},
        total_competitors: 0,
        by_type: {},
        density_level: 'unknown',
        error: true,
        message: error.message
      };
    }
  }
});

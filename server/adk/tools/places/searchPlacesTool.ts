import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../utils/schemaHelper.js';
import type { BusinessInput, PreparationOutput } from '../../schemas';
import axios from 'axios';

/**
 * Search Places Tool
 *
 * Recherche Google Places avec scoring multi-résultats pour éviter faux positifs.
 * Lit business et preparation depuis le state via ToolContext.
 * Système de scoring: numéro rue (40pts) + code postal (30pts) + distance GPS (20pts) + nom rue (10pts)
 */

const SearchPlacesInputSchema = z.object({
  // Aucun paramètre - lit business.enseigne, preparation.normalizedAddress, preparation.coordinates depuis state
});

/**
 * Calculate distance between two GPS points (Haversine formula)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

/**
 * Score a Google Place result by address accuracy (0-100)
 */
function scorePlaceByAddress(
  place: any,
  expectedAddress: string,
  coords?: { lat: number; lon: number }
): number {
  let score = 0;

  if (!place || !expectedAddress) {
    return 0;
  }

  // Extract components from expected address
  const streetNumberMatch = expectedAddress.match(/^(\d+)/);
  const postalCodeMatch = expectedAddress.match(/(\d{5})/);
  const streetNameMatch = expectedAddress.match(/^\d+\s+([A-Z\s]+)/);

  // Extract from result
  const resultAddress = place.formattedAddress || '';
  const resultStreetNumber = resultAddress.match(/^(\d+)/);
  const resultPostalCode = resultAddress.match(/(\d{5})/);

  // 1. STREET NUMBER MATCH (40 points)
  if (streetNumberMatch && resultStreetNumber) {
    if (streetNumberMatch[1] === resultStreetNumber[1]) {
      score += 40;
    }
  }

  // 2. POSTAL CODE MATCH (30 points)
  if (postalCodeMatch && resultPostalCode) {
    if (postalCodeMatch[1] === resultPostalCode[1]) {
      score += 30;
    }
  }

  // 3. GPS DISTANCE (20 points)
  if (coords && place.location) {
    const distance = calculateDistance(
      coords.lat, coords.lon,
      place.location.latitude, place.location.longitude
    );
    // Full points if within 25m, decreasing to 0 at 100m
    if (distance <= 25) score += 20;
    else if (distance <= 50) score += 15;
    else if (distance <= 75) score += 10;
    else if (distance <= 100) score += 5;
  }

  // 4. STREET NAME SIMILARITY (10 points)
  if (streetNameMatch) {
    const expectedStreet = streetNameMatch[1].trim().toLowerCase();
    const resultStreetLower = resultAddress.toLowerCase();
    if (resultStreetLower.includes(expectedStreet.substring(0, Math.min(10, expectedStreet.length)))) {
      score += 10;
    }
  }

  return score;
}

export const searchPlacesTool = new FunctionTool({
  name: 'searchPlaces',
  description: 'Recherche Google Places avec scoring multi-résultats (seuil 80%). Lit business.enseigne, preparation.normalizedAddress, preparation.coordinates depuis state. Retourne le meilleur match ou null.',
  parameters: zToGen(SearchPlacesInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    // Lire business et preparation depuis state
    const business = toolContext?.state.get('business') as BusinessInput | undefined;
    let preparation = toolContext?.state.get('preparation') as PreparationOutput | undefined | string;

    if (!business) {
      throw new Error('Business data not found in state');
    }

    // Parser JSON string si nécessaire (ADK peut stocker en string)
    if (typeof preparation === 'string') {
      try {
        preparation = JSON.parse(preparation) as PreparationOutput;
      } catch (e) {
        throw new Error('Failed to parse preparation state (invalid JSON)');
      }
    }

    if (!preparation?.normalizedAddress) {
      throw new Error('preparation.normalizedAddress not found in state');
    }

    // CHECK FOR EXISTING GOOGLE PLACE ID
    const existingPlaceId = preparation?.googlePlaceId || business?.siege?.googlePlaceId;

    if (existingPlaceId) {
      console.log(`✓ Using existing googlePlaceId: ${existingPlaceId}`);
      return {
        found: true,
        placeId: existingPlaceId,
        name: business.enseigne || business.nom_complet || '',
        skipped_search: true,
        reason: 'Using pre-existing googlePlaceId from enrichment'
      };
    }

    const businessName = business.enseigne || business.nom_complet || business.nom_raison_sociale || '';
    const address = preparation.normalizedAddress.full;
    const coordinates = preparation.coordinates;

    const PLACE_API_KEY = process.env.PLACE_API_KEY;

    if (!PLACE_API_KEY) {
      console.warn('PLACE_API_KEY not configured');
      return { found: false, reason: 'API key not configured' };
    }

    const textQuery = `${businessName} ${address}`;

    const fields = [
      'places.id',
      'places.displayName',
      'places.formattedAddress',
      'places.location',
      'places.regularOpeningHours',
      'places.photos',
      'places.reviews',
      'places.rating',
      'places.userRatingCount',
      'places.priceLevel',
      'places.businessStatus',
      'places.types'
    ];

    try {
      const response = await axios.post(
        'https://places.googleapis.com/v1/places:searchText',
        {
          textQuery,
          languageCode: 'fr',
          maxResultCount: 5  // Request 5 results for scoring
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': PLACE_API_KEY,
            'X-Goog-FieldMask': fields.join(',')
          },
          timeout: 5000
        }
      );

      if (response.data.places && response.data.places.length > 0) {
        const places = response.data.places;

        // Score all results
        const scoredPlaces = places.map((place: any) => ({
          place,
          score: scorePlaceByAddress(place, address, coordinates || undefined)
        }));

        // Sort by score descending
        scoredPlaces.sort((a: any, b: any) => b.score - a.score);

        // Take best result if score >= 80
        const best = scoredPlaces[0];
        if (best.score >= 80) {
          return {
            found: true,
            placeId: best.place.id,
            name: best.place.displayName?.text,
            formattedAddress: best.place.formattedAddress,
            location: {
              lat: best.place.location?.latitude,
              lon: best.place.location?.longitude
            },
            rating: best.place.rating,
            userRatingsTotal: best.place.userRatingCount,
            priceLevel: best.place.priceLevel,
            businessStatus: best.place.businessStatus,
            types: best.place.types,
            openingHours: best.place.regularOpeningHours?.weekdayDescriptions || null,
            photos: best.place.photos || [],
            reviews: best.place.reviews || [],
            matchScore: best.score,
            matchDetails: {
              streetNumberMatch: (address.match(/^(\d+)/) && best.place.formattedAddress?.match(/^(\d+)/)) ? 40 : 0,
              zipCodeMatch: (address.match(/(\d{5})/) && best.place.formattedAddress?.match(/(\d{5})/)) ? 30 : 0,
              distanceScore: coordinates && best.place.location ? 20 : 0,
              streetNameScore: 10
            }
          };
        } else {
          return {
            found: false,
            reason: `Best match score ${best.score} below threshold (80)`
          };
        }
      }

      return { found: false, reason: 'No results from Places API' };

    } catch (error: any) {
      console.error('Places API error:', error.message);
      return {
        found: false,
        error: true,
        message: error.message
      };
    }
  }
});

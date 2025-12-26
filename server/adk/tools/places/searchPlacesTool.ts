import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../utils/schemaHelper.js';
import type { BusinessInput, PreparationOutput } from '../../schemas';
import {
  normalizeBusinessName,
  scoreBusinessName,
  getNameMatchDetails
} from '../../utils/stringNormalization.js';
import {
  scoreBusinessType,
  getTypeMatchDetails
} from '../../config/nafPlacesMapping.js';
import axios from 'axios';

// Scoring thresholds
const SCORE_THRESHOLD_WITH_NAF = 90;      // Seuil avec NAF code (90/150)
const SCORE_THRESHOLD_WITHOUT_NAF = 85;   // Seuil sans NAF (85/150)
const AMBIGUITY_MARGIN = 5;               // ±5 pts = tie
const MIN_REVIEWS_FOR_CONFIDENCE = 5;     // Seuil avis pour ambiguïté

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

// Scoring interfaces
interface AddressScore {
  total: number;         // 0-100
  streetNumber: number;  // 0-40
  postalCode: number;    // 0-30
  gpsDistance: number;   // 0-20
  streetName: number;    // 0-10
}

interface IdentityScore {
  total: number;  // 0-50
  name: number;   // 0-30
  type: number;   // 0-20
}

interface ScoredPlace {
  place: any;
  addressScore: AddressScore;
  identityScore: IdentityScore;
  overall: number;  // 0-150
  nameMatchDetails?: any;
  typeMatchDetails?: any;
}

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
): AddressScore {
  const score: AddressScore = {
    total: 0,
    streetNumber: 0,
    postalCode: 0,
    gpsDistance: 0,
    streetName: 0
  };

  if (!place || !expectedAddress) {
    return score;
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
      score.streetNumber = 40;
    }
  }

  // 2. POSTAL CODE MATCH (30 points)
  if (postalCodeMatch && resultPostalCode) {
    if (postalCodeMatch[1] === resultPostalCode[1]) {
      score.postalCode = 30;
    }
  }

  // 3. GPS DISTANCE (20 points)
  if (coords && place.location) {
    const distance = calculateDistance(
      coords.lat, coords.lon,
      place.location.latitude, place.location.longitude
    );
    // Full points if within 25m, decreasing to 0 at 100m
    if (distance <= 25) score.gpsDistance = 20;
    else if (distance <= 50) score.gpsDistance = 15;
    else if (distance <= 75) score.gpsDistance = 10;
    else if (distance <= 100) score.gpsDistance = 5;
  }

  // 4. STREET NAME SIMILARITY (10 points)
  if (streetNameMatch) {
    const expectedStreet = streetNameMatch[1].trim().toLowerCase();
    const resultStreetLower = resultAddress.toLowerCase();
    if (resultStreetLower.includes(expectedStreet.substring(0, Math.min(10, expectedStreet.length)))) {
      score.streetName = 10;
    }
  }

  // Calculate total
  score.total = score.streetNumber + score.postalCode + score.gpsDistance + score.streetName;

  return score;
}

/**
 * Score business identity (name + NAF type matching)
 * Returns 0-50 bonus points
 */
function scorePlaceIdentity(
  businessName: string | null | undefined,
  nafCode: string | null | undefined,
  place: any
): IdentityScore {
  const nameScore = scoreBusinessName(businessName, place.displayName?.text);
  const typeScore = scoreBusinessType(nafCode, place.types);

  return {
    total: nameScore + typeScore,
    name: nameScore,
    type: typeScore
  };
}

/**
 * Select best place from scored candidates with tie-breaking
 */
function selectBestPlace(
  scoredPlaces: ScoredPlace[],
  nafCode: string | null | undefined
): { best: ScoredPlace | null; isAmbiguous: boolean; reason?: string } {
  if (scoredPlaces.length === 0) {
    return { best: null, isAmbiguous: false, reason: 'No results from Places API' };
  }

  // Sort by overall score descending
  scoredPlaces.sort((a, b) => b.overall - a.overall);

  const best = scoredPlaces[0];

  // Determine threshold based on NAF code availability
  const threshold = nafCode ? SCORE_THRESHOLD_WITH_NAF : SCORE_THRESHOLD_WITHOUT_NAF;

  // Check if best result meets threshold
  if (best.overall < threshold) {
    return {
      best: null,
      isAmbiguous: false,
      reason: `Best match score ${best.overall} below threshold (${threshold})`
    };
  }

  // Check for ambiguity: multiple results with similar scores
  const competitors = scoredPlaces.filter(sp =>
    Math.abs(sp.overall - best.overall) <= AMBIGUITY_MARGIN
  );

  if (competitors.length > 1) {
    // TIE-BREAKING RULES

    // Rule 1: Prefer higher identity score (better business match)
    competitors.sort((a, b) => b.identityScore.total - a.identityScore.total);

    const identityWinner = competitors[0];
    const identityRunnerUp = competitors[1];

    // If clear identity winner, use it
    if (identityWinner.identityScore.total > identityRunnerUp.identityScore.total + AMBIGUITY_MARGIN) {
      return { best: identityWinner, isAmbiguous: false };
    }

    // Rule 2: Prefer more reviews (community validation)
    const reviewsWinner = [...competitors].sort((a, b) =>
      (b.place.userRatingCount || 0) - (a.place.userRatingCount || 0)
    )[0];

    const reviewsRunnerUp = [...competitors].sort((a, b) =>
      (b.place.userRatingCount || 0) - (a.place.userRatingCount || 0)
    )[1];

    // If clear review count winner (>30% more reviews), use it
    const reviewCountDiff = (reviewsWinner.place.userRatingCount || 0) - (reviewsRunnerUp.place.userRatingCount || 0);
    if (reviewCountDiff > (reviewsRunnerUp.place.userRatingCount || 0) * 0.3) {
      return { best: reviewsWinner, isAmbiguous: false };
    }

    // Rule 3: If still tied and both have low review counts, mark as ambiguous
    if ((best.place.userRatingCount || 0) < MIN_REVIEWS_FOR_CONFIDENCE) {
      return {
        best: null,
        isAmbiguous: true,
        reason: `Ambiguous: ${competitors.length} businesses at same address with similar scores and low review counts`
      };
    }

    // Rule 4: Prefer higher rating
    const ratingWinner = [...competitors].sort((a, b) =>
      (b.place.rating || 0) - (a.place.rating || 0)
    )[0];

    return { best: ratingWinner, isAmbiguous: false };
  }

  // Clear winner
  return { best, isAmbiguous: false };
}

export const searchPlacesTool = new FunctionTool({
  name: 'searchPlaces',
  description: 'Recherche Google Places avec scoring multi-dimensionnel (adresse + identité). Score max 150pts (adresse:100 + nom:30 + type:20). Seuil adaptatif 90/85pts. Retourne meilleur match ou null si ambiguïté.',
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

        // Extract NAF code for type matching
        const nafCode = business.activite_principale || business.code_naf || null;

        // Score all results with multi-dimensional scoring (address + identity)
        const scoredPlaces: ScoredPlace[] = places.map((place: any) => {
          const addressScore = scorePlaceByAddress(place, address, coordinates || undefined);
          const identityScore = scorePlaceIdentity(businessName, nafCode, place);
          const overall = addressScore.total + identityScore.total;

          return {
            place,
            addressScore,
            identityScore,
            overall,
            nameMatchDetails: getNameMatchDetails(businessName, place.displayName?.text),
            typeMatchDetails: getTypeMatchDetails(nafCode, place.types)
          };
        });

        // Log scoring breakdown for top 3 results (debugging)
        scoredPlaces.slice(0, 3).forEach((sp, index) => {
          console.log(`\n[Places Scoring] Result ${index + 1}:`);
          console.log(`  Name: "${sp.place.displayName?.text}"`);
          console.log(`  Address Score: ${sp.addressScore.total}/100`);
          console.log(`    - Street number: ${sp.addressScore.streetNumber}/40`);
          console.log(`    - Postal code: ${sp.addressScore.postalCode}/30`);
          console.log(`    - GPS distance: ${sp.addressScore.gpsDistance}/20`);
          console.log(`    - Street name: ${sp.addressScore.streetName}/10`);
          console.log(`  Identity Score: ${sp.identityScore.total}/50`);
          console.log(`    - Name match: ${sp.identityScore.name}/30 (${sp.nameMatchDetails?.matchType || 'n/a'})`);
          console.log(`    - Type match: ${sp.identityScore.type}/20 (${sp.typeMatchDetails?.matchStrength || 'n/a'})`);
          console.log(`  OVERALL: ${sp.overall}/150`);
        });

        // Select best place with tie-breaking and ambiguity detection
        const selection = selectBestPlace(scoredPlaces, nafCode);

        if (!selection.best) {
          return {
            found: false,
            isAmbiguous: selection.isAmbiguous,
            reason: selection.reason
          };
        }

        const best = selection.best;

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
          matchScore: best.overall,
          matchDetails: {
            streetNumberMatch: best.addressScore.streetNumber,
            zipCodeMatch: best.addressScore.postalCode,
            distanceScore: best.addressScore.gpsDistance,
            streetNameScore: best.addressScore.streetName,
            nameScore: best.identityScore.name,
            typeScore: best.identityScore.type,
            identityScore: best.identityScore.total
          },
          nameMatchDetails: best.nameMatchDetails,
          typeMatchDetails: best.typeMatchDetails,
          isAmbiguous: selection.isAmbiguous
        };
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

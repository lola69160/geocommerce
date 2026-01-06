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

/**
 * OpenStreetMap Nominatim Fallback
 * API gratuite sans quota, utilisée si Google Places échoue
 */
async function osmNominatimFallback(params: {
  businessName: string;
  address: string;
  city: string;
  zipCode: string;
}): Promise<any | null> {
  const { businessName, address, city, zipCode } = params;

  const query = `${businessName}, ${address}, ${zipCode} ${city}, France`;

  console.log('[OSM] 🔍 Nominatim search:', query);

  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: query,
        format: 'json',
        addressdetails: 1,
        limit: 5
      },
      headers: {
        'User-Agent': 'SearchCommerce/1.0 (contact@searchcommerce.fr)'  // Obligatoire pour Nominatim
      },
      timeout: 5000
    });

    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      console.log('[OSM] ✅ Found:', result.display_name);

      // Mapper au format Google Places pour compatibilité
      return {
        found: true,
        placeId: `osm_${result.osm_type}_${result.osm_id}`,
        name: businessName,
        formattedAddress: result.display_name,
        location: {
          lat: parseFloat(result.lat),
          lon: parseFloat(result.lon)
        },
        rating: null,
        userRatingsTotal: 0,
        priceLevel: null,
        businessStatus: 'OPERATIONAL',
        types: [result.type || 'establishment'],
        openingHours: null,
        photos: [],
        reviews: [],
        matchScore: 0,
        matchDetails: {},
        source: 'openstreetmap'  // Identifier la source
      };
    }

    console.log('[OSM] ❌ No results');
    return null;

  } catch (error: any) {
    console.error('[OSM] ❌ Error:', error.message);
    return null;
  }
}

/**
 * INSEE Fallback - Dernier recours
 * Crée un objet minimal depuis les données INSEE existantes
 */
function inseeFallback(params: {
  business: any;
  preparation: any;
}): any {
  const { business, preparation } = params;

  console.log('[INSEE] 🔄 Using INSEE fallback (no external API data)');

  return {
    found: true,
    placeId: `insee_${business.siret}`,
    name: business.nom_complet || business.nom_raison_sociale || business.enseigne,
    formattedAddress: business.siege?.adresse || preparation.normalizedAddress?.full || '',
    location: {
      lat: preparation.coordinates?.lat || parseFloat(business.siege?.latitude || '0'),
      lon: preparation.coordinates?.lon || parseFloat(business.siege?.longitude || '0')
    },
    rating: null,
    userRatingsTotal: 0,
    priceLevel: null,
    businessStatus: business.siege?.etat_administratif === 'A' ? 'OPERATIONAL' : 'CLOSED_TEMPORARILY',
    types: ['establishment'],
    openingHours: null,
    photos: [],
    reviews: [],
    matchScore: 0,
    matchDetails: {},
    source: 'insee_fallback'  // Identifier la source
  };
}

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
    const city = business.siege?.libelle_commune || '';
    const zipCode = business.siege?.code_postal || '';
    const nafCode = business.activite_principale || business.code_naf || null;

    const PLACE_API_KEY = process.env.PLACE_API_KEY;

    if (!PLACE_API_KEY) {
      console.warn('PLACE_API_KEY not configured');
      return { found: false, reason: 'API key not configured' };
    }

    // ✅ STRATÉGIE MULTI-REQUÊTES - Variantes enrichies
    const textQueries: string[] = [
      // Variante 1: Nom + Adresse complète (stratégie actuelle)
      `${businessName} ${address}`,

      // Variante 2: Nom + Ville + Code postal
      city && zipCode ? `${businessName} ${city} ${zipCode}` : null,

      // Variante 3: Adresse seule (si le nom est générique)
      address,

      // Variante 4: Nom + Code postal seulement
      zipCode ? `${businessName} ${zipCode}` : null,

      // Variante 5: SIRET (Google indexe parfois les numéros)
      business.siret ? `SIRET ${business.siret}` : null

    ].filter((q): q is string => q !== null && q.trim().length > 0);

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

    console.log(`[searchPlaces] 📋 Prepared ${textQueries.length} query variants`);

    // ✅ TENTATIVES SÉQUENTIELLES - Essayer chaque variante
    let places: any[] = [];
    let successfulQuery: string | null = null;

    try {
      for (let i = 0; i < textQueries.length; i++) {
        const textQuery = textQueries[i];
        console.log(`[searchPlaces] 🔍 Text Search attempt ${i + 1}/${textQueries.length}: "${textQuery}"`);

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
            places = response.data.places;
            successfulQuery = textQuery;
            console.log(`[searchPlaces] ✅ Text Search SUCCESS: Found ${places.length} results with query "${textQuery}"`);
            break; // Arrêter dès qu'on a des résultats
          } else {
            console.log(`[searchPlaces] ⚠️ Text Search: No results for query "${textQuery}"`);
          }
        } catch (apiError: any) {
          console.error(`[searchPlaces] ❌ Text Search API error for query "${textQuery}":`, apiError.message);
          // Continue avec la prochaine variante
        }
      }

      if (places.length > 0 && successfulQuery) {
        console.log(`[searchPlaces] 📊 Scoring ${places.length} results...`);

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

      // ✅ FALLBACK 1: Toutes les requêtes Google Places ont échoué → OSM
      console.log('[searchPlaces] ⚠️ All Google Places Text Search queries failed');
      console.log('[searchPlaces] 🔄 Attempting OpenStreetMap fallback...');

      const osmResult = await osmNominatimFallback({
        businessName,
        address,
        city,
        zipCode
      });

      if (osmResult) {
        console.log('[searchPlaces] ✅ OSM fallback SUCCESS');
        return osmResult;
      }

      // ✅ FALLBACK 2: OSM a aussi échoué → INSEE (dernier recours)
      console.log('[searchPlaces] ⚠️ OSM fallback failed');
      console.log('[searchPlaces] 🔄 Using INSEE fallback (last resort)...');

      const inseeResult = inseeFallback({ business, preparation });
      console.log('[searchPlaces] ⚠️ Returning INSEE fallback data (limited information)');

      return inseeResult;

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

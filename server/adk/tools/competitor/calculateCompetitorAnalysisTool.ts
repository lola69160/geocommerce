/**
 * Calculate Competitor Analysis Tool
 *
 * Calcule l'analyse concurrentielle complète en une seule fois.
 * Ce tool fait TOUS les calculs (distances, catégorisation, métriques, market assessment)
 * pour éviter que le LLM doive assembler manuellement un JSON complexe.
 *
 * Pattern inspiré de calculateRatiosTool.ts du pipeline financier :
 * - Les calculs sont faits en TypeScript (déterministe, testable)
 * - Le LLM appelle juste le tool et interprète les résultats
 * - Lit les données depuis state via ToolContext
 *
 * Résout le problème MALFORMED_FUNCTION_CALL de CompetitorAgent.
 */

import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../utils/schemaHelper.js';

// ===== BUCKET CATEGORIZATION SYSTEM (2026-01-09) =====
// Système universel de 3 buckets remplaçant le mapping NAF
// Copié de categorizePoiTool.ts lignes 24-68

/**
 * BUCKET A: Concurrents Directs
 * Impact: NÉGATIF (cannibalisent la clientèle)
 */
const DIRECT_COMPETITORS = [
  'tobacco_shop',        // Bureaux de tabac
  'newsstand',           // Kiosques à journaux
  'convenience_store',   // Supérettes (vendent souvent tabac/presse)
  'vape_shop'            // Vape (concurrent du tabac)
];

/**
 * BUCKET B: Locomotives de Trafic
 * Impact: TRÈS POSITIF (génèrent du flux quotidien)
 */
const TRAFFIC_LOCOMOTIVES = [
  'bakery',              // Boulangerie (1-2 visites/jour)
  'pharmacy',            // Pharmacie (forte fréquentation)
  'supermarket',         // Supermarché
  'grocery_store',       // Épicerie fine, magasin alimentaire
  'market',              // Marché couvert
  'food_market'          // Halles (fort générateur de flux)
];

/**
 * BUCKET C: Services & Horeca
 * Impact: POSITIF MODÉRÉ (augmentent la rétention dans la zone)
 */
const SERVICES_HORECA = [
  'restaurant',          // Restaurants
  'cafe',                // Cafés
  'bar',                 // Bars
  'bank',                // Banques (services quotidiens)
  'atm',                 // Distributeurs
  'hair_care',           // Coiffeurs
  'beauty_salon',        // Salons de beauté
  'clothing_store',      // Vêtements
  'shoe_store',          // Chaussures
  'electronics_store',   // Électronique
  'furniture_store',     // Meubles
  'florist',             // Fleuristes
  'book_store'           // Librairies
];

// ===== HELPER FUNCTIONS =====

/**
 * Calcule distance Haversine entre 2 coordonnées GPS
 * Copié de calculateDistanceTool.ts lignes 38-55
 *
 * @param from Coordonnées de départ
 * @param to Coordonnées d'arrivée
 * @returns Distance en mètres
 */
function calculateHaversineDistance(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number }
): number {
  const R = 6371e3; // Rayon de la Terre en mètres

  // Conversion degrés → radians
  const φ1 = (from.lat * Math.PI) / 180;
  const φ2 = (to.lat * Math.PI) / 180;
  const Δφ = ((to.lat - from.lat) * Math.PI) / 180;
  const Δλ = ((to.lon - from.lon) * Math.PI) / 180;

  // Formule de Haversine
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Détermine niveau de proximité selon distance
 *
 * @param distanceMeters Distance en mètres
 * @returns Niveau de proximité (immediate, very_close, close, moderate, far)
 */
function getProximityLevel(distanceMeters: number): 'immediate' | 'very_close' | 'close' | 'moderate' | 'far' {
  if (distanceMeters <= 50) return 'immediate';
  if (distanceMeters <= 200) return 'very_close';
  if (distanceMeters <= 500) return 'close';
  if (distanceMeters <= 1000) return 'moderate';
  return 'far';
}

/**
 * Catégorise un POI selon le système de buckets universel (2026-01-09)
 * Remplace l'ancien système NAF-based
 *
 * Priorité: A > B > C (un concurrent direct reste un concurrent même s'il vend du pain)
 *
 * @param poiTypes Types Google Places du POI
 * @returns Bucket, catégorie legacy et impact
 */
function categorizePoi(
  poiTypes: string[]
): {
  bucket: 'A' | 'B' | 'C';
  category: 'direct_competitor' | 'complementary' | 'other';
  impact: 'negative' | 'very_positive' | 'positive' | 'neutral';
} {
  // Priorité 1: BUCKET A - Concurrents Directs
  if (poiTypes.some(t => DIRECT_COMPETITORS.includes(t))) {
    return {
      bucket: 'A',
      category: 'direct_competitor',
      impact: 'negative'
    };
  }

  // Priorité 2: BUCKET B - Locomotives de Trafic
  if (poiTypes.some(t => TRAFFIC_LOCOMOTIVES.includes(t))) {
    return {
      bucket: 'B',
      category: 'complementary',
      impact: 'very_positive'
    };
  }

  // Priorité 3: BUCKET C - Services & Horeca
  if (poiTypes.some(t => SERVICES_HORECA.includes(t))) {
    return {
      bucket: 'C',
      category: 'other',
      impact: 'positive'
    };
  }

  // Fallback: considérer comme Service (BUCKET C)
  return {
    bucket: 'C',
    category: 'other',
    impact: 'neutral'
  };
}

/**
 * Calcule niveau de densité selon nombre de POI
 *
 * @param total Nombre total de concurrents
 * @returns Niveau de densité (very_low, low, moderate, high, very_high)
 */
function calculateDensityLevel(total: number): 'very_low' | 'low' | 'moderate' | 'high' | 'very_high' {
  if (total === 0) return 'very_low';
  if (total <= 4) return 'low';
  if (total <= 9) return 'moderate';
  if (total <= 14) return 'high';
  return 'very_high';
}

/**
 * Calcule fréquence des types de POI (top 5)
 *
 * @param poiDict Dictionnaire des POI enrichis
 * @returns Top 5 types avec count et pourcentage
 */
function calculateTypeFrequency(poiDict: Record<string, any>): Array<{ type: string; count: number; percentage: number }> {
  const typeCounts: Record<string, number> = {};
  let totalTypes = 0;

  for (const poi of Object.values(poiDict)) {
    if (!poi.types) continue;
    for (const type of poi.types) {
      typeCounts[type] = (typeCounts[type] || 0) + 1;
      totalTypes++;
    }
  }

  if (totalTypes === 0) return [];

  return Object.entries(typeCounts)
    .map(([type, count]) => ({
      type,
      count,
      percentage: Math.round((count / totalTypes) * 100)
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // Top 5
}

/**
 * Parse Google Places priceLevel (PRICE_LEVEL_MODERATE → 2)
 *
 * @param priceLevel String priceLevel from Google Places
 * @returns Numeric level (1-4) or null
 */
function parsePriceLevel(priceLevel: string | null | undefined): number | null {
  if (!priceLevel) return null;
  const match = priceLevel.match(/PRICE_LEVEL_(\w+)/);
  if (!match) return null;
  const mapping: Record<string, number> = {
    'INEXPENSIVE': 1,
    'MODERATE': 2,
    'EXPENSIVE': 3,
    'VERY_EXPENSIVE': 4
  };
  return mapping[match[1]] || null;
}

/**
 * Calcule analyse pricing (moyenne + distribution)
 *
 * @param poiDict Dictionnaire des POI
 * @returns Analyse pricing avec moyenne et distribution
 */
function calculatePricingAnalysis(poiDict: Record<string, any>): {
  average_price_level: number | null;
  distribution: { 1: number; 2: number; 3: number; 4: number };
} {
  const priceLevels = Object.values(poiDict)
    .map(p => parsePriceLevel(p.priceLevel))
    .filter((p): p is number => p !== null);

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0 };
  priceLevels.forEach(level => {
    if (level >= 1 && level <= 4) {
      distribution[level as 1 | 2 | 3 | 4]++;
    }
  });

  const average = priceLevels.length > 0
    ? Math.round((priceLevels.reduce((a, b) => a + b, 0) / priceLevels.length) * 10) / 10
    : null;

  return { average_price_level: average, distribution };
}

/**
 * Calcule analyse réputation (rating moyen + total reviews)
 *
 * @param poiDict Dictionnaire des POI
 * @returns Analyse réputation
 */
function calculateReputationAnalysis(poiDict: Record<string, any>): {
  average_rating: number | null;
  total_reviews: number;
} {
  const ratings = Object.values(poiDict)
    .map(p => p.rating)
    .filter((r): r is number => r !== null && r !== undefined && typeof r === 'number');

  const average = ratings.length > 0
    ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
    : null;

  const totalReviews = Object.values(poiDict)
    .map(p => p.userRatingCount || 0)
    .reduce((a, b) => a + b, 0);

  return { average_rating: average, total_reviews: totalReviews };
}

/**
 * Génère market assessment (saturation, intensity, opportunity)
 * Logique métier basée sur densité et catégorisation
 *
 * @param params Paramètres pour calcul market assessment
 * @returns Market assessment complet
 */
function calculateMarketAssessment(params: {
  densityLevel: string;
  categorization: { direct_competitors: number; complementary: number; other_services: number };
  totalCompetitors: number;
  avgPrice: number | null;
}): {
  saturation_level: 'low' | 'moderate' | 'high' | 'very_high';
  competition_intensity: 'weak' | 'moderate' | 'strong' | 'very_strong';
  market_positioning_opportunity: string;
} {
  const { densityLevel, categorization, totalCompetitors, avgPrice } = params;

  // Calcul saturation_level (basé sur total competitors)
  let saturation_level: 'low' | 'moderate' | 'high' | 'very_high';
  if (totalCompetitors === 0) saturation_level = 'low';
  else if (totalCompetitors <= 4) saturation_level = 'low';
  else if (totalCompetitors <= 9) saturation_level = 'moderate';
  else if (totalCompetitors <= 14) saturation_level = 'high';
  else saturation_level = 'very_high';

  // Calcul competition_intensity (basé sur ratio direct competitors)
  const directRatio = categorization.direct_competitors / Math.max(totalCompetitors, 1);
  let competition_intensity: 'weak' | 'moderate' | 'strong' | 'very_strong';
  if (directRatio < 0.2) competition_intensity = 'weak';
  else if (directRatio < 0.4) competition_intensity = 'moderate';
  else if (directRatio < 0.6) competition_intensity = 'strong';
  else competition_intensity = 'very_strong';

  // Génération market_positioning_opportunity (logique métier)
  let opportunity = '';
  if (densityLevel === 'very_low') {
    opportunity = 'Marché peu saturé - Opportunité de premier entrant ou zone isolée';
  } else if (densityLevel === 'moderate' && avgPrice !== null && avgPrice < 2) {
    opportunity = 'Concurrence modérée orientée discount - Opportunité différenciation premium';
  } else if (densityLevel === 'very_high') {
    opportunity = 'Marché saturé - Différenciation forte nécessaire';
  } else {
    opportunity = `Densité ${densityLevel} - Positionnement stratégique à définir selon l'offre`;
  }

  return { saturation_level, competition_intensity, market_positioning_opportunity: opportunity };
}

// ===== INPUT / OUTPUT SCHEMAS =====

const InputSchema = z.object({
  strictMode: z.boolean().optional().describe('Si true, retourne error si données manquantes (coordinates, nearbyPoi)')
});

// ===== TOOL EXPORT =====

export const calculateCompetitorAnalysisTool = new FunctionTool({
  name: 'calculateCompetitorAnalysis',
  description: 'Calcule analyse concurrentielle complète (distances, catégorisation, métriques, market assessment). Lit nearbyPoi depuis state.nearbySearch, coordinates depuis state.preparation, nafCode depuis state.business. Retourne JSON structuré avec TOUS les calculs. Pattern du pipeline financier (calculateRatiosTool).',
  parameters: zToGen(InputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    try {
      console.log('[calculateCompetitorAnalysis] Starting analysis...');

      // 1. LIRE STATE
      const coordinates = toolContext?.state.get('preparation')?.coordinates;
      const nafCode = toolContext?.state.get('business')?.activite_principale;

      // nearbySearch peut avoir été stocké directement (pas de wrapper)
      let nearbySearchResult = toolContext?.state.get('nearbySearch');

      // Parser JSON string si nécessaire (ADK peut stocker en string)
      if (typeof nearbySearchResult === 'string') {
        try {
          nearbySearchResult = JSON.parse(nearbySearchResult);
        } catch (e) {
          nearbySearchResult = null;
        }
      }

      // Validation coordinates
      if (!coordinates || !coordinates.lat || !coordinates.lon) {
        console.error('[calculateCompetitorAnalysis] Coordinates manquantes');
        if (params.strictMode) {
          return {
            error: true,
            message: 'Coordinates manquantes dans state.preparation',
            nearby_poi: {},
            total_competitors: 0
          };
        }
        // Mode non-strict: retourner résultat vide valide
        return generateEmptyResult();
      }

      // Cas: Aucun POI trouvé (valide)
      if (!nearbySearchResult?.nearby_poi || Object.keys(nearbySearchResult.nearby_poi).length === 0) {
        console.log('[calculateCompetitorAnalysis] Aucun POI trouvé - zone isolée');
        return generateEmptyResult();
      }

      const nearbyPoi = nearbySearchResult.nearby_poi;
      console.log(`[calculateCompetitorAnalysis] Analyzing ${Object.keys(nearbyPoi).length} POI`);

      if (!nafCode) {
        console.warn('[calculateCompetitorAnalysis] NAF code manquant - fallback catégorisation générique');
      }

      // 2. ENRICHIR CHAQUE POI (distance + proximity + category + impact + bucket)
      const enrichedPoi: Record<string, any> = {};
      let bucketA = 0;
      let bucketB = 0;
      let bucketC = 0;
      let directCount = 0;
      let complementaryCount = 0;
      let otherCount = 0;
      let immediateCount = 0;
      let veryCloseCount = 0;

      for (const [poiId, poi] of Object.entries(nearbyPoi)) {
        if (!poi.location || typeof poi.location.lat !== 'number' || typeof poi.location.lon !== 'number') {
          console.warn(`[calculateCompetitorAnalysis] POI ${poiId} has invalid location, skipping`);
          continue;
        }

        // Calculer distance
        const distance = Math.round(calculateHaversineDistance(
          coordinates,
          { lat: poi.location.lat, lon: poi.location.lon }
        ));
        const proximityLevel = getProximityLevel(distance);

        // Catégoriser selon système buckets (2026-01-09)
        const { bucket, category, impact } = categorizePoi(poi.types || []);

        // Compter par bucket (nouveau système)
        if (bucket === 'A') bucketA++;
        else if (bucket === 'B') bucketB++;
        else bucketC++;

        // Compter par catégorie (legacy - rétrocompatibilité)
        if (category === 'direct_competitor') directCount++;
        else if (category === 'complementary') complementaryCount++;
        else otherCount++;

        // Compter proximité
        if (proximityLevel === 'immediate') immediateCount++;
        if (proximityLevel === 'very_close') veryCloseCount++;

        enrichedPoi[poiId] = {
          ...poi,
          distance_meters: distance,
          proximity_level: proximityLevel,
          bucket,          // Nouveau champ (2026-01-09)
          category,        // Legacy field
          impact
        };
      }

      // 3. CALCULER MÉTRIQUES AGRÉGÉES
      const totalCompetitors = directCount + complementaryCount + otherCount;
      const categorization = {
        // Nouveaux champs (système buckets 2026-01-09)
        bucket_a_competitors: bucketA,
        bucket_b_locomotives: bucketB,
        bucket_c_services: bucketC,

        // Anciens champs (rétrocompatibilité)
        direct_competitors: directCount,
        complementary: complementaryCount,
        other_services: otherCount
      };

      console.log(`[calculateCompetitorAnalysis] 🏷️ Buckets - A: ${bucketA}, B: ${bucketB}, C: ${bucketC}`);

      const densityLevel = calculateDensityLevel(totalCompetitors);
      const dominantTypes = calculateTypeFrequency(enrichedPoi);
      const pricingAnalysis = calculatePricingAnalysis(enrichedPoi);
      const reputationAnalysis = calculateReputationAnalysis(enrichedPoi);
      const marketAssessment = calculateMarketAssessment({
        densityLevel,
        categorization,
        totalCompetitors,
        avgPrice: pricingAnalysis.average_price_level
      });

      console.log(`[calculateCompetitorAnalysis] Results: ${totalCompetitors} total (${directCount} direct, ${complementaryCount} complementary, ${otherCount} other)`);
      console.log(`[calculateCompetitorAnalysis] Density: ${densityLevel}, Saturation: ${marketAssessment.saturation_level}, Intensity: ${marketAssessment.competition_intensity}`);

      // 4. RETOURNER RÉSULTAT COMPLET
      return {
        nearby_poi: enrichedPoi,
        categorization,
        total_competitors: totalCompetitors,
        density_level: densityLevel,
        search_radius_meters: 500,
        immediate_competitors: immediateCount,
        very_close_competitors: veryCloseCount,
        dominant_types: dominantTypes,
        pricing_analysis: pricingAnalysis,
        reputation_analysis: reputationAnalysis,
        market_assessment: marketAssessment
      };

    } catch (error: any) {
      console.error('[calculateCompetitorAnalysis] Error:', error.message, error.stack);
      return {
        error: true,
        message: error.message || 'Competitive analysis failed',
        nearby_poi: {},
        total_competitors: 0
      };
    }
  }
});

/**
 * Génère un résultat vide valide (0 POI trouvé)
 */
function generateEmptyResult() {
  return {
    nearby_poi: {},
    categorization: {
      // Nouveaux champs (système buckets 2026-01-09)
      bucket_a_competitors: 0,
      bucket_b_locomotives: 0,
      bucket_c_services: 0,
      // Anciens champs (rétrocompatibilité)
      direct_competitors: 0,
      complementary: 0,
      other_services: 0
    },
    total_competitors: 0,
    density_level: 'very_low' as const,
    search_radius_meters: 500,
    immediate_competitors: 0,
    very_close_competitors: 0,
    dominant_types: [],
    pricing_analysis: {
      average_price_level: null,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0 }
    },
    reputation_analysis: {
      average_rating: null,
      total_reviews: 0
    },
    market_assessment: {
      saturation_level: 'low' as const,
      competition_intensity: 'weak' as const,
      market_positioning_opportunity: 'Marché peu saturé - Opportunité de premier entrant'
    }
  };
}

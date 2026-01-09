/**
 * Categorize POI Tool - REFACTOR 2026-01-09
 *
 * Catégorise les POI selon un système universel de 3 buckets basé sur l'impact commercial,
 * remplaçant l'ancien système NAF-based.
 *
 * NOUVEAU SYSTÈME (2026-01-09):
 * - BUCKET A: Concurrents Directs (impact négatif)
 * - BUCKET B: Locomotives de Trafic (impact très positif - flux quotidien)
 * - BUCKET C: Services & Horeca (impact positif modéré - rétention)
 */

import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { zToGen } from '../../utils/schemaHelper.js';

/**
 * BUCKET A: Concurrents Directs
 * Impact: NÉGATIF (cannibalisent la clientèle)
 *
 * Types de commerces qui sont des concurrents directs universels
 * (notamment pour Tabac/Presse qui est le cas d'usage principal)
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
 *
 * Commerces à forte fréquentation quotidienne qui créent du passage piéton
 * et augmentent l'attractivité de la zone commerciale.
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
 *
 * Services et commerces qui augmentent le temps passé dans la zone,
 * créant des opportunités d'achats additionnels.
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

/**
 * Categorize POI by Bucket System
 *
 * Catégorise un POI selon le système 3 buckets universel.
 * Priorité: A > B > C (un concurrent direct reste un concurrent même s'il vend du pain)
 *
 * @param poiTypes - Array de types Google Places pour le POI
 * @returns Bucket, impact et label
 */
function categorizeByBucket(poiTypes: string[]): {
  bucket: 'A' | 'B' | 'C';
  impact: 'negative' | 'very_positive' | 'positive';
  label: string;
} {
  // Priorité 1: BUCKET A - Concurrents Directs
  if (poiTypes.some(t => DIRECT_COMPETITORS.includes(t))) {
    return {
      bucket: 'A',
      impact: 'negative',
      label: 'Concurrent Direct'
    };
  }

  // Priorité 2: BUCKET B - Locomotives de Trafic
  if (poiTypes.some(t => TRAFFIC_LOCOMOTIVES.includes(t))) {
    return {
      bucket: 'B',
      impact: 'very_positive',
      label: 'Locomotive de Trafic'
    };
  }

  // Priorité 3: BUCKET C - Services & Horeca
  if (poiTypes.some(t => SERVICES_HORECA.includes(t))) {
    return {
      bucket: 'C',
      impact: 'positive',
      label: 'Service/Horeca'
    };
  }

  // Fallback: considérer comme Service (BUCKET C)
  return {
    bucket: 'C',
    impact: 'positive',
    label: 'Autre'
  };
}

/**
 * Input Schema
 *
 * IMPORTANT: Le schéma est volontairement simplifié (z.any()) pour éviter les erreurs MALFORMED_FUNCTION_CALL
 * avec l'API Gemini. Le tool fait TOUTE la validation en interne.
 *
 * Pattern inspiré du pipeline financier qui fonctionne (validateSigTool, calculateRatiosTool).
 *
 * CHANGEMENT 2026-01-09: Suppression du paramètre businessNafCode
 * Le système de buckets est universel et ne dépend plus du NAF du commerce analysé.
 */
const inputSchema = z.object({
  nearbyPoi: z.any().describe('Dictionnaire des POI proches retourné par nearbySearch (clé = place_id, valeur = objet POI)')
});

/**
 * Categorize POI using universal bucket system
 */
export const categorizePoiTool = new FunctionTool({
  name: 'categorizePoi',
  description: 'Catégorise les POI proches selon le système 3 buckets universel (A: Concurrents, B: Locomotives, C: Services). Retourne { categorized_poi, categorization: { bucket_a/b/c, legacy fields } }',
  parameters: zToGen(inputSchema),

  execute: async ({ nearbyPoi }: z.infer<typeof inputSchema>) => {
    try {
      // Validation TypeScript robuste (nearbyPoi est z.any() dans le schéma)
      if (!nearbyPoi || typeof nearbyPoi !== 'object' || Array.isArray(nearbyPoi)) {
        console.error('[categorizePoiTool] Invalid nearbyPoi:', typeof nearbyPoi);
        return {
          success: false,
          error: 'nearbyPoi must be a dictionary object (Record<string, POI>)',
          categorized_poi: {},
          categorization: {
            bucket_a_competitors: 0,
            bucket_b_locomotives: 0,
            bucket_c_services: 0,
            direct_competitors: 0,
            complementary: 0,
            other_services: 0
          }
        };
      }

      const categorizedPoi: Record<string, any> = {};

      let bucketA = 0;
      let bucketB = 0;
      let bucketC = 0;

      // Categorize each POI using bucket system
      for (const [poiId, poi] of Object.entries(nearbyPoi)) {
        const poiTypes = poi.types || [];
        const { bucket, impact, label } = categorizeByBucket(poiTypes);

        // Compter par bucket
        if (bucket === 'A') bucketA++;
        else if (bucket === 'B') bucketB++;
        else bucketC++;

        // Enrichir le POI avec sa catégorisation
        categorizedPoi[poiId] = {
          ...poi,
          bucket,
          impact,
          label,
          // Champs legacy pour rétrocompatibilité
          category: bucket === 'A' ? 'direct_competitor' : (bucket === 'B' ? 'complementary' : 'other'),
          impact_legacy: bucket === 'A' ? 'negative' : (bucket === 'B' ? 'positive' : 'neutral')
        };
      }

      const categorization = {
        // Nouveaux champs (prioritaires - système 2026-01-09)
        bucket_a_competitors: bucketA,
        bucket_b_locomotives: bucketB,
        bucket_c_services: bucketC,

        // Anciens champs (rétrocompatibilité - déprécié)
        direct_competitors: bucketA,
        complementary: bucketB + bucketC,
        other_services: bucketC
      };

      console.log(`[categorizePoiTool] 🏷️ Buckets - A: ${bucketA}, B: ${bucketB}, C: ${bucketC}`);

      return {
        success: true,
        categorized_poi: categorizedPoi,
        categorization,
        system: 'bucket_v1' // Indicateur de version du système de catégorisation
      };

    } catch (error: any) {
      console.error('[categorizePoiTool] Error:', error.message);
      return {
        success: false,
        error: error.message,
        categorized_poi: nearbyPoi, // Return uncategorized
        categorization: {
          bucket_a_competitors: 0,
          bucket_b_locomotives: 0,
          bucket_c_services: 0,
          direct_competitors: 0,
          complementary: 0,
          other_services: Object.keys(nearbyPoi).length
        }
      };
    }
  }
});

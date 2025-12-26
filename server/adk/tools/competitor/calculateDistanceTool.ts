import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import { zToGen } from '../../utils/schemaHelper.js';

/**
 * Calculate Distance Tool
 *
 * Calcule la distance GPS entre deux points en utilisant
 * la formule de Haversine (distance orthodromique).
 *
 * Précision: ~0.5% d'erreur pour distances < 1000km
 *
 * Retourne:
 * - distance_meters: Distance en mètres
 * - distance_km: Distance en kilomètres (arrondi 2 décimales)
 * - walking_minutes: Temps de marche estimé (5 km/h)
 */

const CalculateDistanceInputSchema = z.object({
  from: z.object({
    lat: z.number(),
    lon: z.number()
  }).describe('Point de départ'),
  to: z.object({
    lat: z.number(),
    lon: z.number()
  }).describe('Point d\'arrivée')
});

/**
 * Formule de Haversine pour calcul distance GPS
 * @param lat1 Latitude point 1 (degrés)
 * @param lon1 Longitude point 1 (degrés)
 * @param lat2 Latitude point 2 (degrés)
 * @param lon2 Longitude point 2 (degrés)
 * @returns Distance en mètres
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Rayon de la Terre en mètres

  // Conversion degrés → radians
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  // Formule de Haversine
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export const calculateDistanceTool = new FunctionTool({
  name: 'calculateDistance',
  description: 'Calcule distance GPS entre deux points (Haversine). Retourne { distance_meters, distance_km, walking_minutes, proximity_level }',
  parameters: zToGen(CalculateDistanceInputSchema),

  execute: async ({ from, to }: z.infer<typeof CalculateDistanceInputSchema>) => {
    if (!from || !to || !from.lat || !from.lon || !to.lat || !to.lon) {
      return {
        distance_meters: null,
        distance_km: null,
        walking_minutes: null,
        proximity_level: 'unknown',
        error: 'Invalid coordinates'
      };
    }

    try {
      // Calcul distance
      const distanceMeters = haversineDistance(from.lat, from.lon, to.lat, to.lon);
      const distanceKm = Math.round(distanceMeters / 10) / 100; // Arrondi 2 décimales

      // Temps de marche estimé (vitesse moyenne: 5 km/h = 83.33 m/min)
      const walkingMinutes = Math.round(distanceMeters / 83.33);

      // Niveau de proximité
      let proximityLevel: 'immediate' | 'very_close' | 'close' | 'moderate' | 'far';
      if (distanceMeters <= 50) {
        proximityLevel = 'immediate'; // Même bâtiment/rue
      } else if (distanceMeters <= 200) {
        proximityLevel = 'very_close'; // Visibilité directe
      } else if (distanceMeters <= 500) {
        proximityLevel = 'close'; // Zone de chalandise piéton
      } else if (distanceMeters <= 1000) {
        proximityLevel = 'moderate'; // Zone élargie
      } else {
        proximityLevel = 'far'; // Hors zone immédiate
      }

      return {
        distance_meters: Math.round(distanceMeters),
        distance_km: distanceKm,
        walking_minutes: walkingMinutes,
        proximity_level: proximityLevel,
        from_coordinates: from,
        to_coordinates: to
      };

    } catch (error: any) {
      console.error('Distance calculation failed:', error.message);
      return {
        distance_meters: null,
        distance_km: null,
        walking_minutes: null,
        proximity_level: 'unknown',
        error: true,
        message: error.message
      };
    }
  }
});

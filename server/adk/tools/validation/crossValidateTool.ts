import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import { zToGen } from '../../utils/schemaHelper.js';

/**
 * Cross Validate Tool
 *
 * Valide la cohérence globale entre les outputs de plusieurs agents.
 * Détecte les incohérences majeures qui nécessitent arbitrage.
 */

const CrossValidateInputSchema = z.object({
  demographic: z.object({
    trade_area_potential: z.object({
      walking_500m: z.number().optional(),
      walking_1km: z.number().optional()
    }).optional(),
    csp_profile: z.object({
      dominant: z.enum(['high', 'middle', 'low', 'mixed']).optional()
    }).optional(),
    demographic_score: z.object({
      overall: z.number().optional()
    }).optional()
  }).optional(),

  places: z.object({
    found: z.boolean().optional(),
    rating: z.number().nullable().optional(),
    userRatingsTotal: z.number().optional(),
    priceLevel: z.number().nullable().optional(),
    location: z.object({
      lat: z.number(),
      lon: z.number()
    }).optional()
  }).optional(),

  photo: z.object({
    analyzed: z.boolean().optional(),
    etat_general: z.object({
      note_globale: z.number().optional()
    }).optional(),
    budget_travaux: z.object({
      fourchette_haute: z.number().optional()
    }).optional()
  }).optional(),

  competitor: z.object({
    nearby_poi: z.record(z.string(), z.any()).optional(),
    total_competitors: z.number().optional()
  }).optional(),

  preparation: z.object({
    coordinates: z.object({
      lat: z.number(),
      lon: z.number()
    }).nullable().optional()
  }).optional()
});

/**
 * Calcule la distance entre deux points GPS (en mètres)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Rayon de la Terre en mètres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export const crossValidateTool = new FunctionTool({
  name: 'crossValidate',
  description: 'Valide cohérence globale entre agents (demographic, places, photo, competitor). Détecte incohérences POPULATION_POI, CSP_PRICING, RATING_PHOTOS, GEOGRAPHIC. Retourne { valid, issues: [...] }',
  parameters: zToGen(CrossValidateInputSchema),

  execute: async (data: z.infer<typeof CrossValidateInputSchema>) => {
    const issues: Array<{
      type: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      description: string;
      sources: Record<string, any>;
    }> = [];

    // Validation 1: POPULATION vs POI
    if (data.demographic?.trade_area_potential && data.competitor) {
      const population = data.demographic.trade_area_potential.walking_500m || 0;
      const totalPOI = data.competitor.total_competitors || 0;

      // Si population élevée (>3000) mais 0 POI
      if (population > 3000 && totalPOI === 0) {
        issues.push({
          type: 'POPULATION_POI_MISMATCH',
          severity: 'HIGH',
          description: `Population importante (${population} hab) mais aucun POI concurrent trouvé. Vérifier coordonnées GPS ou recherche POI.`,
          sources: {
            demographic_population: population,
            competitor_total_poi: totalPOI
          }
        });
      }

      // Si population faible (<500) mais beaucoup de POI (>10)
      if (population < 500 && totalPOI > 10) {
        issues.push({
          type: 'POPULATION_POI_MISMATCH',
          severity: 'MEDIUM',
          description: `Population faible (${population} hab) mais ${totalPOI} POI trouvés. Zone commerciale dense malgré faible résidentiel.`,
          sources: {
            demographic_population: population,
            competitor_total_poi: totalPOI
          }
        });
      }
    }

    // Validation 2: CSP vs PRICING
    if (data.demographic?.csp_profile && data.places?.priceLevel !== undefined && data.places.priceLevel !== null) {
      const cspDominant = data.demographic.csp_profile.dominant;
      const priceLevel = data.places.priceLevel;

      // CSP high mais priceLevel 1 (discount)
      if (cspDominant === 'high' && priceLevel === 1) {
        issues.push({
          type: 'CSP_PRICING_MISMATCH',
          severity: 'MEDIUM',
          description: `Zone CSP+ (${cspDominant}) mais pricing discount (${priceLevel}/4). Opportunité repositionnement ou erreur matching.`,
          sources: {
            demographic_csp: cspDominant,
            places_price_level: priceLevel
          }
        });
      }

      // CSP low mais priceLevel 3-4 (premium)
      if (cspDominant === 'low' && priceLevel >= 3) {
        issues.push({
          type: 'CSP_PRICING_MISMATCH',
          severity: 'MEDIUM',
          description: `Zone CSP modeste (${cspDominant}) mais pricing élevé (${priceLevel}/4). Vérifier adéquation clientèle.`,
          sources: {
            demographic_csp: cspDominant,
            places_price_level: priceLevel
          }
        });
      }
    }

    // Validation 3: RATING vs PHOTOS
    if (data.places?.rating && data.photo?.analyzed && data.photo.etat_general?.note_globale !== undefined) {
      const googleRating = data.places.rating;
      const photoNote = data.photo.etat_general.note_globale;

      // Google rating élevé (>4.0) mais photos mauvaises (<5/10)
      if (googleRating > 4.0 && photoNote < 5) {
        issues.push({
          type: 'RATING_PHOTOS_MISMATCH',
          severity: 'HIGH',
          description: `Google rating élevé (${googleRating}/5) mais état physique médiocre (${photoNote}/10). Possible confusion établissement ou photos obsolètes.`,
          sources: {
            places_rating: googleRating,
            photo_note_globale: photoNote
          }
        });
      }

      // Google rating faible (<3.0) mais photos excellentes (>8/10)
      if (googleRating < 3.0 && photoNote > 8) {
        issues.push({
          type: 'RATING_PHOTOS_MISMATCH',
          severity: 'MEDIUM',
          description: `Google rating faible (${googleRating}/5) mais état physique excellent (${photoNote}/10). Problème service/accueil malgré bon état.`,
          sources: {
            places_rating: googleRating,
            photo_note_globale: photoNote
          }
        });
      }
    }

    // Validation 4: GEOGRAPHIC (GPS mismatch)
    if (data.preparation?.coordinates && data.places?.location) {
      const prepCoords = data.preparation.coordinates;
      const placesCoords = data.places.location;

      if (prepCoords && placesCoords) {
        const distance = calculateDistance(
          prepCoords.lat,
          prepCoords.lon,
          placesCoords.lat,
          placesCoords.lon
        );

        // Distance > 200m
        if (distance > 200) {
          issues.push({
            type: 'GEOGRAPHIC_MISMATCH',
            severity: 'CRITICAL',
            description: `Distance ${Math.round(distance)}m entre coordonnées préparation et Google Places. Possible mauvais matching établissement.`,
            sources: {
              preparation_coords: prepCoords,
              places_coords: placesCoords,
              distance_meters: Math.round(distance)
            }
          });
        }
        // Distance 100-200m (warning)
        else if (distance > 100) {
          issues.push({
            type: 'GEOGRAPHIC_MISMATCH',
            severity: 'MEDIUM',
            description: `Distance ${Math.round(distance)}m entre coordonnées. Vérifier précision GPS.`,
            sources: {
              preparation_coords: prepCoords,
              places_coords: placesCoords,
              distance_meters: Math.round(distance)
            }
          });
        }
      }
    }

    // Validation 5: SCORE CONSISTENCY (demographic score vs travaux budget)
    if (data.demographic?.demographic_score?.overall !== undefined && data.photo?.budget_travaux?.fourchette_haute !== undefined) {
      const demoScore = data.demographic.demographic_score.overall;
      const travauxBudget = data.photo.budget_travaux.fourchette_haute;

      // Score démographique élevé (>75) mais travaux importants (>50k€)
      if (demoScore > 75 && travauxBudget > 50000) {
        issues.push({
          type: 'SCORE_MISMATCH',
          severity: 'MEDIUM',
          description: `Bon potentiel démographique (${demoScore}/100) mais travaux lourds (${travauxBudget}€). Impact ROI à analyser.`,
          sources: {
            demographic_score: demoScore,
            budget_travaux_max: travauxBudget
          }
        });
      }
    }

    // Validation 6: DATA CONSISTENCY (Places not found avec coordonnées valides)
    if (data.places?.found === false && data.preparation?.coordinates) {
      issues.push({
        type: 'DATA_INCONSISTENCY',
        severity: 'MEDIUM',
        description: 'Commerce non trouvé dans Google Places malgré coordonnées valides. Possible commerce non référencé ou fermé.',
        sources: {
          places_found: false,
          has_coordinates: true
        }
      });
    }

    // Calcul global de validation
    const criticalCount = issues.filter(i => i.severity === 'CRITICAL').length;
    const highCount = issues.filter(i => i.severity === 'HIGH').length;

    const valid = criticalCount === 0 && highCount === 0;

    return {
      valid,
      total_issues: issues.length,
      critical_issues: criticalCount,
      high_issues: highCount,
      medium_issues: issues.filter(i => i.severity === 'MEDIUM').length,
      low_issues: issues.filter(i => i.severity === 'LOW').length,
      issues
    };
  }
});

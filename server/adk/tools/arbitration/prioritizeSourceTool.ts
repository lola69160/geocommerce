import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import { zToGen } from '../../utils/schemaHelper.js';

/**
 * Prioritize Source Tool
 *
 * Établit la hiérarchie de fiabilité des sources de données
 * pour guider l'arbitrage des conflits.
 *
 * Principes de priorisation:
 * 1. Données terrain > Estimations
 * 2. Sources officielles > APIs tierces
 * 3. Données récentes > Données anciennes
 * 4. Données directes > Données déduites
 */

const PrioritizeSourceInputSchema = z.object({
  conflictType: z.enum([
    'POPULATION_POI_MISMATCH',
    'CSP_PRICING_MISMATCH',
    'RATING_PHOTOS_MISMATCH',
    'DATA_INCONSISTENCY',
    'SCORE_MISMATCH',
    'GEOGRAPHIC_MISMATCH'
  ]),
  availableSources: z.array(z.string()).describe('Liste des sources impliquées (ex: ["demographic", "places", "photo"])')
});

/**
 * Niveaux de fiabilité par source et type de donnée
 */
const SOURCE_RELIABILITY: Record<string, Record<string, number>> = {
  // Préparation - Données initiales
  preparation: {
    coordinates: 85, // GPS depuis INPI/OpenData - fiable
    address: 90      // Adresse officielle - très fiable
  },

  // Demographic - Données gouvernementales
  demographic: {
    population: 95,  // INSEE via API Géo - très fiable
    csp: 70,         // Estimation basée densité - moyenne
    density: 90      // Calcul population/surface - fiable
  },

  // Places - Google Places API
  places: {
    location: 80,    // GPS Google - fiable si bon matching
    rating: 85,      // Avis vérifiés - fiable
    pricing: 75,     // Crowd-sourced - moyenne
    photos: 90,      // Photos réelles - très fiable
    reviews: 80      // Avis textuels - fiable
  },

  // Photo - Analyse Gemini Vision
  photo: {
    etat_general: 85,    // Analyse visuelle directe - fiable
    budget_travaux: 60,  // Estimation - moyenne-faible
    note_globale: 80     // Scoring automatique - fiable
  },

  // Competitor - Recherche POI
  competitor: {
    nearby_poi: 75,  // API Google Places - fiable si coordonnées OK
    distance: 85     // Calcul GPS - fiable
  }
};

export const prioritizeSourceTool = new FunctionTool({
  name: 'prioritizeSource',
  description: 'Établit hiérarchie de fiabilité des sources pour un type de conflit. Retourne { priority_order: [...], reliability_scores: {...}, recommendation }',
  parameters: zToGen(PrioritizeSourceInputSchema),

  execute: async ({ conflictType, availableSources }: z.infer<typeof PrioritizeSourceInputSchema>) => {
    const sourceScores: Record<string, { score: number; rationale: string }> = {};

    // Calcul scores par type de conflit
    switch (conflictType) {
      case 'POPULATION_POI_MISMATCH': {
        // Priorité: Demographic > Competitor (si GPS OK)
        if (availableSources.includes('demographic')) {
          sourceScores['demographic'] = {
            score: SOURCE_RELIABILITY.demographic.population,
            rationale: 'Données INSEE officielles via API Géo - source de référence pour population'
          };
        }
        if (availableSources.includes('competitor')) {
          sourceScores['competitor'] = {
            score: SOURCE_RELIABILITY.competitor.nearby_poi,
            rationale: 'Recherche POI dépend de la précision GPS - fiabilité conditionnelle'
          };
        }
        if (availableSources.includes('preparation')) {
          sourceScores['preparation'] = {
            score: SOURCE_RELIABILITY.preparation.coordinates,
            rationale: 'Coordonnées GPS source - détermine fiabilité recherche POI'
          };
        }
        break;
      }

      case 'CSP_PRICING_MISMATCH': {
        // Priorité: Places pricing > Demographic CSP (estimation)
        if (availableSources.includes('places')) {
          sourceScores['places'] = {
            score: SOURCE_RELIABILITY.places.pricing,
            rationale: 'Pricing Google Places crowd-sourced - reflète réalité terrain'
          };
        }
        if (availableSources.includes('demographic')) {
          sourceScores['demographic'] = {
            score: SOURCE_RELIABILITY.demographic.csp,
            rationale: 'CSP estimé par densité - approximation, non données réelles'
          };
        }
        break;
      }

      case 'RATING_PHOTOS_MISMATCH': {
        // Priorité: Photo (vision directe) ≈ Places rating
        if (availableSources.includes('photo')) {
          sourceScores['photo'] = {
            score: SOURCE_RELIABILITY.photo.etat_general,
            rationale: 'Analyse visuelle Gemini Vision - état physique objectif'
          };
        }
        if (availableSources.includes('places')) {
          sourceScores['places'] = {
            score: SOURCE_RELIABILITY.places.rating,
            rationale: 'Rating Google - perception client globale (service + lieu)'
          };
        }
        break;
      }

      case 'GEOGRAPHIC_MISMATCH': {
        // Priorité: Preparation (source) > Places (API tierce)
        if (availableSources.includes('preparation')) {
          sourceScores['preparation'] = {
            score: SOURCE_RELIABILITY.preparation.coordinates,
            rationale: 'GPS depuis registre officiel (INPI) - source de référence'
          };
        }
        if (availableSources.includes('places')) {
          sourceScores['places'] = {
            score: SOURCE_RELIABILITY.places.location,
            rationale: 'GPS Google Places - fiable SI bon matching, sinon erroné'
          };
        }
        break;
      }

      case 'SCORE_MISMATCH': {
        // Égalité - sources différentes, pas de priorité claire
        if (availableSources.includes('demographic')) {
          sourceScores['demographic'] = {
            score: 80,
            rationale: 'Score démographique basé données officielles'
          };
        }
        if (availableSources.includes('photo')) {
          sourceScores['photo'] = {
            score: SOURCE_RELIABILITY.photo.budget_travaux,
            rationale: 'Estimation budget travaux - approximation experte'
          };
        }
        break;
      }

      case 'DATA_INCONSISTENCY': {
        // Générique - appliquer scores par défaut
        availableSources.forEach(source => {
          const avgScore = Object.values(SOURCE_RELIABILITY[source] || {}).reduce((a, b) => a + b, 0) /
                          Object.keys(SOURCE_RELIABILITY[source] || {}).length;
          sourceScores[source] = {
            score: avgScore || 50,
            rationale: 'Score moyen pour cette source'
          };
        });
        break;
      }
    }

    // Trier par score décroissant
    const priorityOrder = Object.entries(sourceScores)
      .sort(([, a], [, b]) => b.score - a.score)
      .map(([source]) => source);

    // Recommandation basée sur écarts de score
    let recommendation: string;
    if (priorityOrder.length === 0) {
      recommendation = 'Aucune source disponible pour arbitrage';
    } else if (priorityOrder.length === 1) {
      recommendation = `Accepter données de ${priorityOrder[0]} (seule source)`;
    } else {
      const topSource = priorityOrder[0];
      const topScore = sourceScores[topSource].score;
      const secondScore = sourceScores[priorityOrder[1]].score;
      const gap = topScore - secondScore;

      if (gap > 20) {
        recommendation = `PRIVILÉGIER ${topSource} (écart +${gap} points) - fiabilité supérieure claire`;
      } else if (gap > 10) {
        recommendation = `Favoriser ${topSource} (écart +${gap} points) mais considérer ${priorityOrder[1]}`;
      } else {
        recommendation = `Sources équivalentes (écart ${gap} points) - HYBRID recommandé`;
      }
    }

    return {
      priority_order: priorityOrder,
      reliability_scores: sourceScores,
      conflict_type: conflictType,
      recommendation,
      highest_reliability_source: priorityOrder[0] || null,
      highest_score: sourceScores[priorityOrder[0]]?.score || 0
    };
  }
});

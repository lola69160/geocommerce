import { LlmAgent } from '@google/adk';
import { nearbySearchTool, calculateDistanceTool } from '../tools/competitor/index.js';
import { getModelConfig } from '../config/models.js';
import { getSystemPrompt } from '../config/prompts.js';
import type { AgentState } from '../types/index.js';

/**
 * CompetitorAgent - Analyse concurrentielle (ADK)
 *
 * Analyse la densité et la typologie des concurrents
 * à proximité du commerce cible.
 *
 * Responsabilités:
 * - Rechercher POI concurrents dans rayon 500m
 * - Calculer distances aux concurrents directs
 * - Analyser densité concurrentielle
 * - Identifier types de commerces dominants
 * - Évaluer niveau de saturation du marché
 * - Analyser pricing concurrent (si disponible)
 *
 * Modèle: gemini-2.0-flash-lite (analyse rapide)
 */
export class CompetitorAgent extends LlmAgent {
  constructor() {
    const modelConfig = getModelConfig('competitor');

    super({
      name: 'competitor',
      description: 'Analyse concurrentielle POI à proximité via Google Places',

      // Modèle Gemini
      model: modelConfig.name,

      // Configuration génération JSON forcé via responseMimeType)
      generateContentConfig: {
        temperature: modelConfig.temperature,
        topP: modelConfig.topP,
        topK: modelConfig.topK,
        maxOutputTokens: modelConfig.maxOutputTokens

      },

      // Tools disponibles
      tools: [nearbySearchTool, calculateDistanceTool],

      // Instruction système
      instruction: `${getSystemPrompt('competitor')}

Tu dois analyser la concurrence à proximité du commerce cible.

WORKFLOW:

1. **RÉCUPÉRATION COORDONNÉES**
   Depuis state.preparation.coordinates
   - Si null ou invalide: retourner erreur

2. **RECHERCHE POI CONCURRENTS**
   Appeler nearbySearch(coordinates, radius=200, includedTypes=[
     "store", "convenience_store", "supermarket", "grocery_store",
     "bakery", "cafe", "restaurant", "meal_takeaway",
     "clothing_store", "shoe_store", "jewelry_store",
     "book_store", "florist", "furniture_store", "home_goods_store",
     "electronics_store", "hardware_store", "pet_store",
     "beauty_salon", "hair_care", "spa", "gym"
   ])
   - Recherche dans rayon 200m (zone de passage client direct)
   - Filtre UNIQUEMENT commerces de détail et services de proximité
   - Retourne nearby_poi, total_competitors, by_type, density_level

3. **ANALYSE DISTANCES** (si concurrents trouvés)
   Pour les 5 concurrents les plus proches:
   - Appeler calculateDistance(from=coordinates, to=poi.location)
   - Identifier concurrents immédiats (< 50m)
   - Identifier concurrents très proches (< 200m)

4. **ANALYSE TYPOLOGIE**
   - Types de commerces dominants
   - Distribution par catégorie
   - Niveau de spécialisation vs diversité

5. **ÉVALUATION CONCURRENCE**
   - Densité: very_low, low, moderate, high, very_high
   - Saturation: Ratio POI / population (si disponible)
   - Pricing moyen concurrent (si priceLevel disponible)
   - Réputation moyenne (rating)

FORMAT DE SORTIE JSON (STRICT):

{
  "nearby_poi": {
    "place_id": {
      "name": "string",
      "types": ["string"],
      "location": { "lat": number, "lon": number },
      "distance_meters": number,
      "proximity_level": "immediate" | "very_close" | "close" | "moderate" | "far",
      "rating": number | null,
      "priceLevel": number | null
    }
  },
  "total_competitors": number,
  "density_level": "very_low" | "low" | "moderate" | "high" | "very_high",
  "search_radius_meters": 500,
  "immediate_competitors": number,
  "very_close_competitors": number,
  "dominant_types": [
    {
      "type": "string",
      "count": number,
      "percentage": number
    }
  ],
  "pricing_analysis": {
    "average_price_level": number | null,
    "distribution": {
      "1": number,
      "2": number,
      "3": number,
      "4": number
    }
  },
  "reputation_analysis": {
    "average_rating": number | null,
    "total_reviews": number
  },
  "market_assessment": {
    "saturation_level": "low" | "moderate" | "high" | "very_high",
    "competition_intensity": "weak" | "moderate" | "strong" | "very_strong",
    "market_positioning_opportunity": "string"
  }
}

Si aucun concurrent trouvé:
{
  "nearby_poi": {},
  "total_competitors": 0,
  "density_level": "very_low",
  "search_radius_meters": 500,
  "market_assessment": {
    "saturation_level": "low",
    "competition_intensity": "weak",
    "market_positioning_opportunity": "Marché peu saturé - Opportunité de premier entrant"
  }
}

RÈGLES IMPORTANTES:

1. **DENSITÉ CONCURRENTIELLE:**
   - very_low: 0 POI
   - low: 1-4 POI
   - moderate: 5-9 POI
   - high: 10-14 POI
   - very_high: 15+ POI

2. **PROXIMITÉ:**
   - immediate: < 50m (même rue/bâtiment)
   - very_close: 50-200m (visibilité directe)
   - close: 200-500m (zone chalandise)
   - moderate: 500-1000m
   - far: > 1000m

3. **SATURATION MARCHÉ:**
   - Croiser densité POI + population (si dispo)
   - < 5 POI pour >3000 hab = low
   - 10-15 POI pour 2000-5000 hab = moderate
   - > 15 POI pour <3000 hab = high/very_high

4. **TYPES DOMINANTS:**
   - Lister top 5 types par fréquence
   - Calculer pourcentages
   - Identifier si zone spécialisée ou diversifiée

5. **MARKET POSITIONING:**
   Si density_level = very_low:
   - "Marché peu saturé - Opportunité premier entrant ou zone isolée"

   Si density_level = moderate + pricing moyen < 2:
   - "Concurrence modérée orientée discount - Opportunité différenciation premium"

   Si density_level = very_high:
   - "Marché saturé - Différenciation forte nécessaire"

RETOURNE UNIQUEMENT LE JSON VALIDE.`,

      // Clé de sortie dans le state
      outputKey: 'competitor' as keyof AgentState
    });
  }
}

export default CompetitorAgent;

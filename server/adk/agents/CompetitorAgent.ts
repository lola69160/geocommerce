import { LlmAgent } from '@google/adk';
import { nearbySearchTool, calculateCompetitorAnalysisTool } from '../tools/competitor/index.js';
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

      // ⚠️ CRITICAL: Do NOT add responseMimeType or responseSchema
      // These are incompatible with tools (Function Calling) - see models.ts line 44
      // JSON output is achieved via explicit instructions below
      generateContentConfig: {
        temperature: modelConfig.temperature,
        topP: modelConfig.topP,
        topK: modelConfig.topK,
        maxOutputTokens: modelConfig.maxOutputTokens
      },

      // Tools disponibles
      tools: [nearbySearchTool, calculateCompetitorAnalysisTool],

      // Instruction système
      instruction: `${getSystemPrompt('competitor')}

Tu dois analyser la concurrence à proximité du commerce cible.

⚠️ IMPORTANT: Les calculs sont automatisés par le tool calculateCompetitorAnalysis.
NE CALCULE RIEN manuellement (distances, moyennes, pourcentages, catégorisation).
Ton rôle est d'APPELER les tools puis INTERPRÉTER les résultats stratégiquement.

WORKFLOW SIMPLIFIÉ:

1. **RECHERCHE POI CONCURRENTS** (2026-01-09: Rayon étendu à 500m)
   nearbySearch({ radius: 500, includedTypes: [
     "store", "convenience_store", "supermarket", "grocery_store",
     "bakery", "cafe", "restaurant", "meal_takeaway",
     "clothing_store", "shoe_store", "jewelry_store",
     "book_store", "florist", "furniture_store", "home_goods_store",
     "electronics_store", "hardware_store", "pet_store",
     "beauty_salon", "hair_care", "spa", "gym"
   ]})

   Le tool lit automatiquement coordinates depuis state.preparation.
   Retourne nearby_poi (dictionnaire des POI Google Places).
   Note: Rayon étendu à 500m pour capturer l'écosystème commercial complet (locomotives de trafic).

2. **CALCULER ANALYSE COMPLÈTE**
   calculateCompetitorAnalysis({})

   Ce tool fait AUTOMATIQUEMENT :
   - Calcul distances (formule Haversine)
   - Détermination proximityLevel (immediate, very_close, etc.)
   - Catégorisation POI (direct_competitor, complementary, other)
   - Comptage immediate_competitors, very_close_competitors
   - Analyse dominant_types (top 5 avec pourcentages)
   - Analyse pricing (moyenne + distribution)
   - Analyse reputation (rating moyen + total reviews)
   - Market assessment (saturation, intensity, opportunity)

   Retourne JSON COMPLET avec TOUS les calculs.

3. **INTERPRÉTER LES RÉSULTATS**
   Tu dois INTERPRÉTER les données retournées par le tool et fournir une analyse stratégique :

   - Contexte concurrentiel (densité, types dominants, concurrents directs vs complémentaires)
   - Forces et faiblesses de la position (proximité, pricing, réputation)
   - Opportunités de différenciation (gaps dans l'offre, positionnement prix)
   - Recommandations stratégiques (2-3 paragraphes d'expertise)

FORMAT DE SORTIE JSON (STRICT):

{
  "analyzed": true,
  "analysis": {
    /* COPIE INTÉGRALE du résultat de calculateCompetitorAnalysis */
    "nearby_poi": { ... },
    "categorization": { ... },
    "total_competitors": number,
    "density_level": "string",
    "immediate_competitors": number,
    "very_close_competitors": number,
    "dominant_types": [...],
    "pricing_analysis": { ... },
    "reputation_analysis": { ... },
    "market_assessment": { ... }
  },
  "interpretation": "2-3 paragraphes d'expertise stratégique sur la concurrence et le positionnement recommandé"
}

Si aucun concurrent trouvé:
{
  "analyzed": true,
  "analysis": {
    "nearby_poi": {},
    "total_competitors": 0,
    "density_level": "very_low",
    "market_assessment": {
      "saturation_level": "low",
      "competition_intensity": "weak",
      "market_positioning_opportunity": "Marché peu saturé - Opportunité de premier entrant"
    }
  },
  "interpretation": "Zone isolée avec absence de concurrence directe. Analyser si isolement géographique ou opportunité de premier entrant avec potentiel de monopole local."
}

RÈGLES CRITIQUES:

1. **NE CALCULE PAS** les distances, moyennes, pourcentages (calculateCompetitorAnalysis le fait)
2. **NE CATÉGORISE PAS** manuellement les POI (le tool utilise NAF_CATEGORIES)
3. **COPIE INTÉGRALEMENT** le résultat du tool dans "analysis"
4. **CONCENTRE-TOI** sur l'INTERPRÉTATION stratégique (expertise humaine)
5. **UTILISE** ton expertise pour contextualiser les données brutes

RETOURNE UNIQUEMENT LE JSON VALIDE.`,

      // Clé de sortie dans le state
      outputKey: 'competitor' as keyof AgentState
    });
  }
}

export default CompetitorAgent;

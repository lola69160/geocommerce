import { LlmAgent } from '@google/adk';
import {
  getCommuneDataTool,
  tavilySearchTool,
  estimateCSPTool,
  calculateDemographicScoreTool
} from '../tools/demographic';
import { getModelConfig } from '../config/models';
import { getSystemPrompt } from '../config/prompts';
import type { AgentState } from '../types';

/**
 * DemographicAgent - Analyse démographique de la zone (ADK)
 *
 * Analyse les données démographiques de la commune pour évaluer
 * l'adéquation du profil clientèle avec l'activité commerciale.
 *
 * Responsabilités:
 * - Récupérer données commune via API Géo (gouv.fr)
 * - Estimer profil CSP (Catégories Socio-Professionnelles)
 * - Calculer zone de chalandise potentielle
 * - Scorer l'adéquation démographique
 *
 * Pattern ADK:
 * - Utilise 3 tools via function calling
 * - Output en JSON via responseMimeType
 * - State injection automatique via outputKey
 */
export class DemographicAgent extends LlmAgent {
  constructor() {
    const modelConfig = getModelConfig('demographic');

    super({
      name: 'demographic',
      description: 'Analyse démographique et zone de chalandise',

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
      tools: [
        getCommuneDataTool,
        tavilySearchTool,
        estimateCSPTool,
        calculateDemographicScoreTool
      ],

      // Instruction système (SIMPLIFIÉ - tools accèdent au state via ToolContext)
      instruction: `${getSystemPrompt('demographic')}

Tu analyses la démographie de la zone du commerce.

Les données preparation sont disponibles dans state.preparation (les tools y accèdent automatiquement).

WORKFLOW:

1. Appeler tavilySearch() - enrichissement contextuel local
   - L'outil retourne des résultats bruts (title, content, url) potentiellement en ANGLAIS
   - **CRITIQUE**: Tu dois SYNTHÉTISER ces résultats EN FRANÇAIS uniquement
   - NE PAS copier les textes bruts - REFORMULER en français
   - Si TAVILY_API_KEY absent: skip gracefully, continuer workflow

2. Appeler getCommuneData() - lit zipCode depuis state.preparation.normalizedAddress.zipCode

3. Si données commune trouvées:
   - Calculer density = population / surface
   - Classifier urban_level selon density (rural <100, low 100-500, medium 500-2000, high 2000-5000, very_high >5000)
   - Appeler estimateCSP({ density, population }) ← FALLBACK si Tavily ne fournit pas CSP
   - Calculer trade_area_potential (500m: density * 0.785, 1km: density * 3.14, 3km: density * 28.27)
   - Appeler calculateDemographicScore({ urbanLevel, population, cspProfile }) - lit nafCode depuis state.business
   - SYNTHÉTISER insights Tavily EN FRANÇAIS dans local_context et interpretation

4. Si données commune indisponibles: retourner { analyzed: false, reason: "Commune data unavailable" }

FORMAT JSON:
{
  "analyzed": true,
  "commune": { nom, code, codePostal, population, surface, density },
  "local_context": {
    "recent_news": [
      { "title": "Titre synthétisé EN FRANÇAIS", "content": "Résumé synthétisé EN FRANÇAIS (2-3 phrases)", "url": "..." }
    ],
    "urban_projects": [
      { "title": "Projet synthétisé EN FRANÇAIS", "content": "Description synthétisée EN FRANÇAIS (2-3 phrases)", "url": "..." }
    ],
    "economic_activity": [
      { "title": "Activité synthétisée EN FRANÇAIS", "content": "Contexte synthétisé EN FRANÇAIS (2-3 phrases)", "url": "..." }
    ],
    "economic_dynamism": "high|medium|low",
    "seasonality": {
      "has_tourism": boolean,
      "has_events": boolean,
      "seasonal_variation": "Synthèse EN FRANÇAIS de la variation saisonnière",
      "population_increase_estimated": number ou null
    },
    "tavily_searched": boolean
  },
  "profile": {
    "urban_level": "rural"|"low"|"medium"|"high"|"very_high",
    "density_category": "Zone rurale"|"Zone péri-urbaine"|"Zone urbaine"|"Centre-ville dense",
    "estimated_csp": { dominant, high_percentage, middle_percentage, low_percentage },
    "population_size": "Petite commune"|"Commune moyenne"|"Grande ville",
    "trade_area_potential": { walking_500m, driving_1km, driving_3km }
  },
  "score": { overall, density_match, population_size, csp_adequacy },
  "interpretation": "Synthèse EN FRANÇAIS incluant contexte Tavily"
}

**IMPORTANT LOCAL_CONTEXT**:
- Si tavilySearch() retourne du texte anglais → TRADUIRE et REFORMULER en français
- Chaque title/content doit être une SYNTHÈSE française (pas une copie brute)
- Objectif: Fournir contexte territorial actionnable en français pour le rapport

RÈGLES:
1. Les tools lisent automatiquement depuis state - juste leur passer les valeurs calculées
2. Retourner UNIQUEMENT le JSON valide`,

      // Clé de sortie dans le state
      outputKey: 'demographic' as keyof AgentState
    });
  }
}

export default DemographicAgent;

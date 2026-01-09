import { LlmAgent } from '@google/adk';
import { calculateLocationScoreTool, calculateScoresTool, categorizeRiskTool } from '../tools/gap/index.js';
import { getModelConfig } from '../config/models.js';
import { getSystemPrompt } from '../config/prompts.js';
import type { AgentState } from '../types/index.js';

/**
 * GapAnalysisAgent - Analyse des écarts et risques (ADK)
 *
 * Analyse les écarts entre potentiel et état actuel,
 * calcule scores multi-dimensionnels et catégorise risques.
 *
 * Responsabilités:
 * - Calculer scores 4 dimensions (Location, Market, Operational, Financial)
 * - Générer score global pondéré (0-100)
 * - Identifier risques par catégorie avec sévérité
 * - Proposer stratégies de mitigation
 * - Évaluer gaps entre potentiel théorique et réalité terrain
 *
 * Dimensions de scoring:
 * - LOCATION (30%): Emplacement, démographie, zone chalandise
 * - MARKET (25%): Réputation, concurrence, demande
 * - OPERATIONAL (25%): État physique, budget travaux
 * - FINANCIAL (20%): Cohérence données, ratio potentiel/investissement
 *
 * Risques identifiés:
 * - LOCATION_RISK: Accessibilité, visibilité, zone chalandise
 * - MARKET_RISK: Concurrence, saturation, réputation
 * - OPERATIONAL_RISK: Travaux, état physique, conformité
 * - FINANCIAL_RISK: Viabilité, investissement, ROI
 *
 * Modèle: gemini-2.0-flash-lite (analyse rapide)
 */
export class GapAnalysisAgent extends LlmAgent {
  constructor() {
    const modelConfig = getModelConfig('gap');

    super({
      name: 'gap',
      description: 'Analyse écarts et risques avec scoring multi-dimensionnel',

      // Modèle Gemini
      model: modelConfig.name,

      // ⚠️ No responseMimeType - incompatible with tools (see models.ts line 44)
      generateContentConfig: {
        temperature: modelConfig.temperature,
        topP: modelConfig.topP,
        topK: modelConfig.topK,
        maxOutputTokens: modelConfig.maxOutputTokens
      },

      // Tools disponibles
      tools: [calculateLocationScoreTool, calculateScoresTool, categorizeRiskTool],

      // Instruction système
      instruction: `${getSystemPrompt('gap')}

Tu dois analyser les écarts entre potentiel et réalité, puis identifier les risques.

WORKFLOW:

⚠️⚠️⚠️ RÈGLE CRITIQUE - ORDRE D'EXÉCUTION OBLIGATOIRE ⚠️⚠️⚠️

1. **CALCUL LOCATION SCORE AVEC NOUVELLE FORMULE (2026-01-09)**
   Tu DOIS appeler calculateLocationScore EN PREMIER (avant calculateScores).

   Nouvelle formule "Weighted Opportunity Score":
   LocationScore = (CommercialSynergy 50%) + (DemographicQuality 30%) + (CompetitorPressure 20%)

   Le tool lit automatiquement depuis state:
   - state.competitor.analysis.categorization (buckets A/B/C)
   - state.competitor.analysis.nearby_poi (distances)
   - state.demographic.commune.density
   - state.demographic.profile.estimated_csp.median_income_estimate

   Retourne: { location_score, breakdown, interpretation }

2. **CALCUL SCORES MULTI-DIMENSIONNELS (OBLIGATOIRE EN DEUXIÈME)**
   Appeler calculateScores avec le location_score calculé précédemment.

   Passe les données depuis le state:
   - state.demographic (score démographique, population, CSP avec median_income_estimate)
   - state.places (rating, matching GPS)
   - state.photo (état physique, budget travaux)
   - state.competitor (categorization avec buckets A/B/C, nearby_poi avec distances)
   - state.validation (cohérence données)

   Le tool retourne un objet avec:
   {
     scores: {
       location: number (0-100),
       market: number (0-100),
       operational: number (0-100),
       financial: number (0-100),
       overall: number (0-100)
     },
     level: "excellent" | "good" | "fair" | "poor",
     breakdown: { ... },
     interpretation: { ... }
   }

   ⚠️ STOCKE LE RÉSULTAT dans une variable "calculatedScores"

2. **CATÉGORISATION RISQUES (UTILISE calculatedScores.scores)**
   Appeler categorizeRisk en passant:
   - scores: calculatedScores.scores (objet complet de l'étape 1)
   - demographic: state.demographic
   - places: state.places
   - photo: state.photo
   - competitor: state.competitor
   - validation: state.validation

   ⚠️ NE JAMAIS construire manuellement l'objet scores
   ⚠️ NE JAMAIS appeler categorizeRisk sans avoir d'abord appelé calculateScores
   ⚠️ TOUJOURS passer calculatedScores.scores (PAS calculatedScores tout seul)

   Le tool retourne:
   - risks: [...] (liste des risques identifiés)
   - summary: { ... } (statistiques)
   - risk_score: number (0-100, inversé: 100 = pas de risque)
   - overall_risk_level: "low" | "moderate" | "high" | "critical"

3. **ANALYSE GAPS**
   Comparer potentiel théorique vs réalité:
   - Gap démographique: Potentiel zone vs attractivité réelle
   - Gap marché: Demande vs saturation concurrentielle
   - Gap opérationnel: État souhaité vs travaux requis
   - Gap financier: ROI espéré vs investissement nécessaire

4. **SYNTHÈSE FINALE**
   Générer vue d'ensemble:
   - Scores par dimension
   - Risques bloquants et non-bloquants
   - Gaps majeurs à combler
   - Priorités d'action

FORMAT DE SORTIE JSON (STRICT):

⚠️ IMPORTANT: Utilise les résultats exacts de calculateScores et categorizeRisk
⚠️ Ne modifie PAS les scores retournés par les tools
⚠️ Copie-les directement dans ton JSON de sortie

{
  "scores": {
    "location": number (0-100),
    "market": number (0-100),
    "operational": number (0-100),
    "financial": number (0-100),
    "overall": number (0-100)
  },
  "level": "excellent" | "good" | "fair" | "poor",
  "breakdown": {
    "location": {
      "demographic_score": number,
      "trade_area_population": number,
      "gps_matching": number
    },
    "market": {
      "google_reputation": number,
      "review_volume": number,
      "competitive_density": number
    },
    "operational": {
      "physical_condition": number,
      "renovation_cost": number
    },
    "financial": {
      "data_coherence": number,
      "potential_to_investment_ratio": number
    }
  },
  "interpretation": {
    "location": "string",
    "market": "string",
    "operational": "string",
    "financial": "string"
  },
  "risks": [
    {
      "category": "LOCATION_RISK" | "MARKET_RISK" | "OPERATIONAL_RISK" | "FINANCIAL_RISK",
      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "description": "string",
      "impact": "string",
      "mitigation": "string",
      "cost_estimate": number (optionnel)
    }
  ],
  "risk_summary": {
    "total_risks": number,
    "risk_score": number (0-100, inversé),
    "overall_risk_level": "low" | "moderate" | "high" | "critical",
    "blocking": boolean,
    "by_severity": {
      "critical": number,
      "high": number,
      "medium": number,
      "low": number
    },
    "by_category": {
      "location": number,
      "market": number,
      "operational": number,
      "financial": number
    }
  },
  "gaps": [
    {
      "type": "demographic" | "market" | "operational" | "financial",
      "description": "string",
      "severity": "major" | "moderate" | "minor",
      "action_required": "string"
    }
  ],
  "priorities": [
    "string (action prioritaire)"
  ]
}

RÈGLES IMPORTANTES:

1. **SCORING:**
   - Location (30%): Démographie + zone chalandise + matching GPS
   - Market (25%): Réputation + volume avis + densité concurrent (inversé)
   - Operational (25%): État physique + budget travaux (inversé)
   - Financial (20%): Cohérence + ratio potentiel/investissement

2. **SÉVÉRITÉ RISQUES:**
   - CRITICAL: Bloquant GO/NO-GO
   - HIGH: Impact majeur sur rentabilité
   - MEDIUM: Impact modéré, mitigation recommandée
   - LOW: Vigilance simple

3. **GAPS IDENTIFICATION:**
   Gap majeur si:
   - Score dimension < 50
   - Risque CRITICAL ou 2+ HIGH dans catégorie
   - Écart >30 points entre potentiel et réalité

4. **PRIORITÉS:**
   Ordre:
   1. Risques CRITICAL
   2. Gaps majeurs bloquants
   3. Risques HIGH
   4. Gaps modérés

5. **RISK SCORE (inversé):**
   - 100 = Aucun risque
   - 75-99 = Risques faibles
   - 50-74 = Risques modérés
   - 25-49 = Risques élevés
   - 0-24 = Risques critiques

RETOURNE UNIQUEMENT LE JSON VALIDE.`,

      // Clé de sortie dans le state
      outputKey: 'gap' as keyof AgentState
    });
  }
}

export default GapAnalysisAgent;

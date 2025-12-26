import { LlmAgent } from '@google/adk';
import { askClarificationTool } from '../tools/strategic/index.js';
import { getModelConfig } from '../config/models.js';
import { getSystemPrompt } from '../config/prompts.js';
import type { AgentState } from '../types/index.js';

/**
 * StrategicAgent - Analyse stratégique GO/NO-GO (ADK)
 *
 * Agent final qui synthétise toutes les analyses et génère
 * une recommandation GO/NO-GO argumentée avec clarifications dynamiques.
 *
 * Responsabilités:
 * - Synthétiser outputs de tous les agents (preparation → arbitration)
 * - Demander clarifications aux agents si nécessaire
 * - Analyser cohérence globale et conflits résolus
 * - Évaluer opportunité commerciale (potentiel vs risques)
 * - Calculer score GO/NO-GO (0-100)
 * - Générer recommandation finale avec arguments
 * - Lister conditions de succès et points de vigilance
 *
 * Clarifications dynamiques disponibles:
 * - PhotoAgent: Nature travaux urgents, détails budget
 * - CompetitorAgent: Prix moyens, types concurrents, densité
 * - DemographicAgent: Détails CSP, potentiel zone chalandise
 * - PlacesAgent: Analyse avis, réputation
 *
 * Modèle: gemini-2.0-flash-thinking-exp (raisonnement stratégique complexe)
 *
 * Output:
 * - recommendation: GO | NO-GO | GO_WITH_RESERVES
 * - score: 0-100
 * - rationale: arguments détaillés
 * - success_conditions: conditions de réussite
 * - risk_factors: facteurs de risque
 * - clarifications_used: clarifications demandées
 */
export class StrategicAgent extends LlmAgent {
  constructor() {
    const modelConfig = getModelConfig('strategic');

    super({
      name: 'strategic',
      description: 'Analyse stratégique finale avec clarifications dynamiques et recommandation GO/NO-GO',

      // Modèle Gemini Thinking
      model: modelConfig.name,

      // Configuration génération JSON forcé via responseMimeType)
      generateContentConfig: {
        temperature: modelConfig.temperature,
        topP: modelConfig.topP,
        topK: modelConfig.topK,
        maxOutputTokens: modelConfig.maxOutputTokens

      },

      // Tools disponibles
      tools: [askClarificationTool],

      // Instruction système
      instruction: `${getSystemPrompt('strategic')}

Tu es un expert en stratégie commerciale qui génère une recommandation GO/NO-GO finale.

WORKFLOW:

1. **SYNTHÈSE DONNÉES**
   Analyser tous les outputs agents disponibles:
   - preparation: Adresse, coordonnées GPS
   - demographic: Population, CSP, potentiel zone chalandise
   - places: Rating, avis, pricing, réputation
   - photo: État physique, budget travaux
   - competitor: Densité concurrentielle, types POI
   - validation: Conflits détectés, score cohérence
   - arbitration: Résolutions, actions requises

2. **CLARIFICATIONS DYNAMIQUES** (OPTIONNEL - max 3)

   ⚠️ IMPORTANT: askClarification analyse les données EXISTANTES dans state
   (PAS de nouvelles données externes). Utilise-le pour extraire détails supplémentaires
   des outputs agents déjà générés.

   ✅ UTILISER askClarification SI:
   - Travaux urgents > 30k€ mais nature floue (sécurité vs esthétique?)
     → askClarification(targetAgent='photo', question='Travaux urgents: sécurité ou esthétique?', agentData=state.photo)

   - Densité concurrentielle élevée mais pricing unclear
     → askClarification(targetAgent='competitor', question='Prix moyens pratiqués?', agentData=state.competitor)

   - CSP+ détecté mais besoin détails distribution
     → askClarification(targetAgent='demographic', question='Détails profil CSP zone?', agentData=state.demographic)

   - Rating Google < 3.5
     → askClarification(targetAgent='places', question='Problèmes récurrents dans avis?', agentData=state.places)

   ❌ NE PAS UTILISER askClarification SI:
   - Données déjà claires dans outputs agents
   - Pas d'impact sur décision GO/NO-GO
   - Juste curiosité (limité à 3 max)

   SYNTAXE:
   askClarification({
     targetAgent: 'photo',
     question: 'Question précise en français',
     agentData: state.photo  // ← OBLIGATOIRE: passer l'output complet de l'agent
   })

   Retourne: { agent, question, answer, confidence }
   → UTILISER answer dans rationale/success_conditions

3. **ANALYSE STRATÉGIQUE**

   A. **POTENTIEL** (0-100):
      - Population zone chalandise (30 points)
      - Adéquation CSP/activité (25 points)
      - Emplacement/visibilité (20 points)
      - Densité concurrentielle (15 points)
      - Réputation Google (10 points)

   B. **RISQUES** (0-100):
      - Budget travaux vs rentabilité (30 points)
      - Concurrence saturée (25 points)
      - Conflits non résolus (20 points)
      - État physique médiocre (15 points)
      - Réputation négative (10 points)

   C. **COHÉRENCE**:
      - Score validation.coherence_score
      - Conflits résolus par arbitration
      - Actions requises (URGENT/HIGH)

4. **SCORE GO/NO-GO** (0-100)
   Formule:
   score = (potentiel * 0.5) + ((100 - risques) * 0.3) + (coherence * 0.2)

   - 75-100: GO (forte opportunité)
   - 50-74: GO_WITH_RESERVES (opportunité conditionnelle)
   - 0-49: NO-GO (risques > opportunités)

5. **RECOMMANDATION FINALE**
   Générer arguments détaillés:
   - Points forts décisifs
   - Points faibles critiques
   - Conditions de succès
   - Actions pré-lancement
   - ROI estimé
   - Timeline

FORMAT DE SORTIE JSON (STRICT):

{
  "recommendation": "GO" | "NO-GO" | "GO_WITH_RESERVES",
  "score": number (0-100),
  "confidence": number (0.0-1.0),
  "rationale": {
    "strengths": [
      "string (point fort)"
    ],
    "weaknesses": [
      "string (point faible)"
    ],
    "opportunities": [
      "string (opportunité)"
    ],
    "threats": [
      "string (menace)"
    ]
  },
  "scores": {
    "potential": number (0-100),
    "risk": number (0-100),
    "coherence": number (0-100),
    "overall": number (0-100)
  },
  "success_conditions": [
    {
      "condition": "string",
      "priority": "CRITICAL" | "HIGH" | "MEDIUM",
      "estimated_cost": number (euros),
      "timeline": "string"
    }
  ],
  "risk_factors": [
    {
      "factor": "string",
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "mitigation": "string",
      "impact_on_roi": "string"
    }
  ],
  "financial_summary": {
    "initial_investment_min": number,
    "initial_investment_max": number,
    "estimated_monthly_revenue": number,
    "breakeven_months": number,
    "roi_24_months": "string (pourcentage)"
  },
  "clarifications_used": [
    {
      "agent": "photo" | "competitor" | "demographic" | "places",
      "question": "string",
      "answer": "string",
      "impact_on_decision": "string"
    }
  ],
  "next_steps": [
    "string (action prioritaire)"
  ]
}

RÈGLES IMPORTANTES:

1. **QUAND DEMANDER CLARIFICATIONS:**
   - Données ambiguës affectant GO/NO-GO
   - Travaux > 30k€ sans détail nature
   - Concurrence forte sans analyse pricing
   - Rating faible sans compréhension causes
   - CSP élevé sans confirmation potentiel

2. **SEUILS DÉCISION:**
   - GO: score ≥ 75 ET conflits CRITICAL résolus
   - GO_WITH_RESERVES: 50-74 OU conflits HIGH non bloquants
   - NO-GO: score < 50 OU conflits CRITICAL non résolus

3. **CONDITIONS DE SUCCÈS:**
   Toujours inclure:
   - Budget travaux (si > 20k€)
   - Actions arbitration URGENT/HIGH
   - Repositionnement si nécessaire
   - Timeline réaliste

4. **FINANCIAL SUMMARY:**
   - Investment = prix acquisition + travaux
   - Revenue = estimation basée CSP + concurrence
   - Breakeven conservateur (x1.5 estimation)

RETOURNE UNIQUEMENT LE JSON VALIDE.`,

      // Clé de sortie dans le state
      outputKey: 'strategic' as keyof AgentState
    });
  }
}

export default StrategicAgent;

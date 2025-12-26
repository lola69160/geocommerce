import { LlmAgent } from '@google/adk';
import { crossValidateTool, detectConflictsTool, scoreCoherenceTool } from '../tools/validation/index.js';
import { getModelConfig } from '../config/models.js';
import { getSystemPrompt } from '../config/prompts.js';
import type { AgentState } from '../types/index.js';

/**
 * ValidationAgent - Validation croisée inter-agents (ADK)
 *
 * Agent critique qui détecte automatiquement les incohérences
 * entre les outputs des différents agents du pipeline.
 *
 * Responsabilités:
 * - Valider cohérence globale entre agents
 * - Détecter 6 types de conflits:
 *   1. POPULATION_POI_MISMATCH
 *   2. CSP_PRICING_MISMATCH
 *   3. RATING_PHOTOS_MISMATCH
 *   4. DATA_INCONSISTENCY
 *   5. SCORE_MISMATCH
 *   6. GEOGRAPHIC_MISMATCH
 * - Générer objets Conflict structurés avec UUID
 * - Calculer score de cohérence global (0-100)
 * - Identifier conflits bloquants (CRITICAL/HIGH)
 * - Recommander arbitrage si nécessaire
 *
 * Modèle: gemini-2.0-flash-thinking-exp (raisonnement complexe)
 *
 * Output:
 * - valid: boolean (aucun conflit bloquant)
 * - coherence_score: 0-100
 * - conflicts: Conflict[]
 * - requires_arbitration: boolean
 */
export class ValidationAgent extends LlmAgent {
  constructor() {
    const modelConfig = getModelConfig('validation');

    super({
      name: 'validation',
      description: 'Validation croisée automatique détectant incohérences entre agents',

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
      tools: [crossValidateTool, detectConflictsTool, scoreCoherenceTool],

      // Instruction système
      instruction: `${getSystemPrompt('validation')}

Tu es un agent de validation croisée expert qui détecte les incohérences entre agents.

WORKFLOW (SÉQUENTIEL - 3 ÉTAPES OBLIGATOIRES):

1. **ÉTAPE 1 - CROSS-VALIDATION**
   Appeler crossValidate() en passant les OBJETS COMPLETS depuis state:

   crossValidate({
     demographic: state.demographic,
     places: state.places,
     photo: state.photo,
     competitor: state.competitor,
     preparation: state.preparation
   })

   ⚠️ IMPORTANT: Passer les objets complets, PAS des champs individuels
   Retourne: { valid, total_issues, critical_issues, high_issues, issues: [...] }

   → STOCKER le résultat pour étapes suivantes

2. **ÉTAPE 2 - CONFLICT DETECTION** (si total_issues > 0)
   Appeler detectConflicts en passant le résultat complet de crossValidate:

   detectConflicts({
     validationResult: crossValidateResult
   })

   où crossValidateResult est l'objet retourné par l'étape 1
   Retourne: { conflicts: [...], summary: {...} }

3. **ÉTAPE 3 - COHERENCE SCORING**
   Appeler scoreCoherence en passant le summary des conflits:

   scoreCoherence({
     conflictSummary: conflictDataResult.summary,
     agentsCompleted: ["preparation", "demographic", "places", "photo", "competitor"]
   })

   où conflictDataResult est l'objet retourné par l'étape 2
   Retourne: { score, level, recommendations }

4. **SYNTHÈSE FINALE**
   Combiner tous les résultats des 3 outils pour générer le JSON final

FLUX D'EXÉCUTION:

ÉTAPE 1 - Appeler crossValidate:
  Input: { demographic: state.demographic, places: state.places, photo: state.photo, competitor: state.competitor, preparation: state.preparation }
  Output attendu: { valid: false, total_issues: 3, critical_issues: 1, high_issues: 2, issues: [...] }

ÉTAPE 2 - Appeler detectConflicts (SI total_issues > 0):
  Input: { validationResult: [OUTPUT ÉTAPE 1] }
  Output attendu: { conflicts: [{ id: "uuid1", type: "POPULATION_POI_MISMATCH", severity: "HIGH", ... }], summary: { by_type: {...}, by_severity: {...} } }

ÉTAPE 3 - Appeler scoreCoherence:
  Input: { conflictSummary: [OUTPUT ÉTAPE 2].summary, agentsCompleted: ["preparation", "demographic", "places", "photo", "competitor"] }
  Output attendu: { score: 72, level: "good", recommendations: [...] }

ÉTAPE 4 - Construire JSON final en combinant tous les outputs:
  {
    "valid": [OUTPUT ÉTAPE 1].valid,
    "coherence_score": [OUTPUT ÉTAPE 3].score,
    "coherence_level": [OUTPUT ÉTAPE 3].level,
    "total_conflicts": [OUTPUT ÉTAPE 2].conflicts.length,
    "conflicts": [OUTPUT ÉTAPE 2].conflicts,
    "summary": [OUTPUT ÉTAPE 2].summary,
    ...
  }

Note: [OUTPUT ÉTAPE X] signifie "utiliser le résultat retourné par l'étape X", PAS une variable littérale.

FORMAT DE SORTIE JSON (STRICT):

{
  "valid": boolean,
  "coherence_score": number (0-100),
  "coherence_level": "excellent" | "good" | "medium" | "poor",
  "total_conflicts": number,
  "blocking_conflicts": number,
  "requires_arbitration": boolean,
  "conflicts": [
    {
      "id": "uuid",
      "type": "POPULATION_POI_MISMATCH" | "CSP_PRICING_MISMATCH" | "RATING_PHOTOS_MISMATCH" | "DATA_INCONSISTENCY" | "SCORE_MISMATCH" | "GEOGRAPHIC_MISMATCH",
      "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      "description": "string",
      "sources": {
        "agent1_field": value,
        "agent2_field": value
      },
      "detectedAt": "ISO datetime",
      "resolved": false
    }
  ],
  "summary": {
    "by_type": { "POPULATION_POI_MISMATCH": 1, ... },
    "by_severity": { "CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 0 },
    "recommendations": ["string"]
  },
  "reliability": "high" | "medium" | "low"
}

RÈGLES IMPORTANTES:

1. **SÉVÉRITÉ DES CONFLITS**
   - CRITICAL: Erreur majeure (ex: distance GPS > 200m)
   - HIGH: Incohérence importante (ex: population élevée mais 0 POI)
   - MEDIUM: Anomalie notable (ex: CSP+ mais pricing discount)
   - LOW: Vigilance simple

2. **SEUILS DE VALIDATION**
   - Population/POI: >3000 hab mais 0 POI = HIGH
   - GPS distance: >200m = CRITICAL, >100m = MEDIUM
   - Rating/Photos: écart >2 points = HIGH

3. **ARBITRAGE REQUIS SI:**
   - Au moins 1 conflit CRITICAL
   - Au moins 2 conflits HIGH
   - Score cohérence < 50
   - Données bloquantes pour décision GO/NO-GO

4. **AGENTS COMPLÉTUDE**
   Vérifier présence de:
   - state.preparation
   - state.demographic
   - state.places
   - state.photo
   - state.competitor

Si un agent est absent, ne pas générer de conflit pour ce pair.

RETOURNE UNIQUEMENT LE JSON VALIDE.`,

      // Clé de sortie dans le state
      outputKey: 'validation' as keyof AgentState
    });
  }
}

export default ValidationAgent;

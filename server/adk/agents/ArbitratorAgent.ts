import { LlmAgent } from '@google/adk';
import { resolveConflictTool, prioritizeSourceTool } from '../tools/arbitration/index.js';
import { getModelConfig } from '../config/models.js';
import { getSystemPrompt } from '../config/prompts.js';
import type { AgentState } from '../types/index.js';

/**
 * ArbitratorAgent - Résolution intelligente de conflits (ADK)
 *
 * Agent critique qui résout les conflits détectés par ValidationAgent
 * en appliquant une logique d'arbitrage sophistiquée.
 *
 * Responsabilités:
 * - Recevoir conflits de ValidationAgent
 * - Prioriser sources selon fiabilité (terrain > estimations)
 * - Résoudre chaque conflit avec une des 4 stratégies:
 *   1. CONFIRMED - Source A correcte
 *   2. REJECTED - Source B correcte
 *   3. HYBRID - Les deux sources partiellement vraies
 *   4. NEEDS_REVALIDATION - Données insuffisantes
 * - Générer confidence scoring (0.0 - 1.0)
 * - Proposer actions correctives
 * - Mettre à jour données avec résolutions
 *
 * Modèle: gemini-2.0-flash-thinking-exp (raisonnement complexe)
 *
 * Principes d'arbitrage:
 * - Données terrain > Estimations
 * - Sources officielles > APIs tierces
 * - Données récentes > Anciennes
 * - Données directes > Déduites
 *
 * Output:
 * - resolutions: Resolution[] (une par conflit)
 * - summary: statistiques résolutions
 * - updated_fields: données corrigées
 * - actions_required: liste actions correctives
 */
export class ArbitratorAgent extends LlmAgent {
  constructor() {
    const modelConfig = getModelConfig('arbitrator');

    super({
      name: 'arbitrator',
      description: 'Résolution intelligente de conflits avec priorisation sources et confidence scoring',

      // Modèle Gemini Thinking
      model: modelConfig.name,

      // ⚠️ No responseMimeType - incompatible with tools (see models.ts line 44)
      generateContentConfig: {
        temperature: modelConfig.temperature,
        topP: modelConfig.topP,
        topK: modelConfig.topK,
        maxOutputTokens: modelConfig.maxOutputTokens
      },

      // Tools disponibles
      tools: [resolveConflictTool, prioritizeSourceTool],

      // Instruction système
      instruction: `${getSystemPrompt('arbitrator')}

Tu es un agent d'arbitrage expert qui résout les conflits de données détectés par ValidationAgent.

WORKFLOW (TRAITER CHAQUE CONFLIT INDIVIDUELLEMENT):

1. **RÉCUPÉRATION CONFLITS**
   Lire state.validation.conflicts
   - Si aucun conflit OU requires_arbitration=false:
     → Retourner { "arbitrated": false, "reason": "No conflicts requiring arbitration" }
   - Si conflits présents: procéder aux étapes 2-4 POUR CHAQUE CONFLIT

2. **BOUCLE SUR CHAQUE CONFLIT** (Gemini peut appeler PLUSIEURS tools par tour)

   Pour CHAQUE conflit:
     a) Appeler prioritizeSource({ type: conflict.type, sources: conflict.sources })
        → Retourne { priority_order, highest_reliability_source, recommendation }

     b) ⚠️⚠️⚠️ CRITIQUE: Appeler resolveConflict avec L'OBJET COMPLET:
        resolveConflict({
          conflict: {
            id: conflict.id,
            type: conflict.type,
            severity: conflict.severity,
            description: conflict.description,
            sources: conflict.sources
          }
        })
        → Retourne { resolution, confidence, explanation, action, updated_data }

   ⚠️ IMPORTANT: Gemini peut appeler prioritizeSource + resolveConflict pour CHAQUE conflit
   dans UNE SEULE réponse (appels multiples autorisés)

3. **COLLECTE DES RÉSOLUTIONS**
   Stocker TOUTES les résolutions dans un tableau

4. **SYNTHÈSE GLOBALE**
   Agréger:
   - Statistiques par type résolution (CONFIRMED: X, REJECTED: Y, NEEDS_REVALIDATION: Z)
   - Actions requises triées par priorité
   - Champs mis à jour
   - Confiance moyenne
   - Impact GO/NO-GO

EXEMPLE - 2 CONFLITS À ARBITRER:

state.validation.conflicts = [
  { id: "uuid1", type: "POPULATION_POI_MISMATCH", severity: "HIGH", ... },
  { id: "uuid2", type: "GEOGRAPHIC_MISMATCH", severity: "CRITICAL", ... }
]

// Dans UNE SEULE réponse Gemini, appeler:
1. prioritizeSource({ type: "POPULATION_POI_MISMATCH", sources: conflict1.sources })
2. resolveConflict({ conflict: conflict1 })  // ⚠️ Objet conflict COMPLET
3. prioritizeSource({ type: "GEOGRAPHIC_MISMATCH", sources: conflict2.sources })
4. resolveConflict({ conflict: conflict2 })  // ⚠️ Objet conflict COMPLET

// Puis générer JSON final avec les 2 résolutions
{
  "arbitrated": true,
  "total_conflicts_arbitrated": 2,
  "resolutions": [
    { conflict_id: "uuid1", resolution: "NEEDS_REVALIDATION", ... },
    { conflict_id: "uuid2", resolution: "REJECTED", ... }
  ],
  ...
}

FORMAT DE SORTIE JSON (STRICT):

{
  "arbitrated": boolean,
  "total_conflicts_arbitrated": number,
  "resolutions": [
    {
      "conflict_id": "uuid",
      "conflict_type": "POPULATION_POI_MISMATCH" | ...,
      "original_severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "resolution": "CONFIRMED" | "REJECTED" | "HYBRID" | "NEEDS_REVALIDATION",
      "confidence": number (0.0 - 1.0),
      "explanation": "string (explication détaillée)",
      "action": "string (action corrective)",
      "updated_data": { /* champs mis à jour */ },
      "source_priority": {
        "priority_order": ["source1", "source2"],
        "highest_reliability_source": "source1",
        "recommendation": "string"
      },
      "resolved_at": "ISO datetime"
    }
  ],
  "summary": {
    "by_resolution_type": {
      "CONFIRMED": number,
      "REJECTED": number,
      "HYBRID": number,
      "NEEDS_REVALIDATION": number
    },
    "average_confidence": number (0.0 - 1.0),
    "high_confidence_resolutions": number (>= 0.8),
    "low_confidence_resolutions": number (< 0.6)
  },
  "actions_required": [
    {
      "priority": "URGENT" | "HIGH" | "MEDIUM" | "LOW",
      "action": "string",
      "related_conflicts": ["uuid"],
      "deadline": "immediate" | "before_go_live" | "post_launch"
    }
  ],
  "updated_fields": {
    /* Champs de données corrigés après arbitrage */
    /* Exemple: "gps_validation_required": true */
  },
  "go_no_go_impact": {
    "blocking_issues_resolved": boolean,
    "remaining_critical_issues": number,
    "confidence_level": "high" | "medium" | "low",
    "recommendation": "GO" | "NO-GO" | "GO_WITH_RESERVES"
  }
}

Si aucun conflit à arbitrer:
{
  "arbitrated": false,
  "reason": "No conflicts requiring arbitration"
}

LOGIQUE D'ARBITRAGE PAR TYPE:

**POPULATION_POI_MISMATCH:**
- Population élevée + 0 POI → NEEDS_REVALIDATION (vérifier GPS)
- Population faible + beaucoup POI → HYBRID (zone commerciale)

**CSP_PRICING_MISMATCH:**
- CSP+ + pricing discount → HYBRID (opportunité repositionnement)
- CSP modeste + pricing premium → HYBRID (risque inadéquation)

**RATING_PHOTOS_MISMATCH:**
- Rating élevé + état médiocre → NEEDS_REVALIDATION (confusion établissement)
- Rating faible + état excellent → HYBRID (problème service)

**GEOGRAPHIC_MISMATCH:**
- Distance > 200m → REJECTED (rejeter données Places)
- Distance 100-200m → NEEDS_REVALIDATION (vérifier)

**SCORE_MISMATCH:**
- Bon potentiel + gros travaux → HYBRID (analyser ROI)

**DATA_INCONSISTENCY:**
- Généralement → NEEDS_REVALIDATION

RÈGLES DE CONFIDENCE:

- 0.90-1.00: Certitude élevée, résolution fiable
- 0.70-0.89: Bonne confiance, résolution probable
- 0.50-0.69: Confiance moyenne, vérification recommandée
- 0.00-0.49: Faible confiance, revalidation nécessaire

ACTIONS PRIORITAIRES:

- URGENT: Conflits CRITICAL bloquant GO/NO-GO
- HIGH: Conflits HIGH affectant fiabilité analyse
- MEDIUM: Conflits MEDIUM à surveiller
- LOW: Conflits LOW informatifs

RETOURNE UNIQUEMENT LE JSON VALIDE.`,

      // Clé de sortie dans le state
      outputKey: 'arbitration' as keyof AgentState
    });
  }
}

export default ArbitratorAgent;

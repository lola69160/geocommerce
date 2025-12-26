import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import { zToGen } from '../../utils/schemaHelper.js';

/**
 * Score Coherence Tool
 *
 * Calcule un score de cohérence global (0-100) basé sur:
 * - Nombre de conflits détectés
 * - Sévérité des conflits
 * - Complétude des données agents
 * - Alignement entre sources
 *
 * Score > 85: Excellente cohérence
 * Score 70-85: Bonne cohérence
 * Score 50-70: Cohérence moyenne (vigilance)
 * Score < 50: Cohérence faible (arbitrage nécessaire)
 */

const ScoreCoherenceInputSchema = z.object({
  conflictSummary: z.object({
    total_conflicts: z.number(),
    blocking_conflicts: z.number(),
    by_severity: z.object({
      CRITICAL: z.number(),
      HIGH: z.number(),
      MEDIUM: z.number(),
      LOW: z.number()
    })
  }),

  // Complétude des agents (optionnel)
  agentsCompleted: z.object({
    preparation: z.boolean().optional(),
    demographic: z.boolean().optional(),
    places: z.boolean().optional(),
    photo: z.boolean().optional(),
    competitor: z.boolean().optional()
  }).optional()
});

export const scoreCoherenceTool = new FunctionTool({
  name: 'scoreCoherence',
  description: 'Calcule score de cohérence global 0-100 basé sur conflits et complétude données. Retourne { score, level, breakdown, recommendation }',
  parameters: zToGen(ScoreCoherenceInputSchema),

  execute: async ({ conflictSummary, agentsCompleted }: z.infer<typeof ScoreCoherenceInputSchema>) => {
    let score = 100; // Score parfait au départ

    // Déduction 1: Conflits par sévérité
    const severityPenalties = {
      CRITICAL: 25,  // -25 points par conflit critique
      HIGH: 15,      // -15 points par conflit high
      MEDIUM: 8,     // -8 points par conflit medium
      LOW: 3         // -3 points par conflit low
    };

    score -= conflictSummary.by_severity.CRITICAL * severityPenalties.CRITICAL;
    score -= conflictSummary.by_severity.HIGH * severityPenalties.HIGH;
    score -= conflictSummary.by_severity.MEDIUM * severityPenalties.MEDIUM;
    score -= conflictSummary.by_severity.LOW * severityPenalties.LOW;

    // Plancher à 0
    score = Math.max(0, score);

    // Déduction 2: Complétude des agents (optionnel)
    let completenessScore = 100;
    if (agentsCompleted) {
      const totalAgents = 5;
      const completedCount = Object.values(agentsCompleted).filter(Boolean).length;
      completenessScore = Math.round((completedCount / totalAgents) * 100);
    }

    // Score final pondéré (70% conflits, 30% complétude)
    const finalScore = Math.round(score * 0.7 + completenessScore * 0.3);

    // Niveau de cohérence
    let level: 'excellent' | 'good' | 'medium' | 'poor';
    if (finalScore >= 85) level = 'excellent';
    else if (finalScore >= 70) level = 'good';
    else if (finalScore >= 50) level = 'medium';
    else level = 'poor';

    // Breakdown détaillé
    const breakdown = {
      conflict_impact: Math.round(score),
      completeness_impact: completenessScore,
      critical_penalty: conflictSummary.by_severity.CRITICAL * severityPenalties.CRITICAL,
      high_penalty: conflictSummary.by_severity.HIGH * severityPenalties.HIGH,
      medium_penalty: conflictSummary.by_severity.MEDIUM * severityPenalties.MEDIUM,
      low_penalty: conflictSummary.by_severity.LOW * severityPenalties.LOW
    };

    // Recommandation
    let recommendation: string;
    if (level === 'excellent') {
      recommendation = 'Données cohérentes. Analyse fiable, pas d\'arbitrage nécessaire.';
    } else if (level === 'good') {
      recommendation = 'Bonne cohérence globale. Conflits mineurs à surveiller.';
    } else if (level === 'medium') {
      recommendation = 'Cohérence moyenne. Arbitrage recommandé pour conflits identifiés.';
    } else {
      recommendation = 'ATTENTION: Cohérence faible. Arbitrage URGENT requis avant décision GO/NO-GO.';
    }

    // Détails par type de conflit (si disponible)
    const hasBlockingConflicts = conflictSummary.blocking_conflicts > 0;

    return {
      score: finalScore,
      level,
      breakdown,
      recommendation,
      blocking_conflicts: conflictSummary.blocking_conflicts,
      requires_arbitration: hasBlockingConflicts || level === 'poor',
      reliability: level === 'excellent' || level === 'good' ? 'high' : level === 'medium' ? 'medium' : 'low'
    };
  }
});

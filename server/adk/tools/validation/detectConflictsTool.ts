import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import { zToGen } from '../../utils/schemaHelper.js';
import { randomUUID } from 'crypto';

/**
 * Detect Conflicts Tool
 *
 * Détecte et génère des objets Conflict structurés
 * pour chaque incohérence détectée par crossValidate.
 *
 * Chaque conflict inclut:
 * - ID unique (UUID)
 * - Type de conflit
 * - Sévérité
 * - Sources de données conflictuelles
 * - Description humaine
 * - Timestamp
 */

const DetectConflictsInputSchema = z.object({
  validationResult: z.object({
    valid: z.boolean(),
    total_issues: z.number(),
    issues: z.array(
      z.object({
        type: z.string(),
        severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
        description: z.string(),
        sources: z.record(z.string(), z.any())
      })
    )
  })
});

export const detectConflictsTool = new FunctionTool({
  name: 'detectConflicts',
  description: 'Convertit les issues de validation en objets Conflict structurés avec UUID, timestamp, et métadonnées. Retourne { conflicts: [...], summary: {...} }',
  parameters: zToGen(DetectConflictsInputSchema),

  execute: async ({ validationResult }: z.infer<typeof DetectConflictsInputSchema>) => {
    const conflicts = validationResult.issues.map(issue => ({
      id: randomUUID(),
      type: issue.type as 'POPULATION_POI_MISMATCH' | 'CSP_PRICING_MISMATCH' | 'RATING_PHOTOS_MISMATCH' | 'DATA_INCONSISTENCY' | 'SCORE_MISMATCH' | 'GEOGRAPHIC_MISMATCH',
      severity: issue.severity,
      sources: issue.sources,
      description: issue.description,
      detectedAt: new Date().toISOString(),
      resolved: false
    }));

    // Statistiques par type
    const conflictsByType: Record<string, number> = {};
    conflicts.forEach(conflict => {
      conflictsByType[conflict.type] = (conflictsByType[conflict.type] || 0) + 1;
    });

    // Statistiques par sévérité
    const conflictsBySeverity = {
      CRITICAL: conflicts.filter(c => c.severity === 'CRITICAL').length,
      HIGH: conflicts.filter(c => c.severity === 'HIGH').length,
      MEDIUM: conflicts.filter(c => c.severity === 'MEDIUM').length,
      LOW: conflicts.filter(c => c.severity === 'LOW').length
    };

    // Conflits bloquants (CRITICAL ou HIGH)
    const blockingConflicts = conflicts.filter(
      c => c.severity === 'CRITICAL' || c.severity === 'HIGH'
    );

    // Recommandations basées sur les conflits
    const recommendations: string[] = [];

    if (blockingConflicts.length > 0) {
      recommendations.push('Arbitrage URGENT requis : conflits bloquants détectés');
    }

    if (conflictsByType['GEOGRAPHIC_MISMATCH']) {
      recommendations.push('Vérifier coordonnées GPS et matching Google Places');
    }

    if (conflictsByType['POPULATION_POI_MISMATCH']) {
      recommendations.push('Revalider recherche POI ou coordonnées géographiques');
    }

    if (conflictsByType['RATING_PHOTOS_MISMATCH']) {
      recommendations.push('Possibilité de confusion établissement - vérifier matching');
    }

    if (conflictsByType['CSP_PRICING_MISMATCH']) {
      recommendations.push('Analyser opportunité repositionnement pricing');
    }

    if (conflictsByType['SCORE_MISMATCH']) {
      recommendations.push('Évaluer impact travaux sur ROI global');
    }

    return {
      conflicts,
      summary: {
        total_conflicts: conflicts.length,
        blocking_conflicts: blockingConflicts.length,
        requires_arbitration: blockingConflicts.length > 0,
        by_type: conflictsByType,
        by_severity: conflictsBySeverity,
        recommendations
      }
    };
  }
});

import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';
import { ALERT_RULES } from '../../config/alertRules';
import { findSectorBenchmark, DEFAULT_BENCHMARK } from '../../config/sectorBenchmarks';
import type {
  DeterministicAlert,
  AlertEvaluationContext,
  DeterministicAlertsResult,
  AlertCategory
} from '../../schemas/alertRulesSchema';

/**
 * Generate Deterministic Alerts Tool
 *
 * Genere des alertes reproductibles basees sur des regles deterministes.
 * Remplace la synthese LLM de pointsVigilance pour garantir la reproductibilite.
 *
 * Caracteristiques:
 * - Regles avec seuils fixes (ex: EBE chute > 30% = critical)
 * - Templates de messages avec valeurs injectees
 * - Meme input = meme output (100% reproductible)
 * - Tri par severite (critical > warning > info)
 * - Compatible avec le format existant (pointsVigilance[])
 */

const GenerateDeterministicAlertsInputSchema = z.object({
  debug: z.boolean().optional().describe('Mode debug pour logs detailles')
});

const DeterministicAlertSchema = z.object({
  id: z.string(),
  category: z.enum(['rentabilite', 'endettement', 'croissance', 'tresorerie', 'valorisation', 'immobilier', 'donnees']),
  severity: z.enum(['critical', 'warning', 'info']),
  title: z.string(),
  message: z.string(),
  impact: z.string(),
  recommendation: z.string(),
  values: z.record(z.string(), z.any())
});

const GenerateDeterministicAlertsOutputSchema = z.object({
  alerts: z.array(DeterministicAlertSchema),
  summary: z.object({
    totalAlerts: z.number(),
    criticalCount: z.number(),
    warningCount: z.number(),
    infoCount: z.number(),
    categoryCounts: z.record(z.string(), z.number())
  }),
  pointsVigilance: z.array(z.string()),
  error: z.string().optional()
});

export const generateDeterministicAlertsTool = new FunctionTool({
  name: 'generateDeterministicAlerts',
  description: 'Genere des alertes reproductibles basees sur des regles deterministes avec seuils fixes',
  parameters: zToGen(GenerateDeterministicAlertsInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    const debug = params.debug || false;

    try {
      if (debug) {
        console.log('[generateDeterministicAlerts] 🔍 Tool called');
      }

      // 1. Parse all state data
      const comptable = parseState(toolContext?.state.get('comptable'));
      const valorisation = parseState(toolContext?.state.get('valorisation'));
      const immobilier = parseState(toolContext?.state.get('immobilier'));
      const documentExtraction = parseState(toolContext?.state.get('documentExtraction'));
      const businessInfo = parseState(toolContext?.state.get('businessInfo'));

      if (debug) {
        console.log('[generateDeterministicAlerts] State loaded:', {
          hasComptable: !!comptable,
          hasValo: !!valorisation,
          hasImmo: !!immobilier,
          hasDocs: !!documentExtraction,
          hasBusinessInfo: !!businessInfo
        });
      }

      // 2. Get sector benchmark for comparison
      const sectorCode = businessInfo?.secteurActivite || '';
      const benchmark = findSectorBenchmark(sectorCode) || DEFAULT_BENCHMARK;

      if (debug) {
        console.log('[generateDeterministicAlerts] Sector code:', sectorCode, '→ Sector:', benchmark.sector);
      }

      // 3. Build context object for rule evaluation
      const context: AlertEvaluationContext = {
        comptable,
        valorisation,
        immobilier,
        documentExtraction,
        businessInfo,
        benchmark
      };

      // 4. Evaluate all rules
      const alerts: DeterministicAlert[] = [];

      for (const rule of ALERT_RULES) {
        try {
          if (rule.condition(context)) {
            const values = rule.extractValues(context);
            const alert: DeterministicAlert = {
              id: rule.id,
              category: rule.category,
              severity: rule.severity,
              title: rule.titleTemplate,
              message: rule.messageTemplate(values),
              impact: rule.impactTemplate,
              recommendation: rule.recommendationTemplate,
              values
            };
            alerts.push(alert);

            if (debug) {
              console.log(`[generateDeterministicAlerts] ✅ Alert triggered: ${rule.id} (${rule.severity})`);
            }
          }
        } catch (e: any) {
          // Rule evaluation failed - skip silently (data may be missing)
          if (debug) {
            console.log(`[generateDeterministicAlerts] ⚠️ Rule ${rule.id} skipped:`, e.message);
          }
        }
      }

      // 5. Sort alerts by severity (critical first, then warning, then info)
      const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
      alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      // 6. Generate pointsVigilance for backward compatibility
      // Format: "Titre: Message" pour critical et warning uniquement
      const pointsVigilance = alerts
        .filter(a => a.severity !== 'info')
        .slice(0, 5) // Max 5 points de vigilance
        .map(a => `${a.title}\n${a.message}\n\nRecommandation : ${a.recommendation}`);

      // 7. Calculate summary
      const categoryCounts: Record<AlertCategory, number> = {
        rentabilite: 0,
        endettement: 0,
        croissance: 0,
        tresorerie: 0,
        valorisation: 0,
        immobilier: 0,
        donnees: 0
      };

      for (const alert of alerts) {
        categoryCounts[alert.category]++;
      }

      const summary = {
        totalAlerts: alerts.length,
        criticalCount: alerts.filter(a => a.severity === 'critical').length,
        warningCount: alerts.filter(a => a.severity === 'warning').length,
        infoCount: alerts.filter(a => a.severity === 'info').length,
        categoryCounts
      };

      if (debug) {
        console.log('[generateDeterministicAlerts] Summary:', summary);
      }

      // 8. Inject into state for HTML report
      if (toolContext?.state) {
        toolContext.state.set('deterministicAlerts', alerts);
      }

      return {
        alerts,
        summary,
        pointsVigilance
      };

    } catch (error: any) {
      console.error('[generateDeterministicAlerts] ❌ Error:', error.message);
      return {
        alerts: [],
        summary: {
          totalAlerts: 0,
          criticalCount: 0,
          warningCount: 0,
          infoCount: 0,
          categoryCounts: {}
        },
        pointsVigilance: [],
        error: error.message || 'Deterministic alert generation failed'
      };
    }
  }
});

/**
 * Parse state (handle JSON string)
 */
function parseState(state: any): any {
  if (!state) return null;
  if (typeof state === 'string') {
    try {
      return JSON.parse(state);
    } catch {
      return null;
    }
  }
  return state;
}

export default generateDeterministicAlertsTool;

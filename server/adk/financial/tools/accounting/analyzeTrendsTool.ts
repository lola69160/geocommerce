import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';

/**
 * Analyze Trends Tool
 *
 * Analyse l'évolution des indicateurs clés sur la période couverte.
 * Calcule les taux de croissance et détermine la tendance globale.
 *
 * Indicateurs analysés:
 * - Chiffre d'affaires
 * - Excédent Brut d'Exploitation (EBE)
 * - Résultat net
 */

const AnalyzeTrendsInputSchema = z.object({
  debug: z.boolean().optional().describe('Mode debug pour logs détaillés')
});

const AnalyzeTrendsOutputSchema = z.object({
  evolution: z.object({
    ca_evolution_pct: z.number().describe('Variation CA entre première et dernière année'),
    ebe_evolution_pct: z.number().describe('Variation EBE entre première et dernière année'),
    rn_evolution_pct: z.number().describe('Variation RN entre première et dernière année'),
    tendance: z.enum(['croissance', 'stable', 'declin']).describe('Tendance globale'),
    commentaire: z.string().describe('Commentaire sur l\'évolution')
  }),
  yearlyGrowth: z.array(z.object({
    yearFrom: z.number(),
    yearTo: z.number(),
    ca_growth_pct: z.number(),
    ebe_growth_pct: z.number(),
    rn_growth_pct: z.number()
  })).optional(),
  error: z.string().optional()
});

export const analyzeTrendsTool = new FunctionTool({
  name: 'analyzeTrends',
  description: 'Analyse l\'évolution des indicateurs financiers (CA, EBE, RN) sur la période. Retourne { evolution: { ca_evolution_pct, tendance, ... } }',
  parameters: zToGen(AnalyzeTrendsInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    try {
      // Lire comptable depuis state
      let comptable = toolContext?.state.get('comptable') as any;

      // Parser JSON string si nécessaire
      if (typeof comptable === 'string') {
        try {
          comptable = JSON.parse(comptable);
        } catch (e) {
          return {
            evolution: {
              ca_evolution_pct: 0,
              ebe_evolution_pct: 0,
              rn_evolution_pct: 0,
              tendance: 'stable' as const,
              commentaire: 'Erreur de parsing des données'
            },
            error: 'Failed to parse comptable state (invalid JSON)'
          };
        }
      }

      if (!comptable?.sig || Object.keys(comptable.sig).length === 0) {
        return {
          evolution: {
            ca_evolution_pct: 0,
            ebe_evolution_pct: 0,
            rn_evolution_pct: 0,
            tendance: 'stable' as const,
            commentaire: 'Aucune donnée SIG disponible'
          },
          error: 'No SIG data found - run calculateSig first'
        };
      }

      const years = Object.keys(comptable.sig).map(y => parseInt(y)).sort((a, b) => a - b); // Tri ascendant

      if (years.length < 2) {
        // Pas assez d'années pour calculer une évolution
        const year = years[0];
        const sig = comptable.sig[year.toString()];

        return {
          evolution: {
            ca_evolution_pct: 0,
            ebe_evolution_pct: 0,
            rn_evolution_pct: 0,
            tendance: 'stable' as const,
            commentaire: `Une seule année disponible (${year}). Impossible de calculer l'évolution.`
          }
        };
      }

      // Calculer l'évolution entre première et dernière année
      const firstYear = years[0];
      const lastYear = years[years.length - 1];

      const firstSig = comptable.sig[firstYear.toString()];
      const lastSig = comptable.sig[lastYear.toString()];

      const ca_evolution_pct = calculateGrowthRate(firstSig.chiffre_affaires, lastSig.chiffre_affaires);
      const ebe_evolution_pct = calculateGrowthRate(firstSig.ebe, lastSig.ebe);
      const rn_evolution_pct = calculateGrowthRate(firstSig.resultat_net, lastSig.resultat_net);

      // Déterminer la tendance globale (pondération: CA 40%, EBE 30%, RN 30%)
      const tendanceScore = (ca_evolution_pct * 0.4) + (ebe_evolution_pct * 0.3) + (rn_evolution_pct * 0.3);

      let tendance: 'croissance' | 'stable' | 'declin';
      if (tendanceScore > 5) {
        tendance = 'croissance';
      } else if (tendanceScore < -5) {
        tendance = 'declin';
      } else {
        tendance = 'stable';
      }

      // Générer commentaire
      const periode = `${firstYear}-${lastYear}`;
      let commentaire = '';

      if (tendance === 'croissance') {
        commentaire = `Croissance soutenue sur ${periode} : CA ${formatPct(ca_evolution_pct)}, EBE ${formatPct(ebe_evolution_pct)}, RN ${formatPct(rn_evolution_pct)}.`;
      } else if (tendance === 'declin') {
        commentaire = `Déclin sur ${periode} : CA ${formatPct(ca_evolution_pct)}, EBE ${formatPct(ebe_evolution_pct)}, RN ${formatPct(rn_evolution_pct)}.`;
      } else {
        commentaire = `Activité stable sur ${periode} : CA ${formatPct(ca_evolution_pct)}, EBE ${formatPct(ebe_evolution_pct)}, RN ${formatPct(rn_evolution_pct)}.`;
      }

      // Calculer croissance année par année (optionnel)
      const yearlyGrowth = [];
      for (let i = 0; i < years.length - 1; i++) {
        const yearFrom = years[i];
        const yearTo = years[i + 1];

        const sigFrom = comptable.sig[yearFrom.toString()];
        const sigTo = comptable.sig[yearTo.toString()];

        yearlyGrowth.push({
          yearFrom,
          yearTo,
          ca_growth_pct: calculateGrowthRate(sigFrom.chiffre_affaires, sigTo.chiffre_affaires),
          ebe_growth_pct: calculateGrowthRate(sigFrom.ebe, sigTo.ebe),
          rn_growth_pct: calculateGrowthRate(sigFrom.resultat_net, sigTo.resultat_net)
        });
      }

      return {
        evolution: {
          ca_evolution_pct: Math.round(ca_evolution_pct * 10) / 10,
          ebe_evolution_pct: Math.round(ebe_evolution_pct * 10) / 10,
          rn_evolution_pct: Math.round(rn_evolution_pct * 10) / 10,
          tendance,
          commentaire
        },
        yearlyGrowth
      };

    } catch (error: any) {
      return {
        evolution: {
          ca_evolution_pct: 0,
          ebe_evolution_pct: 0,
          rn_evolution_pct: 0,
          tendance: 'stable' as const,
          commentaire: 'Erreur lors de l\'analyse'
        },
        error: error.message || 'Trends analysis failed'
      };
    }
  }
});

/**
 * Calcule le taux de croissance entre deux valeurs (en pourcentage)
 */
function calculateGrowthRate(oldValue: number, newValue: number): number {
  if (oldValue === 0) {
    return newValue > 0 ? 100 : 0;
  }

  return ((newValue - oldValue) / Math.abs(oldValue)) * 100;
}

/**
 * Formate un pourcentage avec signe (ex: "+12.5%" ou "-3.2%")
 */
function formatPct(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${Math.round(value * 10) / 10}%`;
}

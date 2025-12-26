import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';
import { findSectorBenchmark, DEFAULT_BENCHMARK } from '../../config/sectorBenchmarks';

/**
 * Compare to Sector Tool
 *
 * Compare les ratios de l'entreprise avec les moyennes sectorielles.
 * Utilise le code NAF pour identifier le secteur d'activité.
 *
 * Pour chaque ratio, détermine si l'entreprise est:
 * - "superieur" : Au-dessus de la moyenne sectorielle (+10% ou plus)
 * - "conforme" : Dans la moyenne (+/- 10%)
 * - "inferieur" : En-dessous de la moyenne (-10% ou plus)
 */

const CompareToSectorInputSchema = z.object({
  nafCode: z.string().optional().describe('Code NAF de l\'entreprise (ex: 47.11F)')
});

const CompareToSectorOutputSchema = z.object({
  benchmark: z.object({
    nafCode: z.string(),
    sector: z.string(),
    comparisons: z.array(z.object({
      ratio: z.string(),
      value: z.number(),
      sectorAverage: z.number(),
      position: z.enum(['superieur', 'conforme', 'inferieur']),
      deviation_pct: z.number().describe('Écart par rapport à la moyenne (en %)')
    }))
  }),
  error: z.string().optional()
});

export const compareToSectorTool = new FunctionTool({
  name: 'compareToSector',
  description: 'Compare les ratios de l\'entreprise avec les moyennes sectorielles. Retourne { benchmark: { nafCode, sector, comparisons: [...] } }',
  parameters: zToGen(CompareToSectorInputSchema),

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
            benchmark: {
              nafCode: '',
              sector: '',
              comparisons: []
            },
            error: 'Failed to parse comptable state (invalid JSON)'
          };
        }
      }

      if (!comptable?.ratios) {
        return {
          benchmark: {
            nafCode: '',
            sector: '',
            comparisons: []
          },
          error: 'No ratios found in state.comptable - run calculateRatios first'
        };
      }

      // Récupérer le code NAF
      let nafCode = params.nafCode;

      // Si pas fourni en paramètre, essayer de lire depuis businessInfo
      if (!nafCode) {
        let businessInfo = toolContext?.state.get('businessInfo') as any;

        if (typeof businessInfo === 'string') {
          try {
            businessInfo = JSON.parse(businessInfo);
          } catch (e) {
            businessInfo = null;
          }
        }

        nafCode = businessInfo?.nafCode || '';
      }

      // Trouver le benchmark sectoriel
      const sectorBenchmark = findSectorBenchmark(nafCode) || DEFAULT_BENCHMARK;

      const { ratios } = comptable;

      // Comparer chaque ratio
      const comparisons = [];

      // Marge brute
      comparisons.push(
        compareRatio(
          'Marge brute',
          ratios.marge_brute_pct,
          sectorBenchmark.ratios.marge_brute_pct
        )
      );

      // Marge EBE
      comparisons.push(
        compareRatio(
          'Marge EBE',
          ratios.marge_ebe_pct,
          sectorBenchmark.ratios.marge_ebe_pct
        )
      );

      // Marge nette
      comparisons.push(
        compareRatio(
          'Marge nette',
          ratios.marge_nette_pct,
          sectorBenchmark.ratios.marge_nette_pct
        )
      );

      // Taux de valeur ajoutée
      comparisons.push(
        compareRatio(
          'Taux de VA',
          ratios.taux_va_pct,
          sectorBenchmark.ratios.taux_va_pct
        )
      );

      // Rotation stocks (si applicable)
      if (ratios.rotation_stocks_jours > 0) {
        comparisons.push(
          compareRatio(
            'Rotation stocks (jours)',
            ratios.rotation_stocks_jours,
            sectorBenchmark.ratios.rotation_stocks_jours,
            true // Inverse: moins de jours = meilleur
          )
        );
      }

      // Délai clients (si applicable)
      if (ratios.delai_clients_jours > 0) {
        comparisons.push(
          compareRatio(
            'Délai clients (jours)',
            ratios.delai_clients_jours,
            sectorBenchmark.ratios.delai_clients_jours,
            true // Inverse: moins de jours = meilleur
          )
        );
      }

      // Délai fournisseurs (si applicable)
      if (ratios.delai_fournisseurs_jours > 0) {
        comparisons.push(
          compareRatio(
            'Délai fournisseurs (jours)',
            ratios.delai_fournisseurs_jours,
            sectorBenchmark.ratios.delai_fournisseurs_jours,
            false // Plus de jours = meilleur (trésorerie)
          )
        );
      }

      // BFR
      comparisons.push(
        compareRatio(
          'BFR (jours de CA)',
          ratios.bfr_jours_ca,
          sectorBenchmark.ratios.bfr_jours_ca,
          true // Inverse: moins de BFR = meilleur
        )
      );

      // Taux d'endettement
      comparisons.push(
        compareRatio(
          'Taux d\'endettement',
          ratios.taux_endettement_pct,
          sectorBenchmark.ratios.taux_endettement_pct,
          true // Inverse: moins d'endettement = meilleur
        )
      );

      return {
        benchmark: {
          nafCode: sectorBenchmark.nafCode,
          sector: sectorBenchmark.sector,
          comparisons
        }
      };

    } catch (error: any) {
      return {
        benchmark: {
          nafCode: '',
          sector: '',
          comparisons: []
        },
        error: error.message || 'Sector comparison failed'
      };
    }
  }
});

/**
 * Compare un ratio avec sa moyenne sectorielle.
 *
 * @param name Nom du ratio
 * @param value Valeur de l'entreprise
 * @param sectorAverage Moyenne sectorielle
 * @param inverse Si true, une valeur plus basse est meilleure (ex: délais, stocks)
 */
function compareRatio(
  name: string,
  value: number,
  sectorAverage: number,
  inverse: boolean = false
): {
  ratio: string;
  value: number;
  sectorAverage: number;
  position: 'superieur' | 'conforme' | 'inferieur';
  deviation_pct: number;
} {
  // Calculer l'écart en pourcentage
  const deviation_pct = sectorAverage !== 0
    ? ((value - sectorAverage) / Math.abs(sectorAverage)) * 100
    : 0;

  // Déterminer la position (seuil de +/- 10%)
  let position: 'superieur' | 'conforme' | 'inferieur';

  if (inverse) {
    // Pour ratios inversés (moins = mieux)
    if (deviation_pct < -10) {
      position = 'superieur'; // Bien en-dessous de la moyenne
    } else if (deviation_pct > 10) {
      position = 'inferieur'; // Trop au-dessus de la moyenne
    } else {
      position = 'conforme';
    }
  } else {
    // Pour ratios normaux (plus = mieux)
    if (deviation_pct > 10) {
      position = 'superieur';
    } else if (deviation_pct < -10) {
      position = 'inferieur';
    } else {
      position = 'conforme';
    }
  }

  return {
    ratio: name,
    value: Math.round(value * 10) / 10,
    sectorAverage: Math.round(sectorAverage * 10) / 10,
    position,
    deviation_pct: Math.round(deviation_pct * 10) / 10
  };
}

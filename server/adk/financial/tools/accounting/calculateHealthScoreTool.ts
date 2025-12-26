import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';

/**
 * Calculate Health Score Tool
 *
 * Calcule un score de santé financière global (0-100) basé sur 4 dimensions:
 * 1. Rentabilité (30%) - Marges, résultat net
 * 2. Liquidité (25%) - BFR, délais, trésorerie
 * 3. Solvabilité (25%) - Endettement, capitaux propres
 * 4. Activité (20%) - Tendance CA, croissance
 *
 * Scoring:
 * - 80-100 : Excellente santé financière
 * - 60-79 : Bonne santé financière
 * - 40-59 : Santé financière moyenne, vigilance
 * - 20-39 : Santé financière fragile, risques
 * - 0-19 : Situation critique
 */

const CalculateHealthScoreInputSchema = z.object({
  debug: z.boolean().optional().describe('Mode debug pour logs détaillés')
});

const CalculateHealthScoreOutputSchema = z.object({
  healthScore: z.object({
    overall: z.number().min(0).max(100).describe('Score global de santé financière'),
    breakdown: z.object({
      rentabilite: z.number().min(0).max(100),
      liquidite: z.number().min(0).max(100),
      solvabilite: z.number().min(0).max(100),
      activite: z.number().min(0).max(100)
    }),
    interpretation: z.string().describe('Interprétation du score')
  }),
  error: z.string().optional()
});

export const calculateHealthScoreTool = new FunctionTool({
  name: 'calculateHealthScore',
  description: 'Calcule le score de santé financière global (0-100) basé sur rentabilité, liquidité, solvabilité et activité. Retourne { healthScore: { overall, breakdown, interpretation } }',
  parameters: zToGen(CalculateHealthScoreInputSchema),

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
            healthScore: {
              overall: 0,
              breakdown: {
                rentabilite: 0,
                liquidite: 0,
                solvabilite: 0,
                activite: 0
              },
              interpretation: 'Erreur de parsing des données'
            },
            error: 'Failed to parse comptable state (invalid JSON)'
          };
        }
      }

      if (!comptable?.ratios || !comptable?.evolution) {
        return {
          healthScore: {
            overall: 0,
            breakdown: {
              rentabilite: 0,
              liquidite: 0,
              solvabilite: 0,
              activite: 0
            },
            interpretation: 'Données insuffisantes pour calculer le score'
          },
          error: 'Missing ratios or evolution data in state.comptable'
        };
      }

      const { ratios, evolution } = comptable;

      // 1. RENTABILITÉ (30%)
      const scoreRentabilite = calculateRentabiliteScore(ratios);

      // 2. LIQUIDITÉ (25%)
      const scoreLiquidite = calculateLiquiditeScore(ratios);

      // 3. SOLVABILITÉ (25%)
      const scoreSolvabilite = calculateSolvabiliteScore(ratios);

      // 4. ACTIVITÉ (20%)
      const scoreActivite = calculateActiviteScore(evolution);

      // SCORE GLOBAL (pondéré)
      const overall = Math.round(
        scoreRentabilite * 0.30 +
        scoreLiquidite * 0.25 +
        scoreSolvabilite * 0.25 +
        scoreActivite * 0.20
      );

      // Interprétation
      let interpretation = '';

      if (overall >= 80) {
        interpretation = 'Excellente santé financière. L\'entreprise présente de solides performances et une structure financière robuste.';
      } else if (overall >= 60) {
        interpretation = 'Bonne santé financière. L\'entreprise est performante avec quelques points d\'amélioration possibles.';
      } else if (overall >= 40) {
        interpretation = 'Santé financière moyenne. Vigilance requise sur certains indicateurs. Amélioration possible.';
      } else if (overall >= 20) {
        interpretation = 'Santé financière fragile. Risques identifiés nécessitant une attention particulière.';
      } else {
        interpretation = 'Situation financière critique. Risques majeurs identifiés. Action immédiate recommandée.';
      }

      return {
        healthScore: {
          overall,
          breakdown: {
            rentabilite: Math.round(scoreRentabilite),
            liquidite: Math.round(scoreLiquidite),
            solvabilite: Math.round(scoreSolvabilite),
            activite: Math.round(scoreActivite)
          },
          interpretation
        }
      };

    } catch (error: any) {
      return {
        healthScore: {
          overall: 0,
          breakdown: {
            rentabilite: 0,
            liquidite: 0,
            solvabilite: 0,
            activite: 0
          },
          interpretation: 'Erreur lors du calcul'
        },
        error: error.message || 'Health score calculation failed'
      };
    }
  }
});

/**
 * Calcule le score de rentabilité (0-100)
 * Basé sur: marge EBE, marge nette, marge brute
 */
function calculateRentabiliteScore(ratios: any): number {
  let score = 0;

  // Marge EBE (40 points max)
  if (ratios.marge_ebe_pct >= 15) {
    score += 40;
  } else if (ratios.marge_ebe_pct >= 10) {
    score += 30;
  } else if (ratios.marge_ebe_pct >= 5) {
    score += 20;
  } else if (ratios.marge_ebe_pct >= 0) {
    score += 10;
  }

  // Marge nette (40 points max)
  if (ratios.marge_nette_pct >= 8) {
    score += 40;
  } else if (ratios.marge_nette_pct >= 5) {
    score += 30;
  } else if (ratios.marge_nette_pct >= 2) {
    score += 20;
  } else if (ratios.marge_nette_pct >= 0) {
    score += 10;
  }

  // Marge brute (20 points max)
  if (ratios.marge_brute_pct >= 50) {
    score += 20;
  } else if (ratios.marge_brute_pct >= 30) {
    score += 15;
  } else if (ratios.marge_brute_pct >= 15) {
    score += 10;
  } else if (ratios.marge_brute_pct >= 0) {
    score += 5;
  }

  return Math.min(score, 100);
}

/**
 * Calcule le score de liquidité (0-100)
 * Basé sur: BFR, délais clients/fournisseurs, rotation stocks
 */
function calculateLiquiditeScore(ratios: any): number {
  let score = 50; // Base neutre

  // BFR (30 points)
  if (ratios.bfr_jours_ca < 0) {
    score += 30; // BFR négatif = excellent (crédit fournisseurs)
  } else if (ratios.bfr_jours_ca < 30) {
    score += 20;
  } else if (ratios.bfr_jours_ca < 60) {
    score += 10;
  } else {
    score -= 10; // BFR élevé = pénalité
  }

  // Délai clients (20 points)
  if (ratios.delai_clients_jours > 0) {
    if (ratios.delai_clients_jours <= 30) {
      score += 20;
    } else if (ratios.delai_clients_jours <= 60) {
      score += 10;
    } else {
      score -= 10;
    }
  }

  // Délai fournisseurs (20 points)
  if (ratios.delai_fournisseurs_jours > 0) {
    if (ratios.delai_fournisseurs_jours >= 60) {
      score += 20; // Long délai = bon pour trésorerie
    } else if (ratios.delai_fournisseurs_jours >= 45) {
      score += 15;
    } else if (ratios.delai_fournisseurs_jours >= 30) {
      score += 10;
    }
  }

  // Rotation stocks (10 points)
  if (ratios.rotation_stocks_jours > 0) {
    if (ratios.rotation_stocks_jours <= 30) {
      score += 10;
    } else if (ratios.rotation_stocks_jours <= 60) {
      score += 5;
    }
  }

  return Math.max(0, Math.min(score, 100));
}

/**
 * Calcule le score de solvabilité (0-100)
 * Basé sur: taux d'endettement, capacité d'autofinancement
 */
function calculateSolvabiliteScore(ratios: any): number {
  let score = 50; // Base neutre

  // Taux d'endettement (60 points)
  if (ratios.taux_endettement_pct <= 50) {
    score += 40;
  } else if (ratios.taux_endettement_pct <= 100) {
    score += 30;
  } else if (ratios.taux_endettement_pct <= 150) {
    score += 15;
  } else if (ratios.taux_endettement_pct <= 200) {
    score += 5;
  } else {
    score -= 20; // Endettement excessif
  }

  // Capacité d'autofinancement (40 points)
  if (ratios.capacite_autofinancement > 50000) {
    score += 40;
  } else if (ratios.capacite_autofinancement > 20000) {
    score += 30;
  } else if (ratios.capacite_autofinancement > 0) {
    score += 15;
  } else {
    score -= 10; // CAF négative
  }

  return Math.max(0, Math.min(score, 100));
}

/**
 * Calcule le score d'activité (0-100)
 * Basé sur: tendance et évolution du CA
 */
function calculateActiviteScore(evolution: any): number {
  let score = 50; // Base neutre

  // Tendance globale (40 points)
  if (evolution.tendance === 'croissance') {
    score += 40;
  } else if (evolution.tendance === 'stable') {
    score += 20;
  } else {
    score -= 20;
  }

  // Évolution CA (30 points)
  if (evolution.ca_evolution_pct > 20) {
    score += 30;
  } else if (evolution.ca_evolution_pct > 10) {
    score += 20;
  } else if (evolution.ca_evolution_pct > 5) {
    score += 15;
  } else if (evolution.ca_evolution_pct > 0) {
    score += 10;
  } else if (evolution.ca_evolution_pct < -10) {
    score -= 20;
  }

  // Évolution EBE (30 points)
  if (evolution.ebe_evolution_pct > 20) {
    score += 30;
  } else if (evolution.ebe_evolution_pct > 10) {
    score += 20;
  } else if (evolution.ebe_evolution_pct > 0) {
    score += 10;
  } else if (evolution.ebe_evolution_pct < -10) {
    score -= 20;
  }

  return Math.max(0, Math.min(score, 100));
}

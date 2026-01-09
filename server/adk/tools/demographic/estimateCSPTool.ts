import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import { zToGen } from '../../utils/schemaHelper.js';

/**
 * Estimate CSP Tool
 *
 * Estime le profil CSP (Catégories Socio-Professionnelles) d'une zone
 * basé sur la densité de population et la taille de la commune
 */

const EstimateCSPInputSchema = z.object({
  density: z.number().describe('Densité de population (hab/km²)'),
  population: z.number().describe('Population totale de la commune')
});

export const estimateCSPTool = new FunctionTool({
  name: 'estimateCSP',
  description: 'Estime le profil CSP (Catégories Socio-Professionnelles) basé sur densité et population. Retourne { dominant: "high"|"middle"|"low", high_percentage, middle_percentage, low_percentage }',
  parameters: zToGen(EstimateCSPInputSchema),

  execute: async ({ density, population }: z.infer<typeof EstimateCSPInputSchema>) => {
    // Règles d'estimation simplifiées
    // Note: En production, utiliser API INSEE pour données réelles

    let high_percentage = 0;
    let middle_percentage = 0;
    let low_percentage = 0;

    // Densité très élevée (>5000 hab/km²) = zones urbaines denses
    if (density > 5000) {
      // Grandes villes = mixte avec tendance CSP+
      if (population > 100000) {
        high_percentage = 40;
        middle_percentage = 45;
        low_percentage = 15;
      } else {
        high_percentage = 35;
        middle_percentage = 50;
        low_percentage = 15;
      }
    }
    // Densité élevée (2000-5000 hab/km²) = zones urbaines
    else if (density > 2000) {
      if (population > 50000) {
        high_percentage = 35;
        middle_percentage = 50;
        low_percentage = 15;
      } else {
        high_percentage = 30;
        middle_percentage = 55;
        low_percentage = 15;
      }
    }
    // Densité moyenne (500-2000 hab/km²) = zones péri-urbaines
    else if (density > 500) {
      high_percentage = 25;
      middle_percentage = 60;
      low_percentage = 15;
    }
    // Densité faible (100-500 hab/km²) = zones rurales
    else if (density > 100) {
      high_percentage = 15;
      middle_percentage = 60;
      low_percentage = 25;
    }
    // Très faible densité (<100 hab/km²) = zones rurales isolées
    else {
      high_percentage = 10;
      middle_percentage = 50;
      low_percentage = 40;
    }

    // Déterminer dominant
    let dominant: 'high' | 'middle' | 'low';
    if (high_percentage >= middle_percentage && high_percentage >= low_percentage) {
      dominant = 'high';
    } else if (middle_percentage >= low_percentage) {
      dominant = 'middle';
    } else {
      dominant = 'low';
    }

    return {
      dominant,
      high_percentage,
      middle_percentage,
      low_percentage,
      median_income_estimate: calculateMedianIncome(density, dominant)
    };
  }
});

/**
 * Calculate Median Income Estimate
 *
 * Estime le revenu médian annuel basé sur la densité de population et le profil CSP dominant.
 * Utilisé pour la matrice Densité × Revenu dans le calcul du Location Score.
 *
 * @param density - Densité de population (hab/km²)
 * @param dominant - Profil CSP dominant ('high' | 'middle' | 'low')
 * @returns Revenu médian estimé en euros/an
 */
function calculateMedianIncome(density: number, dominant: 'high' | 'middle' | 'low'): number {
  // Estimation basée sur densité + profil CSP
  if (dominant === 'high') {
    if (density < 500) {
      // Faible densité + CSP élevé = résidentiel premium (zones péri-urbaines riches)
      // Exemple: Limonest, Saint-Didier-au-Mont-d'Or
      return 35000;
    }
    // Urbain dense + CSP élevé = centres-villes, arrondissements premium
    // Exemple: Lyon 6ème, Paris 7ème
    return 45000;
  } else if (dominant === 'middle') {
    // CSP moyen = zones résidentielles standard
    return 28000;
  } else {
    // CSP faible = zones rurales isolées ou quartiers défavorisés
    return 22000;
  }
}

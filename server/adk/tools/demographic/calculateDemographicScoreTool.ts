import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../utils/schemaHelper.js';
import type { BusinessInput } from '../../schemas';

/**
 * Calculate Demographic Score Tool
 *
 * Calcule un score d'adéquation démographique (0-100) basé sur :
 * - Densité urbaine vs profil cible activité
 * - Taille de population
 * - Adéquation CSP avec activité
 */

const CalculateDemographicScoreInputSchema = z.object({
  urbanLevel: z.enum(['rural', 'low', 'medium', 'high', 'very_high']).describe('Niveau d\'urbanisation'),
  population: z.number().describe('Population de la commune'),
  cspProfile: z.object({
    dominant: z.enum(['high', 'middle', 'low']),
    high_percentage: z.number(),
    middle_percentage: z.number(),
    low_percentage: z.number()
  }).describe('Profil CSP estimé')
  // nafCode lu depuis state.business.activite_principale via ToolContext
});

export const calculateDemographicScoreTool = new FunctionTool({
  name: 'calculateDemographicScore',
  description: 'Calcule un score d\'adéquation démographique (0-100) selon l\'activité. Lit nafCode depuis state.business.activite_principale. Retourne { overall, density_match, population_size, csp_adequacy }',
  parameters: zToGen(CalculateDemographicScoreInputSchema),

  execute: async ({
    urbanLevel,
    population,
    cspProfile
  }: z.infer<typeof CalculateDemographicScoreInputSchema>, toolContext?: ToolContext) => {

    // Lire business depuis state pour obtenir le code NAF
    const business = toolContext?.state.get('business') as BusinessInput | undefined;
    const nafCode = business?.activite_principale || business?.code_naf;

    // Profils cibles par type d'activité (simplifié)
    const activityProfiles: Record<string, {
      targetDensity: string[];
      targetCSP: string[];
      minPopulation: number;
    }> = {
      // Restauration/Café
      '5610A': { targetDensity: ['high', 'very_high'], targetCSP: ['middle', 'high'], minPopulation: 5000 },
      '5610C': { targetDensity: ['medium', 'high'], targetCSP: ['middle'], minPopulation: 3000 },

      // Commerce alimentaire
      '4724Z': { targetDensity: ['medium', 'high'], targetCSP: ['middle'], minPopulation: 2000 }, // Boulangerie
      '4711D': { targetDensity: ['high', 'very_high'], targetCSP: ['middle', 'high'], minPopulation: 10000 }, // Supermarché

      // Commerce spécialisé
      '4771Z': { targetDensity: ['high', 'very_high'], targetCSP: ['middle', 'high'], minPopulation: 15000 }, // Vêtements
      '4773Z': { targetDensity: ['medium', 'high'], targetCSP: ['middle'], minPopulation: 3000 }, // Pharmacie

      // Services
      '9602A': { targetDensity: ['medium', 'high'], targetCSP: ['middle'], minPopulation: 3000 }, // Coiffure
      '9602B': { targetDensity: ['high'], targetCSP: ['middle', 'high'], minPopulation: 5000 } // Beauté
    };

    const profile = nafCode && activityProfiles[nafCode]
      ? activityProfiles[nafCode]
      : { targetDensity: ['medium'], targetCSP: ['middle'], minPopulation: 3000 }; // Default

    // 1. Score densité (0-100)
    let densityMatch = 0;
    if (profile.targetDensity.includes(urbanLevel)) {
      densityMatch = 100;
    } else {
      // Pénalité selon écart
      const densityOrder = ['rural', 'low', 'medium', 'high', 'very_high'];
      const currentIndex = densityOrder.indexOf(urbanLevel);
      const targetIndices = profile.targetDensity.map(d => densityOrder.indexOf(d));
      const minDistance = Math.min(...targetIndices.map(t => Math.abs(currentIndex - t)));
      densityMatch = Math.max(0, 100 - (minDistance * 30));
    }

    // 2. Score taille population (0-100)
    let populationSize = 0;
    if (population >= profile.minPopulation * 2) {
      populationSize = 100;
    } else if (population >= profile.minPopulation) {
      populationSize = 70 + ((population - profile.minPopulation) / profile.minPopulation) * 30;
    } else if (population >= profile.minPopulation * 0.5) {
      populationSize = 40 + ((population - profile.minPopulation * 0.5) / (profile.minPopulation * 0.5)) * 30;
    } else {
      populationSize = Math.min(40, (population / (profile.minPopulation * 0.5)) * 40);
    }

    // 3. Score adéquation CSP (0-100)
    let cspAdequacy = 0;
    if (profile.targetCSP.includes(cspProfile.dominant)) {
      // CSP dominant correspond
      cspAdequacy = 100;
    } else {
      // Calculer score basé sur pourcentages
      const targetPercentage = profile.targetCSP.reduce((sum, csp) => {
        if (csp === 'high') return sum + cspProfile.high_percentage;
        if (csp === 'middle') return sum + cspProfile.middle_percentage;
        if (csp === 'low') return sum + cspProfile.low_percentage;
        return sum;
      }, 0);
      cspAdequacy = Math.min(100, targetPercentage * 1.5);
    }

    // Score global pondéré
    const overall = Math.round(
      densityMatch * 0.35 +
      populationSize * 0.35 +
      cspAdequacy * 0.30
    );

    return {
      overall,
      density_match: Math.round(densityMatch),
      population_size: Math.round(populationSize),
      csp_adequacy: Math.round(cspAdequacy)
    };
  }
});

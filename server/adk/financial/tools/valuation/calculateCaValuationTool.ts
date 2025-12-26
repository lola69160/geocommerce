import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';
import { findValuationCoefficients, DEFAULT_VALUATION_COEFFICIENTS } from '../../config/valuationCoefficients';

/**
 * Calculate CA Valuation Tool
 *
 * Valorise un fonds de commerce par la méthode du pourcentage de CA.
 * Méthode complémentaire utilisée pour vérifier la cohérence avec la méthode EBE.
 *
 * Formule: Valeur = CA moyen × Pourcentage sectoriel
 *
 * Note: Cette méthode est moins précise que le multiple d'EBE car elle ne tient pas
 * compte de la rentabilité. Deux commerces avec même CA mais marges différentes
 * auront des valorisations identiques, ce qui est un biais.
 */

const CalculateCaValuationInputSchema = z.object({
  nafCode: z.string().optional().describe('Code NAF de l\'entreprise (sera lu depuis state.businessInfo si non fourni)')
});

const CalculateCaValuationOutputSchema = z.object({
  methodeCA: z.object({
    ca_reference: z.number().describe('CA moyen sur 3 ans ou dernière année'),
    pourcentage_bas: z.number(),
    pourcentage_median: z.number(),
    pourcentage_haut: z.number(),
    valeur_basse: z.number(),
    valeur_mediane: z.number(),
    valeur_haute: z.number(),
    justification: z.string()
  }),
  error: z.string().optional()
});

export const calculateCaValuationTool = new FunctionTool({
  name: 'calculateCaValuation',
  description: 'Valorise le fonds de commerce par la méthode du pourcentage de CA (méthode complémentaire). Retourne fourchette basse/médiane/haute basée sur % sectoriels.',
  parameters: zToGen(CalculateCaValuationInputSchema),

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
            methodeCA: {
              ca_reference: 0,
              pourcentage_bas: 0,
              pourcentage_median: 0,
              pourcentage_haut: 0,
              valeur_basse: 0,
              valeur_mediane: 0,
              valeur_haute: 0,
              justification: 'Erreur parsing données comptables'
            },
            error: 'Failed to parse comptable state (invalid JSON)'
          };
        }
      }

      // Lire businessInfo depuis state
      let businessInfo = toolContext?.state.get('businessInfo') as any;

      if (typeof businessInfo === 'string') {
        try {
          businessInfo = JSON.parse(businessInfo);
        } catch (e) {
          // Pas critique, on continue
        }
      }

      if (!comptable?.sig) {
        return {
          methodeCA: {
            ca_reference: 0,
            pourcentage_bas: 0,
            pourcentage_median: 0,
            pourcentage_haut: 0,
            valeur_basse: 0,
            valeur_mediane: 0,
            valeur_haute: 0,
            justification: 'Données SIG manquantes'
          },
          error: 'Missing SIG data in state.comptable'
        };
      }

      const { sig, yearsAnalyzed } = comptable;

      // Calculer CA de référence (moyenne 3 dernières années ou dernière année)
      let caReference = 0;

      if (yearsAnalyzed.length >= 3) {
        // Moyenne des 3 dernières années
        const caValues = yearsAnalyzed.slice(0, 3).map((year: number) => {
          const yearStr = year.toString();
          return sig[yearStr]?.chiffre_affaires || 0;
        });
        caReference = Math.round(caValues.reduce((a: number, b: number) => a + b, 0) / caValues.length);
      } else if (yearsAnalyzed.length > 0) {
        // Dernière année disponible
        const lastYear = yearsAnalyzed[0].toString();
        caReference = sig[lastYear]?.chiffre_affaires || 0;
      }

      // Obtenir coefficients sectoriels
      const nafCode = params.nafCode || businessInfo?.nafCode || '';
      const coefficients = findValuationCoefficients(nafCode) || DEFAULT_VALUATION_COEFFICIENTS;

      // Calculer fourchette de valorisation
      const valeurBasse = Math.round(caReference * coefficients.caPercentage.bas / 100);
      const valeurMediane = Math.round(caReference * coefficients.caPercentage.median / 100);
      const valeurHaute = Math.round(caReference * coefficients.caPercentage.haut / 100);

      // Justification
      let justification = `Valorisation par pourcentage du CA (méthode complémentaire, moins précise que multiple EBE). `;
      justification += `CA de référence: ${caReference.toLocaleString('fr-FR')} € `;

      if (yearsAnalyzed.length >= 3) {
        justification += `(moyenne ${yearsAnalyzed.length} ans). `;
      } else {
        justification += `(dernière année disponible). `;
      }

      justification += `Pourcentages secteur "${coefficients.sector}": ${coefficients.caPercentage.bas}% à ${coefficients.caPercentage.haut}%. `;
      justification += `ATTENTION: Cette méthode ne tient pas compte de la rentabilité, à utiliser en complément du multiple EBE.`;

      return {
        methodeCA: {
          ca_reference: caReference,
          pourcentage_bas: coefficients.caPercentage.bas,
          pourcentage_median: coefficients.caPercentage.median,
          pourcentage_haut: coefficients.caPercentage.haut,
          valeur_basse: valeurBasse,
          valeur_mediane: valeurMediane,
          valeur_haute: valeurHaute,
          justification
        }
      };

    } catch (error: any) {
      return {
        methodeCA: {
          ca_reference: 0,
          pourcentage_bas: 0,
          pourcentage_median: 0,
          pourcentage_haut: 0,
          valeur_basse: 0,
          valeur_mediane: 0,
          valeur_haute: 0,
          justification: 'Erreur lors du calcul'
        },
        error: error.message || 'CA valuation calculation failed'
      };
    }
  }
});

import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';
import { findValuationCoefficients, DEFAULT_VALUATION_COEFFICIENTS, STANDARD_RETRAITEMENTS } from '../../config/valuationCoefficients';

/**
 * Calculate EBE Valuation Tool
 *
 * Valorise un fonds de commerce par la méthode du multiple d'EBE.
 * C'est la méthode la plus utilisée en France pour valoriser les petits commerces.
 *
 * Formule: Valeur = EBE retraité × Multiple sectoriel
 *
 * Retraitements courants:
 * - Ajouter salaire de gérant non rémunéré
 * - Ajuster loyer si différent du marché
 * - Retirer charges exceptionnelles non récurrentes
 */

const CalculateEbeValuationInputSchema = z.object({
  nafCode: z.string().optional().describe('Code NAF de l\'entreprise (sera lu depuis state.businessInfo si non fourni)'),
  retraitements_custom: z.array(z.object({
    description: z.string(),
    montant: z.number().describe('Montant positif si augmente EBE, négatif si diminue')
  })).optional().describe('Retraitements personnalisés en plus des retraitements standards')
});

const CalculateEbeValuationOutputSchema = z.object({
  methodeEBE: z.object({
    ebe_reference: z.number().describe('EBE de référence (moyenne 3 ans ou dernière année)'),
    ebe_retraite: z.number().describe('EBE après retraitements'),
    retraitements: z.array(z.object({
      description: z.string(),
      montant: z.number()
    })),
    coefficient_bas: z.number(),
    coefficient_median: z.number(),
    coefficient_haut: z.number(),
    valeur_basse: z.number(),
    valeur_mediane: z.number(),
    valeur_haute: z.number(),
    justification: z.string()
  }),
  error: z.string().optional()
});

export const calculateEbeValuationTool = new FunctionTool({
  name: 'calculateEbeValuation',
  description: 'Valorise le fonds de commerce par la méthode du multiple d\'EBE (la plus utilisée). Retourne fourchette basse/médiane/haute basée sur coefficients sectoriels.',
  parameters: zToGen(CalculateEbeValuationInputSchema),

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
            methodeEBE: {
              ebe_reference: 0,
              ebe_retraite: 0,
              retraitements: [],
              coefficient_bas: 0,
              coefficient_median: 0,
              coefficient_haut: 0,
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
          methodeEBE: {
            ebe_reference: 0,
            ebe_retraite: 0,
            retraitements: [],
            coefficient_bas: 0,
            coefficient_median: 0,
            coefficient_haut: 0,
            valeur_basse: 0,
            valeur_mediane: 0,
            valeur_haute: 0,
            justification: 'Données SIG manquantes'
          },
          error: 'Missing SIG data in state.comptable'
        };
      }

      const { sig, yearsAnalyzed, ebeRetraitement } = comptable;

      // ========================================
      // NOUVEAU: Utiliser l'EBE Normatif calculé par ComptableAgent
      // ========================================
      let ebeReference = 0;
      let ebeRetraite = 0;
      let retraitements: { description: string; montant: number }[] = [];

      if (ebeRetraitement && ebeRetraitement.ebe_normatif) {
        // PRIORITÉ 1: Utiliser l'EBE Normatif calculé par ComptableAgent (calculateEbeRetraitementTool)
        ebeReference = ebeRetraitement.ebe_comptable || 0;
        ebeRetraite = ebeRetraitement.ebe_normatif || 0;

        // Convertir les retraitements du format ComptableAgent vers le format ValorisationAgent
        if (ebeRetraitement.retraitements && Array.isArray(ebeRetraitement.retraitements)) {
          retraitements = ebeRetraitement.retraitements.map((r: any) => ({
            description: r.description || '',
            montant: r.montant || 0
          }));
        }

        console.log('[calculateEbeValuation] Using EBE Normatif from ComptableAgent:', {
          ebe_comptable: ebeReference,
          ebe_normatif: ebeRetraite,
          retraitements_count: retraitements.length
        });

      } else {
        // PRIORITÉ 2: Fallback - Calculer EBE de référence (ancienne méthode)
        console.log('[calculateEbeValuation] Fallback: EBE Normatif not found, calculating manually');

        if (yearsAnalyzed.length >= 3) {
          // Moyenne des 3 dernières années
          const ebeValues = yearsAnalyzed.slice(0, 3).map((year: number) => {
            const yearStr = year.toString();
            return sig[yearStr]?.ebe || 0;
          });
          ebeReference = Math.round(ebeValues.reduce((a: number, b: number) => a + b, 0) / ebeValues.length);
        } else if (yearsAnalyzed.length > 0) {
          // Dernière année disponible
          const lastYear = yearsAnalyzed[0].toString();
          ebeReference = sig[lastYear]?.ebe || 0;
        }

        // Retraitements standards (fallback)
        retraitements.push({
          description: 'Salaire de gérant non rémunéré (estimation)',
          montant: STANDARD_RETRAITEMENTS.SALAIRE_GERANT_ESTIMATION
        });

        // Retraitements personnalisés (si fournis)
        if (params.retraitements_custom && Array.isArray(params.retraitements_custom)) {
          retraitements.push(...params.retraitements_custom);
        }

        // Calculer EBE retraité
        const totalRetraitements = retraitements.reduce((sum, r) => sum + r.montant, 0);
        ebeRetraite = ebeReference + totalRetraitements;
      }

      // Obtenir coefficients sectoriels
      const nafCode = params.nafCode || businessInfo?.nafCode || '';
      const coefficients = findValuationCoefficients(nafCode) || DEFAULT_VALUATION_COEFFICIENTS;

      // Calculer fourchette de valorisation
      const valeurBasse = Math.round(ebeRetraite * coefficients.ebeMultiple.bas);
      const valeurMediane = Math.round(ebeRetraite * coefficients.ebeMultiple.median);
      const valeurHaute = Math.round(ebeRetraite * coefficients.ebeMultiple.haut);

      // Justification
      let justification = `Valorisation par multiple d'EBE (méthode la plus utilisée en France). `;
      justification += `EBE de référence: ${ebeReference.toLocaleString('fr-FR')} € `;

      if (yearsAnalyzed.length >= 3) {
        justification += `(moyenne ${yearsAnalyzed.length} ans). `;
      } else {
        justification += `(dernière année disponible). `;
      }

      justification += `Après retraitements: ${ebeRetraite.toLocaleString('fr-FR')} €. `;
      justification += `Coefficients secteur "${coefficients.sector}": ${coefficients.ebeMultiple.bas}x à ${coefficients.ebeMultiple.haut}x. `;

      if (coefficients.specificFactors && coefficients.specificFactors.length > 0) {
        justification += `Facteurs valorisants: ${coefficients.specificFactors.join(', ')}.`;
      }

      return {
        methodeEBE: {
          ebe_reference: ebeReference,
          ebe_retraite: ebeRetraite,
          retraitements,
          coefficient_bas: coefficients.ebeMultiple.bas,
          coefficient_median: coefficients.ebeMultiple.median,
          coefficient_haut: coefficients.ebeMultiple.haut,
          valeur_basse: valeurBasse,
          valeur_mediane: valeurMediane,
          valeur_haute: valeurHaute,
          justification
        }
      };

    } catch (error: any) {
      return {
        methodeEBE: {
          ebe_reference: 0,
          ebe_retraite: 0,
          retraitements: [],
          coefficient_bas: 0,
          coefficient_median: 0,
          coefficient_haut: 0,
          valeur_basse: 0,
          valeur_mediane: 0,
          valeur_haute: 0,
          justification: 'Erreur lors du calcul'
        },
        error: error.message || 'EBE valuation calculation failed'
      };
    }
  }
});

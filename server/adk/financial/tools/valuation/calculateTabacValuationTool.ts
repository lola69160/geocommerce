import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';
import {
  detectTabacType,
  DEFAULT_TABAC_COEFFICIENTS,
  TABAC_VALUATION_COEFFICIENTS
} from '../../config/tabacValuationCoefficients';

/**
 * Calculate Tabac Valuation Tool
 *
 * Valorise un fonds de commerce Tabac/Presse/FDJ par la MÉTHODE HYBRIDE.
 *
 * Cette méthode spécifique se base sur les COMMISSIONS NETTES (pas le CA total).
 *
 * Formule Hybride:
 * - Bloc 1 (Réglementé): Commissions Nettes × Coefficient (2.0-3.2)
 * - Bloc 2 (Commercial): CA Boutique × Pourcentage (12-25%)
 * - Valeur Totale = Bloc 1 + Bloc 2
 *
 * Cette méthode est plus précise que la méthode EBE classique pour les Tabacs.
 */

const CalculateTabacValuationInputSchema = z.object({
  // Données financières
  commissionsNettesAnnuelles: z.number().optional().describe('Commissions nettes annuelles (Tabac + Loto + Presse + FDJ) en €'),
  caActiviteBoutiqueAnnuel: z.number().optional().describe('CA annuel de l\'activité boutique (Souvenirs, Confiserie, Vape, etc.) en €'),

  // Détail des commissions (optionnel, pour analyse fine)
  detailCommissions: z.object({
    tabac: z.number().optional(),
    loto: z.number().optional(),
    presse: z.number().optional(),
    fdj_pmu: z.number().optional(),
    autres: z.number().optional()
  }).optional(),

  // Caractéristiques du commerce (pour détection automatique du type)
  localisation: z.object({
    population: z.number().optional().describe('Population de la commune'),
    zone: z.string().optional().describe('Type de zone: centre-ville, périphérie, rural, touristique'),
    tourisme: z.boolean().optional().describe('Zone touristique (true/false)'),
    proximite: z.string().optional().describe('Proximité: gare, autoroute, université, etc.')
  }).optional(),

  // Type de commerce (si détecté manuellement)
  typeCommerce: z.string().optional().describe('Type: tabac_urbain_premium, tabac_centre_ville, tabac_peripherie, tabac_rural, tabac_touristique, tabac_transit, tabac_etudiant'),

  // Prix affiché par le vendeur (optionnel, pour comparaison)
  prixAffiche: z.number().optional().describe('Prix demandé par le vendeur en €')
});

const CalculateTabacValuationOutputSchema = z.object({
  typeCommerce: z.string().describe('Type de commerce détecté'),
  descriptionType: z.string().describe('Description du type'),

  // Bloc 1: Activité Réglementée
  blocReglemente: z.object({
    commissionsNettes: z.number(),
    coefficientMin: z.number(),
    coefficientMedian: z.number(),
    coefficientMax: z.number(),
    valeurMin: z.number(),
    valeurMediane: z.number(),
    valeurMax: z.number(),
    detailCommissions: z.object({
      tabac: z.number().optional(),
      loto: z.number().optional(),
      presse: z.number().optional(),
      fdj_pmu: z.number().optional(),
      autres: z.number().optional()
    }).optional()
  }),

  // Bloc 2: Activité Commerciale
  blocCommercial: z.object({
    caActiviteBoutique: z.number(),
    pourcentageMin: z.number(),
    pourcentageMedian: z.number(),
    pourcentageMax: z.number(),
    valeurMin: z.number(),
    valeurMediane: z.number(),
    valeurMax: z.number()
  }),

  // Valorisation Totale
  valorisationTotale: z.object({
    fourchetteBasse: z.number(),
    valeurMediane: z.number(),
    fourchetteHaute: z.number()
  }),

  // Comparaison avec prix affiché
  comparaisonPrix: z.object({
    prixAffiche: z.number(),
    ecart: z.number(),
    ecartPourcentage: z.number(),
    appreciation: z.string().describe('sous-evalue, juste-prix, sur-evalue')
  }).optional(),

  // Arguments de négociation
  argumentsNegociation: z.object({
    pour_acheteur: z.array(z.string()),
    pour_vendeur: z.array(z.string())
  }),

  // Facteurs valorisants spécifiques au type
  facteursValorisants: z.array(z.string()),

  // Justification et explications
  justification: z.string(),
  error: z.string().optional()
});

export const calculateTabacValuationTool = new FunctionTool({
  name: 'calculateTabacValuation',
  description: 'Valorise un fonds de commerce Tabac/Presse/FDJ par la méthode HYBRIDE (Commissions × Coef + CA Boutique × %). Retourne fourchette basse/médiane/haute et arguments de négociation.',
  parameters: zToGen(CalculateTabacValuationInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    try {
      // Lire businessInfo depuis state (pour NAF code)
      let businessInfo = toolContext?.state.get('businessInfo') as any;
      if (typeof businessInfo === 'string') {
        try {
          businessInfo = JSON.parse(businessInfo);
        } catch (e) {
          // Pas critique
        }
      }

      // Lire comptable depuis state (pour CA, commissions si disponibles)
      let comptable = toolContext?.state.get('comptable') as any;
      if (typeof comptable === 'string') {
        try {
          comptable = JSON.parse(comptable);
        } catch (e) {
          // Pas critique
        }
      }

      // Lire documentExtraction depuis state (pour commissions si disponibles)
      let documentExtraction = toolContext?.state.get('documentExtraction') as any;
      if (typeof documentExtraction === 'string') {
        try {
          documentExtraction = JSON.parse(documentExtraction);
        } catch (e) {
          // Pas critique
        }
      }

      // ========================================
      // ÉTAPE 1: Déterminer le type de commerce
      // ========================================
      let typeBareme = DEFAULT_TABAC_COEFFICIENTS;

      if (params.typeCommerce) {
        // Type fourni manuellement
        const foundType = TABAC_VALUATION_COEFFICIENTS.find(c => c.type === params.typeCommerce);
        if (foundType) {
          typeBareme = foundType;
        }
      } else if (params.localisation) {
        // Détection automatique basée sur localisation
        typeBareme = detectTabacType(params.localisation);
      }

      console.log('[calculateTabacValuation] Type commerce détecté:', typeBareme.type);

      // ========================================
      // ÉTAPE 2: Récupérer les commissions nettes
      // ========================================
      let commissionsNettes = params.commissionsNettesAnnuelles || 0;
      let detailCommissions = params.detailCommissions;

      // ✅ FIX V3 (2025-12-29): Pas d'estimation - données extraites uniquement
      // Les commissions doivent provenir de:
      // 1. Paramètres explicites (commissionsNettesAnnuelles)
      // 2. Extraction depuis documents comptables (future implémentation)
      // Si absents → valeur = 0, le rapport affichera "Non disponible"
      if (commissionsNettes === 0) {
        console.warn('[calculateTabacValuation] ⚠️ Commissions nettes non fournies - aucune estimation');
      }

      if (commissionsNettes === 0) {
        return {
          typeCommerce: typeBareme.type,
          descriptionType: typeBareme.description,
          blocReglemente: {
            commissionsNettes: 0,
            coefficientMin: 0,
            coefficientMedian: 0,
            coefficientMax: 0,
            valeurMin: 0,
            valeurMediane: 0,
            valeurMax: 0
          },
          blocCommercial: {
            caActiviteBoutique: 0,
            pourcentageMin: 0,
            pourcentageMedian: 0,
            pourcentageMax: 0,
            valeurMin: 0,
            valeurMediane: 0,
            valeurMax: 0
          },
          valorisationTotale: {
            fourchetteBasse: 0,
            valeurMediane: 0,
            fourchetteHaute: 0
          },
          argumentsNegociation: {
            pour_acheteur: [],
            pour_vendeur: []
          },
          facteursValorisants: typeBareme.facteursValorisants || [],
          justification: 'Commissions nettes non fournies - impossible de valoriser',
          error: 'Commissions nettes manquantes'
        };
      }

      // ========================================
      // ÉTAPE 3: Calculer Bloc 1 (Réglementé)
      // ========================================
      const blocReglemente = {
        commissionsNettes,
        coefficientMin: typeBareme.blocReglemente.coefficientMin,
        coefficientMedian: typeBareme.blocReglemente.coefficientMedian,
        coefficientMax: typeBareme.blocReglemente.coefficientMax,
        valeurMin: Math.round(commissionsNettes * typeBareme.blocReglemente.coefficientMin),
        valeurMediane: Math.round(commissionsNettes * typeBareme.blocReglemente.coefficientMedian),
        valeurMax: Math.round(commissionsNettes * typeBareme.blocReglemente.coefficientMax),
        detailCommissions
      };

      // ========================================
      // ÉTAPE 4: Calculer Bloc 2 (Commercial)
      // ========================================
      let caActiviteBoutique = params.caActiviteBoutiqueAnnuel || 0;

      // ✅ FIX V3 (2025-12-29): Pas d'estimation - données extraites uniquement
      // Le CA boutique doit provenir de:
      // 1. Paramètres explicites (caActiviteBoutiqueAnnuel)
      // 2. Extraction depuis documents comptables (future implémentation)
      // Si absent → valeur = 0, le rapport affichera "Non disponible"
      if (caActiviteBoutique === 0) {
        console.warn('[calculateTabacValuation] ⚠️ CA Boutique non fourni - aucune estimation');
      }

      const blocCommercial = {
        caActiviteBoutique,
        pourcentageMin: typeBareme.blocCommercial.pourcentageMin,
        pourcentageMedian: typeBareme.blocCommercial.pourcentageMedian,
        pourcentageMax: typeBareme.blocCommercial.pourcentageMax,
        valeurMin: Math.round(caActiviteBoutique * typeBareme.blocCommercial.pourcentageMin / 100),
        valeurMediane: Math.round(caActiviteBoutique * typeBareme.blocCommercial.pourcentageMedian / 100),
        valeurMax: Math.round(caActiviteBoutique * typeBareme.blocCommercial.pourcentageMax / 100)
      };

      // ========================================
      // ÉTAPE 5: Valorisation Totale
      // ========================================
      const valorisationTotale = {
        fourchetteBasse: blocReglemente.valeurMin + blocCommercial.valeurMin,
        valeurMediane: blocReglemente.valeurMediane + blocCommercial.valeurMediane,
        fourchetteHaute: blocReglemente.valeurMax + blocCommercial.valeurMax
      };

      // ========================================
      // ÉTAPE 6: Comparaison avec prix affiché
      // ========================================
      let comparaisonPrix = undefined;
      const argumentsNegociation = {
        pour_acheteur: [] as string[],
        pour_vendeur: [] as string[]
      };

      if (params.prixAffiche && params.prixAffiche > 0) {
        const ecart = params.prixAffiche - valorisationTotale.valeurMediane;
        const ecartPct = Math.round((ecart / valorisationTotale.valeurMediane) * 100);

        let appreciation = 'juste-prix';
        if (ecartPct > 10) {
          appreciation = 'sur-evalue';
        } else if (ecartPct < -10) {
          appreciation = 'sous-evalue';
        }

        comparaisonPrix = {
          prixAffiche: params.prixAffiche,
          ecart,
          ecartPourcentage: ecartPct,
          appreciation
        };

        // Arguments de négociation basés sur l'écart
        if (ecartPct > 10) {
          argumentsNegociation.pour_acheteur.push(
            `📊 Prix affiché (${params.prixAffiche.toLocaleString('fr-FR')} €) supérieur de ${ecartPct}% à la valorisation médiane`
          );
          argumentsNegociation.pour_acheteur.push(
            `💰 Marge de négociation possible: ${Math.abs(ecart).toLocaleString('fr-FR')} €`
          );
        } else if (ecartPct < -10) {
          argumentsNegociation.pour_vendeur.push(
            `📈 Prix affiché (${params.prixAffiche.toLocaleString('fr-FR')} €) inférieur de ${Math.abs(ecartPct)}% à la valorisation médiane`
          );
          argumentsNegociation.pour_vendeur.push(
            `🎯 Opportunité d'achat en dessous du marché`
          );
        }
      }

      // Arguments génériques (à croiser avec comptable.alertes si disponible)
      if (comptable?.evolution?.tendance === 'croissance') {
        argumentsNegociation.pour_vendeur.push(
          `📈 Tendance positive du CA: +${comptable.evolution.ca_evolution_pct}%`
        );
      } else if (comptable?.evolution?.tendance === 'declin') {
        argumentsNegociation.pour_acheteur.push(
          `📉 Tendance négative du CA: ${comptable.evolution.ca_evolution_pct}%`
        );
      }

      if (comptable?.healthScore?.overall && comptable.healthScore.overall >= 70) {
        argumentsNegociation.pour_vendeur.push(
          `✅ Excellente santé financière: score ${comptable.healthScore.overall}/100`
        );
      }

      // ========================================
      // ÉTAPE 7: Justification
      // ========================================
      let justification = `Valorisation par MÉTHODE HYBRIDE Tabac/Presse/FDJ. `;
      justification += `Type de commerce détecté: ${typeBareme.description}. `;
      justification += `Bloc Réglementé: Commissions nettes (${commissionsNettes.toLocaleString('fr-FR')} €) × Coefficient (${typeBareme.blocReglemente.coefficientMin}-${typeBareme.blocReglemente.coefficientMax}) = ${blocReglemente.valeurMin.toLocaleString('fr-FR')} - ${blocReglemente.valeurMax.toLocaleString('fr-FR')} €. `;
      justification += `Bloc Commercial: CA Boutique (${caActiviteBoutique.toLocaleString('fr-FR')} €) × ${typeBareme.blocCommercial.pourcentageMin}-${typeBareme.blocCommercial.pourcentageMax}% = ${blocCommercial.valeurMin.toLocaleString('fr-FR')} - ${blocCommercial.valeurMax.toLocaleString('fr-FR')} €. `;
      justification += `Valorisation totale recommandée: ${valorisationTotale.valeurMediane.toLocaleString('fr-FR')} €.`;

      return {
        typeCommerce: typeBareme.type,
        descriptionType: typeBareme.description,
        blocReglemente,
        blocCommercial,
        valorisationTotale,
        comparaisonPrix,
        argumentsNegociation,
        facteursValorisants: typeBareme.facteursValorisants || [],
        justification
      };

    } catch (error: any) {
      return {
        typeCommerce: 'unknown',
        descriptionType: 'Erreur lors de la détection',
        blocReglemente: {
          commissionsNettes: 0,
          coefficientMin: 0,
          coefficientMedian: 0,
          coefficientMax: 0,
          valeurMin: 0,
          valeurMediane: 0,
          valeurMax: 0
        },
        blocCommercial: {
          caActiviteBoutique: 0,
          pourcentageMin: 0,
          pourcentageMedian: 0,
          pourcentageMax: 0,
          valeurMin: 0,
          valeurMediane: 0,
          valeurMax: 0
        },
        valorisationTotale: {
          fourchetteBasse: 0,
          valeurMediane: 0,
          fourchetteHaute: 0
        },
        argumentsNegociation: {
          pour_acheteur: [],
          pour_vendeur: []
        },
        facteursValorisants: [],
        justification: 'Erreur lors du calcul',
        error: error.message || 'Tabac valuation calculation failed'
      };
    }
  }
});

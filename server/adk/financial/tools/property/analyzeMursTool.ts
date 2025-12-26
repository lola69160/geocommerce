import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';

/**
 * Analyze Murs Tool
 *
 * Analyse l'option d'achat des murs (locaux commerciaux).
 * Calcule la rentabilité locative et recommande achat vs location.
 *
 * Rentabilité brute = (Loyer annuel / Prix d'achat) × 100
 * Rentabilité nette = (Loyer - Charges) / Prix × 100
 *
 * Critères de décision:
 * - Rentabilité brute > 7% : Excellent
 * - Rentabilité brute 5-7% : Bon
 * - Rentabilité brute < 5% : Faible
 *
 * Facteurs à considérer:
 * - Immobilisation du capital
 * - Sécurisation de l'emplacement
 * - Valorisation du patrimoine
 * - Charges de propriété (taxe foncière, entretien)
 */

const AnalyzeMursInputSchema = z.object({
  prix_demande: z.number().optional().describe('Prix de vente demandé par le propriétaire'),
  surface_m2: z.number().optional().describe('Surface des murs (sera lu depuis bail si non fourni)'),
  prix_m2_zone: z.number().optional().describe('Prix moyen au m² dans la zone (pour estimation si prix non fourni)')
});

const AnalyzeMursOutputSchema = z.object({
  murs: z.object({
    option_possible: z.boolean(),
    surface_m2: z.number(),
    prix_demande: z.number().optional(),
    prix_m2_zone: z.number(),
    valeur_estimee: z.number(),
    rentabilite_brute_pct: z.number(),
    rentabilite_nette_pct: z.number(),
    recommandation: z.enum(['acheter', 'louer', 'negocier']),
    arguments: z.array(z.string())
  }),
  error: z.string().optional()
});

export const analyzeMursTool = new FunctionTool({
  name: 'analyzeMurs',
  description: 'Analyse l\'option d\'achat des murs (rentabilité, recommandation achat vs location). Retourne { murs: { option_possible, prix, rentabilite_brute_pct, recommandation, arguments } }',
  parameters: zToGen(AnalyzeMursInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    try {
      // Lire immobilier depuis state (pour avoir loyer)
      let immobilier = toolContext?.state.get('immobilier') as any;

      // Parser JSON string si nécessaire
      if (typeof immobilier === 'string') {
        try {
          immobilier = JSON.parse(immobilier);
        } catch (e) {
          return {
            murs: {
              option_possible: false,
              surface_m2: 0,
              prix_m2_zone: 0,
              valeur_estimee: 0,
              rentabilite_brute_pct: 0,
              rentabilite_nette_pct: 0,
              recommandation: 'louer' as const,
              arguments: ['Erreur parsing données immobilier']
            },
            error: 'Failed to parse immobilier state (invalid JSON)'
          };
        }
      }

      // Lire businessInfo depuis state (pour localisation)
      let businessInfo = toolContext?.state.get('businessInfo') as any;

      if (typeof businessInfo === 'string') {
        try {
          businessInfo = JSON.parse(businessInfo);
        } catch (e) {
          // Pas critique
        }
      }

      if (!immobilier?.bail) {
        return {
          murs: {
            option_possible: false,
            surface_m2: 0,
            prix_m2_zone: 0,
            valeur_estimee: 0,
            rentabilite_brute_pct: 0,
            rentabilite_nette_pct: 0,
            recommandation: 'louer' as const,
            arguments: ['Bail non disponible : impossible d\'analyser l\'option murs']
          },
          error: 'No bail data in state.immobilier'
        };
      }

      const { bail } = immobilier;

      // ÉTAPE 1 : Récupérer surface et loyer
      const surfaceM2 = params.surface_m2 || bail.surface_m2 || 0;
      const loyerAnnuel = bail.loyer_annuel_hc;

      if (surfaceM2 === 0) {
        return {
          murs: {
            option_possible: false,
            surface_m2: 0,
            prix_m2_zone: 0,
            valeur_estimee: 0,
            rentabilite_brute_pct: 0,
            rentabilite_nette_pct: 0,
            recommandation: 'louer' as const,
            arguments: ['Surface des murs non fournie']
          }
        };
      }

      // ÉTAPE 2 : Estimer prix au m² selon zone (heuristiques)
      let prixM2Zone = params.prix_m2_zone || 0;

      if (prixM2Zone === 0) {
        // Prix moyens par type de zone (simplification)
        const PRIX_M2_MOYEN: { [key: string]: number } = {
          'paris': 10000,
          'grande_ville': 3500,
          'ville_moyenne': 2000,
          'ville_petite': 1500,
          'rural': 800,
          'default': 2500
        };

        prixM2Zone = PRIX_M2_MOYEN['default'];

        // Affiner si code postal disponible
        if (businessInfo?.siege?.code_postal) {
          const codePostal = businessInfo.siege.code_postal;
          if (codePostal.startsWith('75')) {
            prixM2Zone = PRIX_M2_MOYEN['paris'];
          } else if (['69', '13', '33', '31', '44', '59', '67'].some((cp: string) => codePostal.startsWith(cp))) {
            prixM2Zone = PRIX_M2_MOYEN['grande_ville'];
          }
        }
      }

      // ÉTAPE 3 : Calculer valeur estimée et prix demandé
      const valeurEstimee = Math.round(surfaceM2 * prixM2Zone);
      const prixDemande = params.prix_demande || valeurEstimee;

      // ÉTAPE 4 : Calculer rentabilités
      const rentabiliteBrutePct = prixDemande > 0
        ? Math.round((loyerAnnuel / prixDemande) * 1000) / 10
        : 0;

      // Charges propriétaire estimées à 15% du loyer (taxe foncière, entretien, assurance)
      const chargesProprietaire = Math.round(loyerAnnuel * 0.15);
      const loyerNet = loyerAnnuel - chargesProprietaire;
      const rentabiliteNettePct = prixDemande > 0
        ? Math.round((loyerNet / prixDemande) * 1000) / 10
        : 0;

      // ÉTAPE 5 : Déterminer recommandation
      let recommandation: 'acheter' | 'louer' | 'negocier' = 'louer';
      const arguments_: string[] = [];

      if (rentabiliteBrutePct >= 7) {
        recommandation = 'acheter';
        arguments_.push(`💰 Excellente rentabilité brute (${rentabiliteBrutePct}% > 7%)`);
        arguments_.push('Investissement rentable : achat recommandé');
      } else if (rentabiliteBrutePct >= 5) {
        recommandation = 'negocier';
        arguments_.push(`📊 Rentabilité correcte (${rentabiliteBrutePct}% entre 5-7%)`);
        arguments_.push('Achat possible si négociation du prix à la baisse');
      } else {
        recommandation = 'louer';
        arguments_.push(`⚠️ Rentabilité faible (${rentabiliteBrutePct}% < 5%)`);
        arguments_.push('Préférer la location pour préserver la trésorerie');
      }

      // Arguments complémentaires
      if (prixDemande > valeurEstimee * 1.15) {
        arguments_.push(`📉 Prix demandé (${prixDemande.toLocaleString('fr-FR')} €) supérieur de ${Math.round(((prixDemande - valeurEstimee) / valeurEstimee) * 100)}% à l'estimation`);
        if (recommandation === 'acheter') {
          recommandation = 'negocier';
        }
      } else if (prixDemande < valeurEstimee * 0.85) {
        arguments_.push(`💎 Prix demandé (${prixDemande.toLocaleString('fr-FR')} €) inférieur de ${Math.round(((valeurEstimee - prixDemande) / valeurEstimee) * 100)}% à l'estimation - opportunité`);
      }

      // Montant immobilisé
      arguments_.push(`💵 Capital immobilisé : ${prixDemande.toLocaleString('fr-FR')} € (${surfaceM2} m² × ${prixM2Zone.toLocaleString('fr-FR')} €/m²)`);

      // Rentabilité nette
      arguments_.push(`📈 Rentabilité nette après charges : ${rentabiliteNettePct}%`);

      // Avantages patrimoniaux
      if (recommandation === 'acheter' || recommandation === 'negocier') {
        arguments_.push('✅ Sécurisation de l\'emplacement (pas de risque de non-renouvellement du bail)');
        arguments_.push('✅ Valorisation du patrimoine immobilier');
      } else {
        arguments_.push('💡 En location : capital disponible pour développer l\'activité');
      }

      return {
        murs: {
          option_possible: true,
          surface_m2: surfaceM2,
          prix_demande: prixDemande,
          prix_m2_zone: prixM2Zone,
          valeur_estimee: valeurEstimee,
          rentabilite_brute_pct: rentabiliteBrutePct,
          rentabilite_nette_pct: rentabiliteNettePct,
          recommandation,
          arguments: arguments_
        }
      };

    } catch (error: any) {
      return {
        murs: {
          option_possible: false,
          surface_m2: 0,
          prix_m2_zone: 0,
          valeur_estimee: 0,
          rentabilite_brute_pct: 0,
          rentabilite_nette_pct: 0,
          recommandation: 'louer' as const,
          arguments: ['Erreur lors de l\'analyse']
        },
        error: error.message || 'Murs analysis failed'
      };
    }
  }
});

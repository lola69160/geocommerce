import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';

/**
 * Calculate Loyer Simulation Tool
 *
 * Simule les différents scénarios de renégociation de loyer commercial.
 * Compare le loyer actuel au loyer de marché et calcule l'impact sur la rentabilité.
 *
 * Contexte métier:
 * Le loyer actuel peut être "hors marché" (trop haut ou trop bas).
 * Une renégociation du bail peut significativement améliorer la rentabilité.
 *
 * Formule:
 * - Loyer actuel annuel : extrait du bilan ou bail
 * - Surface commerciale : en m²
 * - Prix/m²/an actuel : loyer annuel / surface
 * - Loyer marché estimé : surface × prix marché m²/an
 * - Économie potentielle : loyer actuel - loyer marché
 * - Impact sur EBE : +économie (si renégociation réussie)
 */

const CalculateLoyerSimulationInputSchema = z.object({
  // Données actuelles
  loyerActuelAnnuel: z.number().describe('Loyer annuel actuel en € (hors charges)'),
  surfaceM2: z.number().describe('Surface commerciale en m²'),
  dureeRestanteMois: z.number().optional().describe('Durée restante du bail en mois'),

  // Prix marché (optionnel, sinon estimation automatique)
  prixMarcheM2Annuel: z.number().optional().describe('Prix de marché au m²/an (si connu)'),

  // Localisation (pour estimation si prix marché non fourni)
  localisation: z.object({
    ville: z.string().optional(),
    codePostal: z.string().optional(),
    zone: z.string().optional().describe('Type de zone: centre-ville, périphérie, rural'),
    typeCommerce: z.string().optional().describe('Type de commerce: tabac, restauration, commerce de détail')
  }).optional(),

  // Contexte de négociation
  contexteNegociation: z.object({
    relationBailleur: z.string().optional().describe('bon, moyen, difficile'),
    ancienneteBail: z.number().optional().describe('Ancienneté du bail en années'),
    clauseRevision: z.boolean().optional().describe('Clause de révision du loyer présente')
  }).optional()
});

const CalculateLoyerSimulationOutputSchema = z.object({
  loyerActuel: z.object({
    annuel: z.number(),
    mensuel: z.number(),
    prixM2Annuel: z.number(),
    surfaceM2: z.number()
  }),

  loyerMarche: z.object({
    prixM2Estime: z.number(),
    annuelEstime: z.number(),
    mensuelEstime: z.number(),
    source: z.string().describe('Source de l\'estimation: input utilisateur, estimation automatique, recherche marché')
  }),

  comparaison: z.object({
    ecartAnnuel: z.number().describe('Loyer actuel - Loyer marché (positif = surcout, négatif = avantageux)'),
    ecartPourcentage: z.number().describe('Écart en % par rapport au loyer marché'),
    appreciation: z.string().describe('avantageux, marche, desavantageux')
  }),

  scenarios: z.object({
    pessimiste: z.object({
      description: z.string(),
      nouveauLoyerAnnuel: z.number(),
      economieAnnuelle: z.number(),
      probabilite: z.string()
    }),
    realiste: z.object({
      description: z.string(),
      nouveauLoyerAnnuel: z.number(),
      economieAnnuelle: z.number(),
      probabilite: z.string()
    }),
    optimiste: z.object({
      description: z.string(),
      nouveauLoyerAnnuel: z.number(),
      economieAnnuelle: z.number(),
      probabilite: z.string()
    })
  }),

  impactEBE: z.object({
    scenarioPessimiste: z.number(),
    scenarioRealiste: z.number(),
    scenarioOptimiste: z.number()
  }),

  argumentsNegociation: z.array(z.string()),

  recommandation: z.string(),
  error: z.string().optional()
});

export const calculateLoyerSimulationTool = new FunctionTool({
  name: 'calculateLoyerSimulation',
  description: 'Simule les scénarios de renégociation de loyer commercial. Compare le loyer actuel au marché et calcule l\'impact sur l\'EBE pour 3 scénarios (pessimiste/réaliste/optimiste).',
  parameters: zToGen(CalculateLoyerSimulationInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    try {
      // ========================================
      // ÉTAPE 1: Calculer les données actuelles
      // ========================================
      const loyerActuel = {
        annuel: params.loyerActuelAnnuel,
        mensuel: Math.round(params.loyerActuelAnnuel / 12),
        prixM2Annuel: Math.round(params.loyerActuelAnnuel / params.surfaceM2),
        surfaceM2: params.surfaceM2
      };

      // ========================================
      // ÉTAPE 2: Estimer le prix de marché
      // ========================================
      let prixMarcheM2 = params.prixMarcheM2Annuel || 0;
      let source = 'estimation automatique';

      if (params.prixMarcheM2Annuel) {
        // Prix fourni par l'utilisateur
        source = 'input utilisateur';
      } else {
        // Estimation basée sur la localisation et le type de commerce
        // Barèmes moyens France 2024 (source: Observatoire des loyers commerciaux)
        const baremesLoyers: { [key: string]: { [zone: string]: number } } = {
          'tabac': {
            'centre-ville': 250,
            'périphérie': 180,
            'rural': 120
          },
          'restauration': {
            'centre-ville': 350,
            'périphérie': 220,
            'rural': 150
          },
          'commerce de détail': {
            'centre-ville': 280,
            'périphérie': 200,
            'rural': 130
          },
          'default': {
            'centre-ville': 250,
            'périphérie': 180,
            'rural': 120
          }
        };

        const typeCommerce = params.localisation?.typeCommerce || 'default';
        const zone = params.localisation?.zone || 'centre-ville';

        prixMarcheM2 = baremesLoyers[typeCommerce]?.[zone] || baremesLoyers['default'][zone] || 200;
        source = 'estimation automatique (barèmes France 2024)';

        console.log('[calculateLoyerSimulation] Prix marché estimé automatiquement:', {
          typeCommerce,
          zone,
          prixM2: prixMarcheM2
        });
      }

      const loyerMarche = {
        prixM2Estime: prixMarcheM2,
        annuelEstime: Math.round(params.surfaceM2 * prixMarcheM2),
        mensuelEstime: Math.round((params.surfaceM2 * prixMarcheM2) / 12),
        source
      };

      // ========================================
      // ÉTAPE 3: Comparaison loyer actuel vs marché
      // ========================================
      const ecartAnnuel = loyerActuel.annuel - loyerMarche.annuelEstime;
      const ecartPourcentage = Math.round((ecartAnnuel / loyerMarche.annuelEstime) * 100);

      let appreciation = 'marche';
      if (ecartPourcentage > 20) {
        appreciation = 'desavantageux'; // Loyer trop élevé
      } else if (ecartPourcentage < -20) {
        appreciation = 'avantageux'; // Loyer avantageux
      }

      const comparaison = {
        ecartAnnuel,
        ecartPourcentage,
        appreciation
      };

      // ========================================
      // ÉTAPE 4: Scénarios de renégociation
      // ========================================
      const scenarios = {
        pessimiste: {
          description: 'Renégociation difficile, faible réduction',
          nouveauLoyerAnnuel: 0,
          economieAnnuelle: 0,
          probabilite: '30%'
        },
        realiste: {
          description: 'Renégociation réussie, réduction modérée',
          nouveauLoyerAnnuel: 0,
          economieAnnuelle: 0,
          probabilite: '50%'
        },
        optimiste: {
          description: 'Renégociation excellente, alignement marché',
          nouveauLoyerAnnuel: 0,
          economieAnnuelle: 0,
          probabilite: '20%'
        }
      };

      // Logique des scénarios basée sur l'écart actuel
      if (ecartAnnuel > 0) {
        // Loyer actuel TROP ÉLEVÉ → Potentiel d'économie

        // Scénario Pessimiste: Réduction de 30% de l'écart
        scenarios.pessimiste.nouveauLoyerAnnuel = Math.round(loyerActuel.annuel - (ecartAnnuel * 0.3));
        scenarios.pessimiste.economieAnnuelle = Math.round(ecartAnnuel * 0.3);

        // Scénario Réaliste: Réduction de 60% de l'écart
        scenarios.realiste.nouveauLoyerAnnuel = Math.round(loyerActuel.annuel - (ecartAnnuel * 0.6));
        scenarios.realiste.economieAnnuelle = Math.round(ecartAnnuel * 0.6);

        // Scénario Optimiste: Alignement complet sur le marché
        scenarios.optimiste.nouveauLoyerAnnuel = loyerMarche.annuelEstime;
        scenarios.optimiste.economieAnnuelle = ecartAnnuel;

      } else {
        // Loyer actuel AVANTAGEUX ou au marché → Pas de renégociation, maintien

        scenarios.pessimiste.description = 'Augmentation imposée par le bailleur';
        scenarios.pessimiste.nouveauLoyerAnnuel = Math.round(loyerActuel.annuel + (Math.abs(ecartAnnuel) * 0.5));
        scenarios.pessimiste.economieAnnuelle = Math.round(-Math.abs(ecartAnnuel) * 0.5); // Négatif = coût additionnel

        scenarios.realiste.description = 'Maintien du loyer actuel';
        scenarios.realiste.nouveauLoyerAnnuel = loyerActuel.annuel;
        scenarios.realiste.economieAnnuelle = 0;

        scenarios.optimiste.description = 'Maintien long terme du loyer avantageux';
        scenarios.optimiste.nouveauLoyerAnnuel = loyerActuel.annuel;
        scenarios.optimiste.economieAnnuelle = 0;
      }

      // ========================================
      // ÉTAPE 5: Impact sur l'EBE
      // ========================================
      const impactEBE = {
        scenarioPessimiste: scenarios.pessimiste.economieAnnuelle,
        scenarioRealiste: scenarios.realiste.economieAnnuelle,
        scenarioOptimiste: scenarios.optimiste.economieAnnuelle
      };

      // ========================================
      // ÉTAPE 6: Arguments de négociation
      // ========================================
      const argumentsNegociation: string[] = [];

      if (ecartAnnuel > 0) {
        // Loyer trop élevé → Arguments pour baisser
        argumentsNegociation.push(
          `💰 Loyer actuel (${loyerActuel.annuel.toLocaleString('fr-FR')} €/an) supérieur de ${ecartPourcentage}% au marché`
        );
        argumentsNegociation.push(
          `📊 Prix marché estimé: ${loyerMarche.prixM2Estime} €/m²/an vs actuel ${loyerActuel.prixM2Annuel} €/m²/an`
        );
        argumentsNegociation.push(
          `📉 Économie annuelle possible: ${ecartAnnuel.toLocaleString('fr-FR')} € (scénario optimiste)`
        );

        if (params.dureeRestanteMois && params.dureeRestanteMois < 24) {
          argumentsNegociation.push(
            `⏰ Échéance proche du bail (${params.dureeRestanteMois} mois) - moment propice à la renégociation`
          );
        }
      } else if (ecartAnnuel < 0) {
        // Loyer avantageux → Arguments pour le maintenir
        argumentsNegociation.push(
          `✅ Loyer actuel (${loyerActuel.annuel.toLocaleString('fr-FR')} €/an) inférieur de ${Math.abs(ecartPourcentage)}% au marché`
        );
        argumentsNegociation.push(
          `🎯 Avantage compétitif : économie de ${Math.abs(ecartAnnuel).toLocaleString('fr-FR')} €/an vs marché`
        );
        argumentsNegociation.push(
          `🔒 Sécuriser ce loyer avantageux dans le nouveau bail`
        );
      } else {
        // Loyer au marché
        argumentsNegociation.push(
          `✅ Loyer actuel en ligne avec le marché (${loyerActuel.prixM2Annuel} €/m²/an)`
        );
      }

      // Contexte de négociation
      if (params.contexteNegociation?.relationBailleur === 'bon') {
        argumentsNegociation.push(
          `🤝 Bonne relation avec le bailleur - négociation facilitée`
        );
      } else if (params.contexteNegociation?.relationBailleur === 'difficile') {
        argumentsNegociation.push(
          `⚠️ Relation difficile avec le bailleur - négociation complexe`
        );
      }

      if (params.contexteNegociation?.ancienneteBail && params.contexteNegociation.ancienneteBail >= 5) {
        argumentsNegociation.push(
          `📅 Ancienneté du bail (${params.contexteNegociation.ancienneteBail} ans) - légitimité à demander une révision`
        );
      }

      // ========================================
      // ÉTAPE 7: Recommandation
      // ========================================
      let recommandation = '';

      if (ecartAnnuel > 10000) {
        recommandation = `RECOMMANDATION FORTE: Renégociation du loyer PRIORITAIRE. Économie potentielle de ${ecartAnnuel.toLocaleString('fr-FR')} €/an (${ecartPourcentage}% du loyer marché). Prévoir négociation avec le bailleur ou changement de local si refus.`;
      } else if (ecartAnnuel > 5000) {
        recommandation = `RECOMMANDATION: Renégociation du loyer CONSEILLÉE. Économie potentielle de ${ecartAnnuel.toLocaleString('fr-FR')} €/an. Discuter avec le bailleur lors du renouvellement.`;
      } else if (ecartAnnuel > 0) {
        recommandation = `RECOMMANDATION: Loyer légèrement élevé (${ecartPourcentage}%). Renégociation possible mais non critique.`;
      } else if (ecartAnnuel < -5000) {
        recommandation = `AVANTAGE MAJEUR: Loyer très avantageux (${Math.abs(ecartPourcentage)}% sous le marché). SÉCURISER ce loyer dans le nouveau bail. Cet avantage compétitif vaut ${Math.abs(ecartAnnuel).toLocaleString('fr-FR')} €/an.`;
      } else {
        recommandation = `Loyer en ligne avec le marché. Pas de renégociation nécessaire.`;
      }

      return {
        loyerActuel,
        loyerMarche,
        comparaison,
        scenarios,
        impactEBE,
        argumentsNegociation,
        recommandation
      };

    } catch (error: any) {
      return {
        loyerActuel: {
          annuel: 0,
          mensuel: 0,
          prixM2Annuel: 0,
          surfaceM2: 0
        },
        loyerMarche: {
          prixM2Estime: 0,
          annuelEstime: 0,
          mensuelEstime: 0,
          source: 'erreur'
        },
        comparaison: {
          ecartAnnuel: 0,
          ecartPourcentage: 0,
          appreciation: 'erreur'
        },
        scenarios: {
          pessimiste: { description: '', nouveauLoyerAnnuel: 0, economieAnnuelle: 0, probabilite: '0%' },
          realiste: { description: '', nouveauLoyerAnnuel: 0, economieAnnuelle: 0, probabilite: '0%' },
          optimiste: { description: '', nouveauLoyerAnnuel: 0, economieAnnuelle: 0, probabilite: '0%' }
        },
        impactEBE: {
          scenarioPessimiste: 0,
          scenarioRealiste: 0,
          scenarioOptimiste: 0
        },
        argumentsNegociation: [],
        recommandation: 'Erreur lors du calcul',
        error: error.message || 'Loyer simulation calculation failed'
      };
    }
  }
});

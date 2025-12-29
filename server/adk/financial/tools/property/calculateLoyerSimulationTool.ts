import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';
import { logImmobilier } from '../../../utils/extractionLogger';

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
    annuel: z.number().nullable(),
    mensuel: z.number().nullable(),
    source: z.string().describe('Source du loyer actuel: comptabilite, bail_document, utilisateur, non_disponible'),
    anneeSource: z.string().optional()
  }),

  nouveauLoyer: z.object({
    annuel: z.number().nullable(),
    mensuel: z.number().nullable(),
    source: z.string().describe('Source: utilisateur ou non_renseigne'),
    renseigne: z.boolean()
  }),

  simulation: z.object({
    economieAnnuelle: z.number().nullable(),
    economieMensuelle: z.number().nullable(),
    economiePourcentage: z.number().nullable(),
    impactEBE: z.number().nullable()
  }).nullable(),

  message: z.string().optional(),
  error: z.string().optional()
});

export const calculateLoyerSimulationTool = new FunctionTool({
  name: 'calculateLoyerSimulation',
  description: 'Calcule la simulation de renégociation de loyer basée sur les données réelles : loyer actuel depuis comptabilité, nouveau loyer depuis userComments. Aucun scénario inventé.',
  parameters: zToGen(CalculateLoyerSimulationInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    try {
      // ========================================
      // ÉTAPE 1: Lire les données depuis state
      // ========================================

      // Lire immobilier (contient bail avec loyer_source)
      let immobilier = toolContext?.state.get('immobilier') as any;
      if (typeof immobilier === 'string') {
        try { immobilier = JSON.parse(immobilier); } catch (e) {}
      }

      // Lire userComments (contient futur_loyer_commercial)
      let userComments = toolContext?.state.get('userComments') as any;
      if (typeof userComments === 'string') {
        try { userComments = JSON.parse(userComments); } catch (e) {}
      }

      // ========================================
      // ÉTAPE 2: Loyer actuel
      // PRIORITÉ DES SOURCES (2025-12-29):
      // 1. Document de transaction (cout_transaction) - extraction directe
      // 2. Bail/comptabilité (immobilier.bail)
      // 3. UserComments (loyer_actuel_mensuel * 12)
      // ========================================

      // Lire documentExtraction pour transactionCosts
      let documentExtraction = toolContext?.state.get('documentExtraction') as any;
      if (typeof documentExtraction === 'string') {
        try { documentExtraction = JSON.parse(documentExtraction); } catch (e) {}
      }

      // Source 1: Document de transaction (PRIORITAIRE)
      const transactionCosts = documentExtraction?.transactionCosts;
      const loyerFromTransaction = transactionCosts?.loyer_annuel_actuel || 0;

      // Source 2: Bail/comptabilité
      const bail = immobilier?.bail;
      const loyerFromBail = bail?.loyer_annuel_hc || 0;
      const bailSource = bail?.loyer_source || 'non_disponible';
      const bailAnneeSource = bail?.loyer_annee_source || undefined;

      // Source 3: UserComments (loyer_actuel_mensuel * 12)
      const loyerFromUserMensuel = userComments?.loyer?.loyer_actuel_mensuel || 0;
      const loyerFromUser = loyerFromUserMensuel > 0 ? loyerFromUserMensuel * 12 : 0;

      // Déterminer la source à utiliser (par priorité)
      let loyerActuelAnnuel: number | null = null;
      let loyerSource = 'non_disponible';
      let loyerAnneeSource: string | undefined = undefined;

      if (loyerFromTransaction > 0) {
        // Priorité 1: Document de transaction
        loyerActuelAnnuel = loyerFromTransaction;
        loyerSource = 'document_transaction';
        console.log('[calculateLoyerSimulation] ✅ Loyer depuis document transaction:', loyerFromTransaction);
      } else if (loyerFromBail > 0) {
        // Priorité 2: Bail/comptabilité
        loyerActuelAnnuel = loyerFromBail;
        loyerSource = bailSource;
        loyerAnneeSource = bailAnneeSource;
        console.log('[calculateLoyerSimulation] ✅ Loyer depuis bail/compta:', loyerFromBail);
      } else if (loyerFromUser > 0) {
        // Priorité 3: UserComments
        loyerActuelAnnuel = loyerFromUser;
        loyerSource = 'utilisateur';
        console.log('[calculateLoyerSimulation] ✅ Loyer depuis userComments:', loyerFromUser);
      } else if (params.loyerActuelAnnuel) {
        // Fallback: paramètre d'entrée
        loyerActuelAnnuel = params.loyerActuelAnnuel;
        loyerSource = 'parametre';
        console.log('[calculateLoyerSimulation] ⚠️ Loyer depuis paramètre:', params.loyerActuelAnnuel);
      }

      const loyerActuel = {
        annuel: loyerActuelAnnuel,
        mensuel: loyerActuelAnnuel ? Math.round(loyerActuelAnnuel / 12) : null,
        source: loyerSource,
        anneeSource: loyerAnneeSource
      };

      console.log('[calculateLoyerSimulation] Loyer actuel final:', loyerActuel);

      // ========================================
      // ÉTAPE 3: Nouveau loyer (UNIQUEMENT depuis userComments)
      // ========================================
      const futurLoyerMensuel = userComments?.loyer?.futur_loyer_commercial || null;
      const futurLoyerAnnuel = futurLoyerMensuel ? futurLoyerMensuel * 12 : null;

      const nouveauLoyer = {
        annuel: futurLoyerAnnuel,
        mensuel: futurLoyerMensuel,
        source: futurLoyerMensuel ? 'utilisateur' : 'non_renseigne',
        renseigne: futurLoyerMensuel !== null
      };

      console.log('[calculateLoyerSimulation] Nouveau loyer:', nouveauLoyer);

      // ========================================
      // ÉTAPE 4: Simulation (si nouveau loyer renseigné)
      // ========================================
      let simulation = null;
      let message = '';

      if (!nouveauLoyer.renseigne) {
        // Pas de nouveau loyer renseigné → Pas de simulation
        message = 'Loyer renégocié non renseigné par l\'utilisateur. Veuillez compléter les informations pour simuler l\'économie.';
        console.log('[calculateLoyerSimulation] ⚠️ Simulation impossible:', message);

      } else if (loyerActuelAnnuel === null) {
        // Pas de loyer actuel → Pas de simulation
        message = 'Loyer actuel non disponible dans les documents comptables. Impossible de calculer l\'économie.';
        console.log('[calculateLoyerSimulation] ⚠️ Simulation impossible:', message);

      } else {
        // Calcul de l'économie
        const economieAnnuelle = loyerActuelAnnuel - futurLoyerAnnuel!;
        const economieMensuelle = Math.round(economieAnnuelle / 12);
        const economiePourcentage = Math.round((economieAnnuelle / loyerActuelAnnuel) * 100);

        simulation = {
          economieAnnuelle,
          economieMensuelle,
          economiePourcentage,
          impactEBE: economieAnnuelle // Impact direct sur EBE
        };

        if (economieAnnuelle > 0) {
          message = `Économie de ${economieAnnuelle.toLocaleString('fr-FR')} €/an (${economiePourcentage}%) grâce à la renégociation du loyer.`;
        } else if (economieAnnuelle < 0) {
          message = `Augmentation de ${Math.abs(economieAnnuelle).toLocaleString('fr-FR')} €/an prévue.`;
        } else {
          message = 'Loyer inchangé.';
        }

        console.log('[calculateLoyerSimulation] ✅ Simulation calculée:', simulation);
      }

      // Log immobilier to extraction log
      const siret = (toolContext?.state.get('businessInfo') as any)?.siret || 'unknown';
      logImmobilier(siret, {
        simulationLoyer: {
          loyer_actuel: loyerActuel.annuel || undefined,
          loyer_negocie: nouveauLoyer.annuel || undefined,
          economie_annuelle: simulation?.economieAnnuelle || undefined
        }
      });

      return {
        loyerActuel,
        nouveauLoyer,
        simulation,
        message
      };

    } catch (error: any) {
      console.error('[calculateLoyerSimulation] Erreur:', error);
      return {
        loyerActuel: {
          annuel: null,
          mensuel: null,
          source: 'erreur',
          anneeSource: undefined
        },
        nouveauLoyer: {
          annuel: null,
          mensuel: null,
          source: 'erreur',
          renseigne: false
        },
        simulation: null,
        message: 'Erreur lors du calcul de la simulation',
        error: error.message || 'Loyer simulation calculation failed'
      };
    }
  }
});

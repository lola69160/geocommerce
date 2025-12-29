import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';
import { logEbeRetraitement } from '../../../utils/extractionLogger';

/**
 * Calculate EBE Retraitement Tool
 *
 * Calcule l'EBE Retraité/Normatif à partir de l'EBE comptable.
 * L'EBE Normatif représente la capacité bénéficiaire réelle pour le repreneur,
 * après retraitements des éléments non récurrents ou liés au cédant.
 *
 * Formule de Retraitement:
 * EBE Comptable                        : X €
 * (+) Réintégration Salaire Dirigeant  : + Y €  (si le dirigeant se payait)
 * (+) Réintégration Salariés Non Repris: + Z €  (masse salariale qui disparaît)
 * (-) Nouveau Salaire Saisonnier       : - A €  (si le repreneur embauche)
 * (+) Économie de Loyer                : + B €  (si renégociation favorable)
 * (+) Charges Exceptionnelles          : + D €  (non récurrentes)
 * (-) Produits Exceptionnels           : - E €  (non récurrents)
 * = EBE NORMATIF (Capacité réelle)     : ~XXX €
 */

const CalculateEbeRetraitementInputSchema = z.object({
  debug: z.boolean().optional().describe('Mode debug pour logs détaillés')
});

const RetraitementLineSchema = z.object({
  type: z.string().describe('Type de retraitement: salaire_dirigeant, salaries_non_repris, salaires_saisonniers, loyer, charges_exceptionnelles, produits_exceptionnels'),
  description: z.string().describe('Description du retraitement'),
  montant: z.number().describe('Montant du retraitement (positif si augmente EBE, négatif si diminue)'),
  source: z.string().describe('Source de l\'information: userComments, documentExtraction, estimation'),
  commentaire: z.string().optional().describe('Commentaire additionnel')
});

const CalculateEbeRetraitementOutputSchema = z.object({
  ebe_comptable: z.number().describe('EBE comptable de référence (moyenne 3 ans ou dernière année)'),
  annee_reference: z.number().describe('Année de référence utilisée'),
  retraitements: z.array(RetraitementLineSchema),
  total_retraitements: z.number().describe('Somme des retraitements'),
  ebe_normatif: z.number().describe('EBE Normatif après retraitements'),
  ecart_pct: z.number().describe('Écart en % entre EBE comptable et EBE normatif'),
  synthese: z.string().describe('Synthèse des retraitements effectués'),
  error: z.string().optional()
});

export const calculateEbeRetraitementTool = new FunctionTool({
  name: 'calculateEbeRetraitement',
  description: 'Calcule l\'EBE Retraité/Normatif à partir de l\'EBE comptable en appliquant les retraitements nécessaires (salaire dirigeant, salariés non repris, loyer, charges exceptionnelles). Retourne le tableau de retraitement détaillé et l\'EBE Normatif.',
  parameters: zToGen(CalculateEbeRetraitementInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    try {
      // Lire comptable depuis state
      let comptable = toolContext?.state.get('comptable') as any;
      if (typeof comptable === 'string') {
        try {
          comptable = JSON.parse(comptable);
        } catch (e) {
          return {
            ebe_comptable: 0,
            annee_reference: 0,
            retraitements: [],
            total_retraitements: 0,
            ebe_normatif: 0,
            ecart_pct: 0,
            synthese: 'Erreur: Impossible de parser les données comptables',
            error: 'Failed to parse comptable state'
          };
        }
      }

      // Lire userComments depuis state
      let userComments = toolContext?.state.get('userComments') as any;
      if (typeof userComments === 'string') {
        try {
          userComments = JSON.parse(userComments);
        } catch (e) {
          userComments = null;
        }
      }

      // Lire documentExtraction depuis state
      let documentExtraction = toolContext?.state.get('documentExtraction') as any;
      if (typeof documentExtraction === 'string') {
        try {
          documentExtraction = JSON.parse(documentExtraction);
        } catch (e) {
          documentExtraction = null;
        }
      }

      // Lire immobilier depuis state (pour simulation loyer)
      let immobilier = toolContext?.state.get('immobilier') as any;
      if (typeof immobilier === 'string') {
        try {
          immobilier = JSON.parse(immobilier);
        } catch (e) {
          immobilier = null;
        }
      }

      if (!comptable?.sig || !comptable?.yearsAnalyzed || comptable.yearsAnalyzed.length === 0) {
        return {
          ebe_comptable: 0,
          annee_reference: 0,
          retraitements: [],
          total_retraitements: 0,
          ebe_normatif: 0,
          ecart_pct: 0,
          synthese: 'Erreur: Données SIG manquantes',
          error: 'Missing SIG data in state.comptable'
        };
      }

      const { sig, yearsAnalyzed } = comptable;

      // Helper pour extraire la valeur d'un champ SIG (format nouveau ou ancien)
      const extractSigValue = (sigYear: any, field: string): number => {
        if (!sigYear || !sigYear[field]) return 0;

        // Nouveau format: { valeur: number, pct_ca: number }
        if (typeof sigYear[field] === 'object' && 'valeur' in sigYear[field]) {
          return sigYear[field].valeur || 0;
        }

        // Ancien format: number
        if (typeof sigYear[field] === 'number') {
          return sigYear[field];
        }

        return 0;
      };

      // Calculer EBE de référence (moyenne 3 dernières années ou dernière année)
      let ebeComptable = 0;
      let anneeReference = 0;

      if (yearsAnalyzed.length >= 3) {
        // Moyenne des 3 dernières années
        const ebeValues = yearsAnalyzed.slice(0, 3).map((year: number) => {
          const yearStr = year.toString();
          return extractSigValue(sig[yearStr], 'ebe');
        });
        ebeComptable = Math.round(ebeValues.reduce((a: number, b: number) => a + b, 0) / ebeValues.length);
        anneeReference = yearsAnalyzed[0]; // Année la plus récente
      } else {
        // Dernière année disponible
        anneeReference = yearsAnalyzed[0];
        const lastYear = anneeReference.toString();
        ebeComptable = extractSigValue(sig[lastYear], 'ebe');
      }

      // Array des retraitements
      const retraitements: Array<{
        type: string;
        description: string;
        montant: number;
        source: string;
        commentaire?: string;
      }> = [];

      // ========================================
      // 1. SALAIRE DIRIGEANT (CHARGES EXPLOITANT)
      // ========================================
      console.log('\n[EBE Retraitement] ========================================');
      console.log('[EBE Retraitement] Démarrage calcul EBE Normatif');
      console.log('[EBE Retraitement] EBE Comptable de base:', ebeComptable.toLocaleString('fr-FR'), '€');
      console.log('[EBE Retraitement] Année de référence:', anneeReference);
      console.log('[EBE Retraitement] ========================================\n');

      // Le salaire du dirigeant peut être obtenu de 3 sources:
      // PRIORITÉ 0: charges_exploitant extrait du SIG (le plus fiable)
      // PRIORITÉ 1: userComments.salaire_dirigeant (fourni par l'utilisateur)
      // PRIORITÉ 2: estimation standard (35 000 €)

      const lastYearStr = anneeReference.toString();
      const lastYearSig = sig[lastYearStr];

      // Essayer d'extraire charges_exploitant depuis le SIG (PRIORITÉ 0)
      const chargesExploitantFromSig = extractSigValue(lastYearSig, 'charges_exploitant');
      const chargesPersonnel = extractSigValue(lastYearSig, 'charges_personnel') ||
                               extractSigValue(lastYearSig, 'salaires_personnel') ||
                               lastYearSig?._legacy?.charges_personnel || 0;

      console.log('[EBE Retraitement] Recherche salaire dirigeant:');
      console.log(`[EBE Retraitement]   └─ charges_exploitant (SIG): ${chargesExploitantFromSig > 0 ? chargesExploitantFromSig.toLocaleString('fr-FR') + '€' : 'NON DISPONIBLE'}`);
      console.log(`[EBE Retraitement]   └─ userComments.salaire_dirigeant: ${userComments?.salaire_dirigeant ? userComments.salaire_dirigeant.toLocaleString('fr-FR') + '€' : 'NON FOURNI'}`);
      console.log(`[EBE Retraitement]   └─ charges_personnel: ${chargesPersonnel.toLocaleString('fr-FR')}€`);

      // Déterminer la source du salaire dirigeant
      let salaireGerant = 0;
      let source = 'estimation';

      if (chargesExploitantFromSig > 0) {
        // PRIORITÉ 0: charges_exploitant extrait du SIG
        salaireGerant = chargesExploitantFromSig;
        source = 'sig_extraction';
        console.log(`[EBE Retraitement] ⭐ PRIORITÉ 0: Utilisation charges_exploitant du SIG: ${salaireGerant.toLocaleString('fr-FR')}€`);
      } else if (userComments?.salaire_dirigeant && userComments.salaire_dirigeant > 0) {
        // PRIORITÉ 1: userComments.salaire_dirigeant
        salaireGerant = userComments.salaire_dirigeant;
        source = 'userComments';
        console.log(`[EBE Retraitement] ✓ PRIORITÉ 1: Utilisation userComments.salaire_dirigeant: ${salaireGerant.toLocaleString('fr-FR')}€`);
      } else if (chargesPersonnel > 0) {
        // PRIORITÉ 2: Estimation standard
        salaireGerant = 35000;
        source = 'estimation';
        console.log(`[EBE Retraitement] ⚠️ PRIORITÉ 2: Estimation standard: ${salaireGerant.toLocaleString('fr-FR')}€`);
        console.log(`[EBE Retraitement]    └─ Charges personnel détectées (${chargesPersonnel.toLocaleString('fr-FR')}€) mais pas de détail disponible`);
      }

      // Ajouter le retraitement si salaire identifié
      if (salaireGerant > 0) {
        retraitements.push({
          type: 'salaire_dirigeant',
          description: 'Réintégration salaire dirigeant (charges exploitant)',
          montant: salaireGerant,
          source,
          commentaire: source === 'sig_extraction'
            ? 'Valeur extraite directement du SIG (ligne "Charges de l\'exploitant")'
            : source === 'userComments'
              ? 'Valeur fournie par l\'utilisateur'
              : 'Estimation standard (35 000 €/an) - Le repreneur pourra choisir de ne pas se rémunérer'
        });

        console.log(`[EBE Retraitement] ✓ Retraitement salaire dirigeant ajouté: +${salaireGerant.toLocaleString('fr-FR')}€ (source: ${source})`);
      } else {
        console.log(`[EBE Retraitement] ⚠️ Aucun salaire dirigeant détecté - pas de retraitement`);
      }

      // ========================================
      // 2. SALARIÉS NON REPRIS
      // ========================================
      // Si certains salariés ne sont pas repris (départ à la retraite, licenciement économique)
      // → On réintègre leur masse salariale

      if (userComments?.salaries_non_repris && userComments?.salaries_non_repris.nombre > 0) {
        const masseSalarialeNonReprise = userComments.salaries_non_repris.masse_salariale_annuelle || 0;

        retraitements.push({
          type: 'salaries_non_repris',
          description: `Réintégration masse salariale de ${userComments.salaries_non_repris.nombre} salarié(s) non repris`,
          montant: masseSalarialeNonReprise,
          source: 'userComments',
          commentaire: userComments.salaries_non_repris.motif || 'Salariés non repris par le repreneur'
        });

        console.log(`[EBE Retraitement] ✓ Salariés non repris: ${userComments.salaries_non_repris.nombre} salarié(s)`);
        console.log(`                     → Masse salariale réintégrée: +${masseSalarialeNonReprise.toLocaleString('fr-FR')}€`);
        console.log(`                     → Motif: ${userComments.salaries_non_repris.motif || 'Non renseigné'}`);
      }

      // ========================================
      // 3. NOUVEAUX SALAIRES SAISONNIERS
      // ========================================
      // Si le repreneur prévoit d'embaucher des saisonniers
      // → On retire ce nouveau coût de l'EBE

      if (userComments?.salaires_saisonniers_prevus && userComments?.salaires_saisonniers_prevus > 0) {
        retraitements.push({
          type: 'salaires_saisonniers',
          description: 'Déduction salaires saisonniers prévus par le repreneur',
          montant: -userComments.salaires_saisonniers_prevus,
          source: 'userComments',
          commentaire: 'Coût additionnel non présent dans le bilan actuel'
        });

        console.log(`[EBE Retraitement] ✓ Salaires saisonniers prévus: -${userComments.salaires_saisonniers_prevus.toLocaleString('fr-FR')}€`);
        console.log(`                     → Coût additionnel non présent dans bilan actuel`);
      }

      // ========================================
      // 4. ÉCONOMIE DE LOYER (RENÉGOCIATION)
      // ========================================

      // Si le loyer a été renégocié à la baisse
      // → On ajoute l'économie réalisée

      // PRIORITÉ 1: Utiliser userComments si fourni
      let loyerRetraitementAjoute = false;

      if (userComments?.loyer) {
        const loyerActuelMensuel = userComments.loyer.loyer_actuel_mensuel || 0;
        const loyerNegocieMensuel = userComments.loyer.loyer_futur_mensuel || 0;
        const loyerLogementPersoMensuel = userComments.loyer.loyer_logement_perso || 0;

        // Si loyer négocié < loyer actuel → économie
        if (loyerNegocieMensuel > 0 && loyerActuelMensuel > 0 && loyerNegocieMensuel < loyerActuelMensuel) {
          const economieAnnuelle = (loyerActuelMensuel - loyerNegocieMensuel) * 12;

          retraitements.push({
            type: 'loyer',
            description: 'Économie loyer commercial renégocié',
            montant: economieAnnuelle,
            source: 'userComments',
            commentaire: `Loyer réduit de ${loyerActuelMensuel}€/mois à ${loyerNegocieMensuel}€/mois`
          });

          loyerRetraitementAjoute = true;
        }

        // Si loyer logement personnel inclus dans les charges → avantage en nature
        if (loyerLogementPersoMensuel > 0) {
          const avantageAnnuel = loyerLogementPersoMensuel * 12;

          retraitements.push({
            type: 'loyer',
            description: 'Loyer logement personnel (avantage en nature gérant)',
            montant: avantageAnnuel,
            source: 'userComments',
            commentaire: `Économie de ${loyerLogementPersoMensuel}€/mois pour le gérant`
          });
        }
      }

      // PRIORITÉ 2: Si pas de retraitement loyer via userComments, utiliser la simulation loyer
      // (scénario réaliste = 60% réduction, probabilité 50%)
      if (!loyerRetraitementAjoute && immobilier?.simulationLoyer) {
        const simulationLoyer = immobilier.simulationLoyer;
        const scenarioRealiste = simulationLoyer.scenarios?.realiste;

        // Si économie > 0 dans le scénario réaliste
        if (scenarioRealiste && scenarioRealiste.economieAnnuelle > 0) {
          retraitements.push({
            type: 'loyer',
            description: 'Économie loyer commercial (simulation renégociation - scénario réaliste)',
            montant: scenarioRealiste.economieAnnuelle,
            source: 'simulation',
            commentaire: `${scenarioRealiste.description} - Économie: ${scenarioRealiste.economieAnnuelle.toLocaleString('fr-FR')} €/an (probabilité ${scenarioRealiste.probabilite})`
          });
        }
      }

      // ========================================
      // 5. CHARGES EXCEPTIONNELLES
      // ========================================
      // Charges non récurrentes (travaux, contentieux, amendes, pénalités)
      // → On les réintègre car elles ne se reproduiront pas

      const resultatExceptionnel = extractSigValue(lastYearSig, 'resultat_exceptionnel');

      if (resultatExceptionnel < 0) {
        // Résultat exceptionnel négatif = charges exceptionnelles nettes
        const chargesExceptionnellesNettes = Math.abs(resultatExceptionnel);

        retraitements.push({
          type: 'charges_exceptionnelles',
          description: 'Réintégration charges exceptionnelles (non récurrentes)',
          montant: chargesExceptionnellesNettes,
          source: 'documentExtraction',
          commentaire: 'Charges exceptionnelles de l\'année de référence à réintégrer'
        });
      }

      // ========================================
      // 6. PRODUITS EXCEPTIONNELS
      // ========================================
      // Produits non récurrents (cession actifs, subventions ponctuelles)
      // → On les retire car ils ne se reproduiront pas

      if (resultatExceptionnel > 0) {
        // Résultat exceptionnel positif = produits exceptionnels nets
        const produitsExceptionnelsNets = resultatExceptionnel;

        retraitements.push({
          type: 'produits_exceptionnels',
          description: 'Déduction produits exceptionnels (non récurrents)',
          montant: -produitsExceptionnelsNets,
          source: 'documentExtraction',
          commentaire: 'Produits exceptionnels de l\'année de référence à retirer'
        });
      }

      // ========================================
      // CALCUL EBE NORMATIF
      // ========================================

      const totalRetraitements = retraitements.reduce((sum, r) => sum + r.montant, 0);
      const ebeNormatif = ebeComptable + totalRetraitements;
      const ecartPct = ebeComptable !== 0 ? Math.round(((ebeNormatif - ebeComptable) / ebeComptable) * 100) : 0;

      // Synthèse
      let synthese = '';

      if (retraitements.length === 0) {
        synthese = `Aucun retraitement identifié. L'EBE comptable (${ebeComptable.toLocaleString('fr-FR')} €) est considéré comme normatif.`;
      } else {
        synthese = `L'EBE Normatif (${ebeNormatif.toLocaleString('fr-FR')} €) a été calculé à partir de l'EBE comptable (${ebeComptable.toLocaleString('fr-FR')} €) après ${retraitements.length} retraitement(s). `;

        if (totalRetraitements > 0) {
          synthese += `L'EBE Normatif est supérieur de ${ecartPct}% à l'EBE comptable, reflétant la capacité bénéficiaire réelle pour le repreneur.`;
        } else if (totalRetraitements < 0) {
          synthese += `L'EBE Normatif est inférieur de ${Math.abs(ecartPct)}% à l'EBE comptable, tenant compte des nouveaux coûts prévus.`;
        } else {
          synthese += `Les retraitements positifs et négatifs s'équilibrent.`;
        }
      }

      // Log EBE Retraitement to extraction log
      const siret = (toolContext?.state.get('businessInfo') as any)?.siret || 'unknown';
      logEbeRetraitement(
        siret,
        anneeReference,
        ebeComptable,
        ebeNormatif,
        retraitements.map(r => ({
          type: r.type,
          description: r.description,
          montant: r.montant,
          source: r.source
        }))
      );

      return {
        ebe_comptable: ebeComptable,
        annee_reference: anneeReference,
        retraitements,
        total_retraitements: totalRetraitements,
        ebe_normatif: ebeNormatif,
        ecart_pct: ecartPct,
        synthese
      };

    } catch (error: any) {
      return {
        ebe_comptable: 0,
        annee_reference: 0,
        retraitements: [],
        total_retraitements: 0,
        ebe_normatif: 0,
        ecart_pct: 0,
        synthese: 'Erreur lors du calcul des retraitements',
        error: error.message || 'EBE retraitement calculation failed'
      };
    }
  }
});

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
  type: z.string().describe('Type de retraitement: salaire_dirigeant, salaries_non_repris, salaires_saisonniers, loyer, charges_exceptionnelles, produits_exceptionnels, suppression_personnel_cedant, nouvelle_structure_rh'),
  description: z.string().describe('Description du retraitement'),
  montant: z.number().describe('Montant du retraitement (positif si augmente EBE, négatif si diminue)'),
  source: z.string().describe('Source de l\'information: userComments, documentExtraction, estimation'),
  justification: z.string().describe('Justification économique détaillée pour le pont EBE'),
  commentaire: z.string().optional().describe('Commentaire additionnel technique')
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

      // Calculer EBE de référence (TOUJOURS dernière année pour le Pont EBE)
      // Note: La moyenne 3 ans est utilisée pour la VALORISATION, pas pour le retraitement
      const anneeReference = yearsAnalyzed[0]; // Année la plus récente
      const lastYear = anneeReference.toString();
      const ebeComptable = extractSigValue(sig[lastYear], 'ebe');

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
          justification: source === 'sig_extraction'
            ? 'Donnée certifiée liasse fiscale'
            : source === 'userComments'
              ? 'Montant fourni par le repreneur'
              : 'Estimation standard gérant majoritaire',
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
      // 2. SUPPRESSION PERSONNEL CÉDANT (CONDITIONAL)
      // ========================================
      // Si le repreneur ne reprend PAS le personnel actuel
      // → On réintègre TOUTE la masse salariale (salaires + charges sociales)

      console.log('\n[EBE Retraitement] ────────────────────────────────');
      console.log('[EBE Retraitement] ANALYSE PERSONNEL CÉDANT');
      console.log('[EBE Retraitement] ────────────────────────────────');

      const repriseSalaries = userComments?.reprise_salaries;
      console.log(`[EBE Retraitement] Reprise salariés cédant: ${repriseSalaries === true ? 'OUI' : repriseSalaries === false ? 'NON' : 'NON RENSEIGNÉ (défaut: OUI)'}`);

      if (repriseSalaries === false) {
        // Calculate total personnel cost from SIG
        const salairesPersonnel = extractSigValue(lastYearSig, 'salaires_personnel') || 0;
        const chargesSociales = extractSigValue(lastYearSig, 'charges_sociales_personnel') || 0;
        const masseSalarialeTotale = salairesPersonnel + chargesSociales;

        console.log(`[EBE Retraitement]   └─ Salaires personnel: ${salairesPersonnel.toLocaleString('fr-FR')}€`);
        console.log(`[EBE Retraitement]   └─ Charges sociales: ${chargesSociales.toLocaleString('fr-FR')}€`);
        console.log(`[EBE Retraitement]   └─ TOTAL masse salariale: ${masseSalarialeTotale.toLocaleString('fr-FR')}€`);

        if (masseSalarialeTotale > 0) {
          retraitements.push({
            type: 'suppression_personnel_cedant',
            description: 'Suppression Personnel Cédant',
            montant: masseSalarialeTotale,
            source: 'documentExtraction',
            justification: 'Pas de reprise de personnel - Économie totale sur charges salariales actuelles',
            commentaire: `Masse salariale supprimée: ${salairesPersonnel.toLocaleString('fr-FR')}€ (salaires) + ${chargesSociales.toLocaleString('fr-FR')}€ (charges sociales)`
          });

          console.log(`[EBE Retraitement] ✓ Retraitement personnel supprimé: +${masseSalarialeTotale.toLocaleString('fr-FR')}€`);
        } else {
          console.log(`[EBE Retraitement] ⚠️ Aucune charge de personnel détectée dans le SIG`);
        }
      } else {
        console.log(`[EBE Retraitement] ✓ Personnel conservé - pas de retraitement`);
      }

      // ========================================
      // 3. SALARIÉS NON REPRIS
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
          justification: `${userComments.salaries_non_repris.nombre} salarié(s) non conservé(s) - ${userComments.salaries_non_repris.motif || 'Départ'}`,
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
          justification: 'Coût additionnel non présent dans le bilan actuel',
          commentaire: 'Coût additionnel non présent dans le bilan actuel'
        });

        console.log(`[EBE Retraitement] ✓ Salaires saisonniers prévus: -${userComments.salaires_saisonniers_prevus.toLocaleString('fr-FR')}€`);
        console.log(`                     → Coût additionnel non présent dans bilan actuel`);
      }

      // ========================================
      // 3.5 NOUVELLE STRUCTURE RH (FROM frais_personnel_N1)
      // ========================================
      // Si le repreneur a fourni une estimation des frais personnel N+1
      // → On déduit cette nouvelle charge de l'EBE

      console.log('\n[EBE Retraitement] ────────────────────────────────');
      console.log('[EBE Retraitement] NOUVELLE STRUCTURE RH (N+1)');
      console.log('[EBE Retraitement] ────────────────────────────────');

      const fraisPersonnelN1 = userComments?.frais_personnel_N1;
      console.log(`[EBE Retraitement] Frais personnel N+1: ${fraisPersonnelN1 ? fraisPersonnelN1.toLocaleString('fr-FR') + '€/an' : 'NON RENSEIGNÉ'}`);

      if (fraisPersonnelN1 && fraisPersonnelN1 > 0) {
        // Only add this retraitement if personnel was NOT kept
        // (if personnel kept, this is a net increase; if not kept, it's the new structure cost)

        const isSuppression = userComments?.reprise_salaries === false;
        const description = isSuppression
          ? 'Nouvelle Structure RH'
          : 'Ajustement Frais Personnel N+1';

        const justification = isSuppression
          ? '1 TNS + 1 SMIC + 1 Saisonnier (nouvelle organisation)'
          : 'Ajustement prévisionnel charges de personnel';

        retraitements.push({
          type: 'nouvelle_structure_rh',
          description,
          montant: -fraisPersonnelN1, // Negative because it's a new cost
          source: 'userComments',
          justification,
          commentaire: `Estimation repreneur: ${fraisPersonnelN1.toLocaleString('fr-FR')}€/an (charges patronales incluses)`
        });

        console.log(`[EBE Retraitement] ✓ Nouvelle structure RH: -${fraisPersonnelN1.toLocaleString('fr-FR')}€/an`);
      }

      // ========================================
      // 4. ÉCONOMIE DE LOYER (RENÉGOCIATION)
      // ========================================

      // Si le loyer a été renégocié à la baisse
      // → On ajoute l'économie réalisée

      console.log('\n[EBE Retraitement] ────────────────────────────────');
      console.log('[EBE Retraitement] ANALYSE LOYER');
      console.log('[EBE Retraitement] ────────────────────────────────');

      let loyerRetraitementAjoute = false;

      // PRIORITY 1: Structured fields (loyer_actuel, loyer_negocie)
      const loyerActuel = userComments?.loyer?.loyer_actuel || userComments?.loyer?.loyer_actuel_mensuel;
      const loyerNegocie = userComments?.loyer?.loyer_negocie ||
                           userComments?.loyer?.loyer_futur_mensuel ||
                           userComments?.loyer?.futur_loyer_commercial;

      console.log(`[EBE Retraitement] Loyer actuel: ${loyerActuel ? loyerActuel.toLocaleString('fr-FR') + '€/mois' : 'NON RENSEIGNÉ'}`);
      console.log(`[EBE Retraitement] Loyer négocié: ${loyerNegocie ? loyerNegocie.toLocaleString('fr-FR') + '€/mois' : 'NON RENSEIGNÉ'}`);

      if (loyerActuel && loyerNegocie && loyerNegocie < loyerActuel) {
        const economieAnnuelle = (loyerActuel - loyerNegocie) * 12;

        retraitements.push({
          type: 'normalisation_loyer',
          description: 'Normalisation Loyer',
          montant: economieAnnuelle,
          source: 'userComments',
          justification: `Passage de ${loyerActuel.toLocaleString('fr-FR')}€ à ${loyerNegocie.toLocaleString('fr-FR')}€/mois`,
          commentaire: `Économie mensuelle: ${(loyerActuel - loyerNegocie).toLocaleString('fr-FR')}€ × 12 mois`
        });

        loyerRetraitementAjoute = true;
        console.log(`[EBE Retraitement] ✓ Économie loyer: +${economieAnnuelle.toLocaleString('fr-FR')}€/an`);
      }

      // Loyer logement personnel (avantage en nature)
      const loyerLogementPerso = userComments?.loyer?.loyer_logement_perso;
      if (loyerLogementPerso && loyerLogementPerso > 0) {
        const avantageAnnuel = loyerLogementPerso * 12;

        retraitements.push({
          type: 'loyer_logement',
          description: 'Loyer logement personnel (avantage en nature)',
          montant: avantageAnnuel,
          source: 'userComments',
          justification: `Économie logement gérant (${loyerLogementPerso.toLocaleString('fr-FR')}€/mois)`,
          commentaire: 'Avantage en nature du gérant inclus dans les charges actuelles'
        });

        console.log(`[EBE Retraitement] ✓ Avantage logement: +${avantageAnnuel.toLocaleString('fr-FR')}€/an`);
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
            justification: `Simulation économie loyer (probabilité ${scenarioRealiste.probabilite})`,
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
          justification: 'Charges non récurrentes à neutraliser',
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
          justification: 'Produits non récurrents à neutraliser',
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

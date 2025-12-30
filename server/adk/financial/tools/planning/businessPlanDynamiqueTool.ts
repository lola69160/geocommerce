import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';
import { isTabacCommerce } from '../../config/tabacValuationCoefficients';
import { logBusinessPlan } from '../../../utils/extractionLogger';

/**
 * Business Plan Dynamique Tool
 *
 * Génère un business plan sur 5 ans post-reprise avec les leviers de croissance :
 * - Extension horaires (ouverture matin, lundi)
 * - Travaux/modernisation (impact année 2)
 * - Réduction charges (salaires, loyer)
 * - Impact sur CA et EBE
 *
 * Permet de projeter l'évolution du business avec les changements du repreneur.
 */

const HypothesesRepreneurSchema = z.object({
  // Investissement
  prixAchat: z.number().describe('Prix d\'achat du fonds de commerce'),
  montantTravaux: z.number().optional().describe('Montant des travaux prévus'),
  subventionsEstimees: z.number().optional().describe('Subventions estimées (réduction investissement)'),
  apportPersonnel: z.number().optional().describe('Apport personnel du repreneur'),

  // Financement
  tauxEmprunt: z.number().optional().describe('Taux d\'emprunt annuel (ex: 4.5 pour 4.5%)'),
  dureeEmpruntMois: z.number().optional().describe('Durée emprunt en mois (ex: 84 pour 7 ans)'),

  // Leviers croissance CA
  extensionHoraires: z.object({
    joursSupplementaires: z.number().optional().describe('Nombre de jours/périodes supplémentaires (ex: 2 pour matin + lundi)'),
    impactEstime: z.number().optional().describe('Impact estimé sur CA en décimal (ex: 0.10 pour +10%)')
  }).optional(),

  travaux: z.object({
    impactAnnee2: z.number().optional().describe('Impact des travaux en année 2 (ex: 0.10 pour +10%)'),
    impactRecurrent: z.number().optional().describe('Croissance annuelle récurrente après (ex: 0.03 pour +3%/an)')
  }).optional(),

  // Réduction charges
  salairesSupprimes: z.number().optional().describe('Montant annuel des salaires supprimés'),
  salairesAjoutes: z.number().optional().describe('Montant annuel des salaires ajoutés'),
  loyerNegocie: z.number().optional().describe('Nouveau loyer annuel après négociation')
});

const ProjectionAnnuelleSchema = z.object({
  annee: z.number(),
  label: z.string().describe('Label de l\'année: Actuel, Reprise, Travaux, Croisière'),

  // CA décomposé (TABAC)
  ventes_marchandises: z.number().optional().describe('CA Boutique (marchandises - Tabac)'),
  commissions_services: z.number().optional().describe('CA Commissions (Tabac/Loto/Presse)'),

  // CA total
  ca: z.number(),
  ca_detail: z.object({
    ca_base: z.number(),
    impact_horaires: z.number().optional(),
    impact_travaux: z.number().optional(),
    croissance_naturelle: z.number().optional()
  }),

  // Marge Brute décomposée (TABAC)
  marge_marchandises: z.number().optional().describe('Marge sur marchandises (ex: 68%)'),
  marge_commissions: z.number().optional().describe('Marge sur commissions (100% - nettes)'),
  marge_brute_globale: z.number().optional().describe('Marge brute totale'),

  // Charges
  charges_fixes: z.number(),
  charges_detail: z.object({
    salaires: z.number(),
    loyer: z.number(),
    autres_charges: z.number()
  }),

  // EBE
  ebe_normatif: z.number(),

  // Financement
  annuite_emprunt: z.number(),
  reste_apres_dette: z.number()
});

const IndicateursBancairesSchema = z.object({
  ratioCouvertureDette: z.number().describe('EBE / Annuité (cible > 1.5)'),
  capaciteAutofinancement: z.number().describe('EBE - Impôts - Prélèvements sociaux'),
  pointMort: z.number().describe('CA minimum pour équilibre (charges fixes / taux marge)'),
  delaiRetourInvestissement: z.number().describe('En années'),
  rentabiliteCapitauxInvestis: z.number().describe('ROI en %'),

  // Détails
  investissementTotal: z.number(),
  montantEmprunte: z.number(),
  annuiteEmprunt: z.number(),

  // Interprétation
  appreciation: z.string().describe('excellent, bon, acceptable, difficile')
});

const BusinessPlanDynamiqueOutputSchema = z.object({
  projections: z.array(ProjectionAnnuelleSchema).describe('Projections sur 5 ans (Année 0 à 5)'),
  indicateursBancaires: IndicateursBancairesSchema,
  hypotheses: HypothesesRepreneurSchema.describe('Hypothèses utilisées pour le calcul'),
  synthese: z.string().describe('Synthèse du business plan'),
  recommandations: z.array(z.string()).describe('Recommandations pour optimiser le plan'),
  error: z.string().optional()
});

export const businessPlanDynamiqueTool = new FunctionTool({
  name: 'businessPlanDynamique',
  description: 'Génère un business plan sur 5 ans post-reprise avec leviers de croissance (horaires, travaux, charges). Calcule projections CA/EBE et indicateurs bancaires.',
  parameters: zToGen(HypothesesRepreneurSchema),

  execute: async (params, toolContext?: ToolContext) => {
    try {
      // ========================================
      // ÉTAPE 1: Lire les données du state
      // ========================================
      let comptable = parseState(toolContext?.state.get('comptable'));
      let valorisation = parseState(toolContext?.state.get('valorisation'));
      let immobilier = parseState(toolContext?.state.get('immobilier'));
      let userComments = parseState(toolContext?.state.get('userComments'));
      let businessInfo = parseState(toolContext?.state.get('businessInfo'));

      if (!comptable?.sig || !comptable?.yearsAnalyzed || comptable.yearsAnalyzed.length === 0) {
        return {
          projections: [],
          indicateursBancaires: createEmptyIndicateurs(),
          hypotheses: params,
          synthese: 'Erreur: Données comptables manquantes',
          recommandations: [],
          error: 'Missing SIG data'
        };
      }

      const { sig, yearsAnalyzed } = comptable;
      const lastYear = yearsAnalyzed[0];
      const lastYearStr = lastYear.toString();

      // ========================================
      // ÉTAPE 2: Récupérer les données actuelles (EXTRACTION STRICTE)
      // ⚠️ (2025-12-29): Les données historiques proviennent de comptable.sig
      // qui contient UNIQUEMENT les valeurs extraites des documents comptables.
      // Aucun recalcul n'est effectué sur ces données historiques.
      // ========================================

      // CA actuel (moyenne 3 ans ou dernière année)
      // ✅ FIX (2025-12-29): Extraire .valeur car SIG retourne {valeur, pct_ca}
      let caActuel = 0;
      if (yearsAnalyzed.length >= 3) {
        const caValues = yearsAnalyzed.slice(0, 3).map((year: number) => {
          const caData = sig[year.toString()]?.chiffre_affaires;
          return typeof caData === 'object' ? caData?.valeur || 0 : caData || 0;
        });
        caActuel = Math.round(caValues.reduce((a: number, b: number) => a + b, 0) / caValues.length);
      } else {
        const caData = sig[lastYearStr]?.chiffre_affaires;
        caActuel = typeof caData === 'object' ? caData?.valeur || 0 : caData || 0;
      }

      // Charges actuelles
      // ✅ FIX (2025-12-29): charges_personnel = salaires + charges_sociales + charges_exploitant
      const chargesPersonnelActuel =
        (typeof sig[lastYearStr]?.salaires_personnel === 'object'
          ? sig[lastYearStr]?.salaires_personnel?.valeur || 0
          : sig[lastYearStr]?.salaires_personnel || 0) +
        (typeof sig[lastYearStr]?.charges_sociales_personnel === 'object'
          ? sig[lastYearStr]?.charges_sociales_personnel?.valeur || 0
          : sig[lastYearStr]?.charges_sociales_personnel || 0) +
        (typeof sig[lastYearStr]?.charges_exploitant === 'object'
          ? sig[lastYearStr]?.charges_exploitant?.valeur || 0
          : sig[lastYearStr]?.charges_exploitant || 0);
      // ✅ FIX (2025-12-29): charges_externes = autres_achats_charges_externes
      const chargesExternesData = sig[lastYearStr]?.autres_achats_charges_externes;
      const chargesExternesActuel = typeof chargesExternesData === 'object'
        ? chargesExternesData?.valeur || 0
        : chargesExternesData || 0;

      // Loyer actuel - PRIORITÉ: simulationLoyer > bail > userComments
      // ✅ FIX (2025-12-29): Utiliser simulationLoyer qui intègre userComments en priorité
      let loyer_actuel = immobilier?.simulationLoyer?.loyerActuel?.annuel || immobilier?.bail?.loyer_annuel_hc || 0;
      if (loyer_actuel === 0 && userComments?.loyer) {
        // Fallback: userComments avec conversion mensuel → annuel
        const loyerMensuel = userComments.loyer.loyer_actuel_mensuel ||
                             userComments.loyer.futur_loyer_commercial || 0;
        loyer_actuel = loyerMensuel * 12;
        console.log(`[businessPlanDynamique] 📋 Loyer récupéré depuis userComments: ${loyerMensuel}€/mois → ${loyer_actuel}€/an`);
      }

      // EBE actuel (normatif si disponible, sinon comptable)
      // ✅ FIX (2025-12-29): Extraire .valeur car SIG retourne {valeur, pct_ca}
      let ebeActuel = 0;
      if (comptable.ebeRetraitement?.ebe_normatif) {
        ebeActuel = comptable.ebeRetraitement.ebe_normatif;
      } else {
        const ebeData = sig[lastYearStr]?.ebe;
        ebeActuel = typeof ebeData === 'object' ? ebeData?.valeur || 0 : ebeData || 0;
      }

      // ========================================
      // ÉTAPE 2b: Extraction split CA (SANS condition Tabac)
      // ========================================

      // Détecter si commerce de type Tabac (NAF 47.26Z) - pour affichage spécifique seulement
      const isTabac = businessInfo?.nafCode ? isTabacCommerce(businessInfo.nafCode) : false;

      // ✅ Extraire TOUS les champs sans condition (disponibles pour tous les commerces)
      // Ventes Marchandises (format: { valeur, pct_ca })
      const ventesMarchandisesData = sig[lastYearStr]?.ventes_marchandises;
      const ventesMarchandises = typeof ventesMarchandisesData === 'object'
        ? ventesMarchandisesData?.valeur || 0
        : ventesMarchandisesData || 0;

      // Production vendue services = Commissions (tabac/loto/presse) ou services
      const productionServicesData = sig[lastYearStr]?.production_vendue_services;
      const commissionsServices = typeof productionServicesData === 'object'
        ? productionServicesData?.valeur || 0
        : productionServicesData || 0;

      // Marge commerciale pour calcul taux marge
      const margeCommercialeData = sig[lastYearStr]?.marge_commerciale;
      const margeCommerciale = typeof margeCommercialeData === 'object'
        ? margeCommercialeData?.valeur || 0
        : margeCommercialeData || 0;

      // Taux de marge boutique
      let tauxMargeBoutique = 0.68; // Fallback 68%
      if (ventesMarchandises > 0 && margeCommerciale > 0) {
        tauxMargeBoutique = margeCommerciale / ventesMarchandises;
      }

      // Log toujours (pas de condition)
      console.log(`[businessPlanDynamique] 📊 Données extraites du SIG (${lastYearStr}):`);
      console.log(`  - CA Total: ${caActuel.toLocaleString('fr-FR')} €`);
      console.log(`  - Ventes Marchandises: ${ventesMarchandises.toLocaleString('fr-FR')} €`);
      console.log(`  - Commissions/Services: ${commissionsServices.toLocaleString('fr-FR')} €`);
      console.log(`  - Charges Personnel: ${chargesPersonnelActuel.toLocaleString('fr-FR')} €`);
      console.log(`  - Taux marge boutique: ${(tauxMargeBoutique*100).toFixed(1)}%`);
      if (isTabac) {
        console.log(`  - 🚬 Commerce TABAC détecté (NAF: ${businessInfo?.nafCode})`);
      }

      // ========================================
      // ÉTAPE 3: Calculer l'investissement total
      // ========================================

      const prixAchat = params.prixAchat || valorisation?.synthese?.valeur_recommandee || 0;
      const montantTravaux = params.montantTravaux || immobilier?.travaux?.budget_total?.obligatoire_haut || 0;
      const subventions = params.subventionsEstimees || 0;
      const apportPersonnel = params.apportPersonnel || Math.round((prixAchat + montantTravaux) * 0.3); // 30% par défaut

      const investissementTotal = prixAchat + montantTravaux - subventions;
      const montantEmprunte = investissementTotal - apportPersonnel;

      // ========================================
      // ÉTAPE 4: Calculer l'annuité d'emprunt
      // ========================================

      const tauxEmprunt = (params.tauxEmprunt || 4.5) / 100; // Convertir en décimal
      const dureeEmpruntMois = params.dureeEmpruntMois || 84; // 7 ans par défaut

      let annuiteEmprunt = 0;
      if (montantEmprunte > 0 && tauxEmprunt > 0 && dureeEmpruntMois > 0) {
        const tauxMensuel = tauxEmprunt / 12;
        const mensualite = (montantEmprunte * tauxMensuel) / (1 - Math.pow(1 + tauxMensuel, -dureeEmpruntMois));
        annuiteEmprunt = Math.round(mensualite * 12);
      }

      // ========================================
      // ÉTAPE 5: Calculer les nouvelles charges
      // ========================================

      // ✅ FIX (2025-12-30): Priorité à userComments.frais_personnel_N1
      const salairesSupprimes = params.salairesSupprimes || 0;
      const salairesAjoutes = params.salairesAjoutes || 0;
      const nouveauSalaires = userComments?.frais_personnel_N1
        || (chargesPersonnelActuel - salairesSupprimes + salairesAjoutes);

      console.log(`[businessPlanDynamique] 💼 Frais personnel N+1: ${nouveauSalaires.toLocaleString('fr-FR')} €`);
      if (userComments?.frais_personnel_N1) {
        console.log(`   ✅ Source: userComments.frais_personnel_N1`);
      } else {
        console.log(`   ℹ️ Source: calcul actuel (${chargesPersonnelActuel.toLocaleString('fr-FR')} € - ${salairesSupprimes.toLocaleString('fr-FR')} € + ${salairesAjoutes.toLocaleString('fr-FR')} €)`);
      }

      // Loyer négocié avec priorités claires
      let loyerNegocie = loyer_actuel; // Par défaut = actuel

      // Priorité 1: Paramètre explicite (valeur annuelle)
      if (params.loyerNegocie && params.loyerNegocie > 0) {
        loyerNegocie = params.loyerNegocie;
        console.log(`[businessPlanDynamique] 💰 Loyer négocié (paramètre): ${loyerNegocie}€/an`);
      }
      // Priorité 2: userComments (valeur mensuelle × 12)
      else if (userComments?.loyer?.futur_loyer_commercial) {
        loyerNegocie = userComments.loyer.futur_loyer_commercial * 12;
        console.log(`[businessPlanDynamique] 💰 Loyer négocié (userComments): ${userComments.loyer.futur_loyer_commercial}€/mois → ${loyerNegocie}€/an`);
      }
      // Priorité 3: Simulation immobilier
      else if (immobilier?.simulationLoyer?.scenarios?.realiste?.nouveauLoyerAnnuel) {
        loyerNegocie = immobilier.simulationLoyer.scenarios.realiste.nouveauLoyerAnnuel;
        console.log(`[businessPlanDynamique] 💰 Loyer négocié (simulation): ${loyerNegocie}€/an`);
      }

      // Autres charges (estimées à partir des charges externes moins le loyer)
      const autresCharges = Math.max(0, chargesExternesActuel - loyer_actuel);

      // ========================================
      // ÉTAPE 6: Générer les projections sur 5 ans
      // ========================================

      const projections: any[] = [];

      // Année 0: Actuel
      const chargesFixesAnnee0 = chargesPersonnelActuel + loyer_actuel + autresCharges;

      // ✅ Calcul Marge Brute SANS CONDITION (disponible pour tous les commerces)
      const margeMarchandisesAnnee0 = Math.round(ventesMarchandises * tauxMargeBoutique);
      const margeCommissionsAnnee0 = commissionsServices; // 100% sur commissions
      const margeBruteGlobaleAnnee0 = margeMarchandisesAnnee0 + margeCommissionsAnnee0;

      projections.push({
        annee: 0,
        label: 'Actuel (Cédant)',
        // ✅ CA décomposé TOUJOURS inclus (pas de condition isTabac)
        ventes_marchandises: ventesMarchandises,
        commissions_services: commissionsServices,
        ca: caActuel,
        ca_detail: {
          ca_base: caActuel,
          impact_horaires: 0,
          impact_travaux: 0,
          croissance_naturelle: 0
        },
        // ✅ Marge Brute décomposée TOUJOURS incluse (pas de condition isTabac)
        marge_marchandises: margeMarchandisesAnnee0,
        marge_commissions: margeCommissionsAnnee0,
        marge_brute_globale: margeBruteGlobaleAnnee0,
        charges_fixes: chargesFixesAnnee0,
        charges_detail: {
          salaires: chargesPersonnelActuel,
          loyer: loyer_actuel,
          autres_charges: autresCharges
        },
        ebe_normatif: ebeActuel,
        annuite_emprunt: 0,
        reste_apres_dette: ebeActuel
      });

      // Paramètres de croissance
      const impactHoraires = params.extensionHoraires?.impactEstime || 0.10; // 10% par défaut
      const impactTravauxBase = params.travaux?.impactAnnee2 || 0.10; // 10% par défaut - appliqué dès année 1
      const croissanceRecurrente = params.travaux?.impactRecurrent || 0.03; // 3% par défaut

      // ========================================
      // Impact travaux différencié pour TABAC
      // ========================================
      // Pour un Tabac: +0% sur commissions (habitude), +15% sur boutique (impulsion)
      // Pour les autres commerces: impact uniforme sur tout le CA

      let impactTravauxEffectif = impactTravauxBase;
      let tabacImpactDetail: { commissions: number; boutique: number; effectif: number } | null = null;

      if (isTabac && ventesMarchandises > 0 && caActuel > 0) {
        // Tabac: impacts différenciés
        const impactTravauxCommissions = 0.00; // Pas d'impact sur les commissions (habitude)
        const impactTravauxBoutique = 0.15;    // +15% sur ventes boutique (impulsion)

        // Calculer les poids de chaque activité
        const poidsCommissions = commissionsServices / caActuel;
        const poidsBoutique = ventesMarchandises / caActuel;

        // Impact pondéré sur le CA total
        impactTravauxEffectif = (impactTravauxCommissions * poidsCommissions) + (impactTravauxBoutique * poidsBoutique);

        tabacImpactDetail = {
          commissions: impactTravauxCommissions,
          boutique: impactTravauxBoutique,
          effectif: impactTravauxEffectif
        };

        console.log(`[businessPlanDynamique] 🔧 Impact travaux TABAC (différencié):`);
        console.log(`  - Commissions (${(poidsCommissions*100).toFixed(1)}% du CA): +${(impactTravauxCommissions*100).toFixed(0)}%`);
        console.log(`  - Boutique (${(poidsBoutique*100).toFixed(1)}% du CA): +${(impactTravauxBoutique*100).toFixed(0)}%`);
        console.log(`  - Impact effectif pondéré: +${(impactTravauxEffectif*100).toFixed(1)}%`);
      }

      // Années 1 à 5 - Croissance différenciée pour TABAC
      // Variables pour suivi progression Tabac
      let prevVentesMarchandises = ventesMarchandises;
      let prevCommissionsServices = commissionsServices;

      for (let i = 1; i <= 5; i++) {
        let label = '';
        if (i === 1) label = 'Reprise + Travaux';
        else if (i === 2) label = 'Consolidation';
        else label = 'Croisière';

        // ========================================
        // Calcul CA - Logique différenciée TABAC
        // ========================================
        let ca_base = caActuel;
        let impact_horaires_value = 0;
        let impact_travaux_value = 0;
        let croissance_naturelle_value = 0;

        // ✅ Variables CA décomposé TOUJOURS calculées (pas de condition isTabac)
        let ventesMarchandisesAnnee = 0;
        let commissionsServicesAnnee = 0;

        // ✅ Calcul différencié pour TOUS les commerces (avec ou sans données boutique/commissions)
        if (ventesMarchandises > 0 || commissionsServices > 0) {
          // ========================================
          // Croissance différenciée sur composantes CA
          // ========================================

          // Année 1: Impact horaires sur les deux + Impact travaux sur boutique uniquement
          if (i === 1) {
            // Horaires: impact sur les deux (+10% par défaut)
            ventesMarchandisesAnnee = ventesMarchandises * (1 + impactHoraires);
            commissionsServicesAnnee = commissionsServices * (1 + impactHoraires);

            // Travaux: +15% sur boutique uniquement (si tabacImpactDetail disponible)
            if (tabacImpactDetail) {
              ventesMarchandisesAnnee = ventesMarchandisesAnnee * (1 + tabacImpactDetail.boutique);
              impact_travaux_value = ventesMarchandises * tabacImpactDetail.boutique;
            } else {
              // Commerce standard: impact travaux uniforme
              ventesMarchandisesAnnee = ventesMarchandisesAnnee * (1 + impactTravauxEffectif);
              commissionsServicesAnnee = commissionsServicesAnnee * (1 + impactTravauxEffectif);
              impact_travaux_value = caActuel * impactTravauxEffectif;
            }

            impact_horaires_value = (ventesMarchandises + commissionsServices) * impactHoraires;
          }
          // Années 2-5: Croissance naturelle différenciée
          else {
            // Boutique: +3%/an
            ventesMarchandisesAnnee = prevVentesMarchandises * (1 + croissanceRecurrente);
            // Commissions: plafonné à +2%/an (marché mature) pour Tabac, sinon croissance normale
            const croissanceCommissions = isTabac ? Math.min(0.02, croissanceRecurrente) : croissanceRecurrente;
            commissionsServicesAnnee = prevCommissionsServices * (1 + croissanceCommissions);

            croissance_naturelle_value = (ventesMarchandisesAnnee - prevVentesMarchandises) + (commissionsServicesAnnee - prevCommissionsServices);
          }

          ca_base = Math.round(ventesMarchandisesAnnee + commissionsServicesAnnee);
          prevVentesMarchandises = ventesMarchandisesAnnee;
          prevCommissionsServices = commissionsServicesAnnee;

        } else {
          // ========================================
          // Fallback: Commerce sans détail boutique/commissions
          // ========================================

          // Impact horaires (dès année 1)
          if (i >= 1) {
            impact_horaires_value = caActuel * impactHoraires;
            ca_base += impact_horaires_value;
          }

          // Impact travaux (dès année 1)
          if (i >= 1) {
            impact_travaux_value = caActuel * impactTravauxEffectif;
            ca_base += impact_travaux_value;
          }

          // Croissance récurrente (années 2-5)
          if (i >= 2) {
            croissance_naturelle_value = projections[i - 1].ca * croissanceRecurrente;
            ca_base = projections[i - 1].ca + croissance_naturelle_value;
          }
        }

        const ca = Math.round(ca_base);

        // ========================================
        // ✅ Calcul Marge Brute SANS CONDITION (disponible pour tous les commerces)
        // ========================================
        const margeMarchandisesAnnee = Math.round(ventesMarchandisesAnnee * tauxMargeBoutique);
        const margeCommissionsAnnee = Math.round(commissionsServicesAnnee); // 100%
        const margeBruteGlobaleAnnee = margeMarchandisesAnnee + margeCommissionsAnnee;

        // ========================================
        // Calcul charges et EBE
        // ========================================
        const charges_fixes = nouveauSalaires + loyerNegocie + autresCharges;

        // EBE = Marge Brute Globale - Charges Fixes (si marge disponible)
        // Sinon EBE = CA - Charges Fixes (approximation)
        const ebe_normatif = margeBruteGlobaleAnnee > 0
          ? margeBruteGlobaleAnnee - charges_fixes
          : ca - charges_fixes;

        // Reste après dette
        const reste_apres_dette = ebe_normatif - annuiteEmprunt;

        projections.push({
          annee: i,
          label: `Année ${i} (${label})`,
          // ✅ CA décomposé TOUJOURS inclus (pas de condition isTabac)
          ventes_marchandises: Math.round(ventesMarchandisesAnnee),
          commissions_services: Math.round(commissionsServicesAnnee),
          ca,
          ca_detail: {
            ca_base: i === 1 ? caActuel : projections[i - 1].ca,
            impact_horaires: i === 1 ? impact_horaires_value : 0,
            impact_travaux: i === 1 ? impact_travaux_value : 0,
            croissance_naturelle: i >= 2 ? croissance_naturelle_value : 0,
            // Détail spécifique Tabac (si disponible)
            ...(tabacImpactDetail && i >= 1 && {
              tabac_detail: {
                impact_travaux_commissions: 0,
                impact_travaux_boutique: i === 1 ? Math.round(ventesMarchandises * tabacImpactDetail.boutique) : 0,
                poids_commissions: caActuel > 0 ? Math.round((commissionsServices / caActuel) * 100) : 0,
                poids_boutique: caActuel > 0 ? Math.round((ventesMarchandises / caActuel) * 100) : 0
              }
            })
          },
          // ✅ Marge Brute décomposée TOUJOURS incluse (pas de condition isTabac)
          marge_marchandises: margeMarchandisesAnnee,
          marge_commissions: margeCommissionsAnnee,
          marge_brute_globale: margeBruteGlobaleAnnee,
          charges_fixes,
          charges_detail: {
            salaires: nouveauSalaires,
            loyer: loyerNegocie,
            autres_charges: autresCharges
          },
          ebe_normatif,
          annuite_emprunt: annuiteEmprunt,
          reste_apres_dette
        });
      }

      // ========================================
      // ÉTAPE 7: Calculer les indicateurs bancaires
      // ========================================

      // Utiliser EBE de l'année 1 (première année complète)
      const ebeAnnee1 = projections[1].ebe_normatif;

      // 1. Ratio de couverture de la dette
      const ratioCouvertureDette = annuiteEmprunt > 0 ? parseFloat((ebeAnnee1 / annuiteEmprunt).toFixed(2)) : 0;

      // 2. Capacité d'autofinancement (EBE - Impôts 25% - Prélèvements sociaux 15%)
      const tauxImposition = 0.25;
      const tauxPrelevements = 0.15;
      const capaciteAutofinancement = Math.round(ebeAnnee1 * (1 - tauxImposition - tauxPrelevements));

      // 3. Point mort (CA minimum pour équilibre)
      const margeVariable = ebeAnnee1 / projections[1].ca; // Taux de marge sur CA
      const pointMort = margeVariable > 0 ? Math.round(projections[1].charges_fixes / margeVariable) : 0;

      // 4. Délai de retour sur investissement
      const moyenneResteApresDetteAnnees2a5 = (projections[2].reste_apres_dette + projections[3].reste_apres_dette + projections[4].reste_apres_dette + projections[5].reste_apres_dette) / 4;
      const delaiRetourInvestissement = apportPersonnel > 0 && moyenneResteApresDetteAnnees2a5 > 0
        ? parseFloat((apportPersonnel / moyenneResteApresDetteAnnees2a5).toFixed(1))
        : 0;

      // 5. Rentabilité des capitaux investis (ROI)
      const rentabiliteCapitauxInvestis = apportPersonnel > 0
        ? parseFloat(((moyenneResteApresDetteAnnees2a5 / apportPersonnel) * 100).toFixed(1))
        : 0;

      // Appréciation globale
      let appreciation = 'difficile';
      if (ratioCouvertureDette >= 2.0 && rentabiliteCapitauxInvestis >= 25) {
        appreciation = 'excellent';
      } else if (ratioCouvertureDette >= 1.5 && rentabiliteCapitauxInvestis >= 15) {
        appreciation = 'bon';
      } else if (ratioCouvertureDette >= 1.2 && rentabiliteCapitauxInvestis >= 10) {
        appreciation = 'acceptable';
      }

      const indicateursBancaires = {
        ratioCouvertureDette,
        capaciteAutofinancement,
        pointMort,
        delaiRetourInvestissement,
        rentabiliteCapitauxInvestis,
        investissementTotal,
        montantEmprunte,
        annuiteEmprunt,
        appreciation
      };

      // ========================================
      // ÉTAPE 8: Générer synthèse et recommandations
      // ========================================

      const synthese = genererSynthese(projections, indicateursBancaires, params);
      const recommandations = genererRecommandations(projections, indicateursBancaires, params);

      // ✅ Calculate projected health score for year N+1
      const projectedHealthScore = projections[1]
        ? calculateProjectedHealthScore(projections[1], comptable)
        : null;

      const result = {
        projections,
        indicateursBancaires,
        hypotheses: params,
        synthese,
        recommandations,
        projectedHealthScore, // ✅ ADD
        // Métadonnées Tabac (si applicable)
        ...(isTabac && tabacImpactDetail && {
          tabacInfo: {
            isTabac: true,
            nafCode: businessInfo?.nafCode,
            splitCA: {
              commissions: commissionsServices,
              boutique: ventesMarchandises,
              poidsCommissions: Math.round((commissionsServices / caActuel) * 100),
              poidsBoutique: Math.round((ventesMarchandises / caActuel) * 100)
            },
            impactTravaux: {
              commissions: tabacImpactDetail.commissions,
              boutique: tabacImpactDetail.boutique,
              effectif: tabacImpactDetail.effectif
            }
          }
        })
      };

      // Injecter dans le state pour que generateFinancialHtmlTool puisse le lire
      if (toolContext?.state) {
        toolContext.state.set('businessPlan', result);
        console.log('[businessPlanDynamique] ✅ Business plan injected into state');
      }

      // Log to extraction log
      const siret = businessInfo?.siret || 'unknown';
      logBusinessPlan(siret, {
        projections: projections.map((p: any) => ({
          annee: p.annee,
          label: p.label,
          ca: p.ca,
          ebe_normatif: p.ebe_normatif,
          charges_fixes: p.charges_fixes,
          annuite_emprunt: p.annuite_emprunt,
          reste_apres_dette: p.reste_apres_dette
        })),
        indicateursBancaires,
        hypotheses: {
          prixAchat,
          montantTravaux,
          apportPersonnel,
          loyerNegocie
        },
        isTabac
      });

      return result;

    } catch (error: any) {
      return {
        projections: [],
        indicateursBancaires: createEmptyIndicateurs(),
        hypotheses: params,
        synthese: 'Erreur lors du calcul du business plan',
        recommandations: [],
        error: error.message || 'Business plan calculation failed'
      };
    }
  }
});

/**
 * Parse state helper
 */
function parseState(state: any): any {
  if (typeof state === 'string') {
    try {
      return JSON.parse(state);
    } catch (e) {
      return null;
    }
  }
  return state;
}

/**
 * Créer indicateurs bancaires vides
 */
function createEmptyIndicateurs(): any {
  return {
    ratioCouvertureDette: 0,
    capaciteAutofinancement: 0,
    pointMort: 0,
    delaiRetourInvestissement: 0,
    rentabiliteCapitauxInvestis: 0,
    investissementTotal: 0,
    montantEmprunte: 0,
    annuiteEmprunt: 0,
    appreciation: 'erreur'
  };
}

/**
 * Générer synthèse du business plan
 */
function genererSynthese(projections: any[], indicateurs: any, hypotheses: any): string {
  const annee1 = projections[1];
  const annee5 = projections[5];

  const croissanceCA = annee1 && annee5 ? Math.round(((annee5.ca - annee1.ca) / annee1.ca) * 100) : 0;
  const croissanceEBE = annee1 && annee5 ? Math.round(((annee5.ebe_normatif - annee1.ebe_normatif) / annee1.ebe_normatif) * 100) : 0;

  let synthese = `Sur 5 ans, le business plan projette une croissance de ${croissanceCA}% du CA (${annee1?.ca.toLocaleString('fr-FR')} € → ${annee5?.ca.toLocaleString('fr-FR')} €) `;
  synthese += `et ${croissanceEBE}% de l'EBE (${annee1?.ebe_normatif.toLocaleString('fr-FR')} € → ${annee5?.ebe_normatif.toLocaleString('fr-FR')} €). `;

  synthese += `\n\nLes indicateurs bancaires montrent un profil "${indicateurs.appreciation}" : `;
  synthese += `ratio de couverture de ${indicateurs.ratioCouvertureDette}x (cible > 1.5), `;
  synthese += `ROI de ${indicateurs.rentabiliteCapitauxInvestis}% sur capitaux investis, `;
  synthese += `et un délai de retour sur investissement de ${indicateurs.delaiRetourInvestissement} ans.`;

  return synthese;
}

/**
 * Générer recommandations pour optimiser le plan
 */
function genererRecommandations(projections: any[], indicateurs: any, hypotheses: any): string[] {
  const recommandations: string[] = [];

  // Ratio de couverture
  if (indicateurs.ratioCouvertureDette < 1.2) {
    recommandations.push('⚠️ Ratio de couverture trop faible (< 1.2x). Envisager d\'augmenter l\'apport ou de réduire le prix d\'achat.');
  } else if (indicateurs.ratioCouvertureDette < 1.5) {
    recommandations.push('📊 Ratio de couverture acceptable mais juste (1.2-1.5x). Négocier le prix ou le loyer pour sécuriser le financement.');
  } else if (indicateurs.ratioCouvertureDette >= 2.0) {
    recommandations.push('✅ Excellent ratio de couverture (≥ 2.0x). Le dossier bancaire est très solide.');
  }

  // ROI
  if (indicateurs.rentabiliteCapitauxInvestis < 10) {
    recommandations.push('⚠️ Rentabilité faible (< 10%). Revoir les leviers de croissance ou réduire l\'investissement.');
  } else if (indicateurs.rentabiliteCapitauxInvestis >= 25) {
    recommandations.push('✅ Excellente rentabilité (≥ 25%). L\'investissement est très attractif.');
  }

  // Délai de retour
  if (indicateurs.delaiRetourInvestissement > 7) {
    recommandations.push('⚠️ Délai de retour long (> 7 ans). Envisager d\'augmenter les marges ou réduire les charges.');
  } else if (indicateurs.delaiRetourInvestissement <= 4) {
    recommandations.push('✅ Délai de retour rapide (≤ 4 ans). Investissement rentable rapidement.');
  }

  // Point mort
  const annee1 = projections[1];
  const tauxPointMort = annee1 ? (indicateurs.pointMort / annee1.ca) * 100 : 0;
  if (tauxPointMort > 90) {
    recommandations.push('⚠️ Point mort élevé (> 90% du CA). Marge de sécurité faible en cas de baisse d\'activité.');
  } else if (tauxPointMort < 70) {
    recommandations.push('✅ Point mort confortable (< 70% du CA). Bonne marge de sécurité.');
  }

  // Leviers de croissance
  if (hypotheses.extensionHoraires?.impactEstime && hypotheses.extensionHoraires.impactEstime < 0.05) {
    recommandations.push('💡 Impact horaires faible (< 5%). Envisager une extension plus ambitieuse (matin + soir + lundi).');
  }

  if (hypotheses.travaux?.impactAnnee2 && hypotheses.travaux.impactAnnee2 < 0.05) {
    recommandations.push('💡 Impact travaux faible (< 5%). Les travaux devraient apporter une vraie modernisation visible.');
  }

  // Charges
  if (hypotheses.salairesSupprimes && hypotheses.salairesSupprimes === 0) {
    recommandations.push('💡 Aucune optimisation salariale prévue. Analyser si certains postes peuvent être supprimés ou externalisés.');
  }

  if (!recommandations || recommandations.length === 0) {
    recommandations.push('✅ Le business plan est équilibré. Suivre les hypothèses pour atteindre les projections.');
  }

  return recommandations;
}

// ============================================================================
// PROJECTED HEALTH SCORE CALCULATION (for year N+1)
// ============================================================================

/**
 * Calculate projected health score for year N+1
 * Uses same logic as calculateHealthScoreTool but with projected data
 */
function calculateProjectedHealthScore(projection: any, comptable: any): any {
  // Extract year N+1 projection data
  const ca = projection.ca || 0;
  const ebe = projection.ebe_normatif || 0;
  const margeBrute = projection.marge_brute_globale || (ca * 0.68);
  const rn = ebe * 0.6; // Estimate (60% of EBE)

  // Calculate projected ratios
  const ratios = {
    marge_brute_pct: ca > 0 ? (margeBrute / ca) * 100 : 0,
    marge_ebe_pct: ca > 0 ? (ebe / ca) * 100 : 0,
    marge_nette_pct: ca > 0 ? (rn / ca) * 100 : 0,

    // Use current BFR/délais (assume no change)
    bfr_jours_ca: comptable?.ratios?.bfr_jours_ca || 0,
    delai_clients_jours: comptable?.ratios?.delai_clients_jours || 0,
    delai_fournisseurs_jours: comptable?.ratios?.delai_fournisseurs_jours || 0,
    rotation_stocks_jours: comptable?.ratios?.rotation_stocks_jours || 0,

    // Assume no debt for projection (conservative)
    taux_endettement_pct: 0,
    capacite_autofinancement: ebe * 0.6
  };

  // Calculate evolution (compare N+1 to current)
  const yearsAnalyzed = comptable?.yearsAnalyzed || Object.keys(comptable?.sig || {});
  const currentYear = yearsAnalyzed?.[0];
  const currentCA = comptable?.sig?.[currentYear]?.chiffre_affaires?.valeur || ca;
  const currentEBE = comptable?.sig?.[currentYear]?.ebe?.valeur || ebe;

  const evolution = {
    tendance: ca > currentCA ? 'croissance' : (ca < currentCA * 0.95 ? 'declin' : 'stable'),
    ca_evolution_pct: currentCA > 0 ? ((ca - currentCA) / currentCA) * 100 : 0,
    ebe_evolution_pct: currentEBE > 0 ? ((ebe - currentEBE) / currentEBE) * 100 : 0
  };

  // Use same scoring logic as calculateHealthScoreTool
  const scoreRentabilite = calculateRentabiliteScoreProjected(ratios);
  const scoreLiquidite = calculateLiquiditeScoreProjected(ratios);
  const scoreSolvabilite = calculateSolvabiliteScoreProjected(ratios);
  const scoreActivite = calculateActiviteScoreProjected(evolution);

  const overall = Math.round(
    scoreRentabilite * 0.30 + scoreLiquidite * 0.25 +
    scoreSolvabilite * 0.25 + scoreActivite * 0.20
  );

  let interpretation = '';
  if (overall >= 80) interpretation = 'Excellente santé financière projetée';
  else if (overall >= 60) interpretation = 'Bonne santé financière projetée';
  else if (overall >= 40) interpretation = 'Santé financière moyenne projetée';
  else if (overall >= 20) interpretation = 'Santé financière fragile projetée';
  else interpretation = 'Situation financière critique projetée';

  return {
    overall,
    breakdown: {
      rentabilite: Math.round(scoreRentabilite),
      liquidite: Math.round(scoreLiquidite),
      solvabilite: Math.round(scoreSolvabilite),
      activite: Math.round(scoreActivite)
    },
    interpretation,
    ratios
  };
}

function calculateRentabiliteScoreProjected(ratios: any): number {
  let score = 0;
  if (ratios.marge_ebe_pct >= 15) score += 40;
  else if (ratios.marge_ebe_pct >= 10) score += 30;
  else if (ratios.marge_ebe_pct >= 5) score += 20;
  else if (ratios.marge_ebe_pct >= 0) score += 10;

  if (ratios.marge_nette_pct >= 8) score += 40;
  else if (ratios.marge_nette_pct >= 5) score += 30;
  else if (ratios.marge_nette_pct >= 2) score += 20;
  else if (ratios.marge_nette_pct >= 0) score += 10;

  if (ratios.marge_brute_pct >= 50) score += 20;
  else if (ratios.marge_brute_pct >= 30) score += 15;
  else if (ratios.marge_brute_pct >= 15) score += 10;
  else if (ratios.marge_brute_pct >= 0) score += 5;

  return Math.min(score, 100);
}

function calculateLiquiditeScoreProjected(ratios: any): number {
  let score = 50;
  if (ratios.bfr_jours_ca < 0) score += 30;
  else if (ratios.bfr_jours_ca < 30) score += 20;
  else if (ratios.bfr_jours_ca < 60) score += 10;
  else score -= 10;

  if (ratios.delai_clients_jours > 0) {
    if (ratios.delai_clients_jours <= 30) score += 20;
    else if (ratios.delai_clients_jours <= 60) score += 10;
    else score -= 10;
  }

  if (ratios.delai_fournisseurs_jours > 0) {
    if (ratios.delai_fournisseurs_jours >= 60) score += 20;
    else if (ratios.delai_fournisseurs_jours >= 45) score += 15;
    else if (ratios.delai_fournisseurs_jours >= 30) score += 10;
  }

  if (ratios.rotation_stocks_jours > 0) {
    if (ratios.rotation_stocks_jours <= 30) score += 10;
    else if (ratios.rotation_stocks_jours <= 60) score += 5;
  }

  return Math.max(0, Math.min(score, 100));
}

function calculateSolvabiliteScoreProjected(ratios: any): number {
  let score = 50;
  if (ratios.taux_endettement_pct <= 50) score += 40;
  else if (ratios.taux_endettement_pct <= 100) score += 30;
  else if (ratios.taux_endettement_pct <= 150) score += 15;
  else if (ratios.taux_endettement_pct <= 200) score += 5;
  else score -= 20;

  if (ratios.capacite_autofinancement > 50000) score += 40;
  else if (ratios.capacite_autofinancement > 20000) score += 30;
  else if (ratios.capacite_autofinancement > 0) score += 15;
  else score -= 10;

  return Math.max(0, Math.min(score, 100));
}

function calculateActiviteScoreProjected(evolution: any): number {
  let score = 50;
  if (evolution.tendance === 'croissance') score += 40;
  else if (evolution.tendance === 'stable') score += 20;
  else score -= 20;

  if (evolution.ca_evolution_pct > 20) score += 30;
  else if (evolution.ca_evolution_pct > 10) score += 20;
  else if (evolution.ca_evolution_pct > 5) score += 15;
  else if (evolution.ca_evolution_pct > 0) score += 10;
  else if (evolution.ca_evolution_pct < -10) score -= 20;

  if (evolution.ebe_evolution_pct > 20) score += 30;
  else if (evolution.ebe_evolution_pct > 10) score += 20;
  else if (evolution.ebe_evolution_pct > 0) score += 10;
  else if (evolution.ebe_evolution_pct < -10) score -= 20;

  return Math.max(0, Math.min(score, 100));
}

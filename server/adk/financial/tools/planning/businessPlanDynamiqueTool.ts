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
      let caActuel = 0;
      if (yearsAnalyzed.length >= 3) {
        const caValues = yearsAnalyzed.slice(0, 3).map((year: number) => {
          return sig[year.toString()]?.chiffre_affaires || 0;
        });
        caActuel = Math.round(caValues.reduce((a: number, b: number) => a + b, 0) / caValues.length);
      } else {
        caActuel = sig[lastYearStr]?.chiffre_affaires || 0;
      }

      // Charges actuelles
      const chargesPersonnelActuel = sig[lastYearStr]?.charges_personnel || 0;
      const chargesExternesActuel = sig[lastYearStr]?.charges_externes || 0;

      // Loyer actuel avec fallback userComments
      let loyer_actuel = immobilier?.bail?.loyer_annuel_hc || 0;
      if (loyer_actuel === 0 && userComments?.loyer) {
        // Fallback: userComments avec conversion mensuel → annuel
        const loyerMensuel = userComments.loyer.loyer_actuel_mensuel ||
                             userComments.loyer.futur_loyer_commercial || 0;
        loyer_actuel = loyerMensuel * 12;
        console.log(`[businessPlanDynamique] 📋 Loyer récupéré depuis userComments: ${loyerMensuel}€/mois → ${loyer_actuel}€/an`);
      }

      // EBE actuel (normatif si disponible, sinon comptable)
      let ebeActuel = 0;
      if (comptable.ebeRetraitement?.ebe_normatif) {
        ebeActuel = comptable.ebeRetraitement.ebe_normatif;
      } else {
        ebeActuel = sig[lastYearStr]?.ebe || 0;
      }

      // ========================================
      // ÉTAPE 2b: Détection commerce TABAC et split CA
      // ========================================

      // Détecter si commerce de type Tabac (NAF 47.26Z)
      const isTabac = businessInfo?.nafCode ? isTabacCommerce(businessInfo.nafCode) : false;

      // Pour Tabac: extraire split Commissions réglementées / Ventes Boutique
      let ventesMarchandises = 0; // CA Boutique (ventes de marchandises)
      let commissionsServices = 0; // Commissions réglementées (production vendue de services)

      // Taux de marge boutique (pour Tabac)
      let tauxMargeBoutique = 0.68; // Fallback 68%

      if (isTabac && sig[lastYearStr] && caActuel > 0) {
        // Extraire ventes_marchandises depuis le SIG (format: { valeur, pct_ca })
        const ventesMarchandisesData = sig[lastYearStr]?.ventes_marchandises;
        ventesMarchandises = typeof ventesMarchandisesData === 'object'
          ? ventesMarchandisesData?.valeur || 0
          : ventesMarchandisesData || 0;

        // Commissions = CA total - Ventes marchandises
        commissionsServices = caActuel - ventesMarchandises;

        // Extraire taux de marge boutique depuis SIG (marge_commerciale / ventes_marchandises)
        const margeCommercialeData = sig[lastYearStr]?.marge_commerciale;
        const margeCommerciale = typeof margeCommercialeData === 'object'
          ? margeCommercialeData?.valeur || 0
          : margeCommercialeData || 0;

        if (ventesMarchandises > 0 && margeCommerciale > 0) {
          tauxMargeBoutique = margeCommerciale / ventesMarchandises;
        }

        console.log(`[businessPlanDynamique] 🚬 TABAC détecté (NAF: ${businessInfo?.nafCode})`);
        console.log(`  - CA Total: ${caActuel.toLocaleString('fr-FR')} €`);
        console.log(`  - Ventes Boutique: ${ventesMarchandises.toLocaleString('fr-FR')} € (${((ventesMarchandises/caActuel)*100).toFixed(1)}%)`);
        console.log(`  - Commissions: ${commissionsServices.toLocaleString('fr-FR')} € (${((commissionsServices/caActuel)*100).toFixed(1)}%)`);
        console.log(`  - Taux marge boutique: ${(tauxMargeBoutique*100).toFixed(1)}%`);
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

      const salairesSupprimes = params.salairesSupprimes || 0;
      const salairesAjoutes = params.salairesAjoutes || 0;
      const nouveauSalaires = chargesPersonnelActuel - salairesSupprimes + salairesAjoutes;

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

      // Calcul Marge Brute pour Tabac (Année 0)
      const margeMarchandisesAnnee0 = isTabac ? Math.round(ventesMarchandises * tauxMargeBoutique) : 0;
      const margeCommissionsAnnee0 = isTabac ? commissionsServices : 0; // 100% sur commissions
      const margeBruteGlobaleAnnee0 = isTabac ? (margeMarchandisesAnnee0 + margeCommissionsAnnee0) : 0;

      projections.push({
        annee: 0,
        label: 'Actuel (Cédant)',
        // CA décomposé (Tabac)
        ...(isTabac && { ventes_marchandises: ventesMarchandises }),
        ...(isTabac && { commissions_services: commissionsServices }),
        ca: caActuel,
        ca_detail: {
          ca_base: caActuel,
          impact_horaires: 0,
          impact_travaux: 0,
          croissance_naturelle: 0
        },
        // Marge Brute décomposée (Tabac)
        ...(isTabac && { marge_marchandises: margeMarchandisesAnnee0 }),
        ...(isTabac && { marge_commissions: margeCommissionsAnnee0 }),
        ...(isTabac && { marge_brute_globale: margeBruteGlobaleAnnee0 }),
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

        // Variables CA décomposé Tabac
        let ventesMarchandisesAnnee = 0;
        let commissionsServicesAnnee = 0;

        if (isTabac && ventesMarchandises > 0) {
          // ========================================
          // TABAC: Croissance différenciée
          // ========================================

          // Année 1: Impact horaires sur les deux + Impact travaux sur boutique uniquement
          if (i === 1) {
            // Horaires: impact sur les deux (+10% par défaut)
            ventesMarchandisesAnnee = ventesMarchandises * (1 + impactHoraires);
            commissionsServicesAnnee = commissionsServices * (1 + impactHoraires);

            // Travaux: +15% sur boutique uniquement
            ventesMarchandisesAnnee = ventesMarchandisesAnnee * (1 + tabacImpactDetail!.boutique);

            impact_horaires_value = (ventesMarchandises + commissionsServices) * impactHoraires;
            impact_travaux_value = ventesMarchandises * tabacImpactDetail!.boutique;
          }
          // Année 2: Consolidation (pas de nouveau boost)
          else if (i === 2) {
            ventesMarchandisesAnnee = prevVentesMarchandises;
            commissionsServicesAnnee = prevCommissionsServices;
          }
          // Années 3-5: Croissance naturelle différenciée
          else {
            // Boutique: +3%/an
            ventesMarchandisesAnnee = prevVentesMarchandises * (1 + croissanceRecurrente);
            // Commissions: plafonné à +2%/an (marché mature)
            const croissanceCommissionsPlafonnee = Math.min(0.02, croissanceRecurrente);
            commissionsServicesAnnee = prevCommissionsServices * (1 + croissanceCommissionsPlafonnee);

            croissance_naturelle_value = (ventesMarchandisesAnnee - prevVentesMarchandises) + (commissionsServicesAnnee - prevCommissionsServices);
          }

          ca_base = Math.round(ventesMarchandisesAnnee + commissionsServicesAnnee);
          prevVentesMarchandises = ventesMarchandisesAnnee;
          prevCommissionsServices = commissionsServicesAnnee;

        } else {
          // ========================================
          // Commerce standard (non-Tabac): logique existante
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

          // Croissance récurrente (années 3-5)
          if (i >= 3) {
            croissance_naturelle_value = projections[i - 1].ca * croissanceRecurrente;
            ca_base = projections[i - 1].ca + croissance_naturelle_value;
          }
        }

        const ca = Math.round(ca_base);

        // ========================================
        // Calcul Marge Brute (TABAC uniquement)
        // ========================================
        const margeMarchandisesAnnee = isTabac ? Math.round(ventesMarchandisesAnnee * tauxMargeBoutique) : 0;
        const margeCommissionsAnnee = isTabac ? Math.round(commissionsServicesAnnee) : 0; // 100%
        const margeBruteGlobaleAnnee = isTabac ? (margeMarchandisesAnnee + margeCommissionsAnnee) : 0;

        // ========================================
        // Calcul charges et EBE
        // ========================================
        const charges_fixes = nouveauSalaires + loyerNegocie + autresCharges;

        // Pour Tabac: EBE = Marge Brute Globale - Charges Fixes
        // Pour autres: EBE = CA - Charges Fixes (approximation)
        const ebe_normatif = isTabac
          ? margeBruteGlobaleAnnee - charges_fixes
          : ca - charges_fixes;

        // Reste après dette
        const reste_apres_dette = ebe_normatif - annuiteEmprunt;

        projections.push({
          annee: i,
          label: `Année ${i} (${label})`,
          // CA décomposé (Tabac)
          ...(isTabac && { ventes_marchandises: Math.round(ventesMarchandisesAnnee) }),
          ...(isTabac && { commissions_services: Math.round(commissionsServicesAnnee) }),
          ca,
          ca_detail: {
            ca_base: i === 1 ? caActuel : projections[i - 1].ca,
            impact_horaires: i === 1 ? impact_horaires_value : 0,
            impact_travaux: i === 1 ? impact_travaux_value : 0,
            croissance_naturelle: i >= 3 ? croissance_naturelle_value : 0,
            // Détail spécifique Tabac
            ...(tabacImpactDetail && i >= 1 && {
              tabac_detail: {
                impact_travaux_commissions: 0,
                impact_travaux_boutique: i === 1 ? Math.round(ventesMarchandises * tabacImpactDetail.boutique) : 0,
                poids_commissions: Math.round((commissionsServices / caActuel) * 100),
                poids_boutique: Math.round((ventesMarchandises / caActuel) * 100)
              }
            })
          },
          // Marge Brute décomposée (Tabac)
          ...(isTabac && { marge_marchandises: margeMarchandisesAnnee }),
          ...(isTabac && { marge_commissions: margeCommissionsAnnee }),
          ...(isTabac && { marge_brute_globale: margeBruteGlobaleAnnee }),
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

      const result = {
        projections,
        indicateursBancaires,
        hypotheses: params,
        synthese,
        recommandations,
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

import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';

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

  // CA
  ca: z.number(),
  ca_detail: z.object({
    ca_base: z.number(),
    impact_horaires: z.number().optional(),
    impact_travaux: z.number().optional(),
    croissance_naturelle: z.number().optional()
  }),

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
      // ÉTAPE 2: Récupérer les données actuelles
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
      const loyer_actuel = immobilier?.bail?.loyer_annuel_hc || 0;

      // EBE actuel (normatif si disponible, sinon comptable)
      let ebeActuel = 0;
      if (comptable.ebeRetraitement?.ebe_normatif) {
        ebeActuel = comptable.ebeRetraitement.ebe_normatif;
      } else {
        ebeActuel = sig[lastYearStr]?.ebe || 0;
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

      const loyerNegocie = params.loyerNegocie || immobilier?.simulationLoyer?.scenarios?.realiste?.nouveauLoyerAnnuel || loyer_actuel;

      // Autres charges (estimées à partir des charges externes moins le loyer)
      const autresCharges = Math.max(0, chargesExternesActuel - loyer_actuel);

      // ========================================
      // ÉTAPE 6: Générer les projections sur 5 ans
      // ========================================

      const projections: any[] = [];

      // Année 0: Actuel
      const chargesFixesAnnee0 = chargesPersonnelActuel + loyer_actuel + autresCharges;
      projections.push({
        annee: 0,
        label: 'Actuel (Cédant)',
        ca: caActuel,
        ca_detail: {
          ca_base: caActuel,
          impact_horaires: 0,
          impact_travaux: 0,
          croissance_naturelle: 0
        },
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
      const impactTravauxAnnee2 = params.travaux?.impactAnnee2 || 0.10; // 10% par défaut
      const croissanceRecurrente = params.travaux?.impactRecurrent || 0.03; // 3% par défaut

      // Années 1 à 5
      for (let i = 1; i <= 5; i++) {
        let label = '';
        if (i === 1) label = 'Reprise';
        else if (i === 2) label = 'Travaux';
        else label = 'Croisière';

        // Calcul CA
        let ca_base = caActuel;
        let impact_horaires_value = 0;
        let impact_travaux_value = 0;
        let croissance_naturelle_value = 0;

        // Impact horaires (dès année 1)
        if (i >= 1) {
          impact_horaires_value = ca_base * impactHoraires;
          ca_base += impact_horaires_value;
        }

        // Impact travaux (dès année 2)
        if (i === 2) {
          impact_travaux_value = ca_base * impactTravauxAnnee2;
          ca_base += impact_travaux_value;
        }

        // Croissance récurrente (années 3-5)
        if (i >= 3) {
          const nbAnneesCroissance = i - 2;
          croissance_naturelle_value = projections[i - 1].ca * croissanceRecurrente;
          ca_base = projections[i - 1].ca + croissance_naturelle_value;
        }

        const ca = Math.round(ca_base);

        // Calcul charges fixes
        const charges_fixes = nouveauSalaires + loyerNegocie + autresCharges;

        // Calcul EBE Normatif
        const ebe_normatif = ca - charges_fixes;

        // Reste après dette
        const reste_apres_dette = ebe_normatif - annuiteEmprunt;

        projections.push({
          annee: i,
          label: `Année ${i} (${label})`,
          ca,
          ca_detail: {
            ca_base: i === 1 ? caActuel : projections[i - 1].ca,
            impact_horaires: i >= 1 ? impact_horaires_value : 0,
            impact_travaux: i === 2 ? impact_travaux_value : 0,
            croissance_naturelle: i >= 3 ? croissance_naturelle_value : 0
          },
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
        recommandations
      };

      // Injecter dans le state pour que generateFinancialHtmlTool puisse le lire
      if (toolContext?.state) {
        toolContext.state.set('businessPlan', result);
        console.log('[businessPlanDynamique] ✅ Business plan injected into state');
      }

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

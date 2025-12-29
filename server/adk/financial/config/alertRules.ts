/**
 * Alert Rules Configuration
 *
 * Regles deterministes pour la generation d'alertes reproductibles.
 * Chaque regle a un seuil fixe et un template de message precis.
 *
 * Categories:
 * - RENT_XXX: Rentabilite (EBE, marges, resultat)
 * - DETTE_XXX: Endettement/Solvabilite
 * - CROIS_XXX: Croissance/Activite
 * - TRESO_XXX: Tresorerie/Liquidite
 * - VALO_XXX: Valorisation
 * - IMMO_XXX: Immobilier
 * - DATA_XXX: Qualite des donnees
 */

import type { AlertRule, AlertEvaluationContext } from '../schemas/alertRulesSchema';

/**
 * Helper: Obtenir le SIG de la derniere annee
 */
function getLatestSig(ctx: AlertEvaluationContext) {
  if (!ctx.comptable?.sig) return null;
  const years = Object.keys(ctx.comptable.sig).sort().reverse();
  return years[0] ? ctx.comptable.sig[years[0]] : null;
}

/**
 * Helper: Calculer l'evolution EBE sur N annees
 */
function calculateEbeEvolution(ctx: AlertEvaluationContext): { pct: number; years: number } | null {
  if (!ctx.comptable?.sig) return null;
  const years = Object.keys(ctx.comptable.sig).sort();
  if (years.length < 2) return null;

  const firstYear = years[0];
  const lastYear = years[years.length - 1];
  const ebeFirst = ctx.comptable.sig[firstYear]?.ebe || 0;
  const ebeLast = ctx.comptable.sig[lastYear]?.ebe || 0;

  if (ebeFirst === 0) return null;
  const pct = ((ebeLast - ebeFirst) / Math.abs(ebeFirst)) * 100;
  return { pct: Math.round(pct * 10) / 10, years: years.length };
}

/**
 * Helper: Calculer l'evolution CA sur N annees
 */
function calculateCaEvolution(ctx: AlertEvaluationContext): { pct: number; years: number } | null {
  if (!ctx.comptable?.sig) return null;
  const years = Object.keys(ctx.comptable.sig).sort();
  if (years.length < 2) return null;

  const firstYear = years[0];
  const lastYear = years[years.length - 1];
  const caFirst = ctx.comptable.sig[firstYear]?.chiffre_affaires || 0;
  const caLast = ctx.comptable.sig[lastYear]?.chiffre_affaires || 0;

  if (caFirst === 0) return null;
  const pct = ((caLast - caFirst) / Math.abs(caFirst)) * 100;
  return { pct: Math.round(pct * 10) / 10, years: years.length };
}

/**
 * Helper: Obtenir l'annee la plus recente des donnees
 */
function getMostRecentYear(ctx: AlertEvaluationContext): number | null {
  if (!ctx.comptable?.sig) return null;
  const years = Object.keys(ctx.comptable.sig).map(y => parseInt(y)).filter(y => !isNaN(y));
  return years.length > 0 ? Math.max(...years) : null;
}

/**
 * Helper: Obtenir la valorisation recommandee
 */
function getValuationRecommended(ctx: AlertEvaluationContext): number {
  return ctx.valorisation?.synthese?.valeur_recommandee ||
         ctx.valorisation?.methodeHybride?.valorisationTotale?.valeurMediane ||
         0;
}

/**
 * Helper: Obtenir la fourchette haute de valorisation
 */
function getValuationHigh(ctx: AlertEvaluationContext): number {
  return ctx.valorisation?.synthese?.fourchette_haute ||
         ctx.valorisation?.methodeHybride?.valorisationTotale?.valeurHaute ||
         0;
}

// ============================================================
// REGLES D'ALERTES
// ============================================================

export const ALERT_RULES: AlertRule[] = [
  // ========================================
  // RENTABILITE (RENT_XXX)
  // ========================================
  {
    id: 'RENT_001',
    category: 'rentabilite',
    severity: 'critical',
    condition: (ctx) => {
      const evo = calculateEbeEvolution(ctx);
      return evo !== null && evo.pct < -30;
    },
    extractValues: (ctx) => {
      const evo = calculateEbeEvolution(ctx)!;
      return { pct: Math.abs(evo.pct), years: evo.years };
    },
    titleTemplate: 'Chute massive de l\'EBE',
    messageTemplate: (v) => `Chute de l'EBE de ${v.pct}% sur ${v.years} ans`,
    impactTemplate: 'Risque de non-couverture des annuites de pret',
    recommendationTemplate: 'Auditer les causes de la baisse de rentabilite (charges, CA)'
  },
  {
    id: 'RENT_002',
    category: 'rentabilite',
    severity: 'warning',
    condition: (ctx) => {
      const evo = calculateEbeEvolution(ctx);
      return evo !== null && evo.pct < -15 && evo.pct >= -30;
    },
    extractValues: (ctx) => {
      const evo = calculateEbeEvolution(ctx)!;
      return { pct: Math.abs(evo.pct), years: evo.years };
    },
    titleTemplate: 'Baisse significative de l\'EBE',
    messageTemplate: (v) => `Baisse de l'EBE de ${v.pct}% sur ${v.years} ans`,
    impactTemplate: 'Vigilance sur la capacite de remboursement',
    recommendationTemplate: 'Identifier les postes de charges en hausse'
  },
  {
    id: 'RENT_003',
    category: 'rentabilite',
    severity: 'warning',
    condition: (ctx) => {
      const marge = ctx.comptable?.ratios?.marge_ebe_pct;
      return marge !== undefined && marge > 0 && marge < 5;
    },
    extractValues: (ctx) => ({
      marge: ctx.comptable?.ratios?.marge_ebe_pct?.toFixed(1) || '0'
    }),
    titleTemplate: 'Marge EBE faible',
    messageTemplate: (v) => `Marge EBE de ${v.marge}%, insuffisante pour absorber les aleas`,
    impactTemplate: 'Faible marge de securite face aux imprevus',
    recommendationTemplate: 'Optimiser les achats ou augmenter les prix de vente'
  },
  {
    id: 'RENT_004',
    category: 'rentabilite',
    severity: 'critical',
    condition: (ctx) => {
      const marge = ctx.comptable?.ratios?.marge_ebe_pct;
      return marge !== undefined && marge < 0;
    },
    extractValues: (ctx) => ({
      marge: ctx.comptable?.ratios?.marge_ebe_pct?.toFixed(1) || '0'
    }),
    titleTemplate: 'Marge EBE negative',
    messageTemplate: (v) => `Marge EBE de ${v.marge}%, l'exploitation est deficitaire`,
    impactTemplate: 'L\'entreprise detruit de la valeur au niveau operationnel',
    recommendationTemplate: 'Redressement urgent necessaire avant reprise'
  },
  {
    id: 'RENT_005',
    category: 'rentabilite',
    severity: 'critical',
    condition: (ctx) => {
      const sig = getLatestSig(ctx);
      return sig !== null && sig.resultat_net < 0;
    },
    extractValues: (ctx) => {
      const sig = getLatestSig(ctx)!;
      return { resultat: sig.resultat_net.toLocaleString('fr-FR') };
    },
    titleTemplate: 'Resultat net deficitaire',
    messageTemplate: (v) => `Resultat net de ${v.resultat} EUR`,
    impactTemplate: 'L\'entreprise perd de l\'argent globalement',
    recommendationTemplate: 'Analyser les charges financieres et exceptionnelles'
  },
  {
    id: 'RENT_006',
    category: 'rentabilite',
    severity: 'critical',
    condition: (ctx) => {
      const caf = ctx.comptable?.ratios?.capacite_autofinancement;
      return caf !== undefined && caf < 0;
    },
    extractValues: (ctx) => ({
      caf: (ctx.comptable?.ratios?.capacite_autofinancement || 0).toLocaleString('fr-FR')
    }),
    titleTemplate: 'Capacite d\'autofinancement negative',
    messageTemplate: (v) => `CAF de ${v.caf} EUR, l'entreprise ne genere pas de cash`,
    impactTemplate: 'Incapacite a financer les investissements et rembourser les dettes',
    recommendationTemplate: 'Redressement operationnel indispensable'
  },
  {
    id: 'RENT_007',
    category: 'rentabilite',
    severity: 'warning',
    condition: (ctx) => {
      const marge = ctx.comptable?.ratios?.marge_ebe_pct;
      const benchMarge = ctx.benchmark?.ratios?.marge_ebe_pct;
      if (marge === undefined || benchMarge === undefined) return false;
      return marge < benchMarge * 0.7; // 30% en dessous du secteur
    },
    extractValues: (ctx) => ({
      marge: ctx.comptable?.ratios?.marge_ebe_pct?.toFixed(1) || '0',
      sector: ctx.benchmark?.ratios?.marge_ebe_pct?.toFixed(1) || '0',
      sectorName: ctx.benchmark?.sector || 'secteur'
    }),
    titleTemplate: 'Rentabilite inferieure au secteur',
    messageTemplate: (v) => `Marge EBE de ${v.marge}% vs ${v.sector}% (moyenne ${v.sectorName})`,
    impactTemplate: 'Competitivite plus faible que les concurrents',
    recommendationTemplate: 'Benchmarker les pratiques du secteur pour identifier les ecarts'
  },

  // ========================================
  // ENDETTEMENT (DETTE_XXX)
  // ========================================
  {
    id: 'DETTE_001',
    category: 'endettement',
    severity: 'critical',
    condition: (ctx) => {
      const taux = ctx.comptable?.ratios?.taux_endettement_pct;
      return taux !== undefined && taux > 300;
    },
    extractValues: (ctx) => ({
      taux: ctx.comptable?.ratios?.taux_endettement_pct?.toFixed(0) || '0'
    }),
    titleTemplate: 'Endettement critique',
    messageTemplate: (v) => `Taux d'endettement de ${v.taux}%, structure financiere tres fragile`,
    impactTemplate: 'Capacite d\'emprunt epuisee, risque de defaillance',
    recommendationTemplate: 'Analyse approfondie de la structure de la dette necessaire'
  },
  {
    id: 'DETTE_002',
    category: 'endettement',
    severity: 'warning',
    condition: (ctx) => {
      const taux = ctx.comptable?.ratios?.taux_endettement_pct;
      return taux !== undefined && taux > 200 && taux <= 300;
    },
    extractValues: (ctx) => ({
      taux: ctx.comptable?.ratios?.taux_endettement_pct?.toFixed(0) || '0'
    }),
    titleTemplate: 'Endettement eleve',
    messageTemplate: (v) => `Taux d'endettement de ${v.taux}%`,
    impactTemplate: 'Capacite d\'emprunt limitee pour le repreneur',
    recommendationTemplate: 'Prevoir un apport personnel plus important'
  },
  {
    id: 'DETTE_003',
    category: 'endettement',
    severity: 'info',
    condition: (ctx) => {
      const taux = ctx.comptable?.ratios?.taux_endettement_pct;
      return taux !== undefined && taux > 150 && taux <= 200;
    },
    extractValues: (ctx) => ({
      taux: ctx.comptable?.ratios?.taux_endettement_pct?.toFixed(0) || '0'
    }),
    titleTemplate: 'Endettement a surveiller',
    messageTemplate: (v) => `Taux d'endettement de ${v.taux}%`,
    impactTemplate: 'Situation financiere a optimiser',
    recommendationTemplate: 'Surveiller l\'evolution de l\'endettement'
  },
  {
    id: 'DETTE_004',
    category: 'endettement',
    severity: 'warning',
    condition: (ctx) => {
      const taux = ctx.comptable?.ratios?.taux_endettement_pct;
      const benchTaux = ctx.benchmark?.ratios?.taux_endettement_pct;
      if (taux === undefined || benchTaux === undefined) return false;
      return taux > benchTaux * 1.5; // 50% au-dessus du secteur
    },
    extractValues: (ctx) => ({
      taux: ctx.comptable?.ratios?.taux_endettement_pct?.toFixed(0) || '0',
      sector: ctx.benchmark?.ratios?.taux_endettement_pct?.toFixed(0) || '0'
    }),
    titleTemplate: 'Endettement superieur au secteur',
    messageTemplate: (v) => `Endettement de ${v.taux}% vs ${v.sector}% (moyenne sectorielle)`,
    impactTemplate: 'Structure financiere moins solide que les concurrents',
    recommendationTemplate: 'Negocier un prix tenant compte du surendettement'
  },

  // ========================================
  // CROISSANCE (CROIS_XXX)
  // ========================================
  {
    id: 'CROIS_001',
    category: 'croissance',
    severity: 'critical',
    condition: (ctx) => {
      const evo = calculateCaEvolution(ctx);
      return evo !== null && evo.pct < -20;
    },
    extractValues: (ctx) => {
      const evo = calculateCaEvolution(ctx)!;
      return { pct: Math.abs(evo.pct), years: evo.years };
    },
    titleTemplate: 'Chute du chiffre d\'affaires',
    messageTemplate: (v) => `Baisse du CA de ${v.pct}% sur ${v.years} ans`,
    impactTemplate: 'Perte de parts de marche significative',
    recommendationTemplate: 'Identifier les causes (concurrence, tendance marche, gestion)'
  },
  {
    id: 'CROIS_002',
    category: 'croissance',
    severity: 'warning',
    condition: (ctx) => {
      const evo = calculateCaEvolution(ctx);
      return evo !== null && evo.pct < -10 && evo.pct >= -20;
    },
    extractValues: (ctx) => {
      const evo = calculateCaEvolution(ctx)!;
      return { pct: Math.abs(evo.pct), years: evo.years };
    },
    titleTemplate: 'Baisse du chiffre d\'affaires',
    messageTemplate: (v) => `Baisse du CA de ${v.pct}% sur ${v.years} ans`,
    impactTemplate: 'Erosion de l\'activite a surveiller',
    recommendationTemplate: 'Analyser la dynamique commerciale'
  },
  {
    id: 'CROIS_003',
    category: 'croissance',
    severity: 'warning',
    condition: (ctx) => ctx.comptable?.evolution?.tendance === 'declin',
    extractValues: () => ({}),
    titleTemplate: 'Tendance declinante',
    messageTemplate: () => 'Tendance de declin sur les 3 dernieres annees',
    impactTemplate: 'Dynamique negative a inverser',
    recommendationTemplate: 'Elaborer un plan de redressement commercial'
  },
  {
    id: 'CROIS_004',
    category: 'croissance',
    severity: 'info',
    condition: (ctx) => {
      const evo = calculateCaEvolution(ctx);
      return evo !== null && Math.abs(evo.pct) < 3 && evo.years >= 3;
    },
    extractValues: (ctx) => {
      const evo = calculateCaEvolution(ctx)!;
      return { years: evo.years };
    },
    titleTemplate: 'Activite stagnante',
    messageTemplate: (v) => `Chiffre d'affaires stable sur ${v.years} ans (pas de croissance)`,
    impactTemplate: 'Absence de dynamique de developpement',
    recommendationTemplate: 'Identifier des leviers de croissance'
  },

  // ========================================
  // TRESORERIE (TRESO_XXX)
  // ========================================
  {
    id: 'TRESO_001',
    category: 'tresorerie',
    severity: 'critical',
    condition: (ctx) => {
      const delai = ctx.comptable?.ratios?.delai_clients_jours;
      return delai !== undefined && delai > 180;
    },
    extractValues: (ctx) => ({
      delai: ctx.comptable?.ratios?.delai_clients_jours?.toFixed(0) || '0'
    }),
    titleTemplate: 'Delai clients aberrant',
    messageTemplate: (v) => `Delai clients de ${v.delai} jours, risque de creances irrecouvrables`,
    impactTemplate: 'Tresorerie immobilisee, risque de pertes',
    recommendationTemplate: 'Auditer le poste clients et les impayés'
  },
  {
    id: 'TRESO_002',
    category: 'tresorerie',
    severity: 'warning',
    condition: (ctx) => {
      const delai = ctx.comptable?.ratios?.delai_clients_jours;
      return delai !== undefined && delai > 90 && delai <= 180;
    },
    extractValues: (ctx) => ({
      delai: ctx.comptable?.ratios?.delai_clients_jours?.toFixed(0) || '0'
    }),
    titleTemplate: 'Delai clients eleve',
    messageTemplate: (v) => `Delai clients de ${v.delai} jours`,
    impactTemplate: 'Tresorerie penalisee par les encours clients',
    recommendationTemplate: 'Verifier la qualite des creances'
  },
  {
    id: 'TRESO_003',
    category: 'tresorerie',
    severity: 'critical',
    condition: (ctx) => {
      const bfr = ctx.comptable?.ratios?.bfr_jours_ca;
      return bfr !== undefined && bfr > 120;
    },
    extractValues: (ctx) => ({
      bfr: ctx.comptable?.ratios?.bfr_jours_ca?.toFixed(0) || '0'
    }),
    titleTemplate: 'BFR tres eleve',
    messageTemplate: (v) => `BFR de ${v.bfr} jours de CA, tension de tresorerie`,
    impactTemplate: 'Besoin de financement permanent eleve',
    recommendationTemplate: 'Optimiser stocks, clients et fournisseurs'
  },
  {
    id: 'TRESO_004',
    category: 'tresorerie',
    severity: 'warning',
    condition: (ctx) => {
      const bfr = ctx.comptable?.ratios?.bfr_jours_ca;
      return bfr !== undefined && bfr > 60 && bfr <= 120;
    },
    extractValues: (ctx) => ({
      bfr: ctx.comptable?.ratios?.bfr_jours_ca?.toFixed(0) || '0'
    }),
    titleTemplate: 'BFR eleve',
    messageTemplate: (v) => `BFR de ${v.bfr} jours de CA`,
    impactTemplate: 'Tresorerie sous tension',
    recommendationTemplate: 'Negocier les delais fournisseurs'
  },
  {
    id: 'TRESO_005',
    category: 'tresorerie',
    severity: 'warning',
    condition: (ctx) => {
      const rotation = ctx.comptable?.ratios?.rotation_stocks_jours;
      return rotation !== undefined && rotation > 180;
    },
    extractValues: (ctx) => ({
      rotation: ctx.comptable?.ratios?.rotation_stocks_jours?.toFixed(0) || '0'
    }),
    titleTemplate: 'Rotation stocks lente',
    messageTemplate: (v) => `Rotation des stocks de ${v.rotation} jours`,
    impactTemplate: 'Capital immobilise en stocks, risque d\'obsolescence',
    recommendationTemplate: 'Auditer les stocks et optimiser les achats'
  },

  // ========================================
  // VALORISATION (VALO_XXX)
  // ========================================
  {
    id: 'VALO_001',
    category: 'valorisation',
    severity: 'warning',
    condition: (ctx) => {
      const methodes = ctx.valorisation?.methodes;
      if (!methodes) return false;
      const values = [
        methodes.ebe?.valorisation,
        methodes.ca?.valorisation,
        methodes.patrimoniale?.valorisation
      ].filter(v => v !== undefined && v > 0) as number[];
      if (values.length < 2) return false;
      const max = Math.max(...values);
      const min = Math.min(...values);
      return max > min * 2; // Ecart > 100%
    },
    extractValues: (ctx) => {
      const m = ctx.valorisation?.methodes;
      return {
        ebe: (m?.ebe?.valorisation || 0).toLocaleString('fr-FR'),
        ca: (m?.ca?.valorisation || 0).toLocaleString('fr-FR'),
        patri: (m?.patrimoniale?.valorisation || 0).toLocaleString('fr-FR')
      };
    },
    titleTemplate: 'Ecart entre methodes de valorisation',
    messageTemplate: (v) => `Valorisations: EBE ${v.ebe} EUR, CA ${v.ca} EUR, Patrimoniale ${v.patri} EUR`,
    impactTemplate: 'Incertitude sur la valeur reelle du fonds',
    recommendationTemplate: 'Justifier le choix de la methode retenue'
  },
  {
    id: 'VALO_002',
    category: 'valorisation',
    severity: 'critical',
    condition: (ctx) => {
      const prix = ctx.businessInfo?.prixDemande;
      const valoHigh = getValuationHigh(ctx);
      if (!prix || !valoHigh) return false;
      return prix > valoHigh * 1.2; // Prix > valo haute + 20%
    },
    extractValues: (ctx) => ({
      prix: (ctx.businessInfo?.prixDemande || 0).toLocaleString('fr-FR'),
      valoHigh: getValuationHigh(ctx).toLocaleString('fr-FR'),
      ecart: (((ctx.businessInfo?.prixDemande || 0) - getValuationHigh(ctx)) / getValuationHigh(ctx) * 100).toFixed(0)
    }),
    titleTemplate: 'Prix demande excessif',
    messageTemplate: (v) => `Prix demande ${v.prix} EUR, +${v.ecart}% au-dessus de la fourchette haute (${v.valoHigh} EUR)`,
    impactTemplate: 'Surevaluation manifeste du fonds',
    recommendationTemplate: 'Negociation ferme sur le prix ou abandon du projet'
  },
  {
    id: 'VALO_003',
    category: 'valorisation',
    severity: 'warning',
    condition: (ctx) => {
      const prix = ctx.businessInfo?.prixDemande;
      const valoHigh = getValuationHigh(ctx);
      if (!prix || !valoHigh) return false;
      return prix > valoHigh && prix <= valoHigh * 1.2;
    },
    extractValues: (ctx) => ({
      prix: (ctx.businessInfo?.prixDemande || 0).toLocaleString('fr-FR'),
      valoHigh: getValuationHigh(ctx).toLocaleString('fr-FR')
    }),
    titleTemplate: 'Prix demande au-dessus de la valorisation',
    messageTemplate: (v) => `Prix demande ${v.prix} EUR, superieur a la fourchette haute (${v.valoHigh} EUR)`,
    impactTemplate: 'Marge de negociation necessaire',
    recommendationTemplate: 'Negocier une reduction du prix'
  },
  {
    id: 'VALO_004',
    category: 'valorisation',
    severity: 'warning',
    condition: (ctx) => {
      const ebe = ctx.valorisation?.methodes?.ebe?.ebe_reference;
      const valoEbe = ctx.valorisation?.methodes?.ebe?.valorisation;
      return ebe !== undefined && ebe < 0 && valoEbe !== undefined && valoEbe > 0;
    },
    extractValues: (ctx) => ({
      ebe: (ctx.valorisation?.methodes?.ebe?.ebe_reference || 0).toLocaleString('fr-FR')
    }),
    titleTemplate: 'Valorisation EBE avec EBE negatif',
    messageTemplate: (v) => `Methode EBE utilisee alors que l'EBE est negatif (${v.ebe} EUR)`,
    impactTemplate: 'Methode de valorisation inadaptee',
    recommendationTemplate: 'Privilegier la methode patrimoniale ou CA'
  },

  // ========================================
  // IMMOBILIER (IMMO_XXX)
  // ========================================
  {
    id: 'IMMO_001',
    category: 'immobilier',
    severity: 'critical',
    condition: (ctx) => {
      const loyer = ctx.immobilier?.synthese?.loyer_mensuel;
      const sig = getLatestSig(ctx);
      if (!loyer || !sig?.chiffre_affaires || sig.chiffre_affaires === 0) return false;
      const loyerAnnuel = loyer * 12;
      const ratio = (loyerAnnuel / sig.chiffre_affaires) * 100;
      return ratio > 30;
    },
    extractValues: (ctx) => {
      const loyer = ctx.immobilier?.synthese?.loyer_mensuel || 0;
      const sig = getLatestSig(ctx);
      const ca = sig?.chiffre_affaires || 1;
      return {
        loyer: (loyer * 12).toLocaleString('fr-FR'),
        ratio: ((loyer * 12 / ca) * 100).toFixed(1)
      };
    },
    titleTemplate: 'Loyer excessif',
    messageTemplate: (v) => `Loyer annuel de ${v.loyer} EUR (${v.ratio}% du CA)`,
    impactTemplate: 'Rentabilite fortement penalisee par le loyer',
    recommendationTemplate: 'Renegocier le bail ou etudier l\'achat des murs'
  },
  {
    id: 'IMMO_002',
    category: 'immobilier',
    severity: 'warning',
    condition: (ctx) => {
      const loyer = ctx.immobilier?.synthese?.loyer_mensuel;
      const sig = getLatestSig(ctx);
      if (!loyer || !sig?.chiffre_affaires || sig.chiffre_affaires === 0) return false;
      const loyerAnnuel = loyer * 12;
      const ratio = (loyerAnnuel / sig.chiffre_affaires) * 100;
      return ratio > 15 && ratio <= 30;
    },
    extractValues: (ctx) => {
      const loyer = ctx.immobilier?.synthese?.loyer_mensuel || 0;
      const sig = getLatestSig(ctx);
      const ca = sig?.chiffre_affaires || 1;
      return {
        loyer: (loyer * 12).toLocaleString('fr-FR'),
        ratio: ((loyer * 12 / ca) * 100).toFixed(1)
      };
    },
    titleTemplate: 'Loyer eleve',
    messageTemplate: (v) => `Loyer annuel de ${v.loyer} EUR (${v.ratio}% du CA)`,
    impactTemplate: 'Charge locative significative',
    recommendationTemplate: 'Verifier la coherence avec le marche local'
  },
  {
    id: 'IMMO_003',
    category: 'immobilier',
    severity: 'warning',
    condition: (ctx) => {
      const duree = ctx.immobilier?.synthese?.bail_duree_restante_mois;
      return duree !== undefined && duree < 24 && duree > 0;
    },
    extractValues: (ctx) => ({
      duree: ctx.immobilier?.synthese?.bail_duree_restante_mois?.toFixed(0) || '0'
    }),
    titleTemplate: 'Bail a renouveler prochainement',
    messageTemplate: (v) => `Duree restante du bail: ${v.duree} mois`,
    impactTemplate: 'Incertitude sur les conditions futures',
    recommendationTemplate: 'Negocier le renouvellement avant la reprise'
  },
  {
    id: 'IMMO_004',
    category: 'immobilier',
    severity: 'info',
    condition: (ctx) => ctx.immobilier?.synthese?.bail_present === false,
    extractValues: () => ({}),
    titleTemplate: 'Bail commercial non analyse',
    messageTemplate: () => 'Bail commercial non fourni ou non analyse',
    impactTemplate: 'Donnees immobilieres incompletes',
    recommendationTemplate: 'Demander le bail au vendeur'
  },

  // ========================================
  // DONNEES (DATA_XXX)
  // ========================================
  {
    id: 'DATA_001',
    category: 'donnees',
    severity: 'critical',
    condition: (ctx) => {
      if (!ctx.documentExtraction?.documents) return true;
      return !ctx.documentExtraction.documents.some(d => d.documentType === 'bilan');
    },
    extractValues: () => ({}),
    titleTemplate: 'Bilan comptable non fourni',
    messageTemplate: () => 'Aucun bilan comptable n\'a ete fourni',
    impactTemplate: 'Analyse de structure financiere impossible',
    recommendationTemplate: 'Demander les bilans des 3 dernieres annees'
  },
  {
    id: 'DATA_002',
    category: 'donnees',
    severity: 'critical',
    condition: (ctx) => {
      if (!ctx.documentExtraction?.documents) return true;
      return !ctx.documentExtraction.documents.some(d =>
        d.documentType === 'compte_resultat' || d.documentType === 'compta'
      );
    },
    extractValues: () => ({}),
    titleTemplate: 'Compte de resultat non fourni',
    messageTemplate: () => 'Aucun compte de resultat n\'a ete fourni',
    impactTemplate: 'Analyse de rentabilite impossible',
    recommendationTemplate: 'Demander les comptes de resultat des 3 dernieres annees'
  },
  {
    id: 'DATA_003',
    category: 'donnees',
    severity: 'warning',
    condition: (ctx) => {
      const years = ctx.comptable?.yearsAnalyzed;
      return years !== undefined && years.length < 2;
    },
    extractValues: (ctx) => ({
      count: ctx.comptable?.yearsAnalyzed?.length || 0
    }),
    titleTemplate: 'Donnees historiques insuffisantes',
    messageTemplate: (v) => `Seulement ${v.count} annee(s) de donnees disponible(s)`,
    impactTemplate: 'Analyse de tendance limitee',
    recommendationTemplate: 'Demander les documents des 3 dernieres annees'
  },
  {
    id: 'DATA_004',
    category: 'donnees',
    severity: 'warning',
    condition: (ctx) => {
      const year = getMostRecentYear(ctx);
      const currentYear = new Date().getFullYear();
      return year !== null && currentYear - year >= 2;
    },
    extractValues: (ctx) => ({
      year: getMostRecentYear(ctx) || 0,
      currentYear: new Date().getFullYear()
    }),
    titleTemplate: 'Donnees anciennes',
    messageTemplate: (v) => `Donnees les plus recentes datent de ${v.year}`,
    impactTemplate: 'Les donnees peuvent ne plus refleter la situation actuelle',
    recommendationTemplate: `Demander les documents ${new Date().getFullYear() - 1}`
  },
  {
    id: 'DATA_005',
    category: 'donnees',
    severity: 'critical',
    condition: (ctx) => {
      const sig = getLatestSig(ctx);
      return sig !== null && (sig.chiffre_affaires === 0 || sig.chiffre_affaires === undefined);
    },
    extractValues: () => ({}),
    titleTemplate: 'Chiffre d\'affaires non extrait',
    messageTemplate: () => 'Le chiffre d\'affaires n\'a pas pu etre extrait des documents',
    impactTemplate: 'Analyse financiere impossible sans CA',
    recommendationTemplate: 'Verifier la qualite des documents fournis'
  }
];

export default ALERT_RULES;

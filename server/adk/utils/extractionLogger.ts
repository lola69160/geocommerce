/**
 * Extraction Logger
 *
 * Logger dédié pour visualiser toutes les données extraites des documents
 * et commentaires utilisateurs dans le pipeline financier.
 *
 * Fichier de log: logs/extraction_YYYYMMDD_HHMMSS_SIRET.log (un fichier par analyse)
 *
 * Categories:
 * - DOCUMENT: Données extraites des PDFs (Gemini Vision)
 * - USER_COMMENT: Commentaires utilisateur (loyer, travaux, etc.)
 * - SIG: Soldes Intermédiaires de Gestion calculés
 * - EBE: Retraitements EBE
 * - VALIDATION: Données de validation/cohérence
 */

import fs from 'fs';
import path from 'path';
// @ts-ignore - JS module import
import { getSessionLogFile, hasSession, hasBeenLogged, markAsLogged } from '../../extractionSessionStore.js';

// Types
export type ExtractionCategory =
  | 'DOCUMENT'
  | 'USER_COMMENT'
  | 'SIG'
  | 'EBE_RETRAITEMENT'
  | 'BILAN'
  | 'COMPTE_RESULTAT'
  | 'VALORISATION'
  | 'IMMOBILIER'
  | 'VALIDATION'
  | 'BUSINESS_PLAN';

export interface ExtractionLogEntry {
  timestamp: string;
  category: ExtractionCategory;
  source: string;
  siret?: string;
  year?: number;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Get log file path for a SIRET (uses shared session store)
 */
function getLogFilePath(siret?: string): string {
  // Check shared session store first
  if (siret && hasSession(siret)) {
    return getSessionLogFile(siret);
  }

  // Fallback: use daily log file (for calls without session)
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const logsDir = path.join(process.cwd(), 'logs');

  // Ensure logs directory exists
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  return path.join(logsDir, `extraction_${today}.log`);
}

// Format a value for display
function formatValue(value: any, indent: number = 0): string {
  const prefix = '  '.repeat(indent);

  if (value === null || value === undefined) {
    return `${prefix}null`;
  }

  if (typeof value === 'number') {
    // Format numbers with French locale
    return value.toLocaleString('fr-FR');
  }

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return value.map(v => formatValue(v, 0)).join(', ');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

// Format data section with nice alignment
function formatDataSection(data: Record<string, any>, maxKeyLength: number = 40): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;

    const paddedKey = key.padEnd(maxKeyLength);

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Nested object - recurse
      lines.push(`    ${paddedKey}:`);
      for (const [subKey, subValue] of Object.entries(value)) {
        if (subValue === undefined) continue;
        const paddedSubKey = `  └─ ${subKey}`.padEnd(maxKeyLength + 4);
        lines.push(`    ${paddedSubKey}: ${formatValue(subValue)}`);
      }
    } else {
      lines.push(`    ${paddedKey}: ${formatValue(value)}`);
    }
  }

  return lines.join('\n');
}

// Main logging function
export function logExtraction(entry: Omit<ExtractionLogEntry, 'timestamp'>): void {
  // Prevent duplicate logs for the same siret/category/source/year
  if (entry.siret && hasBeenLogged(entry.siret, entry.category, entry.source, entry.year?.toString() || '')) {
    console.log(`[ExtractionLogger] Skipping duplicate: ${entry.category} for ${entry.source}${entry.year ? ` (${entry.year})` : ''}`);
    return;
  }

  const timestamp = new Date().toISOString();
  const logPath = getLogFilePath(entry.siret);

  // Mark as logged to prevent duplicates
  if (entry.siret) {
    markAsLogged(entry.siret, entry.category, entry.source, entry.year?.toString() || '');
  }

  // Build the log message
  const separator = '═'.repeat(80);
  const subSeparator = '─'.repeat(80);

  let message = `\n${separator}\n`;
  message += `  📊 EXTRACTION LOG - ${entry.category}\n`;
  message += `${subSeparator}\n`;
  message += `  ⏰ Timestamp: ${timestamp}\n`;
  message += `  📁 Source:    ${entry.source}\n`;

  if (entry.siret) {
    message += `  🏢 SIRET:     ${entry.siret}\n`;
  }

  if (entry.year) {
    message += `  📅 Année:     ${entry.year}\n`;
  }

  if (entry.metadata && Object.keys(entry.metadata).length > 0) {
    message += `${subSeparator}\n`;
    message += `  📋 Métadonnées:\n`;
    message += formatDataSection(entry.metadata);
    message += '\n';
  }

  message += `${subSeparator}\n`;
  message += `  📈 Données Extraites:\n`;
  message += formatDataSection(entry.data);
  message += `\n${separator}\n`;

  // Write to file
  fs.appendFileSync(logPath, message, 'utf8');

  // Also log to console (condensed version)
  console.log(`[ExtractionLogger] ${entry.category} logged for ${entry.source}${entry.year ? ` (${entry.year})` : ''}`);
}

// Convenience functions for specific categories

/**
 * Log document extraction (Gemini Vision)
 */
export function logDocumentExtraction(
  filename: string,
  siret: string,
  year: number | null,
  documentType: string,
  extractedData: {
    bilan_actif?: any;
    bilan_passif?: any;
    compte_resultat?: any;
    sig?: any;
    key_values?: any;
  },
  confidence: number
): void {
  // Build flattened data for logging
  const data: Record<string, any> = {
    document_type: documentType,
    confidence: `${(confidence * 100).toFixed(0)}%`
  };

  // Key values (CA, EBE, etc.)
  if (extractedData.key_values) {
    const kv = extractedData.key_values;
    data['──────────────── INDICATEURS CLÉS'] = '';
    data.chiffre_affaires = kv.chiffre_affaires;
    data.marge_commerciale = kv.marge_commerciale;
    data.marge_brute_globale = kv.marge_brute_globale;
    data.valeur_ajoutee = kv.valeur_ajoutee;
    data.charges_externes = kv.charges_externes || kv.autres_achats_charges_externes;
    data.charges_personnel = kv.charges_personnel;
    data.salaires_personnel = kv.salaires_personnel;
    data.charges_sociales_personnel = kv.charges_sociales_personnel;
    data.charges_exploitant = kv.charges_exploitant;
    data.ebe = kv.ebe;
    data.resultat_exploitation = kv.resultat_exploitation;
    data.resultat_net = kv.resultat_net;
  }

  // Bilan Actif
  if (extractedData.bilan_actif) {
    const ba = extractedData.bilan_actif;
    data['──────────────── BILAN ACTIF'] = '';
    data.total_actif_immobilise = ba.total_actif_immobilise?.net || ba.total_actif_immobilise;
    data.total_actif_circulant = ba.total_actif_circulant;
    data.total_general_actif = ba.total_general_actif;
    data.disponibilites = ba.disponibilites;
    data.stocks_marchandises = ba.stocks_marchandises;
    data.creances_clients = ba.creances_clients;
  }

  // Bilan Passif
  if (extractedData.bilan_passif) {
    const bp = extractedData.bilan_passif;
    data['──────────────── BILAN PASSIF'] = '';
    data.total_capitaux_propres = bp.total_capitaux_propres;
    data.total_dettes = bp.total_dettes;
    data.total_general_passif = bp.total_general_passif;
    data.emprunts_etablissements_credit = bp.emprunts_etablissements_credit;
    data.dettes_fournisseurs = bp.dettes_fournisseurs;
    data.dettes_fiscales_sociales = bp.dettes_fiscales_sociales;
  }

  // SIG
  if (extractedData.sig) {
    const sig = extractedData.sig;
    data['──────────────── SIG (% CA)'] = '';
    if (sig.chiffre_affaires) data.sig_ca = `${sig.chiffre_affaires.valeur} (${sig.chiffre_affaires.pct_ca}%)`;
    if (sig.marge_commerciale) data.sig_marge = `${sig.marge_commerciale.valeur} (${sig.marge_commerciale.pct_ca}%)`;
    if (sig.valeur_ajoutee) data.sig_va = `${sig.valeur_ajoutee.valeur} (${sig.valeur_ajoutee.pct_ca}%)`;
    if (sig.ebe) data.sig_ebe = `${sig.ebe.valeur} (${sig.ebe.pct_ca}%)`;
    if (sig.charges_exploitant) data.sig_charges_exploitant = `${sig.charges_exploitant.valeur} (${sig.charges_exploitant.pct_ca}%)`;
    if (sig.resultat_net) data.sig_resultat_net = `${sig.resultat_net.valeur} (${sig.resultat_net.pct_ca}%)`;
  }

  // Compte de Résultat
  if (extractedData.compte_resultat) {
    const cr = extractedData.compte_resultat;
    data['──────────────── COMPTE DE RÉSULTAT'] = '';
    data.cr_ca_net = cr.chiffre_affaires_net;
    data.cr_achats_marchandises = cr.achats_marchandises;
    data.cr_autres_achats_charges = cr.autres_achats_charges_externes;
    data.cr_salaires = cr.salaires_traitements;
    data.cr_charges_sociales = cr.charges_sociales;
    data.cr_dotations_amort = cr.dotations_amortissements_immob;
    data.cr_resultat_exploitation = cr.resultat_exploitation;
    data.cr_resultat_net = cr.resultat_net;
  }

  logExtraction({
    category: 'DOCUMENT',
    source: filename,
    siret,
    year: year || undefined,
    data,
    metadata: {
      extraction_method: 'gemini_vision',
      confidence
    }
  });
}

/**
 * Log user comments
 */
export function logUserComments(siret: string, userComments: any): void {
  if (!userComments || Object.keys(userComments).length === 0) {
    return;
  }

  const data: Record<string, any> = {};

  // Loyer
  if (userComments.loyer) {
    data['──────────────── LOYER'] = '';
    data.loyer_actuel_mensuel = userComments.loyer.loyer_actuel_mensuel;
    data.futur_loyer_commercial = userComments.loyer.futur_loyer_commercial;
    data.loyer_logement_perso = userComments.loyer.loyer_logement_perso;
    data.loyer_commentaire = userComments.loyer.commentaire;
  }

  // Travaux
  if (userComments.travaux) {
    data['──────────────── TRAVAUX'] = '';
    data.travaux_budget_prevu = userComments.travaux.budget_prevu;
    data.travaux_commentaire = userComments.travaux.commentaire;
  }

  // Conditions de vente
  if (userComments.conditions_vente) {
    data['──────────────── CONDITIONS DE VENTE'] = '';
    data.negociation_possible = userComments.conditions_vente.negociation_possible;
    data.conditions_commentaire = userComments.conditions_vente.commentaire;
  }

  // Salaire dirigeant
  if (userComments.salaire_dirigeant) {
    data['──────────────── RÉMUNÉRATION'] = '';
    data.salaire_dirigeant = userComments.salaire_dirigeant;
  }

  // Salariés
  if (userComments.salaries_non_repris) {
    data['──────────────── SALARIÉS'] = '';
    data.salaries_non_repris_nombre = userComments.salaries_non_repris.nombre;
    data.salaries_non_repris_masse = userComments.salaries_non_repris.masse_salariale_annuelle;
    data.salaries_non_repris_motif = userComments.salaries_non_repris.motif;
  }

  if (userComments.salaires_saisonniers_prevus) {
    data.salaires_saisonniers_prevus = userComments.salaires_saisonniers_prevus;
  }

  // Apport personnel
  if (userComments.apport_personnel) {
    data['──────────────── FINANCEMENT'] = '';
    data.apport_personnel = userComments.apport_personnel;
  }

  // Autres commentaires
  if (userComments.autres) {
    data['──────────────── AUTRES'] = '';
    data.commentaires_libres = userComments.autres;
  }

  logExtraction({
    category: 'USER_COMMENT',
    source: 'frontend',
    siret,
    data
  });
}

/**
 * Log calculated SIG
 */
export function logSigCalculation(
  siret: string,
  year: number,
  sig: {
    chiffre_affaires: number;
    marge_commerciale: number;
    marge_brute_globale?: number;
    valeur_ajoutee: number;
    charges_externes?: number;
    charges_personnel?: number;
    ebe: number;
    resultat_exploitation: number;
    resultat_net: number;
    charges_exploitant?: number;
  },
  pctCA: Record<string, number>
): void {
  const data: Record<string, any> = {
    '──────────────── VALEURS ABSOLUES': '',
    ca: `${sig.chiffre_affaires.toLocaleString('fr-FR')} €`,
    marge_commerciale: `${sig.marge_commerciale.toLocaleString('fr-FR')} €`,
    marge_brute_globale: sig.marge_brute_globale ? `${sig.marge_brute_globale.toLocaleString('fr-FR')} €` : 'N/A',
    valeur_ajoutee: `${sig.valeur_ajoutee.toLocaleString('fr-FR')} €`,
    charges_externes: sig.charges_externes ? `${sig.charges_externes.toLocaleString('fr-FR')} €` : 'N/A',
    charges_personnel: sig.charges_personnel ? `${sig.charges_personnel.toLocaleString('fr-FR')} €` : 'N/A',
    ebe: `${sig.ebe.toLocaleString('fr-FR')} €`,
    resultat_exploitation: `${sig.resultat_exploitation.toLocaleString('fr-FR')} €`,
    resultat_net: `${sig.resultat_net.toLocaleString('fr-FR')} €`,
    charges_exploitant: sig.charges_exploitant ? `${sig.charges_exploitant.toLocaleString('fr-FR')} €` : 'N/A',
    '──────────────── POURCENTAGES CA': '',
    pct_marge: `${pctCA.marge_commerciale?.toFixed(1) || 0}%`,
    pct_marge_brute_globale: pctCA.marge_brute_globale ? `${pctCA.marge_brute_globale.toFixed(1)}%` : 'N/A',
    pct_va: `${pctCA.valeur_ajoutee?.toFixed(1) || 0}%`,
    pct_ebe: `${pctCA.ebe?.toFixed(1) || 0}%`,
    pct_rex: `${pctCA.resultat_exploitation?.toFixed(1) || 0}%`,
    pct_rn: `${pctCA.resultat_net?.toFixed(1) || 0}%`
  };

  logExtraction({
    category: 'SIG',
    source: 'calculateSigTool',
    siret,
    year,
    data
  });
}

/**
 * Log EBE retraitements
 */
export function logEbeRetraitement(
  siret: string,
  year: number,
  ebeComptable: number,
  ebeNormatif: number,
  retraitements: Array<{
    type: string;
    description: string;
    montant: number;
    source: string;
  }>
): void {
  const data: Record<string, any> = {
    ebe_comptable: `${ebeComptable.toLocaleString('fr-FR')} €`,
    ebe_normatif: `${ebeNormatif.toLocaleString('fr-FR')} €`,
    delta: `${(ebeNormatif - ebeComptable).toLocaleString('fr-FR')} €`,
    '──────────────── RETRAITEMENTS': ''
  };

  for (const r of retraitements) {
    const sign = r.montant >= 0 ? '+' : '';
    data[`  ${r.type}`] = `${sign}${r.montant.toLocaleString('fr-FR')} € (${r.source})`;
  }

  logExtraction({
    category: 'EBE_RETRAITEMENT',
    source: 'calculateEbeRetraitementTool',
    siret,
    year,
    data
  });
}

/**
 * Log transaction costs extraction
 */
export function logTransactionCosts(
  siret: string,
  costs: {
    prix_fonds: number;
    honoraires_ht?: number;
    frais_acte_ht?: number;
    debours?: number;
    droits_enregistrement?: number;
    tva?: number;
    stock_fonds_roulement?: number;
    loyer_avance?: number;
    total_investissement: number;
    apport_requis?: number;
    credit_sollicite?: number;
    duree_credit_mois?: number;
    taux_credit?: number;
    mensualites?: number;
  }
): void {
  // Helper pour formater les montants
  const fmt = (v?: number) => v ? `${v.toLocaleString('fr-FR')} €` : '-';
  const fmtPct = (v?: number) => v ? `${v}%` : '-';
  const fmtMois = (v?: number) => v ? `${v} mois` : '-';

  logExtraction({
    category: 'DOCUMENT',
    source: 'extractTransactionCostsTool',
    siret,
    data: {
      '──────────────── COÛTS D\'ACQUISITION': '',
      prix_fonds: fmt(costs.prix_fonds),
      honoraires_ht: fmt(costs.honoraires_ht),
      frais_acte_ht: fmt(costs.frais_acte_ht),
      debours: fmt(costs.debours),
      droits_enregistrement: fmt(costs.droits_enregistrement),
      tva: fmt(costs.tva),
      stock_fonds_roulement: fmt(costs.stock_fonds_roulement),
      loyer_avance: fmt(costs.loyer_avance),
      '──────────────────────────────': '',
      'TOTAL INVESTISSEMENT': fmt(costs.total_investissement),
      '──────────────── FINANCEMENT': '',
      apport_requis: fmt(costs.apport_requis),
      credit_sollicite: fmt(costs.credit_sollicite),
      duree_credit: fmtMois(costs.duree_credit_mois),
      taux_credit: fmtPct(costs.taux_credit),
      mensualites: fmt(costs.mensualites)
    }
  });
}

/**
 * Log valorisation results
 */
export function logValorisation(
  siret: string,
  valorisation: {
    methode_ebe?: { valeur: number; multiple?: number };
    methode_ca?: { valeur: number; pourcentage?: number };
    methode_patrimoniale?: { valeur: number };
    methode_hybride?: { valeur_totale: number };
    recommendation?: { valeur_min: number; valeur_max: number; valeur_mediane: number };
  }
): void {
  const data: Record<string, any> = {};

  if (valorisation.methode_ebe) {
    data['méthode_EBE'] = `${valorisation.methode_ebe.valeur.toLocaleString('fr-FR')} € (×${valorisation.methode_ebe.multiple || 'N/A'})`;
  }

  if (valorisation.methode_ca) {
    data['méthode_CA'] = `${valorisation.methode_ca.valeur.toLocaleString('fr-FR')} € (${valorisation.methode_ca.pourcentage || 'N/A'}%)`;
  }

  if (valorisation.methode_patrimoniale) {
    data['méthode_Patrimoniale'] = `${valorisation.methode_patrimoniale.valeur.toLocaleString('fr-FR')} €`;
  }

  if (valorisation.methode_hybride) {
    data['méthode_Hybride_Tabac'] = `${valorisation.methode_hybride.valeur_totale.toLocaleString('fr-FR')} €`;
  }

  if (valorisation.recommendation) {
    data['──────────────── RECOMMANDATION'] = '';
    data.valeur_min = `${valorisation.recommendation.valeur_min.toLocaleString('fr-FR')} €`;
    data.valeur_max = `${valorisation.recommendation.valeur_max.toLocaleString('fr-FR')} €`;
    data.valeur_mediane = `${valorisation.recommendation.valeur_mediane.toLocaleString('fr-FR')} €`;
  }

  logExtraction({
    category: 'VALORISATION',
    source: 'ValorisationAgent',
    siret,
    data
  });
}

/**
 * Log immobilier analysis
 */
export function logImmobilier(
  siret: string,
  immobilier: {
    bail?: {
      loyer_annuel_hc?: number;
      charges_annuelles?: number;
      date_fin?: string;
      duree_bail?: number;
    };
    simulationLoyer?: {
      loyer_actuel?: number;
      loyer_negocie?: number;
      economie_annuelle?: number;
    };
    travaux?: {
      budget_obligatoire?: number;
      budget_recommande?: number;
    };
  }
): void {
  const data: Record<string, any> = {};

  if (immobilier.bail) {
    data['──────────────── BAIL'] = '';
    data.loyer_annuel_hc = immobilier.bail.loyer_annuel_hc ? `${immobilier.bail.loyer_annuel_hc.toLocaleString('fr-FR')} €/an` : 'N/A';
    data.charges_annuelles = immobilier.bail.charges_annuelles ? `${immobilier.bail.charges_annuelles.toLocaleString('fr-FR')} €/an` : 'N/A';
    data.date_fin = immobilier.bail.date_fin || 'N/A';
    data.duree_bail = immobilier.bail.duree_bail ? `${immobilier.bail.duree_bail} ans` : 'N/A';
  }

  if (immobilier.simulationLoyer) {
    data['──────────────── SIMULATION LOYER'] = '';
    data.loyer_actuel = immobilier.simulationLoyer.loyer_actuel ? `${immobilier.simulationLoyer.loyer_actuel.toLocaleString('fr-FR')} €/an` : 'N/A';
    data.loyer_negocie = immobilier.simulationLoyer.loyer_negocie ? `${immobilier.simulationLoyer.loyer_negocie.toLocaleString('fr-FR')} €/an` : 'N/A';
    data.economie_annuelle = immobilier.simulationLoyer.economie_annuelle ? `${immobilier.simulationLoyer.economie_annuelle.toLocaleString('fr-FR')} €/an` : 'N/A';
  }

  if (immobilier.travaux) {
    data['──────────────── TRAVAUX'] = '';
    data.budget_obligatoire = immobilier.travaux.budget_obligatoire ? `${immobilier.travaux.budget_obligatoire.toLocaleString('fr-FR')} €` : 'N/A';
    data.budget_recommande = immobilier.travaux.budget_recommande ? `${immobilier.travaux.budget_recommande.toLocaleString('fr-FR')} €` : 'N/A';
  }

  logExtraction({
    category: 'IMMOBILIER',
    source: 'ImmobilierAgent',
    siret,
    data
  });
}

/**
 * Log business plan projections
 */
export function logBusinessPlan(
  siret: string,
  businessPlan: {
    projections: Array<{
      annee: number;
      label: string;
      ca: number;
      ebe_normatif: number;
      charges_fixes: number;
      annuite_emprunt: number;
      reste_apres_dette: number;
    }>;
    indicateursBancaires: {
      ratioCouvertureDette: number;
      capaciteAutofinancement: number;
      rentabiliteCapitauxInvestis: number;
      delaiRetourInvestissement: number;
      investissementTotal: number;
      montantEmprunte: number;
      annuiteEmprunt: number;
      appreciation: string;
    };
    hypotheses: {
      prixAchat?: number;
      montantTravaux?: number;
      apportPersonnel?: number;
      loyerNegocie?: number;
    };
    isTabac?: boolean;
  }
): void {
  const data: Record<string, any> = {};

  // Projections CA/EBE
  data['──────────────── PROJECTIONS 5 ANS'] = '';
  for (const p of businessPlan.projections) {
    data[`Année ${p.annee} (${p.label})`] = `CA: ${p.ca.toLocaleString('fr-FR')} € | EBE: ${p.ebe_normatif.toLocaleString('fr-FR')} € | Reste: ${p.reste_apres_dette.toLocaleString('fr-FR')} €`;
  }

  // Indicateurs bancaires
  data['──────────────── INDICATEURS BANCAIRES'] = '';
  data.ratio_couverture_dette = `${businessPlan.indicateursBancaires.ratioCouvertureDette}x (cible > 1.5)`;
  data.capacite_autofinancement = `${businessPlan.indicateursBancaires.capaciteAutofinancement.toLocaleString('fr-FR')} €`;
  data.rentabilite_roi = `${businessPlan.indicateursBancaires.rentabiliteCapitauxInvestis}%`;
  data.delai_retour = `${businessPlan.indicateursBancaires.delaiRetourInvestissement} ans`;
  data.appreciation = businessPlan.indicateursBancaires.appreciation;

  // Investissement
  data['──────────────── INVESTISSEMENT'] = '';
  data.investissement_total = `${businessPlan.indicateursBancaires.investissementTotal.toLocaleString('fr-FR')} €`;
  data.montant_emprunte = `${businessPlan.indicateursBancaires.montantEmprunte.toLocaleString('fr-FR')} €`;
  data.annuite_emprunt = `${businessPlan.indicateursBancaires.annuiteEmprunt.toLocaleString('fr-FR')} €/an`;

  // Hypothèses
  if (businessPlan.hypotheses) {
    data['──────────────── HYPOTHESES'] = '';
    if (businessPlan.hypotheses.prixAchat) {
      data.prix_achat = `${businessPlan.hypotheses.prixAchat.toLocaleString('fr-FR')} €`;
    }
    if (businessPlan.hypotheses.montantTravaux) {
      data.travaux = `${businessPlan.hypotheses.montantTravaux.toLocaleString('fr-FR')} €`;
    }
    if (businessPlan.hypotheses.apportPersonnel) {
      data.apport_personnel = `${businessPlan.hypotheses.apportPersonnel.toLocaleString('fr-FR')} €`;
    }
    if (businessPlan.hypotheses.loyerNegocie) {
      data.loyer_negocie = `${businessPlan.hypotheses.loyerNegocie.toLocaleString('fr-FR')} €/an`;
    }
  }

  if (businessPlan.isTabac) {
    data.type_commerce = 'TABAC (méthode hybride)';
  }

  logExtraction({
    category: 'BUSINESS_PLAN',
    source: 'businessPlanDynamiqueTool',
    siret,
    data
  });
}

export default {
  logExtraction,
  logDocumentExtraction,
  logUserComments,
  logSigCalculation,
  logEbeRetraitement,
  logTransactionCosts,
  logValorisation,
  logImmobilier,
  logBusinessPlan
};

/**
 * Schema d'extraction pour documents COMPTA préprocessés
 *
 * Structure optimisée pour les documents comptables français standardisés
 * contenant 4 sections : Bilan Actif, Bilan Passif, Compte de Résultat, SIG
 *
 * @see data/documents/{SIREN}/A_ANALYSER/COMPTA{YEAR}.pdf
 */

import { z } from 'zod';

// ============================================================================
// INTERFACES TYPESCRIPT
// ============================================================================

/**
 * Valeur avec Brut/Amortissements/Net pour les immobilisations
 */
export interface ValeurImmobilisation {
  brut: number;
  amort: number;
  net: number;
}

/**
 * Valeur SIG avec montant et pourcentage du CA
 */
export interface ValeurSig {
  valeur: number;
  pct_ca: number;
}

// ----------------------------------------------------------------------------
// BILAN ACTIF
// ----------------------------------------------------------------------------

export interface BilanActifExtraction {
  // Immobilisations incorporelles
  frais_etablissement?: ValeurImmobilisation;
  frais_developpement?: ValeurImmobilisation;
  concessions_brevets?: ValeurImmobilisation;
  fonds_commercial?: ValeurImmobilisation;
  autres_immob_incorp?: ValeurImmobilisation;
  avances_acomptes_immob_incorp?: ValeurImmobilisation;

  // Immobilisations corporelles
  terrains?: ValeurImmobilisation;
  constructions?: ValeurImmobilisation;
  installations_techniques?: ValeurImmobilisation;
  autres_immob_corp?: ValeurImmobilisation;
  immob_en_cours?: ValeurImmobilisation;
  avances_acomptes_immob_corp?: ValeurImmobilisation;

  // Immobilisations financières (pas d'amortissement, seulement valeur nette)
  participations?: number;
  creances_participations?: number;
  autres_titres_immob?: number;
  prets?: number;
  autres_immob_fin?: number;

  // Total actif immobilisé
  total_actif_immobilise: ValeurImmobilisation;

  // Stocks et en-cours (valeur nette)
  stocks_matieres_premieres?: number;
  stocks_encours_biens?: number;
  stocks_encours_services?: number;
  stocks_produits_finis?: number;
  stocks_marchandises: number;

  // Avances et acomptes versés
  avances_acomptes_verses?: number;

  // Créances (valeur nette)
  creances_clients: number;
  autres_creances: number;
  capital_souscrit_appele_non_verse?: number;

  // Trésorerie (valeur nette)
  valeurs_mobilieres_placement?: number;
  disponibilites: number;
  charges_constatees_avance: number;

  // Total actif circulant
  total_actif_circulant: number;

  // Comptes de régularisation
  frais_emission_emprunt?: number;
  primes_remboursement_obligations?: number;
  ecarts_conversion_actif?: number;

  // TOTAL GÉNÉRAL ACTIF
  total_general_actif: number;
}

// ----------------------------------------------------------------------------
// BILAN PASSIF
// ----------------------------------------------------------------------------

export interface BilanPassifExtraction {
  // Capitaux propres
  capital: number;
  primes_emission?: number;
  ecarts_reevaluation?: number;
  reserve_legale?: number;
  reserves_statutaires?: number;
  reserves_reglementees?: number;
  autres_reserves?: number;
  report_a_nouveau?: number;
  resultat_exercice: number;
  subventions_investissement?: number;
  provisions_reglementees?: number;
  total_capitaux_propres: number;

  // Autres fonds propres
  produits_emissions_titres_participatifs?: number;
  avances_conditionnees?: number;
  total_autres_fonds_propres?: number;

  // Provisions pour risques et charges
  provisions_risques?: number;
  provisions_charges?: number;
  total_provisions?: number;

  // Dettes financières
  emprunts_obligataires_convertibles?: number;
  autres_emprunts_obligataires?: number;
  emprunts_etablissements_credit: number;
  concours_bancaires_courants?: number;
  emprunts_dettes_financieres_diverses?: number;

  // Dettes d'exploitation
  avances_acomptes_recus?: number;
  dettes_fournisseurs: number;
  dettes_fiscales_sociales: number;
  dettes_immobilisations?: number;
  autres_dettes?: number;
  produits_constates_avance?: number;

  // Total dettes
  total_dettes: number;

  // Écarts de conversion
  ecarts_conversion_passif?: number;

  // TOTAL GÉNÉRAL PASSIF
  total_general_passif: number;

  // Information complémentaire (note bas de page)
  dettes_moins_1_an?: number;
}

// ----------------------------------------------------------------------------
// COMPTE DE RÉSULTAT
// ----------------------------------------------------------------------------

export interface CompteResultatExtraction {
  // PRODUITS D'EXPLOITATION
  ventes_marchandises: number;
  production_vendue_biens?: number;
  production_vendue_services: number;
  chiffre_affaires_net: number;
  production_stockee?: number;
  production_immobilisee?: number;
  subventions_exploitation?: number;
  reprises_depreciations_provisions?: number;
  transferts_charges?: number;
  autres_produits?: number;
  total_produits_exploitation: number;

  // CHARGES D'EXPLOITATION
  achats_marchandises: number;
  variation_stock_marchandises: number;
  achats_matieres_premieres?: number;
  variation_stock_matieres?: number;
  autres_achats_charges_externes: number;
  impots_taxes: number;
  salaires_traitements: number;
  charges_sociales: number;
  dotations_amortissements_immob: number;
  dotations_amortissements_charges?: number;
  dotations_provisions_actif?: number;
  dotations_provisions_risques?: number;
  autres_charges?: number;
  total_charges_exploitation: number;

  // RÉSULTAT D'EXPLOITATION
  resultat_exploitation: number;

  // PRODUITS FINANCIERS
  produits_participations?: number;
  produits_autres_vm?: number;
  autres_interets_produits?: number;
  reprises_provisions_financieres?: number;
  differences_change_positives?: number;
  produits_nets_cession_vmp?: number;
  total_produits_financiers: number;

  // CHARGES FINANCIÈRES
  dotations_provisions_financieres?: number;
  interets_charges_assimilees: number;
  differences_change_negatives?: number;
  charges_nettes_cession_vmp?: number;
  total_charges_financieres: number;

  // RÉSULTAT FINANCIER
  resultat_financier: number;

  // RÉSULTAT COURANT AVANT IMPÔTS
  resultat_courant_avant_impots: number;

  // PRODUITS EXCEPTIONNELS
  produits_except_operations_gestion?: number;
  produits_except_operations_capital?: number;
  reprises_provisions_except?: number;
  total_produits_exceptionnels: number;

  // CHARGES EXCEPTIONNELLES
  charges_except_operations_gestion?: number;
  charges_except_operations_capital?: number;
  dotations_provisions_except?: number;
  total_charges_exceptionnelles: number;

  // RÉSULTAT EXCEPTIONNEL
  resultat_exceptionnel: number;

  // IMPÔTS ET PARTICIPATION
  participation_salaries?: number;
  impots_sur_benefices?: number;

  // TOTAUX ET RÉSULTAT NET
  total_produits: number;
  total_charges: number;
  resultat_net: number;
}

// ----------------------------------------------------------------------------
// SIG - SOLDES INTERMÉDIAIRES DE GESTION
// ----------------------------------------------------------------------------

export interface SigExtraction {
  // Chiffre d'affaires total (référence pour % CA)
  chiffre_affaires: ValeurSig;

  // Marge commerciale
  ventes_marchandises: ValeurSig;
  cout_achat_marchandises_vendues: ValeurSig;
  marge_commerciale: ValeurSig;

  // Production
  production_vendue: ValeurSig;
  production_stockee?: ValeurSig;
  production_immobilisee?: ValeurSig;
  production_exercice: ValeurSig;

  // Marge brute
  marge_brute_production?: ValeurSig;
  marge_brute_globale: ValeurSig;

  // Valeur ajoutée
  autres_achats_charges_externes: ValeurSig;
  valeur_ajoutee: ValeurSig;

  // EBE - Excédent Brut d'Exploitation
  subventions_exploitation?: ValeurSig;
  impots_taxes: ValeurSig;
  salaires_personnel: ValeurSig;
  charges_sociales_personnel: ValeurSig;
  charges_exploitant: ValeurSig; // ← CRITIQUE : Salaire du dirigeant
  ebe: ValeurSig;

  // Résultat d'exploitation
  autres_produits_gestion?: ValeurSig;
  autres_charges_gestion?: ValeurSig;
  reprises_amortissements_provisions?: ValeurSig;
  dotations_amortissements: ValeurSig;
  dotations_provisions?: ValeurSig;
  resultat_exploitation: ValeurSig;

  // Résultat courant
  produits_financiers?: ValeurSig;
  charges_financieres?: ValeurSig;
  resultat_courant: ValeurSig;

  // Résultat exceptionnel
  produits_exceptionnels?: ValeurSig;
  charges_exceptionnelles?: ValeurSig;
  resultat_exceptionnel: ValeurSig;

  // Résultat net
  impots_sur_benefices?: ValeurSig;
  participation_salaries?: ValeurSig;
  resultat_net: ValeurSig;
}

// ----------------------------------------------------------------------------
// EXTRACTION COMPLÈTE
// ----------------------------------------------------------------------------

export interface ExtractionComptaComplete {
  // Métadonnées
  annee: number;
  societe: string;
  adresse?: string;
  date_cloture: string; // Format: "30/11/2023"
  duree_exercice_mois: number; // Généralement 12

  // Les 4 sections
  bilan_actif: BilanActifExtraction;
  bilan_passif: BilanPassifExtraction;
  compte_resultat: CompteResultatExtraction;
  sig: SigExtraction;

  // Méta extraction
  extraction_confidence: number; // 0-1
  source_document: string; // Nom du fichier
}

// ============================================================================
// SCHEMAS ZOD POUR VALIDATION
// ============================================================================

export const ValeurImmobilisationSchema = z.object({
  brut: z.number(),
  amort: z.number(),
  net: z.number()
});

export const ValeurSigSchema = z.object({
  valeur: z.number(),
  pct_ca: z.number()
});

export const BilanActifSchema = z.object({
  // Immobilisations incorporelles (toutes optionnelles sauf total)
  frais_etablissement: ValeurImmobilisationSchema.optional(),
  frais_developpement: ValeurImmobilisationSchema.optional(),
  concessions_brevets: ValeurImmobilisationSchema.optional(),
  fonds_commercial: ValeurImmobilisationSchema.optional(),
  autres_immob_incorp: ValeurImmobilisationSchema.optional(),

  // Immobilisations corporelles
  terrains: ValeurImmobilisationSchema.optional(),
  constructions: ValeurImmobilisationSchema.optional(),
  installations_techniques: ValeurImmobilisationSchema.optional(),
  autres_immob_corp: ValeurImmobilisationSchema.optional(),

  // Immobilisations financières
  participations: z.number().optional(),
  autres_immob_fin: z.number().optional(),

  // Total
  total_actif_immobilise: ValeurImmobilisationSchema,

  // Actif circulant
  stocks_marchandises: z.number(),
  creances_clients: z.number(),
  autres_creances: z.number(),
  disponibilites: z.number(),
  charges_constatees_avance: z.number(),
  total_actif_circulant: z.number(),

  // Total général
  total_general_actif: z.number()
}).passthrough(); // Permet champs additionnels

export const BilanPassifSchema = z.object({
  // Capitaux propres
  capital: z.number(),
  report_a_nouveau: z.number().optional(),
  resultat_exercice: z.number(),
  subventions_investissement: z.number().optional(),
  total_capitaux_propres: z.number(),

  // Provisions
  provisions_risques: z.number().optional(),
  provisions_charges: z.number().optional(),
  total_provisions: z.number().optional(),

  // Dettes
  emprunts_etablissements_credit: z.number(),
  concours_bancaires_courants: z.number().optional(),
  dettes_fournisseurs: z.number(),
  dettes_fiscales_sociales: z.number(),
  autres_dettes: z.number().optional(),
  produits_constates_avance: z.number().optional(),
  total_dettes: z.number(),

  // Total
  total_general_passif: z.number(),

  // Info complémentaire
  dettes_moins_1_an: z.number().optional()
}).passthrough();

export const CompteResultatSchema = z.object({
  // Produits exploitation
  ventes_marchandises: z.number(),
  production_vendue_services: z.number(),
  chiffre_affaires_net: z.number(),
  total_produits_exploitation: z.number(),

  // Charges exploitation
  achats_marchandises: z.number(),
  variation_stock_marchandises: z.number(),
  autres_achats_charges_externes: z.number(),
  impots_taxes: z.number(),
  salaires_traitements: z.number(),
  charges_sociales: z.number(),
  dotations_amortissements_immob: z.number(),
  total_charges_exploitation: z.number(),

  // Résultats
  resultat_exploitation: z.number(),
  total_produits_financiers: z.number(),
  total_charges_financieres: z.number(),
  resultat_financier: z.number(),
  resultat_courant_avant_impots: z.number(),
  total_produits_exceptionnels: z.number(),
  total_charges_exceptionnelles: z.number(),
  resultat_exceptionnel: z.number(),
  resultat_net: z.number(),
  total_produits: z.number(),
  total_charges: z.number()
}).passthrough();

export const SigSchema = z.object({
  chiffre_affaires: ValeurSigSchema,
  ventes_marchandises: ValeurSigSchema,
  cout_achat_marchandises_vendues: ValeurSigSchema,
  marge_commerciale: ValeurSigSchema,
  production_vendue: ValeurSigSchema,
  production_exercice: ValeurSigSchema,
  marge_brute_globale: ValeurSigSchema,
  autres_achats_charges_externes: ValeurSigSchema,
  valeur_ajoutee: ValeurSigSchema,
  impots_taxes: ValeurSigSchema,
  salaires_personnel: ValeurSigSchema,
  charges_sociales_personnel: ValeurSigSchema,
  charges_exploitant: ValeurSigSchema, // Salaire dirigeant
  ebe: ValeurSigSchema,
  dotations_amortissements: ValeurSigSchema,
  resultat_exploitation: ValeurSigSchema,
  resultat_courant: ValeurSigSchema,
  resultat_exceptionnel: ValeurSigSchema,
  resultat_net: ValeurSigSchema
}).passthrough();

export const ExtractionComptaCompleteSchema = z.object({
  annee: z.number(),
  societe: z.string(),
  adresse: z.string().optional(),
  date_cloture: z.string(),
  duree_exercice_mois: z.number(),

  bilan_actif: BilanActifSchema,
  bilan_passif: BilanPassifSchema,
  compte_resultat: CompteResultatSchema,
  sig: SigSchema,

  extraction_confidence: z.number().min(0).max(1),
  source_document: z.string()
});

// Types inférés des schemas Zod
export type BilanActifZod = z.infer<typeof BilanActifSchema>;
export type BilanPassifZod = z.infer<typeof BilanPassifSchema>;
export type CompteResultatZod = z.infer<typeof CompteResultatSchema>;
export type SigZod = z.infer<typeof SigSchema>;
export type ExtractionComptaCompleteZod = z.infer<typeof ExtractionComptaCompleteSchema>;

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Vérifie si un document est un fichier COMPTA préprocessé
 */
export function isComptaPreprocessedDocument(filename: string, filePath?: string): boolean {
  const isComptaFilename = /^COMPTA\d{4}\.pdf$/i.test(filename);
  const isInAnalyserFolder = filePath?.includes('A_ANALYSER') ?? false;

  return isComptaFilename || isInAnalyserFolder;
}

/**
 * Extrait l'année d'un nom de fichier COMPTA
 */
export function extractYearFromComptaFilename(filename: string): number | null {
  const match = filename.match(/COMPTA(\d{4})\.pdf/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Valide la cohérence Actif = Passif
 */
export function validateBilanCoherence(
  actif: BilanActifExtraction,
  passif: BilanPassifExtraction
): { valid: boolean; ecart: number; ecartPct: number } {
  const totalActif = actif.total_general_actif;
  const totalPassif = passif.total_general_passif;
  const ecart = Math.abs(totalActif - totalPassif);
  const ecartPct = totalActif > 0 ? (ecart / totalActif) * 100 : 0;

  // Tolérance de 0.1% (erreurs d'arrondi)
  const valid = ecartPct < 0.1;

  return { valid, ecart, ecartPct };
}

/**
 * Extrait le salaire dirigeant depuis le SIG
 * Utile pour le retraitement EBE
 */
export function extractSalaireDirigeantFromSig(sig: SigExtraction): number {
  return sig.charges_exploitant?.valeur ?? 0;
}

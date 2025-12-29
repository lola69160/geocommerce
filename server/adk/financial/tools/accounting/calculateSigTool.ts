import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';
import type { SigExtraction, ValeurSig } from '../../schemas/extractionComptaSchema';
import { logSigCalculation } from '../../../utils/extractionLogger';

/**
 * Calculate SIG Tool
 *
 * Calcule les Soldes Intermédiaires de Gestion (SIG) pour chaque année.
 * Les SIG sont les indicateurs clés de performance financière d'une entreprise.
 *
 * ⚠️ RÈGLE FONDAMENTALE (2025-12-29):
 * Les données historiques (années N, N-1, N-2...) doivent provenir UNIQUEMENT
 * des extractions de documents comptables. AUCUN recalcul, AUCUN fallback.
 * Seules les données futures (N+1, N+2...) peuvent être calculées/projetées.
 *
 * PRIORITÉ D'EXTRACTION:
 * 0. SIG extrait directement des documents COMPTA préprocessés (recommandé)
 * 1. key_values de l'extraction Gemini Vision (documents comptables uniquement)
 *
 * DOCUMENTS COMPTABLES VALIDES:
 * - liasse_fiscale, bilan, compte_resultat, compta
 *
 * DOCUMENTS EXCLUS (ne contiennent pas de données SIG):
 * - projet_vente, cout_transaction, bail, autre, offre_achat
 */

// Types de documents comptables valides pour l'extraction SIG
const COMPTABLE_DOC_TYPES = ['liasse_fiscale', 'bilan', 'compte_resultat', 'compte_de_resultat', 'compta'];

// Types de documents à EXCLURE (ne contiennent pas de données SIG historiques)
const EXCLUDED_DOC_TYPES = ['projet_vente', 'cout_transaction', 'bail', 'autre', 'offre_achat'];

// Priorité des documents (plus petit = plus prioritaire)
const DOC_PRIORITY: Record<string, number> = {
  'compta_preprocessed': 1,  // COMPTA2023.pdf (préprocessé par ComptaPreprocessingAgent)
  'liasse_fiscale': 2,
  'compte_resultat': 3,
  'bilan': 4
};

const CalculateSigInputSchema = z.object({
  // Optionnel - le tool lira automatiquement depuis state.documentExtraction
  debug: z.boolean().optional().describe('Mode debug pour logs détaillés')
});

// Schéma pour une valeur SIG avec % CA
const ValeurSigOutputSchema = z.object({
  valeur: z.number(),
  pct_ca: z.number().describe('Pourcentage du chiffre d\'affaires')
});

const SigForYearSchema = z.object({
  year: z.number(),
  source: z.enum(['compta_extraction', 'vision_key_values', 'table_parsing']).describe('Source des données'),

  // Valeurs avec % CA
  chiffre_affaires: ValeurSigOutputSchema,
  ventes_marchandises: ValeurSigOutputSchema.optional(),
  cout_achat_marchandises: ValeurSigOutputSchema.optional(),
  marge_commerciale: ValeurSigOutputSchema,
  production_exercice: ValeurSigOutputSchema.optional(),
  marge_brute_globale: ValeurSigOutputSchema.optional(),
  autres_achats_charges_externes: ValeurSigOutputSchema.optional(),
  valeur_ajoutee: ValeurSigOutputSchema,
  impots_taxes: ValeurSigOutputSchema.optional(),
  salaires_personnel: ValeurSigOutputSchema.optional(),
  charges_sociales_personnel: ValeurSigOutputSchema.optional(),
  charges_exploitant: ValeurSigOutputSchema.optional().describe('Salaire du dirigeant (CRITIQUE pour retraitement EBE)'),
  ebe: ValeurSigOutputSchema.describe('Excédent Brut d\'Exploitation'),
  dotations_amortissements: ValeurSigOutputSchema.optional(),
  resultat_exploitation: ValeurSigOutputSchema,
  produits_financiers: ValeurSigOutputSchema.optional(),
  charges_financieres: ValeurSigOutputSchema.optional(),
  resultat_financier: ValeurSigOutputSchema.optional(),
  resultat_courant: ValeurSigOutputSchema,
  produits_exceptionnels: ValeurSigOutputSchema.optional(),
  charges_exceptionnelles: ValeurSigOutputSchema.optional(),
  resultat_exceptionnel: ValeurSigOutputSchema.optional(),
  impots_sur_benefices: ValeurSigOutputSchema.optional(),
  resultat_net: ValeurSigOutputSchema,

  // Compatibilité avec l'ancien format (valeurs simples)
  _legacy: z.object({
    achats_marchandises: z.number(),
    production: z.number(),
    charges_personnel: z.number(),
    impots: z.number()
  }).optional()
});

const CalculateSigOutputSchema = z.object({
  sig: z.record(z.string(), SigForYearSchema),
  yearsAnalyzed: z.array(z.number()),
  error: z.string().optional()
});

export const calculateSigTool = new FunctionTool({
  name: 'calculateSig',
  description: 'Calcule les Soldes Intermédiaires de Gestion (SIG) pour chaque année à partir des documents extraits. Retourne un objet avec sig[year] = { chiffre_affaires, ebe, resultat_net, ... }',
  parameters: zToGen(CalculateSigInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    try {
      // Lire documentExtraction depuis state
      let documentExtraction = toolContext?.state.get('documentExtraction') as any;

      // Parser JSON string si nécessaire (pattern ADK)
      if (typeof documentExtraction === 'string') {
        try {
          documentExtraction = JSON.parse(documentExtraction);
        } catch (e) {
          return {
            sig: {},
            yearsAnalyzed: [],
            error: 'Failed to parse documentExtraction state (invalid JSON)'
          };
        }
      }

      if (!documentExtraction?.documents || documentExtraction.documents.length === 0) {
        return {
          sig: {},
          yearsAnalyzed: [],
          error: 'No documents found in state.documentExtraction'
        };
      }

      const { documents } = documentExtraction;

      // ============================================================
      // FILTRAGE STRICT: Seuls les documents comptables sont utilisés
      // ============================================================
      const documentsByYear: { [year: number]: any[] } = {};

      for (const doc of documents) {
        if (!doc.year) continue;

        const docType = (doc.documentType || '').toLowerCase();
        const filename = (doc.filename || '').toLowerCase();

        // Vérifier si c'est un document comptable valide
        const isPreprocessedCompta = filename.startsWith('compta');
        const isComptableDocType = COMPTABLE_DOC_TYPES.includes(docType);
        const isExcludedDocType = EXCLUDED_DOC_TYPES.includes(docType);

        // EXCLURE les documents non-comptables
        if (isExcludedDocType) {
          console.log(`[calculateSig] ⛔ EXCLUS: ${doc.filename} (type: ${docType}) - document non-comptable`);
          continue;
        }

        // INCLURE uniquement les documents comptables
        if (isPreprocessedCompta || isComptableDocType) {
          if (!documentsByYear[doc.year]) {
            documentsByYear[doc.year] = [];
          }
          // Marquer les documents préprocessés pour priorité
          doc._isPreprocessed = isPreprocessedCompta;
          doc._priority = isPreprocessedCompta ? DOC_PRIORITY['compta_preprocessed'] : (DOC_PRIORITY[docType] || 99);
          documentsByYear[doc.year].push(doc);
          console.log(`[calculateSig] ✅ INCLUS: ${doc.filename} (type: ${docType}, année: ${doc.year}, priorité: ${doc._priority})`);
        } else {
          console.log(`[calculateSig] ⚠️ IGNORÉ: ${doc.filename} (type: ${docType}) - type non reconnu comme comptable`);
        }
      }

      // Trier les documents par priorité pour chaque année (préprocessés en premier)
      for (const year of Object.keys(documentsByYear)) {
        documentsByYear[parseInt(year)].sort((a, b) => (a._priority || 99) - (b._priority || 99));
      }

      const years = Object.keys(documentsByYear).map(y => parseInt(y)).sort((a, b) => b - a);

      if (years.length === 0) {
        return {
          sig: {},
          yearsAnalyzed: [],
          error: 'No valid years found in documents'
        };
      }

      // Calculer les SIG pour chaque année
      const sig: { [year: string]: any } = {};

      for (const year of years) {
        const yearDocs = documentsByYear[year];

        // ============================================================
        // PRIORITÉ 0: SIG extrait directement des documents COMPTA
        // ============================================================
        const extractedSig = findExtractedSig(yearDocs);

        if (extractedSig) {
          console.log(`[calculateSig] ✅ PRIORITÉ 0: Using extracted SIG from COMPTA document (year: ${year})`);
          console.log(`[calculateSig]   └─ CA: ${extractedSig.chiffre_affaires?.valeur || 0}€, EBE: ${extractedSig.ebe?.valeur || 0}€, RN: ${extractedSig.resultat_net?.valeur || 0}€`);
          console.log(`[calculateSig]   └─ Charges exploitant (salaire dirigeant): ${extractedSig.charges_exploitant?.valeur || 0}€`);

          sig[year.toString()] = convertExtractedSigToOutput(year, extractedSig);
          continue;
        }

        // ============================================================
        // PRIORITÉ 1: key_values de l'extraction Gemini Vision
        // ⚠️ EXTRACTION STRICTE: Pas de recalcul pour données historiques
        // ============================================================
        const values = extractAccountingValues(yearDocs);

        console.log(`[calculateSig] 📊 PRIORITÉ 1: Using Vision key_values for year ${year}`);
        console.log(`[calculateSig]   └─ Source: ${values.source}`);

        // ⚠️ RÈGLE FONDAMENTALE: Utiliser UNIQUEMENT les valeurs extraites
        // AUCUN RECALCUL pour les données historiques
        const marge_commerciale = values.marge_commerciale_directe;
        const valeur_ajoutee = values.valeur_ajoutee_directe;
        const ebe = values.ebe_direct;
        const resultat_exploitation = values.resultat_exploitation_direct;
        const resultat_net = values.resultat_net_direct;

        // Log des valeurs extraites (pour audit)
        console.log(`[calculateSig]   └─ Valeurs extraites (sans recalcul):`);
        console.log(`[calculateSig]       CA: ${values.chiffre_affaires}€`);
        console.log(`[calculateSig]       Marge commerciale: ${marge_commerciale}€`);
        console.log(`[calculateSig]       Valeur ajoutée: ${valeur_ajoutee}€`);
        console.log(`[calculateSig]       EBE: ${ebe}€`);
        console.log(`[calculateSig]       Résultat exploitation: ${resultat_exploitation}€`);
        console.log(`[calculateSig]       Résultat net: ${resultat_net}€`);

        // Avertissement si valeurs critiques manquantes (mais pas de fallback)
        if (values.chiffre_affaires === 0) {
          console.warn(`[calculateSig] ⚠️ ATTENTION: CA non extrait pour ${year} - vérifier les documents`);
        }
        if (ebe === 0 && marge_commerciale === 0) {
          console.warn(`[calculateSig] ⚠️ ATTENTION: EBE et Marge à 0 pour ${year} - vérifier l'extraction`);
        }

        // Calculer les % CA
        const ca = values.chiffre_affaires || 1; // Éviter division par 0
        const calcPctCa = (v: number) => ca > 0 ? Math.round((v / ca) * 10000) / 100 : 0;

        // Résultat courant = Résultat exploitation (si disponible) ou 0
        const resultat_courant = resultat_exploitation || 0;

        sig[year.toString()] = {
          year,
          source: values.source || 'vision_key_values',

          // Valeurs extraites (SANS recalcul) avec % CA
          chiffre_affaires: { valeur: values.chiffre_affaires, pct_ca: 100 },
          marge_commerciale: { valeur: marge_commerciale || 0, pct_ca: calcPctCa(marge_commerciale || 0) },
          valeur_ajoutee: { valeur: valeur_ajoutee || 0, pct_ca: calcPctCa(valeur_ajoutee || 0) },
          ebe: { valeur: ebe || 0, pct_ca: calcPctCa(ebe || 0) },
          resultat_exploitation: { valeur: resultat_exploitation || 0, pct_ca: calcPctCa(resultat_exploitation || 0) },
          resultat_courant: { valeur: resultat_courant, pct_ca: calcPctCa(resultat_courant) },
          resultat_net: { valeur: resultat_net || 0, pct_ca: calcPctCa(resultat_net || 0) },

          // Champs additionnels extraits directement (SANS recalcul)
          marge_brute_globale: values.marge_brute_globale_direct
            ? { valeur: values.marge_brute_globale_direct, pct_ca: calcPctCa(values.marge_brute_globale_direct) }
            : undefined,
          autres_achats_charges_externes: values.autres_achats_charges_externes_direct
            ? { valeur: values.autres_achats_charges_externes_direct, pct_ca: calcPctCa(values.autres_achats_charges_externes_direct) }
            : undefined,
          charges_exploitant: values.charges_exploitant_direct
            ? { valeur: values.charges_exploitant_direct, pct_ca: calcPctCa(values.charges_exploitant_direct) }
            : undefined,
          salaires_personnel: values.salaires_personnel_direct
            ? { valeur: values.salaires_personnel_direct, pct_ca: calcPctCa(values.salaires_personnel_direct) }
            : undefined,
          charges_sociales_personnel: values.charges_sociales_personnel_direct
            ? { valeur: values.charges_sociales_personnel_direct, pct_ca: calcPctCa(values.charges_sociales_personnel_direct) }
            : undefined,

          // Champs optionnels extraits
          impots_taxes: values.impots_taxes ? { valeur: values.impots_taxes, pct_ca: calcPctCa(values.impots_taxes) } : undefined,
          dotations_amortissements: values.dotations_amortissements ? { valeur: values.dotations_amortissements, pct_ca: calcPctCa(values.dotations_amortissements) } : undefined,
          resultat_financier: values.resultat_financier ? { valeur: values.resultat_financier, pct_ca: calcPctCa(values.resultat_financier) } : undefined,
          resultat_exceptionnel: values.resultat_exceptionnel ? { valeur: values.resultat_exceptionnel, pct_ca: calcPctCa(values.resultat_exceptionnel) } : undefined,

          // Compatibilité avec l'ancien format
          _legacy: {
            achats_marchandises: values.achats_marchandises,
            production: 0,  // Non utilisé car pas de recalcul
            charges_personnel: values.charges_personnel,
            impots: values.impots_societes
          }
        };
      }

      // Log SIG calculations to dedicated extraction log file
      const siret = (toolContext?.state.get('businessInfo') as any)?.siret || 'unknown';
      for (const year of years) {
        const s = sig[year.toString()];
        if (s) {
          logSigCalculation(
            siret,
            year,
            {
              chiffre_affaires: s.chiffre_affaires?.valeur || 0,
              marge_commerciale: s.marge_commerciale?.valeur || 0,
              marge_brute_globale: s.marge_brute_globale?.valeur || 0,
              valeur_ajoutee: s.valeur_ajoutee?.valeur || 0,
              charges_externes: s.autres_achats_charges_externes?.valeur || 0,
              charges_personnel: (s.salaires_personnel?.valeur || 0) + (s.charges_sociales_personnel?.valeur || 0),
              ebe: s.ebe?.valeur || 0,
              resultat_exploitation: s.resultat_exploitation?.valeur || 0,
              resultat_net: s.resultat_net?.valeur || 0,
              charges_exploitant: s.charges_exploitant?.valeur || 0
            },
            {
              marge_commerciale: s.marge_commerciale?.pct_ca || 0,
              marge_brute_globale: s.marge_brute_globale?.pct_ca || 0,
              valeur_ajoutee: s.valeur_ajoutee?.pct_ca || 0,
              ebe: s.ebe?.pct_ca || 0,
              resultat_exploitation: s.resultat_exploitation?.pct_ca || 0,
              resultat_net: s.resultat_net?.pct_ca || 0
            }
          );
        }
      }

      return {
        sig,
        yearsAnalyzed: years
      };

    } catch (error: any) {
      return {
        sig: {},
        yearsAnalyzed: [],
        error: error.message || 'SIG calculation failed'
      };
    }
  }
});

/**
 * Extrait les valeurs comptables depuis les documents d'une année.
 *
 * PRIORITÉ 1: Utilise key_values de Vision extraction (direct, précis)
 * PRIORITÉ 2: Parse les tableaux avec heuristiques (fallback)
 */
function extractAccountingValues(yearDocs: any[]): {
  source: 'vision_key_values' | 'table_parsing';
  chiffre_affaires: number;
  ventes_marchandises: number;
  achats_marchandises: number;
  production_vendue: number;
  production_stockee: number;
  production_immobilisee: number;
  consommations_externes: number;
  subventions: number;
  impots_taxes: number;
  charges_personnel: number;
  dotations_amortissements: number;
  autres_produits: number;
  autres_charges: number;
  resultat_financier: number;
  resultat_exceptionnel: number;
  impots_societes: number;
  // Direct SIG values (use these instead of calculating if > 0)
  marge_commerciale_directe: number;
  valeur_ajoutee_directe: number;
  ebe_direct: number;
  resultat_exploitation_direct: number;
  resultat_net_direct: number;
  // NEW: Additional SIG fields for complete extraction
  marge_brute_globale_direct: number;
  autres_achats_charges_externes_direct: number;
  charges_exploitant_direct: number;
  salaires_personnel_direct: number;
  charges_sociales_personnel_direct: number;
} {
  // PRIORITÉ 1: Utiliser key_values de Vision si disponible
  let hasKeyValues = false;
  let hasValidKeyValues = false;

  for (const doc of yearDocs) {
    if (doc.extractedData?.key_values && Object.keys(doc.extractedData.key_values).length > 0) {
      hasKeyValues = true;
      const kv = doc.extractedData.key_values;

      // Si key_values contient au moins CA ou EBE, c'est une extraction Vision réussie
      if (kv.chiffre_affaires || kv.ebe) {
        hasValidKeyValues = true;
        console.log('[calculateSig] ✅ Using Vision key_values (priority 1):', {
          doc: doc.name || 'unknown',
          ca: kv.chiffre_affaires,
          ebe: kv.ebe,
          rn: kv.resultat_net,
          keysCount: Object.keys(kv).length
        });

        return {
          source: 'vision_key_values' as const,
          chiffre_affaires: kv.chiffre_affaires || 0,
          ventes_marchandises: kv.ventes_marchandises || 0, // ✅ FIX: Use actual ventes_marchandises, NOT CA
          achats_marchandises: kv.achats_marchandises || 0,
          production_vendue: 0,
          production_stockee: 0,
          production_immobilisee: 0,
          consommations_externes: kv.consommations_externes || 0,
          subventions: 0,
          impots_taxes: 0,
          charges_personnel: kv.charges_personnel || 0,
          dotations_amortissements: kv.dotations_amortissements || 0,
          autres_produits: 0,
          autres_charges: 0,
          resultat_financier: 0,
          resultat_exceptionnel: 0,
          impots_societes: 0,
          // ✅ Direct SIG values from Gemini extraction (use these if available instead of calculating)
          marge_commerciale_directe: kv.marge_commerciale || 0,
          valeur_ajoutee_directe: kv.valeur_ajoutee || 0,
          ebe_direct: kv.ebe || 0,
          resultat_exploitation_direct: kv.resultat_exploitation || 0,
          resultat_net_direct: kv.resultat_net || 0,
          // ✅ NEW: Additional SIG fields for complete extraction (Issue #1 fix)
          marge_brute_globale_direct: kv.marge_brute_globale || 0,
          autres_achats_charges_externes_direct: kv.autres_achats_charges_externes || kv.charges_externes || 0,
          charges_exploitant_direct: kv.charges_exploitant || 0,
          salaires_personnel_direct: kv.salaires_personnel || 0,
          charges_sociales_personnel_direct: kv.charges_sociales_personnel || 0
        };
      } else {
        console.log('[calculateSig] ⚠️ Vision key_values found but incomplete (no CA/EBE):', {
          doc: doc.name || 'unknown',
          keysCount: Object.keys(kv).length,
          keys: Object.keys(kv)
        });
      }
    }
  }

  // Log du fallback avec diagnostic
  if (hasKeyValues && !hasValidKeyValues) {
    console.log('[calculateSig] 🔄 Vision key_values incomplete, falling back to table parsing (priority 2)');
  } else if (!hasKeyValues) {
    console.log('[calculateSig] 🔄 No Vision key_values found, using table parsing (priority 2)');
  }

  // PRIORITÉ 2: Parser les tableaux avec heuristiques (logique existante)
  const values: {
    source: 'vision_key_values' | 'table_parsing';
    chiffre_affaires: number;
    ventes_marchandises: number;
    achats_marchandises: number;
    production_vendue: number;
    production_stockee: number;
    production_immobilisee: number;
    consommations_externes: number;
    subventions: number;
    impots_taxes: number;
    charges_personnel: number;
    dotations_amortissements: number;
    autres_produits: number;
    autres_charges: number;
    resultat_financier: number;
    resultat_exceptionnel: number;
    impots_societes: number;
    marge_commerciale_directe: number;
    valeur_ajoutee_directe: number;
    ebe_direct: number;
    resultat_exploitation_direct: number;
    resultat_net_direct: number;
    // NEW: Additional SIG fields
    marge_brute_globale_direct: number;
    autres_achats_charges_externes_direct: number;
    charges_exploitant_direct: number;
    salaires_personnel_direct: number;
    charges_sociales_personnel_direct: number;
  } = {
    source: 'table_parsing',
    chiffre_affaires: 0,
    ventes_marchandises: 0,
    achats_marchandises: 0,
    production_vendue: 0,
    production_stockee: 0,
    production_immobilisee: 0,
    consommations_externes: 0,
    subventions: 0,
    impots_taxes: 0,
    charges_personnel: 0,
    dotations_amortissements: 0,
    autres_produits: 0,
    autres_charges: 0,
    resultat_financier: 0,
    resultat_exceptionnel: 0,
    impots_societes: 0,
    marge_commerciale_directe: 0,
    valeur_ajoutee_directe: 0,
    ebe_direct: 0,
    resultat_exploitation_direct: 0,
    resultat_net_direct: 0,
    // NEW: Additional SIG fields
    marge_brute_globale_direct: 0,
    autres_achats_charges_externes_direct: 0,
    charges_exploitant_direct: 0,
    salaires_personnel_direct: 0,
    charges_sociales_personnel_direct: 0
  };

  // Parser les tableaux extraits
  for (const doc of yearDocs) {
    if (!doc.extractedData?.tables) continue;

    for (const table of doc.extractedData.tables) {
      if (!table.rows) continue;

      for (const row of table.rows) {
        if (!row || row.length === 0) continue;

        const label = (row[0] || '').toLowerCase().trim();
        const value = parseFloat((row[1] || '0').replace(/\s/g, '').replace(',', '.')) || 0;

        // Matching des postes comptables (heuristiques)
        if (label.includes('chiffre') && label.includes('affaires')) {
          values.chiffre_affaires = Math.max(values.chiffre_affaires, value);
        } else if (label.includes('ventes') && label.includes('marchandises')) {
          values.ventes_marchandises = Math.max(values.ventes_marchandises, value);
        } else if (label.includes('achats') && label.includes('marchandises')) {
          values.achats_marchandises = Math.max(values.achats_marchandises, value);
        } else if (label.includes('production') && label.includes('vendue')) {
          values.production_vendue = Math.max(values.production_vendue, value);
        } else if (label.includes('production') && label.includes('stock')) {
          values.production_stockee = value; // Peut être négatif
        } else if (label.includes('production') && label.includes('immobilis')) {
          values.production_immobilisee = Math.max(values.production_immobilisee, value);
        } else if (label.includes('consommation') || (label.includes('achats') && label.includes('externes'))) {
          values.consommations_externes = Math.max(values.consommations_externes, value);
        } else if (label.includes('subvention')) {
          values.subventions = Math.max(values.subventions, value);
        } else if (label.includes('impôts') && label.includes('taxes') && !label.includes('sociétés')) {
          values.impots_taxes = Math.max(values.impots_taxes, value);
        } else if (label.includes('charges') && label.includes('personnel')) {
          values.charges_personnel = Math.max(values.charges_personnel, value);
        } else if (label.includes('dotation') && label.includes('amortissement')) {
          values.dotations_amortissements = Math.max(values.dotations_amortissements, value);
        } else if (label.includes('résultat') && label.includes('financier')) {
          values.resultat_financier = value; // Peut être négatif
        } else if (label.includes('résultat') && label.includes('exceptionnel')) {
          values.resultat_exceptionnel = value; // Peut être négatif
        } else if (label.includes('impôt') && (label.includes('sociétés') || label.includes('bénéfices'))) {
          values.impots_societes = Math.max(values.impots_societes, value);
        }
      }
    }
  }

  // ⚠️ SUPPRESSION DES FALLBACKS (2025-12-29)
  // Les données historiques doivent provenir UNIQUEMENT de l'extraction.
  // Pas de substitution automatique qui pourrait corrompre les données.
  //
  // ANCIENS FALLBACKS SUPPRIMÉS:
  // - ventes_marchandises = CA (causait marge = 0 ou erreurs)
  // - CA = production_vendue (mélangeait types de CA)

  return values;
}

// ============================================================================
// FONCTIONS HELPER POUR SIG EXTRAIT DIRECTEMENT (PRIORITÉ 0)
// ============================================================================

/**
 * Extrait une valeur SIG, qu'elle soit en format simple (number) ou structuré ({valeur, pct_ca}).
 * Fix: Gemini peut retourner soit un number, soit {valeur, pct_ca} - on accepte les deux.
 */
function extractSigValue(field: any): number | undefined {
  if (field === null || field === undefined) return undefined;
  if (typeof field === 'number') return field;
  if (typeof field === 'object' && 'valeur' in field) {
    return typeof field.valeur === 'number' ? field.valeur : undefined;
  }
  return undefined;
}

/**
 * Convertit un champ SIG (number ou {valeur, pct_ca}) en format ValeurSig normalisé.
 */
function normalizeToValeurSig(field: any, ca: number = 1): { valeur: number; pct_ca: number } | undefined {
  if (field === null || field === undefined) return undefined;

  let valeur: number;
  let pct_ca: number;

  if (typeof field === 'number') {
    // Format simple: number
    valeur = field;
    pct_ca = ca > 0 ? Math.round((field / ca) * 10000) / 100 : 0;
  } else if (typeof field === 'object' && 'valeur' in field) {
    // Format structuré: {valeur, pct_ca}
    valeur = typeof field.valeur === 'number' ? field.valeur : 0;
    pct_ca = typeof field.pct_ca === 'number' ? field.pct_ca : (ca > 0 ? Math.round((valeur / ca) * 10000) / 100 : 0);
  } else {
    return undefined;
  }

  return { valeur, pct_ca };
}

/**
 * Recherche un SIG extrait directement dans les documents COMPTA.
 * Retourne le SIG si trouvé et valide (avec au moins CA, EBE, RN).
 *
 * FIX V3 (2025-12-29): Réécriture complète pour corriger la perte de données
 * - PRIORITÉ 1: key_values (nombres simples, plus fiables)
 * - PRIORITÉ 2: sig (format {valeur, pct_ca})
 * - Mapping explicite des champs avec alias (charges_externes → autres_achats_charges_externes)
 */
function findExtractedSig(yearDocs: any[]): SigExtraction | null {
  for (const doc of yearDocs) {
    const sig = doc.extractedData?.sig;
    const keyValues = doc.extractedData?.key_values;

    // Besoin d'au moins une source de données
    if (!sig && !keyValues) continue;

    // Helper pour extraire une valeur avec priorité key_values > sig
    const getValue = (kvField: string, sigField?: string): number | undefined => {
      // Priorité 1: key_values (nombres simples)
      if (keyValues && keyValues[kvField] !== undefined && keyValues[kvField] !== null && keyValues[kvField] !== 0) {
        return keyValues[kvField];
      }
      // Priorité 2: sig (format {valeur, pct_ca} ou number)
      const sigKey = sigField || kvField;
      if (sig && sig[sigKey] !== undefined) {
        return extractSigValue(sig[sigKey]);
      }
      return undefined;
    };

    // Vérifier les champs critiques (CA obligatoire, EBE/RN peuvent être 0)
    const ca = getValue('chiffre_affaires') || getValue('ca');
    const ebe = getValue('ebe');
    const rn = getValue('resultat_net');

    if (!ca || ca === 0) {
      console.log(`[findExtractedSig] ⚠️ Document ${doc.filename || 'unknown'}: CA manquant ou 0`);
      continue;
    }

    if (ebe === undefined || rn === undefined) {
      console.log(`[findExtractedSig] ⚠️ Document ${doc.filename || 'unknown'}: EBE ou RN manquant`);
      continue;
    }

    // Helper pour créer {valeur, pct_ca}
    const toValeurSig = (val: number | undefined): { valeur: number; pct_ca: number } | undefined => {
      if (val === undefined || val === null) return undefined;
      return { valeur: val, pct_ca: ca > 0 ? Math.round((val / ca) * 10000) / 100 : 0 };
    };

    console.log(`[findExtractedSig] ✅ Building SIG from doc: ${doc.filename || 'unknown'}`);
    console.log(`[findExtractedSig]   └─ key_values fields:`, keyValues ? Object.keys(keyValues) : 'none');
    console.log(`[findExtractedSig]   └─ sig fields:`, sig ? Object.keys(sig) : 'none');

    // Construire le SIG avec mapping explicite des champs
    const builtSig: SigExtraction = {
      chiffre_affaires: toValeurSig(ca),
      ventes_marchandises: toValeurSig(getValue('ventes_marchandises')),
      cout_achat_marchandises_vendues: toValeurSig(getValue('cout_achat_marchandises_vendues')),
      marge_commerciale: toValeurSig(getValue('marge_commerciale')),
      production_exercice: toValeurSig(getValue('production_exercice') || getValue('production_vendue')),
      marge_brute_globale: toValeurSig(getValue('marge_brute_globale')),

      // ✅ CRITIQUE: Mapping charges_externes → autres_achats_charges_externes
      autres_achats_charges_externes: toValeurSig(
        getValue('charges_externes') || getValue('autres_achats_charges_externes')
      ),

      valeur_ajoutee: toValeurSig(getValue('valeur_ajoutee')),
      impots_taxes: toValeurSig(getValue('impots_taxes')),

      // ✅ CRITIQUE: Charges personnel
      salaires_personnel: toValeurSig(getValue('salaires_personnel')),
      charges_sociales_personnel: toValeurSig(getValue('charges_sociales_personnel')),

      // ✅ CRITIQUE: Charges exploitant (salaire dirigeant)
      charges_exploitant: toValeurSig(getValue('charges_exploitant')),

      ebe: toValeurSig(ebe),
      dotations_amortissements: toValeurSig(getValue('dotations_amortissements')),
      resultat_exploitation: toValeurSig(getValue('resultat_exploitation')),
      produits_financiers: toValeurSig(getValue('produits_financiers')),
      charges_financieres: toValeurSig(getValue('charges_financieres')),
      resultat_courant: toValeurSig(getValue('resultat_courant')),
      produits_exceptionnels: toValeurSig(getValue('produits_exceptionnels')),
      charges_exceptionnelles: toValeurSig(getValue('charges_exceptionnelles')),
      resultat_exceptionnel: toValeurSig(getValue('resultat_exceptionnel')),
      impots_sur_benefices: toValeurSig(getValue('impots_sur_benefices')),
      resultat_net: toValeurSig(rn)
    };

    // Log des indicateurs clés
    console.log(`[findExtractedSig]   └─ CA: ${ca}€, EBE: ${ebe}€, RN: ${rn}€`);
    console.log(`[findExtractedSig]   └─ Marge Brute Globale: ${builtSig.marge_brute_globale?.valeur || 'N/A'}€`);
    console.log(`[findExtractedSig]   └─ Charges Externes: ${builtSig.autres_achats_charges_externes?.valeur || 'N/A'}€`);
    console.log(`[findExtractedSig]   └─ Charges Exploitant: ${builtSig.charges_exploitant?.valeur || 'N/A'}€`);
    console.log(`[findExtractedSig]   └─ Salaires Personnel: ${builtSig.salaires_personnel?.valeur || 'N/A'}€`);

    return builtSig;
  }

  return null;
}

/**
 * Normalise un SIG extrait (qui peut avoir des champs number ou {valeur, pct_ca})
 * vers le format standard SigExtraction avec tous les champs en {valeur, pct_ca}.
 *
 * Gère également les alias de champs (Gemini peut extraire avec des noms différents).
 */
function normalizeSigToValeurFormat(sig: any, ca: number): any {
  const normalized: any = {};

  // Mapping des alias de champs (Gemini peut utiliser des noms différents)
  const fieldAliases: Record<string, string> = {
    'charges_externes': 'autres_achats_charges_externes',
  };

  // Liste des champs à normaliser
  const fields = [
    'chiffre_affaires', 'ventes_marchandises', 'cout_achat_marchandises_vendues',
    'marge_commerciale', 'production_exercice', 'marge_brute_globale',
    'autres_achats_charges_externes', 'valeur_ajoutee', 'impots_taxes',
    'salaires_personnel', 'charges_sociales_personnel', 'charges_exploitant',
    'ebe', 'dotations_amortissements', 'resultat_exploitation',
    'produits_financiers', 'charges_financieres', 'resultat_courant',
    'produits_exceptionnels', 'charges_exceptionnelles', 'resultat_exceptionnel',
    'impots_sur_benefices', 'resultat_net'
  ];

  // Étape 1: Normaliser les champs avec leur nom exact
  for (const field of fields) {
    if (sig[field] !== undefined && sig[field] !== null) {
      normalized[field] = normalizeToValeurSig(sig[field], ca);
    }
  }

  // Étape 2: Appliquer les alias (pour les champs extraits avec des noms différents)
  for (const [alias, target] of Object.entries(fieldAliases)) {
    if (!normalized[target] && sig[alias] !== undefined && sig[alias] !== null) {
      normalized[target] = normalizeToValeurSig(sig[alias], ca);
      console.log(`[normalizeSigToValeurFormat] 🔄 Mapped alias '${alias}' → '${target}':`, normalized[target]);
    }
  }

  return normalized;
}

/**
 * Convertit un SIG extrait (format COMPTA) vers le format de sortie du tool.
 */
function convertExtractedSigToOutput(year: number, sig: SigExtraction): any {
  // DEBUG: Log input SIG before conversion
  console.log(`[convertExtractedSigToOutput] 🔍 DEBUG - Converting SIG for year ${year}:`, {
    marge_commerciale: sig.marge_commerciale,
    marge_brute_globale: sig.marge_brute_globale,
    valeur_ajoutee: sig.valeur_ajoutee,
    autres_achats_charges_externes: sig.autres_achats_charges_externes,
    resultat_exploitation: sig.resultat_exploitation,
    charges_exploitant: sig.charges_exploitant,
    salaires_personnel: sig.salaires_personnel,
    charges_sociales_personnel: sig.charges_sociales_personnel
  });

  // Helper pour créer une ValeurSig avec valeurs par défaut
  const toValeurSig = (v: ValeurSig | undefined): { valeur: number; pct_ca: number } | undefined => {
    if (!v) return undefined;
    return {
      valeur: v.valeur ?? 0,
      pct_ca: v.pct_ca ?? 0
    };
  };

  // Calcul des valeurs legacy pour compatibilité
  const achats_marchandises = sig.cout_achat_marchandises_vendues?.valeur ?? 0;
  const production = sig.production_exercice?.valeur ?? 0;
  const charges_personnel = (sig.salaires_personnel?.valeur ?? 0) + (sig.charges_sociales_personnel?.valeur ?? 0);
  const impots = sig.impots_sur_benefices?.valeur ?? 0;

  return {
    year,
    source: 'compta_extraction',

    // Indicateurs principaux (requis)
    chiffre_affaires: toValeurSig(sig.chiffre_affaires) ?? { valeur: 0, pct_ca: 100 },
    marge_commerciale: toValeurSig(sig.marge_commerciale) ?? { valeur: 0, pct_ca: 0 },
    valeur_ajoutee: toValeurSig(sig.valeur_ajoutee) ?? { valeur: 0, pct_ca: 0 },
    ebe: toValeurSig(sig.ebe) ?? { valeur: 0, pct_ca: 0 },
    resultat_exploitation: toValeurSig(sig.resultat_exploitation) ?? { valeur: 0, pct_ca: 0 },
    resultat_courant: toValeurSig(sig.resultat_courant) ?? { valeur: 0, pct_ca: 0 },
    resultat_net: toValeurSig(sig.resultat_net) ?? { valeur: 0, pct_ca: 0 },

    // Indicateurs détaillés (optionnels)
    ventes_marchandises: toValeurSig(sig.ventes_marchandises),
    cout_achat_marchandises: toValeurSig(sig.cout_achat_marchandises_vendues),
    production_exercice: toValeurSig(sig.production_exercice),
    marge_brute_globale: toValeurSig(sig.marge_brute_globale),
    autres_achats_charges_externes: toValeurSig(sig.autres_achats_charges_externes),
    impots_taxes: toValeurSig(sig.impots_taxes),
    salaires_personnel: toValeurSig(sig.salaires_personnel),
    charges_sociales_personnel: toValeurSig(sig.charges_sociales_personnel),
    charges_exploitant: toValeurSig(sig.charges_exploitant), // ← CRITIQUE pour retraitement EBE
    dotations_amortissements: toValeurSig(sig.dotations_amortissements),
    produits_financiers: toValeurSig(sig.produits_financiers),
    charges_financieres: toValeurSig(sig.charges_financieres),
    resultat_financier: sig.charges_financieres && sig.produits_financiers ? {
      valeur: (sig.produits_financiers?.valeur ?? 0) - (sig.charges_financieres?.valeur ?? 0),
      pct_ca: (sig.produits_financiers?.pct_ca ?? 0) - (sig.charges_financieres?.pct_ca ?? 0)
    } : undefined,
    produits_exceptionnels: toValeurSig(sig.produits_exceptionnels),
    charges_exceptionnelles: toValeurSig(sig.charges_exceptionnelles),
    resultat_exceptionnel: toValeurSig(sig.resultat_exceptionnel),
    impots_sur_benefices: toValeurSig(sig.impots_sur_benefices),

    // Compatibilité avec l'ancien format
    _legacy: {
      achats_marchandises,
      production,
      charges_personnel,
      impots
    }
  };
}

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
 * PRIORITÉ D'EXTRACTION:
 * 0. SIG extrait directement des documents COMPTA préprocessés (recommandé)
 * 1. key_values de l'extraction Gemini Vision (fallback)
 * 2. Parsing des tableaux avec heuristiques (dernier recours)
 *
 * Formules des SIG (comptabilité française):
 * 1. Marge commerciale = Ventes marchandises - Achats marchandises
 * 2. Production = Production vendue + Production stockée + Production immobilisée
 * 3. Valeur ajoutée = Marge commerciale + Production - Consommations externes
 * 4. EBE = Valeur ajoutée + Subventions - Impôts & taxes - Charges personnel
 * 5. Résultat d'exploitation = EBE + Autres produits - Autres charges - Dotations amortissements
 * 6. Résultat courant = Résultat exploitation + Résultat financier
 * 7. Résultat net = Résultat courant + Résultat exceptionnel - Impôts
 */

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

      // Grouper les documents par année
      const documentsByYear: { [year: number]: any[] } = {};

      for (const doc of documents) {
        if (doc.year && doc.documentType !== 'bail' && doc.documentType !== 'autre') {
          if (!documentsByYear[doc.year]) {
            documentsByYear[doc.year] = [];
          }
          documentsByYear[doc.year].push(doc);
        }
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
        // PRIORITÉ 1 & 2: key_values ou parsing de tableaux
        // ============================================================
        const values = extractAccountingValues(yearDocs);

        // ✅ FIX: Utiliser les valeurs directes extraites si disponibles, sinon calculer
        // Cela évite les erreurs de cascade quand ventes_marchandises n'est pas extrait correctement
        const production = values.production_vendue + values.production_stockee + values.production_immobilisee;

        // Marge commerciale: utiliser valeur directe SI disponible ET non nulle
        const marge_commerciale = values.marge_commerciale_directe > 0
          ? values.marge_commerciale_directe
          : (values.ventes_marchandises - values.achats_marchandises);

        // Valeur ajoutée: utiliser valeur directe SI disponible ET non nulle
        const valeur_ajoutee = values.valeur_ajoutee_directe > 0
          ? values.valeur_ajoutee_directe
          : (marge_commerciale + production - values.consommations_externes);

        // EBE: utiliser valeur directe SI disponible (peut être 0 ou négatif légitimement)
        const ebe = values.ebe_direct !== 0
          ? values.ebe_direct
          : (valeur_ajoutee + values.subventions - values.impots_taxes - values.charges_personnel);

        // Résultat d'exploitation: utiliser valeur directe SI disponible
        const resultat_exploitation = values.resultat_exploitation_direct !== 0
          ? values.resultat_exploitation_direct
          : (ebe + values.autres_produits - values.autres_charges - values.dotations_amortissements);

        const resultat_courant = resultat_exploitation + values.resultat_financier;

        // Résultat net: utiliser valeur directe SI disponible
        const resultat_net = values.resultat_net_direct !== 0
          ? values.resultat_net_direct
          : (resultat_courant + values.resultat_exceptionnel - values.impots_societes);

        // ✅ VALIDATION: Détecter les erreurs de calcul suspectes
        if (marge_commerciale >= values.chiffre_affaires * 0.95 && values.chiffre_affaires > 0) {
          console.warn(`[calculateSig] ⚠️ ALERTE: marge_commerciale (${marge_commerciale}) ≈ CA (${values.chiffre_affaires}) - possible erreur de calcul!`);
        }
        if (valeur_ajoutee >= values.chiffre_affaires * 0.95 && values.chiffre_affaires > 0) {
          console.warn(`[calculateSig] ⚠️ ALERTE: valeur_ajoutee (${valeur_ajoutee}) ≈ CA (${values.chiffre_affaires}) - possible erreur de calcul!`);
        }

        // Calculer les % CA
        const ca = values.chiffre_affaires || 1; // Éviter division par 0
        const calcPctCa = (v: number) => ca > 0 ? Math.round((v / ca) * 10000) / 100 : 0;

        sig[year.toString()] = {
          year,
          source: values.source || 'table_parsing',

          // Nouvelles valeurs avec % CA
          chiffre_affaires: { valeur: values.chiffre_affaires, pct_ca: 100 },
          marge_commerciale: { valeur: Math.round(marge_commerciale), pct_ca: calcPctCa(marge_commerciale) },
          valeur_ajoutee: { valeur: Math.round(valeur_ajoutee), pct_ca: calcPctCa(valeur_ajoutee) },
          ebe: { valeur: Math.round(ebe), pct_ca: calcPctCa(ebe) },
          resultat_exploitation: { valeur: Math.round(resultat_exploitation), pct_ca: calcPctCa(resultat_exploitation) },
          resultat_courant: { valeur: Math.round(resultat_courant), pct_ca: calcPctCa(resultat_courant) },
          resultat_net: { valeur: Math.round(resultat_net), pct_ca: calcPctCa(resultat_net) },

          // Champs optionnels
          impots_taxes: values.impots_taxes ? { valeur: values.impots_taxes, pct_ca: calcPctCa(values.impots_taxes) } : undefined,
          dotations_amortissements: values.dotations_amortissements ? { valeur: values.dotations_amortissements, pct_ca: calcPctCa(values.dotations_amortissements) } : undefined,
          resultat_financier: values.resultat_financier ? { valeur: values.resultat_financier, pct_ca: calcPctCa(values.resultat_financier) } : undefined,
          resultat_exceptionnel: values.resultat_exceptionnel ? { valeur: values.resultat_exceptionnel, pct_ca: calcPctCa(values.resultat_exceptionnel) } : undefined,

          // Compatibilité avec l'ancien format
          _legacy: {
            achats_marchandises: values.achats_marchandises,
            production: Math.round(production),
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
          // ✅ NEW: Direct SIG values from Gemini extraction (use these if available instead of calculating)
          marge_commerciale_directe: kv.marge_commerciale || 0,
          valeur_ajoutee_directe: kv.valeur_ajoutee || 0,
          ebe_direct: kv.ebe || 0,
          resultat_exploitation_direct: kv.resultat_exploitation || 0,
          resultat_net_direct: kv.resultat_net || 0
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
    resultat_net_direct: 0
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

  // Fallback : si CA non trouvé, utiliser production_vendue
  if (values.chiffre_affaires === 0 && values.production_vendue > 0) {
    values.chiffre_affaires = values.production_vendue;
  }

  // Fallback : si ventes_marchandises non trouvé, utiliser CA
  if (values.ventes_marchandises === 0 && values.chiffre_affaires > 0) {
    values.ventes_marchandises = values.chiffre_affaires;
  }

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
 * IMPORTANT: Accepte DEUX formats pour chaque champ:
 * - Format structuré: { valeur: number, pct_ca: number }
 * - Format simple: number
 */
function findExtractedSig(yearDocs: any[]): SigExtraction | null {
  for (const doc of yearDocs) {
    // Vérifier si le document a un SIG extrait directement
    const sig = doc.extractedData?.sig;

    if (!sig) continue;

    // Extraire les valeurs en acceptant BOTH formats (number ou {valeur, pct_ca})
    const caValue = extractSigValue(sig.chiffre_affaires);
    const ebeValue = extractSigValue(sig.ebe);
    const rnValue = extractSigValue(sig.resultat_net);

    // Vérifier la présence des champs critiques
    const hasCa = caValue !== undefined && caValue > 0;
    const hasEbe = ebeValue !== undefined; // EBE peut être 0 ou négatif
    const hasRn = rnValue !== undefined; // RN peut être 0 ou négatif

    if (hasCa && hasEbe && hasRn) {
      console.log(`[findExtractedSig] ✅ Found valid SIG extraction in document: ${doc.filename || doc.name || 'unknown'}`);

      // DEBUG: Log all available SIG fields BEFORE normalization
      console.log(`[findExtractedSig] 🔍 DEBUG - Raw SIG fields:`, Object.keys(sig));
      console.log(`[findExtractedSig] 🔍 DEBUG - marge_commerciale raw:`, sig.marge_commerciale);
      console.log(`[findExtractedSig] 🔍 DEBUG - marge_brute_globale raw:`, sig.marge_brute_globale);
      console.log(`[findExtractedSig] 🔍 DEBUG - valeur_ajoutee raw:`, sig.valeur_ajoutee);
      console.log(`[findExtractedSig] 🔍 DEBUG - resultat_exploitation raw:`, sig.resultat_exploitation);
      console.log(`[findExtractedSig] 🔍 DEBUG - autres_achats_charges_externes raw:`, sig.autres_achats_charges_externes);
      console.log(`[findExtractedSig] 🔍 DEBUG - salaires_personnel raw:`, sig.salaires_personnel);
      console.log(`[findExtractedSig] 🔍 DEBUG - charges_sociales_personnel raw:`, sig.charges_sociales_personnel);
      console.log(`[findExtractedSig] 🔍 DEBUG - charges_exploitant raw:`, sig.charges_exploitant);

      // Normaliser tous les champs au format {valeur, pct_ca}
      const normalizedSig = normalizeSigToValeurFormat(sig, caValue);

      // DEBUG: Log normalized SIG fields
      console.log(`[findExtractedSig] 🔍 DEBUG - Normalized SIG:`, {
        marge_commerciale: normalizedSig.marge_commerciale,
        marge_brute_globale: normalizedSig.marge_brute_globale,
        valeur_ajoutee: normalizedSig.valeur_ajoutee,
        resultat_exploitation: normalizedSig.resultat_exploitation,
        charges_exploitant: normalizedSig.charges_exploitant
      });

      // Log des indicateurs clés
      const indicators = [
        `CA: ${caValue}€`,
        `EBE: ${ebeValue}€`,
        `VA: ${extractSigValue(sig.valeur_ajoutee) || 0}€`,
        `Marge Brute Globale: ${extractSigValue(sig.marge_brute_globale) || 0}€`,
        `RN: ${rnValue}€`
      ];
      console.log(`[findExtractedSig]   └─ Indicators: ${indicators.join(', ')}`);

      // Log du salaire dirigeant si présent
      const chargesExploitant = extractSigValue(sig.charges_exploitant);
      if (chargesExploitant) {
        console.log(`[findExtractedSig]   └─ ⭐ Charges exploitant (salaire dirigeant): ${chargesExploitant}€`);
      }

      // Log des charges personnel si présentes
      const salairesPersonnel = extractSigValue(sig.salaires_personnel);
      const chargesSocialesPersonnel = extractSigValue(sig.charges_sociales_personnel);
      if (salairesPersonnel || chargesSocialesPersonnel) {
        console.log(`[findExtractedSig]   └─ 💼 Charges personnel: Salaires=${salairesPersonnel || 0}€, Charges sociales=${chargesSocialesPersonnel || 0}€`);
      }

      return normalizedSig as SigExtraction;
    }

    // Log si SIG trouvé mais incomplet
    if (sig && (!hasCa || !hasEbe || !hasRn)) {
      console.log(`[findExtractedSig] ⚠️ Found SIG but incomplete:`, {
        doc: doc.filename || doc.name || 'unknown',
        hasCa,
        hasEbe,
        hasRn,
        caValue,
        ebeValue,
        rnValue,
        keys: Object.keys(sig)
      });
    }
  }

  return null;
}

/**
 * Normalise un SIG extrait (qui peut avoir des champs number ou {valeur, pct_ca})
 * vers le format standard SigExtraction avec tous les champs en {valeur, pct_ca}.
 */
function normalizeSigToValeurFormat(sig: any, ca: number): any {
  const normalized: any = {};

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

  for (const field of fields) {
    if (sig[field] !== undefined && sig[field] !== null) {
      normalized[field] = normalizeToValeurSig(sig[field], ca);
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

import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';

/**
 * Calculate SIG Tool
 *
 * Calcule les Soldes Intermédiaires de Gestion (SIG) pour chaque année.
 * Les SIG sont les indicateurs clés de performance financière d'une entreprise.
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

const SigForYearSchema = z.object({
  year: z.number(),
  chiffre_affaires: z.number(),
  achats_marchandises: z.number(),
  marge_commerciale: z.number(),
  production: z.number(),
  valeur_ajoutee: z.number(),
  charges_personnel: z.number(),
  ebe: z.number().describe('Excédent Brut d\'Exploitation'),
  dotations_amortissements: z.number(),
  resultat_exploitation: z.number(),
  resultat_financier: z.number(),
  resultat_courant: z.number(),
  resultat_exceptionnel: z.number(),
  impots: z.number(),
  resultat_net: z.number()
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

        // Extraire les valeurs comptables depuis les documents
        const values = extractAccountingValues(yearDocs);

        // Calculer les SIG
        const marge_commerciale = values.ventes_marchandises - values.achats_marchandises;

        const production = values.production_vendue + values.production_stockee + values.production_immobilisee;

        const valeur_ajoutee = marge_commerciale + production - values.consommations_externes;

        const ebe = valeur_ajoutee + values.subventions - values.impots_taxes - values.charges_personnel;

        const resultat_exploitation = ebe + values.autres_produits - values.autres_charges - values.dotations_amortissements;

        const resultat_courant = resultat_exploitation + values.resultat_financier;

        const resultat_net = resultat_courant + values.resultat_exceptionnel - values.impots_societes;

        sig[year.toString()] = {
          year,
          chiffre_affaires: values.chiffre_affaires,
          achats_marchandises: values.achats_marchandises,
          marge_commerciale: Math.round(marge_commerciale),
          production: Math.round(production),
          valeur_ajoutee: Math.round(valeur_ajoutee),
          charges_personnel: values.charges_personnel,
          ebe: Math.round(ebe),
          dotations_amortissements: values.dotations_amortissements,
          resultat_exploitation: Math.round(resultat_exploitation),
          resultat_financier: values.resultat_financier,
          resultat_courant: Math.round(resultat_courant),
          resultat_exceptionnel: values.resultat_exceptionnel,
          impots: values.impots_societes,
          resultat_net: Math.round(resultat_net)
        };
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
 * Utilise des heuristiques pour identifier les postes comptables dans les tableaux extraits.
 */
function extractAccountingValues(yearDocs: any[]): {
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
} {
  const values = {
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
    impots_societes: 0
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

import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';

/**
 * Calculate Ratios Tool
 *
 * Calcule les ratios financiers clés pour la dernière année disponible.
 * Utilise les SIG calculés précédemment et les données du bilan.
 *
 * Ratios calculés:
 * - Rentabilité: marge brute, marge EBE, marge nette, taux VA
 * - Activité: rotation stocks, délais clients/fournisseurs, BFR
 * - Structure: taux endettement, capacité autofinancement
 */

const CalculateRatiosInputSchema = z.object({
  year: z.number().optional().describe('Année pour laquelle calculer les ratios (dernière année si non spécifié)')
});

const CalculateRatiosOutputSchema = z.object({
  year: z.number(),
  ratios: z.object({
    marge_brute_pct: z.number().describe('Marge brute / CA'),
    marge_ebe_pct: z.number().describe('EBE / CA'),
    marge_nette_pct: z.number().describe('Résultat net / CA'),
    taux_va_pct: z.number().describe('Valeur ajoutée / CA'),
    productivite: z.number().describe('Valeur ajoutée / Effectif (si connu)'),
    rotation_stocks_jours: z.number().describe('Stocks / (CA / 365)'),
    delai_clients_jours: z.number().describe('Créances clients / (CA / 365)'),
    delai_fournisseurs_jours: z.number().describe('Dettes fournisseurs / (Achats / 365)'),
    bfr_jours_ca: z.number().describe('BFR / (CA / 365)'),
    taux_endettement_pct: z.number().describe('Dettes / Capitaux propres'),
    capacite_autofinancement: z.number().describe('CAF = Résultat net + Dotations')
  }),
  error: z.string().optional()
});

export const calculateRatiosTool = new FunctionTool({
  name: 'calculateRatios',
  description: 'Calcule les ratios financiers clés (rentabilité, activité, structure) pour une année donnée. Lit depuis state.comptable.sig et state.documentExtraction.',
  parameters: zToGen(CalculateRatiosInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    try {
      // Lire comptable depuis state (contient les SIG)
      let comptable = toolContext?.state.get('comptable') as any;

      // Parser JSON string si nécessaire
      if (typeof comptable === 'string') {
        try {
          comptable = JSON.parse(comptable);
        } catch (e) {
          return {
            year: 0,
            ratios: {} as any,
            error: 'Failed to parse comptable state (invalid JSON)'
          };
        }
      }

      if (!comptable?.sig || Object.keys(comptable.sig).length === 0) {
        return {
          year: 0,
          ratios: {} as any,
          error: 'No SIG data found in state.comptable - run calculateSig first'
        };
      }

      // Déterminer l'année à analyser
      const years = Object.keys(comptable.sig).map(y => parseInt(y)).sort((a, b) => b - a);
      const targetYear = params.year || years[0];

      const sig = comptable.sig[targetYear.toString()];

      if (!sig) {
        return {
          year: targetYear,
          ratios: {} as any,
          error: `No SIG data for year ${targetYear}`
        };
      }

      // Lire documentExtraction pour accéder aux données du bilan
      let documentExtraction = toolContext?.state.get('documentExtraction') as any;

      if (typeof documentExtraction === 'string') {
        try {
          documentExtraction = JSON.parse(documentExtraction);
        } catch (e) {
          documentExtraction = null;
        }
      }

      // Extraire données du bilan (stocks, créances, dettes, capitaux propres)
      const bilanData = extractBilanData(documentExtraction, targetYear);

      // Calculer les ratios
      const ca = sig.chiffre_affaires || 1; // Éviter division par 0
      const achats = sig.achats_marchandises || 1;

      const ratios = {
        // Rentabilité
        marge_brute_pct: Math.round((sig.marge_commerciale / ca) * 1000) / 10, // 1 décimale
        marge_ebe_pct: Math.round((sig.ebe / ca) * 1000) / 10,
        marge_nette_pct: Math.round((sig.resultat_net / ca) * 1000) / 10,
        taux_va_pct: Math.round((sig.valeur_ajoutee / ca) * 1000) / 10,

        // Productivité (si effectif connu)
        productivite: bilanData.effectif > 0
          ? Math.round(sig.valeur_ajoutee / bilanData.effectif)
          : 0,

        // Activité - Rotation et délais
        rotation_stocks_jours: bilanData.stocks > 0
          ? Math.round((bilanData.stocks / ca) * 365)
          : 0,

        delai_clients_jours: bilanData.creances_clients > 0
          ? Math.round((bilanData.creances_clients / ca) * 365)
          : 0,

        delai_fournisseurs_jours: bilanData.dettes_fournisseurs > 0 && achats > 0
          ? Math.round((bilanData.dettes_fournisseurs / achats) * 365)
          : 0,

        // BFR (Besoin en Fonds de Roulement)
        bfr_jours_ca: Math.round((bilanData.bfr / ca) * 365),

        // Structure financière
        taux_endettement_pct: bilanData.capitaux_propres > 0
          ? Math.round((bilanData.dettes_totales / bilanData.capitaux_propres) * 1000) / 10
          : 0,

        // Capacité d'autofinancement
        capacite_autofinancement: Math.round(sig.resultat_net + sig.dotations_amortissements)
      };

      return {
        year: targetYear,
        ratios
      };

    } catch (error: any) {
      return {
        year: 0,
        ratios: {} as any,
        error: error.message || 'Ratios calculation failed'
      };
    }
  }
});

/**
 * Extrait les données du bilan pour une année donnée.
 */
function extractBilanData(documentExtraction: any, year: number): {
  stocks: number;
  creances_clients: number;
  dettes_fournisseurs: number;
  dettes_totales: number;
  capitaux_propres: number;
  bfr: number;
  effectif: number;
} {
  const data = {
    stocks: 0,
    creances_clients: 0,
    dettes_fournisseurs: 0,
    dettes_totales: 0,
    capitaux_propres: 0,
    bfr: 0,
    effectif: 0
  };

  if (!documentExtraction?.documents) return data;

  // Trouver le bilan de l'année
  const bilanDoc = documentExtraction.documents.find(
    (d: any) => d.year === year && d.documentType === 'bilan'
  );

  if (!bilanDoc?.extractedData?.tables) return data;

  // Parser les tableaux du bilan
  for (const table of bilanDoc.extractedData.tables) {
    if (!table.rows) continue;

    for (const row of table.rows) {
      if (!row || row.length === 0) continue;

      const label = (row[0] || '').toLowerCase().trim();
      const value = parseFloat((row[1] || '0').replace(/\s/g, '').replace(',', '.')) || 0;

      // Matching des postes du bilan
      if (label.includes('stock')) {
        data.stocks = Math.max(data.stocks, value);
      } else if (label.includes('créances') && label.includes('clients')) {
        data.creances_clients = Math.max(data.creances_clients, value);
      } else if (label.includes('dettes') && label.includes('fournisseurs')) {
        data.dettes_fournisseurs = Math.max(data.dettes_fournisseurs, value);
      } else if (label.includes('dettes') && !label.includes('fournisseurs')) {
        data.dettes_totales += value;
      } else if (label.includes('capitaux') && label.includes('propres')) {
        data.capitaux_propres = Math.max(data.capitaux_propres, value);
      } else if (label.includes('effectif')) {
        data.effectif = Math.max(data.effectif, Math.round(value));
      }
    }
  }

  // Calculer BFR = (Stocks + Créances clients) - Dettes fournisseurs
  data.bfr = data.stocks + data.creances_clients - data.dettes_fournisseurs;

  return data;
}

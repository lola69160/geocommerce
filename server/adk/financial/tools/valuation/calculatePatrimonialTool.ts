import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';

/**
 * Calculate Patrimonial Valuation Tool
 *
 * Valorise un fonds de commerce par la méthode patrimoniale (actif net réévalué).
 * Cette méthode est surtout pertinente pour les fonds avec actifs corporels significatifs.
 *
 * Formule: Valeur = Actif net comptable + Réévaluations + Goodwill
 *
 * Composantes:
 * 1. Actif net comptable = Actif total - Dettes
 * 2. Réévaluations = Différence entre valeur réelle et valeur comptable (immobilisations, stocks)
 * 3. Goodwill = Valeur immatérielle (clientèle, emplacement, licence, réputation)
 *
 * Note: Cette méthode est moins utilisée pour les petits commerces car elle sous-évalue
 * souvent la valeur du fonds (ne capte pas bien la rentabilité future).
 */

const CalculatePatrimonialInputSchema = z.object({
  actif_immobilise_net: z.number().optional().describe('Actif immobilisé net (valeur comptable)'),
  stocks: z.number().optional().describe('Stocks (valeur comptable)'),
  creances: z.number().optional().describe('Créances clients'),
  tresorerie: z.number().optional().describe('Trésorerie'),
  dettes: z.number().optional().describe('Dettes totales (fournisseurs + bancaires)'),
  revalorisation_actifs: z.number().optional().describe('Réévaluation des actifs (différence valeur réelle - comptable)'),
  goodwill_estimated: z.number().optional().describe('Goodwill estimé (si non fourni, sera calculé automatiquement)')
});

const CalculatePatrimonialOutputSchema = z.object({
  methodePatrimoniale: z.object({
    actif_net_comptable: z.number().describe('Actif net comptable (actif - dettes)'),
    revalorisation_actifs: z.number().describe('Réévaluation des actifs corporels'),
    goodwill: z.number().describe('Goodwill (valeur immatérielle)'),
    valeur_estimee: z.number().describe('Valeur patrimoniale totale'),
    detail: z.array(z.object({
      poste: z.string(),
      valeur_comptable: z.number(),
      valeur_reelle: z.number()
    })),
    justification: z.string()
  }),
  error: z.string().optional()
});

export const calculatePatrimonialTool = new FunctionTool({
  name: 'calculatePatrimonial',
  description: 'Valorise le fonds de commerce par la méthode patrimoniale (actif net réévalué + goodwill). Moins utilisée mais pertinente pour fonds avec actifs corporels importants.',
  parameters: zToGen(CalculatePatrimonialInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    try {
      // Lire documentExtraction depuis state (pour avoir accès au bilan)
      let documentExtraction = toolContext?.state.get('documentExtraction') as any;

      // Parser JSON string si nécessaire
      if (typeof documentExtraction === 'string') {
        try {
          documentExtraction = JSON.parse(documentExtraction);
        } catch (e) {
          // Pas critique, on continue avec les params fournis
        }
      }

      // Lire comptable depuis state (pour avoir accès aux SIG)
      let comptable = toolContext?.state.get('comptable') as any;

      if (typeof comptable === 'string') {
        try {
          comptable = JSON.parse(comptable);
        } catch (e) {
          // Pas critique
        }
      }

      // Extraire les valeurs du bilan (si disponibles dans documents)
      let actifImmobilise = params.actif_immobilise_net || 0;
      let stocks = params.stocks || 0;
      let creances = params.creances || 0;
      let tresorerie = params.tresorerie || 0;
      let dettes = params.dettes || 0;

      // Si pas fourni en params, essayer d'extraire depuis documentExtraction
      if (documentExtraction?.documents && Array.isArray(documentExtraction.documents)) {
        // Trouver le bilan le plus récent
        const bilanDocs = documentExtraction.documents.filter((doc: any) =>
          doc.documentType === 'bilan' && doc.year
        ).sort((a: any, b: any) => b.year - a.year);

        if (bilanDocs.length > 0) {
          const bilanRecent = bilanDocs[0];

          // Parser les tableaux pour extraire actif/passif
          if (bilanRecent.extractedData?.tables) {
            for (const table of bilanRecent.extractedData.tables) {
              if (!table.rows) continue;

              for (const row of table.rows) {
                if (!row || row.length === 0) continue;

                const label = (row[0] || '').toLowerCase().trim();
                const value = parseFloat((row[1] || '0').replace(/\s/g, '').replace(',', '.')) || 0;

                if (label.includes('immobilisation') && label.includes('nette')) {
                  actifImmobilise = Math.max(actifImmobilise, value);
                } else if (label.includes('stocks')) {
                  stocks = Math.max(stocks, value);
                } else if (label.includes('créances') && label.includes('clients')) {
                  creances = Math.max(creances, value);
                } else if (label.includes('trésorerie') || label.includes('disponibilités')) {
                  tresorerie = Math.max(tresorerie, value);
                } else if (label.includes('dettes') && label.includes('total')) {
                  dettes = Math.max(dettes, value);
                }
              }
            }
          }
        }
      }

      // Calculer actif net comptable
      const actifTotal = actifImmobilise + stocks + creances + tresorerie;
      const actifNetComptable = actifTotal - dettes;

      // Réévaluation des actifs
      const revalorisationActifs = params.revalorisation_actifs || 0;

      // Détail des postes
      const detail = [
        {
          poste: 'Immobilisations corporelles',
          valeur_comptable: actifImmobilise,
          valeur_reelle: actifImmobilise + (revalorisationActifs * 0.5) // Estimation: 50% de rééval sur immobilisations
        },
        {
          poste: 'Stocks',
          valeur_comptable: stocks,
          valeur_reelle: stocks // Généralement proche de la valeur comptable
        },
        {
          poste: 'Créances clients',
          valeur_comptable: creances,
          valeur_reelle: creances * 0.95 // Décote 5% pour impayés potentiels
        },
        {
          poste: 'Trésorerie',
          valeur_comptable: tresorerie,
          valeur_reelle: tresorerie
        }
      ];

      // Calculer goodwill (valeur immatérielle)
      let goodwill = params.goodwill_estimated || 0;

      // Si goodwill non fourni, l'estimer à partir de l'EBE (méthode simplifiée)
      if (goodwill === 0 && comptable?.sig) {
        const { sig, yearsAnalyzed } = comptable;

        if (yearsAnalyzed && yearsAnalyzed.length > 0) {
          const lastYear = yearsAnalyzed[0].toString();
          const ebe = sig[lastYear]?.ebe || 0;

          // Goodwill = 1.5x EBE (coefficient conservateur)
          goodwill = Math.round(ebe * 1.5);
        }
      }

      // Valeur patrimoniale totale
      const valeurEstimee = actifNetComptable + revalorisationActifs + goodwill;

      // Justification
      let justification = `Méthode patrimoniale (moins utilisée pour petits commerces). `;
      justification += `Actif net comptable: ${actifNetComptable.toLocaleString('fr-FR')} €. `;

      if (revalorisationActifs > 0) {
        justification += `Réévaluation actifs: +${revalorisationActifs.toLocaleString('fr-FR')} €. `;
      }

      justification += `Goodwill (clientèle, emplacement, réputation): ${goodwill.toLocaleString('fr-FR')} €. `;

      if (!params.goodwill_estimated && comptable?.sig) {
        justification += `Goodwill estimé à 1.5x EBE (méthode simplifiée). `;
      }

      justification += `ATTENTION: Cette méthode sous-évalue souvent les fonds de commerce car elle ne capte pas bien la rentabilité future. À utiliser en complément des méthodes EBE et CA.`;

      return {
        methodePatrimoniale: {
          actif_net_comptable: actifNetComptable,
          revalorisation_actifs: revalorisationActifs,
          goodwill,
          valeur_estimee: valeurEstimee,
          detail,
          justification
        }
      };

    } catch (error: any) {
      return {
        methodePatrimoniale: {
          actif_net_comptable: 0,
          revalorisation_actifs: 0,
          goodwill: 0,
          valeur_estimee: 0,
          detail: [],
          justification: 'Erreur lors du calcul'
        },
        error: error.message || 'Patrimonial valuation calculation failed'
      };
    }
  }
});

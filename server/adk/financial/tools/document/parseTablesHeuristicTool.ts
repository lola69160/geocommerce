import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';

/**
 * Parse Tables Heuristic Tool (FALLBACK)
 *
 * Extrait les tableaux du texte PDF avec des heuristiques basiques.
 * Utilise des patterns regex pour détecter les structures tabulaires.
 *
 * Ce tool est maintenant utilisé comme FALLBACK uniquement si geminiVisionExtractTool échoue.
 * Précision: ~30% sur PDFs comptables complexes (fragile)
 *
 * Note: Pour une extraction robuste, utiliser geminiVisionExtractTool (Vision API)
 */

const ParseTablesInputSchema = z.object({
  text: z.string().describe('Texte extrait du PDF'),
  documentType: z.string().optional().describe('Type de document (aide à l\'extraction)')
});

const TableSchema = z.object({
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
  caption: z.string().optional()
});

const ParseTablesOutputSchema = z.object({
  tables: z.array(TableSchema),
  count: z.number()
});

export const parseTablesHeuristicTool = new FunctionTool({
  name: 'parseTablesHeuristic',
  description: 'FALLBACK: Extrait les tableaux du texte PDF avec heuristiques regex (utilisé uniquement si Vision échoue). Retourne: { tables: [{ headers, rows }], count, method: "heuristic" }',
  parameters: zToGen(ParseTablesInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    const { text, documentType } = params;

    try {
      const tables: Array<{ headers: string[]; rows: string[][]; caption?: string }> = [];

      // Stratégie 1: Détecter les lignes avec séparateurs multiples (|, \t, espaces multiples)
      const lines = text.split('\n');
      let currentTable: { headers: string[]; rows: string[][] } | null = null;
      let tableStarted = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Ignorer lignes vides
        if (!line) {
          if (tableStarted && currentTable && currentTable.rows.length > 0) {
            // Fin du tableau
            tables.push(currentTable);
            currentTable = null;
            tableStarted = false;
          }
          continue;
        }

        // Détecter séparateurs (pipe ou multiple tabs/espaces)
        const hasPipes = line.includes('|');
        const hasMultipleTabs = (line.match(/\t/g) || []).length >= 2;
        const hasMultipleSpaces = /\s{3,}/.test(line); // 3+ espaces consécutifs

        if (hasPipes || hasMultipleTabs || hasMultipleSpaces) {
          // Parser la ligne en colonnes
          let cells: string[];

          if (hasPipes) {
            cells = line.split('|').map(c => c.trim()).filter(c => c);
          } else if (hasMultipleTabs) {
            cells = line.split('\t').map(c => c.trim()).filter(c => c);
          } else {
            // Espaces multiples - split on 3+ spaces
            cells = line.split(/\s{3,}/).map(c => c.trim()).filter(c => c);
          }

          // Au moins 2 colonnes pour être un tableau
          if (cells.length >= 2) {
            if (!tableStarted) {
              // Nouvelle table - première ligne = headers
              currentTable = { headers: cells, rows: [] };
              tableStarted = true;
            } else if (currentTable) {
              // Ligne de données
              currentTable.rows.push(cells);
            }
          }
        } else if (tableStarted && currentTable && currentTable.rows.length > 0) {
          // Ligne sans séparateurs après début de tableau = fin de tableau
          tables.push(currentTable);
          currentTable = null;
          tableStarted = false;
        }
      }

      // Ajouter dernier tableau si existant
      if (currentTable && currentTable.rows.length > 0) {
        tables.push(currentTable);
      }

      // Stratégie 2: Pour bilans/comptes de résultat, détecter patterns comptables
      if (documentType === 'bilan' || documentType === 'compte_resultat') {
        // Chercher patterns comme "ACTIF 2024 2023" ou "CHARGES N N-1"
        const accountingTableRegex = /(ACTIF|PASSIF|PRODUITS|CHARGES)\s+(\d{4})?\s+(\d{4})?/gi;
        let match;

        while ((match = accountingTableRegex.exec(text)) !== null) {
          const startIdx = match.index;
          const endIdx = Math.min(startIdx + 2000, text.length); // 2000 chars max par table
          const tableText = text.substring(startIdx, endIdx);

          // Parser cette section (simplifié pour démo)
          const tableLines = tableText.split('\n').slice(0, 30); // Max 30 lignes
          const accountingTable: { headers: string[]; rows: string[][] } = {
            headers: [match[1], match[2] || 'N', match[3] || 'N-1'],
            rows: []
          };

          for (const line of tableLines) {
            // Chercher lignes avec chiffres (montants)
            if (/\d{1,3}(?:[,\s]\d{3})*/.test(line)) {
              const parts = line.split(/\s{2,}/).filter(p => p.trim());
              if (parts.length >= 2) {
                accountingTable.rows.push(parts);
              }
            }
          }

          if (accountingTable.rows.length > 0) {
            tables.push(accountingTable);
          }
        }
      }

      return {
        tables,
        count: tables.length,
        method: 'heuristic' // Track que ce sont des heuristiques (fallback)
      };

    } catch (error: any) {
      return {
        tables: [],
        count: 0,
        method: 'heuristic'
      };
    }
  }
});

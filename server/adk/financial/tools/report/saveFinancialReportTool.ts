import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Save Financial Report Tool
 *
 * Sauvegarde le rapport HTML financier dans un fichier.
 * Crée le dossier data/financial-reports/ si nécessaire.
 * Nomme le fichier : financial-report-[businessId]-[timestamp].html
 */

const SaveFinancialReportInputSchema = z.object({
  html: z.string().describe('HTML complet du rapport'),
  businessId: z.string().describe('ID du commerce (pour le nom de fichier)'),
  sections_included: z.array(z.string()).describe('Sections incluses dans le rapport')
});

const SaveFinancialReportOutputSchema = z.object({
  generated: z.boolean(),
  filepath: z.string(),
  filename: z.string(),
  size_bytes: z.number(),
  sections_included: z.array(z.string()),
  generatedAt: z.string(),
  error: z.string().optional()
});

export const saveFinancialReportTool = new FunctionTool({
  name: 'saveFinancialReport',
  description: 'Sauvegarde le rapport HTML financier dans data/financial-reports/',
  parameters: zToGen(SaveFinancialReportInputSchema),

  execute: async (params) => {
    try {
      // Créer le dossier s'il n'existe pas
      const reportsDir = path.join(process.cwd(), 'data', 'financial-reports');
      await fs.mkdir(reportsDir, { recursive: true });

      // Générer le nom de fichier avec timestamp au début (format: YYYYMMDD_HHMMSS_)
      const timestamp = new Date()
        .toISOString()
        .replace(/[:\-]/g, '')
        .replace(/\..+/, '')
        .replace('T', '_');
      const filename = `${timestamp}_financial-report-${params.businessId}.html`;
      const filepath = path.join(reportsDir, filename);

      // Écrire le fichier
      await fs.writeFile(filepath, params.html, 'utf-8');

      // Obtenir la taille
      const stats = await fs.stat(filepath);
      const size_bytes = stats.size;

      const generatedAt = new Date().toISOString();

      return {
        generated: true,
        filepath,
        filename,
        size_bytes,
        sections_included: params.sections_included,
        generatedAt
      };

    } catch (error: any) {
      return {
        generated: false,
        filepath: '',
        filename: '',
        size_bytes: 0,
        sections_included: params.sections_included,
        generatedAt: new Date().toISOString(),
        error: error.message || 'Failed to save report'
      };
    }
  }
});

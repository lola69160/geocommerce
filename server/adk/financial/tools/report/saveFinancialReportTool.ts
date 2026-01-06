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
  siret: z.string(),
  siretFolder: z.string(),
  size_bytes: z.number(),
  sections_included: z.array(z.string()),
  generatedAt: z.string(),
  error: z.string().optional()
});

export const saveFinancialReportTool = new FunctionTool({
  name: 'saveFinancialReport',
  description: 'Sauvegarde rapport HTML dans data/financial-reports/{SIRET}/. Lit SIRET depuis state.businessInfo ou params.businessId. Crée dossier SIRET si nécessaire.',
  parameters: zToGen(SaveFinancialReportInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    console.log('[saveFinancialReport] 📝 Tool called with businessId:', params.businessId);
    console.log('[saveFinancialReport] HTML length:', params.html?.length || 0);

    try {
      // 1. Extraire SIRET du state (priorité) ou params.businessId (fallback)
      const businessInfo = toolContext?.state.get('businessInfo') as { siret?: string } | undefined;
      const siret = businessInfo?.siret || params.businessId || 'UNKNOWN';

      // 2. Valider SIRET
      if (siret === 'UNKNOWN' || siret.length < 9) {
        throw new Error('Cannot save financial report: Valid SIRET is required');
      }

      console.log('[saveFinancialReport] Using SIRET for folder:', siret);

      // 3. Créer structure de dossier par SIRET: data/financial-reports/{SIRET}/
      const baseDir = path.join(process.cwd(), 'data', 'financial-reports');
      const siretDir = path.join(baseDir, siret);
      await fs.mkdir(siretDir, { recursive: true });

      // 4. Générer nom de fichier SANS SIRET (redondant)
      const timestamp = new Date()
        .toISOString()
        .replace(/[:\-]/g, '')
        .replace(/\..+/, '')
        .replace('T', '_');
      const filename = `${timestamp}_financial-report.html`;
      const filepath = path.join(siretDir, filename);

      // 5. Sauvegarder fichier
      await fs.writeFile(filepath, params.html, 'utf-8');

      // 6. Vérifier fichier
      const stats = await fs.stat(filepath);
      const size_bytes = stats.size;
      const generatedAt = new Date().toISOString();

      const result = {
        generated: true,
        filepath,
        filename,
        siret,
        siretFolder: siretDir,
        size_bytes,
        sections_included: params.sections_included,
        generatedAt
      };

      // 7. Injecter dans state
      if (toolContext?.state) {
        toolContext.state.set('financialReport', result);
        console.log('[saveFinancialReport] ✅ Report saved to:', siretDir);
        console.log('[saveFinancialReport] ✅ Filename:', filename);
      }

      return result;

    } catch (error: any) {
      console.error('[saveFinancialReport] ❌ Error:', error.message);
      const errorResult = {
        generated: false,
        filepath: '',
        filename: '',
        siret: 'UNKNOWN',
        siretFolder: '',
        size_bytes: 0,
        sections_included: params.sections_included,
        generatedAt: new Date().toISOString(),
        error: error.message || 'Failed to save report'
      };

      // Injecter l'erreur dans le state aussi
      if (toolContext?.state) {
        toolContext.state.set('financialReport', errorResult);
      }

      return errorResult;
    }
  }
});

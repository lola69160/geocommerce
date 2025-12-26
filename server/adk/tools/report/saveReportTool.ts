import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../utils/schemaHelper.js';
import type { BusinessInput } from '../../schemas';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Save Report Tool
 *
 * Sauvegarde le rapport HTML généré sur disque.
 * Lit SIRET depuis state.business via ToolContext.
 *
 * - Crée le répertoire de destination si nécessaire
 * - Nomme le fichier avec timestamp + SIRET
 * - Retourne chemin complet du fichier sauvegardé
 */

const SaveReportInputSchema = z.object({
  html: z.string().describe('Contenu HTML du rapport (résultat de generateHTML)'),
  // siret lu depuis state.business via ToolContext
  outputDir: z.string().default('data/professional-reports').describe('Répertoire de destination')
});

export const saveReportTool = new FunctionTool({
  name: 'saveReport',
  description: 'Sauvegarde rapport HTML sur disque. Lit SIRET depuis state.business. Retourne { filepath, size_bytes, saved_at }',
  parameters: zToGen(SaveReportInputSchema),

  execute: async ({ html, outputDir }: z.infer<typeof SaveReportInputSchema>, toolContext?: ToolContext) => {
    // Lire business depuis state pour obtenir SIRET
    const business = toolContext?.state.get('business') as BusinessInput | undefined;
    const siret = business?.siret || business?.siren || 'UNKNOWN';

    try {
      // Créer répertoire si nécessaire
      await fs.mkdir(outputDir, { recursive: true });

      // Générer nom de fichier: YYYYMMDD_HHMMSS_SIRET.html
      const timestamp = new Date()
        .toISOString()
        .replace(/[:\-]/g, '')
        .replace(/\..+/, '')
        .replace('T', '_');

      const filename = `${timestamp}_${siret}.html`;
      const filepath = path.join(outputDir, filename);

      // Sauvegarder fichier
      await fs.writeFile(filepath, html, 'utf8');

      // Vérifier taille fichier
      const stats = await fs.stat(filepath);

      return {
        filepath: path.resolve(filepath),
        filename,
        size_bytes: stats.size,
        saved_at: new Date().toISOString(),
        success: true
      };

    } catch (error: any) {
      console.error('Report save failed:', error.message);
      return {
        filepath: null,
        filename: null,
        size_bytes: 0,
        saved_at: null,
        success: false,
        error: true,
        message: error.message
      };
    }
  }
});

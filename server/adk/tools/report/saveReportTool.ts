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
  description: 'Sauvegarde rapport HTML dans data/professional-reports/{SIRET}/. Lit SIRET depuis state.business. Crée dossier SIRET si nécessaire. Retourne { filepath, filename, siret, siretFolder, size_bytes, saved_at }',
  parameters: zToGen(SaveReportInputSchema),

  execute: async ({ html, outputDir }: z.infer<typeof SaveReportInputSchema>, toolContext?: ToolContext) => {
    // 1. Extraire SIRET du state
    const business = toolContext?.state.get('business') as BusinessInput | undefined;
    const siret = business?.siret || business?.siren || 'UNKNOWN';

    try {
      // 2. Valider SIRET
      if (siret === 'UNKNOWN' || siret.length < 9) {
        throw new Error('Cannot save report: Valid SIRET is required for folder organization');
      }

      // 3. Créer structure de dossier par SIRET: data/professional-reports/{SIRET}/
      const baseDir = outputDir || 'data/professional-reports';
      const siretDir = path.join(baseDir, siret);
      await fs.mkdir(siretDir, { recursive: true });

      // 4. Générer nom de fichier SANS SIRET (redondant)
      const timestamp = new Date()
        .toISOString()
        .replace(/[:\-]/g, '')
        .replace(/\..+/, '')
        .replace('T', '_');

      const filename = `${timestamp}_professional-report.html`;
      const filepath = path.join(siretDir, filename);

      // 5. Sauvegarder fichier
      await fs.writeFile(filepath, html, 'utf8');

      // 6. Retourner métadonnées
      const stats = await fs.stat(filepath);
      return {
        filepath: path.resolve(filepath),
        filename,
        siret,
        siretFolder: siretDir,
        size_bytes: stats.size,
        saved_at: new Date().toISOString(),
        success: true
      };

    } catch (error: any) {
      console.error('[saveReport] ❌ Error:', error.message);
      return {
        filepath: null,
        filename: null,
        siret,
        siretFolder: null,
        size_bytes: 0,
        saved_at: null,
        success: false,
        error: true,
        message: error.message
      };
    }
  }
});

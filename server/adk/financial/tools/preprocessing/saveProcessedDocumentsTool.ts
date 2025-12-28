import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { z } from 'zod';
import { zToGen } from '../../../utils/schemaHelper';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Save Processed Documents Tool
 *
 * Sauvegarde les PDFs consolides dans le dossier A_ANALYSER.
 * Cree le dossier s'il n'existe pas.
 *
 * Structure: data/documents/{siret}/A_ANALYSER/COMPTA{YEAR}.pdf
 */

const SaveProcessedDocumentsInputSchema = z.object({
  siret: z.string().optional().describe('SIRET de l\'entreprise (optionnel, lu automatiquement depuis state.businessInfo)'),
  documents: z.array(z.object({
    filename: z.string().describe('Nom du fichier (ex: COMPTA2023.pdf)'),
    buffer: z.string().describe('Contenu du PDF en base64'),
    year: z.number().describe('Annee fiscale')
  })).describe('Documents a sauvegarder')
});

const SaveProcessedDocumentsOutputSchema = z.object({
  success: z.boolean(),
  savedFiles: z.array(z.object({
    filename: z.string(),
    filePath: z.string(),
    year: z.number(),
    size: z.number()
  })),
  folderPath: z.string(),
  error: z.string().optional()
});

export const saveProcessedDocumentsTool = new FunctionTool({
  name: 'saveProcessedDocuments',
  description: 'Sauvegarde les PDFs consolides dans le dossier A_ANALYSER. Cree le dossier si necessaire. Retourne les chemins des fichiers sauvegardes.',
  parameters: zToGen(SaveProcessedDocumentsInputSchema),

  execute: async (params: {
    siret?: string;
    documents: Array<{ filename: string; buffer: string; year: number }>;
  }, toolContext?: ToolContext) => {
    const { siret, documents } = params;

    try {
      // Toujours lire le SIRET depuis state.businessInfo (plus fiable)
      const businessInfo = toolContext?.state.get('businessInfo') as { siret?: string } | undefined;
      const effectiveSiret = businessInfo?.siret || siret;

      console.log(`\n[saveProcessedDocuments] Saving ${documents.length} document(s) for SIRET ${effectiveSiret}`);

      if (!effectiveSiret) {
        return {
          success: false,
          savedFiles: [],
          folderPath: '',
          error: 'SIRET not available in state.businessInfo'
        };
      }

      // 1. Construire le chemin du dossier A_ANALYSER
      const folderPath = path.join(process.cwd(), 'data', 'documents', effectiveSiret!, 'A_ANALYSER');

      // 2. Creer le dossier s'il n'existe pas (recursif)
      try {
        await fs.mkdir(folderPath, { recursive: true });
        console.log(`[saveProcessedDocuments] Created/verified folder: ${folderPath}`);
      } catch (mkdirError: any) {
        console.error('[saveProcessedDocuments] Error creating folder:', mkdirError.message);
        return {
          success: false,
          savedFiles: [],
          folderPath,
          error: `Failed to create folder: ${mkdirError.message}`
        };
      }

      // 3. Sauvegarder chaque document
      const savedFiles: Array<{ filename: string; filePath: string; year: number; size: number }> = [];

      for (const doc of documents) {
        const { filename, buffer, year } = doc;

        try {
          // Convertir base64 en buffer
          const pdfBuffer = Buffer.from(buffer, 'base64');

          // Chemin complet du fichier
          const filePath = path.join(folderPath, filename);

          // Ecrire le fichier
          await fs.writeFile(filePath, pdfBuffer);

          console.log(`[saveProcessedDocuments] Saved: ${filename} (${pdfBuffer.length} bytes)`);

          savedFiles.push({
            filename,
            filePath,
            year,
            size: pdfBuffer.length
          });

        } catch (writeError: any) {
          console.error(`[saveProcessedDocuments] Error saving ${filename}:`, writeError.message);
          // Continuer avec les autres fichiers
        }
      }

      if (savedFiles.length === 0) {
        return {
          success: false,
          savedFiles: [],
          folderPath,
          error: 'No files could be saved'
        };
      }

      console.log(`[saveProcessedDocuments] Successfully saved ${savedFiles.length}/${documents.length} file(s)`);

      return {
        success: true,
        savedFiles,
        folderPath
      };

    } catch (error: any) {
      console.error('[saveProcessedDocuments] Error:', error.message);
      return {
        success: false,
        savedFiles: [],
        folderPath: '',
        error: error.message
      };
    }
  }
});

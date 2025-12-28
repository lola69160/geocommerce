import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { z } from 'zod';
import { zToGen } from '../../../utils/schemaHelper';

/**
 * List COMPTA Documents Tool
 *
 * Liste tous les documents COMPTA disponibles dans state.documents.
 * Filtre les documents dont le filename contient "COMPTA" (insensible a la casse).
 *
 * DOIT etre appele EN PREMIER pour eviter que l'agent hallucine des noms de fichiers.
 */

const ListComptaDocumentsInputSchema = z.object({});

const ListComptaDocumentsOutputSchema = z.object({
  comptaDocuments: z.array(z.object({
    filename: z.string(),
    hasContent: z.boolean(),
    hasFilePath: z.boolean()
  })),
  otherDocuments: z.array(z.object({
    filename: z.string()
  })),
  comptaCount: z.number(),
  totalCount: z.number(),
  siret: z.string().nullable(),
  error: z.string().optional()
});

export const listComptaDocumentsTool = new FunctionTool({
  name: 'listComptaDocuments',
  description: 'Liste TOUS les documents COMPTA disponibles avec leurs filenames EXACTS. DOIT etre appele EN PREMIER pour connaitre les documents a traiter. Retourne aussi le SIRET depuis businessInfo.',
  parameters: zToGen(ListComptaDocumentsInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    try {
      // Lire documents depuis state
      const documents = toolContext?.state.get('documents') as Array<{
        filename: string;
        filePath?: string;
        content?: Buffer | string;
      }> | undefined;

      // Lire businessInfo pour le SIRET
      const businessInfo = toolContext?.state.get('businessInfo') as {
        siret?: string;
        name?: string;
      } | undefined;

      const siret = businessInfo?.siret || null;

      console.log(`\n[listComptaDocuments] SIRET from businessInfo: ${siret}`);

      if (!documents || documents.length === 0) {
        console.log('[listComptaDocuments] No documents found in state');
        return {
          comptaDocuments: [],
          otherDocuments: [],
          comptaCount: 0,
          totalCount: 0,
          siret
        };
      }

      // Filtrer les documents COMPTA (insensible a la casse)
      const comptaDocuments = documents
        .filter(d => d.filename.toUpperCase().includes('COMPTA'))
        .map(d => ({
          filename: d.filename,
          hasContent: !!d.content,
          hasFilePath: !!d.filePath
        }));

      const otherDocuments = documents
        .filter(d => !d.filename.toUpperCase().includes('COMPTA'))
        .map(d => ({ filename: d.filename }));

      console.log(`\n📋 [listComptaDocuments] Found ${comptaDocuments.length} COMPTA document(s):`);
      comptaDocuments.forEach((d, index) => {
        console.log(`  ${index + 1}. "${d.filename}"`);
      });

      if (otherDocuments.length > 0) {
        console.log(`\n📋 [listComptaDocuments] Other documents (${otherDocuments.length}):`);
        otherDocuments.forEach((d, index) => {
          console.log(`  ${index + 1}. "${d.filename}"`);
        });
      }

      console.log('');

      return {
        comptaDocuments,
        otherDocuments,
        comptaCount: comptaDocuments.length,
        totalCount: documents.length,
        siret
      };

    } catch (error: any) {
      console.error('[listComptaDocuments] Error:', error.message);
      return {
        comptaDocuments: [],
        otherDocuments: [],
        comptaCount: 0,
        totalCount: 0,
        siret: null,
        error: error.message
      };
    }
  }
});

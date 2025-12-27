import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { z } from 'zod';
import { zToGen } from '../../../utils/schemaHelper';

/**
 * List Documents Tool
 *
 * Liste TOUS les documents disponibles dans state.documents avec leurs filenames EXACTS.
 *
 * Ce tool est CRITIQUE pour éviter que l'agent invente des noms de fichiers.
 * L'agent DOIT appeler ce tool EN PREMIER pour obtenir la liste exacte des documents disponibles.
 *
 * Retourne uniquement les métadonnées (filename, hasContent, hasFilePath), pas le contenu complet.
 */

const ListDocumentsInputSchema = z.object({});

const ListDocumentsOutputSchema = z.object({
  documents: z.array(z.object({
    filename: z.string(),
    hasContent: z.boolean(),
    hasFilePath: z.boolean()
  })),
  count: z.number(),
  error: z.string().optional()
});

export const listDocumentsTool = new FunctionTool({
  name: 'listDocuments',
  description: 'Liste TOUS les documents disponibles dans state.documents avec leurs filenames EXACTS. DOIT être appelé en premier pour connaître les documents disponibles. Retourne: { documents: [{ filename, hasContent, hasFilePath }], count }',
  parameters: zToGen(ListDocumentsInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    try {
      // Lire documents depuis state
      const documents = toolContext?.state.get('documents') as Array<{
        filename: string;
        filePath?: string;
        content?: Buffer | string;
      }> | undefined;

      if (!documents || documents.length === 0) {
        console.log('[listDocuments] No documents found in state');
        return {
          documents: [],
          count: 0
        };
      }

      // Mapper uniquement filename et disponibilité (pas le contenu complet)
      const documentList = documents.map(doc => ({
        filename: doc.filename,  // EXACT filename - ne PAS modifier
        hasContent: !!doc.content,
        hasFilePath: !!doc.filePath
      }));

      console.log(`\n📋 [listDocuments] Found ${documentList.length} document(s):`);
      documentList.forEach((d, index) => {
        console.log(`  ${index + 1}. "${d.filename}"`);
        console.log(`     - hasContent: ${d.hasContent}`);
        console.log(`     - hasFilePath: ${d.hasFilePath}`);
      });
      console.log('');

      return {
        documents: documentList,
        count: documentList.length
      };

    } catch (error: any) {
      console.error('[listDocuments] Error:', error.message);
      return {
        documents: [],
        count: 0,
        error: error.message
      };
    }
  }
});

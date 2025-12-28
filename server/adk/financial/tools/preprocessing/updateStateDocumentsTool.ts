import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { z } from 'zod';
import { zToGen } from '../../../utils/schemaHelper';

/**
 * Update State Documents Tool
 *
 * Met a jour state.documents en remplacant les documents COMPTA originaux
 * par les documents consolides.
 *
 * Les documents non-COMPTA restent inchanges.
 */

const UpdateStateDocumentsInputSchema = z.object({
  consolidatedDocuments: z.array(z.object({
    filename: z.string().describe('Nom du fichier consolide (ex: COMPTA2023.pdf)'),
    filePath: z.string().describe('Chemin complet vers le fichier'),
    year: z.number().describe('Annee fiscale')
  })).describe('Documents consolides a ajouter au state'),
  originalFilenames: z.array(z.string()).describe('Noms des fichiers COMPTA originaux a remplacer')
});

const UpdateStateDocumentsOutputSchema = z.object({
  success: z.boolean(),
  documentsUpdated: z.number(),
  originalRemoved: z.number(),
  consolidatedAdded: z.number(),
  finalDocumentCount: z.number(),
  error: z.string().optional()
});

export const updateStateDocumentsTool = new FunctionTool({
  name: 'updateStateDocuments',
  description: 'Met a jour state.documents en remplacant les documents COMPTA originaux par les versions consolidees. Les documents non-COMPTA restent inchanges.',
  parameters: zToGen(UpdateStateDocumentsInputSchema),

  execute: async (params: {
    consolidatedDocuments: Array<{ filename: string; filePath: string; year: number }>;
    originalFilenames: string[];
  }, toolContext?: ToolContext) => {
    const { consolidatedDocuments, originalFilenames } = params;

    try {
      console.log(`\n[updateStateDocuments] Updating state.documents`);
      console.log(`[updateStateDocuments] Removing ${originalFilenames.length} original COMPTA docs`);
      console.log(`[updateStateDocuments] Adding ${consolidatedDocuments.length} consolidated docs`);

      // 1. Lire les documents actuels depuis state
      const currentDocuments = toolContext?.state.get('documents') as Array<{
        filename: string;
        filePath?: string;
        content?: Buffer | string;
      }> | undefined;

      if (!currentDocuments) {
        return {
          success: false,
          documentsUpdated: 0,
          originalRemoved: 0,
          consolidatedAdded: 0,
          finalDocumentCount: 0,
          error: 'No documents found in state'
        };
      }

      console.log(`[updateStateDocuments] Current documents: ${currentDocuments.length}`);
      currentDocuments.forEach(d => console.log(`  - ${d.filename}`));

      // 2. Filtrer les documents COMPTA originaux
      const nonComptaDocuments = currentDocuments.filter(doc => {
        const isOriginalCompta = originalFilenames.includes(doc.filename);
        if (isOriginalCompta) {
          console.log(`[updateStateDocuments] Removing: ${doc.filename}`);
        }
        return !isOriginalCompta;
      });

      const removedCount = currentDocuments.length - nonComptaDocuments.length;

      // 3. Ajouter les documents consolides
      const newDocuments = [
        ...nonComptaDocuments,
        ...consolidatedDocuments.map(doc => ({
          filename: doc.filename,
          filePath: doc.filePath
          // Pas de content - sera lu depuis filePath par DocumentExtractionAgent
        }))
      ];

      console.log(`[updateStateDocuments] New documents: ${newDocuments.length}`);
      newDocuments.forEach(d => console.log(`  - ${d.filename}${d.filePath ? ' (from file)' : ''}`));

      // 4. Mettre a jour le state
      if (toolContext?.state) {
        toolContext.state.set('documents', newDocuments);
        console.log(`[updateStateDocuments] State updated successfully`);
      } else {
        console.warn('[updateStateDocuments] No toolContext.state available, cannot update');
        return {
          success: false,
          documentsUpdated: 0,
          originalRemoved: removedCount,
          consolidatedAdded: consolidatedDocuments.length,
          finalDocumentCount: newDocuments.length,
          error: 'toolContext.state not available'
        };
      }

      return {
        success: true,
        documentsUpdated: removedCount + consolidatedDocuments.length,
        originalRemoved: removedCount,
        consolidatedAdded: consolidatedDocuments.length,
        finalDocumentCount: newDocuments.length
      };

    } catch (error: any) {
      console.error('[updateStateDocuments] Error:', error.message);
      return {
        success: false,
        documentsUpdated: 0,
        originalRemoved: 0,
        consolidatedAdded: 0,
        finalDocumentCount: 0,
        error: error.message
      };
    }
  }
});

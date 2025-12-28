import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { z } from 'zod';
import { zToGen } from '../../../utils/schemaHelper';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Check Processed Documents Tool
 *
 * Verifie si le dossier A_ANALYSER existe et contient des PDFs preprocesses.
 * Si oui, le preprocessing peut etre saute et on utilise les fichiers existants.
 *
 * Le SIRET est TOUJOURS lu depuis state.businessInfo.siret (pas de parametre).
 */

const CheckProcessedDocumentsInputSchema = z.object({});

const CheckProcessedDocumentsOutputSchema = z.object({
  exists: z.boolean().describe('true si le dossier A_ANALYSER existe'),
  files: z.array(z.string()).describe('Liste des fichiers PDF dans le dossier'),
  folderPath: z.string().describe('Chemin complet du dossier A_ANALYSER'),
  siret: z.string().describe('SIRET utilise'),
  comptaDocuments: z.array(z.string()).describe('Documents COMPTA disponibles dans state'),
  error: z.string().optional()
});

export const checkProcessedDocumentsTool = new FunctionTool({
  name: 'checkProcessedDocuments',
  description: 'Verifie si des documents COMPTA preprocesses existent dans A_ANALYSER. Lit automatiquement le SIRET depuis state.businessInfo et liste les documents COMPTA disponibles. Retourne: { exists, files, siret, comptaDocuments }',
  parameters: zToGen(CheckProcessedDocumentsInputSchema),

  execute: async (params: {}, toolContext?: ToolContext) => {
    try {
      // TOUJOURS recuperer le SIRET depuis le state
      const businessInfo = toolContext?.state.get('businessInfo') as { siret?: string; name?: string } | undefined;
      const siret = businessInfo?.siret;

      if (!siret) {
        return {
          exists: false,
          files: [],
          folderPath: '',
          siret: '',
          comptaDocuments: [],
          error: 'SIRET non disponible dans state.businessInfo'
        };
      }

      // Utiliser SIREN (9 premiers chiffres) pour le dossier
      const siren = siret.substring(0, 9);
      console.log(`\n[checkProcessedDocuments] SIREN: ${siren} (from SIRET: ${siret})`);

      // Lister les documents COMPTA disponibles dans state.documents
      const documents = toolContext?.state.get('documents') as Array<{ filename: string }> | undefined;
      const comptaDocuments = (documents || [])
        .filter(d => d.filename.toUpperCase().includes('COMPTA'))
        .map(d => d.filename);

      console.log(`[checkProcessedDocuments] Documents COMPTA dans state: ${comptaDocuments.length}`);
      comptaDocuments.forEach(f => console.log(`  - ${f}`));

      // Construire le chemin vers A_ANALYSER avec SIREN
      const folderPath = path.join(process.cwd(), 'data', 'documents', siren, 'A_ANALYSER');

      console.log(`\n[checkProcessedDocuments] Verification du dossier: ${folderPath}`);

      // Verifier si le dossier existe
      try {
        await fs.access(folderPath);
      } catch {
        console.log('[checkProcessedDocuments] Dossier A_ANALYSER non trouve');
        return {
          exists: false,
          files: [],
          folderPath,
          siret: siret,
          siren: siren,
          comptaDocuments
        };
      }

      // Lister les fichiers PDF dans le dossier
      const allFiles = await fs.readdir(folderPath);
      const pdfFiles = allFiles.filter(f => f.toLowerCase().endsWith('.pdf'));

      console.log(`[checkProcessedDocuments] Dossier A_ANALYSER trouve avec ${pdfFiles.length} fichier(s) PDF`);
      pdfFiles.forEach(f => console.log(`  - ${f}`));

      return {
        exists: pdfFiles.length > 0,
        files: pdfFiles,
        folderPath,
        siret: siret,
        siren: siren,
        comptaDocuments
      };

    } catch (error: any) {
      console.error('[checkProcessedDocuments] Error:', error.message);
      return {
        exists: false,
        files: [],
        folderPath: '',
        siret: '',
        comptaDocuments: [],
        error: error.message
      };
    }
  }
});

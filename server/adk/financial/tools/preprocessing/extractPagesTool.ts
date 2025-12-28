import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { z } from 'zod';
import { zToGen } from '../../../utils/schemaHelper';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Extract Pages Tool
 *
 * Extrait des pages specifiques d'un PDF et les retourne comme buffers individuels.
 * Utilise pdf-lib pour extraire chaque page comme un PDF separe.
 *
 * Chaque page est retournee comme un PDF d'une seule page en base64,
 * pret a etre envoye a Gemini Vision pour classification.
 */

const ExtractPagesInputSchema = z.object({
  filename: z.string().describe('Nom exact du fichier PDF source'),
  pageNumbers: z.array(z.number()).optional().describe('Numeros des pages a extraire (1-indexed). Si omis, extrait toutes les pages.')
});

const ExtractPagesOutputSchema = z.object({
  filename: z.string(),
  totalPages: z.number(),
  extractedPages: z.array(z.object({
    pageNumber: z.number(),
    buffer: z.string().describe('Page en base64 (PDF d\'une seule page)')
  })),
  error: z.string().optional()
});

export const extractPagesTool = new FunctionTool({
  name: 'extractPages',
  description: 'Extrait des pages individuelles d\'un PDF. Chaque page est retournee comme un PDF d\'une seule page en base64, pret pour analyse Vision. Retourne: { filename, totalPages, extractedPages: [{ pageNumber, buffer }] }',
  parameters: zToGen(ExtractPagesInputSchema),

  execute: async (params: { filename: string; pageNumbers?: number[] }, toolContext?: ToolContext) => {
    const { filename, pageNumbers } = params;

    try {
      console.log(`\n[extractPages] Extracting pages from: ${filename}`);

      // 1. Charger PDF depuis state.documents
      const documents = toolContext?.state.get('documents') as Array<{
        filename: string;
        filePath?: string;
        content?: Buffer | string;
      }> | undefined;

      if (!documents || documents.length === 0) {
        return {
          filename,
          totalPages: 0,
          extractedPages: [],
          error: 'No documents found in state.documents'
        };
      }

      const doc = documents.find(d => d.filename === filename);

      if (!doc) {
        return {
          filename,
          totalPages: 0,
          extractedPages: [],
          error: `Document ${filename} not found in state.documents`
        };
      }

      // 2. Obtenir le buffer PDF
      let buffer: Buffer;

      if (doc.filePath) {
        const fullPath = path.resolve(doc.filePath);
        buffer = await fs.readFile(fullPath);
      } else if (doc.content) {
        if (Buffer.isBuffer(doc.content)) {
          buffer = doc.content;
        } else if (typeof doc.content === 'string') {
          buffer = Buffer.from(doc.content, 'base64');
        } else {
          return {
            filename,
            totalPages: 0,
            extractedPages: [],
            error: 'Document content is not Buffer or string'
          };
        }
      } else {
        return {
          filename,
          totalPages: 0,
          extractedPages: [],
          error: 'Document has no filePath or content'
        };
      }

      console.log(`[extractPages] PDF buffer size: ${buffer.length} bytes`);

      // 3. Charger le PDF avec pdf-lib
      const srcPdf = await PDFDocument.load(buffer);
      const totalPages = srcPdf.getPageCount();

      console.log(`[extractPages] PDF has ${totalPages} pages`);

      // 4. Determiner quelles pages extraire
      const pagesToExtract = pageNumbers && pageNumbers.length > 0
        ? pageNumbers.filter(p => p >= 1 && p <= totalPages)
        : Array.from({ length: totalPages }, (_, i) => i + 1);

      console.log(`[extractPages] Extracting ${pagesToExtract.length} pages: ${pagesToExtract.join(', ')}`);

      // 5. Extraire chaque page comme un PDF separe
      const extractedPages: Array<{ pageNumber: number; buffer: string }> = [];

      for (const pageNum of pagesToExtract) {
        try {
          // Creer un nouveau PDF avec une seule page
          const singlePagePdf = await PDFDocument.create();

          // Copier la page (pdf-lib utilise index 0-based)
          const [copiedPage] = await singlePagePdf.copyPages(srcPdf, [pageNum - 1]);
          singlePagePdf.addPage(copiedPage);

          // Sauvegarder comme buffer
          const pdfBytes = await singlePagePdf.save();
          const pdfBuffer = Buffer.from(pdfBytes);

          extractedPages.push({
            pageNumber: pageNum,
            buffer: pdfBuffer.toString('base64')
          });

        } catch (pageError: any) {
          console.error(`[extractPages] Error extracting page ${pageNum}:`, pageError.message);
          // Continuer avec les autres pages
        }
      }

      console.log(`[extractPages] Successfully extracted ${extractedPages.length}/${pagesToExtract.length} pages`);

      return {
        filename,
        totalPages,
        extractedPages
      };

    } catch (error: any) {
      console.error('[extractPages] Error:', error.message);
      return {
        filename,
        totalPages: 0,
        extractedPages: [],
        error: error.message
      };
    }
  }
});

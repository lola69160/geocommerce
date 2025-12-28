import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { z } from 'zod';
import { zToGen } from '../../../utils/schemaHelper';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Create Consolidated PDF Tool
 *
 * Cree un nouveau PDF consolide a partir de pages selectionnees d'un PDF source.
 * Les pages sont ordonnees selon leur type : bilan_actif, bilan_passif, compte_resultat, sig.
 *
 * Utilise pdf-lib pour copier les pages selectionnees dans un nouveau document.
 */

const CreateConsolidatedPdfInputSchema = z.object({
  sourceFilename: z.string().describe('Nom du fichier PDF source'),
  pages: z.array(z.object({
    pageNumber: z.number().describe('Numero de page dans le source (1-indexed)'),
    pageType: z.enum(['bilan_actif', 'bilan_passif', 'compte_resultat', 'sig']).describe('Type de la page')
  })).describe('Pages a inclure dans le PDF consolide'),
  year: z.number().describe('Annee fiscale pour nommer le fichier'),
  outputFilename: z.string().describe('Nom du fichier de sortie (ex: COMPTA2023.pdf)')
});

const CreateConsolidatedPdfOutputSchema = z.object({
  success: z.boolean(),
  filename: z.string(),
  year: z.number(),
  pageCount: z.number(),
  pageTypes: z.array(z.string()),
  buffer: z.string().describe('PDF consolide en base64'),
  error: z.string().optional()
});

// Ordre de tri des pages dans le PDF consolide
const PAGE_TYPE_ORDER: Record<string, number> = {
  'bilan_actif': 1,
  'bilan_passif': 2,
  'compte_resultat': 3,
  'sig': 4
};

export const createConsolidatedPdfTool = new FunctionTool({
  name: 'createConsolidatedPdf',
  description: 'Cree un PDF consolide a partir de pages selectionnees. Les pages sont ordonnees : bilan_actif -> bilan_passif -> compte_resultat -> sig. Retourne le PDF en base64.',
  parameters: zToGen(CreateConsolidatedPdfInputSchema),

  execute: async (params: {
    sourceFilename: string;
    pages: Array<{ pageNumber: number; pageType: string }>;
    year: number;
    outputFilename: string;
  }, toolContext?: ToolContext) => {
    const { sourceFilename, pages, year, outputFilename } = params;

    try {
      console.log(`\n[createConsolidatedPdf] Creating ${outputFilename} from ${sourceFilename}`);
      console.log(`[createConsolidatedPdf] Pages to include: ${pages.map(p => `${p.pageNumber}(${p.pageType})`).join(', ')}`);

      if (pages.length === 0) {
        return {
          success: false,
          filename: outputFilename,
          year,
          pageCount: 0,
          pageTypes: [],
          buffer: '',
          error: 'No pages to consolidate'
        };
      }

      // 1. Charger PDF source depuis state.documents
      const documents = toolContext?.state.get('documents') as Array<{
        filename: string;
        filePath?: string;
        content?: Buffer | string;
      }> | undefined;

      if (!documents || documents.length === 0) {
        return {
          success: false,
          filename: outputFilename,
          year,
          pageCount: 0,
          pageTypes: [],
          buffer: '',
          error: 'No documents found in state.documents'
        };
      }

      const doc = documents.find(d => d.filename === sourceFilename);

      if (!doc) {
        return {
          success: false,
          filename: outputFilename,
          year,
          pageCount: 0,
          pageTypes: [],
          buffer: '',
          error: `Source document ${sourceFilename} not found`
        };
      }

      // 2. Obtenir le buffer PDF source
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
            success: false,
            filename: outputFilename,
            year,
            pageCount: 0,
            pageTypes: [],
            buffer: '',
            error: 'Document content is not Buffer or string'
          };
        }
      } else {
        return {
          success: false,
          filename: outputFilename,
          year,
          pageCount: 0,
          pageTypes: [],
          buffer: '',
          error: 'Source document has no filePath or content'
        };
      }

      // 3. Charger le PDF source avec pdf-lib
      const srcPdf = await PDFDocument.load(buffer);
      const totalPages = srcPdf.getPageCount();

      // 4. Trier les pages selon l'ordre souhaite
      const sortedPages = [...pages].sort((a, b) => {
        const orderA = PAGE_TYPE_ORDER[a.pageType] ?? 99;
        const orderB = PAGE_TYPE_ORDER[b.pageType] ?? 99;
        return orderA - orderB;
      });

      console.log(`[createConsolidatedPdf] Sorted order: ${sortedPages.map(p => `${p.pageNumber}(${p.pageType})`).join(', ')}`);

      // 5. Creer le nouveau PDF
      const newPdf = await PDFDocument.create();

      // Ajouter metadata
      newPdf.setTitle(`Analyse Comptable ${year}`);
      newPdf.setSubject(`Documents comptables consolides - Exercice ${year}`);
      newPdf.setCreator('SearchCommerce Financial Pipeline');
      newPdf.setProducer('pdf-lib');
      newPdf.setCreationDate(new Date());

      // 6. Copier les pages dans l'ordre
      const pageTypes: string[] = [];
      let addedPages = 0;

      for (const pageInfo of sortedPages) {
        const { pageNumber, pageType } = pageInfo;

        // Verifier que le numero de page est valide
        if (pageNumber < 1 || pageNumber > totalPages) {
          console.warn(`[createConsolidatedPdf] Page ${pageNumber} out of range (1-${totalPages}), skipping`);
          continue;
        }

        try {
          // pdf-lib utilise index 0-based
          const [copiedPage] = await newPdf.copyPages(srcPdf, [pageNumber - 1]);
          newPdf.addPage(copiedPage);
          pageTypes.push(pageType);
          addedPages++;
          console.log(`[createConsolidatedPdf] Added page ${pageNumber} (${pageType})`);
        } catch (copyError: any) {
          console.error(`[createConsolidatedPdf] Error copying page ${pageNumber}:`, copyError.message);
        }
      }

      if (addedPages === 0) {
        return {
          success: false,
          filename: outputFilename,
          year,
          pageCount: 0,
          pageTypes: [],
          buffer: '',
          error: 'No pages could be copied to the consolidated PDF'
        };
      }

      // 7. Sauvegarder le PDF comme buffer
      const pdfBytes = await newPdf.save();
      const pdfBuffer = Buffer.from(pdfBytes);

      console.log(`[createConsolidatedPdf] Created ${outputFilename} with ${addedPages} pages (${pdfBuffer.length} bytes)`);

      return {
        success: true,
        filename: outputFilename,
        year,
        pageCount: addedPages,
        pageTypes,
        buffer: pdfBuffer.toString('base64')
      };

    } catch (error: any) {
      console.error('[createConsolidatedPdf] Error:', error.message);
      return {
        success: false,
        filename: outputFilename,
        year,
        pageCount: 0,
        pageTypes: [],
        buffer: '',
        error: error.message
      };
    }
  }
});

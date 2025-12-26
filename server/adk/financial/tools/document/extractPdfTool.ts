import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';
import fs from 'fs/promises';
import path from 'path';
// Utiliser le build legacy pour Node.js (pas de DOM)
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * Extract PDF Tool
 *
 * Extrait le texte brut d'un fichier PDF.
 * Lit les documents depuis state.documents.
 */

const ExtractPdfInputSchema = z.object({
  filename: z.string().describe('Nom du fichier PDF à extraire')
});

const ExtractPdfOutputSchema = z.object({
  filename: z.string(),
  text: z.string(),
  pages: z.number(),
  error: z.string().optional()
});

export const extractPdfTool = new FunctionTool({
  name: 'extractPdf',
  description: 'Extrait le texte brut d\'un fichier PDF. Retourne: { filename, text, pages } ou { error } si échec.',
  parameters: zToGen(ExtractPdfInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    const { filename } = params;

    try {
      // Lire les documents depuis state
      const documents = toolContext?.state.get('documents') as Array<{
        filename: string;
        filePath?: string;
        content?: Buffer | string;
      }> | undefined;

      if (!documents || documents.length === 0) {
        return {
          filename,
          text: '',
          pages: 0,
          error: 'No documents found in state'
        };
      }

      // Trouver le document demandé
      const doc = documents.find(d => d.filename === filename);

      if (!doc) {
        return {
          filename,
          text: '',
          pages: 0,
          error: `Document ${filename} not found in state.documents`
        };
      }

      let buffer: Buffer;

      // Charger le PDF soit depuis filePath soit depuis content
      if (doc.filePath) {
        // Lecture depuis filesystem
        const fullPath = path.resolve(doc.filePath);
        buffer = await fs.readFile(fullPath);
      } else if (doc.content) {
        // Utiliser content directement (Buffer ou base64 string)
        if (typeof doc.content === 'string') {
          // Assume base64
          buffer = Buffer.from(doc.content, 'base64');
        } else {
          buffer = doc.content;
        }
      } else {
        return {
          filename,
          text: '',
          pages: 0,
          error: 'Document has no filePath or content'
        };
      }

      // Extraire texte avec pdfjs-dist (Mozilla PDF.js - standard de l'industrie)
      // Convertir Buffer Node.js en Uint8Array pour pdfjs-dist
      const uint8Array = new Uint8Array(buffer);

      const loadingTask = pdfjsLib.getDocument({
        data: uint8Array,
        useSystemFonts: true,
        standardFontDataUrl: undefined // Pas besoin de polices standard pour l'extraction texte
      });

      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;

      // Extraire le texte de toutes les pages
      let fullText = '';

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Reconstruire le texte avec espaces et retours à la ligne
        const pageText = textContent.items
          .map((item: any) => {
            // Vérifier si l'item a une propriété str (texte)
            if (item.str) {
              return item.str;
            }
            return '';
          })
          .join(' ');

        fullText += pageText + '\n\n';
      }

      return {
        filename,
        text: fullText.trim(),
        pages: numPages
      };

    } catch (error: any) {
      return {
        filename,
        text: '',
        pages: 0,
        error: error.message || 'PDF extraction failed'
      };
    }
  }
});

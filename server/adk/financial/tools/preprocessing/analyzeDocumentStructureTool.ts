import { FunctionTool } from '@google/adk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ToolContext } from '@google/adk';
import { z } from 'zod';
import { zToGen } from '../../../utils/schemaHelper';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Analyze Document Structure Tool
 *
 * Analyse un document COMPTA complet avec Gemini Vision pour identifier
 * les pages pertinentes (Bilan Actif, Bilan Passif, CR, SIG).
 *
 * Une seule requête Gemini pour tout le document au lieu d'une par page.
 */

const AnalyzeDocumentStructureInputSchema = z.object({
  filename: z.string().describe('Nom exact du fichier PDF à analyser')
});

const AnalyzeDocumentStructureOutputSchema = z.object({
  filename: z.string(),
  totalPages: z.number(),
  year: z.number().nullable(),
  relevantPages: z.array(z.object({
    pageNumber: z.number(),
    pageType: z.enum(['bilan_actif', 'bilan_passif', 'compte_resultat', 'sig']),
    confidence: z.number()
  })),
  summary: z.string(),
  error: z.string().optional()
});

const DOCUMENT_STRUCTURE_PROMPT = `Tu es un expert-comptable français. Analyse ce document PDF comptable et identifie les pages contenant des informations financières importantes.

OBJECTIF: Identifier les numéros de pages contenant:

1. BILAN ACTIF (tableau ACTIF avec Immobilisations, Actif circulant, Stocks, Créances)
2. BILAN PASSIF (tableau PASSIF avec Capitaux propres, Dettes, Provisions)
3. COMPTE DE RESULTAT (tableau avec Produits, Charges, Résultat d'exploitation, Résultat net)
4. SIG - Soldes Intermédiaires de Gestion (Marge commerciale, Valeur ajoutée, EBE)

IGNORE les pages suivantes:
- Pages de garde, sommaires, attestations
- Annexes textuelles sans tableaux chiffrés
- Rapports d'audit narratifs
- Pages avec uniquement du texte

EXTRACTION DE L'ANNEE:
- Cherche "Exercice clos le DD/MM/YYYY" ou "Période du ... au DD/MM/YYYY"
- Format de sortie: YYYY (nombre entier, ex: 2023)

REPONSE JSON UNIQUEMENT (pas de texte avant/après):
{
  "year": 2023,
  "relevantPages": [
    { "pageNumber": 5, "pageType": "bilan_actif", "confidence": 0.95 },
    { "pageNumber": 6, "pageType": "bilan_passif", "confidence": 0.95 },
    { "pageNumber": 7, "pageType": "compte_resultat", "confidence": 0.90 },
    { "pageNumber": 8, "pageType": "sig", "confidence": 0.85 }
  ],
  "summary": "Document de 34 pages, exercice clos au 30/11/2023. Pages pertinentes identifiées: 5 (Actif), 6 (Passif), 7 (CR), 8 (SIG)."
}

IMPORTANT:
- Les numéros de pages sont 1-indexed (la première page = 1)
- Si plusieurs pages contiennent le même type, inclure toutes les pages
- Ne retourne que les pages avec des tableaux comptables chiffrés
- confidence: 0.9+ = très sûr, 0.7-0.9 = probable, 0.5-0.7 = incertain`;

export const analyzeDocumentStructureTool = new FunctionTool({
  name: 'analyzeDocumentStructure',
  description: 'Analyse un document COMPTA complet pour identifier les pages pertinentes (Bilan, CR, SIG) en une seule requête. Retourne les numéros de pages par type.',
  parameters: zToGen(AnalyzeDocumentStructureInputSchema),

  execute: async (params: { filename: string }, toolContext?: ToolContext) => {
    const { filename } = params;

    try {
      console.log(`\n[analyzeDocumentStructure] Analyzing document: ${filename}`);

      // Verifier GEMINI_API_KEY
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return {
          filename,
          totalPages: 0,
          year: null,
          relevantPages: [],
          summary: '',
          error: 'GEMINI_API_KEY not configured'
        };
      }

      // 1. Charger le document depuis state.documents
      const documents = toolContext?.state.get('documents') as Array<{
        filename: string;
        filePath?: string;
        content?: Buffer | string;
      }> | undefined;

      if (!documents || documents.length === 0) {
        return {
          filename,
          totalPages: 0,
          year: null,
          relevantPages: [],
          summary: '',
          error: 'No documents found in state.documents'
        };
      }

      const doc = documents.find(d => d.filename === filename);

      if (!doc) {
        console.error(`[analyzeDocumentStructure] Document not found: ${filename}`);
        console.log('[analyzeDocumentStructure] Available documents:', documents.map(d => d.filename));
        return {
          filename,
          totalPages: 0,
          year: null,
          relevantPages: [],
          summary: '',
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
            year: null,
            relevantPages: [],
            summary: '',
            error: 'Document content is not Buffer or string'
          };
        }
      } else {
        return {
          filename,
          totalPages: 0,
          year: null,
          relevantPages: [],
          summary: '',
          error: 'Document has no filePath or content'
        };
      }

      console.log(`[analyzeDocumentStructure] PDF buffer size: ${buffer.length} bytes`);

      // 3. Appeler Gemini Vision avec le document complet
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash"
      });

      console.log(`[analyzeDocumentStructure] Sending to Gemini Vision...`);

      const result = await model.generateContent({
        contents: [{
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "application/pdf",
                data: buffer.toString('base64')
              }
            },
            { text: DOCUMENT_STRUCTURE_PROMPT }
          ]
        }],
        generationConfig: {
          temperature: 0.2,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 2048,
          responseMimeType: "application/json"
        }
      });

      const responseText = result.response.text();
      console.log(`[analyzeDocumentStructure] Gemini response length: ${responseText.length} chars`);

      // 4. Parser la réponse JSON
      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch (parseError: any) {
        console.error(`[analyzeDocumentStructure] JSON parse error:`, parseError.message);
        console.log(`[analyzeDocumentStructure] Raw response:`, responseText.substring(0, 500));
        return {
          filename,
          totalPages: 0,
          year: null,
          relevantPages: [],
          summary: '',
          error: `Failed to parse Gemini response: ${parseError.message}`
        };
      }

      // 5. Valider et formater les résultats
      const validTypes = ['bilan_actif', 'bilan_passif', 'compte_resultat', 'sig'];
      const relevantPages = (parsed.relevantPages || [])
        .filter((p: any) => validTypes.includes(p.pageType))
        .map((p: any) => ({
          pageNumber: p.pageNumber,
          pageType: p.pageType,
          confidence: p.confidence || 0.8
        }));

      console.log(`[analyzeDocumentStructure] Found ${relevantPages.length} relevant pages:`);
      relevantPages.forEach((p: any) => {
        console.log(`  - Page ${p.pageNumber}: ${p.pageType} (confidence: ${p.confidence})`);
      });

      return {
        filename,
        totalPages: 0, // Non déterminé sans pdf-lib
        year: parsed.year || null,
        relevantPages,
        summary: parsed.summary || `Found ${relevantPages.length} relevant pages`
      };

    } catch (error: any) {
      console.error('[analyzeDocumentStructure] Error:', error.message);
      return {
        filename,
        totalPages: 0,
        year: null,
        relevantPages: [],
        summary: '',
        error: error.message
      };
    }
  }
});

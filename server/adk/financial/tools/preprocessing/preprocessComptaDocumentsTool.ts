import { FunctionTool } from '@google/adk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ToolContext } from '@google/adk';
import { z } from 'zod';
import { zToGen } from '../../../utils/schemaHelper';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Preprocess COMPTA Documents Tool
 *
 * Tool "tout-en-un" qui effectue TOUT le preprocessing des documents COMPTA:
 * 1. Vérifie si des documents préprocessés existent déjà
 * 2. Analyse chaque document COMPTA avec Gemini Vision
 * 3. Crée les PDFs consolidés
 * 4. Sauvegarde dans A_ANALYSER
 * 5. Met à jour state.documents
 *
 * Ce tool est déterministe - pas de risque que le LLM abandonne le workflow.
 */

const PreprocessComptaDocumentsInputSchema = z.object({});

const PreprocessComptaDocumentsOutputSchema = z.object({
  skipped: z.boolean(),
  reason: z.string().optional(),
  existingFiles: z.array(z.string()).optional(),
  originalDocuments: z.array(z.string()).optional(),
  consolidatedDocuments: z.array(z.object({
    filename: z.string(),
    year: z.number(),
    pageCount: z.number(),
    pageTypes: z.array(z.string())
  })).optional(),
  savedTo: z.string().optional(),
  documentsUpdated: z.boolean(),
  error: z.string().optional()
});

const DOCUMENT_STRUCTURE_PROMPT = `Tu es un expert-comptable français. Analyse ce document PDF comptable et identifie TOUTES les pages contenant des informations financières importantes.

OBJECTIF: Identifier les numéros de TOUTES les pages contenant:

1. BILAN ACTIF (tableau ACTIF avec Immobilisations, Actif circulant, Stocks, Créances)
   → Souvent sur 1 page, parfois 2 si le tableau est long
2. BILAN PASSIF (tableau PASSIF avec Capitaux propres, Dettes, Provisions)
   → Souvent sur 1 page, parfois 2
3. COMPTE DE RESULTAT (tableau avec Produits, Charges, Résultat d'exploitation, Résultat net)
   → ATTENTION: Souvent sur 2 PAGES CONSECUTIVES (ex: pages 6 ET 7)
   → La première page contient les PRODUITS, la seconde les CHARGES
   → INCLURE LES DEUX PAGES si le compte de résultat est sur 2 pages
4. SIG - Soldes Intermédiaires de Gestion (Marge commerciale, Valeur ajoutée, EBE)
   → Souvent sur 1 page

IGNORE les pages suivantes:
- Pages de garde, sommaires, attestations
- Annexes textuelles sans tableaux chiffrés
- Pages de détail des immobilisations, amortissements

IMPORTANT:
- Inclure TOUTES les pages de chaque type (ex: si le CR est sur pages 6+7, inclure les deux)
- L'année fiscale est généralement indiquée comme "Exercice clos le DD/MM/YYYY"

REPONSE JSON UNIQUEMENT:
{
  "year": 2021,
  "relevantPages": [
    { "pageNumber": 4, "pageType": "bilan_actif", "confidence": 0.95 },
    { "pageNumber": 5, "pageType": "bilan_passif", "confidence": 0.95 },
    { "pageNumber": 6, "pageType": "compte_resultat", "confidence": 0.90 },
    { "pageNumber": 7, "pageType": "compte_resultat", "confidence": 0.90 },
    { "pageNumber": 8, "pageType": "sig", "confidence": 0.85 }
  ]
}`;

/**
 * Extrait l'année depuis le nom du fichier
 * Ex: "COMPTA bilan 30 novembre 2021.PDF" -> 2021
 *     "COMPTA BILAN 30 NOVEMBRE 2023.PDF" -> 2023
 *     "COMPTA bilan 30.11.2022.PDF" -> 2022
 */
function extractYearFromFilename(filename: string): number | null {
  // Chercher un pattern YYYY (4 chiffres entre 2015 et 2030)
  const yearMatch = filename.match(/20[12][0-9]/);
  if (yearMatch) {
    return parseInt(yearMatch[0]);
  }
  return null;
}

export const preprocessComptaDocumentsTool = new FunctionTool({
  name: 'preprocessComptaDocuments',
  description: 'Effectue TOUT le preprocessing des documents COMPTA en une seule opération: analyse, extraction, consolidation, sauvegarde. Appeler ce tool UNE SEULE FOIS.',
  parameters: zToGen(PreprocessComptaDocumentsInputSchema),

  execute: async (params: {}, toolContext?: ToolContext) => {
    try {
      console.log('\n========================================');
      console.log('📋 PREPROCESSING COMPTA DOCUMENTS');
      console.log('========================================\n');

      // 1. Récupérer le SIREN (9 premiers chiffres du SIRET)
      const businessInfo = toolContext?.state.get('businessInfo') as { siret?: string; siren?: string } | undefined;
      const siret = businessInfo?.siret;
      // Utiliser le SIREN s'il existe, sinon extraire des 9 premiers chiffres du SIRET
      const siren = businessInfo?.siren || (siret ? siret.substring(0, 9) : null);

      if (!siren) {
        return {
          skipped: true,
          reason: 'SIREN/SIRET non disponible dans state.businessInfo',
          documentsUpdated: false
        };
      }

      console.log(`[preprocessing] SIREN: ${siren} (from SIRET: ${siret})`);

      // 2. Vérifier si A_ANALYSER existe déjà (utiliser SIREN pour le dossier)
      const folderPath = path.join(process.cwd(), 'data', 'documents', siren, 'A_ANALYSER');

      try {
        const existingFiles = await fs.readdir(folderPath);
        const pdfFiles = existingFiles.filter(f => f.toLowerCase().endsWith('.pdf'));

        if (pdfFiles.length > 0) {
          console.log(`[preprocessing] ✅ Documents déjà préprocessés: ${pdfFiles.join(', ')}`);

          // Mettre à jour state.documents avec les fichiers existants
          const documents = toolContext?.state.get('documents') as Array<any> | undefined || [];
          const nonComptaDocs = documents.filter(d => !d.filename.toUpperCase().includes('COMPTA'));

          const updatedDocs = [
            ...nonComptaDocs,
            ...pdfFiles.map(f => ({
              filename: f,
              filePath: path.join(folderPath, f),
              year: parseInt(f.match(/\d{4}/)?.[0] || '0')
            }))
          ];

          toolContext?.state.set('documents', updatedDocs);

          return {
            skipped: true,
            reason: 'Documents COMPTA déjà préprocessés dans A_ANALYSER',
            existingFiles: pdfFiles,
            documentsUpdated: true
          };
        }
      } catch {
        // Dossier n'existe pas, continuer avec le preprocessing
        console.log(`[preprocessing] Dossier A_ANALYSER non trouvé, création nécessaire`);
      }

      // 3. Récupérer les documents COMPTA
      const documents = toolContext?.state.get('documents') as Array<{
        filename: string;
        filePath?: string;
        content?: Buffer | string;
      }> | undefined;

      if (!documents || documents.length === 0) {
        return {
          skipped: true,
          reason: 'Aucun document dans state.documents',
          documentsUpdated: false
        };
      }

      const comptaDocs = documents.filter(d => d.filename.toUpperCase().includes('COMPTA'));

      if (comptaDocs.length === 0) {
        return {
          skipped: true,
          reason: 'Aucun document COMPTA trouvé',
          documentsUpdated: false
        };
      }

      console.log(`[preprocessing] ${comptaDocs.length} document(s) COMPTA à traiter:`);
      comptaDocs.forEach(d => console.log(`  - ${d.filename}`));

      // 4. Vérifier GEMINI_API_KEY
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return {
          skipped: true,
          reason: 'GEMINI_API_KEY non configurée',
          documentsUpdated: false,
          error: 'GEMINI_API_KEY missing'
        };
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      // 5. Analyser et consolider chaque document
      const consolidatedDocs: Array<{
        filename: string;
        year: number;
        pageCount: number;
        pageTypes: string[];
        buffer: Buffer;
      }> = [];

      for (const comptaDoc of comptaDocs) {
        console.log(`\n[preprocessing] 📄 Traitement: ${comptaDoc.filename}`);

        // Obtenir le buffer du document
        let docBuffer: Buffer;
        if (comptaDoc.filePath) {
          docBuffer = await fs.readFile(path.resolve(comptaDoc.filePath));
        } else if (comptaDoc.content) {
          if (Buffer.isBuffer(comptaDoc.content)) {
            docBuffer = comptaDoc.content;
          } else {
            docBuffer = Buffer.from(comptaDoc.content, 'base64');
          }
        } else {
          console.error(`[preprocessing] ⚠️ Document sans contenu: ${comptaDoc.filename}`);
          continue;
        }

        // Analyser avec Gemini Vision
        console.log(`[preprocessing] 🔍 Analyse avec Gemini Vision...`);
        let analysisResult;
        try {
          const result = await model.generateContent({
            contents: [{
              role: "user",
              parts: [
                { inlineData: { mimeType: "application/pdf", data: docBuffer.toString('base64') } },
                { text: DOCUMENT_STRUCTURE_PROMPT }
              ]
            }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 2048,
              responseMimeType: "application/json"
            }
          });

          analysisResult = JSON.parse(result.response.text());
          console.log(`[preprocessing] ✅ Année détectée: ${analysisResult.year}`);
          console.log(`[preprocessing] ✅ Pages pertinentes: ${analysisResult.relevantPages?.length || 0}`);
        } catch (err: any) {
          console.error(`[preprocessing] ❌ Erreur analyse Gemini: ${err.message}`);
          continue;
        }

        if (!analysisResult.relevantPages || analysisResult.relevantPages.length === 0) {
          console.log(`[preprocessing] ⚠️ Aucune page pertinente trouvée pour ${comptaDoc.filename}`);
          continue;
        }

        // Déterminer l'année: priorité au nom du fichier, sinon Gemini
        const filenameYear = extractYearFromFilename(comptaDoc.filename);
        const geminiYear = analysisResult.year;
        const year = filenameYear || geminiYear || new Date().getFullYear();

        if (filenameYear && geminiYear && filenameYear !== geminiYear) {
          console.log(`[preprocessing] ⚠️ Année Gemini (${geminiYear}) != Année fichier (${filenameYear}). Utilisation: ${filenameYear}`);
        }

        const outputFilename = `COMPTA${year}.pdf`;
        console.log(`[preprocessing] 📝 Création: ${outputFilename} (année: ${year})`);

        // Vérifier si un fichier avec cette année existe déjà
        const existingDoc = consolidatedDocs.find(d => d.year === year);
        if (existingDoc) {
          console.log(`[preprocessing] ⚠️ COMPTA${year}.pdf existe déjà, ce document sera ignoré`);
          continue;
        }

        try {
          const srcPdf = await PDFDocument.load(docBuffer);
          const newPdf = await PDFDocument.create();

          // Trier les pages par type
          const pageOrder: Record<string, number> = {
            'bilan_actif': 1,
            'bilan_passif': 2,
            'compte_resultat': 3,
            'sig': 4
          };

          const sortedPages = [...analysisResult.relevantPages].sort((a: any, b: any) => {
            return (pageOrder[a.pageType] || 99) - (pageOrder[b.pageType] || 99);
          });

          const pageTypes: string[] = [];

          for (const pageInfo of sortedPages) {
            const pageNum = pageInfo.pageNumber;
            if (pageNum >= 1 && pageNum <= srcPdf.getPageCount()) {
              const [copiedPage] = await newPdf.copyPages(srcPdf, [pageNum - 1]);
              newPdf.addPage(copiedPage);
              pageTypes.push(pageInfo.pageType);
              console.log(`[preprocessing]   + Page ${pageNum} (${pageInfo.pageType})`);
            }
          }

          if (pageTypes.length === 0) {
            console.log(`[preprocessing] ⚠️ Aucune page copiée pour ${comptaDoc.filename}`);
            continue;
          }

          const pdfBytes = await newPdf.save();
          const pdfBuffer = Buffer.from(pdfBytes);

          consolidatedDocs.push({
            filename: outputFilename,
            year,
            pageCount: pageTypes.length,
            pageTypes,
            buffer: pdfBuffer
          });

          console.log(`[preprocessing] ✅ ${outputFilename} créé (${pageTypes.length} pages, ${pdfBuffer.length} bytes)`);

        } catch (err: any) {
          console.error(`[preprocessing] ❌ Erreur création PDF: ${err.message}`);
        }
      }

      if (consolidatedDocs.length === 0) {
        return {
          skipped: true,
          reason: 'Aucun PDF consolidé créé',
          documentsUpdated: false
        };
      }

      // 6. Créer le dossier A_ANALYSER et sauvegarder
      console.log(`\n[preprocessing] 💾 Sauvegarde dans ${folderPath}`);

      await fs.mkdir(folderPath, { recursive: true });

      const savedFiles: string[] = [];
      for (const doc of consolidatedDocs) {
        const filePath = path.join(folderPath, doc.filename);
        await fs.writeFile(filePath, doc.buffer);
        savedFiles.push(doc.filename);
        console.log(`[preprocessing] ✅ Sauvegardé: ${doc.filename}`);
      }

      // 7. Mettre à jour state.documents
      const nonComptaDocs = documents.filter(d => !d.filename.toUpperCase().includes('COMPTA'));
      const updatedDocs = [
        ...nonComptaDocs,
        ...consolidatedDocs.map(d => ({
          filename: d.filename,
          filePath: path.join(folderPath, d.filename),
          year: d.year
        }))
      ];

      toolContext?.state.set('documents', updatedDocs);

      console.log(`\n[preprocessing] ✅ state.documents mis à jour:`);
      updatedDocs.forEach(d => console.log(`  - ${d.filename}`));

      console.log('\n========================================');
      console.log('✅ PREPROCESSING TERMINÉ');
      console.log('========================================\n');

      return {
        skipped: false,
        originalDocuments: comptaDocs.map(d => d.filename),
        consolidatedDocuments: consolidatedDocs.map(d => ({
          filename: d.filename,
          year: d.year,
          pageCount: d.pageCount,
          pageTypes: d.pageTypes
        })),
        savedTo: folderPath,
        documentsUpdated: true
      };

    } catch (error: any) {
      console.error('[preprocessing] ❌ Erreur:', error.message);
      return {
        skipped: true,
        reason: `Erreur: ${error.message}`,
        documentsUpdated: false,
        error: error.message
      };
    }
  }
});

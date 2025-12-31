import { LlmAgent } from '@google/adk';
import {
  extractPdfTool,
  geminiVisionExtractTool,    // NEW - primary extraction method (Vision)
  parseTablesHeuristicTool,   // RENAMED - fallback only
  listDocumentsTool           // NEW - mandatory document listing
} from '../tools/document';
import type { FinancialState } from '../index';

/**
 * DocumentExtractionAgent - Agent d'extraction de documents PDF
 *
 * Premier agent du Pipeline Financier - extrait et structure les documents comptables.
 *
 * Responsabilités:
 * - Extraire le texte des PDF (bilans, liasses fiscales, baux)
 * - Classifier automatiquement le type de document
 * - Parser les tableaux comptables
 * - Structurer les données en JSON
 *
 * Pattern ADK:
 * - Extends LlmAgent
 * - Utilise 3 tools via Gemini function calling
 * - Output automatiquement injecté dans state via outputKey
 */
export class DocumentExtractionAgent extends LlmAgent {
  constructor() {
    // Configuration Gemini - aligner avec MODEL_DEFAULTS
    const modelConfig = {
      name: 'gemini-3-flash-preview',
      temperature: 0.4, // Match MODEL_DEFAULTS from models.ts
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 16384  // Doubled to avoid truncationgemini-3-flash-preview on long documents (33+ pages)
    };

    super({
      name: 'documentExtraction',
      description: 'Extrait et classifie les documents comptables PDF',

      // Modèle Gemini
      model: modelConfig.name,

      // Configuration génération
      generateContentConfig: {
        temperature: modelConfig.temperature,
        topP: modelConfig.topP,
        topK: modelConfig.topK,
        maxOutputTokens: modelConfig.maxOutputTokens
      },

      // Tools disponibles pour l'agent
      tools: [
        listDocumentsTool,           // NEW - MANDATORY first call to get exact filenames
        extractPdfTool,              // Still needed for raw_text fallback
        geminiVisionExtractTool,     // NEW - primary method (Vision API)
        parseTablesHeuristicTool     // RENAMED - fallback only if Vision fails
      ],

      // Instruction système
      instruction: `Tu es un expert-comptable spécialisé dans l'analyse de documents financiers français.

Ton rôle est d'extraire et de structurer les documents comptables PDF reçus.

⚠️ RÈGLE ABSOLUE : Tu DOIS appeler listDocuments() en premier pour connaître les fichiers disponibles.
Ne JAMAIS inventer, deviner ou construire des noms de fichiers !

WORKFLOW OBLIGATOIRE (APPELER LES TOOLS DANS CET ORDRE) :

═══════════════════════════════════════════════════════════════════════════════
ÉTAPE 1 : LISTER LES DOCUMENTS DISPONIBLES (OBLIGATOIRE)
═══════════════════════════════════════════════════════════════════════════════

   listDocuments()

   Retourne: { documents: [{ filename, hasContent, hasFilePath }], count }

   ⚠️ IMPORTANT: Cette étape est OBLIGATOIRE. Tu dois la faire EN PREMIER.
   Elle retourne la liste EXACTE des documents disponibles.

   Exemple de résultat:
   {
     "documents": [
       {
         "filename": "COMPTA BILAN 30 NOVEMBRE 2023.PDF",
         "hasContent": true,
         "hasFilePath": false
       },
       {
         "filename": "1766739611730_COMPTA_BILAN_30_NOVEMBRE_2021.PDF",
         "hasContent": true,
         "hasFilePath": false
       }
     ],
     "count": 2
   }

═══════════════════════════════════════════════════════════════════════════════
ÉTAPE 2 : EXTRAIRE CHAQUE DOCUMENT (utiliser les filenames de l'étape 1)
═══════════════════════════════════════════════════════════════════════════════

Pour CHAQUE document retourné par listDocuments(), appeler:

a) EXTRACTION VISION (MÉTHODE PRINCIPALE)
   geminiVisionExtract({ filename: "EXACT_FILENAME_FROM_STEP_1" })

   ⚠️ CRITIQUE: Utiliser le filename EXACT retourné par listDocuments()
   ⚠️ Ne PAS modifier, tronquer ou réinventer le nom
   ⚠️ Copier-coller exactement le filename de l'étape 1

   Exemple: Si listDocuments() a retourné "COMPTA BILAN 30 NOVEMBRE 2023.PDF"
   → Utiliser exactement: geminiVisionExtract({ filename: "COMPTA BILAN 30 NOVEMBRE 2023.PDF" })

   Retourne: { filename, documentType, year, confidence, extractedData: { tables, key_values }, method }

   → Si confidence >= 0.6 ET tables.length > 0 : UTILISER CE RÉSULTAT ✓
   → Sinon : PASSER AU FALLBACK (étape b)

b) EXTRACTION HEURISTIQUE (FALLBACK si Vision échoue)
   SI geminiVisionExtract a échoué OU confidence < 0.6 :

   extractPdf({ filename: "EXACT_FILENAME_FROM_STEP_1" })
   parseTablesHeuristic({ text: "texte extrait" })

   ⚠️ Toujours utiliser le filename exact de l'étape 1

═══════════════════════════════════════════════════════════════════════════════
ÉTAPE 3 : CONSTRUIRE LE JSON FINAL
═══════════════════════════════════════════════════════════════════════════════

Après avoir traité TOUS les documents, construire le JSON final :

{
  "documents": [
    {
      "filename": "COMPTA BILAN 30 NOVEMBRE 2023.PDF",  // EXACT depuis listDocuments()
      "documentType": "bilan",
      "year": 2023,
      "confidence": 0.95,
      "extractedData": {
        "raw_text": "...",
        "tables": [...],
        "key_values": {...}
      },
      "method": "vision"
    }
  ],
  "summary": {
    "total_documents": 1,
    "years_covered": [2023],
    "missing_documents": [],
    "extraction_methods": {"vision": 1, "heuristic": 0}
  }
}

═══════════════════════════════════════════════════════════════════════════════
RÈGLES CRITIQUES (ÉCHEC SI NON RESPECTÉES)
═══════════════════════════════════════════════════════════════════════════════

1. ⛔ OBLIGATOIRE: Appeler listDocuments() EN PREMIER avant tout
2. ⛔ INTERDIT: Inventer, deviner ou construire des noms de fichiers
3. ⛔ INTERDIT: Modifier les filenames retournés par listDocuments()
4. ✅ REQUIS: Utiliser les filenames EXACTS (copier-coller) de listDocuments()
5. ✅ REQUIS: Traiter TOUS les documents retournés par listDocuments()
6. ✅ REQUIS: Inclure extraction_methods dans summary

EXEMPLES DE NOMS VALIDES (depuis listDocuments):
  ✓ "COMPTA BILAN 30 NOVEMBRE 2023.PDF"
  ✓ "1766739611730_COMPTA_BILAN_30_NOVEMBRE_2021.PDF"
  ✓ "Coût transaction Mme Ardouin (offre).pdf"

EXEMPLES DE NOMS INVALIDES (inventés):
  ✗ "bilan_2023.pdf"
  ✗ "1739373305459_2023_Liasse_Fiscale_NATHALIE_VOLANTE.pdf"
  ✗ "comptabilite.pdf"

GESTION D'ERREURS :
- Si listDocuments() retourne count: 0 :
  {
    "documents": [],
    "summary": {
      "total_documents": 0,
      "years_covered": [],
      "missing_documents": ["Aucun document fourni"]
    }
  }

RETOURNE UNIQUEMENT LE JSON VALIDE (pas de texte avant/après)`,

      // Clé de sortie dans le state
      outputKey: 'documentExtraction' as keyof FinancialState
    });
  }
}

export default DocumentExtractionAgent;

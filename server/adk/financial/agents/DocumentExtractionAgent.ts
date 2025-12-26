import { LlmAgent } from '@google/adk';
import { extractPdfTool, classifyDocumentTool, parseTablesTool } from '../tools/document';
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
    // Configuration Gemini
    const modelConfig = {
      name: 'gemini-3-flash-preview',
      temperature: 0.3,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192
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
      tools: [extractPdfTool, classifyDocumentTool, parseTablesTool],

      // Instruction système
      instruction: `Tu es un expert-comptable spécialisé dans l'analyse de documents financiers français.

Ton rôle est d'extraire et de structurer les documents comptables PDF reçus.

DONNÉES DISPONIBLES :
Les données sont passées via state initial (accessible dans les tools) :
- state.documents[] : Liste des fichiers PDF avec { filename, filePath ou content }
- state.businessInfo : Informations sur l'entreprise { name, siret, nafCode, activity }

IMPORTANT: Les tools lisent automatiquement depuis le state via ToolContext.
Tu dois APPELER LES TOOLS - ne génère PAS le JSON directement.

WORKFLOW OBLIGATOIRE (UTILISE LES TOOLS) :

ÉTAPE 1 : Vérifier qu'il y a des documents à traiter

ÉTAPE 2 : Pour chaque document, APPELER LES TOOLS dans l'ordre :

a) EXTRACTION PDF
   extractPdf({ filename: "nom_du_fichier.pdf" })
   → Retourne { filename, text, pages }

   Le tool lit automatiquement depuis state.documents

b) CLASSIFICATION
   classifyDocument({ filename: "...", text: "texte extrait" })
   → Retourne { documentType, year, confidence, reasoning }

   Types possibles :
   - "bilan" : Bilan comptable (ACTIF/PASSIF)
   - "compte_resultat" : Compte de résultat (PRODUITS/CHARGES)
   - "liasse_fiscale" : Liasse fiscale Cerfa 2050-2059
   - "bail" : Bail commercial 3-6-9
   - "projet_vente" : Projet de cession/vente
   - "autre" : Non identifié

c) EXTRACTION TABLEAUX
   parseTables({ text: "texte extrait", documentType: "bilan" })
   → Retourne { tables: [{ headers, rows }], count }

ÉTAPE 3 : Après avoir appelé les 3 tools pour CHAQUE document, construire le JSON final avec les résultats

FORMAT DE SORTIE JSON (STRICT) :
{
  "documents": [
    {
      "filename": "bilan-2024.pdf",
      "documentType": "bilan",
      "year": 2024,
      "confidence": 0.95,
      "extractedData": {
        "raw_text": "...",
        "tables": [
          {
            "headers": ["ACTIF", "2024", "2023"],
            "rows": [
              ["Immobilisations", "50000", "45000"],
              ["Stocks", "30000", "28000"]
            ],
            "caption": "Bilan Actif"
          }
        ],
        "key_values": {}
      }
    }
  ],
  "summary": {
    "total_documents": 2,
    "years_covered": [2024, 2023],
    "missing_documents": ["compte_resultat_2024"]
  }
}

RÈGLES :
1. Traiter TOUS les documents dans state.documents
2. Si extractPdf échoue, marquer le document avec error dans extractedData
3. Pour summary.missing_documents, analyser les documents trouvés :
   - Si bilan présent mais pas compte_resultat → ajouter "compte_resultat_YYYY"
   - Si uniquement N, suggérer N-1 et N-2
4. Trier years_covered en ordre décroissant

GESTION D'ERREURS :
- Si aucun document dans state.documents :
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

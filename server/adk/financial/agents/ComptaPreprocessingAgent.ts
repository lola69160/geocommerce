import { LlmAgent } from '@google/adk';
import { preprocessComptaDocumentsTool } from '../tools/preprocessing';
import type { FinancialState } from '../index';

/**
 * ComptaPreprocessingAgent - Agent de preprocessing des documents COMPTA
 *
 * Premier agent du Pipeline Financier (avant DocumentExtractionAgent).
 * Analyse les documents COMPTA pour extraire uniquement les pages pertinentes
 * et creer des PDFs consolides par annee.
 *
 * Utilise un SEUL tool qui effectue tout le preprocessing de manière déterministe:
 * 1. Vérifie si des documents préprocessés existent
 * 2. Analyse chaque document COMPTA avec Gemini Vision
 * 3. Crée les PDFs consolidés (Bilan, CR, SIG)
 * 4. Sauvegarde dans data/documents/SIRET/A_ANALYSER/
 * 5. Met à jour state.documents
 */
export class ComptaPreprocessingAgent extends LlmAgent {
  constructor() {
    const modelConfig = {
      name: 'gemini-2.0-flash',
      temperature: 0.1,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 4096
    };

    super({
      name: 'comptaPreprocessing',
      description: 'Pretraite les documents COMPTA en extrayant les pages pertinentes et creant des PDFs consolides par annee',

      model: modelConfig.name,

      generateContentConfig: {
        temperature: modelConfig.temperature,
        topP: modelConfig.topP,
        topK: modelConfig.topK,
        maxOutputTokens: modelConfig.maxOutputTokens
      },

      // UN SEUL tool qui fait tout le travail
      tools: [preprocessComptaDocumentsTool],

      instruction: `Tu es un agent de preprocessing des documents comptables.

TON UNIQUE TÂCHE:
Appeler le tool preprocessComptaDocuments() UNE SEULE FOIS, puis retourner son résultat.

WORKFLOW:
1. Appelle: preprocessComptaDocuments()
2. Retourne le résultat JSON tel quel

Ce tool effectue automatiquement:
- Vérification si des documents préprocessés existent
- Analyse des documents COMPTA avec Gemini Vision
- Création des PDFs consolidés par année
- Sauvegarde dans le dossier A_ANALYSER
- Mise à jour de state.documents

NE FAIS RIEN D'AUTRE. Appelle juste le tool et retourne son résultat.`,

      outputKey: 'comptaPreprocessing' as keyof FinancialState
    });
  }
}

export default ComptaPreprocessingAgent;

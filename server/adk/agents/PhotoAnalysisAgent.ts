import { LlmAgent } from '@google/adk';
import { analyzePhotosTool } from '../tools/photo/analyzePhotosTool.js';
import { getModelConfig } from '../config/models.js';
import { getSystemPrompt } from '../config/prompts.js';
import type { AgentState } from '../types/index.js';

/**
 * PhotoAnalysisAgent - Analyse photos avec Gemini Vision (ADK)
 *
 * Analyse état physique du commerce via photos Google Places
 * et estime budget travaux avec Gemini Vision.
 *
 * Responsabilités:
 * - Récupérer photos depuis Places (max 8)
 * - Compresser images (800x600, JPEG 80%)
 * - Analyser état général (devanture, intérieur, équipement)
 * - Identifier travaux nécessaires (urgents, recommandés, optionnels)
 * - Estimer budget travaux (fourchette basse/haute)
 * - Lister points forts/faibles visuels
 *
 * Modèle: gemini-2.0-flash-exp (Vision)
 */
export class PhotoAnalysisAgent extends LlmAgent {
  constructor() {
    const modelConfig = getModelConfig('photo');

    super({
      name: 'photo',
      description: 'Analyse photos avec Gemini Vision pour évaluer état et coûts travaux',

      // Modèle Gemini Vision
      model: modelConfig.name,

      // Configuration génération JSON forcé via responseMimeType)
      generateContentConfig: {
        temperature: modelConfig.temperature,
        topP: modelConfig.topP,
        topK: modelConfig.topK,
        maxOutputTokens: modelConfig.maxOutputTokens

      },

      // Tools disponibles
      tools: [analyzePhotosTool],

      // Instruction système
      instruction: `${getSystemPrompt('photo')}

Tu dois analyser les photos du commerce avec Gemini Vision.

WORKFLOW:
1. Récupérer les informations nécessaires depuis le state:
   - Photos: state.places.photos (array d'objets avec url)
   - Type de commerce: state.business.activite_principale_libelle OU state.business.enseigne

2. Si photos disponibles (places.photos existe et length > 0):
   - Extraire les URLs: photos.map(p => p.url)
   - Déterminer le type de commerce
   - Appeler analyzePhotos(photoUrls, businessType)

2. Si photos disponibles (state.places.photos existe et length > 0):
   - Vérifier que chaque photo a une propriété 'url'
   - Filtrer photos sans URL: photos.filter(p => p.url)
   - Si aucune photo valide: retourner { analyzed: false, reason: "No photo URLs available" }
   - Sinon: extraire les URLs: validPhotos.map(p => p.url)

3. Si photos non disponibles:
   - Retourner { analyzed: false, reason: "No photos available" }

4. Interpréter le résultat:
   - Si analyzed=true: Inclure toute l'analyse (état, travaux, budget)
   - Si analyzed=false: Inclure la raison

FORMAT DE SORTIE JSON (STRICT):

Si photos analysées:
{
  "analyzed": true,
  "photos_analyzed": number,
  "etat_general": {
    "devanture": "excellent" | "bon" | "moyen" | "mauvais" | "très mauvais",
    "interieur": "excellent" | "bon" | "moyen" | "mauvais" | "très mauvais",
    "equipement": "excellent" | "bon" | "moyen" | "mauvais" | "très mauvais",
    "note_globale": number (0-10)
  },
  "travaux": {
    "urgents": ["string"],
    "recommandes": ["string"],
    "optionnels": ["string"]
  },
  "budget_travaux": {
    "fourchette_basse": number,
    "fourchette_haute": number,
    "detail_postes": [
      {
        "categorie": "string",
        "montant_min": number,
        "montant_max": number,
        "priorite": "urgente" | "recommandée" | "optionnelle"
      }
    ]
  },
  "points_forts": ["string"],
  "points_faibles": ["string"],
  "analyse_detaillee": "string"
}

Si pas de photos:
{
  "analyzed": false,
  "reason": "string (explication)"
}

IMPORTANT:
- Limite max 8 photos pour optimiser tokens
- Compression automatique (800x600, JPEG 80%)
- Analyse experte basée sur 20 ans d'expérience aménagement
- Estimations prix marché français 2024
- Retourne UNIQUEMENT le JSON valide`,

      // Clé de sortie dans le state
      outputKey: 'photo' as keyof AgentState
    });
  }
}

export default PhotoAnalysisAgent;

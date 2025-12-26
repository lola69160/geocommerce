import { LlmAgent } from '@google/adk';
import { searchPlacesTool, fetchAssetsTool } from '../tools/places';
import { getModelConfig } from '../config/models';
import { getSystemPrompt } from '../config/prompts';
import type { AgentState } from '../types';

/**
 * PlacesAgent - Enrichissement Google Places (ADK)
 *
 * Recherche et enrichit les données du commerce via Google Places API
 * avec système de scoring multi-résultats pour éviter faux positifs.
 *
 * Responsabilités:
 * - Rechercher commerce dans Google Places (scoring multi-résultats)
 * - Récupérer photos (max 8), avis (max 5), notes
 * - Extraire horaires d'ouverture
 * - Évaluer réputation (rating, nombre d'avis)
 *
 * Scoring multi-résultats (seuil 80%):
 * - Numéro rue: 40 points
 * - Code postal: 30 points
 * - Distance GPS: 20 points
 * - Nom rue: 10 points
 */
export class PlacesAgent extends LlmAgent {
  constructor() {
    const modelConfig = getModelConfig('places');

    super({
      name: 'places',
      description: 'Enrichissement Google Places avec photos, avis, horaires',

      // Modèle Gemini
      model: modelConfig.name,

      // Configuration génération JSON forcé via responseMimeType)
      generateContentConfig: {
        temperature: modelConfig.temperature,
        topP: modelConfig.topP,
        topK: modelConfig.topK,
        maxOutputTokens: modelConfig.maxOutputTokens

      },

      // Tools disponibles
      tools: [searchPlacesTool, fetchAssetsTool],

      // Instruction système
      instruction: `${getSystemPrompt('places')}

Tu dois enrichir le commerce avec Google Places.

WORKFLOW:
1. Construire le nom du commerce:
   - Priorité: business.enseigne OU business.nom_complet OU business.nom_raison_sociale
   - Adresse: preparation.normalizedAddress.full
   - Coordonnées: preparation.coordinates (pour scoring GPS)
   - Code NAF: business.activite_principale OU business.code_naf (pour scoring type)

2. Rechercher avec searchPlaces() - SCORING MULTI-DIMENSIONNEL
   - Lit automatiquement depuis state: business, preparation
   - Scoring 0-150 points (adresse:100 + identité:50)
     * Adresse (100pts): numéro rue (40) + code postal (30) + GPS (20) + nom rue (10)
     * Identité (50pts): nom commercial (30) + type NAF (20)
   - Seuil adaptatif: 90/150 avec NAF, 85/150 sans NAF
   - Tie-breaking: identité > reviews > rating > premier résultat
   - Détection ambiguïté: found=false si scores similaires ET <5 avis
   - searchPlaces retourne: { found, placeId, matchScore, nameMatchDetails, typeMatchDetails, isAmbiguous, ... }

3. ⚠️ OBLIGATOIRE si found=true:
   Tu DOIS IMMÉDIATEMENT appeler fetchAssets(placeId) après searchPlaces
   - fetchAssets est la SEULE source de photos avec URLs complètes
   - searchPlaces retourne seulement des références photos incomplètes
   - Sans fetchAssets, PhotoAnalysisAgent échouera

4. Construire l'output final en combinant:
   - searchPlaces: { found, placeId, name, location, matchScore }
   - fetchAssets: { photos: [{ url, ... }], reviews, rating }

   ⚠️ UTILISER photos/reviews de fetchAssets, PAS de searchPlaces

5. Filtrer avis pertinents (>50 caractères, rating visible)

FORMAT DE SORTIE JSON (STRICT):
Si found=true:
{
  "found": true,
  "placeId": "string",
  "name": "string",
  "rating": number ou null,
  "userRatingsTotal": number,
  "priceLevel": number ou null,
  "businessStatus": "string",
  "location": {
    "lat": number,
    "lon": number
  },
  "formattedAddress": "string",
  "reviews": [
    {
      "author": "string",
      "rating": number,
      "text": "string",
      "time": "string",
      "relativeTime": "string"
    }
  ],
  "photos": [
    {
      "name": "string",
      "widthPx": number,
      "heightPx": number,
      "url": "string"
    }
  ],
  "openingHours": {
    "openNow": boolean ou null,
    "weekdayDescriptions": ["string"]
  },
  "types": ["string"],
  "matchScore": number (0-100),
  "matchDetails": {
    "streetNumberMatch": number,
    "zipCodeMatch": number,
    "distanceScore": number,
    "streetNameScore": number
  }
}

Si found=false:
{
  "found": false,
  "reason": "string (explication)"
}

STRATÉGIE FALLBACK:
- Si searchPlaces échoue avec nom complet, réessayer avec juste l'adresse
- Si plusieurs tentatives échouent, retourner found=false avec raison

IMPORTANT:
- Privilégie PRÉCISION sur quantité (seuil 80% strict)
- Filtre avis vides ou trop courts
- Limite photos à 8 max pour analyse
- Retourne UNIQUEMENT le JSON valide`,

      // Clé de sortie dans le state
      outputKey: 'places' as keyof AgentState
    });
  }
}

export default PlacesAgent;

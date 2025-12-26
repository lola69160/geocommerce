import { LlmAgent } from '@google/adk';
import { normalizeAddressTool, extractCoordinatesTool } from '../tools/preparation';
import { getModelConfig } from '../config/models';
import { getSystemPrompt } from '../config/prompts';
import type { AgentState } from '../types';

/**
 * PreparationAgent - Agent de préparation et normalisation (ADK)
 *
 * Premier agent du pipeline - initialise et normalise les données d'entrée.
 *
 * Responsabilités:
 * - Normaliser l'adresse pour améliorer matching
 * - Extraire informations clés (coordinates, code postal, commune)
 * - Initialiser paramètres recherche (rayon, etc.)
 * - Préparer cache keys pour éviter duplications
 *
 * Pattern ADK:
 * - Extends LlmAgent
 * - Utilise tools via Gemini function calling
 * - Output automatiquement injecté dans state via outputKey
 * - Schema Zod pour validation stricte
 */
export class PreparationAgent extends LlmAgent {
  constructor() {
    const modelConfig = getModelConfig('preparation');

    super({
      name: 'preparation',
      description: 'Normalise les données business et extrait informations géographiques',

      // Modèle Gemini
      model: modelConfig.name,

      // Configuration génération (JSON demandé via instruction système)
      generateContentConfig: {
        temperature: modelConfig.temperature,
        topP: modelConfig.topP,
        topK: modelConfig.topK,
        maxOutputTokens: modelConfig.maxOutputTokens
      },

      // Tools disponibles pour l'agent
      tools: [normalizeAddressTool, extractCoordinatesTool],

      // Instruction système (SIMPLIFIÉ - tools accèdent au state via ToolContext)
      instruction: `${getSystemPrompt('preparation')}

Tu es responsable de la normalisation des données business et de l'extraction des informations géographiques.

Les données business sont disponibles dans state.business (les tools y accèdent automatiquement via ToolContext).

WORKFLOW:

1. Appeler normalizeAddress() - normalise business.siege en adresse structurée
2. Appeler extractCoordinates() - extrait coordonnées GPS depuis business
3. Générer le JSON de sortie avec les résultats des tools

FORMAT DE SORTIE JSON (STRICT):
{
  "businessId": "business.siret ou business.siren",
  "normalizedAddress": {
    "full": "depuis normalizeAddress",
    "street": "depuis normalizeAddress",
    "zipCode": "depuis normalizeAddress",
    "city": "depuis normalizeAddress"
  },
  "coordinates": {
    "lat": number,
    "lon": number
  } ou null (depuis extractCoordinates),
  "commune": {
    "nom": "business.siege.libelle_commune",
    "codePostal": "business.siege.code_postal",
    "codeInsee": "business.siege.code_commune"
  },
  "searchParams": {
    "radius": 1000,
    "poiRadius": 500,
    "maxCompetitors": 20,
    "maxPhotos": 8
  },
  "cacheKey": "professional_[siren]_[zipCode]",
  "timestamp": "ISO datetime now",
  "googlePlaceId": "business.siege.googlePlaceId" (ou null si absent)
}

RÈGLES:
1. Appeler les tools dans l'ordre: normalizeAddress() puis extractCoordinates()
2. IMPORTANT: Stocker le résultat de normalizeAddress() pour réutiliser googlePlaceId
3. Le champ googlePlaceId vient de normalizeAddress().googlePlaceId (pas directement de business)
4. Les tools lisent automatiquement depuis state - juste passer les valeurs calculées
5. Construire l'objet commune depuis business.siege:
   "commune": {
     "nom": business.siege.libelle_commune,
     "codePostal": business.siege.code_postal,
     "codeInsee": business.siege.code_commune
   }

EXEMPLE:
const addressResult = normalizeAddress();  // Retourne { full, street, zipCode, city, googlePlaceId }
const coords = extractCoordinates();
// Puis dans JSON final:
"googlePlaceId": addressResult.googlePlaceId,
"commune": {
  "nom": business.siege.libelle_commune,
  "codePostal": business.siege.code_postal,
  "codeInsee": business.siege.code_commune
}

6. VALIDATION OBLIGATOIRE:
   Si extractCoordinates() retourne null:
   - ARRÊTER immédiatement le pipeline
   - Retourner erreur explicite: {
       "error": true,
       "reason": "GPS_COORDINATES_MISSING",
       "message": "Business has no GPS coordinates in any source (lat/lon, latitude/longitude, siege, matching_etablissements)",
       "siret": business.siret
     }

   Les coordonnées GPS sont OBLIGATOIRES pour:
   - PlacesAgent (scoring distance)
   - CompetitorAgent (nearby POI search)
   - ValidationAgent (geographic validation)

7. Retourner UNIQUEMENT le JSON valide`,

      // Clé de sortie dans le state
      outputKey: 'preparation' as keyof AgentState
    });
  }
}

export default PreparationAgent;

import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../utils/schemaHelper.js';
import type { BusinessInput, PlacesOutput } from '../../schemas';
import { GoogleGenerativeAI } from '@google/generative-ai';
import sharp from 'sharp';
import axios from 'axios';

/**
 * Analyze Photos Tool
 *
 * Analyse photos avec Gemini Vision pour estimer état physique et coûts travaux.
 * Lit photos depuis state.places et businessType depuis state.business via ToolContext.
 * - Télécharge et compresse photos (800x600, JPEG 80%)
 * - Analyse multi-images avec Gemini Vision
 * - Structured output pour cohérence données
 */

const AnalyzePhotosInputSchema = z.object({
  // Aucun paramètre - lit places.photos et business.activite_principale_libelle depuis state
});

/**
 * Télécharge et compresse une photo
 */
async function compressPhoto(url: string): Promise<string | null> {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    const compressed = await sharp(Buffer.from(response.data))
      .resize(800, 600, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    return compressed.toString('base64');

  } catch (error: any) {
    console.error('Photo compression failed:', error.message);
    return null;
  }
}

export const analyzePhotosTool = new FunctionTool({
  name: 'analyzePhotos',
  description: 'Analyse photos avec Gemini Vision. Lit photos depuis state.places et businessType depuis state.business. Télécharge max 8 photos, les compresse, puis analyse état général, travaux nécessaires, et estime budget.',
  parameters: zToGen(AnalyzePhotosInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    // Lire places et business depuis state
    let places = toolContext?.state.get('places') as PlacesOutput | undefined | string;
    const business = toolContext?.state.get('business') as BusinessInput | undefined;

    // Parser JSON string si nécessaire (ADK peut stocker en string)
    if (typeof places === 'string') {
      try {
        places = JSON.parse(places) as PlacesOutput;
      } catch (e) {
        return {
          analyzed: false,
          reason: 'Failed to parse places state (invalid JSON)'
        };
      }
    }

    if (!places?.photos || places.photos.length === 0) {
      return {
        analyzed: false,
        reason: 'No photos found in state.places'
      };
    }

    // Filtrer et valider les URLs de photos
    const photoUrls = (places.photos || [])
      .filter((p: any) => p && p.url && typeof p.url === 'string')
      .map((p: any) => p.url);

    if (!photoUrls || photoUrls.length === 0) {
      console.warn('[analyzePhotos] No valid photo URLs found in places.photos');
      return {
        analyzed: false,
        reason: 'No photo URLs available',
        photos_count: 0,
        suggestions: 'Ensure PlacesAgent calls fetchAssets() after searchPlaces()'
      };
    }

    const businessType = business?.activite_principale_libelle || business?.libelle_activite_principale || 'Commerce';

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      return {
        analyzed: false,
        reason: 'GEMINI_API_KEY not configured'
      };
    }

    // Suppression du check redondant - déjà vérifié ci-dessus
    if (false) {
      return {
        analyzed: false,
        reason: 'No photo URLs found'
      };
    }

    try {
      // Étape 1: Sélectionner et compresser photos (max 8)
      const selectedPhotos = photoUrls.slice(0, 8);

      const compressedImages = await Promise.all(
        selectedPhotos.map(url => compressPhoto(url))
      );

      // Filtrer échecs
      const validImages = compressedImages.filter(img => img !== null) as string[];

      if (validImages.length === 0) {
        return {
          analyzed: false,
          reason: 'All photos failed to load'
        };
      }

      // Étape 2: Analyser avec Gemini Vision
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite"
      });

      const prompt = `Tu es un expert en aménagement de commerces avec 20 ans d'expérience.
Analyse ces photos d'un ${businessType} pour évaluer son état et estimer les travaux nécessaires.

## TÂCHES

1. **ÉTAT GÉNÉRAL** (note sur 10)
   - Devanture (vitrine, enseigne, éclairage)
   - Intérieur (sols, murs, plafond, éclairage)
   - Équipement et mobilier

2. **TRAVAUX À PRÉVOIR**
   - Urgents: Nécessaires pour sécurité/conformité
   - Recommandés: Amélioreraient attractivité/modernité
   - Optionnels: Optimisations possibles

3. **ESTIMATION BUDGET TRAVAUX**
   - Fourchette basse/haute en euros
   - Détail par poste (peinture, vitrine, sol, équipement, etc.)
   - Justification des montants

4. **ANALYSE VISUELLE**
   - 3 points forts visuels
   - 3 points faibles à améliorer

Sois **précis et factuel**. Base tes estimations sur les prix du marché français 2024.`;

      // Préparer images pour Gemini
      const imageParts = validImages.map(base64 => ({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64
        }
      }));

      // Appeler Gemini avec structured output
      const result = await model.generateContent({
        contents: [{
          role: "user",
          parts: [...imageParts, { text: prompt }]
        }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              etat_general: {
                type: "object",
                properties: {
                  devanture: {
                    type: "string",
                    enum: ["excellent", "bon", "moyen", "mauvais", "très mauvais"]
                  },
                  interieur: {
                    type: "string",
                    enum: ["excellent", "bon", "moyen", "mauvais", "très mauvais"]
                  },
                  equipement: {
                    type: "string",
                    enum: ["excellent", "bon", "moyen", "mauvais", "très mauvais"]
                  },
                  note_globale: {
                    type: "number",
                    minimum: 0,
                    maximum: 10
                  }
                },
                required: ["devanture", "interieur", "equipement", "note_globale"]
              },
              travaux: {
                type: "object",
                properties: {
                  urgents: {
                    type: "array",
                    items: { type: "string" }
                  },
                  recommandes: {
                    type: "array",
                    items: { type: "string" }
                  },
                  optionnels: {
                    type: "array",
                    items: { type: "string" }
                  }
                },
                required: ["urgents", "recommandes", "optionnels"]
              },
              budget_travaux: {
                type: "object",
                properties: {
                  fourchette_basse: {
                    type: "number",
                    minimum: 0
                  },
                  fourchette_haute: {
                    type: "number",
                    minimum: 0
                  },
                  detail_postes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        categorie: { type: "string" },
                        montant_min: { type: "number" },
                        montant_max: { type: "number" },
                        priorite: {
                          type: "string",
                          enum: ["urgente", "recommandée", "optionnelle"]
                        }
                      },
                      required: ["categorie", "montant_min", "montant_max", "priorite"]
                    }
                  }
                },
                required: ["fourchette_basse", "fourchette_haute", "detail_postes"]
              },
              points_forts: {
                type: "array",
                items: { type: "string" },
                minItems: 1,
                maxItems: 3
              },
              points_faibles: {
                type: "array",
                items: { type: "string" },
                minItems: 1,
                maxItems: 3
              },
              analyse_detaillee: {
                type: "string"
              }
            },
            required: [
              "etat_general",
              "travaux",
              "budget_travaux",
              "points_forts",
              "points_faibles"
            ]
          }
        }
      } as any);

      // Parser résultat
      const responseText = result.response.text();
      const analysis = JSON.parse(responseText);

      return {
        analyzed: true,
        photos_analyzed: validImages.length,
        ...analysis
      };

    } catch (error: any) {
      console.error('Photo analysis failed:', error.message);
      return {
        analyzed: false,
        error: true,
        message: error.message
      };
    }
  }
});

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

      const prompt = `Tu es un expert en agencement commercial avec 20 ans d'expérience retail.
Analyse ces photos d'un ${businessType}.

## ⚠️⚠️⚠️ RÈGLES ANTI-HALLUCINATION CRITIQUES ⚠️⚠️⚠️

AVANT de décrire quoi que ce soit, tu DOIS classifier CHAQUE photo:
1. **facade**: Vue extérieure UNIQUEMENT (devanture, enseigne, vitrine, rue)
2. **interieur**: Vue intérieure UNIQUEMENT (rayons, caisse, tables, stock)
3. **detail**: Gros plan produit/équipement
4. **non_classifiable**: Floue, sombre, angle indéterminé

RÈGLES STRICTES:
✅ TU PEUX décrire l'intérieur SI ET SEULEMENT SI ≥1 photo est classée "interieur"
✅ TU PEUX décrire la façade SI ET SEULEMENT SI ≥1 photo est classée "facade"
❌ SI 0 photo "interieur" → NE PAS mentionner "agencement", "rayons", "caisse", "présentation"
❌ SI 0 photo "facade" → NE PAS mentionner "devanture", "vitrine", "enseigne"
❌ SI 0 photo "interieur" → etat_general.propre/lumineux/range DOIVENT être null
❌ SI 0 photo "interieur" → travaux.urgents/recommandes DOIVENT être [] (vide)

VALIDATION FINALE:
Compte combien de photos "facade" et "interieur" tu as classées.
Si 0 interieur → Supprime TOUTE mention intérieure de ton JSON.
Si 0 facade → Supprime TOUTE mention extérieure de ton JSON.

## ✅ NOUVEAU: VALIDATION COMMERCE VISIBLE (PHOTOS FAÇADE UNIQUEMENT)

Pour chaque photo classée "facade", tu DOIS déterminer si le COMMERCE CIBLE est réellement visible:

**commerce_visible: true** SI ET SEULEMENT SI:
- ✅ Enseigne du commerce visible (nom, logo)
- ✅ Vitrine claire avec produits/services visibles
- ✅ Devanture identifiable (porte d'entrée, façade commerciale)
- ✅ Indicateurs visuels du type d'activité

**commerce_visible: false** SI:
- ❌ Vue générique de rue (bâtiments sans détails commerciaux)
- ❌ Photo prise de loin (impossible de distinguer le commerce)
- ❌ Angle de vue partiel (rue visible mais pas devanture)
- ❌ Photo floue/sombre rendant identification impossible
- ❌ Commerce visible MAIS ce n'est PAS le commerce cible

**visibility_details**: Justifie ta décision en 1 phrase.

EXEMPLE:
{
  "index": 0,
  "type": "facade",
  "commerce_visible": true,
  "visibility_details": "Enseigne 'Boulangerie Dupont' + vitrine avec pains visible"
}

## TÂCHE 1: CLASSIFIER CHAQUE PHOTO (index 0-${validImages.length - 1})

Retourne dans "photo_classifications": [
  {
    "index": 0,
    "type": "facade",
    "commerce_visible": true,
    "visibility_details": "Enseigne claire + vitrine visible"
  },
  {
    "index": 1,
    "type": "interieur"
    // commerce_visible non requis pour type != facade
  },
  ...
]

## TÂCHE 2: ÉTAT GÉNÉRAL (CRITÈRES BOOLÉENS UNIQUEMENT)

- etat_general.propre: true/false (SI photos intérieures existent)
- etat_general.lumineux: true/false (SI photos intérieures existent)
- etat_general.range: true/false (SI photos intérieures existent)
- etat_general.devanture: "excellent"/"bon"/"moyen"/"mauvais" (SI photos façade existent)
- etat_general.interieur: "excellent"/"bon"/"moyen"/"mauvais" (SI photos intérieures existent)

## TÂCHE 3: TRAVAUX FAÇADE (>2000€ STRICT)

✅ INCLURE: Devanture complète (5000-15000€), Vitrine (3000-8000€), Ravalement (4000-12000€), Enseigne lumineuse (2500-6000€)
❌ EXCLURE: Peinture simple (<1500€), Nettoyage (<800€), Réparations mineures (<1000€)

Si aucun >2000€ → laisser "urgents" et "recommandes" VIDES []

## TÂCHE 4: TRAVAUX INTÉRIEUR (>1000€ pour nettoyage)

✅ INCLURE: Nettoyage professionnel (>1500€), Remplacement mobilier, Agencement
❌ EXCLURE: Nettoyage simple (<1000€), Petit rangement, Réparations esthétiques mineures

Catégories: Urgents (hygiène/sécurité), Recommandés (expérience client), Optionnels

## TÂCHE 5: BUDGET ET ANALYSE

- Estimation coûts réalistes (marché français 2024)
- 3 points forts commerciaux maximum
- 3 points faibles maximum
- Analyse détaillée (2-3 phrases UNIQUEMENT sur zones visibles sur photos)`;

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
              // ✅ NOUVEAU: Classification des photos
              photo_classifications: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    index: {
                      type: "number",
                      description: "Index de la photo (0-7)"
                    },
                    type: {
                      type: "string",
                      enum: ["facade", "interieur", "detail", "non_classifiable"],
                      description: "Type de photo identifié"
                    },
                    // ✅ NOUVEAU (2026-01-09): Validation commerce visible
                    commerce_visible: {
                      type: "boolean",
                      description: "Si type=facade, le commerce est-il visible ?"
                    },
                    visibility_details: {
                      type: "string",
                      description: "Justification de commerce_visible (1 phrase)"
                    }
                  },
                  required: ["index", "type"]
                },
                minItems: 1,
                description: "Classification de chaque photo analysée"
              },

              facade_visible: {
                type: "boolean",
                description: "Au moins une photo de façade a-t-elle été trouvée ?"
              },

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
                  },

                  // ✅ NOUVEAU: 3 critères simples (boolean)
                  propre: {
                    type: "boolean",
                    description: "L'intérieur est-il propre ?"
                  },
                  lumineux: {
                    type: "boolean",
                    description: "L'intérieur est-il bien éclairé ?"
                  },
                  range: {
                    type: "boolean",
                    description: "L'intérieur est-il bien rangé/organisé ?"
                  }

                  // ❌ ANCIENS CRITÈRES COMPLEXES SUPPRIMÉS (optionnels dans schema pour rétrocompatibilité)
                },
                required: ["devanture", "interieur", "equipement", "note_globale", "propre", "lumineux", "range"]
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
              "photo_classifications",
              "facade_visible",
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

      // ✅ FIX: Anti-hallucination validation
      const classifications = analysis.photo_classifications || [];
      const hasInterior = classifications.some((c: any) => c.type === 'interieur');
      const hasFacade = classifications.some((c: any) => c.type === 'facade');

      console.log(`[analyzePhotos] Classifications: ${hasInterior ? '✓ Interior' : '✗ Interior'} ${hasFacade ? '✓ Facade' : '✗ Facade'}`);

      // ❌ NO interior photos → Remove interior descriptions
      if (!hasInterior) {
        console.warn('[analyzePhotos] ⚠️ No interior photos - removing interior descriptions');

        if (analysis.etat_general) {
          analysis.etat_general.interieur = 'Non visible sur les photos';
          analysis.etat_general.propre = null;
          analysis.etat_general.lumineux = null;
          analysis.etat_general.range = null;
        }

        // Filter interior work recommendations
        const interiorKeywords = ['intérieur', 'agencement', 'rayon', 'caisse', 'présentoir', 'stock'];
        if (analysis.travaux) {
          analysis.travaux.urgents = (analysis.travaux.urgents || []).filter((t: string) =>
            !interiorKeywords.some(kw => t.toLowerCase().includes(kw))
          );
          analysis.travaux.recommandes = (analysis.travaux.recommandes || []).filter((t: string) =>
            !interiorKeywords.some(kw => t.toLowerCase().includes(kw))
          );
        }

        // Clean analyse_detaillee
        if (analysis.analyse_detaillee) {
          const sentences = analysis.analyse_detaillee.split('.').filter((s: string) => {
            return !interiorKeywords.some(kw => s.toLowerCase().includes(kw));
          });
          analysis.analyse_detaillee = sentences.join('.') + '. L\'intérieur du commerce n\'est pas visible sur les photos fournies.';
        }
      }

      // ❌ NO facade photos → Remove facade descriptions
      if (!hasFacade) {
        console.warn('[analyzePhotos] ⚠️ No facade photos - removing facade descriptions');

        if (analysis.etat_general) {
          analysis.etat_general.devanture = 'Non visible sur les photos';
        }

        // Filter facade work recommendations
        const facadeKeywords = ['devanture', 'façade', 'vitrine', 'enseigne', 'store'];
        if (analysis.travaux) {
          analysis.travaux.urgents = (analysis.travaux.urgents || []).filter((t: string) =>
            !facadeKeywords.some(kw => t.toLowerCase().includes(kw))
          );
          analysis.travaux.recommandes = (analysis.travaux.recommandes || []).filter((t: string) =>
            !facadeKeywords.some(kw => t.toLowerCase().includes(kw))
          );
        }
      }

      // Set visibility flags for HTML display
      analysis.facade_visible = hasFacade;
      analysis.interior_visible = hasInterior;

      // ✅ EXISTING: Filtrer travaux façade par montant (>2000€)
      if (analysis.travaux?.urgents) {
        analysis.travaux.urgents = analysis.travaux.urgents.filter((travail: string) => {
          const description = travail.toLowerCase();

          // Si montant mentionné, vérifier >2000€
          const montantMatch = description.match(/(\d+)\s*(?:€|euros?)/);
          if (montantMatch) {
            const montant = parseInt(montantMatch[1]);
            if (montant < 2000) {
              console.log(`[analyzePhotos] Filtered out façade work <2000€: ${travail}`);
              return false;
            }
            return true;
          }

          // Si pas de montant mais mots-clés de travaux majeurs → garder
          const majorKeywords = ['devanture', 'vitrine', 'ravalement', 'menuiserie', 'enseigne lumineuse', 'rénovation'];
          const hasMajorKeyword = majorKeywords.some(kw => description.includes(kw));

          // Si pas de montant mais mots-clés mineurs → rejeter
          const minorKeywords = ['peinture', 'nettoyage', 'réparation mineure', 'rafraîchir'];
          const hasMinorKeyword = minorKeywords.some(kw => description.includes(kw));

          if (hasMinorKeyword && !hasMajorKeyword) {
            console.log(`[analyzePhotos] Filtered out minor façade work: ${travail}`);
            return false;
          }

          return hasMajorKeyword;
        });
      }

      if (analysis.travaux?.recommandes) {
        analysis.travaux.recommandes = analysis.travaux.recommandes.filter((travail: string) => {
          const description = travail.toLowerCase();

          const montantMatch = description.match(/(\d+)\s*(?:€|euros?)/);
          if (montantMatch) {
            const montant = parseInt(montantMatch[1]);
            if (montant < 2000) {
              console.log(`[analyzePhotos] Filtered out façade work <2000€: ${travail}`);
              return false;
            }
            return true;
          }

          const majorKeywords = ['devanture', 'vitrine', 'ravalement', 'menuiserie', 'enseigne lumineuse', 'rénovation'];
          const hasMajorKeyword = majorKeywords.some(kw => description.includes(kw));

          const minorKeywords = ['peinture', 'nettoyage', 'réparation mineure', 'rafraîchir'];
          const hasMinorKeyword = minorKeywords.some(kw => description.includes(kw));

          if (hasMinorKeyword && !hasMajorKeyword) {
            console.log(`[analyzePhotos] Filtered out minor façade work: ${travail}`);
            return false;
          }

          return hasMajorKeyword;
        });
      }

      // ✅ NOUVEAU : Filtrer travaux intérieur par montant (>1000€ pour nettoyage)
      const filterInteriorCleaning = (travaux: string[]) => {
        return travaux.filter((travail: string) => {
          const description = travail.toLowerCase();

          // Détection nettoyage
          const isCleaningWork = description.includes('nettoyage') ||
                                 description.includes('nettoyer') ||
                                 description.includes('propreté');

          if (!isCleaningWork) return true; // Garder tous travaux non-nettoyage

          // Extraction montant
          const montantMatch = description.match(/(\d+)\s*(?:€|euros?)/);
          if (montantMatch) {
            const montant = parseInt(montantMatch[1]);
            if (montant < 1000) {
              console.log(`[analyzePhotos] Filtered out minor cleaning <1000€: ${travail}`);
              return false;
            }
            return true;
          }

          // Mots-clés majeurs vs mineurs
          const majorKeywords = ['profond', 'approfondi', 'complet', 'grande ampleur'];
          const hasMajorKeyword = majorKeywords.some(kw => description.includes(kw));

          const minorKeywords = ['simple', 'léger', 'entretien', 'courant'];
          const hasMinorKeyword = minorKeywords.some(kw => description.includes(kw));

          if (hasMinorKeyword && !hasMajorKeyword) {
            console.log(`[analyzePhotos] Filtered out minor cleaning: ${travail}`);
            return false;
          }

          return hasMajorKeyword;
        });
      };

      // Appliquer le filtre nettoyage à toutes les catégories
      if (analysis.travaux?.urgents) {
        analysis.travaux.urgents = filterInteriorCleaning(analysis.travaux.urgents);
      }
      if (analysis.travaux?.recommandes) {
        analysis.travaux.recommandes = filterInteriorCleaning(analysis.travaux.recommandes);
      }
      if (analysis.travaux?.optionnels) {
        analysis.travaux.optionnels = filterInteriorCleaning(analysis.travaux.optionnels);
      }

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

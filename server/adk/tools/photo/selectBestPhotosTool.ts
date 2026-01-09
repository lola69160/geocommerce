import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../utils/schemaHelper.js';
import type { PhotoAnalysisOutput } from '../../schemas/photoSchema.js';
import type { PlacesOutput } from '../../schemas/index.js';

/**
 * Select Best Photos Tool
 *
 * Sélectionne intelligemment 2 photos parmi les 5 récupérées pour le rapport final:
 * - Image 1 (Intérieur): Meilleure luminosité + rangement
 * - Image 2 (Extérieur): Meilleure visibilité commerce (façade)
 *
 * Lit depuis state:
 * - state.photo.photo_classifications: Classifications des photos (facade, interieur, detail, non_classifiable)
 * - state.photo.etat_general: Critères booléens (lumineux, range, propre)
 * - state.places.photos: URLs des photos
 */

const SelectBestPhotosInputSchema = z.object({});

export const selectBestPhotosTool = new FunctionTool({
  name: 'selectBestPhotos',
  description: 'Sélectionne les 2 meilleures photos parmi les 5 analysées (1 intérieur + 1 façade) pour le rapport final. Retourne { selectedPhotos: [{ index, type, url, reason, score }] }',
  parameters: zToGen(SelectBestPhotosInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    // Lire photo analysis et places depuis state
    let photo = toolContext?.state.get('photo') as PhotoAnalysisOutput | undefined | string;
    let places = toolContext?.state.get('places') as PlacesOutput | undefined | string;

    // Parser JSON string si nécessaire (ADK peut stocker en string)
    if (typeof photo === 'string') {
      try {
        photo = JSON.parse(photo) as PhotoAnalysisOutput;
      } catch (e) {
        return {
          selectedPhotos: [],
          error: 'Failed to parse photo state (invalid JSON)'
        };
      }
    }

    if (typeof places === 'string') {
      try {
        places = JSON.parse(places) as PlacesOutput;
      } catch (e) {
        return {
          selectedPhotos: [],
          error: 'Failed to parse places state (invalid JSON)'
        };
      }
    }

    // Vérifications
    if (!photo?.photo_classifications || !places?.photos) {
      return {
        selectedPhotos: [],
        error: 'Missing photo_classifications or places.photos in state'
      };
    }

    const classifications = photo.photo_classifications;
    const photos = places.photos;
    const etatGeneral = photo.etat_general;

    // ÉTAPE 1: Sélection Image Intérieur (meilleur score luminosité + rangement)
    const interiorPhotos = classifications.filter(c => c.type === 'interieur');
    let bestInterior: any = null;

    if (interiorPhotos.length > 0) {
      // Scorer chaque photo intérieur
      const scoredInterior = interiorPhotos.map(classification => {
        // Score basé sur les critères booléens de l'état général
        // Note: lumineux et range s'appliquent globalement au commerce
        const luminosityScore = etatGeneral?.lumineux ? 5 : 0;
        const tidinessScore = etatGeneral?.range ? 5 : 0;
        const cleanlinessBonus = etatGeneral?.propre ? 2 : 0;

        const totalScore = luminosityScore + tidinessScore + cleanlinessBonus;

        return {
          index: classification.index,
          type: 'interieur' as const,
          score: totalScore,
          reason: generateInteriorReason(etatGeneral)
        };
      });

      // Trier par score décroissant et prendre le premier
      scoredInterior.sort((a, b) => b.score - a.score);
      bestInterior = scoredInterior[0];

      // Ajouter URL de la photo
      if (photos[bestInterior.index]) {
        bestInterior.url = photos[bestInterior.index].url;
      }
    }

    // ÉTAPE 2: Sélection Image Extérieur (façade avec meilleure visibilité)
    const facadePhotos = classifications.filter(c => c.type === 'facade');
    let bestFacade: any = null;

    if (facadePhotos.length > 0) {
      // Pour l'instant, prendre la première façade disponible
      // TODO: Implémenter analyse Gemini Vision pour détecter visibilité commerce
      const scoredFacade = facadePhotos.map(classification => {
        // Score par défaut: favoriser les premières photos (mieux classées par Google)
        const positionScore = 10 - classification.index; // Index 0 = 10 points, Index 4 = 6 points

        return {
          index: classification.index,
          type: 'facade' as const,
          score: positionScore,
          reason: 'Façade classée en priorité par Google Places (visibilité commerce)'
        };
      });

      // Trier par score décroissant
      scoredFacade.sort((a, b) => b.score - a.score);
      bestFacade = scoredFacade[0];

      // Ajouter URL de la photo
      if (photos[bestFacade.index]) {
        bestFacade.url = photos[bestFacade.index].url;
      }
    }

    // ÉTAPE 3: Construire résultat
    const selectedPhotos = [];

    if (bestInterior) {
      selectedPhotos.push(bestInterior);
    }

    if (bestFacade) {
      selectedPhotos.push(bestFacade);
    }

    // Si pas assez de photos sélectionnées, prendre les meilleures disponibles
    if (selectedPhotos.length < 2) {
      const otherPhotos = classifications
        .filter(c => c.type === 'detail' || c.type === 'non_classifiable')
        .map(c => ({
          index: c.index,
          type: c.type,
          url: photos[c.index]?.url || '',
          score: 5,
          reason: 'Photo supplémentaire (aucune façade ou intérieur disponible)'
        }));

      // Compléter jusqu'à 2 photos si possible
      while (selectedPhotos.length < 2 && otherPhotos.length > 0) {
        selectedPhotos.push(otherPhotos.shift());
      }
    }

    console.log(`[selectBestPhotos] Selected ${selectedPhotos.length} photos:`, selectedPhotos.map(p => `${p.type} (index ${p.index}, score ${p.score})`).join(', '));

    return {
      selectedPhotos,
      total_analyzed: classifications.length,
      interior_count: interiorPhotos.length,
      facade_count: facadePhotos.length
    };
  }
});

/**
 * Generate Interior Photo Selection Reason
 *
 * Génère une raison lisible expliquant pourquoi cette photo intérieur a été sélectionnée.
 */
function generateInteriorReason(etatGeneral: any): string {
  const criteria = [];

  if (etatGeneral?.lumineux) {
    criteria.push('bien éclairé');
  }

  if (etatGeneral?.range) {
    criteria.push('bien rangé');
  }

  if (etatGeneral?.propre) {
    criteria.push('propre');
  }

  if (criteria.length === 0) {
    return 'Intérieur (meilleure photo disponible)';
  }

  return `Intérieur ${criteria.join(', ')}`;
}

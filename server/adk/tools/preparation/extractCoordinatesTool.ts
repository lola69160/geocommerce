import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../utils/schemaHelper.js';
import type { BusinessInput } from '../../schemas';

/**
 * Extract Coordinates Tool
 *
 * Extrait les coordonnées GPS d'un business en vérifiant plusieurs sources.
 * Lit business depuis le state via ToolContext.
 */

const ExtractCoordinatesInputSchema = z.object({
  // Aucun paramètre - lit business depuis state
});

export const extractCoordinatesTool = new FunctionTool({
  name: 'extractCoordinates',
  description: 'Extrait les coordonnées GPS depuis state.business en vérifiant plusieurs sources (business.lat/lon, latitude/longitude, siege, matching_etablissements). Retourne { lat, lon } ou null',
  parameters: zToGen(ExtractCoordinatesInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    // Lire business depuis state
    const business = toolContext?.state.get('business') as BusinessInput | undefined;

    if (!business) {
      throw new Error('Business data not found in state');
    }

    // Priorité 1: coordonnées directes
    if (business.lat && business.lon) {
      return {
        lat: parseFloat(String(business.lat)),
        lon: parseFloat(String(business.lon))
      };
    }

    // Priorité 2: coordonnées dans latitude/longitude
    if (business.latitude && business.longitude) {
      return {
        lat: parseFloat(String(business.latitude)),
        lon: parseFloat(String(business.longitude))
      };
    }

    // Priorité 3: coordonnées dans siege
    if (business.siege?.latitude && business.siege?.longitude) {
      return {
        lat: parseFloat(String(business.siege.latitude)),
        lon: parseFloat(String(business.siege.longitude))
      };
    }

    // Priorité 4: coordonnées dans matching_etablissements
    if (business.matching_etablissements?.[0]?.latitude &&
        business.matching_etablissements?.[0]?.longitude) {
      return {
        lat: parseFloat(String(business.matching_etablissements[0].latitude)),
        lon: parseFloat(String(business.matching_etablissements[0].longitude))
      };
    }

    // Aucune coordonnée trouvée
    return null;
  }
});

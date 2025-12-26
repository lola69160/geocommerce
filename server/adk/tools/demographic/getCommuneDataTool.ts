import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../utils/schemaHelper.js';
import type { PreparationOutput } from '../../schemas';
import axios from 'axios';

/**
 * Get Commune Data Tool
 *
 * Récupère les données démographiques d'une commune via API Géo (gouv.fr).
 * Lit preparation.normalizedAddress.zipCode depuis le state via ToolContext.
 */

const GetCommuneDataInputSchema = z.object({
  // Aucun paramètre - lit preparation.normalizedAddress.zipCode depuis state
});

export const getCommuneDataTool = new FunctionTool({
  name: 'getCommuneData',
  description: 'Récupère les données démographiques (population, surface, nom) d\'une commune française via API Géo. Lit preparation.normalizedAddress.zipCode depuis state. Retourne { nom, code, codesPostaux, population, surface } ou null',
  parameters: zToGen(GetCommuneDataInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    // Lire preparation depuis state
    let preparation = toolContext?.state.get('preparation') as PreparationOutput | undefined | string;

    // Parser JSON string si nécessaire (ADK peut stocker en string)
    if (typeof preparation === 'string') {
      try {
        preparation = JSON.parse(preparation) as PreparationOutput;
      } catch (e) {
        throw new Error('Failed to parse preparation state (invalid JSON)');
      }
    }

    if (!preparation?.normalizedAddress?.zipCode) {
      throw new Error('preparation.normalizedAddress.zipCode not found in state');
    }

    const codePostal = preparation.normalizedAddress.zipCode;

    if (!codePostal || codePostal.length !== 5) {
      return null;
    }

    try {
      // API Géo - Recherche par code postal
      const response = await axios.get(
        'https://geo.api.gouv.fr/communes',
        {
          params: {
            codePostal,
            fields: 'nom,code,codesPostaux,population,surface',
            format: 'json',
            geometry: 'centre'
          },
          timeout: 10000  // Increased from 5000 to 10000 (10 seconds)
        }
      );

      if (response.data && response.data.length > 0) {
        // Si plusieurs communes, prendre la première (plus grande population généralement)
        const communes = response.data.sort((a: any, b: any) =>
          (b.population || 0) - (a.population || 0)
        );
        return communes[0];
      }

      return null;

    } catch (error: any) {
      console.error('Failed to fetch commune data:', {
        error: error.message,
        zipCode: codePostal,
        url: 'https://geo.api.gouv.fr/communes',
        params: { codePostal },
        statusCode: error.response?.status,
        responseData: error.response?.data
      });

      return {
        error: true,
        message: error.message,
        zipCode: codePostal,
        attempted: true
      };
    }
  }
});

import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../utils/schemaHelper.js';
import type { BusinessInput } from '../../schemas';

/**
 * Normalize Address Tool
 *
 * Normalise une adresse pour améliorer le matching avec APIs externes.
 * Lit les données business.siege depuis le state via ToolContext.
 */

const NormalizeAddressInputSchema = z.object({
  // Aucun paramètre - lit business.siege depuis state
});

/**
 * Simplifie un nom de rue en retirant les préfixes
 */
function simplifyStreet(street: string): string {
  if (!street) return '';

  // Préfixes courants à retirer
  const prefixes = [
    'RUE', 'AVENUE', 'AVE', 'BOULEVARD', 'BD', 'BLVD',
    'CHEMIN', 'ROUTE', 'IMPASSE', 'PLACE', 'PL',
    'COURS', 'ALLEE', 'VOIE', 'PASSAGE', 'QUAI'
  ];

  let simplified = street.toUpperCase().trim();

  // Retirer le numéro de rue au début
  simplified = simplified.replace(/^\d+\s*/, '');

  // Retirer les préfixes
  for (const prefix of prefixes) {
    const regex = new RegExp(`^${prefix}\\s+`, 'i');
    simplified = simplified.replace(regex, '');
  }

  // Retirer "DE LA", "DU", "DES", etc.
  simplified = simplified.replace(/^(DE LA|DU|DES|DE L'|DE|D')\s+/i, '');

  return simplified.trim();
}

export const normalizeAddressTool = new FunctionTool({
  name: 'normalizeAddress',
  description: 'Normalise une adresse pour améliorer le matching avec Google Places et autres APIs. Lit business.siege depuis state. Retourne: { full, street, zipCode, city, simplified }',
  parameters: zToGen(NormalizeAddressInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    // Lire business depuis state
    const business = toolContext?.state.get('business') as BusinessInput | undefined;

    if (!business?.siege) {
      throw new Error('Business siege data not found in state');
    }

    // business.siege.adresse contient déjà l'adresse complète avec code postal
    const address = (business.siege.adresse || '').trim();

    if (!address) {
      return {
        full: '',
        street: '',
        zipCode: '',
        city: '',
        simplified: ''
      };
    }

    // Extraire code postal (5 chiffres)
    const zipMatch = address.match(/\b(\d{5})\b/);
    const zipCode = zipMatch ? zipMatch[1] : '';

    // Extraire commune (après le code postal)
    let city = '';
    if (zipCode) {
      const cityMatch = address.split(zipCode)[1];
      city = cityMatch ? cityMatch.trim() : '';
    }

    // Extraire rue (avant le code postal)
    let street = zipCode ? address.split(zipCode)[0].trim() : address;

    return {
      full: address.trim(),
      street: street.trim(),
      zipCode,
      city: city.trim().toUpperCase(),
      googlePlaceId: business.siege.googlePlaceId || null
    };
  }
});

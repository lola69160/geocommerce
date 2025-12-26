/**
 * Schema Helper - Conversion Zod → JSON Schema pour Gemini API
 *
 * L'API Gemini attend du JSON Schema standard (OpenAPI 3), pas des objets Zod bruts.
 * Cette fonction convertit les schémas Zod en JSON Schema compatible.
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Convertit un schéma Zod en JSON Schema compatible avec l'API Gemini
 *
 * @param schema - Schéma Zod à convertir
 * @returns JSON Schema propre (sans $schema)
 */
export function zToGen(schema: any): any {
  // Convertit Zod en JSON Schema OpenAPI 3
  const jsonSchema = zodToJsonSchema(schema, { target: 'openApi3' });

  // Nettoyage pour l'API Gemini :
  // La propriété $schema peut provoquer des erreurs 400
  const { $schema, definitions, ...cleanSchema } = jsonSchema as any;

  // Si le schema a des definitions (références), les résoudre
  // Gemini n'aime pas les $ref
  if (definitions) {
    // Pour l'instant, retourner juste le schema principal sans les refs
    // TODO: Résoudre les $ref si nécessaire
    console.warn('Schema has definitions, may cause issues with Gemini API');
  }

  // S'assurer que type: "object" est présent à la racine
  if (!cleanSchema.type) {
    cleanSchema.type = 'object';
  }

  return cleanSchema;
}

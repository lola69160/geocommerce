import { z } from 'zod';

/**
 * Vision Extraction Schema
 *
 * Defines schemas for Gemini Vision-based PDF extraction.
 * Used by geminiVisionExtractTool to extract structured accounting data from PDFs.
 */

// Zod schema for TypeScript validation (input)
export const VisionExtractionInputSchema = z.object({
  filename: z.string().describe('Nom du fichier PDF à extraire'),
  debug: z.boolean().optional().describe('Mode debug pour logs détaillés')
});

// Zod schema for TypeScript validation (output)
export const VisionExtractionOutputSchema = z.object({
  filename: z.string(),
  documentType: z.enum(['bilan', 'compte_resultat', 'liasse_fiscale', 'bail', 'projet_vente', 'autre']),
  year: z.number().nullable(),
  confidence: z.number().min(0).max(1),
  extractedData: z.object({
    raw_text: z.string(),
    tables: z.array(z.object({
      headers: z.array(z.string()),
      rows: z.array(z.array(z.string())),
      caption: z.string().optional()
    })),
    key_values: z.record(z.any()).optional()
  }),
  reasoning: z.string().optional(),
  method: z.enum(['vision', 'heuristic', 'vision_failed']),
  error: z.string().optional()
});

// JSON Schema for Gemini API responseSchema parameter
// This defines the structure Gemini Vision should return
export const GeminiResponseSchema = {
  type: "object",
  properties: {
    documentType: {
      type: "string",
      enum: ["bilan", "compte_resultat", "liasse_fiscale", "bail", "projet_vente", "autre"],
      description: "Type de document comptable français"
    },
    year: {
      type: "number",
      description: "Année fiscale du document (YYYY)"
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "Score de confiance de l'extraction (0-1)"
    },
    reasoning: {
      type: "string",
      description: "Justification du type de document et de la confiance"
    },
    tables: {
      type: "array",
      description: "Tous les tableaux extraits du document",
      items: {
        type: "object",
        properties: {
          caption: {
            type: "string",
            description: "Titre ou légende du tableau (ex: 'ACTIF', 'CHARGES')"
          },
          headers: {
            type: "array",
            items: { type: "string" },
            description: "En-têtes de colonnes du tableau"
          },
          rows: {
            type: "array",
            items: {
              type: "array",
              items: { type: "string" }
            },
            description: "Lignes de données (chaque ligne = array de cellules)"
          }
        },
        required: ["headers", "rows"]
      }
    },
    accounting_values: {
      type: "object",
      description: "Valeurs comptables extraites directement (bonus pour bypass heuristiques)",
      properties: {
        chiffre_affaires: {
          type: "number",
          description: "Chiffre d'affaires (ventes + prestations)"
        },
        ebe: {
          type: "number",
          description: "Excédent Brut d'Exploitation"
        },
        resultat_net: {
          type: "number",
          description: "Résultat net (bénéfice ou perte)"
        },
        charges_personnel: {
          type: "number",
          description: "Charges de personnel (salaires + cotisations)"
        },
        dotations_amortissements: {
          type: "number",
          description: "Dotations aux amortissements"
        },
        resultat_exploitation: {
          type: "number",
          description: "Résultat d'exploitation"
        },
        achats_marchandises: {
          type: "number",
          description: "Achats de marchandises"
        },
        consommations_externes: {
          type: "number",
          description: "Consommations externes (loyers, assurances, etc.)"
        }
      }
    }
  },
  required: ["documentType", "confidence", "tables"]
};

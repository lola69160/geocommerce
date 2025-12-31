import { z } from 'zod';

/**
 * Document Extraction Schema
 *
 * Schémas pour l'extraction et la classification de documents comptables
 */

export const DocumentTypeEnum = z.enum([
  'bilan',
  'compte_resultat',
  'liasse_fiscale',
  'bail',
  'projet_vente',
  'autre'
]);

export const TableSchema = z.object({
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
  caption: z.string().optional()
});

export const ExtractedDataSchema = z.object({
  raw_text: z.string(),
  tables: z.array(TableSchema),
  key_values: z.record(z.string(), z.any()).optional()
});

export const ExtractedDocumentSchema = z.object({
  filename: z.string(),
  documentType: DocumentTypeEnum,
  year: z.number().nullable(),
  confidence: z.number().min(0).max(1), // 0.0 to 1.0
  extractedData: ExtractedDataSchema
});

export const DocumentExtractionSummarySchema = z.object({
  total_documents: z.number(),
  years_covered: z.array(z.number()),
  missing_documents: z.array(z.string())
});

export const DocumentExtractionOutputSchema = z.object({
  documents: z.array(ExtractedDocumentSchema),
  summary: DocumentExtractionSummarySchema
});

// Export types
export type DocumentType = z.infer<typeof DocumentTypeEnum>;
export type Table = z.infer<typeof TableSchema>;
export type ExtractedData = z.infer<typeof ExtractedDataSchema>;
export type ExtractedDocument = z.infer<typeof ExtractedDocumentSchema>;
export type DocumentExtractionSummary = z.infer<typeof DocumentExtractionSummarySchema>;
export type DocumentExtractionOutput = z.infer<typeof DocumentExtractionOutputSchema>;

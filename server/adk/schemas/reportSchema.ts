import { z } from 'zod';

/**
 * Report Agent Output Schema
 *
 * Génération rapport HTML/Markdown professionnel
 */

export const ReportOutputSchema = z.object({
  analyzed: z.boolean(),
  html: z.string().optional(),
  markdown: z.string().optional(),
  report_path: z.string().optional(), // Chemin fichier sauvegardé
  metadata: z.object({
    siret: z.string(),
    business_name: z.string(),
    generated_at: z.string().datetime(),
    agents_executed: z.number(),
    total_score: z.number(),
    recommendation: z.string()
  }).optional(),
  sections: z.array(z.object({
    title: z.string(),
    content: z.string(),
    order: z.number()
  })).optional(),
  reason: z.string().optional(),
  error: z.boolean().optional(),
  message: z.string().optional()
});

export type ReportOutput = z.infer<typeof ReportOutputSchema>;

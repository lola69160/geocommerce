import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Classify Document Tool
 *
 * Utilise Gemini pour classifier un document comptable à partir du texte extrait.
 * Détecte: bilan, compte de résultat, liasse fiscale, bail, projet de vente, autre
 */

const ClassifyDocumentInputSchema = z.object({
  filename: z.string().describe('Nom du fichier'),
  text: z.string().describe('Texte extrait du PDF (premiers 3000 caractères suffisent)')
});

const ClassifyDocumentOutputSchema = z.object({
  filename: z.string(),
  documentType: z.enum(['bilan', 'compte_resultat', 'liasse_fiscale', 'bail', 'projet_vente', 'autre']),
  year: z.number().nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional()
});

export const classifyDocumentTool = new FunctionTool({
  name: 'classifyDocument',
  description: 'Classifie un document comptable à partir du texte extrait. Retourne: { documentType, year, confidence }',
  parameters: zToGen(ClassifyDocumentInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    const { filename, text } = params;

    try {
      // Limiter le texte pour économiser tokens (prendre début + fin)
      const textSample = text.length > 5000
        ? text.substring(0, 3000) + '\n\n[...]\n\n' + text.substring(text.length - 2000)
        : text;

      // Initialiser Gemini
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY not configured');
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

      const prompt = `Tu es un expert-comptable qui classifie des documents comptables français.

Analyse le texte extrait ci-dessous et détermine :
1. Le TYPE de document (bilan / compte_resultat / liasse_fiscale / bail / projet_vente / autre)
2. L'ANNÉE fiscale mentionnée (format YYYY, ou null si introuvable)
3. Ton niveau de CONFIANCE (0.0 à 1.0)

RÈGLES DE CLASSIFICATION :
- "bilan" : Document présentant ACTIF / PASSIF, balance comptable
- "compte_resultat" : Document avec PRODUITS / CHARGES, résultat d'exploitation
- "liasse_fiscale" : Formulaires Cerfa 2050-2059, déclaration fiscale annuelle
- "bail" : Contrat de location commerciale, bail 3-6-9
- "projet_vente" : Proposition d'achat, offre de reprise, cession de fonds de commerce
- "autre" : Document non identifié clairement

INDICATEURS D'ANNÉE :
- "Exercice clos le 31/12/2024" → 2024
- "Période du 01/01/2023 au 31/12/2023" → 2023
- Chercher dans les 200 premiers caractères

TEXTE DU DOCUMENT :
\`\`\`
${textSample}
\`\`\`

RETOURNE UNIQUEMENT LE JSON VALIDE :
{
  "documentType": "bilan" | "compte_resultat" | "liasse_fiscale" | "bail" | "projet_vente" | "autre",
  "year": 2024 ou null,
  "confidence": 0.85,
  "reasoning": "Explication courte (1 phrase)"
}`;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 512
        }
      });

      const response = result.response.text();

      // Parser la réponse JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse Gemini response as JSON');
      }

      const classification = JSON.parse(jsonMatch[0]);

      return {
        filename,
        documentType: classification.documentType || 'autre',
        year: classification.year || null,
        confidence: classification.confidence || 0.5,
        reasoning: classification.reasoning
      };

    } catch (error: any) {
      // Fallback : classification basique par mots-clés
      const lowerText = text.toLowerCase();

      let documentType: 'bilan' | 'compte_resultat' | 'liasse_fiscale' | 'bail' | 'projet_vente' | 'autre' = 'autre';
      let confidence = 0.3;

      if (lowerText.includes('actif') && lowerText.includes('passif')) {
        documentType = 'bilan';
        confidence = 0.6;
      } else if (lowerText.includes('produits') && lowerText.includes('charges')) {
        documentType = 'compte_resultat';
        confidence = 0.6;
      } else if (lowerText.includes('cerfa') || lowerText.includes('liasse')) {
        documentType = 'liasse_fiscale';
        confidence = 0.7;
      } else if (lowerText.includes('bail') || lowerText.includes('loyer')) {
        documentType = 'bail';
        confidence = 0.5;
      }

      // Extraction année simple (YYYY)
      const yearMatch = text.match(/\b(20\d{2})\b/);
      const year = yearMatch ? parseInt(yearMatch[1]) : null;

      return {
        filename,
        documentType,
        year,
        confidence,
        reasoning: `Fallback classification (Gemini error: ${error.message})`
      };
    }
  }
});

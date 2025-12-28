import { FunctionTool } from '@google/adk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ToolContext } from '@google/adk';
import { z } from 'zod';
import { zToGen } from '../../../utils/schemaHelper';

/**
 * Analyze Page Type Tool
 *
 * Utilise Gemini Vision pour classifier une page de document comptable.
 * Identifie si la page contient :
 * - Bilan Actif (ACTIF du bilan)
 * - Bilan Passif (PASSIF du bilan)
 * - Compte de Resultat (PRODUITS/CHARGES)
 * - SIG (Soldes Intermediaires de Gestion)
 * - Autre (page non pertinente)
 *
 * Extrait egalement l'annee fiscale de la page.
 */

const AnalyzePageTypeInputSchema = z.object({
  pageBuffer: z.string().describe('Page PDF en base64 (PDF d\'une seule page)'),
  pageNumber: z.number().describe('Numero de la page dans le document original'),
  filename: z.string().optional().describe('Nom du fichier source (pour logging)')
});

const AnalyzePageTypeOutputSchema = z.object({
  pageNumber: z.number(),
  pageType: z.enum(['bilan_actif', 'bilan_passif', 'compte_resultat', 'sig', 'autre']),
  year: z.number().nullable(),
  confidence: z.number(),
  reasoning: z.string().optional(),
  error: z.string().optional()
});

// Prompt pour la classification de page
const PAGE_CLASSIFICATION_PROMPT = `Tu es un expert-comptable français. Analyse cette page de document comptable et classifie-la.

CLASSIFICATION - Choisis UNE SEULE catégorie :

"bilan_actif" : Page contenant l'ACTIF du bilan comptable
  - Signes distinctifs : tableau avec colonnes "ACTIF", montants
  - Contient : Immobilisations (incorporelles, corporelles, financières), Actif circulant (stocks, créances, disponibilités)
  - Mots-clés : ACTIF, Immobilisations, Stocks, Créances clients, Disponibilités, Charges constatées d'avance

"bilan_passif" : Page contenant le PASSIF du bilan comptable
  - Signes distinctifs : tableau avec colonnes "PASSIF", montants
  - Contient : Capitaux propres (capital, réserves, résultat), Provisions, Dettes (fournisseurs, fiscales, financières)
  - Mots-clés : PASSIF, Capitaux propres, Capital social, Réserves, Dettes, Provisions

"compte_resultat" : Page contenant le Compte de Résultat
  - Signes distinctifs : tableau avec PRODUITS et CHARGES, calcul du résultat
  - Contient : Chiffre d'affaires, Achats, Charges de personnel, Dotations, Résultat d'exploitation, Résultat net
  - Mots-clés : PRODUITS D'EXPLOITATION, CHARGES D'EXPLOITATION, Résultat d'exploitation, Résultat net

"sig" : Page contenant les Soldes Intermédiaires de Gestion
  - Signes distinctifs : tableau récapitulatif des marges et soldes
  - Contient : Marge commerciale, Valeur ajoutée, EBE (Excédent Brut d'Exploitation), Résultat d'exploitation
  - Mots-clés : SIG, Soldes Intermédiaires, Marge commerciale, Valeur ajoutée, EBE, Capacité d'autofinancement

"autre" : Page non pertinente pour l'analyse comptable
  - Pages de garde, sommaires, annexes textuelles, notes, mentions légales
  - Pages avec peu ou pas de données chiffrées pertinentes
  - Attestations, certificats, rapports d'audit sans tableaux comptables

EXTRACTION DE L'ANNEE :
- Chercher "Exercice clos le DD/MM/YYYY" ou "Période du ... au DD/MM/YYYY"
- Chercher les en-têtes de colonnes (N, N-1, 2023, 2022, etc.)
- Format de sortie : YYYY (nombre entier, ex: 2023)
- Si plusieurs années visibles, prendre la plus récente (année N)

CONFIDENCE SCORING (0.0 - 1.0) :
- 0.9-1.0 : Classification évidente, contenu très clair
- 0.7-0.9 : Classification probable, contenu lisible
- 0.5-0.7 : Classification incertaine, contenu partiellement lisible
- 0.3-0.5 : Classification difficile, page ambiguë
- 0.0-0.3 : Classification impossible

ATTENTION :
- Une page peut contenir plusieurs sections (ex: fin de l'ACTIF + début du PASSIF)
  → Classifier selon la section PRINCIPALE (celle qui occupe le plus d'espace)
- Si la page contient un tableau de bord ou récapitulatif avec CA, EBE, Résultat net → "sig"
- Les pages avec uniquement du texte (notes, annexes narratives) → "autre"

REPONSE JSON UNIQUEMENT :
{
  "pageType": "bilan_actif" | "bilan_passif" | "compte_resultat" | "sig" | "autre",
  "year": 2023,
  "confidence": 0.85,
  "reasoning": "Page contenant le tableau ACTIF du bilan avec immobilisations et actif circulant. Année 2023 visible en en-tête de colonne."
}`;

export const analyzePageTypeTool = new FunctionTool({
  name: 'analyzePageType',
  description: 'Classifie une page de document comptable avec Gemini Vision. Retourne le type de page (bilan_actif, bilan_passif, compte_resultat, sig, autre), l\'année fiscale et un score de confiance.',
  parameters: zToGen(AnalyzePageTypeInputSchema),

  execute: async (params: { pageBuffer: string; pageNumber: number; filename?: string }, toolContext?: ToolContext) => {
    const { pageBuffer, pageNumber, filename } = params;

    try {
      console.log(`\n[analyzePageType] Analyzing page ${pageNumber}${filename ? ` from ${filename}` : ''}`);

      // Verifier GEMINI_API_KEY
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return {
          pageNumber,
          pageType: 'autre' as const,
          year: null,
          confidence: 0,
          error: 'GEMINI_API_KEY not configured'
        };
      }

      // Appel Gemini Vision API
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash" // Utiliser flash pour rapidite (analyse simple)
      });

      const result = await model.generateContent({
        contents: [{
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "application/pdf",
                data: pageBuffer
              }
            },
            { text: PAGE_CLASSIFICATION_PROMPT }
          ]
        }],
        generationConfig: {
          temperature: 0.2, // Low temperature pour classification deterministe
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 1024,
          responseMimeType: "application/json"
        }
      });

      const responseText = result.response.text();

      // Parser la reponse JSON
      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch (parseError: any) {
        console.error(`[analyzePageType] JSON parse error for page ${pageNumber}:`, parseError.message);
        // Fallback: essayer d'extraire les infos du texte
        return {
          pageNumber,
          pageType: 'autre' as const,
          year: null,
          confidence: 0,
          error: `Failed to parse Gemini response: ${parseError.message}`
        };
      }

      // Valider le type de page
      const validTypes = ['bilan_actif', 'bilan_passif', 'compte_resultat', 'sig', 'autre'];
      const pageType = validTypes.includes(parsed.pageType) ? parsed.pageType : 'autre';

      console.log(`[analyzePageType] Page ${pageNumber}: ${pageType} (year: ${parsed.year || 'N/A'}, confidence: ${parsed.confidence})`);

      return {
        pageNumber,
        pageType: pageType as 'bilan_actif' | 'bilan_passif' | 'compte_resultat' | 'sig' | 'autre',
        year: parsed.year || null,
        confidence: parsed.confidence || 0,
        reasoning: parsed.reasoning
      };

    } catch (error: any) {
      console.error(`[analyzePageType] Error analyzing page ${pageNumber}:`, error.message);
      return {
        pageNumber,
        pageType: 'autre' as const,
        year: null,
        confidence: 0,
        error: error.message
      };
    }
  }
});

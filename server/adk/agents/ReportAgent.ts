import { LlmAgent } from '@google/adk';
import { generateHTMLTool } from '../tools/report/index.js';
import { getModelConfig } from '../config/models.js';
import { getSystemPrompt } from '../config/prompts.js';
import type { AgentState } from '../types/index.js';

/**
 * ReportAgent - Génération rapport final (ADK)
 *
 * Agent final qui compile tous les résultats d'analyse
 * en un rapport HTML professionnel et le sauvegarde sur disque.
 *
 * Responsabilités:
 * - Compiler outputs de tous les agents (preparation → strategic)
 * - Générer rapport HTML avec CSS professionnel
 * - Sauvegarder rapport dans data/professional-reports/
 * - Nommer fichier: YYYYMMDD_HHMMSS_<siret>.html
 *
 * Sections du rapport:
 * 1. Executive Summary (GO/NO-GO, scores clés)
 * 2. Business Information (identité, localisation)
 * 3. Demographic Analysis (population, CSP, potentiel)
 * 4. Market Analysis (concurrence, réputation)
 * 5. Physical Assessment (photos, état, travaux)
 * 6. Data Validation (conflits, cohérence, arbitrage)
 * 7. Risk Analysis (risques catégorisés, mitigation)
 * 8. Strategic Recommendation (rationale GO/NO-GO)
 *
 * Modèle: gemini-2.0-flash-lite (génération rapide)
 */
export class ReportAgent extends LlmAgent {
  constructor() {
    const modelConfig = getModelConfig('report');

    super({
      name: 'report',
      description: 'Génération rapport HTML professionnel avec sauvegarde',

      // Modèle Gemini
      model: modelConfig.name,

      // ⚠️ CRITICAL: Do NOT add responseMimeType or responseSchema
      // These are incompatible with tools (Function Calling) - see models.ts line 44
      // JSON output is achieved via explicit instructions below
      generateContentConfig: {
        temperature: modelConfig.temperature,
        topP: modelConfig.topP,
        topK: modelConfig.topK,
        maxOutputTokens: modelConfig.maxOutputTokens
      },

      // Tools disponibles
      tools: [generateHTMLTool],

      // Instruction système
      instruction: `${getSystemPrompt('report')}

Tu dois générer un rapport HTML professionnel compilant tous les résultats.

WORKFLOW SIMPLIFIÉ (1 SEUL TOOL):

1. **GÉNÉRATION ET SAUVEGARDE AUTOMATIQUE**
   Appeler generateHTML() sans paramètres

   ⚠️⚠️⚠️ IMPORTANT: Ce tool génère ET sauvegarde automatiquement le fichier HTML

   Le tool fait AUTOMATIQUEMENT:
   - Lit tous les outputs depuis state (business, preparation, demographic, places, photo, competitor, validation, gap, arbitration, strategic)
   - Génère HTML complet avec CSS intégré
   - Sauvegarde fichier dans data/professional-reports/<SIRET>/
   - Retourne métadonnées SEULEMENT (pas le HTML complet)

   Résultat du tool:
   {
     "html": "[HTML saved to file: YYYYMMDD_HHMMSS_professional-report.html]",
     "saved": true,
     "filepath": "/absolute/path/...",
     "filename": "YYYYMMDD_HHMMSS_professional-report.html",
     "siret": "88364007000024",
     "size_bytes": 127456,
     "sections_included": ["preparation", "demographic", ...],
     "generated_at": "2026-01-08T16:23:24.123Z"
   }

2. **RÉSULTAT FINAL**
   Retourner métadonnées du rapport:

FORMAT DE SORTIE JSON (STRICT):

{
  "generated": boolean,
  "saved": boolean,
  "report_metadata": {
    /* COPIE INTÉGRALE du résultat de saveReport */
    "filepath": "string",
    "filename": "string",
    "siret": "string",
    "size_bytes": number,
    "saved_at": "ISO datetime"
  },
  "interpretation": "string (2-3 phrases: succès génération, taille fichier, sections incluses, recommandation finale)"
}

Exemple:
{
  "generated": true,
  "saved": true,
  "report_metadata": {
    "filepath": "/absolute/path/to/data/professional-reports/88364007000024/20260108_162324_professional-report.html",
    "filename": "20260108_162324_professional-report.html",
    "siret": "88364007000024",
    "size_bytes": 123456,
    "saved_at": "2026-01-08T16:23:24.123Z"
  },
  "interpretation": "Rapport professionnel généré avec succès. Fichier de 120 KB sauvegardé dans le dossier SIRET 88364007000024. Le rapport contient 8 sections d'analyse complètes. Recommandation finale: GO_WITH_RESERVES avec un score global de 72/100."
}

Si erreur:
{
  "generated": false,
  "saved": false,
  "error": true,
  "message": "string (explication erreur)"
}

RÈGLES IMPORTANTES:

1. **UN SEUL TOOL CALL:**
   generateHTML() fait TOUT (génération + sauvegarde automatique)
   NE PAS appeler de deuxième tool

2. **COPIE INTÉGRALE DU RÉSULTAT:**
   ⚠️⚠️⚠️ CRITIQUE: COPIE INTÉGRALEMENT le résultat de generateHTML dans report_metadata
   Ne calcule RIEN manuellement
   Le HTML est déjà sauvegardé sur disque (pas dans le JSON retourné)

3. **INTERPRÉTATION:**
   Mentionner taille en KB (conversion mentale de size_bytes)
   Mentionner recommandation finale si disponible dans state.strategic
   Exemple: "Fichier de 124 KB créé avec recommandation GO (score 82/100)"

4. **DONNÉES MINIMALES:**
   - Si business manquant: erreur retournée par le tool
   - Si strategic manquant: mentionner dans interpretation
   - Le tool gère tous les cas limites automatiquement

RETOURNE UNIQUEMENT LE JSON VALIDE.`,

      // Clé de sortie dans le state
      outputKey: 'report' as keyof AgentState
    });
  }
}

export default ReportAgent;

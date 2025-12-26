import { LlmAgent } from '@google/adk';
import { generateHTMLTool, saveReportTool } from '../tools/report/index.js';
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
 * - Nommer fichier: YYYYMMDD_HHMMSS_SIRET.html
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

      // Configuration génération JSON forcé via responseMimeType)
      generateContentConfig: {
        temperature: modelConfig.temperature,
        topP: modelConfig.topP,
        topK: modelConfig.topK,
        maxOutputTokens: modelConfig.maxOutputTokens

      },

      // Tools disponibles
      tools: [generateHTMLTool, saveReportTool],

      // Instruction système
      instruction: `${getSystemPrompt('report')}

Tu dois générer un rapport HTML professionnel compilant tous les résultats.

WORKFLOW:

1. **COMPILATION DONNÉES**
   Récupérer tous les outputs disponibles depuis le state:
   - business (données initiales)
   - preparation (adresse normalisée, coordonnées)
   - demographic (population, CSP, scores)
   - places (réputation, avis, photos)
   - photo (état physique, travaux)
   - competitor (concurrence, densité)
   - validation (conflits, cohérence)
   - gap (scores multi-dimensionnels, risques)
   - arbitration (résolutions conflits)
   - strategic (recommandation GO/NO-GO, rationale)

2. **GÉNÉRATION HTML**
   Appeler generateHTML() sans paramètres (lit tout depuis state)
   - Retourne objet: { html, size_bytes, sections_included, generated_at }
   - HTML complet avec CSS intégré
   - Sections structurées et professionnelles

3. **SAUVEGARDE FICHIER**
   Extraire le champ 'html' du résultat de generateHTML
   Appeler saveReport avec SEULEMENT le HTML: saveReport({ html: "...", outputDir: "data/professional-reports" })
   - Le SIRET est lu automatiquement depuis state.business (ne PAS le passer en paramètre)
   - Crée répertoire si nécessaire
   - Retourne: { filepath, filename, size_bytes, saved_at, success }

4. **RÉSULTAT FINAL**
   Retourner métadonnées du rapport:
   - Chemin fichier
   - Taille en bytes
   - Sections incluses
   - Timestamp génération

FORMAT DE SORTIE JSON (STRICT):

{
  "generated": boolean,
  "filepath": "string (chemin absolu)",
  "filename": "string",
  "size_bytes": number,
  "size_kb": number,
  "sections_included": ["preparation", "demographic", ...],
  "generated_at": "ISO datetime",
  "business_info": {
    "siret": "string",
    "name": "string",
    "address": "string"
  },
  "summary": {
    "recommendation": "GO" | "NO-GO" | "GO_WITH_RESERVES",
    "overall_score": number,
    "total_risks": number,
    "critical_risks": number
  }
}

Si erreur:
{
  "generated": false,
  "error": true,
  "message": "string (explication erreur)"
}

RÈGLES IMPORTANTES:

1. **DONNÉES MINIMALES REQUISES:**
   - business (obligatoire)
   - strategic (obligatoire pour recommendation)
   - gap (obligatoire pour scores)
   Si manquantes: générer rapport partiel avec avertissement

2. **NOMMAGE FICHIER:**
   Format: YYYYMMDD_HHMMSS_SIRET.html
   Exemple: 20250115_143025_12345678900001.html

3. **RÉPERTOIRE DESTINATION:**
   - Default: data/professional-reports/
   - Créé automatiquement si inexistant
   - Permissions lecture/écriture requises

4. **TAILLE FICHIER:**
   - Typiquement 50-150 KB
   - Si > 500 KB: vérifier contenu excessif
   - Calculer size_kb = Math.round(size_bytes / 1024)

5. **SECTIONS CONDITIONNELLES:**
   - Inclure uniquement sections avec données disponibles
   - Afficher message "Données non disponibles" si section vide
   - Toujours inclure: Header, Executive Summary, Footer

6. **FORMATTING HTML:**
   - CSS intégré (pas de fichier externe)
   - Responsive design
   - Compatible tous navigateurs modernes
   - Imprimable (media queries print)

RETOURNE UNIQUEMENT LE JSON VALIDE.`,

      // Clé de sortie dans le state
      outputKey: 'report' as keyof AgentState
    });
  }
}

export default ReportAgent;

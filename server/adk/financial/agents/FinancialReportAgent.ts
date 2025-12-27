import { LlmAgent } from '@google/adk';
import {
  generateChartsTool,
  generateFinancialHtmlTool,
  saveFinancialReportTool
} from '../tools/report';
import type { FinancialState } from '../index';

/**
 * FinancialReportAgent - Agent de génération de rapport HTML professionnel
 *
 * Sixième et dernier agent du Pipeline Financier - génère un rapport HTML autonome.
 *
 * Responsabilités:
 * - Générer les configurations Chart.js pour les graphiques
 * - Générer le HTML complet du rapport (7 sections)
 * - Sauvegarder le rapport dans data/financial-reports/
 * - Rapport 100% AUTONOME (indépendant du Pipeline Stratégique)
 *
 * 7 Sections du rapport:
 * 1. Page de garde (nom, date, score confiance)
 * 2. Synthèse exécutive (verdict, valorisation, points forts/vigilance)
 * 3. Analyse comptable (SIG, ratios, benchmark, alertes, graphiques)
 * 4. Valorisation du fonds (3 méthodes, fourchettes, arguments négociation)
 * 5. Analyse immobilière (bail, murs, travaux)
 * 6. Validation & fiabilité (score confiance, anomalies, vérifications)
 * 7. Annexes (documents, hypothèses, glossaire)
 *
 * Pattern ADK:
 * - Extends LlmAgent
 * - Utilise 3 tools via Gemini function calling
 * - Output automatiquement injecté dans state via outputKey
 */
export class FinancialReportAgent extends LlmAgent {
  constructor() {
    // Configuration Gemini - aligner avec MODEL_DEFAULTS
    const modelConfig = {
      name: 'gemini-3-flash-preview', // Same as other agents
      temperature: 0.4, // Match MODEL_DEFAULTS from models.ts
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192
    };

    super({
      name: 'financialReport',
      description: 'Génération de rapport HTML professionnel complet et autonome',

      // Modèle Gemini
      model: modelConfig.name,

      // Configuration génération
      generateContentConfig: {
        temperature: modelConfig.temperature,
        topP: modelConfig.topP,
        topK: modelConfig.topK,
        maxOutputTokens: modelConfig.maxOutputTokens
      },

      // Tools disponibles pour l'agent
      tools: [
        generateChartsTool,
        generateFinancialHtmlTool,
        saveFinancialReportTool
      ],

      // Instruction système
      instruction: `Tu es un expert en reporting financier professionnel spécialisé dans les rapports de due diligence.

Ton rôle est de générer un rapport HTML complet, professionnel et AUTONOME compilant toutes les analyses financières.

DONNÉES DISPONIBLES :
Les données sont passées via state (accessible dans les tools) :
- state.businessInfo : Informations sur l'entreprise (name, siret, nafCode)
- state.documentExtraction : Documents comptables extraits
- state.comptable : Analyse comptable (SIG, ratios, évolution, benchmark, santé)
- state.valorisation : Valorisation (3 méthodes, synthèse, arguments)
- state.immobilier : Analyse immobilière (bail, murs, travaux)
- state.financialValidation : Validation croisée (cohérence, anomalies, qualité, confiance)

IMPORTANT: Les tools génèrent tout automatiquement - tu n'as PAS besoin de formater manuellement.
Tu dois simplement APPELER LES TOOLS dans l'ordre.

WORKFLOW OBLIGATOIRE (UTILISE LES TOOLS DANS L'ORDRE) :

ÉTAPE 1 : GÉNÉRER LES GRAPHIQUES
   generateCharts({})
   → Retourne { evolutionChart, valorisationChart, healthGauge, confidenceRadar }

   Le tool génère automatiquement les configurations Chart.js :
   - evolutionChart : Évolution CA/EBE/RN sur 3 ans (line chart)
   - valorisationChart : Fourchettes de valorisation (horizontal bar chart)
   - healthGauge : Gauge score de santé (doughnut 0-100)
   - confidenceRadar : Radar confiance par section

ÉTAPE 2 : GÉNÉRER LE HTML COMPLET
   generateFinancialHtml({ charts: <résultat étape 1> })
   → Retourne { html: "...", sections_included: [...] }

   Le tool génère automatiquement le HTML complet avec 7 sections :
   1. Page de garde
   2. Synthèse exécutive (verdict FAVORABLE/RÉSERVES/DÉFAVORABLE)
   3. Analyse comptable (tableaux SIG, ratios, graphiques)
   4. Valorisation (comparaison méthodes, graphique, arguments)
   5. Analyse immobilière (bail, murs, travaux)
   6. Validation & fiabilité (scores, anomalies, vérifications)
   7. Annexes (documents, hypothèses, glossaire)

ÉTAPE 3 : SAUVEGARDER LE RAPPORT
   saveFinancialReport({
     html: <résultat étape 2>,
     businessId: <lire depuis state.businessInfo.siret ou générer ID>,
     sections_included: <sections depuis étape 2>
   })
   → Retourne { generated: true, filepath: "...", filename: "...", size_bytes: ..., sections_included: [...], generatedAt: "..." }

   Le tool sauvegarde automatiquement le rapport dans data/financial-reports/
   Nom de fichier : financial-report-[businessId]-[date].html

FORMAT DE SORTIE JSON (STRICT) :
{
  "generated": true,
  "filepath": "C:\\AI\\searchcommerce\\data\\financial-reports\\financial-report-12345678900012-2025-12-26.html",
  "filename": "financial-report-12345678900012-2025-12-26.html",
  "size_bytes": 125000,
  "sections_included": [
    "cover_page",
    "executive_summary",
    "accounting_analysis",
    "valuation",
    "real_estate",
    "validation",
    "annexes"
  ],
  "generatedAt": "2025-12-26T14:30:00.000Z"
}

RÈGLES :
1. Appeler les 3 tools dans l'ordre (generateCharts → generateFinancialHtml → saveFinancialReport)
2. Ne PAS générer de HTML manuellement - utiliser les tools
3. Passer les résultats d'un tool à l'autre (chaînage)
4. Si un tool échoue, le mentionner dans le JSON mais continuer avec les autres si possible
5. Le rapport doit être 100% AUTONOME (aucune référence au Pipeline Stratégique)

BUSINESSID :
- Priorité 1 : state.businessInfo.siret
- Priorité 2 : state.businessInfo.name (slugifié)
- Priorité 3 : "commerce" (défaut)

GESTION D'ERREURS :
- Si aucune donnée dans le state :
  Retourner un JSON avec generated = false et error = "Aucune analyse financière disponible"

RETOURNE UNIQUEMENT LE JSON VALIDE (pas de texte avant/après)`,

      // Clé de sortie dans le state
      outputKey: 'financialReport' as keyof FinancialState
    });
  }
}

export default FinancialReportAgent;

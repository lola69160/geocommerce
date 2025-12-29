import { LlmAgent } from '@google/adk';
import {
  generateChartsTool,
  generateFinancialHtmlTool,
  saveFinancialReportTool
} from '../tools/report';
import { businessPlanDynamiqueTool } from '../tools/planning';
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
        businessPlanDynamiqueTool,
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
- state.userComments : Commentaires et hypothèses du repreneur (investissement, travaux, horaires, charges)

IMPORTANT: Les tools génèrent tout automatiquement - tu n'as PAS besoin de formater manuellement.
Tu dois simplement APPELER LES TOOLS dans l'ordre.

WORKFLOW OBLIGATOIRE (UTILISE LES TOOLS DANS L'ORDRE) :

ÉTAPE 1 : GÉNÉRER LE BUSINESS PLAN DYNAMIQUE (NOUVEAU)
   businessPlanDynamique({
     prixAchat: <valeur recommandée depuis state.valorisation>,
     montantTravaux: <budget travaux depuis state.immobilier>,
     subventionsEstimees: <depuis userComments si fourni>,
     apportPersonnel: <depuis userComments ou 30% investissement>,
     tauxEmprunt: <depuis userComments ou 4.5% par défaut>,
     dureeEmpruntMois: <depuis userComments ou 84 mois par défaut>,
     extensionHoraires: {
       joursSupplementaires: <depuis userComments>,
       impactEstime: <depuis userComments ou 0.10 par défaut>
     },
     travaux: {
       impactAnnee2: <depuis userComments ou 0.10 par défaut>,
       impactRecurrent: <depuis userComments ou 0.03 par défaut>
     },
     salairesSupprimes: <depuis userComments ou 0>,
     salairesAjoutes: <depuis userComments ou 0>,
     loyerNegocie: <depuis simulationLoyer scenario réaliste ou loyer actuel>
   })
   → Retourne { projections: [], indicateursBancaires: {}, hypotheses: {}, synthese: "...", recommandations: [] }

   Le tool génère automatiquement :
   - Projections sur 5 ans (Année 0 à 5) avec CA, charges, EBE, annuité, reste après dette
   - Indicateurs bancaires (ratio couverture, CAF, point mort, ROI, délai retour)
   - Recommandations pour optimiser le plan

   IMPORTANT: Lire state.userComments pour extraire les hypothèses du repreneur.
   Si userComments n'est pas fourni, utiliser des valeurs par défaut raisonnables basées sur les analyses précédentes.

ÉTAPE 2 : GÉNÉRER LES GRAPHIQUES
   generateCharts({})
   → Retourne { evolutionChart, valorisationChart, healthGauge, confidenceRadar }

   Le tool génère automatiquement les configurations Chart.js :
   - evolutionChart : Évolution CA/EBE/RN sur 3 ans (line chart)
   - valorisationChart : Fourchettes de valorisation (horizontal bar chart)
   - healthGauge : Gauge score de santé (doughnut 0-100)
   - confidenceRadar : Radar confiance par section

ÉTAPE 3 : GÉNÉRER ET SAUVEGARDER LE RAPPORT HTML
   generateFinancialHtml({ charts: <résultat étape 2> })
   → Le tool génère le HTML ET le sauvegarde automatiquement dans data/financial-reports/
   → Retourne { saved: true, filepath: "...", filename: "...", sections_included: [...] }

   IMPORTANT: Ce tool sauvegarde automatiquement le fichier.
   Tu n'as PAS besoin d'appeler saveFinancialReport après.

   Le tool génère automatiquement le HTML complet avec 8 sections :
   1. Page de garde
   2. Synthèse exécutive (verdict FAVORABLE/RÉSERVES/DÉFAVORABLE)
   3. Analyse comptable (tableaux SIG, ratios, graphiques)
   4. Valorisation (comparaison méthodes, graphique, arguments)
   5. Analyse immobilière (bail, murs, travaux)
   6. Business Plan Dynamique (NOUVEAU - projections 5 ans, indicateurs bancaires)
   7. Validation & fiabilité (scores, anomalies, vérifications)
   8. Annexes (documents, hypothèses, glossaire)

WORKFLOW SIMPLIFIÉ (3 ÉTAPES) :
1. businessPlanDynamique → génère les projections
2. generateCharts → génère les graphiques
3. generateFinancialHtml → génère ET sauvegarde le rapport

Après l'étape 3, le rapport est automatiquement sauvegardé et injecté dans le state.

IMPORTANT: Ne PAS retourner de JSON après les tool calls.
Le rapport est automatiquement injecté dans state.financialReport par generateFinancialHtml.
Terminer simplement avec un message texte de confirmation comme "Rapport financier généré avec succès."

RÈGLES :
1. Appeler les 3 tools dans l'ordre (businessPlanDynamique → generateCharts → generateFinancialHtml)
2. Ne PAS appeler saveFinancialReport (generateFinancialHtml le fait automatiquement)
3. Passer les résultats d'un tool à l'autre (chaînage)
4. Le rapport doit être 100% AUTONOME (aucune référence au Pipeline Stratégique)
5. Pour businessPlanDynamique, extraire les hypothèses depuis state.userComments et les autres states

GESTION D'ERREURS :
- Si aucune donnée dans le state : retourner un message d'erreur texte
- Si un tool échoue : retourner un message d'erreur texte décrivant le problème`

      // Note: outputKey supprimé intentionnellement
      // Le rapport est injecté dans state.financialReport directement par generateFinancialHtmlTool
      // Cela évite que l'agent écrase l'injection avec son output JSON
    });
  }
}

export default FinancialReportAgent;

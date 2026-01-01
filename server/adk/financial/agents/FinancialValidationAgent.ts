import { LlmAgent } from '@google/adk';
import {
  validateTabacValorisationOutputTool,
  crossValidateTool,
  detectAnomaliesTool,
  assessDataQualityTool,
  generateDeterministicAlertsTool
} from '../tools/validation';
import type { FinancialState } from '../index';

/**
 * FinancialValidationAgent - Agent de validation croisée et contrôle qualité
 *
 * Cinquième agent du Pipeline Financier - vérifie la cohérence et la fiabilité des analyses.
 *
 * Responsabilités:
 * - Vérifier la cohérence entre les différentes analyses (extraction, comptable, valorisation, immobilier)
 * - Détecter les anomalies dans les données et les calculs
 * - Évaluer la qualité des données (complétude, fiabilité, fraîcheur)
 * - Calculer un score de confiance global
 * - Générer des recommandations de vérification
 * - Lister les documents additionnels à demander au vendeur
 *
 * Pattern ADK:
 * - Extends LlmAgent
 * - Utilise 3 tools via Gemini function calling
 * - Output automatiquement injecté dans state via outputKey
 */
export class FinancialValidationAgent extends LlmAgent {
  constructor() {
    // Configuration Gemini
    const modelConfig = {
      name: 'gemini-3-flash-preview',
      temperature: 0.2, // Température basse pour validation rigoureuse
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192
    };

    super({
      name: 'financialValidation',
      description: 'Validation croisée et contrôle qualité des analyses financières',

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
        validateTabacValorisationOutputTool,
        crossValidateTool,
        detectAnomaliesTool,
        assessDataQualityTool,
        generateDeterministicAlertsTool
      ],

      // Instruction système
      instruction: `Tu es un expert en audit financier et contrôle qualité, spécialisé dans la validation de due diligence d'acquisition.

Ton rôle est de vérifier la cohérence et la fiabilité de toutes les analyses financières effectuées, et de fournir un rapport de validation détaillé.

DONNÉES DISPONIBLES :
Les données sont passées via state (accessible dans les tools) :
- state.documentExtraction : Documents comptables extraits
- state.comptable : Analyse comptable (SIG, ratios, tendances, benchmark, santé)
- state.valorisation : Valorisation de l'entreprise (3 méthodes)
- state.immobilier : Analyse immobilière (bail, murs)
- state.businessInfo : Informations sur l'entreprise

IMPORTANT: Les tools font toutes les vérifications automatiquement - ne calcule PAS manuellement.
Tu dois APPELER LES TOOLS puis INTERPRÉTER les résultats.

WORKFLOW OBLIGATOIRE (UTILISE LES TOOLS DANS L'ORDRE) :

⚠️ ÉTAPE 0 (DIAGNOSTIC - OBLIGATOIRE EN PREMIER) : VÉRIFIER VALORISATION TABAC
   validateTabacValorisationOutput()
   → Retourne: { isTabacSector: true/false, methodeHybridePresent: true/false, validationStatus: "OK"/"ERROR", message: "..." }

   Ce tool DOIT être appelé EN PREMIER pour diagnostiquer si la valorisation Tabac est correctement présente.
   - Si validationStatus = "ERROR" → MENTIONNER dans ton rapport de validation que la valorisation Tabac est MANQUANTE
   - Si validationStatus = "OK" → Continuer normalement

ÉTAPE 1 : VALIDATION CROISÉE (Vérifications de cohérence)
   crossValidate({})
   → Retourne { coherenceChecks: [...], totalChecks, passedChecks, warningChecks, errorChecks }

   Le tool vérifie automatiquement :
   - Présence des analyses requises
   - Cohérence des années analysées
   - Cohérence CA extraction vs SIG
   - Cohérence EBE/CA comptable vs valorisation
   - Cohérence valorisation vs immobilier
   - Cohérence santé financière vs méthode de valorisation

ÉTAPE 2 : DÉTECTION D'ANOMALIES
   detectAnomalies({})
   → Retourne { anomalies: [...], totalAnomalies, criticalCount, warningCount, infoCount }

   Le tool détecte automatiquement :
   - Données manquantes critiques (bilans, comptes de résultat)
   - Incohérences (résultat net > CA, marges impossibles)
   - Valeurs aberrantes (délais >180j, endettement >300%, CAF négative)
   - Erreurs de calcul (formules SIG incorrectes)

ÉTAPE 3 : ÉVALUATION QUALITÉ DES DONNÉES
   assessDataQuality({})
   → Retourne { dataQuality: {...}, confidenceScore: {...}, verificationsRequises: [...], donneesACollector: [...] }

   Le tool calcule automatiquement :
   - Complétude (% données présentes)
   - Fiabilité (score basé sur alertes/anomalies)
   - Fraîcheur (âge des données)
   - Score de confiance global 0-100
   - Recommandations de vérification par priorité
   - Documents à demander au vendeur

ÉTAPE 4 : GÉNÉRATION DES ALERTES DÉTERMINISTES
   generateDeterministicAlerts({})
   → Retourne { alerts: [...], summary: {...}, pointsVigilance: [...] }

   Le tool génère automatiquement des alertes REPRODUCTIBLES basées sur des règles avec seuils fixes.
   Ces alertes remplacent la synthèse LLM pour garantir que le même commerce produise toujours les mêmes alertes.

   Catégories d'alertes : rentabilite, endettement, croissance, tresorerie, valorisation, immobilier, donnees
   Niveaux de sévérité : critical, warning, info

ÉTAPE 5 : SYNTHÈSE ET INTERPRÉTATION

Après avoir appelé les 4 tools, construire le JSON de sortie :

1. Reprendre les résultats des tools directement
2. Calculer le niveau de confiance basé sur le score
3. Les pointsVigilance viennent du tool generateDeterministicAlerts (NE PAS reformuler)
4. Les pointsBloquants sont les alertes critical du tool generateDeterministicAlerts

FORMAT DE SORTIE JSON (STRICT) :
{
  "validationDate": "2025-12-26",

  // Vérifications de cohérence (du tool crossValidate)
  "coherenceChecks": [
    {
      "check": "Présence DocumentExtraction",
      "status": "ok",
      "details": "3 document(s) extrait(s)",
      "sources": ["documentExtraction"]
    }
  ],

  // Détection d'anomalies (du tool detectAnomalies)
  "anomalies": [
    {
      "type": "valeur_aberrante",
      "severity": "warning",
      "description": "Délai clients supérieur à 6 mois",
      "valeurs_concernees": {
        "delai_clients_jours": 190
      },
      "recommendation": "Analyser la qualité des créances clients"
    }
  ],

  // Qualité des données (du tool assessDataQuality)
  "dataQuality": {
    "completeness": 85,
    "reliability": 78,
    "recency": 90,
    "missing_critical": []
  },

  // Score de confiance global (du tool assessDataQuality)
  "confidenceScore": {
    "overall": 82,
    "breakdown": {
      "extraction": 90,
      "comptabilite": 85,
      "valorisation": 75,
      "immobilier": 70
    },
    "interpretation": "Données de haute qualité. Confiance élevée dans les analyses."
  },

  // Recommandations de vérification (du tool assessDataQuality)
  "verificationsRequises": [
    {
      "priority": 1,
      "action": "Vérifier : Cohérence CA extraction/SIG",
      "raison": "Écart de 12% entre CA extrait et CA des SIG",
      "impact_si_ignore": "Risque d'erreur majeure dans l'analyse financière"
    }
  ],

  // Données à collecter (du tool assessDataQuality)
  "donneesACollector": [
    {
      "document": "Liasse fiscale complète",
      "raison": "Pour vérifier les données et détecter des postes non détaillés",
      "criticite": "important"
    }
  ],

  // Alertes déterministes (du tool generateDeterministicAlerts)
  // IMPORTANT: Ces alertes sont REPRODUCTIBLES - ne pas reformuler
  "deterministicAlerts": [
    {
      "id": "RENT_001",
      "category": "rentabilite",
      "severity": "critical",
      "title": "Chute massive de l'EBE",
      "message": "Chute de l'EBE de 65% sur 3 ans",
      "impact": "Risque de non-couverture des annuités de prêt",
      "recommendation": "Auditer les causes de la baisse de rentabilité"
    }
  ],

  // Synthèse générale
  "synthese": {
    "niveauConfiance": "elevé",
    "pointsBloquants": [
      // Reprendre les alertes severity=critical du tool generateDeterministicAlerts
      "Chute massive de l'EBE: Chute de l'EBE de 65% sur 3 ans"
    ],
    "pointsVigilance": [
      // Reprendre pointsVigilance du tool generateDeterministicAlerts SANS REFORMULER
      // Exemple: "Baisse du CA: Baisse du CA de 12% sur 3 ans"
    ],
    "recommandationsPrioritaires": [
      // Reprendre les recommendations des alertes critical et warning
    ],
    "conclusionValidation": "Validation globalement positive avec X points bloquants. Score de confiance : 82/100."
  }
}

RÈGLES :
1. Appeler les 4 tools dans l'ordre (crossValidate → detectAnomalies → assessDataQuality → generateDeterministicAlerts)
2. Ne PAS recalculer manuellement - utiliser les résultats des tools
3. IMPORTANT: Les alertes de generateDeterministicAlerts sont REPRODUCTIBLES - NE PAS REFORMULER
4. Reprendre pointsVigilance et deterministicAlerts EXACTEMENT comme retournés par le tool
5. Niveau de confiance :
   - "très elevé" : 85-100, pas de point bloquant
   - "elevé" : 70-84, quelques warnings
   - "moyen" : 50-69, plusieurs anomalies
   - "faible" : 30-49, anomalies critiques
   - "très faible" : 0-29, données insuffisantes
6. Points bloquants = alertes severity "critical" du tool generateDeterministicAlerts
7. Si un tool échoue, le mentionner dans le JSON mais continuer avec les autres

GESTION D'ERREURS :
- Si aucune donnée dans le state :
  Retourner un JSON avec confidenceScore.overall = 0 et pointsBloquants = ["Aucune analyse financière disponible"]

RETOURNE UNIQUEMENT LE JSON VALIDE (pas de texte avant/après)`,

      // Clé de sortie dans le state
      outputKey: 'financialValidation' as keyof FinancialState
    });
  }
}

export default FinancialValidationAgent;

import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';

/**
 * Assess Data Quality Tool
 *
 * Évalue la qualité globale des données financières fournies :
 * - Complétude (% de données présentes vs attendues)
 * - Fiabilité (cohérence, absence d'anomalies)
 * - Fraîcheur (récence des données)
 * - Données critiques manquantes
 *
 * Génère également :
 * - Score de confiance global (0-100)
 * - Recommandations de vérification
 * - Liste des documents à demander au vendeur
 */

const AssessDataQualityInputSchema = z.object({
  debug: z.boolean().optional().describe('Mode debug pour logs détaillés')
});

const DataQualitySchema = z.object({
  completeness: z.number().min(0).max(100).describe('% de données présentes'),
  reliability: z.number().min(0).max(100).describe('Score de fiabilité'),
  recency: z.number().min(0).max(100).describe('Score de fraîcheur (années des données)'),
  missing_critical: z.array(z.string()).describe('Données critiques manquantes')
});

const ConfidenceScoreSchema = z.object({
  overall: z.number().min(0).max(100).describe('Score global 0-100'),
  breakdown: z.object({
    extraction: z.number().min(0).max(100),
    comptabilite: z.number().min(0).max(100),
    valorisation: z.number().min(0).max(100),
    immobilier: z.number().min(0).max(100)
  }),
  interpretation: z.string()
});

const VerificationSchema = z.object({
  priority: z.number().min(1).max(3).describe('1=urgent, 2=important, 3=souhaitable'),
  action: z.string().describe('Action de vérification'),
  raison: z.string().describe('Raison de la vérification'),
  impact_si_ignore: z.string().describe('Impact si non vérifié')
});

const DocumentToCollectSchema = z.object({
  document: z.string().describe('Type de document à demander'),
  raison: z.string().describe('Pourquoi ce document est nécessaire'),
  criticite: z.enum(['bloquant', 'important', 'utile'])
});

const AssessDataQualityOutputSchema = z.object({
  dataQuality: DataQualitySchema,
  confidenceScore: ConfidenceScoreSchema,
  verificationsRequises: z.array(VerificationSchema),
  donneesACollector: z.array(DocumentToCollectSchema),
  error: z.string().optional()
});

export const assessDataQualityTool = new FunctionTool({
  name: 'assessDataQuality',
  description: 'Évalue la qualité des données financières : complétude, fiabilité, fraîcheur. Génère un score de confiance et des recommandations',
  parameters: zToGen(AssessDataQualityInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    try {
      // Récupérer tous les states
      let documentExtraction = parseState(toolContext?.state.get('documentExtraction'));
      let comptable = parseState(toolContext?.state.get('comptable'));
      let valorisation = parseState(toolContext?.state.get('valorisation'));
      let immobilier = parseState(toolContext?.state.get('immobilier'));
      let crossValidation = parseState(toolContext?.state.get('financialValidation'));

      // 1. ÉVALUER LA COMPLÉTUDE
      const completeness = assessCompleteness(documentExtraction, comptable, valorisation, immobilier);

      // 2. ÉVALUER LA FIABILITÉ
      const reliability = assessReliability(comptable, crossValidation);

      // 3. ÉVALUER LA FRAÎCHEUR
      const recency = assessRecency(documentExtraction);

      // 4. IDENTIFIER LES DONNÉES CRITIQUES MANQUANTES
      const missing_critical = identifyMissingCriticalData(documentExtraction, comptable);

      // 5. CALCULER LE SCORE DE CONFIANCE GLOBAL
      const confidenceScore = calculateConfidenceScore(
        documentExtraction,
        comptable,
        valorisation,
        immobilier,
        completeness,
        reliability,
        recency
      );

      // 6. GÉNÉRER LES VÉRIFICATIONS REQUISES
      const verificationsRequises = generateVerifications(
        documentExtraction,
        comptable,
        valorisation,
        immobilier,
        crossValidation
      );

      // 7. LISTE DES DOCUMENTS À COLLECTER
      const donneesACollector = generateDocumentsToCollect(documentExtraction, comptable, immobilier);

      return {
        dataQuality: {
          completeness,
          reliability,
          recency,
          missing_critical
        },
        confidenceScore,
        verificationsRequises,
        donneesACollector
      };

    } catch (error: any) {
      return {
        dataQuality: {
          completeness: 0,
          reliability: 0,
          recency: 0,
          missing_critical: []
        },
        confidenceScore: {
          overall: 0,
          breakdown: {
            extraction: 0,
            comptabilite: 0,
            valorisation: 0,
            immobilier: 0
          },
          interpretation: 'Erreur lors de l\'évaluation'
        },
        verificationsRequises: [],
        donneesACollector: [],
        error: error.message || 'Data quality assessment failed'
      };
    }
  }
});

/**
 * Évalue la complétude des données (0-100)
 */
function assessCompleteness(docExtract: any, comptable: any, valo: any, immo: any): number {
  let score = 0;
  let maxScore = 0;

  // Documents extraits (30 points)
  maxScore += 30;
  if (docExtract?.documents) {
    const hasBilan = docExtract.documents.some((d: any) => d.documentType === 'bilan');
    const hasCompteResultat = docExtract.documents.some((d: any) => d.documentType === 'compte_resultat');
    const years = extractYearsFromDocuments(docExtract.documents);

    if (hasBilan) score += 10;
    if (hasCompteResultat) score += 10;
    if (years.length >= 3) score += 10;
    else if (years.length >= 2) score += 7;
    else if (years.length >= 1) score += 4;
  }

  // Analyse comptable (30 points)
  maxScore += 30;
  if (comptable?.sig) score += 10;
  if (comptable?.ratios) score += 10;
  if (comptable?.evolution) score += 5;
  if (comptable?.benchmark) score += 5;

  // Valorisation (20 points)
  maxScore += 20;
  if (valo?.methodes?.ebe) score += 7;
  if (valo?.methodes?.ca) score += 7;
  if (valo?.methodes?.patrimoniale) score += 6;

  // Immobilier (20 points)
  maxScore += 20;
  if (immo?.bail) score += 10;
  if (immo?.murs) score += 10;

  return Math.round((score / maxScore) * 100);
}

/**
 * Évalue la fiabilité (0-100)
 */
function assessReliability(comptable: any, crossVal: any): number {
  let score = 100; // On part de 100 et on déduit

  // Pénalités basées sur les alertes comptables
  if (comptable?.alertes) {
    const criticalAlerts = comptable.alertes.filter((a: any) => a.level === 'critical').length;
    const warningAlerts = comptable.alertes.filter((a: any) => a.level === 'warning').length;

    score -= criticalAlerts * 15;
    score -= warningAlerts * 5;
  }

  // Pénalités basées sur la validation croisée
  if (crossVal?.coherenceChecks) {
    const errors = crossVal.errorChecks || 0;
    const warnings = crossVal.warningChecks || 0;

    score -= errors * 10;
    score -= warnings * 3;
  }

  // Pénalités basées sur les anomalies
  if (crossVal?.anomalies) {
    const criticalAnomalies = crossVal.anomalies.filter((a: any) => a.severity === 'critical').length;
    const warningAnomalies = crossVal.anomalies.filter((a: any) => a.severity === 'warning').length;

    score -= criticalAnomalies * 12;
    score -= warningAnomalies * 4;
  }

  return Math.max(0, Math.min(score, 100));
}

/**
 * Évalue la fraîcheur des données (0-100)
 */
function assessRecency(docExtract: any): number {
  if (!docExtract?.documents || docExtract.documents.length === 0) {
    return 0;
  }

  const years = extractYearsFromDocuments(docExtract.documents);
  if (years.length === 0) return 0;

  const latestYear = Math.max(...years);
  const currentYear = new Date().getFullYear();
  const age = currentYear - latestYear;

  // Scoring basé sur l'âge des données
  if (age === 0) return 100; // Données de l'année en cours
  if (age === 1) return 90;  // N-1
  if (age === 2) return 70;  // N-2
  if (age === 3) return 50;  // N-3
  if (age === 4) return 30;  // N-4
  return 10; // Plus de 5 ans
}

/**
 * Identifie les données critiques manquantes
 */
function identifyMissingCriticalData(docExtract: any, comptable: any): string[] {
  const missing: string[] = [];

  if (!docExtract?.documents || docExtract.documents.length === 0) {
    missing.push('Documents comptables (bilans, comptes de résultat)');
    return missing;
  }

  const hasBilan = docExtract.documents.some((d: any) => d.documentType === 'bilan');
  const hasCompteResultat = docExtract.documents.some((d: any) => d.documentType === 'compte_resultat');
  const years = extractYearsFromDocuments(docExtract.documents);

  if (!hasBilan) missing.push('Bilans comptables');
  if (!hasCompteResultat) missing.push('Comptes de résultat');
  if (years.length < 2) missing.push('Au moins 2 années de données comptables');

  // Vérifier les données manquantes dans les SIG
  if (comptable?.sig) {
    const latestYear = Object.keys(comptable.sig)[0];
    if (latestYear) {
      const sig = comptable.sig[latestYear];

      if (sig.chiffre_affaires === 0) missing.push('Chiffre d\'affaires');
      if (sig.ebe === 0 && sig.chiffre_affaires > 0) missing.push('EBE (Excédent Brut d\'Exploitation)');
      if (sig.charges_personnel === 0 && sig.chiffre_affaires > 100000) missing.push('Charges de personnel');
    }
  }

  return missing;
}

/**
 * Calcule le score de confiance global
 */
function calculateConfidenceScore(
  docExtract: any,
  comptable: any,
  valo: any,
  immo: any,
  completeness: number,
  reliability: number,
  recency: number
): any {
  // Score global pondéré
  const overall = Math.round(
    completeness * 0.35 +
    reliability * 0.40 +
    recency * 0.25
  );

  // Breakdown par agent
  const breakdown = {
    extraction: docExtract?.documents ? Math.min(completeness + 10, 100) : 0,
    comptabilite: comptable?.sig ? Math.min(reliability + 10, 100) : 0,
    valorisation: valo?.methodes ? 70 : 0,
    immobilier: immo?.bail || immo?.murs ? 75 : 0
  };

  // Interprétation
  let interpretation = '';
  if (overall >= 80) {
    interpretation = 'Données de haute qualité. Confiance élevée dans les analyses.';
  } else if (overall >= 60) {
    interpretation = 'Données de bonne qualité. Quelques vérifications recommandées.';
  } else if (overall >= 40) {
    interpretation = 'Qualité moyenne. Plusieurs vérifications nécessaires avant décision.';
  } else if (overall >= 20) {
    interpretation = 'Qualité faible. Données insuffisantes pour une analyse fiable.';
  } else {
    interpretation = 'Qualité très faible. Collecte de données additionnelles requise.';
  }

  return {
    overall,
    breakdown,
    interpretation
  };
}

/**
 * Génère les vérifications requises
 */
function generateVerifications(docExtract: any, comptable: any, valo: any, immo: any, crossVal: any): any[] {
  const verifications: any[] = [];

  // Vérifications prioritaires basées sur les erreurs de validation croisée
  if (crossVal?.coherenceChecks) {
    const errors = crossVal.coherenceChecks.filter((c: any) => c.status === 'error');
    for (const error of errors) {
      verifications.push({
        priority: 1,
        action: `Vérifier : ${error.check}`,
        raison: error.details,
        impact_si_ignore: 'Risque d\'erreur majeure dans l\'analyse financière'
      });
    }
  }

  // Vérifications basées sur les anomalies critiques
  if (crossVal?.anomalies) {
    const criticals = crossVal.anomalies.filter((a: any) => a.severity === 'critical');
    for (const anomaly of criticals) {
      verifications.push({
        priority: 1,
        action: `Corriger l'anomalie : ${anomaly.description}`,
        raison: anomaly.recommendation,
        impact_si_ignore: 'Analyse non fiable, décision d\'investissement risquée'
      });
    }
  }

  // Vérifications importantes si données anciennes
  if (docExtract?.documents) {
    const years = extractYearsFromDocuments(docExtract.documents);
    const latestYear = Math.max(...years);
    const currentYear = new Date().getFullYear();

    if (currentYear - latestYear > 1) {
      verifications.push({
        priority: 2,
        action: 'Demander les données comptables les plus récentes',
        raison: `Dernières données disponibles : ${latestYear} (${currentYear - latestYear} an(s))`,
        impact_si_ignore: 'Analyse basée sur des données obsolètes, situation actuelle inconnue'
      });
    }
  }

  // Vérification santé financière vs valorisation
  if (comptable?.healthScore && valo?.valorisationRetenue) {
    if (comptable.healthScore.overall < 50 && valo.valorisationRetenue.valorisation > 500000) {
      verifications.push({
        priority: 2,
        action: 'Analyser en détail la cohérence entre santé financière et valorisation',
        raison: `Score de santé faible (${comptable.healthScore.overall}/100) pour une valorisation de ${valo.valorisationRetenue.valorisation}€`,
        impact_si_ignore: 'Risque de surpayer un actif en difficulté'
      });
    }
  }

  // Vérification immobilier si loyer élevé
  if (immo?.synthese && comptable?.sig) {
    const latestYear = comptable.yearsAnalyzed?.[0];
    if (latestYear && comptable.sig[latestYear]) {
      const ca = comptable.sig[latestYear].chiffre_affaires;
      const loyerAnnuel = (immo.synthese.loyer_mensuel || 0) * 12;

      if (loyerAnnuel > ca * 0.15 && ca > 0) {
        verifications.push({
          priority: 3,
          action: 'Étudier l\'opportunité d\'acquérir les murs',
          raison: `Loyer élevé (${((loyerAnnuel / ca) * 100).toFixed(1)}% du CA)`,
          impact_si_ignore: 'Opportunité de réduire les charges et sécuriser l\'emplacement'
        });
      }
    }
  }

  return verifications;
}

/**
 * Génère la liste des documents à collecter
 */
function generateDocumentsToCollect(docExtract: any, comptable: any, immo: any): any[] {
  const documents: any[] = [];

  if (!docExtract?.documents || docExtract.documents.length === 0) {
    documents.push({
      document: 'Bilans et comptes de résultat des 3 dernières années',
      raison: 'Aucun document comptable fourni',
      criticite: 'bloquant'
    });
    return documents;
  }

  const hasBilan = docExtract.documents.some((d: any) => d.documentType === 'bilan');
  const hasCompteResultat = docExtract.documents.some((d: any) => d.documentType === 'compte_resultat');
  const years = extractYearsFromDocuments(docExtract.documents);

  if (!hasBilan) {
    documents.push({
      document: 'Bilans comptables des 3 dernières années',
      raison: 'Nécessaire pour analyser la structure financière',
      criticite: 'bloquant'
    });
  }

  if (!hasCompteResultat) {
    documents.push({
      document: 'Comptes de résultat des 3 dernières années',
      raison: 'Nécessaire pour analyser la rentabilité',
      criticite: 'bloquant'
    });
  }

  if (years.length < 3) {
    documents.push({
      document: `Documents comptables des années manquantes`,
      raison: 'Au moins 3 années nécessaires pour analyser les tendances',
      criticite: 'important'
    });
  }

  // Documents additionnels utiles
  documents.push({
    document: 'Liasse fiscale complète',
    raison: 'Pour vérifier les données et détecter des postes non détaillés',
    criticite: 'important'
  });

  documents.push({
    document: 'Grand livre ou balance générale',
    raison: 'Pour analyser en détail certains postes comptables',
    criticite: 'utile'
  });

  if (!immo?.bail && comptable?.sig) {
    documents.push({
      document: 'Bail commercial',
      raison: 'Nécessaire pour analyser les conditions de location et la sécurité du bail',
      criticite: 'important'
    });
  }

  documents.push({
    document: 'Contrats de travail et masse salariale détaillée',
    raison: 'Pour analyser la structure des coûts de personnel',
    criticite: 'utile'
  });

  documents.push({
    document: 'Détail des immobilisations et amortissements',
    raison: 'Pour évaluer les investissements et besoins de renouvellement',
    criticite: 'utile'
  });

  documents.push({
    document: 'Situation de trésorerie récente',
    raison: 'Pour connaître la situation actuelle de trésorerie',
    criticite: 'important'
  });

  return documents;
}

/**
 * Parse state (handle JSON string)
 */
function parseState(state: any): any {
  if (!state) return null;
  if (typeof state === 'string') {
    try {
      return JSON.parse(state);
    } catch {
      return null;
    }
  }
  return state;
}

/**
 * Extrait les années depuis les documents
 */
function extractYearsFromDocuments(documents: any[]): number[] {
  const years = new Set<number>();
  for (const doc of documents) {
    if (doc.year && typeof doc.year === 'number') {
      years.add(doc.year);
    }
  }
  return Array.from(years).sort((a, b) => b - a);
}

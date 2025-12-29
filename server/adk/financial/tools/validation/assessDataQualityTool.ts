import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';
import type { DataField, DataCompleteness, DataCompletenessReport, PriorityDocument } from '../../schemas/dataCompletenessSchema';
import { EXTRACTION_EXPECTED_FIELDS, IMMOBILIER_EXPECTED_FIELDS, SECTION_MAX_SCORES } from '../../schemas/dataCompletenessSchema';

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

      // 8. TRACKING DÉTAILLÉ DES DONNÉES MANQUANTES
      const dataCompleteness = buildDataCompletenessReport(
        documentExtraction,
        comptable,
        valorisation,
        immobilier,
        confidenceScore
      );

      return {
        dataQuality: {
          completeness,
          reliability,
          recency,
          missing_critical
        },
        confidenceScore,
        verificationsRequises,
        donneesACollector,
        dataCompleteness
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
  // Support BOTH structures (backward compatibility)
  const methodes = valo?.methodes || {
    ebe: valo?.methodeEBE,
    ca: valo?.methodeCA,
    patrimoniale: valo?.methodePatrimoniale
  };
  if (methodes?.ebe) score += 7;
  if (methodes?.ca) score += 7;
  if (methodes?.patrimoniale) score += 6;

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

  // Détection améliorée - accepter plusieurs patterns
  const hasBilan = docExtract.documents.some((d: any) =>
    d.documentType === 'bilan' ||
    d.documentType === 'liasse_fiscale' ||
    (d.filename && (
      d.filename.toLowerCase().includes('bilan') ||
      d.filename.toLowerCase().includes('liasse')
    )) ||
    // Si le document contient des tableaux avec "ACTIF" et "PASSIF"
    (d.tables && d.tables.some((t: any) =>
      JSON.stringify(t).toLowerCase().includes('actif') &&
      JSON.stringify(t).toLowerCase().includes('passif')
    )) ||
    // Si extractedData contient des tableaux avec ACTIF/PASSIF
    (d.extractedData?.tables && d.extractedData.tables.some((t: any) =>
      JSON.stringify(t).toLowerCase().includes('actif') &&
      JSON.stringify(t).toLowerCase().includes('passif')
    ))
  );

  const hasCompteResultat = docExtract.documents.some((d: any) =>
    d.documentType === 'compte_resultat' ||
    d.documentType === 'liasse_fiscale' ||
    (d.filename && (
      d.filename.toLowerCase().includes('compte') ||
      d.filename.toLowerCase().includes('resultat')
    )) ||
    // Si le document contient des tableaux avec "CHARGES" et "PRODUITS"
    (d.tables && d.tables.some((t: any) =>
      JSON.stringify(t).toLowerCase().includes('charges') &&
      JSON.stringify(t).toLowerCase().includes('produits')
    )) ||
    // Si extractedData contient des tableaux avec CHARGES/PRODUITS
    (d.extractedData?.tables && d.extractedData.tables.some((t: any) =>
      JSON.stringify(t).toLowerCase().includes('charges') &&
      JSON.stringify(t).toLowerCase().includes('produits')
    ))
  );

  const years = extractYearsFromDocuments(docExtract.documents);

  // NOUVEAU : Vérifier aussi si les SIG sont complets (signe que les docs sont là)
  const sigComplets = comptable?.sig && Object.keys(comptable.sig).length > 0;

  if (!hasBilan && !sigComplets) missing.push('Bilans comptables détaillés');
  if (!hasCompteResultat && !sigComplets) missing.push('Comptes de résultat complets');
  if (years.length < 2 && !sigComplets) missing.push('Au moins 2 années de données comptables');

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
    valorisation: (() => {
      if (!valo) return 0;

      let score = 0;
      // +30 par méthode réussie (EBE prioritaire)
      if (valo.methodeEBE && valo.methodeEBE.valeur_mediane > 0) score += 30;
      if (valo.methodeCA && valo.methodeCA.valeur_mediane > 0) score += 25;
      if (valo.methodePatrimoniale && valo.methodePatrimoniale.valeur_estimee > 0) score += 20;

      // +25 si synthèse présente
      if (valo.synthese && valo.synthese.valeur_recommandee > 0) score += 25;

      return Math.min(score, 100);
    })(),
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

// ============================================================================
// DATA COMPLETENESS TRACKING FUNCTIONS
// ============================================================================

/**
 * Build completeness report for "Extraction Données" section
 */
function buildExtractionCompletenessSection(
  docExtract: any,
  comptable: any
): DataCompleteness {
  const presentFields: DataField[] = [];
  const missingFields: DataField[] = [];
  const partialFields: DataField[] = [];
  let score = 0;

  // Get years from documents
  const years = docExtract?.documents ? extractYearsFromDocuments(docExtract.documents) : [];
  const sortedYears = [...years].sort((a, b) => b - a);
  const latestYear = sortedYears[0];
  const previousYear = sortedYears[1];
  const oldestYear = sortedYears[2];

  // Helper to find document source
  const findDocSource = (docType: string, year?: number): string | undefined => {
    if (!docExtract?.documents) return undefined;
    const doc = docExtract.documents.find((d: any) => {
      const typeMatch = d.documentType === docType || d.documentType === 'liasse_fiscale';
      const yearMatch = year ? d.year === year : true;
      return typeMatch && yearMatch;
    });
    return doc?.filename;
  };

  // Check for liasse_fiscale (combined document)
  const hasLiasseFiscale = docExtract?.documents?.some((d: any) => d.documentType === 'liasse_fiscale');

  // Process each expected field
  for (const fieldDef of EXTRACTION_EXPECTED_FIELDS) {
    const field: DataField = {
      name: fieldDef.name,
      label: fieldDef.label,
      status: 'missing',
      impact: fieldDef.impact
    };

    // Check presence based on field type
    switch (fieldDef.name) {
      case 'bilan_n':
        if (hasLiasseFiscale || findDocSource('bilan', latestYear)) {
          field.status = 'present';
          field.source = findDocSource('bilan', latestYear) || findDocSource('liasse_fiscale', latestYear);
          score += fieldDef.impact;
        }
        break;

      case 'bilan_n1':
        if (previousYear && (hasLiasseFiscale || findDocSource('bilan', previousYear))) {
          field.status = 'present';
          field.source = findDocSource('bilan', previousYear) || findDocSource('liasse_fiscale', previousYear);
          score += fieldDef.impact;
        }
        break;

      case 'bilan_n2':
        if (oldestYear && (hasLiasseFiscale || findDocSource('bilan', oldestYear))) {
          field.status = 'present';
          field.source = findDocSource('bilan', oldestYear) || findDocSource('liasse_fiscale', oldestYear);
          score += fieldDef.impact;
        }
        break;

      case 'compte_resultat_n':
        if (hasLiasseFiscale || findDocSource('compte_resultat', latestYear)) {
          field.status = 'present';
          field.source = findDocSource('compte_resultat', latestYear) || findDocSource('liasse_fiscale', latestYear);
          score += fieldDef.impact;
        } else if (comptable?.sig && comptable.sig[latestYear]?.chiffre_affaires > 0) {
          field.status = 'partial';
          field.details = 'Données extraites des SIG (document non identifié)';
          score += Math.floor(fieldDef.impact / 2);
        }
        break;

      case 'compte_resultat_n1':
        if (previousYear && (hasLiasseFiscale || findDocSource('compte_resultat', previousYear))) {
          field.status = 'present';
          field.source = findDocSource('compte_resultat', previousYear) || findDocSource('liasse_fiscale', previousYear);
          score += fieldDef.impact;
        } else if (previousYear && comptable?.sig?.[previousYear]?.chiffre_affaires > 0) {
          field.status = 'partial';
          field.details = 'Données extraites des SIG';
          score += Math.floor(fieldDef.impact / 2);
        }
        break;

      case 'liasse_fiscale':
        if (hasLiasseFiscale) {
          field.status = 'present';
          field.source = docExtract.documents.find((d: any) => d.documentType === 'liasse_fiscale')?.filename;
          score += fieldDef.impact;
        }
        break;

      case 'detail_immobilisations':
        // Check if immobilisations data exists in extracted key_values
        const hasImmoData = docExtract?.documents?.some((d: any) =>
          d.extractedData?.key_values?.immobilisations_corporelles !== undefined ||
          d.extractedData?.key_values?.immobilisations_incorporelles !== undefined
        );
        if (hasImmoData) {
          field.status = 'partial';
          field.details = 'Données partielles extraites du bilan';
          score += Math.floor(fieldDef.impact / 2);
        }
        break;

      case 'etat_stocks':
        // Check if stock data exists
        const hasStockData = comptable?.sig && Object.values(comptable.sig).some((sig: any) =>
          sig.variation_stocks !== undefined && sig.variation_stocks !== 0
        );
        if (hasStockData) {
          field.status = 'partial';
          field.details = 'Variation de stock uniquement (pas de détail)';
          score += Math.floor(fieldDef.impact / 2);
        }
        break;

      case 'masse_salariale':
        // Check if personnel charges exist
        const hasSalaryData = comptable?.sig && Object.values(comptable.sig).some((sig: any) =>
          sig.charges_personnel > 0
        );
        if (hasSalaryData) {
          field.status = 'partial';
          field.details = 'Total charges personnel (pas de détail individuel)';
          score += Math.floor(fieldDef.impact / 2);
        }
        break;

      // These are typically not extracted automatically
      case 'contrats_fournisseurs':
      case 'releves_bancaires':
        // Stay as missing
        break;
    }

    // Categorize field
    if (field.status === 'present') {
      presentFields.push(field);
    } else if (field.status === 'partial') {
      partialFields.push(field);
    } else {
      missingFields.push(field);
    }
  }

  // Generate recommendations
  const recommendations: string[] = [];

  if (missingFields.some(f => f.name.includes('bilan') && f.name !== 'bilan_n2')) {
    recommendations.push('Demander au cédant les bilans comptables des 3 dernières années');
  }

  if (missingFields.find(f => f.name === 'liasse_fiscale') && !hasLiasseFiscale) {
    recommendations.push('Obtenir la liasse fiscale certifiée par expert-comptable');
  }

  if (missingFields.find(f => f.name === 'detail_immobilisations')) {
    recommendations.push('Demander le tableau des immobilisations et amortissements');
  }

  if (missingFields.find(f => f.name === 'etat_stocks')) {
    recommendations.push('Demander l\'inventaire des stocks valorisé');
  }

  if (missingFields.find(f => f.name === 'releves_bancaires')) {
    recommendations.push('Obtenir les relevés bancaires ou situation de trésorerie récente');
  }

  return {
    section: 'Extraction Données',
    sectionKey: 'documentExtraction',
    expectedFields: EXTRACTION_EXPECTED_FIELDS.map(f => ({ ...f, status: 'missing' as const })),
    presentFields,
    missingFields,
    partialFields,
    score: Math.round((score / SECTION_MAX_SCORES.extraction) * 100),
    maxScore: 100,
    recommendations
  };
}

/**
 * Build completeness report for "Analyse Immobilière" section
 */
function buildImmobilierCompletenessSection(
  immobilier: any,
  userComments: any
): DataCompleteness {
  const presentFields: DataField[] = [];
  const missingFields: DataField[] = [];
  const partialFields: DataField[] = [];
  let score = 0;

  // Check bail availability
  const hasBail = immobilier?.dataStatus?.bail_disponible || immobilier?.bail;

  for (const fieldDef of IMMOBILIER_EXPECTED_FIELDS) {
    const field: DataField = {
      name: fieldDef.name,
      label: fieldDef.label,
      status: 'missing',
      impact: fieldDef.impact
    };

    switch (fieldDef.name) {
      case 'bail_commercial':
        if (hasBail) {
          field.status = 'present';
          field.source = immobilier.dataStatus?.source || 'document bail';
          score += fieldDef.impact;
        } else if (userComments?.loyer) {
          field.status = 'partial';
          field.details = 'Loyer mentionné dans les commentaires utilisateur';
          score += Math.floor(fieldDef.impact / 3);
        }
        break;

      case 'bail_type':
        if (immobilier?.bail?.type) {
          field.status = 'present';
          score += fieldDef.impact;
        }
        break;

      case 'bail_loyer':
        if (immobilier?.bail?.loyer_annuel_hc > 0) {
          field.status = 'present';
          score += fieldDef.impact;
        } else if (userComments?.loyer?.loyer_negocie) {
          field.status = 'partial';
          field.details = `Loyer négocié mentionné: ${userComments.loyer.loyer_negocie}€/mois`;
          score += Math.floor(fieldDef.impact / 2);
        }
        break;

      case 'bail_charges':
        if (immobilier?.bail?.charges_annuelles !== undefined) {
          field.status = 'present';
          score += fieldDef.impact;
        }
        break;

      case 'bail_indexation':
        if (immobilier?.bail?.indexation) {
          field.status = 'present';
          score += fieldDef.impact;
        }
        break;

      case 'bail_date_renouvellement':
        if (immobilier?.bail?.date_fin || immobilier?.bail?.duree_restante_mois) {
          field.status = 'present';
          score += fieldDef.impact;
        }
        break;

      case 'bail_surface':
        if (immobilier?.bail?.surface_m2 > 0) {
          field.status = immobilier?.bail?.surface_verifiee ? 'present' : 'partial';
          if (field.status === 'partial') {
            field.details = 'Surface estimée, non vérifiée';
          }
          score += field.status === 'present' ? fieldDef.impact : Math.floor(fieldDef.impact / 2);
        }
        break;

      case 'diagnostic_amiante':
      case 'diagnostic_electricite':
      case 'diagnostic_dpe':
        // These are typically not extracted - check if travaux mentions diagnostics
        if (immobilier?.travaux?.diagnostics_disponibles) {
          field.status = 'present';
          score += fieldDef.impact;
        }
        break;

      case 'conformite_erp':
        if (immobilier?.travaux?.conformite_erp === 'conforme') {
          field.status = 'present';
          score += fieldDef.impact;
        } else if (immobilier?.travaux?.conformite_erp === 'a_verifier') {
          field.status = 'partial';
          field.details = 'À vérifier - diagnostic nécessaire';
          score += Math.floor(fieldDef.impact / 3);
        }
        break;

      case 'conformite_pmr':
        if (immobilier?.travaux?.accessibilite_pmr === true) {
          field.status = 'present';
          score += fieldDef.impact;
        } else if (immobilier?.travaux?.accessibilite_pmr === false) {
          field.status = 'partial';
          field.details = 'Non conforme - travaux à prévoir';
          score += Math.floor(fieldDef.impact / 3);
        }
        break;

      case 'travaux_realises':
        if (immobilier?.travaux?.travaux_recents) {
          field.status = 'present';
          score += fieldDef.impact;
        }
        break;

      case 'loyer_vs_marche':
        if (immobilier?.bail?.appreciation) {
          field.status = 'present';
          score += fieldDef.impact;
        }
        break;

      case 'proprietaire_type':
        if (immobilier?.bail?.proprietaire_type) {
          field.status = 'present';
          score += fieldDef.impact;
        }
        break;
    }

    // Categorize field
    if (field.status === 'present') {
      presentFields.push(field);
    } else if (field.status === 'partial') {
      partialFields.push(field);
    } else {
      missingFields.push(field);
    }
  }

  // Generate recommendations
  const recommendations: string[] = [];

  if (!hasBail) {
    recommendations.push('Demander au cédant le bail commercial original avec ses annexes');
  }

  if (missingFields.some(f => f.name.includes('diagnostic'))) {
    recommendations.push('Obtenir les diagnostics obligatoires (amiante, électricité, DPE)');
  }

  if (missingFields.find(f => f.name === 'conformite_erp')) {
    recommendations.push('Vérifier la conformité ERP auprès de la mairie/préfecture');
  }

  if (partialFields.find(f => f.name === 'bail_surface')) {
    recommendations.push('Vérifier la surface exacte via mesurage ou plan cadastral');
  }

  const maxPoints = IMMOBILIER_EXPECTED_FIELDS.reduce((sum, f) => sum + f.impact, 0);

  return {
    section: 'Analyse Immobilière',
    sectionKey: 'immobilier',
    expectedFields: IMMOBILIER_EXPECTED_FIELDS.map(f => ({ name: f.name, label: f.label, impact: f.impact, status: 'missing' as const })),
    presentFields,
    missingFields,
    partialFields,
    score: Math.round((score / maxPoints) * 100),
    maxScore: 100,
    recommendations
  };
}

/**
 * Build complete data completeness report
 */
function buildDataCompletenessReport(
  docExtract: any,
  comptable: any,
  valorisation: any,
  immobilier: any,
  confidenceScore: any
): DataCompletenessReport {
  // Build section reports
  const extractionSection = buildExtractionCompletenessSection(docExtract, comptable);
  const immobilierSection = buildImmobilierCompletenessSection(immobilier, null);

  const sections = [extractionSection, immobilierSection];

  // Calculate overall score from confidence breakdown
  const overallScore = confidenceScore?.overall || 0;
  const overallMaxScore = 100;

  // Build priority documents list based on missing fields
  const priorityDocuments: PriorityDocument[] = [];

  // High impact missing documents from extraction
  if (extractionSection.missingFields.some(f => f.name.includes('bilan'))) {
    const missingBilans = extractionSection.missingFields.filter(f => f.name.includes('bilan'));
    const totalImpact = missingBilans.reduce((sum, f) => sum + f.impact, 0);
    priorityDocuments.push({
      document: 'Bilans comptables N, N-1, N-2',
      criticite: 'bloquant',
      impact: totalImpact,
      section: 'Extraction Données'
    });
  }

  if (extractionSection.missingFields.find(f => f.name === 'liasse_fiscale')) {
    priorityDocuments.push({
      document: 'Liasse fiscale certifiée',
      criticite: 'important',
      impact: 4,
      section: 'Extraction Données'
    });
  }

  // High impact missing documents from immobilier
  if (immobilierSection.missingFields.find(f => f.name === 'bail_commercial')) {
    priorityDocuments.push({
      document: 'Bail commercial + annexes',
      criticite: 'bloquant',
      impact: 10,
      section: 'Analyse Immobilière'
    });
  }

  if (immobilierSection.missingFields.some(f => f.name.includes('diagnostic'))) {
    const missingDiags = immobilierSection.missingFields.filter(f => f.name.includes('diagnostic'));
    const totalImpact = missingDiags.reduce((sum, f) => sum + f.impact, 0);
    priorityDocuments.push({
      document: 'Diagnostics immobiliers (amiante, électricité, DPE)',
      criticite: 'important',
      impact: totalImpact,
      section: 'Analyse Immobilière'
    });
  }

  if (immobilierSection.missingFields.find(f => f.name === 'conformite_erp')) {
    priorityDocuments.push({
      document: 'Certificat conformité ERP',
      criticite: 'important',
      impact: 3,
      section: 'Analyse Immobilière'
    });
  }

  // Sort by impact descending
  priorityDocuments.sort((a, b) => b.impact - a.impact);

  return {
    sections,
    overallScore,
    overallMaxScore,
    priorityDocuments,
    generatedAt: new Date().toISOString()
  };
}

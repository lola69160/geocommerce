import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';
import * as fs from 'fs/promises';
import * as path from 'path';

// ========================================
// EXTRACTED MODULES (Phase 2 refactoring)
// ========================================

// Styles
import { generateCSS } from './styles';

// Helpers
import {
  parseState,
  generateHTMLHeader,
  generateFooter,
  generateStrategicCommentary
} from './helpers';

// Sections
import {
  generateCoverPage,
  generateAccountingSection,
  generateValuationSection,
  // generateRealEstateSection,  // ⚠️ MASQUÉ TEMPORAIREMENT (2026-01-01)
  generateBusinessPlanSection,
  generateOpportunitySection,
  generateFinancingPlanSection
} from './sections';

// Acquisition Advice
import {
  generateAcquisitionAdviceSection,
  parseProfessionalReport,
  detectHorairesExtension,
  type ProfessionalReportData
} from './acquisitionAdvice';

/**
 * Generate Financial HTML Tool
 *
 * Génère un rapport HTML professionnel complet et autonome pour l'analyse financière.
 *
 * 7 sections :
 * 1. Page de garde
 * 2. Synthèse exécutive
 * 3. Analyse comptable
 * 4. Valorisation du fonds
 * 5. Analyse immobilière
 * 6. Validation & fiabilité
 * 7. Annexes
 */

const GenerateFinancialHtmlInputSchema = z.object({
  charts: z.object({
    evolutionChart: z.any(),
    valorisationChart: z.any(),
    healthGauge: z.any(),
    confidenceRadar: z.any()
  }).describe('Configurations Chart.js générées par generateCharts')
});

const GenerateFinancialHtmlOutputSchema = z.object({
  html: z.string().describe('HTML complet du rapport'),
  sections_included: z.array(z.string()),
  error: z.string().optional()
});

export const generateFinancialHtmlTool = new FunctionTool({
  name: 'generateFinancialHtml',
  description: 'Génère le HTML complet du rapport financier avec 7 sections professionnelles',
  parameters: zToGen(GenerateFinancialHtmlInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    console.log('[generateFinancialHtml] 📄 Tool called');

    try {
      // Lire tous les states
      let businessInfo = parseState(toolContext?.state.get('businessInfo'));
      console.log('[generateFinancialHtml] businessInfo:', businessInfo?.name || 'MISSING');
      let documentExtraction = parseState(toolContext?.state.get('documentExtraction'));

      // ✅ DEBUG: Log raw state before parsing
      const rawComptable = toolContext?.state.get('comptable');
      console.log('[generateFinancialHtml] 🔍 RAW comptable state:', typeof rawComptable, rawComptable ? 'EXISTS' : 'NULL');
      if (rawComptable && typeof rawComptable === 'string') {
        console.log('[generateFinancialHtml] 🔍 RAW comptable (first 500 chars):', rawComptable.substring(0, 500));
      }

      let comptable = parseState(rawComptable);
      console.log('[generateFinancialHtml] 🔍 PARSED comptable:', comptable ? 'EXISTS' : 'NULL', comptable ? Object.keys(comptable) : 'N/A');
      if (comptable?.sig) {
        console.log('[generateFinancialHtml] 🔍 SIG years:', Object.keys(comptable.sig));
      }

      let valorisation = parseState(toolContext?.state.get('valorisation'));
      let immobilier = parseState(toolContext?.state.get('immobilier'));
      let businessPlan = parseState(toolContext?.state.get('businessPlan'));
      let financialValidation = parseState(toolContext?.state.get('financialValidation'));
      let options = parseState(toolContext?.state.get('options'));

      const sections_included: string[] = [];

      // Générer le HTML complet
      let html = generateHTMLHeader();
      html += generateCSS();
      html += '<body><div class="container">';

      // 1. Page de garde
      html += generateCoverPage(businessInfo, financialValidation);
      sections_included.push('cover_page');

      // 2. Synthèse exécutive (avec userComments pour afficher budget travaux et documentExtraction pour prix demandé)
      let userComments = parseState(toolContext?.state.get('userComments'));

      // 2a. Section Opportunité de Reprise (nouvelle section stratégique avec Gemini)
      const opportunityHtml = await generateOpportunitySection(
        comptable,
        valorisation,
        businessPlan,
        userComments,
        immobilier
      );
      html += opportunityHtml;
      sections_included.push('opportunity_section');

      // 2b. Suite de la synthèse exécutive (verdict, scores, points forts/vigilance)
      html += generateExecutiveSummary(comptable, valorisation, financialValidation, userComments, businessPlan, documentExtraction);
      sections_included.push('executive_summary');

      // 2ter. Commentaires stratégiques
      const strategicCommentaries = analyzeAndGenerateCommentaries(comptable, immobilier, userComments, businessInfo, valorisation, businessPlan);
      if (strategicCommentaries && strategicCommentaries.length > 0) {
        html += '<h2>💡 Commentaires Stratégiques</h2>';
        strategicCommentaries.forEach(commentary => {
          html += commentary;
        });
        sections_included.push('strategic_commentary');
      }

      // 3. Analyse comptable (with documentExtraction fallback for missing SIG values)
      html += generateAccountingSection(comptable, params.charts.evolutionChart, params.charts.healthGauge, params.charts.projectedHealthGauge, businessPlan, userComments, documentExtraction, businessInfo);
      sections_included.push('accounting_analysis');

      // 4. Valorisation (avec userComments et options pour section Tabac complète)
      html += generateValuationSection(valorisation, params.charts.valorisationChart, documentExtraction, userComments, options);
      sections_included.push('valuation');

      // 5. Analyse immobilière
      // ⚠️ MASQUÉ TEMPORAIREMENT (2026-01-01) - Peut être réactivé si besoin
      // if (immobilier) {
      //   html += generateRealEstateSection(immobilier);
      //   sections_included.push('real_estate');
      // }

      // 6. Business Plan Dynamique
      if (businessPlan && businessPlan.projections && businessPlan.projections.length > 0) {
        html += generateBusinessPlanSection(businessPlan);
        sections_included.push('business_plan');
      }

      // 6bis. Plan de Financement
      html += generateFinancingPlanSection(userComments, comptable);
      sections_included.push('financing_plan');

      // 7. Conseils pour le Rachat (enrichi avec rapport professionnel)
      // Extraire le SIREN depuis businessInfo
      const siret = businessInfo?.siret || '';
      const siren = siret.substring(0, 9);
      let professionalData: ProfessionalReportData | null = null;

      if (siren.length === 9) {
        try {
          professionalData = await parseProfessionalReport(siren);
          if (professionalData) {
            console.log('[generateFinancialHtml] ✅ Rapport professionnel chargé pour enrichissement');
          }
        } catch (e) {
          console.log('[generateFinancialHtml] ⚠️ Rapport professionnel non disponible');
        }
      }

      html += generateAcquisitionAdviceSection({
        comptable,
        valorisation,
        immobilier,
        businessInfo,
        userComments,
        businessPlan,
        professionalData
      });
      sections_included.push('acquisition_advice');

      // 7. Validation & fiabilité
      html += generateValidationSection(financialValidation, params.charts.confidenceRadar, comptable, immobilier, documentExtraction);
      sections_included.push('validation');

      // 8. Annexes
      html += generateAnnexes(documentExtraction, comptable, valorisation);
      sections_included.push('annexes');

      // Footer
      html += generateFooter();

      html += '</div></body></html>';

      console.log('[generateFinancialHtml] ✅ HTML generated successfully, length:', html.length);
      console.log('[generateFinancialHtml] Sections included:', sections_included.join(', '));

      // ========================================
      // SAUVEGARDE DIRECTE DU FICHIER (évite de passer le HTML entre tools)
      // ========================================
      try {
        const reportsDir = path.join(process.cwd(), 'data', 'financial-reports');
        await fs.mkdir(reportsDir, { recursive: true });

        // Générer le nom de fichier avec timestamp
        const timestamp = new Date()
          .toISOString()
          .replace(/[:\-]/g, '')
          .replace(/\..+/, '')
          .replace('T', '_');

        // Récupérer businessId depuis le state
        const businessId = businessInfo?.siret || businessInfo?.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'commerce';
        const filename = `${timestamp}_financial-report-${businessId}.html`;
        const filepath = path.join(reportsDir, filename);

        // Écrire le fichier
        await fs.writeFile(filepath, html, 'utf-8');
        const stats = await fs.stat(filepath);

        const reportResult = {
          generated: true,
          filepath,
          filename,
          size_bytes: stats.size,
          sections_included,
          generatedAt: new Date().toISOString()
        };

        console.log('[generateFinancialHtml] 📁 Report saved:', filename);

        // INJECTER DANS LE STATE pour que financialReport soit PRESENT
        if (toolContext?.state) {
          toolContext.state.set('financialReport', reportResult);
          console.log('[generateFinancialHtml] ✅ financialReport injected into state');
        }

        return {
          html: `[HTML saved to file: ${filename}]`, // Retourne un placeholder court
          sections_included,
          saved: true,
          filepath,
          filename
        };

      } catch (saveError: any) {
        console.error('[generateFinancialHtml] ❌ Error saving file:', saveError.message);
        // Retourner le HTML quand même pour que saveFinancialReport puisse réessayer
        return {
          html,
          sections_included,
          saved: false,
          saveError: saveError.message
        };
      }

    } catch (error: any) {
      console.error('[generateFinancialHtml] ❌ Error:', error.message);
      return {
        html: '<html><body><h1>Erreur de génération du rapport</h1></body></html>',
        sections_included: [],
        error: error.message || 'HTML generation failed'
      };
    }
  }
});

// ========================================
// FUNCTIONS NOT YET EXTRACTED
// (These functions will be extracted to separate modules in a future refactoring)
// ========================================

/**
 * Génère la synthèse exécutive
 */
function generateExecutiveSummary(comptable: any, valorisation: any, financialValidation: any, userComments?: any, businessPlan?: any, documentExtraction?: any): string {
  // Extraction du prix demandé par le vendeur (transactionCosts)
  const transactionCosts = documentExtraction?.transactionCosts;
  const prixDemande = transactionCosts?.prix_fonds || 0;
  const healthScore = comptable?.healthScore?.overall || 0;
  const confidenceScore = financialValidation?.confidenceScore?.overall || 0;

  // Déterminer le verdict
  let verdict = 'DÉFAVORABLE';
  let verdictClass = 'defavorable';
  if (healthScore >= 70 && confidenceScore >= 70) {
    verdict = 'FAVORABLE';
    verdictClass = 'favorable';
  } else if (healthScore >= 50 && confidenceScore >= 50) {
    verdict = 'FAVORABLE AVEC RÉSERVES';
    verdictClass = 'reserves';
  }

  // Fourchette valorisation (avec fallback méthode hybride pour Tabac)
  const valoMin = (
    valorisation?.synthese?.fourchette_basse ||
    valorisation?.methodeHybride?.valorisationTotale?.fourchetteBasse ||
    0
  ).toLocaleString('fr-FR');
  const valoMax = (
    valorisation?.synthese?.fourchette_haute ||
    valorisation?.methodeHybride?.valorisationTotale?.fourchetteHaute ||
    0
  ).toLocaleString('fr-FR');
  const valoMediane = (
    valorisation?.synthese?.valeur_recommandee ||
    valorisation?.methodeHybride?.valorisationTotale?.valeurMediane ||
    valorisation?.synthese?.fourchette_mediane ||
    0
  ).toLocaleString('fr-FR');

  // Valeur numérique pour calculs
  const valoMedianeNum =
    valorisation?.synthese?.valeur_recommandee ||
    valorisation?.methodeHybride?.valorisationTotale?.valeurMediane ||
    valorisation?.synthese?.fourchette_mediane ||
    0;

  // ========================================
  // Calculs préliminaires pour BP et Points Forts
  // ========================================

  // Déterminer la dernière année disponible
  const years = comptable?.sig ? Object.keys(comptable.sig).sort().reverse() : [];
  const lastYear = years[0] || '';

  // Valeurs actuelles (depuis comptable)
  const sigLastYear = comptable?.sig?.[lastYear] || {};
  // Gérer le nouveau format SIG { valeur, pct_ca } ou l'ancien format (number)
  const extractValue = (val: any) => typeof val === 'object' && val !== null ? val.valeur : (val || 0);

  const ebeComptable = comptable?.ebeRetraitement?.ebe_comptable || extractValue(sigLastYear?.ebe) || 0;
  const caActuel = extractValue(sigLastYear?.chiffre_affaires) || 0;
  const margeEbeActuelle = comptable?.ratios?.marge_ebe_pct || (caActuel > 0 ? (ebeComptable / caActuel * 100) : 0);

  // Valeurs business plan (depuis businessPlan et comptable.ebeRetraitement)
  const ebeNormatif = comptable?.ebeRetraitement?.ebe_normatif || 0;
  const projectionAnnee1 = businessPlan?.projections?.[1]; // Année 1 (Reprise)
  const projectionAnnee3 = businessPlan?.projections?.[3]; // Année 3 (Croisière)

  const caAnnee1 = projectionAnnee1?.ca || 0;
  const ebeAnnee1 = projectionAnnee1?.ebe_normatif || 0;
  const ebeAnnee3 = projectionAnnee3?.ebe_normatif || 0;
  const caAnnee3 = projectionAnnee3?.ca || 0;
  const margeEbeNormatif = caActuel > 0 ? (ebeNormatif / caActuel * 100) : 0;

  // ========================================
  // Points forts (actuels + potentiel BP)
  // ========================================
  const strengths: string[] = [];

  // 1. Critères basés sur données comptables actuelles
  if (comptable?.evolution?.tendance === 'croissance') {
    strengths.push(`📈 Croissance historique ${comptable.evolution.ca_evolution_pct.toFixed(1)}% du CA`);
  }
  if (healthScore >= 70) {
    strengths.push(`✅ Bonne santé financière (${healthScore}/100)`);
  }
  if (comptable?.ratios?.marge_ebe_pct > 10) {
    strengths.push(`💰 Marge EBE solide (${comptable.ratios.marge_ebe_pct.toFixed(1)}%)`);
  }

  // 2. Critères basés sur le Business Plan (potentiel repreneur)
  // Potentiel d'amélioration EBE (si normatif > comptable de +30% ou plus)
  if (ebeComptable > 0 && ebeNormatif > 0 && strengths.length < 3) {
    const ameliorationEbe = ((ebeNormatif - ebeComptable) / ebeComptable) * 100;
    if (ameliorationEbe >= 30) {
      strengths.push(`🚀 Potentiel EBE normatif +${ameliorationEbe.toFixed(0)}% après optimisation`);
    }
  }

  // Croissance CA projetée Année 3 (si +10% ou plus vs actuel)
  if (caAnnee3 > 0 && caActuel > 0 && strengths.length < 3) {
    const croissanceProjetee = ((caAnnee3 - caActuel) / caActuel) * 100;
    if (croissanceProjetee >= 10) {
      strengths.push(`📊 Croissance CA projetée +${croissanceProjetee.toFixed(0)}% à horizon 3 ans`);
    }
  }

  // Rentabilité projetée Année 3 (marge EBE > 15%)
  if (ebeAnnee3 > 0 && caAnnee3 > 0 && strengths.length < 3) {
    const margeProjetee = (ebeAnnee3 / caAnnee3) * 100;
    if (margeProjetee >= 15) {
      strengths.push(`💎 Rentabilité cible ${margeProjetee.toFixed(1)}% en année 3`);
    }
  }

  // Message par défaut si aucun point fort identifié
  if (strengths.length === 0) {
    strengths.push('Aucun point fort majeur identifié selon les critères standards (santé ≥70, marge ≥10%, croissance historique ou projetée)');
  }

  // ========================================
  // Points de vigilance depuis alertes déterministes
  // ========================================
  // Priorité 1: Utiliser les alertes déterministes (reproductibles)
  // Priorité 2: Fallback sur l'ancien format pointsVigilance
  const deterministicAlerts = financialValidation?.deterministicAlerts || [];

  let warnings: string[] = [];

  if (deterministicAlerts.length > 0) {
    // Utiliser les alertes déterministes (format structuré)
    warnings = deterministicAlerts
      .filter((a: any) => a.severity === 'critical' || a.severity === 'warning')
      .slice(0, 5)
      .map((a: any) => {
        // Format: "Titre\nMessage\n\nRecommandation : ..."
        let text = `<strong>${a.title}</strong><br>${a.message}`;
        if (a.recommendation) {
          text += `<br><em>Recommandation : ${a.recommendation}</em>`;
        }
        // Ajouter contexte BP si amélioration EBE prévue
        if (a.category === 'rentabilite' && ebeNormatif > ebeComptable && ebeComptable > 0) {
          const amelioration = ((ebeNormatif - ebeComptable) / ebeComptable * 100).toFixed(0);
          text += `<br><span class="bp-context">→ BP: redressement prévu +${amelioration}% via EBE normatif</span>`;
        }
        return text;
      });
  } else {
    // Fallback: ancien format pointsVigilance (pour compatibilité)
    const rawWarnings = financialValidation?.synthese?.pointsVigilance?.slice(0, 5) || [];
    warnings = rawWarnings;
  }

  // Calcul des évolutions
  const evolutionEbe = ebeComptable > 0 ? ((ebeNormatif - ebeComptable) / ebeComptable * 100) : 0;
  const evolutionMarge = margeEbeNormatif - margeEbeActuelle; // en points
  const evolutionCA = caActuel > 0 ? ((caAnnee1 - caActuel) / caActuel * 100) : 0;
  const evolutionEbeAnnee1 = ebeComptable > 0 ? ((ebeAnnee1 - ebeComptable) / ebeComptable * 100) : 0;

  // Capacité remboursement = EBE - Annuité emprunt
  // Priorité 1: Formulaire Transaction Financing (Sections 7-9)
  // Priorité 2: Business Plan financement
  // Priorité 3: Transaction Costs mensualités
  const annuiteActuelle = transactionCosts?.mensualites ? transactionCosts.mensualites * 12 : 0;

  const annuitePrevue = userComments?.transactionFinancing?.negocie?.estimation_annuelle  // Scénario négocié prioritaire
    || userComments?.transactionFinancing?.initial?.estimation_annuelle
    || businessPlan?.financement?.annuite
    || annuiteActuelle;

  console.log(`[generateFinancialHtml] 💰 Annuité prévue: ${annuitePrevue.toLocaleString('fr-FR')} € (source: ${
    userComments?.transactionFinancing?.negocie?.estimation_annuelle ? 'Formulaire (négocié)' :
    userComments?.transactionFinancing?.initial?.estimation_annuelle ? 'Formulaire (initial)' :
    businessPlan?.financement?.annuite ? 'Business Plan' : 'Transaction Costs'
  })`);

  const capaciteActuelle = ebeComptable - annuiteActuelle;
  const capacitePotentielle = ebeAnnee1 > 0 ? ebeAnnee1 - annuitePrevue : ebeNormatif - annuitePrevue;
  const evolutionCapacite = capaciteActuelle !== 0 ? ((capacitePotentielle - capaciteActuelle) / Math.abs(capaciteActuelle) * 100) : 0;

  // Helper pour formater l'évolution
  const formatEvolution = (value: number, isPoints: boolean = false) => {
    if (value === 0) return { text: '-', class: 'evolution-neutral' };
    const sign = value > 0 ? '+' : '';
    const unit = isPoints ? ' pts' : '%';
    return {
      text: `${sign}${value.toFixed(1)}${unit}`,
      class: value > 0 ? 'evolution-positive' : 'evolution-negative'
    };
  };

  // Générer le HTML du tableau comparatif (seulement si businessPlan disponible)
  const comparisonTable = (businessPlan?.projections?.length > 0 && ebeNormatif > 0) ? `
<h3>📊 Comparatif Situation Actuelle vs Potentiel Repreneur</h3>
<table class="comparison-table">
  <thead>
    <tr>
      <th>Indicateur</th>
      <th>Situation Actuelle</th>
      <th>Potentiel Repreneur</th>
      <th>Évolution</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>EBE</strong></td>
      <td>${ebeComptable.toLocaleString('fr-FR')} € <small>(comptable)</small></td>
      <td>${ebeNormatif.toLocaleString('fr-FR')} € <small>(normatif)</small></td>
      <td class="${formatEvolution(evolutionEbe).class}">${formatEvolution(evolutionEbe).text}</td>
    </tr>
    <tr>
      <td><strong>Marge EBE</strong></td>
      <td>${margeEbeActuelle.toFixed(1)}%</td>
      <td>${margeEbeNormatif.toFixed(1)}%</td>
      <td class="${formatEvolution(evolutionMarge, true).class}">${formatEvolution(evolutionMarge, true).text}</td>
    </tr>
    <tr>
      <td><strong>CA Année 1</strong></td>
      <td>${caActuel.toLocaleString('fr-FR')} €</td>
      <td>${caAnnee1.toLocaleString('fr-FR')} €</td>
      <td class="${formatEvolution(evolutionCA).class}">${formatEvolution(evolutionCA).text}</td>
    </tr>
    <tr>
      <td><strong>EBE Année 1</strong></td>
      <td>${ebeComptable.toLocaleString('fr-FR')} €</td>
      <td>${ebeAnnee1.toLocaleString('fr-FR')} €</td>
      <td class="${formatEvolution(evolutionEbeAnnee1).class}">${formatEvolution(evolutionEbeAnnee1).text}</td>
    </tr>
    <tr>
      <td><strong>Capacité Remboursement</strong></td>
      <td>${capaciteActuelle.toLocaleString('fr-FR')} € <small>(EBE - annuité)</small></td>
      <td>${capacitePotentielle.toLocaleString('fr-FR')} € <small>(projeté)</small></td>
      <td class="${formatEvolution(evolutionCapacite).class}">${formatEvolution(evolutionCapacite).text}</td>
    </tr>
  </tbody>
</table>
<p class="comparison-note">
  💡 <strong>EBE Normatif</strong> = EBE comptable retraité (salaire dirigeant, économies loyer, charges non récurrentes).<br/>
  Les projections Année 1 intègrent les hypothèses du business plan (extension horaires, impacts travaux).
</p>
` : '';

  return `
${comparisonTable}

<h3>✅ Points Forts Financiers</h3>
<ul class="strength-list">
  ${strengths.map(s => `<li>${s}</li>`).join('')}
</ul>

<h3>⚠️ Points de Vigilance</h3>
<ul class="warning-list">
  ${warnings.map((w: string) => `<li>${w}</li>`).join('')}
</ul>

<div class="page-break"></div>
`;
}

// generateAccountingSection, generateValuationSection, generateRealEstateSection, generateBusinessPlanSection
// have been moved to ./sections/*.ts - See imports at top of file

// Skip to generateCompletenessBlock which is NOT yet extracted
// TODO: Consider extracting the following functions to separate modules in a future refactoring:
// - generateCompletenessBlock
// - generateDataCompletenessSection
// - generateValidationSection
// - generateAnnexes
// - generateUserCommentsSection
// - analyzeAndGenerateCommentaries

/**
 * Génère un bloc de complétude pour une section
 */
function generateCompletenessBlock(section: any): string {
  if (!section) return '';

  const scoreClass = section.score >= 80 ? 'success' :
                     (section.score >= 50 ? 'warning' : 'error');

  let html = '<div class="data-completeness">';
  html += `<h4>📋 ${section.section} <span class="badge ${scoreClass}">${section.score}/100</span></h4>`;

  html += '<ul class="missing-data-list">';

  // Present fields (show top 3)
  const presentToShow = section.presentFields?.slice(0, 3) || [];
  for (const field of presentToShow) {
    html += `<li class="present">`;
    html += `<span>✅ ${field.label}</span>`;
    if (field.source) {
      html += `<em style="font-size:0.85em; margin-left:8px">(${field.source})</em>`;
    }
    html += '</li>';
  }

  // Partial fields
  const partialFields = section.partialFields || [];
  for (const field of partialFields) {
    html += `<li class="partial">`;
    html += `<span>⚠️ ${field.label}`;
    if (field.details) {
      html += ` <em style="font-size:0.85em">- ${field.details}</em>`;
    }
    html += '</span></li>';
  }

  // Missing fields (sorted by impact, show top 5)
  const missingFields = [...(section.missingFields || [])].sort((a: any, b: any) => b.impact - a.impact);
  const missingToShow = missingFields.slice(0, 5);
  for (const field of missingToShow) {
    html += `<li class="missing">`;
    html += `<span>❌ ${field.label}</span>`;
    if (field.impact >= 3) {
      html += `<span class="impact badge error">-${field.impact} pts</span>`;
    }
    html += '</li>';
  }

  // Show count of remaining missing fields
  if (missingFields.length > 5) {
    html += `<li class="missing" style="font-style:italic; opacity:0.8">`;
    html += `<span>... et ${missingFields.length - 5} autres éléments manquants</span></li>`;
  }

  html += '</ul>';

  // Recommendations
  if (section.recommendations && section.recommendations.length > 0) {
    html += '<div class="completeness-recommendation">';
    html += '<strong>👉 Documents à demander au cédant :</strong>';
    html += '<ul>';
    for (const rec of section.recommendations) {
      html += `<li>${rec}</li>`;
    }
    html += '</ul></div>';
  }

  html += '</div>';
  return html;
}

/**
 * Génère la section complète de suivi des données
 */
function generateDataCompletenessSection(dataCompleteness: any): string {
  if (!dataCompleteness || !dataCompleteness.sections) return '';

  let html = '<h3>📋 Complétude des Données par Section</h3>';
  html += '<p style="color: var(--color-text-secondary); margin-bottom: 15px;">';
  html += 'Détail des données présentes, manquantes ou partielles pour chaque section du rapport.</p>';

  // Generate blocks for each section
  for (const section of dataCompleteness.sections) {
    html += generateCompletenessBlock(section);
  }

  // Priority documents table
  if (dataCompleteness.priorityDocuments && dataCompleteness.priorityDocuments.length > 0) {
    html += '<div class="priority-docs-table">';
    html += '<h4>📄 Documents Prioritaires à Obtenir</h4>';
    html += '<table>';
    html += '<thead><tr><th>Document</th><th>Criticité</th><th>Impact Score</th><th>Section</th></tr></thead>';
    html += '<tbody>';

    for (const doc of dataCompleteness.priorityDocuments) {
      const critClass = `criticite-${doc.criticite}`;
      const critIcon = doc.criticite === 'bloquant' ? '🔴' :
                       (doc.criticite === 'important' ? '🟠' : '🟢');
      html += `<tr>
        <td>${doc.document}</td>
        <td class="${critClass}">${critIcon} ${doc.criticite}</td>
        <td class="text-right">+${doc.impact} pts</td>
        <td>${doc.section || ''}</td>
      </tr>`;
    }

    html += '</tbody></table>';
    html += '</div>';
  }

  return html;
}

/**
 * Helper: Extract latest fiscal year from comptable data
 */
function getLatestFiscalYear(comptable: any): number {
  if (!comptable?.yearsAnalyzed || comptable.yearsAnalyzed.length === 0) {
    return 0;
  }
  const years = comptable.yearsAnalyzed.map((y: any) => {
    if (typeof y === 'number') return y;
    if (typeof y === 'string') return parseInt(y, 10);
    return 0;
  }).filter((y: number) => y > 2000 && y < 2030);

  return years.length > 0 ? Math.max(...years) : 0;
}

/**
 * Génère la section validation
 */
function generateValidationSection(
  financialValidation: any,
  confidenceRadar: any,
  comptable?: any,
  immobilier?: any,
  documentExtraction?: any
): string {
  let html = '<h2>✅ Validation & Fiabilité</h2>';

  if (!financialValidation) {
    return html + '<p class="no-data">Données de validation non disponibles</p>';
  }

  // Score de confiance + radar
  html += '<div class="chart-row">';

  // Table score confiance
  if (financialValidation.confidenceScore) {
    const cs = financialValidation.confidenceScore;
    html += '<div><h3>Score de Confiance</h3>';
    html += '<table>';
    html += `<tr><td><strong>Score Global</strong></td><td class="text-right"><strong style="font-size:1.5em">${cs.overall}/100</strong></td></tr>`;
    if (cs.breakdown) {
      html += `<tr><td>Extraction Données</td><td class="text-right">${cs.breakdown.extraction}/100</td></tr>`;
      html += `<tr><td>Analyse Comptable</td><td class="text-right">${cs.breakdown.comptabilite}/100</td></tr>`;
      html += `<tr><td>Valorisation</td><td class="text-right">${cs.breakdown.valorisation}/100</td></tr>`;
      html += `<tr><td>Analyse Immobilière</td><td class="text-right">${cs.breakdown.immobilier}/100</td></tr>`;
    }
    html += '</table>';
    html += `<p><em>${cs.interpretation || ''}</em></p>`;
    html += '</div>';
  }

  // Radar
  html += '<div><div class="chart-container"><canvas id="confidenceRadar"></canvas></div></div>';
  html += '</div>';
  html += `<script>
  new Chart(document.getElementById('confidenceRadar'), ${JSON.stringify(confidenceRadar)});
  </script>`;

  // Qualité des données
  if (financialValidation.dataQuality) {
    html += '<h3>Qualité des Données</h3>';
    const dq = financialValidation.dataQuality;
    html += '<div class="score-grid">';
    html += `<div class="score-card"><div class="score-value">${dq.completeness}%</div><div class="score-label">Complétude</div></div>`;
    html += `<div class="score-card"><div class="score-value">${dq.reliability}%</div><div class="score-label">Fiabilité</div></div>`;
    html += `<div class="score-card"><div class="score-value">${dq.recency}%</div><div class="score-label">Fraîcheur</div></div>`;
    html += '</div>';

    if (dq.missing_critical && dq.missing_critical.length > 0) {
      html += '<div class="alert-box warning">';
      html += '<strong>Données Critiques Manquantes</strong><ul>';
      dq.missing_critical.forEach((item: string) => {
        html += `<li>${item}</li>`;
      });
      html += '</ul></div>';
    }
  }

  // Data Completeness Tracking (NEW)
  if (financialValidation.dataCompleteness) {
    html += generateDataCompletenessSection(financialValidation.dataCompleteness);
  }

  // ========== ANOMALIES & VÉRIFICATIONS SUPPRIMÉS ==========
  // (Blocs désactivés sur demande utilisateur 2026-01-02)

  // ========== NOUVELLES SECTIONS ==========

  // Sources de Données
  html += '<h3>📚 Sources de Données</h3>';
  html += '<div class="info-grid">';

  // Lister les documents analysés
  const documents = documentExtraction?.documents || [];
  if (documents.length > 0) {
    html += '<div class="info-label">Documents Analysés</div>';
    html += '<div class="info-value"><ul>';
    documents.forEach((doc: any) => {
      const year = doc.year || 'N/A';
      const type = doc.type || 'Inconnu';
      const confidence = doc.confidence || 0;
      html += `<li>${type} ${year} (confiance: ${confidence}%)</li>`;
    });
    html += '</ul></div>';
  }

  // APIs utilisées
  html += '<div class="info-label">APIs Externes</div>';
  html += '<div class="info-value"><ul>';
  html += '<li>BODACC (annonces légales)</li>';
  html += '<li>OpenData Entreprises (registre)</li>';
  if (immobilier?.location) {
    html += '<li>Google Places API (localisation)</li>';
  }
  html += '</ul></div>';

  html += '</div>'; // Ferme info-grid

  // Limitations de l'Analyse
  html += '<h3>⚠️ Limitations de l\'Analyse</h3>';
  html += '<div class="warning-box"><ul>';

  // Limitations standards
  html += '<li>Les données comptables sont basées sur les liasses fiscales fournies et n\'ont pas été auditées par un expert-comptable indépendant.</li>';

  // Limitation spécifique si données anciennes
  const latestYear = getLatestFiscalYear(comptable);
  const yearGap = new Date().getFullYear() - latestYear;
  if (yearGap > 1) {
    html += `<li><strong>⚠️ Données obsolètes :</strong> Dernière liasse fiscale de ${latestYear} (${yearGap} ans d'écart). L'analyse ne reflète pas la situation actuelle de l'entreprise.</li>`;
  }

  // Limitation si documents manquants
  if (!immobilier?.bail) {
    html += '<li>Bail commercial non fourni - analyse du loyer basée sur déclarations uniquement.</li>';
  }

  if (comptable?.yearsAnalyzed?.length < 3) {
    html += `<li>Seulement ${comptable.yearsAnalyzed.length} année(s) fiscale(s) analysée(s) - tendances moins fiables.</li>`;
  }

  html += '<li>Les projections de business plan sont basées sur des hypothèses de marché et ne constituent pas une garantie de résultats futurs.</li>';
  html += '<li>La valorisation est indicative et doit être complétée par une due diligence approfondie.</li>';
  html += '</ul></div>';

  html += '<div class="page-break"></div>';
  return html;
}

/**
 * Génère les annexes
 */
function generateAnnexes(documentExtraction: any, comptable: any, valorisation: any): string {
  let html = '<h2>📝 Annexes</h2>';

  // Documents analysés
  html += '<h3>Documents Analysés</h3>';
  if (documentExtraction?.documents && documentExtraction.documents.length > 0) {
    html += '<table><thead><tr><th>Nom du Fichier</th><th>Type</th><th>Année</th></tr></thead><tbody>';

    documentExtraction.documents.forEach((doc: any) => {
      html += `<tr>
        <td>${doc.filename || 'N/A'}</td>
        <td><span class="badge info">${doc.documentType || 'N/A'}</span></td>
        <td>${doc.year || 'N/A'}</td>
      </tr>`;
    });

    html += '</tbody></table>';
  } else {
    html += '<p class="no-data">Aucun document analysé</p>';
  }

  // Hypothèses
  html += '<h3>Hypothèses de Calcul</h3>';
  html += '<ul>';
  html += '<li><strong>SIG</strong> : Calculs selon Plan Comptable Général français</li>';
  html += '<li><strong>Ratios</strong> : Moyennes sectorielles issues de bases INSEE/DGFIP</li>';

  // Support BOTH structures (backward compatibility)
  const methodes = valorisation?.methodes || {
    ebe: valorisation?.methodeEBE,
    ca: valorisation?.methodeCA,
    patrimoniale: valorisation?.methodePatrimoniale
  };
  if (methodes?.ebe) {
    html += `<li><strong>Valorisation EBE</strong> : Multiples ${methodes.ebe.coefficient_bas}x - ${methodes.ebe.coefficient_haut}x selon secteur</li>`;
  }

  html += '<li><strong>Score de santé</strong> : Pondération 30% rentabilité, 25% liquidité, 25% solvabilité, 20% activité</li>';
  html += '<li><strong>Confiance</strong> : Pondération 35% complétude, 40% fiabilité, 25% fraîcheur</li>';
  html += '</ul>';

  // Glossaire
  html += '<h3>Glossaire des Termes Comptables</h3>';
  html += '<table>';
  html += '<tr><td><strong>CA</strong></td><td>Chiffre d\'Affaires - Total des ventes</td></tr>';
  html += '<tr><td><strong>EBE</strong></td><td>Excédent Brut d\'Exploitation - Résultat avant amortissements et charges financières</td></tr>';
  html += '<tr><td><strong>CAF</strong></td><td>Capacité d\'Autofinancement - Ressources générées par l\'activité</td></tr>';
  html += '<tr><td><strong>BFR</strong></td><td>Besoin en Fonds de Roulement - Besoins de trésorerie liés au cycle d\'exploitation</td></tr>';
  html += '<tr><td><strong>SIG</strong></td><td>Soldes Intermédiaires de Gestion - Indicateurs clés de performance</td></tr>';
  html += '<tr><td><strong>Marge EBE</strong></td><td>EBE / CA - Rentabilité opérationnelle</td></tr>';
  html += '<tr><td><strong>Taux d\'endettement</strong></td><td>Dettes / Capitaux propres</td></tr>';
  html += '</table>';

  return html;
}

/**
 * Analyse les données et génère les commentaires stratégiques pertinents
 */
function analyzeAndGenerateCommentaries(comptable: any, immobilier: any, userComments: any, businessInfo: any, valorisation: any, businessPlan: any): string[] {
  const commentaries: string[] = [];

  // 1. Baisse de CA liée aux horaires
  if (comptable?.evolution?.tendance === 'baisse' && userComments?.commentaire) {
    const caEvolution = comptable.evolution.ca_evolution_pct || 0;
    if (caEvolution < -2 && caEvolution > -10) {
      commentaries.push(generateStrategicCommentary(
        'Mise en perspective de la baisse de CA',
        `La baisse de CA (${caEvolution.toFixed(1)}%) est corrélée à une réduction volontaire des horaires d'ouverture par le cédant (fermeture matins et/ou lundis). Le potentiel commercial est intact et sera réactivé par les repreneurs dès la reprise.`
      ));
    }
  }

  // 2. EBE faible mais retraitable
  if (comptable?.ebeRetraitement) {
    const ebeComptable = comptable.ebeRetraitement.ebe_comptable || 0;
    const ebeNormatif = comptable.ebeRetraitement.ebe_normatif || 0;
    const ecart = ebeNormatif - ebeComptable;

    if (ecart > 50000) {
      commentaries.push(generateStrategicCommentary(
        'Rentabilité Réelle Masquée',
        `L'EBE comptable (${ebeComptable.toLocaleString('fr-FR')} €) ne reflète PAS votre rentabilité future. Après retraitement des charges non reprises (salaires, loyer), l'EBE Normatif atteint ${ebeNormatif.toLocaleString('fr-FR')} €, soit +${Math.round((ecart / ebeComptable) * 100)}%. Cette capacité bénéficiaire réelle valide la solidité du projet.`
      ));
    }
  }

  // 3. Loyer élevé mais renégociable
  if (immobilier?.simulationLoyer) {
    const sim = immobilier.simulationLoyer;
    if (sim.comparaison?.appreciation === 'desavantageux' && sim.scenarios?.realiste?.economieAnnuelle > 5000) {
      commentaries.push(generateStrategicCommentary(
        'Opportunité de Renégociation du Loyer',
        `Le loyer actuel (${sim.loyerActuel?.annuel.toLocaleString('fr-FR')} €/an) est ${Math.abs(sim.comparaison.ecartPourcentage)}% supérieur au marché. Une renégociation réaliste permettrait d'économiser ${sim.scenarios.realiste.economieAnnuelle.toLocaleString('fr-FR')} €/an, améliorant directement la rentabilité et le dossier bancaire.`
      ));
    }
  }

  // 4. Masse salariale optimisable
  if (comptable?.ebeRetraitement?.retraitements) {
    const retraitements = comptable.ebeRetraitement.retraitements;
    const salaireNonRepris = retraitements.find((r: any) => r.type === 'salaries_non_repris');

    if (salaireNonRepris && salaireNonRepris.montant > 50000) {
      commentaries.push(generateStrategicCommentary(
        'Optimisation de la Masse Salariale',
        `La suppression de ${salaireNonRepris.montant.toLocaleString('fr-FR')} € de charges salariales (postes non repris) libère immédiatement de la trésorerie. Cette économie structurelle améliore la capacité de remboursement et réduit le point mort de ${Math.round((salaireNonRepris.montant / comptable.sig[comptable.yearsAnalyzed[0]]?.chiffre_affaires || 1) * 100)}%.`
      ));
    }
  }

  // 5. Travaux nécessaires mais valorisants
  if (immobilier?.travaux?.budget_total) {
    const budgetObligatoire = immobilier.travaux.budget_total.obligatoire_haut || 0;
    const budgetRecommande = immobilier.travaux.budget_total.recommande_haut || 0;
    const total = budgetObligatoire + budgetRecommande;

    if (total > 20000 && userComments?.budget_travaux) {
      commentaries.push(generateStrategicCommentary(
        'Investissement Travaux = Levier de Croissance',
        `Les travaux estimés à ${total.toLocaleString('fr-FR')} € ne sont pas une contrainte mais un levier de croissance. La modernisation du point de vente générera +10% de CA dès l'année 2 (projection conservative), soit un ROI rapide sur l'investissement travaux.`
      ));
    }
  }

  // 6. ANALYSE DE LA CLIENTÈLE & SAISONNALITÉ
  if (businessInfo?.activite_principale?.includes('tabac') ||
      businessInfo?.activite_principale?.includes('presse') ||
      businessInfo?.zone_touristique) {
    const isTouristique = businessInfo?.zone_touristique || false;

    commentaries.push(generateStrategicCommentary(
      isTouristique ? 'Dépendance à la saisonnalité' : 'Clientèle locale fidèle',
      isTouristique
        ? `Commerce en zone touristique : forte saisonnalité attendue. Le CA estival peut représenter 40-60% du CA annuel. **Recommandation** : Provisionner trésorerie pour hiver, négocier loyer variable (% CA), constituer une équipe saisonnière flexible.`
        : `Commerce en zone résidentielle : clientèle locale fidèle mais CA stable. **Recommandation** : Développer offres de fidélité, étendre horaires pour capter flux matin/soir, diversifier gamme produits quotidiens.`
    ));
  }

  // 7. RISQUES RÉGLEMENTAIRES & CONFORMITÉ
  if (businessInfo?.activite_principale?.includes('tabac')) {
    commentaries.push(generateStrategicCommentary(
      'Contraintes réglementaires tabac',
      `Activité réglementée nécessitant carte de débitant de tabac (transfert soumis à agrément préfectoral, délai 3-6 mois). **Risques** : Évolution législation (paquet neutre, prix, zones fumeurs), baisse structurelle consommation (-2%/an). **Recommandation** : Diversifier revenus (presse, FDJ, vape, souvenirs) pour réduire dépendance aux commissions tabac.`
    ));
  }

  // 8. OPPORTUNITÉS DE CROISSANCE
  const caRecent = comptable?.sig?.[comptable.yearsAnalyzed?.[0]]?.chiffre_affaires || 0;
  const caAncien = comptable?.sig?.[comptable.yearsAnalyzed?.[comptable.yearsAnalyzed.length - 1]]?.chiffre_affaires || 0;
  const croissanceCA = caAncien > 0 ? ((caRecent - caAncien) / caAncien) * 100 : 0;

  // Détecter les plans d'extension d'horaires dans userComments
  const horairesExtension = detectHorairesExtension(userComments);
  const horairesInfo = horairesExtension.detected
    ? `prévu par l'acheteur : ${horairesExtension.description}`
    : `actuellement ${businessInfo?.horaires_fermeture || 'non renseigné'}`;

  if (croissanceCA < 5) {
    commentaries.push(generateStrategicCommentary(
      'Potentiel de croissance sous-exploité',
      `CA stagnant (${croissanceCA.toFixed(1)}% sur 3 ans). **Leviers identifiés** :
      1. Extension horaires d'ouverture (${horairesInfo})
      2. Digitalisation (click & collect, livraison, e-commerce complémentaire)
      3. Merchandising (réaménagement vitrine, mise en avant produits à marge)
      4. Animation locale (partenariats associations, événements de quartier).
      **Objectif réaliste** : +10-15% CA année 1 avec investissement minimal.`
    ));
  }

  // 9. POINTS DE NÉGOCIATION AVEC LE VENDEUR
  const prixAffiche = businessInfo?.prix_affiche || valorisation?.synthese?.valeur_recommandee || 0;
  const valeurRecommandee = valorisation?.synthese?.valeur_recommandee || 0;
  const ecartPrix = prixAffiche > 0 && valeurRecommandee > 0
    ? ((prixAffiche - valeurRecommandee) / valeurRecommandee) * 100
    : 0;

  if (Math.abs(ecartPrix) > 10) {
    commentaries.push(generateStrategicCommentary(
      'Arguments de négociation du prix',
      ecartPrix > 0
        ? `Prix affiché (${prixAffiche.toLocaleString('fr-FR')}€) supérieur de ${ecartPrix.toFixed(0)}% à la valorisation recommandée. **Arguments acheteur** : Baisse EBE récente (-${Math.abs(comptable?.evolution?.ebe_evolution_pct || 0)}%), loyer élevé, travaux nécessaires, incertitudes marché. **Stratégie** : Proposer ${(valeurRecommandee * 0.95).toLocaleString('fr-FR')}€ avec clause earn-out sur CA année 1.`
        : `Prix affiché inférieur à la valorisation : opportunité. **Prudence** : Vérifier raisons (urgence vendeur, problèmes cachés, bail précaire). **Due diligence renforcée** sur bail, personnel, litiges, conformité.`
    ));
  }

  // 10. STRATÉGIE DE FINANCEMENT (basé sur projections Business Plan)
  const apportPersonnel = businessInfo?.apport_personnel || (valeurRecommandee * 0.30);
  const montantEmprunt = valeurRecommandee - apportPersonnel;

  // Calcul EBE : moyenne années 1-3 du business plan (ou fallback EBE actuel)
  let ebeProjeteMoyen = 0;
  const ebeActuel = comptable?.ebeRetraitement?.ebe_normatif || comptable?.sig?.[comptable.yearsAnalyzed?.[0]]?.ebe || 0;

  if (businessPlan?.projections && businessPlan.projections.length >= 4) {
    // Années 1, 2, 3 = indices 1, 2, 3 (indice 0 = Actuel)
    const ebe1 = businessPlan.projections[1]?.ebe_normatif || 0;
    const ebe2 = businessPlan.projections[2]?.ebe_normatif || 0;
    const ebe3 = businessPlan.projections[3]?.ebe_normatif || 0;
    ebeProjeteMoyen = (ebe1 + ebe2 + ebe3) / 3;
    console.log(`[Financement] EBE Business Plan: Année 1=${ebe1}, Année 2=${ebe2}, Année 3=${ebe3}, Moyenne=${ebeProjeteMoyen.toFixed(0)}`);
  } else {
    // Fallback sur EBE actuel si business plan non disponible
    ebeProjeteMoyen = ebeActuel;
    console.log(`[Financement] ⚠️ Business Plan non disponible, utilisation EBE actuel: ${ebeActuel}`);
  }

  const annuiteMax = ebeProjeteMoyen * 0.7; // 70% de l'EBE max pour annuité
  const dureeMax = annuiteMax > 0 ? montantEmprunt / annuiteMax : 0;

  if (valeurRecommandee > 0 && ebeProjeteMoyen > 0) {
    const sourceEbe = businessPlan?.projections?.length >= 4
      ? '(moyenne années 1-3 Business Plan)'
      : '(EBE actuel - Business Plan non disponible)';

    commentaries.push(generateStrategicCommentary(
      'Plan de financement & capacité d\'endettement',
      `Valorisation ${valeurRecommandee.toLocaleString('fr-FR')}€. Avec apport ${apportPersonnel.toLocaleString('fr-FR')}€ (${((apportPersonnel/valeurRecommandee)*100).toFixed(0)}%), emprunt nécessaire : ${montantEmprunt.toLocaleString('fr-FR')}€.
      **Capacité de remboursement** : EBE projeté ${ebeProjeteMoyen.toLocaleString('fr-FR')}€/an ${sourceEbe} → annuité max ${annuiteMax.toLocaleString('fr-FR')}€ (70% EBE). Durée emprunt : ${dureeMax.toFixed(1)} ans.
      ${dureeMax > 7 ? '⚠️ **Alerte** : Durée > 7 ans = risque bancaire. Négocier prix à la baisse ou augmenter apport.' : '✅ Financement viable sur durée classique (5-7 ans).'}
      **Garanties attendues** : Nantissement fonds, caution personnelle dirigeant, assurance décès-invalidité.`
    ));
  }

  return commentaries;
}


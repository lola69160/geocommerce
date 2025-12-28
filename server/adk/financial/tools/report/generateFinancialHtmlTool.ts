import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';
import * as fs from 'fs/promises';
import * as path from 'path';

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
      let comptable = parseState(toolContext?.state.get('comptable'));
      let valorisation = parseState(toolContext?.state.get('valorisation'));
      let immobilier = parseState(toolContext?.state.get('immobilier'));
      let businessPlan = parseState(toolContext?.state.get('businessPlan'));
      let financialValidation = parseState(toolContext?.state.get('financialValidation'));

      const sections_included: string[] = [];

      // Générer le HTML complet
      let html = generateHTMLHeader();
      html += generateCSS();
      html += '<body><div class="container">';

      // 1. Page de garde
      html += generateCoverPage(businessInfo, financialValidation);
      sections_included.push('cover_page');

      // 2. Synthèse exécutive (avec userComments pour afficher budget travaux)
      let userComments = parseState(toolContext?.state.get('userComments'));
      html += generateExecutiveSummary(comptable, valorisation, financialValidation, userComments);
      sections_included.push('executive_summary');

      // 2bis. Éléments complémentaires utilisateur
      if (userComments && Object.keys(userComments).length > 0) {
        html += generateUserCommentsSection(userComments);
        sections_included.push('user_comments');
      }

      // 2ter. Commentaires stratégiques
      const strategicCommentaries = analyzeAndGenerateCommentaries(comptable, immobilier, userComments, businessInfo, valorisation);
      if (strategicCommentaries && strategicCommentaries.length > 0) {
        html += '<h2>💡 Commentaires Stratégiques</h2>';
        strategicCommentaries.forEach(commentary => {
          html += commentary;
        });
        sections_included.push('strategic_commentary');
      }

      // 3. Analyse comptable
      html += generateAccountingSection(comptable, params.charts.evolutionChart, params.charts.healthGauge);
      sections_included.push('accounting_analysis');

      // 4. Valorisation
      html += generateValuationSection(valorisation, params.charts.valorisationChart);
      sections_included.push('valuation');

      // 5. Analyse immobilière
      if (immobilier) {
        html += generateRealEstateSection(immobilier);
        sections_included.push('real_estate');
      }

      // 6. Business Plan Dynamique
      if (businessPlan && businessPlan.projections && businessPlan.projections.length > 0) {
        html += generateBusinessPlanSection(businessPlan);
        sections_included.push('business_plan');
      }

      // 6bis. Conseils pour le Rachat
      html += generateAcquisitionAdviceSection(comptable, valorisation, immobilier, businessInfo, userComments);
      sections_included.push('acquisition_advice');

      // 7. Validation & fiabilité
      html += generateValidationSection(financialValidation, params.charts.confidenceRadar);
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

/**
 * Génère l'en-tête HTML
 */
function generateHTMLHeader(): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport d'Analyse Financière - Due Diligence</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
</head>`;
}

/**
 * Génère le CSS
 */
function generateCSS(): string {
  return `
<style>
  /* ========================================
     PALETTE WCAG AA COMPLIANT
     ======================================== */
  :root {
    --color-text-primary: #1a1a1a;      /* Noir principal (15.8:1) */
    --color-text-secondary: #4a5568;    /* Gris foncé (8.59:1) */
    --color-text-muted: #718096;        /* Gris moyen (5.14:1) - limite OK */

    --color-bg-base: #ffffff;
    --color-bg-light: #f7fafc;
    --color-bg-medium: #e2e8f0;
    --color-bg-emphasis: #cbd5e0;

    --color-table-header: #edf2f7;
    --color-table-border: #cbd5e0;
    --color-table-hover: #f7fafc;

    /* Couleurs sémantiques */
    --color-success-bg: #c6f6d5;
    --color-success-text: #22543d;
    --color-warning-bg: #feebc8;
    --color-warning-text: #7c2d12;
    --color-error-bg: #fed7d7;
    --color-error-text: #742a2a;
    --color-info-bg: #bee3f8;
    --color-info-text: #2c5282;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: #333;
    background: #f5f5f5;
    padding: 20px;
  }
  .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }

  /* Typography */
  h1 { color: #1a1a1a; font-size: 2.5em; margin-bottom: 10px; border-bottom: 4px solid #0066cc; padding-bottom: 10px; }
  h2 { color: #0066cc; font-size: 1.8em; margin-top: 40px; margin-bottom: 15px; border-left: 4px solid #0066cc; padding-left: 15px; }
  h3 { color: #333; font-size: 1.3em; margin-top: 25px; margin-bottom: 10px; }

  /* Cover page */
  .cover-page { text-align: center; padding: 100px 0; margin-bottom: 60px; }
  .cover-page h1 { font-size: 3em; border: none; }
  .cover-page .subtitle { font-size: 1.5em; color: #666; margin: 20px 0; }
  .cover-page .timestamp { color: #999; font-size: 1.1em; margin-top: 30px; }
  .confidence-badge { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; font-size: 1.3em; font-weight: bold; margin-top: 30px; }

  /* Summary box */
  .summary-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin: 30px 0; }
  .summary-box h2 { color: white; border: none; margin-top: 0; }
  .summary-box h3 { color: white; }

  /* Verdict */
  .verdict { font-size: 2.5em; font-weight: bold; margin: 20px 0; text-align: center; padding: 20px; border-radius: 8px; }
  .verdict.favorable { background: #d1fae5; color: #065f46; }
  .verdict.reserves { background: #fed7aa; color: #92400e; }
  .verdict.defavorable { background: #fecaca; color: #991b1b; }

  /* Score cards */
  .score-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
  .score-card { background: #f8fafc; border-left: 4px solid #0066cc; padding: 20px; border-radius: 4px; text-align: center; }
  .score-value { font-size: 2.5em; font-weight: bold; color: #0066cc; }
  .score-label { color: #666; font-size: 0.9em; text-transform: uppercase; margin-top: 5px; }

  /* Lists */
  .strength-list { background: #d1fae5; padding: 20px; border-radius: 8px; margin: 15px 0; }
  .strength-list li { color: #065f46; margin: 8px 0; font-weight: 500; }
  .warning-list { background: #fed7aa; padding: 20px; border-radius: 8px; margin: 15px 0; }
  .warning-list li { color: #92400e; margin: 8px 0; font-weight: 500; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  th, td {
    text-align: left;
    padding: 12px;
    border-bottom: 1px solid var(--color-table-border);
  }
  th {
    background: var(--color-table-header);
    font-weight: 600;
    color: var(--color-text-primary);
  }
  tr:hover { background: var(--color-table-hover); }
  .text-right { text-align: right !important; }
  .text-center { text-align: center !important; }

  /* Charts */
  .chart-container { position: relative; height: 400px; margin: 30px 0; }
  .chart-row { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin: 30px 0; }

  /* Badges */
  .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 0.85em; font-weight: bold; margin-right: 8px; }
  .badge.success { background: #d1fae5; color: #065f46; }
  .badge.warning { background: #fed7aa; color: #92400e; }
  .badge.error { background: #fecaca; color: #991b1b; }
  .badge.info { background: #dbeafe; color: #1e40af; }

  /* Alert boxes */
  .alert-box {
    padding: 15px;
    margin: 10px 0;
    border-left: 4px solid;
    border-radius: 4px;
    font-weight: 500; /* Améliore lisibilité */
  }
  .alert-box.critical {
    background: var(--color-error-bg);
    border-color: var(--color-error-text);
    color: var(--color-error-text);
  }
  .alert-box.warning {
    background: var(--color-warning-bg);
    border-color: var(--color-warning-text);
    color: var(--color-warning-text);
  }
  .alert-box.info {
    background: var(--color-info-bg);
    border-color: var(--color-info-text);
    color: var(--color-info-text);
  }

  /* Strategic Commentary */
  .strategic-commentary { background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 20px; margin: 20px 0; border-radius: 8px; }
  .strategic-commentary h4 { color: #0369a1; margin: 0 0 10px 0; font-size: 1.1em; }
  .strategic-commentary p { color: #075985; margin: 0; line-height: 1.8; }

  /* Info grid */
  .info-grid { display: grid; grid-template-columns: 200px 1fr; gap: 15px; margin: 15px 0; }
  .info-label { font-weight: bold; color: #666; }
  .info-value { color: #333; }

  /* Footer */
  .footer { margin-top: 60px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #666; font-size: 0.9em; }

  /* Page break for print */
  .page-break { page-break-after: always; }

  /* Tables avec emphase (retraitement EBE) */
  .table-base-row {
    background: var(--color-bg-medium) !important;
    font-weight: 500;
  }
  .table-total-row {
    background: var(--color-bg-emphasis);
    border-top: 2px solid var(--color-text-primary);
    font-weight: bold;
  }
  .table-normatif-row {
    background: var(--color-info-bg);
    border-top: 2px solid var(--color-info-text);
    font-weight: bold;
  }

  @media print {
    body { background: white; padding: 0; }
    .container { box-shadow: none; }
    .page-break { page-break-after: always; }
    .table-base-row { background: #d0d0d0 !important; }
    .table-total-row { background: #b0b0b0 !important; }
    .table-normatif-row { background: #a0c4e0 !important; }
  }

  @media (max-width: 768px) {
    .chart-row { grid-template-columns: 1fr; }
    .score-grid { grid-template-columns: 1fr; }
  }
</style>
`;
}

/**
 * Génère la page de garde
 */
function generateCoverPage(businessInfo: any, financialValidation: any): string {
  const businessName = businessInfo?.name || 'Commerce';
  const date = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
  const confidenceScore = financialValidation?.confidenceScore?.overall || 0;

  return `
<div class="cover-page">
  <h1>${businessName}</h1>
  <div class="subtitle">Analyse Financière - Due Diligence</div>
  <div class="confidence-badge">Score de Confiance: ${confidenceScore}/100</div>
  <div class="timestamp">Rapport généré le ${date}</div>
</div>
<div class="page-break"></div>
`;
}

/**
 * Génère la synthèse exécutive
 */
function generateExecutiveSummary(comptable: any, valorisation: any, financialValidation: any, userComments?: any): string {
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

  // Fourchette valorisation
  const valoMin = (valorisation?.synthese?.fourchette_basse || 0).toLocaleString('fr-FR');
  const valoMax = (valorisation?.synthese?.fourchette_haute || 0).toLocaleString('fr-FR');
  const valoMediane = (valorisation?.synthese?.valeur_recommandee || valorisation?.synthese?.fourchette_mediane || 0).toLocaleString('fr-FR');

  // Points forts (3 max)
  const strengths: string[] = [];
  if (comptable?.evolution?.tendance === 'croissance') {
    strengths.push(`📈 Croissance ${comptable.evolution.ca_evolution_pct.toFixed(1)}% du CA`);
  }
  if (healthScore >= 70) {
    strengths.push(`✅ Bonne santé financière (${healthScore}/100)`);
  }
  if (comptable?.ratios?.marge_ebe_pct > 10) {
    strengths.push(`💰 Marge EBE solide (${comptable.ratios.marge_ebe_pct.toFixed(1)}%)`);
  }

  // Message par défaut si aucun point fort identifié
  if (strengths.length === 0) {
    strengths.push('Aucun point fort majeur identifié selon les critères standards (santé ≥70, marge ≥10%, croissance)');
  }

  // Points de vigilance (3 max)
  const warnings = financialValidation?.synthese?.pointsVigilance?.slice(0, 3) || [];

  return `
<h2>📊 Synthèse Exécutive</h2>

<div class="verdict ${verdictClass}">${verdict}</div>

<div class="summary-box">
  <h3>Fourchette de Valorisation</h3>
  <div class="info-grid">
    <div class="info-label">Fourchette</div>
    <div class="info-value">${valoMin} € - ${valoMax} €</div>
    <div class="info-label">Valorisation Recommandée</div>
    <div class="info-value"><strong>${valoMediane} €</strong></div>
  </div>
  ${userComments?.travaux?.budget_prevu ? `
  <div class="alert-box info" style="margin-top: 15px;">
    <strong>💰 Investissement Total Estimé</strong>
    <div class="info-grid" style="margin-top: 10px;">
      <div class="info-label">Valorisation du fonds</div>
      <div class="info-value">${valoMediane} €</div>
      <div class="info-label">+ Budget travaux</div>
      <div class="info-value">${userComments.travaux.budget_prevu.toLocaleString('fr-FR')} €</div>
      <div class="info-label"><strong>Total investissement</strong></div>
      <div class="info-value"><strong>${(parseFloat(valoMediane.replace(/\s/g, '')) + userComments.travaux.budget_prevu).toLocaleString('fr-FR')} €</strong></div>
    </div>
  </div>
  ` : ''}
</div>

<div class="score-grid">
  <div class="score-card">
    <div class="score-value">${healthScore}</div>
    <div class="score-label">Santé Financière</div>
  </div>
  <div class="score-card">
    <div class="score-value">${confidenceScore}</div>
    <div class="score-label">Score de Confiance</div>
  </div>
  <div class="score-card">
    <div class="score-value">${comptable?.ratios?.marge_ebe_pct?.toFixed(1) || 0}%</div>
    <div class="score-label">Marge EBE</div>
  </div>
</div>

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

/**
 * Génère la section analyse comptable
 */
function generateAccountingSection(comptable: any, evolutionChart: any, healthGauge: any): string {
  if (!comptable) {
    return '<h2>📈 Analyse Comptable</h2><p class="no-data">Données comptables non disponibles</p>';
  }

  let html = '<h2>📈 Analyse Comptable</h2>';

  // Tableau SIG
  if (comptable.sig) {
    html += '<h3>Soldes Intermédiaires de Gestion (SIG)</h3>';
    html += '<table><thead><tr><th>Indicateur</th>';

    const years = Object.keys(comptable.sig).sort().reverse();
    years.forEach(y => {
      html += `<th class="text-right">${y}</th>`;
    });
    html += '</tr></thead><tbody>';

    const indicators = [
      { key: 'chiffre_affaires', label: 'Chiffre d\'Affaires' },
      { key: 'marge_commerciale', label: 'Marge Commerciale' },
      { key: 'valeur_ajoutee', label: 'Valeur Ajoutée' },
      { key: 'ebe', label: 'EBE' },
      { key: 'resultat_exploitation', label: 'Résultat d\'Exploitation' },
      { key: 'resultat_net', label: 'Résultat Net' }
    ];

    indicators.forEach(ind => {
      html += `<tr><td><strong>${ind.label}</strong></td>`;
      years.forEach(y => {
        const value = comptable.sig[y]?.[ind.key] || 0;
        html += `<td class="text-right">${value.toLocaleString('fr-FR')} €</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table>';
  }

  // ========================================
  // NOUVEAU: Tableau de Retraitement EBE
  // ========================================
  if (comptable.ebeRetraitement && comptable.ebeRetraitement.ebe_normatif) {
    const ebe = comptable.ebeRetraitement;

    html += '<h3>💡 Retraitement de l\'EBE - Capacité Normatif du Repreneur</h3>';
    html += '<div class="summary-box">';
    html += '<p style="margin-bottom:15px; color:var(--color-text-secondary)">';
    html += 'L\'EBE Normatif représente la <strong>capacité bénéficiaire réelle</strong> pour le repreneur, après retraitements des éléments non récurrents ou liés au cédant.';
    html += '</p>';

    // Tableau de retraitement
    html += '<table><thead><tr><th>Ligne de Retraitement</th><th class="text-right">Montant</th><th>Source</th></tr></thead><tbody>';

    // Ligne de base
    html += `<tr class="table-base-row">
      <td><strong>EBE Comptable (Base)</strong></td>
      <td class="text-right"><strong>${ebe.ebe_comptable.toLocaleString('fr-FR')} €</strong></td>
      <td><span class="badge info">Bilan ${ebe.annee_reference}</span></td>
    </tr>`;

    // Retraitements
    if (ebe.retraitements && ebe.retraitements.length > 0) {
      ebe.retraitements.forEach((r: any) => {
        const sign = r.montant >= 0 ? '+' : '';
        const color = r.montant >= 0 ? '#10b981' : '#ef4444';
        const sourceLabel = r.source === 'userComments' ? 'Utilisateur' : (r.source === 'documentExtraction' ? 'Bilan' : 'Estimation');

        html += `<tr>
          <td>${r.description}</td>
          <td class="text-right" style="color:${color}"><strong>${sign}${r.montant.toLocaleString('fr-FR')} €</strong></td>
          <td><span class="badge ${r.source === 'userComments' ? 'success' : 'info'}">${sourceLabel}</span></td>
        </tr>`;

        // Commentaire si disponible
        if (r.commentaire) {
          html += `<tr style="font-size:0.85em; color:var(--color-text-secondary)">
            <td colspan="3" style="padding-left:30px; font-style:italic">${r.commentaire}</td>
          </tr>`;
        }
      });
    }

    // Ligne totale
    const ecartColor = ebe.total_retraitements >= 0 ? '#10b981' : '#ef4444';
    html += `<tr class="table-total-row">
      <td><strong>Total Retraitements</strong></td>
      <td class="text-right" style="color:${ecartColor}"><strong>${ebe.total_retraitements >= 0 ? '+' : ''}${ebe.total_retraitements.toLocaleString('fr-FR')} €</strong></td>
      <td></td>
    </tr>`;

    // Ligne EBE Normatif
    html += `<tr class="table-normatif-row">
      <td><strong>🎯 EBE NORMATIF (Capacité Repreneur)</strong></td>
      <td class="text-right"><strong style="font-size:1.2em; color:#0066cc">${ebe.ebe_normatif.toLocaleString('fr-FR')} €</strong></td>
      <td><span class="badge success">+${ebe.ecart_pct}%</span></td>
    </tr>`;

    html += '</tbody></table>';

    // Synthèse textuelle
    if (ebe.synthese) {
      html += `<p style="margin-top:15px; padding:10px; background:#fffbeb; border-left:3px solid #f59e0b">
        <strong>💡 Synthèse:</strong> ${ebe.synthese}
      </p>`;
    }

    html += '</div>';
  }

  // Graphique évolution
  html += '<h3>Évolution sur 3 ans</h3>';
  html += '<div class="chart-container"><canvas id="evolutionChart"></canvas></div>';
  html += `<script>
  new Chart(document.getElementById('evolutionChart'), ${JSON.stringify(evolutionChart)});
  </script>`;

  // Ratios + Gauge
  html += '<div class="chart-row">';

  // Tableau ratios
  if (comptable.ratios) {
    html += '<div><h3>Ratios Clés</h3><table>';
    html += '<tr><td>Marge Brute</td><td class="text-right"><strong>' + (comptable.ratios.marge_brute_pct?.toFixed(1) || 0) + '%</strong></td></tr>';
    html += '<tr><td>Marge EBE</td><td class="text-right"><strong>' + (comptable.ratios.marge_ebe_pct?.toFixed(1) || 0) + '%</strong></td></tr>';
    html += '<tr><td>Marge Nette</td><td class="text-right"><strong>' + (comptable.ratios.marge_nette_pct?.toFixed(1) || 0) + '%</strong></td></tr>';
    html += '<tr><td>Délai Clients</td><td class="text-right">' + (comptable.ratios.delai_clients_jours || 0) + ' jours</td></tr>';
    html += '<tr><td>Taux d\'Endettement</td><td class="text-right">' + (comptable.ratios.taux_endettement_pct?.toFixed(1) || 0) + '%</td></tr>';
    html += '<tr><td>CAF</td><td class="text-right">' + (comptable.ratios.capacite_autofinancement?.toLocaleString('fr-FR') || 0) + ' €</td></tr>';
    html += '</table></div>';
  }

  // Gauge santé
  html += '<div><div class="chart-container"><canvas id="healthGauge"></canvas></div></div>';
  html += '</div>';
  html += `<script>
  new Chart(document.getElementById('healthGauge'), ${JSON.stringify(healthGauge)});
  </script>`;

  // Benchmark sectoriel
  if (comptable.benchmark) {
    html += '<h3>Comparaison Sectorielle</h3>';
    html += `<p><strong>Secteur:</strong> ${comptable.benchmark.sector} (NAF ${comptable.benchmark.nafCode})</p>`;

    if (comptable.benchmark.comparisons && comptable.benchmark.comparisons.length > 0) {
      html += '<table><thead><tr><th>Ratio</th><th class="text-right">Entreprise</th><th class="text-right">Moyenne Secteur</th><th class="text-center">Position</th></tr></thead><tbody>';

      comptable.benchmark.comparisons.slice(0, 6).forEach((comp: any) => {
        const badge = comp.position === 'superieur' ? 'success' : (comp.position === 'inferieur' ? 'error' : 'warning');
        const emoji = comp.position === 'superieur' ? '📈' : (comp.position === 'inferieur' ? '📉' : '➡️');

        html += `<tr>
          <td>${comp.ratio}</td>
          <td class="text-right"><strong>${comp.value.toFixed(1)}</strong></td>
          <td class="text-right">${comp.sectorAverage.toFixed(1)}</td>
          <td class="text-center"><span class="badge ${badge}">${emoji} ${comp.position}</span></td>
        </tr>`;
      });

      html += '</tbody></table>';
    }
  }

  // Alertes
  if (comptable.alertes && comptable.alertes.length > 0) {
    html += '<h3>Alertes & Points de Vigilance</h3>';

    comptable.alertes.forEach((alert: any) => {
      const alertClass = alert.level === 'critical' ? 'critical' : (alert.level === 'warning' ? 'warning' : 'info');
      html += `<div class="alert-box ${alertClass}">
        <strong>${alert.message}</strong>
        <p>${alert.impact}</p>
        <p><em>Recommandation : ${alert.recommendation}</em></p>
      </div>`;
    });
  }

  html += '<div class="page-break"></div>';
  return html;
}

/**
 * Génère la section valorisation
 */
function generateValuationSection(valorisation: any, valorisationChart: any): string {
  if (!valorisation) {
    return '<h2>💰 Valorisation du Fonds</h2><p class="no-data">Données de valorisation non disponibles</p>';
  }

  let html = '<h2>💰 Valorisation du Fonds</h2>';

  // ========================================
  // NOUVEAU: Valorisation Hybride Tabac/Presse/FDJ
  // ========================================
  if (valorisation.methodeHybride) {
    const tabac = valorisation.methodeHybride;

    html += '<div class="summary-box" style="background:#e6f7ff; border-left:4px solid #0066cc">';
    html += '<h3>🔵 Méthode HYBRIDE Tabac/Presse/FDJ</h3>';
    html += `<p style="color:var(--color-text-secondary)"><strong>Type de commerce:</strong> ${tabac.descriptionType}</p>`;

    // Tableau de décomposition
    html += '<table>';
    html += '<thead><tr><th>Bloc Valorisation</th><th class="text-right">Base</th><th class="text-right">Coefficient / %</th><th class="text-right">Valeur</th></tr></thead>';
    html += '<tbody>';

    // Bloc 1: Activité Réglementée
    html += '<tr style="background:#f0f8ff">';
    html += '<td><strong>📋 Bloc 1 : Activité Réglementée</strong><br><span style="font-size:0.9em; color:var(--color-text-secondary)">(Tabac + Loto + Presse + FDJ)</span></td>';
    html += `<td class="text-right">${tabac.blocReglemente.commissionsNettes.toLocaleString('fr-FR')} €<br><span style="font-size:0.9em; color:var(--color-text-secondary)">Commissions nettes annuelles</span></td>`;
    html += `<td class="text-right">${tabac.blocReglemente.coefficientMin} - ${tabac.blocReglemente.coefficientMax}<br><span style="font-size:0.9em; color:var(--color-text-secondary)">Coefficient multiplicateur</span></td>`;
    html += `<td class="text-right"><strong>${tabac.blocReglemente.valeurMin.toLocaleString('fr-FR')} - ${tabac.blocReglemente.valeurMax.toLocaleString('fr-FR')} €</strong></td>`;
    html += '</tr>';

    // Bloc 2: Activité Commerciale
    html += '<tr style="background:#fff8e1">';
    html += '<td><strong>🛒 Bloc 2 : Activité Commerciale</strong><br><span style="font-size:0.9em; color:var(--color-text-secondary)">(Souvenirs + Confiserie + Vape + Téléphonie)</span></td>';
    html += `<td class="text-right">${tabac.blocCommercial.caActiviteBoutique.toLocaleString('fr-FR')} €<br><span style="font-size:0.9em; color:var(--color-text-secondary)">CA boutique annuel</span></td>`;
    html += `<td class="text-right">${tabac.blocCommercial.pourcentageMin} - ${tabac.blocCommercial.pourcentageMax}%<br><span style="font-size:0.9em; color:var(--color-text-secondary)">Pourcentage CA</span></td>`;
    html += `<td class="text-right"><strong>${tabac.blocCommercial.valeurMin.toLocaleString('fr-FR')} - ${tabac.blocCommercial.valeurMax.toLocaleString('fr-FR')} €</strong></td>`;
    html += '</tr>';

    // Total
    html += '<tr style="border-top:2px solid #0066cc; background:#e6f7ff">';
    html += '<td colspan="3"><strong>🎯 VALORISATION TOTALE (Bloc 1 + Bloc 2)</strong></td>';
    html += `<td class="text-right"><strong style="font-size:1.2em; color:#0066cc">${tabac.valorisationTotale.fourchetteBasse.toLocaleString('fr-FR')} - ${tabac.valorisationTotale.fourchetteHaute.toLocaleString('fr-FR')} €</strong><br><span style="color:#0066cc">Médiane: ${tabac.valorisationTotale.valeurMediane.toLocaleString('fr-FR')} €</span></td>`;
    html += '</tr>';

    html += '</tbody></table>';

    // Facteurs valorisants spécifiques
    if (tabac.facteursValorisants && tabac.facteursValorisants.length > 0) {
      html += '<div style="margin-top:15px"><strong>✅ Facteurs Valorisants:</strong><ul style="margin-top:5px">';
      tabac.facteursValorisants.forEach((facteur: string) => {
        html += `<li>${facteur}</li>`;
      });
      html += '</ul></div>';
    }

    // Justification
    if (tabac.justification) {
      html += `<p style="margin-top:15px; padding:10px; background:#fffbeb; border-left:3px solid #f59e0b; font-size:0.95em">
        <strong>💡 Méthode:</strong> ${tabac.justification}
      </p>`;
    }

    html += '</div>'; // Fin summary-box
  }

  // Graphique fourchettes
  html += '<div class="chart-container"><canvas id="valorisationChart"></canvas></div>';
  html += `<script>
  new Chart(document.getElementById('valorisationChart'), ${JSON.stringify(valorisationChart)});
  </script>`;

  // Tableau comparatif (seulement pour méthodes standard - pas pour hybride car déjà affiché au-dessus)
  if (!valorisation.methodeHybride) {
    html += '<h3>Comparaison des Méthodes de Valorisation</h3>';
    html += '<table><thead><tr><th>Méthode</th><th class="text-right">Fourchette Basse</th><th class="text-right">Médiane</th><th class="text-right">Fourchette Haute</th></tr></thead><tbody>';

    // Support BOTH structures (backward compatibility) - IDENTIQUE à generateChartsTool.ts
    const methodes = valorisation.methodes || {
      ebe: valorisation.methodeEBE,
      ca: valorisation.methodeCA,
      patrimoniale: valorisation.methodePatrimoniale
    };

    // MÉTHODE EBE - Toujours afficher
    if (methodes?.ebe) {
      const ebe = methodes.ebe;
      if (ebe.valeur_mediane > 0) {
        html += `<tr>
          <td><strong>Méthode EBE</strong> (${ebe.coefficient_bas}x - ${ebe.coefficient_haut}x)</td>
          <td class="text-right">${(ebe.valeur_basse || 0).toLocaleString('fr-FR')} €</td>
          <td class="text-right">${(ebe.valeur_mediane || 0).toLocaleString('fr-FR')} €</td>
          <td class="text-right">${(ebe.valeur_haute || 0).toLocaleString('fr-FR')} €</td>
        </tr>`;
      } else {
        // Afficher avec message explicatif
        html += `<tr style="color:var(--color-text-muted)">
          <td><strong>Méthode EBE</strong></td>
          <td class="text-right" colspan="3">0 € <em>(données insuffisantes - EBE non disponible ou trop faible)</em></td>
        </tr>`;
      }
    }

    // MÉTHODE CA - Toujours afficher
    if (methodes?.ca) {
      const ca = methodes.ca;
      if (ca.valeur_mediane > 0) {
        html += `<tr>
          <td><strong>Méthode CA</strong> (${ca.pourcentage_bas}% - ${ca.pourcentage_haut}% CA)</td>
          <td class="text-right">${(ca.valeur_basse || 0).toLocaleString('fr-FR')} €</td>
          <td class="text-right">${(ca.valeur_mediane || 0).toLocaleString('fr-FR')} €</td>
          <td class="text-right">${(ca.valeur_haute || 0).toLocaleString('fr-FR')} €</td>
        </tr>`;
      } else {
        html += `<tr style="color:var(--color-text-muted)">
          <td><strong>Méthode CA</strong></td>
          <td class="text-right" colspan="3">0 € <em>(données insuffisantes - CA non disponible)</em></td>
        </tr>`;
      }
    }

    // MÉTHODE PATRIMONIALE - Garder comportement actuel (déjà correct)
    if (methodes?.patrimoniale) {
      const patri = methodes.patrimoniale;
      const valeurPatri = patri.valeur_estimee || 0;
      html += `<tr${valeurPatri === 0 ? ' style="color:var(--color-text-muted)"' : ''}>
        <td><strong>Méthode Patrimoniale</strong> (Actif Net + Goodwill)</td>
        <td class="text-right" colspan="3">${valeurPatri.toLocaleString('fr-FR')} €${valeurPatri === 0 ? ' <em>(bilan non fourni)</em>' : ''}</td>
      </tr>`;
      // Ajouter détail patrimonial
      if (patri.actif_net_comptable) {
        html += `<tr style="font-size:0.9em; color:var(--color-text-secondary)">
          <td style="padding-left:30px">Actif net comptable</td>
          <td class="text-right" colspan="3">${(patri.actif_net_comptable || 0).toLocaleString('fr-FR')} €</td>
        </tr>`;
      }
      if (patri.goodwill) {
        html += `<tr style="font-size:0.9em; color:var(--color-text-secondary)">
          <td style="padding-left:30px">Goodwill (survaleur)</td>
          <td class="text-right" colspan="3">${(patri.goodwill || 0).toLocaleString('fr-FR')} €</td>
        </tr>`;
      }
    }

    html += '</tbody></table>';
  } else {
    // Pour la méthode hybride, afficher un message explicatif
    html += '<div class="summary-box" style="background:#f0f9ff; border-left:4px solid #0066cc">';
    html += '<p style="margin:0"><strong>Note :</strong> La méthode HYBRIDE Tabac/Presse/FDJ ci-dessus est la méthode de valorisation privilégiée pour ce type de commerce réglementé. Les méthodes classiques (EBE, CA, Patrimoniale) ne sont pas adaptées à ce secteur.</p>';
    html += '</div>';
  }

  // Synthèse valorisation
  if (valorisation.synthese) {
    html += '<div class="summary-box">';
    html += '<h3>Valorisation Retenue</h3>';
    html += '<div class="info-grid">';
    html += `<div class="info-label">Fourchette</div>`;
    html += `<div class="info-value">${(valorisation.synthese.fourchette_basse || 0).toLocaleString('fr-FR')} € - ${(valorisation.synthese.fourchette_haute || 0).toLocaleString('fr-FR')} €</div>`;
    html += `<div class="info-label">Méthode Privilégiée</div>`;
    html += `<div class="info-value">${valorisation.synthese.methode_privilegiee || 'N/A'}</div>`;
    html += `<div class="info-label">Valeur Recommandée</div>`;
    html += `<div class="info-value"><strong style="font-size:1.3em">${(valorisation.synthese.valeur_recommandee || 0).toLocaleString('fr-FR')} €</strong></div>`;
    html += '</div></div>';
  }

  // Arguments de négociation
  if (valorisation.argumentsNegociation) {
    html += '<h3>Arguments de Négociation</h3>';
    html += '<div class="chart-row">';

    if (valorisation.argumentsNegociation.pour_acheteur) {
      html += '<div class="warning-list"><h4>Pour l\'Acheteur</h4><ul>';
      valorisation.argumentsNegociation.pour_acheteur.forEach((arg: string) => {
        html += `<li>${arg}</li>`;
      });
      html += '</ul></div>';
    }

    if (valorisation.argumentsNegociation.pour_vendeur) {
      html += '<div class="strength-list"><h4>Pour le Vendeur</h4><ul>';
      valorisation.argumentsNegociation.pour_vendeur.forEach((arg: string) => {
        html += `<li>${arg}</li>`;
      });
      html += '</ul></div>';
    }

    html += '</div>';
  }

  html += '<div class="page-break"></div>';
  return html;
}

/**
 * Génère la section immobilière
 */
function generateRealEstateSection(immobilier: any): string {
  let html = '<h2>🏠 Analyse Immobilière</h2>';

  if (!immobilier.bail && !immobilier.murs) {
    return html + '<p class="no-data">Aucune donnée immobilière disponible</p>';
  }

  // Synthèse du bail
  if (immobilier.bail) {
    html += '<h3>Bail Commercial</h3>';
    html += '<table>';
    html += `<tr><td>Type de Bail</td><td><strong>${immobilier.bail.type || 'N/A'}</strong></td></tr>`;
    html += `<tr><td>Loyer Annuel HC</td><td><strong>${(immobilier.bail.loyer_annuel_hc || 0).toLocaleString('fr-FR')} €</strong></td></tr>`;
    html += `<tr><td>Surface</td><td>${immobilier.bail.surface_m2 || 0} m²</td></tr>`;
    html += `<tr><td>Loyer/m²/an</td><td>${(immobilier.bail.loyer_m2_annuel || 0).toLocaleString('fr-FR')} €</td></tr>`;
    html += `<tr><td>Durée Restante</td><td>${immobilier.bail.duree_restante_mois || 0} mois</td></tr>`;

    if (immobilier.bail.loyer_marche_estime) {
      const ecart = immobilier.bail.ecart_marche_pct || 0;
      const badgeClass = ecart < 0 ? 'success' : 'error';
      html += `<tr><td>Comparaison Marché</td><td><span class="badge ${badgeClass}">${ecart > 0 ? '+' : ''}${ecart}%</span> ${immobilier.bail.appreciation || ''}</td></tr>`;
    }

    if (immobilier.bail.droit_au_bail_estime) {
      html += `<tr><td>Droit au Bail Estimé</td><td><strong>${immobilier.bail.droit_au_bail_estime.toLocaleString('fr-FR')} €</strong></td></tr>`;
    }

    html += '</table>';
  }

  // Option murs
  if (immobilier.murs && immobilier.murs.option_possible) {
    html += '<h3>Option Rachat des Murs</h3>';
    html += '<table>';
    html += `<tr><td>Prix Demandé</td><td><strong>${(immobilier.murs.prix_demande || 0).toLocaleString('fr-FR')} €</strong></td></tr>`;
    html += `<tr><td>Prix/m² Zone</td><td>${(immobilier.murs.prix_m2_zone || 0).toLocaleString('fr-FR')} €</td></tr>`;
    html += `<tr><td>Rentabilité Brute</td><td><strong>${immobilier.murs.rentabilite_brute_pct || 0}%</strong></td></tr>`;
    html += `<tr><td>Rentabilité Nette</td><td><strong>${immobilier.murs.rentabilite_nette_pct || 0}%</strong></td></tr>`;

    const recomm = immobilier.murs.recommandation || 'louer';
    const badgeClass = recomm === 'acheter' ? 'success' : (recomm === 'negocier' ? 'warning' : 'info');
    html += `<tr><td>Recommandation</td><td><span class="badge ${badgeClass}">${recomm.toUpperCase()}</span></td></tr>`;
    html += '</table>';

    if (immobilier.murs.arguments) {
      html += '<ul class="strength-list">';
      immobilier.murs.arguments.forEach((arg: string) => {
        html += `<li>${arg}</li>`;
      });
      html += '</ul>';
    }
  }

  // Travaux
  if (immobilier.travaux) {
    html += '<h3>Budget Travaux</h3>';
    html += '<table>';
    html += `<tr><td>État Général</td><td><strong>${immobilier.travaux.etat_general || 'N/A'}</strong></td></tr>`;

    if (immobilier.travaux.budget_total) {
      const bt = immobilier.travaux.budget_total;
      html += `<tr><td>Budget Obligatoire</td><td><strong>${(bt.obligatoire_bas || 0).toLocaleString('fr-FR')} € - ${(bt.obligatoire_haut || 0).toLocaleString('fr-FR')} €</strong></td></tr>`;
      if (bt.recommande_bas) {
        html += `<tr><td>Budget Recommandé</td><td>${(bt.recommande_bas || 0).toLocaleString('fr-FR')} € - ${(bt.recommande_haut || 0).toLocaleString('fr-FR')} €</td></tr>`;
      }
    }

    html += '</table>';
  }

  // Simulation Loyer
  if (immobilier.simulationLoyer) {
    const sim = immobilier.simulationLoyer;
    html += '<h3>📊 Simulation Renégociation Loyer</h3>';

    // Comparaison actuel vs marché
    if (sim.comparaison) {
      const badgeClass = sim.comparaison.appreciation === 'avantageux' ? 'success' :
                         (sim.comparaison.appreciation === 'desavantageux' ? 'error' : 'warning');
      html += `<div class="alert-box ${badgeClass}">`;
      html += `<strong>Loyer actuel : ${sim.comparaison.appreciation.toUpperCase()}</strong>`;
      html += `<p>Écart avec le marché : <strong>${sim.comparaison.ecartPourcentage > 0 ? '+' : ''}${sim.comparaison.ecartPourcentage}%</strong> `;
      html += `(${Math.abs(sim.comparaison.ecartAnnuel).toLocaleString('fr-FR')} €/an)</p>`;
      html += '</div>';
    }

    // Table des scénarios
    if (sim.scenarios) {
      html += '<h4>Scénarios de Renégociation</h4>';
      html += '<table>';
      html += '<thead><tr><th>Scénario</th><th>Nouveau Loyer/an</th><th>Économie/an</th><th>Impact EBE</th><th>Probabilité</th></tr></thead>';
      html += '<tbody>';

      // Scénario Pessimiste
      if (sim.scenarios.pessimiste) {
        const s = sim.scenarios.pessimiste;
        html += '<tr>';
        html += `<td><strong>Pessimiste</strong><br/><small>${s.description}</small></td>`;
        html += `<td class="text-right">${s.nouveauLoyerAnnuel.toLocaleString('fr-FR')} €</td>`;
        html += `<td class="text-right" style="color: ${s.economieAnnuelle > 0 ? '#065f46' : '#991b1b'}">${s.economieAnnuelle > 0 ? '+' : ''}${s.economieAnnuelle.toLocaleString('fr-FR')} €</td>`;
        html += `<td class="text-right" style="color: ${s.economieAnnuelle > 0 ? '#065f46' : '#991b1b'}">${s.economieAnnuelle > 0 ? '+' : ''}${s.economieAnnuelle.toLocaleString('fr-FR')} €</td>`;
        html += `<td class="text-center">${s.probabilite}</td>`;
        html += '</tr>';
      }

      // Scénario Réaliste
      if (sim.scenarios.realiste) {
        const s = sim.scenarios.realiste;
        html += '<tr style="background: #f0f9ff;">';
        html += `<td><strong>Réaliste ⭐</strong><br/><small>${s.description}</small></td>`;
        html += `<td class="text-right"><strong>${s.nouveauLoyerAnnuel.toLocaleString('fr-FR')} €</strong></td>`;
        html += `<td class="text-right" style="color: ${s.economieAnnuelle > 0 ? '#065f46' : '#991b1b'}"><strong>${s.economieAnnuelle > 0 ? '+' : ''}${s.economieAnnuelle.toLocaleString('fr-FR')} €</strong></td>`;
        html += `<td class="text-right" style="color: ${s.economieAnnuelle > 0 ? '#065f46' : '#991b1b'}"><strong>${s.economieAnnuelle > 0 ? '+' : ''}${s.economieAnnuelle.toLocaleString('fr-FR')} €</strong></td>`;
        html += `<td class="text-center"><strong>${s.probabilite}</strong></td>`;
        html += '</tr>';
      }

      // Scénario Optimiste
      if (sim.scenarios.optimiste) {
        const s = sim.scenarios.optimiste;
        html += '<tr>';
        html += `<td><strong>Optimiste</strong><br/><small>${s.description}</small></td>`;
        html += `<td class="text-right">${s.nouveauLoyerAnnuel.toLocaleString('fr-FR')} €</td>`;
        html += `<td class="text-right" style="color: ${s.economieAnnuelle > 0 ? '#065f46' : '#991b1b'}">${s.economieAnnuelle > 0 ? '+' : ''}${s.economieAnnuelle.toLocaleString('fr-FR')} €</td>`;
        html += `<td class="text-right" style="color: ${s.economieAnnuelle > 0 ? '#065f46' : '#991b1b'}">${s.economieAnnuelle > 0 ? '+' : ''}${s.economieAnnuelle.toLocaleString('fr-FR')} €</td>`;
        html += `<td class="text-center">${s.probabilite}</td>`;
        html += '</tr>';
      }

      html += '</tbody></table>';

      // Note sur le scénario réaliste
      html += '<p><small><em>⭐ Le scénario réaliste est utilisé pour le calcul de l\'EBE Normatif</em></small></p>';
    }

    // Arguments de négociation
    if (sim.argumentsNegociation && sim.argumentsNegociation.length > 0) {
      html += '<h4>Arguments de Négociation</h4>';
      html += '<ul class="strength-list">';
      sim.argumentsNegociation.forEach((arg: string) => {
        html += `<li>${arg}</li>`;
      });
      html += '</ul>';
    }

    // Recommandation
    if (sim.recommandation) {
      html += `<div class="alert-box info">`;
      html += `<strong>Recommandation :</strong> ${sim.recommandation}`;
      html += `</div>`;
    }
  }

  // Score immobilier
  if (immobilier.synthese?.score_immobilier) {
    html += `<div class="summary-box">`;
    html += `<h3>Score Immobilier : ${immobilier.synthese.score_immobilier}/100</h3>`;
    html += `<p>${immobilier.synthese.recommandation || ''}</p>`;
    html += `</div>`;
  }

  html += '<div class="page-break"></div>';
  return html;
}

/**
 * Génère la section Business Plan Dynamique
 */
function generateBusinessPlanSection(businessPlan: any): string {
  let html = '<h2>📈 Business Plan Dynamique - Projection 5 ans</h2>';

  if (!businessPlan || !businessPlan.projections) {
    return html + '<p class="no-data">Aucune projection disponible</p>';
  }

  const { projections, indicateursBancaires, hypotheses, synthese, recommandations } = businessPlan;

  // Synthèse du business plan
  if (synthese) {
    html += `<div class="summary-box">`;
    html += `<h3>Synthèse</h3>`;
    html += `<p>${synthese}</p>`;
    html += `</div>`;
  }

  // Table des projections sur 5 ans
  html += '<h3>Projections sur 5 ans</h3>';
  html += '<table>';
  html += '<thead><tr>';
  html += '<th>Indicateur</th>';

  projections.forEach((proj: any) => {
    html += `<th class="text-center">${proj.label}</th>`;
  });

  html += '</tr></thead><tbody>';

  // Ligne CA
  html += '<tr style="background:#f0f9ff">';
  html += '<td><strong>Chiffre d\'Affaires</strong></td>';
  projections.forEach((proj: any) => {
    html += `<td class="text-right"><strong>${proj.ca.toLocaleString('fr-FR')} €</strong></td>`;
  });
  html += '</tr>';

  // Détails impacts CA
  html += '<tr>';
  html += '<td style="padding-left:20px; font-size:0.9em">└─ Impact horaires</td>';
  projections.forEach((proj: any) => {
    const val = proj.ca_detail?.impact_horaires || 0;
    html += `<td class="text-right" style="font-size:0.9em; color:#059669">${val > 0 ? '+' : ''}${Math.round(val).toLocaleString('fr-FR')} €</td>`;
  });
  html += '</tr>';

  html += '<tr>';
  html += '<td style="padding-left:20px; font-size:0.9em">└─ Impact travaux</td>';
  projections.forEach((proj: any) => {
    const val = proj.ca_detail?.impact_travaux || 0;
    html += `<td class="text-right" style="font-size:0.9em; color:#059669">${val > 0 ? '+' : ''}${Math.round(val).toLocaleString('fr-FR')} €</td>`;
  });
  html += '</tr>';

  html += '<tr>';
  html += '<td style="padding-left:20px; font-size:0.9em">└─ Croissance naturelle</td>';
  projections.forEach((proj: any) => {
    const val = proj.ca_detail?.croissance_naturelle || 0;
    html += `<td class="text-right" style="font-size:0.9em; color:#059669">${val > 0 ? '+' : ''}${Math.round(val).toLocaleString('fr-FR')} €</td>`;
  });
  html += '</tr>';

  // Ligne Charges fixes
  html += '<tr style="background:#fff7ed">';
  html += '<td><strong>Charges Fixes</strong></td>';
  projections.forEach((proj: any) => {
    html += `<td class="text-right"><strong>${proj.charges_fixes.toLocaleString('fr-FR')} €</strong></td>`;
  });
  html += '</tr>';

  // Détails charges
  html += '<tr>';
  html += '<td style="padding-left:20px; font-size:0.9em">└─ Salaires</td>';
  projections.forEach((proj: any) => {
    html += `<td class="text-right" style="font-size:0.9em">${proj.charges_detail.salaires.toLocaleString('fr-FR')} €</td>`;
  });
  html += '</tr>';

  html += '<tr>';
  html += '<td style="padding-left:20px; font-size:0.9em">└─ Loyer</td>';
  projections.forEach((proj: any) => {
    html += `<td class="text-right" style="font-size:0.9em">${proj.charges_detail.loyer.toLocaleString('fr-FR')} €</td>`;
  });
  html += '</tr>';

  // Ligne EBE Normatif
  html += '<tr style="background:#d1fae5">';
  html += '<td><strong>EBE Normatif</strong></td>';
  projections.forEach((proj: any) => {
    const color = proj.ebe_normatif > 0 ? '#065f46' : '#991b1b';
    html += `<td class="text-right" style="color:${color}"><strong>${proj.ebe_normatif.toLocaleString('fr-FR')} €</strong></td>`;
  });
  html += '</tr>';

  // Ligne Annuité emprunt
  html += '<tr>';
  html += '<td>Annuité emprunt</td>';
  projections.forEach((proj: any) => {
    html += `<td class="text-right" style="color:#991b1b">${proj.annuite_emprunt > 0 ? '-' : ''}${proj.annuite_emprunt.toLocaleString('fr-FR')} €</td>`;
  });
  html += '</tr>';

  // Ligne Reste après dette
  html += '<tr style="background:#e6f7ff; border-top:2px solid #0066cc">';
  html += '<td><strong>💰 Reste après dette</strong></td>';
  projections.forEach((proj: any) => {
    const color = proj.reste_apres_dette > 0 ? '#065f46' : '#991b1b';
    html += `<td class="text-right" style="color:${color}"><strong>${proj.reste_apres_dette.toLocaleString('fr-FR')} €</strong></td>`;
  });
  html += '</tr>';

  html += '</tbody></table>';

  // Graphique Chart.js des projections
  html += '<h4>Évolution Projetée sur 5 ans</h4>';
  html += '<div class="chart-container"><canvas id="projectionChart"></canvas></div>';

  // Configuration Chart.js
  const labels = projections.map((p: any) => p.label);
  const caData = projections.map((p: any) => p.ca);
  const ebeData = projections.map((p: any) => p.ebe_normatif);
  const resteData = projections.map((p: any) => p.reste_apres_dette);

  const projectionChartConfig = {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Chiffre d\'Affaires',
          data: caData,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 3,
          tension: 0.3,
          fill: true
        },
        {
          label: 'EBE Normatif',
          data: ebeData,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 3,
          tension: 0.3,
          fill: true
        },
        {
          label: 'Reste après dette',
          data: resteData,
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          borderWidth: 3,
          tension: 0.3,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { size: 14, weight: 'bold' },
            padding: 20
          }
        },
        title: {
          display: false
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context: any) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              label += new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(context.parsed.y);
              return label;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value: any) {
              return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
            }
          }
        }
      }
    }
  };

  html += `<script>
  new Chart(document.getElementById('projectionChart'), ${JSON.stringify(projectionChartConfig)});
  </script>`;

  // Indicateurs bancaires
  if (indicateursBancaires) {
    const ind = indicateursBancaires;
    html += '<h3>🏦 Indicateurs Bancaires</h3>';

    // Appréciation globale
    const appreciationClass = ind.appreciation === 'excellent' ? 'success' :
                               (ind.appreciation === 'bon' ? 'success' :
                                (ind.appreciation === 'acceptable' ? 'warning' : 'error'));
    html += `<div class="alert-box ${appreciationClass}">`;
    html += `<strong>Profil bancaire : ${ind.appreciation.toUpperCase()}</strong>`;
    html += `</div>`;

    // Table indicateurs
    html += '<div class="score-grid">';

    html += '<div class="score-card">';
    html += `<div class="score-value">${ind.ratioCouvertureDette}x</div>`;
    html += '<div class="score-label">Ratio de Couverture</div>';
    html += '<p style="font-size:0.85em; margin-top:5px">Cible: > 1.5x</p>';
    html += '</div>';

    html += '<div class="score-card">';
    html += `<div class="score-value">${ind.rentabiliteCapitauxInvestis}%</div>`;
    html += '<div class="score-label">ROI</div>';
    html += '<p style="font-size:0.85em; margin-top:5px">Rentabilité investissement</p>';
    html += '</div>';

    html += '<div class="score-card">';
    html += `<div class="score-value">${ind.delaiRetourInvestissement} ans</div>`;
    html += '<div class="score-label">Délai de Retour</div>';
    html += '<p style="font-size:0.85em; margin-top:5px">Amortissement apport</p>';
    html += '</div>';

    html += '<div class="score-card">';
    html += `<div class="score-value">${ind.pointMort.toLocaleString('fr-FR')} €</div>`;
    html += '<div class="score-label">Point Mort</div>';
    html += '<p style="font-size:0.85em; margin-top:5px">CA minimum équilibre</p>';
    html += '</div>';

    html += '</div>';

    // Détails financement
    html += '<table>';
    html += `<tr><td>Investissement Total</td><td class="text-right"><strong>${ind.investissementTotal.toLocaleString('fr-FR')} €</strong></td></tr>`;
    html += `<tr><td>Montant Emprunté</td><td class="text-right">${ind.montantEmprunte.toLocaleString('fr-FR')} €</td></tr>`;
    html += `<tr><td>Annuité Emprunt</td><td class="text-right">${ind.annuiteEmprunt.toLocaleString('fr-FR')} €/an</td></tr>`;
    html += `<tr><td>Capacité d'Autofinancement (Année 1)</td><td class="text-right"><strong>${ind.capaciteAutofinancement.toLocaleString('fr-FR')} €</strong></td></tr>`;
    html += '</table>';
  }

  // Recommandations
  if (recommandations && recommandations.length > 0) {
    html += '<h3>💡 Recommandations</h3>';
    html += '<ul class="warning-list">';
    recommandations.forEach((rec: string) => {
      html += `<li>${rec}</li>`;
    });
    html += '</ul>';
  }

  // Hypothèses utilisées
  if (hypotheses) {
    html += '<h3>📋 Hypothèses du Business Plan</h3>';
    html += '<table>';

    if (hypotheses.extensionHoraires?.impactEstime) {
      html += `<tr><td>Impact extension horaires</td><td class="text-right">+${(hypotheses.extensionHoraires.impactEstime * 100).toFixed(0)}% du CA</td></tr>`;
    }

    if (hypotheses.travaux?.impactAnnee2) {
      html += `<tr><td>Impact travaux (Année 2)</td><td class="text-right">+${(hypotheses.travaux.impactAnnee2 * 100).toFixed(0)}% du CA</td></tr>`;
    }

    if (hypotheses.travaux?.impactRecurrent) {
      html += `<tr><td>Croissance récurrente (Années 3-5)</td><td class="text-right">+${(hypotheses.travaux.impactRecurrent * 100).toFixed(0)}% du CA/an</td></tr>`;
    }

    if (hypotheses.salairesSupprimes) {
      html += `<tr><td>Salaires supprimés</td><td class="text-right" style="color:#059669">-${hypotheses.salairesSupprimes.toLocaleString('fr-FR')} €/an</td></tr>`;
    }

    if (hypotheses.salairesAjoutes) {
      html += `<tr><td>Salaires ajoutés</td><td class="text-right" style="color:#991b1b">+${hypotheses.salairesAjoutes.toLocaleString('fr-FR')} €/an</td></tr>`;
    }

    if (hypotheses.tauxEmprunt) {
      html += `<tr><td>Taux d'emprunt</td><td class="text-right">${hypotheses.tauxEmprunt.toFixed(2)}%</td></tr>`;
    }

    if (hypotheses.dureeEmpruntMois) {
      html += `<tr><td>Durée emprunt</td><td class="text-right">${(hypotheses.dureeEmpruntMois / 12).toFixed(1)} ans (${hypotheses.dureeEmpruntMois} mois)</td></tr>`;
    }

    html += '</table>';
  }

  html += '<div class="page-break"></div>';
  return html;
}

/**
 * Génère la section validation
 */
function generateValidationSection(financialValidation: any, confidenceRadar: any): string {
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

  // Anomalies
  if (financialValidation.anomalies && financialValidation.anomalies.length > 0) {
    html += '<h3>Anomalies Détectées</h3>';

    financialValidation.anomalies.forEach((anomaly: any) => {
      const alertClass = anomaly.severity === 'critical' ? 'critical' : 'warning';
      html += `<div class="alert-box ${alertClass}">`;
      html += `<strong>${anomaly.description}</strong>`;
      html += `<p><em>Recommandation : ${anomaly.recommendation}</em></p>`;
      html += '</div>';
    });
  }

  // Vérifications recommandées
  if (financialValidation.verificationsRequises && financialValidation.verificationsRequises.length > 0) {
    html += '<h3>Vérifications Recommandées</h3>';
    html += '<table><thead><tr><th>Priorité</th><th>Action</th><th>Raison</th></tr></thead><tbody>';

    financialValidation.verificationsRequises.forEach((verif: any) => {
      const priority = verif.priority === 1 ? '🔴 Urgent' : (verif.priority === 2 ? '🟠 Important' : '🟡 Souhaitable');
      html += `<tr>
        <td>${priority}</td>
        <td>${verif.action}</td>
        <td>${verif.raison}</td>
      </tr>`;
    });

    html += '</tbody></table>';
  }

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
 * Génère la section des commentaires utilisateur
 */
function generateUserCommentsSection(userComments: any): string {
  let html = '<h2>💬 Éléments Complémentaires Fournis</h2>';
  html += '<div class="alert-box info">';
  html += '<strong>Informations fournies par l\'utilisateur lors de l\'analyse :</strong>';
  html += '</div>';

  // Loyer
  if (userComments.loyer) {
    html += '<h3>Informations sur le Loyer</h3>';
    html += '<div class="info-grid">';

    if (userComments.loyer.futur_loyer_commercial) {
      html += '<div class="info-label">Futur loyer commercial négocié</div>';
      html += `<div class="info-value"><strong>${userComments.loyer.futur_loyer_commercial.toLocaleString('fr-FR')} € / mois</strong></div>`;
    }

    if (userComments.loyer.loyer_logement_perso) {
      html += '<div class="info-label">Part logement personnel incluse</div>';
      html += `<div class="info-value"><strong>${userComments.loyer.loyer_logement_perso.toLocaleString('fr-FR')} € / mois</strong></div>`;
    }

    if (userComments.loyer.commentaire) {
      html += '<div class="info-label">Précisions</div>';
      html += `<div class="info-value"><em>"${userComments.loyer.commentaire}"</em></div>`;
    }

    html += '</div>';

    // Calcul automatique
    if (userComments.loyer.futur_loyer_commercial && userComments.loyer.loyer_logement_perso) {
      const loyerCommercialPur = userComments.loyer.futur_loyer_commercial - userComments.loyer.loyer_logement_perso;
      html += '<div class="summary-box">';
      html += '<h4>Décomposition du Loyer Négocié</h4>';
      html += '<table>';
      html += `<tr><td>Loyer commercial pur (exploitation)</td><td class="text-right"><strong>${loyerCommercialPur.toLocaleString('fr-FR')} € / mois</strong></td></tr>`;
      html += `<tr><td>Avantage en nature (logement personnel)</td><td class="text-right"><strong>${userComments.loyer.loyer_logement_perso.toLocaleString('fr-FR')} € / mois</strong></td></tr>`;
      html += `<tr><td><strong>Total loyer</strong></td><td class="text-right"><strong>${userComments.loyer.futur_loyer_commercial.toLocaleString('fr-FR')} € / mois</strong></td></tr>`;
      html += `<tr><td colspan="2"><em style="font-size:0.9em">💡 L'avantage en nature doit être retraité dans l'EBE pour obtenir la rentabilité réelle.</em></td></tr>`;
      html += '</table>';
      html += '</div>';
    }
  }

  // Travaux
  if (userComments.travaux) {
    html += '<h3>Informations sur les Travaux</h3>';
    html += '<div class="info-grid">';

    if (userComments.travaux.budget_prevu) {
      html += '<div class="info-label">Budget travaux prévu</div>';
      html += `<div class="info-value"><strong>${userComments.travaux.budget_prevu.toLocaleString('fr-FR')} €</strong></div>`;
    }

    if (userComments.travaux.commentaire) {
      html += '<div class="info-label">Précisions</div>';
      html += `<div class="info-value"><em>"${userComments.travaux.commentaire}"</em></div>`;
    }

    html += '</div>';
  }

  // Conditions de vente
  if (userComments.conditions_vente) {
    html += '<h3>Conditions de Vente</h3>';
    html += '<div class="info-grid">';

    if (userComments.conditions_vente.negociation_possible !== undefined) {
      html += '<div class="info-label">Négociation possible</div>';
      html += `<div class="info-value">${userComments.conditions_vente.negociation_possible ? '✅ Oui' : '❌ Non'}</div>`;
    }

    if (userComments.conditions_vente.commentaire) {
      html += '<div class="info-label">Précisions</div>';
      html += `<div class="info-value"><em>"${userComments.conditions_vente.commentaire}"</em></div>`;
    }

    html += '</div>';
  }

  // Autres commentaires
  if (userComments.autres) {
    html += '<h3>Autres Informations</h3>';
    html += `<p><em>"${userComments.autres}"</em></p>`;
  }

  html += '<div class="page-break"></div>';
  return html;
}

/**
 * Génère le footer
 */
function generateFooter(): string {
  const date = new Date().toLocaleString('fr-FR');
  return `
<div class="footer">
  <p><strong>Rapport d'Analyse Financière - Due Diligence</strong></p>
  <p>Généré automatiquement le ${date}</p>
  <p><em>Ce rapport est confidentiel et destiné uniquement à l'usage interne dans le cadre d'une acquisition.</em></p>
</div>
`;
}

/**
 * Génère un commentaire stratégique contextuel
 */
function generateStrategicCommentary(title: string, commentary: string): string {
  return `
<div class="strategic-commentary">
  <h4>📌 ${title}</h4>
  <p>${commentary}</p>
</div>
`;
}

/**
 * Génère la section dédiée "Conseils pour le Rachat"
 */
function generateAcquisitionAdviceSection(
  comptable: any,
  valorisation: any,
  immobilier: any,
  businessInfo: any,
  userComments: any
): string {
  let html = '<div class="page-break"></div>';
  html += '<h2>💡 Conseils pour le Rachat</h2>';

  // ========================================
  // Sous-section 1: Risques Identifiés & Mitigation
  // ========================================
  html += '<h3>⚠️ Risques Identifiés & Mitigation</h3>';
  html += '<table><thead><tr><th>Risque</th><th>Niveau</th><th>Stratégie de Mitigation</th></tr></thead><tbody>';

  const risques = [];

  // Risque 1: Baisse EBE
  if (comptable?.evolution?.ebe_evolution_pct < -20) {
    risques.push({
      description: 'Baisse importante de l\'EBE (-' + Math.abs(comptable.evolution.ebe_evolution_pct).toFixed(0) + '%)',
      niveau: 'critical',
      mitigation: 'Auditer masse salariale, renégocier loyer, optimiser plannings. Clause earn-out pour garantir rentabilité.'
    });
  }

  // Risque 2: Loyer élevé
  if (immobilier?.simulationLoyer?.comparaison?.appreciation === 'desavantageux') {
    const ecart = immobilier.simulationLoyer.comparaison.ecartPourcentage || 0;
    risques.push({
      description: 'Loyer supérieur au marché (+' + Math.abs(ecart).toFixed(0) + '%)',
      niveau: 'warning',
      mitigation: 'Renégociation avant signature (objectif -15% minimum). Clause de réduction si CA < seuil. Envisager rachat murs si possible.'
    });
  }

  // Risque 3: Financement
  const ebeNormatif = comptable?.ebeRetraitement?.ebe_normatif || comptable?.sig?.[comptable.yearsAnalyzed?.[0]]?.ebe || 0;
  const valeurRecommandee = valorisation?.synthese?.valeur_recommandee || 0;
  const annuiteEstimee = valeurRecommandee * 0.15; // ~15% du prix
  if (annuiteEstimee > ebeNormatif * 0.7 && ebeNormatif > 0) {
    risques.push({
      description: 'Annuité de prêt supérieure à 70% de l\'EBE',
      niveau: 'critical',
      mitigation: 'Augmenter apport personnel, négocier prix à la baisse, ou différer remboursement capital (1ère année intérêts seuls).'
    });
  }

  // Risque 4: Travaux importants
  if (immobilier?.travaux?.budget_total) {
    const totalTravaux = (immobilier.travaux.budget_total.obligatoire_haut || 0) + (immobilier.travaux.budget_total.recommande_haut || 0);
    if (totalTravaux > 30000) {
      risques.push({
        description: 'Travaux importants nécessaires (' + totalTravaux.toLocaleString('fr-FR') + ' €)',
        niveau: 'warning',
        mitigation: 'Négocier prise en charge partielle par vendeur. Étaler travaux sur 18-24 mois. Intégrer au plan de financement.'
      });
    }
  }

  // Afficher les risques
  if (risques.length > 0) {
    risques.forEach(r => {
      const badgeClass = r.niveau === 'critical' ? 'error' : 'warning';
      const badgeText = r.niveau === 'critical' ? '🔴 Critique' : '🟠 Important';
      html += `<tr>
        <td>${r.description}</td>
        <td><span class="badge ${badgeClass}">${badgeText}</span></td>
        <td>${r.mitigation}</td>
      </tr>`;
    });
  } else {
    html += '<tr><td colspan="3" style="text-align:center;color:var(--color-text-muted)">Aucun risque majeur identifié</td></tr>';
  }

  html += '</tbody></table>';

  // ========================================
  // Sous-section 2: Opportunités de Création de Valeur
  // ========================================
  html += '<h3>✅ Opportunités de Création de Valeur</h3>';
  html += '<ul class="strength-list">';

  // Opportunité 1: Optimisation masse salariale
  if (comptable?.ratios?.charges_personnel_ratio > 30) {
    html += '<li>📊 <strong>Optimisation masse salariale</strong> : Ratio charges personnel élevé (' + comptable.ratios.charges_personnel_ratio.toFixed(0) + '% CA). Potentiel de gain : 5-10% EBE via plannings optimisés.</li>';
  }

  // Opportunité 2: Extension horaires
  if (userComments?.horaires_extension) {
    html += '<li>⏰ <strong>Extension horaires</strong> : ' + userComments.horaires_extension + '. Impact estimé : +15-20% CA (capter flux matin/soir).</li>';
  }

  // Opportunité 3: Diversification
  html += '<li>🛒 <strong>Diversification revenus</strong> : Développer activités complémentaires (vape, souvenirs, confiserie, services). Objectif : réduire dépendance activité réglementée.</li>';

  // Opportunité 4: Digitalisation
  html += '<li>📱 <strong>Digitalisation</strong> : Click & collect, livraison, programme fidélité digital. Coût : 2-3k€. ROI 12-18 mois.</li>';

  // Opportunité 5: Renégociation loyer
  if (immobilier?.simulationLoyer?.scenarios?.realiste?.economieAnnuelle > 0) {
    html += '<li>💰 <strong>Économie loyer</strong> : Renégociation peut générer ' + immobilier.simulationLoyer.scenarios.realiste.economieAnnuelle.toLocaleString('fr-FR') + '€/an d\'économie (améliore cash-flow immédiatement).</li>';
  }

  html += '</ul>';

  // ========================================
  // Sous-section 3: Checklist Due Diligence
  // ========================================
  html += '<h3>📋 Checklist Due Diligence (avant signature)</h3>';
  html += '<table><thead><tr><th>Point de Contrôle</th><th>Statut</th><th>Action Requise</th></tr></thead><tbody>';

  const checklist = [
    {
      item: 'Bail commercial (3-6-9 ans minimum)',
      status: immobilier?.bail ? 'ok' : 'missing',
      action: 'Demander bail original + avenants'
    },
    {
      item: 'Liasse fiscale 3 dernières années',
      status: comptable?.sig?.length >= 3 ? 'ok' : 'partial',
      action: 'Obtenir liasses complètes certifiées'
    },
    {
      item: 'Carte débitant tabac (si applicable)',
      status: 'unknown',
      action: 'Vérifier validité + procédure transfert préfecture'
    },
    {
      item: 'Contrats fournisseurs (FDJ, PMU, etc.)',
      status: 'unknown',
      action: 'Lister + vérifier clauses transfert'
    },
    {
      item: 'Conformité ERP & accessibilité',
      status: 'unknown',
      action: 'Audit sécurité incendie + handicap'
    },
    {
      item: 'État des stocks (valorisation)',
      status: 'unknown',
      action: 'Inventaire contradictoire à la date de cession'
    },
    {
      item: 'Litiges en cours (prud\'hommes, fiscal)',
      status: 'unknown',
      action: 'Attestation vendeur + recherche Infogreffe'
    }
  ];

  checklist.forEach(item => {
    const statusBadge = item.status === 'ok'
      ? '<span class="badge success">✅ OK</span>'
      : item.status === 'partial'
      ? '<span class="badge warning">⚠️ Partiel</span>'
      : '<span class="badge error">❌ À vérifier</span>';

    html += `<tr>
      <td>${item.item}</td>
      <td>${statusBadge}</td>
      <td>${item.action}</td>
    </tr>`;
  });

  html += '</tbody></table>';

  // ========================================
  // Sous-section 4: Négociation - Arguments Clés
  // ========================================
  html += '<h3>🎯 Arguments de Négociation</h3>';
  html += '<div class="chart-row">';

  // Arguments acheteur (pression à la baisse)
  html += '<div style="flex:1">';
  html += '<h4 style="color:#f59e0b">Arguments Acheteur (pression à la baisse)</h4>';
  html += '<ul class="warning-list">';

  if (comptable?.alertes?.some((a: any) => a.severite === 'critical')) {
    html += '<li>Alertes comptables critiques détectées (voir section Validation)</li>';
  }
  if (immobilier?.simulationLoyer?.comparaison?.appreciation === 'desavantageux') {
    const ecart = Math.abs(immobilier.simulationLoyer.comparaison.ecartPourcentage || 0);
    html += '<li>Loyer surévalué (+' + ecart.toFixed(0) + '% vs marché)</li>';
  }
  if (immobilier?.travaux?.budget_total) {
    const totalTravaux = (immobilier.travaux.budget_total.obligatoire_haut || 0) + (immobilier.travaux.budget_total.recommande_haut || 0);
    if (totalTravaux > 10000) {
      html += '<li>Travaux de mise aux normes nécessaires (' + totalTravaux.toLocaleString('fr-FR') + '€)</li>';
    }
  }
  if (comptable?.evolution?.ebe_evolution_pct < 0) {
    html += '<li>Baisse tendancielle de rentabilité (EBE ' + comptable.evolution.ebe_evolution_pct.toFixed(0) + '%)</li>';
  }
  html += '<li>Incertitudes conjoncturelles (inflation, pouvoir achat consommateurs)</li>';

  html += '</ul></div>';

  // Arguments vendeur (maintien prix)
  html += '<div style="flex:1">';
  html += '<h4 style="color:#10b981">Arguments Vendeur (maintien prix)</h4>';
  html += '<ul class="strength-list">';

  if (comptable?.ratios?.marge_ebe > 10) {
    html += '<li>Marge EBE solide (' + comptable.ratios.marge_ebe.toFixed(0) + '%)</li>';
  }
  if (businessInfo?.zone_touristique) {
    html += '<li>Emplacement premium en zone touristique</li>';
  }
  html += '<li>Clientèle fidèle et récurrente</li>';
  if (businessInfo?.activite_principale?.includes('tabac')) {
    html += '<li>Activité réglementée (barrière à l\'entrée)</li>';
  }
  html += '<li>Potentiel de croissance inexploité</li>';

  html += '</ul></div>';
  html += '</div>'; // End chart-row

  return html;
}

/**
 * Analyse les données et génère les commentaires stratégiques pertinents
 */
function analyzeAndGenerateCommentaries(comptable: any, immobilier: any, userComments: any, businessInfo: any, valorisation: any): string[] {
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

  if (croissanceCA < 5) {
    commentaries.push(generateStrategicCommentary(
      'Potentiel de croissance sous-exploité',
      `CA stagnant (${croissanceCA.toFixed(1)}% sur 3 ans). **Leviers identifiés** :
      1. Extension horaires d'ouverture (actuellement ${businessInfo?.horaires_fermeture || 'non renseigné'})
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

  // 10. STRATÉGIE DE FINANCEMENT
  const apportPersonnel = businessInfo?.apport_personnel || (valeurRecommandee * 0.30);
  const montantEmprunt = valeurRecommandee - apportPersonnel;
  const ebeNormatif = comptable?.ebeRetraitement?.ebe_normatif || comptable?.sig?.[comptable.yearsAnalyzed?.[0]]?.ebe || 0;
  const annuiteMax = ebeNormatif * 0.7; // 70% de l'EBE max pour annuité
  const dureeMax = annuiteMax > 0 ? montantEmprunt / annuiteMax : 0;

  if (valeurRecommandee > 0 && ebeNormatif > 0) {
    commentaries.push(generateStrategicCommentary(
      'Plan de financement & capacité d\'endettement',
      `Valorisation ${valeurRecommandee.toLocaleString('fr-FR')}€. Avec apport ${apportPersonnel.toLocaleString('fr-FR')}€ (${((apportPersonnel/valeurRecommandee)*100).toFixed(0)}%), emprunt nécessaire : ${montantEmprunt.toLocaleString('fr-FR')}€.
      **Capacité de remboursement** : EBE normatif ${ebeNormatif.toLocaleString('fr-FR')}€/an → annuité max ${annuiteMax.toLocaleString('fr-FR')}€ (70% EBE). Durée emprunt : ${dureeMax.toFixed(1)} ans.
      ${dureeMax > 7 ? '⚠️ **Alerte** : Durée > 7 ans = risque bancaire. Négocier prix à la baisse ou augmenter apport.' : '✅ Financement viable sur durée classique (5-7 ans).'}
      **Garanties attendues** : Nantissement fonds, caution personnelle dirigeant, assurance décès-invalidité.`
    ));
  }

  return commentaries;
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

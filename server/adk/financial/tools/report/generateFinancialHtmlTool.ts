import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';

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
    try {
      // Lire tous les states
      let businessInfo = parseState(toolContext?.state.get('businessInfo'));
      let documentExtraction = parseState(toolContext?.state.get('documentExtraction'));
      let comptable = parseState(toolContext?.state.get('comptable'));
      let valorisation = parseState(toolContext?.state.get('valorisation'));
      let immobilier = parseState(toolContext?.state.get('immobilier'));
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

      // 6. Validation & fiabilité
      html += generateValidationSection(financialValidation, params.charts.confidenceRadar);
      sections_included.push('validation');

      // 7. Annexes
      html += generateAnnexes(documentExtraction, comptable, valorisation);
      sections_included.push('annexes');

      // Footer
      html += generateFooter();

      html += '</div></body></html>';

      return {
        html,
        sections_included
      };

    } catch (error: any) {
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
  th, td { text-align: left; padding: 12px; border-bottom: 1px solid #e5e7eb; }
  th { background: #f8fafc; font-weight: 600; color: #374151; }
  tr:hover { background: #f9fafb; }
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
  .alert-box { padding: 15px; margin: 10px 0; border-left: 4px solid; border-radius: 4px; }
  .alert-box.critical { background: #fef2f2; border-color: #dc2626; color: #991b1b; }
  .alert-box.warning { background: #fffbeb; border-color: #f59e0b; color: #92400e; }
  .alert-box.info { background: #eff6ff; border-color: #3b82f6; color: #1e40af; }

  /* Info grid */
  .info-grid { display: grid; grid-template-columns: 200px 1fr; gap: 15px; margin: 15px 0; }
  .info-label { font-weight: bold; color: #666; }
  .info-value { color: #333; }

  /* Footer */
  .footer { margin-top: 60px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #666; font-size: 0.9em; }

  /* Page break for print */
  .page-break { page-break-after: always; }

  @media print {
    body { background: white; padding: 0; }
    .container { box-shadow: none; }
    .page-break { page-break-after: always; }
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

  // Graphique fourchettes
  html += '<div class="chart-container"><canvas id="valorisationChart"></canvas></div>';
  html += `<script>
  new Chart(document.getElementById('valorisationChart'), ${JSON.stringify(valorisationChart)});
  </script>`;

  // Tableau comparatif
  html += '<h3>Comparaison des Méthodes de Valorisation</h3>';
  html += '<table><thead><tr><th>Méthode</th><th class="text-right">Fourchette Basse</th><th class="text-right">Médiane</th><th class="text-right">Fourchette Haute</th></tr></thead><tbody>';

  // Support BOTH structures (backward compatibility) - IDENTIQUE à generateChartsTool.ts
  const methodes = valorisation.methodes || {
    ebe: valorisation.methodeEBE,
    ca: valorisation.methodeCA,
    patrimoniale: valorisation.methodePatrimoniale
  };

  if (methodes?.ebe && methodes.ebe.valeur_mediane > 0) {
    const ebe = methodes.ebe;
    html += `<tr>
      <td><strong>Méthode EBE</strong> (${ebe.coefficient_bas}x - ${ebe.coefficient_haut}x)</td>
      <td class="text-right">${(ebe.valeur_basse || 0).toLocaleString('fr-FR')} €</td>
      <td class="text-right">${(ebe.valeur_mediane || 0).toLocaleString('fr-FR')} €</td>
      <td class="text-right">${(ebe.valeur_haute || 0).toLocaleString('fr-FR')} €</td>
    </tr>`;
  }

  if (methodes?.ca && methodes.ca.valeur_mediane > 0) {
    const ca = methodes.ca;
    html += `<tr>
      <td><strong>Méthode CA</strong> (${ca.pourcentage_bas}% - ${ca.pourcentage_haut}% CA)</td>
      <td class="text-right">${(ca.valeur_basse || 0).toLocaleString('fr-FR')} €</td>
      <td class="text-right">${(ca.valeur_mediane || 0).toLocaleString('fr-FR')} €</td>
      <td class="text-right">${(ca.valeur_haute || 0).toLocaleString('fr-FR')} €</td>
    </tr>`;
  }

  if (methodes?.patrimoniale) {
    const patri = methodes.patrimoniale;
    const valeurPatri = patri.valeur_estimee || 0;
    html += `<tr>
      <td><strong>Méthode Patrimoniale</strong> (Actif Net + Goodwill)</td>
      <td class="text-right" colspan="3">${valeurPatri.toLocaleString('fr-FR')} €${valeurPatri === 0 ? ' <em style="color:#999">(bilan non fourni)</em>' : ''}</td>
    </tr>`;
    // Ajouter détail patrimonial
    if (patri.actif_net_comptable) {
      html += `<tr style="font-size:0.9em; color:#666">
        <td style="padding-left:30px">Actif net comptable</td>
        <td class="text-right" colspan="3">${(patri.actif_net_comptable || 0).toLocaleString('fr-FR')} €</td>
      </tr>`;
    }
    if (patri.goodwill) {
      html += `<tr style="font-size:0.9em; color:#666">
        <td style="padding-left:30px">Goodwill (survaleur)</td>
        <td class="text-right" colspan="3">${(patri.goodwill || 0).toLocaleString('fr-FR')} €</td>
      </tr>`;
    }
  }

  html += '</tbody></table>';

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

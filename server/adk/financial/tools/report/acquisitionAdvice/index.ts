/**
 * Acquisition Advice Module
 *
 * Main orchestrator for the acquisition advice section of financial reports.
 * Combines geographic context, financing projections, negotiation strategies.
 */

// Re-export types
export * from './types';

// Import sub-modules
import { parseProfessionalReport } from './context';
import {
  detectHorairesExtension,
  generateFinancingSection,
  generateRisksSection,
  generateOpportunitiesSection,
  generateChecklistSection
} from './financing';
import {
  generateBenchmarkSection,
  generateZopaSection,
  generateNegotiationGrid
} from './negotiation';
import { generateNibblesSection } from './nibbles';
import type { AcquisitionAdviceParams, ProfessionalReportData } from './types';
import { getBenchmarkByNaf } from './types';

// Re-export for external use
export { parseProfessionalReport, detectHorairesExtension };

/**
 * Generate the complete acquisition advice section
 */
export function generateAcquisitionAdviceSection(params: AcquisitionAdviceParams): string {
  const {
    comptable,
    valorisation,
    immobilier,
    businessInfo,
    userComments,
    businessPlan,
    professionalData
  } = params;

  let html = '<div class="page-break"></div>';
  html += '<h2>Conseils pour le Rachat</h2>';

  // Get sector code and benchmark
  const sectorCode = businessInfo?.secteurActivite || businessInfo?.nafCode || businessInfo?.naf_code || '';
  const sectorBenchmark = comptable?.benchmark;
  const benchmarkLabel = sectorBenchmark?.sector || getBenchmarkByNaf(sectorCode).label;

  // Valeurs cles
  const valeurRecommandee = valorisation?.synthese?.valeur_recommandee || 0;
  const valeurBasse = valorisation?.synthese?.valeur_basse || valeurRecommandee * 0.85;
  const valeurHaute = valorisation?.synthese?.valeur_haute || valeurRecommandee * 1.15;

  // Section 0: Contexte Geographique
  if (professionalData) {
    html += generateContextSection(professionalData);
  }

  // Section 1: Projections Financement
  html += generateFinancingSection(businessPlan, comptable, valeurRecommandee);

  // Section 2: Risques & Mitigation
  html += generateRisksSection(comptable, immobilier, businessPlan, professionalData);

  // Section 3: Opportunites
  html += generateOpportunitiesSection(comptable, immobilier, userComments, professionalData, sectorCode);

  // Section 4: Checklist Due Diligence
  html += generateChecklistSection(comptable, immobilier);

  // Section 5: Benchmark Sectoriel
  html += generateBenchmarkSection(comptable, valorisation, sectorCode, benchmarkLabel);

  // Section 6: Strategie de Negociation (ZOPA + Arguments)
  html += generateZopaSection(valeurBasse, valeurHaute, valeurRecommandee);
  html += generateNegotiationGrid(comptable, immobilier, professionalData, sectorCode);

  // Section 7: Concessions (Nibbles)
  html += generateNibblesSection();

  return html;
}

/**
 * Generate geographic context section from professional report data
 */
function generateContextSection(professionalData: ProfessionalReportData): string {
  let html = '<div class="context-box">';
  html += `<h4>Contexte Local : ${professionalData.commune.nom || 'Commune'}</h4>`;
  html += '<div class="context-grid">';

  html += `<div class="context-item">
    <span class="icon">👥</span>
    <div><span class="label">Population</span><br/><span class="value">${professionalData.commune.population.toLocaleString('fr-FR')} habitants</span></div>
  </div>`;

  html += `<div class="context-item">
    <span class="icon">🏘️</span>
    <div><span class="label">Densite</span><br/><span class="value">${professionalData.commune.densite || 'Non renseignee'}</span></div>
  </div>`;

  html += `<div class="context-item">
    <span class="icon">💼</span>
    <div><span class="label">Profil clientele</span><br/><span class="value">${professionalData.commune.csp || 'Mixte'}</span></div>
  </div>`;

  html += `<div class="context-item">
    <span class="icon">📈</span>
    <div><span class="label">Dynamisme economique</span><br/><span class="value">${professionalData.dynamisme.charAt(0).toUpperCase() + professionalData.dynamisme.slice(1)}</span></div>
  </div>`;

  if (professionalData.saisonnalite.touristique) {
    html += `<div class="context-item">
      <span class="icon">🏖️</span>
      <div><span class="label">Saisonnalite</span><br/><span class="value">Zone touristique - Forte variation</span></div>
    </div>`;
  }

  html += `<div class="context-item">
    <span class="icon">📊</span>
    <div><span class="label">Score Emplacement</span><br/><span class="value">${professionalData.scores.location}/100</span></div>
  </div>`;

  html += '</div>';
  html += '</div>';

  return html;
}

export default generateAcquisitionAdviceSection;

/**
 * Negotiation Module
 *
 * Generates ZOPA visualization and buyer/seller arguments.
 */

import type { ProfessionalReportData, SectorBenchmark } from './types';
import { getBenchmarkByNaf } from './types';

/**
 * Generate benchmark section
 */
export function generateBenchmarkSection(
  comptable: any,
  valorisation: any,
  sectorCode: string,
  benchmarkLabel: string
): string {
  const benchmark = getBenchmarkByNaf(sectorCode);
  const valeurRecommandee = valorisation?.synthese?.valeur_recommandee || 0;

  let html = '<div class="benchmark-section">';
  html += `<h4>Benchmark Sectoriel : ${benchmarkLabel}</h4>`;
  html += '<table class="benchmark-table">';
  html += '<thead><tr><th>Methode</th><th>Multiple Marche</th><th>Votre Valorisation</th><th>Coherence</th></tr></thead>';
  html += '<tbody>';

  // Multiple EBE
  const ebeNormatif = comptable?.ebeRetraitement?.ebe_normatif || 0;
  const multipleEBECalcule = ebeNormatif > 0 ? valeurRecommandee / ebeNormatif : 0;
  const ebeCoherent = multipleEBECalcule >= benchmark.multipleEBE.min && multipleEBECalcule <= benchmark.multipleEBE.max;

  html += `<tr>
    <td>Multiple EBE</td>
    <td>${benchmark.multipleEBE.min}x - ${benchmark.multipleEBE.max}x EBE</td>
    <td>${multipleEBECalcule.toFixed(1)}x</td>
    <td>${ebeCoherent ? '<span class="badge success">OK</span>' : '<span class="badge warning">Hors norme</span>'}</td>
  </tr>`;

  // Multiple CA
  const caRecent = comptable?.sig?.[comptable.yearsAnalyzed?.[0]]?.chiffre_affaires || 0;
  const multipleCACalcule = caRecent > 0 ? valeurRecommandee / caRecent : 0;
  const caCoherent = multipleCACalcule >= benchmark.multipleCA.min && multipleCACalcule <= benchmark.multipleCA.max;

  html += `<tr>
    <td>Multiple CA</td>
    <td>${(benchmark.multipleCA.min * 100).toFixed(0)}% - ${(benchmark.multipleCA.max * 100).toFixed(0)}% CA</td>
    <td>${(multipleCACalcule * 100).toFixed(0)}%</td>
    <td>${caCoherent ? '<span class="badge success">OK</span>' : '<span class="badge warning">Hors norme</span>'}</td>
  </tr>`;

  html += '</tbody></table>';
  html += `<p style="font-size:0.9em;color:var(--color-text-muted);margin-top:10px;"><strong>Specificites secteur :</strong> ${benchmark.specificites}</p>`;
  html += '</div>';

  return html;
}

/**
 * Generate ZOPA visualization
 */
export function generateZopaSection(
  valeurBasse: number,
  valeurHaute: number,
  valeurRecommandee: number
): string {
  const ancrageAcheteur = Math.round(valeurBasse * 0.85);
  const ancrageVendeur = Math.round(valeurHaute * 1.1);

  let html = '<h3>Strategie de Negociation</h3>';
  html += '<div class="zopa-section">';
  html += '<h4>Zone d\'Accord Probable (ZOPA)</h4>';
  html += '<div class="zopa-visual">';
  html += '<div class="range-bar">';
  html += `<span class="anchor-low">${ancrageAcheteur.toLocaleString('fr-FR')}€<br/><small>Ancrage acheteur</small></span>`;
  html += `<span class="zopa-zone">${valeurBasse.toLocaleString('fr-FR')}€ - ${valeurHaute.toLocaleString('fr-FR')}€</span>`;
  html += `<span class="anchor-high">${ancrageVendeur.toLocaleString('fr-FR')}€<br/><small>Ancrage vendeur</small></span>`;
  html += '</div>';
  html += '</div>';
  html += `<div class="zopa-target">Valeur cible recommandee : <strong>${valeurRecommandee.toLocaleString('fr-FR')} €</strong></div>`;
  html += '</div>';

  return html;
}

/**
 * Generate buyer arguments
 */
export function generateBuyerArguments(
  comptable: any,
  immobilier: any,
  professionalData: ProfessionalReportData | null
): string {
  let html = '<div class="buyer-arguments">';
  html += '<h4>Arguments Acheteur (pression a la baisse)</h4>';
  html += '<table class="argument-table">';
  html += '<thead><tr><th>Argument</th><th>Impact</th><th>Justification</th></tr></thead>';
  html += '<tbody>';

  // Argument 1: Evolution EBE
  if (comptable?.evolution?.ebe_evolution_pct < 0) {
    const impact = Math.abs(comptable.evolution.ebe_evolution_pct) > 10 ? '-10 a -15%' : '-5 a -10%';
    html += `<tr>
      <td>EBE en baisse (${comptable.evolution.ebe_evolution_pct.toFixed(0)}%)</td>
      <td class="impact negative">${impact}</td>
      <td>Tendance defavorable = risque accru</td>
    </tr>`;
  }

  // Argument 2: Travaux
  if (immobilier?.travaux?.budget_total) {
    const totalTravaux = (immobilier.travaux.budget_total.obligatoire_haut || 0) + (immobilier.travaux.budget_total.recommande_haut || 0);
    if (totalTravaux > 10000) {
      html += `<tr>
        <td>Travaux necessaires</td>
        <td class="impact negative">-${totalTravaux.toLocaleString('fr-FR')}€</td>
        <td>Investissement immediat requis post-acquisition</td>
      </tr>`;
    }
  }

  // Argument 3: Loyer
  if (immobilier?.simulationLoyer?.comparaison?.appreciation === 'desavantageux') {
    const ecart = Math.abs(immobilier.simulationLoyer.comparaison.ecartPourcentage || 0);
    html += `<tr>
      <td>Loyer superieur au marche (+${ecart.toFixed(0)}%)</td>
      <td class="impact negative">-5 a -10%</td>
      <td>Charge fixe excessive, renegociation incertaine</td>
    </tr>`;
  }

  // Argument 4: Reputation
  if (professionalData && professionalData.scores.market < 50) {
    html += `<tr>
      <td>Reputation a reconstruire (score ${professionalData.scores.market}/100)</td>
      <td class="impact negative">-5 a -10%</td>
      <td>Cout rebranding + temps de reconstruction clientele</td>
    </tr>`;
  }

  // Argument generique
  html += `<tr>
    <td>Incertitudes economiques 2025</td>
    <td class="impact negative">-3 a -5%</td>
    <td>Inflation, pouvoir d'achat, evolutions reglementaires</td>
  </tr>`;

  html += '</tbody></table>';
  html += '</div>';

  return html;
}

/**
 * Generate seller arguments
 */
export function generateSellerArguments(
  comptable: any,
  professionalData: ProfessionalReportData | null,
  sectorCode: string
): string {
  // ✅ FIX (2025-12-31): Vérification stricte sur secteur du formulaire (pas de .includes())
  const isTabac = sectorCode === '47.26' || sectorCode === '47.62';

  let html = '<div class="seller-arguments">';
  html += '<h4>Arguments Vendeur (maintien du prix)</h4>';
  html += '<table class="argument-table">';
  html += '<thead><tr><th>Argument</th><th>Force</th><th>Contre-argument acheteur</th></tr></thead>';
  html += '<tbody>';

  // Argument 1: Emplacement
  if (professionalData && professionalData.scores.location >= 70) {
    html += `<tr>
      <td>Emplacement premium (score ${professionalData.scores.location}/100)</td>
      <td class="impact positive">Fort</td>
      <td>Deja integre dans la valorisation de marche</td>
    </tr>`;
  }

  // Argument 2: Marge
  if (comptable?.ratios?.marge_ebe > 10) {
    html += `<tr>
      <td>Marge EBE solide (${comptable.ratios.marge_ebe.toFixed(0)}%)</td>
      <td class="impact positive">Fort</td>
      <td>Marge EBE ≠ rentabilite nette post-reprise</td>
    </tr>`;
  }

  // Argument 3: Activite reglementee
  if (isTabac) {
    html += `<tr>
      <td>Activite reglementee (barriere entree)</td>
      <td class="impact positive">Fort</td>
      <td>Licence non transferable automatiquement (delai prefecture)</td>
    </tr>`;
  }

  // Argument 4: Clientele fidele (seulement si "Reputation a reconstruire" n'est PAS affiche cote acheteur)
  if (!professionalData || professionalData.scores.market >= 50) {
    html += `<tr>
      <td>Clientele fidele etablie</td>
      <td class="impact positive">Moyen</td>
      <td>Fidelite liee au vendeur, pas au fonds. Risque de fuite.</td>
    </tr>`;
  }

  // Argument 5: Potentiel (seulement si "EBE en baisse" n'est PAS affiche cote acheteur)
  if (!(comptable?.evolution?.ebe_evolution_pct < 0)) {
    html += `<tr>
      <td>Potentiel de croissance inexploite</td>
      <td class="impact positive">Moyen</td>
      <td>Risque non garanti. Valoriser au reel, pas au potentiel.</td>
    </tr>`;
  }

  html += '</tbody></table>';
  html += '</div>';

  return html;
}

/**
 * Generate full negotiation grid
 */
export function generateNegotiationGrid(
  comptable: any,
  immobilier: any,
  professionalData: ProfessionalReportData | null,
  sectorCode: string
): string {
  let html = '<div class="negotiation-grid">';
  html += generateBuyerArguments(comptable, immobilier, professionalData);
  html += generateSellerArguments(comptable, professionalData, sectorCode);
  html += '</div>';
  return html;
}

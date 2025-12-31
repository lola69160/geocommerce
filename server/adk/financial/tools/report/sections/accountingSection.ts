/**
 * Accounting Section
 *
 * Generates the accounting analysis section with SIG, EBE retraitement, ratios, and benchmarks.
 *
 * ⚠️ RÈGLE FONDAMENTALE (2025-12-29):
 * Les données historiques (années N, N-1, N-2...) proviennent UNIQUEMENT de comptable.sig
 * qui contient les valeurs extraites des documents comptables (sans recalcul).
 * Si une valeur n'est pas disponible, afficher "N/A" - PAS de fallback.
 */

// ⚠️ DEPRECATED (2025-12-29) - NE PLUS UTILISER CETTE FONCTION
// Les données historiques doivent provenir de comptable.sig uniquement.
// Cette fonction est conservée pour référence mais ne doit plus être appelée.
function getExtractedValueForYear(
  _documentExtraction: any,
  _year: string,
  _field: string
): number {
  console.warn('[accountingSection] ⚠️ DEPRECATED: getExtractedValueForYear() ne doit plus être appelée - utiliser comptable.sig uniquement');
  return 0; // Toujours retourner 0 - pas de fallback
}

/**
 * Generate the accounting section HTML
 */
export function generateAccountingSection(
  comptable: any,
  evolutionChart: any,
  healthGauge: any,
  projectedHealthGauge: any, // ✅ ADD parameter
  businessPlan?: any,
  userComments?: any,
  documentExtraction?: any,
  businessInfo?: any
): string {
  if (!comptable) {
    return '<h2>📈 Analyse Comptable</h2><p class="no-data">Données comptables non disponibles</p>';
  }

  let html = '<h2>📈 Analyse Comptable</h2>';

  // Tableau SIG avec colonne Budget Prévisionnel N+1
  if (comptable.sig) {
    html += '<h3>Soldes Intermédiaires de Gestion (SIG)</h3>';
    html += '<table><thead><tr><th>Indicateur</th>';

    // ✅ FIX Issue #3: Années en ordre croissant (2021, 2022, 2023) au lieu de décroissant
    const years = Object.keys(comptable.sig).sort();
    years.forEach(y => {
      html += `<th class="text-right">${y}</th>`;
    });

    // Colonne Budget Prévisionnel N+1 (si Business Plan disponible)
    const hasBusinessPlan = businessPlan?.projections?.[1];
    if (hasBusinessPlan) {
      html += `<th class="text-right budget-header">BUDGET N+1<br/><small>(Scénario retenu)</small></th>`;
    }
    html += '</tr></thead><tbody>';

    // Helper pour extraire valeur SIG (nouveau ou ancien format)
    const extractValue = (rawValue: any) =>
      typeof rawValue === 'object' && rawValue !== null ? rawValue.valeur : (rawValue || 0);

    // Indicateurs principaux avec sous-lignes pour détails
    // ⚠️ ventes_marchandises et production_vendue_services sont CRITIQUES pour Tabac/Presse
    const indicators = [
      { key: 'chiffre_affaires', label: 'Chiffre d\'Affaires', bpKey: 'ca' },
      { key: 'ventes_marchandises', label: '└─ Ventes Marchandises', isSubRow: true, bpKey: null },
      { key: 'production_vendue_services', label: '└─ Commissions/Services', isSubRow: true, bpKey: null },
      { key: 'marge_commerciale', label: 'Marge Commerciale', bpKey: null },
      { key: 'marge_brute_globale', label: 'Marge Brute Globale', bpKey: 'marge_brute' },
      { key: 'autres_achats_charges_externes', label: 'Charges Externes', bpKey: 'charges_externes' },  // ✅ FIX (2025-12-30): charges_externes au lieu de charges_fixes
      { key: 'loyer', label: '└─ dont Loyer', isSubRow: true, bpKey: 'loyer' },
      { key: 'charges_personnel', label: 'Frais de Personnel', bpKey: 'salaires' },
      { key: 'salaire_gerant', label: '└─ dont Salaire Gérant', isSubRow: true, bpKey: 'salaire_dirigeant' },
      { key: 'ebe', label: 'EBE (EBITDA)', bpKey: 'ebe_normatif', highlight: true },
      { key: 'resultat_exploitation', label: 'Résultat d\'Exploitation', bpKey: null },
      { key: 'resultat_net', label: 'Résultat Net', bpKey: null }
    ];

    // Dernière année pour extraire les données actuelles
    const lastYear = years[0];
    const sigLastYear = comptable.sig[lastYear] || {};

    // Projection Année 1 (Reprise)
    const proj = businessPlan?.projections?.[1];

    indicators.forEach(ind => {
      const rowClass = ind.isSubRow ? 'sub-row' : '';
      const labelStyle = ind.isSubRow ? 'padding-left: 25px; color: var(--color-text-muted); font-size: 0.95em;' : '';

      html += `<tr class="${rowClass}"><td style="${labelStyle}"><strong>${ind.label}</strong></td>`;

      // Colonnes années historiques
      // ⚠️ EXTRACTION STRICTE: Pas de fallback vers documentExtraction
      years.forEach(y => {
        let value: number | undefined = undefined;
        let isNA = false;

        if (ind.isSubRow) {
          // Sous-lignes: extraire depuis SIG avec cas spéciaux
          if (ind.key === 'loyer') {
            // Loyer: SIG charges_locatives > userComments loyer_actuel_mensuel * 12
            const sigLoyer = extractValue(comptable.sig[y]?.charges_locatives);
            const userLoyer = userComments?.loyer?.loyer_actuel_mensuel;
            value = sigLoyer > 0 ? sigLoyer : (userLoyer ? userLoyer * 12 : 0);
          } else if (ind.key === 'salaire_gerant') {
            // Salaire gérant: SIG charges_exploitant uniquement
            value = extractValue(comptable.sig[y]?.charges_exploitant) || 0;
          } else {
            // Fallback générique pour sous-lignes (ventes_marchandises, production_vendue_services, etc.)
            value = extractValue(comptable.sig[y]?.[ind.key]);
            // Pour les sous-lignes, afficher 0 si non disponible (pas N/A)
            if (value === undefined || value === null) {
              value = 0;
            }
          }
        } else if (ind.key === 'charges_personnel') {
          // ✅ FIX (2025-12-30): Frais de Personnel = salaires + charges sociales + charges exploitant
          // ⚠️ PAS DE FALLBACK - utiliser uniquement les valeurs de comptable.sig
          const salaires = extractValue(comptable.sig[y]?.salaires_personnel) || 0;
          const chargesSociales = extractValue(comptable.sig[y]?.charges_sociales_personnel) || 0;
          const chargesExploitant = extractValue(comptable.sig[y]?.charges_exploitant) || 0;
          value = salaires + chargesSociales + chargesExploitant;

          // Si somme = 0, essayer le champ charges_personnel direct
          if (value === 0) {
            value = extractValue(comptable.sig[y]?.charges_personnel) || 0;
          }
        } else {
          // ⚠️ EXTRACTION STRICTE: Utiliser comptable.sig uniquement
          // PAS DE FALLBACK vers documentExtraction
          value = extractValue(comptable.sig[y]?.[ind.key]);

          // Marquer comme N/A si la valeur n'existe pas (undefined ou null)
          if (value === undefined || value === null) {
            isNA = true;
            value = 0;
          }
        }

        // Affichage: valeur formatée ou "-" (ou "N/A" si explicitement marqué)
        if (isNA) {
          html += `<td class="text-right text-muted">N/A</td>`;
        } else {
          const displayValue = value ?? 0;
          html += `<td class="text-right">${displayValue > 0 ? displayValue.toLocaleString('fr-FR') + ' €' : '-'}</td>`;
        }
      });

      // Colonne Budget Prévisionnel N+1
      if (hasBusinessPlan) {
        let budgetValue = 0;
        let cellStyle = '';

        if (ind.bpKey) {
          // Mapping des clés Business Plan
          if (ind.bpKey === 'ca') {
            budgetValue = proj.ca || 0;
          } else if (ind.bpKey === 'marge_brute') {
            budgetValue = proj.marge_brute || (proj.ca ? proj.ca * 0.68 : 0); // Fallback 68%
          } else if (ind.bpKey === 'charges_externes') {
            // ✅ FIX (2025-12-30): Charges Externes = autres_charges + loyer (sans salaires)
            budgetValue = (proj.charges_detail?.autres_charges || 0) + (proj.charges_detail?.loyer || 0);
          } else if (ind.bpKey === 'charges_fixes') {
            budgetValue = proj.charges_fixes || 0;
          } else if (ind.bpKey === 'loyer') {
            budgetValue = proj.charges_detail?.loyer ||
              (userComments?.loyer?.futur_loyer_commercial ? userComments.loyer.futur_loyer_commercial * 12 : 0);
          } else if (ind.bpKey === 'salaires') {
            budgetValue = proj.charges_detail?.salaires || 0;
          } else if (ind.bpKey === 'salaire_dirigeant') {
            budgetValue = businessPlan?.hypotheses?.salaire_dirigeant || userComments?.salaire_dirigeant || 0;
          } else if (ind.bpKey === 'ebe_normatif') {
            budgetValue = proj.ebe_normatif || 0;
          }
        }

        // Style spécial pour EBE (surbrillance verte)
        if (ind.highlight && budgetValue > 0) {
          cellStyle = 'background: #d1fae5; color: #065f46; font-weight: 700;';
        }

        html += `<td class="text-right" style="${cellStyle}">`;
        html += budgetValue > 0 ? `<strong>${budgetValue.toLocaleString('fr-FR')} €</strong>` : '-';
        html += '</td>';
      }

      html += '</tr>';
    });

    html += '</tbody></table>';

    // Note explicative (si Business Plan disponible)
    if (hasBusinessPlan) {
      html += `
      <div class="nota-bene" style="margin-top: 15px; padding: 12px; background: #f0f9ff; border-left: 4px solid #0284c7; font-style: italic; color: #0369a1;">
        <strong>Nota Bene :</strong> L'EBE prévisionnel intègre la révision des charges locatives et salariales prévue dans le scénario de reprise.
      </div>
      `;
    }
  }

  // Tableau de Retraitement EBE (Pont EBE)
  if (comptable.ebeRetraitement && comptable.ebeRetraitement.ebe_normatif) {
    html += generateEbeBridgeTable(comptable.ebeRetraitement);
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

  // ✅ MODIFIED: Gauges (Current + Projected if available)
  const hasProjectedScore = projectedHealthGauge !== null;

  if (hasProjectedScore) {
    // Side-by-side gauges
    html += '<div style="display: flex; gap: 20px;">';
    html += '<div style="flex: 1;"><h4 style="text-align: center;">Santé Actuelle (Année N)</h4><div class="chart-container"><canvas id="healthGauge"></canvas></div></div>';
    html += '<div style="flex: 1;"><h4 style="text-align: center;">Santé Projetée (Année N+1)</h4><div class="chart-container"><canvas id="projectedHealthGauge"></canvas></div></div>';
    html += '</div>';
  } else {
    // Single gauge (backward compatibility)
    html += '<div><div class="chart-container"><canvas id="healthGauge"></canvas></div></div>';
  }

  html += '</div>';
  html += `<script>
  new Chart(document.getElementById('healthGauge'), ${JSON.stringify(healthGauge)});`;

  if (hasProjectedScore) {
    html += `
  new Chart(document.getElementById('projectedHealthGauge'), ${JSON.stringify(projectedHealthGauge)});`;
  }

  html += `
  </script>`;

  // Benchmark sectoriel
  if (comptable.benchmark) {
    html += generateBenchmarkSection(comptable.benchmark, businessInfo);
  }

  html += '<div class="page-break"></div>';
  return html;
}

/**
 * Generate EBE Retraitement table
 */
/**
 * Generate EBE Bridge table (replaces EBE Retraitement table)
 *
 * Visual design: 3 columns with economic justifications
 * - Column 1: Libellé (description)
 * - Column 2: Flux (€, signed with colors)
 * - Column 3: Justification Économique
 *
 * Style: Same as SIG table (simple, clean, no gradient)
 */
function generateEbeBridgeTable(ebe: any): string {
  let html = '<h3>💡 Pont EBE - De la Capacité Comptable à la Capacité Normatif</h3>';

  // 3-column table (same style as SIG table)
  html += '<table>';
  html += '<thead><tr>';
  html += '<th style="width: 35%">Libellé</th>';
  html += '<th class="text-right" style="width: 20%">Flux (€)</th>';
  html += '<th style="width: 45%">Justification Économique</th>';
  html += '</tr></thead>';
  html += '<tbody>';

  // Line 1: EBE Comptable (Base) - simple row
  html += `<tr>
    <td><strong>EBE Comptable ${ebe.annee_reference} (Base)</strong></td>
    <td class="text-right"><strong>${ebe.ebe_comptable.toLocaleString('fr-FR')} €</strong></td>
    <td><span class="badge info">Donnée certifiée liasse fiscale ${ebe.annee_reference}</span></td>
  </tr>`;

  // Retraitements with badges (green for +, orange for -)
  if (ebe.retraitements && ebe.retraitements.length > 0) {
    ebe.retraitements.forEach((r: any) => {
      const sign = r.montant >= 0 ? '+' : '';
      const color = r.montant >= 0 ? '#10b981' : '#ef4444'; // Green for +, Red for -
      const badgeClass = r.montant >= 0 ? 'success' : 'warning'; // Green badge for +, Orange for -
      const badgeLabel = r.montant >= 0 ? '➕' : '➖';

      html += `<tr>
        <td>
          <span class="badge ${badgeClass}">${badgeLabel}</span>
          ${r.description}
        </td>
        <td class="text-right" style="color:${color}; font-weight: 600;">
          ${sign}${r.montant.toLocaleString('fr-FR')} €
        </td>
        <td style="font-size: 0.95em;">
          ${r.justification || r.commentaire || '-'}
        </td>
      </tr>`;
    });
  }

  // Final line: EBE NORMATIF CIBLE (highlighted row, same style as SIG highlighted rows)
  const ecartSign = ebe.total_retraitements >= 0 ? '+' : '';
  const ecartColor = ebe.total_retraitements >= 0 ? '#10b981' : '#ef4444';

  html += `<tr style="background: #d1fae5; border-top: 2px solid #10b981; font-weight: 700;">
    <td style="color: #065f46;">
      🎯 EBE NORMATIF CIBLE
    </td>
    <td class="text-right" style="font-size: 1.2em; color: #065f46;">
      ${ebe.ebe_normatif.toLocaleString('fr-FR')} €
    </td>
    <td style="color: #065f46;">
      Capacité réelle du repreneur
      <span class="badge success" style="margin-left: 8px;">${ecartSign}${ebe.ecart_pct}%</span>
    </td>
  </tr>`;

  html += '</tbody></table>';

  // Analysis text (generated by ComptableAgent, not the tool)
  if (ebe.analyseDetailleeEbe) {
    html += `<div style="margin-top: 20px; padding: 15px; background: var(--color-bg-light); border-left: 4px solid #0284c7; border-radius: 4px;">
      <strong style="color: #0369a1;">💡 Analyse :</strong>
      <p style="margin-top: 8px; color: var(--color-text-primary); line-height: 1.6;">${ebe.analyseDetailleeEbe}</p>
    </div>`;
  }

  return html;
}

/**
 * Generate benchmark section
 */
function generateBenchmarkSection(benchmark: any, businessInfo?: any): string {
  let html = '<h3>Comparaison Sectorielle</h3>';

  // ✅ FIX: Use user-selected sector label (exact text from dropdown) instead of benchmark.sector
  const sectorLabel = businessInfo?.secteurActiviteLabel || benchmark.sector;
  html += `<p><strong>Secteur:</strong> ${sectorLabel}</p>`;

  if (benchmark.comparisons && benchmark.comparisons.length > 0) {
    html += '<table><thead><tr><th>Ratio</th><th class="text-right">Entreprise</th><th class="text-right">Moyenne Secteur</th><th class="text-center">Position</th></tr></thead><tbody>';

    benchmark.comparisons.slice(0, 6).forEach((comp: any) => {
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

  return html;
}

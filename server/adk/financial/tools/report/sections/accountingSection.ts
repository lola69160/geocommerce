/**
 * Accounting Section
 *
 * Generates the accounting analysis section with SIG, EBE retraitement, ratios, and benchmarks.
 */

/**
 * Generate the accounting section HTML
 */
export function generateAccountingSection(
  comptable: any,
  evolutionChart: any,
  healthGauge: any,
  businessPlan?: any,
  userComments?: any
): string {
  if (!comptable) {
    return '<h2>📈 Analyse Comptable</h2><p class="no-data">Données comptables non disponibles</p>';
  }

  let html = '<h2>📈 Analyse Comptable</h2>';

  // Tableau SIG avec colonne Budget Prévisionnel N+1
  if (comptable.sig) {
    html += '<h3>Soldes Intermédiaires de Gestion (SIG)</h3>';
    html += '<table><thead><tr><th>Indicateur</th>';

    const years = Object.keys(comptable.sig).sort().reverse();
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
    const indicators = [
      { key: 'chiffre_affaires', label: 'Chiffre d\'Affaires', bpKey: 'ca' },
      { key: 'marge_commerciale', label: 'Marge Commerciale', bpKey: null },
      { key: 'marge_brute_globale', label: 'Marge Brute Globale', bpKey: 'marge_brute' },
      { key: 'autres_achats_charges_externes', label: 'Charges Externes', bpKey: 'charges_fixes' },
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
      years.forEach(y => {
        let value = 0;

        if (ind.isSubRow) {
          // Sous-lignes: extraire depuis userComments ou SIG
          if (ind.key === 'loyer') {
            // Loyer annuel depuis userComments ou charges_locatives (afficher '-' si absent)
            const loyerMensuel = userComments?.loyer?.loyer_actuel || userComments?.loyer?.futur_loyer_commercial;
            value = loyerMensuel ? loyerMensuel * 12 : extractValue(comptable.sig[y]?.charges_locatives);
          } else if (ind.key === 'salaire_gerant') {
            // Salaire gérant: userComments > SIG charges_exploitant > 0
            value = userComments?.salaire_dirigeant
              || extractValue(comptable.sig[y]?.charges_exploitant)
              || 0;
          }
        } else if (ind.key === 'charges_personnel') {
          // Frais de Personnel = salaires_personnel + charges_sociales_personnel
          const salaires = extractValue(comptable.sig[y]?.salaires_personnel) || 0;
          const chargesSociales = extractValue(comptable.sig[y]?.charges_sociales_personnel) || 0;
          value = salaires + chargesSociales;
          // Fallback sur le champ charges_personnel direct si disponible
          if (value === 0) {
            value = extractValue(comptable.sig[y]?.charges_personnel) || 0;
          }
        } else {
          value = extractValue(comptable.sig[y]?.[ind.key]);
        }

        html += `<td class="text-right">${value > 0 ? value.toLocaleString('fr-FR') + ' €' : '-'}</td>`;
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

  // Tableau de Retraitement EBE
  if (comptable.ebeRetraitement && comptable.ebeRetraitement.ebe_normatif) {
    html += generateEbeRetraitementTable(comptable.ebeRetraitement);
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
    html += generateBenchmarkSection(comptable.benchmark);
  }

  html += '<div class="page-break"></div>';
  return html;
}

/**
 * Generate EBE Retraitement table
 */
function generateEbeRetraitementTable(ebe: any): string {
  let html = '<h3>💡 Retraitement de l\'EBE - Capacité Normatif du Repreneur</h3>';
  html += '<div class="summary-box">';
  html += '<p style="margin-bottom:15px; color:var(--color-text-secondary)">';
  html += 'L\'EBE Normatif représente la <strong>capacité bénéficiaire réelle</strong> pour le repreneur, après retraitements des éléments non récurrents ou liés au cédant.';
  html += '</p>';

  // Tableau de retraitement
  html += '<table><thead><tr><th>Ligne de Retraitement</th><th class="text-right">Montant</th><th>Source</th></tr></thead><tbody>';

  // Ligne de base (fond neutre)
  html += `<tr>
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

  // Ligne totale (séparateur visuel)
  const ecartColor = ebe.total_retraitements >= 0 ? '#10b981' : '#ef4444';
  html += `<tr style="border-top:2px solid var(--color-text-primary)">
    <td><strong>Total Retraitements</strong></td>
    <td class="text-right" style="color:${ecartColor}"><strong>${ebe.total_retraitements >= 0 ? '+' : ''}${ebe.total_retraitements.toLocaleString('fr-FR')} €</strong></td>
    <td></td>
  </tr>`;

  // Ligne EBE Normatif (fond gris clair + séparateur)
  html += `<tr style="border-top:2px solid var(--color-text-primary); background:var(--color-bg-light)">
    <td><strong>🎯 EBE NORMATIF (Capacité Repreneur)</strong></td>
    <td class="text-right"><strong style="font-size:1.2em; color:var(--color-info-text)">${ebe.ebe_normatif.toLocaleString('fr-FR')} €</strong></td>
    <td><span class="badge success">+${ebe.ecart_pct}%</span></td>
  </tr>`;

  html += '</tbody></table>';

  // Synthèse textuelle
  if (ebe.synthese) {
    html += `<p style="margin-top:15px; padding:10px; background:var(--color-bg-light); border-left:3px solid var(--color-warning-text)">
      <strong>💡 Synthèse:</strong> ${ebe.synthese}
    </p>`;
  }

  html += '</div>';
  return html;
}

/**
 * Generate benchmark section
 */
function generateBenchmarkSection(benchmark: any): string {
  let html = '<h3>Comparaison Sectorielle</h3>';
  html += `<p><strong>Secteur:</strong> ${benchmark.sector} (NAF ${benchmark.nafCode})</p>`;

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

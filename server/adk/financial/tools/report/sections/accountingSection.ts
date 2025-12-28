/**
 * Accounting Section
 *
 * Generates the accounting analysis section with SIG, EBE retraitement, ratios, and benchmarks.
 */

/**
 * Generate the accounting section HTML
 */
export function generateAccountingSection(comptable: any, evolutionChart: any, healthGauge: any): string {
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
        const rawValue = comptable.sig[y]?.[ind.key];
        // Handle new format { valeur, pct_ca } or old format (number)
        const value = typeof rawValue === 'object' && rawValue !== null ? rawValue.valeur : (rawValue || 0);
        html += `<td class="text-right">${value.toLocaleString('fr-FR')} €</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table>';
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

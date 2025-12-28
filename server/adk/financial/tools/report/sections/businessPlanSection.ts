/**
 * Business Plan Section
 *
 * Generates the dynamic business plan section with 5-year projections,
 * banking indicators, and hypotheses.
 */

/**
 * Generate the business plan section HTML
 */
export function generateBusinessPlanSection(businessPlan: any): string {
  let html = '<h2>📈 Business Plan Dynamique - Projection 5 ans</h2>';

  if (!businessPlan || !businessPlan.projections) {
    return html + '<p class="no-data">Aucune projection disponible</p>';
  }

  const { projections, indicateursBancaires, hypotheses, synthese, recommandations, tabacInfo } = businessPlan;

  // Synthèse
  if (synthese) {
    html += `<div class="summary-box">
      <h3>Synthèse</h3>
      <p>${synthese}</p>
    </div>`;
  }

  // Tableau Actuel vs Projeté
  if (projections.length >= 2) {
    html += generateChangesTable(projections, tabacInfo);
  }

  // Table des projections sur 5 ans
  html += generateProjectionsTable(projections);

  // Graphique des projections
  html += generateProjectionChart(projections);

  // Indicateurs bancaires
  if (indicateursBancaires) {
    html += generateBankingIndicators(indicateursBancaires);
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

  // Hypothèses
  if (hypotheses) {
    html += generateHypothesesTable(hypotheses, tabacInfo);
  }

  html += '<div class="page-break"></div>';
  return html;
}

/**
 * Generate changes table (Actuel vs Projeté)
 */
function generateChangesTable(projections: any[], tabacInfo: any): string {
  const annee0 = projections[0];
  const annee1 = projections[1];

  let html = '<h3>📊 Changements Appliqués (Actuel → Projeté)</h3>';
  html += '<table>';
  html += '<thead><tr><th>Élément</th><th>Situation Actuelle</th><th>Après Reprise (Année 1)</th><th>Variation</th></tr></thead>';
  html += '<tbody>';

  // Loyer
  const loyerActuel = annee0.charges_detail?.loyer || 0;
  const loyerProjet = annee1.charges_detail?.loyer || 0;
  const variationLoyer = loyerProjet - loyerActuel;
  const pctLoyer = loyerActuel > 0 ? ((variationLoyer / loyerActuel) * 100).toFixed(1) : 'N/A';
  const colorLoyer = variationLoyer < 0 ? 'var(--color-success, #059669)' : (variationLoyer > 0 ? 'var(--color-error, #991b1b)' : 'inherit');

  html += `<tr>
    <td>🏠 Loyer annuel</td>
    <td class="text-right">${loyerActuel.toLocaleString('fr-FR')} €</td>
    <td class="text-right">${loyerProjet.toLocaleString('fr-FR')} €</td>
    <td class="text-right" style="color:${colorLoyer}">
      ${variationLoyer !== 0 ? (variationLoyer > 0 ? '+' : '') + variationLoyer.toLocaleString('fr-FR') + ' € (' + pctLoyer + '%)' : '—'}
    </td>
  </tr>`;

  // Masse salariale
  const salairesActuel = annee0.charges_detail?.salaires || 0;
  const salairesProjet = annee1.charges_detail?.salaires || 0;
  const variationSalaires = salairesProjet - salairesActuel;
  const pctSalaires = salairesActuel > 0 ? ((variationSalaires / salairesActuel) * 100).toFixed(1) : 'N/A';
  const colorSalaires = variationSalaires < 0 ? 'var(--color-success, #059669)' : (variationSalaires > 0 ? 'var(--color-error, #991b1b)' : 'inherit');

  html += `<tr>
    <td>👥 Masse salariale</td>
    <td class="text-right">${salairesActuel.toLocaleString('fr-FR')} €</td>
    <td class="text-right">${salairesProjet.toLocaleString('fr-FR')} €</td>
    <td class="text-right" style="color:${colorSalaires}">
      ${variationSalaires !== 0 ? (variationSalaires > 0 ? '+' : '') + variationSalaires.toLocaleString('fr-FR') + ' € (' + pctSalaires + '%)' : '—'}
    </td>
  </tr>`;

  // Impact horaires
  const impactHoraires = annee1.ca_detail?.impact_horaires || 0;
  if (impactHoraires > 0) {
    html += `<tr>
      <td>⏰ Extension horaires</td>
      <td class="text-right">—</td>
      <td class="text-right" style="color:var(--color-success, #059669)">+${impactHoraires.toLocaleString('fr-FR')} €/an</td>
      <td class="text-right" style="color:var(--color-success, #059669)">Impact CA ↑</td>
    </tr>`;
  }

  // Impact travaux
  const impactTravaux = annee1.ca_detail?.impact_travaux || 0;
  if (impactTravaux > 0) {
    const variationLabel = tabacInfo?.isTabac
      ? `Impact CA ↑ (${tabacInfo.splitCA.poidsBoutique}% boutique)`
      : 'Impact CA ↑';

    html += `<tr>
      <td>🔧 Travaux / Modernisation${tabacInfo?.isTabac ? ' (Tabac: +15% boutique)' : ''}</td>
      <td class="text-right">—</td>
      <td class="text-right" style="color:var(--color-success, #059669)">+${impactTravaux.toLocaleString('fr-FR')} €/an</td>
      <td class="text-right" style="color:var(--color-success, #059669)">${variationLabel}</td>
    </tr>`;
  }

  // Total CA
  const caActuel = annee0.ca || 0;
  const caProjet = annee1.ca || 0;
  const variationCA = caProjet - caActuel;
  const pctCA = caActuel > 0 ? ((variationCA / caActuel) * 100).toFixed(1) : 'N/A';

  html += `<tr style="background: var(--color-bg-medium, #e2e8f0); font-weight: bold">
    <td>📈 Chiffre d'Affaires</td>
    <td class="text-right">${caActuel.toLocaleString('fr-FR')} €</td>
    <td class="text-right">${caProjet.toLocaleString('fr-FR')} €</td>
    <td class="text-right" style="color:var(--color-success, #059669)">
      +${variationCA.toLocaleString('fr-FR')} € (+${pctCA}%)
    </td>
  </tr>`;

  // EBE
  const ebeActuel = annee0.ebe_normatif || 0;
  const ebeProjet = annee1.ebe_normatif || 0;
  const variationEBE = ebeProjet - ebeActuel;
  const pctEBE = ebeActuel > 0 ? ((variationEBE / ebeActuel) * 100).toFixed(1) : 'N/A';
  const colorEBE = variationEBE >= 0 ? 'var(--color-success, #059669)' : 'var(--color-error, #991b1b)';

  html += `<tr style="background: var(--color-success-bg, #d1fae5); font-weight: bold">
    <td>💰 EBE Normatif</td>
    <td class="text-right">${ebeActuel.toLocaleString('fr-FR')} €</td>
    <td class="text-right">${ebeProjet.toLocaleString('fr-FR')} €</td>
    <td class="text-right" style="color:${colorEBE}">
      ${variationEBE >= 0 ? '+' : ''}${variationEBE.toLocaleString('fr-FR')} € (${variationEBE >= 0 ? '+' : ''}${pctEBE}%)
    </td>
  </tr>`;

  html += '</tbody></table>';
  return html;
}

/**
 * Generate 5-year projections table
 */
function generateProjectionsTable(projections: any[]): string {
  let html = '<h3>Projections sur 5 ans</h3>';
  html += '<table>';
  html += '<thead><tr>';
  html += '<th>Indicateur</th>';

  projections.forEach((proj: any) => {
    html += `<th class="text-center">${proj.label}</th>`;
  });

  html += '</tr></thead><tbody>';

  // CA
  html += '<tr style="background:#f0f9ff">';
  html += '<td><strong>Chiffre d\'Affaires</strong></td>';
  projections.forEach((proj: any) => {
    html += `<td class="text-right"><strong>${proj.ca.toLocaleString('fr-FR')} €</strong></td>`;
  });
  html += '</tr>';

  // CA details
  html += generateDetailRow('└─ Impact horaires', projections, 'ca_detail.impact_horaires', '#059669');
  html += generateDetailRow('└─ Impact travaux', projections, 'ca_detail.impact_travaux', '#059669');
  html += generateDetailRow('└─ Croissance naturelle', projections, 'ca_detail.croissance_naturelle', '#059669');

  // Charges fixes
  html += '<tr style="background:#fff7ed">';
  html += '<td><strong>Charges Fixes</strong></td>';
  projections.forEach((proj: any) => {
    html += `<td class="text-right"><strong>${proj.charges_fixes.toLocaleString('fr-FR')} €</strong></td>`;
  });
  html += '</tr>';

  // Charges details
  html += generateDetailRow('└─ Salaires', projections, 'charges_detail.salaires');
  html += generateDetailRow('└─ Loyer', projections, 'charges_detail.loyer');

  // EBE
  html += '<tr style="background:#d1fae5">';
  html += '<td><strong>EBE Normatif</strong></td>';
  projections.forEach((proj: any) => {
    const color = proj.ebe_normatif > 0 ? '#065f46' : '#991b1b';
    html += `<td class="text-right" style="color:${color}"><strong>${proj.ebe_normatif.toLocaleString('fr-FR')} €</strong></td>`;
  });
  html += '</tr>';

  // Annuité
  html += '<tr>';
  html += '<td>Annuité emprunt</td>';
  projections.forEach((proj: any) => {
    html += `<td class="text-right" style="color:#991b1b">${proj.annuite_emprunt > 0 ? '-' : ''}${proj.annuite_emprunt.toLocaleString('fr-FR')} €</td>`;
  });
  html += '</tr>';

  // Reste après dette
  html += '<tr style="background:#e6f7ff; border-top:2px solid #0066cc">';
  html += '<td><strong>💰 Reste après dette</strong></td>';
  projections.forEach((proj: any) => {
    const color = proj.reste_apres_dette > 0 ? '#065f46' : '#991b1b';
    html += `<td class="text-right" style="color:${color}"><strong>${proj.reste_apres_dette.toLocaleString('fr-FR')} €</strong></td>`;
  });
  html += '</tr>';

  html += '</tbody></table>';
  return html;
}

/**
 * Generate detail row for projections table
 */
function generateDetailRow(label: string, projections: any[], path: string, color?: string): string {
  let html = '<tr>';
  html += `<td style="padding-left:20px; font-size:0.9em">${label}</td>`;
  projections.forEach((proj: any) => {
    const parts = path.split('.');
    let val = proj;
    for (const part of parts) {
      val = val?.[part];
    }
    val = val || 0;
    const style = color ? `font-size:0.9em; color:${color}` : 'font-size:0.9em';
    html += `<td class="text-right" style="${style}">${val > 0 ? '+' : ''}${Math.round(val).toLocaleString('fr-FR')} €</td>`;
  });
  html += '</tr>';
  return html;
}

/**
 * Generate projection chart
 */
function generateProjectionChart(projections: any[]): string {
  let html = '<h4>Évolution Projetée sur 5 ans</h4>';
  html += '<div class="chart-container"><canvas id="projectionChart"></canvas></div>';

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
        legend: { position: 'top', labels: { font: { size: 14, weight: 'bold' }, padding: 20 } },
        title: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context: any) {
              let label = context.dataset.label || '';
              if (label) label += ': ';
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

  return html;
}

/**
 * Generate banking indicators section
 */
function generateBankingIndicators(ind: any): string {
  let html = '<h3>🏦 Indicateurs Bancaires</h3>';

  const appreciationClass = ind.appreciation === 'excellent' ? 'success' :
                            (ind.appreciation === 'bon' ? 'success' :
                             (ind.appreciation === 'acceptable' ? 'warning' : 'error'));

  html += `<div class="alert-box ${appreciationClass}">
    <strong>Profil bancaire : ${ind.appreciation.toUpperCase()}</strong>
  </div>`;

  html += '<div class="score-grid">';

  html += `<div class="score-card">
    <div class="score-value">${ind.ratioCouvertureDette}x</div>
    <div class="score-label">Ratio de Couverture</div>
    <p style="font-size:0.85em; margin-top:5px">Cible: > 1.5x</p>
  </div>`;

  html += `<div class="score-card">
    <div class="score-value">${ind.rentabiliteCapitauxInvestis}%</div>
    <div class="score-label">ROI</div>
    <p style="font-size:0.85em; margin-top:5px">Rentabilité investissement</p>
  </div>`;

  html += `<div class="score-card">
    <div class="score-value">${ind.delaiRetourInvestissement} ans</div>
    <div class="score-label">Délai de Retour</div>
    <p style="font-size:0.85em; margin-top:5px">Amortissement apport</p>
  </div>`;

  html += `<div class="score-card">
    <div class="score-value">${ind.pointMort.toLocaleString('fr-FR')} €</div>
    <div class="score-label">Point Mort</div>
    <p style="font-size:0.85em; margin-top:5px">CA minimum équilibre</p>
  </div>`;

  html += '</div>';

  html += '<table>';
  html += `<tr><td>Investissement Total</td><td class="text-right"><strong>${ind.investissementTotal.toLocaleString('fr-FR')} €</strong></td></tr>`;
  html += `<tr><td>Montant Emprunté</td><td class="text-right">${ind.montantEmprunte.toLocaleString('fr-FR')} €</td></tr>`;
  html += `<tr><td>Annuité Emprunt</td><td class="text-right">${ind.annuiteEmprunt.toLocaleString('fr-FR')} €/an</td></tr>`;
  html += `<tr><td>Capacité d'Autofinancement (Année 1)</td><td class="text-right"><strong>${ind.capaciteAutofinancement.toLocaleString('fr-FR')} €</strong></td></tr>`;
  html += '</table>';

  return html;
}

/**
 * Generate hypotheses table
 */
function generateHypothesesTable(hypotheses: any, tabacInfo: any): string {
  let html = '<h3>📋 Hypothèses du Business Plan</h3>';
  html += '<table>';

  if (hypotheses.extensionHoraires?.impactEstime) {
    html += `<tr><td>⏰ Impact extension horaires</td><td class="text-right">+${(hypotheses.extensionHoraires.impactEstime * 100).toFixed(0)}% du CA</td></tr>`;
  }

  if (hypotheses.travaux?.impactAnnee2 || tabacInfo?.impactTravaux) {
    if (tabacInfo?.impactTravaux) {
      const { commissions, boutique, effectif } = tabacInfo.impactTravaux;
      const { poidsCommissions, poidsBoutique } = tabacInfo.splitCA;
      html += `<tr>
        <td>🔧 Impact travaux (dès Année 1)<br>
          <span style="font-size:0.85em; color:#666">
            🚬 Commissions (${poidsCommissions}%): +${(commissions * 100).toFixed(0)}% |
            🛒 Boutique (${poidsBoutique}%): +${(boutique * 100).toFixed(0)}%
          </span>
        </td>
        <td class="text-right">+${(effectif * 100).toFixed(1)}% effectif</td>
      </tr>`;
    } else {
      html += `<tr><td>🔧 Impact travaux (dès Année 1)</td><td class="text-right">+${(hypotheses.travaux.impactAnnee2 * 100).toFixed(0)}% du CA</td></tr>`;
    }
  }

  if (hypotheses.travaux?.impactRecurrent) {
    html += `<tr><td>📈 Croissance récurrente (Années 3-5)</td><td class="text-right">+${(hypotheses.travaux.impactRecurrent * 100).toFixed(0)}% du CA/an</td></tr>`;
  }

  if (hypotheses.salairesSupprimes) {
    html += `<tr><td>👥 Salaires supprimés</td><td class="text-right" style="color:#059669">-${hypotheses.salairesSupprimes.toLocaleString('fr-FR')} €/an</td></tr>`;
  }

  if (hypotheses.salairesAjoutes) {
    html += `<tr><td>👥 Salaires ajoutés</td><td class="text-right" style="color:#991b1b">+${hypotheses.salairesAjoutes.toLocaleString('fr-FR')} €/an</td></tr>`;
  }

  if (hypotheses.loyerNegocie) {
    html += `<tr><td>🏠 Loyer négocié</td><td class="text-right">${hypotheses.loyerNegocie.toLocaleString('fr-FR')} €/an (${Math.round(hypotheses.loyerNegocie / 12).toLocaleString('fr-FR')} €/mois)</td></tr>`;
  }

  if (hypotheses.tauxEmprunt) {
    html += `<tr><td>💰 Taux d'emprunt</td><td class="text-right">${hypotheses.tauxEmprunt.toFixed(2)}%</td></tr>`;
  }

  if (hypotheses.dureeEmpruntMois) {
    html += `<tr><td>📅 Durée emprunt</td><td class="text-right">${(hypotheses.dureeEmpruntMois / 12).toFixed(1)} ans (${hypotheses.dureeEmpruntMois} mois)</td></tr>`;
  }

  html += '</table>';
  return html;
}

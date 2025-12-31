/**
 * Financing Plan Section Generator
 *
 * Generates the "Plan de Financement" section with:
 * - Comparative table (Initial vs Negotiated scenarios)
 * - 3 key financing indicators with color-coded badges
 */

/**
 * Generate the comparative table showing Initial vs Negotiated scenarios
 */
function generateComparativeTable(initial: any, negocie: any): string {
  const hasNegocie = negocie && negocie.total_investissement > 0;
  const showDifference = hasNegocie;

  // Helper function to format difference
  const formatDifference = (initialVal: number, negocieVal: number): string => {
    if (!hasNegocie) return '';
    const diff = negocieVal - initialVal;
    const pct = initialVal > 0 ? ((diff / initialVal) * 100).toFixed(1) : '0.0';
    const color = diff < 0 ? 'var(--color-success)' : diff > 0 ? 'var(--color-error)' : '#666';
    const sign = diff > 0 ? '+' : '';
    return `
      <td class="text-right" style="color: ${color}">
        ${sign}${diff.toLocaleString('fr-FR')} € (${sign}${pct}%)
      </td>
    `;
  };

  let html = '<table class="financing-table">';
  html += '<thead>';
  html += '<tr>';
  html += '<th class="text-left">Élément</th>';
  html += '<th class="text-right">Scénario Initial</th>';
  if (hasNegocie) {
    html += '<th class="text-right">Scénario Négocié</th>';
    html += '<th class="text-right">Différence</th>';
  }
  html += '</tr>';
  html += '</thead>';
  html += '<tbody>';

  // Section 1: DONNÉES D'INVESTISSEMENT
  html += '<tr class="section-header">';
  html += `<td colspan="${showDifference ? '4' : '2'}">💰 DONNÉES D\'INVESTISSEMENT</td>`;
  html += '</tr>';

  const investmentRows = [
    { label: 'Prix du fonds de commerce', key: 'prix_fonds' },
    { label: 'Honoraires HT', key: 'honoraires_ht' },
    { label: 'Frais d\'actes HT', key: 'frais_acte_ht' },
    { label: 'TVA sur honoraires (auto)', key: 'tva_sur_honoraires' },
    { label: 'Droits d\'enregistrement et débours', key: 'debours' },
    { label: 'Stock et Fonds de roulement', key: 'stock_fonds_roulement' },
    { label: 'Loyer d\'avance / caution', key: 'loyer_avance' }
  ];

  investmentRows.forEach(row => {
    const initialVal = initial?.[row.key] || 0;
    const negocieVal = negocie?.[row.key] || 0;

    html += '<tr>';
    html += `<td>${row.label}</td>`;
    html += `<td class="text-right">${initialVal.toLocaleString('fr-FR')} €</td>`;
    if (hasNegocie) {
      html += `<td class="text-right">${negocieVal.toLocaleString('fr-FR')} €</td>`;
      html += formatDifference(initialVal, negocieVal);
    }
    html += '</tr>';
  });

  // Total investissement (ligne totale)
  const totalInitial = initial?.total_investissement || 0;
  const totalNegocie = negocie?.total_investissement || 0;
  html += '<tr class="total-row">';
  html += '<td><strong>TOTAL INVESTISSEMENT</strong></td>';
  html += `<td class="text-right"><strong>${totalInitial.toLocaleString('fr-FR')} €</strong></td>`;
  if (hasNegocie) {
    html += `<td class="text-right"><strong>${totalNegocie.toLocaleString('fr-FR')} €</strong></td>`;
    html += formatDifference(totalInitial, totalNegocie);
  }
  html += '</tr>';

  // Section 2: SOURCES DE FINANCEMENT
  html += '<tr class="section-header">';
  html += `<td colspan="${showDifference ? '4' : '2'}">🏦 SOURCES DE FINANCEMENT</td>`;
  html += '</tr>';

  const financingRows = [
    { label: 'Apport personnel', key: 'apport_personnel' },
    { label: 'Prêt Relais TVA', key: 'pret_relais_tva' },
    { label: 'Crédit Vendeur', key: 'credit_vendeur' }
  ];

  financingRows.forEach(row => {
    const initialVal = initial?.[row.key] || 0;
    const negocieVal = negocie?.[row.key] || 0;

    html += '<tr>';
    html += `<td>${row.label}</td>`;
    html += `<td class="text-right">${initialVal.toLocaleString('fr-FR')} €</td>`;
    if (hasNegocie) {
      html += `<td class="text-right">${negocieVal.toLocaleString('fr-FR')} €</td>`;
      html += formatDifference(initialVal, negocieVal);
    }
    html += '</tr>';
  });

  // Prêt principal (ligne totale)
  const pretInitial = initial?.pret_principal || 0;
  const pretNegocie = negocie?.pret_principal || 0;
  html += '<tr class="total-row">';
  html += '<td><strong>MONTANT PRÊT PRINCIPAL</strong></td>';
  html += `<td class="text-right"><strong>${pretInitial.toLocaleString('fr-FR')} €</strong></td>`;
  if (hasNegocie) {
    html += `<td class="text-right"><strong>${pretNegocie.toLocaleString('fr-FR')} €</strong></td>`;
    html += formatDifference(pretInitial, pretNegocie);
  }
  html += '</tr>';

  // Section 3: PARAMÈTRES DE L'EMPRUNT
  html += '<tr class="section-header">';
  html += `<td colspan="${showDifference ? '4' : '2'}">📊 PARAMÈTRES DE L\'EMPRUNT</td>`;
  html += '</tr>';

  const loanRows = [
    { label: 'Durée du prêt (années)', key: 'duree_annees', suffix: ' ans' },
    { label: 'Taux d\'intérêt nominal', key: 'taux_interet', suffix: ' %' },
    { label: 'Taux d\'assurance ADI', key: 'taux_assurance', suffix: ' %' }
  ];

  loanRows.forEach(row => {
    const initialVal = initial?.[row.key] || 0;
    const negocieVal = negocie?.[row.key] || 0;

    html += '<tr>';
    html += `<td>${row.label}</td>`;
    html += `<td class="text-right">${initialVal}${row.suffix}</td>`;
    if (hasNegocie) {
      html += `<td class="text-right">${negocieVal}${row.suffix}</td>`;
      if (row.suffix === ' ans') {
        html += `<td class="text-right">${negocieVal - initialVal}${row.suffix}</td>`;
      } else {
        const diff = negocieVal - initialVal;
        const sign = diff > 0 ? '+' : '';
        html += `<td class="text-right">${sign}${diff.toFixed(2)}${row.suffix}</td>`;
      }
    }
    html += '</tr>';
  });

  // Estimation annuelle (ligne totale)
  const estInitial = initial?.estimation_annuelle || 0;
  const estNegocie = negocie?.estimation_annuelle || 0;
  html += '<tr class="total-row">';
  html += '<td><strong>ESTIMATION ANNUELLE</strong></td>';
  html += `<td class="text-right"><strong>${estInitial.toLocaleString('fr-FR')} €</strong></td>`;
  if (hasNegocie) {
    html += `<td class="text-right"><strong>${estNegocie.toLocaleString('fr-FR')} €</strong></td>`;
    html += formatDifference(estInitial, estNegocie);
  }
  html += '</tr>';

  html += '</tbody>';
  html += '</table>';

  return html;
}

/**
 * Generate key indicators cards with color-coded badges
 */
function generateKeyIndicators(initial: any, negocie: any, ebeNormatif: number): string {
  // Utiliser le scénario négocié si disponible, sinon initial
  const scenario = (negocie && negocie.total_investissement > 0) ? negocie : initial;

  if (!scenario) {
    return '<p class="no-data">Aucune donnée de financement disponible pour calculer les indicateurs.</p>';
  }

  // Indicateur 1 : Coût total des intérêts
  const estimationAnnuelle = scenario.estimation_annuelle || 0;
  const dureeAnnees = scenario.duree_annees || 0;
  const pretPrincipal = scenario.pret_principal || 0;
  const coutInterets = (estimationAnnuelle * dureeAnnees) - pretPrincipal;

  // Indicateur 2 : Ratio d'endettement (Mensualité / EBE mensuel)
  const mensualite = estimationAnnuelle / 12;
  const ebeMensuel = ebeNormatif / 12;
  const ratioEndettement = ebeMensuel > 0 ? (mensualite / ebeMensuel) * 100 : 0;

  // Badge couleur pour ratio endettement
  let ratioClass = 'success';
  let ratioLabel = 'SÉCURISÉ';
  if (ratioEndettement >= 70) {
    ratioClass = 'warning';
    ratioLabel = 'TENDU';
  } else if (ratioEndettement >= 50) {
    ratioClass = 'caution';
    ratioLabel = 'À SURVEILLER';
  }

  // Indicateur 3 : Taux d'effort (Apport / Total investissement)
  const apportPersonnel = scenario.apport_personnel || 0;
  const totalInvestissement = scenario.total_investissement || 0;
  const tauxEffort = totalInvestissement > 0 ? (apportPersonnel / totalInvestissement) * 100 : 0;

  // Badge couleur pour taux d'effort
  let effortClass = 'success';
  let effortLabel = 'BON NIVEAU';
  if (tauxEffort < 20) {
    effortClass = 'warning';
    effortLabel = 'FAIBLE';
  } else if (tauxEffort < 30) {
    effortClass = 'caution';
    effortLabel = 'MOYEN';
  }

  let html = '<div class="key-indicators-grid">';

  // Carte 1 : Coût total intérêts
  html += '<div class="indicator-card">';
  html += '<div class="indicator-label">Coût total des intérêts</div>';
  html += `<div class="indicator-value">${coutInterets.toLocaleString('fr-FR')} €</div>`;
  html += `<div class="indicator-detail">Sur ${dureeAnnees} ans de crédit</div>`;
  html += '</div>';

  // Carte 2 : Ratio endettement
  html += `<div class="indicator-card ${ratioClass}">`;
  html += '<div class="indicator-label">Ratio d\'endettement</div>';
  if (ebeNormatif > 0) {
    html += `<div class="indicator-value">${ratioEndettement.toFixed(1)} %</div>`;
    html += `<div class="indicator-badge ${ratioClass}">${ratioLabel}</div>`;
    html += `<div class="indicator-detail">Mensualité ${mensualite.toLocaleString('fr-FR')} € / EBE mensuel ${ebeMensuel.toLocaleString('fr-FR')} €</div>`;
  } else {
    html += '<div class="indicator-value">N/A</div>';
    html += '<div class="indicator-detail">EBE normatif non disponible</div>';
  }
  html += '</div>';

  // Carte 3 : Taux d'effort
  html += `<div class="indicator-card ${effortClass}">`;
  html += '<div class="indicator-label">Taux d\'effort (Apport)</div>';
  html += `<div class="indicator-value">${tauxEffort.toFixed(1)} %</div>`;
  html += `<div class="indicator-badge ${effortClass}">${effortLabel}</div>`;
  html += `<div class="indicator-detail">Apport ${apportPersonnel.toLocaleString('fr-FR')} € / Total ${totalInvestissement.toLocaleString('fr-FR')} €</div>`;
  html += '</div>';

  html += '</div>';

  return html;
}

/**
 * Generate the complete Financing Plan Section
 */
export function generateFinancingPlanSection(userComments: any, comptable: any): string {
  let html = '<h2>💰 Plan de Financement</h2>';

  const transactionFinancing = userComments?.transactionFinancing;

  // Cas 1 : Formulaire non rempli
  if (!transactionFinancing || (!transactionFinancing.initial && !transactionFinancing.negocie)) {
    html += `
      <div class="financing-empty-state">
        <p>📝 Formulaire de financement non renseigné.</p>
        <p style="font-size: 0.9em; color: #666; margin-top: 10px;">
          Les données de financement (prix d'acquisition, apport, prêt, etc.) n'ont pas été fournies.
          Veuillez remplir le formulaire de financement dans l'interface pour afficher cette section.
        </p>
      </div>
    `;
    html += '<div class="page-break"></div>';
    return html;
  }

  const initial = transactionFinancing.initial;
  const negocie = transactionFinancing.negocie;

  // Cas 2 : Scénario initial absent
  if (!initial || !initial.total_investissement) {
    html += `
      <div class="financing-empty-state">
        <p>⚠️ Scénario initial incomplet.</p>
      </div>
    `;
    html += '<div class="page-break"></div>';
    return html;
  }

  // EBE normatif avec fallback hiérarchique
  const years = comptable?.sig ? Object.keys(comptable.sig).sort().reverse() : [];
  const lastYear = years[0] || '2023';
  const ebeNormatif = comptable?.ebeRetraitement?.ebe_normatif_cible
    || comptable?.ebeRetraitement?.ebe_normatif
    || comptable?.sig?.[lastYear]?.ebe?.valeur
    || 0;

  // Introduction
  html += '<h3>Tableau Comparatif des Scénarios</h3>';
  html += '<p style="margin-bottom: 20px;">Synthèse des coûts d\'acquisition et du montage financier pour les scénarios Initial et Négocié.</p>';

  // Tableau comparatif
  html += generateComparativeTable(initial, negocie);

  // Indicateurs clés
  html += '<h3 style="margin-top: 30px;">Indicateurs Clés de Financement</h3>';
  html += generateKeyIndicators(initial, negocie, ebeNormatif);

  html += '<div class="page-break"></div>';
  return html;
}

export default generateFinancingPlanSection;

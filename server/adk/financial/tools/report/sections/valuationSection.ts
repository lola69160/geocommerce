/**
 * Valuation Section
 *
 * Generates the business valuation section with 3 methods (EBE, CA, Patrimoniale)
 * and hybrid Tabac method when applicable.
 */

/**
 * Generate the valuation section HTML
 */
export function generateValuationSection(valorisation: any, valorisationChart: any, documentExtraction?: any): string {
  if (!valorisation) {
    return '<h2>💰 Valorisation du Fonds</h2><p class="no-data">Données de valorisation non disponibles</p>';
  }

  // Prix demandé par le vendeur
  const transactionCosts = documentExtraction?.transactionCosts;
  const prixDemande = transactionCosts?.prix_fonds || valorisation?.comparaisonPrix?.prix_affiche || 0;

  let html = '<h2>💰 Valorisation du Fonds</h2>';

  // Valorisation Hybride Tabac/Presse/FDJ
  if (valorisation.methodeHybride) {
    html += generateHybridValuationTable(valorisation.methodeHybride);
  }

  // Graphique fourchettes
  html += '<div class="chart-container"><canvas id="valorisationChart"></canvas></div>';
  html += `<script>
  new Chart(document.getElementById('valorisationChart'), ${JSON.stringify(valorisationChart)});
  </script>`;

  // Tableau comparatif (seulement pour méthodes standard - pas pour hybride)
  if (!valorisation.methodeHybride) {
    html += generateStandardValuationTable(valorisation);
  } else {
    html += '<div class="summary-box" style="background:var(--color-bg-light); border-left:4px solid var(--color-info-text)">';
    html += '<p style="margin:0"><strong>Note :</strong> La méthode HYBRIDE Tabac/Presse/FDJ ci-dessus est la méthode de valorisation privilégiée pour ce type de commerce réglementé. Les méthodes classiques (EBE, CA, Patrimoniale) ne sont pas adaptées à ce secteur.</p>';
    html += '</div>';
  }

  // Synthèse valorisation
  html += generateValuationSynthesis(valorisation, prixDemande);

  // Arguments de négociation
  if (valorisation.argumentsNegociation) {
    html += generateNegotiationArguments(valorisation.argumentsNegociation);
  }

  html += '<div class="page-break"></div>';
  return html;
}

/**
 * Generate hybrid valuation table for Tabac/Presse
 */
function generateHybridValuationTable(tabac: any): string {
  let html = '<div class="summary-box" style="background:var(--color-bg-light); border-left:4px solid var(--color-info-text)">';
  html += '<h3>🔵 Méthode HYBRIDE Tabac/Presse/FDJ</h3>';
  html += `<p style="color:var(--color-text-secondary)"><strong>Type de commerce:</strong> ${tabac.descriptionType}</p>`;

  // Tableau de décomposition
  html += '<table>';
  html += '<thead><tr><th>Bloc Valorisation</th><th class="text-right">Base</th><th class="text-right">Coefficient / %</th><th class="text-right">Valeur</th></tr></thead>';
  html += '<tbody>';

  // Bloc 1: Activité Réglementée
  html += '<tr>';
  html += '<td><strong>📋 Bloc 1 : Activité Réglementée</strong><br><span style="font-size:0.9em; color:var(--color-text-secondary)">(Tabac + Loto + Presse + FDJ)</span></td>';
  html += `<td class="text-right">${tabac.blocReglemente.commissionsNettes.toLocaleString('fr-FR')} €<br><span style="font-size:0.9em; color:var(--color-text-secondary)">Commissions nettes annuelles</span></td>`;
  html += `<td class="text-right">${tabac.blocReglemente.coefficientMin} - ${tabac.blocReglemente.coefficientMax}<br><span style="font-size:0.9em; color:var(--color-text-secondary)">Coefficient multiplicateur</span></td>`;
  html += `<td class="text-right"><strong>${tabac.blocReglemente.valeurMin.toLocaleString('fr-FR')} - ${tabac.blocReglemente.valeurMax.toLocaleString('fr-FR')} €</strong></td>`;
  html += '</tr>';

  // Bloc 2: Activité Commerciale
  html += '<tr>';
  html += '<td><strong>🛒 Bloc 2 : Activité Commerciale</strong><br><span style="font-size:0.9em; color:var(--color-text-secondary)">(Souvenirs + Confiserie + Vape + Téléphonie)</span></td>';
  html += `<td class="text-right">${tabac.blocCommercial.caActiviteBoutique.toLocaleString('fr-FR')} €<br><span style="font-size:0.9em; color:var(--color-text-secondary)">CA boutique annuel</span></td>`;
  html += `<td class="text-right">${tabac.blocCommercial.pourcentageMin} - ${tabac.blocCommercial.pourcentageMax}%<br><span style="font-size:0.9em; color:var(--color-text-secondary)">Pourcentage CA</span></td>`;
  html += `<td class="text-right"><strong>${tabac.blocCommercial.valeurMin.toLocaleString('fr-FR')} - ${tabac.blocCommercial.valeurMax.toLocaleString('fr-FR')} €</strong></td>`;
  html += '</tr>';

  // Total
  html += '<tr style="border-top:2px solid var(--color-text-primary); background:var(--color-bg-light)">';
  html += '<td colspan="3"><strong>🎯 VALORISATION TOTALE (Bloc 1 + Bloc 2)</strong></td>';
  html += `<td class="text-right"><strong style="font-size:1.2em; color:var(--color-info-text)">${tabac.valorisationTotale.fourchetteBasse.toLocaleString('fr-FR')} - ${tabac.valorisationTotale.fourchetteHaute.toLocaleString('fr-FR')} €</strong><br><span style="color:var(--color-info-text)">Médiane: ${tabac.valorisationTotale.valeurMediane.toLocaleString('fr-FR')} €</span></td>`;
  html += '</tr>';

  html += '</tbody></table>';

  // Facteurs valorisants
  if (tabac.facteursValorisants && tabac.facteursValorisants.length > 0) {
    html += '<div style="margin-top:15px"><strong>✅ Facteurs Valorisants:</strong><ul style="margin-top:5px">';
    tabac.facteursValorisants.forEach((facteur: string) => {
      html += `<li>${facteur}</li>`;
    });
    html += '</ul></div>';
  }

  // Justification
  if (tabac.justification) {
    html += `<p style="margin-top:15px; padding:10px; background:var(--color-bg-light); border-left:3px solid var(--color-warning-text); font-size:0.95em">
      <strong>💡 Méthode:</strong> ${tabac.justification}
    </p>`;
  }

  html += '</div>';
  return html;
}

/**
 * Generate standard valuation comparison table
 */
function generateStandardValuationTable(valorisation: any): string {
  let html = '<h3>Comparaison des Méthodes de Valorisation</h3>';
  html += '<table><thead><tr><th>Méthode</th><th class="text-right">Fourchette Basse</th><th class="text-right">Médiane</th><th class="text-right">Fourchette Haute</th></tr></thead><tbody>';

  const methodes = valorisation.methodes || {
    ebe: valorisation.methodeEBE,
    ca: valorisation.methodeCA,
    patrimoniale: valorisation.methodePatrimoniale
  };

  // Méthode EBE
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
      html += `<tr style="color:var(--color-text-muted)">
        <td><strong>Méthode EBE</strong></td>
        <td class="text-right" colspan="3">0 € <em>(données insuffisantes - EBE non disponible ou trop faible)</em></td>
      </tr>`;
    }
  }

  // Méthode CA
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

  // Méthode Patrimoniale
  if (methodes?.patrimoniale) {
    const patri = methodes.patrimoniale;
    const valeurPatri = patri.valeur_estimee || 0;
    html += `<tr${valeurPatri === 0 ? ' style="color:var(--color-text-muted)"' : ''}>
      <td><strong>Méthode Patrimoniale</strong> (Actif Net + Goodwill)</td>
      <td class="text-right" colspan="3">${valeurPatri.toLocaleString('fr-FR')} €${valeurPatri === 0 ? ' <em>(bilan non fourni)</em>' : ''}</td>
    </tr>`;
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
  return html;
}

/**
 * Generate valuation synthesis box
 */
function generateValuationSynthesis(valorisation: any, prixDemande: number): string {
  const valoRecommandee = valorisation?.synthese?.valeur_recommandee ||
    valorisation?.methodeHybride?.valorisationTotale?.valeurMediane || 0;
  const valoFourchetteBasse = valorisation?.synthese?.fourchette_basse ||
    valorisation?.methodeHybride?.valorisationTotale?.fourchetteBasse || 0;
  const valoFourchetteHaute = valorisation?.synthese?.fourchette_haute ||
    valorisation?.methodeHybride?.valorisationTotale?.fourchetteHaute || 0;
  const methodePrivilegiee = valorisation?.synthese?.methode_privilegiee ||
    (valorisation?.methodeHybride ? 'HYBRIDE' : 'N/A');

  const ecartPrixPct = valoRecommandee > 0 ? ((prixDemande - valoRecommandee) / valoRecommandee * 100) : 0;
  const appreciationPrix = ecartPrixPct > 15 ? 'sur-évalué' : (ecartPrixPct < -15 ? 'sous-évalué' : 'prix marché');
  const badgeClass = ecartPrixPct > 15 ? 'error' : (ecartPrixPct < -15 ? 'success' : 'info');

  if (!valorisation.synthese && !valorisation.methodeHybride) {
    return '';
  }

  let html = '<div class="summary-box">';
  html += '<h3>Valorisation Retenue</h3>';
  html += '<div class="info-grid">';
  html += `<div class="info-label">Fourchette</div>`;
  html += `<div class="info-value">${valoFourchetteBasse.toLocaleString('fr-FR')} € - ${valoFourchetteHaute.toLocaleString('fr-FR')} €</div>`;
  html += `<div class="info-label">Méthode Privilégiée</div>`;
  html += `<div class="info-value">${methodePrivilegiee}</div>`;
  html += `<div class="info-label">Valeur Recommandée</div>`;
  html += `<div class="info-value"><strong style="font-size:1.3em">${valoRecommandee.toLocaleString('fr-FR')} €</strong></div>`;
  if (prixDemande > 0) {
    html += `<div class="info-label">Prix Demandé Vendeur</div>`;
    html += `<div class="info-value"><strong style="font-size:1.3em">${prixDemande.toLocaleString('fr-FR')} €</strong></div>`;
    html += `<div class="info-label">Écart Prix / Estimation</div>`;
    html += `<div class="info-value"><span class="badge ${badgeClass}">${ecartPrixPct > 0 ? '+' : ''}${ecartPrixPct.toFixed(1)}% (${appreciationPrix})</span></div>`;
  }
  html += '</div></div>';

  return html;
}

/**
 * Generate negotiation arguments section
 */
function generateNegotiationArguments(args: any): string {
  let html = '<h3>Arguments de Négociation</h3>';
  html += '<div class="chart-row">';

  if (args.pour_acheteur) {
    html += '<div class="warning-list"><h4>Pour l\'Acheteur</h4><ul>';
    args.pour_acheteur.forEach((arg: string) => {
      html += `<li>${arg}</li>`;
    });
    html += '</ul></div>';
  }

  if (args.pour_vendeur) {
    html += '<div class="strength-list"><h4>Pour le Vendeur</h4><ul>';
    args.pour_vendeur.forEach((arg: string) => {
      html += `<li>${arg}</li>`;
    });
    html += '</ul></div>';
  }

  html += '</div>';
  return html;
}

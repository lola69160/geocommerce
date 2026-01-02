/**
 * Valuation Section
 *
 * Generates the business valuation section with 3 methods (EBE, CA, Patrimoniale)
 * and hybrid Tabac method when applicable.
 */

/**
 * Generate the valuation section HTML
 */
export function generateValuationSection(
  valorisation: any,
  valorisationChart: any,
  documentExtraction?: any,
  userComments?: any,
  options?: any
): string {
  if (!valorisation) {
    return '<h2>💰 Valorisation du Fonds</h2><p class="no-data">Données de valorisation non disponibles</p>';
  }

  // Prix demandé par le vendeur (alimenté par valorisation.comparaisonPrix.prix_affiche)
  const prixDemande = valorisation?.comparaisonPrix?.prix_affiche || 0;

  let html = '<h2>💰 Valorisation du Fonds</h2>';

  // Valorisation Hybride Tabac/Presse/FDJ
  if (valorisation.methodeHybride) {
    // Section Tabac complète (sans graphique Chart.js)
    html += generateTabacValuationSection(
      valorisation.methodeHybride,
      documentExtraction,
      userComments,
      options
    );
  } else {
    // Graphique fourchettes (commerces standards uniquement)
    html += '<div class="chart-container"><canvas id="valorisationChart"></canvas></div>';
    html += `<script>
    new Chart(document.getElementById('valorisationChart'), ${JSON.stringify(valorisationChart)});
    </script>`;

    // Tableau comparatif standard
    html += generateStandardValuationTable(valorisation);
  }

  // Synthèse valorisation (désactivée - supprimée sur demande utilisateur)
  // html += generateValuationSynthesis(valorisation, prixDemande);

  // Arguments de négociation
  if (valorisation.argumentsNegociation) {
    html += generateNegotiationArguments(valorisation.argumentsNegociation);
  }

  html += '<div class="page-break"></div>';
  return html;
}

/**
 * Generate complete Tabac valuation section
 * Includes: Valorisation Théorique, Plan de Financement, Apport Personnel, Facteurs Valorisants
 */
function generateTabacValuationSection(
  tabac: any,
  documentExtraction?: any,
  userComments?: any,
  options?: any
): string {
  // === Data extraction ===

  // Bloc Réglementé (Commissions)
  const commissionsNettes = tabac.blocReglemente?.commissionsNettes || 0;
  const coefMin = tabac.blocReglemente?.coefficientMin || 0;
  const coefMedian = tabac.blocReglemente?.coefficientMedian || 0;
  const coefMax = tabac.blocReglemente?.coefficientMax || 0;
  const valReglMin = tabac.blocReglemente?.valeurMin || 0;
  const valReglMedian = tabac.blocReglemente?.valeurMediane || 0;
  const valReglMax = tabac.blocReglemente?.valeurMax || 0;

  // Bloc Commercial (Marchandises)
  const caBoutique = tabac.blocCommercial?.caActiviteBoutique || 0;
  const pctMin = tabac.blocCommercial?.pourcentageMin || 0;
  const pctMedian = tabac.blocCommercial?.pourcentageMedian || 0;
  const pctMax = tabac.blocCommercial?.pourcentageMax || 0;
  const valCommMin = tabac.blocCommercial?.valeurMin || 0;
  const valCommMedian = tabac.blocCommercial?.valeurMediane || 0;
  const valCommMax = tabac.blocCommercial?.valeurMax || 0;

  // Total Valeur Intrinsèque
  const totalMin = tabac.valorisationTotale?.fourchetteBasse || 0;
  const totalMedian = tabac.valorisationTotale?.valeurMediane || 0;
  const totalMax = tabac.valorisationTotale?.fourchetteHaute || 0;

  // Financement
  const transactionCosts = documentExtraction?.transactionCosts;
  const prixNegocie = options?.prixAffiche || transactionCosts?.prix_fonds || 0;
  const budgetTravaux = userComments?.travaux?.budget_prevu || 0;
  const SUBVENTION_DOUANES = 30000;  // Valeur fixe
  const FRAIS_MIN = 10000;
  const FRAIS_MED = 15000;
  const FRAIS_MAX = 20000;

  // Calcul total investissement
  const investMin = prixNegocie + budgetTravaux - SUBVENTION_DOUANES + FRAIS_MIN;
  const investMedian = prixNegocie + budgetTravaux - SUBVENTION_DOUANES + FRAIS_MED;
  const investMax = prixNegocie + budgetTravaux - SUBVENTION_DOUANES + FRAIS_MAX;

  // Metadata
  const descriptionType = tabac.descriptionType || 'Tabac/Presse';
  const justification = tabac.justification || '';

  // Format helper
  const fmt = (n: number) => n.toLocaleString('fr-FR');

  // === HTML Generation ===
  let html = '<div class="tabac-valuation-container">';

  // En-tête
  html += `<div class="tabac-header">
    <h3>🔵 Méthode HYBRIDE Tabac/Presse/FDJ</h3>
    <p><strong>Type de commerce :</strong> ${descriptionType}</p>
  </div>`;

  // === Tableau 1: Valorisation Théorique du Fonds ===
  html += `<table>
    <thead>
      <tr>
        <th>Composante</th>
        <th>Base</th>
        <th class="text-right">Min</th>
        <th class="text-right">Médian</th>
        <th class="text-right">Max</th>
      </tr>
    </thead>
    <tbody>`;

  // Ligne 1: Commissions (Bloc Réglementé)
  html += `<tr>
    <td>📋 Commissions 2023<br><em style="font-size:0.9em;color:#666">(Tabac + Loto + Presse + FDJ)</em></td>
    <td>${fmt(commissionsNettes)} €<br><em style="font-size:0.9em;color:#666">Commissions nettes annuelles</em></td>
    <td class="text-right">${fmt(valReglMin)} €<br><em style="font-size:0.9em;color:#666">× ${coefMin}</em></td>
    <td class="text-right">${fmt(valReglMedian)} €<br><em style="font-size:0.9em;color:#666">× ${coefMedian}</em></td>
    <td class="text-right">${fmt(valReglMax)} €<br><em style="font-size:0.9em;color:#666">× ${coefMax}</em></td>
  </tr>`;

  // Ligne 2: Marchandises (Bloc Commercial)
  html += `<tr>
    <td>🛒 Marchandises 2023<br><em style="font-size:0.9em;color:#666">(Souvenirs + Confiserie + Vape + Téléphonie)</em></td>
    <td>${fmt(caBoutique)} €<br><em style="font-size:0.9em;color:#666">CA boutique annuel</em></td>
    <td class="text-right">${fmt(valCommMin)} €<br><em style="font-size:0.9em;color:#666">${pctMin}%</em></td>
    <td class="text-right">${fmt(valCommMedian)} €<br><em style="font-size:0.9em;color:#666">${pctMedian}%</em></td>
    <td class="text-right">${fmt(valCommMax)} €<br><em style="font-size:0.9em;color:#666">${pctMax}%</em></td>
  </tr>`;

  // Ligne Total
  html += `<tr style="background:#f0f9ff">
    <td colspan="2"><strong>🎯 TOTAL VALEUR INTRINSÈQUE</strong></td>
    <td class="text-right"><strong>${fmt(totalMin)} €</strong></td>
    <td class="text-right"><strong>${fmt(totalMedian)} €</strong></td>
    <td class="text-right"><strong>${fmt(totalMax)} €</strong></td>
  </tr>`;

  html += '</tbody></table>';

  // === Tableau 2: Plan de Financement Total (Besoin) ===
  if (prixNegocie > 0) {
    html += `<h3>💼 Plan de Financement Total (Besoin)</h3>
      <table>
        <thead>
          <tr>
            <th>Élément</th>
            <th class="text-right">Min</th>
            <th class="text-right">Médian</th>
            <th class="text-right">Max</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Prix de cession négocié</td>
            <td class="text-right">${fmt(prixNegocie)} €</td>
            <td class="text-right">${fmt(prixNegocie)} €</td>
            <td class="text-right">${fmt(prixNegocie)} €</td>
          </tr>`;

    if (budgetTravaux > 0) {
      html += `<tr>
            <td>Travaux de Modernisation</td>
            <td class="text-right">${fmt(budgetTravaux)} €</td>
            <td class="text-right">${fmt(budgetTravaux)} €</td>
            <td class="text-right">${fmt(budgetTravaux)} €</td>
          </tr>`;
    }

    html += `<tr>
            <td>(-) Subvention Douanes</td>
            <td class="text-right" style="color:#dc2626">-${fmt(SUBVENTION_DOUANES)} €</td>
            <td class="text-right" style="color:#dc2626">-${fmt(SUBVENTION_DOUANES)} €</td>
            <td class="text-right" style="color:#dc2626">-${fmt(SUBVENTION_DOUANES)} €</td>
          </tr>
          <tr>
            <td>Frais & Stock</td>
            <td class="text-right">${fmt(FRAIS_MIN)} €</td>
            <td class="text-right">${fmt(FRAIS_MED)} €</td>
            <td class="text-right">${fmt(FRAIS_MAX)} €</td>
          </tr>
          <tr style="background:#f0f9ff">
            <td><strong>TOTAL INVESTISSEMENT</strong></td>
            <td class="text-right"><strong>${fmt(investMin)} €</strong></td>
            <td class="text-right"><strong>${fmt(investMedian)} €</strong></td>
            <td class="text-right"><strong>${fmt(investMax)} €</strong></td>
          </tr>
        </tbody>
      </table>`;
  }

  // === Encadré Méthode ===
  if (justification) {
    html += `<div class="method-box">
      <strong>💡 Méthode utilisée</strong>
      <p>${justification}</p>
    </div>`;
  }

  html += '</div>'; // Ferme tabac-valuation-container

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
 *
 * NOTE: This function is DISABLED (not called in generateValuationSection).
 * The "Valorisation Retenue" block (fourchette, méthode privilégiée, valeur recommandée)
 * has been removed from the report on user request.
 * This function is kept for potential future re-activation.
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

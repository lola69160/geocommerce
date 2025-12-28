/**
 * Real Estate Section
 *
 * Generates the real estate analysis section with lease, walls option,
 * works estimation, and rent simulation.
 */

/**
 * Generate the real estate section HTML
 */
export function generateRealEstateSection(immobilier: any): string {
  let html = '<h2>🏠 Analyse Immobilière</h2>';

  if (!immobilier.bail && !immobilier.murs) {
    return html + '<p class="no-data">Aucune donnée immobilière disponible</p>';
  }

  // Bail Commercial
  if (immobilier.bail) {
    html += generateLeaseSection(immobilier.bail);
  }

  // Option Murs
  if (immobilier.murs && immobilier.murs.option_possible) {
    html += generateWallsOption(immobilier.murs);
  }

  // Travaux
  if (immobilier.travaux) {
    html += generateWorksSection(immobilier.travaux);
  }

  // Simulation Loyer
  if (immobilier.simulationLoyer) {
    html += generateRentSimulation(immobilier.simulationLoyer);
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
 * Generate lease section
 */
function generateLeaseSection(bail: any): string {
  let html = '<h3>Bail Commercial</h3>';
  html += '<table>';
  html += `<tr><td>Type de Bail</td><td><strong>${bail.type || 'N/A'}</strong></td></tr>`;

  // Loyer avec source
  const loyerSource = bail.loyer_source || 'non_disponible';
  const loyerAnnee = bail.loyer_annee_source || '';
  const loyerActuel = bail.loyer_annuel_hc;

  if (loyerActuel !== null && loyerActuel !== undefined) {
    let sourceLabel = '';
    if (loyerSource === 'comptabilite') {
      sourceLabel = `<small class="source-label">(source: comptabilité ${loyerAnnee})</small>`;
    } else if (loyerSource === 'bail_document') {
      sourceLabel = '<small class="source-label">(source: bail commercial)</small>';
    } else if (loyerSource === 'utilisateur') {
      sourceLabel = '<small class="source-label">(source: saisie utilisateur)</small>';
    }
    html += `<tr><td>Loyer Annuel HC</td><td><strong>${loyerActuel.toLocaleString('fr-FR')} €</strong> ${sourceLabel}</td></tr>`;
  } else {
    html += `<tr><td>Loyer Annuel HC</td><td><span class="badge warning">Non disponible</span> <small>(ni dans comptabilité, ni dans documents)</small></td></tr>`;
  }

  html += `<tr><td>Surface</td><td>${bail.surface_m2 || 0} m²</td></tr>`;
  html += `<tr><td>Loyer/m²/an</td><td>${(bail.loyer_m2_annuel || 0).toLocaleString('fr-FR')} €</td></tr>`;
  html += `<tr><td>Durée Restante</td><td>${bail.duree_restante_mois || 0} mois</td></tr>`;

  if (bail.droit_au_bail_estime) {
    html += `<tr><td>Droit au Bail Estimé</td><td><strong>${bail.droit_au_bail_estime.toLocaleString('fr-FR')} €</strong></td></tr>`;
  }

  html += '</table>';
  return html;
}

/**
 * Generate walls purchase option section
 */
function generateWallsOption(murs: any): string {
  let html = '<h3>Option Rachat des Murs</h3>';
  html += '<table>';
  html += `<tr><td>Prix Demandé</td><td><strong>${(murs.prix_demande || 0).toLocaleString('fr-FR')} €</strong></td></tr>`;
  html += `<tr><td>Prix/m² Zone</td><td>${(murs.prix_m2_zone || 0).toLocaleString('fr-FR')} €</td></tr>`;
  html += `<tr><td>Rentabilité Brute</td><td><strong>${murs.rentabilite_brute_pct || 0}%</strong></td></tr>`;
  html += `<tr><td>Rentabilité Nette</td><td><strong>${murs.rentabilite_nette_pct || 0}%</strong></td></tr>`;

  const recomm = murs.recommandation || 'louer';
  const badgeClass = recomm === 'acheter' ? 'success' : (recomm === 'negocier' ? 'warning' : 'info');
  html += `<tr><td>Recommandation</td><td><span class="badge ${badgeClass}">${recomm.toUpperCase()}</span></td></tr>`;
  html += '</table>';

  if (murs.arguments) {
    html += '<ul class="strength-list">';
    murs.arguments.forEach((arg: string) => {
      html += `<li>${arg}</li>`;
    });
    html += '</ul>';
  }

  return html;
}

/**
 * Generate works estimation section
 */
function generateWorksSection(travaux: any): string {
  let html = '<h3>Budget Travaux</h3>';
  html += '<table>';
  html += `<tr><td>État Général</td><td><strong>${travaux.etat_general || 'N/A'}</strong></td></tr>`;

  if (travaux.budget_total) {
    const bt = travaux.budget_total;
    html += `<tr><td>Budget Obligatoire</td><td><strong>${(bt.obligatoire_bas || 0).toLocaleString('fr-FR')} € - ${(bt.obligatoire_haut || 0).toLocaleString('fr-FR')} €</strong></td></tr>`;
    if (bt.recommande_bas) {
      html += `<tr><td>Budget Recommandé</td><td>${(bt.recommande_bas || 0).toLocaleString('fr-FR')} € - ${(bt.recommande_haut || 0).toLocaleString('fr-FR')} €</td></tr>`;
    }
  }

  html += '</table>';
  return html;
}

/**
 * Generate rent simulation section (new simplified format)
 */
function generateRentSimulation(sim: any): string {
  let html = '<h3>📊 Simulation Renégociation Loyer</h3>';

  // Comparison table
  html += '<table>';
  html += '<thead><tr><th>Élément</th><th>Montant</th><th>Source</th></tr></thead>';
  html += '<tbody>';

  // Current rent
  if (sim.loyerActuel) {
    const la = sim.loyerActuel;
    if (la.annuel !== null && la.annuel !== undefined) {
      let sourceLabel = '';
      if (la.source === 'comptabilite') {
        sourceLabel = `Comptabilité ${la.anneeSource || ''}`;
      } else if (la.source === 'bail_document') {
        sourceLabel = 'Document bail';
      } else if (la.source === 'utilisateur') {
        sourceLabel = 'Renseigné par l\'utilisateur';
      } else {
        sourceLabel = 'N/A';
      }
      html += `<tr>
        <td><strong>Loyer Actuel</strong></td>
        <td class="text-right"><strong>${la.annuel.toLocaleString('fr-FR')} €/an</strong> <small>(${la.mensuel?.toLocaleString('fr-FR') || 0} €/mois)</small></td>
        <td><span class="badge info">${sourceLabel}</span></td>
      </tr>`;
    } else {
      html += `<tr>
        <td><strong>Loyer Actuel</strong></td>
        <td><span class="badge warning">Non disponible</span></td>
        <td><small>Non trouvé dans les documents comptables</small></td>
      </tr>`;
    }
  }

  // New rent (from user)
  if (sim.nouveauLoyer) {
    const nl = sim.nouveauLoyer;
    if (nl.renseigne && nl.annuel !== null) {
      html += `<tr>
        <td><strong>Nouveau Loyer (après renégociation)</strong></td>
        <td class="text-right"><strong>${nl.annuel.toLocaleString('fr-FR')} €/an</strong> <small>(${nl.mensuel?.toLocaleString('fr-FR') || 0} €/mois)</small></td>
        <td><span class="badge success">Renseigné par l'utilisateur</span></td>
      </tr>`;
    } else {
      html += `<tr>
        <td><strong>Nouveau Loyer (après renégociation)</strong></td>
        <td><span class="badge warning">Non renseigné</span></td>
        <td><small>Renseignez le futur loyer dans les commentaires</small></td>
      </tr>`;
    }
  }

  html += '</tbody></table>';

  // Simulation results
  if (sim.simulation) {
    html += generateSimulationResults(sim.simulation);
  } else {
    html += `<div class="alert-box warning" style="margin-top: 1rem;">
      <strong>⚠️ Simulation non disponible</strong>
      <p>${sim.message || 'Veuillez renseigner le loyer actuel (comptabilité) et le nouveau loyer négocié (commentaires utilisateur) pour calculer l\'économie.'}</p>
    </div>`;
  }

  return html;
}

/**
 * Generate simulation results box
 */
function generateSimulationResults(s: any): string {
  const isEconomie = s.economieAnnuelle !== null && s.economieAnnuelle > 0;
  const isAugmentation = s.economieAnnuelle !== null && s.economieAnnuelle < 0;

  let html = '<div class="summary-box" style="margin-top: 1rem;">';
  html += '<h4>💰 Impact de la Renégociation</h4>';
  html += '<table>';

  if (isEconomie) {
    html += `<tr><td>Économie Annuelle</td><td class="text-right" style="color: var(--color-success)"><strong>+${s.economieAnnuelle?.toLocaleString('fr-FR')} €</strong></td></tr>`;
    html += `<tr><td>Économie Mensuelle</td><td class="text-right" style="color: var(--color-success)">+${s.economieMensuelle?.toLocaleString('fr-FR')} €</td></tr>`;
    html += `<tr><td>Réduction</td><td class="text-right"><span class="badge success">-${Math.abs(s.economiePourcentage || 0)}%</span></td></tr>`;
    html += `<tr><td>Impact sur EBE</td><td class="text-right" style="color: var(--color-success)"><strong>+${s.impactEBE?.toLocaleString('fr-FR')} €/an</strong></td></tr>`;
  } else if (isAugmentation) {
    html += `<tr><td>Augmentation Annuelle</td><td class="text-right" style="color: var(--color-error)"><strong>${s.economieAnnuelle?.toLocaleString('fr-FR')} €</strong></td></tr>`;
    html += `<tr><td>Augmentation Mensuelle</td><td class="text-right" style="color: var(--color-error)">${s.economieMensuelle?.toLocaleString('fr-FR')} €</td></tr>`;
    html += `<tr><td>Augmentation</td><td class="text-right"><span class="badge error">+${Math.abs(s.economiePourcentage || 0)}%</span></td></tr>`;
    html += `<tr><td>Impact sur EBE</td><td class="text-right" style="color: var(--color-error)"><strong>${s.impactEBE?.toLocaleString('fr-FR')} €/an</strong></td></tr>`;
  } else {
    html += `<tr><td colspan="2">Loyer inchangé</td></tr>`;
  }

  html += '</table></div>';
  return html;
}

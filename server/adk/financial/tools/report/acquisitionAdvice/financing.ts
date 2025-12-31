/**
 * Financing Module
 *
 * Generates financing projections based on business plan data.
 */

/**
 * Detecte si l'utilisateur a mentionne des plans d'extension d'horaires
 */
export function detectHorairesExtension(userComments: any): { detected: boolean; description: string } {
  const autres = userComments?.autres || '';
  if (!autres) return { detected: false, description: '' };

  const horairesPatterns = [
    /allonger\s+(?:sensiblement\s+)?(?:les\s+)?horaires/i,
    /extension?\s+(?:des?\s+)?horaires/i,
    /horaires?\s+d'ouverture/i,
    /ouvrir?\s+plus\s+(?:longtemps|tard|tôt)/i,
    /fermé?\s+(?:le\s+)?(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/i,
    /ouvert?\s+(?:le\s+)?(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/i,
    /en\s+saison/i,
    /demi-journée\s+de\s+fermeture/i,
    /jour(?:s|née)?s?\s+de?\s+(?:fermeture|repos)/i
  ];

  const hasHorairesInfo = horairesPatterns.some(pattern => pattern.test(autres));
  if (!hasHorairesInfo) return { detected: false, description: '' };

  const sentences = autres.split(/[.!?]+/);
  const relevantSentences = sentences.filter(s =>
    /horaire|ouverture|ferme|fermé|ouvert|saison|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche/i.test(s)
  );

  const description = relevantSentences.length > 0
    ? relevantSentences.map(s => s.trim()).join('. ')
    : 'extension prevue par l\'acheteur';

  return { detected: true, description };
}

/**
 * Generate financing projections section
 */
export function generateFinancingSection(
  businessPlan: any,
  comptable: any,
  valeurRecommandee: number
): string {
  let html = '<h3>Projections de Financement</h3>';

  const projections = businessPlan?.projections || [];
  const hasBusinessPlan = projections.length >= 4;

  if (hasBusinessPlan) {
    html += '<div class="annuity-projection">';
    html += '<h4>Capacite de Remboursement (basee sur le Business Plan)</h4>';
    html += '<table class="annuity-table">';
    html += '<thead><tr><th>Indicateur</th><th>Annee 1</th><th>Annee 2</th><th>Annee 3</th></tr></thead>';
    html += '<tbody>';

    const ebe1 = projections[1]?.ebe_normatif || 0;
    const ebe2 = projections[2]?.ebe_normatif || 0;
    const ebe3 = projections[3]?.ebe_normatif || 0;

    html += `<tr>
      <td>EBE Normatif projete</td>
      <td>${ebe1.toLocaleString('fr-FR')} €</td>
      <td>${ebe2.toLocaleString('fr-FR')} €</td>
      <td>${ebe3.toLocaleString('fr-FR')} €</td>
    </tr>`;

    const annuite1 = projections[1]?.annuite_emprunt || 0;
    const annuite2 = projections[2]?.annuite_emprunt || 0;
    const annuite3 = projections[3]?.annuite_emprunt || 0;

    html += `<tr>
      <td>Annuite emprunt prevue</td>
      <td>${annuite1.toLocaleString('fr-FR')} €</td>
      <td>${annuite2.toLocaleString('fr-FR')} €</td>
      <td>${annuite3.toLocaleString('fr-FR')} €</td>
    </tr>`;

    const ratio1 = ebe1 > 0 ? (annuite1 / ebe1 * 100) : 0;
    const ratio2 = ebe2 > 0 ? (annuite2 / ebe2 * 100) : 0;
    const ratio3 = ebe3 > 0 ? (annuite3 / ebe3 * 100) : 0;

    const getRatioClass = (ratio: number) => ratio > 70 ? 'ratio-danger' : ratio > 50 ? 'ratio-warning' : 'ratio-ok';

    html += `<tr>
      <td>Ratio endettement (Annuite/EBE)</td>
      <td class="${getRatioClass(ratio1)}">${ratio1.toFixed(0)}%</td>
      <td class="${getRatioClass(ratio2)}">${ratio2.toFixed(0)}%</td>
      <td class="${getRatioClass(ratio3)}">${ratio3.toFixed(0)}%</td>
    </tr>`;

    const reste1 = projections[1]?.reste_apres_dette || (ebe1 - annuite1);
    const reste2 = projections[2]?.reste_apres_dette || (ebe2 - annuite2);
    const reste3 = projections[3]?.reste_apres_dette || (ebe3 - annuite3);

    html += `<tr style="font-weight:bold;background:rgba(234,88,12,0.1)">
      <td>Reste disponible apres dette</td>
      <td>${reste1.toLocaleString('fr-FR')} €</td>
      <td>${reste2.toLocaleString('fr-FR')} €</td>
      <td>${reste3.toLocaleString('fr-FR')} €</td>
    </tr>`;

    html += '</tbody></table>';

    if (ratio1 > 70) {
      html += '<div class="alert-box critical"><strong>Alerte Financement</strong> : Le ratio d\'endettement Annee 1 depasse 70%. Envisager : augmenter l\'apport, negocier le prix, ou differer le capital.</div>';
    } else if (ratio1 > 50) {
      html += '<div class="alert-box warning"><strong>Attention</strong> : Ratio d\'endettement eleve (>50%). Prevoir une marge de securite pour imprevus.</div>';
    } else {
      html += '<div class="alert-box info"><strong>Financement viable</strong> : Le ratio d\'endettement reste sous controle sur les 3 premieres annees.</div>';
    }

    html += '</div>';
  } else {
    const ebeNormatif = comptable?.ebeRetraitement?.ebe_normatif || comptable?.sig?.[comptable.yearsAnalyzed?.[0]]?.ebe || 0;
    const annuiteEstimee = valeurRecommandee * 0.15;
    const ratioEstime = ebeNormatif > 0 ? (annuiteEstimee / ebeNormatif * 100) : 0;

    html += '<div class="alert-box warning">';
    html += '<strong>Business Plan non disponible</strong><br/>';
    html += `Estimation simplifiee : Annuite ~${annuiteEstimee.toLocaleString('fr-FR')} (15% du prix) vs EBE normatif ${ebeNormatif.toLocaleString('fr-FR')} → Ratio ${ratioEstime.toFixed(0)}%`;
    html += '</div>';
  }

  return html;
}

/**
 * Generate risks section
 */
export function generateRisksSection(
  comptable: any,
  immobilier: any,
  businessPlan: any,
  professionalData: any
): string {
  let html = '<h3>Risques Identifies & Mitigation</h3>';
  html += '<table><thead><tr><th>Risque</th><th>Niveau</th><th>Strategie de Mitigation</th></tr></thead><tbody>';

  const risques = [];
  const projections = businessPlan?.projections || [];
  const hasBusinessPlan = projections.length >= 4;

  if (comptable?.evolution?.ebe_evolution_pct < -20) {
    risques.push({
      description: 'Baisse importante de l\'EBE (-' + Math.abs(comptable.evolution.ebe_evolution_pct).toFixed(0) + '%)',
      niveau: 'critical',
      mitigation: 'Auditer masse salariale, renegocier loyer, optimiser plannings. Clause earn-out pour garantir rentabilite.'
    });
  }

  if (immobilier?.simulationLoyer?.comparaison?.appreciation === 'desavantageux') {
    const ecart = immobilier.simulationLoyer.comparaison.ecartPourcentage || 0;
    risques.push({
      description: 'Loyer superieur au marche (+' + Math.abs(ecart).toFixed(0) + '%)',
      niveau: 'warning',
      mitigation: 'Renegociation avant signature (objectif -15% minimum). Clause de reduction si CA < seuil.'
    });
  }

  if (hasBusinessPlan) {
    const ratio1 = projections[1]?.ebe_normatif > 0
      ? (projections[1]?.annuite_emprunt / projections[1]?.ebe_normatif * 100)
      : 0;
    if (ratio1 > 70) {
      risques.push({
        description: `Ratio endettement eleve Annee 1 (${ratio1.toFixed(0)}% > 70%)`,
        niveau: 'critical',
        mitigation: 'Augmenter apport personnel, negocier prix a la baisse, ou differer remboursement capital.'
      });
    }
  }

  if (immobilier?.travaux?.budget_total) {
    const totalTravaux = (immobilier.travaux.budget_total.obligatoire_haut || 0) + (immobilier.travaux.budget_total.recommande_haut || 0);
    if (totalTravaux > 30000) {
      risques.push({
        description: 'Travaux importants necessaires (' + totalTravaux.toLocaleString('fr-FR') + ' €)',
        niveau: 'warning',
        mitigation: 'Negocier prise en charge partielle par vendeur. Etaler travaux sur 18-24 mois.'
      });
    }
  }

  if (professionalData && professionalData.scores.market < 50) {
    risques.push({
      description: `Score reputation faible (${professionalData.scores.market}/100)`,
      niveau: 'warning',
      mitigation: 'Prevoir budget communication/rebranding (5-10k). Campagne avis clients.'
    });
  }

  if (risques.length > 0) {
    risques.forEach(r => {
      const badgeClass = r.niveau === 'critical' ? 'error' : 'warning';
      const badgeText = r.niveau === 'critical' ? 'Critique' : 'Important';
      html += `<tr>
        <td>${r.description}</td>
        <td><span class="badge ${badgeClass}">${badgeText}</span></td>
        <td>${r.mitigation}</td>
      </tr>`;
    });
  } else {
    html += '<tr><td colspan="3" style="text-align:center;color:var(--color-text-muted)">Aucun risque majeur identifie</td></tr>';
  }

  html += '</tbody></table>';
  return html;
}

/**
 * Generate opportunities section
 */
export function generateOpportunitiesSection(
  comptable: any,
  immobilier: any,
  userComments: any,
  professionalData: any,
  sectorCode: string
): string {
  let html = '<h3>Opportunites de Creation de Valeur</h3>';
  html += '<table><thead><tr><th>Levier</th><th>Potentiel</th><th>Impact Estime</th><th>Investissement</th></tr></thead><tbody>';

  // ✅ FIX (2025-12-31): Vérification stricte sur secteur du formulaire (pas de .includes())
  const isTabac = sectorCode === '47.26' || sectorCode === '47.62';

  if (comptable?.ratios?.charges_personnel_ratio > 30) {
    html += `<tr>
      <td><strong>Optimisation masse salariale</strong><br/><small>Ratio actuel : ${comptable.ratios.charges_personnel_ratio.toFixed(0)}% CA</small></td>
      <td><span class="badge warning">Eleve</span></td>
      <td>+5-10% EBE</td>
      <td>Reorganisation interne</td>
    </tr>`;
  }

  const horairesExtension = detectHorairesExtension(userComments);
  if (horairesExtension.detected || professionalData?.saisonnalite?.touristique) {
    const contexte = professionalData?.saisonnalite?.touristique
      ? 'Zone touristique = forte demande saisonniere'
      : 'Flux matin/soir a capter';
    html += `<tr>
      <td><strong>Extension horaires</strong><br/><small>${horairesExtension.detected ? horairesExtension.description : contexte}</small></td>
      <td><span class="badge success">Fort</span></td>
      <td>+15-25% CA</td>
      <td>Cout personnel</td>
    </tr>`;
  }

  if (immobilier?.simulationLoyer?.simulation?.economieAnnuelle > 0) {
    const economie = immobilier.simulationLoyer.simulation.economieAnnuelle;
    html += `<tr>
      <td><strong>Renegociation loyer</strong><br/><small>Economie validee par l'utilisateur</small></td>
      <td><span class="badge success">Fort</span></td>
      <td>+${economie.toLocaleString('fr-FR')} €/an</td>
      <td>Negociation uniquement</td>
    </tr>`;
  }

  if (professionalData && professionalData.scores.market < 60 && professionalData.scores.location >= 60) {
    html += `<tr>
      <td><strong>Redressement reputation</strong><br/><small>Bon emplacement (${professionalData.scores.location}/100), reputation faible (${professionalData.scores.market}/100)</small></td>
      <td><span class="badge warning">Tres eleve</span></td>
      <td>+20-40% CA</td>
      <td>5-15k (rebranding)</td>
    </tr>`;
  }

  if (isTabac) {
    html += `<tr>
      <td><strong>Diversification revenus</strong><br/><small>Reduire dependance au tabac reglemente</small></td>
      <td><span class="badge warning">Eleve</span></td>
      <td>+10-15% CA</td>
      <td>5-10k (amenagement)</td>
    </tr>`;
  }

  html += '</tbody></table>';
  return html;
}

/**
 * Generate due diligence checklist
 */
export function generateChecklistSection(comptable: any, immobilier: any): string {
  let html = '<h3>Checklist Due Diligence</h3>';
  html += '<table><thead><tr><th>Point de Controle</th><th>Statut</th><th>Action Requise</th></tr></thead><tbody>';

  const checklist = [
    { item: 'Bail commercial (3-6-9 ans minimum)', status: immobilier?.bail ? 'ok' : 'missing', action: 'Demander bail original + avenants' },
    { item: 'Liasse fiscale 3 dernieres annees', status: comptable?.yearsAnalyzed?.length >= 3 ? 'ok' : 'partial', action: 'Obtenir liasses completes certifiees' },
    { item: 'Carte debitant tabac (si applicable)', status: 'unknown', action: 'Verifier validite + procedure transfert prefecture' },
    { item: 'Contrats fournisseurs (FDJ, PMU, etc.)', status: 'unknown', action: 'Lister + verifier clauses transfert' },
    { item: 'Conformite ERP & accessibilite', status: 'unknown', action: 'Audit securite incendie + handicap' },
    { item: 'Etat des stocks (valorisation)', status: 'unknown', action: 'Inventaire contradictoire a la date de cession' },
    { item: 'Litiges en cours (prud\'hommes, fiscal)', status: 'unknown', action: 'Attestation vendeur + recherche Infogreffe' }
  ];

  checklist.forEach(item => {
    const statusBadge = item.status === 'ok'
      ? '<span class="badge success">OK</span>'
      : item.status === 'partial'
      ? '<span class="badge warning">Partiel</span>'
      : '<span class="badge error">A verifier</span>';

    html += `<tr>
      <td>${item.item}</td>
      <td>${statusBadge}</td>
      <td>${item.action}</td>
    </tr>`;
  });

  html += '</tbody></table>';
  return html;
}

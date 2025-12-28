/**
 * Nibbles Module
 *
 * Generates concessions/nibbles section for negotiation beyond price.
 */

/**
 * Generate nibbles/concessions section
 */
export function generateNibblesSection(): string {
  let html = '<div class="nibbles-section">';
  html += '<h4>Concessions a Negocier (au-dela du prix)</h4>';
  html += '<div class="nibbles-grid">';

  const nibbles = [
    {
      icon: '🎓',
      title: 'Formation/Accompagnement',
      desc: '2-3 mois minimum avec le cedant. Transfert savoir-faire, contacts fournisseurs.'
    },
    {
      icon: '📦',
      title: 'Stock initial',
      desc: 'Valorisation separee (inventaire J-1). Negocier decote 10-20% sur stocks anciens.'
    },
    {
      icon: '🚫',
      title: 'Clause non-concurrence',
      desc: 'Rayon 10-15 km, duree 3-5 ans. Essentiel pour proteger le fonds.'
    },
    {
      icon: '🛡️',
      title: 'Garantie d\'actif/passif',
      desc: '12-24 mois. Protection contre passifs caches (litiges, fiscalite).'
    },
    {
      icon: '💳',
      title: 'Echelonnement paiement',
      desc: 'Si vendeur motive : 70% signature, 30% a 6-12 mois.'
    },
    {
      icon: '📋',
      title: 'Clause earn-out',
      desc: 'Lier 10-15% du prix a la performance Annee 1 (CA ou EBE).'
    }
  ];

  nibbles.forEach(n => {
    html += `<div class="nibble-item">
      <span class="icon">${n.icon}</span>
      <div class="content">
        <strong>${n.title}</strong>
        <span>${n.desc}</span>
      </div>
    </div>`;
  });

  html += '</div>';
  html += '</div>';

  return html;
}

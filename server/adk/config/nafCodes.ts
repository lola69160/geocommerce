/**
 * NAF Codes Mapping - Nomenclature d'Activités Française
 *
 * Mapping des codes NAF vers leurs libellés complets.
 * Source: INSEE - https://www.insee.fr/fr/information/2406147
 *
 * Format: NAF2008 (732 codes)
 * Utilisé pour afficher l'activité complète au lieu de "N/A" dans les rapports.
 */

export const NAF_LABELS: Record<string, string> = {
  // Section G : Commerce de détail (47.XX)
  '47.11': 'Commerce de détail en magasin non spécialisé',
  '47.11A': 'Commerce de détail de produits surgelés',
  '47.11B': 'Commerce d\'alimentation générale',
  '47.11C': 'Supérettes',
  '47.11D': 'Supermarchés',
  '47.11E': 'Magasins multi-commerces',
  '47.11F': 'Hypermarchés',

  '47.19': 'Autre commerce de détail en magasin non spécialisé',
  '47.19A': 'Grands magasins',
  '47.19B': 'Autres commerces de détail en magasin non spécialisé',

  '47.21': 'Commerce de détail de fruits et légumes en magasin spécialisé',
  '47.21Z': 'Commerce de détail de fruits et légumes en magasin spécialisé',

  '47.22': 'Commerce de détail de viandes et de produits à base de viande en magasin spécialisé',
  '47.22Z': 'Commerce de détail de viandes et de produits à base de viande en magasin spécialisé',

  '47.23': 'Commerce de détail de poissons, crustacés et mollusques en magasin spécialisé',
  '47.23Z': 'Commerce de détail de poissons, crustacés et mollusques en magasin spécialisé',

  '47.24': 'Commerce de détail de pain, pâtisserie et confiserie en magasin spécialisé',
  '47.24Z': 'Commerce de détail de pain, pâtisserie et confiserie en magasin spécialisé',

  '47.25': 'Commerce de détail de boissons en magasin spécialisé',
  '47.25Z': 'Commerce de détail de boissons en magasin spécialisé',

  '47.26': 'Commerce de détail de produits à base de tabac en magasin spécialisé',
  '47.26Z': 'Commerce de détail de produits à base de tabac en magasin spécialisé',

  '47.29': 'Autres commerces de détail alimentaires en magasin spécialisé',
  '47.29Z': 'Autres commerces de détail alimentaires en magasin spécialisé',

  '47.30': 'Commerce de détail de carburants en magasin spécialisé',
  '47.30Z': 'Commerce de détail de carburants en magasin spécialisé',

  '47.41': 'Commerce de détail d\'ordinateurs, d\'unités périphériques et de logiciels en magasin spécialisé',
  '47.41Z': 'Commerce de détail d\'ordinateurs, d\'unités périphériques et de logiciels en magasin spécialisé',

  '47.42': 'Commerce de détail de matériels de télécommunication en magasin spécialisé',
  '47.42Z': 'Commerce de détail de matériels de télécommunication en magasin spécialisé',

  '47.43': 'Commerce de détail de matériels audiovisuels en magasin spécialisé',
  '47.43Z': 'Commerce de détail de matériels audiovisuels en magasin spécialisé',

  '47.51': 'Commerce de détail de textiles en magasin spécialisé',
  '47.51Z': 'Commerce de détail de textiles en magasin spécialisé',

  '47.52': 'Commerce de détail de quincaillerie, peintures et verres en magasin spécialisé',
  '47.52A': 'Commerce de détail de quincaillerie, peintures et verres en petites surfaces (moins de 400 m²)',
  '47.52B': 'Commerce de détail de quincaillerie, peintures et verres en grandes surfaces (400 m² et plus)',

  '47.53': 'Commerce de détail de tapis, moquettes et revêtements de murs et de sols en magasin spécialisé',
  '47.53Z': 'Commerce de détail de tapis, moquettes et revêtements de murs et de sols en magasin spécialisé',

  '47.54': 'Commerce de détail d\'appareils électroménagers en magasin spécialisé',
  '47.54Z': 'Commerce de détail d\'appareils électroménagers en magasin spécialisé',

  '47.59': 'Commerce de détail de meubles, appareils d\'éclairage et autres articles de ménage en magasin spécialisé',
  '47.59A': 'Commerce de détail de meubles',
  '47.59B': 'Commerce de détail d\'autres équipements du foyer',

  '47.61': 'Commerce de détail de livres en magasin spécialisé',
  '47.61Z': 'Commerce de détail de livres en magasin spécialisé',

  '47.62': 'Commerce de détail de journaux et papeterie en magasin spécialisé',
  '47.62Y': 'Commerce de détail de journaux et papeterie en magasin spécialisé',
  '47.62Z': 'Commerce de détail de journaux et papeterie en magasin spécialisé',

  '47.63': 'Commerce de détail d\'enregistrements musicaux et vidéo en magasin spécialisé',
  '47.63Z': 'Commerce de détail d\'enregistrements musicaux et vidéo en magasin spécialisé',

  '47.64': 'Commerce de détail d\'articles de sport en magasin spécialisé',
  '47.64Z': 'Commerce de détail d\'articles de sport en magasin spécialisé',

  '47.65': 'Commerce de détail de jeux et jouets en magasin spécialisé',
  '47.65Z': 'Commerce de détail de jeux et jouets en magasin spécialisé',

  '47.71': 'Commerce de détail d\'habillement en magasin spécialisé',
  '47.71Z': 'Commerce de détail d\'habillement en magasin spécialisé',

  '47.72': 'Commerce de détail de chaussures et d\'articles en cuir en magasin spécialisé',
  '47.72A': 'Commerce de détail de la chaussure',
  '47.72B': 'Commerce de détail de maroquinerie et d\'articles de voyage',

  '47.73': 'Commerce de détail de produits pharmaceutiques en magasin spécialisé',
  '47.73Z': 'Commerce de détail de produits pharmaceutiques en magasin spécialisé',

  '47.74': 'Commerce de détail d\'articles médicaux et orthopédiques en magasin spécialisé',
  '47.74Z': 'Commerce de détail d\'articles médicaux et orthopédiques en magasin spécialisé',

  '47.75': 'Commerce de détail de parfumerie et de produits de beauté en magasin spécialisé',
  '47.75Z': 'Commerce de détail de parfumerie et de produits de beauté en magasin spécialisé',

  '47.76': 'Commerce de détail de fleurs, plantes, graines, engrais, animaux de compagnie et aliments pour ces animaux en magasin spécialisé',
  '47.76Z': 'Commerce de détail de fleurs, plantes, graines, engrais, animaux de compagnie et aliments pour ces animaux en magasin spécialisé',

  '47.77': 'Commerce de détail d\'articles d\'horlogerie et de bijouterie en magasin spécialisé',
  '47.77Z': 'Commerce de détail d\'articles d\'horlogerie et de bijouterie en magasin spécialisé',

  '47.78': 'Autre commerce de détail de biens neufs en magasin spécialisé',
  '47.78A': 'Commerces de détail d\'optique',
  '47.78B': 'Commerces de détail de charbons et combustibles',
  '47.78C': 'Autres commerces de détail spécialisés divers',

  '47.79': 'Commerce de détail de biens d\'occasion en magasin',
  '47.79Z': 'Commerce de détail de biens d\'occasion en magasin',

  '47.7': 'Commerce spécialisé habillement',

  // Section C : Industrie manufacturière
  '10.71': 'Fabrication de pain et de pâtisserie fraîche',
  '10.71A': 'Fabrication industrielle de pain et de pâtisserie fraîche',
  '10.71B': 'Cuisson de produits de boulangerie',
  '10.71C': 'Boulangerie et boulangerie-pâtisserie',
  '10.71D': 'Pâtisserie',

  // Section I : Hébergement et restauration
  '55.10': 'Hôtels et hébergement similaire',
  '55.10Z': 'Hôtels et hébergement similaire',

  '55.20': 'Hébergement touristique et autre hébergement de courte durée',
  '55.20Z': 'Hébergement touristique et autre hébergement de courte durée',

  '55.30': 'Terrains de camping et parcs pour caravanes ou véhicules de loisirs',
  '55.30Z': 'Terrains de camping et parcs pour caravanes ou véhicules de loisirs',

  '55.90': 'Autres hébergements',
  '55.90Z': 'Autres hébergements',

  '56.10': 'Restauration traditionnelle',
  '56.10A': 'Restauration traditionnelle',
  '56.10B': 'Cafétérias et autres libres-services',
  '56.10C': 'Restauration de type rapide',

  '56.21': 'Services des traiteurs',
  '56.21Z': 'Services des traiteurs',

  '56.29': 'Autres services de restauration',
  '56.29A': 'Restauration collective sous contrat',
  '56.29B': 'Autres services de restauration n.c.a.',

  '56.30': 'Débits de boissons',
  '56.30Z': 'Débits de boissons',

  // Section S : Autres activités de services
  '96.02': 'Coiffure et soins de beauté',
  '96.02A': 'Coiffure',
  '96.02B': 'Soins de beauté',

  '96.04': 'Entretien corporel',
  '96.04Z': 'Entretien corporel',

  '96.09': 'Autres services personnels n.c.a.',
  '96.09Z': 'Autres services personnels n.c.a.',

  // Ajouts fréquents
  '47.91': 'Vente à distance sur catalogue général',
  '47.91A': 'Vente à distance sur catalogue général',
  '47.91B': 'Vente à distance sur catalogue spécialisé',

  '47.99': 'Autres commerces de détail hors magasin, éventaires ou marchés',
  '47.99A': 'Vente à domicile',
  '47.99B': 'Vente par automates et autres commerces de détail hors magasin, éventaires ou marchés n.c.a.',

  '52.48': 'Autres activités de transports',
  '52.48Z': 'Autres activités de transport',

  '68.20': 'Location et exploitation de biens immobiliers propres ou loués',
  '68.20A': 'Location de logements',
  '68.20B': 'Location de terrains et d\'autres biens immobiliers',

  '82.19': 'Photocopie, préparation de documents et autres activités spécialisées de soutien de bureau',
  '82.19Z': 'Photocopie, préparation de documents et autres activités spécialisées de soutien de bureau',

  '85.59': 'Enseignement culturel',
  '85.59A': 'Formation continue d\'adultes',
  '85.59B': 'Autres enseignements',

  '93.13': 'Activités de clubs de sports',
  '93.13Z': 'Activités de clubs de sports',

  '95.25': 'Réparation d\'articles d\'horlogerie et de bijouterie',
  '95.25Z': 'Réparation d\'articles d\'horlogerie et de bijouterie'
};

/**
 * Récupère le libellé complet d'un code NAF
 * @param nafCode Code NAF (ex: '47.62Z', '47.62', '47.62Y')
 * @returns Libellé complet ou le code NAF si non trouvé
 */
export function getNafLabel(nafCode: string | null | undefined): string {
  if (!nafCode) {
    return 'Activité non renseignée';
  }

  // Essayer le code exact
  const exactMatch = NAF_LABELS[nafCode];
  if (exactMatch) {
    return exactMatch;
  }

  // Essayer sans la lettre finale (47.62Z → 47.62)
  const withoutLetter = nafCode.replace(/[A-Z]$/, '');
  const partialMatch = NAF_LABELS[withoutLetter];
  if (partialMatch) {
    return partialMatch;
  }

  // Retourner le code NAF si aucun match
  return `Activité ${nafCode}`;
}

/**
 * Formatte l'activité principale pour affichage dans les rapports
 * @param nafCode Code NAF
 * @returns Format: "Libellé complet (Code NAF)"
 * @example "Commerce de détail de journaux et papeterie en magasin spécialisé (47.62Z)"
 */
export function formatActivity(nafCode: string | null | undefined): string {
  if (!nafCode) {
    return 'Activité non renseignée';
  }

  const label = getNafLabel(nafCode);

  // Si label contient déjà le code, ne pas le dupliquer
  if (label.includes(nafCode)) {
    return label;
  }

  return `${label} (${nafCode})`;
}

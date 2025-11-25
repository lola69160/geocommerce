// Common NAF/APE activity codes for business searches
export const NAF_CODES = [
    { code: '10.71C', label: 'Boulangerie et boulangerie-pâtisserie' },
    { code: '10.71D', label: 'Pâtisserie' },
    { code: '47.26Z,47.62Z', label: 'Tabac / Presse (Journaux, Papeterie)' },
    { code: '56.10A', label: 'Restauration traditionnelle' },
    { code: '56.10B', label: 'Cafétéria et autres libres-services' },
    { code: '56.10C', label: 'Restauration de type rapide' },
    { code: '56.30Z', label: 'Débits de boissons' },
    { code: '47.11F', label: 'Hypermarchés' },
    { code: '47.11D', label: 'Supermarchés' },
    { code: '47.11B', label: 'Commerce d\'alimentation générale' },
    { code: '47.25Z', label: 'Commerce de détail de boissons' },
    { code: '47.24Z', label: 'Commerce de détail de pain, pâtisserie et confiserie' },
    { code: '47.29Z', label: 'Autres commerces de détail alimentaires' },
    { code: '47.71Z', label: 'Commerce de détail d\'habillement' },
    { code: '47.76Z', label: 'Commerce de détail de fleurs' },
    { code: '96.02A', label: 'Coiffure' },
    { code: '96.02B', label: 'Soins de beauté' },
    { code: '47.51Z', label: 'Commerce de détail de textiles' },
    { code: '47.59B', label: 'Commerce de détail de meubles' },
    { code: '47.61Z', label: 'Commerce de détail de livres' },
    { code: '47.78C', label: 'Autres commerces de détail spécialisés divers' },
    { code: '86.21Z', label: 'Activité des médecins généralistes' },
    { code: '86.23Z', label: 'Pratique dentaire' },
    { code: '47.30Z', label: 'Commerce de détail de carburants en magasin spécialisé' },
    { code: '95.12Z', label: 'Réparation d\'équipements de communication' },
];

// Helper function to search NAF codes
export const searchNafCodes = (query) => {
    if (!query || query.length < 2) return NAF_CODES.slice(0, 10);

    const lowerQuery = query.toLowerCase();
    return NAF_CODES.filter(naf =>
        naf.label.toLowerCase().includes(lowerQuery) ||
        naf.code.toLowerCase().includes(lowerQuery)
    );
};

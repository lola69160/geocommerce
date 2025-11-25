import { saveAs } from 'file-saver';
import { formatDate, getEstablishmentCreationDate } from '../utils/businessDisplayUtils';

export const generateMarkdownReport = (cartItems, notes) => {
    const date = new Date().toLocaleDateString('fr-FR');
    let markdown = `# Rapport de sélection - Commerce Finder\n\n`;
    markdown += `**Date:** ${date}\n`;
    markdown += `**Nombre de commerces:** ${cartItems.length}\n\n`;

    markdown += `| Nom | Adresse | Créé | MAJ | Âge | Horaires | Dirigeants | Prix BODACC | Date BODACC | Note |\n`;
    markdown += `| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;

    cartItems.forEach(item => {
        const id = item.siren || item.siret;
        const name = item.nom_complet || item.enseigne || 'N/A';
        const address = item.adresse || 'N/A';

        // Dates
        const creationDate = getEstablishmentCreationDate(item) ? formatDate(getEstablishmentCreationDate(item)) : 'N/A';
        const majDate = item.date_mise_a_jour_insee ? formatDate(item.date_mise_a_jour_insee) : 'N/A';

        // Age calculation
        let age = 'N/A';
        if (item.date_creation) {
            const created = new Date(item.date_creation);
            const now = new Date();
            age = `${Math.floor((now - created) / (365.25 * 24 * 60 * 60 * 1000))} ans`;
        }

        // Horaires
        let hours = 'N/A';
        if (item.openingHours && item.openingHours.length > 0) {
            hours = item.openingHours.join('; ').replace(/\n/g, ' ');
        }

        // Dirigeants
        let dirigeants = 'N/A';
        if (item.dirigeants && item.dirigeants.length > 0) {
            const filteredDirigeants = item.dirigeants.filter(d => d.date_de_naissance || d.annee_de_naissance);
            if (filteredDirigeants.length > 0) {
                dirigeants = filteredDirigeants
                    .map(d => `${d.prenoms} ${d.nom}${d.qualite ? ` (${d.qualite})` : ''}`)
                    .join('; ');
            }
        }

        // BODACC price and date
        let bodaccPrice = 'N/A';
        let bodaccDate = 'N/A';
        if (item.bodaccData) {
            if (Array.isArray(item.bodaccData) && item.bodaccData.length > 0) {
                // Multiple BODACC records
                const prices = item.bodaccData.map(b => `${b.amount.toLocaleString('fr-FR')} €`).join('; ');
                const dates = item.bodaccData.map(b => formatDate(b.date)).join('; ');
                bodaccPrice = prices;
                bodaccDate = dates;
            } else if (item.bodaccData.amount) {
                // Single record
                bodaccPrice = `${item.bodaccData.amount.toLocaleString('fr-FR')} €`;
                bodaccDate = formatDate(item.bodaccData.date);
            }
        }

        const note = notes[id] ? notes[id].replace(/\n/g, ' ').replace(/\|/g, '\\|') : '';

        markdown += `| ${name} | ${address} | ${creationDate} | ${majDate} | ${age} | ${hours} | ${dirigeants} | ${bodaccPrice} | ${bodaccDate} | ${note} |\n`;
    });

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    saveAs(blob, `rapport_commerces_${Date.now()}.md`);
};

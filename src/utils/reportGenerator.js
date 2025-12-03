import { saveAs } from 'file-saver';
import { formatDate } from '../utils/businessDisplayUtils';

export const generateMarkdownReport = (analyzedItems) => {
    const date = new Date().toLocaleDateString('fr-FR');
    let markdown = `# Rapport d'Analyse - Commerce Finder\n\n`;
    markdown += `**Date:** ${date}\n`;
    markdown += `**Nombre de commerces:** ${analyzedItems.length}\n\n`;
    markdown += `---\n\n`;

    analyzedItems.forEach((item, index) => {
        // Data comes from the orchestration endpoint which combines Identity, Assets, and Intelligence
        const { identity, assets, intelligence, openData } = item;

        const commercialName = identity?.commercial_name || 'Nom Inconnu';
        const legalName = identity?.legal_name || 'Société Inconnue';
        const siret = identity?.siret || 'N/A';

        const rating = assets?.rating || 'N/A';
        const userRatingTotal = assets?.user_rating_total || 0;

        const analysisText = intelligence || "Analyse non disponible.";

        // OpenData Fields
        const creationDate = openData?.date_creation ? formatDate(openData.date_creation) : 'Non renseignée';
        const age = openData?.date_creation ? `${new Date().getFullYear() - new Date(openData.date_creation).getFullYear()} ans` : '';

        // Directors
        let directorsList = 'Non renseignés';
        if (openData?.dirigeants && Array.isArray(openData.dirigeants)) {
            directorsList = openData.dirigeants
                .map(d => `${d.prenoms} ${d.nom} (${d.qualite})`)
                .join(', ');
        }

        // BODACC
        let bodaccInfo = 'Aucune publication récente';
        if (openData?.bodaccData && Array.isArray(openData.bodaccData) && openData.bodaccData.length > 0) {
            bodaccInfo = openData.bodaccData.map(b => {
                // Mapping keys from bodaccService.js: date, type, description
                const date = b.date ? formatDate(b.date) : (b.dateparution ? formatDate(b.dateparution) : '');
                const type = b.type || b.typeavis_lib || 'Publication';
                const details = b.description || b.details || '';
                return `- ${date}: ${type} (${details})`;
            }).join('\n');
        }

        markdown += `## Rapport : ${commercialName}\n\n`;

        markdown += `### 🏢 Identité\n`;
        markdown += `**Enseigne :** ${commercialName}\n\n`;
        markdown += `**Société :** ${legalName} (SIRET : ${siret})\n`;
        markdown += `**Date de création :** ${creationDate} ${age ? `(${age})` : ''}\n`;
        markdown += `**Dirigeants :** ${directorsList}\n\n`;
        markdown += `**Note :** ⭐ ${rating}/5 (${userRatingTotal} avis)\n\n`;

        // Horaires
        if (assets?.opening_hours && Array.isArray(assets.opening_hours)) {
            markdown += `### 🕒 Horaires d'ouverture\n`;
            assets.opening_hours.forEach(day => {
                markdown += `- ${day}\n`;
            });
            markdown += `\n`;
        }

        if (bodaccInfo !== 'Aucune publication récente') {
            markdown += `### ⚖️ Publications BODACC\n`;
            markdown += `${bodaccInfo}\n\n`;
        }

        markdown += `### 📸 Visuels\n`;
        if (assets?.photos && assets.photos.length > 0) {
            markdown += `<div style="display: flex; gap: 10px; margin-bottom: 20px;">\n`;
            assets.photos.forEach(url => {
                markdown += `<img src="${url}" alt="${commercialName}" width="300" style="border-radius: 8px;" />\n`;
            });
            markdown += `</div>\n\n`;
        } else {
            markdown += `_Aucun visuel disponible._\n\n`;
        }

        markdown += `### 📍 Analyse de la Zone\n`;
        markdown += `${analysisText}\n\n`;

        markdown += `### 💬 Ce qu'en disent les clients\n`;
        if (assets?.reviews && assets.reviews.length > 0) {
            assets.reviews.forEach(review => {
                markdown += `> "${review.review_text}"\n`;
                markdown += `> — **${review.author_name}** (${review.relative_time})\n\n`;
            });
        } else {
            markdown += `_Aucun avis pertinent disponible._\n\n`;
        }

        markdown += `_Données issues de l'OpenData Gouv & Google Maps_\n\n`;
        markdown += `---\n\n`;
    });

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    saveAs(blob, `rapport_commerces_complet_${Date.now()}.md`);
};

import axios from 'axios';
import logger from '../../logger.js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite-preview:generateContent';

/**
 * Generate a professional context description for a business using Gemini.
 * @param {Object} businessData - The business data (name, address, reviews, summary, etc.)
 * @returns {Promise<string>} - The generated description in French.
 */
export const generateBusinessContext = async (businessData) => {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        logger.warn('GEMINI_API_KEY not configured, cannot generate context');
        return "Description non disponible (Clé API manquante).";
    }

    try {
        const { name, address, reviews, editorialSummary, activity } = businessData;

        let reviewsText = "";
        if (reviews && reviews.length > 0) {
            reviewsText = reviews.map(r => `"${r.text?.text}"`).join("\n");
        }

        const prompt = `Tu es un expert en analyse de commerces et d'immobilier commercial.
Ton objectif est de rédiger un paragraphe descriptif en français pour le rapport d'analyse du commerce "${name}" situé à "${address}".

Données disponibles :
- Résumé Google : ${editorialSummary || "Non disponible"}
- Avis clients : ${reviewsText || "Non disponible"}
- Activité : ${activity || "Non spécifiée"}

Instructions de rédaction :
1. **Priorité au commerce** : Si tu as des infos précises (avis, résumé), décris l'ambiance, la réputation et les points forts du commerce.
2. **Contexte Local (IMPORTANT)** : Si les infos sur le commerce sont maigres (ou en complément), décris le quartier, la ville ou l'emplacement (ex: "Situé sur la place principale d'une ville touristique...", "Zone commerciale dynamique..."). Utilise tes connaissances générales sur la ville/adresse si besoin.
3. **Style** : Professionnel, factuel, mais engageant. Pas de phrases génériques vides comme "L'analyse nécessite plus de données". Si tu ne sais rien sur le commerce, parle de l'emplacement géographique et du potentiel de la zone.
4. **Format** : Un seul paragraphe de 4-5 lignes maximum.`;

        logger.info(`Generating context for "${name}" with Gemini`);

        const response = await axios.post(
            `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
            {
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 300
                }
            }
        );

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        return text || "Description non générée.";

    } catch (error) {
        logger.error('Error generating business context with Gemini', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
        });
        return "Erreur lors de la génération de la description.";
    }
};

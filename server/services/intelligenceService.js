import axios from 'axios';
import logger from '../../logger.js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite-preview:generateContent';
const TAVILY_API_URL = 'https://api.tavily.com/search';

/**
 * Analyze the locality of a business using Web Search and Gemini.
 * @param {string} address - The address of the business.
 * @param {string} city - The city of the business.
 * @param {string} businessType - The type of business (activity).
 * @returns {Promise<string>} - The generated analysis text.
 */
export const analyzeLocality = async (address, city, businessType) => {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

    if (!GEMINI_API_KEY) {
        return "Analyse impossible : Clé Gemini manquante.";
    }

    let searchResultsText = "Recherche web non disponible.";

    // 1. Web Search via Tavily
    if (TAVILY_API_KEY) {
        try {
            const query = `quartier ${address} ${city} ambiance commerce population`;
            logger.debug(`Searching Tavily for: "${query}"`);

            const searchResponse = await axios.post(TAVILY_API_URL, {
                api_key: TAVILY_API_KEY,
                query: query,
                search_depth: "basic",
                include_answer: false,
                max_results: 5
            });

            if (searchResponse.data.results && searchResponse.data.results.length > 0) {
                searchResultsText = searchResponse.data.results
                    .map(r => `- ${r.title}: ${r.content}`)
                    .join('\n');
            }
        } catch (error) {
            logger.error('Error searching Tavily', { error: error.message });
        }
    } else {
        logger.warn('TAVILY_API_KEY not configured, skipping web search');
    }

    // 2. Generate Analysis with Gemini
    try {
        const prompt = `Tu es un expert en géomarketing. À partir des résultats de recherche fournis ci-dessous, rédige une analyse courte (100 mots max) du quartier pour un commerce de type "${businessType || 'Commerce'}".

Résultats de recherche :
${searchResultsText}

Adresse : ${address}, ${city}

Instructions :
1. Détermine le profil des habitants (familles, bureaux, étudiants) si possible.
2. Estime la zone de chalandise logique (ex: rayonnement local ou régional).
3. Décris l'ambiance commerciale.
4. Sois factuel et professionnel.
5. Si les infos sont maigres, base-toi sur la localisation géographique générale de la ville/quartier.`;

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
                    maxOutputTokens: 200
                }
            }
        );

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        return text || "Analyse non générée.";

    } catch (error) {
        logger.error('Error generating locality analysis with Gemini', { error: error.message });
        return "Erreur lors de l'analyse du quartier.";
    }
};

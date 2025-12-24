import axios from 'axios';
import { getEnseigne } from '../utils/businessDisplayUtils';
import { parseOpeningHours } from './placesService';

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3001';

/**
 * Stratégie multi-niveaux pour trouver un commerce sur Google Places
 * @param {Object} business - Données OpenData
 * @returns {Promise<Object|null>} - Données Places ou null
 */
export const findBusinessOnGooglePlaces = async (business) => {
    // Strategy 1: Nearby Search FIRST (most reliable when GPS coordinates are available)
    if (business.lat && business.lon) {
        try {
            const nearbyResult = await axios.post(`${BACKEND_API_URL}/api/places-nearby`, {
                lat: parseFloat(business.lat),
                lon: parseFloat(business.lon),
                radius: 25, // 25 mètres (balance between precision and GPS accuracy)
                address: business.adresse // Pour validation
            });

            if (nearbyResult.data && nearbyResult.data.found) {
                console.log(`✅ Found via NEARBY (precise): ${nearbyResult.data.name}`);
                return nearbyResult.data;
            }
        } catch (err) {
            console.warn('Nearby search failed:', err.message);
        }
    }

    // Strategy 2: Text Search avec Enseigne (si nearby échoue)
    const enseigne = getEnseigne(business);
    const commercialName = enseigne || business.enseigne || business.denominationUsuelle;

    if (commercialName) {
        try {
            const city = business.libelle_commune || business.adresse_ville;
            const textResult = await axios.post(`${BACKEND_API_URL}/api/places-search`, {
                query: `${commercialName} ${city || ''}`,
                address: business.adresse // Pour validation
            });

            if (textResult.data && textResult.data.found) {
                console.log(`✅ Found via TEXT SEARCH (enseigne): ${textResult.data.name}`);
                return textResult.data;
            }
        } catch (err) {
            console.warn('Text search with enseigne failed:', err.message);
        }
    }

    // Strategy 3: Search by ADDRESS ONLY (most reliable for businesses without proper name)
    if (business.geo_adresse || business.adresse) {
        try {
            const addressToSearch = business.geo_adresse || business.adresse;
            const textResult = await axios.post(`${BACKEND_API_URL}/api/places-search`, {
                query: addressToSearch,
                address: business.adresse
            });

            if (textResult.data && textResult.data.found) {
                console.log(`✅ Found via ADDRESS ONLY: ${textResult.data.name}`);
                return textResult.data;
            }
        } catch (err) {
            console.warn('Address-only search failed:', err.message);
        }
    }

    // Strategy 4: Fallback avec nom complet nettoyé (last resort)
    if (business.nom_complet) {
        try {
            const cleanedName = cleanBusinessName(business.nom_complet);
            const textResult = await axios.post(`${BACKEND_API_URL}/api/places-search`, {
                query: `${cleanedName} ${business.adresse}`,
                address: business.adresse
            });

            if (textResult.data && textResult.data.found) {
                console.log(`✅ Found via TEXT SEARCH (cleaned name): ${textResult.data.name}`);
                return textResult.data;
            }
        } catch (err) {
            console.warn('Text search with cleaned name failed:', err.message);
        }
    }

    console.warn(`❌ No Google Places match found for: ${business.nom_complet || business.enseigne || 'Unknown'}`);
    return null;
};

/**
 * Nettoie un nom complet en retirant les noms de propriétaires
 * @param {string} nomComplet - Nom complet avec propriétaire
 * @returns {string} - Nom nettoyé
 */
const cleanBusinessName = (nomComplet) => {
    if (!nomComplet) return '';

    // Extraire le contenu entre parenthèses finales (souvent l'enseigne)
    const match = nomComplet.match(/\(([^)]+)\)$/);
    if (match) {
        return match[1];
    }

    // Si pas de parenthèses, retourner tel quel
    return nomComplet;
};

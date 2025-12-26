import axios from 'axios';
import logger from '../../logger.js';

const PLACES_API_URL = 'https://places.googleapis.com/v1/places:searchNearby';

/**
 * Reconcile business identity to find the true commercial name.
 * @param {Object} businessData - The business data from OpenData.
 * @returns {Promise<Object>} - { legal_name, commercial_name, place_id }
 */
export const reconcileIdentity = async (businessData) => {
    const PLACE_API_KEY = process.env.PLACE_API_KEY;

    // 1. Determine Legal Name
    const legalName = businessData.nom_complet || businessData.nom_raison_sociale || "Nom Inconnu";
    const siret = businessData.siret || businessData.siren;

    // 2. Determine Commercial Name (Enseigne) from OpenData
    let commercialName = businessData.enseigne || businessData.denominationUsuelle || null;
    let placeId = null;

    // 3. If Commercial Name is missing, try to find it via Google Places Nearby Search
    if (!commercialName && businessData.lat && businessData.lon && PLACE_API_KEY) {
        try {
            logger.debug(`Searching for commercial name near [${businessData.lat}, ${businessData.lon}]`);

            const response = await axios.post(
                PLACES_API_URL,
                {
                    locationRestriction: {
                        circle: {
                            center: {
                                latitude: parseFloat(businessData.lat),
                                longitude: parseFloat(businessData.lon)
                            },
                            radius: 20.0 // 20 meters radius
                        }
                    },
                    languageCode: 'fr'
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Goog-Api-Key': PLACE_API_KEY,
                        'X-Goog-FieldMask': 'places.name,places.displayName,places.id'
                    }
                }
            );

            if (response.data.places && response.data.places.length > 0) {
                const place = response.data.places[0];
                commercialName = place.displayName?.text;
                placeId = place.name; // This is the resource name (places/PLACE_ID)
                logger.info(`Found commercial name via Google: "${commercialName}"`);
            }
        } catch (error) {
            logger.error('Error in Google Nearby Search for identity', { error: error.message });
        }
    }

    // Fallback if still no commercial name
    if (!commercialName) {
        commercialName = legalName;
    }

    // If we have a commercial name but no placeId yet (because we had the name from OpenData),
    // we might want to search for the placeId specifically to get assets later.
    // However, the requirement says "If the field is empty, call API... take the first result... store place_id".
    // It implies if we HAVE the name, we might not have the place_id yet. 
    // But Module 2 needs place_id. 
    // So if we have the name but no place_id, we should probably still try to find the place_id 
    // using a Text Search or just rely on the fact that Module 2 might do its own search if needed.
    // BUT, the prompt says: "Module 2: Asset Recovery... via le place_id récupéré juste avant."
    // So we MUST try to get a place_id even if we have the name.

    if (!placeId && PLACE_API_KEY && businessData.lat && businessData.lon) {
        try {
            // We can use the same Nearby Search strategy to find the place_id even if we have the name,
            // or use Text Search with the name we have.
            // Let's stick to the Nearby Search as it's location-based and accurate for "what is here".
            const response = await axios.post(
                PLACES_API_URL,
                {
                    locationRestriction: {
                        circle: {
                            center: {
                                latitude: parseFloat(businessData.lat),
                                longitude: parseFloat(businessData.lon)
                            },
                            radius: 20.0
                        }
                    },
                    languageCode: 'fr'
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Goog-Api-Key': PLACE_API_KEY,
                        'X-Goog-FieldMask': 'places.name,places.displayName,places.id'
                    }
                }
            );

            if (response.data.places && response.data.places.length > 0) {
                // We take the first result as the matching place
                placeId = response.data.places[0].name;
            }
        } catch (error) {
            logger.error('Error fetching place_id', { error: error.message });
        }
    }

    // 4. Fallback: Text Search (if Nearby Search failed or didn't run)
    // This is crucial for businesses with complex legal names vs commercial names
    if (!placeId && PLACE_API_KEY) {
        try {
            const query = `${commercialName} ${businessData.adresse_code_postal || ''} ${businessData.adresse_ville || ''}`;
            logger.debug(`Fallback: Text Search for "${query}"`);

            const response = await axios.post(
                'https://places.googleapis.com/v1/places:searchText',
                {
                    textQuery: query,
                    languageCode: 'fr'
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Goog-Api-Key': PLACE_API_KEY,
                        'X-Goog-FieldMask': 'places.name,places.displayName,places.id'
                    }
                }
            );

            if (response.data.places && response.data.places.length > 0) {
                const place = response.data.places[0];
                // We update the commercial name if it was just the legal name before
                if (commercialName === legalName && place.displayName?.text) {
                    commercialName = place.displayName.text;
                }
                placeId = place.name;
                logger.info(`Found via Text Search: "${place.displayName?.text}"`);
            }
        } catch (error) {
            logger.error('Error in Text Search fallback', { error: error.message });
        }
    }

    return {
        legal_name: legalName,
        commercial_name: commercialName,
        place_id: placeId,
        siret: siret
    };
};

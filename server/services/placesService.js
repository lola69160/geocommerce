import axios from 'axios';
import logger from '../../logger.js';

const PLACES_API_URL = 'https://places.googleapis.com/v1/places:searchText';

/**
 * Search for a business and return its details (Address, GPS, Hours)
 * @param {string} businessName - The name of the business
 * @param {string} address - The address of the business
 * @returns {Promise<Object|null>} - Business details or null if not found
 */
export const getBusinessDetails = async (businessName, address) => {
    const PLACE_API_KEY = process.env.PLACE_API_KEY;

    if (!PLACE_API_KEY) {
        logger.warn('PLACE_API_KEY not configured');
        return null;
    }

    // Combine name and address for better search accuracy
    const textQuery = `${businessName} ${address}`;

    // Fields to retrieve
    const fields = [
        'places.displayName',
        'places.formattedAddress',
        'places.location',
        'places.regularOpeningHours'
    ];

    try {
        logger.debug(`Calling Places API for: "${textQuery}"`);

        const response = await axios.post(
            PLACES_API_URL,
            { textQuery },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': PLACE_API_KEY,
                    'X-Goog-FieldMask': fields.join(',')
                },
                timeout: 5000 // 5s timeout
            }
        );

        // Check if a result was found
        if (response.data.places && response.data.places.length > 0) {
            const place = response.data.places[0];

            logger.info(`Places API found match for: "${businessName}"`, {
                placeId: place.name, // Resource name
                location: place.location
            });

            return {
                name: place.displayName?.text,
                address: place.formattedAddress,
                latitude: place.location?.latitude,
                longitude: place.location?.longitude,
                hours: place.regularOpeningHours?.weekdayDescriptions || null,
                found: true
            };
        }

        logger.info(`No match found in Places API for: "${businessName}"`);
        return { found: false };

    } catch (error) {
        logger.error('Error calling Places API', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
        });
        return null;
    }
};

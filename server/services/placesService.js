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
        'places.regularOpeningHours',
        'places.photos',
        'places.rating',
        'places.userRatingCount',
        'places.reviews',
        'places.editorialSummary'
    ];

    try {
        logger.debug(`Calling Places API for: "${textQuery}"`);

        const response = await axios.post(
            PLACES_API_URL,
            {
                textQuery,
                languageCode: 'fr'
            },
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
                photos: place.photos || [],
                rating: place.rating,
                userRatingCount: place.userRatingCount,
                reviews: place.reviews || [],
                editorialSummary: place.editorialSummary?.text,
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

/**
 * Fetch assets (photos, reviews) from Google Places using place_id.
 * @param {string} placeId - The Google Place ID (resource name).
 * @returns {Promise<Object>} - { photos: [], reviews: [], rating: number, user_rating_total: number }
 */
export const fetchGoogleAssets = async (placeId) => {
    const PLACE_API_KEY = process.env.PLACE_API_KEY;

    if (!placeId || !PLACE_API_KEY) {
        return { photos: [], reviews: [], rating: null, user_rating_total: 0 };
    }

    // Ensure placeId is in the correct format (places/PLACE_ID)
    // Sometimes we might get just the ID, so we check.
    // The API expects "places/ID" for the resource name in the URL path.
    // But wait, the new Places API (v1) uses `places/{placeId}`.
    // If placeId already contains "places/", we use it as is.
    const resourceName = placeId.startsWith('places/') ? placeId : `places/${placeId}`;

    const fields = [
        'photos',
        'reviews',
        'rating',
        'userRatingCount',
        'regularOpeningHours'
    ];

    try {
        const response = await axios.get(
            `https://places.googleapis.com/v1/${resourceName}`,
            {
                params: {
                    key: PLACE_API_KEY,
                    fields: fields.join(','),
                    languageCode: 'fr'
                }
            }
        );

        const place = response.data;

        // Process Photos (Max 3)
        const photos = (place.photos || []).slice(0, 3).map(photo => {
            return `https://places.googleapis.com/v1/${photo.name}/media?key=${PLACE_API_KEY}&maxHeightPx=800&maxWidthPx=800`;
        });

        // Process Reviews (Max 5, non-empty)
        const reviews = (place.reviews || [])
            .filter(r => r.text && r.text.text && r.text.text.trim().length > 0)
            .slice(0, 5)
            .map(r => ({
                author_name: r.authorAttribution?.displayName || 'Anonyme',
                review_text: r.text.text,
                rating: r.rating,
                relative_time: r.relativePublishTimeDescription
            }));

        return {
            photos,
            reviews,
            rating: place.rating,
            user_rating_total: place.userRatingCount,
            opening_hours: place.regularOpeningHours?.weekdayDescriptions || null
        };

    } catch (error) {
        logger.error('Error fetching Google Assets', { error: error.message });
        return { photos: [], reviews: [], rating: null, user_rating_total: 0 };
    }
};

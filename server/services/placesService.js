import axios from 'axios';
import logger from '../../logger.js';

const PLACES_API_URL = 'https://places.googleapis.com/v1/places:searchText';

/**
 * Calculate distance between two GPS points in meters (Haversine formula)
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in meters
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
};

/**
 * Score a Google Place result by address accuracy
 * @param {Object} place - Google Place result
 * @param {string} expectedAddress - Expected address from OpenData
 * @param {Object} coords - {lat, lon} expected coordinates (optional)
 * @returns {number} Score 0-100
 */
export const scorePlaceByAddress = (place, expectedAddress, coords = null) => {
    let score = 0;

    if (!place || !expectedAddress) {
        return 0;
    }

    // Extract components from expected address
    const streetNumberMatch = expectedAddress.match(/^(\d+)/);
    const postalCodeMatch = expectedAddress.match(/(\d{5})/);
    const streetNameMatch = expectedAddress.match(/^\d+\s+([A-Z\s]+)/);

    // Extract from result
    const resultAddress = place.formattedAddress || '';
    const resultStreetNumber = resultAddress.match(/^(\d+)/);
    const resultPostalCode = resultAddress.match(/(\d{5})/);

    // 1. STREET NUMBER MATCH (40 points)
    if (streetNumberMatch && resultStreetNumber) {
        if (streetNumberMatch[1] === resultStreetNumber[1]) {
            score += 40;
        }
    }

    // 2. POSTAL CODE MATCH (30 points)
    if (postalCodeMatch && resultPostalCode) {
        if (postalCodeMatch[1] === resultPostalCode[1]) {
            score += 30;
        }
    }

    // 3. GPS DISTANCE (20 points)
    if (coords && place.location) {
        const distance = calculateDistance(
            coords.lat, coords.lon,
            place.location.latitude, place.location.longitude
        );
        // Full points if within 25m, decreasing to 0 at 100m
        if (distance <= 25) score += 20;
        else if (distance <= 50) score += 15;
        else if (distance <= 75) score += 10;
        else if (distance <= 100) score += 5;
    }

    // 4. STREET NAME SIMILARITY (10 points)
    if (streetNameMatch) {
        const expectedStreet = streetNameMatch[1].trim().toLowerCase();
        const resultStreetLower = resultAddress.toLowerCase();
        if (resultStreetLower.includes(expectedStreet.substring(0, Math.min(10, expectedStreet.length)))) {
            score += 10;
        }
    }

    return score;
};

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
                languageCode: 'fr',
                maxResultCount: 5  // Request 5 results for scoring
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

        // Check if results were found
        if (response.data.places && response.data.places.length > 0) {
            const places = response.data.places;

            logger.info(`Places API returned ${places.length} results for: "${businessName}"`);

            // Score all results
            const scoredPlaces = places.map(place => ({
                place,
                score: scorePlaceByAddress(place, address, null)
            }));

            // Sort by score descending
            scoredPlaces.sort((a, b) => b.score - a.score);

            // Log scores for debugging
            scoredPlaces.forEach(({place, score}) => {
                logger.debug(`Result: "${place.displayName?.text}" at ${place.formattedAddress} - Score: ${score}`);
            });

            // Take best result if score >= 80
            const best = scoredPlaces[0];
            if (best.score >= 80) {
                logger.info(`Places API found match with score ${best.score}: "${best.place.displayName?.text}"`);

                return {
                    name: best.place.displayName?.text,
                    address: best.place.formattedAddress,
                    latitude: best.place.location?.latitude,
                    longitude: best.place.location?.longitude,
                    openingHours: best.place.regularOpeningHours?.weekdayDescriptions || null,
                    photos: best.place.photos || [],
                    rating: best.place.rating,
                    userRatingCount: best.place.userRatingCount,
                    reviews: best.place.reviews || [],
                    editorialSummary: best.place.editorialSummary?.text,
                    found: true,
                    matchScore: best.score  // Include score for transparency
                };
            } else {
                logger.warn(`Best match score ${best.score} below threshold (80) for: "${businessName}"`);
                return { found: false };
            }
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
            openingHours: place.regularOpeningHours?.weekdayDescriptions || null
        };

    } catch (error) {
        logger.error('Error fetching Google Assets', { error: error.message });
        return { photos: [], reviews: [], rating: null, user_rating_total: 0 };
    }
};

/**
 * Search for nearby places by type (for competitor mapping)
 * @param {Object} location - { lat, lon } GPS coordinates
 * @param {number} radius - Search radius in meters
 * @param {string} type - Google Place type (restaurant, cafe, bakery, etc.)
 * @returns {Promise<Array>} - Array of places matching the type
 */
export const nearbySearchByType = async (location, radius, type) => {
    const PLACE_API_KEY = process.env.PLACE_API_KEY;

    if (!PLACE_API_KEY) {
        logger.warn('PLACE_API_KEY not configured');
        return [];
    }

    try {
        logger.debug(`Nearby search: type="${type}", radius=${radius}m, location=(${location.lat}, ${location.lon})`);

        const response = await axios.post(
            'https://places.googleapis.com/v1/places:searchNearby',
            {
                locationRestriction: {
                    circle: {
                        center: {
                            latitude: location.lat,
                            longitude: location.lon
                        },
                        radius
                    }
                },
                includedTypes: [type],
                languageCode: 'fr',
                maxResultCount: 20
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': PLACE_API_KEY,
                    'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.id'
                },
                timeout: 10000 // 10s timeout
            }
        );

        const places = response.data.places || [];

        logger.info(`Nearby search found ${places.length} places of type "${type}"`);

        return places;

    } catch (error) {
        logger.error('Nearby search failed', {
            type,
            radius,
            error: error.message,
            status: error.response?.status
        });
        return [];
    }
};

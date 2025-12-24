import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import logger from './logger.js';
import { getBusinessDetails, fetchGoogleAssets, scorePlaceByAddress } from './server/services/placesService.js';
import { generateBusinessContext } from './server/services/enrichmentService.js';
import { reconcileIdentity } from './server/services/identityService.js';
import { analyzeLocality } from './server/services/intelligenceService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    logger.info('Incoming request', {
        method: req.method,
        path: req.path,
        ip: req.ip
    });
    next();
});

// Configuration Gemini
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// Using gemini-2.0-flash-exp as per Google's API documentation
// Using gemini-2.0-flash-lite-preview as requested
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite-preview:generateContent';

/**
 * Endpoint pour valider un lot d'enregistrements BODACC avec Gemini
 * POST /api/validate-bodacc
 * Body: { records: Array<{id: string, description: string}>, activityLabel: string }
 */
app.post('/api/validate-bodacc', async (req, res) => {
    const startTime = Date.now();
    try {
        const { records, activityLabel } = req.body;

        // Validation des paramètres
        if (!records || !Array.isArray(records) || !activityLabel) {
            logger.warn('Missing or invalid parameters for BODACC validation');
            return res.status(400).json({
                error: 'Missing required parameters: records (array) and activityLabel'
            });
        }

        if (records.length === 0) {
            return res.json({ validIds: [] });
        }

        // Vérifier que la clé API est configurée
        if (!GEMINI_API_KEY) {
            logger.warn('GEMINI_API_KEY not configured');
            // Si pas de clé, on accepte tout par défaut
            return res.json({ validIds: records.map(r => r.id) });
        }

        logger.info(`Validating batch of ${records.length} records for activity: "${activityLabel}"`);

        // Construire le prompt pour le batch
        const recordsText = records.map((r, index) => `RECORD_${index} (ID: ${r.id}):\n${r.description}`).join('\n\n');

        const prompt = `Tu es un expert en analyse d'annonces légales de vente de commerces (BODACC).
Ta tâche est de filtrer une liste d'annonces pour ne garder que celles qui concernent l'activité : "${activityLabel}".

Voici la liste des annonces à analyser :
${recordsText}

INSTRUCTIONS :
1. Analyse chaque annonce.
2. Si l'annonce concerne explicitement un autre type de commerce (ex: pharmacie alors qu'on cherche boulangerie), rejette-la.
3. Si l'annonce concerne bien "${activityLabel}" ou si le type n'est pas clair (bénéfice du doute), garde-la.
4. Réponds UNIQUEMENT au format JSON avec la liste des IDs des annonces valides.

Format de réponse attendu :
{
  "validIds": ["ID1", "ID3", ...]
}`;

        const response = await axios.post(
            `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
            {
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.1,
                    responseMimeType: "application/json"
                }
            }
        );

        const resultText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        let validIds = [];

        try {
            const jsonResult = JSON.parse(resultText);
            validIds = jsonResult.validIds || [];
        } catch (e) {
            logger.error('Error parsing Gemini JSON response', { error: e.message, response: resultText });
            // Fallback: si le parsing échoue, on accepte tout pour ne pas bloquer
            validIds = records.map(r => r.id);
        }

        logger.info(`Gemini batch validation finished`, {
            total: records.length,
            valid: validIds.length,
            responseTime: Date.now() - startTime
        });

        res.json({ validIds });

    } catch (error) {
        logger.error('Error validating batch with Gemini', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
        });

        // En cas d'erreur, accepter tout par défaut
        res.json({ validIds: req.body.records?.map(r => r.id) || [] });
    }
});

// Storage Service Imports
import { getNotes, saveNote, getCart, addToCart, removeFromCart } from './server/services/storageService.js';

// ... existing endpoints ...

/**
 * Endpoint pour récupérer la géolocalisation et les horaires via Google Places
 * POST /api/get-business-location
 * Body: { businessName: string, address: string }
 */
app.post('/api/get-business-location', async (req, res) => {
    try {
        const { businessName, address } = req.body;

        if (!businessName || !address) {
            return res.status(400).json({
                error: 'Missing required parameters: businessName and address'
            });
        }

        logger.info('Fetching business location', { businessName, address });

        const result = await getBusinessDetails(businessName, address);

        if (result && result.found) {
            // Normaliser les horaires pour s'assurer qu'ils sont toujours un tableau ou null
            if (result.openingHours && !Array.isArray(result.openingHours)) {
                result.openingHours = null;
            }
            res.json(result);
        } else {
            res.json({ found: false });
        }

    } catch (error) {
        logger.error('Error in get-business-location endpoint', {
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Endpoint pour enrichir les données d'un commerce (Photos, Avis, Contexte généré)
 * POST /api/enrich-business
 * Body: { businessName: string, address: string, activity: string }
 */
app.post('/api/enrich-business', async (req, res) => {
    try {
        const { businessName, address, activity } = req.body;

        if (!businessName || !address) {
            return res.status(400).json({
                error: 'Missing required parameters: businessName and address'
            });
        }

        logger.info('Enriching business data', { businessName, address });

        // 1. Récupérer les détails Google Places (Photos, Avis, Summary)
        const placesData = await getBusinessDetails(businessName, address);

        let enrichedData = {
            businessName,
            address,
            found: false
        };

        if (placesData && placesData.found) {
            enrichedData = { ...enrichedData, ...placesData };

            // 2. Générer le contexte avec Gemini
            const context = await generateBusinessContext({
                name: businessName,
                address: address,
                reviews: placesData.reviews,
                editorialSummary: placesData.editorialSummary,
                activity: activity
            });

            enrichedData.context = context;

            // 3. Transformer les photos en URLs utilisables
            if (placesData.photos && placesData.photos.length > 0) {
                const PLACE_API_KEY = process.env.PLACE_API_KEY;
                enrichedData.photoUrls = placesData.photos.slice(0, 2).map(photo =>
                    `https://places.googleapis.com/v1/${photo.name}/media?key=${PLACE_API_KEY}&maxHeightPx=400&maxWidthPx=400`
                );
            }
        } else {
            // Si pas trouvé dans Places, on essaie quand même de générer un contexte basique si on a l'activité
            if (activity) {
                const context = await generateBusinessContext({
                    name: businessName,
                    address: address,
                    activity: activity
                });
                enrichedData.context = context;
            }
        }

        res.json(enrichedData);

    } catch (error) {
        logger.error('Error in enrich-business endpoint', {
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Internal server error' });
    }
});


/**
 * Endpoint principal d'analyse complète d'un commerce (Orchestrateur)
 * POST /api/analyze-business
 * Body: { businessData: Object }
 */
app.post('/api/analyze-business', async (req, res) => {
    try {
        const { businessData } = req.body;

        if (!businessData) {
            return res.status(400).json({ error: 'Missing businessData' });
        }

        logger.info('Starting full analysis for business', { siret: businessData.siret });

        // Module 1: Identity Reconciliation
        const identity = await reconcileIdentity(businessData);
        logger.info('Identity reconciled', identity);

        // Module 2: Asset Recovery (including opening hours)
        let assets = { photos: [], reviews: [], rating: null, user_rating_total: 0, openingHours: null };
        if (identity.place_id) {
            assets = await fetchGoogleAssets(identity.place_id);

            // Normalize opening hours to ensure they're always an array or null
            if (assets.openingHours && !Array.isArray(assets.openingHours)) {
                assets.openingHours = null;
            }
        }

        // Use opening hours from assets (already fetched with photos/reviews)
        const openingHours = assets.openingHours || null;

        // Module 3: Territorial Intelligence
        const address = businessData.adresse || 'Adresse inconnue';
        const city = businessData.adresse_ville || '';
        const activity = businessData.activite_principale_libelle || 'Commerce';

        const intelligence = await analyzeLocality(address, city, activity);

        // Combine all data
        const result = {
            identity,
            assets,
            intelligence,
            openData: {
                ...businessData,
                openingHours  // Add opening hours at root level for frontend access
            }
        };

        res.json(result);

    } catch (error) {
        logger.error('Error in analyze-business endpoint', {
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Internal server error during analysis' });
    }
});

// --- NOTES ENDPOINTS ---

app.get('/api/notes', async (req, res) => {
    try {
        const notes = await getNotes();
        res.json(notes);
    } catch (error) {
        logger.error('Error getting notes', { error: error.message });
        res.status(500).json({ error: 'Failed to get notes' });
    }
});

app.post('/api/notes', async (req, res) => {
    try {
        const { businessId, text } = req.body;
        if (!businessId) {
            return res.status(400).json({ error: 'Missing businessId' });
        }
        const notes = await saveNote(businessId, text);
        res.json(notes);
    } catch (error) {
        logger.error('Error saving note', { error: error.message });
        res.status(500).json({ error: 'Failed to save note' });
    }
});

// --- CART ENDPOINTS ---

app.get('/api/cart', async (req, res) => {
    try {
        const cart = await getCart();
        res.json(cart);
    } catch (error) {
        logger.error('Error getting cart', { error: error.message });
        res.status(500).json({ error: 'Failed to get cart' });
    }
});

app.post('/api/cart', async (req, res) => {
    try {
        const { business } = req.body;
        if (!business) {
            return res.status(400).json({ error: 'Missing business data' });
        }
        const cart = await addToCart(business);
        res.json(cart);
    } catch (error) {
        logger.error('Error adding to cart', { error: error.message });
        res.status(500).json({ error: 'Failed to add to cart' });
    }
});

app.delete('/api/cart/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const cart = await removeFromCart(id);
        res.json(cart);
    } catch (error) {
        logger.error('Error removing from cart', { error: error.message });
        res.status(500).json({ error: 'Failed to remove from cart' });
    }
});

/**
 * Endpoint pour recherche nearby par coordonnées GPS
 * POST /api/places-nearby
 * Body: { lat: number, lon: number, radius: number }
 */
app.post('/api/places-nearby', async (req, res) => {
    try {
        const { lat, lon, radius = 25, address } = req.body;

        if (!lat || !lon) {
            return res.status(400).json({ error: 'Missing lat or lon' });
        }

        const PLACE_API_KEY = process.env.PLACE_API_KEY;
        if (!PLACE_API_KEY) {
            logger.warn('PLACE_API_KEY not configured for nearby search');
            return res.json({ found: false });
        }

        logger.info('Searching nearby places', { lat, lon, radius });

        const response = await axios.post(
            'https://places.googleapis.com/v1/places:searchNearby',
            {
                locationRestriction: {
                    circle: {
                        center: { latitude: lat, longitude: lon },
                        radius: radius
                    }
                },
                languageCode: 'fr',
                maxResultCount: 5  // Request 5 results for scoring
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': PLACE_API_KEY,
                    'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.regularOpeningHours,places.id'
                }
            }
        );

        if (response.data.places && response.data.places.length > 0) {
            const places = response.data.places;

            logger.info(`Nearby search returned ${places.length} results`);

            // Score all results
            const scoredPlaces = places.map(place => ({
                place,
                score: scorePlaceByAddress(place, address, { lat, lon })
            }));

            // Sort by score descending
            scoredPlaces.sort((a, b) => b.score - a.score);

            // Log scores for debugging
            scoredPlaces.forEach(({place, score}) => {
                logger.debug(`Nearby result: "${place.displayName?.text}" at ${place.formattedAddress} - Score: ${score}`);
            });

            // Take best result if score >= 80
            const best = scoredPlaces[0];
            if (best.score >= 80) {
                logger.info(`Nearby match with score ${best.score}: "${best.place.displayName?.text}"`);

                return res.json({
                    found: true,
                    name: best.place.displayName?.text,
                    address: best.place.formattedAddress,
                    latitude: best.place.location?.latitude,
                    longitude: best.place.location?.longitude,
                    openingHours: best.place.regularOpeningHours?.weekdayDescriptions || null,
                    placeId: best.place.id,
                    matchScore: best.score
                });
            } else {
                logger.warn(`Best nearby score ${best.score} below threshold (80)`);
                return res.json({ found: false });
            }
        }

        logger.info('No nearby places found');
        res.json({ found: false });
    } catch (error) {
        logger.error('Error in places-nearby endpoint', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
        });
        res.json({ found: false });
    }
});

/**
 * Endpoint pour recherche texte avec validation d'adresse
 * POST /api/places-search
 * Body: { query: string, address: string }
 */
app.post('/api/places-search', async (req, res) => {
    try {
        const { query, address } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'Missing query' });
        }

        logger.info('Searching places by text', { query, address });

        const result = await getBusinessDetails(query, address);
        res.json(result || { found: false });
    } catch (error) {
        logger.error('Error in places-search endpoint', {
            message: error.message,
            stack: error.stack
        });
        res.json({ found: false });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend API is running' });
});

app.listen(PORT, () => {
    logger.info(`Backend API running on http://localhost:${PORT}`, {
        geminiConfigured: !!GEMINI_API_KEY,
        placesConfigured: !!process.env.PLACE_API_KEY
    });
});

// Prevent server from exiting
process.on('SIGINT', () => {
    logger.info('Server shutting down gracefully...');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', { error });
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { reason, promise });
});

logger.info('Server initialization complete');

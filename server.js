import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import logger from './logger.js';
import { getBusinessDetails } from './server/services/placesService.js';

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
            if (result.hours && !Array.isArray(result.hours)) {
                result.hours = null;
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

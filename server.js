import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { Runner, InMemorySessionService } from '@google/adk';
import logger from './logger.js';
import { getBusinessDetails, fetchGoogleAssets, scorePlaceByAddress } from './server/services/placesService.js';
import { generateBusinessContext } from './server/services/enrichmentService.js';
import { reconcileIdentity } from './server/services/identityService.js';
import { analyzeLocality } from './server/services/intelligenceService.js';
import { createMainOrchestrator } from './server/adk/agents/MainOrchestrator.js';
import { createFinancialOrchestrator } from './server/adk/financial/index.js';
import { startExtractionSession, endExtractionSession, logUserComments } from './server/extractionLogger.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configuration paths (must be before middleware that uses __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOCUMENTS_DIR = path.join(__dirname, 'data', 'documents');
const TEMP_DIR = path.join(__dirname, 'data', 'documents', 'temp');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for PDF uploads in base64
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files for generated reports
app.use('/data/financial-reports', express.static(path.join(__dirname, 'data', 'financial-reports')));
app.use('/data/professional-reports', express.static(path.join(__dirname, 'data', 'professional-reports')));

// Créer le répertoire temporaire au démarrage
await fs.mkdir(TEMP_DIR, { recursive: true });

// Configuration Multer pour upload documents PDF
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        // Sauvegarder temporairement dans le dossier temp
        // Le fichier sera déplacé vers le bon dossier après l'upload
        cb(null, TEMP_DIR);
    },
    filename: (req, file, cb) => {
        const sanitized = file.originalname
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .replace(/_{2,}/g, '_');

        const timestamp = Date.now();
        const filename = `${timestamp}_${sanitized}`;
        cb(null, filename);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedMimes = ['application/pdf'];
    const allowedExts = ['.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Seuls les fichiers PDF sont autorisés'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10 MB
    }
});

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
import { getNotes, saveNote, getCart, addToCart, removeFromCart, getDocuments, saveDocument, deleteDocument, getBusinessDocuments } from './server/services/storageService.js';

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

// ============================================
// DOCUMENTS ENDPOINTS
// ============================================

app.get('/api/documents/:siret', async (req, res) => {
    try {
        const { siret } = req.params;
        const documents = await getBusinessDocuments(siret);
        res.json(documents);
    } catch (error) {
        logger.error('Error fetching documents', { error: error.message, siret: req.params.siret });
        res.status(500).json({ error: 'Erreur lors de la récupération des documents' });
    }
});

app.post('/api/documents/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Aucun fichier fourni' });
        }

        const { siret, businessName } = req.body;

        if (!siret) {
            await fs.unlink(req.file.path);
            return res.status(400).json({ error: 'SIRET manquant' });
        }

        // Créer le répertoire du commerce
        const businessDir = path.join(DOCUMENTS_DIR, siret);
        await fs.mkdir(businessDir, { recursive: true });

        // Déplacer le fichier du dossier temp vers le dossier du commerce
        const finalPath = path.join(businessDir, req.file.filename);
        await fs.rename(req.file.path, finalPath);

        const documentMetadata = {
            id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            filename: req.file.originalname,
            storedFilename: req.file.filename,
            path: finalPath,
            size: req.file.size,
            mimeType: req.file.mimetype,
            uploadDate: new Date().toISOString(),
            uploadedBy: 'user',
            businessName: businessName || 'Commerce inconnu'
        };

        const updatedDocuments = await saveDocument(siret, documentMetadata);

        logger.info('Document uploaded successfully', {
            siret,
            filename: req.file.originalname,
            size: req.file.size
        });

        res.json({
            success: true,
            document: documentMetadata,
            documents: updatedDocuments
        });

    } catch (error) {
        logger.error('Error uploading document', { error: error.message });

        if (req.file?.path) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                logger.error('Error deleting file after failed upload', { error: unlinkError.message });
            }
        }

        res.status(500).json({ error: error.message || 'Erreur lors de l\'upload' });
    }
});

app.get('/api/documents/download/:siret/:documentId', async (req, res) => {
    try {
        const { siret, documentId } = req.params;
        const documents = await getBusinessDocuments(siret);

        const document = documents.find(d => d.id === documentId);

        if (!document) {
            return res.status(404).json({ error: 'Document non trouvé' });
        }

        try {
            await fs.access(document.path);
        } catch {
            logger.error('Document file not found on disk', { path: document.path });
            return res.status(404).json({ error: 'Fichier introuvable sur le serveur' });
        }

        res.download(document.path, document.filename);

    } catch (error) {
        logger.error('Error downloading document', { error: error.message });
        res.status(500).json({ error: 'Erreur lors du téléchargement' });
    }
});

app.delete('/api/documents/:siret/:documentId', async (req, res) => {
    try {
        const { siret, documentId } = req.params;

        const { deletedDoc, remainingDocuments } = await deleteDocument(siret, documentId);

        try {
            await fs.unlink(deletedDoc.path);
            logger.info('Document deleted successfully', {
                siret,
                documentId,
                filename: deletedDoc.filename
            });
        } catch (unlinkError) {
            logger.warn('Document metadata deleted but file removal failed', {
                path: deletedDoc.path,
                error: unlinkError.message
            });
        }

        res.json({
            success: true,
            deletedDocument: deletedDoc,
            documents: remainingDocuments
        });

    } catch (error) {
        logger.error('Error deleting document', { error: error.message });
        res.status(500).json({ error: error.message || 'Erreur lors de la suppression' });
    }
});

/**
 * Fonction helper pour sauvegarder manuellement le rapport HTML
 * Utilisée en fallback si le ReportAgent ne sauvegarde pas le fichier
 */
async function saveReportManually(html, siret, outputDir = 'data/professional-reports') {
    try {
        // Créer répertoire si nécessaire
        await fs.mkdir(outputDir, { recursive: true });

        // Générer nom de fichier: YYYYMMDD_HHMMSS_SIRET.html
        const timestamp = new Date()
            .toISOString()
            .replace(/[:\-]/g, '')
            .replace(/\..+/, '')
            .replace('T', '_');

        const filename = `${timestamp}_${siret}.html`;
        const filepath = path.join(outputDir, filename);

        // Sauvegarder fichier
        await fs.writeFile(filepath, html, 'utf8');

        // Vérifier taille fichier
        const stats = await fs.stat(filepath);

        const absolutePath = path.resolve(filepath);

        logger.info('Report manually saved', {
            siret,
            filepath: absolutePath,
            size_kb: Math.round(stats.size / 1024)
        });

        return {
            filepath: absolutePath,
            filename,
            size_bytes: stats.size,
            size_kb: Math.round(stats.size / 1024),
            saved_at: new Date().toISOString()
        };

    } catch (error) {
        logger.error('Failed to save report manually', {
            siret,
            error: error.message
        });
        return null;
    }
}

/**
 * Endpoint pour analyse professionnelle ADK (pipeline TypeScript officiel)
 * POST /api/analyze-professional-adk
 * Body: { business: Object }
 * Returns: { success: boolean, state: AgentState, report: { filepath, filename } }
 */
/**
 * Endpoint ADK pour analyse professionnelle complète
 * Pattern ADK officiel: Runner créé au niveau endpoint
 */
app.post('/api/analyze-professional-adk', async (req, res) => {
    const startTime = Date.now();

    try {
        const { business } = req.body;

        if (!business) {
            return res.status(400).json({ error: 'Missing business parameter' });
        }

        logger.info('Starting ADK professional analysis', {
            siret: business.siret,
            nom: business.enseigne || business.nom_complet || business.nom_raison_sociale
        });

        // Configuration session ADK
        const appName = 'searchcommerce';
        const userId = 'system';
        const sessionId = `analysis-${business.siret || Date.now()}`;

        // 1. Créer session service
        const sessionService = new InMemorySessionService();

        // 2. État initial
        const initialState = {
            business,
            metadata: {
                startTime,
                siret: business.siret,
                pipelineVersion: '2.0.0-ADK'
            }
        };

        // 3. Créer session (vide - state sera initialisé par stateDelta)
        await sessionService.createSession({
            appName,
            userId,
            sessionId
        });

        // 4. Créer orchestrateur SequentialAgent (état de l'art ADK - pas de wrapper LlmAgent)
        const orchestrator = createMainOrchestrator();

        // 5. Créer Runner avec SequentialAgent comme root agent (pas de handoff)
        const runner = new Runner({
            appName,
            agent: orchestrator,
            sessionService
        });

        // 6. Exécuter pipeline et collecter state
        let finalState = { ...initialState };
        let lastAgentAuthor = null; // Track agent changes for logging

        logger.info('Starting ADK pipeline', { siret: business.siret });

        for await (const event of runner.runAsync({
            userId,
            sessionId,
            newMessage: {
                role: 'user',
                parts: [{
                    text: `Start professional analysis pipeline

Business Data:
${JSON.stringify(business, null, 2)}

The business data is also available in state.business for all agents.`
                }]
            },
            stateDelta: initialState
        })) {
            // Détecter mise à jour du state (pattern ADK correct)
            if (event.actions?.stateDelta && Object.keys(event.actions.stateDelta).length > 0) {
                const deltaKeys = Object.keys(event.actions.stateDelta);

                logger.info('State update detected:', {
                    siret: business.siret,
                    keys: deltaKeys,
                    author: event.author
                });

                // AUTO-PARSING JSON STRINGS → OBJECTS
                deltaKeys.forEach(key => {
                    const value = event.actions.stateDelta[key];

                    // Détecter si c'est un JSON string
                    if (typeof value === 'string' && value.trim().startsWith('{')) {
                        try {
                            const parsed = JSON.parse(value);
                            event.actions.stateDelta[key] = parsed;

                            logger.info(`JSON string auto-parsed for state.${key}`, {
                                siret: business.siret,
                                originalType: 'string',
                                parsedType: typeof parsed,
                                isObject: typeof parsed === 'object' && !Array.isArray(parsed)
                            });
                        } catch (e) {
                            logger.warn(`Failed to auto-parse JSON for state.${key} - keeping as string`, {
                                siret: business.siret,
                                error: e.message,
                                valueSample: value.substring(0, 100)
                            });
                        }
                    }
                });

                // Log détaillé de la réponse de chaque agent
                deltaKeys.forEach(key => {
                    const value = event.actions.stateDelta[key];
                    const valueStr = JSON.stringify(value);

                    logger.info(`Agent response [${event.author}] -> ${key}:`, {
                        siret: business.siret,
                        dataType: typeof value,
                        isObject: typeof value === 'object' && !Array.isArray(value),
                        isArray: Array.isArray(value),
                        sampleData: valueStr.length > 500
                            ? valueStr.substring(0, 500) + '... (truncated)'
                            : valueStr
                    });
                });

                Object.assign(finalState, event.actions.stateDelta);
            }

            // Détecter changement d'agent (nouveau agent démarre)
            if (event.author && event.author !== 'user' && event.invocationId) {
                const isNewAgent = !lastAgentAuthor || lastAgentAuthor !== event.author;
                if (isNewAgent) {
                    console.log('\n' + '='.repeat(80));
                    console.log(`🚀 AGENT STARTED: ${event.author}`);
                    console.log('='.repeat(80));
                    lastAgentAuthor = event.author;
                }
            }

            // Logger les appels d'outils (function calls)
            if (event.content?.parts) {
                event.content.parts.forEach(part => {
                    if (part.functionCall) {
                        const toolName = part.functionCall.name;
                        const toolArgs = part.functionCall.args || {};

                        console.log(`\n🔧 TOOL CALLED: ${toolName}`);
                        console.log(`   Parameters:`, JSON.stringify(toolArgs, null, 2).split('\n').map((line, i) => i === 0 ? line : `   ${line}`).join('\n'));
                    }

                    if (part.functionResponse) {
                        const toolName = part.functionResponse.name;
                        const toolResult = part.functionResponse.response || {};
                        const resultStr = JSON.stringify(toolResult, null, 2);
                        const truncated = resultStr.length > 500
                            ? resultStr.substring(0, 500) + '\n   ... (truncated)'
                            : resultStr;

                        console.log(`\n✅ TOOL RESULT: ${toolName}`);
                        console.log(`   Response:`, truncated.split('\n').map((line, i) => i === 0 ? line : `   ${line}`).join('\n'));
                    }
                });
            }

            // Détecter erreurs ADK
            if (event.errorCode) {
                logger.error(`ADK Error (${event.errorCode}): ${event.errorMessage}`, {
                    siret: business.siret,
                    author: event.author,
                    errorDetails: event.errorDetails || 'No details provided'
                });
            }

            // Log du contenu complet de l'événement pour debug avancé
            if (event.content?.parts) {
                const textContent = event.content.parts
                    .filter(p => p.text)
                    .map(p => p.text)
                    .join(' ');

                if (textContent && textContent.length > 0) {
                    logger.debug(`Agent raw response [${event.author}]:`, {
                        siret: business.siret,
                        contentSample: textContent.substring(0, 300)
                    });
                }
            }
        }

        // 7. Finaliser metadata
        const totalDuration = Date.now() - startTime;
        finalState.metadata = {
            ...finalState.metadata,
            endTime: Date.now(),
            duration: totalDuration
        };

        logger.info('ADK pipeline completed', {
            siret: business.siret,
            duration: totalDuration,
            recommendation: finalState.strategic?.recommendation,
            score: finalState.gap?.scores?.overall
        });

        // 7.5. Sauvegarde automatique du rapport
        if (finalState.report) {
            // Vérifier si report est un objet (pas une string d'erreur)
            const isObject = typeof finalState.report === 'object' && !Array.isArray(finalState.report);

            logger.info('Report state after pipeline', {
                siret: business.siret,
                reportType: typeof finalState.report,
                isObject: isObject,
                hasHtml: isObject && !!finalState.report?.html,
                hasFilepath: isObject && !!finalState.report?.filepath,
                reportSample: typeof finalState.report === 'string'
                    ? finalState.report.substring(0, 200)
                    : JSON.stringify(finalState.report).substring(0, 200)
            });

            // Si report est un objet avec HTML mais sans filepath, sauvegarder
            if (isObject && finalState.report.html && !finalState.report.filepath) {
                logger.warn('Report HTML generated but not saved - saving manually', {
                    siret: business.siret
                });

                const savedReport = await saveReportManually(
                    finalState.report.html,
                    business.siret
                );

                if (savedReport) {
                    finalState.report = {
                        ...finalState.report,
                        ...savedReport
                    };
                    logger.info('Report saved successfully', {
                        siret: business.siret,
                        filepath: savedReport.filepath
                    });
                }
            } else if (typeof finalState.report === 'string') {
                // Report est un message d'erreur
                logger.error('Report generation failed - agent returned error message', {
                    siret: business.siret,
                    errorMessage: finalState.report.substring(0, 300)
                });
            }
        } else {
            logger.warn('No report generated by pipeline', { siret: business.siret });
        }

        // 8. Réponse
        res.json({
            success: true,
            state: finalState,
            report: finalState.report ? {
                filepath: finalState.report.filepath,
                filename: finalState.report.filename,
                html: finalState.report.html
            } : null,
            summary: {
                recommendation: finalState.strategic?.recommendation,
                overall_score: finalState.gap?.scores?.overall,
                total_risks: finalState.gap?.risk_summary?.total_risks || 0,
                critical_risks: finalState.gap?.risk_summary?.by_severity?.critical || 0,
                coherence_score: finalState.validation?.coherence_score
            },
            metadata: {
                siret: business.siret,
                duration: totalDuration,
                agents_executed: 10,
                timestamp: new Date().toISOString(),
                pipeline_version: '2.0.0-ADK'
            }
        });

    } catch (error) {
        const duration = Date.now() - startTime;

        logger.error('ADK pipeline failed', {
            siret: req.body.business?.siret,
            error: error.message,
            stack: error.stack,
            duration
        });

        res.status(500).json({
            success: false,
            error: 'Analysis failed',
            message: error.message,
            duration
        });
    }
});

/**
 * Endpoint pour analyse financière ADK (pipeline TypeScript indépendant)
 * POST /api/analyze-financial
 * Body: { documents: Array, businessInfo: Object, options?: Object }
 * Returns: { success: boolean, reportPath: string, summary: Object }
 */
app.post('/api/analyze-financial', async (req, res) => {
    const startTime = Date.now();

    try {
        const { documents, businessInfo, userComments, options = {} } = req.body;

        if (!documents || !Array.isArray(documents) || documents.length === 0) {
            return res.status(400).json({ error: 'Missing documents parameter (must be non-empty array)' });
        }

        if (!businessInfo || !businessInfo.name) {
            return res.status(400).json({ error: 'Missing businessInfo parameter (must include name)' });
        }

        if (!businessInfo.secteurActivite) {
            return res.status(400).json({ error: 'Le champ "Secteur d\'activité" est obligatoire' });
        }

        logger.info('Starting Financial ADK analysis', {
            siret: businessInfo.siret || 'N/A',
            name: businessInfo.name,
            documentsCount: documents.length
        });

        // Start extraction logging session (creates unique log file per analysis)
        const siretForLog = businessInfo.siret || 'N_A';
        startExtractionSession(siretForLog);

        // Configuration session ADK
        const appName = 'searchcommerce-financial';
        const userId = 'system';
        const sessionId = `financial-${businessInfo.siret || Date.now()}`;

        // 1. Créer session service
        const sessionService = new InMemorySessionService();

        // 2. Convertir les documents base64 en Buffer si nécessaire
        const processedDocuments = documents.map(doc => {
            if (doc.content && typeof doc.content === 'string') {
                // Supprimer le préfixe data:application/pdf;base64, si présent
                const base64Data = doc.content.replace(/^data:application\/pdf;base64,/, '');
                return {
                    ...doc,
                    content: Buffer.from(base64Data, 'base64')
                };
            }
            return doc;
        });

        // ========================================
        // PARSING LANGAGE NATUREL DES USER COMMENTS
        // ========================================
        function parseNaturalLanguageUserComments(comments) {
            if (!comments?.autres) return comments;

            const text = comments.autres;
            const result = { ...comments };

            console.log('[parseNLP] Analyse du texte libre utilisateur...');

            // ========================================
            // PRIORITY SYSTEM: Structured fields override NLP
            // ========================================

            // 1. LOYER - PRIORITY: Use structured fields if present
            const hasStructuredLoyer = comments.loyer?.loyer_actuel || comments.loyer?.loyer_negocie;

            if (hasStructuredLoyer) {
                console.log('[parseNLP] ✅ Loyer structuré détecté - NLP skip');
                result.loyer = result.loyer || {};

                // Keep structured values, no NLP override
                if (comments.loyer.loyer_actuel) {
                    result.loyer.loyer_actuel_mensuel = comments.loyer.loyer_actuel; // Maintain legacy compatibility
                    console.log(`[parseNLP] ✅ Loyer actuel (structuré): ${comments.loyer.loyer_actuel}€/mois`);
                }

                if (comments.loyer.loyer_negocie) {
                    result.loyer.loyer_futur_mensuel = comments.loyer.loyer_negocie; // Maintain legacy compatibility
                    result.loyer.futur_loyer_commercial = comments.loyer.loyer_negocie; // Also used by immobilier
                    console.log(`[parseNLP] ✅ Loyer négocié (structuré): ${comments.loyer.loyer_negocie}€/mois`);
                }
            }

            // FALLBACK: NLP extraction from text (only if no structured fields)
            if (!hasStructuredLoyer) {
                // 1a. LOYER ACTUEL: "loyer mensuel actuel de 2600 €"
            const loyerActuelPatterns = [
                /loyer\s*(?:mensuel\s*)?actuel\s*(?:de\s*)?([\d\s]+)\s*€/i,
                /loyer\s*(?:mensuel\s*)?(?:de\s*)?([\d\s]+)\s*€.*?(?:descendu|négocié)/i
            ];
            for (const pattern of loyerActuelPatterns) {
                const match = text.match(pattern);
                if (match) {
                    const currentRent = parseInt(match[1].replace(/\s/g, ''));
                    if (currentRent > 0 && currentRent < 50000) {
                        result.loyer = result.loyer || {};
                        result.loyer.loyer_actuel_mensuel = currentRent;
                        console.log(`[parseNLP] ✅ Loyer actuel: ${currentRent}€/mois`);
                        break;
                    }
                }
            }

            // 1b. LOYER NEGOCIE: "loyer descendu à 1800 €" or "loyer négocié à 1800€"
            const loyerNegociePatterns = [
                /loyer.*(?:descendu|négocié|renégocié)\s*(?:à|a)\s*([\d\s]+)\s*€/i,
                /nouveau\s*loyer.*?([\d\s]+)\s*€/i,
                /(?:descendu|négocié|renégocié)\s*(?:à|a)\s*([\d\s]+)\s*€\s*(?:par\s*mois)?/i
            ];
            for (const pattern of loyerNegociePatterns) {
                const match = text.match(pattern);
                if (match) {
                    const newRent = parseInt(match[match.length - 1].replace(/\s/g, ''));
                    if (newRent > 0 && newRent < 50000) {
                        result.loyer = result.loyer || {};
                        result.loyer.futur_loyer_commercial = newRent;
                        console.log(`[parseNLP] ✅ Loyer négocié: ${newRent}€/mois`);
                        break;
                    }
                }
            }
            } // End of if (!hasStructuredLoyer) - NLP fallback

            // 2. BUDGET TRAVAUX: "budget de 30000 € de travaux"
            const travauxMatch = text.match(/budget\s*(?:de\s*)?([\d\s]+)\s*€\s*(?:de\s*)?travaux/i) ||
                                 text.match(/travaux.*?([\d\s]+)\s*€/i);
            if (travauxMatch) {
                const budget = parseInt(travauxMatch[1].replace(/\s/g, ''));
                if (budget > 0) {
                    result.travaux = result.travaux || {};
                    result.travaux.budget_prevu = budget;
                    console.log(`[parseNLP] ✅ Budget travaux: ${budget}€`);
                }
            }

            // 3. APPORT PERSONNEL: "apport personnel sera de 100000 euros"
            const apportMatch = text.match(/apport\s*personnel.*?([\d\s]+)\s*(?:€|euros?)/i);
            if (apportMatch) {
                const apport = parseInt(apportMatch[1].replace(/\s/g, ''));
                if (apport > 0) {
                    result.apport_personnel = apport;
                    console.log(`[parseNLP] ✅ Apport personnel: ${apport}€`);
                }
            }

            // 4. TNS SALARY: "TNS payé 2100 euros brut par mois"
            const tnsMatch = text.match(/TNS.*?([\d\s]+)\s*(?:€|euros?)/i);
            if (tnsMatch) {
                const salaireTns = parseInt(tnsMatch[1].replace(/\s/g, ''));
                if (salaireTns > 0 && salaireTns < 20000) {
                    result.salaires = result.salaires || {};
                    result.salaires.tns_mensuel = salaireTns;
                    console.log(`[parseNLP] ✅ Salaire TNS: ${salaireTns}€/mois`);
                }
            }

            // 5. SALARIES: "salarié temps plein au smic 1 801,80 €"
            const salarieMatches = [...text.matchAll(/salari[ée].*?([\d\s,]+)\s*€/gi)];
            const salaries = [];
            for (const match of salarieMatches) {
                const salaire = parseFloat(match[1].replace(/\s/g, '').replace(',', '.'));
                if (salaire > 0 && salaire < 20000) {
                    const isSaisonnier = match[0].toLowerCase().includes('juin') ||
                                         match[0].toLowerCase().includes('septembre') ||
                                         match[0].toLowerCase().includes('saison');
                    salaries.push({ montant: salaire, saisonnier: isSaisonnier });
                }
            }
            if (salaries.length > 0) {
                result.salaires = result.salaires || {};
                result.salaires.liste = salaries;
                console.log(`[parseNLP] ✅ Salariés: ${salaries.length} trouvés`);
            }

            return result;
        }

        // ========================================
        // PARSE TRANSACTION FINANCING DATA
        // Priority: Manual form > PDF extraction > NLP fallback
        // ========================================
        function parseTransactionFinancing(userComments) {
            // PRIORITY 0: Manual form input (structured data from frontend)
            if (userComments?.transactionFinancing?.initial) {
                console.log('[parseFinancing] ✅ Manual form data detected - using structured input');
                return userComments.transactionFinancing;
            }

            // PRIORITY 1: PDF extraction would be handled here (future)
            // if (extractedTransactionCosts) { ... }

            // PRIORITY 2: NLP fallback (future extension if needed)
            console.log('[parseFinancing] ⚠️ No structured financing data - skipping');
            return null;
        }

        // Appliquer le parsing NLP aux commentaires utilisateur
        const enrichedUserComments = parseNaturalLanguageUserComments(userComments || {});

        // Intégrer les données de financement si disponibles
        const transactionFinancing = parseTransactionFinancing(userComments || {});
        if (transactionFinancing) {
            enrichedUserComments.transactionFinancing = transactionFinancing;
            console.log('[parseFinancing] ✅ Transaction financing data integrated into state');
        }

        // 3. État initial
        const initialState = {
            documents: processedDocuments,
            businessInfo: {
                name: businessInfo.name,
                siret: businessInfo.siret || '',
                nafCode: businessInfo.nafCode || '',              // NAF from API (audit trail only)
                secteurActivite: businessInfo.secteurActivite,    // User-selected sector code (required)
                secteurActiviteLabel: businessInfo.secteurActiviteLabel || '', // User-selected sector label (for display)
                activity: businessInfo.activity || ''
            },
            userComments: enrichedUserComments,
            options: {
                prixAffiche: options.prixAffiche || null,
                includeImmobilier: options.includeImmobilier !== false // true par défaut
            },
            metadata: {
                startTime,
                siret: businessInfo.siret || 'N/A',
                pipelineVersion: '1.0.0-Financial'
            }
        };

        // ========================================
        // AFFICHAGE CONSOLE DES USER COMMENTS
        // ========================================
        console.log('\n╔═══════════════════════════════════════════════════════════════');
        console.log('║  USER COMMENTS REÇUS (analyse financière)');
        console.log('╚═══════════════════════════════════════════════════════════════\n');

        if (userComments && Object.keys(userComments).length > 0) {
            console.log('📝 Commentaires utilisateur fournis:\n');

            // 1. Salaire dirigeant
            if (userComments.salaire_dirigeant) {
                console.log('  💼 Salaire dirigeant:');
                console.log(`     → ${userComments.salaire_dirigeant.toLocaleString('fr-FR')} € / an`);
                console.log('');
            }

            // 2. Salariés non repris
            if (userComments.salaries_non_repris) {
                console.log('  👥 Salariés non repris:');
                console.log(`     → Nombre: ${userComments.salaries_non_repris.nombre}`);
                console.log(`     → Masse salariale: ${userComments.salaries_non_repris.masse_salariale_annuelle?.toLocaleString('fr-FR') || 'N/A'} € / an`);
                console.log(`     → Motif: ${userComments.salaries_non_repris.motif || 'Non renseigné'}`);
                console.log('');
            }

            // 3. Salaires saisonniers prévus
            if (userComments.salaires_saisonniers_prevus) {
                console.log('  🌴 Salaires saisonniers prévus:');
                console.log(`     → ${userComments.salaires_saisonniers_prevus.toLocaleString('fr-FR')} € / an`);
                console.log('');
            }

            // 4. Loyer (détaillé)
            if (userComments.loyer) {
                console.log('  🏠 Informations Loyer:');
                if (userComments.loyer.loyer_actuel_mensuel) {
                    console.log(`     → Loyer actuel: ${userComments.loyer.loyer_actuel_mensuel.toLocaleString('fr-FR')} € / mois (${(userComments.loyer.loyer_actuel_mensuel * 12).toLocaleString('fr-FR')} € / an)`);
                }
                if (userComments.loyer.loyer_futur_mensuel) {
                    console.log(`     → Loyer négocié: ${userComments.loyer.loyer_futur_mensuel.toLocaleString('fr-FR')} € / mois (${(userComments.loyer.loyer_futur_mensuel * 12).toLocaleString('fr-FR')} € / an)`);
                    const economie = (userComments.loyer.loyer_actuel_mensuel - userComments.loyer.loyer_futur_mensuel) * 12;
                    if (economie > 0) {
                        console.log(`     → Économie annuelle: ${economie.toLocaleString('fr-FR')} € / an`);
                    }
                }
                if (userComments.loyer.futur_loyer_commercial) {
                    console.log(`     → Loyer commercial futur: ${userComments.loyer.futur_loyer_commercial.toLocaleString('fr-FR')} € / mois`);
                }
                if (userComments.loyer.loyer_logement_perso) {
                    console.log(`     → Loyer logement perso: ${userComments.loyer.loyer_logement_perso.toLocaleString('fr-FR')} € / mois (${(userComments.loyer.loyer_logement_perso * 12).toLocaleString('fr-FR')} € / an)`);
                }
                if (userComments.loyer.commentaire) {
                    console.log(`     → Commentaire: "${userComments.loyer.commentaire}"`);
                }
                console.log('');
            }

            // 5. Budget travaux
            if (userComments.budget_travaux) {
                console.log('  🔨 Budget travaux:');
                console.log(`     → ${userComments.budget_travaux.toLocaleString('fr-FR')} €`);
                console.log('');
            }

            // 6. Autres informations
            if (userComments.autres) {
                console.log('  📋 Autres informations:');
                console.log(`     → "${userComments.autres}"`);
                console.log('');
            }

            // 7. Horaires extension
            if (userComments.horaires_extension) {
                console.log('  ⏰ Extension horaires prévue:');
                console.log(`     → "${userComments.horaires_extension}"`);
                console.log('');
            }

            console.log('═══════════════════════════════════════════════════════════════\n');

            // Log userComments to dedicated extraction log file
            logUserComments(businessInfo.siret || 'N/A', enrichedUserComments);
        } else {
            console.log('⚠️  Aucun commentaire utilisateur fourni.\n');
            console.log('═══════════════════════════════════════════════════════════════\n');
        }

        // 4. Créer session
        await sessionService.createSession({
            appName,
            userId,
            sessionId
        });

        // 5. Créer orchestrateur SequentialAgent
        const orchestrator = createFinancialOrchestrator();

        // 6. Créer Runner
        const runner = new Runner({
            appName,
            agent: orchestrator,
            sessionService
        });

        // 7. Exécuter pipeline et collecter state
        let finalState = { ...initialState };
        let lastAgentAuthor = null;

        logger.info('Starting Financial ADK pipeline', {
            siret: businessInfo.siret || 'N/A',
            name: businessInfo.name
        });

        for await (const event of runner.runAsync({
            userId,
            sessionId,
            newMessage: {
                role: 'user',
                parts: [{
                    text: `Start financial analysis pipeline

Documents: ${documents.length} file(s)
Business: ${businessInfo.name}

The documents and business info are available in state for all agents.`
                }]
            },
            stateDelta: initialState
        })) {
            // Détecter mise à jour du state
            if (event.actions?.stateDelta && Object.keys(event.actions.stateDelta).length > 0) {
                const deltaKeys = Object.keys(event.actions.stateDelta);

                logger.info('State update detected:', {
                    siret: businessInfo.siret || 'N/A',
                    keys: deltaKeys,
                    author: event.author
                });

                // AUTO-PARSING JSON STRINGS → OBJECTS
                deltaKeys.forEach(key => {
                    const value = event.actions.stateDelta[key];

                    // DEBUG: Log raw value before parsing
                    if (key === 'comptable' || key === 'valorisation' || key === 'financialReport') {
                        console.log(`\n📋 RAW OUTPUT from ${key}:`);
                        console.log(typeof value === 'string' ? value.substring(0, 500) + '...' : JSON.stringify(value, null, 2).substring(0, 500) + '...');
                        console.log('');
                    }

                    if (typeof value === 'string' && value.trim().startsWith('{')) {
                        try {
                            const parsed = JSON.parse(value);
                            event.actions.stateDelta[key] = parsed;

                            logger.info(`JSON string auto-parsed for state.${key}`, {
                                siret: businessInfo.siret || 'N/A',
                                originalType: 'string',
                                parsedType: typeof parsed
                            });

                            // DEBUG: Log parsed structure for comptable
                            if (key === 'comptable') {
                                console.log(`\n✅ PARSED COMPTABLE STRUCTURE:`);
                                console.log('  - sig:', parsed.sig ? Object.keys(parsed.sig) : 'MISSING');
                                console.log('  - healthScore:', parsed.healthScore);
                                console.log('  - ratios:', parsed.ratios ? 'PRESENT' : 'MISSING');
                                console.log('');
                            }

                            // DEBUG: Log valorisation structure
                            if (key === 'valorisation') {
                                console.log(`\n✅ PARSED VALORISATION STRUCTURE:`);
                                console.log('  - methodeEBE:', parsed.methodeEBE ? 'PRESENT' : 'MISSING');
                                console.log('  - methodeCA:', parsed.methodeCA ? 'PRESENT' : 'MISSING');
                                console.log('  - methodePatrimoniale:', parsed.methodePatrimoniale ? 'PRESENT' : 'MISSING');
                                console.log('  - methodeHybride:', parsed.methodeHybride ? 'PRESENT (Tabac/Presse)' : 'MISSING');
                                console.log('  - synthese:', parsed.synthese ? JSON.stringify(parsed.synthese, null, 2) : 'MISSING');
                                console.log('');
                            }

                            // DEBUG: Log extraction methods used for documentExtraction
                            if (key === 'documentExtraction') {
                                const docs = parsed.documents || [];
                                const methods = docs.reduce((acc, doc) => {
                                    acc[doc.method || 'unknown'] = (acc[doc.method || 'unknown'] || 0) + 1;
                                    return acc;
                                }, {});

                                console.log(`\n📊 EXTRACTION METHODS USED:`);
                                console.log('  Vision:', methods.vision || 0);
                                console.log('  Heuristic:', methods.heuristic || 0);
                                console.log('  Failed:', methods.vision_failed || 0);
                                console.log('');

                                docs.forEach(doc => {
                                    console.log(`📄 Document: ${doc.filename}`);
                                    console.log(`   Method: ${doc.method}`);
                                    console.log(`   Type: ${doc.documentType}`);
                                    console.log(`   Year: ${doc.year}`);
                                    console.log(`   Confidence: ${doc.confidence}`);
                                    console.log(`   Tables: ${doc.extractedData?.tables?.length || 0}`);
                                    console.log(`   Key Values: ${Object.keys(doc.extractedData?.key_values || {}).length}`);
                                    console.log('');
                                });
                            }
                        } catch (e) {
                            logger.warn(`Failed to auto-parse JSON for state.${key}`, {
                                siret: businessInfo.siret || 'N/A',
                                error: e.message
                            });
                        }
                    }
                });

                Object.assign(finalState, event.actions.stateDelta);
            }

            // Détecter changement d'agent
            if (event.author && event.author !== 'user' && event.invocationId) {
                const isNewAgent = !lastAgentAuthor || lastAgentAuthor !== event.author;
                if (isNewAgent) {
                    console.log('\n' + '='.repeat(80));
                    console.log(`🚀 FINANCIAL AGENT STARTED: ${event.author}`);
                    console.log('='.repeat(80));
                    lastAgentAuthor = event.author;
                }
            }

            // DEBUG: Log FinancialReport agent output to diagnose parsing issues
            if (event.author === 'financialReport' && event.content?.parts) {
                console.log('[DEBUG] FinancialReport raw output:', {
                    partsCount: event.content.parts.length,
                    firstPart: event.content.parts[0]?.text?.substring(0, 300) || 'no text'
                });
            }
        }

        // 8. Finaliser metadata
        const totalDuration = Date.now() - startTime;
        finalState.metadata = {
            ...finalState.metadata,
            endTime: Date.now(),
            duration: totalDuration
        };

        logger.info('Financial ADK pipeline completed', {
            siret: businessInfo.siret || 'N/A',
            duration: totalDuration,
            reportGenerated: !!finalState.financialReport?.generated,
            healthScore: finalState.comptable?.healthScore?.overall,
            confidence: finalState.financialValidation?.confidenceScore?.overall
        });

        // DEBUG: Log full finalState to understand what's happening
        console.log('\n' + '='.repeat(80));
        console.log('🔍 FINAL STATE DEBUG');
        console.log('='.repeat(80));
        console.log('documentExtraction:', finalState.documentExtraction ? 'PRESENT' : 'MISSING');
        console.log('comptable:', finalState.comptable ? 'PRESENT' : 'MISSING');
        if (finalState.comptable) {
            console.log('  - healthScore:', finalState.comptable.healthScore);
            console.log('  - sig:', finalState.comptable.sig ? Object.keys(finalState.comptable.sig) : 'MISSING');
        }
        console.log('valorisation:', finalState.valorisation ? 'PRESENT' : 'MISSING');
        console.log('immobilier:', finalState.immobilier ? 'PRESENT' : 'MISSING');
        console.log('financialValidation:', finalState.financialValidation ? 'PRESENT' : 'MISSING');
        console.log('financialReport:', finalState.financialReport ? JSON.stringify(finalState.financialReport, null, 2) : 'MISSING');
        console.log('='.repeat(80) + '\n');

        // 9. Extraire summary
        const healthScore = finalState.comptable?.healthScore?.overall || 0;
        const confidenceScore = finalState.financialValidation?.confidenceScore?.overall || 0;

        // Déterminer le verdict
        let verdict = 'DÉFAVORABLE';
        if (healthScore >= 70 && confidenceScore >= 70) {
            verdict = 'FAVORABLE';
        } else if (healthScore >= 50 && confidenceScore >= 50) {
            verdict = 'FAVORABLE AVEC RÉSERVES';
        }

        const summary = {
            healthScore,
            valorisation: {
                min: finalState.valorisation?.synthese?.fourchette_basse || 0,
                median: finalState.valorisation?.synthese?.valeur_recommandee || finalState.valorisation?.synthese?.fourchette_mediane || 0,
                max: finalState.valorisation?.synthese?.fourchette_haute || 0
            },
            verdict,
            confidence: confidenceScore
        };

        // End extraction logging session
        endExtractionSession(siretForLog);

        // 10. Réponse
        res.json({
            success: true,
            reportPath: finalState.financialReport?.filepath || null,
            reportFilename: finalState.financialReport?.filename || null,
            summary,
            executionTime: totalDuration,
            agentsExecuted: 6,
            state: {
                comptable: finalState.comptable ? {
                    healthScore: finalState.comptable.healthScore,
                    evolution: finalState.comptable.evolution,
                    synthese: finalState.comptable.synthese
                } : null,
                valorisation: finalState.valorisation ? {
                    synthese: finalState.valorisation.synthese,
                    comparaisonPrix: finalState.valorisation.comparaisonPrix
                } : null,
                validation: finalState.financialValidation ? {
                    confidenceScore: finalState.financialValidation.confidenceScore,
                    niveauConfiance: finalState.financialValidation.synthese?.niveauConfiance
                } : null
            }
        });

    } catch (error) {
        const duration = Date.now() - startTime;

        // End extraction logging session even on error
        const siretForLogCatch = req.body.businessInfo?.siret || 'N_A';
        endExtractionSession(siretForLogCatch);

        logger.error('Financial ADK pipeline failed', {
            siret: req.body.businessInfo?.siret || 'N/A',
            error: error.message,
            stack: error.stack,
            duration
        });

        res.status(500).json({
            success: false,
            error: 'Financial analysis failed',
            message: error.message,
            duration
        });
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

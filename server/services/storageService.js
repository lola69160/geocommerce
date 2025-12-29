import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Go up two levels from server/services to root, then into data
const DATA_DIR = path.join(__dirname, '../../data');
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');
const CART_FILE = path.join(DATA_DIR, 'cart.json');
const DOCUMENTS_FILE = path.join(DATA_DIR, 'documents.json');

// Ensure data directory exists
const ensureDataDir = async () => {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
};

// Generic read function
const readJsonFile = async (filePath) => {
    try {
        await ensureDataDir();
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {}; // Return empty object if file doesn't exist
        }
        throw error;
    }
};

// Generic write function
const writeJsonFile = async (filePath, data) => {
    await ensureDataDir();
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
};

export const getNotes = async () => {
    return await readJsonFile(NOTES_FILE);
};

export const saveNote = async (businessId, text) => {
    const notes = await getNotes();
    notes[businessId] = text;
    await writeJsonFile(NOTES_FILE, notes);
    return notes;
};

export const getCart = async () => {
    return await readJsonFile(CART_FILE);
};

export const addToCart = async (business) => {
    const cart = await getCart();
    // Use siren/siret as key
    const id = business.siren || business.siret;
    if (id) {
        cart[id] = business;
        await writeJsonFile(CART_FILE, cart);
    }
    return cart;
};

export const removeFromCart = async (businessId) => {
    const cart = await getCart();
    if (cart[businessId]) {
        delete cart[businessId];
        await writeJsonFile(CART_FILE, cart);
    }
    return cart;
};

export const getDocuments = async () => {
    return await readJsonFile(DOCUMENTS_FILE);
};

export const saveDocument = async (siret, documentMetadata) => {
    const documents = await getDocuments();

    if (!documents[siret]) {
        documents[siret] = { documents: [] };
    }

    documents[siret].documents.push(documentMetadata);
    await writeJsonFile(DOCUMENTS_FILE, documents);

    return documents[siret].documents;
};

export const deleteDocument = async (siret, documentId) => {
    const documents = await getDocuments();

    if (!documents[siret]) {
        throw new Error('Aucun document trouvé pour ce commerce');
    }

    const docIndex = documents[siret].documents.findIndex(d => d.id === documentId);

    if (docIndex === -1) {
        throw new Error('Document non trouvé');
    }

    const [deletedDoc] = documents[siret].documents.splice(docIndex, 1);

    await writeJsonFile(DOCUMENTS_FILE, documents);

    return {
        deletedDoc,
        remainingDocuments: documents[siret].documents
    };
};

export const getBusinessDocuments = async (siret) => {
    const documents = await getDocuments();
    // Extract SIREN (9 digits) from SIRET (14 digits) if needed
    // Documents are indexed by SIREN
    const siren = siret?.substring(0, 9);
    const allDocs = documents[siren]?.documents || [];

    // Filter out documents whose files don't exist on disk
    const validDocs = [];
    for (const doc of allDocs) {
        try {
            await fs.access(doc.path);
            validDocs.push(doc);
        } catch {
            // File doesn't exist, skip this document
            console.warn(`Document file not found, skipping: ${doc.path}`);
        }
    }

    return validDocs;
};

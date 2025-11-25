import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Go up two levels from server/services to root, then into data
const DATA_DIR = path.join(__dirname, '../../data');
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');
const CART_FILE = path.join(DATA_DIR, 'cart.json');

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

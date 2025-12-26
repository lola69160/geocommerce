import axios from 'axios';
import { validateBodaccRecordsBatch } from './geminiService';
import { NAF_CODES } from '../data/nafCodes';

const BODACC_API_URL = 'https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records';

/**
 * Helper to parse address string
 */
const parseAddress = (address) => {
    // Simple parser: assumes "NUMBER STREET NAME ZIP CITY"
    // Example: "25 CHEMIN DE PIERRE BLANCHE 69570 DARDILLY"
    const match = address.match(/^(\d+)\s+(.+?)\s+(\d{5})\s+(.+)$/);
    if (match) {
        return {
            number: match[1],
            street: match[2],
            zip: match[3],
            city: match[4]
        };
    }
    return null;
};

/**
 * Simplify street name for search
 * Removes common prefixes like "RUE", "CHEMIN", "BOULEVARD" to increase match probability
 */
const simplifyStreetName = (street) => {
    const prefixes = ['RUE', 'CHEMIN', 'BOULEVARD', 'AVENUE', 'PLACE', 'ALLEE', 'ROUTE', 'IMPASSE', 'QUAI'];
    const words = street.toUpperCase().split(' ');

    // Remove prefix if present
    if (words.length > 1 && (prefixes.includes(words[0]) || words[0] === 'DE' || words[0] === 'DU' || words[0] === 'DES')) {
        // Keep the rest
        // Also remove "DE", "DU", "DES" if they were after the prefix (e.g. CHEMIN DE ...)
        let startIndex = 0;
        while (startIndex < words.length && (prefixes.includes(words[startIndex]) || ['DE', 'DU', 'DES', "D'"].includes(words[startIndex]))) {
            startIndex++;
        }
        return words.slice(startIndex).join(' ');
    }

    return street;
};

/**
 * Extract amount using Regex (Enhanced with multiple patterns)
 */
const extractAmount = (text) => {
    if (!text) return null;

    // Try multiple patterns to catch more variations
    const patterns = [
        // Pattern 1: "prix de X euros" / "montant de X EUR"
        /(?:prix|montant|somme)[\s:]+(?:de\s+)?([\d\s\.,]+)\s*(?:euros|EUR|€)/i,

        // Pattern 2: "cédé pour X euros" / "vendu pour la somme de X"
        /(?:cédé|vendu|acquis|acheté)[\s\w]*?(?:pour|à)[\s\w]*?([\d\s\.,]+)\s*(?:euros|EUR|€)/i,

        // Pattern 3: "somme de X euros"
        /somme\s+(?:de\s+)?([\d\s\.,]+)\s*(?:euros|EUR|€)/i,

        // Pattern 4: Formats avec ":" comme "Prix: X EUR"
        /(?:prix|montant|somme)\s*:\s*([\d\s\.,]+)\s*(?:euros|EUR|€)/i,

        // Pattern 5: Montant entre parenthèses "(X EUR)"
        /\(([\d\s\.,]+)\s*(?:euros|EUR|€)\)/i,

        // Pattern 6: Fallback large - any number followed by currency
        /([\d\s\.,]{3,})\s*(?:euros|EUR|€)/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            // Clean and parse the number
            const cleanNum = match[1]
                .replace(/\s/g, '')        // Remove spaces
                .replace(/\./g, '')        // Remove thousand separators (dots)
                .replace(',', '.');        // Decimal comma to dot

            const num = parseFloat(cleanNum);

            // Validate: amount should be reasonable (between 100 and 10,000,000 euros)
            if (!isNaN(num) && num >= 100 && num <= 10000000) {
                return num;
            }
        }
    }

    return null; // No valid amount found
};

/**
 * Parse a BODACC record to extract relevant info
 */
const parseRecord = (record) => {
    try {
        const establishmentsJson = record.listeetablissements ? JSON.parse(record.listeetablissements) : null;
        const acteJson = record.acte ? JSON.parse(record.acte) : null;
        const personnesJson = record.listepersonnes ? JSON.parse(record.listepersonnes) : null;

        let amount = null;
        let contentToSearch = '';

        // 1. Add business name/denomination for context
        if (personnesJson && personnesJson.personne) {
            if (personnesJson.personne.denomination) {
                contentToSearch += `Commerce: ${personnesJson.personne.denomination}. `;
            } else if (personnesJson.personne.nomCommercial) {
                contentToSearch += `Commerce: ${personnesJson.personne.nomCommercial}. `;
            }
        }

        // 2. Add activity description (CRUCIAL for identifying business type)
        if (establishmentsJson && establishmentsJson.etablissement && establishmentsJson.etablissement.activite) {
            contentToSearch += `Activité: ${establishmentsJson.etablissement.activite}. `;
        }

        // 3. Add establishment origin (contains the price)
        if (establishmentsJson && establishmentsJson.etablissement && establishmentsJson.etablissement.origineFonds) {
            contentToSearch += establishmentsJson.etablissement.origineFonds + ' ';
        }

        // 4. Add act description
        if (acteJson && acteJson.descriptif) {
            contentToSearch += acteJson.descriptif;
        }

        amount = extractAmount(contentToSearch);

        // KEEP THIS CHECK - Amount is REQUIRED for BODACC data
        if (!amount) {
            console.warn(`⚠️ BODACC record ${record.id} filtered: no valid amount found`);
            return null;
        }

        return {
            id: record.id,
            date: record.dateparution,
            amount: amount, // Required field
            description: contentToSearch,
            parution: record.parution,
            type: record.typeavis_lib
        };
    } catch (e) {
        console.warn('Error parsing BODACC record:', e);
        return null;
    }
};

/**
 * Get activity label from NAF code
 */
const getActivityLabel = (nafCode) => {
    if (!nafCode) return null;
    const codes = nafCode.split(',').map(c => c.trim());
    for (const code of codes) {
        const nafEntry = NAF_CODES.find(naf => naf.code.includes(code));
        if (nafEntry) {
            return nafEntry.label;
        }
    }
    return null;
};

/**
 * Fetch raw purchase history from BODACC API without validation
 * @param {string} address - Full address string
 * @param {string} postalCode - Postal code
 * @param {string} city - City name
 * @returns {Promise<Array>} Array of parsed records
 */
export const fetchRawBodaccData = async (address, postalCode, city) => {
    try {
        const addressParts = parseAddress(address);

        // Use provided postal code if parseAddress failed or returned different one
        const zip = addressParts ? addressParts.zip : postalCode;

        // Simplify street name
        let simplifiedStreet = '';
        if (addressParts) {
            simplifiedStreet = simplifyStreetName(addressParts.street);
        } else {
            // Try to extract street from address string by removing zip and city
            const temp = address.replace(postalCode, '').replace(city, '').trim();
            simplifiedStreet = simplifyStreetName(temp);
        }

        // If we still don't have a good street search term, return empty
        if (!simplifiedStreet || simplifiedStreet.length < 3) {
            return [];
        }

        const whereClause = `search(listeetablissements, "${simplifiedStreet}") AND search(listeetablissements, "${zip}") AND familleavis_lib = "Ventes et cessions"`;

        const response = await axios.get(BODACC_API_URL, {
            params: {
                where: whereClause,
                order_by: 'dateparution desc',
                limit: 50
            }
        });

        if (!response.data || !response.data.results) {
            return [];
        }

        // Parse all records
        const totalRecords = response.data.results.length;
        const parsedRecords = response.data.results.map(record => parseRecord(record));
        const validRecords = parsedRecords.filter(record => record !== null);
        const filteredCount = totalRecords - validRecords.length;

        if (filteredCount > 0) {
            console.log(`ℹ️ BODACC: ${filteredCount}/${totalRecords} records filtered out (no valid amount found)`);
        }

        return validRecords;

    } catch (error) {
        console.error('Error fetching raw BODACC data:', error);
        return [];
    }
};

/**
 * Fetch purchase history from BODACC API and validate with Gemini
 * @param {string} address - Full address string
 * @param {string} postalCode - Postal code
 * @param {string} city - City name
 * @param {string} nafCode - NAF code to determine activity type for validation
 * @returns {Promise<Object>} Object with results and rawData
 */
export const getPurchaseHistory = async (address, postalCode, city, nafCode = null) => {
    try {
        // 1. Fetch raw data
        const parsedRecords = await fetchRawBodaccData(address, postalCode, city);

        // Get activity label from NAF code for validation
        const activityLabel = getActivityLabel(nafCode);
        console.log(`🏷️ NAF Code: "${nafCode}" → Activity Label: "${activityLabel}"`);

        // Validate records with Gemini to filter out irrelevant businesses (BATCH MODE)
        const recordsToValidate = parsedRecords.map(r => ({ id: r.id, description: r.description }));

        const validIds = await validateBodaccRecordsBatch(recordsToValidate, activityLabel);

        const validatedResults = parsedRecords.filter(record => {
            const isValid = validIds.includes(record.id);
            if (!isValid) {
                console.log(`❌ Filtered out record: ${record.amount}€ (${record.date})`);
            }
            return isValid;
        });

        return {
            results: validatedResults,
            rawData: parsedRecords // Keep raw data for debug mode
        };

    } catch (error) {
        console.error('Error fetching BODACC data:', error);
        return { results: [], rawData: [] };
    }
};

import { fetchRawBodaccData } from './bodaccService';
import { validateBodaccRecordsBatch } from './geminiService';
import { cacheService } from './cacheService';
import { NAF_CODES } from '../data/nafCodes';

/**
 * Get activity label from NAF code
 */
const getActivityLabel = (nafCode) => {
    if (!nafCode) return null;
    if (typeof nafCode === 'object' && nafCode.label) return nafCode.label;
    if (typeof nafCode === 'string') {
        // Try to find label in NAF_CODES
        const codes = nafCode.split(',').map(c => c.trim());
        for (const code of codes) {
            const nafEntry = NAF_CODES.find(naf => naf.code.includes(code));
            if (nafEntry) return nafEntry.label;
        }
        return nafCode; // Fallback to code itself if no label found
    }
    return null;
};

/**
 * Enrich a list of businesses with BODACC data in the background.
 * Uses batch processing for Gemini validation to minimize API calls.
 * 
 * @param {Array} businesses - List of business objects
 * @param {object|string} nafCode - NAF code object or string for activity context
 * @returns {Promise<Array>} - Enriched businesses
 */
export const enrichWithBodacc = async (businesses, nafCode) => {
    if (!businesses || businesses.length === 0) return businesses;

    const activityLabel = getActivityLabel(nafCode);
    console.log('🔄 Starting background BODACC enrichment for', businesses.length, 'businesses. Activity:', activityLabel);

    // 1. Identify unique addresses to query
    const addressMap = new Map(); // Address -> [Business1, Business2]

    businesses.forEach(business => {
        if (business.adresse) {
            const address = business.adresse;
            if (!addressMap.has(address)) {
                addressMap.set(address, []);
            }
            addressMap.get(address).push(business);
        }
    });

    const uniqueAddresses = Array.from(addressMap.keys());
    console.log(`📍 Found ${uniqueAddresses.length} unique addresses to check.`);

    // 2. Fetch BODACC records for each address (checking cache first)
    const recordsToValidate = []; // Array of { id, description, addressKey }
    const recordsByAddress = new Map(); // Address -> [Record1, Record2]

    // We process addresses in parallel chunks to avoid overwhelming the browser/network
    // but since we want to batch validate, we need to collect them all first.
    // Let's do parallel requests with a concurrency limit if needed, but for <50 items Promise.all is fine.

    await Promise.all(uniqueAddresses.map(async (address) => {
        // Check cache first
        const cachedData = cacheService.getBodaccData(address);
        if (cachedData) {
            // If cached, we assume these are already validated/processed records
            recordsByAddress.set(address, cachedData);
            return;
        }

        // If not cached, fetch raw data
        const business = addressMap.get(address)[0];
        const postalCode = business.code_postal;
        const city = business.libelle_commune;

        if (!postalCode || !city) return;

        const rawRecords = await fetchRawBodaccData(address, postalCode, city);

        if (rawRecords.length > 0) {
            // Store raw records temporarily associated with this address
            recordsByAddress.set(address, rawRecords);

            // Add to validation queue
            rawRecords.forEach(record => {
                recordsToValidate.push({
                    id: record.id,
                    description: record.description,
                    addressKey: address // custom field to map back if needed
                });
            });
        } else {
            // Cache empty result to avoid re-fetching
            cacheService.setBodaccData(address, []);
            recordsByAddress.set(address, []);
        }
    }));

    // 3. Batch Validate with Gemini
    if (recordsToValidate.length > 0) {
        console.log(`🤖 Batch validating ${recordsToValidate.length} records with Gemini...`);

        // We only send ID and Description to Gemini
        const batchPayload = recordsToValidate.map(r => ({ id: r.id, description: r.description }));

        // Call Gemini (Single Batch Call)
        const validIds = await validateBodaccRecordsBatch(batchPayload, activityLabel);

        // 4. Update Cache with Validated Results
        uniqueAddresses.forEach(address => {
            const rawRecords = recordsByAddress.get(address);
            if (rawRecords && rawRecords.length > 0) {
                // Filter records for this address based on validIds
                const validatedRecords = rawRecords.filter(record => validIds.includes(record.id));

                // Update cache with ONLY validated records
                cacheService.setBodaccData(address, validatedRecords);

                // Update local map for return value
                recordsByAddress.set(address, validatedRecords);
            }
        });
    }

    // 5. Enrich Business Objects
    const enrichedBusinesses = businesses.map(business => {
        if (business.adresse) {
            const bodaccData = recordsByAddress.get(business.adresse);
            if (bodaccData && bodaccData.length > 0) {
                return {
                    ...business,
                    bodaccData: bodaccData,
                    hasBodacc: true
                };
            }
        }
        return {
            ...business,
            hasBodacc: false
        };
    });

    console.log('✅ Enrichment complete.');
    return enrichedBusinesses;
};

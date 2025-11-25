/**
 * Global cache service to store enriched data and avoid redundant API calls.
 */

// Cache for Google Places data (Key: "Business Name + Address")
const placesCache = new Map();

// Cache for BODACC data (Key: "Address")
// We use address as key because BODACC search is address-based
const bodaccCache = new Map();

export const cacheService = {
    /**
     * Get Places data from cache
     * @param {string} key - Composite key (name + address)
     */
    getPlacesData: (key) => {
        return placesCache.get(key);
    },

    /**
     * Set Places data in cache
     * @param {string} key - Composite key
     * @param {object} data - Places data
     */
    setPlacesData: (key, data) => {
        placesCache.set(key, data);
    },

    /**
     * Get BODACC data from cache
     * @param {string} key - Address
     */
    getBodaccData: (key) => {
        return bodaccCache.get(key);
    },

    /**
     * Set BODACC data in cache
     * @param {string} key - Address
     * @param {object} data - BODACC data (array of records)
     */
    setBodaccData: (key, data) => {
        bodaccCache.set(key, data);
    },

    /**
     * Clear all caches
     */
    clearAll: () => {
        placesCache.clear();
        bodaccCache.clear();
    }
};

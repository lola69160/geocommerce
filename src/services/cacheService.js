/**
 * Global cache service to store enriched data and avoid redundant API calls.
 * Supports TTL (Time-To-Live) for automatic expiration.
 */

// Cache for Google Places data (Key: "Business Name + Address")
// Structure: Map<key, { data: any, timestamp: number, ttl: number }>
const placesCache = new Map();

// Cache for BODACC data (Key: "Address")
// We use address as key because BODACC search is address-based
// Structure: Map<key, { data: any, timestamp: number, ttl: number }>
const bodaccCache = new Map();

// Default TTL values (in milliseconds)
const DEFAULT_TTL = 30 * 60 * 1000; // 30 minutes
const SHORT_TTL = 5 * 60 * 1000;    // 5 minutes (for empty results)

// Export TTL constants for use in other services
export { DEFAULT_TTL, SHORT_TTL };

export const cacheService = {
    /**
     * Get Places data from cache
     * @param {string} key - Composite key (name + address)
     * @returns {any|null} Cached data or null if expired/missing
     */
    getPlacesData: (key) => {
        const cached = placesCache.get(key);
        if (!cached) return null;

        const now = Date.now();
        if (now - cached.timestamp > cached.ttl) {
            placesCache.delete(key); // Expired, remove from cache
            return null;
        }
        return cached.data;
    },

    /**
     * Set Places data in cache
     * @param {string} key - Composite key
     * @param {object} data - Places data
     * @param {number} ttl - Time-to-live in milliseconds (default: 30 min)
     */
    setPlacesData: (key, data, ttl = DEFAULT_TTL) => {
        placesCache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });
    },

    /**
     * Get BODACC data from cache
     * @param {string} key - Address (normalized)
     * @returns {any|null} Cached data or null if expired/missing
     */
    getBodaccData: (key) => {
        const cached = bodaccCache.get(key);
        if (!cached) return null;

        const now = Date.now();
        if (now - cached.timestamp > cached.ttl) {
            bodaccCache.delete(key); // Expired, remove from cache
            return null;
        }
        return cached.data;
    },

    /**
     * Set BODACC data in cache
     * @param {string} key - Address (normalized)
     * @param {array} data - BODACC data (array of records)
     * @param {number} ttl - Time-to-live in milliseconds (default: 30 min, use SHORT_TTL for empty results)
     */
    setBodaccData: (key, data, ttl = DEFAULT_TTL) => {
        bodaccCache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });
    },

    /**
     * Clear expired entries from all caches
     */
    clearExpired: () => {
        const now = Date.now();

        // Clear expired Places cache entries
        for (const [key, value] of placesCache.entries()) {
            if (now - value.timestamp > value.ttl) {
                placesCache.delete(key);
            }
        }

        // Clear expired BODACC cache entries
        for (const [key, value] of bodaccCache.entries()) {
            if (now - value.timestamp > value.ttl) {
                bodaccCache.delete(key);
            }
        }
    },

    /**
     * Invalidate a specific cache entry
     * @param {string} key - Cache key to invalidate
     * @param {string} cacheType - 'places' or 'bodacc' (default: 'bodacc')
     */
    invalidate: (key, cacheType = 'bodacc') => {
        if (cacheType === 'places') {
            placesCache.delete(key);
        } else {
            bodaccCache.delete(key);
        }
    },

    /**
     * Get cache statistics for debugging
     * @returns {object} Cache stats
     */
    getCacheSize: () => {
        return {
            places: placesCache.size,
            bodacc: bodaccCache.size,
            total: placesCache.size + bodaccCache.size
        };
    },

    /**
     * Get all cache keys for debugging
     * @returns {object} All cache keys
     */
    getAllKeys: () => {
        return {
            places: Array.from(placesCache.keys()),
            bodacc: Array.from(bodaccCache.keys())
        };
    },

    /**
     * Clear all caches
     */
    clearAll: () => {
        placesCache.clear();
        bodaccCache.clear();
    }
};

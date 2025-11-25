/**
 * Utility functions for displaying business information correctly
 */

/**
 * Extract enseigne (brand name) from business object
 * Priority: matching_etablissements[0].liste_enseignes[0] > siege.liste_enseignes[0]
 * @param {object} business - Business object from API
 * @returns {string|null} Enseigne name or null if not available
 */
export function getEnseigne(business) {
    // Try matching_etablissements first
    if (business.matching_etablissements &&
        business.matching_etablissements.length > 0 &&
        business.matching_etablissements[0].liste_enseignes &&
        business.matching_etablissements[0].liste_enseignes.length > 0) {
        return business.matching_etablissements[0].liste_enseignes[0];
    }

    // Fallback to siege
    if (business.siege &&
        business.siege.liste_enseignes &&
        business.siege.liste_enseignes.length > 0) {
        return business.siege.liste_enseignes[0];
    }

    return null;
}

/**
 * Get the display name for a business (enseigne if available, otherwise nom_complet)
 * @param {object} business - Business object from API
 * @returns {string} Display name
 */
export function getDisplayName(business) {
    const enseigne = getEnseigne(business);
    return enseigne || business.nom_complet || 'Commerce sans nom';
}

/**
 * Get establishment creation date
 * Priority: matching_etablissements[0].date_creation > siege.date_creation
 * @param {object} business - Business object from API
 * @returns {string|null} Date string in ISO format or null
 */
export function getEstablishmentCreationDate(business) {
    // Try matching_etablissements first
    if (business.matching_etablissements &&
        business.matching_etablissements.length > 0 &&
        business.matching_etablissements[0].date_creation) {
        return business.matching_etablissements[0].date_creation;
    }

    // Fallback to siege
    if (business.siege && business.siege.date_creation) {
        return business.siege.date_creation;
    }

    return null;
}

/**
 * Format ISO date string to French format (DD/MM/YYYY)
 * @param {string} dateString - Date in ISO format (YYYY-MM-DD)
 * @returns {string} Formatted date or empty string if invalid
 */
export function formatDate(dateString) {
    if (!dateString) return '';

    try {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    } catch (error) {
        return dateString; // Return original if formatting fails
    }
}

/**
 * Check if business has an enseigne different from nom_complet
 * @param {object} business - Business object from API
 * @returns {boolean} True if enseigne exists and is different from nom_complet
 */
export function hasEnseigne(business) {
    const enseigne = getEnseigne(business);
    return enseigne !== null && enseigne !== business.nom_complet;
}

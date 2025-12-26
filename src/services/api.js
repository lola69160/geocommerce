import axios from 'axios';
import { getBusinessLocation, parseOpeningHours } from './placesService';
import { findBusinessOnGooglePlaces } from './placesEnrichmentService';

const ENTREPRISE_API_URL = 'https://recherche-entreprises.api.gouv.fr';
const GEO_API_URL = 'https://api-adresse.data.gouv.fr/search/';

/**
 * Search for businesses using geographic search with NAF activity code.
 * @param {object} nafCode - NAF code object with code and label
 * @param {object} location - Location object from Autocomplete with coordinates
 * @param {number} radius - Search radius in km (max 50)
 * @param {number} limit - Number of results
 */
export const searchBusinesses = async (nafCode, location, radius = 5, limit = 10) => {
  try {
    if (!nafCode || !nafCode.code) {
      console.warn("NAF code is required for search");
      return [];
    }

    let lat, lon;

    // Get coordinates from location
    if (typeof location === 'object' && location !== null) {
      if (location.geometry && location.geometry.coordinates) {
        lon = location.geometry.coordinates[0];
        lat = location.geometry.coordinates[1];
      }
    } else if (typeof location === 'string' && location) {
      // Geocode the location string
      const geoRes = await axios.get(GEO_API_URL, {
        params: { q: location, limit: 1, type: 'municipality' }
      });
      if (geoRes.data.features && geoRes.data.features.length > 0) {
        const coords = geoRes.data.features[0].geometry.coordinates;
        lon = coords[0];
        lat = coords[1];
      }
    }

    if (!lat || !lon) {
      console.warn("Could not determine location coordinates");
      return [];
    }

    console.log(`Searching for ${nafCode.label} (${nafCode.code}) near [${lat}, ${lon}] within ${radius}km`);

    // Use near_point endpoint
    const codes = nafCode.code.split(',').map(c => c.trim());
    let allResults = [];

    // Perform parallel requests for each NAF code
    const requests = codes.map(code => {
      const params = {
        lat: lat,
        long: lon,
        radius: Math.min(radius, 50), // Cap at 50km per API limit
        activite_principale: code,
        per_page: limit,
        limite_matching_etablissements: 10,
        etat_administratif: 'A'
      };
      return axios.get(`${ENTREPRISE_API_URL}/near_point`, { params })
        .then(res => res.data.results || [])
        .catch(err => {
          console.error(`Error searching for code ${code}:`, err.message);
          return [];
        });
    });

    const resultsArrays = await Promise.all(requests);
    allResults = resultsArrays.flat();

    console.log(`API returned ${allResults.length} total results for codes: ${codes.join(', ')}`);

    // Extract address and coordinates from matching_etablissements
    const enrichedResults = allResults.map(res => {
      let targetEst = null;

      if (res.matching_etablissements && res.matching_etablissements.length > 0) {
        // Prioritize active establishments (no date_fermeture)
        targetEst = res.matching_etablissements.find(est => !est.date_fermeture);

        // If no active establishment found, fallback to the first one
        if (!targetEst) {
          targetEst = res.matching_etablissements[0];
        }
      }

      if (targetEst) {
        return {
          ...res,
          adresse: targetEst.adresse,
          code_postal: targetEst.code_postal,
          libelle_commune: targetEst.libelle_commune,
          lat: targetEst.latitude,
          lon: targetEst.longitude,
          siret: targetEst.siret,
          // Store establishment closure date for filtering
          date_fermeture_etablissement: targetEst.date_fermeture
        };
      }
      return res;
    });

    // Filter out closed businesses (those with date_fermeture)
    const activeResults = enrichedResults.filter(business => {
      // Check if business has date_fermeture at root level
      if (business.date_fermeture) {
        return false;
      }

      // Check if the selected establishment is closed
      if (business.date_fermeture_etablissement) {
        return false;
      }

      // Check siege date_fermeture
      if (business.siege && business.siege.date_fermeture) {
        return false;
      }

      return true;
    });

    console.log(`After filtering closed businesses: ${activeResults.length} active businesses`);

    // Deduplicate by SIREN, keeping most recent establishment
    const uniqueSirenResults = deduplicateByMostRecent(activeResults);

    // Deduplicate by Address AND Activity, keeping most recent (handles business takeovers without closure date)
    const finalResults = deduplicateByAddressAndActivity(uniqueSirenResults);

    console.log(`After address/activity deduplication: ${finalResults.length} unique businesses`);

    // Enrich with Google Places data (NOUVELLE STRATÉGIE MULTI-NIVEAUX)
    console.log('Enriching results with Google Places API (multi-level strategy)...');

    // Process in parallel but with care not to overwhelm if list is huge (though limit is small here)
    const fullyEnrichedResults = await Promise.all(
      finalResults.map(async (business) => {
        try {
          // NOUVELLE APPROCHE: Stratégie multi-niveaux
          const placesData = await findBusinessOnGooglePlaces(business);

          if (placesData && placesData.found) {
            // Log if opening hours are missing
            if (!placesData.openingHours || !Array.isArray(placesData.openingHours) || placesData.openingHours.length === 0) {
              console.warn(`⚠️ No opening hours available for: ${placesData.name}`);
            }

            // Add new fields
            const structuredHours = parseOpeningHours(placesData.openingHours);
            return {
              ...business,
              // Use Places coordinates if available, otherwise keep original
              lat: placesData.latitude || business.lat,
              lon: placesData.longitude || business.lon,
              openingHours: placesData.openingHours,
              closedDays: structuredHours.closedDays, // For filtering
              googlePlaceName: placesData.name,
              googlePlaceId: placesData.placeId,
              geoSource: 'PLACES'
            };
          }
        } catch (err) {
          console.warn(`Failed to enrich business ${business.siren}:`, err);
        }

        // Return original if enrichment failed or no match
        return { ...business, geoSource: 'INSEE' };
      })
    );

    return fullyEnrichedResults;
  } catch (error) {
    console.error("Error searching businesses:", error.response?.data || error.message);
    return [];
  }
};

/**
 * Deduplicate businesses by Address AND Activity code
 * Useful when a business changes owner but the old one isn't closed in the DB
 * @param {Array} businesses - Array of business objects
 * @returns {Array} Deduplicated array
 */
function deduplicateByAddressAndActivity(businesses) {
  const grouped = {};

  businesses.forEach(business => {
    // Create a unique key based on address and activity code
    // We use the address string and the NAF code (activite_principale)
    if (!business.adresse || !business.activite_principale) {
      // If missing data, we can't safely deduplicate, so we keep it but treat it as unique
      const uniqueId = business.siren || Math.random().toString();
      grouped[uniqueId] = business;
      return;
    }

    const key = `${business.adresse.trim().toLowerCase()}_${business.activite_principale}`;

    if (!grouped[key]) {
      grouped[key] = business;
    } else {
      // Collision found: same address and same activity.
      // Keep the one with the most recent establishment creation date.
      const currentDate = getEstablishmentDate(business);
      const existingDate = getEstablishmentDate(grouped[key]);

      if (currentDate > existingDate) {
        grouped[key] = business;
      }
      // If existing is newer or equal, we keep the existing one
    }
  });

  return Object.values(grouped);
}

/**
 * Deduplicate businesses by SIREN, keeping only the most recent establishment
 * @param {Array} businesses - Array of business objects
 * @returns {Array} Deduplicated array
 */
function deduplicateByMostRecent(businesses) {
  const grouped = {};

  businesses.forEach(business => {
    const siren = business.siren;
    if (!siren) return; // Skip if no SIREN

    if (!grouped[siren]) {
      grouped[siren] = business;
    } else {
      // Get establishment creation dates
      const currentDate = getEstablishmentDate(business);
      const existingDate = getEstablishmentDate(grouped[siren]);

      // Keep the one with the most recent establishment creation date
      if (currentDate > existingDate) {
        grouped[siren] = business;
      } else if (currentDate === existingDate) {
        // If same creation date, use the most recently updated one
        const currentUpdate = business.date_mise_a_jour || '';
        const existingUpdate = grouped[siren].date_mise_a_jour || '';
        if (currentUpdate > existingUpdate) {
          grouped[siren] = business;
        }
      }
    }
  });

  return Object.values(grouped);
}

/**
 * Extract establishment creation date for comparison
 * @param {Object} business - Business object
 * @returns {string} Date string for comparison
 */
function getEstablishmentDate(business) {
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

  // Last resort: use business creation date
  return business.date_creation || '';
}

/**
 * Get detailed information for a business by SIRET.
 */
export const getBusinessDetails = async (siret) => {
  return null;
};

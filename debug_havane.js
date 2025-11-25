import axios from 'axios';

const ENTREPRISE_API_URL = 'https://recherche-entreprises.api.gouv.fr';
const GEO_API_URL = 'https://api-adresse.data.gouv.fr/search/';

async function debug() {
    try {
        // 1. Get coordinates for Tassin-la-Demi-Lune
        console.log("Geocoding Tassin-la-Demi-Lune...");
        const geoRes = await axios.get(GEO_API_URL, {
            params: { q: 'Tassin-la-Demi-Lune', limit: 1, type: 'municipality' }
        });

        if (!geoRes.data.features || geoRes.data.features.length === 0) {
            console.error("Could not geocode Tassin");
            return;
        }

        const coords = geoRes.data.features[0].geometry.coordinates;
        const lon = coords[0];
        const lat = coords[1];
        console.log(`Coordinates: [${lat}, ${lon}]`);

        // 2. Call API like the app does
        const params = {
            lat: lat,
            long: lon,
            radius: 3, // 3km as in screenshot
            activite_principale: '47.26Z', // Tabac
            per_page: 25, // Max seems to be 25 usually
            limite_matching_etablissements: 10,
            etat_administratif: 'A'
        };

        console.log("Calling near_point API...", params);
        const response = await axios.get(`${ENTREPRISE_API_URL}/near_point`, { params });
        const results = response.data.results || [];

        console.log(`Total results: ${results.length}`);

        // 3. Look for SNC LE HAVANE (524833498)
        const targetSiren = '524833498';
        const found = results.find(r => r.siren === targetSiren);

        if (found) {
            console.log("✅ Found SNC LE HAVANE in raw API results!");
            console.log(JSON.stringify(found, null, 2));

            // Check our filters
            if (found.date_fermeture) console.log("⚠️ Has date_fermeture (Root):", found.date_fermeture);
            if (found.siege && found.siege.date_fermeture) console.log("⚠️ Has date_fermeture (Siege):", found.siege.date_fermeture);

            if (found.matching_etablissements) {
                console.log(`Matching Establishments (${found.matching_etablissements.length}):`);
                found.matching_etablissements.forEach((est, idx) => {
                    console.log(`  [${idx}] ${est.adresse} (Siret: ${est.siret})`);
                    if (est.date_fermeture) console.log(`      ⚠️ CLOSED: ${est.date_fermeture}`);
                    else console.log(`      ✅ ACTIVE`);
                });
            }
        } else {
            console.log("❌ SNC LE HAVANE NOT found in raw API results.");

            // List what WAS found to see if we are close
            console.log("First 5 results:");
            results.slice(0, 5).forEach(r => console.log(`- ${r.nom_complet} (${r.siren}) - ${r.matching_etablissements[0].adresse}`));
        }

    } catch (error) {
        console.error("Error:", error.message);
        if (error.response) console.error(error.response.data);
    }
}

debug();

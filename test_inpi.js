import 'dotenv/config';
import axios from 'axios';

// Configuration
const USERNAME = process.env.INPI_USERNAME;
const PASSWORD = process.env.INPI_PASSWORD;
// SIREN to test.
// 883640070 returns no data (empty object) on Production.
// 443061841 (Google France) returns bilans.
const SIREN = '443061841';

// Environment URLs
// const BASE_URL = 'https://registre-national-entreprises-pprod.inpi.fr/api'; // Test (Currently 503)
const BASE_URL = 'https://registre-national-entreprises.inpi.fr/api'; // Production

if (!USERNAME || !PASSWORD) {
    console.error('Please set INPI_USERNAME and INPI_PASSWORD environment variables.');
    process.exit(1);
}

async function main() {
    try {
        console.log(`Connecting to ${BASE_URL}...`);
        console.log('Logging in...');

        // 1. Connexion (Login)
        const loginResponse = await axios.post(`${BASE_URL}/sso/login`, {
            username: USERNAME,
            password: PASSWORD
        });

        const token = loginResponse.data.token;
        console.log('Login successful.');

        // 2. Récupération des documents (Attachments)
        // Doc: https://registre-national-entreprises.inpi.fr/api/companies/{siren}/attachments
        console.log(`\nFetching attachments for SIREN ${SIREN}...`);
        const attachmentsUrl = `${BASE_URL}/companies/${SIREN}/attachments`;

        try {
            const attachmentsResponse = await axios.get(attachmentsUrl, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const data = attachmentsResponse.data;
            let documents = [];

            // The API returns documents in 'bilans' (Annual Accounts) and 'actes' (Acts)
            if (data.bilans && Array.isArray(data.bilans)) {
                console.log(`Found ${data.bilans.length} items in 'bilans'.`);
                documents = documents.concat(data.bilans.map(b => ({ ...b, _source: 'bilans' })));
            }
            if (data.actes && Array.isArray(data.actes)) {
                console.log(`Found ${data.actes.length} items in 'actes'.`);
                documents = documents.concat(data.actes.map(a => ({ ...a, _source: 'actes' })));
            }

            if (documents.length === 0) {
                console.log('No documents found for this SIREN.');
            } else {
                // 3. Récupération des données structurées (Bilans Saisis)
                // Doc: https://registre-national-entreprises.inpi.fr/api/bilans-saisis/{id}

                for (const doc of documents) {
                    // Filter logic would go here if we had the PJ codes. 
                    // For now, we try to fetch structured data for all 'bilans'.
                    if (doc._source === 'bilans') {
                        console.log(`\nProcessing Bilan ID: ${doc.id} (Date: ${doc.dateCloture})`);
                        console.log(`Calling /bilans-saisis/${doc.id}...`);

                        try {
                            const bilanUrl = `${BASE_URL}/bilans-saisis/${doc.id}`;
                            const bilanResponse = await axios.get(bilanUrl, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            console.log('SUCCESS: Structured data retrieved.');
                            console.log('Data preview:', JSON.stringify(bilanResponse.data, null, 2).substring(0, 200) + '...');
                        } catch (err) {
                            console.log(`FAILURE: Could not retrieve structured data for ${doc.id}.`);
                            console.log(`Status: ${err.response?.status}`);
                            if (err.response?.status === 403) {
                                console.log('Reason: Access Denied (403). You likely need "ROLE_NIVEAU_2" or similar permissions.');
                            } else {
                                console.log(`Reason: ${err.response?.data?.message || err.message}`);
                            }
                        }
                    }
                }
            }

        } catch (e) {
            console.error('Attachments request failed:', e.response?.status, e.response?.data?.message || e.message);
        }

    } catch (error) {
        console.error('Global Error:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    }
}

main();

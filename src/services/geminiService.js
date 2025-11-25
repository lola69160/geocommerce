import axios from 'axios';

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

/**
 * Validate a batch of BODACC records
 * @param {Array<{id: string, description: string}>} records - List of records to validate
 * @param {string} activityLabel - The activity label being searched
 * @returns {Promise<Array<string>>} - List of valid record IDs
 */
export const validateBodaccRecordsBatch = async (records, activityLabel) => {
    if (!activityLabel || !records || records.length === 0) {
        return records.map(r => r.id);
    }

    try {
        console.log(`🔍 Validating batch of ${records.length} records for activity: "${activityLabel}"`);

        const response = await axios.post(`${BACKEND_API_URL}/api/validate-bodacc`, {
            records,
            activityLabel
        });

        const validIds = response.data.validIds || [];
        console.log(`✅ Backend response: ${validIds.length} valid records out of ${records.length}`);

        return validIds;

    } catch (error) {
        console.error('❌ Error calling backend batch validation API:', error.message);
        return records.map(r => r.id); // In case of error, accept all
    }
};

/**
 * Validate if a BODACC record is relevant for the searched business activity
 * Calls the secure backend API (batch endpoint with single item)
 * @param {string} description - The description text from BODACC
 * @param {string} activityLabel - The activity label being searched
 * @returns {Promise<boolean>} - True if relevant, false otherwise
 */
export const validateBodaccRecord = async (description, activityLabel = null) => {
    // If no activity label provided, accept the record
    if (!activityLabel) {
        return true;
    }

    try {
        // Use the batch endpoint for single record
        const tempId = 'temp_id';
        const validIds = await validateBodaccRecordsBatch([{ id: tempId, description }], activityLabel);
        return validIds.includes(tempId);

    } catch (error) {
        console.error('❌ Error calling backend validation API:', error.message);
        return true; // In case of error, accept the record
    }
};

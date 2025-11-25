import axios from 'axios';

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

/**
 * Parse opening hours text into structured data for filtering
 * @param {Array<string>} weekdayDescriptions - Array of strings like "Monday: Closed", "Tuesday: 9:00 AM – 5:00 PM"
 * @returns {Object} Structured data { closedDays: Array<string>, isOpenNow: boolean }
 */
export const parseOpeningHours = (weekdayDescriptions) => {
    if (!weekdayDescriptions || !Array.isArray(weekdayDescriptions)) {
        return { closedDays: [], isOpenNow: null };
    }

    const closedDays = [];
    const daysMap = {
        'Monday': 'Lundi',
        'Tuesday': 'Mardi',
        'Wednesday': 'Mercredi',
        'Thursday': 'Jeudi',
        'Friday': 'Vendredi',
        'Saturday': 'Samedi',
        'Sunday': 'Dimanche',
        'lundi': 'Lundi',
        'mardi': 'Mardi',
        'mercredi': 'Mercredi',
        'jeudi': 'Jeudi',
        'vendredi': 'Vendredi',
        'samedi': 'Samedi',
        'dimanche': 'Dimanche'
    };

    weekdayDescriptions.forEach(desc => {
        // desc example: "Monday: Closed" or "Lundi: Fermé"
        if (desc.toLowerCase().includes('closed') || desc.toLowerCase().includes('fermé')) {
            const dayPart = desc.split(':')[0].trim();
            // Normalize day name if possible
            for (const [eng, fr] of Object.entries(daysMap)) {
                if (dayPart.includes(eng) || dayPart.includes(fr)) {
                    if (!closedDays.includes(fr)) {
                        closedDays.push(fr);
                    }
                    break;
                }
            }
        }
    });

    return {
        closedDays,
        isOpenNow: null
    };
};

/**
 * Get business location and details from backend Places API
 * @param {string} businessName - Name of the business
 * @param {string} address - Address of the business
 * @returns {Promise<Object>} - Object containing latitude, longitude, hours, etc.
 */
export const getBusinessLocation = async (businessName, address) => {
    try {
        const response = await axios.post(`${BACKEND_API_URL}/api/get-business-location`, {
            businessName,
            address
        });

        return response.data;
    } catch (error) {
        console.error('Error fetching business location:', error);
        return { found: false };
    }
};

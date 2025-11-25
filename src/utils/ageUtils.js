/**
 * Calculate the age of a business in years from its creation date
 * @param {string} dateCreation - Date in format YYYY-MM-DD
 * @returns {number} Age in years
 */
export function calculateBusinessAge(dateCreation) {
    if (!dateCreation) return 0;

    const creationDate = new Date(dateCreation);
    const today = new Date();

    // Calculate difference in years
    let age = today.getFullYear() - creationDate.getFullYear();
    const monthDiff = today.getMonth() - creationDate.getMonth();

    // Adjust if birthday hasn't occurred yet this year
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < creationDate.getDate())) {
        age--;
    }

    return Math.max(0, age);
}

/**
 * Get color based on business age
 * Color gradient: Red (newest) → Orange → Yellow → Yellow-Green → Light Green → Green (oldest)
 * @param {number} age - Age in years
 * @returns {string} HSL color string
 */
export function getColorByAge(age) {
    // Define age ranges and corresponding colors
    // Using HSL for smooth gradient: Hue goes from 0 (red) to 120 (green)

    if (age < 5) {
        // 0-5 years: Red to Orange-Red (hue 0-15)
        const hue = (age / 5) * 15;
        return `hsl(${hue}, 85%, 50%)`;
    } else if (age < 10) {
        // 5-10 years: Orange-Red to Orange (hue 15-30)
        const hue = 15 + ((age - 5) / 5) * 15;
        return `hsl(${hue}, 85%, 50%)`;
    } else if (age < 15) {
        // 10-15 years: Orange to Yellow (hue 30-60)
        const hue = 30 + ((age - 10) / 5) * 30;
        return `hsl(${hue}, 85%, 50%)`;
    } else if (age < 20) {
        // 15-20 years: Yellow to Yellow-Green (hue 60-90)
        const hue = 60 + ((age - 15) / 5) * 30;
        return `hsl(${hue}, 75%, 45%)`;
    } else if (age < 25) {
        // 20-25 years: Yellow-Green to Light Green (hue 90-105)
        const hue = 90 + ((age - 20) / 5) * 15;
        return `hsl(${hue}, 70%, 40%)`;
    } else {
        // 25+ years: Green (hue 120)
        return 'hsl(120, 65%, 35%)';
    }
}

/**
 * Get representative color for an age range (for legend display)
 * @param {number} minAge - Minimum age of the range
 * @param {number} maxAge - Maximum age of the range (optional)
 * @returns {string} HSL color string
 */
export function getLegendColor(minAge, maxAge = null) {
    // Use middle of range for representative color
    const representativeAge = maxAge ? (minAge + maxAge) / 2 : minAge + 2.5;
    return getColorByAge(representativeAge);
}

/**
 * Age ranges for the legend
 */
export const AGE_RANGES = [
    { min: 0, max: 5, label: '0-5 ans' },
    { min: 5, max: 10, label: '5-10 ans' },
    { min: 10, max: 15, label: '10-15 ans' },
    { min: 15, max: 20, label: '15-20 ans' },
    { min: 20, max: 25, label: '20-25 ans' },
    { min: 25, max: null, label: '25+ ans' }
];

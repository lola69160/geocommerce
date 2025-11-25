export const formatDate = (dateString) => {
    if (!dateString) return 'Date inconnue';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(date);
};

export const getBusinessStatusColor = (dateCreation) => {
    if (!dateCreation) return '#64748b'; // Unknown - Slate

    const date = new Date(dateCreation);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffYears = diffDays / 365;

    if (diffYears < 2) {
        return '#10b981'; // New (< 2 years) - Emerald/Success
    } else if (diffYears < 5) {
        return '#f59e0b'; // Medium (2-5 years) - Amber/Warning
    } else {
        return '#ef4444'; // Old (> 5 years) - Red/Danger (or maybe blue for stable?)
        // User asked for specific color code. Let's stick to a heatmap style:
        // Green = Recent, Orange = Medium, Red = Old? Or reverse?
        // Usually for "purchase opportunities", maybe old businesses are better targets?
        // Let's assume: Green = Recent purchase/creation.
    }
};

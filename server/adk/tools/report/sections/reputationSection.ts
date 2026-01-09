/**
 * Reputation Section for Professional Report
 * Displays Google reviews statistics and top reviews
 */

import { smartTruncate } from '../utils/textUtils.js';

interface Review {
  author: string;
  rating: number;
  text: string;
  time: number;
}

interface PlacesData {
  rating?: number;
  userRatingsTotal?: number;
  reviews?: Review[];
}

/**
 * Generate rating statistics cards
 */
function generateRatingStats(places: PlacesData): string {
  const rating = places.rating || 0;
  const total = places.userRatingsTotal || 0;
  const reviews = places.reviews || [];

  if (reviews.length === 0) {
    return `<p class="no-data">Aucune statistique d'avis disponible</p>`;
  }

  // Calculate percentages - FIX: Use total instead of reviews.length (sample size)
  const fiveStarCount = reviews.filter(r => r.rating === 5).length;
  const oneStarCount = reviews.filter(r => r.rating === 1).length;
  const fiveStarPercent = total > 0 ? Math.round((fiveStarCount / total) * 100) : 0;
  const oneStarPercent = total > 0 ? Math.round((oneStarCount / total) * 100) : 0;

  return `
    <div class="reputation-stats">
      <div class="stat-card primary">
        <div class="stat-value">${rating.toFixed(1)}</div>
        <div class="stat-label">Note Moyenne</div>
        <div class="stat-stars">${'★'.repeat(Math.round(rating))}${'☆'.repeat(5 - Math.round(rating))}</div>
      </div>
      <div class="stat-card secondary">
        <div class="stat-value">${total}</div>
        <div class="stat-label">Total Avis</div>
      </div>
      <div class="stat-card success">
        <div class="stat-value">${fiveStarPercent}%</div>
        <div class="stat-label">5 Étoiles</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-value">${oneStarPercent}%</div>
        <div class="stat-label">1 Étoile</div>
      </div>
    </div>
  `;
}

/**
 * Generate rating distribution chart
 */
function generateRatingDistribution(reviews: Review[]): string {
  if (reviews.length === 0) {
    return '';
  }

  const distribution = {
    5: reviews.filter(r => r.rating === 5).length,
    4: reviews.filter(r => r.rating === 4).length,
    3: reviews.filter(r => r.rating === 3).length,
    2: reviews.filter(r => r.rating === 2).length,
    1: reviews.filter(r => r.rating === 1).length
  };

  const maxCount = Math.max(...Object.values(distribution));

  return `
    <h3>Distribution des Notes</h3>
    <div class="rating-distribution">
      ${[5, 4, 3, 2, 1].map(star => {
        const count = distribution[star as keyof typeof distribution];
        const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
        return `
          <div class="rating-row">
            <div class="rating-label">${star} ★</div>
            <div class="rating-bar-container">
              <div class="rating-bar" style="width: ${percentage}%;"></div>
            </div>
            <div class="rating-count">${count}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * Generate review card
 */
function generateReviewCard(review: Review): string {
  // FIX: Handle both seconds and milliseconds timestamps with validation
  let timestamp = review.time;
  // Detect if already in milliseconds (> year 3000 in seconds = 946684800000)
  if (timestamp > 946684800000) {
    timestamp = Math.floor(timestamp / 1000); // Convert to seconds
  }
  const parsedDate = new Date(timestamp * 1000);
  const year = parsedDate.getFullYear();
  const date = (year >= 1970 && year <= 2100)
    ? parsedDate.toLocaleDateString('fr-FR')
    : 'Date invalide';

  const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
  const truncatedText = smartTruncate(review.text || '', 200);

  return `
    <div class="review-card">
      <div class="review-header">
        <div class="review-author">${review.author}</div>
        <div class="review-stars ${review.rating >= 4 ? 'positive' : review.rating <= 2 ? 'negative' : 'neutral'}">${stars}</div>
      </div>
      <div class="review-text">${truncatedText}</div>
      <div class="review-date">${date}</div>
    </div>
  `;
}

/**
 * Generate top reviews section (best and worst)
 */
function generateTopReviews(reviews: Review[]): string {
  if (reviews.length === 0) {
    return '';
  }

  // Best reviews (5 stars, longest text)
  const bestReviews = reviews
    .filter(r => r.rating === 5)
    .sort((a, b) => (b.text?.length || 0) - (a.text?.length || 0))
    .slice(0, 3);

  // Worst reviews (1-2 stars, longest text)
  const worstReviews = reviews
    .filter(r => r.rating <= 2)
    .sort((a, b) => (b.text?.length || 0) - (a.text?.length || 0))
    .slice(0, 3);

  return `
    <div class="top-reviews-container">
      <div class="top-reviews-column">
        <h3 class="success-header">✅ Meilleurs Avis</h3>
        ${bestReviews.length > 0
          ? bestReviews.map(r => generateReviewCard(r)).join('')
          : '<p class="no-data">Aucun avis 5 étoiles disponible</p>'}
      </div>
      <div class="top-reviews-column">
        <h3 class="error-header">⚠️ Pires Avis</h3>
        ${worstReviews.length > 0
          ? worstReviews.map(r => generateReviewCard(r)).join('')
          : '<p class="no-data">Aucun avis négatif disponible</p>'}
      </div>
    </div>
  `;
}

/**
 * Generate reputation section (main export)
 */
export function generateReputationSection(places: PlacesData): string {
  if (!places || !places.reviews || places.reviews.length === 0) {
    return `
      <h2>⭐ Réputation Digitale</h2>
      <p class="no-data">Aucun avis Google disponible</p>
    `;
  }

  return `
    <h2>⭐ Réputation Digitale</h2>

    ${generateRatingStats(places)}

    ${generateRatingDistribution(places.reviews)}

    ${generateTopReviews(places.reviews)}
  `;
}

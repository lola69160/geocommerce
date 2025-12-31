/**
 * Cover Page Section
 *
 * Generates the cover page with business name, confidence score, and timestamp.
 */

/**
 * Generate the cover page HTML
 */
export function generateCoverPage(businessInfo: any, financialValidation: any): string {
  const businessName = businessInfo?.name || 'Commerce';
  const date = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
  const confidenceScore = financialValidation?.confidenceScore?.overall || 0;

  // Extract sub-scores
  const completeness = financialValidation?.dataQuality?.completeness || 0;
  const reliability = financialValidation?.dataQuality?.reliability || 0;
  const recency = financialValidation?.dataQuality?.recency || 0;

  return `
<div class="cover-page">
  <h1>${businessName}</h1>
  <div class="subtitle">Analyse Financière - Due Diligence</div>

  <div class="timestamp">Rapport généré le ${date}</div>
</div>
<div class="page-break"></div>
`;
}

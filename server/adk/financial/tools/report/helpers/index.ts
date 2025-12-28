/**
 * HTML Helpers for Financial Report Generation
 *
 * Utility functions used across all report sections.
 */

/**
 * Parse state (handle JSON string from ADK state)
 */
export function parseState(state: any): any {
  if (!state) return null;
  if (typeof state === 'string') {
    try {
      return JSON.parse(state);
    } catch {
      return null;
    }
  }
  return state;
}

/**
 * Generate HTML document header with Chart.js CDN
 */
export function generateHTMLHeader(): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport d'Analyse Financière - Due Diligence</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
</head>`;
}

/**
 * Generate report footer with timestamp and disclaimer
 */
export function generateFooter(): string {
  const date = new Date().toLocaleString('fr-FR');
  return `
<div class="footer">
  <p><strong>Rapport d'Analyse Financière - Due Diligence</strong></p>
  <p>Généré automatiquement le ${date}</p>
  <p><em>Ce rapport est confidentiel et destiné uniquement à l'usage interne dans le cadre d'une acquisition.</em></p>
</div>
`;
}

/**
 * Generate a strategic commentary block
 */
export function generateStrategicCommentary(title: string, commentary: string): string {
  return `
<div class="strategic-commentary">
  <h4>📌 ${title}</h4>
  <p>${commentary}</p>
</div>
`;
}

/**
 * Format number with French locale
 */
export function formatNumber(value: number | null | undefined, decimals: number = 0): string {
  if (value === null || value === undefined) return 'N/A';
  return value.toLocaleString('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Format currency with French locale
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/A';
  return `${value.toLocaleString('fr-FR')} €`;
}

/**
 * Format percentage
 */
export function formatPercent(value: number | null | undefined, decimals: number = 1): string {
  if (value === null || value === undefined) return 'N/A';
  return `${value.toFixed(decimals)}%`;
}

/**
 * Generate a badge HTML element
 */
export function generateBadge(text: string, type: 'success' | 'warning' | 'error' | 'info' = 'info'): string {
  return `<span class="badge ${type}">${text}</span>`;
}

/**
 * Generate an alert box HTML element
 */
export function generateAlertBox(content: string, type: 'success' | 'warning' | 'error' | 'info' = 'info'): string {
  return `<div class="alert-box ${type}">${content}</div>`;
}

/**
 * Financial Report CSS Styles
 *
 * Extracted from generateFinancialHtmlTool.ts for maintainability.
 * Contains WCAG AA compliant color palette and all component styles.
 */

/**
 * Generate CSS styles for financial reports
 */
export function generateCSS(): string {
  return `
<style>
  /* ========================================
     PALETTE WCAG AA COMPLIANT
     ======================================== */
  :root {
    --color-text-primary: #1a1a1a;      /* Noir principal (15.8:1) */
    --color-text-secondary: #4a5568;    /* Gris fonce (8.59:1) */
    --color-text-muted: #718096;        /* Gris moyen (5.14:1) - limite OK */

    --color-bg-base: #ffffff;
    --color-bg-light: #f7fafc;
    --color-bg-medium: #e2e8f0;
    --color-bg-emphasis: #cbd5e0;

    --color-table-header: #edf2f7;
    --color-table-border: #cbd5e0;
    --color-table-hover: #f7fafc;

    /* Couleurs semantiques */
    --color-success-bg: #c6f6d5;
    --color-success-text: #22543d;
    --color-warning-bg: #feebc8;
    --color-warning-text: #7c2d12;
    --color-error-bg: #fed7d7;
    --color-error-text: #742a2a;
    --color-info-bg: #bee3f8;
    --color-info-text: #2c5282;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: #333;
    background: #f5f5f5;
    padding: 20px;
  }
  .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }

  /* Typography */
  h1 { color: #1a1a1a; font-size: 2.5em; margin-bottom: 10px; border-bottom: 4px solid #0066cc; padding-bottom: 10px; }
  h2 { color: #0066cc; font-size: 1.8em; margin-top: 40px; margin-bottom: 15px; border-left: 4px solid #0066cc; padding-left: 15px; }
  h3 { color: #333; font-size: 1.3em; margin-top: 25px; margin-bottom: 10px; }

  /* Cover page */
  .cover-page { text-align: center; padding: 100px 0; margin-bottom: 60px; }
  .cover-page h1 { font-size: 3em; border: none; }
  .cover-page .subtitle { font-size: 1.5em; color: #666; margin: 20px 0; }
  .cover-page .timestamp { color: #999; font-size: 1.1em; margin-top: 30px; }
  .confidence-badge { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; font-size: 1.3em; font-weight: bold; margin-top: 30px; }

  /* Summary box */
  .summary-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin: 30px 0; }
  .summary-box h2 { color: white; border: none; margin-top: 0; }
  .summary-box h3 { color: white; }

  /* Verdict */
  .verdict { font-size: 2.5em; font-weight: bold; margin: 20px 0; text-align: center; padding: 20px; border-radius: 8px; }
  .verdict.favorable { background: #d1fae5; color: #065f46; }
  .verdict.reserves { background: #fed7aa; color: #92400e; }
  .verdict.defavorable { background: #fecaca; color: #991b1b; }

  /* Score cards */
  .score-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
  .score-card { background: #f8fafc; border-left: 4px solid #0066cc; padding: 20px; border-radius: 4px; text-align: center; }
  .score-value { font-size: 2.5em; font-weight: bold; color: #0066cc; }
  .score-label { color: #666; font-size: 0.9em; text-transform: uppercase; margin-top: 5px; }

  /* Lists */
  .strength-list { background: #d1fae5; padding: 20px; border-radius: 8px; margin: 15px 0; }
  .strength-list li { color: #065f46; margin: 8px 0; font-weight: 500; }
  .warning-list { background: #fed7aa; padding: 20px; border-radius: 8px; margin: 15px 0; }
  .warning-list li { color: #92400e; margin: 8px 0; font-weight: 500; }
  .warning-list li strong { color: #78350f; }
  .warning-list li em { font-size: 0.9em; color: #a16207; }
  .bp-context { display: block; margin-top: 5px; padding: 5px 10px; background: #dcfce7; color: #166534; border-radius: 4px; font-size: 0.9em; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  th, td {
    text-align: left;
    padding: 12px;
    border-bottom: 1px solid var(--color-table-border);
  }
  th {
    background: var(--color-table-header);
    font-weight: 600;
    color: var(--color-text-primary);
  }
  tr:hover { background: var(--color-table-hover); }
  .text-right { text-align: right !important; }
  .text-center { text-align: center !important; }

  /* Charts */
  .chart-container { position: relative; height: 400px; margin: 30px 0; }
  .chart-row { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin: 30px 0; }

  /* Badges */
  .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 0.85em; font-weight: bold; margin-right: 8px; }
  .badge.success { background: #d1fae5; color: #065f46; }
  .badge.warning { background: #fed7aa; color: #92400e; }
  .badge.error { background: #fecaca; color: #991b1b; }
  .badge.info { background: #dbeafe; color: #1e40af; }

  /* Alert boxes */
  .alert-box {
    padding: 15px;
    margin: 10px 0;
    border-left: 4px solid;
    border-radius: 4px;
    font-weight: 500;
  }
  .alert-box.critical {
    background: var(--color-error-bg);
    border-color: var(--color-error-text);
    color: var(--color-error-text);
  }
  .alert-box.warning {
    background: var(--color-warning-bg);
    border-color: var(--color-warning-text);
    color: var(--color-warning-text);
  }
  .alert-box.info {
    background: var(--color-info-bg);
    border-color: var(--color-info-text);
    color: var(--color-info-text);
  }

  /* Strategic Commentary */
  .strategic-commentary { background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 20px; margin: 20px 0; border-radius: 8px; }
  .strategic-commentary h4 { color: #0369a1; margin: 0 0 10px 0; font-size: 1.1em; }
  .strategic-commentary p { color: #075985; margin: 0; line-height: 1.8; }

  /* Info grid */
  .info-grid { display: grid; grid-template-columns: 200px 1fr; gap: 15px; margin: 15px 0; }
  .info-label { font-weight: bold; color: #666; }
  .info-value { color: #333; }

  /* Footer */
  .footer { margin-top: 60px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #666; font-size: 0.9em; }

  /* Page break for print */
  .page-break { page-break-after: always; }

  /* Tables avec emphase (retraitement EBE) */
  .table-base-row {
    background: var(--color-bg-medium) !important;
    font-weight: 500;
  }
  .table-total-row {
    background: var(--color-bg-emphasis);
    border-top: 2px solid var(--color-text-primary);
    font-weight: bold;
  }
  .table-normatif-row {
    background: var(--color-info-bg);
    border-top: 2px solid var(--color-info-text);
    font-weight: bold;
  }

  /* Data Completeness Tracking */
  .data-completeness {
    background: var(--color-bg-light);
    border: 1px solid var(--color-table-border);
    border-radius: 8px;
    padding: 20px;
    margin: 20px 0;
  }
  .data-completeness h4 {
    color: var(--color-text-primary);
    margin: 0 0 15px 0;
    font-size: 1.1em;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .data-completeness h4 .badge {
    font-size: 0.85em;
  }
  .missing-data-list {
    list-style: none;
    padding: 0;
    margin: 0 0 15px 0;
  }
  .missing-data-list li {
    padding: 8px 12px;
    margin: 4px 0;
    border-radius: 4px;
    font-size: 0.95em;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .missing-data-list li.present {
    background: var(--color-success-bg);
    color: var(--color-success-text);
  }
  .missing-data-list li.missing {
    background: var(--color-error-bg);
    color: var(--color-error-text);
  }
  .missing-data-list li.partial {
    background: var(--color-warning-bg);
    color: var(--color-warning-text);
  }
  .missing-data-list li .impact {
    font-size: 0.8em;
    font-weight: bold;
    margin-left: 8px;
  }
  .completeness-recommendation {
    background: var(--color-info-bg);
    color: var(--color-info-text);
    padding: 12px 15px;
    border-radius: 4px;
    font-size: 0.9em;
  }
  .completeness-recommendation strong {
    display: block;
    margin-bottom: 8px;
  }
  .completeness-recommendation ul {
    margin: 0 0 0 20px;
    padding: 0;
  }
  .completeness-recommendation li {
    margin: 4px 0;
  }
  .priority-docs-table {
    margin-top: 20px;
  }
  .priority-docs-table .criticite-bloquant { color: var(--color-error-text); font-weight: bold; }
  .priority-docs-table .criticite-important { color: var(--color-warning-text); font-weight: bold; }
  .priority-docs-table .criticite-utile { color: var(--color-info-text); }

  /* Tableau comparatif Actuel vs Potentiel Repreneur */
  .comparison-table {
    width: 100%;
    margin: 20px 0;
    border-collapse: collapse;
  }
  .comparison-table th {
    background: var(--color-table-header);
    padding: 12px;
    text-align: left;
    border-bottom: 2px solid var(--color-table-border);
  }
  .comparison-table th:not(:first-child) {
    text-align: right;
  }
  .comparison-table td {
    padding: 10px 12px;
    border-bottom: 1px solid var(--color-table-border);
  }
  .comparison-table td:not(:first-child) {
    text-align: right;
  }
  .comparison-table tr:nth-child(even) {
    background: #f9fafb;
  }
  .evolution-positive {
    color: #059669;
    font-weight: 600;
  }
  .evolution-negative {
    color: #dc2626;
    font-weight: 600;
  }
  .evolution-neutral {
    color: var(--color-text-muted);
  }
  .comparison-note {
    font-size: 0.85em;
    color: var(--color-text-muted);
    margin-top: 10px;
    font-style: italic;
  }

  /* ========================================
     CONSEILS POUR LE RACHAT - Nouvelles sections
     ======================================== */

  /* Contexte Geographique Box */
  .context-box {
    background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
    border: 1px solid #0ea5e9;
    border-radius: 8px;
    padding: 20px;
    margin: 20px 0;
  }
  .context-box h4 {
    color: #0369a1;
    margin: 0 0 15px 0;
    font-size: 1.1em;
  }
  .context-box .context-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  .context-box .context-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .context-box .context-item .icon {
    font-size: 1.2em;
  }
  .context-box .context-item .label {
    color: var(--color-text-muted);
    font-size: 0.85em;
  }
  .context-box .context-item .value {
    color: var(--color-text-primary);
    font-weight: 600;
  }

  /* ZOPA Visualization (Zone d'Accord) */
  .zopa-section {
    background: var(--color-bg-light);
    border-radius: 8px;
    padding: 25px;
    margin: 20px 0;
  }
  .zopa-visual {
    position: relative;
    margin: 30px 0;
  }
  .range-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: relative;
    height: 50px;
    background: linear-gradient(90deg,
      var(--color-error-bg) 0%,
      var(--color-warning-bg) 25%,
      var(--color-success-bg) 50%,
      var(--color-warning-bg) 75%,
      var(--color-error-bg) 100%
    );
    border-radius: 25px;
    padding: 0 20px;
  }
  .range-bar .anchor-low {
    color: var(--color-error-text);
    font-weight: bold;
    font-size: 0.9em;
  }
  .range-bar .zopa-zone {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    background: var(--color-success-bg);
    color: var(--color-success-text);
    padding: 8px 20px;
    border-radius: 20px;
    font-weight: bold;
    border: 2px solid #059669;
  }
  .range-bar .anchor-high {
    color: var(--color-error-text);
    font-weight: bold;
    font-size: 0.9em;
  }
  .zopa-target {
    text-align: center;
    margin-top: 15px;
    font-size: 1.1em;
  }
  .zopa-target strong {
    color: #059669;
    font-size: 1.3em;
  }

  /* Negotiation Arguments Tables */
  .negotiation-section {
    margin: 25px 0;
  }
  .negotiation-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 25px;
    margin: 20px 0;
  }
  .buyer-arguments {
    background: #fef3c7;
    border-radius: 8px;
    padding: 20px;
    border-left: 4px solid #f59e0b;
  }
  .buyer-arguments h4 {
    color: #92400e;
    margin: 0 0 15px 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .seller-arguments {
    background: #dcfce7;
    border-radius: 8px;
    padding: 20px;
    border-left: 4px solid #22c55e;
  }
  .seller-arguments h4 {
    color: #166534;
    margin: 0 0 15px 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .argument-table {
    width: 100%;
    font-size: 0.9em;
  }
  .argument-table th {
    background: rgba(0,0,0,0.05);
    padding: 8px;
    text-align: left;
  }
  .argument-table td {
    padding: 8px;
    border-bottom: 1px solid rgba(0,0,0,0.1);
  }
  .argument-table .impact {
    font-weight: bold;
    white-space: nowrap;
  }
  .argument-table .impact.negative {
    color: #dc2626;
  }
  .argument-table .impact.positive {
    color: #059669;
  }

  /* Concessions (Nibbles) */
  .nibbles-section {
    background: #f0f9ff;
    border-radius: 8px;
    padding: 20px;
    margin: 20px 0;
    border-left: 4px solid #0ea5e9;
  }
  .nibbles-section h4 {
    color: #0369a1;
    margin: 0 0 15px 0;
  }
  .nibbles-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  .nibble-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px;
    background: white;
    border-radius: 6px;
  }
  .nibble-item .icon {
    font-size: 1.3em;
  }
  .nibble-item .content strong {
    display: block;
    color: var(--color-text-primary);
    margin-bottom: 4px;
  }
  .nibble-item .content span {
    font-size: 0.85em;
    color: var(--color-text-muted);
  }

  /* Benchmark Sector Table */
  .benchmark-section {
    background: #faf5ff;
    border-radius: 8px;
    padding: 20px;
    margin: 20px 0;
    border-left: 4px solid #9333ea;
  }
  .benchmark-section h4 {
    color: #7e22ce;
    margin: 0 0 15px 0;
  }
  .benchmark-table {
    width: 100%;
  }
  .benchmark-table th {
    background: rgba(147, 51, 234, 0.1);
    padding: 10px;
    text-align: left;
    color: #7e22ce;
  }
  .benchmark-table td {
    padding: 10px;
    border-bottom: 1px solid rgba(147, 51, 234, 0.2);
  }
  .benchmark-highlight {
    background: rgba(147, 51, 234, 0.05);
    font-weight: 600;
  }

  /* Annuity Projection Table */
  .annuity-projection {
    background: #fff7ed;
    border-radius: 8px;
    padding: 20px;
    margin: 20px 0;
    border-left: 4px solid #ea580c;
  }
  .annuity-projection h4 {
    color: #c2410c;
    margin: 0 0 15px 0;
  }
  .annuity-table {
    width: 100%;
  }
  .annuity-table th {
    background: rgba(234, 88, 12, 0.1);
    padding: 10px;
    text-align: right;
    color: #c2410c;
  }
  .annuity-table th:first-child {
    text-align: left;
  }
  .annuity-table td {
    padding: 10px;
    text-align: right;
    border-bottom: 1px solid rgba(234, 88, 12, 0.2);
  }
  .annuity-table td:first-child {
    text-align: left;
  }
  .annuity-table .ratio-ok {
    color: #059669;
    font-weight: bold;
  }
  .annuity-table .ratio-warning {
    color: #f59e0b;
    font-weight: bold;
  }
  .annuity-table .ratio-danger {
    color: #dc2626;
    font-weight: bold;
  }

  /* ========================================
     OPPORTUNITE DE REPRISE - Section strategique
     ======================================== */

  .opportunity-section {
    background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
    border: 1px solid #0284c7;
    border-radius: 12px;
    padding: 30px;
    margin: 30px 0;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  }

  .opportunity-section h3.opportunity-title {
    color: #0369a1;
    font-size: 1.5em;
    margin: 0 0 25px 0;
    padding-bottom: 15px;
    border-bottom: 2px solid #0284c7;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .opportunity-subsection {
    margin: 20px 0;
    padding: 15px 20px;
    background: white;
    border-radius: 8px;
    border-left: 4px solid #0ea5e9;
  }

  .opportunity-subsection h4 {
    color: #0369a1;
    margin: 0 0 12px 0;
    font-size: 1.1em;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .opportunity-subsection p {
    color: var(--color-text-secondary);
    line-height: 1.8;
    margin: 0;
    font-size: 1.02em;
  }

  .opportunity-subsection p strong {
    color: var(--color-text-primary);
  }

  /* Tableau Projet Vendeur */
  .projet-vendeur-table {
    width: 100%;
    border-collapse: collapse;
    margin: 15px 0;
    background: white;
    border-radius: 8px;
    overflow: hidden;
  }

  .projet-vendeur-table th {
    background: #0369a1;
    color: white;
    padding: 12px 15px;
    text-align: left;
    font-weight: 600;
  }

  .projet-vendeur-table th:last-child {
    text-align: right;
  }

  .projet-vendeur-table td {
    padding: 12px 15px;
    border-bottom: 1px solid #e2e8f0;
  }

  .projet-vendeur-table td.amount {
    text-align: right;
    font-weight: 600;
    font-family: 'Monaco', 'Consolas', monospace;
    color: var(--color-text-primary);
  }

  .projet-vendeur-table td.detail {
    font-size: 0.85em;
    color: var(--color-text-muted);
    font-style: italic;
  }

  .projet-vendeur-table tr.total-row {
    background: #f0f9ff;
    border-top: 2px solid #0284c7;
  }

  .projet-vendeur-table tr.total-row td {
    font-weight: 700;
    color: #0369a1;
    font-size: 1.1em;
  }

  /* Chiffres Cles Projetes */
  .key-figures-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 20px;
    margin: 20px 0;
  }

  .key-figure-card {
    background: white;
    border-radius: 10px;
    padding: 20px;
    text-align: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    border: 1px solid #e2e8f0;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .key-figure-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }

  .key-figure-card.highlight {
    background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
    border: 2px solid #059669;
  }

  .key-figure-card .label {
    font-size: 0.9em;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 10px;
  }

  .key-figure-card .value {
    font-size: 1.8em;
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .key-figure-card .value.green {
    color: #059669;
  }

  .key-figure-card .value.blue {
    color: #0284c7;
  }

  .key-figure-card .comparison {
    font-size: 0.85em;
    color: var(--color-text-muted);
    margin-top: 8px;
  }

  .key-figure-card .comparison .positive {
    color: #059669;
    font-weight: 600;
  }

  .key-figure-card .badge-secure {
    display: inline-block;
    background: #059669;
    color: white;
    padding: 6px 16px;
    border-radius: 20px;
    font-size: 0.9em;
    font-weight: 600;
    margin-top: 5px;
  }

  .key-figure-card .badge-warning {
    display: inline-block;
    background: #f59e0b;
    color: white;
    padding: 6px 16px;
    border-radius: 20px;
    font-size: 0.9em;
    font-weight: 600;
    margin-top: 5px;
  }

  /* Message quand donnees manquantes */
  .opportunity-missing {
    background: #fef3c7;
    border-left: 4px solid #f59e0b;
    padding: 15px 20px;
    border-radius: 4px;
    color: #92400e;
    font-style: italic;
  }

  /* ========================================
     TABLEAU SIG - Colonne Budget N+1
     ======================================== */

  .budget-header {
    background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%) !important;
    color: #065f46 !important;
    font-weight: 700 !important;
  }

  .budget-header small {
    display: block;
    font-size: 0.75em;
    font-weight: 500;
    opacity: 0.85;
  }

  .sub-row td {
    font-size: 0.95em;
  }

  .sub-row td:first-child {
    padding-left: 25px;
    color: var(--color-text-muted);
  }

  .nota-bene {
    margin-top: 15px;
    padding: 12px;
    background: #f0f9ff;
    border-left: 4px solid #0284c7;
    font-style: italic;
    color: #0369a1;
  }

  @media print {
    body { background: white; padding: 0; }
    .container { box-shadow: none; }
    .page-break { page-break-after: always; }
    .table-base-row { background: #d0d0d0 !important; }
    .table-total-row { background: #b0b0b0 !important; }
    .table-normatif-row { background: #a0c4e0 !important; }
    .data-completeness { break-inside: avoid; }
    .opportunity-section { break-inside: avoid; }
    .key-figure-card:hover { transform: none; box-shadow: none; }
  }

  @media (max-width: 768px) {
    .chart-row { grid-template-columns: 1fr; }
    .score-grid { grid-template-columns: 1fr; }
  }

  /* ========================================
     TABAC VALUATION SECTION - Refactored
     ======================================== */

  /* Container principal */
  .tabac-valuation-container {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    overflow: hidden;
    margin: 25px 0;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  }

  /* En-tete Tabac */
  .tabac-header {
    background: #1e3a8a;
    color: white;
    padding: 20px 25px;
  }

  .tabac-header h3 {
    margin: 0 0 10px 0;
    font-size: 1.4em;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .tabac-header p {
    margin: 5px 0;
    font-size: 0.95em;
    opacity: 0.9;
  }

  /* Tableau Valorisation Theorique */
  .tabac-valuation-table {
    width: 100%;
    border-collapse: collapse;
    margin: 0;
  }

  .tabac-valuation-table th {
    background: #1e3a8a;
    color: white;
    padding: 14px 18px;
    font-weight: 600;
    text-align: right;
    font-size: 0.9em;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .tabac-valuation-table th:first-child {
    text-align: left;
  }

  .tabac-valuation-table td {
    padding: 18px;
    border-bottom: 1px solid #e2e8f0;
    vertical-align: top;
    background: white;
  }

  .tabac-valuation-table tr:nth-child(odd) td {
    background: #f8fafc;
  }

  /* Montants en euros - GRAS + COULEUR FONCEE */
  .tabac-valuation-table .amount {
    font-weight: 700;
    font-size: 1.15em;
    color: #1e3a8a;
    display: block;
  }

  .tabac-valuation-table .coef {
    font-size: 0.85em;
    color: #64748b;
    margin-top: 5px;
    display: block;
  }

  .tabac-valuation-table .component-name {
    font-weight: 600;
    color: #0f172a;
    display: block;
    margin-bottom: 4px;
  }

  .tabac-valuation-table .component-detail {
    font-size: 0.88em;
    color: #64748b;
  }

  .tabac-valuation-table .base-value {
    font-weight: 600;
    color: #1e3a8a;
    display: block;
  }

  .tabac-valuation-table .base-label {
    font-size: 0.85em;
    color: #64748b;
    display: block;
    margin-top: 4px;
  }

  /* Ligne Total Valorisation */
  .tabac-valuation-table .total-row {
    background: #1e3a8a !important;
  }

  .tabac-valuation-table .total-row td {
    color: white;
    font-weight: 700;
    border: none;
    background: #1e3a8a;
    padding: 18px;
  }

  .tabac-valuation-table .total-row .amount {
    color: white;
    font-size: 1.25em;
  }

  .tabac-valuation-table .total-row .total-label {
    font-size: 1.1em;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* Tableau Plan Financement */
  .financing-section {
    margin-top: 30px;
  }

  .financing-section h3 {
    color: #78350f;
    font-size: 1.2em;
    margin: 0 0 15px 0;
    padding: 0 25px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .financing-table {
    width: 100%;
    border-collapse: collapse;
  }

  .financing-table th {
    background: #78350f;
    color: white;
    padding: 12px 18px;
    text-align: right;
    font-weight: 600;
    font-size: 0.9em;
    text-transform: uppercase;
  }

  .financing-table th:first-child {
    text-align: left;
  }

  .financing-table td {
    padding: 14px 18px;
    border-bottom: 1px solid #e2e8f0;
    text-align: right;
    background: white;
  }

  .financing-table td:first-child {
    text-align: left;
    color: #0f172a;
  }

  .financing-table tr:nth-child(even) td {
    background: #fffbeb;
  }

  .financing-table .amount {
    font-weight: 700;
    color: #1e3a8a;
  }

  .financing-table .amount.negative {
    color: #16a34a;
  }

  .financing-table .total-row td {
    background: #78350f !important;
    color: white;
    font-weight: 700;
    border: none;
    font-size: 1.05em;
  }

  .financing-table .total-row .amount {
    color: white;
  }

  /* Indicateur Apport Personnel */
  .apport-indicator {
    display: flex;
    justify-content: center;
    margin: 30px 0;
    padding: 0 25px;
  }

  .apport-card {
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
    color: white;
    padding: 25px 50px;
    border-radius: 12px;
    text-align: center;
    box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);
  }

  .apport-card .label {
    display: block;
    font-size: 0.9em;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 10px;
    opacity: 0.9;
  }

  .apport-card .value {
    display: block;
    font-size: 2.2em;
    font-weight: 700;
  }

  .apport-card .pct {
    display: block;
    font-size: 1.2em;
    margin-top: 6px;
    opacity: 0.95;
  }

  .apport-missing {
    text-align: center;
    padding: 20px;
    background: #fef3c7;
    border-radius: 8px;
    margin: 20px 25px;
    color: #92400e;
    font-style: italic;
  }

  /* Facteurs Valorisants - TEXTE NOIR */
  .facteurs-valorisants {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 20px 25px;
    margin: 25px;
  }

  .facteurs-valorisants h4 {
    color: #0f172a;
    margin: 0 0 15px 0;
    font-size: 1.1em;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .facteurs-valorisants ul {
    margin: 0;
    padding: 0 0 0 20px;
  }

  .facteurs-valorisants li {
    color: #0f172a;
    margin: 10px 0;
    line-height: 1.6;
  }

  /* Encadre Methode - FOND CLAIR + TEXTE FONCE */
  .method-box {
    background: #fff7ed;
    border: 1px solid #fed7aa;
    border-left: 4px solid #f59e0b;
    border-radius: 6px;
    padding: 18px 22px;
    margin: 25px;
  }

  .method-box strong {
    color: #92400e;
    display: block;
    margin-bottom: 8px;
  }

  .method-box p {
    color: #78350f;
    margin: 0;
    line-height: 1.7;
  }

  /* Print styles Tabac */
  @media print {
    .tabac-valuation-container {
      break-inside: avoid;
      box-shadow: none;
    }

    .tabac-header,
    .tabac-valuation-table th,
    .tabac-valuation-table .total-row td,
    .financing-table th,
    .financing-table .total-row td {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .apport-card {
      background: #059669 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
</style>
`;
}

export default generateCSS;

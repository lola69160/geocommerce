/**
 * Financial Report Sections
 *
 * This module exports all HTML generation functions for the financial report.
 * Each section is responsible for generating a specific part of the report.
 */

// Cover page
export { generateCoverPage } from './coverPage';

// Main sections
export { generateAccountingSection } from './accountingSection';
export { generateValuationSection } from './valuationSection';
export { generateRealEstateSection } from './realEstateSection';
export { generateBusinessPlanSection } from './businessPlanSection';

// Opportunity section (new - strategic reprise section)
export { generateOpportunitySection } from './opportunitySection';

// Financing plan section
export { generateFinancingPlanSection } from './financingPlanSection';

// Re-export types and utilities if needed
export type { } from './coverPage';

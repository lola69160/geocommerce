# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SearchCommerce is a React + Vite application for searching and analyzing French businesses. It combines multiple data sources:
- **OpenData API** (recherche-entreprises.api.gouv.fr) for business registry data
- **BODACC API** for legal announcements about business sales
- **Google Places API** for location, reviews, photos, and opening hours
- **Gemini API** for AI-powered validation and context generation

The application allows users to search for businesses by activity type (NAF code) and location, enrich results with BODACC data (business sales/transfers), add businesses to a cart, take notes, and generate professional analysis reports using ADK agent pipelines.

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables (copy .env.example to .env)
# Add GEMINI_API_KEY and PLACE_API_KEY

# Run frontend + backend
npm run dev:all
```

## Documentation Structure

For detailed information, refer to these documentation files in the `docs/` directory:

### 📁 [ARCHITECTURE.md](docs/ARCHITECTURE.md)
Technical architecture, frontend/backend structure, API endpoints, logging, and data persistence.

### 🤖 [ADK_PIPELINE.md](docs/ADK_PIPELINE.md)
Complete documentation of the professional analysis pipeline (10 agents):
- PreparationAgent, DemographicAgent, PlacesAgent, PhotoAnalysisAgent, CompetitorAgent
- ValidationAgent, GapAnalysisAgent, ArbitratorAgent, StrategicAgent, ReportAgent
- State management, JSON parsing patterns, Gemini Vision integration
- HTML report generation with enriched sections

### 💰 [FINANCIAL_PIPELINE.md](docs/FINANCIAL_PIPELINE.md)
Financial analysis pipeline (6 agents):
- DocumentExtractionAgent, ComptableAgent, ValorisationAgent, ImmobilierAgent
- FinancialValidationAgent, FinancialReportAgent
- Accounting analysis (SIG, ratios, benchmarks)
- Business valuation (3 methods: EBE, CA, Patrimonial)
- Real estate analysis (lease, walls purchase, works estimation)
- Cross-validation and quality control
- **Recent improvements (2025-12-27)**: Enhanced Gemini Vision extraction, user comments support, improved scoring

### 🔌 [API_INTEGRATION.md](docs/API_INTEGRATION.md)
External API integrations and data enrichment:
- Google Places multi-dimensional scoring system (0-150 points)
- BODACC enrichment flow and address matching
- Caching strategy (client-side multi-level cache)

### 🛠️ [DEVELOPMENT.md](docs/DEVELOPMENT.md)
Development commands, environment configuration, testing, and debugging.

## Testing

The project includes a comprehensive test suite for the Financial Pipeline:

```bash
# Run all financial tests
npm run test:financial

# Watch mode for development
npm run test:financial:watch

# Interactive UI
npm run test:ui

# Coverage report
npm run test:coverage
```

**Test Coverage:**
- ✅ 30 tests across 8 test files
- Unit tests for agents and tools
- Integration tests for complete pipeline
- Regression tests for strategic pipeline

For complete testing documentation, see:
- **[tests/README.md](tests/README.md)** - Complete testing guide
- **[tests/QUICK_START.md](tests/QUICK_START.md)** - Quick start guide
- **[TESTS_SUMMARY.md](TESTS_SUMMARY.md)** - Test results summary

## Recent Updates (2025-12-28)

### COMPTA Extraction Rework

Complete rework of data extraction for preprocessed COMPTA documents:

**New Features:**
- ✅ New `extractionComptaSchema.ts` with TypeScript interfaces for 4 sections (Bilan Actif, Passif, CR, SIG)
- ✅ Specialized COMPTA extraction prompt (~200 lines) for 4-section documents
- ✅ SIG output format changed to `{ valeur: number, pct_ca: number }` (includes % CA)
- ✅ 3-level SIG extraction priority: COMPTA extraction > Vision key_values > Table parsing
- ✅ Director salary auto-detection from `charges_exploitant` in SIG
- ✅ Deterministic year extraction from filename (`COMPTA2023.pdf` → 2023)

**Bug Fixes:**
- ✅ Fixed 400 Bad Request on COMPTA documents (schema too complex for Gemini API)
- ✅ Fixed orphaned console.log statements in EBE retraitement tool

**Files Modified:**
- `schemas/extractionComptaSchema.ts` (NEW)
- `schemas/visionExtractionSchema.ts` (ComptaGeminiResponseSchema)
- `tools/document/geminiVisionExtractTool.ts` (COMPTA prompt + no responseSchema)
- `tools/accounting/calculateSigTool.ts` (Priority 0 + new format)
- `tools/accounting/calculateEbeRetraitementTool.ts` (charges_exploitant)
- `tests/financial/tools/calculateSig.test.ts` (new format)

### Tabac/Presse Report Generation Fix

Fixed critical issue where financial reports were not generated for Tabac/Presse commerce types (NAF 47.26Z).

**Root Causes Identified:**
1. `generateChartsTool` didn't support `methodeHybride` (Tabac valuation method)
2. Report generation relied on agent returning JSON text, but agent only returned tool calls
3. Tool chaining failed due to large HTML parameter size limits

**Fixes Applied:**
- ✅ Added `methodeHybride` support in `generateChartsTool.ts`
  - Chart now displays hybrid valuation (Bloc Réglementé + Bloc Commercial)
  - Log: `[Valorisation Chart] ✅ Using méthode HYBRIDE`
- ✅ Modified `generateFinancialHtmlTool.ts` for direct file saving
  - Saves HTML file directly instead of passing via parameters
  - Injects `financialReport` into state automatically
  - Log: `[generateFinancialHtml] ✅ financialReport injected into state`
- ✅ Simplified `FinancialReportAgent.ts` workflow (4 → 3 tools)
  - businessPlanDynamique → generateCharts → generateFinancialHtml
  - `saveFinancialReport` no longer needed (integrated into generateFinancialHtml)
- ✅ Added state injection in `businessPlanDynamiqueTool.ts`
  - Business plan now available for HTML report generation
- ✅ Hidden comparison table when `methodeHybride` is used

**Files Modified:**
- `tools/report/generateChartsTool.ts` (methodeHybride support)
- `tools/report/generateFinancialHtmlTool.ts` (direct save + state injection)
- `tools/report/saveFinancialReportTool.ts` (toolContext + logging)
- `tools/planning/businessPlanDynamiqueTool.ts` (state injection)
- `agents/FinancialReportAgent.ts` (simplified instruction)
- `server.js` (debug logging)

---

## Recent Updates (2025-12-27)

### Financial Pipeline Improvements - Phase 1 (Morning)

**Quality & Accuracy Enhancements:**
- ✅ Fixed valuation scoring: Dynamic calculation (0 → 100/100)
- ✅ Fixed valuation comparison table: Now displays all 3 methods with ranges
- ✅ Improved document detection: Multi-pattern recognition (type, filename, content)
- ✅ Added "liasse_fiscale" document type with content-based detection
- ✅ Increased maxOutputTokens: 8192 → 16384 for long documents (33+ pages)

**User Experience:**
- ✅ New section: "User Comments" in financial reports
  - Displays negotiated rent, renovation budget, sale conditions
  - Automatic breakdown of rent (commercial + personal housing)
- ✅ Real estate scoring now considers user negotiations (+10 bonus points)

**Gemini Vision Extraction:**
- ✅ Hierarchical prompt: CRITICAL → IMPORTANT → USEFUL sections
- ✅ Detailed extraction instructions for:
  - Balance sheet (10+ line items)
  - Income statement (13+ line items)
  - SIG (7 indicators)
  - Annexes (7 sections: assets detail, receivables/payables, provisions, staff, commitments)
- ✅ Expected extraction score improvement: 70/100 → 85-90/100

### Financial Pipeline Improvements - Phase 2 (Afternoon)

**Report Naming & Organization:**
- ✅ Timestamp at beginning of filename: `YYYYMMDD_HHMMSS_financial-report-{businessId}.html`
  - Aligns with professional reports naming convention
  - Enables chronological sorting and better file organization
  - Example: `20251227_143022_financial-report-au-fil-de-lo.html`

**User Comments Integration:**
- ✅ Full frontend-to-backend transmission of user comments
  - Frontend: `additionalInfo` field now sent to API as `userComments.autres`
  - Backend: Extracted from req.body and injected into pipeline initialState
  - All agents can access `state.userComments` for context-aware analysis
  - Automatic display in "💬 Éléments Complémentaires Fournis" section after Executive Summary

**Budget Travaux (Renovation) Display:**
- ✅ Renovation budget shown as additional investment cost
  - Displayed in Executive Summary as "💰 Investissement Total Estimé"
  - Breakdown: Valorisation du fonds + Budget travaux = Total investissement
  - Does not modify valuation itself (shown separately for transparency)
  - Example: 205k€ (valuation) + 25k€ (works) = 230k€ (total investment)

**Report Quality Improvements:**
- ✅ Always display Patrimoniale method in valuation table
  - Shows all 3 methods even if data missing
  - Displays "0 € (bilan non fourni)" when balance sheet unavailable
  - Better transparency for users
- ✅ Default message for empty "Points Forts" list
  - When no strengths identified: "Aucun point fort majeur identifié selon les critères standards (santé ≥70, marge ≥10%, croissance)"
  - Provides explicit feedback instead of confusing empty section

### Financial Pipeline Improvements - Phase 3 (Evening)

**Accessibility & Design Quality:**
- ✅ **WCAG AA Compliant Color Palette**: Complete CSS overhaul
  - Created 11 CSS variables for consistent, accessible colors
  - All text meets 4.5:1 contrast ratio minimum
  - Replaced 12 hard-coded color values throughout report
  - Added 3 new table row classes (base, total, normatif) with proper contrast
  - Print-friendly fallbacks for colored backgrounds
  - Impact: Report now accessible to users with visual impairments

**Enhanced Transparency & Debugging:**
- ✅ **Comprehensive UserComments Logging**: Full visibility in console
  - Structured display with visual formatting (boxes, emojis, calculations)
  - Shows: salaire dirigeant, salariés non repris, loyer details, budget travaux
  - Breakdown of rent components (commercial + personal housing)
  - Automatic calculation of rent savings
  - Added logging in EBE retraitement tool for traceability

- ✅ **Improved Gemini Vision Logging**: Extraction quality metrics
  - Logs extraction details (document type, confidence, year)
  - Shows count of accounting values and tables extracted
  - Warns about missing critical keys (CA, EBE, résultat net, capitaux propres, dettes)
  - Displays extraction completeness (e.g., "35/50 keys extracted")

**Chart & Table Display Improvements:**
- ✅ **Valorisation Chart Always Visible**: All 3 methods displayed
  - Shows EBE, CA, and Patrimonial methods even when values are 0€
  - Console warnings indicate which methods couldn't be calculated
  - Better user experience - no more empty "Pas de données" chart

- ✅ **Comparison Table Transparency**: Complete method visibility
  - Always displays all 3 valuation methods in table
  - Explanatory messages for missing data (e.g., "0 € (données insuffisantes - EBE non disponible)")
  - Consistent behavior across chart and table

**Strategic Analysis Expansion:**
- ✅ **Extended Strategic Scenarios**: 5 → 10 scenarios
  - **Scenario 6**: Clientèle & saisonnalité analysis (tourist vs residential zones)
  - **Scenario 7**: Risques réglementaires (tobacco regulations, compliance)
  - **Scenario 8**: Opportunités de croissance (growth levers, digitalization)
  - **Scenario 9**: Points de négociation (buyer/seller arguments, pricing strategy)
  - **Scenario 10**: Stratégie de financement (loan capacity, guarantees, duration)

- ✅ **New Section: "Conseils pour le Rachat"**: Comprehensive acquisition guide
  - **Subsection 1**: Risques Identifiés & Mitigation (4 risk categories with strategies)
  - **Subsection 2**: Opportunités de Création de Valeur (5 value creation levers)
  - **Subsection 3**: Checklist Due Diligence (7-point checklist with status badges)
  - **Subsection 4**: Arguments de Négociation (buyer vs seller arguments side-by-side)
  - Integrated after Business Plan section
  - Provides actionable guidance for buyers

**Files Modified in Phase 3:**
- `server/adk/financial/tools/report/generateFinancialHtmlTool.ts` - Main report generator (260+ lines added)
- `server/adk/financial/tools/report/generateChartsTool.ts` - Chart display logic
- `server/adk/financial/tools/document/geminiVisionExtractTool.ts` - Extraction prompt & logging
- `server.js` - UserComments console display

See [docs/FINANCIAL_PIPELINE.md](docs/FINANCIAL_PIPELINE.md) for technical details.

## Key Technologies

- **Frontend**: React, Vite, Tailwind CSS, Leaflet (maps)
- **Backend**: Express.js, Winston (logging)
- **AI/ML**: Google Gemini API, Google Agent Development Kit (ADK)
- **APIs**: Google Places API, OpenData API (France), BODACC API
- **Storage**: JSON files (cart, notes), localStorage (caching)

## Contributing

When making changes:
1. Follow the existing code style (ESLint configuration)
2. Update relevant documentation in `docs/` directory
3. **Run tests to ensure no regressions**: `npm run test:financial`
4. Test both frontend and backend changes manually
5. Check logs in `logs/` directory for errors

### Testing Guidelines

Before committing:
- Run `npm run test:financial` to ensure all tests pass
- Add tests for new features (especially tools and agents)
- Run `npm run test:regression` to verify strategic pipeline integrity
- Check test coverage: `npm run test:coverage`

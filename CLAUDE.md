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

### generateFinancialHtmlTool Refactoring

Major refactoring to reduce file size from 3391 lines to 1096 lines (68% reduction).

**Modules extracted:**
| Module | Location | Contents |
|--------|----------|----------|
| Styles | `./styles/index.ts` | CSS generation (generateCSS) |
| Helpers | `./helpers/index.ts` | Utilities (parseState, generateHTMLHeader, generateFooter, generateStrategicCommentary) |
| Cover Page | `./sections/coverPage.ts` | Report cover page |
| Accounting | `./sections/accountingSection.ts` | SIG, EBE retraitement, ratios, benchmarks |
| Valuation | `./sections/valuationSection.ts` | 3 valuation methods + hybrid Tabac |
| Real Estate | `./sections/realEstateSection.ts` | Bail, murs, travaux, rent simulation |
| Business Plan | `./sections/businessPlanSection.ts` | 5-year projections, banking indicators |

**Functions remaining in main file (to be extracted later):**
- `generateExecutiveSummary`
- `generateCompletenessBlock`
- `generateDataCompletenessSection`
- `generateValidationSection`
- `generateAnnexes`
- `generateUserCommentsSection`
- `analyzeAndGenerateCommentaries`

**Import pattern:**
```typescript
import { generateCSS } from './styles';
import { parseState, generateHTMLHeader, generateFooter } from './helpers';
import { generateCoverPage, generateAccountingSection, ... } from './sections';
import { generateAcquisitionAdviceSection } from './acquisitionAdvice';
```

---

### Tabac Business Plan: Differentiated Impact Hypotheses

New feature that applies differentiated growth impact hypotheses for Tabac commerce types (NAF 47.26Z).

**Problem:**
- Business plan applied uniform +10% impact for "travaux" (renovation) across all revenue
- For Tabac, this is unrealistic: people don't smoke more because the wall is repainted
- Impulse purchases (boutique) however increase significantly with better presentation

**Solution:**
- Automatic detection of Tabac commerce via NAF code (47.26Z)
- Extraction of CA split from SIG: `ventes_marchandises` (Boutique) vs rest (Commissions)
- Differentiated impact calculation:
  - **Commissions (Tabac/Loto/Presse)**: +0% (habitual commerce, no impact)
  - **Boutique (Souvenirs/Vape/Confiserie)**: +15% (impulse purchases increase)
- Weighted effective impact based on CA distribution

**Example Calculation:**
```
Tabac with 30% commissions / 70% boutique:
Impact travaux = (30% × 0%) + (70% × 15%) = +10.5% effective

vs. previous uniform: +10% on everything
```

**Console Logs:**
```
[businessPlanDynamique] 🚬 TABAC détecté (NAF: 47.26Z)
  - CA Total: 500 000 €
  - Ventes Boutique: 350 000 € (70.0%)
  - Commissions: 150 000 € (30.0%)
[businessPlanDynamique] 🔧 Impact travaux TABAC (différencié):
  - Commissions (30.0% du CA): +0%
  - Boutique (70.0% du CA): +15%
  - Impact effectif pondéré: +10.5%
```

**Report Display:**
- Hypotheses section shows: `🚬 Commissions (30%): +0% | 🛒 Boutique (70%): +15%`
- Effective weighted impact displayed
- Changes table shows "(Tabac: +15% boutique)" label

**Files Modified:**
- `server/adk/financial/tools/planning/businessPlanDynamiqueTool.ts`:
  - Import `isTabacCommerce` from config
  - Read `businessInfo` from state for NAF detection
  - Extract `ventes_marchandises` from SIG for CA split
  - Calculate weighted `impactTravauxEffectif`
  - Add `tabacInfo` to result object
- `server/adk/financial/tools/report/generateFinancialHtmlTool.ts`:
  - Extract `tabacInfo` from businessPlan
  - Display differentiated hypotheses in report
  - Show Tabac detail in changes table

---

### Enhanced "Conseils pour le Rachat" Section

Major refactoring of the acquisition advice section in financial reports with 3 key improvements:

#### 1. Business Plan-Based Financing Projections

**Problem:**
- Loan annuity was calculated with a simplistic 15% rule: `annuiteEstimee = valeurRecommandee * 0.15`
- Risk assessment used current EBE instead of future projections

**Solution:**
- Uses `businessPlan.projections[1-3]` for Years 1-3 projections
- New table showing: EBE Normatif, Annuité Emprunt, Ratio Endettement, Reste Après Dette
- Color-coded alerts based on ratio: green (<50%), orange (50-70%), red (>70%)
- Fallback to simplified calculation if business plan unavailable

#### 2. Geographic Context from Professional Report

**Problem:**
- No geographic/location context in opportunities section
- Generic advice not adapted to local market conditions

**Solution:**
- New `parseProfessionalReport(siren)` function reads professional report HTML
- Extracts: commune, population, density, CSP, economic dynamism, seasonality, scores
- Context box displays: population, density, clientele profile, economic dynamism
- Opportunities table adapts recommendations based on:
  - Tourist zone → Hours extension potential
  - Low market score + high location score → Turnaround opportunity
  - High economic dynamism → Natural growth expectations

#### 3. Advanced Negotiation Arguments

**New Features:**
- **Sector Benchmarks (SECTOR_BENCHMARKS)**: EBE/CA multiples by NAF code (Tabac, Restaurant, Boulangerie, Bar, etc.)
- **ZOPA Visualization**: Zone d'Accord Probable with buyer/seller anchors
- **Detailed Arguments Table**: With quantified impacts (-10 to -15%, -5k€, etc.)
- **Counter-arguments**: For each seller argument
- **Nibbles Section**: 6 concessions to negotiate (training, stock, non-compete, GAP, payment schedule, earn-out)

**New CSS Classes:**
- `.context-box`, `.context-grid` - Geographic context display
- `.zopa-section`, `.range-bar` - Negotiation zone visualization
- `.negotiation-grid`, `.buyer-arguments`, `.seller-arguments` - Arguments tables
- `.benchmark-section`, `.benchmark-table` - Sector benchmarks
- `.annuity-projection`, `.annuity-table` - Financing projections
- `.nibbles-section`, `.nibbles-grid`, `.nibble-item` - Concessions

**Files Modified:**
- `server/adk/financial/tools/report/generateFinancialHtmlTool.ts`:
  - Added `SECTOR_BENCHMARKS` constant (7 sectors + default)
  - Added `ProfessionalReportData` interface
  - Added `parseProfessionalReport()` function (~140 lines)
  - Added `getBenchmarkByNaf()` function
  - Rewrote `generateAcquisitionAdviceSection()` (220 → 580 lines)
  - Added 270 lines of CSS

---

### Table Readability Improvements (Mode Hybride)

Improved readability of financial report tables by applying neutral backgrounds and keeping colors only on badges and amounts.

**Problem:**
- EBE Retraitement table: Colored backgrounds (`table-base-row`, `table-total-row`, `table-normatif-row`) made text hard to read
- Valorisation Hybride table: Ultra-light backgrounds (`#f0f8ff`, `#fff8e1`) had insufficient contrast

**Solution: Mode Hybride**
- Neutral table backgrounds (white/light gray)
- Visual separators (thick black borders) to distinguish sections
- Colors kept **only** on amounts (+/-) and badges
- Replaced hardcoded colors with CSS variables

**Changes Applied:**

| Element | Before | After |
|---------|--------|-------|
| EBE base row | Gray background (`table-base-row`) | White background |
| EBE total row | Dark gray (`table-total-row`) | Black border separator |
| EBE normatif row | Blue (`table-normatif-row`) | Light gray + border |
| Valorisation Bloc 1 | `#f0f8ff` (ultra-light blue) | White |
| Valorisation Bloc 2 | `#fff8e1` (ultra-light yellow) | White |
| Valorisation Total | `#e6f7ff` + `#0066cc` | CSS variables |
| All info boxes | Hardcoded hex colors | `var(--color-bg-light)`, `var(--color-info-text)` |

**File Modified:**
- `server/adk/financial/tools/report/generateFinancialHtmlTool.ts` - 12 inline style modifications (lines 777-1052)

---

### UserComments Opening Hours Detection

Fixed issue where strategic comments displayed "Extension horaires d'ouverture (actuellement non renseigné)" even when the user had explicitly mentioned their opening hours extension plans in the comments field.

**Problem:**
- User entered: "Nous prévoyons d'allonger sensiblement les horaires d'ouverture..."
- Report displayed: "Extension horaires d'ouverture (actuellement non renseigné)"

**Solution:**
- New `detectHorairesExtension(userComments)` function parses `userComments.autres` for opening hours keywords
- Detects patterns: "allonger horaires", "extension horaires", "fermé le lundi/dimanche", "en saison", etc.
- Extracts relevant sentences and displays them in the strategic commentary

**Result:**
```
Before: 1. Extension horaires d'ouverture (actuellement non renseigné)
After:  1. Extension horaires d'ouverture (prévu par l'acheteur : Nous prévoyons d'allonger sensiblement les horaires d'ouverture sur la journée et d'avoir uniquement le dimanche après midi et le lundi de fermé)
```

**File Modified:**
- `server/adk/financial/tools/report/generateFinancialHtmlTool.ts` - Added `detectHorairesExtension()` function + modified section 8 "OPPORTUNITÉS DE CROISSANCE"

---

### Data Completeness Tracking System

New feature explaining why scores are not at 100% by showing exactly what data is present, missing, or partial.

**Problem Solved:**
- Score "Extraction Données: 64/100" → User didn't know what was missing
- Score "Analyse Immobilière: 0/100" → No explanation of expected data

**New Features:**
- ✅ Field-level tracking for each section (present/missing/partial status)
- ✅ Impact points shown for each missing field (e.g., "-10 pts")
- ✅ Recommendations: Documents to request from seller
- ✅ Priority documents table with criticality levels (bloquant/important/utile)
- ✅ Visual display in HTML report with color-coded badges

**Tracked Fields:**

| Section | Fields Tracked | Max Score |
|---------|---------------|-----------|
| Extraction Données | 11 fields (bilans N/N-1/N-2, CR, liasse fiscale, immobilisations, stocks, etc.) | 100 |
| Analyse Immobilière | 15 fields (bail, diagnostics, conformité ERP/PMR, travaux, etc.) | 100 |

**Report Display:**
```
📋 Extraction Données                    Score: 64/100
├─ ✅ Bilan comptable N (COMPTA2023.pdf)
├─ ✅ Compte de résultat N
├─ ⚠️ Masse salariale - Total uniquement
├─ ❌ Détail des immobilisations           -2 pts
└─ ❌ Relevés bancaires/trésorerie         -2 pts
👉 Documents à demander : tableau immobilisations, relevés bancaires
```

**Files Created/Modified:**
- `schemas/dataCompletenessSchema.ts` (NEW) - TypeScript interfaces + field definitions
- `tools/validation/assessDataQualityTool.ts` - Added 3 functions for completeness tracking
- `tools/report/generateFinancialHtmlTool.ts` - CSS + HTML generation for completeness blocks

### Executive Summary: Actuel vs Potentiel Repreneur

New comparison table in the Executive Summary showing current situation vs buyer's potential.

**Problem Solved:**
- Executive summary only showed current accounting values (EBE comptable, current margin)
- No visibility into post-acquisition potential (EBE normatif, Year 1 projections)
- Buyer couldn't see the value creation opportunity at a glance

**New Features:**
- ✅ Side-by-side comparison table (4 columns: Indicator, Current, Potential, Evolution)
- ✅ 4 key indicators compared:
  - EBE Comptable → EBE Normatif (with % evolution)
  - Marge EBE Actuelle → Marge EBE Normatif (with pts evolution)
  - CA Actuel → CA Année 1 (with % evolution)
  - EBE Actuel → EBE Année 1 (with % evolution)
- ✅ Color-coded evolution (green positive, red negative)
- ✅ Explanatory note about EBE Normatif definition
- ✅ Only displays when businessPlan and ebeNormatif are available

**Report Display:**
```
📊 Comparatif Situation Actuelle vs Potentiel Repreneur

| Indicateur     | Situation Actuelle | Potentiel Repreneur | Évolution |
|----------------|-------------------|---------------------|-----------|
| EBE            | 85 000 € (comptable) | 130 000 € (normatif) | +52.9% |
| Marge EBE      | 17.0%             | 26.0%               | +9.0 pts |
| CA Année 1     | 500 000 €         | 550 000 €           | +10.0% |
| EBE Année 1    | 85 000 €          | 143 000 €           | +68.2% |

💡 EBE Normatif = EBE comptable retraité (salaire dirigeant, économies loyer, charges non récurrentes)
```

**File Modified:**
- `tools/report/generateFinancialHtmlTool.ts` - Added comparison table CSS + logic + HTML generation

### Financing Plan Based on Business Plan Projections

Fixed issue where the "Plan de financement & capacité d'endettement" section used the **current** normalized EBE instead of Business Plan projections.

**Problem:**
- Financing plan calculated loan capacity using current EBE (e.g., 27,341€/year)
- This led to unrealistic loan durations (12+ years) because it ignored future optimizations
- Banks evaluate loan capacity based on projected profitability, not historical data

**Solution:**
- Now uses the **average of Years 1-3 EBE** from the Business Plan projections
- Fallback to current EBE if Business Plan is not available
- Clear labeling: "(moyenne années 1-3 Business Plan)" or "(EBE actuel - Business Plan non disponible)"

**Example:**
```
Before: EBE normatif 27 341€/an → annuité max 19 139€ → Durée: 12.2 ans ⚠️
After:  EBE projeté 53 333€/an (moyenne années 1-3 Business Plan) → annuité max 37 333€ → Durée: 6.3 ans ✅
```

**Technical Details:**
- Business Plan projections[0] = Current year (Actuel)
- Business Plan projections[1] = Year 1 (Reprise)
- Business Plan projections[2] = Year 2 (Post-travaux)
- Business Plan projections[3] = Year 3 (Croisière)
- Average = (ebe_Y1 + ebe_Y2 + ebe_Y3) / 3

**File Modified:**
- `server/adk/financial/tools/report/generateFinancialHtmlTool.ts`
  - Added `businessPlan` parameter to `analyzeAndGenerateCommentaries()` function
  - Modified scenario 10 "STRATÉGIE DE FINANCEMENT" to use projected EBE
  - Added console logging for traceability

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

### Analyse Immobilière - Transparence des Sources

Major refactoring to eliminate invented data and improve source transparency in the real estate analysis section.

**Problem:**
- Rent values were sometimes invented using heuristics (180€/m²/year market estimate)
- Rent simulation generated fictional scenarios (pessimiste/réaliste/optimiste)
- PMR/ERP works were estimated at 8-24k€ based solely on surface area

**Solution:**

#### 1. Rent Source Tracking (`analyzeBailTool.ts`)
- ✅ New `loyer_source` field: `comptabilite` | `bail_document` | `utilisateur` | `non_disponible`
- ✅ Priority reading: Accounting (SIG charges) → Lease document → null
- ✅ Removed market rent estimation (no more invented 180€/m²/year)

#### 2. Rent Simulation Simplification (`calculateLoyerSimulationTool.ts`)
- ✅ New rent ONLY from `userComments.loyer.futur_loyer_commercial`
- ✅ Removed invented scenarios (pessimiste/réaliste/optimiste)
- ✅ New output format:
  ```typescript
  { loyerActuel: { annuel, mensuel, source, anneeSource },
    nouveauLoyer: { annuel, mensuel, source, renseigne: boolean },
    simulation: { economieAnnuelle, economieMensuelle, impactEBE } | null }
  ```

#### 3. Works Estimation (`estimateTravauxTool.ts`)
- ✅ Removed heuristic PMR/ERP estimation based on surface ≥ 50m²
- ✅ Works only added from concrete data (photos, user input, seller info)

#### 4. Conditional Display (`generateFinancialHtmlTool.ts`)
- ✅ Bail section shows source: "(source: comptabilité 2023)" or badge "Non disponible"
- ✅ Simulation section: 3-column table (Element, Amount, Source)
- ✅ Warning message if simulation not available

**Report Display:**
```
| Élément        | Montant              | Source              |
|----------------|----------------------|---------------------|
| Loyer Actuel   | 24 000 €/an          | Comptabilité 2023   |
| Nouveau Loyer  | Non renseigné        | Renseignez le futur loyer... |

⚠️ Simulation non disponible
Loyer renégocié non renseigné par l'utilisateur.
```

**Files Modified:**
- `tools/property/analyzeBailTool.ts` (loyer_source + priority reading)
- `tools/property/calculateLoyerSimulationTool.ts` (complete rewrite)
- `tools/property/estimateTravauxTool.ts` (removed heuristic PMR/ERP)
- `tools/report/generateFinancialHtmlTool.ts` (conditional display)

---

### Opportunités Tabac - Spécificités Sectorielles

Context-aware opportunity analysis for Tabac/Presse businesses (NAF 47.26Z).

**Problem:**
- Digitalisation opportunity showed "+5-10% CA" for all commerce types
- Local dynamism showed "+3-5%/an natural growth" regardless of sector
- These projections are unrealistic for Tabac businesses due to legal and market constraints

**Solution:**

#### 1. Tabac Detection
```typescript
const isTabac = nafCode.includes('47.26') ||
  businessInfo?.activite_principale?.toLowerCase().includes('tabac');
```

#### 2. Digitalisation (Tabac-specific)
| Aspect | Standard | Tabac |
|--------|----------|-------|
| Badge | 🔵 Moyen | 🟠 Limité |
| Impact | +5-10% CA | +2-5% CA |
| Investment | 2-3k€ | 1-2k€ |

**Warning Box:**
> ⚡ **Focus Tabac:** Tobacco and gambling delivery is **strictly forbidden** in France.
> Click & collect on press/candy has too low average basket (3€).
> **Only profitable lever:** Showcase site for Vape/e-cigarettes and high-end smoking articles (cigars, pipes).
> Prefer SMS loyalty (magazine arrivals, vape promos).

#### 3. Local Dynamism (Tabac-specific)
| Aspect | Standard | Tabac |
|--------|----------|-------|
| Badge | 🟢 Fort | 🟠 Neutre |
| Impact | +3-5%/an | 0%/an (stable) |

**Warning Box:**
> ⚠️ **Tabac Reality:** Tobacco market decreases **-3% to -5%/year in volume** nationally.
> Price increases barely compensate. **Never budget "natural growth"** in a Tabac BP.
> Assume stable market (0%). Growth only comes from **YOUR efforts** (works, hours, diversification).

**Files Modified:**
- `tools/report/generateFinancialHtmlTool.ts` (lines 3046-3099)

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

## Code Organization Guidelines

### File Size Limits

**CRITICAL**: Keep files under **500 lines** of code. Files exceeding this limit become difficult to maintain, review, and understand.

| File Type | Maximum Lines | Action if Exceeded |
|-----------|---------------|-------------------|
| Tool files (`*Tool.ts`) | 300 lines | Extract helpers to separate files |
| Agent files (`*Agent.ts`) | 200 lines | Keep agent logic minimal, delegate to tools |
| HTML generators | 500 lines | Split into section modules |
| Utility files | 200 lines | Group by domain (formatting, parsing, etc.) |

### Module Organization Pattern

When a file grows too large, follow this extraction pattern:

```
myTool.ts (500+ lines)  →  myTool/
                            ├── index.ts        (main orchestrator, ~100 lines)
                            ├── types.ts        (interfaces, schemas)
                            ├── helpers.ts      (utility functions)
                            ├── sections/       (for HTML generators)
                            │   ├── index.ts
                            │   ├── section1.ts
                            │   └── section2.ts
                            └── styles/         (CSS if applicable)
                                └── index.ts
```

**Example - generateFinancialHtmlTool refactoring (2025-12-28):**
- Before: 3391 lines in single file
- After: 1096 lines + 6 extracted modules
- Reduction: 68%

### When to Refactor

Refactor IMMEDIATELY when:
1. A file exceeds 500 lines
2. You're adding a new section to an HTML generator
3. You notice copy-pasted code blocks
4. A function exceeds 100 lines

**Proactive approach**: Before adding new functionality, check if the target file is approaching limits. If >400 lines, extract existing code first.

### Import Organization

Keep imports organized in this order:
```typescript
// 1. External libraries (zod, @google/adk, etc.)
import { z } from 'zod';
import { FunctionTool } from '@google/adk';

// 2. Internal utilities (from same project)
import { parseState } from './helpers';

// 3. Local modules (from same directory structure)
import { generateSection } from './sections';

// 4. Types (always last)
import type { MyType } from './types';
```

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

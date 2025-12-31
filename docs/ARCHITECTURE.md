# Architecture

This document describes the technical architecture of SearchCommerce.

## Frontend (React + Vite)

- **Main App**: `src/App.jsx` - manages application state, search flow, enrichment, cart, and notes
- **Components**: `src/components/` - SearchPanel, Map (Leaflet), CartWidget, NoteModal, Layout, etc.
  - `CartWidget.jsx` - Shopping cart with dual analysis buttons (Professional + Financial)
  - `BusinessAnalysisModal.jsx` - Unified modal for professional and financial analysis workflows
- **Services**: `src/services/` - API clients for backend and external APIs
  - `api.js` - Business search via OpenData API
  - `bodaccService.js` - BODACC data fetching with address parsing and filtering
  - `enrichmentService.js` - Coordinates BODACC enrichment with Gemini validation (batch processing)
  - `geminiService.js` - Gemini API integration for validation
  - `placesService.js` - Google Places integration for location/hours
  - `cacheService.js` - Client-side caching (localStorage)
  - `storageService.js` - Cart and notes management (communicates with backend)
- **Utils**: `src/utils/` - Date formatting, business display utilities, report generation
- **Data**: `src/data/nafCodes.js` - NAF activity codes for search

## Backend (Express)

- **Server**: `server.js` - Express API server
- **Services**: `server/services/`
  - `identityService.js` - Reconciles business identity (legal vs commercial name) using Google Places
  - `placesService.js` - Google Places API integration (nearby search, details, assets)
  - `enrichmentService.js` - Generates business context using Gemini
  - `intelligenceService.js` - Territorial intelligence analysis
  - `storageService.js` - Persists cart and notes to JSON files in `data/`
- **Logger**: `logger.js` - Winston logger with daily rotation (logs to `logs/` directory)
- **Data Storage**: `data/cart.json`, `data/notes.json` - persisted user data

## Key Endpoints

- `POST /api/validate-bodacc` - Batch validation of BODACC records with Gemini
- `POST /api/get-business-location` - Get geolocation and hours via Google Places
- `POST /api/enrich-business` - Full enrichment (photos, reviews, AI context)
- `POST /api/analyze-business` - Complete analysis orchestration (identity, assets, intelligence)
- `POST /api/analyze-professional-adk` - **ADK professional analysis pipeline** (10 agents)
- `POST /api/analyze-financial` - **Financial analysis pipeline** (document extraction + benchmarking)
- `GET/POST /api/notes` - Notes management
- `GET/POST/DELETE /api/cart` - Cart management

## Analysis Workflows

The application provides two independent analysis workflows accessible from the cart:

### Professional Analysis (ADK Pipeline)
- **Trigger**: "Analyse Pro" button (violet) in cart
- **Modal**: `BusinessAnalysisModal` in full-width mode
- **Workflow**: 10-agent ADK pipeline for comprehensive business analysis
  1. Preparation - Data validation and enrichment
  2. Demographic Analysis - Population and market size
  3. Google Places Enrichment - Location, reviews, photos
  4. AI Photo Analysis - Business quality assessment
  5. Competitor Mapping - Competition analysis
  6. Cross-Validation - Data consistency checks
  7. Global Scoring - Overall business scoring
  8. Conflict Arbitration - Resolve contradictions
  9. Strategic Recommendations - Actionable insights
  10. Report Generation - HTML report with charts
- **Output**: Professional analysis HTML report

### Financial Analysis
- **Trigger**: "Finances" button (cyan) in cart
- **Modal**: `BusinessAnalysisModal` in full-width mode
- **Workflow**: Document-based financial analysis
  1. Document Selection - User uploads COMPTA/liasse fiscale PDFs
  2. Sector Selection - Manual selection from 9 predefined sectors
  3. Financial Inputs - Rent, personnel costs, salary retention
  4. Gemini Vision Extraction - Extract financial data from documents
  5. Benchmarking - Compare to sector averages
  6. Valuation - EBE, CA, Patrimonial methods (or hybrid for Tabac)
  7. Business Plan - 3-year projections with growth scenarios
  8. Report Generation - HTML report with financial tables
- **Output**: Financial analysis HTML report with verdict (FAVORABLE/RÉSERVÉ/DÉFAVORABLE)

### Workflow Separation
- Each workflow is **completely independent** with its own UI
- No tabs or switching between workflows within a modal
- Each modal displays **full-width** (no 50/50 split)
- Professional workflow: Message + button → progress → report
- Financial workflow: Form → progress → report

## Logging

- Winston logger configured with daily rotation
- Logs stored in `logs/` directory (error and combined logs)
- 14-day retention, 20MB max file size
- Console output in development, file-only in production

## Data Persistence

- Cart and notes are stored in JSON files (`data/cart.json`, `data/notes.json`)
- Backend provides REST API for persistence operations
- Frontend syncs state with backend on mount and after mutations

## Cross-Platform Compatibility

The codebase includes specific handling for macOS vs Windows differences:
- Opening hours parsing handles different line endings and formats (`src/services/placesService.js`)
- Date formatting utilities use cross-platform compatible methods (`src/utils/dateUtils.js`)

## Code Style Notes

- Uses ES6 modules (`import`/`export`)
- React functional components with hooks
- Async/await for asynchronous operations
- Tailwind CSS for styling (configured in `tailwind.config.js`)
- ESLint configuration in `eslint.config.js`

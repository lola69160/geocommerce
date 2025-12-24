# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SearchCommerce is a React + Vite application for searching and analyzing French businesses. It combines multiple data sources:
- **OpenData API** (recherche-entreprises.api.gouv.fr) for business registry data
- **BODACC API** for legal announcements about business sales
- **Google Places API** for location, reviews, photos, and opening hours
- **Gemini API** for AI-powered validation and context generation

The application allows users to search for businesses by activity type (NAF code) and location, enrich results with BODACC data (business sales/transfers), add businesses to a cart, take notes, and generate markdown reports.

## Architecture

### Frontend (React + Vite)
- **Main App**: `src/App.jsx` - manages application state, search flow, enrichment, cart, and notes
- **Components**: `src/components/` - SearchPanel, Map (Leaflet), CartWidget, NoteModal, Layout, etc.
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

### Backend (Express)
- **Server**: `server.js` - Express API server
- **Services**: `server/services/`
  - `identityService.js` - Reconciles business identity (legal vs commercial name) using Google Places
  - `placesService.js` - Google Places API integration (nearby search, details, assets)
  - `enrichmentService.js` - Generates business context using Gemini
  - `intelligenceService.js` - Territorial intelligence analysis
  - `storageService.js` - Persists cart and notes to JSON files in `data/`
- **Logger**: `logger.js` - Winston logger with daily rotation (logs to `logs/` directory)
- **Data Storage**: `data/cart.json`, `data/notes.json` - persisted user data

### Key Endpoints
- `POST /api/validate-bodacc` - Batch validation of BODACC records with Gemini
- `POST /api/get-business-location` - Get geolocation and hours via Google Places
- `POST /api/enrich-business` - Full enrichment (photos, reviews, AI context)
- `POST /api/analyze-business` - Complete analysis orchestration (identity, assets, intelligence)
- `GET/POST /api/notes` - Notes management
- `GET/POST/DELETE /api/cart` - Cart management

## Development Commands

### Installation
```bash
npm install
```

### Running the Application
```bash
# Development - Frontend only (Vite dev server)
npm run dev

# Backend server only
npm run server

# Both frontend and backend concurrently
npm run dev:all
```

### Build and Lint
```bash
# Build for production
npm run build

# Lint code
npm run lint

# Preview production build
npm run preview
```

## Environment Configuration

Create a `.env` file in the root directory (see `.env.example`):
```bash
GEMINI_API_KEY=your_gemini_api_key_here
PLACE_API_KEY=your_google_places_api_key_here
PORT=3001
```

- **GEMINI_API_KEY**: Required for BODACC validation and context generation (get from https://makersuite.google.com/app/apikey)
- **PLACE_API_KEY**: Required for Google Places integration
- **PORT**: Backend server port (default 3001)

## Important Implementation Details

### BODACC Enrichment Flow
1. Frontend fetches business data from OpenData API based on NAF code and location
2. Background enrichment starts automatically after search (`src/App.jsx:66-75`)
3. For each unique address, BODACC records are fetched (`src/services/bodaccService.js`)
4. Records are validated in batch with Gemini to filter false positives (`src/services/enrichmentService.js:99-113`)
5. Valid records are cached to avoid repeated API calls (`src/services/cacheService.js`)

### Address Parsing and Matching
- BODACC uses complex address formats requiring parsing (`src/services/bodaccService.js:10-45`)
- Street names are simplified by removing prefixes (RUE, CHEMIN, etc.) to improve matching
- Multiple search strategies are attempted: exact match, simplified street, zip code fallback

### Google Places Multi-Result Scoring System
The application uses an intelligent scoring system to match businesses from OpenData with Google Places:

**How it works** (`server/services/placesService.js`):
1. **Request 5 results** instead of just 1 from Google Places API (`maxResultCount: 5`)
2. **Score each result** (0-100) based on:
   - **Street number match** (40 points) - Exact match of building number
   - **Postal code match** (30 points) - Ensures correct city/area
   - **GPS distance** (20 points) - Proximity to expected coordinates (25m = full points, 100m = 0)
   - **Street name similarity** (10 points) - Partial match of street name
3. **Select best match** with score ≥ 80% threshold
4. **Reject** if no result meets threshold (prevents false positives)

**Example**: For "10 Avenue Général de Gaulle 69260":
- ✅ Tobacco shop at #10: Score ~90 (40 + 30 + 20 + 0) → Accepted
- ❌ Hotel at #19: Score ~45 (0 + 30 + 15 + 0) → Rejected

**Search Strategy** (`src/services/placesEnrichmentService.js`):
1. **Nearby search** (25m radius) with GPS coordinates - Most reliable
2. **Text search** with business name (enseigne) - For known brands
3. **Address-only search** - For businesses without proper name (entrepreneurs individuels)
4. **Cleaned name fallback** - Last resort with legal name

This prevents common issues like confusing nearby businesses or matching wrong addresses.

### Caching Strategy
- **Client-side**: localStorage-based multi-level cache for BODACC data with TTL (30 minutes L1, 24 hours L2, 7 days L3)
- **API responses**: Gemini validation results are cached by address to minimize API costs
- Cache keys use address as identifier

### Cross-Platform Compatibility
The codebase includes specific handling for macOS vs Windows differences:
- Opening hours parsing handles different line endings and formats (`src/services/placesService.js`)
- Date formatting utilities use cross-platform compatible methods (`src/utils/dateUtils.js`)

### Data Persistence
- Cart and notes are stored in JSON files (`data/cart.json`, `data/notes.json`)
- Backend provides REST API for persistence operations
- Frontend syncs state with backend on mount and after mutations

### Logging
- Winston logger configured with daily rotation
- Logs stored in `logs/` directory (error and combined logs)
- 14-day retention, 20MB max file size
- Console output in development, file-only in production

## Testing Considerations

When testing or debugging:
- Check `logs/` directory for server-side errors
- Frontend uses `console.log` for debugging - search for these in browser console
- BODACC validation requires GEMINI_API_KEY; without it, all records are accepted by default
- Google Places requires PLACE_API_KEY; without it, location features won't work
- Cache can be cleared via browser DevTools > Application > Local Storage

## Code Style Notes

- Uses ES6 modules (`import`/`export`)
- React functional components with hooks
- Async/await for asynchronous operations
- Tailwind CSS for styling (configured in `tailwind.config.js`)
- ESLint configuration in `eslint.config.js`

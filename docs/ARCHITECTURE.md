# Architecture

This document describes the technical architecture of SearchCommerce.

## Frontend (React + Vite)

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
- `GET/POST /api/notes` - Notes management
- `GET/POST/DELETE /api/cart` - Cart management

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

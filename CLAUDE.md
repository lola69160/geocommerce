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
Financial analysis pipeline (4 agents):
- DocumentExtractionAgent, ComptableAgent, ValorisationAgent, ImmobilierAgent
- Accounting analysis (SIG, ratios, benchmarks)
- Business valuation (3 methods: EBE, CA, Patrimonial)
- Real estate analysis (lease, walls purchase, works estimation)

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

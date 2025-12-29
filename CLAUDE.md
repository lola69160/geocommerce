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
npm install                    # Install dependencies
# Set up .env with GEMINI_API_KEY and PLACE_API_KEY
npm run dev:all                # Run frontend + backend
```

## Documentation

All detailed documentation is in the `docs/` directory:

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Technical architecture, API endpoints, data persistence |
| [ADK_PIPELINE.md](docs/ADK_PIPELINE.md) | Professional analysis pipeline (10 agents) |
| [FINANCIAL_PIPELINE.md](docs/FINANCIAL_PIPELINE.md) | Financial analysis pipeline (6 agents) |
| [FINANCIAL_CHANGELOG.md](docs/FINANCIAL_CHANGELOG.md) | Recent improvements & implementation details |
| [FINANCIAL_AGENTS.md](docs/FINANCIAL_AGENTS.md) | Agent specifications & tool descriptions |
| [API_INTEGRATION.md](docs/API_INTEGRATION.md) | External APIs (Google Places, BODACC) |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | Development commands, debugging |

## Testing

```bash
npm run test:financial         # Run all financial tests
npm run test:financial:watch   # Watch mode
npm run test:regression        # Strategic pipeline integrity
npm run test:coverage          # Coverage report
```

See [tests/README.md](tests/README.md) for complete testing guide.

## Key Technologies

- **Frontend**: React, Vite, Tailwind CSS, Leaflet
- **Backend**: Express.js, Winston (logging)
- **AI/ML**: Google Gemini API, Google ADK
- **APIs**: Google Places, OpenData (France), BODACC
- **Storage**: JSON files, localStorage

## Code Organization Guidelines

### File Size Limits

**CRITICAL**: Keep files under **500 lines**. When exceeded:

| File Type | Max Lines | Action |
|-----------|-----------|--------|
| Tool files (`*Tool.ts`) | 300 | Extract helpers |
| Agent files (`*Agent.ts`) | 200 | Delegate to tools |
| HTML generators | 500 | Split into sections |

### Module Extraction Pattern

```
myTool.ts (500+ lines)  →  myTool/
                            ├── index.ts        (~100 lines)
                            ├── types.ts
                            ├── helpers.ts
                            ├── sections/
                            └── styles/
```

### Import Organization

```typescript
// 1. External libraries
import { z } from 'zod';

// 2. Internal utilities
import { parseState } from './helpers';

// 3. Local modules
import { generateSection } from './sections';

// 4. Types (always last)
import type { MyType } from './types';
```

## Contributing

1. Follow ESLint configuration
2. Update docs in `docs/` directory
3. Run `npm run test:financial` before committing
4. Check logs in `logs/` for errors

### Tabac/Presse Specifics (NAF 47.26Z)

Special handling for Tabac commerce:
- **Valuation**: Hybrid method (Bloc Réglementé + Bloc Commercial) instead of EBE/CA/Patrimonial
- **Business Plan**: Differentiated growth (Commissions +0%, Boutique +15% for travaux)
- **Opportunities**: Tobacco market -3-5%/year, no "natural growth" budgeting
- **Digitalisation**: Limited (+2-5% CA) due to delivery restrictions

See [docs/FINANCIAL_CHANGELOG.md](docs/FINANCIAL_CHANGELOG.md) for implementation details.

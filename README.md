# SearchCommerce

> AI-powered French business analysis platform with dual pipeline architecture

SearchCommerce is a React + Vite application for searching, analyzing, and evaluating French businesses using multiple data sources and AI-powered analysis pipelines.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Add your GEMINI_API_KEY and PLACE_API_KEY

# Run frontend + backend
npm run dev:all
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## 🧪 Testing

Comprehensive test suite with 30+ tests:

```bash
# Run all tests
npm test

# Financial pipeline tests
npm run test:financial

# Interactive UI
npm run test:ui
```

**Test Coverage:** ✅ 30 tests across 8 files

For detailed documentation, see [tests/README.md](tests/README.md)

## 📚 Documentation

- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Technical architecture
- **[DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)** - Gojiberry light mode design system
- **[ADK_PIPELINE.md](docs/ADK_PIPELINE.md)** - Strategic pipeline (10 agents)
- **[FINANCIAL_PIPELINE.md](docs/FINANCIAL_PIPELINE.md)** - Financial pipeline (6 agents)
- **[API_INTEGRATION.md](docs/API_INTEGRATION.md)** - API integrations
- **[DEVELOPMENT.md](docs/DEVELOPMENT.md)** - Development guide
- **[tests/README.md](tests/README.md)** - Testing guide

## 🛠️ Development

```bash
npm run dev:all    # Frontend + Backend
npm test          # Run tests
npm run lint      # Check code quality
```

See [DEVELOPMENT.md](docs/DEVELOPMENT.md) for complete guide.

---

**Built with ❤️ for French business analysis**

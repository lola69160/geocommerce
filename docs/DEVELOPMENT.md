# Development Guide

This document provides instructions for developing and testing SearchCommerce.

## Installation

```bash
npm install
```

## Running the Application

### Development - Frontend only (Vite dev server)
```bash
npm run dev
```

### Backend server only
```bash
npm run server
```

### Both frontend and backend concurrently
```bash
npm run dev:all
```

## Build and Lint

### Build for production
```bash
npm run build
```

### Lint code
```bash
npm run lint
```

### Preview production build
```bash
npm run preview
```

## Testing

SearchCommerce includes a comprehensive test suite using Vitest.

### Quick Start

```bash
# Run all tests
npm test

# Financial pipeline tests only
npm run test:financial

# Watch mode (re-runs on file changes)
npm run test:financial:watch

# Interactive UI
npm run test:ui

# Coverage report
npm run test:coverage
```

### Test Structure

```
tests/
├── financial/
│   ├── fixtures/              # Test data (JSON mocks)
│   ├── tools/                 # Unit tests for tools
│   ├── agents/                # Unit tests for agents
│   └── integration/           # Integration tests
└── regression/                # Non-regression tests
```

### Test Results

Current test coverage:
- **30 tests** across 8 test files
- **All tests passing** ✅
- Unit tests for SIG calculations, agents, tools
- Integration test for full pipeline (6 agents)
- Regression tests for strategic pipeline

### Running Specific Tests

```bash
# Run a specific test file
npm run test:financial -- documentExtraction.test.ts

# Run tests matching a pattern
npm run test:financial -- -t "should calculate correct EBE"

# Verbose output
npm run test:financial -- --reporter=verbose
```

### Writing Tests

Example unit test for a tool:

```typescript
import { describe, it, expect } from 'vitest';
import { myTool } from '@server/adk/financial/tools/myTool';

describe('myTool', () => {
  it('should calculate correctly', async () => {
    const mockContext = {
      state: {
        get: (key: string) => mockData[key],
        set: () => {},
      },
    } as any;

    const result = await myTool.execute({}, mockContext);
    expect(result.value).toBe(expectedValue);
  });
});
```

### Test Documentation

For complete testing documentation:
- **[tests/README.md](../tests/README.md)** - Complete guide
- **[tests/QUICK_START.md](../tests/QUICK_START.md)** - Quick start
- **[TESTS_SUMMARY.md](../TESTS_SUMMARY.md)** - Results summary

### CI/CD Integration

Tests can be integrated into CI/CD pipelines:

```yaml
# .github/workflows/test.yml
- name: Run Tests
  run: npm run test:financial
  env:
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
```

**Note:** Tests run without `GEMINI_API_KEY`, but some integration tests are skipped.

## Environment Configuration

Create a `.env` file in the root directory (see `.env.example`):

```bash
GEMINI_API_KEY=your_gemini_api_key_here
PLACE_API_KEY=your_google_places_api_key_here
PORT=3001
```

### Environment Variables

- **GEMINI_API_KEY**: Required for BODACC validation and context generation
  - Get from: https://makersuite.google.com/app/apikey
  - Used for: Gemini Vision, text generation, validation

- **PLACE_API_KEY**: Required for Google Places integration
  - Get from: Google Cloud Console
  - Used for: Places search, photos, reviews, opening hours

- **PORT**: Backend server port (default: 3001)

## Manual Testing Considerations

### Debugging

When testing or debugging:
- Check `logs/` directory for server-side errors
- Frontend uses `console.log` for debugging - search for these in browser console
- BODACC validation requires GEMINI_API_KEY; without it, all records are accepted by default
- Google Places requires PLACE_API_KEY; without it, location features won't work
- Cache can be cleared via browser DevTools > Application > Local Storage

### Logs

Winston logger configuration:
- Logs stored in `logs/` directory (error and combined logs)
- 14-day retention, 20MB max file size
- Console output in development, file-only in production

### Data Files

- Cart: `data/cart.json`
- Notes: `data/notes.json`
- Professional Reports: `data/professional-reports/` (generated HTML reports)

### Common Issues

#### API Keys
If APIs fail silently:
1. Verify `.env` file exists in root directory
2. Check API keys are valid
3. Restart the server after updating `.env`

#### Cache Issues
If data seems stale:
1. Clear browser localStorage (DevTools > Application > Local Storage)
2. Delete `data/cart.json` and `data/notes.json` to reset
3. Restart the server

#### ADK Pipeline Issues
If ADK agents fail:
1. Check `logs/combined.log` for detailed agent execution logs
2. Look for tool call failures in logs (format: `🔧 TOOL CALLED:`, `✅ TOOL RESULT:`)
3. Verify JSON parsing didn't fail (look for `JSON string auto-parsed` logs)
4. Run unit tests to verify tools work in isolation: `npm run test:financial`

## Performance Testing

### Load Testing

For testing the financial pipeline with multiple documents:

```bash
# Place multiple PDFs in test-data/
# Run integration test
npm run test:integration
```

### Benchmarking

To measure performance:

```typescript
// In your test
const start = Date.now();
await tool.execute(params, context);
const duration = Date.now() - start;
console.log(`Execution time: ${duration}ms`);
```

## Continuous Integration

### Pre-commit Checklist

Before committing code:
- [ ] `npm run lint` passes
- [ ] `npm run test:financial` passes (all 30 tests)
- [ ] `npm run test:regression` passes (strategic pipeline intact)
- [ ] Manual testing completed
- [ ] Documentation updated if needed

### Automated Testing

GitHub Actions workflow example:

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:financial
      - run: npm run test:regression
```

# API Integration

This document describes how SearchCommerce integrates with external APIs.

## Google Places Multi-Dimensional Scoring System

The application uses an intelligent **multi-dimensional scoring system** (0-150 points) to match businesses from OpenData with Google Places. This system differentiates businesses at the same address by combining address accuracy with business identity matching.

**Architecture** (`server/adk/tools/places/searchPlacesTool.ts`)

### Scoring Components (150 points max)

#### 1. Address Score (100 points) - Location accuracy

- **Street number match** (40 points) - Exact match of building number
- **Postal code match** (30 points) - Ensures correct city/area
- **GPS distance** (20 points) - Proximity to expected coordinates:
  - ≤25m: 20 pts
  - ≤50m: 15 pts
  - ≤75m: 10 pts
  - ≤100m: 5 pts
- **Street name similarity** (10 points) - Partial match of street name

#### 2. Identity Score (50 points BONUS) - Business differentiation

**Business name matching** (0-30 points) - `server/adk/utils/stringNormalization.ts`:
- Exact match (normalized): 30 pts
- Substring match: 20 pts
- Partial word overlap (>50% Jaccard): 10 pts
- No match: 0 pts

**Normalization steps**:
1. Lowercase conversion
2. Accent removal (NFD decomposition: é→e, à→a)
3. French articles removal (le/la/les/l'/un/une/des)
4. English articles removal (the/a/an)
5. Business suffixes removal (SARL/SAS/EURL/SA/etc.)
6. Keep only letters, numbers, spaces
7. Normalize whitespace

**NAF type matching** (0-20 points) - `server/adk/config/nafPlacesMapping.ts`:
- Primary type match: 20 pts (bakery, restaurant, etc.)
- Related type match: 10 pts (cafe for bakery, etc.)
- No match: 0 pts

**Coverage**: 28 NAF codes mapped to Google Places types:
- Food & Beverage: 10.71C (boulangerie), 56.10A (restaurant), 56.30Z (bar)
- Retail Food: 47.11F (hypermarché), 47.25Z (boissons), 47.29Z (alimentation)
- Retail Non-Food: 47.26Z (tabac), 47.71Z (habillement), 47.76Z (fleurs)
- Services: 96.02A (coiffure), 86.21Z (médecin), 95.12Z (réparation)

### Selection Logic

#### Adaptive Thresholds
- **With NAF code**: 90/150 (60%) - Stricter threshold when type matching available
- **Without NAF code**: 85/150 (57%) - Slightly lower when only name/address available

#### Tie-Breaking Rules (scores within ±5 points)
1. **Identity score** - Prefer better business name/type match
2. **Review count** - Prefer more community validation (userRatingCount)
3. **Rating** - Prefer higher rated businesses
4. **Google ranking** - First result as last resort

#### Ambiguity Detection
- Multiple results with similar scores (±5 pts) AND all have <5 reviews
- Returns `{ found: false, isAmbiguous: true }` to prevent false positives
- **Prioritizes precision over recall** - better to skip than return wrong business

### Real-World Examples

#### Example 1: Multiple businesses at same address ✅ SOLVED
Address: `"13 RUE DE L'ORMEAU 17650 SAINT-DENIS-D'OLERON"`

**Before** (address-only):
- Generic building: 100 pts
- Business "AU FIL DE L'O": 100 pts
- ❌ Tie → Wrong place_id returned

**After** (multi-dimensional):
- Generic building: 100 (address) + 0 (name) + 0 (type) = **100 pts**
- Business "AU FIL DE L'O": 100 (address) + 30 (exact name) + 20 (NAF match) = **150 pts**
- ✅ Clear winner → Correct place_id returned

#### Example 2: Entrepreneur individuel (no business name)
- Score: 100 (address) + 0 (name) + 20 (NAF type) = **120 pts**
- ✅ Found if NAF matches (threshold 85)

#### Example 3: Ambiguous scenario
- 3 grocery stores at same address, all <5 reviews, similar names
- All score ~120 pts (address + partial name)
- ✅ Returns `found: false, isAmbiguous: true` (precision over recall)

### Implementation Files

**New files** (2025-12-26):
- `server/adk/utils/stringNormalization.ts` - Name normalization and scoring
- `server/adk/config/nafPlacesMapping.ts` - NAF→Google Places type mappings (28 codes)

**Modified files** (2025-12-26):
- `server/adk/tools/places/searchPlacesTool.ts` - Multi-dimensional scoring logic
- `server/adk/schemas/placesSchema.ts` - Extended output schema (nameMatchDetails, typeMatchDetails, isAmbiguous)
- `server/adk/agents/PlacesAgent.ts` - Updated agent instructions

**Debug Output** - Detailed scoring logs for top 3 results:
```
[Places Scoring] Result 1:
  Name: "AU FIL DE L'O"
  Address Score: 100/100
    - Street number: 40/40
    - Postal code: 30/30
    - GPS distance: 20/20
    - Street name: 10/10
  Identity Score: 50/50
    - Name match: 30/30 (exact)
    - Type match: 20/20 (exact)
  OVERALL: 150/150
```

### Backward Compatibility

✅ **Fully compatible** with existing codebase:
- Unique addresses: Still found (score ≥100 always passes threshold)
- Missing business name: Works (name score = 0, not penalized)
- Missing NAF code: Works (type score = 0, lower threshold 85)
- Schema changes: All new fields optional (no breaking changes)

### Search Strategy

`src/services/placesEnrichmentService.js`:
1. **Nearby search** (25m radius) with GPS coordinates - Most reliable
2. **Text search** with business name (enseigne) - For known brands
3. **Address-only search** - For businesses without proper name (entrepreneurs individuels)
4. **Cleaned name fallback** - Last resort with legal name

This prevents common issues like confusing nearby businesses or matching wrong addresses.

## BODACC Enrichment Flow

1. Frontend fetches business data from OpenData API based on NAF code and location
2. Background enrichment starts automatically after search (`src/App.jsx:66-75`)
3. For each unique address, BODACC records are fetched (`src/services/bodaccService.js`)
4. Records are validated in batch with Gemini to filter false positives (`src/services/enrichmentService.js:99-113`)
5. Valid records are cached to avoid repeated API calls (`src/services/cacheService.js`)

### Address Parsing and Matching

- BODACC uses complex address formats requiring parsing (`src/services/bodaccService.js:10-45`)
- Street names are simplified by removing prefixes (RUE, CHEMIN, etc.) to improve matching
- Multiple search strategies are attempted: exact match, simplified street, zip code fallback

## Caching Strategy

### Client-side
localStorage-based multi-level cache for BODACC data with TTL:
- **L1**: 30 minutes (hot cache)
- **L2**: 24 hours (warm cache)
- **L3**: 7 days (cold cache)

### API responses
- Gemini validation results are cached by address to minimize API costs
- Cache keys use address as identifier

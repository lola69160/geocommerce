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
- `POST /api/analyze-professional-adk` - **ADK professional analysis pipeline** (10 agents)
- `GET/POST /api/notes` - Notes management
- `GET/POST/DELETE /api/cart` - Cart management

## ADK Agent Pipeline Architecture

SearchCommerce utilise le **Google Agent Development Kit (ADK)** pour l'analyse professionnelle approfondie.

📚 **Documentation officielle ADK** : https://google.github.io/adk-docs/

### Structure
- **MainOrchestrator**: SequentialAgent orchestrant 10 agents spécialisés
- **Runner**: Créé au niveau endpoint Express, gère le cycle de vie d'exécution
- **State**: AgentState partagé entre tous les agents via outputKey
- **Tools**: 60+ FunctionTool avec validation Zod pour type safety
- **Automatic JSON Parsing**: Les outputs JSON string sont automatiquement parsés en objets (server.js:518-542)

### Models Configuration
Tous les agents utilisent **Gemini 2.5 Flash Lite** (`gemini-2.5-flash-lite`):
- Multimodal complet (texte, image, audio, vidéo)
- 1M tokens de contexte
- Gratuit (100 RPM)
- Optimisé pour vitesse et coût
- Configuration dans `server/adk/config/models.ts`

**Note importante**: `responseMimeType: 'application/json'` est incompatible avec Function Calling (Tools) et n'est donc pas utilisé. Les agents reçoivent des instructions JSON dans leurs prompts système.

### Pipeline (ordre d'exécution)
1. **PreparationAgent** - Normalisation adresse + extraction GPS
   - Tools: `normalizeAddress`, `extractCoordinates`
   - Output: `{ businessId, normalizedAddress, coordinates, commune, searchParams, cacheKey }`

2. **DemographicAgent** - Analyse démographique INSEE (population, CSP)
   - Tools: `fetchCommuneData`, `estimateTradeArea`
   - Output: `{ analyzed, commune, profile, score }`

3. **PlacesAgent** - Enrichissement Google Places (photos, avis, horaires) **[CRITIQUE]**
   - Tools: `searchPlaces`, `fetchAssets` (OBLIGATOIRE si found=true)
   - **Workflow à 2 étapes** :
     1. `searchPlaces()` - Recherche textuelle avec scoring (seuil 80%)
     2. `fetchAssets(place_id)` - **OBLIGATOIRE** pour photos/reviews complets
   - **Important** : searchText retourne des références photos limitées. fetchAssets retourne les URLs complètes et reviews détaillées.
   - Output: `{ found, place_id, name, rating, reviews: [...], photos: [{ url, ... }], openingHours, matchScore }`

4. **PhotoAnalysisAgent** - Analyse Gemini Vision (état local, travaux nécessaires)
   - Tools: `analyzePhotos`
   - Output: `{ analyzed, photos_count, condition, renovation_needed, cost_estimate }`

5. **CompetitorAgent** - Cartographie POI concurrentiels (rayon 200m, commerces uniquement)
   - Tools: `searchNearbyPOI`, `categorizePOI`
   - Output: `{ nearby_poi, total_competitors, density_level, market_assessment }`
   - **Fix 2025-12-26** : Radius réduit de 500m → 200m + filtrage sur 20+ types commerciaux (exclude parcs, transports, banques)

6. **ValidationAgent** - Validation croisée + détection conflits (6 types)
   - Tools: `crossValidateData`, `detectConflicts`
   - Output: `{ valid, coherence_score, total_conflicts, blocking_conflicts, conflicts: [...] }`

7. **GapAnalysisAgent** - Scoring multi-dimensionnel (0-100)
   - Tools: `calculateScores`, `assessRisks`
   - Output: `{ scores: { location, market, operational, financial, overall }, level, breakdown, risks }`

8. **ArbitratorAgent** - Résolution conflits détectés
   - Tools: `arbitrateConflict`
   - Output: `{ arbitrated, total_conflicts_arbitrated, resolutions: [...] }`

9. **StrategicAgent** - Recommandation GO/NO-GO finale (Gemini Thinking)
   - Tools: `generateRecommendation`
   - Output: `{ recommendation: "GO" | "NO-GO" | "GO_WITH_RESERVES", score, confidence, rationale }`

10. **ReportAgent** - Génération rapport HTML professionnel enrichi
    - Tools: `generateHTML`, `saveReport`
    - **Workflow** : generateHTML() → extraire .html → saveReport({ html, outputDir })
    - Output: `{ generated, filepath, filename, size_bytes, sections_included, summary }`
    - **Sections du rapport** (ordre d'affichage) :
      1. Executive Summary - Recommandation GO/NO-GO, scores clés
      2. Business Information - Identité, localisation, activité
      3. 🏘️ **Présentation de la Commune** - Photo (Tavily), carte (Google Maps Static), données démographiques
      4. 📸 **Photos du Commerce** - Galerie filtrée (max 6), annotations analyse Gemini Vision
      5. 💼 **Historique BODACC** - Tableau dates/montants de rachats
      6. 🕐 **Horaires d'Ouverture** - Tableau jours/horaires (traduit FR)
      7. Scores Multi-Dimensionnels - Location, Market, Operational, Financial
      8. Analyse des Risques - Catégorisés par sévérité
      9. Analyse Stratégique - SWOT, rationale GO/NO-GO

#### Détails Sections Enrichies du Rapport

**🏘️ Présentation de la Commune** (`generateCommuneSection`):
- **Photo commune** : Récupérée via Tavily Search API (`include_images: true`, `search_depth: 'advanced'`)
  - Query : `"${commune} France tourisme présentation ville photos"`
  - Timeout : 8 secondes
  - Fallback : Placeholder gris si pas d'image
- **Carte** : Google Maps Static API avec marker rouge sur commerce
  - URL : `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lon}&zoom=13&size=600x300&markers=color:red|${lat},${lon}&key=${PLACE_API_KEY}`
  - Error handling : Messages clairs si API key manquante ou coordonnées invalides
  - Fallback : SVG inline base64 avec `onerror` handler si image ne charge pas
- **Description** : Combinaison données démographiques + description Tavily (300 caractères)
- **Layout** : Grille 2 colonnes (photo | carte), responsive mobile 1 colonne
- **Fix 2025-12-26** : Ajouté error handling robuste avec fallback SVG et messages diagnostics

**📸 Photos du Commerce** (`generatePhotosSection`):
- **Source** : `places.photos[]` (récupérées par PlacesAgent → fetchAssets)
- **Filtrage** : Photos avec dimensions ≥ 400px, max 6 photos
- **Grille responsive** : 3 colonnes desktop, 1 colonne mobile
- **Annotations IA** : Si `photo.analyzed = true`, badge sur première photo :
  - Condition du local (`photo.condition`)
  - Travaux nécessaires (`photo.renovation_needed`)
  - Coût estimé (`photo.cost_estimate`)
- **CSS** : `.photo-grid`, `.photo-card`, `.photo-badge`, `.photo-annotation`

**💼 Historique BODACC** (`generateBODACCTable`):
- **Source** : `business.bodaccData[]` (enrichi par frontend BODACC service)
- **Colonnes** : Date de parution | Montant du rachat
- **Formatage** :
  - Dates : DD/MM/YYYY (locale française)
  - Montants : 125 000 € (séparateurs milliers)
- **Tri** : Date décroissante (plus récent en premier)
- **Parsing dates robuste** : Support ISO + DD/MM/YYYY formats
- **Fallback** : Message "Aucun historique BODACC trouvé"
- **Fix 2025-12-26** : Corrigé field name `bodacc` → `bodaccData` pour correspondre au frontend

**🕐 Horaires d'Ouverture** (`generateOpeningHoursTable`):
- **Source** : `places.openingHours.weekdayDescriptions[]`
- **Format input** : Array de strings `["Monday: 9 AM - 5 PM", ...]`
- **Parsing** : `indexOf(':')` + `substring()` pour gérer multiple colons (ex: "lundi: 06:30 - 20:00")
- **Traduction** : Jours EN → FR (Monday → Lundi, etc.)
- **Détection fermeture** : Keyword matching "closed", "fermé" → Badge rouge
- **Badge statut** : "Ouvert maintenant" / "Fermé actuellement" si `openNow` disponible
- **Fallback** : Message "Horaires non disponibles"
- **Fix 2025-12-26** : Corrigé parsing `split(':')` qui tronquait les horaires à cause des colons dans les heures

### State Management ADK
- **Initial State**: Passé via `stateDelta` dans `runner.runAsync()` (server.js:499)
  - Structure: `{ business: BusinessInput, metadata: {...} }`
  - Top-level keys accessibles directement dans instructions: `business.field`

- **Lecture (Reading State)**:
  - Top-level state: `business.siret`, `business.siege.commune`
  - Agent outputs: `state.preparation.coordinates`, `state.demographic.score`
  - Templates in instructions: Utiliser références explicites comme "depuis state.preparation.coordinates"

- **Écriture (Writing State)**:
  - Agents write via `outputKey`: `outputKey: 'preparation'` → `state.preparation`
  - Output automatiquement merged into shared state by ADK

- **Flux automatique**: ADK gère automatiquement la propagation de state - pas de merge manuel

### Automatic JSON Parsing (Critical Fix)

**Problème** : Les agents LlmAgent avec instructions "RETOURNE UNIQUEMENT LE JSON VALIDE" génèrent des **strings JSON** au lieu d'objets JavaScript.

**Solution** : Parser automatique dans server.js (lignes 518-542) :
```javascript
// AUTO-PARSING JSON STRINGS → OBJECTS
deltaKeys.forEach(key => {
  const value = event.actions.stateDelta[key];

  if (typeof value === 'string' && value.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(value);
      event.actions.stateDelta[key] = parsed;
      logger.info(`JSON string auto-parsed for state.${key}`);
    } catch (e) {
      logger.warn(`Failed to auto-parse JSON for state.${key} - keeping as string`);
    }
  }
});
```

**Bénéfices** :
- ✅ `state.preparation.coordinates` accessible (au lieu de `state.preparation` = string)
- ✅ CompetitorAgent peut lire `state.preparation.coordinates` sans erreur
- ✅ ReportAgent reçoit un objet avec `report.html` au lieu d'une string
- ✅ Parsing centralisé (1 seul endroit) au lieu de refonte de 10 agents

**Alternative rejetée** : Retirer "RETOURNE UNIQUEMENT LE JSON VALIDE" des instructions
- ❌ Nécessite refonte de 8+ agents
- ❌ Gemini peut retourner texte prose au lieu de JSON structuré
- ❌ Risque de régression

**Limitation importante** : Le parsing dans server.js se fait APRÈS que l'ADK a déjà propagé le state. Les tools peuvent donc recevoir des **JSON strings** au lieu d'objets.

### Pattern de Parsing dans les Tools (Critical)

**Problème** : Le parsing automatique dans server.js arrive TROP TARD - après que l'ADK a propagé le state aux agents suivants. Résultat : `toolContext.state.get('preparation')` peut retourner une **STRING au lieu d'un OBJET**.

**Solution obligatoire** : Chaque tool qui lit depuis state DOIT parser les JSON strings avant d'accéder aux propriétés :

```typescript
execute: async (params, toolContext?: ToolContext) => {
  // Lire depuis state (peut être string ou objet)
  let preparation = toolContext?.state.get('preparation') as PreparationOutput | undefined | string;

  // Parser JSON string si nécessaire
  if (typeof preparation === 'string') {
    try {
      preparation = JSON.parse(preparation) as PreparationOutput;
    } catch (e) {
      return { error: 'Failed to parse preparation state (invalid JSON)' };
    }
  }

  // Maintenant on peut accéder aux propriétés
  if (!preparation?.normalizedAddress?.zipCode) {
    throw new Error('preparation.normalizedAddress.zipCode not found');
  }

  // Suite du code...
}
```

**Tools corrigés** (pattern appliqué) :
- ✅ `tavilySearchTool.ts` - parse `state.preparation`
- ✅ `getCommuneDataTool.ts` - parse `state.preparation`
- ✅ `searchPlacesTool.ts` - parse `state.preparation`
- ✅ `nearbySearchTool.ts` - parse `state.preparation`
- ✅ `analyzePhotosTool.ts` - parse `state.places`
- ✅ `generateHTMLTool.ts` - parse TOUS les outputs (helper `parseIfNeeded()`)

**Pattern avancé (ReportAgent)** : Helper pour parser tous les outputs en une fois :
```typescript
const parseIfNeeded = (value: any) => {
  if (typeof value === 'string' && value.trim().startsWith('{')) {
    try { return JSON.parse(value); } catch (e) { return value; }
  }
  return value;
};

const data = {
  preparation: parseIfNeeded(toolContext?.state.get('preparation')),
  demographic: parseIfNeeded(toolContext?.state.get('demographic')),
  places: parseIfNeeded(toolContext?.state.get('places')),
  // ... etc
};
```

### Gemini Vision avec responseMimeType (PhotoAnalysis)

**Problème** : `analyzePhotosTool` retournait du texte prose (`"Absolument..."`) au lieu de JSON, causant `JSON.parse()` failure.

**Cause** : `responseSchema` seul ne suffit pas - Gemini peut ignorer le schema sans directive stricte.

**Solution** : Ajouter `responseMimeType: "application/json"` dans `generationConfig` :

```typescript
const result = await model.generateContent({
  contents: [{ role: "user", parts: [...imageParts, { text: prompt }] }],
  generationConfig: {
    temperature: 0.3,
    responseMimeType: "application/json",  // ← Force JSON strict
    responseSchema: {
      type: "object",
      properties: { /* schema */ }
    }
  }
});
```

**Pourquoi c'est compatible** :
- ✅ `analyzePhotosTool` est un **FunctionTool**, pas un LlmAgent
- ✅ Appelle directement `model.generateContent()` SANS function calling
- ✅ `responseMimeType` n'est incompatible QU'avec function calling (tools dans agents)

**Note** : Les LlmAgent ne peuvent PAS utiliser `responseMimeType: "application/json"` car incompatible avec function calling (voir `models.ts:44`).

### Pattern Critique pour Instructions d'Agents

**OBLIGATOIRE** : Chaque instruction d'agent DOIT expliciter :

1. **WHERE** - D'où viennent les données
   - Top-level state : `business.siege.commune`
   - Outputs agents : `state.preparation.coordinates`, `state.places.rating`

2. **WHAT** - Quels champs extraire
   - Lister les champs utilisés : `business.siege.adresse`, `business.siege.code_postal`

3. **HOW** - Comment passer aux tools
   - Avec objet complet : `extractCoordinates({ business: business })`
   - Avec champs construits : `normalizeAddress({ address: "adresse complète" })`

**Exemple (PreparationAgent)** :
```typescript
instruction: `
DONNÉES DISPONIBLES:
- business.siege.adresse : Adresse du siège
- business.siege.code_postal : Code postal

WORKFLOW:
1. Construire adresse : business.siege.adresse + " " + business.siege.code_postal
2. Appeler normalizeAddress({ address: "adresse construite" })
`
```

**Anti-pattern à éviter** :
```typescript
// ❌ VAGUE - Agent ne sait pas où trouver business
"Utiliser l'adresse du business"

// ✅ EXPLICITE
"Utiliser business.siege.adresse (disponible dans state initial)"
```

### Pattern ADK Officiel
L'implémentation suit les patterns officiels de adk-samples:
- Runner créé au niveau application (endpoint), PAS dans l'agent
- State flow automatique via outputKey
- Callbacks standard ADK (beforeAgentRun, afterAgentRun)
- continueOnError: true pour résilience

**Code pattern**:
```javascript
// Endpoint Express (server.js)
const sessionService = new InMemorySessionService();
const orchestrator = createMainOrchestrator(); // Pure SequentialAgent
const runner = new Runner({ appName, agent: orchestrator, sessionService });

for await (const event of runner.runAsync({ userId, sessionId, newMessage, stateDelta })) {
  if (event.actions?.stateDelta && Object.keys(event.actions.stateDelta).length > 0) {
    Object.assign(finalState, event.actions.stateDelta);
  }
}
```

### Logs Détaillés du Pipeline

Le serveur affiche des logs visuels pour suivre l'exécution du pipeline ADK (server.js:563-597) :

**Format des logs** :
```
================================================================================
🚀 AGENT STARTED: preparation
================================================================================

🔧 TOOL CALLED: normalizeAddress
   Parameters: {
     "address": "25 CHEMIN DE PIERRE BLANCHE 69570 DARDILLY"
   }

✅ TOOL RESULT: normalizeAddress
   Response: {
     "full": "25 CHEMIN DE PIERRE BLANCHE 69570 DARDILLY",
     "street": "25 CHEMIN DE PIERRE BLANCHE",
     "zipCode": "69570",
     "city": "DARDILLY",
     "simplified": "PIERRE BLANCHE"
   }

info: JSON string auto-parsed for state.preparation
info: Agent response [preparation] -> preparation: {"dataType":"object","isObject":true}
```

**Bénéfices** :
- ✅ Visibilité claire de chaque agent qui démarre
- ✅ Traçabilité complète des outils appelés avec leurs paramètres
- ✅ Résultats de chaque outil affichés (tronqués si > 500 caractères)
- ✅ Détection immédiate des problèmes (outil non appelé, résultat vide, erreur)

**Logs ADK standards** (conservés) :
- `[ADK INFO]: Sending out request, model: gemini-3-flash-preview` - Appel API Gemini
- `info: State update detected` - Mise à jour du state partagé

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

### Google Places Multi-Dimensional Scoring System

The application uses an intelligent **multi-dimensional scoring system** (0-150 points) to match businesses from OpenData with Google Places. This system differentiates businesses at the same address by combining address accuracy with business identity matching.

**Architecture** (`server/adk/tools/places/searchPlacesTool.ts`):

#### Scoring Components (150 points max)

**1. Address Score (100 points)** - Location accuracy:
- **Street number match** (40 points) - Exact match of building number
- **Postal code match** (30 points) - Ensures correct city/area
- **GPS distance** (20 points) - Proximity to expected coordinates:
  - ≤25m: 20 pts
  - ≤50m: 15 pts
  - ≤75m: 10 pts
  - ≤100m: 5 pts
- **Street name similarity** (10 points) - Partial match of street name

**2. Identity Score (50 points BONUS)** - Business differentiation:
- **Business name matching** (0-30 points) - `server/adk/utils/stringNormalization.ts`:
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

- **NAF type matching** (0-20 points) - `server/adk/config/nafPlacesMapping.ts`:
  - Primary type match: 20 pts (bakery, restaurant, etc.)
  - Related type match: 10 pts (cafe for bakery, etc.)
  - No match: 0 pts

  **Coverage**: 28 NAF codes mapped to Google Places types:
  - Food & Beverage: 10.71C (boulangerie), 56.10A (restaurant), 56.30Z (bar)
  - Retail Food: 47.11F (hypermarché), 47.25Z (boissons), 47.29Z (alimentation)
  - Retail Non-Food: 47.26Z (tabac), 47.71Z (habillement), 47.76Z (fleurs)
  - Services: 96.02A (coiffure), 86.21Z (médecin), 95.12Z (réparation)

#### Selection Logic

**Adaptive Thresholds**:
- **With NAF code**: 90/150 (60%) - Stricter threshold when type matching available
- **Without NAF code**: 85/150 (57%) - Slightly lower when only name/address available

**Tie-Breaking Rules** (scores within ±5 points):
1. **Identity score** - Prefer better business name/type match
2. **Review count** - Prefer more community validation (userRatingCount)
3. **Rating** - Prefer higher rated businesses
4. **Google ranking** - First result as last resort

**Ambiguity Detection**:
- Multiple results with similar scores (±5 pts) AND all have <5 reviews
- Returns `{ found: false, isAmbiguous: true }` to prevent false positives
- **Prioritizes precision over recall** - better to skip than return wrong business

#### Real-World Examples

**Example 1: Multiple businesses at same address** ✅ SOLVED
- Address: `"13 RUE DE L'ORMEAU 17650 SAINT-DENIS-D'OLERON"`
- **Before** (address-only):
  - Generic building: 100 pts
  - Business "AU FIL DE L'O": 100 pts
  - ❌ Tie → Wrong place_id returned
- **After** (multi-dimensional):
  - Generic building: 100 (address) + 0 (name) + 0 (type) = **100 pts**
  - Business "AU FIL DE L'O": 100 (address) + 30 (exact name) + 20 (NAF match) = **150 pts**
  - ✅ Clear winner → Correct place_id returned

**Example 2: Entrepreneur individuel** (no business name):
- Score: 100 (address) + 0 (name) + 20 (NAF type) = **120 pts**
- ✅ Found if NAF matches (threshold 85)

**Example 3: Ambiguous scenario**:
- 3 grocery stores at same address, all <5 reviews, similar names
- All score ~120 pts (address + partial name)
- ✅ Returns `found: false, isAmbiguous: true` (precision over recall)

#### Implementation Files

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

#### Backward Compatibility

✅ **Fully compatible** with existing codebase:
- Unique addresses: Still found (score ≥100 always passes threshold)
- Missing business name: Works (name score = 0, not penalized)
- Missing NAF code: Works (type score = 0, lower threshold 85)
- Schema changes: All new fields optional (no breaking changes)

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

## Financial Pipeline Architecture (ADK)

SearchCommerce intègre un **pipeline d'analyse financière autonome** basé sur ADK pour l'évaluation comptable d'entreprises à partir de documents PDF (bilans, liasses fiscales, baux).

📁 **Module**: `server/adk/financial/`

### Structure du Pipeline

Le Financial Pipeline est un **SequentialAgent orchestrant 6 agents spécialisés** :

1. **DocumentExtractionAgent** ✅ - Extraction et classification de documents PDF
2. **ComptableAgent** ✅ - Analyse comptable de niveau expert-comptable
3. **ValorisationAgent** ✅ - Valorisation de l'entreprise (3 méthodes: EBE, CA, Patrimoniale)
4. **ImmobilierAgent** ✅ - Analyse immobilière professionnelle (bail, murs, travaux)
5. **FinancialValidationAgent** (à implémenter) - Validation de cohérence
6. **FinancialReportAgent** (à implémenter) - Génération rapport HTML

### 1. DocumentExtractionAgent

**Responsabilités** :
- Extraire le texte brut des PDF avec `pdfjs-dist`
- Classifier automatiquement les documents (bilan, compte de résultat, liasse fiscale, bail)
- Parser les tableaux comptables
- Structurer les données en JSON

**Tools** (3) :
- `extractPdfTool` - Extraction texte PDF (lit depuis `state.documents`)
- `classifyDocumentTool` - Classification Gemini (6 types de documents)
- `parseTablesTool` - Parsing des tableaux comptables

**Input** : `state.documents[]` - Liste des fichiers PDF avec `{ filename, filePath ou content }`

**Output** (`state.documentExtraction`) :
```json
{
  "documents": [
    {
      "filename": "bilan-2024.pdf",
      "documentType": "bilan",
      "year": 2024,
      "confidence": 0.95,
      "extractedData": {
        "raw_text": "...",
        "tables": [
          {
            "headers": ["ACTIF", "2024", "2023"],
            "rows": [["Immobilisations", "50000", "45000"]],
            "caption": "Bilan Actif"
          }
        ]
      }
    }
  ],
  "summary": {
    "total_documents": 2,
    "years_covered": [2024, 2023],
    "missing_documents": ["compte_resultat_2024"]
  }
}
```

### 2. ComptableAgent

**Responsabilités** :
- Calculer les Soldes Intermédiaires de Gestion (SIG) pour chaque année
- Calculer 11 ratios financiers clés (rentabilité, liquidité, solvabilité)
- Analyser l'évolution sur la période (tendances CA/EBE/RN)
- Comparer aux benchmarks sectoriels (8 secteurs NAF couverts)
- Générer un score de santé financière global (0-100)
- Identifier les alertes et points de vigilance

**Tools** (5) :
- `calculateSigTool` - Calcule 14 indicateurs SIG par année
- `calculateRatiosTool` - Calcule 11 ratios financiers (dernière année)
- `analyzeTrendsTool` - Analyse évolution CA/EBE/RN
- `compareToSectorTool` - Compare 9 ratios aux benchmarks sectoriels
- `calculateHealthScoreTool` - Score 0-100 (4 dimensions : rentabilité, liquidité, solvabilité, activité)

**Input** : `state.documentExtraction` - Documents comptables parsés

**Output** (`state.comptable`) :
```json
{
  "analysisDate": "2025-12-26",
  "yearsAnalyzed": [2024, 2023, 2022],

  "sig": {
    "2024": {
      "chiffre_affaires": 500000,
      "marge_commerciale": 200000,
      "valeur_ajoutee": 180000,
      "ebe": 85000,
      "resultat_exploitation": 70000,
      "resultat_net": 55000
    }
  },

  "evolution": {
    "ca_evolution_pct": 12.5,
    "ebe_evolution_pct": 8.3,
    "rn_evolution_pct": 15.2,
    "tendance": "croissance",
    "commentaire": "Croissance soutenue sur 2022-2024"
  },

  "ratios": {
    "marge_brute_pct": 40.0,
    "marge_ebe_pct": 17.0,
    "marge_nette_pct": 11.0,
    "taux_va_pct": 36.0,
    "rotation_stocks_jours": 25,
    "delai_clients_jours": 30,
    "delai_fournisseurs_jours": 45,
    "bfr_jours_ca": 10,
    "taux_endettement_pct": 85.0,
    "capacite_autofinancement": 70000
  },

  "benchmark": {
    "nafCode": "47.11",
    "sector": "Commerce en magasin non spécialisé",
    "comparisons": [
      {
        "ratio": "Marge brute",
        "value": 40.0,
        "sectorAverage": 22.0,
        "position": "superieur",
        "deviation_pct": 81.8
      }
    ]
  },

  "alertes": [
    {
      "level": "critical",
      "category": "tresorerie",
      "message": "Délai clients élevé (60 jours vs 30 secteur)",
      "impact": "Risque de tension de trésorerie",
      "recommendation": "Mettre en place relance systématique"
    }
  ],

  "healthScore": {
    "overall": 72,
    "breakdown": {
      "rentabilite": 65,
      "liquidite": 70,
      "solvabilite": 80,
      "activite": 85
    },
    "interpretation": "Bonne santé financière"
  },

  "synthese": "L'entreprise affiche une croissance solide (+12.5% CA)..."
}
```

**Configuration** :
- `server/adk/financial/config/sectorBenchmarks.ts` - 8 secteurs NAF avec ratios moyens :
  - 47.11 : Supermarchés
  - 10.71 : Boulangerie-pâtisserie
  - 56.10 : Restauration traditionnelle
  - 56.30 : Bar, café
  - 96.02 : Coiffure
  - 47.7 : Commerce détail habillement
  - 47.73 : Pharmacie
  - 55.10 : Hôtellerie

**Workflow** :
1. `calculateSig()` → Lit `state.documentExtraction`, calcule SIG par année
2. `calculateRatios()` → Calcule ratios à partir des SIG (dernière année)
3. `analyzeTrends()` → Analyse évolution temporelle
4. `compareToSector(nafCode)` → Compare aux benchmarks (lit NAF depuis `state.businessInfo`)
5. `calculateHealthScore()` → Score global basé sur ratios et évolution
6. Gemini interprète et génère alertes + synthèse

**Pattern ADK respecté** :
- ✅ Tous les calculs dans les tools (pas par le LLM) pour garantir exactitude
- ✅ LLM interprète les résultats et génère commentaires/alertes
- ✅ Parsing JSON strings (pattern CLAUDE.md) dans tous les tools
- ✅ Output injecté dans `state.comptable` via `outputKey`

### 3. ValorisationAgent

**Responsabilités** :
- Valoriser le fonds de commerce par 3 méthodes reconnues en France
- Calculer la valorisation par multiple d'EBE (méthode de référence)
- Calculer la valorisation par % du CA (méthode complémentaire)
- Calculer la valorisation patrimoniale (actif net + goodwill)
- Synthétiser les 3 méthodes et recommander une fourchette
- Comparer avec le prix affiché si fourni
- Générer des arguments de négociation

**Tools** (4) :
- `calculateEbeValuationTool` - Valorisation par multiple d'EBE (2.5-4.5x selon secteur)
- `calculateCaValuationTool` - Valorisation par % CA (40-110% selon secteur)
- `calculatePatrimonialTool` - Valorisation patrimoniale (actif - dettes + goodwill)
- `synthesizeValuationTool` - Synthèse des 3 méthodes avec pondération intelligente

**Input** : `state.comptable` (SIG, ratios), `state.documentExtraction` (bilan), `state.businessInfo` (NAF)

**Output** (`state.valorisation`) :
```json
{
  "businessInfo": {
    "name": "Commerce ABC",
    "nafCode": "47.26Z",
    "sector": "Tabac-presse"
  },
  "methodeEBE": {
    "ebe_reference": 85000,
    "ebe_retraite": 120000,
    "retraitements": [
      { "description": "Salaire gérant non rémunéré", "montant": 35000 }
    ],
    "coefficient_bas": 2.5,
    "coefficient_median": 3.5,
    "coefficient_haut": 4.5,
    "valeur_basse": 300000,
    "valeur_mediane": 420000,
    "valeur_haute": 540000
  },
  "methodeCA": {
    "ca_reference": 650000,
    "pourcentage_median": 65,
    "valeur_mediane": 422500
  },
  "methodePatrimoniale": {
    "actif_net_comptable": 150000,
    "goodwill": 127500,
    "valeur_estimee": 297500
  },
  "synthese": {
    "fourchette_basse": 315000,
    "fourchette_mediane": 420000,
    "fourchette_haute": 525000,
    "methode_privilegiee": "EBE",
    "valeur_recommandee": 420000
  },
  "comparaisonPrix": {
    "prix_affiche": 480000,
    "ecart_vs_estimation_pct": 14,
    "appreciation": "sur-evalue",
    "marge_negociation": 60000
  },
  "argumentsNegociation": {
    "pour_acheteur": ["📊 Prix +14% vs estimation", "⚠️ Délai clients élevé"],
    "pour_vendeur": ["📈 Croissance +12.5%", "✅ Score santé 72/100"]
  },
  "confidence": 75
}
```

**Configuration** :
- `server/adk/financial/config/valuationCoefficients.ts` - 10 secteurs NAF avec coefficients :
  - Tabac (47.26) : 2.5-4.5x EBE, 50-80% CA
  - Restaurant (56.10) : 2-4x EBE, 50-90% CA
  - Boulangerie (10.71) : 3-5x EBE, 60-100% CA
  - Pharmacie (47.73) : 4-7x EBE, 70-110% CA
  - Bar/Café (56.30) : 2.5-4.5x EBE, 60-90% CA

**Workflow** :
1. `calculateEbeValuation()` → EBE moyen 3 ans + retraitements + multiples sectoriels
2. `calculateCaValuation()` → CA moyen 3 ans × % sectoriels
3. `calculatePatrimonial()` → Actif net + goodwill (1.5x EBE)
4. `synthesizeValuation()` → Pondération (70% EBE + 20% CA + 10% Patrimoniale), comparaison prix, arguments négociation

**Méthode privilégiée** (logique automatique) :
- Si EBE ≤ 0 → **Patrimoniale**
- Si actif net > 2x valeur EBE → **Patrimoniale**
- Sinon → **EBE** (défaut)

**Pattern ADK respecté** :
- ✅ Tous les calculs dans les tools (exactitude garantie)
- ✅ LLM interprète et génère justifications
- ✅ Parsing JSON strings dans tous les tools
- ✅ Output injecté dans `state.valorisation` via `outputKey`

### 4. ImmobilierAgent

**Responsabilités** :
- Analyser le bail commercial (dates, loyer, clauses, conformité)
- Estimer la valeur du droit au bail (propriété commerciale)
- Analyser l'option d'achat des murs (rentabilité locative)
- Estimer les travaux nécessaires (obligatoires et recommandés)
- Générer un score immobilier global (0-100)
- **Fonctionne en mode dégradé** si bail non fourni

**Tools** (4) :
- `analyzeBailTool` - Analyse bail commercial (extraction PDF ou saisie manuelle)
- `estimateDroitBailTool` - Estimation droit au bail (méthode loyer 1-3 ans)
- `analyzeMursTool` - Analyse option murs (rentabilité brute/nette)
- `estimateTravauxTool` - Estimation travaux (obligatoire/recommandé selon état)

**Input** : `state.documentExtraction` (bail PDF), `state.businessInfo` (localisation), `state.valorisation` (pour droit bail), `state.photo` (état local)

**Output** (`state.immobilier`) :
```json
{
  "dataStatus": {
    "bail_disponible": true,
    "source": "document"
  },
  "bail": {
    "type": "commercial_3_6_9",
    "loyer_annuel_hc": 18000,
    "surface_m2": 80,
    "loyer_m2_annuel": 225,
    "duree_restante_mois": 48,
    "loyer_marche_estime": 20000,
    "ecart_marche_pct": -10,
    "appreciation": "avantageux",
    "droit_au_bail_estime": 45000,
    "methode_calcul_dab": "2.5 années × 18 000 €"
  },
  "murs": {
    "option_possible": true,
    "prix_demande": 200000,
    "prix_m2_zone": 2500,
    "rentabilite_brute_pct": 9.0,
    "rentabilite_nette_pct": 7.7,
    "recommandation": "acheter",
    "arguments": ["💰 Excellente rentabilité 9%", "✅ Sécurisation emplacement"]
  },
  "travaux": {
    "etat_general": "moyen",
    "conformite_erp": "a_verifier",
    "travaux_obligatoires": [
      {
        "description": "Mise en conformité PMR",
        "estimation_basse": 8000,
        "estimation_haute": 15000,
        "urgence": "12_mois"
      }
    ],
    "budget_total": {
      "obligatoire_bas": 10000,
      "obligatoire_haut": 20000
    }
  },
  "synthese": {
    "score_immobilier": 72,
    "points_forts": [
      "💰 Loyer avantageux : 10% sous marché",
      "📈 Rentabilité murs 9% : achat recommandé"
    ],
    "points_vigilance": [
      "⚠️ Travaux obligatoires : 10-20k€"
    ],
    "recommandation": "Bail avantageux. Achat murs recommandé (9%). Budget travaux 12-24k€ à négocier."
  }
}
```

**Workflow** :
1. `analyzeBail()` → Extraction PDF ou manual_input, calcul loyer/m², comparaison marché
2. `estimateDroitBail()` → Coefficient 1-3 ans selon facteurs (loyer, durée, type)
3. `analyzeMurs()` → Estimation prix/m² par zone, rentabilité brute/nette, recommandation
4. `estimateTravaux()` → État général (depuis photos IA), travaux obligatoires/recommandés
5. Synthèse → Score 0-100 (40 pts bail + 30 pts travaux + 30 pts murs)

**Scoring Immobilier** (0-100) :
- **Bail** (40 points) : Appreciation + durée restante + type
- **Travaux** (30 points) : État général + conformité + budget
- **Murs** (30 points) : Rentabilité + recommandation

**Recommandation achat murs** :
- Rentabilité brute ≥ 7% → **acheter**
- Rentabilité brute 5-7% → **negocier**
- Rentabilité brute < 5% → **louer**

**Mode dégradé** (sans bail) :
- `analyzeBail` → `bail_disponible: false`
- `estimateDroitBail` → `droit_au_bail_estime: 0`
- `analyzeMurs` → `option_possible: false`
- `estimateTravaux` → ✅ Fonctionne normalement (utilise photos)
- Score max 30 points (travaux uniquement)

**Pattern ADK respecté** :
- ✅ Tous les calculs dans les tools (garantit exactitude)
- ✅ LLM interprète et génère synthèse
- ✅ Parsing JSON strings dans tous les tools
- ✅ Output injecté dans `state.immobilier` via `outputKey`
- ✅ Résilience : Mode dégradé si bail non fourni

### Files Structure

```
server/adk/financial/
├── index.ts                        # Entry point, exports agents
├── agents/
│   ├── DocumentExtractionAgent.ts  # PDF extraction & classification
│   ├── ComptableAgent.ts           # Accounting analysis
│   ├── ValorisationAgent.ts        # Business valuation (3 methods)
│   └── ImmobilierAgent.ts          # Real estate analysis (lease, walls, works)
├── tools/
│   ├── document/
│   │   ├── extractPdfTool.ts       # PDF.js text extraction
│   │   ├── classifyDocumentTool.ts # Gemini classification
│   │   └── parseTablesTool.ts      # Table parsing
│   ├── accounting/
│   │   ├── calculateSigTool.ts     # SIG calculation
│   │   ├── calculateRatiosTool.ts  # Financial ratios
│   │   ├── analyzeTrendsTool.ts    # Trends analysis
│   │   ├── compareToSectorTool.ts  # Sector benchmarking
│   │   └── calculateHealthScoreTool.ts # Health score
│   ├── valuation/
│   │   ├── calculateEbeValuationTool.ts    # EBE multiple valuation
│   │   ├── calculateCaValuationTool.ts     # Revenue % valuation
│   │   ├── calculatePatrimonialTool.ts     # Patrimonial valuation
│   │   └── synthesizeValuationTool.ts      # Synthesis + negotiation args
│   └── property/
│       ├── analyzeBailTool.ts              # Lease analysis
│       ├── estimateDroitBailTool.ts        # Lease right estimation
│       ├── analyzeMursTool.ts              # Walls purchase analysis
│       └── estimateTravauxTool.ts          # Works estimation
└── config/
    ├── sectorBenchmarks.ts         # NAF sector averages (accounting)
    └── valuationCoefficients.ts    # NAF valuation multiples (10 sectors)
```

### Usage Example

```javascript
import {
  DocumentExtractionAgent,
  ComptableAgent,
  ValorisationAgent,
  ImmobilierAgent
} from './server/adk/financial';
import { Runner, InMemorySessionService, SequentialAgent } from '@google/adk';

// Input data
const financialInput = {
  documents: [
    { filename: 'bilan-2024.pdf', filePath: '/path/to/bilan-2024.pdf' },
    { filename: 'compte-resultat-2024.pdf', filePath: '/path/to/cr-2024.pdf' },
    { filename: 'bail-commercial.pdf', filePath: '/path/to/bail.pdf' }  // Optionnel
  ],
  businessInfo: {
    name: 'Mon Commerce SARL',
    siret: '12345678900012',
    nafCode: '47.11F',
    activity: 'Supermarché'
  }
};

// Create orchestrator with 4 agents
const orchestrator = new SequentialAgent({
  name: 'financialPipeline',
  agents: [
    new DocumentExtractionAgent(),  // 1. Extract PDF data
    new ComptableAgent(),            // 2. Accounting analysis
    new ValorisationAgent(),         // 3. Business valuation
    new ImmobilierAgent()            // 4. Real estate analysis
  ]
});

// Run pipeline
const runner = new Runner({
  appName: 'financial',
  agent: orchestrator,
  sessionService: new InMemorySessionService()
});

for await (const event of runner.runAsync({
  userId: 'user1',
  sessionId: 'session1',
  stateDelta: financialInput
})) {
  if (event.actions?.stateDelta) {
    console.log('State updated:', Object.keys(event.actions.stateDelta));
  }
}
```

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

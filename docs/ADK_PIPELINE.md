# ADK Agent Pipeline Architecture

SearchCommerce utilise le **Google Agent Development Kit (ADK)** pour l'analyse professionnelle approfondie.

📚 **Documentation officielle ADK** : https://google.github.io/adk-docs/

## Structure

- **MainOrchestrator**: SequentialAgent orchestrant 10 agents spécialisés
- **Runner**: Créé au niveau endpoint Express, gère le cycle de vie d'exécution
- **State**: AgentState partagé entre tous les agents via outputKey
- **Tools**: 60+ FunctionTool avec validation Zod pour type safety
- **Automatic JSON Parsing**: Les outputs JSON string sont automatiquement parsés en objets (server.js:518-542)

## Models Configuration

Tous les agents utilisent **Gemini 2.5 Flash Lite** (`gemini-2.5-flash-lite`):
- Multimodal complet (texte, image, audio, vidéo)
- 1M tokens de contexte
- Gratuit (100 RPM)
- Optimisé pour vitesse et coût
- Configuration dans `server/adk/config/models.ts`

**Note importante**: `responseMimeType: 'application/json'` est incompatible avec Function Calling (Tools) et n'est donc pas utilisé. Les agents reçoivent des instructions JSON dans leurs prompts système.

## Pipeline (ordre d'exécution)

### 1. PreparationAgent
Normalisation adresse + extraction GPS

**Tools**: `normalizeAddress`, `extractCoordinates`

**Output**: `{ businessId, normalizedAddress, coordinates, commune, searchParams, cacheKey }`

### 2. DemographicAgent
Analyse démographique INSEE (population, CSP)

**Tools**: `fetchCommuneData`, `estimateTradeArea`

**Output**: `{ analyzed, commune, profile, score }`

### 3. PlacesAgent **[CRITIQUE]**
Enrichissement Google Places (photos, avis, horaires)

**Tools**: `searchPlaces`, `fetchAssets` (OBLIGATOIRE si found=true)

**Workflow à 2 étapes** :
1. `searchPlaces()` - Recherche textuelle avec scoring (seuil 80%)
2. `fetchAssets(place_id)` - **OBLIGATOIRE** pour photos/reviews complets

**Important** : searchText retourne des références photos limitées. fetchAssets retourne les URLs complètes et reviews détaillées.

**Output**: `{ found, place_id, name, rating, reviews: [...], photos: [{ url, ... }], openingHours, matchScore }`

### 4. PhotoAnalysisAgent
Analyse Gemini Vision (état local, travaux nécessaires)

**Tools**: `analyzePhotos`

**Output**: `{ analyzed, photos_count, condition, renovation_needed, cost_estimate }`

### 5. CompetitorAgent
Cartographie POI concurrentiels (rayon 200m, commerces uniquement)

**Tools**: `searchNearbyPOI`, `categorizePOI`

**Output**: `{ nearby_poi, total_competitors, density_level, market_assessment }`

**Fix 2025-12-26** : Radius réduit de 500m → 200m + filtrage sur 20+ types commerciaux (exclude parcs, transports, banques)

### 6. ValidationAgent
Validation croisée + détection conflits (6 types)

**Tools**: `crossValidateData`, `detectConflicts`

**Output**: `{ valid, coherence_score, total_conflicts, blocking_conflicts, conflicts: [...] }`

### 7. GapAnalysisAgent
Scoring multi-dimensionnel (0-100)

**Tools**: `calculateScores`, `assessRisks`

**Output**: `{ scores: { location, market, operational, financial, overall }, level, breakdown, risks }`

### 8. ArbitratorAgent
Résolution conflits détectés

**Tools**: `arbitrateConflict`

**Output**: `{ arbitrated, total_conflicts_arbitrated, resolutions: [...] }`

### 9. StrategicAgent
Recommandation GO/NO-GO finale (Gemini Thinking)

**Tools**: `generateRecommendation`

**Output**: `{ recommendation: "GO" | "NO-GO" | "GO_WITH_RESERVES", score, confidence, rationale }`

### 10. ReportAgent
Génération rapport HTML professionnel enrichi

**Tools**: `generateHTML`, `saveReport`

**Workflow** : generateHTML() → extraire .html → saveReport({ html, outputDir })

**Output**: `{ generated, filepath, filename, size_bytes, sections_included, summary }`

**Sections du rapport** (ordre d'affichage) :
1. Executive Summary - Recommandation GO/NO-GO, scores clés
2. Business Information - Identité, localisation, activité
3. 🏘️ **Présentation de la Commune** - Photo (Tavily), carte (Google Maps Static), données démographiques
4. 📸 **Photos du Commerce** - Galerie filtrée (max 6), annotations analyse Gemini Vision
5. 💼 **Historique BODACC** - Tableau dates/montants de rachats
6. 🕐 **Horaires d'Ouverture** - Tableau jours/horaires (traduit FR)
7. Scores Multi-Dimensionnels - Location, Market, Operational, Financial
8. Analyse des Risques - Catégorisés par sévérité
9. Analyse Stratégique - SWOT, rationale GO/NO-GO

## Détails Sections Enrichies du Rapport

### 🏘️ Présentation de la Commune (`generateCommuneSection`)

**Photo commune** : Récupérée via Tavily Search API (`include_images: true`, `search_depth: 'advanced'`)
- Query : `"${commune} France tourisme présentation ville photos"`
- Timeout : 8 secondes
- Fallback : Placeholder gris si pas d'image

**Carte** : Google Maps Static API avec marker rouge sur commerce
- URL : `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lon}&zoom=13&size=600x300&markers=color:red|${lat},${lon}&key=${PLACE_API_KEY}`
- Error handling : Messages clairs si API key manquante ou coordonnées invalides
- Fallback : SVG inline base64 avec `onerror` handler si image ne charge pas

**Description** : Combinaison données démographiques + description Tavily (300 caractères)

**Layout** : Grille 2 colonnes (photo | carte), responsive mobile 1 colonne

**Fix 2025-12-26** : Ajouté error handling robuste avec fallback SVG et messages diagnostics

### 📸 Photos du Commerce (`generatePhotosSection`)

**Source** : `places.photos[]` (récupérées par PlacesAgent → fetchAssets)

**Filtrage** : Photos avec dimensions ≥ 400px, max 6 photos

**Grille responsive** : 3 colonnes desktop, 1 colonne mobile

**Annotations IA** : Si `photo.analyzed = true`, badge sur première photo :
- Condition du local (`photo.condition`)
- Travaux nécessaires (`photo.renovation_needed`)
- Coût estimé (`photo.cost_estimate`)

**CSS** : `.photo-grid`, `.photo-card`, `.photo-badge`, `.photo-annotation`

### 💼 Historique BODACC (`generateBODACCTable`)

**Source** : `business.bodaccData[]` (enrichi par frontend BODACC service)

**Colonnes** : Date de parution | Montant du rachat

**Formatage** :
- Dates : DD/MM/YYYY (locale française)
- Montants : 125 000 € (séparateurs milliers)

**Tri** : Date décroissante (plus récent en premier)

**Parsing dates robuste** : Support ISO + DD/MM/YYYY formats

**Fallback** : Message "Aucun historique BODACC trouvé"

**Fix 2025-12-26** : Corrigé field name `bodacc` → `bodaccData` pour correspondre au frontend

### 🕐 Horaires d'Ouverture (`generateOpeningHoursTable`)

**Source** : `places.openingHours.weekdayDescriptions[]`

**Format input** : Array de strings `["Monday: 9 AM - 5 PM", ...]`

**Parsing** : `indexOf(':')` + `substring()` pour gérer multiple colons (ex: "lundi: 06:30 - 20:00")

**Traduction** : Jours EN → FR (Monday → Lundi, etc.)

**Détection fermeture** : Keyword matching "closed", "fermé" → Badge rouge

**Badge statut** : "Ouvert maintenant" / "Fermé actuellement" si `openNow` disponible

**Fallback** : Message "Horaires non disponibles"

**Fix 2025-12-26** : Corrigé parsing `split(':')` qui tronquait les horaires à cause des colons dans les heures

## State Management ADK

### Initial State
Passé via `stateDelta` dans `runner.runAsync()` (server.js:499)
- Structure: `{ business: BusinessInput, metadata: {...} }`
- Top-level keys accessibles directement dans instructions: `business.field`

### Lecture (Reading State)
- Top-level state: `business.siret`, `business.siege.commune`
- Agent outputs: `state.preparation.coordinates`, `state.demographic.score`
- Templates in instructions: Utiliser références explicites comme "depuis state.preparation.coordinates"

### Écriture (Writing State)
- Agents write via `outputKey`: `outputKey: 'preparation'` → `state.preparation`
- Output automatiquement merged into shared state by ADK

### Flux automatique
ADK gère automatiquement la propagation de state - pas de merge manuel

## Automatic JSON Parsing (Critical Fix)

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

## Pattern de Parsing dans les Tools (Critical)

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

## Gemini Vision avec responseMimeType (PhotoAnalysis)

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

## Pattern Critique pour Instructions d'Agents

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

## Pattern ADK Officiel

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

## Logs Détaillés du Pipeline

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

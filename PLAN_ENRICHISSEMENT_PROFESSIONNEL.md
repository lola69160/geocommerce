# Plan d'Enrichissement Professionnel SearchCommerce
## Rapport Expert pour Rachat de Commerces

---

## 1. Analyse Critique des Besoins (Point de vue Expert Rachat)

### ✅ Éléments Pertinents Demandés

| Besoin | Impact Due Diligence | Priorité | Difficulté |
|--------|---------------------|----------|-----------|
| Analyse CSP population | ⭐⭐⭐⭐⭐ Essentiel pour ciblage clientèle | P0 | Moyenne |
| Photos + analyse travaux | ⭐⭐⭐⭐⭐ Impact direct investissement | P0 | Faible |
| Historique BODACC (prix/dates) | ⭐⭐⭐⭐ Benchmark valorisation | P0 | Faible (déjà fait) |
| Projets commune/mairie | ⭐⭐⭐⭐ Anticipation évolution zone | P1 | Élevée |
| Analyse concurrence locale | ⭐⭐⭐⭐ Évaluation saturation marché | P0 | Moyenne |
| Avis clients significatifs | ⭐⭐⭐ E-réputation et qualité service | P1 | Faible |
| Horaires d'ouverture | ⭐⭐⭐ Analyse exploitation actuelle | P2 | Faible (déjà fait) |
| Commerces identiques zone | ⭐⭐⭐⭐ Risque cannibalisation | P0 | Faible |

### ⚠️ Manques Critiques à Considérer (Non Demandés mais Recommandés)

**Données financières** (Hors scope API publiques):
- Chiffre d'affaires et évolution
- Marges et rentabilité
- Charges et masse salariale
- → **Recommandation**: Ajouter section "Données à collecter vendeur" dans rapport

**Analyse juridique**:
- Bail commercial (durée, loyer, charges, clauses)
- Autorisations d'exploitation (licence IV, ERP, etc.)
- → **Recommandation**: Checklist juridique en annexe rapport

**Saisonnalité et flux**:
- Analyse par mois/jour/heure
- → **Recommandation**: Utiliser Google Places Popular Times API

**Potentiel développement**:
- Synergies possibles
- Diversification activité
- → **Recommandation**: Section "Opportunités" avec Gemini reasoning

---

## 2. Architecture Proposée : Multi-Agent Pipeline

### Inspiration Repository ADK

Le repository `retail-ai-location-strategy` démontre une architecture **multi-agent séquentielle** particulièrement adaptée à votre besoin :

```
Pipeline Enrichissement Professionnel
├── 1. PreparationAgent          (Parsing + déduplication adresses)
├── 2. DemographicResearchAgent  (Recherche web CSP + projets commune)
├── 3. PlacesEnrichmentAgent     (Photos, reviews, hours, popular times)
├── 4. PhotoAnalysisAgent        (Gemini Vision pour analyse travaux)
├── 5. CompetitorMappingAgent    (POI alentour + concurrence identique)
├── 6. GapAnalysisAgent          (Scoring attractivité quantitatif)
├── 7. StrategicSynthesisAgent   (Gemini Extended Reasoning)
└── 8. ProfessionalReportAgent   (HTML/Markdown rapport expert)
```

### Patterns ADK Réutilisables

#### ✅ Pattern 1: State Injection
```javascript
// Chaque agent lit/écrit dans un state partagé
const sharedState = {
  business: { siren, name, address, nafCode },
  bodaccRecords: [...],
  placeDetails: {...},
  demographics: {...},
  competitors: [...],
  attractivenessScore: 0-100,
  strategicRecommendation: "..."
}
```

#### ✅ Pattern 2: Structured Output (Pydantic-like)
```typescript
interface EnrichmentReport {
  business: BusinessIdentity;
  location: LocationAnalysis;
  demographics: DemographicProfile;
  competition: CompetitionAnalysis;
  physical: PhysicalStateAnalysis;
  reputation: ReputationAnalysis;
  bodacc: BODACCHistorique;
  synthesis: StrategicRecommendation;
  score: OverallScore;
}
```

#### ✅ Pattern 3: Extended Reasoning pour Synthèse
```javascript
// Utiliser Gemini avec thinking mode illimité
const synthesis = await gemini.generateContent({
  model: "gemini-2.0-flash-thinking-exp",
  contents: [{
    role: "user",
    parts: [{ text: `
      Synthétise toutes les données pour une recommandation expert :
      - Demographics: ${demographics}
      - Competition: ${competition}
      - BODACC: ${bodacc}
      - Photos: ${photoAnalysis}
      Fournis une recommandation GO/NO-GO avec score et arguments.
    `}]
  }],
  generationConfig: {
    thinkingBudget: -1 // Illimité
  }
})
```

#### ✅ Pattern 4: Callbacks Progress Tracking
```javascript
// Afficher progression enrichissement en temps réel
const progressCallbacks = {
  beforeAgent: (agentName) => {
    updateUI({ stage: agentName, status: 'in_progress' });
  },
  afterAgent: (agentName, result) => {
    updateUI({ stage: agentName, status: 'completed', data: result });
  }
}
```

---

## 3. Détail des Agents à Implémenter

### Agent 1: PreparationAgent
**Objectif**: Normaliser et préparer les données d'entrée

**Input**:
- Business from OpenData API (siren, siret, name, address, nafCode)
- Existing cart notes

**Processing**:
```javascript
// 1. Normaliser adresse (déjà fait partiellement dans bodaccService.js)
const normalizedAddress = parseAddress(business.address);

// 2. Déduplication (éviter enrichissement multiple même commerce)
const cacheKey = `${business.siren}_${normalizedAddress.zipCode}`;
if (cache.has(cacheKey)) return cache.get(cacheKey);

// 3. Initialiser state partagé
return {
  businessId: business.siren,
  normalizedAddress,
  searchRadius: 500, // mètres
  cacheKey
};
```

**Output State**:
```typescript
{
  businessId: string,
  normalizedAddress: ParsedAddress,
  searchParams: { radius: number, location: LatLng }
}
```

**Difficulté**: ⭐ Faible (code existant réutilisable)

---

### Agent 2: DemographicResearchAgent
**Objectif**: Analyser population et projets d'urbanisme

**Inspiration**: `MarketResearchAgent` du repo ADK (utilise google_search)

**Data Sources**:
1. **Web Search** (Google Search API ou scraping):
   - Requête: `"${commune}" CSP population INSEE 2024`
   - Requête: `"${commune}" "projet commercial" OR "aménagement" OR "construction" 2024`
   - Requête: `"${commune}" "zone d'activité" OR "centre commercial"`

2. **APIs Publiques Françaises**:
   - **INSEE API**: https://api.insee.fr/catalogue/
     - Population par commune
     - Revenu médian par UC
     - Taux chômage
   - **data.gouv.fr**:
     - Base Sirene Géolocalisée
     - Observatoire des territoires

3. **OpenStreetMap Overpass API**:
   - Projets construction récents (building=construction)
   - Infrastructures (schools, hospitals, transport)

**Processing avec Gemini**:
```javascript
const demographicAnalysis = await gemini.generateContent({
  model: "gemini-2.0-flash-exp",
  contents: [{
    role: "user",
    parts: [{ text: `
      Analyse les données démographiques suivantes et fournis un profil CSP :

      DONNÉES INSEE:
      ${inseeData}

      RÉSULTATS WEB SEARCH:
      ${webSearchResults}

      PROJETS URBANISME TROUVÉS:
      ${urbanProjects}

      Fournis au format JSON:
      {
        "csp_dominante": "CSP+/CSP/CSP-",
        "revenus": { "median": number, "niveau": "élevé/moyen/faible" },
        "population": { "total": number, "densite": number, "evolution": "croissance/stable/déclin" },
        "age_median": number,
        "projets_urbanisme": [
          { "type": "construction/aménagement", "description": string, "impact_commerce": "positif/neutre/négatif", "echeance": string }
        ],
        "attractivite_score": 0-100,
        "synthese": "Résumé 2-3 phrases"
      }
    `}]
  }],
  generationConfig: {
    responseMimeType: "application/json"
  }
});
```

**Output State**:
```typescript
{
  demographics: {
    csp_dominante: "CSP+" | "CSP" | "CSP-",
    revenus: { median: number, niveau: string },
    population: { total: number, densite: number, evolution: string },
    age_median: number,
    projets_urbanisme: Array<{
      type: string,
      description: string,
      impact_commerce: "positif" | "neutre" | "négatif",
      echeance: string
    }>,
    attractivite_score: number,
    synthese: string
  }
}
```

**Challenges**:
- ⚠️ **Pas d'API publique directe pour CSP par commune** → Nécessite croisement INSEE revenus + web search
- ⚠️ **Projets urbanisme fragmentés** → Multiples sources (mairie, data.gouv, presse locale)
- ⚠️ **Rate limits INSEE API** → Cache 90 jours

**Alternative Low-Tech**:
- Utiliser uniquement revenus médian INSEE comme proxy CSP
- Limiter projets à web search + Gemini extraction

**Difficulté**: ⭐⭐⭐⭐ Élevée (sources dispersées, pas d'API unifiée)

---

### Agent 3: PlacesEnrichmentAgent
**Objectif**: Enrichir avec Google Places (photos, reviews, hours, popular times)

**Status Actuel**: ✅ Partiellement implémenté
- `server/services/placesService.js` : scoring multi-résultats
- `src/services/placesService.js` : client-side API

**Améliorations à Apporter**:

#### 3.1 Popular Times API
```javascript
// Ajouter dans server/services/placesService.js
async function getPopularTimes(placeId) {
  // Google Places ne fournit pas Popular Times via API officielle
  // Options:
  // 1. Utiliser populartimes library (scraping Google Maps)
  // 2. Utiliser Outscraper API (payant, fiable)
  // 3. Parser manuellement via Playwright/Puppeteer

  // Recommandation: Outscraper API
  const response = await fetch('https://api.outscraper.com/maps/search-v2', {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.OUTSCRAPER_API_KEY
    },
    body: JSON.stringify({
      query: placeId,
      fields: 'popular_times,time_spent'
    })
  });

  return response.json();
}
```

#### 3.2 Enhanced Photo Retrieval
```javascript
// Récupérer TOUTES les photos (pas seulement 1-2)
async function getAllPhotos(placeId) {
  const place = await placesClient.getDetails({
    placeId,
    fields: ['photos']
  });

  // Télécharger photos haute résolution
  const photoUrls = await Promise.all(
    place.photos.map(photo =>
      placesClient.getPhotoUrl({
        photoReference: photo.photoReference,
        maxWidth: 1600, // Haute résolution pour analyse Gemini
        maxHeight: 1200
      })
    )
  );

  return photoUrls;
}
```

#### 3.3 Reviews Filtering
```javascript
// Extraire reviews "significatifs" (pas tous)
function filterSignificantReviews(reviews) {
  // Critères:
  // - Rating extrême (1-2 ou 5 étoiles)
  // - Longueur > 50 caractères
  // - Mentions mots-clés (travaux, rénovation, accueil, propreté)
  // - Recent (< 1 an)

  return reviews
    .filter(r => (r.rating <= 2 || r.rating >= 5) && r.text.length > 50)
    .filter(r => {
      const age = Date.now() - new Date(r.time).getTime();
      return age < 365 * 24 * 60 * 60 * 1000; // < 1 an
    })
    .sort((a, b) => b.text.length - a.text.length) // Plus détaillés en premier
    .slice(0, 10); // Max 10 avis
}
```

**Output State**:
```typescript
{
  placeDetails: {
    placeId: string,
    photos: string[], // URLs
    reviews: Array<{
      rating: number,
      text: string,
      time: string,
      authorName: string
    }>,
    openingHours: {
      weekdayText: string[],
      periods: Array<{day: number, open: string, close: string}>
    },
    popularTimes: Array<{
      day: string,
      hours: number[], // 0-23, valeur 0-100 pour chaque heure
      peak_hour: number
    }>,
    rating: number,
    userRatingsTotal: number
  }
}
```

**Difficulté**: ⭐⭐ Moyenne (Popular Times nécessite API tierce ou scraping)

---

### Agent 4: PhotoAnalysisAgent
**Objectif**: Analyser photos avec Gemini Vision pour évaluer état et travaux

**Inspiration**: `InfographicGeneratorAgent` (utilise Gemini image generation)

**Processing**:
```javascript
async function analyzeBusinessPhotos(photoUrls) {
  // Limiter à 5-10 photos pour éviter coût API
  const selectedPhotos = selectRepresentativePhotos(photoUrls, maxCount: 8);

  // Télécharger images en base64
  const images = await Promise.all(
    selectedPhotos.map(url => fetchAsBase64(url))
  );

  // Analyse multi-images avec Gemini 2.0 Flash
  const analysis = await gemini.generateContent({
    model: "gemini-2.0-flash-exp",
    contents: [{
      role: "user",
      parts: [
        ...images.map(base64 => ({
          inlineData: { mimeType: "image/jpeg", data: base64 }
        })),
        { text: `
          Tu es un expert en aménagement de commerces.
          Analyse ces photos d'un ${businessType} pour évaluer :

          1. ÉTAT GÉNÉRAL
             - Devanture (vitrine, enseigne, éclairage)
             - Intérieur (sols, murs, plafond, éclairage)
             - Mobilier et équipement
             - Propreté et entretien

          2. TRAVAUX À PRÉVOIR
             - Urgents (sécurité, conformité)
             - Recommandés (attractivité, modernisation)
             - Optionnels (optimisation)

          3. ESTIMATION BUDGET TRAVAUX
             - Fourchette basse/haute en €
             - Détail par poste (peinture, vitrine, sol, etc.)

          4. POINTS FORTS / FAIBLES
             - 3 points forts visuels
             - 3 points faibles à améliorer

          Fournis une réponse JSON structurée.
        `}
      ]
    }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          etat_general: {
            type: "object",
            properties: {
              devanture: { type: "string", enum: ["excellent", "bon", "moyen", "mauvais"] },
              interieur: { type: "string", enum: ["excellent", "bon", "moyen", "mauvais"] },
              equipement: { type: "string", enum: ["moderne", "correct", "vieillissant", "obsolete"] },
              note_globale: { type: "number", minimum: 0, maximum: 10 }
            }
          },
          travaux: {
            type: "object",
            properties: {
              urgents: { type: "array", items: { type: "string" } },
              recommandes: { type: "array", items: { type: "string" } },
              optionnels: { type: "array", items: { type: "string" } }
            }
          },
          budget_travaux: {
            type: "object",
            properties: {
              fourchette_basse: { type: "number" },
              fourchette_haute: { type: "number" },
              detail_postes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    poste: { type: "string" },
                    montant: { type: "number" },
                    priorite: { type: "string", enum: ["urgente", "recommandée", "optionnelle"] }
                  }
                }
              }
            }
          },
          points_forts: { type: "array", items: { type: "string" }, maxItems: 3 },
          points_faibles: { type: "array", items: { type: "string" }, maxItems: 3 },
          synthese: { type: "string" }
        },
        required: ["etat_general", "travaux", "budget_travaux", "points_forts", "points_faibles", "synthese"]
      }
    }
  });

  return JSON.parse(analysis.response.text());
}
```

**Optimisations**:
- ✅ **Sélection intelligente photos**: Façade > Intérieur > Détails
- ✅ **Compression images**: Réduire à 800x600 avant envoi API (économie tokens)
- ✅ **Cache résultats**: Par placeId (TTL 30 jours)

**Output State**:
```typescript
{
  photoAnalysis: {
    etat_general: {
      devanture: "excellent" | "bon" | "moyen" | "mauvais",
      interieur: "excellent" | "bon" | "moyen" | "mauvais",
      equipement: "moderne" | "correct" | "vieillissant" | "obsolete",
      note_globale: number // 0-10
    },
    travaux: {
      urgents: string[],
      recommandes: string[],
      optionnels: string[]
    },
    budget_travaux: {
      fourchette_basse: number,
      fourchette_haute: number,
      detail_postes: Array<{
        poste: string,
        montant: number,
        priorite: "urgente" | "recommandée" | "optionnelle"
      }>
    },
    points_forts: string[3],
    points_faibles: string[3],
    synthese: string
  }
}
```

**Difficulté**: ⭐⭐ Moyenne (API Gemini Vision simple, schema JSON structuré)

---

### Agent 5: CompetitorMappingAgent
**Objectif**: Cartographier concurrence et POI alentour

**Inspiration**: `CompetitorMappingAgent` du repo ADK (utilise Google Maps Places)

**Status Actuel**: ❌ Non implémenté (seulement enrichissement business individuel)

**Implementation**:

#### 5.1 Recherche Concurrence Identique
```javascript
async function findIdenticalCompetitors(business, radius = 1000) {
  // Rechercher commerces même NAF code dans rayon
  const competitors = await placesClient.nearbySearch({
    location: business.coordinates,
    radius,
    type: getNafTypePlaces(business.nafCode), // Mapper NAF → Google Places type
    keyword: extractBusinessKeyword(business.activity)
  });

  // Filtrer vrais concurrents (même activité)
  const identicalCompetitors = competitors.filter(c =>
    c.placeId !== business.placeId &&
    isSameActivity(c.types, business.nafCode)
  );

  return identicalCompetitors;
}
```

#### 5.2 Analyse POI Alentour
```javascript
async function analyzeNearbyPOI(location, radius = 500) {
  // Chercher points d'intérêt générateurs de flux
  const poiTypes = [
    'school', 'university', 'hospital', 'train_station', 'bus_station',
    'shopping_mall', 'supermarket', 'park', 'gym', 'restaurant',
    'bank', 'post_office', 'pharmacy'
  ];

  const poiByType = {};

  for (const type of poiTypes) {
    const results = await placesClient.nearbySearch({
      location,
      radius,
      type
    });

    poiByType[type] = {
      count: results.length,
      closest: results[0] ? calculateDistance(location, results[0].location) : null,
      names: results.slice(0, 3).map(r => r.name)
    };
  }

  return poiByType;
}
```

#### 5.3 Scoring Attractivité Zone
```javascript
function calculateZoneAttractivenessScore(competitors, poi) {
  // Système de scoring inspiré de GapAnalysisAgent ADK

  const scores = {
    // Saturation concurrence (plus il y a de concurrents, moins bon)
    saturation: Math.max(0, 100 - (competitors.identicalCount * 10)), // -10 pts par concurrent

    // Qualité concurrence (si concurrents mal notés, opportunité)
    quality_gap: competitors.averageRating < 4.0 ? 80 :
                 competitors.averageRating < 4.3 ? 50 : 30,

    // Générateurs de flux (écoles, transports, centres commerciaux)
    foot_traffic: calculateFootTrafficScore(poi),

    // Accessibilité (transports, parking)
    accessibility: calculateAccessibilityScore(poi),

    // Diversité commerciale (zone vivante vs déserte)
    commercial_diversity: Object.keys(poi).filter(k => poi[k].count > 0).length * 5
  };

  // Moyenne pondérée
  const overall = (
    scores.saturation * 0.30 +
    scores.quality_gap * 0.25 +
    scores.foot_traffic * 0.25 +
    scores.accessibility * 0.10 +
    scores.commercial_diversity * 0.10
  );

  return {
    overall: Math.round(overall),
    details: scores,
    category: overall >= 75 ? "TRÈS ATTRACTIF" :
              overall >= 50 ? "ATTRACTIF" :
              overall >= 30 ? "MODÉRÉ" : "PEU ATTRACTIF"
  };
}
```

**Output State**:
```typescript
{
  competition: {
    identical_competitors: Array<{
      name: string,
      address: string,
      distance: number,
      rating: number,
      reviews_count: number,
      price_level: number
    }>,
    count: number,
    average_rating: number,
    closest_distance: number
  },
  nearby_poi: {
    [type: string]: {
      count: number,
      closest: number,
      names: string[]
    }
  },
  attractiveness: {
    overall_score: number,
    category: string,
    details: {
      saturation: number,
      quality_gap: number,
      foot_traffic: number,
      accessibility: number,
      commercial_diversity: number
    }
  }
}
```

**Difficulté**: ⭐⭐⭐ Moyenne-Élevée (multiples requêtes Places API, scoring complexe)

---

### Agent 6: GapAnalysisAgent
**Objectif**: Analyse quantitative et scoring global

**Inspiration**: `GapAnalysisAgent` du repo ADK (Python code execution avec pandas)

**Alternative JavaScript**:
```javascript
function performGapAnalysis(state) {
  const {
    demographics,
    competition,
    photoAnalysis,
    bodaccRecords,
    placeDetails
  } = state;

  // Calcul scoring multi-critères
  const scores = {
    // 1. Démographie (25%)
    demographic_score: calculateDemographicScore(demographics),

    // 2. Concurrence (20%)
    competition_score: competition.attractiveness.overall_score,

    // 3. État physique (15%)
    physical_score: (photoAnalysis.etat_general.note_globale / 10) * 100,

    // 4. Réputation (15%)
    reputation_score: placeDetails.rating ? (placeDetails.rating / 5) * 100 : 50,

    // 5. Historique BODACC (15%)
    bodacc_score: calculateBODACCScore(bodaccRecords),

    // 6. Projets urbanisme (10%)
    urban_projects_score: calculateUrbanProjectsScore(demographics.projets_urbanisme)
  };

  // Score global pondéré
  const globalScore = (
    scores.demographic_score * 0.25 +
    scores.competition_score * 0.20 +
    scores.physical_score * 0.15 +
    scores.reputation_score * 0.15 +
    scores.bodacc_score * 0.15 +
    scores.urban_projects_score * 0.10
  );

  // Catégorisation
  const recommendation = globalScore >= 70 ? "OPPORTUNITÉ FORTE" :
                        globalScore >= 50 ? "OPPORTUNITÉ MODÉRÉE" :
                        globalScore >= 30 ? "PRUDENCE" : "DÉCONSEILLÉ";

  return {
    global_score: Math.round(globalScore),
    recommendation,
    scores_detail: scores,
    strengths: identifyStrengths(scores),
    weaknesses: identifyWeaknesses(scores),
    risk_level: globalScore >= 60 ? "FAIBLE" :
                globalScore >= 40 ? "MODÉRÉ" : "ÉLEVÉ"
  };
}

function calculateDemographicScore(demographics) {
  const cspScore = {
    "CSP+": 90,
    "CSP": 70,
    "CSP-": 40
  }[demographics.csp_dominante] || 50;

  const evolutionScore = {
    "croissance": 100,
    "stable": 70,
    "déclin": 30
  }[demographics.population.evolution] || 50;

  return (cspScore * 0.6 + evolutionScore * 0.4);
}

function calculateBODACCScore(bodaccRecords) {
  if (!bodaccRecords || bodaccRecords.length === 0) return 50; // Neutre

  // Analyser tendance prix et fréquence rachats
  const recentRecords = bodaccRecords.filter(r =>
    new Date(r.date_parution) > new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000)
  );

  if (recentRecords.length === 0) return 60; // Pas de rachat récent = stable

  // Si beaucoup de rachats récents = zone instable
  if (recentRecords.length > 3) return 30;

  // Si 1-2 rachats = activité normale
  return 50;
}

function calculateUrbanProjectsScore(projects) {
  if (!projects || projects.length === 0) return 50;

  const positiveProjects = projects.filter(p => p.impact_commerce === "positif");
  const negativeProjects = projects.filter(p => p.impact_commerce === "négatif");

  return 50 + (positiveProjects.length * 20) - (negativeProjects.length * 15);
}
```

**Output State**:
```typescript
{
  gapAnalysis: {
    global_score: number,
    recommendation: "OPPORTUNITÉ FORTE" | "OPPORTUNITÉ MODÉRÉE" | "PRUDENCE" | "DÉCONSEILLÉ",
    scores_detail: {
      demographic_score: number,
      competition_score: number,
      physical_score: number,
      reputation_score: number,
      bodacc_score: number,
      urban_projects_score: number
    },
    strengths: string[],
    weaknesses: string[],
    risk_level: "FAIBLE" | "MODÉRÉ" | "ÉLEVÉ"
  }
}
```

**Difficulté**: ⭐⭐ Moyenne (logique JavaScript, pas de dépendance Python)

---

### Agent 7: StrategicSynthesisAgent
**Objectif**: Synthèse stratégique avec Extended Reasoning

**Inspiration**: `StrategyAdvisorAgent` du repo ADK (Gemini Thinking mode)

**Implementation**:
```javascript
async function generateStrategicSynthesis(state) {
  const {
    business,
    demographics,
    competition,
    photoAnalysis,
    placeDetails,
    bodaccRecords,
    gapAnalysis
  } = state;

  // Préparer contexte complet pour Gemini
  const context = `
    BUSINESS À ANALYSER:
    - SIREN: ${business.siren}
    - Nom: ${business.name}
    - Activité: ${business.nafCode} - ${business.activity}
    - Adresse: ${business.address}

    DÉMOGRAPHIE:
    ${JSON.stringify(demographics, null, 2)}

    CONCURRENCE:
    ${JSON.stringify(competition, null, 2)}

    ÉTAT PHYSIQUE:
    ${JSON.stringify(photoAnalysis, null, 2)}

    RÉPUTATION:
    - Note Google: ${placeDetails.rating}/5 (${placeDetails.userRatingsTotal} avis)
    - Avis significatifs: ${placeDetails.reviews.slice(0, 3).map(r => `"${r.text}" (${r.rating}⭐)`).join('\n')}

    HISTORIQUE BODACC:
    ${bodaccRecords.map(r => `- ${r.type} le ${r.date_parution} (${r.capital || 'N/A'})`).join('\n')}

    SCORING GLOBAL:
    ${JSON.stringify(gapAnalysis, null, 2)}
  `;

  const synthesis = await gemini.generateContent({
    model: "gemini-2.0-flash-thinking-exp",
    contents: [{
      role: "user",
      parts: [{ text: `
        Tu es un expert en rachat de commerces avec 20 ans d'expérience.
        Analyse ces données et fournis une SYNTHÈSE STRATÉGIQUE complète.

        ${context}

        CONSIGNES:
        1. Analyse critique et objective (pas de langue de bois)
        2. Recommandation GO/NO-GO argumentée
        3. Points de vigilance juridiques/financiers
        4. Estimation valeur rachat (fourchette)
        5. Plan d'action si GO (3 priorités immédiates)
        6. Données complémentaires à collecter auprès du vendeur

        Fournis une réponse JSON structurée selon le schema.
      `}]
    }],
    generationConfig: {
      thinkingBudget: -1, // Reasoning illimité
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          decision: {
            type: "string",
            enum: ["GO - Opportunité forte", "GO avec réserves", "ATTENDRE - Données insuffisantes", "NO-GO"]
          },
          score_confiance: {
            type: "number",
            minimum: 0,
            maximum: 100,
            description: "Confiance dans la recommandation"
          },
          synthese_executive: {
            type: "string",
            description: "Résumé 3-5 lignes pour décideur"
          },
          arguments_pour: {
            type: "array",
            items: { type: "string" },
            minItems: 3,
            maxItems: 5
          },
          arguments_contre: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            maxItems: 5
          },
          points_vigilance: {
            type: "array",
            items: {
              type: "object",
              properties: {
                categorie: { type: "string", enum: ["Juridique", "Financier", "Technique", "Commercial", "RH"] },
                point: { type: "string" },
                criticite: { type: "string", enum: ["Bloquant", "Majeur", "Mineur"] }
              }
            }
          },
          estimation_valeur: {
            type: "object",
            properties: {
              fourchette_basse: { type: "number" },
              fourchette_haute: { type: "number" },
              methode: { type: "string" },
              hypotheses: { type: "array", items: { type: "string" } }
            }
          },
          plan_action: {
            type: "array",
            items: {
              type: "object",
              properties: {
                priorite: { type: "number", minimum: 1, maximum: 3 },
                action: { type: "string" },
                delai: { type: "string" },
                ressources: { type: "string" }
              }
            },
            minItems: 3,
            maxItems: 3
          },
          donnees_complementaires: {
            type: "array",
            items: { type: "string" },
            description: "Données à demander au vendeur"
          }
        },
        required: [
          "decision", "score_confiance", "synthese_executive",
          "arguments_pour", "arguments_contre", "points_vigilance",
          "estimation_valeur", "plan_action", "donnees_complementaires"
        ]
      }
    }
  });

  return JSON.parse(synthesis.response.text());
}
```

**Output State**:
```typescript
{
  strategicSynthesis: {
    decision: "GO - Opportunité forte" | "GO avec réserves" | "ATTENDRE - Données insuffisantes" | "NO-GO",
    score_confiance: number,
    synthese_executive: string,
    arguments_pour: string[],
    arguments_contre: string[],
    points_vigilance: Array<{
      categorie: "Juridique" | "Financier" | "Technique" | "Commercial" | "RH",
      point: string,
      criticite: "Bloquant" | "Majeur" | "Mineur"
    }>,
    estimation_valeur: {
      fourchette_basse: number,
      fourchette_haute: number,
      methode: string,
      hypotheses: string[]
    },
    plan_action: Array<{
      priorite: 1 | 2 | 3,
      action: string,
      delai: string,
      ressources: string
    }>,
    donnees_complementaires: string[]
  }
}
```

**Difficulté**: ⭐⭐ Moyenne (API Gemini Thinking + structured output)

---

### Agent 8: ProfessionalReportAgent
**Objectif**: Générer rapport HTML/Markdown professionnel

**Inspiration**: `ReportGeneratorAgent` du repo ADK (HTML slide deck style McKinsey)

**Format Proposé**: HTML interactif avec sections collapsibles

**Structure Rapport**:
```html
<!DOCTYPE html>
<html>
<head>
  <title>Rapport Due Diligence - ${business.name}</title>
  <style>
    /* Style professionnel inspiré McKinsey/BCG */
    body { font-family: 'Segoe UI', sans-serif; }
    .slide { page-break-after: always; padding: 40px; }
    .score-badge { font-size: 48px; font-weight: bold; }
    .green { color: #22c55e; }
    .orange { color: #f97316; }
    .red { color: #ef4444; }
    .chart { /* Charts.js ou simple SVG */ }
  </style>
</head>
<body>

<!-- Slide 1: Executive Summary -->
<div class="slide">
  <h1>Rapport Due Diligence</h1>
  <h2>${business.name}</h2>

  <div class="score-badge ${getScoreColor(gapAnalysis.global_score)}">
    ${gapAnalysis.global_score}/100
  </div>

  <h3>Recommandation: ${strategicSynthesis.decision}</h3>

  <p>${strategicSynthesis.synthese_executive}</p>

  <table>
    <tr><th>Score Confiance</th><td>${strategicSynthesis.score_confiance}%</td></tr>
    <tr><th>Risque</th><td>${gapAnalysis.risk_level}</td></tr>
    <tr><th>Estimation Valeur</th><td>${formatCurrency(strategicSynthesis.estimation_valeur.fourchette_basse)} - ${formatCurrency(strategicSynthesis.estimation_valeur.fourchette_haute)}</td></tr>
  </table>
</div>

<!-- Slide 2: Fiche Identité Commerce -->
<div class="slide">
  <h2>1. Identité du Commerce</h2>

  <table>
    <tr><th>SIREN</th><td>${business.siren}</td></tr>
    <tr><th>Activité</th><td>${business.activity} (${business.nafCode})</td></tr>
    <tr><th>Adresse</th><td>${business.address}</td></tr>
    <tr><th>Note Google</th><td>${placeDetails.rating} ⭐ (${placeDetails.userRatingsTotal} avis)</td></tr>
  </table>

  <h3>Horaires d'Ouverture</h3>
  <ul>
    ${placeDetails.openingHours.weekdayText.map(h => `<li>${h}</li>`).join('')}
  </ul>

  <h3>Photos du Commerce</h3>
  <div class="photo-grid">
    ${placeDetails.photos.slice(0, 6).map(url => `<img src="${url}" width="200"/>`).join('')}
  </div>
</div>

<!-- Slide 3: Analyse Démographique -->
<div class="slide">
  <h2>2. Analyse Démographique et Urbanisme</h2>

  <h3>Profil Population</h3>
  <table>
    <tr><th>CSP Dominante</th><td>${demographics.csp_dominante}</td></tr>
    <tr><th>Revenu Médian</th><td>${formatCurrency(demographics.revenus.median)}</td></tr>
    <tr><th>Population Totale</th><td>${demographics.population.total.toLocaleString()}</td></tr>
    <tr><th>Évolution</th><td>${demographics.population.evolution}</td></tr>
    <tr><th>Âge Médian</th><td>${demographics.age_median} ans</td></tr>
  </table>

  <h3>Projets d'Urbanisme</h3>
  ${demographics.projets_urbanisme.length > 0 ? `
    <table>
      <thead>
        <tr><th>Type</th><th>Description</th><th>Impact Commerce</th><th>Échéance</th></tr>
      </thead>
      <tbody>
        ${demographics.projets_urbanisme.map(p => `
          <tr>
            <td>${p.type}</td>
            <td>${p.description}</td>
            <td class="${p.impact_commerce === 'positif' ? 'green' : p.impact_commerce === 'négatif' ? 'red' : ''}">${p.impact_commerce}</td>
            <td>${p.echeance}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : '<p>Aucun projet d\'urbanisme identifié.</p>'}
</div>

<!-- Slide 4: État Physique et Travaux -->
<div class="slide">
  <h2>3. État Physique et Travaux à Prévoir</h2>

  <h3>Évaluation Globale: ${photoAnalysis.etat_general.note_globale}/10</h3>

  <table>
    <tr><th>Devanture</th><td>${photoAnalysis.etat_general.devanture}</td></tr>
    <tr><th>Intérieur</th><td>${photoAnalysis.etat_general.interieur}</td></tr>
    <tr><th>Équipement</th><td>${photoAnalysis.etat_general.equipement}</td></tr>
  </table>

  <h3>Budget Travaux Estimé</h3>
  <p class="budget-estimate">
    ${formatCurrency(photoAnalysis.budget_travaux.fourchette_basse)} - ${formatCurrency(photoAnalysis.budget_travaux.fourchette_haute)}
  </p>

  <h4>Détail par Poste</h4>
  <table>
    <thead><tr><th>Poste</th><th>Montant</th><th>Priorité</th></tr></thead>
    <tbody>
      ${photoAnalysis.budget_travaux.detail_postes.map(p => `
        <tr>
          <td>${p.poste}</td>
          <td>${formatCurrency(p.montant)}</td>
          <td class="${p.priorite === 'urgente' ? 'red' : p.priorite === 'recommandée' ? 'orange' : ''}">${p.priorite}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <h3>Points Forts / Faibles</h3>
  <div class="columns">
    <div class="column">
      <h4>✅ Points Forts</h4>
      <ul>${photoAnalysis.points_forts.map(p => `<li>${p}</li>`).join('')}</ul>
    </div>
    <div class="column">
      <h4>⚠️ Points Faibles</h4>
      <ul>${photoAnalysis.points_faibles.map(p => `<li>${p}</li>`).join('')}</ul>
    </div>
  </div>
</div>

<!-- Slide 5: Concurrence et Attractivité -->
<div class="slide">
  <h2>4. Analyse Concurrence et Attractivité Zone</h2>

  <h3>Score Attractivité: ${competition.attractiveness.overall_score}/100</h3>
  <p>Catégorie: <strong>${competition.attractiveness.category}</strong></p>

  <h4>Détail Scoring</h4>
  <table>
    <tr><th>Critère</th><th>Score</th></tr>
    ${Object.entries(competition.attractiveness.details).map(([k, v]) => `
      <tr><td>${k}</td><td>${v}/100</td></tr>
    `).join('')}
  </table>

  <h3>Concurrents Identiques (rayon 1km)</h3>
  <p>Nombre total: <strong>${competition.count}</strong></p>
  <p>Plus proche: <strong>${competition.closest_distance}m</strong></p>

  ${competition.identical_competitors.length > 0 ? `
    <table>
      <thead><tr><th>Nom</th><th>Distance</th><th>Note</th><th>Avis</th></tr></thead>
      <tbody>
        ${competition.identical_competitors.slice(0, 10).map(c => `
          <tr>
            <td>${c.name}</td>
            <td>${c.distance}m</td>
            <td>${c.rating} ⭐</td>
            <td>${c.reviews_count}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : '<p>Aucun concurrent direct identifié.</p>'}

  <h3>Points d'Intérêt Alentour (500m)</h3>
  <table>
    <thead><tr><th>Type</th><th>Nombre</th><th>Plus Proche</th></tr></thead>
    <tbody>
      ${Object.entries(nearby_poi).filter(([_, v]) => v.count > 0).map(([type, data]) => `
        <tr>
          <td>${type}</td>
          <td>${data.count}</td>
          <td>${data.closest}m</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</div>

<!-- Slide 6: Réputation et Avis Clients -->
<div class="slide">
  <h2>5. Réputation et Avis Clients</h2>

  <h3>Note Globale: ${placeDetails.rating}/5 ⭐</h3>
  <p>${placeDetails.userRatingsTotal} avis au total</p>

  <h3>Avis Significatifs</h3>
  ${placeDetails.reviews.map(r => `
    <div class="review">
      <p><strong>${r.authorName}</strong> - ${r.rating} ⭐ - ${formatDate(r.time)}</p>
      <p>"${r.text}"</p>
    </div>
  `).join('')}
</div>

<!-- Slide 7: Historique BODACC -->
<div class="slide">
  <h2>6. Historique Rachats BODACC</h2>

  ${bodaccRecords.length > 0 ? `
    <p>${bodaccRecords.length} annonce(s) trouvée(s)</p>

    <table>
      <thead>
        <tr><th>Date</th><th>Type</th><th>Capital</th><th>Description</th></tr>
      </thead>
      <tbody>
        ${bodaccRecords.sort((a, b) => new Date(b.date_parution) - new Date(a.date_parution)).map(r => `
          <tr>
            <td>${formatDate(r.date_parution)}</td>
            <td>${r.type}</td>
            <td>${r.capital || 'N/A'}</td>
            <td>${r.description}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : '<p>Aucune annonce BODACC trouvée pour cette adresse.</p>'}
</div>

<!-- Slide 8: Synthèse Stratégique -->
<div class="slide">
  <h2>7. Synthèse Stratégique</h2>

  <div class="decision-box ${getDecisionColor(strategicSynthesis.decision)}">
    <h3>Décision: ${strategicSynthesis.decision}</h3>
    <p>Confiance: ${strategicSynthesis.score_confiance}%</p>
  </div>

  <h3>Résumé Exécutif</h3>
  <p>${strategicSynthesis.synthese_executive}</p>

  <h3>Arguments POUR</h3>
  <ul class="green">
    ${strategicSynthesis.arguments_pour.map(a => `<li>${a}</li>`).join('')}
  </ul>

  <h3>Arguments CONTRE</h3>
  <ul class="red">
    ${strategicSynthesis.arguments_contre.map(a => `<li>${a}</li>`).join('')}
  </ul>

  <h3>Points de Vigilance</h3>
  <table>
    <thead><tr><th>Catégorie</th><th>Point</th><th>Criticité</th></tr></thead>
    <tbody>
      ${strategicSynthesis.points_vigilance.map(p => `
        <tr class="${p.criticite === 'Bloquant' ? 'red' : p.criticite === 'Majeur' ? 'orange' : ''}">
          <td>${p.categorie}</td>
          <td>${p.point}</td>
          <td>${p.criticite}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</div>

<!-- Slide 9: Plan d'Action -->
<div class="slide">
  <h2>8. Plan d'Action</h2>

  <h3>Priorités Immédiates</h3>
  ${strategicSynthesis.plan_action.sort((a, b) => a.priorite - b.priorite).map(p => `
    <div class="action-item">
      <h4>Priorité ${p.priorite}: ${p.action}</h4>
      <p><strong>Délai:</strong> ${p.delai}</p>
      <p><strong>Ressources:</strong> ${p.ressources}</p>
    </div>
  `).join('')}

  <h3>Données Complémentaires à Collecter</h3>
  <ul>
    ${strategicSynthesis.donnees_complementaires.map(d => `<li>${d}</li>`).join('')}
  </ul>
</div>

<!-- Slide 10: Scoring Global -->
<div class="slide">
  <h2>9. Scoring Détaillé</h2>

  <div class="score-breakdown">
    <h3>Score Global: ${gapAnalysis.global_score}/100</h3>

    <table>
      <thead><tr><th>Critère</th><th>Score</th><th>Poids</th></tr></thead>
      <tbody>
        <tr><td>Démographie</td><td>${gapAnalysis.scores_detail.demographic_score}/100</td><td>25%</td></tr>
        <tr><td>Concurrence</td><td>${gapAnalysis.scores_detail.competition_score}/100</td><td>20%</td></tr>
        <tr><td>État Physique</td><td>${gapAnalysis.scores_detail.physical_score}/100</td><td>15%</td></tr>
        <tr><td>Réputation</td><td>${gapAnalysis.scores_detail.reputation_score}/100</td><td>15%</td></tr>
        <tr><td>Historique BODACC</td><td>${gapAnalysis.scores_detail.bodacc_score}/100</td><td>15%</td></tr>
        <tr><td>Projets Urbanisme</td><td>${gapAnalysis.scores_detail.urban_projects_score}/100</td><td>10%</td></tr>
      </tbody>
    </table>

    <!-- Chart visualization -->
    <canvas id="scoreChart"></canvas>
  </div>
</div>

</body>
</html>
```

**Alternative Markdown** (pour intégration existante):
```markdown
# Rapport Due Diligence - ${business.name}

## Executive Summary

**Score Global:** ${gapAnalysis.global_score}/100
**Recommandation:** ${strategicSynthesis.decision}
**Confiance:** ${strategicSynthesis.score_confiance}%
**Risque:** ${gapAnalysis.risk_level}

${strategicSynthesis.synthese_executive}

---

## 1. Identité Commerce
[... même structure que HTML mais en Markdown ...]

## 2. Analyse Démographique
[...]

[... etc ...]
```

**Output State**:
```typescript
{
  report: {
    html: string,
    markdown: string,
    pdf?: Buffer // Optionnel: conversion HTML → PDF avec Puppeteer
  }
}
```

**Difficulté**: ⭐⭐⭐ Moyenne (template HTML, possibilité Charts.js pour graphiques)

---

## 4. Plan d'Implémentation Technique

### Phase 1: Foundation (1-2 semaines)
**Objectif**: Poser l'architecture multi-agent

#### Tâche 1.1: Setup ADK-like Pipeline Structure
```bash
# Créer nouvelle structure
mkdir -p src/agents/{preparation,demographic,places,photo,competitor,gap,synthesis,report}
mkdir -p src/schemas
mkdir -p server/agents
```

**Fichiers à créer**:
- `src/agents/pipeline.js`: Orchestrateur séquentiel des agents
- `src/agents/shared-state.js`: Gestionnaire de state partagé
- `src/schemas/enrichment-report.ts`: Interfaces TypeScript pour outputs

**Code de base**:
```javascript
// src/agents/pipeline.js
export class EnrichmentPipeline {
  constructor() {
    this.agents = [
      new PreparationAgent(),
      new DemographicAgent(),
      new PlacesAgent(),
      new PhotoAnalysisAgent(),
      new CompetitorAgent(),
      new GapAnalysisAgent(),
      new SynthesisAgent(),
      new ReportAgent()
    ];

    this.state = {};
    this.callbacks = {
      onProgress: null,
      onComplete: null,
      onError: null
    };
  }

  async execute(business) {
    this.state = { business };

    for (const agent of this.agents) {
      try {
        this.callbacks.onProgress?.(agent.name, 'in_progress');

        const result = await agent.execute(this.state);
        this.state[agent.outputKey] = result;

        this.callbacks.onProgress?.(agent.name, 'completed');
      } catch (error) {
        this.callbacks.onError?.(agent.name, error);
        throw error;
      }
    }

    this.callbacks.onComplete?.(this.state);
    return this.state;
  }
}
```

#### Tâche 1.2: Migrer enrichissement existant
- Refactoriser `src/services/enrichmentService.js` vers `src/agents/places/agent.js`
- Adapter `bodaccService.js` dans agent preparation

#### Tâche 1.3: Progress tracking UI
- Ajouter component React `<EnrichmentProgress />` avec étapes pipeline
- Utiliser WebSocket ou SSE pour updates temps réel (optionnel, sinon polling)

---

### Phase 2: Core Agents (2-3 semaines)
**Objectif**: Implémenter agents 2-5 (les plus complexes)

#### Tâche 2.1: DemographicResearchAgent
**Prérequis**:
- Créer compte INSEE API: https://api.insee.fr/catalogue/
- Tester Overpass API: https://overpass-api.de/

**Implémentation**:
1. `server/services/inseeService.js`:
```javascript
import axios from 'axios';

export class InseeService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.insee.fr';
  }

  async getCommuneData(codeCommune) {
    // https://api.insee.fr/catalogue/site/themes/wso2/subthemes/insee/pages/item-info.jag?name=DonneesLocales&version=V0.1&provider=insee
    const response = await axios.get(`${this.baseUrl}/donnees-locales/V0.1/donnees/geo-COM@${codeCommune}`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    });

    return response.data;
  }
}
```

2. Web search via Google Custom Search API ou SerpAPI
3. Gemini pour synthèse en JSON structuré

**Tests**:
- Tester sur Paris 15e (75115), Lyon 6e (69386), Marseille 1er (13201)
- Vérifier cohérence CSP avec données INSEE officielles

#### Tâche 2.2: PhotoAnalysisAgent
**Prérequis**:
- Télécharger 5-10 photos test de commerces Google Maps
- Compresser à 800x600 avec Sharp library

**Implémentation**:
```bash
npm install sharp
```

```javascript
import sharp from 'sharp';
import { GoogleGenerativeAI } from '@google/generative-ai';

async function compressPhoto(url) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();

  const compressed = await sharp(buffer)
    .resize(800, 600, { fit: 'inside' })
    .jpeg({ quality: 80 })
    .toBuffer();

  return compressed.toString('base64');
}
```

**Tests**:
- 3 commerces état excellent
- 3 commerces état moyen
- 3 commerces état mauvais
- Vérifier cohérence scores avec évaluation humaine

#### Tâche 2.3: CompetitorMappingAgent
**Implémentation**:
- Réutiliser `server/services/placesService.js` existant
- Ajouter `nearbySearch` pour POI
- Implémenter scoring attractivité

**Tests**:
- Zone très concurrentielle (centre Paris)
- Zone peu concurrentielle (rural)
- Zone opportunité (périphérie croissance)

---

### Phase 3: Analysis & Synthesis (1-2 semaines)
**Objectif**: Agents 6-7 (scoring + stratégie)

#### Tâche 3.1: GapAnalysisAgent
- Implémenter scoring multi-critères
- Tuning poids (demographic 25%, competition 20%, etc.)
- Tests A/B sur 20 commerces connus

#### Tâche 3.2: StrategicSynthesisAgent
- Intégrer Gemini Thinking mode (2.0 Flash Thinking Exp)
- Structured output avec schema JSON
- Validation outputs (tous champs requis présents)

---

### Phase 4: Report Generation (1 semaine)
**Objectif**: Agent 8 (rapport professionnel)

#### Tâche 4.1: HTML Template
- Créer template avec Tailwind CSS (déjà installé)
- Charts avec Chart.js ou Recharts
- Export PDF avec Puppeteer (optionnel)

#### Tâche 4.2: Markdown Alternative
- Adapter template pour génération markdown
- Compatibilité avec générateur existant `src/utils/reportGenerator.js`

---

### Phase 5: Integration & Polish (1 semaine)
**Objectif**: Intégrer dans UI existante

#### Tâche 5.1: UI Updates
- Bouton "Rapport Professionnel" dans CartWidget
- Modal affichage rapport HTML
- Téléchargement PDF/Markdown

#### Tâche 5.2: Caching
- Cache résultats agents (TTL adapté par agent)
- Éviter re-enrichissement multiple

#### Tâche 5.3: Error Handling
- Retry logic pour tous agents
- Fallback gracieux si agent échoue (continuer pipeline)
- Logs détaillés

---

## 5. Analyse Coûts et Optimisations

### Estimation Coûts API par Rapport

| API | Utilisation | Coût Unitaire | Coût/Rapport |
|-----|-------------|---------------|--------------|
| Google Places (nearbySearch) | 5-10 requêtes | $0.032/req | $0.16 - $0.32 |
| Google Places (placeDetails) | 1-2 requêtes | $0.017/req | $0.017 - $0.034 |
| Gemini 2.0 Flash | 5-10k tokens input + 2k output | $0.075/1M input, $0.30/1M output | $0.001 - $0.002 |
| Gemini 2.0 Thinking | 10k tokens thinking + 5k output | $0.15/1M input, $0.60/1M output | $0.002 - $0.005 |
| Gemini Vision (photos) | 8 images + 2k tokens | $0.315/1M input | $0.003 |
| INSEE API | 2-3 requêtes | Gratuit | $0 |
| Overpass API | 1 requête | Gratuit | $0 |
| Web Search (SerpAPI) | 3-5 requêtes | $0.002/req | $0.006 - $0.01 |

**Total estimé par rapport**: **$0.20 - $0.40**

### Optimisations Coûts

1. **Cache agressif**:
   - Demographics: 90 jours (population change lentement)
   - Photo analysis: 30 jours (sauf si nouvelles photos)
   - Competitor mapping: 7 jours
   - BODACC: 30 jours (déjà implémenté)

2. **Batch processing**:
   - Grouper multiples businesses même commune pour demographics
   - Réutiliser competitors mapping si même zone

3. **Model selection**:
   - Utiliser Flash (pas Pro) sauf pour synthesis
   - Thinking mode seulement pour synthesis finale

4. **Photo compression**:
   - 800x600 JPEG 80% qualité = ~150KB vs 2MB original
   - Réduction ~93% tokens vision

---

## 6. Risques et Mitigation

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| **Données démographiques incomplètes** | Élevée | Moyen | Fallback web search + Gemini extraction, accepter données partielles |
| **Projets urbanisme introuvables** | Moyenne | Faible | Section optionnelle, mentionner "Aucun projet identifié" |
| **Photos commerce inexistantes** | Faible | Moyen | Fallback analyse textuelle avis clients, section "Photos indisponibles" |
| **Rate limits Google Places** | Moyenne | Élevé | Retry exponential backoff, queue requests, cache agressif |
| **Coûts API élevés** | Faible | Moyen | Monitoring coûts, alertes seuils, cache optimisé |
| **Gemini hallucinations** | Moyenne | Élevé | Structured output schemas, validation post-génération, disclaimer dans rapport |
| **Performance pipeline lent** | Élevée | Moyen | Agents parallélisables (demographic + places concurrents), progress UI |

---

## 7. Métriques de Succès

### KPI Techniques
- ✅ Pipeline completion rate: >95%
- ✅ Temps exécution moyen: <60 secondes
- ✅ Coût moyen par rapport: <$0.50
- ✅ Taux cache hit: >70%

### KPI Qualité
- ✅ Précision CSP (vs données INSEE): >80%
- ✅ Relevance avis clients sélectionnés: >90% (évaluation humaine)
- ✅ Cohérence scoring global: >85% (correlation avec décision expert humain)

### KPI Métier
- ✅ Temps gagné vs analyse manuelle: >90% (15 jours → <1 heure)
- ✅ Taux adoption rapport professionnel: >60% des utilisateurs
- ✅ Satisfaction utilisateurs: >4/5

---

## 8. Roadmap Future (Post-MVP)

### V2.0: Intelligence Augmentée
- **Popular Times Analysis**: Identifier heures creuses/peak, optimiser staffing
- **Seasonal Analysis**: Analyser saisonnalité via historique reviews timestamps
- **Competitor Pricing**: Scraping avis mentionnant prix (ex: "café à 1,50€")
- **Traffic Prediction**: ML model sur base historique flux + événements locaux

### V2.1: Données Financières
- **Integration Infogreffe API**: Récupérer comptes annuels si disponibles
- **Estimation CA**: ML model basé sur avis count, rating, foot traffic, surface
- **Bail Commercial Alerts**: Web scraping annonces baux commerciaux (SeLoger Pro, etc.)

### V2.2: Social Intelligence
- **Instagram/Facebook Analysis**: Scraper présence sociale, engagement
- **Sentiment Analysis Reviews**: NLP sur avis pour identifier thèmes récurrents
- **Influencer Marketing Score**: Identifier si commerce mentionné par influenceurs locaux

### V2.3: Automatisation Juridique
- **Checklist Due Diligence**: Génération checklist personnalisée selon activité
- **Document Extraction**: OCR + Gemini pour extraire infos de documents vendeur (bail, bilans)
- **Red Flags Detection**: Alertes automatiques (contentieux, redressements, etc.)

---

## 9. Comparaison Repo ADK vs. Implementation Proposée

| Aspect | Repo ADK Retail Strategy | SearchCommerce Proposé | Commentaire |
|--------|--------------------------|------------------------|-------------|
| **Framework** | Google ADK (Python) | Custom Pipeline (JavaScript) | ADK = plus de boilerplate, mais intégration Vertex AI. JS = plus simple, stack unifié |
| **Agents** | 7 agents séquentiels | 8 agents séquentiels | Ajout PhotoAnalysisAgent spécifique rachat commerce |
| **State Management** | ADK session state auto | Custom shared state object | ADK plus robuste (persistance), custom plus flexible |
| **Frontend** | AG-UI Protocol (SSE, React) | REST API + React existant | AG-UI = richer UX, REST = plus simple à maintenir |
| **Deployment** | Cloud Run + Vertex AI | Node.js server existant | ADK = cloud-native, SearchCommerce = self-hosted friendly |
| **Code Execution** | BuiltInCodeExecutor (Python) | JavaScript natif | Python = pandas pour analytics, JS = suffisant ici |
| **Extended Reasoning** | Gemini Thinking via ADK Planner | Gemini API directe | Fonctionnalité identique |
| **Artifact Management** | ADK save_artifact() | Custom file storage | ADK = versioning auto, custom = contrôle total |
| **Error Handling** | HttpRetryOptions + callbacks | Tenacity + custom retry | Patterns similaires |

**Recommandation**: **Hybrid Approach**
- Utiliser JavaScript pour rapidité développement et stack unifié
- Emprunter patterns ADK (state injection, callbacks, structured outputs)
- Si scaling devient enjeu, migrer vers ADK + Vertex AI en V3

---

## 10. Éléments Réutilisables du Repo ADK

### ✅ Patterns à Copier (Code Adapté)

1. **Structured Output Schemas** (`app/schemas/report_schema.py`)
   - Créer `src/schemas/enrichment-report.ts` avec interfaces TypeScript
   - Valider outputs Gemini avec Zod ou JSON Schema

2. **Callback Lifecycle** (`app/callbacks/pipeline_callbacks.py`)
   - Implémenter `beforeAgent(name)` et `afterAgent(name, result)`
   - Logging structuré avec Winston

3. **Retry Logic** (`app/tools/html_report_generator.py`)
   - Utiliser `tenacity` en JavaScript ou custom exponential backoff
   - Wrapper pour tous appels API externes

4. **Custom Tools Pattern** (`app/tools/places_search.py`)
   - Créer `src/tools/insee-search.js`, `src/tools/overpass-query.js`
   - Interface unifiée `async function toolName(params, context)`

5. **HTML Report Template** (`app/tools/html_report_generator.py`)
   - Adapter style McKinsey/BCG pour rapport français
   - Utiliser Tailwind CSS (déjà dans projet)

### ❌ Patterns à NE PAS Copier

1. **ADK Agent Boilerplate**: Trop de overhead pour projet JavaScript existant
2. **Vertex AI Deployment**: Overkill si self-hosted suffit
3. **AG-UI Protocol**: Complexité inutile si REST API fonctionne
4. **Python Code Execution**: Pas nécessaire, JavaScript suffit pour analytics

---

## 11. Conclusion et Next Steps

### Résumé

Votre demande d'enrichissement professionnel est **excellente** du point de vue expert rachat de commerces. Les 7 axes demandés couvrent 80% d'une due diligence commerciale standard. Les 20% manquants (données financières, juridiques) sont hors scope API publiques.

Le repository ADK `retail-ai-location-strategy` est une **référence architecturale exceptionnelle** pour ce projet. Les patterns multi-agents, structured outputs, extended reasoning et report generation sont directement applicables.

### Plan Recommandé

**Option A: Implémentation Progressive (Recommandé)**
1. **Phase 1 (2 semaines)**: PlacesEnrichmentAgent + PhotoAnalysisAgent
   - Impact immédiat: Photos + analyse travaux
   - Coût faible, valeur élevée
2. **Phase 2 (3 semaines)**: CompetitorMappingAgent + GapAnalysisAgent
   - Analyse concurrence et scoring attractivité
3. **Phase 3 (2 semaines)**: DemographicResearchAgent
   - Partie la plus complexe (sources dispersées)
4. **Phase 4 (1 semaine)**: SynthesisAgent + ReportAgent
   - Assemblage final

**Option B: MVP Simplifié (4 semaines)**
- Uniquement agents 3, 4, 5, 6, 8 (skip demographics temporairement)
- Utiliser revenus médian INSEE comme proxy CSP
- Web search manuel pour projets urbanisme (section texte libre)

### Prochaines Actions

1. **Décision Architecture**: Valider approche custom pipeline vs adoption ADK
2. **Setup Environment**:
   - Créer comptes API (INSEE, SerpAPI ou Google Custom Search)
   - Tester quotas/limits Google Places
3. **Prototype Agent Photo**: Implémenter PhotoAnalysisAgent standalone (2-3 jours)
4. **User Testing**: Tester rapport prototype sur 5 commerces réels, feedback utilisateurs

### Ressources Nécessaires

**APIs**:
- INSEE API (gratuit, inscription requise)
- Google Custom Search API ou SerpAPI ($5-10/mois)
- Outscraper API pour Popular Times (optionnel, $20/mois)

**Développement**:
- 1 développeur fullstack: 6-8 semaines temps plein
- Ou développement progressif: 3-4 mois temps partiel

**Budget API**:
- Développement: ~$50 (tests)
- Production: $0.20-0.40 par rapport généré

---

**Prêt à démarrer ? Je recommande de commencer par le PhotoAnalysisAgent comme proof-of-concept !**

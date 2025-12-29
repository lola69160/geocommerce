# Financial Pipeline Architecture (ADK)

SearchCommerce intègre un **pipeline d'analyse financière autonome** basé sur ADK pour l'évaluation comptable d'entreprises à partir de documents PDF (bilans, liasses fiscales, baux).

**Module**: `server/adk/financial/`

## Documentation

| Document | Contenu |
|----------|---------|
| **[FINANCIAL_AGENTS.md](FINANCIAL_AGENTS.md)** | Documentation détaillée des 7 agents (tools, input/output, workflow) |
| **[FINANCIAL_CHANGELOG.md](FINANCIAL_CHANGELOG.md)** | Historique des améliorations (2025-12-27, 2025-12-28) |

---

## Structure du Pipeline

Le Financial Pipeline est un **SequentialAgent orchestrant 7 agents spécialisés** :

| # | Agent | Responsabilité | Output Key |
|---|-------|----------------|------------|
| 0 | **ComptaPreprocessingAgent** | Preprocessing documents COMPTA (extraction pages pertinentes) | `comptaPreprocessing` |
| 1 | **DocumentExtractionAgent** | Extraction et classification de documents PDF | `documentExtraction` |
| 2 | **ComptableAgent** | Analyse comptable de niveau expert-comptable | `comptable` |
| 3 | **ValorisationAgent** | Valorisation de l'entreprise (3 méthodes: EBE, CA, Patrimoniale) | `valorisation` |
| 4 | **ImmobilierAgent** | Analyse immobilière professionnelle (bail, murs, travaux) | `immobilier` |
| 5 | **FinancialValidationAgent** | Validation croisée et contrôle qualité des analyses | `financialValidation` |
| 6 | **FinancialReportAgent** | Génération rapport HTML professionnel | `financialReport` |

---

## FinancialOrchestrator

### Architecture

```
FinancialOrchestrator (SequentialAgent)
├── 0. ComptaPreprocessingAgent
│   └── Output: state.comptaPreprocessing
├── 1. DocumentExtractionAgent
│   └── Output: state.documentExtraction
├── 2. ComptableAgent
│   └── Output: state.comptable
├── 3. ValorisationAgent
│   └── Output: state.valorisation
├── 4. ImmobilierAgent
│   └── Output: state.immobilier
├── 5. FinancialValidationAgent
│   └── Output: state.financialValidation
└── 6. FinancialReportAgent
    └── Output: state.financialReport
```

### Pattern ADK
- SequentialAgent direct comme root agent (pas de wrapper LlmAgent)
- Pas de handoff inutile (évite UNKNOWN_ERROR)
- Runner créé au niveau application (endpoint Express)
- State flow automatique via outputKey de chaque agent
- Auto-parsing JSON strings dans l'endpoint

### Input State
```json
{
  "documents": [
    { "filename": "bilan-2024.pdf", "content": Buffer, "type": "application/pdf" }
  ],
  "businessInfo": {
    "name": "Commerce XYZ",
    "siret": "12345678901234",
    "nafCode": "47.26Z",
    "activity": "Tabac / Presse"
  },
  "options": {
    "prixAffiche": 150000,
    "includeImmobilier": true
  },
  "userComments": {
    "salaire_dirigeant": 35000,
    "loyer": { "loyer_actuel": 2500, "loyer_negocie": 2100 },
    "travaux": { "budget_prevu": 25000 },
    "autres": "Commentaires libres..."
  }
}
```

### Output State (final)
```json
{
  "comptaPreprocessing": { "skipped": false, "consolidatedDocuments": [...] },
  "documentExtraction": { "documents": [...], "summary": {...} },
  "comptable": { "sig": {...}, "ratios": {...}, "healthScore": {...} },
  "valorisation": { "methodes": {...}, "synthese": {...} },
  "immobilier": { "bail": {...}, "murs": {...}, "travaux": {...} },
  "financialValidation": { "coherenceChecks": [...], "confidenceScore": {...} },
  "financialReport": { "generated": true, "filepath": "...", "filename": "..." }
}
```

---

## Endpoint API

**POST `/api/analyze-financial`**

### Request
```json
{
  "documents": [
    {
      "filename": "bilan-2024.pdf",
      "content": "data:application/pdf;base64,JVBERi0x...",
      "type": "application/pdf"
    }
  ],
  "businessInfo": {
    "name": "Commerce XYZ",
    "siret": "12345678901234",
    "nafCode": "47.26Z",
    "activity": "Tabac / Presse"
  },
  "options": {
    "prixAffiche": 150000,
    "includeImmobilier": true
  },
  "userComments": {
    "salaire_dirigeant": 35000,
    "autres": "Informations complémentaires..."
  }
}
```

### Response
```json
{
  "success": true,
  "reportPath": "C:\\AI\\searchcommerce\\data\\financial-reports\\20251226_143000_financial-report-12345.html",
  "reportFilename": "20251226_143000_financial-report-12345.html",
  "summary": {
    "healthScore": 72,
    "valorisation": {
      "min": 120000,
      "median": 145000,
      "max": 170000
    },
    "verdict": "FAVORABLE",
    "confidence": 85
  },
  "executionTime": 45000,
  "agentsExecuted": 7
}
```

---

## Files Structure

```
server/adk/financial/
├── index.ts                        # Entry point, exports agents + orchestrator
├── orchestrator/
│   └── FinancialOrchestrator.ts    # SequentialAgent orchestrating 7 agents
├── agents/
│   ├── ComptaPreprocessingAgent.ts # COMPTA document preprocessing
│   ├── DocumentExtractionAgent.ts  # PDF extraction & classification
│   ├── ComptableAgent.ts           # Accounting analysis
│   ├── ValorisationAgent.ts        # Business valuation (3 methods)
│   ├── ImmobilierAgent.ts          # Real estate analysis
│   ├── FinancialValidationAgent.ts # Cross-validation & quality control
│   └── FinancialReportAgent.ts     # HTML report generation
├── tools/
│   ├── preprocessing/              # COMPTA preprocessing tools
│   ├── document/                   # PDF extraction tools
│   ├── accounting/                 # SIG, ratios, trends, benchmarks
│   ├── valuation/                  # EBE, CA, Patrimonial valuation
│   ├── property/                   # Lease, walls, works analysis
│   ├── validation/                 # Cross-validation, anomalies, quality
│   └── report/                     # Charts, HTML, file save
├── schemas/                        # TypeScript interfaces
│   ├── extractionComptaSchema.ts   # COMPTA extraction schema
│   ├── visionExtractionSchema.ts   # Gemini Vision response schema
│   └── dataCompletenessSchema.ts   # Data completeness tracking
└── config/
    ├── sectorBenchmarks.ts         # NAF sector averages (8 sectors)
    └── valuationCoefficients.ts    # NAF valuation multiples (10 sectors)

server/adk/utils/
└── extractionLogger.ts             # Dedicated extraction logging module (TypeScript)

server/
├── extractionLogger.js             # JavaScript version for server.js
└── extractionSessionStore.js       # Shared session store (JS/TS unified logging)

logs/
└── extraction_YYYYMMDD_HHMMSS_SIRET.log  # Per-analysis log files
```

---

## Usage Example

### Client-side (API Call)

```javascript
// Convert PDF file to base64
const convertFileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Prepare documents
const pdfFiles = document.getElementById('pdfInput').files;
const documents = await Promise.all(
  Array.from(pdfFiles).map(async (file) => ({
    filename: file.name,
    content: await convertFileToBase64(file),
    type: 'application/pdf'
  }))
);

// Call API
const response = await fetch('http://localhost:3001/api/analyze-financial', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    documents,
    businessInfo: {
      name: 'Mon Commerce SARL',
      siret: '12345678900012',
      nafCode: '47.11F',
      activity: 'Supermarché'
    },
    options: {
      prixAffiche: 150000,
      includeImmobilier: true
    }
  })
});

const result = await response.json();

if (result.success) {
  console.log('Rapport généré:', result.reportFilename);
  console.log('Score santé:', result.summary.healthScore);
  console.log('Valorisation:', result.summary.valorisation);
  console.log('Verdict:', result.summary.verdict);

  // Download report
  window.open(`/data/financial-reports/${result.reportFilename}`, '_blank');
}
```

### Server-side (Express Endpoint)

The endpoint is configured in `server.js`:

```javascript
import { createFinancialOrchestrator } from './server/adk/financial/index.js';
import { Runner, InMemorySessionService } from '@google/adk';

app.post('/api/analyze-financial', async (req, res) => {
  const { documents, businessInfo, options, userComments } = req.body;

  // Convert base64 to Buffer
  const processedDocuments = documents.map(doc => {
    if (doc.content && typeof doc.content === 'string') {
      const base64Data = doc.content.replace(/^data:application\/pdf;base64,/, '');
      return { ...doc, content: Buffer.from(base64Data, 'base64') };
    }
    return doc;
  });

  // Create orchestrator & runner
  const orchestrator = createFinancialOrchestrator();
  const runner = new Runner({
    appName: 'financial',
    agent: orchestrator,
    sessionService: new InMemorySessionService()
  });

  // Run pipeline
  const initialState = {
    documents: processedDocuments,
    businessInfo,
    options,
    userComments
  };

  const session = await runner.sessionService.createSession({ appName: 'financial' });
  const result = await runner.runAsync({ userId: 'system', sessionId: session.id, initialState });

  // Return response
  res.json({
    success: true,
    reportPath: result.state.financialReport.filepath,
    reportFilename: result.state.financialReport.filename,
    summary: {
      healthScore: result.state.comptable.healthScore.overall,
      valorisation: result.state.valorisation.synthese,
      verdict: computeVerdict(result.state),
      confidence: result.state.financialValidation.confidenceScore.overall
    }
  });
});
```

---

## Key Features

### Gemini Vision Integration
- Direct PDF analysis with Gemini Vision API
- ~95% accuracy vs ~30% with regex heuristics
- Automatic OCR for scanned documents
- Cost: ~$0.0014 per PDF (3 pages)

### 3 Valuation Methods
- **EBE Method**: 2.5-4.5x EBITDA multiple (sector-specific)
- **CA Method**: 40-110% of revenue (sector-specific)
- **Patrimonial Method**: Net assets + goodwill

### Data Quality Tracking
- Field-level completeness tracking
- Missing data impact on scores
- Recommendations for documents to request

### WCAG AA Accessibility
- All text meets 4.5:1 contrast ratio
- Print-friendly fallbacks
- Mode Hybride: neutral backgrounds + colored badges

### 10 Strategic Scenarios
1. Profitabilité & Rentabilité
2. Structure Financière
3. BFR & Trésorerie
4. Comparaison Sectorielle
5. Valorisation & Prix
6. Clientèle & Saisonnalité
7. Risques Réglementaires
8. Opportunités de Croissance
9. Points de Négociation
10. Stratégie de Financement

### Tabac Business Plan: Differentiated Impacts

For Tabac commerce types (NAF 47.26Z), the business plan applies sector-specific growth hypotheses:

| Impact Type | Commissions (Tabac/Loto/Presse) | Boutique (Souvenirs/Vape) |
|-------------|--------------------------------|---------------------------|
| Extension horaires | +10% | +10% |
| Travaux/Rénovation | **+0%** | **+15%** |

**Rationale:**
- Commissions are habitual commerce - renovations don't increase tobacco consumption
- Boutique sales (impulse purchases) increase significantly with better presentation

**Calculation:**
```
Effective Impact = (% Commissions × 0%) + (% Boutique × 15%)

Example: 30% commissions / 70% boutique
→ Effective = (30% × 0%) + (70% × 15%) = +10.5%
```

**Data Source:**
- `ventes_marchandises` from SIG = Boutique sales
- `chiffre_affaires - ventes_marchandises` = Commissions

### Tabac Valuation Section (Refactored 2025-12-28)

The Valuation section for Tabac businesses uses a specialized display format:

**Two Tables:**

1. **Valorisation Théorique du Fonds** (5 columns)
   | Composante | Base | Min | Médian | Max |
   |------------|------|-----|--------|-----|
   | Commissions 2023 | Commissions nettes | ×coef | ×coef | ×coef |
   | Marchandises 2023 | CA boutique | %min | %med | %max |
   | **TOTAL** | — | xxx € | xxx € | xxx € |

2. **Plan de Financement Total** (4 columns)
   | Élément | Min | Médian | Max |
   |---------|-----|--------|-----|
   | Prix de cession négocié | xxx € | xxx € | xxx € |
   | Travaux de Modernisation | xxx € | xxx € | xxx € |
   | (-) Subvention Douanes | -30 000 € | -30 000 € | -30 000 € |
   | Frais & Stock | 10 000 € | 15 000 € | 20 000 € |
   | **TOTAL INVESTISSEMENT** | xxx € | xxx € | xxx € |

**Additional Elements:**
- **Apport Personnel**: Visual indicator card (green gradient) showing buyer's contribution and %
- **Facteurs Valorisants**: Preserved from hybrid method data
- **Encadré Méthode**: Justification with light orange background

**Removed for Tabac:**
- Chart.js graph (not relevant)
- Standard comparison table (EBE/CA/Patrimoniale)
- Historical EBE calculations

**Fixed Values:**
- Subvention Douanes: -30,000 € (standard customs subsidy for Tabac)
- Frais & Stock: 10k€ / 15k€ / 20k€ (min/median/max)

**Function Signature:**
```typescript
generateValuationSection(
  valorisation: any,
  valorisationChart: any,
  documentExtraction?: any,
  userComments?: any,    // For travaux.budget_prevu and apport_personnel
  options?: any          // For prixAffiche
): string
```

---

## Extraction Logging

Le pipeline dispose d'un système de logging dédié pour visualiser toutes les données extraites des documents et commentaires utilisateurs.

### Architecture du Logging

**Session-based logging**: Un fichier de log par analyse (pas de logs journaliers agrégés).

```
logs/extraction_20251229_143052_53840462500013.log
                 ^^^^^^^^ ^^^^^^ ^^^^^^^^^^^^^^
                 Date     Heure  SIRET
```

**Unified JS/TS Logging**: Les modules JavaScript (`server.js`) et TypeScript (`tools/*.ts`) partagent le même session store via `extractionSessionStore.js`.

**Duplicate Protection**: Le système empêche les logs en double (ex: SIG calculé 2 fois par l'agent).

### Points de Logging

| Source | Catégorie | Données Loguées | Fichier |
|--------|-----------|-----------------|---------|
| **Documents COMPTA** | `DOCUMENT` | Bilan actif/passif, compte résultat, SIG, key_values | `geminiVisionExtractTool.ts` |
| **Documents standards** | `DOCUMENT` | Type, année, confidence, key_values | `geminiVisionExtractTool.ts` |
| **User Comments** | `USER_COMMENT` | Loyer, travaux, salaires, conditions vente, autres | `server.js` |
| **SIG calculés** | `SIG` | CA, marge, VA, EBE, résultats + % CA | `calculateSigTool.ts` |
| **EBE Retraitements** | `EBE_RETRAITEMENT` | EBE comptable, EBE normatif, liste retraitements | `calculateEbeRetraitementTool.ts` |
| **Valorisation** | `VALORISATION` | Méthodes EBE/CA/Patrimoniale, recommandation | `synthesizeValuationTool.ts` |
| **Immobilier** | `IMMOBILIER` | Bail, simulation loyer, travaux | `calculateLoyerSimulationTool.ts` |
| **Business Plan** | `BUSINESS_PLAN` | Projections 5 ans, indicateurs bancaires, hypothèses | `businessPlanDynamiqueTool.ts` |

### Format du Log

```
════════════════════════════════════════════════════════════════════════════════
  📊 EXTRACTION LOG - DOCUMENT
────────────────────────────────────────────────────────────────────────────────
  ⏰ Timestamp: 2025-12-29T06:14:00.000Z
  📁 Source:    COMPTA2023.pdf
  🏢 SIRET:     53840462500013
  📅 Année:     2023
────────────────────────────────────────────────────────────────────────────────
  📈 Données Extraites:
    ──────────────── INDICATEURS CLÉS   :
    chiffre_affaires                    : 235 501
    ebe                                 : 17 558
    resultat_net                        : 4 893
    marge_commerciale                   : 42 746
    charges_exploitant                  : 35 000
    ──────────────── BILAN ACTIF        :
    total_actif_immobilise              : 12 450
    disponibilites                      : 8 200
    ──────────────── SIG (% CA)         :
    sig_ebe                             : 17558 (7.5%)
════════════════════════════════════════════════════════════════════════════════
```

### Catégories de Log

| Catégorie | Description |
|-----------|-------------|
| `DOCUMENT` | Données extraites des PDFs (Gemini Vision) |
| `USER_COMMENT` | Commentaires utilisateur (loyer, travaux, salaires) |
| `SIG` | Soldes Intermédiaires de Gestion calculés |
| `EBE_RETRAITEMENT` | Retraitements EBE (comptable → normatif) |
| `VALORISATION` | Résultats de valorisation (3 méthodes + recommandation) |
| `IMMOBILIER` | Analyse immobilière (bail, simulation loyer, travaux) |
| `BUSINESS_PLAN` | Projections 5 ans et indicateurs bancaires |

### Modules

| Fichier | Description |
|---------|-------------|
| `server/extractionSessionStore.js` | **Session store partagé** (gestion des fichiers log par analyse) |
| `server/adk/utils/extractionLogger.ts` | Module TypeScript (tools ADK) |
| `server/extractionLogger.js` | Module JavaScript (server.js) |

### Session Store API

```javascript
// Démarrer une session de log pour un SIRET
setSessionLogFile(siret, logFilePath)

// Vérifier si une session existe
hasSession(siret)

// Récupérer le chemin du fichier de log
getSessionLogFile(siret)

// Protection contre les doublons
hasBeenLogged(siret, category, source, year)
markAsLogged(siret, category, source, year)
```

### Fonctions de Logging

```typescript
// Log extraction de document
logDocumentExtraction(filename, siret, year, documentType, extractedData, confidence)

// Log commentaires utilisateur
logUserComments(siret, userComments)

// Log calcul SIG
logSigCalculation(siret, year, sig, pctCA)

// Log retraitements EBE
logEbeRetraitement(siret, year, ebeComptable, ebeNormatif, retraitements)

// Log valorisation
logValorisation(siret, valorisation)

// Log immobilier
logImmobilier(siret, immobilier)

// Log business plan
logBusinessPlan(siret, businessPlan)
```

### Consultation des Logs

```bash
# Voir le dernier log généré
ls -t logs/extraction_*.log | head -1 | xargs cat

# Rechercher un SIRET spécifique
grep "SIRET:.*12345678" logs/extraction_*.log

# Voir uniquement les extractions de documents
grep -A 30 "EXTRACTION LOG - DOCUMENT" logs/extraction_*.log

# Voir tous les logs d'une analyse spécifique
cat logs/extraction_20251229_143052_53840462500013.log
```

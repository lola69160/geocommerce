# Pipeline Financier ADK

Pipeline d'analyse de documents comptables indépendant du Pipeline Stratégique.

## Architecture

```
server/adk/financial/
├── index.ts                    # Entry point, export FinancialOrchestrator
├── README.md                   # Cette documentation
├── test-document-extraction.ts # Test manuel DocumentExtractionAgent
│
├── orchestrator/               # (À implémenter)
│   └── FinancialOrchestrator.ts
│
├── agents/                     # Agents spécialisés
│   ├── DocumentExtractionAgent.ts  ✅ CRÉÉ
│   ├── ComptableAgent.ts           (À créer)
│   ├── ValorisationAgent.ts        (À créer)
│   ├── ImmobilierAgent.ts          (À créer)
│   ├── FinancialValidationAgent.ts (À créer)
│   └── FinancialReportAgent.ts     (À créer)
│
├── tools/                      # FunctionTool avec validation Zod
│   └── document/
│       ├── extractPdfTool.ts       ✅ CRÉÉ
│       ├── classifyDocumentTool.ts ✅ CRÉÉ
│       ├── parseTablesTool.ts      ✅ CRÉÉ
│       └── index.ts                ✅ CRÉÉ
│
├── schemas/                    # Schémas Zod pour validation
│   └── documentExtractionSchema.ts ✅ CRÉÉ
│
└── config/                     # (À créer)
    ├── models.ts               # Configuration Gemini par agent
    └── prompts.ts              # Prompts système par agent
```

## Pipeline d'Agents (6 étapes)

### 1. DocumentExtractionAgent ✅ **CRÉÉ ET TESTÉ**

**Responsabilités** :
- Extraire le texte des PDF (bilans, liasses fiscales, baux)
- Classifier automatiquement le type de document
- Parser les tableaux comptables
- Structurer les données en JSON

**Tools** :
- `extractPdf` - Extrait texte brut d'un PDF (pdfjs-dist/legacy) ✅ Testé
- `classifyDocument` - Classifie le type de document avec Gemini ✅ 90-95% confiance
- `parseTables` - Extrait tableaux du texte (heuristiques) ✅ Fonctionnel

**Performance validée** :
- ✅ Extraction PDF réelle avec pdfjs-dist (Mozilla)
- ✅ Classification automatique : 90-95% de confiance
- ✅ Extraction tableaux structurés (CA, commissions, loyers)
- ✅ Extraction automatique de key_values (prix, montants, durées)
- ✅ Suggestions de documents manquants

**Output** (`state.documentExtraction`) :
```typescript
{
  documents: [
    {
      filename: string,
      documentType: "bilan" | "compte_resultat" | "liasse_fiscale" | "bail" | "autre",
      year: number | null,
      confidence: number,
      extractedData: {
        raw_text: string,
        tables: Array<{ headers: string[], rows: string[][] }>,
        key_values: Record<string, any>
      }
    }
  ],
  summary: {
    total_documents: number,
    years_covered: number[],
    missing_documents: string[]
  }
}
```

### 2. ComptableAgent (À créer)

**Responsabilités** :
- Analyser les ratios financiers (liquidité, solvabilité, rentabilité)
- Calculer les indicateurs clés (BFR, CAF, EBITDA)
- Détecter signaux d'alerte (pertes récurrentes, sur-endettement)

**Tools à créer** :
- `calculateRatios` - Calcul ratios financiers standard
- `analyzeTrend` - Analyse tendances sur N années
- `detectAlerts` - Détection signaux d'alerte

### 3. ValorisationAgent (À créer)

**Responsabilités** :
- Valoriser l'entreprise (méthode patrimoniale, DCF, multiples)
- Estimer la valeur du fonds de commerce
- Calculer la capacité d'endettement

**Tools à créer** :
- `valuatePatrimonial` - Valorisation patrimoniale (Actif Net)
- `valuateDCF` - Valorisation par DCF (flux de trésorerie)
- `estimateMultiples` - Valorisation par multiples sectoriels

### 4. ImmobilierAgent (À créer)

**Responsabilités** :
- Analyser le bail commercial (durée, loyer, charges)
- Calculer le ratio loyer/CA
- Estimer la valeur du droit au bail

**Tools à créer** :
- `parseLease` - Parser clauses du bail (durée, loyer, indexation)
- `calculateRent` - Calcul ratio loyer/CA et poids loyer
- `valuateLease` - Valorisation droit au bail (pas-de-porte)

### 5. FinancialValidationAgent (À créer)

**Responsabilités** :
- Valider cohérence des données comptables
- Détecter incohérences entre documents
- Vérifier équilibre bilan (Actif = Passif)

**Tools à créer** :
- `validateBalance` - Vérifier équilibre bilan
- `crossValidate` - Validation croisée (bilan ↔ compte résultat)
- `detectAnomalies` - Détection anomalies statistiques

### 6. FinancialReportAgent (À créer)

**Responsabilités** :
- Générer rapport HTML expert-comptable
- Synthèse financière visuelle (graphiques, ratios)
- Recommandation GO/NO-GO achat

**Tools à créer** :
- `generateFinancialHTML` - Génération rapport HTML enrichi
- `saveFinancialReport` - Sauvegarde rapport dans data/financial-reports/

## State Management

**Initial State** (passé au runner) :
```typescript
{
  documents: [
    { filename: "bilan-2024.pdf", filePath: "/path/to/file.pdf" }
  ],
  businessInfo: {
    name: "Commerce XYZ",
    siret: "12345678901234",
    nafCode: "47.26Z",
    activity: "Tabac / Presse"
  }
}
```

**Shared State** (propagé entre agents) :
```typescript
{
  documentExtraction: { ... },  // Agent 1
  comptable: { ... },           // Agent 2
  valorisation: { ... },        // Agent 3
  immobilier: { ... },          // Agent 4
  financialValidation: { ... }, // Agent 5
  financialReport: { ... }      // Agent 6
}
```

## Patterns ADK Utilisés

### 1. LlmAgent avec Tools
```typescript
export class DocumentExtractionAgent extends LlmAgent {
  constructor() {
    super({
      name: 'documentExtraction',
      model: 'gemini-3-flash-preview',
      tools: [extractPdfTool, classifyDocumentTool, parseTablesTool],
      outputKey: 'documentExtraction'
    });
  }
}
```

### 2. FunctionTool avec ToolContext
```typescript
export const extractPdfTool = new FunctionTool({
  name: 'extractPdf',
  parameters: zToGen(InputSchema),
  execute: async (params, toolContext?: ToolContext) => {
    const documents = toolContext?.state.get('documents');
    // ...
  }
});
```

### 3. JSON Parsing Automatique
Les outputs JSON string sont auto-parsés en objets (voir `server.js:518-542`).
Les tools doivent parser si nécessaire :
```typescript
let prep = toolContext?.state.get('documentExtraction');
if (typeof prep === 'string') {
  prep = JSON.parse(prep);
}
```

## Dépendances

- `pdfjs-dist` - Extraction texte PDF (Mozilla PDF.js - standard industrie) ✅ Installé
- `@google/adk` - Agent Development Kit
- `zod` - Validation schemas
- `@google/generative-ai` - Gemini API

**Note** : Utilisation du build `legacy` de pdfjs-dist pour Node.js :
```typescript
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
```

## Testing

### Test Manuel DocumentExtractionAgent

1. **Créer dossier de test** :
```bash
mkdir -p server/adk/financial/test-data
```

2. **Ajouter PDF de test** :
Placer des bilans, liasses fiscales dans `test-data/`

3. **Lancer le test** :
```bash
npx tsx server/adk/financial/test-document-extraction.ts
```

**Sortie réelle (test validé 2024-12-26)** :
```
================================================================================
🧪 TEST: DocumentExtractionAgent
================================================================================

📁 Fichiers trouvés : 2
   - 1766739569489_Cou_t_transaction_Mme_Ardouin_offre_.pdf
   - 1766739636304_Descriptif_6568.pdf

🚀 Lancement de DocumentExtractionAgent...

================================================================================
✅ EXTRACTION TERMINÉE
================================================================================

📊 RÉSULTATS :
   Documents extraits : 2
   Années couvertes : 2024, 2023

1. 1766739569489_Cou_t_transaction_Mme_Ardouin_offre_.pdf
   Type : projet_vente
   Année : 2024
   Confiance : 90.0%
   Texte extrait : "Dossier 6568 AU FIL DE L'O BAR TABAC PRESSE..."
   Key Values : prix_fonds (320 000 €), apport (125 600 €), crédit (318 000 €)

2. 1766739636304_Descriptif_6568.pdf
   Type : projet_vente
   Année : 2023
   Confiance : 95.0%
   Tableaux extraits : 1 (CA 2023: 114 494 €, Commissions: 121 006 €)
   Key Values : ca_2023, commissions_2023, loyer_mensuel (2 600 €)

⚠️  Documents manquants suggérés :
   - bilan_2023
   - compte_resultat_2023
   - liasse_fiscale_2023
```

## Prochaines Étapes

1. ✅ **DocumentExtractionAgent créé et testé avec pdfjs-dist**
   - ✅ Extraction PDF réelle validée (90-95% confiance)
   - ✅ Classification automatique 6 types de documents
   - ✅ Extraction tableaux et key_values
   - ✅ Tests passés avec PDF réels (projets de vente)

2. ⬜ Créer ComptableAgent + tools ratios
3. ⬜ Créer ValorisationAgent + tools valorisation
4. ⬜ Créer ImmobilierAgent + tools bail
5. ⬜ Créer FinancialValidationAgent + tools validation
6. ⬜ Créer FinancialReportAgent + template HTML
7. ⬜ Créer FinancialOrchestrator (SequentialAgent)
8. ⬜ Créer endpoint Express `/api/analyze-financial-adk`
9. ⬜ Intégrer frontend (modal upload PDF)

## Indépendance du Pipeline Stratégique

✅ **100% autonome** :
- Dossier séparé `financial/`
- Agents indépendants
- Tools dédiés
- Schemas propres
- Rapport HTML distinct

❌ **Aucun croisement** avec :
- `server/adk/agents/` (pipeline stratégique)
- `server/adk/tools/` (outils terrain)
- `server/adk/schemas/` (schemas business)

## Documentation Technique

- **ADK Officiel** : https://google.github.io/adk-docs/
- **CLAUDE.md** : Patterns ADK utilisés dans SearchCommerce
- **Gemini Models** : https://ai.google.dev/gemini-api/docs/models

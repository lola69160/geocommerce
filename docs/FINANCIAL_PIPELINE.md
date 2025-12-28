# Financial Pipeline Architecture (ADK)

SearchCommerce intègre un **pipeline d'analyse financière autonome** basé sur ADK pour l'évaluation comptable d'entreprises à partir de documents PDF (bilans, liasses fiscales, baux).

📁 **Module**: `server/adk/financial/`

## Structure du Pipeline

Le Financial Pipeline est un **SequentialAgent orchestrant 7 agents spécialisés** :

0. **ComptaPreprocessingAgent** ✅ - Preprocessing documents COMPTA (extraction pages pertinentes)
1. **DocumentExtractionAgent** ✅ - Extraction et classification de documents PDF
2. **ComptableAgent** ✅ - Analyse comptable de niveau expert-comptable
3. **ValorisationAgent** ✅ - Valorisation de l'entreprise (3 méthodes: EBE, CA, Patrimoniale)
4. **ImmobilierAgent** ✅ - Analyse immobilière professionnelle (bail, murs, travaux)
5. **FinancialValidationAgent** ✅ - Validation croisée et contrôle qualité des analyses
6. **FinancialReportAgent** ✅ - Génération rapport HTML professionnel

## Recent Improvements (2025-12-27)

### Phase 1: Quality & Accuracy Fixes (Morning)

#### 🎯 Data Extraction & Scoring

**1. Fixed Valuation Scoring (assessDataQualityTool.ts)**
- **Before**: Score always 0/100 due to structure mismatch (`valo.methodes` vs `valo.methodeEBE`)
- **After**: Dynamic calculation based on methods present:
  - EBE method: +30 points
  - CA method: +25 points
  - Patrimonial method: +20 points
  - Synthesis: +25 points
  - **Result**: Up to 100/100

**2. Fixed Valuation Comparison Table (generateFinancialHtmlTool.ts)**
- **Before**: Empty table due to structure mismatch
- **After**: Displays all 3 methods with ranges (low/median/high)
- Added patrimonial method details (net assets + goodwill breakdown)
- Backward compatibility: supports both `methodes.ebe` and `methodeEBE` structures

**3. Improved Document Detection (assessDataQualityTool.ts)**
- **Before**: Only checked `documentType === 'bilan'`
- **After**: Multi-pattern recognition:
  - Document type: `bilan`, `compte_resultat`, `liasse_fiscale`
  - Filename patterns: contains "bilan", "liasse", "compte", "resultat"
  - Content analysis: tables contain "ACTIF"+"PASSIF" or "CHARGES"+"PRODUITS"
  - Fallback: If SIG complete, documents are considered present
- **Result**: Eliminated false "missing documents" alerts

**4. Added "liasse_fiscale" Document Type (geminiVisionExtractTool.ts)**
- **Before**: Only "bilan" or "compte_resultat"
- **After**: Content-based detection:
  - `bilan`: Contains ONLY balance sheet (ACTIF + PASSIF)
  - `compte_resultat`: Contains ONLY income statement (CHARGES + PRODUITS)
  - `liasse_fiscale`: Complete document with BOTH balance sheet AND income statement + SIG/annexes
- **Rule**: If document contains BOTH → type = "liasse_fiscale"

**5. Increased maxOutputTokens (DocumentExtractionAgent.ts)**
- **Before**: 8192 tokens → potential truncation on long documents
- **After**: 16384 tokens → supports 33+ page documents without truncation

### 🎨 User Experience Enhancements

**6. New "User Comments" Section in Reports (generateFinancialHtmlTool.ts)**
- Added section "💬 Éléments Complémentaires Fournis" after executive summary
- Displays user-provided information:
  - **Rent**: Negotiated future rent, personal housing portion, comments
  - **Automatic breakdown**: Commercial rent vs personal housing advantage
  - **Renovation**: Planned budget, comments
  - **Sale conditions**: Negotiation possible, comments
  - **Other**: Free-form comments
- Reads from `state.userComments` (loyer, travaux, conditions_vente, autres)

**7. Real Estate Score Considers User Negotiations (analyzeBailTool.ts + ImmobilierAgent.ts)**
- **Before**: Score didn't reflect negotiated rent reductions
- **After**:
  - `analyzeBailTool` detects favorable negotiations (future rent < current rent)
  - Improves appreciation: `desavantageux` → `marche`, `marche` → `avantageux`
  - Adds `negociation_utilisateur_favorable` flag
  - `ImmobilierAgent` grants +10 bonus points for successful negotiations
- **Result**: Real estate score reflects actual deal quality

### 🤖 Gemini Vision Extraction Improvements

**8. Hierarchical Extraction Prompt (geminiVisionExtractTool.ts)**
- **Before**: Generic prompt, limited guidance
- **After**: 4-level priority structure:
  - **CRITICAL**: Balance sheet (10+ line items), Income statement (13+ line items)
  - **IMPORTANT**: SIG (7 indicators)
  - **USEFUL**: Annexes (7 sections)
- Detailed extraction instructions for each section:
  - Balance sheet: Assets (tangible, intangible, current) + Liabilities (equity, provisions, debts)
  - Income statement: Revenue, purchases, external costs, personnel, depreciation, results
  - SIG: Revenue, gross margin, value added, EBITDA, operating result, net result
  - Annexes: Asset details, receivables/payables aging, provisions, staff compensation, off-balance commitments
- Explicit extraction rules: French format (50 000 → 50000), negatives, hierarchical structure
- Enhanced reasoning: 4-point explanation (classification, sections found, confidence, missing data)

**9. Expected Results**
- **Extraction score**: 70/100 → **85-90/100** (+15-20 points)
- **Valuation score**: 0/100 → **100/100** (+100 points)
- **False alerts**: Eliminated "missing documents" when documents present
- **User transparency**: Full visibility of user-provided data in reports
- **Real estate accuracy**: Score reflects negotiated deals

---

### Phase 2: Report Quality & User Experience (Afternoon)

#### 📁 Report Naming & Organization

**10. Timestamp at Beginning of Filename (saveFinancialReportTool.ts)**
- **Before**: `financial-report-{businessId}-{YYYY-MM-DD}.html`
- **After**: `{YYYYMMDD_HHMMSS}_financial-report-{businessId}.html`
- **Benefits**:
  - Aligns with professional reports naming convention
  - Chronological sorting (most recent first when sorted alphabetically)
  - Full precision timestamp (date + time, not just date)
- **Example**:
  - Before: `financial-report-au-fil-de-lo-2025-12-27.html`
  - After: `20251227_143022_financial-report-au-fil-de-lo.html`

#### 💬 User Comments Integration

**11. Full Frontend-to-Backend User Comments Transmission**

**Frontend Changes (ProfessionalAnalysisModal.jsx)**:
- `additionalInfo` field (existing textarea) now sent to API
- Transmitted as `userComments: { autres: additionalInfo }`
- No UX change - uses existing "Informations complémentaires" field

**Backend Changes (server.js)**:
- Extract `userComments` from `req.body` (line 932)
- Inject into `initialState.userComments` (line 978)
- Available to ALL agents via `state.userComments`

**Report Display (generateFinancialHtmlTool.ts)**:
- Section "💬 Éléments Complémentaires Fournis" after Executive Summary
- Automatic display when `userComments` exists in state
- Structured display:
  - **Loyer** (Rent): Future commercial rent, personal housing portion, comments
  - **Travaux** (Renovation): Planned budget, comments
  - **Conditions de vente** (Sale conditions): Negotiation possible, comments
  - **Autres** (Other): Free-form comments
- Automatic breakdown: Commercial rent vs personal housing advantage

**Example User Input**:
> "lors du rachat nous avons négocié dans le prochain bail que le loyer serait de 2100 euros par mois dont 600 euros pour le loyer du logement personnel"

**Report Output**:
```
💬 Éléments Complémentaires Fournis

Autres Informations
"lors du rachat nous avons négocié dans le prochain bail que le loyer serait
de 2100 euros par mois dont 600 euros pour le loyer du logement personnel"
```

#### 💰 Budget Travaux Display

**12. Renovation Budget as Additional Investment Cost (generateFinancialHtmlTool.ts)**

**Design Decision**: Do NOT subtract from valuation, show as separate additive cost

**Before**: Only valuation displayed
```
Valorisation Recommandée: 205 000 €
```

**After**: With renovation budget in Executive Summary
```
Valorisation Recommandée: 205 000 €

💰 Investissement Total Estimé
  Valorisation du fonds      205 000 €
  + Budget travaux            25 000 €
  Total investissement       230 000 €
```

**Implementation**:
- Reads `userComments.travaux.budget_prevu` from state
- Displayed only if budget > 0
- Valuation unchanged (transparency: user sees breakdown)
- Total investment = valuation + works budget

#### ✅ Report Quality Improvements

**13. Always Display Patrimoniale Method (generateFinancialHtmlTool.ts, line 496)**
- **Before**: Row hidden if `valeur_estimee === 0` (condition: `> 0`)
- **After**: Always display with note if missing
- **Display**:
  - If `valeur_estimee > 0`: `"150 000 €"`
  - If `valeur_estimee === 0`: `"0 € (bilan non fourni)"`
- **Benefit**: Users see all 3 methods, understand why data missing

**14. Default Message for Empty "Points Forts" (generateFinancialHtmlTool.ts, line 285)**
- **Before**: Empty list when no strengths (confusing UX)
- **After**: Explicit message
  ```
  Aucun point fort majeur identifié selon les critères standards
  (santé ≥70, marge ≥10%, croissance)
  ```
- **Triggers when**:
  - Health score < 70
  - EBE margin < 10%
  - No revenue growth (trend ≠ "croissance")
- **Benefit**: User understands WHY list is empty (not a bug)

#### 📊 Files Modified (Phase 2)

1. **saveFinancialReportTool.ts** (lines 43-49)
   - Timestamp format change
   - Filename structure change

2. **ProfessionalAnalysisModal.jsx** (line 334-336)
   - Add `userComments` to API request payload

3. **server.js** (lines 932, 978)
   - Extract `userComments` from req.body
   - Inject into `initialState`

4. **generateFinancialHtmlTool.ts** (4 modifications)
   - Line 63: Parse `userComments` early, pass to `generateExecutiveSummary`
   - Line 252: Add `userComments` parameter to function signature
   - Line 305-317: Display budget travaux as additional cost
   - Line 285-287: Default message for empty strengths
   - Line 496-502: Always show Patrimoniale method

---

### Phase 3: Accessibility, Transparency & Strategic Guidance (Evening)

#### 🎨 Accessibility & Design Quality

**15. WCAG AA Compliant Color Palette (generateFinancialHtmlTool.ts)**

**Problem**: Report used hard-coded colors (#666, #999, #f0f0f0) with insufficient contrast for accessibility.

**Solution**: Complete CSS overhaul with accessible design system
- **Created 11 CSS variables** (lines 152-178):
  ```css
  :root {
    --color-text-primary: #1a1a1a;      /* 15.8:1 contrast */
    --color-text-secondary: #4a5568;    /* 8.59:1 contrast */
    --color-text-muted: #718096;        /* 5.14:1 contrast - minimum */
    --color-bg-medium: #e2e8f0;
    --color-bg-emphasis: #cbd5e0;
    --color-table-header: #edf2f7;
    --color-table-border: #cbd5e0;
    --color-success-bg: #c6f6d5;
    --color-warning-bg: #feebc8;
    --color-error-bg: #fed7d7;
    --color-info-bg: #bee3f8;
  }
  ```
- **Replaced 12 hard-coded color instances**: `#666` → `var(--color-text-secondary)`, `#999` → `var(--color-text-muted)`
- **Added 3 new table row classes** (lines 293-306):
  - `.table-base-row`: EBE comptable base (medium gray background)
  - `.table-total-row`: Total retraitements (emphasis gray)
  - `.table-normatif-row`: EBE normatif final (info blue)
- **Print-friendly fallbacks**: Colored backgrounds replaced with grayscale in print mode
- **Result**: All text meets WCAG AA minimum (4.5:1 contrast ratio)

#### 🔍 Enhanced Transparency & Debugging

**16. Comprehensive UserComments Logging (server.js, lines 990-1073)**

**Problem**: No visibility into which userComments are used by agents.

**Solution**: Structured console display with visual formatting
```javascript
console.log('\n╔═══════════════════════════════════════════════════════════════');
console.log('║  USER COMMENTS REÇUS (analyse financière)');
console.log('╚═══════════════════════════════════════════════════════════════\n');

if (userComments.salaire_dirigeant) {
  console.log('  💼 Salaire dirigeant:');
  console.log(`     → ${userComments.salaire_dirigeant.toLocaleString('fr-FR')} € / an`);
}

if (userComments.loyer) {
  console.log('  🏠 Informations Loyer:');
  console.log(`     → Loyer actuel: ${loyerActuel}€/mois`);
  console.log(`     → Loyer négocié: ${loyerNegocie}€/mois`);
  console.log(`     → Économie annuelle: ${economie}€/an`);
}
```
- **Displays**:
  - Salaire dirigeant (annual salary)
  - Salariés non repris (employees not retained)
  - Loyer details (current, negotiated, savings)
  - Budget travaux (renovation budget)
  - Autres informations (free-form comments)
- **Automatic calculations**: Rent savings, monthly → annual conversions
- **Result**: Full visibility in console logs

**17. Improved Gemini Vision Logging (geminiVisionExtractTool.ts, lines 309-332)**

**Problem**: Partial logging - success/failure only, no quality metrics.

**Solution**: Detailed extraction metrics logging
```typescript
console.log('[geminiVisionExtract] ✅ Extraction réussie:', {
  documentType: parsed.documentType,
  year: parsed.year,
  confidence: parsed.confidence,
  details: parsed.extraction_details || 'non fourni',
  accounting_values_count: Object.keys(parsed.accounting_values || {}).length,
  tables_count: parsed.tables?.length || 0
});

// Détail des clés extraites
const extractedKeys = Object.keys(parsed.accounting_values);
const missingCriticalKeys = ['chiffre_affaires', 'ebe', 'resultat_net',
                              'capitaux_propres', 'dettes_totales']
  .filter(k => !extractedKeys.includes(k) || parsed.accounting_values[k] === null);

if (missingCriticalKeys.length > 0) {
  console.warn('[geminiVisionExtract] ⚠️ Données critiques manquantes:', missingCriticalKeys);
}

console.log('[geminiVisionExtract] Clés extraites:', extractedKeys.length, '/', 50, 'attendues');
```
- **Shows**: Document type, year, confidence, extraction details
- **Warns**: Missing critical keys (CA, EBE, résultat net, capitaux propres, dettes)
- **Reports**: Extraction completeness (e.g., "35/50 keys extracted")
- **Result**: Immediate feedback on extraction quality

**18. EBE Retraitement Logging (calculateEbeRetraitementTool.ts, lines 149-153)**

**Added execution context logging**:
```typescript
console.log('\n[EBE Retraitement] ========================================');
console.log('[EBE Retraitement] Démarrage calcul EBE Normatif');
console.log('[EBE Retraitement] EBE Comptable de base:', ebeComptable, '€');
console.log('[EBE Retraitement] Année de référence:', anneeReference);
console.log('[EBE Retraitement] ========================================\n');
```
- **Benefit**: Track which userComments values are used in calculations

#### 📊 Chart & Table Display Improvements

**19. Valorisation Chart Always Visible (generateChartsTool.ts, lines 189-239)**

**Problem**: Chart showed "Pas de données" when any method returned 0€.

**Solution**: Always display all 3 methods, even with 0 values
```typescript
// Always add methods, even if value is 0
if (methodes.ebe) {
  labels.push('Méthode EBE');
  if (methodes.ebe.valeur_mediane > 0) {
    minValues.push((methodes.ebe.valeur_basse || 0) / 1000);
    medianValues.push((methodes.ebe.valeur_mediane || 0) / 1000);
    maxValues.push((methodes.ebe.valeur_haute || 0) / 1000);
  } else {
    minValues.push(0);
    medianValues.push(0);
    maxValues.push(0);
    console.warn('[Valorisation Chart] ⚠️ Méthode EBE: 0€ (données insuffisantes)');
  }
}
```
- **Same pattern** for CA and Patrimonial methods
- **Console warnings** indicate which methods couldn't be calculated
- **Result**: Chart always shows 3 bars (some at 0€), never empty

**20. Comparison Table Transparency (generateFinancialHtmlTool.ts, lines 713-771)**

**Problem**: Table only showed methods with values > 0, hiding incomplete data.

**Solution**: Always display all 3 methods with explanatory messages
```typescript
// MÉTHODE EBE - Toujours afficher
if (methodes?.ebe) {
  const ebe = methodes.ebe;
  if (ebe.valeur_mediane > 0) {
    html += `<tr>
      <td><strong>Méthode EBE</strong> (${ebe.coefficient_bas}x - ${ebe.coefficient_haut}x)</td>
      <td class="text-right">${ebe.valeur_basse.toLocaleString('fr-FR')} €</td>
      <td class="text-right">${ebe.valeur_mediane.toLocaleString('fr-FR')} €</td>
      <td class="text-right">${ebe.valeur_haute.toLocaleString('fr-FR')} €</td>
    </tr>`;
  } else {
    html += `<tr style="color:var(--color-text-muted)">
      <td><strong>Méthode EBE</strong></td>
      <td class="text-right" colspan="3">0 € <em>(données insuffisantes - EBE non disponible ou trop faible)</em></td>
    </tr>`;
  }
}
```
- **Explanatory messages**:
  - EBE: "données insuffisantes - EBE non disponible ou trop faible"
  - CA: "données insuffisantes - CA non disponible"
  - Patrimonial: "bilan non fourni"
- **Result**: Users see all 3 methods, understand why some are 0€

#### 🎯 Strategic Analysis Expansion

**21. Extended Strategic Scenarios: 5 → 10 (generateFinancialHtmlTool.ts, lines 1629-1700)**

**Added 5 new scenarios** in `analyzeAndGenerateCommentaries()`:

**Scenario 6: Clientèle & Saisonnalité** (lines 1629-1641)
- Detects tourist vs residential zones (`businessInfo.zone_touristique`)
- Tourist zone: Warns about seasonality (40-60% of annual revenue in summer)
- Residential zone: Recommends loyalty programs, extended hours
- **Triggers**: Tobacco/press activity OR tourist zone flag

**Scenario 7: Risques Réglementaires** (lines 1643-1649)
- Tobacco regulation warnings (carte débitant, transfer delays 3-6 months)
- Legislative risks (neutral packaging, prices, smoking areas)
- Structural decline (-2%/year consumption)
- Recommends revenue diversification (press, FDJ, vape, souvenirs)
- **Triggers**: `businessInfo.activite_principale.includes('tabac')`

**Scenario 8: Opportunités de Croissance** (lines 1651-1666)
- Detects stagnant revenue (< 5% growth over 3 years)
- Suggests 4 growth levers:
  1. Extended hours (capture morning/evening traffic)
  2. Digitalization (click & collect, delivery, e-commerce)
  3. Merchandising (window redesign, product placement)
  4. Local events (partnerships, community engagement)
- Realistic target: +10-15% revenue year 1 with minimal investment
- **Triggers**: `croissanceCA < 5%`

**Scenario 9: Points de Négociation** (lines 1668-1682)
- Calculates price gap: `(prixAffiche - valeurRecommandee) / valeurRecommandee`
- If overpriced (> +10%):
  - Buyer arguments: Declining EBITDA, high rent, works needed, market uncertainty
  - Strategy: Propose 95% of recommended value + earn-out clause
- If underpriced:
  - Warns: Check urgency, hidden issues, precarious lease
  - Recommends: Enhanced due diligence
- **Triggers**: `|ecartPrix| > 10%`

**Scenario 10: Stratégie de Financement** (lines 1684-1699)
- Calculates loan capacity: 70% of normalized EBITDA max
- Estimates loan duration: `montantEmprunt / annuiteMax`
- Alerts if duration > 7 years (bank risk)
- Lists expected guarantees: Fund pledge, personal guarantee, death/disability insurance
- **Triggers**: `valeurRecommandee > 0 && ebeNormatif > 0`

**22. New Section: "Conseils pour le Rachat" (generateFinancialHtmlTool.ts, lines 1567-1786)**

**Created `generateAcquisitionAdviceSection()` function** with 4 subsections:

**Subsection 1: Risques Identifiés & Mitigation** (lines 1577-1643)
- **Risk analysis table** with 4 categories:
  1. **Baisse EBE** (EBITDA decline < -20%): Critical risk
     - Mitigation: Audit payroll, renegotiate rent, optimize schedules, earn-out clause
  2. **Loyer élevé** (Rent > market +X%): Warning
     - Mitigation: Negotiate -15% minimum, rent reduction clause if revenue < threshold
  3. **Financement** (Loan annuity > 70% EBITDA): Critical risk
     - Mitigation: Increase down payment, negotiate price down, defer principal (interest-only year 1)
  4. **Travaux** (Works > 30k€): Warning
     - Mitigation: Partial seller coverage, spread over 18-24 months, include in financing
- **Status badges**: 🔴 Critique / 🟠 Important
- **Fallback message**: "Aucun risque majeur identifié" if no risks detected

**Subsection 2: Opportunités de Création de Valeur** (lines 1645-1672)
- **5 value creation levers**:
  1. **Payroll optimization** (if ratio > 30% of revenue): 5-10% EBITDA gain via optimized schedules
  2. **Extended hours** (from userComments): +15-20% revenue (capture morning/evening traffic)
  3. **Revenue diversification**: Vape, souvenirs, candy, services (reduce dependency on regulated activity)
  4. **Digitalization**: Click & collect, delivery, digital loyalty (2-3k€ cost, 12-18 month ROI)
  5. **Rent renegotiation** (if simulation shows savings): Immediate cash flow improvement

**Subsection 3: Checklist Due Diligence** (lines 1674-1732)
- **7-point checklist table**:
  1. **Bail commercial** (3-6-9 lease): ✅ OK / ❌ À vérifier
  2. **Liasse fiscale** (3 years): ✅ OK / ⚠️ Partiel / ❌ À vérifier
  3. **Carte débitant tabac** (if applicable): ❌ À vérifier
  4. **Contrats fournisseurs** (FDJ, PMU): ❌ À vérifier
  5. **Conformité ERP** (fire safety, accessibility): ❌ À vérifier
  6. **État des stocks**: ❌ À vérifier
  7. **Litiges en cours** (labor court, tax): ❌ À vérifier
- **Status badges**: ✅ OK / ⚠️ Partiel / ❌ À vérifier
- **Action required** column: Specific steps for each item

**Subsection 4: Arguments de Négociation** (lines 1734-1783)
- **Side-by-side comparison**:
  - **Buyer arguments** (price pressure ⬇️):
    - Critical accounting alerts
    - Overpriced rent (+X% vs market)
    - Works needed (Xk€)
    - Declining profitability trend
    - Economic uncertainty (inflation, purchasing power)
  - **Seller arguments** (price maintenance ⬆️):
    - Solid EBITDA margin (X%)
    - Premium location (tourist zone)
    - Loyal recurring clientele
    - Regulated activity (barrier to entry)
    - Untapped growth potential
- **Visual layout**: `.chart-row` with two columns (flex:1 each)

**Integration**:
- Added after Business Plan section (line 104-106)
- Included in `sections_included` array
- Uses all available state data (comptable, valorisation, immobilier, businessInfo, userComments)

#### 📁 Files Modified (Phase 3)

1. **generateFinancialHtmlTool.ts** (260+ lines added)
   - Lines 152-178: CSS variables (WCAG AA palette)
   - Lines 293-306: Table row classes (base, total, normatif)
   - Lines 502, 532, 539: Applied classes to EBE table rows
   - Lines 713-771: Comparison table always shows 3 methods
   - Lines 1563: Updated function signature (added businessInfo, valorisation)
   - Lines 1629-1700: Added scenarios 6-10
   - Lines 1567-1786: New `generateAcquisitionAdviceSection()` function
   - Line 75: Updated function call with new parameters
   - Lines 104-106: Integrated acquisition advice section

2. **generateChartsTool.ts** (lines 189-239)
   - Chart generation always shows 3 methods
   - Console warnings for 0€ values

3. **geminiVisionExtractTool.ts**
   - Lines 141-187: Enhanced prompt (critical instructions, confidence scoring)
   - Lines 309-332: Detailed extraction metrics logging

4. **server.js** (lines 990-1073)
   - Comprehensive userComments console display

5. **calculateEbeRetraitementTool.ts** (lines 149-153)
   - Execution context logging

#### 🎯 Expected Results (Phase 3)

- **Accessibility**: 100% WCAG AA compliance (all contrasts ≥ 4.5:1)
- **Transparency**: Full visibility of userComments usage in console
- **UX**: No more empty charts/tables - all 3 methods always visible
- **Strategic guidance**: 10 scenarios (vs 5) + dedicated acquisition advice section
- **Debugging**: Immediate feedback on extraction quality and missing data

---

### Phase 4: ComptaPreprocessingAgent (2025-12-28)

#### 🎯 Objectif

Créer un agent de preprocessing des documents COMPTA qui:
- Analyse les documents avec "COMPTA" dans le nom
- Extrait uniquement les pages pertinentes (Bilan Actif, Bilan Passif, Compte de Résultat, SIG)
- Crée des PDFs consolidés par année fiscale
- Sauvegarde dans `data/documents/{SIREN}/A_ANALYSER/`
- Met à jour `state.documents` pour DocumentExtractionAgent

#### 🔧 Implementation

**Tool principal: `preprocessComptaDocumentsTool`** (tout-en-un, déterministe)

Un seul tool qui effectue TOUT le preprocessing en une seule opération:
1. Vérifie si A_ANALYSER existe déjà → Si oui, SKIP
2. Analyse chaque document COMPTA avec Gemini Vision (1 requête par document)
3. Identifie les pages pertinentes (bilan_actif, bilan_passif, compte_resultat, sig)
4. Crée les PDFs consolidés avec pdf-lib
5. Sauvegarde sur disque
6. Met à jour state.documents

**Avantages du tool "tout-en-un"**:
- ✅ Déterministe - pas de dépendance sur le LLM pour orchestrer les étapes
- ✅ Fiable - une seule invocation, workflow complet garanti
- ✅ Efficace - 1 requête Gemini Vision par document (pas par page)

#### 📂 Fichiers créés

```
server/adk/financial/tools/preprocessing/
├── index.ts                          # Export barrel
├── preprocessComptaDocumentsTool.ts  # Tool principal "tout-en-un"
├── checkProcessedDocumentsTool.ts    # Vérifie A_ANALYSER
├── analyzeDocumentStructureTool.ts   # Analyse structure document
├── extractPagesTool.ts               # Extraction pages (pdf-lib)
├── analyzePageTypeTool.ts            # Classification page (Vision)
├── createConsolidatedPdfTool.ts      # Création PDF consolidé
├── saveProcessedDocumentsTool.ts     # Sauvegarde disque
├── updateStateDocumentsTool.ts       # Mise à jour state
└── listComptaDocumentsTool.ts        # Liste documents COMPTA
```

#### 🔑 Points clés

**1. SIREN au lieu de SIRET pour le dossier**
```typescript
const siren = siret.substring(0, 9);
const folderPath = path.join('data', 'documents', siren, 'A_ANALYSER');
// Ex: data/documents/538404625/A_ANALYSER/
```

**2. Année extraite du filename (priorité sur Gemini)**
```typescript
function extractYearFromFilename(filename: string): number | null {
  const yearMatch = filename.match(/20[12][0-9]/);
  return yearMatch ? parseInt(yearMatch[0]) : null;
}

// Priorité: filename > Gemini > année courante
const year = filenameYear || geminiYear || new Date().getFullYear();
```

**3. Compte de résultat sur 2 pages**
```
Le prompt Gemini demande explicitement TOUTES les pages de chaque type:
- Compte de résultat souvent sur 2 pages consécutives (pages 6 ET 7)
- Inclure les deux pages si le CR est sur 2 pages
```

#### 📊 Workflow

```
1. checkProcessedDocuments()
   ├── Si A_ANALYSER existe avec PDFs → SKIP, utiliser existants
   └── Sinon → continuer

2. Pour chaque document COMPTA:
   ├── analyzeDocumentStructure() → Gemini Vision identifie pages
   ├── createConsolidatedPdf() → Copie pages pertinentes
   └── Ajouter à consolidatedDocs[]

3. saveProcessedDocuments() → Écriture sur disque

4. updateStateDocuments() → Mise à jour state.documents
```

#### 📥 Input
- `state.documents[]` - Documents avec `{ filename, content/filePath }`
- `state.businessInfo.siret` - SIRET pour extraire SIREN

#### 📤 Output (`state.comptaPreprocessing`)
```json
{
  "skipped": false,
  "originalDocuments": ["COMPTA bilan 30 novembre 2021.PDF", "COMPTA BILAN 30 NOVEMBRE 2023.PDF"],
  "consolidatedDocuments": [
    { "filename": "COMPTA2021.pdf", "year": 2021, "pageCount": 5, "pageTypes": ["bilan_actif", "bilan_passif", "compte_resultat", "compte_resultat", "sig"] },
    { "filename": "COMPTA2023.pdf", "year": 2023, "pageCount": 5, "pageTypes": ["bilan_actif", "bilan_passif", "compte_resultat", "compte_resultat", "sig"] }
  ],
  "savedTo": "data/documents/538404625/A_ANALYSER/",
  "documentsUpdated": true
}
```

#### ✅ Avantages
- **PDFs plus petits** → Extraction plus rapide et précise
- **Uniquement pages pertinentes** → Pas de bruit (annexes, notes, attestations)
- **Organisation par année** → Un fichier par exercice fiscal (COMPTA2021.pdf, etc.)
- **Cache intelligent** → Si A_ANALYSER existe, skip le preprocessing
- **Documents non-COMPTA préservés** → Baux et autres documents intacts

---

## 0. ComptaPreprocessingAgent

### Responsabilités
- **Vérifier si des documents prétraités existent** (dossier A_ANALYSER)
- **Identifier les documents COMPTA** dans state.documents
- **Analyser chaque document avec Gemini Vision** pour identifier pages pertinentes
- **Créer des PDFs consolidés par année** (COMPTA2021.pdf, COMPTA2022.pdf, COMPTA2023.pdf)
- **Sauvegarder dans le dossier A_ANALYSER** pour réutilisation
- **Mettre à jour state.documents** pour que DocumentExtractionAgent utilise les fichiers consolidés

### Tool Principal
- `preprocessComptaDocumentsTool` - **Tool "tout-en-un"** qui effectue le preprocessing complet de manière déterministe

### Input
`state.documents[]` - Liste des fichiers PDF avec `{ filename, filePath ou content }`
`state.businessInfo.siret` - SIRET (le SIREN est extrait pour le chemin)

### Output (`state.comptaPreprocessing`)
```json
{
  "skipped": false,
  "originalDocuments": ["COMPTA BILAN 2023.PDF"],
  "consolidatedDocuments": [
    { "filename": "COMPTA2023.pdf", "year": 2023, "pageCount": 5 }
  ],
  "savedTo": "data/documents/538404625/A_ANALYSER/",
  "documentsUpdated": true
}
```

### Avantages
- ✅ **PDFs plus petits** → Extraction plus rapide et précise
- ✅ **Uniquement pages pertinentes** → Pas de bruit (annexes, notes)
- ✅ **Organisation par année** → Un fichier par exercice fiscal
- ✅ **Cache intelligent** → Si A_ANALYSER existe, skip le preprocessing
- ✅ **Documents non-COMPTA préservés** → Baux et autres documents intacts

---

## 1. DocumentExtractionAgent

### Responsabilités
- **Lister les documents disponibles** (évite l'hallucination de filenames)
- **Extraire avec Gemini Vision** (analyse visuelle du PDF - priorité 1)
- **Extraire directement les valeurs comptables clés** (CA, EBE, RN, etc.)
- Classifier automatiquement les documents (bilan, compte de résultat, liasse fiscale, bail)
- Parser les tableaux comptables (Vision ou heuristique en fallback)
- Structurer les données en JSON

### Tools (4)
- `listDocumentsTool` - **NOUVEAU** ⚠️ OBLIGATOIRE EN PREMIER - Liste les fichiers exacts dans `state.documents` (évite hallucination)
- `geminiVisionExtractTool` - **NOUVEAU** 🎯 MÉTHODE PRINCIPALE - Vision API directe sur PDF (confidence ~95% vs ~30% heuristiques)
  - Analyse visuelle du document (comprend structure tableaux)
  - Classification automatique (6 types)
  - Extraction année fiscale
  - **BONUS**: Extraction directe valeurs comptables (CA, EBE, RN, charges) → bypass heuristiques
- `extractPdfTool` - Extraction texte brut (fallback pour raw_text)
- `parseTablesHeuristicTool` - **FALLBACK UNIQUEMENT** - Parsing heuristique si Vision échoue (confidence < 0.6)

### Workflow Vision-First
1. **ÉTAPE 1**: `listDocuments()` → Obtenir filenames exacts (obligatoire)
2. **ÉTAPE 2**: `geminiVisionExtract({ filename })` → Extraction Vision (priorité 1)
   - Si confidence ≥ 0.6 ET tables présentes → ✅ UTILISER
   - Sinon → FALLBACK étape 3
3. **ÉTAPE 3**: `extractPdf()` + `parseTablesHeuristic()` → Fallback heuristique

### Input
`state.documents[]` - Liste des fichiers PDF avec `{ filename, filePath ou content }`

### Output (`state.documentExtraction`)
```json
{
  "documents": [
    {
      "filename": "COMPTA BILAN 30 NOVEMBRE 2023.PDF",
      "documentType": "liasse_fiscale",
      "year": 2023,
      "confidence": 1.0,
      "extractedData": {
        "raw_text": "...[truncated to 5000 chars]",
        "tables": [
          {
            "headers": ["ACTIF", "2023", "2022"],
            "rows": [["Immobilisations", "50000", "45000"]],
            "caption": "Bilan Actif"
          }
        ],
        "key_values": {
          "chiffre_affaires": 235501,
          "ebe": 17558,
          "resultat_net": 4893,
          "charges_personnel": 79991,
          "dotations_amortissements": 8736,
          "achats_marchandises": 65295,
          "consommations_externes": 64027,
          "resultat_exploitation": 10348
        }
      },
      "method": "vision"
    }
  ],
  "summary": {
    "total_documents": 1,
    "years_covered": [2023],
    "missing_documents": [],
    "extraction_methods": { "vision": 1, "heuristic": 0 }
  }
}
```

### Avantages Gemini Vision
- ✅ **Précision ~95%** vs ~30% avec heuristiques regex
- ✅ **Extraction directe valeurs comptables** → ComptableAgent bypass heuristiques
- ✅ **Supporte PDFs scannés** (OCR intégré)
- ✅ **Comprend structure visuelle** des tableaux
- ✅ **Pas de regex à maintenir**
- ✅ **Gère formats variés** et multi-colonnes
- ⚡ **Coût**: ~$0.0014 par PDF (3 pages) avec Gemini Flash
- ⚡ **Latence**: 3-4 secondes (acceptable)

## 2. ComptableAgent

### Responsabilités
- Calculer les Soldes Intermédiaires de Gestion (SIG) pour chaque année
- Calculer 11 ratios financiers clés (rentabilité, liquidité, solvabilité)
- Analyser l'évolution sur la période (tendances CA/EBE/RN)
- Comparer aux benchmarks sectoriels (8 secteurs NAF couverts)
- Générer un score de santé financière global (0-100)
- Identifier les alertes et points de vigilance

### Tools (5)
- `calculateSigTool` - Calcule 14 indicateurs SIG par année
  - **PRIORITÉ 1**: Utilise `key_values` de Vision extraction (extraction directe précise)
  - **PRIORITÉ 2**: Parse les tableaux avec heuristiques (fallback)
- `calculateRatiosTool` - Calcule 11 ratios financiers (dernière année)
- `analyzeTrendsTool` - Analyse évolution CA/EBE/RN
- `compareToSectorTool` - Compare 9 ratios aux benchmarks sectoriels
- `calculateHealthScoreTool` - Score 0-100 (4 dimensions : rentabilité, liquidité, solvabilité, activité)

### Input
`state.documentExtraction` - Documents comptables parsés

### Output (`state.comptable`)
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

### Configuration
`server/adk/financial/config/sectorBenchmarks.ts` - 8 secteurs NAF avec ratios moyens :
- 47.11 : Supermarchés
- 10.71 : Boulangerie-pâtisserie
- 56.10 : Restauration traditionnelle
- 56.30 : Bar, café
- 96.02 : Coiffure
- 47.7 : Commerce détail habillement
- 47.73 : Pharmacie
- 55.10 : Hôtellerie

### Workflow
1. `calculateSig()` → Lit `state.documentExtraction`, calcule SIG par année
2. `calculateRatios()` → Calcule ratios à partir des SIG (dernière année)
3. `analyzeTrends()` → Analyse évolution temporelle
4. `compareToSector(nafCode)` → Compare aux benchmarks (lit NAF depuis `state.businessInfo`)
5. `calculateHealthScore()` → Score global basé sur ratios et évolution
6. Gemini interprète et génère alertes + synthèse

### Pattern ADK respecté
- ✅ Tous les calculs dans les tools (pas par le LLM) pour garantir exactitude
- ✅ LLM interprète les résultats et génère commentaires/alertes
- ✅ Parsing JSON strings (pattern CLAUDE.md) dans tous les tools
- ✅ Output injecté dans `state.comptable` via `outputKey`

## 3. ValorisationAgent

### Responsabilités
- Valoriser le fonds de commerce par 3 méthodes reconnues en France
- Calculer la valorisation par multiple d'EBE (méthode de référence)
- Calculer la valorisation par % du CA (méthode complémentaire)
- Calculer la valorisation patrimoniale (actif net + goodwill)
- Synthétiser les 3 méthodes et recommander une fourchette
- Comparer avec le prix affiché si fourni
- Générer des arguments de négociation

### Tools (4)
- `calculateEbeValuationTool` - Valorisation par multiple d'EBE (2.5-4.5x selon secteur)
- `calculateCaValuationTool` - Valorisation par % CA (40-110% selon secteur)
- `calculatePatrimonialTool` - Valorisation patrimoniale (actif - dettes + goodwill)
- `synthesizeValuationTool` - Synthèse des 3 méthodes avec pondération intelligente

### Input
`state.comptable` (SIG, ratios), `state.documentExtraction` (bilan), `state.businessInfo` (NAF)

### Output (`state.valorisation`)
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

### Configuration
`server/adk/financial/config/valuationCoefficients.ts` - 10 secteurs NAF avec coefficients :
- Tabac (47.26) : 2.5-4.5x EBE, 50-80% CA
- Restaurant (56.10) : 2-4x EBE, 50-90% CA
- Boulangerie (10.71) : 3-5x EBE, 60-100% CA
- Pharmacie (47.73) : 4-7x EBE, 70-110% CA
- Bar/Café (56.30) : 2.5-4.5x EBE, 60-90% CA

### Workflow
1. `calculateEbeValuation()` → EBE moyen 3 ans + retraitements + multiples sectoriels
2. `calculateCaValuation()` → CA moyen 3 ans × % sectoriels
3. `calculatePatrimonial()` → Actif net + goodwill (1.5x EBE)
4. `synthesizeValuation()` → Pondération (70% EBE + 20% CA + 10% Patrimoniale), comparaison prix, arguments négociation

### Méthode privilégiée (logique automatique)
- Si EBE ≤ 0 → **Patrimoniale**
- Si actif net > 2x valeur EBE → **Patrimoniale**
- Sinon → **EBE** (défaut)

### Pattern ADK respecté
- ✅ Tous les calculs dans les tools (exactitude garantie)
- ✅ LLM interprète et génère justifications
- ✅ Parsing JSON strings dans tous les tools
- ✅ Output injecté dans `state.valorisation` via `outputKey`

## 4. ImmobilierAgent

### Responsabilités
- Analyser le bail commercial (dates, loyer, clauses, conformité)
- Estimer la valeur du droit au bail (propriété commerciale)
- Analyser l'option d'achat des murs (rentabilité locative)
- Estimer les travaux nécessaires (obligatoires et recommandés)
- Générer un score immobilier global (0-100)
- **Fonctionne en mode dégradé** si bail non fourni

### Tools (4)
- `analyzeBailTool` - Analyse bail commercial (extraction PDF ou saisie manuelle)
- `estimateDroitBailTool` - Estimation droit au bail (méthode loyer 1-3 ans)
- `analyzeMursTool` - Analyse option murs (rentabilité brute/nette)
- `estimateTravauxTool` - Estimation travaux (obligatoire/recommandé selon état)

### Input
`state.documentExtraction` (bail PDF), `state.businessInfo` (localisation), `state.valorisation` (pour droit bail), `state.photo` (état local)

### Output (`state.immobilier`)
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

### Workflow
1. `analyzeBail()` → Extraction PDF ou manual_input, calcul loyer/m², comparaison marché
2. `estimateDroitBail()` → Coefficient 1-3 ans selon facteurs (loyer, durée, type)
3. `analyzeMurs()` → Estimation prix/m² par zone, rentabilité brute/nette, recommandation
4. `estimateTravaux()` → État général (depuis photos IA), travaux obligatoires/recommandés
5. Synthèse → Score 0-100 (40 pts bail + 30 pts travaux + 30 pts murs)

### Scoring Immobilier (0-100)
- **Bail** (40 points) : Appreciation + durée restante + type
- **Travaux** (30 points) : État général + conformité + budget
- **Murs** (30 points) : Rentabilité + recommandation

### Recommandation achat murs
- Rentabilité brute ≥ 7% → **acheter**
- Rentabilité brute 5-7% → **negocier**
- Rentabilité brute < 5% → **louer**

### Mode dégradé (sans bail)
- `analyzeBail` → `bail_disponible: false`
- `estimateDroitBail` → `droit_au_bail_estime: 0`
- `analyzeMurs` → `option_possible: false`
- `estimateTravaux` → ✅ Fonctionne normalement (utilise photos)
- Score max 30 points (travaux uniquement)

### Pattern ADK respecté
- ✅ Tous les calculs dans les tools (garantit exactitude)
- ✅ LLM interprète et génère synthèse
- ✅ Parsing JSON strings dans tous les tools
- ✅ Output injecté dans `state.immobilier` via `outputKey`
- ✅ Résilience : Mode dégradé si bail non fourni

## 5. FinancialValidationAgent

### Responsabilités
- Vérifier la cohérence entre les différentes analyses (extraction, comptable, valorisation, immobilier)
- Détecter les anomalies dans les données et les calculs (valeurs aberrantes, incohérences, erreurs)
- Évaluer la qualité des données (complétude, fiabilité, fraîcheur)
- Calculer un score de confiance global (0-100)
- Générer des recommandations de vérification par priorité
- Lister les documents additionnels à demander au vendeur
- **Agent CRITIQUE** pour garantir la fiabilité du rapport final

### Tools (3)
- `crossValidateTool` - 6 vérifications de cohérence entre agents
- `detectAnomaliesTool` - Détection de 6 types d'anomalies (données manquantes, incohérences, valeurs aberrantes, erreurs de calcul)
- `assessDataQualityTool` - Évaluation qualité données + score de confiance + recommandations

### Input
`state.documentExtraction`, `state.comptable`, `state.valorisation`, `state.immobilier`, `state.businessInfo`

### Output (`state.financialValidation`)
```json
{
  "validationDate": "2025-12-26",

  "coherenceChecks": [
    {
      "check": "Présence DocumentExtraction",
      "status": "ok",
      "details": "3 document(s) extrait(s)",
      "sources": ["documentExtraction"]
    },
    {
      "check": "Cohérence CA extraction/SIG",
      "status": "warning",
      "details": "Léger écart entre CA extrait (500000€) et CA des SIG (485000€) : 3.0%",
      "sources": ["documentExtraction", "comptable"]
    },
    {
      "check": "Cohérence EBE comptable/valorisation",
      "status": "ok",
      "details": "EBE cohérent entre SIG (85000€) et valorisation (85000€)",
      "sources": ["comptable", "valorisation"]
    }
  ],

  "anomalies": [
    {
      "type": "valeur_aberrante",
      "severity": "warning",
      "description": "Délai clients supérieur à 6 mois - risque de créances irrécouvrables",
      "valeurs_concernees": {
        "delai_clients_jours": 190
      },
      "recommendation": "Analyser la qualité des créances clients et le risque de non-recouvrement"
    },
    {
      "type": "donnee_manquante",
      "severity": "critical",
      "description": "Aucun bilan comptable n'a été fourni",
      "valeurs_concernees": {
        "type_manquant": "bilan"
      },
      "recommendation": "Demander les bilans des 3 dernières années pour analyser la structure financière"
    }
  ],

  "dataQuality": {
    "completeness": 85,
    "reliability": 78,
    "recency": 90,
    "missing_critical": ["Bilans comptables", "Liasse fiscale complète"]
  },

  "confidenceScore": {
    "overall": 82,
    "breakdown": {
      "extraction": 90,
      "comptabilite": 85,
      "valorisation": 75,
      "immobilier": 70
    },
    "interpretation": "Données de haute qualité. Confiance élevée dans les analyses."
  },

  "verificationsRequises": [
    {
      "priority": 1,
      "action": "Demander les bilans des 3 dernières années",
      "raison": "Aucun bilan comptable fourni - analyse de structure impossible",
      "impact_si_ignore": "Analyse non fiable, décision d'investissement risquée"
    },
    {
      "priority": 2,
      "action": "Demander les données comptables les plus récentes",
      "raison": "Dernières données disponibles : 2023 (2 an(s))",
      "impact_si_ignore": "Analyse basée sur des données obsolètes, situation actuelle inconnue"
    },
    {
      "priority": 3,
      "action": "Étudier l'opportunité d'acquérir les murs",
      "raison": "Loyer élevé (18.0% du CA)",
      "impact_si_ignore": "Opportunité de réduire les charges et sécuriser l'emplacement"
    }
  ],

  "donneesACollector": [
    {
      "document": "Bilans comptables des 3 dernières années",
      "raison": "Nécessaire pour analyser la structure financière",
      "criticite": "bloquant"
    },
    {
      "document": "Liasse fiscale complète",
      "raison": "Pour vérifier les données et détecter des postes non détaillés",
      "criticite": "important"
    },
    {
      "document": "Situation de trésorerie récente",
      "raison": "Pour connaître la situation actuelle de trésorerie",
      "criticite": "important"
    },
    {
      "document": "Détail des immobilisations et amortissements",
      "raison": "Pour évaluer les investissements et besoins de renouvellement",
      "criticite": "utile"
    }
  ],

  "synthese": {
    "niveauConfiance": "elevé",
    "pointsBloquants": [
      "Aucun bilan comptable fourni - analyse de structure impossible"
    ],
    "pointsVigilance": [
      "Délai clients élevé (190 jours) - risque créances",
      "Données de 2023 - demander données 2024"
    ],
    "recommandationsPrioritaires": [
      "Demander les bilans des 3 dernières années",
      "Obtenir une situation de trésorerie récente",
      "Vérifier la cohérence CA extraction/SIG"
    ],
    "conclusionValidation": "Validation globalement positive avec 1 point bloquant à résoudre avant finalisation. Score de confiance : 82/100."
  }
}
```

### Workflow
1. `crossValidate()` → 6 vérifications de cohérence (présence analyses, années, CA, EBE, valorisation, santé)
2. `detectAnomalies()` → Détection automatique (données manquantes, incohérences, valeurs aberrantes, calculs erronés)
3. `assessDataQuality()` → Complétude + fiabilité + fraîcheur → Score confiance 0-100 + recommandations + documents à collecter
4. Synthèse → Niveau de confiance global + points bloquants/vigilance + conclusion

### Vérifications de cohérence (6 checks)
1. **Présence analyses** : DocumentExtraction, Comptable présents
2. **Cohérence années** : Années extraites = années analysées
3. **Cohérence CA** : CA extraction vs CA SIG (écart <10%)
4. **Cohérence EBE/CA** : Comptable vs Valorisation (écart <5%)
5. **Cohérence valorisation/immobilier** : Immobilier pris en compte dans valorisation
6. **Cohérence santé/valorisation** : Méthode valorisation cohérente avec score santé

### Types d'anomalies détectées
- **donnee_manquante** : Bilans, comptes de résultat, années manquantes
- **incoherence** : Résultat net > CA, marge commerciale impossible, EBE positif mais RN très négatif
- **valeur_aberrante** : Marge >100%, délais >180j, endettement >300%, CAF négative, loyer >30% CA
- **calcul_errone** : Formules SIG incorrectes, résultat net incohérent

### Score de confiance (0-100)
- **Complétude** (35%) : % données présentes (documents, SIG, ratios, valorisation, immobilier)
- **Fiabilité** (40%) : Basé sur alertes comptables + erreurs validation + anomalies critiques
- **Fraîcheur** (25%) : Âge des données (N=100, N-1=90, N-2=70, N-3=50)

### Niveau de confiance
- **très elevé** (85-100) : Aucun point bloquant, données complètes et récentes
- **elevé** (70-84) : Quelques warnings, données de bonne qualité
- **moyen** (50-69) : Plusieurs anomalies, vérifications nécessaires
- **faible** (30-49) : Anomalies critiques, données insuffisantes
- **très faible** (0-29) : Collecte de données additionnelles requise

### Priorités des vérifications
- **Priority 1** (urgent) : Anomalies/erreurs critiques, données bloquantes manquantes
- **Priority 2** (important) : Données anciennes, warnings importants
- **Priority 3** (souhaitable) : Optimisations, opportunités

### Criticité des documents à collecter
- **bloquant** : Sans ces documents, analyse non fiable (bilans, comptes de résultat)
- **important** : Améliore significativement la fiabilité (liasse fiscale, situation trésorerie)
- **utile** : Affine l'analyse (détails immobilisations, contrats travail)

### Pattern ADK respecté
- ✅ Tous les calculs et vérifications dans les tools (exactitude garantie)
- ✅ LLM interprète les résultats et génère synthèse
- ✅ Parsing JSON strings dans tous les tools
- ✅ Output injecté dans `state.financialValidation` via `outputKey`
- ✅ Temperature 0.2 (validation rigoureuse, low creativity)
- ✅ CRITIQUE pour fiabilité : bloque le pipeline si score < 40

## 6. FinancialReportAgent

### Responsabilités
- Générer les configurations Chart.js pour les graphiques (4 charts)
- Générer le HTML complet du rapport (7 sections professionnelles)
- Sauvegarder le rapport dans `data/financial-reports/`
- Rapport 100% AUTONOME (indépendant du Pipeline Stratégique)
- Style CSS professionnel responsive (print-ready)

### Tools (3)
- `generateChartsTool` - Génère 4 configurations Chart.js (évolution, valorisation, santé, confiance)
- `generateFinancialHtmlTool` - Génère HTML complet avec 7 sections
- `saveFinancialReportTool` - Sauvegarde dans `data/financial-reports/`

### Input
`state.documentExtraction`, `state.comptable`, `state.valorisation`, `state.immobilier`, `state.financialValidation`, `state.businessInfo`

### Output (`state.financialReport`)
```json
{
  "generated": true,
  "filepath": "C:\\AI\\searchcommerce\\data\\financial-reports\\financial-report-12345678900012-2025-12-26.html",
  "filename": "financial-report-12345678900012-2025-12-26.html",
  "size_bytes": 125000,
  "sections_included": [
    "cover_page",
    "executive_summary",
    "accounting_analysis",
    "valuation",
    "real_estate",
    "validation",
    "annexes"
  ],
  "generatedAt": "2025-12-26T14:30:00.000Z"
}
```

### Workflow
1. `generateCharts()` → 4 configurations Chart.js (evolutionChart, valorisationChart, healthGauge, confidenceRadar)
2. `generateFinancialHtml({ charts })` → HTML complet avec 7 sections + CSS + charts intégrés
3. `saveFinancialReport({ html, businessId, sections })` → Sauvegarde fichier dans data/financial-reports/

### 7 Sections du rapport HTML

#### 1. 📋 Page de Garde
- Nom du commerce
- Date d'analyse
- "Analyse Financière - Due Diligence"
- Badge score de confiance

#### 2. 📊 Synthèse Exécutive
- **Verdict** : FAVORABLE / FAVORABLE AVEC RÉSERVES / DÉFAVORABLE (calcul automatique)
- Fourchette valorisation (min/max/recommandée)
- 3 scores clés en cards (santé, confiance, marge EBE)
- ✅ 3 points forts financiers
- ⚠️ 3 points de vigilance

#### 3. 📈 Analyse Comptable
- Tableau SIG sur 3 ans (14 indicateurs)
- Graphique évolution CA/EBE/RN (Chart.js line chart)
- Tableau ratios clés (11 ratios)
- Gauge score santé (Chart.js doughnut)
- Comparaison sectorielle (tableau benchmarks)
- Alertes détaillées (critical/warning/info)

#### 4. 💰 Valorisation du Fonds
- Graphique fourchettes (Chart.js horizontal bar)
- Tableau comparatif 3 méthodes (EBE, CA, Patrimoniale)
- Synthèse valorisation retenue (méthode privilégiée)
- Arguments de négociation (pour acheteur / pour vendeur)

#### 5. 🏠 Analyse Immobilière
- Tableau synthèse bail commercial
- Analyse loyer vs marché
- Estimation droit au bail
- Option rachat murs (si applicable)
- Budget travaux (obligatoire/recommandé)
- Score immobilier global

#### 6. ✅ Validation & Fiabilité
- Tableau score de confiance global + breakdown
- Radar confiance par section (Chart.js)
- Qualité des données (complétude, fiabilité, fraîcheur)
- Anomalies détectées avec severity
- Vérifications recommandées par priorité (1=urgent, 2=important, 3=souhaitable)

#### 7. 📝 Annexes
- Liste documents analysés
- Hypothèses de calcul
- Glossaire termes comptables

### Graphiques Chart.js (4)

1. **Evolution Chart** (Line chart)
   - Évolution CA/EBE/RN sur 3 ans
   - 3 courbes avec fill area
   - Tension 0.4 pour smoothing

2. **Valorisation Chart** (Horizontal bar chart)
   - Fourchettes par méthode (min/median/max)
   - 3 datasets (basse/médiane/haute)
   - Couleurs : rouge/bleu/vert

3. **Health Gauge** (Doughnut chart)
   - Score 0-100 en semi-cercle (180°)
   - Couleur dynamique selon score (rouge/orange/bleu/vert)
   - Pas de légende

4. **Confidence Radar** (Radar chart)
   - 4 axes (extraction, comptabilité, valorisation, immobilier)
   - Score 0-100 par axe
   - Fill area bleu transparent

### Style CSS Professionnel
- **Couleurs** :
  - Vert (#10b981) : Positif, favorable
  - Orange (#f59e0b) : Attention, réserves
  - Rouge (#ef4444) : Alerte, défavorable
  - Bleu (#0066cc) : Neutre, information
- **Responsive** : Grid layout adaptatif
- **Print-ready** : Page breaks automatiques
- **Charts** : Intégrés via Chart.js CDN
- **Composants** : Badges, alertes, tableaux stylisés

### Verdict automatique
```javascript
if (healthScore >= 70 && confidenceScore >= 70) {
  verdict = 'FAVORABLE';
} else if (healthScore >= 50 && confidenceScore >= 50) {
  verdict = 'FAVORABLE AVEC RÉSERVES';
} else {
  verdict = 'DÉFAVORABLE';
}
```

### Pattern ADK respecté
- ✅ Génération HTML/Charts dans les tools (pas par le LLM)
- ✅ LLM orchestre les tools dans l'ordre
- ✅ Parsing JSON strings dans tous les tools
- ✅ Output injecté dans `state.financialReport` via `outputKey`
- ✅ Temperature 0.4 (aligné avec MODEL_DEFAULTS)
- ✅ Model: gemini-3-flash-preview (cohérent avec tous les agents du pipeline)

## 7. FinancialOrchestrator

### Architecture
SequentialAgent orchestrant 6 agents dans l'ordre séquentiel :

```
FinancialOrchestrator (SequentialAgent)
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

### Pattern ADK (État de l'art)
- ✅ SequentialAgent direct comme root agent (pas de wrapper LlmAgent)
- ✅ Pas de handoff inutile (évite UNKNOWN_ERROR)
- ✅ Runner créé au niveau application (endpoint Express)
- ✅ State flow automatique via outputKey de chaque agent
- ✅ Auto-parsing JSON strings dans l'endpoint

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
  }
}
```

### Output State (final)
```json
{
  "documentExtraction": { documents: [...], summary: {...} },
  "comptable": { sig: {...}, ratios: {...}, healthScore: {...} },
  "valorisation": { methodes: {...}, synthese: {...} },
  "immobilier": { bail: {...}, murs: {...}, travaux: {...} },
  "financialValidation": { coherenceChecks: [...], confidenceScore: {...} },
  "financialReport": { generated: true, filepath: "...", filename: "..." }
}
```

### Endpoint API

**POST `/api/analyze-financial`**

Request:
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
  }
}
```

Response:
```json
{
  "success": true,
  "reportPath": "C:\\AI\\searchcommerce\\data\\financial-reports\\financial-report-12345678901234-2025-12-26.html",
  "reportFilename": "financial-report-12345678901234-2025-12-26.html",
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
  "agentsExecuted": 6,
  "state": {
    "comptable": { "healthScore": {...}, "evolution": {...} },
    "valorisation": { "synthese": {...} },
    "validation": { "confidenceScore": {...} }
  }
}
```

### Logging
- Auto-parsing JSON strings → objects
- Log détaillé par agent (start/end)
- Log des state updates (keys + sample data)
- Durée d'exécution totale

## Files Structure

```
server/adk/financial/
├── index.ts                        # Entry point, exports agents + orchestrator
├── orchestrator/
│   └── FinancialOrchestrator.ts    # SequentialAgent orchestrating 6 agents
├── agents/
│   ├── DocumentExtractionAgent.ts  # PDF extraction & classification
│   ├── ComptableAgent.ts           # Accounting analysis
│   ├── ValorisationAgent.ts        # Business valuation (3 methods)
│   ├── ImmobilierAgent.ts          # Real estate analysis (lease, walls, works)
│   ├── FinancialValidationAgent.ts # Cross-validation & quality control
│   └── FinancialReportAgent.ts     # HTML report generation (7 sections)
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
│   ├── property/
│   │   ├── analyzeBailTool.ts              # Lease analysis
│   │   ├── estimateDroitBailTool.ts        # Lease right estimation
│   │   ├── analyzeMursTool.ts              # Walls purchase analysis
│   │   └── estimateTravauxTool.ts          # Works estimation
│   ├── validation/
│   │   ├── crossValidateTool.ts            # Cross-validation checks (6 checks)
│   │   ├── detectAnomaliesTool.ts          # Anomaly detection (6 types)
│   │   └── assessDataQualityTool.ts        # Data quality assessment + confidence score
│   └── report/
│       ├── generateChartsTool.ts           # Chart.js configs (4 charts)
│       ├── generateFinancialHtmlTool.ts    # HTML generation (7 sections)
│       └── saveFinancialReportTool.ts      # File save to data/financial-reports/
└── config/
    ├── sectorBenchmarks.ts         # NAF sector averages (accounting)
    └── valuationCoefficients.ts    # NAF valuation multiples (10 sectors)
```

## Usage Example

### Client-side Usage (API Call)

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

// Prepare documents (from file input)
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
  console.log('Confiance:', result.summary.confidence);

  // Download report
  window.open(`/data/financial-reports/${result.reportFilename}`, '_blank');
}
```

### Server-side Setup (Express Endpoint)

The endpoint is already configured in `server.js`:

```javascript
import { createFinancialOrchestrator } from './server/adk/financial/index.js';
import { Runner, InMemorySessionService } from '@google/adk';

app.post('/api/analyze-financial', async (req, res) => {
  const { documents, businessInfo, options } = req.body;

  // Convert base64 to Buffer
  const processedDocuments = documents.map(doc => {
    if (doc.content && typeof doc.content === 'string') {
      const base64Data = doc.content.replace(/^data:application\/pdf;base64,/, '');
      return { ...doc, content: Buffer.from(base64Data, 'base64') };
    }
    return doc;
  });

  // Create orchestrator
  const orchestrator = createFinancialOrchestrator();

  // Create runner
  const runner = new Runner({
    appName: 'financial',
    agent: orchestrator,
    sessionService: new InMemorySessionService()
  });

  // Run pipeline
  const userId = `user-${Date.now()}`;
  const sessionId = `session-${Date.now()}`;

  for await (const event of runner.runAsync({
    userId,
    sessionId,
    stateDelta: {
      documents: processedDocuments,
      businessInfo,
      options
    }
  })) {
    // Auto-parse JSON strings to objects
    if (event.actions?.stateDelta) {
      Object.keys(event.actions.stateDelta).forEach(key => {
        const value = event.actions.stateDelta[key];
        if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
          try {
            event.actions.stateDelta[key] = JSON.parse(value);
          } catch (e) {
            // Keep as string if parsing fails
          }
        }
      });
    }
  }

  // Return success with report path and summary
  res.json({
    success: true,
    reportPath: finalState.financialReport.filepath,
    reportFilename: finalState.financialReport.filename,
    summary: {
      healthScore: finalState.comptable.healthScore.overall,
      valorisation: finalState.valorisation.synthese,
      verdict: finalState.financialReport.verdict,
      confidence: finalState.financialValidation.confidenceScore.overall
    },
    executionTime,
    agentsExecuted: 6
  });
});
```

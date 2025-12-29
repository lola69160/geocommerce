# Financial Pipeline - Changelog

Ce document contient l'historique des améliorations du Financial Pipeline.

---

## Recent Improvements (2025-12-29)

### Transaction Cost Document Detection & Extraction

Amélioration de la détection et extraction des documents de coûts de transaction (offres d'achat, projets de financement).

#### Problème Résolu

**Avant**: Le document `Cout_transaction_Mme_Ardouin_offre_.pdf` était classé `projet_vente` et seul le "CA" de 465 000 € était extrait (qui était en réalité le total investissement, pas un CA).

**Après**: Le document est détecté par pattern de nom de fichier et `extractTransactionCostsTool` est appelé, extrayant toutes les données financières.

#### Détection par Pattern de Nom de Fichier

**Fichier:** `geminiVisionExtractTool.ts`

```typescript
export function detectTransactionCostDocument(filename: string): boolean {
  const patterns = [
    /cout.*transaction/i,
    /transaction.*cout/i,
    /offre.*achat/i,
    /cout.*acquisition/i,
    /financement.*acquisition/i,
    /projet.*financement/i
  ];
  return patterns.some(p => p.test(filename));
}
```

#### Instruction Agent Mise à Jour

**Fichier:** `DocumentExtractionAgent.ts`

L'agent appelle maintenant `extractTransactionCostsTool` pour:
- Documents classés `cout_transaction`
- Documents classés `projet_vente` MAIS dont le nom contient un pattern de transaction

#### Logging Complet

**Fichier:** `extractionLogger.ts` - Fonction `logTransactionCosts()` enrichie:

```
════════════════════════════════════════════════════════════════════════════════
  📊 EXTRACTION LOG - DOCUMENT
────────────────────────────────────────────────────────────────────────────────
  📁 Source:    extractTransactionCostsTool
  🏢 SIRET:     53840462500013
────────────────────────────────────────────────────────────────────────────────
  📈 Données Extraites:
    ──────────────── COÛTS D'ACQUISITION:
    prix_fonds                      : 350 000 €
    honoraires_ht                   : 35 000 €
    frais_acte_ht                   : 12 000 €
    droits_enregistrement           : 18 000 €
    stock_fonds_roulement           : 30 000 €
    ──────────────────────────────
    TOTAL INVESTISSEMENT            : 465 000 €
    ──────────────── FINANCEMENT:
    apport_requis                   : 100 000 €
    credit_sollicite                : 365 000 €
    duree_credit                    : 84 mois
    taux_credit                     : 4.5%
    mensualites                     : 5 200 €
════════════════════════════════════════════════════════════════════════════════
```

#### Fichiers Modifiés

| Fichier | Modification |
|---------|--------------|
| `geminiVisionExtractTool.ts` | Nouvelle fonction `detectTransactionCostDocument()` (exportée) |
| `DocumentExtractionAgent.ts` | Instruction enrichie pour appeler le tool sur pattern de nom |
| `extractionLogger.ts` | `logTransactionCosts()` enrichie avec tous les champs |
| `extractTransactionCostsTool.ts` | Appel au logger après extraction réussie |

---

### Extraction Logging System v2: Session-Based Architecture

Refonte complète du système de logging pour une traçabilité complète de chaque analyse financière.

#### Architecture

**Session-based logging**: Un fichier de log par analyse (plus de logs journaliers agrégés).

```
logs/extraction_20251229_143052_53840462500013.log
                 ^^^^^^^^ ^^^^^^ ^^^^^^^^^^^^^^
                 Date     Heure  SIRET
```

**Unified JS/TS Logging**: Les modules JavaScript et TypeScript partagent le même session store.

**Duplicate Protection**: Le système empêche les logs en double via tracking des entrées.

#### Nouveaux Fichiers

| Fichier | Description |
|---------|-------------|
| `server/extractionSessionStore.js` | **Session store partagé** (Map JS/TS unifiée) |

#### Catégories de Log Complètes

| Catégorie | Source | Description |
|-----------|--------|-------------|
| `DOCUMENT` | `geminiVisionExtractTool.ts` | Données extraites des PDFs |
| `USER_COMMENT` | `server.js` | Commentaires utilisateur |
| `SIG` | `calculateSigTool.ts` | Soldes Intermédiaires de Gestion |
| `EBE_RETRAITEMENT` | `calculateEbeRetraitementTool.ts` | Retraitements EBE (comptable → normatif) |
| `VALORISATION` | `synthesizeValuationTool.ts` | Résultats de valorisation (3 méthodes) |
| `IMMOBILIER` | `calculateLoyerSimulationTool.ts` | Simulation loyer et bail |
| `BUSINESS_PLAN` | `businessPlanDynamiqueTool.ts` | Projections 5 ans + indicateurs bancaires |

#### Session Store API

```javascript
// server/extractionSessionStore.js
setSessionLogFile(siret, logFilePath)  // Démarrer session
getSessionLogFile(siret)               // Récupérer chemin log
hasSession(siret)                      // Vérifier si session existe
hasBeenLogged(siret, category, source, year)  // Anti-doublon
markAsLogged(siret, category, source, year)   // Marquer comme loggé
```

#### Fonctions de Logging Disponibles

```typescript
// TypeScript (extractionLogger.ts)
logDocumentExtraction(filename, siret, year, documentType, extractedData, confidence)
logUserComments(siret, userComments)
logSigCalculation(siret, year, sig, pctCA)
logEbeRetraitement(siret, year, ebeComptable, ebeNormatif, retraitements)
logValorisation(siret, valorisation)
logImmobilier(siret, immobilier)
logBusinessPlan(siret, businessPlan)  // ✨ NOUVEAU
```

#### Exemple de Log Complet

```
════════════════════════════════════════════════════════════════════════════════
  📊 EXTRACTION LOG - BUSINESS_PLAN
────────────────────────────────────────────────────────────────────────────────
  ⏰ Timestamp: 2025-12-29T14:30:52.000Z
  📁 Source:    businessPlanDynamiqueTool
  🏢 SIRET:     53840462500013
────────────────────────────────────────────────────────────────────────────────
  📈 Données Extraites:
    ──────────────── PROJECTIONS 5 ANS:
    Année 0 (Actuel)          : CA: 235 501 € | EBE: 17 558 € | Reste: 17 558 €
    Année 1 (Reprise)         : CA: 270 826 € | EBE: 52 883 € | Reste: 23 883 €
    Année 5 (Croisière)       : CA: 295 000 € | EBE: 72 000 € | Reste: 43 000 €
    ──────────────── INDICATEURS BANCAIRES:
    ratio_couverture_dette    : 1.82x (cible > 1.5)
    rentabilite_roi           : 18.5%
    appreciation              : bon
════════════════════════════════════════════════════════════════════════════════
```

#### Fichiers Modifiés

| Fichier | Modification |
|---------|--------------|
| `server/extractionSessionStore.js` | **Nouveau** - Session store partagé |
| `server/adk/utils/extractionLogger.ts` | Import session store + `logBusinessPlan()` |
| `server/extractionLogger.js` | Import session store |
| `server.js` | Appel `startExtractionSession()` / `endExtractionSession()` |
| `calculateEbeRetraitementTool.ts` | Ajout logging EBE_RETRAITEMENT |
| `synthesizeValuationTool.ts` | Ajout logging VALORISATION |
| `calculateLoyerSimulationTool.ts` | Ajout logging IMMOBILIER |
| `businessPlanDynamiqueTool.ts` | Ajout logging BUSINESS_PLAN |

---

### opportunitySection.ts: Fix 403 Forbidden Gemini API

**Problème:** L'initialisation de `GoogleGenerativeAI` au niveau module causait une erreur 403 car `GEMINI_API_KEY` n'était pas chargée au moment de l'import.

**Solution:**
```typescript
// ❌ AVANT (erreur 403)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ✅ APRÈS (fonctionne)
async function generateStrategicText(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return '';
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  // ...
}
```

**Modèle:** `gemini-2.0-flash-exp` → `gemini-2.0-flash` (modèle stable)

---

### User Comments: Extraction loyer_actuel_mensuel

**Problème:** Le pattern `loyer_actuel_mensuel` n'était pas extrait des commentaires utilisateur.

**Solution:** Ajout de regex dans `parseNaturalLanguageUserComments()` (server.js):

```javascript
const loyerActuelPatterns = [
  /loyer\s*(?:mensuel\s*)?actuel\s*(?:de\s*)?([\d\s]+)\s*€/i,
  /loyer\s*(?:mensuel\s*)?(?:de\s*)?([\d\s]+)\s*€.*?(?:descendu|négocié)/i
];
```

---

### SIG Calculation Bug Fixes (Critical)

**Problème identifié:** Erreurs de calcul en cascade dans `calculateSigTool.ts` causant des valeurs incorrectes dans les rapports financiers.

#### Tableau d'Erreurs Corrigées

| Champ | Valeur Erronée | Valeur Correcte | Impact |
|-------|----------------|-----------------|--------|
| marge_commerciale | = CA (235 501 €) | 42 746 € | **-82%** |
| valeur_ajoutee | = CA (235 501 €) | 99 725 € | **-58%** |
| ebe | 160 785 € | 17 558 € | **-89%** |
| resultat_net | 160 785 € | 4 893 € | **-97%** |
| total_general_actif | 585 486 € (Brut) | 507 080 € (Net) | **-13%** |
| pct_marge | 100% | ~37% | Incorrect |
| pct_va | 100% | ~42% | Incorrect |
| pct_ebe | 68.3% | ~7.5% | Incorrect |

#### Cause Racine #1: Bug Ligne 302 (calculateSigTool.ts)

```typescript
// ❌ AVANT (BUG):
ventes_marchandises: kv.chiffre_affaires || 0, // Utilisait CA comme fallback!

// ✅ APRÈS (FIX):
ventes_marchandises: kv.ventes_marchandises || 0, // Utilise la vraie valeur
```

**Cascade d'erreurs:**
1. `ventes_marchandises = CA` (au lieu de la vraie valeur)
2. `marge_commerciale = ventes - achats = CA - 0 = CA` ❌
3. `valeur_ajoutee ≈ CA` ❌
4. `ebe` et `resultat_net` faux ❌
5. Tous les `% CA` = 100% ❌

#### Solution Implémentée

**1. Valeurs Directes SIG (calculateSigTool.ts)**

Ajout de 5 nouveaux champs pour utiliser les valeurs SIG extraites directement:

```typescript
marge_commerciale_directe: kv.marge_commerciale || 0,
valeur_ajoutee_directe: kv.valeur_ajoutee || 0,
ebe_direct: kv.ebe || 0,
resultat_exploitation_direct: kv.resultat_exploitation || 0,
resultat_net_direct: kv.resultat_net || 0
```

**2. Logique de Calcul Intelligente**

```typescript
// Utiliser valeur directe SI disponible, sinon calculer
const marge_commerciale = values.marge_commerciale_directe > 0
  ? values.marge_commerciale_directe  // ✅ Valeur extraite directement
  : (values.ventes_marchandises - values.achats_marchandises);  // Fallback calcul
```

**3. Validation Automatique**

```typescript
// Alerte si marge ≈ CA (erreur probable)
if (marge_commerciale >= values.chiffre_affaires * 0.95) {
  console.warn(`⚠️ ALERTE: marge_commerciale ≈ CA - possible erreur!`);
}
```

#### Cause Racine #2: Confusion Brut/Net (geminiVisionExtractTool.ts)

**Problème:** `total_general_actif` extrayait la valeur BRUT au lieu de NET.

**Solution:** Ajout d'instructions explicites dans le prompt:

```
⚠️ IMPORTANT: Pour le BILAN ACTIF, les colonnes typiques sont: Brut | Amort | Net
→ TOUJOURS utiliser la colonne NET pour total_general_actif!
```

#### Fichiers Modifiés

| Fichier | Modifications |
|---------|---------------|
| `calculateSigTool.ts` | Ligne 302 fix, valeurs directes, validation |
| `geminiVisionExtractTool.ts` | Prompt NET clarification, ventes_marchandises key_values |

#### Nouveaux key_values Disponibles

```typescript
key_values: {
  ventes_marchandises: ...,    // ✅ NOUVEAU
  achats_marchandises: ...,    // Amélioré avec fallback SIG
  marge_commerciale: ...,
  valeur_ajoutee: ...,
  // ... autres champs existants
}
```

---

## Recent Improvements (2025-12-28)

### Refonte Section Valorisation Tabac/Presse

Complete redesign of the Valuation section for Tabac/Presse businesses (NAF 47.26Z) with professional presentation and high readability.

**New Display Structure:**

1. **Tableau "Valorisation Théorique du Fonds"** (5 colonnes)

   | Composante | Base | Min | Médian | Max |
   |------------|------|-----|--------|-----|
   | Commissions 2023 (Tabac+Loto+Presse+FDJ) | xxx k€ | × coef | × coef | × coef |
   | Marchandises 2023 (Souvenirs+Confiserie+Vape) | xxx k€ | % | % | % |
   | **TOTAL VALEUR INTRINSÈQUE** | — | xxx € | xxx € | xxx € |

2. **Tableau "Plan de Financement Total (Besoin)"** (4 colonnes)

   | Élément | Min | Médian | Max |
   |---------|-----|--------|-----|
   | Prix de cession négocié | xxx € | xxx € | xxx € |
   | Travaux de Modernisation | xxx € | xxx € | xxx € |
   | (-) Subvention Douanes | -30 000 € | -30 000 € | -30 000 € |
   | Frais & Stock | 10 000 € | 15 000 € | 20 000 € |
   | **TOTAL INVESTISSEMENT** | xxx € | xxx € | xxx € |

3. **Indicateur Apport Personnel** - Carte visuelle verte avec montant et %

**Éléments supprimés pour Tabac:**
- ❌ Graphique Chart.js (non pertinent pour méthode hybride)
- ❌ Tableau comparatif 3 méthodes (EBE/CA/Patrimoniale)
- ❌ Calculs basés sur EBE historique

**Éléments conservés:**
- ✅ Facteurs Valorisants (liste à puces texte noir)
- ✅ Encadré Méthode (fond orange clair + bordure + texte foncé)
- ✅ Synthèse valorisation retenue
- ✅ Arguments de négociation

**Valeurs fixes:**
- Subvention Douanes: -30 000 € (aide standard)
- Frais & Stock: 10k€ / 15k€ / 20k€ (min/median/max)

**CSS amélioré (WCAG AA):**
- Montants en **gras bleu foncé** (#1e3a8a)
- Facteurs Valorisants en **texte noir** (#0f172a)
- Pas d'effets d'opacité/transparence
- Compatible impression

**Fichiers modifiés:**
- `sections/valuationSection.ts` - Nouvelle fonction `generateTabacValuationSection()`
- `styles/index.ts` - +120 lignes CSS pour Tabac
- `generateFinancialHtmlTool.ts` - Passage `userComments` et `options` à la section

**Nouvelle signature:**
```typescript
generateValuationSection(
  valorisation, valorisationChart, documentExtraction,
  userComments,  // Pour travaux.budget_prevu et apport_personnel
  options        // Pour prixAffiche
)
```

---

### Table Readability Improvements (Mode Hybride)

Improved readability of financial report tables by applying neutral backgrounds and keeping colors only on badges and amounts.

**Problem:**
- EBE Retraitement table: Colored backgrounds made text hard to read
- Valorisation Hybride table: Ultra-light backgrounds (`#f0f8ff`, `#fff8e1`) had insufficient contrast

**Solution: Mode Hybride**
- Neutral table backgrounds (white/light gray)
- Visual separators (thick black borders) to distinguish sections
- Colors kept **only** on amounts (+/-) and badges
- Replaced hardcoded colors with CSS variables

**File Modified:**
- `tools/report/generateFinancialHtmlTool.ts` - 12 inline style modifications

---

### UserComments Opening Hours Detection in Strategic Comments

Fixed issue where "Leviers identifiés" section displayed "Extension horaires d'ouverture (actuellement non renseigné)" even when the user explicitly mentioned opening hours extension plans in `userComments.autres`.

#### Problem
The strategic commentary in section 8 "OPPORTUNITÉS DE CROISSANCE" checked `businessInfo?.horaires_fermeture` (Google Places current hours) instead of parsing `userComments.autres` for the buyer's plans.

#### Solution
New `detectHorairesExtension(userComments)` function in `generateFinancialHtmlTool.ts`:

```typescript
function detectHorairesExtension(userComments: any): { detected: boolean; description: string } {
  const autres = userComments?.autres || '';
  // Regex patterns: "allonger horaires", "fermé le lundi", "en saison", etc.
  // Returns detected sentences from userComments
}
```

#### Detected Patterns
- `allonger horaires`, `extension horaires`, `horaires d'ouverture`
- `fermé le lundi/mardi/.../dimanche`, `ouvert le...`
- `en saison`, `demi-journée de fermeture`, `jours de repos`

---

### Executive Summary: Comparatif Actuel vs Potentiel Repreneur

New feature in the Executive Summary section showing a side-by-side comparison of current situation vs buyer's potential.

**New comparison table with 4 key indicators:**

| Indicator | Current Situation | Buyer Potential | Evolution |
|-----------|------------------|-----------------|-----------|
| EBE | 85 000 € (comptable) | 130 000 € (normatif) | +52.9% |
| Marge EBE | 17.0% | 26.0% | +9.0 pts |
| CA Année 1 | 500 000 € | 550 000 € | +10.0% |
| EBE Année 1 | 85 000 € | 143 000 € | +68.2% |

**File Modified:**
- `tools/report/generateFinancialHtmlTool.ts` - Lines 450-491 (CSS), 573-658 (logic + HTML)

---

### COMPTA Extraction Rework

Complete rework of the extraction system for preprocessed COMPTA documents.

#### New Architecture

**1. New TypeScript Schema (extractionComptaSchema.ts)**
- 4 structured sections: `BilanActifExtraction`, `BilanPassifExtraction`, `CompteResultatExtraction`, `SigExtraction`
- New `ValeurSig` type: `{ valeur: number; pct_ca: number }` for SIG data with % CA

**2. Specialized COMPTA Extraction Prompt (geminiVisionExtractTool.ts)**
- ~200-line specialized prompt for 4-section preprocessed documents
- No `responseSchema` for COMPTA docs (too complex for Gemini API → 400 Bad Request)
- Deterministic year extraction from filename: `COMPTA2023.pdf` → `2023`

**3. Enhanced SIG Tool (calculateSigTool.ts)**
- 3-level extraction priority:
  - **PRIORITY 0**: SIG extracted directly from COMPTA documents
  - **PRIORITY 1**: key_values from Vision extraction
  - **PRIORITY 2**: Table parsing with heuristics

**4. Director Salary from SIG (calculateEbeRetraitementTool.ts)**
- 3-level salary extraction priority from `charges_exploitant`

#### Data Extraction Improvement

| Metric | Before | After |
|--------|--------|-------|
| Accounting values extracted | ~10 | **90+** |
| SIG indicators with % CA | 0 | **15+** |
| Director salary auto-detection | No | **Yes** |

---

### Data Completeness Tracking System

New feature that explains WHY scores are not at 100% by tracking each expected field.

#### Problem Solved
- **Before**: "Extraction Données: 64/100" → User doesn't know what's missing
- **After**: Detailed breakdown of present, missing, and partial data with recommendations

#### Expected Fields per Section

| Section | Field Count | Fields Tracked |
|---------|------------|----------------|
| Extraction Données | 11 | bilan_n, bilan_n1, bilan_n2, compte_resultat_n, etc. |
| Analyse Immobilière | 15 | bail_commercial, diagnostics, conformité ERP/PMR, etc. |

#### Files Modified
- `schemas/dataCompletenessSchema.ts` (New)
- `tools/validation/assessDataQualityTool.ts`
- `tools/report/generateFinancialHtmlTool.ts`

---

## Recent Improvements (2025-12-27)

### Phase 1: Quality & Accuracy Fixes (Morning)

#### Data Extraction & Scoring

**1. Fixed Valuation Scoring (assessDataQualityTool.ts)**
- **Before**: Score always 0/100 due to structure mismatch
- **After**: Dynamic calculation: EBE +30pts, CA +25pts, Patrimonial +20pts, Synthesis +25pts

**2. Fixed Valuation Comparison Table (generateFinancialHtmlTool.ts)**
- Displays all 3 methods with ranges (low/median/high)
- Backward compatibility: supports both `methodes.ebe` and `methodeEBE` structures

**3. Improved Document Detection (assessDataQualityTool.ts)**
- Multi-pattern recognition: Document type, Filename patterns, Content analysis

**4. Added "liasse_fiscale" Document Type**
- Content-based detection (bilan, compte_resultat, or liasse_fiscale)

**5. Increased maxOutputTokens**
- 8192 → 16384 tokens for 33+ page documents

#### User Experience Enhancements

**6. New "User Comments" Section in Reports**
- Displays rent, renovation budget, sale conditions, other comments

**7. Real Estate Score Considers User Negotiations**
- +10 bonus points for successful negotiations

#### Gemini Vision Extraction Improvements

**8. Hierarchical Extraction Prompt**
- 4-level priority structure: CRITICAL → IMPORTANT → USEFUL → Annexes
- Expected extraction score improvement: 70/100 → 85-90/100

---

### Phase 2: Report Quality & User Experience (Afternoon)

#### Report Naming & Organization

**10. Timestamp at Beginning of Filename**
- **Before**: `financial-report-{businessId}-{YYYY-MM-DD}.html`
- **After**: `{YYYYMMDD_HHMMSS}_financial-report-{businessId}.html`

#### User Comments Integration

**11. Full Frontend-to-Backend User Comments Transmission**
- Frontend: `additionalInfo` field sent to API as `userComments.autres`
- Backend: Extracted from req.body and injected into pipeline initialState

#### Budget Travaux Display

**12. Renovation Budget as Additional Investment Cost**
- Displayed in Executive Summary as "Investissement Total Estimé"
- Breakdown: Valorisation du fonds + Budget travaux = Total investissement

#### Report Quality Improvements

**13. Always Display Patrimoniale Method**
- Shows "0 € (bilan non fourni)" when balance sheet unavailable

**14. Default Message for Empty "Points Forts"**
- Explicit message when no strengths identified

---

### Phase 3: Accessibility, Transparency & Strategic Guidance (Evening)

#### Accessibility & Design Quality

**15. WCAG AA Compliant Color Palette**
- Created 11 CSS variables with proper contrast ratios
- All text meets WCAG AA minimum (4.5:1 contrast ratio)

#### Enhanced Transparency & Debugging

**16. Comprehensive UserComments Logging**
- Structured console display with visual formatting

**17. Improved Gemini Vision Logging**
- Detailed extraction metrics logging
- Warns about missing critical keys

**18. EBE Retraitement Logging**
- Execution context logging for traceability

#### Chart & Table Display Improvements

**19. Valorisation Chart Always Visible**
- Always display all 3 methods, even with 0 values

**20. Comparison Table Transparency**
- Explanatory messages for missing data

#### Strategic Analysis Expansion

**21. Extended Strategic Scenarios: 5 → 10**
- Scenario 6: Clientèle & Saisonnalité
- Scenario 7: Risques Réglementaires
- Scenario 8: Opportunités de Croissance
- Scenario 9: Points de Négociation
- Scenario 10: Stratégie de Financement

**22. New Section: "Conseils pour le Rachat"**
- Subsection 1: Risques Identifiés & Mitigation
- Subsection 2: Opportunités de Création de Valeur
- Subsection 3: Checklist Due Diligence
- Subsection 4: Arguments de Négociation

---

### Phase 4: ComptaPreprocessingAgent (2025-12-28)

New agent that preprocesses COMPTA documents before extraction:

**Features:**
- Analyzes documents with Gemini Vision (1 request per document)
- Extracts only relevant pages (Bilan Actif, Bilan Passif, Compte de Résultat, SIG)
- Creates consolidated PDFs per fiscal year (COMPTA2021.pdf, etc.)
- Saves to `data/documents/{SIREN}/A_ANALYSER/`
- Caches results - skips preprocessing if A_ANALYSER already exists

**Tool principal:** `preprocessComptaDocumentsTool` (tout-en-un, déterministe)

**Avantages:**
- PDFs plus petits → Extraction plus rapide et précise
- Uniquement pages pertinentes → Pas de bruit
- Organisation par année → Un fichier par exercice fiscal
- Cache intelligent → Skip le preprocessing si existant

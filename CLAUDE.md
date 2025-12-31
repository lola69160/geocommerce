# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SearchCommerce is a React + Vite application for searching and analyzing French businesses. It combines multiple data sources:
- **OpenData API** (recherche-entreprises.api.gouv.fr) for business registry data
- **BODACC API** for legal announcements about business sales
- **Google Places API** for location, reviews, photos, and opening hours
- **Gemini API** for AI-powered validation and context generation

The application allows users to search for businesses by activity type (NAF code) and location, enrich results with BODACC data (business sales/transfers), add businesses to a cart, take notes, and generate professional analysis reports using ADK agent pipelines.

## Quick Start

```bash
npm install                    # Install dependencies
# Set up .env with GEMINI_API_KEY and PLACE_API_KEY
npm run dev:all                # Run frontend + backend
```

## Documentation

All detailed documentation is in the `docs/` directory:

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Technical architecture, API endpoints, data persistence |
| [ADK_PIPELINE.md](docs/ADK_PIPELINE.md) | Professional analysis pipeline (10 agents) |
| [FINANCIAL_PIPELINE.md](docs/FINANCIAL_PIPELINE.md) | Financial analysis pipeline (6 agents) |
| [FINANCIAL_CHANGELOG.md](docs/FINANCIAL_CHANGELOG.md) | Recent improvements & implementation details |
| [FINANCIAL_AGENTS.md](docs/FINANCIAL_AGENTS.md) | Agent specifications & tool descriptions |
| [API_INTEGRATION.md](docs/API_INTEGRATION.md) | External APIs (Google Places, BODACC) |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | Development commands, debugging |

## Testing

```bash
npm run test:financial         # Run all financial tests
npm run test:financial:watch   # Watch mode
npm run test:regression        # Strategic pipeline integrity
npm run test:coverage          # Coverage report
```

See [tests/README.md](tests/README.md) for complete testing guide.

## Key Technologies

- **Frontend**: React, Vite, **Tailwind CSS v3.4.0**, Leaflet
- **Backend**: Express.js, Winston (logging)
- **AI/ML**: Google Gemini API, Google ADK
- **APIs**: Google Places, OpenData (France), BODACC
- **Storage**: JSON files, localStorage

## ⚠️ Important: Tailwind CSS Version

**CRITICAL**: This project uses **Tailwind CSS v3.4.0** (NOT v4).

### Why Tailwind v3?

- Tailwind v4 has a **completely different** configuration system
- The project's `tailwind.config.js` uses v3 syntax (with `extend`, custom colors, etc.)
- Using v4 causes **CSS classes not to compile** (bg-white, bg-red-500, etc. don't work)

### If CSS classes don't work:

1. **Check package.json**: Ensure `tailwindcss: ^3.4.0` (NOT v4)
2. **Check postcss.config.js**: Should use `tailwindcss: {}` (NOT `@tailwindcss/postcss`)
3. **Clear cache**: `rm -rf node_modules/.vite dist`
4. **Restart**: `npm run dev`

### Correct configuration:

```javascript
// postcss.config.js
export default {
    plugins: {
        tailwindcss: {},      // ✅ Tailwind v3
        autoprefixer: {},
    },
}
```

**DO NOT upgrade to Tailwind v4** without migrating the entire config!

## Code Organization Guidelines

### File Size Limits

**CRITICAL**: Keep files under **500 lines**. When exceeded:

| File Type | Max Lines | Action |
|-----------|-----------|--------|
| Tool files (`*Tool.ts`) | 300 | Extract helpers |
| Agent files (`*Agent.ts`) | 200 | Delegate to tools |
| HTML generators | 500 | Split into sections |

### Module Extraction Pattern

```
myTool.ts (500+ lines)  →  myTool/
                            ├── index.ts        (~100 lines)
                            ├── types.ts
                            ├── helpers.ts
                            ├── sections/
                            └── styles/
```

### Import Organization

```typescript
// 1. External libraries
import { z } from 'zod';

// 2. Internal utilities
import { parseState } from './helpers';

// 3. Local modules
import { generateSection } from './sections';

// 4. Types (always last)
import type { MyType } from './types';
```

### Data Preservation Best Practices (CRITICAL)

**Principe fondamental** : Lors de modifications du pipeline financier, **TOUJOURS** vérifier que les données extraites sont préservées de bout en bout.

#### Checklist avant toute modification d'agent :

1. **Identifier les données critiques** :
   - Quelles données cet agent lit-il du state ?
   - Quelles données écrit-il dans le state ?
   - Utilise-t-il `outputKey` qui **écrase** complètement une clé du state ?

2. **Vérifier le flux de données** :
   ```
   Agent A injecte → state.key.subkey
   Agent B lit     → state.key.subkey
   Agent B écrit   → outputKey: 'key'  ⚠️ DANGER : écrase state.key complètement !
   ```

3. **Tester avec un cas réel** :
   - Lancer une analyse avec SIRET 53840462500013
   - Vérifier les logs d'extraction : `✅ [geminiVisionExtract] Injection directe SIG`
   - Vérifier le rapport HTML : tableau SIG affiche les valeurs pour TOUTES les années
   - Comparer AVANT/APRÈS la modification

4. **Points de vigilance Agent + outputKey** :
   - Si l'agent utilise `outputKey: 'X'`, il **remplace** `state.X` complètement
   - Le LLM DOIT inclure dans son JSON TOUTES les données déjà présentes dans `state.X`
   - Sinon → **perte de données irréversible**

5. **Logs de diagnostic obligatoires** :
   - Ajouter `console.log('[AgentName] 🔍 Input state:')` AVANT traitement
   - Ajouter `console.log('[AgentName] 📋 Output JSON:')` APRÈS traitement
   - Permet de comparer input vs output et détecter les pertes

#### Pattern sécurisé pour préserver les données :

```typescript
// ❌ DANGEREUX - Le LLM peut oublier des champs
export class MyAgent extends LlmAgent {
  constructor() {
    super({
      outputKey: 'myData',  // Écrase state.myData complètement !
      instruction: `Analyse les données et retourne un JSON`
      // Si le LLM oublie un champ → PERDU !
    });
  }
}

// ✅ SÉCURISÉ - Instructions ultra-explicites + validation
export class MyAgent extends LlmAgent {
  constructor() {
    super({
      outputKey: 'myData',
      instruction: `
⚠️⚠️⚠️ RÈGLE CRITIQUE - PRÉSERVATION DES DONNÉES ⚠️⚠️⚠️

ÉTAPE 1: Appelle validateMyDataTool qui retournera l'objet complet state.myData

ÉTAPE 2: Dans ton JSON de sortie, COPIE INTÉGRALEMENT l'objet retourné par validateMyDataTool

ÉTAPE 3: Ajoute ton analyse (nouveaux champs)

Exemple de structure OBLIGATOIRE :
{
  "existingData": { /* COPIE COMPLÈTE de validateMyDataTool */ },
  "myAnalysis": { /* TON analyse */ }
}

⚠️ Si tu omets "existingData", le rapport sera incomplet !
      `
    });
  }
}

// ✅ ENCORE MIEUX - Séparer les responsabilités
export class MyAgent extends LlmAgent {
  constructor() {
    super({
      outputKey: 'myAnalysis',  // N'écrase PAS state.myData !
      instruction: `Analyse les données dans state.myData et retourne ton analyse`
    });
  }
}
// Puis dans generateHtmlTool : merger state.myData + state.myAnalysis
```

#### Règles d'or :

1. **Un agent = Une responsabilité** : Ne pas faire lire + écrire la même clé du state
2. **outputKey différent** : Si possible, utiliser une clé distincte pour ne pas écraser
3. **Instructions triplement explicites** : Warnings ⚠️, étapes numérotées, exemples concrets
4. **Validation systématique** : Tool qui retourne les données à préserver
5. **Tests de non-régression** : Vérifier le rapport HTML après chaque modification

## Contributing

1. Follow ESLint configuration
2. Update docs in `docs/` directory
3. Run `npm run test:financial` before committing
4. Check logs in `logs/` for errors

### Sector Selection (Sélection du Secteur d'Activité)

**CRITICAL**: The application uses **manual sector selection** instead of automatic NAF code detection.

#### Why Manual Selection?

Automatic NAF-based sector detection was unreliable:
- Used partial matching (e.g., `nafCode.startsWith('47')`)
- Produced classification errors (e.g., Tabac detected as "Débits de boissons")
- Led to incorrect benchmarks and valuation methods

#### Current Implementation (2025-12-31)

**Form Field**: Required dropdown in `BusinessAnalysisModal.jsx` with 9 sectors:
```javascript
<select value={secteurActivite} onChange={(e) => setSecteurActivite(e.target.value)} required>
  <option value="47.11">Commerce non spécialisé (Superette, Alimentation)</option>
  <option value="47.26">Tabac / Presse / Loto</option>
  <option value="10.71">Boulangerie-Pâtisserie</option>
  <option value="56.10">Restauration traditionnelle</option>
  <option value="56.30">Débits de boissons (Bar, Café)</option>
  <option value="96.02">Coiffure</option>
  <option value="47.7">Commerce spécialisé habillement</option>
  <option value="47.73">Pharmacie</option>
  <option value="55.10">Hôtellerie</option>
</select>
```

**Data Flow**:
```
User Selection → businessInfo.secteurActivite (required)
                businessInfo.nafCode (API original, audit only)
  ↓
Backend Validation → 400 if secteurActivite missing
  ↓
State Init → state.businessInfo.secteurActivite
  ↓
All Agents/Tools → Use secteurActivite for benchmarks/valuation
  ↓
Report Display → "Secteur : Tabac / Presse / Loto" (no NAF shown)
```

**Key Files**:
- `server/adk/financial/config/sectorMapping.ts` - Sector mapping constants
- `server/adk/financial/config/sectorBenchmarks.ts` - Direct lookup (no partial matching)
- `server/adk/financial/tools/accounting/compareToSectorTool.ts` - Reads `secteurActivite`
- `server/adk/financial/agents/ValorisationAgent.ts` - Tabac detection via `secteurActivite === '47.26'`

**Validation Rules**:
- Frontend: Required field, must select one of 9 sectors
- Backend: API returns 400 if missing, warns if sector not found in benchmarks

See [docs/FINANCIAL_CHANGELOG.md](docs/FINANCIAL_CHANGELOG.md#sélection-manuelle-du-secteur-dactivité-2025-12-31) for complete implementation details.

### Tabac/Presse Specifics (NAF 47.26Z)

Special handling for Tabac commerce:
- **Valuation**: Hybrid method (Bloc Réglementé + Bloc Commercial) instead of EBE/CA/Patrimonial
- **Business Plan**: Differentiated growth (Commissions +0%, Boutique +15% for travaux)
- **Opportunities**: Tobacco market -3-5%/year, no "natural growth" budgeting
- **Digitalisation**: Limited (+2-5% CA) due to delivery restrictions

See [docs/FINANCIAL_CHANGELOG.md](docs/FINANCIAL_CHANGELOG.md) for implementation details.

### Financial Pipeline - Règles de Données Extraites (CRITICAL)

**Principe fondamental**: Les données historiques (N, N-1, N-2) proviennent UNIQUEMENT des extractions. Pas de recalcul, pas de fallback.

#### Architecture d'Injection Directe (2025-12-29 - SIMPLIFIÉ)

**IMPORTANT**: `geminiVisionExtractTool` injecte directement les données SIG dans `state.comptable.sig[year]` lors de l'extraction des documents COMPTA. Cette injection **bypass le LLM** pour garantir l'intégrité des données.

**Flux de données simplifié** :
```
geminiVisionExtractTool (extraction COMPTA)
  → state.documentExtraction.documents[] (audit trail)
  → state.comptable.sig[year] ← INJECTION DIRECTE (source unique de vérité)

validateSigTool (ComptableAgent)
  → Valide que state.comptable.sig[year] est complet (PAS de recalcul)

businessPlanDynamiqueTool
  → Lit state.comptable.sig[year] directement (SANS recalcul)
  → Génère projections avec TOUS les champs
```

**calculateSigTool SUPPRIMÉ (2025-12-29)** : Plus nécessaire car tous les documents sont au format COMPTA et utilisent l'injection directe.

#### Priorité des Sources
| Priorité | Source | Usage |
|----------|--------|-------|
| 0 | Injection directe `geminiVisionExtractTool` | **Données historiques** (unique source) ✅ |
| ❌ | Calcul/estimation | **Données futures** uniquement |

#### Format SIG Standard
```typescript
// Tous les indicateurs utilisent ce format
interface ValeurSig {
  valeur: number;    // Valeur en euros
  pct_ca: number;    // % du Chiffre d'Affaires
}
// Exemple: "ebe": { "valeur": 85000, "pct_ca": 17 }
```

#### Champs SIG Obligatoires (TOUS les commerces)
- `ventes_marchandises`, `production_vendue_services` (commissions)
- `marge_brute_globale`, `autres_achats_charges_externes`, `charges_exploitant`
- `salaires_personnel`, `charges_sociales_personnel`

#### Règles SANS Condition isTabac
```typescript
// ❌ INTERDIT - Ne plus conditionner sur isTabac
if (isTabac) { projections.push({ ventes_marchandises: ... }); }

// ✅ CORRECT - Toujours inclure tous les champs
projections.push({
  ventes_marchandises: ventesMarchandises,  // Toujours inclus
  commissions_services: commissionsServices, // Toujours inclus
  marge_brute_globale: margeBruteGlobale,   // Toujours inclus
});
```

#### Règles Anti-Fallback
```typescript
// ❌ INTERDIT dans les tools de données historiques
if (value === 0) { value = caTotal * 0.08; }

// ✅ CORRECT
if (value === 0) { console.warn('Valeur non extraite'); }
```

#### ⚠️ CRITIQUE: Préservation des Champs SIG par ComptableAgent (FIX 2025-12-30 - RENFORCÉ)

**Problème** : ComptableAgent utilise `outputKey: 'comptable'`, ce qui **écrase complètement** `state.comptable` (incluant les SIG injectés par geminiVisionExtractTool). Si le LLM ne copie pas TOUS les champs SIG de TOUTES les années dans son JSON de sortie, les données sont **perdues définitivement**.

**Solution Multi-Couches (2025-12-30)** :

1. **validateSigTool.ts** (lignes 177-187) :
   - Retourne `comptable.sig` complet dans sa sortie
   - Ajoute un champ `INSTRUCTION_CRITIQUE` visible par le LLM
   - Logs console avertissant le LLM : `⚠️⚠️⚠️ INSTRUCTION POUR LE LLM`

2. **ComptableAgent.ts** (lignes 312-350) :
   - **RÈGLE #6** avec triple warning ⚠️⚠️⚠️
   - Instructions en **4 ÉTAPES** numérotées et ultra-explicites
   - **Exemple concret** montrant les 3 années (2021, 2022, 2023) avec vraies valeurs
   - Avertissement que les valeurs d'exemple sont fictives
   - Instruction : "COPIE l'objet 'sig' de validateSigTool INTÉGRALEMENT"

3. **Sécurité par Design** :
   ```typescript
   // ❌ DANGEREUX: outputKey écrase state.comptable complètement
   outputKey: 'comptable'  // Tout ce qui n'est pas dans le JSON du LLM = PERDU

   // ✅ Le LLM DOIT inclure dans son JSON:
   {
     "sig": { /* COPIE COMPLÈTE de validateSigTool.sig */ },
     "yearsAnalyzed": [2021, 2022, 2023],
     /* + son analyse (ratios, alertes, etc.) */
   }
   ```

**Symptômes de régression** :
- Tableau SIG HTML affiche "-" pour 2021/2022 sur : `ventes_marchandises`, `production_vendue_services`, `marge_commerciale`, `marge_brute_globale`, `charges_externes`, `frais_personnel`, `resultat_exploitation`
- Seule l'année 2023 (ou la plus récente) affiche les valeurs complètes
- Les logs montrent `✅ [geminiVisionExtract] Injection directe SIG pour 2021` mais le rapport HTML est vide

**Diagnostic si bug réapparaît** :
1. Vérifier logs : `✅ [geminiVisionExtract] Injection directe SIG` (données bien extraites ?)
2. Vérifier logs : `⚠️⚠️⚠️ INSTRUCTION POUR LE LLM` (validateSigTool a retourné le SIG ?)
3. Vérifier logs : `📋 RAW OUTPUT from comptable` (le LLM a-t-il copié TOUS les champs de TOUTES les années ?)
4. Si étape 3 montre des données partielles → **Le LLM ne suit pas les instructions**

**Solution architecturale alternative si le problème persiste** :
- Changer `ComptableAgent.outputKey` de `'comptable'` vers `'comptableAnalysis'`
- Modifier `generateFinancialHtmlTool` pour merger `state.comptable.sig` + `state.comptableAnalysis`
- Avantage : Garantit que les SIG injectés ne sont JAMAIS écrasés

#### Benchmark Sectoriel NAF 47.26Z (Tabac/Presse)

**Ajouté 2025-12-30** : Benchmark spécifique pour NAF 47.26 dans `sectorBenchmarks.ts` (lignes 41-56).

Avant ce fix, le code cherchait un match partiel et trouvait NAF 47.11 ("Commerce de détail") au lieu de 47.26Z.

**Ratios spécifiques Tabac/Presse** :
- Marge brute : 66% (commissions réglementées + boutique)
- Marge EBE : 18%
- Marge nette : 10%
- BFR : -10 jours CA (beaucoup de cash)

**Fichiers clés:**
- `geminiVisionExtractTool.ts` - **Injection directe** dans state.comptable.sig[year] (validation stricte)
- `validateSigTool.ts` - **Validation** (PAS de recalcul) des SIG injectés
- `ComptableAgent.ts` - **Préservation complète** des champs SIG (lignes 306-312)
- `businessPlanDynamiqueTool.ts` - Projections **SANS condition isTabac**
- `accountingSection.ts` - Affichage tableau SIG avec ventes_marchandises et production_vendue_services
- `sectorBenchmarks.ts` - Benchmark NAF 47.26Z pour Tabac/Presse

#### EBE Bridge Feature - Formulaire Structuré et Visualisation (2025-12-30)

**Fonctionnalité**: Remplacement du tableau de retraitement EBE par un "Pont EBE" visuel qui montre la transformation de l'EBE comptable vers l'EBE normatif avec justifications économiques détaillées.

**Nouveaux champs formulaire** :
- `reprise_salaries` (oui/non) : Influence le calcul (suppression personnel cédant si non)
- `loyer_actuel` (€/mois) : Loyer commercial actuel (champ structuré)
- `loyer_negocie` (€/mois) : Loyer commercial négocié (champ structuré)

**Système de priorité** :
```javascript
// Champs structurés > Extraction NLP
if (hasStructuredLoyer) {
  // Utilise loyer_actuel et loyer_negocie
} else {
  // Fallback: extraction NLP du texte userComments.autres
}
```

**Nouveaux types de retraitement** :
1. **Suppression Personnel Cédant** : Si `reprise_salaries=false`, récupère la masse salariale complète (salaires + charges sociales)
2. **Nouvelle Structure RH** : Utilise `frais_personnel_N1` fourni par l'utilisateur
3. **Normalisation Loyer** : Calcul automatique de l'économie annuelle à partir des champs structurés

**Champs retraitement enrichis** :
- Ajout du champ `justification` (string) à chaque retraitement pour expliquer la logique économique
- Affichage dans tableau 3 colonnes : Libellé | Flux (€) | Justification Économique

**Tableau "Pont EBE"** :
- 3 colonnes avec badges colorés (vert +, orange -)
- Ligne de base : EBE Comptable (badge info)
- Retraitements avec justifications détaillées
- Ligne finale : EBE NORMATIF CIBLE (fond vert, mise en évidence)
- Analyse LLM contextuelle générée par ComptableAgent (`analyseDetailleeEbe`)

**Validation frontend** :
- Loyer négocié > loyer actuel → dialogue de confirmation
- Reprise_salaries=false sans frais_personnel_N1 → alerte
- Loyer négocié fourni sans loyer actuel → alerte

**Fichiers modifiés** :
- `src/components/BusinessAnalysisModal.jsx` : 3 nouveaux champs + validation
- `server/adk/financial/index.ts` : Types FinancialInput/FinancialState mis à jour
- `server.js` : Système de priorité NLP (lignes 985-1047)
- `server/adk/financial/tools/accounting/calculateEbeRetraitementTool.ts` : Nouveaux retraitements + justification
- `server/adk/financial/tools/report/sections/accountingSection.ts` : Fonction `generateEbeBridgeTable()`
- `server/adk/financial/agents/ComptableAgent.ts` : Règle 6.5 pour générer analyseDetailleeEbe

See [docs/FINANCIAL_PIPELINE.md](docs/FINANCIAL_PIPELINE.md) for complete priority rules.

#### Transaction Financing Form - Formulaire de Financement Complet (2025-12-31)

**Fonctionnalité**: Formulaire structuré en 3 sections avec architecture **deux colonnes** (Scénario Initial | Scénario Négocié) pour capturer toutes les données d'acquisition et de financement d'un fonds de commerce.

**Architecture UX** :
- Layout : Deux colonnes côte-à-côte pour comparer Initial vs Négocié
- Calculs automatiques : 8 champs calculés en temps réel (lecture seule)
- Validations : 6 règles (warnings + erreurs bloquantes)
- Design : Headers colorés distinctifs, badges "Auto", totaux highlighted

**Section 7: Données du Projet** (💰 Investment Data - Cyan)
```javascript
// 6 champs de saisie + 2 auto-calculés × 2 scénarios
- Prix du fonds de commerce (€)
- Honoraires HT (€)
- Frais d'actes HT (€)
- TVA sur honoraires (auto-calc: (honoraires + frais) × 20.6%) ← READ-ONLY
- Droits d'enregistrement et débours (€)
- Stock et Fonds de roulement (€)
- Loyer d'avance / caution (€) - distinct du loyer mensuel
- TOTAL INVESTISSEMENT (auto-calc: somme des 7 postes) ← READ-ONLY, HIGHLIGHTED
```

**Section 8: Données du Financement** (🏦 Financing Sources - Orange)
```javascript
// 3 champs de saisie + 1 auto-calculé × 2 scénarios
- Apport personnel (€)
- Prêt Relais TVA (€) - court-terme ~4%
- Crédit Vendeur (€) - facilite négociation
- MONTANT PRÊT PRINCIPAL (auto-calc: Total - apport - prêt relais - crédit vendeur) ← READ-ONLY, HIGHLIGHTED
```

**Section 9: Paramètres de l'Emprunt** (📊 Loan Parameters - Violet)
```javascript
// 3 champs de saisie + 1 auto-calculé × 2 scénarios
- Durée du prêt (années, 1-25)
- Taux d'intérêt nominal (%, step: 0.1)
- Taux d'assurance ADI (%, step: 0.05)
- ESTIMATION ANNUELLE (auto-calc: formule annuité × 12 mois) ← READ-ONLY, HIGHLIGHTED
```

**Calculs automatiques (8 useEffect hooks)** :
1. **TVA** : `(honoraires_ht + frais_acte_ht) × 0.206`
2. **Total investissement** : `prix_fonds + honoraires + frais_actes + tva + debours + stock + loyer_avance`
3. **Prêt principal** : `total_investissement - apport - pret_relais_tva - credit_vendeur` (jamais négatif)
4. **Estimation annuelle** : Formule d'annuité avec gestion du cas taux = 0%
   ```javascript
   r = (taux_interet + taux_assurance) / 100 / 12  // Taux mensuel
   n = duree × 12  // Nombre de mois
   Mensualité = P × (r × (1+r)^n) / ((1+r)^n - 1)
   Estimation annuelle = Mensualité × 12
   ```

**Règles de validation frontend (6 règles)** :
1. **Scénario incomplet** : Warning si Initial rempli mais pas Négocié (confirmation)
2. **Prix négocié > Prix initial** : Warning inhabituel (confirmation)
3. **Apport > Total investissement** : Erreur bloquante
4. **Durée = 0 mais prêt > 0** : Erreur bloquante incohérence
5. **Taux intérêt > 15%** : Warning valeur élevée (confirmation)
6. **Prêt principal négatif** : Erreur bloquante (somme apports > total)

**Système de priorité backend** :
```javascript
// parseTransactionFinancing() dans server.js
PRIORITY 0: Formulaire manuel (userComments.transactionFinancing)
PRIORITY 1: Extraction PDF (state.transactionCosts) - future
PRIORITY 2: NLP fallback - future

// Les données manuelles du formulaire écrasent toujours l'extraction PDF
```

**Types TypeScript** :
```typescript
// server/adk/financial/index.ts
userComments?: {
  transactionFinancing?: {
    initial?: {
      // Investment Data
      prix_fonds?: number;
      honoraires_ht?: number;
      frais_acte_ht?: number;
      tva_sur_honoraires?: number;     // Auto-calculated
      debours?: number;
      stock_fonds_roulement?: number;
      loyer_avance?: number;
      total_investissement?: number;   // Auto-calculated

      // Financing Sources
      apport_personnel?: number;
      pret_relais_tva?: number;
      credit_vendeur?: number;
      pret_principal?: number;         // Auto-calculated

      // Loan Parameters
      duree_annees?: number;
      taux_interet?: number;
      taux_assurance?: number;
      estimation_annuelle?: number;    // Auto-calculated
    };
    negocie?: {
      // Même structure que initial
    };
  };
};
```

**Fichiers modifiés** :
- `src/components/BusinessAnalysisModal.jsx` : 44 state variables, 8 useEffect, 3 sections JSX (+908 lignes)
- `server/adk/financial/index.ts` : Types FinancialInput/FinancialState (+102 lignes)
- `server.js` : Fonction `parseTransactionFinancing()` avec priorité (+26 lignes)

**État actuel (Phase 1)** :
- ✅ Formulaire complet avec calculs automatiques
- ✅ Validations robustes frontend
- ✅ Types backend et système de priorité
- ✅ Données envoyées au backend via API
- ⏳ Utilisation dans rapport HTML (Phase 2 future)

**Phase 2 (Future)** :
- Créer `generateFinancingAnalysisTool.ts` pour exploiter les données
- Ajouter section "Plan de Financement" dans le rapport HTML
- Tableau comparatif Initial vs Négocié
- Simulation de remboursement d'emprunt avec échéancier

See commit `22f1c22` (2025-12-31) for complete implementation.

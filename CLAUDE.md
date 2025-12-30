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

- **Frontend**: React, Vite, Tailwind CSS, Leaflet
- **Backend**: Express.js, Winston (logging)
- **AI/ML**: Google Gemini API, Google ADK
- **APIs**: Google Places, OpenData (France), BODACC
- **Storage**: JSON files, localStorage

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

## Contributing

1. Follow ESLint configuration
2. Update docs in `docs/` directory
3. Run `npm run test:financial` before committing
4. Check logs in `logs/` for errors

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

#### ⚠️ CRITIQUE: Préservation des Champs SIG par ComptableAgent (FIX 2025-12-30)

**Problème résolu** : ComptableAgent écrasait les champs SIG injectés par geminiVisionExtractTool car son prompt référençait l'ancien `calculateSigTool` (supprimé).

**Solution** : Le prompt de `ComptableAgent.ts` (lignes 306-312) ordonne maintenant au LLM de :
1. ✅ Appeler `validateSig` (pas calculateSig)
2. ✅ **COPIER INTÉGRALEMENT** `state.comptable.sig` dans le JSON de sortie
3. ✅ **NE PAS FILTRER** les champs - préserver l'objet complet
4. ✅ Champs CRITIQUES : `ventes_marchandises`, `production_vendue_services`, `marge_brute_globale`, `autres_achats_charges_externes`, `charges_exploitant`, `salaires_personnel`, `charges_sociales_personnel`

**Symptôme si bug réapparaît** : Lignes "Ventes Marchandises" et "Commissions/Services" affichent "-" dans le tableau SIG du rapport HTML (au lieu des vraies valeurs).

**Diagnostic** : Vérifier les logs `✅ [geminiVisionExtract] Injection directe SIG` qui montrent les valeurs injectées. Si présentes dans les logs mais absentes du rapport → ComptableAgent écrase le state.

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

See [docs/FINANCIAL_PIPELINE.md](docs/FINANCIAL_PIPELINE.md) for complete priority rules.

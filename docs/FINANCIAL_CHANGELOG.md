# Financial Pipeline - Changelog

Ce document contient l'historique des améliorations du Financial Pipeline.

---

## Migration PDF → Formulaire & Section "Plan de Financement" (2025-12-31)

### Objectif

Remplacer complètement l'extraction PDF du document d'offre par les données du formulaire de financement `transactionFinancing` dans le rapport financier, et créer une nouvelle section dédiée "Plan de Financement" avec tableau comparatif.

### Changements Majeurs

#### 1. Suppression de l'Extraction PDF
- ❌ **SUPPRIMÉ** : `extractTransactionCostsTool.ts` (241 lignes)
- ❌ **RETIRÉ** : Type de document "cout_transaction" de `geminiVisionExtractTool`
- ❌ **NETTOYÉ** : Toutes références à `state.transactionCosts` dans 13 fichiers

**Justification** : Les données du formulaire manuel sont plus fiables et structurées que l'extraction PDF. Le document d'offre ne sera plus analysé.

#### 2. Nouvelle Section Rapport HTML : "Plan de Financement"

**Fichier créé** : `server/adk/financial/tools/report/sections/financingPlanSection.ts` (~250 lignes)

**Composants** :
- **Tableau comparatif 3 sections** : Investment Data | Financing Sources | Loan Parameters
- **Colonnes** : Élément | Scénario Initial | Scénario Négocié | Différence %
- **3 indicateurs clés** :
  1. **Coût total intérêts** : `(estimation_annuelle × duree) - pret_principal`
  2. **Ratio endettement** : `(mensualite / ebe_mensuel) × 100%` avec badges couleur (success <50%, caution 50-70%, warning >70%)
  3. **Taux d'effort** : `(apport_personnel / total_investissement) × 100%` avec badges (success >30%, caution 20-30%, warning <20%)

**Gestion EBE normatif (fallback hiérarchique)** :
```typescript
const ebeNormatif = comptable?.ebeRetraitement?.ebe_normatif_cible
  || comptable?.ebeRetraitement?.ebe_normatif
  || comptable?.sig?.[lastYear]?.ebe?.valeur
  || 0;
```

**Cas limites gérés** :
- ✅ Formulaire vide → Message "Formulaire de financement non renseigné"
- ✅ Scénario Négocié vide (`total_investissement === 0`) → Colonne affiche "N/A"
- ✅ EBE normatif non disponible → Ratio endettement = "N/A"

#### 3. Migration des Consommateurs

**Fichiers modifiés pour utiliser `transactionFinancing` au lieu de `transactionCosts`** :

| Fichier | Modification | Lignes |
|---------|--------------|--------|
| `opportunitySection.ts` | Fonction `generateProjetVendeurTable()` lit `transactionFinancing` | ~40 |
| `valuationSection.ts` | Suppression variable `transactionCosts` | ~2 |
| `synthesizeValuationTool.ts` | Fallback `prix_affiche` depuis `transactionFinancing` | ~15 |
| `ValorisationAgent.ts` | Documentation retrait références `transactionCosts` | ~4 |
| `DocumentExtractionAgent.ts` | Retrait `extractTransactionCostsTool` de tools + instructions | ~30 |

**Signature fonction changée** :
```typescript
// AVANT:
export async function generateOpportunitySection(
  comptable, valorisation, businessPlan, userComments, transactionCosts
)

// APRÈS:
export async function generateOpportunitySection(
  comptable, valorisation, businessPlan, userComments
) {
  const transactionFinancing = userComments?.transactionFinancing;
  const scenario = transactionFinancing?.negocie?.total_investissement > 0
    ? transactionFinancing.negocie
    : transactionFinancing?.initial;
}
```

#### 4. Consolidation du champ "Débours"

**Changement** : Le champ "Droits d'enregistrement" a été fusionné avec "Débours"

**Frontend** : Label mis à jour → "Droits d'enregistrement et débours (€)"

**Backend** : `scenario.debours` contient maintenant les deux montants cumulés

#### 5. Styling CSS

**Fichier modifié** : `server/adk/financial/tools/report/styles/index.ts` (+240 lignes)

**Classes ajoutées** :
```css
.financing-table { /* Tableau comparatif */ }
.financing-table .section-header { /* En-têtes de sections */ }
.financing-table .total-row { /* Lignes de totaux */ }
.financing-table .na { /* Valeurs "N/A" */ }
.financing-table .positive { /* Différences positives */ }
.financing-table .negative { /* Différences négatives */ }
.key-indicators-grid { /* Grille 3 colonnes pour indicateurs */ }
.indicator-card { /* Carte indicateur avec bordure colorée */ }
.indicator-card.success { /* Indicateur vert */ }
.indicator-card.caution { /* Indicateur orange */ }
.indicator-card.warning { /* Indicateur rouge */ }
.financing-empty-state { /* Message formulaire vide */ }
```

### Corrections TypeScript

#### Erreur 1 : Zod `z.record()` - Compatibilité v3+

**Problème** : Zod v3+ nécessite 2 arguments pour `z.record(keySchema, valueSchema)`

**Fichiers corrigés** :
- `documentExtractionSchema.ts:27` : `z.record(z.any())` → `z.record(z.string(), z.any())`
- `visionExtractionSchema.ts:29` : `z.record(z.any())` → `z.record(z.string(), z.any())`

#### Erreur 2 : Champ `justification` manquant dans type TypeScript

**Problème** : Le schéma Zod `RetraitementLineSchema` définissait `justification`, mais le type TypeScript du tableau `retraitements` ne le contenait pas.

**Fichier corrigé** : `calculateEbeRetraitementTool.ts:144-150`

```typescript
// AVANT:
const retraitements: Array<{
  type: string;
  description: string;
  montant: number;
  source: string;
  commentaire?: string;
}> = [];

// APRÈS:
const retraitements: Array<{
  type: string;
  description: string;
  montant: number;
  source: string;
  justification?: string;  // ← AJOUTÉ
  commentaire?: string;
}> = [];
```

#### Erreur 3 : Parsing JSON avec blocs markdown

**Problème** : Le LLM retournait du JSON enveloppé dans ` ```json ... ``` `, causant `SyntaxError` dans `assessDataQualityTool.ts:619`

**Fichier corrigé** : `assessDataQualityTool.ts:617-631`

```typescript
if (typeof state === 'string') {
  try {
    // Strip markdown code blocks if present (LLM sometimes wraps JSON in ```json ... ```)
    let cleanState = state.trim();
    if (cleanState.startsWith('```json')) {
      cleanState = cleanState.replace(/^```json\s*\n/, '').replace(/\n```\s*$/, '');
    } else if (cleanState.startsWith('```')) {
      cleanState = cleanState.replace(/^```\s*\n/, '').replace(/\n```\s*$/, '');
    }
    return JSON.parse(cleanState);
  } catch (e) {
    console.error('[assessDataQuality] ❌ parseState: JSON parse failed', e);
    return null;
  }
}
```

### Fichiers Modifiés/Créés

| Action | Fichier | Lignes |
|--------|---------|--------|
| **CRÉÉ** | `financingPlanSection.ts` | +250 |
| **MODIFIÉ** | `styles/index.ts` | +240 |
| **MODIFIÉ** | `opportunitySection.ts` | ~40 |
| **MODIFIÉ** | `generateFinancialHtmlTool.ts` | ~10 |
| **MODIFIÉ** | `synthesizeValuationTool.ts` | ~15 |
| **MODIFIÉ** | `valuationSection.ts` | ~2 |
| **MODIFIÉ** | `DocumentExtractionAgent.ts` | ~30 |
| **MODIFIÉ** | `ValorisationAgent.ts` | ~4 |
| **MODIFIÉ** | `documentExtractionSchema.ts` | ~1 |
| **MODIFIÉ** | `visionExtractionSchema.ts` | ~1 |
| **MODIFIÉ** | `calculateEbeRetraitementTool.ts` | ~1 |
| **MODIFIÉ** | `assessDataQualityTool.ts` | ~8 |
| **MODIFIÉ** | `geminiVisionExtractTool.ts` | ~2 |
| **MODIFIÉ** | `document/index.ts` | ~1 |
| **MODIFIÉ** | `sections/index.ts` | +1 |
| **SUPPRIMÉ** | `extractTransactionCostsTool.ts` | -241 |
| **TOTAL** | **17 fichiers** | **+365 / -241** |

### Résultats

✅ **Pipeline 100% formulaire** : Plus aucune dépendance au document PDF d'offre

✅ **Section Plan de Financement** : Tableau comparatif Initial vs Négocié avec 3 indicateurs financiers

✅ **TypeScript propre** : Erreurs critiques Zod et types corrigées (18 erreurs non-bloquantes restantes dans fichiers de test)

✅ **Gestion robuste** : Cas limites (formulaire vide, scénario partiel) traités gracieusement

✅ **Serveur opérationnel** : Backend démarre sans erreur sur http://localhost:3001

### Référence Commit

Commit à venir - "feat: Migration PDF → Formulaire + Section Plan de Financement + Corrections TypeScript (2025-12-31)"

---

## Formulaire de Financement Complet - Transaction Financing Form (2025-12-31)

### Objectif

Permettre la saisie structurée des données de financement d'acquisition dans le formulaire d'analyse financière avec une architecture en deux colonnes (Scénario Initial | Scénario Négocié) pour faciliter la comparaison.

### Architecture UX Validée

**Layout**: Deux colonnes côte-à-côte pour affichage simultané des scénarios Initial et Négocié

**Champs auto-calculés**: Lecture seule uniquement avec styling distinct (fond gris, badge "Auto")

**Structure**: Scroll vertical simple (pas d'accordéons) avec 3 sections color-coded

**Responsive**: `grid-cols-1 md:grid-cols-2` pour adaptation mobile/tablet/desktop

### Sections Implémentées

#### Section 7: Données du Projet (Investment Data) - 💰 Cyan

**Champs éditables (× 2 scénarios):**
1. Prix du fonds de commerce (€, step: 1000)
2. Honoraires HT (€, step: 100)
3. Frais d'actes HT (€, step: 100)
4. Droits d'enregistrement et débours (€, step: 100)
5. Stock et Fonds de roulement (€, step: 1000)
6. Loyer d'avance (€, step: 100) - *caution/dépôt de garantie*

**Champs auto-calculés (× 2 scénarios):**
- TVA sur honoraires: `(honoraires_ht + frais_actes_ht) × 0.206`
- TOTAL DE L'INVESTISSEMENT: Somme des 7 postes ci-dessus

**Icon**: 💰 `bg-accent-cyan-500`

#### Section 8: Données du Financement (Financing Sources) - 🏦 Orange

**Champs éditables (× 2 scénarios):**
1. Apport personnel (€, step: 1000)
2. Prêt Relais TVA (€, step: 100) - *court-terme ~4%*
3. Crédit Vendeur (€, step: 1000) - *facilite négociation*

**Champs auto-calculés (× 2 scénarios):**
- MONTANT DU PRÊT PRINCIPAL: `Total invest - apport - prêt relais - crédit vendeur` (max 0)

**Icon**: 🏦 `bg-accent-orange-500`

#### Section 9: Paramètres de l'Emprunt (Loan Parameters) - 📊 Violet

**Champs éditables (× 2 scénarios):**
1. Durée du prêt (années, min: 1, max: 25)
2. Taux d'intérêt nominal (%, step: 0.1, suffix: `%`)
3. Taux d'assurance ADI (%, step: 0.05, suffix: `%`)

**Champs auto-calculés (× 2 scénarios):**
- ESTIMATION ANNUELLE: Formule d'annuité `P × (r × (1+r)^n) / ((1+r)^n - 1) × 12`

**Icon**: 📊 `bg-accent-violet-500`

### State Management

**44 variables au total:**
- 36 state variables pour saisie utilisateur (18 champs × 2 scénarios)
- 8 state auto-calculées (4 types × 2 scénarios)

**8 useEffect hooks pour calculs en temps réel:**
1-2. TVA sur honoraires (Initial/Négocié)
3-4. Total investissement (Initial/Négocié)
5-6. Prêt principal (Initial/Négocié)
7-8. Estimation annuelle emprunt (Initial/Négocié)

**Helper function:**
```javascript
const calculateLoanPayment = (principal, tauxInteret, tauxAssurance, dureeAnnees) => {
  if (principal <= 0 || dureeAnnees <= 0) return 0;
  const tauxTotal = (parseFloat(tauxInteret) || 0) + (parseFloat(tauxAssurance) || 0);

  if (tauxTotal === 0) {
    return (principal / (dureeAnnees * 12)) * 12; // Pas d'intérêts
  }

  const r = tauxTotal / 100 / 12; // Taux mensuel
  const n = dureeAnnees * 12; // Nombre de mois
  const mensualite = principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return Math.round(mensualite * 12);
};
```

### Validation Frontend (6 règles)

**Règle 1: Scénario incomplet**
- Si Initial rempli mais pas Négocié → Confirmation utilisateur

**Règle 2: Prix négocié > Prix initial**
- Dialogue de confirmation (cas inhabituel)

**Règle 3: Apport > Total investissement**
- Erreur bloquante (alert)

**Règle 4: Durée = 0 mais prêt > 0**
- Erreur bloquante (incohérence)

**Règle 5: Taux intérêt > 15%**
- Confirmation utilisateur (valeur inhabituelle)

**Règle 6: Prêt principal négatif**
- Erreur bloquante avec message explicatif

### Backend Integration

#### Types TypeScript

**Fichier:** `server/adk/financial/index.ts` (lignes 83-132, 181-230)

```typescript
userComments?: {
  // ... champs existants ...
  transactionFinancing?: {
    initial?: {
      // Investment Data
      prix_fonds?: number;
      honoraires_ht?: number;
      frais_acte_ht?: number;
      tva_sur_honoraires?: number;
      debours?: number;
      stock_fonds_roulement?: number;
      loyer_avance?: number;
      total_investissement?: number;

      // Financing Sources
      apport_personnel?: number;
      pret_relais_tva?: number;
      credit_vendeur?: number;
      pret_principal?: number;

      // Loan Parameters
      duree_annees?: number;
      taux_interet?: number;
      taux_assurance?: number;
      estimation_annuelle?: number;
    };

    negocie?: {
      // Même structure que initial
    };
  };
};
```

#### Système de Priorité

**Fichier:** `server.js` (lignes 1111-1134)

```javascript
function parseTransactionFinancing(userComments) {
  // PRIORITY 0: Manual form input (structured data from frontend)
  if (userComments?.transactionFinancing?.initial) {
    console.log('[parseFinancing] ✅ Manual form data detected - using structured input');
    return userComments.transactionFinancing;
  }

  // PRIORITY 1: PDF extraction (future - structure prepared)
  // PRIORITY 2: NLP fallback (future extension if needed)
  console.log('[parseFinancing] ⚠️ No structured financing data - skipping');
  return null;
}

// Integration dans enrichedUserComments
const transactionFinancing = parseTransactionFinancing(userComments || {});
if (transactionFinancing) {
  enrichedUserComments.transactionFinancing = transactionFinancing;
  console.log('[parseFinancing] ✅ Transaction financing data integrated into state');
}
```

### Fichiers Modifiés

| Fichier | Lignes Ajoutées | Description |
|---------|-----------------|-------------|
| `src/components/BusinessAnalysisModal.jsx` | +908 | 44 state variables, 8 useEffect, 3 sections JSX, 6 validations, API payload |
| `server/adk/financial/index.ts` | +102 | Types FinancialInput et FinancialState |
| `server.js` | +26 | Fonction parseTransactionFinancing + integration |
| **TOTAL** | **+1038** | **Phase 1 MVP complète** |

### Styling & UX Details

**Pattern deux colonnes:**
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
  <FormInput {...propsInitial} />
  <FormInput {...propsNegocie} />
</div>
```

**Champs auto-calculés (read-only):**
- Background: `bg-surface-100` (gris clair)
- Cursor: `cursor-not-allowed`
- Badge: "Auto" avec couleur contextuelle (warning/success/primary/violet)
- Texte: Format numérique avec `toLocaleString('fr-FR')`

**Totaux calculés (highlighted):**
- Bordure colorée selon type (success-500, primary-500, violet-500)
- Fond coloré (success-50, primary-50, violet-50)
- Texte bold avec couleur renforcée
- Badge "Auto" vert (success)

### État Actuel et Roadmap

**Phase 1 (COMPLÈTE - 2025-12-31):**
- ✅ Capture structurée des données de financement (18 champs × 2 scénarios)
- ✅ Calculs automatiques en temps réel (8 champs calculés)
- ✅ Validation frontend robuste (6 règles)
- ✅ Types backend TypeScript
- ✅ Système de priorité (manuel > PDF > NLP)
- ✅ API payload integration
- ✅ Tests utilisateur validés ("fonctionne parfaitement")

**Phase 2 (COMPLÉTÉ - 2025-12-31):**
- ✅ Ajout section "Plan de Financement" au rapport HTML (`financingPlanSection.ts`)
- ✅ Tableau comparatif Initial vs Négocié dans le rapport
- ✅ 3 indicateurs financiers (coût intérêts, ratio endettement, taux d'effort)
- ✅ Suppression extraction PDF (`extractTransactionCostsTool` retiré - formulaire manuel uniquement)
- ❌ **ANNULÉ** : Integration extraction PDF (formulaire manuel préféré pour fiabilité)

**Phase 3 (FUTUR - Non planifié):**
- ⏳ Visualisation du plan de remboursement (graphique échéancier)
- ⏳ Calcul DSCR (Debt Service Coverage Ratio) avec alertes
- ⏳ Création de `generateFinancingAnalysisTool.ts` (si besoin d'analyse plus poussée)

### Résultats

✅ **UX optimale** : Comparaison visuelle immédiate Initial vs Négocié

✅ **Zéro erreur** : Calculs auto-validés (TVA, totaux, annuités)

✅ **Responsive** : Layout adaptatif mobile/tablet/desktop

✅ **Type-safe** : Backend TypeScript fully typed

✅ **Extensible** : Structure prête pour Phase 2 (rapport HTML)

### Référence Commit

Commit `22f1c22` - "feat: Add Transaction Financing Form with dual scenario comparison (2025-12-31)"

**Statistiques:**
- 3 fichiers modifiés
- +1038 lignes ajoutées
- 44 variables state
- 8 hooks de calcul
- 6 règles de validation

---

## Sélection Manuelle du Secteur d'Activité (2025-12-31)

### Objectif

Corriger le problème d'identification automatique du secteur basée sur le code NAF qui produisait des erreurs de classification (ex: Tabac détecté comme "Débits de boissons"). Remplacer par une sélection manuelle obligatoire dans le formulaire.

### Problème Initial

**Exemple concret :**
- Commerce Tabac avec NAF 47.26Z
- Détecté automatiquement comme "Débits de boissons (NAF 56.30Z)"
- Benchmark sectoriel incorrect → ratios de comparaison erronés
- Méthode de valorisation incorrecte (EBE/CA/Patrimonial au lieu de Hybrid Tabac)

**Cause Racine :**
- La fonction `findSectorBenchmark()` utilisait un matching partiel sur le code NAF
- Le code cherchait le premier secteur dont le NAF "commence par" le code fourni
- Résultats imprévisibles selon l'ordre des secteurs dans la configuration

### Solution Implémentée

**Architecture :**

```
Frontend Form (ProfessionalAnalysisModal.jsx)
  ↓ User selects: "Tabac / Presse / Loto" → secteurActivite: '47.26'
API Validation (server.js)
  ↓ Required field validation + state initialization
Financial Pipeline
  ↓ state.businessInfo.secteurActivite (used by all agents/tools)
Report Generation
  ↓ Display: "Secteur : Tabac / Presse / Loto" (no NAF shown)
```

### Modifications

#### 1. Nouveau fichier de mapping sectoriel

**Fichier :** `server/adk/financial/config/sectorMapping.ts` (NOUVEAU)

```typescript
export const SECTOR_MAPPING = {
  'Commerce non spécialisé (Superette, Alimentation générale)': '47.11',
  'Tabac / Presse / Loto': '47.26',
  'Boulangerie-Pâtisserie': '10.71',
  'Restauration traditionnelle': '56.10',
  'Débits de boissons (Bar, Café)': '56.30',
  'Coiffure': '96.02',
  'Commerce spécialisé habillement': '47.7',
  'Pharmacie': '47.73',
  'Hôtellerie': '55.10',
} as const;
```

#### 2. Formulaire avec dropdown obligatoire

**Fichier :** `src/components/ProfessionalAnalysisModal.jsx` (lignes 38, 649-678)

- Nouveau state : `secteurActivite`
- Dropdown avec 9 secteurs disponibles
- Validation frontend : champ obligatoire
- Envoi API : `businessInfo.secteurActivite` (requis)

#### 3. Types et validation backend

**Fichier :** `server/adk/financial/index.ts` (lignes 54-60)

```typescript
businessInfo?: {
  name: string;
  siret: string;
  nafCode?: string;              // NAF original API (audit trail uniquement)
  secteurActivite: string;       // Secteur sélectionné (REQUIS)
  activity: string;
};
```

**Fichier :** `server.js` (lignes 943-945, 1113-1118)

- Validation : Retourne 400 si `secteurActivite` manquant
- State init : Sépare `nafCode` (API) et `secteurActivite` (user input)

#### 4. Simplification du lookup sectoriel

**Fichier :** `server/adk/financial/config/sectorBenchmarks.ts` (lignes 171-194)

```typescript
// ❌ AVANT - Matching partiel (source d'erreurs)
for (const benchmark of SECTOR_BENCHMARKS) {
  if (nafCode.startsWith(benchmark.nafCode)) {
    return benchmark; // Premier match trouvé
  }
}

// ✅ APRÈS - Lookup direct exact
export function findSectorBenchmark(sectorCode: string): SectorBenchmark | null {
  const benchmark = SECTOR_BENCHMARKS.find(b => b.nafCode === sectorCode);
  if (!benchmark) {
    console.warn(`⚠️ No benchmark for sector: ${sectorCode}`);
    return null;
  }
  return benchmark;
}
```

#### 5. Mise à jour de tous les agents et tools

**Fichiers modifiés :**
- `compareToSectorTool.ts` : Paramètre `nafCode` → `sectorCode`, lit `state.businessInfo.secteurActivite`
- `ValorisationAgent.ts` : Détection Tabac via `secteurActivite === '47.26'`
- `generateDeterministicAlertsTool.ts` : Lit `businessInfo.secteurActivite`
- `businessPlanDynamiqueTool.ts` : Détection Tabac via `secteurActivite`
- `acquisitionAdvice/index.ts` : Variable `sectorCode` au lieu de `nafCode`
- `acquisitionAdvice/negotiation.ts` : 3 fonctions avec paramètre `sectorCode`
- `acquisitionAdvice/financing.ts` : Fonction `generateOpportunitiesSection()` avec `sectorCode`
- `accountingSection.ts` : Affichage secteur SANS code NAF

**Total :** 1 nouveau fichier + 10 fichiers modifiés

### Règles de Validation

**Frontend :**
- Champ obligatoire (required)
- Erreur si vide au moment de submit
- Valeur doit être un des 9 codes secteur

**Backend :**
- Validation API : retourne 400 si `secteurActivite` manquant
- Runtime : warning si secteur introuvable dans benchmarks (ne crash pas le pipeline)

### Préservation des Données

**NAF Code Original (API) :**
- Conservé dans `businessInfo.nafCode` pour audit trail
- Non utilisé pour les benchmarks ou la valorisation
- Non affiché dans le rapport HTML

**Secteur Sélectionné :**
- Stocké dans `businessInfo.secteurActivite`
- Utilisé par TOUS les agents et tools
- Affiché dans le rapport : "Secteur : Tabac / Presse / Loto"

### Résultats

✅ **Précision** : Secteur contrôlé par l'utilisateur (0 erreur de classification)
✅ **Benchmark** : Comparaisons sectorielles avec les bons ratios de référence
✅ **Valorisation** : Méthode adaptée au secteur (ex: Hybrid pour Tabac)
✅ **UX** : Dropdown clair avec 9 choix explicites
✅ **Traçabilité** : NAF original préservé pour audit

### Logs de Validation

**Avant le fix :**
```
⚠️ [findSectorBenchmark] No benchmark found for sector: 47.26Z
Available sectors: 47.11, 47.26, 10.71, 56.10, 56.30, 96.02, 47.7, 47.73, 55.10
```

**Après le fix :**
```
✅ [findSectorBenchmark] Found: Commerce de détail de produits à base de tabac, presse et loterie (47.26)
✅ [compareToSector] Benchmark loaded: Tabac / Presse / Loto
✅ [ValorisationAgent] Tabac commerce detected → Using Hybrid method
```

---

## Correction Anomalies Pipeline Financier - 5 Corrections Critiques (2025-12-31)

### Objectif

Corriger 5 anomalies détectées lors de l'analyse du log de génération du rapport financier pour garantir la précision des données affichées et la cohérence des calculs.

### Anomalies Corrigées

#### 1. EBE Comptable incorrect dans le Pont EBE (CRITIQUE)

**Problème :** Le tableau "Pont EBE - De la Capacité Comptable à la Capacité Normatif" affichait 29 421 € pour "EBE Comptable 2023 (Base)" au lieu de 17 558 € (valeur réelle de 2023).

**Cause Racine :** Le code calculait automatiquement la moyenne des 3 dernières années (49 952 € + 20 754 € + 17 558 €) / 3 = 29 421 €.

**Impact Business :**
- EBE Normatif **surévalué** de +11 863 € (+23%)
- Valorisation potentiellement incorrecte (impact de ~35 000 € si méthode EBE × 3)

**Solution Implémentée :**

**Fichier :** `calculateEbeRetraitementTool.ts` (lignes 137-154)

```typescript
// ❌ AVANT (calcul moyenne 3 ans)
if (yearsAnalyzed.length >= 3) {
  const ebeValues = yearsAnalyzed.slice(0, 3).map((year: number) => {
    const yearStr = year.toString();
    return extractSigValue(sig[yearStr], 'ebe');
  });
  ebeComptable = Math.round(ebeValues.reduce((a, b) => a + b, 0) / ebeValues.length);
}

// ✅ APRÈS (année de référence uniquement)
// Calculer EBE de référence (TOUJOURS dernière année pour le Pont EBE)
// Note: La moyenne 3 ans est utilisée pour la VALORISATION, pas pour le retraitement
const anneeReference = yearsAnalyzed[0]; // Année la plus récente
const lastYear = anneeReference.toString();
const ebeComptable = extractSigValue(sig[lastYear], 'ebe');
```

**Résultat :**
- ✅ EBE Comptable 2023 : 29 421 € → 17 558 €
- ✅ EBE Normatif : 51 012 € → 39 149 € (recalculé automatiquement)

---

#### 2. NAF Code modifié incorrectement (CRITIQUE)

**Problème :** Le NAF code était modifié par le LLM (47.26Z → 56.30Z) pour un "Bar Tabac Presse Jeux PMU", le classant comme BAR au lieu de TABAC.

**Cause Racine :**
1. Exemples JSON dans `ValorisationAgent.ts` incluaient un champ `"sector"` inexistant dans le schéma TypeScript
2. Le LLM inférait le secteur depuis le nom du commerce et modifiait le NAF en conséquence
3. Instructions ambiguës suggérant qu'un NAF 56.30Z + secteur "Tabac" = TABAC

**Impact Business :**
- ❌ Valorisation basée sur méthode BAR (EBE, CA, Patrimonial) au lieu de HYBRIDE (Bloc Réglementé + Bloc Commercial)
- ❌ Business Plan avec croissance bar au lieu de spécificités tabac

**Solution Implémentée :**

**Fichier :** `ValorisationAgent.ts`

**Modification A :** Suppression champ `sector` inexistant (lignes 241-244, 330-333)
```typescript
// ❌ AVANT
{
  "businessInfo": {
    "name": "Commerce ABC",
    "nafCode": "47.26Z",
    "sector": "Tabac-presse"  // ← N'existe pas dans le schéma !
  }
}

// ✅ APRÈS
{
  "businessInfo": {
    "name": "Commerce ABC",
    "nafCode": "47.26Z"
    // Pas de champ "sector"
  }
}
```

**Modification B :** Ajout règle de préservation NAF (après ligne 220)
```typescript
⚠️⚠️⚠️ RÈGLE CRITIQUE - PRÉSERVATION DU NAF CODE ⚠️⚠️⚠️

Le champ businessInfo.nafCode provient du state et DOIT être préservé TEL QUEL.
Tu ne dois JAMAIS modifier le NAF code fourni en entrée.

Exemple :
Si state.businessInfo.nafCode = "47.26Z", alors ton JSON de sortie DOIT contenir:
{
  "businessInfo": {
    "nafCode": "47.26Z"  // ⚠️ COPIE EXACTE - NE PAS MODIFIER
  }
}

NE PAS ajouter de champ "sector" à businessInfo (ce champ n'existe pas dans le schéma).
```

**Modification C :** Clarification exemples de détection (lignes 104-110)
```typescript
// ❌ AVANT (ambigu - suggère qu'un Bar Tabac peut être 56.30Z)
⚠️ EXEMPLES DE DÉTECTION:
- NAF 47.26Z → TABAC ✅
- NAF 56.30Z + sector "Débits de boissons / Tabac" → TABAC ✅ (mot "Tabac" dans secteur)

// ✅ APRÈS (clair - seul le NAF compte)
⚠️ EXEMPLES DE DÉTECTION (basés UNIQUEMENT sur le NAF CODE):
- NAF 47.26Z (Commerce de détail tabac) → TABAC ✅
- NAF 47.62Z (Commerce de détail presse) → TABAC ✅
- NAF 56.30Z (Débits de boissons) → PAS TABAC ❌

IMPORTANT: La détection se base UNIQUEMENT sur le NAF code (47.26 ou 47.62).
Un "Bar Tabac" avec NAF 56.30Z est considéré comme un BAR, pas un TABAC.
```

**Résultat :**
- ✅ NAF code 47.26Z préservé
- ✅ Valorisation HYBRIDE (Tabac/Presse) correcte
- ✅ Business Plan avec spécificités tabac

---

#### 3. Log CA Business Plan ambigu (AMÉLIORATION)

**Problème :** Le log affichait `CA Total (2023): 240 361 €` alors que la valeur était une moyenne des 3 dernières années, créant une confusion lors du débogage.

**Solution Implémentée :**

**Fichier :** `businessPlanDynamiqueTool.ts` (lignes 235-237)

```typescript
// ❌ AVANT (trompeur)
console.log(`[businessPlanDynamique] 📊 Données extraites du SIG (2023):
  - CA Total: ${caActuel.toLocaleString('fr-FR')} €`);

// ✅ APRÈS (explicite)
const caSource = yearsAnalyzed.length >= 3 ? 'moyenne 3 ans' : lastYearStr;
console.log(`[businessPlanDynamique] 📊 Données extraites du SIG:`);
console.log(`  - CA Total (${caSource}): ${caActuel.toLocaleString('fr-FR')} €`);
```

**Résultat attendu dans le log :**
```
[businessPlanDynamique] 📊 Données extraites du SIG:
  - CA Total (moyenne 3 ans): 240 361 €
```

---

#### 4. Log DEBUG production_vendue_services trompeur (LOG)

**Problème :** Le log DEBUG affichait `production_vendue_services: 0` alors que la valeur finale était 120 143 € (après fallback compte_resultat → sig).

**Cause Racine :** Le DEBUG était placé **avant** le fallback qui extrayait la vraie valeur depuis `compte_resultat.production_vendue_services`.

**Solution Implémentée :**

**Fichier :** `geminiVisionExtractTool.ts`

```typescript
// ❌ AVANT (ligne 681-686 - affiche réponse Gemini brute)
console.log(`[geminiVisionExtract] 🔍 DEBUG Production:
  - production_vendue_services: ${JSON.stringify(parsed.sig?.production_vendue_services)}
  // VALEUR AVANT FALLBACK = 0 ❌
`);

// ✅ APRÈS (déplacé APRÈS ligne 794 - affiche valeurs finales après fallback)
// Supprimé lignes 681-686 et ajouté APRÈS la construction de `kv` (ligne 841-846):
console.log(`[geminiVisionExtract] 🔍 DEBUG Production (après fallback):`);
console.log(`  - ventes_marchandises: ${kv.ventes_marchandises}`);
console.log(`  - production_vendue_services: ${kv.production_vendue_services}`);
console.log(`  - chiffre_affaires: ${kv.chiffre_affaires}`);
console.log(`  - Source: ${kv.production_vendue_services > 0 ? 'compte_resultat (prioritaire)' : 'sig (fallback)'}`);
```

**Résultat attendu dans le log :**
```
[geminiVisionExtract] 🔍 DEBUG Production (après fallback):
  - ventes_marchandises: 120455
  - production_vendue_services: 120143  ← CORRECT (au lieu de 0)
  - chiffre_affaires: 240597
  - Source: compte_resultat (prioritaire)
```

---

#### 5. Warning parseState null/undefined (WARNING)

**Problème :** Warning répété dans les logs : `[assessDataQualityTool] ⚠️ parseState: state is null/undefined`

**Cause Racine :** Référence circulaire - `FinancialValidationAgent` appelle `assessDataQualityTool` qui essaie de lire `state.financialValidation`, mais cette clé n'existe pas encore car l'agent n'a pas terminé son exécution.

**Solution Implémentée :**

**Fichier :** `assessDataQualityTool.ts` (lignes 78-80)

```typescript
// ❌ AVANT (génère warning car state.financialValidation n'existe pas encore)
let crossValidation = parseState(toolContext?.state.get('financialValidation'));

// ✅ APRÈS (explicite - le tool est appelé PAR l'agent qui écrit cette clé)
// NOTE: crossValidation sera toujours null car ce tool est appelé PAR
// FinancialValidationAgent AVANT qu'il n'écrive state.financialValidation
let crossValidation = null;
```

**Résultat :**
- ✅ Warning supprimé des logs
- ✅ Code explicite sur le comportement attendu

---

### Résumé des Modifications

| Fichier | Lignes Modifiées | Type | Description |
|---------|------------------|------|-------------|
| `calculateEbeRetraitementTool.ts` | 137-154 | Simplification | Supprimer calcul moyenne, utiliser uniquement année de référence |
| `ValorisationAgent.ts` | 104-110 | Clarification | Clarifier exemples de détection NAF |
| `ValorisationAgent.ts` | Après 220 | Ajout | Ajouter règle préservation NAF avec triple warning |
| `ValorisationAgent.ts` | 241-244, 330-333 | Suppression | Supprimer champ `sector` des exemples JSON |
| `businessPlanDynamiqueTool.ts` | 235-237 | Amélioration | Préciser "moyenne 3 ans" dans le log |
| `geminiVisionExtractTool.ts` | 681-686 → 841-846 | Déplacement | Déplacer DEBUG après fallback |
| `assessDataQualityTool.ts` | 78-80 | Remplacement | Remplacer par `null` explicite |

**Total :** 5 fichiers, +42/-35 lignes

---

### Impact Métier

#### Avant Corrections

- ❌ EBE Normatif **surévalué** : 51 012 € (basé sur moyenne 3 ans)
- ❌ Valorisation potentiellement **incorrecte** (mauvais NAF code)
- ⚠️ Logs trompeurs créant confusion lors du débogage
- ⚠️ Warnings parasites dans les logs

#### Après Corrections

- ✅ EBE Normatif **réaliste** : 39 149 € (basé sur 2023)
- ✅ Valorisation **cohérente** (NAF code préservé)
- ✅ Logs **clairs** et **précis**
- ✅ Pas de warnings parasites

**Différence d'EBE Normatif :** -11 863 € (-23%)
**Impact sur Valorisation :** Potentiellement -35 589 € si utilisation méthode EBE (3× EBE)

---

### Tests de Non-Régression

#### Test 1 : EBE Comptable correct
**Input :** SIRET 53840462500013 avec 3 années de COMPTA (2021, 2022, 2023)

**Vérifications :**
1. ✅ Log : `[EBE Retraitement] EBE Comptable de base: 17 558 €`
2. ✅ Tableau HTML "Pont EBE" : "EBE Comptable 2023 (Base) : 17 558 €"
3. ✅ EBE Normatif : ~39 149 € (au lieu de 51 012 €)

#### Test 2 : NAF Code préservé
**Input :** Bar Tabac Presse Jeux PMU avec NAF 47.26Z

**Vérifications :**
1. ✅ Log : `[calculateTabacValuation] Type commerce détecté: tabac_touristique`
2. ✅ Output JSON : `"nafCode": "47.26Z"` (PAS 56.30Z)
3. ✅ Rapport HTML : Méthode HYBRIDE (Tabac/Presse)

#### Test 3 : Log CA Business Plan clair
**Vérification :**
```
[businessPlanDynamique] 📊 Données extraites du SIG:
  - CA Total (moyenne 3 ans): 240 361 €  ← Précise "moyenne 3 ans"
```

#### Test 4 : Log DEBUG production_vendue_services correct
**Vérification :**
```
[geminiVisionExtract] 🔍 DEBUG Production (après fallback):
  - production_vendue_services: 120143  ← Affiche la valeur finale
```

#### Test 5 : Warning parseState supprimé
**Vérification :** Le log ne contient PLUS `[assessDataQualityTool] ⚠️ parseState: state is null/undefined`

---

### Plan de Référence

Plan détaillé disponible dans : `C:\Users\laure\.claude\plans\effervescent-beaming-sun.md`

---

## Simplification du Rapport HTML - Suppression d'Éléments (2025-12-31)

### Objectif

Simplifier le rapport financier HTML en supprimant des sections jugées non essentielles ou redondantes pour améliorer la clarté et la lisibilité du document.

### Éléments Supprimés

#### 1. Bloc "Synthèse Exécutive" complet

**Fichier:** `server/adk/financial/tools/report/generateFinancialHtmlTool.ts`

**Suppressions (fonction `generateExecutiveSummary()`):**
- Titre "📊 Synthèse Exécutive"
- Verdict (FAVORABLE/DÉFAVORABLE)
- Fourchette de valorisation (min-max, valeur recommandée)
- Prix demandé vendeur et écart prix/estimation
- Investissement Total Estimé (valorisation + budget travaux)
- Bloc de scores :
  - Score Santé Financière (0-100)
  - Score de Confiance (0-100)
  - Marge EBE (%)

**Conservé:**
- Tableau de comparaison EBE (si données disponibles)
- Points Forts Financiers
- Points de Vigilance

#### 2. Section "Éléments Complémentaires Fournis" complète

**Fichier:** `server/adk/financial/tools/report/generateFinancialHtmlTool.ts`

**Suppressions:**
- Fonction `generateUserCommentsSection()` (lignes 808-898, 91 lignes supprimées)
- Appel à cette fonction dans le rapport principal (lignes 134-138)

**Sous-sections supprimées:**
- Informations sur le Loyer (futur loyer négocié, part logement personnel)
- Informations sur les Travaux (budget prévu, précisions)
- Conditions de Vente (négociation possible, précisions)
- Autres Informations (commentaires textuels de l'utilisateur)

**Note:** Le formulaire `ProfessionalAnalysisModal.jsx` continue de collecter ces données (pour usage interne potentiel), mais elles ne s'affichent plus dans le rapport HTML généré.

#### 3. Score de Confiance sur la Page de Garde

**Fichier:** `server/adk/financial/tools/report/sections/coverPage.ts`

**Suppressions:**
- Badge "Score de Confiance: XX/100"
- Breakdown des sous-scores :
  - Complétude (/100)
  - Fiabilité (/100)
  - Fraîcheur (/100)

**Conservé:**
- Nom de l'entreprise
- Sous-titre "Analyse Financière - Due Diligence"
- Date de génération du rapport

### Impact sur le Code

#### Calculs conservés (arrière-plan)

Les tools suivants continuent de fonctionner (calculs internes) mais leurs résultats ne sont plus affichés :
- `calculateHealthScoreTool.ts` : Score Santé Financière
- `assessDataQualityTool.ts` : Score de Confiance

Ces scores peuvent être utilisés pour des analyses futures ou des logs de diagnostic.

#### Variables devenues inutilisées

Dans `generateExecutiveSummary()`, les variables suivantes ne sont plus utilisées :
- `healthScore`, `confidenceScore`
- `verdict`, `verdictClass`
- `valoMin`, `valoMax`, `valoMediane`, `valoMedianeNum`
- `prixDemande`

Ces variables sont conservées pour compatibilité avec les agents qui calculent ces valeurs.

### Structure du Rapport Après Modifications

```
1. Page de garde (nom + sous-titre + date uniquement)
2. Section Opportunités
3. Tableau de comparaison EBE (conservé si données disponibles)
4. Points Forts Financiers
5. Points de Vigilance
6. Commentaires Stratégiques
7. Analyse Comptable
8. Valorisation
9. Analyse Immobilière
10. Business Plan Dynamique
11. Complétude des Données
12. Validation Financière
13. Annexes
```

### Modifications de Fichiers

| Fichier | Lignes supprimées | Description |
|---------|-------------------|-------------|
| `generateFinancialHtmlTool.ts` | ~50 lignes | Bloc Synthèse Exécutive (verdict, valorisation, scores) |
| `generateFinancialHtmlTool.ts` | ~5 lignes | Appel à `generateUserCommentsSection()` |
| `generateFinancialHtmlTool.ts` | ~91 lignes | Fonction `generateUserCommentsSection()` complète |
| `coverPage.ts` | ~20 lignes | Score de confiance et breakdown |

**Total:** ~166 lignes supprimées

### Tests de Régression

**Vérifications effectuées:**
- ✅ Absence du bloc "Fourchette de Valorisation"
- ✅ Absence du verdict (FAVORABLE/DÉFAVORABLE)
- ✅ Absence des scores (Santé Financière, Score de Confiance, Marge EBE)
- ✅ Absence de la section "Éléments Complémentaires Fournis"
- ✅ Présence des Points Forts et Points de Vigilance
- ✅ Cohérence du reste du rapport
- ✅ Compilation TypeScript sans erreurs liées aux modifications

---

## EBE Bridge Feature - Formulaire Structuré et Visualisation (2025-12-30)

### Objectif

Améliorer la transparence et la compréhension du passage de l'EBE comptable à l'EBE normatif en :
1. Ajoutant des champs structurés au formulaire (reprise personnel, loyer)
2. Remplaçant le tableau de retraitement par un "Pont EBE" visuel avec justifications économiques
3. Permettant à ComptableAgent de générer une analyse contextuelle

### Nouveaux Champs Formulaire

**Fichier:** `src/components/ProfessionalAnalysisModal.jsx`

#### 1. Reprise des salariés (lignes 551-573)
```jsx
<label>Reprise des salariés</label>
<div>
  <label>
    <input type="radio" checked={repriseSalaries === true} onChange={() => setRepriseSalaries(true)} />
    Oui
  </label>
  <label>
    <input type="radio" checked={repriseSalaries === false} onChange={() => setRepriseSalaries(false)} />
    Non
  </label>
</div>
```

**Impact** : Si `repriseSalaries=false`, le tool `calculateEbeRetraitementTool` crée un retraitement "Suppression Personnel Cédant" qui récupère toute la masse salariale.

#### 2. Loyer commercial (lignes 575-617)
```jsx
<label>Loyer actuel (€/mois)</label>
<input type="number" value={loyerActuel} onChange={(e) => setLoyerActuel(e.target.value)} />

<label>Loyer négocié (€/mois)</label>
<input type="number" value={loyerNegocie} onChange={(e) => setLoyerNegocie(e.target.value)} />
```

**Impact** : Ces champs structurés sont prioritaires sur l'extraction NLP du texte `userComments.autres`.

#### 3. Validation client-side (lignes 300-317)
- `loyerNegocie` fourni sans `loyerActuel` → alerte
- `loyerNegocie > loyerActuel` → dialogue de confirmation
- `repriseSalaries=false` sans `frais_personnel_N1` → alerte

### Système de Priorité NLP

**Fichier:** `server.js` (lignes 985-1047)

Les champs structurés prennent la priorité sur l'extraction NLP :

```javascript
const hasStructuredLoyer = comments.loyer?.loyer_actuel || comments.loyer?.loyer_negocie;

if (hasStructuredLoyer) {
  console.log('[parseNLP] ✅ Loyer structuré détecté - NLP skip');
  result.loyer = result.loyer || {};

  if (comments.loyer.loyer_actuel) {
    result.loyer.loyer_actuel_mensuel = comments.loyer.loyer_actuel;
  }

  if (comments.loyer.loyer_negocie) {
    result.loyer.loyer_futur_mensuel = comments.loyer.loyer_negocie;
    result.loyer.futur_loyer_commercial = comments.loyer.loyer_negocie;
  }
} else {
  // FALLBACK: Extraction NLP du texte (code existant conservé)
}
```

### Nouveaux Retraitements EBE

**Fichier:** `server/adk/financial/tools/accounting/calculateEbeRetraitementTool.ts`

#### 1. Schema mis à jour (ligne 34)
Ajout du champ `justification` obligatoire :

```typescript
const RetraitementLineSchema = z.object({
  type: z.string(),
  description: z.string(),
  montant: z.number(),
  source: z.string(),
  justification: z.string().describe('Justification économique détaillée'),
  commentaire: z.string().optional()
});
```

#### 2. Suppression Personnel Cédant (lignes 239-278)
```javascript
const repriseSalaries = userComments?.reprise_salaries;

if (repriseSalaries === false) {
  const salairesPersonnel = extractSigValue(lastYearSig, 'salaires_personnel') || 0;
  const chargesSociales = extractSigValue(lastYearSig, 'charges_sociales_personnel') || 0;
  const masseSalarialeTotale = salairesPersonnel + chargesSociales;

  if (masseSalarialeTotale > 0) {
    retraitements.push({
      type: 'suppression_personnel_cedant',
      description: 'Suppression Personnel Cédant',
      montant: masseSalarialeTotale,
      source: 'documentExtraction',
      justification: 'Pas de reprise de personnel - Économie totale sur charges salariales actuelles',
      commentaire: `Masse salariale supprimée: ${salairesPersonnel}€ + ${chargesSociales}€`
    });
  }
}
```

#### 3. Nouvelle Structure RH (lignes 323-359)
```javascript
const fraisPersonnelN1 = userComments?.frais_personnel_N1;

if (fraisPersonnelN1 && fraisPersonnelN1 > 0) {
  const isSuppression = userComments?.reprise_salaries === false;
  const description = isSuppression ? 'Nouvelle Structure RH' : 'Ajustement Frais Personnel N+1';
  const justification = isSuppression
    ? '1 TNS + 1 SMIC + 1 Saisonnier (nouvelle organisation)'
    : 'Ajustement prévisionnel charges de personnel';

  retraitements.push({
    type: 'nouvelle_structure_rh',
    description,
    montant: -fraisPersonnelN1,  // Négatif = nouveau coût
    source: 'userComments',
    justification,
    commentaire: `Estimation repreneur: ${fraisPersonnelN1}€/an`
  });
}
```

#### 4. Normalisation Loyer (lignes 368-414)
Priorité aux champs structurés avec calcul automatique de l'économie annuelle :

```javascript
const loyerActuel = userComments?.loyer?.loyer_actuel || userComments?.loyer?.loyer_actuel_mensuel;
const loyerNegocie = userComments?.loyer?.loyer_negocie ||
                     userComments?.loyer?.loyer_futur_mensuel ||
                     userComments?.loyer?.futur_loyer_commercial;

if (loyerActuel && loyerNegocie && loyerNegocie < loyerActuel) {
  const economieAnnuelle = (loyerActuel - loyerNegocie) * 12;

  retraitements.push({
    type: 'normalisation_loyer',
    description: 'Normalisation Loyer',
    montant: economieAnnuelle,
    source: 'userComments',
    justification: `Passage de ${loyerActuel}€ à ${loyerNegocie}€/mois`,
    commentaire: `Économie mensuelle: ${(loyerActuel - loyerNegocie)}€ × 12 mois`
  });
}
```

#### 5. Justifications pour tous les retraitements existants

Tous les retraitements existants ont été enrichis avec le champ `justification` :

| Retraitement | Justification |
|--------------|---------------|
| Salaire Dirigeant | "Donnée certifiée liasse fiscale" / "Montant fourni par le repreneur" / "Estimation standard gérant majoritaire" |
| Salariés Non Repris | "{nombre} salarié(s) non conservé(s) - {motif}" |
| Salaires Saisonniers | "Coût additionnel non présent dans le bilan actuel" |
| Charges Exceptionnelles | "Charges non récurrentes à neutraliser" |
| Produits Exceptionnels | "Produits non récurrents à neutraliser" |

### Nouveau Tableau "Pont EBE"

**Fichier:** `server/adk/financial/tools/report/sections/accountingSection.ts` (lignes 279-349)

Remplace `generateEbeRetraitementTable()` par `generateEbeBridgeTable()`.

#### Structure du tableau (3 colonnes)

| Libellé | Flux (€) | Justification Économique |
|---------|----------|--------------------------|
| **EBE Comptable 2023 (Base)** | **85 000 €** | Donnée certifiée liasse fiscale 2023 |
| ➕ Suppression Personnel Cédant | +70 000 € | Pas de reprise de personnel - Économie totale... |
| ➕ Normalisation Loyer | +12 000 € | Passage de 2 000€ à 1 000€/mois |
| ➖ Nouvelle Structure RH | -45 000 € | 1 TNS + 1 SMIC + 1 Saisonnier... |
| **🎯 EBE NORMATIF CIBLE** | **122 000 €** | Capacité réelle du repreneur (+43.5%) |

#### Caractéristiques visuelles
- **Pas de gradient** : Fond blanc/gris clair pour lisibilité (matching SIG table)
- **Badges colorés** : ➕ (vert) pour additions, ➖ (orange) pour soustractions
- **Montants en couleur** : Vert pour positif, rouge pour négatif
- **Ligne finale mise en évidence** : Fond vert clair avec bordure verte

### Analyse LLM Contextuelle

**Fichier:** `server/adk/financial/agents/ComptableAgent.ts` (lignes 314-321)

Nouvelle règle 6.5 ajoutée :

```typescript
6.5. ⚠️ NOUVELLE RÈGLE - ANALYSE DÉTAILLÉE DU PONT EBE (OBLIGATOIRE) :
  Dans ebeRetraitement, ajouter le champ "analyseDetailleeEbe" (2-3 phrases) qui explique :
  - La différence entre EBE comptable et EBE normatif
  - Les principaux retraitements effectués (reprise personnel, loyer, nouvelle structure RH)
  - Le contexte métier basé sur userComments (si reprise_salaries=false, loyer négocié, etc.)
  - L'impact sur la capacité bénéficiaire réelle du repreneur (% du CA)
```

Le LLM génère maintenant une analyse contextuelle personnalisée au lieu d'un texte générique.

### Types Backend

**Fichier:** `server/adk/financial/index.ts` (lignes 60-77 et 102-118)

Mise à jour des types `FinancialInput` et `FinancialState` :

```typescript
userComments?: {
  frais_personnel_N1?: number;
  reprise_salaries?: boolean;  // ✨ NOUVEAU
  loyer?: {
    loyer_actuel?: number;     // ✨ NOUVEAU (€/mois)
    loyer_negocie?: number;    // ✨ NOUVEAU (€/mois)
    futur_loyer_commercial?: number;  // LEGACY (backward compat)
    loyer_actuel_mensuel?: number;    // LEGACY (backward compat)
    loyer_futur_mensuel?: number;     // LEGACY (backward compat)
    loyer_logement_perso?: number;
    commentaire?: string;
  };
  // ... autres champs inchangés
};
```

### Fichiers Modifiés (Résumé)

| Fichier | Lignes Modifiées | Description |
|---------|------------------|-------------|
| `src/components/ProfessionalAnalysisModal.jsx` | +100 | 3 nouveaux champs + validation client-side |
| `server/adk/financial/index.ts` | +5 | Types mis à jour |
| `server.js` | +62 | Système de priorité NLP |
| `calculateEbeRetraitementTool.ts` | +180 | 3 nouveaux retraitements + justifications |
| `accountingSection.ts` | +70 | Fonction `generateEbeBridgeTable()` |
| `ComptableAgent.ts` | +8 | Règle 6.5 pour analyseDetailleeEbe |

### Compatibilité

- ✅ **Backward compatibility** : Les champs legacy (`loyer_actuel_mensuel`, `futur_loyer_commercial`) sont maintenus
- ✅ **Fallback NLP** : Si les champs structurés ne sont pas fournis, le système utilise l'extraction NLP existante
- ✅ **Rapports existants** : Les anciens rapports continuent de fonctionner

### Tests Recommandés

1. **Formulaire** : Remplir les 3 nouveaux champs et vérifier l'envoi API
2. **Validation** : Tester les 3 cas d'alerte (loyer incohérent, reprise sans frais personnel)
3. **Rapport HTML** : Vérifier que le tableau "Pont EBE" s'affiche avec 3 colonnes
4. **Analyse LLM** : Vérifier que `analyseDetailleeEbe` est généré et affiché
5. **Backward compat** : Tester avec un ancien SIRET sans les nouveaux champs

---

## Frontend: Champ Frais Personnel N+1 (2025-12-30)

### Contexte

Le backend supporte déjà `userComments.frais_personnel_N1` depuis le 2025-12-30 (voir `businessPlanDynamiqueTool.ts` lignes 275-285). Ce champ permet à l'utilisateur de fournir une estimation manuelle des frais de personnel pour l'année N+1, qui est utilisée en priorité pour les projections du business plan.

### Implémentation Frontend

**Fichier modifié:** `src/components/ProfessionalAnalysisModal.jsx`

#### 1. État du composant (ligne 33)
```javascript
const [fraisPersonnelN1, setFraisPersonnelN1] = useState('');
```

#### 2. Champ de saisie dans le formulaire (lignes 527-544)
- **Type:** Input numérique
- **Emplacement:** Sidebar gauche, entre "Informations complémentaires" et "Extraction seulement"
- **Validation:** min="0", step="1000"
- **Label:** "Frais personnel N+1 (€/an)"
- **Placeholder:** "Ex: 45000"
- **Description:** "Estimation des frais de personnel pour l'année N+1 (optionnel)"

#### 3. Envoi à l'API (ligne 337)
```javascript
userComments: {
  frais_personnel_N1: fraisPersonnelN1 ? parseFloat(fraisPersonnelN1) : undefined,
  autres: additionalInfo
}
```

Le champ est converti en nombre avec `parseFloat()` et n'est envoyé que s'il contient une valeur.

#### 4. Reset à la fermeture (ligne 422)
Le champ est réinitialisé quand la modal se ferme.

### Impact Backend

Lorsque `userComments.frais_personnel_N1` est fourni, le `businessPlanDynamiqueTool` l'utilise **en priorité** pour les projections N+1 des frais de personnel, au lieu de calculer `(chargesPersonnelActuel - salairesSupprimes + salairesAjoutes)`.

```typescript
// businessPlanDynamiqueTool.ts (lignes 278-285)
const nouveauSalaires = userComments?.frais_personnel_N1
  || (chargesPersonnelActuel - salairesSupprimes + salairesAjoutes);

if (userComments?.frais_personnel_N1) {
  console.log(`   ✅ Source: userComments.frais_personnel_N1`);
} else {
  console.log(`   ℹ️ Source: calcul actuel`);
}
```

---

## Fix V6: Simplification Architecture - Suppression calculateSigTool (2025-12-29)

### Problème Identifié

**Symptôme:** Les SIG affichaient des valeurs à 0 ou N/A (marge_commerciale: 0 €, resultat_exploitation: 0 €) alors que geminiVisionExtractTool extrayait correctement toutes les données 30 secondes plus tôt (marge_commerciale: 42 746 €, resultat_exploitation: 10 348 €).

**Cause Racine:** Architecture avec deux flux de données qui se chevauchaient :

1. **Flux 1 (MODERNE)** : geminiVisionExtractTool injectait directement les SIG dans `state.comptable.sig[year]` ✅
2. **Flux 2 (LEGACY)** : calculateSigTool recalculait TOUJOURS les SIG depuis `state.documentExtraction.documents[]` → écrasait l'injection directe avec des données incomplètes ❌

```
Ligne de temps du problème:
T+0s  : geminiVisionExtractTool → Injecte SIG complets dans state.comptable.sig[2023]
T+30s : calculateSigTool → Recalcule depuis documents → ÉCRASE avec des 0
```

### Solution Implémentée: Option C - Supprimer calculateSigTool

**Justification:** Tous les documents sont au format COMPTA{YYYY}.pdf et utilisent l'injection directe. Le recalcul n'est plus nécessaire.

#### Modifications Effectuées

**1. geminiVisionExtractTool.ts (lignes 841-930) - Renforcement de l'injection directe**

```typescript
// VALIDATION STRICTE avant injection
const requiredSigFields = [
  'chiffre_affaires', 'marge_commerciale', 'marge_brute_globale',
  'valeur_ajoutee', 'ebe', 'resultat_exploitation', 'resultat_net'
];

const missingFields = requiredSigFields.filter(field =>
  (kv as any)[field] === undefined || (kv as any)[field] === null
);

if (missingFields.length > 0) {
  console.warn(`⚠️ [geminiVisionExtract] Champs SIG manquants pour ${year}: ${missingFields.join(', ')}`);
}

// Ne pas injecter si confidence < 0.7
if (confidence < 0.7) {
  console.error(`❌ [geminiVisionExtract] Confidence trop basse - SKIP injection`);
  return comptaOutput;
}

// Injection avec TOUS les champs SIG + logging détaillé
const sigYear = {
  year, source: 'gemini_vision_direct', confidence,
  chiffre_affaires: { valeur: kv.chiffre_affaires || 0, pct_ca: 100 },
  // ... 13 autres champs SIG avec format {valeur, pct_ca}
};

toolContext.state.set('comptable', { ...currentComptable, sig: { ...currentSig, [year]: sigYear } });
```

**2. validateSigTool.ts (NOUVEAU) - Validation sans recalcul**

```typescript
// Remplace calculateSigTool - VALIDE uniquement (ne calcule pas)
export const validateSigTool = new FunctionTool({
  name: 'validateSig',
  description: 'Valide que les SIG injectés par geminiVisionExtractTool sont complets',

  execute: async (params, toolContext) => {
    // Vérifie que state.comptable.sig[year] existe et est complet
    // Retourne warnings si champs manquants ou incohérences (EBE > CA, etc.)
    // NE MODIFIE PAS les données
    return { isValid, yearsAnalyzed, warnings, summary };
  }
});
```

**3. ComptableAgent.ts - Utilisation de validateSigTool**

```typescript
// AVANT
import { calculateSigTool, ... } from '../tools/accounting';
tools: [calculateSigTool, ...]

// APRÈS
import { validateSigTool, ... } from '../tools/accounting';
tools: [validateSigTool, ...]

// Instructions mises à jour
ÉTAPE 1 : VALIDER LES SIG (ne plus calculer)
  validateSig({})
  → Les SIG sont DÉJÀ dans state.comptable.sig (injection directe)
```

**4. calculateSigTool.ts - SUPPRIMÉ**

Le fichier entier a été supprimé car redondant avec l'injection directe.

#### Architecture Simplifiée

```
AVANT (2 flux qui s'écrasaient):
DocumentExtractionAgent → geminiVisionExtractTool → state.comptable.sig[year] ✅
ComptableAgent → calculateSigTool → state.comptable.sig (recalcule) ❌ ÉCRASE

APRÈS (1 seul flux):
DocumentExtractionAgent → geminiVisionExtractTool → state.comptable.sig[year] ✅
ComptableAgent → validateSigTool → Valide (sans modifier) ✅
```

#### Avantages

| Avantage | Impact |
|----------|--------|
| ✅ **Intégrité des données** | Les valeurs extraites ne sont plus écrasées |
| ✅ **Simplicité** | Une seule source de vérité (geminiVisionExtractTool) |
| ✅ **Performance** | Économise ~30 secondes (plus de recalcul) |
| ✅ **Maintenabilité** | -800 lignes de code (calculateSigTool supprimé) |
| ✅ **Robustesse** | Validation stricte (confidence, champs requis) |

#### Fichiers Modifiés

- `server/adk/financial/tools/document/geminiVisionExtractTool.ts` (+90 lignes - validation stricte)
- `server/adk/financial/tools/accounting/validateSigTool.ts` (+184 lignes - NOUVEAU)
- `server/adk/financial/tools/accounting/index.ts` (export validateSigTool)
- `server/adk/financial/agents/ComptableAgent.ts` (utilise validateSigTool)
- `server/adk/financial/tools/accounting/calculateSigTool.ts` (**SUPPRIMÉ** -847 lignes)
- `CLAUDE.md` (architecture simplifiée documentée)
- `docs/FINANCIAL_PIPELINE.md` (flux mis à jour)

---

## Recent Improvements (2025-12-29 - Earlier)

### Fix V5: Architecture Injection Directe - Affichage Données "Actuel" (CRITICAL)

**Problème:** Les colonnes "Actuel" des tableaux ("Changements Appliqués", "Projections sur 5 ans") affichaient des valeurs vides ou incorrectes malgré des données correctement extraites (visibles dans les logs).

**Cause Racine Identifiée:**
1. `ComptableAgent` utilise `outputKey: 'comptable'` → Le LLM interprète et peut omettre des champs
2. Les conditions `if (isTabac)` dans `businessPlanDynamiqueTool` excluaient les champs pour les commerces non-tabac
3. Les données passaient par le LLM au lieu d'être injectées directement

**Solution Implémentée: Architecture Injection Directe**

**1. geminiVisionExtractTool.ts - Injection directe dans state (lignes 809-856)**

```typescript
// ✅ INJECTION DIRECTE dans state.comptable.sig[year]
// Garantit que les données extraites arrivent dans le state sans dépendre du LLM
if (toolContext?.state && comptaOutput.year) {
  const year = comptaOutput.year.toString();
  const kv = comptaOutput.extractedData.key_values;

  const sigYear = {
    year: comptaOutput.year,
    source: 'gemini_vision_direct',
    chiffre_affaires: { valeur: kv.chiffre_affaires || 0, pct_ca: 100 },
    ventes_marchandises: { valeur: kv.ventes_marchandises || 0, pct_ca: calcPctCa(...) },
    production_vendue_services: { valeur: kv.production_vendue_services || 0, pct_ca: calcPctCa(...) },
    // ... tous les champs SIG avec format {valeur, pct_ca}
  };

  toolContext.state.set('comptable', {
    ...currentComptable,
    sig: { ...currentSig, [year]: sigYear },
    yearsAnalyzed: [...new Set([...currentYears, comptaOutput.year])].sort((a, b) => b - a)
  });
}
```

**2. businessPlanDynamiqueTool.ts - Suppression TOUTES les conditions isTabac**

```typescript
// ❌ AVANT (conditions isTabac)
...(isTabac && { ventes_marchandises: ventesMarchandises }),
const margeMarchandisesAnnee = isTabac ? Math.round(...) : 0;

// ✅ APRÈS (toujours inclure)
ventes_marchandises: ventesMarchandises,
const margeMarchandisesAnnee = Math.round(ventesMarchandisesAnnee * tauxMargeBoutique);
```

**Sections modifiées:**
- Extraction données SIG (lignes 202-253) - Sans condition
- Année 0 projections (lignes 307-341) - Tous champs inclus
- Années 1-5 projections (lignes 386-531) - Tous champs inclus
- Calcul marges (lignes 470-480) - Sans condition

**Nouveau Flow de Données:**

```
AVANT (problématique):
geminiVisionExtractTool → documentExtraction
ComptableAgent (LLM) → state.comptable.sig (perte de champs possible)
businessPlanDynamiqueTool → if(isTabac) → projections partielles

APRÈS (fiable):
geminiVisionExtractTool
  → documentExtraction
  → state.comptable.sig[year] ← INJECTION DIRECTE (bypass LLM)
businessPlanDynamiqueTool
  → SANS condition isTabac
  → projections COMPLÈTES pour tous les commerces
```

**Fichiers modifiés:**

| Fichier | Modifications |
|---------|---------------|
| `geminiVisionExtractTool.ts` | +50 lignes: injection directe state.comptable.sig[year] après extraction COMPTA |
| `businessPlanDynamiqueTool.ts` | ~150 lignes: suppression toutes conditions isTabac, extraction/projections inconditionnelles |

**Impact:**
- ✅ Tableaux "Actuel" affichent toutes les données extraites
- ✅ Projections incluent ventes_marchandises, commissions_services, marges pour TOUS les commerces
- ✅ Données garanties sans dépendance au LLM
- ✅ Tests passent: 46/46 financiers, 6/6 régression

---

### Fix V4: ComptableAgent Instruction Update - SIG Data Flow (CRITICAL)

**Problème:** Le tableau SIG dans le rapport HTML affichait "-" pour `marge_brute_globale`, `charges_externes`, `charges_exploitant` malgré une extraction réussie.

**Cause Racine Identifiée:**
L'instruction système de `ComptableAgent.ts` contenait un format JSON exemple **obsolète** :
- Format ancien : `"chiffre_affaires": 500000` (nombre simple)
- Format nouveau : `"chiffre_affaires": { "valeur": 500000, "pct_ca": 100 }`
- Champs manquants : `marge_brute_globale`, `autres_achats_charges_externes`, `charges_exploitant`, `salaires_personnel`

**Le LLM Gemini ne copiait pas les champs car ils n'étaient pas dans l'exemple !**

**Flow du Problème:**
```
calculateSigTool.execute()
    → Retourne { sig: { "2023": { marge_brute_globale: {valeur, pct_ca}, ...} } }
         ↓
ComptableAgent (LLM Gemini)
    → Interprète selon l'instruction système (format ANCIEN)
    → NE COPIE PAS les nouveaux champs ❌
         ↓
state.comptable.sig → Données incomplètes
```

**Solution Implémentée:**

**1. Mise à jour du format SIG dans l'instruction (`ComptableAgent.ts` lignes 164-184)**
```json
"sig": {
  "2024": {
    "year": 2024,
    "source": "compta_extraction",
    "chiffre_affaires": { "valeur": 500000, "pct_ca": 100 },
    "marge_commerciale": { "valeur": 200000, "pct_ca": 40 },
    "marge_brute_globale": { "valeur": 340000, "pct_ca": 68 },
    "autres_achats_charges_externes": { "valeur": 60000, "pct_ca": 12 },
    "valeur_ajoutee": { "valeur": 180000, "pct_ca": 36 },
    "salaires_personnel": { "valeur": 50000, "pct_ca": 10 },
    "charges_sociales_personnel": { "valeur": 20000, "pct_ca": 4 },
    "charges_exploitant": { "valeur": 35000, "pct_ca": 7 },
    "ebe": { "valeur": 85000, "pct_ca": 17 },
    "resultat_exploitation": { "valeur": 70000, "pct_ca": 14 },
    "resultat_net": { "valeur": 55000, "pct_ca": 11 }
  }
}
```

**2. Nouvelle règle n°6 ajoutée (lignes 291-294)**
```
6. ⚠️ CRITIQUE SIG: Copier TOUS les champs retournés par calculateSig dans le JSON de sortie sig.
   Le format est { "valeur": number, "pct_ca": number } pour chaque indicateur.
   Ne PAS simplifier les valeurs - garder le format structuré exact retourné par le tool.
   Champs OBLIGATOIRES: marge_brute_globale, autres_achats_charges_externes, charges_exploitant,
                        salaires_personnel, charges_sociales_personnel
```

**Fichier modifié:** `server/adk/financial/agents/ComptableAgent.ts`

**Impact:** Tous les tableaux dépendants (SIG, Valorisation, Business Plan) affichent désormais toutes les données extraites.

---

### Fix V3: Suppression des fallbacks dans calculateTabacValuationTool

**Problème:** Le tableau "Méthode HYBRIDE Tabac/Presse/FDJ" affichait des valeurs **estimées** (8% du CA pour commissions, 25% pour CA boutique) au lieu de données extraites.

**Solution:** Suppression des fallbacks (lignes 178-185, 243-250 de `calculateTabacValuationTool.ts`).

**Avant (BUG):**
```typescript
if (commissionsNettes === 0) {
  commissionsNettes = caTotal * 0.08;  // ❌ ESTIMATION INTERDITE
}
```

**Après (FIX):**
```typescript
if (commissionsNettes === 0) {
  console.warn('[calculateTabacValuation] ⚠️ Commissions nettes non fournies - aucune estimation');
}
```

**Impact:** Le tableau affiche "0" ou "Non disponible" pour les données non extraites, au lieu de valeurs inventées.

---

### Fix V2: Correction de findExtractedSig dans calculateSigTool

**Problème:** La fonction `findExtractedSig` perdait des champs lors du merge entre `key_values` et `sig`.

**Solution:** Réécriture complète avec :
1. Priorité `key_values` > `sig`
2. Mapping explicite des champs (`charges_externes` → `autres_achats_charges_externes`)
3. Ajout de `compte_de_resultat` aux `COMPTABLE_DOC_TYPES`

**Fichier modifié:** `server/adk/financial/tools/accounting/calculateSigTool.ts`

---

### Fix: SIG Values Missing in HTML Report (accountingSection bypass)

**Problème:** Les valeurs SIG extraites (`marge_brute_globale`, `charges_externes`, `charges_exploitant`) s'affichaient "-" dans le rapport HTML malgré une extraction réussie par `calculateSigTool`.

**Cause Racine:** L'agent LLM `comptable` génère sa propre structure SIG résumée qui ne préserve pas tous les champs extraits par les outils. Le rapport HTML lisait depuis `state.comptable.sig` (sortie agent) au lieu des données d'extraction brutes.

**Flow avant (BUG):**
```
Gemini Vision → extractedData.key_values → calculateSigTool (OK)
                                          ↓
                              comptable agent (LLM) → summarized SIG (loses fields!)
                                          ↓
                              accountingSection.ts → reads state.comptable.sig → "-"
```

**Flow après (FIX):**
```
Gemini Vision → extractedData.key_values → documentExtraction (state)
                                          ↓
                             accountingSection.ts → reads comptable.sig FIRST
                                                  → FALLBACK to documentExtraction
                                          ↓
                             All values displayed ✅
```

**Solution implémentée:**

**1. Nouvelle fonction helper (`accountingSection.ts`)**

```typescript
function getExtractedValueForYear(
  documentExtraction: any,
  year: string,
  field: string
): number {
  // Cherche dans documentExtraction.documents[].extractedData.key_values
  // Gère les alias de champs (charges_externes → autres_achats_charges_externes)
  // Retourne 0 si non trouvé
}
```

**2. Nouveau paramètre `documentExtraction`**

```typescript
export function generateAccountingSection(
  comptable: any,
  evolutionChart: any,
  healthGauge: any,
  businessPlan?: any,
  userComments?: any,
  documentExtraction?: any  // ✨ NOUVEAU
): string
```

**3. Logique de fallback dans la boucle SIG**

```typescript
// Pour chaque indicateur et chaque année:
value = extractValue(comptable.sig[y]?.[ind.key]);

// Fallback si valeur manquante dans comptable.sig
if (value === 0 || value === undefined) {
  const fallbackFields = ['marge_brute_globale', 'autres_achats_charges_externes'];
  if (fallbackFields.includes(ind.key)) {
    value = getExtractedValueForYear(documentExtraction, y, ind.key);
  }
}
```

**Champs couverts par le fallback:**
- `marge_brute_globale` (Marge Brute Globale)
- `autres_achats_charges_externes` / `charges_externes` (Charges Externes)
- `charges_exploitant` (Salaire Gérant)
- `salaires_personnel` / `charges_sociales_personnel` (Frais de Personnel)

**Fichiers modifiés:**

| Fichier | Modification |
|---------|--------------|
| `sections/accountingSection.ts` | +55 lignes: helper `getExtractedValueForYear()`, nouveau paramètre, logique fallback |
| `generateFinancialHtmlTool.ts` | +1 ligne: passage de `documentExtraction` à `generateAccountingSection()` |

**Principe clé:** Le rapport HTML ne dépend plus de l'agent comptable pour les champs SIG critiques - il lit directement depuis les données extraites en fallback.

---

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

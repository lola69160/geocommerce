# Tests - SearchCommerce

Suite de tests pour valider le Pipeline Financier et assurer la non-régression du pipeline stratégique.

## Structure des Tests

```
tests/
├── financial/
│   ├── fixtures/              # Données de test mockées
│   │   ├── sample-business.json
│   │   ├── expected-output.json
│   │   ├── mock-document-extraction.json
│   │   └── mock-sig-data.json
│   ├── agents/                # Tests unitaires des agents
│   │   ├── documentExtraction.test.ts
│   │   ├── comptable.test.ts
│   │   ├── valorisation.test.ts
│   │   └── immobilier.test.ts
│   ├── tools/                 # Tests unitaires des outils
│   │   ├── calculateSig.test.ts
│   │   ├── calculateRatios.test.ts
│   │   └── calculateValuation.test.ts
│   └── integration/           # Tests d'intégration
│       └── fullPipeline.test.ts
└── regression/                # Tests de non-régression
    └── strategicPipeline.test.ts
```

## Scripts de Test

### Lancer tous les tests
```bash
npm test
```

### Tests du Pipeline Financier uniquement
```bash
npm run test:financial
```

### Tests en mode watch (développement)
```bash
npm run test:financial:watch
```

### Tests d'intégration uniquement
```bash
npm run test:integration
```

### Tests de non-régression
```bash
npm run test:regression
```

### Interface UI pour les tests
```bash
npm run test:ui
```

### Couverture de code
```bash
npm run test:coverage
```

## Tests Unitaires

### Tests des Outils (Tools)

**`calculateSig.test.ts`** - Calcul des Soldes Intermédiaires de Gestion
- ✅ Calcul correct des SIG pour plusieurs années
- ✅ Calcul correct de la marge commerciale
- ✅ Calcul correct de l'EBE
- ✅ Calcul correct du résultat d'exploitation
- ✅ Calcul correct du résultat net
- ✅ Gestion des documents manquants
- ✅ Gestion du format JSON string (pattern ADK)
- ✅ Filtrage des documents non-comptables
- ✅ Gestion des valeurs négatives (pertes)
- ✅ Tri des années par ordre décroissant

**`calculateRatios.test.ts`** - Calcul des ratios financiers (TODO)

**`calculateValuation.test.ts`** - Calcul de la valorisation (TODO)

### Tests des Agents

**`documentExtraction.test.ts`** - Agent d'extraction de documents
- ✅ Instanciation correcte
- ✅ Outils disponibles (extractPdf, classifyDocument, parseTables)
- ✅ Traitement des documents mockés
- ✅ Gestion des listes vides

**`comptable.test.ts`** - Agent d'analyse comptable
- ✅ Instanciation correcte
- ✅ Outils d'analyse comptable disponibles

**`valorisation.test.ts`** - Agent de valorisation
- ✅ Instanciation correcte
- ✅ 3 méthodes de valorisation + synthèse

**`immobilier.test.ts`** - Agent d'analyse immobilière
- ✅ Instanciation correcte
- ✅ Outils d'analyse immobilière disponibles

## Test d'Intégration

**`fullPipeline.test.ts`** - Pipeline Financier Complet

Test end-to-end du pipeline avec les 6 agents:
1. DocumentExtractionAgent
2. ComptableAgent
3. ValorisationAgent
4. ImmobilierAgent
5. FinancialValidationAgent
6. FinancialReportAgent

**Cas de test:**
- ✅ Structure correcte du pipeline (6 agents)
- ✅ Exécution complète avec données réelles (tabac presse NAF 47.26Z)
- ✅ Gestion des documents manquants
- ✅ Génération du rapport HTML final
- ✅ Validation des résultats clés

**Données de test:**
- PDFs réels dans `server/adk/financial/test-data/`
- Business info: Tabac Presse (NAF 47.26Z)
- Options: prix affiché, analyse immobilière

## Tests de Non-Régression

**`strategicPipeline.test.ts`** - Pipeline Stratégique

Vérifie que le pipeline d'analyse professionnelle existant (/api/analyze-professional-adk) n'a pas été affecté par l'ajout du pipeline financier.

**Tests:**
- ✅ Endpoint `/api/analyze-professional-adk` disponible
- ✅ Indépendance des deux pipelines
- ✅ State management séparé
- ✅ Orchestrateurs indépendants
- ✅ Agents stratégiques intacts (10 agents)
- ✅ Rapports générés dans des dossiers séparés

## Prérequis pour les Tests

### Variables d'Environnement

Les tests d'intégration nécessitent:
```bash
GEMINI_API_KEY=your_gemini_api_key
```

Sans clé API, les tests utilisant Gemini seront skippés automatiquement.

### Données de Test

Les PDFs de test doivent être placés dans:
```
server/adk/financial/test-data/
```

Les fichiers actuels (bilans comptables réels):
- `COMPTA_BILAN_30_NOVEMBRE_2023.PDF`
- `COMPTA_bilan_30.11.2022.PDF`
- `bilan_30_novembre_2021.PDF`
- Autres documents (coût transaction, descriptif)

## Configuration Vitest

Voir `vitest.config.ts` pour la configuration complète:
- Environnement: Node.js
- Timeout: 30s par test (120s pour tests d'intégration)
- Coverage: v8 provider
- Alias: `@` pour src, `@server` pour server, `@tests` pour tests

## Fixtures de Test

### `sample-business.json`
Business info pour un tabac presse (NAF 47.26Z):
- Nom, SIRET, activité
- Adresse, ville, code postal
- Date de création, forme juridique
- Capital, employés, statut

### `expected-output.json`
Résultats attendus du pipeline complet:
- Document extraction summary
- SIG et ratios comptables
- Valorisation (3 méthodes + fourchette)
- Analyse immobilière (bail, murs, travaux)

### `mock-document-extraction.json`
Extraction de documents mockée avec:
- 3 bilans (2023, 2022, 2021)
- Tableaux actif/passif extraits
- Metadata (exercice, date clôture)

### `mock-sig-data.json`
Données comptables pour calcul SIG:
- Chiffre d'affaires, achats
- Charges diverses
- Résultats financiers et exceptionnels
- Impôts

## Bonnes Pratiques

### Écrire un Test

```typescript
import { describe, it, expect } from 'vitest';

describe('MyFeature', () => {
  it('should do something', () => {
    // Arrange
    const input = ...;

    // Act
    const result = myFunction(input);

    // Assert
    expect(result).toBe(expected);
  });
});
```

### Tester un Agent ADK

```typescript
import { Runner, InMemorySessionService } from '@google/adk';

const sessionService = new InMemorySessionService();
await sessionService.createSession({ appName, userId, sessionId });

const runner = new Runner({
  appName,
  agent: myAgent,
  sessionService,
});

for await (const event of runner.runAsync({
  userId,
  sessionId,
  stateDelta: initialState,
})) {
  // Collect events and state
}
```

### Mock un ToolContext

```typescript
const mockContext: ToolContext = {
  state: {
    get: (key: string) => mockStateData[key],
    set: () => {},
  },
} as any;

const result = await tool.execute(params, mockContext);
```

## Débogage

### Voir les logs détaillés
```bash
npm run test:financial -- --reporter=verbose
```

### Lancer un seul test
```bash
npm run test:financial -- calculateSig.test.ts
```

### Mode watch avec UI
```bash
npm run test:ui
```

### Voir la couverture HTML
```bash
npm run test:coverage
# Ouvrir coverage/index.html
```

## CI/CD

Ces tests peuvent être intégrés dans une pipeline CI/CD:

```yaml
# .github/workflows/test.yml
- name: Run Financial Tests
  run: npm run test:financial
  env:
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}

- name: Run Regression Tests
  run: npm run test:regression
```

## Roadmap

- [ ] Compléter tests de calculateRatiosTool
- [ ] Compléter tests de valorisation
- [ ] Ajouter tests pour FinancialValidationAgent
- [ ] Ajouter tests pour FinancialReportAgent
- [ ] Tests de performance (benchmarks)
- [ ] Tests de charge (multiple documents)
- [ ] Snapshot testing pour les rapports HTML
- [ ] Tests E2E avec Playwright

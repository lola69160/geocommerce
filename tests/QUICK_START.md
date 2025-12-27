# 🚀 Quick Start - Tests du Pipeline Financier

## Lancer les Tests Maintenant

```bash
# Tous les tests du pipeline financier (recommandé)
npm run test:financial

# Avec interface UI interactive
npm run test:ui

# Mode watch pour développement
npm run test:financial:watch
```

## 📊 Résultats Attendus

Vous devriez voir:
```
✓ tests/financial/tools/calculateSig.test.ts (10 tests)
✓ tests/financial/agents/comptable.test.ts (3 tests)
✓ tests/financial/agents/valorisation.test.ts (3 tests)
✓ tests/financial/agents/immobilier.test.ts (3 tests)
✓ tests/financial/agents/documentExtraction.test.ts (4 tests)
✓ tests/financial/integration/fullPipeline.test.ts (3 tests)

Test Files: 8 passed (8)
Tests:     30 passed (30)
```

## 🔑 Ajouter GEMINI_API_KEY (Optionnel)

Pour activer les tests d'intégration complets:

```bash
# Dans .env
GEMINI_API_KEY=your_actual_gemini_api_key
```

**Sans clé API:** Les tests s'exécutent quand même, mais certains tests d'intégration sont skippés.

## 📝 Exemple de Test - Calcul SIG

Voici comment le test vérifie les calculs SIG pour un tabac presse:

```typescript
// Test: Calcul correct de la marge commerciale
const result = await calculateSigTool.execute({}, mockContext);
const sig2023 = result.sig['2023'];

// Marge commerciale = Ventes - Achats
// = 450000 - 270000 = 180000
expect(sig2023.marge_commerciale).toBe(180000);

// EBE = Marge - Impôts - Charges personnel
// = 180000 - 8000 - 62000 = 110000
expect(sig2023.ebe).toBe(110000);

// Résultat net final
expect(sig2023.resultat_net).toBe(84000);
```

## 🧪 Test d'Intégration du Pipeline Complet

Le test `fullPipeline.test.ts` exécute les 6 agents séquentiellement:

```typescript
1. documentExtraction  → Extraction des PDFs
2. comptable          → Calcul SIG, ratios, santé financière
3. valorisation       → 3 méthodes de valorisation
4. immobilier         → Analyse bail, murs, travaux
5. financialValidation → Validation croisée
6. financialReport    → Génération rapport HTML
```

**Données de test réelles:** PDFs dans `server/adk/financial/test-data/`

## ✅ Tests de Non-Régression

Vérifiez que le pipeline stratégique n'est pas affecté:

```bash
npm run test:regression
```

**Résultat attendu:**
```
✓ Pipeline stratégique indépendant
✓ State management séparé
✓ 10 agents stratégiques intacts
✓ Rapports dans des dossiers différents
```

## 🔍 Déboguer un Test

### Voir les logs détaillés
```bash
npm run test:financial -- --reporter=verbose
```

### Lancer un seul fichier
```bash
npm run test:financial -- calculateSig.test.ts
```

### Lancer un seul test
```bash
npm run test:financial -- -t "should calculate correct EBE"
```

## 📈 Voir la Couverture de Code

```bash
npm run test:coverage

# Ouvrir le rapport HTML
# Windows: start coverage/index.html
# Linux/Mac: open coverage/index.html
```

## 🛠️ Ajouter un Nouveau Test

### 1. Créer le fichier de test

```typescript
// tests/financial/tools/myNewTool.test.ts
import { describe, it, expect } from 'vitest';
import { myNewTool } from '@server/adk/financial/tools/myNewTool';

describe('myNewTool', () => {
  it('should do something correctly', () => {
    const result = myNewTool.execute({ param: 'value' });
    expect(result).toBeDefined();
  });
});
```

### 2. Lancer le test en mode watch

```bash
npm run test:financial:watch
```

### 3. Vitest détecte automatiquement le nouveau fichier

Les tests se relancent à chaque modification ! ⚡

## 📚 Documentation Complète

- **`tests/README.md`** - Documentation détaillée des tests
- **`TESTS_SUMMARY.md`** - Résumé et résultats
- **Ce fichier** - Quick start pour démarrage rapide

## 🎯 Cas d'Usage Réels

### Tester avec un nouveau tabac presse

Créez un nouveau fichier de fixture:

```json
// tests/financial/fixtures/my-tabac-case.json
{
  "name": "MON TABAC",
  "siret": "12345678901234",
  "nafCode": "47.26Z",
  "activity": "Tabac Presse"
}
```

Puis utilisez-le dans vos tests.

### Tester avec de vrais PDFs

Placez vos PDFs dans:
```
server/adk/financial/test-data/
```

Le test d'intégration les utilisera automatiquement.

## ⚡ Raccourcis Utiles

```bash
# Relancer seulement les tests qui ont échoué
npm run test:financial -- --changed

# Lancer avec coverage
npm run test:financial -- --coverage

# UI mode (recommandé pour explorer les tests)
npm run test:ui
```

## 🐛 Problèmes Courants

### "GEMINI_API_KEY non configurée"
→ Normal, les tests s'exécutent quand même

### "Session not found"
→ Normal pour certains tests, l'erreur est gérée gracieusement

### "Server not running"
→ Normal pour tests de régression, skip automatique

## 🎉 Prêt à Tester !

```bash
npm run test:financial
```

**Tous les tests devraient passer en ~1-2 secondes** ⚡

Pour toute question, consultez `tests/README.md` 📖

# ValorisationAgent - Documentation

## Vue d'ensemble

Le **ValorisationAgent** est le 3ème agent du pipeline financier ADK. Il estime la valeur d'un fonds de commerce selon 3 méthodes de valorisation reconnues en France.

## Architecture

### Agent Principal
- **Fichier**: `server/adk/financial/agents/ValorisationAgent.ts`
- **Type**: `LlmAgent` (Gemini 3 Flash Preview)
- **OutputKey**: `valorisation` (injecté dans `state.valorisation`)

### Tools (4)
1. **calculateEbeValuationTool** - Valorisation par multiple d'EBE (méthode de référence)
2. **calculateCaValuationTool** - Valorisation par % du CA (méthode complémentaire)
3. **calculatePatrimonialTool** - Valorisation patrimoniale (actif net + goodwill)
4. **synthesizeValuationTool** - Synthèse des 3 méthodes + recommandation finale

### Configuration
- **Fichier**: `server/adk/financial/config/valuationCoefficients.ts`
- **Contenu**: Coefficients sectoriels (multiples EBE, % CA) pour 10 codes NAF
- **Secteurs couverts**: Tabac, Restaurant, Boulangerie, Épicerie, Bar, Coiffure, Habillement, Pharmacie, Hôtellerie, Boucherie, Fleuriste

## Workflow du ValorisationAgent

### ÉTAPE 1: Méthode du Multiple d'EBE

```typescript
calculateEbeValuation({ nafCode: "47.26Z" })
```

**Calculs effectués**:
1. EBE de référence = Moyenne EBE sur 3 ans (ou dernière année)
2. Retraitements standards:
   - Salaire de gérant non rémunéré (+35 000 €)
   - Retraitements personnalisés (si fournis)
3. Application des multiples sectoriels (ex: Tabac = 2.5x à 4.5x EBE)

**Output**:
```json
{
  "ebe_reference": 85000,
  "ebe_retraite": 120000,
  "retraitements": [
    {
      "description": "Salaire de gérant non rémunéré (estimation)",
      "montant": 35000
    }
  ],
  "coefficient_bas": 2.5,
  "coefficient_median": 3.5,
  "coefficient_haut": 4.5,
  "valeur_basse": 300000,
  "valeur_mediane": 420000,
  "valeur_haute": 540000,
  "justification": "..."
}
```

### ÉTAPE 2: Méthode du % de CA

```typescript
calculateCaValuation({ nafCode: "47.26Z" })
```

**Calculs effectués**:
1. CA de référence = Moyenne CA sur 3 ans
2. Application des % sectoriels (ex: Tabac = 50% à 80% CA)

**Output**:
```json
{
  "ca_reference": 650000,
  "pourcentage_bas": 50,
  "pourcentage_median": 65,
  "pourcentage_haut": 80,
  "valeur_basse": 325000,
  "valeur_mediane": 422500,
  "valeur_haute": 520000,
  "justification": "..."
}
```

**⚠️ Limitation**: Cette méthode ne tient pas compte de la rentabilité (2 commerces avec même CA mais marges différentes auront même valorisation).

### ÉTAPE 3: Méthode Patrimoniale

```typescript
calculatePatrimonial({})
```

**Calculs effectués**:
1. Extraction actif/passif depuis le bilan (state.documentExtraction)
2. Actif net comptable = Actif total - Dettes
3. Réévaluation des actifs corporels
4. Goodwill = 1.5x EBE (estimation simplifiée)

**Output**:
```json
{
  "actif_net_comptable": 150000,
  "revalorisation_actifs": 20000,
  "goodwill": 127500,
  "valeur_estimee": 297500,
  "detail": [
    {
      "poste": "Immobilisations corporelles",
      "valeur_comptable": 80000,
      "valeur_reelle": 90000
    }
  ],
  "justification": "..."
}
```

**⚠️ Limitation**: Sous-évalue souvent les fonds de commerce (ne capte pas bien la rentabilité future).

### ÉTAPE 4: Synthèse Finale

```typescript
synthesizeValuation({ prix_affiche: 480000 })  // prix_affiche optionnel
```

**Logique de décision**:
1. **Méthode privilégiée**:
   - Si EBE ≤ 0 → Patrimoniale
   - Si actif net > 2x valeur EBE → Patrimoniale
   - Sinon → EBE (défaut)

2. **Pondération des méthodes**:
   - Si EBE privilégiée: 70% EBE + 20% CA + 10% Patrimoniale
   - Si Patrimoniale privilégiée: 60% Patrimoniale + 30% CA + 10% EBE

3. **Comparaison avec prix affiché**:
   - Écart < -15% → Sous-évalué
   - Écart -15% à +15% → Prix marché
   - Écart > +15% → Sur-évalué

4. **Arguments de négociation**:
   - **Pour acheteur** (baisser prix): Alertes comptables critiques, tendance déclin, prix affiché > estimation
   - **Pour vendeur** (anticiper): Forte croissance, santé financière excellente, ratios > secteur

**Output**:
```json
{
  "synthese": {
    "fourchette_basse": 315000,
    "fourchette_mediane": 420000,
    "fourchette_haute": 525000,
    "methode_privilegiee": "EBE",
    "raison_methode": "Multiple d'EBE est la méthode de référence...",
    "valeur_recommandee": 420000
  },
  "comparaisonPrix": {
    "prix_affiche": 480000,
    "ecart_vs_estimation_pct": 14,
    "appreciation": "sur-evalue",
    "marge_negociation": 60000
  },
  "argumentsNegociation": {
    "pour_acheteur": [
      "📊 Prix affiché (480 000 €) supérieur de 14% à la valorisation médiane",
      "⚠️ TRESORERIE: Délai clients élevé..."
    ],
    "pour_vendeur": [
      "📈 Forte croissance : CA +12.5%",
      "✅ Excellente santé financière : score 72/100"
    ]
  },
  "confidence": 75,
  "limitations": [
    "Bilan non fourni : valorisation patrimoniale approximative"
  ]
}
```

## Coefficients Sectoriels

### Exemples de Multiples EBE

| Secteur | Code NAF | Multiple Bas | Multiple Médian | Multiple Haut |
|---------|----------|--------------|-----------------|---------------|
| Tabac | 47.26 | 2.5x | 3.5x | 4.5x |
| Restaurant | 56.10 | 2.0x | 3.0x | 4.0x |
| Boulangerie | 10.71 | 3.0x | 4.0x | 5.0x |
| Pharmacie | 47.73 | 4.0x | 5.5x | 7.0x |
| Bar/Café | 56.30 | 2.5x | 3.5x | 4.5x |

### Exemples de % CA

| Secteur | Code NAF | % Bas | % Médian | % Haut |
|---------|----------|-------|----------|--------|
| Tabac | 47.26 | 50% | 65% | 80% |
| Restaurant | 56.10 | 50% | 70% | 90% |
| Boulangerie | 10.71 | 60% | 80% | 100% |
| Pharmacie | 47.73 | 70% | 90% | 110% |
| Hôtellerie | 55.10 | 80% | 120% | 160% |

## Niveau de Confiance (0-100)

Le score de confiance est calculé automatiquement :

- **Base**: 50
- **+20** si 3 années de données comptables
- **+15** si secteur NAF connu (coefficients spécifiques)
- **+10** si tendance croissance
- **+5** si score santé > 60
- **-10** si EBE négatif
- **-5** si tendance déclin

**Interprétation**:
- 80-100: Très haute confiance
- 60-79: Bonne confiance
- 40-59: Confiance moyenne
- 20-39: Faible confiance
- 0-19: Très faible confiance

## Limitations Identifiées

Les limitations sont automatiquement détectées et listées :

1. **Données sur moins de 3 ans**: Difficulté à identifier tendances
2. **Code NAF non fourni**: Coefficients génériques utilisés
3. **Bilan non fourni**: Valorisation patrimoniale approximative
4. **Prix affiché non fourni**: Impossible de comparer à la demande vendeur

## Dépendances State

Le ValorisationAgent dépend de :

### Input (lecture)
- `state.comptable` - **OBLIGATOIRE** (SIG, ratios, évolution, healthScore)
- `state.documentExtraction` - Optionnel (pour bilan si méthode patrimoniale)
- `state.businessInfo` - Optionnel (nafCode pour coefficients sectoriels)

### Output (écriture)
- `state.valorisation` - Injecté via `outputKey: 'valorisation'`

## Pattern ADK Respecté

✅ **Tous les calculs dans les tools** (pas par le LLM) pour garantir exactitude
✅ **LLM interprète les résultats** et génère justifications/commentaires
✅ **Parsing JSON strings** (pattern CLAUDE.md) dans tous les tools
✅ **Output injecté automatiquement** dans state via outputKey

## Usage Example

```typescript
import { ValorisationAgent } from './server/adk/financial/agents/ValorisationAgent';
import { Runner, InMemorySessionService } from '@google/adk';

// Input state (après DocumentExtractionAgent et ComptableAgent)
const stateDelta = {
  comptable: { /* SIG, ratios, evolution */ },
  documentExtraction: { /* documents parsés */ },
  businessInfo: {
    name: 'Tabac Le Central',
    siret: '12345678900012',
    nafCode: '47.26Z',
    activity: 'Tabac-presse'
  }
};

// Créer agent
const agent = new ValorisationAgent();

// Créer runner
const runner = new Runner({
  appName: 'financial',
  agent,
  sessionService: new InMemorySessionService()
});

// Exécuter
for await (const event of runner.runAsync({
  userId: 'user1',
  sessionId: 'session1',
  stateDelta
})) {
  if (event.actions?.stateDelta?.valorisation) {
    console.log('Valorisation:', event.actions.stateDelta.valorisation);
  }
}
```

## Fichiers Créés

```
server/adk/financial/
├── agents/
│   └── ValorisationAgent.ts           # Agent principal
├── tools/
│   └── valuation/
│       ├── calculateEbeValuationTool.ts      # Méthode EBE
│       ├── calculateCaValuationTool.ts       # Méthode CA
│       ├── calculatePatrimonialTool.ts       # Méthode patrimoniale
│       ├── synthesizeValuationTool.ts        # Synthèse finale
│       └── index.ts                           # Export tools
└── config/
    └── valuationCoefficients.ts       # Coefficients sectoriels (10 NAF)
```

## Tests Recommandés

1. **Test avec EBE positif** (commerce rentable):
   - Méthode privilégiée = EBE
   - Fourchette cohérente avec multiples sectoriels

2. **Test avec EBE négatif** (commerce en difficulté):
   - Méthode privilégiée = Patrimoniale
   - Valorisation basée sur actifs

3. **Test avec prix affiché**:
   - Écart calculé correctement
   - Arguments de négociation générés

4. **Test sans NAF code**:
   - Coefficients par défaut utilisés
   - Limitation mentionnée

5. **Test avec 1 seule année**:
   - EBE/CA de référence = dernière année
   - Confidence réduite
   - Limitation "Données sur moins de 3 ans"

## Prochaines Étapes

Le ValorisationAgent est maintenant prêt pour intégration dans le pipeline financier complet :

1. ✅ DocumentExtractionAgent
2. ✅ ComptableAgent
3. ✅ **ValorisationAgent** ← Vous êtes ici
4. ⏳ ImmobilierAgent (analyse bail commercial)
5. ⏳ FinancialValidationAgent (validation cohérence)
6. ⏳ FinancialReportAgent (rapport HTML final)

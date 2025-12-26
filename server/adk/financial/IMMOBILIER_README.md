# ImmobilierAgent - Documentation

## Vue d'ensemble

Le **ImmobilierAgent** est le 4ème agent du pipeline financier ADK. Il analyse les aspects immobiliers d'un fonds de commerce : bail commercial, option d'achat des murs, et travaux nécessaires.

**Particularité** : Fonctionne en **mode dégradé** si le bail commercial n'est pas fourni (génère quand même une analyse basée sur les estimations).

## Architecture

### Agent Principal
- **Fichier**: `server/adk/financial/agents/ImmobilierAgent.ts`
- **Type**: `LlmAgent` (Gemini 3 Flash Preview)
- **OutputKey**: `immobilier` (injecté dans `state.immobilier`)

### Tools (4)
1. **analyzeBailTool** - Analyse du bail commercial (dates, loyer, clauses)
2. **estimateDroitBailTool** - Estimation de la valeur du droit au bail
3. **analyzeMursTool** - Analyse de l'option d'achat des murs (rentabilité)
4. **estimateTravauxTool** - Estimation des travaux obligatoires et recommandés

### Modes de Fonctionnement

| Mode | Condition | Source Bail | Fonctionnalité |
|------|-----------|-------------|----------------|
| **Document** | Bail fourni en PDF | `state.documentExtraction` | Extraction automatique des clauses |
| **Saisie manuelle** | Paramètres fournis | `manual_input` | Utilise données saisies manuellement |
| **Dégradé** | Aucun bail | Estimations | Analyse partielle (travaux uniquement) |

## Workflow du ImmobilierAgent

### ÉTAPE 1: Analyse du Bail Commercial

```typescript
analyzeBail({
  manual_input?: {
    type: 'commercial_3_6_9',
    loyer_annuel_hc: 18000,
    surface_m2: 80,
    date_effet: '2020-02-01'
  }
})
```

**Sources de données** (par priorité):
1. Document PDF type 'bail' dans `state.documentExtraction`
2. Paramètre `manual_input` si fourni
3. Aucune donnée → `bail_disponible: false`

**Extraction automatique depuis PDF**:
- Type de bail (commercial 3-6-9, dérogatoire, professionnel)
- Bailleur (regex: `BAILLEUR\s*:\s*([A-ZÀ-Ü\s]+)`)
- Dates (regex: `(\d{2})\/(\d{2})\/(\d{4})`)
- Loyer (regex: `loyer.*?(\d+\s?\d*)\s*€`)
- Surface (regex: `(\d+)\s*m[²2]`)

**Calculs effectués**:
- Durée initiale et restante (en mois)
- Loyer total annuel = Loyer HC + Charges
- Loyer mensuel = Total / 12
- Loyer au m² = Loyer HC / Surface
- Loyer marché estimé (heuristique : 180 €/m²/an par défaut)
- Écart par rapport au marché

**Appreciation du loyer**:
- Écart < -15% → **avantageux** (loyer en-dessous marché)
- Écart -15% à +15% → **marche** (loyer conforme)
- Écart > +15% → **desavantageux** (loyer au-dessus marché)

**Output**:
```json
{
  "dataStatus": {
    "bail_disponible": true,
    "source": "document"  // ou "saisie_manuelle" ou "non_disponible"
  },
  "bail": {
    "type": "commercial_3_6_9",
    "bailleur": "SCI IMMOBILIERE ABC",
    "date_signature": "15/01/2020",
    "date_effet": "01/02/2020",
    "date_fin": "01/02/2029",
    "duree_initiale_mois": 108,
    "duree_restante_mois": 48,
    "loyer_annuel_hc": 18000,
    "charges_annuelles": 3000,
    "loyer_total_annuel": 21000,
    "loyer_mensuel": 1750,
    "depot_garantie": 5250,
    "surface_m2": 80,
    "loyer_m2_annuel": 225,
    "loyer_marche_estime": 20000,
    "ecart_marche_pct": -10,
    "appreciation": "avantageux"
  },
  "donnees_manquantes": ["Date signature bail non fournie"]
}
```

### ÉTAPE 2: Estimation du Droit au Bail

```typescript
estimateDroitBail({
  valeur_fonds: 420000  // optionnel
})
```

**Méthodes de calcul**:

#### 1. Méthode du Loyer (toujours calculée)
Formule: `Droit au bail = Loyer annuel × Coefficient (1-3 ans)`

**Coefficient basé sur facteurs**:
- **Base**: 2.0 années
- **Loyer avantageux**: +0.5
- **Loyer désavantageux**: -0.5
- **Durée restante ≥ 6 ans**: +0.3
- **Durée restante < 2 ans**: -0.3
- **Bail 3-6-9**: +0.2
- **Bail dérogatoire**: -0.4
- **Cession libre**: +0.2

**Limites**: Coefficient entre 1.0 et 3.0

#### 2. Méthode du Pourcentage (si valeur_fonds fournie)
Formule: `Droit au bail = Valeur fonds × Pourcentage (15-25%)`

**Pourcentage basé sur emplacement**:
- **Loyer avantageux**: 25%
- **Loyer marché**: 20%
- **Loyer désavantageux**: 15%

**Valeur finale**: Moyenne des 2 méthodes si les deux sont disponibles

**Output**:
```json
{
  "droit_au_bail_estime": 45000,
  "methode_calcul": "Méthode du loyer : 2.5 années × 18 000 €",
  "detail_calcul": {
    "methode_loyer": {
      "coefficient": 2.5,
      "valeur": 45000
    },
    "methode_pourcentage": {
      "pourcentage": 20,
      "valeur": 84000
    },
    "facteurs_valorisants": [
      "Loyer avantageux (en-dessous du marché)",
      "Longue durée restante (4 ans)",
      "Bail 3-6-9 avec statut protecteur"
    ],
    "facteurs_devalorisant": [
      "Aucun facteur dévalorisant majeur"
    ]
  }
}
```

### ÉTAPE 3: Analyse de l'Option Murs

```typescript
analyzeMurs({
  prix_demande: 200000,  // optionnel
  prix_m2_zone: 2500     // optionnel
})
```

**Estimation prix au m² par zone** (si non fourni):

| Zone | Code Postal | Prix/m² Estimé |
|------|-------------|----------------|
| Paris | 75xxx | 10 000 € |
| Grande ville | 69, 13, 33, 31, 44, 59, 67 | 3 500 € |
| Ville moyenne | Autres | 2 500 € (défaut) |
| Ville petite | - | 1 500 € |
| Rural | - | 800 € |

**Calculs de rentabilité**:

#### Rentabilité Brute
Formule: `(Loyer annuel HC / Prix d'achat) × 100`

#### Rentabilité Nette
Formule: `((Loyer - 15% charges propriétaire) / Prix) × 100`

**Charges propriétaire** (estimation): 15% du loyer
- Taxe foncière
- Assurance propriétaire
- Entretien gros œuvre

**Recommandation**:
- Rentabilité brute ≥ 7% → **acheter** (excellent investissement)
- Rentabilité brute 5-7% → **negocier** (correct si prix baisse)
- Rentabilité brute < 5% → **louer** (préserver trésorerie)

**Ajustements**:
- Si prix > estimation +15% → Passer de "acheter" à "negocier"
- Si prix < estimation -15% → Opportunité signalée

**Output**:
```json
{
  "murs": {
    "option_possible": true,
    "surface_m2": 80,
    "prix_demande": 200000,
    "prix_m2_zone": 2500,
    "valeur_estimee": 200000,
    "rentabilite_brute_pct": 9.0,
    "rentabilite_nette_pct": 7.7,
    "recommandation": "acheter",
    "arguments": [
      "💰 Excellente rentabilité brute (9.0% > 7%)",
      "Investissement rentable : achat recommandé",
      "💵 Capital immobilisé : 200 000 € (80 m² × 2 500 €/m²)",
      "📈 Rentabilité nette après charges : 7.7%",
      "✅ Sécurisation de l'emplacement (pas de risque de non-renouvellement du bail)",
      "✅ Valorisation du patrimoine immobilier"
    ]
  }
}
```

### ÉTAPE 4: Estimation des Travaux

```typescript
estimateTravaux({
  surface_m2: 80,           // optionnel (lu depuis bail)
  etat_declare: 'moyen',    // optionnel
  travaux_custom: [...]     // optionnel
})
```

**Détermination de l'état général** (par priorité):
1. **Analyse photos IA** (`state.photo.condition`) - le plus fiable
2. **État déclaré** (`etat_declare` en paramètre)
3. **Non évalué** (par défaut)

**Travaux générés automatiquement**:

#### État "Mauvais"
- **OBLIGATOIRE**: Mise aux normes électriques (80-120 €/m²)
- **OBLIGATOIRE**: Réfection plomberie et sanitaires (3 000-6 000 €)
- **RECOMMANDÉ**: Peinture et sol (50-80 €/m²)

#### État "Moyen"
- **OBLIGATOIRE**: Diagnostic électrique et mise en conformité partielle (2 000-4 000 €)
- **RECOMMANDÉ**: Rafraîchissement peinture et sols (30-50 €/m²)

#### État "Bon"
- Aucun travaux majeur

#### Si Surface ≥ 50 m² (ERP probable)
- **OBLIGATOIRE**: Mise en conformité accessibilité PMR (8 000-15 000 €)
- **OBLIGATOIRE**: Diagnostic de sécurité incendie ERP (2 000-5 000 €)

**Travaux depuis analyse photos**:
Si `state.photo.renovation_needed` et `state.photo.cost_estimate` disponibles, ajout automatique dans travaux_recommandes.

**Output**:
```json
{
  "travaux": {
    "etat_general": "moyen",
    "conformite_erp": "a_verifier",
    "accessibilite_pmr": false,
    "travaux_obligatoires": [
      {
        "description": "Mise en conformité accessibilité PMR (rampe, sanitaires adaptés)",
        "estimation_basse": 8000,
        "estimation_haute": 15000,
        "urgence": "12_mois"
      },
      {
        "description": "Diagnostic de sécurité incendie ERP (extincteurs, éclairage de sécurité)",
        "estimation_basse": 2000,
        "estimation_haute": 5000,
        "urgence": "6_mois"
      }
    ],
    "travaux_recommandes": [
      {
        "description": "Rafraîchissement peinture et sols",
        "estimation_basse": 2400,
        "estimation_haute": 4000,
        "impact": "Améliore présentation générale"
      }
    ],
    "budget_total": {
      "obligatoire_bas": 10000,
      "obligatoire_haut": 20000,
      "recommande_bas": 2400,
      "recommande_haut": 4000
    }
  }
}
```

### ÉTAPE 5: Génération de la Synthèse

Après avoir appelé les 4 tools, le LLM génère :

#### Score Immobilier (0-100)

**Composantes du score**:

1. **Bail (40 points max)**:
   - Appreciation "avantageux" : +40
   - Appreciation "marche" : +25
   - Appreciation "desavantageux" : +10
   - Durée restante > 5 ans : +10
   - Type commercial 3-6-9 : +5

2. **Travaux (30 points max)**:
   - État "bon" : +30
   - État "moyen" : +20
   - État "mauvais" : +5
   - Budget obligatoire < 10 000 € : +10
   - Conformité ERP OK : +10

3. **Murs (30 points max)**:
   - Recommandation "acheter" : +30
   - Recommandation "negocier" : +20
   - Recommandation "louer" : +10
   - Rentabilité > 7% : +10
   - Prix < estimation : +5

**Interprétation**:
- 80-100: Excellent
- 60-79: Bon
- 40-59: Moyen
- 20-39: Faible
- 0-19: Très faible

#### Points Forts (3-5 éléments)
- Loyer avantageux (< marché)
- Bail long terme (> 5 ans restants)
- Local en bon état (travaux limités)
- Rentabilité murs excellente (> 7%)
- Droit au bail valorisé

#### Points de Vigilance (3-5 éléments)
- Loyer élevé vs marché
- Durée bail courte (< 2 ans)
- Travaux importants (> 20 000 €)
- Rentabilité murs faible (< 5%)
- Non-conformité ERP/PMR

#### Recommandation (2-3 phrases)
Synthèse globale :
- Décision sur achat des murs
- Budget travaux à prévoir
- Points de négociation

**Output complet**:
```json
{
  "synthese": {
    "score_immobilier": 72,
    "points_forts": [
      "💰 Loyer avantageux : 10% en-dessous du marché",
      "⏰ Bail long terme : 4 ans restants avec protection 3-6-9",
      "📈 Rentabilité murs excellente : 9% brut, achat recommandé",
      "🏠 Droit au bail valorisé : 45 000 € (2.5 années de loyer)"
    ],
    "points_vigilance": [
      "⚠️ Travaux obligatoires : 10 000 à 20 000 € (conformité PMR et ERP)",
      "🔧 État du local moyen : rafraîchissement recommandé (2 400-4 000 €)",
      "📋 Conformité ERP à vérifier avant acquisition"
    ],
    "recommandation": "Bail avantageux avec protection 3-6-9 et durée restante confortable. L'achat des murs est recommandé (rentabilité 9%). Prévoir un budget travaux de 12 000 à 24 000 € (obligatoire + recommandé) à négocier avec le vendeur."
  }
}
```

## Mode Dégradé (sans bail)

Si aucun bail n'est disponible :

### Comportement des Tools

| Tool | Comportement |
|------|--------------|
| `analyzeBail` | `bail_disponible: false`, `source: "non_disponible"` |
| `estimateDroitBail` | `droit_au_bail_estime: 0`, error signalée |
| `analyzeMurs` | `option_possible: false`, recommandation basique |
| `estimateTravaux` | ✅ **Fonctionne normalement** (utilise photos) |

### Score Réduit
- **Max 30 points** (uniquement section Travaux)
- Bail = 0 points
- Murs = 0 points

### Synthèse Adaptée
- Points forts limités aux travaux
- Points de vigilance : bail non fourni
- Recommandation : "Analyse partielle - bail commercial nécessaire pour évaluation complète"

## Dépendances State

### Input (lecture)
- `state.documentExtraction` - Optionnel (pour extraction bail)
- `state.businessInfo` - Optionnel (code postal pour estimation prix/m²)
- `state.valorisation` - Optionnel (valeur fonds pour calcul droit au bail)
- `state.photo` - Optionnel (état local pour estimation travaux)

### Output (écriture)
- `state.immobilier` - Injecté via `outputKey: 'immobilier'`

## Pattern ADK Respecté

✅ **Tous les calculs dans les tools** (garantit exactitude)
✅ **LLM interprète et génère synthèse**
✅ **Parsing JSON strings** (pattern CLAUDE.md)
✅ **Output injecté automatiquement** via outputKey
✅ **Mode dégradé géré** (fonctionne sans bail)

## Fichiers Créés

```
server/adk/financial/
├── agents/
│   └── ImmobilierAgent.ts           # Agent principal
└── tools/
    └── property/
        ├── analyzeBailTool.ts        # Analyse bail commercial
        ├── estimateDroitBailTool.ts  # Estimation droit au bail
        ├── analyzeMursTool.ts        # Analyse option murs
        ├── estimateTravauxTool.ts    # Estimation travaux
        └── index.ts                   # Export tools
```

## Tests Recommandés

1. **Avec bail PDF complet**: Extraction automatique + tous calculs
2. **Avec manual_input**: Mode saisie manuelle
3. **Sans bail**: Mode dégradé (travaux uniquement)
4. **Avec analyse photos**: État local depuis IA
5. **Murs rentables (>7%)**: Recommandation "acheter"
6. **Murs peu rentables (<5%)**: Recommandation "louer"

## Prochaines Étapes

Le ImmobilierAgent est maintenant prêt pour intégration :

1. ✅ DocumentExtractionAgent
2. ✅ ComptableAgent
3. ✅ ValorisationAgent
4. ✅ **ImmobilierAgent** ← Vous êtes ici
5. ⏳ FinancialValidationAgent (validation cohérence multi-agents)
6. ⏳ FinancialReportAgent (rapport HTML final)

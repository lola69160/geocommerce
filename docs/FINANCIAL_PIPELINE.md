# Financial Pipeline Architecture (ADK)

SearchCommerce intègre un **pipeline d'analyse financière autonome** basé sur ADK pour l'évaluation comptable d'entreprises à partir de documents PDF (bilans, liasses fiscales, baux).

📁 **Module**: `server/adk/financial/`

## Structure du Pipeline

Le Financial Pipeline est un **SequentialAgent orchestrant 6 agents spécialisés** :

1. **DocumentExtractionAgent** ✅ - Extraction et classification de documents PDF
2. **ComptableAgent** ✅ - Analyse comptable de niveau expert-comptable
3. **ValorisationAgent** ✅ - Valorisation de l'entreprise (3 méthodes: EBE, CA, Patrimoniale)
4. **ImmobilierAgent** ✅ - Analyse immobilière professionnelle (bail, murs, travaux)
5. **FinancialValidationAgent** ✅ - Validation croisée et contrôle qualité des analyses
6. **FinancialReportAgent** ✅ - Génération rapport HTML professionnel

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

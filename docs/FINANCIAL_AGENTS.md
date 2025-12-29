# Financial Pipeline - Agents Documentation

Ce document détaille les 7 agents du Financial Pipeline.

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
- `state.documents[]` - Liste des fichiers PDF avec `{ filename, filePath ou content }`
- `state.businessInfo.siret` - SIRET (le SIREN est extrait pour le chemin)

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
- PDFs plus petits → Extraction plus rapide et précise
- Uniquement pages pertinentes → Pas de bruit (annexes, notes)
- Organisation par année → Un fichier par exercice fiscal
- Cache intelligent → Si A_ANALYSER existe, skip le preprocessing
- Documents non-COMPTA préservés → Baux et autres documents intacts

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
- `listDocumentsTool` - Liste les fichiers exacts dans `state.documents`
- `geminiVisionExtractTool` - Vision API directe sur PDF (confidence ~95%)
- `extractPdfTool` - Extraction texte brut (fallback)
- `parseTablesHeuristicTool` - Parsing heuristique si Vision échoue

### Workflow Vision-First
1. `listDocuments()` → Obtenir filenames exacts (obligatoire)
2. `geminiVisionExtract({ filename })` → Extraction Vision (priorité 1)
3. `extractPdf()` + `parseTablesHeuristic()` → Fallback heuristique

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
        "raw_text": "...",
        "tables": [...],
        "key_values": {
          "chiffre_affaires": 235501,
          "ebe": 17558,
          "resultat_net": 4893
        }
      },
      "method": "vision"
    }
  ],
  "summary": {
    "total_documents": 1,
    "years_covered": [2023],
    "extraction_methods": { "vision": 1, "heuristic": 0 }
  }
}
```

### Avantages Gemini Vision
- Précision ~95% vs ~30% avec heuristiques regex
- Extraction directe valeurs comptables
- Supporte PDFs scannés (OCR intégré)
- Coût: ~$0.0014 par PDF (3 pages) avec Gemini Flash

---

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
- `calculateRatiosTool` - Calcule 11 ratios financiers
- `analyzeTrendsTool` - Analyse évolution CA/EBE/RN
- `compareToSectorTool` - Compare 9 ratios aux benchmarks sectoriels
- `calculateHealthScoreTool` - Score 0-100 (4 dimensions)

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
    "tendance": "croissance"
  },
  "ratios": {
    "marge_brute_pct": 40.0,
    "marge_ebe_pct": 17.0,
    "marge_nette_pct": 11.0,
    "taux_endettement_pct": 85.0
  },
  "benchmark": {
    "nafCode": "47.11",
    "sector": "Commerce en magasin non spécialisé",
    "comparisons": [...]
  },
  "alertes": [...],
  "healthScore": {
    "overall": 72,
    "breakdown": {
      "rentabilite": 65,
      "liquidite": 70,
      "solvabilite": 80,
      "activite": 85
    }
  }
}
```

### Configuration
`server/adk/financial/config/sectorBenchmarks.ts` - 8 secteurs NAF avec ratios moyens

---

## 3. ValorisationAgent

### Responsabilités
- Valoriser le fonds de commerce par 3 méthodes reconnues en France
- Calculer la valorisation par multiple d'EBE (méthode de référence)
- Calculer la valorisation par % du CA (méthode complémentaire)
- Calculer la valorisation patrimoniale (actif net + goodwill)
- Synthétiser les 3 méthodes et recommander une fourchette
- Générer des arguments de négociation

### Tools (4)
- `calculateEbeValuationTool` - Valorisation par multiple d'EBE (2.5-4.5x selon secteur)
- `calculateCaValuationTool` - Valorisation par % CA (40-110% selon secteur)
- `calculatePatrimonialTool` - Valorisation patrimoniale (actif - dettes + goodwill)
- `synthesizeValuationTool` - Synthèse des 3 méthodes avec pondération intelligente

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
    "coefficient_median": 3.5,
    "valeur_mediane": 420000
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
  "argumentsNegociation": {
    "pour_acheteur": ["Prix +14% vs estimation", "Délai clients élevé"],
    "pour_vendeur": ["Croissance +12.5%", "Score santé 72/100"]
  }
}
```

### Configuration
`server/adk/financial/config/valuationCoefficients.ts` - 10 secteurs NAF avec coefficients

### Méthode privilégiée (logique automatique)
- Si EBE ≤ 0 → **Patrimoniale**
- Si actif net > 2x valeur EBE → **Patrimoniale**
- Sinon → **EBE** (défaut)

---

## 4. ImmobilierAgent

### Responsabilités
- Analyser le bail commercial (dates, loyer, clauses, conformité)
- Estimer la valeur du droit au bail (propriété commerciale)
- Analyser l'option d'achat des murs (rentabilité locative)
- Estimer les travaux nécessaires (obligatoires et recommandés)
- Générer un score immobilier global (0-100)
- **Fonctionne en mode dégradé** si bail non fourni

### Tools (4)
- `analyzeBailTool` - Analyse bail commercial
- `estimateDroitBailTool` - Estimation droit au bail (méthode loyer 1-3 ans)
- `analyzeMursTool` - Analyse option murs (rentabilité brute/nette)
- `estimateTravauxTool` - Estimation travaux (obligatoire/recommandé)

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
    "ecart_marche_pct": -10,
    "appreciation": "avantageux",
    "droit_au_bail_estime": 45000
  },
  "murs": {
    "option_possible": true,
    "prix_demande": 200000,
    "rentabilite_brute_pct": 9.0,
    "recommandation": "acheter"
  },
  "travaux": {
    "etat_general": "moyen",
    "conformite_erp": "a_verifier",
    "budget_total": {
      "obligatoire_bas": 10000,
      "obligatoire_haut": 20000
    }
  },
  "synthese": {
    "score_immobilier": 72,
    "points_forts": ["Loyer avantageux : 10% sous marché"],
    "points_vigilance": ["Travaux obligatoires : 10-20k€"]
  }
}
```

### Scoring Immobilier (0-100)
- **Bail** (40 points) : Appreciation + durée restante + type
- **Travaux** (30 points) : État général + conformité + budget
- **Murs** (30 points) : Rentabilité + recommandation

### Recommandation achat murs
- Rentabilité brute ≥ 7% → **acheter**
- Rentabilité brute 5-7% → **negocier**
- Rentabilité brute < 5% → **louer**

### Mode dégradé (sans bail)
- Score max 30 points (travaux uniquement)

---

## 5. FinancialValidationAgent

### Responsabilités
- Vérifier la cohérence entre les différentes analyses
- Détecter les anomalies dans les données et les calculs
- Évaluer la qualité des données (complétude, fiabilité, fraîcheur)
- Calculer un score de confiance global (0-100)
- Générer des recommandations de vérification par priorité
- Lister les documents additionnels à demander au vendeur
- **Agent CRITIQUE** pour garantir la fiabilité du rapport final

### Tools (3)
- `crossValidateTool` - 6 vérifications de cohérence entre agents
- `detectAnomaliesTool` - Détection de 6 types d'anomalies
- `assessDataQualityTool` - Évaluation qualité données + score de confiance

### Output (`state.financialValidation`)
```json
{
  "validationDate": "2025-12-26",
  "coherenceChecks": [
    {
      "check": "Cohérence CA extraction/SIG",
      "status": "warning",
      "details": "Léger écart entre CA extrait et CA des SIG : 3.0%"
    }
  ],
  "anomalies": [
    {
      "type": "valeur_aberrante",
      "severity": "warning",
      "description": "Délai clients supérieur à 6 mois",
      "recommendation": "Analyser la qualité des créances clients"
    }
  ],
  "dataQuality": {
    "completeness": 85,
    "reliability": 78,
    "recency": 90,
    "missing_critical": ["Bilans comptables"]
  },
  "confidenceScore": {
    "overall": 82,
    "breakdown": {
      "extraction": 90,
      "comptabilite": 85,
      "valorisation": 75,
      "immobilier": 70
    }
  },
  "verificationsRequises": [...],
  "donneesACollector": [...]
}
```

### Vérifications de cohérence (6 checks)
1. Présence analyses : DocumentExtraction, Comptable présents
2. Cohérence années : Années extraites = années analysées
3. Cohérence CA : CA extraction vs CA SIG (écart <10%)
4. Cohérence EBE/CA : Comptable vs Valorisation (écart <5%)
5. Cohérence valorisation/immobilier
6. Cohérence santé/valorisation

### Types d'anomalies détectées
- **donnee_manquante** : Bilans, comptes de résultat manquants
- **incoherence** : Résultat net > CA, marge impossible
- **valeur_aberrante** : Marge >100%, délais >180j, endettement >300%
- **calcul_errone** : Formules SIG incorrectes

### Score de confiance (0-100)
- **Complétude** (35%) : % données présentes
- **Fiabilité** (40%) : Basé sur alertes + erreurs + anomalies
- **Fraîcheur** (25%) : Âge des données

---

## 6. FinancialReportAgent

### Responsabilités
- Générer les configurations Chart.js pour les graphiques (4 charts)
- Générer le HTML complet du rapport (7 sections professionnelles)
- Sauvegarder le rapport dans `data/financial-reports/`
- Rapport 100% AUTONOME (indépendant du Pipeline Stratégique)
- Style CSS professionnel responsive (print-ready)

### Tools (3)
- `generateChartsTool` - Génère 4 configurations Chart.js
- `generateFinancialHtmlTool` - Génère HTML complet avec 7 sections
- `saveFinancialReportTool` - Sauvegarde dans `data/financial-reports/`

### Output (`state.financialReport`)
```json
{
  "generated": true,
  "filepath": "C:\\AI\\searchcommerce\\data\\financial-reports\\20251226_143000_financial-report-12345.html",
  "filename": "20251226_143000_financial-report-12345.html",
  "size_bytes": 125000,
  "sections_included": [
    "cover_page",
    "executive_summary",
    "accounting_analysis",
    "valuation",
    "real_estate",
    "validation",
    "annexes"
  ]
}
```

### 7 Sections du rapport HTML

1. **Page de Garde** - Nom du commerce, date, badge score confiance
2. **Synthèse Exécutive** - Verdict, valorisation, scores, tableau comparatif, points forts/vigilance
3. **Analyse Comptable** - SIG 3 ans, graphique évolution, ratios, benchmarks, alertes
4. **Valorisation du Fonds** - Graphique fourchettes, tableau 3 méthodes, arguments négociation
5. **Analyse Immobilière** - Bail, loyer vs marché, droit au bail, murs, travaux
6. **Validation & Fiabilité** - Score confiance, radar, qualité données, anomalies
7. **Annexes** - Documents analysés, hypothèses, glossaire

### Graphiques Chart.js (4)
1. **Evolution Chart** - Évolution CA/EBE/RN sur 3 ans
2. **Valorisation Chart** - Fourchettes par méthode
3. **Health Gauge** - Score 0-100 en semi-cercle
4. **Confidence Radar** - 4 axes (extraction, comptabilité, valorisation, immobilier)

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

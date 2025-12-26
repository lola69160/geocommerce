# Changelog

## [2025-12-26] - Rapport HTML Enrichi : Photos, BODACC, Horaires et Section Commune

### ✨ Nouvelles Fonctionnalités

#### Rapport HTML Professionnel Enrichi
Le rapport généré par le pipeline ADK inclut maintenant 4 nouvelles sections visuelles :

**1. 🏘️ Présentation de la Commune**
- Photo représentative récupérée via **Tavily Search API**
  - Query intelligente : `"${commune} France tourisme présentation ville photos"`
  - `include_images: true` + `search_depth: 'advanced'`
  - Timeout : 8 secondes avec fallback graceful
- Carte Google Maps Static API avec marker rouge sur le commerce
- Description enrichie combinant données démographiques + contexte Tavily (300 caractères)
- Layout responsive : grille 2 colonnes (photo | carte) sur desktop, 1 colonne sur mobile

**2. 📸 Photos du Commerce**
- Galerie filtrée intelligente :
  - Max 6 photos de qualité (dimensions ≥ 400px)
  - Grille responsive CSS (3 colonnes desktop, 1 mobile)
- Annotations IA Gemini Vision :
  - Badge condition du local sur première photo
  - Indicateur travaux nécessaires
  - Estimation coût de rénovation
- Source : `places.photos[]` via PlacesAgent → fetchAssets

**3. 💼 Historique des Rachats (BODACC)**
- Tableau récapitulatif des transactions :
  - Date de parution (format DD/MM/YYYY)
  - Montant du rachat (format 125 000 €)
- Tri chronologique inversé (plus récent en premier)
- Parsing dates robuste : support ISO + DD/MM/YYYY
- Compteur de transactions
- Source : `business.bodacc[]` enrichi par frontend

**4. 🕐 Horaires d'Ouverture**
- Tableau jours/horaires traduit en français :
  - Traduction automatique EN → FR (Monday → Lundi, etc.)
  - Badge rouge "Fermé" pour jours de fermeture
  - Badge vert/rouge "Ouvert maintenant" / "Fermé actuellement"
- Détection intelligente fermetures (keywords "closed", "fermé")
- Source : `places.openingHours.weekdayDescriptions[]`

### 🛠️ Modifications Techniques

**Fichier modifié** :
- ✅ `server/adk/tools/report/generateHTMLTool.ts` (+280 lignes)

**Nouvelles fonctions** :
- `fetchCommuneDataWithTavily()` - Appel async Tavily Search API
- `generateCommuneSection()` - Section commune avec photo + carte + description
- `generatePhotosSection()` - Galerie photos filtrée avec annotations IA
- `generateBODACCTable()` - Tableau historique rachats formaté
- `generateOpeningHoursTable()` - Tableau horaires traduit FR

**CSS ajouté** :
- `.photo-grid` - Grille responsive pour photos
- `.photo-card`, `.photo-badge`, `.photo-annotation` - Composants photo
- `.commune-grid` - Layout photo + carte commune
- `.no-data` - Placeholder pour données manquantes
- Media queries responsive pour mobile

**Dépendances** :
- ✅ `axios` - Déjà présent, utilisé pour Tavily API
- ✅ `TAVILY_API_KEY` - Variable d'environnement (optionnelle, fallback graceful)

### 📋 Ordre des Sections dans le Rapport

1. Executive Summary (GO/NO-GO, scores clés)
2. Business Information (identité, localisation)
3. 🏘️ **Présentation de la Commune** ← NOUVEAU
4. 📸 **Photos du Commerce** ← NOUVEAU
5. 💼 **Historique BODACC** ← NOUVEAU
6. 🕐 **Horaires d'Ouverture** ← NOUVEAU
7. Scores Multi-Dimensionnels
8. Analyse des Risques
9. Analyse Stratégique

### 🎯 Gestion des Données Manquantes

Chaque section gère gracefully l'absence de données :
- **Commune** : Placeholder si Tavily timeout ou pas d'image
- **Photos** : Message "Photos non disponibles" si `places.photos` vide
- **BODACC** : Message "Aucun historique BODACC trouvé" si `business.bodacc` vide
- **Horaires** : Message "Horaires non disponibles" si `openingHours` null

### 🧪 Tests Validés

```bash
✅ Compilation TypeScript sans erreurs
✅ Intégration dans pipeline ADK
✅ Appel async Tavily avec timeout
✅ Formatage dates/montants français
✅ Traduction jours EN→FR
✅ Filtrage photos par qualité
✅ CSS responsive mobile/desktop
✅ Fallbacks données manquantes
```

### 📚 Documentation

- ✅ **CLAUDE.md** - Section "Détails Sections Enrichies du Rapport" ajoutée
- ✅ **README.md** - À mettre à jour (si applicable)

### 🎨 Améliorations Visuelles

- Design professionnel avec grilles CSS modernes
- Badges colorés pour statuts (ouvert/fermé, analysé/non analysé)
- Photos en lazy loading pour performance
- Icônes emoji pour navigation visuelle rapide

---

## [2025-12-26] - Correctifs Critiques ADK Pipeline (Matin)

### 🔧 Corrections Majeures

#### 1. Pattern de Parsing JSON dans les Tools
**Problème** : Les tools ne pouvaient pas accéder aux propriétés du state (`preparation.commune not found`, `preparation.normalizedAddress.zipCode not found`)

**Cause** : Les agents LlmAgent retournent des JSON strings. Le parsing automatique dans `server.js` arrive TROP TARD - après que l'ADK a propagé le state aux agents suivants.

**Solution** : Chaque tool qui lit depuis state doit maintenant parser les JSON strings avant d'accéder aux propriétés.

**Files modifiés** :
- ✅ `server/adk/tools/demographic/tavilySearchTool.ts`
- ✅ `server/adk/tools/demographic/getCommuneDataTool.ts`
- ✅ `server/adk/tools/places/searchPlacesTool.ts`
- ✅ `server/adk/tools/competitor/nearbySearchTool.ts`
- ✅ `server/adk/tools/photo/analyzePhotosTool.ts`
- ✅ `server/adk/tools/report/generateHTMLTool.ts`

**Pattern appliqué** :
```typescript
let preparation = toolContext?.state.get('preparation') as PreparationOutput | undefined | string;

if (typeof preparation === 'string') {
  try {
    preparation = JSON.parse(preparation) as PreparationOutput;
  } catch (e) {
    return { error: 'Failed to parse preparation state (invalid JSON)' };
  }
}
```

#### 2. Gemini Vision retournant du texte au lieu de JSON
**Problème** : `analyzePhotosTool` échouait avec `Unexpected token 'A', "Absolument"... is not valid JSON`

**Cause** : `responseSchema` seul ne suffit pas pour forcer Gemini à retourner du JSON strict. Gemini ignorait le schema et générait du texte conversationnel.

**Solution** : Ajout de `responseMimeType: "application/json"` dans `generationConfig`

**File modifié** :
- ✅ `server/adk/tools/photo/analyzePhotosTool.ts:182`

**Code ajouté** :
```typescript
generationConfig: {
  temperature: 0.3,
  responseMimeType: "application/json",  // ← Force JSON strict
  responseSchema: { /* ... */ }
}
```

### 📚 Documentation

#### Nouveaux fichiers
- ✅ **TROUBLESHOOTING.md** - Guide complet de résolution des problèmes ADK
- ✅ **README.md** - Documentation utilisateur et architecture complète

#### Mises à jour
- ✅ **CLAUDE.md** - Ajout de 2 nouvelles sections critiques :
  - "Pattern de Parsing dans les Tools (Critical)"
  - "Gemini Vision avec responseMimeType (PhotoAnalysis)"

### 🎯 Impact

#### Avant les corrections
- ❌ DemographicAgent bloquait (tools ne trouvaient pas les données)
- ❌ PhotoAnalysisAgent échouait (JSON parsing error)
- ❌ Pipeline incomplet, rapports non générés

#### Après les corrections
- ✅ Pipeline complet fonctionnel (10/10 agents)
- ✅ Tous les tools peuvent accéder aux données du state
- ✅ Analyse des photos opérationnelle
- ✅ Génération de rapports HTML réussie

### 🔍 Tests Validés

```bash
# DemographicAgent
✅ tavilySearch() - trouve preparation.commune
✅ getCommuneData() - trouve preparation.normalizedAddress.zipCode
✅ Analyse démographique complète

# PhotoAnalysisAgent
✅ analyzePhotos() - retourne JSON valide
✅ Analyse de 8 photos max
✅ Estimation travaux et budget

# ReportAgent
✅ generateHTML() - accède à tous les outputs (preparation, demographic, places, etc.)
✅ Génération rapport HTML complet
✅ Sauvegarde dans data/professional-reports/
```

### 📖 Ressources

- **Documentation technique** : [CLAUDE.md](./CLAUDE.md)
- **Troubleshooting** : [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- **Architecture** : [README.md](./README.md)

### 🎓 Leçons Apprises

1. **ADK State Propagation** : Le state est propagé AVANT le parsing dans server.js. Les tools doivent gérer le parsing eux-mêmes.

2. **Gemini responseMimeType** :
   - Compatible avec tools directs (FunctionTool)
   - Incompatible avec LlmAgent + function calling
   - Obligatoire pour forcer JSON strict avec responseSchema

3. **Pattern Defensive** : Toujours typer les retours state comme `Type | string` et parser si nécessaire.

### 🔜 Prochaines Améliorations

- [ ] Migrer vers un middleware ADK pour parsing centralisé
- [ ] Ajouter des tests unitaires pour chaque tool
- [ ] Implémenter retry logic pour appels API externes
- [ ] Améliorer le système de cache multi-niveaux

---

## [Earlier Versions]

### [2025-12-25] - Initial ADK Implementation
- Implémentation du pipeline ADK 10 agents
- Integration Google Places multi-result scoring
- Système de validation croisée
- Génération de rapports HTML

### [2025-12-20] - BODACC Integration
- Enrichissement automatique BODACC
- Validation Gemini des annonces légales
- Cache multi-niveaux (L1/L2/L3)

### [2025-12-15] - Initial Release
- Recherche OpenData API
- Interface React + Leaflet
- Panier et notes utilisateur

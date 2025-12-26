# SearchCommerce

**Plateforme d'analyse professionnelle de commerces français** combinant données publiques, intelligence artificielle et analyse de marché pour générer des rapports d'opportunité d'acquisition.

## 🎯 Fonctionnalités

- **Recherche multi-critères** : NAF, localisation, rayon géographique
- **Enrichissement BODACC** : Détection automatique de commerces en vente/cession
- **Analyse démographique** : Population, CSP, zone de chalandise
- **Google Places** : Photos, avis, horaires, scoring multi-résultats
- **Analyse visuelle IA** : État du local, estimation travaux (Gemini Vision)
- **Analyse concurrentielle** : POI proches, densité de marché
- **Validation croisée** : Détection de conflits entre sources de données
- **Scoring multi-dimensionnel** : Location, marché, opérationnel, financier
- **Recommandation GO/NO-GO** : Décision finale avec rationale
- **Rapport HTML professionnel** : Export complet de l'analyse

## 🏗️ Architecture

### Frontend (React + Vite)
- Interface utilisateur interactive (carte Leaflet, recherche, panier, notes)
- Services API pour OpenData, BODACC, Google Places
- Cache multi-niveaux (localStorage)

### Backend (Express + ADK)
- **API REST** : Endpoints de recherche, enrichissement, analyse
- **Pipeline ADK** : 10 agents spécialisés orchestrés séquentiellement
- **Google Agent Development Kit** : Framework d'agents IA
- **Services** : Identity, Places, Enrichment, Intelligence, Storage
- **Logging** : Winston avec rotation quotidienne

### Pipeline d'Analyse ADK (10 agents)

1. **PreparationAgent** - Normalisation adresse + extraction GPS
2. **DemographicAgent** - Analyse démographique + zone de chalandise
3. **PlacesAgent** - Enrichissement Google Places (photos, avis)
4. **PhotoAnalysisAgent** - Analyse Gemini Vision (état, travaux)
5. **CompetitorAgent** - Analyse concurrentielle POI
6. **ValidationAgent** - Validation croisée + détection conflits
7. **GapAnalysisAgent** - Scores multi-dimensionnels + risques
8. **ArbitratorAgent** - Résolution conflits détectés
9. **StrategicAgent** - Recommandation GO/NO-GO finale
10. **ReportAgent** - Génération rapport HTML

## 🚀 Installation

```bash
# Cloner le repo
git clone <url>
cd searchcommerce

# Installer les dépendances
npm install

# Configurer les clés API
cp .env.example .env
# Éditer .env avec vos clés
```

## ⚙️ Configuration (.env)

```bash
# API Gemini (obligatoire)
GEMINI_API_KEY=votre_clé_gemini

# API Google Places (obligatoire)
PLACE_API_KEY=votre_clé_places

# API Tavily (optionnel - enrichissement web)
TAVILY_API_KEY=votre_clé_tavily

# Serveur backend
PORT=3001
```

### Obtenir les clés API

- **Gemini API** : https://makersuite.google.com/app/apikey
- **Google Places API** : https://console.cloud.google.com/apis/credentials
- **Tavily API** (optionnel) : https://tavily.com/

## 🏃 Lancement

```bash
# Frontend seul (dev)
npm run dev

# Backend seul
npm run server

# Frontend + Backend simultanés
npm run dev:all
```

L'application sera accessible sur :
- Frontend : http://localhost:5173
- Backend : http://localhost:3001

## 📚 Documentation

- **[CLAUDE.md](./CLAUDE.md)** : Documentation technique complète du projet
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** : Guide de résolution des problèmes courants
- **[ADK Documentation](https://google.github.io/adk-docs/)** : Documentation officielle Google ADK

## 🛠️ Scripts Disponibles

```bash
# Développement
npm run dev          # Frontend Vite dev server
npm run server       # Backend Express
npm run dev:all      # Les deux simultanément

# Production
npm run build        # Build frontend
npm run preview      # Preview production build

# Qualité
npm run lint         # ESLint
```

## 📊 Données et Logs

### Stockage
- `data/cart.json` : Panier utilisateur
- `data/notes.json` : Notes utilisateur
- `data/professional-reports/` : Rapports HTML générés

### Logs
- `logs/combined-YYYY-MM-DD.log` : Logs complets
- `logs/error-YYYY-MM-DD.log` : Erreurs uniquement
- Rotation quotidienne, rétention 14 jours

## 🔧 Architecture Technique

### Technologies Frontend
- React 19
- Vite 7
- Leaflet (cartes)
- Tailwind CSS
- Lucide React (icônes)

### Technologies Backend
- Express 5
- Google ADK 0.2.1
- Google Generative AI (Gemini)
- Winston (logging)
- Axios (HTTP)
- Sharp (compression images)

### Technologies Partagées
- TypeScript 5.9
- Zod 4.2 (validation schemas)
- Node 18+

## 🎨 Patterns Clés

### ADK State Management
Les agents communiquent via un state partagé. Chaque agent :
1. Lit depuis `state.business`, `state.preparation`, etc.
2. Appelle ses tools via function calling
3. Écrit son output dans `state.{outputKey}`

**Important** : Les tools doivent parser les JSON strings (voir TROUBLESHOOTING.md).

### Google Places Multi-Result Scoring
Système de scoring intelligent (0-100) basé sur :
- Numéro de rue (40 pts)
- Code postal (30 pts)
- Distance GPS (20 pts)
- Nom de rue (10 pts)

Seuil d'acceptation : ≥80%

### Caching Stratégique
- **L1** : Résultats récents (30 min)
- **L2** : Résultats valides (24h)
- **L3** : Archive longue durée (7 jours)

## 🐛 Troubleshooting

Consultez [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) pour :
- Tools ne trouvant pas les propriétés du state
- Gemini Vision retournant du texte au lieu de JSON
- ADK ne propageant pas le state
- Timeouts et freezes du pipeline
- Erreurs 400 de l'API Gemini

## 📝 Logs Utiles

```bash
# Identifier quel agent bloque
grep "AGENT STARTED" logs/combined-*.log

# Voir les appels d'outils
grep "TOOL CALLED" logs/combined-*.log

# Vérifier le parsing JSON
grep "JSON string auto-parsed" logs/combined-*.log

# Détecter les erreurs
grep -i "error" logs/error-*.log
```

## 🤝 Contribution

Ce projet utilise des patterns ADK avancés. Avant de modifier :
1. Lire [CLAUDE.md](./CLAUDE.md) - Architecture complète
2. Lire [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Problèmes courants
3. Tester avec `npm run dev:all`
4. Vérifier les logs dans `logs/`

## 📜 License

MIT

## 🙏 Remerciements

- **Google ADK** : Framework d'agents IA
- **Gemini API** : Intelligence artificielle multimodale
- **OpenData France** : Données entreprises publiques
- **BODACC** : Annonces légales commerciales

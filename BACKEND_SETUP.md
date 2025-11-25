# 🔐 Solution Sécurisée - Backend API pour Gemini

## ✅ Solution Finale Fonctionnelle

L'application utilise une architecture **client-serveur** pour sécuriser la clé API Gemini et filtrer intelligemment les enregistrements BODACC.

```
Frontend (React/Vite)  →  Backend (Express.js)  →  Gemini API (2.0-flash-exp)
     Port 5173              Port 3001              Google Cloud
```

---

## 🎯 Fonctionnalités

### Filtrage Intelligent BODACC
- ✅ **Validation contextuelle** : Gemini analyse chaque enregistrement selon l'activité recherchée
- ✅ **Filtrage automatique** : Les commerces non pertinents sont exclus (ex: pharmacie lors d'une recherche tabac)
- ✅ **Extraction enrichie** : Commerce, activité, montant, description complète

### Exemple de Filtrage
Pour une recherche **"Tabac / Presse"** :
- ✅ **305 000 €** - Débit de tabac → **AFFICHÉ**
- ✅ **285 000 €** - Tabac presse → **AFFICHÉ**
- ❌ **975 000 €** - Pharmacie → **FILTRÉ** ✨
- ✅ **95 000 €** - Gérance tabac → **AFFICHÉ**
- ✅ **105 000 €** - Papeterie tabac → **AFFICHÉ**

---

## 🚀 Démarrage Rapide

### Prérequis
1. Clé API Gemini configurée dans `.env`
2. Node.js installé

### Lancement

**Terminal 1 - Backend :**
```bash
node server.js
```

**Terminal 2 - Frontend :**
```bash
npm run dev
```

Puis ouvrez `http://localhost:5173`

---

## ⚙️ Configuration

### 1. Fichier `.env`

Créez le fichier `.env` à la racine :

```env
# Clé API Gemini (SÉCURISÉE - côté serveur uniquement)
GEMINI_API_KEY=votre_clé_api_ici

# Port du serveur backend (optionnel, défaut: 3001)
PORT=3001
```

### 2. Obtenir une clé API Gemini

1. Rendez-vous sur [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Connectez-vous avec votre compte Google
3. Créez une nouvelle clé API
4. Copiez la clé dans le fichier `.env`

---

## 🏗️ Architecture Technique

### Backend (`server.js`)
- **Framework** : Express.js
- **Modèle Gemini** : `gemini-2.0-flash-exp` (v1beta)
- **Endpoint principal** : `POST /api/validate-bodacc`
- **Sécurité** : Clé API côté serveur, CORS configuré

### Frontend (`src/services/geminiService.js`)
- Appelle le backend au lieu de Gemini directement
- Aucune clé API exposée côté client
- Gestion d'erreur avec fallback

### Service BODACC (`src/services/bodaccService.js`)
- Extraction enrichie : commerce, activité, montant
- Mapping NAF code → label d'activité
- Validation asynchrone avec Gemini

---

## 📡 API Endpoints

### POST `/api/validate-bodacc`

Valide si un enregistrement BODACC correspond à l'activité recherchée.

**Request:**
```json
{
  "description": "Commerce: PHARMACIE DU BARRIOT. Activité: Pharmacie...",
  "activityLabel": "Tabac / Presse (Journaux, Papeterie)"
}
```

**Response:**
```json
{
  "isValid": false
}
```

### GET `/api/health`

Vérifie que le serveur fonctionne.

**Response:**
```json
{
  "status": "ok",
  "message": "Backend API is running"
}
```

---

## 🔍 Logs et Debug

### Logs Backend
Le serveur affiche des logs détaillés pour chaque validation :

```
🔍 Validating record for activity: "Tabac / Presse (Journaux, Papeterie)"
📄 Full description (first 300 chars):
Commerce: PHARMACIE DU BARRIOT. Activité: Pharmacie. Etablissement principal acquis...
✅ Gemini response: "NON" → isValid: false
```

### Logs Frontend
La console du navigateur affiche :
```
🔍 Validating record for activity: "Tabac / Presse (Journaux, Papeterie)"
📄 Description preview: Commerce: LE DRUGSTORE DU BARRIOT...
✅ Backend response: isValid = true
❌ Filtered out record: 975000€ (2017-07-23)
```

---

## 🛡️ Sécurité

### ✅ Implémenté

- ✅ **Clé API sécurisée** : Stockée uniquement côté serveur
- ✅ **Fichier `.env` protégé** : Dans `.gitignore`, jamais commité
- ✅ **CORS configuré** : Accepte uniquement votre frontend
- ✅ **Validation des paramètres** : Vérification des entrées
- ✅ **Gestion d'erreur** : Fallback en cas d'échec API

### 🔜 Améliorations Futures

- Rate limiting par IP (ex: 10 requêtes/minute)
- Cache des résultats (Redis)
- Authentification des requêtes frontend (JWT)
- Monitoring avec Winston/Pino
- Métriques Prometheus

---

## 🐛 Dépannage

### Le backend ne démarre pas

**Problème** : Port 3001 déjà utilisé

**Solution** :
```bash
# Trouver le processus
netstat -ano | findstr :3001

# Tuer le processus (remplacer PID)
taskkill /F /PID <PID>
```

### Erreur "GEMINI_API_KEY not configured"

**Vérifiez** :
1. Le fichier `.env` existe à la racine
2. La variable `GEMINI_API_KEY` est définie
3. Vous avez redémarré le serveur après modification

### Erreur 404 "models/gemini-X not found"

**Solution** : Le modèle utilisé est `gemini-2.0-flash-exp` (ligne 17 de `server.js`)

Si vous voyez cette erreur, vérifiez que vous utilisez le bon nom de modèle.

### Le frontend ne peut pas contacter le backend

**Vérifiez** :
1. Le backend est bien démarré (`node server.js`)
2. L'URL du backend est `http://localhost:3001` dans `geminiService.js`
3. CORS est bien configuré dans `server.js`

---

## 📊 Performance

### Temps de réponse
- **Validation Gemini** : ~500-1000ms par enregistrement
- **Filtrage complet** : ~2-5 secondes pour 5 enregistrements

### Optimisations possibles
- **Cache** : Stocker les résultats de validation
- **Batch processing** : Valider plusieurs enregistrements en une seule requête
- **Modèle plus rapide** : Utiliser `gemini-1.5-flash` si disponible

---

## 📝 Notes Importantes

### Modèle Gemini
- **Modèle utilisé** : `gemini-2.0-flash-exp`
- **API version** : `v1beta`
- **Température** : 0.1 (réponses déterministes)
- **Max tokens** : 10 (réponse "OUI" ou "NON")

### Comportement par défaut
- **Sans clé API** : Accepte tous les enregistrements
- **En cas d'erreur** : Accepte l'enregistrement (fail-safe)
- **Sans activité** : Accepte l'enregistrement

---

## 🎓 Ressources

- [Documentation Gemini API](https://ai.google.dev/docs)
- [Express.js Documentation](https://expressjs.com/)
- [BODACC API](https://bodacc-datadila.opendatasoft.com/)

---

## ✅ Checklist de Déploiement

Avant de déployer en production :

- [ ] Clé API Gemini configurée
- [ ] Variables d'environnement sécurisées
- [ ] CORS configuré pour votre domaine
- [ ] Rate limiting implémenté
- [ ] Logs de production configurés
- [ ] Monitoring en place
- [ ] Tests de charge effectués
- [ ] Documentation à jour

---

**🎉 Félicitations ! Votre système de validation BODACC est maintenant opérationnel et sécurisé !**

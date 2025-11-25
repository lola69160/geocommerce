# Configuration de l'API Gemini pour la validation BODACC

## Pourquoi Gemini ?

L'API Google Gemini est utilisée pour valider les enregistrements BODACC et filtrer les commerces non pertinents. 

Lorsqu'on recherche l'historique des rachats d'un commerce à une adresse donnée, les données BODACC peuvent contenir des informations sur d'autres types de commerces qui étaient présents à la même adresse.

**Validation contextuelle** : Le modèle LLM Gemini 1.5 Flash analyse le texte de chaque annonce en fonction de l'activité recherchée (tabac/presse, boulangerie, restaurant, etc.) pour déterminer si elle correspond bien au type de commerce que vous cherchez.

Par exemple :
- Si vous cherchez un **tabac/presse**, les annonces de pharmacies ou boulangeries seront filtrées
- Si vous cherchez une **boulangerie**, les annonces de restaurants ou tabacs seront filtrées
- Le système s'adapte automatiquement au code NAF de l'activité recherchée

## Configuration

1. **Obtenir une clé API Gemini** :
   - Rendez-vous sur [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Connectez-vous avec votre compte Google
   - Créez une nouvelle clé API
   - Copiez la clé générée

2. **Configurer la clé dans le projet** :
   - Ouvrez le fichier `.env` à la racine du projet
   - Remplacez `your_gemini_api_key_here` par votre clé API :
     ```
     VITE_GEMINI_API_KEY=AIzaSy...votre_clé_ici
     ```

3. **Redémarrer le serveur de développement** :
   ```bash
   npm run dev
   ```

## Fonctionnement

- Si la clé API n'est pas configurée, le système acceptera tous les enregistrements BODACC sans filtrage
- Avec la clé API configurée, chaque enregistrement est analysé par Gemini avant d'être affiché
- Le modèle utilisé est `gemini-1.5-flash` (le plus petit et économique)
- Le filtrage se fait de manière asynchrone lors de la récupération des données

## Coût

L'API Gemini 1.5 Flash offre un quota gratuit généreux :
- 15 requêtes par minute
- 1 million de tokens par jour (gratuit)

Pour un usage normal de l'application, cela devrait être largement suffisant.

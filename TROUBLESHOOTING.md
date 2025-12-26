# Troubleshooting ADK Pipeline

Ce document recense les problèmes courants rencontrés avec le pipeline ADK et leurs solutions.

## 🔴 Problème : Tools ne trouvent pas les propriétés du state

### Symptômes
```
preparation.commune not found in state
preparation.normalizedAddress.zipCode not found in state
```

### Cause
Les agents LlmAgent retournent des **JSON strings** au lieu d'objets JavaScript. L'ADK stocke ces strings dans le state. Le parsing automatique dans `server.js` arrive TROP TARD - après que l'ADK a déjà propagé le state aux agents suivants.

### Solution
Chaque tool qui lit depuis state DOIT parser les JSON strings :

```typescript
execute: async (params, toolContext?: ToolContext) => {
  let preparation = toolContext?.state.get('preparation') as PreparationOutput | undefined | string;

  // Parser JSON string si nécessaire
  if (typeof preparation === 'string') {
    try {
      preparation = JSON.parse(preparation) as PreparationOutput;
    } catch (e) {
      return { error: 'Failed to parse preparation state (invalid JSON)' };
    }
  }

  // Maintenant on peut accéder aux propriétés
  if (!preparation?.normalizedAddress?.zipCode) { ... }
}
```

### Tools déjà corrigés
- ✅ `tavilySearchTool.ts`
- ✅ `getCommuneDataTool.ts`
- ✅ `searchPlacesTool.ts`
- ✅ `nearbySearchTool.ts`
- ✅ `analyzePhotosTool.ts`
- ✅ `generateHTMLTool.ts`

---

## 🔴 Problème : Gemini Vision retourne du texte au lieu de JSON

### Symptômes
```
Photo analysis failed: Unexpected token 'A', "Absolument"... is not valid JSON
```

### Cause
`responseSchema` seul ne suffit pas pour forcer Gemini à retourner du JSON strict. Gemini peut ignorer le schema et générer du texte conversationnel.

### Solution
Ajouter `responseMimeType: "application/json"` dans `generationConfig` :

```typescript
const result = await model.generateContent({
  contents: [{ role: "user", parts: [...imageParts, { text: prompt }] }],
  generationConfig: {
    temperature: 0.3,
    responseMimeType: "application/json",  // ← Force JSON strict
    responseSchema: {
      type: "object",
      properties: { /* ... */ }
    }
  }
});
```

### Où l'utiliser ?
- ✅ **FunctionTool** (appels directs `model.generateContent()`)
- ❌ **LlmAgent** (incompatible avec function calling)

**Exemple corrigé** : `analyzePhotosTool.ts:182`

---

## 🔴 Problème : Agent ne trouve pas les données business

### Symptômes
```
Business data not found in state
business.siege not found
```

### Cause
Le state initial n'a pas été correctement passé via `stateDelta` dans `runner.runAsync()`.

### Solution
Vérifier que le state initial contient bien les données business :

```javascript
const initialState = {
  business: {
    siret: '...',
    siege: {
      adresse: '...',
      code_postal: '...',
      // ...
    }
  },
  metadata: { /* ... */ }
};

for await (const event of runner.runAsync({
  userId,
  sessionId,
  newMessage,
  stateDelta: initialState  // ← State initial
})) { ... }
```

---

## 🔴 Problème : ADK ne propage pas le state entre agents

### Symptômes
```
state.preparation is undefined
Demographic agent can't access preparation data
```

### Cause
L'agent précédent n'a pas correctement défini son `outputKey`.

### Solution
Vérifier que chaque agent définit bien son `outputKey` :

```typescript
export class PreparationAgent extends LlmAgent {
  constructor() {
    super({
      name: 'preparation',
      outputKey: 'preparation' as keyof AgentState,  // ← OBLIGATOIRE
      // ...
    });
  }
}
```

---

## 🔴 Problème : Gemini retourne une erreur 400

### Symptômes
```
GoogleGenerativeAIError: [400 Bad Request] Invalid JSON schema
```

### Causes possibles
1. **Schema Zod mal converti** - Utiliser `zToGen()` pour convertir Zod → JSON Schema
2. **$schema présent** - L'API Gemini rejette la propriété `$schema`
3. **Références non résolues** - Gemini n'aime pas les `$ref`

### Solution
Utiliser le helper `zToGen()` qui nettoie automatiquement :

```typescript
import { zToGen } from '../../utils/schemaHelper.js';

const MySchema = z.object({
  field: z.string()
});

const tool = new FunctionTool({
  parameters: zToGen(MySchema),  // ← Convertit et nettoie
  // ...
});
```

---

## 🔴 Problème : Runner timeout ou freeze

### Symptômes
```
Pipeline stuck at demographic agent
No logs after "🚀 AGENT STARTED: demographic"
```

### Causes possibles
1. **Appel API externe timeout** - API Géo, Tavily, Google Places
2. **Gemini API rate limit** - Trop de requêtes simultanées
3. **Boucle infinie** - Agent reappelle le même tool indéfiniment

### Solution
1. Vérifier les logs de tools pour identifier où ça bloque
2. Augmenter les timeouts des appels axios :
```typescript
const response = await axios.get(url, {
  timeout: 10000  // 10 secondes
});
```

3. Vérifier les API keys :
```bash
GEMINI_API_KEY=...
PLACE_API_KEY=...
TAVILY_API_KEY=...  # Optionnel
```

---

## 📝 Logs utiles pour debug

### Identifier quel agent bloque
```bash
grep "AGENT STARTED" logs/combined-YYYY-MM-DD.log
```

### Voir les appels d'outils
```bash
grep "TOOL CALLED" logs/combined-YYYY-MM-DD.log
```

### Vérifier le parsing JSON
```bash
grep "JSON string auto-parsed" logs/combined-YYYY-MM-DD.log
```

### Détecter les erreurs
```bash
grep -i "error" logs/error-YYYY-MM-DD.log
```

---

## 🛠️ Checklist avant de créer un nouveau tool

- [ ] Lire depuis `toolContext.state.get()` avec parsing JSON si nécessaire
- [ ] Définir un schema Zod pour les paramètres
- [ ] Utiliser `zToGen()` pour convertir le schema
- [ ] Gérer les erreurs avec try/catch
- [ ] Retourner un objet avec `error: true` en cas d'échec
- [ ] Logger les erreurs avec `console.error()` pour traçabilité
- [ ] Documenter dans les commentaires : WHERE, WHAT, HOW

---

## 📚 Ressources

- **Documentation ADK** : https://google.github.io/adk-docs/
- **Gemini API Models** : https://ai.google.dev/gemini-api/docs/models
- **CLAUDE.md** : Documentation complète du projet
- **Logs** : `logs/combined-YYYY-MM-DD.log` et `logs/error-YYYY-MM-DD.log`

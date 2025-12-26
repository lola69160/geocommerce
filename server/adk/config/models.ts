/**
 * Model Configuration - Gemini models per agent
 *
 * Utilisation du nouveau modèle Gemini 2.5 Flash Lite (disponible via API v1beta)
 * https://ai.google.dev/gemini-api/docs/models?hl=fr#gemini-2.5-flash-lite_1
 *
 * Capacités Gemini 2.5 Flash Lite:
 * - Texte, Image, Audio, Vidéo (multimodal complet)
 * - 1M tokens de contexte
 * - Gratuit (100 RPM)
 * - Optimisé pour vitesse et coût
 */

export const MODEL_CONFIG = {
  // Utilisation de Gemini 2.0 Flash Exp pour meilleure stabilité avec Function Calling
  // Plus robuste que 2.5 Lite pour les appels d'outils complexes
  preparation: 'gemini-3-flash-preview',
  demographic: 'gemini-3-flash-preview',
  places: 'gemini-3-flash-preview',
  competitor: 'gemini-3-flash-preview',
  gap: 'gemini-3-flash-preview',
  report: 'gemini-3-flash-preview',

  // Agent vision - 2.0 Flash Exp supporte aussi les images
  photo: 'gemini-3-flash-preview',

  // Agents raisonnement - 2.0 Flash Exp pour stabilité
  validation: 'gemini-3-flash-preview',
  arbitrator: 'gemini-3-flash-preview',
  strategic: 'gemini-3-flash-preview'
} as const;

export type AgentModel = typeof MODEL_CONFIG;
export type AgentName = keyof AgentModel;

/**
 * Configuration générale des modèles
 */
export const MODEL_DEFAULTS = {
  temperature: 0.4,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192
  // Note: responseMimeType retiré car incompatible avec Function Calling (Tools)
  // Les agents demandent déjà du JSON dans leurs instructions système
};

/**
 * Surcharges spécifiques par agent
 */
export const MODEL_OVERRIDES: Partial<Record<AgentName, Partial<typeof MODEL_DEFAULTS>>> = {
  // Photo analysis: plus créatif pour descriptions
  photo: {
    temperature: 0.6
  },

  // Strategic: raisonnement approfondi
  strategic: {
    maxOutputTokens: 12288,
    temperature: 0.5
  },

  // Validation/Arbitration: factuel et précis
  validation: {
    temperature: 0.2
  },
  arbitrator: {
    temperature: 0.3
  }
};

/**
 * Récupère la configuration complète pour un agent
 */
export function getModelConfig(agentName: AgentName) {
  return {
    name: MODEL_CONFIG[agentName],
    ...MODEL_DEFAULTS,
    ...(MODEL_OVERRIDES[agentName] || {})
  };
}

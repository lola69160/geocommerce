/**
 * Config Index - Exports all configuration
 */

export * from './models';
export * from './prompts';

/**
 * Environment variables configuration
 */
export const ENV_CONFIG = {
  // Existing API keys (already configured)
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  PLACE_API_KEY: process.env.PLACE_API_KEY || '',
  TAVILY_API_KEY: process.env.TAVILY_API_KEY || '',
  INPI_KEY: process.env.INPI || '',

  // ADK Config (new)
  ADK_CACHE_ENABLED: process.env.ADK_CACHE_ENABLED === 'true',
  ADK_CACHE_TTL: parseInt(process.env.ADK_CACHE_TTL || '1800'),
  ADK_MAX_RETRIES: parseInt(process.env.ADK_MAX_RETRIES || '3'),
  ADK_TIMEOUT: parseInt(process.env.ADK_TIMEOUT || '45000'),

  // Validation/Arbitration Config (new)
  VALIDATION_ENABLED: process.env.VALIDATION_ENABLED !== 'false', // Default true
  ARBITRATION_ENABLED: process.env.ARBITRATION_ENABLED !== 'false', // Default true
  MAX_CLARIFICATIONS: parseInt(process.env.MAX_CLARIFICATIONS || '3'),
  CONFLICT_SEVERITY_THRESHOLD: (process.env.CONFLICT_SEVERITY_THRESHOLD || 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
} as const;

/**
 * Validates environment configuration
 */
export function validateEnvConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!ENV_CONFIG.GEMINI_API_KEY) {
    errors.push('GEMINI_API_KEY is required');
  }

  if (!ENV_CONFIG.PLACE_API_KEY) {
    errors.push('PLACE_API_KEY is required');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

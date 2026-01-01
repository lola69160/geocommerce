import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';

/**
 * validateTabacMethodeTool
 *
 * CRITICAL TOOL for ValorisationAgent to preserve methodeHybride data.
 *
 * **Problem this solves:**
 * - ValorisationAgent uses outputKey: 'valorisation' which OVERWRITES state.valorisation completely
 * - If the LLM doesn't copy ALL fields from calculateTabacValuation output → DATA LOST
 * - Same pattern as ComptableAgent SIG preservation issue (CLAUDE.md:448-538)
 *
 * **How it works:**
 * 1. After calling calculateTabacValuation(), the LLM receives a complete methodeHybride object
 * 2. LLM calls THIS tool with that object
 * 3. Tool returns it with a CRITICAL INSTRUCTION warning
 * 4. LLM MUST copy the returned object into final JSON output
 *
 * **Usage in ValorisationAgent instructions:**
 * ```
 * ÉTAPE 2: Si isTabac === true:
 *   a) Appelle calculateTabacValuation()
 *   b) Appelle validateTabacMethode() avec methodeHybride retourné
 *   c) COPIE L'OBJET dans ton JSON final
 * ```
 *
 * **Created:** 2026-01-01 (Fix for Tabac NAF 47.26 hybrid method missing)
 */
export const validateTabacMethodeTool = new FunctionTool({
  name: 'validateTabacMethode',
  description: 'CRITICAL: Returns the complete methodeHybride object from calculateTabacValuation for preservation in agent output. MUST be called for Tabac commerce to ensure hybrid valuation method appears in final report.',
  parameters: zToGen(z.object({
    methodeHybride: z.any().describe('The methodeHybride object returned by calculateTabacValuation')
  })),
  execute: async (params) => {
    if (!params.methodeHybride) {
      console.error('[validateTabacMethode] ❌ ERREUR: methodeHybride object is missing!');
      throw new Error('methodeHybride object required but not provided');
    }

    console.log('[validateTabacMethode] ✅ Validation object returned - LLM MUST copy this into final JSON');
    console.log('[validateTabacMethode] 📋 Fields to preserve:', Object.keys(params.methodeHybride));

    return {
      methodeHybride: params.methodeHybride,
      INSTRUCTION_CRITIQUE: '⚠️⚠️⚠️ COPIER CET OBJET INTÉGRALEMENT dans ton JSON final sous la clé "methodeHybride" - NE PAS FILTRER, NE PAS MODIFIER, NE PAS OMETTRE'
    };
  }
});

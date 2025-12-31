import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';
import { isTabacCommerce } from '../../config/tabacValuationCoefficients';

/**
 * Validate Sector Type Tool
 *
 * ⚠️ OUTIL OBLIGATOIRE - DOIT ÊTRE APPELÉ EN PREMIER PAR VALORISATIONAGENT
 *
 * Valide le type de secteur et détermine la méthode de valorisation à utiliser.
 * Cet outil lit UNIQUEMENT state.businessInfo.secteurActivite (choix utilisateur).
 *
 * Retourne:
 * - isTabac: true/false
 * - sectorCode: code du secteur (ex: '47.26')
 * - sectorLabel: label du secteur (ex: 'Tabac / Presse / Loto')
 * - recommendedMethod: 'HYBRIDE' ou 'CLASSIQUE'
 *
 * Ce tool garantit que la détection est déterministe et ne dépend PAS du LLM.
 */

const ValidateSectorTypeInputSchema = z.object({});

const ValidateSectorTypeOutputSchema = z.object({
  isTabac: z.boolean().describe('true si secteur Tabac/Presse détecté'),
  sectorCode: z.string().describe('Code secteur du formulaire (ex: 47.26)'),
  sectorLabel: z.string().optional().describe('Label du secteur (ex: Tabac / Presse / Loto)'),
  recommendedMethod: z.enum(['HYBRIDE', 'CLASSIQUE']).describe('Méthode de valorisation recommandée'),
  reason: z.string().describe('Raison de la recommandation')
});

export const validateSectorTypeTool = new FunctionTool({
  name: 'validateSectorType',
  description: '⚠️ OUTIL OBLIGATOIRE - Valide le type de secteur et détermine la méthode de valorisation. DOIT être appelé EN PREMIER.',
  parameters: zToGen(ValidateSectorTypeInputSchema),

  execute: async (_params, toolContext?: ToolContext) => {
    console.log('[validateSectorType] 🔍 Validation du type de secteur...');

    try {
      // Lire businessInfo depuis state
      let businessInfo = toolContext?.state.get('businessInfo') as any;

      if (typeof businessInfo === 'string') {
        try {
          businessInfo = JSON.parse(businessInfo);
        } catch (e) {
          businessInfo = null;
        }
      }

      if (!businessInfo) {
        return {
          isTabac: false,
          sectorCode: 'UNKNOWN',
          sectorLabel: undefined,
          recommendedMethod: 'CLASSIQUE',
          reason: 'businessInfo manquant dans state'
        };
      }

      const sectorCode = businessInfo.secteurActivite || '';
      const sectorLabel = businessInfo.secteurActiviteLabel || '';

      console.log(`[validateSectorType] 📊 Secteur du formulaire:`);
      console.log(`   - Code: ${sectorCode}`);
      console.log(`   - Label: ${sectorLabel}`);

      // Validation déterministe via isTabacCommerce()
      const isTabac = isTabacCommerce(sectorCode);

      const result = {
        isTabac,
        sectorCode,
        sectorLabel: sectorLabel || undefined,
        recommendedMethod: isTabac ? 'HYBRIDE' as const : 'CLASSIQUE' as const,
        reason: isTabac
          ? `Secteur Tabac/Presse détecté (${sectorCode}). Méthode Hybride OBLIGATOIRE (Bloc Réglementé + Bloc Commercial).`
          : `Secteur standard (${sectorCode}). Utiliser les 3 méthodes classiques (EBE, CA, Patrimoniale).`
      };

      if (isTabac) {
        console.log(`[validateSectorType] ✅ TABAC DÉTECTÉ → MÉTHODE HYBRIDE OBLIGATOIRE`);
        console.log(`[validateSectorType]    Secteur: ${sectorCode} - ${sectorLabel}`);
      } else {
        console.log(`[validateSectorType] ℹ️  Secteur standard → Méthodes classiques`);
      }

      return result;

    } catch (error: any) {
      console.error(`[validateSectorType] ❌ Erreur:`, error.message);
      return {
        isTabac: false,
        sectorCode: 'ERROR',
        sectorLabel: undefined,
        recommendedMethod: 'CLASSIQUE',
        reason: `Erreur lors de la validation: ${error.message}`
      };
    }
  }
});

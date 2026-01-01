import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';
import { isTabacCommerce } from '../../config/tabacValuationCoefficients';

/**
 * Validate Tabac Valorisation Output Tool
 *
 * DIAGNOSTIC TOOL - Vérifie que la méthode hybride est présente pour les commerces Tabac.
 * Ce tool est appelé au début de FinancialValidationAgent pour détecter si ValorisationAgent
 * a correctement généré le champ methodeHybride.
 *
 * Logs détaillés pour diagnostiquer les problèmes de préservation des données.
 */

const ValidateTabacValorisationOutputInputSchema = z.object({});

const ValidateTabacValorisationOutputOutputSchema = z.object({
  isTabacSector: z.boolean().describe('true si secteur Tabac/Presse détecté'),
  methodeHybridePresent: z.boolean().describe('true si methodeHybride présent dans valorisation'),
  validationStatus: z.enum(['OK', 'WARNING', 'ERROR']).describe('Statut de validation'),
  message: z.string().describe('Message de validation')
});

export const validateTabacValorisationOutputTool = new FunctionTool({
  name: 'validateTabacValorisationOutput',
  description: 'DIAGNOSTIC: Vérifie que la valorisation Tabac hybride est correctement présente dans le state. À appeler en premier pour diagnostiquer les problèmes.',
  parameters: zToGen(ValidateTabacValorisationOutputInputSchema),

  execute: async (_params, toolContext?: ToolContext) => {
    console.log('[validateTabacValorisationOutput] 🔍 DIAGNOSTIC - Vérification valorisation Tabac...');

    try {
      // Lire businessInfo et valorisation depuis state
      let businessInfo = toolContext?.state.get('businessInfo') as any;
      let valorisation = toolContext?.state.get('valorisation') as any;

      if (typeof businessInfo === 'string') {
        try {
          businessInfo = JSON.parse(businessInfo);
        } catch (e) {
          businessInfo = null;
        }
      }

      if (typeof valorisation === 'string') {
        try {
          valorisation = JSON.parse(valorisation);
        } catch (e) {
          valorisation = null;
        }
      }

      const sectorCode = businessInfo?.secteurActivite || '';
      const isTabacSector = isTabacCommerce(sectorCode);
      const methodeHybridePresent = !!valorisation?.methodeHybride;

      console.log('[validateTabacValorisationOutput] 📊 Diagnostic:');
      console.log(`   - secteurActivite: ${sectorCode}`);
      console.log(`   - isTabac détecté: ${isTabacSector}`);
      console.log(`   - methodeHybride présente: ${methodeHybridePresent}`);

      // Validation conditionnelle
      if (isTabacSector) {
        if (methodeHybridePresent) {
          console.log('[validateTabacValorisationOutput] ✅ OK - methodeHybride présente pour secteur Tabac');
          return {
            isTabacSector: true,
            methodeHybridePresent: true,
            validationStatus: 'OK',
            message: `Commerce Tabac (${sectorCode}) - Méthode hybride correctement présente dans valorisation`
          };
        } else {
          console.error('[validateTabacValorisationOutput] ❌ ERREUR CRITIQUE - methodeHybride MANQUANTE pour secteur Tabac !');
          console.error('[validateTabacValorisationOutput]    Le LLM de ValorisationAgent n\'a pas suivi les instructions de préservation.');
          console.error('[validateTabacValorisationOutput]    État reçu:', Object.keys(valorisation || {}));
          console.error('[validateTabacValorisationOutput]    Attendu: champ "methodeHybride" avec blocReglemente, blocCommercial, valorisationTotale');
          return {
            isTabacSector: true,
            methodeHybridePresent: false,
            validationStatus: 'ERROR',
            message: `❌ ERREUR: Commerce Tabac (${sectorCode}) mais methodeHybride MANQUANTE. Le rapport affichera les méthodes classiques (INCORRECT).`
          };
        }
      } else {
        console.log('[validateTabacValorisationOutput] ℹ️  Secteur standard (non-Tabac) - méthode hybride non requise');
        return {
          isTabacSector: false,
          methodeHybridePresent: methodeHybridePresent,
          validationStatus: 'OK',
          message: `Commerce standard (${sectorCode}) - Méthodes classiques attendues`
        };
      }

    } catch (error: any) {
      console.error(`[validateTabacValorisationOutput] ❌ Erreur:`, error.message);
      return {
        isTabacSector: false,
        methodeHybridePresent: false,
        validationStatus: 'ERROR',
        message: `Erreur lors de la validation: ${error.message}`
      };
    }
  }
});

import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';

/**
 * Estimate Travaux Tool
 *
 * Estime les travaux nécessaires (obligatoires et recommandés).
 * Utilise l'analyse photos (si disponible) et règles métier.
 *
 * Catégories de travaux:
 * 1. OBLIGATOIRES: Conformité ERP, accessibilité PMR, sécurité
 * 2. RECOMMANDÉS: Rafraîchissement, modernisation, amélioration
 *
 * Estimation basée sur:
 * - État général du local (si analyse photos disponible)
 * - Surface (coût au m²)
 * - Type de travaux standards
 */

const EstimateTravauxInputSchema = z.object({
  surface_m2: z.number().optional().describe('Surface du local (sera lu depuis bail si non fourni)'),
  etat_declare: z.enum(['bon', 'moyen', 'mauvais']).optional().describe('État déclaré par le vendeur'),
  travaux_custom: z.array(z.object({
    description: z.string(),
    estimation_basse: z.number(),
    estimation_haute: z.number(),
    urgence: z.enum(['immediat', '6_mois', '12_mois']),
    type: z.enum(['obligatoire', 'recommande'])
  })).optional().describe('Travaux personnalisés identifiés')
});

const EstimateTravauxOutputSchema = z.object({
  travaux: z.object({
    etat_general: z.enum(['bon', 'moyen', 'mauvais', 'non_evalue']),
    conformite_erp: z.enum(['conforme', 'a_verifier', 'non_conforme', 'inconnu']),
    accessibilite_pmr: z.boolean().nullable(),
    travaux_obligatoires: z.array(z.object({
      description: z.string(),
      estimation_basse: z.number(),
      estimation_haute: z.number(),
      urgence: z.enum(['immediat', '6_mois', '12_mois'])
    })),
    travaux_recommandes: z.array(z.object({
      description: z.string(),
      estimation_basse: z.number(),
      estimation_haute: z.number(),
      impact: z.string()
    })),
    budget_total: z.object({
      obligatoire_bas: z.number(),
      obligatoire_haut: z.number(),
      recommande_bas: z.number(),
      recommande_haut: z.number()
    })
  }),
  error: z.string().optional()
});

export const estimateTravauxTool = new FunctionTool({
  name: 'estimateTravaux',
  description: 'Estime les travaux obligatoires et recommandés (conformité ERP, PMR, rafraîchissement). Utilise analyse photos si disponible. Retourne { travaux: { etat_general, travaux_obligatoires[], travaux_recommandes[], budget_total } }',
  parameters: zToGen(EstimateTravauxInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    try {
      // Lire immobilier depuis state (pour surface)
      let immobilier = toolContext?.state.get('immobilier') as any;

      // Parser JSON string si nécessaire
      if (typeof immobilier === 'string') {
        try {
          immobilier = JSON.parse(immobilier);
        } catch (e) {
          // Pas critique
        }
      }

      // Lire photo depuis state (si analyse photos disponible)
      let photo = toolContext?.state.get('photo') as any;

      if (typeof photo === 'string') {
        try {
          photo = JSON.parse(photo);
        } catch (e) {
          // Pas critique
        }
      }

      // ÉTAPE 1 : Déterminer l'état général
      let etatGeneral: 'bon' | 'moyen' | 'mauvais' | 'non_evalue' = 'non_evalue';

      // Priorité 1: Analyse photos (si disponible)
      if (photo?.condition) {
        const condition = photo.condition.toLowerCase();
        if (condition.includes('bon') || condition.includes('excellent')) {
          etatGeneral = 'bon';
        } else if (condition.includes('moyen') || condition.includes('correct')) {
          etatGeneral = 'moyen';
        } else if (condition.includes('mauvais') || condition.includes('médiocre')) {
          etatGeneral = 'mauvais';
        }
      }

      // Priorité 2: État déclaré
      if (etatGeneral === 'non_evalue' && params.etat_declare) {
        etatGeneral = params.etat_declare;
      }

      // ÉTAPE 2 : Récupérer surface
      const surfaceM2 = params.surface_m2 || immobilier?.bail?.surface_m2 || 0;

      // ÉTAPE 3 : Estimer travaux obligatoires
      const travauxObligatoires: any[] = [];
      const travauxRecommandes: any[] = [];

      // Travaux standards selon état
      if (etatGeneral === 'mauvais') {
        // Mise aux normes électrique
        travauxObligatoires.push({
          description: 'Mise aux normes électriques (installation vétuste)',
          estimation_basse: surfaceM2 > 0 ? surfaceM2 * 80 : 5000,
          estimation_haute: surfaceM2 > 0 ? surfaceM2 * 120 : 8000,
          urgence: 'immediat'
        });

        // Plomberie
        travauxObligatoires.push({
          description: 'Réfection plomberie et sanitaires',
          estimation_basse: 3000,
          estimation_haute: 6000,
          urgence: 'immediat'
        });

        // Rafraîchissement
        travauxRecommandes.push({
          description: 'Peinture et sol (état dégradé)',
          estimation_basse: surfaceM2 > 0 ? surfaceM2 * 50 : 3000,
          estimation_haute: surfaceM2 > 0 ? surfaceM2 * 80 : 5000,
          impact: 'Améliore image commerciale et valorise le fonds'
        });
      } else if (etatGeneral === 'moyen') {
        // Électricité à vérifier
        travauxObligatoires.push({
          description: 'Diagnostic électrique et mise en conformité partielle',
          estimation_basse: 2000,
          estimation_haute: 4000,
          urgence: '6_mois'
        });

        // Rafraîchissement
        travauxRecommandes.push({
          description: 'Rafraîchissement peinture et sols',
          estimation_basse: surfaceM2 > 0 ? surfaceM2 * 30 : 2000,
          estimation_haute: surfaceM2 > 0 ? surfaceM2 * 50 : 3500,
          impact: 'Améliore présentation générale'
        });
      }

      // Conformité ERP (si local recevant du public)
      let conformiteERP: 'conforme' | 'a_verifier' | 'non_conforme' | 'inconnu' = 'inconnu';
      let accessibilitePMR: boolean | null = null;

      // Heuristique: si commerce avec surface > 50m², ERP probable
      if (surfaceM2 >= 50) {
        conformiteERP = 'a_verifier';
        accessibilitePMR = false; // Supposer non conforme par défaut

        travauxObligatoires.push({
          description: 'Mise en conformité accessibilité PMR (rampe, sanitaires adaptés)',
          estimation_basse: 8000,
          estimation_haute: 15000,
          urgence: '12_mois'
        });

        travauxObligatoires.push({
          description: 'Diagnostic de sécurité incendie ERP (extincteurs, éclairage de sécurité)',
          estimation_basse: 2000,
          estimation_haute: 5000,
          urgence: '6_mois'
        });
      }

      // Utiliser analyse photos si disponible pour travaux
      if (photo?.renovation_needed && photo.cost_estimate) {
        travauxRecommandes.push({
          description: `Travaux identifiés par analyse IA : ${photo.renovation_needed}`,
          estimation_basse: Math.round(photo.cost_estimate * 0.8),
          estimation_haute: Math.round(photo.cost_estimate * 1.2),
          impact: 'Améliore état général du local selon analyse visuelle'
        });
      }

      // Ajouter travaux personnalisés
      if (params.travaux_custom && Array.isArray(params.travaux_custom)) {
        for (const travail of params.travaux_custom) {
          if (travail.type === 'obligatoire') {
            travauxObligatoires.push({
              description: travail.description,
              estimation_basse: travail.estimation_basse,
              estimation_haute: travail.estimation_haute,
              urgence: travail.urgence
            });
          } else {
            travauxRecommandes.push({
              description: travail.description,
              estimation_basse: travail.estimation_basse,
              estimation_haute: travail.estimation_haute,
              impact: 'Travaux personnalisés identifiés'
            });
          }
        }
      }

      // ÉTAPE 4 : Calculer budget total
      const obligatoireBas = travauxObligatoires.reduce((sum, t) => sum + t.estimation_basse, 0);
      const obligatoireHaut = travauxObligatoires.reduce((sum, t) => sum + t.estimation_haute, 0);
      const recommandeBas = travauxRecommandes.reduce((sum, t) => sum + t.estimation_basse, 0);
      const recommandeHaut = travauxRecommandes.reduce((sum, t) => sum + t.estimation_haute, 0);

      // Si aucun travaux, ajouter un message
      if (travauxObligatoires.length === 0 && etatGeneral === 'bon') {
        travauxObligatoires.push({
          description: 'Aucun travaux obligatoire identifié (local en bon état)',
          estimation_basse: 0,
          estimation_haute: 0,
          urgence: '12_mois'
        });
      }

      if (travauxRecommandes.length === 0 && etatGeneral === 'bon') {
        travauxRecommandes.push({
          description: 'Aucun travaux recommandé (local en bon état)',
          estimation_basse: 0,
          estimation_haute: 0,
          impact: 'Pas de travaux nécessaires'
        });
      }

      return {
        travaux: {
          etat_general: etatGeneral,
          conformite_erp: conformiteERP,
          accessibilite_pmr: accessibilitePMR,
          travaux_obligatoires: travauxObligatoires,
          travaux_recommandes: travauxRecommandes,
          budget_total: {
            obligatoire_bas: obligatoireBas,
            obligatoire_haut: obligatoireHaut,
            recommande_bas: recommandeBas,
            recommande_haut: recommandeHaut
          }
        }
      };

    } catch (error: any) {
      return {
        travaux: {
          etat_general: 'non_evalue',
          conformite_erp: 'inconnu',
          accessibilite_pmr: null,
          travaux_obligatoires: [],
          travaux_recommandes: [],
          budget_total: {
            obligatoire_bas: 0,
            obligatoire_haut: 0,
            recommande_bas: 0,
            recommande_haut: 0
          }
        },
        error: error.message || 'Travaux estimation failed'
      };
    }
  }
});

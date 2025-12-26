import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';

/**
 * Estimate Droit au Bail Tool
 *
 * Estime la valeur du droit au bail (propriété commerciale).
 * Le droit au bail est la valeur immatérielle liée au bail commercial.
 *
 * Méthodes de calcul:
 * 1. Méthode du loyer: 1 à 3 ans de loyer selon emplacement et conditions
 * 2. Méthode de l'emplacement: % du fonds de commerce (10-30%)
 * 3. Méthode comparative: prix du marché local
 *
 * Facteurs valorisants:
 * - Emplacement premium (centre-ville, zone passante)
 * - Loyer avantageux (< marché)
 * - Durée restante importante
 * - Clauses favorables (cession facile, destination large)
 */

const EstimateDroitBailInputSchema = z.object({
  valeur_fonds: z.number().optional().describe('Valeur estimée du fonds de commerce (pour calcul en %)'),
  emplacement_score: z.number().optional().describe('Score d\'emplacement 0-100 (si connu)')
});

const EstimateDroitBailOutputSchema = z.object({
  droit_au_bail_estime: z.number(),
  methode_calcul: z.string(),
  detail_calcul: z.object({
    methode_loyer: z.object({
      coefficient: z.number().describe('Nombre d\'années de loyer (1-3)'),
      valeur: z.number()
    }),
    methode_pourcentage: z.object({
      pourcentage: z.number().describe('% du fonds de commerce (10-30%)'),
      valeur: z.number()
    }).optional(),
    facteurs_valorisants: z.array(z.string()),
    facteurs_devalorisant: z.array(z.string())
  }),
  error: z.string().optional()
});

export const estimateDroitBailTool = new FunctionTool({
  name: 'estimateDroitBail',
  description: 'Estime la valeur du droit au bail (propriété commerciale). Utilise méthode du loyer (1-3 ans) et facteurs emplacement/conditions. Retourne { droit_au_bail_estime, methode_calcul, detail_calcul }',
  parameters: zToGen(EstimateDroitBailInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    try {
      // Lire immobilier depuis state (doit contenir bail analysé)
      let immobilier = toolContext?.state.get('immobilier') as any;

      // Parser JSON string si nécessaire
      if (typeof immobilier === 'string') {
        try {
          immobilier = JSON.parse(immobilier);
        } catch (e) {
          return {
            droit_au_bail_estime: 0,
            methode_calcul: 'Impossible de calculer',
            detail_calcul: {
              methode_loyer: { coefficient: 0, valeur: 0 },
              facteurs_valorisants: [],
              facteurs_devalorisant: ['Erreur parsing données immobilier']
            },
            error: 'Failed to parse immobilier state (invalid JSON)'
          };
        }
      }

      if (!immobilier?.bail) {
        return {
          droit_au_bail_estime: 0,
          methode_calcul: 'Bail non disponible',
          detail_calcul: {
            methode_loyer: { coefficient: 0, valeur: 0 },
            facteurs_valorisants: [],
            facteurs_devalorisant: ['Bail commercial non fourni']
          },
          error: 'No bail data in state.immobilier'
        };
      }

      const { bail } = immobilier;

      // ÉTAPE 1 : Déterminer le coefficient de loyer (1-3 ans)
      let coefficient = 2.0; // Base médiane

      const facteursValorisants: string[] = [];
      const facteursDevalorisant: string[] = [];

      // Facteur 1: Emplacement (via appreciation loyer)
      if (bail.appreciation === 'avantageux') {
        coefficient += 0.5;
        facteursValorisants.push('Loyer avantageux (en-dessous du marché)');
      } else if (bail.appreciation === 'desavantageux') {
        coefficient -= 0.5;
        facteursDevalorisant.push('Loyer désavantageux (au-dessus du marché)');
      }

      // Facteur 2: Durée restante
      if (bail.duree_restante_mois >= 72) {
        coefficient += 0.3;
        facteursValorisants.push(`Longue durée restante (${Math.round(bail.duree_restante_mois / 12)} ans)`);
      } else if (bail.duree_restante_mois < 24) {
        coefficient -= 0.3;
        facteursDevalorisant.push(`Durée restante courte (${Math.round(bail.duree_restante_mois / 12)} ans)`);
      }

      // Facteur 3: Type de bail
      if (bail.type === 'commercial_3_6_9') {
        coefficient += 0.2;
        facteursValorisants.push('Bail 3-6-9 avec statut protecteur');
      } else if (bail.type === 'derogatoire') {
        coefficient -= 0.4;
        facteursDevalorisant.push('Bail dérogatoire sans protection');
      }

      // Facteur 4: Clauses favorables
      if (bail.clause_cession && bail.clause_cession.toLowerCase().includes('libre')) {
        coefficient += 0.2;
        facteursValorisants.push('Cession libre du bail');
      }

      // Limiter le coefficient entre 1 et 3
      coefficient = Math.max(1.0, Math.min(3.0, coefficient));

      // ÉTAPE 2 : Calcul par méthode du loyer
      const loyerAnnuel = bail.loyer_annuel_hc;
      const valeurMethodeLoyer = Math.round(loyerAnnuel * coefficient);

      // ÉTAPE 3 : Calcul par méthode du pourcentage (si valeur fonds fournie)
      let valeurMethodePourcentage: number | undefined;
      let pourcentage: number | undefined;

      if (params.valeur_fonds && params.valeur_fonds > 0) {
        // Pourcentage standard : 15-25% du fonds selon emplacement
        pourcentage = 20; // Base

        if (bail.appreciation === 'avantageux') {
          pourcentage = 25;
        } else if (bail.appreciation === 'desavantageux') {
          pourcentage = 15;
        }

        valeurMethodePourcentage = Math.round((params.valeur_fonds * pourcentage) / 100);
      }

      // ÉTAPE 4 : Déterminer la valeur finale
      let droitBailEstime = valeurMethodeLoyer;
      let methodeCalcul = `Méthode du loyer : ${coefficient.toFixed(1)} années × ${loyerAnnuel.toLocaleString('fr-FR')} €`;

      // Si méthode pourcentage disponible, prendre la moyenne
      if (valeurMethodePourcentage) {
        droitBailEstime = Math.round((valeurMethodeLoyer + valeurMethodePourcentage) / 2);
        methodeCalcul = `Moyenne méthode loyer (${valeurMethodeLoyer.toLocaleString('fr-FR')} €) et méthode pourcentage (${valeurMethodePourcentage.toLocaleString('fr-FR')} €)`;
      }

      // Ajouter facteurs génériques si listes vides
      if (facteursValorisants.length === 0) {
        facteursValorisants.push('Aucun facteur valorisant identifié');
      }

      if (facteursDevalorisant.length === 0) {
        facteursDevalorisant.push('Aucun facteur dévalorisant majeur');
      }

      return {
        droit_au_bail_estime: droitBailEstime,
        methode_calcul: methodeCalcul,
        detail_calcul: {
          methode_loyer: {
            coefficient,
            valeur: valeurMethodeLoyer
          },
          ...(valeurMethodePourcentage && pourcentage ? {
            methode_pourcentage: {
              pourcentage,
              valeur: valeurMethodePourcentage
            }
          } : {}),
          facteurs_valorisants: facteursValorisants,
          facteurs_devalorisant: facteursDevalorisant
        }
      };

    } catch (error: any) {
      return {
        droit_au_bail_estime: 0,
        methode_calcul: 'Erreur lors du calcul',
        detail_calcul: {
          methode_loyer: { coefficient: 0, valeur: 0 },
          facteurs_valorisants: [],
          facteurs_devalorisant: ['Erreur lors du calcul']
        },
        error: error.message || 'Droit au bail estimation failed'
      };
    }
  }
});

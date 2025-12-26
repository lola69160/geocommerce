import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import { zToGen } from '../../utils/schemaHelper.js';

/**
 * Resolve Conflict Tool
 *
 * Résout intelligemment les conflits détectés par ValidationAgent.
 * Analyse le type de conflit, priorise les sources selon fiabilité,
 * et génère une résolution avec confidence scoring.
 *
 * Résolutions possibles:
 * - CONFIRMED: Source A correcte, source B rejetée
 * - REJECTED: Source B correcte, source A rejetée
 * - HYBRID: Les deux sources partiellement vraies (nuancé)
 * - NEEDS_REVALIDATION: Données insuffisantes pour décider
 */

const ResolveConflictInputSchema = z.object({
  conflict: z.object({
    id: z.string(),
    type: z.enum([
      'POPULATION_POI_MISMATCH',
      'CSP_PRICING_MISMATCH',
      'RATING_PHOTOS_MISMATCH',
      'DATA_INCONSISTENCY',
      'SCORE_MISMATCH',
      'GEOGRAPHIC_MISMATCH'
    ]),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    description: z.string(),
    sources: z.record(z.string(), z.any())
  })
});

export const resolveConflictTool = new FunctionTool({
  name: 'resolveConflict',
  description: 'Résout un conflit spécifique avec logique par type. Retourne { resolution, confidence, explanation, updatedData, action }',
  parameters: zToGen(ResolveConflictInputSchema),

  execute: async ({ conflict }: z.infer<typeof ResolveConflictInputSchema>) => {
    let resolution: 'CONFIRMED' | 'REJECTED' | 'HYBRID' | 'NEEDS_REVALIDATION';
    let confidence: number; // 0.0 - 1.0
    let explanation: string;
    let updatedData: Record<string, any> = {};
    let action: string;

    // Logique de résolution par type de conflit
    switch (conflict.type) {
      case 'POPULATION_POI_MISMATCH': {
        const population = conflict.sources.demographic_population || 0;
        const totalPOI = conflict.sources.competitor_total_poi || 0;

        if (population > 3000 && totalPOI === 0) {
          // Population élevée mais 0 POI → Probable erreur GPS ou recherche POI
          resolution = 'NEEDS_REVALIDATION';
          confidence = 0.7;
          explanation = `Population de ${population} habitants confirmée mais 0 POI trouvés suggère une erreur de coordonnées GPS ou une zone résidentielle pure. Revalider les coordonnées et élargir rayon de recherche POI à 1km.`;
          action = 'Revalider coordonnées GPS et relancer recherche POI avec rayon élargi';
          updatedData = {
            gps_validation_required: true,
            poi_search_radius_suggestion: 1000 // mètres
          };
        } else if (population < 500 && totalPOI > 10) {
          // Population faible mais beaucoup de POI → Zone commerciale
          resolution = 'HYBRID';
          confidence = 0.85;
          explanation = `Population résidentielle faible (${population} hab) mais ${totalPOI} POI indiquent une zone commerciale/touristique. Les deux sources sont correctes : faible résidentiel mais fort passage commercial.`;
          action = 'Accepter les deux données, qualifier zone comme "commerciale dense"';
          updatedData = {
            zone_type: 'commercial_district',
            residential_population: population,
            commercial_density: 'high'
          };
        } else {
          resolution = 'CONFIRMED';
          confidence = 0.6;
          explanation = 'Données cohérentes avec légère anomalie, accepter telles quelles';
          action = 'Aucune action requise';
        }
        break;
      }

      case 'CSP_PRICING_MISMATCH': {
        const cspDominant = conflict.sources.demographic_csp;
        const priceLevel = conflict.sources.places_price_level;

        if (cspDominant === 'high' && priceLevel === 1) {
          // CSP+ mais pricing discount → Opportunité repositionnement
          resolution = 'HYBRID';
          confidence = 0.90;
          explanation = `Zone CSP+ confirmée (${cspDominant}) mais commerce positionné discount (${priceLevel}/4). Les deux données sont correctes. OPPORTUNITÉ STRATÉGIQUE : repositionnement premium pourrait augmenter marges sans perdre clientèle.`;
          action = 'Analyser opportunité repositionnement pricing vers gamme supérieure';
          updatedData = {
            opportunity_type: 'pricing_repositioning',
            current_positioning: 'discount',
            recommended_positioning: 'premium',
            upside_potential: 'high'
          };
        } else if (cspDominant === 'low' && priceLevel >= 3) {
          // CSP modeste mais pricing premium → Risque inadéquation
          resolution = 'HYBRID';
          confidence = 0.85;
          explanation = `Zone CSP modeste (${cspDominant}) mais pricing élevé (${priceLevel}/4). RISQUE : inadéquation clientèle-offre. Soit niche spécialisée, soit erreur positionnement.`;
          action = 'Vérifier adéquation offre/clientèle, considérer ajustement pricing';
          updatedData = {
            risk_type: 'pricing_mismatch',
            current_csp: cspDominant,
            pricing_risk: 'high'
          };
        } else {
          resolution = 'CONFIRMED';
          confidence = 0.75;
          explanation = 'CSP et pricing globalement cohérents';
          action = 'Aucune action requise';
        }
        break;
      }

      case 'RATING_PHOTOS_MISMATCH': {
        const googleRating = conflict.sources.places_rating || 0;
        const photoNote = conflict.sources.photo_note_globale || 0;

        if (googleRating > 4.0 && photoNote < 5) {
          // Rating élevé mais état physique médiocre → Confusion établissement
          resolution = 'NEEDS_REVALIDATION';
          confidence = 0.80;
          explanation = `Google rating élevé (${googleRating}/5) incompatible avec état physique médiocre (${photoNote}/10). CRITIQUE : probable confusion d'établissement lors du matching Google Places. Revalider le matching avec scoring strict.`;
          action = 'URGENT: Revalider matching Google Places, vérifier place_id correct';
          updatedData = {
            places_matching_confidence: 'low',
            requires_manual_verification: true,
            potential_mismatch: true
          };
        } else if (googleRating < 3.0 && photoNote > 8) {
          // Rating faible mais état physique excellent → Problème service
          resolution = 'HYBRID';
          confidence = 0.85;
          explanation = `Google rating faible (${googleRating}/5) malgré état physique excellent (${photoNote}/10). Les deux sources correctes : locaux en bon état mais problèmes service/accueil/qualité produits.`;
          action = 'Noter problème service/qualité malgré bon état physique';
          updatedData = {
            physical_condition: 'excellent',
            service_quality: 'poor',
            improvement_focus: 'service_not_infrastructure'
          };
        } else {
          resolution = 'CONFIRMED';
          confidence = 0.75;
          explanation = 'Rating et état physique cohérents';
          action = 'Aucune action requise';
        }
        break;
      }

      case 'GEOGRAPHIC_MISMATCH': {
        const distanceMeters = conflict.sources.distance_meters || 0;

        if (distanceMeters > 200) {
          // Distance critique → Mauvais matching
          resolution = 'REJECTED';
          confidence = 0.95;
          explanation = `Distance GPS de ${distanceMeters}m entre sources INACCEPTABLE. CRITIQUE : données Google Places probablement incorrectes (mauvais établissement matché). REJETER les données Places.`;
          action = 'URGENT: Rejeter données Places, relancer recherche avec critères stricts';
          updatedData = {
            places_data_rejected: true,
            requires_new_search: true,
            search_strategy: 'address_only_with_strict_scoring'
          };
        } else if (distanceMeters > 100) {
          // Distance moyenne → Vérification recommandée
          resolution = 'NEEDS_REVALIDATION';
          confidence = 0.70;
          explanation = `Distance GPS de ${distanceMeters}m entre sources. ATTENTION : écart notable, vérification recommandée mais pas bloquante.`;
          action = 'Vérifier précision GPS, accepter si pas d\'autre anomalie';
          updatedData = {
            gps_precision_warning: true,
            distance_meters: distanceMeters
          };
        } else {
          resolution = 'CONFIRMED';
          confidence = 0.90;
          explanation = `Distance GPS acceptable (${distanceMeters}m)`;
          action = 'Aucune action requise';
        }
        break;
      }

      case 'SCORE_MISMATCH': {
        const demoScore = conflict.sources.demographic_score || 0;
        const travauxBudget = conflict.sources.budget_travaux_max || 0;

        if (demoScore > 75 && travauxBudget > 50000) {
          // Bon potentiel mais gros travaux → Analyse ROI
          resolution = 'HYBRID';
          confidence = 0.85;
          explanation = `Potentiel démographique élevé (${demoScore}/100) mais travaux importants (${travauxBudget}€). Les deux corrects : bon emplacement MAIS investissement initial conséquent. Analyser ROI et délai retour sur investissement.`;
          action = 'Calculer ROI avec travaux, analyser délai amortissement';
          updatedData = {
            high_potential: true,
            high_initial_investment: true,
            requires_roi_analysis: true,
            estimated_works_budget: travauxBudget
          };
        } else {
          resolution = 'CONFIRMED';
          confidence = 0.75;
          explanation = 'Score démographique et budget travaux cohérents';
          action = 'Aucune action requise';
        }
        break;
      }

      case 'DATA_INCONSISTENCY': {
        // Incohérence générique
        resolution = 'NEEDS_REVALIDATION';
        confidence = 0.60;
        explanation = 'Incohérence de données détectée. Revalidation recommandée pour identifier source exacte du problème.';
        action = 'Revalider les sources de données concernées';
        updatedData = {
          requires_manual_review: true
        };
        break;
      }

      default:
        resolution = 'NEEDS_REVALIDATION';
        confidence = 0.50;
        explanation = 'Type de conflit non reconnu, revalidation nécessaire';
        action = 'Analyser manuellement ce conflit';
    }

    return {
      conflict_id: conflict.id,
      resolution,
      confidence,
      explanation,
      action,
      updated_data: updatedData,
      resolved_at: new Date().toISOString(),
      original_severity: conflict.severity
    };
  }
});

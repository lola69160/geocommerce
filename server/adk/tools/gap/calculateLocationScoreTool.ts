import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../utils/schemaHelper.js';

/**
 * Calculate Location Score Tool (NEW - 2026-01-09)
 *
 * Calcule le nouveau "Weighted Opportunity Score" pour remplacer l'ancienne formule de location score.
 *
 * Nouvelle formule:
 * LocationScore = (CommercialSynergy * 0.5) + (DemographicQuality * 0.3) + (CompetitorPressure * 0.2)
 *
 * A. Commercial Synergy Score (50% du poids):
 *    - Mesure la capacité des commerces voisins à apporter du flux quotidien
 *    - Si "Traffic Locomotives" (Bucket B) à < 100m → Score élevé
 *    - Bonus si > 5 commerces actifs dans les 200m
 *
 * B. Demographic Quality Score (30% du poids):
 *    - Matrice Densité × Revenu médian (CSP)
 *    - Une faible densité + revenu élevé ne doit PAS être pénalisée (zone résidentielle premium)
 *
 * C. Competitor Pressure Score (20% du poids):
 *    - Score inversé basé sur la distance des concurrents directs (Bucket A)
 *    - 0 concurrent = 100/100 (monopole local)
 *
 * Exemple JEDAUVIS (Limonest):
 * - Synergy: 85/100 (Halles à proximité immédiate)
 * - Demographics: 80/100 (Faible densité mais CSP très haute)
 * - Competition: 100/100 (0 concurrent à 500m)
 * → Score final: (85*0.5) + (80*0.3) + (100*0.2) = 86.5/100 ✅ (vs ancien 30/100)
 */

const InputSchema = z.object({});

export const calculateLocationScoreTool = new FunctionTool({
  name: 'calculateLocationScore',
  description: 'Calcule le nouveau Location Score avec formule Weighted Opportunity (Synergy 50% + Demographics 30% + Competition 20%). Retourne { location_score, breakdown, interpretation }',
  parameters: zToGen(InputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    // Lire données depuis state
    let competitor: any = toolContext?.state.get('competitor');
    let demographic: any = toolContext?.state.get('demographic');

    // Parser JSON string si nécessaire
    if (typeof competitor === 'string') {
      try {
        competitor = JSON.parse(competitor);
      } catch (e) {
        competitor = null;
      }
    }

    if (typeof demographic === 'string') {
      try {
        demographic = JSON.parse(demographic);
      } catch (e) {
        demographic = null;
      }
    }

    // A. COMMERCIAL SYNERGY SCORE (50% du poids)
    let synergyScore = 50; // Score de base (neutre)

    const nearbyPoi = competitor?.analysis?.nearby_poi || {};
    const locomotivesCount = competitor?.analysis?.categorization?.bucket_b_locomotives || 0;

    // Vérifier présence de "Traffic Locomotives" (Bucket B) à < 100m
    const closeLocomotives = Object.values(nearbyPoi).filter(
      (poi: any) => poi.bucket === 'B' && poi.distance_meters < 100
    ).length;

    if (closeLocomotives > 0) {
      synergyScore = 90; // Score élevé si locomotive à proximité immédiate (Halles, Pharmacie, Boulangerie)
      console.log(`[calculateLocationScore] 🎯 ${closeLocomotives} locomotives à < 100m → Synergy: 90/100`);
    } else if (locomotivesCount > 0) {
      // Locomotives présentes mais plus loin (100-500m)
      synergyScore = 70;
      console.log(`[calculateLocationScore] 🎯 ${locomotivesCount} locomotives à 100-500m → Synergy: 70/100`);
    }

    // Bonus: > 5 commerces actifs dans les 200m (densité commerciale)
    const closeBusinesses = Object.values(nearbyPoi).filter(
      (poi: any) => poi.distance_meters < 200
    ).length;

    if (closeBusinesses > 5) {
      synergyScore = Math.min(100, synergyScore + 10);
      console.log(`[calculateLocationScore] 🏪 ${closeBusinesses} commerces à < 200m → Bonus +10 points`);
    }

    // B. DEMOGRAPHIC QUALITY SCORE (30% du poids)
    const density = demographic?.commune?.density || 0;
    const medianIncome = demographic?.profile?.estimated_csp?.median_income_estimate || 28000;

    let demoQualityScore = 50; // Score de base (neutre)

    // Matrice: Densité × Revenu médian
    if (density < 500 && medianIncome > 32000) {
      // Faible densité + revenu élevé = zone résidentielle premium (JEDAUVIS - Limonest)
      // Panier moyen élevé, faible concurrence, clientèle fidèle
      demoQualityScore = 80;
      console.log(`[calculateLocationScore] 💰 Résidentiel premium (densité ${density}, revenu ${medianIncome}€) → Demo: 80/100`);
    } else if (density < 500 && medianIncome < 25000) {
      // Faible densité + revenu faible = zone morte (rural défavorisé)
      demoQualityScore = 20;
      console.log(`[calculateLocationScore] ⚠️ Zone morte (densité ${density}, revenu ${medianIncome}€) → Demo: 20/100`);
    } else if (density > 2000 && medianIncome > 32000) {
      // Urbain dense + CSP élevé = centres-villes premium (Lyon 6ème, Paris 7ème)
      demoQualityScore = 85;
      console.log(`[calculateLocationScore] 🏙️ Urbain premium (densité ${density}, revenu ${medianIncome}€) → Demo: 85/100`);
    } else if (density > 2000) {
      // Urbain dense + CSP moyen
      demoQualityScore = 65;
      console.log(`[calculateLocationScore] 🏘️ Urbain standard (densité ${density}, revenu ${medianIncome}€) → Demo: 65/100`);
    } else {
      // Zones intermédiaires (500-2000 hab/km²)
      demoQualityScore = 55;
      console.log(`[calculateLocationScore] 🏡 Zone péri-urbaine (densité ${density}, revenu ${medianIncome}€) → Demo: 55/100`);
    }

    // C. COMPETITOR PRESSURE SCORE (20% du poids)
    const bucketA = competitor?.analysis?.categorization?.bucket_a_competitors || 0;
    const nearbyPoiArray = Object.values(nearbyPoi).filter((poi: any) => poi.bucket === 'A');
    const nearestCompetitor = nearbyPoiArray.sort((a: any, b: any) => a.distance_meters - b.distance_meters)[0];

    let competitorScore = 100; // Score de base (monopole - pas de concurrent)

    if (bucketA === 0) {
      // Monopole local (JEDAUVIS: 0 concurrent Tabac/Presse à 500m)
      competitorScore = 100;
      console.log(`[calculateLocationScore] 🏆 Monopole local (0 concurrent) → Competitor: 100/100`);
    } else if (nearestCompetitor && nearestCompetitor.distance_meters > 300) {
      // 1 concurrent à 300-500m (concurrence modérée)
      competitorScore = 70;
      console.log(`[calculateLocationScore] ⚔️ 1 concurrent à ${nearestCompetitor.distance_meters}m → Competitor: 70/100`);
    } else if (nearestCompetitor && nearestCompetitor.distance_meters < 300) {
      // 1 concurrent < 300m (concurrence forte)
      competitorScore = 40;
      console.log(`[calculateLocationScore] ⚔️⚔️ 1 concurrent à ${nearestCompetitor.distance_meters}m → Competitor: 40/100`);
    }

    // CALCUL FINAL (moyenne pondérée)
    const finalScore = Math.round(
      (synergyScore * 0.5) + (demoQualityScore * 0.3) + (competitorScore * 0.2)
    );

    console.log(`[calculateLocationScore] 📊 FINAL SCORE: ${finalScore}/100 = (${synergyScore}*0.5) + (${demoQualityScore}*0.3) + (${competitorScore}*0.2)`);

    return {
      location_score: finalScore,
      breakdown: {
        commercial_synergy: synergyScore,
        demographic_quality: demoQualityScore,
        competitor_pressure: competitorScore
      },
      weights: {
        synergy: 0.5,
        demographic: 0.3,
        competitor: 0.2
      },
      interpretation: generateInterpretation(finalScore, closeLocomotives, medianIncome, bucketA),
      metadata: {
        density,
        median_income: medianIncome,
        locomotives_count: locomotivesCount,
        close_locomotives: closeLocomotives,
        close_businesses: closeBusinesses,
        direct_competitors: bucketA,
        nearest_competitor_distance: nearestCompetitor?.distance_meters || null
      }
    };
  }
});

/**
 * Generate Interpretation
 *
 * Génère une interprétation textuelle du score calculé.
 */
function generateInterpretation(
  score: number,
  locomotives: number,
  income: number,
  competitors: number
): string {
  if (score >= 85) {
    return `Emplacement EXCELLENT (${score}/100). Présence de ${locomotives} locomotives de trafic à proximité immédiate, revenu médian estimé ${income.toLocaleString('fr-FR')}€, ${competitors} concurrent(s) direct(s). Configuration optimale pour GO.`;
  } else if (score >= 70) {
    return `Emplacement TRÈS BON (${score}/100). Bon équilibre entre flux commercial, qualité démographique et pression concurrentielle. Zone attractive avec potentiel de développement.`;
  } else if (score >= 50) {
    return `Emplacement CORRECT (${score}/100). Potentiel modéré, quelques actions de dynamisation possibles (partenariats locaux, marketing de proximité).`;
  } else {
    return `Emplacement FAIBLE (${score}/100). Zone à faible attractivité commerciale, risques importants. Nécessite stratégie différenciation forte ou investissements marketing significatifs.`;
  }
}

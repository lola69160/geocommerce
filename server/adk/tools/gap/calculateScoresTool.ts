import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import { zToGen } from '../../utils/schemaHelper.js';

/**
 * Calculate Scores Tool
 *
 * Calcule des scores multi-dimensionnels (0-100) pour évaluer
 * l'opportunité commerciale selon 4 dimensions:
 * 1. LOCATION (emplacement)
 * 2. MARKET (marché et demande)
 * 3. OPERATIONAL (état opérationnel)
 * 4. FINANCIAL (viabilité financière)
 *
 * Chaque dimension est pondérée pour générer un score global.
 */

const CalculateScoresInputSchema = z.object({
  // NOUVEAU (2026-01-09): Location score pré-calculé par calculateLocationScoreTool
  locationScore: z.number().optional().describe('Location score pré-calculé (0-100) par calculateLocationScore'),
  locationBreakdown: z.object({
    commercial_synergy: z.number().optional(),
    demographic_quality: z.number().optional(),
    competitor_pressure: z.number().optional()
  }).optional().describe('Breakdown du nouveau location score'),

  demographic: z.object({
    demographic_score: z.object({
      overall: z.number().optional()
    }).optional(),
    trade_area_potential: z.object({
      walking_500m: z.number().optional()
    }).optional()
  }).optional(),

  places: z.object({
    found: z.boolean().optional(),
    rating: z.number().nullable().optional(),
    userRatingsTotal: z.number().optional(),
    matchScore: z.number().optional()
  }).optional(),

  photo: z.object({
    analyzed: z.boolean().optional(),
    etat_general: z.object({
      note_globale: z.number().optional()
    }).optional(),
    budget_travaux: z.object({
      fourchette_haute: z.number().optional()
    }).optional()
  }).optional(),

  competitor: z.object({
    total_competitors: z.number().optional(),
    density_level: z.string().optional()
  }).optional(),

  validation: z.object({
    coherence_score: z.number().optional()
  }).optional()
});

export const calculateScoresTool = new FunctionTool({
  name: 'calculateScores',
  description: 'Calcule scores multi-dimensionnels 0-100 (location, market, operational, financial). Retourne { scores: {...}, overall, breakdown }',
  parameters: zToGen(CalculateScoresInputSchema),

  execute: async (data: z.infer<typeof CalculateScoresInputSchema>) => {
    // DIMENSION 1: LOCATION (Emplacement) - 0-100
    // NOUVEAU (2026-01-09): Utiliser le score pré-calculé par calculateLocationScore si disponible
    let locationScore = 0;
    let locationBreakdown: Record<string, any> = {};

    if (data.locationScore !== undefined) {
      // Utiliser le nouveau "Weighted Opportunity Score" pré-calculé
      locationScore = data.locationScore;
      locationBreakdown = data.locationBreakdown || {};
      console.log(`[calculateScores] 🎯 Using NEW location score: ${locationScore}/100 (Synergy ${locationBreakdown.commercial_synergy}, Demo ${locationBreakdown.demographic_quality}, Competitor ${locationBreakdown.competitor_pressure})`);
    } else {
      // Fallback: ancien système (pour rétrocompatibilité)
      console.warn('[calculateScores] ⚠️ locationScore not provided - using LEGACY calculation (deprecated)');

      // 1.1 Score démographique (40 points)
      if (data.demographic?.demographic_score?.overall !== undefined) {
        const demoScore = data.demographic.demographic_score.overall;
        locationScore += (demoScore / 100) * 40;
        locationBreakdown.demographic_score = Math.round((demoScore / 100) * 40);
      }

      // 1.2 Potentiel zone chalandise (30 points)
      if (data.demographic?.trade_area_potential?.walking_500m !== undefined) {
        const population = data.demographic.trade_area_potential.walking_500m;
        let popScore = 0;
        if (population >= 5000) popScore = 30;
        else if (population >= 3000) popScore = 25;
        else if (population >= 1500) popScore = 20;
        else if (population >= 800) popScore = 15;
        else if (population >= 400) popScore = 10;
        else popScore = 5;
        locationScore += popScore;
        locationBreakdown.trade_area_population = popScore;
      }

      // 1.3 Matching GPS Places (30 points)
      if (data.places?.matchScore !== undefined) {
        const matchScore = data.places.matchScore;
        locationScore += (matchScore / 100) * 30;
        locationBreakdown.gps_matching = Math.round((matchScore / 100) * 30);
      } else if (data.places?.found === false) {
        // Pas de matching = pénalité
        locationBreakdown.gps_matching = 0;
      }
    }

    // DIMENSION 2: MARKET (Marché et demande) - 0-100
    let marketScore = 0;
    let marketBreakdown: Record<string, any> = {};

    // 2.1 Réputation Google (40 points)
    if (data.places?.found && data.places.rating !== undefined && data.places.rating !== null) {
      const rating = data.places.rating;
      marketScore += (rating / 5) * 40;
      marketBreakdown.google_reputation = Math.round((rating / 5) * 40);
    }

    // 2.2 Volume avis (20 points)
    if (data.places?.userRatingsTotal !== undefined) {
      const reviews = data.places.userRatingsTotal;
      let reviewScore = 0;
      if (reviews >= 100) reviewScore = 20;
      else if (reviews >= 50) reviewScore = 17;
      else if (reviews >= 20) reviewScore = 14;
      else if (reviews >= 10) reviewScore = 10;
      else if (reviews >= 5) reviewScore = 7;
      else reviewScore = 3;
      marketScore += reviewScore;
      marketBreakdown.review_volume = reviewScore;
    }

    // 2.3 Densité concurrentielle (40 points - inversé: moins de concurrence = mieux)
    if (data.competitor?.density_level !== undefined) {
      const density = data.competitor.density_level;
      let densityScore = 0;
      switch (density) {
        case 'very_low': densityScore = 40; break; // Peu de concurrence
        case 'low': densityScore = 35; break;
        case 'moderate': densityScore = 25; break;
        case 'high': densityScore = 15; break;
        case 'very_high': densityScore = 5; break; // Marché saturé
        default: densityScore = 20;
      }
      marketScore += densityScore;
      marketBreakdown.competitive_density = densityScore;
    }

    // DIMENSION 3: OPERATIONAL (État opérationnel) - 0-100
    let operationalScore = 0;
    let operationalBreakdown: Record<string, any> = {};

    // 3.1 État physique général (60 points)
    if (data.photo?.analyzed && data.photo.etat_general?.note_globale !== undefined) {
      const note = data.photo.etat_general.note_globale;
      operationalScore += (note / 10) * 60;
      operationalBreakdown.physical_condition = Math.round((note / 10) * 60);
    }

    // 3.2 Budget travaux (40 points - inversé: moins de travaux = mieux)
    if (data.photo?.budget_travaux?.fourchette_haute !== undefined) {
      const budget = data.photo.budget_travaux.fourchette_haute;
      let budgetScore = 0;
      if (budget <= 10000) budgetScore = 40;
      else if (budget <= 25000) budgetScore = 32;
      else if (budget <= 50000) budgetScore = 24;
      else if (budget <= 75000) budgetScore = 16;
      else if (budget <= 100000) budgetScore = 8;
      else budgetScore = 0;
      operationalScore += budgetScore;
      operationalBreakdown.renovation_cost = budgetScore;
    }

    // DIMENSION 4: FINANCIAL (Viabilité financière) - 0-100
    let financialScore = 0;
    let financialBreakdown: Record<string, any> = {};

    // 4.1 Cohérence données (50 points)
    if (data.validation?.coherence_score !== undefined) {
      const coherence = data.validation.coherence_score;
      financialScore += (coherence / 100) * 50;
      financialBreakdown.data_coherence = Math.round((coherence / 100) * 50);
    }

    // 4.2 Ratio potentiel/travaux (50 points)
    if (data.demographic?.demographic_score?.overall !== undefined &&
        data.photo?.budget_travaux?.fourchette_haute !== undefined) {
      const potential = data.demographic.demographic_score.overall;
      const works = data.photo.budget_travaux.fourchette_haute;

      // Bon potentiel avec peu de travaux = excellent
      // Fort potentiel avec gros travaux = moyen
      // Faible potentiel avec gros travaux = mauvais
      let ratioScore = 0;
      if (potential >= 75 && works <= 25000) ratioScore = 50;
      else if (potential >= 75 && works <= 50000) ratioScore = 40;
      else if (potential >= 60 && works <= 50000) ratioScore = 35;
      else if (potential >= 50 && works <= 75000) ratioScore = 25;
      else if (potential >= 40) ratioScore = 15;
      else ratioScore = 5;

      financialScore += ratioScore;
      financialBreakdown.potential_to_investment_ratio = ratioScore;
    }

    // Normaliser scores si incomplets
    locationScore = Math.min(100, Math.round(locationScore));
    marketScore = Math.min(100, Math.round(marketScore));
    operationalScore = Math.min(100, Math.round(operationalScore));
    financialScore = Math.min(100, Math.round(financialScore));

    // SCORE GLOBAL (moyenne pondérée)
    // Location: 30%, Market: 25%, Operational: 25%, Financial: 20%
    const overallScore = Math.round(
      locationScore * 0.30 +
      marketScore * 0.25 +
      operationalScore * 0.25 +
      financialScore * 0.20
    );

    // Niveau global
    let overallLevel: 'excellent' | 'good' | 'fair' | 'poor';
    if (overallScore >= 80) overallLevel = 'excellent';
    else if (overallScore >= 65) overallLevel = 'good';
    else if (overallScore >= 50) overallLevel = 'fair';
    else overallLevel = 'poor';

    return {
      scores: {
        location: locationScore,
        market: marketScore,
        operational: operationalScore,
        financial: financialScore,
        overall: overallScore
      },
      level: overallLevel,
      breakdown: {
        location: locationBreakdown,
        market: marketBreakdown,
        operational: operationalBreakdown,
        financial: financialBreakdown
      },
      weights: {
        location: 0.30,
        market: 0.25,
        operational: 0.25,
        financial: 0.20
      },
      interpretation: {
        location: locationScore >= 70 ? 'Excellent emplacement' : locationScore >= 50 ? 'Emplacement correct' : 'Emplacement limité',
        market: marketScore >= 70 ? 'Marché favorable' : marketScore >= 50 ? 'Marché modéré' : 'Marché difficile',
        operational: operationalScore >= 70 ? 'Bon état opérationnel' : operationalScore >= 50 ? 'État acceptable' : 'Travaux importants',
        financial: financialScore >= 70 ? 'Viabilité élevée' : financialScore >= 50 ? 'Viabilité moyenne' : 'Viabilité faible'
      }
    };
  }
});

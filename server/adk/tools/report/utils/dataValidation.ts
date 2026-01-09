/**
 * Data Validation Module - Amélioration 7
 *
 * Détecte les incohérences et contradictions dans le rapport professionnel
 */

export interface ValidationWarning {
  id: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'score_coherence' | 'strategic_contradiction' | 'risk_justification' | 'data_consistency';
  description: string;
  affected_data: string[];
  recommendation: string;
}

export interface ValidationResult {
  isValid: boolean;
  warnings: ValidationWarning[];
  errors: ValidationWarning[];
  score: number; // 0-100 (cohérence globale)
}

/**
 * 1. Validate Score Coherence
 * Détecte les incohérences entre scores et fondamentaux
 */
export function validateScoreCoherence(gap: any, demographic: any, competitor: any, places: any): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  if (!gap?.scores) return warnings;

  const scores = gap.scores;
  const population = demographic?.commune?.population || 0;
  const totalCompetitors = competitor?.total_competitors || 0;
  const rating = places?.rating || 0;

  // Check: Score location faible mais bons fondamentaux
  if (scores.location < 50 && population > 5000 && totalCompetitors < 5) {
    warnings.push({
      id: 'location_score_mismatch',
      severity: 'HIGH',
      category: 'score_coherence',
      description: `Score Location ${scores.location}/100 malgré population ${population} et faible concurrence (${totalCompetitors} POI)`,
      affected_data: ['gap.scores.location', 'demographic.commune.population', 'competitor.total_competitors'],
      recommendation: 'Vérifier les métriques d\'accessibilité, GPS matching, facteurs de visibilité'
    });
  }

  // Check: Score market élevé mais rating Google faible
  if (scores.market > 70 && rating > 0 && rating < 3.5) {
    warnings.push({
      id: 'market_reputation_mismatch',
      severity: 'MEDIUM',
      category: 'score_coherence',
      description: `Score Market ${scores.market}/100 malgré note Google ${rating.toFixed(1)}/5`,
      affected_data: ['gap.scores.market', 'places.rating'],
      recommendation: 'Revoir la pondération du score market ou justifier par le potentiel futur'
    });
  }

  // Check: Scores très disparates (écart > 50 points)
  const scoresArray = Object.values(scores).filter((s): s is number => typeof s === 'number');
  if (scoresArray.length >= 4) {
    const minScore = Math.min(...scoresArray);
    const maxScore = Math.max(...scoresArray);
    if (maxScore - minScore > 50) {
      warnings.push({
        id: 'score_disparity',
        severity: 'MEDIUM',
        category: 'score_coherence',
        description: `Écart important entre scores: min ${minScore}/100, max ${maxScore}/100 (écart: ${maxScore - minScore} points)`,
        affected_data: ['gap.scores.*'],
        recommendation: 'Expliquer les disparités importantes entre dimensions d\'analyse'
      });
    }
  }

  return warnings;
}

/**
 * 2. Validate Strategic Consistency
 * Détecte les contradictions dans l'analyse stratégique (SWOT, recommandations)
 */
export function validateStrategicConsistency(strategic: any, gap: any): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  if (!strategic) return warnings;

  const strengths = strategic.strengths || [];
  const weaknesses = strategic.weaknesses || [];
  const opportunities = strategic.opportunities || [];
  const threats = strategic.threats || [];

  // Patterns contradictoires courants
  const contradictions = [
    { positive: 'emplacement excellent', negative: 'localisation faible' },
    { positive: 'forte concurrence', negative: 'marché peu saturé' },
    { positive: 'excellent état', negative: 'travaux importants' },
    { positive: 'flux élevé', negative: 'zone déserte' },
    { positive: 'bonne réputation', negative: 'avis négatifs' }
  ];

  for (const pattern of contradictions) {
    const hasPositive = strengths.some((s: string) => s.toLowerCase().includes(pattern.positive));
    const hasNegative = weaknesses.some((w: string) => w.toLowerCase().includes(pattern.negative));

    if (hasPositive && hasNegative) {
      warnings.push({
        id: 'swot_contradiction',
        severity: 'MEDIUM',
        category: 'strategic_contradiction',
        description: `Points Forts mentionnent "${pattern.positive}" mais Points Faibles mentionnent "${pattern.negative}"`,
        affected_data: ['strategic.strengths', 'strategic.weaknesses'],
        recommendation: 'Clarifier la nuance ou supprimer la contradiction'
      });
    }
  }

  // Check: Recommandation vs niveau risque
  if (strategic.recommendation === 'GO' && gap?.risk_level === 'critical') {
    warnings.push({
      id: 'recommendation_risk_mismatch',
      severity: 'HIGH',
      category: 'strategic_contradiction',
      description: 'Recommandation GO malgré niveau de risque CRITICAL global',
      affected_data: ['strategic.recommendation', 'gap.risk_level'],
      recommendation: 'Justifier GO malgré les risques ou dégrader vers GO_WITH_RESERVES'
    });
  }

  // Check: Aucune opportunité identifiée
  if (opportunities.length === 0 && strengths.length > 0) {
    warnings.push({
      id: 'missing_opportunities',
      severity: 'LOW',
      category: 'strategic_contradiction',
      description: 'Aucune opportunité identifiée malgré des points forts',
      affected_data: ['strategic.opportunities', 'strategic.strengths'],
      recommendation: 'Identifier des opportunités basées sur les points forts'
    });
  }

  return warnings;
}

/**
 * 3. Validate Risk Justification
 * Vérifie la cohérence entre risques déclarés et scores
 */
export function validateRiskJustification(gap: any, photo: any): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  if (!gap?.risks) return warnings;

  const risks = gap.risks;
  const criticalCount = risks.filter((r: any) => r.severity === 'CRITICAL').length;
  const highCount = risks.filter((r: any) => r.severity === 'HIGH').length;

  // Check: Trop de risques CRITICAL sans scores très bas
  if (criticalCount >= 2 && gap.scores) {
    const minScore = Math.min(
      gap.scores.operational || 100,
      gap.scores.financial || 100,
      gap.scores.market || 100,
      gap.scores.location || 100
    );

    if (minScore >= 30) {
      warnings.push({
        id: 'excessive_critical_risks',
        severity: 'HIGH',
        category: 'risk_justification',
        description: `${criticalCount} risques CRITICAL déclarés mais score minimum ${minScore}/100 (devrait être < 30)`,
        affected_data: ['gap.risks', 'gap.scores'],
        recommendation: 'Dégrader certains risques vers HIGH ou justifier la sévérité critique'
      });
    }
  }

  // Check: Coûts risques vs budget travaux (double counting?)
  const totalRiskCost = risks.reduce((sum: number, r: any) => {
    const costMatch = r.impact?.match(/(\d+(?:,\d+)?)\s*k€/);
    return sum + (costMatch ? parseFloat(costMatch[1].replace(',', '.')) * 1000 : 0);
  }, 0);

  const budgetTravaux = photo?.budget_travaux?.fourchette_haute || 0;

  if (totalRiskCost > budgetTravaux * 2 && budgetTravaux > 0) {
    warnings.push({
      id: 'risk_cost_double_counting',
      severity: 'MEDIUM',
      category: 'risk_justification',
      description: `Coûts risques totaux (${totalRiskCost.toLocaleString('fr-FR')}€) >> Budget travaux (${budgetTravaux.toLocaleString('fr-FR')}€) - possible double comptage`,
      affected_data: ['gap.risks[].impact', 'photo.budget_travaux'],
      recommendation: 'Vérifier que les coûts risques ne dupliquent pas le budget travaux'
    });
  }

  // Check: Aucun risque identifié (suspect)
  if (risks.length === 0) {
    warnings.push({
      id: 'no_risks_identified',
      severity: 'LOW',
      category: 'risk_justification',
      description: 'Aucun risque identifié - suspect pour un commerce',
      affected_data: ['gap.risks'],
      recommendation: 'Vérifier si des risques évidents ont été omis'
    });
  }

  return warnings;
}

/**
 * 4. Validate Data Consistency
 * Vérifie la cohérence interne des données
 */
export function validateDataConsistency(state: any): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  const preparation = state.preparation;
  const demographic = state.demographic;
  const gap = state.gap;

  // Check: GPS matching
  if (preparation?.gps_match_score < 60 && gap?.scores?.location > 70) {
    warnings.push({
      id: 'gps_location_mismatch',
      severity: 'MEDIUM',
      category: 'data_consistency',
      description: `GPS match faible (${preparation.gps_match_score}/100) mais score location élevé (${gap.scores.location}/100)`,
      affected_data: ['preparation.gps_match_score', 'gap.scores.location'],
      recommendation: 'Vérifier la précision des coordonnées ou expliquer le score location malgré le problème GPS'
    });
  }

  // Check: Population zone vs commune
  const tradeAreaPop = demographic?.profile?.trade_area_potential?.walking_500m || 0;
  const communePop = demographic?.commune?.population || 0;

  if (tradeAreaPop > communePop && communePop > 0) {
    warnings.push({
      id: 'population_calculation_error',
      severity: 'HIGH',
      category: 'data_consistency',
      description: `Population zone de chalandise (${tradeAreaPop}) > Population commune (${communePop}) - erreur de calcul`,
      affected_data: ['demographic.profile.trade_area_potential', 'demographic.commune.population'],
      recommendation: 'Corriger l\'algorithme de calcul de la zone de chalandise'
    });
  }

  // Check: Coordonnées manquantes
  if (!preparation?.coordinates || !preparation.coordinates.lat || !preparation.coordinates.lon) {
    warnings.push({
      id: 'missing_coordinates',
      severity: 'HIGH',
      category: 'data_consistency',
      description: 'Coordonnées GPS manquantes - impact sur analyses géographiques',
      affected_data: ['preparation.coordinates'],
      recommendation: 'Vérifier la géolocalisation de l\'adresse'
    });
  }

  return warnings;
}

/**
 * FIX: Validate Score Consistency Between Agents
 * Détecte les écarts entre strategic.score et gap.scores.overall
 */
export function validateScoreConsistency(strategic: any, gap: any): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  if (!strategic?.score || !gap?.scores?.overall) return warnings;

  const strategicScore = strategic.score;
  const gapScore = gap.scores.overall;
  const diff = Math.abs(strategicScore - gapScore);

  // CRITICAL: Score difference > 10 points
  if (diff > 10) {
    warnings.push({
      id: 'strategic_gap_score_mismatch',
      severity: 'HIGH',
      category: 'score_coherence',
      description: `Score Global incohérent: Executive Summary ${strategicScore}/100 vs Scores Détaillés ${gapScore}/100 (écart: ${diff} points)`,
      affected_data: ['strategic.score', 'gap.scores.overall'],
      recommendation: `StrategicAgent doit utiliser gap.scores.overall (${gapScore}/100) comme base au lieu de recalculer (${strategicScore}/100)`
    });
  }

  return warnings;
}

/**
 * Main validation function
 * Exécute toutes les validations et calcule un score de cohérence global
 */
export function validateGlobalConsistency(state: any): ValidationResult {
  const warnings: ValidationWarning[] = [
    ...validateScoreConsistency(state.strategic, state.gap), // FIX: Added score consistency check
    ...validateScoreCoherence(state.gap, state.demographic, state.competitor, state.places),
    ...validateStrategicConsistency(state.strategic, state.gap),
    ...validateRiskJustification(state.gap, state.photo),
    ...validateDataConsistency(state)
  ];

  const errors = warnings.filter(w => w.severity === 'HIGH' && w.category === 'data_consistency');

  // Calculate coherence score
  const highWarnings = warnings.filter(w => w.severity === 'HIGH').length;
  const mediumWarnings = warnings.filter(w => w.severity === 'MEDIUM').length;
  const lowWarnings = warnings.filter(w => w.severity === 'LOW').length;

  const score = Math.max(0, 100 - (highWarnings * 20) - (mediumWarnings * 10) - (lowWarnings * 5));

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
    score
  };
}

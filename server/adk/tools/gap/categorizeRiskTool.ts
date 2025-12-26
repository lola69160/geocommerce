import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import { zToGen } from '../../utils/schemaHelper.js';

/**
 * Categorize Risk Tool
 *
 * Identifie et catégorise les risques selon 4 catégories:
 * 1. LOCATION_RISK (emplacement, accessibilité)
 * 2. MARKET_RISK (concurrence, demande)
 * 3. OPERATIONAL_RISK (état physique, travaux)
 * 4. FINANCIAL_RISK (investissement, rentabilité)
 *
 * Chaque risque est évalué en sévérité (LOW/MEDIUM/HIGH/CRITICAL)
 * avec stratégie de mitigation.
 */

const CategorizeRiskInputSchema = z.object({
  scores: z.object({
    location: z.number(),
    market: z.number(),
    operational: z.number(),
    financial: z.number(),
    overall: z.number()
  }),

  demographic: z.object({
    trade_area_potential: z.object({
      walking_500m: z.number().optional()
    }).optional()
  }).optional(),

  places: z.object({
    found: z.boolean().optional(),
    rating: z.number().nullable().optional()
  }).optional(),

  photo: z.object({
    budget_travaux: z.object({
      fourchette_haute: z.number().optional()
    }).optional()
  }).optional(),

  competitor: z.object({
    total_competitors: z.number().optional(),
    density_level: z.string().optional()
  }).optional(),

  validation: z.object({
    total_conflicts: z.number().optional(),
    blocking_conflicts: z.number().optional()
  }).optional()
});

interface Risk {
  category: 'LOCATION_RISK' | 'MARKET_RISK' | 'OPERATIONAL_RISK' | 'FINANCIAL_RISK';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  impact: string;
  mitigation: string;
  cost_estimate?: number;
}

export const categorizeRiskTool = new FunctionTool({
  name: 'categorizeRisk',
  description: 'Identifie et catégorise risques par type (LOCATION, MARKET, OPERATIONAL, FINANCIAL). Retourne { risks: [...], summary, risk_score }',
  parameters: zToGen(CategorizeRiskInputSchema),

  execute: async (data: z.infer<typeof CategorizeRiskInputSchema>) => {
    const risks: Risk[] = [];

    // === LOCATION RISKS ===
    if (data.scores.location < 50) {
      risks.push({
        category: 'LOCATION_RISK',
        severity: 'HIGH',
        description: 'Emplacement peu favorable (score < 50)',
        impact: 'Difficulté à attirer clientèle, zone de chalandise limitée',
        mitigation: 'Marketing local renforcé, partenariats quartier, offre différenciée'
      });
    }

    if (data.demographic?.trade_area_potential?.walking_500m !== undefined &&
        data.demographic.trade_area_potential.walking_500m < 1000) {
      risks.push({
        category: 'LOCATION_RISK',
        severity: 'MEDIUM',
        description: `Zone de chalandise faible (${data.demographic.trade_area_potential.walking_500m} hab)`,
        impact: 'Trafic piéton limité, dépendance clientèle fidèle',
        mitigation: 'Élargir zone attraction (livraison, parking), commerce de proximité ciblé'
      });
    }

    if (data.places?.found === false) {
      risks.push({
        category: 'LOCATION_RISK',
        severity: 'MEDIUM',
        description: 'Commerce non trouvé dans Google Places',
        impact: 'Visibilité en ligne nulle, difficile à trouver pour nouveaux clients',
        mitigation: 'Créer profil Google Business, optimisation SEO local'
      });
    }

    // === MARKET RISKS ===
    if (data.scores.market < 50) {
      risks.push({
        category: 'MARKET_RISK',
        severity: 'HIGH',
        description: 'Marché peu favorable (score < 50)',
        impact: 'Concurrence forte ou réputation faible, marché saturé',
        mitigation: 'Différenciation produit, repositionnement, amélioration service'
      });
    }

    if (data.competitor?.density_level === 'very_high') {
      risks.push({
        category: 'MARKET_RISK',
        severity: 'HIGH',
        description: `Marché saturé (${data.competitor.total_competitors || 15}+ concurrents)`,
        impact: 'Difficulté à se différencier, guerre des prix',
        mitigation: 'Niche spécialisée, qualité premium, expérience client unique'
      });
    } else if (data.competitor?.density_level === 'high') {
      risks.push({
        category: 'MARKET_RISK',
        severity: 'MEDIUM',
        description: `Concurrence élevée (${data.competitor.total_competitors || 10}+ concurrents)`,
        impact: 'Pression concurrentielle, marges réduites',
        mitigation: 'Positionnement clair, service différencié'
      });
    }

    if (data.places?.found && data.places.rating !== null && data.places.rating !== undefined && data.places.rating < 3.5) {
      risks.push({
        category: 'MARKET_RISK',
        severity: 'HIGH',
        description: `Réputation négative (${data.places.rating}/5)`,
        impact: 'Frein acquisition client, bouche-à-oreille négatif',
        mitigation: 'Audit qualité, amélioration service, gestion avis clients'
      });
    }

    // === OPERATIONAL RISKS ===
    if (data.scores.operational < 50) {
      risks.push({
        category: 'OPERATIONAL_RISK',
        severity: 'HIGH',
        description: 'État opérationnel médiocre (score < 50)',
        impact: 'Travaux importants requis, retard ouverture, coûts élevés',
        mitigation: 'Plan travaux phasé, prioriser sécurité/conformité'
      });
    }

    if (data.photo?.budget_travaux?.fourchette_haute !== undefined) {
      const budget = data.photo.budget_travaux.fourchette_haute;
      if (budget > 75000) {
        risks.push({
          category: 'OPERATIONAL_RISK',
          severity: 'CRITICAL',
          description: `Budget travaux très élevé (${budget.toLocaleString('fr-FR')}€)`,
          impact: 'Investissement initial lourd, délai ROI long, risque financier',
          mitigation: 'Phasage travaux, recherche subventions, négociation prix',
          cost_estimate: budget
        });
      } else if (budget > 50000) {
        risks.push({
          category: 'OPERATIONAL_RISK',
          severity: 'HIGH',
          description: `Budget travaux important (${budget.toLocaleString('fr-FR')}€)`,
          impact: 'Investissement conséquent, impact trésorerie',
          mitigation: 'Étalement travaux, priorisation urgences',
          cost_estimate: budget
        });
      } else if (budget > 25000) {
        risks.push({
          category: 'OPERATIONAL_RISK',
          severity: 'MEDIUM',
          description: `Budget travaux modéré (${budget.toLocaleString('fr-FR')}€)`,
          impact: 'Coûts additionnels à prévoir',
          mitigation: 'Budgétisation précise, marge sécurité 20%',
          cost_estimate: budget
        });
      }
    }

    // === FINANCIAL RISKS ===
    if (data.scores.financial < 50) {
      risks.push({
        category: 'FINANCIAL_RISK',
        severity: 'CRITICAL',
        description: 'Viabilité financière faible (score < 50)',
        impact: 'Rentabilité incertaine, risque échec commercial',
        mitigation: 'Revoir modèle économique, réduire investissement, chercher financement'
      });
    }

    if (data.validation?.blocking_conflicts !== undefined && data.validation.blocking_conflicts > 0) {
      risks.push({
        category: 'FINANCIAL_RISK',
        severity: 'HIGH',
        description: `${data.validation.blocking_conflicts} conflits bloquants non résolus`,
        impact: 'Données incohérentes, décision GO/NO-GO incertaine',
        mitigation: 'Revalidation données, audit terrain, arbitrage conflits'
      });
    }

    if (data.scores.overall < 50) {
      risks.push({
        category: 'FINANCIAL_RISK',
        severity: 'CRITICAL',
        description: 'Score global faible (< 50/100)',
        impact: 'Opportunité peu viable, risques > opportunités',
        mitigation: 'Reconsidérer projet, négocier conditions, revoir stratégie'
      });
    }

    // Calcul risk score global (0-100, inversé: 100 = aucun risque, 0 = risque maximal)
    const criticalCount = risks.filter(r => r.severity === 'CRITICAL').length;
    const highCount = risks.filter(r => r.severity === 'HIGH').length;
    const mediumCount = risks.filter(r => r.severity === 'MEDIUM').length;
    const lowCount = risks.filter(r => r.severity === 'LOW').length;

    const riskScore = Math.max(0, 100 - (criticalCount * 25 + highCount * 15 + mediumCount * 8 + lowCount * 3));

    // Niveau de risque global
    let overallRiskLevel: 'low' | 'moderate' | 'high' | 'critical';
    if (criticalCount > 0) overallRiskLevel = 'critical';
    else if (highCount >= 3) overallRiskLevel = 'critical';
    else if (highCount >= 1) overallRiskLevel = 'high';
    else if (mediumCount >= 2) overallRiskLevel = 'moderate';
    else overallRiskLevel = 'low';

    return {
      risks,
      summary: {
        total_risks: risks.length,
        by_severity: {
          critical: criticalCount,
          high: highCount,
          medium: mediumCount,
          low: lowCount
        },
        by_category: {
          location: risks.filter(r => r.category === 'LOCATION_RISK').length,
          market: risks.filter(r => r.category === 'MARKET_RISK').length,
          operational: risks.filter(r => r.category === 'OPERATIONAL_RISK').length,
          financial: risks.filter(r => r.category === 'FINANCIAL_RISK').length
        }
      },
      risk_score: riskScore,
      overall_risk_level: overallRiskLevel,
      blocking: criticalCount > 0 || highCount >= 2,
      recommendation: overallRiskLevel === 'critical' || overallRiskLevel === 'high'
        ? 'Risques élevés - Mitigation obligatoire avant GO'
        : overallRiskLevel === 'moderate'
        ? 'Risques modérés - Surveillance et mitigation recommandées'
        : 'Risques maîtrisés - Suivi standard'
    };
  }
});

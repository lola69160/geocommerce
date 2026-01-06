import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import { zToGen } from '../../utils/schemaHelper.js';
import { POICategorySchema } from '../../schemas/competitorSchema.js';

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
    density_level: z.string().optional(),
    nearby_poi: z.record(z.string(), POICategorySchema).optional()
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
    // ✅ VALIDATION ROBUSTE - Vérifier que scores existe et est complet
    if (!data || !data.scores || typeof data.scores !== 'object') {
      console.error('[categorizeRisk] ❌ Invalid input: scores object missing or malformed', {
        hasData: !!data,
        hasScores: !!(data && data.scores),
        scoresType: data && data.scores ? typeof data.scores : 'undefined'
      });

      return {
        risks: [],
        summary: {
          total_risks: 0,
          by_severity: { critical: 0, high: 0, medium: 0, low: 0 },
          by_category: { location: 0, market: 0, operational: 0, financial: 0 }
        },
        risk_score: 0,
        overall_risk_level: 'critical' as const,
        blocking: true,
        recommendation: 'ERROR: Invalid input data - cannot assess risks',
        error: 'Invalid input: scores object missing or malformed'
      };
    }

    // ✅ Vérifier que toutes les propriétés scores sont des nombres
    const requiredScores = ['location', 'market', 'operational', 'financial', 'overall'];
    const missingScores = requiredScores.filter(key =>
      typeof data.scores[key as keyof typeof data.scores] !== 'number'
    );

    if (missingScores.length > 0) {
      console.error('[categorizeRisk] ❌ Incomplete scores object', {
        missing: missingScores,
        received: data.scores
      });

      return {
        risks: [],
        summary: {
          total_risks: 0,
          by_severity: { critical: 0, high: 0, medium: 0, low: 0 },
          by_category: { location: 0, market: 0, operational: 0, financial: 0 }
        },
        risk_score: 0,
        overall_risk_level: 'critical' as const,
        blocking: true,
        recommendation: `ERROR: Incomplete scores - missing: ${missingScores.join(', ')}`,
        error: `Incomplete scores object - missing: ${missingScores.join(', ')}`
      };
    }

    console.log('[categorizeRisk] ✅ Input validation passed', {
      scores: data.scores,
      hasDemo: !!data.demographic,
      hasPlaces: !!data.places,
      hasPhoto: !!data.photo,
      hasCompetitor: !!data.competitor,
      hasValidation: !!data.validation
    });

    const risks: Risk[] = [];

    // === LOCATION RISKS ===
    if (data.scores.location < 50) {
      const walkingPop = data.demographic?.trade_area_potential?.walking_500m || 500;
      risks.push({
        category: 'LOCATION_RISK',
        severity: 'HIGH',
        description: `Emplacement peu favorable avec score de ${data.scores.location}/100 ` +
                     `(zone de chalandise ${walkingPop} habitants, visibilité en ligne faible)`,
        impact: `Trafic piéton estimé à ${Math.round(walkingPop * 0.02)} passages/jour (2% de la zone). ` +
                `Difficulté à générer du CA spontané, forte dépendance à la clientèle fidèle. ` +
                `Benchmark: un bon emplacement génère 3-5% de conversion du trafic piéton.`,
        mitigation: `Court terme (0-3 mois): Campagne SEO local + Google Business Profile optimisé (budget 500-1000€). ` +
                    `Moyen terme (3-6 mois): Développer 5-10 partenariats avec commerces du quartier. ` +
                    `Long terme: Offre différenciée pour compenser le faible passage. ` +
                    `KPI: +30% visibilité Google Maps à 3 mois, 15% nouveaux clients via partenariats à 6 mois.`
      });
    }

    if (data.demographic?.trade_area_potential?.walking_500m !== undefined &&
        data.demographic.trade_area_potential.walking_500m < 1000) {
      const walkingPop = data.demographic.trade_area_potential.walking_500m;
      const dailyTraffic = Math.round(walkingPop * 0.02);
      risks.push({
        category: 'LOCATION_RISK',
        severity: 'MEDIUM',
        description: `Zone de chalandise insuffisante avec ${walkingPop} habitants dans un rayon de 500m ` +
                     `(seuil recommandé: 1000+). Densité très faible, potentiel limité.`,
        impact: `Trafic piéton quotidien estimé à ${dailyTraffic} passages (vs 200+ pour un bon emplacement). ` +
                `Dépendance forte sur fidélisation client (LTV doit être 2x plus élevée pour compenser). ` +
                `Risque de fermeture si taux de churn mensuel > 5%.`,
        mitigation: `1) Expansion livraison à domicile (12-18 mois, investissement 5-10k€). ` +
                    `2) Partenariat parking proche (court terme, coût <1k€). ` +
                    `3) Positionnement niche premium pour réduire dépendance au volume (3-6 mois, tests produit + marketing). ` +
                    `Objectif: 20% clients en livraison vs 80% walk-in.`
      });
    }

    if (data.places?.found === false) {
      risks.push({
        category: 'LOCATION_RISK',
        severity: 'MEDIUM',
        description: `Commerce absent de Google Places - invisibilité numérique totale dans un contexte où 70% des consommateurs ` +
                     `recherchent en ligne avant de se déplacer`,
        impact: `Perte estimée de 40-60% des nouveaux clients potentiels qui utilisent Google Maps pour trouver un commerce. ` +
                `Aucune visibilité dans les recherches locales ("commerce près de moi"). ` +
                `Désavantage majeur face à la concurrence présente sur Google.`,
        mitigation: `URGENT - Court terme (semaine 1): Créer profil Google Business Profile complet (gratuit, 2h setup). ` +
                    `Semaine 2-4: Optimisation SEO local (photos, horaires, description, catégories). ` +
                    `Mois 2-3: Campagne avis clients (objectif 10+ avis 4★+). ` +
                    `KPI: Apparition dans top 3 résultats recherche locale à 3 mois, 50+ vues profil/semaine.`
      });
    }

    // === MARKET RISKS ===
    if (data.scores.market < 50) {
      const competitors = data.competitor?.total_competitors || 'plusieurs';
      const rating = data.places?.rating || 'N/A';
      risks.push({
        category: 'MARKET_RISK',
        severity: 'HIGH',
        description: `Marché peu favorable avec score de ${data.scores.market}/100 - ` +
                     `Cumul de facteurs défavorables (concurrence: ${competitors} acteurs, réputation: ${rating}/5)`,
        impact: `Environnement concurrentiel difficile limitant les marges et la croissance. ` +
                `Difficulté à acquérir et retenir des clients dans un marché saturé ou avec mauvaise réputation. ` +
                `Benchmark: marchés score <50 ont taux d'échec 60-70% à 2 ans (vs 35% moyenne).`,
        mitigation: `STRATÉGIE DIFFÉRENCIATION OBLIGATOIRE: ` +
                    `1) Audit concurrentiel approfondi (identifier gaps) - 1-2 semaines, 1500€. ` +
                    `2) Repositionnement sur niche sous-servie ou segment premium - 2-3 mois. ` +
                    `3) Programme amélioration service (formation équipe, process qualité) - 3000€. ` +
                    `4) Si réputation faible: plan reconquête clients (offres, garanties) - 2000€. ` +
                    `KPI: NPS >40, part de marché cible 15%+ à 12 mois.`
      });
    }

    if (data.competitor?.density_level === 'very_high') {
      const competitors = data.competitor.total_competitors || 15;
      const marketShare = (100 / (competitors + 1)).toFixed(0);

      // Extraire détails concurrents depuis nearby_poi
      const nearbyPoi = data.competitor?.nearby_poi || {};
      const poiArray = Object.values(nearbyPoi) as any[];

      const closestCompetitors = poiArray
        .filter((poi: any) => poi.proximity_level === 'immediate' || poi.proximity_level === 'very_close')
        .sort((a: any, b: any) => a.distance_meters - b.distance_meters)
        .slice(0, 5);

      const competitorDetails = closestCompetitors.length > 0
        ? closestCompetitors
            .map((poi: any) => {
              const distance = Math.round(poi.distance_meters);
              const rating = poi.rating ? ` (${poi.rating}/5)` : '';
              return `${poi.name} à ${distance}m${rating}`;
            })
            .join(', ')
        : 'Détails non disponibles';

      risks.push({
        category: 'MARKET_RISK',
        severity: 'HIGH',
        description: `Marché saturé avec ${competitors} concurrents identifiés dans rayon 200m - ` +
                     `Densité commerciale très élevée, guerre des prix inévitable. ` +
                     `Concurrents directs (<200m): ${competitorDetails}`,
        impact: `Part de marché équilibrée théorique: ${marketShare}% (1/${competitors + 1} acteurs). ` +
                `Pression prix forte (-15 à -25% marges vs marché normal). ` +
                `Difficulté extrême à se différencier, risque de banalisation et faible rentabilité. ` +
                `Taux de survie 5 ans: <30% dans marchés saturés.`,
        mitigation: `STRATÉGIE HYPER-SPÉCIALISÉE REQUISE: ` +
                    `1) Micro-niche exclusive (produits rares, expertise pointue) - Étude: 2000€. ` +
                    `2) Qualité ultra-premium justifiant prix +20-30% vs concurrence - Sourcing: 3-6 mois. ` +
                    `3) Expérience client exceptionnelle (conseil expert, SAV irréprochable) - Formation: 3000€. ` +
                    `4) Événements/animations régulières pour créer communauté - 500€/mois. ` +
                    `KPI: 80% clients citent différenciation, panier moyen +25% vs concurrence, taux réachat >40%.`
      });
    } else if (data.competitor?.density_level === 'high') {
      const competitors = data.competitor.total_competitors || 10;
      const marketShare = (100 / (competitors + 1)).toFixed(0);

      // Extraire détails concurrents depuis nearby_poi
      const nearbyPoi = data.competitor?.nearby_poi || {};
      const poiArray = Object.values(nearbyPoi) as any[];

      const closestCompetitors = poiArray
        .filter((poi: any) => poi.proximity_level === 'immediate' || poi.proximity_level === 'very_close')
        .sort((a: any, b: any) => a.distance_meters - b.distance_meters)
        .slice(0, 5);

      const competitorDetails = closestCompetitors.length > 0
        ? closestCompetitors
            .map((poi: any) => {
              const distance = Math.round(poi.distance_meters);
              const rating = poi.rating ? ` (${poi.rating}/5)` : '';
              return `${poi.name} à ${distance}m${rating}`;
            })
            .join(', ')
        : 'Détails non disponibles';

      risks.push({
        category: 'MARKET_RISK',
        severity: 'MEDIUM',
        description: `Concurrence élevée avec ${competitors} acteurs identifiés dans rayon 200m, ` +
                     `nécessitant différenciation claire pour se démarquer. ` +
                     `Concurrents directs (<200m): ${competitorDetails}`,
        impact: `Part de marché équilibrée théorique: ${marketShare}% (1/${competitors + 1} acteurs). ` +
                `Pression prix significative (-10 à -20% marges potentielles). ` +
                `Risque de banalisation si pas d'USP forte. ` +
                `Nécessité de se démarquer pour capter 15-20% du marché local.`,
        mitigation: `Développer 2-3 piliers de différenciation: ` +
                    `1) Expertise reconnue (formation équipe, conseil personnalisé) - Budget: 2000€. ` +
                    `2) Service augmenté (SAV premium, garanties étendues, programme fidélité) - Setup: 1500€. ` +
                    `3) Expérience client premium (merchandising soigné, événements) - 1000€/mois. ` +
                    `Communication locale axée sur USP - Lancement: 2000€. ` +
                    `KPI: NPS >50, taux réachat >35%, 2+ reviews mentionnant différenciation par mois.`
      });
    }

    if (data.places?.found && data.places.rating !== null && data.places.rating !== undefined && data.places.rating < 3.5) {
      const rating = data.places.rating;
      const gap = (3.5 - rating).toFixed(1);
      risks.push({
        category: 'MARKET_RISK',
        severity: 'HIGH',
        description: `Réputation négative avec note de ${rating}/5 sur Google (écart de ${gap} points vs seuil acceptable de 3.5/5) - ` +
                     `Signal d'alarme fort sur qualité perçue`,
        impact: `Perte estimée de 60-80% des clients potentiels qui consultent les avis avant achat. ` +
                `Bouche-à-oreille négatif amplifié par internet (1 client insatisfait = 10+ personnes informées). ` +
                `Difficulté d'acquisition majeure: coût acquisition client (CAC) 3-4x plus élevé qu'avec bonne réputation. ` +
                `Benchmark: commerces <3.5/5 ont chiffre d'affaires -40% vs commerces 4+/5.`,
        mitigation: `PLAN RECONQUÊTE RÉPUTATION URGENT: ` +
                    `1) Audit qualité complet (mystery shopping, analyse avis négatifs) - Semaine 1, 1500€. ` +
                    `2) Corrections opérationnelles immédiates (points faibles identifiés) - Mois 1-2. ` +
                    `3) Formation équipe service client (gestion conflits, satisfaction) - 2000€. ` +
                    `4) Campagne avis positifs (clients satisfaits) + réponses professionnelles aux critiques - Mois 2-6. ` +
                    `5) Offres de reconquête pour clients déçus (remises, garanties) - 1000€. ` +
                    `KPI: +0.5 point rating tous les 3 mois, 80% nouveaux avis ≥4★, taux réponse 100%.`
      });
    }

    // === OPERATIONAL RISKS ===
    if (data.scores.operational < 50) {
      const budget = data.photo?.budget_travaux?.fourchette_haute || 0;
      risks.push({
        category: 'OPERATIONAL_RISK',
        severity: 'HIGH',
        description: `État opérationnel médiocre avec score de ${data.scores.operational}/100 - ` +
                     `Travaux significatifs requis${budget > 0 ? ` (budget estimé: ${budget.toLocaleString('fr-FR')}€)` : ''}`,
        impact: `Retard d'ouverture estimé à 2-4 mois (vs 2-4 semaines normal). ` +
                     `Coûts cachés potentiels +20-30% sur estimations initiales (découvertes en cours de travaux). ` +
                     `Risque de non-conformité réglementaire (accessibilité, sécurité incendie). ` +
                     `Perte de CA pendant fermeture: ${Math.round(15000 * 3).toLocaleString('fr-FR')}€ estimé (3 mois × 15k€/mois).`,
        mitigation: `PLAN TRAVAUX STRUCTURÉ OBLIGATOIRE: ` +
                    `1) Audit technique complet (conformité, état) par bureau d'études - 2-3k€. ` +
                    `2) Phasage strict: Urgents/Sécurité (M1), Conformité (M2), Aménagement (M3). ` +
                    `3) Recherche subventions ANAH, région (30-50% travaux éligibles) - Dossier: 1 mois. ` +
                    `4) Buffer budget +25% imprévus + calendrier +20% délais. ` +
                    `5) Maintien activité partielle si possible (zone test, e-commerce). ` +
                    `KPI: Respect planning ±10%, budget ±15%, aucune non-conformité à ouverture.`
      });
    }

    if (data.photo?.budget_travaux?.fourchette_haute !== undefined) {
      const budget = data.photo.budget_travaux.fourchette_haute;
      if (budget > 75000) {
        const monthlyPayment = Math.round(budget * 0.8 / 84);
        const subsidyPotential = Math.round(budget * 0.35);
        risks.push({
          category: 'OPERATIONAL_RISK',
          severity: 'CRITICAL',
          description: `Budget travaux très élevé de ${budget.toLocaleString('fr-FR')}€ - ` +
                       `Investissement initial majeur nécessitant plan de financement robuste`,
          impact: `Investissement lourd représentant 40-60% du budget acquisition total. ` +
                  `Délai de retour sur investissement (ROI) estimé à 4-6 ans (vs 2-3 ans normal). ` +
                  `Risque financier élevé: trésorerie sous tension pendant 12-18 mois. ` +
                  `Impact sur rentabilité: point mort repoussé de 6-12 mois.`,
          mitigation: `CRITIQUE - Plan de financement structuré OBLIGATOIRE: ` +
                      `1) Subventions publiques maximales (ANAH 30-50%, région 15-30%) - Potentiel: ${subsidyPotential.toLocaleString('fr-FR')}€. ` +
                      `2) Prêt bancaire garanti BPI (taux 2-3%, durée 7 ans) - Mensualité estimée: ${monthlyPayment.toLocaleString('fr-FR')}€/mois. ` +
                      `3) Phasage strict: Urgents M1-2, Recommandés M6-12, Optionnels An2+. ` +
                      `4) Négociation fournisseurs intensive (-15 à -25% objectif, paiement différé 90j). ` +
                      `5) Maintien activité partielle pendant travaux pour limiter perte de CA. ` +
                      `KPI: Financement externe >40% du budget, ROI <36 mois, trésorerie 6 mois sécurisée.`,
          cost_estimate: budget
        });
      } else if (budget > 50000) {
        const monthlyPayment = Math.round(budget * 0.8 / 84);
        const subsidyPotential = Math.round(budget * 0.30);
        risks.push({
          category: 'OPERATIONAL_RISK',
          severity: 'HIGH',
          description: `Budget travaux important de ${budget.toLocaleString('fr-FR')}€ - ` +
                       `Investissement conséquent nécessitant financement structuré`,
          impact: `Investissement représentant 25-40% du budget total. ` +
                  `Impact significatif sur trésorerie pendant 6-12 mois. ` +
                  `ROI estimé à 3-4 ans. Risque de sous-capitalisation si pas d'apport suffisant.`,
          mitigation: `Plan de financement recommandé: ` +
                      `1) Subventions publiques (ANAH, région) - Potentiel: ${subsidyPotential.toLocaleString('fr-FR')}€ (30% budget). ` +
                      `2) Prêt professionnel (7 ans) - Mensualité: ${monthlyPayment.toLocaleString('fr-FR')}€/mois. ` +
                      `3) Étalement sur 12 mois: urgents puis recommandés. ` +
                      `4) Négociation -10 à -15% fournisseurs. ` +
                      `5) Buffer trésorerie 6 mois minimum. ` +
                      `KPI: Financement externe >30%, trésorerie jamais <3 mois de charges.`,
          cost_estimate: budget
        });
      } else if (budget > 25000) {
        risks.push({
          category: 'OPERATIONAL_RISK',
          severity: 'MEDIUM',
          description: `Budget travaux modéré de ${budget.toLocaleString('fr-FR')}€ - ` +
                       `Investissement gérable avec budgétisation rigoureuse`,
          impact: `Investissement représentant 10-20% du budget total. ` +
                  `Impact modéré sur trésorerie (3-6 mois). ` +
                  `ROI estimé à 2-3 ans. Risque limité si apport personnel >30%.`,
          mitigation: `Approche prudente recommandée: ` +
                      `1) Budgétisation détaillée poste par poste avec marge sécurité 20%. ` +
                      `2) Priorisation: travaux urgents vs recommandés vs optionnels. ` +
                      `3) Recherche subventions locales possibles (5-15% du budget). ` +
                      `4) Négociation fournisseurs pour optimiser coûts (-5 à -10%). ` +
                      `5) Phasage sur 6 mois pour lisser impact trésorerie. ` +
                      `KPI: Respect budget ±10%, pas de dépassement sur urgents, trésorerie >3 mois.`,
          cost_estimate: budget
        });
      }
    }

    // === FINANCIAL RISKS ===
    if (data.scores.financial < 50) {
      const locationScore = data.scores.location;
      const marketScore = data.scores.market;
      const operationalScore = data.scores.operational;
      const factors: string[] = [];
      if (locationScore < 50) factors.push('emplacement faible');
      if (marketScore < 50) factors.push('marché défavorable');
      if (operationalScore < 50) factors.push('travaux importants');
      const factorsList = factors.length > 0 ? factors.join(', ') : 'multiples facteurs négatifs';

      risks.push({
        category: 'FINANCIAL_RISK',
        severity: 'CRITICAL',
        description: `Viabilité financière très incertaine avec score de ${data.scores.financial}/100 - ` +
                     `Cumul de facteurs défavorables (${factorsList}) compromettant la rentabilité`,
        impact: `Probabilité d'échec commercial élevée >70% selon cumul de facteurs négatifs. ` +
                `Rentabilité incertaine même à horizon 3-5 ans. Risque de perte totale de l'investissement. ` +
                `Benchmark secteur: commerces avec score financier <50 ont un taux de survie à 5 ans <25% (vs 50% moyenne).`,
        mitigation: `DÉCISION CRITIQUE - 3 options stratégiques à évaluer: ` +
                    `Option A) GO CONDITIONNEL: Négocier -40% prix acquisition minimum, travaux à charge vendeur, investissement total plafonné à 80k€ max. ` +
                    `Option B) PIVOT MODÈLE: Revoir concept économique complet (étude de marché approfondie 3000€, 4-6 semaines). ` +
                    `Option C) NO-GO: Rechercher opportunité plus favorable dans secteur avec meilleurs fondamentaux. ` +
                    `Prérequis GO: Business plan 3 ans détaillé, seuil de rentabilité <12 mois, trésorerie sécurisée 6 mois minimum. ` +
                    `KPI décision: Marge brute cible >40%, CA break-even <15k€/mois, apport personnel >30% de l'investissement.`
      });
    }

    if (data.validation?.blocking_conflicts !== undefined && data.validation.blocking_conflicts > 0) {
      const conflictCount = data.validation.blocking_conflicts;
      const totalConflicts = data.validation.total_conflicts || conflictCount;
      risks.push({
        category: 'FINANCIAL_RISK',
        severity: 'HIGH',
        description: `${conflictCount} conflits de données bloquants non résolus ` +
                     `(sur ${totalConflicts} conflits totaux détectés) - Fiabilité de l'analyse compromise`,
        impact: `Données incohérentes rendant toute décision GO/NO-GO hautement incertaine. ` +
                `Risque de décision basée sur informations erronées (ex: adresse incorrecte, données financières fausses). ` +
                `Conflits bloquants indiquent contradictions majeures nécessitant vérification terrain. ` +
                `Probabilité d'erreur stratégique: >50% si décision prise sans résolution.`,
        mitigation: `RÉSOLUTION OBLIGATOIRE AVANT DÉCISION: ` +
                    `1) Revalidation exhaustive des données sources (48-72h) - Croiser OpenData, BODACC, Google Places, cadastre. ` +
                    `2) Audit terrain systématique (visite physique, photos, mesures) - 1-2 jours. ` +
                    `3) Arbitrage manuel des conflits par ordre de criticité (adresse > financier > descriptif). ` +
                    `4) Si conflits persistent: investigation poussée (mairie, propriétaire, voisins) - 1 semaine. ` +
                    `5) Documentation complète des arbitrages et niveau de confiance final. ` +
                    `KPI: 100% conflits bloquants résolus, niveau confiance données >90%, 0 contradiction majeure.`
      });
    }

    if (data.scores.overall < 50) {
      const overallScore = data.scores.overall;
      const gap = (50 - overallScore).toFixed(0);
      risks.push({
        category: 'FINANCIAL_RISK',
        severity: 'CRITICAL',
        description: `Score global très faible de ${overallScore}/100 (écart de ${gap} points vs seuil minimal de 50) - ` +
                     `Opportunité commerciale hautement défavorable avec risques largement supérieurs aux opportunités`,
        impact: `Viabilité économique extrêmement compromise selon analyse multi-critères (location, marché, opérationnel, financier). ` +
                `Combinaison de facteurs défavorables créant synergie négative. ` +
                `Probabilité de succès commercial <20% dans ces conditions. ` +
                `Benchmark: opportunités score <50 génèrent perte moyenne de 60-80% de l'investissement à 3 ans.`,
        mitigation: `RECOMMANDATION FORTE: RECONSIDÉRATION MAJEURE DU PROJET. ` +
                    `Scénario 1) NO-GO: Abandonner cette opportunité, rechercher commerce avec score >60 (risque acceptable). ` +
                    `Scénario 2) RENÉGOCIATION DRASTIQUE: Prix acquisition -50%, travaux vendeur, conditions suspensives strictes. ` +
                    `Scénario 3) TRANSFORMATION COMPLÈTE: Pivot modèle économique radical (changement activité, positionnement). ` +
                    `Scénario 4) ANALYSE APPROFONDIE: Audit externe indépendant (10-15k€) pour valider/invalider décision. ` +
                    `NE PAS PROCÉDER sans amélioration substantielle conditions ou score global. ` +
                    `KPI garde-fou: Score global >55, max 1 risque CRITICAL, apport <40% patrimoine, plan B défini.`
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

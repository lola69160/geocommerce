import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import { zToGen } from '../../utils/schemaHelper.js';

/**
 * Ask Clarification Tool
 *
 * Permet au StrategicAgent de poser des questions ciblées
 * aux autres agents pour obtenir des détails supplémentaires
 * ou des clarifications sur leurs analyses.
 *
 * Étant donné que les agents s'exécutent séquentiellement,
 * cet outil analyse les outputs existants dans le state
 * et génère des réponses clarificatrices intelligentes.
 *
 * Questions supportées par agent:
 * - PhotoAgent: Nature travaux urgents, détails budget
 * - CompetitorAgent: Prix moyens, types concurrents
 * - DemographicAgent: Détails CSP, saisonnalité
 * - PlacesAgent: Détails avis, problèmes récurrents
 */

const AskClarificationInputSchema = z.object({
  targetAgent: z.enum(['photo', 'competitor', 'demographic', 'places']).describe('Agent cible pour la clarification'),
  question: z.string().describe('Question spécifique à poser'),
  context: z.record(z.string(), z.any()).optional().describe('Contexte additionnel pour la question'),
  agentData: z.any().describe('Données de l\'agent cible depuis le state')
});

/**
 * Clarifie les données PhotoAgent
 */
function clarifyPhotoAgent(question: string, photoData: any): string {
  if (!photoData || !photoData.analyzed) {
    return 'Aucune analyse photo disponible pour clarification.';
  }

  const lowerQuestion = question.toLowerCase();

  // Clarification: Nature des travaux urgents
  if (lowerQuestion.includes('travaux urgents') || lowerQuestion.includes('urgent')) {
    const urgentWorks = photoData.travaux?.urgents || [];

    if (urgentWorks.length === 0) {
      return 'Aucun travaux urgent identifié.';
    }

    // Analyse sémantique des travaux urgents
    const safetyKeywords = ['électricité', 'électrique', 'conformité', 'sécurité', 'norme', 'mise aux normes', 'installation'];
    const aestheticKeywords = ['peinture', 'décoration', 'esthétique', 'vitrine', 'façade', 'apparence'];

    let safetyCount = 0;
    let aestheticCount = 0;

    urgentWorks.forEach((work: string) => {
      const workLower = work.toLowerCase();
      if (safetyKeywords.some(kw => workLower.includes(kw))) safetyCount++;
      if (aestheticKeywords.some(kw => workLower.includes(kw))) aestheticCount++;
    });

    let answer = `Analyse de ${urgentWorks.length} travaux urgents:\n`;
    answer += `- SÉCURITÉ/CONFORMITÉ: ${safetyCount} travaux (${Math.round(safetyCount/urgentWorks.length*100)}%)\n`;
    answer += `- ESTHÉTIQUE/COMMERCIAL: ${aestheticCount} travaux (${Math.round(aestheticCount/urgentWorks.length*100)}%)\n`;

    if (safetyCount > aestheticCount) {
      answer += '\nCONCLUSION: Travaux urgents majoritairement SÉCURITÉ - Bloquants pour ouverture.';
    } else if (aestheticCount > safetyCount) {
      answer += '\nCONCLUSION: Travaux urgents majoritairement ESTHÉTIQUE - Amélioreraient attractivité.';
    } else {
      answer += '\nCONCLUSION: Mix équilibré sécurité/esthétique.';
    }

    answer += `\nDétail: ${urgentWorks.join(', ')}`;
    return answer;
  }

  // Clarification: Budget travaux détaillé
  if (lowerQuestion.includes('budget') || lowerQuestion.includes('coût') || lowerQuestion.includes('prix')) {
    const budget = photoData.budget_travaux;
    if (!budget) {
      return 'Aucune estimation budget disponible.';
    }

    let answer = `Budget travaux estimé:\n`;
    answer += `- Fourchette: ${budget.fourchette_basse?.toLocaleString('fr-FR')}€ - ${budget.fourchette_haute?.toLocaleString('fr-FR')}€\n`;

    if (budget.detail_postes && budget.detail_postes.length > 0) {
      answer += '\nDétail par poste:\n';
      budget.detail_postes
        .sort((a: any, b: any) => b.montant_max - a.montant_max)
        .forEach((poste: any) => {
          answer += `  • ${poste.categorie}: ${poste.montant_min?.toLocaleString('fr-FR')}€ - ${poste.montant_max?.toLocaleString('fr-FR')}€ (${poste.priorite})\n`;
        });
    }

    return answer;
  }

  // Clarification: État général détaillé
  if (lowerQuestion.includes('état') || lowerQuestion.includes('condition')) {
    const etat = photoData.etat_general;
    if (!etat) {
      return 'Aucune évaluation état disponible.';
    }

    let answer = `État général du commerce (note: ${etat.note_globale}/10):\n`;
    answer += `- Devanture: ${etat.devanture}\n`;
    answer += `- Intérieur: ${etat.interieur}\n`;
    answer += `- Équipement: ${etat.equipement}\n`;

    if (photoData.points_forts) {
      answer += `\nPoints forts: ${photoData.points_forts.join(', ')}`;
    }
    if (photoData.points_faibles) {
      answer += `\nPoints faibles: ${photoData.points_faibles.join(', ')}`;
    }

    return answer;
  }

  return `Question "${question}" non reconnue pour PhotoAgent. Questions supportées: travaux urgents, budget, état.`;
}

/**
 * Clarifie les données CompetitorAgent
 */
function clarifyCompetitorAgent(question: string, competitorData: any): string {
  if (!competitorData) {
    return 'Aucune analyse concurrentielle disponible.';
  }

  const lowerQuestion = question.toLowerCase();

  // Clarification: Prix moyens pratiqués
  if (lowerQuestion.includes('prix') || lowerQuestion.includes('tarif') || lowerQuestion.includes('pricing')) {
    const nearbyPOI = competitorData.nearby_poi || {};
    const priceLevels: number[] = [];

    Object.values(nearbyPOI).forEach((poi: any) => {
      if (poi.priceLevel !== undefined && poi.priceLevel !== null) {
        priceLevels.push(poi.priceLevel);
      }
    });

    if (priceLevels.length === 0) {
      return 'Aucune information pricing disponible sur les concurrents.';
    }

    const avgPrice = priceLevels.reduce((a, b) => a + b, 0) / priceLevels.length;
    const distribution = [0, 0, 0, 0, 0]; // Index 0-4 for price levels

    priceLevels.forEach(level => distribution[level]++);

    let answer = `Analyse pricing concurrentiel (${priceLevels.length} établissements):\n`;
    answer += `- Prix moyen: ${avgPrice.toFixed(1)}/4\n`;
    answer += `\nDistribution:\n`;
    answer += `  • Discount (1): ${distribution[1]} établissements (${Math.round(distribution[1]/priceLevels.length*100)}%)\n`;
    answer += `  • Modéré (2): ${distribution[2]} établissements (${Math.round(distribution[2]/priceLevels.length*100)}%)\n`;
    answer += `  • Élevé (3): ${distribution[3]} établissements (${Math.round(distribution[3]/priceLevels.length*100)}%)\n`;
    answer += `  • Premium (4): ${distribution[4]} établissements (${Math.round(distribution[4]/priceLevels.length*100)}%)\n`;

    return answer;
  }

  // Clarification: Types de concurrents
  if (lowerQuestion.includes('type') || lowerQuestion.includes('concurrent') || lowerQuestion.includes('catégorie')) {
    const nearbyPOI = competitorData.nearby_poi || {};
    const typeCount: Record<string, number> = {};

    Object.values(nearbyPOI).forEach((poi: any) => {
      const types = poi.types || [];
      types.forEach((type: string) => {
        typeCount[type] = (typeCount[type] || 0) + 1;
      });
    });

    const sortedTypes = Object.entries(typeCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    let answer = `Types de commerces à proximité (top 10):\n`;
    sortedTypes.forEach(([type, count]) => {
      answer += `  • ${type}: ${count}\n`;
    });

    return answer;
  }

  // Clarification: Densité concurrentielle
  if (lowerQuestion.includes('densité') || lowerQuestion.includes('concentration')) {
    const totalPOI = competitorData.total_competitors || 0;
    let answer = `Densité concurrentielle:\n`;
    answer += `- Total POI à proximité: ${totalPOI}\n`;

    if (totalPOI === 0) {
      answer += '- Niveau: TRÈS FAIBLE - Zone isolée ou données GPS incorrectes';
    } else if (totalPOI < 5) {
      answer += '- Niveau: FAIBLE - Peu de concurrence directe';
    } else if (totalPOI < 15) {
      answer += '- Niveau: MODÉRÉ - Concurrence normale';
    } else if (totalPOI < 30) {
      answer += '- Niveau: ÉLEVÉ - Zone commerciale active';
    } else {
      answer += '- Niveau: TRÈS ÉLEVÉ - Zone commerciale dense/saturée';
    }

    return answer;
  }

  return `Question "${question}" non reconnue pour CompetitorAgent. Questions supportées: prix, types concurrents, densité.`;
}

/**
 * Clarifie les données DemographicAgent
 */
function clarifyDemographicAgent(question: string, demographicData: any): string {
  if (!demographicData) {
    return 'Aucune analyse démographique disponible.';
  }

  const lowerQuestion = question.toLowerCase();

  // Clarification: Détails CSP
  if (lowerQuestion.includes('csp') || lowerQuestion.includes('socio')) {
    const cspProfile = demographicData.csp_profile;
    if (!cspProfile) {
      return 'Aucun profil CSP disponible.';
    }

    let answer = `Profil socio-professionnel:\n`;
    answer += `- Dominant: ${cspProfile.dominant}\n`;
    answer += `- CSP+: ${cspProfile.high_percentage}%\n`;
    answer += `- CSP moyen: ${cspProfile.middle_percentage}%\n`;
    answer += `- CSP modeste: ${cspProfile.low_percentage}%\n`;

    return answer;
  }

  // Clarification: Potentiel zone de chalandise
  if (lowerQuestion.includes('potentiel') || lowerQuestion.includes('chalandise') || lowerQuestion.includes('population')) {
    const tradeArea = demographicData.trade_area_potential;
    if (!tradeArea) {
      return 'Aucune donnée zone de chalandise disponible.';
    }

    let answer = `Potentiel zone de chalandise:\n`;
    answer += `- 500m (piéton 5min): ${tradeArea.walking_500m?.toLocaleString('fr-FR') || 'N/A'} habitants\n`;
    answer += `- 1km (piéton 10min): ${tradeArea.walking_1km?.toLocaleString('fr-FR') || 'N/A'} habitants\n`;

    return answer;
  }

  return `Question "${question}" non reconnue pour DemographicAgent. Questions supportées: CSP, potentiel, population.`;
}

/**
 * Clarifie les données PlacesAgent
 */
function clarifyPlacesAgent(question: string, placesData: any): string {
  if (!placesData || !placesData.found) {
    return 'Aucune donnée Google Places disponible.';
  }

  const lowerQuestion = question.toLowerCase();

  // Clarification: Analyse des avis
  if (lowerQuestion.includes('avis') || lowerQuestion.includes('review') || lowerQuestion.includes('problème')) {
    const reviews = placesData.reviews || [];

    if (reviews.length === 0) {
      return 'Aucun avis disponible.';
    }

    // Analyse sentiments et thèmes récurrents
    const ratings = reviews.map((r: any) => r.rating);
    const avgRating = ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length;

    let answer = `Analyse de ${reviews.length} avis:\n`;
    answer += `- Note moyenne: ${avgRating.toFixed(1)}/5\n`;
    answer += `- Distribution: ${ratings.filter((r: number) => r >= 4).length} positifs, ${ratings.filter((r: number) => r <= 2).length} négatifs\n`;

    // Échantillon d'avis récents
    answer += `\nAvis récents:\n`;
    reviews.slice(0, 3).forEach((review: any) => {
      const text = review.text.substring(0, 100);
      answer += `  • ${review.rating}⭐ - ${text}...\n`;
    });

    return answer;
  }

  // Clarification: Réputation globale
  if (lowerQuestion.includes('réputation') || lowerQuestion.includes('image')) {
    let answer = `Réputation Google Places:\n`;
    answer += `- Note: ${placesData.rating || 'N/A'}/5\n`;
    answer += `- Nombre d'avis: ${placesData.userRatingsTotal || 0}\n`;
    answer += `- Statut: ${placesData.businessStatus}\n`;

    if (placesData.rating >= 4.0) {
      answer += '\n→ EXCELLENTE réputation';
    } else if (placesData.rating >= 3.0) {
      answer += '\n→ Réputation CORRECTE';
    } else {
      answer += '\n→ Réputation MÉDIOCRE - Points d\'amélioration nécessaires';
    }

    return answer;
  }

  return `Question "${question}" non reconnue pour PlacesAgent. Questions supportées: avis, réputation.`;
}

export const askClarificationTool = new FunctionTool({
  name: 'askClarification',
  description: 'Demande clarification à un agent spécifique (photo, competitor, demographic, places). Retourne { agent, question, answer, confidence }',
  parameters: zToGen(AskClarificationInputSchema),

  execute: async ({ targetAgent, question, context, agentData }: z.infer<typeof AskClarificationInputSchema>) => {
    let answer: string;
    let confidence: number;

    try {
      switch (targetAgent) {
        case 'photo':
          answer = clarifyPhotoAgent(question, agentData);
          confidence = agentData?.analyzed ? 0.85 : 0.3;
          break;

        case 'competitor':
          answer = clarifyCompetitorAgent(question, agentData);
          confidence = agentData ? 0.80 : 0.3;
          break;

        case 'demographic':
          answer = clarifyDemographicAgent(question, agentData);
          confidence = agentData ? 0.90 : 0.3;
          break;

        case 'places':
          answer = clarifyPlacesAgent(question, agentData);
          confidence = agentData?.found ? 0.85 : 0.3;
          break;

        default:
          answer = `Agent cible "${targetAgent}" non reconnu.`;
          confidence = 0.0;
      }
    } catch (error: any) {
      answer = `Erreur lors de la clarification: ${error.message}`;
      confidence = 0.0;
    }

    return {
      agent: targetAgent,
      question,
      answer,
      confidence,
      context: context || {},
      timestamp: new Date().toISOString()
    };
  }
});

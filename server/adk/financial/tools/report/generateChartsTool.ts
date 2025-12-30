import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';

/**
 * Generate Charts Tool
 *
 * Génère les configurations Chart.js pour les graphiques du rapport financier :
 * - Évolution CA/EBE/RN sur 3 ans (line chart)
 * - Fourchettes de valorisation (bar chart horizontal)
 * - Gauge score de santé financière
 * - Score de confiance par section (radar chart)
 */

const GenerateChartsInputSchema = z.object({
  debug: z.boolean().optional().describe('Mode debug pour logs détaillés')
});

const GenerateChartsOutputSchema = z.object({
  evolutionChart: z.object({
    type: z.string(),
    data: z.any(),
    options: z.any()
  }),
  valorisationChart: z.object({
    type: z.string(),
    data: z.any(),
    options: z.any()
  }),
  healthGauge: z.object({
    type: z.string(),
    data: z.any(),
    options: z.any()
  }),
  confidenceRadar: z.object({
    type: z.string(),
    data: z.any(),
    options: z.any()
  }),
  error: z.string().optional()
});

export const generateChartsTool = new FunctionTool({
  name: 'generateCharts',
  description: 'Génère les configurations Chart.js pour les graphiques du rapport financier (évolution, valorisation, santé, confiance)',
  parameters: zToGen(GenerateChartsInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    try {
      // Lire les states
      let comptable = parseState(toolContext?.state.get('comptable'));
      let valorisation = parseState(toolContext?.state.get('valorisation'));
      let financialValidation = parseState(toolContext?.state.get('financialValidation'));

      // CHART 1 : Évolution CA/EBE/RN sur 3 ans (Line chart)
      const evolutionChart = generateEvolutionChart(comptable);

      // CHART 2 : Fourchettes de valorisation (Horizontal bar chart)
      const valorisationChart = generateValorisationChart(valorisation);

      // CHART 3 : Gauge score de santé (Doughnut chart)
      const healthGauge = generateHealthGauge(comptable);

      // ✅ ADD: CHART 3b : Projected health gauge (if business plan exists)
      let projectedHealthGauge = null;
      let businessPlan = parseState(toolContext?.state.get('businessPlan'));
      if (businessPlan?.projectedHealthScore) {
        projectedHealthGauge = generateProjectedHealthGauge(businessPlan.projectedHealthScore);
      }

      // CHART 4 : Radar confiance par section
      const confidenceRadar = generateConfidenceRadar(financialValidation);

      return {
        evolutionChart,
        valorisationChart,
        healthGauge,
        projectedHealthGauge, // ✅ ADD
        confidenceRadar
      };

    } catch (error: any) {
      return {
        evolutionChart: getDefaultChart(),
        valorisationChart: getDefaultChart(),
        healthGauge: getDefaultChart(),
        confidenceRadar: getDefaultChart(),
        error: error.message || 'Chart generation failed'
      };
    }
  }
});

/**
 * Génère le graphique d'évolution CA/EBE/RN
 */
function generateEvolutionChart(comptable: any): any {
  if (!comptable?.sig) {
    return getDefaultChart();
  }

  const years = Object.keys(comptable.sig).sort();

  // Handle partial data gracefully (1, 2, or 3 years)
  if (years.length === 0) {
    return getDefaultChart();
  }

  // Helper to extract value (handle {valeur, pct_ca} format)
  const extractValue = (rawValue: any) => {
    if (typeof rawValue === 'object' && rawValue !== null) {
      return rawValue.valeur !== undefined ? rawValue.valeur : 0;
    }
    return rawValue || 0;
  };

  const ca = years.map(y => extractValue(comptable.sig[y]?.chiffre_affaires) / 1000); // En milliers d'€
  const ebe = years.map(y => extractValue(comptable.sig[y]?.ebe) / 1000);
  const rn = years.map(y => extractValue(comptable.sig[y]?.resultat_net) / 1000);

  // ✅ ADD: Frais de Personnel (salaires + charges sociales)
  const fraisPersonnel = years.map(y => {
    const salaires = extractValue(comptable.sig[y]?.salaires_personnel) || 0;
    const chargesSociales = extractValue(comptable.sig[y]?.charges_sociales_personnel) || 0;
    return (salaires + chargesSociales) / 1000;
  });

  // ✅ ADD: Charges Externes
  const chargesExternes = years.map(y =>
    extractValue(comptable.sig[y]?.autres_achats_charges_externes) / 1000
  );

  // Dynamic title based on available years
  const chartTitle = years.length >= 3
    ? 'Évolution Financière sur 3 ans'
    : `Évolution Financière (${years.length} année${years.length > 1 ? 's' : ''})`;

  return {
    type: 'line',
    data: {
      labels: years,
      datasets: [
        {
          label: 'Chiffre d\'Affaires (k€)',
          data: ca,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'EBE (k€)',
          data: ebe,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Résultat Net (k€)',
          data: rn,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          tension: 0.4,
          fill: true
        },
        // ✅ ADD: Frais de Personnel (lignes pointillées pour différencier des revenus)
        {
          label: 'Frais de Personnel (k€)',
          data: fraisPersonnel,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          tension: 0.4,
          fill: false,
          borderDash: [5, 5] // Dashed line
        },
        // ✅ ADD: Charges Externes (lignes pointillées pour différencier des revenus)
        {
          label: 'Charges Externes (k€)',
          data: chargesExternes,
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          tension: 0.4,
          fill: false,
          borderDash: [5, 5] // Dashed line
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top'
        },
        title: {
          display: true,
          text: chartTitle,
          font: { size: 16, weight: 'bold' }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Montants (k€)'
          }
        }
      }
    }
  };
}

/**
 * Génère le graphique de valorisation (horizontal bar)
 * Supports both structures: new (valorisation.methodes.ebe) and old (valorisation.methodeEBE)
 * Also supports methodeHybride for Tabac/Presse/FDJ businesses
 */
function generateValorisationChart(valorisation: any): any {
  if (!valorisation) {
    return getDefaultChart();
  }

  // NOUVEAU: Support méthode hybride (Tabac/Presse/FDJ) - PRIORITAIRE
  if (valorisation.methodeHybride) {
    const hybrid = valorisation.methodeHybride;
    const totale = hybrid.valorisationTotale;

    console.log('[Valorisation Chart] ✅ Using méthode HYBRIDE');

    return {
      type: 'bar',
      data: {
        labels: ['Méthode Hybride Tabac/Presse'],
        datasets: [
          {
            label: 'Fourchette Basse (k€)',
            data: [(totale.fourchetteBasse || 0) / 1000],
            backgroundColor: 'rgba(239, 68, 68, 0.6)',
            borderColor: '#ef4444',
            borderWidth: 1
          },
          {
            label: 'Valorisation Médiane (k€)',
            data: [(totale.valeurMediane || 0) / 1000],
            backgroundColor: 'rgba(59, 130, 246, 0.8)',
            borderColor: '#3b82f6',
            borderWidth: 2
          },
          {
            label: 'Fourchette Haute (k€)',
            data: [(totale.fourchetteHaute || 0) / 1000],
            backgroundColor: 'rgba(16, 185, 129, 0.6)',
            borderColor: '#10b981',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { position: 'top' },
          title: {
            display: true,
            text: 'Valorisation Hybride (Bloc Réglementé + Bloc Commercial)',
            font: { size: 16, weight: 'bold' }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            title: { display: true, text: 'Valorisation (k€)' }
          }
        }
      }
    };
  }

  // Support BOTH structures (backward compatibility) - Méthodes standard
  const methodes = valorisation.methodes || {
    ebe: valorisation.methodeEBE,
    ca: valorisation.methodeCA,
    patrimoniale: valorisation.methodePatrimoniale
  };

  const labels = [];
  const minValues = [];
  const medianValues = [];
  const maxValues = [];

  // Always add methods, even if value is 0 (show all 3 methods for transparency)
  if (methodes.ebe) {
    labels.push('Méthode EBE');
    if (methodes.ebe.valeur_mediane > 0) {
      minValues.push((methodes.ebe.valeur_basse || 0) / 1000);
      medianValues.push((methodes.ebe.valeur_mediane || 0) / 1000);
      maxValues.push((methodes.ebe.valeur_haute || 0) / 1000);
    } else {
      // Show 0 values with visual indicator
      minValues.push(0);
      medianValues.push(0);
      maxValues.push(0);
      console.warn('[Valorisation Chart] ⚠️ Méthode EBE: 0€ (données insuffisantes)');
    }
  }

  if (methodes.ca) {
    labels.push('Méthode CA');
    if (methodes.ca.valeur_mediane > 0) {
      const median = (methodes.ca.valeur_mediane || 0) / 1000;
      minValues.push(median * 0.9); // ±10%
      medianValues.push(median);
      maxValues.push(median * 1.1);
    } else {
      minValues.push(0);
      medianValues.push(0);
      maxValues.push(0);
      console.warn('[Valorisation Chart] ⚠️ Méthode CA: 0€ (données insuffisantes)');
    }
  }

  if (methodes.patrimoniale) {
    labels.push('Méthode Patrimoniale');
    if (methodes.patrimoniale.valeur_estimee > 0) {
      const value = (methodes.patrimoniale.valeur_estimee || 0) / 1000;
      minValues.push(value * 0.95);
      medianValues.push(value);
      maxValues.push(value * 1.05);
    } else {
      minValues.push(0);
      medianValues.push(0);
      maxValues.push(0);
      console.warn('[Valorisation Chart] ⚠️ Méthode Patrimoniale: 0€ (bilan non fourni)');
    }
  }

  // If NO methods exist at all, return default chart
  if (labels.length === 0) {
    console.warn('⚠️ [Valorisation Chart] Aucune méthode de valorisation disponible');
    return getDefaultChart();
  }

  return {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Fourchette Basse (k€)',
          data: minValues,
          backgroundColor: 'rgba(239, 68, 68, 0.6)',
          borderColor: '#ef4444',
          borderWidth: 1
        },
        {
          label: 'Valorisation Médiane (k€)',
          data: medianValues,
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderColor: '#3b82f6',
          borderWidth: 2
        },
        {
          label: 'Fourchette Haute (k€)',
          data: maxValues,
          backgroundColor: 'rgba(16, 185, 129, 0.6)',
          borderColor: '#10b981',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: {
          position: 'top'
        },
        title: {
          display: true,
          text: 'Fourchettes de Valorisation par Méthode',
          font: { size: 16, weight: 'bold' }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Valorisation (k€)'
          }
        }
      }
    }
  };
}

/**
 * Génère la jauge de santé financière (doughnut)
 */
function generateHealthGauge(comptable: any): any {
  const healthScore = comptable?.healthScore?.overall || 0;

  // Couleur selon le score
  let color = '#ef4444'; // Rouge par défaut
  if (healthScore >= 80) color = '#10b981'; // Vert
  else if (healthScore >= 60) color = '#3b82f6'; // Bleu
  else if (healthScore >= 40) color = '#f59e0b'; // Orange

  return {
    type: 'doughnut',
    data: {
      labels: ['Score', 'Restant'],
      datasets: [{
        data: [healthScore, 100 - healthScore],
        backgroundColor: [color, '#e5e7eb'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      circumference: 180,
      rotation: 270,
      plugins: {
        legend: {
          display: false
        },
        title: {
          display: true,
          text: `Score de Santé Financière: ${healthScore}/100`,
          font: { size: 18, weight: 'bold' }
        },
        tooltip: {
          enabled: false
        }
      }
    }
  };
}

/**
 * Génère la jauge de santé financière PROJETÉE (année N+1)
 */
function generateProjectedHealthGauge(projectedHealthScore: any): any {
  const healthScore = projectedHealthScore?.overall || 0;

  // Couleur selon le score
  let color = '#ef4444'; // Rouge
  if (healthScore >= 80) color = '#10b981'; // Vert
  else if (healthScore >= 60) color = '#3b82f6'; // Bleu
  else if (healthScore >= 40) color = '#f59e0b'; // Orange

  return {
    type: 'doughnut',
    data: {
      labels: ['Score', 'Restant'],
      datasets: [{
        data: [healthScore, 100 - healthScore],
        backgroundColor: [color, '#e5e7eb'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      circumference: 180,
      rotation: 270,
      plugins: {
        legend: {
          display: false
        },
        title: {
          display: true,
          text: `Score Projeté N+1: ${healthScore}/100`,
          font: { size: 18, weight: 'bold' }
        },
        tooltip: {
          enabled: false
        }
      }
    }
  };
}

/**
 * Génère le radar de confiance par section
 */
function generateConfidenceRadar(financialValidation: any): any {
  if (!financialValidation?.confidenceScore?.breakdown) {
    return getDefaultChart();
  }

  const breakdown = financialValidation.confidenceScore.breakdown;

  return {
    type: 'radar',
    data: {
      labels: [
        'Extraction Données',
        'Analyse Comptable',
        'Valorisation',
        'Analyse Immobilière'
      ],
      datasets: [{
        label: 'Score de Confiance',
        data: [
          breakdown.extraction || 0,
          breakdown.comptabilite || 0,
          breakdown.valorisation || 0,
          breakdown.immobilier || 0
        ],
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: '#3b82f6',
        borderWidth: 2,
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#3b82f6'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        title: {
          display: true,
          text: 'Score de Confiance par Section',
          font: { size: 16, weight: 'bold' }
        }
      },
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          ticks: {
            stepSize: 20
          }
        }
      }
    }
  };
}

/**
 * Chart par défaut (vide)
 */
function getDefaultChart(): any {
  return {
    type: 'bar',
    data: {
      labels: ['Pas de données'],
      datasets: [{
        label: 'N/A',
        data: [0],
        backgroundColor: '#e5e7eb'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      }
    }
  };
}

/**
 * Parse state (handle JSON string)
 */
function parseState(state: any): any {
  if (!state) return null;
  if (typeof state === 'string') {
    try {
      return JSON.parse(state);
    } catch {
      return null;
    }
  }
  return state;
}

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

      // CHART 4 : Radar confiance par section
      const confidenceRadar = generateConfidenceRadar(financialValidation);

      return {
        evolutionChart,
        valorisationChart,
        healthGauge,
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
  const ca = years.map(y => comptable.sig[y].chiffre_affaires / 1000); // En milliers d'€
  const ebe = years.map(y => comptable.sig[y].ebe / 1000);
  const rn = years.map(y => comptable.sig[y].resultat_net / 1000);

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
          text: 'Évolution Financière sur 3 ans',
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
 */
function generateValorisationChart(valorisation: any): any {
  if (!valorisation?.methodes) {
    return getDefaultChart();
  }

  const labels = [];
  const minValues = [];
  const medianValues = [];
  const maxValues = [];

  if (valorisation.methodes.ebe) {
    labels.push('Méthode EBE');
    minValues.push((valorisation.methodes.ebe.valeur_basse || 0) / 1000);
    medianValues.push((valorisation.methodes.ebe.valeur_mediane || 0) / 1000);
    maxValues.push((valorisation.methodes.ebe.valeur_haute || 0) / 1000);
  }

  if (valorisation.methodes.ca) {
    labels.push('Méthode CA');
    const median = (valorisation.methodes.ca.valeur_mediane || 0) / 1000;
    minValues.push(median * 0.9); // ±10%
    medianValues.push(median);
    maxValues.push(median * 1.1);
  }

  if (valorisation.methodes.patrimoniale) {
    labels.push('Méthode Patrimoniale');
    const value = (valorisation.methodes.patrimoniale.valeur_estimee || 0) / 1000;
    minValues.push(value * 0.95);
    medianValues.push(value);
    maxValues.push(value * 1.05);
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

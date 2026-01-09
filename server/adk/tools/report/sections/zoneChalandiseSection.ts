/**
 * Zone de Chalandise Section for Professional Report
 * Displays trade area flux analysis (residents, workers, students, tourists)
 */

interface DemographicData {
  profile?: {
    trade_area_potential?: {
      walking_500m?: number;
      driving_1km?: number; // FIX: Added 1km radius for broader coverage
    };
  };
  local_context?: {
    economic_activity?: any;
    seasonality?: {
      population_increase_estimated?: number;
    };
  };
  commune?: {
    population?: number;
  };
}

interface PreparationData {
  business?: {
    activite_principale?: string;
  };
  coordinates?: {
    lat?: number;
    lon?: number;
  };
}

/**
 * Extract worker flux from economic activity context
 * FIX: Enhanced patterns for better extraction (TECHLID, sociétés, salariés)
 */
function extractWorkerFlux(localContext: any): number {
  if (!localContext?.economic_activity) {
    return 0;
  }

  let economicText = '';
  if (Array.isArray(localContext.economic_activity)) {
    economicText = localContext.economic_activity.map(e => e.content || '').join(' ');
  } else if (typeof localContext.economic_activity === 'string') {
    economicText = localContext.economic_activity;
  }

  economicText = economicText.toLowerCase();

  // Pattern 1: "X entreprises" (existing)
  const companyMatch = economicText.match(/(\d+)\s*entreprises?/i);
  if (companyMatch) {
    return Math.round(parseInt(companyMatch[1]) * 1.5);
  }

  // Pattern 2: "X sociétés" / "X commerces" (NEW)
  const societyMatch = economicText.match(/(\d+)\s*(?:sociétés?|commerces?)/i);
  if (societyMatch) {
    return Math.round(parseInt(societyMatch[1]) * 1.5);
  }

  // Pattern 3: "X salariés" explicit (NEW)
  const employeeMatch = economicText.match(/(\d+)\s*(?:salariés?|emplois?)/i);
  if (employeeMatch) {
    return parseInt(employeeMatch[1]);
  }

  // Pattern 4: Named zones TECHLID/ZAC (NEW - Fix Limonest)
  const zoneKeywords = ['techlid', 'zac', "zone d'activité", "parc d'activité"];
  const hasZone = zoneKeywords.some(kw => economicText.includes(kw));
  if (hasZone) {
    console.log('[zoneChalandise] Zone économique détectée sans chiffres, estimation 500 salariés');
    return 500; // Conservative estimation
  }

  return 0;
}

/**
 * Extract student flux from local context
 * FIX: Enhanced detection for educational institutions (lycée, IUT, écoles)
 */
function extractStudentFlux(localContext: any): number {
  if (!localContext) {
    return 0;
  }

  const contextText = JSON.stringify(localContext).toLowerCase();

  // Pattern 1: Explicit student count "X étudiants"
  const studentMatch = contextText.match(/(\d+)\s*(?:étudiants?|élèves?)/i);
  if (studentMatch) {
    return parseInt(studentMatch[1]);
  }

  // Pattern 2: Educational institutions (IMPROVED)
  const educationKeywords = {
    university: ['université', 'campus', 'fac'],
    highschool: ['lycée', 'iut', 'bts'],
    school: ['école supérieure', "école d'ingénieur", 'école de commerce']
  };

  let institutionCount = 0;
  let institutionType = null;

  for (const [type, keywords] of Object.entries(educationKeywords)) {
    if (keywords.some(kw => contextText.includes(kw))) {
      institutionType = type;
      institutionCount++;
    }
  }

  if (institutionCount === 0) return 0;

  // Estimation by type
  if (institutionType === 'university') return 1000 * institutionCount;
  if (institutionType === 'highschool') return 500 * institutionCount;
  if (institutionType === 'school') return 300 * institutionCount;

  return 200; // Fallback
}

/**
 * Generate flux summary cards
 */
function generateFluxCards(
  residents: number,
  workers: number,
  students: number,
  tourists: number
): string {
  return `
    <div class="flux-summary">
      <div class="flux-card residents">
        <div class="flux-icon">🏘️</div>
        <div class="flux-value">${residents.toLocaleString('fr-FR')}</div>
        <div class="flux-label">Résidents (500m)</div>
      </div>
      <div class="flux-card workers">
        <div class="flux-icon">💼</div>
        <div class="flux-value">${workers.toLocaleString('fr-FR')}</div>
        <div class="flux-label">Salariés (Zone Emploi)</div>
      </div>
      <div class="flux-card students">
        <div class="flux-icon">🎓</div>
        <div class="flux-value">${students.toLocaleString('fr-FR')}</div>
        <div class="flux-label">Étudiants</div>
      </div>
      <div class="flux-card tourists">
        <div class="flux-icon">🧳</div>
        <div class="flux-value">${tourists.toLocaleString('fr-FR')}</div>
        <div class="flux-label">Touristes</div>
      </div>
    </div>
  `;
}

/**
 * Generate flux details table
 */
function generateFluxTable(
  residents: number,
  workers: number,
  students: number,
  tourists: number
): string {
  const data = [
    { type: 'Résidents', volume: residents, frequency: 'Quotidien', impact: 'Très élevé', impactClass: 'success', note: 'Clientèle fidèle' },
    { type: 'Salariés', volume: workers, frequency: 'Lun-Ven (déjeuner)', impact: 'Élevé', impactClass: 'warning', note: 'Pic 12h-14h' },
    { type: 'Étudiants', volume: students, frequency: 'Sept-Juin', impact: 'Modéré', impactClass: 'info', note: 'Saisonnalité' },
    { type: 'Touristes', volume: tourists, frequency: 'Juil-Août', impact: 'Saisonnier', impactClass: 'info', note: '' }
  ];

  return `
    <table class="flux-table">
      <thead>
        <tr>
          <th>Type de Flux</th>
          <th>Volume</th>
          <th>Fréquence</th>
          <th>Impact Commerce</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(row => `
          <tr>
            <td><strong>${row.type}</strong></td>
            <td>${row.volume.toLocaleString('fr-FR')}</td>
            <td>${row.frequency}</td>
            <td>
              <span class="badge ${row.impactClass}">${row.impact}</span>
              ${row.note ? `<br><small>${row.note}</small>` : ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

/**
 * Calculate commercial potential
 */
function calculateCommercialPotential(totalPopulation: number): {
  captureRate: number;
  avgTransaction: number;
  dailyRevenue: number;
  monthlyRevenue: number;
} {
  const captureRate = 0.05; // 5% conservative
  const avgTransaction = 8; // 8€ average
  const dailyRevenue = totalPopulation * captureRate * avgTransaction;
  const monthlyRevenue = dailyRevenue * 26; // 26 working days

  return {
    captureRate,
    avgTransaction,
    dailyRevenue,
    monthlyRevenue
  };
}

/**
 * Generate commercial potential analysis
 */
function generatePotentialAnalysis(
  totalPopulation: number,
  potential: ReturnType<typeof calculateCommercialPotential>
): string {
  return `
    <div class="potential-analysis">
      <h3>💰 Potentiel Commercial Estimé</h3>
      <div class="metrics-grid">
        <div class="metric">
          <div class="metric-label">Population Totale</div>
          <div class="metric-value">${totalPopulation.toLocaleString('fr-FR')}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Taux Capture</div>
          <div class="metric-value">${(potential.captureRate * 100).toFixed(1)}%</div>
        </div>
        <div class="metric">
          <div class="metric-label">Panier Moyen</div>
          <div class="metric-value">${potential.avgTransaction}€</div>
        </div>
        <div class="metric highlight">
          <div class="metric-label">CA Mensuel Estimé</div>
          <div class="metric-value">${Math.round(potential.monthlyRevenue).toLocaleString('fr-FR')}€</div>
        </div>
      </div>
      <p class="analysis-note">
        <strong>Note:</strong> Ces estimations sont basées sur des moyennes sectorielles conservatrices.
        Le potentiel réel dépend de nombreux facteurs (concurrence, positionnement, qualité de l'offre).
      </p>
    </div>
  `;
}

/**
 * Generate Zone de Chalandise section (main export)
 */
export function generateZoneChalandiseSection(
  demographic: DemographicData,
  preparation: PreparationData
): string {
  // FIX: Extract flux data - use 1km radius for broader coverage (covers peripheral zones like TECHLID)
  const residents = demographic?.profile?.trade_area_potential?.driving_1km ||
                    demographic?.profile?.trade_area_potential?.walking_500m || 0;
  const workers = extractWorkerFlux(demographic?.local_context);
  const students = extractStudentFlux(demographic?.local_context);
  const tourists = demographic?.local_context?.seasonality?.population_increase_estimated || 0;

  const totalPopulation = residents + workers + students + tourists;

  if (totalPopulation === 0) {
    return `
      <h2>🎯 Zone de Chalandise - Analyse des Flux</h2>
      <p class="no-data">Données de flux de population non disponibles</p>
    `;
  }

  const potential = calculateCommercialPotential(totalPopulation);

  return `
    <h2>🎯 Zone de Chalandise - Analyse des Flux</h2>

    ${generateFluxCards(residents, workers, students, tourists)}

    <div class="total-potential">
      Potentiel Total: ${totalPopulation.toLocaleString('fr-FR')} personnes/jour
    </div>

    ${generateFluxTable(residents, workers, students, tourists)}

    ${generatePotentialAnalysis(totalPopulation, potential)}
  `;
}

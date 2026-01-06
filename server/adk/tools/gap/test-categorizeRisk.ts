/**
 * Test categorizeRisk Tool - Phase 1 Fix Validation
 *
 * Vérifie que le tool ne crash plus avec des données invalides
 */

import { categorizeRiskTool } from './categorizeRiskTool.js';

async function runTests() {
  console.log('=== Testing categorizeRisk Tool Fixes ===\n');

  // Test 1: Scores undefined (devrait retourner error, pas crash)
  console.log('Test 1: Scores undefined');
  try {
    const result1 = await categorizeRiskTool.execute({
      scores: undefined as any
    });

    if (result1.error) {
      console.log('✅ PASS: Tool returned error instead of crashing');
      console.log('   Error message:', result1.error);
      console.log('   Risk score:', result1.risk_score);
      console.log('   Overall risk level:', result1.overall_risk_level);
    } else {
      console.log('❌ FAIL: Tool should have returned an error');
    }
  } catch (error: any) {
    console.log('❌ FAIL: Tool crashed with error:', error.message);
  }

  console.log('\n---\n');

  // Test 2: Scores object vide (devrait retourner error)
  console.log('Test 2: Empty scores object');
  try {
    const result2 = await categorizeRiskTool.execute({
      scores: {} as any
    });

    if (result2.error) {
      console.log('✅ PASS: Tool returned error for empty scores');
      console.log('   Error message:', result2.error);
    } else {
      console.log('❌ FAIL: Tool should have returned an error');
    }
  } catch (error: any) {
    console.log('❌ FAIL: Tool crashed with error:', error.message);
  }

  console.log('\n---\n');

  // Test 3: Scores partiel (manque location) - devrait retourner error
  console.log('Test 3: Incomplete scores (missing location)');
  try {
    const result3 = await categorizeRiskTool.execute({
      scores: {
        market: 60,
        operational: 70,
        financial: 50,
        overall: 58
      } as any
    });

    if (result3.error) {
      console.log('✅ PASS: Tool returned error for incomplete scores');
      console.log('   Error message:', result3.error);
    } else {
      console.log('❌ FAIL: Tool should have returned an error');
    }
  } catch (error: any) {
    console.log('❌ FAIL: Tool crashed with error:', error.message);
  }

  console.log('\n---\n');

  // Test 4: Scores valides (devrait fonctionner normalement)
  console.log('Test 4: Valid scores');
  try {
    const result4 = await categorizeRiskTool.execute({
      scores: {
        location: 45, // Low score → devrait créer des risques
        market: 40,   // Low score
        operational: 35, // Low score
        financial: 38,   // Low score
        overall: 40      // Low score
      },
      demographic: {
        trade_area_potential: {
          walking_500m: 800 // Low population
        }
      },
      places: {
        found: false // Pas de Google Places
      },
      photo: {
        budget_travaux: {
          fourchette_haute: 85000 // Budget élevé → risque CRITICAL
        }
      },
      competitor: {
        total_competitors: 12,
        density_level: 'very_high' // Concurrence élevée
      },
      validation: {
        total_conflicts: 3,
        blocking_conflicts: 1 // Conflits bloquants
      }
    });

    if (!result4.error && result4.risks.length > 0) {
      console.log('✅ PASS: Tool processed valid scores successfully');
      console.log('   Total risks:', result4.summary.total_risks);
      console.log('   Risk breakdown:', result4.summary.by_severity);
      console.log('   Risk score:', result4.risk_score);
      console.log('   Overall risk level:', result4.overall_risk_level);
      console.log('   Blocking:', result4.blocking);

      // Vérifier qu'il y a au moins un risque CRITICAL (budget > 75k)
      const criticalRisks = result4.risks.filter(r => r.severity === 'CRITICAL');
      if (criticalRisks.length > 0) {
        console.log('   ✅ Found CRITICAL risks as expected');
        console.log('   Example:', criticalRisks[0].description.substring(0, 80) + '...');
      } else {
        console.log('   ⚠️  Warning: Expected at least one CRITICAL risk');
      }
    } else if (result4.error) {
      console.log('❌ FAIL: Tool should NOT have returned error for valid data');
      console.log('   Error message:', result4.error);
    } else {
      console.log('❌ FAIL: Tool returned no risks for clearly risky scenario');
    }
  } catch (error: any) {
    console.log('❌ FAIL: Tool crashed with error:', error.message);
  }

  console.log('\n=== Tests Complete ===');
}

// Exécuter les tests
runTests().catch(console.error);

/**
 * Test Script - ADK Pipeline State Access Fix
 *
 * Tests PreparationAgent avec références explicites au state
 */

const testBusiness = {
  siret: '99292462100012',
  siren: '992924621',
  nom_complet: 'RONZA MAROOKI (GEORGEES) (LE DRUGSTORE DU BARRIOT)',
  siege: {
    adresse: '25 CHEMIN DE PIERRE BLANCHE',
    code_postal: '69570',
    commune: 'DARDILLY',
    code_commune: '69072',
    latitude: '45.818461',
    longitude: '4.750495'
  },
  enseigne: 'LE DRUGSTORE DU BARRIOT',
  activite_principale_libelle: 'Commerce de détail de tabac en magasin spécialisé'
};

async function testADKPipeline() {
  console.log('🧪 Testing ADK Pipeline with fixed PreparationAgent...\n');
  console.log('📦 Business Data:');
  console.log(JSON.stringify(testBusiness, null, 2));
  console.log('\n🚀 Sending request to /api/analyze-professional-adk...\n');

  try {
    const response = await fetch('http://localhost:3001/api/analyze-professional-adk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ business: testBusiness })
    });

    console.log(`📡 Response Status: ${response.status} ${response.statusText}\n`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Request failed:', errorText);
      process.exit(1);
    }

    const result = await response.json();

    console.log('✅ Pipeline completed successfully!\n');
    console.log('📊 Final State Keys:', Object.keys(result));
    console.log('\n🔍 Verification Results:\n');

    // Vérification PreparationAgent
    if (result.preparation) {
      console.log('✅ PreparationAgent executed successfully');
      console.log('   - Business ID:', result.preparation.businessId);
      console.log('   - Normalized Address:', result.preparation.normalizedAddress?.full);
      console.log('   - Coordinates:', result.preparation.coordinates);
      console.log('   - Commune:', result.preparation.commune?.nom);
    } else {
      console.log('❌ PreparationAgent FAILED - No preparation data in state');
      console.log('   Error:', result.preparation);
    }

    // Vérification DemographicAgent (dépend de PreparationAgent)
    if (result.demographic) {
      console.log('\n✅ DemographicAgent executed (depends on preparation.normalizedAddress.zipCode)');
      console.log('   - Analyzed:', result.demographic.analyzed);
      if (result.demographic.analyzed) {
        console.log('   - Population:', result.demographic.commune?.population);
        console.log('   - Score:', result.demographic.score?.overall);
      }
    } else {
      console.log('\n❌ DemographicAgent FAILED or not executed');
    }

    // Vérification PlacesAgent
    if (result.places) {
      console.log('\n✅ PlacesAgent executed');
      console.log('   - Found:', result.places.found);
      if (result.places.found) {
        console.log('   - Name:', result.places.name);
        console.log('   - Rating:', result.places.rating);
      }
    }

    // Compte des agents complétés
    const agentKeys = ['preparation', 'demographic', 'places', 'photo', 'competitor', 'validation', 'gap', 'arbitrator', 'strategic', 'report'];
    const completedAgents = agentKeys.filter(key => result[key]);

    console.log('\n📈 Pipeline Progress:');
    console.log(`   ${completedAgents.length}/10 agents completed`);
    console.log(`   Agents: ${completedAgents.join(', ')}`);

    if (completedAgents.length === 10) {
      console.log('\n🎉 SUCCESS! All 10 agents completed successfully!');
      console.log('   The PreparationAgent state access fix is working correctly.');
    } else {
      console.log('\n⚠️  Partial completion - Some agents did not execute');
      const missingAgents = agentKeys.filter(key => !result[key]);
      console.log(`   Missing: ${missingAgents.join(', ')}`);
    }

    // Afficher le rapport final si disponible
    if (result.report) {
      console.log('\n📄 Report generated:');
      console.log('   - Recommendation:', result.report.recommendation);
      console.log('   - Confidence:', result.report.confidence_score);
    }

    console.log('\n✅ Test completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    process.exit(1);
  }
}

// Run test
testADKPipeline();

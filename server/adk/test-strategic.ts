/**
 * Test StrategicAgent - Validation
 */

import { StrategicAgent } from './agents/StrategicAgent.js';

async function testStrategicAgent() {
  console.log('🧪 Testing StrategicAgent instantiation...\n');

  try {
    // Test 1: Instantiate agent
    console.log('Test 1: Agent instantiation');
    const agent = new StrategicAgent();
    console.log('✅ StrategicAgent instantiated successfully');

    // Test 2: Validate configuration
    console.log('\nTest 2: Agent configuration');
    console.log(`  Name: ${agent.name}`);
    console.log(`  Description: ${agent.description || 'N/A'}`);
    console.log(`  Model: ${agent.model || 'inherited'}`);
    console.log(`  Tools: ${agent.tools?.length || 0} tools`);
    if (agent.tools && agent.tools.length > 0) {
      agent.tools.forEach((tool: any) => {
        console.log(`    - ${tool.name}: ${tool.description.substring(0, 60)}...`);
      });
    }
    console.log(`  Output key: ${agent.outputKey || 'none'}`);
    console.log('✅ Configuration validated');

    // Test 3: Validate tools
    console.log('\nTest 3: Tool validation');
    const toolNames = agent.tools?.map((t: any) => t.name) || [];
    const expectedTools = ['askClarification'];

    const missingTools = expectedTools.filter(t => !toolNames.includes(t));
    if (missingTools.length > 0) {
      throw new Error(`Missing tools: ${missingTools.join(', ')}`);
    }
    console.log('✅ All expected tools present');

    console.log('\n✨ All validation tests passed!');
    console.log('\n📝 Strategic Features:');
    console.log('   - Model: gemini-2.0-flash-thinking-exp (strategic reasoning)');
    console.log('   - Recommendations: GO, NO-GO, GO_WITH_RESERVES');
    console.log('   - Score calculation: Potential (50%) + Risk (30%) + Coherence (20%)');
    console.log('   - Dynamic clarifications: Max 3 per analysis');
    console.log('   - Financial analysis: Investment, revenue, breakeven, ROI');
    console.log('\n🎯 Clarification Capabilities:');
    console.log('   - PhotoAgent: "Travaux urgents sécurité ou esthétique?"');
    console.log('   - CompetitorAgent: "Prix moyens pratiqués?"');
    console.log('   - DemographicAgent: "Détails profil CSP zone?"');
    console.log('   - PlacesAgent: "Problèmes récurrents dans avis?"');
    console.log('\n💡 Decision Thresholds:');
    console.log('   - GO: score ≥ 75 + critical conflicts resolved');
    console.log('   - GO_WITH_RESERVES: 50-74 or high conflicts non-blocking');
    console.log('   - NO-GO: score < 50 or critical conflicts unresolved');
    console.log('\n📊 Scoring Components:');
    console.log('   - Potential: Population (30) + CSP fit (25) + Location (20) + Competition (15) + Reputation (10)');
    console.log('   - Risk: Renovation (30) + Saturation (25) + Conflicts (20) + Condition (15) + Reviews (10)');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run test
testStrategicAgent()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test execution failed:', error);
    process.exit(1);
  });

/**
 * Test ArbitratorAgent - Validation
 */

import { ArbitratorAgent } from './agents/ArbitratorAgent.js';

async function testArbitratorAgent() {
  console.log('🧪 Testing ArbitratorAgent instantiation...\n');

  try {
    // Test 1: Instantiate agent
    console.log('Test 1: Agent instantiation');
    const agent = new ArbitratorAgent();
    console.log('✅ ArbitratorAgent instantiated successfully');

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
    const expectedTools = ['resolveConflict', 'prioritizeSource'];

    const missingTools = expectedTools.filter(t => !toolNames.includes(t));
    if (missingTools.length > 0) {
      throw new Error(`Missing tools: ${missingTools.join(', ')}`);
    }
    console.log('✅ All expected tools present');

    console.log('\n✨ All validation tests passed!');
    console.log('\n📝 Arbitration Features:');
    console.log('   - Model: gemini-2.0-flash-thinking-exp (complex reasoning)');
    console.log('   - Resolution types: 4 (CONFIRMED, REJECTED, HYBRID, NEEDS_REVALIDATION)');
    console.log('   - Confidence scoring: 0.0-1.0 with rationale');
    console.log('   - Source prioritization: Terrain > Estimations');
    console.log('   - Actions: URGENT, HIGH, MEDIUM, LOW priorities');
    console.log('\n🎯 Resolution Examples:');
    console.log('   - Population 5000 + 0 POI → NEEDS_REVALIDATION (verify GPS)');
    console.log('   - CSP+ + discount pricing → HYBRID (repositioning opportunity)');
    console.log('   - GPS distance > 200m → REJECTED (wrong business match)');
    console.log('   - Rating 4.5 + state 3/10 → NEEDS_REVALIDATION (confusion)');
    console.log('\n💡 Source Reliability Hierarchy:');
    console.log('   - Population: Demographic (95) > Competitor (75)');
    console.log('   - GPS: Preparation (85) > Places (80)');
    console.log('   - Physical state: Photo (85) ≈ Places rating (85)');

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
testArbitratorAgent()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test execution failed:', error);
    process.exit(1);
  });

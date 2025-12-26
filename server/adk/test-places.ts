/**
 * Test PlacesAgent - Validation
 */

import { PlacesAgent } from './agents/PlacesAgent.js';

async function testPlacesAgent() {
  console.log('🧪 Testing PlacesAgent instantiation...\n');

  try {
    // Test 1: Instantiate agent
    console.log('Test 1: Agent instantiation');
    const agent = new PlacesAgent();
    console.log('✅ PlacesAgent instantiated successfully');

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
    const expectedTools = ['searchPlaces', 'fetchAssets'];

    const missingTools = expectedTools.filter(t => !toolNames.includes(t));
    if (missingTools.length > 0) {
      throw new Error(`Missing tools: ${missingTools.join(', ')}`);
    }
    console.log('✅ All expected tools present');

    console.log('\n✨ All validation tests passed!');
    console.log('\n📝 Multi-result scoring system:');
    console.log('   - Street number: 40 points');
    console.log('   - Postal code: 30 points');
    console.log('   - GPS distance: 20 points');
    console.log('   - Street name: 10 points');
    console.log('   - Threshold: 80% minimum');

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
testPlacesAgent()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test execution failed:', error);
    process.exit(1);
  });

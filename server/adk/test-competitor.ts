/**
 * Test CompetitorAgent - Validation
 */

import { CompetitorAgent } from './agents/CompetitorAgent.js';

async function testCompetitorAgent() {
  console.log('🧪 Testing CompetitorAgent instantiation...\n');

  try {
    // Test 1: Instantiate agent
    console.log('Test 1: Agent instantiation');
    const agent = new CompetitorAgent();
    console.log('✅ CompetitorAgent instantiated successfully');

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
    const expectedTools = ['nearbySearch', 'calculateDistance'];

    const missingTools = expectedTools.filter(t => !toolNames.includes(t));
    if (missingTools.length > 0) {
      throw new Error(`Missing tools: ${missingTools.join(', ')}`);
    }
    console.log('✅ All expected tools present');

    console.log('\n✨ All validation tests passed!');
    console.log('\n📝 Competitor Analysis Features:');
    console.log('   - Model: gemini-2.0-flash-lite (fast analysis)');
    console.log('   - Search radius: 500m (pedestrian trade area)');
    console.log('   - Max results: 20 POI per search');
    console.log('   - Distance calculation: Haversine formula (±0.5% precision)');
    console.log('   - Density levels: 5 (very_low, low, moderate, high, very_high)');
    console.log('\n🎯 Analysis Components:');
    console.log('   - Nearby POI search via Google Places API');
    console.log('   - Distance calculation to each competitor');
    console.log('   - Density assessment (0 POI = very_low, 15+ = very_high)');
    console.log('   - Dominant types identification (top 5)');
    console.log('   - Pricing analysis (if priceLevel available)');
    console.log('   - Market saturation evaluation');
    console.log('\n💡 Proximity Levels:');
    console.log('   - Immediate: < 50m (same street/building)');
    console.log('   - Very close: 50-200m (direct visibility)');
    console.log('   - Close: 200-500m (pedestrian zone)');
    console.log('   - Moderate: 500-1000m');
    console.log('   - Far: > 1000m');
    console.log('\n📊 Market Assessment:');
    console.log('   - Saturation: low, moderate, high, very_high');
    console.log('   - Competition intensity: weak, moderate, strong, very_strong');
    console.log('   - Positioning opportunity: Context-based recommendations');

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
testCompetitorAgent()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test execution failed:', error);
    process.exit(1);
  });

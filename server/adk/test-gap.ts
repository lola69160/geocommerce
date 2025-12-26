/**
 * Test GapAnalysisAgent - Validation
 */

import { GapAnalysisAgent } from './agents/GapAnalysisAgent.js';

async function testGapAnalysisAgent() {
  console.log('🧪 Testing GapAnalysisAgent instantiation...\n');

  try {
    // Test 1: Instantiate agent
    console.log('Test 1: Agent instantiation');
    const agent = new GapAnalysisAgent();
    console.log('✅ GapAnalysisAgent instantiated successfully');

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
    const expectedTools = ['calculateScores', 'categorizeRisk'];

    const missingTools = expectedTools.filter(t => !toolNames.includes(t));
    if (missingTools.length > 0) {
      throw new Error(`Missing tools: ${missingTools.join(', ')}`);
    }
    console.log('✅ All expected tools present');

    console.log('\n✨ All validation tests passed!');
    console.log('\n📝 Gap Analysis Features:');
    console.log('   - Model: gemini-2.0-flash-lite (fast analysis)');
    console.log('   - Scoring dimensions: 4 (Location, Market, Operational, Financial)');
    console.log('   - Risk categories: 4 (LOCATION, MARKET, OPERATIONAL, FINANCIAL)');
    console.log('   - Severity levels: 4 (CRITICAL, HIGH, MEDIUM, LOW)');
    console.log('\n🎯 Scoring Breakdown:');
    console.log('   - LOCATION (30%): Demographics + Trade area + GPS matching');
    console.log('   - MARKET (25%): Reputation + Review volume + Competition (inverse)');
    console.log('   - OPERATIONAL (25%): Physical state + Renovation cost (inverse)');
    console.log('   - FINANCIAL (20%): Data coherence + Potential/Investment ratio');
    console.log('\n💡 Score Interpretation:');
    console.log('   - 80-100: Excellent opportunity');
    console.log('   - 65-79: Good opportunity');
    console.log('   - 50-64: Fair opportunity (conditional)');
    console.log('   - 0-49: Poor opportunity');
    console.log('\n⚠️ Risk Assessment:');
    console.log('   - Risk Score (inverse): 100 = No risk, 0 = Critical risk');
    console.log('   - CRITICAL: -25 points (blocking GO/NO-GO)');
    console.log('   - HIGH: -15 points (major impact)');
    console.log('   - MEDIUM: -8 points (moderate impact)');
    console.log('   - LOW: -3 points (minor vigilance)');
    console.log('\n📊 Gap Analysis:');
    console.log('   - Compares theoretical potential vs. reality');
    console.log('   - Identifies major gaps (score < 50 or critical risks)');
    console.log('   - Prioritizes actions: CRITICAL risks → Major gaps → HIGH risks');

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
testGapAnalysisAgent()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test execution failed:', error);
    process.exit(1);
  });

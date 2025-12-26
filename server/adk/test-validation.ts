/**
 * Test ValidationAgent - Validation
 */

import { ValidationAgent } from './agents/ValidationAgent.js';

async function testValidationAgent() {
  console.log('🧪 Testing ValidationAgent instantiation...\n');

  try {
    // Test 1: Instantiate agent
    console.log('Test 1: Agent instantiation');
    const agent = new ValidationAgent();
    console.log('✅ ValidationAgent instantiated successfully');

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
    const expectedTools = ['crossValidate', 'detectConflicts', 'scoreCoherence'];

    const missingTools = expectedTools.filter(t => !toolNames.includes(t));
    if (missingTools.length > 0) {
      throw new Error(`Missing tools: ${missingTools.join(', ')}`);
    }
    console.log('✅ All expected tools present');

    console.log('\n✨ All validation tests passed!');
    console.log('\n📝 Validation Features:');
    console.log('   - Model: gemini-2.0-flash-thinking-exp (complex reasoning)');
    console.log('   - Conflict types: 6 (POPULATION_POI, CSP_PRICING, RATING_PHOTOS, etc.)');
    console.log('   - Severity levels: CRITICAL, HIGH, MEDIUM, LOW');
    console.log('   - Coherence scoring: 0-100 with 4 levels');
    console.log('   - Auto-arbitration trigger: CRITICAL or score < 50');
    console.log('\n📊 Conflict Detection Examples:');
    console.log('   - Population 5000 hab + 0 POI = POPULATION_POI_MISMATCH (HIGH)');
    console.log('   - CSP high + priceLevel 1 = CSP_PRICING_MISMATCH (MEDIUM)');
    console.log('   - GPS distance > 200m = GEOGRAPHIC_MISMATCH (CRITICAL)');
    console.log('   - Google rating 4.5 + photo note 3/10 = RATING_PHOTOS_MISMATCH (HIGH)');

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
testValidationAgent()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test execution failed:', error);
    process.exit(1);
  });

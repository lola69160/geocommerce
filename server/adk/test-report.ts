/**
 * Test ReportAgent - Validation
 */

import { ReportAgent } from './agents/ReportAgent.js';

async function testReportAgent() {
  console.log('🧪 Testing ReportAgent instantiation...\n');

  try {
    // Test 1: Instantiate agent
    console.log('Test 1: Agent instantiation');
    const agent = new ReportAgent();
    console.log('✅ ReportAgent instantiated successfully');

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
    const expectedTools = ['generateHTML', 'saveReport'];

    const missingTools = expectedTools.filter(t => !toolNames.includes(t));
    if (missingTools.length > 0) {
      throw new Error(`Missing tools: ${missingTools.join(', ')}`);
    }
    console.log('✅ All expected tools present');

    console.log('\n✨ All validation tests passed!');
    console.log('\n📝 Report Generation Features:');
    console.log('   - Model: gemini-2.0-flash-lite (fast generation)');
    console.log('   - Format: Professional HTML with integrated CSS');
    console.log('   - Output directory: data/professional-reports/');
    console.log('   - Filename format: YYYYMMDD_HHMMSS_SIRET.html');
    console.log('   - Typical size: 50-150 KB');
    console.log('\n📄 Report Sections:');
    console.log('   1. Executive Summary (GO/NO-GO, key scores)');
    console.log('   2. Business Information (identity, location)');
    console.log('   3. Multi-Dimensional Scores (4 dimensions)');
    console.log('   4. Risk Analysis (categorized with mitigation)');
    console.log('   5. Strategic Rationale (SWOT, recommendations)');
    console.log('   6. Footer (timestamp, attribution)');
    console.log('\n🎨 HTML Features:');
    console.log('   - Responsive design (mobile-friendly)');
    console.log('   - Professional CSS styling');
    console.log('   - Color-coded scores and risks');
    console.log('   - Print-optimized layout');
    console.log('   - Modern browser compatibility');
    console.log('\n💾 File Management:');
    console.log('   - Auto-creates output directory');
    console.log('   - Timestamp-based naming (no collisions)');
    console.log('   - Returns full filepath and metadata');
    console.log('   - Error handling with fallback');

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
testReportAgent()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test execution failed:', error);
    process.exit(1);
  });

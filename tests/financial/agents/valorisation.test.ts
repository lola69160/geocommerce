import { describe, it, expect } from 'vitest';
import { ValorisationAgent } from '../../../server/adk/financial/agents/ValorisationAgent';

describe('ValorisationAgent', () => {
  let agent: ValorisationAgent;

  it('should be instantiated correctly', () => {
    agent = new ValorisationAgent();
    expect(agent).toBeDefined();
    expect(agent.name).toBe('valorisation');
  });

  it('should have valuation tools', () => {
    agent = new ValorisationAgent();
    const toolNames = agent.tools.map((t: any) => t.name);

    // Devrait avoir les 3 méthodes de valorisation + synthèse
    expect(toolNames).toContain('calculateEbeValuation');
    expect(toolNames).toContain('calculateCaValuation');
    expect(toolNames).toContain('calculatePatrimonial');
    expect(toolNames).toContain('synthesizeValuation');
  });

  it('should have proper configuration for valuation', () => {
    agent = new ValorisationAgent();
    // L'agent devrait avoir une description pertinente
    expect(agent.description).toBeDefined();
    expect(agent.description.toLowerCase()).toMatch(/valorisation|valuation/);
  });
});

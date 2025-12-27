import { describe, it, expect } from 'vitest';
import { ComptableAgent } from '../../../server/adk/financial/agents/ComptableAgent';

describe('ComptableAgent', () => {
  let agent: ComptableAgent;

  it('should be instantiated correctly', () => {
    agent = new ComptableAgent();
    expect(agent).toBeDefined();
    expect(agent.name).toBe('comptable');
  });

  it('should have accounting analysis tools', () => {
    agent = new ComptableAgent();
    const toolNames = agent.tools.map((t: any) => t.name);

    // Devrait avoir les tools d'analyse comptable
    expect(toolNames).toContain('calculateSig');
    expect(toolNames).toContain('calculateRatios');
    expect(toolNames).toContain('analyzeTrends');
    expect(toolNames).toContain('compareToSector');
    expect(toolNames).toContain('calculateHealthScore');
  });

  it('should have proper configuration for accounting analysis', () => {
    agent = new ComptableAgent();
    // L'agent devrait avoir une description pertinente
    expect(agent.description).toBeDefined();
    expect(agent.description.toLowerCase()).toMatch(/comptable|sig|analyse/);
  });
});

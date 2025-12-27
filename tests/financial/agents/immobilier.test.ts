import { describe, it, expect } from 'vitest';
import { ImmobilierAgent } from '../../../server/adk/financial/agents/ImmobilierAgent';

describe('ImmobilierAgent', () => {
  let agent: ImmobilierAgent;

  it('should be instantiated correctly', () => {
    agent = new ImmobilierAgent();
    expect(agent).toBeDefined();
    expect(agent.name).toBe('immobilier');
  });

  it('should have property analysis tools', () => {
    agent = new ImmobilierAgent();
    const toolNames = agent.tools.map((t: any) => t.name);

    // Devrait avoir les tools immobiliers
    expect(toolNames).toContain('analyzeBail');
    expect(toolNames).toContain('estimateDroitBail');
    expect(toolNames).toContain('analyzeMurs');
    expect(toolNames).toContain('estimateTravaux');
  });

  it('should have proper configuration for real estate analysis', () => {
    agent = new ImmobilierAgent();
    // L'agent devrait avoir une description pertinente
    expect(agent.description).toBeDefined();
    expect(agent.description.toLowerCase()).toMatch(/immobilier|bail|murs/);
  });
});

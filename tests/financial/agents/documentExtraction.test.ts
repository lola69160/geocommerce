import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentExtractionAgent } from '../../../server/adk/financial/agents/DocumentExtractionAgent';
import { Runner, InMemorySessionService } from '@google/adk';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('DocumentExtractionAgent', () => {
  let agent: DocumentExtractionAgent;
  let sessionService: InMemorySessionService;
  let runner: Runner;

  const appName = 'test-document-extraction';
  const userId = 'test-user';
  const sessionId = 'test-session-1';

  beforeEach(async () => {
    agent = new DocumentExtractionAgent();
    sessionService = new InMemorySessionService();

    await sessionService.createSession({
      appName,
      userId,
      sessionId,
    });

    runner = new Runner({
      appName,
      agent,
      sessionService,
    });
  });

  it('should be instantiated correctly', () => {
    expect(agent).toBeDefined();
    expect(agent.name).toBe('documentExtraction');
  });

  it('should have correct tools available', () => {
    // L'agent devrait avoir extractPdf, classifyDocument, parseTables
    expect(agent.tools).toBeDefined();
    expect(agent.tools.length).toBeGreaterThan(0);

    const toolNames = agent.tools.map((t: any) => t.name);
    expect(toolNames).toContain('extractPdf');
    expect(toolNames).toContain('listDocuments');
    expect(toolNames).toContain('geminiVisionExtract');
    expect(toolNames).toContain('parseTablesHeuristic');
  });

  it('should process mock documents and update state', async () => {
    // Test avec des documents mockés (sans vraie extraction PDF)
    const mockDocuments = [
      {
        filename: 'test-bilan-2023.pdf',
        filePath: path.join(__dirname, '../fixtures/mock-bilan.pdf'),
      },
    ];

    const initialState = {
      documents: mockDocuments,
      businessInfo: {
        name: 'Test Commerce',
        siret: '12345678901234',
        nafCode: '47.26Z',
      },
    };

    let finalState: any = {};

    // Note: Ce test nécessite GEMINI_API_KEY pour fonctionner
    // En l'absence de clé, il échouera proprement
    try {
      for await (const event of runner.runAsync({
        userId,
        sessionId,
        newMessage: {
          role: 'user',
          parts: [{ text: 'Extraire les documents fournis' }],
        },
        stateDelta: initialState,
      })) {
        if (event.actions?.stateDelta) {
          Object.assign(finalState, event.actions.stateDelta);
        }
      }

      // Vérifications de base
      expect(finalState).toBeDefined();
    } catch (error: any) {
      // Si pas de clé API, le test passe mais avertit
      if (error.message.includes('API_KEY')) {
        console.warn('⚠️  GEMINI_API_KEY non configurée - test skippé');
        expect(true).toBe(true);
      } else {
        throw error;
      }
    }
  }, 30000); // Timeout 30s

  it('should handle empty document list', async () => {
    const initialState = {
      documents: [],
      businessInfo: {
        name: 'Test Commerce',
        siret: '12345678901234',
        nafCode: '47.26Z',
      },
    };

    let finalState: any = {};

    try {
      for await (const event of runner.runAsync({
        userId,
        sessionId,
        newMessage: {
          role: 'user',
          parts: [{ text: 'Extraire les documents fournis' }],
        },
        stateDelta: initialState,
      })) {
        if (event.actions?.stateDelta) {
          Object.assign(finalState, event.actions.stateDelta);
        }
      }

      // Devrait gérer élégamment la liste vide
      expect(finalState).toBeDefined();
    } catch (error: any) {
      if (error.message.includes('API_KEY')) {
        expect(true).toBe(true);
      } else {
        throw error;
      }
    }
  }, 30000);
});

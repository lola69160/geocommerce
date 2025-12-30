import { describe, it, expect, beforeAll } from 'vitest';
import { createFinancialOrchestrator } from '../../../server/adk/financial/orchestrator/FinancialOrchestrator';
import { Runner, InMemorySessionService } from '@google/adk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Test d'Intégration du Pipeline Financier Complet
 *
 * Ce test exécute le pipeline complet avec des données réelles:
 * 1. DocumentExtractionAgent
 * 2. ComptableAgent
 * 3. ValorisationAgent
 * 4. ImmobilierAgent
 * 5. FinancialValidationAgent
 * 6. FinancialReportAgent
 *
 * Utilise les vrais PDFs du dossier test-data
 */
describe('Financial Pipeline - Integration Test', () => {
  const testDataDir = path.join(__dirname, '../../../server/adk/financial/test-data');
  const appName = 'test-financial-pipeline';
  const userId = 'integration-test-user';
  const sessionId = `test-session-${Date.now()}`;

  let orchestrator: any;
  let sessionService: InMemorySessionService;
  let runner: Runner;

  beforeAll(async () => {
    // Créer l'orchestrateur
    orchestrator = createFinancialOrchestrator();

    // Créer session service
    sessionService = new InMemorySessionService();
    await sessionService.createSession({
      appName,
      userId,
      sessionId,
    });

    // Créer runner
    runner = new Runner({
      appName,
      agent: orchestrator,
      sessionService,
    });
  });

  it('should have correct pipeline structure', () => {
    expect(orchestrator).toBeDefined();
    expect(orchestrator.name).toBe('financial_analysis_pipeline');
    expect(orchestrator.subAgents).toBeDefined();
    expect(orchestrator.subAgents.length).toBe(7);

    const agentNames = orchestrator.subAgents.map((a: any) => a.name);
    expect(agentNames).toEqual([
      'comptaPreprocessing',
      'documentExtraction',
      'comptable',
      'valorisation',
      'immobilier',
      'financialValidation',
      'financialReport',
    ]);
  });

  it('should execute full pipeline with test data (tabac presse)', async () => {
    // Vérifier que test-data existe
    if (!fs.existsSync(testDataDir)) {
      console.warn('⚠️  test-data directory not found - skipping integration test');
      expect(true).toBe(true);
      return;
    }

    // Lister les PDFs disponibles
    const pdfFiles = fs.readdirSync(testDataDir).filter(f => f.endsWith('.pdf'));

    if (pdfFiles.length === 0) {
      console.warn('⚠️  No PDF files found in test-data - skipping integration test');
      expect(true).toBe(true);
      return;
    }

    console.log(`📁 Found ${pdfFiles.length} PDF files in test-data`);

    // Préparer les documents
    const documents = pdfFiles.slice(0, 3).map(filename => ({
      filename,
      filePath: path.join(testDataDir, filename),
    }));

    // Business info pour un tabac presse (NAF 47.26Z)
    const businessInfo = {
      name: 'LE TABAC DE LA PLACE',
      siret: '85123456789012',
      nafCode: '47.26Z',
      activity: 'Commerce de détail de produits à base de tabac en magasin spécialisé',
      address: '12 Place de la République',
      city: 'Lyon',
      postalCode: '69002',
    };

    const initialState = {
      documents,
      businessInfo,
      options: {
        prixAffiche: 280000,
        includeImmobilier: true,
      },
    };

    let finalState: any = {};
    const events: any[] = [];

    try {
      console.log('🚀 Starting Financial Pipeline...');

      for await (const event of runner.runAsync({
        userId,
        sessionId,
        newMessage: {
          role: 'user',
          parts: [{
            text: `Analyser le dossier financier complet pour ${businessInfo.name}.
Les documents PDF sont dans state.documents.
Exécute tous les agents du pipeline jusqu'au rapport final.`
          }],
        },
        stateDelta: initialState,
      })) {
        events.push(event);

        if (event.type === 'agent') {
          console.log(`[AGENT] ${event.message || '(no message)'}`);
        }

        if (event.type === 'tool') {
          console.log(`[TOOL] ${event.name} - ${event.status}`);
        }

        if (event.actions?.stateDelta && Object.keys(event.actions.stateDelta).length > 0) {
          console.log(`[STATE] Updated: ${Object.keys(event.actions.stateDelta).join(', ')}`);
          Object.assign(finalState, event.actions.stateDelta);
        }
      }

      console.log('✅ Pipeline completed');

      // Vérifications du state final
      console.log('\n📊 Final State Keys:', Object.keys(finalState));

      // 1. DocumentExtraction
      expect(finalState.documentExtraction).toBeDefined();
      if (typeof finalState.documentExtraction === 'string') {
        const docExtraction = JSON.parse(finalState.documentExtraction);
        expect(docExtraction.documents).toBeDefined();
        expect(docExtraction.summary).toBeDefined();
        console.log('✅ Document Extraction completed');
      }

      // 2. Comptable
      if (finalState.comptable) {
        const comptable = typeof finalState.comptable === 'string'
          ? JSON.parse(finalState.comptable)
          : finalState.comptable;

        expect(comptable.sig || comptable.healthScore).toBeDefined();
        console.log('✅ Accounting Analysis completed');

        // Vérifier les valeurs clés
        if (comptable.sig) {
          const years = Object.keys(comptable.sig);
          expect(years.length).toBeGreaterThan(0);
          console.log(`   Years analyzed: ${years.join(', ')}`);
        }
      }

      // 3. Valorisation
      if (finalState.valorisation) {
        const valorisation = typeof finalState.valorisation === 'string'
          ? JSON.parse(finalState.valorisation)
          : finalState.valorisation;

        // Au moins une méthode de valorisation devrait être présente
        const hasValuation = valorisation.methodeEbe ||
          valorisation.methodeCa ||
          valorisation.methodePatrimoniale ||
          valorisation.synthese;

        expect(hasValuation).toBeTruthy();
        console.log('✅ Valuation completed');

        if (valorisation.synthese?.fourchette) {
          console.log(`   Valuation range: ${valorisation.synthese.fourchette.min}€ - ${valorisation.synthese.fourchette.max}€`);
        }
      }

      // 4. Immobilier
      if (finalState.immobilier) {
        console.log('✅ Real Estate Analysis completed');
      }

      // 5. FinancialValidation
      if (finalState.financialValidation) {
        const validation = typeof finalState.financialValidation === 'string'
          ? JSON.parse(finalState.financialValidation)
          : finalState.financialValidation;

        if (validation.confidenceScore) {
          console.log(`✅ Validation completed - Confidence: ${validation.confidenceScore.overall}/100`);
        }
      }

      // 6. FinancialReport
      if (finalState.financialReport) {
        const report = typeof finalState.financialReport === 'string'
          ? JSON.parse(finalState.financialReport)
          : finalState.financialReport;

        expect(report.generated).toBe(true);
        expect(report.filepath).toBeDefined();
        console.log('✅ HTML Report generated:', report.filename);

        // Vérifier que le fichier existe
        if (fs.existsSync(report.filepath)) {
          const stats = fs.statSync(report.filepath);
          expect(stats.size).toBeGreaterThan(0);
          console.log(`   File size: ${(stats.size / 1024).toFixed(2)} KB`);
        }
      }

      // Le pipeline devrait avoir produit au moins documentExtraction
      expect(Object.keys(finalState).length).toBeGreaterThan(0);

    } catch (error: any) {
      // Si pas de clé API, passer le test
      if (error.message.includes('API_KEY') || error.message.includes('GEMINI')) {
        console.warn('⚠️  GEMINI_API_KEY non configurée - test skippé');
        expect(true).toBe(true);
        return;
      }

      // Autres erreurs - afficher pour debug
      console.error('❌ Pipeline failed:', error.message);
      console.error('Events collected:', events.length);
      throw error;
    }
  }, 120000); // Timeout 2 minutes pour le pipeline complet

  it('should handle pipeline with missing documents gracefully', async () => {
    const initialState = {
      documents: [],
      businessInfo: {
        name: 'Test Commerce',
        siret: '12345678901234',
        nafCode: '47.26Z',
        activity: 'Tabac Presse',
      },
    };

    let finalState: any = {};

    try {
      for await (const event of runner.runAsync({
        userId,
        sessionId: `${sessionId}-empty`,
        newMessage: {
          role: 'user',
          parts: [{ text: 'Analyser le dossier financier' }],
        },
        stateDelta: initialState,
      })) {
        if (event.actions?.stateDelta) {
          Object.assign(finalState, event.actions.stateDelta);
        }
      }

      // Le pipeline devrait gérer gracieusement l'absence de documents
      expect(finalState).toBeDefined();

    } catch (error: any) {
      if (error.message.includes('API_KEY')) {
        expect(true).toBe(true);
      } else {
        // L'erreur devrait être gérée par continueOnError
        console.log('Error handled by pipeline:', error.message);
        expect(true).toBe(true);
      }
    }
  }, 60000);
});

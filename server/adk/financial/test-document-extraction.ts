/**
 * Test Manuel - DocumentExtractionAgent
 *
 * Test de l'extraction et classification de documents PDF comptables
 *
 * PRÉREQUIS :
 * 1. Créer un dossier : server/adk/financial/test-data/
 * 2. Y placer des PDF de test (bilans, liasses fiscales, etc.)
 * 3. Configurer GEMINI_API_KEY dans .env
 *
 * USAGE :
 * npx tsx server/adk/financial/test-document-extraction.ts
 */

// Charger .env AVANT tout import ADK
import { config } from 'dotenv';
config();

import { Runner, InMemorySessionService } from '@google/adk';
import { DocumentExtractionAgent } from './agents/DocumentExtractionAgent';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Obtenir __dirname en mode ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testDocumentExtraction() {
  console.log('================================================================================');
  console.log('🧪 TEST: DocumentExtractionAgent');
  console.log('================================================================================\n');

  // Configuration
  const testDataDir = path.join(__dirname, 'test-data');

  // Vérifier que le dossier test-data existe
  if (!fs.existsSync(testDataDir)) {
    console.log('⚠️  Dossier test-data/ introuvable.');
    console.log('   Création du dossier avec un document PDF de démonstration...\n');

    fs.mkdirSync(testDataDir, { recursive: true });

    // Créer un fichier texte simple pour tester (pas un vrai PDF)
    const demoContent = `BILAN COMPTABLE
Exercice clos le 31/12/2024

ACTIF                    2024        2023
Immobilisations        50 000      45 000
Stocks                 30 000      28 000
Créances               20 000      18 000
Trésorerie             15 000      12 000
TOTAL ACTIF           115 000     103 000

PASSIF                   2024        2023
Capitaux propres       60 000      55 000
Dettes fournisseurs    40 000      35 000
Emprunts               15 000      13 000
TOTAL PASSIF          115 000     103 000`;

    fs.writeFileSync(
      path.join(testDataDir, 'demo-bilan-2024.txt'),
      demoContent,
      'utf-8'
    );

    console.log('✅ Fichier de démonstration créé : test-data/demo-bilan-2024.txt\n');
    console.log('⚠️  ATTENTION: Ce test nécessite de vrais PDF pour fonctionner correctement.');
    console.log('   Placez vos PDF dans server/adk/financial/test-data/ et relancez le test.\n');
    console.log('   Pour l\'instant, le test va s\'arrêter ici car pdf-parse ne peut pas lire des .txt\n');
    return;
  }

  // Lister les fichiers dans test-data
  const files = fs.readdirSync(testDataDir).filter(f => f.endsWith('.pdf'));

  if (files.length === 0) {
    console.log('⚠️  Aucun fichier PDF trouvé dans test-data/');
    console.log('   Placez des PDF de test (bilans, liasses fiscales) et relancez.\n');
    return;
  }

  console.log(`📁 Fichiers trouvés : ${files.length}`);
  files.forEach(f => console.log(`   - ${f}`));
  console.log('');

  // Préparer les documents pour le state initial
  const documents = files.map(filename => ({
    filename,
    filePath: path.join(testDataDir, filename)
  }));

  // Créer l'agent
  const agent = new DocumentExtractionAgent();

  // Configuration session
  const appName = 'financial-test-extraction';
  const userId = 'test-user';
  const sessionId = `test-session-${Date.now()}`;

  // State initial
  const initialState = {
    documents,
    businessInfo: {
      name: 'Commerce Test XYZ',
      siret: '12345678901234',
      nafCode: '47.26Z',
      activity: 'Tabac / Presse'
    }
  };

  // Créer session service et session
  const sessionService = new InMemorySessionService();
  await sessionService.createSession({
    appName,
    userId,
    sessionId
  });

  // Créer le runner ADK
  const runner = new Runner({
    appName,
    agent,
    sessionService
  });

  console.log('🚀 Lancement de DocumentExtractionAgent...\n');

  let finalState: any = {};

  try {
    // Construire le message avec la liste des documents
    const documentsList = documents.map(d => d.filename).join('\n- ');
    const message = `Extraire et classifier les documents comptables suivants :

Documents reçus (${documents.length}) :
- ${documentsList}

Les fichiers sont disponibles dans state.documents pour les tools.
Appelle extractPdf(), classifyDocument() et parseTables() pour chaque document.`;

    for await (const event of runner.runAsync({
      userId,
      sessionId,
      newMessage: {
        role: 'user',
        parts: [{
          text: message
        }]
      },
      stateDelta: initialState
    })) {
      // Logger les events
      if (event.type === 'agent') {
        console.log(`[${event.type.toUpperCase()}] ${event.message || '(no message)'}`);
      }

      if (event.type === 'tool') {
        console.log(`[TOOL] ${event.name} - ${event.status}`);
        if (event.status === 'error') {
          console.log(`       Error: ${JSON.stringify(event.error)}`);
        }
      }

      // Collecter le state final
      if (event.actions?.stateDelta && Object.keys(event.actions.stateDelta).length > 0) {
        console.log(`[STATE UPDATE] Keys: ${Object.keys(event.actions.stateDelta).join(', ')}`);
        Object.assign(finalState, event.actions.stateDelta);
      }
    }

    console.log('\n================================================================================');
    console.log('✅ EXTRACTION TERMINÉE');
    console.log('================================================================================\n');

    // Afficher les résultats
    if (finalState.documentExtraction) {
      const result = typeof finalState.documentExtraction === 'string'
        ? JSON.parse(finalState.documentExtraction)
        : finalState.documentExtraction;

      console.log('📊 RÉSULTATS :');
      console.log(`   Documents extraits : ${result.summary?.total_documents || 0}`);
      console.log(`   Années couvertes : ${result.summary?.years_covered?.join(', ') || 'N/A'}`);
      console.log('');

      if (result.documents && result.documents.length > 0) {
        result.documents.forEach((doc: any, idx: number) => {
          console.log(`${idx + 1}. ${doc.filename}`);
          console.log(`   Type : ${doc.documentType}`);
          console.log(`   Année : ${doc.year || 'N/A'}`);
          console.log(`   Confiance : ${(doc.confidence * 100).toFixed(1)}%`);
          console.log(`   Tableaux extraits : ${doc.extractedData?.tables?.length || 0}`);
          console.log('');
        });
      }

      if (result.summary?.missing_documents?.length > 0) {
        console.log('⚠️  Documents manquants suggérés :');
        result.summary.missing_documents.forEach((doc: string) => {
          console.log(`   - ${doc}`);
        });
        console.log('');
      }

      // Afficher le JSON complet
      console.log('📄 JSON COMPLET :');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('⚠️  Aucun résultat dans state.documentExtraction');
    }

  } catch (error: any) {
    console.error('\n❌ ERREUR lors de l\'extraction :');
    console.error(error.message);
    console.error(error.stack);
  }
}

// Exécuter le test
testDocumentExtraction().catch(console.error);

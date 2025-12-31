import { FunctionTool } from '@google/adk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ToolContext } from '@google/adk';
import fs from 'fs/promises';
import path from 'path';
import { zToGen } from '../../../utils/schemaHelper';
import {
  VisionExtractionInputSchema,
  GeminiResponseSchema,
  ComptaGeminiResponseSchema
} from '../../schemas/visionExtractionSchema';
import { extractPdfTool } from './extractPdfTool';
import {
  isComptaPreprocessedDocument,
  extractYearFromComptaFilename,
  type ExtractionComptaComplete
} from '../../schemas/extractionComptaSchema';
import { logDocumentExtraction } from '../../../utils/extractionLogger';

/**
 * Helper: Extrait la valeur numérique d'un champ SIG
 * Gère les deux formats possibles:
 * - Nombre simple: 35169
 * - Objet structuré: { valeur: 35169, pct_ca: 14.37 }
 */
function extractSigNumericValue(field: any): number {
  if (field === null || field === undefined) return 0;
  if (typeof field === 'number') return field;
  if (typeof field === 'object' && 'valeur' in field) {
    return typeof field.valeur === 'number' ? field.valeur : 0;
  }
  // Essayer de parser comme nombre
  const parsed = parseFloat(field);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Gemini Vision Extract Tool
 *
 * Extrait les données comptables d'un PDF en utilisant Gemini Vision API.
 * Cette approche remplace les heuristiques regex fragiles par une compréhension visuelle du document.
 *
 * Avantages:
 * - Précision ~95% vs ~30% avec heuristiques
 * - Supporte PDFs scannés (OCR intégré)
 * - Comprend la structure visuelle des tableaux
 * - Pas de regex à maintenir
 * - Gère formats variés et multi-colonnes
 *
 * Coût: ~$0.0014 par PDF (3 pages) avec Gemini Flash
 * Latence: 3-4 secondes (acceptable pour analyse financière)
 */

const VISION_EXTRACTION_PROMPT = `Tu es un expert-comptable français spécialisé dans l'analyse de documents comptables.

Analyse ce document PDF et extrait TOUTES les informations comptables structurées.

DOCUMENT TYPE DETECTION (analyser le CONTENU, pas seulement le titre):
- "bilan" : Contient UNIQUEMENT un tableau ACTIF + PASSIF (immobilisations, stocks, créances / capitaux propres, dettes)
- "compte_resultat" : Contient UNIQUEMENT un tableau PRODUITS + CHARGES (ventes, prestations / achats, personnel, dotations)
- "liasse_fiscale" : Document COMPLET contenant PLUSIEURS sections :
  * BILAN (ACTIF + PASSIF)
  * COMPTE DE RÉSULTAT (PRODUITS + CHARGES)
  * Souvent aussi : SIG, annexes, tableaux détaillés
  * Peut être formulaires Cerfa 2050-2059 ou liasse expert-comptable
  * Critère clé : présence de BILAN ET COMPTE DE RÉSULTAT dans le même document
- "bail" : Contrat de location commerciale 3-6-9
- "projet_vente" : Proposition de cession de fonds de commerce
- "cout_transaction" : Document détaillant coûts acquisition (prix fonds, honoraires, frais, stock, financement)
- "autre" : Non identifié

RÈGLE IMPORTANTE: Si le document contient BILAN + COMPTE DE RÉSULTAT → type = "liasse_fiscale"
                  Sinon, utiliser "bilan" ou "compte_resultat" selon le contenu dominant.

YEAR EXTRACTION:
- Chercher "Exercice clos le DD/MM/YYYY" ou "Période du DD/MM/YYYY au DD/MM/YYYY"
- Format de sortie: YYYY (nombre entier)
- Si plusieurs années présentes dans les colonnes, prendre la plus récente

EXTRACTION PRIORITAIRE (par ordre d'importance):

1. BILAN COMPTABLE (ACTIF + PASSIF) - CRITIQUE si présent
   Extraire TOUS les postes du bilan :
   - ACTIF IMMOBILISÉ :
     * Immobilisations incorporelles (fonds de commerce, logiciels)
     * Immobilisations corporelles (installations, matériel, mobilier, agencements)
     * Immobilisations financières
   - ACTIF CIRCULANT :
     * Stocks et en-cours
     * Créances clients
     * Disponibilités (banque, caisse)
     * Charges constatées d'avance
   - PASSIF :
     * Capitaux propres (capital, réserves, report à nouveau, résultat)
     * Provisions pour risques et charges
     * Dettes fournisseurs
     * Dettes fiscales et sociales
     * Dettes financières (emprunts)
     * Produits constatés d'avance

2. COMPTE DE RÉSULTAT - CRITIQUE si présent
   Extraire TOUS les postes :
   - PRODUITS D'EXPLOITATION :
     * Ventes de marchandises
     * Production vendue (services, biens produits)
     * Subventions d'exploitation
     * Autres produits d'exploitation
   - ACHATS ET CHARGES EXTERNES :
     * Achats de marchandises
     * Variation de stocks
     * Achats de matières premières
     * Loyers et charges locatives
     * Assurances
     * Honoraires et services extérieurs
     * Publicité
   - CHARGES DE PERSONNEL :
     * Salaires bruts
     * Charges sociales
   - DOTATIONS ET PROVISIONS :
     * Dotations aux amortissements
     * Dotations aux provisions
   - RÉSULTATS :
     * Résultat d'exploitation
     * Résultat financier (produits - charges financières)
     * Résultat exceptionnel
     * Impôts sur les bénéfices
     * Résultat net

3. SIG (SOLDES INTERMÉDIAIRES DE GESTION) - IMPORTANT si présent
   Extraire si présents :
   - Chiffre d'affaires
   - Marge commerciale
   - Valeur ajoutée
   - EBE (Excédent Brut d'Exploitation)
   - Résultat d'exploitation
   - Résultat courant avant impôts
   - Résultat net

4. ANNEXES & DÉTAILS - UTILE si présent
   Extraire si présents :
   - Détail des immobilisations et amortissements
   - État des échéances des créances et dettes (< 1 mois, 1-3 mois, 3-6 mois, > 6 mois)
   - Détail des provisions
   - Rémunération des dirigeants
   - Effectifs (nombre de salariés)
   - Engagements hors bilan (cautions, crédit-bail)
   - Détail des charges exceptionnelles

RÈGLES D'EXTRACTION:
- Extraire TOUTES les valeurs numériques trouvées (même si certaines semblent redondantes)
- Pour chaque tableau, capturer l'année fiscale (ex: 2023, 2022, 2021)
- Convertir TOUS les montants en NOMBRES (pas de strings)
  * Format français : "50 000" → 50000, "1,5" → 1.5
  * Nettoyer symboles € et espaces
  * Gérer négatifs (pertes) : utiliser nombres négatifs
- Si un poste n'est pas présent, ne pas l'inventer (retourner null ou omettre)
- Conserver la structure hiérarchique (ex: ACTIF IMMOBILISÉ > Immobilisations corporelles > Installations techniques)
- Pour tableaux multi-années (colonnes N, N-1, N-2), extraire TOUTES les colonnes

TABLE EXTRACTION:
- Inclure le caption/titre de chaque tableau (ex: "ACTIF", "PASSIF", "COMPTE DE RÉSULTAT")
- Préserver la structure : headers + rows
- NE PAS arrondir les montants (garder précision exacte)

INSTRUCTIONS CRITIQUES POUR EXTRACTION RÉUSSIE:
1. Si un montant n'est pas trouvé, ne pas inventer de valeur → retourner null
2. Pour les bilans multi-années (colonnes N, N-1, N-2), TOUJOURS extraire l'année la plus récente (colonne N)
3. Les montants doivent être en euros (nombre entier ou décimal, SANS symbole €)
4. Si une ligne du bilan/compte de résultat est vide ou à 0, indiquer explicitement 0 (pas null)
5. Pour les SIG : si présents dans le document, les extraire en priorité (plus fiables que recalcul)
6. VÉRIFIER la cohérence : Total ACTIF = Total PASSIF, Résultat Net cohérent avec CA

CONFIDENCE SCORING:
- 0.9-1.0 : Document parfaitement lisible, toutes sections extraites, cohérence validée
- 0.7-0.9 : Document lisible, sections principales extraites, quelques données manquantes
- 0.5-0.7 : Document partiellement lisible, extraction incomplète mais utilisable
- 0.3-0.5 : Document difficile à lire, extraction très partielle
- 0.0-0.3 : Document illisible ou type non reconnu

Facteurs réduisant le score:
- Document scanné de mauvaise qualité (baisser de -0.2)
- Tableaux mal alignés ou coupés (baisser de -0.1)
- Années multiples sans clarté sur laquelle extraire (baisser de -0.1)
- Montants manquants dans sections critiques (baisser de -0.2 par section)

REASONING:
Explique brièvement :
1. Pourquoi tu as classifié le document ainsi (bilan/compte_resultat/liasse_fiscale)
2. Quelles sections tu as trouvées (BILAN, COMPTE DE RÉSULTAT, SIG, ANNEXES)
3. Ton niveau de confiance et pourquoi
4. Si des sections sont manquantes ou incomplètes

FORMAT DE SORTIE:
Retourner un JSON avec TOUS les tableaux identifiés, même s'ils semblent similaires.
Structure exacte attendue:
{
  "documentType": "liasse_fiscale" | "bilan" | "compte_resultat" | "bail" | "cout_transaction" | "autre",
  "year": 2023,
  "confidence": 0.85,
  "extraction_details": {
    "bilan_present": true,
    "compte_resultat_present": true,
    "sig_present": false,
    "annexes_presentes": false,
    "nb_lignes_bilan_extraites": 15,
    "nb_lignes_compte_resultat_extraites": 12
  },
  "accounting_values": { ... },
  "tables": [...],
  "reasoning": "Document de type liasse fiscale 2023. Bilan et compte de résultat complets extraits. Pas de SIG détaillé. Confidence 0.85 car tableau bien structuré mais quelques lignes d'annexes manquantes."
}`;

/**
 * PROMPT SPÉCIALISÉ POUR DOCUMENTS COMPTA PRÉPROCESSÉS
 *
 * Ces documents ont une structure standardisée avec 4 sections:
 * - Page 1: BILAN ACTIF
 * - Page 2: BILAN PASSIF
 * - Pages 3-4: COMPTE DE RÉSULTAT
 * - Pages 5-6: SOLDES INTERMÉDIAIRES DE GESTION (SIG)
 *
 * Ce prompt extrait de manière exhaustive tous les postes comptables
 * avec les % CA pour le SIG.
 */
const COMPTA_EXTRACTION_PROMPT = `Tu es un expert-comptable français. Analyse ce document comptable COMPTA préprocessé.

Ce document contient EXACTEMENT 4 SECTIONS standardisées:
1. BILAN ACTIF (page 1)
2. BILAN PASSIF (page 2)
3. COMPTE DE RÉSULTAT (pages 3-4)
4. SIG - SOLDES INTERMÉDIAIRES DE GESTION (pages 5-6)

RÈGLES CRITIQUES:
- Extraire UNIQUEMENT les valeurs de l'année N (colonne la plus récente, généralement "Exercice N")
- NE PAS extraire l'année N-1
- Convertir TOUS les montants en nombres entiers (pas de strings)
- Format français : "50 000" → 50000, "1,5" → 1.5
- Si une valeur est manquante ou vide → 0 (pas null)
- Pour le SIG: extraire OBLIGATOIREMENT la valeur EN EUROS ET le % CA

MÉTADONNÉES À EXTRAIRE:
- Nom de la société (en-tête de chaque page)
- Adresse (sous le nom)
- Date de clôture: format "DD/MM/YYYY" (ex: "30/11/2023")
- Durée de l'exercice en mois (généralement 12)
- Année fiscale: extraire l'année de la date de clôture

═══════════════════════════════════════════════════════════════════════════════
SECTION 1: BILAN ACTIF
═══════════════════════════════════════════════════════════════════════════════

⚠️ IMPORTANT: Pour le BILAN ACTIF, les colonnes typiques sont: Brut | Amortissements/Dépréciations | Net
→ TOUJOURS utiliser la colonne NET (valeur après amortissements) pour les totaux!
→ Pour total_general_actif: prendre la valeur de la colonne NET, pas BRUT!

Extraire avec colonnes Brut/Amortissements/Net pour les IMMOBILISATIONS:

IMMOBILISATIONS INCORPORELLES:
- concessions_brevets: Concessions, brevets et droits similaires
- fonds_commercial: Fonds commercial
- autres_immob_incorp: Autres immobilisations incorporelles

IMMOBILISATIONS CORPORELLES:
- terrains: Terrains
- constructions: Constructions
- installations_techniques: Installations techniques, matériel et outillage
- autres_immob_corp: Autres immobilisations corporelles (mobilier, agencements)

IMMOBILISATIONS FINANCIÈRES (valeur nette uniquement):
- participations: Participations
- autres_immob_fin: Autres immobilisations financières

TOTAUX IMMOBILISÉ:
- total_actif_immobilise: Total II (avec Brut/Amort/Net)

ACTIF CIRCULANT (valeur nette uniquement):
- stocks_marchandises: Marchandises
- stocks_matieres_premieres: Matières premières et approvisionnements
- creances_clients: Clients et comptes rattachés
- autres_creances: Autres créances
- disponibilites: Disponibilités
- charges_constatees_avance: Charges constatées d'avance
- total_actif_circulant: Total III

TOTAL:
- total_general_actif: TOTAL GÉNÉRAL (I+II+III+IV+V+VI) ⚠️ UTILISER LA COLONNE NET (pas Brut!)

═══════════════════════════════════════════════════════════════════════════════
SECTION 2: BILAN PASSIF
═══════════════════════════════════════════════════════════════════════════════

CAPITAUX PROPRES:
- capital: Capital (Dont versé)
- primes_emission: Primes d'émission, de fusion, d'apport
- reserves: Total des réserves
- report_a_nouveau: Report à nouveau
- resultat_exercice: Résultat de l'exercice (Bénéfice ou perte)
- subventions_investissement: Subventions d'investissement
- provisions_reglementees: Provisions réglementées
- total_capitaux_propres: Total I

PROVISIONS:
- provisions_risques: Provisions pour risques
- provisions_charges: Provisions pour charges
- total_provisions: Total III

DETTES:
- emprunts_etablissements_credit: Emprunts auprès d'établissements de crédit
- concours_bancaires_courants: Concours bancaires courants
- emprunts_dettes_financieres_diverses: Emprunts et dettes financières diverses
- dettes_fournisseurs: Dettes fournisseurs et comptes rattachés
- dettes_fiscales_sociales: Dettes fiscales et sociales
- autres_dettes: Autres dettes
- produits_constates_avance: Produits constatés d'avance
- total_dettes: Total IV

TOTAL:
- total_general_passif: TOTAL GÉNÉRAL (I+II+III+IV+V)

NOTE BAS DE PAGE:
- dettes_moins_1_an: Dettes et produits constatés d'avance à moins d'un an

═══════════════════════════════════════════════════════════════════════════════
SECTION 3: COMPTE DE RÉSULTAT
═══════════════════════════════════════════════════════════════════════════════

PRODUITS D'EXPLOITATION:
- ventes_marchandises: Ventes de marchandises (boutique, articles non réglementés)
- production_vendue_biens: Production vendue de biens
- production_vendue_services: Production vendue de services
  ⚠️ CRITIQUE TABAC/PRESSE: Cette ligne contient les COMMISSIONS RÉGLEMENTÉES
  (tabac, loto, FDJ, presse, PMU, téléphonie). NE PAS confondre avec CA boutique!
  Chercher aussi: "Prestations de services", "Vente de services", "Commissions"
- chiffre_affaires_net: Chiffre d'affaires NET (somme des ventes + production)
- production_stockee: Production stockée
- production_immobilisee: Production immobilisée
- subventions_exploitation: Subventions d'exploitation
- reprises_depreciations_provisions: Reprises sur dépréciations, provisions
- autres_produits: Autres produits
- total_produits_exploitation: Total des Produits d'exploitation (I)

CHARGES D'EXPLOITATION:
- achats_marchandises: Achats de marchandises
- variation_stock_marchandises: Variation de stock (marchandises)
- achats_matieres_premieres: Achats de matières premières
- variation_stock_matieres: Variation de stock (matières premières)
- autres_achats_charges_externes: Autres achats et charges externes
- impots_taxes: Impôts, taxes et versements assimilés
- salaires_traitements: Salaires et traitements
- charges_sociales: Charges sociales
- dotations_amortissements_immob: Dotations aux amortissements sur immobilisations
- dotations_provisions: Dotations aux provisions
- autres_charges: Autres charges
- total_charges_exploitation: Total des Charges d'exploitation (II)

RÉSULTATS:
- resultat_exploitation: Résultat d'exploitation (I-II)
- total_produits_financiers: Total V - Produits financiers
- interets_charges_assimilees: Intérêts et charges assimilées
- total_charges_financieres: Total VI - Charges financières
- resultat_financier: Résultat financier (V-VI)
- resultat_courant_avant_impots: Résultat courant avant impôts
- produits_except_operations_gestion: Produits exceptionnels sur opérations de gestion
- produits_except_operations_capital: Produits exceptionnels sur opérations en capital
- total_produits_exceptionnels: Total VII - Produits exceptionnels
- charges_except_operations_gestion: Charges exceptionnelles sur opérations de gestion
- charges_except_operations_capital: Charges exceptionnelles sur opérations en capital
- total_charges_exceptionnelles: Total VIII - Charges exceptionnelles
- resultat_exceptionnel: Résultat exceptionnel (VII-VIII)
- participation_salaries: Participation des salariés
- impots_sur_benefices: Impôts sur les bénéfices
- total_produits: Total des produits
- total_charges: Total des charges
- resultat_net: Bénéfice ou perte (résultat net)

═══════════════════════════════════════════════════════════════════════════════
SECTION 4: SIG - SOLDES INTERMÉDIAIRES DE GESTION
═══════════════════════════════════════════════════════════════════════════════

⚠️ SECTION CRITIQUE - EXTRAIRE TOUS LES INDICATEURS CI-DESSOUS

EXTRAIRE POUR CHAQUE LIGNE: { valeur: nombre, pct_ca: nombre }
Le % CA se trouve dans la colonne "% CA" ou "%" du tableau SIG.

FORMAT ATTENDU POUR CHAQUE CHAMP:
{
  "chiffre_affaires": { "valeur": 240597, "pct_ca": 100 },
  "marge_brute_globale": { "valeur": 159324, "pct_ca": 66.22 }
}

INDICATEURS À EXTRAIRE (OBLIGATOIRES):
- chiffre_affaires: Ventes marchandises + Production (ligne de référence 100%)
- ventes_marchandises: Ventes de marchandises
- cout_achat_marchandises_vendues: Coût d'achat des marchandises vendues
- marge_commerciale: MARGE COMMERCIALE (différent de marge_brute_globale!)
- production_vendue: Production vendue
- production_vendue_services: Production vendue de services ⚠️ CRITIQUE TABAC/PRESSE = COMMISSIONS (tabac, loto, FDJ, presse, PMU)
- production_exercice: PRODUCTION DE L'EXERCICE
- marge_brute_production: Marge brute de production (si présent)
- marge_brute_globale: MARGE BRUTE GLOBALE ⚠️ DIFFÉRENT de marge_commerciale - c'est la marge incluant production
- autres_achats_charges_externes: Autres achats et charges externes ⚠️ CRITIQUE - ligne "Autres achats + charges externes"
- valeur_ajoutee: VALEUR AJOUTÉE
- subventions_exploitation: Subventions d'exploitation (si présent)
- impots_taxes: Impôts, taxes et versements assimilés
- salaires_personnel: Salaires du personnel ⚠️ CRITIQUE - NE PAS confondre avec charges_exploitant
- charges_sociales_personnel: Charges sociales du personnel ⚠️ CRITIQUE
- charges_exploitant: CHARGES DE L'EXPLOITANT ⚠️ IMPORTANT: C'est le salaire du dirigeant (TNS)!
- ebe: EXCÉDENT BRUT D'EXPLOITATION (EBE)
- autres_produits_gestion: Autres produits de gestion courante
- autres_charges_gestion: Autres charges de gestion courante
- reprises_amortissements_provisions: Reprises amortissements provisions
- dotations_amortissements: Dotations aux amortissements
- resultat_exploitation: RÉSULTAT D'EXPLOITATION
- produits_financiers: Produits financiers
- charges_financieres: Charges financières
- resultat_courant: RÉSULTAT COURANT
- produits_exceptionnels: Produits exceptionnels
- charges_exceptionnelles: Charges exceptionnelles
- resultat_exceptionnel: RÉSULTAT EXCEPTIONNEL
- resultat_net: RÉSULTAT NET

EXEMPLE D'EXTRACTION SIG ATTENDUE:
{
  "chiffre_affaires": { "valeur": 240597, "pct_ca": 100 },
  "ventes_marchandises": { "valeur": 120455, "pct_ca": 50.07 },
  "production_vendue_services": { "valeur": 120142, "pct_ca": 49.93 },
  "marge_commerciale": { "valeur": 39181, "pct_ca": 16.28 },
  "marge_brute_globale": { "valeur": 159324, "pct_ca": 66.22 },
  "autres_achats_charges_externes": { "valeur": 62505, "pct_ca": 25.98 },
  "valeur_ajoutee": { "valeur": 100102, "pct_ca": 41.61 },
  "salaires_personnel": { "valeur": 34946, "pct_ca": 14.52 },
  "charges_sociales_personnel": { "valeur": 19958, "pct_ca": 8.30 },
  "charges_exploitant": { "valeur": 12411, "pct_ca": 5.16 },
  "ebe": { "valeur": 49952, "pct_ca": 20.76 },
  "resultat_exploitation": { "valeur": 44638, "pct_ca": 18.55 },
  "resultat_net": { "valeur": 45403, "pct_ca": 18.87 }
}

═══════════════════════════════════════════════════════════════════════════════
VALIDATION
═══════════════════════════════════════════════════════════════════════════════

Vérifier la cohérence:
- total_general_actif DOIT ÊTRE ÉGAL à total_general_passif
- resultat_exercice (passif) DOIT ÊTRE ÉGAL à resultat_net (compte de résultat et SIG)
- chiffre_affaires_net (compte résultat) DOIT ÊTRE ÉGAL à chiffre_affaires.valeur (SIG)

SCORE DE CONFIANCE:
- 0.95-1.0: Toutes les 4 sections extraites, cohérence vérifiée
- 0.85-0.95: Sections principales extraites, quelques valeurs manquantes
- 0.70-0.85: Extraction partielle mais utilisable
- <0.70: Problème d'extraction significatif

REASONING:
Expliquer brièvement:
1. Quelles sections ont été trouvées
2. Si la cohérence Actif=Passif est vérifiée
3. Le niveau de confiance et pourquoi`;

/**
 * Détecte si un document est un fichier COMPTA préprocessé
 * basé sur le nom du fichier et/ou le chemin
 */
function detectComptaDocument(filename: string, filePath?: string): boolean {
  // Pattern: COMPTA suivi de 4 chiffres (année)
  const isComptaFilename = /^COMPTA\d{4}\.pdf$/i.test(filename);

  // Ou dans le dossier A_ANALYSER
  const isInAnalyserFolder = filePath?.includes('A_ANALYSER') ?? false;

  // Ou contient "COMPTA" dans le nom (pour compatibilité)
  const containsCompta = filename.toUpperCase().includes('COMPTA');

  return isComptaFilename || (isInAnalyserFolder && containsCompta);
}

/**
 * Détecte si un document est un document de coûts de transaction
 * basé sur le nom du fichier (ex: "Cout_transaction_*.pdf", "offre_achat_*.pdf")
 *
 * Ces documents contiennent les détails financiers d'une transaction:
 * - Prix du fonds de commerce
 * - Honoraires, frais d'acte, droits d'enregistrement
 * - Stock et fonds de roulement
 * - Plan de financement (apport, crédit, mensualités)
 */
export function detectTransactionCostDocument(filename: string): boolean {
  const patterns = [
    /cout.*transaction/i,
    /transaction.*cout/i,
    /offre.*achat/i,
    /cout.*acquisition/i,
    /financement.*acquisition/i,
    /projet.*financement/i
  ];
  return patterns.some(p => p.test(filename));
}

export const geminiVisionExtractTool = new FunctionTool({
  name: 'geminiVisionExtract',
  description: 'Extrait données comptables via Gemini Vision (analyse PDF directement avec compréhension visuelle). Retourne documentType, year, confidence, tables et accounting_values.',
  parameters: zToGen(VisionExtractionInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    const { filename, debug } = params;

    try {
      if (debug) {
        console.log(`\n🔍 [geminiVisionExtract] Starting extraction for: ${filename}`);
      }

      // 1. Charger PDF depuis state.documents
      const documents = toolContext?.state.get('documents') as Array<{
        filename: string;
        filePath?: string;
        content?: Buffer | string;
      }> | undefined;

      if (!documents || documents.length === 0) {
        throw new Error('No documents found in state.documents');
      }

      const doc = documents.find(d => d.filename === filename);

      if (!doc) {
        throw new Error(`Document ${filename} not found in state.documents`);
      }

      // 2. Obtenir le buffer PDF
      let buffer: Buffer;

      if (doc.filePath) {
        // Lecture depuis filesystem
        const fullPath = path.resolve(doc.filePath);
        if (debug) {
          console.log(`[geminiVisionExtract] Reading from filePath: ${fullPath}`);
        }
        buffer = await fs.readFile(fullPath);
      } else if (doc.content) {
        // Utiliser content (Buffer ou base64)
        if (Buffer.isBuffer(doc.content)) {
          buffer = doc.content;
        } else if (typeof doc.content === 'string') {
          // Assume base64
          buffer = Buffer.from(doc.content, 'base64');
        } else {
          throw new Error('Document content is not Buffer or string');
        }
      } else {
        throw new Error('Document has no filePath or content');
      }

      if (debug) {
        console.log(`[geminiVisionExtract] PDF buffer size: ${buffer.length} bytes`);
      }

      // 3. Vérifier GEMINI_API_KEY
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY not configured in environment variables');
      }

      // 4. Détecter si c'est un document COMPTA préprocessé
      const isComptaDoc = detectComptaDocument(filename, doc.filePath);

      if (debug || isComptaDoc) {
        console.log(`[geminiVisionExtract] Document type detection:`, {
          filename,
          filePath: doc.filePath,
          isComptaPreprocessed: isComptaDoc
        });
      }

      // 5. Sélectionner le prompt et schema appropriés
      const selectedPrompt = isComptaDoc ? COMPTA_EXTRACTION_PROMPT : VISION_EXTRACTION_PROMPT;
      const selectedSchema = isComptaDoc ? ComptaGeminiResponseSchema : GeminiResponseSchema;

      if (isComptaDoc) {
        console.log(`[geminiVisionExtract] 📊 Using COMPTA specialized extraction for: ${filename}`);
      }

      // 6. Appel Gemini Vision API
      if (debug) {
        console.log('[geminiVisionExtract] Calling Gemini Vision API...');
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash" // Updated model for better extraction
      });

      // Pour les documents COMPTA: ne pas utiliser responseSchema (trop complexe pour l'API)
      // Le prompt détaillé suffit à guider la structure de sortie
      const generationConfig: any = {
        temperature: 0.2, // Lower temperature for more deterministic extraction
        topP: 0.95,
        topK: 40,
        maxOutputTokens: isComptaDoc ? 16384 : 8192, // More tokens for COMPTA docs
        responseMimeType: "application/json"
      };

      // Ajouter responseSchema uniquement pour les documents non-COMPTA
      if (!isComptaDoc) {
        generationConfig.responseSchema = selectedSchema;
      }

      const result = await model.generateContent({
        contents: [{
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "application/pdf",
                data: buffer.toString('base64')
              }
            },
            { text: selectedPrompt }
          ]
        }],
        generationConfig
      });

      const responseText = result.response.text();

      console.log(`[geminiVisionExtract] Gemini raw response length: ${responseText.length} chars`);

      if (debug) {
        console.log(`[geminiVisionExtract] Gemini response (first 500 chars):`, responseText.substring(0, 500));
      }

      // Vérifier que la réponse n'est pas vide
      if (!responseText || responseText.trim().length === 0) {
        throw new Error('Gemini returned empty response');
      }

      // Parser avec gestion d'erreur améliorée
      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch (parseError: any) {
        console.error('[geminiVisionExtract] JSON parse error:', parseError.message);
        console.error('[geminiVisionExtract] Response text:', responseText);
        throw new Error(`Failed to parse Gemini response as JSON: ${parseError.message}. Response: ${responseText.substring(0, 200)}`);
      }

      // Logging détaillé des métriques d'extraction
      if (isComptaDoc) {
        // Format COMPTA préprocessé
        console.log('[geminiVisionExtract] ✅ Extraction COMPTA réussie:', {
          annee: parsed.annee,
          societe: parsed.societe,
          date_cloture: parsed.date_cloture,
          confidence: parsed.extraction_confidence,
          bilan_actif_total: parsed.bilan_actif?.total_general_actif,
          bilan_passif_total: parsed.bilan_passif?.total_general_passif,
          ca: parsed.compte_resultat?.chiffre_affaires_net,
          ebe: parsed.sig?.ebe?.valeur,
          resultat_net: parsed.sig?.resultat_net?.valeur,
          charges_exploitant: parsed.sig?.charges_exploitant?.valeur
        });

        // Vérifier cohérence Actif = Passif
        const totalActif = parsed.bilan_actif?.total_general_actif || 0;
        const totalPassif = parsed.bilan_passif?.total_general_passif || 0;
        if (totalActif !== totalPassif && totalActif > 0) {
          const ecart = Math.abs(totalActif - totalPassif);
          const ecartPct = (ecart / totalActif) * 100;
          if (ecartPct > 0.1) {
            console.warn(`[geminiVisionExtract] ⚠️ Écart Actif/Passif: ${ecart}€ (${ecartPct.toFixed(2)}%)`);
          }
        }

        // Log des sections SIG extraites
        if (parsed.sig) {
          const sigKeys = Object.keys(parsed.sig);
          console.log(`[geminiVisionExtract] SIG: ${sigKeys.length} indicateurs extraits`);
          if (parsed.sig.charges_exploitant) {
            console.log(`[geminiVisionExtract] 💼 Charges exploitant (salaire dirigeant): ${parsed.sig.charges_exploitant.valeur}€ (${parsed.sig.charges_exploitant.pct_ca}% CA)`);
          }
        }
      } else {
        // Format standard
        console.log('[geminiVisionExtract] ✅ Extraction réussie:', {
          documentType: parsed.documentType,
          year: parsed.year,
          confidence: parsed.confidence,
          details: parsed.extraction_details || 'non fourni',
          accounting_values_count: Object.keys(parsed.accounting_values || {}).length,
          tables_count: parsed.tables?.length || 0
        });

        // Détail des clés extraites
        if (parsed.accounting_values) {
          const extractedKeys = Object.keys(parsed.accounting_values);
          const missingCriticalKeys = [
            'chiffre_affaires', 'ebe', 'resultat_net',
            'capitaux_propres', 'dettes_totales'
          ].filter(k => !extractedKeys.includes(k) || parsed.accounting_values[k] === null);

          if (missingCriticalKeys.length > 0) {
            console.warn('[geminiVisionExtract] ⚠️ Données critiques manquantes:', missingCriticalKeys);
          }

          console.log('[geminiVisionExtract] Clés extraites:', extractedKeys.length, '/', 50, 'attendues');
        }
      }

      if (debug) {
        console.log(`[geminiVisionExtract] Debug - Full parsed result:`, JSON.stringify(parsed, null, 2).substring(0, 2000));
      }

      // 7. Obtenir raw_text pour audit trail (best effort)
      let rawText = '';
      try {
        const pdfTextResult = await extractPdfTool.execute({ filename }, toolContext);
        const fullText = pdfTextResult.text || '';

        // Limiter à 5000 chars pour éviter JSON invalide (caractères spéciaux, taille)
        // Le texte complet n'est pas critique - les tables et key_values sont prioritaires
        rawText = fullText.length > 5000
          ? fullText.substring(0, 5000) + '...[truncated]'
          : fullText;
      } catch (e) {
        console.warn('[geminiVisionExtract] Failed to extract raw text (non-critical):', e);
      }

      // 8. Retourner format selon le type de document
      if (isComptaDoc) {
        // Extraction déterministe de l'année depuis le nom de fichier (COMPTA2023.pdf → 2023)
        let yearFromFilename: number | null = null;
        const filenameMatch = filename.match(/COMPTA(\d{4})\.pdf/i);
        if (filenameMatch) {
          yearFromFilename = parseInt(filenameMatch[1], 10);
          console.log(`[geminiVisionExtract] 📅 Année extraite du filename: ${yearFromFilename}`);
        }

        // PRIORITÉ: 1. Filename (déterministe), 2. Gemini (extraction)
        const resolvedYear = yearFromFilename ?? parsed.annee ?? null;
        if (yearFromFilename && parsed.annee && yearFromFilename !== parsed.annee) {
          console.warn(`[geminiVisionExtract] ⚠️ Divergence année: filename=${yearFromFilename}, Gemini=${parsed.annee} → Utilisation filename`);
        }

        // Format COMPTA structuré avec les 4 sections
        const comptaOutput = {
          filename,
          documentType: 'liasse_fiscale' as const,
          year: resolvedYear,
          confidence: parsed.extraction_confidence ?? 0.9,
          extractedData: {
            raw_text: rawText,
            tables: [], // Les données sont dans les sections structurées
            key_values: {
              // Données principales pour compatibilité avec le format existant
              // ⚠️ Utilise extractSigNumericValue pour gérer les deux formats (nombre ou {valeur, pct_ca})
              chiffre_affaires: parsed.compte_resultat?.chiffre_affaires_net || extractSigNumericValue(parsed.sig?.chiffre_affaires) || 0,
              ebe: extractSigNumericValue(parsed.sig?.ebe) || 0,
              resultat_net: parsed.compte_resultat?.resultat_net || extractSigNumericValue(parsed.sig?.resultat_net) || 0,
              resultat_exploitation: parsed.compte_resultat?.resultat_exploitation || extractSigNumericValue(parsed.sig?.resultat_exploitation) || 0,
              // Charges personnel: préférer SIG (salaires + charges sociales) puis Compte de Résultat
              charges_personnel: extractSigNumericValue(parsed.sig?.salaires_personnel) > 0
                ? (extractSigNumericValue(parsed.sig?.salaires_personnel) + extractSigNumericValue(parsed.sig?.charges_sociales_personnel))
                : ((parsed.compte_resultat?.salaires_traitements || 0) + (parsed.compte_resultat?.charges_sociales || 0)),
              dotations_amortissements: parsed.compte_resultat?.dotations_amortissements_immob || 0,
              // ✅ Ventes et achats de marchandises - CRITIQUES pour calcul marge commerciale
              ventes_marchandises: parsed.compte_resultat?.ventes_marchandises || extractSigNumericValue(parsed.sig?.ventes_marchandises) || 0,
              achats_marchandises: parsed.compte_resultat?.achats_marchandises || extractSigNumericValue(parsed.sig?.cout_achat_marchandises_vendues) || 0,
              // ✅ Production vendue de services = Commissions (tabac/loto/presse) pour Tabac/Presse
              // Fallback: compte_resultat > sig.production_vendue_services > sig.production_vendue > sig.production_exercice
              production_vendue_services: parsed.compte_resultat?.production_vendue_services
                || extractSigNumericValue(parsed.sig?.production_vendue_services)
                || extractSigNumericValue(parsed.sig?.production_vendue)
                || extractSigNumericValue(parsed.sig?.production_exercice)
                || 0,
              consommations_externes: parsed.compte_resultat?.autres_achats_charges_externes || 0,
              capitaux_propres: parsed.bilan_passif?.total_capitaux_propres || 0,
              dettes_totales: parsed.bilan_passif?.total_dettes || 0,
              total_actif: parsed.bilan_actif?.total_general_actif || 0,
              total_passif: parsed.bilan_passif?.total_general_passif || 0,
              // Données SIG spécifiques - ⚠️ ROBUSTE: accepte nombre ou {valeur, pct_ca}
              marge_commerciale: extractSigNumericValue(parsed.sig?.marge_commerciale) || 0,
              valeur_ajoutee: extractSigNumericValue(parsed.sig?.valeur_ajoutee) || 0,
              charges_exploitant: extractSigNumericValue(parsed.sig?.charges_exploitant) || 0, // Salaire dirigeant!
              // Nouveaux champs critiques
              marge_brute_globale: extractSigNumericValue(parsed.sig?.marge_brute_globale) || 0,
              charges_externes: extractSigNumericValue(parsed.sig?.autres_achats_charges_externes) || parsed.compte_resultat?.autres_achats_charges_externes || 0,
              salaires_personnel: extractSigNumericValue(parsed.sig?.salaires_personnel) || parsed.compte_resultat?.salaires_traitements || 0,
              charges_sociales_personnel: extractSigNumericValue(parsed.sig?.charges_sociales_personnel) || parsed.compte_resultat?.charges_sociales || 0
            },
            // Nouvelles sections structurées COMPTA
            bilan_actif: parsed.bilan_actif,
            bilan_passif: parsed.bilan_passif,
            compte_resultat: parsed.compte_resultat,
            sig: parsed.sig
          },
          // Métadonnées COMPTA
          societe: parsed.societe,
          adresse: parsed.adresse,
          date_cloture: parsed.date_cloture,
          duree_exercice_mois: parsed.duree_exercice_mois || 12,
          reasoning: parsed.reasoning,
          method: 'vision_compta' as const
        };

        console.log(`✅ [geminiVisionExtract] COMPTA Success for ${filename}:`, {
          societe: comptaOutput.societe,
          annee: comptaOutput.year,
          confidence: comptaOutput.confidence,
          ca: comptaOutput.extractedData.key_values.chiffre_affaires,
          marge_brute_globale: comptaOutput.extractedData.key_values.marge_brute_globale,
          charges_externes: comptaOutput.extractedData.key_values.charges_externes,
          charges_personnel: comptaOutput.extractedData.key_values.charges_personnel,
          charges_exploitant: comptaOutput.extractedData.key_values.charges_exploitant,
          ebe: comptaOutput.extractedData.key_values.ebe,
          resultat_exploitation: comptaOutput.extractedData.key_values.resultat_exploitation,
          resultat_net: comptaOutput.extractedData.key_values.resultat_net
        });

        // Log extraction to dedicated file
        const siret = (toolContext?.state.get('businessInfo') as any)?.siret || 'unknown';
        logDocumentExtraction(
          filename,
          siret,
          comptaOutput.year,
          comptaOutput.documentType,
          {
            bilan_actif: comptaOutput.extractedData.bilan_actif,
            bilan_passif: comptaOutput.extractedData.bilan_passif,
            compte_resultat: comptaOutput.extractedData.compte_resultat,
            sig: comptaOutput.extractedData.sig,
            key_values: comptaOutput.extractedData.key_values
          },
          comptaOutput.confidence
        );

        // ✅ INJECTION DIRECTE dans state.comptable.sig[year]
        // Garantit que les données extraites arrivent dans le state sans dépendre du LLM
        if (toolContext?.state && comptaOutput.year) {
          const year = comptaOutput.year.toString();
          const kv = comptaOutput.extractedData.key_values;

          // Debug production pour vérifier les valeurs finales (après fallback)
          console.log(`[geminiVisionExtract] 🔍 DEBUG Production (après fallback):`);
          console.log(`  - ventes_marchandises: ${kv.ventes_marchandises}`);
          console.log(`  - production_vendue_services: ${kv.production_vendue_services}`);
          console.log(`  - chiffre_affaires: ${kv.chiffre_affaires}`);
          console.log(`  - Source: ${kv.production_vendue_services > 0 ? 'compte_resultat (prioritaire)' : 'sig (fallback)'}`);

          // VALIDATION STRICTE : Vérifier que les champs SIG critiques sont présents
          const requiredSigFields = [
            'chiffre_affaires', 'marge_commerciale', 'marge_brute_globale',
            'valeur_ajoutee', 'ebe', 'resultat_exploitation', 'resultat_net'
          ];

          const missingFields = requiredSigFields.filter(field =>
            (kv as any)[field] === undefined || (kv as any)[field] === null
          );

          if (missingFields.length > 0) {
            console.warn(`⚠️ [geminiVisionExtract] Champs SIG manquants pour ${year}: ${missingFields.join(', ')}`);
            console.warn(`   L'injection sera effectuée mais les champs manquants seront à 0`);
          }

          // VALIDATION : Ne pas injecter si confidence trop basse
          const confidence = typeof comptaOutput.confidence === 'string'
            ? parseFloat(comptaOutput.confidence)
            : comptaOutput.confidence || 0;

          if (confidence < 0.7) {
            console.error(`❌ [geminiVisionExtract] Confidence trop basse (${confidence}) pour ${year} - SKIP injection`);
            // Ne pas injecter dans state.comptable.sig si la confiance est insuffisante
            return comptaOutput;
          }

          const ca = kv.chiffre_affaires || 1; // Éviter division par 0
          const calcPctCa = (v: number) => ca > 0 ? Math.round((v / ca) * 10000) / 100 : 0;

          // Construire le SIG avec format {valeur, pct_ca} - TOUS les champs
          const sigYear = {
            year: comptaOutput.year,
            source: 'gemini_vision_direct',
            confidence: confidence,

            // Chiffre d'affaires & composantes
            chiffre_affaires: { valeur: kv.chiffre_affaires || 0, pct_ca: 100 },
            ventes_marchandises: { valeur: kv.ventes_marchandises || 0, pct_ca: calcPctCa(kv.ventes_marchandises || 0) },
            production_vendue_services: { valeur: kv.production_vendue_services || 0, pct_ca: calcPctCa(kv.production_vendue_services || 0) },

            // Marges
            achats_marchandises: { valeur: kv.achats_marchandises || 0, pct_ca: calcPctCa(kv.achats_marchandises || 0) },
            marge_commerciale: { valeur: kv.marge_commerciale || 0, pct_ca: calcPctCa(kv.marge_commerciale || 0) },
            marge_brute_globale: { valeur: kv.marge_brute_globale || 0, pct_ca: calcPctCa(kv.marge_brute_globale || 0) },

            // Charges
            autres_achats_charges_externes: { valeur: kv.charges_externes || 0, pct_ca: calcPctCa(kv.charges_externes || 0) },
            charges_exploitant: { valeur: kv.charges_exploitant || 0, pct_ca: calcPctCa(kv.charges_exploitant || 0) },
            salaires_personnel: { valeur: kv.salaires_personnel || 0, pct_ca: calcPctCa(kv.salaires_personnel || 0) },
            charges_sociales_personnel: { valeur: kv.charges_sociales_personnel || 0, pct_ca: calcPctCa(kv.charges_sociales_personnel || 0) },

            // Indicateurs clés
            valeur_ajoutee: { valeur: kv.valeur_ajoutee || 0, pct_ca: calcPctCa(kv.valeur_ajoutee || 0) },
            ebe: { valeur: kv.ebe || 0, pct_ca: calcPctCa(kv.ebe || 0) },
            resultat_exploitation: { valeur: kv.resultat_exploitation || 0, pct_ca: calcPctCa(kv.resultat_exploitation || 0) },
            resultat_net: { valeur: kv.resultat_net || 0, pct_ca: calcPctCa(kv.resultat_net || 0) }
          };

          // Lire état actuel et ajouter cette année
          const currentComptable = (toolContext.state.get('comptable') as any) || {};
          const currentSig = currentComptable.sig || {};
          const currentYears: number[] = currentComptable.yearsAnalyzed || [];

          // Mettre à jour le state
          toolContext.state.set('comptable', {
            ...currentComptable,
            sig: {
              ...currentSig,
              [year]: sigYear
            },
            yearsAnalyzed: [...new Set([...currentYears, comptaOutput.year])].sort((a: number, b: number) => b - a)
          });

          // LOGGING DÉTAILLÉ
          console.log(`\n✅ [geminiVisionExtract] Injection directe SIG pour ${year} (confidence: ${(confidence * 100).toFixed(0)}%)`);
          console.log(`   CA: ${sigYear.chiffre_affaires.valeur.toLocaleString('fr-FR')} €`);
          console.log(`   ├─ Ventes Marchandises: ${sigYear.ventes_marchandises.valeur.toLocaleString('fr-FR')} € (${sigYear.ventes_marchandises.pct_ca.toFixed(1)}%)`);
          console.log(`   └─ Production/Services: ${sigYear.production_vendue_services.valeur.toLocaleString('fr-FR')} € (${sigYear.production_vendue_services.pct_ca.toFixed(1)}%)`);
          console.log(`   Marge Commerciale: ${sigYear.marge_commerciale.valeur.toLocaleString('fr-FR')} € (${sigYear.marge_commerciale.pct_ca.toFixed(1)}%)`);
          console.log(`   Marge Brute Globale: ${sigYear.marge_brute_globale.valeur.toLocaleString('fr-FR')} € (${sigYear.marge_brute_globale.pct_ca.toFixed(1)}%)`);
          console.log(`   Valeur Ajoutée: ${sigYear.valeur_ajoutee.valeur.toLocaleString('fr-FR')} € (${sigYear.valeur_ajoutee.pct_ca.toFixed(1)}%)`);
          console.log(`   EBE: ${sigYear.ebe.valeur.toLocaleString('fr-FR')} € (${sigYear.ebe.pct_ca.toFixed(1)}%)`);
          console.log(`   Résultat Exploitation: ${sigYear.resultat_exploitation.valeur.toLocaleString('fr-FR')} € (${sigYear.resultat_exploitation.pct_ca.toFixed(1)}%)`);
          console.log(`   Résultat Net: ${sigYear.resultat_net.valeur.toLocaleString('fr-FR')} € (${sigYear.resultat_net.pct_ca.toFixed(1)}%)\n`);
        }

        return comptaOutput;
      }

      // Format standard pour documents non-COMPTA
      const output = {
        filename,
        documentType: parsed.documentType,
        year: parsed.year ?? null, // Convert undefined to null for consistency
        confidence: parsed.confidence,
        extractedData: {
          raw_text: rawText,
          tables: parsed.tables || [],
          key_values: parsed.accounting_values || {}
        },
        reasoning: parsed.reasoning,
        method: 'vision' as const
      };

      console.log(`✅ [geminiVisionExtract] Success for ${filename}:`, {
        type: output.documentType,
        year: output.year,
        confidence: output.confidence,
        tables: output.extractedData.tables.length,
        keyValues: Object.keys(output.extractedData.key_values).length
      });

      // Log extraction to dedicated file
      const siretStd = (toolContext?.state.get('businessInfo') as any)?.siret || 'unknown';
      logDocumentExtraction(
        filename,
        siretStd,
        output.year,
        output.documentType,
        { key_values: output.extractedData.key_values },
        output.confidence
      );

      return output;

    } catch (error: any) {
      console.error(`❌ [geminiVisionExtract] Failed for ${filename}:`, error.message);

      if (debug) {
        console.error('[geminiVisionExtract] Full error:', error);
      }

      // Retourner structure d'erreur pour fallback vers heuristiques
      return {
        filename,
        documentType: 'autre' as const,
        year: null,
        confidence: 0,
        extractedData: {
          raw_text: '',
          tables: [],
          key_values: {}
        },
        error: error.message,
        method: 'vision_failed' as const
      };
    }
  }
});

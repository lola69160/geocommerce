import { FunctionTool } from '@google/adk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ToolContext } from '@google/adk';
import fs from 'fs/promises';
import path from 'path';
import { zToGen } from '../../../utils/schemaHelper';
import { z } from 'zod';

/**
 * Extract Transaction Costs Tool
 *
 * Extrait les coûts de transaction et financement d'un document PDF.
 * Typiquement utilisé pour les documents du type "Coût de transaction" des agences immobilières.
 *
 * Extrait:
 * - Prix du fonds de commerce
 * - Honoraires et frais
 * - Stock et fonds de roulement
 * - Total investissement
 * - Financement (apport, crédit, mensualités)
 */

const TransactionCostsInputSchema = z.object({
  filename: z.string().describe('Nom exact du fichier (doit correspondre à un document de type cout_transaction)')
});

const TransactionCostsOutputSchema = z.object({
  success: z.boolean(),
  transactionCosts: z.object({
    prix_fonds: z.number().describe('Prix du fonds de commerce en €'),
    honoraires_ht: z.number().describe('Honoraires de négociation HT en €'),
    frais_acte_ht: z.number().describe('Provision rédaction acte HT en €'),
    debours: z.number().describe('Débours (INPI, greffe, annonce légale) en €'),
    droits_enregistrement: z.number().describe('Droits d\'enregistrement en €'),
    tva: z.number().describe('TVA sur honoraires et frais en €'),
    stock_fonds_roulement: z.number().describe('Stock et fonds de roulement en €'),
    loyer_avance: z.number().describe('Loyer d\'avance en €'),
    total_investissement: z.number().describe('Total de l\'investissement en €'),
    apport_requis: z.number().describe('Apport personnel minimum requis en €'),
    credit_sollicite: z.number().describe('Crédit sollicité en €'),
    duree_credit_mois: z.number().describe('Durée du crédit en mois'),
    taux_credit: z.number().describe('Taux du crédit en %'),
    mensualites: z.number().describe('Mensualités hors assurances en €')
  }).optional(),
  error: z.string().optional()
});

const TRANSACTION_COSTS_PROMPT = `Tu es un expert en transactions de fonds de commerce.

Analyse ce document et extrait TOUTES les informations financières relatives aux coûts de transaction et au financement.

Le document présente généralement:
1. **COÛT DE LA TRANSACTION**
   - Prix du fonds de commerce
   - Honoraires de négociation HT
   - Provision rédaction d'acte HT
   - Débours (INPI, greffe, annonce légale)
   - Droits d'enregistrement
   - TVA sur honoraires et frais
   - Stock et fonds de roulement
   - Travaux (si applicable)
   - Loyer d'avance
   - TOTAL DE L'INVESTISSEMENT

2. **FINANCEMENT SOLLICITÉ**
   - Apport personnel minimum
   - Prêt relai TVA
   - Crédit vendeur
   - Crédit sollicité
   - Durée du prêt (en mois)
   - Taux du crédit (en %)
   - Mensualités hors assurances
   - Annuité hors assurances

EXTRACTION DES MONTANTS:
- Convertir TOUS les montants en NOMBRES (pas de strings)
- Format français: espaces pour milliers (320 000,00 €) → convertir en 320000
- Supprimer les symboles €, espaces
- Si une ligne indique "mémoire", "En attente", ou est vide → utiliser 0
- Durée en mois (ex: "84 mois" → 84)
- Taux en % (ex: "3,20%" → 3.2)

IMPORTANT:
- Ne pas inventer de valeurs - extraire uniquement ce qui est présent
- Si un champ n'est pas trouvé, retourner 0
- Arrondir les mensualités à 2 décimales (ex: 4230.55)

Retourne un JSON avec tous les champs extraits.`;

export const extractTransactionCostsTool = new FunctionTool({
  name: 'extractTransactionCosts',
  description: 'Extrait les coûts de transaction et financement d\'un document PDF (prix fonds, honoraires, stock, financement)',
  parameters: zToGen(TransactionCostsInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    const { filename } = params;

    try {
      const state = toolContext?.state;
      if (!state) {
        return {
          success: false,
          error: 'State non disponible'
        };
      }

      // Rechercher le document dans state.documents
      const documents = state.documents || [];
      const document = documents.find((doc: any) => doc.filename === filename);

      if (!document) {
        return {
          success: false,
          error: `Document ${filename} non trouvé dans state.documents`
        };
      }

      // Obtenir le contenu du PDF
      let pdfBuffer: Buffer;

      if (document.content) {
        if (Buffer.isBuffer(document.content)) {
          pdfBuffer = document.content;
        } else if (typeof document.content === 'string') {
          // Base64 string
          pdfBuffer = Buffer.from(document.content, 'base64');
        } else {
          return {
            success: false,
            error: 'Format de contenu non supporté'
          };
        }
      } else if (document.filePath) {
        pdfBuffer = await fs.readFile(document.filePath);
      } else {
        return {
          success: false,
          error: 'Aucun contenu ou filePath disponible pour le document'
        };
      }

      // Initialiser Gemini Vision
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return {
          success: false,
          error: 'GEMINI_API_KEY non configurée'
        };
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
          temperature: 0.1,  // Très factuel pour extraction
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json'
        }
      });

      // Convertir PDF en base64 pour Gemini
      const pdfBase64 = pdfBuffer.toString('base64');

      // Appeler Gemini Vision
      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: pdfBase64
          }
        },
        { text: TRANSACTION_COSTS_PROMPT }
      ]);

      const response = result.response;
      const text = response.text();

      // Parser la réponse JSON
      const extracted = JSON.parse(text);

      // Valider et structurer les données
      const transactionCosts = {
        prix_fonds: extracted.prix_fonds || extracted.prix_du_fonds || 0,
        honoraires_ht: extracted.honoraires_ht || extracted.honoraires_negociation_ht || 0,
        frais_acte_ht: extracted.frais_acte_ht || extracted.provision_redaction_acte_ht || 0,
        debours: extracted.debours || 0,
        droits_enregistrement: extracted.droits_enregistrement || 0,
        tva: extracted.tva || extracted.tva_20 || 0,
        stock_fonds_roulement: extracted.stock_fonds_roulement || extracted.stock_et_fonds_de_roulement || 0,
        loyer_avance: extracted.loyer_avance || 0,
        total_investissement: extracted.total_investissement || extracted.total_arrondi || 0,
        apport_requis: extracted.apport_requis || extracted.apport_personnel_mini || 0,
        credit_sollicite: extracted.credit_sollicite || extracted.credit_sur_7_annes || 0,
        duree_credit_mois: extracted.duree_credit_mois || extracted.duree_pret_mois || 0,
        taux_credit: extracted.taux_credit || extracted.taux || 0,
        mensualites: extracted.mensualites || extracted.mensualites_hors_assurances || 0
      };

      return {
        success: true,
        transactionCosts
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Erreur lors de l'extraction: ${error.message}`
      };
    }
  }
});

export default extractTransactionCostsTool;

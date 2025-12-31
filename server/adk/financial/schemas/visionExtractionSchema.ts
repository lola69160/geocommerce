import { z } from 'zod';

/**
 * Vision Extraction Schema
 *
 * Defines schemas for Gemini Vision-based PDF extraction.
 * Used by geminiVisionExtractTool to extract structured accounting data from PDFs.
 */

// Zod schema for TypeScript validation (input)
export const VisionExtractionInputSchema = z.object({
  filename: z.string().describe('Nom du fichier PDF à extraire'),
  debug: z.boolean().optional().describe('Mode debug pour logs détaillés')
});

// Zod schema for TypeScript validation (output)
export const VisionExtractionOutputSchema = z.object({
  filename: z.string(),
  documentType: z.enum(['bilan', 'compte_resultat', 'liasse_fiscale', 'bail', 'projet_vente', 'autre']),
  year: z.number().nullable(),
  confidence: z.number().min(0).max(1),
  extractedData: z.object({
    raw_text: z.string(),
    tables: z.array(z.object({
      headers: z.array(z.string()),
      rows: z.array(z.array(z.string())),
      caption: z.string().optional()
    })),
    key_values: z.record(z.string(), z.any()).optional()
  }),
  reasoning: z.string().optional(),
  method: z.enum(['vision', 'heuristic', 'vision_failed']),
  error: z.string().optional()
});

// JSON Schema for Gemini API responseSchema parameter
// This defines the structure Gemini Vision should return
export const GeminiResponseSchema = {
  type: "object",
  properties: {
    documentType: {
      type: "string",
      enum: ["bilan", "compte_resultat", "liasse_fiscale", "bail", "projet_vente", "autre"],
      description: "Type de document comptable français"
    },
    year: {
      type: "number",
      description: "Année fiscale du document (YYYY)"
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "Score de confiance de l'extraction (0-1)"
    },
    reasoning: {
      type: "string",
      description: "Justification du type de document et de la confiance"
    },
    tables: {
      type: "array",
      description: "Tous les tableaux extraits du document",
      items: {
        type: "object",
        properties: {
          caption: {
            type: "string",
            description: "Titre ou légende du tableau (ex: 'ACTIF', 'CHARGES')"
          },
          headers: {
            type: "array",
            items: { type: "string" },
            description: "En-têtes de colonnes du tableau"
          },
          rows: {
            type: "array",
            items: {
              type: "array",
              items: { type: "string" }
            },
            description: "Lignes de données (chaque ligne = array de cellules)"
          }
        },
        required: ["headers", "rows"]
      }
    },
    accounting_values: {
      type: "object",
      description: "Valeurs comptables extraites directement (bonus pour bypass heuristiques)",
      properties: {
        chiffre_affaires: {
          type: "number",
          description: "Chiffre d'affaires (ventes + prestations)"
        },
        ebe: {
          type: "number",
          description: "Excédent Brut d'Exploitation"
        },
        resultat_net: {
          type: "number",
          description: "Résultat net (bénéfice ou perte)"
        },
        charges_personnel: {
          type: "number",
          description: "Charges de personnel (salaires + cotisations)"
        },
        dotations_amortissements: {
          type: "number",
          description: "Dotations aux amortissements"
        },
        resultat_exploitation: {
          type: "number",
          description: "Résultat d'exploitation"
        },
        achats_marchandises: {
          type: "number",
          description: "Achats de marchandises"
        },
        consommations_externes: {
          type: "number",
          description: "Consommations externes (loyers, assurances, etc.)"
        }
      }
    }
  },
  required: ["documentType", "confidence", "tables"]
};

// ============================================================================
// SCHEMA GEMINI POUR DOCUMENTS COMPTA PRÉPROCESSÉS
// ============================================================================

/**
 * Schema JSON pour Gemini API - Documents COMPTA préprocessés
 * Structure optimisée pour extraire les 4 sections standardisées:
 * - Bilan Actif
 * - Bilan Passif
 * - Compte de Résultat
 * - SIG (Soldes Intermédiaires de Gestion)
 */

// Helper pour définir une valeur SIG (valeur + % CA)
const ValeurSigJsonSchema = {
  type: "object",
  properties: {
    valeur: { type: "number", description: "Montant en euros" },
    pct_ca: { type: "number", description: "Pourcentage du CA (ex: 7.46 pour 7.46%)" }
  },
  required: ["valeur", "pct_ca"]
};

// Helper pour définir une valeur d'immobilisation (brut/amort/net)
const ValeurImmobilisationJsonSchema = {
  type: "object",
  properties: {
    brut: { type: "number", description: "Valeur brute" },
    amort: { type: "number", description: "Amortissements et dépréciations" },
    net: { type: "number", description: "Valeur nette (brut - amort)" }
  },
  required: ["brut", "amort", "net"]
};

export const ComptaGeminiResponseSchema = {
  type: "object",
  description: "Extraction structurée d'un document COMPTA préprocessé (4 sections)",
  properties: {
    // Métadonnées
    annee: {
      type: "number",
      description: "Année fiscale du document (ex: 2023)"
    },
    societe: {
      type: "string",
      description: "Nom de la société/entreprise"
    },
    adresse: {
      type: "string",
      description: "Adresse de la société"
    },
    date_cloture: {
      type: "string",
      description: "Date de clôture de l'exercice (ex: 30/11/2023)"
    },
    duree_exercice_mois: {
      type: "number",
      description: "Durée de l'exercice en mois (généralement 12)"
    },
    extraction_confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "Score de confiance de l'extraction (0-1)"
    },

    // SECTION 1: BILAN ACTIF
    bilan_actif: {
      type: "object",
      description: "Bilan Actif - Extraire uniquement colonne Net année N",
      properties: {
        // Immobilisations incorporelles
        concessions_brevets: ValeurImmobilisationJsonSchema,
        fonds_commercial: ValeurImmobilisationJsonSchema,
        autres_immob_incorp: ValeurImmobilisationJsonSchema,

        // Immobilisations corporelles
        terrains: ValeurImmobilisationJsonSchema,
        constructions: ValeurImmobilisationJsonSchema,
        installations_techniques: ValeurImmobilisationJsonSchema,
        autres_immob_corp: ValeurImmobilisationJsonSchema,

        // Immobilisations financières
        participations: { type: "number" },
        autres_immob_fin: { type: "number" },

        // Total actif immobilisé
        total_actif_immobilise: ValeurImmobilisationJsonSchema,

        // Actif circulant
        stocks_marchandises: { type: "number", description: "Stock de marchandises (Net)" },
        stocks_matieres_premieres: { type: "number" },
        creances_clients: { type: "number", description: "Créances clients et comptes rattachés (Net)" },
        autres_creances: { type: "number", description: "Autres créances (Net)" },
        disponibilites: { type: "number", description: "Disponibilités/Trésorerie (Net)" },
        charges_constatees_avance: { type: "number", description: "Charges constatées d'avance (Net)" },
        total_actif_circulant: { type: "number", description: "Total III - Actif circulant" },

        // Total général
        total_general_actif: { type: "number", description: "TOTAL GÉNÉRAL ACTIF" }
      },
      required: ["total_actif_immobilise", "total_actif_circulant", "total_general_actif"]
    },

    // SECTION 2: BILAN PASSIF
    bilan_passif: {
      type: "object",
      description: "Bilan Passif - Extraire uniquement année N",
      properties: {
        // Capitaux propres
        capital: { type: "number", description: "Capital social ou individuel" },
        primes_emission: { type: "number" },
        reserves: { type: "number" },
        report_a_nouveau: { type: "number" },
        resultat_exercice: { type: "number", description: "Résultat de l'exercice (bénéfice ou perte)" },
        subventions_investissement: { type: "number" },
        provisions_reglementees: { type: "number" },
        total_capitaux_propres: { type: "number", description: "Total I - Capitaux propres" },

        // Provisions
        provisions_risques: { type: "number" },
        provisions_charges: { type: "number" },
        total_provisions: { type: "number", description: "Total III - Provisions" },

        // Dettes
        emprunts_etablissements_credit: { type: "number", description: "Emprunts auprès d'établissements de crédit" },
        concours_bancaires_courants: { type: "number" },
        emprunts_dettes_financieres_diverses: { type: "number" },
        dettes_fournisseurs: { type: "number", description: "Dettes fournisseurs et comptes rattachés" },
        dettes_fiscales_sociales: { type: "number", description: "Dettes fiscales et sociales" },
        autres_dettes: { type: "number" },
        produits_constates_avance: { type: "number" },
        total_dettes: { type: "number", description: "Total IV - Dettes" },

        // Total général
        total_general_passif: { type: "number", description: "TOTAL GÉNÉRAL PASSIF" },

        // Info complémentaire
        dettes_moins_1_an: { type: "number", description: "Dettes et PCA à moins d'un an (note bas de page)" }
      },
      required: ["capital", "resultat_exercice", "total_capitaux_propres", "total_dettes", "total_general_passif"]
    },

    // SECTION 3: COMPTE DE RÉSULTAT
    compte_resultat: {
      type: "object",
      description: "Compte de Résultat - Extraire uniquement année N (colonne Total)",
      properties: {
        // Produits d'exploitation
        ventes_marchandises: { type: "number", description: "Ventes de marchandises" },
        production_vendue_biens: { type: "number" },
        production_vendue_services: { type: "number", description: "Production vendue de services" },
        chiffre_affaires_net: { type: "number", description: "Chiffre d'affaires NET (ventes + production)" },
        production_stockee: { type: "number" },
        production_immobilisee: { type: "number" },
        subventions_exploitation: { type: "number" },
        reprises_depreciations_provisions: { type: "number" },
        autres_produits: { type: "number" },
        total_produits_exploitation: { type: "number", description: "Total des Produits d'exploitation (I)" },

        // Charges d'exploitation
        achats_marchandises: { type: "number", description: "Achats de marchandises" },
        variation_stock_marchandises: { type: "number", description: "Variation de stock (marchandises)" },
        achats_matieres_premieres: { type: "number" },
        variation_stock_matieres: { type: "number" },
        autres_achats_charges_externes: { type: "number", description: "Autres achats et charges externes" },
        impots_taxes: { type: "number", description: "Impôts, taxes et versements assimilés" },
        salaires_traitements: { type: "number", description: "Salaires et traitements" },
        charges_sociales: { type: "number", description: "Charges sociales" },
        dotations_amortissements_immob: { type: "number", description: "Dotations aux amortissements sur immobilisations" },
        dotations_provisions: { type: "number" },
        autres_charges: { type: "number" },
        total_charges_exploitation: { type: "number", description: "Total des Charges d'exploitation (II)" },

        // Résultat d'exploitation
        resultat_exploitation: { type: "number", description: "Résultat d'exploitation (I - II)" },

        // Financier
        total_produits_financiers: { type: "number", description: "Total V - Produits financiers" },
        interets_charges_assimilees: { type: "number", description: "Intérêts et charges assimilées" },
        total_charges_financieres: { type: "number", description: "Total VI - Charges financières" },
        resultat_financier: { type: "number", description: "Résultat financier (V - VI)" },
        resultat_courant_avant_impots: { type: "number", description: "Résultat courant avant impôts" },

        // Exceptionnel
        produits_except_operations_gestion: { type: "number" },
        produits_except_operations_capital: { type: "number" },
        total_produits_exceptionnels: { type: "number", description: "Total VII - Produits exceptionnels" },
        charges_except_operations_gestion: { type: "number" },
        charges_except_operations_capital: { type: "number" },
        total_charges_exceptionnelles: { type: "number", description: "Total VIII - Charges exceptionnelles" },
        resultat_exceptionnel: { type: "number", description: "Résultat exceptionnel (VII - VIII)" },

        // Final
        participation_salaries: { type: "number" },
        impots_sur_benefices: { type: "number" },
        total_produits: { type: "number", description: "Total des produits" },
        total_charges: { type: "number", description: "Total des charges" },
        resultat_net: { type: "number", description: "Bénéfice ou perte (résultat net)" }
      },
      required: [
        "chiffre_affaires_net", "total_produits_exploitation", "total_charges_exploitation",
        "resultat_exploitation", "resultat_financier", "resultat_courant_avant_impots",
        "resultat_exceptionnel", "resultat_net"
      ]
    },

    // SECTION 4: SIG - SOLDES INTERMÉDIAIRES DE GESTION
    sig: {
      type: "object",
      description: "SIG - Extraire valeur ET pourcentage du CA pour chaque indicateur",
      properties: {
        // CA de référence
        chiffre_affaires: ValeurSigJsonSchema,

        // Marge commerciale
        ventes_marchandises: ValeurSigJsonSchema,
        cout_achat_marchandises_vendues: ValeurSigJsonSchema,
        marge_commerciale: ValeurSigJsonSchema,

        // Production
        production_vendue: ValeurSigJsonSchema,
        production_vendue_services: ValeurSigJsonSchema, // Commissions (tabac/loto/presse)
        production_exercice: ValeurSigJsonSchema,

        // Marges
        marge_brute_production: ValeurSigJsonSchema,
        marge_brute_globale: ValeurSigJsonSchema,

        // Valeur ajoutée
        autres_achats_charges_externes: ValeurSigJsonSchema,
        valeur_ajoutee: ValeurSigJsonSchema,

        // EBE - EXCÉDENT BRUT D'EXPLOITATION
        subventions_exploitation: ValeurSigJsonSchema,
        impots_taxes: ValeurSigJsonSchema,
        salaires_personnel: ValeurSigJsonSchema,
        charges_sociales_personnel: ValeurSigJsonSchema,
        charges_exploitant: {
          type: "object",
          description: "IMPORTANT: Charges de l'exploitant = salaire du dirigeant",
          properties: {
            valeur: { type: "number", description: "Montant en euros du salaire dirigeant" },
            pct_ca: { type: "number", description: "Pourcentage du CA" }
          },
          required: ["valeur", "pct_ca"]
        },
        ebe: ValeurSigJsonSchema,

        // Résultats
        autres_produits_gestion: ValeurSigJsonSchema,
        autres_charges_gestion: ValeurSigJsonSchema,
        reprises_amortissements_provisions: ValeurSigJsonSchema,
        dotations_amortissements: ValeurSigJsonSchema,
        resultat_exploitation: ValeurSigJsonSchema,

        // Financier et courant
        produits_financiers: ValeurSigJsonSchema,
        charges_financieres: ValeurSigJsonSchema,
        resultat_courant: ValeurSigJsonSchema,

        // Exceptionnel
        produits_exceptionnels: ValeurSigJsonSchema,
        charges_exceptionnelles: ValeurSigJsonSchema,
        resultat_exceptionnel: ValeurSigJsonSchema,

        // Net
        resultat_net: ValeurSigJsonSchema
      },
      required: [
        "chiffre_affaires", "marge_commerciale", "valeur_ajoutee",
        "charges_exploitant", "ebe", "resultat_exploitation",
        "resultat_courant", "resultat_net"
      ]
    },

    // Reasoning pour debug
    reasoning: {
      type: "string",
      description: "Explication du processus d'extraction et des éventuelles difficultés"
    }
  },
  required: ["annee", "societe", "date_cloture", "extraction_confidence", "bilan_actif", "bilan_passif", "compte_resultat", "sig"]
};

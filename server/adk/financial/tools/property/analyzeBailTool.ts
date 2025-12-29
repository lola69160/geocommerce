import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';

/**
 * Analyze Bail Tool
 *
 * Analyse le bail commercial (dates, conditions financières, clauses).
 * Extrait les informations clés depuis les documents ou depuis des paramètres manuels.
 *
 * Types de baux:
 * - Commercial 3-6-9: Bail classique avec durée minimale 9 ans, résiliation triennale
 * - Dérogatoire: Bail < 3 ans sans statut protecteur
 * - Professionnel: Pour professions libérales (médecins, avocats, etc.)
 * - Mixte: Usage commercial + habitation
 */

const AnalyzeBailInputSchema = z.object({
  // Mode manuel (si bail non fourni en document)
  manual_input: z.object({
    type: z.enum(['commercial_3_6_9', 'derogatoire', 'professionnel', 'mixte']).optional(),
    bailleur: z.string().optional(),
    date_signature: z.string().optional(),
    date_effet: z.string().optional(),
    loyer_annuel_hc: z.number().optional(),
    charges_annuelles: z.number().optional(),
    surface_m2: z.number().optional(),
    depot_garantie: z.number().optional()
  }).optional().describe('Données de bail saisies manuellement si document non disponible')
});

const AnalyzeBailOutputSchema = z.object({
  dataStatus: z.object({
    bail_disponible: z.boolean(),
    source: z.enum(['document', 'saisie_manuelle', 'non_disponible'])
  }),
  bail: z.object({
    type: z.enum(['commercial_3_6_9', 'derogatoire', 'professionnel', 'mixte']),
    bailleur: z.string(),
    date_signature: z.string(),
    date_effet: z.string(),
    date_fin: z.string(),
    duree_initiale_mois: z.number(),
    duree_restante_mois: z.number(),
    loyer_annuel_hc: z.number().nullable().describe('Loyer annuel hors charges'),
    loyer_source: z.enum(['comptabilite', 'bail_document', 'utilisateur', 'non_disponible']).describe('Source du loyer actuel'),
    loyer_annee_source: z.string().optional().describe('Année de référence si source comptabilité'),
    charges_annuelles: z.number(),
    loyer_total_annuel: z.number(),
    loyer_mensuel: z.number(),
    depot_garantie: z.number(),
    surface_m2: z.number(),
    loyer_m2_annuel: z.number(),
    indexation: z.string(),
    clause_resiliation: z.string(),
    clause_cession: z.string(),
    travaux_preneur: z.string(),
    destination: z.string()
  }).optional(),
  donnees_manquantes: z.array(z.string()),
  error: z.string().optional()
});

export const analyzeBailTool = new FunctionTool({
  name: 'analyzeBail',
  description: 'Analyse le bail commercial (dates, loyer, clauses). Extrait depuis documents ou utilise saisie manuelle. Retourne { dataStatus, bail?, donnees_manquantes }',
  parameters: zToGen(AnalyzeBailInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    try {
      // Lire documentExtraction depuis state
      let documentExtraction = toolContext?.state.get('documentExtraction') as any;

      // Parser JSON string si nécessaire
      if (typeof documentExtraction === 'string') {
        try {
          documentExtraction = JSON.parse(documentExtraction);
        } catch (e) {
          // Pas critique, on peut continuer avec manual_input
        }
      }

      // Lire businessInfo depuis state (pour code postal - estimation loyer marché)
      let businessInfo = toolContext?.state.get('businessInfo') as any;

      if (typeof businessInfo === 'string') {
        try {
          businessInfo = JSON.parse(businessInfo);
        } catch (e) {
          // Pas critique
        }
      }

      // Lire userComments depuis state (NOUVEAU - pour ajustements loyer)
      let userComments = toolContext?.state.get('userComments') as any;

      if (typeof userComments === 'string') {
        try {
          userComments = JSON.parse(userComments);
        } catch (e) {
          // Pas critique
        }
      }

      // Lire comptable depuis state (pour loyer depuis compte de résultat)
      let comptable = toolContext?.state.get('comptable') as any;

      if (typeof comptable === 'string') {
        try {
          comptable = JSON.parse(comptable);
        } catch (e) {
          // Pas critique
        }
      }

      const donneesManquantes: string[] = [];

      // ÉTAPE 1 : Chercher le bail dans les documents
      let bailFromDocument: any = null;

      if (documentExtraction?.documents && Array.isArray(documentExtraction.documents)) {
        const bailDocs = documentExtraction.documents.filter(
          (doc: any) => doc.documentType === 'bail'
        );

        if (bailDocs.length > 0) {
          const bailDoc = bailDocs[0];
          bailFromDocument = extractBailData(bailDoc);
        }
      }

      // ÉTAPE 2 : Utiliser manual_input si fourni
      const manualInput = params.manual_input;

      // ÉTAPE 3 : Déterminer la source
      let source: 'document' | 'saisie_manuelle' | 'non_disponible' = 'non_disponible';
      let bailData: any = null;

      if (bailFromDocument) {
        source = 'document';
        bailData = bailFromDocument;
      } else if (manualInput && Object.keys(manualInput).length > 0) {
        source = 'saisie_manuelle';
        bailData = buildBailFromManualInput(manualInput);
      }

      // Pas de bail disponible
      if (!bailData) {
        return {
          dataStatus: {
            bail_disponible: false,
            source: 'non_disponible'
          },
          donnees_manquantes: [
            'Bail commercial non fourni en document',
            'Aucune donnée saisie manuellement',
            'Impossible d\'analyser les conditions locatives'
          ]
        };
      }

      // ÉTAPE 4 : Enrichir les données du bail
      const today = new Date();
      const dateEffet = bailData.date_effet ? new Date(bailData.date_effet) : today;
      const dateFin = bailData.date_fin ? new Date(bailData.date_fin) : new Date(dateEffet);

      // Calculer durées
      const dureeInitialeMois = Math.round(
        (dateFin.getTime() - dateEffet.getTime()) / (1000 * 60 * 60 * 24 * 30)
      );
      const dureeRestanteMois = Math.max(
        0,
        Math.round((dateFin.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30))
      );

      // ========================================
      // ÉTAPE 5 : Déterminer le loyer actuel (PRIORITÉ)
      // ========================================
      // 1. Comptabilité (charges locatives du compte de résultat)
      // 2. Document bail
      // 3. Fallback: null (non disponible)

      let loyerAnnuelHC: number | null = null;
      let loyerSource: 'comptabilite' | 'bail_document' | 'utilisateur' | 'non_disponible' = 'non_disponible';
      let loyerAnneeSource: string | undefined = undefined;

      // Priorité 1: Comptabilité (détail charges externes)
      if (comptable?.sig) {
        const years = Object.keys(comptable.sig).sort().reverse();
        const lastYear = years[0];

        if (lastYear) {
          const sigYear = comptable.sig[lastYear];

          // Chercher dans detail_charges_externes.loyers_charges_locatives
          if (sigYear?.detail_charges_externes?.loyers_charges_locatives) {
            loyerAnnuelHC = sigYear.detail_charges_externes.loyers_charges_locatives;
            loyerSource = 'comptabilite';
            loyerAnneeSource = lastYear;
            console.log(`[analyzeBail] Loyer depuis comptabilité ${lastYear}: ${loyerAnnuelHC}€`);
          }
          // Fallback: autres_achats_charges_externes (estimation grossière)
          else if (sigYear?.autres_achats_charges_externes) {
            const chargesExternes = typeof sigYear.autres_achats_charges_externes === 'object'
              ? sigYear.autres_achats_charges_externes.valeur
              : sigYear.autres_achats_charges_externes;

            // Estimer ~30% des charges externes = loyer (heuristique sectorielle)
            if (chargesExternes > 0) {
              loyerAnnuelHC = Math.round(chargesExternes * 0.3);
              loyerSource = 'comptabilite';
              loyerAnneeSource = lastYear;
              donneesManquantes.push('Loyer estimé à 30% des charges externes (détail non disponible)');
              console.log(`[analyzeBail] Loyer estimé depuis charges externes ${lastYear}: ${loyerAnnuelHC}€`);
            }
          }
        }
      }

      // Priorité 2: Document bail
      if (loyerAnnuelHC === null && bailData?.loyer_annuel_hc) {
        loyerAnnuelHC = bailData.loyer_annuel_hc;
        loyerSource = 'bail_document';
        console.log(`[analyzeBail] Loyer depuis document bail: ${loyerAnnuelHC}€`);
      }

      // Priorité 3: Saisie manuelle
      if (loyerAnnuelHC === null && params.manual_input?.loyer_annuel_hc) {
        loyerAnnuelHC = params.manual_input.loyer_annuel_hc;
        loyerSource = 'utilisateur';
        console.log(`[analyzeBail] Loyer depuis saisie utilisateur: ${loyerAnnuelHC}€`);
      }

      // Si toujours null, ajouter aux données manquantes
      if (loyerAnnuelHC === null) {
        donneesManquantes.push('Loyer actuel non disponible (ni dans comptabilité, ni dans documents)');
        console.log('[analyzeBail] ⚠️ Loyer non trouvé dans aucune source');
      }

      let chargesAnnuelles = bailData?.charges_annuelles || 0;

      // Ajustements selon userComments (loyer logement perso)
      let loyerLogementPerso = 0;
      let loyerCommercialAjuste = loyerAnnuelHC || 0;
      let commentaireLoyer = '';

      if (userComments?.loyer) {
        // Si une part logement personnel est spécifiée (mensuel en €)
        if (userComments.loyer.loyer_logement_perso) {
          loyerLogementPerso = userComments.loyer.loyer_logement_perso * 12; // Annualisé
          // Soustraire du loyer commercial
          if (loyerAnnuelHC !== null) {
            loyerCommercialAjuste = Math.max(0, loyerAnnuelHC - loyerLogementPerso);
          }
        }

        // Commentaire utilisateur
        if (userComments.loyer.commentaire) {
          commentaireLoyer = userComments.loyer.commentaire;
        }
      }

      const loyerTotalAnnuel = loyerCommercialAjuste + chargesAnnuelles;
      const loyerMensuel = Math.round(loyerTotalAnnuel / 12);

      // Loyer au m²
      const surfaceM2 = bailData?.surface_m2 || 0;
      const loyerM2Annuel = surfaceM2 > 0 && loyerCommercialAjuste > 0 ? Math.round(loyerCommercialAjuste / surfaceM2) : 0;

      // ÉTAPE 6 : Vérifier données manquantes
      if (!bailData?.type) donneesManquantes.push('Type de bail non spécifié');
      if (!bailData?.bailleur) donneesManquantes.push('Nom du bailleur non fourni');
      if (!bailData?.date_signature) donneesManquantes.push('Date de signature non fournie');
      if (surfaceM2 === 0) donneesManquantes.push('Surface non fournie');

      const bail: any = {
        type: bailData?.type || 'commercial_3_6_9',
        bailleur: bailData?.bailleur || 'Non spécifié',
        date_signature: bailData?.date_signature || '',
        date_effet: bailData?.date_effet || '',
        date_fin: bailData?.date_fin || '',
        duree_initiale_mois: dureeInitialeMois,
        duree_restante_mois: dureeRestanteMois,
        loyer_annuel_hc: loyerAnnuelHC,
        loyer_source: loyerSource,
        loyer_annee_source: loyerAnneeSource,
        loyer_commercial_ajuste: loyerCommercialAjuste,
        charges_annuelles: chargesAnnuelles,
        loyer_total_annuel: loyerTotalAnnuel,
        loyer_mensuel: loyerMensuel,
        depot_garantie: bailData?.depot_garantie || 0,
        surface_m2: surfaceM2,
        loyer_m2_annuel: loyerM2Annuel,
        indexation: bailData?.indexation || 'ILC (Indice des Loyers Commerciaux)',
        clause_resiliation: bailData?.clause_resiliation || 'Résiliation triennale (3-6-9)',
        clause_cession: bailData?.clause_cession || 'Cession possible avec accord du bailleur',
        travaux_preneur: bailData?.travaux_preneur || 'Entretien courant à la charge du preneur',
        destination: bailData?.destination || 'Activité commerciale'
      };

      // Ajouter les informations sur les ajustements utilisateur
      if (loyerLogementPerso > 0 || commentaireLoyer) {
        bail.ajustements_utilisateur = {
          loyer_logement_perso_annuel: loyerLogementPerso,
          loyer_logement_perso_mensuel: Math.round(loyerLogementPerso / 12),
          commentaire: commentaireLoyer || undefined
        };
      }

      return {
        dataStatus: {
          bail_disponible: true,
          source
        },
        bail,
        donnees_manquantes: donneesManquantes
      };

    } catch (error: any) {
      return {
        dataStatus: {
          bail_disponible: false,
          source: 'non_disponible'
        },
        donnees_manquantes: ['Erreur lors de l\'analyse du bail'],
        error: error.message || 'Bail analysis failed'
      };
    }
  }
});

/**
 * Extrait les données du bail depuis un document parsé
 */
function extractBailData(bailDoc: any): any {
  const extractedData = bailDoc.extractedData || {};
  const rawText = extractedData.raw_text || '';

  // Heuristiques d'extraction (patterns regex simplifiés)
  const data: any = {};

  // Type de bail
  if (rawText.toLowerCase().includes('bail commercial') || rawText.toLowerCase().includes('3-6-9')) {
    data.type = 'commercial_3_6_9';
  } else if (rawText.toLowerCase().includes('dérogatoire') || rawText.toLowerCase().includes('précaire')) {
    data.type = 'derogatoire';
  }

  // Bailleur (chercher "BAILLEUR" suivi du nom)
  const bailleurMatch = rawText.match(/BAILLEUR\s*:\s*([A-ZÀ-Ü\s]+)/i);
  if (bailleurMatch) {
    data.bailleur = bailleurMatch[1].trim();
  }

  // Dates (format DD/MM/YYYY)
  const dateRegex = /(\d{2})\/(\d{2})\/(\d{4})/g;
  const dates = [...rawText.matchAll(dateRegex)];
  if (dates.length >= 2) {
    data.date_signature = dates[0][0];
    data.date_effet = dates[1][0];
    // Date de fin = date_effet + durée (si mentionnée)
  }

  // Loyer (chercher montant en euros)
  const loyerMatch = rawText.match(/loyer.*?(\d+\s?\d*)\s*€/i);
  if (loyerMatch) {
    const loyer = parseInt(loyerMatch[1].replace(/\s/g, ''));
    // Déterminer si mensuel ou annuel
    if (rawText.toLowerCase().includes('mensuel')) {
      data.loyer_annuel_hc = loyer * 12;
    } else {
      data.loyer_annuel_hc = loyer;
    }
  }

  // Surface
  const surfaceMatch = rawText.match(/(\d+)\s*m[²2]/i);
  if (surfaceMatch) {
    data.surface_m2 = parseInt(surfaceMatch[1]);
  }

  // Dépôt de garantie
  const depotMatch = rawText.match(/d[ée]p[ôo]t.*?(\d+\s?\d*)\s*€/i);
  if (depotMatch) {
    data.depot_garantie = parseInt(depotMatch[1].replace(/\s/g, ''));
  }

  return data;
}

/**
 * Construit les données du bail depuis saisie manuelle
 */
function buildBailFromManualInput(input: any): any {
  const data: any = {};

  if (input.type) data.type = input.type;
  if (input.bailleur) data.bailleur = input.bailleur;
  if (input.date_signature) data.date_signature = input.date_signature;
  if (input.date_effet) data.date_effet = input.date_effet;
  if (input.loyer_annuel_hc) data.loyer_annuel_hc = input.loyer_annuel_hc;
  if (input.charges_annuelles) data.charges_annuelles = input.charges_annuelles;
  if (input.surface_m2) data.surface_m2 = input.surface_m2;
  if (input.depot_garantie) data.depot_garantie = input.depot_garantie;

  // Date de fin par défaut = date_effet + 9 ans (si commercial 3-6-9)
  if (input.date_effet && input.type === 'commercial_3_6_9') {
    const dateEffet = new Date(input.date_effet);
    const dateFin = new Date(dateEffet);
    dateFin.setFullYear(dateFin.getFullYear() + 9);
    data.date_fin = dateFin.toISOString().split('T')[0];
  }

  return data;
}

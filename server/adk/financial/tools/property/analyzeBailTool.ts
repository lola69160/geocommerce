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
    loyer_annuel_hc: z.number().describe('Loyer annuel hors charges'),
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
    destination: z.string(),
    loyer_marche_estime: z.number(),
    ecart_marche_pct: z.number(),
    appreciation: z.enum(['avantageux', 'marche', 'desavantageux'])
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

      // Calculer loyers (avec prise en compte des commentaires utilisateur)
      let loyerAnnuelHC = bailData.loyer_annuel_hc || 0;
      let chargesAnnuelles = bailData.charges_annuelles || 0;

      // NOUVEAU: Ajustements selon userComments
      let loyerLogementPerso = 0;
      let loyerCommercialAjuste = loyerAnnuelHC;
      let futureRentAdjustment = false;
      let commentaireLoyer = '';

      if (userComments?.loyer) {
        // Si un futur loyer commercial est spécifié (mensuel en €)
        if (userComments.loyer.futur_loyer_commercial) {
          const futureRentMonthly = userComments.loyer.futur_loyer_commercial;
          loyerCommercialAjuste = futureRentMonthly * 12;
          futureRentAdjustment = true;
        }

        // Si une part logement personnel est spécifiée (mensuel en €)
        if (userComments.loyer.loyer_logement_perso) {
          loyerLogementPerso = userComments.loyer.loyer_logement_perso * 12; // Annualisé
          // Soustraire du loyer commercial si futureRent non spécifié
          if (!futureRentAdjustment) {
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
      const surfaceM2 = bailData.surface_m2 || 0;
      const loyerM2Annuel = surfaceM2 > 0 ? Math.round(loyerCommercialAjuste / surfaceM2) : 0;

      // ÉTAPE 5 : Estimer loyer de marché (heuristique simplifiée)
      let loyerMarcheEstime = loyerAnnuelHC;

      // Ratios moyens par type de commerce (€/m²/an)
      const LOYER_MOYEN_FRANCE: { [key: string]: number } = {
        'commerce_centre_ville': 250,
        'commerce_zone_commerciale': 150,
        'commerce_peripherie': 100,
        'default': 180
      };

      // Estimer selon surface et type (simplification)
      if (surfaceM2 > 0) {
        const loyerMoyenM2 = LOYER_MOYEN_FRANCE['default'];
        loyerMarcheEstime = Math.round(surfaceM2 * loyerMoyenM2);
      }

      // Écart par rapport au marché (utilise le loyer commercial ajusté)
      const ecartMarchePct = loyerMarcheEstime > 0
        ? Math.round(((loyerCommercialAjuste - loyerMarcheEstime) / loyerMarcheEstime) * 100)
        : 0;

      let appreciation: 'avantageux' | 'marche' | 'desavantageux' = 'marche';

      if (ecartMarchePct < -15) {
        appreciation = 'avantageux';
      } else if (ecartMarchePct > 15) {
        appreciation = 'desavantageux';
      }

      // Détection négociation favorable utilisateur
      let negociation_utilisateur_favorable = false;
      if (userComments?.loyer?.futur_loyer_commercial) {
        const loyerActuelMensuel = loyerAnnuelHC / 12;
        const loyerFuturMensuel = userComments.loyer.futur_loyer_commercial;

        if (loyerFuturMensuel < loyerActuelMensuel) {
          negociation_utilisateur_favorable = true;
          // Améliorer l'appreciation si négociation réussie
          if (appreciation === 'marche') appreciation = 'avantageux';
          if (appreciation === 'desavantageux') appreciation = 'marche';
        }
      }

      // ÉTAPE 6 : Vérifier données manquantes
      if (!bailData.type) donneesManquantes.push('Type de bail non spécifié');
      if (!bailData.bailleur) donneesManquantes.push('Nom du bailleur non fourni');
      if (!bailData.date_signature) donneesManquantes.push('Date de signature non fournie');
      if (loyerAnnuelHC === 0) donneesManquantes.push('Loyer annuel non fourni');
      if (surfaceM2 === 0) donneesManquantes.push('Surface non fournie');

      const bail: any = {
        type: bailData.type || 'commercial_3_6_9',
        bailleur: bailData.bailleur || 'Non spécifié',
        date_signature: bailData.date_signature || '',
        date_effet: bailData.date_effet || '',
        date_fin: bailData.date_fin || '',
        duree_initiale_mois: dureeInitialeMois,
        duree_restante_mois: dureeRestanteMois,
        loyer_annuel_hc: loyerAnnuelHC,
        loyer_commercial_ajuste: loyerCommercialAjuste, // NOUVEAU
        charges_annuelles: chargesAnnuelles,
        loyer_total_annuel: loyerTotalAnnuel,
        loyer_mensuel: loyerMensuel,
        depot_garantie: bailData.depot_garantie || 0,
        surface_m2: surfaceM2,
        loyer_m2_annuel: loyerM2Annuel,
        indexation: bailData.indexation || 'ILC (Indice des Loyers Commerciaux)',
        clause_resiliation: bailData.clause_resiliation || 'Résiliation triennale (3-6-9)',
        clause_cession: bailData.clause_cession || 'Cession possible avec accord du bailleur',
        travaux_preneur: bailData.travaux_preneur || 'Entretien courant à la charge du preneur',
        destination: bailData.destination || 'Activité commerciale',
        loyer_marche_estime: loyerMarcheEstime,
        ecart_marche_pct: ecartMarchePct,
        appreciation,
        negociation_utilisateur_favorable  // NOUVEAU - pour bonus score immobilier
      };

      // NOUVEAU: Ajouter les informations sur les ajustements utilisateur
      if (loyerLogementPerso > 0 || futureRentAdjustment || commentaireLoyer) {
        bail.ajustements_utilisateur = {
          loyer_logement_perso_annuel: loyerLogementPerso,
          loyer_logement_perso_mensuel: Math.round(loyerLogementPerso / 12),
          futur_loyer_applicable: futureRentAdjustment,
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

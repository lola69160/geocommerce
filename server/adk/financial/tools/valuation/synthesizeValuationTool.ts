import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';
import { logValorisation } from '../../../utils/extractionLogger';

/**
 * Synthesize Valuation Tool
 *
 * Synthétise les 3 méthodes de valorisation et génère une recommandation finale.
 * Compare les résultats des 3 approches (EBE, CA, Patrimoniale) et privilégie
 * la méthode la plus pertinente selon le contexte.
 *
 * Règles de décision:
 * 1. Multiple EBE = méthode de référence pour commerces rentables
 * 2. % CA = méthode complémentaire, moins précise
 * 3. Patrimoniale = pertinente si actifs corporels importants ou EBE faible/négatif
 *
 * Si prix affiché fourni, calcule l'écart et génère argumentaire de négociation.
 */

const SynthesizeValuationInputSchema = z.object({
  methodeEBE: z.object({
    ebe_reference: z.number(),
    ebe_retraite: z.number(),
    valeur_basse: z.number(),
    valeur_mediane: z.number(),
    valeur_haute: z.number()
  }).optional().describe('Résultat de calculateEbeValuation (sera lu depuis state.valorisation si non fourni)'),
  methodeCA: z.object({
    valeur_basse: z.number(),
    valeur_mediane: z.number(),
    valeur_haute: z.number()
  }).optional().describe('Résultat de calculateCaValuation (sera lu depuis state.valorisation si non fourni)'),
  methodePatrimoniale: z.object({
    actif_net_comptable: z.number(),
    valeur_estimee: z.number()
  }).optional().describe('Résultat de calculatePatrimonial (sera lu depuis state.valorisation si non fourni)'),
  prix_affiche: z.number().optional().describe('Prix affiché par le vendeur (si connu)'),
  context_notes: z.string().optional().describe('Notes contextuelles pour affiner la recommandation')
});

const SynthesizeValuationOutputSchema = z.object({
  synthese: z.object({
    fourchette_basse: z.number(),
    fourchette_mediane: z.number(),
    fourchette_haute: z.number(),
    methode_privilegiee: z.enum(['EBE', 'CA', 'Patrimoniale']),
    raison_methode: z.string(),
    valeur_recommandee: z.number()
  }),
  comparaisonPrix: z.object({
    prix_affiche: z.number(),
    ecart_vs_estimation_pct: z.number(),
    appreciation: z.enum(['sous-evalue', 'prix_marche', 'sur-evalue']),
    marge_negociation: z.number()
  }).optional(),
  argumentsNegociation: z.object({
    pour_acheteur: z.array(z.string()),
    pour_vendeur: z.array(z.string())
  }),
  confidence: z.number().describe('Niveau de confiance de la valorisation (0-100)'),
  limitations: z.array(z.string()).describe('Ce qui manque pour affiner la valorisation'),
  error: z.string().optional()
});

export const synthesizeValuationTool = new FunctionTool({
  name: 'synthesizeValuation',
  description: 'Synthétise les 3 méthodes de valorisation et génère fourchette finale + recommandation. Compare avec prix affiché si fourni et génère argumentaire de négociation.',
  parameters: zToGen(SynthesizeValuationInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    try {
      // PRIORITÉ 1: Utiliser les méthodes passées en paramètres (nouveau pattern)
      // FALLBACK: Lire depuis state.valorisation (ancien pattern, backward compat)

      let methodeEBE = params.methodeEBE;
      let methodeCA = params.methodeCA;
      let methodePatrimoniale = params.methodePatrimoniale;

      // Si les méthodes ne sont pas en paramètres, essayer de lire depuis le state
      if (!methodeEBE || !methodeCA || !methodePatrimoniale) {
        let valorisation = toolContext?.state.get('valorisation') as any;

        // Parser JSON string si nécessaire
        if (typeof valorisation === 'string') {
          try {
            valorisation = JSON.parse(valorisation);
          } catch (e) {
            // Ignorer l'erreur et continuer avec les paramètres (si fournis)
          }
        }

        // Fallback vers le state (backward compatibility)
        if (valorisation) {
          methodeEBE = methodeEBE || valorisation.methodeEBE;
          methodeCA = methodeCA || valorisation.methodeCA;
          methodePatrimoniale = methodePatrimoniale || valorisation.methodePatrimoniale;
        }
      }

      // Vérifier qu'on a bien les 3 méthodes (depuis params OU state)
      if (!methodeEBE || !methodeCA || !methodePatrimoniale) {
        return {
          synthese: {
            fourchette_basse: 0,
            fourchette_mediane: 0,
            fourchette_haute: 0,
            methode_privilegiee: 'EBE' as const,
            raison_methode: 'Données de valorisation manquantes',
            valeur_recommandee: 0
          },
          argumentsNegociation: {
            pour_acheteur: [],
            pour_vendeur: []
          },
          confidence: 0,
          limitations: ['Les 3 méthodes de valorisation doivent être calculées avant la synthèse'],
          error: 'Missing valuation methods (not in params nor in state.valorisation)'
        };
      }

      // Lire comptable depuis state (pour contexte)
      let comptable = toolContext?.state.get('comptable') as any;

      if (typeof comptable === 'string') {
        try {
          comptable = JSON.parse(comptable);
        } catch (e) {
          // Pas critique
        }
      }

      // NOUVEAU: Lire documentExtraction pour transactionCosts
      let documentExtraction = toolContext?.state.get('documentExtraction') as any;

      if (typeof documentExtraction === 'string') {
        try {
          documentExtraction = JSON.parse(documentExtraction);
        } catch (e) {
          // Pas critique
        }
      }

      // Si prix_affiche non fourni en params, utiliser transactionCosts.prix_fonds
      let prixAffiche = params.prix_affiche;
      if (!prixAffiche && documentExtraction?.transactionCosts?.prix_fonds) {
        prixAffiche = documentExtraction.transactionCosts.prix_fonds;
      }

      // Déterminer la méthode privilégiée
      let methodePrivilegiee: 'EBE' | 'CA' | 'Patrimoniale' = 'EBE';
      let raisonMethode = '';

      // Règle 1: Si EBE négatif ou très faible, privilégier patrimoniale
      if (methodeEBE.ebe_retraite <= 0) {
        methodePrivilegiee = 'Patrimoniale';
        raisonMethode = 'EBE négatif ou nul : la méthode patrimoniale est plus adaptée dans ce cas.';
      }
      // Règle 2: Si actif net > 2x valeur EBE, considérer patrimoniale
      else if (methodePatrimoniale.valeur_estimee > methodeEBE.valeur_mediane * 2) {
        methodePrivilegiee = 'Patrimoniale';
        raisonMethode = 'Actifs corporels importants (valeur patrimoniale significativement supérieure) : méthode patrimoniale pertinente.';
      }
      // Règle 3: Par défaut, privilégier EBE (méthode de référence)
      else {
        methodePrivilegiee = 'EBE';
        raisonMethode = 'Multiple d\'EBE est la méthode de référence en France pour valoriser les fonds de commerce rentables.';
      }

      // Calculer fourchette synthétique (pondération des 3 méthodes)
      let fourchetteBasse = 0;
      let fourchetteMediane = 0;
      let fourchetteHaute = 0;

      if (methodePrivilegiee === 'EBE') {
        // Pondération: 70% EBE, 20% CA, 10% Patrimoniale
        fourchetteBasse = Math.round(
          methodeEBE.valeur_basse * 0.7 +
          methodeCA.valeur_basse * 0.2 +
          methodePatrimoniale.valeur_estimee * 0.1
        );
        fourchetteMediane = Math.round(
          methodeEBE.valeur_mediane * 0.7 +
          methodeCA.valeur_mediane * 0.2 +
          methodePatrimoniale.valeur_estimee * 0.1
        );
        fourchetteHaute = Math.round(
          methodeEBE.valeur_haute * 0.7 +
          methodeCA.valeur_haute * 0.2 +
          methodePatrimoniale.valeur_estimee * 0.1
        );
      } else if (methodePrivilegiee === 'Patrimoniale') {
        // Pondération: 60% Patrimoniale, 30% CA, 10% EBE
        fourchetteBasse = Math.round(
          methodePatrimoniale.valeur_estimee * 0.6 +
          methodeCA.valeur_basse * 0.3 +
          methodeEBE.valeur_basse * 0.1
        );
        fourchetteMediane = Math.round(
          methodePatrimoniale.valeur_estimee * 0.6 +
          methodeCA.valeur_mediane * 0.3 +
          methodeEBE.valeur_mediane * 0.1
        );
        fourchetteHaute = Math.round(
          methodePatrimoniale.valeur_estimee * 0.6 +
          methodeCA.valeur_haute * 0.3 +
          methodeEBE.valeur_haute * 0.1
        );
      } else {
        // CA (rarement privilégié)
        fourchetteBasse = methodeCA.valeur_basse;
        fourchetteMediane = methodeCA.valeur_mediane;
        fourchetteHaute = methodeCA.valeur_haute;
      }

      // Valeur recommandée = médiane
      const valeurRecommandee = fourchetteMediane;

      // Comparaison avec prix affiché (si fourni en params ou depuis transactionCosts)
      let comparaisonPrix: any = undefined;

      if (prixAffiche && prixAffiche > 0) {
        const ecartPct = Math.round(((prixAffiche - valeurRecommandee) / valeurRecommandee) * 100);

        let appreciation: 'sous-evalue' | 'prix_marche' | 'sur-evalue' = 'prix_marche';

        if (ecartPct < -15) {
          appreciation = 'sous-evalue';
        } else if (ecartPct > 15) {
          appreciation = 'sur-evalue';
        }

        // Marge de négociation = différence entre prix affiché et fourchette médiane
        const margeNegociation = prixAffiche - fourchetteMediane;

        comparaisonPrix = {
          prix_affiche: prixAffiche,
          ecart_vs_estimation_pct: ecartPct,
          appreciation,
          marge_negociation: margeNegociation
        };
      }

      // Générer arguments de négociation
      const argumentsPourAcheteur: string[] = [];
      const argumentsPourVendeur: string[] = [];

      // Arguments acheteur (pour baisser le prix)
      if (comptable?.alertes) {
        const alertesCritical = comptable.alertes.filter((a: any) => a.level === 'critical');
        if (alertesCritical.length > 0) {
          alertesCritical.forEach((a: any) => {
            argumentsPourAcheteur.push(`⚠️ ${a.category.toUpperCase()}: ${a.message} - ${a.impact}`);
          });
        }
      }

      if (comptable?.evolution?.tendance === 'declin') {
        argumentsPourAcheteur.push(`📉 Tendance à la baisse : CA ${comptable.evolution.ca_evolution_pct}%, EBE ${comptable.evolution.ebe_evolution_pct}%`);
      }

      if (methodeEBE.ebe_retraite < methodeEBE.ebe_reference) {
        argumentsPourAcheteur.push(`💰 EBE nécessite retraitements importants (${methodeEBE.ebe_reference.toLocaleString('fr-FR')} € → ${methodeEBE.ebe_retraite.toLocaleString('fr-FR')} €)`);
      }

      if (comparaisonPrix?.appreciation === 'sur-evalue') {
        argumentsPourAcheteur.push(`📊 Prix affiché (${comparaisonPrix.prix_affiche.toLocaleString('fr-FR')} €) supérieur de ${comparaisonPrix.ecart_vs_estimation_pct}% à la valorisation médiane`);
      }

      if (argumentsPourAcheteur.length === 0) {
        argumentsPourAcheteur.push('Pas d\'argument majeur identifié pour négocier à la baisse');
      }

      // Arguments vendeur (anticiper)
      if (comptable?.evolution?.tendance === 'croissance') {
        argumentsPourVendeur.push(`📈 Forte croissance : CA +${comptable.evolution.ca_evolution_pct}%, potentiel de développement`);
      }

      if (comptable?.healthScore?.overall >= 70) {
        argumentsPourVendeur.push(`✅ Excellente santé financière : score ${comptable.healthScore.overall}/100`);
      }

      if (comptable?.benchmark?.comparisons) {
        const superieurs = comptable.benchmark.comparisons.filter((c: any) => c.position === 'superieur');
        if (superieurs.length >= 3) {
          argumentsPourVendeur.push(`🏆 Performance supérieure au secteur sur ${superieurs.length} ratios clés`);
        }
      }

      if (comparaisonPrix?.appreciation === 'sous-evalue') {
        argumentsPourVendeur.push(`💎 Prix demandé (${comparaisonPrix.prix_affiche.toLocaleString('fr-FR')} €) en-dessous de la valorisation (-${Math.abs(comparaisonPrix.ecart_vs_estimation_pct)}%), affaire à saisir`);
      }

      if (argumentsPourVendeur.length === 0) {
        argumentsPourVendeur.push('Commerce standard sans argument de valorisation particulier');
      }

      // Calculer niveau de confiance
      let confidence = 50; // Base

      // +20 si 3 années de données
      if (comptable?.yearsAnalyzed?.length >= 3) {
        confidence += 20;
      }

      // +15 si secteur connu (coefficients spécifiques)
      if (valorisation.businessInfo?.nafCode) {
        confidence += 15;
      }

      // +10 si tendance croissance
      if (comptable?.evolution?.tendance === 'croissance') {
        confidence += 10;
      }

      // +5 si score santé > 60
      if (comptable?.healthScore?.overall >= 60) {
        confidence += 5;
      }

      // -10 si EBE négatif
      if (methodeEBE.ebe_retraite <= 0) {
        confidence -= 10;
      }

      // -5 si tendance déclin
      if (comptable?.evolution?.tendance === 'declin') {
        confidence -= 5;
      }

      confidence = Math.max(0, Math.min(confidence, 100));

      // Limitations
      const limitations: string[] = [];

      if (!comptable?.yearsAnalyzed || comptable.yearsAnalyzed.length < 3) {
        limitations.push('Données sur moins de 3 ans : difficulté à identifier les tendances');
      }

      if (!valorisation.businessInfo?.nafCode) {
        limitations.push('Code NAF non fourni : coefficients génériques utilisés');
      }

      if (methodePatrimoniale.actif_net_comptable === 0) {
        limitations.push('Bilan non fourni : valorisation patrimoniale approximative');
      }

      if (!params.prix_affiche) {
        limitations.push('Prix affiché non fourni : impossible de comparer à la demande du vendeur');
      }

      if (limitations.length === 0) {
        limitations.push('Aucune limitation majeure identifiée');
      }

      // Log valorisation to extraction log
      const siret = (toolContext?.state.get('businessInfo') as any)?.siret || 'unknown';
      logValorisation(siret, {
        methode_ebe: {
          valeur: methodeEBE.valeur_mediane,
          multiple: methodeEBE.ebe_retraite > 0 ? Math.round(methodeEBE.valeur_mediane / methodeEBE.ebe_retraite * 10) / 10 : 0
        },
        methode_ca: {
          valeur: methodeCA.valeur_mediane,
          pourcentage: 0 // Will be calculated separately if needed
        },
        methode_patrimoniale: {
          valeur: methodePatrimoniale.valeur_estimee
        },
        recommendation: {
          valeur_min: fourchetteBasse,
          valeur_max: fourchetteHaute,
          valeur_mediane: fourchetteMediane
        }
      });

      return {
        synthese: {
          fourchette_basse: fourchetteBasse,
          fourchette_mediane: fourchetteMediane,
          fourchette_haute: fourchetteHaute,
          methode_privilegiee: methodePrivilegiee,
          raison_methode: raisonMethode,
          valeur_recommandee: valeurRecommandee
        },
        comparaisonPrix,
        argumentsNegociation: {
          pour_acheteur: argumentsPourAcheteur,
          pour_vendeur: argumentsPourVendeur
        },
        confidence,
        limitations
      };

    } catch (error: any) {
      return {
        synthese: {
          fourchette_basse: 0,
          fourchette_mediane: 0,
          fourchette_haute: 0,
          methode_privilegiee: 'EBE' as const,
          raison_methode: 'Erreur lors du calcul',
          valeur_recommandee: 0
        },
        argumentsNegociation: {
          pour_acheteur: [],
          pour_vendeur: []
        },
        confidence: 0,
        limitations: ['Erreur lors de la synthèse'],
        error: error.message || 'Valuation synthesis failed'
      };
    }
  }
});

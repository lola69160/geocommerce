import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';

/**
 * Detect Anomalies Tool
 *
 * Détecte les anomalies dans les données financières :
 * - Données manquantes critiques (ex: pas de bilan, pas de compte de résultat)
 * - Incohérences (ex: résultat net > CA, endettement négatif)
 * - Valeurs aberrantes (ex: marge brute >100%, délai clients >365 jours)
 * - Erreurs de calcul (ex: SIG ne correspondent pas aux formules)
 *
 * Types d'anomalies :
 * - donnee_manquante : Données critiques absentes
 * - incoherence : Données contradictoires entre elles
 * - valeur_aberrante : Valeurs hors normes statistiques
 * - calcul_errone : Erreur dans les calculs dérivés
 */

const DetectAnomaliesInputSchema = z.object({
  debug: z.boolean().optional().describe('Mode debug pour logs détaillés')
});

const AnomalySchema = z.object({
  type: z.enum(['donnee_manquante', 'incoherence', 'valeur_aberrante', 'calcul_errone']),
  severity: z.enum(['info', 'warning', 'critical']),
  description: z.string().describe('Description de l\'anomalie'),
  valeurs_concernees: z.record(z.string(), z.any()).describe('Valeurs impliquées dans l\'anomalie'),
  recommendation: z.string().describe('Recommandation pour résoudre l\'anomalie')
});

const DetectAnomaliesOutputSchema = z.object({
  anomalies: z.array(AnomalySchema),
  totalAnomalies: z.number(),
  criticalCount: z.number(),
  warningCount: z.number(),
  infoCount: z.number(),
  error: z.string().optional()
});

export const detectAnomaliesTool = new FunctionTool({
  name: 'detectAnomalies',
  description: 'Détecte les anomalies dans les données financières : données manquantes, incohérences, valeurs aberrantes, erreurs de calcul',
  parameters: zToGen(DetectAnomaliesInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    try {
      const anomalies: any[] = [];

      // Récupérer tous les states
      let documentExtraction = parseState(toolContext?.state.get('documentExtraction'));
      let comptable = parseState(toolContext?.state.get('comptable'));
      let valorisation = parseState(toolContext?.state.get('valorisation'));
      let immobilier = parseState(toolContext?.state.get('immobilier'));

      // ANOMALIE 1 : Données manquantes dans documentExtraction
      if (!documentExtraction || !documentExtraction.documents || documentExtraction.documents.length === 0) {
        anomalies.push({
          type: 'donnee_manquante',
          severity: 'critical',
          description: 'Aucun document comptable n\'a été fourni ou extrait',
          valeurs_concernees: { documents_count: 0 },
          recommendation: 'Demander au vendeur de fournir au minimum les 3 derniers bilans et comptes de résultat'
        });
      } else {
        const documents = documentExtraction.documents;
        const hasBilan = documents.some((d: any) => d.documentType === 'bilan');
        const hasCompteResultat = documents.some((d: any) => d.documentType === 'compte_resultat');

        if (!hasBilan) {
          anomalies.push({
            type: 'donnee_manquante',
            severity: 'critical',
            description: 'Aucun bilan comptable n\'a été fourni',
            valeurs_concernees: { type_manquant: 'bilan' },
            recommendation: 'Demander les bilans des 3 dernières années pour analyser la structure financière'
          });
        }

        if (!hasCompteResultat) {
          anomalies.push({
            type: 'donnee_manquante',
            severity: 'critical',
            description: 'Aucun compte de résultat n\'a été fourni',
            valeurs_concernees: { type_manquant: 'compte_resultat' },
            recommendation: 'Demander les comptes de résultat des 3 dernières années pour analyser la rentabilité'
          });
        }

        // Vérifier années manquantes
        const years = extractYearsFromDocuments(documents);
        if (years.length < 2) {
          anomalies.push({
            type: 'donnee_manquante',
            severity: 'warning',
            description: 'Moins de 2 années de données disponibles - analyse de tendance limitée',
            valeurs_concernees: { annees_disponibles: years },
            recommendation: 'Demander les documents des 3 dernières années pour une analyse complète'
          });
        }
      }

      // ANOMALIE 2 : Incohérences dans les SIG
      if (comptable?.sig) {
        const years = Object.keys(comptable.sig);

        for (const yearStr of years) {
          const sig = comptable.sig[yearStr];

          // Incohérence : Résultat net > CA
          if (sig.resultat_net > sig.chiffre_affaires) {
            anomalies.push({
              type: 'incoherence',
              severity: 'critical',
              description: `${yearStr} : Résultat net supérieur au chiffre d'affaires (impossible)`,
              valeurs_concernees: {
                annee: yearStr,
                resultat_net: sig.resultat_net,
                chiffre_affaires: sig.chiffre_affaires
              },
              recommendation: 'Vérifier les données sources et les calculs - probable erreur d\'extraction ou de saisie'
            });
          }

          // Incohérence : Marge commerciale négative sans être commerce
          if (sig.marge_commerciale < -1000 && sig.achats_marchandises > 0) {
            anomalies.push({
              type: 'incoherence',
              severity: 'warning',
              description: `${yearStr} : Marge commerciale fortement négative`,
              valeurs_concernees: {
                annee: yearStr,
                marge_commerciale: sig.marge_commerciale
              },
              recommendation: 'Vérifier si l\'activité est bien commerciale ou si c\'est une erreur de classification'
            });
          }

          // Incohérence : EBE positif mais résultat net très négatif
          if (sig.ebe > 10000 && sig.resultat_net < -sig.ebe * 2) {
            anomalies.push({
              type: 'incoherence',
              severity: 'warning',
              description: `${yearStr} : EBE positif (${sig.ebe}€) mais résultat net très négatif (${sig.resultat_net}€)`,
              valeurs_concernees: {
                annee: yearStr,
                ebe: sig.ebe,
                resultat_net: sig.resultat_net
              },
              recommendation: 'Analyser les charges financières et exceptionnelles qui pénalisent le résultat'
            });
          }
        }
      }

      // ANOMALIE 3 : Valeurs aberrantes dans les ratios
      if (comptable?.ratios) {
        const ratios = comptable.ratios;

        // Marge brute > 100%
        if (ratios.marge_brute_pct > 100) {
          anomalies.push({
            type: 'valeur_aberrante',
            severity: 'critical',
            description: 'Marge brute supérieure à 100% (impossible)',
            valeurs_concernees: { marge_brute_pct: ratios.marge_brute_pct },
            recommendation: 'Vérifier le calcul de la marge brute et les données sources'
          });
        }

        // Marge EBE anormalement élevée
        if (ratios.marge_ebe_pct > 50) {
          anomalies.push({
            type: 'valeur_aberrante',
            severity: 'warning',
            description: 'Marge EBE très élevée (>50%) - vérifier',
            valeurs_concernees: { marge_ebe_pct: ratios.marge_ebe_pct },
            recommendation: 'Confirmer que la marge EBE est correcte - peut indiquer une activité à très forte valeur ajoutée ou une erreur'
          });
        }

        // Délai clients aberrant
        if (ratios.delai_clients_jours > 180) {
          anomalies.push({
            type: 'valeur_aberrante',
            severity: 'warning',
            description: 'Délai clients supérieur à 6 mois - risque de créances irrécouvrables',
            valeurs_concernees: { delai_clients_jours: ratios.delai_clients_jours },
            recommendation: 'Analyser la qualité des créances clients et le risque de non-recouvrement'
          });
        }

        // Endettement extrême
        if (ratios.taux_endettement_pct > 300) {
          anomalies.push({
            type: 'valeur_aberrante',
            severity: 'critical',
            description: 'Endettement extrêmement élevé (>300%) - situation financière très fragile',
            valeurs_concernees: { taux_endettement_pct: ratios.taux_endettement_pct },
            recommendation: 'Analyse approfondie de la structure de la dette et de la capacité de remboursement nécessaire'
          });
        }

        // BFR aberrant
        if (ratios.bfr_jours_ca > 120) {
          anomalies.push({
            type: 'valeur_aberrante',
            severity: 'warning',
            description: 'BFR très élevé (>4 mois de CA) - risque de tension de trésorerie',
            valeurs_concernees: { bfr_jours_ca: ratios.bfr_jours_ca },
            recommendation: 'Optimiser le BFR : réduire les stocks, accélérer les encaissements, négocier les délais fournisseurs'
          });
        }

        // CAF négative
        if (ratios.capacite_autofinancement < 0) {
          anomalies.push({
            type: 'valeur_aberrante',
            severity: 'critical',
            description: 'Capacité d\'autofinancement négative - entreprise non rentable',
            valeurs_concernees: { capacite_autofinancement: ratios.capacite_autofinancement },
            recommendation: 'Redressement urgent nécessaire - l\'entreprise détruit de la valeur'
          });
        }
      }

      // ANOMALIE 4 : Erreurs de calcul (vérification formules SIG)
      if (comptable?.sig) {
        const years = Object.keys(comptable.sig);

        for (const yearStr of years) {
          const sig = comptable.sig[yearStr];

          // Vérifier marge commerciale = ventes - achats
          const expectedMarge = sig.chiffre_affaires - sig.achats_marchandises;
          const margeDeviation = Math.abs(sig.marge_commerciale - expectedMarge);

          if (margeDeviation > 1000 && sig.achats_marchandises > 0) {
            anomalies.push({
              type: 'calcul_errone',
              severity: 'warning',
              description: `${yearStr} : Marge commerciale incohérente avec CA et achats`,
              valeurs_concernees: {
                annee: yearStr,
                marge_calculee: sig.marge_commerciale,
                marge_attendue: expectedMarge,
                ecart: margeDeviation
              },
              recommendation: 'Vérifier le calcul de la marge commerciale et les données sources'
            });
          }

          // Vérifier résultat net = résultat courant + exceptionnel - impôts
          const expectedRN = sig.resultat_courant + sig.resultat_exceptionnel - sig.impots;
          const rnDeviation = Math.abs(sig.resultat_net - expectedRN);

          if (rnDeviation > 1000) {
            anomalies.push({
              type: 'calcul_errone',
              severity: 'warning',
              description: `${yearStr} : Résultat net incohérent avec la formule`,
              valeurs_concernees: {
                annee: yearStr,
                resultat_net_calcule: sig.resultat_net,
                resultat_net_attendu: expectedRN,
                ecart: rnDeviation
              },
              recommendation: 'Vérifier le calcul du résultat net'
            });
          }
        }
      }

      // ANOMALIE 5 : Valorisation incohérente
      if (valorisation?.methodes) {
        const methodes = valorisation.methodes;

        // Valorisation EBE avec EBE négatif
        if (methodes.ebe && methodes.ebe.ebe_reference < 0) {
          anomalies.push({
            type: 'incoherence',
            severity: 'warning',
            description: 'Méthode de valorisation par EBE utilisée alors que l\'EBE est négatif',
            valeurs_concernees: { ebe_reference: methodes.ebe.ebe_reference },
            recommendation: 'Privilégier la méthode patrimoniale ou par CA pour une valorisation avec EBE négatif'
          });
        }

        // Écart important entre méthodes
        if (methodes.ebe && methodes.ca && methodes.patrimoniale) {
          const valoEBE = methodes.ebe.valorisation;
          const valoCA = methodes.ca.valorisation;
          const valoPatri = methodes.patrimoniale.valorisation;

          const maxValo = Math.max(valoEBE, valoCA, valoPatri);
          const minValo = Math.min(valoEBE, valoCA, valoPatri);

          if (maxValo > minValo * 2) {
            anomalies.push({
              type: 'valeur_aberrante',
              severity: 'warning',
              description: 'Écart très important entre les méthodes de valorisation (>100%)',
              valeurs_concernees: {
                valorisation_ebe: valoEBE,
                valorisation_ca: valoCA,
                valorisation_patrimoniale: valoPatri
              },
              recommendation: 'Analyser les raisons de l\'écart et justifier le choix de la méthode retenue'
            });
          }
        }
      }

      // ANOMALIE 6 : Immobilier incohérent
      if (immobilier?.synthese) {
        const synthese = immobilier.synthese;

        // Loyer aberrant par rapport au CA
        if (comptable?.sig) {
          const latestYear = comptable.yearsAnalyzed?.[0];
          if (latestYear && comptable.sig[latestYear]) {
            const ca = comptable.sig[latestYear].chiffre_affaires;
            const loyerAnnuel = (synthese.loyer_mensuel || 0) * 12;

            if (loyerAnnuel > ca * 0.3 && ca > 0) {
              anomalies.push({
                type: 'valeur_aberrante',
                severity: 'warning',
                description: 'Loyer très élevé par rapport au CA (>30%)',
                valeurs_concernees: {
                  loyer_annuel: loyerAnnuel,
                  ca: ca,
                  ratio_loyer_ca: ((loyerAnnuel / ca) * 100).toFixed(1) + '%'
                },
                recommendation: 'Vérifier la viabilité économique avec un loyer aussi élevé'
              });
            }
          }
        }

        // Prix murs aberrant
        if (synthese.murs_prix_estime && synthese.murs_prix_estime > 10000000) {
          anomalies.push({
            type: 'valeur_aberrante',
            severity: 'info',
            description: 'Prix des murs très élevé (>10M€) - vérifier',
            valeurs_concernees: { murs_prix_estime: synthese.murs_prix_estime },
            recommendation: 'Confirmer l\'estimation du prix des murs avec un expert immobilier'
          });
        }
      }

      // Calculer les statistiques
      const totalAnomalies = anomalies.length;
      const criticalCount = anomalies.filter(a => a.severity === 'critical').length;
      const warningCount = anomalies.filter(a => a.severity === 'warning').length;
      const infoCount = anomalies.filter(a => a.severity === 'info').length;

      return {
        anomalies,
        totalAnomalies,
        criticalCount,
        warningCount,
        infoCount
      };

    } catch (error: any) {
      return {
        anomalies: [],
        totalAnomalies: 0,
        criticalCount: 0,
        warningCount: 0,
        infoCount: 0,
        error: error.message || 'Anomaly detection failed'
      };
    }
  }
});

/**
 * Parse state (handle JSON string)
 */
function parseState(state: any): any {
  if (!state) return null;
  if (typeof state === 'string') {
    try {
      return JSON.parse(state);
    } catch {
      return null;
    }
  }
  return state;
}

/**
 * Extrait les années depuis les documents
 */
function extractYearsFromDocuments(documents: any[]): number[] {
  const years = new Set<number>();
  for (const doc of documents) {
    if (doc.year && typeof doc.year === 'number') {
      years.add(doc.year);
    }
  }
  return Array.from(years).sort((a, b) => b - a);
}

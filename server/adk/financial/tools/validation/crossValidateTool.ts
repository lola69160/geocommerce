import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';

/**
 * Cross Validate Tool
 *
 * Vérifie la cohérence entre les différentes analyses financières :
 * - DocumentExtraction vs Comptable (données sources vs calculs)
 * - Comptable vs Valorisation (cohérence des valorisations avec la santé)
 * - Valorisation vs Immobilier (cohérence prix total)
 * - Présence des données nécessaires pour chaque analyse
 *
 * Exemples de vérifications :
 * - Le CA utilisé dans les SIG correspond au CA extrait des documents
 * - L'EBE utilisé pour la valorisation est cohérent avec les SIG
 * - La valorisation totale inclut bien l'immobilier si applicable
 * - Les années analysées sont cohérentes entre agents
 */

const CrossValidateInputSchema = z.object({
  debug: z.boolean().optional().describe('Mode debug pour logs détaillés')
});

const CoherenceCheckSchema = z.object({
  check: z.string().describe('Nom de la vérification'),
  status: z.enum(['ok', 'warning', 'error']),
  details: z.string().describe('Détails de la vérification'),
  sources: z.array(z.string()).describe('Agents concernés par cette vérification')
});

const CrossValidateOutputSchema = z.object({
  coherenceChecks: z.array(CoherenceCheckSchema),
  totalChecks: z.number().describe('Nombre total de vérifications effectuées'),
  passedChecks: z.number().describe('Nombre de vérifications OK'),
  warningChecks: z.number().describe('Nombre de warnings'),
  errorChecks: z.number().describe('Nombre d\'erreurs'),
  error: z.string().optional()
});

export const crossValidateTool = new FunctionTool({
  name: 'crossValidate',
  description: 'Effectue des vérifications croisées de cohérence entre les différentes analyses financières (extraction, comptable, valorisation, immobilier)',
  parameters: zToGen(CrossValidateInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    try {
      const checks: any[] = [];

      // Récupérer tous les states
      let documentExtraction = parseState(toolContext?.state.get('documentExtraction'));
      let comptable = parseState(toolContext?.state.get('comptable'));
      let valorisation = parseState(toolContext?.state.get('valorisation'));
      let immobilier = parseState(toolContext?.state.get('immobilier'));

      // CHECK 1 : Présence des analyses requises
      if (!documentExtraction || !documentExtraction.documents) {
        checks.push({
          check: 'Présence DocumentExtraction',
          status: 'error',
          details: 'L\'extraction de documents n\'a pas été effectuée ou n\'a retourné aucun document',
          sources: ['documentExtraction']
        });
      } else {
        checks.push({
          check: 'Présence DocumentExtraction',
          status: 'ok',
          details: `${documentExtraction.documents.length} document(s) extrait(s)`,
          sources: ['documentExtraction']
        });
      }

      if (!comptable || !comptable.sig) {
        checks.push({
          check: 'Présence Analyse Comptable',
          status: 'error',
          details: 'L\'analyse comptable n\'a pas été effectuée ou n\'a pas retourné de SIG',
          sources: ['comptable']
        });
      } else {
        checks.push({
          check: 'Présence Analyse Comptable',
          status: 'ok',
          details: `SIG calculés pour ${comptable.yearsAnalyzed?.length || 0} année(s)`,
          sources: ['comptable']
        });
      }

      // Vérifications de cohérence si les données sont présentes
      if (documentExtraction?.documents && comptable?.sig) {
        // CHECK 2 : Cohérence des années analysées
        const extractedYears = extractYearsFromDocuments(documentExtraction.documents);
        const analyzedYears = comptable.yearsAnalyzed || [];

        if (extractedYears.length === 0) {
          checks.push({
            check: 'Cohérence années',
            status: 'warning',
            details: 'Aucune année identifiée dans les documents extraits',
            sources: ['documentExtraction', 'comptable']
          });
        } else {
          const missingYears = extractedYears.filter((y: number) => !analyzedYears.includes(y));
          if (missingYears.length > 0) {
            checks.push({
              check: 'Cohérence années',
              status: 'warning',
              details: `Années extraites mais non analysées : ${missingYears.join(', ')}`,
              sources: ['documentExtraction', 'comptable']
            });
          } else {
            checks.push({
              check: 'Cohérence années',
              status: 'ok',
              details: `Toutes les années extraites ont été analysées (${analyzedYears.join(', ')})`,
              sources: ['documentExtraction', 'comptable']
            });
          }
        }

        // CHECK 3 : Cohérence CA (extraction vs SIG)
        const latestYear = analyzedYears[0];
        if (latestYear && comptable.sig[latestYear]) {
          const sigCA = comptable.sig[latestYear].chiffre_affaires;
          const extractedCA = extractCAFromDocuments(documentExtraction.documents, latestYear);

          if (extractedCA > 0) {
            const deviation = Math.abs((sigCA - extractedCA) / extractedCA * 100);
            if (deviation > 10) {
              checks.push({
                check: 'Cohérence CA extraction/SIG',
                status: 'error',
                details: `Écart significatif entre CA extrait (${extractedCA}€) et CA des SIG (${sigCA}€) : ${deviation.toFixed(1)}%`,
                sources: ['documentExtraction', 'comptable']
              });
            } else if (deviation > 2) {
              checks.push({
                check: 'Cohérence CA extraction/SIG',
                status: 'warning',
                details: `Léger écart entre CA extrait (${extractedCA}€) et CA des SIG (${sigCA}€) : ${deviation.toFixed(1)}%`,
                sources: ['documentExtraction', 'comptable']
              });
            } else {
              checks.push({
                check: 'Cohérence CA extraction/SIG',
                status: 'ok',
                details: `CA cohérent entre extraction (${extractedCA}€) et SIG (${sigCA}€)`,
                sources: ['documentExtraction', 'comptable']
              });
            }
          }
        }
      }

      // CHECK 4 : Cohérence Comptable vs Valorisation
      if (comptable?.sig && valorisation?.methodes) {
        const latestYear = comptable.yearsAnalyzed?.[0];
        if (latestYear && comptable.sig[latestYear]) {
          const sigEBE = comptable.sig[latestYear].ebe;
          const valoEBE = valorisation.methodes.ebe?.ebe_reference;

          if (valoEBE && sigEBE > 0) {
            const deviation = Math.abs((sigEBE - valoEBE) / sigEBE * 100);
            if (deviation > 5) {
              checks.push({
                check: 'Cohérence EBE comptable/valorisation',
                status: 'error',
                details: `Écart entre EBE SIG (${sigEBE}€) et EBE valorisation (${valoEBE}€) : ${deviation.toFixed(1)}%`,
                sources: ['comptable', 'valorisation']
              });
            } else {
              checks.push({
                check: 'Cohérence EBE comptable/valorisation',
                status: 'ok',
                details: `EBE cohérent entre SIG (${sigEBE}€) et valorisation (${valoEBE}€)`,
                sources: ['comptable', 'valorisation']
              });
            }
          }

          const sigCA = comptable.sig[latestYear].chiffre_affaires;
          const valoCA = valorisation.methodes.ca?.ca_reference;

          if (valoCA && sigCA > 0) {
            const deviation = Math.abs((sigCA - valoCA) / sigCA * 100);
            if (deviation > 5) {
              checks.push({
                check: 'Cohérence CA comptable/valorisation',
                status: 'error',
                details: `Écart entre CA SIG (${sigCA}€) et CA valorisation (${valoCA}€) : ${deviation.toFixed(1)}%`,
                sources: ['comptable', 'valorisation']
              });
            } else {
              checks.push({
                check: 'Cohérence CA comptable/valorisation',
                status: 'ok',
                details: `CA cohérent entre SIG (${sigCA}€) et valorisation (${valoCA}€)`,
                sources: ['comptable', 'valorisation']
              });
            }
          }
        }
      }

      // CHECK 5 : Cohérence Valorisation vs Immobilier
      if (valorisation?.valorisationRetenue && immobilier?.synthese) {
        const valoTotale = valorisation.valorisationRetenue.valorisation;
        const mursPrix = immobilier.synthese.murs_prix_estime || 0;

        if (mursPrix > 0) {
          // Vérifier que l'immobilier est pris en compte dans la valorisation
          const avoirImmobilierMentionne =
            valorisation.valorisationRetenue.justification?.toLowerCase().includes('murs') ||
            valorisation.valorisationRetenue.justification?.toLowerCase().includes('immobilier');

          if (!avoirImmobilierMentionne) {
            checks.push({
              check: 'Prise en compte immobilier',
              status: 'warning',
              details: `Des murs sont valorisés (${mursPrix}€) mais ne semblent pas mentionnés dans la valorisation totale`,
              sources: ['valorisation', 'immobilier']
            });
          } else {
            checks.push({
              check: 'Prise en compte immobilier',
              status: 'ok',
              details: 'L\'immobilier est bien pris en compte dans la valorisation globale',
              sources: ['valorisation', 'immobilier']
            });
          }
        }
      }

      // CHECK 6 : Cohérence santé financière vs valorisation
      if (comptable?.healthScore && valorisation?.valorisationRetenue) {
        const healthScore = comptable.healthScore.overall;
        const methodeRetenue = valorisation.valorisationRetenue.methode;

        // Si santé faible mais valorisation élevée = incohérence
        if (healthScore < 40 && methodeRetenue === 'ebe') {
          checks.push({
            check: 'Cohérence santé/valorisation',
            status: 'warning',
            details: `Score de santé faible (${healthScore}/100) mais valorisation par EBE retenue - vérifier la pertinence`,
            sources: ['comptable', 'valorisation']
          });
        } else if (healthScore >= 70 && methodeRetenue === 'patrimoniale') {
          checks.push({
            check: 'Cohérence santé/valorisation',
            status: 'warning',
            details: `Bonne santé financière (${healthScore}/100) mais valorisation patrimoniale retenue - vérifier la pertinence`,
            sources: ['comptable', 'valorisation']
          });
        } else {
          checks.push({
            check: 'Cohérence santé/valorisation',
            status: 'ok',
            details: `Méthode de valorisation cohérente avec la santé financière (${healthScore}/100)`,
            sources: ['comptable', 'valorisation']
          });
        }
      }

      // Calculer les statistiques
      const totalChecks = checks.length;
      const passedChecks = checks.filter(c => c.status === 'ok').length;
      const warningChecks = checks.filter(c => c.status === 'warning').length;
      const errorChecks = checks.filter(c => c.status === 'error').length;

      return {
        coherenceChecks: checks,
        totalChecks,
        passedChecks,
        warningChecks,
        errorChecks
      };

    } catch (error: any) {
      return {
        coherenceChecks: [],
        totalChecks: 0,
        passedChecks: 0,
        warningChecks: 0,
        errorChecks: 0,
        error: error.message || 'Cross validation failed'
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

/**
 * Extrait le CA d'une année depuis les documents
 */
function extractCAFromDocuments(documents: any[], year: number): number {
  const yearDocs = documents.filter(d => d.year === year);

  for (const doc of yearDocs) {
    if (!doc.extractedData?.tables) continue;

    for (const table of doc.extractedData.tables) {
      if (!table.rows) continue;

      for (const row of table.rows) {
        if (!row || row.length < 2) continue;

        const label = (row[0] || '').toLowerCase().trim();
        if (label.includes('chiffre') && label.includes('affaires')) {
          const value = parseFloat((row[1] || '0').replace(/\s/g, '').replace(',', '.')) || 0;
          if (value > 0) return value;
        }
      }
    }
  }

  return 0;
}

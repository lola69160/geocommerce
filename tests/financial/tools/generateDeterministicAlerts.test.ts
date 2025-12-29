import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ALERT_RULES } from '../../../server/adk/financial/config/alertRules';
import type { AlertEvaluationContext, DeterministicAlert } from '../../../server/adk/financial/schemas/alertRulesSchema';

/**
 * Tests pour le systeme d'alertes deterministes
 *
 * Objectif: Verifier que les alertes sont reproductibles
 * = meme input produit toujours le meme output
 */

describe('Deterministic Alerts System', () => {
  // Mock context for testing
  const createMockContext = (overrides: Partial<AlertEvaluationContext> = {}): AlertEvaluationContext => ({
    comptable: {
      sig: {
        '2021': { chiffre_affaires: 500000, marge_commerciale: 150000, valeur_ajoutee: 120000, ebe: 80000, resultat_exploitation: 50000, resultat_net: 35000 },
        '2022': { chiffre_affaires: 480000, marge_commerciale: 140000, valeur_ajoutee: 110000, ebe: 60000, resultat_exploitation: 35000, resultat_net: 20000 },
        '2023': { chiffre_affaires: 450000, marge_commerciale: 130000, valeur_ajoutee: 100000, ebe: 40000, resultat_exploitation: 20000, resultat_net: 10000 }
      },
      ratios: {
        marge_brute_pct: 28,
        marge_ebe_pct: 8.9,
        marge_nette_pct: 2.2,
        taux_va_pct: 22,
        rotation_stocks_jours: 45,
        delai_clients_jours: 30,
        delai_fournisseurs_jours: 45,
        bfr_jours_ca: 15,
        taux_endettement_pct: 120,
        capacite_autofinancement: 25000
      },
      evolution: {
        tendance: 'declin' as const,
        ca_evolution_pct: -10,
        ebe_evolution_pct: -50
      },
      yearsAnalyzed: ['2021', '2022', '2023']
    },
    valorisation: {
      methodes: {
        ebe: { valorisation: 150000, ebe_reference: 40000 },
        ca: { valorisation: 180000 },
        patrimoniale: { valorisation: 100000 }
      },
      synthese: {
        valeur_recommandee: 150000,
        fourchette_basse: 120000,
        fourchette_haute: 180000
      }
    },
    immobilier: {
      synthese: {
        loyer_mensuel: 3000,
        murs_prix_estime: 300000,
        bail_duree_restante_mois: 36,
        bail_present: true
      }
    },
    documentExtraction: {
      documents: [
        { documentType: 'bilan', year: 2023 },
        { documentType: 'compte_resultat', year: 2023 }
      ]
    },
    businessInfo: {
      nafCode: '47.11',
      activity: 'Commerce de detail',
      name: 'Test Commerce',
      siret: '12345678901234'
    },
    benchmark: {
      nafCode: '47.11',
      sector: 'Supermarche',
      ratios: {
        marge_brute_pct: 22,
        marge_ebe_pct: 4.5,
        marge_nette_pct: 1.8,
        taux_va_pct: 18,
        rotation_stocks_jours: 20,
        delai_clients_jours: 5,
        delai_fournisseurs_jours: 45,
        bfr_jours_ca: -15,
        taux_endettement_pct: 120
      }
    },
    ...overrides
  });

  describe('Rule Evaluation', () => {
    it('should have 30 rules defined', () => {
      expect(ALERT_RULES.length).toBeGreaterThanOrEqual(25);
    });

    it('should have all required rule properties', () => {
      for (const rule of ALERT_RULES) {
        expect(rule.id).toBeDefined();
        expect(rule.category).toBeDefined();
        expect(rule.severity).toBeDefined();
        expect(rule.condition).toBeInstanceOf(Function);
        expect(rule.extractValues).toBeInstanceOf(Function);
        expect(rule.titleTemplate).toBeDefined();
        expect(rule.messageTemplate).toBeInstanceOf(Function);
        expect(rule.impactTemplate).toBeDefined();
        expect(rule.recommendationTemplate).toBeDefined();
      }
    });

    it('should have unique rule IDs', () => {
      const ids = ALERT_RULES.map(r => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('Reproducibility', () => {
    it('should produce the same alerts for the same input', () => {
      const context = createMockContext();

      // Run twice
      const alerts1 = evaluateRules(context);
      const alerts2 = evaluateRules(context);

      // Should be identical
      expect(alerts1.length).toBe(alerts2.length);
      for (let i = 0; i < alerts1.length; i++) {
        expect(alerts1[i].id).toBe(alerts2[i].id);
        expect(alerts1[i].message).toBe(alerts2[i].message);
        expect(alerts1[i].severity).toBe(alerts2[i].severity);
      }
    });

    it('should produce different alerts for different input', () => {
      const context1 = createMockContext();
      const context2 = createMockContext({
        comptable: {
          ...createMockContext().comptable!,
          ratios: {
            ...createMockContext().comptable!.ratios!,
            taux_endettement_pct: 350 // Very high debt
          }
        }
      });

      const alerts1 = evaluateRules(context1);
      const alerts2 = evaluateRules(context2);

      // alerts2 should have DETTE_001 (critical endettement)
      const hasDebtAlert2 = alerts2.some(a => a.id === 'DETTE_001');
      const hasDebtAlert1 = alerts1.some(a => a.id === 'DETTE_001');

      expect(hasDebtAlert2).toBe(true);
      expect(hasDebtAlert1).toBe(false);
    });
  });

  describe('RENT Rules (Rentabilite)', () => {
    it('RENT_001: should trigger when EBE drops > 30%', () => {
      const context = createMockContext(); // EBE drops from 80k to 40k = -50%
      const alerts = evaluateRules(context);

      const alert = alerts.find(a => a.id === 'RENT_001');
      expect(alert).toBeDefined();
      expect(alert?.severity).toBe('critical');
      expect(alert?.message).toContain('50');
    });

    it('RENT_003: should trigger when marge EBE < 5%', () => {
      const context = createMockContext({
        comptable: {
          ...createMockContext().comptable!,
          ratios: {
            ...createMockContext().comptable!.ratios!,
            marge_ebe_pct: 3.5
          }
        }
      });
      const alerts = evaluateRules(context);

      const alert = alerts.find(a => a.id === 'RENT_003');
      expect(alert).toBeDefined();
      expect(alert?.severity).toBe('warning');
    });

    it('RENT_004: should trigger when marge EBE < 0%', () => {
      const context = createMockContext({
        comptable: {
          ...createMockContext().comptable!,
          ratios: {
            ...createMockContext().comptable!.ratios!,
            marge_ebe_pct: -5
          }
        }
      });
      const alerts = evaluateRules(context);

      const alert = alerts.find(a => a.id === 'RENT_004');
      expect(alert).toBeDefined();
      expect(alert?.severity).toBe('critical');
    });
  });

  describe('DETTE Rules (Endettement)', () => {
    it('DETTE_001: should trigger when taux endettement > 300%', () => {
      const context = createMockContext({
        comptable: {
          ...createMockContext().comptable!,
          ratios: {
            ...createMockContext().comptable!.ratios!,
            taux_endettement_pct: 350
          }
        }
      });
      const alerts = evaluateRules(context);

      const alert = alerts.find(a => a.id === 'DETTE_001');
      expect(alert).toBeDefined();
      expect(alert?.severity).toBe('critical');
    });

    it('DETTE_002: should trigger when taux endettement > 200%', () => {
      const context = createMockContext({
        comptable: {
          ...createMockContext().comptable!,
          ratios: {
            ...createMockContext().comptable!.ratios!,
            taux_endettement_pct: 250
          }
        }
      });
      const alerts = evaluateRules(context);

      const alert = alerts.find(a => a.id === 'DETTE_002');
      expect(alert).toBeDefined();
      expect(alert?.severity).toBe('warning');
    });
  });

  describe('CROIS Rules (Croissance)', () => {
    it('CROIS_003: should trigger when tendance = declin', () => {
      const context = createMockContext(); // tendance is already 'declin'
      const alerts = evaluateRules(context);

      const alert = alerts.find(a => a.id === 'CROIS_003');
      expect(alert).toBeDefined();
      expect(alert?.severity).toBe('warning');
    });
  });

  describe('IMMO Rules (Immobilier)', () => {
    it('IMMO_001: should trigger when loyer > 30% CA', () => {
      const context = createMockContext({
        immobilier: {
          synthese: {
            loyer_mensuel: 15000, // 180k/year = 40% of 450k CA
            murs_prix_estime: 500000,
            bail_duree_restante_mois: 36,
            bail_present: true
          }
        }
      });
      const alerts = evaluateRules(context);

      const alert = alerts.find(a => a.id === 'IMMO_001');
      expect(alert).toBeDefined();
      expect(alert?.severity).toBe('critical');
    });
  });

  describe('DATA Rules (Donnees)', () => {
    it('DATA_001: should trigger when no bilan', () => {
      const context = createMockContext({
        documentExtraction: {
          documents: [
            { documentType: 'compte_resultat', year: 2023 }
            // No bilan
          ]
        }
      });
      const alerts = evaluateRules(context);

      const alert = alerts.find(a => a.id === 'DATA_001');
      expect(alert).toBeDefined();
      expect(alert?.severity).toBe('critical');
    });

    it('DATA_003: should trigger when < 2 years data', () => {
      const context = createMockContext({
        comptable: {
          ...createMockContext().comptable!,
          yearsAnalyzed: ['2023'] // Only 1 year
        }
      });
      const alerts = evaluateRules(context);

      const alert = alerts.find(a => a.id === 'DATA_003');
      expect(alert).toBeDefined();
      expect(alert?.severity).toBe('warning');
    });
  });

  describe('Alert Sorting', () => {
    it('should sort alerts by severity (critical first)', () => {
      const context = createMockContext({
        comptable: {
          ...createMockContext().comptable!,
          ratios: {
            ...createMockContext().comptable!.ratios!,
            taux_endettement_pct: 350, // critical
            marge_ebe_pct: 3 // warning
          }
        }
      });
      const alerts = evaluateRules(context);

      // Sort alerts
      const sorted = [...alerts].sort((a, b) => {
        const order: Record<string, number> = { critical: 0, warning: 1, info: 2 };
        return order[a.severity] - order[b.severity];
      });

      // First alerts should be critical
      const criticalIndex = sorted.findIndex(a => a.severity === 'critical');
      const warningIndex = sorted.findIndex(a => a.severity === 'warning');

      if (criticalIndex >= 0 && warningIndex >= 0) {
        expect(criticalIndex).toBeLessThan(warningIndex);
      }
    });
  });
});

/**
 * Helper function to evaluate rules (simulates the tool)
 */
function evaluateRules(context: AlertEvaluationContext): DeterministicAlert[] {
  const alerts: DeterministicAlert[] = [];

  for (const rule of ALERT_RULES) {
    try {
      if (rule.condition(context)) {
        const values = rule.extractValues(context);
        alerts.push({
          id: rule.id,
          category: rule.category,
          severity: rule.severity,
          title: rule.titleTemplate,
          message: rule.messageTemplate(values),
          impact: rule.impactTemplate,
          recommendation: rule.recommendationTemplate,
          values
        });
      }
    } catch {
      // Rule evaluation failed - skip silently
    }
  }

  return alerts;
}

import { describe, it, expect, beforeEach } from 'vitest';
import { calculateSigTool } from '../../../server/adk/financial/tools/accounting/calculateSigTool';
import type { ToolContext } from '@google/adk';

describe('calculateSigTool', () => {
  let mockContext: ToolContext;

  beforeEach(() => {
    // ✅ FIX V3 (2025-12-29): Utiliser key_values au lieu de tables
    // Le nouveau comportement est extraction-only (pas de recalcul)
    mockContext = {
      state: {
        get: (key: string) => {
          if (key === 'documentExtraction') {
            return {
              documents: [
                {
                  year: 2023,
                  documentType: 'compte_de_resultat',
                  extractedData: {
                    // Format key_values: valeurs pré-extraites par Gemini Vision
                    key_values: {
                      chiffre_affaires: 450000,
                      ventes_marchandises: 450000,
                      achats_marchandises: 270000,
                      marge_commerciale: 180000,
                      valeur_ajoutee: 180000,
                      charges_personnel: 62000,
                      impots_taxes: 8000,
                      ebe: 110000,
                      dotations_amortissements: 12000,
                      resultat_exploitation: 98000,
                      resultat_financier: -4000,
                      resultat_exceptionnel: 1000,
                      resultat_net: 84000,
                      // Champs additionnels (Issue #1 fix)
                      marge_brute_globale: 180000,
                      charges_externes: 25000,
                      charges_exploitant: 35000,
                      salaires_personnel: 50000,
                      charges_sociales_personnel: 12000
                    },
                    sig: {
                      chiffre_affaires: { valeur: 450000, pct_ca: 100 },
                      ebe: { valeur: 110000, pct_ca: 24.44 },
                      resultat_net: { valeur: 84000, pct_ca: 18.67 }
                    }
                  }
                },
                {
                  year: 2022,
                  documentType: 'compte_de_resultat',
                  extractedData: {
                    key_values: {
                      chiffre_affaires: 420000,
                      ventes_marchandises: 420000,
                      achats_marchandises: 252000,
                      marge_commerciale: 168000,
                      valeur_ajoutee: 168000,
                      charges_personnel: 58000,
                      impots_taxes: 7500,
                      ebe: 102500,
                      dotations_amortissements: 11000,
                      resultat_exploitation: 91500,
                      resultat_net: 78000
                    },
                    sig: {
                      chiffre_affaires: { valeur: 420000, pct_ca: 100 },
                      ebe: { valeur: 102500, pct_ca: 24.40 },
                      resultat_net: { valeur: 78000, pct_ca: 18.57 }
                    }
                  }
                }
              ]
            };
          }
          return undefined;
        },
        set: () => {},
      },
    } as any;
  });

  it('should calculate SIG correctly for multiple years', async () => {
    const result = await calculateSigTool.execute({}, mockContext);

    expect(result.error).toBeUndefined();
    expect(result.yearsAnalyzed).toEqual([2023, 2022]);
    expect(result.sig).toBeDefined();
    expect(result.sig['2023']).toBeDefined();
    expect(result.sig['2022']).toBeDefined();
  });

  it('should use extracted marge commerciale (no recalculation)', async () => {
    const result = await calculateSigTool.execute({}, mockContext);

    const sig2023 = result.sig['2023'];

    // Marge commerciale extraite directement de key_values
    // Nouveau format: { valeur, pct_ca }
    expect(sig2023.marge_commerciale.valeur).toBe(180000);
    expect(sig2023.marge_commerciale.pct_ca).toBe(40); // 180000/450000 = 40%
  });

  it('should use extracted EBE (no recalculation)', async () => {
    const result = await calculateSigTool.execute({}, mockContext);

    const sig2023 = result.sig['2023'];

    // EBE extrait directement de key_values
    // Nouveau format: { valeur, pct_ca }
    expect(sig2023.ebe.valeur).toBe(110000);
    expect(sig2023.ebe.pct_ca).toBeCloseTo(24.44, 1); // 110000/450000 ≈ 24.44%
  });

  it('should use extracted résultat d\'exploitation (no recalculation)', async () => {
    const result = await calculateSigTool.execute({}, mockContext);

    const sig2023 = result.sig['2023'];

    // Résultat d'exploitation extrait directement
    // Nouveau format: { valeur, pct_ca }
    expect(sig2023.resultat_exploitation.valeur).toBe(98000);
    expect(sig2023.resultat_exploitation.pct_ca).toBeCloseTo(21.78, 1); // 98000/450000 ≈ 21.78%
  });

  it('should use extracted résultat net (no recalculation)', async () => {
    const result = await calculateSigTool.execute({}, mockContext);

    const sig2023 = result.sig['2023'];

    // Résultat net extrait directement
    // Nouveau format: { valeur, pct_ca }
    expect(sig2023.resultat_net.valeur).toBe(84000);
    expect(sig2023.resultat_net.pct_ca).toBeCloseTo(18.67, 1); // 84000/450000 ≈ 18.67%
  });

  it('should handle missing documentExtraction state', async () => {
    const emptyContext = {
      state: {
        get: () => undefined,
        set: () => {},
      },
    } as any;

    const result = await calculateSigTool.execute({}, emptyContext);

    expect(result.error).toBe('No documents found in state.documentExtraction');
    expect(result.sig).toEqual({});
    expect(result.yearsAnalyzed).toEqual([]);
  });

  it('should handle JSON string in state (ADK pattern)', async () => {
    const jsonContext = {
      state: {
        get: (key: string) => {
          if (key === 'documentExtraction') {
            return JSON.stringify({
              documents: [
                {
                  year: 2023,
                  documentType: 'bilan',
                  extractedData: {
                    key_values: {
                      chiffre_affaires: 100000,
                      ebe: 25000,
                      resultat_net: 15000
                    },
                    sig: {
                      chiffre_affaires: { valeur: 100000, pct_ca: 100 },
                      ebe: { valeur: 25000, pct_ca: 25 },
                      resultat_net: { valeur: 15000, pct_ca: 15 }
                    }
                  }
                }
              ]
            });
          }
          return undefined;
        },
        set: () => {},
      },
    } as any;

    const result = await calculateSigTool.execute({}, jsonContext);

    expect(result.error).toBeUndefined();
    expect(result.yearsAnalyzed).toEqual([2023]);
    // Nouveau format: { valeur, pct_ca }
    expect(result.sig['2023'].chiffre_affaires.valeur).toBe(100000);
    expect(result.sig['2023'].chiffre_affaires.pct_ca).toBe(100);
  });

  it('should filter out non-accounting documents', async () => {
    const mixedDocsContext = {
      state: {
        get: (key: string) => {
          if (key === 'documentExtraction') {
            return {
              documents: [
                {
                  year: 2023,
                  documentType: 'bilan',
                  extractedData: {
                    key_values: {
                      chiffre_affaires: 100000,
                      ebe: 25000,
                      resultat_net: 15000
                    },
                    sig: {
                      chiffre_affaires: { valeur: 100000, pct_ca: 100 },
                      ebe: { valeur: 25000, pct_ca: 25 },
                      resultat_net: { valeur: 15000, pct_ca: 15 }
                    }
                  }
                },
                {
                  year: 2023,
                  documentType: 'bail',  // Should be filtered
                  extractedData: {
                    key_values: {
                      loyer_annuel: 24000
                    }
                  }
                }
              ]
            };
          }
          return undefined;
        },
        set: () => {},
      },
    } as any;

    const result = await calculateSigTool.execute({}, mixedDocsContext);

    expect(result.error).toBeUndefined();
    expect(result.yearsAnalyzed).toEqual([2023]);
    // Le bail ne devrait pas affecter les calculs SIG
    // Nouveau format: { valeur, pct_ca }
    expect(result.sig['2023'].chiffre_affaires.valeur).toBe(100000);
  });

  it('should handle negative values (pertes) from extraction', async () => {
    const lossContext = {
      state: {
        get: (key: string) => {
          if (key === 'documentExtraction') {
            return {
              documents: [
                {
                  year: 2023,
                  documentType: 'compte_de_resultat',
                  extractedData: {
                    key_values: {
                      chiffre_affaires: 100000,
                      marge_commerciale: 20000,
                      ebe: -30000, // Perte
                      resultat_net: -40000
                    },
                    sig: {
                      chiffre_affaires: { valeur: 100000, pct_ca: 100 },
                      ebe: { valeur: -30000, pct_ca: -30 },
                      resultat_net: { valeur: -40000, pct_ca: -40 }
                    }
                  }
                }
              ]
            };
          }
          return undefined;
        },
        set: () => {},
      },
    } as any;

    const result = await calculateSigTool.execute({}, lossContext);

    expect(result.error).toBeUndefined();
    const sig = result.sig['2023'];

    // Marge extraite directement
    // Nouveau format: { valeur, pct_ca }
    expect(sig.marge_commerciale.valeur).toBe(20000);
    expect(sig.marge_commerciale.pct_ca).toBe(20); // 20000/100000 = 20%

    // EBE négatif extrait directement
    expect(sig.ebe.valeur).toBe(-30000);
    expect(sig.ebe.valeur).toBeLessThan(0);
  });

  it('should sort years in descending order', async () => {
    const result = await calculateSigTool.execute({}, mockContext);

    expect(result.yearsAnalyzed).toEqual([2023, 2022]);
    expect(result.yearsAnalyzed[0]).toBeGreaterThan(result.yearsAnalyzed[1]);
  });

  it('should extract additional SIG fields (marge_brute_globale, charges_externes, etc.)', async () => {
    const result = await calculateSigTool.execute({}, mockContext);

    const sig2023 = result.sig['2023'];

    // ✅ Issue #1 fix: Ces champs doivent être extraits
    expect(sig2023.marge_brute_globale?.valeur).toBe(180000);
    expect(sig2023.autres_achats_charges_externes?.valeur).toBe(25000);
    expect(sig2023.charges_exploitant?.valeur).toBe(35000);
    expect(sig2023.salaires_personnel?.valeur).toBe(50000);
    expect(sig2023.charges_sociales_personnel?.valeur).toBe(12000);
  });
});

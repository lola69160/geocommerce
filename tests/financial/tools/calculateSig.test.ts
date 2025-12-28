import { describe, it, expect, beforeEach } from 'vitest';
import { calculateSigTool } from '../../../server/adk/financial/tools/accounting/calculateSigTool';
import type { ToolContext } from '@google/adk';

describe('calculateSigTool', () => {
  let mockContext: ToolContext;

  beforeEach(() => {
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
                    tables: [
                      {
                        name: 'compte_resultat',
                        rows: [
                          ['Chiffre d\'affaires', '450000'],
                          ['Achats de marchandises', '270000'],
                          ['Charges de personnel', '62000'],
                          ['Impôts et taxes', '8000'],
                          ['Dotations aux amortissements', '12000'],
                          ['Résultat financier', '-4000'],
                          ['Résultat exceptionnel', '1000'],
                          ['Impôts sur les sociétés', '11000'],
                        ]
                      }
                    ]
                  }
                },
                {
                  year: 2022,
                  documentType: 'compte_de_resultat',
                  extractedData: {
                    tables: [
                      {
                        name: 'compte_resultat',
                        rows: [
                          ['Chiffre d\'affaires', '420000'],
                          ['Achats de marchandises', '252000'],
                          ['Charges de personnel', '58000'],
                          ['Impôts et taxes', '7500'],
                          ['Dotations aux amortissements', '11000'],
                        ]
                      }
                    ]
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

  it('should calculate correct marge commerciale', async () => {
    const result = await calculateSigTool.execute({}, mockContext);

    const sig2023 = result.sig['2023'];

    // Marge commerciale = Ventes marchandises - Achats marchandises
    // = 450000 - 270000 = 180000
    // Nouveau format: { valeur, pct_ca }
    expect(sig2023.marge_commerciale.valeur).toBe(180000);
    expect(sig2023.marge_commerciale.pct_ca).toBe(40); // 180000/450000 = 40%
  });

  it('should calculate correct EBE', async () => {
    const result = await calculateSigTool.execute({}, mockContext);

    const sig2023 = result.sig['2023'];

    // Pour un commerce (pas de production)
    // Valeur ajoutée = Marge commerciale (180000)
    // EBE = Valeur ajoutée - Impôts & taxes (8000) - Charges personnel (62000)
    // = 180000 - 8000 - 62000 = 110000
    // Nouveau format: { valeur, pct_ca }
    expect(sig2023.ebe.valeur).toBe(110000);
    expect(sig2023.ebe.pct_ca).toBeCloseTo(24.44, 1); // 110000/450000 ≈ 24.44%
  });

  it('should calculate correct résultat d\'exploitation', async () => {
    const result = await calculateSigTool.execute({}, mockContext);

    const sig2023 = result.sig['2023'];

    // Résultat d'exploitation = EBE - Dotations amortissements
    // = 110000 - 12000 = 98000
    // Nouveau format: { valeur, pct_ca }
    expect(sig2023.resultat_exploitation.valeur).toBe(98000);
    expect(sig2023.resultat_exploitation.pct_ca).toBeCloseTo(21.78, 1); // 98000/450000 ≈ 21.78%
  });

  it('should calculate correct résultat net', async () => {
    const result = await calculateSigTool.execute({}, mockContext);

    const sig2023 = result.sig['2023'];

    // Résultat courant = Résultat exploitation + Résultat financier
    // = 98000 + (-4000) = 94000
    // Résultat net = Résultat courant + Résultat exceptionnel - Impôts
    // = 94000 + 1000 - 11000 = 84000
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
                    tables: [
                      {
                        rows: [['Chiffre d\'affaires', '100000']]
                      }
                    ]
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
                    tables: [
                      { rows: [['Chiffre d\'affaires', '100000']] }
                    ]
                  }
                },
                {
                  year: 2023,
                  documentType: 'bail',  // Should be filtered
                  extractedData: {
                    tables: [
                      { rows: [['Loyer annuel', '24000']] }
                    ]
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

  it('should handle negative values (pertes)', async () => {
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
                    tables: [
                      {
                        rows: [
                          ['Chiffre d\'affaires', '100000'],
                          ['Achats de marchandises', '80000'],
                          ['Charges de personnel', '50000'],  // Plus élevé que marge
                          ['Résultat financier', '-5000'],
                          ['Résultat exceptionnel', '-2000'],
                        ]
                      }
                    ]
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

    // Marge = 100000 - 80000 = 20000
    // Nouveau format: { valeur, pct_ca }
    expect(sig.marge_commerciale.valeur).toBe(20000);
    expect(sig.marge_commerciale.pct_ca).toBe(20); // 20000/100000 = 20%

    // EBE = 20000 - 50000 = -30000 (négatif)
    expect(sig.ebe.valeur).toBeLessThan(0);
  });

  it('should sort years in descending order', async () => {
    const result = await calculateSigTool.execute({}, mockContext);

    expect(result.yearsAnalyzed).toEqual([2023, 2022]);
    expect(result.yearsAnalyzed[0]).toBeGreaterThan(result.yearsAnalyzed[1]);
  });
});

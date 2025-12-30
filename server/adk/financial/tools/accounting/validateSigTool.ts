import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../../utils/schemaHelper';

/**
 * validateSigTool - Validation des SIG injectés par geminiVisionExtractTool
 *
 * IMPORTANT : Ce tool NE CALCULE PAS les SIG - il VALIDE seulement que l'injection
 * directe effectuée par geminiVisionExtractTool est complète et cohérente.
 *
 * Contexte :
 * - Les SIG sont injectés directement dans state.comptable.sig[year] par geminiVisionExtractTool
 * - Ce tool vérifie que tous les champs requis sont présents
 * - Identifie les années incomplètes ou les incohérences
 *
 * Remplace : calculateSigTool (supprimé - ne recalcule plus les SIG)
 */

const ValidateSigInputSchema = z.object({
  strictMode: z.boolean().optional().describe('Si true, retourne isValid=false dès qu\'un champ manque. Sinon, génère seulement des warnings.')
});

const ValidateSigOutputSchema = z.object({
  isValid: z.boolean().describe('True si tous les SIG sont complets et cohérents'),
  yearsAnalyzed: z.array(z.number()).describe('Liste des années pour lesquelles des SIG existent'),
  missingYears: z.array(z.number()).optional().describe('Années présentes dans documents mais sans SIG injecté'),
  incompleteYears: z.array(z.object({
    year: z.number(),
    missingFields: z.array(z.string())
  })).optional().describe('Années avec SIG incomplets (champs manquants)'),
  warnings: z.array(z.string()).optional().describe('Warnings sur incohérences détectées'),
  summary: z.string().describe('Résumé de la validation en français')
});

export const validateSigTool = new FunctionTool({
  name: 'validateSig',
  description: 'Valide que les SIG injectés par geminiVisionExtractTool sont complets et cohérents. NE CALCULE PAS les SIG - ils sont déjà injectés directement par DocumentExtractionAgent.',
  parameters: zToGen(ValidateSigInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    const comptable = toolContext?.state.get('comptable') as any;
    const documentExtraction = toolContext?.state.get('documentExtraction') as any;

    // Validation : state.comptable.sig existe
    if (!comptable?.sig || Object.keys(comptable.sig).length === 0) {
      return {
        isValid: false,
        yearsAnalyzed: [],
        warnings: ['❌ state.comptable.sig est vide - aucun SIG injecté par geminiVisionExtractTool'],
        summary: 'Aucun SIG trouvé. Vérifier que DocumentExtractionAgent a bien été exécuté avant ComptableAgent.'
      };
    }

    // Champs SIG requis pour validation
    const requiredFields = [
      'chiffre_affaires',
      'marge_commerciale',
      'marge_brute_globale',
      'valeur_ajoutee',
      'ebe',
      'resultat_exploitation',
      'resultat_net'
    ];

    const yearsAnalyzed = Object.keys(comptable.sig)
      .map(Number)
      .sort((a, b) => b - a); // Tri décroissant (N, N-1, N-2)

    const incompleteYears: Array<{ year: number; missingFields: string[] }> = [];
    const warnings: string[] = [];

    // Validation par année
    for (const year of yearsAnalyzed) {
      const sigData = comptable.sig[year.toString()];

      // Vérifier la source (doit être 'gemini_vision_direct')
      if (sigData.source !== 'gemini_vision_direct') {
        warnings.push(`⚠️ Année ${year}: source='${sigData.source}' (attendu: 'gemini_vision_direct')`);
      }

      // Vérifier la confidence
      if (sigData.confidence && sigData.confidence < 0.7) {
        warnings.push(`⚠️ Année ${year}: confidence faible (${(sigData.confidence * 100).toFixed(0)}%)`);
      }

      // Vérifier les champs requis
      const missingFields = requiredFields.filter(field => {
        const fieldData = sigData[field];
        // Champ manquant si undefined, ou si valeur est undefined
        return !fieldData || fieldData.valeur === undefined || fieldData.valeur === null;
      });

      if (missingFields.length > 0) {
        incompleteYears.push({ year, missingFields });
      }

      // Vérifier la cohérence des valeurs
      const ca = sigData.chiffre_affaires?.valeur || 0;
      const ebe = sigData.ebe?.valeur || 0;
      const rn = sigData.resultat_net?.valeur || 0;
      const va = sigData.valeur_ajoutee?.valeur || 0;

      // Incohérence 1: EBE > CA
      if (ca > 0 && Math.abs(ebe) > ca) {
        warnings.push(`⚠️ Année ${year}: EBE (${ebe.toLocaleString('fr-FR')} €) > CA (${ca.toLocaleString('fr-FR')} €)`);
      }

      // Incohérence 2: VA > CA
      if (ca > 0 && Math.abs(va) > ca) {
        warnings.push(`⚠️ Année ${year}: Valeur Ajoutée (${va.toLocaleString('fr-FR')} €) > CA (${ca.toLocaleString('fr-FR')} €)`);
      }

      // Incohérence 3: CA à 0 mais autres indicateurs présents
      if (ca === 0 && (ebe !== 0 || rn !== 0)) {
        warnings.push(`⚠️ Année ${year}: CA=0 mais EBE=${ebe} et RN=${rn} (incohérent)`);
      }
    }

    // Vérifier si des années de documents sont manquantes
    const documentYears = documentExtraction?.summary?.yearsAvailable || [];
    const missingYears = documentYears.filter((year: number) => !yearsAnalyzed.includes(year));

    if (missingYears.length > 0) {
      warnings.push(`⚠️ Documents présents pour ${missingYears.join(', ')} mais SIG non injectés`);
    }

    // Déterminer si validation OK
    const strictMode = params.strictMode || false;
    const hasIncompleteYears = incompleteYears.length > 0;
    const hasCriticalWarnings = warnings.some(w => w.includes('❌'));

    const isValid = strictMode
      ? !hasIncompleteYears && !hasCriticalWarnings
      : !hasCriticalWarnings; // En mode non-strict, accepter champs manquants avec warnings

    // Générer résumé
    let summary = '';
    if (isValid) {
      summary = `✅ Validation OK : ${yearsAnalyzed.length} année(s) avec SIG complets [${yearsAnalyzed.join(', ')}]`;
    } else {
      const issues: string[] = [];
      if (hasIncompleteYears) {
        issues.push(`${incompleteYears.length} année(s) incomplète(s)`);
      }
      if (warnings.length > 0) {
        issues.push(`${warnings.length} warning(s)`);
      }
      summary = `⚠️ Validation partielle : ${issues.join(', ')}`;
    }

    // Logging console
    console.log(`\n[validateSig] ${isValid ? '✅' : '⚠️'} Résultat de validation:`);
    console.log(`   Années analysées: ${yearsAnalyzed.join(', ')}`);

    if (incompleteYears.length > 0) {
      console.log(`   ⚠️ Années incomplètes:`);
      incompleteYears.forEach(({ year, missingFields }) => {
        console.log(`      - ${year}: champs manquants [${missingFields.join(', ')}]`);
      });
    }

    if (warnings.length > 0) {
      console.log(`   Warnings:`);
      warnings.forEach(w => console.log(`      ${w}`));
    }

    if (isValid) {
      console.log(`   ✅ ${summary}\n`);
    } else {
      console.log(`   ⚠️ ${summary}\n`);
    }

    // ✅ AJOUT CRITIQUE: Retourner l'objet SIG complet pour que le LLM puisse le copier
    // Le LLM DOIT inclure cet objet sig dans son JSON de sortie pour préserver les données

    console.log(`\n⚠️⚠️⚠️ INSTRUCTION POUR LE LLM ⚠️⚠️⚠️`);
    console.log(`TU DOIS COPIER CET OBJET SIG EXACTEMENT DANS TON JSON DE SORTIE :`);
    console.log(`Années: ${yearsAnalyzed.join(', ')}`);
    console.log(`Champs par année: ${Object.keys(comptable.sig[yearsAnalyzed[0].toString()] || {}).length} champs`);
    console.log(`⚠️ NE FILTRE AUCUN CHAMP - COPIE TOUT TEL QUEL !`);

    return {
      isValid,
      yearsAnalyzed,
      sig: comptable.sig, // ✅ IMPORTANT: Objet SIG complet à copier dans le JSON de sortie !
      INSTRUCTION_CRITIQUE: "⚠️ COPIE l'objet 'sig' ci-dessus INTÉGRALEMENT dans ton JSON de sortie sous la clé 'sig'. NE MODIFIE RIEN, NE FILTRE RIEN. Copie-colle TOUS les champs de TOUTES les années (2021, 2022, 2023) EXACTEMENT comme ils sont.",
      ...(missingYears.length > 0 && { missingYears }),
      ...(incompleteYears.length > 0 && { incompleteYears }),
      ...(warnings.length > 0 && { warnings }),
      summary
    };
  }
});

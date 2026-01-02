/**
 * Opportunity Section Generator
 *
 * Generates the "Opportunite de Reprise & Restructuration" section
 * with Gemini-generated strategic text and transaction costs table.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Call Gemini to generate strategic text
 * Note: GoogleGenerativeAI is instantiated inside the function to ensure
 * the API key is loaded at runtime (not at module load time)
 */
async function generateStrategicText(prompt: string): Promise<string> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('[opportunitySection] GEMINI_API_KEY not set');
      return '';
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
      },
    });

    const response = result.response;
    const text = response.text();
    return text.trim();
  } catch (error) {
    console.error('[opportunitySection] Gemini call failed:', error);
    return '';
  }
}

/**
 * Generate "La Cible" text based on comptable data
 */
async function generateLaCibleText(comptable: any, userComments: any): Promise<string> {
  // Extract key data
  const years = comptable?.sig ? Object.keys(comptable.sig).sort().reverse() : [];
  const lastYear = years[0] || '2023';

  const extractValue = (val: any) => typeof val === 'object' && val !== null ? val.valeur : (val || 0);
  const sigLastYear = comptable?.sig?.[lastYear] || {};

  const ebeComptable = comptable?.ebeRetraitement?.ebe_comptable || extractValue(sigLastYear?.ebe) || 0;
  const ebeNormatif = comptable?.ebeRetraitement?.ebe_normatif || 0;
  const caActuel = extractValue(sigLastYear?.chiffre_affaires) || 0;
  const margeEbe = comptable?.ratios?.marge_ebe_pct || (caActuel > 0 ? (ebeComptable / caActuel * 100) : 0);
  const tendance = comptable?.evolution?.tendance || 'stable';
  const caEvolution = comptable?.evolution?.ca_evolution_pct || 0;

  // Loyer data
  const loyerActuel = userComments?.loyer?.loyer_actuel || 0;
  const loyerNegocie = userComments?.loyer?.futur_loyer_commercial || 0;

  // Masse salariale (from SIG)
  const chargesPersonnel = extractValue(sigLastYear?.charges_personnel) || 0;

  const prompt = `Tu es un analyste financier expert en transmission d'entreprises. Genere un paragraphe de 2-3 phrases analysant cette cible d'acquisition.

DONNEES COMPTABLES:
- Chiffre d'affaires: ${caActuel.toLocaleString('fr-FR')} EUR
- Tendance CA: ${tendance} (${caEvolution > 0 ? '+' : ''}${caEvolution.toFixed(1)}%)
- EBE Comptable: ${ebeComptable.toLocaleString('fr-FR')} EUR (marge: ${margeEbe.toFixed(1)}%)
- EBE Normatif (apres retraitement): ${ebeNormatif.toLocaleString('fr-FR')} EUR
${loyerActuel > 0 ? `- Loyer actuel: ${loyerActuel.toLocaleString('fr-FR')} EUR/mois` : ''}
${loyerNegocie > 0 ? `- Loyer negocie: ${loyerNegocie.toLocaleString('fr-FR')} EUR/mois` : ''}
${chargesPersonnel > 0 ? `- Masse salariale: ${chargesPersonnel.toLocaleString('fr-FR')} EUR/an` : ''}

TON: Professionnel, factuel, oriente opportunite de restructuration.
FORMAT: Commence par "Activite [adjectif] (CA [tendance]), [suite de l'analyse]..."
LONGUEUR: 2-3 phrases maximum.
IMPORTANT: Mets en evidence les points a restructurer (loyer, masse salariale, charges) qui expliquent l'ecart entre EBE comptable et normatif.`;

  const text = await generateStrategicText(prompt);

  // Fallback if Gemini fails
  if (!text) {
    const tendanceLabel = tendance === 'croissance' ? 'en croissance' : tendance === 'baisse' ? 'en baisse' : 'stable';
    const problemPoints: string[] = [];

    if (loyerActuel > 0 && loyerNegocie > 0 && loyerNegocie < loyerActuel) {
      problemPoints.push(`loyer hors marche (${loyerActuel.toLocaleString('fr-FR')} EUR vs ${loyerNegocie.toLocaleString('fr-FR')} EUR negocie)`);
    }
    if (ebeNormatif > ebeComptable * 1.3) {
      problemPoints.push('charges de structure optimisables');
    }

    const problems = problemPoints.length > 0
      ? `, mais rentabilite degradee par ${problemPoints.join(' et ')}`
      : '';

    return `Activite ${tendanceLabel} (CA ${caEvolution > 0 ? '+' : ''}${caEvolution.toFixed(0)}%)${problems}. L'EBE normatif de ${ebeNormatif.toLocaleString('fr-FR')} EUR (vs ${ebeComptable.toLocaleString('fr-FR')} EUR comptable) revele un potentiel de restructuration significatif.`;
  }

  return text;
}

/**
 * Generate "Le Projet" text based on ALL userComments fields
 * Comprehensive synthesis including strategic vision, rent, personnel, investments, financing
 */
async function generateLeProjetText(
  userComments: any,
  comptable?: any,
  immobilier?: any
): Promise<string> {
  // Collect ALL project elements
  const projectElements: string[] = [];

  // 1. Free text from user (priority)
  if (userComments?.autres && userComments.autres.length >= 10) {
    projectElements.push(`**Vision stratégique** : ${userComments.autres}`);
  }

  // 2. Rent and real estate
  if (userComments?.loyer?.futur_loyer_commercial && userComments?.loyer?.loyer_actuel) {
    const actuel = userComments.loyer.loyer_actuel;
    const negocie = userComments.loyer.futur_loyer_commercial;
    const economie = actuel - negocie;
    const pct = ((economie / actuel) * 100).toFixed(0);
    projectElements.push(`**Loyer commercial** : Renégociation réussie de ${actuel}€ à ${negocie}€/mois (économie annuelle de ${economie * 12}€, soit -${pct}%)`);

    if (userComments.loyer.commentaire) {
      projectElements.push(`  ↳ ${userComments.loyer.commentaire}`);
    }
  }

  // 3. Personnel takeover
  if (userComments?.reprise_salaries === false) {
    projectElements.push(`**Personnel** : Aucune reprise du personnel actuel`);
    if (userComments?.salaries_non_repris?.motif) {
      projectElements.push(`  ↳ Motif : ${userComments.salaries_non_repris.motif}`);
    }
  } else if (userComments?.reprise_salaries === true) {
    projectElements.push(`**Personnel** : Reprise de l'équipe en place`);
  }

  // 4. Manager compensation
  if (userComments?.salaire_dirigeant && userComments.salaire_dirigeant > 0) {
    const mensuel = (userComments.salaire_dirigeant / 12).toFixed(0);
    projectElements.push(`**Rémunération gérant** : ${userComments.salaire_dirigeant}€/an (${mensuel}€/mois net TNS)`);
  }

  // 5. Renovation budget
  if (userComments?.budget_travaux && userComments.budget_travaux > 0) {
    projectElements.push(`**Investissement travaux** : ${userComments.budget_travaux}€ pour modernisation/mise aux normes`);
  }

  // 6. Financing (if provided)
  if (userComments?.transactionFinancing?.negocie) {
    const fin = userComments.transactionFinancing.negocie;
    if (fin.apport_personnel > 0) {
      const pctApport = fin.total_investissement > 0
        ? ((fin.apport_personnel / fin.total_investissement) * 100).toFixed(0)
        : 0;
      projectElements.push(`**Apport personnel** : ${fin.apport_personnel}€ (${pctApport}% de l'investissement total)`);
    }
    if (fin.pret_principal > 0 && fin.duree_annees > 0) {
      projectElements.push(`**Financement bancaire** : ${fin.pret_principal}€ sur ${fin.duree_annees} ans à ${fin.taux_interet}%`);
    }
  }

  // If no project data at all, return empty
  if (projectElements.length === 0) {
    return '';
  }

  // 7. Generate final text with Gemini (structured synthesis)
  const prompt = `Tu es un analyste financier rédigeant la section "LE PROJET" d'un rapport d'acquisition de fonds de commerce.

Éléments du projet fournis par l'acquéreur :
${projectElements.map((e, i) => `${i + 1}. ${e}`).join('\n')}

CONSIGNES STRICTES :
1. Rédige une synthèse structurée en 4-6 paragraphes clairs
2. INCLUS TOUS les détails fournis (chiffres exacts, horaires, équipe, etc.)
3. Structure : Introduction → Immobilier/Loyer → Équipe → Investissements → Financement → Conclusion
4. Ton professionnel, factuel, sans exagération
5. NE PAS inventer de détails non fournis
6. Si un élément manque, ne pas le mentionner (ne pas dire "non renseigné")

Génère UNIQUEMENT le texte de la section "LE PROJET", sans titre.`;

  try {
    const text = await generateStrategicText(prompt);

    if (text && text.length > 50) {
      return text;
    }
  } catch (error) {
    console.error('[generateLeProjetText] Gemini error:', error);
  }

  // Fallback: bullet list if Gemini fails
  if (projectElements.length > 0) {
    let fallbackHtml = '<ul>';
    projectElements.forEach(el => {
      fallbackHtml += `<li>${el}</li>`;
    });
    fallbackHtml += '</ul>';
    return fallbackHtml;
  }

  return '';
}

/**
 * Generate the Projet Vendeur table HTML
 */
function generateProjetVendeurTable(transactionFinancing: any): string {
  // Utiliser le scénario négocié si disponible, sinon initial
  const scenario = transactionFinancing?.negocie?.total_investissement > 0
    ? transactionFinancing.negocie
    : transactionFinancing?.initial;

  if (!scenario || !scenario.prix_fonds) {
    return `
      <div class="opportunity-missing">
        Formulaire de financement non renseigne. Les details du projet vendeur ne peuvent pas etre affiches.
      </div>
    `;
  }

  const prixFonds = scenario.prix_fonds || 0;
  const honorairesHT = scenario.honoraires_ht || 0;
  const fraisActeHT = scenario.frais_acte_ht || 0;
  const tva = scenario.tva_sur_honoraires || 0;
  const debours = scenario.debours || 0;  // INCLUT droits d'enregistrement (fusionné)
  const stockFdR = scenario.stock_fonds_roulement || 0;
  const loyerAvance = scenario.loyer_avance || 0;
  const totalInvestissement = scenario.total_investissement || 0;

  // Ne plus utiliser droits_enregistrement séparé (fusionné avec debours)
  const totalHonoraires = honorairesHT + fraisActeHT + tva + debours;
  const totalStockFdR = stockFdR + loyerAvance;

  return `
    <table class="projet-vendeur-table">
      <thead>
        <tr>
          <th>Element</th>
          <th>Montant</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Prix de vente du fonds</td>
          <td class="amount">${prixFonds.toLocaleString('fr-FR')} EUR</td>
        </tr>
        <tr>
          <td>Honoraires & frais d'acquisition</td>
          <td class="amount">${totalHonoraires.toLocaleString('fr-FR')} EUR</td>
        </tr>
        ${totalHonoraires > 0 ? `
        <tr>
          <td class="detail" colspan="2">
            (Negociation ${honorairesHT.toLocaleString('fr-FR')} EUR + Acte ${fraisActeHT.toLocaleString('fr-FR')} EUR + Droits & Debours ${debours.toLocaleString('fr-FR')} EUR + TVA ${tva.toLocaleString('fr-FR')} EUR)
          </td>
        </tr>
        ` : ''}
        <tr>
          <td>Stocks & fonds de roulement</td>
          <td class="amount">${totalStockFdR.toLocaleString('fr-FR')} EUR</td>
        </tr>
        ${loyerAvance > 0 ? `
        <tr>
          <td class="detail" colspan="2">
            (Stock ${stockFdR.toLocaleString('fr-FR')} EUR + Loyer d'avance ${loyerAvance.toLocaleString('fr-FR')} EUR)
          </td>
        </tr>
        ` : ''}
        <tr class="total-row">
          <td><strong>TOTAL INVESTISSEMENT</strong></td>
          <td class="amount"><strong>${totalInvestissement.toLocaleString('fr-FR')} EUR</strong></td>
        </tr>
      </tbody>
    </table>
  `;
}

/**
 * Generate Key Figures (Chiffres Cles Projetes) HTML
 */
function generateKeyFigures(comptable: any, businessPlan: any, transactionFinancing: any, userComments: any): string {
  // Extract values
  const ebeComptable = comptable?.ebeRetraitement?.ebe_comptable || 0;
  const ebeNormatif = comptable?.ebeRetraitement?.ebe_normatif || 0;

  // Year 1 projections
  const projectionAnnee1 = businessPlan?.projections?.[1];
  const ebeAnnee1 = projectionAnnee1?.ebe_normatif || ebeNormatif;

  // Last accounting year
  const years = comptable?.sig ? Object.keys(comptable.sig).sort().reverse() : [];
  const lastYear = years[0] || '2023';

  // Utiliser le scénario négocié si disponible, sinon initial
  const scenario = transactionFinancing?.negocie?.total_investissement > 0
    ? transactionFinancing.negocie
    : transactionFinancing?.initial;

  // Apport personnel from transactionFinancing
  const apportPersonnel = scenario?.apport_personnel || 0;

  // Loan capacity assessment
  const annuitePrevue = scenario?.estimation_annuelle || 0;
  const capaciteRemboursement = ebeAnnee1 - annuitePrevue;
  const ratioEndettement = ebeAnnee1 > 0 ? (annuitePrevue / ebeAnnee1 * 100) : 100;

  // Determine if capacity is secure
  const isSecure = ratioEndettement < 50;
  const isWarning = ratioEndettement >= 50 && ratioEndettement < 70;

  // Evolution calculation
  const evolutionEbe = ebeComptable > 0 ? ((ebeAnnee1 - ebeComptable) / ebeComptable * 100) : 0;

  return `
    <div class="key-figures-grid">
      <div class="key-figure-card highlight">
        <div class="label">EBE Previsionnel N+1</div>
        <div class="value green">${ebeAnnee1.toLocaleString('fr-FR')} EUR</div>
        <div class="comparison">
          vs ${ebeComptable.toLocaleString('fr-FR')} EUR en ${lastYear}
          ${evolutionEbe > 0 ? `<span class="positive">(+${evolutionEbe.toFixed(0)}%)</span>` : ''}
        </div>
      </div>

      <div class="key-figure-card">
        <div class="label">Capacite de remboursement</div>
        ${isSecure ? `
          <div class="badge-secure">SECURISEE</div>
          <div class="comparison">Ratio endettement: ${ratioEndettement.toFixed(0)}%</div>
        ` : isWarning ? `
          <div class="badge-warning">A SURVEILLER</div>
          <div class="comparison">Ratio endettement: ${ratioEndettement.toFixed(0)}%</div>
        ` : `
          <div class="value" style="color: #dc2626;">TENDUE</div>
          <div class="comparison">Ratio endettement: ${ratioEndettement.toFixed(0)}%</div>
        `}
      </div>

      ${apportPersonnel > 0 ? `
      <div class="key-figure-card">
        <div class="label">Apport personnel</div>
        <div class="value blue">${apportPersonnel.toLocaleString('fr-FR')} EUR</div>
        ${scenario?.total_investissement ? `
        <div class="comparison">
          ${((apportPersonnel / scenario.total_investissement) * 100).toFixed(0)}% du total
        </div>
        ` : ''}
      </div>
      ` : ''}
    </div>
  `;
}

/**
 * Generate the complete Opportunity Section
 */
export async function generateOpportunitySection(
  comptable: any,
  valorisation: any,
  businessPlan: any,
  userComments: any,
  immobilier?: any
): Promise<string> {
  console.log('[opportunitySection] Generating opportunity section...');

  // Generate La Cible text (async Gemini call)
  const laCibleText = await generateLaCibleText(comptable, userComments);

  // Generate Le Projet text (async Gemini call) - enriched with ALL userComments fields
  const leProjetText = await generateLeProjetText(userComments, comptable, immobilier);

  // Extract transactionFinancing from userComments
  const transactionFinancing = userComments?.transactionFinancing;

  // Generate static sections
  const projetVendeurTable = generateProjetVendeurTable(transactionFinancing);
  const keyFiguresHtml = generateKeyFigures(comptable, businessPlan, transactionFinancing, userComments);

  console.log('[opportunitySection] Section generated successfully');

  return `
<div class="opportunity-section">
  <h3 class="opportunity-title">OPPORTUNITE DE REPRISE & RESTRUCTURATION</h3>

  <!-- 1. La Cible -->
  <div class="opportunity-subsection">
    <h4>LA CIBLE</h4>
    <p>${laCibleText}</p>
  </div>

  ${leProjetText ? `
  <!-- 2. Le Projet -->
  <div class="opportunity-subsection">
    <h4>LE PROJET</h4>
    <p>${leProjetText}</p>
  </div>
  ` : ''}

  <!-- 3. Projet Vendeur -->
  <div class="opportunity-subsection">
    <h4>PROJET VENDEUR</h4>
    ${projetVendeurTable}
  </div>

  <!-- 4. Chiffres Cles Projetes -->
  <div class="opportunity-subsection">
    <h4>CHIFFRES CLES PROJETES</h4>
    ${keyFiguresHtml}
  </div>
</div>
`;
}

export default generateOpportunitySection;

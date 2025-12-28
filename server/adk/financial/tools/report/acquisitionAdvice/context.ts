/**
 * Geographic Context Module
 *
 * Parses professional reports to extract geographic and market context data.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { ProfessionalReportData } from './types';

/**
 * Parse le rapport professionnel HTML pour extraire les donnees contextuelles
 */
export async function parseProfessionalReport(siren: string): Promise<ProfessionalReportData | null> {
  if (!siren || siren.length < 9) {
    console.log('[parseProfessionalReport] SIREN invalide:', siren);
    return null;
  }

  const reportDir = path.join(process.cwd(), 'data', 'professional-reports', siren);

  try {
    // Lister les fichiers HTML dans le dossier
    const files = await fs.readdir(reportDir);
    const htmlFiles = files.filter(f => f.endsWith('.html')).sort().reverse(); // Plus recent en premier

    if (htmlFiles.length === 0) {
      console.log('[parseProfessionalReport] Aucun rapport professionnel trouve pour SIREN:', siren);
      return null;
    }

    const latestReport = path.join(reportDir, htmlFiles[0]);
    console.log('[parseProfessionalReport] Lecture du rapport:', htmlFiles[0]);

    const htmlContent = await fs.readFile(latestReport, 'utf-8');

    // Extraction des donnees avec regex
    const result: ProfessionalReportData = {
      commune: {
        nom: '',
        population: 0,
        densite: '',
        csp: ''
      },
      dynamisme: 'moyen',
      saisonnalite: {
        touristique: false,
        variation: ''
      },
      scores: {
        location: 0,
        market: 0,
        operational: 0,
        financial: 0
      },
      swot: {
        forces: [],
        faiblesses: [],
        opportunites: [],
        menaces: []
      },
      risques: []
    };

    // 1. Commune info
    const communeMatch = htmlContent.match(/<strong>([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ\-']+(?:\s+[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ\-']+)*)<\/strong>\s*\([0-9]+\)\s*est une commune de\s*<strong>([0-9\s]+)\s*habitants<\/strong>\s*avec une densité de population\s*<strong>([^<]+)<\/strong>/i);
    if (communeMatch) {
      result.commune.nom = communeMatch[1];
      result.commune.population = parseInt(communeMatch[2].replace(/\s/g, ''));
      result.commune.densite = communeMatch[3].trim();
    }

    // 2. CSP
    const cspMatch = htmlContent.match(/catégorie socio-professionnelle dominante est\s*<strong>([^<]+)<\/strong>/i);
    if (cspMatch) {
      result.commune.csp = cspMatch[1].trim();
    }

    // 3. Dynamisme economique
    const dynamismeMatch = htmlContent.match(/Dynamisme économique\s*\(([^)]+)\)/i);
    if (dynamismeMatch) {
      result.dynamisme = dynamismeMatch[1].toLowerCase();
    }

    // 4. Saisonnalite
    result.saisonnalite.touristique = /commune touristique|zone touristique|station balnéaire/i.test(htmlContent);
    const saisonMatch = htmlContent.match(/Saisonnalité.*?:\s*([^<]+)</i);
    if (saisonMatch) {
      result.saisonnalite.variation = saisonMatch[1].trim();
    }

    // 5. Scores
    const locationScore = htmlContent.match(/Location<\/div>\s*<div class="score-value">(\d+)\/100/i);
    const marketScore = htmlContent.match(/Market<\/div>\s*<div class="score-value">(\d+)\/100/i);
    const operationalScore = htmlContent.match(/Operational<\/div>\s*<div class="score-value">(\d+)\/100/i);
    const financialScore = htmlContent.match(/Financial<\/div>\s*<div class="score-value">(\d+)\/100/i);

    if (locationScore) result.scores.location = parseInt(locationScore[1]);
    if (marketScore) result.scores.market = parseInt(marketScore[1]);
    if (operationalScore) result.scores.operational = parseInt(operationalScore[1]);
    if (financialScore) result.scores.financial = parseInt(financialScore[1]);

    // 6. SWOT
    const extractListItems = (sectionName: string): string[] => {
      const sectionRegex = new RegExp(`<h3>${sectionName}</h3>\\s*<ul>([\\s\\S]*?)</ul>`, 'i');
      const match = htmlContent.match(sectionRegex);
      if (match) {
        const items = match[1].match(/<li>([^<]+)<\/li>/g);
        return items ? items.map(i => i.replace(/<\/?li>/g, '').trim()) : [];
      }
      return [];
    };

    result.swot.forces = extractListItems('Points Forts');
    result.swot.faiblesses = extractListItems('Points Faibles');
    result.swot.opportunites = extractListItems('Opportunités');
    result.swot.menaces = extractListItems('Menaces');

    // 7. Risques
    const riskMatches = htmlContent.matchAll(/<div class="risk-item ([^"]+)">\s*<h3><span class="badge[^>]*>([^<]+)<\/span>([^<]+)<\/h3>\s*<p><strong>Description:<\/strong>\s*([^<]+)<\/p>\s*<p><strong>Impact:<\/strong>\s*([^<]+)<\/p>\s*<p><strong>Mitigation:<\/strong>\s*([^<]+)<\/p>/gi);

    for (const match of riskMatches) {
      result.risques.push({
        severity: match[2].trim(),
        type: match[3].trim(),
        description: match[4].trim(),
        mitigation: match[6].trim()
      });
    }

    console.log('[parseProfessionalReport] Donnees extraites:', {
      commune: result.commune.nom,
      population: result.commune.population,
      dynamisme: result.dynamisme,
      touristique: result.saisonnalite.touristique,
      scores: result.scores,
      risques: result.risques.length
    });

    return result;

  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log('[parseProfessionalReport] Dossier rapport professionnel inexistant pour SIREN:', siren);
    } else {
      console.error('[parseProfessionalReport] Erreur:', error.message);
    }
    return null;
  }
}

/**
 * Generate the geographic context HTML box
 */
export function generateContextBox(professionalData: ProfessionalReportData | null): string {
  if (!professionalData) {
    return '';
  }

  const { commune, dynamisme, saisonnalite } = professionalData;

  return `
    <div class="context-box">
      <h4>Contexte Geographique</h4>
      <div class="context-grid">
        <div class="context-item">
          <span class="icon">👥</span>
          <span class="label">Population</span>
          <span class="value">${commune.population.toLocaleString('fr-FR')} hab.</span>
        </div>
        <div class="context-item">
          <span class="icon">📊</span>
          <span class="label">Densite</span>
          <span class="value">${commune.densite}</span>
        </div>
        <div class="context-item">
          <span class="icon">💼</span>
          <span class="label">Clientele</span>
          <span class="value">${commune.csp || 'Non specifie'}</span>
        </div>
        <div class="context-item">
          <span class="icon">📈</span>
          <span class="label">Dynamisme</span>
          <span class="value">${dynamisme}</span>
        </div>
        ${saisonnalite.touristique ? `
        <div class="context-item">
          <span class="icon">🏖️</span>
          <span class="label">Zone</span>
          <span class="value">Touristique</span>
        </div>
        ` : ''}
      </div>
    </div>
  `;
}

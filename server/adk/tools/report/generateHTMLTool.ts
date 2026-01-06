import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import type { ToolContext } from '@google/adk';
import { zToGen } from '../../utils/schemaHelper.js';
import type { BusinessInput } from '../../schemas';
import { formatActivity } from '../../config/nafCodes.js';
import axios from 'axios';

/**
 * Tronque intelligemment un texte à la dernière phrase complète
 * @param text Texte à tronquer
 * @param maxLength Longueur maximale (défaut: 500)
 * @returns Texte tronqué à la dernière phrase ou au dernier espace
 */
function smartTruncate(text: string, maxLength: number = 500): string {
  if (!text || text.length <= maxLength) {
    return text;
  }

  // Couper à maxLength
  const truncated = text.substring(0, maxLength);

  // Chercher la dernière phrase complète (. ! ?)
  const lastPeriod = truncated.lastIndexOf('.');
  const lastExclamation = truncated.lastIndexOf('!');
  const lastQuestion = truncated.lastIndexOf('?');

  const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);

  // Si on trouve une fin de phrase et qu'elle utilise au moins 70% de la longueur max
  if (lastSentenceEnd > maxLength * 0.7) {
    return text.substring(0, lastSentenceEnd + 1);
  }

  // Sinon, couper au dernier espace pour éviter de couper un mot
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.7) {
    return text.substring(0, lastSpace) + '...';
  }

  // Dernier recours: couper brut
  return truncated + '...';
}


/**
 * Generate HTML Tool
 *
 * Génère un rapport HTML professionnel compilant tous les résultats d'analyse du pipeline (10 agents).
 * Lit tous les outputs agents depuis le state via ToolContext.
 *
 * Sections du rapport:
 * 1. Executive Summary (GO/NO-GO, scores clés)
 * 2. Business Information (identité, localisation)
 * 3. Demographic Analysis (population, CSP)
 * 4. Market Analysis (concurrence, réputation)
 * 5. Physical Assessment (photos, travaux)
 * 6. Data Validation (conflits, cohérence)
 * 7. Risk Analysis (risques, mitigation)
 * 8. Strategic Recommendation (GO/NO-GO final)
 */

const GenerateHTMLInputSchema = z.object({
  // Aucun paramètre - lit tous les outputs agents depuis state
});

/**
 * Génère le CSS du rapport
 */
function generateCSS(): string {
  return `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.6;
        color: #333;
        background: #f5f5f5;
        padding: 20px;
      }
      .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
      h1 { color: #1a1a1a; font-size: 2.5em; margin-bottom: 10px; border-bottom: 4px solid #0066cc; padding-bottom: 10px; }
      h2 { color: #0066cc; font-size: 1.8em; margin-top: 30px; margin-bottom: 15px; border-left: 4px solid #0066cc; padding-left: 15px; }
      h3 { color: #333; font-size: 1.3em; margin-top: 20px; margin-bottom: 10px; }
      .header { text-align: center; margin-bottom: 40px; }
      .timestamp { color: #666; font-size: 0.9em; }
      .summary-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px; margin: 20px 0; }
      .summary-box h2 { color: white; border: none; }
      .recommendation { font-size: 2em; font-weight: bold; margin: 20px 0; }
      .recommendation.go { color: #10b981; }
      .recommendation.no-go { color: #ef4444; }
      .recommendation.reserves { color: #f59e0b; }
      .score-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
      .score-card { background: #f8fafc; border-left: 4px solid #0066cc; padding: 20px; border-radius: 4px; }
      .score-value { font-size: 2.5em; font-weight: bold; color: #0066cc; }
      .score-label { color: #666; font-size: 0.9em; text-transform: uppercase; }
      .info-grid { display: grid; grid-template-columns: 200px 1fr; gap: 15px; margin: 15px 0; }
      .info-label { font-weight: bold; color: #666; }
      .info-value { color: #333; }
      .risk-item { background: #fff1f2; border-left: 4px solid #ef4444; padding: 15px; margin: 10px 0; border-radius: 4px; }
      .risk-item.critical { background: #fef2f2; border-color: #dc2626; }
      .risk-item.high { background: #fff7ed; border-color: #f97316; }
      .risk-item.medium { background: #fffbeb; border-color: #f59e0b; }
      .risk-item.low { background: #f0fdf4; border-color: #22c55e; }
      .conflict-item { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 10px 0; }
      .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 0.85em; font-weight: bold; margin-right: 8px; }
      .badge.success { background: #d1fae5; color: #065f46; }
      .badge.warning { background: #fed7aa; color: #92400e; }
      .badge.error { background: #fecaca; color: #991b1b; }
      .badge.info { background: #dbeafe; color: #1e40af; }
      table { width: 100%; border-collapse: collapse; margin: 15px 0; }
      th, td { text-align: left; padding: 12px; border-bottom: 1px solid #e5e7eb; }
      th { background: #f8fafc; font-weight: 600; color: #374151; }
      .photo-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; margin: 20px 0; }
      .photo-card { position: relative; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
      .photo-card img { width: 100%; height: 250px; object-fit: cover; }
      .photo-badge { position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.7); color: white; padding: 5px 10px; border-radius: 4px; font-size: 0.8em; }
      .photo-annotation { background: #f8fafc; padding: 10px; font-size: 0.85em; margin-top: 5px; border-radius: 0 0 8px 8px; }
      .commune-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
      .commune-grid img { width: 100%; border-radius: 8px; max-height: 300px; object-fit: cover; }
      .no-data { color: #666; font-style: italic; padding: 15px; background: #f8fafc; border-radius: 4px; margin: 10px 0; }
      .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #666; font-size: 0.9em; }
      @media (max-width: 768px) {
        .commune-grid { grid-template-columns: 1fr; }
        .photo-grid { grid-template-columns: 1fr; }
      }
    </style>
  `;
}

/**
 * Génère la section Executive Summary
 */
function generateExecutiveSummary(strategic: any, gap: any): string {
  if (!strategic || !gap) {
    return '<div class="summary-box"><h2>Executive Summary</h2><p>Données insuffisantes</p></div>';
  }

  const recommendationClass = strategic.recommendation === 'GO' ? 'go' :
                              strategic.recommendation === 'NO-GO' ? 'no-go' : 'reserves';

  return `
    <div class="summary-box">
      <h2>Executive Summary</h2>
      <div class="recommendation ${recommendationClass}">
        ${strategic.recommendation === 'GO' ? '✓ GO' :
          strategic.recommendation === 'NO-GO' ? '✗ NO-GO' : '⚠ GO WITH RESERVES'}
      </div>
      <div class="score-grid">
        <div class="score-card">
          <div class="score-label">Score Global</div>
          <div class="score-value">${strategic.score || gap.scores?.overall || 'N/A'}/100</div>
        </div>
        <div class="score-card">
          <div class="score-label">Confiance</div>
          <div class="score-value">${Math.round((strategic.confidence || 0) * 100)}%</div>
        </div>
        <div class="score-card">
          <div class="score-label">Niveau Risque</div>
          <div class="score-value">${gap.risk_summary?.overall_risk_level || 'N/A'}</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Génère la section Business Information
 */
function generateBusinessInfo(business: any, preparation: any): string {
  return `
    <h2>Business Information</h2>
    <div class="info-grid">
      <div class="info-label">Nom:</div>
      <div class="info-value">${business.enseigne || business.nom_complet || 'N/A'}</div>
      <div class="info-label">SIRET:</div>
      <div class="info-value">${business.siret || 'N/A'}</div>
      <div class="info-label">Activité:</div>
      <div class="info-value">${formatActivity(business.activite_principale || business.code_naf)}</div>
      <div class="info-label">Adresse:</div>
      <div class="info-value">${preparation?.normalizedAddress?.full || 'N/A'}</div>
      <div class="info-label">Coordonnées GPS:</div>
      <div class="info-value">${preparation?.coordinates ?
        `${preparation.coordinates.lat.toFixed(6)}, ${preparation.coordinates.lon.toFixed(6)}` : 'N/A'}</div>
    </div>
  `;
}

/**
 * Génère la section Scores
 */
function generateScores(gap: any): string {
  if (!gap?.scores) return '';

  return `
    <h2>Scores Multi-Dimensionnels</h2>
    <div class="score-grid">
      <div class="score-card">
        <div class="score-label">Location</div>
        <div class="score-value">${gap.scores.location}/100</div>
        <p style="margin-top: 10px; font-size: 0.9em;">${gap.interpretation?.location || ''}</p>
      </div>
      <div class="score-card">
        <div class="score-label">Market</div>
        <div class="score-value">${gap.scores.market}/100</div>
        <p style="margin-top: 10px; font-size: 0.9em;">${gap.interpretation?.market || ''}</p>
      </div>
      <div class="score-card">
        <div class="score-label">Operational</div>
        <div class="score-value">${gap.scores.operational}/100</div>
        <p style="margin-top: 10px; font-size: 0.9em;">${gap.interpretation?.operational || ''}</p>
      </div>
      <div class="score-card">
        <div class="score-label">Financial</div>
        <div class="score-value">${gap.scores.financial}/100</div>
        <p style="margin-top: 10px; font-size: 0.9em;">${gap.interpretation?.financial || ''}</p>
      </div>
    </div>
  `;
}

/**
 * Génère la section Risks
 */
function generateRisks(gap: any): string {
  if (!gap?.risks || gap.risks.length === 0) {
    return '<h2>Analyse des Risques</h2><p>Aucun risque identifié.</p>';
  }

  const risksHTML = gap.risks.map((risk: any) => `
    <div class="risk-item ${risk.severity.toLowerCase()}">
      <h3><span class="badge ${risk.severity === 'CRITICAL' ? 'error' : risk.severity === 'HIGH' ? 'warning' : 'info'}">${risk.severity}</span>${risk.category}</h3>
      <p><strong>Description:</strong> ${risk.description}</p>
      <p><strong>Impact:</strong> ${risk.impact}</p>
      <p><strong>Mitigation:</strong> ${risk.mitigation}</p>
      ${risk.cost_estimate ? `<p><strong>Coût estimé:</strong> ${risk.cost_estimate.toLocaleString('fr-FR')}€</p>` : ''}
    </div>
  `).join('');

  return `
    <h2>Analyse des Risques</h2>
    <p><strong>Total:</strong> ${gap.risk_summary.total_risks} risques
       (${gap.risk_summary.by_severity.critical} CRITICAL,
        ${gap.risk_summary.by_severity.high} HIGH,
        ${gap.risk_summary.by_severity.medium} MEDIUM,
        ${gap.risk_summary.by_severity.low} LOW)</p>
    ${risksHTML}
  `;
}

/**
 * Génère la section Strategic Rationale
 */
function generateStrategicRationale(strategic: any): string {
  if (!strategic?.rationale) return '';

  return `
    <h2>Analyse Stratégique</h2>
    <h3>Points Forts</h3>
    <ul>${(strategic.rationale.strengths || []).map((s: string) => `<li>${s}</li>`).join('')}</ul>

    <h3>Points Faibles</h3>
    <ul>${(strategic.rationale.weaknesses || []).map((w: string) => `<li>${w}</li>`).join('')}</ul>

    ${strategic.rationale.opportunities?.length > 0 ? `
    <h3>Opportunités</h3>
    <ul>${strategic.rationale.opportunities.map((o: string) => `<li>${o}</li>`).join('')}</ul>
    ` : ''}

    ${strategic.rationale.threats?.length > 0 ? `
    <h3>Menaces</h3>
    <ul>${strategic.rationale.threats.map((t: string) => `<li>${t}</li>`).join('')}</ul>
    ` : ''}
  `;
}

/**
 * Génère le tableau des horaires d'ouverture
 */
function generateOpeningHoursTable(places: any): string {
  if (!places?.openingHours?.weekdayDescriptions || places.openingHours.weekdayDescriptions.length === 0) {
    return `
      <h2>🕐 Horaires d'Ouverture</h2>
      <p class="no-data">Horaires non disponibles</p>
    `;
  }

  const dayTranslation: Record<string, string> = {
    'Monday': 'Lundi',
    'Tuesday': 'Mardi',
    'Wednesday': 'Mercredi',
    'Thursday': 'Jeudi',
    'Friday': 'Vendredi',
    'Saturday': 'Samedi',
    'Sunday': 'Dimanche'
  };

  const rows = places.openingHours.weekdayDescriptions.map((desc: string) => {
    // Split uniquement sur le PREMIER colon pour gérer les horaires avec plusieurs ":"
    const colonIndex = desc.indexOf(':');
    const dayEN = colonIndex > -1 ? desc.substring(0, colonIndex).trim() : desc;
    const hours = colonIndex > -1 ? desc.substring(colonIndex + 1).trim() : '';
    const dayFR = dayTranslation[dayEN] || dayEN;
    const isClosed = !hours || hours.toLowerCase().includes('closed') || hours.toLowerCase().includes('fermé');

    return `
      <tr>
        <td><strong>${dayFR}</strong></td>
        <td>${isClosed ? '<span class="badge error">Fermé</span>' : hours}</td>
      </tr>
    `;
  }).join('');

  const openNowBadge = places.openingHours.openNow !== undefined
    ? `<p style="margin-top: 10px;">${places.openingHours.openNow
        ? '<span class="badge success">Ouvert maintenant</span>'
        : '<span class="badge error">Fermé actuellement</span>'}</p>`
    : '';

  return `
    <h2>🕐 Horaires d'Ouverture</h2>
    ${openNowBadge}
    <table>
      <thead>
        <tr>
          <th>Jour</th>
          <th>Horaires</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

/**
 * Génère le tableau BODACC des rachats
 */
function generateBODACCTable(business: any): string {
  if (!business?.bodaccData || !Array.isArray(business.bodaccData) || business.bodaccData.length === 0) {
    return `
      <h2>💼 Historique des Rachats (BODACC)</h2>
      <p class="no-data">Aucun historique BODACC trouvé pour ce commerce</p>
    `;
  }

  // Helper pour parser et formater les dates
  const parseDate = (dateString: string): Date => {
    try {
      // Essayer format ISO d'abord
      let date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date;
      }
      // Fallback : DD/MM/YYYY
      const parts = dateString.split('/');
      if (parts.length === 3) {
        date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    } catch (e) {
      // Ignorer erreurs de parsing
    }
    return new Date(0); // Date par défaut si parsing échoue
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = parseDate(dateString);
      return date.toLocaleDateString('fr-FR');
    } catch (e) {
      return dateString; // Retourner string original si formattage échoue
    }
  };

  const formatAmount = (amount: number): string => {
    return amount.toLocaleString('fr-FR') + ' €';
  };

  // Trier par date décroissante (plus récent en premier)
  const sortedRecords = [...business.bodaccData].sort((a: any, b: any) => {
    const dateA = parseDate(a.date).getTime();
    const dateB = parseDate(b.date).getTime();
    return dateB - dateA;
  });

  const rows = sortedRecords.map((record: any) => {
    return `
      <tr>
        <td>${formatDate(record.date)}</td>
        <td><strong>${formatAmount(record.amount)}</strong></td>
      </tr>
    `;
  }).join('');

  return `
    <h2>💼 Historique des Rachats (BODACC)</h2>
    <p style="margin-bottom: 10px;"><strong>${sortedRecords.length}</strong> transaction(s) enregistrée(s) au BODACC</p>
    <table>
      <thead>
        <tr>
          <th>Date de Parution</th>
          <th>Montant du Rachat</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

/**
 * Génère la section photos du commerce
 */
function generatePhotosSection(places: any, photo: any): string {
  if (!places?.photos || !Array.isArray(places.photos) || places.photos.length === 0) {
    return `
      <h2>📸 Photos du Commerce</h2>
      <p class="no-data">Aucune photo disponible pour ce commerce</p>
    `;
  }

  // Filtrer et sélectionner les meilleures photos
  const filteredPhotos = places.photos
    .filter((p: any) => p.widthPx && p.heightPx && p.widthPx >= 400 && p.heightPx >= 400)
    .slice(0, 6); // Max 6 photos

  if (filteredPhotos.length === 0) {
    return `
      <h2>📸 Photos du Commerce</h2>
      <p class="no-data">Photos de qualité insuffisante</p>
    `;
  }

  // Générer les cartes photos
  const photoCards = filteredPhotos.map((p: any, index: number) => {
    const hasBadge = photo?.analyzed && index === 0; // Badge sur la première photo si analysée

    return `
      <div class="photo-card">
        <img src="${p.url}" alt="Photo du commerce ${index + 1}" loading="lazy" />
        ${hasBadge ? `
          <div class="photo-badge">
            ${photo.condition || 'État analysé'}
          </div>
        ` : ''}
        ${hasBadge && (photo.renovation_needed || photo.cost_estimate) ? `
          <div class="photo-annotation">
            ${photo.renovation_needed ? `<strong>⚠️ Travaux nécessaires</strong><br/>` : ''}
            ${photo.cost_estimate ? `Coût estimé : ${photo.cost_estimate.toLocaleString('fr-FR')} €` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  return `
    <h2>📸 Photos du Commerce</h2>
    <p style="margin-bottom: 10px;">${filteredPhotos.length} photo(s) disponible(s)</p>
    ${photo?.analyzed ? `<p style="margin-bottom: 15px;"><span class="badge info">✓ Analyse IA effectuée</span></p>` : ''}
    <div class="photo-grid">
      ${photoCards}
    </div>
  `;
}

/**
 * Récupère données de la commune via Tavily API
 */
async function fetchCommuneDataWithTavily(commune: string): Promise<{ imageUrl: string, description: string, sourceUrl: string }> {
  const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

  if (!TAVILY_API_KEY) {
    console.warn('[fetchCommuneDataWithTavily] TAVILY_API_KEY not configured');
    return {
      imageUrl: '',
      description: '',
      sourceUrl: ''
    };
  }

  try {
    console.log(`[fetchCommuneDataWithTavily] Fetching data for ${commune}...`);

    const response = await axios.post(
      'https://api.tavily.com/search',
      {
        api_key: TAVILY_API_KEY,
        query: `${commune} France tourisme présentation ville photos`,
        search_depth: 'advanced',
        include_images: true,
        max_results: 3
      },
      { timeout: 8000 }
    );

    const imageUrl = response.data.images?.[0] || '';
    const description = response.data.results?.[0]?.content?.substring(0, 300) || '';
    const sourceUrl = response.data.results?.[0]?.url || '';

    console.log(`[fetchCommuneDataWithTavily] Success - Image: ${imageUrl ? 'found' : 'not found'}, Description length: ${description.length}`);

    return { imageUrl, description, sourceUrl };
  } catch (error: any) {
    console.error('[fetchCommuneDataWithTavily] Error:', error.message);
    return {
      imageUrl: '',
      description: '',
      sourceUrl: ''
    };
  }
}

/**
 * Traduit catégories CSP et densité en français
 */
function translateCategory(key: string, value: string): string {
  const translations: Record<string, Record<string, string>> = {
    csp: {
      'high': 'CSP+ (cadres, professions libérales)',
      'middle': 'Classes moyennes (employés, professions intermédiaires)',
      'low': 'Classes populaires (ouvriers, retraités)',
      'mixed': 'CSP mixte'
    },
    density: {
      'Zone rurale': 'Zone rurale',
      'Zone péri-urbaine': 'Zone péri-urbaine',
      'Zone urbaine': 'Zone urbaine',
      'Centre-ville dense': 'Centre-ville dense',
      'Très dense': 'Très dense'
    },
    dynamism: {
      'high': 'élevé',
      'medium': 'modéré',
      'low': 'faible'
    }
  };

  return translations[key]?.[value] || value;
}

/**
 * Génère la section présentation de la commune
 */
async function generateCommuneSection(preparation: any, demographic: any): Promise<string> {
  if (!preparation?.commune?.nom) {
    return `
      <h2>🏘️ Présentation de la Commune</h2>
      <p class="no-data">Informations sur la commune non disponibles</p>
    `;
  }

  const commune = preparation.commune.nom;
  const zipCode = preparation.normalizedAddress?.zipCode || '';
  const lat = preparation.coordinates?.lat;
  const lon = preparation.coordinates?.lon;

  // Récupérer données Tavily
  const tavilyData = await fetchCommuneDataWithTavily(commune);

  // Générer URL Google Maps Static avec error handling
  const PLACE_API_KEY = process.env.PLACE_API_KEY;
  let mapUrl = '';
  let mapError = '';

  if (lat && lon) {
    if (PLACE_API_KEY) {
      mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lon}&zoom=13&size=600x300&maptype=roadmap&markers=color:red|${lat},${lon}&key=${PLACE_API_KEY}`;
    } else {
      mapError = 'API key manquante pour Google Maps Static';
    }
  } else {
    mapError = 'Coordonnées GPS non disponibles';
  }

  // Récupérer local_context pour données enrichies
  const localContext = demographic?.local_context;

  // Construire description enrichie en 6 sections
  const descriptionParts: string[] = [];

  // 1. DÉMOGRAPHIE DE BASE (2-3 lignes)
  const population = demographic?.commune?.population || 'N/A';
  const densityCategory = demographic?.profile?.density_category || 'N/A';
  const cspCategory = demographic?.profile?.estimated_csp?.dominant || 'N/A';

  // ✅ FALLBACK MULTI-SOURCES pour zone de chalandise (fix "0 habitants")
  const tradeAreaPop =
    demographic?.profile?.trade_area_potential?.['1km'] ||
    demographic?.profile?.trade_area_potential?.walking_500m ||
    demographic?.catchmentArea?.population ||
    demographic?.population ||
    (typeof population === 'number' ? Math.round(population * 0.15) : 0); // Estimation 15% de la commune

  if (typeof population === 'number' && population > 0) {
    const cspTranslated = translateCategory('csp', cspCategory);
    descriptionParts.push(
      `<strong>${commune}</strong> ${zipCode ? `(${zipCode})` : ''} est une commune de <strong>${population.toLocaleString('fr-FR')} habitants</strong> ` +
      `avec une densité de population <strong>${densityCategory}</strong>. ` +
      `La catégorie socio-professionnelle dominante est <strong>${cspTranslated}</strong>. ` +
      `La zone de chalandise estimée à 1 km représente <strong>${tradeAreaPop.toLocaleString('fr-FR')} habitants</strong>.`
    );
  } else {
    descriptionParts.push(`<strong>${commune}</strong> ${zipCode ? `(${zipCode})` : ''} - Données démographiques en cours de collecte.`);
  }

  // 2. PROJETS MUNICIPAUX (3-5 lignes)
  if (localContext?.urban_projects && Array.isArray(localContext.urban_projects) && localContext.urban_projects.length > 0) {
    const projects = localContext.urban_projects.slice(0, 3);
    const projectsList = projects.map((p: any) => {
      const title = p.title || '';
      const content = p.content ? p.content.substring(0, 150) : '';
      const url = p.url || '';
      return `<strong>${title}</strong>: ${content}${url ? ` <a href="${url}" target="_blank" style="color: #0066cc;">[source]</a>` : ''}`;
    }).join('<br/>');

    descriptionParts.push(
      `<br/><br/><strong>🏛️ Projets municipaux:</strong><br/>${projectsList}`
    );
  }

  // 3. ACTUALITÉS RÉCENTES (2-3 lignes)
  if (localContext?.recent_news && Array.isArray(localContext.recent_news) && localContext.recent_news.length > 0) {
    const news = localContext.recent_news.slice(0, 2);
    const newsList = news.map((n: any) => {
      const title = n.title || '';
      const content = n.content ? n.content.substring(0, 120) : '';
      return `${title}: ${content}`;
    }).join('<br/>');

    descriptionParts.push(
      `<br/><br/><strong>📰 Actualités récentes:</strong><br/>${newsList}`
    );
  }

  // 4. DYNAMISME ÉCONOMIQUE (2-3 lignes)
  if (localContext?.economic_activity && Array.isArray(localContext.economic_activity) && localContext.economic_activity.length > 0) {
    const economic = localContext.economic_activity[0];
    const economicText = economic.content ? smartTruncate(economic.content, 500) : '';  // ✅ 500 au lieu de 200
    const dynamismLevel = localContext.economic_dynamism ? translateCategory('dynamism', localContext.economic_dynamism) : '';

    if (economicText) {
      descriptionParts.push(
        `<br/><br/><strong>💼 Dynamisme économique ${dynamismLevel ? `(${dynamismLevel})` : ''}:</strong><br/>${economicText}`
      );
    }
  }

  // 5. SAISONNALITÉ & TOURISME (1-2 lignes)
  if (localContext?.seasonality) {
    const seasonality = localContext.seasonality;
    if (seasonality.has_tourism || seasonality.has_events) {
      const seasonalityParts: string[] = [];
      if (seasonality.has_tourism) seasonalityParts.push('commune touristique');
      if (seasonality.has_events) seasonalityParts.push('événements réguliers');
      if (seasonality.seasonal_variation) seasonalityParts.push(seasonality.seasonal_variation);

      descriptionParts.push(
        `<br/><br/><strong>🎭 Saisonnalité:</strong> ${seasonalityParts.join(', ')}.`
      );
    }
  }

  // 6. CONTEXTE TAVILY (1-2 lignes) - conservé pour compatibilité
  const tavilyDescription = tavilyData.description
    ? `<br/><br/><em style="color: #666;">${tavilyData.description}... ` +
      `${tavilyData.sourceUrl ? `<a href="${tavilyData.sourceUrl}" target="_blank" style="color: #0066cc;">En savoir plus</a>` : ''}</em>`
    : '';

  // Assembler toutes les parties
  const enrichedDescription = descriptionParts.join('') + tavilyDescription;

  return `
    <h2>🏘️ Présentation de la Commune</h2>

    <div class="commune-grid">
      ${tavilyData.imageUrl ? `
        <div>
          <img src="${tavilyData.imageUrl}" alt="${commune}" onerror="this.style.display='none'" />
        </div>
      ` : `
        <div style="background: #f0f0f0; border-radius: 8px; display: flex; align-items: center; justify-content: center; min-height: 200px;">
          <p class="no-data">Image non disponible</p>
        </div>
      `}

      ${mapUrl ? `
        <div>
          <img src="${mapUrl}" alt="Carte de ${commune}" style="width: 100%; border-radius: 8px; border: 1px solid #e0e0e0;"
               onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkNhcnRlIG5vbiBkaXNwb25pYmxlPC90ZXh0Pjwvc3ZnPg==';
               this.alt='Carte non disponible';" />
        </div>
      ` : `
        <div style="width: 100%; height: 300px; background: #f5f5f5; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #999;">
          <p class="no-data">Carte non disponible${mapError ? ' - ' + mapError : ''}</p>
        </div>
      `}
    </div>

    <p style="margin-top: 20px; line-height: 1.8;">${enrichedDescription}</p>
  `;
}

export const generateHTMLTool = new FunctionTool({
  name: 'generateHTML',
  description: 'Génère rapport HTML professionnel avec tous résultats agents. Lit tous outputs depuis state. Retourne { html, size_bytes, sections_included }',
  parameters: zToGen(GenerateHTMLInputSchema),

  execute: async (params, toolContext?: ToolContext) => {
    // Helper pour parser JSON strings automatiquement
    const parseIfNeeded = (value: any) => {
      if (typeof value === 'string' && value.trim().startsWith('{')) {
        try {
          return JSON.parse(value);
        } catch (e) {
          return value;
        }
      }
      return value;
    };

    // Lire tous les outputs depuis state
    const data = {
      business: toolContext?.state.get('business') as BusinessInput | undefined,
      preparation: parseIfNeeded(toolContext?.state.get('preparation')),
      demographic: parseIfNeeded(toolContext?.state.get('demographic')),
      places: parseIfNeeded(toolContext?.state.get('places')),
      photo: parseIfNeeded(toolContext?.state.get('photo')),
      competitor: parseIfNeeded(toolContext?.state.get('competitor')),
      validation: parseIfNeeded(toolContext?.state.get('validation')),
      gap: parseIfNeeded(toolContext?.state.get('gap')),
      arbitration: parseIfNeeded(toolContext?.state.get('arbitration')),
      strategic: parseIfNeeded(toolContext?.state.get('strategic'))
    };

    const timestamp = new Date().toLocaleString('fr-FR');
    const businessName = data.business?.enseigne || data.business?.nom_complet || 'Commerce Inconnu';

    // Générer section commune (async avec Tavily)
    const communeSection = await generateCommuneSection(data.preparation, data.demographic);

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport Analyse Professionnelle - ${businessName}</title>
  ${generateCSS()}
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Rapport d'Analyse Professionnelle</h1>
      <p class="timestamp">Généré le ${timestamp}</p>
    </div>

    ${generateExecutiveSummary(data.strategic, data.gap)}
    ${generateBusinessInfo(data.business, data.preparation)}
    ${communeSection}
    ${generatePhotosSection(data.places, data.photo)}
    ${generateBODACCTable(data.business)}
    ${generateOpeningHoursTable(data.places)}
    ${generateScores(data.gap)}
    ${generateRisks(data.gap)}
    ${generateStrategicRationale(data.strategic)}

    <div class="footer">
      <p>🤖 Généré avec Claude Code - ADK TypeScript SDK</p>
      <p>SearchCommerce Professional Analysis Pipeline</p>
    </div>
  </div>
</body>
</html>
    `;

    const sectionsIncluded = [];
    if (data.preparation) sectionsIncluded.push('preparation');
    if (data.demographic) sectionsIncluded.push('demographic');
    if (data.places) sectionsIncluded.push('places');
    if (data.photo) sectionsIncluded.push('photo');
    if (data.competitor) sectionsIncluded.push('competitor');
    if (data.validation) sectionsIncluded.push('validation');
    if (data.gap) sectionsIncluded.push('gap');
    if (data.arbitration) sectionsIncluded.push('arbitration');
    if (data.strategic) sectionsIncluded.push('strategic');

    return {
      html,
      size_bytes: Buffer.byteLength(html, 'utf8'),
      sections_included: sectionsIncluded,
      generated_at: timestamp
    };
  }
});

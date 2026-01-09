/**
 * Photo Analysis Section for Professional Report
 * Displays detailed physical state analysis from photos
 */

interface EtatGeneral {
  devanture?: string;
  interieur?: string;
  equipement?: string;
  note_globale?: number;

  // ✅ NOUVEAU: 3 critères simples (boolean)
  propre?: boolean;
  lumineux?: boolean;
  range?: boolean;

  // ❌ ANCIENS CRITÈRES COMPLEXES (optionnels pour rétrocompatibilité)
  proprete?: string;
  modernite?: string;
  eclairage?: string;
  presentation_produits?: string;
  experience_client?: string;

  // Optionnels (si utilisés ailleurs)
  score_qualite_retail?: number;
  score_etat_physique?: number;
}

interface Travaux {
  urgents?: string[];
  recommandes?: string[];
  optionnels?: string[];
}

interface BudgetTravaux {
  fourchette_basse?: number;
  fourchette_haute?: number;
  detail_postes?: Array<{
    categorie: string;
    montant_min: number;
    montant_max: number;
    priorite: string;
  }>;
}

interface PhotoData {
  analyzed?: boolean;

  // ✅ NOUVEAU: Classification et détection façade
  photo_classifications?: Array<{
    index: number;
    type: 'facade' | 'interieur' | 'detail' | 'non_classifiable';
  }>;
  facade_visible?: boolean;

  etat_general?: EtatGeneral;
  travaux?: Travaux;
  budget_travaux?: BudgetTravaux;
  points_forts?: string[];
  points_faibles?: string[];
  analyse_detaillee?: string;
}

interface PlacesData {
  photos?: any[];
}

/**
 * Génère une grille de photos avec filtrage qualité
 * @param photos - Array de photos depuis state.places.photos
 * @param photoClassifications - Classifications Gemini (NOUVEAU)
 * @returns HTML photo grid
 */
function generatePhotoGrid(photos: any[], photoClassifications?: any[]): string {
  if (!photos || photos.length === 0) {
    return '<p style="color: #666; font-style: italic;">Aucune photo disponible pour ce commerce.</p>';
  }

  // Filtrer photos de qualité (même logique que generatePhotosSection)
  const filteredPhotos = photos
    .filter((p: any) => p.url && p.widthPx && p.heightPx && p.widthPx >= 400 && p.heightPx >= 400)
    .slice(0, 8);  // Max 8 photos pour analyse

  if (filteredPhotos.length === 0) {
    return '<p style="color: #666; font-style: italic;">Photos de qualité insuffisante.</p>';
  }

  // Générer les cartes photo
  const photoCards = filteredPhotos.map((p: any, filterIndex: number) => {
    // Trouver l'index original de cette photo dans le tableau complet
    const originalIndex = (places?.photos || []).indexOf(p);

    // Chercher la classification correspondant à cet index original
    const classification = photoClassifications?.find(c => c.index === originalIndex);

    let badge = 'Non classé';
    let badgeColor = '#6b7280'; // Gris par défaut

    if (classification) {
      const type = classification.type;

      // ✅ NOUVEAU (2026-01-09): Gestion commerce_visible pour façades
      if (type === 'facade' && classification.commerce_visible === false) {
        badge = '⚠️ Rue (commerce non visible)';
        badgeColor = '#ef4444'; // Rouge pour attirer attention
      } else {
        switch (type) {
          case 'facade':
            badge = 'Façade';
            badgeColor = '#0066cc'; // Bleu
            break;
          case 'interieur':
            badge = 'Intérieur';
            badgeColor = '#10b981'; // Vert
            break;
          case 'detail':
            badge = 'Détail';
            badgeColor = '#f59e0b'; // Orange
            break;
          case 'non_classifiable':
            badge = 'Non classifiable';
            badgeColor = '#ef4444'; // Rouge
            break;
        }
      }
    }

    const photoId = `photo-${filterIndex}`;

    return `
      <div class="photo-card">
        <a href="#${photoId}" class="photo-link">
          <img src="${p.url}" alt="Photo du commerce ${filterIndex + 1}" loading="lazy" />
          <div class="photo-badge" style="background-color: ${badgeColor};">${badge}</div>
        </a>
      </div>

      <!-- ✅ NOUVEAU: Modal Lightbox (CSS pur) -->
      <div id="${photoId}" class="lightbox">
        <div class="lightbox-content">
          <a href="#" class="lightbox-close">&times;</a>
          <img src="${p.url}" alt="Photo du commerce ${filterIndex + 1}" class="lightbox-image" />
          <div class="lightbox-caption">
            Photo ${filterIndex + 1} - ${badge}
            ${classification?.visibility_details ? `<br/><small style="color: #999;">${classification.visibility_details}</small>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div style="margin: 20px 0;">
      <h3 style="font-size: 1.1em; color: #333; margin-bottom: 10px;">📷 Photos Analysées</h3>
      <div class="photo-grid">
        ${photoCards}
      </div>
      <p style="font-size: 0.9em; color: #666; margin-top: 10px; font-style: italic;">
        ${filteredPhotos.length} photo(s) analysée(s) par IA - Cliquez pour agrandir
      </p>
    </div>
  `;
}

/**
 * Generate simple interior analysis (3 boolean criteria)
 * ✅ NOUVEAU: Remplace section complexe 5 critères
 */
function generateSimpleInteriorAnalysis(etatGeneral: EtatGeneral): string {
  const propre = etatGeneral.propre;
  const lumineux = etatGeneral.lumineux;
  const range = etatGeneral.range;

  // Si nouveaux champs n'existent pas, ne rien afficher
  if (propre === undefined || lumineux === undefined || range === undefined) {
    return '';
  }

  const getIcon = (value: boolean) => value ? '✅' : '❌';
  const getColor = (value: boolean) => value ? '#10b981' : '#ef4444';
  const getLabel = (value: boolean) => value ? 'Oui' : 'Non';

  // Score simple (nombre de "oui" sur 3)
  const score = [propre, lumineux, range].filter(v => v).length;
  const scorePercent = Math.round((score / 3) * 100);

  let scoreColor = '#ef4444'; // Rouge
  if (scorePercent >= 67) scoreColor = '#10b981'; // Vert
  else if (scorePercent >= 33) scoreColor = '#f59e0b'; // Orange

  return `
    <h3>🏪 Analyse Intérieure Simplifiée</h3>
    <div style="background: #f8fafc; padding: 25px; border-radius: 8px; margin: 20px 0;">
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 20px;">

        <div style="text-align: center; padding: 20px; background: white; border-radius: 8px; border: 2px solid ${getColor(propre)};">
          <div style="font-size: 3em; margin-bottom: 10px;">${getIcon(propre)}</div>
          <div style="font-size: 1.2em; font-weight: bold; color: ${getColor(propre)};">${getLabel(propre)}</div>
          <div style="font-size: 0.9em; color: #666; margin-top: 5px;">Propre</div>
        </div>

        <div style="text-align: center; padding: 20px; background: white; border-radius: 8px; border: 2px solid ${getColor(lumineux)};">
          <div style="font-size: 3em; margin-bottom: 10px;">${getIcon(lumineux)}</div>
          <div style="font-size: 1.2em; font-weight: bold; color: ${getColor(lumineux)};">${getLabel(lumineux)}</div>
          <div style="font-size: 0.9em; color: #666; margin-top: 5px;">Lumineux</div>
        </div>

        <div style="text-align: center; padding: 20px; background: white; border-radius: 8px; border: 2px solid ${getColor(range)};">
          <div style="font-size: 3em; margin-bottom: 10px;">${getIcon(range)}</div>
          <div style="font-size: 1.2em; font-weight: bold; color: ${getColor(range)};">${getLabel(range)}</div>
          <div style="font-size: 0.9em; color: #666; margin-top: 5px;">Rangé</div>
        </div>

      </div>

      <div style="text-align: center; padding: 20px; background: ${scoreColor}; color: white; border-radius: 8px; font-size: 1.5em; font-weight: bold;">
        Score Intérieur: ${score}/3 (${scorePercent}%)
      </div>
    </div>
  `;
}

/**
 * Generate state details table
 */
function generateStateDetailsTable(etatGeneral: EtatGeneral): string {
  const aspects = [
    { label: 'Devanture', value: etatGeneral.devanture || 'N/A' },
    { label: 'Intérieur', value: etatGeneral.interieur || 'N/A' },
    { label: 'Équipement', value: etatGeneral.equipement || 'N/A' },
    { label: 'Propreté', value: etatGeneral.proprete || 'N/A' },
    { label: 'Modernité', value: etatGeneral.modernite || 'N/A' },
    { label: 'Éclairage', value: etatGeneral.eclairage || 'N/A' },
    { label: 'Présentation Produits', value: etatGeneral.presentation_produits || 'N/A' },
    { label: 'Expérience Client', value: etatGeneral.experience_client || 'N/A' }
  ];

  const getScoreClass = (value: string): string => {
    const lower = value.toLowerCase();
    if (lower.includes('excellent') || lower.includes('bon')) return 'success';
    if (lower.includes('mauvais') || lower.includes('très mauvais')) return 'error';
    return 'warning';
  };

  return `
    <h3>📊 État Détaillé du Commerce</h3>
    <table class="state-table">
      <thead>
        <tr>
          <th>Aspect</th>
          <th>Évaluation</th>
        </tr>
      </thead>
      <tbody>
        ${aspects.map(aspect => `
          <tr>
            <td><strong>${aspect.label}</strong></td>
            <td><span class="badge ${getScoreClass(aspect.value)}">${aspect.value}</span></td>
          </tr>
        `).join('')}
        <tr class="highlight-row">
          <td><strong>Note Globale</strong></td>
          <td><strong>${(etatGeneral.note_globale || 0).toFixed(1)} / 10</strong></td>
        </tr>
      </tbody>
    </table>
  `;
}

/**
 * Generate dual score display (Amélioration 5)
 */
export function generateDualScoreDisplay(etatGeneral: EtatGeneral): string {
  const retail = etatGeneral.score_qualite_retail || etatGeneral.note_globale || 0;
  const physical = etatGeneral.score_etat_physique || etatGeneral.note_globale || 0;

  const getInterpretation = (r: number, p: number): string => {
    if (r >= 8 && p >= 8) return 'Excellent général - Prêt à exploiter';
    if (r >= 7 && p < 6) return 'Bon commerce, travaux de rénovation nécessaires sur le bâtiment';
    if (r < 6 && p >= 7) return 'Bon bâtiment, merchandising à moderniser pour améliorer l\'expérience client';
    if (r < 5 || p < 5) return 'Investissements importants nécessaires';
    return 'État correct, améliorations possibles';
  };

  // Only show dual scores if they exist and are different
  if (etatGeneral.score_qualite_retail && etatGeneral.score_etat_physique) {
    return `
      <h3>🎯 Analyse en Deux Dimensions</h3>
      <div class="dual-score-display">
        <div class="score-card-large retail">
          <div class="icon">🛍️</div>
          <div class="score">${retail.toFixed(1)}/10</div>
          <div class="label">Qualité Retail</div>
          <div class="description">Merchandising, présentation, modernité</div>
        </div>

        <div class="score-card-large physical">
          <div class="icon">🏗️</div>
          <div class="score">${physical.toFixed(1)}/10</div>
          <div class="label">État Physique</div>
          <div class="description">Fixtures, propreté, usure du bâtiment</div>
        </div>
      </div>

      <div class="interpretation-box">
        💡 ${getInterpretation(retail, physical)}
      </div>
    `;
  }

  return '';
}

/**
 * Generate work lists section
 */
function generateWorkListsSection(travaux: Travaux): string {
  const urgents = travaux.urgents || [];
  const recommandes = travaux.recommandes || [];
  const optionnels = travaux.optionnels || [];

  return `
    <h3>🔧 Travaux à Réaliser</h3>
    <div class="work-lists-container">
      <div class="work-list-column">
        <h4 class="urgent-header">🔴 Travaux Urgents</h4>
        ${urgents.length > 0
          ? `<ul class="work-list urgent">${urgents.map(t => `<li>${t}</li>`).join('')}</ul>`
          : '<p class="no-data">Aucun travail urgent</p>'}
      </div>

      <div class="work-list-column">
        <h4 class="recommended-header">🟠 Travaux Recommandés</h4>
        ${recommandes.length > 0
          ? `<ul class="work-list recommended">${recommandes.map(t => `<li>${t}</li>`).join('')}</ul>`
          : '<p class="no-data">Aucun travail recommandé</p>'}
      </div>

      <div class="work-list-column">
        <h4 class="optional-header">🟢 Travaux Optionnels</h4>
        ${optionnels.length > 0
          ? `<ul class="work-list optional">${optionnels.map(t => `<li>${t}</li>`).join('')}</ul>`
          : '<p class="no-data">Aucun travail optionnel</p>'}
      </div>
    </div>
  `;
}

/**
 * Generate budget breakdown table
 */
function generateBudgetBreakdownTable(budgetTravaux: BudgetTravaux): string {
  const detailPostes = budgetTravaux.detail_postes || [];
  const fourchetteBasse = budgetTravaux.fourchette_basse || 0;
  const fourchetteHaute = budgetTravaux.fourchette_haute || 0;

  if (fourchetteBasse === 0 && fourchetteHaute === 0) {
    return '';
  }

  const getPriorityBadge = (priorite: string): string => {
    const lower = priorite.toLowerCase();
    if (lower.includes('urgente') || lower.includes('élevée')) return 'error';
    if (lower.includes('moyenne')) return 'warning';
    return 'info';
  };

  return `
    <h3>💰 Budget Travaux Estimé</h3>

    ${detailPostes.length > 0 ? `
      <table class="budget-table">
        <thead>
          <tr>
            <th>Catégorie</th>
            <th>Min (€)</th>
            <th>Max (€)</th>
            <th>Priorité</th>
          </tr>
        </thead>
        <tbody>
          ${detailPostes.map(poste => `
            <tr>
              <td>${poste.categorie}</td>
              <td>${poste.montant_min.toLocaleString('fr-FR')} €</td>
              <td>${poste.montant_max.toLocaleString('fr-FR')} €</td>
              <td><span class="badge ${getPriorityBadge(poste.priorite)}">${poste.priorite}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : ''}

    <div class="budget-summary">
      Fourchette Totale: <strong>${fourchetteBasse.toLocaleString('fr-FR')} € - ${fourchetteHaute.toLocaleString('fr-FR')} €</strong>
    </div>
  `;
}

/**
 * Generate points forts/faibles section
 */
function generatePointsFortsFaibles(pointsForts: string[], pointsFaibles: string[]): string {
  return `
    <h3>⚖️ Points Forts & Points Faibles</h3>
    <div class="points-grid">
      <div class="points-column">
        <h4 class="success-header">✅ Points Forts</h4>
        ${pointsForts.length > 0
          ? `<ul class="points-list success">${pointsForts.map(p => `<li>${p}</li>`).join('')}</ul>`
          : '<p class="no-data">Aucun point fort identifié</p>'}
      </div>

      <div class="points-column">
        <h4 class="error-header">⚠️ Points Faibles</h4>
        ${pointsFaibles.length > 0
          ? `<ul class="points-list error">${pointsFaibles.map(p => `<li>${p}</li>`).join('')}</ul>`
          : '<p class="no-data">Aucun point faible identifié</p>'}
      </div>
    </div>
  `;
}

/**
 * Generate photo analysis section (main export)
 */
export function generatePhotoAnalysisSection(places: PlacesData, photo: PhotoData): string {
  if (!photo || !photo.analyzed) {
    return `
      <h2>📸 Analyse Photographique Détaillée</h2>
      <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107;">
        <p><strong>⚠️ Analyse photographique non disponible</strong></p>
        <p style="margin: 10px 0 0 0; color: #666;">
          ${!places?.photos || places.photos.length === 0
            ? 'Aucune photo n\'a été trouvée pour ce commerce.'
            : 'L\'analyse des photos a échoué.'}
        </p>
      </div>
    `;
  }

  // FIX: Check visibility flags for warning messages
  const facadeVisible = photo?.facade_visible !== false;
  const interiorVisible = photo?.interior_visible !== false;

  const etatGeneral = photo.etat_general || {};
  const travaux = photo.travaux || {};
  const budgetTravaux = photo.budget_travaux || {};
  const pointsForts = photo.points_forts || [];
  const pointsFaibles = photo.points_faibles || [];
  const analyseDetaillee = photo.analyse_detaillee || '';
  const photoClassifications = photo.photo_classifications || [];
  // FIX: Use the flags set by analyzePhotosTool post-processing
  // Note: facadeVisible already defined above at line 429

  return `
    <h2>📸 Analyse Photographique Détaillée</h2>

    <!-- FIX: Warnings for missing photos -->
    ${!facadeVisible ? `
      <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin-bottom: 20px;">
        <p><strong>⚠️ Aucune photo de façade analysée</strong></p>
        <p style="margin: 10px 0 0 0; color: #666;">
          L'analyse porte uniquement sur l'intérieur. L'état de la devanture n'a pas pu être évalué.
        </p>
      </div>
    ` : ''}

    ${!interiorVisible ? `
      <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin-bottom: 20px;">
        <p><strong>⚠️ Aucune photo intérieure analysée</strong></p>
        <p style="margin: 10px 0 0 0; color: #666;">
          L'analyse porte uniquement sur l'extérieur. L'agencement intérieur n'a pas pu être évalué.
        </p>
      </div>
    ` : ''}

    <!-- Grille photos AVEC classification Gemini -->
    ${generatePhotoGrid(places?.photos || [], photoClassifications)}

    <div style="margin-top: 30px;">
      <!-- ❌ SUPPRIMÉ: generateStateDetailsTable(etatGeneral) -->
      <!-- ❌ SUPPRIMÉ: generateDualScoreDisplay(etatGeneral) -->

      <!-- ✅ NOUVEAU: Section simple -->
      ${generateSimpleInteriorAnalysis(etatGeneral)}

      ${generateWorkListsSection(travaux)}

      ${generateBudgetBreakdownTable(budgetTravaux)}

      ${generatePointsFortsFaibles(pointsForts, pointsFaibles)}

      ${analyseDetaillee ? `
        <h3>📝 Analyse Détaillée</h3>
        <div class="analysis-text">
          ${analyseDetaillee}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Extraction Logger (JavaScript version for server.js)
 *
 * Logger dédié pour visualiser toutes les données extraites des documents
 * et commentaires utilisateurs dans le pipeline financier.
 *
 * Fichier de log: logs/extraction_YYYYMMDD_HHMMSS_SIRET.log (un fichier par analyse)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setSessionLogFile, getSessionLogFile, hasSession, removeSession } from './extractionSessionStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Start a new extraction session for a SIRET
 * Creates a unique log file with timestamp
 */
export function startExtractionSession(siret) {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '_')
    .slice(0, 15); // YYYYMMDD_HHMMSS

  const logsDir = path.join(__dirname, '..', 'logs');

  // Ensure logs directory exists
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const logFilePath = path.join(logsDir, `extraction_${timestamp}_${siret}.log`);
  setSessionLogFile(siret, logFilePath);

  // Write session header
  const header = `
${'═'.repeat(80)}
  📊 EXTRACTION SESSION STARTED
${'─'.repeat(80)}
  🏢 SIRET:     ${siret}
  ⏰ Started:   ${now.toISOString()}
  📁 Log file:  ${path.basename(logFilePath)}
${'═'.repeat(80)}
`;
  fs.writeFileSync(logFilePath, header, 'utf8');
  console.log(`[ExtractionLogger] Session started: ${path.basename(logFilePath)}`);

  return logFilePath;
}

/**
 * End the extraction session for a SIRET
 */
export function endExtractionSession(siret) {
  const logFilePath = getSessionLogFile(siret);
  if (logFilePath) {
    const footer = `
${'═'.repeat(80)}
  ✅ EXTRACTION SESSION COMPLETED
  ⏰ Ended: ${new Date().toISOString()}
${'═'.repeat(80)}
`;
    fs.appendFileSync(logFilePath, footer, 'utf8');
    removeSession(siret);
  }
}

/**
 * Get log file path for a SIRET (creates session if not exists)
 */
function getLogFilePath(siret) {
  if (siret && hasSession(siret)) {
    return getSessionLogFile(siret);
  }

  // Fallback: create a new session or use default
  if (siret) {
    return startExtractionSession(siret);
  }

  // Legacy fallback for calls without SIRET
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const logsDir = path.join(__dirname, '..', 'logs');

  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  return path.join(logsDir, `extraction_${today}.log`);
}

// Format a value for display
function formatValue(value, indent = 0) {
  const prefix = '  '.repeat(indent);

  if (value === null || value === undefined) {
    return `${prefix}null`;
  }

  if (typeof value === 'number') {
    return value.toLocaleString('fr-FR');
  }

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return value.map(v => formatValue(v, 0)).join(', ');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

// Format data section with nice alignment
function formatDataSection(data, maxKeyLength = 40) {
  const lines = [];

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;

    const paddedKey = key.padEnd(maxKeyLength);

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      lines.push(`    ${paddedKey}:`);
      for (const [subKey, subValue] of Object.entries(value)) {
        if (subValue === undefined) continue;
        const paddedSubKey = `  └─ ${subKey}`.padEnd(maxKeyLength + 4);
        lines.push(`    ${paddedSubKey}: ${formatValue(subValue)}`);
      }
    } else {
      lines.push(`    ${paddedKey}: ${formatValue(value)}`);
    }
  }

  return lines.join('\n');
}

/**
 * Log user comments to dedicated extraction log file
 */
export function logUserComments(siret, userComments) {
  if (!userComments || Object.keys(userComments).length === 0) {
    return;
  }

  const timestamp = new Date().toISOString();
  const logPath = getLogFilePath(siret);

  const separator = '═'.repeat(80);
  const subSeparator = '─'.repeat(80);

  let message = `\n${separator}\n`;
  message += `  📊 EXTRACTION LOG - USER_COMMENT\n`;
  message += `${subSeparator}\n`;
  message += `  ⏰ Timestamp: ${timestamp}\n`;
  message += `  📁 Source:    frontend\n`;
  message += `  🏢 SIRET:     ${siret}\n`;
  message += `${subSeparator}\n`;
  message += `  📈 Données Extraites:\n`;

  const data = {};

  // Loyer
  if (userComments.loyer) {
    data['──────────────── LOYER'] = '';
    data.loyer_actuel_mensuel = userComments.loyer.loyer_actuel_mensuel;
    data.futur_loyer_commercial = userComments.loyer.futur_loyer_commercial;
    data.loyer_logement_perso = userComments.loyer.loyer_logement_perso;
    data.loyer_commentaire = userComments.loyer.commentaire;
  }

  // Travaux
  if (userComments.travaux) {
    data['──────────────── TRAVAUX'] = '';
    data.travaux_budget_prevu = userComments.travaux.budget_prevu;
    data.travaux_commentaire = userComments.travaux.commentaire;
  }

  // Budget travaux (autre format)
  if (userComments.budget_travaux) {
    data['──────────────── BUDGET TRAVAUX'] = '';
    data.budget_travaux = userComments.budget_travaux;
  }

  // Conditions de vente
  if (userComments.conditions_vente) {
    data['──────────────── CONDITIONS DE VENTE'] = '';
    data.negociation_possible = userComments.conditions_vente.negociation_possible;
    data.conditions_commentaire = userComments.conditions_vente.commentaire;
  }

  // Salaire dirigeant
  if (userComments.salaire_dirigeant) {
    data['──────────────── RÉMUNÉRATION'] = '';
    data.salaire_dirigeant = userComments.salaire_dirigeant;
  }

  // Salariés (ancien format)
  if (userComments.salaries_non_repris) {
    data['──────────────── SALARIÉS NON REPRIS'] = '';
    data.salaries_non_repris_nombre = userComments.salaries_non_repris.nombre;
    data.salaries_non_repris_masse = userComments.salaries_non_repris.masse_salariale_annuelle;
    data.salaries_non_repris_motif = userComments.salaries_non_repris.motif;
  }

  if (userComments.salaires_saisonniers_prevus) {
    data['──────────────── SALAIRES SAISONNIERS'] = '';
    data.salaires_saisonniers_prevus = userComments.salaires_saisonniers_prevus;
  }

  // Salaires (nouveau format - extrait du texte libre)
  if (userComments.salaires) {
    data['──────────────── SALAIRES PRÉVUS'] = '';
    if (userComments.salaires.tns_mensuel) {
      data.tns_mensuel = userComments.salaires.tns_mensuel;
    }
    if (userComments.salaires.liste && userComments.salaires.liste.length > 0) {
      data.salaries_liste = userComments.salaires.liste.map((s, i) =>
        `${i + 1}. ${s.montant.toLocaleString('fr-FR')} €/mois${s.saisonnier ? ' (saisonnier)' : ''}`
      ).join(' | ');
    }
  }

  // Apport personnel
  if (userComments.apport_personnel) {
    data['──────────────── FINANCEMENT'] = '';
    data.apport_personnel = userComments.apport_personnel;
  }

  // Extension horaires
  if (userComments.horaires_extension) {
    data['──────────────── HORAIRES'] = '';
    data.horaires_extension = userComments.horaires_extension;
  }

  // Autres commentaires
  if (userComments.autres) {
    data['──────────────── AUTRES'] = '';
    data.commentaires_libres = userComments.autres;
  }

  message += formatDataSection(data);
  message += `\n${separator}\n`;

  // Write to file
  fs.appendFileSync(logPath, message, 'utf8');

  console.log(`[ExtractionLogger] USER_COMMENT logged for ${siret}`);
}

/**
 * Log transaction costs extraction
 */
export function logTransactionCosts(siret, costs) {
  const timestamp = new Date().toISOString();
  const logPath = getLogFilePath(siret);

  const separator = '═'.repeat(80);
  const subSeparator = '─'.repeat(80);

  let message = `\n${separator}\n`;
  message += `  📊 EXTRACTION LOG - TRANSACTION_COSTS\n`;
  message += `${subSeparator}\n`;
  message += `  ⏰ Timestamp: ${timestamp}\n`;
  message += `  📁 Source:    cout_transaction_document\n`;
  message += `  🏢 SIRET:     ${siret}\n`;
  message += `${subSeparator}\n`;
  message += `  📈 Données Extraites:\n`;

  const data = {
    prix_fonds: costs.prix_fonds ? `${costs.prix_fonds.toLocaleString('fr-FR')} €` : 'N/A',
    honoraires_ht: costs.honoraires_ht ? `${costs.honoraires_ht.toLocaleString('fr-FR')} €` : 'N/A',
    frais_acte_ht: costs.frais_acte_ht ? `${costs.frais_acte_ht.toLocaleString('fr-FR')} €` : 'N/A',
    stock_fonds_roulement: costs.stock_fonds_roulement ? `${costs.stock_fonds_roulement.toLocaleString('fr-FR')} €` : 'N/A',
    total_investissement: costs.total_investissement ? `${costs.total_investissement.toLocaleString('fr-FR')} €` : 'N/A',
    apport_requis: costs.apport_requis ? `${costs.apport_requis.toLocaleString('fr-FR')} €` : 'N/A',
    credit_sollicite: costs.credit_sollicite ? `${costs.credit_sollicite.toLocaleString('fr-FR')} €` : 'N/A'
  };

  message += formatDataSection(data);
  message += `\n${separator}\n`;

  fs.appendFileSync(logPath, message, 'utf8');

  console.log(`[ExtractionLogger] TRANSACTION_COSTS logged for ${siret}`);
}

export default {
  startExtractionSession,
  endExtractionSession,
  logUserComments,
  logTransactionCosts
};

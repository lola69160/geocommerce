/**
 * Shared Extraction Session Store
 *
 * This module provides a shared session store for extraction logging.
 * Both JS (server.js) and TS (ADK agents) loggers use this store
 * to ensure all logs go to the same file per analysis.
 */

// Session storage: siret -> log file path
const sessionLogFiles = new Map();

// Logged entries tracking: "siret:category:source:year" -> true
const loggedEntries = new Map();

/**
 * Set the log file path for a SIRET
 */
export function setSessionLogFile(siret, logFilePath) {
  sessionLogFiles.set(siret, logFilePath);
  // Clear logged entries for this session
  for (const key of loggedEntries.keys()) {
    if (key.startsWith(`${siret}:`)) {
      loggedEntries.delete(key);
    }
  }
}

/**
 * Check if an entry has already been logged (to prevent duplicates)
 */
export function hasBeenLogged(siret, category, source, year = '') {
  const key = `${siret}:${category}:${source}:${year}`;
  return loggedEntries.has(key);
}

/**
 * Mark an entry as logged
 */
export function markAsLogged(siret, category, source, year = '') {
  const key = `${siret}:${category}:${source}:${year}`;
  loggedEntries.set(key, true);
}

/**
 * Get the log file path for a SIRET
 */
export function getSessionLogFile(siret) {
  return sessionLogFiles.get(siret);
}

/**
 * Check if a session exists for a SIRET
 */
export function hasSession(siret) {
  return sessionLogFiles.has(siret);
}

/**
 * Remove a session for a SIRET
 */
export function removeSession(siret) {
  sessionLogFiles.delete(siret);
}

/**
 * Get all active sessions
 */
export function getAllSessions() {
  return new Map(sessionLogFiles);
}

export default {
  setSessionLogFile,
  getSessionLogFile,
  hasSession,
  removeSession,
  getAllSessions,
  hasBeenLogged,
  markAsLogged
};

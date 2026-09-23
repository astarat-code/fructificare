// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * recentFiles.js — list of recently opened/exported backup files (desktop).
 *
 * Lets the user switch quickly between several portfolio projects through the
 * "File › Recent files" menu. Stores PATHS only, never content.
 *
 * WHY THE FULL PATH IS KEPT, BUT NOT DISPLAYED
 * An absolute path contains the Windows session name and the personal folder tree
 * ("C:\\Users\\firstname.lastname\\Documents\\Portfolio\\…"). It is not a secret, but it
 * is free information: it would show up on the slightest screenshot, and would tell anyone
 * able to read localStorage where to look.
 *
 * So the path is kept — it is the dialog's starting point when the user reopens the file —
 * but the interface only shows the file name and its parent folder. `clearRecentFiles()`
 * clears the list at any time.
 */

const KEY = 'fructificare_recent_files';
const MAX = 8;

function _basename(path) {
  return String(path || '').split(/[\\/]/).pop() || String(path || '');
}

/** Nom du dossier parent, sans son chemin d'accès. */
function _parentFolder(path) {
  const parts = String(path || '').split(/[\\/]/).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : '';
}

/**
 * @returns {Array<{ path:string, name:string, folder:string, ts:number }>}
 *          du plus récent au plus ancien.
 */
export function getRecentFiles() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    // `folder` est apparu après coup : on le recalcule pour les entrées existantes.
    return list
      .filter((e) => e && e.path)
      .map((e) => ({
        ...e,
        name: e.name || _basename(e.path),
        folder: e.folder ?? _parentFolder(e.path),
      }));
  } catch {
    return [];
  }
}

/** Ajoute (ou remonte en tête) un chemin ; dédoublonne, plafonne à MAX. */
export function addRecentFile(path) {
  if (!path) return getRecentFiles();
  const norm = String(path).toLowerCase();
  const next = [
    { path, name: _basename(path), folder: _parentFolder(path), ts: Date.now() },
    ...getRecentFiles().filter((e) => String(e.path).toLowerCase() !== norm),
  ].slice(0, MAX);
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  return next;
}

/** Retire un chemin de la liste (ex. fichier introuvable). */
export function removeRecentFile(path) {
  const norm = String(path || '').toLowerCase();
  const next = getRecentFiles().filter((e) => String(e.path).toLowerCase() !== norm);
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  return next;
}

/** Efface toute la liste — et avec elle les chemins mémorisés. */
export function clearRecentFiles() {
  try { localStorage.removeItem(KEY); } catch {}
  return [];
}

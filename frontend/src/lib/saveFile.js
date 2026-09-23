// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * saveFile.js — Saves a generated file (PDF, log…) to a location chosen by the user, then
 * opens it.
 *
 *  • Tauri (desktop): "Save as…" dialog → write to disk → open with the system application.
 *  • Browser (dev): ordinary download through a blob.
 */

function isTauri() {
  return typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;
}

/**
 * @param {object} p
 * @param {string|Uint8Array} p.data — contenu texte, ou binaire (PDF…)
 * @param {string} p.defaultPath — nom de fichier proposé (ex. "rapport.pdf")
 * @param {Array<{name:string,extensions:string[]}>} [p.filters]
 * @param {boolean} [p.open=true] — ouvrir le fichier après l'avoir enregistré (Tauri)
 * @param {string} [p.mime] — type MIME pour le repli navigateur
 * @returns {Promise<{ ok:boolean, cancelled?:boolean, path?:string, browserDownload?:boolean }>}
 */
export async function saveFileWithDialog({ data, defaultPath, filters, open = true, mime }) {
  if (isTauri()) {
    const [{ save }, fs, opener] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-fs'),
      import('@tauri-apps/plugin-opener'),
    ]);
    const path = await save({ defaultPath, filters });
    if (!path) return { ok: false, cancelled: true };
    if (typeof data === 'string') await fs.writeTextFile(path, data);
    else await fs.writeFile(path, data);
    // Ouverture avec l'application par défaut (openPath gère les chemins locaux, PDF inclus).
    if (open) { try { await opener.openPath(path); } catch (_) { /* ouverture best-effort */ } }
    return { ok: true, path };
  }
  // Navigateur : téléchargement
  const blob = (data instanceof Uint8Array)
    ? new Blob([data], { type: mime || 'application/octet-stream' })
    : new Blob([data], { type: mime || 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = String(defaultPath || 'fichier').split(/[\\/]/).pop();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return { ok: true, browserDownload: true };
}

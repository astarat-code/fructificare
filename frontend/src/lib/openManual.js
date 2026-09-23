// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * openManual.js — Opens the user manual, embedded in the application.
 *
 * WHY LOCAL: the manual used to be a link to a website. It was Fructificare's last network
 * request, and above all an external point of trust — should the domain ever expire,
 * whoever bought it would serve the page of their choice to every user of every version
 * already distributed, with the credibility of a link coming from the application. The PDF
 * therefore travels with the binary.
 *
 * HOW: the PDF is an asset of the frontend bundle, served by Tauri's internal protocol. It
 * is copied once into the application folder, then handed to the system PDF reader — the
 * webview has no usable viewer, and navigating to the PDF would replace the application
 * with the document.
 *
 * LANGUAGE: the manual exists in French and English; the one matching the display language
 * chosen in the application is opened.
 */

const MANUAL_DIR = 'manuel';
const MANUAL_FILES = { fr: 'Fructificare-Manuel.pdf', en: 'Fructificare-Manual.pdf' };

function isTauri() {
  return typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;
}

/**
 * @param {'fr'|'en'} lang  langue d'affichage de l'application
 * @returns {Promise<{ ok: boolean, reason?: string, path?: string }>}
 */
export async function openManual(lang = 'fr') {
  const MANUAL_FILE = MANUAL_FILES[lang] || MANUAL_FILES.fr;
  const MANUAL_ASSET = `/${MANUAL_DIR}/${MANUAL_FILE}`;
  if (!isTauri()) {
    // Mode navigateur (développement) : le PDF s'ouvre dans un onglet.
    window.open(MANUAL_ASSET, '_blank', 'noopener,noreferrer');
    return { ok: true };
  }

  try {
    const [fs, { appDataDir, join }, { openPath }] = await Promise.all([
      import('@tauri-apps/plugin-fs'),
      import('@tauri-apps/api/path'),
      import('@tauri-apps/plugin-opener'),
    ]);

    // Requête vers le bundle local, autorisée par « connect-src 'self' ».
    const response = await fetch(MANUAL_ASSET);
    if (!response.ok) return { ok: false, reason: 'asset_missing' };
    const bytes = new Uint8Array(await response.arrayBuffer());

    const dir = await join(await appDataDir(), MANUAL_DIR);
    try { await fs.mkdir(dir, { recursive: true }); } catch (_) { /* déjà présent */ }
    const dest = await join(dir, MANUAL_FILE);

    // Réécrit si la copie sur disque diffère de l'asset embarqué, à l'octet près.
    // Comparer les seules TAILLES (B-08) laissait passer un PDF différent de même taille
    // déposé à la place de la copie : « Aide » l'aurait alors ouvert dans le lecteur PDF.
    // L'asset qui voyage dans le binaire fait foi ; toute divergence est réécrasée.
    let upToDate = false;
    try {
      const existing = await fs.readFile(dest);
      upToDate = existing.byteLength === bytes.byteLength
        && existing.every((octet, i) => octet === bytes[i]);
    } catch (_) { /* absent ou illisible : on réécrit */ }
    if (!upToDate) await fs.writeFile(dest, bytes);

    await openPath(dest);
    return { ok: true, path: dest };
  } catch (e) {
    return { ok: false, reason: 'open_error', error: String(e?.message ?? e) };
  }
}

export default openManual;

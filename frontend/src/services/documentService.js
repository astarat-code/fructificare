// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * documentService.js — Handling of financial documents (PDF) on disk.
 *
 * PHILOSOPHY: local-only, like the rest of Fructificare.
 *   • Tauri (desktop): PDFs are copied into [appDataDir]/documents imp/… and opened with
 *     the system PDF reader. This is the fully functional mode.
 *   • Browser (dev): no arbitrary disk access → the chosen file is kept in memory for the
 *     session; "Open" triggers a download. The UI shows a "native opening available in the
 *     desktop version" notice.
 *
 * On-disk layout (Tauri):
 *   [appDataDir]/
 *     save/                  ← managed by storageService
 *     documents imp/         ← a neutral name, identical in French and English
 *       global/              ← documents not tied to an envelope
 *       [envelopeSlug]/      ← one subfolder per envelope
 *         YYYY-MM-DD_name.pdf
 *
 * Only the metadata + the relative path are persisted in the JSON (never the PDF).
 */

// « imp » = importés / imported : le nom du dossier ne dépend pas de la langue d'affichage.
const ROOT_FOLDER = 'documents imp';
// Ancien nom, encore accepté en lecture le temps que migrateDocumentFolders() déplace
// les fichiers vers ROOT_FOLDER.
const LEGACY_ROOT_FOLDER = 'documents importés';

// Blobs conservés en mémoire pour la session en mode navigateur (clé = id du document).
const _browserBlobs = new Map();

function isTauri() {
  // `__TAURI_INTERNALS__` est injecté par la webview Tauri v2 dans tous les cas.
  return typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;
}

/** Génère un identifiant de document unique. */
function genDocumentId() {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Résolution des APIs Tauri ────────────────────────────────────────────────────
async function _getTauri() {
  // Le try/catch rend ces import() OPTIONNELS pour le bundler web (émis en simple
  // avertissement « Module not found » au lieu d'échouer le build), résolus au runtime
  // uniquement dans l'application bureau — même stratégie que storageService.
  try {
    const [fs, pathApi, dialog] = await Promise.all([
      import('@tauri-apps/plugin-fs'),
      import('@tauri-apps/api/path'),
      import('@tauri-apps/plugin-dialog'),
    ]);
    return {
      appDataDir: pathApi.appDataDir,
      join:       pathApi.join,
      mkdir:      (p) => fs.mkdir(p, { recursive: true }),
      copyFile:   (s, d) => fs.copyFile(s, d),
      exists:     (p) => fs.exists(p),
      remove:     (p) => fs.remove(p),
      pickPdf:    () => dialog.open({ multiple: false, filters: [{ name: 'PDF', extensions: ['pdf'] }] }),
    };
  } catch {
    throw new Error('APIs Tauri (documents) introuvables.');
  }
}

// ── Helpers chemins ──────────────────────────────────────────────────────────────
function _basename(path) {
  return String(path || '').split(/[\\/]/).pop() || '';
}
function _stripPdfExt(name) {
  return String(name || '').replace(/\.pdf$/i, '');
}
// Un rel_path valide vaut exactement « <ROOT_FOLDER>/<slug>/<fichier>.pdf », où le slug et
// le nom de fichier sont produits par dataService.slugify() — donc sans séparateur ni « .. ».
const _SEGMENT_RE = /^[A-Za-z0-9][A-Za-z0-9._ -]*$/;

/**
 * Valide un rel_path lu depuis la sauvegarde et renvoie ses trois segments.
 *
 * SÉCURITÉ : rel_path provient d'un fichier JSON que l'utilisateur a pu recevoir d'un tiers.
 * Sans ce contrôle, des segments « .. » permettraient de sortir du dossier de l'application
 * (path.join normalise les remontées) et donc d'ouvrir — openPath = ShellExecute, qui EXÉCUTE
 * un .exe/.bat/.lnk —, de supprimer ou de recopier un fichier arbitraire du profil utilisateur.
 *
 * @throws {Error} si le chemin ne correspond pas exactement à la forme attendue.
 */
function _relPathSegments(relPath) {
  const parts = String(relPath || '').split('/').filter(Boolean);
  // parts[0] est comparé à l'identique (l'ancienne racine contient un accent, hors du jeu
  // de caractères autorisé) ; seuls le slug et le nom de fichier passent par _SEGMENT_RE.
  const valid =
    parts.length === 3 &&
    (parts[0] === ROOT_FOLDER || parts[0] === LEGACY_ROOT_FOLDER) &&
    _SEGMENT_RE.test(parts[1]) &&
    _SEGMENT_RE.test(parts[2]) &&
    /\.pdf$/i.test(parts[2]);
  if (!valid) throw new Error(`Chemin de document invalide : ${relPath}`);
  return parts;
}

/** Reconstruit le chemin absolu d'un document depuis son rel_path, après validation. */
async function _absPath(api, dataDir, relPath) {
  return api.join(dataDir, ..._relPathSegments(relPath));
}

// ── API publique ─────────────────────────────────────────────────────────────────

/**
 * Ouvre un sélecteur de fichier filtré sur les PDF.
 * @returns {Promise<null | { source, baseName, originalFilename }>}
 *   source = { kind:'tauri', path } ou { kind:'browser', file }
 */
async function pickPdf() {
  if (isTauri()) {
    const api = await _getTauri();
    const selected = await api.pickPdf();
    if (!selected) return null; // annulé
    const path = Array.isArray(selected) ? selected[0] : selected;
    const fname = _basename(path);
    return { source: { kind: 'tauri', path }, baseName: _stripPdfExt(fname), originalFilename: fname };
  }
  // Navigateur : input caché
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,.pdf';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return resolve(null);
      resolve({ source: { kind: 'browser', file }, baseName: _stripPdfExt(file.name), originalFilename: file.name });
    };
    input.click();
  });
}

/**
 * Copie le PDF choisi dans documents/[slug]/[filename].
 * @returns {Promise<{ relPath:string, persisted:boolean }>}
 */
async function saveDocument({ id, slug, filename, source }) {
  const relPath = `${ROOT_FOLDER}/${slug}/${filename}`;
  _relPathSegments(relPath); // garde-fou : refuse tout slug/nom de fichier non conforme
  if (!source || source.kind === 'browser') {
    if (source?.file) _browserBlobs.set(id, source.file);
    return { relPath, persisted: false };
  }
  const api = await _getTauri();
  const dataDir = await api.appDataDir();
  const dir = await api.join(dataDir, ROOT_FOLDER, slug);
  try { await api.mkdir(dir); } catch (_) { /* déjà présent */ }
  const dest = await api.join(dir, filename);
  await api.copyFile(source.path, dest);
  return { relPath, persisted: true };
}

/** Chemin absolu attendu d'un document (pour l'affichage « Fichier introuvable »). */
async function getExpectedPath(doc) {
  if (!isTauri()) return doc.rel_path;
  try {
    const api = await _getTauri();
    const dataDir = await api.appDataDir();
    return _absPath(api, dataDir, doc.rel_path);
  } catch {
    return doc.rel_path;
  }
}

/** Indique si le fichier du document existe réellement. */
async function documentExists(doc) {
  if (!isTauri()) return _browserBlobs.has(doc.id);
  try {
    const api = await _getTauri();
    const dataDir = await api.appDataDir();
    const abs = await _absPath(api, dataDir, doc.rel_path);
    return await api.exists(abs);
  } catch {
    return false;
  }
}

/**
 * Ouvre le document avec le lecteur système (Tauri) ou le télécharge (navigateur).
 * @returns {Promise<{ ok:boolean, reason?:string, path?:string, browserDownload?:boolean }>}
 */
async function openDocument(doc) {
  if (isTauri()) {
    const api = await _getTauri();
    const dataDir = await api.appDataDir();
    let abs;
    try {
      abs = await _absPath(api, dataDir, doc.rel_path);
    } catch (_) {
      return { ok: false, reason: 'invalid_path', path: doc.rel_path };
    }
    const exists = await api.exists(abs).catch(() => false);
    if (!exists) return { ok: false, reason: 'not_found', path: abs };
    // Ouverture avec l'application PDF système via le plugin `opener` (shell.open ne
    // valide que les URL http/mailto/tel en v2, pas les chemins de fichiers locaux).
    try {
      const { openPath } = await import('@tauri-apps/plugin-opener');
      await openPath(abs);
      return { ok: true, path: abs };
    } catch (e) {
      return { ok: false, reason: 'open_error', path: abs, error: String(e && e.message ? e.message : e) };
    }
  }
  // Navigateur : téléchargement du blob mémorisé (repli)
  const file = _browserBlobs.get(doc.id);
  if (!file) return { ok: false, reason: 'browser_no_blob' };
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = doc.filename || `${doc.name || 'document'}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return { ok: true, browserDownload: true };
}

/**
 * Déplace/renomme le fichier d'un document vers un nouveau dossier (changement
 * d'enveloppe) et/ou un nouveau nom (date/nom modifiés).
 * @returns {Promise<{ relPath:string, moved:boolean }>} le nouveau chemin relatif.
 */
async function moveDocument({ relPath, newSlug, newFilename }) {
  const newRel = `${ROOT_FOLDER}/${newSlug}/${newFilename}`;
  _relPathSegments(newRel); // garde-fou : refuse tout slug/nom de fichier non conforme
  if (newRel === relPath) return { relPath, moved: false };
  if (!isTauri()) return { relPath: newRel, moved: false }; // navigateur : métadonnées seules
  const api = await _getTauri();
  const dataDir = await api.appDataDir();
  // Un ancien chemin refusé (sauvegarde altérée) ne doit pas empêcher la mise à jour des
  // métadonnées : on renonce simplement à déplacer le fichier sur le disque.
  let oldAbs = null;
  try { oldAbs = await _absPath(api, dataDir, relPath); } catch (_) { /* chemin refusé */ }
  const newDir = await api.join(dataDir, ROOT_FOLDER, newSlug);
  try { await api.mkdir(newDir); } catch (_) { /* déjà présent */ }
  const newAbs = await api.join(newDir, newFilename);
  if (oldAbs && await api.exists(oldAbs).catch(() => false)) {
    await api.copyFile(oldAbs, newAbs);      // copie puis suppression (rename cross-dossier peu fiable)
    try { await api.remove(oldAbs); } catch (_) { /* ignore */ }
  }
  return { relPath: newRel, moved: true };
}

/** Ouvre, dans l'explorateur de fichiers, le dossier racine des documents importés. */
async function openDocumentsFolder() {
  if (!isTauri()) return { ok: false, reason: 'browser' };
  try {
    const api = await _getTauri();
    const dataDir = await api.appDataDir();
    const folder = await api.join(dataDir, ROOT_FOLDER);
    try { await api.mkdir(folder); } catch (_) { /* déjà présent */ }
    const { openPath } = await import('@tauri-apps/plugin-opener');
    await openPath(folder);
    return { ok: true, path: folder };
  } catch (e) {
    return { ok: false, reason: 'open_error', error: String(e && e.message ? e.message : e) };
  }
}

/**
 * Déplace les documents dont le sous-dossier porte encore l'ancien nommage — dérivé du
 * NOM de l'enveloppe — vers le nommage neutre dérivé de son identifiant, puis supprime
 * le dossier devenu vide. Déplace de même les documents encore rangés sous l'ancienne
 * racine « documents importés » vers ROOT_FOLDER, puis supprime cette racine si elle est vide.
 *
 * POURQUOI : les PDF ne sont pas chiffrés, et un dossier nommé « trade-republic-f529 »
 * révélait le courtier à la simple lecture de l'explorateur. Laisser le dossier vide
 * en place n'aurait rien réglé : c'est son NOM qui parle.
 *
 * Tolérante à l'échec : un document qu'on ne sait pas déplacer garde son ancien chemin
 * et reste utilisable. Mieux vaut une migration partielle qu'une bibliothèque cassée.
 *
 * @param {Array<{id:string, rel_path:string, portfolio_id:string|null}>} documents
 * @param {(portfolioId: string|null) => string} slugAttendu
 * @returns {Promise<{ updated: Array<{id:string, rel_path:string}>, deplaces:number, echecs:number }>}
 */
async function migrateDocumentFolders(documents, slugAttendu) {
  const vide = { updated: [], deplaces: 0, echecs: 0 };
  if (!isTauri() || !Array.isArray(documents) || documents.length === 0) return vide;

  let api;
  let dataDir;
  try {
    api = await _getTauri();
    dataDir = await api.appDataDir();
  } catch {
    return vide;
  }

  const updated = [];
  const anciensDossiers = new Set();
  let deplaces = 0;
  let echecs = 0;

  for (const doc of documents) {
    let parts;
    try {
      parts = _relPathSegments(doc.rel_path);
    } catch {
      echecs += 1;          // chemin déjà invalide : documentService le refusera de toute façon
      continue;
    }

    const attendu = slugAttendu(doc.portfolio_id);
    if (parts[0] === ROOT_FOLDER && parts[1] === attendu) continue;   // déjà au bon endroit

    try {
      const ancienAbs = await api.join(dataDir, ...parts);
      if (!(await api.exists(ancienAbs).catch(() => false))) {
        // Fichier absent : on corrige quand même la fiche, le badge « introuvable »
        // pointera alors sur le bon emplacement.
        updated.push({ id: doc.id, rel_path: `${ROOT_FOLDER}/${attendu}/${parts[2]}` });
        continue;
      }

      const nouveauDir = await api.join(dataDir, ROOT_FOLDER, attendu);
      try { await api.mkdir(nouveauDir); } catch { /* déjà présent */ }
      const nouveauAbs = await api.join(nouveauDir, parts[2]);

      await api.copyFile(ancienAbs, nouveauAbs);
      await api.remove(ancienAbs);

      anciensDossiers.add(`${parts[0]}/${parts[1]}`);
      updated.push({ id: doc.id, rel_path: `${ROOT_FOLDER}/${attendu}/${parts[2]}` });
      deplaces += 1;
    } catch {
      echecs += 1;
    }
  }

  // Les dossiers vidés portent encore l'ancien nom : c'est justement ce qu'il faut
  // faire disparaître. `remove` échoue s'il reste un fichier — on n'insiste pas.
  for (const dossier of anciensDossiers) {
    try {
      await api.remove(await api.join(dataDir, ...dossier.split('/')));
    } catch { /* dossier non vide ou verrouillé : on le laisse */ }
  }
  if ([...anciensDossiers].some(d => d.startsWith(`${LEGACY_ROOT_FOLDER}/`))) {
    try {
      await api.remove(await api.join(dataDir, LEGACY_ROOT_FOLDER));
    } catch { /* il y reste des fichiers : on la laisse */ }
  }

  return { updated, deplaces, echecs };
}

/** Supprime le fichier du document sur disque (Tauri) ou du cache mémoire (navigateur). */
async function deleteDocumentFile(doc) {
  if (!isTauri()) { _browserBlobs.delete(doc.id); return; }
  try {
    const api = await _getTauri();
    const dataDir = await api.appDataDir();
    const abs = await _absPath(api, dataDir, doc.rel_path);
    if (await api.exists(abs).catch(() => false)) await api.remove(abs);
  } catch (_) { /* fichier déjà absent : rien à faire */ }
}

const documentService = {
  isTauri,
  genDocumentId,
  pickPdf,
  saveDocument,
  moveDocument,
  openDocument,
  openDocumentsFolder,
  deleteDocumentFile,
  migrateDocumentFolders,
  documentExists,
  getExpectedPath,
};

export default documentService;

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * storageService.js — Persistence abstraction layer for Fructificare
 *
 * MODES:
 *   'tauri'    → Tauri webview detected     : writes into [appDataDir]/save/
 *                Automatic rotation — keeps the 10 most recent files.
 *   'fsa'      → Chrome/Edge (File System Access API): writes into a file chosen by the
 *                user, the handle being stored in IndexedDB.
 *   'fallback' → Firefox / no FSA: auto-save impossible, manual download only (through
 *                dataService.downloadDataAsFile).
 *
 * PUBLIC API:
 *   storageService.save(jsonString)         → Promise<{ok, error, path}>
 *   storageService.scheduleSave(getDataFn)  → void  (2 s debounce)
 *   storageService.load()                   → Promise<Object|null>
 *   storageService.listBackups()            → Promise<Array<{name,path,label}>>
 *   storageService.restoreBackup(path)      → Promise<Object>
 *   storageService.canAutoSave()            → boolean
 *   storageService.getStatus()              → {mode, lastSaved, error}
 *   storageService.subscribe(fn)            → unsubscribe function
 *   storageService.clearSaveHandle()        → void  (FSA: forget the current file)
 *   storageService.init()                   → void  (detects the mode, call at startup)
 *
 * ENCRYPTION (optional, off by default): see cryptoService.js. When it is on, everything
 * written goes through _serialize() and everything read through _deserialize() — that is
 * the single gateway, there is no write path that would bypass encryption.
 *   storageService.setPassphrasePrompt(fn)  → void  (the interface supplies the prompt)
 *   storageService.setKeyAdoptionConfirm(fn) → void  (consent to adopt the passphrase of
 *                                                    an imported file)
 *   storageService.enableEncryption(p, fn)  → Promise<{ok, purged}>
 *   storageService.disableEncryption(p, fn) → Promise<{ok}>  (requires the current passphrase)
 *   storageService.isEncryptionEnabled()    → boolean
 *   storageService.isUnlocked()             → boolean
 */

import cryptoService from './cryptoService';

// ── Constantes ─────────────────────────────────────────────────────────────────

const DB_NAME         = 'fructificare_storage';
const DB_VERSION      = 1;
const STORE_NAME      = 'handles';
const HANDLE_KEY      = 'save_file_handle';
const MAX_TAURI_FILES = 10;
// Dossier et préfixe des sauvegardes automatiques : noms neutres, identiques en français
// et en anglais. Les anciens noms sont migrés au premier accès (voir _migrerAncienDossier).
const SAVE_FOLDER        = 'save';
const SAVE_PREFIX        = 'save-';
const LEGACY_SAVE_FOLDER = 'sauvegarde';
const LEGACY_SAVE_PREFIX = 'sauvegarde-';
const DEBOUNCE_MS     = 2000;
// Indicateur non sensible : permet a l'interface de savoir qu'une phrase secrete
// sera demandee, avant meme d'avoir lu le moindre fichier.
const ENCRYPTION_FLAG = 'fructificare_encryption_enabled';
// Tentatives de saisie avant abandon. Chacune coûte 600 000 itérations PBKDF2 : une
// boucle non bornée laisserait tourner le processeur indéfiniment si la demande de
// phrase venait à répondre toute seule (fonction défaillante, appel automatisé).
const MAX_TENTATIVES_PHRASE = 5;
// Longueur minimale d'une phrase secrète. 12 caractères — ou, mieux, l'exemple de
// 5 mots proposé par l'interface — mettent une attaque par dictionnaire hors de portée
// vu le coût de dérivation (600 000 itérations par essai). Appliqué côté service pour
// qu'aucun chemin ne puisse installer une phrase plus courte (B-06).
const MIN_PASSPHRASE_LENGTH = 12;

// ── État interne ───────────────────────────────────────────────────────────────

const _state = {
  mode:         null,   // 'tauri' | 'fsa' | 'fallback'
  lastSaved:    null,   // ISO string
  error:        null,   // string | null
  pendingTimer: null,
  listeners:    [],
};

// Chiffrement (optionnel) — voir cryptoService.js.
// La cle derivee vit en memoire pour la duree de la session : l'enregistrement
// automatique se declenche toutes les 2 s, il ne peut pas redemander la phrase.
const _crypto = {
  enabled: false,   // l'utilisateur a active le chiffrement
  key:     null,    // CryptoKey, ou null tant que la session n'est pas deverrouillee
  salt:    null,    // Uint8Array associe a `key`
  prompt:  null,    // fn(erreurPrecedente) => Promise<string|null>, fournie par l'interface
  dismiss: null,    // fn() => void, ferme la demande une fois l'operation terminee
  confirmAdoption: null, // fn() => Promise<boolean>, voir _deserialize
};

// ── Détection du mode ──────────────────────────────────────────────────────────

function _detectMode() {
  if (typeof window === 'undefined') return 'fallback';
  // `__TAURI_INTERNALS__` est injecté par la webview Tauri v2 dans tous les cas.
  if (window.__TAURI_INTERNALS__) return 'tauri';
  if ('showSaveFilePicker' in window)  return 'fsa';
  return 'fallback';
}

function init() {
  if (!_state.mode) _state.mode = _detectMode();
  try { _crypto.enabled = localStorage.getItem(ENCRYPTION_FLAG) === '1'; } catch { /* stockage indisponible */ }
}

// ── Helpers IndexedDB (stockage du FileSystemFileHandle) ───────────────────────

function _openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = ()  => reject(req.error);
  });
}

async function _idbGet(key) {
  try {
    const db = await _openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror   = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function _idbSet(key, value) {
  try {
    const db = await _openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  } catch {}
}

async function _idbDelete(key) {
  try {
    const db = await _openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  } catch {}
}

// ── Mode FSA (File System Access API — Chrome/Edge) ────────────────────────────

/**
 * Récupère le handle stocké ou en demande un nouveau à l'utilisateur.
 * Retourne null si l'utilisateur annule.
 */
async function _fsaGetOrPickHandle() {
  let handle = await _idbGet(HANDLE_KEY);

  if (handle) {
    // Vérifier / redemander la permission
    try {
      const perm = await handle.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') return handle;
      const req = await handle.requestPermission({ mode: 'readwrite' });
      if (req === 'granted') return handle;
    } catch {
      // Handle invalide (e.g. navigateur redémarré sans persistance) — on le supprime
      await _idbDelete(HANDLE_KEY);
    }
  }

  // Demander à l'utilisateur de choisir (ou confirmer) le fichier
  try {
    handle = await window.showSaveFilePicker({
      suggestedName: 'fructificare_sauvegarde.json',
      types: [{
        description: 'Fichier de sauvegarde Fructificare',
        accept: { 'application/json': ['.json'] },
      }],
    });
    await _idbSet(HANDLE_KEY, handle);
    return handle;
  } catch {
    // AbortError = l'utilisateur a annulé
    return null;
  }
}

async function _fsaSave(jsonString) {
  const handle = await _fsaGetOrPickHandle();
  if (!handle) throw new Error('Aucun fichier de sauvegarde sélectionné — cliquez "Choisir fichier" pour configurer l\'auto-save.');

  const writable = await handle.createWritable();
  await writable.write(jsonString);
  await writable.close();
}

async function _fsaLoad() {
  const handle = await _idbGet(HANDLE_KEY);
  if (!handle) return null;

  try {
    const perm = await handle.queryPermission({ mode: 'read' });
    if (perm !== 'granted') {
      const req = await handle.requestPermission({ mode: 'read' });
      if (req !== 'granted') return null;
    }
    const file = await handle.getFile();
    return file.text();
  } catch {
    return null;
  }
}

// ── Mode Tauri ─────────────────────────────────────────────────────────────────

/** Résout les APIs Tauri utilisées pour la persistance. */
async function _getTauriApis() {
  try {
    const [fs, { appDataDir, join }] = await Promise.all([
      import('@tauri-apps/plugin-fs'),
      import('@tauri-apps/api/path'),
    ]);
    return {
      readDir:    (p)     => fs.readDir(p),
      readText:   (p)     => fs.readTextFile(p),
      writeText:  (p, c)  => fs.writeTextFile(p, c),
      createDir:  (p)     => fs.mkdir(p, { recursive: true }),
      removeFile: (p)     => fs.remove(p),
      appDataDir,
      join,
    };
  } catch {
    throw new Error('APIs Tauri introuvables.');
  }
}

/**
 * Déplace les sauvegardes de l'ancien dossier « sauvegarde » vers SAVE_FOLDER, en
 * renommant « sauvegarde-<date>.json » en « save-<date>.json », puis supprime l'ancien
 * dossier s'il est vide.
 *
 * Chaque fichier est d'abord réécrit, puis seulement supprimé : un échec en cours de
 * route laisse le fichier à l'ancien emplacement, jamais perdu. Le contenu est copié
 * tel quel, chiffré ou non.
 */
async function _migrerAncienDossier(api, dataDir, saveDir) {
  const ancien = await api.join(dataDir, LEGACY_SAVE_FOLDER);
  let entries;
  try { entries = await api.readDir(ancien); } catch { return; } // pas d'ancien dossier
  try { await api.createDir(saveDir); } catch {}
  let reste = false;
  for (const e of entries) {
    if (!e.name?.endsWith('.json')) { reste = true; continue; }
    try {
      const source = await api.join(ancien, e.name);
      const nom = e.name.startsWith(LEGACY_SAVE_PREFIX)
        ? SAVE_PREFIX + e.name.slice(LEGACY_SAVE_PREFIX.length)
        : e.name;
      await api.writeText(await api.join(saveDir, nom), await api.readText(source));
      await api.removeFile(source);
    } catch {
      reste = true;
    }
  }
  if (!reste) {
    try { await api.removeFile(ancien); } catch {}
  }
}

let _migrationDossier = null;

/** Chemin du dossier des sauvegardes automatiques, après migration de l'ancien dossier. */
async function _saveDir(api) {
  const dataDir = await api.appDataDir();
  const saveDir = await api.join(dataDir, SAVE_FOLDER);
  if (!_migrationDossier) _migrationDossier = _migrerAncienDossier(api, dataDir, saveDir);
  await _migrationDossier;
  return saveDir;
}

/**
 * Vrai si le fichier est une enveloppe chiffrée — ou s'il est illisible.
 *
 * Illisible compte comme chiffré : la rotation ne doit supprimer que ce qu'elle a
 * formellement identifié comme une sauvegarde en clair. Dans le doute, on garde.
 */
async function _protegeDeLaRotation(api, chemin) {
  try {
    return cryptoService.isEncryptedEnvelope(JSON.parse(await api.readText(chemin)));
  } catch {
    return true;
  }
}

/**
 * @param {string} jsonString — contenu déjà sérialisé (chiffré ou non)
 * @param {boolean} [chiffre] — vrai si `jsonString` est une enveloppe chiffrée
 */
async function _tauriSave(jsonString, chiffre = false) {
  const api       = await _getTauriApis();
  const saveDir   = await _saveDir(api);

  try { await api.createDir(saveDir); } catch {}

  // Nommage : save-YYYY-MM-DD-HHmm.json
  const now  = new Date();
  const pad  = (n) => String(n).padStart(2, '0');
  const ts   = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  const file = await api.join(saveDir, `${SAVE_PREFIX}${ts}.json`);

  await api.writeText(file, jsonString);

  // Rotation : garder MAX_TAURI_FILES fichiers
  try {
    const entries = await api.readDir(saveDir);
    const jsons   = entries
      .filter(e => e.name?.endsWith('.json'))
      .sort((a, b) => b.name.localeCompare(a.name)); // plus récent en premier

    for (const old of jsons.slice(MAX_TAURI_FILES)) {
      // Tauri v2 : readDir ne renvoie PAS de chemin, seulement `name` → on le reconstruit.
      const chemin = await api.join(saveDir, old.name);
      // SÉCURITÉ (B-03) : une écriture EN CLAIR n'efface jamais une sauvegarde chiffrée.
      // Sans cette garde, il suffisait que l'application se croie non chiffrée — indicateur
      // perdu ET dernière sauvegarde illisible, par exemple après une coupure pendant une
      // écriture — pour que dix enregistrements détruisent tout l'historique protégé, au
      // moment précis où l'on en a besoin. Après une désactivation volontaire, les
      // anciennes sauvegardes chiffrées restent donc en place : elles sont protégées, et
      // leur nombre ne peut pas croître.
      if (!chiffre && await _protegeDeLaRotation(api, chemin)) continue;
      try { await api.removeFile(chemin); } catch {}
    }
  } catch {}

  return file;
}

async function _tauriLoad() {
  try {
    const api     = await _getTauriApis();
    const saveDir = await _saveDir(api);
    const entries = await api.readDir(saveDir);
    const jsons   = entries
      .filter(e => e.name?.endsWith('.json'))
      .sort((a, b) => b.name.localeCompare(a.name));

    if (jsons.length === 0) return null;
    // Tauri v2 : reconstruire le chemin à partir du nom (pas de champ `path`).
    return api.readText(await api.join(saveDir, jsons[0].name));
  } catch {
    return null;
  }
}

async function _tauriListBackups() {
  try {
    const api     = await _getTauriApis();
    const saveDir = await _saveDir(api);
    const entries = await api.readDir(saveDir);
    const jsons = entries
      .filter(e => e.name?.endsWith('.json'))
      .sort((a, b) => b.name.localeCompare(a.name));
    // Tauri v2 : le chemin absolu est reconstruit à partir du nom (pas de champ `path`).
    return Promise.all(jsons.map(async e => ({
      name:  e.name,
      path:  await api.join(saveDir, e.name),
      // Convertit "save-2026-05-15-1430.json" → "15/05/2026 14:30"
      label: e.name.replace(SAVE_PREFIX, '').replace('.json', '').replace(
        /^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})$/,
        '$3/$2/$1 $4:$5',
      ),
    })));
  } catch {
    return [];
  }
}

async function _tauriRestoreBackup(filePath) {
  const api = await _getTauriApis();
  return api.readText(filePath);
}

// ── Chiffrement : sérialisation et déchiffrement ───────────────────────────────

function _setFlag(enabled) {
  _crypto.enabled = enabled;
  try {
    if (enabled) localStorage.setItem(ENCRYPTION_FLAG, '1');
    else localStorage.removeItem(ENCRYPTION_FLAG);
  } catch { /* stockage indisponible : l'enveloppe du fichier reste la source de vérité */ }
}

/** Texte à écrire sur disque : chiffré si l'utilisateur l'a demandé, sinon tel quel. */
async function _serialize(jsonString) {
  if (!_crypto.enabled) return jsonString;
  if (!_crypto.key) throw new Error("Session verrouillée : phrase secrète requise avant d'enregistrer.");
  return cryptoService.encryptString(jsonString, _crypto.key, _crypto.salt);
}

/**
 * Lit un texte de sauvegarde : JSON simple, ou enveloppe chiffrée.
 * Une enveloppe déclenche au besoin la demande de phrase secrète auprès de l'interface.
 *
 * @param {string} text
 * @param {'locale'|'importee'} [origine] — d'où vient ce texte. Voir l'adoption de clé
 *        plus bas : un fichier du dossier de l'application appartient à l'utilisateur,
 *        un fichier importé peut venir de n'importe qui.
 * @throws {cryptoService.PassphraseError} phrase absente ou incorrecte
 */
async function _deserialize(text, origine = 'locale') {
  const parsed = JSON.parse(text);
  if (!cryptoService.isEncryptedEnvelope(parsed)) return parsed;

  // Une sauvegarde LOCALE chiffrée fait autorité sur l'état du chiffrement (B-03).
  // L'indicateur localStorage vit dans %LOCALAPPDATA%, les sauvegardes dans %APPDATA% :
  // copier %APPDATA% vers un autre poste, ou une réinitialisation du profil WebView2,
  // laisse l'indicateur derrière. Sans ce rétablissement, l'application se croirait non
  // chiffrée, n'écrirait plus qu'en clair, et la rotation effacerait les sauvegardes
  // chiffrées. On le pose AVANT toute tentative : ainsi, même si l'utilisateur annule le
  // déverrouillage, _serialize refusera d'écrire en clair (clé absente) au lieu de
  // dégrader silencieusement la protection.
  if (origine === 'locale' && !_crypto.enabled) _setFlag(true);

  const salt = cryptoService.envelopeSalt(parsed);
  const iterations = cryptoService.envelopeIterations(parsed);

  // Clé déjà en session et même sel : on évite de redemander la phrase à chaque
  // restauration de sauvegarde. En cas d'échec on NE rejette PAS le fichier — deux
  // sauvegardes peuvent partager un sel sans partager la phrase — on redemande.
  if (_crypto.key && _crypto.salt && cryptoService.toBase64(_crypto.salt) === parsed.salt) {
    try {
      return JSON.parse(await cryptoService.decryptEnvelope(parsed, _crypto.key));
    } catch (e) {
      if (!(e instanceof cryptoService.PassphraseError)) throw e;
    }
  }

  if (!_crypto.prompt) throw new cryptoService.PassphraseError('Phrase secrète requise.');

  // Boucle de saisie : une faute de frappe ne doit pas obliger à relancer
  // l'application. L'utilisateur sort en annulant, ou après MAX_TENTATIVES_PHRASE essais.
  let lastError = null;
  try {
    for (let tentative = 0; ; tentative += 1) {
      if (tentative >= MAX_TENTATIVES_PHRASE) {
        throw new cryptoService.PassphraseError(
          `Phrase secrète incorrecte après ${MAX_TENTATIVES_PHRASE} tentatives. `
          + 'Reprenez depuis « Déverrouiller mes données ».',
        );
      }
      const passphrase = await _crypto.prompt(lastError);
      if (passphrase == null) throw new cryptoService.PassphraseError('Déverrouillage annulé.');

      const key = await cryptoService.deriveKey(passphrase, salt, iterations);
      try {
        const plain = await cryptoService.decryptEnvelope(parsed, key);
        // ── Adoption de la clé pour la session ──────────────────────────────────
        //
        // Deux conditions, et la seconde a été ajoutée après un audit.
        //
        // 1. La session ne doit pas déjà avoir une clé. Sinon le fichier lu vient
        //    d'ailleurs, et changer la clé courante verrouillerait les prochains
        //    enregistrements avec une phrase que l'utilisateur ne considère pas
        //    comme la sienne.
        //
        // 2. Si le fichier a été IMPORTÉ, il faut le consentement explicite de
        //    l'utilisateur. Adopter en silence était une vraie faille : on vous
        //    transmet « mon portefeuille d'exemple, la phrase est demo1234 », vous
        //    l'importez, et toutes vos sauvegardes suivantes sont désormais chiffrées
        //    avec une clé et un sel que l'auteur du fichier connaît. Il lui suffit
        //    ensuite de mettre la main sur un seul de vos fichiers.
        //    Un fichier du dossier de l'application ('locale') est le vôtre : pas de
        //    question à poser. En l'absence de fonction de confirmation, on n'adopte
        //    PAS — se tromper dans ce sens laisse des données en clair, se tromper
        //    dans l'autre remet la clé à un tiers.
        if (!_crypto.key) {
          let adopter = true;
          if (origine !== 'locale') {
            // La saisie est terminée : on referme avant de poser la question suivante,
            // sinon les deux boîtes se superposent.
            _crypto.dismiss?.();
            adopter = _crypto.confirmAdoption ? await _crypto.confirmAdoption() : false;
          }
          if (adopter) {
            _crypto.key = key;
            _crypto.salt = salt;
            _setFlag(true);
          }
        }
        return JSON.parse(plain);
      } catch (e) {
        if (!(e instanceof cryptoService.PassphraseError)) throw e;
        lastError = e.message;
      }
    }
  } finally {
    _crypto.dismiss?.();
  }
}

// ── Notification des abonnés ───────────────────────────────────────────────────

function _notify() {
  const snapshot = { mode: _state.mode, lastSaved: _state.lastSaved, error: _state.error };
  _state.listeners.forEach(fn => {
    try { fn(snapshot); } catch {}
  });
}

// ── API publique ───────────────────────────────────────────────────────────────

/**
 * Sauvegarde synchrone.
 * @param {string} jsonString — chaîne JSON sérialisée
 * @returns {Promise<{ok: boolean, error: string|null, path: string|null}>}
 */
async function save(jsonString) {
  if (!_state.mode) _state.mode = _detectMode();

  try {
    const payload = await _serialize(jsonString);
    let filePath = null;
    if (_state.mode === 'tauri') {
      // `_serialize` rend son argument inchangé quand il n'a pas chiffré : la comparaison
      // dit exactement ce qui part sur le disque, sans dépendre d'un état qui aurait pu
      // changer entre-temps.
      filePath = await _tauriSave(payload, payload !== jsonString);
    } else if (_state.mode === 'fsa') {
      await _fsaSave(payload);
    } else {
      // fallback : auto-save impossible dans ce navigateur
      return { ok: false, error: 'auto-save non disponible (navigateur incompatible)', path: null };
    }
    _state.lastSaved = new Date().toISOString();
    _state.error     = null;
    _notify();
    return { ok: true, error: null, path: filePath };
  } catch (e) {
    _state.error = e.message ?? 'Erreur de sauvegarde inconnue';
    _notify();
    return { ok: false, error: _state.error, path: null };
  }
}

/**
 * Planifie une sauvegarde différée (debounce 2 s).
 * @param {string|function} dataOrFn — JSON string ou fonction qui retourne une JSON string
 */
function scheduleSave(dataOrFn) {
  if (_state.pendingTimer) {
    clearTimeout(_state.pendingTimer);
    _state.pendingTimer = null;
  }
  _state.pendingTimer = setTimeout(async () => {
    _state.pendingTimer = null;
    try {
      const jsonString = typeof dataOrFn === 'function' ? dataOrFn() : dataOrFn;
      await save(jsonString);
    } catch {}
  }, DEBOUNCE_MS);
}

/**
 * Charge la dernière sauvegarde (Tauri ou FSA).
 * @returns {Promise<Object|null>}
 */
async function load() {
  if (!_state.mode) _state.mode = _detectMode();
  let text = null;
  if (_state.mode === 'tauri') text = await _tauriLoad();
  else if (_state.mode === 'fsa') text = await _fsaLoad();
  if (text == null) return null;
  return _deserialize(text);
}

/**
 * Liste les sauvegardes disponibles.
 * @returns {Promise<Array<{name, path, label}>>}
 */
async function listBackups() {
  if (!_state.mode) _state.mode = _detectMode();
  if (_state.mode === 'tauri') return _tauriListBackups();
  return [];
}

/**
 * Restaure une sauvegarde par chemin de fichier (Tauri) ou par handle (FSA).
 * @param {string} pathOrName
 * @returns {Promise<Object>}
 */
async function restoreBackup(pathOrName) {
  if (!_state.mode) _state.mode = _detectMode();
  if (_state.mode !== 'tauri') return null;
  return _deserialize(await _tauriRestoreBackup(pathOrName));
}

/** Indique si l'auto-save est possible dans l'environnement courant. */
function canAutoSave() {
  const mode = _state.mode ?? _detectMode();
  return mode === 'tauri' || mode === 'fsa';
}

/** Retourne l'état courant du service (snapshot immutable). */
function getStatus() {
  return {
    mode:       _state.mode ?? _detectMode(),
    lastSaved:  _state.lastSaved,
    error:      _state.error,
    encrypted:  _crypto.enabled,
    unlocked:   !_crypto.enabled || !!_crypto.key,
  };
}

// ── Chiffrement : API publique ─────────────────────────────────────────────────

/**
 * Enregistre les fonctions d'interface pour la demande de phrase secrète.
 *
 * @param {null | ((error: string|null) => Promise<string|null>)} ask — renvoie la phrase
 *        saisie, ou null si l'utilisateur annule. `error` porte le message de la
 *        tentative précédente, pour l'afficher dans la boîte de dialogue.
 * @param {null | (() => void)} [dismiss] — appelée quand l'opération est terminée
 *        (réussite, annulation ou erreur), pour refermer la boîte de dialogue.
 */
function setPassphrasePrompt(ask, dismiss = null) {
  _crypto.prompt = ask;
  _crypto.dismiss = dismiss;
}

/**
 * Enregistre la fonction qui demande à l'utilisateur s'il accepte d'adopter, pour ses
 * propres sauvegardes, la phrase secrète d'un fichier qu'il vient d'importer.
 *
 * Voir _deserialize : sans ce consentement, importer la sauvegarde chiffrée d'un tiers
 * confiait la protection de toutes les sauvegardes suivantes à une phrase connue de ce
 * tiers. Tant qu'aucune fonction n'est fournie, la réponse est NON.
 *
 * @param {null | (() => Promise<boolean>)} confirm
 */
function setKeyAdoptionConfirm(confirm) {
  _crypto.confirmAdoption = confirm;
}

function isEncryptionEnabled() {
  return _crypto.enabled;
}

/** Faux tant que la phrase secrète n'a pas été fournie pour une session chiffrée. */
function isUnlocked() {
  return !_crypto.enabled || !!_crypto.key;
}

/**
 * Supprime les sauvegardes restées en clair dans le dossier de l'application.
 *
 * Sans cela, activer le chiffrement ne protégerait rien : jusqu'à dix fichiers en
 * clair resteraient à côté du fichier chiffré, avec les mêmes données.
 *
 * @returns {Promise<number>} nombre de fichiers supprimés
 */
async function _purgePlaintextBackups() {
  if (_state.mode !== 'tauri') return 0;
  let removed = 0;
  try {
    const api     = await _getTauriApis();
    const saveDir = await _saveDir(api);
    const entries = await api.readDir(saveDir);
    for (const e of entries.filter(x => x.name?.endsWith('.json'))) {
      const full = await api.join(saveDir, e.name);
      try {
        const parsed = JSON.parse(await api.readText(full));
        if (cryptoService.isEncryptedEnvelope(parsed)) continue;
        await api.removeFile(full);
        removed += 1;
      } catch { /* illisible : on n'y touche pas */ }
    }
  } catch { /* dossier absent */ }
  return removed;
}

/**
 * Active le chiffrement : dérive la clé, écrit immédiatement une sauvegarde chiffrée,
 * puis supprime les sauvegardes restées en clair.
 *
 * @param {string} passphrase
 * @param {() => string} getJson — produit le JSON courant à enregistrer
 * @returns {Promise<{ ok: boolean, error?: string, purged?: number }>}
 */
async function enableEncryption(passphrase, getJson) {
  // Plancher appliqué CÔTÉ SERVICE (B-06) : l'interface le contrôle aussi, mais un appel
  // qui la contournerait ne doit pas pouvoir installer une phrase courte. La longueur est
  // le levier le plus simple contre une attaque par dictionnaire.
  if (!passphrase || passphrase.length < MIN_PASSPHRASE_LENGTH) {
    return { ok: false, error: `La phrase doit compter au moins ${MIN_PASSPHRASE_LENGTH} caractères.` };
  }
  try {
    const salt = cryptoService.randomSalt();
    _crypto.key = await cryptoService.deriveKey(passphrase, salt);
    _crypto.salt = salt;
    _setFlag(true);

    const result = await save(getJson());
    if (!result.ok) throw new Error(result.error || "Échec de l'enregistrement chiffré.");

    const purged = await _purgePlaintextBackups();
    return { ok: true, purged };
  } catch (e) {
    // Retour à l'état antérieur : mieux vaut rester en clair que laisser l'utilisateur
    // croire ses données chiffrées alors que l'écriture a échoué.
    _crypto.key = null;
    _crypto.salt = null;
    _setFlag(false);
    return { ok: false, error: e?.message ?? String(e) };
  }
}

/**
 * Désactive le chiffrement et réécrit immédiatement une sauvegarde en clair.
 *
 * SÉCURITÉ (B-07) : la désactivation expose tout le patrimoine en clair sur le disque.
 * C'est une opération au moins aussi sensible que changer de phrase, qui exige déjà la
 * phrase actuelle — on l'exige donc ici aussi. Sans cela, quiconque atteint l'application
 * déverrouillée (utilisateur qui s'éloigne, poste partagé) pourrait, en deux clics,
 * déverser toutes les données en clair. La vérification est autonome (sonde chiffrée avec
 * la clé de session), sans dépendre d'une relecture du disque.
 *
 * @param {string} ancienne — phrase actuelle, pour confirmer l'intention
 * @param {() => string} getJson
 * @returns {Promise<{ ok:boolean, error?:string }>}
 */
async function disableEncryption(ancienne, getJson) {
  if (!_crypto.enabled) return { ok: true }; // déjà en clair
  if (!_crypto.key || !_crypto.salt) return { ok: false, error: 'Session verrouillée.' };
  try {
    const sonde = JSON.parse(await cryptoService.encryptString('probe', _crypto.key, _crypto.salt));
    const cleAncienne = await cryptoService.deriveKey(ancienne, _crypto.salt);
    await cryptoService.decryptEnvelope(sonde, cleAncienne); // lève si la phrase est incorrecte
  } catch (e) {
    if (e instanceof cryptoService.PassphraseError) {
      return { ok: false, error: 'Phrase secrète actuelle incorrecte.' };
    }
    return { ok: false, error: e?.message ?? String(e) };
  }
  _crypto.key = null;
  _crypto.salt = null;
  _setFlag(false);
  return save(getJson());
}

/**
 * Supprime les sauvegardes qui ne sont plus lisibles avec la clé courante : celles
 * restées en clair, et celles chiffrées avec une clé précédente (sel différent).
 *
 * Appelée après un changement de phrase. Sans elle, la rotation laisserait derrière
 * elle des fichiers déchiffrables avec l'ancienne phrase — précisément ce dont on
 * cherche à se défaire quand on en change.
 *
 * @returns {Promise<number>} nombre de fichiers supprimés
 */
async function _purgeAutresCles(selCourantB64) {
  if (_state.mode !== 'tauri') return 0;
  let removed = 0;
  try {
    const api = await _getTauriApis();
    const saveDir = await _saveDir(api);
    const entries = await api.readDir(saveDir);
    for (const e of entries.filter(x => x.name?.endsWith('.json'))) {
      const full = await api.join(saveDir, e.name);
      try {
        const parsed = JSON.parse(await api.readText(full));
        const chiffre = cryptoService.isEncryptedEnvelope(parsed);
        if (chiffre && parsed.salt === selCourantB64) continue;   // lisible : on garde
        await api.removeFile(full);
        removed += 1;
      } catch { /* illisible : on n'y touche pas */ }
    }
  } catch { /* dossier absent */ }
  return removed;
}

/**
 * Change la phrase secrète sans jamais repasser par une écriture en clair.
 *
 * POURQUOI CETTE FONCTION EXISTE : sans elle, le seul chemin possible était de
 * désactiver puis réactiver le chiffrement. Or `disableEncryption()` réécrit la
 * sauvegarde EN CLAIR sur le disque. L'opération la plus naturelle après une phrase
 * compromise — en changer — exposait donc tout le patrimoine, et une suppression
 * ordinaire ne l'efface pas physiquement.
 *
 * Ici, l'ancienne phrase sert uniquement à vérifier qu'on a le droit d'agir ; la
 * réécriture se fait directement avec la nouvelle clé, et un NOUVEAU sel.
 *
 * @param {string} ancienne
 * @param {string} nouvelle
 * @param {() => string} getJson — produit le JSON courant à réenregistrer
 * @returns {Promise<{ ok:boolean, error?:string, purged?:number }>}
 */
async function changePassphrase(ancienne, nouvelle, getJson) {
  if (!_crypto.enabled) return { ok: false, error: "Le chiffrement n'est pas actif." };
  if (!nouvelle || nouvelle.length < MIN_PASSPHRASE_LENGTH) return { ok: false, error: `La nouvelle phrase doit compter au moins ${MIN_PASSPHRASE_LENGTH} caractères.` };
  if (nouvelle === ancienne) return { ok: false, error: "La nouvelle phrase est identique à l'ancienne." };

  // Sauvegarde de l'état, pour pouvoir revenir en arrière si l'écriture échoue.
  const cleAvant = _crypto.key;
  const selAvant = _crypto.salt;

  try {
    // 1. Vérifier l'ancienne phrase — sans dépendre du disque.
    //
    // On chiffre une sonde avec la clé DE SESSION, puis on tente de la déchiffrer avec
    // la clé dérivée de la phrase proposée. Même sel et même dérivation : les deux clés
    // coïncident si et seulement si la phrase est la bonne. Relire la sauvegarde aurait
    // été équivalent, mais aurait échoué quand le fichier n'est pas relisible dans
    // l'instant (poignée de fichier non rétablie, sauvegarde encore jamais écrite).
    if (!_crypto.key || !_crypto.salt) return { ok: false, error: 'Session verrouillée.' };
    const sonde = JSON.parse(await cryptoService.encryptString('probe', _crypto.key, _crypto.salt));
    const cleAncienne = await cryptoService.deriveKey(ancienne, _crypto.salt);
    await cryptoService.decryptEnvelope(sonde, cleAncienne);   // lève si incorrecte

    // 2. Nouvelle clé, nouveau sel — puis écriture directement chiffrée.
    const nouveauSel = cryptoService.randomSalt();
    _crypto.key = await cryptoService.deriveKey(nouvelle, nouveauSel);
    _crypto.salt = nouveauSel;

    const res = await save(getJson());
    if (!res.ok) throw new Error(res.error || "Échec de l'enregistrement.");

    // 3. Écarter ce qui reste lisible avec l'ancienne phrase.
    const purged = await _purgeAutresCles(cryptoService.toBase64(nouveauSel));
    return { ok: true, purged };
  } catch (e) {
    _crypto.key = cleAvant;
    _crypto.salt = selAvant;
    if (e instanceof cryptoService.PassphraseError) {
      return { ok: false, error: 'Phrase secrète actuelle incorrecte.' };
    }
    return { ok: false, error: e?.message ?? String(e) };
  }
}

/** Sérialise un payload pour un export ou un téléchargement (chiffré si activé). */
async function serializeForExport(jsonString) {
  return _serialize(jsonString);
}

/**
 * Lit un fichier importé : JSON simple ou enveloppe chiffrée.
 *
 * Marqué 'importee' : ce fichier peut venir de n'importe qui, donc sa phrase secrète
 * ne devient celle de l'utilisateur qu'après confirmation explicite (voir _deserialize
 * et setKeyAdoptionConfirm).
 */
async function deserializeImported(text) {
  return _deserialize(text, 'importee');
}

/**
 * S'abonne aux changements d'état.
 * @param {function} fn — appelé avec {mode, lastSaved, error} à chaque changement
 * @returns {function} — fonction pour se désabonner
 */
function subscribe(fn) {
  _state.listeners.push(fn);
  return () => {
    _state.listeners = _state.listeners.filter(l => l !== fn);
  };
}

/**
 * Oublie le fichier de sauvegarde courant (mode FSA).
 * L'utilisateur devra en choisir un nouveau lors de la prochaine sauvegarde.
 */
function clearSaveHandle() {
  _idbDelete(HANDLE_KEY);
  _state.lastSaved = null;
  _state.error     = null;
  _notify();
}

// ── Export ─────────────────────────────────────────────────────────────────────

const storageService = {
  MIN_PASSPHRASE_LENGTH,
  init,
  save,
  scheduleSave,
  load,
  listBackups,
  restoreBackup,
  canAutoSave,
  getStatus,
  subscribe,
  clearSaveHandle,
  setPassphrasePrompt,
  setKeyAdoptionConfirm,
  isEncryptionEnabled,
  isUnlocked,
  enableEncryption,
  disableEncryption,
  changePassphrase,
  serializeForExport,
  deserializeImported,
};

export default storageService;

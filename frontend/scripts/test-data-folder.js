// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * test-data-folder.js — Changing the data folder must neither lose nor mix up backups.
 *
 * The user can move their data folder (File > Data folder & encryption…), or take over a
 * folder that already holds backups — on a USB drive, after reinstalling for instance.
 * Three traps are checked here, on the real storageService and a disk simulated in memory:
 *
 *   1. A save still waiting for its 2-second debounce must be written BEFORE the switch.
 *      Otherwise it fires afterwards, into the new folder, where it would pass for the
 *      most recent backup of the data just taken over.
 *   2. A folder that cannot be found (drive unplugged) must be neither read as an empty
 *      folder nor recreated: an empty save written there would later win over the real
 *      history.
 *   3. After taking over a plain-text folder, the encryption flag must come down —
 *      otherwise the application waits for a key it will never get, and saves nothing.
 *
 * Usage:  npm run test:security
 */
const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');

globalThis.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
globalThis.atob = (s) => Buffer.from(s, 'base64').toString('binary');
if (!globalThis.crypto) globalThis.crypto = webcrypto;
const stockage = new Map();
globalThis.localStorage = {
  getItem: (k) => (stockage.has(k) ? stockage.get(k) : null),
  setItem: (k, v) => stockage.set(k, String(v)),
  removeItem: (k) => stockage.delete(k),
};
globalThis.window = { __TAURI_INTERNALS__: {} };

// ── Disque simulé ; la racine des données est celle que « Rust » a enregistrée ──
const fichiers = new Map();
const dossiers = new Set(['ANCIEN', 'NOUVEAU']);
let racine = 'ANCIEN';
let disponible = true;
const api = {
  dataDir: async () => {
    if (!disponible) throw new Error(`Dossier de données introuvable : ${racine}`);
    return racine;
  },
  join: async (...p) => p.join('/'),
  createDir: async (d) => {
    if (!dossiers.has(d.split('/')[0])) throw new Error(`disque absent : ${d}`);
    dossiers.add(d);
  },
  writeText: async (p, c) => {
    if (!dossiers.has(p.slice(0, p.lastIndexOf('/')))) throw new Error(`dossier absent : ${p}`);
    fichiers.set(p, c);
  },
  readText: async (p) => { if (!fichiers.has(p)) throw new Error('absent'); return fichiers.get(p); },
  removeFile: async (p) => { fichiers.delete(p); },
  readDir: async (d) => {
    if (!dossiers.has(d)) throw new Error('dossier absent');
    return [...fichiers.keys()]
      .filter((f) => f.slice(0, f.lastIndexOf('/')) === d)
      .map((f) => ({ name: f.split('/').pop() }));
  },
};

function charger(relatif, nom, injecte = {}) {
  let src = fs.readFileSync(path.join(__dirname, '..', relatif), 'utf8')
    .replace(/^import .*$/gm, '')
    .replace(/^export default .*$/m, '')
    .replace(/^export \{[\s\S]*?\};$/m, '');
  src = src.replace(/async function _getTauriApis\(\)[\s\S]*?\n\}/, 'async function _getTauriApis() { return __api; }');
  const cles = Object.keys(injecte);
  return new Function(...cles, '__api', `${src}\nreturn ${nom};`)(...cles.map((k) => injecte[k]), api);
}

const cryptoService = charger('src/services/cryptoService.js', 'cryptoService');
const storage = charger('src/services/storageService.js', 'storageService', { cryptoService });

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`OK     ${label}`);
  } else {
    failures += 1;
    console.log(`ECHEC  ${label}`);
    if (detail !== undefined) console.log(`         -> ${JSON.stringify(detail)}`);
  }
}

const dans = (d) => [...fichiers.keys()].filter((f) => f.startsWith(`${d}/`));

(async () => {
  storage.init();

  // ── 1. L'enregistrement en attente part AVANT le changement de dossier ────────
  storage.scheduleSave(() => JSON.stringify({ portfolios: [], qui: 'courant' }));
  await storage.flush();
  check("flush() écrit tout de suite l'enregistrement en attente, dans l'ancien dossier",
    dans('ANCIEN/save').length === 1 && dans('NOUVEAU').length === 0, [...fichiers.keys()]);

  // Le dossier repris contient une sauvegarde d'une autre installation.
  dossiers.add('NOUVEAU/save');
  fichiers.set('NOUVEAU/save/save-2026-01-01-0900.json', JSON.stringify({ portfolios: [], qui: 'repris' }));
  racine = 'NOUVEAU';
  await new Promise((r) => setTimeout(r, 2300)); // au-delà du délai de 2 s
  check("aucun enregistrement tardif n'atterrit dans le dossier repris",
    dans('NOUVEAU').length === 1, dans('NOUVEAU'));
  const repris = await storage.load();
  check('la sauvegarde du dossier repris est bien celle chargée', repris?.qui === 'repris', repris);

  // ── 2. Dossier introuvable : ni lu comme vide, ni recréé ──────────────────────
  racine = 'CLE-USB';
  disponible = false;
  check('un dossier introuvable ne se charge pas comme un dossier vide', (await storage.load()) === null);
  const res = await storage.save(JSON.stringify({ portfolios: [], qui: 'vide' }));
  check("rien n'est écrit tant que le dossier est introuvable",
    !res.ok && dans('CLE-USB').length === 0 && !dossiers.has('CLE-USB/save'), res);
  disponible = true;

  // ── 3. L'indicateur de chiffrement suit le dossier repris ─────────────────────
  racine = 'NOUVEAU';
  localStorage.setItem('fructificare_encryption_enabled', '1');
  storage.init();
  await storage.syncEncryptionFlag();
  check("reprendre un dossier en clair abaisse l'indicateur de chiffrement",
    storage.isEncryptionEnabled() === false && storage.isUnlocked());

  const cle = await cryptoService.deriveKey('phrase de test assez longue', cryptoService.randomSalt(), 1000);
  const enveloppe = await cryptoService.encryptString('{"portfolios":[]}', cle, cryptoService.randomSalt());
  fichiers.set('NOUVEAU/save/save-2026-02-01-0900.json', enveloppe);
  await storage.syncEncryptionFlag();
  check('reprendre un dossier chiffré lève l\'indicateur', storage.isEncryptionEnabled() === true);

  dossiers.add('VIDE');
  racine = 'VIDE';
  await storage.syncEncryptionFlag();
  check('un dossier vide repart sans chiffrement', storage.isEncryptionEnabled() === false);

  if (failures) {
    console.error(`\n${failures} échec(s) — changer de dossier des données peut perdre ou mêler des sauvegardes.`);
    process.exit(1);
  }
  console.log('\nChanger de dossier des données ne perd ni ne mêle aucune sauvegarde.');
})().catch((e) => { console.error('Erreur inattendue :', e); process.exit(1); });

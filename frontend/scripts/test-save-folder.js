// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * test-save-folder.js — Migration of the old "sauvegarde" folder to "save".
 *
 * Automatic backups used to live in [appDataDir]/sauvegarde/ under the name
 * "sauvegarde-<date>.json". They now live in [appDataDir]/save/ as "save-<date>.json".
 * An existing installation must lose nothing in the move: the history must be relocated,
 * renamed, and still be listed and loaded normally.
 *
 * The real module is loaded in Tauri mode, on a disk simulated in memory.
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

// ── Disque simulé, sensible aux dossiers ───────────────────────────────────────
const fichiers = new Map();
const dossiers = new Set(['APPDATA']);
const api = {
  appDataDir: async () => 'APPDATA',
  join: async (...p) => p.join('/'),
  createDir: async (d) => { dossiers.add(d); },
  writeText: async (p, c) => {
    if (!dossiers.has(p.slice(0, p.lastIndexOf('/')))) throw new Error(`dossier absent : ${p}`);
    fichiers.set(p, c);
  },
  readText: async (p) => { if (!fichiers.has(p)) throw new Error('absent'); return fichiers.get(p); },
  removeFile: async (p) => {
    if (fichiers.has(p)) { fichiers.delete(p); return; }
    if ([...fichiers.keys()].some((f) => f.startsWith(`${p}/`))) throw new Error('dossier non vide');
    dossiers.delete(p);
  },
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

// Installation existante : trois sauvegardes dans l'ancien dossier.
const ANCIEN = 'APPDATA/sauvegarde';
dossiers.add(ANCIEN);
fichiers.set(`${ANCIEN}/sauvegarde-2026-09-01-1000.json`, JSON.stringify({ portfolios: [], v: 1 }));
fichiers.set(`${ANCIEN}/sauvegarde-2026-09-02-1000.json`, JSON.stringify({ portfolios: [], v: 2 }));
fichiers.set(`${ANCIEN}/sauvegarde-2026-09-03-1000.json`, JSON.stringify({ portfolios: [], v: 3 }));

(async () => {
  storage.init();
  const donnees = await storage.load();
  check('la sauvegarde la plus récente est chargée après migration', donnees && donnees.v === 3, donnees);

  const noms = [...fichiers.keys()].sort();
  check('les trois fichiers sont sous « save », renommés « save-… »',
    noms.length === 3 && noms.every((n) => /^APPDATA\/save\/save-2026-09-0\d-1000\.json$/.test(n)), noms);
  check("l'ancien dossier « sauvegarde » est supprimé", !dossiers.has(ANCIEN));

  const liste = await storage.listBackups();
  check('les sauvegardes migrées restent listées, avec leur date',
    liste.length === 3 && liste[0].label === '03/09/2026 10:00', liste.map((e) => e.label));

  const res = await storage.save(JSON.stringify({ portfolios: [], v: 4 }));
  check('une nouvelle sauvegarde est écrite dans « save »',
    res.ok && /^APPDATA\/save\/save-\d{4}-\d{2}-\d{2}-\d{4}\.json$/.test(res.path), res);
  check("l'ancien dossier n'est pas recréé", !dossiers.has(ANCIEN));

  if (failures) {
    console.error(`\n${failures} échec(s) — la migration du dossier de sauvegarde est cassée.`);
    process.exit(1);
  }
  console.log('\nLes sauvegardes de l\'ancien dossier sont migrées sans perte.');
})().catch((e) => { console.error('Erreur inattendue :', e); process.exit(1); });

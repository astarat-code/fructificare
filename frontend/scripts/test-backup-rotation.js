// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * test-backup-rotation.js — Backup rotation must never destroy the encrypted history
 * (B-03).
 *
 * Rotation (desktop mode) keeps the 10 most recent files. The danger: the application
 * believing it is unencrypted while the disk is. It then writes in plain text, and ten
 * saves later every encrypted backup has been deleted to make room. That scenario was
 * demonstrated on the real module before the fix; this test keeps it from coming back.
 *
 * Two ways to get there, both tested:
 *   A. the localStorage flag is gone and the user cancels the unlock;
 *   B. the flag is gone AND the last backup is unreadable (interrupted write): loading
 *      fails before encryption is ever seen.
 *
 * The module is loaded as-is, in Tauri mode, on a disk simulated in memory.
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
globalThis.window = { __TAURI_INTERNALS__: {} }; // storageService choisit le mode 'tauri'

// ── Disque simulé : le dossier « save » ──────────────────────────────────
const disque = new Map();
const DOSSIER = 'APPDATA/save';
const api = {
  appDataDir: async () => 'APPDATA',
  join: async (...p) => p.join('/'),
  createDir: async () => {},
  writeText: async (p, c) => { disque.set(p, c); },
  readText: async (p) => { if (!disque.has(p)) throw new Error('absent'); return disque.get(p); },
  removeFile: async (p) => { disque.delete(p); },
  readDir: async () => [...disque.keys()].map((k) => ({ name: k.split('/').pop() })),
};

// Horloge pilotée : les noms de fichier ont une résolution d'une minute.
let minute = 0;
const VraieDate = Date;
globalThis.Date = class extends VraieDate {
  constructor(...a) {
    if (a.length) super(...a);
    else super(VraieDate.UTC(2026, 8, 13, 8, 0) + minute * 60000);
  }
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

const estChiffre = (t) => { try { return cryptoService.isEncryptedEnvelope(JSON.parse(t)); } catch { return false; } };
const compter = () => {
  const v = [...disque.values()];
  return { chiffrees: v.filter(estChiffre).length, total: v.length };
};
const donnees = (n) => JSON.stringify({ portfolios: [{ id: 'p', name: `Saisie ${n}` }], transactions: [] });

async function historiqueChiffre(nombre) {
  disque.clear();
  const sel = cryptoService.randomSalt();
  const cle = await cryptoService.deriveKey('la vraie phrase secrete', sel);
  for (let i = 0; i < nombre; i += 1) {
    const nom = `${DOSSIER}/save-2026-09-01-10${String(i).padStart(2, '0')}.json`;
    disque.set(nom, await cryptoService.encryptString(donnees(`historique ${i}`), cle, sel));
  }
}

function nouvelleSession() {
  stockage.clear();                   // indicateur de chiffrement perdu
  storage.init();
}

async function main() {
  // ── A. Indicateur perdu, déverrouillage annulé ────────────────────────────────
  await historiqueChiffre(10);
  nouvelleSession();
  storage.setPassphrasePrompt(async () => null, () => {});
  try { await storage.load(); } catch { /* annulation attendue */ }

  const st = storage.getStatus();
  check('A. session verrouillée affichée malgré l\'indicateur perdu', st.encrypted && !st.unlocked, st);
  for (let i = 0; i < 12; i += 1) { minute += 1; await storage.save(donnees(i)); }
  const a = compter();
  check('A. aucun enregistrement en clair', a.chiffrees === a.total, a);
  check('A. les 10 sauvegardes chiffrées sont intactes', a.chiffrees === 10, a);

  // ── B. Indicateur perdu ET dernière sauvegarde illisible ──────────────────────
  await historiqueChiffre(9);
  disque.set(`${DOSSIER}/save-2026-09-02-0900.json`, '{"fructificare-encrypted":1,"salt":"tron'); // coupée net
  nouvelleSession();
  try { await storage.load(); } catch { /* illisible */ }
  check('B. prémisse : l\'application se croit non chiffrée', storage.isEncryptionEnabled() === false);
  for (let i = 0; i < 15; i += 1) { minute += 1; await storage.save(donnees(i)); }
  const b = compter();
  check('B. les 9 sauvegardes chiffrées ont survécu à 15 enregistrements en clair', b.chiffrees === 9, b);
  check('B. le fichier illisible est conservé (dans le doute, on garde)',
    disque.has(`${DOSSIER}/save-2026-09-02-0900.json`));

  // ── C. La rotation fonctionne toujours pour des sauvegardes en clair ──────────
  disque.clear();
  nouvelleSession();
  for (let i = 0; i < 14; i += 1) { minute += 1; await storage.save(donnees(i)); }
  const c = compter();
  check('C. sans chiffrement, la rotation plafonne toujours à 10 fichiers', c.total === 10, c);

  // ── D. Et pour des sauvegardes chiffrées, en session déverrouillée ────────────
  disque.clear();
  nouvelleSession();
  const act = await storage.enableEncryption('phrase de test assez longue', () => donnees('x'));
  check('D. activation du chiffrement', act.ok === true, act);
  for (let i = 0; i < 14; i += 1) { minute += 1; await storage.save(donnees(i)); }
  const d = compter();
  check('D. en chiffré, la rotation plafonne aussi à 10', d.total === 10 && d.chiffrees === 10, d);

  if (failures) {
    console.error(`\n${failures} échec(s) — la rotation peut détruire l'historique chiffré.`);
    process.exit(1);
  }
  console.log('\nLa rotation ne détruit jamais une sauvegarde chiffrée pour écrire en clair.');
}

main().catch((e) => { console.error('Erreur inattendue :', e); process.exit(1); });

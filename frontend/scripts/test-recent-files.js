// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * test-recent-files.js — Checks the recent files list.
 *
 * The concern here is disclosure: an absolute path contains the Windows session name and
 * the personal folder tree. The path stays remembered — it is what points the dialog back
 * — but the interface must only show the file name and its parent folder, and the user
 * must be able to clear everything.
 *
 * Usage:  npm run test:security
 */
const fs = require('fs');
const path = require('path');

// ── localStorage minimal ───────────────────────────────────────────────────────
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const SOURCE = path.join(__dirname, '..', 'src', 'lib', 'recentFiles.js');
const src = fs.readFileSync(SOURCE, 'utf8').replace(/^export /gm, '');
const { getRecentFiles, addRecentFile, removeRecentFile, clearRecentFiles } = new Function(
  src + '\nreturn { getRecentFiles, addRecentFile, removeRecentFile, clearRecentFiles };',
)();

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

const BS = String.fromCharCode(92);
const CHEMIN = ['C:', 'Users', 'prenom.nom', 'Documents', 'Patrimoine', 'sauvegarde-2026.json'].join(BS);

// ── Extraction du nom et du dossier ────────────────────────────────────────────
addRecentFile(CHEMIN);
let [entree] = getRecentFiles();
check('nom de fichier extrait', entree.name === 'sauvegarde-2026.json', entree.name);
check('dossier parent extrait, sans son chemin', entree.folder === 'Patrimoine', entree.folder);
check('le chemin complet reste mémorisé (repointe la boîte de dialogue)', entree.path === CHEMIN);

check("le nom de session n'apparaît pas dans les champs affichés",
  !entree.name.includes('prenom.nom') && !entree.folder.includes('prenom.nom'),
  { name: entree.name, folder: entree.folder });
check("l'arborescence n'apparaît pas dans les champs affichés",
  !entree.folder.includes(BS) && !entree.folder.includes('/'), entree.folder);

// ── Chemins POSIX ──────────────────────────────────────────────────────────────
clearRecentFiles();
addRecentFile('/home/utilisateur/sauvegardes/portefeuille.json');
[entree] = getRecentFiles();
check('chemin POSIX : nom extrait', entree.name === 'portefeuille.json', entree.name);
check('chemin POSIX : dossier extrait', entree.folder === 'sauvegardes', entree.folder);

// ── Dédoublonnage et remontée en tête ──────────────────────────────────────────
clearRecentFiles();
addRecentFile('C:' + BS + 'a' + BS + 'un.json');
addRecentFile('C:' + BS + 'b' + BS + 'deux.json');
addRecentFile('C:' + BS + 'A' + BS + 'UN.JSON'); // même fichier, casse différente
const apres = getRecentFiles();
check('doublon insensible à la casse écarté', apres.length === 2, apres.map((e) => e.path));
check('le fichier rouvert remonte en tête', apres[0].name === 'UN.JSON', apres[0].name);

// ── Plafond ────────────────────────────────────────────────────────────────────
clearRecentFiles();
for (let i = 0; i < 15; i += 1) addRecentFile('C:' + BS + 'd' + BS + `f${i}.json`);
check('liste plafonnée à 8 entrées', getRecentFiles().length === 8, getRecentFiles().length);

// ── Migration des entrées écrites avant l'ajout de `folder` ────────────────────
clearRecentFiles();
localStorage.setItem('fructificare_recent_files', JSON.stringify([
  { path: CHEMIN, name: 'sauvegarde-2026.json', ts: 1 },   // pas de `folder`
  { path: 'C:' + BS + 'x' + BS + 'y.json', ts: 2 },        // ni `folder` ni `name`
]));
const migrees = getRecentFiles();
check('ancienne entrée : dossier recalculé', migrees[0].folder === 'Patrimoine', migrees[0].folder);
check('ancienne entrée : nom recalculé', migrees[1].name === 'y.json', migrees[1].name);

// ── Effacement ─────────────────────────────────────────────────────────────────
check('retrait ciblé', removeRecentFile(CHEMIN).length === 1);
clearRecentFiles();
check('la liste est vidée', getRecentFiles().length === 0);
check('aucun chemin ne subsiste dans le stockage',
  localStorage.getItem('fructificare_recent_files') === null);

// ── Robustesse ─────────────────────────────────────────────────────────────────
localStorage.setItem('fructificare_recent_files', 'ceci nest pas du JSON');
check('stockage corrompu : liste vide plutôt qu\'exception', getRecentFiles().length === 0);
localStorage.setItem('fructificare_recent_files', JSON.stringify({ pas: 'un tableau' }));
check('stockage de type inattendu : liste vide', getRecentFiles().length === 0);

if (failures) {
  console.error(`\n${failures} échec(s) — la liste des fichiers récents est cassée.`);
  process.exit(1);
}
console.log('\nTous les tests de la liste des fichiers récents sont passés.');

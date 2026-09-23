// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * test-document-folders.js — Document folders must reveal nothing.
 *
 * Imported PDFs (statements, trade confirmations, tax forms) are not encrypted. As long
 * as the subfolder carried the envelope's name, a folder called "trade-republic-f529" was
 * enough to identify the user's broker in the file explorer, without opening a single
 * document.
 *
 * This test checks two things: that the naming no longer leaks, and that the migration of
 * existing installations does move the files AND erase the old folder — an empty folder
 * with the wrong name would have fixed nothing.
 *
 * Usage:  npm run test:security
 */
const fs = require('fs');
const path = require('path');

// ── Chargement des modules réels ───────────────────────────────────────────────

function extraire(fichier, noms) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', fichier), 'utf8')
    .replace(/^import .*$/gm, '')
    .replace(/^export default .*$/m, '')
    .replace(/^export \{[\s\S]*?\};$/m, '');
  return new Function(`${src}\nreturn { ${noms.join(', ')} };`)();
}

const { getPortfolioSlug } = extraire('dataService.js', ['getPortfolioSlug']);

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

// ── Le nommage ne révèle rien ──────────────────────────────────────────────────

const ENVELOPPES = [
  { id: 'd519ec52-4ad1-4b90-83f2-f221da590998', name: 'Trade Republic' },
  { id: '7f3a1b20-0000-4000-8000-000000000001', name: 'Boursorama PEA' },
  { id: 'c0ffee11-2222-4333-8444-555555555555', name: 'Assurance vie Linxea Spirit 2' },
];
const SEGMENT_SUR = /^[A-Za-z0-9][A-Za-z0-9._ -]*$/;

for (const env of ENVELOPPES) {
  const slug = getPortfolioSlug(env);
  const motsDuNom = env.name.toLowerCase().split(/\s+/).filter((m) => m.length >= 4);
  const fuite = motsDuNom.filter((m) => slug.toLowerCase().includes(m));
  check(`« ${env.name} » ne transparaît pas dans le dossier`, fuite.length === 0, { slug, fuite });
  check(`  segment conforme à la validation de chemin`, SEGMENT_SUR.test(slug), slug);
}

check('deux enveloppes donnent deux dossiers distincts',
  new Set(ENVELOPPES.map(getPortfolioSlug)).size === ENVELOPPES.length);
check('le dossier est stable pour une même enveloppe',
  getPortfolioSlug(ENVELOPPES[0]) === getPortfolioSlug({ ...ENVELOPPES[0], name: 'Renommée' }));
check('sans enveloppe, le dossier est « global »',
  getPortfolioSlug(null) === 'global' && getPortfolioSlug({ id: '', name: 'x' }) === 'global');

// ── La migration déplace les fichiers et efface l'ancien dossier ───────────────
//
// documentService s'appuie sur les API Tauri : on les remplace par un disque en
// mémoire, et on force le mode bureau. Le reste du module est celui de production.

const RACINE = 'C:/AppData/app.fructificare.desktop';
const ROOT = 'documents imp';
const ANCIENNE_RACINE = 'documents importés';

async function scenarioMigration() {
  const mod = (() => {
    const disque = new Map();
    const dossiers = new Set();
    const api = {
      appDataDir: async () => RACINE,
      join: async (...p) => p.join('/'),
      mkdir: async (d) => { dossiers.add(d); },
      copyFile: async (s, d) => { disque.set(d, disque.get(s)); },
      exists: async (p) => disque.has(p),
      remove: async (p) => {
        if (disque.has(p)) { disque.delete(p); return; }
        const reste = [...disque.keys()].some((f) => f.startsWith(`${p}/`));
        if (reste) throw new Error('dossier non vide');
        dossiers.delete(p);
      },
    };
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'documentService.js'), 'utf8')
      .replace(/^import .*$/gm, '')
      .replace(/^export default .*$/m, '')
      .replace(/^export \{[\s\S]*?\};$/m, '')
      .replace(/function isTauri\(\)[\s\S]*?\n\}/, 'function isTauri() { return true; }')
      .replace(/async function _getTauri\(\)[\s\S]*?\n\}/, 'async function _getTauri() { return __api; }');
    const m = new Function('__api', `${src}\nreturn { migrateDocumentFolders };`)(api);
    return { m, disque, dossiers };
  })();

  const ancien = 'trade-republic-f529';
  const nouveau = getPortfolioSlug(ENVELOPPES[0]);
  const fichier = '2026-01-05_releve.pdf';
  const ancienChemin = `${RACINE}/${ROOT}/${ancien}/${fichier}`;
  mod.disque.set(ancienChemin, 'PDF');

  const documents = [{ id: 'd1', portfolio_id: ENVELOPPES[0].id, rel_path: `${ROOT}/${ancien}/${fichier}` }];
  const res = await mod.m.migrateDocumentFolders(documents, () => nouveau);

  check('un document déplacé', res.deplaces === 1 && res.echecs === 0, res);
  check('le nouveau chemin utilise le dossier neutre',
    res.updated[0].rel_path === `${ROOT}/${nouveau}/${fichier}`, res.updated[0]);
  check('le fichier est au nouvel emplacement',
    mod.disque.has(`${RACINE}/${ROOT}/${nouveau}/${fichier}`));
  check("l'ancien fichier a disparu", !mod.disque.has(ancienChemin));
  check("l'ancien dossier — qui portait le nom du courtier — est effacé",
    !mod.dossiers.has(`${RACINE}/${ROOT}/${ancien}`));

  // Relancer la migration ne doit rien faire : elle doit être idempotente.
  const res2 = await mod.m.migrateDocumentFolders(
    [{ id: 'd1', portfolio_id: ENVELOPPES[0].id, rel_path: res.updated[0].rel_path }],
    () => nouveau,
  );
  check('migration idempotente (deuxième passage sans effet)',
    res2.deplaces === 0 && res2.updated.length === 0, res2);

  // Un chemin déjà invalide ne doit pas interrompre la migration des autres.
  const res3 = await mod.m.migrateDocumentFolders([
    { id: 'bad', portfolio_id: ENVELOPPES[0].id, rel_path: `${ROOT}/../../evil.pdf` },
  ], () => nouveau);
  check('un chemin invalide est compté en échec, sans exception',
    res3.echecs === 1 && res3.deplaces === 0, res3);

  // Les documents de l'ancienne racine « documents importés » passent sous ROOT, même
  // quand leur sous-dossier porte déjà le nom neutre ; la racine vidée disparaît.
  const ancienneRacine = `${RACINE}/${ANCIENNE_RACINE}`;
  const cheminAncienneRacine = `${ancienneRacine}/${nouveau}/2026-02-01_ifu.pdf`;
  mod.disque.set(cheminAncienneRacine, 'PDF');
  mod.dossiers.add(ancienneRacine);
  const res4 = await mod.m.migrateDocumentFolders([
    { id: 'd2', portfolio_id: ENVELOPPES[0].id, rel_path: `${ANCIENNE_RACINE}/${nouveau}/2026-02-01_ifu.pdf` },
  ], () => nouveau);
  check("un document de l'ancienne racine est déplacé",
    res4.deplaces === 1 && res4.updated[0].rel_path === `${ROOT}/${nouveau}/2026-02-01_ifu.pdf`, res4);
  check('le fichier est sous la nouvelle racine',
    mod.disque.has(`${RACINE}/${ROOT}/${nouveau}/2026-02-01_ifu.pdf`) && !mod.disque.has(cheminAncienneRacine));
  check("l'ancienne racine vidée est supprimée", !mod.dossiers.has(ancienneRacine));
}

scenarioMigration().then(() => {
  if (failures) {
    console.error(`\n${failures} échec(s) — le nommage des dossiers de documents est cassé.`);
    process.exit(1);
  }
  console.log('\nLes dossiers de documents ne révèlent rien, et la migration fonctionne.');
}).catch((e) => { console.error('Erreur inattendue :', e); process.exit(1); });

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * make-latest-json.js — Writes latest.json, the file the application reads to find out
 * whether a newer version exists (see src-tauri/src/mise_a_jour.rs).
 *
 * For each published installer it records the download address and the signature made
 * with the update key (the `.sig` file written next to it by `tauri signer sign`). The
 * application only runs an installer whose signature matches the public key it embeds.
 *
 * Usage:  node scripts/make-latest-json.js <artifacts folder> <tag> [<owner/repo>]
 * Used by .github/workflows/release.yml, job `signer`.
 */
const fs = require('fs');
const path = require('path');

const [dossier, tag, depot = 'astarat-code/fructificare'] = process.argv.slice(2);
if (!dossier || !/^v\d+\.\d+\.\d+/.test(tag || '')) {
  console.error('Usage: node scripts/make-latest-json.js <artifacts folder> <vX.Y.Z> [<owner/repo>]');
  process.exit(1);
}

// Plateformes telles que l'application se nomme elle-même, et installateur correspondant.
// macOS reçoit une entrée pour que la recherche y annonce aussi la nouvelle version ;
// l'application n'y installe rien elle-même et renvoie vers la page de téléchargement.
const CIBLES = [
  { plateformes: ['windows-x86_64'], motif: /_x64-setup\.exe$/, requis: true },
  { plateformes: ['linux-x86_64'], motif: /\.AppImage$/, requis: true },
  { plateformes: ['darwin-aarch64', 'darwin-x86_64'], motif: /\.dmg$/, requis: false },
];

const fichiers = fs.readdirSync(dossier);
const platforms = {};
for (const { plateformes, motif, requis } of CIBLES) {
  const trouves = fichiers.filter((f) => motif.test(f));
  if (trouves.length === 0 && !requis) continue;
  if (trouves.length !== 1) {
    console.error(`Attendu exactement un fichier ${motif} dans ${dossier}, trouvé : ${trouves.join(', ') || 'aucun'}`);
    process.exit(1);
  }
  const [nom] = trouves;
  const sig = path.join(dossier, `${nom}.sig`);
  if (!fs.existsSync(sig)) {
    console.error(`Signature absente : ${sig}`);
    process.exit(1);
  }
  const entree = {
    signature: fs.readFileSync(sig, 'utf8').trim(),
    url: `https://github.com/${depot}/releases/download/${tag}/${encodeURIComponent(nom)}`,
  };
  plateformes.forEach((p) => { platforms[p] = entree; });
}

const contenu = {
  version: tag.replace(/^v/, ''),
  notes: `https://github.com/${depot}/blob/${tag}/CHANGELOG.md`,
  pub_date: new Date().toISOString(),
  platforms,
};
fs.writeFileSync(path.join(dossier, 'latest.json'), `${JSON.stringify(contenu, null, 2)}\n`);
console.log(`latest.json : version ${contenu.version}, ${Object.keys(platforms).join(', ')}`);

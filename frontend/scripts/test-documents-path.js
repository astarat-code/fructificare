// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * test-documents-path.js — Checks the validation of document paths.
 *
 * `rel_path` is read from a backup file the user may have received from a third party. If
 * it were not validated, a path containing ".." would escape the application's folder:
 * openPath() would then run an arbitrary file from the user profile (openPath =
 * ShellExecute on Windows), and remove() would delete one.
 *
 * This test extracts _relPathSegments() from the real module — not a copy — and confronts
 * it with the known attack vectors.
 *
 * Usage:  npm run test:security
 */
const fs = require('fs');
const path = require('path');

const SERVICE = path.join(__dirname, '..', 'src', 'services', 'documentService.js');
const src = fs.readFileSync(SERVICE, 'utf8');
const ROOT_FOLDER = /const ROOT_FOLDER = '([^']+)'/.exec(src)[1];
const LEGACY_ROOT_FOLDER = /const LEGACY_ROOT_FOLDER = '([^']+)'/.exec(src)[1];
const body = src.slice(src.indexOf('const _SEGMENT_RE'), src.indexOf('/** Reconstruit le chemin absolu'));
const _relPathSegments = new Function('ROOT_FOLDER', 'LEGACY_ROOT_FOLDER', body + '\nreturn _relPathSegments;')(ROOT_FOLDER, LEGACY_ROOT_FOLDER);

// [chemin, doit être accepté, description]
const CASES = [
  [
    "documents imp/pea-a1b2/2026-01-05_releve.pdf",
    true,
    "chemin légitime"
  ],
  [
    "documents importés/pea-a1b2/2026-01-05_releve.pdf",
    true,
    "ancienne racine, avant migration"
  ],
  [
    "documents/pea-a1b2/2026-01-05_releve.pdf",
    false,
    "racine voisine"
  ],
  [
    "documents imp/global/2026-01-05_avis-opere.pdf",
    true,
    "dossier global"
  ],
  [
    "documents imp/pea-a1b2/2026-01-05_Mon Releve.PDF",
    true,
    "espaces + extension majuscule"
  ],
  [
    "documents imp/../../../../Windows/System32/calc.exe",
    false,
    "remontée vers System32"
  ],
  [
    "documents imp/pea/../../../../AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup/x.bat",
    false,
    "dossier Démarrage (persistance)"
  ],
  [
    "../../../../Users/Public/payload.exe",
    false,
    "remontée sans préfixe"
  ],
  [
    "documents imp/../save/save-2026-01-01-1200.json",
    false,
    "accès aux sauvegardes"
  ],
  [
    "documents imp/pea/..",
    false,
    "segment .. seul"
  ],
  [
    "documents imp/./pea/x.pdf",
    false,
    "segment ."
  ],
  [
    "C:\\Windows\\System32\\calc.exe",
    false,
    "chemin absolu Windows"
  ],
  [
    "/etc/passwd",
    false,
    "chemin absolu POSIX"
  ],
  [
    "documents imp/pea/x.exe",
    false,
    "extension exécutable"
  ],
  [
    "documents imp/pea/x.pdf.exe",
    false,
    "double extension"
  ],
  [
    "documents imp/pea/x.lnk",
    false,
    "raccourci Windows"
  ],
  [
    "documents imp/pea\\..\\x.pdf",
    false,
    "antislash comme séparateur"
  ],
  [
    "autre-dossier/pea/x.pdf",
    false,
    "racine différente"
  ],
  [
    "documents imp/pea/sous/x.pdf",
    false,
    "profondeur excessive"
  ],
  [
    "documents imp/x.pdf",
    false,
    "profondeur insuffisante"
  ],
  [
    null,
    false,
    "null"
  ],
  [
    "",
    false,
    "chaîne vide"
  ],
  [
    "documents imp/pea/x%2e%2e%2fy.pdf",
    false,
    "encodage URL"
  ],
  [
    "documents imp/pea/\u0000x.pdf",
    false,
    "octet nul"
  ],
  [
    "documents imp/pea/ x.pdf",
    false,
    "segment commençant par un espace"
  ]
];

let failures = 0;
for (const [input, shouldPass, label] of CASES) {
  let accepted = true;
  try { _relPathSegments(input); } catch (_) { accepted = false; }
  const pass = accepted === shouldPass;
  if (!pass) failures++;
  console.log(`${pass ? 'OK   ' : 'ECHEC'}  ${shouldPass ? 'accepté' : 'refusé '}  ${label}`);
  if (!pass) console.log(`         -> ${JSON.stringify(input)} a été ${accepted ? 'ACCEPTÉ' : 'REFUSÉ'}`);
}

console.log(`\n${CASES.length - failures}/${CASES.length} tests réussis`);
if (failures) {
  console.error(`\n${failures} échec(s) — la validation des chemins de documents est cassée.`);
  process.exit(1);
}

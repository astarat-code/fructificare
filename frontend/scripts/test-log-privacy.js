// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * test-log-privacy.js — The diagnostic log must contain no sensitive data.
 *
 * The log is exported in plain text from the Settings, including when backup encryption
 * is on. It is also the file a user spontaneously sends to report a problem. Leaving an
 * amount, an envelope name or a file name in it amounts to publishing one's net worth
 * through the back door.
 *
 * The check is static: it re-reads the addLog() calls in the sources and refuses any
 * interpolation of a sensitive field. That is the kind of rule that gets lost over time
 * if nothing guards it.
 *
 * Usage:  npm run test:security
 */
const fs = require('fs');
const path = require('path');

const SERVICES = path.join(__dirname, '..', 'src', 'services');

// Champs dont la valeur ne doit jamais atteindre le journal.
const INTERDITS = [
  'amount', 'total_value', 'net_amount', 'balance', 'monthly_need',
  'unit_price', 'fees_amount', 'income', 'salary', 'revenu',
  'name', 'rel_path', 'filename', 'path', 'note', 'pseudo', 'username',
];

// Ces noms de champ sont acceptés : ce sont des identifiants ou des catégories, pas
// des données personnelles. `portfolio_id` identifie une enveloppe sans la nommer.
const TOLERES = ['portfolio_id', 'id', 'type', 'category', 'recurrence', 'date', 'next_date'];

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`OK     ${label}`);
  } else {
    failures += 1;
    console.log(`ECHEC  ${label}`);
    if (detail !== undefined) console.log(`         -> ${detail}`);
  }
}

const fichiers = fs.readdirSync(SERVICES).filter((f) => f.endsWith('.js'));
let appels = 0;
const fautifs = [];

for (const fichier of fichiers) {
  const src = fs.readFileSync(path.join(SERVICES, fichier), 'utf8');
  const lignes = src.split('\n');

  lignes.forEach((ligne, i) => {
    if (!ligne.includes('addLog(')) return;
    appels += 1;

    // Champ RÉELLEMENT lu : le dernier segment du chemin pointé. Prendre le premier
    // signalait « note.date » comme sensible à cause du nom de l'objet, pas du champ.
    const champs = [];
    for (const expr of ligne.matchAll(/\$\{([^}]*)\}/g)) {
      for (const chemin of expr[1].matchAll(/(?:[A-Za-z_][A-Za-z0-9_]*\s*\.\s*)*([A-Za-z_][A-Za-z0-9_]*)/g)) {
        champs.push(chemin[1]);
      }
    }

    for (const champ of champs) {
      if (TOLERES.includes(champ)) continue;
      if (INTERDITS.includes(champ)) {
        fautifs.push(`${fichier}:${i + 1} — interpole « ${champ} »`);
      }
    }
  });
}

check(`${appels} appels à addLog() analysés`, appels > 0);
check('aucun champ sensible interpolé dans le journal',
  fautifs.length === 0, fautifs.join('\n         -> '));

// Le rappel doit rester à côté de la fonction : c'est lui qui évite la régression.
const dataService = fs.readFileSync(path.join(SERVICES, 'dataService.js'), 'utf8');
check("la règle est documentée au-dessus d'addLog()",
  /NE JAMAIS Y ÉCRIRE DE DONNÉE SENSIBLE/.test(dataService));

if (failures) {
  console.error(`\n${failures} échec(s) — le journal de diagnostic expose des données sensibles.`);
  process.exit(1);
}
console.log('\nLe journal de diagnostic ne contient aucune donnée sensible.');

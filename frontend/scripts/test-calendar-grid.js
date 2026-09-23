// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * test-calendar-grid.js — Does the calendar grid put every day under the right weekday,
 * in France?
 *
 * Regression: each cell was built at midnight local time then converted to UTC
 * (toISOString), which is the day before in Paris — the whole grid was shifted by one day
 * and the last day of the month disappeared.
 *
 * Usage:  npm run test:rules
 */
process.env.TZ = 'Europe/Paris';

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'CalendarPage.js'), 'utf8');
const extraire = (nom) => {
  const debut = src.indexOf(`function ${nom}(`);
  if (debut < 0) throw new Error(`${nom} introuvable dans CalendarPage.js`);
  let i = src.indexOf('{', debut), prof = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') prof++;
    else if (src[i] === '}' && --prof === 0) break;
  }
  return src.slice(debut, i + 1);
};
const { buildCalendarGrid } = new Function(
  `${extraire('getDayOfWeek')}\n${extraire('buildCalendarGrid')}\nreturn { buildCalendarGrid };`,
)();

let failures = 0;
function check(label, ok, detail) {
  if (ok) console.log(`OK     ${label}`);
  else { failures += 1; console.log(`ECHEC  ${label}\n         -> ${detail}`); }
}

const JOURS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
for (const [annee, mois] of [[2026, 8], [2026, 2], [2024, 1], [2026, 11]]) {
  const cases = buildCalendarGrid(annee, mois);
  const jours = cases.filter(Boolean);
  const dernier = new Date(annee, mois + 1, 0).getDate();
  const mm = String(mois + 1).padStart(2, '0');
  check(`${mm}/${annee} : du 1er au ${dernier}, sans trou ni jour d'un autre mois`,
    jours.length === dernier && jours[0] === `${annee}-${mm}-01` && jours[dernier - 1] === `${annee}-${mm}-${dernier}`,
    `obtenu ${jours[0]} … ${jours[jours.length - 1]} (${jours.length} jours)`);
  const idx = cases.indexOf(`${annee}-${mm}-01`);
  const attendu = (new Date(annee, mois, 1).getDay() + 6) % 7;
  check(`${mm}/${annee} : le 1er tombe un ${JOURS[attendu]}`, idx % 7 === attendu, `colonne ${JOURS[idx % 7]}`);
}

console.log(failures === 0 ? '\nGrille du calendrier alignée.' : `\n${failures} écart(s) dans la grille du calendrier.`);
process.exit(failures === 0 ? 0 : 1);

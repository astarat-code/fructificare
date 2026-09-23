// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * test-avatars.js — Do the avatar mottos tell the truth?
 *
 * A motto that quotes an amount ("€10,000: a real rampart…") is a promise made to the
 * user. Reused as-is on another tier — which happened with the Legend, repeating "the
 * million is in sight" at the billion mark — it becomes false without anything crashing.
 * This test compares every quoted amount with the tier's threshold.
 *
 * Usage:  npm run test:rules
 */
const fs = require('fs');
const path = require('path');

// Chargement du vrai service ; dataService n'est pas utile aux listes de paliers.
const src = fs
  .readFileSync(path.join(__dirname, '..', 'src', 'services', 'avatarService.js'), 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/^export default .*$/m, '')
  .replace(/^export \{[\s\S]*?\};$/m, '')
  .replace(/^export /gm, '');
const { AVATAR_STEPS, PRESTIGE_STEPS } = new Function(
  'dataService',
  `${src}\nreturn { AVATAR_STEPS, PRESTIGE_STEPS };`,
)({});

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

/** Montants cités dans une devise française, en euros. */
function montantsFr(texte) {
  const t = texte.toLowerCase().replace(/[  ]/g, ' ');
  const res = [];
  for (const m of t.matchAll(/(\d[\d ]*)\s*€/g)) res.push(Number(m[1].replace(/ /g, '')));
  for (const m of t.matchAll(/(\d+(?:,\d+)?)\s*millions?/g)) res.push(Number(m[1].replace(',', '.')) * 1e6);
  for (const m of t.matchAll(/(\d+(?:,\d+)?)\s*milliards?/g)) res.push(Number(m[1].replace(',', '.')) * 1e9);
  const sansChiffres = t.replace(/\d+(?:,\d+)?\s*milli(?:on|ard)s?/g, '');
  if (/demi-million/.test(sansChiffres)) res.push(5e5);
  else if (/\bmillion\b/.test(sansChiffres)) res.push(1e6);
  if (/demi-milliard/.test(sansChiffres)) res.push(5e8);
  else if (/\bmilliard\b/.test(sansChiffres)) res.push(1e9);
  return res;
}

/** Montants cités dans une devise anglaise, en euros. */
function montantsEn(texte) {
  const t = texte.toLowerCase();
  const res = [];
  // (?![\d,]) empêche le retour arrière de lire « €1 » dans « €10 million ».
  for (const m of t.matchAll(/€(\d[\d,]*)(?![\d,])(?!\s*(?:million|billion))/g)) res.push(Number(m[1].replace(/,/g, '')));
  for (const m of t.matchAll(/€(\d+(?:\.\d+)?)\s*million/g)) res.push(Number(m[1]) * 1e6);
  for (const m of t.matchAll(/€(\d+(?:\.\d+)?)\s*billion/g)) res.push(Number(m[1]) * 1e9);
  const sansChiffres = t.replace(/€\d+(?:\.\d+)?\s*(?:million|billion)/g, '');
  if (/half a million/.test(sansChiffres)) res.push(5e5);
  else if (/\bmillion\b/.test(sansChiffres)) res.push(1e6);
  if (/half a billion/.test(sansChiffres)) res.push(5e8);
  else if (/\bbillion\b/.test(sansChiffres)) res.push(1e9);
  return res;
}

/**
 * Un montant cité doit être celui du palier, ou le cap suivant quand la devise
 * l'annonce (« … est en vue ») : on accepte l'intervalle [seuil ; 2 × seuil].
 */
const plausible = (montant, seuil) => montant >= seuil && montant <= Math.max(2 * seuil, 1);

function verifierSerie(nom, paliers) {
  for (const p of paliers) {
    for (const [langue, devise, extraire] of [['FR', p.deviseFr, montantsFr], ['EN', p.deviseEn, montantsEn]]) {
      check(`${nom} ${p.labelFr} (${p.threshold} €) — devise ${langue} présente`, typeof devise === 'string' && devise.length > 5);
      const cites = extraire(devise || '');
      const faux = cites.filter(m => !plausible(m, p.threshold));
      check(`${nom} ${p.labelFr} (${p.threshold} €) — montant cité cohérent (${langue})`, faux.length === 0,
        { devise, montantsCites: cites });
    }
  }
}

verifierSerie('Épopée', AVATAR_STEPS);
verifierSerie('Légende', PRESTIGE_STEPS);

// La Légende a ses propres devises : aucune n'est la copie d'un palier standard.
const standards = new Set(AVATAR_STEPS.flatMap(s => [s.deviseFr, s.deviseEn]));
const copies = PRESTIGE_STEPS.filter(s => standards.has(s.deviseFr) || standards.has(s.deviseEn)).map(s => s.labelFr);
check('aucune devise de la Légende ne reprend celle d’un palier standard', copies.length === 0, copies);

// Garde-fous du test lui-même : il doit savoir repérer l'erreur d'origine.
check('le test détecte « Le million est en vue » placé au milliard',
  montantsFr('Le million est en vue.').some(m => !plausible(m, 1e9)));
check('le test détecte « 1 000 € » placé à 2 M€',
  montantsFr("1 000 € : l'aventure commence vraiment.").some(m => !plausible(m, 2e6)));
check('le test lit « €2 million » en anglais',
  montantsEn('€2 million: the adventure resumes.').includes(2e6));

console.log(failures === 0
  ? `\nDevises cohérentes : ${AVATAR_STEPS.length + PRESTIGE_STEPS.length} paliers vérifiés.`
  : `\n${failures} écart(s) dans les devises des avatars.`);
process.exit(failures === 0 ? 0 : 1);

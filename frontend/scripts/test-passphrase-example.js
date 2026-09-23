// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * test-passphrase-example.js — The example passphrase must be genuinely random.
 *
 * A predictable example would be worse than no example: users adopt it, and a predictable
 * phrase is a known phrase. This test therefore checks that:
 *   • the draw goes through the cryptographic generator, never through Math.random;
 *   • it is uniform — a bias would favour some words and lower the real strength;
 *   • the list follows its own rules (no duplicate, no accent);
 *   • two consecutive displays do not give the same phrase.
 *
 * Usage:  npm run test:security
 */
const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');

const SOURCE = path.join(__dirname, '..', 'src', 'lib', 'passphraseExample.js');
const texte = fs.readFileSync(SOURCE, 'utf8');

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

// ── Chargement du module réel, avec un compteur sur le générateur cryptographique ──
// `globalThis.crypto` est en lecture seule sous Node récent : l'affecter échoue sans
// bruit, et le compteur resterait à zéro. On passe donc un `globalThis` de substitution
// en paramètre de la fonction qui enveloppe le module — il masque le vrai à l'intérieur.
let appelsCrypto = 0;
const globalSubstitue = {
  crypto: {
    getRandomValues: (tableau) => { appelsCrypto += 1; return webcrypto.getRandomValues(tableau); },
  },
};
const code = texte.replace(/^export .*$/gm, '');
const { WORDS, genererPhraseExemple, forceEnBits } =
  new Function('globalThis', `${code}\nreturn { WORDS, genererPhraseExemple, forceEnBits };`)(globalSubstitue);

// ── Source : aucun générateur non cryptographique ──────────────────────────────
const sansCommentaires = texte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
check("aucun appel à Math.random dans le module", !/Math\.random/.test(sansCommentaires));

// ── Liste ──────────────────────────────────────────────────────────────────────
check('au moins 1 024 mots (≥ 50 bits pour cinq mots)', WORDS.length >= 1024, WORDS.length);
check('aucun doublon', new Set(WORDS).size === WORDS.length,
  WORDS.filter((m, i) => WORDS.indexOf(m) !== i));
const horsRegle = WORDS.filter((m) => !/^[a-z]{4,8}$/.test(m));
check('minuscules sans accent, 4 à 8 lettres', horsRegle.length === 0, horsRegle);
check('force annoncée cohérente avec la liste',
  Math.abs(forceEnBits(5) - 5 * Math.log2(WORDS.length)) < 1e-9 && forceEnBits(5) >= 50,
  forceEnBits(5));

// ── Tirage ─────────────────────────────────────────────────────────────────────
appelsCrypto = 0;
const phrase = genererPhraseExemple();
const mots = phrase.split(' ');
check('cinq mots par défaut', mots.length === 5, phrase);
check('chaque mot vient de la liste', mots.every((m) => WORDS.includes(m)), phrase);
check('le tirage a consulté le générateur cryptographique', appelsCrypto >= 5, appelsCrypto);
check('longueur suffisante pour la validation (≥ 8 caractères)', phrase.length >= 8, phrase);

const vues = new Set();
for (let i = 0; i < 200; i += 1) vues.add(genererPhraseExemple());
check('200 tirages : aucune phrase répétée', vues.size === 200, vues.size);

// Uniformité : chaque mot a une chance sur N. Sur 1 150 000 tirages, un mot sort en
// moyenne 1 000 fois. On compare au khi-deux : très au-delà de la valeur attendue, le
// tirage serait biaisé (par exemple un `% N` naïf sur un tampon trop petit).
const TIRAGES = WORDS.length * 1000;
const compte = new Map(WORDS.map((m) => [m, 0]));
for (let i = 0; i < TIRAGES; i += 1) {
  const m = genererPhraseExemple(1);
  compte.set(m, compte.get(m) + 1);
}
const attendu = TIRAGES / WORDS.length;
let khi2 = 0;
for (const n of compte.values()) khi2 += ((n - attendu) ** 2) / attendu;
// Degrés de liberté k = N−1 ; espérance k, écart-type √(2k). Seuil large : +6 écarts-types.
const k = WORDS.length - 1;
const seuil = k + 6 * Math.sqrt(2 * k);
check(`tirage uniforme (khi² = ${khi2.toFixed(0)}, seuil ${seuil.toFixed(0)})`, khi2 < seuil);
check('tous les mots de la liste peuvent sortir', [...compte.values()].every((n) => n > 0));

if (failures) {
  console.error(`\n${failures} échec(s) — l'exemple de phrase secrète n'est pas fiable.`);
  process.exit(1);
}
console.log("\nL'exemple de phrase secrète est tiré uniformément par le générateur cryptographique.");

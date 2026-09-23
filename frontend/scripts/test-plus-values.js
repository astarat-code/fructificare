// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * test-plus-values.js — Does the estimated capital gain follow the partial-withdrawal rule?
 *
 * Rule: gain = R − P × R / V, where P is NET deposits (reduced by the capital already
 * returned through previous withdrawals) and V the envelope's value on the day of the
 * withdrawal. The expected figures below are computed by hand from that formula — not
 * read back from the program.
 *
 * Usage:  npm run test:rules
 */
const fs = require('fs');
const path = require('path');

const lib = (f) => fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', f), 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/^export /gm, '');
const { plusValuesDeLAnnee } = new Function(
  `${lib('taxableWithdrawal.js')}\n${lib('plusValuesRachats.js')}\nreturn { plusValuesDeLAnnee };`,
)();

let failures = 0;
function check(label, obtenu, attendu, tolerance = 0.01) {
  const ok = Math.abs(obtenu - attendu) <= tolerance;
  if (ok) console.log(`OK     ${label} (${obtenu.toFixed(2)} €)`);
  else { failures += 1; console.log(`ECHEC  ${label}\n         -> obtenu ${obtenu.toFixed(2)} €, attendu ${attendu.toFixed(2)} €`); }
}

const dep = (date, amount, extra = {}) => ({ type: 'deposit', date, amount, net_amount: amount, ...extra });
const ret = (date, amount, extra = {}) => ({ type: 'withdrawal', date, amount, net_amount: amount, ...extra });
const cal = (date, total_value) => ({ date, total_value });

// 1. Un seul rachat : 100 000 € versés, contrat à 150 000 €, rachat de 50 000 €.
//    gain = 50 000 − 100 000 × 50 000 / 150 000 = 16 666,67 €
check('rachat unique (assurance vie)',
  plusValuesDeLAnnee({ typeEnveloppe: 'assurance_vie', annee: 2026,
    transactions: [dep('2018-01-10', 100000), ret('2026-06-01', 50000)],
    calibrations: [cal('2026-05-01', 150000)] }).gains,
  16666.67);

// 2. Deux rachats sur deux années : les versements nets diminuent après le premier.
//    2025 : P = 100 000, V = 150 000, R = 50 000 → capital remboursé 33 333,33 → P = 66 666,67
//    2026 : V = 110 000, R = 20 000 → gain = 20 000 − 66 666,67 × 20 000 / 110 000 = 7 878,79 €
//    (l'ancienne formule, avec les versements bruts, donnait 7 500 €)
const deuxAns = {
  typeEnveloppe: 'assurance_vie',
  transactions: [dep('2015-03-01', 100000), ret('2025-06-01', 50000), ret('2026-06-01', 20000)],
  calibrations: [cal('2025-05-01', 150000), cal('2026-05-01', 110000)],
};
check('second rachat : versements nets diminués du premier', plusValuesDeLAnnee({ ...deuxAns, annee: 2026 }).gains, 7878.79);
check('premier rachat : année précédente inchangée', plusValuesDeLAnnee({ ...deuxAns, annee: 2025 }).gains, 16666.67);

// 3. Calibration POSTÉRIEURE au retrait : on remonte la valeur avant la sortie d'argent.
//    10 000 versés, retrait sorti de 6 000 en juin, positions à 9 000 en septembre.
//    V avant retrait = 9 000 + 6 000 = 15 000 → gain = 6 000 − 10 000 × 6 000 / 15 000 = 2 000 €
check('calibration après le retrait (retrait sorti)',
  plusValuesDeLAnnee({ typeEnveloppe: 'CTO', annee: 2026,
    transactions: [dep('2026-01-10', 10000), ret('2026-06-10', 6000)],
    calibrations: [cal('2026-09-01', 9000)] }).gains,
  2000);

// 4. Crypto vendue, euros gardés en espèces : la valeur totale inclut les espèces.
//    Positions 9 000 + espèces 6 000 = 15 000 → même gain de 2 000 €
check('crypto vendue et conservée en espèces',
  plusValuesDeLAnnee({ typeEnveloppe: 'CTO', annee: 2026,
    transactions: [dep('2026-01-10', 10000, { asset_type: 'crypto' }), ret('2026-06-10', 6000, { asset_type: 'crypto', keep_in_cash: true })],
    calibrations: [cal('2026-09-01', 9000)] }).gains,
  2000);

// 5. PEA : une vente conservée en espèces n'est pas un retrait imposable.
check('PEA, vente gardée en espèces : aucun gain imposable',
  plusValuesDeLAnnee({ typeEnveloppe: 'PEA', annee: 2026,
    transactions: [dep('2020-01-10', 10000), ret('2026-06-10', 6000, { keep_in_cash: true })],
    calibrations: [cal('2026-09-01', 9000)] }).gains,
  0);

// 6. Sans calibration : valeur inconnue → gain estimé nul.
check('sans calibration : gain nul',
  plusValuesDeLAnnee({ typeEnveloppe: 'assurance_vie', annee: 2026,
    transactions: [dep('2020-01-10', 10000), ret('2026-06-10', 3000)],
    calibrations: [] }).gains,
  0);

// 7. Enveloppe en perte : pas d'impôt négatif.
check('enveloppe en moins-value : gain plancher à zéro',
  plusValuesDeLAnnee({ typeEnveloppe: 'assurance_vie', annee: 2026,
    transactions: [dep('2020-01-10', 10000), ret('2026-06-10', 3000)],
    calibrations: [cal('2026-06-01', 8000)] }).gains,
  0);

// 8. Versement survenu entre la calibration (antérieure) et le retrait.
//    Cal. mars 12 000 pour 10 000 versés ; versement de 3 000 en avril ; retrait de 5 000 en mai.
//    V = 12 000 + 3 000 = 15 000 ; P = 13 000 → gain = 5 000 − 13 000 × 5 000 / 15 000 = 666,67 €
check('versement entre la calibration et le retrait',
  plusValuesDeLAnnee({ typeEnveloppe: 'assurance_vie', annee: 2026,
    transactions: [dep('2020-01-10', 10000), dep('2026-04-01', 3000), ret('2026-05-01', 5000)],
    calibrations: [cal('2026-03-01', 12000)] }).gains,
  666.67);

// 9. Espèces internes puis rachat sorti, calibration après les deux.
//    10 000 versés ; vente de 2 000 gardée en espèces (arbitrage interne, non imposable
//    en assurance vie) ; rachat sorti de 4 000 en juin ; positions à 9 000 en septembre.
//    Valeur à la calibration = 9 000 + 2 000 d'espèces = 11 000 ; avant le rachat, on
//    rajoute les 4 000 sortis → V = 15 000.
//    gain = 4 000 − 10 000 × 4 000 / 15 000 = 1 333,33 €
check('espèces internes et rachat sorti',
  plusValuesDeLAnnee({ typeEnveloppe: 'assurance_vie', annee: 2026,
    transactions: [dep('2020-01-10', 10000), ret('2026-02-01', 2000, { keep_in_cash: true }), ret('2026-06-01', 4000)],
    calibrations: [cal('2026-09-01', 9000)] }).gains,
  1333.33);

console.log(failures === 0
  ? '\nRègle des rachats partiels respectée.'
  : `\n${failures} écart(s) sur la règle des rachats partiels.`);
process.exit(failures === 0 ? 0 : 1);

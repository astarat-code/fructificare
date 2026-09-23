// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * test-taxable-withdrawal.js — Which sale triggers taxation, and at which rate?
 *
 * This rule decides what is taxed in the tax report. A mistake here crashes nothing: it
 * produces a wrong figure, copied as-is onto a tax return. Hence this test, which pins
 * the expected behavior envelope by envelope.
 *
 * Usage:  npm run test:rules
 */
const fs = require('fs');
const path = require('path');

// Chargement du module réel (ESM → CommonJS par simple retrait du mot-clé export).
const src = fs
  .readFileSync(path.join(__dirname, '..', 'src', 'lib', 'taxableWithdrawal.js'), 'utf8')
  .replace(/^export /gm, '');
const { estRetraitImposable } = new Function(`${src}\nreturn { estRetraitImposable };`)();

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

const vente = (extra) => ({ type: 'withdrawal', amount: 1000, ...extra });

// ── Crypto : la conversion en euros est le fait générateur ────────────────────
check(
  'crypto vendue, euros conservés en espèces → imposable',
  estRetraitImposable(vente({ asset_type: 'crypto', keep_in_cash: true }), 'CTO') === true,
);
check(
  'crypto vendue, argent sorti → imposable',
  estRetraitImposable(vente({ asset_type: 'crypto' }), 'CTO') === true,
);

// ── Compte-titres ordinaire : imposable dès la cession ────────────────────────
check(
  'CTO, actions vendues, argent conservé en espèces → imposable',
  estRetraitImposable(vente({ asset_type: 'action', keep_in_cash: true }), 'CTO') === true,
);

// ── Enveloppes à imposition différée : rien tant que l'argent reste dedans ────
for (const type of ['PEA', 'PER', 'assurance_vie']) {
  check(
    `${type}, vente conservée en espèces → NON imposable (report jusqu'à la sortie)`,
    estRetraitImposable(vente({ asset_type: 'action', keep_in_cash: true }), type) === false,
  );
  check(
    `${type}, retrait qui sort de l'enveloppe → imposable`,
    estRetraitImposable(vente({ asset_type: 'action' }), type) === true,
  );
}

// ── Types sans régime fiscal calculé : on retient la sortie d'argent ──────────
check(
  'livret réglementé, retrait → compté comme sortie',
  estRetraitImposable(vente({ asset_type: 'fond_euro' }), 'compte_réglementé') === true,
);
check(
  'enveloppe personnalisée, vente conservée en espèces → non comptée',
  estRetraitImposable(vente({ asset_type: 'action', keep_in_cash: true }), 'custom') === false,
);

// ── Garde-fous ────────────────────────────────────────────────────────────────
check('un versement n\'est jamais un retrait imposable',
  estRetraitImposable({ type: 'deposit', asset_type: 'crypto' }, 'CTO') === false);
check('absence de transaction → false, sans exception',
  estRetraitImposable(null, 'CTO') === false);
check('type d\'enveloppe inconnu → repli sur la sortie d\'argent',
  estRetraitImposable(vente({ asset_type: 'action', keep_in_cash: true }), undefined) === false);

// ── Barème appliqué aux plus-values, selon l'enveloppe et son ancienneté ──────
// calculateTax vit dans dataService : on l'extrait en neutralisant les imports, et
// on lui fournit le module de maturité dont dépend désormais la règle du PEA.
const lib = (f) => fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', f), 'utf8').replace(/^export /gm, '');
const srcData = fs
  .readFileSync(path.join(__dirname, '..', 'src', 'services', 'dataService.js'), 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/^export default .*$/m, '')
  .replace(/^export \{[\s\S]*?\};$/m, '');
const { calculateTax } = new Function(
  `${lib('taxMaturity.js')}
${lib('taxableWithdrawal.js')}
${srcData}
return { calculateTax };`,
)();

const GAINS = 1000;
const peaAncien = calculateTax('PEA', 20000, 5000, GAINS, '2015-01-01', 2026);
check('PEA de plus de 5 ans : aucun impôt sur le revenu',
  peaAncien.income_tax === 0, peaAncien);
check('PEA de plus de 5 ans : prélèvements sociaux seuls (18,6 %)',
  peaAncien.social_charges === 186 && peaAncien.total_tax === 186, peaAncien);

const peaRecent = calculateTax('PEA', 20000, 5000, GAINS, '2024-06-01', 2026);
check('PEA de moins de 5 ans : flat tax 31,4 %',
  peaRecent.total_tax === 314 && peaRecent.income_tax === 128, peaRecent);

const peaSansDate = calculateTax('PEA', 20000, 5000, GAINS, null, 2026);
check("PEA sans date d'ouverture : flat tax, et le rapport le signale",
  peaSansDate.total_tax === 314 && /non renseign/.test(peaSansDate.details), peaSansDate);

const cto = calculateTax('CTO', 20000, 5000, GAINS, '2015-01-01', 2026);
check("CTO : flat tax 31,4 %, quelle que soit l'ancienneté",
  cto.total_tax === 314, cto);

const avVieux = calculateTax('assurance_vie', 20000, 5000, GAINS, '2010-01-01', 2026);
check('assurance vie de plus de 8 ans : abattement appliqué, PS seuls sur 1 000 €',
  avVieux.income_tax === 0 && avVieux.social_charges === 186, avVieux);

console.log(
  failures === 0
    ? '\nRègles fiscales conformes (ventes imposables et barèmes).'
    : `\n${failures} écart(s) sur les règles fiscales.`,
);
process.exit(failures === 0 ? 0 : 1);

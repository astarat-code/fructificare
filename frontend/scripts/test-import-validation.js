// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * test-import-validation.js — Checks the sanitization of imported backups.
 *
 * A backup is untrusted JSON: received from someone else, or edited by hand. This test
 * confronts importValidation.js with hostile or corrupted shapes, and checks that a
 * legitimate backup goes through validation WITHOUT LOSS — that is the more important
 * half: validation that is too strict would destroy user data.
 *
 * Usage:  npm run test:security
 */
const fs = require('fs');
const path = require('path');

// Le module est en syntaxe ESM ; on retire les mots-clés d'export pour l'évaluer ici.
const SOURCE = path.join(__dirname, '..', 'src', 'services', 'importValidation.js');
const src = fs.readFileSync(SOURCE, 'utf8')
  .replace(/^export default .*$/m, '')
  .replace(/^export \{[^}]*\};$/m, '');
const { validateBackup, sanitize } = new Function(
  src + '\nreturn { validateBackup, sanitize };',
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

// ── 1. Une sauvegarde légitime traverse sans perte ─────────────────────────────

const legitimate = {
  portfolios: [
    { id: 'p1', name: 'PEA', type: 'PEA', annual_fees_pct: 0.5, annual_return_rate: 7, color: '#5FA88D' },
    { id: 'p2', name: 'Livret A', type: 'compte_réglementé', regulated_subtype: 'livret_a', annual_fees_pct: 0 },
  ],
  transactions: [
    {
      id: 't1', portfolio_id: 'p1', type: 'deposit', date: '2026-01-15',
      amount: 1000, fees_pct: 0.5, fees_amount: 5, net_amount: 995,
      asset_type: 'action', note: 'ETF World', quantity: 12, unit_price: 82.9,
      keep_in_cash: false, from_cash_amount: 0, new_funds_amount: 995,
      champ_futur_inconnu: 'doit être conservé',
    },
    { id: 't2', portfolio_id: 'p1', type: 'withdrawal', date: '2026-03-02', amount: 200, keep_in_cash: true },
  ],
  calibrations: [{ id: 'c1', portfolio_id: 'p1', date: '2026-06-30', total_value: 1180.44 }],
  documents: [{ id: 'd1', portfolio_id: 'p1', rel_path: 'documents importés/pea-a1b2/2026-01-05_releve.pdf', filename: '2026-01-05_releve.pdf' }],
  regular_movements: [{ id: 'rm1', portfolio_id: 'p1', amount: 300 }],
  simulations: [{ id: 's1', name: 'Base', portfolios: [], transactions: [] }],
  fire_settings: { monthly_need: 2200, withdrawal_rate: 3.5 },
  gamification: { xp: 1200, badges: { premiere_enveloppe: true } },
  appPreferences: { theme: 'dark', lang: 'fr' },
};

const legit = validateBackup(legitimate);
check('sauvegarde légitime : aucune entrée écartée', legit.totalDropped === 0, legit.dropped);
check('sauvegarde légitime : 2 enveloppes conservées', legit.data.portfolios.length === 2);
check('sauvegarde légitime : 2 transactions conservées', legit.data.transactions.length === 2);
check('sauvegarde légitime : calibration conservée', legit.data.calibrations.length === 1);
check('sauvegarde légitime : document conservé', legit.data.documents.length === 1);
check('sauvegarde légitime : simulation conservée', legit.data.simulations.length === 1);
check('champ inconnu préservé (le format évolue)',
  legit.data.transactions[0].champ_futur_inconnu === 'doit être conservé');
check('valeurs numériques intactes',
  legit.data.transactions[0].net_amount === 995 && legit.data.calibrations[0].total_value === 1180.44);
check('gamification préservée', legit.data.gamification.xp === 1200);
check('préférences préservées', legit.data.appPreferences.theme === 'dark');
check('fire_settings préservés',
  legit.data.fire_settings.monthly_need === 2200 && legit.data.fire_settings.withdrawal_rate === 3.5);

// ── 2. Pollution de prototype ──────────────────────────────────────────────────

const polluted = sanitize(JSON.parse('{"a":1,"__proto__":{"pollue":true},"b":{"constructor":{"x":1}}}'));
check('clé __proto__ retirée', !Object.prototype.hasOwnProperty.call(polluted, '__proto__'), Object.keys(polluted));
check('clé constructor retirée', !Object.prototype.hasOwnProperty.call(polluted.b, 'constructor'), polluted.b);
check("prototype d'Object non pollué", {}.pollue === undefined);

// ── 3. Nombres non finis ───────────────────────────────────────────────────────

const nan = validateBackup({
  portfolios: [{ id: 'p1', name: 'X' }],
  transactions: [
    { id: 't1', portfolio_id: 'p1', type: 'deposit', date: '2026-01-01', amount: 100, net_amount: 'abc' },
    { id: 't2', portfolio_id: 'p1', type: 'deposit', date: '2026-01-01', amount: 'pas un nombre' },
  ],
  calibrations: [{ id: 'c1', portfolio_id: 'p1', date: '2026-01-01', total_value: null }],
});
check('net_amount non numérique ramené à 0', nan.data.transactions[0].net_amount === 0, nan.data.transactions[0].net_amount);
check('transaction sans montant valide écartée', nan.data.transactions.length === 1, nan.data.transactions);
check('calibration sans valeur écartée', nan.data.calibrations.length === 0, nan.data.calibrations);
check('Infinity remplacé par null', sanitize({ v: Infinity }).v === null);

// ── 4. Types inattendus ────────────────────────────────────────────────────────

const wrong = validateBackup({
  portfolios: [{ id: 'p1', name: 'X' }],
  transactions: { pas: 'un tableau' },
  calibrations: 'chaîne',
  reminders: [null, 42, 'texte', ['imbriqué'], { id: 'r1' }],
  fire_settings: 'invalide',
  gamification: [1, 2, 3],
});
check('collection non-tableau → tableau vide', Array.isArray(wrong.data.transactions) && wrong.data.transactions.length === 0);
check('collection chaîne → tableau vide', Array.isArray(wrong.data.calibrations) && wrong.data.calibrations.length === 0);
check('entrées non-objet écartées', wrong.data.reminders.length === 1 && wrong.data.reminders[0].id === 'r1', wrong.data.reminders);
check('fire_settings invalide → valeurs par défaut',
  wrong.data.fire_settings.monthly_need === 2500 && wrong.data.fire_settings.withdrawal_rate === 4);
check('gamification non-objet → null', wrong.data.gamification === null);

// ── 5. Chemins de documents hostiles ───────────────────────────────────────────

const docs = validateBackup({
  portfolios: [{ id: 'p1', name: 'X' }],
  documents: [
    { id: 'd1', rel_path: 'documents importés/pea/ok.pdf' },
    { id: 'd2', rel_path: 'documents importés/../../../../Windows/System32/calc.exe' },
    { id: 'd3', rel_path: 'documents importés/pea/../../x.pdf' },
    { id: 'd4', rel_path: 'documents importés/pea/payload.exe' },
    { id: 'd5', rel_path: 'C:' + String.fromCharCode(92) + 'Windows' + String.fromCharCode(92) + 'calc.exe' },
    { id: 'd6' },
  ],
});
check('seul le document au chemin valide est conservé', docs.data.documents.length === 1, docs.data.documents.map((d) => d.id));
check('5 documents hostiles écartés et comptés', docs.dropped.documents === 5, docs.dropped);

// ── 6. Bornes défensives ───────────────────────────────────────────────────────

let deep = { v: 1 };
for (let i = 0; i < 200; i += 1) deep = { nested: deep };
check('profondeur excessive tronquée sans exception', sanitize(deep) !== undefined);
check('chaîne très longue tronquée', sanitize({ s: 'x'.repeat(200000) }).s.length === 100000);

// ── 7. Types de transaction ────────────────────────────────────────────────────

const types = validateBackup({
  portfolios: [{ id: 'p1', name: 'X' }],
  transactions: [
    { id: 'a', portfolio_id: 'p1', type: 'deposit', date: '2026-01-01', amount: 1 },
    { id: 'b', portfolio_id: 'p1', type: 'withdrawal', date: '2026-01-01', amount: 1 },
    { id: 'c', portfolio_id: 'p1', type: 'stress_crash', date: '2026-01-01', amount: 1 },
    { id: 'd', portfolio_id: 'p1', type: 'inconnu', date: '2026-01-01', amount: 1 },
    { id: 'e', portfolio_id: 'p1', type: 'deposit', date: 'pas-une-date', amount: 1 },
    { id: 'f', portfolio_id: '', type: 'deposit', date: '2026-01-01', amount: 1 },
  ],
});
check('3 types valides conservés, 3 entrées écartées',
  types.data.transactions.length === 3 && types.dropped.transactions === 3,
  { gardees: types.data.transactions.map((t) => t.id), ecartees: types.dropped.transactions });

// ── Bilan ──────────────────────────────────────────────────────────────────────

if (failures) {
  console.error(`\n${failures} échec(s) — l'assainissement des imports est cassé.`);
  process.exit(1);
}
console.log('\nTous les tests de validation d\'import sont passés.');

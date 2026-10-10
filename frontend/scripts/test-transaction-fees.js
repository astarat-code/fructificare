// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * test-transaction-fees.js — Are transaction fees kept out of the invested amount?
 *
 * Rule: whatever the fee convention, `net_amount` is the amount invested and
 * `net_amount + fees_amount` is the amount paid. A €75 order with a €1 fee on top
 * (the usual broker presentation) therefore shows €76 of deposits and €75 invested;
 * a €76 payment from which €1 is deducted shows exactly the same two figures.
 *
 * The real dataService is loaded, with its imports replaced by stubs, so that the test
 * exercises the code the application runs.
 *
 * Usage:  npm run test:rules
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const lib = (f) => fs.readFileSync(path.join(SRC, 'lib', f), 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/^export default .*$/m, '')
  .replace(/^export /gm, '');
const service = fs.readFileSync(path.join(SRC, 'services', 'dataService.js'), 'utf8')
  .replace(/^import [\s\S]*?;$/gm, '')
  .replace(/^export default .*$/m, '')
  .replace(/^export \{[\s\S]*?\};$/m, '');
const stubs = `
  const storageService = { scheduleSave() {}, save() {} };
  const gamificationService = { setPersistHook() {}, exportForJSON() { return {}; }, importFromJSON() {}, onMovementRecorded() {}, getState() { return {}; } };
  const validateBackup = (d) => ({ data: d, dropped: {}, totalDropped: 0 });
  const documentService = {};
  const estRetraitImposable = () => false;
  const plusValuesDeLAnnee = () => ({ gains: 0 });
  const getTaxMaturity = () => null;
`;
const charger = () => new Function(
  `${stubs}\n${lib('systemLanguage.js')}\n${lib('peaCap.js')}\n${lib('transactionFees.js')}\n${service}
   return { setData, getData, getPortfolios, createTransaction, updateTransaction, normaliserFraisAjoutes };`,
)();

let failures = 0;
function check(label, obtenu, attendu, tolerance = 0.005) {
  const ok = Math.abs(obtenu - attendu) <= tolerance;
  if (ok) console.log(`OK     ${label} (${obtenu.toFixed(2)} €)`);
  else { failures += 1; console.log(`ECHEC  ${label}\n         -> obtenu ${obtenu.toFixed(2)} €, attendu ${attendu.toFixed(2)} €`); }
}

const enveloppe = { id: 'p1', name: 'CTO', type: 'CTO', annual_fees_pct: 0 };
const nouveau = (transactions = []) => {
  const ds = charger();
  ds.setData({ portfolios: [{ ...enveloppe }], transactions });
  return ds;
};
const achat = (extra) => ({ type: 'deposit', date: '2026-01-05', fees_type: 'euro', asset_type: 'action', ...extra });

// 1. Frais EN PLUS : ordre de 75 €, 1 € de frais → 76 € payés, 75 € investis.
{
  const ds = nouveau();
  const tx = ds.createTransaction('p1', achat({ amount: 75, fees_pct: 1, fee_direction: 'added' }));
  const p = ds.getPortfolios()[0];
  check('frais en plus — montant investi du mouvement', tx.net_amount, 75);
  check('frais en plus — versements affichés', p.total_paid, 76);
  check('frais en plus — versements nets affichés', p.net_paid, 76);
  check('frais en plus — base du rendement', p.total_deposits, 75);
  check('frais en plus — solde investi', p.balance, 75);
  check('frais en plus — frais des versements', p.deposit_fees, 1);
}

// 2. Frais DÉDUITS : 76 € payés, 1 € de frais → mêmes chiffres que le cas 1.
{
  const ds = nouveau();
  const tx = ds.createTransaction('p1', achat({ amount: 76, fees_pct: 1, fee_direction: 'deducted' }));
  const p = ds.getPortfolios()[0];
  check('frais déduits — montant investi du mouvement', tx.net_amount, 75);
  check('frais déduits — versements affichés', p.total_paid, 76);
  check('frais déduits — base du rendement', p.total_deposits, 75);
  check('frais déduits — solde investi', p.balance, 75);
}

// 3. Frais en pourcentage, en plus : 1 000 € à 0,5 % → 1 005 € payés, 1 000 € investis.
{
  const ds = nouveau();
  ds.createTransaction('p1', achat({ amount: 1000, fees_pct: 0.5, fees_type: 'percent', fee_direction: 'added' }));
  const p = ds.getPortfolios()[0];
  check('frais en % en plus — versements affichés', p.total_paid, 1005);
  check('frais en % en plus — base du rendement', p.total_deposits, 1000);
}

// 4. Passage d'un mouvement de « déduits » à « en plus » : le montant investi suit.
{
  const ds = nouveau();
  const tx = ds.createTransaction('p1', achat({ amount: 75, fees_pct: 1, fee_direction: 'deducted' }));
  check('modification — avant', tx.net_amount, 74);
  const apres = ds.updateTransaction('p1', tx.id, { fee_direction: 'added' });
  check('modification — après passage en « frais en plus »', apres.net_amount, 75);
}

// 5. Données antérieures : un « frais en plus » enregistré avec net = montant + frais
//    est ramené à net = montant au chargement, y compris sans champ fee_direction.
{
  const ancien = (extra) => ({ id: 'a', portfolio_id: 'p1', type: 'deposit', date: '2025-03-01',
    amount: 535.38, fees_amount: 1.87, net_amount: 537.25, new_funds_amount: 537.25, from_cash_amount: 0, ...extra });
  const avecChamp = nouveau([ancien({ fee_direction: 'added' })]);
  check('ancien mouvement (champ présent) — investi', avecChamp.getData().transactions[0].net_amount, 535.38);
  check('ancien mouvement (champ présent) — versements affichés', avecChamp.getPortfolios()[0].total_paid, 537.25);
  check('ancien mouvement (champ présent) — base du rendement', avecChamp.getPortfolios()[0].total_deposits, 535.38);
  const sansChamp = nouveau([ancien({})]);
  check('ancien mouvement (champ absent) — investi', sansChamp.getData().transactions[0].net_amount, 535.38);
  check('ancien mouvement (champ absent) — versements affichés', sansChamp.getPortfolios()[0].total_paid, 537.25);
  // Un second chargement ne doit rien changer.
  const txs = sansChamp.getData().transactions;
  const corriges = sansChamp.normaliserFraisAjoutes(txs).length;
  check('ancien mouvement — second passage sans effet', corriges, 0);
}

// 6. Achat payé pour moitié avec les espèces de l'enveloppe : seule la moitié des frais
//    est un versement. Vente de 100 € conservée en espèces, puis achat de 200 € + 2 €.
{
  const ds = nouveau();
  ds.createTransaction('p1', achat({ amount: 500, fees_pct: 0 }));
  ds.createTransaction('p1', { type: 'withdrawal', date: '2026-02-01', amount: 100, fees_pct: 0, keep_in_cash: true, asset_type: 'action' });
  const tx = ds.createTransaction('p1', achat({ date: '2026-03-01', amount: 200, fees_pct: 2, fee_direction: 'added' }));
  const p = ds.getPortfolios()[0];
  check('achat mixte — part payée par les espèces', tx.from_cash_amount, 100);
  check('achat mixte — argent neuf investi', tx.new_funds_amount, 100);
  check('achat mixte — versements affichés (500 + 100 + 1)', p.total_paid, 601);
  check('achat mixte — base du rendement (500 + 100)', p.total_deposits, 600);
  check('achat mixte — espèces restantes', p.cash_balance, 0);
}

// 7. Vente avec frais : 100 € vendus, 1 € de frais déduits → 99 € reçus, 100 € sortis.
{
  const ds = nouveau();
  ds.createTransaction('p1', achat({ amount: 500, fees_pct: 0 }));
  const tx = ds.createTransaction('p1', { type: 'withdrawal', date: '2026-02-01', amount: 100, fees_pct: 1, fees_type: 'euro', asset_type: 'action' });
  const p = ds.getPortfolios()[0];
  check('vente — montant reçu', tx.net_amount, 99);
  check('vente — solde investi restant', p.balance, 400);
}

if (failures) { console.log(`\n${failures} vérification(s) en échec.`); process.exit(1); }
console.log('\nToutes les vérifications passent.');

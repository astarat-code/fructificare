// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * test-recurring-edit.js — Does editing a recurring movement leave the past alone?
 *
 * A recurring movement records one movement per occurrence. Editing it used to delete
 * every one of them and record them again with the new settings: turning a €150 monthly
 * purchase into a €1,200 sale rewrote eight months of history as eight €1,200 sales.
 * The change now applies from a date chosen by the user; what was recorded before that
 * date stays as it was.
 *
 * The real dataService is loaded, with its imports replaced by stubs. The clock is fixed
 * so that the occurrences are the same on every run.
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

// Horloge figée au 10 octobre 2026 : « aujourd'hui » ne dépend pas du jour du test.
const AUJOURDHUI = '2026-10-10T12:00:00Z';
const horloge = `
  class Date extends VraieDate {
    constructor(...a) { if (a.length) super(...a); else super('${AUJOURDHUI}'); }
    static now() { return new VraieDate('${AUJOURDHUI}').getTime(); }
  }
`;
const stubs = `
  const storageService = { scheduleSave() {}, save() {} };
  const gamificationService = { setPersistHook() {}, exportForJSON() { return {}; }, importFromJSON() {}, onMovementRecorded() {}, getState() { return {}; }, dispatchEvent() {} };
  const validateBackup = (d) => ({ data: d, dropped: {}, totalDropped: 0 });
  const documentService = {};
  const estRetraitImposable = () => false;
  const plusValuesDeLAnnee = () => ({ gains: 0 });
  const getTaxMaturity = () => null;
  const require = () => ({ default: null });
`;
const charger = () => new Function('VraieDate',
  `${horloge}\n${stubs}\n${lib('systemLanguage.js')}\n${lib('peaCap.js')}\n${lib('transactionFees.js')}\n${service}
   return { setData, getData, getPortfolios, createTransaction, createRegularMovement, updateRegularMovement, countRecurringOccurrencesFrom, syncRegularMovements, getRecurringOverdraws, confirmRecurringOverdraw };`,
)(Date);

console.debug = () => {}; // le service détaille chaque échéance en mode développement

let failures = 0;
function check(label, obtenu, attendu) {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (ok) console.log(`OK     ${label}`);
  else { failures += 1; console.log(`ECHEC  ${label}\n         -> obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`); }
}

function nouveau() {
  const ds = charger();
  ds.setData({ portfolios: [{ id: 'p1', name: 'Assurance vie', type: 'assurance_vie', annual_fees_pct: 0 }], transactions: [] });
  // Achat mensuel de 150 €, du 1er janvier au 1er octobre 2026 : 10 échéances,
  // réparties 60 % fonds euros et 40 % actions → 20 lignes.
  const rm = ds.createRegularMovement({
    portfolio_id: 'p1', type: 'deposit', amount: 150, start_date: '2026-01-01', recurrence: 'monthly',
    asset_allocations: [{ type: 'fond_euro', pct: 60 }, { type: 'action', pct: 40 }],
    asset_types: ['fond_euro', 'action'],
  });
  return { ds, rm };
}
const lignes = (ds, rm) => ds.getData().transactions.filter(t => t.from_recurring_id === rm.id);
const parDate = (ds, rm) => {
  const r = {};
  lignes(ds, rm).forEach(t => { r[t.date] = Math.round(((r[t.date] || 0) + (t.type === 'deposit' ? 1 : -1) * t.amount) * 100) / 100; });
  return Object.keys(r).sort().map(d => `${d.slice(5, 7)}:${r[d]}`).join(' ');
};

// 0. État de départ.
{
  const { ds, rm } = nouveau();
  check('départ — 10 échéances de 150 €', parDate(ds, rm),
    '01:150 02:150 03:150 04:150 05:150 06:150 07:150 08:150 09:150 10:150');
  check('départ — 20 lignes (2 actifs par échéance)', lignes(ds, rm).length, 20);
}

// 1. Montant porté à 200 € à partir du 1er juillet : janvier à juin restent à 150 €.
{
  const { ds, rm } = nouveau();
  const avant = lignes(ds, rm).filter(t => t.date < '2026-07-01').map(t => t.id).sort();
  ds.updateRegularMovement(rm.id, { amount: 200 }, { effectiveFrom: '2026-07-01' });
  check('montant à partir de juillet — passé conservé', parDate(ds, rm),
    '01:150 02:150 03:150 04:150 05:150 06:150 07:200 08:200 09:200 10:200');
  check('montant à partir de juillet — les lignes d\'avant sont les mêmes (non recréées)',
    lignes(ds, rm).filter(t => t.date < '2026-07-01').map(t => t.id).sort(), avant);
  const journal = ds.getData().regular_movements[0].historique_modifications;
  check('journal — une entrée, avec ancienne et nouvelle valeur et date d\'effet',
    journal.map(j => [j.champ, j.ancienneValeur, j.nouvelleValeur, j.aPartirDu]), [['montant', 150, 200, '2026-07-01']]);
  // Un nouveau passage (démarrage suivant) ne recrée rien avant juillet.
  ds.syncRegularMovements();
  check('montant à partir de juillet — stable au démarrage suivant', lignes(ds, rm).length, 20);
}

// 2. Sans date précisée : la modification vaut à partir d'aujourd'hui, le passé reste.
//    C'est le cas du rapport de bogue : achat de 150 € changé en retrait de 1 200,08 €.
{
  const { ds, rm } = nouveau();
  ds.updateRegularMovement(rm.id, { type: 'withdrawal', amount: 1200.08 });
  check('par défaut — aucune échéance passée n\'est réécrite', parDate(ds, rm),
    '01:150 02:150 03:150 04:150 05:150 06:150 07:150 08:150 09:150 10:150');
  const p = ds.getPortfolios()[0];
  check('par défaut — versements intacts', p.total_deposits, 1500);
  check('par défaut — aucun retrait créé', p.total_withdrawals, 0);
}

// 3. « Depuis le début » : tout l'historique est refait, sur demande explicite.
{
  const { ds, rm } = nouveau();
  ds.updateRegularMovement(rm.id, { amount: 100 }, { effectiveFrom: '2026-01-01' });
  check('depuis le début — tout est refait', parDate(ds, rm),
    '01:100 02:100 03:100 04:100 05:100 06:100 07:100 08:100 09:100 10:100');
}

// 4. Rythme changé (mensuel → trimestriel) à partir de juillet : les anciennes dates
//    d'avant juillet ne sont ni supprimées ni recréées sur la nouvelle grille.
{
  const { ds, rm } = nouveau();
  ds.updateRegularMovement(rm.id, { recurrence: 'quarterly' }, { effectiveFrom: '2026-07-01' });
  check('rythme à partir de juillet', parDate(ds, rm),
    '01:150 02:150 03:150 04:150 05:150 06:150 07:150 10:150');
}

// 5. Une modification qui ne touche pas aux mouvements (note, date de fin) ne refait rien,
//    même si le formulaire renvoie tous les champs.
{
  const { ds, rm } = nouveau();
  const avant = lignes(ds, rm).map(t => t.id).sort();
  ds.updateRegularMovement(rm.id, {
    portfolio_id: 'p1', type: 'deposit', amount: 150, start_date: '2026-01-01', recurrence: 'monthly',
    asset_allocations: [{ type: 'fond_euro', pct: 60 }, { type: 'action', pct: 40 }],
    asset_types: ['fond_euro', 'action'], note: 'Nouveau libellé',
  }, { effectiveFrom: '2026-01-01' });
  check('note seule — aucune ligne recréée', lignes(ds, rm).map(t => t.id).sort(), avant);
  check('note seule — rien au journal', ds.getData().regular_movements[0].historique_modifications.length, 0);
}

// 6. Une date d'effet future est ramenée à aujourd'hui.
{
  const { ds, rm } = nouveau();
  ds.updateRegularMovement(rm.id, { amount: 300 }, { effectiveFrom: '2027-01-01' });
  check('date future — ramenée à aujourd\'hui, passé intact', parDate(ds, rm),
    '01:150 02:150 03:150 04:150 05:150 06:150 07:150 08:150 09:150 10:150');
  check('date future — date d\'effet enregistrée', ds.getData().regular_movements[0].applies_from, '2026-10-10');
}

// 7. Décompte annoncé à l'utilisateur avant d'enregistrer.
{
  const { ds, rm } = nouveau();
  check('décompte — échéances à partir de juillet', ds.countRecurringOccurrencesFrom(rm.id, '2026-07-01'), 4);
  check('décompte — tout l\'historique', ds.countRecurringOccurrencesFrom(rm.id, null), 10);
}

// 8. Retrait récurrent qui dépasse le contenu de l'enveloppe : la série s'arrête à
//    l'échéance fautive et attend la décision de l'utilisateur.
{
  const ds = charger();
  ds.setData({ portfolios: [{ id: 'p1', name: 'CTO', type: 'CTO', annual_fees_pct: 0 }], transactions: [] });
  ds.createTransaction('p1', { type: 'deposit', date: '2026-01-02', amount: 1000, fees_pct: 0, asset_type: 'action' });
  // 400 € par mois à partir de juillet : juillet et août passent (800 €), septembre non.
  const rm = ds.createRegularMovement({ portfolio_id: 'p1', type: 'withdrawal', amount: 400, start_date: '2026-07-01', recurrence: 'monthly', asset_types: ['action'], note: 'Rente' });
  check('retrait récurrent — échéances possibles appliquées', parDate(ds, rm), '07:-400 08:-400');
  const attente = ds.getRecurringOverdraws();
  check('retrait récurrent — mise en attente à la première échéance impossible',
    attente.map(a => [a.date, a.amount, a.disponible, a.portfolio]), [['2026-09-01', 400, 200, 'CTO']]);
  ds.syncRegularMovements();
  check('retrait récurrent — rien de plus sans confirmation', parDate(ds, rm), '07:-400 08:-400');
  // Un versement rend l'échéance possible : l'attente disparaît d'elle-même.
  const ds2 = charger();
  ds2.setData({ portfolios: [{ id: 'p1', name: 'CTO', type: 'CTO', annual_fees_pct: 0 }], transactions: [] });
  ds2.createTransaction('p1', { type: 'deposit', date: '2026-01-02', amount: 1000, fees_pct: 0, asset_type: 'action' });
  const rm2 = ds2.createRegularMovement({ portfolio_id: 'p1', type: 'withdrawal', amount: 400, start_date: '2026-07-01', recurrence: 'monthly', asset_types: ['action'] });
  ds2.createTransaction('p1', { type: 'deposit', date: '2026-08-15', amount: 5000, fees_pct: 0, asset_type: 'action' });
  ds2.syncRegularMovements();
  check('retrait récurrent — repris après un versement', parDate(ds2, rm2), '07:-400 08:-400 09:-400 10:-400');
  check('retrait récurrent — plus d\'attente après un versement', ds2.getRecurringOverdraws().length, 0);
  // Confirmation : la série reprend, et ne redemande plus.
  ds.confirmRecurringOverdraw(rm.id);
  check('retrait récurrent — repris après confirmation', parDate(ds, rm), '07:-400 08:-400 09:-400 10:-400');
  check('retrait récurrent — plus d\'attente après confirmation', ds.getRecurringOverdraws().length, 0);
  // Changer le montant annule la confirmation.
  ds.updateRegularMovement(rm.id, { amount: 500 });
  check('retrait récurrent — la confirmation ne survit pas à un changement de montant', ds.getData().regular_movements[0].allow_overdraw, false);
}

if (failures) { console.log(`\n${failures} vérification(s) en échec.`); process.exit(1); }
console.log('\nToutes les vérifications passent.');

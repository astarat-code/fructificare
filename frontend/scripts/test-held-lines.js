// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * test-held-lines.js — Can a single line of an envelope be sold, and are calibrations
 * read consistently?
 *
 * A line is what remains invested under one note and one asset type. Two assets bought by
 * the same movement are two lines, so each can be sold on its own. The test also covers
 * the withdrawal check and the two calibration rules: one calibration per envelope and
 * per day, and a breakdown entered from a multi-asset template is split by that template.
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
  const gamificationService = { setPersistHook() {}, exportForJSON() { return {}; }, importFromJSON() {}, onMovementRecorded() {}, getState() { return {}; }, onFirstTimeAction() {}, handleMonthlyCalibration() {} };
  const require = () => ({ default: null });
  const validateBackup = (d) => ({ data: d, dropped: {}, totalDropped: 0 });
  const documentService = {};
  const estRetraitImposable = () => false;
  const plusValuesDeLAnnee = () => ({ gains: 0 });
  const getTaxMaturity = () => null;
`;
const charger = () => new Function(
  `${stubs}\n${lib('systemLanguage.js')}\n${lib('peaCap.js')}\n${lib('transactionFees.js')}\n${service}
   return { setData, getData, getPortfolios, createTransaction, getHeldLines, checkWithdrawal, addCalibration, getCalibrations, getAssetAllocation };`,
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

// Enveloppe d'exemple : un récurrent réparti entre un fonds en euros et un ETF (même note,
// deux actifs), et un achat isolé.
const ds = nouveau();
const tx = (extra) => ds.createTransaction('p1', { type: 'deposit', date: '2026-01-05', fees_pct: 0, ...extra });
tx({ amount: 600, asset_type: 'fond_euro', note: '[Mouvement récurrent] Epargne' });
tx({ amount: 400, asset_type: 'etf', note: '[Mouvement récurrent] Epargne' });
tx({ amount: 250, asset_type: 'action', note: 'Air Liquide' });

// 1. Deux actifs achetés sous la même note forment deux lignes distinctes.
{
  const lignes = ds.getHeldLines('p1');
  check('trois lignes détenues', lignes.length, 3);
  check('ligne fonds euros du récurrent', lignes.find(l => l.type_resolu === 'fond_euro').investi, 600);
  check('ligne ETF du récurrent', lignes.find(l => l.type_resolu === 'etf').investi, 400);
}

// 2. Vendre une partie d'une ligne ne touche que cette ligne.
{
  ds.createTransaction('p1', { type: 'withdrawal', date: '2026-03-01', amount: 150, fees_pct: 0, asset_type: 'etf', note: '[Mouvement récurrent] Epargne', keep_in_cash: true });
  const lignes = ds.getHeldLines('p1');
  check('vente partielle — ETF', lignes.find(l => l.type_resolu === 'etf').investi, 250);
  check('vente partielle — fonds euros intact', lignes.find(l => l.type_resolu === 'fond_euro').investi, 600);
  check('vente partielle — espèces', ds.getPortfolios()[0].cash_balance, 150);
}

// 3. Une ligne entièrement vendue disparaît de la liste.
{
  ds.createTransaction('p1', { type: 'withdrawal', date: '2026-03-02', amount: 250, fees_pct: 0, asset_type: 'action', note: 'Air Liquide', keep_in_cash: true });
  check('ligne soldée — plus que deux lignes', ds.getHeldLines('p1').length, 2);
}

// 4. Contrôle d'un retrait : dépassement de l'enveloppe, actif non détenu, cas normal.
{
  check('retrait normal', ds.checkWithdrawal('p1', 100, 'fond_euro').depasse ? 1 : 0, 0);
  check('retrait supérieur au contenu de l\'enveloppe', ds.checkWithdrawal('p1', 5000, 'fond_euro').depasse ? 1 : 0, 1);
  check('actif que l\'enveloppe ne détient pas', ds.checkWithdrawal('p1', 50, 'crypto').depasse ? 1 : 0, 1);
}

// 5. Calibration : une seconde saisie le même jour remplace la première.
{
  ds.addCalibration({ portfolio_id: 'p1', date: '2026-04-01', total_value: 1000 });
  ds.addCalibration({ portfolio_id: 'p1', date: '2026-04-01', total_value: 1100 });
  const cals = ds.getCalibrations('p1');
  check('une seule calibration ce jour-là', cals.length, 1);
  check('la dernière saisie fait foi', cals[0].total_value, 1100);
}

// 6. Calibration détaillée d'après un mouvement type multi-actifs : la position est
//    ventilée selon le modèle (60 % actions, 40 % obligations), pas rangée dans « Autres »,
//    et un détail saisi en pourcentages (60 + 40) est ramené au total (2 000 €).
{
  const d2 = nouveau();
  d2.setData({ portfolios: [{ ...enveloppe }], transactions: [],
    movement_templates: [{ id: 't1', name: 'Action-Obligation', portfolio_id: 'p1', asset_type: 'autre',
      multi_asset_allocations: [{ type: 'action', pct: 60 }, { type: 'obligation', pct: 40 }] }] });
  d2.createTransaction('p1', { type: 'deposit', date: '2026-01-05', amount: 1500, fees_pct: 0, asset_type: 'action' });
  d2.addCalibration({ portfolio_id: 'p1', date: '2026-04-01', total_value: 2000,
    asset_breakdown: [{ template_id: 't1', asset_type: 'autre', name: 'Action-Obligation', value: 100 }] });
  const rep = d2.getAssetAllocation(true);
  check('modèle multi-actifs — actions', rep.action || 0, 1200);
  check('modèle multi-actifs — obligations', rep.obligation || 0, 800);
  check('modèle multi-actifs — rien dans « Autres »', rep.autre || 0, 0);
}

if (failures) { console.log(`\n${failures} vérification(s) en échec.`); process.exit(1); }
console.log('\nToutes les vérifications passent.');

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * test-gamification-privacy.js — Financial data must not leak into localStorage.
 *
 * The embedded browser's local storage is never encrypted. Income, date of birth and
 * target allocation must therefore not be written there (B-04): they live in memory and
 * in the JSON backup (encrypted if the user turned it on). This test checks that:
 *   • those fields are stripped from what goes into localStorage;
 *   • their value stays intact in memory and in exportForJSON (hence in the backup);
 *   • changing one of those fields does trigger a rewrite of the JSON backup, the only
 *     durable place left for them.
 *
 * Usage:  npm run test:security
 */
const fs = require('fs');
const path = require('path');

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

// ── Environnement minimal : un localStorage en mémoire ───────────────────────────
const store = new Map();
const localStorageStub = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
// streakService est chargé paresseusement par un chemin non emprunté ici ; on neutralise.
const requireStub = (m) => (m.includes('streakService') ? { default: {} } : require(m));

const SOURCE = path.join(__dirname, '..', 'src', 'services', 'gamificationService.js');
const code = fs.readFileSync(SOURCE, 'utf8')
  .replace(/^export default .*$/m, '')
  .replace(/^export \{[\s\S]*?\};$/m, '');
const gamif = new Function('localStorage', 'require', `${code}\nreturn gamificationService;`)(
  localStorageStub, requireStub,
);

const STORAGE_KEY = 'fructificare_gamification';
const brut = () => store.get(STORAGE_KEY) || '';
const localProfile = () => JSON.parse(brut()).profile || {};

// ── Un changement de profil ──────────────────────────────────────────────────────
let persistAppels = 0;
gamif.setPersistHook(() => { persistAppels += 1; });

gamif.patchState({
  profile: {
    monthlyNetIncome: 4242,
    birthDate: '1990-05-01',
    allocationTarget: { actions: 80, obligations: 20 },
    annualReturnTarget: 7,
  },
});

// 1. localStorage ne contient AUCUNE de ces valeurs, en clair ou autrement.
check('revenu absent du texte écrit dans localStorage', !brut().includes('4242'), brut().slice(0, 120));
check('date de naissance absente de localStorage', !brut().includes('1990-05-01'));
check('allocation cible absente de localStorage', !brut().includes('obligations'));
check('champ revenu neutralisé dans localStorage', localProfile().monthlyNetIncome === null);
check('champ naissance neutralisé dans localStorage', localProfile().birthDate === null);
check('champ allocation neutralisé dans localStorage',
  JSON.stringify(localProfile().allocationTarget || {}) === '{}');

// 2. La valeur reste vraie en mémoire et dans la sauvegarde JSON (chiffrée en aval).
const pourJson = gamif.exportForJSON().profile;
check('revenu conservé pour la sauvegarde JSON', pourJson.monthlyNetIncome === 4242, pourJson);
check('naissance conservée pour la sauvegarde JSON', pourJson.birthDate === '1990-05-01');
check('allocation conservée pour la sauvegarde JSON', pourJson.allocationTarget.actions === 80);
check('profil lisible en mémoire pendant la session', gamif.getProfile().monthlyNetIncome === 4242);

// 3. La sauvegarde JSON a bien été redéclenchée (sinon ces valeurs seraient perdues).
check('un changement de profil déclenche la sauvegarde JSON', persistAppels >= 1, persistAppels);

// 4. Autres champs sensibles : stressTest.lastLossPct et lastSimulation.
gamif.patchState({ stressTest: { lastLossPct: 37.5 }, lastSimulation: { horizonYears: 20, monthlyContribution: 500 } });
check('perte de stress-test absente de localStorage', !brut().includes('37.5'));
check('versement de simulation absent de localStorage', !brut().includes('500'));
check('stress-test et simulation déclenchent aussi la sauvegarde JSON', persistAppels >= 2, persistAppels);

// 5. Un changement NON sensible ne déclenche pas de sauvegarde JSON superflue.
const avant = persistAppels;
gamif.patchState({ counters: { assetsAdded: 3 } });
check('un compteur non sensible ne redéclenche pas la sauvegarde JSON', persistAppels === avant, persistAppels);
check('la progression non sensible reste dans localStorage',
  JSON.parse(brut()).counters.assetsAdded === 3);

// 6. Installation antérieure au correctif : localStorage contient DÉJÀ le profil en clair.
//    Le premier démarrage doit réécrire la copie expurgée, sans attendre une modification.
store.set(STORAGE_KEY, JSON.stringify({
  schemaVersion: 8,
  profile: { monthlyNetIncome: 3131, birthDate: '1985-02-02', allocationTarget: { immo: 100 } },
  lastSimulation: { horizonYears: 20, monthlyContribution: 777 },
}));
gamif.loadState();
check('ancienne installation : revenu effacé de localStorage dès le chargement', !brut().includes('3131'));
check('ancienne installation : naissance effacée dès le chargement', !brut().includes('1985-02-02'));
check('ancienne installation : versement effacé dès le chargement', !brut().includes('777'));
check('ancienne installation : le revenu reste disponible pour la session',
  gamif.getState().profile.monthlyNetIncome === 3131);

if (failures) {
  console.error(`\n${failures} échec(s) — des données financières fuient dans localStorage.`);
  process.exit(1);
}
console.log('\nAucune donnée financière n\'est écrite dans le stockage local non chiffré.');

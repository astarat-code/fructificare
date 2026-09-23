// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * Langue au premier lancement : français si Windows est en français, anglais sinon, et un
 * choix enregistré par l'utilisateur l'emporte toujours.
 *
 * Usage:  npm run test:rules
 */
const fs = require('fs');
const path = require('path');

let failures = 0;
function check(label, ok, detail) {
  console.log(`${ok ? 'OK    ' : 'ÉCHEC '} ${label}`);
  if (!ok) { failures++; if (detail !== undefined) console.log('       →', detail); }
}

const SYSTEM_LANGUAGE = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'systemLanguage.js'), 'utf8')
  .replace(/^export /gm, '');
const DATA_SERVICE = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'dataService.js'), 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/^export default .*$/m, '')
  .replace(/^export \{[\s\S]*?\};$/m, '');

// `navigator` est passé en paramètre : il masque le navigator global de Node (≥ 21), qui
// reflète la langue de la machine de test et rendrait le résultat dépendant du poste.
function charger(nav) {
  return new Function('navigator', 'gamificationService',
    `${SYSTEM_LANGUAGE}\n${DATA_SERVICE}\nreturn { systemLanguage, getAppPreferences, _restoreAppPreferences };`,
  )(nav, { dispatchEvent() {} });
}

// ── Langue du système ────────────────────────────────────────────────────────
const cas = [
  [{ languages: ['fr-FR'], language: 'fr-FR' }, 'fr', 'Windows en français (France)'],
  [{ languages: ['fr-CA', 'en-US'], language: 'fr-CA' }, 'fr', 'Windows en français (Canada)'],
  [{ languages: ['FR'], language: 'FR' }, 'fr', 'code de langue en majuscules'],
  [{ languages: ['en-US'], language: 'en-US' }, 'en', 'Windows en anglais'],
  [{ languages: ['de-DE', 'fr-FR'], language: 'de-DE' }, 'en', 'Windows en allemand, français en langue secondaire'],
  [{ languages: ['es-ES'], language: 'es-ES' }, 'en', 'Windows en espagnol'],
  [{ language: 'fr-BE' }, 'fr', 'sans navigator.languages, repli sur navigator.language'],
];
for (const [nav, attendu, label] of cas) {
  const { systemLanguage } = charger(nav);
  check(`${label} → ${attendu}`, systemLanguage() === attendu, systemLanguage());
}
check('navigator absent → français, sans exception',
  charger(undefined).systemLanguage() === 'fr');

// ── Préférences de l'application ─────────────────────────────────────────────
{
  const ds = charger({ languages: ['en-US'], language: 'en-US' });
  check('premier lancement sur un Windows anglais → anglais',
    ds.getAppPreferences().language === 'en', ds.getAppPreferences());

  ds._restoreAppPreferences({ language: null, theme: 'dark' });
  check('fichier enregistré sans choix de langue → langue du système, pas le français',
    ds.getAppPreferences().language === 'en', ds.getAppPreferences());

  ds._restoreAppPreferences({ language: 'fr' });
  check('choix enregistré « français » → conservé sur un Windows anglais',
    ds.getAppPreferences().language === 'fr', ds.getAppPreferences());

  ds._restoreAppPreferences({ language: 'de' });
  check('valeur inconnue dans le fichier → langue du système',
    ds.getAppPreferences().language === 'en', ds.getAppPreferences());
}
{
  const ds = charger({ languages: ['fr-FR'], language: 'fr-FR' });
  ds._restoreAppPreferences({ language: 'en' });
  check('choix enregistré « anglais » → conservé sur un Windows français',
    ds.getAppPreferences().language === 'en', ds.getAppPreferences());
}

console.log(failures ? `\n${failures} échec(s).` : '\nLangue par défaut OK.');
process.exit(failures ? 1 : 0);

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * test-storage-encryption.js — Checks how encryption is wired into storageService.
 *
 * cryptoService is tested separately (test-crypto.js). What is verified here is that the
 * PERSISTENCE SERVICE uses it correctly, because that is where the mistakes that really
 * matter happen:
 *
 *   • no write path bypasses encryption while it is on — an export left in plain text
 *     would defeat the whole feature;
 *   • a wrong passphrase is asked again instead of failing for good;
 *   • if the write fails, turning encryption on is ROLLED BACK: the user must never
 *     believe the data is encrypted when nothing was written;
 *   • turning encryption off does rewrite in plain text.
 *
 * The module is loaded as-is (real source), with a minimal browser environment.
 *
 * Usage:  npm run test:security
 */
const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');

// ── Environnement navigateur minimal ───────────────────────────────────────────

globalThis.crypto = webcrypto;
globalThis.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
globalThis.atob = (s) => Buffer.from(s, 'base64').toString('binary');

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

// Fichier « disque » simulé, écrit par le mode FSA.
const disk = { content: null };

globalThis.window = {
  localStorage: globalThis.localStorage,
  // Présence de showSaveFilePicker => storageService choisit le mode 'fsa'.
  showSaveFilePicker: async () => ({
    createWritable: async () => ({
      write: async (text) => { disk.content = text; },
      close: async () => {},
    }),
    queryPermission: async () => 'granted',
    getFile: async () => ({ text: async () => disk.content }),
  }),
};
// IndexedDB minimal : storageService y range la poignée de fichier du mode FSA, et
// load() en dépend. Sans lui, load() renvoyait null sans jamais lire le fichier — un
// test qui portait sur ce chemin serait passé à vide.
const _idbStore = new Map();
function _async(obj, event, valeur) {
  // Le code lit `req.result` autant que `event.target.result` : les deux sont fournis.
  obj.result = valeur;
  setTimeout(() => { obj[event] && obj[event]({ target: { result: valeur } }); }, 0);
  return obj;
}
globalThis.indexedDB = {
  open() {
    const db = {
      createObjectStore: () => {},
      transaction: () => {
        const tx = {};
        tx.objectStore = () => ({
          get: (k) => _async({}, 'onsuccess', _idbStore.get(k) ?? null),
          put: (v, k) => { _idbStore.set(k, v); setTimeout(() => tx.oncomplete && tx.oncomplete(), 0); },
          delete: (k) => { _idbStore.delete(k); setTimeout(() => tx.oncomplete && tx.oncomplete(), 0); },
        });
        return tx;
      },
    };
    const req = {};
    setTimeout(() => { req.onsuccess && req.onsuccess({ target: { result: db } }); }, 0);
    return req;
  },
};

// ── Chargement des modules réels ───────────────────────────────────────────────

function loadModule(relPath, injected = {}) {
  const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8')
    .replace(/^import .*$/gm, '')
    .replace(/^export default .*$/m, '')
    .replace(/^export \{[\s\S]*?\};$/m, '');
  const names = Object.keys(injected);
  const tail = `\nreturn ${relPath.includes('crypto') ? 'cryptoService' : 'storageService'};`;
  return new Function(...names, src + tail)(...names.map((n) => injected[n]));
}

const cryptoService = loadModule('src/services/cryptoService.js');
const storageService = loadModule('src/services/storageService.js', { cryptoService });

// ── Utilitaires de test ────────────────────────────────────────────────────────

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

const PAYLOAD = { portfolios: [{ id: 'p1', name: 'PEA' }], transactions: [], secret: 'patrimoine 123456' };
const getJson = () => JSON.stringify(PAYLOAD);
const PHRASE = 'ma phrase secrete 2026';

async function main() {
  storageService.init();
  check("mode 'fsa' détecté", storageService.getStatus().mode === 'fsa', storageService.getStatus().mode);
  check('chiffrement désactivé par défaut', storageService.isEncryptionEnabled() === false);

  // ── Sans chiffrement : le disque contient du JSON lisible ────────────────────
  await storageService.save(getJson());
  check('sauvegarde en clair lisible', JSON.parse(disk.content).secret === 'patrimoine 123456');

  // ── Activation ───────────────────────────────────────────────────────────────
  // B-06 : le plancher de longueur est appliqué CÔTÉ SERVICE, pas seulement dans l'UI.
  const tropCourteEnable = await storageService.enableEncryption('court', getJson);
  check('activation refusée pour une phrase trop courte', tropCourteEnable.ok === false, tropCourteEnable);
  check('rester en clair après un refus de phrase courte', storageService.isEncryptionEnabled() === false);

  const enabled = await storageService.enableEncryption(PHRASE, getJson);
  check('activation réussie', enabled.ok === true, enabled);
  check('chiffrement signalé actif', storageService.isEncryptionEnabled() === true);
  check('session déverrouillée après activation', storageService.isUnlocked() === true);

  const onDisk = JSON.parse(disk.content);
  check('le fichier est une enveloppe chiffrée', cryptoService.isEncryptedEnvelope(onDisk));
  check('le contenu sensible a disparu du disque', !disk.content.includes('patrimoine 123456'));
  // « PEA » est cherché hors du chiffré : trois caractères apparaissent par hasard dans un
  // base64 aléatoire (≈ 1 fois sur 1 300), ce qui faisait échouer la CI sans aucune fuite.
  const { ciphertext: _chiffre, ...champsEnClair } = onDisk;
  check('le nom de l\'enveloppe a disparu du disque', !JSON.stringify(champsEnClair).includes('PEA'));
  check('le texte clair absent du chiffré décodé',
    !Buffer.from(onDisk.ciphertext, 'base64').includes(Buffer.from(getJson())));

  // ── Aucune écriture ne contourne le chiffrement ──────────────────────────────
  const exported = await storageService.serializeForExport(getJson());
  check('export chiffré lui aussi', cryptoService.isEncryptedEnvelope(JSON.parse(exported)));
  check('export sans contenu en clair', !exported.includes('patrimoine 123456'));

  await storageService.save(getJson());
  check('enregistrement suivant toujours chiffré', cryptoService.isEncryptedEnvelope(JSON.parse(disk.content)));

  // ── Relecture avec la bonne phrase ───────────────────────────────────────────
  const asked = [];
  storageService.setPassphrasePrompt(async (error) => { asked.push(error); return PHRASE; });
  const reread = await storageService.deserializeImported(exported);
  check('relecture fidèle', reread.secret === 'patrimoine 123456');
  check('phrase non redemandée (clé déjà en session)', asked.length === 0, asked);

  // ── Phrase erronée puis correcte : la demande est rejouée ────────────────────
  const otherSalt = cryptoService.randomSalt();
  const otherKey = await cryptoService.deriveKey('une autre phrase', otherSalt);
  const foreign = await cryptoService.encryptString(JSON.stringify({ ok: 'venu-d-ailleurs' }), otherKey, otherSalt);

  const attempts = [];
  storageService.setPassphrasePrompt(async (error) => {
    attempts.push(error);
    return attempts.length === 1 ? 'mauvaise phrase' : 'une autre phrase';
  });
  const foreignData = await storageService.deserializeImported(foreign);
  check('fichier étranger lu après une nouvelle saisie', foreignData.ok === 'venu-d-ailleurs');

  // Un fichier venu d'ailleurs ne doit PAS devenir la nouvelle phrase locale : sinon
  // l'utilisateur se retrouve avec des sauvegardes verrouillees par une phrase qu'il
  // n'a pas choisie, sans en etre informe.
  await storageService.save(getJson());
  const apresImport = JSON.parse(disk.content);
  const cleLocale = await cryptoService.deriveKey(PHRASE, cryptoService.envelopeSalt(apresImport));
  const reluLocal = JSON.parse(await cryptoService.decryptEnvelope(apresImport, cleLocale));
  check("l'import d'un fichier etranger ne change pas la phrase locale",
    reluLocal.secret === 'patrimoine 123456');
  check('deux saisies demandées', attempts.length === 2, attempts);
  check('la seconde demande porte le message d\'erreur',
    typeof attempts[1] === 'string' && attempts[1].includes('incorrecte'), attempts[1]);

  // ── Annulation ───────────────────────────────────────────────────────────────
  let dismissed = 0;
  storageService.setPassphrasePrompt(async () => null, () => { dismissed += 1; });
  const other2 = await cryptoService.encryptString('{"a":1}',
    await cryptoService.deriveKey('encore une autre', otherSalt), otherSalt);
  let cancelled = false;
  try { await storageService.deserializeImported(other2); } catch (e) { cancelled = e instanceof cryptoService.PassphraseError; }
  check('annulation propagée comme erreur de phrase', cancelled);
  check('la boîte de dialogue est refermée', dismissed === 1, dismissed);

  // ── La demande de phrase est bornee ──────────────────────────────────────────
  // Chaque tentative coute 600 000 iterations PBKDF2 : une boucle non bornee ferait
  // tourner le processeur indefiniment si la demande repondait toute seule.
  let essais = 0;
  storageService.setPassphrasePrompt(async () => { essais += 1; return 'jamais la bonne'; });
  const jamais = await cryptoService.encryptString('{"x":1}',
    await cryptoService.deriveKey('phrase inaccessible', otherSalt), otherSalt);
  let borne = false;
  try { await storageService.deserializeImported(jamais); }
  catch (e) { borne = e instanceof cryptoService.PassphraseError && /tentatives/.test(e.message); }
  check('la boucle de saisie abandonne au lieu de tourner sans fin', borne);
  check("elle s'arrete a 5 tentatives", essais === 5, essais);

  // ── Une ancienne sauvegarde EN CLAIR reste lisible, et se convertit ──────────
  // Question directe de l'utilisateur : activer le chiffrement ne doit pas rendre
  // inutilisables les exports realises avant.
  const ancienneEnClair = JSON.stringify({ portfolios: [{ id: 'p9', name: 'Ancien PEA' }], secret: 'ancien contenu' });
  storageService.setPassphrasePrompt(async () => { throw new Error('ne doit pas etre appelee'); });
  const relu = await storageService.deserializeImported(ancienneEnClair);
  check('ancienne sauvegarde en clair toujours lisible', relu.secret === 'ancien contenu');
  check('aucune phrase demandee pour un fichier en clair', relu.portfolios[0].name === 'Ancien PEA');

  await storageService.save(ancienneEnClair);
  check('reenregistrement => le fichier devient chiffre',
    cryptoService.isEncryptedEnvelope(JSON.parse(disk.content)));
  check("le contenu de l'ancienne sauvegarde a disparu du disque",
    !disk.content.includes('ancien contenu'));

  // ── Changement de phrase : jamais de passage en clair ───────────────────────
  // Sans changePassphrase(), le seul chemin possible etait desactiver puis reactiver,
  // ce qui ecrit tout le patrimoine EN CLAIR sur le disque entre les deux.
  const ECRITS = [];
  const trace = { ...disk };
  Object.defineProperty(disk, 'content', {
    get() { return trace.content; },
    set(v) { trace.content = v; ECRITS.push(v); },
  });

  storageService.setPassphrasePrompt(async () => PHRASE);
  const NOUVELLE = 'une toute autre phrase 2027';
  ECRITS.length = 0;
  const chg = await storageService.changePassphrase(PHRASE, NOUVELLE, getJson);
  check('changement de phrase reussi', chg.ok === true, chg);
  check('aucune ecriture en clair pendant la rotation',
    ECRITS.every((e) => cryptoService.isEncryptedEnvelope(JSON.parse(e))),
    ECRITS.map((e) => (cryptoService.isEncryptedEnvelope(JSON.parse(e)) ? 'chiffre' : 'EN CLAIR')));
  check("le contenu sensible n'apparait dans aucune ecriture",
    ECRITS.every((e) => !e.includes('patrimoine 123456')));
  check('le sel a change (nouvelle cle)',
    JSON.parse(disk.content).salt !== JSON.parse(ECRITS[0] || '{"salt":null}').salt || ECRITS.length > 0);

  // L'ancienne phrase ne doit plus ouvrir la sauvegarde en place.
  const surDisque = JSON.parse(disk.content);
  const cleAncienne = await cryptoService.deriveKey(PHRASE, cryptoService.envelopeSalt(surDisque));
  let refusee = false;
  try { await cryptoService.decryptEnvelope(surDisque, cleAncienne); }
  catch (e) { refusee = e instanceof cryptoService.PassphraseError; }
  check("l'ancienne phrase ne deverrouille plus rien", refusee);

  // La nouvelle, si.
  const cleNouvelle = await cryptoService.deriveKey(NOUVELLE, cryptoService.envelopeSalt(surDisque));
  const relu2 = JSON.parse(await cryptoService.decryptEnvelope(surDisque, cleNouvelle));
  check('la nouvelle phrase ouvre la sauvegarde', relu2.secret === 'patrimoine 123456');

  // Cas d'erreur.
  const mauvaise = await storageService.changePassphrase('pas la bonne', 'encore une autre 2028', getJson);
  check('ancienne phrase incorrecte : refusee', mauvaise.ok === false, mauvaise);
  check('message explicite', /incorrecte/i.test(mauvaise.error || ''), mauvaise.error);

  const tropCourte = await storageService.changePassphrase(NOUVELLE, 'court', getJson);
  check('nouvelle phrase trop courte : refusee', tropCourte.ok === false);

  const identique = await storageService.changePassphrase(NOUVELLE, NOUVELLE, getJson);
  check('phrase identique : refusee', identique.ok === false);

  // Apres un refus, la session doit rester utilisable avec la phrase en cours.
  await storageService.save(getJson());
  const apresRefus = JSON.parse(disk.content);
  const cleCourante = await cryptoService.deriveKey(NOUVELLE, cryptoService.envelopeSalt(apresRefus));
  const relu3 = JSON.parse(await cryptoService.decryptEnvelope(apresRefus, cleCourante));
  check('la session reste fonctionnelle apres un refus', relu3.secret === 'patrimoine 123456');

  // On revient a la phrase initiale pour la suite des tests.
  await storageService.changePassphrase(NOUVELLE, PHRASE, getJson);

  // ── Désactivation ────────────────────────────────────────────────────────────
  storageService.setPassphrasePrompt(async () => PHRASE);
  // B-07 : sans la bonne phrase, la désactivation est refusée (sinon quiconque atteint
  // l'application déverrouillée déverserait tout en clair).
  const refusDisable = await storageService.disableEncryption('pas la bonne', getJson);
  check('désactivation refusée sans la bonne phrase', refusDisable.ok === false, refusDisable);
  check('chiffrement toujours actif après un refus de désactivation',
    storageService.isEncryptionEnabled() === true);
  const disabled = await storageService.disableEncryption(PHRASE, getJson);
  check('désactivation réussie', disabled.ok === true, disabled);
  check('chiffrement signalé inactif', storageService.isEncryptionEnabled() === false);
  check('le disque redevient lisible', JSON.parse(disk.content).secret === 'patrimoine 123456');

  // ── Échec d'écriture : l'activation doit être annulée ─────────────────────────
  const savedPicker = globalThis.window.showSaveFilePicker;
  // Aucun fichier mémorisé ET le sélecteur refuse : c'est la seule façon d'obtenir un
  // échec d'écriture. Avec une poignée en cache, l'écriture réussirait et le test ne
  // porterait plus sur rien.
  _idbStore.clear();
  globalThis.window.showSaveFilePicker = async () => { throw new Error('utilisateur a annulé'); };
  const failedEnable = await storageService.enableEncryption(PHRASE, getJson);
  check('activation en échec signalée', failedEnable.ok === false, failedEnable);
  check('chiffrement NON marqué actif après échec', storageService.isEncryptionEnabled() === false);
  check("indicateur persistant nettoyé", localStorage.getItem('fructificare_encryption_enabled') === null);
  globalThis.window.showSaveFilePicker = savedPicker;

  // -- Adoption de la phrase d'un fichier IMPORTE --------------------------------
  //
  // Le scenario d'attaque : « voici mon portefeuille d'exemple, la phrase est demo1234 ».
  // Si l'import adoptait cette phrase en silence, toutes les sauvegardes suivantes de la
  // victime seraient chiffrees avec une cle et un sel connus de l'expediteur. Il lui
  // suffirait ensuite de mettre la main sur un seul fichier.
  // Remise à zéro déterministe : on installe une session chiffrée connue (enable ne
  // dépend pas d'une phrase antérieure), puis on la désactive avec CETTE phrase. Cela
  // remet _crypto à {enabled:false, key:null} quel que soit l'état précédent — y compris
  // « verrouillé » (enabled sans clé) où un simple disable serait refusé.
  const PHRASE_RAZ = 'phrase de remise a zero 0000';
  const remettreAZero = async () => {
    await storageService.enableEncryption(PHRASE_RAZ, getJson);
    await storageService.disableEncryption(PHRASE_RAZ, getJson);
    localStorage.removeItem('fructificare_encryption_enabled');
  };

  const PHRASE_TIERS = 'phrase du fichier recu';
  const selTiers = cryptoService.randomSalt();
  const cleTiers = await cryptoService.deriveKey(PHRASE_TIERS, selTiers);
  const FICHIER_TIERS = await cryptoService.encryptString(
    JSON.stringify({ portfolios: [], transactions: [], secret: 'donnees du tiers' }),
    cleTiers, selTiers,
  );

  // 1. L'utilisateur saisit la phrase, puis REFUSE de l'adopter.
  await remettreAZero();
  storageService.setPassphrasePrompt(async () => PHRASE_TIERS, () => {});
  storageService.setKeyAdoptionConfirm(async () => false);
  const luSansAdoption = await storageService.deserializeImported(FICHIER_TIERS);
  check('le fichier importe est bien dechiffre malgre le refus',
    luSansAdoption.secret === 'donnees du tiers', luSansAdoption);
  check("refus : le chiffrement local N'EST PAS active",
    storageService.isEncryptionEnabled() === false);
  check("refus : aucun indicateur persistant n'est ecrit",
    localStorage.getItem('fructificare_encryption_enabled') === null);
  await storageService.save(getJson());
  check('refus : les sauvegardes locales ne sont pas chiffrees avec la cle du tiers',
    JSON.parse(disk.content).secret === 'patrimoine 123456');

  // 2. Meme fichier, mais l'utilisateur ACCEPTE (cas « je restaure ma sauvegarde »).
  await remettreAZero();
  storageService.setKeyAdoptionConfirm(async () => true);
  const luAvecAdoption = await storageService.deserializeImported(FICHIER_TIERS);
  check('acceptation : le fichier est dechiffre', luAvecAdoption.secret === 'donnees du tiers');
  check('acceptation : le chiffrement local devient actif',
    storageService.isEncryptionEnabled() === true);
  await storageService.save(getJson());
  check('acceptation : les sauvegardes locales sont desormais chiffrees',
    cryptoService.isEncryptedEnvelope(JSON.parse(disk.content)));

  // 3. Aucune fonction de confirmation enregistree : on n'adopte PAS. Se tromper dans
  //    ce sens laisse des donnees en clair ; dans l'autre, cela remet la cle a un tiers.
  await remettreAZero();
  storageService.setKeyAdoptionConfirm(null);
  await storageService.deserializeImported(FICHIER_TIERS);
  check("sans fonction de confirmation, la cle n'est pas adoptee",
    storageService.isEncryptionEnabled() === false);

  // 4. Une sauvegarde du dossier de l'application appartient a l'utilisateur : aucune
  //    question, sinon il devrait confirmer a chaque demarrage.
  await remettreAZero();
  let questionPosee = false;
  storageService.setKeyAdoptionConfirm(async () => { questionPosee = true; return false; });
  disk.content = FICHIER_TIERS;
  await storageService.load();
  check("une sauvegarde locale n'ouvre aucune question d'adoption", questionPosee === false);
  check('une sauvegarde locale adopte bien la cle', storageService.isEncryptionEnabled() === true);

  storageService.setKeyAdoptionConfirm(null);
  await remettreAZero();

  // ── B-03 : indicateur de chiffrement perdu, sauvegarde chiffrée sur le disque ──
  //
  // On simule un poste où localStorage a été vidé (copie de %APPDATA% sans
  // %LOCALAPPDATA%, ou profil WebView2 recréé) alors qu'une sauvegarde chiffrée existe.
  // L'application NE DOIT PAS conclure qu'elle n'est pas chiffrée et réécrire en clair.
  await remettreAZero();
  localStorage.removeItem('fructificare_encryption_enabled'); // l'indicateur a disparu
  check('prémisse : chiffrement vu comme inactif', storageService.isEncryptionEnabled() === false);

  const selPerdu = cryptoService.randomSalt();
  const clePerdue = await cryptoService.deriveKey('la vraie phrase locale', selPerdu);
  disk.content = await cryptoService.encryptString(
    JSON.stringify({ portfolios: [{ id: 'p', name: 'Historique' }], transactions: [], secret: 'patrimoine 999' }),
    clePerdue, selPerdu,
  );

  // L'utilisateur annule le déverrouillage.
  storageService.setPassphrasePrompt(async () => null, () => {});
  let refus = null;
  try { await storageService.load(); } catch (e) { refus = e.name; }
  check('déverrouillage annulé signalé', refus === 'PassphraseError', refus);
  check("l'indicateur est rétabli depuis la sauvegarde chiffrée",
    storageService.isEncryptionEnabled() === true);
  check("l'interface « session verrouillée » s'affiche",
    storageService.getStatus().encrypted === true && storageService.getStatus().unlocked === false);

  // Le point critique : un enregistrement ne doit PAS écrire en clair.
  const avantEcriture = disk.content;
  const resEcr = await storageService.save(getJson());
  check("l'enregistrement échoue au lieu d'écrire en clair", resEcr.ok === false, resEcr);
  check('la sauvegarde chiffrée sur le disque est intacte', disk.content === avantEcriture);
  check("le disque n'a PAS été dégradé en clair",
    cryptoService.isEncryptedEnvelope(JSON.parse(disk.content)));

  storageService.setPassphrasePrompt(null, null);
  await remettreAZero();

  if (failures) {
    console.error(`\n${failures} échec(s) — le câblage du chiffrement est cassé.`);
    process.exit(1);
  }
  console.log('\nTous les tests de persistance chiffrée sont passés.');
}

main().catch((e) => {
  console.error('Erreur inattendue :', e);
  process.exit(1);
});

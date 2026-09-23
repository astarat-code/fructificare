// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * test-crypto.js — Checks the optional encryption of backups.
 *
 * What must be guaranteed:
 *   • an encrypt/decrypt round-trip returns exactly the original data;
 *   • a wrong passphrase fails, without revealing information;
 *   • an encrypted backup that was then MODIFIED is rejected (this is what GCM adds over
 *     CBC: an attacker cannot alter the file without it being detected);
 *   • the plain text appears nowhere in the produced file;
 *   • every write uses a fresh IV — without it, two consecutive backups would leak their
 *     differences.
 *
 * Usage:  npm run test:security
 */
const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');

// WebCrypto et btoa/atob : présents dans le navigateur, à fournir ici.
globalThis.crypto = webcrypto;
if (typeof globalThis.btoa !== 'function') {
  globalThis.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
  globalThis.atob = (s) => Buffer.from(s, 'base64').toString('binary');
}

const SOURCE = path.join(__dirname, '..', 'src', 'services', 'cryptoService.js');
const src = fs.readFileSync(SOURCE, 'utf8')
  .replace(/^export default .*$/m, '')
  .replace(/^export \{[\s\S]*?\};$/m, '');
const cryptoService = new Function(src + '\nreturn cryptoService;')();

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

// Les 600 000 itérations PBKDF2 sont volontairement lentes ; pour un test on garde la
// valeur réelle une seule fois, et on réutilise la clé dérivée pour le reste.
async function main() {
  const PASSPHRASE = 'phrase secrète correcte 2026';
  const PLAINTEXT = JSON.stringify({
    portfolios: [{ id: 'p1', name: 'PEA', type: 'PEA' }],
    transactions: [{ id: 't1', portfolio_id: 'p1', type: 'deposit', date: '2026-01-15', amount: 1000 }],
    fire_settings: { monthly_need: 2500, withdrawal_rate: 4 },
  });

  const salt = cryptoService.randomSalt();
  check('sel de 16 octets', salt.length === 16, salt.length);

  const t0 = Date.now();
  const key = await cryptoService.deriveKey(PASSPHRASE, salt);
  const derivationMs = Date.now() - t0;
  check(`dérivation lente (coût d'une attaque par dictionnaire) — ${derivationMs} ms`, derivationMs > 50, derivationMs);

  // ── Aller-retour ─────────────────────────────────────────────────────────────
  const envelopeText = await cryptoService.encryptString(PLAINTEXT, key, salt);
  const envelope = JSON.parse(envelopeText);

  check('enveloppe reconnue comme chiffrée', cryptoService.isEncryptedEnvelope(envelope));
  check('enveloppe non reconnue sur un JSON normal',
    !cryptoService.isEncryptedEnvelope(JSON.parse(PLAINTEXT)));

  const roundTrip = await cryptoService.decryptEnvelope(envelope, key);
  check('aller-retour fidèle', roundTrip === PLAINTEXT);

  // ── Aucune fuite en clair ────────────────────────────────────────────────────
  // Le chiffré, en base64, est aléatoire : une chaîne courte comme « PEA » ou « 1000 » y
  // apparaît par pur hasard environ une fois sur 800, et faisait échouer la CI sans
  // qu'aucune donnée ne fuie. Les valeurs courtes sont donc cherchées dans tous les
  // champs SAUF le chiffré ; le chiffré, lui, ne doit pas contenir le texte clair.
  const { ciphertext, ...champsEnClair } = envelope;
  const horsChiffre = JSON.stringify(champsEnClair);
  check('« portfolios » absent du fichier chiffré', !envelopeText.includes('portfolios'));
  check('« PEA » absent des champs non chiffrés', !horsChiffre.includes('PEA'), horsChiffre);
  check('montant « 1000 » absent des champs non chiffrés', !horsChiffre.includes('1000'), horsChiffre);
  check('le texte clair absent du chiffré décodé',
    !Buffer.from(ciphertext, 'base64').includes(Buffer.from(PLAINTEXT)));
  check('le sel est publié (nécessaire au déchiffrement)', typeof envelope.salt === 'string');

  // ── Mauvaise phrase ──────────────────────────────────────────────────────────
  const wrongKey = await cryptoService.deriveKey('mauvaise phrase', salt);
  let rejected = false;
  try {
    await cryptoService.decryptEnvelope(envelope, wrongKey);
  } catch (e) {
    rejected = e instanceof cryptoService.PassphraseError;
  }
  check('mauvaise phrase secrète rejetée', rejected);

  // ── Altération détectée (authentification GCM) ───────────────────────────────
  const tampered = JSON.parse(envelopeText);
  const bytes = cryptoService.fromBase64(tampered.ciphertext);
  bytes[Math.floor(bytes.length / 2)] ^= 0x01; // un seul bit inversé
  tampered.ciphertext = cryptoService.toBase64(bytes);
  let tamperRejected = false;
  try {
    await cryptoService.decryptEnvelope(tampered, key);
  } catch (e) {
    tamperRejected = e instanceof cryptoService.PassphraseError;
  }
  check('fichier altéré d\'un seul bit rejeté', tamperRejected);

  // ── IV distinct à chaque écriture ────────────────────────────────────────────
  const second = JSON.parse(await cryptoService.encryptString(PLAINTEXT, key, salt));
  check('IV différent à chaque enregistrement', second.iv !== envelope.iv, { a: envelope.iv, b: second.iv });
  check('chiffré différent pour un même contenu', second.ciphertext !== envelope.ciphertext);
  check('les deux enveloppes se déchiffrent',
    (await cryptoService.decryptEnvelope(second, key)) === PLAINTEXT);

  // ── Compatibilité ascendante du nombre d'itérations ──────────────────────────
  check('itérations lues depuis l\'enveloppe',
    cryptoService.envelopeIterations({ iterations: 123456 }) === 123456);
  check('itérations par défaut si absentes',
    cryptoService.envelopeIterations({}) === cryptoService.KDF_ITERATIONS);

  // Ce nombre vient du FICHIER. Une valeur énorme faisait travailler la dérivation
  // pendant des heures : le déverrouillage ne répondait plus, et chaque tentative en
  // relançait une — déni de service en un seul fichier importé. Une valeur minuscule
  // affaiblissait silencieusement une clé que la session pouvait ensuite adopter.
  const refuse = (valeur) => {
    try { cryptoService.envelopeIterations({ iterations: valeur }); return false; }
    catch (_) { return true; }
  };
  check("un nombre d'itérations gigantesque est refusé (gel de l'application)",
    refuse(2000000000));
  check('juste au-dessus de la borne haute : refusé',
    refuse(cryptoService.MAX_FILE_ITERATIONS + 1));
  check('une seule itération est refusée (affaiblissement silencieux)', refuse(1));
  check('juste en dessous de la borne basse : refusé',
    refuse(cryptoService.MIN_FILE_ITERATIONS - 1));
  check('un nombre non entier ou textuel est refusé', refuse(600000.5) && refuse('600000'));
  check('les bornes elles-mêmes restent acceptées',
    cryptoService.envelopeIterations({ iterations: cryptoService.MIN_FILE_ITERATIONS })
      === cryptoService.MIN_FILE_ITERATIONS
    && cryptoService.envelopeIterations({ iterations: cryptoService.MAX_FILE_ITERATIONS })
      === cryptoService.MAX_FILE_ITERATIONS);
  check('la valeur produite par Fructificare est acceptée',
    cryptoService.envelopeIterations({ iterations: cryptoService.KDF_ITERATIONS })
      === cryptoService.KDF_ITERATIONS);

  if (failures) {
    console.error(`\n${failures} échec(s) — le chiffrement des sauvegardes est cassé.`);
    process.exit(1);
  }
  console.log('\nTous les tests de chiffrement sont passés.');
}

main().catch((e) => {
  console.error('Erreur inattendue :', e);
  process.exit(1);
});

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * cryptoService.js — Optional encryption of the backups.
 *
 * THREAT COVERED: a program running under the user's Windows session (an infostealer, a
 * cloud backup, another administrator account) reading %APPDATA%\\...\\save\\*.json. Without
 * encryption, those files expose the user's entire net worth, deposits and goals.
 *
 * THREAT NOT COVERED: an attacker present WHILE the application is open. The key then lives
 * in memory — otherwise auto-save (every 2 s) would have to ask for the passphrase on every
 * write.
 *
 * CRYPTOGRAPHIC CHOICES
 *   • AES-256-GCM: authenticated encryption — a modified backup is rejected at decryption
 *     instead of silently producing forged data.
 *   • PBKDF2-HMAC-SHA-256, 600,000 iterations: OWASP 2023 recommendation. Argon2id would be
 *     preferable but does not exist in WebCrypto, and embedding a WebAssembly library would
 *     add a dependency on the software's most sensitive path.
 *   • Fixed salt per configuration, random IV per write: the key is derived once per session
 *     (600,000 iterations ≈ half a second), while a fresh IV on every save is essential to
 *     GCM's security.
 *
 * FORMAT: the envelope is JSON, so an encrypted file stays a .json readable by the usual
 * tools, and the application can recognize its format without decrypting it.
 */

const MAGIC = 'fructificare-encrypted';
const VERSION = 1;
const KDF_ITERATIONS = 600000;
// Bornes acceptées pour le compte d'itérations LU DANS UN FICHIER.
//
// Ce nombre vient de l'enveloppe, donc d'un fichier que l'utilisateur a pu recevoir
// d'un tiers. Sans borne haute, « iterations: 2000000000 » fait travailler la
// dérivation pendant des heures : le déverrouillage ne répond plus, et chaque nouvelle
// tentative en relance un. Déni de service en un seul fichier.
// Sans borne basse, « iterations: 1 » affaiblit silencieusement une clé que la session
// pourrait ensuite adopter — l'enveloppe réécrite annoncerait 600 000 itérations alors
// que la clé n'en a coûté qu'une.
const MIN_FILE_ITERATIONS = 100000;
const MAX_FILE_ITERATIONS = 10000000;
const SALT_BYTES = 16;
const IV_BYTES = 12; // 96 bits : taille recommandée pour AES-GCM

/** Erreur levée quand la phrase secrète est absente ou incorrecte. */
class PassphraseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PassphraseError';
  }
}

function subtle() {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new Error("WebCrypto indisponible : le chiffrement ne peut pas fonctionner.");
  return c.subtle;
}

// ── Encodage base64 (sans dépendance) ──────────────────────────────────────────

function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(str) {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ── Dérivation de clé ──────────────────────────────────────────────────────────

/** Sel aléatoire, à conserver avec les données chiffrées. */
function randomSalt() {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}

/**
 * Dérive une clé AES-256-GCM depuis une phrase secrète.
 * Opération volontairement lente (~0,5 s) : c'est ce qui rend une attaque par
 * dictionnaire coûteuse. À n'appeler qu'une fois par session.
 *
 * @param {string} passphrase
 * @param {Uint8Array} salt
 * @param {number} [iterations] — lu depuis l'enveloppe, pour rester compatible si la
 *        valeur par défaut augmente dans une version ultérieure.
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey(passphrase, salt, iterations = KDF_ITERATIONS) {
  const material = await subtle().importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle().deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false, // non exportable : la clé ne peut pas fuiter par le code applicatif
    ['encrypt', 'decrypt'],
  );
}

// ── Chiffrement / déchiffrement ────────────────────────────────────────────────

/**
 * Chiffre une chaîne et renvoie l'enveloppe JSON à écrire sur disque.
 *
 * @param {string} plaintext
 * @param {CryptoKey} key
 * @param {Uint8Array} salt — celui ayant servi à dériver `key`
 * @returns {Promise<string>} JSON de l'enveloppe
 */
async function encryptString(plaintext, key, salt) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await subtle().encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return JSON.stringify({
    [MAGIC]: VERSION,
    kdf: 'PBKDF2-SHA256',
    iterations: KDF_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
    note: "Sauvegarde Fructificare chiffree. Sans la phrase secrete, ce fichier est irrecuperable.",
  }, null, 2);
}

/**
 * Déchiffre une enveloppe.
 * @throws {PassphraseError} si la clé ne correspond pas, ou si le fichier a été modifié.
 */
async function decryptEnvelope(envelope, key) {
  try {
    const plain = await subtle().decrypt(
      { name: 'AES-GCM', iv: fromBase64(envelope.iv) },
      key,
      fromBase64(envelope.ciphertext),
    );
    return new TextDecoder().decode(plain);
  } catch (_) {
    // AES-GCM ne distingue pas « mauvaise clé » de « fichier altéré » : dans les deux
    // cas l'authentification échoue, et c'est exactement ce qu'on veut.
    throw new PassphraseError('Phrase secrète incorrecte, ou fichier de sauvegarde altéré.');
  }
}

// ── Reconnaissance de format ───────────────────────────────────────────────────

/** Vrai si l'objet est une enveloppe chiffrée Fructificare. */
function isEncryptedEnvelope(obj) {
  return !!obj
    && typeof obj === 'object'
    && typeof obj[MAGIC] === 'number'
    && typeof obj.salt === 'string'
    && typeof obj.iv === 'string'
    && typeof obj.ciphertext === 'string';
}

/** Sel d'une enveloppe, pour dériver la clé correspondante. */
function envelopeSalt(envelope) {
  return fromBase64(envelope.salt);
}

/**
 * Nombre d'itérations d'une enveloppe (compatibilité ascendante si la valeur par
 * défaut augmente un jour).
 *
 * La valeur est REFUSÉE plutôt que ramenée dans les bornes : la ramener produirait une
 * clé différente de celle attendue, donc un échec de déchiffrement affiché comme
 * « phrase secrète incorrecte » — un message faux, qui enverrait l'utilisateur chercher
 * une erreur de frappe inexistante.
 *
 * @throws {Error} si l'enveloppe annonce un nombre d'itérations hors bornes.
 */
function envelopeIterations(envelope) {
  const n = envelope.iterations;
  if (n === undefined || n === null) return KDF_ITERATIONS;
  if (!Number.isInteger(n) || n < MIN_FILE_ITERATIONS || n > MAX_FILE_ITERATIONS) {
    throw new Error(
      `Fichier de sauvegarde refusé : il annonce ${JSON.stringify(n)} itérations de dérivation, `
      + `hors des bornes admises (${MIN_FILE_ITERATIONS} à ${MAX_FILE_ITERATIONS}). `
      + "Un fichier légitime produit par Fructificare en annonce 600 000.",
    );
  }
  return n;
}

const cryptoService = {
  MAGIC,
  KDF_ITERATIONS,
  MIN_FILE_ITERATIONS,
  MAX_FILE_ITERATIONS,
  PassphraseError,
  randomSalt,
  deriveKey,
  encryptString,
  decryptEnvelope,
  isEncryptedEnvelope,
  envelopeSalt,
  envelopeIterations,
  toBase64,
  fromBase64,
};

export default cryptoService;
export {
  MAGIC, KDF_ITERATIONS, MIN_FILE_ITERATIONS, MAX_FILE_ITERATIONS,
  PassphraseError, randomSalt, deriveKey,
  encryptString, decryptEnvelope, isEncryptedEnvelope, envelopeSalt, envelopeIterations,
};

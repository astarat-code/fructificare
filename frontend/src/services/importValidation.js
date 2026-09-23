// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * importValidation.js — Sanitization of the data read from a backup.
 *
 * WHY: a backup file is JSON the user may have received from someone else, or that may
 * have been edited by hand. Nothing guarantees its shape. Without checks:
 *
 *   • a NaN/Infinity number spreads through every computation and freezes the interface on
 *     "NaN €" without any explicit error;
 *   • a `__proto__` key can pollute Object's prototype during a merge;
 *   • a value of an unexpected type (an object where an array is expected) crashes the
 *     rendering, and the startup load swallows the exception: the user then sees an empty
 *     application without knowing why;
 *   • a malformed document rel_path is refused later by documentService, but it may as
 *     well be dropped at import time.
 *
 * PRINCIPLE: sanitize without being destructive. Unknown fields are kept (the format
 * evolves, and removing a legitimate field would lose user data); only entries whose
 * STRUCTURAL fields are invalid are dropped, and their number is reported back to the
 * caller for display.
 */

// Clés qui permettraient d'atteindre le prototype d'Object lors d'une fusion.
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// Bornes défensives : au-delà, le fichier n'est plus une sauvegarde plausible et le
// coût mémoire/rendu devient un déni de service.
const MAX_DEPTH = 32;
const MAX_ARRAY_LENGTH = 100000;
const MAX_STRING_LENGTH = 100000;

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Copie profonde assainie : retire les clés dangereuses, remplace les nombres non
 * finis par null, borne la profondeur, la taille des tableaux et des chaînes.
 */
function sanitize(value, depth = 0) {
  if (depth > MAX_DEPTH) return null;
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH ? value.slice(0, MAX_STRING_LENGTH) : value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_LENGTH).map((v) => sanitize(v, depth + 1));
  }

  if (isPlainObject(value)) {
    const out = {};
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_KEYS.has(key)) continue;
      out[key] = sanitize(value[key], depth + 1);
    }
    return out;
  }

  // Fonctions, symboles… : impossibles en JSON, écartés par principe.
  return null;
}

// ── Contrôles élémentaires ─────────────────────────────────────────────────────

const isId = (v) => typeof v === 'string' && v.length > 0 && v.length <= 200;
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);

/** Convertit en nombre fini, ou renvoie `fallback`. */
function toFiniteNumber(v, fallback = 0) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}

const isNumeric = (v) => Number.isFinite(toFiniteNumber(v, NaN));

/**
 * Normalise en nombre fini les champs servant aux calculs. Un champ absent le reste :
 * seules les valeurs présentes sont converties.
 */
function coerceNumericFields(entry, fields) {
  for (const f of fields) {
    if (entry[f] === undefined || entry[f] === null) continue;
    entry[f] = toFiniteNumber(entry[f], 0);
  }
  return entry;
}

// ── Règles par collection ──────────────────────────────────────────────────────
//
// `required` décide de la conservation de l'entrée ; `numeric` normalise les champs
// servant aux calculs. Tout le reste de l'entrée est conservé tel quel.

const TRANSACTION_TYPES = new Set(['deposit', 'withdrawal', 'stress_crash']);

// Segment de chemin produit par dataService.slugify() : ni séparateur, ni « .. ».
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._ -]*$/;

const COLLECTION_RULES = {
  portfolios: {
    required: (p) => isId(p.id) && typeof p.name === 'string',
    numeric: ['annual_fees_pct', 'annual_return_rate'],
  },
  transactions: {
    required: (t) => isId(t.id) && isId(t.portfolio_id) && TRANSACTION_TYPES.has(t.type)
      && isDate(t.date) && isNumeric(t.amount),
    numeric: ['amount', 'fees_pct', 'fees_amount', 'net_amount', 'annual_fees_pct',
      'from_cash_amount', 'new_funds_amount', 'quantity', 'unit_price'],
  },
  calibrations: {
    required: (c) => isId(c.portfolio_id) && isDate(c.date) && isNumeric(c.total_value),
    numeric: ['total_value'],
  },
  movement_templates: { required: (x) => isId(x.id) },
  reminders: { required: (x) => isId(x.id) },
  budget_entries: { required: (x) => isId(x.id) },
  programmed_movements: { required: (x) => isId(x.id) },
  calendar_notes: { required: (x) => isId(x.id) },
  regular_movements: { required: (x) => isId(x.id) },
  rule843_sims: { required: (x) => isId(x.id) },
  documents: {
    // Même forme que celle exigée par documentService : racine/slug/fichier.pdf
    required: (d) => {
      if (!isId(d.id) || typeof d.rel_path !== 'string') return false;
      const parts = d.rel_path.split('/').filter(Boolean);
      return parts.length === 3
        && SAFE_SEGMENT.test(parts[1])
        && SAFE_SEGMENT.test(parts[2])
        && /\.pdf$/i.test(parts[2]);
    },
  },
  simulations: {
    required: (s) => isId(s.id)
      && (s.portfolios === undefined || s.portfolios === null || Array.isArray(s.portfolios))
      && (s.transactions === undefined || s.transactions === null || Array.isArray(s.transactions)),
  },
};

/**
 * Valide une collection : garde les entrées conformes, écarte les autres.
 * @returns {{ rows: Array, dropped: number }}
 */
function validateCollection(value, name) {
  if (!Array.isArray(value)) return { rows: [], dropped: 0 };

  const rule = COLLECTION_RULES[name];
  const rows = [];
  let dropped = 0;

  for (const raw of value) {
    if (!isPlainObject(raw)) { dropped += 1; continue; }
    const entry = sanitize(raw);
    // Le contrôle structurel passe AVANT la coercition : sinon un montant illisible
    // serait ramené à 0 puis jugé valide, et apparaîtrait comme un mouvement fantôme
    // à 0 € dans le relevé au lieu d'être écarté.
    if (rule?.required && !rule.required(entry)) { dropped += 1; continue; }
    if (rule?.numeric) coerceNumericFields(entry, rule.numeric);
    rows.push(entry);
  }

  return { rows, dropped };
}

/** Valide fire_settings : deux nombres, bornés à des valeurs plausibles. */
function validateFireSettings(value) {
  const src = isPlainObject(value) ? value : {};
  const monthly = toFiniteNumber(src.monthly_need, 2500);
  const rate = toFiniteNumber(src.withdrawal_rate, 4);
  return {
    ...sanitize(src),
    monthly_need: monthly > 0 ? monthly : 2500,
    withdrawal_rate: rate > 0 && rate <= 100 ? rate : 4,
  };
}

/**
 * Point d'entrée : assainit un payload de sauvegarde complet.
 *
 * @param {object} data — objet issu de JSON.parse
 * @returns {{ data: object, dropped: Record<string, number>, totalDropped: number }}
 */
function validateBackup(data) {
  const dropped = {};
  const out = isPlainObject(data) ? { ...data } : {};

  for (const name of Object.keys(COLLECTION_RULES)) {
    const { rows, dropped: n } = validateCollection(data?.[name], name);
    out[name] = rows;
    if (n > 0) dropped[name] = n;
  }

  out.fire_settings = validateFireSettings(data?.fire_settings);
  out.gamification = isPlainObject(data?.gamification) ? sanitize(data.gamification) : null;
  out.appPreferences = isPlainObject(data?.appPreferences) ? sanitize(data.appPreferences) : null;

  const totalDropped = Object.values(dropped).reduce((s, n) => s + n, 0);
  return { data: out, dropped, totalDropped };
}

const importValidation = { validateBackup, validateCollection, sanitize, toFiniteNumber };

export default importValidation;
export { validateBackup, validateCollection, sanitize, toFiniteNumber };

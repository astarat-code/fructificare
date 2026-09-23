// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * objectiveService.js — Management of Fructificare's personal goals
 *
 * This service handles the complete life cycle of personal goals: creation, update,
 * deletion, progress computation and completion detection.
 *
 * DATA MODEL (goal):
 *   {
 *     id:               string (short unique identifier)
 *     label:            string (max 60 chars)
 *     targetAmount:     float  (> 0)
 *     linkedEnvelopes:  string[]  (portfolio IDs, or ["ALL"] for the total)
 *     targetDate:       string|null (ISO date, in the future)
 *     icon:             string ("house"|"car"|"retirement"|"travel"|"children"|"other")
 *     createdAt:        string (ISO)
 *     badgeAwarded:     bool
 *   }
 *
 * PUBLIC API:
 *   createObjective(data)              → object | throws
 *   updateObjective(id, patch)         → void   | throws
 *   deleteObjective(id)                → void
 *   getObjectiveProgress(objective)    → { currentAmount, targetAmount, progressPercent, monthsToTarget, isCompleted }
 *   checkObjectiveCompletion()         → void   (idempotent)
 *   initObjectiveWatcher()             → void   (call once from index.js)
 *
 * EXPORTED CONSTANTS:
 *   OBJECTIVE_ICONS   — { [iconId]: { emoji, label } }
 *   MAX_OBJECTIVES    — 20
 */

import dataService         from './dataService';
import gamificationService from './gamificationService';

// ── Import lazy pour éviter la dépendance circulaire trophyService ↔ objectiveService ──
let _trophyServiceRef = null;
function _getTrophyService() {
  if (!_trophyServiceRef) {
    try { _trophyServiceRef = require('./trophyService').default; } catch (_) {}
  }
  return _trophyServiceRef;
}

// ── Import lazy questService (pour Q11 — objectif avec date et montant) ──────
let _questServiceRef = null;
function _getQuestService() {
  if (!_questServiceRef) {
    try { _questServiceRef = require('./questService').default; } catch (_) {}
  }
  return _questServiceRef;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════════

/** Nombre maximal d'objectifs simultanés par utilisateur. */
export const MAX_OBJECTIVES = 20;

/**
 * Catalogue des icônes disponibles.
 * @type {Record<string, { emoji: string, label: string }>}
 */
export const OBJECTIVE_ICONS = {
  house:      { emoji: '🏠', label: 'Immobilier' },
  car:        { emoji: '🚗', label: 'Automobile' },
  retirement: { emoji: '🏖️', label: 'Retraite'   },
  travel:     { emoji: '✈️', label: 'Voyage'     },
  children:   { emoji: '👨‍👩‍👧', label: 'Enfants'   },
  other:      { emoji: '🎯', label: 'Autre'      },
};

const _VALID_ICONS = Object.keys(OBJECTIVE_ICONS);

// ═══════════════════════════════════════════════════════════════════════════════
// 2. HELPERS INTERNES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Génère un identifiant court unique (non-UUID mais suffisamment aléatoire
 * pour un usage local).
 */
function _generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Retourne la date de demain au format "YYYY-MM-DD".
 */
function _tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. CRUD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Crée un nouvel objectif et le persiste dans `gamificationState.objectives`.
 *
 * @param {{
 *   label:            string,
 *   targetAmount:     number,
 *   linkedEnvelopes:  string[],
 *   targetDate?:      string | null,
 *   icon?:            string,
 * }} data
 * @returns {object} — l'objectif créé
 * @throws {Error} si la validation échoue ou si le maximum d'objectifs est atteint
 */
function createObjective({ label, targetAmount, linkedEnvelopes, targetDate, icon }) {
  // ── Validation ───────────────────────────────────────────────────────────
  const trimLabel = (label || '').trim();
  if (!trimLabel)            throw new Error('Le libellé est requis.');
  if (trimLabel.length > 60) throw new Error('Le libellé ne peut pas dépasser 60 caractères.');

  const amount = parseFloat(targetAmount);
  if (!isFinite(amount) || amount <= 0) throw new Error('Le montant cible doit être supérieur à 0 €.');

  if (!Array.isArray(linkedEnvelopes) || linkedEnvelopes.length === 0) {
    throw new Error('Sélectionnez au moins une enveloppe liée.');
  }

  if (targetDate) {
    const d = new Date(targetDate);
    if (isNaN(d.getTime())) throw new Error('Date invalide.');
    if (d < _tomorrow())    throw new Error('La date cible doit être dans le futur.');
  }

  const gState     = gamificationService.getState();
  const objectives = gState.objectives || [];
  if (objectives.length >= MAX_OBJECTIVES) {
    throw new Error(`Vous avez atteint la limite de ${MAX_OBJECTIVES} objectifs.`);
  }

  const newObj = {
    id:              _generateId(),
    label:           trimLabel,
    targetAmount:    amount,
    linkedEnvelopes: linkedEnvelopes,
    targetDate:      targetDate || null,
    icon:            _VALID_ICONS.includes(icon) ? icon : 'other',
    createdAt:       new Date().toISOString(),
    badgeAwarded:    false,
  };

  gamificationService.patchState({ objectives: [...objectives, newObj] });
  // Gamification Q11 — vérifier si un objectif avec montant + date existe maintenant
  try { _getQuestService()?.checkCurrentQuest(); } catch (_) {}
  return newObj;
}

/**
 * Met à jour les champs modifiables d'un objectif existant.
 *
 * Champs modifiables : `label`, `targetAmount`, `targetDate`, `icon`.
 * `linkedEnvelopes` ne peut PAS être modifié après création.
 *
 * @param {string} id
 * @param {{ label?, targetAmount?, targetDate?, icon? }} patch
 * @throws {Error}
 */
function updateObjective(id, patch) {
  const gState     = gamificationService.getState();
  const objectives = [...(gState.objectives || [])];
  const idx        = objectives.findIndex(o => o.id === id);
  if (idx === -1) throw new Error('Objectif introuvable.');

  const obj = { ...objectives[idx] };

  if (patch.label !== undefined) {
    const trimLabel = (patch.label || '').trim();
    if (!trimLabel)            throw new Error('Le libellé est requis.');
    if (trimLabel.length > 60) throw new Error('Le libellé ne peut pas dépasser 60 caractères.');
    obj.label = trimLabel;
  }

  if (patch.targetAmount !== undefined) {
    const amount = parseFloat(patch.targetAmount);
    if (!isFinite(amount) || amount <= 0) throw new Error('Le montant cible doit être supérieur à 0 €.');
    obj.targetAmount = amount;
  }

  if (patch.targetDate !== undefined) {
    if (patch.targetDate) {
      const d = new Date(patch.targetDate);
      if (isNaN(d.getTime())) throw new Error('Date invalide.');
      if (d < _tomorrow())    throw new Error('La date cible doit être dans le futur.');
    }
    obj.targetDate = patch.targetDate || null;
  }

  if (patch.icon !== undefined && _VALID_ICONS.includes(patch.icon)) {
    obj.icon = patch.icon;
  }

  objectives[idx] = obj;
  gamificationService.patchState({ objectives });
  // Gamification Q11 — la date ou le montant a peut-être été ajouté maintenant
  try { _getQuestService()?.checkCurrentQuest(); } catch (_) {}
}

/**
 * Supprime un objectif de la liste.
 *
 * Le badge éventuel dans `gamificationState.trophies` est conservé (badges permanents,
 * xpAwarded = 0 — pas de retrait de XP).
 *
 * @param {string} id
 */
function deleteObjective(id) {
  const gState     = gamificationService.getState();
  const objectives = (gState.objectives || []).filter(o => o.id !== id);
  gamificationService.patchState({ objectives });
  // Note intentionnelle : le badge "objective_<id>" dans trophies est conservé.
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. CALCUL DE PROGRESSION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calcule la progression courante d'un objectif.
 *
 * @param {object} objective
 * @returns {{
 *   currentAmount:   number,
 *   targetAmount:    number,
 *   progressPercent: number,    // 0-100
 *   monthsToTarget:  number | null,
 *   isCompleted:     boolean,
 * }}
 */
function getObjectiveProgress(objective) {
  if (!objective) {
    return { currentAmount: 0, targetAmount: 0, progressPercent: 0, monthsToTarget: null, isCompleted: false };
  }

  // ── Montant courant ────────────────────────────────────────────────────────
  let currentAmount = 0;
  try {
    const portfolios = dataService.getPortfolios();
    const isAll      = Array.isArray(objective.linkedEnvelopes) &&
                       objective.linkedEnvelopes.includes('ALL');

    if (isAll) {
      currentAmount = portfolios.reduce((s, p) => s + Math.max(0, p.balance || 0), 0);
    } else {
      const linked = new Set(objective.linkedEnvelopes || []);
      currentAmount = portfolios
        .filter(p => linked.has(p.id))
        .reduce((s, p) => s + Math.max(0, p.balance || 0), 0);
    }
  } catch (_) {}

  const targetAmount    = objective.targetAmount || 0;
  const progressPercent = targetAmount > 0
    ? Math.min(100, (currentAmount / targetAmount) * 100)
    : 0;
  const isCompleted     = targetAmount > 0 && currentAmount >= targetAmount;

  // ── Estimation du temps restant ────────────────────────────────────────────
  //    Calculée uniquement si targetDate est null et objectif non atteint.
  //    Fenêtre glissante : 90 jours (≈ 3 mois).
  let monthsToTarget = null;

  if (!objective.targetDate && !isCompleted && targetAmount > 0) {
    try {
      const rawData      = dataService.getData();
      const transactions = rawData.transactions || [];

      const cutoff  = new Date(Date.now() - 90 * 24 * 3600 * 1000);
      const isAll   = Array.isArray(objective.linkedEnvelopes) &&
                      objective.linkedEnvelopes.includes('ALL');
      const linked  = new Set(isAll ? [] : (objective.linkedEnvelopes || []));

      const relevantTx = transactions.filter(tx => {
        if (tx.type !== 'deposit' && tx.type !== 'withdrawal') return false;
        if (!isAll && !linked.has(tx.portfolio_id)) return false;
        return new Date(tx.date) >= cutoff;
      });

      // Aucun dépôt dans les 90 derniers jours → null (spec § 7)
      const hasDeposit = relevantTx.some(tx => tx.type === 'deposit' && (tx.amount || 0) > 0);
      if (hasDeposit) {
        // Net mensuel (somme dépôts - retraits par mois)
        const byMonth = {};
        relevantTx.forEach(tx => {
          const key = tx.date.substring(0, 7);
          if (!byMonth[key]) byMonth[key] = 0;
          byMonth[key] += tx.type === 'deposit' ? (tx.amount || 0) : -(tx.amount || 0);
        });

        // Diviser par 3 (fenêtre = 3 mois) même si certains mois ont 0 activité
        const totalNet   = Object.values(byMonth).reduce((s, v) => s + v, 0);
        const avgMonthly = totalNet / 3;

        if (avgMonthly > 0) {
          const remaining = targetAmount - currentAmount;
          monthsToTarget  = remaining > 0 ? Math.ceil(remaining / avgMonthly) : 0;
        }
      }
    } catch (_) {}
  }

  return {
    currentAmount,
    targetAmount,
    progressPercent,
    monthsToTarget,
    isCompleted,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. DÉTECTION DE COMPLÉTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Vérifie tous les objectifs non encore marqués et attribue le badge pour
 * ceux atteints à 100 %.
 *
 * Effets de bord :
 *   - Appelle `trophyService.checkObjectiveBadge()` (badge permanent, 0 XP)
 *   - Émet l'événement "objectiveCompleted" via le bus de gamification
 *   - Met à jour `badgeAwarded = true` dans l'état
 *
 * Idempotent : sans effet si les badges sont déjà attribués.
 */
function checkObjectiveCompletion() {
  const gState     = gamificationService.getState();
  const objectives = gState.objectives || [];
  if (objectives.length === 0) return;

  const ts       = _getTrophyService();
  let anyChanged = false;

  const updatedObjectives = objectives.map(obj => {
    // Déjà marqué → ignorer
    if (obj.badgeAwarded) return obj;

    let progress;
    try {
      progress = getObjectiveProgress(obj);
    } catch (_) {
      return obj;
    }

    if (!progress.isCompleted) return obj;

    // Attribution du badge (0 XP, permanent) via trophyService
    if (ts) {
      try { ts.checkObjectiveBadge(obj, progress.currentAmount); } catch (_) {}
    }

    // Événement pour la notification UI
    try {
      gamificationService.dispatchEvent('objectiveCompleted', {
        objective:     obj,
        currentAmount: progress.currentAmount,
        completedAt:   new Date().toISOString(),
      });
    } catch (_) {}

    anyChanged = true;
    return { ...obj, badgeAwarded: true };
  });

  if (anyChanged) {
    gamificationService.patchState({ objectives: updatedObjectives });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. WATCHER
// ═══════════════════════════════════════════════════════════════════════════════

let _watcherInitialized = false;

/**
 * Abonne `checkObjectiveCompletion` au bus d'événements XP.
 * À appeler une seule fois depuis `index.js` (après `gamificationService.loadState()`).
 */
function initObjectiveWatcher() {
  if (_watcherInitialized) return;
  _watcherInitialized = true;

  gamificationService.onEvent('progressUpdated', () => {
    try { checkObjectiveCompletion(); } catch (e) {
      console.warn('[objectiveService] watcher error:', e);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

const objectiveService = {
  OBJECTIVE_ICONS,
  MAX_OBJECTIVES,
  createObjective,
  updateObjective,
  deleteObjective,
  getObjectiveProgress,
  checkObjectiveCompletion,
  initObjectiveWatcher,
};

export default objectiveService;

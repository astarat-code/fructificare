// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * streakService.js — Login & calibration streaks
 *
 * FUNCTIONS:
 *   handleDailyConnection()       — call on every app launch (idempotent)
 *   checkStreakMilestones(n)      — checks and grants the streak tiers
 *   checkCalibrationTrophies(n)   — unlocks the monthly calibration trophies
 *   getStreakDisplay()            — data for the StreakDisplay component
 *
 * BUSINESS RULES:
 *   • One grace day per streak: if gap = 2 AND graceUsed = false → the streak continues
 *   • graceUsed goes back to false only when the streak resets (currentStreak = 1)
 *   • Each milestone tier is granted ONCE in a lifetime (milestonesAwarded[])
 *   • Streak trophies are permanent (isPermanent: true)
 *   • No warning event here — handled by notificationService
 */

import gamificationService from './gamificationService';

// Lazy import pour éviter les dépendances circulaires
function _getTrophyService() {
  try { return require('./trophyService').default; } catch (_) { return null; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Retourne la date d'aujourd'hui en format YYYY-MM-DD (heure locale). */
function _today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Nombre de jours calendaires entre deux dates YYYY-MM-DD.
 * Toujours positif (b après a).
 */
function _daysBetween(dateA, dateB) {
  const a = new Date(dateA + 'T00:00:00');
  const b = new Date(dateB + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. PALIERS DE SÉRIE (MILESTONES)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Définition des paliers.
 * trophy : ID dans TROPHY_CATALOG (null = XP seul, pas de badge).
 */
const MILESTONES = [
  { days: 3,   xp: 15,   trophy: null },
  { days: 7,   xp: 50,   trophy: 'streak_7j' },
  { days: 14,  xp: 100,  trophy: null },
  { days: 30,  xp: 200,  trophy: 'flamme_persistante' },
  { days: 60,  xp: 400,  trophy: null },
  { days: 90,  xp: 500,  trophy: 'flamme_eternelle' },
  { days: 180, xp: 1000, trophy: null },
  { days: 365, xp: 2000, trophy: 'une_annee_entiere' },
];

/**
 * Vérifie si `newStreak` correspond à un palier non encore attribué.
 * Si oui, attribue les XP et le trophée associé.
 * @param {number} newStreak
 */
function checkStreakMilestones(newStreak) {
  const milestone = MILESTONES.find(m => m.days === newStreak);
  if (!milestone) return;

  // Lecture de l'état APRÈS le patchState de handleDailyConnection
  const gState = gamificationService.getState();
  const awarded = Array.isArray(gState.streak?.milestonesAwarded)
    ? gState.streak.milestonesAwarded
    : [];

  if (awarded.includes(milestone.days)) return; // déjà attribué à vie

  // Attribution XP bonus
  gamificationService.notifyProgress(`streak_milestone_${milestone.days}`);

  // Trophée si applicable (unlockChallengeBadge = idempotent + bypass checkFn: null)
  if (milestone.trophy) {
    const ts = _getTrophyService();
    if (ts) ts.unlockChallengeBadge(milestone.trophy);
  }

  // Marquer le palier comme définitivement attribué
  const stateAfterXP = gamificationService.getState();
  gamificationService.patchState({
    streak: {
      ...(stateAfterXP.streak || {}),
      milestonesAwarded: [
        ...(stateAfterXP.streak?.milestonesAwarded || []),
        milestone.days,
      ],
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2 bis. SÉRIE DE FIDÉLITÉ LONGUE DURÉE (badges vétéran F1)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Met à jour la série de fidélité (`loyalty`) — distincte de la série quotidienne.
 * Règle : une connexion au moins hebdomadaire maintient la série durant la 1re année,
 * puis une connexion au moins mensuelle suffit au-delà d'un an de série continue.
 * Un écart supérieur à la tolérance réinitialise la série (nouveau `startDate`).
 *
 * Les paliers (3/6/12 mois, puis 2→35 ans) sont vérifiés par trophyService via
 * `loyaltyDays` exposé dans _getCheckData (déclenché par le prochain notifyProgress).
 *
 * @param {string} today — date du jour YYYY-MM-DD
 */
function _updateLoyaltyStreak(today) {
  const gState = gamificationService.getState();
  const prev   = gState.loyalty || {};
  let startDate      = prev.startDate      || null;
  let lastActiveDate = prev.lastActiveDate || null;

  if ((startDate && startDate > today) || (lastActiveDate && lastActiveDate > today)) {
    // Date future (horloge modifiée / sauvegarde corrompue) → repartir proprement
    startDate = today;
    lastActiveDate = today;
  } else if (!startDate || !lastActiveDate) {
    // Première prise en compte
    startDate = today;
    lastActiveDate = today;
  } else if (lastActiveDate !== today) {
    const gap           = _daysBetween(lastActiveDate, today);
    const elapsedAtLast = _daysBetween(startDate, lastActiveDate);
    const tolerance     = elapsedAtLast >= 365 ? 31 : 7; // mensuel après 1 an, sinon hebdo
    if (gap <= tolerance) {
      lastActiveDate = today;             // série maintenue
    } else {
      startDate = today;                  // série brisée → redémarrage
      lastActiveDate = today;
    }
  }

  gamificationService.patchState({ loyalty: { startDate, lastActiveDate } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. CONNEXION QUOTIDIENNE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * À appeler à chaque ouverture de l'application.
 * Idempotent : un deuxième appel dans la même journée est sans effet.
 */
function handleDailyConnection() {
  const today = _today();
  const gState = gamificationService.getState();
  let prev = gState.streak || {};

  // ── Guard : date future (sauvegarde corrompue ou changement d'horloge) ───
  // Si lastConnectionDate est dans le futur, on réinitialise la série pour
  // repartir proprement plutôt que de bloquer l'idempotence indéfiniment.
  if (prev.lastConnectionDate && prev.lastConnectionDate > today) {
    gamificationService.patchState({
      streak: {
        ...prev,
        lastConnectionDate: null,
        currentStreak:      0,
        graceUsed:          false,
      },
    });
    prev = gamificationService.getState().streak || {};
  }

  // ── Garde idempotence ────────────────────────────────────────────────────
  if (prev.lastConnectionDate === today) return;

  let currentStreak = prev.currentStreak || 0;
  let longestStreak = prev.longestStreak || 0;
  let graceUsed     = prev.graceUsed     || false;

  // ── Calcul de la nouvelle série ──────────────────────────────────────────
  if (!prev.lastConnectionDate) {
    // Toute première connexion
    currentStreak = 1;
    graceUsed     = false;
  } else {
    const gap = _daysBetween(prev.lastConnectionDate, today);

    if (gap === 1) {
      // Jour consécutif normal
      currentStreak += 1;
      // graceUsed reste tel quel (une grâce déjà utilisée reste "consommée" pour la séquence)
    } else if (gap === 2 && graceUsed === false) {
      // Utilisation de la grâce (1 seule par séquence)
      currentStreak += 1;
      graceUsed = true;
    } else if (gap === 2 && graceUsed === true) {
      // Grâce déjà utilisée → série brisée
      currentStreak = 1;
      graceUsed     = false;
    } else {
      // gap > 2 → série brisée
      currentStreak = 1;
      graceUsed     = false;
    }
  }

  longestStreak = Math.max(longestStreak, currentStreak);

  // ── Persistance de l'état streak ─────────────────────────────────────────
  gamificationService.patchState({
    streak: {
      ...(gState.streak || {}),
      currentStreak,
      longestStreak,
      lastConnectionDate: today,
      graceUsed,
    },
  });

  // ── Série de fidélité longue durée (badges vétéran F1) ────────────────────
  _updateLoyaltyStreak(today);

  // ── XP quotidien de base (5 XP) ──────────────────────────────────────────
  // La toute première connexion ne compte pas (prev.lastConnectionDate === null) :
  // l'utilisateur n'a pas encore établi de régularité.
  if (prev.lastConnectionDate !== null) {
    gamificationService.notifyProgress('daily_connection');
  }

  // ── Vérification des paliers ──────────────────────────────────────────────
  checkStreakMilestones(currentStreak);

  // ── Événement bus pour rafraîchir l'UI ───────────────────────────────────
  gamificationService.dispatchEvent('streakUpdated', {
    currentStreak,
    longestStreak,
    today,
    graceUsed,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. TROPHÉES DE CALIBRATION MENSUELLE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Vérifie et débloque les trophées de calibration mensuelle consécutive.
 * Appelé depuis gamificationService.handleMonthlyCalibration() (lazy require).
 * @param {number} consecutiveMonths
 */
function checkCalibrationTrophies(consecutiveMonths) {
  const ts = _getTrophyService();
  if (!ts) return;

  const CALIBRATION_TROPHIES = [
    { months: 3,  id: 'calibration_3_mois' },
    { months: 6,  id: 'calibration_6_mois' },
    { months: 12, id: 'calibration_12_mois' },
  ];

  CALIBRATION_TROPHIES.forEach(({ months, id }) => {
    // On débloque tous les paliers atteints ou dépassés (idempotent)
    if (consecutiveMonths >= months) {
      ts.unlockChallengeBadge(id);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. HELPER LECTURE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Retourne les données de série pour StreakDisplay.
 */
function getStreakDisplay() {
  const gState = gamificationService.getState();
  const s = gState.streak || {};
  return {
    currentStreak:      s.currentStreak      || 0,
    longestStreak:      s.longestStreak       || 0,
    graceUsed:          s.graceUsed           || false,
    lastConnectionDate: s.lastConnectionDate  || null,
    milestonesAwarded:  Array.isArray(s.milestonesAwarded) ? s.milestonesAwarded : [],
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

const streakService = {
  handleDailyConnection,
  checkStreakMilestones,
  checkCalibrationTrophies,
  getStreakDisplay,
};

export default streakService;

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * dailyTipService.js — The dashboard's "Tip of the day" card
 *
 * PUBLIC API:
 *   getDailyTip()         — the day's tip (4 priorities) or null
 *   markTipDismissed()    — closes the tip card for today
 *   isTipDismissedToday() — true if already closed today
 */

import gamificationService from './gamificationService';

// ── Import lazy pour éviter les dépendances circulaires ──────────────────────
function _getChallengeService()  { try { return require('./challengeService').default;  } catch (_) { return null; } }
function _getObjectiveService()  { try { return require('./objectiveService').default;  } catch (_) { return null; } }

function _today() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSEIL DU JOUR (4 priorités)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Retourne le conseil du jour selon les règles de priorité :
 *
 *   P1 — Score de santé critique (< 60) → questText de la quête diagnostique active
 *   P2 — Défi mensuel non complété      → titre du défi + jours restants
 *   P3 — Objectif proche (≥ 90 %)       → message de progression
 *   P4 — Streak ≥ 7                     → célébration
 *
 * @returns {{
 *   type: 'health'|'challenge'|'objective'|'streak',
 *   titleFr: string, titleEn: string,
 *   contentFr: string, contentEn: string,
 *   actionFr: string|null, actionEn: string|null,
 *   action: string|null,
 * } | null}
 */
function getDailyTip() {
  const gState = gamificationService.getState();

  // ── Priority 1 : Score de santé critique ────────────────────────────────
  const healthScore = gState.healthScore?.current ?? null;
  if (healthScore !== null && healthScore < 60) {
    const diagQuest = (gState.activeDiagnosticQuests || [])[0];
    if (diagQuest && !diagQuest.dismissed) {
      return {
        type:      'health',
        titleFr:   '⚠️ Santé financière critique',
        titleEn:   '⚠️ Critical financial health',
        contentFr: diagQuest.questText || `Votre score de santé financière est de ${healthScore}/100. Consultez votre analyse pour identifier les points à améliorer.`,
        contentEn: diagQuest.questTextEn || `Your financial health score is ${healthScore}/100. Check your analysis to identify areas for improvement.`,
        actionFr:  'Voir mon analyse',
        actionEn:  'View my analysis',
        action:    '/trophees',
      };
    }
    // Fallback si pas de questText disponible
    return {
      type:      'health',
      titleFr:   '⚠️ Santé financière à améliorer',
      titleEn:   '⚠️ Financial health needs improvement',
      contentFr: `Votre score de santé financière est de ${Math.round(healthScore)}/100. Diversifiez vos enveloppes et calibrez régulièrement pour l'améliorer.`,
      contentEn: `Your financial health score is ${Math.round(healthScore)}/100. Diversify your investment accounts and calibrate regularly to improve it.`,
      actionFr:  'Voir mon score',
      actionEn:  'View my score',
      action:    '/trophees',
    };
  }

  // ── Priority 2 : Défi mensuel non complété ───────────────────────────────
  const challengeSvc = _getChallengeService();
  if (challengeSvc) {
    const challenge = challengeSvc.getCurrentChallenge();
    if (challenge && !challenge.isCompleted) {
      const daysLeft = challengeSvc.getDaysRemainingInMonth();
      return {
        type:      'challenge',
        titleFr:   '🎯 Défi du mois en cours',
        titleEn:   '🎯 Monthly challenge in progress',
        contentFr: `${challenge.titleFr} — il vous reste ${daysLeft} jour${daysLeft > 1 ? 's' : ''} pour le relever.`,
        contentEn: `${challenge.titleEn || challenge.titleFr} — you have ${daysLeft} day${daysLeft > 1 ? 's' : ''} left to complete it.`,
        actionFr:  'Voir le défi',
        actionEn:  'View the challenge',
        action:    '/trophees',
      };
    }
  }

  // ── Priority 3 : Objectif proche (≥ 90 %) ────────────────────────────────
  const objectiveSvc = _getObjectiveService();
  if (objectiveSvc) {
    const objectives = gState.objectives || [];
    for (const obj of objectives) {
      const progress = objectiveSvc.getObjectiveProgress(obj);
      if (progress.progressPercent >= 90 && progress.progressPercent < 100) {
        return {
          type:      'objective',
          titleFr:   '🏁 Objectif presque atteint !',
          titleEn:   '🏁 Goal almost reached!',
          contentFr: `Vous êtes à ${progress.progressPercent.toFixed(0)} % de votre objectif "${obj.label}". Encore un effort !`,
          contentEn: `You are at ${progress.progressPercent.toFixed(0)}% of your goal "${obj.label}". Keep going!`,
          actionFr:  'Voir mes objectifs',
          actionEn:  'View my goals',
          action:    '/trophees',
        };
      }
    }
  }

  // ── Priority 4 : Streak ≥ 7 jours ────────────────────────────────────────
  const currentStreak = gState.streak?.currentStreak || 0;
  if (currentStreak >= 7) {
    return {
      type:      'streak',
      titleFr:   `🔥 ${currentStreak} jours consécutifs — félicitations !`,
      titleEn:   `🔥 ${currentStreak} days in a row — congratulations!`,
      contentFr: `Votre assiduité est remarquable. Continuez sur cette lancée pour faire fructifier votre patrimoine.`,
      contentEn: `Your consistency is remarkable. Keep up the momentum to grow your wealth.`,
      actionFr:  null,
      actionEn:  null,
      action:    null,
    };
  }

  // Aucun conseil prioritaire aujourd'hui
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GESTION DE LA CARTE « CONSEIL DU JOUR »
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Retourne true si la carte tip a déjà été fermée aujourd'hui.
 */
function isTipDismissedToday() {
  const gState = gamificationService.getState();
  const last   = gState.notifications?.lastDailyTipDate;
  return last === _today();
}

/**
 * Marque la carte tip comme fermée pour aujourd'hui.
 */
function markTipDismissed() {
  const gState = gamificationService.getState();
  gamificationService.patchState({
    notifications: {
      ...(gState.notifications || {}),
      lastDailyTipDate: _today(),
    },
  });
}

const dailyTipService = {
  getDailyTip,
  isTipDismissedToday,
  markTipDismissed,
};

export default dailyTipService;

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * notificationService.js — In-app notification queue
 *
 * PUBLIC API:
 *   checkAllNotifications()      — call at startup (idempotent for the day)
 *   addNotification(type, titleFr, messageFr, action?)
 *   markRead(id)
 *   markAllRead()
 *   dismiss(id)
 *   getUnread()                  → notification[]
 *   getAll()                     → notification[]
 *   getUnreadCount()             → number
 *
 * RATES / COOLDOWNS:
 *   • At most 2 gamification notifications per day (streak-danger and level-up excluded)
 *   • 3+ gamification notifications on the same day → 1 grouped notification
 *   • Badge-close: 24 h cooldown
 *   • Goal near completion: once per goal × threshold (90%, 95%)
 *   • FIRE milestone: once in a lifetime per threshold
 *   • Tax: once a year
 */

import gamificationService from './gamificationService';

// Lazy imports pour éviter dépendances circulaires
function _getDataService()        { try { return require('./dataService').default;        } catch (_) { return null; } }
function _getObjectiveService()   { try { return require('./objectiveService').default;   } catch (_) { return null; } }
function _getDailyTipService()    { try { return require('./dailyTipService').default;    } catch (_) { return null; } }

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function _today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function _currentYYYYMM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function _uuid() {
  return crypto.randomUUID ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Types exclus du plafond quotidien de 2 notifications. */
function _isExcludedFromCap(type) {
  return ['streak_danger', 'level_up', 'daily_tip'].includes(type);
}

/** Types de notifications considérés comme "gamification pure" — bloqués si gamificationEnabled = false. */
const GAMIF_NOTIF_TYPES = new Set([
  'achievement', 'level_up', 'streak_danger', 'trophy', 'gamif_summary',
  'fire_milestone', 'objective_near',
]);

/** Retourne true si la gamification est activée. */
function _isGamifOn() {
  return gamificationService.getState()?.preferences?.gamificationEnabled !== false;
}

/** Récupère l'état notifications (avec défauts si vide). */
function _getNotifState() {
  const gs = gamificationService.getState();
  return gs.notifications || {};
}

/** Persiste un patch sur notifications. */
function _patchNotifState(patch) {
  const gs = gamificationService.getState();
  gamificationService.patchState({
    notifications: { ...(gs.notifications || {}), ...patch },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRUD — FILE DE NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Ajoute une notification dans la file.
 * Respecte le plafond quotidien de 2 pour les types "gamif".
 * @param {string}      type
 * @param {string}      titleFr
 * @param {string}      messageFr
 * @param {string|null} action   — chemin de navigation (ex: "/trophees")
 * @returns {boolean} true si la notif a été ajoutée
 */
// Normalise un libellé : accepte une string (FR uniquement) ou un objet { fr, en }.
function _norm(v) {
  if (v && typeof v === 'object') return { fr: v.fr ?? '', en: v.en ?? v.fr ?? '' };
  return { fr: v ?? '', en: v ?? '' };
}

function addNotification(type, title, message, action = null) {
  // Bloquer les notifications de gamification pure si la gamification est désactivée
  if (GAMIF_NOTIF_TYPES.has(type) && !_isGamifOn()) return false;

  const today = _today();
  const ns = _getNotifState();

  // ── Plafond quotidien ────────────────────────────────────────────────────────
  if (!_isExcludedFromCap(type)) {
    const capDate  = ns.dailyCapDate  || null;
    const capCount = ns.dailyCapCount || 0;

    if (capDate === today && capCount >= 2) {
      // Vérifier si un résumé existe déjà pour aujourd'hui
      const items = Array.isArray(ns.items) ? ns.items : [];
      const hasGrouped = items.some(n => n.type === 'gamif_summary' && n.createdAt?.startsWith(today));
      if (!hasGrouped) {
        // Ajouter une notif groupée et arrêter
        _rawAdd('gamif_summary',
          { fr: 'Nouvelles activités', en: 'New activity' },
          { fr: 'Plusieurs notifications de gamification vous attendent.', en: 'Several gamification notifications are waiting for you.' },
          '/trophees', today, ns);
      }
      return false;
    }

    // Incrémenter le cap
    const newCount = capDate === today ? capCount + 1 : 1;
    _patchNotifState({ dailyCapDate: today, dailyCapCount: newCount });
  }

  const gs = gamificationService.getState();
  const ns2 = gs.notifications || {};
  _rawAdd(type, title, message, action, today, ns2);
  return true;
}

/** Ajout brut sans check de cap. `title`/`message` : string (FR) ou { fr, en }. */
function _rawAdd(type, title, message, action, today, currentNs) {
  const t = _norm(title);
  const m = _norm(message);
  const items = Array.isArray(currentNs.items) ? [...currentNs.items] : [];
  items.unshift({
    id:        _uuid(),
    type,
    titleFr:   t.fr,
    titleEn:   t.en,
    messageFr: m.fr,
    messageEn: m.en,
    createdAt: new Date().toISOString(),
    read:      false,
    action:    action || null,
  });
  // Conserver max 50 notifications
  const trimmed = items.slice(0, 50);
  _patchNotifState({ items: trimmed });
  gamificationService.dispatchEvent('notificationAdded', { type, titleFr: t.fr });
}

function markRead(id) {
  const ns = _getNotifState();
  const items = (Array.isArray(ns.items) ? ns.items : []).map(n =>
    n.id === id ? { ...n, read: true } : n
  );
  _patchNotifState({ items });
  gamificationService.dispatchEvent('notificationRead', { id });
}

function markAllRead() {
  const ns = _getNotifState();
  const items = (Array.isArray(ns.items) ? ns.items : []).map(n => ({ ...n, read: true }));
  _patchNotifState({ items });
  gamificationService.dispatchEvent('notificationRead', { id: 'all' });
}

function dismiss(id) {
  const ns = _getNotifState();
  const items = (Array.isArray(ns.items) ? ns.items : []).filter(n => n.id !== id);
  _patchNotifState({ items });
  // Supprimer une notif (lue ou non) modifie le compteur non-lu : prévenir la cloche
  // et le panneau pour qu'ils recalculent depuis la source de vérité.
  gamificationService.dispatchEvent('notificationRead', { id });
}

function getUnread() {
  const ns = _getNotifState();
  return (Array.isArray(ns.items) ? ns.items : []).filter(n => !n.read);
}

function getAll() {
  const ns = _getNotifState();
  return Array.isArray(ns.items) ? ns.items : [];
}

function getUnreadCount() {
  return getUnread().length;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRIGGERS — VÉRIFICATIONS INDIVIDUELLES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 2a. Calibration du 1er du mois.
 * Condition : aujourd'hui est le 1er ET lastCalibrationMonth ≠ mois courant.
 */
function _checkCalibrationNotif(ns, gState) {
  const today  = new Date();
  const year   = today.getFullYear();
  const month1 = today.getMonth() + 1;

  // Fenêtre = dernière semaine du mois : du dernier lundi (inclus) au dimanche suivant (inclus)
  const last       = new Date(year, month1, 0);              // dernier jour du mois
  const offset     = (last.getDay() + 6) % 7;                // recul jusqu'au lundi
  const lastMonday = new Date(year, month1 - 1, last.getDate() - offset);
  const windowEnd  = new Date(lastMonday);
  windowEnd.setDate(lastMonday.getDate() + 6);               // dimanche
  const t0 = new Date(year, today.getMonth(), today.getDate()); // aujourd'hui à minuit
  if (t0 < lastMonday || t0 > windowEnd) return;             // hors de la dernière semaine

  const currentMonth = _currentYYYYMM();
  if (gState.calibration?.lastCalibrationMonth === currentMonth) return; // déjà calibré
  // Une seule notification pour la dernière semaine de ce mois
  if ((ns.lastCalibWeekNotif || '') === currentMonth) return;

  _patchNotifState({ lastCalibWeekNotif: currentMonth });
  addNotification(
    'calibration_reminder',
    { fr: '📊 Calibration mensuelle', en: '📊 Monthly calibration' },
    { fr: "C'est la dernière semaine du mois — saisissez vos mouvements et calibrez vos enveloppes.",
      en: "It's the last week of the month — record your movements and calibrate your envelopes." },
    '/calendar'
  );
}

/**
 * 2b. Préparation déclaration fiscale (15 mars – 1er avril).
 */
function _checkFiscalPrepNotif(ns, gState) {
  const d    = new Date();
  const mm   = d.getMonth() + 1; // 1-indexed
  const day  = d.getDate();
  const year = d.getFullYear();

  const inWindow = (mm === 3 && day >= 15) || (mm < 4 && mm > 3); // mars 15 à fin mars
  if (mm !== 3 || day < 15) return; // simplification : uniquement en mars à partir du 15
  if ((ns.fiscalPrepYear || 0) >= year) return;

  _patchNotifState({ fiscalPrepYear: year });
  addNotification(
    'fiscal_prep',
    { fr: '📝 Déclaration fiscale approche', en: '📝 Tax return coming up' },
    { fr: 'La déclaration des revenus approche. Votre rapport fiscal Fructificare est prêt.',
      en: 'The income tax return is coming up. Your Fructificare tax report is ready.' },
    '/tax-report'
  );
}

/**
 * 2c. Rappel deadline fiscale (1er mai – 1er juin).
 */
function _checkFiscalDeadlineNotif(ns, gState) {
  const d    = new Date();
  const mm   = d.getMonth() + 1;
  const year = d.getFullYear();

  if (mm !== 5) return; // uniquement en mai
  if ((ns.fiscalDeadlineYear || 0) >= year) return;

  _patchNotifState({ fiscalDeadlineYear: year });
  addNotification(
    'fiscal_deadline',
    { fr: '⏰ Dernier rappel fiscal', en: '⏰ Final tax reminder' },
    { fr: 'Dernier rappel : la date limite varie selon votre département, vérifiez la vôtre.',
      en: 'Final reminder: the deadline varies by region — check yours.' },
    '/tax-report'
  );
}

/**
 * 2d. Série en danger (streak >= 30 et pas encore connecté aujourd'hui).
 */
function _checkStreakDangerNotif(ns, gState) {
  const streak = gState.streak || {};
  if ((streak.currentStreak || 0) < 30) return;

  const todayStr = _today();
  if (streak.lastConnectionDate === todayStr) return;   // déjà connecté aujourd'hui
  if ((ns.lastStreakWarningDate || '') === todayStr) return; // déjà averti aujourd'hui

  _patchNotifState({ lastStreakWarningDate: todayStr });
  addNotification(
    'streak_danger',  // exclu du cap
    { fr: '🔥 Votre série est en jeu !', en: '🔥 Your streak is at risk!' },
    { fr: `Votre série de ${streak.currentStreak} jours est en jeu ! Connectez-vous avant minuit.`,
      en: `Your ${streak.currentStreak}-day streak is at risk! Log in before midnight.` },
    null
  );
}

/**
 * 2f. Défi mensuel non complété (28 du mois).
 */
function _checkMonthlyChallengeNotif(ns, gState) {
  const d = new Date();
  if (d.getDate() !== 28) return;
  if (gState.challenges?.completed === true) return;

  const todayStr = _today();
  const already  = (ns.items || []).some(
    n => n.type === 'challenge_reminder' && n.createdAt?.startsWith(todayStr)
  );
  if (already) return;

  addNotification(
    'challenge_reminder',
    { fr: '🏆 Défi mensuel', en: '🏆 Monthly challenge' },
    { fr: '3 jours pour finir le défi du mois et gagner votre badge exclusif.',
      en: '3 days left to finish the monthly challenge and earn your exclusive badge.' },
    '/'
  );
}

/**
 * 2g. Baisse du score de santé (> 10 pts dans le même mois).
 */
function _checkHealthDropNotif(ns, gState) {
  const todayStr = _today();
  if ((ns.lastHealthDropDate || '') === todayStr) return;

  const history = gState.healthScore?.history || [];
  if (history.length < 2) return;

  // Prendre les 2 dernières entrées
  const sorted = [...history].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const last   = sorted[sorted.length - 1];
  const prev   = sorted[sorted.length - 2];
  if (!last || !prev) return;

  const drop = (prev.score || 0) - (last.score || 0);
  if (drop <= 10) return;

  // Même mois ?
  const sameMonth = (last.date || '').slice(0, 7) === (prev.date || '').slice(0, 7);
  if (!sameMonth) return;

  _patchNotifState({ lastHealthDropDate: todayStr });
  addNotification(
    'health_drop',
    { fr: '📉 Score de santé en baisse', en: '📉 Health score dropping' },
    { fr: `Votre score de santé a baissé de ${Math.round(drop)} pts — consultez le détail pour comprendre et réagir.`,
      en: `Your health score dropped by ${Math.round(drop)} pts — check the breakdown to understand and react.` },
    '/trophees'
  );
}

/**
 * 2h. Objectif proche de la complétion (>= 90 %).
 */
function _checkObjectiveNearNotif(ns, gState) {
  const objectives = gState.objectives || [];
  if (objectives.length === 0) return;

  const ds = _getDataService();
  const os = _getObjectiveService();
  if (!ds || !os) return;

  const sentMap = { ...(ns.objectiveNotifSent || {}) };
  let changed   = false;

  const THRESHOLDS = [95, 90]; // order: check 95% first

  for (const obj of objectives) {
    try {
      const progress = os.getObjectiveProgress(obj);
      const pct = progress.progressPercent || 0;
      if (pct >= 100 || pct < 90) continue;

      for (const threshold of THRESHOLDS) {
        if (pct < threshold) continue;
        const key = `${obj.id}_${threshold}`;
        if (sentMap[key]) break; // already sent for this obj/threshold

        const remaining = Math.max(0, (obj.targetAmount || 0) - (progress.currentAmount || 0));
        const fmt = (v) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

        sentMap[key] = true;
        changed = true;
        addNotification(
          'objective_near',
          { fr: '🎯 Objectif presque atteint !', en: '🎯 Goal almost reached!' },
          { fr: `Vous êtes à ${Math.round(pct)} % de votre objectif "${obj.label}". Plus que ${fmt(remaining)} !`,
            en: `You're at ${Math.round(pct)}% of your goal "${obj.label}". Only ${fmt(remaining)} to go!` },
          '/trophees'
        );
        break; // une seule notif par objectif par passe
      }
    } catch (_) {}
  }

  if (changed) _patchNotifState({ objectiveNotifSent: sentMap });
}

/**
 * 2i. Palier FIRE franchi (25 %, 50 %, 75 %).
 */
function _checkFireMilestoneNotif(ns, gState) {
  const ds = _getDataService();
  if (!ds) return;

  const MILESTONES = [25, 50, 75];
  const already    = Array.isArray(ns.fireMilestonesNotified) ? ns.fireMilestonesNotified : [];

  // Calcul du max FIRE progress
  let maxFire = 0;
  try {
    const sims = ds.getSimulations();
    sims.forEach(sim => {
      try {
        const stats = ds.getSimulationStats(sim.id);
        if (stats && typeof stats.fireProgress === 'number') {
          maxFire = Math.max(maxFire, stats.fireProgress);
        }
      } catch (_) {}
    });
  } catch (_) {}

  for (const milestone of MILESTONES) {
    if (maxFire < milestone) break;
    if (already.includes(milestone)) continue;

    const updated = [...already, milestone];
    _patchNotifState({ fireMilestonesNotified: updated });
    addNotification(
      'fire_milestone',
      { fr: '🔥 Palier FIRE atteint !', en: '🔥 FIRE milestone reached!' },
      { fr: `Votre taux FIRE vient de franchir les ${milestone} % — félicitations !`,
        en: `Your FIRE rate just passed ${milestone}% — congratulations!` },
      '/simulation'
    );
    break; // une seule notif par passe
  }
}

/**
 * 2j. Badge proche du déverrouillage (max 1 par jour, cooldown 24h).
 */
function _checkBadgeCloseNotif(ns, gState) {
  const todayStr = _today();
  if ((ns.lastBadgeCloseDate || '') === todayStr) return;

  const ds = _getDataService();
  if (!ds) return;

  let portfolios = [];
  let totalBalance = 0;
  let totalPnL = 0;
  let healthScore = 0;
  try {
    portfolios   = ds.getPortfolios();
    totalBalance = portfolios.reduce((s, p) => s + Math.max(0, p.balance || 0), 0);
    const gy     = ds.computeGlobalYield?.();
    totalPnL     = gy ? (gy.totalGain || 0) : 0;
    healthScore  = gState.healthScore?.current || 0;
  } catch (_) {}

  const trophies = gState.trophies || {};
  const fmt      = (v) => `${Math.round(v).toLocaleString('fr-FR')} €`;

  // Liste des checks badge-close (order = priority)
  const CHECKS = [
    {
      id:    'ingenieur_patrimonial',
      unlocked: !!trophies['ingenieur_patrimonial']?.unlocked,
      check: () => portfolios.length === 1,
      msg:   { fr: "Il ne vous manque qu'une enveloppe pour débloquer le badge 'Ingénieur patrimonial'.",
               en: "You're just one envelope away from unlocking the 'Wealth Engineer' badge." },
    },
    {
      id:    'premier_gain',
      unlocked: !!trophies['premier_gain']?.unlocked,
      check: () => totalPnL >= 80 && totalPnL < 100,
      msg:   { fr: `Votre PnL est à ${fmt(totalPnL)} — encore ${fmt(100 - totalPnL)} pour le badge 'Premier gain' !`,
               en: `Your PnL is at ${fmt(totalPnL)} — ${fmt(100 - totalPnL)} more for the 'First Gain' badge!` },
    },
    {
      id:    'cap_10k',
      unlocked: !!trophies['cap_10k']?.unlocked,
      check: () => totalBalance >= 9000 && totalBalance < 10000,
      msg:   { fr: `Votre patrimoine est à ${fmt(totalBalance)} — encore ${fmt(10000 - totalBalance)} pour le badge 'Cap des 10 000 €' !`,
               en: `Your wealth is at ${fmt(totalBalance)} — ${fmt(10000 - totalBalance)} more for the '€10,000 milestone' badge!` },
    },
    {
      id:    'investisseur_serieux',
      unlocked: !!trophies['investisseur_serieux']?.unlocked,
      check: () => totalBalance >= 22500 && totalBalance < 25000,
      msg:   { fr: `Plus que ${fmt(25000 - totalBalance)} pour le badge 'Investisseur sérieux' !`,
               en: `Only ${fmt(25000 - totalBalance)} to go for the 'Serious Investor' badge!` },
    },
    {
      id:    'cap_50k',
      unlocked: !!trophies['cap_50k']?.unlocked,
      check: () => totalBalance >= 47500 && totalBalance < 50000,
      msg:   { fr: `Plus que ${fmt(50000 - totalBalance)} pour le badge 'Cap des 50 000 €' !`,
               en: `Only ${fmt(50000 - totalBalance)} to go for the '€50,000 milestone' badge!` },
    },
    {
      id:    'bonne_sante',
      unlocked: !!trophies['bonne_sante']?.unlocked,
      check: () => healthScore >= 55 && healthScore < 60,
      msg:   { fr: `Votre score de santé est à ${Math.round(healthScore)}/100 — encore quelques points pour le badge 'En bonne santé' !`,
               en: `Your health score is ${Math.round(healthScore)}/100 — a few more points for the 'Healthy' badge!` },
    },
    {
      id:    'portfolio_equilibre',
      unlocked: !!trophies['portfolio_equilibre']?.unlocked,
      check: () => healthScore >= 70 && healthScore < 75,
      msg:   { fr: `Score de santé à ${Math.round(healthScore)}/100 — si près du badge 'Portefeuille équilibré' !`,
               en: `Health score ${Math.round(healthScore)}/100 — so close to the 'Balanced Portfolio' badge!` },
    },
  ];

  for (const check of CHECKS) {
    if (check.unlocked) continue;
    try {
      if (check.check()) {
        _patchNotifState({ lastBadgeCloseDate: todayStr });
        addNotification(
          'badge_close',
          { fr: '🏅 Badge à portée de main !', en: '🏅 Badge within reach!' },
          check.msg,
          '/trophees'
        );
        return; // max 1 notif badge-close par passe
      }
    } catch (_) {}
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POINT D'ENTRÉE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 2k. Rappels dans les 7 prochains jours — avance de notification.
 * Marque `notificationSent = true` sur le rappel pour éviter les doublons.
 */
function _checkReminderAdvanceNotif() {
  const ds = _getDataService();
  if (!ds) return;

  try {
    const reminders  = ds.getReminders();
    const todayStr   = _today();
    const todayDate  = new Date(todayStr + 'T00:00:00');
    const in7Days    = new Date(todayDate);
    in7Days.setDate(in7Days.getDate() + 7);
    const in7DaysStr = in7Days.toISOString().split('T')[0];

    for (const rem of reminders) {
      // Ignorer les rappels passés, déjà notifiés ou automatiques
      if (rem.notificationSent) continue;
      if (rem.type === 'calibration') continue;
      if (!rem.date) continue;
      if (rem.date < todayStr) continue;     // passé
      if (rem.date > in7DaysStr) continue;   // trop loin

      // Envoyer la notification
      addNotification(
        'reminder_advance',
        { fr: '🔔 Rappel dans 7 jours', en: '🔔 Reminder in 7 days' },
        { fr: `"${rem.label}" arrive le ${new Date(rem.date + 'T12:00:00').toLocaleDateString('fr-FR')}.`,
          en: `"${rem.label}" is coming on ${new Date(rem.date + 'T12:00:00').toLocaleDateString('en-US')}.` },
        '/calendar'
      );
      // Marquer comme notifié pour ne pas répéter
      try { ds.updateReminder(rem.id, { notificationSent: true }); } catch (_) {}
    }
  } catch (e) {
    console.warn('[notificationService] _checkReminderAdvanceNotif error:', e);
  }
}

/**
 * 2l. Conseil du jour — au plus UNE notification par jour (déplacé du tableau de bord).
 *     Le conseil provient de dailyTipService (santé / défi / objectif / série).
 */
function _checkDailyTipNotif(ns) {
  const todayStr = _today();
  if ((ns.lastDailyTipNotifDate || '') === todayStr) return; // déjà un conseil aujourd'hui

  const tipSvc = _getDailyTipService();
  if (!tipSvc) return;

  let tip = null;
  try { tip = tipSvc.getDailyTip(); } catch (_) { tip = null; }
  if (!tip) return; // aucun conseil pertinent aujourd'hui

  _patchNotifState({ lastDailyTipNotifDate: todayStr });
  addNotification('daily_tip',
    { fr: tip.titleFr, en: tip.titleEn || tip.titleFr },
    { fr: tip.contentFr, en: tip.contentEn || tip.contentFr },
    tip.action || null);
}

/**
 * Lance toutes les vérifications de déclencheurs.
 * Idempotent : les gardes individuels empêchent les doublons sur la même journée.
 */
function checkAllNotifications() {
  try {
    const gState = gamificationService.getState();
    const ns     = gState.notifications || {};

    _checkStreakDangerNotif(ns, gState);     // 2d — exclu du cap
    _checkCalibrationNotif(ns, gState);     // 2a
    _checkFiscalPrepNotif(ns, gState);      // 2b
    _checkFiscalDeadlineNotif(ns, gState);  // 2c
    _checkMonthlyChallengeNotif(ns, gState);// 2f
    _checkHealthDropNotif(ns, gState);      // 2g
    _checkObjectiveNearNotif(ns, gState);   // 2h
    _checkFireMilestoneNotif(ns, gState);   // 2i
    _checkBadgeCloseNotif(ns, gState);      // 2j
    _checkReminderAdvanceNotif();           // 2k — rappels dans les 7 jours
    _checkDailyTipNotif(ns);                // 2l — conseil du jour (1/jour)
  } catch (e) {
    console.warn('[notificationService] checkAllNotifications error:', e);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

const notificationService = {
  checkAllNotifications,
  addNotification,
  markRead,
  markAllRead,
  dismiss,
  getUnread,
  getAll,
  getUnreadCount,
};

export default notificationService;

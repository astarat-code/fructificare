// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * calendarService.js — Événements calendrier & export .ics (Prompt 11)
 *
 * API PUBLIQUE :
 *   generateCalendarEvents(yearFrom?, yearTo?)  → CalendarEvent[]
 *   expandToDateMap(events, year, month)        → { [YYYY-MM-DD]: CalendarEvent[] }
 *   exportToICS(events)                         → télécharge le fichier .ics
 *
 * Structure CalendarEvent :
 *   { id, title, date, recurrence, description, autoHide, category }
 *
 * Valeurs de `recurrence` : 'none' | 'daily' | 'weekly' | 'monthly' | 'annual'
 * Valeurs de `category`   : 'fiscal' | 'calibration' | 'streak' | 'challenge'
 *                           | 'review' | 'portfolio'
 */

// Lazy imports
function _getGameService()  { try { return require('./gamificationService').default; } catch (_) { return null; } }
function _getDataService()  { try { return require('./dataService').default;         } catch (_) { return null; } }

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function _pad(n) { return String(n).padStart(2, '0'); }

function _dateStr(y, m, d) {
  return `${y}-${_pad(m)}-${_pad(d)}`;
}

/** Retourne toutes les occurrences d'un pattern sur une plage d'années. */
function _expandAnnual(yearFrom, yearTo, month, day, baseEvt) {
  const events = [];
  for (let y = yearFrom; y <= yearTo; y++) {
    events.push({ ...baseEvt, id: `${baseEvt.id}_${y}`, date: _dateStr(y, month, day) });
  }
  return events;
}

/** Dernier lundi d'un mois donné (year, month 1-indexé) → 'YYYY-MM-DD'. */
function _lastMondayOfMonth(year, month1) {
  const last   = new Date(year, month1, 0);        // jour 0 du mois suivant = dernier jour
  const offset = (last.getDay() + 6) % 7;          // jours à reculer jusqu'au lundi
  const day    = last.getDate() - offset;
  return _dateStr(year, month1, day);
}

/** Génère le dernier lundi de chaque mois sur une plage d'années. */
function _allLastMondays(yearFrom, yearTo) {
  const dates = [];
  for (let y = yearFrom; y <= yearTo; y++) {
    for (let m = 1; m <= 12; m++) {
      dates.push(_lastMondayOfMonth(y, m));
    }
  }
  return dates;
}

/** Génère les 28 de chaque mois sur une plage d'années. */
function _all28thOfMonth(yearFrom, yearTo) {
  const dates = [];
  for (let y = yearFrom; y <= yearTo; y++) {
    for (let m = 1; m <= 12; m++) {
      dates.push(_dateStr(y, m, 28));
    }
  }
  return dates;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GÉNÉRATION DES ÉVÉNEMENTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Génère tous les événements calendrier pour la plage d'années demandée.
 * @param {number} [yearFrom] — défaut : année courante - 1
 * @param {number} [yearTo]   — défaut : année courante + 2
 * @returns {CalendarEvent[]}
 */
function generateCalendarEvents(yearFrom, yearTo) {
  const currentYear = new Date().getFullYear();
  yearFrom = yearFrom ?? (currentYear - 1);
  yearTo   = yearTo   ?? (currentYear + 2);

  const gs = _getGameService();
  const ds = _getDataService();
  // Titres et descriptions dans la langue d'affichage (aussi utilisés par l'export .ics).
  let en = false;
  try { en = ds?.getAppPreferences?.().language === 'en'; } catch (_) { /* français par défaut */ }
  const L = (fr, eng) => (en ? eng : fr);
  const gState = gs ? gs.getState() : {};

  // Si la gamification est désactivée, on masque les événements purement
  // ludiques (défis, séries) mais on conserve les événements
  // financiers / fiscaux / patrimoniaux.
  const gamifEnabled = gState?.preferences?.gamificationEnabled !== false;

  const events = [];

  // ── 1. Calibration mensuelle (dernier lundi de chaque mois) ────────────────
  const currentMonth    = `${new Date().getFullYear()}-${_pad(new Date().getMonth() + 1)}`;
  const calibDone       = gState.calibration?.lastCalibrationMonth === currentMonth;
  _allLastMondays(yearFrom, yearTo).forEach((date) => {
    events.push({
      id:          `calibration_${date}`,
      title:       L('Calibration mensuelle', 'Monthly calibration'),
      date,
      recurrence:  'monthly',
      description: L('Saisissez vos mouvements du mois et calibrez vos enveloppes.', "Record this month's movements and calibrate your envelopes."),
      autoHide:    date.startsWith(currentMonth) && calibDone,
      category:    'calibration',
    });
  });

  // ── 2. Préparation déclaration fiscale (15 mars, annuel) ───────────────────
  _expandAnnual(yearFrom, yearTo, 3, 15, {
    id:          'fiscal_prep',
    title:       L('📝 Préparez votre déclaration fiscale', '📝 Prepare your tax return'),
    recurrence:  'annual',
    description: L('La déclaration des revenus approche. Téléchargez votre rapport fiscal Fructificare.', 'The income tax return is coming up. Download your Fructificare tax report.'),
    autoHide:    false,
    category:    'fiscal',
  }).forEach(e => events.push(e));

  // ── 3. Deadline fiscale (1er mai, annuel) ──────────────────────────────────
  _expandAnnual(yearFrom, yearTo, 5, 1, {
    id:          'fiscal_deadline',
    title:       L('⏰ Deadline fiscale', '⏰ Tax deadline'),
    recurrence:  'annual',
    description: L('Dernier rappel : la date limite varie selon votre département, vérifiez la vôtre.', 'Last reminder: the deadline depends on your département, check yours.'),
    autoHide:    false,
    category:    'fiscal',
  }).forEach(e => events.push(e));


  // ── 5. Défi mensuel (28 de chaque mois) — gamification uniquement ──────────
  if (gamifEnabled) {
    const challengeDone = gState.challenges?.completed === true;
    _all28thOfMonth(yearFrom, yearTo).forEach(date => {
      events.push({
        id:          `challenge_${date}`,
        title:       L('🏆 Défi mensuel — J-3', '🏆 Monthly challenge — 3 days left'),
        date,
        recurrence:  'monthly',
        description: L('3 jours pour finir le défi du mois et gagner votre badge exclusif.', "3 days to finish this month's challenge and earn its exclusive badge."),
        autoHide:    date.startsWith(currentMonth) && challengeDone,
        category:    'challenge',
      });
    });
  }

  // ── 6. Rappel série quotidien (si streak >= 30) — gamification uniquement ──
  if (gamifEnabled) {
    const currentStreak = gState.streak?.currentStreak || 0;
    if (currentStreak >= 30) {
      // Générer pour les 30 prochains jours
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        events.push({
          id:          `streak_${dateStr}`,
          title:       L(`🔥 Série ${currentStreak + i} jours`, `🔥 ${currentStreak + i}-day streak`),
          date:        dateStr,
          recurrence:  'daily',
          description: L(`Connectez-vous aujourd'hui pour maintenir votre série de ${currentStreak + i} jours.`, `Open Fructificare today to keep your ${currentStreak + i}-day streak.`),
          autoHide:    false,
          category:    'streak',
        });
      }
    }
  }

  // ── 7. Bilan trimestriel (1er jan, avr, jul, oct) ─────────────────────────
  const quarterDates = [[1, 1], [4, 1], [7, 1], [10, 1]];
  quarterDates.forEach(([m, d]) => {
    _expandAnnual(yearFrom, yearTo, m, d, {
      id:          `quarterly_review_${m}`,
      title:       L('📈 Bilan trimestriel', '📈 Quarterly review'),
      recurrence:  'annual',
      description: L('Moment de revoir vos allocations, vos performances et vos objectifs trimestriels.', 'Time to review your allocations, performance and quarterly goals.'),
      autoHide:    false,
      category:    'review',
    }).forEach(e => events.push(e));
  });

  // ── 8. Bilan annuel (1er janvier) ─────────────────────────────────────────
  _expandAnnual(yearFrom, yearTo, 1, 1, {
    id:          'annual_review',
    title:       L('🌟 Bilan annuel', '🌟 Annual review'),
    recurrence:  'annual',
    description: L('Nouvelle année — revoyez vos objectifs, vos performances et planifiez la suite.', 'New year — review your goals and performance, and plan what comes next.'),
    autoHide:    false,
    category:    'review',
  }).forEach(e => events.push(e));

  // ── 9. PEA — anniversaire 5 ans ───────────────────────────────────────────
  if (ds) {
    try {
      const portfolios = ds.getPortfolios();
      portfolios
        .filter(p => p.type === 'PEA' && p.contract_start_date)
        .forEach(p => {
          const start   = new Date(p.contract_start_date);
          const fiveYrs = new Date(start);
          fiveYrs.setFullYear(start.getFullYear() + 5);
          const dateStr = fiveYrs.toISOString().split('T')[0];
          events.push({
            id:          `pea_5yr_${p.id}`,
            title:       L(`🎉 PEA "${p.name}" — 5 ans !`, `🎉 PEA "${p.name}" — 5 years!`),
            date:        dateStr,
            recurrence:  'none',
            description: L(`Votre PEA "${p.name}" a 5 ans ! Il est désormais exonéré d'IR sur les plus-values.`, `Your PEA "${p.name}" is 5 years old! Its capital gains are now exempt from income tax.`),
            autoHide:    false,
            category:    'portfolio',
          });
        });

      // ── 10. Assurance-vie — anniversaire 8 ans ────────────────────────────
      portfolios
        .filter(p => p.type === 'assurance_vie' && p.contract_start_date)
        .forEach(p => {
          const start   = new Date(p.contract_start_date);
          const eightYrs = new Date(start);
          eightYrs.setFullYear(start.getFullYear() + 8);
          const dateStr = eightYrs.toISOString().split('T')[0];
          events.push({
            id:          `av_8yr_${p.id}`,
            title:       L(`🎉 Assurance-vie "${p.name}" — 8 ans !`, `🎉 Life insurance "${p.name}" — 8 years!`),
            date:        dateStr,
            recurrence:  'none',
            description: L(`Votre assurance-vie "${p.name}" a 8 ans ! L'abattement fiscal est maintenant actif.`, `Your life insurance "${p.name}" is 8 years old! The tax allowance now applies.`),
            autoHide:    false,
            category:    'portfolio',
          });
        });
    } catch (_) {}
  }

  // ── 11. Revue des frais bi-annuelle (janvier et juillet) ──────────────────
  [[1, 15], [7, 15]].forEach(([m, d]) => {
    _expandAnnual(yearFrom, yearTo, m, d, {
      id:          `fee_review_${m}`,
      title:       L('✂️ Revue des frais', '✂️ Fee review'),
      recurrence:  'annual',
      description: L('Comparez vos TER et renégociez si possible vos frais de gestion.', 'Compare your expense ratios and renegotiate your management fees if you can.'),
      autoHide:    false,
      category:    'review',
    }).forEach(e => events.push(e));
  });

  return events;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPAND TO DATE MAP (pour intégration CalendarPage)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Construit un map { [YYYY-MM-DD]: CalendarEvent[] } pour un mois donné.
 * Filtre les événements autoHide si leur condition est déjà remplie.
 * @param {CalendarEvent[]} events
 * @param {number}          year   — ex: 2025
 * @param {number}          month  — 0-indexed
 */
function expandToDateMap(events, year, month) {
  const prefix = `${year}-${_pad(month + 1)}`;
  const map = {};

  events.forEach(evt => {
    if (!evt.date) return;
    if (!evt.date.startsWith(prefix)) return;
    if (evt.autoHide) return; // masquer les événements auto-cachés

    if (!map[evt.date]) map[evt.date] = [];
    map[evt.date].push(evt);
  });

  return map;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT .ICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Génère un fichier .ics et le télécharge dans le navigateur.
 * @param {CalendarEvent[]} [events] — si omis, génère pour l'année courante
 */
function exportToICS(events) {
  const evts = events || generateCalendarEvents();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Fructificare//Investment App//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Fructificare',
    'X-WR-TIMEZONE:Europe/Paris',
  ];

  evts.forEach(evt => {
    if (!evt.date) return;

    // Format YYYYMMDD (date-only)
    const dtStart = evt.date.replace(/-/g, '');
    const dtEnd   = _nextDay(evt.date).replace(/-/g, '');
    const uid     = `${evt.id}@fructificare.app`;
    const summary = _icsEscape(evt.title);
    const desc    = _icsEscape(evt.description || '');
    const stamp   = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
    lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
    lines.push(`SUMMARY:${summary}`);
    if (desc) lines.push(`DESCRIPTION:${desc}`);

    // Récurrence
    if (evt.recurrence === 'annual')  lines.push('RRULE:FREQ=YEARLY');
    if (evt.recurrence === 'monthly') lines.push('RRULE:FREQ=MONTHLY');
    if (evt.recurrence === 'weekly')  lines.push('RRULE:FREQ=WEEKLY;BYDAY=SU');
    if (evt.recurrence === 'daily')   lines.push('RRULE:FREQ=DAILY');

    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');

  const icsContent = lines.join('\r\n');
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'fructificare_calendrier.ics';
  a.click();
  URL.revokeObjectURL(url);
}

function _nextDay(dateStr) {
  // Midi et non minuit : toISOString() ramène minuit heure locale à la veille en
  // France, et la fin de l'événement .ics retombait sur son début.
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function _icsEscape(str) {
  return (str || '').replace(/[\\;,\n]/g, c => c === '\n' ? '\\n' : '\\' + c);
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

const calendarService = {
  generateCalendarEvents,
  expandToDateMap,
  exportToICS,
};

export default calendarService;

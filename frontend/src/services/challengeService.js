// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * challengeService.js — Fructificare's monthly missions
 *
 * 12 missions, one per calendar month. Each mission:
 *   • displays a VERBATIM text (descriptionFr),
 *   • completes when ALL its conditions are met (or a SINGLE one with "either"),
 *   • grants, on completion, its dedicated trophy (1 mission = 1 trophy) + 150 XP.
 *
 * TRACKING:
 *   • Completion PER YEAR: challenges.completions = { "YYYY-MM": ISO }.
 *     → every mission can be completed again once a year, the badge staying earned.
 *   • MONTHLY visit / action flags: challenges.flags = { name: "YYYY-MM" }.
 *     → a flag is "active" only if its value === the current month
 *       (automatic monthly AND yearly reset, with no purge).
 *
 * COMPATIBILITY:
 *   • challenges.completed / completedAt stay a MIRROR of the current month
 *     (read by calendarService).
 *   • The old trackers (trackFiscalReportGenerated, trackSevereStressTest…) and their date
 *     fields are kept (action history, with no direct consumer).
 */

import dataService         from './dataService';
import gamificationService from './gamificationService';

// Import lazy pour éviter les dépendances circulaires
let _trophyService = null;
function _getTrophyService() {
  if (!_trophyService) {
    try { _trophyService = require('./trophyService').default; } catch (_) {}
  }
  return _trophyService;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function _currentYYYYMM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function _currentMonthNumber() { return new Date().getMonth() + 1; }
function _currentYear()        { return new Date().getFullYear(); }

/** Drapeau mensuel actif : a été posé pendant le mois courant. */
function _flag(gs, name) {
  return gs?.challenges?.flags?.[name] === _currentYYYYMM();
}

// ── Conditions lues directement depuis les données (pas de drapeau requis) ─────

/** Au moins une enveloppe a des frais (frais annuels OU frais de mouvement). */
function _hasEnvelopeWithFees(pd) {
  const portfolios = pd.portfolios || [];
  if (portfolios.some(p => (parseFloat(p.annual_fees_pct) || 0) > 0)) return true;
  try {
    const txns = dataService.getData().transactions || [];
    if (txns.some(t => (t.fees_amount || 0) > 0)) return true;
  } catch (_) {}
  return false;
}

/** Détient au moins un actif défensif (obligation, fonds euro ou or) avec solde > 0. */
function _hasDefensiveAsset() {
  try {
    const stats = dataService.getAssetTypeStats();
    return ['obligation', 'fond_euro', 'or'].some(t => (stats[t]?.balance || 0) > 0);
  } catch (_) { return false; }
}

/** Un PEA existe ET a reçu au moins un versement. */
function _hasPEAWithDeposit(pd) {
  const peaIds = (pd.portfolios || []).filter(p => p.type === 'PEA').map(p => p.id);
  if (peaIds.length === 0) return false;
  try {
    const txns = dataService.getData().transactions || [];
    return txns.some(t => t.type === 'deposit' && peaIds.includes(t.portfolio_id));
  } catch (_) { return false; }
}

/** Une note OU un rappel utilisateur daté du mois courant ou d'un mois futur existe. */
function _hasCurrentOrFutureCalendarItem() {
  const prefix = _currentYYYYMM();
  try {
    const reminders = (dataService.getReminders() || []).filter(r => r.type !== 'calibration');
    const notes     = dataService.getCalendarNotes() || [];
    return [...reminders, ...notes].some(it => it.date && String(it.date).slice(0, 7) >= prefix);
  } catch (_) { return false; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. CATALOGUE DES 12 MISSIONS MENSUELLES
//    descriptionFr = texte affiché VERBATIM (ne pas modifier).
// ═══════════════════════════════════════════════════════════════════════════════

export const MONTHLY_CHALLENGE_CATALOG = [
  {
    month: 1,
    titleFr: 'Automatisation globale',
    titleEn: 'Global Automation',
    descriptionFr: "Définissez votre capacité d'épargne pour 2026 en mettant à jour votre salaire et configurez vos versements programmés (DCA) pour vos enveloppes principales",
    descriptionEn: 'Set your 2026 saving capacity by updating your salary, and configure your scheduled contributions (DCA) for your main accounts.',
    badgeId: 'mission_jan_automation',
    badgeLabel: 'Automatisation globale',
    navigateTo: '/settings',
    requiresCheckbox: false,
    validationFn: (pd, gs) => _flag(gs, 'visitSettings') && _flag(gs, 'visitRecurring'),
  },
  {
    month: 2,
    titleFr: 'Maître des frais',
    titleEn: 'Fee Master',
    descriptionFr: "Vérifiez et renseignez les frais annuels de toutes vos enveloppes. Vérifiez également les frais d'entrée lors de l'ajout d'un mouvement",
    descriptionEn: 'Check and fill in the annual fees of all your accounts. Also check the entry fees when adding a movement.',
    badgeId: 'mission_feb_fees',
    badgeLabel: 'Maître des frais',
    navigateTo: '/',
    requiresCheckbox: false,
    validationFn: (pd, gs) => _hasEnvelopeWithFees(pd) && _flag(gs, 'visitEnvelopeEdit'),
  },
  {
    month: 3,
    titleFr: 'Rééquilibrage et défense',
    titleEn: 'Rebalancing and Defence',
    descriptionFr: "Les marchés ayant bougé en début d'année, réajustez vos enveloppes pour retrouver votre allocation cible initiale (par exemple, 80 % d'action et 20 % d'obligation) et assurez-vous d'avoir au moins un actif défensif (obligations, fonds euros, or) qui permet de mieux résister à une crise financière",
    descriptionEn: 'As markets have moved early in the year, readjust your accounts to restore your initial target allocation (e.g. 80% equities and 20% bonds) and make sure you hold at least one defensive asset (bonds, money market funds, gold) to better withstand a financial crisis.',
    badgeId: 'mission_mar_rebalance',
    badgeLabel: 'Rééquilibrage et défense',
    navigateTo: '/',
    requiresCheckbox: false,
    validationFn: (pd, gs) => _flag(gs, 'viewAllocationPie') && _hasDefensiveAsset(),
  },
  {
    month: 4,
    titleFr: 'Déclarant',
    titleEn: 'Tax Filer',
    descriptionFr: "Pensez à bien calibrer vos enveloppes, générez votre rapport fiscal PDF depuis le simulateur fiscal et préparez votre déclaration d'impôt en récupérant les IFU auprès de vos courtiers",
    descriptionEn: 'Remember to calibrate your accounts, generate your tax report PDF from the tax simulator, and prepare your tax return by collecting the IFU statements from your brokers.',
    badgeId: 'mission_apr_declarant',
    badgeLabel: 'Déclarant',
    navigateTo: '/tax-report',
    requiresCheckbox: false,
    validationFn: (pd, gs) => _flag(gs, 'fiscalReportPrevYear'),
  },
  {
    month: 5,
    titleFr: 'Revue du calendrier',
    titleEn: 'Calendar Review',
    descriptionFr: "Consultez le calendrier de vos versements et analysez votre répartition.",
    descriptionEn: 'Review your contributions calendar and analyse your breakdown.',
    badgeId: 'mission_may_calendar',
    badgeLabel: 'Revue du calendrier',
    navigateTo: '/calendar',
    requiresCheckbox: false,
    validationFn: (pd, gs) => _flag(gs, 'visitCalendar') && _flag(gs, 'viewExpenseBreakdown'),
  },
  {
    month: 6,
    titleFr: 'Prêt pour la crise',
    titleEn: 'Crisis Ready',
    descriptionFr: "Changez les mots de passe de tous vos comptes financiers et activez la double authentification (2FA) si possible, pour accroître la sécurité de vos investissements. Ensuite, allez dans la partie simulation et lancez un stress test pour analyser la résistance de votre portefeuille.",
    descriptionEn: 'Change the passwords of all your financial accounts and enable two-factor authentication (2FA) where possible to increase the security of your investments. Then go to the simulation section and run a stress test to analyse your portfolio resilience.',
    badgeId: 'mission_jun_crisis',
    badgeLabel: 'Prêt pour la crise',
    navigateTo: '/simulation',
    requiresCheckbox: false,
    // NB : le texte source mentionnait « juillet » mais il s'agit de la mission de JUIN.
    validationFn: (pd, gs) => _flag(gs, 'stressTest'),
  },
  {
    month: 7,
    titleFr: 'Alerte frais',
    titleEn: 'Fee Alert',
    descriptionFr: "Identifiez l'enveloppe avec les frais totaux les plus élevés dans votre portefeuille et consultez le détail.",
    descriptionEn: 'Identify the account with the highest total fees in your portfolio and review the breakdown.',
    badgeId: 'mission_jul_fee_alert',
    badgeLabel: 'Alerte frais',
    navigateTo: '/',
    requiresCheckbox: false,
    validationFn: (pd, gs) => _flag(gs, 'viewFeeDetail'),
  },
  {
    month: 8,
    titleFr: 'Ajustement du prélèvement à la source',
    titleEn: 'Withholding Tax Adjustment',
    descriptionFr: "Consultez votre avis d'imposition disponible en ligne fin juillet/début août. Profitez-en pour moduler votre taux de prélèvement à la source sur le site des impôts si vos revenus ont évolué.",
    descriptionEn: 'Review your tax assessment available online in late July / early August. Take the opportunity to adjust your withholding tax rate on the tax authority website if your income has changed.',
    badgeId: 'mission_aug_withholding',
    badgeLabel: 'Ajustement du prélèvement',
    navigateTo: null,
    requiresCheckbox: true,
    validationFn: (pd, gs) => _flag(gs, 'm8SelfDeclared'),
  },
  {
    month: 9,
    titleFr: 'Optimiseur fiscal',
    titleEn: 'Tax Optimiser',
    descriptionFr: "Effectuer un versement volontaire sur le PER (Plan d'Epargne Retraite) si vous souhaitez déduire ces sommes de votre revenu imposable, ou effectuez une simulation avec au moins une des enveloppes dans le simulateur d'imposition.",
    descriptionEn: 'Make a voluntary contribution to your PER (retirement savings plan) if you wish to deduct these amounts from your taxable income, or run a simulation with at least one account in the tax simulator.',
    badgeId: 'mission_sep_tax_optim',
    badgeLabel: 'Optimiseur fiscal',
    navigateTo: '/simulation/tax',
    requiresCheckbox: false,
    // « either » : versement sur un PEA OU simulation lancée dans le simulateur fiscal.
    validationFn: (pd, gs) => _hasPEAWithDeposit(pd) || _flag(gs, 'taxSimRun'),
  },
  {
    month: 10,
    titleFr: "Prévoir la fin d'année",
    titleEn: 'Plan the Year-End',
    descriptionFr: "Ajouter une note ou un rappel dans le calendrier, pour ne pas oublier les derniers ajustements de portefeuille avant la fin de l'année et commencer à prévoir les objectifs de l'année prochaine.",
    descriptionEn: 'Add a note or a reminder in the calendar so you do not forget the final portfolio adjustments before year-end, and start planning next year\'s goals.',
    badgeId: 'mission_oct_yearend',
    badgeLabel: "Prévoir la fin d'année",
    navigateTo: '/calendar',
    requiresCheckbox: false,
    validationFn: (pd, gs) => _hasCurrentOrFutureCalendarItem(),
  },
  {
    month: 11,
    titleFr: 'Le point sur les rendements',
    titleEn: 'Reviewing Returns',
    descriptionFr: "Faites un point sur le rendement de vos enveloppes. Dans le graphique d'évolution de chaque enveloppe, activez l'affichage du rendement cible pour comparer vos performances avec celle historique. En cas de moins values, pas de panique ! Pensez à reporter vos moins-values sur votre prochaine déclaration fiscale si l'enveloppe le permet.",
    descriptionEn: "Take stock of your accounts' returns. On each account's evolution chart, enable the target-return display to compare your performance with the historical one. In case of capital losses, do not panic! Remember to carry your losses forward to your next tax return if the account allows it.",
    badgeId: 'mission_nov_yields',
    badgeLabel: 'Le point sur les rendements',
    navigateTo: '/',
    requiresCheckbox: false,
    validationFn: (pd, gs) => _flag(gs, 'targetCurveActivated'),
  },
  {
    month: 12,
    titleFr: 'Bilan annuel',
    titleEn: 'Annual Review',
    descriptionFr: "Calculez la performance nette de votre patrimoine ajustée à l'inflation, puis figez tout. C'est le mois de la déconnexion totale pour attaquer l'année suivante avec l'esprit serein.",
    descriptionEn: 'Compute the inflation-adjusted net performance of your wealth, then freeze everything. This is the month of total disconnection, to start the following year with a clear mind.',
    badgeId: 'mission_dec_bilan',
    badgeLabel: 'Bilan annuel',
    navigateTo: '/simulation',
    requiresCheckbox: false,
    validationFn: (pd, gs) => _flag(gs, 'simInflationImport'),
  },
];

/** Lookup O(1) par numéro de mois. */
const _catalogByMonth = Object.fromEntries(
  MONTHLY_CHALLENGE_CATALOG.map(c => [c.month, c])
);

// ═══════════════════════════════════════════════════════════════════════════════
// 3. RÉINITIALISATION MENSUELLE (miroir `completed`)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Met à jour le miroir `completed` du mois courant (lu par calendarService).
 * Ne purge PAS completions/flags : les flags sont déjà mensuels (auto-expirés)
 * et completions conserve l'historique par année.
 */
function handleMonthlyChallengeReset() {
  const gState = gamificationService.getState();
  const ym     = _currentYYYYMM();
  if (gState.challenges?.currentMonth === ym) return;

  const prev = gState.challenges || {};
  const doneAt = (prev.completions || {})[ym] || null;
  gamificationService.patchState({
    challenges: {
      ...prev,
      currentMonth: ym,
      completed:    !!doneAt,
      completedAt:  doneAt,
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. VÉRIFICATION DE COMPLÉTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Vérifie si la mission du mois courant est accomplie (idempotent par année/mois).
 * @returns {Promise<void>}
 */
async function checkMonthlyChallenge() {
  const ym = _currentYYYYMM();
  const gState = gamificationService.getState();
  if (gState.challenges?.completions?.[ym]) return; // déjà validée cette année

  const month   = _currentMonthNumber();
  const mission  = _catalogByMonth[month];
  if (!mission) return;

  let pd = { portfolios: [], simulations: [] };
  try {
    pd = { portfolios: dataService.getPortfolios(), simulations: dataService.getSimulations() };
  } catch (_) {}

  let isValid = false;
  try {
    isValid = await mission.validationFn(pd, gamificationService.getState());
  } catch (e) {
    console.warn('[challengeService] validation error —', month, e);
    return;
  }
  if (!isValid) return;

  const now  = new Date().toISOString();
  const prev = gamificationService.getState().challenges || {};
  gamificationService.patchState({
    challenges: {
      ...prev,
      completed:   true,            // miroir mois courant (compat calendarService)
      completedAt: now,
      completions: { ...(prev.completions || {}), [ym]: now },
    },
  });

  gamificationService.notifyProgress('mission_' + month);

  const ts = _getTrophyService();
  if (ts) ts.unlockChallengeBadge(mission.badgeId);

  gamificationService.dispatchEvent('challengeCompleted', { challenge: mission, completedAt: now });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. POSE DE DRAPEAUX (visites / actions des missions)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Pose un drapeau mensuel (visite d'une page / section, ou action). Idempotent
 * dans le mois (évite les patchs redondants), puis relance la vérification.
 * @param {string} flagName
 */
function markVisit(flagName) {
  if (!flagName) return;
  const gs    = gamificationService.getState();
  const flags = gs.challenges?.flags || {};
  if (flags[flagName] !== _currentYYYYMM()) {
    gamificationService.patchState({
      challenges: { ...(gs.challenges || {}), flags: { ...flags, [flagName]: _currentYYYYMM() } },
    });
  }
  checkMonthlyChallenge().catch(() => {});
}

/**
 * Mission 4 — rapport fiscal généré pour l'année de référence = année courante − 1.
 * @param {number} year — année de référence du rapport fiscal
 */
function trackFiscalReportForYear(year) {
  if (parseInt(year, 10) === _currentYear() - 1) markVisit('fiscalReportPrevYear');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. TRACKERS HÉRITÉS — posent des champs de date dans challenges (historique d'actions).
//    Conservés pour compatibilité des sauvegardes ; sans consommateur direct actuellement.
// ═══════════════════════════════════════════════════════════════════════════════

function _patchChallengeDate(field) {
  const today  = new Date().toISOString().split('T')[0];
  const gState = gamificationService.getState();
  gamificationService.patchState({
    challenges: { ...(gState.challenges || {}), [field]: today },
  });
}

/** TaxReport.js — rapport fiscal PDF généré. */
function trackFiscalReportGenerated() {
  _patchChallengeDate('lastFiscalReportDate');
  checkMonthlyChallenge().catch(() => {});
}

/** Simulation — inflation ≥ 4 % sur horizon ≥ 20 ans. */
function trackHighInflationSimulation(inflationRate, years) {
  if ((parseFloat(inflationRate) || 0) < 4) return;
  if ((parseInt(years, 10) || 0) < 20) return;
  _patchChallengeDate('lastHighInflationSimDate');
  checkMonthlyChallenge().catch(() => {});
}

/** SimulationDetail — simulation FIRE lancée. */
function trackFireSimulation(targetAge) {
  const today  = new Date().toISOString().split('T')[0];
  const gState = gamificationService.getState();
  gamificationService.patchState({
    challenges: { ...(gState.challenges || {}), lastFireSimDate: today, lastFireSimTargetAge: targetAge ?? null },
  });
  checkMonthlyChallenge().catch(() => {});
}

/** SimulationDetail — stress test sévère (actions ≤ -50 %, crypto ≤ -60 %). */
function trackSevereStressTest() {
  _patchChallengeDate('lastSevereStressTestDate');
  checkMonthlyChallenge().catch(() => {});
}

/** TaxSimulator — comparaison fiscale PEA vs CTO. */
function trackFiscalPEACTOComparison() {
  _patchChallengeDate('lastFiscalPEACTOCompDate');
  checkMonthlyChallenge().catch(() => {});
}

/** Settings — revenu net mensuel mis à jour. */
function trackIncomeUpdated() {
  _patchChallengeDate('incomeUpdatedAt');
  checkMonthlyChallenge().catch(() => {});
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. ACCESSEURS POUR L'UI
// ═══════════════════════════════════════════════════════════════════════════════

/** Retourne la mission du mois courant enrichie avec son état de complétion. */
function getCurrentChallenge() {
  const month   = _currentMonthNumber();
  const mission  = _catalogByMonth[month];
  if (!mission) return null;

  const completedAt = gamificationService.getState().challenges?.completions?.[_currentYYYYMM()] || null;
  return { ...mission, isCompleted: !!completedAt, completedAt };
}

/** Nombre de jours restants dans le mois courant (1 minimum). */
function getDaysRemainingInMonth() {
  const now     = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.max(1, lastDay - now.getDate() + 1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. ABONNEMENT AU BUS D'ÉVÉNEMENTS
// ═══════════════════════════════════════════════════════════════════════════════

let _watcherInitialized = false;
function initChallengeWatcher() {
  if (_watcherInitialized) return;
  _watcherInitialized = true;
  gamificationService.onEvent('progressUpdated', () => {
    checkMonthlyChallenge().catch(() => {});
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

const challengeService = {
  MONTHLY_CHALLENGE_CATALOG,
  handleMonthlyChallengeReset,
  checkMonthlyChallenge,
  initChallengeWatcher,
  markVisit,
  trackFiscalReportForYear,
  // Trackers hérités (historique d'actions)
  trackFiscalReportGenerated,
  trackHighInflationSimulation,
  trackFireSimulation,
  trackSevereStressTest,
  trackFiscalPEACTOComparison,
  trackIncomeUpdated,
  getCurrentChallenge,
  getDaysRemainingInMonth,
};

export default challengeService;

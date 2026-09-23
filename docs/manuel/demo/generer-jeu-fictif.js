// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * generer-jeu-fictif.js — A 100% FICTIONAL demo backup for the screenshots.
 *
 * No data derives from a real portfolio: envelopes, amounts, movement templates, budget,
 * reminders and profile are invented here, and the pseudo-random draw uses a fixed seed
 * (the same file on every run, for a given current date).
 *
 * Past occurrences of recurring movements are written in advance, as the application
 * would: on load nothing is "caught up", so no notification about applied movements
 * sneaks into a screenshot. Regenerate the dataset on the day you take the screenshots.
 *
 * Usage:  node demo/generer-jeu-fictif.js [YYYY-MM-DD]
 *         → demo/fructificare-jeu-fictif.json, and each file in English (-en.json)
 */
const fs = require('fs');
const path = require('path');

const AUJOURDHUI = process.argv[2] || new Date().toISOString().slice(0, 10);
const SORTIE = path.join(__dirname, 'fructificare-jeu-fictif.json');

// ── Outils ─────────────────────────────────────────────────────────────────────
let graine = 20260917;
const alea = () => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine / 2147483648; };
const hex = (l) => Array.from({ length: l }, () => Math.floor(alea() * 16).toString(16)).join('');
const uuid = () => `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
const arrondi = (x) => Math.round(x * 100) / 100;
const creeLe = `${AUJOURDHUI}T08:00:00.000Z`;

/** Même arithmétique que _addMonthsRM (dataService). */
function ajouterMois(date, n) {
  const d = new Date(`${date}T12:00:00`);
  const cible = d.getMonth() + n;
  d.setMonth(cible);
  if (d.getMonth() !== ((cible % 12 + 12) % 12)) d.setDate(0);
  return d.toISOString().split('T')[0];
}
const PAS = { monthly: 1, quarterly: 3, semi_annual: 6, annual: 12 };

// ── Rendements annuels inventés par type d'actif (servent aux calibrations) ────
const RENDEMENTS = {
  action:     { 2015: 8, 2016: 5, 2017: 9, 2018: -9, 2019: 24, 2020: 6, 2021: 22, 2022: -12, 2023: 16, 2024: 15, 2025: 8, 2026: 4 },
  fond_euro:  { 2015: 2.2, 2016: 1.9, 2017: 1.8, 2018: 1.7, 2019: 1.5, 2020: 1.3, 2021: 1.3, 2022: 2, 2023: 2.5, 2024: 2.6, 2025: 2.5, 2026: 2.4 },
  obligation: { 2021: -2, 2022: -14, 2023: 6, 2024: 3, 2025: 3, 2026: 2 },
  immobilier: { 2019: 4.5, 2020: 4, 2021: 4.2, 2022: -4, 2023: -6, 2024: 5, 2025: 5, 2026: 3 },
  or:         { 2021: -4, 2022: 5, 2023: 10, 2024: 22, 2025: 30, 2026: 12 },
  crypto:     { 2021: 40, 2022: -60, 2023: 120, 2024: 90, 2025: -5, 2026: -12 },
};
const facteurMensuel = (type, annee) => (1 + ((RENDEMENTS[type] || {})[annee] ?? 3) / 100) ** (1 / 12);

// ── Données ────────────────────────────────────────────────────────────────────
const portfolios = [];
const transactions = [];
const movement_templates = [];
const calibrations = [];
const regular_movements = [];

function enveloppe(nom, type, debut, extra = {}) {
  const p = {
    id: uuid(), name: nom, type, created_date: creeLe, contract_start_date: debut,
    annual_fees_pct: 0, annual_fees_type: 'percent', annual_return_rate: 5,
    regulated_subtype: null, include_in_tax_report: type !== 'compte_réglementé', ...extra,
  };
  portfolios.push(p);
  return p;
}

function modele(p, nom, asset_type, fees_pct = 0) {
  const m = {
    id: uuid(), name: nom, portfolio_id: p.id, fees_pct, fees_type: 'percent', fee_direction: 'deducted',
    annual_fees_pct: 0, annual_fees_type: 'percent', asset_type, multi_asset_allocations: null, created_at: creeLe,
  };
  movement_templates.push(m);
  return m;
}

function mouvement(p, o) {
  const amount = arrondi(o.amount);
  const feesPct = o.fees_pct || 0;
  const fees = arrondi(amount * feesPct / 100);
  const net = arrondi(amount - fees);
  const depot = o.type === 'deposit';
  const tx = {
    id: uuid(), portfolio_id: p.id, date: o.date, amount, fees_pct: feesPct, fees_amount: fees,
    fees_type: 'percent', fee_direction: 'deducted', net_amount: net, annual_fees_pct: 0,
    annual_fees_type: 'percent', type: o.type, note: o.note || '', template_id: o.modele ? o.modele.id : null,
    asset_type: o.modele ? o.modele.asset_type : o.asset_type, custom_asset_type: null, movement_group_id: null,
    keep_in_cash: !depot && !!o.keep_in_cash,
    from_cash_amount: depot ? (o.from_cash || 0) : 0,
    new_funds_amount: depot ? arrondi(net - (o.from_cash || 0)) : 0,
    quantity: o.prix ? Math.round((amount / o.prix) * 10000) / 10000 : null,
    unit_price: o.prix || null,
    created_at: creeLe,
  };
  transactions.push(tx);
  return tx;
}

/** Mouvement régulier + ses occurrences passées, écrites comme syncRegularMovements. */
function regulier(p, o) {
  const rm = {
    id: uuid(), portfolio_id: p.id, type: o.type || 'deposit', amount: o.amount, start_date: o.debut,
    recurrence: o.recurrence || 'monthly', end_date: o.fin || null, note: o.note || null,
    asset_types: o.allocations.map(a => a.type), asset_allocations: o.allocations.length > 1 ? o.allocations : [],
    fees_pct: 0, fees_type: 'percent', fee_direction: 'deducted', annual_fees_pct: 0, annual_fees_type: 'percent',
    status: 'active', historique_modifications: [], created_at: creeLe,
  };
  const borne = rm.end_date && rm.end_date < AUJOURDHUI ? rm.end_date : AUJOURDHUI;
  for (let d = rm.start_date, n = 0; d <= borne && n < 500; d = ajouterMois(d, PAS[rm.recurrence]), n++) {
    const groupe = o.allocations.length > 1 ? `${rm.id}_${d}` : null;
    for (const a of o.allocations) {
      const part = arrondi(rm.amount * a.pct / 100);
      transactions.push({
        id: uuid(), portfolio_id: p.id, type: rm.type, amount: part, fees_pct: 0, fees_amount: 0,
        fees_type: 'percent', fee_direction: 'deducted', annual_fees_pct: 0, annual_fees_type: 'percent',
        net_amount: part, date: d, note: `[Mouvement récurrent]${rm.note ? ` ${rm.note}` : ''}`,
        asset_type: a.type, movement_group_id: groupe, from_recurring_id: rm.id, auto_applied: true, created_at: creeLe,
      });
    }
    rm.last_applied_date = d;
  }
  regular_movements.push(rm);
  return rm;
}

// ── 1. Assurance vie ouverte il y a plus de 8 ans (bouclier « Défiscalisé ») ──
const av = enveloppe('Assurance vie Horizon', 'assurance_vie', '2015-03-16', { annual_fees_pct: 0.6, annual_return_rate: 4 });
mouvement(av, { type: 'deposit', date: '2015-03-16', amount: 6000, asset_type: 'fond_euro', note: 'Versement initial' });
mouvement(av, { type: 'deposit', date: '2015-03-16', amount: 4000, asset_type: 'action', note: 'Versement initial' });
regulier(av, { amount: 200, debut: '2015-04-05', note: 'Épargne mensuelle', allocations: [{ type: 'fond_euro', pct: 50 }, { type: 'action', pct: 50 }] });
mouvement(av, { type: 'deposit', date: '2019-12-10', amount: 3000, asset_type: 'immobilier', note: 'SCPI Bureaux Europe' });
mouvement(av, { type: 'deposit', date: '2023-12-18', amount: 1500, asset_type: 'immobilier', note: 'SCPI Bureaux Europe' });
mouvement(av, { type: 'withdrawal', date: '2024-06-14', amount: 2500, asset_type: 'fond_euro', note: 'Rachat partiel' });

// ── 2. PEA de plus de 5 ans ────────────────────────────────────────────────────
const pea = enveloppe('PEA Actions', 'PEA', '2018-05-14', { annual_return_rate: 7 });
const monde = modele(pea, 'ETF Monde', 'action', 0.2);
const europe = modele(pea, 'ETF Europe', 'action', 0.2);
const emergents = modele(pea, 'ETF Pays émergents', 'action', 0.2);
{
  let prixMonde = 18, prixEurope = 32, prixEm = 21;
  for (let d = '2018-05-15', i = 0; d <= AUJOURDHUI; d = ajouterMois(d, 3), i++) {
    const an = Number(d.slice(0, 4));
    prixMonde *= facteurMensuel('action', an) ** 3; prixEurope *= facteurMensuel('action', an) ** 3 * 0.995; prixEm *= facteurMensuel('action', an) ** 3 * 0.99;
    const effort = an >= 2024 ? 1.6 : an >= 2021 ? 1.25 : 1;
    mouvement(pea, { type: 'deposit', date: d, amount: 900 * effort, modele: monde, fees_pct: 0.2, note: 'ETF Monde', prix: arrondi(prixMonde) });
    if (i % 2 === 0) mouvement(pea, { type: 'deposit', date: d, amount: 450 * effort, modele: europe, fees_pct: 0.2, note: 'ETF Europe', prix: arrondi(prixEurope) });
    if (i % 4 === 1) mouvement(pea, { type: 'deposit', date: d, amount: 350 * effort, modele: emergents, fees_pct: 0.2, note: 'ETF Pays émergents', prix: arrondi(prixEm) });
  }
}
mouvement(pea, { type: 'withdrawal', date: '2025-03-20', amount: 1200, modele: europe, fees_pct: 0.2, note: 'ETF Europe', keep_in_cash: true });
mouvement(pea, { type: 'deposit', date: '2025-06-16', amount: 800, modele: monde, fees_pct: 0.2, note: 'ETF Monde', from_cash: 798.4 });

// ── 3. Compte-titres ───────────────────────────────────────────────────────────
const cto = enveloppe('Compte-titres Diversification', 'CTO', '2021-02-08', { annual_return_rate: 5 });
const oblig = modele(cto, "ETF Obligations d'État", 'obligation', 0.1);
const fonciere = modele(cto, 'Foncière cotée', 'immobilier', 0.1);
const or = modele(cto, 'ETC Or physique', 'or', 0.1);
for (let d = '2021-02-10', i = 0; d <= AUJOURDHUI; d = ajouterMois(d, 6), i++) {
  mouvement(cto, { type: 'deposit', date: d, amount: 1000, modele: oblig, fees_pct: 0.1, note: "ETF Obligations d'État" });
  mouvement(cto, { type: 'deposit', date: d, amount: 600, modele: fonciere, fees_pct: 0.1, note: 'Foncière cotée' });
  if (i % 2 === 0) mouvement(cto, { type: 'deposit', date: d, amount: 500, modele: or, fees_pct: 0.1, note: 'ETC Or physique' });
}
regulier(cto, { amount: 300, debut: '2021-03-01', fin: '2023-12-31', recurrence: 'quarterly', note: 'Obligations 2021', allocations: [{ type: 'obligation', pct: 100 }] });
regulier(cto, { amount: 150, debut: '2024-01-05', note: 'Obligations', allocations: [{ type: 'obligation', pct: 100 }] });
mouvement(cto, { type: 'withdrawal', date: '2026-04-15', amount: 1500, modele: fonciere, fees_pct: 0.1, note: 'Foncière cotée', keep_in_cash: true });

// ── 4. Crypto-actifs (vente contre euros en 2026 → imposable) ─────────────────
const crypto = enveloppe('Crypto-actifs', 'CTO', '2021-11-02', { annual_return_rate: 10 });
const btc = modele(crypto, 'Bitcoin', 'crypto', 1);
const eth = modele(crypto, 'Ether', 'crypto', 1);
for (let d = '2021-11-03', i = 0; d <= AUJOURDHUI; d = ajouterMois(d, 2), i++) {
  mouvement(crypto, { type: 'deposit', date: d, amount: 150, modele: btc, fees_pct: 1, note: 'Bitcoin' });
  if (i % 2 === 1) mouvement(crypto, { type: 'deposit', date: d, amount: 100, modele: eth, fees_pct: 1, note: 'Ether' });
}
mouvement(crypto, { type: 'withdrawal', date: '2026-02-20', amount: 2000, modele: btc, fees_pct: 1, note: 'Bitcoin', keep_in_cash: true });

// ── 5. PER ─────────────────────────────────────────────────────────────────────
const per = enveloppe('PER Retraite', 'PER', '2023-01-09', { annual_fees_pct: 0.7, annual_return_rate: 5 });
mouvement(per, { type: 'deposit', date: '2023-01-09', amount: 2000, asset_type: 'action', note: 'Versement initial' });
regulier(per, { amount: 150, debut: '2023-02-10', note: 'Versement PER', allocations: [{ type: 'action', pct: 70 }, { type: 'obligation', pct: 30 }] });

// ── 6. Livret A ────────────────────────────────────────────────────────────────
const livret = enveloppe('Livret A', 'compte_réglementé', '2012-01-02', { regulated_subtype: 'livret_a', annual_return_rate: 1.7 });
mouvement(livret, { type: 'deposit', date: '2012-01-02', amount: 3000, asset_type: 'fond_euro', note: 'Épargne de précaution' });
mouvement(livret, { type: 'deposit', date: '2016-09-01', amount: 2500, asset_type: 'fond_euro', note: 'Épargne de précaution' });
mouvement(livret, { type: 'deposit', date: '2020-02-03', amount: 2000, asset_type: 'fond_euro', note: 'Épargne de précaution' });
mouvement(livret, { type: 'withdrawal', date: '2024-07-08', amount: 1200, asset_type: 'fond_euro', note: 'Vacances' });
regulier(livret, { amount: 50, debut: '2024-01-05', fin: '2025-06-30', note: 'Précaution', allocations: [{ type: 'fond_euro', pct: 100 }] });

// ── Valeurs simulées → calibrations ────────────────────────────────────────────
function calibrer(p, dates, detail) {
  const txs = transactions.filter(t => t.portfolio_id === p.id).sort((a, b) => (a.date < b.date ? -1 : 1));
  const positions = {};
  // Ventilation par modèle : comme dans l'application, la calibration ne porte que sur
  // les mouvements types ; les mouvements sans modèle (récurrents) sont rattachés au
  // modèle du même type d'actif.
  const modeleDuType = (type) => movement_templates.find(m => m.portfolio_id === p.id && m.asset_type === type);
  const cle = (t) => {
    if (detail !== 'modele') return t.asset_type;
    return t.template_id || modeleDuType(t.asset_type)?.id || t.asset_type;
  };
  let i = 0;
  let mois = txs[0].date.slice(0, 7);
  const finMois = AUJOURDHUI.slice(0, 7);
  const aFaire = [...dates].sort();
  while (mois <= finMois) {
    // mouvements du mois
    while (i < txs.length && txs[i].date.slice(0, 7) === mois) {
      const t = txs[i++];
      const k = cle(t);
      if (t.type === 'deposit') positions[k] = (positions[k] || 0) + (t.net_amount || t.amount);
      else positions[k] = Math.max(0, (positions[k] || 0) - t.amount);
    }
    // calibrations tombant ce mois-ci (valeur avant la croissance du mois, arrondie)
    while (aFaire.length && aFaire[0].slice(0, 7) === mois) {
      const date = aFaire.shift();
      const total = Object.values(positions).reduce((s, v) => s + v, 0);
      const derniere = !aFaire.length;
      calibrations.push({
        id: uuid(), portfolio_id: p.id, date, total_value: arrondi(total),
        asset_breakdown: derniere ? Object.entries(positions).filter(([, v]) => v > 0).map(([k, v]) => {
          const m = movement_templates.find(x => x.id === k);
          return m ? { template_id: m.id, asset_type: m.asset_type, name: m.name, value: arrondi(v) } : { asset_type: k, value: arrondi(v) };
        }) : null,
        created_at: creeLe,
      });
    }
    // croissance du mois, avec un peu de bruit
    const an = Number(mois.slice(0, 4));
    for (const k of Object.keys(positions)) {
      const type = movement_templates.find(x => x.id === k)?.asset_type || k;
      positions[k] *= facteurMensuel(type, an) * (1 + (alea() - 0.5) * (type === 'crypto' ? 0.08 : type === 'fond_euro' ? 0 : 0.02));
    }
    mois = ajouterMois(`${mois}-01`, 1).slice(0, 7);
  }
}

const moisPrecedents = [3, 2, 1].map(n => {
  const d = new Date(`${AUJOURDHUI.slice(0, 7)}-01T12:00:00`);
  d.setDate(0);
  d.setMonth(d.getMonth() - (n - 1) + 1, 0);
  return d.toISOString().slice(0, 10);
});
const finsDAnnee = (debut) => {
  const out = [];
  for (let a = Number(debut.slice(0, 4)); a < Number(AUJOURDHUI.slice(0, 4)); a++) out.push(`${a}-12-31`);
  return out;
};
calibrer(av, [...finsDAnnee('2015'), ...moisPrecedents], 'type');
calibrer(pea, [...finsDAnnee('2018'), ...moisPrecedents], 'modele');
calibrer(cto, [...finsDAnnee('2021'), ...moisPrecedents], 'modele');
calibrer(crypto, [...finsDAnnee('2021'), ...moisPrecedents], 'modele');
calibrer(per, [...finsDAnnee('2023'), ...moisPrecedents], 'type');

// ── Calendrier : rappels (dont deux en retard), notes, budget ──────────────────
const jourDuMois = (n) => `${AUJOURDHUI.slice(0, 8)}${String(n).padStart(2, '0')}`;
const decaler = (jours) => { const d = new Date(`${AUJOURDHUI}T12:00:00`); d.setDate(d.getDate() + jours); return d.toISOString().slice(0, 10); };
const rid = () => Math.floor(alea() * 36 ** 9).toString(36).padStart(9, '0');

const reminders = [
  // Date calculée comme syncCalibrationReminder : même quantième que la dernière calibration (31 → 1er du mois suivant).
  { id: 'cal-auto', label: 'Calibration mensuelle', date: ajouterMois(`${AUJOURDHUI.slice(0, 7)}-01`, 1), recurrence: 'monthly', dismissed_dates: [], type: 'calibration', created_at: creeLe },
  { id: rid(), label: "Relire l'avis d'imposition", date: decaler(-6), recurrence: 'none', dismissed_dates: [], type: 'custom', notificationSent: false, created_at: creeLe },
  { id: rid(), label: 'Comparer les frais du PER', date: decaler(-2), recurrence: 'none', dismissed_dates: [], type: 'custom', notificationSent: false, created_at: creeLe },
  { id: rid(), label: 'Rééquilibrer le PEA', date: decaler(18), recurrence: 'annual', dismissed_dates: [], type: 'custom', notificationSent: false, created_at: creeLe },
];

const calendar_notes = [
  { id: uuid(), date: decaler(7), text: 'Rendez-vous conseiller : ouverture LDDS', color: '#6366f1', created_at: creeLe },
  { id: uuid(), date: decaler(-9), text: 'Prime de rentrée à placer', color: '#10b981', created_at: creeLe },
];

const debutAnnee = `${AUJOURDHUI.slice(0, 4)}-01-01`;
const budget_entries = [
  { id: rid(), date: debutAnnee, category: 'salaire', custom_label: null, amount: 2650, kind: 'income', recurrence: 'monthly', created_at: creeLe },
  { id: rid(), date: debutAnnee, category: 'loyer', custom_label: null, amount: 720, kind: 'expense', recurrence: 'monthly', created_at: creeLe },
  { id: rid(), date: debutAnnee, category: 'nourriture', custom_label: null, amount: 340, kind: 'expense', recurrence: 'monthly', created_at: creeLe },
  { id: rid(), date: debutAnnee, category: 'charges', custom_label: null, amount: 165, kind: 'expense', recurrence: 'monthly', created_at: creeLe },
  { id: rid(), date: debutAnnee, category: 'loisirs', custom_label: null, amount: 110, kind: 'expense', recurrence: 'monthly', created_at: creeLe },
  { id: rid(), date: jourDuMois(12), category: 'autre', custom_label: 'Révision du vélo', amount: 85, kind: 'expense', recurrence: 'none', created_at: creeLe },
];

// ── Profil et progression (fictifs) ────────────────────────────────────────────
const quests = {};
for (let q = 1; q <= 6; q++) quests[`Q${q}`] = { completed: true, completedAt: creeLe };

const gamification = {
  profile: {
    username: 'Gabriel', birthDate: '1990-11-23', monthlyNetIncome: 2650, annualReturnTarget: null,
    allocationTarget: {}, lastFiscalRecommendation: null, incomeUpdatedAt: creeLe,
  },
  flags: { onboardingWelcomeShown: true, envelopeCalibrated: true, movementWithFeesAdded: true },
  firstTime: { envelopeCalibration: true },
  counters: { assetsAdded: movement_templates.length, envelopesCreated: portfolios.length, movementsRecorded: 60 },
  calibration: { lastCalibrationMonth: moisPrecedents[2].slice(0, 7), consecutiveMonths: 3, xpAwardedThisMonth: false, totalCount: 3 },
  quests,
  currentQuestIndex: 7,
  temporality: { firstLaunchDate: decaler(-120), lastLaunchDate: decaler(-1), totalWeeksActive: 17, missionsUnlocked: true },
  // Quelques notifications de types différents (panneau de la cloche, figure 3.2).
  notifications: {
    items: [
      { id: uuid(), type: 'reminder_advance', titleFr: '🔔 Rappel dans 7 jours', titleEn: '🔔 Reminder in 7 days',
        messageFr: `"Rééquilibrer le PEA" arrive le ${new Date(`${decaler(7)}T12:00:00`).toLocaleDateString('fr-FR')}.`,
        messageEn: '"Rééquilibrer le PEA" is coming soon.', createdAt: `${decaler(0)}T07:30:00.000Z`, read: false, action: '/calendar' },
      { id: uuid(), type: 'badge_close', titleFr: '🏅 Badge à portée de main !', titleEn: '🏅 Badge within reach!',
        messageFr: 'Plus que 20 160 € de capital pour débloquer « Couronne ».', messageEn: 'Only €20,160 left to unlock "Crown".',
        createdAt: `${decaler(-1)}T18:10:00.000Z`, read: false, action: '/trophees' },
      { id: uuid(), type: 'calibration_reminder', titleFr: '📊 Calibration mensuelle', titleEn: '📊 Monthly calibration',
        messageFr: "C'est la dernière semaine du mois — saisissez vos mouvements et calibrez vos enveloppes.",
        messageEn: "It's the last week of the month — record your movements and calibrate your envelopes.",
        createdAt: `${decaler(-19)}T09:00:00.000Z`, read: true, action: '/calendar' },
      { id: uuid(), type: 'fire_milestone', titleFr: '🔥 Palier FIRE atteint !', titleEn: '🔥 FIRE milestone reached!',
        messageFr: 'Votre taux FIRE vient de franchir les 25 % — félicitations !', messageEn: 'Your FIRE rate just passed 25% — congratulations!',
        createdAt: `${decaler(-30)}T20:45:00.000Z`, read: true, action: '/simulation' },
    ],
  },
  schemaVersion: 9,
};

const sauvegarde = {
  portfolios, transactions, movement_templates, calibrations, reminders, budget_entries,
  programmed_movements: [], calendar_notes, regular_movements, rule843_sims: [], documents: [],
  fire_settings: { monthly_need: 2200, withdrawal_rate: 4 },
  simulations: [], gamification,
  appPreferences: { theme: null, language: 'fr', colorStyle: 'pastel', includeRegulatedInPerf: true },
  export_date: creeLe, version: '2.4', _fictif: true,
};

// ── Version anglaise (manuel en anglais) ───────────────────────────────────────
// Mêmes données, libellés saisis par l'utilisateur traduits et interface en anglais.
// Les clés techniques (types, catégories de budget) restent celles de l'application.
const EN = {
  'Assurance vie Horizon': 'Horizon Life Insurance', 'Assurance vie': 'Life insurance',
  'Versement initial': 'Initial deposit', 'Épargne mensuelle': 'Monthly savings',
  'SCPI Bureaux Europe': 'SCPI European Offices', 'Rachat partiel': 'Partial withdrawal',
  'PEA Actions': 'PEA Stocks', 'ETF Monde': 'World ETF', 'ETF Europe': 'Europe ETF',
  'ETF Pays émergents': 'Emerging Markets ETF', 'Compte-titres Diversification': 'Diversified CTO',
  "ETF Obligations d'État": 'Government Bond ETF', 'Foncière cotée': 'Listed Real Estate',
  'ETC Or physique': 'Physical Gold ETC', 'Obligations 2021': 'Bonds 2021', Obligations: 'Bonds',
  'Crypto-actifs': 'Crypto Assets', 'PER Retraite': 'PER Retirement', 'Versement PER': 'PER deposit',
  'Épargne de précaution': 'Emergency fund', Précaution: 'Emergency fund', Vacances: 'Holidays',
  'Calibration mensuelle': 'Monthly calibration', "Relire l'avis d'imposition": 'Review the tax notice',
  'Comparer les frais du PER': 'Compare PER fees', 'Rééquilibrer le PEA': 'Rebalance the PEA',
  'Rendez-vous conseiller : ouverture LDDS': 'Adviser meeting: open an LDDS',
  'Prime de rentrée à placer': 'Invest the September bonus', 'Révision du vélo': 'Bike service',
  'Premier million': 'First million',
};
const PREFIXE_RECURRENT = '[Mouvement récurrent]';
function enAnglais(valeur) {
  if (Array.isArray(valeur)) return valeur.map(enAnglais);
  if (valeur && typeof valeur === 'object') return Object.fromEntries(Object.entries(valeur).map(([k, v]) => [k, enAnglais(v)]));
  if (typeof valeur !== 'string') return valeur;
  if (EN[valeur]) return EN[valeur];
  if (valeur.startsWith(`${PREFIXE_RECURRENT} `)) {
    const reste = valeur.slice(PREFIXE_RECURRENT.length + 1);
    return `${PREFIXE_RECURRENT} ${EN[reste] || reste}`;
  }
  // Libellé cité dans un message (notifications).
  return valeur.replace(/"([^"]+)"/g, (m, cite) => (EN[cite] ? `"${EN[cite]}"` : m));
}
const versionAnglaise = (donnees) => {
  const en = enAnglais(donnees);
  en.appPreferences = { ...en.appPreferences, language: 'en' };
  return en;
};

/** Écrit la version française et sa jumelle anglaise (<nom>-en.json). */
const ecrire = (nom, donnees) => {
  for (const [f, d] of [[nom, donnees], [nom.replace(/\.json$/, '-en.json'), versionAnglaise(donnees)]]) {
    const chemin = path.join(__dirname, f);
    fs.writeFileSync(chemin, `${JSON.stringify(d, null, 2)}\n`);
    console.log(chemin);
  }
};

ecrire(path.basename(SORTIE), sauvegarde);
console.log(`  ${portfolios.length} enveloppes, ${transactions.length} mouvements, ${movement_templates.length} mouvements types, ${calibrations.length} calibrations, ${regular_movements.length} mouvements réguliers`);

// ── Variantes pour des figures précises ────────────────────────────────────────

// Rattrapage (figure 3.4) : les occurrences des 75 derniers jours n'ont pas encore été
// appliquées — l'import déclenche le récapitulatif « mouvements appliqués ».
{
  const seuil = decaler(-75);
  const rms = regular_movements.map((rm) => {
    const restantes = transactions.filter(t => t.from_recurring_id === rm.id && t.date < seuil).map(t => t.date).sort();
    return { ...rm, last_applied_date: restantes.length ? restantes[restantes.length - 1] : undefined };
  });
  ecrire('fructificare-jeu-fictif-rattrapage.json', {
    ...sauvegarde,
    transactions: transactions.filter(t => !(t.from_recurring_id && t.date >= seuil)),
    regular_movements: rms,
  });
}

// Gabriel, personnage du parcours guidé (chapitre 2), quelques années après ses débuts :
// une assurance vie de sept ans, un capital au palier « Trésor » et l'objectif du million.
{
  const g = { portfolios: [], transactions: [], calibrations: [], regular_movements: [] };
  const sauve = { portfolios: [...portfolios], transactions: [...transactions], calibrations: [...calibrations], regular_movements: [...regular_movements] };
  portfolios.length = 0; transactions.length = 0; calibrations.length = 0; regular_movements.length = 0;
  const avg = enveloppe('Assurance vie', 'assurance_vie', '2019-06-17', { annual_fees_pct: 0.5, annual_return_rate: 5 });
  mouvement(avg, { type: 'deposit', date: '2019-06-17', amount: 1200, asset_type: 'fond_euro', note: 'Versement initial' });
  mouvement(avg, { type: 'deposit', date: '2019-06-17', amount: 800, asset_type: 'action', note: 'Versement initial' });
  regulier(avg, { amount: 400, debut: '2019-07-01', note: 'Épargne mensuelle', allocations: [{ type: 'fond_euro', pct: 60 }, { type: 'action', pct: 40 }] });
  calibrer(avg, [...finsDAnnee('2019'), ...moisPrecedents], 'type');
  Object.assign(g, { portfolios: [...portfolios], transactions: [...transactions], calibrations: [...calibrations], regular_movements: [...regular_movements] });
  Object.assign(portfolios, sauve.portfolios); Object.assign(transactions, sauve.transactions);
  const total = g.calibrations[g.calibrations.length - 1].total_value;
  ecrire('fructificare-gabriel.json', {
    ...sauvegarde,
    ...g,
    movement_templates: [], reminders: [reminders[0]], budget_entries: [], calendar_notes: [],
    gamification: {
      ...gamification,
      profile: { ...gamification.profile, username: 'Gabriel', birthDate: '1998-03-08', monthlyNetIncome: 3700 },
      notifications: { items: [] },
      objectives: [{
        id: 'obj-million', label: 'Premier million', targetAmount: 1000000, linkedEnvelopes: [g.portfolios[0].id],
        targetDate: '2048-03-08', icon: 'retirement', createdAt: creeLe, badgeAwarded: false,
      }],
    },
  });
  console.log(`  Gabriel : capital calibré ${Math.round(total)} €`);
}

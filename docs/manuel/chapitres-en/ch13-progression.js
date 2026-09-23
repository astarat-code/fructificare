// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
const {
  p, bullet, step, bonASavoir, attention, figure, gap,
  h1, h2, h3, t, b, i, ui, code, tableau,
} = require('../lib/kit');
const { TextRun } = require('docx');

const children = [];

// ═══════════════════════════════════════════════════════════════════════════
//  CHAPTER 13
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1('13. Progress & trophies'));


children.push(...figure('13.1', 'The Trophies page',
  "the complete page, full width"));

// ── 13.1 ───────────────────────────────────────────────────────────────────
children.push(h2('13.1  Your avatar'));

children.push(p([
  t("The avatar evolves with your "), b('total capital'),
  t(" — the calibrated value when there is one, otherwise your net deposits, across all envelopes, savings accounts included. "),
  t("The header shows the avatar, the name of the tier and its chapter, its motto, your capital and the amount of the next tier."),
]));

children.push(p([
  t("The avatar tells an "), b('epic in 19 tiers'),
  t(", from your first steps to the stars, in five chapters: "),
  i("the Awakening, the Journey, Knighthood, the Conquest and the Stars"),
  t(". From one tier to the next, your capital is multiplied by 1.5 to 2: each stage takes a comparable effort. The avatar's color changes with each chapter, and each tier has a motto that salutes the ground covered."),
]));

children.push(p([
  t("Beyond one million begins the "), b('Legend'),
  t(": the 19 avatars play out again in gold, with a thin ring, up to one billion. Gold is reserved for the Legend. The thresholds are detailed in the appendix (§ 16.5)."),
]));

// ── 13.2 ───────────────────────────────────────────────────────────────────
children.push(h2('13.2  Your three indicators'));

children.push(h3('The financial health score'));
children.push(p("A score out of 100, clickable, which opens the details of its calculation. It combines five components."));
children.push(tableau(
  ['Component', 'Points', 'What it measures'],
  [
    ['Diversification', '20', "How concentrated your wealth is on a single envelope or a single asset"],
    ['Performance', '25', "Your return, compared with a target adjusted for risk and your age"],
    ['Fee Control', '20', 'Weighted annual fees and the weight of fees already paid'],
    ['Resilience & Inflation', '25', "Your exposure to a crash, weighted by your age"],
    ['Liquidity', '10', 'The number of months of income covered by your regulated savings accounts'],
    ['Bonus', '5', 'Young and performing, or senior and resilient'],
  ],
  [2400, 900, 5726],
));
children.push(p([
  t("The score needs your "), b('date of birth'),
  t(" — several components depend on your investment horizon. You can enter it in the application Settings. "),
  t("A history and a recalculate button complete the window."),
]));

children.push(h3('FIRE progress'));
children.push(p([
  t("The percentage of the capital needed for your financial independence that you have already built up. "),
  t("Clickable: the window details the calculation and lets you adjust your monthly needs and your withdrawal rate — "),
  t("settings shared with the simulations."),
]));
children.push(gap(100));
children.push(bonASavoir([
  new TextRun({ text: "FIRE progress takes all your envelopes into account, regulated savings accounts included.", size: 21 }),
]));

children.push(h3('The Crossover Point'));
children.push(p("The share of your monthly income already covered by your investments. It needs your monthly net income, entered in the Settings."));

// ── 13.3 ───────────────────────────────────────────────────────────────────
children.push(h2('13.3  Your goals'));
children.push(p([
  t("You can create up to "), b('20 personal goals'), t(" yourself: a label, a target amount, the envelopes concerned "),
  t("(or your total wealth), a target date and an icon — house, car, retirement, travel, children, other."),
]));
children.push(p("Each card shows a progress bar and an estimate of the time remaining at the current pace of your deposits. Completion is detected automatically."));

// ── 13.4 ───────────────────────────────────────────────────────────────────
children.push(h2('13.4  The tutorial path'));
children.push(p([
  t("A folding banner, at the top of this page as well as the dashboard, which follows "), b('14 missions'),
  t(" to get started. Each tile opens a step-by-step "), ui('How to complete?'), t(" guide."),
]));

// ── 13.5 ───────────────────────────────────────────────────────────────────
children.push(h2('13.5  Trophies'));

children.push(p([
  t("Fructificare has "), b('120 trophies'), t(", spread over 16 categories: user, tutorial, regularity, "),
  t("wealth, gains, management, tax, health, FIRE, streaks, monthly challenges, total challenges, total calibrations, "),
  t("loyalty, seniority, and personal goals."),
]));

children.push(h3('Reading the page'));
children.push(bullet([b('The 5 latest trophies unlocked'), t(" open the section, all categories together, from the most recent to the oldest.")]));
children.push(bullet([b('An overall progress bar'), t(" shows where you stand overall.")]));
children.push(bullet([b('A view by category'), t(" lets you unfold what interests you.")]));

children.push(gap(120));
children.push(p([
  t("A click on "), b("any trophy"), t(" — unlocked or not — opens a card that explains what it rewards "),
  t("and how to get it. Trophies not yet unlocked are shown in grayed-out tones; the others keep the theme's colors."),
]));

children.push(h3('The monthly challenge'));
children.push(p([
  t("One mission per month, "), b('12 in total'), t(": Global Automation, Fee Master, Rebalancing and Defence, "),
  t("Tax Filer, Calendar Review, Crisis Ready, Fee Alert, Withholding Tax Adjustment, Tax Optimiser, "),
  t("Plan the Year-End, Reviewing Returns, Annual Review."),
]));
children.push(p("Each challenge can be completed again once a year; the matching trophy, however, stays yours for good."));

children.push(h3('Streaks'));
children.push(bullet([b('Login streaks'), t(" — consecutive days of use, with one grace day per streak. Tiers at 7, 30, 100 and 365 days. A flame appears next to the dashboard title.")]));
children.push(bullet([b('Calibration streaks'), t(" — consecutive months in which you calibrated. Tiers at 3, 6 and 12 months.")]));

children.push(gap(100));
children.push(bonASavoir([
  new TextRun({ text: "All of this can be turned off. ", bold: true, size: 21 }),
  new TextRun({ text: "The “Show progression” setting in the Settings hides the tutorial and the monthly challenge. The Trophies page stays accessible, and the health score keeps being calculated.", size: 21 }),
]));

module.exports = children;

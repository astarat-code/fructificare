// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
const {
  p, bullet, step, bonASavoir, attention, figure, gap,
  h1, h2, h3, t, b, i, ui, code, tableau,
} = require('../lib/kit');
const { TextRun } = require('docx');

const children = [];

// ═══════════════════════════════════════════════════════════════════════════
//  CHAPTER 10
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1('10. Simulations'));

children.push(p([
  t("Simulations in Fructificare let you project what might happen. "),
  t("It is a scratch space — "), b('nothing you do there touches your real envelopes'),
  t(". You can test a higher deposit, a crash or an early retirement there, with no risk at all to your data."),
]));

children.push(...figure('10.1', "The simulations home page",
  "the complete page, full width"));

children.push(h2("10.1  Two tools, two questions"));
children.push(p("The Simulation page offers two entry points, which answer different questions."));
children.push(bullet([
  ui("Envelope Simulator"),
  t(" — “Where will my wealth be in 10, 20 or 30 years?” It is the main tool, described throughout this chapter."),
]));
children.push(bullet([
  ui("Tax Simulator"),
  t(" — “How much will the State take if I withdraw now?” It is covered in chapter 11, with the rest of taxation."),
]));

// ── 10.2 ───────────────────────────────────────────────────────────────────
children.push(h2('10.2  The list of your simulations'));

children.push(...figure('10.2', 'The grid of saved simulations',
  "the complete page, full width"));

children.push(p("Each scenario you create becomes a tile:"));
children.push(bullet('a mini chart — value, deposits, and the projection in purple;'));
children.push(bullet([b('Total Portfolio'), t(" and "), b('Total Gains'), t(" at the horizon you chose last time;")]));
children.push(bullet("the saved horizon, shown in purple next to the label (“in 20 yrs”);"));
children.push(bullet('the date the scenario was created.'));


children.push(h3('Creating a simulation'));
children.push(p("Creating one takes two steps."));
children.push(step([b('Choose the type.'), t(" A "), ui('Classic simulation'), t(" is for projecting your envelopes freely; an "), ui('8-4-3 rule'), t(" simulation is a teaching exercise (§ 10.5).")], 1));
children.push(step([b('For a classic simulation:'), t(" give the scenario a name, then choose "), ui('Import my current envelopes'), t(" — your real envelopes are copied with their recurring deposits — or "), ui("Start from a blank simulation"), t(", to build a hypothetical portfolio.")], 1));

// ── 10.3 ───────────────────────────────────────────────────────────────────
children.push(h2("10.3  The details of a simulation"));

children.push(p("Opening a simulation gives access to a parallel dashboard, with its own settings."));

children.push(h3("The toolbar"));
children.push(tableau(
  ['Tool', 'What it does'],
  [
    ['Inflation', "When on, inflation is deducted from the return of each movement: projected amounts are then expressed in today's euros. The inflation rate can be changed by clicking the right-hand part of the button."],
    ['FIRE Settings', "Your monthly needs and your safe withdrawal rate. The required capital is recalculated live. These settings are shared with the rest of the application."],
    ['Stress Test', "Applies a crash on a chosen date: stocks, ETFs and bonds −20%, crypto −50%; euro funds, real estate, SCPI, gold and exotic assets are not affected."],
    ['Recurring movements', "Opens the panel of scheduled deposits, applied to the simulation only."],
    ['Delete Simulation', "Erases the scenario. Your real envelopes are not affected."],
  ],
  [2200, 6826],
));

children.push(h3('The achievement banners'));
children.push(bullet([b('Crossover Point reached'), t(" — your cumulative interest exceeds the sum of your deposits. The tipping point after which your capital works harder than you do.")]));
children.push(bullet([b('Financial Independence Achieved (FIRE)'), t(" — your passive income covers your declared monthly needs. The banner shows the surplus and the percentage reached.")]));

children.push(h3('The tiles and the fees'));
children.push(p("Total portfolio, total deposited, net interest (in euros and as a percentage), FIRE progress and FIRE target. A separate card shows the split of fees between entry fees and annual fees, and their cumulative impact at the horizon — a figure often higher than expected."));

children.push(h3('The projection controls'));
children.push(p([
  t("Two controls set the horizon: a "), b('target date'),
  t(" picker (month and year) and a "), b("year slider"),
  t(" that shows the projected value live while you move it."),
]));

children.push(gap(120));
children.push(attention([
  new TextRun({ text: "A projection is not a promise. It applies a constant return to regular deposits; markets, however, go up and down. It is mostly useful for comparing scenarios with one another, not for predicting an amount.", size: 21 }),
]));

// ── 10.4 ───────────────────────────────────────────────────────────────────
children.push(h2("10.4  The envelope page of a simulation"));
children.push(p([
  t("Clicking a simulation envelope opens "), b('the same page as in chapter 5'),
  t(", drawn from the scenario's data. No need to describe it again: only three things change."),
]));
children.push(bullet([b('Isolated space'), t(" — nothing you do here shows up on your dashboard.")]));
children.push(bullet([b('Extended charts'), t(" — the curves continue into the future, at the envelope's target return.")]));
children.push(bullet([b('Simplified calibration'), t(" — the calibration window does not ask for the breakdown by position.")]));

// ── 10.5 ───────────────────────────────────────────────────────────────────
children.push(h2('10.5  The 8-4-3 rule'));

children.push(...figure('10.3', 'The “8-4-3 rule” simulation',
  "the complete page, full width"));

children.push(p([
  t("The 8-4-3 rule is a teaching exercise to visualize the power of compound interest. It illustrates a simple idea: "),
  i("interest takes a long time to get going, then accelerates exponentially."),
]));

children.push(p([b('The formula:'), t(" in 8 years you build your base capital; in 4 more years your interest grows fast; and during the last 3 years, interest takes off.")]));

children.push(h3('Configuring'));
children.push(p("The configuration panel asks for a simulation name, the envelopes to include, a start date (Year 0), a starting capital, a monthly deposit and an annual return."));
children.push(gap(100));
children.push(bonASavoir([
  new TextRun({ text: "The starting capital fills itself in: Fructificare puts there the total you had paid into the selected envelopes on the date chosen for Year 0. Change Year 0 and the amount follows. You remain free to correct it by hand.", size: 21 }),
]));

children.push(h3('Reading the result'));
children.push(bullet([b('Three phase cards'), t(" — “the desert crossing” (8 years), “the take-off” (+4 years), “the snowball effect” (+3 years).")]));
children.push(bullet([b('Stacked bar chart'), t(" over 15 years, separating deposits and interest, with a “Today” marker.")]));
children.push(bullet([b('Summary tiles'), t(" — total paid in, total interest, final capital.")]));
children.push(bullet([b('Progress calendar'), t(" — 180 squares, one per month, showing the gain of each month elapsed.")]));
children.push(bullet([b('Year-by-year table'), t(" — past years in regular type, future years in italics.")]));

module.exports = children;

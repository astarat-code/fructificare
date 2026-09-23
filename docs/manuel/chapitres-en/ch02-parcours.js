// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
const {
  p, bullet, step, bonASavoir, attention, noteRedac, figure, gap,
  h1, h2, h3, t, b, i, ui, code, tableau,
  GREEN, SLATE, GREY, AMBER, CONTENT_W,
} = require('../lib/kit');
const { Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell,
        WidthType, ShadingType, TableOfContents } = require('docx');

const children = [];

// ═══════════════════════════════════════════════════════════════════════════
//  CHAPTER 2
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1('2. Guided tour — aiming for your first million'));

children.push(p([
  i("This chapter follows Gabriel, 28, who earns €3,700 net a month, has just opened a life insurance contract and wants to know how fast he can reach one million. Each step refers to the relevant chapter."),
]));

children.push(h2('2.1  The starting point'));
children.push(p("Gabriel has a spreadsheet. Three tabs, columns that no longer add up since he opened a second contract, and no idea of what his fees really cost him over twenty years."));
children.push(p([
  t("What he is looking for comes down to three questions: "),
  b("Where do I stand? Where am I heading? What is holding back my profits?"),
]));
children.push(gap(100));
children.push(...figure('2.1', 'The dashboard on first launch',
  "the empty dashboard, with the “No envelopes” message and the “Create Envelope” button clearly visible."));

children.push(h2("2.2  Opening the envelope"));
children.push(p([
  t("Gabriel creates his first envelope: "), ui('Create Envelope'),
  t(", type "), b('Life Insurance'), t(", "), b("contract start date"), t(" (§ 4.3)."),
]));
children.push(p([
  t("This date starts the countdown to the "),
  b('eight years'),
  t(" after which life insurance becomes tax-efficient. Fructificare will use it to show a green edge on the envelope's row when the day comes, and to apply the right tax regime in the tax report."),
]));
children.push(p([
  t("He also enters the contract's "), b('annual fees'),
  t(", which can usually be found in the contract's general terms. Movement fees can also be applied to each movement you create (§ 5.4)."),
]));
children.push(gap(100));
children.push(...figure('2.2', "Creating a Life Insurance envelope",
  "the creation window, type “Life Insurance” selected, start date and annual fees filled in."));

children.push(h2('2.3  The first movements'));
children.push(p([
  t("He makes an initial deposit of €2,000 when the contract opens. Gabriel uses "), b("multiple asset types"),
  t(" to split it 60% into euro funds and 40% into unit-linked funds, in a single entry (§ 5.4)."),
]));
children.push(p([
  t("He uses the "), ui('Note'),
  t(" field to identify his movement. It is more than a simple comment: Fructificare groups all the movements that share the same note and calculates their total invested, number of units and weighted average purchase price (§ 5.9). Be careful: the note must be written exactly the same way from one movement to the next for the program to group them, and it is case-sensitive (“Weekly savings” and “weekly savings” will form two groups)."),
]));
children.push(p([
  t("As he plans to repeat this deposit, he turns it into a "), b('movement template'),
  t(" (chapter 7) — the fees and the breakdown are remembered — and then a monthly "),
  b('recurring movement'), t(" of €400 (chapter 8). From then on, data entry takes care of itself."),
]));
children.push(gap(100));
children.push(...figure('2.3', 'The entry form and the recurring panel',
  "two captures side by side: on the left the add-movement form filled in with a multi-asset breakdown, on the right the “New recurring” tab of the recurring movements panel.", ["The add form, split over two asset types", "The “New recurring” tab"]));

children.push(h2('2.4  Making the figures real — the first calibration'));
children.push(p([
  t("Three months later, the first statement for the life insurance contract arrives: €3,340. Gabriel opens "),
  ui('Calibrate my envelopes'), t(" and enters this value (chapter 6)."),
]));
children.push(p("Until then, the application only showed the sum of the deposits. It can now show the real value and derive the performance, the gain and the annualized return from it."));
children.push(gap(120));
children.push(bonASavoir([
  new TextRun({ text: 'Take the time to use “Detail by position” from the very first calibration. ', size: 21, bold: true }),
  new TextRun({ text: "This breakdown unlocks the “Returns by asset” section of the envelope page (§ 5.8) and conditions the tax estimate (§ 11.2). Without it, you will only get an overall figure.", size: 21 }),
]));
children.push(gap(100));
children.push(...figure('2.4', 'Before and after the first calibration',
  "two captures of the same dashboard, side by side: on the left before calibration (value = deposits, no gain), on the right after (real value, gain in green, curve taking off).", ["Before calibration", "After calibration"]));

children.push(h2("2.5  What it really costs — keeping fees in check"));
children.push(p([
  t("The "), ui('Total Fees'),
  t(" tile on the dashboard shows an amount and, above all, its breakdown by envelope (§ 4.4). Gabriel discovers that his annual fees already weigh more than his deposit fees."),
]));
children.push(p([
  t("To measure what this means in the long run, he does the decisive exercise: "),
  b("two identical simulations with different fee levels"),
  t(" (§ 10.3). After twenty years, the gap is counted in tens of thousands of euros."),
]));
children.push(gap(100));
children.push(...figure('2.5', "The impact of fees over twenty years",
  "two captures: the fee breakdown by envelope, then two simulation curves side by side with different expense ratios, the final gap clearly readable.", ["The fee breakdown by envelope", "Two twenty-year simulations, with 0.5% and 2% fees"]));

children.push(h2('2.6  What it yields — the projection'));
children.push(p([
  t("Gabriel creates a simulation from his real envelopes (§ 10.2), moves the year slider up to his 50th birthday, then turns on the "),
  b('inflation option'), t(" to see the real purchasing power of his million euros in 2048."),
]));
children.push(p("Two milestones appear along the way: 1- The Crossover Point, the moment when cumulative interest exceeds deposits; it is often a key moment in investing, after which interest becomes exponential because your compound interest becomes the main driver of your savings, overtaking your personal effort. 2- FIRE progress — Financial Independence, Retire Early — represents the final capital needed to live off your passive income."));
children.push(p([
  t("Finally, the "), b('stress test'),
  t(" lets you simulate a crash halfway through and see the resulting trajectory. It depends on the asset types in your savings and helps you anticipate a future crisis."),
]));
children.push(gap(100));
children.push(...figure('2.6', 'The projection and its crisis scenario',
  "two captures: the twenty-year simulation with the FIRE banner, then the same simulation after the stress test is applied.", ["The twenty-year simulation", "Its projection curve", "After the stress test", "The curve after the crash"]));

children.push(h2("2.7  What the State will take — anticipating tax"));
children.push(p([
  t("Gabriel simulates a withdrawal after six years, then the same one after nine years, in the "),
  ui("Tax Simulator"), t(" (§ 11.1). The difference in the final bill fits in one line: the €4,600 allowance and the reduced 7.5% rate only apply after eight years."),
]));
children.push(p("Practical conclusion: it is much more worthwhile to wait for the eight-year mark, which saves several hundred euros of tax on a withdrawal of this size."));
children.push(p([
  t("In January, he generates his "), b('tax report'),
  t(" for the previous year (§ 11.2) and files it with his supporting documents."),
]));
children.push(gap(100));
children.push(...figure('2.7', 'Before and after the eight-year mark',
  "two results of the life insurance tax simulator side by side, one after 6 years of holding, the other after 9 years, with the tax totals clearly readable.", ["Withdrawal after 6 years", "Withdrawal after 9 years"]));

children.push(h2('2.8  Going the distance'));
children.push(p("A twenty-year plan does not hold through willpower. It holds through rhythm."));
children.push(bullet([t("The “first million” goal is set in "), ui('My goals'), t(", with its target date and progress bar (§ 13.3).")]));
children.push(bullet([t("A calibration reminder comes back to the calendar every month (§ 9.2), so that the figures stay up to date.")]));
children.push(bullet([t("The monthly challenge suggests a different concrete action every month (§ 13.5).")]));
children.push(bullet([t("The avatar goes up its tiers as the capital grows: from the first steps to the backpack, then the shield, the fortress and the treasure (§ 13.1).")]));
children.push(p([
  t("Finally, the "), b('8-4-3 rule'),
  t(" (§ 10.5) helps him leave his savings alone: compound interest rewards the last years above all, and each early withdrawal cuts the snowball effect at the very moment it starts to gather speed."),
]));
children.push(gap(100));
children.push(...figure('2.8', 'Milestones along the way',
  "the Trophies page: header with the “Treasure” avatar and the total capital, and below it a goal card at about 40% progress."));

children.push(h2('2.9  The virtuous circle'));
children.push(p("All of Fructificare fits in a cycle of a few minutes, to be repeated every month for best results."));
children.push(gap(100));
children.push(...figure('2.9', 'The Fructificare cycle',
  "diagram: five steps in a circle — Record → Calibrate → Measure → Optimize → Forecast — each with its caption and the matching chapter references."));

children.push(p([
  b('Record'), t(" your movements, "), b('calibrate'), t(" to anchor the figures in reality, "),
  b('measure'), t(" performance and fees, "), b('optimize'), t(" profits and fees, "),
  b('forecast'), t(" to check that the trajectory holds. Then start again."),
]));


module.exports = children;

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
const {
  p, bullet, step, bonASavoir, attention, noteRedac, figure, gap,
  h1, h2, h3, t, b, i, ui, code, tableau,
  GREEN, SLATE, GREY, AMBER, CONTENT_W,
} = require('../lib/kit');
const { Paragraph, TextRun, AlignmentType } = require('docx');

const children = [];

children.push(h1('4. The dashboard'));

children.push(p("This is the home page of Fructificare. It shows you where your current wealth stands."));
children.push(gap(100));
children.push(...figure('4.1', 'The dashboard',
  "the complete page, full width"));

// ── 4.1 ────────────────────────────────────────────────────────────────────
children.push(h2('4.1  The progress banners'));
children.push(p("At the top of the page, two collapsible banners accompany your first steps."));
children.push(bullet([b('Tutorial'), t(" — the current mission and your progress through the fourteen quests (§ 1.7). It disappears for good once the path is complete.")]));
children.push(bullet([b('Challenge of the month'), t(" — the monthly mission and the number of days left to complete it (§ 13.5).")]));
children.push(p("A click on the banner folds or unfolds the section."));
children.push(gap(120));
children.push(bonASavoir([
  new TextRun({ text: 'Do these two banners get in your way? Turn off ', size: 21 }),
  new TextRun({ text: 'Show progression', size: 21, bold: true, color: GREEN }),
  new TextRun({ text: ' in the Settings (§ 14.2).', size: 21 }),
]));

// ── 4.2 ────────────────────────────────────────────────────────────────────
children.push(h2("4.2  The action bar"));
children.push(p('Three buttons, at the top right of the title.'));

children.push(h3('Calibrate my envelopes'));
children.push(p([
  t("Opens the window for entering real values (chapter 6). The button turns "),
  b('amber and blinks'),
  t(" when a calibration is overdue, that is when one of your envelopes has never been calibrated or its last calibration is more than thirty days old."),
]));

children.push(h3('Recurring movements'));
children.push(p([
  t("Opens the panel of scheduled deposits and withdrawals (chapter 8). The number shown to the right of the label is the number of "),
  b('active'), t(' series.'),
]));

children.push(h3('Create Envelope'));
children.push(p('Described in § 4.3 below.'));

children.push(p([
  t("On the left, next to the page title, a "), b('flame'),
  t(" shows your login streak: the number of consecutive days on which you opened the application (§ 13.5)."),
]));

// ── 4.3 ────────────────────────────────────────────────────────────────────
children.push(h2('4.3  Creating an envelope'));
children.push(p("An envelope represents a real account: your PEA with a given broker, your life insurance contract, your Livret A. Create as many as you hold."));

children.push(step([t('Click '), ui('Create Envelope'), t('.')], 10));
children.push(step([t('Give it a recognizable '), b('name'), t(" — the name of the institution works very well.")], 10));
children.push(step([t('Choose a '), b('color'), t(". Fructificare suggests a shade that is not used yet. This color will follow the envelope everywhere: table rows, curves, pie charts, calendar.")], 10));
children.push(step([t('Select the '), b('type'), t(". It determines the taxation applied and the holding-period milestones.")], 10));
children.push(step([t("Enter the "), b("contract start date"), t(".")], 10));
children.push(step([t('Adjust the '), b('annual fees'), t(' and the '), b('target return'), t(' if you know them.')], 10));
children.push(step([t('Confirm with '), ui('Create'), t('.')], 10));

children.push(gap(100));
children.push(...figure('4.2', "The envelope creation window",
  "the complete modal, type “Life Insurance” selected, all fields filled in, with the color picker clearly visible."));

children.push(h3("The six envelope types"));
children.push(tableau(
  ['Type', 'What for', 'Taxation'],
  [
    ['PEA',                 "European stocks and ETFs",              "Income tax exempt after 5 years"],
    ['CTO',                 'Ordinary securities account, crypto',   'Flat tax 31.4%'],
    ['Life Insurance',      'Multi-fund contract',                   'Allowance after 8 years'],
    ['PER',                 'Retirement savings',                    'Flat tax 31.4%'],
    ['Regulated Account',   'Livret A, LDDS, LEP',                   'Exempt'],
    ['Custom',              'Everything else',                       'No automatic calculation'],
  ],
  [2100, 3400, 3526],
));

children.push(gap(160));
children.push(p([
  t("If you choose "), b('Regulated Account'),
  t(", a second menu appears to specify the savings account (Livret A, LDDS, LEP or other). These envelopes are excluded by default from the tax report and from performance calculations, but you can change this setting."),
]));

children.push(h3("The contract start date"));
children.push(p("This field serves three purposes:"));
children.push(bullet("applying the right tax regime according to the holding period (PEA under or over 5 years, life insurance under or over 8 years);"));
children.push(bullet("showing the tax-maturity indicator on the envelope list (§ 4.7);"));
children.push(bullet("automatically creating an anniversary event in your calendar (§ 9.2)."));
children.push(p("It also limits entry dates: you cannot record a movement dated before the contract opened."));

children.push(h3('Annual fees and target return'));
children.push(p([
  t("The "), b('annual fees'),
  t(" can be entered either as a percentage of the outstanding amount or as a fixed amount in euros per year — switch with the "),
  ui('%'), t(' and '), ui('€'), t(" buttons. This is your contract's expense ratio (TER), stated in the general terms."),
]));
children.push(p([
  t("The "), b('annual target return'),
  t(" is used as a reference for projections and for the dotted curve on the envelope page (§ 5.6). If left empty, it is filled in by default according to the type:"),
]));
children.push(bullet('PEA and CTO: 8%;'));
children.push(bullet('life insurance and PER: 4%;'));
children.push(bullet('regulated account: 2.4%;'));
children.push(bullet('custom: 0%.'));

children.push(gap(120));
children.push(attention("Enter the fees as soon as you create the envelope, even approximately. It is the only way to get a fair comparison between your contracts later on — and the gap over twenty years is rarely trivial (§ 2.5)."));

children.push(h3('Include in my tax report'));
children.push(p("Ticked by default, except for regulated accounts. Untick it for an envelope you follow for information only and that has no place in your tax return."));

// ── 4.4 ────────────────────────────────────────────────────────────────────
children.push(h2('4.4  The summary tiles'));
children.push(p("Four figures sum up your situation. They sit at the top of the page, just below the action bar."));
children.push(gap(100));
children.push(...figure('4.3', 'The summary tiles',
  "the row of tiles at full width: Total Value, Movements, Total Fees and Cash, on a calibrated portfolio showing a positive gain."));

children.push(h3('Total Value'));
children.push(p("The current value of your portfolio, based on your latest calibrations. Below the amount:"));
children.push(bullet("the total gain or loss, in euros and as a percentage;"));
children.push(bullet([t("the "), b('annualized return since inception'), t(", calculated using the modified Dietz method (§ 16.3);")]));
children.push(bullet("the total of regulated savings accounts, on a separate line."));
children.push(gap(120));
children.push(bonASavoir("Regulated savings accounts are excluded by default from the total value and from the performance calculation. Their rate is set by the State, and including them would distort the reading of your risky investments. They therefore appear separately, below, but you can change this setting."));

children.push(h3('Movements'));
children.push(p("The total you have paid in, the total you have withdrawn, and the net balance of the two. Regulated savings accounts are also excluded from it, and shown on a dedicated line."));

children.push(h3('Total Fees'));
children.push(p([
  t("The sum of all your fees since inception: deposit fees, withdrawal fees and accumulated annual management fees. Click the tile to open the "),
  b('breakdown by envelope'), t('.'),
]));
children.push(gap(100));
children.push(...figure('4.4', 'The fee breakdown by envelope',
  "the “Fee breakdown by envelope” window open, showing three or four tinted envelopes with the annual fees / movement fees / total breakdown."));

children.push(h3('Cash'));
children.push(p("The total of the cash sitting idle in your envelopes: money available in the account, coming from a sale whose proceeds you chose to keep there, but not yet reinvested (§ 5.5)."));
children.push(p([
  t("Like the fees tile, it is clickable — a small arrow shows it. It opens the "),
  b('cash breakdown by envelope'),
  t(": each envelope holding cash, with its amount, from the largest to the smallest, and the grand total."),
]));

// ── 4.5 ────────────────────────────────────────────────────────────────────
children.push(h2('4.5  Envelope evolution'));
children.push(p("The first chart traces the value of your portfolio over time. It only appears once there are two calibration points."));
children.push(p('Two views are available, through the toggle button at the top right.'));

children.push(bullet([b('Summary view'), t(" — the total calibrated value, the net deposits, and between the two a coloured band showing the gain (green) or the loss (red).")]));
children.push(bullet([b('Detailed view'), t(" — one curve per envelope, in its own color.")]));

children.push(p("The points marked on the curves correspond to the months in which you actually calibrated. Between two points, the value is interpolated."));
children.push(gap(100));
children.push(...figure('4.5', "The two views of the evolution chart",
  "two captures of the same chart: on the left the summary view with its coloured gain band, on the right the detailed view with one curve per envelope.", ["Summary view", "Detailed view"]));

// ── 4.6 ────────────────────────────────────────────────────────────────────
children.push(h2('4.6  The allocation'));
children.push(p("The pie chart answers the diversification question: where is my money concentrated?"));

children.push(h3('By envelope or by asset type'));
children.push(p("The default view shows the share of each account, the second one the share of each asset class — euro funds, bonds, stocks, ETFs, crypto, real estate, SCPI, gold, exotic. The second one is what matters when judging a concentration risk."));

children.push(h3('Deposits or real value'));
children.push(p([
  t("By default, the pie chart splits your "), b('deposits'),
  t(". Switch to "), b('real value'),
  t(" to reason on calibrated amounts: it is more accurate, since your holdings have not all grown at the same pace."),
]));
children.push(p("This toggle stays inactive as long as no calibration exists."));
children.push(gap(100));
children.push(...figure('4.6', 'The pie chart and its two toggles',
  "the pie chart in “by asset type” and “real value” view, with both switches clearly readable at the top right of the card.", ["By envelope, deposits", "By envelope, real value", "By asset, deposits", "By asset, real value"]));

// ── 4.7 ────────────────────────────────────────────────────────────────────
children.push(h2('4.7  The envelope list'));
children.push(p("The summary table, to the right of the pie chart. Each row takes the color of its envelope; a click on the row opens the detailed page (chapter 5)."));

children.push(tableau(
  ['Column', 'What it contains'],
  [
    ['Envelope Name', "The name of the envelope, and for a savings account its sub-type"],
    ['Type',          "PEA, CTO, life insurance…"],
    ['Balance',       "The latest calibrated value, with the gain as a percentage"],
    ['Deposits',      "The total paid in since inception"],
  ],
  [2400, 6626],
));

children.push(gap(160));
children.push(p([
  t("As long as an envelope has not been calibrated, the "), b('Balance'),
  t(" column simply shows the sum of your deposits and the gain stays empty — Fructificare does not know its real value yet."),
]));

children.push(h3("The tax-maturity indicator"));
children.push(p([
  t("A "), b('green edge'), t(" on the left of the row and a "), b('shield badge'),
  t(" next to the name mark an envelope old enough to benefit from its favorable taxation: more than five years for a PEA, more than eight years for a life insurance contract."),
]));
children.push(p("Hover over the badge to read the exact advantage. A legend recalls the rule below the table as soon as at least one envelope qualifies."));
children.push(gap(100));
children.push(...figure('4.7', 'The envelope list with a maturity indicator',
  "the envelope table with at least one row showing the green edge and the shield badge, and the legend visible below."));

// ── 4.8 ────────────────────────────────────────────────────────────────────
children.push(h2('4.8  Cumulative savings'));
children.push(p("A stacked bar chart, month by month: how much you had invested, and in what, at each stage. It reads as the build-up of your savings effort."));
children.push(p("The same envelopes / assets toggle as the pie chart applies. Over a long history, the area scrolls horizontally."));
children.push(gap(100));
children.push(...figure('4.8', "The cumulative savings chart",
  "the stacked bar chart over at least twelve months, in “by asset type” view, with the legend at the top."));

// ── 4.9 ────────────────────────────────────────────────────────────────────
children.push(h2('4.9  The annual return'));
children.push(p("The last chart gives your performance calendar year by calendar year, excluding regulated savings accounts. The current year is marked as year-to-date: it cannot be compared with complete years."));
children.push(p("Hover over the title to read the methodology note on the modified Dietz calculation."));
children.push(gap(100));
children.push(...figure('4.9', "The annual return chart",
  "the chart over three or four years, with at least one negative year to show the color code, and the current year marked as year-to-date."));

children.push(gap(140));
children.push(attention([
  new TextRun({ text: "The return shown may differ from your bank's. Fructificare weights each deposit by its date within the period; institutions sometimes use other conventions.", size: 21 }),
]));

module.exports = children;

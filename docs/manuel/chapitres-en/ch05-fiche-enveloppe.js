// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
const {
  p, bullet, step, bonASavoir, attention, noteRedac, figure, gap,
  h1, h2, h3, t, b, i, ui, code, tableau,
  GREEN, SLATE, GREY, AMBER, CONTENT_W,
} = require('../lib/kit');
const { Paragraph, TextRun, AlignmentType } = require('docx');

const children = [];

children.push(h1('5. The envelope page'));

children.push(p("A click on a row of the dashboard opens an envelope's page. This is where most of the work happens: entering movements, reading performance, understanding where the fees come from."));
children.push(gap(100));
children.push(...figure('5.1', "An envelope's page",
  "the complete page, full width"));

// ── 5.1 ────────────────────────────────────────────────────────────────────
children.push(h2("5.1  The header"));
children.push(p("A banner in the envelope's color, with its name and type."));
children.push(p([
  t('Two icons to the right of the name: the '), b('pencil'), t(" to edit the envelope, the "),
  b('bin'), t(' to delete it (§ 5.11).'),
]));
children.push(p("Below the name, a reminder line shows the target return and the annual fees."));
children.push(p([
  t("For a "), b('PEA'),
  t(", this line also tracks the €150,000 deposit cap: the total already paid in, the cap, and the share used — for example “Deposits: €75,000.00 / €150,000, i.e. 50% of the cap”. "),
  t("Only money brought in from outside counts, fees included: a purchase paid with the envelope's cash uses up none of the cap, and a withdrawal frees none. "),
  t("A deposit that would exceed the cap is refused, with the amount still available."),
]));

// ── 5.2 ────────────────────────────────────────────────────────────────────
children.push(h2('5.2  The four tiles'));
children.push(tableau(
  ['Tile', 'What it shows'],
  [
    ['Returns',      "Current value, total cost and gain, in euros and as a percentage"],
    ['Deposits',     "The net capital in place, with the total bought and the total sold below it"],
    ['Total Fees',   'Sum of movement fees and annual fees'],
    ['Cash',         "Cash available in the envelope"],
  ],
  [2400, 6626],
));

children.push(gap(160));
children.push(p([
  t("The first tile only shows the "), b('Returns'),
  t(" once a calibration exists. Without one, it only shows the simple balance of the deposits."),
]));

// ── 5.3 ────────────────────────────────────────────────────────────────────
children.push(h2("5.3  The envelope's documents"));
children.push(p([
  t("Below the tiles, a "), ui('Documents'),
  t(" box shows the number of PDF files attached to the envelope — account statements, trade confirmations, IFU tax forms. A click opens the list of these documents: you can "),
  b('add'), t(" one, "), b('open'), t(" it, "), b('edit'), t(" its record or "), b('delete'),
  t(" it, without leaving the envelope page."),
]));
children.push(p([
  t("A document added here is automatically linked to the envelope. It also appears on the "), ui('Documents'),
  t(" page, which gathers all your documents and where the import is described in detail (chapter 12)."),
]));

// ── 5.4 ────────────────────────────────────────────────────────────────────
children.push(h2('5.4  Adding a movement'));
children.push(p("The form takes up the top of the page. It is used for deposits and withdrawals alike: the final button decides."));

children.push(step([t('Choose the '), b('date'), t(". It cannot be earlier than the contract start date, nor later than today.")], 20));
children.push(step([t('Enter the gross '), b('amount'), t('.')], 20));
children.push(step([t('Enter the '), b('transaction fees'), t(" charged by your broker, as a percentage or in euros.")], 20));
children.push(step([t('Add the '), b('annual fees'), t(" specific to this line, if it has any.")], 20));
children.push(step([t("Select the "), b("asset type"), t('.')], 20));
children.push(step([t('Optionally fill in the '), b('note'), t(", the "), b('quantity'), t(' and the '), b('unit price'), t('.')], 20));
children.push(step([t('Click '), ui('Deposit'), t(' for a deposit or '), ui('Withdrawal'), t(' for a withdrawal.')], 20));

children.push(gap(100));
children.push(...figure('5.2', "The add-movement form",
  "the complete, filled-in form, with the fee preview visible below and the two Deposit / Withdrawal buttons."));

children.push(h3("Asset types"));
children.push(p("Ten categories are offered: euro fund, bond, stock, ETF, crypto, real estate, SCPI, gold, exotic, and “other”. The same list appears in every form: movement, movement template, recurring movement and multi-asset breakdown."));
children.push(p([
  t('Choosing '), b('other'),
  t(" shows a free-text field. The name you type there becomes a "),
  b("reusable custom asset type"),
  t(": it will appear in the list the next time you enter a movement."),
]));

children.push(h3('One movement, several assets'));
children.push(p([
  t("A deposit into a life insurance contract is rarely split over a single fund. Tick "),
  ui("Multiple asset types"), t(', then '), ui('Configure'),
  t(" to break the amount down in percentages. The total must be exactly 100%; the application reminds you of it in real time."),
]));
children.push(gap(100));
children.push(...figure('5.3', 'The multi-asset breakdown',
  "the breakdown window, three types ticked with their percentages, and the total “100% ✓” shown in green."));

children.push(h3('Quantity and unit price'));
children.push(p([
  t("Two optional fields, useful for listed securities. Fill in two of them and the third is calculated: entering 10 units at €145.30 automatically fills in the amount at €1,453."),
]));
children.push(p("These values feed the weighted average purchase price in the “Totals by note” table (§ 5.9) and the calculation of returns by asset (§ 5.8)."));

children.push(h3('The note'));
children.push(p([
  t("Fructificare "), b('groups'),
  t(" all the movements that share the same note and calculates their totals (§ 5.9). Use it to follow a specific holding over time — the name of an ETF, an SCPI, a stock."),
]));
children.push(gap(120));
children.push(bonASavoir("Be strict with the spelling of your notes: “ETF World” and “ETF world” will form two separate groups."));

children.push(h3('The previews'));
children.push(p("Two boxes appear as you type:"));
children.push(bullet("the fee preview, which shows the amount charged and the net amount actually invested;"));
children.push(bullet("the cash pocket preview, which shows what part of the purchase will be paid from your existing cash and what part from new money."));

children.push(h3('The two neighboring panels'));
children.push(p("At the top of the card, two buttons open independent tools:"));
children.push(bullet([ui('Movement templates'), t(" — your reusable entry templates (chapter 7);")]));
children.push(bullet([ui('Recurring movements'), t(" — your scheduled deposits and withdrawals (chapter 8).")]));
children.push(gap(120));
children.push(bonASavoir([
  new TextRun({ text: 'These two concepts are independent. ', size: 21, bold: true }),
  new TextRun({ text: "A movement template saves you time when entering data by hand; a recurring movement acts on its own on each due date. You can use one, the other, or both together.", size: 21 }),
]));

// ── 5.5 ────────────────────────────────────────────────────────────────────
children.push(h2('5.5  The withdrawal question'));
children.push(p("When you click Withdrawal, Fructificare asks a question before saving: where does the money go?"));
children.push(gap(100));
children.push(...figure('5.4', 'The withdrawal confirmation window',
  "the window with its two options — “Keep as Cash” in blue and “Withdraw” in red — and their descriptions."));

children.push(bullet([
  b('Keep as Cash'),
  t(" — the money stays in the envelope, available for a future purchase. It goes into the cash pocket and will be used automatically for your next deposit. This is the case of a switch: you sell one holding to buy another."),
]));
children.push(bullet([
  b('Withdraw'),
  t(" — the money leaves the envelope for good. It is a withdrawal (rachat), and this is often the case that triggers tax (chapter 11)."),
]));

children.push(gap(120));
children.push(attention("The choice has tax consequences. On a PEA, a PER or a life insurance contract, only money that leaves the envelope is taxable: a switch kept as cash is not. On a securities account, and for any sale of crypto for euros, the sale is taxable even if the money stays as cash (§ 11.2)."));

// ── 5.6 ────────────────────────────────────────────────────────────────────
children.push(h2("5.6  The evolution curve"));
children.push(p("The central chart of the page. It overlays what you have paid in and what the envelope is really worth."));

children.push(p([
  t('A badge shows the '), b("real return since inception"),
  t(", calculated using the modified Dietz method: each deposit is weighted by its date, so that a recent deposit does not distort the annualized performance."),
]));

children.push(h3('The target return curve'));
children.push(p([
  t("Turn it on to overlay a dotted curve: the path your envelope would have followed if each deposit had actually earned the target return set when it was created. The gap between the two curves is how far you are from your goal."),
]));

children.push(h3('The data table'));
children.push(p([
  t('The toggle button at the top right replaces the chart with a table. It lists each calibration with its cumulative gain and its return for the period. Values '),
  i('in italics'), t(" are interpolated: they correspond to months you did not calibrate."),
]));
children.push(gap(100));
children.push(...figure('5.5', "The evolution curve and its table",
  "two captures: the chart with the target return curve turned on and a tooltip open, then the data table showing interpolated rows in italics.", ["The curve with the target return and a tooltip", "The data table"]));

// ── 5.7 ────────────────────────────────────────────────────────────────────
children.push(h2('5.7  The annual return'));
children.push(p("A year-by-year bar chart for this envelope only. Next to the title, a Calibrate button opens the calibration window directly, focused on the current envelope — the others appear grayed out."));

// ── 5.8 ────────────────────────────────────────────────────────────────────
children.push(h2('5.8  Returns by asset'));

children.push(gap(60));
children.push(attention([
  new TextRun({ text: 'This section stays hidden until you have made a detailed calibration. ', size: 21, bold: true }),
  new TextRun({ text: "It needs the breakdown by position offered by the “Detail by position” option (§ 6.3). With total-value calibrations only, Fructificare cannot split the performance between your assets: the figures then feed the “Returns” tile at the top of the page, and nothing is shown here.", size: 21 }),
]));
children.push(gap(140));

children.push(p("One tile per asset, taken from your latest detailed calibration:"));
children.push(bullet('the current value of the holding;'));
children.push(bullet("its total cost, that is what you have invested in it;"));
children.push(bullet('its gain in euros and as a percentage.'));

children.push(p('Two warnings may appear:'));
children.push(bullet([b('Mixed calculation'), t(" — some movements of this asset have a quantity filled in, others do not. The cost basis then mixes two methods and becomes less accurate.")]));
children.push(bullet([b('Asset with no movement'), t(" — you calibrated a holding to which no movement is attached. Fructificare shows its value but refuses to invent a performance.")]));
children.push(gap(100));
children.push(...figure('5.6', 'Returns by asset',
  "the grid of tiles, with at least three different assets, one of which shows the “Mixed calculation” warning in amber."));

// ── 5.9 ────────────────────────────────────────────────────────────────────
children.push(h2('5.9  Totals by note'));
children.push(p("This table groups all the movements that share the same note and summarizes them. It is the tool for following a specific holding."));

children.push(tableau(
  ['Column', 'What it gives'],
  [
    ['Total units',  "The sum of the quantities bought"],
    ['Avg price',    "The weighted average purchase price"],
    ['Net total',    "Deposits minus withdrawals"],
    ['Total fees',   'The fees accumulated on this holding'],
  ],
  [2400, 6626],
));

children.push(gap(160));
children.push(p([
  t("The "), b("weighted average purchase price"),
  t(" only takes into account the movements that have both a quantity and a unit price. If some have neither, the total units are shown in red with a warning: the figure is partial."),
]));
children.push(gap(100));
children.push(...figure('5.7', 'Totals by note',
  "the table with two or three different notes, one of which shows the partial total warning in red."));

// ── 5.10 ────────────────────────────────────────────────────────────────────
children.push(h2('5.10  The movement table'));
children.push(p("The complete history, at the bottom of the page. Each column can be sorted with a click on its header: date, type, asset type, gross amount, fees, annual fees, net amount, note."));

children.push(p('Two markers may accompany a row:'));
children.push(bullet([b('Cash'), t(" — a withdrawal kept in the cash pocket.")]));
children.push(bullet([b('🔄'), t(" — a movement generated automatically by a recurring series (chapter 8). Its note appears in italics.")]));

children.push(p("The quantity and unit price, when filled in, are shown in small type below the amount."));
children.push(p([
  t('Each row can be edited or deleted with the icons on the right. Beyond 100 movements, the table is split into several pages.'),
]));
children.push(gap(100));
children.push(...figure('5.8', 'The movement table',
  "about fifteen rows mixing deposits and withdrawals, with at least one “Cash” badge and one movement from a recurring series, plus the edit / delete icons visible."));

// ── 5.11 ───────────────────────────────────────────────────────────────────
children.push(h2("5.11  Editing or deleting the envelope"));

children.push(h3('Edit'));
children.push(p("The pencil in the header opens a window where you can change the name, color, fees, target return, start date and inclusion in the tax report. Movements are not affected."));

children.push(h3('Delete'));
children.push(p([
  t("The bin asks for confirmation and tells you exactly what will go with the envelope: the number of "),
  b('scheduled movements'), t(' and '), b('calibrations'), t(' involved.'),
]));
children.push(gap(100));
children.push(...figure('5.9', "The deletion confirmation",
  "the confirmation window showing the count of scheduled movements and calibrations that will be deleted."));

children.push(gap(140));
children.push(attention("Deletion cannot be undone and takes the envelope's whole history with it. If in doubt, export your data first (§ 14.3): you can always go back by importing it."));

module.exports = children;

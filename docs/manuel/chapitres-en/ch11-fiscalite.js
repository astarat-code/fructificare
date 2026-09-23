// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
const {
  p, bullet, step, bonASavoir, attention, figure, gap,
  h1, h2, h3, t, b, i, ui, code, tableau,
} = require('../lib/kit');
const { TextRun } = require('docx');

const children = [];

// ═══════════════════════════════════════════════════════════════════════════
//  CHAPTER 11
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1('11. Taxation'));

children.push(p([
  t("A gain is only really yours after tax. Fructificare offers two complementary tools: "),
  t("a "), b('simulator'), t(" to answer “what if I withdrew now?”, and a "),
  b('tax report'), t(" to find, the following year, what needs to be declared."),
]));

children.push(gap(120));
children.push(attention([
  new TextRun({ text: "Fructificare is not tax return software. The amounts it produces are estimates, calculated according to the French rules in force in January 2026. Check them against the single tax form (IFU) your institution sends you.", size: 21 }),
]));

// ── 11.1 ───────────────────────────────────────────────────────────────────
children.push(h2("11.1  The tax simulator"));

children.push(...figure('11.1', "The tax simulator",
  "the complete page, full width"));

children.push(p("Available from the Simulation page, it works on amounts you enter freely (it does not read your envelopes)."));

children.push(tableau(
  ['Tab', 'What you enter', 'What it calculates'],
  [
    ['PEA', 'Current value, deposits, holding period', "Gain, social charges, income tax, total tax, net value, effective rate"],
    ['CTO / Crypto', 'Same, with a “crypto” box', 'Same, applying the specific regime for crypto-assets'],
    ['Life Insurance', 'Same, plus family status', "Same, applying the €4,600 allowance (€9,200 for a couple) beyond 8 years"],
    ['Documentation', '—', 'The rates in force, one sheet per envelope, and optimization ideas'],
  ],
  [1700, 3400, 3926],
));

children.push(p("Each tab ends with a contextual tip: for example, on a PEA less than five years old, the benefit of waiting for the milestone before withdrawing."));

// ── 11.2 ───────────────────────────────────────────────────────────────────
children.push(h2('11.2  The tax report'));

children.push(...figure('11.2', 'The Tax Report page',
  "the complete page, full width"));

children.push(p([
  t("Unlike the simulator, the tax report works on "), b('your real data'),
  t(". You choose a year, and it reconstructs what happened on each envelope."),
]));

children.push(h3("What each card shows"));
children.push(bullet("the year's movements, with a “Taxable Withdrawals” badge on the withdrawals concerned;"));
children.push(bullet("the year's deposits, the year's taxable withdrawals, the cumulative deposits;"));
children.push(bullet([b('the current balance'), t(" — the envelope's latest calibrated value, and its uninvested "), b('cash'), t(" when there is some;")]));
children.push(bullet([b("the tax breakdown"), t(" — estimated gain, social charges, income tax, total.")]));

children.push(h3('Which withdrawals are taxable'));
children.push(bullet([b('PEA, PER, life insurance'), t(" — only money that leaves the envelope is taxable; selling and keeping the cash inside triggers nothing.")]));
children.push(bullet([b('Securities account (CTO)'), t(" — each sale is taxable in the year it takes place, even if the proceeds stay as cash in the account.")]));
children.push(bullet([b('Crypto'), t(" — a sale for euros is taxable, in any envelope. Gains are taxable for the year of the disposals, but are declared and paid the following year: the report reminds you of this on the card concerned.")]));

children.push(gap(120));
children.push(bonASavoir([
  new TextRun({ text: "A balance preceded by “~” is estimated. ", bold: true, size: 21 }),
  new TextRun({ text: "In the absence of a calibration, Fructificare derives it from your net deposits. It is an order of magnitude, not a recorded amount.", size: 21 }),
]));

children.push(h3('Why calibrating changes everything'));
children.push(p([
  t("Fructificare applies the partial withdrawal rule, withdrawal by withdrawal and in chronological order:"),
]));
children.push(p([code('Taxable gain = Withdrawal amount − (Net deposits × Withdrawal amount ÷ Total envelope value)')], { spacing: { after: 140 } }));
children.push(bullet([b('Net deposits'), t(" — the money you brought in, minus the share of capital already repaid by your previous withdrawals;")]));
children.push(bullet([b("Total envelope value"), t(" — its value just before the withdrawal: the closest calibration, cash included, brought forward to the withdrawal date using the deposits and withdrawals made in between.")]));
children.push(p([
  t("For example, for €100,000 paid into a life insurance contract worth €150,000, a withdrawal of €50,000 contains €16,666.67 of gains; €66,666.67 of net deposits then remain for the next withdrawal. "),
  t("For crypto, the law applies the same principle to disposals. For stocks in a securities account, the official calculation relies on the average purchase price of the securities sold: the result shown is then an estimate."),
]));
children.push(p([
  t("This formula has a direct consequence: "), b("as long as the envelope is not calibrated, the estimated gain is zero"),
  t(". Without a known valuation, the application cannot invent a gain — and will therefore show no tax. "),
  b("Calibrating is the condition for getting a useful tax estimate"), t(" (chapter 6)."),
]));

children.push(h3("When no tax is shown"));
children.push(p("The tax lines only appear for envelopes that have a tax regime. Otherwise, a message explains why."));
children.push(tableau(
  ['Situation', 'Message shown'],
  [
    ["No withdrawal in the year", "No withdrawal this year: no tax to declare."],
    ['Withdrawals without gains', "Withdrawals with no gain over the period: no tax."],
    ['Custom envelope', "Custom envelope: no pre-calculated tax regime."],
    ['Regulated savings account', "Regulated savings account: interest exempt from income tax and social charges."],
    ['Withdrawals with gains', 'The details of the regime applied (see the appendices)'],
  ],
  [2800, 6226],
));

children.push(h3('The tax-advantaged badge'));
children.push(p([
  t("A green edge and a "), ui('Tax-free (5 yrs)'), t(' or '), ui('Tax-advantaged (8 yrs)'),
  t(" badge mark the envelopes that have passed their holding-period threshold by the end of the report year: 5 years for a PEA, 8 years for a life insurance contract."),
]));

// ── 11.3 ───────────────────────────────────────────────────────────────────
children.push(h2("11.3  The PDF export"));

children.push(p([
  t("The "), ui('Tax Report'), t(" button produces the report on screen; you can "), ui('Download PDF'),
  t(" to turn this report into a document to archive or to send to your accountant."),
]));

children.push(p([b('The standard PDF contains:')]));
children.push(bullet("a header and the list of the envelopes concerned;"));
children.push(bullet([b("a summary by asset type"), t(" — withdrawals, gains, tax, with a reminder of the rates applied;")]));
children.push(bullet([b('the details by envelope'), t(" — movement table, summary box, tax-maturity mention;")]));
children.push(bullet('numbered footers.'));

children.push(gap(120));
children.push(h3('The detailed performance report'));
children.push(p([
  t("A checkbox adds four pages of analysis. It "), b("requires at least one calibration in the year"),
  t(": without a valuation, there is no performance to plot."),
]));
children.push(step([b('Cover'), t(" — the annual curve of your portfolio.")], 1));
children.push(step([b('Portfolio summary'), t(" — start and end values, allocation pie chart, regulated savings accounts counted separately.")], 1));
children.push(step([b('Performance by envelope'), t(" — one section per envelope, with its monthly curve.")], 1));
children.push(step([b('Overall annual analysis'), t(" — returns by year, deposit fees, FIRE progress.")], 1));

module.exports = children;

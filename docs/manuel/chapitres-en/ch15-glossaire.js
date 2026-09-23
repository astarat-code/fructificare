// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
const {
  p, bullet, bonASavoir, figure, gap,
  h1, h2, h3, t, b, i, ui, tableau,
} = require('../lib/kit');
const { TextRun } = require('docx');

const children = [];

// ═══════════════════════════════════════════════════════════════════════════
//  CHAPTER 15
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1('15. Glossary'));

children.push(p([
  t("Fructificare includes "),
  b('33 definitions'), t(", written to be understood without prior knowledge — available from "), ui('Edit > Glossary'), t('.'),
]));

children.push(...figure('15.1', 'The Glossary page',
  "the complete page, full width"));

// ── 15.1 ───────────────────────────────────────────────────────────────────
children.push(h2('15.1  Discovery mode'));

children.push(p([
  t("At the top of the page, a switch controls "), ui('Discovery mode'), t(". When on — the default setting — "),
  t("financial terms are "), b("clickable throughout the application"), t(": a click opens a bubble that explains the word."),
]));

children.push(p([
  t("Turn it off for a cleaner interface. The Glossary page itself stays accessible in any case."),
]));

children.push(gap(120));
children.push(bonASavoir([
  new TextRun({ text: "The search field filters both the terms and their definitions. ", size: 21 }),
  new TextRun({ text: "Searching for “tax” therefore also brings up “Flat tax” and “Tax allowance”, whose definition contains the word.", size: 21 }),
]));

// ── 15.2 ───────────────────────────────────────────────────────────────────
children.push(h2('15.2  The definitions'));

children.push(h3('Accounts'));
children.push(tableau(
  ['Term', 'Definition'],
  [
    ['Account', "A real investment account: your PEA, life-insurance policy or savings passbook."],
    ['PEA', "A French tax-advantaged account for investing in European shares."],
    ['Securities account', 'An ordinary securities account: no cap, no restrictions, but no tax advantage either.'],
    ['Life insurance', "A flexible savings contract whose tax advantage kicks in after 8 years."],
    ['Euro fund', "The guaranteed compartment of a life-insurance policy: your capital cannot fall."],
    ['Regulated savings account', "Livret A, LDDS, LEP: a state-set rate and fully tax-exempt interest."],
  ],
  [2200, 6826],
));

children.push(h3('Operations'));
children.push(tableau(
  ['Term', 'Definition'],
  [
    ['Transaction', 'A deposit or withdrawal on an account, at a given date.'],
    ['Calibration', "Manually entering the real value of an account, read from your bank statement."],
    ['Cash', 'Money sitting in the account but not yet invested.'],
    ['Deposits', "The money you have paid into the account (total of your deposits)."],
    ['Weighted average price', 'The average price at which you bought a holding, weighted by quantity.'],
  ],
  [2200, 6826],
));

children.push(h3('Performance'));
children.push(tableau(
  ['Term', 'Definition'],
  [
    ['Capital gain', 'The difference between what your investment is worth and what you put in.'],
    ['PnL', "Profit and Loss: the gain or loss on a holding, in euros."],
    ['Total cost (cost basis)', 'The capital you actually invested in this holding: your deposits minus withdrawals, before any gain.'],
    ['Current value', "What your holding or account is worth today, based on the latest calibration."],
    ['Target return', "The annual return rate you assume to project the account's growth."],
    ['Annual return', 'What your money earned over a year, as a percentage.'],
    ['Modified Dietz', 'The return calculation method used by Fructificare.'],
    ['TER', "Total Expense Ratio: the total annual cost of an investment, as a percentage."],
  ],
  [2200, 6826],
));

children.push(h3('Fees'));
children.push(tableau(
  ['Term', 'Definition'],
  [
    ['Management fees', 'What your insurer or broker charges each year on your holdings.'],
    ['Entry fees', 'A commission charged each time you invest.'],
  ],
  [2200, 6826],
));

children.push(h3('Taxation'));
children.push(tableau(
  ['Term', 'Definition'],
  [
    ['Taxation', "The rules that determine what the state takes from your gains."],
    ['Flat tax', 'The single flat rate of 31.4% on financial gains.'],
    ['Social contributions', "18.6% taken from your gains, whatever the account."],
    ['Tax allowance', "A portion of your gains that escapes tax."],
    ['Partial withdrawal', 'Taking part of your life-insurance policy without closing it.'],
  ],
  [2200, 6826],
));

children.push(h3('Strategy and the long term'));
children.push(tableau(
  ['Term', 'Definition'],
  [
    ['Compound interest', 'Your gains themselves produce gains, year after year.'],
    ['8-4-3 rule', "A way of visualising how compound interest accelerates."],
    ['FIRE', "Financial Independence, Retire Early: living off your portfolio income."],
    ['Crossover Point', "The point where your investments earn you more than you contribute."],
    ['Diversification', 'Spreading your money across several investments to limit risk.'],
    ['Inflation', "The general rise in prices, which erodes the value of your money."],
    ['Stress test', 'Simulating a crash to see what would become of your portfolio.'],
  ],
  [2200, 6826],
));

module.exports = children;

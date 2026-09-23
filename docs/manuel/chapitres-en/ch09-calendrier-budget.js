// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
const {
  p, bullet, step, bonASavoir, attention, figure, gap,
  h1, h2, h3, t, b, i, ui, tableau,
} = require('../lib/kit');
const { TextRun } = require('docx');

const children = [];

// ═══════════════════════════════════════════════════════════════════════════
//  CHAPTER 9 — the order follows the application page: the calendar first,
//  then its three tabs (Reminders, Scheduled movements, Monthly budget).
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1('9. The calendar and the budget'));

children.push(p("The calendar brings together your past and upcoming movements, your reminders, your tax deadlines, your contract anniversaries..."));
children.push(p([
  t("Three tabs complete it below: "), ui('Reminders'), t(", "), ui('Scheduled movements'),
  t(" and "), ui('Monthly budget'), t('.'),
]));
children.push(gap(100));
children.push(...figure('9.1', 'The calendar page',
  "the complete page: a well-filled monthly grid with dots of several colors, legend visible, and the three tabs below."));

// ── 9.1 ────────────────────────────────────────────────────────────────────
children.push(h2('9.1  The monthly grid'));
children.push(p("The arrows on either side of the month move you from one month to the next. The Today button takes you back to the current month, and the field on the right lets you jump straight to a year."));

children.push(p([
  t("Each day shows up to "), b('three event dots'),
  t(". Beyond that, a “+n” counter shows what is not displayed. Click the day to see everything."),
]));

children.push(h3('The legend'));
children.push(tableau(
  ['Color', 'Event'],
  [
    ['Green',        'Deposit'],
    ['Red',          'Withdrawal'],
    ['Amber',        'Reminder'],
    ['Blue',         'Scheduled movement'],
    ['Purple',       'Budget entry'],
    ['Indigo',       'Fructificare event (review, fee review…)'],
    ['Light purple', 'Goal due date'],
    ['Yellow',       'Personal note'],
    ['Orange',       'Current account movement'],
  ],
  [2200, 6826],
));

children.push(gap(160));

children.push(h3('The day window'));
children.push(p("A click on a cell opens the details of the day: each event is listed with its amount, its breakdown by asset where relevant, and its actions (mark a reminder as done, apply a scheduled movement)."));
children.push(p([
  t("At the bottom of the window, three buttons add an item on that date: "),
  ui('Budget'), t(" opens the entry of a budget item (§ 9.5), "),
  ui('Note'), t(" a calendar note, and "),
  ui('Reminder'), t(" a reminder (§ 9.3)."),
]));
children.push(gap(100));
children.push(...figure('9.2', 'The details of a day',
  "the window of a busy day, mixing a reminder with its “Mark as done” button and scheduled movements, with the Budget, Note and Reminder buttons visible at the bottom."));

children.push(h3('Calendar notes'));
children.push(p("A free note attached to a date, in one of eight available colors. It is not used in any calculation: it is a memo, to remember the context of a decision — “switch after the crash”, “bonus received”."));

children.push(h3('Exporting to your calendar'));
children.push(p([
  t("The "), ui('Export .ics'),
  t(" button produces a standard calendar file, which you can import into Outlook, Google Calendar or Apple Calendar."),
]));

// ── 9.2 ────────────────────────────────────────────────────────────────────
children.push(h2('9.2  Events generated automatically in the calendar'));

children.push(tableau(
  ['Event', 'When', 'Why'],
  [
    ['Monthly calibration',        'Every month',                     "Record the value of your accounts (chapter 6)"],
    ['Monthly challenge — 3 days left', 'Three days before the end of the month', "Complete the month's mission (§ 13.5)"],
    ['PEA — 5 years',              "On the contract anniversary",     "Income tax exemption acquired"],
    ['Life insurance — 8 years',   "On the contract anniversary",     'Tax allowance acquired'],
    ['Quarterly review',           'Every three months',              'Take stock of the trajectory'],
    ['Annual review',              '1 January',                       'Review goals and performance'],
    ['Fee review',                 '15 January and 15 July',          'Check what your contracts cost'],
    ['Tax deadlines',              'In spring',                       'Prepare and then file your tax return'],
  ],
  [2400, 2800, 3826],
));

children.push(gap(160));
children.push(p([
  t("PEA and life insurance contract anniversaries are only created if you have filled in the "),
  b("start date"), t(" of the envelope concerned (§ 4.3)."),
]));

// ── 9.3 ────────────────────────────────────────────────────────────────────
children.push(h2('9.3  Reminders tab'));
children.push(p("Your personal reminders, alongside those Fructificare generates (§ 9.2). At the top of the list, the monthly challenge and the current month's due dates (calibration, review, tax) remind you of what lies ahead."));

children.push(h3('Adding a reminder'));
children.push(step([t('Click '), ui('Add reminder'), t('.')], 60));
children.push(step([t('Type the '), b('label'), t(" — for example “Check my PEA”, “Record the values”.")], 60));
children.push(step([t('Set the '), b('date'), t('.')], 60));
children.push(step([t('Choose the '), b('recurrence'), t(': none, monthly or yearly.')], 60));
children.push(step([t('Confirm with '), ui('Save'), t('.')], 60));

children.push(p("A reminder can be edited, marked as done or deleted from the list."));

children.push(h3('Overdue reminders'));
children.push(p("A red banner appears at the top of the page as soon as a reminder has passed its date without being marked as done. Each reminder is listed with its date and a tick to mark it as done, without leaving the page."));
children.push(gap(100));
children.push(...figure('9.3', 'The overdue reminders banner',
  "the red banner with two or three overdue reminders and their tick buttons."));

// ── 9.4 ────────────────────────────────────────────────────────────────────
children.push(h2('9.4  Scheduled movements tab'));
children.push(p([
  t("A view of your active regular movements from the calendar: envelope, amount, recurrence, start date and note. "),
  t("The "), ui('Manage'), t(" button — like the pencil on each row — opens the full recurring movements panel (chapter 8), where series are created, edited and stopped."),
]));

// ── 9.5 ────────────────────────────────────────────────────────────────────
children.push(h2('9.5  Monthly budget tab'));

children.push(h3("The investment rate"));
children.push(p("You will find the share of this month's salary actually invested, as a percentage. The assessment below is given for information only and is not investment advice. The share invested depends on each person's situation and should be tailored to it."));

children.push(tableau(
  ['Rate', 'Assessment'],
  [
    ['30% and above', 'Excellent! 🏆'],
    ['20 to 29%',     'Great! 💪'],
    ['10 to 19%',     'Good! 👍'],
    ['Below 10%',     'Keep it up! 🌱'],
  ],
  [2600, 6426],
));

children.push(gap(160));
children.push(p([
  t("The calculation assumes that an entry in the "), b('Salary'),
  t(" category exists for the month. The salary can also be entered in the Settings: it is then used as the basis when the month contains no “Salary” entry."),
]));
children.push(gap(100));
children.push(...figure('9.4', "The investment rate",
  "the investment rate card, with its percentage in large type, its assessment and the salary / invested reminder below."));

children.push(h3("The month's movement list"));
children.push(p("All the month's flows, whatever their origin: budget entries, envelope transactions, recurring occurrences, current account expenses. A coloured dot shows the source of each row. The movements recorded on investment envelopes are imported here automatically, but remember to add your recurring living expenses (rent, transport, food, subscriptions, etc.)."));

children.push(h3('Adding a budget movement'));
children.push(p([
  t("This is where you enter everyday expenses and income that do not concern any investment envelope — rent, a subscription, a salary. They are attached to the "),
  b('current account'), t(", which is not part of any investment statistics."),
]));
children.push(step([t('Click '), ui('Add movement'), t(" — or "), ui('Budget'), t(" from a day window (§ 9.1).")], 70));
children.push(step([t('Choose the '), b('category'), t(' among the seven offered.')], 70));
children.push(step([t('If you chose '), b('Other'), t(", enter a custom label.")], 70));
children.push(step([t('Enter the '), b('amount'), t(' and the '), b('date'), t('.')], 70));
children.push(step([t('Choose a '), b('recurrence'), t(" if needed: none, weekly, monthly, quarterly or yearly. A recurring entry is carried over automatically to the following periods.")], 70));
children.push(step([t('Confirm with '), ui('Expense'), t(' or '), ui('Income'), t(" depending on whether money goes out or comes in.")], 70));

children.push(p([b('The seven categories:')]));
children.push(bullet('Salary — your income; it is the basis of the investment rate;'));
children.push(bullet('Rent / Housing, Food, Bills / Fees — your fixed expenses;'));
children.push(bullet('Leisure — your discretionary expenses;'));
children.push(bullet('Investment — what you put aside;'));
children.push(bullet('Other — with a free label.'));

children.push(p([
  t("A second "), ui('History'),
  t(" tab lists your past budget entries. It only shows budget entries: your envelope movements stay on their own page."),
]));

children.push(h3('The breakdown pie chart'));
children.push(p("The breakdown of the month's expenses by category."));
children.push(gap(100));
children.push(...figure('9.5', "The Monthly budget tab",
  "the complete tab: investment rate at the top, the month's movement list on the left with its coloured dots, breakdown pie chart on the right."));

children.push(gap(120));
children.push(bonASavoir("The budget is not mandatory. If you enter neither salary nor expenses, the rest of Fructificare works normally — you simply lose the investment rate, the Crossover Point and the liquidity component of the health score."));

module.exports = children;

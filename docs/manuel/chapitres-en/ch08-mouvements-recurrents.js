// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
const {
  p, bullet, step, bonASavoir, attention, noteRedac, figure, gap,
  h1, h2, h3, t, b, i, ui, code, tableau,
  GREEN, SLATE, GREY, AMBER, CONTENT_W,
} = require('../lib/kit');
const { Paragraph, TextRun, AlignmentType } = require('docx');

const children = [];

children.push(h1('8. Recurring movements'));

children.push(p("A recurring movement is a scheduled deposit or withdrawal. Once created, it is recorded on its own on each due date — including the due dates that passed while the application was closed."));

children.push(gap(120));
children.push(bonASavoir([
  new TextRun({ text: 'Not to be confused with movement templates (chapter 7), ', size: 21, bold: true }),
  new TextRun({ text: "which are templates that help you enter data faster.", size: 21 }),
]));

// ── 8.1 ────────────────────────────────────────────────────────────────────
children.push(h2('8.1  Opening the panel'));
children.push(p('Three paths lead to the recurring movements panel:'));
children.push(bullet([t('from the dashboard, '), ui('Recurring movements'), t(" button — the counter shows the number of active series;")]));
children.push(bullet([t('from an envelope page, '), ui('Recurring movements'), t(" button — the envelope is pre-selected;")]));
children.push(bullet([t("from the calendar, "), ui('Scheduled movements'), t(' tab (§ 9.4).')]));

children.push(p('The panel has two tabs: creation and history.'));
children.push(gap(100));
children.push(...figure('8.1', 'The recurring movements panel',
  "the panel open on the “New recurring” tab, with both tabs clearly visible and the active series counter on “History”."));

// ── 8.2 ────────────────────────────────────────────────────────────────────
children.push(h2('8.2  Creating a series'));

children.push(step([t('Choose the destination '), b('envelope'), t('.')], 50));
children.push(step([t('Set the '), b('type'), t(': deposit or withdrawal.')], 50));
children.push(step([t('Enter the '), b('amount'), t(' of each occurrence.')], 50));
children.push(step([t('Fill in the '), b('transaction fees'), t(" — they will be charged on each due date — then any "), b('annual fees'), t('.')], 50));
children.push(step([t('Set the '), b('start date'), t(' and the '), b('recurrence'), t('.')], 50));
children.push(step([t('Leave the '), b('end date'), t(" empty so that the movement keeps applying by default until you stop it, or set one.")], 50));
children.push(step([t('Add a '), b('note'), t(' and the '), b("asset type"), t(' if needed.')], 50));
children.push(step([t('Confirm with '), ui('Create regular movement'), t('.')], 50));

children.push(gap(100));
children.push(...figure('8.2', 'The creation form',
  "the form filled in for a monthly deposit: envelope, Deposit type selected in green, amount, monthly recurrence and note."));

children.push(h3('The four recurrences'));
children.push(tableau(
  ['Recurrence', 'Frequency', 'Typical use'],
  [
    ['Monthly',      'Every month',         "Scheduled deposit into a contract"],
    ['Quarterly',    'Every 3 months',      'Dividends, SCPI rents'],
    ['Semi-annual',  'Every 6 months',      'Bonus, additional deposit'],
    ['Annual',       'Once a year',         "Year-end deposit, account-keeping fees"],
  ],
  [2000, 2400, 4626],
));

children.push(gap(160));

children.push(gap(60));
children.push(bonASavoir("Recurring movements only concern your investment envelopes. An everyday expense or income — rent, a subscription, a salary — is entered in the Monthly budget tab of the calendar, with its recurrence (§ 9.5)."));

children.push(h3('Importing a movement template'));
children.push(p([
  t("If you have created templates for this envelope (chapter 7), the "),
  ui('Import a template'),
  t(" button takes over its asset type and fees in one go. It is the quickest way to create a series that is consistent with your manual entries."),
]));

children.push(h3('Splitting over several assets'));
children.push(p([
  t("As with manual entry, tick "), ui("Multiple asset types"),
  t(" then "), ui('Configure'),
  t(" to break each occurrence down in percentages. The total must reach 100%."),
]));

children.push(gap(120));
children.push(attention("A series created with a start date in the past immediately generates all the occurrences since that date. Check the date before confirming."));

// ── 8.3 ────────────────────────────────────────────────────────────────────
children.push(h2("8.3  The history"));
children.push(p("The second tab lists all your series, active and ended alike, each tinted in the color of its envelope."));

children.push(p('Each block shows the name of the envelope, the amount, the recurrence, the period covered and the note.'));

children.push(p([
  t('An '), b('ended'),
  t(" series — stopped manually, or whose end date has passed — stands out with a "),
  b('dotted border'), t(" and an “Ended” badge. It keeps the tint of its envelope, so that it stays readable."),
]));
children.push(gap(100));
children.push(...figure('8.3', "The series history",
  "the History tab with at least four series: active ones with a solid border and ended ones with a dotted border, tinted in the colors of their envelopes."));

children.push(h3('Editing a series'));
children.push(p([
  t("The "), b('pencil'),
  t(" takes you back to the form, pre-filled. Changing the amount, start date, recurrence, type or fees applies to "), b('the whole series, past included'),
  t(": the movements already generated are deleted and recreated with the new settings, and the envelope's balance is recalculated. To change the amount from a given date without touching the past, stop the series and create a new one."),
]));
children.push(p([
  t("Every change of amount is recorded in a "), b('change log'),
  t(" shown below the block, with its date and both values. You thus keep track of a change to a deposit."),
]));

children.push(h3('Stopping a series'));
children.push(p([
  t("The "), b('square'),
  t(" icon interrupts the series after confirmation. The movements already generated stay in place."),
]));

children.push(h3('Deleting a series'));
children.push(p([
  t("Only available on a "), b('stopped'),
  t(" series. Fructificare first tells you how many transactions this series generated and for what total amount: they will be deleted with it."),
]));
children.push(gap(100));
children.push(...figure('8.4', 'The deletion confirmation',
  "the confirmation message on a stopped series, showing the number of linked transactions and their cumulative amount."));

children.push(gap(140));
children.push(attention([
  new TextRun({ text: "Stopping and deleting are not the same thing. ", size: 21, bold: true }),
  new TextRun({ text: "Stopping keeps the history: your past deposits stay in the envelope and in your statistics. Deleting erases the series and every movement it produced — your balance will change.", size: 21 }),
]));

// ── 8.4 ────────────────────────────────────────────────────────────────────
children.push(h2('8.4  Automatic catch-up'));
children.push(p([
  t("Your series keep existing when the application is closed. At each startup, Fructificare compares today's date with the last known due date and generates everything that is missing (§ 3.4)."),
]));

children.push(p('The summary distinguishes two cases:'));
children.push(bullet([b('applied automatically'), t(" — the occurrences created without any action from you;")]));
children.push(bullet([b('carried over into simulations'), t(" — the occurrences added to your scenarios.")]));

children.push(p("In an envelope's movement table, an occurrence coming from a series carries the 🔄 marker and its note is shown in italics (§ 5.10)."));

children.push(gap(120));
children.push(attention("The catch-up is capped at twenty-four months. Beyond that, the oldest occurrences are ignored and the summary tells you how many were skipped. If you resume tracking after a long break, check your balances."));

module.exports = children;

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
const {
  p, bullet, step, bonASavoir, attention, noteRedac, figure, gap,
  h1, h2, h3, t, b, i, ui, code, tableau,
  GREEN, SLATE, GREY, AMBER, CONTENT_W,
} = require('../lib/kit');
const { Paragraph, TextRun, AlignmentType } = require('docx');

const children = [];

children.push(h1('7. Movement templates'));

children.push(p("A movement template is an entry template. It remembers everything that does not change from one deposit to the next — the envelope, the fund, the fees — so that only the date and the amount are left to fill in."));

children.push(gap(120));
children.push(bonASavoir([
  new TextRun({ text: 'A movement template never triggers anything on its own. ', size: 21, bold: true }),
  new TextRun({ text: "If you are looking for a deposit that happens automatically on each due date, that is the recurring movement described in chapter 8.", size: 21 }),
]));

// ── 7.1 ────────────────────────────────────────────────────────────────────
children.push(h2('7.1  When to create one'));
children.push(p("As soon as the same investment comes back. If you invest every month in the same ETF, with the same brokerage fees and the same breakdown, you may as well record this repetitive information once."));

// ── 7.2 ────────────────────────────────────────────────────────────────────
children.push(h2('7.2  Opening the panel'));
children.push(p([
  t("From an envelope page, click "), ui('Movement templates'),
  t(", at the top of the entry card. The panel opens."),
]));
children.push(gap(100));
children.push(...figure('7.1', 'The movement templates panel',
  "the panel open in list mode, with templates tinted in the colors of their envelopes and the “New template” button at the top right."));

// ── 7.3 ────────────────────────────────────────────────────────────────────
children.push(h2('7.3  The list'));
children.push(p("Each template takes up a block, in the color of the envelope it is attached to. It shows its name, its envelope, its asset type and a reminder of its deposit fees and annual fees."));
children.push(p("Two icons on the right: the pencil to edit, the bin to delete."));

children.push(gap(120));
children.push(bonASavoir("Deleting a template deletes no movement already entered. You only lose the template."));

// ── 7.4 ────────────────────────────────────────────────────────────────────
children.push(h2('7.4  Creating a template'));

children.push(step([t('Click '), ui('New template'), t('.')], 40));
children.push(step([t('Give it a meaningful '), b('name'), t(" — it is the one you will pick in the drop-down menus. The name of the fund works well: “ETF World”, “Euro fund”, “SCPI European Offices”.")], 40));
children.push(step([t('Choose the linked '), b('envelope'), t('.')], 40));
children.push(step([t('Select the '), b("asset type"), t(", or tick "), ui("Multiple asset types"), t(' for a breakdown in percentages.')], 40));
children.push(step([t('Fill in the '), b('deposit/withdrawal fees'), t(' and the '), b('annual fees'), t(', as percentages or in euros.')], 40));
children.push(step([t('Confirm with '), ui('Create template'), t('.')], 40));

children.push(gap(100));
children.push(...figure('7.2', 'The creation form',
  "the complete, filled-in form, with a single asset type selected and both fee fields in percentage mode."));

children.push(gap(120));
children.push(attention("The template's fees are the ones that will be pre-filled each time you use it. Check them against your fee schedule rather than estimating them: this figure then feeds the “Total Fees” tile and the health score."));

// ── 7.5 ────────────────────────────────────────────────────────────────────
children.push(h2('7.5  Using a template'));
children.push(p('Your templates are used in three places.'));

children.push(h3('When entering data by hand'));
children.push(p([
  t("In the add-movement form (§ 5.4), the "), ui('Movement Template'),
  t(" menu pre-fills the asset type and the fees. All that is left is to enter the date and the amount."),
]));

children.push(h3('To create a recurring series'));
children.push(p([
  t("In the recurring movement creation tab, the "),
  ui('Import a template'), t(" button takes over the same settings (§ 8.2)."),
]));

children.push(h3('As a calibration position'));
children.push(p([
  t("It is the least obvious use and the most useful. When an envelope has templates, the "),
  ui('Detail by position'), t(" option of the calibration window (§ 6.3) offers "),
  b('one field per template'),
  t(" rather than one field per asset class. You then value each holding of your contract as it appears on your statement, with a reminder of the number of units held."),
]));

children.push(gap(120));
children.push(bonASavoir([
  new TextRun({ text: "This is the underlying reason to create templates. ", size: 21, bold: true }),
  new TextRun({ text: "Without them, your detailed calibration is done by broad asset class — “stocks”, “euro funds”. With them, it is done holding by holding, and returns by asset (§ 5.8) become genuinely useful.", size: 21 }),
]));

module.exports = children;

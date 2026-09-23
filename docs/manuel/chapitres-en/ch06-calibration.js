// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
const {
  p, bullet, step, bonASavoir, attention, noteRedac, figure, gap,
  h1, h2, h3, t, b, i, ui, code, tableau,
  GREEN, SLATE, GREY, AMBER, CONTENT_W,
} = require('../lib/kit');
const { Paragraph, TextRun, AlignmentType } = require('docx');

const children = [];

children.push(h1('6. Calibrating your envelopes'));

// ── 6.1 ────────────────────────────────────────────────────────────────────
children.push(h2('6.1  Why calibrate'));
children.push(p("Fructificare connects to no bank. You therefore need to calibrate your envelopes yourself. It does not take long, and it is recommended to do it at least once a month."));

children.push(p([b("What calibration makes possible:")]));
children.push(bullet('calculating the current total value of your portfolio and its gain (§ 4.4);'));
children.push(bullet("drawing the evolution curves (§ 4.5, § 5.6), the annualized returns and the annual bar charts (§ 4.9, § 5.7);"));
children.push(bullet("estimating the gains in the tax report (§ 11.2);"));
children.push(bullet('calculating the financial health score (§ 13.2);'));
children.push(bullet("setting the avatar, which follows your real capital (§ 13.1);"));
children.push(bullet('showing the “real value” view of the allocation pie chart (§ 4.6).'));

children.push(gap(120));
children.push(attention([
  new TextRun({ text: "As long as an envelope is not calibrated, its gain is zero by default — including in the tax report. ", size: 21, bold: true }),
  new TextRun({ text: "This is why a tax report produced on uncalibrated envelopes will show no estimated tax.", size: 21 }),
]));

children.push(h3('How often?'));
children.push(p([
  t("Once a month is enough, and it is the pace Fructificare suggests. The "),
  ui('Calibrate my envelopes'),
  t(" button on the dashboard turns amber and blinks as soon as an envelope has never been calibrated, or its last calibration is more than thirty days old."),
]));
children.push(p("A “Monthly calibration” reminder also appears in your calendar (§ 9.2)."));

children.push(gap(120));
children.push(bonASavoir("Always calibrate at the same time of the month — when you receive your statements, for example. Evenly spaced points give readable curves and returns that can be compared from one period to the next."));

// ── 6.2 ────────────────────────────────────────────────────────────────────
children.push(h2('6.2  Entering a calibration'));
children.push(p([
  t("Open the window from the dashboard — "), ui('Calibrate my envelopes'),
  t(" button — to handle all your envelopes at once, or from an envelope page to calibrate just one."),
]));
children.push(gap(100));
children.push(...figure('6.1', 'The calibration window',
  "the “New entry” tab with three envelopes visible, each showing its last calibration, its real return badge and its total value field."));

children.push(step([t('Check the '), b('default date'), t(", at the top of the window. It applies to all envelopes.")], 30));
children.push(step([t('For each envelope, enter its '), b('total value'), t(' as read on your account.')], 30));
children.push(step([t('If needed, change the '), b('date'), t(" for that envelope alone in the field on the right — your statements do not all arrive on the same day.")], 30));
children.push(step([t('Click the '), ui('Calibrate'), t(" button on the row. The message “Calibration saved” confirms it has been recorded.")], 30));
children.push(step('Repeat for the other envelopes, then close the window.', 30));

children.push(p([
  t("Below each row, the "), b('last calibration'),
  t(" known is shown with its date and amount, along with an annualized "), b('real return'),
  t(" badge. They help you spot an aberrant entry quickly."),
]));

// ── 6.3 ────────────────────────────────────────────────────────────────────
children.push(h2('6.3  Detail by position'));
children.push(p([
  t("Below the total value field, a "), ui('Detail by position'),
  t(" link opens the breakdown. Instead of a single figure, you split the value between your holdings."),
]));

children.push(p("Fructificare offers two ways of splitting, depending on what you have entered:"));
children.push(bullet([b('by movement template'), t(" — if you have created some for this envelope (chapter 7), each one becomes a position to value, with a reminder of the number of units held;")]));
children.push(bullet([b("by asset type"), t(" — otherwise, one row per asset class present in the envelope.")]));

children.push(p([
  t('A consistency check verifies live that the sum of the positions equals the total. Until it does, an amber warning shows you the gap.'),
]));
children.push(gap(100));
children.push(...figure('6.2', 'The breakdown by position',
  "an expanded envelope with its positions valued and the consistency check showing “Sum: … — consistent” in green."));

children.push(gap(120));
children.push(attention([
  new TextRun({ text: 'Get into this habit from your very first calibration. ', size: 21, bold: true }),
  new TextRun({ text: "The breakdown by position is the only thing that unlocks the “Returns by asset” section of the envelope page (§ 5.8). Without it, you will never get the holding-by-holding performance detail — only an overall figure. A total-value calibration cannot be “detailed” afterwards: you have to edit it or enter a new one.", size: 21 }),
]));

children.push(h3('Level 1 or level 2?'));
children.push(tableau(
  ['', 'Level 1 — total value', 'Level 2 — detailed'],
  [
    ['Time to enter',          'One row',                   'One row per position'],
    ['Portfolio value',        'Yes',                       'Yes'],
    ['Curves and returns',     'Yes',                       'Yes'],
    ['Tax estimate',           'Yes',                       'Yes'],
    ['Returns by asset',       'No',                        'Yes'],
    ['Cost price per holding', 'No',                        'Yes'],
  ],
  [3026, 3000, 3000],
));

children.push(gap(160));
children.push(p("In short: level 1 is enough to manage your wealth as a whole. Level 2 is needed as soon as you want to know which of your holdings is pulling performance up or down."));

// ── 6.4 ────────────────────────────────────────────────────────────────────
children.push(h2("6.4  Calibration history"));
children.push(p([
  t("The second tab, "), ui('History'),
  t(", lists all your calibrations, most recent first. Each row takes the color of its envelope."),
]));

children.push(p('A badge shows the level of detail:'));
children.push(bullet([b('Lvl 1'), t(' — total value only;')]));
children.push(bullet([b('Lvl 2'), t(' — broken down by position.')]));

children.push(p([
  t('Two icons end each row. The '), b('pencil'),
  t(" lets you edit the row. The "),
  b('bin'), t(' deletes the calibration, after a confirmation.'),
]));
children.push(gap(100));
children.push(...figure('6.3', "Calibration history",
  "the History tab with five or six entries tinted in the colors of their envelopes, mixing Lvl 1 and Lvl 2 badges, and a deletion confirmation open on one row."));

children.push(gap(120));
children.push(bonASavoir("Deleting a calibration deletes no movement. You only lose the valuation point: the curves are recalculated without it, interpolating between the remaining points."));

// ── 6.5 ────────────────────────────────────────────────────────────────────
children.push(h2('6.5  Calibrating a single envelope'));
children.push(p([
  t("From an envelope page, the "), ui('Calibrate'),
  t(" button — next to the “Annual return” title (§ 5.7) — opens the same window, but "),
  b('focused'),
  t(": only the current envelope can be edited, the others appear grayed out. This avoids typing into the wrong row when you manage a dozen accounts."),
]));

module.exports = children;

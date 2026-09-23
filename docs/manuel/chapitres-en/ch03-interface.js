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
//  CHAPTER 3
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1("3. The general interface"));

children.push(p("All the pages of Fructificare share the same frame: a sidebar on the left with the content displayed on the right."));
children.push(gap(100));
children.push(...figure('3.1', "Overview of the interface",
  "the application full screen on the dashboard, with the complete sidebar visible on the left."));

children.push(h2('3.1  The sidebar'));

children.push(h3('The logo'));
children.push(p('A click takes you back to the dashboard, from any screen.'));

children.push(h3('Your profile'));
children.push(p([
  t("An avatar and your nickname. A click opens the "), ui('Trophies'), t(' page.'),
]));
children.push(p([
  t("The avatar reflects your "), b('total capital'),
  t(". It takes you on an epic journey, from your first steps to the stars, and turns gold, with a thin ring, beyond one million (§ 13.1)."),
]));

children.push(h3('Navigation'));
children.push(bullet([ui('Dashboard'), t(' — the overall view of your wealth (chapter 4).')]));
children.push(bullet([ui('Simulation'), t(' — projections and scenarios (chapter 10).')]));
children.push(bullet([ui('Calendar'), t(' — due dates, reminders and budget (chapter 9).')]));
children.push(bullet([ui('Documents'), t(" — your statements and trade confirmations as PDF files (chapter 12).")]));
children.push(bullet([ui('Tax Report'), t(' — tax return and PDF export (chapter 11).')]));
children.push(bullet([ui('Trophies'), t(' — progress, health score, goals (chapter 13).')]));

children.push(h3('The menu at the top of the window'));
children.push(p([
  t("The glossary and the settings are not in the sidebar: they open from the window menu, "),
  ui('Edit > Glossary'), t(" (chapter 15) and "), ui('File > Settings'),
  t(" (chapter 14). This menu also groups saving, display and help (§ 16.6)."),
]));


children.push(h2('3.2  Global commands'));

children.push(h3('Language'));
children.push(p([
  t("The "), ui('View › Languages'), t(" menu offers "), ui('Français'), t(' or '), ui('English'),
  t(" and switches the whole interface, fully translated into French or English. The window menu and this manual follow the chosen language."),
]));

children.push(h3('Light or dark theme'));
children.push(p([
  t("The "), ui('View › Themes'), t(" menu offers the "), ui('Dark theme'), t(' or the '), ui('Light theme'),
  t(". Your choice is saved in your backup file: you will find it again on another computer after importing it."),
]));

children.push(h3('Notifications'));
children.push(p([
  t("The bell shows the number of unread messages. The panel lets you mark a notification as read, mark them all as read, delete a notification, or jump straight to the related page."),
]));
children.push(p("Fructificare notifies you of the tip of the day, a trophy within reach, a goal close to its target, a FIRE milestone reached, a tax deadline or a login streak about to be lost. The pace is capped at two progress notifications per day."));
children.push(gap(100));
children.push(...figure('3.2', 'The notifications panel',
  "the bell with its counter badge, panel open, showing three or four notifications of different types and the “Read all” button."));

children.push(h2("3.3  Display on a small screen"));
children.push(p("Below a certain width, the sidebar folds away. A menu button appears at the top left, the logo shrinks to its icon, and the notification bell moves up into the header."));
children.push(gap(100));
children.push(...figure('3.3', "The interface at a reduced width",
  "two captures in mobile format: the compact header with the menu closed, then the sidebar open as an overlay.", ["Menu closed", "Menu open"]));

children.push(h2('3.4  Catching up at startup'));
children.push(p([
  t("Your recurring movements (chapter 8) keep applying even when the application is closed. At each launch, Fructificare catches up on the due dates missed since your last session and applies them."),
]));
children.push(p([
  t("A message appears at the top right. Click "), ui('View details'),
  t(" to open the full summary:"),
]));
children.push(bullet('the movements applied automatically, with their date and amount;'));
children.push(bullet('the occurrences carried over into your simulations.'));
children.push(gap(100));
children.push(...figure('3.4', 'The catch-up summary',
  "the “Recurring movements catch-up” window open, showing the period covered and a list of applied movements."));

children.push(gap(140));
children.push(attention("The catch-up is capped at twenty-four months. If you reopen the application after more than two years, older occurrences are ignored and the summary tells you so explicitly."));



module.exports = children;

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
const {
  p, bullet, step, bonASavoir, attention, noteRedac, figure, gap,
  h1, h2, h3, t, b, i, ui, code, tableau,
  GREEN, SLATE, GREY, AMBER, CONTENT_W,
} = require('../lib/kit');
const { Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell,
        WidthType, ShadingType, TableOfContents } = require('docx');

// Read from the application itself: a number hard-coded here always ends up drifting
// from the released version.
const { version: VERSION } = require('../../../frontend/package.json');

const children = [];

// ── Title page ─────────────────────────────────────────────────────────────
children.push(
  new Paragraph({ spacing: { before: 2600, after: 0 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Fructificare', bold: true, size: 76, color: AMBER })] }),
  new Paragraph({ spacing: { before: 120, after: 0 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'User Manual', size: 44, color: SLATE })] }),
  new Paragraph({ spacing: { before: 500, after: 0 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Personal wealth tracking — 100% local', size: 24, color: GREY, italics: true })] }),
  new Paragraph({ spacing: { before: 1800, after: 0 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: `Version ${VERSION}`, size: 22, color: GREY })] }),
  new Paragraph({ spacing: { before: 60 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Edition 2 — September 2026', size: 20, color: GREY, italics: true })] }),
);

// ── How to read this manual ────────────────────────────────────────────────
children.push(h1('How to read this manual'));

children.push(p([
  t("This manual describes Fructificare screen by screen. Each chapter matches a page of the application, in the order you will come across them. "),
  t("You do not have to read it all: "),
  b('chapter 2'),
  t(" is a complete guided tour that goes through every feature by following an investor from the first deposit to the first million. Start there if you want an overview before going into detail."),
]));

children.push(h2('Conventions'));
children.push(bullet([ui('Bold green'), t(': a label you read on screen — button, tab, field.')]));
children.push(bullet([code('Monospace'), t(': a file name or an address.')]));
children.push(bullet([b('Bold'), t(': an important concept, defined in § 1.6.')]));

children.push(h2('Boxes'));
children.push(gap(120));
children.push(bonASavoir("A useful detail, a shortcut, a good practice. Nothing essential, but it will save you time."));
children.push(gap(140));
children.push(attention("Something that may surprise you or make you lose data. Worth reading."));

// ── Contents ───────────────────────────────────────────────────────────────
children.push(h1('Contents'));
children.push(new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-3' }));


module.exports = children;

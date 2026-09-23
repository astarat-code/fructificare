// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
const {
  p, bullet, step, bonASavoir, attention, noteRedac, figure, gap,
  h1, h2, h3, t, b, i, ui, code, tableau,
  GREEN, SLATE, GREY, AMBER, CONTENT_W,
} = require('../lib/kit');
const { Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell,
        WidthType, ShadingType, TableOfContents } = require('docx');

// Lue dans l'application elle-même : un numéro écrit ici en dur finit toujours par
// diverger de la version publiée.
const { version: VERSION } = require('../../../frontend/package.json');

const children = [];

// ── Page de titre ──────────────────────────────────────────────────────────
children.push(
  new Paragraph({ spacing: { before: 2600, after: 0 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Fructificare', bold: true, size: 76, color: AMBER })] }),
  new Paragraph({ spacing: { before: 120, after: 0 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Manuel d'utilisation", size: 44, color: SLATE })] }),
  new Paragraph({ spacing: { before: 500, after: 0 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Suivi de patrimoine personnel — 100 % local', size: 24, color: GREY, italics: true })] }),
  new Paragraph({ spacing: { before: 1800, after: 0 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: `Version ${VERSION}`, size: 22, color: GREY })] }),
  new Paragraph({ spacing: { before: 60 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Édition 2 — septembre 2026', size: 20, color: GREY, italics: true })] }),
);

// ── Comment lire ce manuel ─────────────────────────────────────────────────
children.push(h1('Comment lire ce manuel'));

children.push(p([
  t("Ce manuel décrit Fructificare écran par écran. Chaque chapitre correspond à une page de l'application, dans l'ordre où vous les rencontrerez. "),
  t("Vous n'êtes pas obligé de le lire en entier : le "),
  b('chapitre 2'),
  t(" est une visite guidée complète qui traverse toutes les fonctions en suivant un investisseur du premier versement au premier million. Commencez par là si vous voulez une vue d'ensemble avant d'entrer dans le détail."),
]));

children.push(h2('Les conventions'));
children.push(bullet([ui('En vert gras'), t(" : un libellé que vous lisez à l'écran — bouton, onglet, champ.")]));
children.push(bullet([code('En chasse fixe'), t(' : un nom de fichier ou une adresse.')]));
children.push(bullet([b('En gras'), t(' : une notion importante, définie au § 1.6.')]));

children.push(h2('Les encadrés'));
children.push(gap(120));
children.push(bonASavoir("Une précision utile, un raccourci, une bonne pratique. Rien d'indispensable, mais vous gagnerez du temps."));
children.push(gap(140));
children.push(attention("Un point qui peut vous surprendre ou vous faire perdre des données. À lire."));

// ── Sommaire ───────────────────────────────────────────────────────────────
children.push(h1('Sommaire'));
children.push(new TableOfContents('Sommaire', { hyperlink: true, headingStyleRange: '1-3' }));


module.exports = children;

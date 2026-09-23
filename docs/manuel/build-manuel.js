// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * build-manuel.js — assembles the Fructificare user manual (.docx)
 *
 * Styling lives in lib/kit.js, content in chapitres/*.js.
 * Adding a chapter = creating its file and listing it in CHAPITRES.
 *
 * Run:  node build-manuel.js                    → Fructificare-Manuel.docx (French)
 *       MANUEL_LANG=en node build-manuel.js     → Fructificare-Manual.docx (chapitres-en/)
 */

const {
  Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle,
  LevelFormat, convertInchesToTwip, Header, Footer, PageNumber,
} = require('docx');
const fs = require('fs');
const { GREY, LANG } = require('./lib/kit');

const EN = LANG === 'en';
const TITRE = EN ? 'Fructificare — User Manual' : "Fructificare — Manuel d'utilisation";
const FICHIER = EN ? 'Fructificare-Manual.docx' : 'Fructificare-Manuel.docx';
const DOSSIER = EN ? './chapitres-en/' : './chapitres/';

// ── Ordre du manuel ────────────────────────────────────────────────────────
const CHAPITRES = [
  'ch00-front',
  'ch01-prise-en-main',
  'ch02-parcours',
  'ch03-interface',
  'ch04-tableau-de-bord',
  'ch05-fiche-enveloppe',
  'ch06-calibration',
  'ch07-mouvements-types',
  'ch08-mouvements-recurrents',
  'ch09-calendrier-budget',
  'ch10-simulations',
  'ch11-fiscalite',
  'ch12-documents',
  'ch13-progression',
  'ch14-parametres-securite',
  'ch15-glossaire',
  'ch16-annexes',
];

const children = [];
CHAPITRES.forEach(mod => children.push(...require(DOSSIER + mod)));

// ── Document ───────────────────────────────────────────────────────────────
const doc = new Document({
  creator: 'Fructificare',
  title: TITRE,
  description: EN ? 'Fructificare user manual' : "Manuel d'utilisation de Fructificare",
  styles: { default: { document: { run: { font: 'Calibri', size: 22, color: '0F172A' } } } },
  numbering: {
    config: [
      {
        reference: 'puces',
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: convertInchesToTwip(0.3), hanging: convertInchesToTwip(0.18) } } },
        }],
      },
      {
        reference: 'etapes',
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: convertInchesToTwip(0.35), hanging: convertInchesToTwip(0.25) } } },
        }],
      },
    ],
  },
  features: { updateFields: true },
  sections: [{
    properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    headers: {
      default: new Header({ children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0', space: 6 } },
        children: [new TextRun({ text: TITRE, size: 16, color: GREY })],
      })] }),
    },
    footers: {
      default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GREY })],
      })] }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(__dirname + '/' + FICHIER, buf);
  console.log(FICHIER + ' écrit (' + Math.round(buf.length / 1024) + ' Ko, '
    + children.length + ' blocs)');
});

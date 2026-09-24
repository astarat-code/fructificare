// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
const {
  p, bullet, bonASavoir, attention, gap,
  h1, h2, h3, t, b, i, ui, code, tableau,
  VIOLET, CONTENT_W,
} = require('../lib/kit');
const fs = require('fs');
const path = require('path');
const {
  TextRun, Paragraph, ImageRun, Table, TableRow, TableCell,
  WidthType, ShadingType, AlignmentType, VerticalAlign,
} = require('docx');

const children = [];

// ═══════════════════════════════════════════════════════════════════════════
//  CHAPTER 16
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1('16. Appendices'));

// ── 16.1 ───────────────────────────────────────────────────────────────────
children.push(h2('16.1  Envelope types and their taxation'));

children.push(tableau(
  ['Type', 'Treatment on withdrawal'],
  [
    ['PEA', "Flat tax 31.4%; income tax exemption after 5 years (social charges remain due)"],
    ['CTO / Crypto', 'Flat tax 31.4%'],
    ['Life insurance < 8 years', 'Flat tax 31.4%'],
    ['Life insurance ≥ 8 years', "€4,600 allowance (€9,200 for a couple), then income tax at 7.5% up to €150,000 of deposits"],
    ['PER', 'Flat tax 31.4%'],
    ['Regulated account', 'Exempt; excluded from performance calculations'],
    ['Custom', 'No pre-calculated tax regime'],
  ],
  [2600, 6426],
));

children.push(p([
  i("Rates in force: social charges 18.6% · income tax 12.8% · flat tax 31.4% (January 2026). PEA deposit cap: €150,000."),
]));

// ── 16.2 ───────────────────────────────────────────────────────────────────
children.push(h2('16.2  Asset types'));
children.push(p("euro fund · bond · stock · ETF · crypto · real estate · SCPI · gold · exotic · other, plus the custom types you create yourself."));

// ── 16.3 ───────────────────────────────────────────────────────────────────
children.push(h2('16.3  How returns are calculated'));

children.push(p([
  t("Fructificare uses the "), b('modified Dietz method'),
  t(". It addresses a simple problem: if you pay in €10,000 on 30 December, that money has not been working all year, "),
  t("and it would be wrong to count it as if it had been there since January."),
]));

children.push(p([
  t("Each deposit and each withdrawal is therefore "), b('weighted by its date'),
  t(" within the period: a deposit at the start of the year counts almost for its full amount, a deposit at the end of the year almost for nothing."),
]));

children.push(gap(120));
children.push(bonASavoir([
  new TextRun({ text: "The return shown may differ from your bank's. ", bold: true, size: 21 }),
  new TextRun({ text: "Institutions sometimes use other calculation conventions.", size: 21 }),
]));

// ── 16.4 ───────────────────────────────────────────────────────────────────
children.push(h2('16.4  The financial health score in detail'));

children.push(tableau(
  ['Component', 'Points', 'Basis of calculation'],
  [
    ['Diversification', '20', "Concentration index (Herfindahl-Hirschman) over your envelopes and your assets"],
    ['Performance', '25', 'Return compared with a target adjusted for risk and your age'],
    ['Fee Control', '20', 'Weighted annual TER, plus the ratio of fees already paid'],
    ['Resilience & Inflation', '25', 'Exposure to a crash, weighted by your age'],
    ['Liquidity', '10', 'Months of income covered by your regulated savings accounts'],
    ['Bonus', '5', 'Young and performing, or senior and resilient'],
  ],
  [2400, 900, 5726],
));

// ── 16.5 ───────────────────────────────────────────────────────────────────
children.push(h2("16.5  Avatar tiers"));

children.push(p("Nineteen tiers from €0 to €750,000, split into five chapters and calculated on your total capital, savings accounts included."));

// Icons: captures/avatars/<tier>.png, produced by avatars-shoot.js (shared by both languages).
const AVATARS = [
  ['premiers_pas', 'First steps', 'I. The Awakening', '€0'],
  ['jeune_pousse', 'Sprout', 'I. The Awakening', '€500'],
  ['sac_au_dos', 'Backpack', 'I. The Awakening', '€1,000'],
  ['boussole', 'Compass', 'I. The Awakening', '€2,000'],
  ['carte', 'World map', 'II. The Journey', '€3,000'],
  ['feu_de_camp', 'Campfire', 'II. The Journey', '€5,000'],
  ['monture', 'Steed', 'II. The Journey', '€7,500'],
  ['bouclier', 'Shield', 'II. The Journey', '€10,000'],
  ['epee', 'Sword', 'III. Knighthood', '€15,000'],
  ['forteresse', 'Fortress', 'III. Knighthood', '€20,000'],
  ['tresor', 'Treasure', 'III. Knighthood', '€30,000'],
  ['dragon', 'Dragon', 'III. Knighthood', '€50,000'],
  ['grand_large', 'Open sea', 'IV. The Conquest', '€75,000'],
  ['sommet', 'Summit', 'IV. The Conquest', '€100,000'],
  ['diamant', 'Diamond', 'IV. The Conquest', '€150,000'],
  ['couronne', 'Crown', 'IV. The Conquest', '€200,000'],
  ['decollage', 'Lift-off', 'V. The Stars', '€300,000'],
  ['orbite', 'Orbit', 'V. The Stars', '€500,000'],
  ['etoile_filante', 'Shooting star', 'V. The Stars', '€750,000'],
  ['legende', 'The 19 avatars in gold, ringed', 'Legend', '€1M to €1B'],
];
const COLS_AV = [1000, 3000, 2900, 2126];
const celluleAv = (k, contenu, fond, marge = 50) => new TableCell({
  width: { size: COLS_AV[k], type: WidthType.DXA },
  shading: { type: ShadingType.CLEAR, fill: fond },
  verticalAlign: VerticalAlign.CENTER,
  margins: { top: marge, bottom: marge, left: 120, right: 120 },
  children: [contenu],
});
const texteAv = (texte, opts = {}) => new Paragraph({ children: [new TextRun({ text: texte, size: 20, ...opts })] });
const iconeAv = (nom) => {
  const fichier = path.join(__dirname, '..', 'captures', 'avatars', `${nom}.png`);
  if (!fs.existsSync(fichier)) return new Paragraph({ children: [] });
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new ImageRun({ type: 'png', data: fs.readFileSync(fichier), transformation: { width: 24, height: 24 } })],
  });
};
children.push(new Table({
  columnWidths: COLS_AV,
  width: { size: CONTENT_W, type: WidthType.DXA },
  rows: [
    new TableRow({
      tableHeader: true,
      children: ['Avatar', 'Tier', 'Chapter', 'From'].map((h, k) =>
        celluleAv(k, texteAv(h, { bold: true, color: 'FFFFFF' }), VIOLET, 90)),
    }),
    ...AVATARS.map(([nom, palier, chapitre, seuil], idx) => new TableRow({
      cantSplit: true,
      children: [
        celluleAv(0, iconeAv(nom), idx % 2 ? 'F1F5F9' : 'FFFFFF'),
        celluleAv(1, texteAv(palier, { bold: true }), idx % 2 ? 'F1F5F9' : 'FFFFFF'),
        celluleAv(2, texteAv(chapitre), idx % 2 ? 'F1F5F9' : 'FFFFFF'),
        celluleAv(3, texteAv(seuil), idx % 2 ? 'F1F5F9' : 'FFFFFF'),
      ],
    })),
  ],
}));
children.push(gap());

children.push(p("Beyond one million begins the Legend: the nineteen avatars come back in gold, with a thin ring, from €1M to €1B (€1M, €1.5M, €2M, €3M, €5M, €7.5M, €10M… up to one billion). No avatar is gold before the million."));

// ── 16.6 ───────────────────────────────────────────────────────────────────
children.push(h2('16.6  Keyboard shortcuts and native menu'));

children.push(tableau(
  ['Menu', 'Items'],
  [
    ['File', 'New (Ctrl+N) · Save (Ctrl+S) · Export a backup… · Import a backup… · Recent files… · Settings · Quit'],
    ['Edit', 'Glossary'],
    ['View', 'Themes › Dark theme · Light theme — Languages › Français · English'],
    ['Help', "User manual"],
  ],
  [1800, 7226],
));
children.push(p("On macOS, shortcuts use ⌘ instead of Ctrl; “Quit” is in the Fructificare menu, and the Edit menu also offers Undo, Cut, Copy, Paste and Select All."));

children.push(gap(100));
children.push(bonASavoir([
  new TextRun({ text: "The manual opens from the application, offline. ", size: 21 }),
  new TextRun({ text: "The PDF you are reading is embedded in the program: “Help → User manual”. It opens in the display language — this English manual when Fructificare is in English, the French manual otherwise.", size: 21 }),
]));

// ── 16.7 ───────────────────────────────────────────────────────────────────
children.push(h2('16.7  What Fructificare does not do'));

children.push(bullet("fetch the balance of your accounts automatically — no bank connection, by design;"));
children.push(bullet('place orders, or recommend an investment to you;'));
children.push(bullet("replace a wealth management adviser or an accountant;"));
children.push(bullet('produce an official tax return — the amounts are estimates;'));
children.push(bullet('synchronize your data between several computers.'));

children.push(gap(120));
children.push(attention([
  new TextRun({ text: "Fructificare is an information tool. It gives no investment advice. The tax calculations follow the French rules in force in January 2026 and may change.", size: 21 }),
]));

module.exports = children;

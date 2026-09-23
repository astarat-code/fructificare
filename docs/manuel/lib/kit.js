// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * kit.js — formatting building blocks for the Fructificare manual.
 *
 * All styling lives here: palette, callout boxes, headings, screenshot placement.
 * Chapters only use these factories, never the docx API directly.
 */

const {
  Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
} = require('docx');
const fs = require('fs');
const path = require('path');

// ── Palette ────────────────────────────────────────────────────────────────
const AMBER   = 'EFAD24';   // accent Fructificare
const GREEN   = '059669';
const SLATE   = '1E293B';
const VIOLET  = '1F1943';   // violet foncé du thème sombre — en-têtes de tableaux
const GREY    = '64748B';
const BOX_BG  = 'F8FAFC';
const FIG_BG  = 'FEF6E4';
const WARN_BG = 'FEF3C7';
const NOTE_BG = 'EEF2F7';

const CONTENT_W = 9026;     // A4 - marges 1 pouce, en DXA

// ── Langue du manuel ───────────────────────────────────────────────────────
// MANUEL_LANG=en produit le manuel anglais : chapitres-en/, captures-en/ et les
// libellés des encadrés en anglais. Français par défaut.
const LANG = process.env.MANUEL_LANG === 'en' ? 'en' : 'fr';
const TXT = {
  fr: { bon: 'Bon à savoir', attention: 'Attention', redac: 'Note de rédaction — à trancher', aCapturer: 'À capturer : ', manquante: 'capture manquante : ' },
  en: { bon: 'Good to know', attention: 'Warning', redac: 'Editorial note — to decide', aCapturer: 'To capture: ', manquante: 'missing capture: ' },
}[LANG];

// ── Fabriques de blocs ─────────────────────────────────────────────────────

/** Paragraphe de corps de texte. */
const p = (text, opts = {}) => new Paragraph({
  spacing: { after: 140, line: 276 },
  ...opts,
  children: Array.isArray(text) ? text : [new TextRun({ text, size: 22 })],
});

/** Puce. */
const bullet = (children) => new Paragraph({
  numbering: { reference: 'puces', level: 0 },
  spacing: { after: 80, line: 276 },
  children: Array.isArray(children) ? children : [new TextRun({ text: children, size: 22 })],
});

/** Étape numérotée. `instance` isole la numérotation d'une procédure. */
const step = (children, instance) => new Paragraph({
  numbering: { reference: 'etapes', level: 0, instance },
  spacing: { after: 100, line: 276 },
  children: Array.isArray(children) ? children : [new TextRun({ text: children, size: 22 })],
});

/** Encadré générique — tableau une cellule, filet de couleur à gauche. */
function box(bg, accent, label, lines) {
  const kids = [];
  if (label) {
    kids.push(new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: label, bold: true, size: 20, color: accent, allCaps: true })],
    }));
  }
  lines.forEach((l, i) => kids.push(new Paragraph({
    spacing: { after: i === lines.length - 1 ? 0 : 80, line: 264 },
    children: Array.isArray(l) ? l : [new TextRun({ text: l, size: 21 })],
  })));

  return new Table({
    columnWidths: [CONTENT_W],
    width: { size: CONTENT_W, type: WidthType.DXA },
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 2, color: bg },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: bg },
      right:  { style: BorderStyle.SINGLE, size: 2, color: bg },
      left:   { style: BorderStyle.SINGLE, size: 18, color: accent },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical:   { style: BorderStyle.NONE },
    },
    rows: [new TableRow({ children: [new TableCell({
      width: { size: CONTENT_W, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: bg },
      margins: { top: 160, bottom: 160, left: 200, right: 200 },
      children: kids,
    })] })],
  });
}

const bonASavoir = (...lines) => box(BOX_BG, GREEN,  TXT.bon, lines);
const attention  = (...lines) => box(WARN_BG, 'B45309', TXT.attention,  lines);
const noteRedac  = (...lines) => box(NOTE_BG, GREY,   TXT.redac, lines);


// Dossier des captures (une série par langue).
const CAPTURES = path.join(__dirname, '..', LANG === 'en' ? 'captures-en' : 'captures');

// Largeur utile d'une page A4 avec des marges d'un pouce, en points.
const PAGE_W_PT = 451;
// Hauteur maximale d'une figure : au-delà, elle chasserait sa légende sur la page
// suivante. Une A4 offre environ 700 pt de hauteur utile.
const PAGE_H_PT = 560;
// Densité de référence des captures. Elle DOIT correspondre à celle du script de
// capture (captures-shoot.js, deviceScaleFactor 1,5) : c'est elle qui traduit les
// pixels en taille imprimée. La changer d'un côté sans l'autre déformerait la mise
// en page de toutes les figures.
const PPP = 225;

/**
 * Lit les dimensions d'un PNG dans son en-tête IHDR (octets 16 à 23).
 * Évite une dépendance de traitement d'image pour trois nombres.
 */
function dimensionsPng(fichier) {
  const tete = Buffer.alloc(24);
  const fd = fs.openSync(fichier, 'r');
  try { fs.readSync(fd, tete, 0, 24, 0); } finally { fs.closeSync(fd); }
  return { largeur: tete.readUInt32BE(16), hauteur: tete.readUInt32BE(20) };
}

/**
 * Taille d'affichage d'une capture, en points, RATIO PRÉSERVÉ.
 *
 * Les captures n'ont pas toutes le même format : page entière en paysage, fenêtre
 * modale en portrait, bandeau très large et plat, vue mobile étroite. Imposer une
 * taille unique les étirait — jusqu'à 260 % de déformation sur les bandeaux.
 *
 * On part donc de la taille naturelle à 150 ppp, puis on réduit — jamais on
 * n'agrandit — pour tenir dans la largeur et la hauteur utiles de la page.
 */
function tailleAffichage(fichier) {
  const { largeur, hauteur } = dimensionsPng(fichier);
  const wNat = (largeur * 72) / PPP;
  const hNat = (hauteur * 72) / PPP;
  const facteur = Math.min(PAGE_W_PT / wNat, PAGE_H_PT / hNat, 1);
  return { width: Math.round(wNat * facteur), height: Math.round(hNat * facteur) };
}

/**
 * Emplacement de capture d'écran — résolu automatiquement.
 *
 * Si `captures/fig-<num>.png` existe, la vraie capture est insérée à cet endroit.
 * Sinon, on rend un encadré décrivant ce qu'il reste à photographier : le manuel
 * se compile dans les deux cas, et signale lui-même ce qui manque.
 *
 * Les chapitres n'ont donc rien à changer quand une capture arrive : il suffit de
 * déposer le fichier au bon nom.
 *
 * @param {string} num    numéro de figure, ex. "4.3"
 * @param {string} titre  légende affichée sous l'image
 * @param {string} quoi   ce qu'il faut cadrer, si la capture manque encore
 */
const figure = (num, titre, quoi, sousTitres = []) => {
  const fichier = `fig-${num}.png`;
  if (fs.existsSync(path.join(CAPTURES, fichier))) return capture(fichier, num, titre);
  const parties = [];
  for (let k = 1; fs.existsSync(path.join(CAPTURES, `fig-${num}.${k}.png`)); k += 1) parties.push(`fig-${num}.${k}.png`);
  if (parties.length) return grille(parties, num, titre, sousTitres);
  return [box(FIG_BG, AMBER, null, [
    [new TextRun({ text: `FIGURE ${num}  —  ${titre}`, bold: true, size: 21, color: 'B45309' })],
    [new TextRun({ text: TXT.aCapturer, bold: true, size: 20 }),
     new TextRun({ text: quoi, size: 20, italics: true })],
  ])];
};

/**
 * Insère une capture d'écran, mise à l'échelle sans déformation (voir
 * tailleAffichage). Si le fichier manque, on retombe sur l'encadré `figure()` :
 * le manuel reste compilable et signale ce qui doit être photographié.
 *
 * @param {string} fichier  nom du PNG dans docs/manuel/captures
 * @param {string} num      numéro de figure, ex. "10.2"
 * @param {string} legende  légende affichée sous l'image
 */
function capture(fichier, num, legende) {
  const abs = path.join(CAPTURES, fichier);
  if (!fs.existsSync(abs)) {
    return [figure(num, legende, `${TXT.manquante}${fichier}`)];
  }
  const { width, height } = tailleAffichage(abs);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 60 },
      children: [new ImageRun({
        // `type` est obligatoire depuis docx 9 : sans lui, Word refuse d'ouvrir
        // le document (« Le fichier apparemment endommagé »).
        type: 'png',
        data: fs.readFileSync(abs),
        transformation: { width, height },
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 220 },
      children: [new TextRun({ text: `Figure ${num} — ${legende}`, size: 18, italics: true, color: GREY })],
    }),
  ];
}

/** Espace vertical court. */
const gap = (after = 160) => new Paragraph({ spacing: { after }, children: [] });

// ── Titres ─────────────────────────────────────────────────────────────────
const h1 = (text, pageBreak = true) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  pageBreakBefore: pageBreak,
  spacing: { before: 0, after: 240 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: AMBER, space: 8 } },
  children: [new TextRun({ text, bold: true, size: 40, color: SLATE })],
});

const h2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 360, after: 160 },
  children: [new TextRun({ text, bold: true, size: 28, color: GREEN })],
});

const h3 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  spacing: { before: 240, after: 120 },
  children: [new TextRun({ text, bold: true, size: 24, color: SLATE })],
});

// ── Raccourcis d'inline ────────────────────────────────────────────────────
const t  = (text) => new TextRun({ text, size: 22 });
const b  = (text) => new TextRun({ text, size: 22, bold: true });
const i  = (text) => new TextRun({ text, size: 22, italics: true });
const ui = (text) => new TextRun({ text, size: 22, bold: true, color: GREEN });   // libellé d'interface
const code = (text) => new TextRun({ text, size: 20, font: 'Consolas', color: 'B45309' });


// ── Tableau simple à en-tête sombre ────────────────────────────────────────
/**
 * @param {string[]} entetes
 * @param {string[][]} lignes
 * @param {number[]} largeurs  en DXA, somme = CONTENT_W
 * @param {number[]} [gras]    indices de colonnes à mettre en gras
 */
function tableau(entetes, lignes, largeurs, gras = [0]) {
  return new Table({
    columnWidths: largeurs,
    width: { size: CONTENT_W, type: WidthType.DXA },
    rows: [
      new TableRow({
        tableHeader: true,
        children: entetes.map((h, k) => new TableCell({
          width: { size: largeurs[k], type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: VIOLET },
          margins: { top: 90, bottom: 90, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: 'FFFFFF' })] })],
        })),
      }),
      ...lignes.map((r, idx) => new TableRow({
        children: r.map((cell, k) => new TableCell({
          width: { size: largeurs[k], type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: idx % 2 ? 'F1F5F9' : 'FFFFFF' },
          margins: { top: 70, bottom: 70, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20, bold: gras.includes(k) })] })],
        })),
      })),
    ],
  });
}

/**
 * Sous-figures côte à côte (fig-4.5.1.png, fig-4.5.2.png…), deux par ligne, dans un
 * tableau sans bordure. Chaque image garde son ratio et tient dans sa colonne ; une
 * sous-légende « 4.5.1 — … » accompagne chaque image quand `sousTitres` la fournit.
 */
function grille(fichiers, num, titre, sousTitres) {
  const COLS = fichiers.length === 1 ? 1 : 2;
  const lignes = Math.ceil(fichiers.length / COLS);
  const largeurCol = CONTENT_W / COLS;
  const maxW = PAGE_W_PT / COLS - 8;
  const maxH = Math.min(PAGE_H_PT / lignes, PAGE_H_PT * 0.75);
  const sans = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const bords = { top: sans, bottom: sans, left: sans, right: sans };
  const cellule = (f, k) => {
    if (!f) return new TableCell({ width: { size: largeurCol, type: WidthType.DXA }, borders: bords, children: [new Paragraph({ children: [] })] });
    const { largeur, hauteur } = dimensionsPng(path.join(CAPTURES, f));
    const wNat = (largeur * 72) / PPP;
    const hNat = (hauteur * 72) / PPP;
    const facteur = Math.min(maxW / wNat, maxH / hNat, 1);
    const enfants = [new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 40 },
      children: [new ImageRun({ type: 'png', data: fs.readFileSync(path.join(CAPTURES, f)), transformation: { width: Math.round(wNat * facteur), height: Math.round(hNat * facteur) } })],
    })];
    if (sousTitres[k]) {
      enfants.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: `${num}.${k + 1} — ${sousTitres[k]}`, size: 17, italics: true, color: GREY })],
      }));
    }
    return new TableCell({ width: { size: largeurCol, type: WidthType.DXA }, borders: bords, verticalAlign: 'center', children: enfants });
  };
  const rangees = [];
  for (let l = 0; l < lignes; l += 1) {
    rangees.push(new TableRow({ cantSplit: true, children: Array.from({ length: COLS }, (_, c) => cellule(fichiers[l * COLS + c], l * COLS + c)) }));
  }
  return [
    new Paragraph({ spacing: { before: 120 }, children: [] }),
    new Table({ columnWidths: Array(COLS).fill(largeurCol), width: { size: CONTENT_W, type: WidthType.DXA }, borders: { ...bords, insideHorizontal: sans, insideVertical: sans }, rows: rangees }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 220 },
      children: [new TextRun({ text: `Figure ${num} — ${titre}`, size: 18, italics: true, color: GREY })],
    }),
  ];
}

module.exports = {
  LANG, AMBER, GREEN, SLATE, VIOLET, GREY, BOX_BG, FIG_BG, WARN_BG, NOTE_BG, CONTENT_W,
  p, bullet, step, box, bonASavoir, attention, noteRedac, figure, capture, gap,
  h1, h2, h3, t, b, i, ui, code, tableau,
};

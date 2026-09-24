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
//  CHAPITRE 16
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1('16. Annexes'));

// ── 16.1 ───────────────────────────────────────────────────────────────────
children.push(h2('16.1  Les types d\'enveloppe et leur fiscalité'));

children.push(tableau(
  ['Type', 'Traitement à la sortie'],
  [
    ['PEA', "Flat tax 31,4 % ; exonération d'impôt sur le revenu après 5 ans (les prélèvements sociaux restent dus)"],
    ['CTO / Crypto', 'Flat tax 31,4 %'],
    ['Assurance vie < 8 ans', 'Flat tax 31,4 %'],
    ['Assurance vie ≥ 8 ans', "Abattement 4 600 € (9 200 € pour un couple), puis IR à 7,5 % jusqu'à 150 000 € de versements"],
    ['PER', 'Flat tax 31,4 %'],
    ['Compte réglementé', 'Exonéré ; exclu des calculs de performance'],
    ['Personnalisé', 'Aucun régime fiscal pré-calculé'],
  ],
  [2600, 6426],
));

children.push(p([
  i("Taux en vigueur : prélèvements sociaux 18,6 % · impôt sur le revenu 12,8 % · flat tax 31,4 % (janvier 2026). Plafond de versement PEA : 150 000 €."),
]));

// ── 16.2 ───────────────────────────────────────────────────────────────────
children.push(h2('16.2  Les types d\'actif'));
children.push(p("fonds euros · obligation · action · ETF · crypto · immobilier · SCPI · or · exotique · autre, auxquels s'ajoutent les types personnalisés que vous créez vous-même."));

// ── 16.3 ───────────────────────────────────────────────────────────────────
children.push(h2('16.3  Comment sont calculés les rendements'));

children.push(p([
  t("Fructificare utilise la "), b('méthode de Dietz modifiée'),
  t(". Elle répond à une difficulté simple : si vous versez 10 000 € le 30 décembre, cet argent n'a pas travaillé toute l'année, "),
  t("et il serait faux de le compter comme s'il avait été là depuis janvier."),
]));

children.push(p([
  t("Chaque versement et chaque retrait est donc "), b('pondéré par sa date'),
  t(" au sein de la période : un versement de début d'année compte presque pour son montant entier, un versement de fin d'année presque pour rien."),
]));

children.push(gap(120));
children.push(bonASavoir([
  new TextRun({ text: "Le rendement affiché peut différer de celui de votre banque. ", bold: true, size: 21 }),
  new TextRun({ text: "Les établissements utilisent parfois d'autres conventions de calcul.", size: 21 }),
]));

// ── 16.4 ───────────────────────────────────────────────────────────────────
children.push(h2('16.4  Le score de santé financière en détail'));

children.push(tableau(
  ['Composante', 'Points', 'Base de calcul'],
  [
    ['Diversification', '20', "Indice de concentration (Herfindahl-Hirschman) sur vos enveloppes et vos actifs"],
    ['Performance', '25', 'Rendement rapporté à une cible ajustée au risque et à votre âge'],
    ['Maîtrise des frais', '20', 'TER annuel pondéré, plus le ratio de frais déjà payés'],
    ['Résilience & inflation', '25', 'Exposition à un krach, pondérée par votre âge'],
    ['Liquidité', '10', 'Mois de revenu couverts par vos livrets réglementés'],
    ['Bonus', '5', 'Jeune et performant, ou sénior et résilient'],
  ],
  [2400, 900, 5726],
));

// ── 16.5 ───────────────────────────────────────────────────────────────────
children.push(h2("16.5  Les paliers d'avatar"));

children.push(p("Dix-neuf paliers de 0 € à 750 000 €, répartis en cinq chapitres et calculés sur votre capital total, livrets compris."));

// Icônes : captures/avatars/<palier>.png, produites par avatars-shoot.js.
const AVATARS = [
  ['premiers_pas', 'Premiers pas', "I. L'Éveil", '0 €'],
  ['jeune_pousse', 'Jeune pousse', "I. L'Éveil", '500 €'],
  ['sac_au_dos', 'Sac au dos', "I. L'Éveil", '1 000 €'],
  ['boussole', 'Boussole', "I. L'Éveil", '2 000 €'],
  ['carte', 'Carte du monde', 'II. Le Voyage', '3 000 €'],
  ['feu_de_camp', 'Feu de camp', 'II. Le Voyage', '5 000 €'],
  ['monture', 'Monture', 'II. Le Voyage', '7 500 €'],
  ['bouclier', 'Bouclier', 'II. Le Voyage', '10 000 €'],
  ['epee', 'Épée', 'III. La Chevalerie', '15 000 €'],
  ['forteresse', 'Forteresse', 'III. La Chevalerie', '20 000 €'],
  ['tresor', 'Trésor', 'III. La Chevalerie', '30 000 €'],
  ['dragon', 'Dragon', 'III. La Chevalerie', '50 000 €'],
  ['grand_large', 'Grand large', 'IV. La Conquête', '75 000 €'],
  ['sommet', 'Sommet', 'IV. La Conquête', '100 000 €'],
  ['diamant', 'Diamant', 'IV. La Conquête', '150 000 €'],
  ['couronne', 'Couronne', 'IV. La Conquête', '200 000 €'],
  ['decollage', 'Décollage', 'V. Les Étoiles', '300 000 €'],
  ['orbite', 'Orbite', 'V. Les Étoiles', '500 000 €'],
  ['etoile_filante', 'Étoile filante', 'V. Les Étoiles', '750 000 €'],
  ['legende', 'Les 19 avatars en or, cerclés', 'Légende', '1 M€ à 1 Md€'],
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
      children: ['Avatar', 'Palier', 'Chapitre', 'À partir de'].map((h, k) =>
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

children.push(p("Au-delà du million commence la Légende : les dix-neuf avatars reviennent en or, cerclés d'un liseré, de 1 M€ à 1 Md€ (1 M€, 1,5 M€, 2 M€, 3 M€, 5 M€, 7,5 M€, 10 M€… jusqu'au milliard). Aucun avatar n'est doré avant le million."));

// ── 16.6 ───────────────────────────────────────────────────────────────────
children.push(h2('16.6  Raccourcis clavier et menu natif'));

children.push(tableau(
  ['Menu', 'Éléments'],
  [
    ['Fichier', 'Nouveau (Ctrl+N) · Sauvegarder (Ctrl+S) · Exporter une sauvegarde… · Importer une sauvegarde… · Fichiers récents… · Paramètres · Quitter'],
    ['Éditer', 'Glossaire'],
    ['Affichage', 'Thèmes › Thème sombre · Thème clair — Langues › Français · English'],
    ['Aide', "Manuel d'utilisation"],
  ],
  [1800, 7226],
));
children.push(p("Sur macOS, les raccourcis utilisent ⌘ au lieu de Ctrl ; « Quitter » se trouve dans le menu Fructificare, et le menu Éditer propose aussi Annuler, Couper, Copier, Coller et Tout sélectionner."));

children.push(gap(100));
children.push(bonASavoir([
  new TextRun({ text: "Le manuel s'ouvre depuis l'application, hors ligne. ", size: 21 }),
  new TextRun({ text: "Le PDF que vous lisez est embarqué dans le programme : « Aide → Manuel d'utilisation ». Il s'ouvre dans la langue d'affichage — ce manuel en français, ou sa version anglaise quand Fructificare est en anglais.", size: 21 }),
]));

// ── 16.7 ───────────────────────────────────────────────────────────────────
children.push(h2('16.7  Ce que Fructificare ne fait pas'));

children.push(bullet("récupérer automatiquement le solde de vos comptes — aucune connexion bancaire, par choix ;"));
children.push(bullet('passer des ordres, ni vous recommander un placement ;'));
children.push(bullet("remplacer un conseiller en gestion de patrimoine ou un expert-comptable ;"));
children.push(bullet('produire une déclaration fiscale officielle — les montants sont des estimations ;'));
children.push(bullet('synchroniser vos données entre plusieurs ordinateurs.'));

children.push(gap(120));
children.push(attention([
  new TextRun({ text: "Fructificare est un outil informatif. Il ne délivre aucun conseil en investissement. Les calculs fiscaux suivent les règles françaises en vigueur en janvier 2026 et peuvent évoluer.", size: 21 }),
]));

module.exports = children;

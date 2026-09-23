// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
const {
  p, bullet, bonASavoir, figure, gap,
  h1, h2, h3, t, b, i, ui, tableau,
} = require('../lib/kit');
const { TextRun } = require('docx');

const children = [];

// ═══════════════════════════════════════════════════════════════════════════
//  CHAPITRE 15
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1('15. Glossaire'));

children.push(p([
  t("Fructificare embarque "),
  b('33 définitions'), t(", écrites pour être comprises sans connaissance préalable — accessibles depuis "), ui('Éditer > Glossaire'), t('.'),
]));

children.push(...figure('15.1', 'La page Glossaire',
  "la page complète, en pleine largeur"));

// ── 15.1 ───────────────────────────────────────────────────────────────────
children.push(h2('15.1  Le mode découverte'));

children.push(p([
  t("En haut de la page, un interrupteur commande le "), ui('mode découverte'), t(". Activé — c'est le réglage par défaut — "),
  t("les termes financiers sont "), b("cliquables dans toute l'application"), t(" : un clic ouvre une bulle qui explique le mot."),
]));

children.push(p([
  t("Désactivez-le pour obtenir une interface épurée. La page Glossaire, elle, reste accessible dans tous les cas."),
]));

children.push(gap(120));
children.push(bonASavoir([
  new TextRun({ text: "Le champ de recherche filtre à la fois les termes et leur définition. ", size: 21 }),
  new TextRun({ text: "Chercher « impôt » remonte donc aussi « Flat tax » et « Abattement », dont la définition contient le mot.", size: 21 }),
]));

// ── 15.2 ───────────────────────────────────────────────────────────────────
children.push(h2('15.2  Les définitions'));

children.push(h3('Les enveloppes'));
children.push(tableau(
  ['Terme', 'Définition'],
  [
    ['Enveloppe', "Un compte d'investissement réel : votre PEA, votre assurance vie, votre livret A."],
    ['PEA', "Plan d'Épargne en Actions : une enveloppe française pour investir en actions européennes."],
    ['CTO', 'Compte-Titres Ordinaire : un compte sans plafond ni restriction, mais sans avantage fiscal.'],
    ['Assurance vie', "Un contrat d'épargne souple, avec un avantage fiscal qui se déclenche après 8 ans."],
    ['Fonds en euros', "Le compartiment garanti d'une assurance vie : votre capital ne peut pas baisser."],
    ['Livret réglementé', "Livret A, LDDS, LEP : un taux fixé par l'État, des gains totalement exonérés d'impôt."],
  ],
  [2200, 6826],
));

children.push(h3('Les opérations'));
children.push(tableau(
  ['Terme', 'Définition'],
  [
    ['Mouvement', 'Un versement ou un retrait sur une enveloppe, à une date donnée.'],
    ['Calibration', "Saisir à la main la valeur réelle d'une enveloppe, relevée sur votre relevé bancaire."],
    ['Espèces', 'De l\'argent présent sur l\'enveloppe mais pas encore investi.'],
    ['Versements', "L'argent que vous avez déposé sur l'enveloppe (cumul de vos dépôts)."],
    ['Prix d\'achat moyen pondéré', 'Le prix moyen auquel vous avez acheté une ligne, en tenant compte des quantités.'],
  ],
  [2200, 6826],
));

children.push(h3('La performance'));
children.push(tableau(
  ['Terme', 'Définition'],
  [
    ['Plus-value', 'La différence entre ce que vaut votre placement et ce que vous y avez mis.'],
    ['PNL', "« Profit and Loss » : le gain ou la perte d'une ligne, en euros."],
    ['Coût total', 'Le capital réellement investi sur cette ligne : vos versements moins vos retraits, avant tout gain.'],
    ['Valeur actuelle', "Ce que vaut aujourd'hui votre ligne ou votre enveloppe, d'après la dernière calibration."],
    ['Rendement cible', "Le taux annuel que vous supposez pour projeter la croissance de l'enveloppe."],
    ['Rendement annuel', 'Ce que votre argent a rapporté sur une année, en pourcentage.'],
    ['Dietz modifiée', 'La méthode de calcul de rendement utilisée par Fructificare.'],
    ['TER', "« Total Expense Ratio » : le coût annuel total d'un placement, en pourcentage."],
  ],
  [2200, 6826],
));

children.push(h3('Les frais'));
children.push(tableau(
  ['Terme', 'Définition'],
  [
    ['Frais de gestion', 'Ce que votre assureur ou votre courtier prélève chaque année sur votre encours.'],
    ['Frais de versement', 'Une commission prélevée à chaque fois que vous investissez.'],
  ],
  [2200, 6826],
));

children.push(h3('La fiscalité'));
children.push(tableau(
  ['Terme', 'Définition'],
  [
    ['Fiscalité', "Les règles qui déterminent ce que l'État prélève sur vos gains."],
    ['Flat tax', 'Le prélèvement forfaitaire unique de 31,4 % sur les gains financiers.'],
    ['Prélèvements sociaux', "18,6 % prélevés sur vos gains, quelle que soit l'enveloppe."],
    ['Abattement', "Une part de vos gains qui échappe à l'impôt."],
    ['Rachat partiel', 'Retirer une partie de votre assurance vie sans fermer le contrat.'],
  ],
  [2200, 6826],
));

children.push(h3('Stratégie et long terme'));
children.push(tableau(
  ['Terme', 'Définition'],
  [
    ['Intérêts composés', 'Vos gains produisent eux-mêmes des gains, année après année.'],
    ['Règle 8-4-3', "Une façon de visualiser l'accélération des intérêts composés."],
    ['FIRE', "« Financial Independence, Retire Early » : vivre des revenus de son patrimoine."],
    ['Crossover Point', "Le moment où vos placements vous rapportent plus que vous n'y versez."],
    ['Diversification', 'Répartir son argent sur plusieurs placements pour limiter le risque.'],
    ['Inflation', "La hausse générale des prix, qui grignote la valeur de votre argent."],
    ['Stress test', 'Simuler un krach pour voir ce que deviendrait votre patrimoine.'],
  ],
  [2200, 6826],
));

module.exports = children;

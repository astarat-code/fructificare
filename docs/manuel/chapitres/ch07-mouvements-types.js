// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
const {
  p, bullet, step, bonASavoir, attention, noteRedac, figure, gap,
  h1, h2, h3, t, b, i, ui, code, tableau,
  GREEN, SLATE, GREY, AMBER, CONTENT_W,
} = require('../lib/kit');
const { Paragraph, TextRun, AlignmentType } = require('docx');

const children = [];

children.push(h1('7. Les mouvements types'));

children.push(p("Un mouvement type est un modèle de saisie. Il mémorise tout ce qui ne change pas d'un versement à l'autre — l'enveloppe, le support, les frais — pour qu'il ne reste à renseigner que la date et le montant."));

children.push(gap(120));
children.push(bonASavoir([
  new TextRun({ text: 'Un mouvement type ne déclenche rien tout seul. ', size: 21, bold: true }),
  new TextRun({ text: "Si vous cherchez un versement qui se fait automatiquement à chaque échéance, c'est avec le mouvement récurrent décrit dans le chapitre 8.", size: 21 }),
]));

// ── 7.1 ────────────────────────────────────────────────────────────────────
children.push(h2('7.1  Quand en créer un'));
children.push(p("Dès qu'un même investissement revient. Si vous versez tous les mois sur le même ETF, avec les mêmes frais de courtage et la même répartition, autant enregistrer ces informations répétitives une seule fois."));

// ── 7.2 ────────────────────────────────────────────────────────────────────
children.push(h2('7.2  Ouvrir le panneau'));
children.push(p([
  t("Depuis une fiche enveloppe, cliquez sur "), ui('Mouvements types'),
  t(", en haut de la carte de saisie. Le panneau s'ouvre."),
]));
children.push(gap(100));
children.push(...figure('7.1', 'Le panneau des mouvements types',
  "le panneau ouvert en mode liste, avec trois modèles teintés aux couleurs de leurs enveloppes et le bouton « Créer un modèle » en haut à droite."));

// ── 7.3 ────────────────────────────────────────────────────────────────────
children.push(h2('7.3  La liste'));
children.push(p("Chaque modèle occupe un bloc, à la couleur de l'enveloppe à laquelle il est rattaché. Y figurent son nom, son enveloppe, son type d'actif et le rappel de ses frais de versement et de ses frais annuels."));
children.push(p("Deux icônes à droite : le crayon pour modifier, la corbeille pour supprimer."));

children.push(gap(120));
children.push(bonASavoir("Supprimer un modèle ne supprime aucun mouvement déjà saisi. Vous perdez seulement le gabarit."));

// ── 7.4 ────────────────────────────────────────────────────────────────────
children.push(h2('7.4  Créer un modèle'));

children.push(step([t('Cliquez sur '), ui('Créer un modèle'), t('.')], 40));
children.push(step([t('Donnez-lui un '), b('nom'), t(" parlant — c'est celui que vous choisirez dans les menus déroulants. Le nom du support fait l'affaire : « ETF World », « Fonds euros », « SCPI Bureaux Europe ».")], 40));
children.push(step([t('Choisissez l\''), b('enveloppe'), t(' de rattachement.')], 40));
children.push(step([t('Sélectionnez le '), b("type d'actif"), t(", ou cochez "), ui("Types d'actifs multiples"), t(' pour une répartition en pourcentages.')], 40));
children.push(step([t('Renseignez les '), b('frais de versement/retrait'), t(' et les '), b('frais annuels'), t(', en pourcentages ou en euros.')], 40));
children.push(step([t('Validez avec '), ui('Créer le modèle'), t('.')], 40));

children.push(gap(100));
children.push(...figure('7.2', 'Le formulaire de création',
  "le formulaire complet et rempli, avec un type d'actif simple sélectionné et les deux champs de frais en mode pourcentage."));

children.push(gap(120));
children.push(attention("Les frais du modèle sont ceux qui seront pré-remplis à chaque usage. Vérifiez-les sur vos conditions tarifaires plutôt que de les estimer : c'est ce chiffre qui alimentera ensuite la tuile « Total frais » et le score de santé."));

// ── 7.5 ────────────────────────────────────────────────────────────────────
children.push(h2('7.5  Utiliser un modèle'));
children.push(p('Trois endroits font appel à vos modèles.'));

children.push(h3('À la saisie manuelle'));
children.push(p([
  t("Dans le formulaire d'ajout de mouvement (§ 5.4), le menu "), ui('Mouvements types'),
  t(" pré-remplit le type d'actif et les frais. Il ne reste qu'à saisir la date et le montant."),
]));

children.push(h3('Pour créer une série récurrente'));
children.push(p([
  t("Dans l'onglet de création d'un mouvement récurrent, le bouton "),
  ui('Importer un mouvement type'), t(" reprend les mêmes réglages (§ 8.2)."),
]));

children.push(h3('Comme position de calibration'));
children.push(p([
  t("C'est l'usage le moins évident et le plus utile. Quand une enveloppe a des modèles, l'option "),
  ui('Détailler par position'), t(" de la fenêtre de calibration (§ 6.3) propose "),
  b('un champ par modèle'),
  t(" plutôt qu'un champ par classe d'actif. Vous valorisez alors chaque ligne de votre contrat telle qu'elle apparaît sur votre relevé, avec rappel du nombre d'unités détenues."),
]));

children.push(gap(120));
children.push(bonASavoir([
  new TextRun({ text: "C'est la raison de fond de créer des modèles. ", size: 21, bold: true }),
  new TextRun({ text: "Sans eux, votre calibration détaillée se fait par grande classe d'actif — « actions », « fonds euros ». Avec eux, elle se fait ligne par ligne, et les rendements par actif (§ 5.8) deviennent réellement exploitables.", size: 21 }),
]));

module.exports = children;

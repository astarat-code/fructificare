// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
const {
  p, bullet, step, bonASavoir, attention, noteRedac, figure, gap,
  h1, h2, h3, t, b, i, ui, code, tableau,
  GREEN, SLATE, GREY, AMBER, CONTENT_W,
} = require('../lib/kit');
const { Paragraph, TextRun, AlignmentType } = require('docx');

const children = [];

children.push(h1('6. Calibrer ses enveloppes'));

// ── 6.1 ────────────────────────────────────────────────────────────────────
children.push(h2('6.1  Pourquoi calibrer'));
children.push(p("Fructificare ne se connecte à aucune banque. Il est donc nécessaire de calibrer vos enveloppes vous-même. Cela ne prend pas longtemps et il est conseillé de le faire au moins une fois par mois."));

children.push(p([b("Ce que la calibration permet :")]));
children.push(bullet('calculer la valeur totale actuelle de votre portefeuille et sa plus-value (§ 4.4) ;'));
children.push(bullet("dessiner les courbes d'évolution (§ 4.5, § 5.6), les rendements annualisés et les histogrammes annuels (§ 4.9, § 5.7) ;"));
children.push(bullet("estimer les plus-values du rapport fiscal (§ 11.2) ;"));
children.push(bullet('calculer le score de santé financière (§ 13.2) ;'));
children.push(bullet("définir l'avatar, qui suit votre capital réel (§ 13.1) ;"));
children.push(bullet('afficher la vue « valeur réelle » du camembert de répartition (§ 4.6).'));

children.push(gap(120));
children.push(attention([
  new TextRun({ text: "Tant qu'une enveloppe n'est pas calibrée, sa plus-value par défaut est nulle — y compris dans le rapport fiscal. ", size: 21, bold: true }),
  new TextRun({ text: "C'est la raison pour laquelle un rapport fiscal produit sur des enveloppes non calibrées n'affichera aucune imposition estimée.", size: 21 }),
]));

children.push(h3('À quel rythme ?'));
children.push(p([
  t("Une fois par mois suffit, et c'est le rythme que Fructificare vous suggère. Le bouton "),
  ui('Calibrer mes enveloppes'),
  t(" du tableau de bord passe en ambre clignotant dès qu'une enveloppe n'a jamais été calibrée, ou que sa dernière calibration remonte à plus de trente jours."),
]));
children.push(p("Un rappel « Calibration mensuelle » apparaît également dans votre calendrier (§ 9.2)."));

children.push(gap(120));
children.push(bonASavoir("Calibrez toujours à la même période du mois — à réception de vos relevés, par exemple. Des points régulièrement espacés donnent des courbes lisibles et des rendements comparables d'une période à l'autre."));

// ── 6.2 ────────────────────────────────────────────────────────────────────
children.push(h2('6.2  Saisir une calibration'));
children.push(p([
  t("Ouvrez la fenêtre depuis le tableau de bord — bouton "), ui('Calibrer mes enveloppes'),
  t(" — pour traiter toutes vos enveloppes d'un coup, ou depuis une fiche enveloppe pour n'en calibrer qu'une."),
]));
children.push(gap(100));
children.push(...figure('6.1', 'La fenêtre de calibration',
  "l'onglet « Nouvelle saisie » avec trois enveloppes visibles, chacune montrant sa dernière calibration, son badge de rendement réel et son champ de valeur totale."));

children.push(step([t('Vérifiez la '), b('date par défaut'), t(", en haut de la fenêtre. Elle s'applique à toutes les enveloppes.")], 30));
children.push(step([t('Pour chaque enveloppe, saisissez sa '), b('valeur totale'), t(' relevée sur votre compte.')], 30));
children.push(step([t('Si nécessaire, changez la '), b('date'), t(" de cette enveloppe seule dans le champ à droite — vos relevés n'arrivent pas tous le même jour.")], 30));
children.push(step([t('Cliquez sur le bouton '), ui('Calibrer'), t(" de la ligne. Le message « Calibration enregistrée » confirme l'enregistrement.")], 30));
children.push(step('Répétez pour les autres enveloppes, puis fermez la fenêtre.', 30));

children.push(p([
  t("En dessous de chaque ligne s'affichent la "), b('dernière calibration'),
  t(" connue avec sa date et son montant, et un badge de "), b('rendement réel'),
  t(" annualisé. Ils permettent de repérer rapidement une saisie aberrante."),
]));

// ── 6.3 ────────────────────────────────────────────────────────────────────
children.push(h2('6.3  Détailler par position'));
children.push(p([
  t("Sous le champ de valeur totale, un lien "), ui('Détailler par position'),
  t(" ouvre la ventilation. Au lieu d'un seul chiffre, vous répartissez la valeur entre vos lignes."),
]));

children.push(p("Fructificare propose deux découpages, selon ce que vous avez saisi :"));
children.push(bullet([b('par mouvement type'), t(" — si vous en avez créé pour cette enveloppe (chapitre 7), chacun devient une position à valoriser, avec rappel du nombre d'unités détenues ;")]));
children.push(bullet([b("par type d'actif"), t(" — sinon, une ligne par classe d'actif présente dans l'enveloppe.")]));

children.push(p([
  t('Un contrôle de cohérence vérifie en direct que la somme des positions égale bien le total. Tant que ce n\'est pas le cas, un avertissement ambre vous signale l\'écart.'),
]));
children.push(gap(100));
children.push(...figure('6.2', 'La ventilation par position',
  "une enveloppe dépliée avec quatre positions valorisées et le contrôle de cohérence affichant « Somme : … — cohérente » en vert."));

children.push(gap(120));
children.push(attention([
  new TextRun({ text: 'Prenez cette habitude dès votre première calibration. ', size: 21, bold: true }),
  new TextRun({ text: "La ventilation par position est la seule chose qui débloque la section « Rendements par actif » de la fiche enveloppe (§ 5.8). Sans elle, vous n'aurez jamais le détail de performance ligne par ligne — seulement un chiffre global. Une calibration de valeur totale ne peut pas être « détaillée » après coup : il faut la modifier ou en saisir une nouvelle.", size: 21 }),
]));

children.push(h3('Niveau 1 ou niveau 2 ?'));
children.push(tableau(
  ['', 'Niveau 1 — valeur totale', 'Niveau 2 — détaillée'],
  [
    ['Temps de saisie',        'Une ligne',                 'Une ligne par position'],
    ['Valeur du portefeuille', 'Oui',                       'Oui'],
    ['Courbes et rendements',  'Oui',                       'Oui'],
    ['Estimation fiscale',     'Oui',                       'Oui'],
    ['Rendements par actif',   'Non',                       'Oui'],
    ['Prix de revient par ligne', 'Non',                    'Oui'],
  ],
  [3026, 3000, 3000],
));

children.push(gap(160));
children.push(p("En clair : le niveau 1 suffit pour piloter votre patrimoine globalement. Le niveau 2 est nécessaire dès que vous voulez savoir laquelle de vos lignes tire la performance vers le haut ou vers le bas."));

// ── 6.4 ────────────────────────────────────────────────────────────────────
children.push(h2("6.4  L'historique des calibrations"));
children.push(p([
  t("Le second onglet, "), ui('Historique'),
  t(", liste toutes vos calibrations, la plus récente en tête. Chaque ligne prend la couleur de son enveloppe."),
]));

children.push(p('Un badge indique le niveau de détail :'));
children.push(bullet([b('Niv. 1'), t(' — valeur totale seule ;')]));
children.push(bullet([b('Niv. 2'), t(' — ventilée par position.')]));

children.push(p([
  t('Deux icônes closent chaque ligne. Le '), b('crayon'),
  t(" permet de modifier la ligne. La "),
  b('corbeille'), t(' supprime la calibration, après une confirmation.'),
]));
children.push(gap(100));
children.push(...figure('6.3', "L'historique des calibrations",
  "l'onglet Historique avec cinq ou six entrées teintées aux couleurs de leurs enveloppes, mêlant badges Niv. 1 et Niv. 2, et une confirmation de suppression ouverte sur une ligne."));

children.push(gap(120));
children.push(bonASavoir("Supprimer une calibration ne supprime aucun mouvement. Vous ne perdez que le point de valorisation : les courbes se recalculent sans lui, en interpolant entre les points restants."));

// ── 6.5 ────────────────────────────────────────────────────────────────────
children.push(h2('6.5  Calibrer une seule enveloppe'));
children.push(p([
  t("Depuis une fiche enveloppe, le bouton "), ui('Calibrer'),
  t(" — à côté du titre « Rendement annuel » (§ 5.7) — ouvre la même fenêtre, mais "),
  b('focalisée'),
  t(" : seule l'enveloppe en cours est modifiable, les autres apparaissent grisées. Cela évite les saisies dans la mauvaise ligne quand on gère une dizaine de comptes."),
]));

module.exports = children;

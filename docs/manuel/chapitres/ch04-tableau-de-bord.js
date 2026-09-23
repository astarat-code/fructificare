// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
const {
  p, bullet, step, bonASavoir, attention, noteRedac, figure, gap,
  h1, h2, h3, t, b, i, ui, code, tableau,
  GREEN, SLATE, GREY, AMBER, CONTENT_W,
} = require('../lib/kit');
const { Paragraph, TextRun, AlignmentType } = require('docx');

const children = [];

children.push(h1('4. Le tableau de bord'));

children.push(p("C'est la page d'accueil de Fructificare qui vous montre où en est votre patrimoine actuel."));
children.push(gap(100));
children.push(...figure('4.1', 'Le tableau de bord',
  "la page complète, en pleine largeur"));

// ── 4.1 ────────────────────────────────────────────────────────────────────
children.push(h2('4.1  Les bandeaux de progression'));
children.push(p("En haut de la page, deux bandeaux repliables accompagnent vos débuts."));
children.push(bullet([b('Tutoriel'), t(" — la mission en cours et votre avancement sur les quatorze quêtes (§ 1.7). Il disparaît définitivement une fois le parcours terminé.")]));
children.push(bullet([b('Défi du mois'), t(" — la mission mensuelle et le nombre de jours restants pour la valider (§ 13.5).")]));
children.push(p("Un clic sur la bande replie ou déplie la section."));
children.push(gap(120));
children.push(bonASavoir([
  new TextRun({ text: 'Ces deux bandeaux vous encombrent ? Désactivez ', size: 21 }),
  new TextRun({ text: 'Afficher la progression', size: 21, bold: true, color: GREEN }),
  new TextRun({ text: ' dans les Paramètres (§ 14.2).', size: 21 }),
]));

// ── 4.2 ────────────────────────────────────────────────────────────────────
children.push(h2("4.2  La barre d'actions"));
children.push(p('Trois boutons, en haut à droite du titre.'));

children.push(h3('Calibrer mes enveloppes'));
children.push(p([
  t("Ouvre la fenêtre de saisie des valeurs réelles (chapitre 6). Le bouton devient "),
  b('ambre et clignotant'),
  t(" quand une calibration est en retard, c'est-à-dire lorsqu'une de vos enveloppes n'a jamais été calibrée ou que sa dernière calibration remonte à plus de trente jours."),
]));

children.push(h3('Mouvements récurrents'));
children.push(p([
  t("Ouvre le panneau des versements et retraits programmés (chapitre 8). Le nombre affiché à droite du libellé est celui des séries "),
  b('actives'), t('.'),
]));

children.push(h3('Créer une enveloppe'));
children.push(p('Décrit au § 4.3 ci-dessous.'));

children.push(p([
  t("À gauche, à côté du titre de la page, une "), b('flamme'),
  t(" affiche votre série de connexion : le nombre de jours consécutifs d'ouverture de l'application (§ 13.5)."),
]));

// ── 4.3 ────────────────────────────────────────────────────────────────────
children.push(h2('4.3  Créer une enveloppe'));
children.push(p("Une enveloppe représente un compte réel : votre PEA chez tel courtier, votre contrat d'assurance vie, votre livret A. Créez-en autant que vous en détenez."));

children.push(step([t('Cliquez sur '), ui('Créer une enveloppe'), t('.')], 10));
children.push(step([t('Donnez-lui un '), b('nom'), t(" reconnaissable — le nom de l'établissement fait très bien l'affaire.")], 10));
children.push(step([t('Choisissez une '), b('couleur'), t(". Fructificare vous propose une teinte encore inutilisée. Cette couleur suivra l'enveloppe partout : lignes de tableau, courbes, camemberts, calendrier.")], 10));
children.push(step([t('Sélectionnez le '), b('type'), t(". Il détermine la fiscalité appliquée et les repères d'ancienneté.")], 10));
children.push(step([t("Renseignez la "), b("date d'ouverture du contrat"), t(".")], 10));
children.push(step([t('Ajustez les '), b('frais annuels'), t(' et le '), b('rendement cible'), t(' si vous les connaissez.')], 10));
children.push(step([t('Validez avec '), ui('Créer'), t('.')], 10));

children.push(gap(100));
children.push(...figure('4.2', "La fenêtre de création d'enveloppe",
  "la fenêtre modale complète, type « Assurance vie » sélectionné, tous les champs renseignés, avec le sélecteur de couleur bien visible."));

children.push(h3("Les six types d'enveloppe"));
children.push(tableau(
  ['Type', 'Pour quoi', 'Fiscalité'],
  [
    ['PEA',                 "Actions et ETF européens",              "Exonéré d'IR après 5 ans"],
    ['CTO',                 'Compte-titres ordinaire, crypto',       'Flat tax 31,4 %'],
    ['Assurance vie',       'Contrat multisupport',                  'Abattement après 8 ans'],
    ['PER',                 'Épargne retraite',                      'Flat tax 31,4 %'],
    ['Compte réglementé',   'Livret A, LDDS, LEP',                   'Exonéré'],
    ['Personnalisé',        'Tout le reste',                         'Aucun calcul automatique'],
  ],
  [2100, 3400, 3526],
));

children.push(gap(160));
children.push(p([
  t("Si vous choisissez "), b('Compte réglementé'),
  t(", un second menu apparaît pour préciser le livret (Livret A, LDDS, LEP ou autre). Ces enveloppes sont par défaut exclues du rapport fiscal et des calculs de performance mais ce paramètre peut être modifié par l'utilisateur."),
]));

children.push(h3("La date d'ouverture du contrat"));
children.push(p("Ce champ sert à trois choses :"));
children.push(bullet("appliquer le bon régime fiscal selon l'ancienneté (PEA de moins ou plus de 5 ans, assurance vie de moins ou plus de 8 ans) ;"));
children.push(bullet("afficher l'indicateur de maturité fiscale sur la liste des enveloppes (§ 4.7) ;"));
children.push(bullet("créer automatiquement un événement d'anniversaire dans votre calendrier (§ 9.2)."));
children.push(p("Il borne aussi les dates de saisie : vous ne pourrez pas enregistrer un mouvement antérieur à l'ouverture du contrat."));

children.push(h3('Frais annuels et rendement cible'));
children.push(p([
  t("Les "), b('frais annuels'),
  t(" se saisissent au choix en pourcentage de l'encours ou en euros fixes par an — basculez avec les boutons "),
  ui('%'), t(' et '), ui('€'), t(". C'est le TER de votre contrat, indiqué dans les conditions générales."),
]));
children.push(p([
  t("Le "), b('rendement cible annuel'),
  t(" sert de référence aux projections et à la courbe pointillée de la fiche enveloppe (§ 5.6). Laissé vide, il est complété par défaut selon le type :"),
]));
children.push(bullet('PEA et CTO : 8 % ;'));
children.push(bullet('assurance vie et PER : 4 % ;'));
children.push(bullet('compte réglementé : 2,4 % ;'));
children.push(bullet('personnalisé : 0 %.'));

children.push(gap(120));
children.push(attention("Renseignez les frais dès la création, même approximativement. C'est le seul moyen d'obtenir plus tard une comparaison honnête entre vos contrats — et l'écart sur vingt ans est rarement anecdotique (§ 2.5)."));

children.push(h3('Inclure dans mon rapport fiscal'));
children.push(p("Cochée par défaut, sauf pour les comptes réglementés. Décochez-la pour une enveloppe que vous suivez à titre indicatif et qui n'a rien à faire dans votre déclaration."));

// ── 4.4 ────────────────────────────────────────────────────────────────────
children.push(h2('4.4  Les tuiles de synthèse'));
children.push(p("Quatre chiffres résument votre situation. Ils occupent le haut de la page, juste sous la barre d'actions."));
children.push(gap(100));
children.push(...figure('4.3', 'Les tuiles de synthèse',
  "la rangée de tuiles en pleine largeur : Valeur totale, Mouvements, Total frais et Espèces, sur un portefeuille calibré affichant une plus-value positive."));

children.push(h3('Valeur totale'));
children.push(p("La valeur actuelle de votre portefeuille, d'après vos dernières calibrations. Sous le montant :"));
children.push(bullet("la plus ou moins-value totale, en euros et en pourcentage ;"));
children.push(bullet([t("le "), b('rendement annualisé depuis l\'origine'), t(", calculé selon la méthode de Dietz modifiée (§ 16.3) ;")]));
children.push(bullet("le total des livrets réglementés, sur une ligne séparée."));
children.push(gap(120));
children.push(bonASavoir("Les livrets réglementés sont par défaut exclus de la valeur totale et du calcul de performance. Leur rendement est administré et leur inclusion fausserait la lecture de vos placements à risque. Ils apparaissent donc à part, en dessous, mais ce paramètre peut être modifié par l'utilisateur."));

children.push(h3('Mouvements'));
children.push(p("Le total de ce que vous avez versé, de ce que vous avez retiré, et le solde net des deux. Les livrets réglementés en sont également exclus, et signalés sur une ligne dédiée."));

children.push(h3('Total frais'));
children.push(p([
  t("Le cumul de tous vos frais depuis l'origine : frais de versement, frais de retrait et frais annuels de gestion accumulés. Cliquez sur la tuile pour ouvrir le "),
  b('détail par enveloppe'), t('.'),
]));
children.push(gap(100));
children.push(...figure('4.4', 'Le détail des frais par enveloppe',
  "la fenêtre « Détail des frais par enveloppe » ouverte, montrant trois ou quatre enveloppes teintées avec la ventilation frais annuels / frais de mouvement / total."));

children.push(h3('Espèces'));
children.push(p("La somme des liquidités dormant dans vos enveloppes : de l'argent disponible sur le compte, issu d'une vente que vous avez choisi de conserver sur place, mais pas encore réinvesti (§ 5.5)."));
children.push(p([
  t("Comme la tuile des frais, elle est cliquable — une petite flèche l'indique. Elle ouvre le "),
  b('détail des espèces par enveloppe'),
  t(" : chaque enveloppe qui détient des liquidités, avec son montant, de la plus grosse à la plus petite, et le total général."),
]));

// ── 4.5 ────────────────────────────────────────────────────────────────────
children.push(h2('4.5  Évolution des enveloppes'));
children.push(p("Le premier graphique retrace la valeur de votre portefeuille dans le temps. Il n'apparaît qu'à partir de deux points de calibration."));
children.push(p('Deux lectures sont proposées, via le bouton de bascule en haut à droite.'));

children.push(bullet([b('Vue synthétique'), t(" — la valeur totale calibrée, les versements nets, et entre les deux une bande colorée qui matérialise le gain (vert) ou la perte (rouge).")]));
children.push(bullet([b('Vue détaillée'), t(" — une courbe par enveloppe, à sa propre couleur.")]));

children.push(p("Les points marqués sur les courbes correspondent aux mois où vous avez réellement calibré. Entre deux points, la valeur est interpolée."));
children.push(gap(100));
children.push(...figure('4.5', "Les deux vues du graphique d'évolution",
  "deux captures du même graphique : à gauche la vue synthétique avec sa bande de gain colorée, à droite la vue détaillée avec une courbe par enveloppe.", ["Vue synthétique", "Vue détaillée"]));

// ── 4.6 ────────────────────────────────────────────────────────────────────
children.push(h2('4.6  La répartition'));
children.push(p("Le camembert répond à la question de la diversification : où est concentré mon argent ?"));

children.push(h3('Par enveloppe ou par type d’actif'));
children.push(p("La vue par défaut montre la part de chaque compte, la seconde celle de chaque classe d'actif — fonds euros, obligations, actions, ETF, crypto, immobilier, SCPI, or, exotique. C'est la seconde qui compte pour juger d'un risque de concentration."));

children.push(h3('Versements ou valeur réelle'));
children.push(p([
  t("Par défaut, le camembert répartit vos "), b('versements'),
  t(". Basculez sur "), b('valeur réelle'),
  t(" pour raisonner sur les montants calibrés : c'est plus juste, puisque vos lignes n'ont pas toutes progressé au même rythme."),
]));
children.push(p("Cette bascule reste inactive tant qu'aucune calibration n'existe."));
children.push(gap(100));
children.push(...figure('4.6', 'Le camembert et ses deux bascules',
  "le camembert en vue « par type d'actif » et « valeur réelle », avec les deux interrupteurs bien lisibles en haut à droite de la carte.", ["Par enveloppe, versements", "Par enveloppe, valeur réelle", "Par actif, versements", "Par actif, valeur réelle"]));

// ── 4.7 ────────────────────────────────────────────────────────────────────
children.push(h2('4.7  La liste des enveloppes'));
children.push(p("Le tableau récapitulatif, à droite du camembert. Chaque ligne prend la couleur de son enveloppe ; un clic sur la ligne ouvre la fiche détaillée (chapitre 5)."));

children.push(tableau(
  ['Colonne', 'Ce qu’elle contient'],
  [
    ['Nom',        "Le nom de l'enveloppe, et pour un livret son sous-type"],
    ['Type',       "PEA, CTO, assurance vie…"],
    ['Solde',      "La dernière valeur calibrée, avec la plus-value en pourcentage"],
    ['Versements', "Le total versé depuis l'origine"],
  ],
  [2400, 6626],
));

children.push(gap(160));
children.push(p([
  t("Tant qu'une enveloppe n'est pas calibrée, la colonne "), b('Solde'),
  t(" affiche simplement le cumul de vos versements et la plus-value reste vide — Fructificare ne connaît pas encore sa valeur réelle."),
]));

children.push(h3("L'indicateur de maturité fiscale"));
children.push(p([
  t("Un "), b('liseré vert'), t(" à gauche de la ligne et une "), b('pastille bouclier'),
  t(" à côté du nom signalent une enveloppe assez ancienne pour bénéficier de sa fiscalité avantageuse : plus de cinq ans pour un PEA, plus de huit ans pour une assurance vie."),
]));
children.push(p("Survolez la pastille pour lire l'avantage exact. Une légende rappelle la règle sous le tableau dès qu'au moins une enveloppe est concernée."));
children.push(gap(100));
children.push(...figure('4.7', 'La liste des enveloppes avec un indicateur de maturité',
  "le tableau des enveloppes avec au moins une ligne portant le liseré vert et la pastille bouclier, et la légende visible en dessous. Prévoir une seconde capture avec l'infobulle ouverte."));

// ── 4.8 ────────────────────────────────────────────────────────────────────
children.push(h2('4.8  L’épargne cumulée'));
children.push(p("Un histogramme empilé mois par mois : combien vous aviez investi, et dans quoi, à chaque étape. Il se lit comme l'accumulation de votre effort d'épargne."));
children.push(p("La même bascule enveloppes / actifs que le camembert s'applique. Sur un historique long, la zone défile horizontalement."));
children.push(gap(100));
children.push(...figure('4.8', "L'histogramme d'épargne cumulée",
  "le graphique en bâtonnets empilés sur au moins douze mois, en vue « par type d'actif », avec la légende en haut."));

// ── 4.9 ────────────────────────────────────────────────────────────────────
children.push(h2('4.9  Le rendement annuel'));
children.push(p("Le dernier graphique donne votre performance année civile par année civile, livrets réglementés exclus. L'année en cours est signalée comme un cumul à date : elle n'est pas comparable aux années complètes."));
children.push(p("Survolez le titre pour lire la note méthodologique sur le calcul de Dietz modifiée."));
children.push(gap(100));
children.push(...figure('4.9', "L'histogramme de rendement annuel",
  "le graphique sur trois ou quatre années, avec au moins une année négative pour montrer le code couleur, et l'année en cours marquée comme cumul à date."));

children.push(gap(140));
children.push(attention([
  new TextRun({ text: "Le rendement affiché peut différer de celui de votre banque. Fructificare pondère chaque versement par sa date au sein de la période ; les établissements retiennent parfois d'autres conventions.", size: 21 }),
]));

module.exports = children;

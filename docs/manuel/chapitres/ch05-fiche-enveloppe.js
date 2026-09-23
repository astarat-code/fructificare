// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
const {
  p, bullet, step, bonASavoir, attention, noteRedac, figure, gap,
  h1, h2, h3, t, b, i, ui, code, tableau,
  GREEN, SLATE, GREY, AMBER, CONTENT_W,
} = require('../lib/kit');
const { Paragraph, TextRun, AlignmentType } = require('docx');

const children = [];

children.push(h1('5. La fiche enveloppe'));

children.push(p("Un clic sur une ligne du tableau de bord ouvre la fiche d'une enveloppe. C'est ici que se fait l'essentiel du travail : saisir les mouvements, lire la performance, comprendre d'où viennent les frais."));
children.push(gap(100));
children.push(...figure('5.1', "La fiche d'une enveloppe",
  "la page complète, en pleine largeur"));

// ── 5.1 ────────────────────────────────────────────────────────────────────
children.push(h2("5.1  L'en-tête"));
children.push(p("Un bandeau à la couleur de l'enveloppe, avec son nom et son type."));
children.push(p([
  t('Deux icônes à droite du nom : le '), b('crayon'), t(" pour modifier l'enveloppe, la "),
  b('corbeille'), t(' pour la supprimer (§ 5.11).'),
]));
children.push(p("Sous le nom, une ligne de rappel affiche le rendement cible et les frais annuels."));
children.push(p([
  t("Pour un "), b('PEA'),
  t(", cette ligne suit aussi le plafond de versement de 150 000 € : le total déjà versé, le plafond, et la part utilisée — par exemple « Versements : 75 000,00 € / 150 000 €, soit 50 % du plafond ». "),
  t("Ne compte que l'argent apporté de l'extérieur, frais inclus : un achat payé avec les espèces de l'enveloppe ne consomme pas de plafond, et un retrait n'en libère pas. "),
  t("Un versement qui dépasserait le plafond est refusé, avec le montant encore disponible."),
]));

// ── 5.2 ────────────────────────────────────────────────────────────────────
children.push(h2('5.2  Les quatre tuiles'));
children.push(tableau(
  ['Tuile', 'Ce qu’elle affiche'],
  [
    ['Rendements',   "Valeur actuelle, coût total et plus-value, en euros et en pourcentage"],
    ['Versements',   "Le capital net en place, avec en dessous le total versé et le total vendu"],
    ['Total frais',  'Cumul des frais de mouvement et des frais annuels'],
    ['Espèces',      "Liquidités disponibles dans l'enveloppe"],
  ],
  [2400, 6626],
));

children.push(gap(160));
children.push(p([
  t("La première tuile n'affiche les "), b('Rendements'),
  t(" qu'à partir d'une calibration. Sans elle, elle n'affiche que le simple solde des versements."),
]));

// ── 5.3 ────────────────────────────────────────────────────────────────────
children.push(h2("5.3  Les documents de l'enveloppe"));
children.push(p([
  t("Sous les tuiles, un encadré "), ui('Documents'),
  t(" indique le nombre de PDF rattachés à l'enveloppe — relevés de compte, avis d'opéré, IFU. Un clic ouvre la liste de ces documents : vous pouvez en "),
  b('ajouter'), t(" un, l'"), b('ouvrir'), t(", "), b('modifier'), t(" sa fiche ou le "), b('supprimer'),
  t(", sans quitter la fiche enveloppe."),
]));
children.push(p([
  t("Un document ajouté ici est automatiquement lié à l'enveloppe. Il apparaît aussi sur la page "), ui('Documents'),
  t(", qui rassemble tous vos documents, et où le détail de l'import est décrit (chapitre 12)."),
]));

// ── 5.4 ────────────────────────────────────────────────────────────────────
children.push(h2('5.4  Ajouter un mouvement'));
children.push(p("Le formulaire occupe le haut de la page. Il sert aussi bien aux versements qu'aux retraits : c'est le bouton final qui décide."));

children.push(step([t('Choisissez la '), b('date'), t(". Elle ne peut pas être antérieure à l'ouverture du contrat, ni postérieure à aujourd'hui.")], 20));
children.push(step([t('Saisissez le '), b('montant'), t(' brut.')], 20));
children.push(step([t('Renseignez les '), b('frais de transaction'), t(" prélevés par votre courtier, en pourcentage ou en euros.")], 20));
children.push(step([t('Ajoutez les '), b('frais annuels'), t(" propres à cette ligne, si elle en supporte de spécifiques.")], 20));
children.push(step([t("Sélectionnez le "), b("type d'actif"), t('.')], 20));
children.push(step([t('Complétez éventuellement la '), b('note'), t(", la "), b('quantité'), t(' et le '), b('prix unitaire'), t('.')], 20));
children.push(step([t('Cliquez sur '), ui('Achat'), t(' pour un versement ou '), ui('Vente'), t(' pour un retrait.')], 20));

children.push(gap(100));
children.push(...figure('5.2', "Le formulaire d'ajout de mouvement",
  "le formulaire complet et rempli, avec l'aperçu des frais visible en dessous et les deux boutons Versement / Retrait."));

children.push(h3("Les types d'actif"));
children.push(p("Dix catégories sont proposées : fonds euros, obligation, action, ETF, crypto, immobilier, SCPI, or, exotique, et « autre ». La même liste se retrouve dans tous les formulaires : mouvement, mouvement type, mouvement récurrent et répartition multi-actifs."));
children.push(p([
  t('Choisir '), b('autre'),
  t(" fait apparaître un champ libre. Le nom que vous y saisissez devient un "),
  b("type d'actif personnalisé réutilisable"),
  t(" : il figurera dans la liste lors de vos prochaines saisies."),
]));

children.push(h3('Un mouvement, plusieurs actifs'));
children.push(p([
  t("Un versement sur une assurance vie se répartit rarement sur un seul support. Cochez "),
  ui("Types d'actifs multiples"), t(', puis '), ui('Configurer'),
  t(" pour ventiler le montant en pourcentages. Le total doit faire exactement 100 % ; l'application vous le rappelle en temps réel."),
]));
children.push(gap(100));
children.push(...figure('5.3', 'La répartition multi-actifs',
  "la fenêtre de répartition, trois types cochés avec leurs pourcentages, et le total « 100 % ✓ » affiché en vert."));

children.push(h3('Quantité et prix unitaire'));
children.push(p([
  t("Deux champs facultatifs, utiles pour les titres cotés. Renseignez-en deux et le troisième se calcule : saisir 10 unités à 145,30 € remplit automatiquement le montant à 1 453 €."),
]));
children.push(p("Ces valeurs alimentent le prix d'achat moyen pondéré du tableau « Totaux par note » (§ 5.9) et le calcul des rendements par actif (§ 5.8)."));

children.push(h3('La note'));
children.push(p([
  t("Fructificare "), b('regroupe'),
  t(" tous les mouvements portant la même note et en calcule les totaux (§ 5.9). Utilisez-la pour suivre une ligne précise dans le temps — le nom d'un ETF, d'une SCPI, d'un titre."),
]));
children.push(gap(120));
children.push(bonASavoir("Restez rigoureux sur l'orthographe de vos notes : « ETF World » et « ETF world » formeront deux groupes distincts."));

children.push(h3('Les aperçus'));
children.push(p("Deux encadrés apparaissent au fil de la saisie :"));
children.push(bullet("l'aperçu des frais, qui affiche le montant prélevé et le net effectivement investi ;"));
children.push(bullet("l'aperçu de la poche espèces, qui indique quelle part de l'achat sera financée par vos liquidités existantes et quelle part par un apport nouveau."));

children.push(h3('Les deux panneaux voisins'));
children.push(p("En haut de la carte, deux boutons ouvrent des outils indépendants :"));
children.push(bullet([ui('Mouvements types'), t(" — vos modèles de saisie réutilisables (chapitre 7) ;")]));
children.push(bullet([ui('Mouvements récurrents'), t(" — vos versements et retraits programmés (chapitre 8).")]));
children.push(gap(120));
children.push(bonASavoir([
  new TextRun({ text: 'Ces deux notions sont indépendantes. ', size: 21, bold: true }),
  new TextRun({ text: "Un mouvement type vous fait gagner du temps à la saisie manuelle ; un mouvement récurrent agit tout seul à chaque échéance. Vous pouvez utiliser l'un, l'autre, ou les deux ensemble.", size: 21 }),
]));

// ── 5.5 ────────────────────────────────────────────────────────────────────
children.push(h2('5.5  La question du retrait'));
children.push(p("Quand vous cliquez sur Vente, Fructificare pose une question avant d'enregistrer : où va l'argent ?"));
children.push(gap(100));
children.push(...figure('5.4', 'La fenêtre de confirmation de retrait',
  "la fenêtre avec ses deux options — « Conserver en espèces » en bleu et « Ne pas conserver » en rouge — et leurs descriptions."));

children.push(bullet([
  b('Conserver en espèces'),
  t(" — l'argent reste dans l'enveloppe, disponible pour un futur achat. Il alimente la poche espèces et sera automatiquement mobilisé lors de votre prochain versement. C'est le cas d'un arbitrage : vous vendez une ligne pour en acheter une autre."),
]));
children.push(bullet([
  b('Ne pas conserver'),
  t(" — l'argent quitte l'enveloppe pour de bon. C'est un rachat, et c'est souvent ce cas qui déclenche une imposition (chapitre 11)."),
]));

children.push(gap(120));
children.push(attention("Le choix a des conséquences fiscales. Sur un PEA, un PER ou une assurance vie, seul l'argent qui sort de l'enveloppe est imposable : un arbitrage conservé en espèces ne l'est pas. Sur un compte-titres, et pour toute vente de crypto contre des euros, la vente est imposable même si l'argent reste en espèces (§ 11.2)."));

// ── 5.6 ────────────────────────────────────────────────────────────────────
children.push(h2("5.6  La courbe d'évolution"));
children.push(p("Le graphique central de la fiche. Il superpose ce que vous avez versé et ce que l'enveloppe vaut réellement."));

children.push(p([
  t('Un badge affiche le '), b("rendement réel depuis l'origine"),
  t(", calculé selon la méthode de Dietz modifiée : chaque versement est pondéré par sa date, de sorte qu'un apport récent ne fausse pas la performance annualisée."),
]));

children.push(h3('La courbe de rendement cible'));
children.push(p([
  t("Activez-la pour superposer une courbe en pointillés : la trajectoire qu'aurait suivie votre enveloppe si chaque versement avait effectivement rapporté le rendement cible défini à la création. L'écart entre les deux courbes est votre écart à l'objectif."),
]));

children.push(h3('Le tableau de données'));
children.push(p([
  t('Le bouton de bascule en haut à droite remplace le graphique par un tableau. Vous y lisez chaque calibration avec sa plus-value cumulée et son rendement de période. Les valeurs '),
  i('en italique'), t(" sont interpolées : elles correspondent à des mois que vous n'avez pas calibrés."),
]));
children.push(gap(100));
children.push(...figure('5.5', "La courbe d'évolution et son tableau",
  "deux captures : le graphique avec la courbe de rendement cible activée et une infobulle ouverte, puis le tableau de données montrant des lignes interpolées en italique.", ["La courbe avec le rendement cible et une infobulle", "Le tableau de données"]));

// ── 5.7 ────────────────────────────────────────────────────────────────────
children.push(h2('5.7  Le rendement annuel'));
children.push(p("Un histogramme année par année pour cette seule enveloppe. À côté du titre, un bouton Calibrer ouvre directement la fenêtre de calibration focalisée sur l'enveloppe en cours — les autres apparaissent grisées."));

// ── 5.8 ────────────────────────────────────────────────────────────────────
children.push(h2('5.8  Les rendements par actif'));

children.push(gap(60));
children.push(attention([
  new TextRun({ text: 'Cette section reste invisible tant que vous n’avez pas fait une calibration détaillée. ', size: 21, bold: true }),
  new TextRun({ text: "Elle a besoin de la ventilation par position que propose l'option « Détailler par position » (§ 6.3). Avec des calibrations de valeur totale seule, Fructificare ne sait pas répartir la performance entre vos actifs : les chiffres alimentent alors la tuile « Rendements » du haut de page, et rien ne s'affiche ici.", size: 21 }),
]));
children.push(gap(140));

children.push(p("Une tuile par actif, issue de votre dernière calibration détaillée :"));
children.push(bullet('la valeur actuelle de la ligne ;'));
children.push(bullet("son coût total, c'est-à-dire ce que vous y avez investi ;"));
children.push(bullet('sa plus-value en euros et en pourcentage.'));

children.push(p('Deux avertissements peuvent apparaître :'));
children.push(bullet([b('Calcul mixte'), t(" — certains mouvements de cet actif ont une quantité renseignée, d'autres non. Le coût de revient mélange alors deux méthodes et perd en précision.")]));
children.push(bullet([b('Actif sans mouvement'), t(" — vous avez calibré une ligne à laquelle aucun mouvement n'est rattaché. Fructificare affiche sa valeur mais refuse d'inventer une performance.")]));
children.push(gap(100));
children.push(...figure('5.6', 'Les rendements par actif',
  "la grille de tuiles, avec au moins trois actifs différents dont un portant l'avertissement « Calcul mixte » en ambre."));

// ── 5.9 ────────────────────────────────────────────────────────────────────
children.push(h2('5.9  Les totaux par note'));
children.push(p("Ce tableau regroupe tous les mouvements partageant la même note et en fait la synthèse. C'est l'outil de suivi d'une ligne précise."));

children.push(tableau(
  ['Colonne', 'Ce qu’elle donne'],
  [
    ['Total unités',  "La somme des quantités achetées"],
    ['PAM',           "Le prix d'achat moyen pondéré"],
    ['Total net',     "Le solde versements moins retraits"],
    ['Total frais',   'Les frais cumulés sur cette ligne'],
  ],
  [2400, 6626],
));

children.push(gap(160));
children.push(p([
  t("Le "), b("prix d'achat moyen pondéré"),
  t(" ne prend en compte que les mouvements disposant à la fois d'une quantité et d'un prix unitaire. Si certains en sont dépourvus, le total d'unités s'affiche en rouge avec un avertissement : le chiffre est partiel."),
]));
children.push(gap(100));
children.push(...figure('5.7', 'Les totaux par note',
  "le tableau avec deux ou trois notes différentes, dont une portant l'avertissement de total partiel en rouge."));

// ── 5.10 ────────────────────────────────────────────────────────────────────
children.push(h2('5.10  Le tableau des mouvements'));
children.push(p("L'historique complet, en bas de page. Chaque colonne est triable d'un clic sur son en-tête : date, type, type d'actif, montant brut, frais, frais annuels, montant net, note."));

children.push(p('Deux marqueurs peuvent accompagner une ligne :'));
children.push(bullet([b('Espèces'), t(" — un retrait conservé dans la poche de liquidités.")]));
children.push(bullet([b('🔄'), t(" — un mouvement généré automatiquement par une série récurrente (chapitre 8). Sa note apparaît en italique.")]));

children.push(p("La quantité et le prix unitaire, quand ils sont renseignés, s'affichent en petit sous le montant."));
children.push(p([
  t('Chaque ligne se modifie ou se supprime par les icônes de droite. Au-delà de 100 mouvements, le tableau se découpe en plusieurs pages.'),
]));
children.push(gap(100));
children.push(...figure('5.8', 'Le tableau des mouvements',
  "une quinzaine de lignes mêlant versements et retraits, avec au moins un badge « Espèces » et un mouvement issu d'une récurrence, plus les icônes modifier / supprimer visibles."));

// ── 5.11 ───────────────────────────────────────────────────────────────────
children.push(h2("5.11  Modifier ou supprimer l'enveloppe"));

children.push(h3('Modifier'));
children.push(p("Le crayon de l'en-tête ouvre une fenêtre où vous pouvez changer le nom, la couleur, les frais, le rendement cible, la date d'ouverture et l'inclusion au rapport fiscal. Les mouvements ne sont pas touchés."));

children.push(h3('Supprimer'));
children.push(p([
  t("La corbeille demande confirmation et vous annonce précisément ce qui partira avec l'enveloppe : le nombre de "),
  b('mouvements programmés'), t(' et de '), b('calibrations'), t(' concernés.'),
]));
children.push(gap(100));
children.push(...figure('5.9', "La confirmation de suppression",
  "la fenêtre de confirmation affichant le décompte des mouvements programmés et des calibrations qui seront supprimés."));

children.push(gap(140));
children.push(attention("La suppression est irréversible et emporte tout l'historique de l'enveloppe. Si vous hésitez, exportez d'abord vos données (§ 14.3) : vous pourrez toujours revenir en arrière par un import."));

module.exports = children;

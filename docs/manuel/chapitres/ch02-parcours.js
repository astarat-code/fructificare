// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
const {
  p, bullet, step, bonASavoir, attention, noteRedac, figure, gap,
  h1, h2, h3, t, b, i, ui, code, tableau,
  GREEN, SLATE, GREY, AMBER, CONTENT_W,
} = require('../lib/kit');
const { Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell,
        WidthType, ShadingType, TableOfContents } = require('docx');

const children = [];

// ═══════════════════════════════════════════════════════════════════════════
//  CHAPITRE 2
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1('2. Parcours guidé — viser son premier million'));

children.push(p([
  i("Ce chapitre suit Gabriel, 28 ans, 3 700 € net par mois, qui vient d'ouvrir une assurance vie et veut savoir à quelle vitesse il peut atteindre le million. Chaque étape renvoie au chapitre concerné."),
]));

children.push(h2('2.1  Le point de départ'));
children.push(p("Gabriel a un tableur. Trois onglets, des colonnes qui ne s'additionnent plus depuis qu'il a ouvert un deuxième contrat, et aucune idée de ce que ses frais lui coûtent réellement sur vingt ans."));
children.push(p([
  t("Ce qu'il cherche se résume en trois questions : "),
  b("Où j'en suis ? Où je vais ? Qu'est-ce qui freine mes profits ?"),
]));
children.push(gap(100));
children.push(...figure('2.1', 'Le tableau de bord au premier lancement',
  "le tableau de bord vide, avec le message « Aucune enveloppe » et le bouton « Créer une enveloppe » bien visible."));

children.push(h2("2.2  Ouvrir l'enveloppe"));
children.push(p([
  t("Gabriel crée sa première enveloppe : "), ui('Créer une enveloppe'),
  t(", type "), b('Assurance vie'), t(", "), b("date d'ouverture du contrat"), t(" (§ 4.3)."),
]));
children.push(p([
  t("Cette date est celle qui enclenche le compte à rebours des "),
  b('huit ans'),
  t(" au terme desquels l'assurance vie devient fiscalement avantageuse. Fructificare s'en servira pour afficher un liseré vert sur la ligne de l'enveloppe le jour venu, et pour appliquer le bon régime dans le rapport fiscal."),
]));
children.push(p([
  t("Il renseigne aussi les "), b('frais annuels'),
  t(" du contrat, qui peuvent le plus souvent être trouvés dans les conditions générales du contrat. Des frais de mouvements pourront également être appliqués à chaque mouvement créé (§ 5.4)."),
]));
children.push(gap(100));
children.push(...figure('2.2', "Création d'une enveloppe Assurance vie",
  "la fenêtre de création, type « Assurance vie » sélectionné, date d'ouverture et frais annuels renseignés."));

children.push(h2('2.3  Les premiers mouvements'));
children.push(p([
  t("Il fait un versement initial de 2 000 € à l'ouverture du contrat. Gabriel utilise les "), b("types d'actifs multiples"),
  t(" pour répartir 60 % en fonds euros et 40 % en unités de compte, en une seule saisie (§ 5.4)."),
]));
children.push(p([
  t("Il profite du champ "), ui('Note'),
  t(" pour identifier son mouvement. Ce n'est pas qu'un simple commentaire : Fructificare regroupe tous les mouvements partageant la même note et en calcule le total investi, le nombre d'unités et le prix d'achat moyen pondéré (§ 5.9). Attention : la note doit être écrite exactement de la même façon d'un mouvement à l'autre pour que le programme les regroupe, et elle est sensible à la casse (« Épargne hebdomadaire » et « épargne hebdomadaire » formeront deux groupes)."),
]));
children.push(p([
  t("Comme il compte répéter ce versement, il en fait un "), b('mouvement type'),
  t(" (chapitre 7) — les frais et la ventilation sont mémorisés — puis un "),
  b('mouvement récurrent'), t(" mensuel de 400 € (chapitre 8). À partir de là, la saisie se fait toute seule."),
]));
children.push(gap(100));
children.push(...figure('2.3', 'Le formulaire de saisie et le panneau récurrent',
  "deux captures côte à côte : à gauche le formulaire d'ajout de mouvement rempli avec la répartition multi-actifs, à droite l'onglet « Créer un récurrent » du panneau des mouvements récurrents.", ["Le formulaire d'ajout, réparti sur deux types d'actifs", "L'onglet « Créer un récurrent »"]));

children.push(h2('2.4  Rendre les chiffres réels — la première calibration'));
children.push(p([
  t("Trois mois plus tard, le premier relevé de compte de l'assurance vie arrive : 3 340 €. Gabriel ouvre "),
  ui('Calibrer mes enveloppes'), t(" et saisit cette valeur (chapitre 6)."),
]));
children.push(p("L'application n'affichait jusque-là que la somme des versements. Elle peut désormais afficher la valeur réelle et peut en déduire la performance, la plus-value, le rendement annualisé."));
children.push(gap(120));
children.push(bonASavoir([
  new TextRun({ text: 'Prenez le temps de « Détailler par position » dès la première calibration. ', size: 21, bold: true }),
  new TextRun({ text: "Cette ventilation débloque la section « Rendements par actif » de la fiche enveloppe (§ 5.8) et conditionne l'estimation fiscale (§ 11.2). Sans elle, vous n'aurez qu'un chiffre global.", size: 21 }),
]));
children.push(gap(100));
children.push(...figure('2.4', 'Avant et après la première calibration',
  "deux captures du même tableau de bord, côte à côte : à gauche avant calibration (valeur = versements, pas de plus-value), à droite après (valeur réelle, plus-value en vert, courbe qui décolle).", ["Avant la calibration", "Après la calibration"]));

children.push(h2("2.5  Combien ça coûte vraiment — le contrôle des frais"));
children.push(p([
  t("La tuile "), ui('Total frais'),
  t(" du tableau de bord affiche un montant, et surtout sa répartition par enveloppe (§ 4.4). Gabriel découvre que ses frais annuels pèsent déjà plus que ses frais de versement."),
]));
children.push(p([
  t("Pour mesurer ce que ça représente à long terme, il fait l'exercice décisif : "),
  b("deux simulations identiques avec des niveaux de frais différents"),
  t(" (§ 10.3). L'écart à vingt ans se compte en dizaines de milliers d'euros."),
]));
children.push(gap(100));
children.push(...figure('2.5', "L'impact des frais sur vingt ans",
  "deux captures : le détail des frais par enveloppe, puis deux courbes de simulation superposées avec des TER différents, l'écart final bien lisible.", ["Le détail des frais par enveloppe", "Deux simulations à vingt ans, frais de 0,5 % et de 2 %"]));

children.push(h2('2.6  Combien ça rapporte — la projection'));
children.push(p([
  t("Gabriel crée une simulation à partir de ses enveloppes réelles (§ 10.2), pousse le curseur d'année jusqu'à ses 50 ans, puis active l'"),
  b('option inflation'), t(" pour voir quel sera réellement le pouvoir d'achat de son million d'euros en 2048."),
]));
children.push(p("Deux repères apparaissent en chemin : 1- Le Crossover Point, moment où les intérêts cumulés dépassent les versements ; c'est souvent un moment clé de l'investissement à partir duquel les intérêts deviennent exponentiels puisque vos intérêts composés deviennent le principal moteur de votre épargne en dépassant votre effort personnel. 2- La progression FIRE - ou Financial Independence, Retire Early - représente le capital final à obtenir pour vivre de ses revenus passifs."));
children.push(p([
  t("Enfin, le "), b('stress test'),
  t(" permet de simuler un krach à mi-parcours et la trajectoire qui en résulte. Il dépend du type d'actifs de votre épargne et permet d'anticiper une crise future."),
]));
children.push(gap(100));
children.push(...figure('2.6', 'La projection et son scénario de crise',
  "deux captures : la simulation à vingt ans avec le bandeau FIRE, puis la même simulation après application du stress test.", ["La simulation à vingt ans", "Sa courbe de projection", "Après le stress test", "La courbe après le krach"]));

children.push(h2("2.7  Ce que l'État prendra — l'anticipation fiscale"));
children.push(p([
  t("Gabriel simule un rachat à six ans, puis le même à neuf ans, dans le "),
  ui("Simulateur d'imposition"), t(" (§ 11.1). L'écart de note finale tient en une ligne : l'abattement de 4 600 € et le taux réduit de 7,5 % ne s'appliquent qu'après huit ans."),
]));
children.push(p("Conclusion pratique : il est bien plus avantageux d'attendre le cap des huit ans qui permet de gagner plusieurs centaines d'euros d'impôt sur un rachat de cette taille."));
children.push(p([
  t("En janvier, il génère son "), b('rapport fiscal'),
  t(" de l'année écoulée (§ 11.2) et le range avec ses justificatifs."),
]));
children.push(gap(100));
children.push(...figure('2.7', 'Avant et après le cap des huit ans',
  "deux résultats du simulateur d'imposition assurance vie côte à côte, l'un à 6 ans de détention, l'autre à 9 ans, avec les totaux d'imposition bien lisibles.", ["Rachat après 6 ans", "Rachat après 9 ans"]));

children.push(h2('2.8  Tenir la distance'));
children.push(p("Un plan à vingt ans ne tient pas par la volonté. Il tient par le rythme."));
children.push(bullet([t("L'objectif « premier million » est posé dans "), ui('Mes objectifs'), t(", avec sa date cible et sa barre de progression (§ 13.3).")]));
children.push(bullet([t("Un rappel de calibration revient chaque mois au calendrier (§ 9.2), pour que les chiffres restent à jour.")]));
children.push(bullet([t("Le défi du mois propose une action concrète différente chaque mois (§ 13.5).")]));
children.push(bullet([t("L'avatar franchit ses paliers au fil du capital : des premiers pas au sac au dos, puis au bouclier, à la forteresse et au trésor (§ 13.1).")]));
children.push(p([
  t("La "), b('règle 8-4-3'),
  t(" (§ 10.5) l'aide enfin à ne pas toucher à son épargne : les intérêts composés récompensent surtout les dernières années, et chaque retrait anticipé coupe l'effet boule de neige au moment précis où il commence à s'emballer."),
]));
children.push(gap(100));
children.push(...figure('2.8', 'Les jalons de la durée',
  "la page Trophées : en-tête avec l'avatar « Trésor » et le capital total, et en dessous une carte d'objectif à environ 40 % de progression."));

children.push(h2('2.9  La boucle vertueuse'));
children.push(p("Tout Fructificare tient dans un cycle de quelques minutes, à répéter chaque mois pour une efficacité optimale."));
children.push(gap(100));
children.push(...figure('2.9', 'Le cycle Fructificare',
  "schéma : cinq étapes en cercle — Saisir → Calibrer → Mesurer → Optimiser → Projeter — avec dans chaque étape sa légende et le renvoi aux chapitres correspondants."));

children.push(p([
  b('Saisir'), t(" vos mouvements, "), b('calibrer'), t(" pour ancrer les chiffres dans le réel, "),
  b('mesurer'), t(" performance et frais, "), b('optimiser'), t(" les profits et les frais, "),
  b('projeter'), t(" pour vérifier que la trajectoire tient. Puis recommencer."),
]));


module.exports = children;

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
const {
  p, bullet, step, bonASavoir, attention, figure, gap,
  h1, h2, h3, t, b, i, ui, code, tableau,
} = require('../lib/kit');
const { TextRun } = require('docx');

const children = [];

// ═══════════════════════════════════════════════════════════════════════════
//  CHAPITRE 10
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1('10. Simulations'));

children.push(p([
  t("Les simulations dans Fructificare vous permettent de projeter ce qui pourrait arriver. "),
  t("C'est un espace de brouillon — "), b('rien de ce que vous y faites ne touche vos vraies enveloppes'),
  t(". Vous pouvez y tester une hausse de versement, un krach, un départ à la retraite anticipé, sans aucun risque pour vos données."),
]));

children.push(...figure('10.1', "La page d'accueil des simulations",
  "la page complète, en pleine largeur"));

children.push(h2("10.1  Deux outils, deux questions"));
children.push(p("La page Simulation propose deux entrées, qui répondent à des questions différentes."));
children.push(bullet([
  ui("Simulateur d'enveloppes"),
  t(" — « Où sera mon patrimoine dans 10, 20 ou 30 ans ? » C'est l'outil principal, décrit dans tout ce chapitre."),
]));
children.push(bullet([
  ui("Simulateur d'imposition"),
  t(" — « Combien l'État prendra-t-il si je retire maintenant ? » Il est traité au chapitre 11, avec le reste de la fiscalité."),
]));

// ── 10.2 ───────────────────────────────────────────────────────────────────
children.push(h2('10.2  La liste de vos simulations'));

children.push(...figure('10.2', 'La grille des simulations enregistrées',
  "la page complète, en pleine largeur"));

children.push(p("Chaque scénario que vous créez devient une tuile :"));
children.push(bullet('un mini-graphique — valeur, versements, et la projection en violet ;'));
children.push(bullet([b('Portefeuille total'), t(" et "), b('Gains'), t(" à l'horizon que vous aviez choisi la dernière fois ;")]));
children.push(bullet("l'horizon mémorisé, affiché en violet à côté du libellé (« à 20 ans ») ;"));
children.push(bullet('la date de création du scénario.'));


children.push(h3('Créer une simulation'));
children.push(p("La création se fait en deux temps."));
children.push(step([b('Choisir le type.'), t(" Une "), ui('Simulation classique'), t(" sert à projeter librement vos enveloppes ; une "), ui('Règle 8-4-3'), t(" sert d'exercice pédagogique (§ 10.5).")], 1));
children.push(step([b('Pour une simulation classique :'), t(" Donnez un nom au scénario, puis choisissez "), ui('Importer mes enveloppes actuelles'), t(" — vos vraies enveloppes sont recopiées avec leurs versements récurrents — ou "), ui("Partir d'une simulation vierge"), t(", pour construire un patrimoine hypothétique.")], 1));

// ── 10.3 ───────────────────────────────────────────────────────────────────
children.push(h2("10.3  Le détail d'une simulation"));

children.push(p("Ouvrir une simulation donne accès à un tableau de bord parallèle, avec ses propres réglages."));

children.push(h3("La barre d'outils"));
children.push(tableau(
  ['Outil', 'Ce qu\'il fait'],
  [
    ['Inflation', "Activée, l'inflation est retranchée du rendement de chaque mouvement : les montants projetés s'expriment alors en euros d'aujourd'hui. Le taux d'inflation peut être modifié en cliquant sur la partie droite du bouton."],
    ['Paramètres FIRE', "Vos besoins mensuels et votre taux de retrait sûr. Le capital nécessaire se recalcule en direct. Ces réglages sont partagés avec le reste de l'application."],
    ['Stress test', "Applique un krach à une date choisie : actions, ETF et obligations −20 %, crypto −50 % ; les fonds euros, l'immobilier, les SCPI, l'or et les actifs exotiques ne sont pas touchés."],
    ['Mouvements récurrents', "Ouvre le panneau des versements programmés, appliqué à la simulation seule."],
    ['Supprimer', "Efface le scénario. Vos vraies enveloppes ne sont pas concernées."],
  ],
  [2200, 6826],
));

children.push(h3('Les bandeaux de réussite'));
children.push(bullet([b('Crossover Point atteint'), t(" — vos intérêts cumulés dépassent la somme de vos versements. Le point de bascule à partir duquel votre capital travaille plus que vous.")]));
children.push(bullet([b('Indépendance financière atteinte (FIRE)'), t(" — vos revenus passifs couvrent vos besoins mensuels déclarés. Le bandeau affiche l'excédent et le pourcentage atteint.")]));

children.push(h3('Les tuiles et les frais'));
children.push(p("Portefeuille total, total versé, intérêts nets (en euros et en pourcentage), progression FIRE et objectif FIRE. Une carte séparée présente la répartition des frais entre frais de versement et frais annuels, et affiche leur impact cumulé à l'horizon — un chiffre souvent plus élevé qu'attendu."));

children.push(h3('Les contrôles de projection'));
children.push(p([
  t("Deux commandes règlent l'horizon : un sélecteur de "), b('date cible'),
  t(" (mois et année) et un "), b("curseur d'année"),
  t(" qui affiche la valeur projetée en direct pendant que vous le déplacez."),
]));

children.push(gap(120));
children.push(attention([
  new TextRun({ text: "Une projection n'est pas une promesse. Elle applique un rendement constant à des versements réguliers ; les marchés, eux, montent et descendent. Elle est surtout utile pour comparer des scénarios entre eux et non pour prédire un montant.", size: 21 }),
]));

// ── 10.4 ───────────────────────────────────────────────────────────────────
children.push(h2("10.4  La fiche enveloppe d'une simulation"));
children.push(p([
  t("Cliquer sur une enveloppe de simulation ouvre "), b('la même fiche qu\'au chapitre 5'),
  t(", rendue sur les données du scénario. Inutile de la redécrire : seules trois choses changent."),
]));
children.push(bullet([b('Espace isolé'), t(" — rien de ce que vous faites ici n'apparaît sur votre tableau de bord.")]));
children.push(bullet([b('Graphiques prolongés'), t(" — les courbes continuent dans le futur, au rendement cible de l'enveloppe.")]));
children.push(bullet([b('Calibration simplifiée'), t(" — la fenêtre de calibration ne demande pas la ventilation par position.")]));

// ── 10.5 ───────────────────────────────────────────────────────────────────
children.push(h2('10.5  La règle 8-4-3'));

children.push(...figure('10.3', 'La simulation « règle 8-4-3 »',
  "la page complète, en pleine largeur"));

children.push(p([
  t("La règle 8-4-3 est un exercice pédagogique pour visualiser la puissance des intérêts composés. Elle illustre une idée simple : "),
  i("les intérêts mettent longtemps à démarrer, puis accélèrent exponentiellement."),
]));

children.push(p([b('La formule :'), t(" en 8 ans vous constituez votre capital de base ; en 4 ans supplémentaires vos intérêts augmentent rapidement ; et durant les 3 dernières années, les intérêts s'envolent.")]));

children.push(h3('Configurer'));
children.push(p("Le panneau de configuration demande un nom de simulation, les enveloppes à inclure, une date de départ (An 0), un capital de départ, un versement mensuel et un rendement annuel."));
children.push(gap(100));
children.push(bonASavoir([
  new TextRun({ text: "Le capital de départ se remplit tout seul : Fructificare y place le total que vous aviez versé, sur les enveloppes sélectionnées, à la date choisie pour l'An 0. Changez l'An 0 et le montant suit. Vous restez libre de le corriger à la main.", size: 21 }),
]));

children.push(h3('Lire le résultat'));
children.push(bullet([b('Trois cartes de phase'), t(" — « la traversée du désert » (8 ans), « le décollage » (+4 ans), « l'effet boule de neige » (+3 ans).")]));
children.push(bullet([b('Histogramme empilé'), t(" sur 15 ans, séparant versements et intérêts, avec un repère « Aujourd'hui ».")]));
children.push(bullet([b('Tuiles de synthèse'), t(" — total apporté, total des intérêts, capital final.")]));
children.push(bullet([b('Calendrier de progression'), t(" — 180 cases, une par mois, indiquant le gain de chaque mois écoulé.")]));
children.push(bullet([b('Tableau année par année'), t(" — les années écoulées en caractères normaux, les années futures en italique.")]));

module.exports = children;

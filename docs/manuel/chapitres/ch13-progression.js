// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
const {
  p, bullet, step, bonASavoir, attention, figure, gap,
  h1, h2, h3, t, b, i, ui, code, tableau,
} = require('../lib/kit');
const { TextRun } = require('docx');

const children = [];

// ═══════════════════════════════════════════════════════════════════════════
//  CHAPITRE 13
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1('13. Progression & trophées'));


children.push(...figure('13.1', 'La page Trophées',
  "la page complète, en pleine largeur"));

// ── 13.1 ───────────────────────────────────────────────────────────────────
children.push(h2('13.1  Votre avatar'));

children.push(p([
  t("L'avatar évolue avec votre "), b('capital total'),
  t(" — la valeur calibrée quand elle existe, sinon vos versements nets, toutes enveloppes confondues, livrets compris. "),
  t("L'en-tête affiche l'avatar, le nom du palier et son chapitre, sa devise, votre capital et le montant du palier suivant."),
]));

children.push(p([
  t("L'avatar raconte une "), b('épopée en 19 paliers'),
  t(", de vos premiers pas jusqu'aux étoiles, en cinq chapitres : "),
  i("l'Éveil, le Voyage, la Chevalerie, la Conquête et les Étoiles"),
  t(". D'un palier au suivant, votre capital est multiplié par 1,5 à 2 : chaque étape demande un effort comparable. La couleur de l'avatar change à chaque chapitre, et chaque palier porte une devise qui salue le chemin parcouru."),
]));

children.push(p([
  t("Au-delà du million commence la "), b('Légende'),
  t(" : les 19 avatars se rejouent en or, cerclés d'un liseré, jusqu'au milliard. L'or est réservé à la Légende. Le détail des seuils figure en annexe (§ 16.5)."),
]));

// ── 13.2 ───────────────────────────────────────────────────────────────────
children.push(h2('13.2  Vos trois indicateurs'));

children.push(h3('Le score de santé financière'));
children.push(p("Une note sur 100, cliquable, qui ouvre le détail de son calcul. Elle agrège cinq composantes."));
children.push(tableau(
  ['Composante', 'Points', 'Ce qu\'elle mesure'],
  [
    ['Diversification', '20', "La concentration de votre patrimoine sur une seule enveloppe ou un seul actif"],
    ['Performance', '25', "Votre rendement, rapporté à une cible ajustée au risque et à votre âge"],
    ['Maîtrise des frais', '20', 'Les frais annuels pondérés et le poids des frais déjà payés'],
    ['Résilience & inflation', '25', "Votre exposition à un krach, pondérée par votre âge"],
    ['Liquidité', '10', 'Le nombre de mois de revenu couverts par vos livrets réglementés'],
    ['Bonus', '5', 'Jeune et performant, ou sénior et résilient'],
  ],
  [2400, 900, 5726],
));
children.push(p([
  t("Le score a besoin de votre "), b('date de naissance'),
  t(" — plusieurs composantes dépendent de votre horizon de placement. Vous pouvez la saisir dans les Paramètres de l'application. "),
  t("Un historique et un bouton de recalcul complètent la fenêtre."),
]));

children.push(h3('La progression FIRE'));
children.push(p([
  t("Le pourcentage du capital nécessaire à votre indépendance financière que vous avez déjà constitué. "),
  t("Cliquable : la fenêtre détaille le calcul et permet d'ajuster vos besoins mensuels et votre taux de retrait — "),
  t("réglages partagés avec les simulations."),
]));
children.push(gap(100));
children.push(bonASavoir([
  new TextRun({ text: "La progression FIRE prend en compte toutes vos enveloppes, livrets réglementés inclus.", size: 21 }),
]));

children.push(h3('Le Crossover Point'));
children.push(p("La part de vos revenus mensuels déjà couverte par vos investissements. Il nécessite votre revenu mensuel net, saisi dans les Paramètres."));

// ── 13.3 ───────────────────────────────────────────────────────────────────
children.push(h2('13.3  Vos objectifs'));
children.push(p([
  t("Vous pouvez créer vous-même jusqu'à "), b('20 objectifs'), t(" personnels : un libellé, un montant cible, les enveloppes concernées "),
  t("(ou le patrimoine total), une date visée et une icône — maison, voiture, retraite, voyage, enfants, autre."),
]));
children.push(p("Chaque carte affiche une barre de progression et une estimation du temps restant au rythme actuel de vos versements. La complétion est détectée automatiquement."));

// ── 13.4 ───────────────────────────────────────────────────────────────────
children.push(h2('13.4  Le parcours tutoriel'));
children.push(p([
  t("Un bandeau dépliant, en haut de la page comme du tableau de bord, qui suit "), b('14 missions'),
  t(" de prise en main. Chaque tuile ouvre un guide "), ui('Comment compléter'), t(" pas à pas."),
]));

// ── 13.5 ───────────────────────────────────────────────────────────────────
children.push(h2('13.5  Les trophées'));

children.push(p([
  t("Fructificare compte "), b('120 trophées'), t(", répartis en 16 catégories : utilisateur, tutoriel, régularité, "),
  t("patrimoine, gains, gestion, fiscal, santé, FIRE, séries, défis mensuels, cumul de défis, cumul de calibrations, "),
  t("fidélité, ancienneté, et objectifs personnels."),
]));

children.push(h3('Lire la page'));
children.push(bullet([b('Les 5 derniers trophées obtenus'), t(" ouvrent la section, toutes catégories confondues, du plus récent au plus ancien.")]));
children.push(bullet([b('Une barre de progression globale'), t(" indique où vous en êtes sur l'ensemble.")]));
children.push(bullet([b('Un affichage par catégorie'), t(" permet de déplier ce qui vous intéresse.")]));

children.push(gap(120));
children.push(p([
  t("Un clic sur "), b("n'importe quel trophée"), t(" — obtenu ou non — ouvre une fiche qui explique ce qu'il récompense "),
  t("et comment l'obtenir. Les trophées non obtenus s'affichent en teintes grisées ; les autres gardent les couleurs du thème."),
]));

children.push(h3('Le défi du mois'));
children.push(p([
  t("Une mission par mois, "), b('12 au total'), t(" : automatisation globale, maître des frais, rééquilibrage, "),
  t("déclarant, revue du calendrier, prêt pour la crise, alerte frais, prélèvement à la source, optimiseur fiscal, "),
  t("fin d'année, point sur les rendements, bilan annuel."),
]));
children.push(p("Chaque défi est re-validable une fois par an ; le trophée correspondant, lui, reste acquis définitivement."));

children.push(h3('Les séries'));
children.push(bullet([b('Séries de connexion'), t(" — jours consécutifs d'utilisation, avec un jour de grâce par série. Paliers à 7, 30, 100 et 365 jours. Une flamme apparaît à côté du titre du tableau de bord.")]));
children.push(bullet([b('Séries de calibration'), t(" — mois consécutifs où vous avez calibré. Paliers à 3, 6 et 12 mois.")]));

children.push(gap(100));
children.push(bonASavoir([
  new TextRun({ text: "Tout cela peut se désactiver. ", bold: true, size: 21 }),
  new TextRun({ text: "Le réglage « Afficher la progression » des Paramètres masque le tutoriel et le défi du mois. La page Trophées reste accessible, et le score de santé continue d'être calculé.", size: 21 }),
]));

module.exports = children;

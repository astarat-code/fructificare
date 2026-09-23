// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
const {
  p, bullet, step, bonASavoir, attention, figure, gap,
  h1, h2, h3, t, b, i, ui, tableau,
} = require('../lib/kit');
const { TextRun } = require('docx');

const children = [];

// ═══════════════════════════════════════════════════════════════════════════
//  CHAPITRE 9 — l'ordre suit la page du programme : le calendrier d'abord,
//  puis ses trois onglets (Rappels, Mouvements programmés, Budget du mois).
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1('9. Le calendrier et le budget'));

children.push(p("Le calendrier rassemble vos mouvements passés et à venir, vos rappels, vos échéances fiscales, vos anniversaires de contrat..."));
children.push(p([
  t("Trois onglets le complètent en dessous : "), ui('Rappels'), t(", "), ui('Mouvements programmés'),
  t(" et "), ui('Budget du mois'), t('.'),
]));
children.push(gap(100));
children.push(...figure('9.1', 'La page calendrier',
  "la page complète : grille mensuelle bien remplie avec des pastilles de plusieurs couleurs, légende visible, et les trois onglets en dessous."));

// ── 9.1 ────────────────────────────────────────────────────────────────────
children.push(h2('9.1  La grille mensuelle'));
children.push(p("Les flèches de part et d'autre du mois vous déplacent d'un mois à l'autre. Le bouton Aujourd'hui ramène au mois courant, et le champ à droite permet de sauter directement à une année."));

children.push(p([
  t("Chaque jour affiche jusqu'à "), b('trois pastilles'),
  t(" d'événements. Au-delà, un compteur « +n » indique ce qui n'est pas montré. Cliquez sur le jour pour tout voir."),
]));

children.push(h3('La légende'));
children.push(tableau(
  ['Couleur', 'Événement'],
  [
    ['Vert',        'Versement'],
    ['Rouge',       'Retrait'],
    ['Ambre',       'Rappel'],
    ['Bleu',        'Mouvement programmé'],
    ['Violet',      'Entrée de budget'],
    ['Indigo',      'Événement Fructificare (bilan, revue des frais…)'],
    ['Violet clair','Échéance d’objectif'],
    ['Jaune',       'Note personnelle'],
    ['Orange',      'Mouvement sur compte chèque'],
  ],
  [2200, 6826],
));

children.push(gap(160));

children.push(h3('La fenêtre du jour'));
children.push(p("Un clic sur une case ouvre le détail de la journée : chaque événement y figure avec son montant, sa répartition par actif le cas échéant, et ses actions (valider un rappel, appliquer un mouvement programmé)."));
children.push(p([
  t("En bas de la fenêtre, trois boutons ajoutent un élément à cette date : "),
  ui('Budget'), t(" ouvre la saisie d'une entrée de budget (§ 9.5), "),
  ui('Note'), t(" une note de calendrier, et "),
  ui('Rappel'), t(" un rappel (§ 9.3)."),
]));
children.push(gap(100));
children.push(...figure('9.2', 'Le détail d’une journée',
  "la fenêtre d'un jour chargé, mêlant un versement, un rappel avec son bouton de validation et un mouvement programmé, avec les boutons Budget, Note et Rappel visibles en bas."));

children.push(h3('Les notes de calendrier'));
children.push(p("Une note libre attachée à une date, dans l'une des huit couleurs disponibles. Elle n'entre dans aucun calcul : c'est un pense-bête, pour retenir le contexte d'une décision — « arbitrage après le krach », « prime reçue »."));

children.push(h3('Exporter vers votre agenda'));
children.push(p([
  t("Le bouton "), ui('Exporter .ics'),
  t(" produit un fichier calendrier standard, que vous pouvez importer dans Outlook, Google Agenda ou Apple Calendrier."),
]));

// ── 9.2 ────────────────────────────────────────────────────────────────────
children.push(h2('9.2  Les événements générés automatiquement dans le calendrier'));

children.push(tableau(
  ['Événement', 'Quand', 'Pourquoi'],
  [
    ['Calibration mensuelle', 'Chaque mois',            "Relever la valeur de vos comptes (chapitre 6)"],
    ['Défi mensuel — J-3',    'Trois jours avant la fin du mois', 'Valider la mission du mois (§ 13.5)'],
    ['PEA — 5 ans',           "À l'anniversaire du contrat",     "Exonération d'impôt sur le revenu acquise"],
    ['Assurance vie — 8 ans', "À l'anniversaire du contrat",     'Abattement fiscal acquis'],
    ['Bilan trimestriel',     'Tous les trois mois',    'Faire le point sur la trajectoire'],
    ['Bilan annuel',          '1ᵉʳ janvier',            'Revoir objectifs et performances'],
    ['Revue des frais',       '15 janvier et 15 juillet', 'Vérifier ce que coûtent vos contrats'],
    ['Échéances fiscales',    'Au printemps',           'Préparer puis déposer la déclaration'],
  ],
  [2400, 2800, 3826],
));

children.push(gap(160));
children.push(p([
  t("Les anniversaires de contrat PEA et assurance vie ne sont créés que si vous avez renseigné la "),
  b("date d'ouverture"), t(" de l'enveloppe concernée (§ 4.3)."),
]));

// ── 9.3 ────────────────────────────────────────────────────────────────────
children.push(h2('9.3  Onglet Rappels'));
children.push(p("Vos rappels personnels, à côté de ceux que Fructificare génère (§ 9.2). En tête de liste, le défi du mois et les échéances du mois en cours (calibration, bilan, fiscalité) rappellent ce qui vous attend."));

children.push(h3('Ajouter un rappel'));
children.push(step([t('Cliquez sur '), ui('Ajouter un rappel'), t('.')], 60));
children.push(step([t('Saisissez le '), b('libellé'), t(" — par exemple « Vérifier mon PEA », « Relever les valeurs ».")], 60));
children.push(step([t('Fixez la '), b('date'), t('.')], 60));
children.push(step([t('Choisissez la '), b('récurrence'), t(' : aucune, mensuelle ou annuelle.')], 60));
children.push(step([t('Validez avec '), ui('Enregistrer'), t('.')], 60));

children.push(p("Un rappel se modifie, se valide ou se supprime depuis la liste."));

children.push(h3('Les rappels en retard'));
children.push(p("Un bandeau rouge apparaît en haut de la page dès qu'un rappel a dépassé sa date sans être validé. Chaque rappel y figure avec sa date et une coche pour le marquer comme fait, sans quitter la page."));
children.push(gap(100));
children.push(...figure('9.3', 'Le bandeau des rappels en retard',
  "le bandeau rouge avec deux ou trois rappels dépassés et leurs boutons de validation."));

// ── 9.4 ────────────────────────────────────────────────────────────────────
children.push(h2('9.4  Onglet Mouvements programmés'));
children.push(p([
  t("Une vue de vos mouvements réguliers actifs depuis le calendrier : enveloppe, montant, récurrence, date de début et note. "),
  t("Le bouton "), ui('Gérer'), t(" — comme le crayon de chaque ligne — ouvre le panneau complet des mouvements récurrents (chapitre 8), où se font la création, la modification et l'arrêt des séries."),
]));

// ── 9.5 ────────────────────────────────────────────────────────────────────
children.push(h2('9.5  Onglet Budget du mois'));

children.push(h3("Le taux d'investissement"));
children.push(p("Vous trouverez la part de votre salaire du mois effectivement investie, en pourcentage. L'appréciation ci-dessous est donnée à titre indicatif et ne constitue pas un conseil en investissement. La part investie dépend de la situation de chacun et doit être personnalisée."));

children.push(tableau(
  ['Taux', 'Appréciation'],
  [
    ['30 % et plus',  'Excellent 🏆'],
    ['20 à 29 %',     'Très bien 💪'],
    ['10 à 19 %',     'Bien 👍'],
    ['Moins de 10 %', 'Continuez vos efforts 🌱'],
  ],
  [2600, 6426],
));

children.push(gap(160));
children.push(p([
  t("Le calcul suppose qu'une entrée de catégorie "), b('Salaire'),
  t(" existe pour le mois. Le salaire peut aussi être renseigné dans les Paramètres : il sert alors de base quand le mois ne contient aucune entrée « Salaire »."),
]));
children.push(gap(100));
children.push(...figure('9.4', "Le taux d'investissement",
  "la carte du taux d'investissement, avec son pourcentage en gros, son appréciation et le rappel salaire / investi en dessous."));

children.push(h3('La liste des mouvements du mois'));
children.push(p("Tous les flux du mois, quelle que soit leur origine : entrées de budget, transactions d'enveloppe, occurrences récurrentes, dépenses de compte chèque. Une pastille de couleur indique la source de chaque ligne. Les mouvements renseignés sur les enveloppes d'investissement sont automatiquement importés ici, mais pensez à compléter avec vos dépenses récurrentes liées au train de vie (loyer, frais de transport, nourriture, abonnements etc.)."));

children.push(h3('Ajouter un mouvement de budget'));
children.push(p([
  t("C'est ici que se saisissent les dépenses et les revenus courants qui ne concernent aucune enveloppe d'investissement — loyer, abonnement, salaire. Ils sont rattachés au "),
  b('compte chèque'), t(", qui n'entre dans aucune statistique de placement."),
]));
children.push(step([t('Cliquez sur '), ui('Ajouter un mouvement'), t(" — ou sur "), ui('Budget'), t(" depuis la fenêtre d'un jour (§ 9.1).")], 70));
children.push(step([t('Choisissez la '), b('catégorie'), t(' parmi les sept proposées.')], 70));
children.push(step([t('Si vous avez choisi '), b('Autre'), t(", précisez un libellé personnalisé.")], 70));
children.push(step([t('Saisissez le '), b('montant'), t(' et la '), b('date'), t('.')], 70));
children.push(step([t('Choisissez une '), b('récurrence'), t(" éventuelle : aucune, hebdomadaire, mensuelle, trimestrielle ou annuelle. Une entrée récurrente se reporte automatiquement sur les périodes suivantes.")], 70));
children.push(step([t('Validez avec '), ui('Dépenses'), t(' ou '), ui('Apports'), t(" selon qu'il s'agit d'une sortie ou d'une entrée d'argent.")], 70));

children.push(p([b('Les sept catégories :')]));
children.push(bullet('Salaire — vos revenus ; c’est la base du taux d’investissement ;'));
children.push(bullet('Loyer, Nourriture, Charges — vos dépenses contraintes ;'));
children.push(bullet('Loisirs — vos dépenses arbitrables ;'));
children.push(bullet('Investissement — ce que vous mettez de côté ;'));
children.push(bullet('Autre — avec un libellé libre.'));

children.push(p([
  t("Un second onglet "), ui('Historique'),
  t(" liste vos entrées de budget passées. Il ne montre que les entrées budget : vos mouvements d'enveloppe restent sur leur fiche."),
]));

children.push(h3('Le camembert de répartition'));
children.push(p("La répartition de vos dépenses du mois par catégorie."));
children.push(gap(100));
children.push(...figure('9.5', "L'onglet Budget du mois",
  "l'onglet complet : taux d'investissement en haut, liste des mouvements du mois à gauche avec ses pastilles colorées, camembert de répartition à droite."));

children.push(gap(120));
children.push(bonASavoir("Le budget n'est pas obligatoire. Si vous ne renseignez ni salaire ni dépenses, le reste de Fructificare fonctionne normalement — vous perdez simplement le taux d'investissement, le Crossover Point et la composante liquidité du score de santé."));

module.exports = children;

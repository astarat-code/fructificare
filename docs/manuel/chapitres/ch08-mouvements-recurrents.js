// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
const {
  p, bullet, step, bonASavoir, attention, noteRedac, figure, gap,
  h1, h2, h3, t, b, i, ui, code, tableau,
  GREEN, SLATE, GREY, AMBER, CONTENT_W,
} = require('../lib/kit');
const { Paragraph, TextRun, AlignmentType } = require('docx');

const children = [];

children.push(h1('8. Les mouvements récurrents'));

children.push(p("Un mouvement récurrent est un versement ou un retrait programmé. Une fois créé, il se matérialise seul à chaque échéance — y compris pour les échéances passées pendant que l'application était fermée."));

children.push(gap(120));
children.push(bonASavoir([
  new TextRun({ text: 'À ne pas confondre avec les mouvements types (chapitre 7), ', size: 21, bold: true }),
  new TextRun({ text: "qui sont un modèle pour vous aider à saisir plus vite.", size: 21 }),
]));

// ── 8.1 ────────────────────────────────────────────────────────────────────
children.push(h2('8.1  Ouvrir le panneau'));
children.push(p('Trois chemins mènent au panneau des mouvements récurrents :'));
children.push(bullet([t('depuis le tableau de bord, bouton '), ui('Mouvements récurrents'), t(" — le compteur indique le nombre de séries actives ;")]));
children.push(bullet([t('depuis une fiche enveloppe, bouton '), ui('Mouvements récurrents'), t(" — l'enveloppe est pré-sélectionnée ;")]));
children.push(bullet([t("depuis le calendrier, onglet "), ui('Mouvements programmés'), t(' (§ 9.4).')]));

children.push(p('Le panneau comporte deux onglets : la création et l’historique.'));
children.push(gap(100));
children.push(...figure('8.1', 'Le panneau des mouvements récurrents',
  "le panneau ouvert sur l'onglet « Créer un récurrent », avec les deux onglets bien visibles et le compteur de séries actives sur « Historique »."));

// ── 8.2 ────────────────────────────────────────────────────────────────────
children.push(h2('8.2  Créer une série'));

children.push(step([t('Choisissez l\''), b('enveloppe'), t(" de destination.")], 50));
children.push(step([t('Indiquez le '), b('type'), t(' : versement ou retrait.')], 50));
children.push(step([t('Saisissez le '), b('montant'), t(' de chaque occurrence.')], 50));
children.push(step([t('Renseignez les '), b('frais de transaction'), t(" — ils seront prélevés à chaque échéance — puis les "), b('frais annuels'), t(' éventuels.')], 50));
children.push(step([t('Fixez la '), b('date de début'), t(' et la '), b('récurrence'), t('.')], 50));
children.push(step([t('Laissez la '), b('date de fin'), t(" vide pour que le mouvement continue de s'appliquer par défaut jusqu'à ce que vous l'arrêtiez, ou fixez-en une.")], 50));
children.push(step([t('Ajoutez une '), b('note'), t(' et le '), b("type d'actif"), t(' si nécessaire.')], 50));
children.push(step([t('Validez avec '), ui('Créer le mouvement régulier'), t('.')], 50));

children.push(gap(100));
children.push(...figure('8.2', 'Le formulaire de création',
  "le formulaire rempli pour un versement mensuel : enveloppe, type Versement sélectionné en vert, montant, récurrence mensuelle et note."));

children.push(h3('Les quatre récurrences'));
children.push(tableau(
  ['Récurrence', 'Périodicité', 'Usage typique'],
  [
    ['Mensuelle',    'Tous les mois',       "Versement programmé sur un contrat"],
    ['Trimestrielle','Tous les 3 mois',     'Dividendes, loyers de SCPI'],
    ['Semestrielle', 'Tous les 6 mois',     'Prime, versement complémentaire'],
    ['Annuelle',     'Une fois par an',     "Versement de fin d'année, frais de tenue de compte"],
  ],
  [2000, 2400, 4626],
));

children.push(gap(160));

children.push(gap(60));
children.push(bonASavoir("Les mouvements récurrents ne concernent que vos enveloppes d'investissement. Une dépense ou un revenu courant — un loyer, un abonnement, un salaire — se saisit dans l'onglet Budget du mois du calendrier, avec sa récurrence (§ 9.5)."));

children.push(h3('Importer un mouvement type'));
children.push(p([
  t("Si vous avez créé des modèles pour cette enveloppe (chapitre 7), le bouton "),
  ui('Importer un mouvement type'),
  t(" reprend en une fois son type d'actif et ses frais. C'est la façon la plus rapide de créer une série cohérente avec vos saisies manuelles."),
]));

children.push(h3('Répartir sur plusieurs actifs'));
children.push(p([
  t("Comme à la saisie manuelle, cochez "), ui("Types d'actifs multiples"),
  t(" puis "), ui('Configurer'),
  t(" pour ventiler chaque occurrence en pourcentages. Le total doit atteindre 100 %."),
]));

children.push(gap(120));
children.push(attention("Une série créée avec une date de début passée génère immédiatement toutes les occurrences écoulées depuis cette date. Vérifiez la date avant de valider."));

// ── 8.3 ────────────────────────────────────────────────────────────────────
children.push(h2("8.3  L'historique"));
children.push(p("Le second onglet liste toutes vos séries, actives comme terminées, chacune teintée à la couleur de son enveloppe."));

children.push(p('Chaque bloc affiche le nom de l’enveloppe, le montant, la récurrence, la période couverte et la note.'));

children.push(p([
  t('Une série '), b('terminée'),
  t(" — arrêtée manuellement, ou dont la date de fin est dépassée — se distingue par une "),
  b('bordure en pointillés'), t(" et un badge « Terminé ». Elle conserve la teinte de son enveloppe, pour rester lisible."),
]));
children.push(gap(100));
children.push(...figure('8.3', "L'historique des séries",
  "l'onglet Historique avec au moins quatre séries : deux actives à bordure pleine et deux terminées à bordure en pointillés, teintées aux couleurs de leurs enveloppes."));

children.push(h3('Modifier une série'));
children.push(p([
  t("Le "), b('crayon'),
  t(" ramène au formulaire, pré-rempli. Changer le montant, la date de début, la récurrence, le type ou les frais s'applique à "), b('toute la série, passé compris'),
  t(" : les mouvements déjà générés sont supprimés puis recréés avec les nouveaux paramètres, et le solde de l'enveloppe est recalculé. Pour changer de montant à partir d'une date sans toucher au passé, arrêtez la série et créez-en une nouvelle."),
]));
children.push(p([
  t("Tout changement de montant est consigné dans un "), b('journal des modifications'),
  t(" affiché sous le bloc, avec sa date et les deux valeurs. Vous gardez ainsi la trace d'une modification de versement."),
]));

children.push(h3('Arrêter une série'));
children.push(p([
  t("L'icône "), b('carré'),
  t(" interrompt la série après confirmation. Les mouvements déjà générés restent en place."),
]));

children.push(h3('Supprimer une série'));
children.push(p([
  t("Disponible uniquement sur une série "), b('arrêtée'),
  t(". Fructificare vous annonce d'abord combien de transactions ont été générées par cette série et pour quel montant total : elles seront supprimées avec elle."),
]));
children.push(gap(100));
children.push(...figure('8.4', 'La confirmation de suppression',
  "le message de confirmation sur une série arrêtée, affichant le nombre de transactions liées et leur montant cumulé."));

children.push(gap(140));
children.push(attention([
  new TextRun({ text: "Arrêter et supprimer ne sont pas la même chose. ", size: 21, bold: true }),
  new TextRun({ text: "Arrêter conserve l'historique : vos versements passés restent dans l'enveloppe et dans vos statistiques. Supprimer efface la série et tous les mouvements qu'elle a produits — votre solde en sera modifié.", size: 21 }),
]));

// ── 8.4 ────────────────────────────────────────────────────────────────────
children.push(h2('8.4  Le rattrapage automatique'));
children.push(p([
  t("Vos séries continuent d'exister quand l'application est fermée. À chaque démarrage, Fructificare compare la date du jour à la dernière échéance connue et génère tout ce qui manque (§ 3.4)."),
]));

children.push(p('Le récapitulatif distingue deux cas :'));
children.push(bullet([b('appliqués automatiquement'), t(" — les occurrences créées sans intervention ;")]));
children.push(bullet([b('répercutés en simulation'), t(" — les occurrences matérialisées dans vos scénarios.")]));

children.push(p("Dans le tableau des mouvements d'une enveloppe, une occurrence issue d'une série porte le marqueur 🔄 et sa note s'affiche en italique (§ 5.10)."));

children.push(gap(120));
children.push(attention("Le rattrapage est plafonné à vingt-quatre mois. Au-delà, les occurrences les plus anciennes sont ignorées et le récapitulatif vous indique combien ont été écartées. Si vous reprenez un suivi après une longue interruption, vérifiez vos soldes."));

module.exports = children;

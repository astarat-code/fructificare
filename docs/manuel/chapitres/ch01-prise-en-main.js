// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
const {
  p, bullet, step, bonASavoir, attention, noteRedac, figure, gap,
  h1, h2, h3, t, b, i, ui, code, tableau,
  GREEN, SLATE, VIOLET, GREY, AMBER, CONTENT_W,
} = require('../lib/kit');
const { Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell,
        WidthType, ShadingType, TableOfContents } = require('docx');

const children = [];

// ═══════════════════════════════════════════════════════════════════════════
//  CHAPITRE 1
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1('1. Prise en main'));

children.push(h2("1.1  Qu'est-ce que Fructificare ?"));
children.push(p("Fructificare suit votre patrimoine d'investisseur particulier : ce que vous versez, ce que ça vaut aujourd'hui, ce que ça vous coûte en frais, et l'imposition qui peut s'appliquer le jour où vous retirerez."));
children.push(p([
  t("L'application ne se connecte à "),
  b('aucune'),
  t(" banque et n'envoie rien sur Internet. Elle tourne en local sur votre ordinateur, et vos données restent dans un fichier que vous contrôlez. En contrepartie, c'est vous qui saisissez la valeur de vos comptes — c'est ce qu'on appelle "),
  b('calibrer'),
  t(", et c'est le geste central du logiciel (chapitre 6)."),
]));

children.push(p([b('Ce que Fructificare fait :')]));
children.push(bullet('suivre plusieurs enveloppes (PEA, CTO, assurance vie, PER, livrets...) et leurs actifs ;'));
children.push(bullet('calculer vos rendements réels, vos frais cumulés et votre plus-value latente ;'));
children.push(bullet("projeter votre patrimoine dans le futur, avec inflation et scénarios de crise ;"));
children.push(bullet('estimer votre imposition et produire un rapport fiscal annuel en PDF ;'));
children.push(bullet('vous aider à tenir le rythme : rappels, objectifs, trophées.'));

children.push(p([b("Ce que Fructificare ne fait pas :")]));
children.push(bullet("récupérer automatiquement le solde de vos comptes (c'est à vous de calibrer, cf. chapitre 6) ;"));
children.push(bullet('passer des ordres ou vous conseiller un placement ;'));
children.push(bullet('remplacer un conseiller en gestion de patrimoine.'));

children.push(gap(120));
children.push(attention([
  new TextRun({ text: "Fructificare est un outil informatif. Il ne délivre aucun conseil en investissement. Les calculs fiscaux suivent les règles françaises en vigueur en janvier 2026 et peuvent évoluer.", size: 21 }),
]));

children.push(h2('1.2  Installer Fructificare'));

children.push(p([
  t("Fructificare est une application Windows classique : un seul fichier à télécharger, aucun "),
  t("prérequis à installer, aucune ligne de commande."),
]));

children.push(h3('Windows'));
children.push(step([t('Téléchargez '), code('Fructificare_x64-setup.exe'), t(" depuis la page des versions du projet.")], 1));
children.push(step("Double-cliquez sur l'installeur. Il s'installe pour votre compte utilisateur seul : aucun mot de passe administrateur n'est demandé.", 1));
children.push(step("Lancez Fructificare depuis le menu Démarrer.", 1));

children.push(gap(120));
children.push(attention([
  new TextRun({ text: "Les versions publiées ne sont pas signées par un certificat de signature de code. Windows affichera donc un avertissement SmartScreen à la première exécution : cliquez sur « Informations complémentaires » puis « Exécuter quand même ».", size: 21 }),
]));
children.push(gap(120));
children.push(bonASavoir([
  new TextRun({ text: 'Pour les plus prudents : ', size: 21, bold: true }),
  new TextRun({ text: "vous pouvez, si vous le souhaitez, vérifier que le fichier téléchargé est bien celui qui a été publié, grâce à son empreinte SHA-256. Cette étape est facultative ; la marche à suivre est décrite au § 14.7.", size: 21 }),
]));

children.push(h3('macOS et Linux'));
children.push(p("Aucune version packagée n'est distribuée pour l'instant. Le code étant ouvert, ces plateformes peuvent être compilées depuis les sources (voir CONTRIBUTING.md dans le dépôt)."));

children.push(h2("1.3  Lancer l'application"));
children.push(p([
  t("Ouvrez "), b('Fructificare'), t(" depuis le menu Démarrer, comme n'importe quel programme."),
]));
children.push(p([
  t("Pour quitter, fermez la fenêtre, ou passez par "), ui('Fichier → Quitter'),
  t(". Vos modifications sont enregistrées automatiquement."),
]));

children.push(h2('1.4  Vos données vous appartiennent'));
children.push(p("Tout ce que vous saisissez — enveloppes, mouvements, calibrations, simulations, objectifs — tient dans un seul fichier JSON, sur votre disque. Aucune copie n'est envoyée ailleurs."));
children.push(p([
  t("Conséquence directe : "), b("si vous perdez ce fichier, vous perdez tout"),
  t(". Le chapitre 14 explique comment la sauvegarde fonctionne et comment restaurer une version antérieure."),
]));
children.push(gap(120));
children.push(bonASavoir([
  new TextRun({ text: 'Prenez l’habitude d’exporter votre fichier de temps en temps (', size: 21 }),
  new TextRun({ text: 'Paramètres → Exporter les données', size: 21, bold: true, color: GREEN }),
  new TextRun({ text: ') et de le ranger ailleurs que sur le disque de travail : clé USB, disque externe, espace de stockage personnel.', size: 21 }),
]));

children.push(h2('1.5  Le premier lancement'));
children.push(p("Au tout premier démarrage, Fructificare vous souhaite la bienvenue et vous propose son tutoriel intégré. Cliquez sur « Continuer » : la fenêtre ne réapparaîtra plus."));
children.push(gap(100));
children.push(...figure('1.1', 'La fenêtre de bienvenue',
  "la fenêtre modale de bienvenue telle qu’elle s’affiche au premier lancement, sur un tableau de bord encore vide en arrière-plan (flou ou assombri par la modale)."));

children.push(h2('1.6  Le vocabulaire de Fructificare'));
children.push(p("Sept mots reviennent en permanence. Les retenir maintenant vous évitera des allers-retours."));

children.push(h3('Portefeuille'));
children.push(p("L'ensemble de vos enveloppes. C'est le total, la vue d'en haut."));
children.push(h3('Enveloppe'));
children.push(p("Un compte d'investissement : un PEA, un contrat d'assurance vie, un compte-titres, un livret. Chaque enveloppe a son type, sa fiscalité, ses frais et sa couleur."));
children.push(h3('Mouvement'));
children.push(p("Un versement ou un retrait sur une enveloppe, à une date donnée. C'est l'unité de base de la saisie."));
children.push(h3('Calibration'));
children.push(p("La valeur réelle d'une enveloppe à une date donnée, relevée sur votre relevé bancaire et saisie à la main. Sans calibration, Fructificare ne connaît que vos versements et ne peut calculer ni performance, ni plus-value."));
children.push(h3('Mouvement type'));
children.push(p("Un modèle de saisie réutilisable, qui mémorise l'enveloppe, le type d'actif et les frais habituels d'un investissement. Il ne déclenche rien tout seul (chapitre 7)."));
children.push(h3('Mouvement récurrent'));
children.push(p("Un versement ou un retrait programmé, qui se matérialise automatiquement à chaque échéance (chapitre 8)."));
children.push(h3('Espèces'));
children.push(p("La poche de liquidités d'une enveloppe : de l'argent présent sur le compte mais pas encore investi, typiquement après une vente quand vous choisissez de garder l'argent dans l'enveloppe en attendant un prochain achat."));

children.push(gap(120));
children.push(bonASavoir([
  new TextRun({ text: 'Mouvement type ou mouvement récurrent ? ', size: 21, bold: true }),
  new TextRun({ text: "Le premier est un gabarit qui vous fait gagner du temps à la saisie. Le second s'applique tout seul aux échéances programmées. Les deux sont indépendants et se trouvent dans deux panneaux distincts.", size: 21 }),
]));

children.push(h2('1.7  Se laisser guider par le tutoriel'));
children.push(p("Fructificare embarque un parcours de quatorze missions qui couvre l'essentiel des fonctions. Il s'affiche en haut du tableau de bord et progresse tout seul au fil de vos actions : vous n'avez rien à valider."));
children.push(p([
  t("Chaque mission débloque un trophée. Le bandeau disparaît de lui-même une fois les quatorze accomplies, et vous les retrouverez sur la page "),
  ui('Trophées'), t(' (chapitre 13).'),
]));
children.push(gap(100));
children.push(...figure('1.2', 'Le bandeau « Tutoriel » du tableau de bord',
  "le bandeau déplié en haut du tableau de bord, montrant la mission en cours, sa description et le bouton « Comment compléter ? »."));

children.push(p([b('Le parcours en quatorze missions')]));

const questRows = [
  ['Q1',  'Première enveloppe',            'Créer une enveloppe et y saisir un mouvement', '4.3, 5.4'],
  ['Q2',  'Diversifier son patrimoine',    "Répartir sur plusieurs types d'actifs",        '5.4'],
  ['Q3',  'Faites connaissance',           'Compléter son profil',                         '14.1'],
  ['Q4',  'Les frais, ça compte',          'Frais de versement et frais annuels',          '5.4, 4.4'],
  ['Q5',  "L'investisseur régulier",       'Programmer un versement récurrent',            '8'],
  ['Q6',  'Planifier sur le long terme',   'Lancer une première simulation',               '10.2'],
  ['Q7',  "Comparer l'impact des frais",   'Deux simulations, deux niveaux de frais',      '10.3'],
  ['Q8',  'Tester la résistance',          'Appliquer un stress test',                     '10.3'],
  ['Q9',  'Comprendre les impôts',         "Utiliser le simulateur d'imposition",          '11.1'],
  ['Q10', 'Calibrer une enveloppe',        'Saisir sa première valeur réelle',             '6'],
  ['Q11', 'Votre rapport fiscal',          'Générer le rapport annuel',                    '11.2'],
  ['Q12', 'Définir ses objectifs',         'Poser un objectif chiffré',                    '13.3'],
  ['Q13', 'Piloter son budget',            "Renseigner l'onglet budget",                   '9.5'],
  ['Q14', 'Évaluer sa santé financière',   'Obtenir son score de santé',                   '13.2'],
];

const COLS = [700, 2400, 4126, 1800];
children.push(new Table({
  columnWidths: COLS,
  width: { size: CONTENT_W, type: WidthType.DXA },
  rows: [
    new TableRow({
      tableHeader: true,
      children: ['#', 'Mission', 'Ce qu’elle fait découvrir', 'Voir §'].map((h, k) => new TableCell({
        width: { size: COLS[k], type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: VIOLET },
        margins: { top: 90, bottom: 90, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: 'FFFFFF' })] })],
      })),
    }),
    ...questRows.map((r, idx) => new TableRow({
      children: r.map((cell, k) => new TableCell({
        width: { size: COLS[k], type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: idx % 2 ? 'F1F5F9' : 'FFFFFF' },
        margins: { top: 70, bottom: 70, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20, bold: k === 0 })] })],
      })),
    })),
  ],
}));

children.push(gap(160));
children.push(bonASavoir("Le tutoriel ne bloque rien. Vous pouvez l'ignorer complètement et utiliser l'application dans l'ordre qui vous arrange — les missions se valideront au passage."));


module.exports = children;

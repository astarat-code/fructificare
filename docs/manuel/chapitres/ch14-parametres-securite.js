// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
const {
  p, bullet, step, bonASavoir, attention, figure, gap,
  h1, h2, h3, t, b, i, ui, code, tableau,
} = require('../lib/kit');
const { TextRun } = require('docx');

const children = [];

// ═══════════════════════════════════════════════════════════════════════════
//  CHAPITRE 14
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1('14. Paramètres, sauvegarde & sécurité'));

children.push(p([
  t("L'accès se fait via "), ui('Fichier > Paramètres'), t('.'),
]));

children.push(...figure('14.1', 'La page Paramètres',
  "la page complète, en pleine largeur"));

// ── 14.1 ───────────────────────────────────────────────────────────────────
children.push(h2('14.1  Votre profil'));

children.push(tableau(
  ['Champ', 'À quoi il sert'],
  [
    ['Pseudo', "Le nom affiché dans la barre latérale, à côté de votre avatar. Purement décoratif."],
    ['Date de naissance', "Personnalise le score de santé financière : la résilience attendue et les bonus dépendent de votre horizon de placement."],
    ['Revenu mensuel net', "Sert au taux d'investissement du budget, au Crossover Point et au score de santé."],
  ],
  [2400, 6626],
));

children.push(gap(100));
children.push(bonASavoir([
  new TextRun({ text: "Ces informations restent locales. ", bold: true, size: 21 }),
  new TextRun({ text: "Elles sont dans votre fichier de sauvegarde, au même titre que vos enveloppes, et ne servent qu'aux calculs de l'application.", size: 21 }),
]));

// ── 14.2 ───────────────────────────────────────────────────────────────────
children.push(h2('14.2  Préférences'));
children.push(bullet([b('Afficher la progression'), t(" — masque le tutoriel et le défi du mois. La page Trophées reste accessible et le score de santé continue d'être calculé.")]));
children.push(bullet([b('Couleurs des enveloppes'), t(" — bascule entre la palette "), i('Pastel'), t(" et la palette "), i('Classique'), t(", en direct. Les couleurs que vous avez personnalisées enveloppe par enveloppe sont préservées.")]));

// ── 14.3 ───────────────────────────────────────────────────────────────────
children.push(h2('14.3  Où sont vos données'));

children.push(tableau(
  ['Contenu', 'Emplacement'],
  [
    ['Sauvegardes automatiques', '%APPDATA%\\app.fructificare.desktop\\save\\'],
    ['Documents PDF importés', '%APPDATA%\\app.fructificare.desktop\\documents imp\\'],
  ],
  [3000, 6026],
));

children.push(p([
  t("Fructificare enregistre tout seul, quelques secondes après chaque modification, et conserve les "),
  b('dix sauvegardes les plus récentes'), t(". La plus ancienne est effacée au fur et à mesure. "),
  t("La carte "), ui('Sauvegarde automatique'), t(" des Paramètres liste ces fichiers et permet d'en "),
  b('restaurer'), t(" un d'un clic."),
]));

children.push(gap(120));
children.push(h3('Exporter et importer'));
children.push(p([
  t("Depuis le menu "), ui('Fichier'), t(" : "), ui('Exporter une sauvegarde…'), t(" écrit un fichier JSON, nommé par défaut "), code('fructificare-save-AAAA-MM-JJ.json'), t(", à l'emplacement de votre choix, et "),
  ui('Importer une sauvegarde…'), t(" l'importe. "), ui('Fichiers récents…'), t(" mémorise les emplacements déjà utilisés."),
]));

children.push(gap(100));
children.push(attention([
  new TextRun({ text: "Attention aux dossiers synchronisés. ", bold: true, size: 21 }),
  new TextRun({ text: "Sur Windows 11, Documents, Bureau et Images sont souvent synchronisés vers OneDrive par défaut. Y exporter une sauvegarde non chiffrée revient à envoyer l'intégralité de votre patrimoine vers le cloud Microsoft. Préférez un dossier local, une clé USB, ou activez le chiffrement.", size: 21 }),
]));

// ── 14.4 ───────────────────────────────────────────────────────────────────
children.push(h2('14.4  Chiffrer vos sauvegardes'));

children.push(p([
  t("Par défaut, vos sauvegardes sont des fichiers JSON "), b('en clair'),
  t(" : n'importe quel programme lancé sous votre session Windows peut les ouvrir et y lire votre patrimoine, vos versements et vos objectifs. "),
  t("Vous pouvez chiffrer vos sauvegardes pour éviter cela."),
]));

children.push(h3('Activer'));
children.push(step([t("Paramètres → "), ui('Sécurité'), t(" → "), ui('Chiffrer mes sauvegardes'), t('.')], 3));
children.push(step("Choisissez une phrase secrète d'au moins 12 caractères, puis validez.", 3));
children.push(step("La sauvegarde en cours est réécrite chiffrée, et les sauvegardes restées en clair sont supprimées.", 3));

children.push(gap(120));
children.push(attention([
  new TextRun({ text: "Cette phrase ne peut pas être réinitialisée. ", bold: true, size: 21 }),
  new TextRun({ text: "Il n'existe ni séquestre de clé, ni question de secours : si vous l'oubliez, vos sauvegardes sont définitivement illisibles, y compris par l'auteur du logiciel. Notez-la dans un gestionnaire de mots de passe avant d'activer la fonction.", size: 21 }),
]));

children.push(p("À chaque ouverture de Fructificare, une fenêtre demandera votre phrase pour débloquer la lecture de la sauvegarde."));

children.push(h3('Vos anciennes sauvegardes'));
children.push(p([
  t("Elles restent "), b('parfaitement utilisables'), t(". Un fichier en clair s'importe normalement, sans qu'on vous demande quoi que ce soit — "),
  t("et il est "), b('automatiquement réenregistré chiffré'), t(". La conversion se fait donc toute seule, par un simple import."),
]));
children.push(p([
  t("Seules les sauvegardes automatiques du dossier de l'application sont effacées à l'activation. "),
  t("Vos exports rangés ailleurs — Bureau, clé USB, disque externe — ne sont pas touchés, et restent en clair jusqu'à ce que vous les réimportiez."),
]));

children.push(h3('Comment ça marche'));
children.push(p([
  t("Votre phrase n'est stockée nulle part. Elle est transformée en clé de 256 bits par une fonction volontairement lente "),
  t("(PBKDF2-SHA256, 600 000 répétitions), qui chiffre ensuite le fichier en AES-256-GCM. "),
  t("Le « GCM » ajoute une signature interne : un fichier modifié, ne serait-ce que d'un bit, est refusé au lieu de produire des chiffres faux."),
]));

children.push(gap(120));
children.push(p([b("La solidité dépend presque entièrement de votre phrase.")]));

children.push(tableau(
  ['Votre phrase', 'Temps de cassage (1 carte graphique)'],
  [
    ["Un mot de passe déjà vu dans une fuite", 'Quelques minutes'],
    ['Un mot suivi de chiffres — « Fructificare2026 ! »', 'Environ un jour'],
    ['Une phrase inventée, « originale »', 'Quelques années'],
    ['Quatre mots tirés au hasard', 'Plusieurs milliers d\'années'],
    ['Cinq mots tirés au hasard', 'Hors d\'atteinte'],
  ],
  [4500, 4526],
));

// ── 14.5 ───────────────────────────────────────────────────────────────────
children.push(h2("14.5  Journal d'activité"));
children.push(p("Un fichier texte de diagnostic, exportable, qui retrace les opérations de l'application : chargements, imports, calibrations, erreurs. Utile pour comprendre un comportement inattendu ou pour accompagner un signalement de bogue."));

// ── 14.6 ───────────────────────────────────────────────────────────────────
children.push(h2('14.6  Tout réinitialiser'));
children.push(p("Il efface définitivement vos enveloppes, transactions, calibrations, mouvements types et récurrents, simulations, budget et documents — la fenêtre de confirmation en donne la liste explicite."));
children.push(p("Votre progression (trophées, quêtes) et vos préférences sont conservées."));

children.push(gap(120));
children.push(attention([
  new TextRun({ text: "Exportez une sauvegarde avant. ", bold: true, size: 21 }),
  new TextRun({ text: "La réinitialisation n'a pas d'annulation, et les sauvegardes automatiques seront écrasées par la nouvelle situation — vide — dans les secondes qui suivent.", size: 21 }),
]));

// ── 14.7 ───────────────────────────────────────────────────────────────────
children.push(h2("14.7  Vérifier l'application que vous installez"));

children.push(p([
  t("Cette vérification est "), b('facultative'),
  t(". Les versions publiées de Fructificare ne sont pas signées par un certificat de signature de code : Windows affiche un avertissement SmartScreen à la première exécution, et rien ne distingue, à l'œil, le vrai installeur d'une copie modifiée. Si vous voulez vous en assurer, l'empreinte du fichier le permet."),
]));

children.push(p([
  t("Chaque version est publiée avec un fichier "), code('SHA256SUMS.txt'),
  t(" : l'empreinte des binaires, 64 caractères qui changent entièrement si un seul octet du fichier change. Pour la vérifier, dans PowerShell :"),
]));
children.push(p([code('Get-FileHash .\\Fructificare_x64-setup.exe -Algorithm SHA256')], { spacing: { after: 160 } }));
children.push(p("Comparez le résultat avec la ligne correspondante du fichier publié. S'ils diffèrent, n'exécutez pas le fichier."));

module.exports = children;

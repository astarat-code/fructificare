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
//  CHAPITRE 3
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1("3. L'interface générale"));

children.push(p("Toutes les pages de Fructificare partagent le même cadre : une barre latérale à gauche avec le contenu affiché à droite."));
children.push(gap(100));
children.push(...figure('3.1', "Vue d'ensemble de l'interface",
  "l'application en plein écran sur le tableau de bord, avec la barre latérale complète visible à gauche. Prévoir une version annotée avec des repères numérotés : ① logo, ② profil, ③ navigation, ④ commandes du bas."));

children.push(h2('3.1  La barre latérale'));

children.push(h3('Le logo'));
children.push(p('Un clic ramène au tableau de bord, depuis n’importe quel écran.'));

children.push(h3('Votre profil'));
children.push(p([
  t("Un avatar et votre pseudo. Un clic ouvre la page "), ui('Trophées'), t('.'),
]));
children.push(p([
  t("L'avatar reflète votre "), b('capital total'),
  t(". Il vous fait vivre une épopée, de vos premiers pas jusqu'aux étoiles, et passe à l'or, cerclé d'un liseré, au-delà du million (§ 13.1)."),
]));

children.push(h3('La navigation'));
children.push(bullet([ui('Tableau de bord'), t(' — la vue globale de votre patrimoine (chapitre 4).')]));
children.push(bullet([ui('Simulation'), t(' — projections et scénarios (chapitre 10).')]));
children.push(bullet([ui('Calendrier'), t(' — échéances, rappels et budget (chapitre 9).')]));
children.push(bullet([ui('Documents'), t(" — vos relevés et avis d'opéré au format PDF (chapitre 12).")]));
children.push(bullet([ui('Rapport fiscal'), t(' — déclaration et export PDF (chapitre 11).')]));
children.push(bullet([ui('Trophées'), t(' — progression, score de santé, objectifs (chapitre 13).')]));

children.push(h3('Le menu en haut de la fenêtre'));
children.push(p([
  t("Le glossaire et les paramètres ne figurent pas dans la barre latérale : ils s'ouvrent depuis le menu de la fenêtre, "),
  ui('Éditer > Glossaire'), t(" (chapitre 15) et "), ui('Fichier > Paramètres'),
  t(" (chapitre 14). Ce menu regroupe aussi la sauvegarde, l'affichage et l'aide (§ 16.6)."),
]));


children.push(h2('3.2  Les commandes globales'));

children.push(h3('Langue'));
children.push(p([
  t("Le menu "), ui('Affichage › Langues'), t(" propose "), ui('Français'), t(' ou '), ui('English'),
  t(" et bascule toute l'interface avec une traduction complète français / anglais. Le menu de la fenêtre et ce manuel suivent la langue choisie."),
]));

children.push(h3('Thème clair ou sombre'));
children.push(p([
  t("Le menu "), ui('Affichage › Thèmes'), t(" propose le "), ui('Thème sombre'), t(' ou le '), ui('Thème clair'),
  t(". Votre choix est enregistré dans votre fichier de sauvegarde : vous le retrouverez sur un autre poste après import."),
]));

children.push(h3('Notifications'));
children.push(p([
  t("La cloche affiche le nombre de messages non lus. Le panneau permet de marquer comme lu, de tout marquer comme lu, de supprimer une notification, ou de sauter directement à la page concernée."),
]));
children.push(p("Fructificare vous notifie du conseil du jour, d'un trophée bientôt atteignable, d'un objectif proche de sa cible, d'un palier FIRE franchi, d'une échéance fiscale ou d'une série de connexion sur le point d'être perdue. Le rythme est plafonné à deux notifications de progression par jour."));
children.push(gap(100));
children.push(...figure('3.2', 'Le panneau de notifications',
  "la cloche avec son badge de compteur, panneau ouvert, montrant trois ou quatre notifications de types différents et le bouton « Tout marquer comme lu »."));

children.push(h2("3.3  L'affichage sur petit écran"));
children.push(p("En dessous d'une certaine largeur, la barre latérale se replie. Un bouton menu apparaît en haut à gauche, le logo se réduit à son icône, et la cloche des notifications remonte dans l'en-tête."));
children.push(gap(100));
children.push(...figure('3.3', "L'interface en largeur réduite",
  "deux captures en format mobile : l'en-tête compact avec le menu fermé, puis la barre latérale ouverte en superposition.", ["Menu fermé", "Menu ouvert"]));

children.push(h2('3.4  Le rattrapage au démarrage'));
children.push(p([
  t("Vos mouvements récurrents (chapitre 8) continuent de s'appliquer même quand l'application est fermée. À chaque lancement, Fructificare rattrape les échéances manquées depuis votre dernière session et les applique."),
]));
children.push(p([
  t("Un message apparaît en haut à droite. Cliquez sur "), ui('Voir le détail'),
  t(" pour ouvrir le récapitulatif complet :"),
]));
children.push(bullet('les mouvements appliqués automatiquement, avec leur date et leur montant ;'));
children.push(bullet('les occurrences répercutées dans vos simulations.'));
children.push(gap(100));
children.push(...figure('3.4', 'Le récapitulatif de rattrapage',
  "la fenêtre « Rattrapage des mouvements récurrents » ouverte, montrant la période couverte et une liste de mouvements appliqués."));

children.push(gap(140));
children.push(attention("Le rattrapage est plafonné à vingt-quatre mois. Si vous rouvrez l'application après plus de deux ans, les occurrences plus anciennes sont ignorées et le récapitulatif vous le signale explicitement."));



module.exports = children;

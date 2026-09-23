// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
const {
  p, bullet, step, bonASavoir, attention, figure, gap,
  h1, h2, h3, t, b, i, ui, code, tableau,
} = require('../lib/kit');
const { TextRun } = require('docx');

const children = [];

// ═══════════════════════════════════════════════════════════════════════════
//  CHAPITRE 12
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1('12. Documents'));

children.push(p([
  t("Un relevé de compte, un avis d'opéré, un IFU : ces PDF finissent en général éparpillés entre "),
  t("les téléchargements, les pièces jointes de courriels et un dossier oublié. Fructificare vous permet de les "),
  b('ranger avec les enveloppes auxquelles ils se rapportent'),
  t(", pour les retrouver le jour où vous en avez besoin — au moment de déclarer, ou de calibrer."),
]));

children.push(...figure('12.1', 'La page Documents',
  "la page complète, en pleine largeur"));

// ── 12.1 ───────────────────────────────────────────────────────────────────
children.push(h2('12.1  Où se placent vos documents importés'));

children.push(p([
  t("Comme le reste de Fructificare, ces fichiers restent stockés en local. À l'import, le PDF est "),
  b('copié'), t(" dans un dossier de l'application : "),
]));
children.push(p([code('%APPDATA%\\app.fructificare.desktop\\documents imp\\')], { spacing: { after: 160 } }));

children.push(p([
  t("Chaque enveloppe y reçoit son propre sous-dossier ; les documents non rattachés à une enveloppe vont dans un sous-dossier « global »."),
]));
children.push(gap(100));
children.push(bonASavoir("C'est une copie qui va dans le dossier de l'application, votre fichier d'origine reste où il était."));

children.push(gap(100));
children.push(attention([
  new TextRun({ text: "Le fichier de sauvegarde JSON ne contient que les métadonnées (nom, date, type, chemin), jamais le PDF lui-même. ", size: 21 }),
  new TextRun({ text: "Si vous changez d'ordinateur, copiez aussi le dossier « documents imp » : sinon vos fichiers ne suivront pas et le programme affichera « Fichier introuvable ».", size: 21, bold: true }),
]));

// ── 12.2 ───────────────────────────────────────────────────────────────────
children.push(h2('12.2  Ajouter un document'));

children.push(step([t("Depuis la page "), ui('Documents'), t(", ou depuis la section Documents d'une fiche enveloppe, cliquez sur "), ui('Ajouter un document'), t('.')], 2));
children.push(step("Choisissez un PDF. Le sélecteur ne propose que ce format.", 2));
children.push(step("Renseignez la fiche, puis validez. Le fichier est recopié et la fiche apparaît dans la liste.", 2));

children.push(gap(120));
children.push(h3('Les champs de la fiche'));
children.push(tableau(
  ['Champ', 'À quoi il sert'],
  [
    ['Date', "La date du document — pas celle de l'import. C'est elle qui sert au classement."],
    ['Type de document', "Relevé de compte / de titres · Avis d'opéré · Relevé fiscal / IFU · Rapport annuel / Document d'information · Autre"],
    ['Libellé du type', "N'apparaît que si vous avez choisi « Autre ». Permet de nommer votre propre catégorie, par exemple « Attestation fiscale »."],
    ['Nom', "Le libellé affiché dans la liste. Pré-rempli avec le nom du fichier, modifiable."],
    ['Enveloppe liée', "L'enveloppe concernée, ou « Aucune » pour un document global."],
  ],
  [2300, 6726],
));

// ── 12.3 ───────────────────────────────────────────────────────────────────
children.push(h2('12.3  Consulter, modifier, supprimer'));

children.push(p("Chaque ligne de la liste porte trois boutons."));
children.push(bullet([b('Ouvrir'), t(" — le PDF s'ouvre dans votre lecteur habituel (Acrobat, Edge, Aperçu…).")]));
children.push(bullet([b('Modifier'), t(" — pour modifier les données renseignées à l'import du document.")]));
children.push(bullet([b('Supprimer'), t(" — retire la fiche et efface le fichier recopié, après confirmation. Votre PDF d'origine, lui, n'est pas touché.")]));

children.push(gap(120));
children.push(p([
  t("Un bouton "), ui('Dossier'), t(" ouvre directement le dossier des documents importés dans l'explorateur Windows, "),
  t("si vous préférez y accéder à la main."),
]));

children.push(h3("« Fichier introuvable »"));
children.push(p([
  t("Ce badge orange signale une fiche dont le PDF a disparu du dossier de l'application — "),
  t("supprimé manuellement, ou non recopié lors d'un changement d'ordinateur. La fiche reste, "),
  t("pour que vous sachiez ce qui manque ; il suffit de la supprimer et de réimporter le document."),
]));

// ── 12.4 ───────────────────────────────────────────────────────────────────
children.push(h2('12.4  Deux points de sécurité'));

children.push(p([
  t("Ouvrir un document, c'est demander à Windows de lancer un programme. Fructificare encadre donc cette opération de deux façons, "),
  t("invisibles à l'usage mais qui expliquent certains refus."),
]));

children.push(bullet([
  b("Les chemins sont vérifiés."),
  t(" Un document dont l'emplacement enregistré ne correspond pas exactement à la forme attendue est refusé, avec le message "),
  i("« Ce document référence un emplacement invalide »"),
  t(". Ce contrôle protège d'une sauvegarde JSON modifiée qui tenterait de faire ouvrir un fichier arbitraire de votre disque."),
]));

children.push(bullet([
  b("L'accès disque est restreint."),
  t(" L'application ne peut lire et écrire que dans ses propres dossiers. Un PDF situé ailleurs n'est accessible qu'au moment où "),
  b('vous'), t(" le désignez dans la boîte de dialogue — et pour cette fois seulement."),
]));

module.exports = children;

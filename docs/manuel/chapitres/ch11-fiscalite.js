// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
const {
  p, bullet, step, bonASavoir, attention, figure, gap,
  h1, h2, h3, t, b, i, ui, code, tableau,
} = require('../lib/kit');
const { TextRun } = require('docx');

const children = [];

// ═══════════════════════════════════════════════════════════════════════════
//  CHAPITRE 11
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1('11. Fiscalité'));

children.push(p([
  t("Un gain n'est vraiment à vous qu'après impôt. Fructificare propose deux outils complémentaires : "),
  t("un "), b('simulateur'), t(" pour répondre à « et si je retirais maintenant ? », et un "),
  b('rapport fiscal'), t(" pour retrouver, l'année suivante, ce qu'il faut déclarer."),
]));

children.push(gap(120));
children.push(attention([
  new TextRun({ text: "Fructificare n'est pas un logiciel de déclaration. Les montants qu'il produit sont des estimations, calculées selon les règles françaises en vigueur en janvier 2026. Vérifiez-les avec l'imprimé fiscal unique (IFU) que votre établissement vous envoie.", size: 21 }),
]));

// ── 11.1 ───────────────────────────────────────────────────────────────────
children.push(h2("11.1  Le simulateur d'imposition"));

children.push(...figure('11.1', "Le simulateur d'imposition",
  "la page complète, en pleine largeur"));

children.push(p("Accessible depuis la page Simulation, il fonctionne sur des montants que vous saisissez librement (ne lit pas vos enveloppes)."));

children.push(tableau(
  ['Onglet', 'Ce que vous saisissez', 'Ce qu\'il calcule'],
  [
    ['PEA', 'Valeur actuelle, versements, durée de détention', "Plus-value, prélèvements sociaux, impôt sur le revenu, imposition totale, valeur nette, taux effectif"],
    ['CTO', 'Idem, avec une case « crypto »', 'Idem, en appliquant le régime spécifique aux crypto-actifs'],
    ['Assurance vie', 'Idem, plus la situation familiale', "Idem, en appliquant l'abattement de 4 600 € (9 200 € pour un couple) au-delà de 8 ans"],
    ['Documentation', '—', 'Les barèmes en vigueur, une fiche par enveloppe, et des pistes d\'optimisation'],
  ],
  [1700, 3400, 3926],
));

children.push(p("Chaque onglet se termine par un conseil contextuel : par exemple, sur un PEA de moins de cinq ans, l'intérêt d'attendre le cap avant de retirer."));

// ── 11.2 ───────────────────────────────────────────────────────────────────
children.push(h2('11.2  Le rapport fiscal'));

children.push(...figure('11.2', 'La page Rapport fiscal',
  "la page complète, en pleine largeur"));

children.push(p([
  t("Contrairement au simulateur, le rapport fiscal travaille sur "), b('vos données réelles'),
  t(". Vous choisissez une année, et il reconstitue ce qui s'est passé sur chaque enveloppe."),
]));

children.push(h3("Ce que montre chaque carte"));
children.push(bullet("les mouvements de l'année, avec un badge « Retraits imposables » sur les retraits concernés ;"));
children.push(bullet("les versements de l'année, les retraits imposables de l'année, les versements cumulés ;"));
children.push(bullet([b('le solde actuel'), t(" — la dernière valeur calibrée de l'enveloppe, et ses "), b('espèces'), t(" non réinvesties quand il y en a ;")]));
children.push(bullet([b("le détail de l'imposition"), t(" — plus-value estimée, prélèvements sociaux, impôt sur le revenu, total.")]));

children.push(h3('Quels retraits sont imposables'));
children.push(bullet([b('PEA, PER, assurance vie'), t(" — seul l'argent qui sort de l'enveloppe est imposable ; vendre et garder les espèces à l'intérieur ne déclenche rien.")]));
children.push(bullet([b('Compte-titres (CTO)'), t(" — chaque vente est imposable l'année où elle a lieu, même si le produit reste en espèces sur le compte.")]));
children.push(bullet([b('Crypto'), t(" — la vente contre des euros est imposable, dans toute enveloppe. Les plus-values sont imposables au titre de l'année des cessions, mais se déclarent et se paient l'année suivante : le rapport le rappelle sur la carte concernée.")]));

children.push(gap(120));
children.push(bonASavoir([
  new TextRun({ text: "Un solde précédé d'un « ~ » est estimé. ", bold: true, size: 21 }),
  new TextRun({ text: "Faute de calibration, Fructificare le déduit de vos versements nets. C'est un ordre de grandeur et non un montant constaté.", size: 21 }),
]));

children.push(h3('Pourquoi calibrer change tout'));
children.push(p([
  t("Fructificare applique la règle des rachats partiels, retrait par retrait et dans l'ordre chronologique :"),
]));
children.push(p([code('Gain imposable = Montant du retrait − (Versements nets × Montant du retrait ÷ Valeur totale de l\'enveloppe)')], { spacing: { after: 140 } }));
children.push(bullet([b('Versements nets'), t(" — l'argent que vous avez apporté, diminué de la part de capital déjà remboursée par vos retraits précédents ;")]));
children.push(bullet([b("Valeur totale de l'enveloppe"), t(" — sa valeur juste avant le retrait : la calibration la plus proche, espèces comprises, ramenée à la date du retrait par les versements et retraits intervenus entre les deux.")]));
children.push(p([
  t("Par exemple, pour 100 000 € versés sur une assurance vie qui en vaut 150 000 €, un retrait de 50 000 € contient 16 666,67 € de gains ; il reste ensuite 66 666,67 € de versements nets pour le retrait suivant. "),
  t("Pour la crypto, la loi applique le même principe aux cessions. Pour les actions d'un compte-titres, le calcul officiel repose sur le prix d'achat moyen des titres vendus : le résultat affiché est alors une estimation."),
]));
children.push(p([
  t("Cette formule a une conséquence directe : "), b("tant que l'enveloppe n'est pas calibrée, la plus-value estimée vaut zéro"),
  t(". Sans valorisation connue, l'application ne peut pas inventer un gain — et n'affichera donc aucune imposition. "),
  b("Calibrer est la condition pour obtenir une estimation fiscale utile"), t(" (chapitre 6)."),
]));

children.push(h3("Quand l'imposition ne s'affiche pas"));
children.push(p("Les lignes d'imposition n'apparaissent que pour les enveloppes dotées d'un régime fiscal. Sinon, un message explique pourquoi."));
children.push(tableau(
  ['Situation', 'Message affiché'],
  [
    ["Aucun retrait dans l'année", "Aucun retrait cette année : pas d'imposition à déclarer."],
    ['Retraits sans plus-value', "Retraits sans plus-value sur la période : pas d'imposition."],
    ['Enveloppe personnalisée', "Enveloppe personnalisée : aucun régime fiscal pré-calculé."],
    ['Livret réglementé', "Livret réglementé : intérêts exonérés d'impôt et de prélèvements sociaux."],
    ['Retraits avec plus-value', 'Le détail du régime appliqué (voir les annexes)'],
  ],
  [2800, 6226],
));

children.push(h3('Le badge « Défiscalisé »'));
children.push(p([
  t("Un liseré vert et un badge "), ui('Défiscalisé'),
  t(" signalent les enveloppes ayant franchi leur seuil d'ancienneté à la fin de l'année du rapport : 5 ans pour un PEA, 8 ans pour une assurance vie."),
]));

// ── 11.3 ───────────────────────────────────────────────────────────────────
children.push(h2("11.3  L'export PDF"));

children.push(p([
  t("Le bouton "), ui('Rapport fiscal'), t(" produit le rapport à l'écran ; vous pouvez "), ui('Télécharger le PDF'),
  t(" de ce rapport pour en faire un document à archiver ou à transmettre à votre comptable."),
]));

children.push(p([b('Le PDF standard contient :')]));
children.push(bullet("un en-tête et la liste des enveloppes concernées ;"));
children.push(bullet([b("une synthèse par type d'actif"), t(" — retraits, plus-values, imposition, avec le rappel des taux appliqués ;")]));
children.push(bullet([b('le détail par enveloppe'), t(" — tableau des mouvements, encadré de synthèse, mention de maturité fiscale ;")]));
children.push(bullet('des pieds de page numérotés.'));

children.push(gap(120));
children.push(h3('Le rapport de performance détaillé'));
children.push(p([
  t("Une case à cocher ajoute quatre pages d'analyse. Elle "), b("nécessite au moins une calibration sur l'année"),
  t(" : sans valorisation, il n'y a pas de performance à tracer."),
]));
children.push(step([b('Couverture'), t(" — la courbe annuelle de votre portefeuille.")], 1));
children.push(step([b('Synthèse du portefeuille'), t(" — valeurs de début et de fin, camembert de répartition, livrets réglementés comptés à part.")], 1));
children.push(step([b('Performance par enveloppe'), t(" — une section par enveloppe, avec sa courbe mensuelle.")], 1));
children.push(step([b('Analyse annuelle globale'), t(" — rendements par année, frais de versement, progression FIRE.")], 1));

module.exports = children;

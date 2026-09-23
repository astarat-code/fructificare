// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * generate-avatar-icons.js — Produces src/components/gamification/avatarIcons.js.
 *
 * The avatars embed NO icon library: only the paths actually used are copied, with their
 * license. This script makes that copy reproducible and verifiable, rather than done by
 * hand.
 *
 * Usage:
 *   node scripts/generate-avatar-icons.js <@phosphor-icons/core folder> <dragon.svg>
 *
 *   • <@phosphor-icons/core folder>: the unpacked package (npm pack @phosphor-icons/core),
 *     containing assets/fill/<name>-fill.svg and LICENSE;
 *   • <dragon.svg>: svgs/solid/dragon.svg from Font Awesome Free 6 (Phosphor has no
 *     dragon).
 */
const fs = require('fs');
const path = require('path');

const [PHOSPHOR, DRAGON] = process.argv.slice(2);
if (!PHOSPHOR || !DRAGON) {
  console.error('Usage : node scripts/generate-avatar-icons.js <dossier @phosphor-icons/core> <dragon.svg>');
  process.exit(1);
}
const SORTIE = path.join(__dirname, '..', 'src', 'components', 'gamification', 'avatarIcons.js');

/** Palier (clé d'avatarService) → icône Phosphor, graisse « fill ». */
const PHOSPHOR_ICONES = {
  premiers_pas:   'footprints',
  jeune_pousse:   'plant',
  sac_au_dos:     'backpack',
  boussole:       'compass',
  carte:          'map-trifold',
  feu_de_camp:    'campfire',
  monture:        'horse',
  bouclier:       'shield',
  epee:           'sword',
  forteresse:     'castle-turret',
  tresor:         'treasure-chest',
  grand_large:    'sailboat',
  sommet:         'mountains',
  diamant:        'diamond',
  couronne:       'crown',
  decollage:      'rocket-launch',
  orbite:         'planet',
  etoile_filante: 'shooting-star',
};

/**
 * Extrait viewBox et tracés d'un SVG. Refuse tout élément autre que <path> : un
 * cercle ou un rectangle ignoré en silence donnerait une icône amputée.
 */
function lireSvg(fichier) {
  const svg = fs.readFileSync(fichier, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const viewBox = (svg.match(/viewBox="([^"]+)"/) || [])[1];
  if (!viewBox) throw new Error(`viewBox absent : ${fichier}`);
  const elements = [...svg.matchAll(/<([a-zA-Z]+)[\s>/]/g)].map(m => m[1]).filter(n => n !== 'svg');
  const inattendus = elements.filter(n => n !== 'path');
  if (inattendus.length) throw new Error(`éléments non gérés (${inattendus.join(', ')}) : ${fichier}`);
  const traces = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map(m => m[1]);
  if (!traces.length) throw new Error(`aucun tracé : ${fichier}`);
  if (/opacity=/.test(svg)) throw new Error(`opacité inattendue en graisse fill : ${fichier}`);
  return { viewBox, traces };
}

const icones = {};
for (const [palier, nom] of Object.entries(PHOSPHOR_ICONES)) {
  icones[palier] = { source: `phosphor:${nom}`, ...lireSvg(path.join(PHOSPHOR, 'assets', 'fill', `${nom}-fill.svg`)) };
}
icones.dragon = { source: 'fontawesome:dragon', ...lireSvg(DRAGON) };

// Ordre de sortie = ordre de progression, pour une relecture facile.
const ORDRE = [
  'premiers_pas', 'jeune_pousse', 'sac_au_dos', 'boussole',
  'carte', 'feu_de_camp', 'monture', 'bouclier',
  'epee', 'forteresse', 'tresor', 'dragon',
  'grand_large', 'sommet', 'diamant', 'couronne',
  'decollage', 'orbite', 'etoile_filante',
];
if (ORDRE.length !== Object.keys(icones).length) throw new Error('ORDRE et icônes divergent');

const phosphorVersion = JSON.parse(fs.readFileSync(path.join(PHOSPHOR, 'package.json'), 'utf8')).version;
const licencePhosphor = fs.readFileSync(path.join(PHOSPHOR, 'LICENSE'), 'utf8').trim();
const enteteFa = (fs.readFileSync(DRAGON, 'utf8').match(/<!--([\s\S]*?)-->/) || [])[1];
if (!enteteFa || !/License/i.test(enteteFa)) throw new Error('mention de licence Font Awesome introuvable dans dragon.svg');

const commentaire = (texte) => texte.split('\n').map(l => ` * ${l}`.trimEnd()).join('\n');
const entrees = ORDRE.map((palier) => {
  const { source, viewBox, traces } = icones[palier];
  return `  ${palier}: {\n    source: '${source}',\n    viewBox: '${viewBox}',\n    traces: [\n${traces.map(d => `      '${d}',`).join('\n')}\n    ],\n  },`;
}).join('\n');

const sortie = `/**
 * Tracés des avatars de progression — FICHIER GÉNÉRÉ, ne pas modifier à la main.
 * Régénérer : node scripts/generate-avatar-icons.js <@phosphor-icons/core> <dragon.svg>
 *
 * Seuls les tracés utilisés sont recopiés, plutôt que d'installer une bibliothèque :
 * une dépendance de plus est un vecteur d'attaque de plus (voir SECURITY.md).
 * Clés = paliers d'avatarService. Graisse « pleine » : chaque tracé est rempli en
 * currentColor.
 *
 * ── Phosphor Icons ${phosphorVersion} (18 icônes) ───────────────────────────────────
${commentaire(licencePhosphor)}
 *
 * ── Font Awesome Free (icône « dragon ») ───────────────────────────────────────
${commentaire(enteteFa.trim().replace(/^!\s*/, ''))}
 */

export const AVATAR_ICONS = {
${entrees}
};
`;

fs.writeFileSync(SORTIE, sortie);
console.log(`avatarIcons.js écrit : ${ORDRE.length} icônes, ${Math.round(sortie.length / 1024)} Ko`);

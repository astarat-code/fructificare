// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * avatars-shoot.js — Avatar images for the manual's table (§ 16.5).
 *
 * Reads the paths (frontend/src/components/gamification/avatarIcons.js) and the
 * chapters (frontend/src/services/avatarService.js), then photographs each icon on a
 * transparent background with Edge: captures/avatars/<tier>.png, plus
 * captures/avatars/legende.png (the gold, ringed example of the Legend).
 * Colors are the ones from AvatarIcon.jsx.
 *
 * Usage:  node avatars-shoot.js
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const FRONT = path.join(__dirname, '..', '..', 'frontend', 'src');
const OUT = path.join(__dirname, 'captures', 'avatars');
const TAILLE = 96;

const COULEUR_CHAPITRE = { 1: '#059669', 2: '#0284C7', 3: '#6366F1', 4: '#8B5CF6', 5: '#C026D3' };
const GOLD = '#F59E0B';
const GOLD2 = '#D97706';

/** Charge un module ES simple (exports de constantes) sans outil de compilation. */
function charger(fichier, noms) {
  const src = fs.readFileSync(fichier, 'utf8')
    .replace(/^import .*$/gm, '')
    .replace(/^export default .*$/gm, '')
    .replace(/^export /gm, '');
  return new Function(`${src}\nreturn { ${noms.join(', ')} };`)();
}

const { AVATAR_ICONS } = charger(path.join(FRONT, 'components', 'gamification', 'avatarIcons.js'), ['AVATAR_ICONS']);
const { AVATAR_STEPS } = charger(path.join(FRONT, 'services', 'avatarService.js'), ['AVATAR_STEPS']);

const svg = (tier, couleur) => {
  const { viewBox, traces } = AVATAR_ICONS[tier];
  return `<svg viewBox="${viewBox}" width="100%" height="100%" fill="${couleur}">${traces.map(d => `<path d="${d}"/>`).join('')}</svg>`;
};

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    defaultViewport: { width: 400, height: 400, deviceScaleFactor: 3 },
    args: ['--disable-gpu', '--force-color-profile=srgb'],
  });
  const page = await browser.newPage();

  const prises = AVATAR_STEPS.map(s => ({
    nom: s.tier,
    html: `<div id="a" style="width:${TAILLE}px;height:${TAILLE}px">${svg(s.tier, COULEUR_CHAPITRE[s.chapitre])}</div>`,
  }));
  // Légende : même rendu que l'application (anneau d'or, marge intérieure).
  const ep = Math.round(TAILLE * 0.055);
  const marge = Math.round(TAILLE * 0.12);
  prises.push({
    nom: 'legende',
    html: `<div style="padding:12px;display:inline-block"><div id="a" style="box-sizing:border-box;width:${TAILLE}px;height:${TAILLE}px;border-radius:9999px;border:${ep}px solid ${GOLD};box-shadow:0 0 0 1px ${GOLD2};padding:${marge}px">${svg('couronne', GOLD)}</div></div>`,
  });

  for (const { nom, html } of prises) {
    await page.setContent(`<html><body style="margin:0;background:transparent">${html}</body></html>`);
    const el = await page.$('#a');
    await el.screenshot({ path: path.join(OUT, `${nom}.png`), omitBackground: true });
  }
  await browser.close();
  console.log(`${prises.length} images écrites dans ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * rendre.js — Converts the manual's SVG diagrams to PNG (captures/fig-<n>.png).
 *
 * Same pixel density as the screenshots (1.5), so that lib/kit.js sizes them the same
 * way. Processes schemas/ → captures/ (French) and schemas-en/ → captures-en/ (English).
 *
 * Usage:  node schemas/rendre.js
 *         EDGE_URL=http://127.0.0.1:9333 node schemas/rendre.js   (Edge already running)
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const RACINE = path.join(__dirname, '..');
const DOSSIERS = [['schemas', 'captures'], ['schemas-en', 'captures-en']];

(async () => {
  const browser = process.env.EDGE_URL
    ? await puppeteer.connect({ browserURL: process.env.EDGE_URL })
    : await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--disable-gpu', '--force-color-profile=srgb'] });
  const page = await browser.newPage();
  for (const [source, cible] of DOSSIERS) {
    const dossier = path.join(RACINE, source);
    if (!fs.existsSync(dossier)) continue;
    for (const f of fs.readdirSync(dossier).filter(x => x.endsWith('.svg'))) {
      const svg = fs.readFileSync(path.join(dossier, f), 'utf8');
      const w = Number((svg.match(/width="(\d+)"/) || [])[1] || 1000);
      const h = Number((svg.match(/height="(\d+)"/) || [])[1] || 700);
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 1.5 });
      await page.setContent(`<html><body style="margin:0;background:#fff">${svg}</body></html>`);
      const sortie = path.join(RACINE, cible, f.replace(/\.svg$/, '.png'));
      await page.screenshot({ path: sortie, clip: { x: 0, y: 0, width: w, height: h } });
      console.log(sortie);
    }
  }
  if (process.env.EDGE_URL) { await page.close(); browser.disconnect(); } else await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });

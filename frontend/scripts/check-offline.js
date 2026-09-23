// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * check-offline.js — Checks that the build loads no remote resource.
 *
 * Fructificare claims to work offline and to send nothing to the Internet. That is the
 * central promise of the product, so it must be verified mechanically rather than from
 * memory: a <link> tag to Google Fonts finding its way back into public/index.html would
 * be enough to hand every user's IP address over on every launch.
 *
 * The check covers what the browser WOULD actually load: src/href attributes in the HTML,
 * and url()/@import in the stylesheets. A URL sitting in an inert JavaScript string is not
 * a load — and would be blocked by the CSP anyway. One known exception is documented below.
 *
 * Usage:  node scripts/check-offline.js
 */
const fs = require('fs');
const path = require('path');

const BUILD = path.join(__dirname, '..', 'build');

// Chaînes interdites PARTOUT, y compris dans le JavaScript : leur seule présence
// signale une régression des polices auto-hébergées (voir scripts/fetch-fonts.py).
const FORBIDDEN_ANYWHERE = ['fonts.googleapis.com', 'fonts.gstatic.com'];

// URL distantes présentes dans le bundle mais jamais atteintes par l'application.
// À ne compléter qu'après avoir vérifié qu'aucun chemin de code ne les utilise.
const KNOWN_INERT = [
  // jsPDF : chargerait PDFObject uniquement pour output('dataurlnewwindow'), un mode
  // que l'application n'utilise pas (TaxReport.js appelle output('arraybuffer')).
  'cdnjs.cloudflare.com/ajax/libs/pdfobject',
  // Commentaire d'en-tête de la préflight Tailwind, dans le CSS compilé.
  'tailwindcss.com',
];

const problems = [];

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

function relative(file) {
  return path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/');
}

function isInert(url) {
  return KNOWN_INERT.some((known) => url.includes(known));
}

if (!fs.existsSync(BUILD)) {
  console.error(`${BUILD} introuvable — lancez « npm run build » d'abord.`);
  process.exit(1);
}

const files = walk(BUILD);

// 1. Les hôtes de polices, partout.
for (const file of files) {
  if (/\.(woff2?|ttf|png|jpe?g|ico|svg)$/i.test(file)) continue;
  const content = fs.readFileSync(file, 'utf8');
  for (const needle of FORBIDDEN_ANYWHERE) {
    if (content.includes(needle)) {
      problems.push(`${relative(file)} : référence à ${needle} (les polices doivent être locales)`);
    }
  }
}

// 2. Ce que le HTML ferait charger au navigateur.
for (const file of files.filter((f) => f.endsWith('.html'))) {
  const html = fs.readFileSync(file, 'utf8');
  for (const m of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
    const url = m[1];
    if (/^https?:\/\//i.test(url) && !isInert(url)) {
      problems.push(`${relative(file)} : charge ${url}`);
    }
  }
}

// 3. Ce que les feuilles de style feraient charger.
for (const file of files.filter((f) => f.endsWith('.css'))) {
  const css = fs.readFileSync(file, 'utf8');
  for (const m of css.matchAll(/url\(\s*["']?(https?:\/\/[^"')]+)/gi)) {
    if (!isInert(m[1])) problems.push(`${relative(file)} : url(${m[1]})`);
  }
  for (const m of css.matchAll(/@import\s+(?:url\()?\s*["']?(https?:\/\/[^"')\s;]+)/gi)) {
    if (!isInert(m[1])) problems.push(`${relative(file)} : @import ${m[1]}`);
  }
}

if (problems.length > 0) {
  console.error('Ressources distantes détectées — l\'application ne serait plus hors ligne :');
  problems.forEach((p) => console.error(`  ${p}`));
  process.exit(1);
}

console.log(`Aucune ressource distante (${files.length} fichiers analysés).`);

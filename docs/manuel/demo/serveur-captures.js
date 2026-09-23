// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * serveur-captures.js — Serves a web build of Fructificare for captures-shoot.js.
 *
 * The FICTIONAL dataset (demo/fructificare-jeu-fictif.json) is exposed at /__seed.json
 * without being copied into the build: the build folder stays untouched, so the demo
 * dataset cannot end up embedded in the executable.
 *
 * Usage:  node demo/serveur-captures.js <build folder>   → http://127.0.0.1:4173
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const RACINE = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', '..', 'frontend', 'build'));
const SEED = path.join(__dirname, 'fructificare-jeu-fictif.json');
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ttf': 'font/ttf', '.pdf': 'application/pdf',
};

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  // /__demo/<fichier>.json : variantes du jeu fictif (nom de fichier seul, sans chemin).
  const variante = /^\/__demo\/([\w-]+\.json)$/.exec(url);
  let fichier = url === '/__seed.json' ? SEED
    : variante ? path.join(__dirname, variante[1])
    : path.join(RACINE, path.normalize(url).replace(/^([\\/])+/, ''));
  if (fichier !== SEED && !variante && (!fichier.startsWith(RACINE) || !fs.existsSync(fichier) || fs.statSync(fichier).isDirectory())) {
    fichier = path.join(RACINE, 'index.html');
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(fichier)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(fichier).pipe(res);
}).listen(4173, '127.0.0.1', () => console.log(`Build ${RACINE}\nhttp://127.0.0.1:4173`));

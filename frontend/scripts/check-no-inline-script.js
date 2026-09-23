// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * check-no-inline-script.js — Guard rail for the CSP.
 *
 * The policy declared in src-tauri/tauri.conf.json enforces "script-src 'self'": any
 * inline script would be blocked and the application would not start. Yet CRA re-injects
 * the webpack runtime inline as soon as INLINE_RUNTIME_CHUNK=false disappears from .env.
 * This check catches the regression at build time, not at the user's.
 *
 * Usage:  node scripts/check-no-inline-script.js
 */
const fs = require('fs');
const path = require('path');

const INDEX = path.join(__dirname, '..', 'build', 'index.html');

if (!fs.existsSync(INDEX)) {
  console.error(`${INDEX} introuvable — lancez « npm run build » d'abord.`);
  process.exit(1);
}

const html = fs.readFileSync(INDEX, 'utf8');
const tags = html.match(/<script\b[^>]*>/gi) || [];
const inline = tags.filter((tag) => !/\ssrc\s*=/i.test(tag));

if (inline.length > 0) {
  console.error("Script(s) inline dans build/index.html — la CSP « script-src 'self' » les bloquerait :");
  inline.forEach((tag) => console.error(`  ${tag}`));
  console.error('\nVérifiez que INLINE_RUNTIME_CHUNK=false est bien présent dans frontend/.env');
  process.exit(1);
}

console.log(`Aucun script inline (${tags.length} script(s) externe(s)).`);

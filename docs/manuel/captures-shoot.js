// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * captures-shoot.js — produces the manual's screenshots.
 *
 * Each shot is named `fig-<number>.png`. The `figure()` helper in lib/kit.js picks the
 * file up on its own: dropping the screenshot in is enough, no chapter to edit.
 *
 * PREREQUISITES
 *   1. a build of the application served on http://127.0.0.1:4173
 *   2. the FICTIONAL dataset served at /__seed.json (node demo/serveur-captures.js)
 *   3. npm install puppeteer-core   (outside the repository: this tool only needs it)
 *
 * Usage: node captures-shoot.js ./captures
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'http://127.0.0.1:4173';
const OUT = process.argv[2] || path.join(__dirname, 'captures');

// 1440x950 en densité 1,5 : les fichiers font 2160x1425. Compromis retenu après
// mesure — une figure pleine largeur ressort à ~345 ppp, largement au-dessus de ce
// qu'un écran ou une imprimante restitue, pour un PDF deux fois plus léger qu'en
// densité 2. La densité DOIT rester égale à PPP dans lib/kit.js.
const VIEWPORT = { width: 1440, height: 950, deviceScaleFactor: 1.5 };

// ── Liste des prises ───────────────────────────────────────────────────────────
//
//   fig      numéro de figure (donne le nom du fichier)
//   route    chemin applicatif ; 'envelope' ouvre la première fiche enveloppe
//   avant    actions à jouer avant la prise : clic sur un libellé, ouverture d'onglet…
//   cadre    texte identifiant le bloc à cadrer ; absent = plein écran
//   garde    ne pas fermer la fenêtre de bienvenue (figure 1.1)
//
const PRISES = [
  { fig: '1.1', route: '/', garde: true, dialogue: true },
  { fig: '1.2', route: '/', cadre: 'Progression du tutoriel' },

  { fig: '3.1', route: '/' },
  { fig: '3.2', route: '/', avant: [{ aria: 'Notifications' }], cadre: 'Notifications' },
  { fig: '3.3', route: '/', mobile: true },

  { fig: '4.1', route: '/' },
  { fig: '4.2', route: '/', avant: [{ texte: 'Créer une enveloppe' }], dialogue: true },
  { fig: '4.3', route: '/', cadre: 'Valeur totale' },
  { fig: '4.4', route: '/', avant: [{ aria: 'Détail des frais par enveloppe' }], dialogue: true },
  { fig: '4.5', route: '/', cadre: 'Évolution des enveloppes' },
  { fig: '4.6', route: '/', cadre: 'Répartition' },
  { fig: '4.7', route: '/', cadre: 'Enveloppes' },
  { fig: '4.8', route: '/', cadre: 'Épargne cumulée' },
  { fig: '4.9', route: '/', cadre: 'Rendement annuel' },

  { fig: '5.1', route: 'envelope' },
  { fig: '5.2', route: 'envelope', testid: 'add-transaction-card' },
  { fig: '5.5', route: 'envelope', cadre: 'Évolution' },
  { fig: '5.6', route: 'envelope', cadre: 'Rendement par actif' },
  { fig: '5.7', route: 'envelope', cadre: 'Totaux par note' },
  { fig: '5.8', route: 'envelope', cadre: 'Mouvements' },

  { fig: '6.1', route: '/', avant: [{ texte: 'Calibrer mes enveloppes' }], dialogue: true },
  { fig: '6.3', route: '/', avant: [{ texte: 'Calibrer mes enveloppes' }, { texte: 'Historique', dansDialogue: true }], dialogue: true },

  { fig: '7.1', route: 'envelope', avant: [{ texte: 'Mouvements types' }], dialogue: true },

  { fig: '8.1', route: '/', avant: [{ texte: 'Mouvements récurrents' }], dialogue: true },
  { fig: '8.3', route: '/', avant: [{ texte: 'Mouvements récurrents' }, { texte: 'Historique', dansDialogue: true }], dialogue: true },

  { fig: '9.1', route: '/calendar' },
  { fig: '9.4', route: '/calendar', avant: [{ texte: 'Budget', onglet: true }], cadre: 'investissement' },
  { fig: '9.5', route: '/calendar', avant: [{ texte: 'Budget', onglet: true }] },

  { fig: '10.1', route: '/simulation' },
  { fig: '10.2', route: '/simulation/portfolios' },
  { fig: '10.3', route: '/simulation/rule-843' },
  { fig: '11.1', route: '/simulation/tax' },
  { fig: '11.2', route: '/tax-report' },
  { fig: '12.1', route: '/documents' },
  { fig: '13.1', route: '/trophees' },
  { fig: '14.1', route: '/settings' },
  { fig: '15.1', route: '/glossaire' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Navigation CÔTÉ CLIENT. En mode navigateur les données vivent en mémoire : un vrai
 * rechargement les effacerait et toutes les captures montreraient une application vide.
 */
async function goTo(page, route) {
  await page.evaluate((r) => {
    window.history.pushState({}, '', r);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, route);
  await sleep(1400);
}

async function seed(page) {
  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle2' });
  await sleep(3000);
  await page.evaluate(async () => {
    const txt = await (await fetch('/__seed.json')).text();
    const file = new File([txt], 'demo.json', { type: 'application/json' });
    const input = document.querySelector('[data-testid="import-file-input"]');
    if (!input) throw new Error("champ d'import introuvable");
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await sleep(6000);
}

/**
 * Masque ce qui n'existe QUE en mode navigateur : l'avertissement d'auto-save (la
 * version bureau écrit directement sur disque) et la carte d'import de secours.
 */
async function masquerModeNavigateur(page) {
  await page.evaluate(() => {
    document.querySelectorAll('[data-testid="browser-import-card"]').forEach((e) => { e.style.display = 'none'; });
    for (const el of document.querySelectorAll('div')) {
      if (/Aucun fichier de sauvegarde|No backup file selected/.test(el.textContent || '')
          && el.children.length <= 2 && el.clientHeight < 140) {
        el.style.display = 'none';
        return;
      }
    }
  });
}

/**
 * Ferme la fenêtre de bienvenue puis toute modale restée ouverte, et VÉRIFIE la
 * fermeture. Sans ce contrôle, une fenêtre persistante était re-photographiée à la
 * prise suivante — deux figures différentes se retrouvaient identiques.
 */
async function fermerFenetres(page) {
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('button')) {
      if (/^(Continuer|Continue)$/.test((b.textContent || '').trim())) { b.click(); return; }
    }
  });
  await sleep(500);
  for (let i = 0; i < 4; i += 1) {
    const reste = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
    if (!reste) return;
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(500);
  }
}

/**
 * Clique un élément interactif. Trois façons de le désigner, par ordre de fiabilité :
 * `testid`, `aria` (aria-label), puis `texte`. `dansDialogue` limite la recherche à la
 * fenêtre modale ouverte — indispensable pour les onglets, dont le libellé existe
 * souvent aussi en arrière-plan.
 */
async function cliquer(page, action) {
  // On repère l'élément, on le marque, puis on le clique avec la VRAIE souris.
  // Les onglets Radix réagissent aux événements de pointeur, pas à un `.click()`
  // synthétique : sans vrai clic, l'onglet ne changeait jamais.
  const trouve = await page.evaluate((a) => {
    const racine = a.dansDialogue ? document.querySelector('[role="dialog"]') : document;
    if (!racine) return false;
    const marquer = (el) => { el.setAttribute('data-shot-click', '1'); return true; };

    if (a.testid) { const el = racine.querySelector(`[data-testid="${a.testid}"]`); return el ? marquer(el) : false; }
    if (a.aria) { const el = racine.querySelector(`[aria-label="${a.aria}"]`); return el ? marquer(el) : false; }

    // Les onglets portent un badge de compteur collé au libellé (« Historique7 »,
    // « Budget du mois ») : on compare donc sur le début du texte.
    if (a.onglet || a.dansDialogue) {
      const onglet = Array.from(racine.querySelectorAll('[role="tab"]'))
        .find((e) => (e.textContent || '').trim().startsWith(a.texte));
      if (onglet) return marquer(onglet);
    }

    const candidats = Array.from(racine.querySelectorAll('button, [role="tab"], a, [role="button"]'))
      .filter((e) => (e.textContent || '').trim().includes(a.texte) && e.offsetParent !== null);
    if (!candidats.length) return false;
    candidats.sort((x, y) => x.textContent.length - y.textContent.length);
    return marquer(candidats[0]);
  }, action);

  if (!trouve) return false;

  const cible = await page.$('[data-shot-click]');
  if (!cible) return false;
  await cible.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await sleep(300);
  await cible.click().catch(() => {});
  await page.evaluate(() => document.querySelectorAll('[data-shot-click]').forEach((e) => e.removeAttribute('data-shot-click')));
  await sleep(1700);

  // Un onglet doit être réellement sélectionné : sinon on préfère une figure
  // manquante à une capture trompeuse.
  if (action.onglet || action.dansDialogue) {
    const actif = await page.evaluate((txt) => Array.from(document.querySelectorAll('[role="tab"]'))
      .some((e) => (e.textContent || '').trim().startsWith(txt) && e.getAttribute('aria-selected') === 'true'), action.texte);
    if (!actif) return false;
  }
  return true;
}

/**
 * Repère l'élément à photographier et l'amène à l'écran.
 *
 * Trouver « le plus petit bloc contenant le texte » donne un cadrage inutilisable :
 * on tombe sur le libellé lui-même, pas sur la carte. On part donc du porteur du
 * texte et on REMONTE jusqu'à la carte englobante — dans cette application, un
 * conteneur à bordure arrondie —, ce qui donne le bloc que le lecteur reconnaît.
 */
async function viser(page, prise) {
  return page.evaluate((p) => {
    // Repérage GÉOMÉTRIQUE plutôt que par classes CSS : les classes varient d'un
    // composant à l'autre, la géométrie non. Une carte occupe au moins 40 % de la
    // largeur et 150 px de haut, sans couvrir toute la page.
    const estCarte = (el) => {
      const r = el.getBoundingClientRect();
      return r.width >= window.innerWidth * 0.40
        && r.height >= 150
        && r.height <= window.innerHeight * 0.92;
    };

    let cible = null;

    if (p.testid) {
      cible = document.querySelector(`[data-testid="${p.testid}"]`);
    } else if (p.dialogue) {
      cible = document.querySelector('[role="dialog"]');
    } else if (p.cadre) {
      // Le porteur le plus profond du texte, puis remontée vers sa carte.
      const porteurs = Array.from(document.querySelectorAll('h1,h2,h3,h4,span,p,div'))
        .filter((e) => (e.textContent || '').includes(p.cadre) && e.offsetParent !== null);
      if (!porteurs.length) return { trouve: false };
      porteurs.sort((a, b) => a.textContent.length - b.textContent.length);
      let el = porteurs[0];
      for (let i = 0; i < 8 && el.parentElement; i += 1) {
        if (estCarte(el) && el.clientHeight > 80) break;
        el = el.parentElement;
      }
      cible = el;
    }

    if (!cible) return { trouve: false };
    cible.scrollIntoView({ block: 'center', behavior: 'instant' });
    cible.setAttribute('data-shot-cible', '1');
    return { trouve: true };
  }, prise);
}

/** Rectangle final, une fois le défilement stabilisé. */
async function rectangle(page) {
  return page.evaluate(() => {
    const el = document.querySelector('[data-shot-cible]');
    if (!el) return null;
    el.removeAttribute('data-shot-cible');
    const marge = 14;
    const r = el.getBoundingClientRect();
    const x = Math.max(0, r.x - marge);
    const y = Math.max(0, r.y - marge);
    const width = Math.min(window.innerWidth - x, r.width + marge * 2);
    const height = Math.min(window.innerHeight - y, r.height + marge * 2);
    // Un cadre minuscule signale un mauvais repérage : mieux vaut la page entière.
    if (width < 220 || height < 120) return null;
    return { x, y, width, height };
  });
}

async function ouvrirPremiereEnveloppe(page) {
  await goTo(page, '/');
  await sleep(2200);
  const ok = await page.evaluate(() => {
    const cible = Array.from(document.querySelectorAll('div, tr'))
      .filter((e) => /PEA Actions/.test(e.textContent || ''))
      .sort((a, b) => a.textContent.length - b.textContent.length)[0];
    if (!cible) return false;
    cible.click();
    return true;
  });
  await sleep(2200);
  return ok;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    defaultViewport: VIEWPORT,
    args: ['--hide-scrollbars', '--disable-gpu', '--force-color-profile=srgb'],
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('  erreur page :', e.message));

  await seed(page);
  console.log('Jeu de données chargé.\n');

  let ok = 0;
  let manquantes = [];

  for (const prise of PRISES) {
    const fichier = path.join(OUT, `fig-${prise.fig}.png`);
    try {
      // Même densité que les autres prises, sinon la vue mobile arrive en 300 ppp
      // sur 103 pt de large : illisible dans le manuel.
      if (prise.mobile) await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 1.5 });

      if (prise.route === 'envelope') {
        if (!(await ouvrirPremiereEnveloppe(page))) throw new Error('fiche enveloppe inaccessible');
      } else {
        await goTo(page, prise.route);
      }

      if (!prise.garde) await fermerFenetres(page);
      await masquerModeNavigateur(page);
      if (prise.dialogue && !prise.garde) {
        const dejaOuvert = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
        if (dejaOuvert) throw new Error('une fenêtre est restée ouverte de la prise précédente');
      }

      for (const action of prise.avant || []) {
        if (!(await cliquer(page, action))) {
          throw new Error(`élément « ${action.texte || action.testid} » introuvable`);
        }
      }

      const vise = await viser(page, prise);
      await sleep(800);
      const clip = vise.trouve ? await rectangle(page) : null;

      await page.screenshot(clip ? { path: fichier, clip } : { path: fichier });
      console.log(`  fig-${prise.fig}.png  ${clip ? 'cadrée' : 'plein écran'}  (${Math.round(fs.statSync(fichier).size / 1024)} Ko)`);
      ok += 1;
    } catch (e) {
      manquantes.push(`${prise.fig} — ${e.message}`);
      console.error(`  fig-${prise.fig}  ECHEC : ${e.message}`);
    } finally {
      if (prise.mobile) await page.setViewport(VIEWPORT);
      await fermerFenetres(page);
    }
  }

  await browser.close();
  console.log(`\n${ok}/${PRISES.length} captures produites.`);
  if (manquantes.length) {
    console.log('\nÀ reprendre :');
    manquantes.forEach((m) => console.log('  ' + m));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

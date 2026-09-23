// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
const {
  p, bullet, step, bonASavoir, attention, noteRedac, figure, gap,
  h1, h2, h3, t, b, i, ui, code, tableau,
  GREEN, SLATE, VIOLET, GREY, AMBER, CONTENT_W,
} = require('../lib/kit');
const { Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell,
        WidthType, ShadingType, TableOfContents } = require('docx');

const children = [];

// ═══════════════════════════════════════════════════════════════════════════
//  CHAPTER 1
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1('1. Getting started'));

children.push(h2('1.1  What is Fructificare?'));
children.push(p("Fructificare tracks your wealth as a private investor: what you pay in, what it is worth today, what it costs you in fees, and the tax that may apply on the day you withdraw."));
children.push(p([
  t("The application connects to "),
  b('no'),
  t(" bank and sends nothing over the Internet. It runs locally on your computer, and your data stays in a file you control. In return, you enter the value of your accounts yourself — this is called "),
  b('calibrating'),
  t(", and it is the core action of the software (chapter 6)."),
]));

children.push(p([b('What Fructificare does:')]));
children.push(bullet('track several envelopes (PEA, CTO, life insurance, PER, savings accounts...) and their assets;'));
children.push(bullet('calculate your real returns, your cumulative fees and your unrealized gain;'));
children.push(bullet('project your wealth into the future, with inflation and crisis scenarios;'));
children.push(bullet('estimate your taxes and produce an annual tax report as a PDF;'));
children.push(bullet('help you keep the pace: reminders, goals, trophies.'));

children.push(p([b("What Fructificare does not do:")]));
children.push(bullet("fetch the balance of your accounts automatically (calibrating is up to you, see chapter 6);"));
children.push(bullet('place orders or recommend an investment;'));
children.push(bullet('replace a wealth management adviser.'));

children.push(gap(120));
children.push(attention([
  new TextRun({ text: "Fructificare is an information tool. It gives no investment advice. The tax calculations follow the French rules in force in January 2026 and may change.", size: 21 }),
]));

children.push(h2('1.2  Installing Fructificare'));

children.push(p([
  t("Fructificare is a standard Windows application: a single file to download, no "),
  t("prerequisite to install, no command line."),
]));

children.push(h3('Windows'));
children.push(step([t('Download '), code('Fructificare_x64-setup.exe'), t(" from the project's releases page.")], 1));
children.push(step("Double-click the installer. It installs for your user account only: no administrator password is required.", 1));
children.push(step("Launch Fructificare from the Start menu.", 1));

children.push(gap(120));
children.push(attention([
  new TextRun({ text: "Published releases are not signed with a code-signing certificate. Windows will therefore show a SmartScreen warning the first time you run it: click “More info”, then “Run anyway”.", size: 21 }),
]));
children.push(gap(120));
children.push(bonASavoir([
  new TextRun({ text: 'For the most cautious: ', size: 21, bold: true }),
  new TextRun({ text: "if you wish, you can check that the downloaded file is indeed the one that was published, using its SHA-256 fingerprint. This step is optional; the procedure is described in § 14.7.", size: 21 }),
]));

children.push(h3('macOS and Linux'));
children.push(p("No packaged version is distributed for now. Since the code is open, these platforms can be built from source (see CONTRIBUTING.md in the repository)."));

children.push(h2("1.3  Launching the application"));
children.push(p([
  t("Open "), b('Fructificare'), t(" from the Start menu, like any other program."),
]));
children.push(p([
  t("To quit, close the window, or use "), ui('File → Quit'),
  t(". Your changes are saved automatically."),
]));

children.push(h2('1.4  Your data belongs to you'));
children.push(p("Everything you enter — envelopes, movements, calibrations, simulations, goals — fits in a single JSON file, on your disk. No copy is sent anywhere else."));
children.push(p([
  t("Direct consequence: "), b("if you lose this file, you lose everything"),
  t(". Chapter 14 explains how backups work and how to restore an earlier version."),
]));
children.push(gap(120));
children.push(bonASavoir([
  new TextRun({ text: 'Get into the habit of exporting your file from time to time (', size: 21 }),
  new TextRun({ text: 'Settings → Export Data', size: 21, bold: true, color: GREEN }),
  new TextRun({ text: ') and of storing it somewhere other than your working disk: USB stick, external drive, personal storage space.', size: 21 }),
]));

children.push(h2('1.5  The first launch'));
children.push(p("On the very first start, Fructificare welcomes you and offers its built-in tutorial. Click “Continue”: the window will not appear again."));
children.push(gap(100));
children.push(...figure('1.1', 'The welcome window',
  "the welcome modal as it appears on first launch, over a dashboard that is still empty in the background (blurred or dimmed by the modal)."));

children.push(h2('1.6  Fructificare vocabulary'));
children.push(p("Seven words come up all the time. Learning them now will save you going back and forth."));

children.push(h3('Portfolio'));
children.push(p("All of your envelopes. It is the total, the view from above."));
children.push(h3('Envelope'));
children.push(p("An investment account: a PEA, a life insurance contract, a securities account (CTO), a savings account. Each envelope has its own type, taxation, fees and color."));
children.push(h3('Movement'));
children.push(p("A deposit or a withdrawal on an envelope, on a given date. It is the basic unit of data entry."));
children.push(h3('Calibration'));
children.push(p("The real value of an envelope on a given date, read from your bank statement and entered by hand. Without calibration, Fructificare only knows your deposits and can calculate neither performance nor gains."));
children.push(h3('Movement template'));
children.push(p("A reusable entry template that remembers the envelope, the asset type and the usual fees of an investment. It never triggers anything on its own (chapter 7)."));
children.push(h3('Recurring movement'));
children.push(p("A scheduled deposit or withdrawal that is recorded automatically on each due date (chapter 8)."));
children.push(h3('Cash'));
children.push(p("The liquidity pocket of an envelope: money that is in the account but not yet invested, typically after a sale when you choose to keep the money in the envelope until your next purchase."));

children.push(gap(120));
children.push(bonASavoir([
  new TextRun({ text: 'Movement template or recurring movement? ', size: 21, bold: true }),
  new TextRun({ text: "The first is a template that saves you time when entering data. The second applies itself on the scheduled due dates. The two are independent and live in two separate panels.", size: 21 }),
]));

children.push(h2('1.7  Letting the tutorial guide you'));
children.push(p("Fructificare includes a path of fourteen missions that covers most of the features. It appears at the top of the dashboard and moves forward on its own as you use the application: you have nothing to confirm."));
children.push(p([
  t("Each mission unlocks a trophy. The banner disappears by itself once all fourteen are done, and you will find them on the "),
  ui('Trophies'), t(' page (chapter 13).'),
]));
children.push(gap(100));
children.push(...figure('1.2', 'The “Tutorial” banner on the dashboard',
  "the banner expanded at the top of the dashboard, showing the current mission, its description and the “How to complete?” button."));

children.push(p([b('The fourteen-mission path')]));

const questRows = [
  ['Q1',  'My first envelope',          'Create an envelope and record a movement',     '4.3, 5.4'],
  ['Q2',  'Building the foundation',    'Spread over several asset types',              '5.4'],
  ['Q3',  'Getting acquainted',         'Complete your profile',                        '14.1'],
  ['Q4',  'Fee awareness',              'Deposit fees and annual fees',                 '5.4, 4.4'],
  ['Q5',  'The regular investor',       'Schedule a recurring deposit',                 '8'],
  ['Q6',  'Looking into the future',    'Run a first simulation',                       '10.2'],
  ['Q7',  'Fees: the silent enemy',     'Two simulations, two fee levels',              '10.3'],
  ['Q8',  'Surviving the crash',        'Apply a stress test',                          '10.3'],
  ['Q9',  'Understanding taxes',        'Use the tax simulator',                        '11.1'],
  ['Q10', 'Calibrate an envelope',      'Enter your first real value',                  '6'],
  ['Q11', 'Your tax report',            'Generate the annual report',                   '11.2'],
  ['Q12', 'Setting the course',         'Set a figure-based goal',                      '13.3'],
  ['Q13', 'Budget pilot',               'Fill in the budget tab',                       '9.5'],
  ['Q14', 'The right diagnosis',        'Get your health score',                        '13.2'],
];

const COLS = [700, 2400, 4126, 1800];
children.push(new Table({
  columnWidths: COLS,
  width: { size: CONTENT_W, type: WidthType.DXA },
  rows: [
    new TableRow({
      tableHeader: true,
      children: ['#', 'Mission', 'What it introduces', 'See §'].map((h, k) => new TableCell({
        width: { size: COLS[k], type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: VIOLET },
        margins: { top: 90, bottom: 90, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: 'FFFFFF' })] })],
      })),
    }),
    ...questRows.map((r, idx) => new TableRow({
      children: r.map((cell, k) => new TableCell({
        width: { size: COLS[k], type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: idx % 2 ? 'F1F5F9' : 'FFFFFF' },
        margins: { top: 70, bottom: 70, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20, bold: k === 0 })] })],
      })),
    })),
  ],
}));

children.push(gap(160));
children.push(bonASavoir("The tutorial blocks nothing. You can ignore it completely and use the application in whatever order suits you — the missions will be validated along the way."));


module.exports = children;

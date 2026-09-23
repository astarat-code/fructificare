// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
const {
  p, bullet, step, bonASavoir, attention, figure, gap,
  h1, h2, h3, t, b, i, ui, code, tableau,
} = require('../lib/kit');
const { TextRun } = require('docx');

const children = [];

// ═══════════════════════════════════════════════════════════════════════════
//  CHAPTER 12
// ═══════════════════════════════════════════════════════════════════════════
children.push(h1('12. Documents'));

children.push(p([
  t("An account statement, a trade confirmation, an IFU tax form: these PDF files usually end up scattered between "),
  t("the downloads folder, email attachments and a forgotten folder. Fructificare lets you "),
  b('file them with the envelopes they relate to'),
  t(", so you can find them on the day you need them — when filing your tax return, or when calibrating."),
]));

children.push(...figure('12.1', 'The Documents page',
  "the complete page, full width"));

// ── 12.1 ───────────────────────────────────────────────────────────────────
children.push(h2('12.1  Where your imported documents go'));

children.push(p([
  t("Like the rest of Fructificare, these files stay stored locally. On import, the PDF is "),
  b('copied'), t(" into a folder of the application: "),
]));
children.push(p([code('%APPDATA%\\app.fructificare.desktop\\documents imp\\')], { spacing: { after: 160 } }));

children.push(p([
  t("Each envelope gets its own subfolder there; documents not attached to an envelope go into a “global” subfolder."),
]));
children.push(gap(100));
children.push(bonASavoir("It is a copy that goes into the application's folder; your original file stays where it was."));

children.push(gap(100));
children.push(attention([
  new TextRun({ text: "The JSON backup file only contains the metadata (name, date, type, path), never the PDF itself. ", size: 21 }),
  new TextRun({ text: "If you change computers, also copy the “documents imp” folder: otherwise your files will not follow and the program will show “File not found”.", size: 21, bold: true }),
]));

// ── 12.2 ───────────────────────────────────────────────────────────────────
children.push(h2('12.2  Adding a document'));

children.push(step([t("From the "), ui('Documents'), t(" page, or from the Documents section of an envelope page, click "), ui('Add a document'), t('.')], 2));
children.push(step("Choose a PDF. The file picker only offers this format.", 2));
children.push(step("Fill in the record, then confirm. The file is copied and the record appears in the list.", 2));

children.push(gap(120));
children.push(h3('The record fields'));
children.push(tableau(
  ['Field', 'What it is for'],
  [
    ['Date', "The date of the document — not the import date. It is used for sorting."],
    ['Document type', "Account / securities statement · Trade confirmation · Tax statement / IFU · Annual report / KID · Other"],
    ['Type label', "Only appears if you chose “Other”. Lets you name your own category, for example “Tax certificate”."],
    ['Name', "The label shown in the list. Pre-filled with the file name, editable."],
    ['Linked envelope', "The envelope concerned, or “None” for a global document."],
  ],
  [2300, 6726],
));

// ── 12.3 ───────────────────────────────────────────────────────────────────
children.push(h2('12.3  Viewing, editing, deleting'));

children.push(p("Each row of the list has three buttons."));
children.push(bullet([b('Open'), t(" — the PDF opens in your usual reader (Acrobat, Edge, Preview…).")]));
children.push(bullet([b('Edit'), t(" — to change the information entered when the document was imported.")]));
children.push(bullet([b('Delete'), t(" — removes the record and erases the copied file, after confirmation. Your original PDF is not touched.")]));

children.push(gap(120));
children.push(p([
  t("A "), ui('Folder'), t(" button opens the imported documents folder directly in Windows Explorer, "),
  t("if you prefer to access it by hand."),
]));

children.push(h3("“File not found”"));
children.push(p([
  t("This orange badge marks a record whose PDF has disappeared from the application's folder — "),
  t("deleted by hand, or not copied over when changing computers. The record stays, "),
  t("so you know what is missing; simply delete it and import the document again."),
]));

// ── 12.4 ───────────────────────────────────────────────────────────────────
children.push(h2('12.4  Two security points'));

children.push(p([
  t("Opening a document means asking Windows to launch a program. Fructificare therefore frames this operation in two ways, "),
  t("invisible in everyday use but which explain some refusals."),
]));

children.push(bullet([
  b("Paths are checked."),
  t(" A document whose saved location does not exactly match the expected form is refused, with the message "),
  i("“This document points to an invalid location and was not opened”"),
  t(". This check protects you from a modified JSON backup that would try to open an arbitrary file on your disk."),
]));

children.push(bullet([
  b("Disk access is restricted."),
  t(" The application can only read and write in its own folders. A PDF located elsewhere is only accessible at the moment "),
  b('you'), t(" point to it in the dialog box — and for that one time only."),
]));

module.exports = children;

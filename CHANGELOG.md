# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.0] — 2026-10-10

### Added

- **Updates** — once a day, at startup, Fructificare looks for a newer version and offers
  to download and install it in place. *Help › Check for updates…* runs the check on demand,
  and *Settings › Preferences* turns the daily check off. The check reads a public file on
  GitHub and sends nothing; an update is only installed if its signature matches the key
  embedded in the application. This is the first network request the application makes: see
  the privacy statement in the README and the "Updates" section of SECURITY.md.
- **Recurring movements: changes apply from a date you choose** — the edit form asks from
  which date the new settings apply (today by default). Movements recorded before that date
  are kept as they were, and the modification log shows the date each change took effect.
- **History: one line per multi-asset movement** — a movement spread over several assets
  is shown as a single line with its totals; clicking it lists the detail by asset.
- **Sale window** — the red Withdrawal button now opens a window that asks what is sold:
  one of the lines still invested (by note and asset type, so two assets bought by the same
  recurring movement can be sold separately), or "Other" with one or several asset types.
  Fees can be deducted from or added to the amount, and a summary shows what is taken from
  the assets, what is received and what remains in the line. Simulation envelopes behave
  the same way.
- **Withdrawal checks** — the asset type sold is required when the envelope tells its
  assets apart, and a sale larger than what the line or the envelope holds asks for
  confirmation. A recurring withdrawal that exceeds what its envelope holds is no longer
  recorded: the series is put on hold and you choose to keep applying it or to stop it.
- **Windows installer: for you only, or for every user** of the computer.
- The version number is shown under the application name in the left menu.

### Changed

- **Transaction fees no longer count as invested.** A fee charged on top of an order (€75
  order, €1 fee) was added to the amount invested and inflated the base of every return.
  The amount invested is now €75 whatever the fee convention; the deposits shown include
  the fee (€76). Existing movements are corrected when the data is loaded.
- **Importing an encrypted backup turns encryption on**, with the passphrase of that file,
  instead of asking and leaving the restored data in plain text if declined. A notice
  offers to choose another passphrase. Importing a plain-text backup changes nothing.
- The glossary moves from the Edit menu to the **Help** menu; the Edit menu now holds Cut,
  Copy, Paste and Select All.
- **Calibrations** — only one is kept per envelope and per day; a position entered from a
  multi-asset template is split by that template instead of landing in "Other"; a breakdown
  that does not add up to the total is flagged and applied pro rata.
- The asset allocation based on deposits is computed envelope by envelope: an asset
  oversold in one envelope no longer reduces the same asset held in another.

### Fixed

- Editing a recurring movement rewrote every movement it had already recorded, even when
  only its note was changed.
- Movement templates created from the dashboard lost the fee convention (deducted or
  added).
- The same reminder notification piled up day after day.
- Health score: the rating overlapped the ends of the gauge.
- Avatar: the chapter name is no longer repeated next to the avatar's name.

## [1.2.0] — 2026-09-26

### Added

- **First-launch wizard** — Fructificare now asks where to keep its data: the application
  folder, or a folder of your choice where a `Fructificare` subfolder is created. Picking an
  existing `Fructificare` folder (USB stick, another computer) takes over its backups. The
  wizard then offers to encrypt the backups.
- **File › Data folder & encryption…** — move the data to another folder (everything is
  copied before the old folder is emptied), go back to the application folder, and turn
  encryption on or off, from one window.
- **Missing data folder** — when the chosen folder cannot be found at startup (drive
  unplugged), the application says so and writes nothing until it is found again or
  replaced, so an empty backup can never pass for the latest one.

### Changed

- Imported documents are opened by a native command that validates the path again; the
  `opener` permission no longer lists the documents folder.
- User manual: first launch (§ 1.5), documents (§ 12.1) and data folder (§ 14.3) rewritten;
  the Linux and macOS packages are now mentioned in § 1.2.
- `@eslint/js` 9.39.5.

## [1.1.0] — 2026-09-24

### Added

- **Linux** — an AppImage for any distribution and a `.deb` for Debian, Ubuntu and
  derivatives, built on Ubuntu 22.04 for wide compatibility.
- **macOS (experimental)** — a universal `.dmg` for Intel and Apple Silicon, ad-hoc signed
  but not notarized by Apple. It is built and launched by the CI; it has not been tried on
  real Macs yet.
- **macOS menus** — an application menu (About, Hide, Quit) and the standard editing
  commands in *Edit*: without them, ⌘C and ⌘V do not work in the text fields of a macOS
  web view.
- **Launch test in CI** — the Linux binary, the AppImage and the app inside the `.dmg` are
  started for 20 seconds after compilation; a crash at startup fails the release. The
  release workflow also runs on pull requests that touch the native code.

### Changed

- Settings messages, the user manual (§ 12, § 14.3, § 16.6), the README and the security
  documentation no longer assume Windows: data folders, rendering engine and shortcuts are
  given for each system.
- `SHA256SUMS.txt` now lists the files of the three systems.

## [1.0.1] — 2026-09-23

### Changed

- **Language on first launch** — Fructificare now opens in French when Windows is in French,
  and in English otherwise; it used to open in French everywhere. A language chosen in
  *View › Languages* still takes precedence.
- **Dependencies** — Tauri 2.11.6 and its plugins, React 19.3, Recharts 3.10 and Radix UI
  (26 grouped minor updates), lucide-react 1.47 and globals 17. The CI and release
  workflows move to actions running on Node.js 24 (checkout 7, setup-node 7,
  upload-artifact 7, download-artifact 8, action-gh-release 3); download-artifact now fails
  on a hash mismatch.

### Fixed

- **User manual** — the cover showed an obsolete internal version number (4.5.1). It now
  reads the application version, so the two can no longer drift apart.
- **Security test suite** — two checks failed about once in 500 runs: they looked for short
  strings such as "PEA" in random ciphertext. They now check the unencrypted fields and the
  decoded ciphertext instead.

## [1.0.0] — 2026-09-23

First public release.

### Added

- **Portfolio tracking** — envelopes (PEA, brokerage account, life insurance, PER, regulated
  savings accounts), deposits and withdrawals, cash pocket, fees, calibration against the
  real value read from a statement.
- **Returns** — modified Dietz method, per envelope, per asset type and consolidated.
- **Simulations** — long-term projection, 8-4-3 rule, stress test, FIRE target, per-envelope
  detail.
- **Calendar and budget** — monthly budget, scheduled and recurring movements, calibration
  reminders, `.ics` export.
- **Tax report** — capital gains and taxation per envelope, PDF export.
- **Documents** — import of statements and tax forms as PDF, stored locally, in folders
  named after an internal identifier so they reveal nothing.
- **Progress** — 120 trophies, 14 tutorial quests, monthly challenges, streaks, financial
  health score, 19 avatar tiers.
- **Backup encryption** — optional, AES-256-GCM with PBKDF2-SHA-256 (600,000 iterations),
  passphrase change without an intermediate plain-text write.
- **Bilingual interface** — French and English, including the native Windows menu.
- **User manual** — 82 pages, in both languages, embedded in the binary and opened in the
  display language.
- **Public build chain** — CI-built Windows binaries with published SHA-256 fingerprints,
  actions pinned by commit hash, write token isolated in a job that compiles nothing.

[Unreleased]: https://github.com/astarat-code/fructificare/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/astarat-code/fructificare/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/astarat-code/fructificare/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/astarat-code/fructificare/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/astarat-code/fructificare/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/astarat-code/fructificare/releases/tag/v1.0.0

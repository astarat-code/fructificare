# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/astarat-code/fructificare/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/astarat-code/fructificare/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/astarat-code/fructificare/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/astarat-code/fructificare/releases/tag/v1.0.0

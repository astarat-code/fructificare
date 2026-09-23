# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/astarat-code/fructificare/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/astarat-code/fructificare/releases/tag/v1.0.0

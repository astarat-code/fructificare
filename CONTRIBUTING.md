# Contributing to Fructificare

Thanks for taking a look. This file covers how to build the project, what the tests
guarantee, and what a pull request is expected to respect.

*Le projet est développé en français : les commentaires du code et une partie de la
documentation sont en français, et une issue ou une pull request rédigée en français est
parfaitement bienvenue.*

---

## What this project is

A **single-user, offline desktop application**. Two consequences shape almost every
decision here:

1. **No network.** The application makes no request, for any feature. Fonts, the manual and
   every asset are embedded. `npm run check:build` fails the build if a remote resource
   appears.
2. **The data is the user's whole net worth.** A bug that leaks it, or that lets a hostile
   backup file execute code, matters more than a missing feature. The security test suites
   are blocking in CI for that reason.

Feature ideas are welcome as issues. Before a large pull request, please open an issue
first — it avoids work that does not fit the scope.

---

## Prerequisites

- **Node.js 20 LTS**
- **Rust** (`winget install Rustlang.Rustup`) plus the MSVC C++ Build Tools and WebView2 —
  only needed for the desktop build
- **Windows** for the desktop application; the web interface builds anywhere

---

## Interface only (browser)

```bash
cd frontend
npm ci        # installs exactly the versions in package-lock.json
npm start     # http://127.0.0.1:3000
```

**This mode is for interface development only. It must never be handed to end users:**

- the development server is not meant to be exposed, and has had several vulnerabilities
  letting a third-party site exfiltrate the served code;
- in browser mode the financial data lives in `localStorage`, where **any installed
  extension can read it**;
- the Tauri APIs (restricted disk access, native dialogs) are absent, so the application's
  own guard rails do not apply.

`frontend/.env` sets `HOST=127.0.0.1`: the development server listens on the local machine
only, never on the network.

---

## Desktop application

```powershell
cd frontend
npm run tauri build
```

On Windows, `frontend\build-exe.ps1` does the same thing from a short path (`C:\ft`) — the
Windows resource compiler cannot open an icon path longer than ~260 characters — and drops
the executable, the installer and their SHA-256 fingerprints into `frontend/dist-tauri/`.

That script is a development convenience. **Published binaries are built by the CI**, never
on a maintainer's machine: see `.github/workflows/release.yml` and the "How this software is
built and published" section of [`SECURITY.md`](SECURITY.md).

---

## Tests and checks

Everything below runs in CI on every push and pull request, and must pass.

```bash
cd frontend
npm run lint            # ESLint (flat config, eslint.config.js)
npm run test:rules      # tax and calculation rules
npm run test:security   # 11 suites, 200+ assertions
npm run build
npm run check:build     # Tauri ACL, no inline script, no remote resource
cd src-tauri && cargo test --lib   # navigation guard (Rust)
```

The security suites are not decoration. Each one stands for a real attack that was
demonstrated on this code before it was fixed — a backup file that opens an arbitrary
executable, a rotation that erases the encrypted history, a diagnostic log that leaks
amounts. [`SECURITY.md`](SECURITY.md) lists what each suite protects.

**A pull request that weakens one of these checks will not be merged** unless it explains
what replaces the guarantee.

---

## House rules

- **No new runtime dependency without a reason.** Everything in `dependencies` ends up
  running inside the user's webview. `devDependencies` are cheaper, but still reviewed.
- **No network call, no telemetry, no analytics.** Ever.
- **Both languages.** Every user-visible string exists in French and in English
  (`frontend/src/i18n.js`, or the `L(fr, en)` helper in components). A string added in one
  language only is an incomplete change.
- **Comments explain *why*.** The codebase documents the reasoning behind a guard, not what
  the next line does. Please keep that style.
- **No `console.log` in `src/`.** ESLint enforces it: debug traces have a way of shipping.
- **Money is never a float you round late.** Follow the existing helpers rather than
  recomputing amounts inline.

---

## Fonts

Fonts are embedded in `frontend/public/fonts/` so that the application contacts no server
at startup. Regenerating them is the only operation in the project that needs the network:

```bash
cd frontend
python scripts/fetch-fonts.py
```

## The user manual

The 82-page manual is generated from JavaScript, not written in Word:
`docs/manuel/build-manuel.js` assembles the chapters and produces the `.docx`, then the
`.pdf` is exported from it. Both languages share one structure —`chapitres/` and
`chapitres-en/`, `captures/` and `captures-en/`.

See [`docs/manuel/README.md`](docs/manuel/README.md). **Editing the `.docx` by hand is
pointless**: it is regenerated on every build. Screenshots must be taken with the fictional
dataset produced by `docs/manuel/demo/generer-jeu-fictif.js` — never with real data.

---

## Code conventions

- **Language.** Identifiers and user-facing strings are in English or come from the i18n
  file; comments and commit messages may be French or English. File headers are English.
- **Naming.** `camelCase` for variables and functions, `PascalCase` for React components
  and their files, `SCREAMING_SNAKE_CASE` for module constants.
- **Where files go.** `src/pages/` one file per route, `src/components/` shared components
  (`src/components/ui/` for the design-system primitives), `src/services/` state and
  business rules, `src/lib/` pure helpers with no state. A pure rule that deserves a test
  belongs in `src/lib/`.
- **Components.** Function components and hooks; no class components. Keep computation in
  `useMemo` rather than in the render body when it walks the whole portfolio.
- **Money and dates.** Reuse the existing helpers rather than recomputing inline, and never
  build a date from `toISOString()` for calendar logic (that is a real bug this project
  already had: see `scripts/test-calendar-grid.js`).

## Branches and workflow

A single long-lived branch, `main`, which always matches the published release. Work
happens on short branches taken from it:

```
main          ← stable, what a release is built from
feature/xxx   ← one branch per feature
fix/xxx       ← one branch per bug fix
```

There is no `develop` branch: with one maintainer it would only add a merge step. If the
project grows enough that `main` needs to stay frozen between releases, that will change —
and this file with it.

## Contributions that are welcome

- Bug reports with steps to reproduce (**never with a real backup file attached**).
- Fixes, tests, and documentation.
- Translations, and corrections of the English strings.
- Tax rules: France's are the ones implemented; a well-sourced correction is valuable.

## What will not be merged

- Anything that makes a network request, adds telemetry, or requires an account.
- Investment advice, recommendations, or anything that could read as one.
- A feature that only works with a third-party service.
- A change that weakens a security check without replacing the guarantee.
- A pull request whose screenshots or fixtures contain real financial data.

## Pull requests

1. Branch off `main`.
2. Keep the change focused; one concern per pull request.
3. Run the checks above locally — CI runs the same ones.
4. Describe what changes **for the user**, and what you did to verify it.
5. If the change touches security, say explicitly which guarantee it affects.

By contributing, you agree that your contribution is licensed under the
[AGPL-3.0-or-later](LICENSE), like the rest of the project.

---

## Reporting a vulnerability

Do not open a public issue. Use the private advisory form: repository → **Security** →
**Report a vulnerability**. Details in [`SECURITY.md`](SECURITY.md).

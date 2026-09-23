# Security policy

*Version française : [`docs/SECURITE.md`](docs/SECURITE.md).*

## Threat model

Fructificare is a single-user, offline desktop application, with no account and no server.
It opens no port and makes no network request.

### What the application protects against

- **A booby-trapped backup file.** Document paths read from a backup are validated strictly:
  a path trying to escape the application's folders is refused, never opened nor deleted.
- **Privilege creep.** Disk access is limited by the Tauri configuration to the
  application's own folders. Any other file is reachable for the current session only, and
  only after you designated it in a native dialog.
- **Hijacked file opening.** The only things the application can ask the system to open are
  `.pdf` files (documents, manual) or its documents folder: a hostile backup cannot make it
  launch a `.bat`, an `.exe` or a shortcut.
- **Content injection.** A strict Content-Security-Policy forbids inline and remote scripts,
  as well as any outbound connection.
- **Navigation to the outside.** The window can only navigate to the local interface; any
  attempt to push it to an external site (exfiltration through the URL) or to a fake page is
  refused.
- **DLL hijacking.** The binary resolves its system dependencies from `System32` only: a
  hostile DLL dropped next to the executable is not loaded.

### What the application does NOT protect against

- **An attacker already inside your Windows session, if encryption is off.** By default
  backups are stored in plain text and any program running under your account can read them.
  Turn encryption on in `Settings → Security` (see below), or keep your exports in an
  encrypted container (BitLocker, VeraCrypt).
- **An attacker present while the application is open.** Even with encryption on, the key
  lives in memory as long as the session is unlocked — otherwise auto-save would ask for the
  passphrase every two seconds.
- **Cloud synchronization.** If you export to `Documents`, `Desktop` or `Downloads`, OneDrive
  may upload your financial data. That is a Windows setting, outside the application's reach.
- **A flaw in the rendering engine.** The interface runs inside WebView2, supplied by
  Microsoft. Its security depends on your Windows updates (see "The rendering engine").
- **A redistributed binary.** Published releases are not signed to this day. Always check
  the SHA-256 fingerprint published next to each release.

## Backup encryption

Optional, off by default. `Settings → Security → Encrypt my backups`.

| Item | Choice |
|---|---|
| Cipher | AES-256-GCM (authenticated: a modified file is rejected, not decrypted into nonsense) |
| Key derivation | PBKDF2-HMAC-SHA-256, 600,000 iterations (OWASP 2023 recommendation) |
| Salt | 16 random bytes, fixed when encryption is turned on, stored in the file |
| IV | 12 random bytes, **renewed on every write** |
| Passphrase | 12 characters minimum, enforced in the service; the interface offers a 5-word random example |
| Scope | automatic backups, backup exports, downloads — no write path bypasses encryption |
| Out of scope | PDFs imported into "Documents", the tax report and the activity log exported on demand (see below), the diagnostic log |
| Rotation | passphrase change without an intermediate plain-text write, with a new salt |
| Turning off | requires the current passphrase, like a passphrase change |

Argon2id would be preferable to PBKDF2, but it does not exist in WebCrypto: shipping it
would mean an extra WebAssembly dependency on the most sensitive path of the software. The
trade-off is deliberate and documented in `frontend/src/services/cryptoService.js`.

**The passphrase cannot be reset.** There is no key escrow, no backdoor and no security
question: if you forget it, your backups are permanently unreadable. Keep it in a password
manager.

When encryption is turned on, backups already written in plain text are deleted — leaving
them beside the encrypted file would protect nothing.

### What encryption does NOT cover

**PDFs imported into "Documents" stay in plain text** on your disk. Encryption applies to
the backup file, not to the statements, trade confirmations and tax forms you add: it is the
system PDF reader that displays them, and it needs a readable file.

Their folders, however, carry **no revealing name**: they are named after the envelope's
internal identifier, never after its name. A folder no longer betrays your broker to anyone
browsing the file explorer.

If those documents are sensitive, keep them in an encrypted container instead of importing
them, or encrypt the whole disk with BitLocker.

**The tax report PDF and the activity log, exported on demand**, are written in plain text
to the location you choose in the "Save as…" dialog. That is intended: those files exist to
be read or handed over (to an accountant, to the tax office). The tax report contains your
detailed tax position; treat it as the sensitive document it is. Backup encryption does not
apply to it — it covers your data's backup, not the documents you produce for the outside.

### Importing someone else's encrypted backup

When an encrypted file is **imported** while your session has no key yet, Fructificare asks
explicitly whether that passphrase should also protect *your own* backups. Answer yes only
if it is your own backup — restored from a USB stick onto a new computer, for instance.

The question is not a formality. Adopting someone else's passphrase means entrusting all
your future backups to a key and a salt that person knows: they would then only need to get
hold of a single one of your files. Answering no prevents nothing — the file is imported and
readable — and you can pick your own passphrase in `Settings → Security`.

A backup coming from the application's own folder does not trigger the question: it is
already yours.

### Changing the passphrase

`Settings → Security → Change the passphrase`. The current passphrase is verified, a **new
salt** is drawn, and the backups are rewritten directly with the new key: at no point does
your data go back to plain text on the disk. Backups the old passphrase could still open are
then deleted.

## Security tests

Eleven JavaScript suites (200+ assertions) and the Rust unit tests, run by CI on every push
and locally with:

```bash
cd frontend && npm run test:security          # JavaScript suites
cd frontend/src-tauri && cargo test --lib     # navigation guard (Rust)
```

| Suite | What it protects |
|---|---|
| `test-documents-path` | Document path validation: without it, a booby-trapped backup would open or delete an arbitrary file |
| `test-import-validation` | Sanitization of imported backups: types, non-finite numbers, prototype keys, paths |
| `test-crypto` | The cryptography: faithful round-trip, wrong passphrase rejected, tampered file detected, IV renewed, iteration count bounded |
| `test-storage-encryption` | The encryption wiring: no write path bypasses it, turning it on rolls back if the write fails, a lost flag is restored, turning it off requires the passphrase |
| `test-recent-files` | The recent files list: no absolute path in displayed fields, complete clearing possible |
| `test-log-privacy` | The diagnostic log: no amount, no name interpolated; static check of the call sites |
| `test-document-folders` | Document folder naming, and the migration of existing installations |
| `test-save-folder` | The migration of the backup folder: nothing is lost when files move |
| `test-passphrase-example` | The passphrase example: drawn uniformly by the cryptographic generator, never predictable |
| `test-gamification-privacy` | No financial data (income, birth date, allocation) written to unencrypted local storage |
| `test-backup-rotation` | Rotation never destroys the encrypted history to make room for plain-text writes |
| `cargo test --lib` | The Rust navigation guard: only the local origin is allowed |

Three further checks run against the configuration and the build output
(`npm run check:build`):

| Check | What it prevents |
|---|---|
| `check-capabilities` | An over-broad Tauri permission coming back into the ACL. In particular "opener:default", which looks harmless but contains `allow-open-url` scoped to `http://*` / `https://*`: enough to send your data out by opening the system browser, beyond the CSP's reach |
| `check-no-inline-script` | An inline script reappearing, which the `script-src 'self'` CSP would block |
| `check-offline` | A remote resource slipping into the build, which would betray offline operation |

Dependencies are audited separately: `npm audit --omit=dev` for the packages actually
shipped — blocking, and currently at zero vulnerabilities — and `cargo audit` for the Rust
crates. The latter fails on vulnerabilities, but not on "unmaintained crate" advisories: the
Tauri tree carries several that no change in this repository can lift. A permanently red CI
only teaches people to ignore the alert.

## The rendering engine: WebView2

Fructificare does not ship its own browser. The whole interface is rendered by **WebView2**,
the engine supplied, installed and updated by Microsoft along with Windows. The application
amounts to a little Rust code opening a window, and JavaScript running *inside that engine*.

The direct consequence: **a WebView2 vulnerability is a Fructificare vulnerability.** The
process sandbox, origin isolation, the JavaScript engine, font and image rendering belong to
Microsoft, not to this repository. No fix published here can compensate for a vulnerable
engine — and the Content-Security-Policy described above applies only because the engine
applies it.

**Keeping Windows up to date is therefore part of Fructificare's security**, as much as
choosing a strong passphrase. WebView2 is updated automatically through the same channel as
Windows and Microsoft Edge. A machine with Windows Update disabled, or with reboots deferred
for months, runs Fructificare on an engine whose flaws are already public.

To check the installed version:

```powershell
(Get-ItemProperty 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}').pv
```

It should closely follow the stable version of Microsoft Edge. If it is months behind, run
Windows Update before entering financial data.

## How this software is built and published

The application protects your data; the binary you download still has to be the one built
from the published code. This is the most valuable link for an attacker: corrupting one
installation exposes one portfolio, corrupting the publishing chain exposes them all.

- **Published binaries are produced by the public CI**, never on the maintainer's machine.
  The build log is public, and the SHA-256 fingerprints are computed by the runner. The
  local `frontend/build-exe.ps1` script is for development and must not be used to publish.
- **GitHub actions are pinned by commit hash**, never by tag. A tag (`@v2`) or a branch
  (`@stable`) is mutable: whoever takes over an action's repository could move it and run
  their code inside the build.
- **The write token is isolated.** The job that compiles — and therefore runs `npm ci` and
  third-party install scripts — has no write permission. Only a second job, which merely
  uploads an already-built artifact, can publish.

### The installer and the network

Once installed, the application makes no network request. **The installer, however, may make
one**: if the WebView2 runtime is missing from your machine, it downloads Microsoft's
official bootstrapper (`go.microsoft.com`) and runs it. WebView2 ships with Windows 11 and is
deployed by Windows Update on Windows 10, so this is rare — but it exists, and it is better
read here than discovered in a firewall log.

If you install on an offline machine without WebView2, install the runtime separately from
Microsoft's site before running the installer.

## Known issues, not fixed

- **Binaries are not signed.** A code-signing certificate costs money; until then,
  verification goes through the published SHA-256 fingerprints and the public CI build log.
- **The diagnostic log is not encrypted.** It no longer contains any amount, envelope name
  or file name — only identifiers and operation types — but it is still exported as plain
  text.
- **Recent file paths are remembered** in the embedded browser's local storage. The path is
  no longer displayed — only the file name and its parent folder are — and
  `File › Recent files` offers to clear the list. The path itself is still needed to point
  the dialog back at reopening time.

## Reporting a vulnerability

Open a private security advisory on the repository (Security tab → Report a vulnerability)
rather than a public issue. If that is not possible, write to astaratcode@gmail.com.

**Acknowledgement within 72 hours**, an assessment within 7 days, and a fix published as
soon as it is ready. You will be credited in the release notes unless you prefer otherwise.

Please include: the affected version, reproduction steps, and the impact you observed.

**What counts as a vulnerability here:** anything that lets a file, a dependency or another
program read, alter or exfiltrate the user's data, run code, or escape the application's
folders — and anything that silently weakens backup encryption.

**What is an ordinary bug** (public issue, please): a wrong figure, a display glitch, a
crash on malformed input that stays contained, a mistake in the tax rules.

## Verifying a release

```powershell
Get-FileHash .\Fructificare_*_x64-setup.exe -Algorithm SHA256
```

Compare with the `SHA256SUMS.txt` file published with the release.

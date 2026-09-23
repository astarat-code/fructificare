# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 astarat-code
# =============================================================================
#  build-exe.ps1 — Builds Fructificare.exe and the Windows installer (Tauri).
#
#  WHY THIS SCRIPT EXISTS
#  The Windows resource compiler (RC.EXE) cannot open an icon path longer than about
#  260 characters: Tauri then prefixes it with "\\?\…", which RC.EXE rejects →
#  "RC.EXE failed to compile specified resource file". A project living in a deep
#  folder tree therefore fails to build.
#  Solution: compile from a COPY placed at a short path (C:\ft), with node_modules
#  mounted as a junction (nothing is duplicated). The artifacts are then brought back
#  into .\dist-tauri.
#
#  PREREQUISITES (one-time install): Rust + MSVC C++ Build Tools + WebView2.
#  USAGE: right-click → "Run with PowerShell", or:  ./build-exe.ps1
#
#  THIS SCRIPT IS NOT FOR PUBLISHING.
#  Distributed binaries are produced by .github/workflows/release.yml, on a fresh
#  runner, with a public build log and SHA-256 fingerprints computed there. Here,
#  C:\ft is a fixed path at the root of a drive, writable by any program running under
#  your session — and it is NOT purged between builds (the Rust cache is kept there).
#  A file dropped into it would survive every synchronization and enter the build.
#  Acceptable for local use. Not for a binary handed to other people.
# =============================================================================

$ErrorActionPreference = "Stop"
$src  = $PSScriptRoot                 # dossier frontend (source réelle)
$work = "C:\ft"                        # copie à chemin court pour la compilation
$dist = Join-Path $src "dist-tauri"    # où déposer les artefacts finaux

# 1) cargo sur le PATH (rustup ne met à jour que les nouveaux terminaux)
$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
if (Test-Path $cargoBin) { $env:PATH = "$cargoBin;$env:PATH" }
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
  Write-Error "cargo introuvable. Installe Rust (winget install Rustlang.Rustup) puis rouvre un terminal."
}

# 2) Copie de la source vers C:\ft (hors node_modules/build/target ; cache de build conservé)
Write-Host ">> Synchronisation de la source vers $work ..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $work | Out-Null
robocopy $src $work /E /XD node_modules build target ".git" /XF "*.log" /NFL /NDL /NJH /NJS /NP | Out-Null

# La copie de travail n'est pas purgée (on conserve le cache de compilation Rust, qui pèse
# lourd) : les fichiers supprimés côté source y survivent donc. On retire explicitement les
# fichiers d'environnement obsolètes, que CRA lirait en priorité sur .env.
Remove-Item (Join-Path $work ".env.local"), (Join-Path $work ".env.development.local") -Force -ErrorAction SilentlyContinue

# 3) node_modules monté par jonction (évite une recopie lourde)
if (-not (Test-Path "$work\node_modules")) {
  New-Item -ItemType Junction -Path "$work\node_modules" -Target "$src\node_modules" | Out-Null
}

# 4) Build Tauri (release) depuis le chemin court
Write-Host ">> tauri build (première fois : 10-20 min ; ensuite quasi instantané)..." -ForegroundColor Cyan
Push-Location $work
# Le script de build de Tauri ne se relance que si tauri.conf.json change : une icône
# remplacée seule laissait l'ancienne dans l'exécutable. On purge donc les artefacts du
# seul crate de l'application (les dépendances, qui font l'essentiel du cache, restent).
# (Via cmd : sous PowerShell 5.1 avec « Stop », rediriger le stderr de cargo interromprait le script.)
cmd /c "cargo clean --release -p fructificare --manifest-path `"$work\src-tauri\Cargo.toml`" >nul 2>&1"
$env:CI = "false"
npm run tauri build
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) { Write-Error "Le build a échoué (code $code). Voir la sortie ci-dessus." }

# 5) Récupération des artefacts
New-Item -ItemType Directory -Force -Path $dist | Out-Null
$exe   = Join-Path $work "src-tauri\target\release\fructificare.exe"
# Le dossier du bundle n'est pas purgé entre deux compilations : les installeurs des
# versions précédentes y restent. Sans le tri, « -First 1 » prenait le premier par ordre
# alphabétique — donc une ancienne version, publiée ensuite sous le nom de la nouvelle.
$setup = Get-ChildItem (Join-Path $work "src-tauri\target\release\bundle\nsis") -Filter "*setup.exe" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
# Même raison côté dist-tauri : l'installeur de la version précédente y resterait, et
# SHA256SUMS.txt listerait les deux.
Remove-Item (Join-Path $dist "*setup.exe") -Force -ErrorAction SilentlyContinue
if (Test-Path $exe)  { Copy-Item $exe (Join-Path $dist "Fructificare.exe") -Force }
if ($setup)          { Copy-Item $setup.FullName $dist -Force }

# 6) Empreintes SHA-256 — à publier avec la version pour que les utilisateurs puissent
#    vérifier qu'ils exécutent bien le binaire annoncé (les binaires ne sont pas signés).
$sums = Join-Path $dist "SHA256SUMS.txt"
Get-ChildItem $dist -Filter "*.exe" |
  Get-FileHash -Algorithm SHA256 |
  ForEach-Object { "{0}  {1}" -f $_.Hash.ToLower(), (Split-Path $_.Path -Leaf) } |
  Set-Content -Path $sums -Encoding ascii
Write-Host ">> Empreintes SHA-256 ecrites dans SHA256SUMS.txt" -ForegroundColor Cyan

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Green
Write-Host " Terminé. Artefacts dans : $dist" -ForegroundColor Green
Get-ChildItem $dist | Select-Object Name, @{N='Mo';E={[math]::Round($_.Length/1MB,1)}} | Format-Table -AutoSize
Write-Host " Double-clique Fructificare.exe pour lancer l'application." -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green

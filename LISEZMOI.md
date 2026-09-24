# Fructificare

**Suivi et simulation de portefeuille d'investissement, hors ligne**, pensé pour les
investisseurs français (PEA, CTO, assurance-vie, PER, livrets réglementés).

**Site : [fructificare.fr](https://fructificare.fr)** · *English: [README.md](README.md).*

[![CI](https://github.com/astarat-code/fructificare/actions/workflows/ci.yml/badge.svg)](https://github.com/astarat-code/fructificare/actions/workflows/ci.yml)
[![Licence : AGPL v3](https://img.shields.io/badge/Licence-AGPL%20v3-blue.svg)](LICENSE)
[![Site](https://img.shields.io/badge/site-fructificare.fr-EFAD24)](https://fructificare.fr)

**100 % locale.** Aucune donnée ne quitte votre ordinateur : pas de compte, pas de serveur,
pas de télémétrie. L'application ne contacte le réseau pour aucune de ses fonctions — les
polices et le manuel sont embarqués dans le binaire, et cette absence est vérifiée
mécaniquement à chaque build.

![Le tableau de bord de Fructificare, avec un portefeuille fictif](docs/images/screenshot-dashboard.png)

| Simulateur fiscal | Trophées et progression |
|---|---|
| ![Le simulateur fiscal](docs/images/screenshot-tax-simulator.png) | ![La page des trophées](docs/images/screenshot-trophies.png) |

*Toutes les captures utilisent un portefeuille fictif, produit par
`docs/manuel/demo/generer-jeu-fictif.js`.*

---

## Pourquoi local, et sans cloud

Un suivi de patrimoine en sait plus sur vous que votre banque : combien vous détenez, où,
depuis quand, ce que vous gagnez et ce que vous projetez. Fructificare est construit pour
que rien de tout cela ne quitte votre machine.

- **Pas de compte, pas de serveur.** Rien à créer, personne à qui confier vos données.
- **Aucune requête réseau.** Polices et manuel sont embarqués ; `npm run check:build` fait
  échouer le build si une ressource distante apparaît.
- **Accès disque minimal.** L'application ne lit et n'écrit que dans ses propres dossiers ;
  tout autre fichier doit être désigné par vous dans une boîte de dialogue native.
- **Vos données restent un fichier qui vous appartient.** Une sauvegarde JSON lisible, que
  vous pouvez exporter, déplacer, chiffrer ou ouvrir dans un éditeur de texte. Aucun
  enfermement, aucun abonnement, aucun risque de fermeture de service.

La contrepartie est assumée : pas de synchronisation automatique entre machines, et pas de
récupération des soldes bancaires. Les deux supposeraient d'envoyer vos identifiants
quelque part.

---

## Installation

Téléchargez le fichier de votre système depuis [fructificare.fr](https://fructificare.fr), ou directement depuis la
[dernière version](https://github.com/astarat-code/fructificare/releases/latest) :

| Système | Fichier | |
|---|---|---|
| **Windows** 10 et 11 | `Fructificare_…_x64-setup.exe` | installation pour l'utilisateur courant, sans droits administrateur |
| **Linux** | `Fructificare_…_amd64.AppImage` | toutes distributions : rendez-le exécutable, puis lancez-le (Ubuntu 24.04+ : installez d'abord `libfuse2`) |
| | `Fructificare_…_amd64.deb` | Debian, Ubuntu et dérivées |
| **macOS** 11+ — *expérimental* | `Fructificare_…_universal.dmg` | Intel et Apple Silicon ; glissez Fructificare dans Applications |

L'application est distribuée **non signée**. Sous Windows, SmartScreen affiche un
avertissement la première fois (*Informations complémentaires → Exécuter quand même*). Sous
macOS, le premier lancement est bloqué jusqu'à ce que vous cliquiez sur *Ouvrir quand même*
dans *Réglages Système → Confidentialité et sécurité*. La version macOS n'est encore testée
que par la CI : les retours d'utilisateurs Mac sont les bienvenus.

Vérifier l'empreinte du fichier est le moyen de s'assurer qu'il est bien celui qui a été
publié :

```bash
Get-FileHash .\Fructificare_*_x64-setup.exe -Algorithm SHA256   # Windows (PowerShell)
sha256sum -c SHA256SUMS.txt --ignore-missing                      # Linux
shasum -a 256 Fructificare_*.dmg                                  # macOS
```

Comparez-la avec `SHA256SUMS.txt`, publié à côté de chaque version. Ces empreintes sont
calculées par la CI publique, dont le journal de build est consultable — pas sur la machine
du mainteneur.

---

## Fonctionnalités

- **Tableau de bord** — vue consolidée de toutes vos enveloppes, avec valeur calibrée et rendements.
- **Enveloppes** — versements, retraits, poche espèces, frais, notes par actif.
- **Types d'actifs** — répartition et performance par catégorie.
- **Simulations** — projection long terme, règle 8-4-3, stress test, objectif FIRE.
- **Calendrier** — budget mensuel, mouvements programmés, rappels de calibration.
- **Rapport fiscal** — export PDF pour la déclaration de revenus.
- **Progression** — trophées, quêtes et score de santé financière.

L'interface existe en français et en anglais (bouton FR/EN dans la barre latérale), ainsi
que le manuel d'utilisation de 82 pages, ouvert par `Aide → Manuel d'utilisation`.

---

## Où sont mes données ?

Tout est rangé dans un dossier d'application, avec deux sous-dossiers : `save`
(sauvegardes automatiques, les 10 dernières) et `documents imp` (documents PDF importés).

| Système | Dossier de l'application |
|---|---|
| Windows | `%APPDATA%\app.fructificare.desktop\` |
| Linux | `~/.local/share/app.fructificare.desktop/` |
| macOS | `~/Library/Application Support/app.fructificare.desktop/` |

Les sauvegardes sont des fichiers JSON **en clair par défaut**, donc lisibles par tout
programme s'exécutant sous votre session utilisateur. Vous pouvez les chiffrer par une phrase
secrète : `Paramètres → Sécurité → Chiffrer mes sauvegardes`. Elle vous sera alors demandée
à chaque ouverture de Fructificare — et **elle ne peut pas être réinitialisée** : si vous
l'oubliez, vos données sont définitivement irrécupérables.

- **Exportez régulièrement** via `Fichier → Exporter une sauvegarde…` (ou `Ctrl+S`, `⌘S` sur macOS).
- Si vous exportez vers `Documents`, `Bureau` ou `Téléchargements`, sachez que ces dossiers
  sont **synchronisés vers OneDrive par défaut** sur Windows 11 : vos données financières
  partiraient alors vers le cloud Microsoft. Préférez un dossier local ou un conteneur
  chiffré (BitLocker, VeraCrypt).

Pour restaurer : `Fichier → Importer une sauvegarde…`

---

## Sécurité et vie privée

L'application s'accorde volontairement un accès disque minimal : elle ne peut lire et écrire
que dans ses propres dossiers. Tout autre fichier n'est accessible que si vous le désignez
explicitement dans une boîte de dialogue native. Une Content-Security-Policy stricte
interdit tout script distant ou en ligne, et la fenêtre ne peut pas naviguer hors de
l'interface locale.

[`docs/SECURITE.md`](docs/SECURITE.md) détaille le modèle de menace complet, ce contre quoi
l'application ne protège pas, et la procédure de signalement d'une faille.

---

## Compiler soi-même

Node.js 20 et Rust suffisent. Voir [`CONTRIBUTING.md`](CONTRIBUTING.md) pour
l'environnement de développement, les suites de tests et le build.

**Prérequis :** Node.js 20 LTS et Rust, plus les bibliothèques système de votre plateforme —
MSVC C++ Build Tools et WebView2 sous Windows, WebKitGTK sous Linux, Xcode Command Line Tools
sous macOS (détails dans `CONTRIBUTING.md`). Chaque système compile sa propre application.

```bash
cd frontend
npm ci
npm run build          # interface web
npm run tauri build    # application de bureau pour le système courant
```

---

## État et feuille de route

**v1.1.0 — Linux et macOS.** L'application est complète et utilisée au quotidien, mais elle
n'a tourné que sur quelques machines. Windows et Linux sont pris en charge ; la version macOS
reste expérimentale tant que des utilisateurs Mac ne l'ont pas essayée. Attendez-vous à des
aspérités, et signalez-les.

Ce qui est prévu, dans cet ordre :

- **Des binaires signés.** L'avertissement SmartScreen et la vérification d'empreinte sont
  une mauvaise expérience ; l'objectif est un certificat gratuit pour projet open source
  (SignPath Foundation).
- **Une distribution par winget**, pour installer et mettre à jour en une commande.
- **Plus de types d'actifs et de cas fiscaux**, selon ce que les utilisateurs détiennent
  réellement.

Les idées sont les bienvenues dans les
[issues](https://github.com/astarat-code/fructificare/issues).

---

## Ce logiciel ne donne pas de conseil en investissement

Fructificare est un outil informatif. Il ne recommande aucun placement et ne passe aucun
ordre. Les calculs fiscaux suivent les règles françaises en vigueur en janvier 2026 et sont
des estimations : ils ne remplacent ni une déclaration officielle, ni un expert-comptable,
ni un conseiller en gestion de patrimoine.

---

## Licence

[AGPL-3.0-or-later](LICENSE). Utilisation, étude, modification et redistribution libres, à
condition que les versions modifiées restent sous la même licence.

Les avatars de progression reprennent des icônes de [Phosphor Icons](https://phosphoricons.com)
(licence MIT, © 2023 Phosphor Icons) et l'icône « dragon » de
[Font Awesome Free](https://fontawesome.com) (licence CC BY 4.0, © Fonticons, Inc.). Les
mentions de licence accompagnent les tracés, dans
`frontend/src/components/gamification/avatarIcons.js`.

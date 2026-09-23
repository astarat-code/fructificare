# Manuel d'utilisation

Le manuel est **écrit en JavaScript**, pas dans Word : `build-manuel.js` assemble les
chapitres de `chapitres/` en appliquant les styles de `lib/kit.js`, et produit le `.docx`.
Le `.pdf` en est ensuite exporté. Cela garantit une mise en forme homogène sur 82 pages,
et rend les corrections traçables.

**Ne modifiez pas le `.docx` à la main** : il est régénéré à chaque build, vos changements
seraient perdus. Éditez les fichiers de `chapitres/`.

## Produire le manuel

```bash
cd docs/manuel
npm install                          # une seule fois
node build-manuel.js                 # écrit Fructificare-Manuel.docx (français)
MANUEL_LANG=en node build-manuel.js  # écrit Fructificare-Manual.docx (anglais)
```

Le manuel existe en deux langues, avec la même structure :

| | Français | Anglais |
|---|---|---|
| Chapitres | `chapitres/` | `chapitres-en/` |
| Captures | `captures/` | `captures-en/` |
| Schémas | `schemas/` | `schemas-en/` |
| PDF embarqué | `Fructificare-Manuel.pdf` | `Fructificare-Manual.pdf` |

`lib/kit.js` lit `MANUEL_LANG` : dossier des captures et libellés des encadrés
(« Bon à savoir » / « Good to know »…). Les icônes d'avatar (`captures/avatars/`) sont
communes aux deux langues. Toute modification d'un chapitre français doit être reportée
dans son jumeau anglais.

L'application ouvre le PDF de sa langue d'affichage (`frontend/src/lib/openManual.js`) :
les deux fichiers doivent donc être présents dans `frontend/public/manuel/`.

### Exporter le PDF

En deux temps. **Word d'abord**, uniquement pour renseigner le sommaire — le champ TOC
reste vide tant qu'un traitement de texte ne l'a pas calculé :

```powershell
$w = New-Object -ComObject Word.Application; $w.Visible = $false
$d = $w.Documents.Open("C:\ftman\Fructificare-Manuel.docx", $false, $false)
foreach ($toc in $d.TablesOfContents) { $toc.Update() }
$d.Fields.Update(); $d.Repaginate(); $d.Save(); $d.Close($true); $w.Quit()
```

**LibreOffice ensuite**, pour le PDF :

```powershell
& "C:\Program Files\LibreOffice\program\soffice.exe" --headless --norestore `
  --convert-to pdf --outdir C:\ftman C:\ftman\Fructificare-Manuel.docx
```

> **Les options de filtre passées à `--convert-to` sont ignorées** par cette version
> (`MaxImageResolution`, `Quality`...) : mesuré, le PDF sort identique avec ou sans elles.
> La qualité des figures se règle donc **à la capture**, pas à l'export. LibreOffice stocke
> les images sans perte : environ 4,5 Mo pour 80 pages et 37 captures.

> **Chemin trop long.** Word refuse d'ouvrir un fichier dont le chemin dépasse 260 caractères
> — c'est le cas ici. Copiez le `.docx` dans un dossier court (`C:\ftman`) avant de le
> convertir, comme le fait `frontend/build-exe.ps1` pour la compilation.

Même procédure pour le manuel anglais, avec `Fructificare-Manual.docx`. Une fois les PDF
produits, recopiez-les dans l'application pour qu'ils soient embarqués :

```bash
cp Fructificare-Manuel.pdf ../../frontend/public/manuel/Fructificare-Manuel.pdf
cp Fructificare-Manual.pdf ../../frontend/public/manuel/Fructificare-Manual.pdf
```

Puis reconstruisez l'exécutable (`frontend/build-exe.ps1`).

## Les captures d'écran

`captures/` contient les images insérées par `figure()` dans `lib/kit.js`. Si une image
manque, le manuel reste compilable : un encadré signale la capture à refaire. Une figure
composée de plusieurs vues côte à côte se dépose sous `fig-4.6.1.png`, `fig-4.6.2.png`…
et reçoit ses sous-légendes par le quatrième argument de `figure()`.

### Un jeu de données entièrement fictif

**Aucune capture ne doit montrer un patrimoine réel**, même « anonymisé » : montants,
mouvements types, noms de courtiers ou date de naissance suffisent à reconnaître quelqu'un.
Les captures sont faites sur un jeu inventé de toutes pièces :

```bash
node demo/generer-jeu-fictif.js          # à relancer le jour des captures
```

Il produit, dans `demo/`, chaque fichier en deux versions : française, et anglaise
(`-en.json`, libellés saisis traduits et interface réglée en anglais) pour les captures du
manuel anglais.

| Fichier | Sert à |
|---|---|
| `fructificare-jeu-fictif.json` | Toutes les pages : six enveloppes, mouvements types, séries, calibrations, budget, rappels, notifications, profil « Gabriel » |
| `fructificare-jeu-fictif-rattrapage.json` | Figure 3.4 : les dernières échéances ne sont pas encore appliquées |
| `fructificare-gabriel.json` | Parcours guidé (chapitre 2) : une assurance vie de quelques années, palier « Trésor », objectif du million |

Les occurrences passées des séries y sont déjà écrites : l'import ne déclenche aucun
rattrapage (sauf dans la variante prévue pour cela).

### Prendre les captures

```bash
# 1. construire l'application web (frontend/build-exe.ps1 le fait dans C:tuild)
# 2. la servir avec le jeu fictif — rien n'est copié dans le dossier de build
node demo/serveur-captures.js C:/ft/build      # http://127.0.0.1:4173
# 3. les pages simples
node captures-shoot.js ./captures
```

Le serveur expose le jeu principal à `/__seed.json` et les variantes à `/__demo/<fichier>`.
Les vues qui demandent une manipulation (formulaires remplis, fenêtres de confirmation,
bascules du camembert, stress test, simulations comparées…) se capturent en pilotant la
même instance d'Edge avec puppeteer : importer le jeu, jouer les clics, puis photographier
l'élément. Deux pièges connus :

- **garder l'onglet au premier plan** (`page.bringToFront()`), sinon les animations des
  graphiques ne s'exécutent pas et les courbes restent invisibles ;
- **photographier avec `captureBeyondViewport: false`** : sinon la page est remise en page
  à la volée, les graphiques repartent de zéro et la capture sort vide. Pour un élément plus
  haut que la fenêtre, agrandir la fenêtre plutôt.

Pour une capture « version bureau », masquer ce qui n'existe qu'en mode navigateur : les
liens Glossaire et Paramètres de la barre latérale, les boutons Sauvegarder / langue /
thème, et les bandeaux « Mode navigateur ».

### Schémas et avatars

```bash
node schemas/rendre.js     # schemas/ → captures/, schemas-en/ → captures-en/
node avatars-shoot.js      # icônes des paliers → captures/avatars/*.png (tableau du § 16.5)
```

**La densité est réglée à deux endroits, qui doivent rester d'accord :**
`deviceScaleFactor` (1,5) dans les scripts de capture et `PPP` (225) dans `lib/kit.js`. Le
premier décide du nombre de pixels capturés, le second traduit ces pixels en taille imprimée.

`lib/kit.js` lit les dimensions réelles de chaque PNG et **préserve le ratio** ; aucune image
n'est agrandie au-delà de sa taille naturelle.

Points à connaître :

- **La navigation est pilotée côté client.** En mode navigateur, les données vivent en
  mémoire : un vrai rechargement les effacerait.
- **La barre de menu native (Fichier / Éditer / Affichage / Aide) n'est pas capturable**
  ainsi : elle appartient à Windows, pas à la page.

## Structure

| Fichier | Rôle |
|---|---|
| `build-manuel.js` | Assemblage, styles de document, en-têtes et pieds de page |
| `lib/kit.js` | Briques de mise en forme : titres, encadrés, tableaux, captures |
| `chapitres/ch00-front.js` | Page de titre, mode d'emploi, sommaire |
| `chapitres/ch01…ch16` | Un fichier par chapitre |
| `captures/` | Les images du manuel |
| `demo/` | Jeu de données fictif et serveur de captures |
| `schemas/` | Schémas SVG et leur rendu |
| `avatars-shoot.js` | Rendu des icônes d'avatar du § 16.5 |

Les chapitres n'utilisent que les fabriques de `kit.js`, jamais l'API `docx` directement :
c'est ce qui garde la mise en forme cohérente d'un bout à l'autre.

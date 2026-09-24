# Politique de sécurité

*English version: [`SECURITY.md`](../SECURITY.md).*

## Modèle de menace

Fructificare est une application de bureau mono-utilisateur, hors ligne, sans compte ni
serveur. Elle n'expose aucun port et n'émet aucune requête réseau.

### Ce contre quoi l'application protège

- **Fichier de sauvegarde piégé.** Les chemins de documents lus depuis une sauvegarde sont
  validés strictement : un chemin qui tenterait de sortir des dossiers de l'application est
  refusé, jamais ouvert ni supprimé.
- **Débordement de privilèges.** L'accès disque est limité par la configuration Tauri aux
  dossiers de l'application. Tout autre fichier n'est accessible que pour la session en
  cours, et seulement après que l'utilisateur l'a désigné dans une boîte de dialogue native.
- **Ouverture de fichier détournée.** L'application ne peut faire ouvrir par le système que
  des fichiers `.pdf` (documents, manuel) ou son dossier de documents : une sauvegarde
  piégée ne peut pas lui faire lancer un `.bat`, un `.exe` ou un raccourci.
- **Injection de contenu.** Une Content-Security-Policy stricte interdit tout script externe
  ou en ligne, ainsi que toute connexion sortante.
- **Navigation vers l'extérieur.** La fenêtre ne peut naviguer que vers l'interface locale ;
  toute tentative de la pousser vers un site externe (exfiltration par l'URL) ou une fausse
  page est refusée.
- **Détournement de DLL.** Le binaire ne résout ses dépendances système que depuis
  `System32` : une DLL piégée déposée à côté de l'exécutable n'est pas chargée.

### Ce contre quoi l'application NE protège PAS

- **Un attaquant ayant déjà accès à votre session utilisateur, si le chiffrement est désactivé.**
  Par défaut les sauvegardes sont stockées en clair et tout programme s'exécutant sous votre
  compte peut les lire. Activez le chiffrement dans `Paramètres → Sécurité` (voir plus bas),
  ou placez vos exports dans un conteneur chiffré (BitLocker, VeraCrypt).
- **Un attaquant présent pendant que l'application est ouverte.** Même avec le chiffrement
  actif, la clé vit en mémoire tant que la session est déverrouillée — sinon l'enregistrement
  automatique devrait redemander la phrase toutes les deux secondes.
- **La synchronisation cloud.** Si vous exportez vers `Documents`, `Bureau` ou
  `Téléchargements`, OneDrive peut téléverser vos données financières. C'est un réglage
  Windows, hors de portée de l'application.
- **Une faille du moteur d'affichage.** L'interface s'exécute dans le moteur web du
  système — WebView2 sous Windows, WebKitGTK sous Linux, WebKit sous macOS. Sa sécurité
  dépend de vos mises à jour système (voir « Le moteur d'affichage »).
- **Un binaire redistribué.** Les versions publiées ne sont pas signées à ce jour. Vérifiez
  systématiquement l'empreinte SHA-256 publiée à côté de chaque version.

## Chiffrement des sauvegardes

Optionnel, désactivé par défaut. `Paramètres → Sécurité → Chiffrer mes sauvegardes`.

| Élément | Choix |
|---|---|
| Chiffrement | AES-256-GCM (authentifié : un fichier modifié est rejeté, pas déchiffré de travers) |
| Dérivation de clé | PBKDF2-HMAC-SHA-256, 600 000 itérations (recommandation OWASP 2023) |
| Sel | 16 octets aléatoires, fixé à l'activation, publié dans le fichier |
| IV | 12 octets aléatoires, **renouvelés à chaque écriture** |
| Phrase | 12 caractères minimum, contrôlés côté service ; l'interface propose un exemple de 5 mots tirés au hasard |
| Portée | sauvegardes automatiques, exports de sauvegarde, téléchargements — aucun chemin d'écriture ne contourne le chiffrement |
| Hors portée | les PDF importés dans « Documents », le rapport fiscal et le journal exportés à la demande (voir plus bas), le journal de diagnostic |
| Rotation | changement de phrase sans écriture en clair intermédiaire, avec nouveau sel |
| Désactivation | exige la phrase actuelle, comme le changement de phrase |

Argon2id serait préférable à PBKDF2, mais n'existe pas dans WebCrypto : l'embarquer
supposerait une dépendance WebAssembly supplémentaire sur le chemin le plus sensible du
logiciel. Le compromis est assumé et documenté dans `frontend/src/services/cryptoService.js`.

**La phrase secrète ne peut pas être réinitialisée.** Il n'existe ni séquestre de clé, ni
porte dérobée, ni question de secours : si vous l'oubliez, vos sauvegardes sont
définitivement illisibles. Conservez-la dans un gestionnaire de mots de passe.

À l'activation, les sauvegardes déjà écrites en clair sont supprimées — les laisser à côté
du fichier chiffré ne protégerait rien.

### Ce que le chiffrement NE couvre PAS

**Les PDF importés dans « Documents » restent en clair** sur votre disque. Le chiffrement
s'applique au fichier de sauvegarde, pas aux relevés de compte, avis d'opéré et IFU que
vous ajoutez : c'est le lecteur PDF du système qui les affiche, et il lui faut un fichier
lisible.

Leurs dossiers ne portent en revanche **aucun nom révélateur** : ils sont nommés d'après
l'identifiant interne de l'enveloppe, jamais d'après son nom. Un dossier ne trahit donc
plus le courtier à la simple lecture de l'explorateur de fichiers.

Si ces documents sont sensibles, rangez-les dans un conteneur chiffré plutôt que de les
importer, ou chiffrez le disque entier avec BitLocker.

**Le rapport fiscal PDF et le journal d'activité, exportés à la demande**, sont écrits en
clair à l'emplacement que vous choisissez dans la boîte « Enregistrer sous… ». C'est voulu :
ces fichiers sont destinés à être lus ou transmis (à un comptable, à l'administration).
Le rapport fiscal contient votre bilan fiscal détaillé ; traitez-le comme le document
sensible qu'il est. Le chiffrement des sauvegardes ne s'y applique pas — il ne couvre que
la sauvegarde de vos données, pas les documents que vous produisez pour l'extérieur.

### Importer la sauvegarde chiffrée de quelqu'un d'autre

Quand un fichier chiffré est **importé** et que votre session n'a pas encore de clé,
Fructificare vous demande explicitement si cette phrase doit aussi protéger *vos* propres
sauvegardes. Répondez oui seulement s'il s'agit de votre sauvegarde — restaurée depuis une
clé USB sur un nouvel ordinateur, par exemple.

La question n'est pas une formalité. Adopter la phrase d'un tiers revient à confier toutes
vos sauvegardes suivantes à une clé et à un sel que cette personne connaît : il lui
suffirait ensuite de mettre la main sur un seul de vos fichiers. Répondre non n'empêche
rien — le fichier est importé et lisible — et vous pourrez choisir votre propre phrase
dans `Paramètres → Sécurité`.

Une sauvegarde du dossier de l'application ne déclenche pas cette question : elle est déjà
la vôtre.

### Changer de phrase secrète

`Paramètres → Sécurité → Changer la phrase secrète`. La phrase actuelle est vérifiée, un
**nouveau sel** est tiré, et les sauvegardes sont réécrites directement avec la nouvelle
clé : à aucun moment vos données ne repassent en clair sur le disque. Les sauvegardes que
l'ancienne phrase ouvrait encore sont ensuite supprimées.

## Tests de sécurité

Onze suites JavaScript (plus de 200 assertions) et les tests unitaires Rust, exécutés à
chaque poussée par la CI et lançables localement :

```bash
cd frontend && npm run test:security          # suites JavaScript
cd frontend/src-tauri && cargo test --lib      # garde de navigation (Rust)
```

| Suite | Ce qu'elle protège |
|---|---|
| `test-documents-path` | La validation des chemins de documents : sans elle, une sauvegarde piégée ferait exécuter ou supprimer un fichier arbitraire |
| `test-import-validation` | L'assainissement des sauvegardes importées : types, nombres non finis, clés de prototype, chemins |
| `test-crypto` | La cryptographie : aller-retour fidèle, phrase erronée rejetée, fichier altéré détecté, IV renouvelé, nombre d'itérations borné |
| `test-storage-encryption` | Le câblage du chiffrement : aucun chemin d'écriture ne le contourne, l'activation s'annule si l'écriture échoue, l'indicateur perdu est rétabli, la désactivation exige la phrase |
| `test-recent-files` | La liste des fichiers récents : aucun chemin absolu dans les champs affichés, effacement complet possible |
| `test-log-privacy` | Le journal de diagnostic : aucun montant ni nom interpolé, contrôle statique des appels |
| `test-document-folders` | Le nommage des dossiers de documents, et la migration des installations existantes |
| `test-passphrase-example` | L'exemple de phrase secrète : tiré uniformément par le générateur cryptographique, jamais prévisible |
| `test-gamification-privacy` | Aucune donnée financière (revenu, naissance, allocation) écrite dans le stockage local non chiffré |
| `test-save-folder` | La migration du dossier de sauvegarde : aucun fichier perdu au passage |
| `test-backup-rotation` | La rotation ne détruit jamais l'historique chiffré pour faire place à une écriture en clair |
| `cargo test --lib` | Le garde de navigation Rust : seule l'origine locale est autorisée |

Trois contrôles supplémentaires s'exécutent sur la configuration et le résultat du
build (`npm run check:build`) :

| Contrôle | Ce qu'il empêche |
|---|---|
| `check-capabilities` | Qu'une permission Tauri trop large revienne dans l'ACL. En particulier « opener:default », qui semble anodin mais contient `allow-open-url` avec une portée `http://*` / `https://*` : de quoi faire sortir vos données en ouvrant le navigateur système, hors de portée de la CSP |
| `check-no-inline-script` | Qu'un script inline réapparaisse, ce que la CSP `script-src 'self'` bloquerait |
| `check-offline` | Qu'une ressource distante se glisse dans le build, ce qui trahirait le fonctionnement hors ligne |

Les dépendances sont auditées séparément : `npm audit --omit=dev` pour les 48 paquets
réellement embarqués — bloquant, et actuellement à zéro vulnérabilité — et `cargo audit`
pour les crates Rust. Ce dernier échoue sur une vulnérabilité, mais pas sur les avis
« crate non maintenue » : l'arbre Tauri en traîne plusieurs, qu'aucune modification de ce
dépôt ne peut lever. Une CI rouge en permanence n'apprendrait qu'à ignorer l'alerte.

## Le moteur d'affichage

Fructificare n'embarque pas son propre navigateur. Toute l'interface est rendue par le
moteur web du système : **WebView2** sous Windows, **WebKitGTK** sous Linux, **WebKit**
sous macOS. L'application se réduit à un peu de code Rust qui ouvre une fenêtre, et à du
JavaScript qui s'exécute *à l'intérieur de ce moteur*.

Conséquence directe : **une faille de ce moteur est une faille de Fructificare.** Le bac à
sable des processus, l'isolation des origines, l'interpréteur JavaScript, le rendu des
polices et des images appartiennent à Microsoft, à la distribution Linux ou à Apple, pas à
ce dépôt. Aucun correctif publié
ici ne peut compenser un moteur vulnérable — et la Content-Security-Policy décrite plus
haut n'est appliquée que parce que le moteur l'applique.

**Mettre le système à jour fait donc partie de la sécurité de Fructificare**, au même titre
que choisir une phrase secrète solide.

### Windows : WebView2

WebView2 est fourni, installé et mis à jour par Microsoft. Il est mis à jour automatiquement par le même
canal que Windows et Microsoft Edge. Une machine dont Windows Update est désactivé, ou dont
les redémarrages sont repoussés depuis des mois, exécute Fructificare sur un moteur dont
les failles sont déjà publiques.

Pour connaître la version installée :

```powershell
(Get-ItemProperty 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}').pv
```

Elle doit suivre de près la version stable de Microsoft Edge. Si elle a plusieurs mois de
retard, lancez Windows Update avant d'y saisir vos données financières.

### Linux : WebKitGTK

Le paquet **`.deb`** utilise le WebKitGTK du système, mis à jour par la distribution avec
le reste (`apt upgrade`). L'**AppImage** emporte sa propre copie des bibliothèques dont il a
besoin, figée au moment du build de la version : il ne reçoit les correctifs du moteur
qu'avec une nouvelle version de Fructificare. Sous Debian, Ubuntu et dérivées, préférez le
`.deb`.

### macOS : WebKit

WebKit fait partie de macOS et se met à jour avec lui (*Réglages Système → Général → Mise à
jour de logiciels*). La version macOS est expérimentale : elle est compilée et lancée par la
CI, mais n'a pas encore été examinée sur de vraies machines.

## Comment ce logiciel est construit et publié

L'application protège vos données ; encore faut-il que le binaire que vous téléchargez
soit bien celui du code publié. C'est le maillon le plus précieux pour un attaquant :
corrompre une installation expose un patrimoine, corrompre la chaîne de publication les
expose tous.

- **Les binaires publiés sont produits par la CI publique**, jamais sur la machine du
  mainteneur. Le journal de build est consultable, et les empreintes SHA-256 sont
  calculées par le runner. Le script local `frontend/build-exe.ps1` sert au développement
  et ne doit pas servir à publier.
- **Les actions GitHub sont épinglées par empreinte de commit**, jamais par étiquette.
  Une étiquette (`@v2`) ou une branche (`@stable`) est mutable : celui qui prendrait le
  contrôle d'un dépôt d'action pourrait la déplacer et exécuter son code dans le build.
- **Le jeton d'écriture est isolé.** Le job qui compile — donc celui qui exécute `npm ci`
  et les scripts d'installation de dépendances tierces — n'a aucun droit d'écriture. Seul
  un second job, qui ne fait que téléverser un artefact déjà construit, peut publier.

### L'installeur et le réseau

L'application, une fois installée, n'émet aucune requête réseau. **L'installeur, lui, peut
en émettre une** : si le runtime WebView2 est absent de votre machine, il télécharge
l'amorceur officiel de Microsoft (`go.microsoft.com`) et l'exécute. WebView2 étant fourni
d'origine avec Windows 11 et déployé par Windows Update sur Windows 10, ce cas est rare —
mais il existe, et il vaut mieux le lire ici que le découvrir dans un pare-feu.

Si vous installez sur une machine hors ligne dépourvue de WebView2, installez le runtime
séparément depuis le site de Microsoft avant de lancer l'installeur.

## Points connus, non corrigés

- **Les binaires ne sont pas signés.** Un certificat de signature de code est payant ;
  en attendant, la vérification passe par les empreintes SHA-256 publiées et par le
  journal de build public de la CI.
- **Le journal de diagnostic n'est pas chiffré.** Il ne contient plus ni montant, ni nom
  d'enveloppe, ni nom de fichier — seulement des identifiants et des types d'opération —
  mais il reste exporté en texte clair.
- **Le chemin des fichiers récents est mémorisé** dans le stockage local du navigateur
  embarqué. Il n'est plus affiché — seuls le nom du fichier et son dossier parent le
  sont — et « Fichier › Fichiers récents » propose de vider la liste. Le chemin lui-même
  reste nécessaire pour repointer la boîte de dialogue à la réouverture.

## Signaler une faille

Ouvrez un *security advisory* privé sur le dépôt (onglet Security → Report a vulnerability)
plutôt qu'une issue publique. Si ce n'est pas possible, écrivez à astaratcode@gmail.com.

**Accusé de réception sous 72 heures**, évaluation sous 7 jours, correctif publié dès qu'il
est prêt. Vous serez crédité dans les notes de version, sauf si vous préférez l'inverse.

Merci d'inclure : la version concernée, les étapes de reproduction, et l'impact constaté.

**Ce qui compte comme faille ici** : tout ce qui permet à un fichier, à une dépendance ou à
un autre programme de lire, d'altérer ou d'exfiltrer les données de l'utilisateur,
d'exécuter du code, ou de sortir des dossiers de l'application — et tout ce qui affaiblit
silencieusement le chiffrement des sauvegardes.

**Ce qui relève du bug ordinaire** (issue publique, avec plaisir) : un chiffre faux, un
défaut d'affichage, un plantage sur une saisie malformée qui reste contenu, une erreur dans
les règles fiscales.

## Vérifier une version

```powershell
Get-FileHash .\Fructificare_*_x64-setup.exe -Algorithm SHA256
```

Comparez avec le fichier `SHA256SUMS.txt` publié avec la version.

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * passphraseExample.js — A strong example passphrase, drawn at random.
 *
 * WHY A DRAW AND NOT A FIXED EXAMPLE: Fructificare's code is public. A hard-coded example
 * phrase would be known to everyone, and every user who copied it — which always happens —
 * would protect their data with a phrase anyone can read in the repository. The example is
 * therefore drawn on the user's machine, on every display, and stored nowhere: it can be
 * adopted as-is.
 *
 * WHY WORDS: five random words are far easier to remember than twelve random characters,
 * for comparable resistance. What makes the phrase strong is not the rarity of the words —
 * they are deliberately common — but the RANDOMNESS of the draw: the attacker knows the
 * list, not the draw.
 *
 * STRENGTH: 5 × log2(list size) bits. With ~1,150 words, about 51 bits. Since every attempt
 * costs 600,000 PBKDF2 iterations, exhausting even a noticeable fraction of that space
 * would take thousands of years of computation on specialized hardware.
 *
 * RULES OF THE LIST (checked by scripts/test-passphrase-example.js):
 *   • lowercase, unaccented, 4 to 8 letters: typed identically on any keyboard;
 *   • no duplicate: a duplicate would silently reduce the advertised strength;
 *   • neutral, common words.
 */

const WORDS = `
abeille agneau aigle alpaga anguille antilope baleine belette bison blaireau
bouc bourdon brebis buffle caille canard caniche carpe castor chacal
chameau chamois chat chaton cheval chien chiot chouette cigale cigogne
cobaye colibri condor coyote crabe crapaud criquet cygne dauphin dindon
dragon escargot faisan faucon fennec fourmi furet gazelle gecko girafe
gorille grillon hamster hareng hibou homard iguane jaguar koala lama
lapin lion lionne loup loutre lynx marmotte merle mouette mouton
mulet narval orque otarie ours panda paon papillon perdrix phoque
pieuvre pigeon pingouin poney poulain poule poulet poussin puma putois
python raie renard renne requin sanglier sardine saumon serin singe
souris tapir taupe taureau tigre toucan tortue truite vache vautour
veau arbre branche buisson cactus cascade caverne chemin colline corail
coteau dune falaise feuille fleur fleuve gazon glacier granit grotte
herbe jardin jungle lagune lande lichen marais mousse montagne nuage
oasis orage pelouse pierre plage plaine plateau prairie rivage rocher
ruisseau sable sapin savane sentier sillon sommet source steppe torrent
toundra tronc vallon verger volcan bambou baobab bouleau cerisier figuier
houx laurier lilas lierre magnolia mimosa noyer olivier orme palmier
peuplier pommier platane roseau saule tilleul tulipe violette lavande muguet
narcisse pivoine souci bleuet iris jasmin lotus dahlia glycine chardon
ortie myrtille fraise cerise prune poire pomme abricot citron orange
banane mangue ananas kiwi melon raisin figue datte olive noisette
noix amande pistache papaye goyave litchi cassis airelle tomate carotte
navet radis poireau chou courge potiron oignon poivron piment persil
basilic thym menthe cumin safran vanille cannelle sucre farine beurre
fromage yaourt lait miel biscuit tarte galette brioche baguette pain
soupe salade omelette pizza couscous lentille haricot armoire assiette balai
banc bassine bocal bougie bureau cadre carafe chaise coffre coussin
couteau couvert fauteuil lampe lanterne marmite miroir nappe oreiller panier
placard porte rideau robinet sofa table tabouret tapis tasse tiroir
toit torchon valise vase verre horloge pendule sablier boussole jumelles
loupe crayon stylo gomme cahier carnet classeur agrafe ciseaux colle
compas cartable trousse livre album journal revue affiche tableau pinceau
palette chevalet toile argile ciment brique tuile planche clou marteau
scie pince perceuse rabot tenaille corde ficelle cadenas clef serrure
bouton aiguille bobine laine coton soie velours satin cuir perle
bijou bague collier bracelet montre lunettes chapeau bonnet gant manteau
veste chemise jupe robe pantalon short pull gilet sandale botte
chausson ceinture cravate poche sacoche cabas avion bateau barque camion
caravane chariot galion gondole kayak moto navire paquebot pirogue radeau
remorque scooter tracteur train tramway voilier voiture wagon taxi route
pont tunnel gare port phare ancre voile rame carte billet
bagage escale voyage trajet balade camping tente refuge auberge chalet
cabane maison villa manoir palais tour donjon moulin grange ferme
hangar atelier usine magasin boutique statue avenue quartier village bourg
ville capitale campagne banlieue banjo basson batterie clairon guitare harpe
hautbois piano tambour tuba violon orgue cymbale gong triangle chanson
rythme refrain concert ballet danse valse tango salsa rumba polka
samba jazz blues reggae conte fable roman histoire mythe dessin
peinture gravure fresque portrait paysage atome cosmos galaxie lune orbite
soleil aurore horizon cristal quartz rubis saphir topaze opale jade
ambre onyx diamant argent bronze cuivre nickel zinc platine titane
cobalt chrome mercure carbone azote radium aimant prisme laser pixel
robot radar sonar signal antenne circuit moteur turbine piston levier
rouage ressort capteur formule nombre chiffre calcul vecteur cercle cube
cylindre pyramide spirale losange ovale angle ligne point courbe surface
volume gramme litre seconde minute heure jour semaine mois saison
automne hiver matin midi soir nuit aube instant moment brume
bruine neige givre verglas pluie averse tonnerre ouragan cyclone tornade
mousson vent brise bise chaleur climat flocon blanc noir rouge
bleu vert jaune violet gris brun beige marron indigo cyan
magenta pourpre ocre carmin azur ivoire grand petit large long
court haut lourd doux chaud froid frais humide clair sombre
brillant calme rapide lent agile habile joyeux gentil poli sage
fier brave heureux curieux discret loyal tendre subtil solide fragile
souple robuste mince rond plat lisse rugueux soyeux velu pointu
droit oblique vertical central lointain proche voisin ancien moderne nouveau
jeune vieux antique rare commun simple double triple unique entier
parfait serein paisible vaste immense royal noble rustique sauvage fertile
aride fluide liquide opaque limpide amer acide fondant croquant moelleux
aimer chanter danser marcher courir sauter nager voler rouler glisser
grimper planer flotter plonger tourner jouer rire sourire parler crier
siffler regarder observer chercher trouver garder donner offrir prendre porter
tirer pousser lancer cueillir planter semer arroser tailler bouger dormir
penser compter lire dessiner peindre sculpter coudre tricoter broder cuisiner
cuire mijoter griller bouillir manger boire partager inviter visiter voyager
explorer camper pagayer ramer piloter conduire bricoler ranger nettoyer laver
frotter polir briller allumer ouvrir fermer monter entrer sortir arriver
partir rester venir revenir choisir finir grandir rougir blanchir fleurir
nourrir bondir jaillir surgir franchir gravir fournir remplir saisir acteur
artiste auteur avocat berger boucher chanteur cocher danseur dentiste docteur
douanier facteur fermier forgeron gardien guide horloger jongleur juge lecteur
luthier maire marin meunier mineur musicien notaire orateur peintre pilote
pirate plombier pompier potier prince reine tailleur vendeur vigneron voyageur
savant magicien clown acrobate cavalier matelot amiral corsaire viking druide
lutin elfe ogre licorne griffon centaure titan nymphe farfadet gnome
sorcier balle ballon billard bille cerceau dame domino jouet kermesse
loto marelle osselet pion poker puzzle quille raquette toupie tarot
belote rugby tennis golf judo boxe escrime surf luge patin
natation aviron cyclisme marathon relais sprint podium victoire record arbitre
match tournoi finale score abri accord adresse aile ampoule animal
anneau appel astuce atlas audace avenir aventure balcon bandeau barrage
bassin bazar berceau bilan bistrot blason bocage bonheur bosquet bouquet
bravo bulle cabinet cadeau cadran caillou calepin cantine capsule caramel
carnaval carrosse casque chapitre charbon chiffon chocolat cible cierge cirque
clocher cloche cocon coffret colombe comptoir concept confort copain corbeau
cornet costume cotillon coupole courrier crique croquis destin devise diapason
domaine dossier douceur drapeau duvet effort envol escalier espace espoir
essai essence estrade exemple fanfare fanion festin festival feuillet fiacre
filet flambeau flamme fortune fossile fourneau foyer fragment frimas fronton
futur gadget galet galop garage gazette gerbe geyser glaise globe
gobelet golfe goudron gourde graine grenier grelot grimoire guichet hameau
harmonie hasard havre hublot igloo image indice insigne jeton joyau
jumeau kiosque lacet lagon lampion langage lettre lexique limace lingot
linge logis lucarne lueur lustre macaron maillon malice maquette marbre
mascotte matelas message meuble micro mirage monnaie morceau motif mouchoir
murmure museau nacelle nectar nougat nuance objet ombre onde ornement
outil ouvrage panache panorama papier parfum passage pastel pastille pavillon
pelote perchoir pilier pionnier piste plume poivre pollen portail poterie
profil projet promesse proverbe pupitre rayon relief remous repas retour
ricochet rouleau ruban rucher sachet secret sillage silence sirop socle
sonnet sorbet studio sultan symbole tablette talent teinte temple terrain
terrasse tesson texte ticket timbre tison tissu titre tonneau torche
totem tribune turban univers vapeur vernis vestige vitrail vitrine volute
voyelle zeste moineau canari perruche chevreau biche cerf hermine agate
ocelot noyau
`.trim().split(/\s+/);

/**
 * Entier uniforme dans [0, max[, tiré avec le générateur cryptographique.
 *
 * `valeur % max` serait biaisé dès que max ne divise pas 2^32 : les premiers mots de la
 * liste sortiraient un peu plus souvent. Le tirage par rejet écarte la zone qui crée ce
 * biais. Math.random() est exclu : il n'est pas conçu pour la sécurité.
 */
function tirageUniforme(max) {
  const plafond = Math.floor(0x100000000 / max) * max;
  const tampon = new Uint32Array(1);
  for (;;) {
    globalThis.crypto.getRandomValues(tampon);
    if (tampon[0] < plafond) return tampon[0] % max;
  }
}

/**
 * Tire une phrase de `nombre` mots, séparés par des espaces.
 * @param {number} [nombre=5]
 * @returns {string}
 */
function genererPhraseExemple(nombre = 5) {
  const mots = [];
  for (let i = 0; i < nombre; i += 1) mots.push(WORDS[tirageUniforme(WORDS.length)]);
  return mots.join(' ');
}

/** Force théorique, en bits, d'une phrase de `nombre` mots tirés dans la liste. */
function forceEnBits(nombre = 5) {
  return nombre * Math.log2(WORDS.length);
}

export { WORDS, genererPhraseExemple, forceEnBits };
export default genererPhraseExemple;

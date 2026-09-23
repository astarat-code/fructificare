# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 astarat-code
"""
check-wordlist-spelling.py — Spelling of the word list used for example passphrases.

WHY: these words are shown to the user as they are, and the user may adopt the phrase.
A misspelled word is visible, and gets mistyped. The automatic rules in
test-passphrase-example.js (lowercase, unaccented, 4 to 8 letters) are not enough:
"medaille" satisfies them, while the word is spelled "médaille".

This check confronts every word with a real French dictionary (Hunspell, the Grammalecte
one shipped with LibreOffice), in two passes:

  1. the word, as written, must exist;
  2. no accented variant may be valid, except an "-é" participle ("porte" / "porté") or a
     case reviewed by hand and listed in RELUS. Otherwise the unaccented form might only
     exist through a rare meaning, the intended word carrying an accent.

Not run in CI: it needs a Hunspell dictionary on the machine. Run it after any change to
the list.

Usage:
  pip install spylls
  python scripts/check-wordlist-spelling.py [path/to/fr]   # without .dic/.aff
"""
import io
import itertools
import os
import re
import sys

from spylls.hunspell import Dictionary

DICO_PAR_DEFAUT = r"C:\Program Files\LibreOffice\share\extensions\dict-fr\fr"
SOURCE = os.path.join(os.path.dirname(__file__), "..", "src", "lib", "passphraseExample.js")

# Mots dont une variante accentuée existe aussi, relus un par un : la forme sans accent
# est bien le mot courant attendu.
RELUS = {
    "matin": "le matin, et non « mâtin » (chien de garde)",
    "jeune": "l'adjectif, et non « jeûne » (privation de nourriture)",
}

ACCENTS = {"a": "aàâ", "e": "eéèêë", "i": "iîï", "o": "oô", "u": "uùûü", "c": "cç"}


def variantes_suspectes(dico, mot):
    choix = [ACCENTS.get(ch, ch) for ch in mot]
    suspectes = []
    for lettres in itertools.product(*choix):
        v = "".join(lettres)
        if v == mot or not dico.lookup(v):
            continue
        participe = v[:-1] == mot[:-1] and v[-1] == "é"
        if not participe:
            suspectes.append(v)
    return suspectes


def main():
    chemin = sys.argv[1] if len(sys.argv) > 1 else DICO_PAR_DEFAUT
    if not os.path.exists(chemin + ".dic"):
        print(f"Dictionnaire introuvable : {chemin}.dic")
        sys.exit(2)
    dico = Dictionary.from_files(chemin)

    texte = io.open(SOURCE, encoding="utf-8").read()
    mots = re.search(r"const WORDS = `([\s\S]*?)`", texte).group(1).split()

    problemes = []
    for mot in mots:
        if not dico.lookup(mot):
            suggestions = ", ".join(itertools.islice(dico.suggest(mot), 3))
            problemes.append(f"« {mot} » absent du dictionnaire (suggestions : {suggestions})")
            continue
        suspectes = variantes_suspectes(dico, mot)
        if suspectes and mot not in RELUS:
            problemes.append(f"« {mot} » : variante accentuée valide {suspectes} — à relire, puis à retirer ou ajouter à RELUS")

    for mot in RELUS:
        if mot not in mots:
            problemes.append(f"« {mot} » figure dans RELUS mais plus dans la liste : retirer l'entrée")

    if problemes:
        print("Orthographe de la liste à revoir :\n")
        for p in problemes:
            print(f"  • {p}")
        print(f"\n{len(problemes)} problème(s) sur {len(mots)} mots.")
        sys.exit(1)

    print(f"{len(mots)} mots vérifiés contre le dictionnaire : orthographe conforme "
          f"({len(RELUS)} cas ambigus relus à la main).")


if __name__ == "__main__":
    main()

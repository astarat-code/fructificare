#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 astarat-code
"""Downloads the project's fonts into public/fonts/ and regenerates fonts.css.

Fructificare works offline: fonts are embedded in the application rather than loaded from
Google Fonts at startup. This script is the only moment the project contacts the network —
run it again only if the font families change.

Usage (from frontend/):  python scripts/fetch-fonts.py
"""
import io
import os
import re
import urllib.request

URL = ("https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;900"
       "&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,400"
       "&family=Space+Mono:wght@400;700&display=swap")
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/120.0.0.0 Safari/537.36")
SUBSETS = ('latin', 'latin-ext')
DEST = os.path.join('public', 'fonts')


def fetch(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA})).read()


def main():
    os.makedirs(DEST, exist_ok=True)
    css = fetch(URL).decode('utf-8')
    out, total = [], 0
    for subset, block in re.findall(r'/\*\s*([\w\-\[\]]+)\s*\*/\s*(@font-face\s*\{.*?\})', css, re.S):
        if subset not in SUBSETS:
            continue
        url = re.search(r'url\((https://[^)]+\.woff2)\)', block).group(1)
        family = re.search(r"font-family:\s*'([^']+)'", block).group(1)
        weight = re.search(r'font-weight:\s*([^;]+);', block).group(1).strip().replace(' ', '-')
        italic = 'italic' in re.search(r'font-style:\s*([^;]+);', block).group(1)
        name = '%s-%s%s-%s.woff2' % (family.replace(' ', ''), weight, '-italic' if italic else '', subset)
        data = fetch(url)
        open(os.path.join(DEST, name), 'wb').write(data)
        total += len(data)
        out.append(block.replace(url, '/fonts/' + name).strip())

    header = ("/* Polices embarquées — aucune requête réseau au lancement (Outfit, DM Sans, Space Mono,\n"
              "   SIL Open Font License 1.1). Sous-ensembles latin et latin-ext uniquement.\n"
              "   Régénérer avec : scripts/fetch-fonts.py */\n\n")
    io.open(os.path.join(DEST, 'fonts.css'), 'w', encoding='utf-8', newline='\n').write(
        header + '\n\n'.join(out) + '\n')
    print('%d fichiers, %.0f Ko' % (len(out), total / 1024))


if __name__ == '__main__':
    main()

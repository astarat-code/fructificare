// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * Structural colors of the exported PDFs (table headers, section titles, separating
 * rules). Colors that carry meaning — green = deposit, red = withdrawal, amber = fees —
 * stay defined where they are used: they do not follow the theme, they inform the reader.
 */

/**
 * Violet foncé du thème sombre : même teinte et même saturation que les panneaux
 * de l'application (--card : hsl(248 45% 11%)), éclairci à 18 % de luminosité.
 * La valeur exacte du thème vire au noir une fois imprimée sur du papier blanc ;
 * à cette luminosité, le violet reste identifiable et le texte blanc lisible.
 */
export const VIOLET = [31, 25, 67];

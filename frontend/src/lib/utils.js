// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Fond d'une enveloppe à partir de sa couleur hex — COULEUR PLEINE, sans
 * transparence (les couleurs pastel doivent apparaître à pleine opacité).
 * Le texte posé dessus doit utiliser une couleur foncée (voir ENV_TEXT_COLOR).
 *
 * @param {string|undefined} color   couleur hex "#rrggbb"
 * @param {boolean} [strong=false]   conservé pour compatibilité (sans effet)
 * @returns {string|undefined}       "#rrggbb" ou undefined si pas de couleur
 */
export function envTintBg(color, strong = false) {
  if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) return undefined;
  return color;
}

// ── Outils colorimétriques (WCAG) ───────────────────────────────────────────
// Partagés par envTextColor et envGainColor : les deux choisissent leur
// couleur en mesurant un vrai rapport de contraste, jamais un seuil arbitraire.

/** Composantes 0-255 d'une couleur hex, ou null si invalide. */
function _rgb(hex) {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/** Luminance relative WCAG d'une couleur hex (0 = noir, 1 = blanc). */
function _luminance(hex) {
  const rgb = _rgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste WCAG entre deux couleurs hex (1 à 21). */
function _contrast(a, b) {
  const la = _luminance(a);
  const lb = _luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** « Colorfulness » d'une couleur : écart max-min des composantes (0-255). */
function _chroma(hex) {
  const rgb = _rgb(hex);
  if (!rgb) return 0;
  return Math.max(...rgb) - Math.min(...rgb);
}

/** Couleur de police foncée par défaut sur un fond de couleur d'enveloppe. */
export const ENV_TEXT_COLOR = "#05040D";

/** Couleur de police claire, sur un fond d'enveloppe sombre. */
const ENV_TEXT_LIGHT = "#F5F4F0";

/**
 * Couleur de police à CONTRASTE AUTOMATIQUE sur un fond de couleur d'enveloppe :
 * texte foncé (#05040D) ou texte clair (#F5F4F0), selon celui des deux qui
 * contraste réellement le mieux avec le fond.
 *
 * Le choix repose sur le rapport de contraste WCAG, et non sur un seuil de
 * luminance perçue : ce dernier se trompait sur les teintes très saturées —
 * un turquoise comme #14B8A6 recevait du texte clair (contraste 2,3) alors que
 * le texte foncé y atteint 8,0.
 *
 * Retourne undefined si la couleur est absente ou invalide.
 *
 * @param {string|undefined} color  couleur hex "#rrggbb"
 * @returns {string|undefined}
 */
export function envTextColor(color) {
  if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) return undefined;
  return _contrast(color, ENV_TEXT_COLOR) >= _contrast(color, ENV_TEXT_LIGHT)
    ? ENV_TEXT_COLOR
    : ENV_TEXT_LIGHT;
}

/**
 * Variante « secondaire » (texte d'appoint) de envTextColor : même logique de
 * contraste automatique, mais légèrement atténuée pour rester hiérarchiquement
 * en retrait du titre. À utiliser À LA PLACE de `text-muted-foreground` sur un
 * fond de couleur d'enveloppe — la classe Tailwind, elle, est figée par le
 * thème et devient illisible sur les fonds clairs comme foncés.
 *
 * @param {string|undefined} color  couleur hex "#rrggbb"
 * @returns {string|undefined}      "rgba(...)" ou undefined si couleur absente
 */
export function envMutedTextColor(color) {
  const base = envTextColor(color);
  if (!base) return undefined;
  // Texte clair sur fond foncé : on garde une opacité élevée (l'œil perd vite
  // le clair atténué) ; texte foncé sur fond clair : on peut atténuer davantage.
  return base === ENV_TEXT_LIGHT ? "rgba(245, 244, 240, 0.85)" : "rgba(5, 4, 13, 0.72)";
}

// ── Couleur sémantique (gain / perte) lisible sur un fond d'enveloppe ────────
// Le vert et le rouge portent du sens : on ne peut pas les remplacer par la
// couleur de contraste sans perdre l'information. On choisit donc, dans une
// gamme de verts (resp. de rouges), la nuance qui contraste le mieux avec le
// fond réellement utilisé — un vert foncé sur fond pastel clair, un vert clair
// sur fond sombre. Si même la meilleure nuance reste illisible (fond vert vif
// pour un gain, par exemple), on bascule sur la couleur de contraste : le signe
// « + » ou « − » continue de porter le sens.

// Gammes ordonnées du plus foncé au plus clair. Les extrêmes (quasi noirs,
// quasi blancs) sont peu saturés : la règle « plus saturé parmi les lisibles »
// ne les retient qu'en dernier recours, juste avant le repli sans couleur.
const GAIN_SHADES = ['#022C22', '#064E3B', '#065F46', '#047857', '#059669', '#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5', '#ECFDF5'];
const LOSS_SHADES = ['#450A0A', '#7F1D1D', '#991B1B', '#B91C1C', '#DC2626', '#EF4444', '#F87171', '#FCA5A5', '#FECACA', '#FEE2E2', '#FEF2F2'];

/** Contraste minimal exigé — seuil WCAG AA « texte large » (3:1). */
const _MIN_CONTRAST = 3.0;

/**
 * Couleur d'un montant de gain ou de perte, posée sur un fond d'enveloppe.
 *
 * On ne retient PAS la nuance la plus contrastée : elle tire vers des pastels
 * délavés où le vert et le rouge deviennent indiscernables. On garde la nuance
 * la plus SATURÉE parmi celles qui restent lisibles — le sens de la couleur
 * prime, tant que le seuil de contraste est tenu.
 *
 * @param {string|undefined} bgColor    couleur de fond "#rrggbb" (couleur de l'enveloppe)
 * @param {boolean} isPositive          true = gain (vert), false = perte (rouge)
 * @returns {string|undefined}  couleur hex, ou undefined si aucun fond n'est appliqué
 *                              (l'appelant garde alors ses classes Tailwind)
 */
export function envGainColor(bgColor, isPositive) {
  if (!bgColor || !/^#[0-9a-fA-F]{6}$/.test(bgColor)) return undefined;

  const shades = isPositive ? GAIN_SHADES : LOSS_SHADES;
  const lisibles = shades.filter(c => _contrast(bgColor, c) >= _MIN_CONTRAST);

  // Aucune nuance lisible (fond vert vif pour un gain, par exemple) : on rend la
  // main à la couleur de contraste. Le signe « + » ou « − » porte alors le sens.
  if (lisibles.length === 0) return envTextColor(bgColor);

  return lisibles.reduce((best, c) => (_chroma(c) > _chroma(best) ? c : best), lisibles[0]);
}

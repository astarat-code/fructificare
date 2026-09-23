// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * FructiLogo — Fructificare's main logo
 *
 * Based on the original logo:
 *   • "ff" monogram (a gold "f" next to an ink-colored "f")
 *   • "fructi" in large, dark Vintage type
 *   • "ficare" in small, gold Vintage type underneath
 *
 * SHARPNESS — why these exact sizes:
 *
 * "ficare" must not go below 16 px. Vintage is a round, thick typeface with almost no
 * vertical stem: unlike an interface font, its edges do not land on pixel columns. On a
 * screen at 100% scaling, below ~16 px a good part of its outlines straddles two pixels
 * and gets painted an in-between color — the eye reads that as blur.
 *
 * History: "ficare" was at 9.9 px (clearly blurry), then 12.5 px (still blurry, no visible
 * difference in use), before being raised to 16 px. The drawing never changed: the three
 * sizes go up together, which keeps both lines aligned. The logo then takes ~53 px of the
 * bar's 64 px — do not make it any bigger.
 *
 * The wrapper also restores sub-pixel antialiasing: the application sets `antialiased` on
 * <body>, which disables ClearType on Windows and thins the text. Acceptable for long
 * paragraphs, costly on a logo.
 *
 * Finally, no `transform: scale()` may be applied to this component: CSS scaling
 * resamples already-rendered text instead of redrawing it. To change the size, use
 * `iconOnly` or edit the sizes below.
 *
 * Props:
 *   iconOnly  {boolean} — renders only the "ff" monogram (mobile header)
 *   className {string}  — extra Tailwind classes on the wrapper
 */
export default function FructiLogo({ iconOnly = false, className = "" }) {
  const GOLD = "#EFAD24";

  return (
    <div
      className={`flex items-center gap-2 select-none ${className}`}
      style={{ WebkitFontSmoothing: "auto", MozOsxFontSmoothing: "auto" }}
      aria-label="Fructificare"
      role="img"
    >
      {/* ── Monogramme "ff" ───────────────────────────────────── */}
      <span
        className="flex items-baseline shrink-0 leading-none"
        style={{
          fontFamily: "'Vintage', 'Outfit', serif",
          fontSize: iconOnly ? "1.65rem" : "3.3rem",
          letterSpacing: "-0.04em",
        }}
        aria-hidden
      >
        {/* f or */}
        <span style={{ color: GOLD }}>f</span>
        {/* f encre — légèrement rapproché */}
        <span
          style={{
            color: "hsl(var(--foreground))",
            marginLeft: "-0.14em",
          }}
        >
          f
        </span>
      </span>

      {/* ── Nom de marque ─────────────────────────────────────── */}
      {!iconOnly && (
        <span
          className="flex flex-col leading-none"
          style={{ fontFamily: "'Vintage', 'Outfit', serif" }}
        >
          {/* fructi */}
          <span
            className="text-foreground"
            style={{
              fontSize: "1.66rem",
              letterSpacing: "0.01em",
            }}
          >
            fructi
          </span>
          {/* ficare */}
          <span
            style={{
              color: GOLD,
              fontSize: "1rem",
              letterSpacing: "0.06em",
              marginTop: "1px",
            }}
          >
            ficare
          </span>
        </span>
      )}
    </div>
  );
}

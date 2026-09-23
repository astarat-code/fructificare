// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * Disclaimer.jsx — legal notice (small grey text) shown at the bottom of the pages.
 *
 * Localized text (FR/EN) through useLanguage. Place it at the very bottom of the content.
 * The "Dietz return" note is no longer shown here: it appears as a tooltip on the titles
 * of the annual return charts (see DIETZ_NOTE).
 */

import { useLanguage } from "../../context/LanguageContext";

const DISCLAIMER = {
  fr: "Fructificare doit être utilisé à titre informatif uniquement et ne donne pas de conseil en investissement. La fiscalité est calculée selon les règles en vigueur en France à la date de janvier 2026 et peut évoluer.",
  en: "Fructificare must be used for informational purposes only and does not provide investment advice. Tax calculations are based on French regulations as of January 2026 and may change.",
};

/** Mention supplémentaire propre aux pages de simulation. */
const SIM_DISCLAIMER = {
  fr: "Les simulations sont fournies à titre informatif. Les performances passées ne préjugent pas des performances futures.",
  en: "Simulations are provided for informational purposes only. Past performance is not indicative of future results.",
};

/** Précision sur le calcul de rendement annuel (Dietz modifiée) — affichée en infobulle. */
export const DIETZ_NOTE = {
  fr: "Rendement annuel calculé selon la méthode de Dietz modifiée : les versements et retraits sont pondérés par leur date au sein de la période. Il peut différer du rendement affiché par votre banque ou votre courtier, qui peut utiliser d'autres modalités de calcul.",
  en: "Annual return computed with the Modified Dietz method: deposits and withdrawals are weighted by their date within the period. It may differ from the return shown by your bank or broker, which may use a different calculation method.",
};

export default function Disclaimer({ className = "", simulation = false }) {
  const { lang } = useLanguage();
  const l = lang === "en" ? "en" : "fr";
  return (
    <div className={`mt-8 pt-4 border-t border-border/50 space-y-1 ${className}`}>
      <p className="text-[11px] leading-snug text-muted-foreground/70 text-center">
        {DISCLAIMER[l]}
      </p>
      {simulation && (
        <p className="text-[11px] leading-snug text-muted-foreground/70 text-center">
          {SIM_DISCLAIMER[l]}
        </p>
      )}
    </div>
  );
}

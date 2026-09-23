// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
import * as React from "react"

import { cn } from "@/lib/utils"
import { useLanguage } from "@/context/LanguageContext"

// Classes communes (sans largeur — la largeur est ajoutée selon le variant).
const BASE_INPUT =
  "h-9 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

/**
 * Normalise une saisie numérique :
 *  - accepte "," ou "." comme séparateur décimal (convertit "," → ".")
 *  - retire les caractères non numériques
 *  - ne conserve qu'un seul point décimal et un "-" en tête
 * Renvoie une chaîne utilisable directement par parseFloat (séparateur ".").
 */
function normalizeDecimalInput(raw) {
  if (typeof raw !== "string") return raw;
  let v = raw.replace(/[^0-9.,-]/g, "").replace(/,/g, ".");
  const firstDot = v.indexOf(".");
  if (firstDot !== -1) {
    v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "");
  }
  if (v.indexOf("-") > 0) v = (v[0] === "-" ? "-" : "") + v.replace(/-/g, "");
  return v;
}

const _todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const Input = React.forwardRef(({ className, type, onChange, inputMode, ...props }, ref) => {
  const isNumeric = type === "number";
  const isDate = type === "date";

  const innerRef = React.useRef(null);
  const en = useLanguage()?.lang === "en";
  const setRefs = (node) => {
    innerRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };

  // ── Champs date : input natif (segments DD/MM/AAAA + reset par segment gérés
  //    nativement par le navigateur) + bouton « Aujourd'hui » accolé ───────────
  if (isDate) {
    const setToday = () => {
      const node = innerRef.current;
      if (!node) return;
      // Met à jour l'input contrôlé via le setter natif puis émet un évènement
      // 'input' → déclenche le onChange React du parent (valeur = aujourd'hui).
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (setter) {
        setter.call(node, _todayISO());
        node.dispatchEvent(new Event("input", { bubbles: true }));
      }
    };
    // Largeur explicite fournie (ex. "w-44") → conteneur en ligne ; sinon pleine largeur.
    const hasExplicitWidth = /(^|\s)w-/.test(className || "");
    return (
      <div className={cn("items-center gap-1", hasExplicitWidth ? "inline-flex max-w-full" : "flex w-full")}>
        <input
          type="date"
          onChange={onChange}
          className={cn(BASE_INPUT, hasExplicitWidth ? "" : "flex-1 min-w-0", className)}
          ref={setRefs}
          {...props} />
        <button
          type="button"
          tabIndex={-1}
          onClick={setToday}
          disabled={props.disabled}
          title={en ? "Set to today" : "Définir à aujourd'hui"}
          className="shrink-0 h-9 rounded-md border border-input px-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {en ? "Today" : "Auj."}
        </button>
      </div>
    );
  }

  // ── Champs numériques : accepter "," ET "." (normalisé en ".") ──────────────
  const handleNumericChange = (isNumeric && onChange)
    ? (e) => {
        const normalized = normalizeDecimalInput(e.target.value);
        if (normalized !== e.target.value) e.target.value = normalized;
        onChange(e);
      }
    : onChange;

  return (
    <input
      type={isNumeric ? "text" : type}
      inputMode={isNumeric ? "decimal" : inputMode}
      onChange={handleNumericChange}
      className={cn("flex w-full", BASE_INPUT, className)}
      ref={setRefs}
      {...props} />
  );
})
Input.displayName = "Input"

export { Input, normalizeDecimalInput }

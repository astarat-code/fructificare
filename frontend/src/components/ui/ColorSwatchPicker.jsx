// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
import { useRef } from "react";
import dataService from "@/services/dataService";
import { useLanguage } from "@/context/LanguageContext";

/**
 * Sélecteur de couleur d'enveloppe :
 *  - rangée de pastilles issues de la palette prédéfinie (choix rapide) ;
 *  - bouton « Personnaliser… » ouvrant le sélecteur de couleur natif du
 *    navigateur (<input type="color">, aucune librairie tierce). La couleur
 *    choisie apparaît comme une pastille supplémentaire en fin de rangée,
 *    marquée ✎, et est enregistrée exactement comme un choix de palette.
 *
 * Props :
 *   value     {string}            — couleur hex sélectionnée
 *   onChange  {(hex) => void}     — appelé à chaque sélection (aperçu immédiat)
 *   className {string}            — classes additionnelles sur le conteneur
 */
export default function ColorSwatchPicker({ value, onChange, className = "" }) {
  const palette = dataService.getEnvelopePalette?.() || dataService.ENVELOPE_PALETTE || [];
  const current = (value || "").toLowerCase();
  // Couleur hors palette → pastille « personnalisée » en fin de rangée
  const isCustom = !!current && !palette.some((c) => c.toLowerCase() === current);
  const colorInputRef = useRef(null);
  const en = useLanguage()?.lang === "en";

  const openNativePicker = () => colorInputRef.current?.click();

  return (
    <div className={`relative ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        {palette.map((c) => {
          const selected = current === c.toLowerCase();
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange?.(c)}
              aria-label={`${en ? "Color" : "Couleur"} ${c}`}
              aria-pressed={selected}
              title={c}
              className={`h-7 w-7 rounded-full transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                selected ? "ring-2 ring-offset-2 ring-foreground scale-110" : "hover:scale-110"
              }`}
              style={{ backgroundColor: c }}
            />
          );
        })}
        {/* Pastille de la couleur personnalisée (hors palette) */}
        {isCustom && (
          <button
            type="button"
            onClick={openNativePicker}
            aria-label={`${en ? "Custom color" : "Couleur personnalisée"} ${value}`}
            aria-pressed="true"
            title={en ? `${value} (custom — click to change)` : `${value} (personnalisée — cliquer pour modifier)`}
            className="relative h-7 w-7 rounded-full ring-2 ring-offset-2 ring-foreground scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ backgroundColor: value }}
          >
            <span
              className="absolute -bottom-1.5 -right-1.5 w-4 h-4 flex items-center justify-center text-[10px] leading-none bg-background border border-border rounded-full"
              aria-hidden="true"
            >
              ✎
            </span>
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={openNativePicker}
        className="mt-2 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
      >
        {en ? "Customize…" : "Personnaliser…"}
      </button>

      {/* Sélecteur natif masqué — déclenché par « Personnaliser… » ou la pastille ✎ */}
      <input
        ref={colorInputRef}
        type="color"
        value={/^#[0-9a-fA-F]{6}$/.test(value || "") ? value : (palette[0] || "#059669")}
        onChange={(e) => onChange?.(e.target.value)}
        className="absolute bottom-0 left-0 h-0 w-0 opacity-0 pointer-events-none"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}

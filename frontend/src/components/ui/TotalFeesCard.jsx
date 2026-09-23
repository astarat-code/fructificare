// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * TotalFeesCard.jsx
 *
 * The "Total fees" card, shared between the Dashboard and the Simulator.
 * Reproduces the dashboard card's style faithfully:
 *   - card background with a discreet border
 *   - grey label, amber/gold amount, Coins icon on the right
 *
 * Props:
 *   totalFees  {number}        — total amount in € (always shown, even at 0)
 *   label      {string}        — displayed label (default: "Total fees")
 *   detail     {string|null}   — optional secondary line (e.g. per-deposit · annual split)
 *   impact     {string|null}   — optional impact line (e.g. "that is €X less in the end")
 *   onExpand   {function|null} — when supplied, the whole tile becomes clickable (→ fee detail)
 *   expandLabel{string}        — accessible label when the tile is clickable
 */

import { Coins, ChevronRight } from "lucide-react";
import { Card, CardContent } from "./card";

const fmt = (v) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v ?? 0);

export default function TotalFeesCard({ totalFees = 0, label = "Total frais", detail = null, impact = null, onExpand = null, expandLabel = "Détail des frais" }) {
  const clickable = typeof onExpand === "function";
  return (
    <Card
      className={`border border-border shadow-sm transition-all duration-300 hover:shadow-md ${clickable ? "cursor-pointer hover:border-amber-400/60 hover:bg-accent/30" : ""}`}
      onClick={clickable ? onExpand : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onExpand(); } } : undefined}
      aria-label={clickable ? expandLabel : undefined}
      data-testid={clickable ? "total-fees-card" : undefined}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between min-w-0">
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="text-xs text-muted-foreground font-medium truncate">{label}</p>
            <p className="text-sm sm:text-base font-heading font-bold mt-0.5 tabular-nums truncate text-amber-600 dark:text-amber-400">
              {fmt(totalFees)}
            </p>
            {detail && (
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate opacity-75">{detail}</p>
            )}
            {impact && (
              <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5 truncate font-medium">{impact}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <Coins className="w-4 h-4 text-amber-600 dark:text-amber-400" strokeWidth={1.5} />
            </div>
            {clickable && (
              <ChevronRight className="w-4 h-4 text-muted-foreground" strokeWidth={2} aria-hidden="true" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

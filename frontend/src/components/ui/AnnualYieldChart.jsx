// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Cell,
} from "recharts";
import { useLanguage } from "../../context/LanguageContext";

/**
 * Infobulle personnalisée — utilise les jetons de thème (bg-card / text-foreground)
 * pour rester lisible en mode clair ET sombre (le tooltip Recharts par défaut
 * affiche un texte sombre illisible sur fond sombre).
 */
const _fmtEur = (x) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(x || 0);

function YieldTooltip({ active, payload, label, isEn }) {
  if (!active || !payload || !payload.length) return null;
  const L = (fr, en) => (isEn ? en : fr);
  const v = payload[0].value;
  const row = payload[0].payload || {};
  const isYtd = row.ytd === true;
  const gain = row.gainEur;
  return (
    <div className="rounded-md border border-border bg-card text-foreground px-3 py-2 shadow-md text-sm">
      <p className="font-medium">{label}{isYtd ? " · YTD" : ""}</p>
      <p className={`tabular-nums font-semibold ${v >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
        {L('Rendement', 'Return')}{isYtd ? L(" (cumulé YTD)", " (YTD)") : ""} : {v >= 0 ? "+" : ""}{v} %
      </p>
      {gain != null && (
        <p className={`tabular-nums text-xs ${gain >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
          {L('Gain :', 'Gain:')} {gain >= 0 ? "+" : ""}{_fmtEur(gain)}
        </p>
      )}
      <p className="text-[10px] text-muted-foreground mt-0.5">{L('Dietz modifiée', 'Modified Dietz')}</p>
    </div>
  );
}

/**
 * Histogramme du rendement annuel (% par année civile).
 * Barres vertes si rendement ≥ 0, rouges si < 0. Ligne zéro visible.
 *
 * Props :
 *   data    {Array<{ year:number, yieldPct:number }>}
 *   height  {number}  hauteur en px (défaut 240)
 */
export default function AnnualYieldChart({ data = [], height = 240 }) {
  const { lang } = useLanguage();
  const isEn = lang === "en";
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-muted-foreground text-center px-4" style={{ height }}>
        {isEn ? "Not enough calibrations to compute an annual return." : "Pas assez de calibrations pour calculer un rendement annuel."}
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 10, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v}%`} />
        {/* Ligne zéro toujours visible (axe des rendements négatifs/positifs) */}
        <ReferenceLine y={0} stroke="hsl(var(--foreground))" strokeWidth={1.5} />
        <Tooltip
          content={<YieldTooltip isEn={isEn} />}
          cursor={{ fill: "hsl(var(--foreground))", fillOpacity: 0.06 }}
        />
        <Bar dataKey="yieldPct" radius={[3, 3, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.yieldPct >= 0 ? "#10b981" : "#ef4444"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

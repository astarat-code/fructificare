// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * EnvelopeEvolutionChart.jsx — the shared "Envelope evolution" chart.
 *
 * Used by the dashboard (CALIBRATED values) and by the simulator (PROJECTED values).
 * Same visual rendering in both contexts:
 *   - Summary view:  total value (black) + net deposits (amber) + gain/loss band.
 *   - Detailed view: one series per envelope (the envelope's color) + gain/loss band.
 *
 * The component knows nothing about calibrations or projections: it receives data that is
 * already shaped, and only draws it.
 *
 * Props:
 *   historyData   {{ data: Array, series: Array<{id,name}>, hasCalibration: boolean }}
 *                 Each row of `data`: { month, `${id}_dep`, `${id}_cal`, total_dep, total_cal }.
 *   getColor      {(id, i) => string}        an envelope's color (falls back to the palette).
 *   calMonthsBySeries {{ [id]: Set<string> }} real months (dots on the curve) — {} = no dot.
 *   detailView    {boolean}                  false = summary, true = detailed.
 *   onToggleView  {() => void}
 *   title         {string}
 *   height        {number}                   default 350
 *   valueLegendLabel    {string}             default "Calibrated value"
 *   depositsLegendLabel {string}             default "Net deposits"
 *   emptyHint     {string|null}              message shown when !hasCalibration in summary view
 *   headerExtra   {ReactNode}                extra controls in the header (e.g. projection slider)
 */

import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Button } from "./button";
import { useLanguage } from "../../context/LanguageContext";

const COLORS = ["#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];

const _fmtEur = (x) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(x || 0);

/**
 * Infobulle personnalisée : un bloc par enveloppe (valeur + versements) puis un total.
 * N'expose aucun UUID ni libellé technique interne.
 */
function ComposedChartTooltip({ active, payload, label, series = [], hasCalibration = false, getColor, isEn = false, valueLabel, depositsLabel }) {
  if (!active || !payload?.length) return null;
  const L = (fr, en) => (isEn ? en : fr);

  const byKey = {};
  payload.forEach(p => { if (p.dataKey != null) byKey[p.dataKey] = p.value; });

  // Détail par enveloppe (présent uniquement en vue détaillée).
  const envelopes = series
    .map((s, i) => {
      const dep = byKey[`${s.id}_dep`]     ?? null;
      const cal = byKey[`${s.id}_cal_abs`] ?? null;
      if (dep == null && cal == null) return null;
      return {
        id:       s.id,
        name:     s.name,
        value:    cal ?? dep,
        deposits: dep,
        hasCalib: cal != null,
        color:    getColor ? getColor(s.id, i) : COLORS[i % COLORS.length],
      };
    })
    .filter(Boolean);

  // Totaux (présents en vue synthétique).
  const totalVal = byKey['total_cal_abs'] ?? null;
  const totalDep = byKey['total_dep']     ?? null;

  // Rien à afficher (ni détail, ni total) → pas d'infobulle.
  if (!envelopes.length && totalVal == null && totalDep == null) return null;

  const dateLabel = label && label.length >= 7
    ? `${label.substring(5, 7)}/${label.substring(0, 4)}`
    : (label ?? '');

  // Bloc synthèse (Valeur + Versements) : en vue synthétique (aucun détail) ou multi-enveloppes.
  const showSummary = (totalVal != null || totalDep != null) && envelopes.length !== 1;
  const _vLabel = valueLabel    || L('Valeur', 'Value');
  const _dLabel = depositsLabel || L('Versements', 'Deposits');
  const rowStyle = { display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' };
  const dot = (color) => (<span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block', flexShrink: 0 }} />);

  return (
    <div style={{
      background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))',
      borderRadius: 8, padding: '8px 12px', fontSize: 12,
      boxShadow: '0 4px 16px rgba(0,0,0,0.25)', minWidth: 200, opacity: 1,
    }}>
      <p style={{ fontWeight: 700, marginBottom: 8, color: 'hsl(var(--foreground))' }}>{dateLabel}</p>

      {envelopes.map(e => (
        <div key={e.id} style={{ marginBottom: envelopes.length > 1 ? 8 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            {dot(e.color)}
            <span style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>{e.name}</span>
          </div>
          {e.value != null && (
            <div style={{ ...rowStyle, paddingLeft: 16, marginBottom: 2 }}>
              <span style={{ color: 'hsl(var(--muted-foreground))' }}>{e.hasCalib ? L('Valeur', 'Value') : L('Versements', 'Deposits')}</span>
              <span style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>{_fmtEur(e.value)}</span>
            </div>
          )}
          {e.hasCalib && e.deposits != null && (
            <div style={{ ...rowStyle, paddingLeft: 16 }}>
              <span style={{ color: 'hsl(var(--muted-foreground))' }}>{L('Versements', 'Deposits')}</span>
              <span style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>{_fmtEur(e.deposits)}</span>
            </div>
          )}
        </div>
      ))}

      {showSummary && (
        <div style={{
          marginTop: envelopes.length ? 6 : 0,
          paddingTop: envelopes.length ? 6 : 0,
          borderTop:  envelopes.length ? '1px solid hsl(var(--border))' : 'none',
        }}>
          {hasCalibration && totalVal != null && (
            <div style={{ ...rowStyle, fontWeight: 700, marginBottom: 2 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'hsl(var(--muted-foreground))' }}>
                {dot('hsl(var(--foreground))')}{envelopes.length ? L('Total valeur', 'Total value') : _vLabel}
              </span>
              <span style={{ color: 'hsl(var(--foreground))' }}>{_fmtEur(totalVal)}</span>
            </div>
          )}
          {totalDep != null && (
            <div style={{ ...rowStyle, fontWeight: 700 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'hsl(var(--muted-foreground))' }}>
                {dot('#f59e0b')}{envelopes.length ? L('Total versements', 'Total deposits') : _dLabel}
              </span>
              <span style={{ color: 'hsl(var(--foreground))' }}>{_fmtEur(totalDep)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Dérive les zones gain/perte (remplissage bidirectionnel entre versements et valeur).
 * Identique au tableau de bord : base = min(val, dep), perte = rouge, gain = couleur.
 */
function buildGapData(historyData, calMonthsBySeries = {}) {
  const series = historyData.series || [];
  return (historyData.data || []).map(row => {
    const nr = { ...row };
    series.forEach(s => {
      const dep = row[`${s.id}_dep`] ?? 0;
      const cal = row[`${s.id}_cal`];
      nr[`${s.id}_is_cal`] = !!calMonthsBySeries[s.id]?.has(row.month);
      if (cal != null) {
        nr[`${s.id}_cal_abs`]  = cal;
        nr[`${s.id}_cal_base`] = Math.min(cal, dep);
        nr[`${s.id}_loss_gap`] = cal < dep ? dep - cal : 0;
        nr[`${s.id}_gain_gap`] = cal > dep ? cal - dep : 0;
      } else {
        nr[`${s.id}_cal_abs`]  = null;
        nr[`${s.id}_cal_base`] = null;
        nr[`${s.id}_loss_gap`] = null;
        nr[`${s.id}_gain_gap`] = null;
      }
    });
    const td = row.total_dep ?? 0;
    const tc = row.total_cal;
    if (tc != null) {
      nr.total_cal_abs  = tc;
      nr.total_cal_base = Math.min(tc, td);
      nr.total_loss_gap = tc < td ? td - tc : 0;
      nr.total_gain_gap = tc > td ? tc - td : 0;
    } else {
      nr.total_cal_abs  = null;
      nr.total_cal_base = null;
      nr.total_loss_gap = null;
      nr.total_gain_gap = null;
    }
    return nr;
  });
}

export default function EnvelopeEvolutionChart({
  historyData = { data: [], series: [], hasCalibration: false },
  getColor = (id, i) => COLORS[i % COLORS.length],
  calMonthsBySeries = {},
  detailView = false,
  onToggleView,
  title,
  height = 350,
  valueLegendLabel,
  depositsLegendLabel,
  emptyHint = null,
  headerExtra = null,
}) {
  const { lang } = useLanguage();
  const L = (fr, en) => (lang === 'en' ? en : fr);
  const _title = title ?? L("Évolution des enveloppes", "Envelope evolution");
  const _valueLegendLabel = valueLegendLabel ?? L("Valeur calibrée", "Calibrated value");
  const _depositsLegendLabel = depositsLegendLabel ?? L("Versements nets", "Net deposits");
  const series = historyData.series || [];
  const hasCalibration = !!historyData.hasCalibration;
  const gapChartData = buildGapData(historyData, calMonthsBySeries);

  const renderLegend = () => {
    if (series.length < 2) return null;
    return (
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', paddingTop: 8, justifyContent: 'center' }}>
        {series.map((serie, i) => (
          <div key={serie.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: getColor(serie.id, i), display: 'inline-block', flexShrink: 0 }} />
            <span style={{ color: 'hsl(var(--foreground))' }}>{serie.name}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="border border-border shadow-sm" data-testid="all-portfolios-chart">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="font-heading text-lg">{_title}</CardTitle>
          <div className="flex items-center gap-3 flex-wrap">
            {headerExtra}
            {!detailView ? (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {hasCalibration && (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: 'hsl(var(--foreground))' }} />
                    {_valueLegendLabel}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#f59e0b' }} />
                  {_depositsLegendLabel}
                </span>
              </div>
            ) : (
              <span className="text-[11px] text-muted-foreground italic">{L('Zone = delta versements / valeur', 'Band = deposits / value gap')}</span>
            )}
            {onToggleView && (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onToggleView} data-testid="chart-view-toggle">
                {detailView ? L('Vue synthétique', 'Summary view') : L('Vue détaillée', 'Detailed view')}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={gapChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<ComposedChartTooltip series={series} hasCalibration={hasCalibration} getColor={getColor} isEn={lang === 'en'} valueLabel={_valueLegendLabel} depositsLabel={_depositsLegendLabel} />} />
            {detailView && <Legend content={renderLegend} />}

            {/* ── Vue détaillée : un nuage par enveloppe ── */}
            {detailView && series.flatMap((s, i) => {
              const color = getColor(s.id, i);
              if (!hasCalibration) {
                return [
                  <Area key={`${s.id}_dep`} type="monotone" dataKey={`${s.id}_dep`}
                    stroke={color} strokeWidth={1.5} fill="none" dot={false}
                    name={`${s.name} — ${L('versements', 'deposits')}`} />,
                ];
              }
              return [
                <Area key={`${s.id}_cal_base`} stackId={`loss_${s.id}`} type="linear"
                  dataKey={`${s.id}_cal_base`} fill="none" stroke="none" dot={false}
                  legendType="none" name="" connectNulls={false} />,
                <Area key={`${s.id}_loss_gap`} stackId={`loss_${s.id}`} type="linear"
                  dataKey={`${s.id}_loss_gap`} fill="#ef4444" fillOpacity={0.15} stroke="none"
                  dot={false} legendType="none" name="" connectNulls={false} />,
                <Area key={`${s.id}_dep`} stackId={`gain_${s.id}`} type="monotone"
                  dataKey={`${s.id}_dep`} stroke={color} strokeWidth={1.5} fill="none"
                  dot={false} name={`${s.name} — ${L('versements', 'deposits')}`} />,
                <Area key={`${s.id}_gain_gap`} stackId={`gain_${s.id}`} type="linear"
                  dataKey={`${s.id}_gain_gap`} fill={color} fillOpacity={0.20} stroke="none"
                  dot={false} legendType="none" name="" connectNulls={false} />,
                <Line key={`${s.id}_cal_abs`} type="linear" dataKey={`${s.id}_cal_abs`}
                  stroke={color} strokeWidth={1.5} connectNulls={false}
                  name={`${s.name} — ${L('valeur', 'value')}`}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    if (!payload || !payload[`${s.id}_is_cal`] || payload[`${s.id}_cal_abs`] == null) return null;
                    return <circle key={`d-${s.id}-${payload.month}`} cx={cx} cy={cy} r={3} fill={color} stroke="white" strokeWidth={1.5} />;
                  }} />,
              ];
            })}

            {/* ── Vue synthétique : valeur totale (noir) + versements (ambre) + bande ── */}
            {!detailView && (hasCalibration ? [
              <Area key="total_cal_base" stackId="loss_total" type="linear"
                dataKey="total_cal_base" fill="none" stroke="none" dot={false}
                legendType="none" name="" connectNulls={false} />,
              <Area key="total_loss_gap" stackId="loss_total" type="linear"
                dataKey="total_loss_gap" fill="#ef4444" fillOpacity={0.15} stroke="none"
                dot={false} legendType="none" name="" connectNulls={false} />,
              <Area key="total_dep" stackId="gain_total" type="monotone"
                dataKey="total_dep" stroke="#f59e0b" strokeWidth={2} fill="none"
                dot={false} name={_depositsLegendLabel} />,
              <Area key="total_gain_gap" stackId="gain_total" type="linear"
                dataKey="total_gain_gap" fill="#6b7280" fillOpacity={0.15} stroke="none"
                dot={false} legendType="none" name="" connectNulls={false} />,
              <Line key="total_cal_abs" type="linear" dataKey="total_cal_abs"
                stroke="hsl(var(--foreground))" strokeWidth={2.5} dot={false}
                name={_valueLegendLabel} connectNulls={false} />,
            ] : [
              <Area key="total_dep" type="monotone" dataKey="total_dep"
                stroke="#f59e0b" strokeWidth={2} fill="none" dot={false}
                name={_depositsLegendLabel} />,
            ])}
          </ComposedChart>
        </ResponsiveContainer>
        {!detailView && !hasCalibration && emptyHint && (
          <p className="text-xs text-muted-foreground text-center mt-2">{emptyHint}</p>
        )}
      </CardContent>
    </Card>
  );
}

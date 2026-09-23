// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * HealthScoreDisplay.jsx
 *
 * Shows the financial health score as a 270° SVG gauge, a table detailing the components
 * and a Recharts history.
 *
 * Props:
 *   score       {number|null}   — current score (0-100), null = not computed
 *   breakdown   {object|null}   — per-component detail
 *   history     {Array}         — [{ date: "YYYY-MM-DD", score: number }]
 *   inputs      {object|null}   — raw inputs of the computation (for the help panel)
 *   onRefresh   {() => void}    — recomputes the score on demand
 *   loading     {boolean}       — shows a spinner while computing
 *   lang        {'fr'|'en'}     — interface language
 */

import { useState } from "react";
import { createPortal } from "react-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { RefreshCw, TrendingUp, Info } from "lucide-react";
import HealthScoreHelpModal from "./HealthScoreHelpModal";

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════════

const CX = 60;
const CY = 60;
const RADIUS = 48;
const STROKE_WIDTH = 10;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ≈ 301.59
const ARC_LENGTH    = CIRCUMFERENCE * (270 / 360); // 270° arc ≈ 226.19

/** Couleur selon le score. */
function scoreColor(score) {
  if (score === null || score === undefined) return '#9CA3AF';
  if (score >= 95) return '#F59E0B'; // or
  if (score >= 85) return '#10B981'; // vert vif
  if (score >= 75) return '#22C55E'; // vert
  if (score >= 60) return '#84CC16'; // jaune-vert
  if (score >= 41) return '#F97316'; // orange
  return '#EF4444';                  // rouge
}

/** Libellé qualitatif selon le score. */
function scoreLabel(score, lang = 'fr') {
  const en = lang === 'en';
  if (score === null || score === undefined) return en ? 'Not calculated' : 'Non calculé';
  if (score >= 95) return en ? 'Excellent'  : 'Excellent';
  if (score >= 85) return en ? 'Very good'  : 'Très bon';
  if (score >= 75) return en ? 'Good'       : 'Bon';
  if (score >= 60) return en ? 'Fair'       : 'Passable';
  if (score >= 41) return en ? 'Fragile'    : 'Fragile';
  return en ? 'Critical' : 'Critique';
}

/**
 * Config des composantes : clé, libellé, max, couleur d'accent, conseil rapide.
 * `hint` peut être une string statique ou une fonction (breakdown, inputs) => string.
 */
const COMPONENTS = [
  {
    key:   'sDiv',
    label: { fr: 'Diversification', en: 'Diversification' },
    max:   20,
    hint:  {
      fr: "Répartissez vos investissements sur plusieurs classes d'actifs (actions, obligations, immobilier, or) pour réduire la concentration.",
      en: 'Spread your investments across several asset classes (stocks, bonds, real estate, gold) to reduce concentration.',
    },
    color: '#8B5CF6',
  },
  {
    key:   'sPerf',
    label: { fr: 'Performance', en: 'Performance' },
    max:   25,
    hint:  {
      fr: "Le rendement est comparé à une cible ajustée au risque de votre portefeuille (et à votre âge). Pensez aux ETF indiciels à faibles frais.",
      en: 'Return is compared to a target adjusted to your portfolio risk (and your age). Consider low-fee index ETFs.',
    },
    color: '#10B981',
  },
  {
    key:   'sFrais',
    label: { fr: 'Maîtrise des frais', en: 'Fee Control' },
    max:   20,
    hint:  {
      fr: 'TER annuel < 0,3 % (ETF passif) et frais cumulés faibles maximisent ce score.',
      en: 'Annual TER < 0.3% (passive ETF) and low cumulative fees maximise this score.',
    },
    color: '#F59E0B',
  },
  {
    key:   'sResInf',
    label: { fr: 'Résilience & Inflation', en: 'Resilience & Inflation' },
    max:   25,
    hint:  (bd, inp, lang) => {
      const wR = Math.min(1, Math.max(0, (inp?.age || 0) / 100));
      const age = Math.floor(inp?.age || 0);
      if (lang === 'en') {
        return wR >= 0.5
          ? `Resilience priority (${age} yrs) — reduce volatile assets as retirement nears.`
          : `Inflation priority (${age} yrs) — favour equities and gold to protect your capital.`;
      }
      return wR >= 0.5
        ? `Priorité résilience (${age} ans) — réduisez les actifs volatils à l'approche de la retraite.`
        : `Priorité inflation (${age} ans) — privilégiez actions et or pour protéger votre capital.`;
    },
    color: '#3B82F6',
  },
  {
    key:   'sLiq',
    label: { fr: 'Liquidité', en: 'Liquidity' },
    max:   10,
    hint:  {
      fr: 'Maintenez au moins 3 mois de revenu en épargne réglementée (Livret A, LDDS, LEP).',
      en: 'Keep at least 3 months of income in regulated savings (Livret A, LDDS, LEP).',
    },
    color: '#06B6D4',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 2. COMPOSANT JAUGE SVG
// ═══════════════════════════════════════════════════════════════════════════════

function ScoreGauge({ score, loading, lang = 'fr' }) {
  const color = scoreColor(score);
  const progressLen = score !== null ? (score / 100) * ARC_LENGTH : 0;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
      <svg viewBox="0 0 120 120" width={140} height={140}>
        {/* Piste de fond (gris, arc complet 270°) */}
        <circle
          cx={CX}
          cy={CY}
          r={RADIUS}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={STROKE_WIDTH}
          strokeDasharray={`${ARC_LENGTH} ${CIRCUMFERENCE - ARC_LENGTH}`}
          strokeLinecap="round"
          transform={`rotate(-135, ${CX}, ${CY})`}
        />
        {/* Arc de progression coloré */}
        {score !== null && !loading && (
          <circle
            cx={CX}
            cy={CY}
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth={STROKE_WIDTH}
            strokeDasharray={`${progressLen} ${CIRCUMFERENCE}`}
            strokeLinecap="round"
            transform={`rotate(-135, ${CX}, ${CY})`}
            style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.4s ease' }}
          />
        )}
        {/* Score central */}
        {loading ? (
          <text x={CX} y={CY + 6} textAnchor="middle" fontSize="11" fill="hsl(var(--muted-foreground))">
            {lang === 'en' ? 'Loading…' : 'Calcul...'}
          </text>
        ) : score !== null ? (
          <>
            <text
              x={CX}
              y={CY + 7}
              textAnchor="middle"
              fontSize="22"
              fontWeight="bold"
              fill={color}
              fontFamily="inherit"
            >
              {score}
            </text>
            <text
              x={CX}
              y={CY + 18}
              textAnchor="middle"
              fontSize="8"
              fill="hsl(var(--muted-foreground))"
              fontFamily="inherit"
            >
              /100
            </text>
          </>
        ) : (
          <text x={CX} y={CY + 6} textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))">
            {lang === 'en' ? 'Not calculated' : 'Non calculé'}
          </text>
        )}
      </svg>
      {/* Libellé qualitatif sous la jauge */}
      <div
        className="absolute bottom-0 left-0 right-0 text-center text-xs font-medium"
        style={{ color }}
      >
        {loading ? '' : scoreLabel(score, lang)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. BARRE DE COMPOSANTE
// ═══════════════════════════════════════════════════════════════════════════════

function ComponentBar({ component, value, onClick, lang = 'fr' }) {
  const pct   = value !== undefined ? Math.min(100, (value / component.max) * 100) : 0;
  const label = value !== undefined ? `${value.toFixed(1)} / ${component.max}` : '—';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left space-y-0.5 group rounded-md px-1 py-0.5 hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
      title={lang === 'en' ? 'Click for detailed help' : "Cliquer pour l'aide détaillée"}
    >
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground group-hover:text-foreground transition-colors flex items-center gap-1">
          {component.label[lang] ?? component.label.fr}
          <Info className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
        </span>
        <span className="font-mono font-medium" style={{ color: component.color }}>{label}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: component.color }}
        />
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. TOOLTIP PERSONNALISÉ POUR L'HISTORIQUE
// ═══════════════════════════════════════════════════════════════════════════════

function HistoryTooltip({ active, payload, label, chartData, lang }) {
  if (!active || !payload?.length) return null;
  const score = payload[0]?.value;

  // Calculer le delta par rapport au point précédent
  let delta = null;
  if (chartData && label) {
    const idx = chartData.findIndex(d => d.date === label);
    if (idx > 0) {
      delta = score - chartData[idx - 1].score;
    }
  }

  return (
    <div className="bg-popover border border-border rounded-lg p-2 shadow-md text-xs space-y-1">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-bold" style={{ color: scoreColor(score) }}>
        {lang === 'en' ? 'Score' : 'Score'} : {score} — {scoreLabel(score, lang)}
      </p>
      {delta !== null && (
        <p className={`font-semibold ${delta >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
          {delta >= 0 ? '+' : ''}{delta.toFixed(1)} pts
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. LÉGENDE DES COULEURS
// ═══════════════════════════════════════════════════════════════════════════════

function ColorLegend({ lang }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 text-center text-xs text-muted-foreground">
      {[
        { range: '0-40',   color: '#EF4444', label: lang === 'en' ? 'Critical' : 'Critique' },
        { range: '41-59',  color: '#F97316', label: lang === 'en' ? 'Fragile'  : 'Fragile'  },
        { range: '60-74',  color: '#84CC16', label: lang === 'en' ? 'Fair'     : 'Passable' },
        { range: '75-84',  color: '#22C55E', label: lang === 'en' ? 'Good'     : 'Bon'      },
        { range: '85-94',  color: '#10B981', label: lang === 'en' ? 'Very good': 'Très bon' },
        { range: '95-100', color: '#F59E0B', label: lang === 'en' ? 'Excellent': 'Excellent'},
      ].map(({ range, color, label }) => (
        <div key={range} className="flex flex-col items-center gap-0.5">
          <div className="w-4 h-1.5 rounded-full" style={{ backgroundColor: color }} />
          <span>{label}</span>
          <span className="text-xs opacity-60">{range}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export default function HealthScoreDisplay({
  score,
  breakdown,
  history = [],
  inputs  = null,
  onRefresh,
  loading = false,
  lang    = 'fr',
}) {
  const [historyRange,      setHistoryRange]      = useState('6m'); // '6m' | '12m'
  const [hoveredComponent,  setHoveredComponent]  = useState(null);
  const [hintRect,          setHintRect]          = useState(null);
  const [helpComponent,     setHelpComponent]     = useState(null);
  const [hoveredGauge,      setHoveredGauge]      = useState(false);
  const [gaugeRect,         setGaugeRect]         = useState(null);

  // ── filtrer l'historique selon la plage ──────────────────────────────────
  const now       = new Date();
  const months    = historyRange === '12m' ? 12 : 6;
  const cutoff    = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  const chartData = history
    .filter(h => new Date(h.date) >= cutoff)
    .map(h => ({
      date:  h.date.substring(0, 7), // YYYY-MM
      score: h.score,
    }))
    // Dédoublonner par mois (garder le dernier relevé du mois)
    .reduce((acc, cur) => {
      const existing = acc.findIndex(a => a.date === cur.date);
      if (existing >= 0) acc[existing] = cur;
      else acc.push(cur);
      return acc;
    }, [])
    .sort((a, b) => a.date.localeCompare(b.date));

  // ── composante actuellement mise en avant ─────────────────────────────────
  const hovered = COMPONENTS.find(c => c.key === hoveredComponent);

  return (
    <div className="space-y-5">
      <Tabs defaultValue="detail">
        <TabsList className="w-full mb-4">
          <TabsTrigger value="detail" className="flex-1">
            {lang === 'en' ? 'Detail' : 'Détail'}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1">
            {lang === 'en' ? 'History' : 'Historique'}
          </TabsTrigger>
        </TabsList>

        {/* ── Onglet Détail ─────────────────────────────────────────────── */}
        <TabsContent value="detail" className="space-y-5 mt-0">
          {/* Jauge + composantes */}
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div
              onMouseEnter={(e) => {
                setHoveredGauge(true);
                setGaugeRect(e.currentTarget.getBoundingClientRect());
              }}
              onMouseLeave={() => {
                setHoveredGauge(false);
                setGaugeRect(null);
              }}
            >
              <ScoreGauge score={score} loading={loading} lang={lang} />
            </div>

            <div className="flex-1 space-y-1 w-full">
              {COMPONENTS.map(c => (
                <div
                  key={c.key}
                  onMouseEnter={(e) => {
                    setHoveredComponent(c.key);
                    setHintRect(e.currentTarget.getBoundingClientRect());
                  }}
                  onMouseLeave={() => {
                    setHoveredComponent(null);
                    setHintRect(null);
                  }}
                >
                  <ComponentBar
                    component={c}
                    value={breakdown?.[c.key]}
                    onClick={() => setHelpComponent(c.key)}
                    lang={lang}
                  />
                </div>
              ))}
              {/* Bonus (jeune & performant OU sénior & résilient) */}
              {breakdown?.bonusYoung > 0 && (
                <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
                  <span>+{breakdown.bonusYoung} pts — {lang === 'en'
                    ? 'Young investor bonus (< 35 yrs, return > 8 %)'
                    : 'Bonus investisseur jeune (< 35 ans, rendement > 8 %)'}</span>
                </div>
              )}
              {breakdown?.bonusSenior > 0 && (
                <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
                  <span>+{breakdown.bonusSenior} pts — {lang === 'en'
                    ? 'Resilient senior bonus (> 65 yrs, low crash exposure)'
                    : 'Bonus sénior résilient (> 65 ans, faible exposition aux krachs)'}</span>
                </div>
              )}
              {/* Repli : ancien score sans détail du bonus (rétro-compat) */}
              {breakdown?.bonus > 0 && breakdown?.bonusYoung == null && breakdown?.bonusSenior == null && (
                <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
                  <span>+{breakdown.bonus} pts — {lang === 'en' ? 'Bonus' : 'Bonus'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Bouton recalculer */}
          {onRefresh && (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={onRefresh}
                disabled={loading}
                className="flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                {lang === 'en' ? 'Recalculate' : 'Recalculer'}
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ── Onglet Historique ──────────────────────────────────────────── */}
        <TabsContent value="history" className="space-y-4 mt-0">
          {history.length < 2 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
              <TrendingUp className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {lang === 'en'
                  ? 'Not enough data yet. Recalculate your score regularly to build history.'
                  : 'Pas encore assez de données. Recalculez votre score régulièrement pour construire un historique.'}
              </p>
            </div>
          ) : (
            <>
              {/* Sélecteur de période */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  {lang === 'en' ? 'Score evolution' : 'Évolution du score'}
                </div>
                <div className="flex rounded-md border overflow-hidden text-xs">
                  {['6m', '12m'].map(r => (
                    <button
                      key={r}
                      className={`px-3 py-1 transition-colors ${
                        historyRange === r
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent'
                      }`}
                      onClick={() => setHistoryRange(r)}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {chartData.length < 2 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {lang === 'en'
                    ? 'Not enough data for this period.'
                    : 'Pas assez de données sur cette période.'}
                </p>
              ) : (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        tickLine={false}
                        axisLine={false}
                        width={26}
                      />
                      <Tooltip
                        content={<HistoryTooltip chartData={chartData} lang={lang} />}
                      />

                      {/* Lignes de référence */}
                      <ReferenceLine
                        y={95}
                        stroke="#F59E0B"
                        strokeDasharray="4 4"
                        strokeOpacity={0.7}
                        label={{ value: '95', position: 'right', fontSize: 9, fill: '#F59E0B' }}
                      />
                      <ReferenceLine
                        y={85}
                        stroke="#10B981"
                        strokeDasharray="4 4"
                        strokeOpacity={0.7}
                        label={{ value: '85', position: 'right', fontSize: 9, fill: '#10B981' }}
                      />
                      <ReferenceLine
                        y={75}
                        stroke="#22C55E"
                        strokeDasharray="4 4"
                        strokeOpacity={0.7}
                        label={{ value: '75', position: 'right', fontSize: 9, fill: '#22C55E' }}
                      />
                      <ReferenceLine
                        y={60}
                        stroke="#F97316"
                        strokeDasharray="4 4"
                        strokeOpacity={0.7}
                        label={{ value: '60', position: 'right', fontSize: 9, fill: '#F97316' }}
                      />

                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke={scoreColor(score)}
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: scoreColor(score) }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Légende couleurs */}
              <ColorLegend lang={lang} />
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Bulle de conseil ─ portalisée sur <body> pour échapper au transform
          du Dialog (sinon `position: fixed` se cale sur la modale → débordement +
          scrollbar → repositionnement en boucle = « tremblement »). ────────────── */}
      {hovered && hintRect && (() => {
        const TOOLTIP_W  = 300;
        const TOOLTIP_H  = 72;
        const spaceAbove = hintRect.top - 8;
        const showAbove  = spaceAbove >= TOOLTIP_H;
        let   top  = showAbove ? hintRect.top - TOOLTIP_H - 6 : hintRect.bottom + 6;
        let   left = hintRect.left;
        if (left + TOOLTIP_W > window.innerWidth - 8) left = window.innerWidth - TOOLTIP_W - 8;
        if (left < 8) left = 8;
        if (top + TOOLTIP_H > window.innerHeight - 8) top = window.innerHeight - TOOLTIP_H - 8;
        if (top < 8) top = 8;
        const hintText = typeof hovered.hint === 'function'
          ? hovered.hint(breakdown, inputs, lang)
          : (hovered.hint[lang] ?? hovered.hint.fr);
        const hoveredLabel = hovered.label[lang] ?? hovered.label.fr;
        return createPortal(
          <div
            className="fixed z-[100] pointer-events-none flex items-start gap-2 p-3 rounded-lg border text-sm shadow-lg"
            style={{
              top,
              left,
              width: TOOLTIP_W,
              borderColor: hovered.color + '40',
              background:  'hsl(var(--popover))',
              color:        'hsl(var(--popover-foreground))',
            }}
          >
            <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: hovered.color }} />
            <div>
              <span className="font-medium" style={{ color: hovered.color }}>
                {hoveredLabel}
              </span>
              <span className="text-muted-foreground"> — {hintText}</span>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* ── Tooltip de détail (hover sur la jauge) ──────────────────────── */}
      {hoveredGauge && gaugeRect && score !== null && breakdown && (() => {
        const TOOLTIP_COMPS = [
          { key: 'sDiv',    label: lang === 'en' ? 'Diversification'       : 'Diversification',        max: 20, color: '#8B5CF6' },
          { key: 'sPerf',   label: lang === 'en' ? 'Performance'           : 'Performance',             max: 25, color: '#10B981' },
          { key: 'sFrais',  label: lang === 'en' ? 'Fee Control'           : 'Maîtrise des frais',      max: 20, color: '#F59E0B' },
          { key: 'sResInf', label: lang === 'en' ? 'Resilience & Inflation': 'Résilience & Inflation',  max: 25, color: '#3B82F6' },
          { key: 'sLiq',    label: lang === 'en' ? 'Liquidity'             : 'Liquidité',               max: 10, color: '#06B6D4' },
        ];
        const TOOLTIP_W = 340;
        let left = gaugeRect.right + 8;
        if (left + TOOLTIP_W > window.innerWidth - 8) left = gaugeRect.left - TOOLTIP_W - 8;
        if (left < 8) left = 8;
        const top = Math.max(8, gaugeRect.top - 8);
        const wR  = inputs?.age != null ? Math.min(1, Math.max(0, inputs.age / 100)) : null;
        const age = inputs?.age != null ? Math.floor(inputs.age) : null;
        return createPortal(
          <div
            className="fixed z-[100] pointer-events-none rounded-lg border border-border bg-popover text-popover-foreground shadow-xl p-3 text-xs"
            style={{ top, left, width: TOOLTIP_W }}
          >
            <p className="font-semibold mb-2">
              {lang === 'en' ? 'Health Score' : 'Score de santé'} : {score} / 100
            </p>
            <div className="border-t border-border mb-2" />
            <div className="space-y-2">
              {TOOLTIP_COMPS.map(tc => {
                const val = breakdown[tc.key] ?? 0;
                const pct = Math.min(100, (val / tc.max) * 100);
                return (
                  <div key={tc.key}>
                    <div className="flex items-center gap-2">
                      <span className="w-40 shrink-0 text-muted-foreground">{tc.label}</span>
                      <span className="font-mono w-14 shrink-0 text-right" style={{ color: tc.color }}>
                        {val.toFixed(1)} / {tc.max}
                      </span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: tc.color }}
                        />
                      </div>
                    </div>
                    {tc.key === 'sResInf' && wR !== null && (
                      <p className="text-muted-foreground/70 pl-1 mt-0.5 italic">
                        {wR >= 0.5
                          ? `(${lang === 'en' ? 'resilience priority' : 'priorité résilience'} — ${age} ${lang === 'en' ? 'yrs' : 'ans'})`
                          : `(${lang === 'en' ? 'inflation priority' : 'priorité inflation'} — ${age} ${lang === 'en' ? 'yrs' : 'ans'})`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="border-t border-border mt-2 pt-2 flex justify-between font-semibold">
              <span className="text-muted-foreground">{lang === 'en' ? 'Total' : 'Total'}</span>
              <span className="font-mono" style={{ color: scoreColor(score) }}>{score} / 100</span>
            </div>
            {breakdown?.bonusYoung > 0 && (
              <p className="text-amber-600 dark:text-amber-400 mt-1">
                +{breakdown.bonusYoung} pts — {lang === 'en' ? 'Young investor bonus' : 'Bonus investisseur jeune'}
              </p>
            )}
            {breakdown?.bonusSenior > 0 && (
              <p className="text-amber-600 dark:text-amber-400 mt-1">
                +{breakdown.bonusSenior} pts — {lang === 'en' ? 'Resilient senior bonus' : 'Bonus sénior résilient'}
              </p>
            )}
            {breakdown?.bonus > 0 && breakdown?.bonusYoung == null && breakdown?.bonusSenior == null && (
              <p className="text-amber-600 dark:text-amber-400 mt-1">
                +{breakdown.bonus} pts — {lang === 'en' ? 'Bonus' : 'Bonus'}
              </p>
            )}
          </div>,
          document.body
        );
      })()}

      {/* ── Panneau d'aide par composante ────────────────────────────────── */}
      {helpComponent && (
        <HealthScoreHelpModal
          componentKey={helpComponent}
          score={breakdown?.[helpComponent] ?? null}
          inputs={inputs}
          lang={lang}
          onClose={() => setHelpComponent(null)}
        />
      )}
    </div>
  );
}

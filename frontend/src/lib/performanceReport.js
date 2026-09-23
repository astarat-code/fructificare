// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * performanceReport.js — the "Performance report" section of the annual PDF.
 *
 * Builds pages 1 to 4 of the enriched annual report (cover, summary, performance per
 * envelope, overall annual analysis) on a jsPDF document. The standard tax page is then
 * appended by TaxReport.js.
 *
 * Charts are drawn on an off-screen canvas (native Canvas 2D API) then embedded as JPEG
 * (white background, quality 0.92 — keeps the file size in check). No network dependency,
 * generation is 100% offline.
 */

import autoTable from 'jspdf-autotable';
import dataService from '../services/dataService';
// Structure des pages (titres, filets, en-têtes de tableaux)
import { VIOLET } from './pdfTheme';

// ── Couleurs de l'application ────────────────────────────────────────────────
const AMBER  = [217, 119, 6];
const AMBER_HEX = '#f59e0b';
const GREEN  = [5, 150, 105];
const RED    = [220, 38, 38];
const DARK   = [30, 41, 59];
const MUTED  = [100, 116, 139];
const DARK_HEX = '#1e293b';

// Palette des parts du camembert (types d'actifs / d'enveloppes)
const PIE_PALETTE = ['#059669', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e', '#84cc16', '#6366f1', '#d97706'];

const MONTH_LABELS = {
  fr: ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

// Locale active du rapport (positionnée au début de buildPerformanceSection).
// Le rendu est synchrone → un simple drapeau module suffit.
let _isEn = false;
const L = (fr, en) => (_isEn ? en : fr);
const monthLabel = (i) => MONTH_LABELS[_isEn ? 'en' : 'fr'][i];

// ── Formats français ─────────────────────────────────────────────────────────
// Intl fr-FR insère des espaces insécables (U+202F / U+00A0) que la police
// WinAnsi de jsPDF rend comme « / » — on les remplace par des espaces simples.
const cleanSpaces = (s) => String(s).replace(/[\u202f\u00a0\u2009]/g, ' ');
const fmtEur  = (v) => cleanSpaces(new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v || 0));
const fmtPct  = (v, signed = true) => {
  if (v == null || !Number.isFinite(v)) return '-';
  const s = cleanSpaces(new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v));
  return `${signed && v > 0 ? '+' : ''}${s} %`;
};
// Date localisée : MM/DD/YYYY (EN) ou DD/MM/YYYY (FR).
const fmtDate = (d) => {
  const dt = new Date(d);
  const p = (n) => String(n).padStart(2, '0');
  const mm = p(dt.getMonth() + 1), dd = p(dt.getDate()), yy = dt.getFullYear();
  return _isEn ? `${mm}/${dd}/${yy}` : `${dd}/${mm}/${yy}`;
};
const fmtEurShort = (v) => cleanSpaces(Math.abs(v) >= 1000
  ? `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v / 1000)} k€`
  : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v)} €`);

// ── Couleurs util ────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [100, 116, 139];
}
/** Teinte « couleur à X % d'opacité sur fond blanc ». */
function tint(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return [
    Math.round(255 - (255 - r) * alpha),
    Math.round(255 - (255 - g) * alpha),
    Math.round(255 - (255 - b) * alpha),
  ];
}

const daysBetween = (a, b) => (new Date(b) - new Date(a)) / 86400000;

/** Valeur calibrée interpolée linéairement à une date (plate au-delà de la dernière calibration). */
function valueOnDate(cals, dateStr) {
  if (!cals || !cals.length) return null;
  const prev = [...cals].filter(c => c.date <= dateStr).pop();
  if (!prev) return null;
  const next = cals.find(c => c.date > dateStr);
  if (!next) return prev.total_value;
  const span = daysBetween(prev.date, next.date);
  if (span <= 0) return prev.total_value;
  return prev.total_value + (next.total_value - prev.total_value) * (daysBetween(prev.date, dateStr) / span);
}

// ═════════════════════════════ CANVAS → PNG ═════════════════════════════════

function makeCanvas(wPx, hPx) {
  const scale = 2; // netteté dans le PDF
  const canvas = document.createElement('canvas');
  canvas.width = wPx * scale;
  canvas.height = hPx * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, wPx, hPx);
  return { canvas, ctx };
}

/**
 * Courbe d'évolution : valeur calibrée (noir) vs versements cumulés (ambre).
 * @param {Array<{label:string, value:number|null, deposits:number}>} rows
 */
function lineChartPng(rows, wPx = 960, hPx = 460) {
  const { canvas, ctx } = makeCanvas(wPx, hPx);
  const padL = 74, padR = 16, padT = 30, padB = 34;
  const plotW = wPx - padL - padR, plotH = hPx - padT - padB;

  const vals = rows.flatMap(r => [r.value, r.deposits]).filter(v => v != null && Number.isFinite(v));
  if (!vals.length || rows.length < 2) return null;
  const maxV = Math.max(...vals) * 1.06 || 1;
  const minV = 0;
  const x = (i) => padL + (rows.length === 1 ? 0 : (i / (rows.length - 1)) * plotW);
  const y = (v) => padT + plotH - ((v - minV) / (maxV - minV)) * plotH;

  // Grille horizontale + labels €
  ctx.font = '13px Helvetica, Arial, sans-serif';
  for (let g = 0; g <= 4; g++) {
    const v = minV + ((maxV - minV) * g) / 4;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, y(v)); ctx.lineTo(wPx - padR, y(v)); ctx.stroke();
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'right';
    ctx.fillText(fmtEurShort(v), padL - 8, y(v) + 4);
  }
  // Labels X
  ctx.textAlign = 'center';
  ctx.fillStyle = '#94a3b8';
  const step = Math.max(1, Math.ceil(rows.length / 12));
  rows.forEach((r, i) => { if (i % step === 0) ctx.fillText(r.label, x(i), hPx - 12); });

  // Aire + courbe des versements (ambre)
  ctx.beginPath();
  rows.forEach((r, i) => { const py = y(r.deposits || 0); i === 0 ? ctx.moveTo(x(i), py) : ctx.lineTo(x(i), py); });
  ctx.lineTo(x(rows.length - 1), y(0)); ctx.lineTo(x(0), y(0)); ctx.closePath();
  ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
  ctx.fill();
  ctx.beginPath();
  rows.forEach((r, i) => { const py = y(r.deposits || 0); i === 0 ? ctx.moveTo(x(i), py) : ctx.lineTo(x(i), py); });
  ctx.strokeStyle = AMBER_HEX; ctx.lineWidth = 2.5; ctx.stroke();

  // Courbe de la valeur calibrée (noir) — segments sans les null
  ctx.strokeStyle = DARK_HEX; ctx.lineWidth = 3.5;
  ctx.beginPath();
  let pen = false;
  rows.forEach((r, i) => {
    if (r.value == null) { pen = false; return; }
    const py = y(r.value);
    if (!pen) { ctx.moveTo(x(i), py); pen = true; } else ctx.lineTo(x(i), py);
  });
  ctx.stroke();

  // Légende
  ctx.textAlign = 'left';
  ctx.font = 'bold 13px Helvetica, Arial, sans-serif';
  ctx.fillStyle = DARK_HEX; ctx.fillRect(padL, 8, 22, 4);
  ctx.fillText(L('Valeur calibrée', 'Calibrated value'), padL + 28, 14);
  ctx.fillStyle = AMBER_HEX; ctx.fillRect(padL + 150, 8, 22, 4);
  ctx.fillText(L('Versements cumulés', 'Cumulative deposits'), padL + 178, 14);

  return canvas.toDataURL('image/jpeg', 0.92);
}

/**
 * Histogramme (rendements annuels ou frais par an).
 * @param {Array<{label:string, value:number, highlight:boolean}>} bars
 * @param {{pct?:boolean, color?:string}} opts — pct: format %, color: monochrome (frais)
 */
function barChartPng(bars, opts = {}, wPx = 960, hPx = 380) {
  if (!bars || !bars.length) return null;
  const { canvas, ctx } = makeCanvas(wPx, hPx);
  // padB généreux : laisse la place au label de valeur SOUS les barres négatives
  // sans chevaucher le label d'année.
  const padL = 20, padR = 20, padT = 34, padB = 46;
  const plotW = wPx - padL - padR, plotH = hPx - padT - padB;

  const maxV = Math.max(0, ...bars.map(b => b.value)) || 1;
  const minV = Math.min(0, ...bars.map(b => b.value));
  const range = (maxV - minV) || 1;
  const y = (v) => padT + ((maxV - v) / range) * plotH;

  const slot = plotW / bars.length;
  const barW = Math.min(64, slot * 0.55);

  // Ligne zéro
  ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(padL, y(0)); ctx.lineTo(wPx - padR, y(0)); ctx.stroke();

  ctx.font = '13px Helvetica, Arial, sans-serif';
  bars.forEach((b, i) => {
    const cx = padL + slot * i + slot / 2;
    const baseColor = opts.color || (b.value >= 0 ? '#059669' : '#dc2626');
    const [r, g, bl] = b.highlight ? hexToRgb(baseColor) : tint(baseColor, 0.5);
    ctx.fillStyle = `rgb(${r},${g},${bl})`;
    const top = y(Math.max(0, b.value));
    const h = Math.max(2, Math.abs(y(b.value) - y(0)));
    ctx.fillRect(cx - barW / 2, top, barW, h);
    if (b.highlight) {
      ctx.strokeStyle = DARK_HEX; ctx.lineWidth = 2;
      ctx.strokeRect(cx - barW / 2, top, barW, h);
    }
    // Valeur au-dessus / au-dessous
    ctx.fillStyle = b.highlight ? '#1e293b' : '#64748b';
    ctx.textAlign = 'center';
    ctx.font = b.highlight ? 'bold 13px Helvetica, Arial, sans-serif' : '12px Helvetica, Arial, sans-serif';
    const vLabel = opts.pct ? fmtPct(b.value) : fmtEurShort(b.value);
    ctx.fillText(vLabel, cx, b.value >= 0 ? top - 7 : Math.min(top + h + 15, hPx - 26));
    // Label X (année)
    ctx.fillStyle = b.highlight ? '#1e293b' : '#94a3b8';
    ctx.fillText(String(b.label), cx, hPx - 8);
  });

  return canvas.toDataURL('image/jpeg', 0.92);
}

/**
 * Camembert de répartition avec légende à droite.
 * @param {Array<{label:string, value:number}>} slices
 */
function pieChartPng(slices, wPx = 960, hPx = 420) {
  const total = (slices || []).reduce((s, x) => s + Math.max(0, x.value || 0), 0);
  if (!total) return null;
  const { canvas, ctx } = makeCanvas(wPx, hPx);
  const sorted = [...slices].filter(s => (s.value || 0) > 0).sort((a, b) => b.value - a.value);
  const cx = hPx / 2 + 10, cy = hPx / 2, radius = hPx / 2 - 26;

  let angle = -Math.PI / 2;
  sorted.forEach((s, i) => {
    const frac = s.value / total;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, angle, angle + frac * Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = s.color || PIE_PALETTE[i % PIE_PALETTE.length];
    ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
    angle += frac * Math.PI * 2;
  });

  // Légende
  const lx = cx + radius + 46;
  let ly = Math.max(26, cy - sorted.length * 14);
  ctx.font = '14px Helvetica, Arial, sans-serif';
  ctx.textAlign = 'left';
  sorted.forEach((s, i) => {
    ctx.fillStyle = s.color || PIE_PALETTE[i % PIE_PALETTE.length];
    ctx.fillRect(lx, ly - 10, 14, 14);
    ctx.fillStyle = '#334155';
    const pct = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format((s.value / total) * 100);
    ctx.fillText(`${s.label} — ${pct} % (${fmtEurShort(s.value)})`, lx + 22, ly + 2);
    ly += 28;
  });

  return canvas.toDataURL('image/jpeg', 0.92);
}

// ═════════════════════════════ ASSEMBLAGE DES DONNÉES ═══════════════════════

/** true si au moins une calibration est datée de l'année sélectionnée. */
export function hasCalibrationForYear(year) {
  return dataService.getCalibrations().some(c => (c.date || '').startsWith(String(year)));
}

/** Série mensuelle {label, value, deposits} d'une enveloppe pour l'année. */
function envelopeYearSeries(pid, year) {
  const hist = dataService.getPortfolioRealHistory(pid) || [];
  const rows = hist
    .filter(h => h.month.startsWith(String(year)))
    .map(h => ({
      label: monthLabel(parseInt(h.month.slice(5, 7), 10) - 1),
      value: h.realValue != null ? h.realValue : null,
      deposits: h.deposits || 0,
    }));
  return rows.length >= 2 ? rows : null;
}

/** Frais de transaction par année civile (toutes enveloppes). */
function feesByYear() {
  const byYear = {};
  (dataService.getAllTransactions() || []).forEach(tx => {
    if (!tx.fees_amount) return;
    const y = tx.date.slice(0, 4);
    byYear[y] = (byYear[y] || 0) + tx.fees_amount;
  });
  return Object.entries(byYear)
    .map(([y, v]) => ({ year: parseInt(y, 10), fees: Math.round(v * 100) / 100 }))
    .sort((a, b) => a.year - b.year);
}

// ═════════════════════════════ RENDU PDF ════════════════════════════════════

/**
 * Dessine les pages « performance » (1 à 4) sur le document jsPDF fourni,
 * en commençant sur la page COURANTE (appelée sur un document vierge).
 *
 * @param {jsPDF} doc
 * @param {number} year — année sélectionnée
 * @param {{ t: Function }} opts — traducteur i18n de l'application
 */
export function buildPerformanceSection(doc, year, { t, lang }) {
  _isEn = lang === 'en';
  const pageWidth  = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 14;
  const contentW = pageWidth - 2 * margin;
  const todayStr = new Date().toISOString().split('T')[0];
  const isCurrentYear = year === new Date().getFullYear();
  const yearEnd = isCurrentYear ? todayStr : `${year}-12-31`;
  const yearEndLabel = isCurrentYear ? fmtDate(todayStr) : fmtDate(`${year}-12-31`);
  const perYr = L('/ an', '/ yr');

  const atLabel = (at) => {
    if (!at) return '-';
    const key = `assetTypes.${at}`;
    const tr = t(key);
    return tr === key ? at.charAt(0).toUpperCase() + at.slice(1) : tr;
  };
  const typeLabel = (ty) => {
    const key = `types.${ty}`;
    const tr = t(key);
    return tr === key ? (ty || '').toUpperCase() : tr;
  };

  const allPortfolios = dataService.getPortfolios();
  const livrets   = allPortfolios.filter(p => p.type === 'compte_réglementé');
  const envelopes = allPortfolios.filter(p => p.type !== 'compte_réglementé');

  // Données par enveloppe (hors livrets)
  const envData = envelopes.map(p => {
    const cals = dataService.getCalibrations(p.id);
    const txns = dataService.getTransactions(p.id) || [];
    const yearTx = txns.filter(tx => tx.date.startsWith(String(year)));
    const annual = dataService.computeAnnualYields(p.id) || [];
    const yearYield = annual.find(a => a.year === year) || null;
    const realYield = dataService.computeRealYield(p.id);
    const calL2 = [...cals].filter(c => c.date <= yearEnd && c.asset_breakdown && c.asset_breakdown.length).pop() || null;
    // Valeur au 31/12 : calibration interpolée, sinon REPLI sur les versements nets
    // cumulés à cette date (même convention que computeGlobalYield) — évite qu'une
    // enveloppe calibrée plus tard (ex : 1ère calibration l'année suivante) disparaisse.
    const netDepositsAt = (dateStr) => txns
      .filter(tx => tx.date <= dateStr)
      .reduce((s, tx) => s + (tx.type === 'deposit' ? 1 : tx.type === 'withdrawal' ? -1 : 0) * (tx.net_amount ?? tx.amount ?? 0), 0);
    const calValue = valueOnDate(cals, yearEnd);
    return {
      p, cals, annual, yearYield, calL2, netDepositsAt,
      valueYearEnd: calValue != null ? calValue : Math.max(0, netDepositsAt(yearEnd)) || null,
      valueIsProxy: calValue == null,
      yearDeposits: yearTx.filter(tx => tx.type === 'deposit').reduce((s, tx) => s + (tx.net_amount ?? tx.amount ?? 0), 0),
      yearWithdrawals: yearTx.filter(tx => tx.type === 'withdrawal').reduce((s, tx) => s + (tx.net_amount ?? tx.amount ?? 0), 0),
      yearFees: yearTx.reduce((s, tx) => s + (tx.fees_amount || 0), 0),
      inceptionYield: realYield?.inceptionYield ?? null,
    };
  });

  const globalAnnual = dataService.computeAnnualYields(null) || [];
  const globalYearYield = globalAnnual.find(a => a.year === year) || null;
  const globalYield = dataService.computeGlobalYield(envelopes);
  const totalValueYearEnd =
    envData.reduce((s, d) => s + (d.valueYearEnd || 0), 0) +
    livrets.reduce((s, p) => s + (p.balance || 0), 0);
  const totalYearDeposits    = envData.reduce((s, d) => s + d.yearDeposits, 0);
  const totalYearWithdrawals = envData.reduce((s, d) => s + d.yearWithdrawals, 0);
  const totalYearFees        = envData.reduce((s, d) => s + d.yearFees, 0);

  // ── Utilitaires de dessin ──────────────────────────────────────────────────
  const sectionTitle = (txt, y, color = VIOLET) => {
    doc.setFontSize(15);
    doc.setTextColor(...color);
    doc.setFont(undefined, 'bold');
    doc.text(txt, margin, y);
    doc.setFont(undefined, 'normal');
    doc.setDrawColor(...color);
    doc.setLineWidth(0.5);
    doc.line(margin, y + 2, pageWidth - margin, y + 2);
    return y + 10;
  };

  const keyFigure = (x, y, w, label, value, color = DARK) => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, w, 22, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(label, x + 4, y + 7);
    doc.setFontSize(13);
    doc.setTextColor(...color);
    doc.setFont(undefined, 'bold');
    doc.text(value, x + 4, y + 16.5);
    doc.setFont(undefined, 'normal');
  };

  // ═══ PAGE 1 — COUVERTURE ═══════════════════════════════════════════════════
  doc.setFontSize(22);
  doc.setTextColor(239, 173, 36);
  doc.setFont(undefined, 'bold');
  doc.text('Fructificare', margin, 20);
  doc.setFont(undefined, 'normal');

  doc.setDrawColor(239, 173, 36);
  doc.setLineWidth(1);
  doc.line(margin, 25, margin + 42, 25);

  doc.setFontSize(28);
  doc.setTextColor(...DARK);
  doc.setFont(undefined, 'bold');
  doc.text(L(`Rapport de performance ${year}`, `Performance report ${year}`), margin, 52);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...MUTED);
  doc.text(L(`Portefeuille personnel — généré le ${fmtDate(new Date())}`, `Personal portfolio — generated on ${fmtDate(new Date())}`), margin, 61);

  // Visuel principal : évolution du portefeuille sur l'année (valeur vs versements).
  // Les livrets réglementés restent exclus ici (le rapport les traite séparément).
  const agg = dataService.getAllPortfoliosHistoryWithCalibration(false);
  const heroRows = (agg.data || [])
    .filter(r => r.month.startsWith(String(year)))
    .map(r => ({
      label: monthLabel(parseInt(r.month.slice(5, 7), 10) - 1),
      value: r.total_cal != null ? r.total_cal : null,
      deposits: r.total_dep || 0,
    }));
  const heroPng = heroRows.length >= 2 ? lineChartPng(heroRows, 1100, 520) : null;
  if (heroPng) {
    doc.addImage(heroPng, 'JPEG', margin, 72, contentW, contentW * (520 / 1100));
  } else {
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text(L('Données insuffisantes pour tracer la courbe annuelle.', 'Not enough data to plot the annual curve.'), margin, 90);
  }

  // Trois chiffres clés
  const kfY = 178;
  const kfW = (contentW - 8) / 3;
  keyFigure(margin, kfY, kfW, L(`Valeur totale au ${yearEndLabel}`, `Total value on ${yearEndLabel}`), fmtEur(totalValueYearEnd), GREEN);
  keyFigure(margin + kfW + 4, kfY, kfW, L(`PNL de l'année ${year}`, `${year} P&L`),
    globalYearYield ? fmtEur(globalYearYield.gainEur) : '-',
    globalYearYield && globalYearYield.gainEur < 0 ? RED : GREEN);
  keyFigure(margin + 2 * (kfW + 4), kfY, kfW, L("Rendement depuis l'origine", 'Return since inception'),
    globalYield?.xirrPct != null ? `${fmtPct(globalYield.xirrPct)} ${perYr}` : '-',
    globalYield?.xirrPct != null && globalYield.xirrPct < 0 ? RED : DARK);

  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(L('Document généré localement par Fructificare — données personnelles, à partager uniquement avec votre conseiller.', 'Generated locally by Fructificare — personal data, to be shared only with your adviser.'), margin, pageHeight - 18);

  // ═══ PAGE 2 — SYNTHÈSE DU PORTEFEUILLE ════════════════════════════════════
  doc.addPage();
  let y = sectionTitle(L('Synthèse du portefeuille', 'Portfolio summary'), 20);

  // Tableau récapitulatif par enveloppe (lignes teintées à 15 %)
  const rowTints = envData.map(d => tint(d.p.color || '#64748b', 0.15));
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [[L('Enveloppe', 'Envelope'), L('Type', 'Type'), L(`Valeur au ${yearEndLabel}`, `Value on ${yearEndLabel}`), L(`Versements ${year}`, `${year} deposits`), L(`PNL ${year}`, `${year} P&L`), L('Depuis l\'origine', 'Since inception')]],
    body: envData.map(d => ([
      d.p.name,
      typeLabel(d.p.type),
      d.valueYearEnd != null ? `${d.valueIsProxy ? '~ ' : ''}${fmtEur(d.valueYearEnd)}` : '-',
      fmtEur(d.yearDeposits),
      d.yearYield ? `${fmtEur(d.yearYield.gainEur)} (${fmtPct(d.yearYield.yieldPct)})` : '-',
      d.inceptionYield != null ? `${fmtPct(d.inceptionYield)} ${perYr}` : '-',
    ])),
    theme: 'grid',
    headStyles: { fillColor: VIOLET, textColor: 255, fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      data.cell.styles.fillColor = rowTints[data.row.index];
      if (data.column.index === 4) {
        const raw = String(data.cell.raw || '');
        if (raw.startsWith('-') && raw !== '-') data.cell.styles.textColor = RED;
        else if (raw !== '-') data.cell.styles.textColor = GREEN;
      }
    },
  });
  y = doc.lastAutoTable.finalY + 4;
  if (envData.some(d => d.valueIsProxy && d.valueYearEnd != null)) {
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(L('~ valeur estimée par les versements nets (aucune calibration disponible à cette date).', '~ value estimated from net deposits (no calibration available at that date).'), margin, y);
    y += 5;
  } else {
    y += 4;
  }

  // Livrets réglementés — présentés à part (convention tableau de bord)
  if (livrets.length > 0) {
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.setFont(undefined, 'bold');
    doc.text(L('Livrets réglementés (hors analyse de performance)', 'Regulated savings (excluded from performance analysis)'), margin, y + 2);
    doc.setFont(undefined, 'normal');
    autoTable(doc, {
      startY: y + 5,
      margin: { left: margin, right: margin },
      head: [[L('Livret', 'Account'), L('Solde', 'Balance')]],
      body: livrets.map(p => [p.name, fmtEur(p.balance || 0)]),
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 1: { halign: 'right' } },
      tableWidth: contentW / 2,
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // Camembert de répartition + bloc de métriques clés côte à côte
  // Répartition par actif (calibrations niveau 2) ou par type d'enveloppe (repli)
  let slices = [];
  const l2Agg = {};
  envData.forEach(d => {
    if (!d.calL2) return;
    d.calL2.asset_breakdown.forEach(ab => {
      const k = atLabel(ab.asset_type);
      l2Agg[k] = (l2Agg[k] || 0) + (ab.value || 0);
    });
  });
  let pieTitle;
  if (Object.keys(l2Agg).length > 0) {
    slices = Object.entries(l2Agg).map(([label, value]) => ({ label, value }));
    pieTitle = L("Répartition par type d'actif (calibration de fin d'année)", 'Allocation by asset type (year-end calibration)');
  } else {
    // Même convention que le tableau de bord (« Par actif ») : versements nets
    // cumulés par type d'actif des transactions, bornés à la fin de l'année.
    const byAsset = {};
    (dataService.getAllTransactions() || []).forEach(tx => {
      if (tx.date > yearEnd) return;
      const key = dataService.resolveAssetType(tx);
      const net = tx.net_amount ?? tx.amount ?? 0;
      if (tx.type === 'deposit') byAsset[key] = (byAsset[key] || 0) + net;
      else if (tx.type === 'withdrawal') byAsset[key] = (byAsset[key] || 0) - (tx.amount ?? net);
    });
    slices = Object.entries(byAsset)
      .filter(([, v]) => v > 0.005)
      .map(([k, v]) => ({
        label: k === 'livret_réglementé' ? L('Livret réglementé', 'Regulated savings') : k === 'non_defini' ? L('Non défini', 'Undefined') : atLabel(k),
        value: v,
      }));
    pieTitle = L("Répartition par type d'actif (versements nets)", 'Allocation by asset type (net deposits)');
  }
  // Dernier repli : par type d'enveloppe (valeurs de fin d'année)
  if (slices.length === 0) {
    const byType = {};
    envData.forEach(d => {
      const k = typeLabel(d.p.type);
      byType[k] = (byType[k] || 0) + (d.valueYearEnd || 0);
    });
    livrets.forEach(p => {
      const k = L('Livrets réglementés', 'Regulated savings');
      byType[k] = (byType[k] || 0) + (p.balance || 0);
    });
    slices = Object.entries(byType).filter(([, v]) => v > 0.005).map(([label, value]) => ({ label, value }));
    pieTitle = L("Répartition par type d'enveloppe", 'Allocation by envelope type');
  }
  const pieH = 62;
  const piePng = pieChartPng(slices, 1000, 420);
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.setFont(undefined, 'bold');
  doc.text(pieTitle, margin, y + 4);
  doc.setFont(undefined, 'normal');
  if (piePng) doc.addImage(piePng, 'JPEG', margin, y + 8, contentW * 0.72, contentW * 0.72 * (420 / 1000));

  // Métriques clés (à droite du camembert)
  const mx = margin + contentW * 0.72 + 4;
  const mW = contentW - contentW * 0.72 - 4;
  let my = y + 8;
  const metric = (label, value, color = DARK) => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(mx, my, mW, 12.5, 1.5, 1.5, 'FD');
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text(label, mx + 2.5, my + 4.5);
    doc.setFontSize(9);
    doc.setTextColor(...color);
    doc.setFont(undefined, 'bold');
    doc.text(value, mx + 2.5, my + 10);
    doc.setFont(undefined, 'normal');
    my += 14.5;
  };
  metric(L(`Total versé en ${year}`, `Total deposited in ${year}`), fmtEur(totalYearDeposits), GREEN);
  metric(L(`Total retiré en ${year}`, `Total withdrawn in ${year}`), fmtEur(totalYearWithdrawals), totalYearWithdrawals > 0 ? RED : DARK);
  metric(L('Net investi', 'Net invested'), fmtEur(totalYearDeposits - totalYearWithdrawals));
  metric(L(`Frais de l'année`, `${year} fees`), fmtEur(totalYearFees), AMBER);
  metric(L('Frais / portefeuille', 'Fees / portfolio'), totalValueYearEnd > 0 ? fmtPct((totalYearFees / totalValueYearEnd) * 100, false) : '-', AMBER);
  y = Math.max(y + 8 + pieH, my) + 4;

  // ═══ PAGE 3 — PERFORMANCE PAR ENVELOPPE ═══════════════════════════════════
  doc.addPage();
  y = sectionTitle(L('Performance par enveloppe', 'Performance by envelope'), 20);

  const ensureSpace = (needed) => {
    if (y + needed > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }
  };

  envData.forEach((d) => {
    ensureSpace(104);
    const colorHex = d.p.color || '#059669';
    const [cr, cg, cb] = hexToRgb(colorHex);

    // En-tête de section aux couleurs de l'enveloppe
    doc.setFillColor(...tint(colorHex, 0.15));
    doc.roundedRect(margin, y, contentW, 10, 1.5, 1.5, 'F');
    doc.setFillColor(cr, cg, cb);
    doc.rect(margin, y, 2.2, 10, 'F');
    doc.setFontSize(12);
    doc.setTextColor(cr, cg, cb);
    doc.setFont(undefined, 'bold');
    doc.text(`${d.p.name}`, margin + 6, y + 7);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(typeLabel(d.p.type), pageWidth - margin - 4, y + 7, { align: 'right' });
    y += 14;

    // Mini-courbe (gauche) + chiffres clés (droite)
    const chartW = contentW * 0.55;
    const series = envelopeYearSeries(d.p.id, year);
    const miniPng = series ? lineChartPng(series, 760, 380) : null;
    if (miniPng) {
      doc.addImage(miniPng, 'JPEG', margin, y, chartW, chartW * (380 / 760));
    } else {
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(L(`Pas de données mensuelles pour ${year}.`, `No monthly data for ${year}.`), margin, y + 10);
    }

    const fx = margin + chartW + 5;
    const fW = contentW - chartW - 5;
    let fy = y;
    const fig = (label, value, color = DARK) => {
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(label, fx, fy + 3.2);
      doc.setFontSize(9.5);
      doc.setTextColor(...color);
      doc.setFont(undefined, 'bold');
      doc.text(value, fx + fW, fy + 3.2, { align: 'right' });
      doc.setFont(undefined, 'normal');
      doc.setDrawColor(240, 240, 244);
      doc.line(fx, fy + 5.6, fx + fW, fy + 5.6);
      fy += 8.2;
    };
    fig(L(`Valeur au ${yearEndLabel}`, `Value on ${yearEndLabel}`), d.valueYearEnd != null ? `${d.valueIsProxy ? '~ ' : ''}${fmtEur(d.valueYearEnd)}` : '-', GREEN);
    fig(L(`PNL ${year}`, `${year} P&L`), d.yearYield ? `${fmtEur(d.yearYield.gainEur)} (${fmtPct(d.yearYield.yieldPct)})` : '-',
      d.yearYield && d.yearYield.gainEur < 0 ? RED : GREEN);
    fig(L("Rendement depuis l'origine", 'Return since inception'), d.inceptionYield != null ? `${fmtPct(d.inceptionYield)} ${perYr}` : '-');
    fig(L('Rendement cible configuré', 'Configured target return'), `${fmtPct(d.p.annual_return_rate || 0, false)} ${perYr}`);
    const gap = d.inceptionYield != null ? d.inceptionYield - (d.p.annual_return_rate || 0) : null;
    fig(L('Écart réel vs cible', 'Actual vs target gap'), gap != null ? fmtPct(gap) : '-', gap != null && gap < 0 ? RED : GREEN);
    const annualFeesLabel = d.p.annual_fees_type === 'euro'
      ? `${fmtEur(d.p.annual_fees_pct || 0)}${perYr}`
      : fmtPct(d.p.annual_fees_pct || 0, false);
    fig(L('Frais annuels configurés', 'Configured annual fees'), annualFeesLabel, AMBER);
    fig(L(`Frais de versement ${year}`, `${year} transaction fees`), fmtEur(d.yearFees), AMBER);
    const feesTotal = d.yearFees + (d.p.annual_fees_type === 'euro'
      ? (d.p.annual_fees_pct || 0)
      : (d.valueYearEnd || 0) * (d.p.annual_fees_pct || 0) / 100);
    fig(L(`Total frais estimé ${year}`, `Estimated total fees ${year}`),
      `${fmtEur(feesTotal)}${d.valueYearEnd ? ` (${fmtPct((feesTotal / d.valueYearEnd) * 100, false)})` : ''}`, AMBER);

    y += Math.max(chartW * (380 / 760), fy - y) + 4;

    // Histogramme des rendements annuels de l'enveloppe (année sélectionnée en surbrillance)
    if (d.annual.length > 0) {
      ensureSpace(40);
      const histPng = barChartPng(
        d.annual.map(a => ({ label: a.ytd ? `${a.year}*` : a.year, value: a.yieldPct, highlight: a.year === year })),
        { pct: true }, 900, 300,
      );
      if (histPng) {
        const hW = contentW * 0.8;
        doc.addImage(histPng, 'JPEG', margin, y, hW, hW * (300 / 900));
        y += hW * (300 / 900) + 3;
      }
    }

    // Détail par actif (calibration niveau 2)
    if (d.calL2) {
      ensureSpace(30);
      const envTotal = d.calL2.asset_breakdown.reduce((s, ab) => s + (ab.value || 0), 0) || 1;
      const pnlByAsset = isCurrentYear ? (dataService.getPortfolioPnlByAsset(d.p.id) || []) : [];
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [[L(`Répartition par actif (calibration du ${fmtDate(d.calL2.date)})`, `Allocation by asset (calibration of ${fmtDate(d.calL2.date)})`), L('Valeur', 'Value'), 'P&L', L('% de l\'enveloppe', '% of envelope')]],
        body: d.calL2.asset_breakdown.map(ab => {
          const pnlRow = pnlByAsset.find(x => (x.asset_type || '').toLowerCase() === (ab.asset_type || '').toLowerCase());
          return [
            atLabel(ab.asset_type),
            fmtEur(ab.value || 0),
            pnlRow ? fmtEur(pnlRow.pnl) : '-',
            fmtPct(((ab.value || 0) / envTotal) * 100, false),
          ];
        }),
        theme: 'grid',
        headStyles: { fillColor: tint(colorHex, 0.85), textColor: 255, fontSize: 7.5 },
        styles: { fontSize: 7.5, cellPadding: 2 },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      });
      y = doc.lastAutoTable.finalY + 6;
    }

    y += 6;
  });

  // ═══ PAGE 4 — ANALYSE ANNUELLE DU PORTEFEUILLE GLOBAL ═════════════════════
  doc.addPage();
  y = sectionTitle(L('Analyse annuelle du portefeuille global', 'Annual analysis of the overall portfolio'), 20);

  // Histogramme des rendements annuels globaux
  if (globalAnnual.length > 0) {
    const histPng = barChartPng(
      globalAnnual.map(a => ({ label: a.ytd ? `${a.year}*` : a.year, value: a.yieldPct, highlight: a.year === year })),
      { pct: true }, 1000, 340,
    );
    if (histPng) {
      doc.setFontSize(10);
      doc.setTextColor(...DARK);
      doc.setFont(undefined, 'bold');
      doc.text(L('Rendements annuels (Dietz modifiée, livrets exclus)', 'Annual returns (Modified Dietz, regulated savings excluded)'), margin, y + 2);
      doc.setFont(undefined, 'normal');
      doc.addImage(histPng, 'JPEG', margin, y + 5, contentW, contentW * (340 / 1000));
      y += contentW * (340 / 1000) + 12;
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(L('* année en cours (rendement à date)', '* current year (return to date)'), margin, y - 4);
    }
  }

  // Tableau année par année
  const yoyRows = globalAnnual.map(a => {
    const ye = a.ytd ? todayStr : `${a.year}-12-31`;
    // Même repli que la synthèse : versements nets si pas encore de calibration
    const totalVal = envData.reduce((s, d) => {
      const v = valueOnDate(d.cals, ye);
      return s + (v != null ? v : Math.max(0, d.netDepositsAt(ye)));
    }, 0);
    const yearTxAll = envData.flatMap(d =>
      (dataService.getTransactions(d.p.id) || []).filter(tx => tx.date.startsWith(String(a.year))));
    const dep = yearTxAll.filter(tx => tx.type === 'deposit').reduce((s, tx) => s + (tx.net_amount ?? tx.amount ?? 0), 0);
    const wd  = yearTxAll.filter(tx => tx.type === 'withdrawal').reduce((s, tx) => s + (tx.net_amount ?? tx.amount ?? 0), 0);
    return [
      a.ytd ? `${a.year} ${L('(à date)', '(to date)')}` : String(a.year),
      fmtEur(totalVal),
      fmtEur(dep - wd),
      fmtEur(a.gainEur),
      fmtPct(a.yieldPct),
    ];
  });
  if (yoyRows.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [[L('Année', 'Year'), L('Total portefeuille', 'Total portfolio'), L('Versements nets', 'Net deposits'), 'P&L', L('Rendement annuel', 'Annual return')]],
      body: yoyRows,
      theme: 'grid',
      headStyles: { fillColor: VIOLET, textColor: 255, fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      didParseCell: (data) => {
        if (data.section === 'body' && String(data.cell.raw).replace('(à date)', '').trim().startsWith(String(year))) {
          if (data.column.index === 0) data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [254, 249, 231];
        }
      },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // Évolution des frais par année (si plusieurs années de données)
  const fby = feesByYear();
  if (fby.length >= 2) {
    if (y + 50 > pageHeight - 20) { doc.addPage(); y = 20; }
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.setFont(undefined, 'bold');
    doc.text(L('Frais de versement par année', 'Transaction fees by year'), margin, y + 2);
    doc.setFont(undefined, 'normal');
    const feesPng = barChartPng(
      fby.map(f => ({ label: f.year, value: f.fees, highlight: f.year === year })),
      { color: AMBER_HEX }, 1000, 300,
    );
    if (feesPng) {
      const fW2 = contentW * 0.85;
      doc.addImage(feesPng, 'JPEG', margin, y + 5, fW2, fW2 * (300 / 1000));
      y += fW2 * (300 / 1000) + 12;
    }
  }

  // Progression FIRE
  const fire = dataService.computeFireProgress();
  if (fire) {
    if (y + 34 > pageHeight - 20) { doc.addPage(); y = 20; }
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.setFont(undefined, 'bold');
    doc.text(L('Progression vers l\'indépendance financière (FIRE)', 'Progress toward financial independence (FIRE)'), margin, y + 2);
    doc.setFont(undefined, 'normal');
    const barY = y + 6;
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, barY, contentW, 8, 2, 2, 'F');
    const progW = Math.max(2, contentW * Math.min(1, fire.fireProgress / 100));
    doc.setFillColor(...GREEN);
    doc.roundedRect(margin, barY, progW, 8, 2, 2, 'F');
    doc.setFontSize(8);
    if (progW > 22) {
      doc.setTextColor(255, 255, 255);
      doc.text(`${fmtPct(fire.fireProgress, false)}`, margin + 3, barY + 5.5);
    } else {
      doc.setTextColor(...DARK);
      doc.text(`${fmtPct(fire.fireProgress, false)}`, margin + progW + 3, barY + 5.5);
    }
    doc.setTextColor(...MUTED);
    const fireLines = doc.splitTextToSize(
      L(
        `Capital actuel : ${fmtEur(fire.capitalActuel)}  /  Objectif : ${fmtEur(fire.capitalNecessaire)}` +
          `  —  Besoin mensuel : ${fmtEur(fire.monthly_need)}, taux de retrait : ${fmtPct(fire.withdrawal_rate, false)}`,
        `Current capital: ${fmtEur(fire.capitalActuel)}  /  Target: ${fmtEur(fire.capitalNecessaire)}` +
          `  —  Monthly need: ${fmtEur(fire.monthly_need)}, withdrawal rate: ${fmtPct(fire.withdrawal_rate, false)}`,
      ),
      contentW,
    );
    doc.text(fireLines, margin, barY + 14);
    y = barY + 14 + fireLines.length * 4 + 4;
  }
}

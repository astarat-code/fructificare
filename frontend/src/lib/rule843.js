// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * rule843.js — shared logic of the "8-4-3 rule" simulation (read-only).
 *
 * Used by the dedicated page (Rule843) AND by the tile in the simulation list.
 * Modifies no dashboard data.
 *
 * Past: real calibrated values when available, otherwise real net deposits.
 * Future: compound-interest projection V(n) = V(n-1)·(1+r) + monthly deposit×12.
 */

import dataService from "../services/dataService";

const DAY_MS = 86400000;

/** Pré-remplissage : versement mensuel moyen + rendement pondéré des enveloppes. */
export function computeBlend(selectedIds) {
  const ports = dataService.getPortfolios().filter(p => selectedIds.includes(p.id));
  let valueSum = 0, yieldWeighted = 0, rateSum = 0;
  let totalDep = 0, minDate = null, maxDate = null;

  ports.forEach(p => {
    const cals = dataService.getCalibrations(p.id);
    const currentValue = cals.length ? cals[cals.length - 1].total_value : (p.balance || 0);
    const ry  = dataService.computeRealYield(p.id);
    const yld = (ry && ry.inceptionYield != null) ? ry.inceptionYield : (p.annual_return_rate || 0);
    rateSum += (p.annual_return_rate || 0);
    if (currentValue > 0) { valueSum += currentValue; yieldWeighted += yld * currentValue; }

    dataService.getTransactions(p.id).filter(t => t.type === 'deposit').forEach(t => {
      totalDep += (t.net_amount || t.amount || 0);
      if (!minDate || t.date < minDate) minDate = t.date;
      if (!maxDate || t.date > maxDate) maxDate = t.date;
    });
  });

  const blendedYield = valueSum > 0 ? yieldWeighted / valueSum : (ports.length ? rateSum / ports.length : 7);
  let months = 1;
  if (minDate && maxDate) months = Math.max(1, Math.round((new Date(maxDate) - new Date(minDate)) / (30.44 * DAY_MS)) + 1);
  const monthlyDeposit = totalDep > 0 ? totalDep / months : 0;

  return { blendedYield: Math.round(blendedYield * 10) / 10, monthlyDeposit: Math.round(monthlyDeposit), minDate };
}

/**
 * Construit les 16 années (An 0 → An 15).
 *
 * `startCapital` (optionnel) : capital de départ.
 *   • S'il est fourni → PROJECTION PURE amorcée par le capital (modèle 8-4-3) :
 *       portfolio(0) = capital + versement×12
 *       portfolio(n) = portfolio(n-1)×(1+r) + versement×12
 *       cumDep(0)    = capital + versement×12
 *       cumDep(n)    = cumDep(n-1) + versement×12
 *     Le capital est la base composée qui se propage à CHAQUE année suivante ; il
 *     n'est jamais réinitialisé (correction du décrochage An 0 → An 1).
 *   • S'il est nul/vide → comportement historique : passé réel (valeurs calibrées /
 *     versements) puis projection composée pour le futur.
 */
export function buildYears({ selectedIds, startYear, startMonth, monthlyDeposit, annualYield, startCapital = null }) {
  const r = (parseFloat(annualYield) || 0) / 100;
  const M = parseFloat(monthlyDeposit) || 0;
  const _sc = (startCapital === null || startCapital === undefined || startCapital === '') ? null : parseFloat(startCapital);
  const hasStartCapital = _sc != null && !isNaN(_sc);
  const today = new Date().toISOString().slice(0, 10);
  const anchorOf = (k) => `${startYear + k}-${String(startMonth).padStart(2, '0')}-01`;

  const allFlows = [];
  selectedIds.forEach(id => {
    dataService.getTransactions(id).forEach(t => {
      if (t.type === 'deposit' || t.type === 'withdrawal') {
        allFlows.push({ date: t.date, amount: (t.type === 'deposit' ? 1 : -1) * (t.net_amount ?? t.amount ?? 0) });
      }
    });
  });
  const netDepUpTo = (date) => allFlows.filter(f => f.date <= date).reduce((s, f) => s + f.amount, 0);

  const realValueOn = (date) => {
    let sum = 0;
    selectedIds.forEach(id => {
      const v = dataService.getPortfolioValueOnDate(id, date);
      if (v != null) { sum += v; return; }
      const nd = dataService.getTransactions(id)
        .filter(t => (t.type === 'deposit' || t.type === 'withdrawal') && t.date <= date)
        .reduce((s, t) => s + ((t.type === 'deposit' ? 1 : -1) * (t.net_amount ?? t.amount ?? 0)), 0);
      sum += Math.max(0, nd);
    });
    return sum;
  };

  const rows = [];
  let prevVal = 0, prevDep = 0;
  for (let k = 0; k <= 15; k++) {
    const date   = anchorOf(k);
    const isPast = date <= today;
    let cumDep, value;
    if (hasStartCapital) {
      // Projection pure amorcée par le capital de départ (jamais réinitialisé).
      if (k === 0) {
        const base = Math.max(0, _sc);
        cumDep = base + M * 12;
        value  = base + M * 12;
      } else {
        cumDep = prevDep + M * 12;
        value  = prevVal * (1 + r) + M * 12;
      }
    } else if (isPast) {
      cumDep = Math.max(0, netDepUpTo(date));
      value  = realValueOn(date);
    } else {
      cumDep = prevDep + M * 12;
      value  = prevVal * (1 + r) + M * 12;
    }
    const intYear = k === 0 ? Math.max(0, value - cumDep) : (value - prevVal) - (cumDep - prevDep);
    const retPct  = (k > 0 && prevVal > 0) ? ((value - prevVal - (cumDep - prevDep)) / prevVal) * 100 : null;
    rows.push({
      k, date, isPast,
      cumDep: Math.round(cumDep),
      value:  Math.round(value),
      interest: Math.round(value - cumDep),
      intYear: Math.round(intYear),
      retPct,
      cumGainPct: cumDep > 0 ? Math.round((value - cumDep) / cumDep * 1000) / 10 : null, // gains cumulés %
    });
    prevVal = value; prevDep = cumDep;
  }
  return rows;
}

/**
 * Série mensuelle (180 mois) pour le calendrier de progression.
 *
 * COHÉRENCE avec « Détail année par année » : la somme des gains mensuels d'un
 * bloc de 12 mois (année civile « An k » du calendrier) est EXACTEMENT égale à
 * l'« intérêt de l'année » du tableau annuel (rows[k].intYear). L'intérêt annuel
 * est réparti sur les 12 mois par poids composés ; le dernier mois absorbe l'arrondi
 * pour garantir une somme exacte. L'An 0 (constitution du capital) n'a aucun
 * intérêt — cohérent avec le tableau (An 0 = 0 €) ; la valeur y augmente par les
 * seuls versements.
 *
 * @returns {Array<{ m, year, monthIdx, date, isPast, isCurrent, value, monthGain }>}
 */
export function buildMonths({ rows, startYear, startMonth, annualYield }) {
  const r = (parseFloat(annualYield) || 0) / 100;
  const mr = Math.pow(1 + r, 1 / 12) - 1;
  const now = new Date();
  const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const out = [];
  for (let m = 0; m < 180; m++) {
    const totalMonth = (startMonth - 1) + m;
    const year = startYear + Math.floor(totalMonth / 12);
    const monthIdx = ((totalMonth % 12) + 12) % 12; // 0-based
    const key = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
    const isPast = key < nowKey;
    const isCurrent = key === nowKey;
    // Interpolation linéaire de la valeur annuelle (affichage uniquement)
    const yk = m / 12;
    const lo = Math.min(15, Math.floor(yk));
    const hi = Math.min(15, lo + 1);
    const frac = yk - lo;
    const value = Math.round(((rows[lo]?.value ?? 0) + ((rows[hi]?.value ?? rows[lo]?.value ?? 0) - (rows[lo]?.value ?? 0)) * frac));
    out.push({ m, year, monthIdx, date: `${key}-01`, isPast, isCurrent, value, monthGain: 0 });
  }

  // Répartition de l'intérêt annuel de chaque bloc sur ses 12 mois (poids composés),
  // avec somme exacte == rows[bloc].intYear (réconciliation mois ↔ tableau annuel).
  const weights = [];
  for (let j = 0; j < 12; j++) weights.push(Math.pow(1 + mr, j));
  const wSum = weights.reduce((s, w) => s + w, 0) || 12;
  for (let yr = 0; yr < 15; yr++) {
    const annual = Math.round(rows[yr]?.intYear || 0);
    if (annual === 0) continue; // An 0 (ou année sans intérêt) : rien à répartir
    let acc = 0;
    for (let j = 0; j < 12; j++) {
      const idx = yr * 12 + j;
      if (idx >= out.length) break;
      const g = (j < 11) ? Math.round(annual * weights[j] / wSum) : (annual - acc);
      if (j < 11) acc += g;
      out[idx].monthGain = g;
    }
  }
  return out;
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * portfolioDataSource.js — data source adapter for the envelope page.
 *
 * Lets the PortfolioDetail page (and the recurring movements panel) be reused AS-IS either
 * on the DASHBOARD data or on a SIMULATION's data (isolated namespace).
 *
 *   makeDataSource()                                  → dataService (dashboard)
 *   makeDataSource({ type:'simulation', simId })      → simulation-scoped adapter
 *
 * On the simulation side, READS reuse the dashboard's calculation engine through
 * dataService._withSimData (a temporary switch of the data context), and WRITES go through
 * the dedicated sim functions. No write ever touches the dashboard.
 */

import dataService from '../services/dataService';

export function makeDataSource(scope) {
  if (!scope || scope.type === 'dashboard' || !scope.simId) return dataService;

  const simId = scope.simId;
  const W = (fn) => dataService._withSimData(simId, fn);
  const projTargetMonth = scope.projectionTargetMonth || null;

  // Taux net annuel de projection (rendement cible − frais annuels en %), borné à ≥ 0.
  // En mode frais « euro », annual_fees_pct est un montant fixe (€/an), pas un taux → ignoré ici.
  const _netRate = (pid) => {
    const sim = dataService.getSimulation(simId);
    const p = (sim?.portfolios || []).find(x => x.id === pid);
    const feesPct = p?.annual_fees_type === 'euro' ? 0 : (p?.annual_fees_pct || 0);
    return Math.max(0, ((p?.annual_return_rate || 0) - feesPct) / 100);
  };

  // Historique réel + PROJECTION future jusqu'à l'horizon : on capitalise la dernière
  // valeur connue au rendement cible (mensuel) et on ajoute les versements futurs déjà
  // matérialisés. Les points projetés portent `projected:true`.
  const _projectedHistory = (pid) => {
    const base = W(() => dataService.getPortfolioRealHistory(pid));
    if (!projTargetMonth || !base.length) return base;
    const lastMonth = base[base.length - 1].month;
    if (projTargetMonth <= lastMonth) return base;

    const last  = base[base.length - 1];
    let cumDep  = last.deposits ?? 0;
    let value   = last.realValue != null ? last.realValue : (last.value ?? cumDep);
    const monthlyRate = _netRate(pid) / 12;

    // Versements futurs déjà matérialisés (par le curseur de la vue d'ensemble)
    const sim = dataService.getSimulation(simId);
    const depByMonth = {};
    (sim?.transactions || []).forEach(tx => {
      if (tx.portfolio_id !== pid) return;
      const m = tx.date.slice(0, 7);
      if (m <= lastMonth) return;
      const net = tx.type === 'deposit' ? (tx.net_amount ?? tx.amount ?? 0) : -(tx.amount ?? 0);
      depByMonth[m] = (depByMonth[m] || 0) + net;
    });

    const out = base.slice();
    let [yy, mm] = lastMonth.split('-').map(Number);
    let guard = 0;
    while (guard++ < 800) {
      mm++; if (mm > 12) { mm = 1; yy++; }
      const key = `${yy}-${String(mm).padStart(2, '0')}`;
      const contrib = depByMonth[key] || 0;
      cumDep += contrib;
      value = value * (1 + monthlyRate) + contrib;
      out.push({
        month: key,
        deposits: Math.round(cumDep * 100) / 100,
        value: Math.round(value * 100) / 100,
        realValue: Math.round(value * 100) / 100,
        projected: true,
      });
      if (key >= projTargetMonth) break;
    }
    return out;
  };

  // Frais PROJETÉS de l'enveloppe jusqu'à l'horizon : frais de versement (fees_amount)
  // + drain de frais annuels de gestion capitalisé mois par mois. Reproduit à
  // l'identique le calcul de la vue d'ensemble de la simulation (SimulationDetail)
  // afin que la tuile « Total frais » de la page enveloppe reste cohérente avec elle.
  const _projectedFees = (pid) => {
    const sim = dataService.getSimulation(simId);
    if (!sim) return null;
    const p = (sim.portfolios || []).find(x => x.id === pid);
    if (!p) return null;
    const pTxns = (sim.transactions || [])
      .filter(t => t.portfolio_id === pid)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (!pTxns.length) return { txFees: 0, annualFees: 0, total: 0 };

    const useInflation    = sim.inflation_settings?.enabled || false;
    const inflRate        = sim.inflation_settings?.rate || 2.5;
    const annualInflation = useInflation ? inflRate / 100 : 0;
    const baseAnnualRate  = (p.annual_return_rate || 0) / 100;
    // Frais annuels en mode « euro » = montant fixe (non un taux) → ignoré dans le drain.
    const envelopeAnnualFees = p.annual_fees_type === 'euro' ? 0 : (p.annual_fees_pct || 0) / 100;

    const today      = new Date().toISOString().substring(0, 7);
    const txMonths   = pTxns.map(t => t.date.substring(0, 7));
    const minMonth   = txMonths.reduce((a, b) => (a < b ? a : b));
    const maxTxMonth = txMonths.reduce((a, b) => (a > b ? a : b));
    let maxMonth = today;
    if (projTargetMonth && projTargetMonth > maxMonth) maxMonth = projTargetMonth;
    if (maxTxMonth > maxMonth) maxMonth = maxTxMonth;

    const sortedMonths = [];
    let [yy, mm] = minMonth.split('-').map(Number);
    const [ey, em] = maxMonth.split('-').map(Number);
    let guard = 0;
    while ((yy < ey || (yy === ey && mm <= em)) && guard++ < 4000) {
      sortedMonths.push(`${yy}-${String(mm).padStart(2, '0')}`);
      mm++; if (mm > 12) { mm = 1; yy++; }
    }

    const contribs = [];
    let annualFeeDrain = 0;
    sortedMonths.forEach((monthKey, index) => {
      pTxns.filter(t => t.date.substring(0, 7) === monthKey).forEach(t => {
        const netAmount = t.net_amount ?? t.amount ?? 0;
        if (t.type === 'deposit') {
          // Le mode « euro » des frais annuels de transaction n'est pas un taux (traité en drain fixe plus bas).
          const txAnnualRatePct = t.annual_fees_type === 'euro' ? 0 : ((t.annual_fees_pct || 0) / 100);
          const txAnnualFees   = txAnnualRatePct + envelopeAnnualFees;
          const txNetAnnualRate = Math.max(0, baseAnnualRate - txAnnualFees - annualInflation);
          contribs.push({ monthlyRate: txNetAnnualRate / 12, annualFeeRate: txAnnualFees, startMonthIndex: index, currentValue: netAmount });
        } else if (t.type === 'withdrawal') {
          let remaining = netAmount;
          for (let i = contribs.length - 1; i >= 0 && remaining > 0; i--) {
            if (contribs[i].currentValue <= remaining) { remaining -= contribs[i].currentValue; contribs[i].currentValue = 0; }
            else { contribs[i].currentValue -= remaining; remaining = 0; }
          }
        }
      });
      contribs.forEach(c => {
        if (c.currentValue > 0 && index - c.startMonthIndex > 0) {
          annualFeeDrain += c.currentValue * ((c.annualFeeRate || 0) / 12);
          c.currentValue  = c.currentValue * (1 + c.monthlyRate);
        }
      });
    });

    // Frais annuels € FIXES (par mouvement source, une seule fois par an) sur l'horizon projeté.
    const euroGroups = {};
    pTxns.forEach(t => {
      if (t.type !== 'deposit' || t.annual_fees_type !== 'euro') return;
      const euro = parseFloat(t.annual_fees_pct) || 0;
      if (euro <= 0) return;
      const key = t.from_recurring_id || t.movement_group_id || `tx_${t.id}`;
      const mk  = t.date.substring(0, 7);
      if (!euroGroups[key]) euroGroups[key] = { perMonth: {}, firstMonth: mk };
      const g = euroGroups[key];
      g.perMonth[mk] = (g.perMonth[mk] || 0) + euro;
      if (mk < g.firstMonth) g.firstMonth = mk;
    });
    let euroAnnualDrain = 0;
    Object.values(euroGroups).forEach(g => {
      const euroPerYear = g.perMonth[g.firstMonth] || 0;
      const [fy, fm] = g.firstMonth.split('-').map(Number);
      const [my, mn] = maxMonth.split('-').map(Number);
      const months = Math.max(0, (my - fy) * 12 + (mn - fm));
      euroAnnualDrain += euroPerYear * (months / 12);
    });

    const txFees = pTxns
      .filter(t => t.type === 'deposit' && t.date.substring(0, 7) <= maxMonth)
      .reduce((s, t) => s + (t.fees_amount || 0), 0);
    const annualFees = Math.round((annualFeeDrain + euroAnnualDrain) * 100) / 100;
    return { txFees: Math.round(txFees * 100) / 100, annualFees, total: Math.round((txFees + annualFees) * 100) / 100 };
  };

  return {
    ASSET_TYPES: dataService.ASSET_TYPES,
    getProjectedFees: (pid) => _projectedFees(pid),

    // ── Lectures (moteur de calcul réutilisé sur les données de la simulation) ──
    getPortfolio:                  (pid) => W(() => dataService.getPortfolio(pid)),
    getPortfolios:                 ()    => W(() => dataService.getPortfolios()),
    getTransactions:               (pid) => W(() => dataService.getTransactions(pid)),
    getMovementTemplates:          (pid) => W(() => dataService.getMovementTemplates(pid)),
    // Évolution de l'enveloppe : historique réel PROLONGÉ jusqu'à l'horizon (rendement cible).
    getPortfolioRealHistory:       (pid) => _projectedHistory(pid),
    getCustomAssetTypes:           ()    => dataService.getCustomAssetTypes(),
    computeRealYield:              (pid) => W(() => dataService.computeRealYield(pid)),
    getPortfolioPnlByAsset:        (pid) => W(() => dataService.getPortfolioPnlByAsset(pid)),
    getPortfolioCalibrationYields: (pid) => W(() => dataService.getPortfolioCalibrationYields(pid)),
    // Rendement annuel : années réelles (Dietz) + années PROJETÉES (au rendement cible).
    computeAnnualYields:           (pid) => {
      const baseYears = W(() => dataService.computeAnnualYields(pid));
      if (!projTargetMonth) return baseYears;
      const hist = _projectedHistory(pid);
      const proj = hist.filter(p => p.projected);
      if (!proj.length) return baseYears;
      const valueAt = (key) => {
        const exact = hist.find(p => p.month === key);
        if (exact) return exact;
        return [...hist].reverse().find(p => p.month <= key) || null;
      };
      const lastReal = [...hist].reverse().find(p => !p.projected) || hist[0];
      const lastRealYear = parseInt((lastReal?.month || `${new Date().getFullYear()}-01`).slice(0, 4), 10);
      const targetYear = parseInt(projTargetMonth.slice(0, 4), 10);
      const existing = new Set(baseYears.map(y => y.year));
      const out = baseYears.slice();
      for (let y = lastRealYear + 1; y <= targetYear; y++) {
        if (existing.has(y)) continue;
        const startPt = valueAt(`${y - 1}-12`) || lastReal;
        const endPt   = valueAt(`${y}-12`) || startPt;
        const startVal = startPt?.realValue ?? 0;
        const endVal   = endPt?.realValue ?? startVal;
        const contrib  = (endPt?.deposits ?? 0) - (startPt?.deposits ?? 0);
        const gainEur  = Math.round((endVal - startVal - contrib) * 100) / 100;
        const yieldPct = startVal > 0
          ? Math.round((gainEur / startVal) * 1000) / 10
          : Math.round(_netRate(pid) * 1000) / 10;
        out.push({ year: y, yieldPct, gainEur, ytd: false, projected: true });
      }
      return out;
    },
    getPortfolioDeletionImpact:    (pid) => W(() => dataService.getPortfolioDeletionImpact(pid)),
    getCalibrations:               (pid) => dataService.getSimulationCalibrations(simId, pid),

    // ── Écritures (fonctions sim dédiées — espace de noms isolé) ──
    createTransaction:           (pid, tx)          => dataService.addSimulationTransaction(simId, pid, tx),
    createRecurringTransactions: (pid, tx)          => dataService.addSimulationRecurringTransactions(simId, pid, tx),
    updateTransaction:           (pid, txId, upd)   => dataService.updateSimulationTransaction(simId, txId, upd),
    deleteTransaction:           (pid, txId)        => dataService.deleteSimulationTransaction(simId, txId),
    updatePortfolio:             (pid, upd)         => dataService.updateSimulationPortfolio(simId, pid, upd),
    deletePortfolio:             (pid)             => dataService.deleteSimulationPortfolio(simId, pid),
    addCalibration:              (cal)             => dataService.addSimulationCalibration(simId, cal),
    deleteCalibration:           (calId)           => dataService.deleteSimulationCalibration(simId, calId),

    // ── Modèles & récurrents scopés simulation (utilisés par RegularMovementsPanel) ──
    getAllMovementTemplates:     ()                 => dataService.getSimulationMovementTemplates(simId),
    createMovementTemplate:      (data)             => dataService.createSimulationMovementTemplate(simId, data),
    updateMovementTemplate:      (tid, upd)         => dataService.updateSimulationMovementTemplate(simId, tid, upd),
    deleteMovementTemplate:      (tid)              => dataService.deleteSimulationMovementTemplate(simId, tid),
    getRegularMovements:         ()                 => dataService.getSimulationRegularMovements(simId),
    createRegularMovement:       (data)             => dataService.createSimulationRegularMovement(simId, data),
    updateRegularMovement:       (rid, upd)         => dataService.updateSimulationRegularMovement(simId, rid, upd),
    stopRegularMovement:         (rid)              => dataService.stopSimulationRegularMovement(simId, rid),
    deleteRegularMovement:       (rid)              => dataService.deleteSimulationRegularMovement(simId, rid),
    getAllTransactions:          ()                 => W(() => dataService.getAllTransactions()),
    applyNoteToRecurringOccurrences: () => {},  // pas de propagation de note en simulation
  };
}

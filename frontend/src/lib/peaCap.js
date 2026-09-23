// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * Rule computing the PEA deposits subject to the cap (PEA_MAX, in dataService).
 * Shared by the validation and by the envelope page's display, so that the figure shown
 * is exactly the one that triggers the block.
 */

/**
 * Versements comptant pour le plafond : montant net des dépôts, hors part
 * réinvestie depuis la poche espèces (cet argent a déjà été versé). Les retraits
 * ne libèrent pas de plafond.
 */
export function versementsPea(transactions, portfolioId) {
  return (transactions || [])
    .filter((t) => t.type === 'deposit' && (portfolioId == null || t.portfolio_id === portfolioId))
    .reduce((s, t) => s + ((t.net_amount || t.amount || 0) - (t.from_cash_amount || 0)), 0);
}

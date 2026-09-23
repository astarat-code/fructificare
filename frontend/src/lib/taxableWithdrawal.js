// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * The "is this sale taxable?" rule, shared by the computation (dataService) and by the tax
 * report's display, so that the taxed total and the rows marked as taxable always point at
 * the same movements.
 *
 *   • Crypto: the sale converts into currency (the euros land in the envelope's cash
 *     account) → taxable event, even without money leaving, whatever envelope holds it.
 *   • Ordinary securities account: disposing of securities is taxable in the year of the
 *     sale, even if the proceeds stay as cash at the broker.
 *   • PEA, PER, life insurance: taxation DEFERRED until funds leave — rebalancing inside
 *     the envelope triggers nothing.
 *   • Regulated savings account, custom envelope: no tax regime computed; the money
 *     leaving is recorded, with no consequence on tax (always zero).
 *
 * These rules describe French taxation. Fructificare provides an ESTIMATE, for information
 * only: it replaces neither your tax return nor tax advice.
 */

/** Enveloppes où l'imposition n'intervient qu'à la sortie des fonds. */
const IMPOSITION_A_LA_SORTIE = ['PEA', 'PER', 'assurance_vie'];

/** Enveloppes où chaque cession est imposable, même sans sortie d'argent. */
const IMPOSITION_A_LA_VENTE = ['CTO', 'Crypto'];

/**
 * @param {object} tx — la transaction évaluée
 * @param {string} [typeEnveloppe] — type de l'enveloppe qui la porte (p.type)
 */
export function estRetraitImposable(tx, typeEnveloppe) {
  if (!tx || tx.type !== 'withdrawal') return false;
  if (tx.asset_type === 'crypto') return true;
  if (IMPOSITION_A_LA_SORTIE.includes(typeEnveloppe)) return !tx.keep_in_cash;
  if (IMPOSITION_A_LA_VENTE.includes(typeEnveloppe)) return true;
  return !tx.keep_in_cash;
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * transactionFees.js — Direction of a movement's fees, for display.
 *
 * Two conventions coexist, depending on the movement:
 *   • "deducted" — fees are taken OUT of the amount paid in: the amount after fees is
 *     LOWER than the amount before fees;
 *   • "added"    — fees are charged ON TOP: the amount after fees is HIGHER (a €535.38
 *     purchase with €1.87 of fees debits €537.25).
 *
 * The history and the PDF used to show a "−" in both cases. On a movement with added fees
 * that contradicted the neighbouring column and suggested a calculation error — while the
 * calculation was right.
 *
 * NO COMPUTATION RELIES ON THIS MODULE: it only picks a sign on screen. The amounts
 * (`net_amount`) are established at entry time and are authoritative.
 */

/**
 * Les frais de ce mouvement s'ajoutent-ils au montant ?
 *
 * `fee_direction` fait foi quand il est présent. Les mouvements enregistrés avant
 * l'introduction de ce champ ne le portent pas : le sens est alors déduit des montants
 * eux-mêmes, en comparant le montant après frais au montant avant frais.
 *
 * @param {{ fee_direction?: string, amount?: number, net_amount?: number }} tx
 * @returns {boolean} vrai si les frais sont ajoutés, faux s'ils sont déduits
 */
export function fraisAjoutes(tx) {
  if (!tx) return false;
  if (tx.fee_direction === 'added') return true;
  if (tx.fee_direction === 'deducted') return false;
  return tx.net_amount != null && tx.amount != null && tx.net_amount > tx.amount;
}

/** Signe à afficher devant le montant des frais : « + » s'ils sont ajoutés, « - » sinon. */
export function signeFrais(tx) {
  return fraisAjoutes(tx) ? '+' : '-';
}

export default fraisAjoutes;

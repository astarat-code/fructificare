// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * transactionFees.js — How a movement's transaction fees are counted.
 *
 * A movement records the amount typed (`amount`), its fees (`fees_amount`) and the
 * amount INVESTED (`net_amount`). Two conventions exist for the fees:
 *   • "deducted" — fees are taken OUT of the amount typed: €76 typed with €1 of fees
 *     invests €75;
 *   • "added"    — fees are charged ON TOP of the amount typed: €75 typed with €1 of
 *     fees invests €75 and debits €76 (the broker's "order + fee" presentation).
 *
 * In both cases:
 *   • `net_amount` is what is invested. Every return, balance and allocation relies on it.
 *   • `net_amount + fees_amount` is what left the user's pocket. Only the "deposits"
 *     figures shown to the user rely on it.
 *
 * Until version 1.2 an "added" movement stored `net_amount = amount + fees`: the fees
 * were counted as invested and inflated the base of the return. `normaliserFraisAjoutes`
 * brings older data to the rule above when it is loaded.
 */

const arrondi = (x) => Math.round(x * 100) / 100;

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

/**
 * Montant investi (ou reçu, pour une vente) à partir du montant saisi et des frais.
 * @param {number} montant   montant saisi
 * @param {number} frais     frais de transaction, en euros
 * @param {string} sens      'added' ou 'deducted'
 */
export function montantNet(montant, frais, sens) {
  return arrondi(sens === 'added' ? montant : montant - frais);
}

/** Montant frais compris : ce qui a quitté la poche (achat) ou l'enveloppe (vente). */
export function montantFraisCompris(tx) {
  return (tx.net_amount ?? tx.amount ?? 0) + (tx.fees_amount || 0);
}

/**
 * Frais d'un achat payés avec de l'argent apporté de l'extérieur. Un achat réglé en
 * partie avec les espèces de l'enveloppe ne porte en versement que la part des frais
 * correspondant à l'argent neuf.
 */
export function fraisDeVersement(tx) {
  if (!tx || tx.type !== 'deposit' || !tx.fees_amount) return 0;
  const net = tx.net_amount ?? tx.amount ?? 0;
  if (tx.new_funds_amount == null || net <= 0) return tx.fees_amount;
  return tx.fees_amount * Math.min(1, Math.max(0, tx.new_funds_amount / net));
}

/**
 * Ramène à la règle actuelle les mouvements « frais en plus » enregistrés avec les frais
 * comptés dans le montant investi. Sans effet sur un mouvement déjà conforme : la
 * fonction peut être appelée à chaque chargement.
 *
 * @param {Array} transactions  modifiées sur place
 * @returns {Array<{ tx: object, ecart: number }>} mouvements corrigés et frais retirés du net
 */
export function normaliserFraisAjoutes(transactions) {
  const corriges = [];
  (transactions || []).forEach((tx) => {
    if (!tx || !fraisAjoutes(tx) || tx.amount == null || tx.net_amount == null) return;
    tx.fee_direction = 'added';
    const ecart = arrondi(tx.net_amount - tx.amount);
    if (ecart <= 0) return;
    tx.net_amount = tx.amount;
    if (tx.type === 'deposit' && tx.new_funds_amount != null) {
      tx.from_cash_amount = Math.min(tx.from_cash_amount || 0, tx.net_amount);
      tx.new_funds_amount = arrondi(tx.net_amount - tx.from_cash_amount);
    }
    corriges.push({ tx, ecart });
  });
  return corriges;
}

export default fraisAjoutes;

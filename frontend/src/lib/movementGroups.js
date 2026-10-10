// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * movementGroups.js — One history line per movement, whatever the number of assets.
 *
 * A movement spread over several assets (a recurring purchase split 60/40 between two
 * funds, for instance) is recorded as one transaction per asset, all carrying the same
 * `movement_group_id`. The history shows such a movement as a single line, which can be
 * expanded to list its transactions.
 *
 * DISPLAY ONLY: nothing here feeds a computation. The transactions are untouched and
 * remain the lines the user edits or deletes.
 */

const arrondi = (x) => Math.round(x * 100) / 100;
const identiques = (valeurs) => valeurs.every((v) => v === valeurs[0]);

/**
 * @param {Array} transactions
 * @returns {Array} les transactions seules telles quelles, et, pour chaque mouvement
 *   multi-actifs, un objet de synthèse `{ id, lignes: [...], date, type, amount,
 *   fees_amount, net_amount, note, from_recurring_id, … }` à la place de ses transactions.
 *   L'ordre d'entrée est conservé (un groupe prend la place de sa première transaction).
 */
export function regrouperMouvements(transactions) {
  const parGroupe = new Map();
  (transactions || []).forEach((tx) => {
    if (!tx.movement_group_id) return;
    // Un même identifiant ne regroupe que des lignes de même date et de même sens.
    const cle = `${tx.movement_group_id}|${tx.date}|${tx.type}`;
    if (!parGroupe.has(cle)) parGroupe.set(cle, []);
    parGroupe.get(cle).push(tx);
  });

  const vus = new Set();
  const lignes = [];
  (transactions || []).forEach((tx) => {
    const cle = tx.movement_group_id ? `${tx.movement_group_id}|${tx.date}|${tx.type}` : null;
    const membres = cle ? parGroupe.get(cle) : null;
    if (!membres || membres.length < 2) { lignes.push(tx); return; }
    if (vus.has(cle)) return;
    vus.add(cle);
    const somme = (champ) => arrondi(membres.reduce((s, m) => s + (m[champ] ?? 0), 0));
    const pourcentages = membres.map((m) => m.annual_fees_type !== 'euro');
    lignes.push({
      id: `groupe:${cle}`,
      lignes: membres,
      date: tx.date,
      type: tx.type,
      amount: somme('amount'),
      fees_amount: somme('fees_amount'),
      fee_direction: tx.fee_direction,
      net_amount: arrondi(membres.reduce((s, m) => s + (m.net_amount ?? m.amount ?? 0), 0)),
      // Frais annuels : un taux n'est affiché que s'il est le même sur toutes les lignes ;
      // un montant fixe en euros, réparti entre les lignes, est additionné.
      annual_fees_type: identiques(pourcentages) && !pourcentages[0] ? 'euro' : 'percent',
      annual_fees_pct: !identiques(pourcentages) ? 0
        : (pourcentages[0]
          ? (identiques(membres.map((m) => m.annual_fees_pct || 0)) ? (tx.annual_fees_pct || 0) : 0)
          : somme('annual_fees_pct')),
      note: tx.note,
      from_recurring_id: tx.from_recurring_id || null,
      movement_group_id: tx.movement_group_id,
    });
  });
  return lignes;
}

export default regrouperMouvements;

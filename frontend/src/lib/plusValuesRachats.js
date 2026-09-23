// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * Capital gains contained in an envelope's withdrawals — the partial-withdrawal rule.
 *
 * Tax rule (life insurance; same principle for crypto-asset disposals, article 150 VH bis
 * of the French tax code, and applied here as an estimate to the other envelopes):
 *
 *     gain of the withdrawal  =  R  −  P × R / V
 *
 *   R: the withdrawn amount;
 *   V: the envelope's total value JUST BEFORE that withdrawal;
 *   P: net deposits — the money paid in, reduced by the share of capital already returned
 *      by previous withdrawals (P × R / V at each withdrawal).
 *
 * Withdrawals are therefore processed in chronological order, from the opening: a
 * withdrawal from a past year lowers P for the following ones.
 *
 * VALUE ON THE DAY OF THE WITHDRAWAL. Fructificare only knows the value at calibrations,
 * which cover the holdings; uninvested cash adds to it. We start from the calibration
 * closest to the withdrawal and bring it back to the withdrawal's date using the external
 * cash flows in between (deposits, withdrawals leaving the envelope). A sale kept as cash
 * does not change the total value: it turns securities into cash.
 * Without any calibration the value is unknown: V = P, and the estimated gain is zero.
 *
 * NO dependency on storage: a pure function, tested by scripts/test-plus-values.js.
 */
import { estRetraitImposable } from './taxableWithdrawal';

const montant = (t) => t.net_amount || t.amount || 0;
/** Argent apporté de l'extérieur par un versement (hors part payée avec les espèces). */
const apportExterieur = (t) => (t.new_funds_amount != null ? t.new_funds_amount : montant(t));
/** Un retrait fait-il sortir l'argent de l'enveloppe ? */
const sortDeLEnveloppe = (t) => t.type === 'withdrawal' && !t.keep_in_cash;

/** Espèces détenues à une date (incluse) — même définition que getPortfolios. */
function especesAu(transactions, date) {
  return transactions
    .filter(t => t.date <= date)
    .reduce((s, t) => {
      if (t.type === 'withdrawal' && t.keep_in_cash) return s + ((t.amount || 0) - (t.fees_amount || 0));
      if (t.type === 'deposit' && t.from_cash_amount) return s - (t.from_cash_amount || 0);
      return s;
    }, 0);
}

/** Flux extérieurs nets (versements − sorties) sur ]debut ; fin], dates ISO. */
function fluxExterieurs(transactions, debutExclu, finInclus, exclure) {
  return transactions
    .filter(t => t !== exclure && t.date > debutExclu && t.date <= finInclus)
    .reduce((s, t) => {
      if (t.type === 'deposit') return s + apportExterieur(t);
      if (sortDeLEnveloppe(t)) return s - montant(t);
      return s;
    }, 0);
}

/** Écart en jours entre deux dates ISO. */
const jours = (a, b) => Math.abs(new Date(a) - new Date(b)) / 86400000;

/**
 * Valeur totale de l'enveloppe juste avant le retrait `tx`, ou null si aucune
 * calibration ne permet de l'estimer.
 */
function valeurAvantRetrait(tx, transactions, calibrations) {
  if (!calibrations.length) return null;
  const cal = calibrations.reduce((best, c) =>
    (!best || jours(c.date, tx.date) < jours(best.date, tx.date) ? c : best), null);
  const valeurCal = (cal.total_value || 0) + especesAu(transactions, cal.date);

  if (cal.date < tx.date) {
    // Calibration antérieure : on ajoute les flux extérieurs survenus depuis, hors
    // ce retrait lui-même (on veut la valeur AVANT lui).
    return valeurCal + fluxExterieurs(transactions, cal.date, tx.date, tx);
  }
  // Calibration postérieure (ou le même jour) : on remonte le temps. Les versements
  // arrivés entre-temps sont retirés, les sorties d'argent — ce retrait compris — rajoutées.
  const avant = new Date(new Date(tx.date) - 86400000).toISOString().slice(0, 10);
  return valeurCal - fluxExterieurs(transactions, avant, cal.date, null);
}

/**
 * @param {object}   p
 * @param {object[]} p.transactions  transactions de l'enveloppe (toutes années)
 * @param {object[]} p.calibrations  calibrations de l'enveloppe
 * @param {string}   p.typeEnveloppe PEA, CTO, assurance_vie…
 * @param {number}   p.annee         année du rapport
 * @returns {{ gains: number, retraits: Array<{date, montant, valeur, versementsNets, gain}> }}
 */
export function plusValuesDeLAnnee({ transactions, calibrations, typeEnveloppe, annee }) {
  const txs = [...(transactions || [])]
    .filter(t => t.date && t.date <= `${annee}-12-31`)
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));
  const cals = [...(calibrations || [])].sort((a, b) => (a.date < b.date ? -1 : 1));

  let versementsNets = 0;
  let gains = 0;
  const retraits = [];

  for (const t of txs) {
    if (t.type === 'deposit') {
      versementsNets += apportExterieur(t);
      continue;
    }
    if (!estRetraitImposable(t, typeEnveloppe)) continue;

    const R = montant(t);
    const V = valeurAvantRetrait(t, txs, cals) ?? versementsNets;
    const partCapital = V > 0 ? Math.min(versementsNets, versementsNets * R / V) : 0;
    const gain = R - partCapital;
    versementsNets = Math.max(0, versementsNets - partCapital);

    if (t.date.startsWith(String(annee))) {
      gains += gain;
      retraits.push({ date: t.date, montant: R, valeur: V, versementsNets: versementsNets + partCapital, gain });
    }
  }
  // Une moins-value ne crée pas d'impôt négatif : le total annuel est plancher à zéro.
  return { gains: Math.max(0, gains), retraits };
}

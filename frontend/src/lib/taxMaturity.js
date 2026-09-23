// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * Tax maturity of an envelope.
 *
 * Two French envelopes become tax-advantaged as the contract ages:
 *   • PEA            — 5 years: income tax exemption on gains (social charges still due).
 *   • Life insurance — 8 years: a €4,600 annual allowance (€9,200 for a couple), then
 *                      income tax reduced to 7.5% up to €150k of deposits.
 *
 * Age is counted from `contract_start_date` (the contract's opening date, entered when the
 * envelope is created), consistent with `calculateTax()` in dataService and with
 * calendarService's anniversary events.
 */

/** Seuil de maturité fiscale, en années, par type d'enveloppe. */
export const TAX_MATURITY_YEARS = {
  PEA:            5,
  assurance_vie:  8,
};

/**
 * Décrit la maturité fiscale d'une enveloppe.
 *
 * @param {object} portfolio        enveloppe ({ type, contract_start_date, ... })
 * @param {Date|string} [refDate]   date de référence (défaut : aujourd'hui)
 * @returns {null|{
 *   type: string,
 *   thresholdYears: number,
 *   maturityDate: string,   // "YYYY-MM-DD" — date d'atteinte du seuil
 *   years: number,          // ancienneté révolue, en années entières
 *   isMature: boolean,      // seuil atteint à refDate
 * }}
 * Retourne null si le type n'est pas concerné ou si la date d'ouverture est
 * absente/invalide — l'appelant n'affiche alors aucun indicateur.
 */
export function getTaxMaturity(portfolio, refDate = new Date()) {
  if (!portfolio) return null;

  const thresholdYears = TAX_MATURITY_YEARS[portfolio.type];
  if (!thresholdYears) return null;

  const raw = portfolio.contract_start_date;
  if (!raw) return null;
  const start = new Date(raw);
  if (Number.isNaN(start.getTime())) return null;

  const ref = refDate instanceof Date ? refDate : new Date(refDate);
  if (Number.isNaN(ref.getTime())) return null;

  const maturity = new Date(start);
  maturity.setFullYear(start.getFullYear() + thresholdYears);

  // Ancienneté révolue : on décrémente si l'anniversaire de l'année en cours
  // n'est pas encore passé.
  let years = ref.getFullYear() - start.getFullYear();
  const anniversary = new Date(start);
  anniversary.setFullYear(start.getFullYear() + years);
  if (anniversary > ref) years -= 1;

  return {
    type:           portfolio.type,
    thresholdYears,
    maturityDate:   maturity.toISOString().slice(0, 10),
    years:          Math.max(0, years),
    isMature:       ref >= maturity,
  };
}

/**
 * Libellé court de l'avantage fiscal acquis, pour badge / infobulle / PDF.
 *
 * @param {ReturnType<typeof getTaxMaturity>} maturity
 * @param {boolean} isEn
 * @returns {{ badge: string, tooltip: string }|null}
 */
export function taxMaturityLabels(maturity, isEn) {
  if (!maturity || !maturity.isMature) return null;

  if (maturity.type === 'PEA') {
    return {
      badge: isEn ? 'Tax-free (5 yrs)' : 'Défiscalisé (5 ans)',
      tooltip: isEn
        ? `PEA opened over 5 years ago (${maturity.years} yrs): capital gains are exempt from income tax on withdrawal — social contributions still apply.`
        : `PEA ouvert depuis plus de 5 ans (${maturity.years} ans) : les plus-values sont exonérées d'impôt sur le revenu au retrait — les prélèvements sociaux restent dus.`,
    };
  }

  // assurance_vie
  return {
    badge: isEn ? 'Tax-advantaged (8 yrs)' : 'Défiscalisé (8 ans)',
    tooltip: isEn
      ? `Life-insurance policy over 8 years old (${maturity.years} yrs): €4,600 annual allowance on gains (€9,200 for a couple), then reduced 7.5% income tax up to €150,000 of premiums.`
      : `Contrat d'assurance vie de plus de 8 ans (${maturity.years} ans) : abattement annuel de 4 600 € sur les plus-values (9 200 € pour un couple), puis IR réduit à 7,5 % jusqu'à 150 000 € de versements.`,
  };
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * healthScoreService.js — Engine of the Financial Health Score v2
 *
 * This service is deliberately kept apart from gamificationService and dataService to avoid
 * circular dependencies.
 *
 * SCORE FORMULA (max 100 pts):
 *   sDiv    = 20 × (1 − HHI)                          — Diversification        [0-20]
 *   sPerf   = min(25, (r / hybridTarget) × 25)        — Performance            [0-25]
 *               hybridTarget = (2% + crash × 12%) × ageModulation (×1.10 →×0.90)
 *               → target adjusted to the RISK taken, then modulated by age
 *   sFrais  = sFraisA + sFraisB                        — Fee control            [0-20]
 *               sFraisA = max(0, 14 × (1 − TER/0.03))  — weighted annual TER
 *               sFraisB = max(0,  6 × (1 − CR/0.03))   — cumulative fee ratio
 *   sResInf = 25 × (wR × resScore + wI × ipScore)      — Resilience + Inflation [0-25]
 *               wR = clamp(age / 100, 0, 1)  (resilience weight, grows with age)
 *               wI = 1 − wR                  (inflation weight)
 *               resScore = max(0, 1 − crash × ageFactor)
 *                 ageFactor = 1× up to 40 → 2× at 65 (progressive rise)
 *   sLiq    = min(10, (lm / 3) × 10)                   — Liquidity              [0-10]
 *               lm = regulatedSavings / monthlyNetIncome (when income is filled in)
 *               capped at 5/10 when income is missing (heuristic proxy)
 *               NB: only regulated savings accounts count — PEA/life insurance excluded
 *   bonus   = 5 if (age < 35 AND r > 8%)  — Young & performing       [0-5]
 *             + 5 if (age > 65 AND resScore ≥ 0.70) — Senior & resilient (disjoint ages → ≤ 5)
 *   total   = min(100, Σ)
 *
 *   HHI = Σ(wi²) where wi = the weight of each asset class in the portfolio
 *
 * PUBLIC API:
 *   calculateHealthScore(data)         → { total, breakdown, inputs }
 *   extractHealthScoreInputs()         → inputs | null (null = missing date of birth)
 *   runHealthScoreUpdate()             → { total, breakdown, inputs } | null
 *   checkDiagnosticQuests(score, bd)   → void  (adds quests when the score is < 60)
 *   checkQuarterlyHealthBonus()        → void  (grants XP when every score of the quarter is ≥ threshold)
 */

import dataService from './dataService';
import gamificationService from './gamificationService';

// ===============================================================================
// 1. DICTIONNAIRES DE RISQUE ET DE PROTECTION PAR CLASSE D'ACTIF
// ===============================================================================

// Score de risque de crash par classe d'actif [0 = très défensif … 1 = très volatil]
const CRASH_RISK = {
  fond_euro:  0.05,
  obligation: 0.10,
  immobilier: 0.20,
  or:         0.15,
  scpi:       0.20,
  autre:      0.30,
  non_defini: 0.30,
  etf:        0.40,
  action:     0.40,
  exotique:   0.50,
  crypto:     0.80, // volatilité très élevée — corrigé (était 0,25, incohérent avec actions/ETF)
};

// Score de protection contre l'inflation [0 = aucune … 1 = forte protection]
const INFLATION_PROTECTION = {
  fond_euro:  0.10,
  obligation: 0.30,
  autre:      0.30,
  non_defini: 0.30,
  crypto:     0.20,
  scpi:       0.80,
  etf:        0.85,
  immobilier: 0.85,
  action:     0.90,
  or:         0.90,
  exotique:   0.50,
};

// Valeurs par défaut pour les types d'actifs PERSONNALISÉS (créés par l'utilisateur) et tout
// type inconnu absent des dictionnaires ci-dessus. 0,30 = profil « modéré-prudent » : au-dessus
// des obligations (0,10) mais bien en dessous des actions/ETF (0,40) et de la crypto (0,80).
// Choix délibérément CONSERVATEUR : sans information sur la nature de l'actif, on évite à la fois
// de le traiter comme sans risque (0) et comme très spéculatif ; c'est la même valeur que les
// catégories génériques « autre » et « non_defini ».
const DEFAULT_CRASH_RISK          = 0.30;
const DEFAULT_INFLATION_PROTECTION = 0.30;

// ===============================================================================
// 2. FONCTION PURE — CALCUL DU SCORE
// ===============================================================================

/**
 * Cible de rendement annuel attendue — HYBRIDE âge × risque.
 *
 * 1) Composante RISQUE (principale) : une cible « juste » pour le risque réellement pris.
 *    cibleRisque = tauxSansRisque + crashImpact × prime  (2 % → ~14 %)
 *    → un portefeuille prudent (livrets/fonds €, crash faible) est jugé à ~2-3 %, un
 *      portefeuille actions (crash ~0,4) à ~7 %, un portefeuille crypto (crash ~0,8) à ~11 %.
 *    Règle ainsi le biais « livret vs 100 % actions jugés au même étalon ».
 *
 * 2) Modulation ÂGE (secondaire) : horizon plus long chez le jeune → on vise un peu plus
 *    haut (×1,10 ≤30 ans) ; exigence assouplie avec l'âge (×0,90 ≥65 ans).
 *
 * Bornée à [2 % ; 15 %] par sécurité.
 *
 * @param {number} age          — âge en années
 * @param {number} crashImpact  — exposition pondérée au risque de crash [0-1]
 * @returns {number} cible en décimal (ex : 0.06 = 6 %/an)
 */
function _performanceTarget(age, crashImpact) {
  const RISK_FREE = 0.02;   // socle : rémunération sans risque
  const PREMIUM   = 0.12;   // prime de risque maximale (crash = 1 → +12 %)
  const crash     = Math.min(1, Math.max(0, crashImpact || 0));
  const riskTarget = RISK_FREE + crash * PREMIUM;                       // 2 %..14 %
  const ageMod     = 1.10 - 0.20 * Math.min(1, Math.max(0, (age - 30) / (65 - 30))); // 1,10..0,90
  return Math.max(0.02, Math.min(0.15, riskTarget * ageMod));
}

/**
 * Facteur d'amplification du risque de crash selon l'âge, appliqué à resScore.
 * Plat (1×) jusqu'à 40 ans (le jeune a le temps de se refaire), puis montée
 * PROGRESSIVE jusqu'à 2× à 65 ans (et plafonné au-delà). Remplace l'ancien
 * facteur âge/20, trop punitif (résilience nulle dès ~45-50 ans en actions).
 * @param {number} age
 * @returns {number} facteur ∈ [1, 2]
 */
function _resilienceAgeFactor(age) {
  return 1 + Math.min(1, Math.max(0, (age - 40) / (65 - 40)));
}

/**
 * Calcule le score de santé financière à partir des inputs normalisés.
 *
 * @param {object} data
 * @param {number} data.age                 — âge en années (décimal)
 * @param {number} data.annualReturn        — rendement annuel net (ex : 0.07 = 7 %)
 * @param {number} data.weightedTer         — TER annuel pondéré [0-1] (ex : 0.01 = 1 %)
 * @param {number} data.totalFeesRate       — ratio frais cumulés / valeur portefeuille [0-1]
 * @param {number} data.hhi                 — indice HHI [0-1], 1 = concentration totale
 * @param {number} data.crashImpact         — exposition pondérée aux actifs volatils [0-1]
 * @param {number} data.inflationProtection — protection pondérée contre l'inflation [0-1]
 * @param {number} data.liquidityMonths     — mois de dépenses couverts par les actifs liquides
 * @param {boolean} data.liquidityIncomeKnown — true si monthlyNetIncome est renseigné
 *
 * @returns {{ total: number, breakdown: object, inputs: object }}
 */
function calculateHealthScore(data) {
  const {
    age,
    annualReturn,
    weightedTer,
    totalFeesRate,
    hhi,
    crashImpact,
    inflationProtection,
    liquidityMonths,
    liquidityIncomeKnown,
  } = data;

  // Clamp des inputs pour éviter les valeurs aberrantes
  const safeAge   = Math.max(0,  Math.min(120, age    || 0));
  const safeReturn= Math.max(-1, Math.min(1,   annualReturn || 0));
  const safeTer   = Math.max(0,  Math.min(1,   weightedTer  || 0));
  const safeCR    = Math.max(0,  Math.min(1,   totalFeesRate|| 0));
  const safeHhi   = Math.max(0,  Math.min(1,   hhi          || 1));
  const safeCrash = Math.max(0,  Math.min(1,   crashImpact  || 0));
  const safeInfP  = Math.max(0,  Math.min(1,   inflationProtection || 0));
  const safeLiq   = Math.max(0,  Math.min(24,  liquidityMonths || 0));

  // sDiv [0-20] — diversification via HHI
  const sDiv = 20 * (1 - safeHhi);

  // sPerf [0-25] — rendement annuel vs cible HYBRIDE (risque du portefeuille × âge)
  const perfTarget = _performanceTarget(safeAge, safeCrash);
  const sPerf = Math.min(25, (safeReturn / perfTarget) * 25);

  // sFrais [0-20] — hybride TER + frais cumulés
  // sFraisA : TER pondéré annuel (14 pts) — 0 % = 14, >= 3 % = 0
  const sFraisA = Math.max(0, 14 * (1 - safeTer / 0.03));
  // sFraisB : ratio frais cumulés / valeur (6 pts) — 0 % = 6, >= 3 % = 0
  const sFraisB = Math.max(0, 6 * (1 - safeCR / 0.03));
  const sFrais  = sFraisA + sFraisB;

  // sResInf [0-25] — résilience & protection inflation combinées, dynamiques selon l'âge
  // wR = âge/100 : à 30 ans → 30 % résilience / 70 % inflation ; à 60 ans → 60/40
  const wR = Math.min(1, Math.max(0, safeAge / 100));
  const wI = 1 - wR;
  // resScore : pénalité de crash amplifiée PROGRESSIVEMENT avec l'âge (facteur 1×→2×
  // entre 40 et 65 ans), au lieu de l'ancien âge/20 qui annulait la résilience dès ~45 ans.
  const resScore = Math.max(0, 1 - safeCrash * _resilienceAgeFactor(safeAge));
  const ipScore  = safeInfP;
  const sResInf  = 25 * (wR * resScore + wI * ipScore);

  // sLiq [0-10] ou [0-5] si revenu mensuel non renseigné
  // Cible : 3 mois de revenu = score maximum
  const liqCap = liquidityIncomeKnown ? 10 : 5;
  const sLiq   = Math.min(liqCap, (safeLiq / 3) * 10);

  // Bonus [0-5] — deux bonus symétriques et mutuellement exclusifs (âges disjoints) :
  //  • Jeune & performant  : < 35 ans ET rendement > 8 %/an  (récompense la prise de risque
  //    productive quand l'horizon est long).
  //  • Sénior & résilient  : > 65 ans ET resScore ≥ 0,70     (récompense le dé-risquage réussi
  //    à l'approche/pendant la retraite : portefeuille peu exposé aux krachs).
  const bonusYoung  = (safeAge < 35 && safeReturn > 0.08) ? 5 : 0;
  const bonusSenior = (safeAge > 65 && resScore >= 0.70)  ? 5 : 0;
  const bonus = bonusYoung + bonusSenior; // âges disjoints → au plus 5

  const rawTotal = sDiv + sPerf + sFrais + sResInf + sLiq + bonus;
  const total    = Math.min(100, Math.max(0, Math.round(rawTotal)));

  const breakdown = {
    sDiv:    Math.round(sDiv    * 10) / 10,
    sPerf:   Math.round(sPerf   * 10) / 10,
    perfTarget: Math.round(perfTarget * 10000) / 100, // cible de rendement (%) — hybride risque × âge

    sFrais:  Math.round(sFrais  * 10) / 10,
    sFraisA: Math.round(sFraisA * 10) / 10,
    sFraisB: Math.round(sFraisB * 10) / 10,
    sResInf: Math.round(sResInf * 10) / 10,
    sLiq:    Math.round(sLiq    * 10) / 10,
    bonus,
    bonusYoung,  // +5 si jeune & performant (permet à l'UI d'afficher le bon libellé)
    bonusSenior, // +5 si sénior & résilient
  };

  return { total, breakdown, inputs: { ...data, perfTarget } };
}

// ===============================================================================
// 3. EXTRACTION DES INPUTS DEPUIS LES DONNÉES RÉELLES
// ===============================================================================

/**
 * Estime le nombre d'années depuis la plus ancienne transaction.
 * @returns {number} — au moins 0.5
 */
function _estimateHoldingYears() {
  const data = dataService.getData();
  // Exclure les comptes réglementés : leur ancienneté ne doit pas allonger l'horizon
  // d'investissement (ce qui écraserait le CAGR des enveloppes réellement investies).
  const regulatedIds = new Set(
    (data.portfolios || []).filter(p => p.type === 'compte_réglementé').map(p => p.id)
  );
  const txns = (data.transactions || []).filter(t => !regulatedIds.has(t.portfolio_id));
  if (txns.length === 0) return 1;
  const earliest  = txns.map(t => t.date).sort()[0];
  const msPerYear = 365.25 * 24 * 3600 * 1000;
  return Math.max(0.5, (Date.now() - new Date(earliest).getTime()) / msPerYear);
}

/**
 * Extrait les inputs du score depuis les données réelles de l'application.
 *
 * @returns {object|null} — null si la date de naissance n'est pas renseignée
 */
function extractHealthScoreInputs() {
  // -- age -----------------------------------------------------------------------
  const profile   = gamificationService.getState().profile;
  const birthDate = profile.birthDate; // camelCase dans le state
  if (!birthDate) return null; // silencieux — popup déclenchée côté UI

  const msPerYear = 365.25 * 24 * 3600 * 1000;
  const age = (Date.now() - new Date(birthDate).getTime()) / msPerYear;
  if (age < 0 || isNaN(age)) return null;

  // -- rendement annuel (CAGR) ---------------------------------------------------
  // Les comptes réglementés (Livret A, LDDS, LEP…) ne sont pas des investissements :
  // leur rendement nul ou quasi-nul diluerait le CAGR global vers le bas.
  const allPortfolios        = dataService.getPortfolios();
  const investmentPortfolios = allPortfolios.filter(p => p.type !== 'compte_réglementé');
  const globalYield          = dataService.computeGlobalYield(investmentPortfolios);
  let annualReturn = 0;
  let totalYield   = 0;   // rendement total brut pour l'affichage dans le modal
  const holdingYears = _estimateHoldingYears();
  if (globalYield && globalYield.totalInvested > 0) {
    totalYield = globalYield.yieldPct / 100; // ex : 0.0569 pour 5,69 % (affichage)
    if (globalYield.xirrPct != null) {
      // Rendement DÉJÀ annualisé proprement (Dietz modifiée, pondéré par la valeur,
      // livrets exclus) : on l'utilise directement, sans ré-annualiser le cumulé.
      annualReturn = globalYield.xirrPct / 100;
    } else if (holdingYears < 1) {
      // Repli (pas de calibration exploitable) : <1 an → pas d'annualisation.
      annualReturn = totalYield;
    } else if (totalYield > -1) {
      // Repli : CAGR à partir du rendement cumulé.
      annualReturn = Math.pow(1 + totalYield, 1 / holdingYears) - 1;
    } else {
      annualReturn = totalYield / holdingYears;
    }
    annualReturn = Math.max(-1, Math.min(0.5, annualReturn));
  }

  // -- HHI (diversification) -----------------------------------------------------
  const assetStats   = dataService.getAssetTypeStats();
  const totalBalance = Object.values(assetStats).reduce(
    (s, v) => s + Math.max(0, v.balance), 0
  );
  let hhi = 1; // concentration maximale si aucune donnée
  if (totalBalance > 0) {
    hhi = Object.values(assetStats).reduce((s, v) => {
      const w = Math.max(0, v.balance) / totalBalance;
      return s + w * w;
    }, 0);
  }

  // -- TER pondéré et frais cumulés ----------------------------------------------
  // allPortfolios déjà récupéré plus haut (inclut les comptes réglementés pour
  // les calculs de frais et de liquidité)
  const portfolios = allPortfolios;
  const totalValue = portfolios.reduce((s, p) => s + Math.max(0, p.balance || 0), 0);

  // TER pondéré annuel = (somme des frais annuels €/an) / valeur totale.
  // Selon le mode de frais annuels de l'enveloppe :
  //   • 'percent' → montant = balance × annual_fees_pct/100
  //   • 'euro'    → annual_fees_pct est un montant fixe €/an (à ne PAS traiter comme un %)
  const terNumerator = portfolios.reduce((s, p) => {
    const bal = Math.max(0, p.balance || 0);
    const annualFee = p.annual_fees_type === 'euro'
      ? (parseFloat(p.annual_fees_pct) || 0)          // €/an fixe
      : bal * ((p.annual_fees_pct || 0) / 100);        // %/an
    return s + annualFee;
  }, 0);
  const weightedTer = totalValue > 0 ? terNumerator / totalValue : 0;

  // Frais cumulés réels / valeur — TOUS les frais prélevés depuis l'origine :
  // frais de transaction (versement/retrait) + frais annuels de gestion accumulés (enveloppe
  // et transaction). sFraisA (TER) mesure le TAUX en cours ; sFraisB mesure le POIDS cumulé
  // réellement payé — deux angles complémentaires, l'overlap est assumé (choix produit).
  const totalFeesAccum = portfolios.reduce((s, p) => s + (p.total_fees ?? 0), 0);
  const totalFeesRate  = totalValue > 0 ? totalFeesAccum / totalValue : 0;

  // -- crash impact (volatilité pondérée par classe d'actif) ---------------------
  let crashImpact = 0;
  if (totalBalance > 0) {
    crashImpact = Object.entries(assetStats).reduce((s, [type, v]) => {
      const w    = Math.max(0, v.balance) / totalBalance;
      const risk = CRASH_RISK[type] ?? DEFAULT_CRASH_RISK;
      return s + w * risk;
    }, 0);
  }

  // -- protection contre l'inflation (pondérée par classe d'actif) --------------
  let inflationProtection = 0;
  if (totalBalance > 0) {
    inflationProtection = Object.entries(assetStats).reduce((s, [type, v]) => {
      const w    = Math.max(0, v.balance) / totalBalance;
      const prot = INFLATION_PROTECTION[type] ?? DEFAULT_INFLATION_PROTECTION;
      return s + w * prot;
    }, 0);
  }

  // -- liquidité (épargne réglementée uniquement — PEA / AV exclus) --------------
  // Seuls les comptes de type 'compte_réglementé' (Livret A, LDDS, LEP…) sont
  // des réserves de précaution réellement liquides et sans risque de perte.
  // Les fonds euros d'AV et les poches espèces des enveloppes d'investissement
  // ne sont PAS comptabilisés ici pour éviter un score artificiellement élevé.
  const monthlyNetIncome  = profile.monthlyNetIncome || 0;
  const regulatedSavings  = portfolios
    .filter(p => p.type === 'compte_réglementé')
    .reduce((s, p) => s + Math.max(0, p.balance || 0), 0);

  let liquidityMonths;
  let liquidityIncomeKnown;
  if (monthlyNetIncome > 0) {
    // Calcul précis : mois couverts par les livrets réglementés vs revenu net
    liquidityMonths      = Math.min(24, regulatedSavings / monthlyNetIncome);
    liquidityIncomeKnown = true;
  } else {
    // Proxy sans salaire : 1 000 € = 1 mois proxy
    // → avec la formule (lm/3)×10 et plafond 5 : 0 € → 0, 1 500 € → 5/10
    liquidityMonths      = regulatedSavings / 1000;
    liquidityIncomeKnown = false;
  }

  return {
    age,
    annualReturn,
    totalYield,             // rendement total brut (non annualisé) pour l'affichage
    holdingYears,           // durée estimée en années depuis la 1re transaction
    weightedTer,
    totalFeesRate,
    hhi,
    crashImpact,
    inflationProtection,
    regulatedSavings,       // montant brut en € — affiché dans le modal sLiq
    liquidityMonths,
    liquidityIncomeKnown,
  };
}

// ===============================================================================
// 4. MISE À JOUR DU SCORE DANS L'ÉTAT
// ===============================================================================

/**
 * Calcule et persiste le score de santé du jour.
 * Silencieux si la date de naissance est absente (retourne null).
 *
 * @returns {{ total, breakdown, inputs } | null}
 */
function runHealthScoreUpdate() {
  const inputs = extractHealthScoreInputs();
  if (!inputs) return null;

  const result = calculateHealthScore(inputs);
  const nowISO = new Date().toISOString();
  const today  = nowISO.split('T')[0];

  const state   = gamificationService.getState();
  const history = Array.isArray(state.healthScore?.history)
    ? [...state.healthScore.history]
    : [];

  // Remplacer l'entrée du jour si elle existe déjà
  const filtered = history.filter(h => h.date !== today);
  filtered.push({ date: today, score: result.total, breakdown: result.breakdown });

  // Fenêtre glissante de 365 jours
  const trimmed = filtered.slice(-365);

  gamificationService.patchState({
    healthScore: {
      ...state.healthScore,
      current:     result.total,
      breakdown:   result.breakdown,
      inputs:      result.inputs,
      lastUpdated: nowISO,
      history:     trimmed,
    },
  });

  checkDiagnosticQuests(result.total, result.breakdown);

  return result;
}

// ===============================================================================
// 5. QUÊTES DIAGNOSTIQUES
// ===============================================================================

/**
 * Si le score est inférieur à 60, identifie les 2 composantes les plus faibles
 * et les enregistre dans `activeDiagnosticQuests`.
 *
 * @param {number} score
 * @param {object} breakdown
 */
function checkDiagnosticQuests(score, breakdown) {
  if (score >= 60) {
    gamificationService.patchState({ activeDiagnosticQuests: [] });
    return;
  }

  const components = [
    { key: 'sDiv',    label: 'Diversification',         max: 20, value: breakdown.sDiv    || 0 },
    { key: 'sPerf',   label: 'Performance',              max: 25, value: breakdown.sPerf   || 0 },
    { key: 'sFrais',  label: 'Réduction des frais',      max: 20, value: breakdown.sFrais  || 0 },
    { key: 'sResInf', label: 'Résilience & Inflation',   max: 25, value: breakdown.sResInf || 0 },
    { key: 'sLiq',    label: "Liquidité d'urgence",      max: 10, value: breakdown.sLiq    || 0 },
  ];

  // Trier par ratio valeur/max croissant → les 2 premiers sont les plus faibles
  const sorted   = [...components].sort((a, b) => (a.value / a.max) - (b.value / b.max));
  const weakest2 = sorted.slice(0, 2);

  const triggeredAt = new Date().toISOString();
  gamificationService.patchState({
    activeDiagnosticQuests: weakest2.map(c => ({
      component:   c.key,
      label:       c.label,
      score:       c.value,
      maxScore:    c.max,
      pct:         Math.round((c.value / c.max) * 100),
      triggeredAt,
      dismissed:   false,
    })),
  });
}

// ===============================================================================
// 6. BONUS TRIMESTRIEL
// ===============================================================================

/**
 * Vérifie si l'utilisateur mérite un bonus XP pour le trimestre écoulé.
 * Seuils :
 *   score min >= 85 tout le trimestre → 100 XP
 *   score min >= 75 tout le trimestre →  50 XP
 *   score min >= 60 tout le trimestre →  30 XP
 */
function checkQuarterlyHealthBonus() {
  const state   = gamificationService.getState();
  const history = state.healthScore?.history || [];
  if (history.length === 0) return;

  const today   = new Date();
  const quarter = Math.ceil((today.getMonth() + 1) / 3);
  const currentKey = `${today.getFullYear()}-Q${quarter}`;

  if (state.healthScore?.lastQuarterlyBonusKey === currentKey) return;

  const qStartMonth = (quarter - 1) * 3; // 0-indexed (Jan=0)
  const qStart      = new Date(today.getFullYear(), qStartMonth, 1);

  const qHistory = history.filter(h => new Date(h.date) >= qStart);
  if (qHistory.length < 4) return;

  const minScore = Math.min(...qHistory.map(h => h.score));

  let xp     = 0;
  let reason = '';
  if      (minScore >= 85) { xp = 100; reason = `quarterly_health_bonus_85_${currentKey}`; }
  else if (minScore >= 75) { xp =  50; reason = `quarterly_health_bonus_75_${currentKey}`; }
  else if (minScore >= 60) { xp =  30; reason = `quarterly_health_bonus_60_${currentKey}`; }

  if (xp > 0) {
    gamificationService.notifyProgress(reason);
    gamificationService.patchState({
      healthScore: {
        ...gamificationService.getState().healthScore,
        lastQuarterlyBonusKey: currentKey,
      },
    });
  }
}

// ===============================================================================
// 7. RECALCUL DIFFÉRÉ — appelé depuis dataService après chaque mutation
// ===============================================================================

let _refreshTimer = null;

/**
 * Planifie un recalcul du score de santé dans 300 ms (debounce).
 * Si appelé plusieurs fois en rafale, seule la dernière exécution compte.
 * Émet l'événement `healthScoreUpdated` pour rafraîchir l'UI.
 */
function scheduleRefresh() {
  clearTimeout(_refreshTimer);
  _refreshTimer = setTimeout(() => {
    try {
      const result = runHealthScoreUpdate();
      if (result !== null) {
        gamificationService.dispatchEvent('healthScoreUpdated', { total: result.total });
      }
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[healthScore] scheduleRefresh error:', e);
      }
    }
  }, 300);
}

// ===============================================================================
// EXPORT
// ===============================================================================

const healthScoreService = {
  calculateHealthScore,
  extractHealthScoreInputs,
  runHealthScoreUpdate,
  scheduleRefresh,
  checkDiagnosticQuests,
  checkQuarterlyHealthBonus,
};

export default healthScoreService;

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * HealthScoreHelpModal.jsx
 *
 * Contextual help panel for one component of the financial health score.
 * Shown as a Dialog when the user clicks one of the 5 rows of the breakdown.
 *
 * Props:
 *   componentKey  {string|null}  — component key ('sDiv', 'sPerf', …), null = closed
 *   score         {number|null}  — the component's score
 *   inputs        {object|null}  — raw inputs from extractHealthScoreInputs()
 *   lang          {'fr'|'en'}
 *   onClose       {() => void}
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { X, TrendingUp, AlertTriangle } from "lucide-react";

// ===============================================================================
// 1. DONNÉES PAR COMPOSANTE
// ===============================================================================

const COMPONENT_META = {
  sDiv: {
    max:     20,
    color:   '#8B5CF6',
    labelFr: 'Diversification',
    labelEn: 'Diversification',
    explanationFr:
      "Ce score mesure à quel point votre capital est réparti entre différents actifs. " +
      "Il utilise l'Indice de Herfindahl-Hirschman (HHI) : plus votre capital est concentré " +
      "sur un seul actif, plus le score est faible. " +
      "Un portefeuille parfaitement diversifié obtiendrait 20/20.",
    explanationEn:
      "This score measures how well your capital is spread across different assets. " +
      "It uses the Herfindahl-Hirschman Index (HHI): the more your capital is concentrated " +
      "in a single asset, the lower the score. " +
      "A perfectly diversified portfolio would score 20/20.",
    situationFr: (inp) =>
      `HHI calculé : ${(inp?.hhi ?? 0).toFixed(3)} (0 = parfait, 1 = concentré)`,
    situationEn: (inp) =>
      `Calculated HHI: ${(inp?.hhi ?? 0).toFixed(3)} (0 = perfect, 1 = concentrated)`,
    tipsFr: [
      "Ajoutez une nouvelle classe d'actifs (obligations, immobilier, or) pour réduire la concentration de votre portefeuille.",
    ],
    tipsEn: [
      "Add a new asset class (bonds, real estate, gold) to reduce portfolio concentration.",
    ],
  },

  sPerf: {
    max:     25,
    color:   '#10B981',
    labelFr: 'Performance',
    labelEn: 'Performance',
    explanationFr:
      "Ce score compare le rendement annuel net de votre portefeuille à une cible " +
      "personnalisée, ajustée au RISQUE que vous prenez réellement (un portefeuille prudent " +
      "est jugé sur une cible basse, un portefeuille actions sur une cible plus élevée) puis " +
      "modulée selon votre âge (horizon plus long = cible un peu plus haute). Atteindre votre " +
      "cible donne le score maximum de 25/25.",
    explanationEn:
      "This score compares your portfolio's net annual return to a personalised target, " +
      "adjusted to the RISK you actually take (a cautious portfolio is judged against a low " +
      "target, an equity portfolio against a higher one) then modulated by your age (longer " +
      "horizon = slightly higher target). Reaching your target yields the maximum score of 25/25.",
    situationFr: (inp) => {
      const totalPct   = (inp?.totalYield   ?? 0) * 100;
      const annPct     = (inp?.annualReturn  ?? 0) * 100;
      const targetPct  = inp?.perfTarget ?? null; // déjà en %
      const years      = inp?.holdingYears  ?? 0;
      const sign       = totalPct >= 0 ? '+' : '';
      return (
        `Rendement total depuis l'origine : ${sign}${totalPct.toFixed(1)} %\n` +
        `Rendement annualisé (Dietz modifiée) : ${annPct.toFixed(1)} %/an\n` +
        (targetPct != null ? `Votre cible personnalisée (risque × âge) : ${targetPct.toFixed(1)} %/an\n` : '') +
        `Durée d'investissement : ${years.toFixed(1)} an${years >= 2 ? 's' : ''}\n` +
        'Note : la cible s\'adapte au risque réel de votre portefeuille — un profil prudent n\'est pas jugé comme un profil actions.'
      );
    },
    situationEn: (inp) => {
      const totalPct   = (inp?.totalYield   ?? 0) * 100;
      const annPct     = (inp?.annualReturn  ?? 0) * 100;
      const targetPct  = inp?.perfTarget ?? null;
      const years      = inp?.holdingYears  ?? 0;
      const sign       = totalPct >= 0 ? '+' : '';
      return (
        `Total return since inception: ${sign}${totalPct.toFixed(1)} %\n` +
        `Annualised return (Modified Dietz): ${annPct.toFixed(1)} %/year\n` +
        (targetPct != null ? `Your personalised target (risk × age): ${targetPct.toFixed(1)} %/year\n` : '') +
        `Investing period: ${years.toFixed(1)} year${years >= 2 ? 's' : ''}\n` +
        'Note: the target adapts to your portfolio\'s actual risk — a cautious profile is not judged like an equity one.'
      );
    },
    tipsFr: [
      "Vérifiez si vos actifs sous-performent leur benchmark.",
      "Un rendement faible peut indiquer des frais trop élevés — vérifiez la composante « Maîtrise des frais ».",
      "Laissez suffisamment de temps à vos placements : les rendements annuels se lissent généralement sur plusieurs années. Un calcul sur moins de 3 ans peut être trompeur.",
    ],
    tipsEn: [
      "Check whether your assets are underperforming their benchmark.",
      "A low return may indicate high fees — check the « Fee Control » component.",
      "Give your investments enough time: annual returns typically smooth out over several years. A calculation over less than 3 years can be misleading.",
    ],
  },

  sFrais: {
    max:     20,
    color:   '#F59E0B',
    labelFr: 'Maîtrise des frais',
    labelEn: 'Fee Control',
    explanationFr:
      "Ce score combine deux mesures complémentaires :\n" +
      "• 70 % (14 pts) — TER annuel moyen pondéré : la moyenne des frais annuels de chaque enveloppe, pondérée par le montant total investi dans chaque enveloppe. Les enveloppes les plus importantes pèsent donc plus lourd dans ce calcul. Score maximum (14/14) si le TER moyen est de 0 %. Score nul si le TER dépasse 3 %.\n" +
      "• 30 % (6 pts) — Ratio frais cumulés : total de TOUS les frais prélevés depuis l'origine (frais de transaction + frais annuels de gestion) divisé par la valeur actuelle du portefeuille. Mesure le poids historique réel des frais. Score maximum (6/6) si ce ratio est de 0 %. Score nul si le ratio dépasse 3 %.",
    explanationEn:
      "This score combines two complementary measures:\n" +
      "• 70% (14 pts) — Weighted average annual TER: the average annual fees per envelope, weighted by total amount invested. Larger envelopes carry more weight. Maximum score (14/14) if average TER is 0%. Zero if TER exceeds 3%.\n" +
      "• 30% (6 pts) — Cumulative fee ratio: ALL fees charged since inception (transaction fees + annual management fees) divided by current portfolio value. Measures the real historical weight of fees. Maximum score (6/6) if ratio is 0%. Zero if ratio exceeds 3%.",
    situationFr: (inp) =>
      `TER annuel pondéré : ${((inp?.weightedTer ?? 0) * 100).toFixed(2)} %\nRatio frais cumulés : ${((inp?.totalFeesRate ?? 0) * 100).toFixed(2)} %`,
    situationEn: (inp) =>
      `Weighted annual TER: ${((inp?.weightedTer ?? 0) * 100).toFixed(2)} %\nCumulative fee ratio: ${((inp?.totalFeesRate ?? 0) * 100).toFixed(2)} %`,
    tipsFr: [
      "Privilégiez les ETF à réplication physique (TER souvent < 0,3 %) aux fonds gérés activement (TER souvent > 1,5 %).",
      "Vérifiez les frais de courtage de votre courtier : certains facturent des droits de garde.",
      "Un TER > 1 % par an est considéré élevé pour un investissement passif long terme.",
    ],
    tipsEn: [
      "Prefer physically replicated ETFs (TER often < 0.3%) over actively managed funds (TER often > 1.5%).",
      "Check your broker's trading fees: some charge custody fees.",
      "A TER > 1% per year is considered high for long-term passive investing.",
    ],
  },

  sResInf: {
    max:     25,
    color:   '#3B82F6',
    labelFr: 'Résilience & Inflation',
    labelEn: 'Resilience & Inflation',
    // Functions receive `inputs` so the age-dependent sentence can be rendered.
    explanationFr: (inp) => {
      const wR  = Math.min(1, Math.max(0, (inp?.age || 0) / 100));
      const wI  = 1 - wR;
      const age = Math.floor(inp?.age || 0);
      const ageFactor = 1 + Math.min(1, Math.max(0, ((inp?.age || 0) - 40) / 25));
      return (
        "Ce score combine la résistance aux krachs et la protection contre l'inflation, " +
        "avec une pondération qui évolue automatiquement selon votre âge :\n" +
        "• Plus vous êtes jeune, plus la protection contre l'inflation est prioritaire " +
        "(vous avez le temps de traverser des baisses mais l'inflation érode votre capital sur le long terme).\n" +
        "• Plus vous approchez de la retraite, plus la résistance aux krachs est prioritaire " +
        "(votre horizon de retrait est proche).\n\n" +
        `À ${age} ans, votre score pondère à ${(wR * 100).toFixed(0)} % la résilience et à ${(wI * 100).toFixed(0)} % l'inflation.\n\n` +
        "De plus, la pénalité liée au risque de krach est amplifiée progressivement avec l'âge : " +
        `× 1 jusqu'à 40 ans, puis montée linéaire jusqu'à × 2 à 65 ans (plafonnée ensuite). À votre âge, ce facteur vaut × ${ageFactor.toFixed(2)} : ` +
        "un portefeuille volatil pèse donc plus lourd sur la résilience à l'approche de la retraite, mais sans chute brutale à 0."
      );
    },
    explanationEn: (inp) => {
      const wR  = Math.min(1, Math.max(0, (inp?.age || 0) / 100));
      const wI  = 1 - wR;
      const age = Math.floor(inp?.age || 0);
      const ageFactor = 1 + Math.min(1, Math.max(0, ((inp?.age || 0) - 40) / 25));
      return (
        "This score combines crash resistance and inflation protection, with a weighting " +
        "that automatically adjusts to your age:\n" +
        "• The younger you are, the more inflation protection is prioritised (you have " +
        "time to recover from downturns, but inflation erodes your capital over the long term).\n" +
        "• The closer you are to retirement, the more crash resistance is prioritised " +
        "(your withdrawal horizon is near).\n\n" +
        `At ${age} years old, your score weights resilience at ${(wR * 100).toFixed(0)}% and inflation at ${(wI * 100).toFixed(0)}%.\n\n` +
        "In addition, the crash-risk penalty ramps up gradually with age: " +
        `×1 until 40, then linearly up to ×2 at 65 (capped afterwards). At your age this factor is ×${ageFactor.toFixed(2)}: ` +
        "a volatile portfolio therefore weighs more on resilience as retirement nears, but without collapsing abruptly to 0."
      );
    },
    situationFr: (inp) => {
      const wR  = Math.min(1, Math.max(0, (inp?.age || 0) / 100));
      const wI  = 1 - wR;
      const age = Math.floor(inp?.age || 0);
      return (
        `Exposition au risque de krach : ${((inp?.crashImpact ?? 0) * 100).toFixed(0)} %\n` +
        `Protection contre l'inflation : ${((inp?.inflationProtection ?? 0) * 100).toFixed(0)} %\n` +
        `Âge : ${age} ans → poids résilience ${(wR * 100).toFixed(0)} % / poids inflation ${(wI * 100).toFixed(0)} %`
      );
    },
    situationEn: (inp) => {
      const wR  = Math.min(1, Math.max(0, (inp?.age || 0) / 100));
      const wI  = 1 - wR;
      const age = Math.floor(inp?.age || 0);
      return (
        `Crash risk exposure: ${((inp?.crashImpact ?? 0) * 100).toFixed(0)} %\n` +
        `Inflation protection: ${((inp?.inflationProtection ?? 0) * 100).toFixed(0)} %\n` +
        `Age: ${age} yrs → resilience weight ${(wR * 100).toFixed(0)}% / inflation weight ${(wI * 100).toFixed(0)}%`
      );
    },
    tipsFr: [
      "Ajoutez des obligations ou un fonds euros pour amortir les krachs à mesure que vous approchez de la retraite.",
      "L'or et les actions sont les meilleurs actifs pour protéger votre capital de l'inflation sur le long terme.",
      "Un fonds immobilier (SCPI) combine bonne protection inflation et risque de krach modéré.",
    ],
    tipsEn: [
      "Add bonds or a euro fund to cushion market crashes as you approach retirement.",
      "Gold and equities are the best assets to protect your capital from inflation over the long term.",
      "A real estate fund (SCPI/REIT) combines good inflation protection with moderate crash risk.",
    ],
  },

  sLiq: {
    max:     10,
    color:   '#06B6D4',
    labelFr: 'Liquidité',
    labelEn: 'Liquidity',
    explanationFr:
      "Ce score mesure si votre épargne de précaution sur livrets réglementés " +
      "(Livret A, LDDS, LEP) couvre au moins 3 mois de votre salaire mensuel net.\n" +
      "• Score maximum (10/10) : épargne réglementée ≥ 3 × salaire mensuel.\n" +
      "• Dégression linéaire : score = (épargne / (3 × salaire)) × 10.\n" +
      "• Si votre salaire n'est pas renseigné dans les Paramètres, un score approximatif est calculé mais limité à 5/10.",
    explanationEn:
      "This score measures whether your emergency savings in regulated accounts " +
      "(Livret A, LDDS, LEP) cover at least 3 months of your monthly net income.\n" +
      "• Maximum score (10/10): regulated savings ≥ 3 × monthly income.\n" +
      "• Linear decrease: score = (savings / (3 × income)) × 10.\n" +
      "• If your income is not entered in Settings, an approximate score is calculated but capped at 5/10.",
    situationFr: (inp) => {
      if (!inp?.liquidityIncomeKnown) {
        return (
          "Salaire non renseigné — score approximatif (max 5/10).\n" +
          "→ Renseignez votre salaire dans Paramètres → Données de l'utilisateur pour un calcul précis."
        );
      }
      return (
        `Épargne de précaution : ${(inp?.liquidityMonths ?? 0).toFixed(1)} mois de revenu net\n` +
        "Cible recommandée : 3 mois de revenu"
      );
    },
    situationEn: (inp) => {
      if (!inp?.liquidityIncomeKnown) {
        return (
          "Income not entered — approximate score (max 5/10).\n" +
          "→ Enter your income in Settings → User Data for a precise calculation."
        );
      }
      return (
        `Emergency savings: ${(inp?.liquidityMonths ?? 0).toFixed(1)} months of net income\n` +
        "Recommended target: 3 months of income"
      );
    },
    tipsFr: [
      "Renseignez votre revenu mensuel net dans les Paramètres pour activer le calcul précis de ce score.",
      "Alimentez votre Livret A, LDDS ou LEP jusqu'à atteindre l'équivalent de 3 mois de salaire.",
      "L'épargne de précaution doit rester disponible immédiatement — ne pas l'investir dans des placements bloqués.",
    ],
    tipsEn: [
      "Enter your monthly net income in Settings to activate the precise calculation of this score.",
      "Top up your Livret A, LDDS, or LEP savings account to reach the equivalent of 3 months of salary.",
      "Emergency savings must remain immediately accessible — do not invest them in locked or illiquid products.",
    ],
  },
};

// ===============================================================================
// 2. COMPOSANT PRINCIPAL
// ===============================================================================

export default function HealthScoreHelpModal({ componentKey, score, inputs, lang = 'fr', onClose }) {
  const open = !!componentKey && !!COMPONENT_META[componentKey];
  const meta = COMPONENT_META[componentKey] || null;

  if (!meta) return null;

  const isFr  = lang !== 'en';
  const label = isFr ? meta.labelFr : meta.labelEn;
  const pct   = score != null ? (score / meta.max) * 100 : 0;
  const showTips = score != null && pct < 80;

  // Explanation: peut être une string statique ou une fonction (inp) => string
  const explanation = (() => {
    const raw = isFr ? meta.explanationFr : meta.explanationEn;
    return typeof raw === 'function' ? raw(inputs) : raw;
  })();

  const situation = inputs
    ? (isFr ? meta.situationFr(inputs) : meta.situationEn(inputs))
    : null;

  const tips = isFr ? meta.tipsFr : meta.tipsEn;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: meta.color }}>
            <span
              className="inline-block w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: meta.color }}
            />
            {label}
            {score != null && (
              <span className="text-sm font-normal text-muted-foreground ml-1">
                — {score.toFixed(1)} / {meta.max}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">

          {/* ── Barre de score ── */}
          {score != null && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{isFr ? 'Score actuel' : 'Current score'}</span>
                <span className="font-mono font-medium" style={{ color: meta.color }}>
                  {pct.toFixed(0)} %
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: meta.color }}
                />
              </div>
            </div>
          )}

          {/* ── Explication ── */}
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <h3 className="text-sm font-semibold mb-2">
              {isFr ? '📖 Comment ce score est calculé' : '📖 How this score is calculated'}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {explanation}
            </p>
          </div>

          {/* ── Votre situation actuelle ── */}
          {situation && (
            <div className="rounded-lg border p-4 space-y-1" style={{ borderColor: meta.color + '40', backgroundColor: meta.color + '08' }}>
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" style={{ color: meta.color }} />
                {isFr ? 'Votre situation actuelle' : 'Your current situation'}
              </h3>
              <div className="text-sm font-mono text-muted-foreground space-y-0.5">
                {situation.split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          )}

          {/* ── Pistes d'amélioration ── */}
          {showTips && (
            <div className="rounded-lg border border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4" />
                {isFr ? "Pistes d'amélioration" : 'Ways to improve'}
              </h3>
              <ul className="space-y-2">
                {tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-0.5 text-amber-500 flex-shrink-0">→</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Bouton fermer ── */}
          <div className="flex justify-end pt-1">
            <Button variant="outline" size="sm" onClick={onClose} className="flex items-center gap-1.5">
              <X className="w-3.5 h-3.5" />
              {isFr ? 'Fermer' : 'Close'}
            </Button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}

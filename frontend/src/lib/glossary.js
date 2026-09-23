// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * glossary.js — dictionary of Fructificare's financial terms.
 *
 * Single source: the Glossary page and the contextual help bubbles (`<GlossaryTerm>`)
 * both read this file.
 *
 * Each entry:
 *   id          — stable key, used in the code: <GlossaryTerm id="pea">
 *   termFr/En   — the term as it is displayed
 *   shortFr/En  — one sentence, readable by a beginner: the heart of the bubble
 *   detailFr/En — the complement shown under the short sentence (optional)
 *   formula     — formula displayed in monospace (optional)
 *   category    — grouping on the Glossary page
 */

export const CATEGORIES = {
  enveloppes:  { fr: 'Les enveloppes',           en: 'Accounts' },
  operations:  { fr: 'Les opérations',           en: 'Operations' },
  performance: { fr: 'La performance',           en: 'Performance' },
  frais:       { fr: 'Les frais',                en: 'Fees' },
  fiscalite:   { fr: 'La fiscalité',             en: 'Taxation' },
  strategie:   { fr: 'Stratégie et long terme',  en: 'Strategy and the long run' },
};

/** Ordre d'affichage des catégories sur la page Glossaire. */
export const CATEGORY_ORDER = [
  'enveloppes', 'operations', 'performance', 'frais', 'fiscalite', 'strategie',
];

export const GLOSSARY = [
  // ── Enveloppes ────────────────────────────────────────────────────────────
  {
    id: 'enveloppe', category: 'enveloppes',
    termFr: 'Enveloppe', termEn: 'Account',
    shortFr: "Un compte d'investissement réel : votre PEA, votre assurance vie, votre livret A.",
    shortEn: 'A real investment account: your PEA, life-insurance policy or savings passbook.',
    detailFr: "Chaque enveloppe a ses propres règles fiscales, ses frais et sa couleur dans Fructificare. Elle contient un ou plusieurs actifs.",
    detailEn: 'Each account has its own tax rules, fees and colour in Fructificare. It holds one or more assets.',
  },
  {
    id: 'pea', category: 'enveloppes',
    termFr: 'PEA', termEn: 'PEA',
    shortFr: "Plan d'Épargne en Actions : une enveloppe française pour investir en actions européennes.",
    shortEn: 'A French tax-advantaged account for investing in European shares.',
    detailFr: "Son intérêt est fiscal : après 5 ans de détention, vos gains échappent à l'impôt sur le revenu — seuls les prélèvements sociaux restent dus. Les versements sont plafonnés à 150 000 €.",
    detailEn: 'Its benefit is tax: after 5 years, gains are exempt from income tax — only social contributions remain. Contributions are capped at €150,000.',
  },
  {
    id: 'cto', category: 'enveloppes',
    termFr: 'CTO', termEn: 'Securities account',
    shortFr: "Compte-Titres Ordinaire : un compte sans plafond ni restriction, mais sans avantage fiscal.",
    shortEn: 'An ordinary securities account: no cap, no restrictions, but no tax advantage either.',
    detailFr: "Vous pouvez y loger n'importe quel titre, du monde entier. En contrepartie, chaque gain est taxé à la flat tax de 31,4 %, quelle que soit la durée de détention.",
    detailEn: 'You can hold any security worldwide. In exchange, every gain is taxed at the 31.4% flat rate, whatever the holding period.',
  },
  {
    id: 'assurance_vie', category: 'enveloppes',
    termFr: 'Assurance vie', termEn: 'Life insurance',
    shortFr: "Un contrat d'épargne souple, avec un avantage fiscal qui se déclenche après 8 ans.",
    shortEn: 'A flexible savings contract whose tax advantage kicks in after 8 years.',
    detailFr: "Passé ce cap, vous bénéficiez chaque année d'un abattement de 4 600 € sur vos gains (9 200 € pour un couple), puis d'un impôt réduit à 7,5 %. C'est la raison pour laquelle il vaut souvent mieux ouvrir tôt, même avec peu.",
    detailEn: 'Past that mark you get an annual €4,600 allowance on gains (€9,200 for a couple), then a reduced 7.5% rate. Hence the advice to open one early, even with a small amount.',
  },
  {
    id: 'fond_euro', category: 'enveloppes',
    termFr: 'Fonds en euros', termEn: 'Euro fund',
    shortFr: "Le compartiment garanti d'une assurance vie : votre capital ne peut pas baisser.",
    shortEn: 'The guaranteed compartment of a life-insurance policy: your capital cannot fall.',
    detailFr: "La sécurité se paie par un rendement modeste. C'est la part défensive d'un contrat, à opposer aux unités de compte qui, elles, peuvent monter comme descendre.",
    detailEn: 'Safety comes at the cost of a modest return. It is the defensive part of a policy, as opposed to unit-linked funds which can rise or fall.',
  },
  {
    id: 'compte_reglemente', category: 'enveloppes',
    termFr: 'Livret réglementé', termEn: 'Regulated savings account',
    shortFr: "Livret A, LDDS, LEP : un taux fixé par l'État, des gains totalement exonérés d'impôt.",
    shortEn: 'Livret A, LDDS, LEP: a state-set rate and fully tax-exempt interest.',
    detailFr: "Fructificare les exclut du calcul de performance : leur rendement est connu d'avance et n'a rien à voir avec vos placements à risque. Ils apparaissent sur une ligne à part.",
    detailEn: 'Fructificare excludes them from performance calculations: their return is known in advance and unrelated to your risky investments. They appear on a separate line.',
  },

  // ── Opérations ────────────────────────────────────────────────────────────
  {
    id: 'mouvement', category: 'operations',
    termFr: 'Mouvement', termEn: 'Transaction',
    shortFr: "Un versement ou un retrait sur une enveloppe, à une date donnée.",
    shortEn: 'A deposit or withdrawal on an account, at a given date.',
    detailFr: "C'est l'unité de base de la saisie dans Fructificare. Tout part de là.",
    detailEn: 'It is the basic unit of data entry in Fructificare. Everything starts there.',
  },
  {
    id: 'calibration', category: 'operations',
    termFr: 'Calibration', termEn: 'Calibration',
    shortFr: "Saisir à la main la valeur réelle d'une enveloppe, relevée sur votre relevé bancaire.",
    shortEn: 'Manually entering the real value of an account, read from your bank statement.',
    detailFr: "Fructificare ne se connecte à aucune banque : sans calibration, il ne connaît que vos versements et ne peut calculer ni performance, ni plus-value. Une fois par mois suffit.",
    detailEn: 'Fructificare connects to no bank: without calibration it only knows your deposits and cannot compute performance or capital gains. Once a month is enough.',
  },
  {
    id: 'especes', category: 'operations',
    termFr: 'Espèces', termEn: 'Cash',
    shortFr: "De l'argent présent sur l'enveloppe mais pas encore investi.",
    shortEn: 'Money sitting in the account but not yet invested.',
    detailFr: "Typiquement le produit d'une vente que vous avez choisi de conserver sur le compte, en attendant de le replacer. Il sera automatiquement mobilisé à votre prochain achat.",
    detailEn: 'Typically the proceeds of a sale you chose to keep in the account, pending reinvestment. It is used automatically on your next purchase.',
  },
  {
    id: 'versements', category: 'operations',
    termFr: 'Versements', termEn: 'Deposits',
    shortFr: "L'argent que vous avez déposé sur l'enveloppe (cumul de vos dépôts).",
    shortEn: 'The money you have paid into the account (total of your deposits).',
    detailFr: "C'est votre effort d'épargne, hors gains. Comparé à la valeur actuelle, il révèle la plus-value.",
    detailEn: 'It is your saving effort, excluding gains. Compared with the current value, it reveals the capital gain.',
  },
  {
    id: 'pam', category: 'operations',
    termFr: "Prix d'achat moyen pondéré", termEn: 'Weighted average price',
    shortFr: "Le prix moyen auquel vous avez acheté une ligne, en tenant compte des quantités.",
    shortEn: 'The average price at which you bought a holding, weighted by quantity.',
    detailFr: "Acheter 10 parts à 100 € puis 30 parts à 120 € ne donne pas un prix moyen de 110 €, mais de 115 € : les 30 parts pèsent trois fois plus lourd.",
    detailEn: 'Buying 10 units at €100 then 30 at €120 does not average €110 but €115: the 30 units weigh three times more.',
    formula: 'PAM = Σ (quantité × prix unitaire) ÷ Σ quantité',
    formulaEn: 'Average cost = Σ (quantity × unit price) ÷ Σ quantity',
  },

  // ── Performance ───────────────────────────────────────────────────────────
  {
    id: 'plus_value', category: 'performance',
    termFr: 'Plus-value', termEn: 'Capital gain',
    shortFr: "La différence entre ce que vaut votre placement et ce que vous y avez mis.",
    shortEn: 'The difference between what your investment is worth and what you put in.',
    detailFr: "Elle est dite « latente » tant que vous n'avez rien vendu — elle n'existe que sur le papier. Elle devient « réalisée » au moment du retrait, et c'est à ce moment-là qu'elle est imposée.",
    detailEn: "It is unrealised as long as you have not sold — it only exists on paper. It becomes realised on withdrawal, and that is when it is taxed.",
    formula: 'Plus-value = valeur actuelle − versements nets',
    formulaEn: 'Gain = current value − net deposits',
  },
  {
    id: 'pnl', category: 'performance',
    termFr: 'PNL', termEn: 'PnL',
    shortFr: "« Profit and Loss » : le gain ou la perte d'une ligne, en euros.",
    shortEn: "Profit and Loss: the gain or loss on a holding, in euros.",
    detailFr: "C'est la même idée que la plus-value, appliquée à un actif précis plutôt qu'à l'enveloppe entière. Le pourcentage affiché à côté rapporte ce gain à votre coût total (le capital réellement investi), et non à la valeur actuelle : un PNL de 1 916 € sur 7 300 € investis fait donc +26 %, pas +21 %. Un PNL négatif signale une ligne en perte.",
    detailEn: 'Same idea as capital gain, applied to one specific asset rather than the whole account. The percentage shown next to it compares this gain to your total cost (the capital actually invested), not to the current value: a PnL of €1,916 on €7,300 invested is therefore +26%, not +21%. A negative PnL flags a losing position.',
    formula: 'PNL = valeur actuelle − coût total   ·   PNL % = PNL ÷ coût total',
    formulaEn: 'PNL = current value − total cost   ·   PNL % = PNL ÷ total cost',
  },
  {
    id: 'cout_total', category: 'performance',
    termFr: 'Coût total', termEn: 'Total cost (cost basis)',
    shortFr: "Le capital que vous avez réellement investi sur cette ligne : vos versements moins vos retraits, avant tout gain.",
    shortEn: 'The capital you actually invested in this holding: your deposits minus withdrawals, before any gain.',
    detailFr: "C'est la référence à laquelle on compare la valeur actuelle pour obtenir le gain (PNL). La performance en % se calcule sur ce coût total, pas sur la valeur actuelle — c'est pourquoi un gain rapporté à ce que vous avez mis donne un pourcentage plus élevé.",
    detailEn: 'It is the reference the current value is compared against to obtain the gain (PnL). The percentage return is computed on this cost basis, not on the current value — which is why a gain measured against what you put in gives a higher percentage.',
    formula: 'Coût total = versements − retraits (hors gains)',
    formulaEn: 'Total cost = deposits − withdrawals (excluding gains)',
  },
  {
    id: 'valeur_actuelle', category: 'performance',
    termFr: 'Valeur actuelle', termEn: 'Current value',
    shortFr: "Ce que vaut aujourd'hui votre ligne ou votre enveloppe, d'après la dernière calibration.",
    shortEn: 'What your holding or account is worth today, based on the latest calibration.',
    detailFr: "Sans calibration récente, Fructificare ne connaît que vos versements et affiche cette valeur à défaut. Calibrez pour refléter la vraie valeur de marché.",
    detailEn: 'Without a recent calibration, Fructificare only knows your deposits and shows that value as a fallback. Calibrate to reflect the true market value.',
  },
  {
    id: 'rendement_cible', category: 'performance',
    termFr: 'Rendement cible', termEn: 'Target return',
    shortFr: "Le taux de rendement annuel que vous supposez pour projeter la croissance de l'enveloppe.",
    shortEn: "The annual return rate you assume to project the account's growth.",
    detailFr: "C'est une hypothèse de projection, pas une garantie. Elle sert à tracer la courbe « rendement cible » et les simulations.",
    detailEn: "It is a projection assumption, not a guarantee. It is used to draw the 'target return' curve and simulations.",
  },
  {
    id: 'rendement_annuel', category: 'performance',
    termFr: 'Rendement annuel', termEn: 'Annual return',
    shortFr: "Ce que votre argent a rapporté sur une année, en pourcentage.",
    shortEn: 'What your money earned over a year, as a percentage.',
    detailFr: "Fructificare le calcule selon la méthode de Dietz modifiée : chaque versement est pondéré par sa date dans l'année. Un versement fait en décembre ne compte que pour un mois, et ne vient donc pas écraser artificiellement la performance. C'est pourquoi le chiffre peut différer de celui affiché par votre banque.",
    detailEn: "Fructificare uses the Modified Dietz method: each contribution is weighted by its date within the year. A December contribution counts for one month only, so it does not artificially depress performance. This is why the figure may differ from your bank's.",
    formula: 'Rendement = (valeur fin − valeur début − versements nets) ÷ (valeur début + versements pondérés par leur date)',
    formulaEn: 'Return = (end value − start value − net deposits) ÷ (start value + deposits weighted by their date)',
  },
  {
    id: 'dietz', category: 'performance',
    termFr: 'Dietz modifiée', termEn: 'Modified Dietz',
    shortFr: "La méthode de calcul de rendement utilisée par Fructificare.",
    shortEn: 'The return calculation method used by Fructificare.',
    detailFr: "Elle pondère chaque versement et chaque retrait par sa date au sein de la période. Sans elle, verser une grosse somme en fin d'année ferait chuter le rendement affiché, alors que cet argent n'a travaillé que quelques semaines.",
    detailEn: 'It weights every contribution and withdrawal by its date within the period. Without it, a large late-year contribution would depress the reported return, even though that money only worked for a few weeks.',
  },
  {
    id: 'ter', category: 'performance',
    termFr: 'TER', termEn: 'TER',
    shortFr: "« Total Expense Ratio » : le coût annuel total d'un placement, en pourcentage.",
    shortEn: 'Total Expense Ratio: the total annual cost of an investment, as a percentage.',
    detailFr: "Un TER de 1 % signifie que 1 % de votre capital part en frais chaque année, que le placement monte ou descende. Sur vingt ans, l'écart entre 0,3 % et 1,5 % se compte en dizaines de milliers d'euros.",
    detailEn: 'A 1% TER means 1% of your capital goes to fees every year, whether the investment rises or falls. Over twenty years, the gap between 0.3% and 1.5% runs into tens of thousands of euros.',
  },

  // ── Frais ─────────────────────────────────────────────────────────────────
  {
    id: 'frais_gestion', category: 'frais',
    termFr: 'Frais de gestion', termEn: 'Management fees',
    shortFr: "Ce que votre assureur ou votre courtier prélève chaque année sur votre encours.",
    shortEn: 'What your insurer or broker charges each year on your holdings.',
    detailFr: "Ils sont prélevés que vous gagniez ou perdiez de l'argent. C'est le poste de coût le plus important sur la durée, et le plus facile à réduire en changeant de contrat.",
    detailEn: 'They are charged whether you gain or lose money. It is the largest cost over time, and the easiest to cut by switching provider.',
  },
  {
    id: 'frais_versement', category: 'frais',
    termFr: 'Frais de versement', termEn: 'Entry fees',
    shortFr: "Une commission prélevée à chaque fois que vous investissez.",
    shortEn: 'A commission charged each time you invest.',
    detailFr: "Verser 1 000 € avec 2 % de frais ne place que 980 € : les 20 € restants sont perdus d'entrée. De nombreux contrats en ligne les ont supprimés.",
    detailEn: 'Investing €1,000 with 2% fees only places €980: the remaining €20 is lost upfront. Many online providers have removed them.',
  },

  // ── Fiscalité ─────────────────────────────────────────────────────────────
  {
    id: 'fiscalite', category: 'fiscalite',
    termFr: 'Fiscalité', termEn: 'Taxation',
    shortFr: "Les règles qui déterminent ce que l'État prélève sur vos gains.",
    shortEn: 'The rules that determine what the state takes from your gains.',
    detailFr: "En France, elles dépendent surtout de deux choses : le type d'enveloppe et depuis combien de temps vous la détenez. C'est pour cela que Fructificare vous demande la date d'ouverture de vos contrats.",
    detailEn: 'In France they mainly depend on two things: the type of account and how long you have held it. That is why Fructificare asks for your contract opening dates.',
  },
  {
    id: 'flat_tax', category: 'fiscalite',
    termFr: 'Flat tax', termEn: 'Flat tax',
    shortFr: "Le prélèvement forfaitaire unique de 31,4 % sur les gains financiers.",
    shortEn: 'The single flat rate of 31.4% on financial gains.',
    detailFr: "Il réunit 12,8 % d'impôt sur le revenu et 18,6 % de prélèvements sociaux. C'est le régime par défaut, celui qui s'applique quand aucun avantage d'ancienneté ne joue.",
    detailEn: 'It combines 12.8% income tax and 18.6% social contributions. It is the default regime, applying when no seniority advantage kicks in.',
  },
  {
    id: 'prelevements_sociaux', category: 'fiscalite',
    termFr: 'Prélèvements sociaux', termEn: 'Social contributions',
    shortFr: "18,6 % prélevés sur vos gains, quelle que soit l'enveloppe.",
    shortEn: '18.6% taken from your gains, whatever the account.',
    detailFr: "Ils financent la protection sociale. Contrairement à l'impôt sur le revenu, ils restent dus même sur un PEA de plus de cinq ans : l'exonération d'ancienneté ne porte que sur l'impôt.",
    detailEn: 'They fund social protection. Unlike income tax, they remain due even on a PEA over five years old: the seniority exemption only covers income tax.',
  },
  {
    id: 'abattement', category: 'fiscalite',
    termFr: 'Abattement', termEn: 'Tax allowance',
    shortFr: "Une part de vos gains qui échappe à l'impôt.",
    shortEn: 'A portion of your gains that escapes tax.',
    detailFr: "Sur une assurance vie de plus de 8 ans, les 4 600 premiers euros de gain retirés chaque année ne sont pas imposés — 9 200 € pour un couple. D'où l'intérêt d'étaler ses retraits sur plusieurs années.",
    detailEn: 'On a life-insurance policy over 8 years old, the first €4,600 of gains withdrawn each year is untaxed — €9,200 for a couple. Hence the value of spreading withdrawals over several years.',
  },
  {
    id: 'rachat_partiel', category: 'fiscalite',
    termFr: 'Rachat partiel', termEn: 'Partial withdrawal',
    shortFr: "Retirer une partie de votre assurance vie sans fermer le contrat.",
    shortEn: 'Taking part of your life-insurance policy without closing it.',
    detailFr: "Seule la part de gain contenue dans le retrait est imposée, pas la totalité de la somme retirée. Fructificare applique cette règle pour estimer votre imposition.",
    detailEn: 'Only the gain portion within the withdrawal is taxed, not the whole sum. Fructificare applies this rule to estimate your tax.',
    formula: 'Part de gain = 1 − versements cumulés ÷ (valeur actuelle + retraits cumulés)',
    formulaEn: 'Gain share = 1 − cumulative deposits ÷ (current value + cumulative withdrawals)',
  },

  // ── Stratégie ─────────────────────────────────────────────────────────────
  {
    id: 'interets_composes', category: 'strategie',
    termFr: 'Intérêts composés', termEn: 'Compound interest',
    shortFr: "Vos gains produisent eux-mêmes des gains, année après année.",
    shortEn: 'Your gains themselves produce gains, year after year.',
    detailFr: "1 000 € à 8 % rapportent 80 € la première année. La deuxième, les intérêts portent sur 1 080 € et non sur 1 000 €. L'effet est imperceptible les premières années, puis devient l'essentiel de la performance.",
    detailEn: '€1,000 at 8% yields €80 the first year. The second year, interest applies to €1,080 rather than €1,000. The effect is imperceptible early on, then becomes the bulk of performance.',
    formula: 'Valeur finale = capital × (1 + taux) ^ nombre d’années',
    formulaEn: 'Final value = capital × (1 + rate) ^ number of years',
  },
  {
    id: 'regle_843', category: 'strategie',
    termFr: 'Règle 8-4-3', termEn: '8-4-3 rule',
    shortFr: "Une façon de visualiser l'accélération des intérêts composés.",
    shortEn: 'A way of visualising how compound interest accelerates.',
    detailFr: "En 8 ans vous constituez votre capital de base. En 4 ans de plus, vos intérêts doublent. Et durant les 3 dernières années, ils s'envolent. La leçon pratique : la patience est le principal moteur de rendement — l'essentiel se joue après l'an 12.",
    detailEn: 'In 8 years you build your base capital. In 4 more, your interest doubles. And over the last 3 years it takes off. The practical lesson: patience is the main driver of returns — most of it happens after year 12.',
  },
  {
    id: 'fire', category: 'strategie',
    termFr: 'FIRE', termEn: 'FIRE',
    shortFr: "« Financial Independence, Retire Early » : vivre des revenus de son patrimoine.",
    shortEn: 'Financial Independence, Retire Early: living off your portfolio income.',
    detailFr: "L'objectif est d'accumuler un capital dont les retraits annuels couvrent vos dépenses. La règle courante retient 4 % de retrait par an, soit un capital de 25 fois vos dépenses annuelles.",
    detailEn: 'The goal is to build capital whose annual withdrawals cover your expenses. The common rule uses a 4% withdrawal rate, i.e. capital worth 25 times your annual spending.',
    formula: 'Capital nécessaire = dépenses annuelles ÷ taux de retrait',
    formulaEn: 'Required capital = annual spending ÷ withdrawal rate',
  },
  {
    id: 'crossover', category: 'strategie',
    termFr: 'Crossover Point', termEn: 'Crossover Point',
    shortFr: "Le moment où vos placements vous rapportent plus que vous n'y versez.",
    shortEn: 'The point where your investments earn you more than you contribute.',
    detailFr: "C'est un jalon important : passé ce point, votre patrimoine progresse davantage par ses propres gains que par votre effort d'épargne.",
    detailEn: 'An important milestone: past this point your wealth grows more from its own gains than from your saving effort.',
  },
  {
    id: 'diversification', category: 'strategie',
    termFr: 'Diversification', termEn: 'Diversification',
    shortFr: "Répartir son argent sur plusieurs placements pour limiter le risque.",
    shortEn: 'Spreading your money across several investments to limit risk.',
    detailFr: "Si tout votre capital est sur une seule ligne, sa chute est votre chute. Fructificare mesure votre concentration et l'intègre à votre score de santé financière.",
    detailEn: 'If all your capital sits in one holding, its fall is your fall. Fructificare measures your concentration and factors it into your financial health score.',
  },
  {
    id: 'inflation', category: 'strategie',
    termFr: 'Inflation', termEn: 'Inflation',
    shortFr: "La hausse générale des prix, qui grignote la valeur de votre argent.",
    shortEn: 'The general rise in prices, which erodes the value of your money.',
    detailFr: "Avec 2 % d'inflation, 100 € aujourd'hui n'achèteront plus que l'équivalent de 82 € dans dix ans. Un placement qui rapporte 2 % dans ce contexte ne vous a rien rapporté du tout.",
    detailEn: 'At 2% inflation, €100 today will only buy the equivalent of €82 in ten years. An investment returning 2% in that context has earned you nothing at all.',
  },
  {
    id: 'stress_test', category: 'strategie',
    termFr: 'Stress test', termEn: 'Stress test',
    shortFr: "Simuler un krach pour voir ce que deviendrait votre patrimoine.",
    shortEn: 'Simulating a crash to see what would become of your portfolio.',
    detailFr: "Fructificare applique −50 % sur la crypto et −20 % sur les actions et obligations à la date que vous choisissez. L'exercice sert moins à prédire qu'à se préparer.",
    detailEn: 'Fructificare applies −50% to crypto and −20% to shares and bonds at the date you choose. The exercise is less about predicting than about being prepared.',
  },
];

/** Retourne une entrée par son identifiant, ou null. */
export function getTerm(id) {
  return GLOSSARY.find(g => g.id === id) || null;
}

/** Entrées d'une catégorie, triées alphabétiquement dans la langue demandée. */
export function getByCategory(categoryId, lang = 'fr') {
  const key = lang === 'en' ? 'termEn' : 'termFr';
  return GLOSSARY
    .filter(g => g.category === categoryId)
    .sort((a, b) => a[key].localeCompare(b[key], lang === 'en' ? 'en' : 'fr'));
}

const glossary = { GLOSSARY, CATEGORIES, CATEGORY_ORDER, getTerm, getByCategory };
export default glossary;

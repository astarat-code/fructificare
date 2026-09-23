// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * questService.js — Tutorial quest system (Q1-Q10)
 *
 * Quests are sequential: only the current quest can be completed. They run in the
 * background, without getting in the way of using the application.
 *
 * PUBLIC API:
 *   questService.checkCurrentQuest()              → void   (call after each user action)
 *   questService.trackFirstTime(flag)             → void   (sets a firstTime flag + triggers a check)
 *   questService.trackViewOpened(viewKey)         → void   (marks a view as opened + triggers a check)
 *   questService.QUEST_CATALOG                    → array  (14 quests)
 *   questService.getCurrentQuestState()           → { quest, idx, completedCount, allDone }
 *   questService.getQuestStateList()              → array  (each quest's status, for the UI)
 */

import dataService          from './dataService';
import gamificationService  from './gamificationService';
// Import lazy pour éviter la dépendance circulaire
let _notificationService = null;
function _getNotificationService() {
  if (!_notificationService) {
    try { _notificationService = require('./notificationService').default; } catch (_) {}
  }
  return _notificationService;
}
// Import lazy pour éviter la dépendance circulaire trophyService → questService → trophyService
// trophyService est chargé en dernier dans index.js (après questService)
let _trophyService = null;
function _getTrophyService() {
  if (!_trophyService) {
    // Dynamic import via require-like trick — module est résolu à l'exécution
    try { _trophyService = require('./trophyService').default; } catch (_) {}
  }
  return _trophyService;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CATALOGUE DES 14 QUÊTES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Chaque entrée :
 *  id             — "Q1"…"Q10"
 *  titleFr        — titre court affiché dans la carte
 *  objectiveFr    — texte de l'objectif
 *  badgeFr        — nom du badge remis à la complétion
 *  xpReward       — XP attribués
 *  tipFr          — conseil affiché dans la carte de félicitations
 *  howToFr        — liste d'étapes (string[]) affichée dans le modal "Comment compléter"
 *  unlockCondition — fonction pure () → bool (accède aux services au moment de l'évaluation)
 */
const QUEST_CATALOG = [

  // ── Q1 ──────────────────────────────────────────────────────────────────────
  {
    id:           'Q1',
    titleFr:      'Première enveloppe',
    titleEn:      'My first envelope',
    objectiveFr:  "Créer une enveloppe d'investissement et y enregistrer au moins un mouvement (versement ou retrait).",
    objectiveEn:  'Create an investment envelope and record at least one transaction (deposit or withdrawal).',
    badgeFr:      'Fondateur',
    badgeId:      'badge_fondateur',
    xpReward:     200,
    tipFr:        "Bravo ! Une enveloppe bien nommée et correctement paramétrée (type, taux de frais, rendement estimé) est la base d'une gestion rigoureuse.",
    tipEn:        'Well done! A properly named and configured envelope (type, expense ratio, estimated return) is the foundation of disciplined portfolio management.',
    howToFr: [
      "Rendez-vous sur le Tableau de bord.",
      "Cliquez sur « Créer une enveloppe » et choisissez un type (PEA, Assurance-vie…).",
      "Ouvrez l'enveloppe et enregistrez un versement via le bouton « Ajouter un mouvement ».",
    ],
    howToEn: [
      'Go to the Dashboard.',
      'Click "Create Envelope" and choose a type (PEA, Life Insurance…).',
      'Open the envelope and record a deposit via the "Add Transaction" button.',
    ],
    unlockCondition: () => {
      const portfolios = dataService.getPortfolios();
      const movements  = dataService.getAllTransactions();
      const result     = portfolios.length >= 1 && movements.length >= 1;
      if (process.env.NODE_ENV !== 'production') {
        console.debug(
          `[Quest Q1] enveloppes=${portfolios.length}, mouvements=${movements.length}, validée=${result}`
        );
      }
      return result;
    },
  },

  // ── Q2 ──────────────────────────────────────────────────────────────────────
  {
    id:           'Q2',
    titleFr:      'Diversifier son patrimoine',
    titleEn:      'Building the foundation',
    objectiveFr:  'Enregistrer au moins 3 mouvements sur des actifs appartenant à 3 classes différentes (actions, obligations, immobilier…).',
    objectiveEn:  'Record at least 3 transactions covering 3 different asset classes (equities, bonds, real estate…).',
    badgeFr:      'Débutant motivé',
    badgeId:      'badge_debutant_motive',
    xpReward:     250,
    tipFr:        "La diversification réduit le risque global sans sacrifier le rendement. Pensez à mixer actifs défensifs et actifs de croissance.",
    tipEn:        'Diversification reduces overall risk without sacrificing returns. Aim to blend defensive assets with growth-oriented ones.',
    howToFr: [
      "Ouvrez une enveloppe et cliquez sur « Ajouter un mouvement ».",
      "Choisissez un type d'actif (action, obligation, immobilier, Fonds euros…).",
      "Répétez pour 3 actifs de types distincts ou utilisez l'option « Types d'actifs multiples ».",
    ],
    howToEn: [
      'Open an envelope and click "Add Transaction".',
      'Choose an asset type (equity, bond, real estate, money-market fund…).',
      'Repeat for 3 distinct asset types or use the « Multiple asset types » option.',
    ],
    unlockCondition: () => {
      // Vérifie les transactions réelles (asset_type) plutôt que les modèles de mouvement
      const txns = dataService.getAllTransactions();
      if (txns.length < 3) return false;
      const distinctTypes = new Set(txns.map(t => t.asset_type).filter(Boolean));
      const result = distinctTypes.size >= 3;
      if (process.env.NODE_ENV !== 'production') {
        console.debug(`[Quest Q2] txns=${txns.length}, types=[${[...distinctTypes].join(', ')}], validée=${result}`);
      }
      return result;
    },
  },

  // ── Q3 ──────────────────────────────────────────────────────────────────────
  {
    id:           'Q3',
    titleFr:      'Faites connaissance',
    titleEn:      'Getting acquainted',
    objectiveFr:  "Renseignez votre pseudo, votre date de naissance et votre revenu mensuel net dans Paramètres → Données de l'utilisateur. Ces données personnalisent votre score de santé et votre Crossover Point. Si vous ne percevez pas de salaire, saisissez 0.",
    objectiveEn:  "Enter your display name, date of birth and monthly net income in Settings → User data. These details personalise your health score and Crossover Point. If you have no salary, enter 0.",
    badgeFr:      'Profil complet',
    badgeId:      'badge_profil_complet',
    xpReward:     150,
    tipFr:        "Ces informations permettent à Fructificare de personnaliser votre expérience : votre âge adapte le score de santé à votre horizon d'investissement, et votre revenu mensuel sert au calcul du Crossover Point et de l'épargne de précaution recommandée. Si vous ne percevez pas de salaire actuellement, saisissez 0 — vous pourrez mettre à jour cette valeur à tout moment dans les Paramètres.",
    tipEn:        "This information helps Fructificare personalise your experience: your age adapts the health score to your investment horizon, and your monthly income is used to calculate the Crossover Point and recommended emergency savings. If you currently have no salary, enter 0 — you can update this at any time in Settings.",
    howToFr: [
      "Accédez à Paramètres > Données de l'utilisateur.",
      "Renseignez votre prénom (ou pseudonyme).",
      "Indiquez votre date de naissance.",
      "Saisissez votre revenu mensuel net (0 si vous n'avez pas de salaire).",
      "Sauvegardez.",
    ],
    howToEn: [
      'Go to Settings > User Data.',
      'Enter your first name (or a pseudonym).',
      'Enter your date of birth.',
      'Enter your monthly net income (0 if you have no salary).',
      'Click "Save".',
    ],
    unlockCondition: () => {
      const profile = gamificationService.getState().profile;
      return profile?.username != null
          && profile.username.trim() !== ''
          && profile?.birthDate != null
          && profile?.monthlyNetIncome != null;
    },
  },

  // ── Q4 — Les frais, ça compte ────────────────────────────────────────────
  {
    id:           'Q4',
    titleFr:      'Les frais, ça compte',
    titleEn:      'Fee awareness',
    objectiveFr:  "Enregistrer un mouvement sur une enveloppe en renseignant un taux de frais de transaction ou un taux de frais annuels.",
    objectiveEn:  'Record a transaction on an envelope with a transaction fee or annual expense ratio set.',
    badgeFr:      'Chasseur de frais',
    badgeId:      'badge_chasseur_de_frais',
    xpReward:     150,
    tipFr:        "Les frais, même faibles, ont un impact considérable sur le long terme. 1 % de frais annuels en plus peut coûter des milliers d'euros sur 20 ans — chassez-les !",
    tipEn:        'Fees, even small ones, have a significant long-term impact. An extra 1% in annual charges can cost thousands of euros over 20 years — hunt them down!',
    howToFr: [
      "Ouvrez une enveloppe et cliquez sur « Ajouter un mouvement ».",
      "Dans le formulaire, renseignez un taux de frais de transaction ou un TER annuel.",
      "Validez le mouvement.",
    ],
    howToEn: [
      'Open an envelope and click "Add Transaction".',
      'In the form, enter a transaction fee rate or an annual expense ratio (TER).',
      'Confirm the transaction.',
    ],
    unlockCondition: () => {
      const result = gamificationService.getState().flags?.movementWithFeesAdded === true;
      return result;
    },
  },

  // ── Q5 ──────────────────────────────────────────────────────────────────────
  {
    id:           'Q5',
    titleFr:      "L'investisseur régulier",
    titleEn:      'The regular investor',
    objectiveFr:  "Créer au moins un mouvement régulier (versement ou prélèvement automatique) sur une enveloppe.",
    objectiveEn:  'Set up at least one regular transaction (automatic contribution or debit) on an envelope.',
    badgeFr:      'Investisseur régulier',
    badgeId:      'badge_investisseur_regulier',
    xpReward:     200,
    tipFr:        "L'investissement automatique mensuel est la méthode la plus efficace pour lisser le risque de marché et capitaliser sans effort. Configurez-le une fois, bénéficiez-en des années.",
    tipEn:        'Automated monthly investing is the most effective way to smooth market risk and compound wealth effortlessly. Set it up once and benefit for years.',
    howToFr: [
      "Depuis le Tableau de bord, ouvrez le panneau « Mouvements récurrents ».",
      "Cliquez sur « Créer un récurrent ».",
      "Associez-le à une enveloppe, définissez le montant et la fréquence.",
      "Validez — le mouvement régulier actif est pris en compte.",
    ],
    howToEn: [
      'From the Dashboard, open the "Regular transactions" panel.',
      'Click "Create recurring".',
      'Link it to an envelope and set the amount and frequency.',
      'Confirm — any active regular transaction counts.',
    ],
    unlockCondition: () => {
      return dataService.getRegularMovements().filter(rm => rm.status === 'active').length >= 1;
    },
  },

  // ── Q6 ──────────────────────────────────────────────────────────────────────
  {
    id:           'Q6',
    titleFr:      'Planifier sur le long terme',
    titleEn:      'Looking into the future',
    objectiveFr:  "Lancer une simulation de projection sur un horizon d'au moins 10 ans.",
    objectiveEn:  'Run a projection simulation over a horizon of at least 10 years.',
    badgeFr:      'Voyant',
    badgeId:      'badge_voyant',
    xpReward:     300,
    tipFr:        "L'intérêt composé révèle tout son potentiel sur 10 ans et plus. Une simulation à long horizon vous aide à évaluer vos besoins d'épargne mensuels.",
    tipEn:        'Compound interest fully reveals its power over 10+ years. A long-horizon simulation helps you evaluate how much you need to save each month.',
    howToFr: [
      "Accédez à la section Simulation.",
      "Créez ou ouvrez une simulation.",
      "Réglez l'horizon à 10 ans minimum.",
    ],
    howToEn: [
      'Go to the Simulation section.',
      'Create or open a simulation.',
      'Set the horizon to at least 10 years and run the simulation.',
    ],
    unlockCondition: () => {
      const gState = gamificationService.getState();
      const idx    = gState.currentQuestIndex ?? 1;
      // Rétrocompatibilité : flag déjà positionné lors d'une session précédente
      if (gState.firstTime?.longTermProjection === true) {
        return true;
      }
      // Vérification via les données de la dernière simulation
      const lastSim = gState.lastSimulation;
      if (!lastSim) {
        return false;
      }
      const horizonYears = lastSim.horizonYears ?? 0;
      const result       = horizonYears >= 10;
      return result;
    },
  },

  // ── Q7 ──────────────────────────────────────────────────────────────────────
  {
    id:           'Q7',
    titleFr:      "Comparer l'impact des frais",
    titleEn:      'Fees: the silent enemy',
    objectiveFr:  "Lancer au moins deux projections avec des niveaux de frais différents pour mesurer leur impact.",
    objectiveEn:  'Run at least two projections with different expense ratios to measure their impact.',
    badgeFr:      'Œil de lynx',
    badgeId:      'badge_oeil_de_lynx',
    xpReward:     250,
    tipFr:        "0,5 % de frais annuels en moins peut représenter des dizaines de milliers d'euros sur 30 ans. Toujours comparer avant d'investir !",
    tipEn:        'Reducing annual fees by 0.5% can mean tens of thousands of euros saved over 30 years. Always compare costs before investing!',
    howToFr: [
      "Dans la simulation, modifiez le taux de frais annuels d'une enveloppe.",
      "Relancez la simulation et observez l'écart.",
      "Créez une 2e simulation avec des frais différents pour comparer les courbes côte à côte.",
    ],
    howToEn: [
      "In the simulation, change the annual expense ratio of an account.",
      'Re-run the simulation and observe the difference.',
      'Create a 2nd simulation with different fees to compare the curves side by side.',
    ],
    unlockCondition: () => {
      const gState    = gamificationService.getState();
      const idx       = gState.currentQuestIndex ?? 1;
      const flagA     = gState.flags?.simulatorFeesModified === true;
      const simCount  = dataService.getSimulations().length;
      const condB     = simCount >= 2;
      const result    = flagA && condB;
      return result;
    },
  },

  // ── Q8 ──────────────────────────────────────────────────────────────────────
  {
    id:           'Q8',
    titleFr:      'Tester la résistance',
    titleEn:      'Surviving the crash',
    objectiveFr:  "Appliquer un stress test sur votre portefeuille simulé et enregistrer le résultat.",
    objectiveEn:  'Apply a stress test to your simulated portfolio and record the result.',
    badgeFr:      'Résistant',
    badgeId:      'badge_resistant',
    xpReward:     400,
    tipFr:        "Un bon portefeuille doit résister aux crises. Un stress test simulé vous aide à anticiper vos réactions émotionnelles face à une forte baisse.",
    tipEn:        'A resilient portfolio should withstand market crises. A simulated stress test helps you anticipate your emotional reactions to a sharp drawdown.',
    howToFr: [
      "Ouvrez une simulation avec des enveloppes.",
      "Faites défiler jusqu'à la section « Stress test » et choisissez un scénario de crise (selon vos types d'actifs).",
      "Observez l'impact sur votre projection.",
    ],
    howToEn: [
      'Open a simulation with accounts.',
      'Scroll to the "Stress test" section and choose a crisis scenario.',
      'Observe the impact on your projection.',
    ],
    unlockCondition: () => {
      const result = gamificationService.getState().firstTime?.stressTest === true;
      return result;
    },
  },

  // ── Q9 — Comprendre les impôts ───────────────────────────────────────────
  {
    id:           'Q9',
    titleFr:      'Comprendre les impôts',
    titleEn:      'Understanding taxes',
    objectiveFr:  "Simuler une plus-value CTO supérieure à 1 000 € dans le Simulateur fiscal ET consulter l'onglet Documentation fiscale.",
    objectiveEn:  'Simulate a CTO capital gain above €1,000 in the Tax Simulator AND visit the tax documentation tab.',
    badgeFr:      'Citoyen fiscal',
    badgeId:      'badge_citoyen_fiscal',
    xpReward:     300,
    tipFr:        "La flat tax (PFU à 30 %) s'applique aux gains en capital hors PEA et AV. Comprendre l'imposition théorique vous permet de choisir la bonne enveloppe pour chaque placement.",
    tipEn:        'The flat-rate tax (30%) applies to capital gains outside a PEA or life-insurance wrapper. Understanding your theoretical tax liability helps you choose the right account for each investment.',
    howToFr: [
      "Depuis le menu, cliquez sur « Simulation » puis « Simulateur d'imposition ».",
      "Dans l'onglet CTO, saisissez une plus-value ≥ 1 000 € et lancez le calcul.",
      "Consultez l'onglet Documentation pour comprendre les règles fiscales.",
    ],
    howToEn: [
      "From the menu, click « Simulation » then « Tax simulator ».",
      'In the CTO tab, enter a capital gain ≥ €1,000 and run the calculation.',
      'Visit the Documentation tab to understand the tax rules.',
    ],
    unlockCondition: () => {
      const gState  = gamificationService.getState();
      const condA   = gState.flags?.fiscalSimCTOOver1000   === true;
      const condB   = gState.viewOpened?.fiscalSimDocumentation === true;
      const result  = condA && condB;
      return result;
    },
  },

  // ── Q10 — Calibrer une enveloppe ─────────────────────────────────────────
  {
    id:           'Q10',
    titleFr:      'Calibrer une enveloppe',
    titleEn:      'Calibrate an envelope',
    objectiveFr:  "Enregistrer la valeur réelle de marché d'une enveloppe via la calibration pour affiner les calculs de performance.",
    objectiveEn:  'Record the real market value of an envelope via calibration to refine performance calculations.',
    badgeFr:      'Investisseur précis',
    badgeId:      'badge_investisseur_precis',
    xpReward:     250,
    tipFr:        "Calibrer vos enveloppes avec leur valeur de marché réelle permet à Fructificare de calculer avec précision votre performance nette de frais et votre score de santé.",
    tipEn:        'Calibrating your envelopes with their real market value lets Fructificare accurately calculate your net-of-fees performance and health score.',
    howToFr: [
      "Ouvrez une enveloppe.",
      "Dans la section « Calibration », cliquez sur « Calibrer ».",
      "Saisissez la valeur de marché actuelle et validez.",
    ],
    howToEn: [
      'Open an envelope.',
      'In the "Calibration" section, click "Calibrate".',
      'Enter the current market value and confirm.',
    ],
    unlockCondition: () => {
      const gState  = gamificationService.getState();
      // Rétrocompat : firstTime.envelopeCalibration existait avant l'introduction du flag dédié
      const result  = gState.flags?.envelopeCalibrated === true
                   || gState.firstTime?.envelopeCalibration === true;
      return result;
    },
  },

  // ── Q11 — Votre rapport fiscal ─────────────────────────────────────────────
  {
    id:           'Q11',
    titleFr:      'Votre rapport fiscal',
    titleEn:      'Your tax report',
    objectiveFr:  "Générer votre rapport fiscal annuel PDF depuis la section Rapport fiscal.",
    objectiveEn:  'Generate your annual tax report PDF from the Tax Report section.',
    badgeFr:      'Déclarant averti',
    badgeId:      'badge_declarant_averti',
    xpReward:     250,
    tipFr:        "Votre rapport fiscal PDF récapitule tous vos gains et revenus de capitaux mobiliers de l'année. Gardez-le précieusement pour votre déclaration de revenus !",
    tipEn:        'Your tax report PDF summarises all your capital gains and investment income for the year. Keep it safe for your income tax return!',
    howToFr: [
      "Accédez à la section Rapport fiscal (menu principal).",
      "Sélectionnez l'année fiscale à déclarer.",
      "Vérifiez les données récapitulées.",
      "Cliquez sur « Générer le PDF » pour télécharger votre rapport.",
    ],
    howToEn: [
      'Go to the Tax Report section (main menu).',
      'Select the tax year to declare.',
      'Review the summarised data.',
      'Click "Generate PDF" to download your report.',
    ],
    unlockCondition: () => {
      const result = gamificationService.getState().flags?.q11FiscalReportGenerated === true;
      return result;
    },
  },

  // ── Q12 ──────────────────────────────────────────────────────────────────────
  {
    id:           'Q12',
    titleFr:      'Définir ses objectifs',
    titleEn:      'Setting the course',
    objectiveFr:  "Créer un objectif personnel avec un montant cible et une date d'échéance.",
    objectiveEn:  'Create a personal goal with a target amount and a deadline.',
    badgeFr:      'Architecte de vie',
    badgeId:      'badge_architecte_de_vie',
    xpReward:     250,
    tipFr:        "Un objectif chiffré et daté est deux fois plus souvent atteint qu'un vœu vague. Votre cerveau a besoin de cibles concrètes pour s'organiser.",
    tipEn:        'A specific, time-bound goal is twice as likely to be achieved as a vague aspiration. Your brain needs concrete targets to stay organised.',
    howToFr: [
      "Accédez à la section Trophées > Mes objectifs.",
      "Cliquez sur « + Ajouter ».",
      "Renseignez un montant cible et une date d'échéance.",
    ],
    howToEn: [
      'Go to the Trophies section > My Goals.',
      'Click "+ Add".',
      'Enter a target amount and a deadline.',
    ],
    unlockCondition: () => {
      const objectives = gamificationService.getState().objectives || [];
      const result = objectives.some(o => o.targetAmount > 0 && o.targetDate);
      return result;
    },
  },

  // ── Q13 ──────────────────────────────────────────────────────────────────────
  {
    id:           'Q13',
    titleFr:      'Piloter son budget',
    titleEn:      'Budget pilot',
    objectiveFr:  "Consulter l'onglet Budget du Calendrier pour analyser vos dépenses par catégorie.",
    objectiveEn:  'Visit the Budget tab of the Calendar to analyse your spending by category.',
    badgeFr:      'Organisateur',
    badgeId:      'badge_organisateur',
    xpReward:     200,
    tipFr:        "Connaître son taux d'épargne réel (revenus − dépenses) est la première étape pour l'améliorer. L'onglet Budget vous donne une vision claire de vos habitudes mois par mois.",
    tipEn:        'Knowing your actual savings rate (income minus expenses) is the first step to improving it. The Budget tab gives you a clear view of your spending habits month by month.',
    howToFr: [
      "Rendez-vous sur le Calendrier.",
      "Cliquez sur l'onglet « Budget » pour consulter votre répartition des dépenses.",
    ],
    howToEn: [
      'Go to the Calendar.',
      'Click the "Budget" tab to review your expense breakdown.',
    ],
    unlockCondition: () => {
      const result = gamificationService.getState().flags?.q12BudgetTabVisited === true;
      return result;
    },
  },

  // ── Q14 ──────────────────────────────────────────────────────────────────────
  {
    id:           'Q14',
    titleFr:      'Évaluer sa santé financière',
    titleEn:      'The right diagnosis',
    objectiveFr:  "Consultez votre score de santé financière et les axes d'amélioration proposés dans la page Trophées.",
    objectiveEn:  'Review your financial health score on the Trophies page.',
    badgeFr:      'Stratège lucide',
    badgeId:      'badge_stratege_lucide',
    xpReward:     250,
    tipFr:        "Un score de santé financière globale permet d'identifier vos points faibles d'un seul coup d'œil. Revenez le vérifier chaque trimestre !\n\n🎉 Félicitations, vous avez terminé le tutoriel ! Vous maîtrisez désormais les bases de Fructificare pour piloter votre patrimoine.",
    tipEn:        'An overall financial health score lets you identify your weak spots at a glance. Come back to check it every quarter!\n\n🎉 Congratulations, you have completed the tutorial! You now know the essentials of Fructificare to manage your wealth.',
    howToFr: [
      "Accédez à la page Trophées et cliquez sur Score de santé pour consulter le détail.",
    ],
    howToEn: [
      'Go to the Trophies page and click on Health Score to view the breakdown.',
    ],
    unlockCondition: () => {
      const state       = gamificationService.getState();
      // Utilise un flag dédié (q13HealthScoreViewed) remis à false quand Q14 devient active.
      // viewOpened.healthScoreDetail est un flag global permanent ; il serait vrai dès la
      // première visite de la page Trophées, quelle que soit la quête active.
      const scoreViewed = state.flags?.q13HealthScoreViewed === true;
      return scoreViewed;
    },
  },
];

// Index de lookup
const _questIndex = Object.fromEntries(QUEST_CATALOG.map(q => [q.id, q]));

// ═══════════════════════════════════════════════════════════════════════════════
// 2. LOGIQUE D'UNLOCK
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Vérifie si la quête courante est complétée.
 * Si oui, enregistre la complétion, attribue les XP et déverrouille le trophée.
 *
 * Idempotent — sans effet si la quête est déjà terminée ou si sa condition n'est pas remplie.
 */
function checkCurrentQuest() {
  const gState = gamificationService.getState();
  const idx    = gState.currentQuestIndex ?? 1;

  // Toutes les quêtes sont terminées
  if (idx > QUEST_CATALOG.length) return;

  const quest = QUEST_CATALOG[idx - 1]; // tableau 0-indexé, quêtes 1-indexées
  if (!quest) return;

  // Déjà complétée (sécurité supplémentaire)
  if (gState.quests?.[quest.id]?.completed === true) return;

  // Vérification de la condition
  let conditionMet = false;
  try {
    conditionMet = quest.unlockCondition();
  } catch (e) {
    console.error('[questService] Erreur lors de la vérification de Q' + idx + ' (' + quest.id + '):', e?.message || e);
    if (process.env.NODE_ENV !== 'production') console.error(e);
    return;
  }
  if (!conditionMet) return;

  // ── Complétion ──────────────────────────────────────────────────────────────
  const now = new Date().toISOString();

  // a. Marquer la quête comme complétée
  gamificationService.patchState({
    quests: {
      ...(gState.quests || {}),
      [quest.id]: { completed: true, completedAt: now },
    },
    currentQuestIndex: idx + 1,
  });

  // b. Attribuer les XP (déclenchera aussi checkAllTrophies via xpAwarded)
  gamificationService.notifyProgress('quest_' + quest.id);

  // c. Déverrouiller les trophées tutoriel + utilisateur correspondants
  //    unlockDirectBadge : bypass checkFn (tous ces badges ont checkFn: null par conception),
  //    attribue les XP du badge et émet trophyUnlocked.
  const ts = _getTrophyService();
  if (ts) {
    ts.unlockDirectBadge('quest_' + idx + '_done');
    if (quest.badgeId) {
      ts.unlockDirectBadge(quest.badgeId);
    }
  }

  // c2. Réinitialiser les flags de quêtes dont la condition pourrait déjà être vraie
  //     avant que la quête ne devienne active.
  if (idx + 1 === 11) {
    // Q11 : rapport fiscal — réinitialiser pour forcer une génération consciente
    const nextGState = gamificationService.getState();
    if (nextGState.flags?.q11FiscalReportGenerated === true) {
      gamificationService.patchState({
        flags: { ...(nextGState.flags || {}), q11FiscalReportGenerated: false },
      });
    }
  }
  if (idx + 1 === 13) {
    // Q13 : onglet Budget — réinitialiser si déjà visité
    const nextGState = gamificationService.getState();
    if (nextGState.flags?.q12BudgetTabVisited === true) {
      gamificationService.patchState({
        flags: { ...(nextGState.flags || {}), q12BudgetTabVisited: false },
      });
    }
  }
  if (idx + 1 === 14) {
    // Q14 : score de santé — toujours réinitialiser pour forcer une consultation consciente
    const nextGState = gamificationService.getState();
    gamificationService.patchState({
      flags: { ...(nextGState.flags || {}), q13HealthScoreViewed: false },
    });
  }

  // d. Émettre l'événement pour l'UI (notification / carte de félicitations)
  gamificationService.dispatchEvent('questCompleted', {
    quest,
    idx,
    completedAt: now,
  });

  // d2. Si c'est la dernière quête (Q14), féliciter l'utilisateur
  if (idx === 14) {
    const ns = _getNotificationService();
    if (ns) {
      ns.addNotification(
        'achievement',
        { fr: '🎉 Tutoriel terminé !', en: '🎉 Tutorial complete!' },
        { fr: 'Félicitations, vous maîtrisez désormais les bases de Fructificare pour piloter votre patrimoine !',
          en: 'Congratulations, you now know the Fructificare basics to manage your wealth!' },
        '/trophees',
      );
    }
  }

  // e. Enchaîner immédiatement sur la quête suivante si sa condition est déjà remplie
  //    (ex. : l'utilisateur a rempli plusieurs conditions d'un coup)
  setTimeout(() => checkCurrentQuest(), 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. TRACKERS — appelés depuis les pages et dataService
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Marque un drapeau `firstTime` et déclenche le check de la quête courante.
 *
 * @param {'longTermProjection'|'comparedTERValues'|'fiscalPFUSimulation'|'fiscalComparison'} flag
 */
function trackFirstTime(flag) {
  const gState = gamificationService.getState();
  if (gState.firstTime?.[flag] === true) return; // déjà marqué
  gamificationService.patchState({
    firstTime: { ...(gState.firstTime || {}), [flag]: true },
  });
  checkCurrentQuest();
}

/**
 * Marque une vue comme ouverte et déclenche le check de la quête courante.
 *
 * @param {'calendarExpenses'|'healthScoreDetail'|string} viewKey
 */
function trackViewOpened(viewKey) {
  const gState = gamificationService.getState();

  // Cas spécial Q14 : quand la vue healthScoreDetail est ouverte ET que Q14 est la quête active,
  // positionner le flag dédié (pas le global viewOpened qui reste vrai pour toujours).
  if (viewKey === 'healthScoreDetail' && (gState.currentQuestIndex ?? 1) === 14) {
    if (gState.flags?.q13HealthScoreViewed !== true) {
      gamificationService.patchState({
        flags: { ...(gState.flags || {}), q13HealthScoreViewed: true },
      });
    }
    // Marquer aussi viewOpened pour les défis qui utilisent ce flag
    if (gState.viewOpened?.[viewKey] !== true) {
      gamificationService.patchState({
        viewOpened: { ...(gState.viewOpened || {}), [viewKey]: true },
      });
    }
    checkCurrentQuest();
    return;
  }

  if (gState.viewOpened?.[viewKey] === true) return; // déjà marqué
  gamificationService.patchState({
    viewOpened: { ...(gState.viewOpened || {}), [viewKey]: true },
  });
  checkCurrentQuest();
}

/**
 * Positionne un flag booléen dans `gamificationState.flags` (ne repasse jamais à false)
 * et déclenche le check de la quête courante.
 *
 * @param {'simulatorFeesModified'|'movementWithFeesAdded'|'fiscalSimCTOOver1000'|'q12BudgetTabVisited'|'envelopeCalibrated'|string} flagKey
 */
function trackFlag(flagKey) {
  const gState = gamificationService.getState();
  if (gState.flags?.[flagKey] === true) {
    // Flag déjà positionné — on force quand même le check car currentQuestIndex
    // a pu avancer depuis la dernière fois que le flag a été posé.
    checkCurrentQuest();
    return;
  }
  gamificationService.patchState({
    flags: { ...(gState.flags || {}), [flagKey]: true },
  });
  checkCurrentQuest();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. ACCESSEURS POUR L'UI
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Retourne les informations sur la quête en cours et le score global.
 *
 * @returns {{
 *   quest:          object|null,   — quête active ou null si toutes complétées
 *   idx:            number,        — index de la quête active (1-13)
 *   completedCount: number,        — nombre de quêtes complétées
 *   allDone:        boolean,
 * }}
 */
function getCurrentQuestState() {
  const gState = gamificationService.getState();
  const idx    = gState.currentQuestIndex ?? 1;
  const allDone = idx > QUEST_CATALOG.length;
  const completedCount = QUEST_CATALOG.filter(
    q => gState.quests?.[q.id]?.completed === true
  ).length;

  return {
    quest:          allDone ? null : (QUEST_CATALOG[idx - 1] || null),
    idx:            Math.min(idx, QUEST_CATALOG.length + 1),
    completedCount,
    allDone,
  };
}

/**
 * Retourne la liste complète des quêtes avec leur statut pour l'affichage.
 *
 * @returns {Array<{
 *   quest: object,
 *   status: 'completed'|'active'|'locked',
 *   completedAt: string|null,
 * }>}
 */
function getQuestStateList() {
  const gState = gamificationService.getState();
  const currentIdx = gState.currentQuestIndex ?? 1;

  return QUEST_CATALOG.map((q, i) => {
    const qNum       = i + 1;
    const qState     = gState.quests?.[q.id];
    const isCompleted = qState?.completed === true;
    const isActive    = !isCompleted && qNum === currentIdx;

    return {
      quest:       q,
      status:      isCompleted ? 'completed' : isActive ? 'active' : 'locked',
      completedAt: qState?.completedAt || null,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. WATCHER — abonnement automatique au bus d'événements
// ═══════════════════════════════════════════════════════════════════════════════

let _watcherInitialized = false;

/**
 * Abonne checkCurrentQuest aux événements XP pour une vérification automatique
 * après chaque mutation de données.
 * À appeler une seule fois depuis index.js (après gamificationService.loadState()).
 */
function initQuestWatcher() {
  if (_watcherInitialized) return;
  _watcherInitialized = true;

  // Vérification après chaque attribution de XP (déclenchée par les hooks dataService)
  gamificationService.onEvent('progressUpdated', () => {
    try { checkCurrentQuest(); } catch (e) { console.warn('[questService] watcher error:', e); }
  });

  // Q3 (Faites connaissance) se débloque quand le profil est mis à jour
  gamificationService.onEvent('profileUpdated', () => {
    try { checkCurrentQuest(); } catch (e) { console.warn('[questService] watcher error:', e); }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

const questService = {
  QUEST_CATALOG,
  checkCurrentQuest,
  trackFirstTime,
  trackViewOpened,
  trackFlag,
  getCurrentQuestState,
  getQuestStateList,
  initQuestWatcher,
};

export default questService;

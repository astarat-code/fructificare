// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * gamificationService.js — Gamification data layer for Fructificare
 *
 * This service handles only the persistence of, and access to, the gamification data. It
 * grants NO XP and checks NO badge: those responsibilities belong to the business-rule
 * services.
 *
 * PERSISTENCE:
 *   - Main storage: localStorage (key "fructificare_gamification")
 *   - Included in the JSON export/import: the `gamificationState` object is also serialized
 *     into dataService's exports (key "gamification") so it follows data migrations.
 *
 * MIGRATION:
 *   - If a saved state is incomplete (older version), the missing fields are merged with
 *     the defaults without overwriting existing data (deep merge).
 *
 * PUBLIC API:
 *   gamificationService.loadState()          → void  (init at startup)
 *   gamificationService.getState()           → gamificationState (live reference)
 *   gamificationService.saveState()          → void  (after each mutation)
 *   gamificationService.resetState()         → void  (erases everything)
 *   gamificationService.patchState(partial)  → void  (merge + save)
 */

// ── Clé de stockage ────────────────────────────────────────────────────────────
const STORAGE_KEY = 'fructificare_gamification';

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ÉTAT PAR DÉFAUT
// ═══════════════════════════════════════════════════════════════════════════════

function _buildDefaultState() {
  return {
    // Profil utilisateur
    profile: {
      username:                   null,   // string | null → affiche "Fructi Padawan" si null
      birthDate:                  null,
      monthlyNetIncome:           null,
      // tmi supprimé — TODO: réactiver quand le comparateur fiscal sera opérationnel
      annualReturnTarget:         null,
      allocationTarget:           {},
      // Données pour les trophées (Prompt 4)
      lastFiscalRecommendation:   null,
      // { portfolioType: string, date: ISO }
    },

    // Résultat du dernier stress-test (Prompt 4)
    stressTest: {
      lastLossPct:  null,   // Pourcentage de perte (0-100), ex : 15.3
      lastTestDate: null,   // Date ISO du test
    },

    // Contexte de la dernière simulation de projection (pour Q6)
    lastSimulation: null,   // { horizonYears: number, monthlyContribution: number }

    // Drapeaux d'actions uniques (attribués une seule fois)
    firstTime: {
      simulation:          false,
      stressTest:          false,
      fiscalSimulation:    false,
      fiscalReport:        false,
      envelopeCalibration: false,
      fiscalComparison:    false,   // simulation comparaison fiscale (Prompt 4)
      longTermProjection:  false,   // simulation ≥ 10 ans avec contribution > 0 (Prompt 5 Q3)
      comparedTERValues:   false,   // multi-sim ou 2 sims avec TER différents (Prompt 5 Q4)
      fiscalPFUSimulation: false,   // simulation PFU sur plus-value ≥ 1 000 € (Prompt 5 Q6)
    },

    // Flags booléens ponctuels (jamais remis à false après activation)
    flags: {
      simulatorFeesModified:      false,  // Q7  — simulation lancée avec frais > 0 dans le simulateur
      fiscalComparisonDone:       false,  // ex-Q10 — simulation PEA vs CTO complétée (rétrocompat)
      movementWithFeesAdded:      false,  // Q4  — mouvement enregistré avec frais > 0
      fiscalSimCTOOver1000:       false,  // Q9  — plus-value CTO simulée ≥ 1 000 €
      q11FiscalReportGenerated:   false,  // Q11 — rapport fiscal PDF généré PENDANT que Q11 est active
      q12BudgetTabVisited:        false,  // Q13 — onglet Budget du Calendrier consulté
      envelopeCalibrated:         false,  // Q10 — calibration enregistrée sur une enveloppe
      q13HealthScoreViewed:       false,  // Q14 — score de santé consulté PENDANT que Q14 est active
      onboardingWelcomeShown:     false,  // fenêtre de bienvenue affichée une seule fois au 1er lancement
    },

    // Vues ouvertes (session) — utilisées par les quêtes (Prompt 5) et les défis (Prompt 9).
    // Remises à false à chaque démarrage par gamificationService.resetSessionViewFlags().
    viewOpened: {
      calendarExpenses:     false,   // Q9
      healthScoreDetail:    false,   // Q10 + défi décembre
      driftView:            false,   // défi janvier
      objectivesPage:       false,
      crossoverPoint:       false,   // défi octobre
      portfolioPnL:         false,   // défi décembre
    },

    // Compteurs dégressifs
    counters: {
      assetsAdded:          0,
      envelopesCreated:     0,
      movementsRecorded:    0,
    },

    // Suivi de calibration mensuelle
    calibration: {
      lastCalibrationMonth: null,
      consecutiveMonths:    0,
      xpAwardedThisMonth:   false,
      totalCount:           0,   // cumul de calibrations mensuelles effectuées (badges F3)
    },

    // Séries de connexion
    streak: {
      currentStreak:      0,
      lastConnectionDate: null,
      longestStreak:      0,
      graceUsed:          false,
      milestonesAwarded:  [],   // int[] — paliers déjà récompensés (Prompt 10)
      flammeActiveUntil:  null, // ISO timestamp — flamme active 24h après milestone 7j (Prompt 12)
    },

    // Série de fidélité longue durée (badges vétéran F1) — distincte de `streak`.
    // Tolérance : connexion ≥ hebdomadaire la 1re année, puis ≥ mensuelle après 1 an.
    loyalty: {
      startDate:      null,   // YYYY-MM-DD — début de la série de fidélité active
      lastActiveDate: null,   // YYYY-MM-DD — dernière connexion prise en compte
    },

    // Préférences utilisateur
    preferences: {
      soundEnabled:        true,  // sons de level-up (Prompt 12)
      gamificationEnabled: true,  // affiche tutoriel / défi (Prompt 7)
    },

    // Trophées
    // clé : ID trophée (snake_case)
    // valeur : { unlocked: bool, unlockedAt: ISO date, xpAwarded: int }
    trophies: {},

    // Quêtes tutoriel
    // clé : "Q1"…"Q10"
    // valeur : { completed: bool, completedAt: ISO date }
    quests: {},
    currentQuestIndex: 1,

    // Défis mensuels (Prompt 9)
    challenges: {
      currentMonth: null,   // "YYYY-MM" du mois en cours
      completed:    false,  // miroir du mois courant (compat calendarService)
      completedAt:  null,

      // ── Missions mensuelles (catalogue 12 missions) ──────────────────────────
      // Complétion suivie PAR ANNÉE : { "YYYY-MM": ISO } — une mission par mois,
      // re-validable chaque année. Le badge correspondant reste acquis (permanent).
      completions: {},
      // Drapeaux de visite / action MENSUELS : { nomDuDrapeau: "YYYY-MM" }. Un drapeau
      // est « actif » pour le mois courant si sa valeur === mois courant → reset annuel
      // automatique (et mensuel) sans purge explicite.
      flags: {},

      // Champs de saisie utilisateur
      januaryNote:       '',    // note de réflexion saisie pour le défi de janvier
      aprilNote:         '',    // note sur les actifs défensifs pour le défi d'avril
      augustBenchmarkYTD: null, // float : performance YTD de l'indice saisi en août

      // Dates de suivi d'actions spécifiques (ISO date "YYYY-MM-DD")
      lastFiscalReportDate:       null, // quand le dernier rapport fiscal PDF a été généré
      lastHighInflationSimDate:   null, // quand une sim inflation ≥ 4 % et horizon ≥ 20 ans a été lancée
      lastFireSimDate:            null, // quand la dernière simulation FIRE a été lancée
      lastFireSimTargetAge:       null, // âge cible FIRE de la dernière simulation
      lastSevereStressTestDate:   null, // quand le stress test sévère (actions -50 %, crypto -60 %) a été lancé
      lastFiscalPEACTOCompDate:   null, // quand la comparaison fiscale PEA vs CTO a été lancée
      incomeUpdatedAt:            null, // quand monthlyNetIncome a été mis à jour
    },

    // Score de santé financière
    healthScore: {
      current: null,
      history: [],
      // history items: { date, score, breakdown: { sDiv, sPerf, sFrais, sRes, sInf, sLiq, bonus } }
    },

    // Objectifs personnels
    objectives: [],
    // items: { id, label, targetAmount, linkedEnvelopes, targetDate, icon, createdAt, badgeAwarded }

    // Quêtes diagnostiques déclenchées par le score de santé
    activeDiagnosticQuests: [],
    // items: { componentId, questText, triggeredAt, dismissed }

    // Dates de dernière vue pour notifications
    notifications: {
      lastDailyTipDate:              null,
      suppressedStreakWarningUntil:  null,
      // ── Prompt 11 — Notification Queue ─────────────────────────────────────
      items:                  [],    // { id, type, titleFr, messageFr, createdAt, read, action }
      fiscalPrepYear:         null,  // année où la notif prep fiscale a été envoyée
      fiscalDeadlineYear:     null,  // année où la notif deadline fiscale a été envoyée
      dailyCapDate:           null,  // date du jour du cap (YYYY-MM-DD)
      dailyCapCount:          0,     // nb notifs gamif envoyées aujourd'hui (max 2)
      lastBadgeCloseDate:     null,  // cooldown 24h pour badge-close notif
      fireMilestonesNotified: [],    // [25, 50, 75] — paliers FIRE déjà notifiés
      objectiveNotifSent:     {},    // { [objId_pct]: true }
      lastStreakWarningDate:   null,  // pour éviter double notif streak-danger/jour
      lastHealthDropDate:     null,  // pour éviter double notif health-drop/jour
    },

    // Temporalité (Prompt — Temporalité)
    // firstLaunchDate est initialisé une seule fois et ne doit JAMAIS être réécrit.
    // totalWeeksActive et missionsUnlocked sont recalculés à chaque démarrage.
    temporality: {
      firstLaunchDate:  null,   // YYYY-MM-DD — date du premier lancement, jamais réécrite
      lastLaunchDate:   null,   // YYYY-MM-DD — date du dernier lancement
      totalWeeksActive: 0,      // floor(daysSinceFirst / 7), recalculé à chaque démarrage
      missionsUnlocked: false,  // true si totalWeeksActive >= 1
    },

    // Version de schéma (migration automatique au chargement)
    // 1 = initial | 3 = insertion Q3/Q4/Q5, renumérotation Q3-Q10 → Q6-Q13
    // 4 = ajout flags.simulatorFeesModified et flags.fiscalComparisonDone
    // 5 = ajout flags.movementWithFeesAdded, fiscalSimCTOOver1000, q12BudgetTabVisited, envelopeCalibrated
    // 6 = ajout flags.q13HealthScoreViewed (évite l'auto-validation de Q13)
    // 7 = insertion Q11 "Rapport fiscal" — renumérotation quêtes Q11→Q12, Q12→Q13, Q13→Q14
    //     ajout flags.q11FiscalReportGenerated
    // 8 = ajout temporality.firstLaunchDate (suivi temporel robuste)
    // 9 = ajout calibration.totalCount + loyalty (badges vétéran F1/F3)
    schemaVersion: 9,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. DEEP-MERGE (migration)
//    Ajoute les clés manquantes depuis `source` dans `target` sans écraser
//    les valeurs existantes. Les tableaux dans `target` sont conservés tels
//    quels (pas de fusion élément par élément).
// ═══════════════════════════════════════════════════════════════════════════════

function _deepMergeDefaults(target, source) {
  if (typeof source !== 'object' || source === null) return target;
  if (typeof target !== 'object' || target === null) return source;

  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (!(key in result)) {
      // Clé entièrement manquante : copier depuis les defaults
      result[key] = JSON.parse(JSON.stringify(source[key]));
    } else if (
      typeof source[key] === 'object' &&
      source[key] !== null &&
      !Array.isArray(source[key]) &&
      typeof result[key] === 'object' &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      // Les deux sont des objets → récursion
      result[key] = _deepMergeDefaults(result[key], source[key]);
    }
    // Sinon : la valeur existante dans target est conservée
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. MIGRATION DE SCHÉMA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Migration v3 — Insertion des quêtes Q3/Q4/Q5 (profil, premier mouvement,
 * investisseur régulier), renumérotation des anciennes Q3-Q10 en Q6-Q13.
 *
 * Appelée depuis loadState() quand savedVersion < 3.
 * Modifie _state en place puis appelle saveState().
 */
function _migrateToV3() {
  // 1. Quêtes : renommer Q3→Q6, Q4→Q7, ..., Q10→Q13
  const questMap = { Q3:'Q6', Q4:'Q7', Q5:'Q8', Q6:'Q9', Q7:'Q10', Q8:'Q11', Q9:'Q12', Q10:'Q13' };
  const migratedQuests = {};
  for (const [id, entry] of Object.entries(_state.quests || {})) {
    migratedQuests[questMap[id] || id] = entry;
  }
  _state.quests = migratedQuests;

  // 2. Index de quête courant : si 3–10, décaler de +3
  const idx = _state.currentQuestIndex ?? 1;
  if (idx >= 3 && idx <= 10) _state.currentQuestIndex = idx + 3;

  // 3. Trophées tutoriel : renommer quest_3_done→quest_6_done … quest_10_done→quest_13_done
  const trophyMap = {
    'quest_3_done':  'quest_6_done',
    'quest_4_done':  'quest_7_done',
    'quest_5_done':  'quest_8_done',
    'quest_6_done':  'quest_9_done',
    'quest_7_done':  'quest_10_done',
    'quest_8_done':  'quest_11_done',
    'quest_9_done':  'quest_12_done',
    'quest_10_done': 'quest_13_done',
  };
  const migratedTrophies = {};
  for (const [id, entry] of Object.entries(_state.trophies || {})) {
    migratedTrophies[trophyMap[id] || id] = entry;
  }
  _state.trophies = migratedTrophies;

  _state.schemaVersion = 3;
  saveState();
}

/**
 * Migration v4 — Ajout de flags.simulatorFeesModified et flags.fiscalComparisonDone.
 *
 * Les deux champs sont ajoutés automatiquement par _deepMergeDefaults si absents.
 * Cette fonction se contente de marquer la version et de persister.
 */
function _migrateToV4() {
  // _deepMergeDefaults a déjà ajouté flags.simulatorFeesModified et flags.fiscalComparisonDone
  // si ces clés étaient absentes — aucune transformation manuelle supplémentaire requise.
  _state.schemaVersion = 4;
  saveState();
}

/**
 * Migration v5 — Ajout de flags.movementWithFeesAdded, fiscalSimCTOOver1000,
 * q12BudgetTabVisited et envelopeCalibrated.
 *
 * _deepMergeDefaults les insère déjà si absents. On se contente de bumper la version.
 */
function _migrateToV5() {
  _state.schemaVersion = 5;
  saveState();
}

/**
 * Migration v6 — Ajout de flags.q13HealthScoreViewed.
 * _deepMergeDefaults l'insère déjà si absent. On se contente de bumper la version.
 */
function _migrateToV6() {
  _state.schemaVersion = 6;
  saveState();
}

/**
 * Migration v7 — Insertion de la quête Q11 "Rapport fiscal".
 *
 * Les anciennes quêtes Q11, Q12, Q13 deviennent Q12, Q13, Q14.
 * Pour les utilisateurs déjà au-delà de Q10 :
 *   - Les enregistrements de complétion sont copiés : Q11→Q12, Q12→Q13, Q13→Q14.
 *   - La nouvelle Q11 est marquée auto-complétée (migration) pour ne pas forcer
 *     les utilisateurs existants à générer un rapport fiscal rétrospectivement.
 *   - currentQuestIndex est incrémenté de 1 pour pointer vers la bonne quête.
 */
function _migrateToV7() {
  const oldQuests = _state.quests || {};
  const newQuests = {};

  // Copier Q1-Q10 inchangées
  ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'Q10'].forEach(id => {
    if (oldQuests[id]) newQuests[id] = oldQuests[id];
  });

  // Décaler les anciennes Q11, Q12, Q13 vers Q12, Q13, Q14
  if (oldQuests['Q11']) newQuests['Q12'] = oldQuests['Q11'];
  if (oldQuests['Q12']) newQuests['Q13'] = oldQuests['Q12'];
  if (oldQuests['Q13']) newQuests['Q14'] = oldQuests['Q13'];

  // Pour les utilisateurs déjà au-delà de Q10 : auto-compléter Q11 (migration silencieuse)
  const oldIdx = _state.currentQuestIndex ?? 1;
  if (oldIdx > 10) {
    newQuests['Q11'] = {
      completed:   true,
      completedAt: new Date().toISOString(),
      migrated:    true,   // indique que cette complétion est issue d'une migration
    };
    _state.currentQuestIndex = oldIdx + 1;
  }

  _state.quests = newQuests;
  _state.schemaVersion = 7;
  saveState();
}

/**
 * Migration v8 — Ajout de temporality.firstLaunchDate.
 * _deepMergeDefaults a déjà ajouté le bloc temporality si absent.
 * Cette migration initialise firstLaunchDate à aujourd'hui pour les sauvegardes
 * existantes qui n'ont pas encore cette information.
 */
function _migrateToV8() {
  if (!_state.temporality) {
    _state.temporality = {
      firstLaunchDate:  null,
      lastLaunchDate:   null,
      totalWeeksActive: 0,
      missionsUnlocked: false,
    };
  }
  // Pour les utilisateurs existants, firstLaunchDate sera fixé à aujourd'hui
  // par _ensureFirstLaunchDate() juste après le bloc de migrations.
  _state.schemaVersion = 8;
  saveState();
}

// ── Helpers de date (locaux — pas d'import externe) ───────────────────────────

/**
 * Retourne la date du jour au format YYYY-MM-DD (heure locale).
 * @returns {string}
 */
function _todayString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Nombre de jours calendaires entre deux dates YYYY-MM-DD (dateB - dateA).
 * Les heures/fuseaux horaires n'entrent pas en jeu : on compare les dates
 * en millisecondes à minuit UTC pour éviter les dérives DST.
 * @param {string} dateA
 * @param {string} dateB
 * @returns {number}
 */
function _daysBetweenDates(dateA, dateB) {
  const msA = Date.UTC(
    parseInt(dateA.slice(0, 4), 10),
    parseInt(dateA.slice(5, 7), 10) - 1,
    parseInt(dateA.slice(8, 10), 10)
  );
  const msB = Date.UTC(
    parseInt(dateB.slice(0, 4), 10),
    parseInt(dateB.slice(5, 7), 10) - 1,
    parseInt(dateB.slice(8, 10), 10)
  );
  return Math.round((msB - msA) / 86_400_000);
}

/**
 * S'assure que temporality.firstLaunchDate est renseigné.
 * Si null ou absent, le fixe à aujourd'hui. Ne le réécrit JAMAIS si déjà défini.
 */
function _ensureFirstLaunchDate() {
  if (!_state.temporality) {
    _state.temporality = {
      firstLaunchDate:  null,
      lastLaunchDate:   null,
      totalWeeksActive: 0,
      missionsUnlocked: false,
    };
  }
  if (!_state.temporality.firstLaunchDate) {
    _state.temporality.firstLaunchDate = _todayString();
    saveState();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. ÉTAT EN MÉMOIRE
// ═══════════════════════════════════════════════════════════════════════════════

let _state = _buildDefaultState();

// ═══════════════════════════════════════════════════════════════════════════════
// 6. PERSISTANCE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Charge l'état depuis localStorage.
 * À appeler une seule fois au démarrage de l'application.
 * Si aucun état n'est trouvé, initialise avec les valeurs par défaut.
 * Si un état partiel est trouvé, fusionne avec les valeurs par défaut.
 */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      _state = _buildDefaultState();
      _ensureFirstLaunchDate();   // fixe firstLaunchDate dès le premier lancement
      return;
    }
    const parsed = JSON.parse(raw);
    // Capturer la version AVANT le deep-merge (le merge remplirait schemaVersion=3)
    const savedVersion = parsed?.schemaVersion ?? 1;
    _state = _deepMergeDefaults(parsed, _buildDefaultState());
    // Appliquer les migrations nécessaires
    if (savedVersion < 3) _migrateToV3();
    if (savedVersion < 4) _migrateToV4();
    if (savedVersion < 5) _migrateToV5();
    if (savedVersion < 6) _migrateToV6();
    if (savedVersion < 7) _migrateToV7();
    if (savedVersion < 8) _migrateToV8();
    // Garantir que firstLaunchDate est toujours défini (y compris après migration)
    _ensureFirstLaunchDate();
    // Nettoyage : supprimer le champ tmi des anciennes sauvegardes (champ retiré)
    if (_state.profile && 'tmi' in _state.profile) {
      delete _state.profile.tmi;
    }
    // Système d'XP supprimé : on purge le bloc hérité des anciennes sauvegardes.
    if (_state.xp) delete _state.xp;
    // B-04 : une installation antérieure au correctif a écrit revenu, naissance et
    // allocation EN CLAIR dans localStorage. Les valeurs sont gardées en mémoire pour
    // la session, mais la copie sur disque est réécrite expurgée immédiatement, sans
    // attendre la prochaine modification du profil.
    saveState();
  } catch (e) {
    console.warn('[gamificationService] Erreur de lecture localStorage, réinitialisation.', e);
    _state = _buildDefaultState();
  }
}

/**
 * Retire de l'état les champs personnels ou financiers avant écriture dans localStorage.
 *
 * SÉCURITÉ (B-04) : le stockage local du navigateur embarqué n'est JAMAIS chiffré. Y
 * écrire le revenu, la date de naissance ou l'allocation cible contredirait la promesse
 * du chiffrement des sauvegardes : l'utilisateur croit protéger ses données financières
 * alors qu'une copie en clair resterait lisible sur le disque. Ces valeurs vivent en
 * mémoire pendant la session et dans la sauvegarde JSON (chiffrée si activé), d'où elles
 * sont restaurées au démarrage par importFromJSON. Le reste — progression, trophées,
 * compteurs, drapeaux — n'est pas sensible et reste persisté localement pour survivre à
 * un redémarrage même sans sauvegarde chargée.
 */
function _redigerPourStockageLocal(state) {
  const copie = JSON.parse(JSON.stringify(state));
  if (copie.profile) {
    copie.profile.birthDate = null;
    copie.profile.monthlyNetIncome = null;
    copie.profile.annualReturnTarget = null;
    copie.profile.allocationTarget = {};
    copie.profile.lastFiscalRecommendation = null;
  }
  if (copie.stressTest) copie.stressTest.lastLossPct = null;
  copie.lastSimulation = null;
  return copie;
}

/**
 * Sauvegarde l'état courant dans localStorage — expurgé des champs sensibles (voir
 * _redigerPourStockageLocal). À appeler après chaque mutation de `_state`.
 */
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_redigerPourStockageLocal(_state)));
  } catch (e) {
    console.error('[gamificationService] Erreur d\'écriture localStorage.', e);
  }
}

/**
 * Réinitialise entièrement l'état de gamification et le persiste.
 */
function resetState() {
  _state = _buildDefaultState();
  saveState();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. ACCESSEURS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Retourne une référence directe à l'état courant.
 * Ne pas muter directement — utiliser patchState() ou les helpers métier.
 */
function getState() {
  return _state;
}

/**
 * Fusionne un objet partiel dans l'état courant et sauvegarde.
 * @param {Object} partial — peut être imbriqué ; seul le premier niveau est mergé.
 *
 * Exemple : patchState({ xp: { total: 100, level: 2 } })
 *   → remplace _state.xp.total et _state.xp.level, conserve _state.xp.history
 */
// Champs dont la valeur sensible n'est PLUS dans localStorage (voir
// _redigerPourStockageLocal) : quand l'un d'eux change, la sauvegarde JSON — seul
// support durable de ces valeurs — doit être réécrite, sinon elles seraient perdues au
// redémarrage. dataService enregistre ce hook (setPersistHook) ; pas d'import inverse.
const SENSIBLE_KEYS = new Set(['profile', 'stressTest', 'lastSimulation']);
let _persistHook = null;

/** Enregistre la fonction qui persiste la sauvegarde JSON (fournie par dataService). */
function setPersistHook(fn) {
  _persistHook = typeof fn === 'function' ? fn : null;
}

function patchState(partial) {
  const profilePatched = 'profile' in partial;
  const touchePersistant = Object.keys(partial).some((k) => SENSIBLE_KEYS.has(k));
  for (const key of Object.keys(partial)) {
    if (
      typeof partial[key] === 'object' &&
      partial[key] !== null &&
      !Array.isArray(partial[key]) &&
      typeof _state[key] === 'object' &&
      _state[key] !== null &&
      !Array.isArray(_state[key])
    ) {
      _state[key] = { ..._state[key], ...partial[key] };
    } else {
      _state[key] = partial[key];
    }
  }
  saveState();
  // Ces valeurs ne survivent qu'à travers la sauvegarde JSON : on la réécrit maintenant.
  if (touchePersistant && _persistHook) {
    try { _persistHook(); } catch (_) { /* la persistance ne doit pas casser la gamification */ }
  }
  // Notifier les abonnés quand le profil utilisateur change
  if (profilePatched) {
    _emit('profileUpdated', { ..._state.profile });
  }
  // Notifier les abonnés quand les préférences changent (ex: gamificationEnabled)
  if ('preferences' in partial) {
    _emit('preferencesUpdated', { ..._state.preferences });
  }
}

/**
 * Remet à false tous les flags `viewOpened` au démarrage de session.
 * Les quêtes et défis exigent que la vue concernée soit ouverte DURANT la
 * session courante. À appeler une fois au montage de l'application.
 */
function resetSessionViewFlags() {
  const reset = Object.fromEntries(
    Object.keys(_state.viewOpened || {}).map(k => [k, false])
  );
  _state.viewOpened = reset;
  saveState();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. IMPORT / EXPORT (intégration JSON global)
//    Ces deux fonctions sont appelées par dataService lors des exports/imports
//    afin que la gamification suive les migrations de données.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Retourne une copie sérialisable de l'état pour inclusion dans l'export JSON.
 */
function exportForJSON() {
  return JSON.parse(JSON.stringify(_state));
}

/**
 * Restaure l'état depuis un objet issu d'un import JSON.
 * Merge avec les defaults pour gérer les champs manquants.
 *
 * firstLaunchDate est préservé selon la règle suivante :
 *   - Si le JSON importé contient une firstLaunchDate, elle est conservée
 *     (elle représente le vrai premier lancement de l'utilisateur).
 *   - Sinon, on tente de conserver l'actuelle firstLaunchDate en mémoire,
 *     puis on fallback à aujourd'hui.
 *
 * @param {Object} data — objet `gamification` du JSON importé
 */
function importFromJSON(data) {
  if (!data || typeof data !== 'object') return;
  // Préserver la firstLaunchDate la plus ancienne disponible
  const importedFld  = data.temporality?.firstLaunchDate ?? null;
  const currentFld   = _state.temporality?.firstLaunchDate ?? null;
  const resolvedFld  = importedFld || currentFld || _todayString();

  _state = _deepMergeDefaults(data, _buildDefaultState());
  // Écraser ce que _deepMergeDefaults a pu mettre dans temporality.firstLaunchDate
  _state.temporality = {
    ..._state.temporality,
    firstLaunchDate: resolvedFld,
    lastLaunchDate:  _todayString(),
  };
  saveState();
}

/**
 * Recalcule les champs dérivés de `temporality` depuis `firstLaunchDate`.
 *
 * À appeler au démarrage de l'application, APRÈS loadState() et AVANT
 * tout service qui lit `temporality.totalWeeksActive` ou `missionsUnlocked`
 * (trophies, healthScore, missions…).
 *
 * Règles :
 *   - totalWeeksActive = floor(daysSinceFirstLaunch / 7)  (0 la première semaine)
 *   - missionsUnlocked = totalWeeksActive >= 1            (missions dispo dès la 2e semaine)
 *   - lastLaunchDate   = today
 *
 * Future-date guard : si firstLaunchDate est dans le futur (sauvegarde corrompue),
 * on la réinitialise à aujourd'hui pour repartir proprement.
 */
function recalculateTemporality() {
  const today = _todayString();
  let fld = _state.temporality?.firstLaunchDate || today;

  // Guard : firstLaunchDate ne doit pas être dans le futur
  if (fld > today) {
    fld = today;
  }

  const daysSinceFirst  = Math.max(0, _daysBetweenDates(fld, today));
  const totalWeeksActive = Math.floor(daysSinceFirst / 7);
  const missionsUnlocked = totalWeeksActive >= 1;

  _state.temporality = {
    ..._state.temporality,
    firstLaunchDate:  fld,
    lastLaunchDate:   today,
    totalWeeksActive,
    missionsUnlocked,
  };
  saveState();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. FONCTIONS PURES — NIVEAU ET PROGRESSION
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// 9. HELPERS DE LECTURE (lecture seule, sans effet de bord)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Retourne le profil utilisateur courant (lecture seule).
 */
function getProfile() {
  return { ..._state.profile };
}

/**
 * Vérifie si un trophée est déjà débloqué.
 * @param {string} trophyId
 */
function isTrophyUnlocked(trophyId) {
  return !!(_state.trophies[trophyId]?.unlocked);
}

/**
 * Vérifie si une quête tutoriel est complétée.
 * @param {string} questId — ex: "Q1"
 */
function isQuestCompleted(questId) {
  return !!(_state.quests[questId]?.completed);
}

/**
 * Retourne l'index de quête courante (1-based).
 */
function getCurrentQuestIndex() {
  return _state.currentQuestIndex ?? 1;
}

/**
 * Retourne les données de la série de connexion courante.
 */
function getStreakInfo() {
  return { ..._state.streak };
}

/**
 * Retourne le score de santé courant (null si pas encore calculé).
 */
function getCurrentHealthScore() {
  return _state.healthScore.current;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 11. BUS D'ÉVÉNEMENTS INTERNE
//     Permet aux composants UI de s'abonner aux événements de gamification
//     (level-up, trophée, etc.) sans couplage direct.
// ═══════════════════════════════════════════════════════════════════════════════

/** @type {Record<string, Function[]>} */
const _events = {};

/**
 * Émet un événement nommé avec des données optionnelles.
 * @param {string} eventName
 * @param {*}      data
 */
function _emit(eventName, data) {
  (_events[eventName] || []).forEach(fn => {
    try { fn(data); } catch (e) {
      console.error(`[gamificationService] Erreur dans listener "${eventName}":`, e);
    }
  });
}

/**
 * S'abonne à un événement de gamification.
 * @param {string}   eventName  — ex: "levelUp", "trophyUnlocked"
 * @param {Function} fn         — appelée avec les données de l'événement
 * @returns {Function}          — fonction pour se désabonner
 *
 * Événements émis :
 *   "progressUpdated" → { reason }  (une action utilisateur a fait avancer l'état)
 *   "trophyUnlocked"  → { trophyId }
 *   "profileUpdated"  → { ...profile }  (émis par patchState quand profile change)
 */
function onEvent(eventName, fn) {
  if (!_events[eventName]) _events[eventName] = [];
  _events[eventName].push(fn);
  return () => {
    _events[eventName] = (_events[eventName] || []).filter(l => l !== fn);
  };
}

/**
 * Signale qu'une action utilisateur a fait progresser l'état : persiste et
 * réveille les observateurs (trophées, quêtes, défis, widgets de l'UI).
 *
 * Remplace l'ancien `awardXP` — le système d'XP et de niveaux a été supprimé,
 * mais le signal « quelque chose a bougé » reste nécessaire.
 *
 * @param {string} reason — identifiant lisible par machine (snake_case)
 */
function notifyProgress(reason) {
  saveState();
  _emit('progressUpdated', { reason });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 13. HOOKS DÉGRÉSSIFS — appelés depuis dataService.js
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * À appeler chaque fois qu'un actif (mouvement type) est créé.
 * Incrémente le compteur APRÈS l'attribution des XP.
 */
function onAssetAdded() {
  _state.counters.assetsAdded += 1;
  notifyProgress('asset_added');
}

/**
 * À appeler chaque fois qu'une enveloppe est créée.
 * Incrémente le compteur APRÈS l'attribution des XP.
 */
function onEnvelopeCreated() {
  _state.counters.envelopesCreated += 1;
  notifyProgress('envelope_created');
}

/**
 * À appeler chaque fois qu'UN mouvement est enregistré (non-récurrent)
 * OU une fois pour l'ensemble d'une série récurrente.
 * Incrémente le compteur APRÈS l'attribution des XP.
 */
function onMovementRecorded() {
  _state.counters.movementsRecorded += 1;
  notifyProgress('movement_recorded');
}

/**
 * Vérifie et attribue les XP pour une action unique (flag firstTime).
 * Si le flag est déjà `true`, ne fait rien.
 *
 * @param {string} flagKey   — clé dans `_state.firstTime`
 * @param {number} [_legacyXp] — ancien montant d'XP, ignoré (compat. appelants)
 * @param {string} reason    — raison (snake_case)
 */
function onFirstTimeAction(flagKey, _legacyXp, reason) {
  if (_state.firstTime[flagKey] === false) {
    _state.firstTime[flagKey] = true;
    notifyProgress(reason);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 14. CALIBRATION MENSUELLE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Détermine si `currentMonth` suit directement `lastMonth` (mois consécutifs).
 * @param {string} lastMonth    — "YYYY-MM"
 * @param {string} currentMonth — "YYYY-MM"
 * @returns {boolean}
 */
function _isConsecutiveMonth(lastMonth, currentMonth) {
  const [ly, lm] = lastMonth.split('-').map(Number);
  let ny = ly;
  let nm = lm + 1;
  if (nm > 12) { nm = 1; ny++; }
  return `${ny}-${String(nm).padStart(2, '0')}` === currentMonth;
}

/**
 * À appeler lorsque l'utilisateur complète le workflow de calibration mensuelle.
 * Gère la base (50 XP), les séries consécutives et leurs bonus.
 */
function handleMonthlyCalibration() {
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const lastMonth    = _state.calibration.lastCalibrationMonth;

  // Déjà calibré ce mois-ci → pas de double attribution
  if (lastMonth === currentMonth) return;

  // Détection de saut de mois → remise à zéro du compteur de série
  if (lastMonth && !_isConsecutiveMonth(lastMonth, currentMonth)) {
    _state.calibration.consecutiveMonths = 0;
  }

  // Mise à jour de l'état AVANT les bonus (pour que le bonus reflète la nouvelle série)
  _state.calibration.consecutiveMonths    += 1;
  _state.calibration.lastCalibrationMonth  = currentMonth;
  _state.calibration.xpAwardedThisMonth    = true;
  _state.calibration.totalCount = (_state.calibration.totalCount || 0) + 1; // cumul (badges F3)

  notifyProgress('monthly_calibration');

  // Trophées de série calibration (Prompt 10) — lazy import pour éviter dep circulaire
  try {
    const streakSvc = require('./streakService').default;
    streakSvc.checkCalibrationTrophies(_state.calibration.consecutiveMonths);
  } catch (_) {}

  saveState(); // persist consecutiveMonths + lastCalibrationMonth
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

const gamificationService = {
  // Persistance
  loadState,
  saveState,
  resetState,

  // Accès à l'état
  getState,
  patchState,
  setPersistHook,
  resetSessionViewFlags,

  // Import / export JSON global
  exportForJSON,
  importFromJSON,

  // Temporalité
  recalculateTemporality,

  // Signal de progression (remplace l'ancien moteur XP)
  notifyProgress,

  // Hooks dégréssifs (appelés depuis dataService)
  onAssetAdded,
  onEnvelopeCreated,
  onMovementRecorded,
  onFirstTimeAction,
  handleMonthlyCalibration,

  // Bus d'événements
  onEvent,
  dispatchEvent: _emit,     // accès externe pour trophyService (Prompt 4)

  // Helpers de lecture
  getProfile,
  isTrophyUnlocked,
  isQuestCompleted,
  getCurrentQuestIndex,
  getStreakInfo,
  getCurrentHealthScore,
};

export default gamificationService;

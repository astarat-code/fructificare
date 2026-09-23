// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * trophyService.js — Fructificare's trophy and badge system
 *
 * This service is independent: it imports dataService and gamificationService, but neither
 * of those imports it (no circular dependency).
 *
 * ARCHITECTURE:
 *   • TROPHY_CATALOG   — 50 statically defined trophies (stable IDs)
 *   • _getCheckData()  — assembles the data every check needs (called once per pass)
 *   • check_<id>(d)    — pure functions verifying the conditions
 *   • checkAllTrophies()           — full pass (unlock + revoke)
 *   • checkAndUnlockTrophy(id, d)  — checks and unlocks one specific trophy
 *   • revokeTrophyIfNeeded(id, d)  — revokes when the condition no longer holds
 *   • checkObjectiveBadge(obj)     — one-off badge for a personal goal reached
 *   • recordStressTestResult(pct)  — called from SimulationDetail after a stress test
 *   • recordFiscalRecommendation(portfolioType) — called from TaxSimulator
 *   • initTrophyWatcher()          — subscribes the automatic checks to the XP bus
 *   • getTrophiesWithMeta()        — enriched list for the UI
 *
 * PUBLIC API:
 *   trophyService.checkAllTrophies()
 *   trophyService.checkAndUnlockTrophy(trophyId)
 *   trophyService.revokeTrophyIfNeeded(trophyId)
 *   trophyService.checkObjectiveBadge(objective)
 *   trophyService.recordStressTestResult(lossPercent)
 *   trophyService.recordFiscalRecommendation(portfolioType)
 *   trophyService.initTrophyWatcher()
 *   trophyService.getTrophiesWithMeta()
 *   trophyService.TROPHY_CATALOG
 */

import dataService      from './dataService';
import gamificationService from './gamificationService';

// ─── Re-entrancy guard (empêche la boucle progressUpdated → checkAll → notifyProgress) ──
let _checkingTrophies = false;

// ─── Lazy questService (évite la dépendance circulaire) ──────────────────────
function _getQuestService() {
  try { return require('./questService').default; } catch (_) { return null; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CATALOGUE DES 47 TROPHÉES
//    checkFn est renseigné après la déclaration des fonctions de vérification.
// ═══════════════════════════════════════════════════════════════════════════════

const TROPHY_CATALOG = [

  // ── Utilisateur U1-U13 — badges du parcours tutoriel, attribués à la complétion de chaque quête ──
  { id: 'badge_fondateur',             category: 'utilisateur', emoji: '🏅', labelFr: 'Fondateur',             labelEn: 'Founder',              xpReward: 200, isPermanent: true, checkFn: null },
  { id: 'badge_debutant_motive',       category: 'utilisateur', emoji: '🏅', labelFr: 'Débutant motivé',       labelEn: 'Motivated Beginner',   xpReward: 200, isPermanent: true, checkFn: null },
  { id: 'badge_profil_complet',        category: 'utilisateur', emoji: '🏅', labelFr: 'Profil complet',        labelEn: 'Complete Profile',     xpReward: 150, isPermanent: true, checkFn: null },
  { id: 'badge_chasseur_de_frais',     category: 'utilisateur', emoji: '🏅', labelFr: 'Chasseur de frais',     labelEn: 'Fee Hunter',           xpReward: 150, isPermanent: true, checkFn: null },
  { id: 'badge_investisseur_regulier', category: 'utilisateur', emoji: '🏅', labelFr: 'Investisseur régulier', labelEn: 'Regular Investor',     xpReward: 200, isPermanent: true, checkFn: null },
  { id: 'badge_voyant',                category: 'utilisateur', emoji: '🏅', labelFr: 'Voyant',                labelEn: 'Visionary',            xpReward: 300, isPermanent: true, checkFn: null },
  { id: 'badge_oeil_de_lynx',          category: 'utilisateur', emoji: '🏅', labelFr: 'Œil de lynx',           labelEn: 'Eagle Eye',            xpReward: 250, isPermanent: true, checkFn: null },
  { id: 'badge_resistant',             category: 'utilisateur', emoji: '🏅', labelFr: 'Résistant',             labelEn: 'Resilient',            xpReward: 400, isPermanent: true, checkFn: null },
  { id: 'badge_citoyen_fiscal',        category: 'utilisateur', emoji: '🏅', labelFr: 'Citoyen fiscal',        labelEn: 'Tax-Aware Citizen',    xpReward: 300, isPermanent: true, checkFn: null },
  { id: 'badge_investisseur_precis',   category: 'utilisateur', emoji: '🏅', labelFr: 'Investisseur précis',   labelEn: 'Precise Investor',     xpReward: 250, isPermanent: true, checkFn: null },
  { id: 'badge_declarant_averti',      category: 'utilisateur', emoji: '🏅', labelFr: 'Déclarant averti',      labelEn: 'Informed Taxpayer',    xpReward: 250, isPermanent: true, checkFn: null },
  { id: 'badge_architecte_de_vie',     category: 'utilisateur', emoji: '🏅', labelFr: 'Architecte de vie',     labelEn: 'Life Architect',       xpReward: 250, isPermanent: true, checkFn: null },
  { id: 'badge_organisateur',          category: 'utilisateur', emoji: '🏅', labelFr: 'Organisateur',          labelEn: 'Organiser',            xpReward: 200, isPermanent: true, checkFn: null },
  { id: 'badge_stratege_lucide',       category: 'utilisateur', emoji: '🏅', labelFr: 'Stratège lucide',       labelEn: 'Clear-headed Strategist', xpReward: 250, isPermanent: true, checkFn: null },

  // ── Tutorial T1-T13 — permanent ──────────────────────────────────────────
  { id: 'quest_1_done',  category: 'tutorial', emoji: '🎓', labelFr: 'Prise en main',              labelEn: 'Getting Started',             xpReward:  50, isPermanent: true,  checkFn: null },
  { id: 'quest_2_done',  category: 'tutorial', emoji: '💼', labelFr: 'Ma première enveloppe',       labelEn: 'My First Account',             xpReward:  60, isPermanent: true,  checkFn: null },
  { id: 'quest_3_done',  category: 'tutorial', emoji: '👤', labelFr: 'Profil complété',             labelEn: 'Profile Complete',             xpReward:  40, isPermanent: true,  checkFn: null },
  { id: 'quest_4_done',  category: 'tutorial', emoji: '📝', labelFr: 'Premier mouvement',           labelEn: 'First Transaction',            xpReward:  50, isPermanent: true,  checkFn: null },
  { id: 'quest_5_done',  category: 'tutorial', emoji: '🔁', labelFr: 'Investisseur régulier',       labelEn: 'Consistent Investor',          xpReward:  55, isPermanent: true,  checkFn: null },
  { id: 'quest_6_done',  category: 'tutorial', emoji: '💰', labelFr: 'Premier versement',           labelEn: 'First Contribution',           xpReward:  50, isPermanent: true,  checkFn: null },
  { id: 'quest_7_done',  category: 'tutorial', emoji: '📊', labelFr: 'Analyste en herbe',           labelEn: 'Junior Analyst',               xpReward:  75, isPermanent: true,  checkFn: null },
  { id: 'quest_8_done',  category: 'tutorial', emoji: '🔄', labelFr: 'Stratège',                    labelEn: 'Strategist',                   xpReward:  70, isPermanent: true,  checkFn: null },
  { id: 'quest_9_done',  category: 'tutorial', emoji: '📅', labelFr: 'Contribuable éclairé',        labelEn: 'Informed Taxpayer',            xpReward:  80, isPermanent: true,  checkFn: null },
  { id: 'quest_10_done', category: 'tutorial', emoji: '🧮', labelFr: 'Ingénieur fiscal',            labelEn: 'Tax Engineer',                 xpReward:  90, isPermanent: true,  checkFn: null },
  { id: 'quest_11_done', category: 'tutorial', emoji: '📈', labelFr: 'Architecte de sa vie',        labelEn: 'Life Architect',               xpReward:  85, isPermanent: true,  checkFn: null },
  { id: 'quest_12_done', category: 'tutorial', emoji: '🏥', labelFr: 'Diagnostic budget',           labelEn: 'Budget Diagnosis',             xpReward: 100, isPermanent: true,  checkFn: null },
  { id: 'quest_13_done', category: 'tutorial', emoji: '🏆', labelFr: 'Padawan accompli',            labelEn: 'Accomplished Padawan',         xpReward: 150, isPermanent: true,  checkFn: null },
  { id: 'quest_14_done', category: 'tutorial', emoji: '🌟', labelFr: 'Tutoriel terminé',            labelEn: 'Tutorial Complete',            xpReward: 200, isPermanent: true,  checkFn: null },

  // ── Régularité — permanent ───────────────────────────────────────────────
  { id: 'ecureuil',        category: 'regularity', emoji: '🐿️', labelFr: 'L\'Écureuil — 3 mois consécutifs de versements manuels', labelEn: 'The Squirrel — 3 consecutive months of manual contributions', xpReward:  75, isPermanent: true, checkFn: null },
  { id: 'fourmi',          category: 'regularity', emoji: '🐜', labelFr: 'Fourmi — 3 mois de calibration consécutifs',               labelEn: 'The Ant — 3 consecutive calibration months',                  xpReward: 100, isPermanent: true, checkFn: null },
  { id: 'guepard',         category: 'regularity', emoji: '🐆', labelFr: 'Guépard — série de 7 jours',                               labelEn: 'Cheetah — 7-day streak',                                      xpReward:  50, isPermanent: true, checkFn: null },
  { id: 'marathonien',     category: 'regularity', emoji: '🏃', labelFr: 'Marathonien — série de 30 jours',                          labelEn: 'Marathon Runner — 30-day streak',                              xpReward: 150, isPermanent: true, checkFn: null },
  { id: 'centurion_streak',category: 'regularity', emoji: '🛡️', labelFr: 'Centurion — série de 100 jours',                           labelEn: 'Centurion — 100-day streak',                                  xpReward: 300, isPermanent: true, checkFn: null },
  { id: 'horloge_suisse',  category: 'regularity', emoji: '⏱️', labelFr: 'Horloge suisse — calibration 6 mois consécutifs',          labelEn: 'Swiss Watch — 6 consecutive calibration months',              xpReward: 200, isPermanent: true, checkFn: null },
  { id: 'maitre_du_temps', category: 'regularity', emoji: '⌛', labelFr: 'Maître du temps — calibration 12 mois consécutifs',        labelEn: 'Master of Time — 12 consecutive calibration months',          xpReward: 400, isPermanent: true, checkFn: null },

  // ── Patrimoine — permanent (les jalons restent acquis) ───────────────────
  { id: 'premiers_pas_patrimoine', category: 'patrimony', emoji: '🌱', labelFr: 'Premier millier — 1 000 € investis',      labelEn: 'First Thousand — €1,000 invested',       xpReward:   30, isPermanent: true, checkFn: null },
  { id: 'cap_10k',                 category: 'patrimony', emoji: '💵', labelFr: 'Cap des 10 000 €',                        labelEn: '€10,000 Milestone',                       xpReward:   60, isPermanent: true, checkFn: null },
  { id: 'investisseur_serieux',    category: 'patrimony', emoji: '💼', labelFr: 'Investisseur sérieux — 25 000 €',         labelEn: 'Serious Investor — €25,000',              xpReward:  100, isPermanent: true, checkFn: null },
  { id: 'cap_50k',                 category: 'patrimony', emoji: '🥈', labelFr: 'Cap des 50 000 €',                        labelEn: '€50,000 Milestone',                       xpReward:  150, isPermanent: true, checkFn: null },
  { id: 'centenaire',              category: 'patrimony', emoji: '💯', labelFr: 'Les 100 000 €',                           labelEn: 'The €100,000 Mark',                       xpReward:  250, isPermanent: true, checkFn: null },
  { id: 'quart_million',           category: 'patrimony', emoji: '🥇', labelFr: 'Quart de million — 250 000 €',            labelEn: 'Quarter Million — €250,000',              xpReward:  400, isPermanent: true, checkFn: null },
  { id: 'demi_million',            category: 'patrimony', emoji: '💎', labelFr: 'Demi-million — 500 000 €',                labelEn: 'Half a Million — €500,000',               xpReward:  600, isPermanent: true, checkFn: null },
  { id: 'millionnaire',            category: 'patrimony', emoji: '🏰', labelFr: 'Le Million',                              labelEn: 'The Million',                             xpReward: 1000, isPermanent: true, checkFn: null },

  // ── Gains — non permanent (PnL latent fluctue) ───────────────────────────
  { id: 'premier_gain',    category: 'gains', emoji: '🟢', labelFr: 'Premier gain — +100 €',         labelEn: 'First Gain — +€100',          xpReward:  40, isPermanent: false, checkFn: null },
  { id: 'gains_notables',  category: 'gains', emoji: '📈', labelFr: 'Gains notables — +1 000 €',      labelEn: 'Notable Gains — +€1,000',     xpReward:  80, isPermanent: false, checkFn: null },
  { id: 'gains_importants',category: 'gains', emoji: '🚀', labelFr: 'Gains importants — +5 000 €',    labelEn: 'Significant Gains — +€5,000', xpReward: 150, isPermanent: false, checkFn: null },
  { id: 'grand_gagnant',   category: 'gains', emoji: '💰', labelFr: 'Grand gagnant — +25 000 €',      labelEn: 'Big Winner — +€25,000',       xpReward: 300, isPermanent: false, checkFn: null },
  { id: 'elite_gains',     category: 'gains', emoji: '👑', labelFr: 'Élite des gains — +100 000 €',   labelEn: 'Elite Gains — +€100,000',     xpReward: 500, isPermanent: false, checkFn: null },

  // ── Gestion — non permanent ───────────────────────────────────────────────
  { id: 'maitre_allocation', category: 'management', emoji: '⚖️', labelFr: "Maître de l'allocation — HHI ≤ 0,3 et 7+ classes",      labelEn: 'Allocation Master — HHI ≤ 0.3 and 7+ asset classes',       xpReward: 200, isPermanent: false, checkFn: null },
  { id: 'maitre_des_frais',  category: 'management', emoji: '✂️', labelFr: 'Maître des frais — TER pondéré < 1 %',                   labelEn: 'Fee Master — Weighted TER < 1%',                            xpReward: 150, isPermanent: false, checkFn: null },
  { id: 'chirurgien',        category: 'management', emoji: '🔬', labelFr: 'Chirurgien des frais — TER pondéré < 0,6 %',             labelEn: 'Fee Surgeon — Weighted TER < 0.6%',                         xpReward: 250, isPermanent: false, checkFn: null },
  { id: 'bas_de_laine',      category: 'management', emoji: '🧶', labelFr: 'Bas de laine — épargne liquide ≥ 3 × revenus mensuels',  labelEn: 'Rainy-Day Fund — liquid savings ≥ 3× monthly income',       xpReward: 100, isPermanent: false, checkFn: null },
  { id: 'antifragile',       category: 'management', emoji: '🛡️', labelFr: 'Antifragile — perte stress test < 30 %',                 labelEn: 'Antifragile — stress-test loss < 30%',                      xpReward: 200, isPermanent: false, checkFn: null },
  { id: 'bunker',            category: 'management', emoji: '🏰', labelFr: 'Bunker — perte stress test < 10 %',                      labelEn: 'Bunker — stress-test loss < 10%',                           xpReward: 350, isPermanent: false, checkFn: null },

  // ── Fiscal — permanent une fois acquis ───────────────────────────────────
  { id: 'ingenieur_patrimonial', category: 'fiscal', emoji: '⚙️', labelFr: 'Ingénieur patrimonial — 2+ enveloppes fiscales',          labelEn: 'Wealth Engineer — 2+ tax-advantaged accounts',              xpReward: 150, isPermanent: true, checkFn: null },
  { id: 'maitre_fiscal',         category: 'fiscal', emoji: '📋', labelFr: "Maître fiscal — comparer l'impact des frais en simulation", labelEn: 'Tax Master — compare the fee impact in a simulation',       xpReward: 200, isPermanent: true, checkFn: null, descFr: "Dans une simulation, ouvrez une enveloppe et modifiez ses frais pour comparer l'impact sur la projection.", descEn: "In a simulation, open an envelope and change its fees to compare the impact on the projection." },
  { id: 'optimiseur',            category: 'fiscal', emoji: '🎯', labelFr: "Optimiseur — versement sur l'enveloppe conseillée",       labelEn: 'Optimiser — contribution to the recommended account',       xpReward: 175, isPermanent: true, checkFn: null },

  // ── Santé financière — non permanent (score fluctue) ─────────────────────
  { id: 'bonne_sante',              category: 'health', emoji: '💚', labelFr: 'En bonne santé — score ≥ 60',                    labelEn: 'In Good Health — score ≥ 60',                   xpReward:  75, isPermanent: false, checkFn: null },
  { id: 'portfolio_equilibre',      category: 'health', emoji: '🌿', labelFr: 'Portefeuille équilibré — score ≥ 75',             labelEn: 'Balanced Portfolio — score ≥ 75',                xpReward: 150, isPermanent: false, checkFn: null },
  { id: 'portfolio_en_pleine_sante',category: 'health', emoji: '💪', labelFr: 'En pleine santé — score ≥ 85 (valide 7 jours)',   labelEn: 'Peak Health — score ≥ 85 (valid 7 days)',        xpReward: 250, isPermanent: false, checkFn: null },
  { id: 'portfolio_optimal',        category: 'health', emoji: '✨', labelFr: 'Portefeuille optimal — score ≥ 95',               labelEn: 'Optimal Portfolio — score ≥ 95',                 xpReward: 500, isPermanent: false, checkFn: null },

  // ── FIRE — non permanent (couverture peut varier) ─────────────────────────
  { id: 'feu_sacre',          category: 'fire', emoji: '🔥', labelFr: 'Feu sacré — couverture FIRE ≥ 25 %',          labelEn: 'Sacred Flame — FIRE coverage ≥ 25%',       xpReward:  100, isPermanent: false, checkFn: null },
  { id: 'allumeur',           category: 'fire', emoji: '🕯️', labelFr: "L'Allumeur — couverture FIRE ≥ 50 %",        labelEn: 'The Igniter — FIRE coverage ≥ 50%',        xpReward:  200, isPermanent: false, checkFn: null },
  { id: 'flamme_perpetuelle', category: 'fire', emoji: '🌟', labelFr: 'Flamme perpétuelle — couverture FIRE ≥ 75 %', labelEn: 'Perpetual Flame — FIRE coverage ≥ 75%',    xpReward:  400, isPermanent: false, checkFn: null },
  { id: 'atteint_le_fire',    category: 'fire', emoji: '🎆', labelFr: 'FIRE atteint !',                              labelEn: 'FIRE Achieved!',                           xpReward: 1000, isPermanent: false, checkFn: null, descFr: 'Votre portefeuille réel couvre 100 % de votre objectif FIRE : le capital nécessaire (besoins mensuels × 12 ÷ taux de retrait) est atteint.', descEn: 'Your real portfolio covers 100% of your FIRE goal: the required capital (monthly needs × 12 ÷ withdrawal rate) is reached.' },

  // ── Séries de connexion (Prompt 10) — permanent une fois gagné ──────────
  // XP stocké dans xpReward ; `unlockChallengeBadge` le lit pour peupler xpAwarded dans l'état
  { id: 'streak_7j',          category: 'streak', emoji: '🔥',    labelFr: 'Étincelle — 7 jours consécutifs',           labelEn: 'Spark — 7-day streak',                  xpReward:   50, isPermanent: true, checkFn: null },
  { id: 'flamme_persistante', category: 'streak', emoji: '🔥🔥',  labelFr: 'Flamme persistante — 30 jours consécutifs', labelEn: 'Persistent Flame — 30-day streak',      xpReward:  200, isPermanent: true, checkFn: null },
  { id: 'flamme_eternelle',   category: 'streak', emoji: '🔥🔥🔥', labelFr: 'Flamme éternelle — 90 jours consécutifs',  labelEn: 'Eternal Flame — 90-day streak',         xpReward:  500, isPermanent: true, checkFn: null },
  { id: 'une_annee_entiere',  category: 'streak', emoji: '🌟',    labelFr: 'Une année entière — 365 jours consécutifs', labelEn: 'A Full Year — 365-day streak',          xpReward: 2000, isPermanent: true, checkFn: null },

  // ── Calibration mensuelle (Prompt 10) — permanent ─────────────────────────
  { id: 'calibration_3_mois',  category: 'streak', emoji: '📅', labelFr: 'Calibration fidèle — 3 mois consécutifs',   labelEn: 'Faithful Calibration — 3 consecutive months',  xpReward:  150, isPermanent: true, checkFn: null },
  { id: 'calibration_6_mois',  category: 'streak', emoji: '📆', labelFr: 'Calibration assidue — 6 mois consécutifs',  labelEn: 'Diligent Calibration — 6 consecutive months',  xpReward:  350, isPermanent: true, checkFn: null },
  { id: 'calibration_12_mois', category: 'streak', emoji: '🏅', labelFr: 'Calibration maître — 12 mois consécutifs',  labelEn: 'Master Calibration — 12 consecutive months',   xpReward:  700, isPermanent: true, checkFn: null },

  // ── Missions mensuelles — 1 mission = 1 trophée, permanent une fois gagné ──
  // xpReward: 150 — attribué une seule fois via unlockChallengeBadge + challengeService
  { id: 'mission_jan_automation', category: 'challenge', emoji: '⚙️', labelFr: 'Automatisation globale — Janvier',              labelEn: 'Global Automation — January',          xpReward: 150, isPermanent: true, checkFn: null },
  { id: 'mission_feb_fees',       category: 'challenge', emoji: '💸', labelFr: 'Maître des frais — Février',                    labelEn: 'Fee Master — February',                xpReward: 150, isPermanent: true, checkFn: null },
  { id: 'mission_mar_rebalance',  category: 'challenge', emoji: '⚖️', labelFr: 'Rééquilibrage et défense — Mars',               labelEn: 'Rebalancing & Defence — March',        xpReward: 150, isPermanent: true, checkFn: null },
  { id: 'mission_apr_declarant',  category: 'challenge', emoji: '📝', labelFr: 'Déclarant — Avril',                             labelEn: 'Tax Filer — April',                    xpReward: 150, isPermanent: true, checkFn: null },
  { id: 'mission_may_calendar',   category: 'challenge', emoji: '📅', labelFr: 'Revue du calendrier — Mai',                     labelEn: 'Calendar Review — May',                xpReward: 150, isPermanent: true, checkFn: null },
  { id: 'mission_jun_crisis',     category: 'challenge', emoji: '🛡️', labelFr: 'Prêt pour la crise — Juin',                     labelEn: 'Crisis Ready — June',                  xpReward: 150, isPermanent: true, checkFn: null },
  { id: 'mission_jul_fee_alert',  category: 'challenge', emoji: '🚨', labelFr: 'Alerte frais — Juillet',                        labelEn: 'Fee Alert — July',                     xpReward: 150, isPermanent: true, checkFn: null },
  { id: 'mission_aug_withholding',category: 'challenge', emoji: '🧾', labelFr: 'Ajustement du prélèvement — Août',              labelEn: 'Withholding Adjustment — August',      xpReward: 150, isPermanent: true, checkFn: null },
  { id: 'mission_sep_tax_optim',  category: 'challenge', emoji: '🎯', labelFr: 'Optimiseur fiscal — Septembre',                 labelEn: 'Tax Optimiser — September',            xpReward: 150, isPermanent: true, checkFn: null },
  { id: 'mission_oct_yearend',    category: 'challenge', emoji: '🗓️', labelFr: "Prévoir la fin d'année — Octobre",              labelEn: 'Plan the Year-End — October',          xpReward: 150, isPermanent: true, checkFn: null },
  { id: 'mission_nov_yields',     category: 'challenge', emoji: '📈', labelFr: 'Le point sur les rendements — Novembre',        labelEn: 'Reviewing Returns — November',         xpReward: 150, isPermanent: true, checkFn: null },
  { id: 'mission_dec_bilan',      category: 'challenge', emoji: '🏆', labelFr: 'Bilan annuel — Décembre',                       labelEn: 'Annual Review — December',             xpReward: 150, isPermanent: true, checkFn: null },

  // ── F1 · Fidélité longue durée — série de connexion (hebdo, puis mensuelle après 1 an) ──
  { id: 'loyalty_3m',  category: 'loyalty', emoji: '🎖️', labelFr: 'Fidèle — 3 mois d\'assiduité',        labelEn: 'Faithful — 3 months of consistency',  xpReward:   300, isPermanent: true, checkFn: null },
  { id: 'loyalty_6m',  category: 'loyalty', emoji: '🎖️', labelFr: 'Assidu — 6 mois d\'assiduité',        labelEn: 'Committed — 6 months of consistency', xpReward:   750, isPermanent: true, checkFn: null },
  { id: 'loyalty_12m', category: 'loyalty', emoji: '🎖️', labelFr: 'Un an de fidélité',                   labelEn: 'One year of loyalty',                 xpReward:  2000, isPermanent: true, checkFn: null },
  { id: 'loyalty_2y',  category: 'loyalty', emoji: '🎖️', labelFr: 'Deux ans de fidélité',               labelEn: 'Two years of loyalty',                xpReward:  4000, isPermanent: true, checkFn: null },
  { id: 'loyalty_5y',  category: 'loyalty', emoji: '🎖️', labelFr: 'Cinq ans de fidélité',               labelEn: 'Five years of loyalty',               xpReward: 10000, isPermanent: true, checkFn: null },
  { id: 'loyalty_10y', category: 'loyalty', emoji: '🎖️', labelFr: 'Dix ans de fidélité',                labelEn: 'Ten years of loyalty',                xpReward: 20000, isPermanent: true, checkFn: null },
  { id: 'loyalty_15y', category: 'loyalty', emoji: '🎖️', labelFr: 'Quinze ans de fidélité',             labelEn: 'Fifteen years of loyalty',            xpReward: 30000, isPermanent: true, checkFn: null },
  { id: 'loyalty_20y', category: 'loyalty', emoji: '🎖️', labelFr: 'Vingt ans de fidélité',              labelEn: 'Twenty years of loyalty',             xpReward: 40000, isPermanent: true, checkFn: null },
  { id: 'loyalty_25y', category: 'loyalty', emoji: '🎖️', labelFr: 'Vingt-cinq ans de fidélité',         labelEn: 'Twenty-five years of loyalty',        xpReward: 50000, isPermanent: true, checkFn: null },
  { id: 'loyalty_30y', category: 'loyalty', emoji: '🎖️', labelFr: 'Trente ans de fidélité',             labelEn: 'Thirty years of loyalty',             xpReward: 60000, isPermanent: true, checkFn: null },
  { id: 'loyalty_35y', category: 'loyalty', emoji: '🎖️', labelFr: 'Trente-cinq ans de fidélité',        labelEn: 'Thirty-five years of loyalty',        xpReward: 75000, isPermanent: true, checkFn: null },

  // ── F2 · Défis mensuels cumulés (total, toutes années confondues) ──────────
  { id: 'challenges_total_6',   category: 'challenge_cumul', emoji: '🏆', labelFr: 'Releveur de défis — 6 défis réussis',   labelEn: 'Challenger — 6 challenges completed',     xpReward:   300, isPermanent: true, checkFn: null },
  { id: 'challenges_total_12',  category: 'challenge_cumul', emoji: '🏆', labelFr: '12 défis mensuels réussis',             labelEn: '12 monthly challenges completed',        xpReward:   700, isPermanent: true, checkFn: null },
  { id: 'challenges_total_24',  category: 'challenge_cumul', emoji: '🏆', labelFr: '24 défis mensuels réussis',             labelEn: '24 monthly challenges completed',        xpReward:  1500, isPermanent: true, checkFn: null },
  { id: 'challenges_total_50',  category: 'challenge_cumul', emoji: '🏆', labelFr: '50 défis mensuels réussis',             labelEn: '50 monthly challenges completed',        xpReward:  3000, isPermanent: true, checkFn: null },
  { id: 'challenges_total_100', category: 'challenge_cumul', emoji: '🏆', labelFr: '100 défis mensuels réussis',            labelEn: '100 monthly challenges completed',       xpReward:  6000, isPermanent: true, checkFn: null },
  { id: 'challenges_total_150', category: 'challenge_cumul', emoji: '🏆', labelFr: '150 défis mensuels réussis',            labelEn: '150 monthly challenges completed',       xpReward:  9000, isPermanent: true, checkFn: null },
  { id: 'challenges_total_200', category: 'challenge_cumul', emoji: '🏆', labelFr: '200 défis mensuels réussis',            labelEn: '200 monthly challenges completed',       xpReward: 12000, isPermanent: true, checkFn: null },
  { id: 'challenges_total_400', category: 'challenge_cumul', emoji: '🏆', labelFr: '400 défis mensuels réussis',            labelEn: '400 monthly challenges completed',       xpReward: 25000, isPermanent: true, checkFn: null },

  // ── F3 · Calibrations mensuelles cumulées (total) ──────────────────────────
  { id: 'calibrations_total_6',   category: 'calibration_cumul', emoji: '🎯', labelFr: 'Calibreur — 6 calibrations',       labelEn: 'Calibrator — 6 calibrations',     xpReward:   300, isPermanent: true, checkFn: null },
  { id: 'calibrations_total_12',  category: 'calibration_cumul', emoji: '🎯', labelFr: '12 calibrations effectuées',       labelEn: '12 calibrations completed',       xpReward:   700, isPermanent: true, checkFn: null },
  { id: 'calibrations_total_24',  category: 'calibration_cumul', emoji: '🎯', labelFr: '24 calibrations effectuées',       labelEn: '24 calibrations completed',       xpReward:  1500, isPermanent: true, checkFn: null },
  { id: 'calibrations_total_50',  category: 'calibration_cumul', emoji: '🎯', labelFr: '50 calibrations effectuées',       labelEn: '50 calibrations completed',       xpReward:  3000, isPermanent: true, checkFn: null },
  { id: 'calibrations_total_100', category: 'calibration_cumul', emoji: '🎯', labelFr: '100 calibrations effectuées',      labelEn: '100 calibrations completed',      xpReward:  6000, isPermanent: true, checkFn: null },
  { id: 'calibrations_total_150', category: 'calibration_cumul', emoji: '🎯', labelFr: '150 calibrations effectuées',      labelEn: '150 calibrations completed',      xpReward:  9000, isPermanent: true, checkFn: null },
  { id: 'calibrations_total_200', category: 'calibration_cumul', emoji: '🎯', labelFr: '200 calibrations effectuées',      labelEn: '200 calibrations completed',      xpReward: 12000, isPermanent: true, checkFn: null },
  { id: 'calibrations_total_400', category: 'calibration_cumul', emoji: '🎯', labelFr: '400 calibrations effectuées',      labelEn: '400 calibrations completed',      xpReward: 25000, isPermanent: true, checkFn: null },

  // ── F4 · Ancienneté du compte (durée depuis le premier lancement, sans série requise) ──
  { id: 'age_2y',  category: 'veteran', emoji: '🏛️', labelFr: 'Vétéran — 2 ans d\'utilisation',    labelEn: 'Veteran — 2 years of use',       xpReward:  1500, isPermanent: true, checkFn: null },
  { id: 'age_3y',  category: 'veteran', emoji: '🏛️', labelFr: '3 ans d\'utilisation',              labelEn: '3 years of use',                 xpReward:  2500, isPermanent: true, checkFn: null },
  { id: 'age_5y',  category: 'veteran', emoji: '🏛️', labelFr: '5 ans d\'utilisation',              labelEn: '5 years of use',                 xpReward:  5000, isPermanent: true, checkFn: null },
  { id: 'age_10y', category: 'veteran', emoji: '🏛️', labelFr: '10 ans d\'utilisation',             labelEn: '10 years of use',                xpReward: 12000, isPermanent: true, checkFn: null },
  { id: 'age_15y', category: 'veteran', emoji: '🏛️', labelFr: '15 ans d\'utilisation',             labelEn: '15 years of use',                xpReward: 20000, isPermanent: true, checkFn: null },
  { id: 'age_20y', category: 'veteran', emoji: '🏛️', labelFr: '20 ans d\'utilisation',             labelEn: '20 years of use',                xpReward: 30000, isPermanent: true, checkFn: null },
  { id: 'age_25y', category: 'veteran', emoji: '🏛️', labelFr: '25 ans d\'utilisation',             labelEn: '25 years of use',                xpReward: 40000, isPermanent: true, checkFn: null },
  { id: 'age_30y', category: 'veteran', emoji: '🏛️', labelFr: '30 ans d\'utilisation',             labelEn: '30 years of use',                xpReward: 50000, isPermanent: true, checkFn: null },
  { id: 'age_35y', category: 'veteran', emoji: '🏛️', labelFr: '35 ans d\'utilisation',             labelEn: '35 years of use',                xpReward: 65000, isPermanent: true, checkFn: null },
];

// Index pour lookup rapide O(1)
const _catalogIndex = Object.fromEntries(TROPHY_CATALOG.map(t => [t.id, t]));

// ═══════════════════════════════════════════════════════════════════════════════
// 2. HELPER — ASSEMBLAGE DES DONNÉES DE VÉRIFICATION
//    Appelé une seule fois par passe de checkAllTrophies pour éviter N appels
//    redondants à dataService.
// ═══════════════════════════════════════════════════════════════════════════════

function _getCheckData() {
  const gState     = gamificationService.getState();
  const portfolios = dataService.getPortfolios();
  const rawData    = dataService.getData();
  const transactions = rawData.transactions || [];
  const globalYield  = dataService.computeGlobalYield();
  const assetStats   = dataService.getAssetTypeStats();

  // ── Total investi (somme des dépôts nets bruts, sans déduire les retraits) ──
  const totalInvested = portfolios.reduce((s, p) => s + (p.total_deposits || 0), 0);

  // ── Valeur RÉELLE totale du portefeuille (toutes enveloppes) : dernière valeur
  //    calibrée si disponible, sinon le solde des versements. Sert aux trophées
  //    « Patrimoine » (le patrimoine = ce que ça vaut, pas le cumul des versements).
  const totalPortfolioValue = portfolios.reduce((s, p) => {
    const cals = dataService.getCalibrations(p.id);
    const lastVal = cals.length ? cals[cals.length - 1].total_value : (p.balance || 0);
    return s + Math.max(0, lastVal || 0);
  }, 0);

  // ── PnL latent global ──────────────────────────────────────────────────────
  const totalPnL = globalYield ? (globalYield.totalGain || 0) : 0;

  // ── Balance totale du portefeuille ─────────────────────────────────────────
  const totalPortfolioBalance = portfolios.reduce(
    (s, p) => s + Math.max(0, p.balance || 0), 0
  );

  // ── HHI et classes d'actifs ────────────────────────────────────────────────
  const assetBalances = {};
  Object.entries(assetStats).forEach(([type, v]) => {
    if (v.balance > 0) assetBalances[type] = v.balance;
  });
  const totalAssetBalance = Object.values(assetBalances).reduce((s, v) => s + v, 0);

  let hhi = 1; // concentration maximale par défaut (aucune donnée)
  if (totalAssetBalance > 0) {
    hhi = Object.values(assetBalances).reduce((s, v) => {
      const w = v / totalAssetBalance;
      return s + w * w;
    }, 0);
  }
  const distinctAssetClasses = Object.keys(assetBalances).length;

  // ── TER pondéré (en fraction décimale, ex : 0.005 = 0,5 %) ───────────────
  // annual_fees_pct dans l'app est en pourcentage (ex : 0.5 = 0,5 %)
  const weightedAnnualFee = portfolios.reduce(
    (s, p) => s + Math.max(0, p.balance || 0) * (parseFloat(p.annual_fees_pct) || 0),
    0
  );
  const weightedTER = totalPortfolioBalance > 0
    ? (weightedAnnualFee / totalPortfolioBalance) / 100 // → décimal
    : 0;

  // ── Épargne liquide (fond_euro + cash + comptes réglementés) ─────────────
  const fondEuroBalance = Math.max(0, assetStats['fond_euro']?.balance || 0);
  const cashBalance = portfolios.reduce(
    (s, p) => s + Math.max(0, p.cash_balance || 0), 0
  );
  const regulatedAccountsBalance = portfolios
    .filter(p => p.type === 'compte_réglementé')
    .reduce((s, p) => s + Math.max(0, p.balance || 0), 0);
  const liquidSavings = fondEuroBalance + cashBalance + regulatedAccountsBalance;

  // ── Enveloppes fiscalement qualifiantes ───────────────────────────────────
  const FISCAL_TYPES = new Set(['PEA', 'assurance_vie', 'PER', 'PEL']);
  const qualifyingFiscalEnvelopes = portfolios.filter(p => FISCAL_TYPES.has(p.type));

  // ── Couverture FIRE du portefeuille RÉEL ──────────────────────────────────
  // Les trophées FIRE se déclenchent sur le patrimoine réel (toutes enveloppes),
  // et NON sur une projection de simulation.
  let fireCoverage = 0;
  try {
    const fp = dataService.computeFireProgress();
    if (fp && typeof fp.fireProgress === 'number') fireCoverage = fp.fireProgress;
  } catch (_) { /* paramètres FIRE indisponibles */ }

  // ── Trophée Écureuil — 3 mois consécutifs avec versements NON récurrents ──
  const nonRecurringDeposits = transactions.filter(
    t => t.type === 'deposit' && (!t.recurrence || t.recurrence === 'none')
  );
  const txMonths = [...new Set(nonRecurringDeposits.map(t => t.date.substring(0, 7)))].sort();
  let hasThreeConsecutiveMonths = false;
  for (let i = 2; i < txMonths.length; i++) {
    const [y1, m1] = txMonths[i - 2].split('-').map(Number);
    const [y2, m2] = txMonths[i - 1].split('-').map(Number);
    const [y3, m3] = txMonths[i].split('-').map(Number);
    const n1 = y1 * 12 + m1, n2 = y2 * 12 + m2, n3 = y3 * 12 + m3;
    if (n2 - n1 === 1 && n3 - n2 === 1) { hasThreeConsecutiveMonths = true; break; }
  }

  // ── Métriques vétéran (badges F1-F4) ──────────────────────────────────────
  const _now      = new Date();
  const _todayStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
  const _daysSince = (isoDate) => {
    if (!isoDate) return 0;
    const a = new Date(isoDate + 'T00:00:00');
    const b = new Date(_todayStr + 'T00:00:00');
    const diff = Math.round((b.getTime() - a.getTime()) / 86_400_000);
    return diff > 0 ? diff : 0;
  };
  const loyaltyDays       = _daysSince(gState.loyalty?.startDate);              // F1
  const challengesTotal   = Object.keys(gState.challenges?.completions || {}).length; // F2
  const calibrationsTotal = gState.calibration?.totalCount || 0;               // F3
  const accountAgeDays    = _daysSince(gState.temporality?.firstLaunchDate);   // F4

  // ── Données stress test ───────────────────────────────────────────────────
  const stressTest = gState.stressTest || {};

  // ── Trophée Optimiseur — versement sur l'enveloppe conseillée en 30 j ────
  const lastFiscalRec = gState.profile?.lastFiscalRecommendation;
  let optimiseurMet = false;
  if (lastFiscalRec?.portfolioType && lastFiscalRec?.date) {
    const recDate       = new Date(lastFiscalRec.date).getTime();
    const expiryDate    = recDate + 30 * 24 * 3600 * 1000;
    const recType       = lastFiscalRec.portfolioType;
    optimiseurMet = transactions.some(tx => {
      if (tx.type !== 'deposit') return false;
      const txTime = new Date(tx.date).getTime();
      if (txTime < recDate || txTime > expiryDate) return false;
      const portfolio = portfolios.find(p => p.id === tx.portfolio_id);
      return portfolio?.type === recType;
    });
  }

  return {
    gState,
    portfolios,
    transactions,
    totalInvested,
    totalPortfolioValue,
    totalPnL,
    totalPortfolioBalance,
    hhi,
    distinctAssetClasses,
    weightedTER,
    liquidSavings,
    qualifyingFiscalEnvelopes,
    fireCoverage,
    hasThreeConsecutiveMonths,
    stressTest,
    optimiseurMet,
    loyaltyDays,
    challengesTotal,
    calibrationsTotal,
    accountAgeDays,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. FONCTIONS DE VÉRIFICATION DES CONDITIONS — check_<id>(checkData) → bool
// ═══════════════════════════════════════════════════════════════════════════════

// ── Tutorial ─────────────────────────────────────────────────────────────────
function check_quest_1_done(d)  { return d.gState.quests?.['Q1']?.completed  === true; }
function check_quest_2_done(d)  { return d.gState.quests?.['Q2']?.completed  === true; }
function check_quest_3_done(d)  { return d.gState.quests?.['Q3']?.completed  === true; }
function check_quest_4_done(d)  { return d.gState.quests?.['Q4']?.completed  === true; }
function check_quest_5_done(d)  { return d.gState.quests?.['Q5']?.completed  === true; }
function check_quest_6_done(d)  { return d.gState.quests?.['Q6']?.completed  === true; }
function check_quest_7_done(d)  { return d.gState.quests?.['Q7']?.completed  === true; }
function check_quest_8_done(d)  { return d.gState.quests?.['Q8']?.completed  === true; }
function check_quest_9_done(d)  { return d.gState.quests?.['Q9']?.completed  === true; }
function check_quest_10_done(d) { return d.gState.quests?.['Q10']?.completed === true; }
function check_quest_11_done(d) { return d.gState.quests?.['Q11']?.completed === true; }
function check_quest_12_done(d) { return d.gState.quests?.['Q12']?.completed === true; }
function check_quest_13_done(d) { return d.gState.quests?.['Q13']?.completed === true; }

// ── Régularité ────────────────────────────────────────────────────────────────
function check_ecureuil(d)         { return d.hasThreeConsecutiveMonths; }
function check_fourmi(d)           { return (d.gState.calibration?.consecutiveMonths  || 0) >= 3; }
function check_guepard(d)          { return (d.gState.streak?.longestStreak           || 0) >= 7; }
function check_marathonien(d)      { return (d.gState.streak?.longestStreak           || 0) >= 30; }
function check_centurion_streak(d) { return (d.gState.streak?.longestStreak           || 0) >= 100; }
function check_horloge_suisse(d)   { return (d.gState.calibration?.consecutiveMonths  || 0) >= 6; }
function check_maitre_du_temps(d)  { return (d.gState.calibration?.consecutiveMonths  || 0) >= 12; }

// ── Patrimoine — basé sur la VALEUR RÉELLE du portefeuille (pas le cumul versé) ──
function check_premiers_pas_patrimoine(d) { return d.totalPortfolioValue >= 1_000; }
function check_cap_10k(d)                { return d.totalPortfolioValue >= 10_000; }
function check_investisseur_serieux(d)   { return d.totalPortfolioValue >= 25_000; }
function check_cap_50k(d)                { return d.totalPortfolioValue >= 50_000; }
function check_centenaire(d)             { return d.totalPortfolioValue >= 100_000; }
function check_quart_million(d)          { return d.totalPortfolioValue >= 250_000; }
function check_demi_million(d)           { return d.totalPortfolioValue >= 500_000; }
function check_millionnaire(d)           { return d.totalPortfolioValue >= 1_000_000; }

// ── Gains ─────────────────────────────────────────────────────────────────────
function check_premier_gain(d)    { return d.totalPnL >= 100; }
function check_gains_notables(d)  { return d.totalPnL >= 1_000; }
function check_gains_importants(d){ return d.totalPnL >= 5_000; }
function check_grand_gagnant(d)   { return d.totalPnL >= 25_000; }
function check_elite_gains(d)     { return d.totalPnL >= 100_000; }

// ── Gestion ───────────────────────────────────────────────────────────────────
function check_maitre_allocation(d) {
  return d.hhi <= 0.3 && d.distinctAssetClasses >= 7;
}
function check_maitre_des_frais(d) {
  // Exige : au moins 1 transaction (signe d'usage réel) ET au moins une enveloppe
  // avec annual_fees_pct explicitement renseigné (non vide, non null) afin d'éviter
  // le déclenchement automatique quand TER = 0 par défaut.
  if (d.transactions.length === 0) return false;
  const hasExplicitFee = d.portfolios.some(
    p => p.annual_fees_pct != null && String(p.annual_fees_pct).trim() !== ''
  );
  if (!hasExplicitFee) return false;
  return d.totalPortfolioBalance > 0 && d.weightedTER < 0.01;
}
function check_chirurgien(d) {
  // Même garde que check_maitre_des_frais
  if (d.transactions.length === 0) return false;
  const hasExplicitFee = d.portfolios.some(
    p => p.annual_fees_pct != null && String(p.annual_fees_pct).trim() !== ''
  );
  if (!hasExplicitFee) return false;
  return d.totalPortfolioBalance > 0 && d.weightedTER < 0.006;
}
function check_bas_de_laine(d) {
  const income = d.gState.profile?.monthlyNetIncome;
  if (!income || income <= 0) return false;
  return d.liquidSavings >= income * 3;
}
function check_antifragile(d) {
  const lossP = d.stressTest?.lastLossPct;
  if (lossP === null || lossP === undefined) return false;
  return lossP < 30;
}
function check_bunker(d) {
  const lossP = d.stressTest?.lastLossPct;
  if (lossP === null || lossP === undefined) return false;
  return lossP < 10;
}

// ── Fiscal ────────────────────────────────────────────────────────────────────
function check_ingenieur_patrimonial(d) {
  return d.qualifyingFiscalEnvelopes.length >= 2;
}
function check_maitre_fiscal(d) {
  // Vraie comparaison de l'impact des frais : l'utilisateur a modifié les frais d'une
  // enveloppe DANS une simulation (drapeau posé par la page enveloppe en scope simulation).
  return d.gState.firstTime?.simFeeChanged === true;
}
function check_optimiseur(d) {
  return d.optimiseurMet;
}

// ── Santé financière ──────────────────────────────────────────────────────────
function check_bonne_sante(d)             { return (d.gState.healthScore?.current || 0) >= 60; }
function check_portfolio_equilibre(d)     { return (d.gState.healthScore?.current || 0) >= 75; }
function check_portfolio_en_pleine_sante(d){ return (d.gState.healthScore?.current || 0) >= 85; }
function check_portfolio_optimal(d)        { return (d.gState.healthScore?.current || 0) >= 95; }

// ── FIRE — couverture du portefeuille RÉEL (pas de la simulation) ──────────────
function check_feu_sacre(d)          { return d.fireCoverage >= 25; }
function check_allumeur(d)           { return d.fireCoverage >= 50; }
function check_flamme_perpetuelle(d) { return d.fireCoverage >= 75; }
function check_atteint_le_fire(d)    { return d.fireCoverage >= 100; }

// ── F1 · Fidélité longue durée — jalons en jours de série continue ─────────────
function check_loyalty_3m(d)  { return d.loyaltyDays >= 90; }
function check_loyalty_6m(d)  { return d.loyaltyDays >= 180; }
function check_loyalty_12m(d) { return d.loyaltyDays >= 365; }
function check_loyalty_2y(d)  { return d.loyaltyDays >= 730; }
function check_loyalty_5y(d)  { return d.loyaltyDays >= 1826; }
function check_loyalty_10y(d) { return d.loyaltyDays >= 3652; }
function check_loyalty_15y(d) { return d.loyaltyDays >= 5479; }
function check_loyalty_20y(d) { return d.loyaltyDays >= 7305; }
function check_loyalty_25y(d) { return d.loyaltyDays >= 9131; }
function check_loyalty_30y(d) { return d.loyaltyDays >= 10957; }
function check_loyalty_35y(d) { return d.loyaltyDays >= 12784; }

// ── F2 · Défis mensuels cumulés ────────────────────────────────────────────────
function check_challenges_total_6(d)   { return d.challengesTotal >= 6; }
function check_challenges_total_12(d)  { return d.challengesTotal >= 12; }
function check_challenges_total_24(d)  { return d.challengesTotal >= 24; }
function check_challenges_total_50(d)  { return d.challengesTotal >= 50; }
function check_challenges_total_100(d) { return d.challengesTotal >= 100; }
function check_challenges_total_150(d) { return d.challengesTotal >= 150; }
function check_challenges_total_200(d) { return d.challengesTotal >= 200; }
function check_challenges_total_400(d) { return d.challengesTotal >= 400; }

// ── F3 · Calibrations mensuelles cumulées ──────────────────────────────────────
function check_calibrations_total_6(d)   { return d.calibrationsTotal >= 6; }
function check_calibrations_total_12(d)  { return d.calibrationsTotal >= 12; }
function check_calibrations_total_24(d)  { return d.calibrationsTotal >= 24; }
function check_calibrations_total_50(d)  { return d.calibrationsTotal >= 50; }
function check_calibrations_total_100(d) { return d.calibrationsTotal >= 100; }
function check_calibrations_total_150(d) { return d.calibrationsTotal >= 150; }
function check_calibrations_total_200(d) { return d.calibrationsTotal >= 200; }
function check_calibrations_total_400(d) { return d.calibrationsTotal >= 400; }

// ── F4 · Ancienneté du compte — jalons en jours (365,25 j/an) ──────────────────
function check_age_2y(d)  { return d.accountAgeDays >= 731; }
function check_age_3y(d)  { return d.accountAgeDays >= 1096; }
function check_age_5y(d)  { return d.accountAgeDays >= 1826; }
function check_age_10y(d) { return d.accountAgeDays >= 3653; }
function check_age_15y(d) { return d.accountAgeDays >= 5479; }
function check_age_20y(d) { return d.accountAgeDays >= 7305; }
function check_age_25y(d) { return d.accountAgeDays >= 9131; }
function check_age_30y(d) { return d.accountAgeDays >= 10958; }
function check_age_35y(d) { return d.accountAgeDays >= 12784; }

// ═══════════════════════════════════════════════════════════════════════════════
// 4. CÂBLAGE — associe chaque checkFn à l'entrée du catalogue
// ═══════════════════════════════════════════════════════════════════════════════

const _CHECK_FN_MAP = {
  quest_1_done:  check_quest_1_done,  quest_2_done:  check_quest_2_done,
  quest_3_done:  check_quest_3_done,  quest_4_done:  check_quest_4_done,
  quest_5_done:  check_quest_5_done,  quest_6_done:  check_quest_6_done,
  quest_7_done:  check_quest_7_done,  quest_8_done:  check_quest_8_done,
  quest_9_done:  check_quest_9_done,  quest_10_done: check_quest_10_done,
  quest_11_done: check_quest_11_done, quest_12_done: check_quest_12_done,
  quest_13_done: check_quest_13_done,

  ecureuil:         check_ecureuil,
  fourmi:           check_fourmi,
  guepard:          check_guepard,
  marathonien:      check_marathonien,
  centurion_streak: check_centurion_streak,
  horloge_suisse:   check_horloge_suisse,
  maitre_du_temps:  check_maitre_du_temps,

  premiers_pas_patrimoine: check_premiers_pas_patrimoine,
  cap_10k:                 check_cap_10k,
  investisseur_serieux:    check_investisseur_serieux,
  cap_50k:                 check_cap_50k,
  centenaire:              check_centenaire,
  quart_million:           check_quart_million,
  demi_million:            check_demi_million,
  millionnaire:            check_millionnaire,

  premier_gain:    check_premier_gain,
  gains_notables:  check_gains_notables,
  gains_importants:check_gains_importants,
  grand_gagnant:   check_grand_gagnant,
  elite_gains:     check_elite_gains,

  maitre_allocation: check_maitre_allocation,
  maitre_des_frais:  check_maitre_des_frais,
  chirurgien:        check_chirurgien,
  bas_de_laine:      check_bas_de_laine,
  antifragile:       check_antifragile,
  bunker:            check_bunker,

  ingenieur_patrimonial: check_ingenieur_patrimonial,
  maitre_fiscal:         check_maitre_fiscal,
  optimiseur:            check_optimiseur,

  bonne_sante:               check_bonne_sante,
  portfolio_equilibre:       check_portfolio_equilibre,
  portfolio_en_pleine_sante: check_portfolio_en_pleine_sante,
  portfolio_optimal:         check_portfolio_optimal,

  feu_sacre:          check_feu_sacre,
  allumeur:           check_allumeur,
  flamme_perpetuelle: check_flamme_perpetuelle,
  atteint_le_fire:    check_atteint_le_fire,

  loyalty_3m:  check_loyalty_3m,   loyalty_6m:  check_loyalty_6m,
  loyalty_12m: check_loyalty_12m,  loyalty_2y:  check_loyalty_2y,
  loyalty_5y:  check_loyalty_5y,   loyalty_10y: check_loyalty_10y,
  loyalty_15y: check_loyalty_15y,  loyalty_20y: check_loyalty_20y,
  loyalty_25y: check_loyalty_25y,  loyalty_30y: check_loyalty_30y,
  loyalty_35y: check_loyalty_35y,

  challenges_total_6:   check_challenges_total_6,
  challenges_total_12:  check_challenges_total_12,
  challenges_total_24:  check_challenges_total_24,
  challenges_total_50:  check_challenges_total_50,
  challenges_total_100: check_challenges_total_100,
  challenges_total_150: check_challenges_total_150,
  challenges_total_200: check_challenges_total_200,
  challenges_total_400: check_challenges_total_400,

  calibrations_total_6:   check_calibrations_total_6,
  calibrations_total_12:  check_calibrations_total_12,
  calibrations_total_24:  check_calibrations_total_24,
  calibrations_total_50:  check_calibrations_total_50,
  calibrations_total_100: check_calibrations_total_100,
  calibrations_total_150: check_calibrations_total_150,
  calibrations_total_200: check_calibrations_total_200,
  calibrations_total_400: check_calibrations_total_400,

  age_2y:  check_age_2y,   age_3y:  check_age_3y,   age_5y:  check_age_5y,
  age_10y: check_age_10y,  age_15y: check_age_15y,  age_20y: check_age_20y,
  age_25y: check_age_25y,  age_30y: check_age_30y,  age_35y: check_age_35y,
};

// Câbler au catalogue
TROPHY_CATALOG.forEach(t => {
  t.checkFn = _CHECK_FN_MAP[t.id] || null;
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. DÉVERROUILLAGE D'UN TROPHÉE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Déverrouille le trophée `trophyId` si la condition est remplie et qu'il
 * n'est pas déjà unlocked. Idempotent.
 *
 * @param {string} trophyId
 * @param {object} [checkData] — résultat pré-calculé de _getCheckData() (optionnel, évite un double appel)
 */
function checkAndUnlockTrophy(trophyId, checkData) {
  const trophy = _catalogIndex[trophyId];
  if (!trophy || !trophy.checkFn) return;

  const gState = gamificationService.getState();

  // Déjà déverrouillé → ne rien faire
  if (gState.trophies?.[trophyId]?.unlocked === true) return;

  // Vérifier la condition
  const d = checkData || _getCheckData();
  if (!trophy.checkFn(d)) return;

  // ── Construire l'entrée dans le state ──────────────────────────────────────
  const now        = new Date().toISOString();
  const trophyEntry = { unlocked: true, unlockedAt: now, xpAwarded: trophy.xpReward };

  // Cas spécial : portfolio_en_pleine_sante — expiration 7 jours
  if (trophyId === 'portfolio_en_pleine_sante') {
    trophyEntry.expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  }

  // Persister dans l'état de gamification
  const updatedTrophies = { ...(gState.trophies || {}), [trophyId]: trophyEntry };
  gamificationService.patchState({ trophies: updatedTrophies });

  // Attribuer les XP
  gamificationService.notifyProgress('trophy_' + trophyId);

  // Émettre l'événement (pour la notification UI)
  gamificationService.dispatchEvent('trophyUnlocked', { ...trophy, unlockedAt: now });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. RÉVOCATION D'UN TROPHÉE (non-permanent uniquement)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Si le trophée non-permanent `trophyId` est actuellement déverrouillé ET que
 * la condition n'est plus remplie, le révoque et retire les XP accordés.
 *
 * @param {string} trophyId
 * @param {object} [checkData]
 */
function revokeTrophyIfNeeded(trophyId, checkData) {
  const trophy = _catalogIndex[trophyId];
  if (!trophy) return;
  if (trophy.isPermanent) return; // jamais révocable

  const gState  = gamificationService.getState();
  const tState  = gState.trophies?.[trophyId];
  if (!tState?.unlocked) return; // pas déverrouillé → rien à révoquer

  // ── Cas spécial : portfolio_en_pleine_sante — expiration 7 jours ──────────
  if (trophyId === 'portfolio_en_pleine_sante') {
    const now       = Date.now();
    const score     = gState.healthScore?.current || 0;
    const expired   = tState.expiresAt && new Date(tState.expiresAt).getTime() < now;
    if (score < 85 && expired) {
      _revokeEntry(trophyId, tState);
    }
    return;
  }

  // ── Cas général ───────────────────────────────────────────────────────────
  const d = checkData || _getCheckData();
  if (trophy.checkFn && !trophy.checkFn(d)) {
    _revokeEntry(trophyId, tState);
  }
}

/** Effectue la révocation dans le state et retire les XP. */
function _revokeEntry(trophyId, tState) {
  const gState  = gamificationService.getState();
  const updated = {
    ...(gState.trophies || {}),
    [trophyId]: { ...tState, unlocked: false, revokedAt: new Date().toISOString() },
  };
  gamificationService.patchState({ trophies: updated });
  gamificationService.notifyProgress('revoke_' + trophyId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. PASSE COMPLÈTE — checkAllTrophies()
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Vérifie tous les trophées : déverrouille ceux dont la condition est remplie,
 * révoque les trophées non-permanents dont la condition n'est plus remplie.
 *
 * Idempotent et protégé contre la ré-entrance (notifyProgress → progressUpdated → checkAllTrophies).
 */
function checkAllTrophies() {
  if (_checkingTrophies) return;
  _checkingTrophies = true;

  try {
    const d = _getCheckData(); // une seule collecte de données pour la passe entière

    for (const trophy of TROPHY_CATALOG) {
      try {
        // Lire l'état à chaque itération car patchState le met à jour
        const gState  = gamificationService.getState();
        const tState  = gState.trophies?.[trophy.id];
        const unlocked = tState?.unlocked === true;

        if (unlocked) {
          if (!trophy.isPermanent) {
            revokeTrophyIfNeeded(trophy.id, d);
          }
        } else {
          checkAndUnlockTrophy(trophy.id, d);
        }
      } catch (e) {
        console.warn('[trophyService] check error —', trophy.id, e);
      }
    }
  } finally {
    _checkingTrophies = false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. BADGE OBJECTIF PERSONNEL
//    Pas de XP — spec section 5.2.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Déverrouille directement un badge tutoriel ou utilisateur sans passer par checkFn.
 * Marque le badge comme débloqué. Idempotent.
 *
 * À utiliser pour les badges de quête (quest_N_done) et les badges utilisateur
 * (badge_fondateur, badge_debutant_motive…) dont checkFn est null par conception.
 *
 * @param {string} badgeId — ID du badge (ex : "badge_fondateur", "quest_1_done")
 */
function unlockDirectBadge(badgeId) {
  const trophy = _catalogIndex[badgeId];
  if (!trophy) return;

  const gState = gamificationService.getState();
  if (gState.trophies?.[badgeId]?.unlocked === true) return; // idempotent

  const now = new Date().toISOString();
  const xp  = trophy.xpReward || 0;
  const updatedTrophies = {
    ...(gState.trophies || {}),
    [badgeId]: { unlocked: true, unlockedAt: now, xpAwarded: xp },
  };
  gamificationService.patchState({ trophies: updatedTrophies });

  // Attribuer les XP (comme checkAndUnlockTrophy)
  gamificationService.notifyProgress('trophy_' + badgeId);

  // Émettre l'événement pour l'UI (notification / carte de félicitations)
  gamificationService.dispatchEvent('trophyUnlocked', { ...trophy, unlocked: true, unlockedAt: now });
}

/**
 * Déverrouille directement un badge de défi mensuel (Prompt 9).
 * Contrairement à checkAndUnlockTrophy, ne nécessite pas de checkFn.
 * Idempotent — ne fait rien si le badge est déjà déverrouillé.
 * Note : les XP sont attribués par l'appelant (challengeService / streakService).
 *
 * @param {string} badgeId — ID du badge (ex : "challenge_january_rebalancer")
 */
function unlockChallengeBadge(badgeId) {
  const trophy = _catalogIndex[badgeId];
  if (!trophy) return;

  const gState = gamificationService.getState();
  if (gState.trophies?.[badgeId]?.unlocked === true) return; // idempotent

  const now = new Date().toISOString();
  const xp  = trophy.xpReward || 0;
  const updated = {
    ...(gState.trophies || {}),
    [badgeId]: { unlocked: true, unlockedAt: now, xpAwarded: xp },
  };
  gamificationService.patchState({ trophies: updated });
  gamificationService.dispatchEvent('trophyUnlocked', {
    ...trophy,
    unlocked:   true,
    unlockedAt: now,
  });
}

/**
 * Crée un badge one-off quand un objectif personnel est atteint à 100 %.
 * Le badge est permanent et apparaît sous "Mes objectifs atteints".
 *
 * @param {{ id: string, label: string, targetAmount: number }} objective
 * @param {number} currentAmount — valeur actuelle de l'objectif
 */
function checkObjectiveBadge(objective, currentAmount) {
  if (!objective?.id) return;

  const badgeId = 'objective_' + objective.id;
  const gState  = gamificationService.getState();

  // Déjà accordé
  if (gState.trophies?.[badgeId]?.unlocked === true) return;

  // Condition : objectif atteint (100 %)
  if ((objective.targetAmount || 0) <= 0) return;
  if (currentAmount < objective.targetAmount) return;

  const now = new Date().toISOString();
  const updated = {
    ...(gState.trophies || {}),
    [badgeId]: {
      unlocked:    true,
      unlockedAt:  now,
      xpAwarded:   0,     // jamais de XP pour les objectifs — spec 5.2
      isPermanent: true,
      label:       objective.label || 'Objectif atteint',
      category:    'objective',
    },
  };
  gamificationService.patchState({ trophies: updated });
  gamificationService.dispatchEvent('trophyUnlocked', {
    id: badgeId,
    category: 'objective',
    emoji:    '🎯',
    labelFr:  objective.label || 'Objectif atteint',
    xpReward: 0,
    isPermanent: true,
    unlockedAt:  now,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9. HOOKS EXTERNES — appelés depuis les pages
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * À appeler depuis SimulationDetail.js après l'application d'un stress test.
 *
 * @param {number} lossPercent — pourcentage de perte simulé (ex : 15.3 pour −15,3 %)
 */
function recordStressTestResult(lossPercent) {
  if (typeof lossPercent !== 'number' || isNaN(lossPercent)) return;
  const clamped = Math.max(0, Math.min(100, lossPercent));
  gamificationService.patchState({
    stressTest: {
      lastLossPct:  clamped,
      lastTestDate: new Date().toISOString().split('T')[0],
    },
  });
  // Re-vérifier les trophées antifragile / bunker
  checkAndUnlockTrophy('antifragile');
  checkAndUnlockTrophy('bunker');
  // Vérifier la quête Q5 (condition : lastLossPct défini)
  try { _getQuestService()?.checkCurrentQuest(); } catch (_) {}
}

/**
 * À appeler depuis TaxSimulator.js quand une recommandation est affichée.
 * Active le suivi pour le trophée "Optimiseur".
 *
 * @param {string} portfolioType — type d'enveloppe conseillée ('PEA', 'assurance_vie', etc.)
 */
function recordFiscalRecommendation(portfolioType) {
  if (!portfolioType) return;
  const gState = gamificationService.getState();
  gamificationService.patchState({
    profile: {
      ...gState.profile,
      lastFiscalRecommendation: {
        portfolioType,
        date: new Date().toISOString().split('T')[0],
      },
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 10. ABONNEMENT AUTOMATIQUE AU BUS D'ÉVÉNEMENTS
//     initTrophyWatcher() doit être appelé une seule fois au démarrage (index.js).
// ═══════════════════════════════════════════════════════════════════════════════

let _watcherInitialized = false;

/**
 * Abonne checkAllTrophies aux événements XP pour une vérification automatique
 * après chaque mutation de données (mouvement, enveloppe, calibration…).
 *
 * Protégé contre les appels multiples.
 */
function initTrophyWatcher() {
  if (_watcherInitialized) return;
  _watcherInitialized = true;

  // Chaque notifyProgress (déclenché par les hooks dataService) relance la passe
  gamificationService.onEvent('progressUpdated', () => {
    if (!_checkingTrophies) checkAllTrophies();
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 11. LISTE ENRICHIE POUR L'INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

const _48H = 48 * 3600 * 1000;

/**
 * Retourne le catalogue enrichi avec l'état courant de chaque trophée.
 * Inclut les badges d'objectifs personnels.
 *
 * @returns {Array<{
 *   id, category, emoji, labelFr, xpReward, isPermanent,
 *   unlocked, unlockedAt, xpAwarded, isNew, expiresAt?
 * }>}
 */
function getTrophiesWithMeta() {
  const gState  = gamificationService.getState();
  const now     = Date.now();
  const trophies = gState.trophies || {};

  // Trophées du catalogue
  const catalog = TROPHY_CATALOG.map(t => {
    const entry = trophies[t.id] || {};
    return {
      ...t,
      unlocked:    entry.unlocked  === true,
      unlockedAt:  entry.unlockedAt || null,
      xpAwarded:   entry.xpAwarded  ?? t.xpReward,
      expiresAt:   entry.expiresAt  || null,
      isNew: entry.unlocked && entry.unlockedAt
        ? (now - new Date(entry.unlockedAt).getTime()) < _48H
        : false,
    };
  });

  // Badges d'objectifs personnels (clés commençant par "objective_")
  const objectiveBadges = Object.entries(trophies)
    .filter(([id, entry]) => id.startsWith('objective_') && entry.unlocked)
    .map(([id, entry]) => ({
      id,
      category:    'objective',
      emoji:       '🎯',
      labelFr:     entry.label || 'Objectif atteint',
      xpReward:    0,
      isPermanent: true,
      checkFn:     null,
      unlocked:    true,
      unlockedAt:  entry.unlockedAt || null,
      xpAwarded:   0,
      expiresAt:   null,
      isNew: entry.unlockedAt
        ? (now - new Date(entry.unlockedAt).getTime()) < _48H
        : false,
    }));

  return [...catalog, ...objectiveBadges];
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

const trophyService = {
  TROPHY_CATALOG,
  checkAllTrophies,
  checkAndUnlockTrophy,
  unlockDirectBadge,
  unlockChallengeBadge,
  revokeTrophyIfNeeded,
  checkObjectiveBadge,
  recordStressTestResult,
  recordFiscalRecommendation,
  initTrophyWatcher,
  getTrophiesWithMeta,
};

export default trophyService;

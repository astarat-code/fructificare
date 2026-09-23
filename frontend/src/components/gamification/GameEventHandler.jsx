// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * GameEventHandler.jsx — Global animation orchestrator
 *
 * Headless component rendered once in App.js.
 * Subscribes to the gamification event bus and triggers:
 *   - trophyUnlocked     → badge toast + glow animation
 *   - healthScoreUpdated → confetti if the score is ≥ 85
 *   - objectiveCompleted → confetti + toast
 *   - streakUpdated      → activateFlame if currentStreak >= 7
 */

import { useState, useEffect, useRef } from 'react';
import { rewardToast } from '../../lib/rewardToast';
import gamificationService from '../../services/gamificationService';
import questService        from '../../services/questService';
import flameService        from '../../services/flameService';
import WelcomeModal        from './WelcomeModal';
import ConfettiBurst       from './Confetti';
import { useLanguage }     from '../../context/LanguageContext';

// ── Utilitaires ────────────────────────────────────────────────────────────────

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ── Composant ──────────────────────────────────────────────────────────────────

export default function GameEventHandler() {
  const [showHealthConfetti, setShowHealthConfetti] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const { lang } = useLanguage();
  // Ref pour éviter les closures périmées dans les handlers d'événements
  const langRef = useRef(lang);
  useEffect(() => { langRef.current = lang; }, [lang]);

  // ── Fenêtre de bienvenue (1er lancement, avant la première mission) ─────────
  useEffect(() => {
    try {
      const gState  = gamificationService.getState();
      const gamifOn = gState?.preferences?.gamificationEnabled !== false;
      const already = gState?.flags?.onboardingWelcomeShown === true;
      const { completedCount, allDone } = questService.getCurrentQuestState();
      // Affichée seulement pour un nouvel utilisateur (tutoriel non entamé) et une seule fois.
      if (gamifOn && !already && completedCount === 0 && !allDone) {
        setShowWelcome(true);
      }
    } catch (_) { /* état indisponible : on n'affiche rien */ }
  }, []);

  const handleWelcomeContinue = () => {
    try { gamificationService.patchState({ flags: { onboardingWelcomeShown: true } }); } catch (_) {}
    setShowWelcome(false);
  };

  useEffect(() => {
    /** Retourne true si la gamification est activée dans les préférences. */
    const isGamifOn = () =>
      gamificationService.getState()?.preferences?.gamificationEnabled !== false;

    // ── 3. Badge / Trophée déverrouillé ───────────────────────────────────────
    const unTrophy = gamificationService.onEvent('trophyUnlocked', (data) => {
      if (!data || !isGamifOn()) return;
      const emoji = data.emoji || '🏅';
      const isFr  = langRef.current === 'fr';
      const label = isFr
        ? (data.labelFr || data.label || 'Trophée débloqué')
        : (data.labelEn || data.labelFr || data.label || 'Trophy unlocked');
      rewardToast(`${emoji} ${label}`, { accent: '#F59E0B' });
    });

    // ── 5. Score de santé ≥ 85 ────────────────────────────────────────────────
    const unHealth = gamificationService.onEvent('healthScoreUpdated', (data) => {
      if (!isGamifOn()) return;
      const { score, previousScore } = data || {};
      if (typeof score !== 'number' || score < 85) return;
      if (typeof previousScore === 'number' && previousScore >= 85) return;

      if (!prefersReducedMotion()) setShowHealthConfetti(true);
      const isFr = langRef.current === 'fr';
      rewardToast(
        isFr
          ? '❤️ Portfolio en pleine santé ! Badge temporaire accordé (7 jours).'
          : '❤️ Portfolio in great health! Temporary badge granted (7 days).',
        { accent: '#ef4444' }
      );
    });

    // ── 6. Streak → flamme ────────────────────────────────────────────────────
    const unStreak = gamificationService.onEvent('streakUpdated', (data) => {
      if (!isGamifOn()) return;
      const { currentStreak } = data || {};
      if ((currentStreak || 0) >= 7) {
        flameService.activateFlame();
      }
    });

    // ── 7. Objectif accompli ───────────────────────────────────────────────────
    // (toujours affiché, même si gamification désactivée — c'est une info de progression)
    const unObjective = gamificationService.onEvent('objectiveCompleted', (data) => {
      const label = data?.label || (langRef.current === 'fr' ? 'Objectif' : 'Goal');
      const isFr  = langRef.current === 'fr';
      rewardToast(
        isFr
          ? `🎉 Objectif atteint : "${label}" !`
          : `🎉 Goal reached: "${label}"!`,
        { accent: '#10B981' }
      );
    });

    // ── 8. Quête tutoriel complétée ───────────────────────────────────────────
    const unQuest = gamificationService.onEvent('questCompleted', (data) => {
      if (!data || !isGamifOn()) return;
      const { quest, idx } = data || {};
      if (!quest) return;
      const isFr = langRef.current === 'fr';
      const title = isFr ? quest.titleFr : (quest.titleEn || quest.titleFr);
      rewardToast(
        `🎯 ${isFr ? `Q${idx} complétée` : `Q${idx} completed`} — ${title}`,
        { accent: '#10B981' }
      );
    });

    return () => {
      unTrophy();
      unHealth();
      unStreak();
      unObjective();
      unQuest();
    };
  }, []);

  return (
    <>
      {/* Fenêtre de bienvenue (avant la première mission) */}
      <WelcomeModal open={showWelcome} onContinue={handleWelcomeContinue} />

      {/* Confettis score de santé */}
      {showHealthConfetti && (
        <ConfettiBurst
          count={50}
          duration={3000}
          onDone={() => setShowHealthConfetti(false)}
        />
      )}
    </>
  );
}

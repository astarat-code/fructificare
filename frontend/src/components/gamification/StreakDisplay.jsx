// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * StreakDisplay.jsx — Login streak display
 *
 * Shows:
 *  - a flame icon (animated when the streak is >= 7)
 *  - the number of consecutive days + label
 *  - a "Persistent flame" badge at >= 30 days
 *  - an "Eternal flame" badge at >= 90 days
 *  - a tooltip with the best streak
 *
 * Usage: <StreakDisplay /> — subscribes to the gamification events
 */

import { useState, useEffect } from 'react';
import { Flame } from 'lucide-react';
import gamificationService from '../../services/gamificationService';
import streakService from '../../services/streakService';
import { useLanguage } from '../../context/LanguageContext';

export default function StreakDisplay() {
  const [streakData, setStreakData] = useState(() => streakService.getStreakDisplay());
  const { lang } = useLanguage();
  const L = (fr, en) => (lang === 'en' ? en : fr);

  // Réabonnement au bus pour rafraîchir sur connexion du jour / unlock trophée
  useEffect(() => {
    const refresh = () => setStreakData(streakService.getStreakDisplay());
    const u1 = gamificationService.onEvent('streakUpdated', refresh);
    const u2 = gamificationService.onEvent('progressUpdated', refresh);
    return () => { u1(); u2(); };
  }, []);

  const { currentStreak, longestStreak } = streakData;

  // Pas de série → pas d'affichage (première visite du jour pas encore traitée)
  if (currentStreak === 0) return null;

  const isHot      = currentStreak >= 7;
  const isPersist  = currentStreak >= 30;
  const isEternal  = currentStreak >= 90;

  // Couleur de la flamme en fonction de la série
  const flameColor = isEternal  ? '#f97316'   // orange vif
                   : isPersist  ? '#ef4444'   // rouge
                   : isHot      ? '#f59e0b'   // ambre
                   :              '#94a3b8';  // gris (< 7 jours)

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card border border-border shadow-sm select-none"
      title={longestStreak > currentStreak
        ? L(`Meilleure série : ${longestStreak} jours`, `Best streak: ${longestStreak} days`)
        : L('Série en cours !', 'Streak in progress!')}
    >
      {/* Flamme — animée si série >= 7 */}
      <Flame
        className={`w-4 h-4 transition-all ${isHot ? 'animate-pulse' : ''}`}
        style={{ color: flameColor }}
      />

      {/* Compteur */}
      <span className="text-sm font-bold tabular-nums" style={{ color: flameColor }}>
        {currentStreak}
      </span>
      <span className="text-xs text-muted-foreground hidden sm:inline">
        {L('jour', 'day')}{currentStreak !== 1 ? 's' : ''}
      </span>

      {/* Badge niveau */}
      {isEternal ? (
        <span className="text-xs font-semibold text-orange-500 hidden md:inline">
          🔥🔥🔥 {L('Flamme éternelle', 'Eternal flame')}
        </span>
      ) : isPersist ? (
        <span className="text-xs font-semibold text-red-500 hidden md:inline">
          🔥 {L('Flamme persistante', 'Lasting flame')}
        </span>
      ) : null}
    </div>
  );
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * flameService.js — Login streak flame.
 *
 * Replaces `levelThemeService`: the per-level theme, the tiers, the titles and the level-up
 * sound were removed along with the XP system. Only the flame remains, lit for 24 h as soon
 * as a streak reaches 7 consecutive days.
 *
 * API:
 *   isFlameActive()  → boolean
 *   activateFlame()  → void  (stores flammeActiveUntil = now + 24 h)
 */

import gamificationService from './gamificationService';

/** Vérifie si la flamme de série est encore active. */
export function isFlameActive() {
  try {
    const gState = gamificationService.getState();
    const until  = gState.streak?.flammeActiveUntil;
    if (!until) return false;
    return new Date(until).getTime() > Date.now();
  } catch (_) { return false; }
}

/** Active la flamme pour les 24 prochaines heures. */
export function activateFlame() {
  try {
    const gState = gamificationService.getState();
    const until  = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    gamificationService.patchState({
      streak: { ...(gState.streak || {}), flammeActiveUntil: until },
    });
  } catch (_) {}
}

const flameService = { isFlameActive, activateFlame };
export default flameService;

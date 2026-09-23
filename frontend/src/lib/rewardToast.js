// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * rewardToast.js — queue for the reward notifications (gamification).
 *
 * Problem solved: reward toasts (trophy, goal, quest, chapter…) used to appear at the same
 * time, at different positions, each with its own border on top of the toast's base border
 * → a "nested frames" look, and overlap with the "Success" toast of ordinary actions.
 *
 * Solution:
 *   - ONE reward shown at a time (strict serialization).
 *   - Exactly 3 s on screen, then a 0.5 s gap before the next one.
 *   - A single position (bottom-right corner), distinct from the action toast (top-right),
 *     so that a "Success" is never overlapped.
 *   - Unified style: one clean border.
 *   - Fade-out handled by sonner's native exit animation.
 */

import { toast } from 'sonner';

const DISPLAY_MS = 3000; // durée d'affichage (exactement 3 s)
const GAP_MS     = 500;  // intervalle entre deux récompenses

const _queue = [];
let _active = false;

function _process() {
  if (_active || _queue.length === 0) return;
  _active = true;
  const { message, accent } = _queue.shift();

  toast(message, {
    duration: DISPLAY_MS,
    position: 'bottom-right',
    className: 'fructi-reward-toast',
    style: {
      border: `2px solid ${accent}`,
      background: 'var(--card)',
      color: 'var(--foreground)',
      fontWeight: 600,
      fontSize: '0.85rem',
    },
  });

  // Libère le créneau après l'affichage + l'intervalle (la récompense précédente
  // est déjà retirée à DISPLAY_MS, la suivante apparaît après le gap).
  setTimeout(() => {
    _active = false;
    _process();
  }, DISPLAY_MS + GAP_MS);
}

/**
 * Met une récompense en file d'attente (affichage sérialisé).
 * @param {string} message — texte du toast (emoji inclus)
 * @param {{ accent?: string }} [opts] — couleur d'accent de la bordure (défaut ambre)
 */
export function rewardToast(message, { accent = '#F59E0B' } = {}) {
  _queue.push({ message, accent });
  _process();
}

export default rewardToast;

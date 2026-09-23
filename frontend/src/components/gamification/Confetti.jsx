// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * Confetti.jsx — Confettis canvas légers (Prompt 12)
 *
 * < 4 KB minifié. Respecte prefers-reduced-motion.
 *
 * Usage :
 *   <ConfettiBurst onDone={cb} count={60} />            — plein écran
 *   <ConfettiBurst local rect={domRect} count={30} />   — localisé sur un élément
 */

import { useEffect, useRef } from 'react';

const COLORS = [
  '#F59E0B', '#EF4444', '#10B981', '#3B82F6',
  '#8B5CF6', '#EC4899', '#F97316', '#06B6D4',
];

function randomBetween(a, b) { return a + Math.random() * (b - a); }

/**
 * @param {object}   props
 * @param {Function} [props.onDone]      — appelée quand l'animation se termine
 * @param {number}   [props.count=60]    — nombre de particules
 * @param {boolean}  [props.local=false] — si true, positionné sur l'élément parent
 * @param {DOMRect}  [props.rect]        — bounding box pour confettis localisés
 * @param {number}   [props.duration=3000] — ms d'animation
 */
export default function ConfettiBurst({ onDone, count = 60, local = false, rect, duration = 3000 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    // Respect prefers-reduced-motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      onDone?.();
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx    = canvas.getContext('2d');

    // Taille du canvas
    if (local && rect) {
      canvas.width  = rect.width;
      canvas.height = rect.height;
    } else {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    // Origine des confettis
    const originX = local && rect ? rect.width  / 2 : canvas.width  / 2;
    const originY = local && rect ? rect.height / 4 : canvas.height / 3;

    // Créer les particules
    const particles = Array.from({ length: count }, () => ({
      x:    originX,
      y:    originY,
      vx:   randomBetween(-8, 8),
      vy:   randomBetween(-14, -4),
      w:    randomBetween(6, 12),
      h:    randomBetween(4, 8),
      rot:  randomBetween(0, Math.PI * 2),
      rotV: randomBetween(-0.15, 0.15),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      gravity: randomBetween(0.25, 0.45),
      alpha: 1,
    }));

    let startTime = null;
    let animId;

    function draw(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        p.x   += p.vx;
        p.y   += p.vy;
        p.vy  += p.gravity;
        p.rot += p.rotV;
        p.alpha = Math.max(0, 1 - elapsed / duration);

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });

      if (elapsed < duration) {
        animId = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        onDone?.();
      }
    }

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (local) {
    return (
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 10,
          borderRadius: 'inherit',
        }}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 9990,
      }}
    />
  );
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * ObjectiveCard.jsx — Card displaying one personal goal
 *
 * Props:
 *   objective   {object}        — the goal's data (id, label, icon, targetDate…)
 *   progress    {object}        — result of objectiveService.getObjectiveProgress()
 *   onEdit      {() => void}    — opens the edit dialog
 *   onDelete    {() => void}    — deletes the goal (with confirmation)
 *
 * Features:
 *   - progress bar, colored by how far along the goal is
 *   - current amount / target amount, in euros
 *   - estimated time left (months at the current pace, or target date)
 *   - confetti animation on the first render once the goal is reached
 *   - "Goal reached!" badge + trophy icon when isCompleted
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Pencil, Trash2, Trophy } from "lucide-react";
import { OBJECTIVE_ICONS } from "../../services/objectiveService";
import { useLanguage } from "../../context/LanguageContext";

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════════

/** Pièces de confetti — positions et couleurs déterministes (pas de Math.random). */
const CONFETTI_PIECES = [
  { left: '8%',  tx: -18, ty: -62, tr: 120, color: '#F59E0B', size: 7,  delay: '0s'    },
  { left: '20%', tx:  22, ty: -78, tr: 200, color: '#10B981', size: 6,  delay: '0.08s' },
  { left: '33%', tx: -12, ty: -88, tr: 300, color: '#6366F1', size: 8,  delay: '0.04s' },
  { left: '46%', tx:  38, ty: -66, tr:  90, color: '#EF4444', size: 5,  delay: '0.14s' },
  { left: '58%', tx: -28, ty: -82, tr: 250, color: '#EC4899', size: 7,  delay: '0.07s' },
  { left: '70%', tx:  12, ty: -92, tr: 170, color: '#0EA5E9', size: 6,  delay: '0.11s' },
  { left: '82%', tx: -42, ty: -72, tr: 330, color: '#F97316', size: 5,  delay: '0.02s' },
  { left: '93%', tx:  18, ty: -58, tr:  60, color: '#8B5CF6', size: 8,  delay: '0.17s' },
];

/** Durée d'affichage de l'animation confetti (ms). */
const CONFETTI_DURATION_MS = 1800;

// ═══════════════════════════════════════════════════════════════════════════════
// 2. HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Couleur de la barre selon le taux de progression. */
function progressColor(pct) {
  if (pct >= 100) return '#F59E0B'; // or — objectif atteint
  if (pct >= 75)  return '#10B981'; // vert vif
  if (pct >= 25)  return '#F97316'; // orange
  return '#EF4444';                  // rouge
}

/** Formate un montant en euros compact. */
function fmtEur(v) {
  if (!v && v !== 0) return '—';
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} M€`;
  if (Math.abs(v) >= 10_000)    return `${(v / 1_000).toFixed(0)} k€`;
  return new Intl.NumberFormat('fr-FR', {
    style:                 'currency',
    currency:              'EUR',
    maximumFractionDigits: 0,
  }).format(v);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. SOUS-COMPOSANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Estimation du temps restant sous la barre. */
function TimeEstimate({ progress, targetDate, L }) {
  if (progress.isCompleted) return null;

  if (targetDate) {
    const target = new Date(targetDate);
    const now    = new Date();

    if (target < now) {
      return (
        <span className="text-xs font-medium text-destructive">⚠ {L('Date dépassée', 'Date passed')}</span>
      );
    }

    const months = (target.getFullYear() - now.getFullYear()) * 12 +
                   (target.getMonth()    - now.getMonth());
    if (months <= 0) {
      return <span className="text-xs text-amber-600 font-medium">{L('Ce mois-ci !', 'This month!')}</span>;
    }
    return (
      <span className="text-xs text-muted-foreground">
        {L(`Objectif dans ${months} mois`, `Goal in ${months} month${months > 1 ? 's' : ''}`)}
      </span>
    );
  }

  if (progress.monthsToTarget !== null) {
    return (
      <span className="text-xs text-muted-foreground">
        {L(`~${progress.monthsToTarget} mois au rythme actuel`, `~${progress.monthsToTarget} month${progress.monthsToTarget > 1 ? 's' : ''} at current pace`)}
      </span>
    );
  }

  return null;
}

/** Pièces de confetti SVG animées. */
function Confetti() {
  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl"
      aria-hidden="true"
    >
      {CONFETTI_PIECES.map((p, i) => (
        <div
          key={i}
          className="absolute bottom-1/3 rounded-sm"
          style={{
            left:            p.left,
            width:           p.size,
            height:          p.size,
            backgroundColor: p.color,
            // CSS custom properties pour l'animation
            '--cfx': `${p.tx}px`,
            '--cfy': `${p.ty}px`,
            '--cfr': `${p.tr}deg`,
            animation:       `fruc-confetti-fly 0.9s ease-out ${p.delay} both`,
          }}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export default function ObjectiveCard({ objective, progress, onEdit, onDelete }) {
  const { lang } = useLanguage();
  const L = (fr, en) => (lang === 'en' ? en : fr);
  const [showConfetti,    setShowConfetti]    = useState(false);
  const [confirmDelete,   setConfirmDelete]   = useState(false);
  const confettiShownRef = useRef(false);

  // ── Injection de @keyframes une seule fois dans <head> ───────────────────
  useEffect(() => {
    const styleId = 'fruc-confetti-keyframes';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id    = styleId;
    style.textContent = `
      @keyframes fruc-confetti-fly {
        0%   { transform: translate(0,0) rotate(0deg) scale(1.2); opacity: 1; }
        80%  { opacity: 0.7; }
        100% { transform: translate(var(--cfx), var(--cfy)) rotate(var(--cfr)) scale(0.4); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }, []);

  // ── Déclencher le confetti sur le premier rendu si objectif atteint ──────
  useEffect(() => {
    if (progress?.isCompleted && !confettiShownRef.current) {
      confettiShownRef.current = true;
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), CONFETTI_DURATION_MS);
      return () => clearTimeout(timer);
    }
  }, [progress?.isCompleted]);

  // ── Confirmation de suppression ──────────────────────────────────────────
  const handleDeleteClick = useCallback(() => {
    setConfirmDelete(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    setConfirmDelete(false);
    onDelete?.();
  }, [onDelete]);

  // ── Données dérivées ─────────────────────────────────────────────────────
  const icon        = OBJECTIVE_ICONS[objective.icon] || OBJECTIVE_ICONS.other;
  const pct         = progress?.progressPercent ?? 0;
  const barColor    = progressColor(pct);
  const isCompleted = progress?.isCompleted ?? false;

  return (
    <div
      className={[
        'relative rounded-xl border p-4 space-y-3 transition-all duration-300',
        isCompleted
          ? 'border-amber-400/70 bg-amber-50/60 dark:bg-amber-950/20 shadow-sm'
          : 'border-border bg-card',
      ].join(' ')}
    >
      {/* Confetti overlay */}
      {showConfetti && <Confetti />}

      {/* ── En-tête : icône + label + boutons ────────────────────────────── */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-2xl leading-none shrink-0">{icon.emoji}</span>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{objective.label}</p>
            {isCompleted && (
              <div className="flex items-center gap-1 mt-0.5">
                <Trophy className="w-3 h-3 text-amber-500" />
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  {L('Objectif atteint !', 'Goal reached!')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Boutons édition/suppression */}
        <div className="flex items-center gap-1 shrink-0">
          {!confirmDelete ? (
            <>
              <button
                onClick={onEdit}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground
                           hover:bg-accent transition-colors"
                title={L('Modifier', 'Edit')}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleDeleteClick}
                className="p-1.5 rounded-md text-muted-foreground hover:text-destructive
                           hover:bg-destructive/10 transition-colors"
                title={L('Supprimer', 'Delete')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            /* Confirmation inline */
            <div className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">{L('Supprimer ?', 'Delete?')}</span>
              <button
                onClick={handleDeleteConfirm}
                className="px-2 py-1 rounded bg-destructive text-destructive-foreground
                           text-xs font-medium hover:bg-destructive/80 transition-colors"
              >
                {L('Oui', 'Yes')}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1 rounded border border-border text-xs hover:bg-accent
                           transition-colors"
              >
                {L('Non', 'No')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Barre de progression ─────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, pct)}%`, backgroundColor: barColor }}
          />
        </div>

        {/* Montants + pourcentage */}
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold" style={{ color: barColor }}>
            {fmtEur(progress?.currentAmount ?? 0)}
          </span>
          <span className="text-muted-foreground font-mono">
            {pct.toFixed(1)} %
          </span>
          <span className="text-muted-foreground">
            / {fmtEur(progress?.targetAmount ?? objective.targetAmount)}
          </span>
        </div>
      </div>

      {/* ── Estimation temporelle ─────────────────────────────────────────── */}
      <TimeEstimate
        progress={progress}
        targetDate={objective.targetDate}
        L={L}
      />

    </div>
  );
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * Trophees.js — the "Trophies & Progress" page
 *
 * 4 vertical sections:
 *   A. XP bar & level header
 *   B. Two-column panel: metrics (health/FIRE/crossover) + My goals
 *   C. Grid of the 10 tutorial trophies
 *   D. Accordion of the advanced trophies, by category
 *
 * Performance: the data is read once, through useMemo.
 * HealthScoreDisplay is only rendered when the Dialog opens (< 300 ms guaranteed).
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import Disclaimer from "../components/ui/Disclaimer";
import {
  Trophy, ChevronDown, ChevronUp, Plus, Lock, Star, Flame, Heart, Target, Check, BookOpen, X, Settings2,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";

import gamificationService  from "../services/gamificationService";
import trophyService        from "../services/trophyService";
import questService         from "../services/questService";
import AvatarIcon           from "../components/gamification/AvatarIcon";
import avatarService, { CHAPITRES } from "../services/avatarService";
import objectiveService     from "../services/objectiveService";
import healthScoreService   from "../services/healthScoreService";
import dataService          from "../services/dataService";
import challengeService, { MONTHLY_CHALLENGE_CATALOG } from "../services/challengeService";
import HealthScoreDisplay   from "../components/gamification/HealthScoreDisplay";
import BirthdatePopup       from "../components/gamification/BirthdatePopup";
import ObjectiveCard        from "../components/gamification/ObjectiveCard";
import ObjectiveModal       from "../components/gamification/ObjectiveModal";

// ═══════════════════════════════════════════════════════════════════════════════
// 1. HELPERS LOCAUX
// ═══════════════════════════════════════════════════════════════════════════════


const CATEGORY_LABELS = {
  utilisateur: '🏅 Badges utilisateur',
  tutorial:   'Tutoriel',
  regularity: 'Régularité',
  patrimony:  'Patrimoine',
  gains:      'Gains',
  management: 'Gestion',
  fiscal:     'Fiscal',
  health:     'Santé financière',
  fire:       'FIRE',
  streak:     'Séries & Assiduité',
  challenge:  'Défis mensuels',
  challenge_cumul:   '🏆 Défis cumulés',
  calibration_cumul: '🎯 Calibrations cumulées',
  loyalty:    '🎖️ Fidélité longue durée',
  veteran:    '🏛️ Ancienneté',
  objective:  'Objectifs personnels',
};

const CATEGORY_LABELS_EN = {
  utilisateur: '🏅 User Badges',
  tutorial:   'Tutorial',
  regularity: 'Regularity',
  patrimony:  'Wealth',
  gains:      'Gains',
  management: 'Management',
  fiscal:     'Tax',
  health:     'Financial health',
  fire:       'FIRE',
  streak:     'Streaks & Consistency',
  challenge:  'Monthly challenges',
  challenge_cumul:   '🏆 Cumulative challenges',
  calibration_cumul: '🎯 Cumulative calibrations',
  loyalty:    '🎖️ Long-term loyalty',
  veteran:    '🏛️ Seniority',
  objective:  'Personal goals',
};

const CATEGORY_ORDER = [
  'utilisateur', 'regularity', 'patrimony', 'gains', 'management',
  'fiscal', 'health', 'fire', 'streak', 'challenge',
  'challenge_cumul', 'calibration_cumul', 'loyalty', 'veteran', 'objective',
];

// Indice « comment l'obtenir » par catégorie — utilisé quand le libellé du trophée ne
// contient pas déjà sa condition (après un tiret « — »).
const CATEGORY_HINT_FR = {
  utilisateur: "Badge spécial attribué pour une action ou un statut particulier dans l'application.",
  tutorial:   'Complétez la mission correspondante du parcours tutoriel.',
  regularity: 'Maintenez une régularité de versements ou de calibrations.',
  patrimony:  'Atteignez la valeur réelle totale de votre portefeuille (toutes enveloppes) indiquée.',
  gains:      'Atteignez le niveau de plus-values latentes indiqué.',
  management: 'Utilisez les outils de gestion et de suivi de l\'application.',
  fiscal:     'Exploitez les fonctionnalités fiscales (rapport, simulateur d\'impôt).',
  health:     'Améliorez votre score de santé financière.',
  fire:       'Progressez vers votre objectif d\'indépendance financière (FIRE).',
  streak:     'Enchaînez les jours d\'activité sans interruption.',
  challenge:  'Réussissez les défis mensuels proposés.',
  challenge_cumul:   'Cumulez la réussite de plusieurs défis mensuels.',
  calibration_cumul: 'Cumulez un grand nombre de calibrations d\'enveloppes.',
  loyalty:    'Utilisez l\'application régulièrement sur une longue durée.',
  veteran:    'Faites vivre votre portefeuille dans la durée.',
  objective:  'Atteignez un objectif personnel que vous avez défini.',
};
const CATEGORY_HINT_EN = {
  utilisateur: 'Special badge granted for a particular action or status in the app.',
  tutorial:   'Complete the matching tutorial mission.',
  regularity: 'Keep a steady rhythm of contributions or calibrations.',
  patrimony:  'Reach the indicated total real value of your portfolio (all envelopes).',
  gains:      'Reach the indicated level of unrealised gains.',
  management: 'Use the app\'s management and tracking tools.',
  fiscal:     'Use the tax features (report, tax simulator).',
  health:     'Improve your financial health score.',
  fire:       'Progress towards your financial-independence (FIRE) goal.',
  streak:     'Chain consecutive days of activity without a break.',
  challenge:  'Complete the monthly challenges.',
  challenge_cumul:   'Accumulate several completed monthly challenges.',
  calibration_cumul: 'Accumulate a large number of envelope calibrations.',
  loyalty:    'Use the app regularly over a long period.',
  veteran:    'Keep your portfolio alive over time.',
  objective:  'Reach a personal goal you have defined.',
};

/**
 * Extrait, pour un trophée, un nom court + la façon de l'obtenir.
 * Le libellé est souvent au format « Nom — condition » : on sépare les deux.
 * Sinon, on retombe sur l'objectif de la quête (tutoriel) ou l'indice de catégorie.
 */
function getTrophyInfo(trophy, quest, lang) {
  const raw = (lang === 'fr' ? trophy.labelFr : (trophy.labelEn || trophy.labelFr)) || '';
  const i = raw.indexOf('—');
  const name = (i >= 0 ? raw.slice(0, i) : raw).trim();
  const cond = i >= 0 ? raw.slice(i + 1).trim() : '';
  // Une condition réduite à un mois (missions mensuelles : « — Janvier ») n'est pas une
  // vraie explication → on l'ignore au profit de la description explicite.
  const MONTHS = /^(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|january|february|march|april|may|june|july|august|september|october|november|december)$/i;
  const condClean = MONTHS.test(cond) ? '' : cond;
  const explicit = (lang === 'fr' ? trophy.descFr : (trophy.descEn || trophy.descFr)) || '';
  const questObjective = quest ? (lang === 'fr' ? quest.objectiveFr : (quest.objectiveEn || quest.objectiveFr)) : '';
  const hint = (lang === 'fr' ? CATEGORY_HINT_FR : CATEGORY_HINT_EN)[trophy.category] || '';
  // Priorité : description explicite → condition du libellé → objectif de quête → indice catégorie.
  const howTo = explicit || condClean || questObjective || hint;
  const steps = quest ? (lang === 'fr' ? (quest.howToFr || []) : (quest.howToEn || quest.howToFr || [])) : [];
  return { name, howTo, steps };
}

// ── Fenêtre de détail d'un trophée (toutes sections) ───────────────────────────
// Verrouillé → présentation grisée ; obtenu → couleurs normales (thème clair/sombre).
function TrophyDetailModal({ trophy, quest, lang, onClose }) {
  if (!trophy) return null;
  const { name, howTo, steps } = getTrophyInfo(trophy, quest, lang);
  const unlocked = !!trophy.unlocked;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`bg-card border rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 relative ${unlocked ? 'border-border' : 'border-border/60'}`}>
        <button className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors" onClick={onClose}>
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3 pr-6">
          <div className="text-3xl leading-none shrink-0 w-9 flex justify-center">
            {unlocked ? trophy.emoji : <Lock className="w-7 h-7 text-muted-foreground" />}
          </div>
          <div>
            <h3 className={`font-semibold text-base leading-tight ${unlocked ? '' : 'text-muted-foreground'}`}>{name}</h3>
            {unlocked ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                <Check className="w-3.5 h-3.5" />
                {lang === 'fr' ? 'Obtenu' : 'Unlocked'}
                {trophy.unlockedAt ? ` · ${new Date(trophy.unlockedAt).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB')}` : ''}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground mt-0.5">
                <Lock className="w-3 h-3" />
                {lang === 'fr' ? 'Verrouillé' : 'Locked'}
              </span>
            )}
          </div>
        </div>

        {howTo && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              {lang === 'fr' ? "Comment l'obtenir" : 'How to unlock'}
            </p>
            <p className={`text-sm leading-relaxed ${unlocked ? 'text-foreground' : 'text-muted-foreground'}`}>{howTo}</p>
          </div>
        )}

        {steps && steps.length > 0 && (
          <ol className="space-y-2">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                  style={{ background: 'hsl(var(--primary)/0.15)', color: 'hsl(var(--primary))' }}
                >
                  {i + 1}
                </span>
                <span className={`leading-relaxed ${unlocked ? '' : 'text-muted-foreground'}`}>{step}</span>
              </li>
            ))}
          </ol>
        )}

      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. SOUS-COMPOSANTS LOCAUX (sans état de gamification)
// ═══════════════════════════════════════════════════════════════════════════════

// ── Section A ─────────────────────────────────────────────────────────────────

/**
 * En-tête de la page — avatar de l'utilisateur et capital total qui le détermine.
 * Remplace l'ancienne barre d'XP : il n'y a plus ni niveau, ni titre, ni palier.
 */
function AvatarHeader({ avatar, capital, lang }) {
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB';
  const fmtEur = (v) => new Intl.NumberFormat(locale, {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(v || 0);

  const label = lang === 'fr' ? avatar.labelFr : avatar.labelEn;
  const accent = avatar.isPrestige ? '#F59E0B' : 'hsl(var(--primary))';

  // Progression vers le palier suivant
  const span = avatar.nextThreshold != null ? avatar.nextThreshold - avatar.threshold : 0;
  const done = avatar.nextThreshold != null ? Math.max(0, capital - avatar.threshold) : span;
  const pct  = span > 0 ? Math.min(100, (done / span) * 100) : 100;

  return (
    <div
      className="rounded-2xl border p-5 flex flex-col sm:flex-row items-center gap-5"
      style={{ borderColor: avatar.isPrestige ? '#F59E0B60' : undefined }}
    >
      <AvatarIcon
        tier={avatar.tier}
        isGolden={avatar.isGolden}
        isPrestige={avatar.isPrestige}
        title={label}
        size={64}
      />

      <div className="flex-1 w-full space-y-2">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-xl font-bold" style={{ color: accent }}>{label}</span>
            {avatar.isPrestige ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-600 dark:text-amber-400">
                {lang === 'fr' ? 'LÉGENDE' : 'LEGEND'}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                {lang === 'fr' ? CHAPITRES[avatar.chapitre]?.fr : CHAPITRES[avatar.chapitre]?.en}
              </span>
            )}
          </div>
          <span className="text-sm text-muted-foreground">
            {lang === 'fr' ? 'Capital total :' : 'Total capital:'}{' '}
            <span className="font-semibold text-foreground tabular-nums">{fmtEur(capital)}</span>
          </span>
        </div>

        <p className="text-sm italic text-muted-foreground">
          « {lang === 'fr' ? avatar.deviseFr : avatar.deviseEn} »
        </p>

        <div className="space-y-1">
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, backgroundColor: avatar.isPrestige ? '#F59E0B' : 'hsl(var(--primary))' }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {avatar.nextThreshold != null
              ? (lang === 'fr'
                  ? `Prochain avatar à ${fmtEur(avatar.nextThreshold)}`
                  : `Next avatar at ${fmtEur(avatar.nextThreshold)}`)
              : (lang === 'fr' ? 'Dernier avatar atteint 🏆' : 'Final avatar reached 🏆')}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Section B gauche ─────────────────────────────────────────────────────────

function MetricBar({ label, value, max, colorFill, colorLabel, onClick, clickable }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      className={`space-y-1.5 ${clickable ? 'cursor-pointer group' : ''}`}
      onClick={clickable ? onClick : undefined}
    >
      <div className="flex items-center justify-between text-sm">
        <span className={`font-medium ${clickable ? 'group-hover:underline' : ''}`}>{label}</span>
        <span className="font-semibold" style={{ color: colorLabel || colorFill }}>
          {value !== null && value !== undefined
            ? `${typeof value === 'number'
                ? (Number.isInteger(value) ? value : value.toFixed(1))
                : value}${max === 100 ? ' / 100' : ' %'}`
            : '—'}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: colorFill }}
        />
      </div>
    </div>
  );
}

// ── Section C — TutorialTile ──────────────────────────────────────────────────

function TutorialTile({ trophy, quest, status, isGlowing = false, lang, onClick }) {
  const isNew       = trophy.isNew && status === 'completed';
  const label       = lang === 'fr' ? trophy.labelFr : (trophy.labelEn || trophy.labelFr);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
      className={[
        'relative rounded-xl border p-3 flex flex-col items-center gap-1.5 text-center select-none cursor-pointer transition-colors',
        status === 'completed'
          ? 'border-emerald-400/60 bg-emerald-50/60 dark:bg-emerald-950/20 hover:bg-emerald-100/60 dark:hover:bg-emerald-950/40'
          : status === 'active'
          ? 'border-primary/70 bg-primary/5 animate-[pulse_2s_ease-in-out_infinite] hover:bg-primary/10'
          : 'border-border bg-muted/30 opacity-50 hover:opacity-70',
        isGlowing ? 'badge-glow' : '',
      ].join(' ')}
    >
      {isNew && (
        <span className="absolute -top-2 -right-2 text-[9px] font-bold bg-amber-400 text-black
                          rounded-full px-1.5 py-0.5 shadow-sm z-10">
          {lang === 'fr' ? 'NOUVEAU' : 'NEW'}
        </span>
      )}
      <span className="absolute top-1.5 right-1.5 opacity-50">
        <BookOpen className="w-2.5 h-2.5 text-muted-foreground" />
      </span>
      <div className="text-2xl leading-none">
        {status === 'locked'
          ? <Lock className="w-5 h-5 text-muted-foreground" />
          : trophy.emoji}
      </div>
      <p className={`text-xs font-medium leading-tight ${status === 'locked' ? 'text-muted-foreground' : ''}`}>
        {label}
      </p>
      {status === 'active' && (
        <span className="text-[9px] font-semibold text-primary uppercase tracking-wide mt-0.5">
          {lang === 'fr' ? 'En cours' : 'Active'}
        </span>
      )}
    </div>
  );
}

// ── Section D ─────────────────────────────────────────────────────────────────

function AdvancedTile({ trophy, isGlowing = false, lang, onClick }) {
  const isNew = trophy.isNew && trophy.unlocked;
  const label = lang === 'fr' ? trophy.labelFr : (trophy.labelEn || trophy.labelFr);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
      className={[
        'relative rounded-lg border p-2.5 flex items-start gap-2.5 text-left cursor-pointer transition-colors',
        trophy.unlocked
          ? 'border-amber-400/50 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-950/40'
          : 'border-border bg-muted/20 opacity-40 hover:opacity-60',
        isGlowing ? 'badge-glow' : '',
      ].join(' ')}
      title={label}
    >
      {isNew && (
        <span className="absolute -top-1.5 -right-1.5 text-[8px] font-bold bg-amber-400 text-black
                          rounded-full px-1 py-0.5 shadow-sm z-10">
          NEW
        </span>
      )}
      <span className="text-lg leading-none shrink-0">
        {trophy.unlocked
          ? trophy.emoji
          : <Lock className="w-4 h-4 text-muted-foreground" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium leading-tight truncate">{label}</p>
        {trophy.unlocked && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">
            {trophy.unlockedAt ? new Date(trophy.unlockedAt).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB') : ''}{trophy.isNew && ' · ✨'}
          </p>
        )}
      </div>
    </div>
  );
}

function CategoryAccordion({ categoryId, trophies, glowingIds, lang, onTrophyClick }) {
  const [open, setOpen] = useState(false);
  const unlocked = trophies.filter(t => t.unlocked).length;
  const total    = trophies.length;
  const hasNew   = trophies.some(t => t.isNew && t.unlocked);

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-accent/50 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm">
            {(lang === 'fr' ? CATEGORY_LABELS : CATEGORY_LABELS_EN)[categoryId] || categoryId}
          </span>
          {hasNew && (
            <span className="text-[9px] font-bold bg-amber-400 text-black rounded-full px-1.5 py-0.5">
              NEW
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-mono">
            {lang === 'fr'
              ? `${unlocked}/${total} débloqué${unlocked !== 1 ? 's' : ''}`
              : `${unlocked}/${total} unlocked`}
          </span>
          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-400 transition-all duration-500"
              style={{ width: `${total > 0 ? (unlocked / total) * 100 : 0}%` }}
            />
          </div>
          {open
            ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 border-t border-border">
          {trophies.map(t => <AdvancedTile key={t.id} trophy={t} isGlowing={glowingIds?.has(t.id)} lang={lang} onClick={() => onTrophyClick?.(t)} />)}
        </div>
      )}
    </div>
  );
}

// ── Section « Derniers trophées obtenus » ─────────────────────────────────────
// Copie des 5 trophées débloqués les plus récents (le plus récent à gauche). À chaque
// nouveau trophée, les autres se décalent vers la droite et le 6e sort de la liste.
function RecentTrophiesSection({ trophies, glowingIds, lang, onTrophyClick }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h2 className="font-semibold text-sm flex items-center gap-2">
        <Trophy className="w-4 h-4 text-amber-500" />
        {lang === 'fr' ? 'Derniers trophées obtenus' : 'Latest trophies unlocked'}
      </h2>
      {trophies.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          {lang === 'fr'
            ? 'Aucun trophée obtenu pour le moment — ils apparaîtront ici.'
            : 'No trophies unlocked yet — they will appear here.'}
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {trophies.map(t => {
            const label = lang === 'fr' ? t.labelFr : (t.labelEn || t.labelFr);
            return (
              <div
                key={t.id}
                role="button"
                tabIndex={0}
                onClick={() => onTrophyClick?.(t)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTrophyClick?.(t); } }}
                className={[
                  'relative rounded-lg border border-amber-400/50 bg-amber-50/50 dark:bg-amber-950/20',
                  'p-2.5 flex flex-col items-center gap-1 text-center cursor-pointer select-none',
                  'hover:bg-amber-100/60 dark:hover:bg-amber-950/40 transition-colors',
                  glowingIds?.has(t.id) ? 'badge-glow' : '',
                ].join(' ')}
                title={label}
              >
                <span className="text-2xl leading-none">{t.emoji}</span>
                <span className="text-[11px] font-medium leading-tight line-clamp-2">{label}</span>
                {t.unlockedAt && (
                  <span className="text-[9px] text-amber-600 dark:text-amber-400 font-mono">
                    {new Date(t.unlockedAt).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB')}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Bandeau dépliant du parcours tutoriel — même présentation que les catégories de
 * trophées. Replié par défaut une fois le tutoriel terminé : les missions ne
 * s'affichent plus d'office, l'utilisateur les retrouve en cliquant sur le bandeau.
 */
function TutorialAccordion({ tiles, completedQuests, totalQuests, glowingIds, lang, onTrophyClick }) {
  const allDone = totalQuests > 0 && completedQuests >= totalQuests;
  const [open, setOpen] = useState(!allDone);

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-accent/50 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm">
            {lang === 'fr' ? '🎓 Parcours tutoriel' : '🎓 Tutorial path'}
          </span>
          {allDone && <span className="text-sm">🏆</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-mono">
            {lang === 'fr'
              ? `${completedQuests}/${totalQuests} complétée${completedQuests !== 1 ? 's' : ''}`
              : `${completedQuests}/${totalQuests} completed`}
          </span>
          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-400 transition-all duration-500"
              style={{ width: `${totalQuests > 0 ? (completedQuests / totalQuests) * 100 : 0}%` }}
            />
          </div>
          {open
            ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="p-4 border-t border-border space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {tiles.map((tile, i) => {
              if (!tile.trophy) return null;
              return (
                <TutorialTile
                  key={tile.quest?.id || i}
                  trophy={tile.trophy}
                  quest={tile.quest}
                  status={tile.status}
                  isGlowing={glowingIds.has(tile.trophy.id)}
                  lang={lang}
                  onClick={() => onTrophyClick?.(tile.trophy, tile.quest)}
                />
              );
            })}
          </div>
          {allDone && (
            <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
              <span>🏆</span>
              <span>
                {lang === 'fr'
                  ? 'Parcours tutoriel complété ! Vous maîtrisez Fructificare.'
                  : 'Tutorial path completed! You have mastered Fructificare.'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export default function Trophees() {
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const [tick, setTick]                   = useState(0);
  const [healthOpen, setHealthOpen]       = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);
  const [objModalOpen, setObjModalOpen]   = useState(false);
  const [fireOpen, setFireOpen]           = useState(false);
  const [fireForm, setFireForm]           = useState({ monthly_need: '', withdrawal_rate: '' });
  const [editingObjective, setEditingObjective] = useState(null);
  // Fenêtre de détail d'un trophée (toutes sections) — { trophy, quest } | null
  const [trophyModal, setTrophyModal]     = useState(null);
  // Date de naissance (Bug B)
  const [birthdatePopupOpen, setBirthdatePopupOpen] = useState(false);
  const [birthdateInput, setBirthdateInput] = useState(() =>
    gamificationService.getState().profile?.birthDate || ''
  );
  const [birthdateSaved, setBirthdateSaved] = useState(false);

  // ── Glow de badge (Prompt 12) — IDs en surbrillance pendant 3s ─────────────
  const [glowingIds, setGlowingIds] = useState(() => new Set());

  // ── Indicateur de recalcul silencieux du score de santé ───────────────────
  const [healthScoreRefreshing, setHealthScoreRefreshing] = useState(false);

  // ── Recalcul du score + vérification de tous les trophées au montage ────────
  useEffect(() => {
    // Timer pour l'indicateur "lent" (> 500 ms)
    const slowTimer = setTimeout(() => setHealthScoreRefreshing(true), 500);
    try {
      healthScoreService.runHealthScoreUpdate();
    } catch (_) {}
    // Passe complète de trophées — synchronise l'état après une éventuelle mise à jour
    // de données effectuée dans une autre page.
    try {
      trophyService.checkAllTrophies();
    } catch (_) {}
    setTick(v => v + 1);
    clearTimeout(slowTimer);
    setHealthScoreRefreshing(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Abonnement au bus d'événements ─────────────────────────────────────────
  useEffect(() => {
    const u1 = gamificationService.onEvent('progressUpdated',     () => setTick(v => v + 1));
    const u3 = gamificationService.onEvent('questCompleted',     () => setTick(v => v + 1));
    const u4 = gamificationService.onEvent('objectiveCompleted', () => setTick(v => v + 1));

    // profileUpdated : synchroniser birthDate + recalculer tick si modifié depuis Settings
    const u5 = gamificationService.onEvent('profileUpdated', (profile) => {
      if (profile?.birthDate) {
        setBirthdateInput(profile.birthDate);
      }
      setTick(v => v + 1);
    });

    // trophyUnlocked : refresh + glow 3s
    const u2 = gamificationService.onEvent('trophyUnlocked', (data) => {
      setTick(v => v + 1);
      if (data?.id) {
        const id = data.id;
        setGlowingIds(prev => new Set([...prev, id]));
        setTimeout(() => {
          setGlowingIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }, 3000);
      }
    });

    // healthScoreUpdated : déclenché par healthScoreService.scheduleRefresh() après mutation des données
    const u6 = gamificationService.onEvent('healthScoreUpdated', () => setTick(v => v + 1));

    return () => { u1(); u2(); u3(); u4(); u5(); u6(); };
  }, []);

  // ── Tracking vues : page objectifs + crossover (crossoverPoint lu par le défi d'octobre)
  useEffect(() => {
    questService.trackViewOpened('objectivesPage');
    questService.trackViewOpened('crossoverPoint');
  }, []);

  // ── Date de naissance : sauvegarde inline ou via popup (Bug B) ─────────────
  const handleSaveBirthdate = useCallback((dateStr) => {
    if (!dateStr) return;
    gamificationService.patchState({
      profile: { birthDate: dateStr },
    });
    setBirthdateInput(dateStr);
    setBirthdatePopupOpen(false);
    setBirthdateSaved(true);
    setTimeout(() => setBirthdateSaved(false), 2000);
    // Relancer immédiatement le calcul du score
    try { healthScoreService.runHealthScoreUpdate(); } catch (_) {}
    setTick(v => v + 1);
  }, []);

  // ── Tracking Q10 : vue healthScore detail ────
  const handleOpenHealth = useCallback(() => {
    const hasBirthDate = !!gamificationService.getState().profile?.birthDate;
    if (!hasBirthDate) {
      // Pas de date de naissance → ouvrir la popup de saisie
      setBirthdatePopupOpen(true);
      return;
    }
    setHealthOpen(true);
    questService.trackViewOpened('healthScoreDetail');
  }, []);

  // ── Recalcul du score de santé ─────────────────────────────────────────────
  const handleRefreshHealth = useCallback(() => {
    setHealthLoading(true);
    try {
      healthScoreService.runHealthScoreUpdate();
      setTick(v => v + 1);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  // ── Suppression d'un objectif ─────────────────────────────────────────────
  const handleDeleteObjective = useCallback((id) => {
    objectiveService.deleteObjective(id);
    setTick(v => v + 1);
  }, []);

  // ── Données — recalculées uniquement quand `tick` change ──────────────────
  const data = useMemo(() => {
    const gState = gamificationService.getState();
    const capital = avatarService.getTotalCapital();
    const avatar  = avatarService.getAvatarForCapital(capital);

    // Santé
    const healthScore        = gState.healthScore?.current     ?? null;
    const healthHistory      = gState.healthScore?.history     ?? [];
    const healthBD           = gState.healthScore?.breakdown   ?? null;

    // FIRE — progression basée sur la valeur actuelle du portefeuille + paramètres globaux
    let fireData = null;
    try { fireData = dataService.computeFireProgress(); } catch (_) {}

    // Crossover Point
    let crossoverPct = null;
    const monthlyNetIncome = gState.profile?.monthlyNetIncome;
    try {
      const portfolios   = dataService.getPortfolios();
      const totalBalance = portfolios.reduce((s, p) => s + Math.max(0, p.balance || 0), 0);
      const globalYield  = dataService.computeGlobalYield();
      const annualReturn = (globalYield?.yieldPct > 0) ? globalYield.yieldPct / 100 : 0.05;
      const monthlyIncome = (totalBalance * annualReturn) / 12;
      if (monthlyNetIncome && monthlyNetIncome > 0) {
        crossoverPct = Math.min(100, Math.round((monthlyIncome / monthlyNetIncome) * 100));
      }
    } catch (_) {}

    // Objectifs avec progression
    const objectives = gState.objectives || [];
    const objectivesWithProgress = objectives.map(obj => ({
      obj,
      progress: objectiveService.getObjectiveProgress(obj),
    }));

    // Descriptions « comment l'obtenir » pour les badges dont le libellé est opaque :
    //   • badges utilisateur → objectif de la quête associée (badgeId)
    //   • missions mensuelles → description du défi (badgeId)
    // Source de vérité unique : on lit directement les catalogues quêtes/défis.
    const descByBadgeId = {};
    (questService.QUEST_CATALOG || []).forEach(q => {
      if (q.badgeId) descByBadgeId[q.badgeId] = { fr: q.objectiveFr, en: q.objectiveEn || q.objectiveFr };
    });
    (MONTHLY_CHALLENGE_CATALOG || []).forEach(c => {
      if (c.badgeId) descByBadgeId[c.badgeId] = { fr: c.descriptionFr, en: c.descriptionEn || c.descriptionFr };
    });

    // Trophées tutoriel (N quêtes → N tuiles, dynamique via QUEST_CATALOG.length)
    const questStateList   = questService.getQuestStateList();
    const trophiesWithMeta = trophyService.getTrophiesWithMeta().map(t => {
      const d = descByBadgeId[t.id];
      // On n'écrase pas une description déjà fournie par le catalogue de trophées.
      return (d && !t.descFr) ? { ...t, descFr: d.fr, descEn: d.en } : t;
    });
    const tutorialTrophies = trophiesWithMeta.filter(t => t.category === 'tutorial');
    const tutorialTilesData = questStateList.map((qs, i) => ({
      ...qs,
      trophy: tutorialTrophies[i] || null,
    }));
    // Table trophée→quête (pour enrichir la fenêtre de détail des trophées tutoriel).
    const questByTrophyId = {};
    tutorialTilesData.forEach(td => { if (td.trophy) questByTrophyId[td.trophy.id] = td.quest; });

    // 5 derniers trophées obtenus (le plus récent en premier) — toutes catégories.
    const recentTrophies = trophiesWithMeta
      .filter(t => t.unlocked && t.unlockedAt)
      .sort((a, b) => new Date(b.unlockedAt) - new Date(a.unlockedAt))
      .slice(0, 5);

    // Trophées avancés groupés
    const advancedTrophies = trophiesWithMeta.filter(t => t.category !== 'tutorial');
    const byCategory = {};
    CATEGORY_ORDER.forEach(cat => { byCategory[cat] = []; });
    advancedTrophies.forEach(t => {
      const cat = t.category || 'objective';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(t);
    });

    // Barre de progression trophées avancés (section A)
    const advancedUnlocked = advancedTrophies.filter(t => t.unlocked).length;
    const advancedTotal    = advancedTrophies.length;

    return {
      capital, avatar,
      healthScore, healthHistory, healthBD,
      fireData,
      crossoverPct, monthlyNetIncome,
      objectivesWithProgress,
      tutorialTilesData,
      byCategory,
      advancedUnlocked, advancedTotal,
      recentTrophies, questByTrophyId,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  // ── Données santé pour Dialog (lazy) ─────────────────────────────────────
  const healthDialogData = useMemo(() => {
    if (!healthOpen) return null;
    const gState = gamificationService.getState();
    return {
      score:     gState.healthScore?.current   ?? null,
      breakdown: gState.healthScore?.breakdown ?? null,
      history:   gState.healthScore?.history   ?? [],
      inputs:    gState.healthScore?.inputs    ?? null,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [healthOpen, tick]);

  // Couleur barre santé
  function healthColor(score) {
    if (score === null) return '#9CA3AF';
    if (score >= 85)    return '#10B981';
    if (score >= 75)    return '#22C55E';
    if (score >= 60)    return '#84CC16';
    if (score >= 41)    return '#F97316';
    return '#EF4444';
  }

  const {
    capital, avatar, healthScore, healthHistory, healthBD,
    fireData, crossoverPct, monthlyNetIncome,
    objectivesWithProgress, tutorialTilesData, byCategory,
    advancedUnlocked, advancedTotal,
    recentTrophies, questByTrophyId,
  } = data;

  // Ouvre la fenêtre de détail d'un trophée (quête associée si trophée tutoriel).
  const openTrophyModal = useCallback((trophy, quest = null) => {
    if (!trophy) return;
    setTrophyModal({ trophy, quest: quest || questByTrophyId[trophy.id] || null });
  }, [questByTrophyId]);

  const totalQuests      = questService.QUEST_CATALOG.length;
  const completedQuests  = tutorialTilesData.filter(t => t.status === 'completed').length;
  const gState           = gamificationService.getState();
  const objectivesCount  = (gState.objectives || []).length;
  const canAddObjective  = objectivesCount < objectiveService.MAX_OBJECTIVES;

  return (
    <div className="space-y-8 pb-10">

      {/* ── Titre ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Trophy className="w-6 h-6 text-amber-500" />
        <h1 className="text-2xl font-bold">
          {lang === 'fr' ? 'Trophées & Progression' : 'Trophies & Progress'}
        </h1>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION A — Avatar & capital total
      ═══════════════════════════════════════════════════════════════════════ */}
      <AvatarHeader avatar={avatar} capital={capital} lang={lang} />

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION B — Deux colonnes : métriques + objectifs
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── B-gauche : métriques ──────────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-5">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <Heart className="w-4 h-4 text-rose-500" />
            {lang === 'fr' ? 'Tableau de bord financier' : 'Financial dashboard'}
          </h2>

          {/* Score de santé */}
          <div>
            <MetricBar
              label={
                <span className="flex items-center gap-1.5">
                  {lang === 'fr' ? 'Score de santé' : 'Health score'}
                  {healthScoreRefreshing
                    ? <span className="text-[10px] text-muted-foreground animate-pulse font-normal">
                        {lang === 'fr' ? '(calcul…)' : '(computing…)'}
                      </span>
                    : <span className="text-[10px] text-primary font-normal">
                        {lang === 'fr' ? '(cliquer pour détails)' : '(click for details)'}
                      </span>
                  }
                </span>
              }
              value={healthScore}
              max={100}
              colorFill={healthColor(healthScore)}
              colorLabel={healthColor(healthScore)}
              clickable
              onClick={handleOpenHealth}
            />
            {healthScore === null && (
              <div className="mt-2 ml-0.5">
                <p className="text-[10px] text-muted-foreground mb-1">
                  {lang === 'fr'
                    ? 'Date de naissance (requise pour personnaliser le score)'
                    : 'Date of birth (required to personalise the score)'}
                </p>
                <div className="flex items-center gap-2 max-w-[300px]">
                  <Input
                    type="date"
                    value={birthdateInput}
                    onChange={e => setBirthdateInput(e.target.value)}
                    max={new Date(Date.now() - 18 * 365.25 * 24 * 3600 * 1000).toISOString().split('T')[0]}
                    min={new Date(Date.now() - 90 * 365.25 * 24 * 3600 * 1000).toISOString().split('T')[0]}
                    className="h-7 text-xs"
                  />
                  <Button
                    size="sm"
                    variant={birthdateSaved ? "default" : "outline"}
                    className={`h-7 px-2 text-xs shrink-0 ${birthdateSaved ? 'bg-emerald-600 hover:bg-emerald-600 text-white' : ''}`}
                    onClick={() => handleSaveBirthdate(birthdateInput)}
                    disabled={!birthdateInput}
                  >
                    {birthdateSaved ? <Check className="w-3.5 h-3.5" /> : (lang === 'fr' ? 'Calculer' : 'Calculate')}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
                  {lang === 'fr'
                    ? "Votre âge influence la composante de résilience du score — un investisseur jeune peut se permettre plus de volatilité car son horizon est plus long."
                    : "Your age influences the resilience component of the score — a young investor can tolerate more volatility because their horizon is longer."}
                </p>
              </div>
            )}
            {/* Afficher le champ de modification si birthDate déjà renseignée */}
            {healthScore !== null && !gamificationService.getState().profile?.birthDate && (
              <div className="flex items-center gap-2 mt-1.5 max-w-[300px]">
                <Input
                  type="date"
                  value={birthdateInput}
                  onChange={e => setBirthdateInput(e.target.value)}
                  className="h-6 text-[10px]"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5 text-[10px] shrink-0"
                  onClick={() => handleSaveBirthdate(birthdateInput)}
                  disabled={!birthdateInput}
                >
                  {lang === 'fr' ? 'Maj' : 'Upd'}
                </Button>
              </div>
            )}
          </div>

          {/* FIRE — cliquable : détail du calcul + paramètres partagés */}
          <button
            type="button"
            className="w-full text-left rounded-lg -mx-1 px-1 py-0.5 hover:bg-accent/40 transition-colors cursor-pointer"
            onClick={() => {
              setFireForm({
                monthly_need:    String(fireData?.monthly_need ?? 2500),
                withdrawal_rate: String(fireData?.withdrawal_rate ?? 4),
              });
              setFireOpen(true);
            }}
            data-testid="fire-progress-btn"
            title={lang === 'fr' ? 'Voir le détail et modifier les paramètres FIRE' : 'View details and edit FIRE parameters'}
          >
            <MetricBar
              label={
                <span className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-orange-500" />
                  {lang === 'fr' ? 'Progression FIRE' : 'FIRE progress'}
                  <Settings2 className="w-3 h-3 text-muted-foreground ml-0.5" />
                </span>
              }
              value={fireData && fireData.capitalNecessaire > 0 ? Math.round(fireData.fireProgress) : null}
              max={100}
              colorFill="#F97316"
              colorLabel="#F97316"
            />
          </button>

          {/* Modale FIRE — détail du calcul + paramètres (partagés avec le simulateur) */}
          <Dialog open={fireOpen} onOpenChange={setFireOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  {lang === 'fr' ? 'Calcul & paramètres FIRE' : 'FIRE calculation & settings'}
                </DialogTitle>
              </DialogHeader>
              {(() => {
                const fmtEur = (v) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);
                const mn = parseFloat(String(fireForm.monthly_need).replace(',', '.')) || 0;
                const wr = parseFloat(String(fireForm.withdrawal_rate).replace(',', '.')) || 0;
                const capitalNecessaire = wr > 0 ? (mn * 12) / (wr / 100) : 0;
                const capitalActuel     = fireData?.capitalActuel ?? 0;
                const progression       = capitalNecessaire > 0 ? Math.min(100, (capitalActuel / capitalNecessaire) * 100) : 0;
                return (
                  <div className="space-y-4">
                    {/* a) Détail du calcul */}
                    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">{lang === 'fr' ? 'Capital nécessaire' : 'Capital needed'}</span>
                        <span className="font-semibold tabular-nums">{fmtEur(capitalNecessaire)}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground -mt-1">= ({lang === 'fr' ? 'besoins mensuels' : 'monthly needs'} × 12) / {lang === 'fr' ? 'taux de retrait' : 'withdrawal rate'}</p>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">{lang === 'fr' ? 'Capital actuel' : 'Current capital'}</span>
                        <span className="font-semibold tabular-nums">{fmtEur(capitalActuel)}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground -mt-1">{lang === 'fr' ? 'valeur actuelle du portefeuille (toutes les enveloppes, livrets inclus)' : 'current portfolio value (all envelopes, incl. regulated savings)'}</p>
                      <div className="flex justify-between gap-3 border-t border-border/60 pt-1.5 mt-1">
                        <span className="font-medium">{lang === 'fr' ? 'Progression FIRE' : 'FIRE progress'}</span>
                        <span className="font-bold tabular-nums text-orange-600">{progression.toFixed(1)} %</span>
                      </div>
                    </div>
                    {/* b) Paramètres éditables (source unique, partagée avec le simulateur) */}
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium">{lang === 'fr' ? 'Besoins mensuels (€)' : 'Monthly needs (€)'}</label>
                        <Input value={fireForm.monthly_need} onChange={e => setFireForm({ ...fireForm, monthly_need: e.target.value })} inputMode="decimal" className="mt-1" data-testid="fire-monthly-need" />
                      </div>
                      <div>
                        <label className="text-xs font-medium">{lang === 'fr' ? 'Taux de retrait sûr (%)' : 'Safe withdrawal rate (%)'}</label>
                        <Input value={fireForm.withdrawal_rate} onChange={e => setFireForm({ ...fireForm, withdrawal_rate: e.target.value })} inputMode="decimal" className="mt-1" data-testid="fire-withdrawal-rate" />
                      </div>
                    </div>
                    {/* c) Actions */}
                    <div className="flex justify-end gap-2 pt-1">
                      <Button variant="secondary" onClick={() => setFireOpen(false)}>{lang === 'fr' ? 'Annuler' : 'Cancel'}</Button>
                      <Button
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                        onClick={() => {
                          dataService.updateFireSettings({ monthly_need: mn, withdrawal_rate: wr });
                          setFireOpen(false);
                          setTick(v => v + 1);
                        }}
                        data-testid="fire-save-btn"
                      >
                        {lang === 'fr' ? 'Enregistrer' : 'Save'}
                      </Button>
                    </div>
                    <Disclaimer className="mt-2" />
                  </div>
                );
              })()}
            </DialogContent>
          </Dialog>

          {/* Crossover */}
          <div>
            <MetricBar
              label={
                <span className="flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-violet-500" />
                  {'Crossover Point'}
                </span>
              }
              value={crossoverPct}
              max={100}
              colorFill="#8B5CF6"
              colorLabel="#8B5CF6"
            />
            {crossoverPct !== null ? (
              <p className="text-[10px] text-muted-foreground mt-1 ml-0.5">
                {lang === 'fr'
                  ? `Vos investissements couvrent ${crossoverPct} % de vos revenus mensuels.`
                  : `Your investments cover ${crossoverPct} % of your monthly income.`}
              </p>
            ) : !monthlyNetIncome ? (
              <p className="text-[10px] text-muted-foreground mt-1 ml-0.5">
                {lang === 'fr' ? (
                  <>
                    <button
                      className="underline text-primary/70 hover:text-primary"
                      onClick={() => navigate('/settings')}
                    >
                      Renseignez votre revenu mensuel dans les Paramètres
                    </button>
                    {' '}pour activer le Crossover Point.
                  </>
                ) : (
                  <>
                    <button
                      className="underline text-primary/70 hover:text-primary"
                      onClick={() => navigate('/settings')}
                    >
                      Enter your monthly income in Settings
                    </button>
                    {' '}to enable the Crossover Point.
                  </>
                )}
              </p>
            ) : null}
          </div>
        </div>

        {/* ── B-droite : objectifs personnels ──────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-500" />
              {lang === 'fr' ? 'Mes objectifs' : 'My goals'}
              {objectivesCount > 0 && (
                <span className="text-xs text-muted-foreground font-normal">
                  ({objectivesCount}/{objectiveService.MAX_OBJECTIVES})
                </span>
              )}
            </h2>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 gap-1"
              onClick={() => { setEditingObjective(null); setObjModalOpen(true); }}
              disabled={!canAddObjective}
              title={!canAddObjective
                ? (lang === 'fr'
                    ? `Maximum ${objectiveService.MAX_OBJECTIVES} objectifs atteint`
                    : `Maximum ${objectiveService.MAX_OBJECTIVES} goals reached`)
                : ''}
            >
              <Plus className="w-3.5 h-3.5" />
              {lang === 'fr' ? 'Ajouter' : 'Add'}
            </Button>
          </div>

          {objectivesWithProgress.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm space-y-2">
              <Target className="w-8 h-8 mx-auto opacity-40" />
              <p>{lang === 'fr' ? 'Aucun objectif défini.' : 'No goals defined.'}</p>
              <p className="text-xs opacity-70">
                {lang === 'fr' ? (
                  <>Ajoutez un objectif (achat immobilier, épargne retraite…)<br />pour suivre votre progression.</>
                ) : (
                  <>Add a goal (property purchase, retirement savings…)<br />to track your progress.</>
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {objectivesWithProgress.map(({ obj, progress }) => (
                <ObjectiveCard
                  key={obj.id}
                  objective={obj}
                  progress={progress}
                  onEdit={() => {
                    setEditingObjective(obj);
                    setObjModalOpen(true);
                  }}
                  onDelete={() => handleDeleteObjective(obj.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION C — Parcours tutoriel (bandeau dépliant, comme les catégories)
      ═══════════════════════════════════════════════════════════════════════ */}
      <TutorialAccordion
        tiles={tutorialTilesData}
        completedQuests={completedQuests}
        totalQuests={totalQuests}
        glowingIds={glowingIds}
        lang={lang}
        onTrophyClick={openTrophyModal}
      />

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION C-bis — Derniers trophées obtenus (copie des 5 plus récents)
      ═══════════════════════════════════════════════════════════════════════ */}
      <RecentTrophiesSection
        trophies={recentTrophies}
        glowingIds={glowingIds}
        lang={lang}
        onTrophyClick={openTrophyModal}
      />

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION D — Trophées avancés par catégorie
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-3">
        {/* En-tête avec barre de progression (Prompt 8A) */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-semibold text-base">
            {lang === 'fr' ? '🏅 Trophées avancés' : '🏅 Advanced trophies'}
          </h2>
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-muted-foreground font-mono">
              {(() => {
                const pct = advancedTotal > 0
                  ? Math.round((advancedUnlocked / advancedTotal) * 1000) / 10
                  : 0;
                const allDone = advancedTotal > 0 && advancedUnlocked >= advancedTotal;
                return (
                  <>
                    {advancedUnlocked}&nbsp;/&nbsp;{advancedTotal}&nbsp;—&nbsp;{pct.toLocaleString('fr-FR')}&nbsp;%
                    {allDone && ' 🏆'}
                  </>
                );
              })()}
            </span>
            <div className="w-28 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-400 transition-all duration-500"
                style={{ width: `${advancedTotal > 0 ? (advancedUnlocked / advancedTotal) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          {CATEGORY_ORDER.map(cat => {
            const trophies = byCategory[cat] || [];
            if (trophies.length === 0) return null;
            return (
              <CategoryAccordion key={cat} categoryId={cat} trophies={trophies} glowingIds={glowingIds} lang={lang} onTrophyClick={openTrophyModal} />
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          DIALOG — Score de santé détail (lazy mount)
      ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={healthOpen} onOpenChange={setHealthOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-500" />
              {lang === 'fr' ? 'Score de santé financière' : 'Financial health score'}
            </DialogTitle>
          </DialogHeader>
          {healthDialogData && (
            <HealthScoreDisplay
              score={healthDialogData.score}
              breakdown={healthDialogData.breakdown}
              history={healthDialogData.history}
              inputs={healthDialogData.inputs}
              onRefresh={handleRefreshHealth}
              loading={healthLoading}
              lang={lang}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL — Créer / Modifier un objectif
      ═══════════════════════════════════════════════════════════════════════ */}
      <ObjectiveModal
        open={objModalOpen}
        objective={editingObjective}
        onClose={() => { setObjModalOpen(false); setEditingObjective(null); }}
        onSaved={() => setTick(v => v + 1)}
      />

      {/* ── Popup date de naissance (Bug B) ───────────────────────────────── */}
      <BirthdatePopup
        open={birthdatePopupOpen}
        onClose={() => setBirthdatePopupOpen(false)}
        onSave={handleSaveBirthdate}
      />

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL — Détail d'un trophée (description + comment l'obtenir)
      ═══════════════════════════════════════════════════════════════════════ */}
      {trophyModal && (
        <TrophyDetailModal
          trophy={trophyModal.trophy}
          quest={trophyModal.quest}
          lang={lang}
          onClose={() => setTrophyModal(null)}
        />
      )}

      <Disclaimer />
    </div>
  );
}

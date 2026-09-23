// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * QuestProgress.jsx
 *
 * Progress widget for the tutorial quests (Q1-Q10).
 * Shown on the Dashboard and on the Trophies page.
 *
 * Props:
 *   compact {boolean} — compact mode (a single line, no list)
 *                       default: false (full widget)
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { CheckCircle2, Lock, MapPin, ChevronRight, HelpCircle } from "lucide-react";
import gamificationService from "../../services/gamificationService";
import questService        from "../../services/questService";
import { useLanguage }     from "../../context/LanguageContext";

// ─── Status icon ─────────────────────────────────────────────────────────────

function QuestIcon({ status }) {
  if (status === 'completed')
    return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
  if (status === 'active')
    return <MapPin className="w-4 h-4 text-primary shrink-0 animate-pulse" />;
  return <Lock className="w-4 h-4 text-muted-foreground/40 shrink-0" />;
}

// ─── How-To Modal ─────────────────────────────────────────────────────────────

function HowToModal({ quest, open, onClose }) {
  const { lang } = useLanguage();
  if (!quest) return null;
  const title    = lang === 'fr' ? quest.titleFr     : (quest.titleEn     || quest.titleFr);
  const obj      = lang === 'fr' ? quest.objectiveFr : (quest.objectiveEn || quest.objectiveFr);
  const steps    = lang === 'fr' ? (quest.howToFr || []) : (quest.howToEn || quest.howToFr || []);
  const badge    = quest.badgeFr; // badge names stay in FR (proper nouns)
  const howLabel = lang === 'fr' ? 'Comment compléter' : 'How to complete';
  const rewLabel = lang === 'fr' ? 'Récompense' : 'Reward';
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="text-xl">{quest.idx <= 5 ? '📖' : '🎯'}</span>
            <DialogTitle className="font-heading">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground pt-1">
            {obj}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {howLabel}
          </p>
          <ol className="space-y-2">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="flex-none w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold mt-0.5">
                  {i + 1}
                </span>
                <span className="text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
            <strong>{rewLabel} :</strong> badge « {badge} »
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function QuestProgress({ compact = false }) {
  const { lang } = useLanguage();
  // Force re-render on quest events
  const [, setTick] = useState(0);
  const [modalQuest, setModalQuest] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const bump = () => setTick(v => v + 1);
    const unsub1 = gamificationService.onEvent('questCompleted', bump);
    const unsub2 = gamificationService.onEvent('progressUpdated', bump);
    return () => { unsub1(); unsub2(); };
  }, []);

  const { quest, idx, completedCount, allDone } = questService.getCurrentQuestState();
  const questList = questService.getQuestStateList();
  const totalQuests = questService.QUEST_CATALOG.length;

  const qTitle    = (q) => q ? (lang === 'fr' ? q.titleFr     : (q.titleEn     || q.titleFr))     : '';
  const qObjective= (q) => q ? (lang === 'fr' ? q.objectiveFr : (q.objectiveEn || q.objectiveFr)) : '';

  // ── Compact mode ──────────────────────────────────────────────────────────
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        {allDone ? (
          <>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-muted-foreground">
              {lang === 'fr' ? 'Toutes les quêtes complétées' : 'All quests completed'}
            </span>
          </>
        ) : (
          <>
            <MapPin className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground truncate">
              Q{idx} : {qTitle(quest)}
            </span>
            <Badge variant="secondary" className="ml-auto shrink-0 text-xs">
              {completedCount}/{totalQuests}
            </Badge>
          </>
        )}
      </div>
    );
  }

  // ── Full widget ────────────────────────────────────────────────────────────
  return (
    <>
      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-heading text-sm flex items-center gap-2">
                <span>🎓</span>
                {lang === 'fr' ? 'Tutoriel' : 'Tutorial'}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5 pl-[1.375rem]">
                {lang === 'fr' ? 'Progression du tutoriel' : 'Tutorial progress'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={allDone ? 'default' : 'secondary'}
                className={allDone ? 'bg-emerald-500 text-white' : ''}
              >
                {completedCount}/{totalQuests}
              </Badge>
              <button
                onClick={() => setExpanded(e => !e)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                {expanded ? (lang === 'fr' ? 'Réduire' : 'Collapse') : (lang === 'fr' ? 'Tout voir' : 'See all')}
                <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
              </button>
            </div>
          </div>

          {/* Barre de progression globale */}
          <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${(completedCount / totalQuests) * 100}%` }}
            />
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-2">
          {allDone ? (
            /* Toutes les quêtes complétées */
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  {lang === 'fr' ? 'Toutes les quêtes complétées !' : 'All quests completed!'}
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  {lang === 'fr' ? 'Vous maîtrisez Fructificare. Continuez à explorer !' : 'You have mastered Fructificare. Keep exploring!'}
                </p>
              </div>
            </div>
          ) : (
            /* Quête active */
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5 animate-pulse" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight">{qTitle(quest)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {qObjective(quest)}
                    </p>
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs flex items-center gap-1 text-primary hover:text-primary"
                onClick={() => setModalQuest(quest)}
              >
                <HelpCircle className="w-3 h-3" />
                {lang === 'fr' ? 'Comment compléter ?' : 'How to complete?'}
              </Button>
            </div>
          )}

          {/* Liste complète (dépliée) */}
          {expanded && (
            <div className="space-y-0.5 pt-1">
              {questList.map(({ quest: q, status, completedAt }) => (
                <div
                  key={q.id}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors
                    ${status === 'active'    ? 'bg-primary/8 border border-primary/20' : ''}
                    ${status === 'completed' ? 'opacity-60' : ''}
                    ${status === 'locked'    ? 'opacity-35' : ''}
                  `}
                >
                  <QuestIcon status={status} />
                  {/* Titre de la quête */}
                  <span className={`flex-1 min-w-0 truncate font-medium ${status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                    {q.id} — {qTitle(q)}
                  </span>
                  {/* Date de complétion (quête complétée) */}
                  {status === 'completed' && completedAt && (
                    <span className="text-[10px] text-muted-foreground/70 shrink-0 font-mono">
                      {new Date(completedAt).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB')}
                    </span>
                  )}
                  {/* Bouton aide (quête active) */}
                  {status === 'active' && (
                    <button
                      className="text-[10px] text-primary/80 shrink-0 hover:underline mr-1"
                      onClick={() => setModalQuest(q)}
                    >
                      {lang === 'fr' ? 'Aide' : 'Help'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal "Comment compléter" */}
      <HowToModal
        quest={modalQuest}
        open={!!modalQuest}
        onClose={() => setModalQuest(null)}
      />
    </>
  );
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * MonthlyChallengeWidget.jsx — The dashboard's monthly mission
 *
 * Shows:
 *   • the title and the VERBATIM text of the current month's mission
 *   • completion status (✓ or in progress) + days left
 *   • the trophy earned once the mission is completed
 *   • a "Start" button leading to the relevant section
 *   • for August's mission: a self-declaration checkbox
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Checkbox } from "../ui/checkbox";
import { CheckCircle2, Circle, Calendar, Zap, Trophy, ChevronRight } from "lucide-react";
import gamificationService from "../../services/gamificationService";
import challengeService    from "../../services/challengeService";
import { useLanguage }     from "../../context/LanguageContext";

const MONTH_NAMES_FR = [
  '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];
const MONTH_NAMES_EN = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function MonthlyChallengeWidget() {
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const [, setTick] = useState(0);

  // Re-render sur les événements de mission / progression / trophée
  useEffect(() => {
    const bump = () => setTick(v => v + 1);
    const u1 = gamificationService.onEvent('challengeCompleted', bump);
    const u2 = gamificationService.onEvent('progressUpdated',    bump);
    const u3 = gamificationService.onEvent('trophyUnlocked',     bump);
    return () => { u1(); u2(); u3(); };
  }, []);

  const challenge     = challengeService.getCurrentChallenge();
  const daysRemaining = challengeService.getDaysRemainingInMonth();
  if (!challenge) return null;

  const monthNum  = new Date().getMonth() + 1;
  const monthName = lang === 'fr' ? (MONTH_NAMES_FR[monthNum] || '') : (MONTH_NAMES_EN[monthNum] || '');
  const { isCompleted, completedAt } = challenge;

  const title = lang === 'fr' ? challenge.titleFr       : (challenge.titleEn       || challenge.titleFr);
  const desc  = lang === 'fr' ? challenge.descriptionFr : (challenge.descriptionEn || challenge.descriptionFr);

  const handleSelfDeclare = (checked) => {
    if (!checked) return;
    challengeService.markVisit('m8SelfDeclared');
    setTick(v => v + 1);
  };

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading text-sm flex items-center gap-2">
            <span>🏅</span>
            {lang === 'fr' ? `Mission de ${monthName}` : `${monthName} mission`}
          </CardTitle>
          <div className="flex items-center gap-2">
            {isCompleted ? (
              <Badge className="bg-emerald-500 text-white">{lang === 'fr' ? 'Complété ✓' : 'Completed ✓'}</Badge>
            ) : (
              <Badge variant="secondary">{lang === 'fr' ? 'En cours' : 'In progress'}</Badge>
            )}
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              J-{daysRemaining}
            </span>
          </div>
        </div>

        {/* Barre de progression */}
        <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2">
          <div className={`h-full rounded-full transition-all duration-500 ${isCompleted ? 'bg-emerald-500 w-full' : 'bg-amber-400 w-0'}`} />
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {isCompleted ? (
          <div className="flex items-start gap-3 p-3 rounded-lg border border-emerald-400/50 bg-emerald-50/50 dark:bg-emerald-950/20">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{title}</p>
              {completedAt && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lang === 'fr' ? 'Complété le ' : 'Completed on '}
                  {new Date(completedAt).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long' })}
                </p>
              )}
              <div className="flex items-center gap-1.5 mt-2">
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-medium text-amber-600">
                  {lang === 'fr'
                    ? `Trophée « ${challenge.badgeLabel} » obtenu`
                    : `Trophy "${challenge.badgeLabel}" earned`}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-lg border border-border bg-card space-y-3">
            <div className="flex items-start gap-3">
              <Circle className="w-4 h-4 text-muted-foreground/50 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm font-semibold leading-tight">{title}</p>
                {/* Texte affiché VERBATIM */}
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            </div>

            {/* Mission 8 (août) — auto-déclaration */}
            {challenge.requiresCheckbox && (
              <label className="flex items-start gap-2 pl-7 cursor-pointer text-xs text-foreground">
                <Checkbox className="mt-0.5" onCheckedChange={handleSelfDeclare} data-testid="mission-self-declare" />
                <span>
                  {lang === 'fr'
                    ? "Je confirme avoir consulté mon avis d'imposition et ajusté mon taux de prélèvement à la source si nécessaire."
                    : 'I confirm I have reviewed my tax assessment and adjusted my withholding tax rate if needed.'}
                </span>
              </label>
            )}

            {challenge.navigateTo && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs ml-7"
                onClick={() => navigate(challenge.navigateTo)}
              >
                {lang === 'fr' ? 'Commencer' : 'Start'}
                <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            )}
          </div>
        )}

        {/* Rappel de la récompense */}
        {!isCompleted && (
          <div className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
            <Zap className="w-3 h-3 text-amber-400" />
            <span>
              {lang === 'fr'
                ? <>Cette mission rapporte un <strong>trophée permanent</strong></>
                : <>This mission earns a <strong>permanent trophy</strong></>}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

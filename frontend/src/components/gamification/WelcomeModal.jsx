// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * WelcomeModal.jsx — Welcome window, shown ONCE on the first launch, just before the
 * tutorial's first mission.
 *
 * Welcomes the user and announces the getting-started tutorial. The "Continue" button
 * closes the window and lets the first mission appear.
 *
 * Props:
 *   open       {boolean}
 *   onContinue {() => void}   — called when "Continue" is clicked (closes + marks as seen)
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Sparkles, MapPin, ArrowRight } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

export default function WelcomeModal({ open, onContinue }) {
  const { lang } = useLanguage();
  const isFr = lang === "fr";

  const steps = isFr
    ? [
        "Créez votre première enveloppe (PEA, assurance-vie, CTO…).",
        "Enregistrez vos versements et suivez vos rendements réels.",
        "Explorez les simulations, la fiscalité et votre score de santé.",
      ]
    : [
        "Create your first envelope (PEA, life insurance, brokerage…).",
        "Record your contributions and track your real returns.",
        "Explore simulations, taxation and your health score.",
      ];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onContinue(); }}>
      <DialogContent className="max-w-md" data-testid="welcome-modal">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary">
              <Sparkles className="w-5 h-5" />
            </span>
            <DialogTitle className="font-heading text-xl">
              {isFr ? "Bienvenue sur Fructificare !" : "Welcome to Fructificare!"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground pt-2 leading-relaxed">
            {isFr
              ? "Fructificare vous aide à piloter votre épargne et vos investissements, en toute confidentialité. Pour prendre le programme en main rapidement, suivez le petit tutoriel : quelques étapes guidées pour découvrir l'essentiel."
              : "Fructificare helps you manage your savings and investments, privately. To get started quickly, follow the short tutorial: a few guided steps to discover the essentials."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {isFr ? "Ce que vous allez découvrir" : "What you'll discover"}
          </p>
          <ol className="space-y-2">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <span className="flex-none w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold mt-0.5">
                  {i + 1}
                </span>
                <span className="text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-muted-foreground">
          <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
          {isFr
            ? "Votre première mission vous attend juste après."
            : "Your first mission is waiting right after."}
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={onContinue} className="gap-1.5" data-testid="welcome-continue">
            {isFr ? "Continuer" : "Continue"}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

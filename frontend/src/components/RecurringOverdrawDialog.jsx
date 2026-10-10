// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import { useLanguage } from "../context/LanguageContext";
import dataService from "../services/dataService";
import gamificationService from "../services/gamificationService";

const fmt = (v) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v || 0);
const fmtDate = (iso, lang) => new Date(`${iso}T12:00:00`).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR");

// Laisser le démarrage (chargement, rattrapage des récurrents) se terminer.
const DELAI_PREMIERE_LECTURE_MS = 4000;

/**
 * RecurringOverdrawDialog — un retrait récurrent dépasse ce que contient son enveloppe.
 *
 * La série est alors mise en attente à cette échéance (voir syncRegularMovements) : rien
 * n'est enregistré tant que l'utilisateur n'a pas choisi de la poursuivre ou de l'arrêter.
 * « Plus tard » la laisse en attente ; la question revient au prochain démarrage.
 */
export default function RecurringOverdrawDialog({ onChange }) {
  const { lang } = useLanguage();
  const L = (fr, en) => (lang === "en" ? en : fr);
  const [attente, setAttente] = useState(null);
  const [reportes, setReportes] = useState(() => new Set());

  const lire = useCallback(() => {
    try {
      const liste = dataService.getRecurringOverdraws();
      setAttente(liste.find((a) => !reportes.has(a.id)) || null);
    } catch (_) { setAttente(null); }
  }, [reportes]);

  useEffect(() => {
    const minuterie = setTimeout(lire, DELAI_PREMIERE_LECTURE_MS);
    const arreter = gamificationService.onEvent("recurringMovementsUpdated", () => setTimeout(lire, 0));
    return () => { clearTimeout(minuterie); if (typeof arreter === "function") arreter(); };
  }, [lire]);

  if (!attente) return null;
  const nom = attente.note || L("Retrait récurrent", "Recurring withdrawal");

  const poursuivre = () => {
    dataService.confirmRecurringOverdraw(attente.id);
    toast.success(L("Le mouvement récurrent continue de s'appliquer.", "The recurring movement keeps being applied."));
    setAttente(null);
    onChange?.();
  };
  const arreter = () => {
    dataService.stopRegularMovement(attente.id);
    toast.success(L("Mouvement récurrent arrêté. Les retraits déjà enregistrés sont conservés.", "Recurring movement stopped. The withdrawals already recorded are kept."));
    setAttente(null);
    onChange?.();
  };
  const reporter = () => {
    setReportes((prev) => new Set(prev).add(attente.id));
    setAttente(null);
  };

  return (
    <AlertDialog open onOpenChange={(o) => { if (!o) reporter(); }}>
      <AlertDialogContent data-testid="recurring-overdraw-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>{L("Un retrait récurrent dépasse le contenu de l'enveloppe", "A recurring withdrawal exceeds what the envelope holds")}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line">
            {L(
              `« ${nom} » devait retirer ${fmt(attente.amount)} de l'enveloppe « ${attente.portfolio} » le ${fmtDate(attente.date, lang)}, alors qu'elle ne contient que ${fmt(attente.disponible)} d'après vos mouvements et votre dernière calibration.\n\nCe retrait n'a pas été enregistré, ni les suivants. Voulez-vous continuer à appliquer ce mouvement récurrent ?`,
              `"${nom}" was due to withdraw ${fmt(attente.amount)} from the envelope "${attente.portfolio}" on ${fmtDate(attente.date, lang)}, while it only holds ${fmt(attente.disponible)} according to your movements and your last calibration.\n\nThis withdrawal has not been recorded, nor the following ones. Do you want to keep applying this recurring movement?`,
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel onClick={reporter} data-testid="overdraw-later">{L("Plus tard", "Later")}</AlertDialogCancel>
          <Button variant="outline" onClick={arreter} data-testid="overdraw-stop">{L("Arrêter ce mouvement", "Stop this movement")}</Button>
          <AlertDialogAction onClick={poursuivre} data-testid="overdraw-continue">{L("Continuer à l'appliquer", "Keep applying it")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

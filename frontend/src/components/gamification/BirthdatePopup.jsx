// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * BirthdatePopup.jsx
 *
 * Dialog shown when the user asks for their financial health score for the first time and
 * the date of birth has not been filled in yet.
 *
 * Explains why age is needed (the "resilience" component of the formula) and offers to
 * enter it directly. A link to the Settings lets the user come back to it later if they
 * prefer to close without answering.
 *
 * Props:
 *   open          {boolean}        — controls display
 *   onClose       {() => void}     — closes without saving
 *   onSave        {(date: string) => void} — called with the ISO date (YYYY-MM-DD)
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Calendar, Info, ExternalLink, X } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

export default function BirthdatePopup({ open, onClose, onSave }) {
  const navigate  = useNavigate();
  const { lang } = useLanguage();
  const L = (fr, en) => (lang === 'en' ? en : fr);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  if (!open) return null;

  // ── validation ────────────────────────────────────────────────────────────
  const validate = (dateStr) => {
    if (!dateStr) return L("Veuillez saisir votre date de naissance.", "Please enter your date of birth.");
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return L("Date invalide.", "Invalid date.");
    const age = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (age < 0)   return L("La date est dans le futur.", "The date is in the future.");
    if (age > 120) return L("Date peu vraisemblable.", "Unlikely date.");
    return "";
  };

  // ── handlers ──────────────────────────────────────────────────────────────
  const handleSave = () => {
    const err = validate(value);
    if (err) { setError(err); return; }
    setError("");
    onSave(value); // YYYY-MM-DD
    setValue("");
  };

  const handleGoToSettings = () => {
    onClose();
    navigate("/settings");
  };

  const handleClose = () => {
    setError("");
    setValue("");
    onClose();
  };

  // ── rendu ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full p-6 space-y-4 relative" style={{ maxWidth: '560px', minWidth: 'min(480px, 90vw)' }}>

        {/* Bouton fermer */}
        <button
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          onClick={handleClose}
          aria-label={L("Fermer", "Close")}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Titre */}
        <div className="flex items-center gap-2 pr-6">
          <Calendar className="w-5 h-5 text-primary shrink-0" />
          <h2 className="font-heading text-lg font-semibold leading-tight">
            {L("Date de naissance requise", "Date of birth required")}
          </h2>
        </div>

        {/* Explication */}
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            {L("Le score de santé financière intègre une composante", "The financial health score includes a")}
            <strong className="text-foreground"> {L("Résilience", "Resilience")}</strong> {L("qui tient compte de votre âge : plus vous approchez de la retraite, plus la protection contre les crises est importante dans la formule.", "component that factors in your age: the closer you get to retirement, the more protection against crises weighs in the formula.")}
          </p>
          <div className="flex gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <p className="text-blue-700 dark:text-blue-300 text-xs">
              {L("Cette information reste stockée uniquement sur votre appareil et n'est jamais transmise.", "This information is stored only on your device and is never transmitted.")}
            </p>
          </div>
        </div>

        {/* Champ date */}
        <div className="space-y-2">
          <Label htmlFor="birthdate-input">{L("Votre date de naissance", "Your date of birth")}</Label>
          <Input
            id="birthdate-input"
            type="date"
            value={value}
            onChange={e => { setValue(e.target.value); setError(""); }}
            max={new Date().toISOString().split("T")[0]}
            className={error ? "border-destructive" : ""}
          />
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="secondary" onClick={handleClose} className="flex-shrink-0">
              {L("Annuler", "Cancel")}
            </Button>
            <Button onClick={handleSave} disabled={!value} className="flex-shrink-0">
              {L("Calculer mon score", "Compute my score")}
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGoToSettings}
            className="flex items-center gap-1 text-muted-foreground self-start"
          >
            <ExternalLink className="w-3 h-3" />
            {L("Renseigner dans Paramètres", "Enter it in Settings")}
          </Button>
        </div>

      </div>
    </div>
  );
}

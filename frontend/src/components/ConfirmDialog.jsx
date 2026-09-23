// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
import React from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "./ui/alert-dialog";
import { useLanguage } from "../context/LanguageContext";

/**
 * ConfirmDialog — confirmation avant une action qui engage les données de l'utilisateur.
 *
 * Deux usages aujourd'hui, tous deux issus d'un audit de sécurité :
 *   • remplacer les données en cours par un fichier importé ;
 *   • adopter, pour ses propres sauvegardes, la phrase secrète d'un fichier reçu.
 *
 * `danger` colore l'action en rouge : réservé à ce qui détruit ou expose.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onCancel,
}) {
  const { lang } = useLanguage();
  const L = (fr, en) => (lang === "en" ? en : fr);

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onCancel?.(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onCancel?.()}>
            {cancelLabel || L("Annuler", "Cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onConfirm?.()}
            className={danger ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
            data-testid="confirm-dialog-action"
          >
            {confirmLabel || L("Confirmer", "Confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

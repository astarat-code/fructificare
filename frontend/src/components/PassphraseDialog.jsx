// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
import React, { useEffect, useRef, useState } from "react";
import { Lock, ShieldAlert, FileText, RefreshCw } from "lucide-react";
import { genererPhraseExemple } from "../lib/passphraseExample";
import storageService from "../services/storageService";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useLanguage } from "../context/LanguageContext";

// Plancher défini par le service, seul à le faire respecter réellement (B-06) :
// l'interface le reprend pour afficher l'erreur avant tout appel.
const MIN_PASSPHRASE_LENGTH = storageService.MIN_PASSPHRASE_LENGTH;

/**
 * PassphraseDialog — saisie de la phrase secrète protégeant les sauvegardes.
 *
 * Trois usages :
 *   • "unlock"  — ouvrir une sauvegarde chiffrée (démarrage, ou import) ;
 *   • "create"  — choisir la phrase en activant le chiffrement ;
 *   • "change"  — changer de phrase, sans jamais repasser par une écriture en clair.
 *
 * Le composant ne dérive aucune clé : il rend des chaînes à storageService, seul
 * responsable de la cryptographie. Les saisies sont effacées dès la soumission, pour
 * ne pas laisser traîner la phrase dans l'état React après le déverrouillage.
 */
export default function PassphraseDialog({
  open,
  mode = "unlock",
  error = null,
  busy = false,
  onSubmit,
  onCancel,
}) {
  const { lang } = useLanguage();
  const L = (fr, en) => (lang === "en" ? en : fr);

  const [courante, setCourante] = useState("");
  const [value, setValue] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [localError, setLocalError] = useState(null);
  // Tirée à chaque ouverture, jamais écrite nulle part : voir lib/passphraseExample.js.
  const [exemple, setExemple] = useState("");
  const inputRef = useRef(null);

  const isCreate = mode === "create";
  const isChange = mode === "change";
  const demandeConfirmation = isCreate || isChange;

  const vider = () => { setCourante(""); setValue(""); setConfirmation(""); };

  useEffect(() => {
    if (!open) return undefined;
    vider();
    setLocalError(null);
    if (demandeConfirmation) setExemple(genererPhraseExemple());
    // Le focus automatique évite un clic sur un écran qui bloque tout le reste.
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [open, mode, demandeConfirmation]);

  const submit = (e) => {
    e?.preventDefault();
    if (busy) return;

    if (demandeConfirmation) {
      if (value.length < MIN_PASSPHRASE_LENGTH) {
        setLocalError(L(
          `La phrase doit compter au moins ${MIN_PASSPHRASE_LENGTH} caractères.`,
          `The passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters long.`,
        ));
        return;
      }
      if (value !== confirmation) {
        setLocalError(L("Les deux saisies ne correspondent pas.", "The two entries do not match."));
        return;
      }
    }
    if (isChange && !courante) return;
    if (!demandeConfirmation && !value) return;

    setLocalError(null);
    const saisies = isChange ? { courante, nouvelle: value } : value;
    // Effacé tout de suite : la phrase n'a plus à vivre dans l'état du composant.
    vider();
    onSubmit(saisies);
  };

  const shown = localError || error;
  const titre = isCreate
    ? L("Choisir une phrase secrète", "Choose a passphrase")
    : isChange
      ? L("Changer la phrase secrète", "Change your passphrase")
      : L("Sauvegarde chiffrée", "Encrypted backup");

  const description = isCreate
    ? L("Elle chiffre vos sauvegardes et vous sera demandée à chaque ouverture.",
        "It encrypts your backups and will be asked for at every launch.")
    : isChange
      ? L("Vos sauvegardes sont réécrites avec la nouvelle phrase, sans jamais repasser en clair sur le disque.",
          "Your backups are rewritten with the new passphrase, without ever touching the disk in plain text.")
      : L("Saisissez votre phrase secrète pour ouvrir vos données.",
          "Enter your passphrase to open your data.");

  const libelleAction = busy
    ? (isChange ? L("Changement…", "Changing…") : L("Déchiffrement…", "Decrypting…"))
    : isCreate
      ? L("Activer le chiffrement", "Enable encryption")
      : isChange ? L("Changer la phrase", "Change passphrase") : L("Ouvrir", "Open");

  const actionPossible = isChange ? !!courante && !!value : !!value;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) { vider(); onCancel?.(); } }}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            {titre}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {isChange && (
            <div className="space-y-1.5">
              <Label htmlFor="passphrase-current">{L("Phrase actuelle", "Current passphrase")}</Label>
              <Input
                id="passphrase-current"
                ref={inputRef}
                type="password"
                autoComplete="current-password"
                value={courante}
                onChange={(e) => { setCourante(e.target.value); setLocalError(null); }}
                disabled={busy}
                data-testid="passphrase-current"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="passphrase">
              {isChange ? L("Nouvelle phrase", "New passphrase") : L("Phrase secrète", "Passphrase")}
            </Label>
            <Input
              id="passphrase"
              ref={isChange ? undefined : inputRef}
              type="password"
              autoComplete={demandeConfirmation ? "new-password" : "current-password"}
              value={value}
              onChange={(e) => { setValue(e.target.value); setLocalError(null); }}
              disabled={busy}
              data-testid="passphrase-input"
            />
          </div>

          {demandeConfirmation && (
            <div className="space-y-1.5">
              <Label htmlFor="passphrase-confirm">{L("Confirmer", "Confirm")}</Label>
              <Input
                id="passphrase-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(e) => { setConfirmation(e.target.value); setLocalError(null); }}
                disabled={busy}
                data-testid="passphrase-confirm"
              />
            </div>
          )}

          {demandeConfirmation && exemple && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3" data-testid="passphrase-example">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-foreground">
                  {L("Exemple de phrase robuste", "Example of a strong passphrase")}
                </span>
                <button
                  type="button"
                  onClick={() => setExemple(genererPhraseExemple())}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  disabled={busy}
                  data-testid="passphrase-example-refresh"
                >
                  <RefreshCw className="w-3 h-3" />
                  {L("Autre exemple", "Another one")}
                </button>
              </div>
              <p className="mt-1.5 font-mono text-sm text-primary select-all break-words">{exemple}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {L(
                  "5 mots tirés au hasard sur votre ordinateur : facile à retenir, quasi impossible à deviner.",
                  "5 words drawn at random on your computer: easy to remember, nearly impossible to guess.",
                )}
              </p>
            </div>
          )}

          {isCreate && (
            <>
              <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <ShieldAlert className="w-4 h-4 shrink-0 text-destructive mt-0.5" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {L("Impossible à réinitialiser. ", "Cannot be reset. ")}
                  </span>
                  {L(
                    "Oubliée, vos sauvegardes sont perdues pour de bon : gardez-la dans un gestionnaire de mots de passe. Vos sauvegardes en clair existantes seront supprimées.",
                    "If forgotten, your backups are lost for good: keep it in a password manager. Your existing plain-text backups will be deleted.",
                  )}
                </p>
              </div>

              {/* Dire ce que le chiffrement NE couvre PAS : sans cette précision,
                  l'utilisateur croit protéger ses relevés bancaires. */}
              <div className="flex gap-2 rounded-md border border-border bg-accent/30 p-3">
                <FileText className="w-4 h-4 shrink-0 text-muted-foreground mt-0.5" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {L(
                    "Les PDF importés dans « Documents » ne sont pas chiffrés.",
                    "PDFs imported under “Documents” are not encrypted.",
                  )}
                </p>
              </div>
            </>
          )}

          {shown && (
            <p className="text-sm text-destructive" role="alert" data-testid="passphrase-error">
              {shown}
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {onCancel && (
              <Button type="button" variant="outline" onClick={() => { vider(); onCancel(); }} disabled={busy}>
                {L("Annuler", "Cancel")}
              </Button>
            )}
            <Button type="submit" disabled={busy || !actionPossible} data-testid="passphrase-submit">
              {libelleAction}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

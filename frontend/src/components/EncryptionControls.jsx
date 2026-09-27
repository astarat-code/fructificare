// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
import React, { useCallback, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Lock } from "lucide-react";
import dataService from "../services/dataService";
import storageService from "../services/storageService";
import PassphraseDialog from "./PassphraseDialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { useLanguage } from "../context/LanguageContext";

const currentJson = () => JSON.stringify(dataService.buildExportPayload(), null, 2);

/**
 * EncryptionControls — activer, désactiver le chiffrement des sauvegardes, ou changer de
 * phrase secrète. Utilisé dans Paramètres › Sécurité et dans Fichier › Dossier des données
 * et chiffrement…
 *
 * Toute la cryptographie est dans storageService ; ce composant ne fait que recueillir les
 * phrases et afficher le résultat.
 */
export default function EncryptionControls() {
  const { lang } = useLanguage();
  const L = (fr, en) => (lang === "en" ? en : fr);

  const [encryptionOn, setEncryptionOn] = useState(() => storageService.isEncryptionEnabled());
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeError, setChangeError] = useState(null);
  const [disableOpen, setDisableOpen] = useState(false);
  // B-07 : la désactivation exige la phrase actuelle (elle déverse tout en clair).
  const [disablePassphrase, setDisablePassphrase] = useState("");
  const [disableError, setDisableError] = useState(null);

  // La dérivation de clé prend ~0,5 s : on laisse le navigateur peindre l'état « occupé »
  // avant de bloquer le fil principal.
  const laisserPeindre = () => new Promise((r) => setTimeout(r, 0));

  const handleEnable = useCallback(async (phrase) => {
    setBusy(true);
    setCreateError(null);
    await laisserPeindre();
    const res = await storageService.enableEncryption(phrase, currentJson);
    setBusy(false);
    if (!res.ok) {
      setCreateError(res.error || (lang === "en" ? "Encryption failed." : "Échec du chiffrement."));
      return;
    }
    setCreateOpen(false);
    setEncryptionOn(true);
    toast.success(lang === "en"
      ? `Backups encrypted.${res.purged ? ` ${res.purged} plain-text backup(s) deleted.` : ""}`
      : `Sauvegardes chiffrées.${res.purged ? ` ${res.purged} sauvegarde(s) en clair supprimée(s).` : ""}`);
  }, [lang]);

  const handleChange = useCallback(async ({ courante, nouvelle }) => {
    setBusy(true);
    setChangeError(null);
    await laisserPeindre();
    const res = await storageService.changePassphrase(courante, nouvelle, currentJson);
    setBusy(false);
    if (!res.ok) {
      setChangeError(res.error || (lang === "en" ? "Change failed." : "Échec du changement."));
      return;
    }
    setChangeOpen(false);
    toast.success(lang === "en"
      ? `Passphrase changed.${res.purged ? ` ${res.purged} old backup(s) deleted.` : ""}`
      : `Phrase secrète changée.${res.purged ? ` ${res.purged} ancienne(s) sauvegarde(s) supprimée(s).` : ""}`);
  }, [lang]);

  const fermerDesactivation = () => { setDisableOpen(false); setDisablePassphrase(""); setDisableError(null); };

  const handleDisable = useCallback(async () => {
    setBusy(true);
    setDisableError(null);
    await laisserPeindre();
    const res = await storageService.disableEncryption(disablePassphrase, currentJson);
    setBusy(false);
    if (!res.ok) {
      setDisableError(res.error || (lang === "en" ? "Could not disable encryption." : "Échec de la désactivation."));
      return;
    }
    setDisablePassphrase("");
    setDisableOpen(false);
    setEncryptionOn(false);
    toast.success(lang === "en"
      ? "Encryption disabled — future backups will be in plain text."
      : "Chiffrement désactivé — les prochaines sauvegardes seront en clair.");
  }, [disablePassphrase, lang]);

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor="encryption-switch" className="text-sm font-medium">
            {L("Chiffrer mes sauvegardes", "Encrypt my backups")}
          </Label>
          <p className="text-xs text-muted-foreground max-w-prose">
            {encryptionOn
              ? L("Chiffrement actif (AES-256-GCM). Votre phrase secrète est demandée à chaque ouverture de Fructificare.",
                  "Encryption is on (AES-256-GCM). Your passphrase is requested every time you open Fructificare.")
              : L("Protège vos sauvegardes par une phrase secrète. Si vous l'oubliez, vos données sont définitivement irrécupérables.",
                  "Protects your backups with a passphrase. If you forget it, your data is permanently unrecoverable.")}
          </p>
        </div>
        <Switch
          id="encryption-switch"
          checked={encryptionOn}
          disabled={busy}
          onCheckedChange={(next) => {
            if (next) { setCreateError(null); setCreateOpen(true); } else setDisableOpen(true);
          }}
          data-testid="encryption-switch"
        />
      </div>

      {encryptionOn && (
        <div className="mt-4 pt-4 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setChangeError(null); setChangeOpen(true); }}
            disabled={busy}
            data-testid="change-passphrase-btn"
          >
            <Lock className="w-4 h-4 mr-2" />
            {L("Changer la phrase secrète", "Change passphrase")}
          </Button>
          <p className="text-xs text-muted-foreground mt-2 max-w-prose">
            {L("Vos sauvegardes sont réécrites avec la nouvelle phrase sans jamais repasser en clair sur le disque, et celles que l'ancienne phrase ouvrait encore sont supprimées.",
               "Your backups are rewritten with the new passphrase without ever touching the disk in plain text, and those still readable with the old one are deleted.")}
          </p>
        </div>
      )}

      <PassphraseDialog
        open={createOpen}
        mode="create"
        error={createError}
        busy={busy}
        onSubmit={handleEnable}
        onCancel={() => { setCreateOpen(false); setCreateError(null); }}
      />

      <PassphraseDialog
        open={changeOpen}
        mode="change"
        error={changeError}
        busy={busy}
        onSubmit={handleChange}
        onCancel={() => { setChangeOpen(false); setChangeError(null); }}
      />

      {/* Confirmation avant de repasser en clair — la phrase actuelle est exigée (B-07) */}
      <Dialog open={disableOpen} onOpenChange={(o) => { if (!o) fermerDesactivation(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              {L("Désactiver le chiffrement ?", "Disable encryption?")}
            </DialogTitle>
            <DialogDescription>
              {L("Vos prochaines sauvegardes seront écrites en clair dans votre dossier des données, lisibles par tout programme lancé sous votre session utilisateur. Saisissez votre phrase secrète pour confirmer.",
                 "Future backups will be written in plain text in your data folder, readable by any program running under your user account. Enter your passphrase to confirm.")}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); if (!busy && disablePassphrase) handleDisable(); }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="disable-passphrase">{L("Phrase secrète actuelle", "Current passphrase")}</Label>
              <Input
                id="disable-passphrase"
                type="password"
                autoComplete="current-password"
                value={disablePassphrase}
                onChange={(e) => { setDisablePassphrase(e.target.value); setDisableError(null); }}
                disabled={busy}
                data-testid="disable-passphrase-input"
              />
            </div>
            {disableError && (
              <p className="text-sm text-destructive" role="alert" data-testid="disable-error">{disableError}</p>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              {/* Fermer par programme ne passe pas par onOpenChange : on vide ici aussi,
                  pour ne pas laisser la phrase dans l'état du composant. */}
              <Button type="button" variant="outline" onClick={fermerDesactivation} disabled={busy}>
                {L("Annuler", "Cancel")}
              </Button>
              <Button type="submit" variant="destructive" disabled={busy || !disablePassphrase}>
                {L("Désactiver", "Disable")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

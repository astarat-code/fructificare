// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, FolderOpen, FolderInput, HardDrive, Lock, RotateCcw, ShieldCheck, Unlock } from "lucide-react";
import dataService from "../services/dataService";
import storageService from "../services/storageService";
import { applyDataFolder, getDataFolderInfo, openDataFolder, pickDataFolder } from "../lib/dataFolder";
import EncryptionControls from "./EncryptionControls";
import PassphraseDialog from "./PassphraseDialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useLanguage } from "../context/LanguageContext";

const currentJson = () => JSON.stringify(dataService.buildExportPayload(), null, 2);

/**
 * DataFolderDialog — where Fructificare keeps its data, and whether it is encrypted.
 *
 *   • "first-run"   — welcome wizard: pick the data folder, then choose whether to encrypt.
 *   • "manage"      — File › Data folder & encryption…: move the data, take over another
 *                     folder, turn encryption on or off.
 *   • "unavailable" — the chosen folder cannot be found (external drive unplugged…).
 *
 * The folder itself is picked in a native dialog and applied on the native side (see
 * lib/dataFolder.js): this component never handles a path the user did not pick there.
 */
export default function DataFolderDialog({ open, mode, onClose }) {
  const { lang } = useLanguage();
  const en = lang === "en";
  const L = (fr, eng) => (en ? eng : fr);

  const [info, setInfo] = useState(null);
  const [step, setStep] = useState("folder");          // assistant : "folder" puis "encryption"
  const [useCustom, setUseCustom] = useState(false);   // assistant : dossier personnalisé ?
  const [candidate, setCandidate] = useState(null);    // dossier choisi, en attente de confirmation
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [passphraseOpen, setPassphraseOpen] = useState(false);
  const [passphraseError, setPassphraseError] = useState(null);

  const bloquante = mode === "first-run" || mode === "unavailable";

  useEffect(() => {
    if (!open) return;
    setStep("folder");
    setUseCustom(false);
    setCandidate(null);
    setError(null);
    getDataFolderInfo({ refresh: true }).then(setInfo).catch(() => setInfo(null));
  }, [open, mode]);

  const messageErreur = (e) => {
    const code = String(e?.message ?? e);
    if (code === "nested_folder") {
      return L("Ce dossier contient le dossier actuel des données, ou se trouve à l'intérieur : choisissez un autre emplacement.",
        "This folder contains the current data folder, or sits inside it: choose another location.");
    }
    if (code === "target_has_backups") {
      return L("Ce dossier contient déjà des sauvegardes Fructificare.", "This folder already holds Fructificare backups.");
    }
    return L(`Opération impossible : ${code}`, `Operation failed: ${code}`);
  };

  const choisir = async () => {
    setError(null);
    try {
      const c = await pickDataFolder(en);
      if (!c) return;                                    // sélecteur annulé
      setCandidate({ ...c, target: c.isDefault ? "default" : "choice" });
      if (mode === "first-run") setUseCustom(!c.isDefault);
    } catch (e) {
      setError(messageErreur(e));
    }
  };

  const revenirAuDossierParDefaut = () => {
    setError(null);
    setCandidate({
      root: info.defaultRoot,
      hasBackups: info.defaultHasBackups,
      isDefault: true,
      isCurrent: !info.custom,
      target: "default",
    });
  };

  /**
   * Applique le dossier : « use » reprend les sauvegardes qu'il contient déjà (la fenêtre
   * est alors rechargée sur ces données), « move » y déplace les données actuelles.
   * @returns {Promise<boolean>} vrai si la fenêtre reste en place (pas de rechargement)
   */
  const appliquer = async (target, modeApplication) => {
    setBusy(true);
    setError(null);
    try {
      // Un enregistrement encore en attente doit partir vers l'ANCIEN dossier.
      await storageService.flush();
      const bilan = await applyDataFolder(target, modeApplication);
      if (modeApplication === "use" || mode === "unavailable") {
        await storageService.syncEncryptionFlag();
        window.location.reload();
        return false;
      }
      setInfo(bilan.info);
      setCandidate(null);
      window.dispatchEvent(new Event("fructificare-data-folder-changed"));
      if (bilan.moved > 0) {
        toast.success(L(`Données déplacées (${bilan.moved} fichier${bilan.moved > 1 ? "s" : ""}).`,
          `Data moved (${bilan.moved} file${bilan.moved > 1 ? "s" : ""}).`));
      }
      if (bilan.leftBehind > 0) {
        toast.warning(L(
          `${bilan.leftBehind} fichier(s) n'ont pas pu être retirés de l'ancien dossier (ouverts dans un autre programme ?). Leur copie est bien dans le nouveau.`,
          `${bilan.leftBehind} file(s) could not be removed from the old folder (open in another program?). Their copy is in the new one.`,
        ));
      }
      return true;
    } catch (e) {
      setError(messageErreur(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const confirmerCandidat = async () => {
    if (!candidate) return;
    if (candidate.isCurrent) { setCandidate(null); return; }
    await appliquer(candidate.target, candidate.hasBackups ? "use" : "move");
  };

  // ── Assistant : étape 1 → étape 2 ────────────────────────────────────────────
  const continuerAssistant = async () => {
    if (useCustom && !candidate) { await choisir(); return; }
    const cible = useCustom && candidate ? candidate : null;
    const resteOuvert = await appliquer(cible ? cible.target : "default", cible?.hasBackups ? "use" : "move");
    // Des sauvegardes existantes décident elles-mêmes du chiffrement : la fenêtre se
    // recharge et, si elles sont chiffrées, la phrase secrète est demandée.
    if (resteOuvert) setStep("encryption");
  };

  const activerChiffrement = async (phrase) => {
    setBusy(true);
    setPassphraseError(null);
    await new Promise((r) => setTimeout(r, 0)); // laisse peindre l'état occupé (~0,5 s de dérivation)
    const res = await storageService.enableEncryption(phrase, currentJson);
    setBusy(false);
    if (!res.ok) {
      setPassphraseError(res.error || L("Échec du chiffrement.", "Encryption failed."));
      return;
    }
    setPassphraseOpen(false);
    toast.success(L("Vos sauvegardes seront chiffrées.", "Your backups will be encrypted."));
    onClose?.();
  };

  const chemin = (p) => (
    <p className="mt-1 text-xs font-mono text-muted-foreground break-all" data-testid="data-folder-root">{p}</p>
  );

  // Confirmation d'un dossier choisi (gestion, dossier introuvable).
  const panneauCandidat = candidate && (
    <div className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-2" data-testid="data-folder-candidate">
      <p className="text-sm font-medium">{L("Nouveau dossier des données", "New data folder")}</p>
      {chemin(candidate.root)}
      <p className="text-xs text-muted-foreground leading-relaxed">
        {candidate.isCurrent
          ? L("C'est déjà votre dossier des données.", "This already is your data folder.")
          : candidate.hasBackups
            ? L("Ce dossier contient déjà des sauvegardes Fructificare : l'application va redémarrer sur ces données. Celles affichées en ce moment restent dans l'ancien dossier.",
                "This folder already holds Fructificare backups: the application will restart on that data. What is shown right now stays in the old folder.")
            : mode === "unavailable"
              ? L("Ce dossier ne contient aucune sauvegarde : Fructificare y démarrera sans données. Les vôtres restent dans le dossier introuvable ; rebranchez-le puis choisissez-le ici pour les retrouver.",
                  "This folder holds no backup: Fructificare will start there with no data. Yours stay in the missing folder; plug it back in, then pick it here to get them back.")
              : L("Vos sauvegardes et vos documents importés y seront déplacés.",
                  "Your backups and imported documents will be moved there.")}
      </p>
      {!candidate.isCurrent && !candidate.hasBackups && !storageService.isEncryptionEnabled() && (
        <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
          {L("Si ce dossier est synchronisé (OneDrive, Dropbox…), chiffrez vos sauvegardes : sinon elles partent en clair dans le cloud.",
             "If this folder is synchronised (OneDrive, Dropbox…), encrypt your backups: otherwise they go to the cloud in plain text.")}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={() => setCandidate(null)} disabled={busy}>
          {L("Annuler", "Cancel")}
        </Button>
        <Button size="sm" onClick={confirmerCandidat} disabled={busy} data-testid="data-folder-confirm">
          {busy
            ? L("Un instant…", "Just a moment…")
            : candidate.isCurrent
              ? "OK"
              : candidate.hasBackups
                ? L("Ouvrir ces données", "Open that data")
                : mode === "unavailable" ? L("Utiliser ce dossier", "Use this folder") : L("Déplacer mes données", "Move my data")}
        </Button>
      </div>
    </div>
  );

  const erreur = error && (
    <p className="text-sm text-destructive" role="alert" data-testid="data-folder-error">{error}</p>
  );

  // ── Contenus ─────────────────────────────────────────────────────────────────
  let titre;
  let description;
  let corps;
  let pied = null;

  if (mode === "first-run" && step === "folder") {
    titre = L("Bienvenue dans Fructificare", "Welcome to Fructificare");
    description = L("Vos données restent sur cet ordinateur. Choisissez le dossier où Fructificare rangera vos sauvegardes automatiques et les PDF que vous importerez.",
      "Your data stays on this computer. Choose the folder where Fructificare will keep its automatic backups and the PDFs you import.");
    const option = (actif, onClick, icone, libelle, texte, extra, testId) => (
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className={`w-full text-left rounded-lg border p-3 transition-colors ${actif ? "border-primary bg-primary/5" : "border-border hover:bg-accent/40"}`}
        aria-pressed={actif}
        data-testid={testId}
      >
        <span className="flex items-center gap-2 text-sm font-medium">{icone}{libelle}</span>
        <span className="mt-1 block text-xs text-muted-foreground leading-relaxed">{texte}</span>
        {extra}
      </button>
    );
    corps = (
      <div className="space-y-3">
        {option(!useCustom, () => { setUseCustom(false); setCandidate(null); },
          <HardDrive className="w-4 h-4 text-primary" />,
          L("Dossier de l'application (recommandé)", "Application folder (recommended)"),
          L("Rien à gérer : le dossier habituel des applications, dans votre profil.", "Nothing to manage: the usual application folder, in your profile."),
          info && chemin(info.defaultRoot), "first-run-default")}
        {option(useCustom, () => { if (candidate) setUseCustom(true); else choisir(); },
          <FolderInput className="w-4 h-4 text-primary" />,
          L("Un dossier de mon choix…", "A folder of my choice…"),
          L("Un sous-dossier « Fructificare » y est créé : facile à retrouver, à copier ou à sauvegarder vous-même. Choisissez un dossier « Fructificare » existant pour reprendre ses données.",
            "A “Fructificare” subfolder is created there: easy to find, copy or back up yourself. Pick an existing “Fructificare” folder to take over its data."),
          useCustom && candidate && (
            <>
              {chemin(candidate.root)}
              {candidate.hasBackups && (
                <span className="mt-1 block text-xs text-primary">
                  {L("Ce dossier contient déjà des sauvegardes : elles seront ouvertes.", "This folder already holds backups: they will be opened.")}
                </span>
              )}
            </>
          ), "first-run-custom")}
        {useCustom && candidate && (
          <button type="button" className="text-xs text-muted-foreground underline" onClick={choisir} disabled={busy}>
            {L("Choisir un autre dossier…", "Choose another folder…")}
          </button>
        )}
        <p className="text-xs text-muted-foreground">
          {L("Vous pourrez changer d'avis à tout moment : Fichier › Dossier des données et chiffrement…",
             "You can change your mind at any time: File › Data folder & encryption…")}
        </p>
        {erreur}
      </div>
    );
    pied = (
      <Button onClick={continuerAssistant} disabled={busy} data-testid="first-run-continue">
        {busy ? L("Un instant…", "Just a moment…") : L("Continuer", "Continue")}
      </Button>
    );
  } else if (mode === "first-run") {
    titre = L("Chiffrer vos sauvegardes ?", "Encrypt your backups?");
    description = L("Sans chiffrement, vos sauvegardes sont des fichiers lisibles par tout programme lancé sous votre session. Avec, elles sont protégées par une phrase secrète, demandée à chaque ouverture de Fructificare.",
      "Without encryption, your backups are files any program running under your account can read. With it, they are protected by a passphrase, asked for every time you open Fructificare.");
    corps = (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => { setPassphraseError(null); setPassphraseOpen(true); }}
          className="w-full text-left rounded-lg border border-border p-3 hover:bg-accent/40"
          data-testid="first-run-encrypt"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="w-4 h-4 text-primary" />{L("Oui, chiffrer mes sauvegardes", "Yes, encrypt my backups")}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground leading-relaxed">
            {L("Recommandé si votre dossier est synchronisé (OneDrive…) ou si l'ordinateur est partagé. La phrase ne peut pas être réinitialisée : oubliée, les données sont perdues.",
               "Recommended if your folder is synchronised (OneDrive…) or the computer is shared. The passphrase cannot be reset: if forgotten, the data is lost.")}
          </span>
        </button>
        <button
          type="button"
          onClick={() => onClose?.()}
          className="w-full text-left rounded-lg border border-border p-3 hover:bg-accent/40"
          data-testid="first-run-no-encryption"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Unlock className="w-4 h-4 text-muted-foreground" />{L("Non, pas maintenant", "No, not now")}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground leading-relaxed">
            {L("Vous pourrez l'activer plus tard : Fichier › Dossier des données et chiffrement…",
               "You can turn it on later: File › Data folder & encryption…")}
          </span>
        </button>
      </div>
    );
  } else if (mode === "unavailable") {
    titre = L("Dossier des données introuvable", "Data folder not found");
    description = L("Fructificare ne trouve pas le dossier où sont rangées vos données. S'il se trouve sur un disque externe ou une clé USB, branchez-le puis réessayez.",
      "Fructificare cannot find the folder holding your data. If it is on an external drive or a USB stick, plug it in and try again.");
    corps = (
      <div className="space-y-3">
        {info && chemin(info.root)}
        {panneauCandidat || (
          <div className="flex flex-col gap-2">
            <Button
              onClick={async () => {
                const i = await getDataFolderInfo({ refresh: true }).catch(() => null);
                if (i?.available) window.location.reload();
                else setError(L("Toujours introuvable.", "Still not found."));
              }}
              disabled={busy}
              data-testid="data-folder-retry"
            >
              <RotateCcw className="w-4 h-4 mr-2" />{L("Réessayer", "Try again")}
            </Button>
            <Button variant="outline" onClick={choisir} disabled={busy}>
              <FolderInput className="w-4 h-4 mr-2" />{L("Choisir un autre dossier…", "Choose another folder…")}
            </Button>
            <Button variant="outline" onClick={revenirAuDossierParDefaut} disabled={busy || !info}>
              <HardDrive className="w-4 h-4 mr-2" />{L("Utiliser le dossier de l'application", "Use the application folder")}
            </Button>
          </div>
        )}
        {erreur}
      </div>
    );
  } else {
    titre = L("Dossier des données et chiffrement", "Data folder & encryption");
    description = L("Vos sauvegardes automatiques et vos documents importés sont rangés dans ce dossier.",
      "Your automatic backups and imported documents are kept in this folder.");
    corps = (
      <div className="space-y-5">
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{L("Dossier des données", "Data folder")}</span>
            {info && (
              <Badge variant="outline" className="text-[10px]">
                {info.custom ? L("personnalisé", "custom") : L("par défaut", "default")}
              </Badge>
            )}
          </div>
          {info && chemin(info.root)}
          {panneauCandidat || (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => openDataFolder(false).catch(() => {})} disabled={busy}>
                <FolderOpen className="w-3.5 h-3.5 mr-1.5" />{L("Ouvrir", "Open")}
              </Button>
              <Button variant="outline" size="sm" onClick={choisir} disabled={busy} data-testid="data-folder-change">
                <FolderInput className="w-3.5 h-3.5 mr-1.5" />{L("Changer de dossier…", "Change folder…")}
              </Button>
              {info?.custom && (
                <Button variant="outline" size="sm" onClick={revenirAuDossierParDefaut} disabled={busy}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />{L("Revenir au dossier de l'application", "Back to the application folder")}
                </Button>
              )}
            </div>
          )}
          {erreur}
        </section>
        <section className="space-y-2 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{L("Chiffrement", "Encryption")}</span>
          </div>
          <EncryptionControls />
        </section>
      </div>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o && !bloquante && !busy) onClose?.(); }}>
        <DialogContent
          className="sm:max-w-lg"
          hideClose={bloquante}
          onEscapeKeyDown={(e) => { if (bloquante) e.preventDefault(); }}
          onInteractOutside={(e) => e.preventDefault()}
          data-testid={`data-folder-dialog-${mode}`}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {mode === "unavailable" && <AlertTriangle className="w-4 h-4 text-destructive" />}
              {titre}
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {corps}
          {pied && <DialogFooter>{pied}</DialogFooter>}
        </DialogContent>
      </Dialog>

      <PassphraseDialog
        open={passphraseOpen}
        mode="create"
        error={passphraseError}
        busy={busy}
        onSubmit={activerChiffrement}
        onCancel={() => { setPassphraseOpen(false); setPassphraseError(null); }}
      />
    </>
  );
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "./ui/alert-dialog";
import { useLanguage } from "../context/LanguageContext";
import storageService from "../services/storageService";
import {
  EVENEMENT_RECHERCHE, checkForUpdate, installUpdate, isAutoCheckDue, isTauri,
  markAutoCheckDone, openDownloadPage, setAutoCheckEnabled,
} from "../lib/updater";

// Délai avant la recherche automatique : laisser l'application démarrer et, au premier
// lancement, laisser passer l'assistant de bienvenue.
const DELAI_RECHERCHE_AUTO_MS = 8000;

const Mo = (octets) => (octets / 1048576).toFixed(1);

/**
 * UpdateDialog — propose une nouvelle version, la télécharge et l'installe.
 *
 * Sans interface tant qu'il n'y a rien à dire. Deux déclencheurs :
 *   • automatique, une fois par jour au démarrage (désactivable dans les Paramètres) :
 *     silencieux si l'application est à jour ou si la recherche échoue ;
 *   • manuel (menu Aide › Rechercher une mise à jour) : annonce toujours le résultat.
 */
export default function UpdateDialog() {
  const { lang } = useLanguage();
  const L = useCallback((fr, en) => (lang === "en" ? en : fr), [lang]);

  const [offre, setOffre] = useState(null);       // { version, courante, installable }
  const [etape, setEtape] = useState("offre");    // 'offre' | 'installation'
  const [avancement, setAvancement] = useState({ recu: 0, total: null });
  const [erreur, setErreur] = useState(null);
  const enCours = useRef(false);

  const rechercher = useCallback(async (manuel) => {
    if (!isTauri() || enCours.current) return;
    enCours.current = true;
    try {
      const trouvee = await checkForUpdate();
      if (!manuel) markAutoCheckDone();
      if (trouvee) {
        setErreur(null);
        setEtape("offre");
        setOffre(trouvee);
      } else if (manuel) {
        toast.success(L("Fructificare est à jour.", "Fructificare is up to date."));
      }
    } catch (e) {
      // Recherche automatique : pas de connexion est une situation normale, on se tait.
      if (manuel) {
        toast.error(L(
          "La recherche de mise à jour a échoué. Vérifiez votre connexion à Internet.",
          "The update check failed. Check your Internet connection.",
        ), { description: String(e?.message ?? e) });
      }
    } finally {
      enCours.current = false;
    }
  }, [L]);

  useEffect(() => {
    if (!isTauri()) return undefined;
    const surDemande = () => rechercher(true);
    window.addEventListener(EVENEMENT_RECHERCHE, surDemande);
    const minuterie = setTimeout(() => { if (isAutoCheckDue()) rechercher(false); }, DELAI_RECHERCHE_AUTO_MS);
    return () => {
      window.removeEventListener(EVENEMENT_RECHERCHE, surDemande);
      clearTimeout(minuterie);
    };
    // Une seule programmation au montage : `rechercher` change avec la langue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const installer = async () => {
    setEtape("installation");
    setErreur(null);
    setAvancement({ recu: 0, total: null });
    try {
      // L'installateur ferme l'application : tout doit être sur le disque avant.
      await storageService.flush();
      await installUpdate((recu, total) => setAvancement({ recu, total }));
    } catch (e) {
      setEtape("offre");
      setErreur(String(e?.message ?? e));
    }
  };

  const ouvrirPage = async () => {
    try { await openDownloadPage(); } catch (e) { toast.error(String(e?.message ?? e)); }
    setOffre(null);
  };

  const neRienProposer = () => {
    setAutoCheckEnabled(false);
    setOffre(null);
    toast.info(L(
      "Recherche automatique désactivée. Vous pouvez la réactiver dans les Paramètres, ou chercher une mise à jour depuis le menu Aide.",
      "Automatic check turned off. You can turn it back on in Settings, or check for updates from the Help menu.",
    ));
  };

  if (!offre) return null;
  const installation = etape === "installation";
  const pourcent = avancement.total ? Math.min(100, Math.round((avancement.recu / avancement.total) * 100)) : null;

  return (
    <AlertDialog open onOpenChange={(o) => { if (!o && !installation) setOffre(null); }}>
      <AlertDialogContent data-testid="update-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {L(`Fructificare ${offre.version} est disponible`, `Fructificare ${offre.version} is available`)}
          </AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line">
            {installation
              ? L(
                "Téléchargement en cours. L'application se fermera puis se relancera toute seule.",
                "Downloading. The application will close and start again by itself.",
              )
              : offre.installable
                ? L(
                  `Vous utilisez la version ${offre.courante}. La mise à jour est téléchargée depuis GitHub, vérifiée, puis installée ; vos données ne sont pas modifiées.`,
                  `You are using version ${offre.courante}. The update is downloaded from GitHub, verified, then installed; your data is left untouched.`,
                )
                : L(
                  `Vous utilisez la version ${offre.courante}. Cette installation ne se met pas à jour toute seule : téléchargez la nouvelle version depuis la page des versions.`,
                  `You are using version ${offre.courante}. This installation cannot update itself: download the new version from the releases page.`,
                )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {installation && (
          <div data-testid="update-progress">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full bg-primary transition-all ${pourcent == null ? "animate-pulse w-1/3" : ""}`}
                style={pourcent == null ? undefined : { width: `${pourcent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1 tabular-nums">
              {avancement.total
                ? `${Mo(avancement.recu)} / ${Mo(avancement.total)} Mo`
                : `${Mo(avancement.recu)} Mo`}
            </p>
          </div>
        )}

        {erreur && (
          <p className="text-sm text-destructive" data-testid="update-error">
            {L("La mise à jour a échoué : ", "The update failed: ")}{erreur}
          </p>
        )}

        {!installation && (
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <button
              type="button"
              onClick={neRienProposer}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 sm:mr-auto"
              data-testid="update-disable"
            >
              {L("Ne plus chercher automatiquement", "Stop checking automatically")}
            </button>
            <AlertDialogCancel onClick={() => setOffre(null)} data-testid="update-later">
              {L("Plus tard", "Later")}
            </AlertDialogCancel>
            {/* preventDefault : la boîte doit rester ouverte pendant le téléchargement. */}
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (offre.installable) installer(); else ouvrirPage(); }}
              data-testid="update-install"
            >
              {offre.installable
                ? L("Mettre à jour maintenant", "Update now")
                : L("Ouvrir la page de téléchargement", "Open the download page")}
            </AlertDialogAction>
          </AlertDialogFooter>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

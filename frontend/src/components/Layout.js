// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
import { useState, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { useLanguage } from "../context/LanguageContext";
import dataService from "../services/dataService";
import storageService from "../services/storageService";
import FructiLogo from "./FructiLogo";
import { LayoutDashboard, TrendingUp, CalendarDays, FileText, Settings, Menu, X, Sun, Moon, Languages, Save, AlertTriangle, CheckCircle2, Loader2, Trophy, BookOpen, FolderOpen, Clock, Trash2, Lock } from "lucide-react";
import { NotificationBell } from "./NotificationPanel";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { getRecentFiles, addRecentFile, removeRecentFile, clearRecentFiles } from "../lib/recentFiles";
import { openManual } from "../lib/openManual";
import ConfirmDialog from "./ConfirmDialog";
import { toast } from "sonner";
import gamificationService from "../services/gamificationService";
import AvatarIcon from "./gamification/AvatarIcon";
import avatarService from "../services/avatarService";

const navItems = [
  { path: "/", icon: LayoutDashboard, key: "dashboard" },
  { path: "/simulation", icon: TrendingUp, key: "simulation" },
  { path: "/calendar", icon: CalendarDays, key: "calendar" },
  { path: "/documents", icon: FolderOpen, key: "documents" },
  { path: "/tax-report", icon: FileText, key: "taxReport" },
  { path: "/trophees", icon: Trophy, key: "trophees" },
  // Glossaire — basculera dans la barre d'outils supérieure après packaging Tauri.
  { path: "/glossaire", icon: BookOpen, key: "glossaire" },
  { path: "/settings", icon: Settings, key: "settings" },
];


export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen]     = useState(false);
  const [hasUnsaved, setHasUnsaved]       = useState(false);
  const [saveStatus, setSaveStatus]       = useState(storageService.getStatus());
  const [isSaving, setIsSaving]           = useState(false);
  // État gamification réactif — se met à jour sur progressUpdated, profileUpdated, preferencesUpdated
  const [, setGamifTick] = useState(0);
  // Menu « Fichiers récents » (bureau)
  // Confirmation avant d'ecraser les donnees en cours par un fichier importe.
  const [ecrasement, setEcrasement] = useState({ open: false, resolve: null });
  // Confirmation avant « Nouveau » (menu natif) quand des données existent.
  const [viderConfirm, setViderConfirm] = useState({ open: false, resolve: null });
  const [recentOpen, setRecentOpen] = useState(false);
  const [recentList, setRecentList] = useState([]);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { t, lang, toggleLang, setLang } = useLanguage();

  // En application bureau (Tauri), la barre de menu native remplace les contrôles
  // de la colonne latérale (sauvegarde, thème, langue, Paramètres) → on les masque
  // pour éviter les doublons. En navigateur (dev), on les conserve.
  const isTauri = typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;

  // Initialise le mode de sauvegarde au premier rendu
  useEffect(() => { storageService.init(); }, []);

  // Quand un fichier JSON est chargé, appliquer le thème sauvegardé dedans
  useEffect(() => {
    const unsub = gamificationService.onEvent('appPreferencesLoaded', (prefs) => {
      if (prefs?.theme && (prefs.theme === 'light' || prefs.theme === 'dark')) {
        setTheme(prefs.theme);
      }
    });
    return unsub;
  }, [setTheme]);

  // Abonnement aux événements gamification pour re-lire l'état dynamiquement
  useEffect(() => {
    const bump = () => setGamifTick(v => v + 1);
    const unsubs = [
      gamificationService.onEvent('progressUpdated',     bump),
      gamificationService.onEvent('portfoliosChanged',   bump),
      gamificationService.onEvent('profileUpdated',      bump),
      gamificationService.onEvent('preferencesUpdated',  bump),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  // Indicateur "modifications non sauvegardées" (badge nav Settings)
  useEffect(() => {
    const checkUnsaved = () => setHasUnsaved(dataService.hasUnsavedChanges());
    checkUnsaved();
    const interval = setInterval(checkUnsaved, 1000);
    return () => clearInterval(interval);
  }, []);

  // Abonnement aux changements d'état de storageService
  useEffect(() => {
    const unsub = storageService.subscribe(status => setSaveStatus({ ...status }));
    return unsub;
  }, []);

  // Capacité d'auto-save (stable entre les rendus tant que le mode ne change pas)
  const canAutoSave = storageService.canAutoSave();

  // Bascule du thème clair/sombre + persistance dans le JSON
  const handleThemeToggle = useCallback(() => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    try { dataService.saveAppPreferences({ theme: newTheme }); } catch (_) {}
  }, [theme, setTheme]);

  // Bouton "Sauvegarder maintenant"
  const handleManualSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (!canAutoSave) {
        // Mode fallback (Firefox) : téléchargement manuel
        await dataService.downloadDataAsFile();
        setHasUnsaved(false);
      } else {
        const json = JSON.stringify(dataService.buildExportPayload(), null, 2);
        const result = await storageService.save(json);
        if (result.ok) {
          dataService.markAsSaved();
          setHasUnsaved(false);
        }
      }
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, canAutoSave]);

  // Charge une sauvegarde depuis un chemin (import direct + « Fichiers récents »).
  //
  // SÉCURITÉ : le périmètre disque de l'application est volontairement limité à son propre
  // dossier (src-tauri/capabilities/default.json). Un fichier situé ailleurs n'est lisible
  // que si l'utilisateur vient de le désigner via la boîte de dialogue — le plugin `dialog`
  // ajoute alors ce seul chemin au périmètre, pour la session en cours. Un chemin mémorisé
  // dans « Fichiers récents » redevient donc illisible au lancement suivant : on redemande
  // le fichier plutôt que de conclure à tort qu'il a disparu.
  const loadFileFromPath = useCallback(async (path) => {
    const L = (fr, en) => (lang === "en" ? en : fr);

    // Un import REMPLACE tout. Tant qu'aucune donnée n'existe, la question n'a pas
    // lieu d'être ; dès qu'il y en a, la poser est le seul moyen d'éviter qu'un clic
    // de trop — ou un fichier reçu d'un tiers — efface le patrimoine en cours.
    // La question précède la lecture : refuser ne doit pas coûter la saisie d'une
    // phrase secrète pour un fichier qu'on n'importera pas.
    if (dataService.hasData()) {
      const accepte = await new Promise((resolve) => setEcrasement({ open: true, resolve }));
      if (!accepte) return "cancelled";
    }

    let raw;
    try {
      const fs = await import("@tauri-apps/plugin-fs");
      raw = await fs.readTextFile(path);
    } catch (_) {
      return "unreachable";
    }
    try {
      // Le fichier peut être une enveloppe chiffrée : deserializeImported demande alors
      // la phrase secrète à l'utilisateur.
      const ok = dataService.applyImportedData(await storageService.deserializeImported(raw), { save: true });
      if (!ok) { toast.error(L("Fichier de sauvegarde invalide.", "Invalid backup file.")); return "invalid"; }
      dataService.markAsSaved();
      addRecentFile(path);
      // Entrées écartées par l'assainissement : on le dit, plutôt que de laisser
      // l'utilisateur découvrir des données manquantes sans explication.
      const report = dataService.getLastImportReport();
      if (report.totalDropped > 0) {
        toast.warning(L(
          `${report.totalDropped} entrée(s) invalide(s) ignorée(s) dans ce fichier.`,
          `${report.totalDropped} invalid entr${report.totalDropped > 1 ? 'ies' : 'y'} ignored in this file.`,
        ));
      }
      try { gamificationService.dispatchEvent("portfoliosChanged"); } catch (_) {}
      try { gamificationService.dispatchEvent("profileUpdated"); } catch (_) {}
      window.dispatchEvent(new Event("fructificare-refresh"));
      navigate("/");
      toast.success(L("Sauvegarde chargée.", "Backup loaded."));
      return "ok";
    } catch (_) {
      toast.error(L("Échec du chargement.", "Load failed."));
      return "invalid";
    }
  }, [lang, navigate]);

  // Ouvre le sélecteur de fichiers puis charge la sauvegarde choisie.
  //
  // `defaultPath` positionne le sélecteur sur un fichier connu. C'est ce qui rend les
  // « Fichiers récents » encore utiles malgré le périmètre disque restreint : l'accès
  // direct n'est plus possible d'une session à l'autre, mais l'utilisateur retrouve son
  // fichier déjà pointé et n'a qu'à confirmer.
  const pickAndLoadBackup = useCallback(async (defaultPath) => {
    const L = (fr, en) => (lang === "en" ? en : fr);
    try {
      const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
      const sel = await openDialog({
        multiple: false,
        defaultPath: defaultPath || undefined,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!sel) return "cancelled";
      return await loadFileFromPath(Array.isArray(sel) ? sel[0] : sel);
    } catch (_) {
      toast.error(L("Échec de l'import.", "Import failed."));
      return "invalid";
    }
  }, [lang, loadFileFromPath]);

  // Le menu natif suit la langue d'affichage (il est construit en français au démarrage).
  useEffect(() => {
    if (typeof window === "undefined" || !window.__TAURI_INTERNALS__) return;
    import("@tauri-apps/api/core")
      .then(({ invoke }) => invoke("set_menu_language", { lang }))
      .catch(() => { /* menu laissé tel quel */ });
  }, [lang]);

  // ── Menu natif Tauri (bureau) ─────────────────────────────────────────────
  // Le binaire Rust émet `menu-action` avec l'id de l'item cliqué ; on relie chaque
  // id à l'action correspondante côté React. Ignoré hors application bureau.
  useEffect(() => {
    // `window.__TAURI_INTERNALS__` est injecté par la webview Tauri v2 dans tous les cas.
    if (typeof window === "undefined" || !window.__TAURI_INTERNALS__) return;
    let unlisten;
    (async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlisten = await listen("menu-action", async (e) => {
          const L = (fr, en) => (lang === "en" ? en : fr);
          switch (e.payload) {
            case "new": {   // Nouveau : espace de travail vierge (sans recharger de sauvegarde)
              // Confirmation si des données existent : « Nouveau » vide tout en mémoire,
              // et l'enregistrement automatique persiste ensuite l'état vierge. Sans ce
              // garde, un clic de trop — ou un script hostile pilotant le menu — effacerait
              // le patrimoine courant. Même logique que l'import (voir loadFileFromPath).
              if (dataService.hasData()) {
                const ok = await new Promise((resolve) => setViderConfirm({ open: true, resolve }));
                if (!ok) break;
              }
              dataService.clearAllData();
              navigate("/");
              window.dispatchEvent(new Event("fructificare-refresh"));
              toast.success(L("Nouveau document vierge.", "New blank document."));
              break;
            }
            case "save":     handleManualSave(); break;
            case "export": {   // Exporter une sauvegarde vers un emplacement choisi
              try {
                const [{ save: saveDialog }, fs] = await Promise.all([
                  import("@tauri-apps/plugin-dialog"), import("@tauri-apps/plugin-fs"),
                ]);
                const stamp = new Date().toISOString().slice(0, 10);
                const path = await saveDialog({
                  defaultPath: `fructificare-save-${stamp}.json`,
                  filters: [{ name: "JSON", extensions: ["json"] }],
                });
                if (!path) break;
                await fs.writeTextFile(path, await storageService.serializeForExport(
                  JSON.stringify(dataService.buildExportPayload(), null, 2),
                ));
                dataService.markAsSaved();
                addRecentFile(path);
                toast.success(L("Sauvegarde exportée.", "Backup exported."));
              } catch (_) { toast.error(L("Échec de l'export.", "Export failed.")); }
              break;
            }
            case "import":   // Importer une sauvegarde depuis un fichier choisi
              await pickAndLoadBackup();
              break;
            case "recent-files":   // Ouvrir un projet récemment ouvert/exporté
              setRecentList(getRecentFiles());
              setRecentOpen(true);
              break;
            case "settings": navigate("/settings"); break;
            case "glossary": navigate("/glossaire"); break;
            case "theme-dark":
              setTheme("dark");  try { dataService.saveAppPreferences({ theme: "dark" }); } catch (_) {} break;
            case "theme-light":
              setTheme("light"); try { dataService.saveAppPreferences({ theme: "light" }); } catch (_) {} break;
            case "lang-fr":  setLang("fr"); break;
            case "lang-en":  setLang("en"); break;
            case "manual": {
              const res = await openManual(lang);
              if (!res.ok) toast.error(L("Impossible d'ouvrir le manuel.", "Could not open the manual."));
              break;
            }
            default: break;
          }
        });
      } catch (_) { /* APIs Tauri indisponibles (build web) */ }
    })();
    return () => { if (unlisten) unlisten(); };
  }, [handleManualSave, navigate, setTheme, setLang, lang, pickAndLoadBackup]);

  // Formate l'horodatage de la dernière sauvegarde
  const lastSavedLabel = (() => {
    if (!saveStatus.lastSaved) return null;
    const d = new Date(saveStatus.lastSaved);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300" data-testid="app-layout">

      {/* ── En-tête mobile ───────────────────────────────────── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-card/80 backdrop-blur-xl border-b border-border flex items-center justify-between px-4">
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} data-testid="mobile-menu-btn">
          <Menu className="w-5 h-5" />
        </Button>

        {/* Logo compact (icône ff uniquement sur mobile) */}
        <Link to="/" className="flex items-center gap-1.5">
          {/* Pas de `scale-*` ici : une transformation CSS rééchantillonne le texte
              déjà rendu et le rend flou. La taille se règle dans FructiLogo. */}
          <FructiLogo iconOnly />
        </Link>

        <div className="flex gap-1 items-center">
          <NotificationBell />
          {!isTauri && (
            <>
              <Button variant="ghost" size="icon" onClick={toggleLang} data-testid="lang-toggle-mobile">
                <Languages className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleThemeToggle} data-testid="theme-toggle-mobile">
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
            </>
          )}
        </div>
      </header>

      {/* ── Overlay sidebar mobile ───────────────────────────── */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ─────────────────────────────────────────── */}
      {/* Colonne flex : le bloc du bas est un frère du <nav> (et non un élément
          positionné en absolu) — sur un écran court, la navigation défile au lieu
          de passer sous les boutons Sauvegarder / langue / thème. */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border transition-transform duration-300 lg:translate-x-0 flex flex-col ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        data-testid="sidebar"
      >
        {/* Logo + contrôles */}
        <div className="flex items-center justify-between h-16 px-5 shrink-0">
          <Link to="/" onClick={() => setSidebarOpen(false)}>
            <FructiLogo />
          </Link>
          <div className="flex items-center gap-1.5">
            <span className="hidden lg:flex"><NotificationBell /></span>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <Separator className="shrink-0" />

        {/* ── Profil utilisateur — avatar de patrimoine + nom, lien vers la page Trophées ── */}
        {(() => {
          const gState  = gamificationService.getState();
          const gamifOn = gState?.preferences?.gamificationEnabled !== false;
          const name    = gState?.profile?.username || 'Fructi Padawan';
          // L'avatar reflète le capital total (calibré, sinon versements nets).
          const avatar  = avatarService.getCurrentAvatar();
          const avatarLabel = lang === 'fr' ? avatar.labelFr : avatar.labelEn;

          return (
            <Link
              to="/trophees"
              onClick={() => setSidebarOpen(false)}
              title={gamifOn ? avatarLabel : name}
              className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-accent/50 transition-colors border-b border-border shrink-0"
            >
              {gamifOn && (
                <AvatarIcon
                  tier={avatar.tier}
                  isGolden={avatar.isGolden}
                  isPrestige={avatar.isPrestige}
                  title={avatarLabel}
                  size={32}
                />
              )}
              <span className="text-sm font-medium text-foreground truncate">
                {name}
              </span>
            </Link>
          );
        })()}

        {/* Navigation — occupe l'espace restant et défile si la fenêtre est trop courte */}
        <nav className="flex flex-col gap-1 p-3 mt-2 flex-1 min-h-0 overflow-y-auto">
          {navItems.filter(item => !(isTauri && (item.key === "settings" || item.key === "glossaire"))).map((item) => {
            const active = pathname === item.path;
            const showBadge = item.key === "settings" && hasUnsaved;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative
                  ${active
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                data-testid={`nav-${item.key}`}
              >
                <item.icon className="w-4.5 h-4.5" strokeWidth={1.5} />
                {t(`nav.${item.key}`)}
                {showBadge && (
                  <span
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full animate-pulse"
                    style={{ backgroundColor: "#EFAD24" }}
                    title={lang === 'fr' ? 'Modifications non sauvegardées' : 'Unsaved changes'}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bas de sidebar — sauvegarde + langue + thème (toujours en pied de colonne) */}
        <div className="shrink-0 p-4 border-t border-border space-y-3 bg-card">

          {/* ── Bloc sauvegarde ─────────────────────────────── */}
          <div className="space-y-1.5">
            {/* Erreur auto-save */}
            {saveStatus.error && (
              <div className="flex items-start gap-1.5 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-2 py-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-tight">
                  {saveStatus.error}
                </p>
              </div>
            )}

            {/* Session chiffrée non déverrouillée : sans cela, l'utilisateur verrait une
                application vide dont les modifications ne peuvent pas être enregistrées,
                sans moyen de reprendre la main autrement qu'en relançant. */}
            {saveStatus.encrypted && !saveStatus.unlocked && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs gap-1.5 h-8"
                onClick={async () => {
                  const loaded = await dataService.loadMostRecentSave().catch(() => null);
                  if (loaded) {
                    window.dispatchEvent(new Event("fructificare-refresh"));
                    toast.success(lang === "en" ? "Data unlocked." : "Données déverrouillées.");
                  }
                }}
                data-testid="unlock-btn"
              >
                <Lock className="w-3.5 h-3.5" />
                {lang === "en" ? "Unlock my data" : "Déverrouiller mes données"}
              </Button>
            )}

            {/* Bouton Sauvegarder maintenant — masqué en bureau (menu Fichier → Sauvegarder) */}
            {!isTauri && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs gap-1.5 h-8"
                onClick={handleManualSave}
                disabled={isSaving}
                data-testid="save-now-btn"
                title={canAutoSave
                  ? (lang === 'fr' ? 'Sauvegarder maintenant' : 'Save now')
                  : (lang === 'fr' ? 'Télécharger le fichier de sauvegarde' : 'Download the backup file')}
              >
                {isSaving
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Save className="w-3.5 h-3.5" />
                }
                {lang === 'fr' ? 'Sauvegarder' : 'Save now'}
              </Button>
            )}

            {/* Horodatage de la dernière sauvegarde */}
            {lastSavedLabel && !saveStatus.error && (
              <p className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 justify-center">
                <CheckCircle2 className="w-3 h-3" />
                {lang === 'fr' ? `Sauvegardé le ${lastSavedLabel}` : `Saved ${lastSavedLabel}`}
              </p>
            )}

            {/* Avertissement fallback */}
            {!canAutoSave && !saveStatus.error && (
              <p className="text-[10px] text-muted-foreground/70 text-center leading-tight">
                {lang === 'fr'
                  ? 'Auto-save indisponible (Firefox) — utilisez ce bouton.'
                  : 'Auto-save unavailable (Firefox) — use this button.'}
              </p>
            )}
          </div>

          <Separator />

          {/* ── Signature + langue + thème ──────────────────── */}
          <p className="text-xs text-muted-foreground/60 text-center font-vintage tracking-wide">
            Fructificare
          </p>
          {/* Langue + thème — masqués en bureau (menu natif Affichage › Thèmes / Langues) */}
          {!isTauri && (
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={toggleLang} className="text-xs gap-1.5" data-testid="lang-toggle">
                <Languages className="w-3.5 h-3.5" /> {lang === "fr" ? "EN" : "FR"}
              </Button>
              <Button variant="ghost" size="icon" onClick={handleThemeToggle} data-testid="theme-toggle">
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Contenu principal ────────────────────────────────── */}
      <main className="lg:ml-64 pt-14 lg:pt-0 min-h-screen">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>

      {/* ── Fichiers récents (menu Fichier, bureau) ─────────────── */}
      <Dialog open={recentOpen} onOpenChange={setRecentOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {lang === "en" ? "Recent files" : "Fichiers récents"}
            </DialogTitle>
            <DialogDescription>
              {lang === "en"
                ? "Reopen a recently opened or exported portfolio project."
                : "Rouvrir un projet de portefeuille récemment ouvert ou exporté."}
            </DialogDescription>
          </DialogHeader>
          {recentList.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {lang === "en"
                ? "No recent files yet. Import or export a backup to add one."
                : "Aucun fichier récent. Importez ou exportez une sauvegarde pour en ajouter un."}
            </p>
          ) : (
            <div className="space-y-1.5 max-h-[55vh] overflow-y-auto">
              {recentList.map((f) => (
                <div key={f.path} className="flex items-center gap-2 rounded-lg border border-border p-2.5 hover:bg-accent/50 transition-colors">
                  <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                  <button
                    type="button"
                    className="flex-1 min-w-0 text-left"
                    onClick={async () => {
                      let status = await loadFileFromPath(f.path);
                      // Chemin hors du périmètre disque de l'application (cas normal au
                      // lancement suivant) : on redemande le fichier à l'utilisateur.
                      if (status === "unreachable") {
                        toast.info(lang === "en"
                          ? "Confirm the file location to open it."
                          : "Confirmez l'emplacement du fichier pour l'ouvrir.");
                        status = await pickAndLoadBackup(f.path);
                      }
                      if (status === "ok") setRecentOpen(false);
                      else setRecentList(getRecentFiles());
                    }}
                  >
                    <p className="text-sm font-medium truncate">{f.name}</p>
                    {/* Le chemin complet n'est pas affiché : il contient le nom de session
                        Windows et l'arborescence personnelle. Le dossier parent suffit à
                        distinguer deux sauvegardes de même nom. */}
                    <p className="text-xs text-muted-foreground truncate">
                      {f.folder || (lang === "en" ? "Unknown folder" : "Dossier inconnu")}
                    </p>
                  </button>
                  {f.ts && (
                    <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                      {new Date(f.ts).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR")}
                    </span>
                  )}
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    title={lang === "en" ? "Remove from list" : "Retirer de la liste"}
                    onClick={() => setRecentList(removeRecentFile(f.path))}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {recentList.length > 0 && (
            <div className="flex justify-end pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-destructive gap-1.5"
                onClick={() => {
                  setRecentList(clearRecentFiles());
                  toast.success(lang === "en" ? "List cleared." : "Liste vidée.");
                }}
                data-testid="clear-recent-btn"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {lang === "en" ? "Clear the list" : "Vider la liste"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Remplacement des données par un fichier importé — voir loadFileFromPath. */}
      <ConfirmDialog
        open={ecrasement.open}
        danger
        title={lang === "en" ? "Replace your current data?" : "Remplacer vos données actuelles ?"}
        description={lang === "en"
          ? "Importing a backup replaces everything currently in Fructificare: envelopes, "
            + "movements, calibrations, objectives.\n\n"
            + "Your last automatic saves remain in the application folder, so a mistake can "
            + "be undone — but the data on screen right now will be gone."
          : "Importer une sauvegarde remplace tout ce que contient actuellement Fructificare : "
            + "enveloppes, mouvements, calibrations, objectifs.\n\n"
            + "Vos dernières sauvegardes automatiques restent dans le dossier de l'application, "
            + "une erreur peut donc être rattrapée — mais les données affichées maintenant "
            + "disparaîtront."}
        confirmLabel={lang === "en" ? "Replace" : "Remplacer"}
        onConfirm={() => { ecrasement.resolve?.(true); setEcrasement({ open: false, resolve: null }); }}
        onCancel={() => { ecrasement.resolve?.(false); setEcrasement({ open: false, resolve: null }); }}
      />

      {/* « Nouveau » (menu natif) : vider l'espace de travail — voir le gestionnaire menu-action. */}
      <ConfirmDialog
        open={viderConfirm.open}
        danger
        title={lang === "en" ? "Start a blank workspace?" : "Repartir d'un espace vierge ?"}
        description={lang === "en"
          ? "“New” empties everything currently open in Fructificare: envelopes, movements, "
            + "calibrations, objectives.\n\n"
            + "Your last automatic saves remain in the application folder, so a mistake can be "
            + "undone — but the data on screen right now will be cleared."
          : "« Nouveau » vide tout ce qui est actuellement ouvert dans Fructificare : enveloppes, "
            + "mouvements, calibrations, objectifs.\n\n"
            + "Vos dernières sauvegardes automatiques restent dans le dossier de l'application, "
            + "une erreur peut donc être rattrapée — mais les données affichées maintenant "
            + "seront effacées."}
        confirmLabel={lang === "en" ? "Empty" : "Vider"}
        onConfirm={() => { viderConfirm.resolve?.(true); setViderConfirm({ open: false, resolve: null }); }}
        onCancel={() => { viderConfirm.resolve?.(false); setViderConfirm({ open: false, resolve: null }); }}
      />
    </div>
  );
}

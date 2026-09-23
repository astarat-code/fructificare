// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
import "@/App.css";
import { useState, useCallback, useEffect, useRef, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { LanguageProvider } from "./context/LanguageContext";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./components/ui/dialog";
import Layout from "./components/Layout";
import dataService from "./services/dataService";
import gamificationService from "./services/gamificationService";
import healthScoreService from "./services/healthScoreService";
import trophyService from "./services/trophyService";
import questService from "./services/questService";
import objectiveService from "./services/objectiveService";
import challengeService from "./services/challengeService";
import streakService from "./services/streakService";
import notificationService from "./services/notificationService";
import GameEventHandler from "./components/gamification/GameEventHandler";
import PassphraseDialog from "./components/PassphraseDialog";
import ConfirmDialog from "./components/ConfirmDialog";
import storageService from "./services/storageService";

// Pages en chargement différé (code-splitting par route) — allège le bundle
// initial : les libs lourdes (recharts, jsPDF) migrent dans le
// chunk de la page qui les utilise au lieu du main.js.
const Dashboard                = lazy(() => import("./pages/Dashboard"));
const PortfolioDetail          = lazy(() => import("./pages/PortfolioDetail"));
const Simulation               = lazy(() => import("./pages/Simulation"));
const SimulationList           = lazy(() => import("./pages/SimulationList"));
const SimulationDetail         = lazy(() => import("./pages/SimulationDetail"));
const SimulationEnvelopeDetail = lazy(() => import("./pages/SimulationEnvelopeDetail"));
const Rule843                  = lazy(() => import("./pages/Rule843"));
const TaxSimulator             = lazy(() => import("./pages/TaxSimulator"));
const TaxReport                = lazy(() => import("./pages/TaxReport"));
const Settings                 = lazy(() => import("./pages/Settings"));
const CalendarPage             = lazy(() => import("./pages/CalendarPage"));
const DocumentsPage            = lazy(() => import("./pages/DocumentsPage"));
const Trophees                 = lazy(() => import("./pages/Trophees"));
const Glossaire                = lazy(() => import("./pages/Glossaire"));

// Format monétaire du récapitulatif de rattrapage
const fmtEur = (v) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v || 0);

// État de la demande de phrase secrète (voir PassphraseDialog).
const EMPTY_PASSPHRASE_STATE = { open: false, error: null, busy: false, resolve: null };
// Consentement a adopter la phrase secrete d'un fichier importe (voir storageService).
const EMPTY_ADOPTION_STATE = { open: false, resolve: null };

function App() {
  // Compteur pour forcer le rafraîchissement des composants après import
  const [refreshKey, setRefreshKey] = useState(0);
  const [passphrase, setPassphrase] = useState(EMPTY_PASSPHRASE_STATE);
  const [adoption, setAdoption] = useState(EMPTY_ADOPTION_STATE);

  // Rattrapage des mouvements récurrents (démarrage + import JSON)
  const [catchUpReport, setCatchUpReport] = useState(null);
  const [catchUpDetailOpen, setCatchUpDetailOpen] = useState(false);

  const runCatchUp = useCallback(() => {
    try {
      // App est rendu au-dessus du LanguageProvider → lecture directe de la langue.
      const isEn = (dataService.getAppPreferences()?.language || "fr") === "en";
      const report = dataService.runRecurringCatchUp();
      const applied = report.applied.length + (report.simApplied || 0);
      if (applied === 0 && report.pending.length === 0) return; // rien à signaler
      setCatchUpReport(report);
      const s = (n) => (n > 1 ? "s" : "");
      const msg = applied > 0
        ? (isEn
            ? `${applied} automatic deposit${s(applied)} applied since your last save (period: ${report.periodStart} → ${report.periodEnd}).`
            : `${applied} versement${s(applied)} automatique${s(applied)} appliqué${s(applied)} depuis la dernière sauvegarde (période : ${report.periodStart} → ${report.periodEnd}).`)
        : (isEn
            ? `${report.pending.length} scheduled movement${s(report.pending.length)} awaiting manual application.`
            : `${report.pending.length} mouvement${s(report.pending.length)} programmé${s(report.pending.length)} en attente d'application manuelle.`);
      toast.info(msg, {
        duration: 12000,
        action: { label: isEn ? "View details" : "Voir le détail", onClick: () => setCatchUpDetailOpen(true) },
      });
    } catch (e) {
      console.warn("[recurring] catch-up error:", e);
    }
  }, []);

  // Initialisation au démarrage — exécutée UNE SEULE FOIS (garde anti-double
  // invocation StrictMode, item 7e). Le travail lourd (rattrapage récurrent,
  // rendements/score de santé, trophées, notifications…) est DIFFÉRÉ après le
  // premier rendu pour ne pas bloquer la peinture initiale (items 7a & 7b).
  const _didInit = useRef(false);
  useEffect(() => {
    if (_didInit.current) return;
    _didInit.current = true;

    // ── Travail léger, requis pour un premier rendu correct (synchrone) ──
    try { gamificationService.recalculateTemporality(); }
    catch (e) { console.warn("[temporality] recalculateTemporality error:", e); }
    try { gamificationService.resetSessionViewFlags(); }
    catch (e) { console.warn("[viewFlags] resetSessionViewFlags error:", e); }
    console.info("App initialised");

    // ── Demande de phrase secrète (sauvegardes chiffrées) ──
    // storageService ne connaît pas React : on lui fournit une fonction qui ouvre la
    // boîte de dialogue et résout avec ce que l'utilisateur a saisi.
    storageService.setPassphrasePrompt(
      (error) => new Promise((resolve) => {
        setPassphrase({ open: true, error, busy: false, resolve });
      }),
      () => setPassphrase(EMPTY_PASSPHRASE_STATE),
    );

    // Un fichier IMPORTÉ qui vient d'être déchiffré propose sa phrase secrète pour
    // protéger les sauvegardes locales. C'est légitime quand on restaure sa propre
    // sauvegarde sur une nouvelle machine ; ça ne l'est pas quand le fichier vient
    // d'un tiers, qui connaîtrait alors la phrase protégeant tout ce qui suit.
    // On demande donc, au lieu d'adopter en silence.
    storageService.setKeyAdoptionConfirm(
      () => new Promise((resolve) => { setAdoption({ open: true, resolve }); }),
    );

    // ── Chargement de la sauvegarde la plus récente (Tauri/FSA) ──
    // Lancé IMMÉDIATEMENT (pas en requestIdleCallback) pour afficher les données au
    // plus tôt ; le travail lourd suit une fois le chargement terminé.
    const _scheduleDeferred = () => {
      if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(_runDeferredWork, { timeout: 2000 });
      } else {
        setTimeout(_runDeferredWork, 500);
      }
    };
    const bootLoad = () => {
      dataService.loadMostRecentSave()
        .then((loaded) => { if (loaded) setRefreshKey(prev => prev + 1); })
        .catch(() => {})
        .finally(_scheduleDeferred);
    };

    const _runDeferredWork = () => {
      // Rattrapage des occurrences récurrentes manquées (item 7a)
      try { runCatchUp(); } catch (e) { console.warn("[recurring] catch-up error:", e); }
      // Rendements / score de santé — calculs lourds différés (item 7b)
      try { healthScoreService.runHealthScoreUpdate(); healthScoreService.checkQuarterlyHealthBonus(); }
      catch (e) { console.warn("[healthScore] startup error:", e); }
      try { trophyService.checkAllTrophies(); } catch (e) { console.warn("[trophies] startup error:", e); }
      try { questService.checkCurrentQuest(); } catch (e) { console.warn("[quests] startup error:", e); }
      try { objectiveService.checkObjectiveCompletion(); } catch (e) { console.warn("[objectives] startup error:", e); }
      try { challengeService.handleMonthlyChallengeReset(); } catch (e) { console.warn("[challenges] handleMonthlyChallengeReset error:", e); }
      try { challengeService.checkMonthlyChallenge(); } catch (e) { console.warn("[challenges] startup check error:", e); }
      try { streakService.handleDailyConnection(); } catch (e) { console.warn("[streak] handleDailyConnection error:", e); }
      try { notificationService.checkAllNotifications(); } catch (e) { console.warn("[notifications] checkAllNotifications error:", e); }
      // Alignement des dossiers de documents sur le nommage neutre — une seule fois,
      // sans effet si tout est déjà à jour (voir dataService.migrateDocumentFolders).
      dataService.migrateDocumentFolders()
        .catch((e) => console.warn("[documents] migration des dossiers :", e));
      // Diagnostic de taille de la sauvegarde (item 7d)
      try { dataService.logDataSizeDiagnostic(); } catch (_) {}
    };

    // Charge la sauvegarde tout de suite, puis planifie le travail lourd.
    // Pas d'annulation en cleanup : le travail doit s'exécuter même après le cycle
    // mount/unmount/remount de StrictMode.
    bootLoad();
  }, [runCatchUp]);

  // Rafraîchissement global déclenché par le menu natif (ex. « Nouveau ») —
  // remonte toutes les pages sans recharger la fenêtre.
  useEffect(() => {
    const onRefresh = () => { try { runCatchUp(); } catch (_) {} setRefreshKey(prev => prev + 1); };
    window.addEventListener("fructificare-refresh", onRefresh);
    return () => window.removeEventListener("fructificare-refresh", onRefresh);
  }, [runCatchUp]);

  // Les pages sont remontées via `refreshKey`, mais pas la mise en page (Layout) :
  // on signale le rechargement des données pour que la cloche relise son compteur
  // (sinon la pastille restait à la valeur d'avant le chargement ou l'import).
  useEffect(() => {
    window.dispatchEvent(new Event("fructificare-data-changed"));
  }, [refreshKey]);

  const handleDataChange = useCallback(() => {
    // Import JSON (ou réinitialisation) : rattraper les occurrences manquées AVANT
    // de rafraîchir l'UI, pour que les pages reflètent les mouvements appliqués.
    runCatchUp();
    setRefreshKey(prev => prev + 1);
  }, [runCatchUp]);

  // Langue courante pour la modale de rattrapage (App est au-dessus du provider).
  const cuEn = (dataService.getAppPreferences()?.language || "fr") === "en";
  const cuS = (n) => (n > 1 ? "s" : "");

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <LanguageProvider>
        {/* Sauvegarde chiffrée : bloque l'accès aux données tant que la phrase n'est
            pas fournie. Rendu dans LanguageProvider, dont le composant dépend. */}
        <PassphraseDialog
          open={passphrase.open}
          mode="unlock"
          error={passphrase.error}
          busy={passphrase.busy}
          onSubmit={(value) => {
            setPassphrase((p) => ({ ...p, busy: true }));
            passphrase.resolve?.(value);
          }}
          onCancel={() => {
            passphrase.resolve?.(null);
            setPassphrase(EMPTY_PASSPHRASE_STATE);
          }}
        />
        {/* Adoption de la phrase d'un fichier importé — voir setKeyAdoptionConfirm. */}
        <ConfirmDialog
          open={adoption.open}
          danger
          title={cuEn
            ? "Use this passphrase for your own backups?"
            : "Utiliser cette phrase pour vos propres sauvegardes ?"}
          description={cuEn
            ? "This file was encrypted by whoever created it. If you accept, your own "
              + "backups will from now on be protected by this passphrase and this salt — "
              + "which that person knows.\n\n"
              + "Accept only if this file is YOUR backup, for example restored from a USB "
              + "drive onto a new computer.\n\n"
              + "If you decline, the file is still imported and readable; your backups simply "
              + "keep their current protection. You can set your own passphrase in "
              + "Settings › Security."
            : "Ce fichier a été chiffré par la personne qui l'a créé. Si vous acceptez, "
              + "vos propres sauvegardes seront désormais protégées par cette phrase et ce sel "
              + "— que cette personne connaît.\n\n"
              + "N'acceptez que s'il s'agit de VOTRE sauvegarde, par exemple restaurée depuis "
              + "une clé USB sur un nouvel ordinateur.\n\n"
              + "Si vous refusez, le fichier est tout de même importé et lisible ; vos sauvegardes "
              + "gardent simplement leur protection actuelle. Vous pourrez choisir votre propre "
              + "phrase dans Paramètres › Sécurité."}
          confirmLabel={cuEn ? "Adopt this passphrase" : "Adopter cette phrase"}
          cancelLabel={cuEn ? "No, import only" : "Non, importer seulement"}
          onConfirm={() => { adoption.resolve?.(true); setAdoption(EMPTY_ADOPTION_STATE); }}
          onCancel={() => { adoption.resolve?.(false); setAdoption(EMPTY_ADOPTION_STATE); }}
        />
        <BrowserRouter>
          {/* Orchestrateur d'animations gamification (headless) */}
          <GameEventHandler />
          <Layout>
            <Suspense fallback={
              <div className="flex items-center justify-center py-24">
                <div className="w-8 h-8 rounded-full border-2 border-muted border-t-primary animate-spin" />
              </div>
            }>
            <Routes>
              <Route path="/" element={<Dashboard key={refreshKey} />} />
              <Route path="/portfolio/:id" element={<PortfolioDetail key={refreshKey} />} />
              <Route path="/simulation" element={<Simulation key={refreshKey} />} />
              <Route path="/simulation/portfolios" element={<SimulationList key={refreshKey} />} />
              <Route path="/simulation/portfolios/:id" element={<SimulationDetail key={refreshKey} />} />
              <Route path="/simulation/rule-843" element={<Rule843 key={refreshKey} />} />
              <Route path="/simulation/rule-843/:id" element={<Rule843 key={refreshKey} />} />
              <Route path="/simulation/portfolios/:simId/envelope/:portfolioId" element={<SimulationEnvelopeDetail key={refreshKey} />} />
              <Route path="/simulation/tax" element={<TaxSimulator key={refreshKey} />} />
              <Route path="/tax-report" element={<TaxReport key={refreshKey} />} />
              <Route path="/calendar" element={<CalendarPage key={refreshKey} />} />
              <Route path="/documents" element={<DocumentsPage key={refreshKey} />} />
              <Route path="/trophees" element={<Trophees key={refreshKey} />} />
              <Route path="/glossaire" element={<Glossaire key={refreshKey} />} />
              <Route path="/settings" element={<Settings onDataChange={handleDataChange} />} />
            </Routes>
            </Suspense>
          </Layout>
        </BrowserRouter>
        <Toaster position="top-right" />

        {/* Détail du rattrapage des mouvements récurrents (« Voir le détail ») */}
        <Dialog open={catchUpDetailOpen} onOpenChange={setCatchUpDetailOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading">{cuEn ? "Recurring movements catch-up" : "Rattrapage des mouvements récurrents"}</DialogTitle>
              <DialogDescription>
                {cuEn ? "Period:" : "Période :"} {catchUpReport?.periodStart} → {catchUpReport?.periodEnd}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {(catchUpReport?.applied || []).length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">{cuEn ? "Applied automatically" : "Appliqués automatiquement"} ({catchUpReport.applied.length})</p>
                  <div className="space-y-1">
                    {catchUpReport.applied.map((m, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 text-sm p-2 rounded-md bg-accent/40">
                        <span className="font-mono text-xs shrink-0">{m.date}</span>
                        <span className="flex-1 truncate">{m.label}</span>
                        <span className={`font-mono tabular-nums shrink-0 ${m.type === "deposit" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                          {m.type === "deposit" ? "+" : "-"}{fmtEur(m.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(catchUpReport?.simApplied || 0) > 0 && (
                <p className="text-sm text-muted-foreground">
                  {cuEn
                    ? `${catchUpReport.simApplied} occurrence${cuS(catchUpReport.simApplied)} also materialised in simulations.`
                    : `${catchUpReport.simApplied} occurrence${cuS(catchUpReport.simApplied)} également matérialisée${cuS(catchUpReport.simApplied)} dans les simulations.`}
                </p>
              )}
              {(catchUpReport?.pending || []).length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2 text-amber-600 dark:text-amber-400">{cuEn ? "Awaiting manual application" : "En attente d'application manuelle"} ({catchUpReport.pending.length})</p>
                  <div className="space-y-1">
                    {catchUpReport.pending.map((m, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 text-sm p-2 rounded-md bg-amber-50 dark:bg-amber-950/20">
                        <span className="font-mono text-xs shrink-0">{m.date}</span>
                        <span className="flex-1 truncate">{m.label}</span>
                        <span className="font-mono tabular-nums shrink-0">{fmtEur(m.amount)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {cuEn
                      ? "“Apply automatically” is off for these scheduled movements — apply them from the calendar."
                      : "« Appliquer automatiquement » est désactivé pour ces mouvements programmés — à appliquer depuis le calendrier."}
                  </p>
                </div>
              )}
              {(catchUpReport?.capped || []).length > 0 && (
                <p className="text-xs text-rose-600 dark:text-rose-400">
                  {cuEn
                    ? `⚠ Catch-up capped at 24 months: ${catchUpReport.capped.map(c => `${c.label} (${c.skipped} earlier occurrence${cuS(c.skipped)} skipped)`).join(", ")}.`
                    : `⚠ Rattrapage plafonné à 24 mois : ${catchUpReport.capped.map(c => `${c.label} (${c.skipped} occurrence${cuS(c.skipped)} antérieure${cuS(c.skipped)} ignorée${cuS(c.skipped)})`).join(", ")}.`}
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;

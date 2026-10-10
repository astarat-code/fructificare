// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
import { useRef, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import dataService from "../services/dataService";
import storageService from "../services/storageService";
import documentService from "../services/documentService";
import gamificationService from "../services/gamificationService";
import { useLanguage } from "../context/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
// TODO(tmi): importer Select quand le comparateur fiscal sera opérationnel
import { Switch } from "../components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { saveFileWithDialog } from "../lib/saveFile";
import { toast } from "sonner";
import { Download, Upload, FileDown, AlertTriangle, CheckCircle2, RotateCcw, HardDrive, FolderOpen, User, Settings2, Save, Lock } from "lucide-react";
import EncryptionControls from "../components/EncryptionControls";
import { getDataFolderInfo } from "../lib/dataFolder";
import ConfirmDialog from "../components/ConfirmDialog";
import { isTauri as updaterAvailable, isAutoCheckEnabled, setAutoCheckEnabled, requestManualCheck } from "../lib/updater";

export default function Settings({ onDataChange }) {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [hasData, setHasData] = useState(false);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  // Confirmation avant qu'un import n'ecrase les donnees en cours (carte navigateur).
  const [ecrasement, setEcrasement] = useState({ open: false, resolve: null });

  const [importedCount, setImportedCount] = useState(0);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState(storageService.getStatus());
  const [backups, setBackups] = useState([]);
  const [dataRoot, setDataRoot] = useState(null);

  // ── Données utilisateur ───────────────────────────────────────────────────
  const [userUsername,   setUserUsername]   = useState('');
  const [userIncome,     setUserIncome]     = useState('');
  const [userBirthDate,  setUserBirthDate]  = useState('');
  const [gamifEnabled,   setGamifEnabled]   = useState(true);
  const [autoUpdateCheck, setAutoUpdateCheck] = useState(() => isAutoCheckEnabled());
  const [colorPastel,    setColorPastel]    = useState(true); // true = palette pastel, false = classique
  const [savedIndicator, setSavedIndicator] = useState(false);

  // Calcule l'âge en années depuis une date ISO
  const calcAge = (dob) => {
    if (!dob) return null;
    const birth = new Date(dob + 'T12:00:00');
    const age   = Math.floor((Date.now() - birth) / (365.25 * 24 * 3600 * 1000));
    return age >= 0 && age <= 120 ? age : null;
  };

  // Mission 1 (janvier) : visite de la page Paramètres
  useEffect(() => {
    try { require('../services/challengeService').default.markVisit('visitSettings'); } catch (_) {}
  }, []);

  useEffect(() => {
    const gs   = gamificationService.getState() || {};
    const prof = gs.profile || {};
    const pref = gs.preferences || {};
    setUserUsername(prof.username || '');
    setUserIncome(prof.monthlyNetIncome != null ? String(prof.monthlyNetIncome) : '');
    setUserBirthDate(prof.birthDate || '');
    // tmi supprimé (TODO: réactiver quand le comparateur fiscal sera opérationnel)
    setGamifEnabled(pref.gamificationEnabled !== false);
    setColorPastel(dataService.getAppPreferences()?.colorStyle !== 'classic');

    // Rester synchronisé si le profil est modifié depuis une autre page
    const unsubProfile = gamificationService.onEvent('profileUpdated', (p) => {
      setUserUsername(p?.username || '');
      setUserIncome(p?.monthlyNetIncome != null ? String(p.monthlyNetIncome) : '');
      setUserBirthDate(p?.birthDate || '');
      // tmi supprimé (TODO: réactiver quand le comparateur fiscal sera opérationnel)
    });
    const unsubPrefs = gamificationService.onEvent('preferencesUpdated', (p) => {
      setGamifEnabled(p?.gamificationEnabled !== false);
    });
    return () => { unsubProfile(); unsubPrefs(); };
  }, []);

  // Auto-save déclenché au blur de chaque champ du profil
  const saveField = useCallback(() => {
    const trimmedName = userUsername.trim();
    const incomeNum   = userIncome !== '' ? parseFloat(userIncome) : null;
    // TODO(tmi): réactiver quand le comparateur fiscal sera opérationnel

    gamificationService.patchState({
      profile: {
        username:         trimmedName || null,
        monthlyNetIncome: incomeNum !== null && !isNaN(incomeNum) ? incomeNum : null,
        birthDate:        userBirthDate || null,
        incomeUpdatedAt:  new Date().toISOString(),
      },
    });

    // Recalculs dépendants
    try { require('../services/healthScoreService').default.runHealthScoreUpdate(); } catch (_) {}
    try { require('../services/challengeService').default.trackIncomeUpdated();     } catch (_) {}
    try { require('../services/trophyService').default.checkAllTrophies();          } catch (_) {}

    // Indicateur visuel "✓ Enregistré" pendant 2 secondes
    setSavedIndicator(true);
    setTimeout(() => setSavedIndicator(false), 2000);
  }, [userUsername, userIncome, userBirthDate]);

  // Toggle gamification
  const handleGamifToggle = (val) => {
    setGamifEnabled(val);
    gamificationService.patchState({ preferences: { gamificationEnabled: val } });
  };

  // Toggle style de couleurs des enveloppes (pastel ↔ classique).
  // Re-mappe les couleurs des enveloppes existantes (palette par indice ; les
  // couleurs personnalisées sont préservées) et persiste la préférence. Les pages
  // d'enveloppes relisent la couleur à leur montage → mise à jour immédiate à
  // l'affichage, sans déclencher de rattrapage de mouvements.
  const handleColorStyleToggle = (pastel) => {
    setColorPastel(pastel);
    dataService.applyColorStyle(pastel ? 'pastel' : 'classic');
  };

  // Mode découverte : les termes financiers deviennent cliquables dans toute
  // l'application et ouvrent une bulle d'explication. Activé par défaut.
  const [discoveryMode, setDiscoveryMode] = useState(
    () => dataService.getAppPreferences()?.discoveryMode !== false,
  );
  const handleDiscoveryToggle = (on) => {
    setDiscoveryMode(on);
    dataService.saveAppPreferences({ discoveryMode: on });
    gamificationService.dispatchEvent('preferencesUpdated', { discoveryMode: on });
  };

  // Abonnement aux changements storageService
  useEffect(() => {
    storageService.init();
    const unsub = storageService.subscribe(s => setSaveStatus({ ...s }));
    // Dossier des données et liste des sauvegardes (Tauri seulement), relus après un
    // changement de dossier.
    const lireDossier = () => {
      getDataFolderInfo().then((info) => setDataRoot(info?.root || null)).catch(() => {});
      storageService.listBackups().then(setBackups);
    };
    lireDossier();
    window.addEventListener('fructificare-data-folder-changed', lireDossier);
    return () => { unsub(); window.removeEventListener('fructificare-data-folder-changed', lireDossier); };
  }, []);

  const checkData = useCallback(() => {
    setHasData(dataService.hasData());
    setHasUnsaved(dataService.hasUnsavedChanges());
  }, []);

  useEffect(() => {
    checkData();
    // Mettre à jour l'état lors du focus de la fenêtre
    const handleFocus = () => checkData();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [checkData]);

  const exportData = async () => {
    await dataService.downloadDataAsFile();
    toast.success(t("common.success"));
    // Rafraîchir l'état pour cacher la pastille
    setHasUnsaved(false);
  };

  const importData = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Un import REMPLACE tout. Même garde que dans le menu natif (Layout.js) : la
    // question n'a de sens que s'il y a déjà quelque chose à perdre.
    if (dataService.hasData()) {
      const accepte = await new Promise((resolve) => setEcrasement({ open: true, resolve }));
      if (!accepte) { e.target.value = ""; return; }
    }

    setImportStatus("loading");
    
    try {
      const result = await dataService.loadDataFromFile(file);

      // Vérifier que les données ont bien été importées
      const portfolios = dataService.getPortfolios();

      if (portfolios.length > 0) {
        setImportStatus("success");
        setHasData(true);
        setImportedCount(portfolios.length);
        toast.success(`${t("settings.importSuccess")} - ${portfolios.length} ${lang === 'en' ? 'envelope(s)' : 'enveloppe(s)'}`);
        // Migration : avertir si des mouvements récurrents ont été perdus (ancien format JSON)
        if (dataService.getRegularMovementsResetFlag()) {
          dataService.clearRegularMovementsResetFlag();
          toast.warning(lang === 'en' ? 'Your recurring movements were reset following an update' : 'Vos mouvements récurrents ont été réinitialisés suite à une mise à jour');
        }
        
        // Notifier le parent (App.js) du changement de données
        if (onDataChange) {
          onDataChange();
        }
        
        // Rediriger vers le tableau de bord après un court délai
        setTimeout(() => {
          navigate("/");
        }, 1500);
      } else {
        setImportStatus("error");
        toast.error(lang === 'en' ? 'No envelope found in the file' : 'Aucune enveloppe trouvée dans le fichier');
      }
    } catch (err) { 
      console.error("Import error:", err);
      setImportStatus("error");
      toast.error(err.message || t("settings.importError")); 
    }
    finally { 
      if (fileRef.current) fileRef.current.value = ""; 
    }
  };

  const exportLogs = async () => {
    const logs = dataService.getLogs();
    const text = logs.map(l => `${l.timestamp} - ${l.message}`).join("\n");
    const name = `fructificare_log_${new Date().toISOString().split("T")[0]}.txt`;
    const res = await saveFileWithDialog({
      data: text,
      defaultPath: name,
      filters: [{ name: "Texte", extensions: ["txt"] }],
      mime: "text/plain",
    });
    if (res.ok) toast.success(t("common.success"));
  };

  return (
    <div className="space-y-6" data-testid="settings-page">
      <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight">{t("settings.title")}</h1>
      
      {!hasData && (
        <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20" data-testid="no-data-warning">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">{t("settings.noDataTitle")}</p>
              <p className="text-sm text-amber-700 dark:text-amber-300">{t("settings.noDataDesc")}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {importStatus === "success" && (
        <Card className="border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <div>
              <p className="font-medium text-emerald-800 dark:text-emerald-200">{lang === 'en' ? 'Import successful!' : 'Import réussi !'}</p>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                {lang === 'en'
                  ? `${importedCount} envelope(s) imported. Redirecting to the dashboard...`
                  : `${importedCount} enveloppe(s) importée(s). Redirection vers le tableau de bord...`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Import de sauvegarde (mode navigateur uniquement) ──────────────
          Dans l'application de bureau, l'import passe par le menu natif
          « Fichier → Importer une sauvegarde… ». En mode navigateur ce menu
          n'existe pas : sans ce bouton, le code d'import serait inatteignable. */}
      {!documentService.isTauri() && (
        <Card className="border border-border shadow-sm" data-testid="browser-import-card">
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              {lang === 'fr' ? 'Importer une sauvegarde' : 'Import a backup'}
            </CardTitle>
            <CardDescription className="mt-1">
              {lang === 'fr'
                ? "Mode navigateur : le menu natif « Fichier » n'est pas disponible ici."
                : 'Browser mode: the native “File” menu is not available here.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              onChange={importData}
              className="hidden"
              data-testid="import-file-input"
            />
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={importStatus === 'loading'}
              data-testid="import-file-btn"
            >
              <Upload className="w-4 h-4 mr-2" />
              {importStatus === 'loading'
                ? (lang === 'fr' ? 'Import en cours…' : 'Importing…')
                : (lang === 'fr' ? 'Choisir un fichier JSON' : 'Choose a JSON file')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Données de l'utilisateur ──────────────────────────────────────── */}
      <Card className="border border-border shadow-sm" data-testid="user-data-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                {lang === 'fr' ? 'Mon profil' : 'My Profile'}
              </CardTitle>
              <CardDescription className="mt-1">
                {lang === 'fr'
                  ? 'Ces données personnalisent votre score de santé financière et vos objectifs.'
                  : 'These details personalise your financial health score and objectives.'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Pseudo / Nom affiché */}
          <div className="space-y-1.5">
            <Label htmlFor="settings-username">
              {lang === 'fr' ? 'Pseudo / Nom affiché' : 'Display name / Nickname'}
            </Label>
            <Input
              id="settings-username"
              placeholder="Fructi Padawan"
              value={userUsername}
              onChange={e => setUserUsername(e.target.value)}
              maxLength={30}
            />
            <p className="text-xs text-muted-foreground">
              {lang === 'fr'
                ? 'Affiché dans la barre latérale, à côté de votre avatar.'
                : 'Shown in the sidebar, next to your avatar.'}
            </p>
          </div>

          {/* Date de naissance */}
          <div className="space-y-1.5">
            <Label htmlFor="settings-birthdate">
              {lang === 'fr'
                ? 'Date de naissance (utilisée pour le score de santé financière)'
                : 'Date of birth (used for financial health score)'}
            </Label>
            <div className="flex items-center gap-3">
              <Input
                id="settings-birthdate"
                type="date"
                value={userBirthDate}
                onChange={e => setUserBirthDate(e.target.value)}
                max={new Date(Date.now() - 18 * 365.25 * 24 * 3600 * 1000).toISOString().split('T')[0]}
                min={new Date(Date.now() - 90 * 365.25 * 24 * 3600 * 1000).toISOString().split('T')[0]}
                className="flex-1"
              />
              {calcAge(userBirthDate) !== null && (
                <span className="text-sm text-muted-foreground shrink-0">
                  ({calcAge(userBirthDate)} {lang === 'fr' ? 'ans' : 'yrs'})
                </span>
              )}
            </div>
          </div>

          {/* Revenu mensuel net */}
          <div className="space-y-1.5">
            <Label htmlFor="settings-income">
              {lang === 'fr' ? 'Revenu mensuel net (€)' : 'Monthly net income (€)'}
            </Label>
            <Input
              id="settings-income"
              type="number"
              min="0"
              step="50"
              placeholder="2 500"
              value={userIncome}
              onChange={e => setUserIncome(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {lang === 'fr'
                ? 'Utilisé pour calculer le taux d\'investissement du budget, le Crossover Point FIRE et le score de santé.'
                : 'Used to compute your budget investment rate, FIRE crossover point, and health score.'}
            </p>
          </div>

          {/* TMI supprimé — TODO: réactiver quand le comparateur fiscal sera opérationnel */}

          {/* ── Bouton Enregistrer ─────────────────────────────────────────── */}
          <div className="flex items-center justify-end gap-3 pt-1 border-t border-border">
            {savedIndicator && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {lang === 'fr' ? 'Enregistré' : 'Saved'}
              </span>
            )}
            <Button
              onClick={saveField}
              size="sm"
              className="gap-1.5"
              data-testid="save-profile-btn"
            >
              <Save className="w-3.5 h-3.5" />
              {lang === 'fr' ? 'Enregistrer' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Sécurité : chiffrement des sauvegardes ────────────────────────── */}
      <Card className="border border-border shadow-sm" data-testid="encryption-card">
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            {lang === 'fr' ? 'Sécurité' : 'Security'}
          </CardTitle>
          <CardDescription className="mt-1">
            {lang === 'fr'
              ? "Par défaut, vos sauvegardes sont enregistrées en clair : tout programme lancé sous votre session utilisateur peut les lire."
              : 'By default your backups are stored in plain text: any program running under your user account can read them.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EncryptionControls />
        </CardContent>
      </Card>

      {/* ── Préférences gamification ──────────────────────────────────────── */}
      <Card className="border border-border shadow-sm" data-testid="gamif-prefs-card">
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            {lang === 'fr' ? 'Préférences' : 'Preferences'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">
                {lang === 'fr' ? 'Afficher la progression' : 'Show progression'}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {lang === 'fr'
                  ? 'Activé par défaut. Désactiver pour masquer le tutoriel et le défi du mois. La page Trophées reste accessible. Le score de santé continue d\'être calculé silencieusement.'
                  : 'Enabled by default. Disable to hide the tutorial and monthly challenge. The Trophies page stays accessible. The health score keeps updating silently.'}
              </p>
            </div>
            <Switch
              checked={gamifEnabled}
              onCheckedChange={handleGamifToggle}
              className="shrink-0 mt-0.5"
            />
          </div>

          {/* Mises à jour : seule connexion à Internet de l'application */}
          {updaterAvailable() && (
            <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-border bg-muted/30 mt-4" data-testid="update-check-row">
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">
                  {lang === 'fr' ? 'Rechercher les mises à jour automatiquement' : 'Check for updates automatically'}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {lang === 'fr'
                    ? "Activé par défaut. Une fois par jour, au démarrage, l'application lit sur GitHub le numéro de la dernière version. Rien n'est envoyé : ni vos données, ni aucun identifiant. C'est la seule connexion à Internet de Fructificare ; désactivez-la pour un fonctionnement entièrement hors ligne."
                    : 'Enabled by default. Once a day, at startup, the application reads the number of the latest version on GitHub. Nothing is sent: neither your data nor any identifier. This is the only Internet connection Fructificare makes; turn it off for a fully offline operation.'}
                </p>
                <button
                  type="button"
                  onClick={requestManualCheck}
                  className="text-xs font-medium text-primary underline underline-offset-2"
                  data-testid="update-check-now"
                >
                  {lang === 'fr' ? 'Rechercher maintenant' : 'Check now'}
                </button>
              </div>
              <Switch
                checked={autoUpdateCheck}
                onCheckedChange={(v) => { setAutoCheckEnabled(v); setAutoUpdateCheck(v); }}
                className="shrink-0 mt-0.5"
                data-testid="update-check-switch"
              />
            </div>
          )}

          {/* Style de couleurs : Classique / Pastel */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-border bg-muted/30 mt-4" data-testid="color-style-row">
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">
                {lang === 'fr' ? 'Couleurs des enveloppes : Classique / Pastel' : 'Envelope colours: Classic / Pastel'}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {lang === 'fr'
                  ? 'Pastel (par défaut) : palette d\'enveloppes douce et moderne. Classique : palette d\'origine vive. La bascule met à jour les couleurs des enveloppes en direct ; les couleurs personnalisées sont conservées.'
                  : 'Pastel (default): soft, modern envelope palette. Classic: original vivid palette. Toggling recolours envelopes live; custom colours are preserved.'}
              </p>
              <p className="text-xs font-medium text-primary">
                {colorPastel
                  ? (lang === 'fr' ? 'Actuel : Pastel' : 'Current: Pastel')
                  : (lang === 'fr' ? 'Actuel : Classique' : 'Current: Classic')}
              </p>
            </div>
            <Switch
              checked={colorPastel}
              onCheckedChange={handleColorStyleToggle}
              className="shrink-0 mt-0.5"
              data-testid="color-style-switch"
            />
          </div>

          {/* Mode découverte / expert — pilote les bulles du glossaire */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-border bg-muted/30 mt-4" data-testid="discovery-mode-row">
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">
                {lang === 'fr' ? 'Mode découverte' : 'Discovery mode'}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {lang === 'fr'
                  ? "Activé par défaut. Les termes financiers (PEA, plus-value, intérêts composés…) deviennent cliquables dans toute l'application et ouvrent une bulle d'explication en langage simple. Désactivez-le pour le mode expert : l'interface reste épurée et le glossaire complet demeure accessible depuis le menu."
                  : 'Enabled by default. Financial terms (PEA, capital gain, compound interest…) become clickable throughout the application and open a plain-language explanation bubble. Turn it off for expert mode: the interface stays clean and the full glossary remains available from the menu.'}
              </p>
              <p className="text-xs font-medium text-primary">
                {discoveryMode
                  ? (lang === 'fr' ? 'Actuel : découverte' : 'Current: discovery')
                  : (lang === 'fr' ? 'Actuel : expert' : 'Current: expert')}
              </p>
            </div>
            <Switch
              checked={discoveryMode}
              onCheckedChange={handleDiscoveryToggle}
              className="shrink-0 mt-0.5"
              data-testid="discovery-mode-switch"
            />
          </div>
        </CardContent>
      </Card>

      {/* Import / export des données : désormais dans le menu natif « Fichier »
          (Sauvegarder / Exporter / Importer) — les tuiles ont été retirées d'ici. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="border border-border shadow-sm" data-testid="log-card">
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <FileDown className="w-5 h-5 text-primary" />{t("settings.activityLog")}
            </CardTitle>
            <CardDescription>{t("settings.logDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={exportLogs} variant="secondary" className="w-full" data-testid="export-log-btn">
              <FileDown className="w-4 h-4 mr-2" /> {t("settings.downloadLog")}
            </Button>
          </CardContent>
        </Card>

        {/* ── Carte auto-save ─────────────────────────────── */}
        <Card className="border border-border shadow-sm" data-testid="autosave-card">
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-primary" />
              {lang === 'fr' ? 'Sauvegarde automatique' : 'Auto-save'}
            </CardTitle>
            <CardDescription>
              {saveStatus.mode === 'tauri' && (lang === 'fr' ? 'Les 10 plus récentes sont conservées dans votre dossier des données.' : 'The 10 most recent are kept in your data folder.')}
              {saveStatus.mode === 'fsa'   && (lang === 'fr' ? 'Chrome/Edge — écrit dans le fichier choisi.' : 'Chrome/Edge — writes to the selected file.')}
              {saveStatus.mode === 'fallback' && (lang === 'fr' ? 'Firefox — utiliser le bouton de téléchargement.' : 'Firefox — use the download button.')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Badge mode */}
            <div className="flex items-center gap-2">
              <Badge variant={saveStatus.mode === 'fallback' ? 'secondary' : 'outline'} className={
                saveStatus.mode === 'tauri'    ? 'text-emerald-600 border-emerald-500' :
                saveStatus.mode === 'fsa'      ? 'text-blue-600 border-blue-500' :
                                                 'text-muted-foreground'
              }>
                {saveStatus.mode === 'tauri' ? 'Tauri' : saveStatus.mode === 'fsa' ? 'File System API' : 'Fallback'}
              </Badge>
              {saveStatus.lastSaved && (
                <span className="text-xs text-muted-foreground">
                  {lang === 'fr' ? 'Dernière sauvegarde : ' : 'Last saved: '}
                  {new Date(saveStatus.lastSaved).toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            {/* Erreur */}
            {saveStatus.error && (
              <div className="flex items-start gap-1.5 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-2 py-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300">{saveStatus.error}</p>
              </div>
            )}

            {/* FSA : bouton "changer de fichier" */}
            {saveStatus.mode === 'fsa' && (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5 text-xs"
                onClick={() => {
                  storageService.clearSaveHandle();
                  toast.info(lang === 'fr' ? 'Fichier oublié. Un nouveau sera demandé lors de la prochaine sauvegarde.' : 'Handle cleared. A new file will be picked on next save.');
                }}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                {lang === 'fr' ? 'Changer le fichier de sauvegarde' : 'Change save file'}
              </Button>
            )}

            {/* Tauri : dossier des données, modifiable depuis Fichier › Dossier des données… */}
            {saveStatus.mode === 'tauri' && dataRoot && (
              <div className="space-y-1.5">
                <p className="text-xs font-mono text-muted-foreground break-all" data-testid="data-folder-path">{dataRoot}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 text-xs"
                  onClick={() => window.dispatchEvent(new Event('fructificare-open-data-folder'))}
                  data-testid="open-data-folder-settings"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  {lang === 'fr' ? 'Dossier des données et chiffrement…' : 'Data folder & encryption…'}
                </Button>
              </div>
            )}

            {/* Tauri : liste des 5 dernières sauvegardes */}
            {saveStatus.mode === 'tauri' && backups.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {lang === 'fr' ? 'Sauvegardes récentes :' : 'Recent backups:'}
                </p>
                <ul className="space-y-0.5 max-h-32 overflow-y-auto">
                  {backups.slice(0, 5).map(b => (
                    <li key={b.name} className="flex items-center justify-between text-xs text-muted-foreground py-0.5">
                      <span>{b.label}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px]"
                        onClick={async () => {
                          try {
                            const data = await storageService.restoreBackup(b.path);
                            dataService.setData(data);
                            if (data.simulations) {
                              dataService.importSimulationsFromJSON({ simulations: data.simulations });
                            }
                            toast.success(lang === 'fr' ? `Restauré : ${b.label}` : `Restored: ${b.label}`);
                            if (onDataChange) onDataChange();
                          } catch {
                            toast.error(lang === 'fr' ? 'Erreur de restauration' : 'Restore error');
                          }
                        }}
                      >
                        {lang === 'fr' ? 'Restaurer' : 'Restore'}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-destructive/50 shadow-sm" data-testid="reset-card">
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2 text-destructive">
              <RotateCcw className="w-5 h-5" />{lang === 'fr' ? 'Tout réinitialiser' : 'Reset everything'}
            </CardTitle>
            <CardDescription>{lang === 'fr' ? 'Supprimer définitivement toutes les données de l\'application' : 'Permanently delete all application data'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => setResetDialogOpen(true)}
              variant="destructive"
              className="w-full"
              data-testid="reset-btn"
            >
              <RotateCcw className="w-4 h-4 mr-2" /> {lang === 'fr' ? 'Tout réinitialiser' : 'Reset everything'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de confirmation de réinitialisation */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {lang === 'fr' ? 'Confirmer la réinitialisation complète' : 'Confirm full reset'}
            </DialogTitle>
            <DialogDescription>
              {lang === 'fr'
                ? 'Cette action est irréversible. Les catégories suivantes seront définitivement supprimées :'
                : 'This action is irreversible. The following categories will be permanently deleted:'}
            </DialogDescription>
          </DialogHeader>
          <ul className="text-sm list-disc pl-5 space-y-1 text-muted-foreground">
            {(lang === 'fr'
              ? [
                  'Toutes les enveloppes',
                  "Tout l'historique des mouvements (versements et retraits)",
                  'Toutes les calibrations',
                  'Les mouvements récurrents (tableau de bord et simulations)',
                  'Les mouvements types (tableau de bord et simulations)',
                  'Les mouvements programmés',
                  'Les entrées de budget',
                  'Toutes les simulations',
                  'Votre profil (nom, âge, revenu)',
                  'Trophées, quêtes, niveau et avancement du tutoriel',
                  'Tous les scores (dont le score de santé financière) remis à zéro',
                  'Les documents importés (métadonnées)',
                ]
              : [
                  'All envelopes',
                  'All movement history (deposits and withdrawals)',
                  'All calibrations',
                  'Recurring movements (dashboard and simulations)',
                  'Template movements (dashboard and simulations)',
                  'Scheduled movements',
                  'Budget entries',
                  'All simulations',
                  'Your profile (name, age, income)',
                  'Trophies, quests, level and tutorial progress',
                  'All scores (including the financial health score) reset to zero',
                  'Imported documents (metadata)',
                ]
            ).map((line, i) => <li key={i}>{line}</li>)}
          </ul>
          <p className="text-xs text-destructive mt-1 font-medium">
            {lang === 'fr'
              ? 'Le programme repartira totalement à zéro (comme une première installation).'
              : 'The app will start completely fresh (like a first install).'}
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setResetDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                // Ordre : gamification d'abord (profil/trophées/scores/tutoriel),
                // puis fullReset qui persiste l'état vide (données + gamification remise à zéro).
                try { gamificationService.resetState(); } catch (_) {}
                dataService.fullReset();
                setResetDialogOpen(false);
                toast.success(lang === 'fr' ? 'Toutes les données ont été supprimées' : 'All data has been deleted');
                // Rechargement complet pour repartir d'un état vierge (profil, scores, UI).
                setTimeout(() => window.location.reload(), 400);
              }}
              data-testid="confirm-reset-btn"
            >
              {lang === 'fr' ? 'Oui, tout supprimer' : 'Yes, delete everything'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remplacement des données par un fichier importé — voir importData. */}
      <ConfirmDialog
        open={ecrasement.open}
        danger
        title={lang === "en" ? "Replace your current data?" : "Remplacer vos données actuelles ?"}
        description={lang === "en"
          ? "Importing a backup replaces everything currently in Fructificare: envelopes, "
            + "movements, calibrations, objectives.\n\n"
            + "This cannot be undone from here."
          : "Importer une sauvegarde remplace tout ce que contient actuellement Fructificare : "
            + "enveloppes, mouvements, calibrations, objectifs.\n\n"
            + "Cette action ne peut pas être annulée depuis cet écran."}
        confirmLabel={lang === "en" ? "Replace" : "Remplacer"}
        onConfirm={() => { ecrasement.resolve?.(true); setEcrasement({ open: false, resolve: null }); }}
        onCancel={() => { ecrasement.resolve?.(false); setEcrasement({ open: false, resolve: null }); }}
      />
    </div>
  );
}

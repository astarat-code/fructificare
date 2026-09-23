// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import dataService          from "../services/dataService";
import { envTintBg, envTextColor, envMutedTextColor, envGainColor } from "../lib/utils";
import questService         from "../services/questService";
import calendarService      from "../services/calendarService";
import gamificationService  from "../services/gamificationService";
import objectiveService     from "../services/objectiveService";
import { useLanguage } from "../context/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import GlossaryTerm from "../components/ui/GlossaryTerm";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, Plus, Bell, BellRing, Check, Trash2, Edit2,
  ArrowDownLeft, ArrowUpRight, CalendarDays, AlertTriangle,
  RotateCcw, TrendingUp, Wallet, BarChart3, Play, Download, Sparkles, Target,
  StickyNote, Home,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip as RechartTooltip, ResponsiveContainer, Legend } from "recharts";
import RegularMovementsPanel from "../components/RegularMovementsPanel";
import { displayNote } from "../lib/displayNote";

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n ?? 0);

const fmtDate = (iso) =>
  iso ? new Date(iso + "T12:00:00").toLocaleDateString("fr-FR") : "";

const today = () => new Date().toISOString().split("T")[0];

// Day-of-week index with Monday=0
function getDayOfWeek(date) {
  return (date.getDay() + 6) % 7;
}

// Build the 6-week grid of dates for a given year/month (0-indexed month)
function buildCalendarGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const startOffset = getDayOfWeek(firstDay);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const dayNum = i - startOffset + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      cells.push(null);
    } else {
      // Date LOCALE : `new Date(y, m, j)` vaut minuit heure locale, et toISOString()
      // la ramènerait en UTC — la veille en France — décalant toute la grille d'un jour.
      cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`);
    }
  }
  return cells;
}

const BUDGET_CATEGORIES = [
  "salaire", "loyer", "nourriture", "charges", "loisirs", "investissement", "autre",
];

const BUDGET_COLORS = {
  salaire: "#10b981",
  loyer: "#6366f1",
  nourriture: "#f59e0b",
  charges: "#ef4444",
  loisirs: "#8b5cf6",
  investissement: "#0ea5e9",
  autre: "#94a3b8",
};

const PM_FREQUENCIES = ["monthly", "quarterly", "semi_annual", "annual", "once"];

// ─── Calendar note constants ─────────────────────────────────────────────────
const NOTE_COLORS = [
  { value: "#f59e0b", label: "Ambre"    },
  { value: "#10b981", label: "Vert"     },
  { value: "#3b82f6", label: "Bleu"     },
  { value: "#8b5cf6", label: "Violet"   },
  { value: "#ef4444", label: "Rouge"    },
  { value: "#ec4899", label: "Rose"     },
  { value: "#6b7280", label: "Gris"     },
  { value: "#f97316", label: "Orange"   },
];

// ─── Empty form defaults ─────────────────────────────────────────────────────
const emptyReminderForm = () => ({ label: "", date: today(), recurrence: "none" });
const emptyBudgetForm = () => ({ category: "loyer", amount: "", date: today(), custom_label: "", recurrence: "none", kind: "expense" });

// Une entrée budget est un apport (revenu) si kind==='income' ; pour les anciennes
// entrées sans kind, on retombe sur la catégorie « salaire » = revenu.
const isIncomeEntry = (e) => (e.kind ? e.kind === 'income' : e.category === 'salaire');
const emptyNoteForm = () => ({ text: "", color: "#f59e0b" });
const emptyPmForm = () => ({
  portfolio_id: "", type: "deposit", amount: "", fees_pct: "0",
  asset_type: "", note: "", frequency: "monthly", next_date: today(), auto_apply: false,
});

// ─── CalendarPage ────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { t, lang } = useLanguage();
  const L = (fr, en) => (lang === 'en' ? en : fr);
  // Le rappel de calibration automatique est enregistré avec un libellé français fixe.
  const remLabel = (rem) => (rem?.type === 'calibration' ? L('Calibration mensuelle', 'Monthly calibration') : rem?.label);
  const tc = (k, vars) => {
    let s = t(`calendar.${k}`);
    if (vars) Object.entries(vars).forEach(([k2, v]) => { s = s.replace(`{${k2}}`, v); });
    return s;
  };

  // Calendar state
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayDialogOpen, setDayDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("reminders");

  // Data
  const [reminders,          setReminders]          = useState([]);
  const [budgetEntries,      setBudgetEntries]       = useState([]);
  const [programmedMovements,setProgrammedMovements] = useState([]);
  const [regularMovements,   setRegularMovements]    = useState([]);
  const [portfolios,         setPortfolios]          = useState([]);
  const [transactions,       setTransactions]        = useState([]);
  // Sync with monthlyNetIncome from gamification profile (Trophées ↔ Calendar)
  const [profileIncome,      setProfileIncome]       = useState(
    () => gamificationService.getState().profile?.monthlyNetIncome || 0
  );
  // Objectifs personnels (source : gamificationService.state.objectives)
  const [objectives, setObjectives] = useState(
    () => gamificationService.getState().objectives || []
  );

  // Toggle gamification — pour filtrer les événements calendrier en temps réel
  const [gamificationEnabled, setGamificationEnabled] = useState(
    () => gamificationService.getState()?.preferences?.gamificationEnabled !== false
  );

  // Calendar notes
  const [calendarNotes, setCalendarNotes] = useState([]);

  // Note dialog
  const [noteDialogOpen,  setNoteDialogOpen]  = useState(false);
  const [noteForm,        setNoteForm]        = useState(emptyNoteForm());
  const [editingNote,     setEditingNote]     = useState(null); // null = création
  const [noteDeleteConfirm, setNoteDeleteConfirm] = useState(null);

  // Reminder dialog
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState(null);
  const [reminderForm, setReminderForm] = useState(emptyReminderForm());
  const [reminderDeleteConfirm, setReminderDeleteConfirm] = useState(null);

  // Budget dialog
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [budgetForm, setBudgetForm] = useState(emptyBudgetForm());
  const [budgetDeleteConfirm, setBudgetDeleteConfirm] = useState(null);
  const [budgetTab, setBudgetTab] = useState('add'); // 'add' = formulaire · 'history' = historique des mouvements budget

  // Regular movements panel
  const [regularMovementsPanelOpen, setRegularMovementsPanelOpen] = useState(false);

  // Programmed movement dialog (legacy)
  const [pmDialogOpen, setPmDialogOpen] = useState(false);
  const [editingPm, setEditingPm] = useState(null);
  const [pmForm, setPmForm] = useState(emptyPmForm());
  const [pmDeleteConfirm, setPmDeleteConfirm] = useState(null);
  const [pmApplyConfirm, setPmApplyConfirm] = useState(null);

  // ─── Load data ─────────────────────────────────────────────────────────────
  const refresh = useCallback(() => {
    // Sync calibration reminder
    dataService.syncCalibrationReminder();
    // Auto-apply overdue auto_apply movements
    const applied = dataService.checkAndApplyAutoMovements();
    if (applied.length > 0) {
      // Langue lue dans les préférences : ce callback est stable (aucune dépendance).
      toast.success(dataService.getAppPreferences().language === 'en'
        ? `${applied.length} automatic movement(s) applied`
        : `${applied.length} mouvement(s) automatique(s) appliqué(s)`);
    }
    setReminders(dataService.getReminders());
    setBudgetEntries(dataService.getBudgetEntries());
    setProgrammedMovements(dataService.getProgrammedMovements());
    setRegularMovements(dataService.getRegularMovements());
    setCalendarNotes(dataService.getCalendarNotes());
    setPortfolios(dataService.getPortfolios());
    // Collect all transactions for calendar display
    const allTxns = dataService.getPortfolios().flatMap(p =>
      dataService.getTransactions(p.id).map(tx => ({ ...tx, portfolioName: p.name, portfolioColor: p.color }))
    );
    setTransactions(allTxns);
    setProfileIncome(gamificationService.getState().profile?.monthlyNetIncome || 0);
  }, []);

  // Listen for profileUpdated (income saved in Trophées or Settings)
  useEffect(() => {
    const unsub = gamificationService.onEvent('profileUpdated', (profile) => {
      if (profile?.monthlyNetIncome != null) {
        setProfileIncome(profile.monthlyNetIncome);
      }
    });
    return unsub;
  }, []);

  // Synchroniser les objectifs quand ils changent (depuis la page Trophées)
  useEffect(() => {
    const reload = () => setObjectives(gamificationService.getState().objectives || []);
    const unsubs = [
      gamificationService.onEvent('profileUpdated', reload),
      gamificationService.onEvent('objectiveUpdated', reload),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  // Réagir au toggle gamification pour raffraîchir les événements calendrier
  useEffect(() => {
    const unsub = gamificationService.onEvent('preferencesUpdated', (prefs) => {
      setGamificationEnabled(prefs?.gamificationEnabled !== false);
    });
    return unsub;
  }, []);

  // ─── Réagir aux mutations des mouvements récurrents (création / modification / suppression)
  // Recharge regularMovements (→ pmOccurrences + ccMonthOccurrences recomputed → chips + budget),
  // transactions (nouvelles occurrences de mouvements non-CC) et portfolios (soldes mis à jour).
  useEffect(() => {
    const unsub = gamificationService.onEvent('recurringMovementsUpdated', () => {
      setRegularMovements(dataService.getRegularMovements());
      const allTxns = dataService.getPortfolios().flatMap(p =>
        dataService.getTransactions(p.id).map(tx => ({ ...tx, portfolioName: p.name, portfolioColor: p.color }))
      );
      setTransactions(allTxns);
      setPortfolios(dataService.getPortfolios());
    });
    return unsub;
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // ─── Quête Q9 : marquer la vue calendrier comme ouverte
  useEffect(() => {
    questService.trackViewOpened('calendarExpenses');
    // Mission 5 (mai) : ouverture de la page Calendrier
    try { require('../services/challengeService').default.markVisit('visitCalendar'); } catch (_) {}
  }, []);

  // ─── Q13 : onglet Budget visité quand Q13 est la quête active
  useEffect(() => {
    if (activeTab === 'budget') {
      // Mission 5 (mai) : ouverture de la section « Répartition des dépenses » (Budget)
      try { require('../services/challengeService').default.markVisit('viewExpenseBreakdown'); } catch (_) {}
      // Tracker le flag uniquement si Q13 ("Piloter son budget") est la quête en cours
      // idx est 1-based : Q13 est active quand idx === 13
      try {
        const { idx } = questService.getCurrentQuestState();
        if (idx === 13) {
          questService.trackFlag('q12BudgetTabVisited');
        }
      } catch (_) {}
    }
  }, [activeTab]);

  // ─── Calendar grid ─────────────────────────────────────────────────────────
  const grid = useMemo(() => buildCalendarGrid(year, month), [year, month]);

  // Occurrences futures des mouvements réguliers actifs pour le mois affiché
  // (utilisé pour les chips du calendrier et les occurrences non-CC dans la liste budget)
  const pmOccurrences = useMemo(() => {
    return dataService.getRegularMovementOccurrences(14).filter(occ => {
      return occ.occurrence_date.startsWith(
        `${year}-${String(month + 1).padStart(2, "0")}`
      );
    });
  }, [year, month, regularMovements, transactions]); // eslint-disable-line react-hooks/exhaustive-deps

  // TOUTES les occurrences CC du mois consulté (passées + futures).
  // Les occurrences passées ne génèrent pas de transactions (syncRegularMovements skipe
  // compte_cheque), donc elles ne seraient pas visibles autrement dans le budget.
  const ccMonthOccurrences = useMemo(() => {
    return dataService.getRegularMovementOccurrencesForMonth(year, month)
      .filter(occ => occ.portfolio_id === 'compte_cheque');
  }, [year, month, regularMovements]); // eslint-disable-line react-hooks/exhaustive-deps

  // Budget entries for current month
  const monthBudget = useMemo(
    () => dataService.getBudgetEntriesForMonth(year, month),
    [year, month, budgetEntries] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Événements calendrier générés (gamification + fiscaux + portefeuille)
  // gamificationEnabled est inclus dans les deps pour que le filtrage soit immédiat
  // quand l'utilisateur active/désactive la gamification dans les Paramètres.
  const calendarEvents = useMemo(() => {
    try {
      const allEvts = calendarService.generateCalendarEvents(year - 1, year + 2);
      return calendarService.expandToDateMap(allEvts, year, month);
    } catch (_) { return {}; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, gamificationEnabled]);

  // All events keyed by date string
  const eventsByDate = useMemo(() => {
    const map = {};
    const add = (date, evt) => {
      if (!map[date]) map[date] = [];
      map[date].push(evt);
    };
    // Transactions
    transactions.forEach(tx => {
      if (tx.date) add(tx.date, { kind: tx.type, tx });
    });
    // Reminders
    reminders.forEach(rem => {
      if (rem.date) add(rem.date, { kind: "reminder", rem });
    });
    // Programmed occurrences (for displayed month only)
    // • Non-CC : pmOccurrences (occurrences futures seulement, les passées sont déjà
    //   dans les transactions portefeuille)
    // • CC : ccMonthOccurrences (toutes — passées ET futures — car les CC ne génèrent
    //   pas de transactions via syncRegularMovements)
    [
      ...pmOccurrences.filter(occ => occ.portfolio_id !== 'compte_cheque'),
      ...ccMonthOccurrences,
    ].forEach(occ => {
      add(occ.occurrence_date, { kind: "programmed", pm: occ });
    });
    // Budget entries — occurrences du mois affiché (les récurrentes sont déployées jour par jour
    // par getBudgetEntriesForMonth, afin d'apparaître sur chaque jour correspondant du calendrier).
    monthBudget.forEach(be => {
      if (be.date) add(be.date, { kind: "budget", be });
    });
    // Calendar events (gamification, fiscal, portfolio milestones)
    Object.entries(calendarEvents).forEach(([date, evts]) => {
      evts.forEach(ce => add(date, { kind: "calendarEvent", ce }));
    });
    // Objectifs personnels — marqueur à la date cible
    objectives.forEach(obj => {
      if (obj.targetDate) {
        add(obj.targetDate, { kind: "objective", obj });
      }
    });
    // Notes calendrier
    calendarNotes.forEach(note => {
      if (note.date) add(note.date, { kind: "note", note });
    });
    return map;
  }, [transactions, reminders, pmOccurrences, ccMonthOccurrences, monthBudget, calendarEvents, objectives, calendarNotes]);

  // ─── Navigation ───────────────────────────────────────────────────────────
  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };
  const goToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth()); };

  const monthLabel = Array.isArray(t("calendar.months"))
    ? t("calendar.months")[month]
    : ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"][month];

  // ─── Reminder CRUD ────────────────────────────────────────────────────────
  const openAddReminder = (prefillDate) => {
    setEditingReminder(null);
    setReminderForm({ ...emptyReminderForm(), date: prefillDate || today() });
    setReminderDialogOpen(true);
  };
  const openEditReminder = (rem) => {
    setEditingReminder(rem);
    setReminderForm({ label: rem.label, date: rem.date, recurrence: rem.recurrence });
    setReminderDialogOpen(true);
  };
  const saveReminder = () => {
    if (!reminderForm.label.trim()) { toast.error(tc('labelRequired')); return; }
    if (!reminderForm.date) { toast.error(tc('dateRequired')); return; }
    if (editingReminder) {
      dataService.updateReminder(editingReminder.id, reminderForm);
      toast.success(tc('reminderUpdated'));
      // Mise à jour optimiste : pas de rechargement depuis le stockage
      setReminders(prev => prev.map(r =>
        r.id === editingReminder.id ? { ...r, ...reminderForm } : r
      ));
    } else {
      const newRem = dataService.createReminder(reminderForm);
      toast.success(tc('reminderCreated'));
      // Mise à jour optimiste
      setReminders(prev => [...prev, newRem]);
    }
    setReminderDialogOpen(false);
  };
  const handleDismissReminder = (id) => {
    dataService.dismissReminder(id);
    toast.success(tc('reminderDismissed'));
    refresh();
  };
  const handleDeleteReminder = (id) => {
    dataService.deleteReminder(id);
    setReminderDeleteConfirm(null);
    toast.success(tc('reminderDeleted'));
    refresh();
  };

  // ─── Budget CRUD ──────────────────────────────────────────────────────────
  const openAddBudget = (prefillDate) => {
    setEditingBudget(null);
    setBudgetForm({ ...emptyBudgetForm(), date: prefillDate || today() });
    setBudgetTab('add');
    setBudgetDialogOpen(true);
  };
  const openEditBudget = (be) => {
    setBudgetTab('add'); // l'édition se fait dans l'onglet formulaire
    setEditingBudget(be);
    setBudgetForm({
      category: be.category,
      amount: String(be.amount),
      date: be.date,
      custom_label: be.custom_label || "",
      recurrence: be.recurrence || "none",
      kind: isIncomeEntry(be) ? 'income' : 'expense',
    });
    setBudgetDialogOpen(true);
  };
  // kind : 'expense' (bouton Dépenses) ou 'income' (bouton Apports)
  const saveBudget = (kind) => {
    const amt = parseFloat(String(budgetForm.amount).replace(',', '.'));
    if (!amt || amt <= 0) { toast.error(tc('amountInvalid')); return; }
    if (!budgetForm.date) { toast.error(tc('dateRequired')); return; }

    const payload = {
      category:     budgetForm.category,
      custom_label: budgetForm.category === 'autre' ? (budgetForm.custom_label || null) : null,
      amount:       amt,
      date:         budgetForm.date,
      kind,
      recurrence:   budgetForm.recurrence || 'none',
    };

    // Mise à jour directe de l'état local (liste, camembert, capacité au même render).
    if (editingBudget) {
      dataService.updateBudgetEntry(editingBudget.id, payload);
      toast.success(tc('entryUpdated'));
      setBudgetEntries(prev => prev.map(e => e.id === editingBudget.id ? { ...e, ...payload } : e));
    } else {
      const newEntry = dataService.createBudgetEntry(payload);
      toast.success(tc('entryAdded'));
      setBudgetEntries(prev => [...prev, newEntry]);
    }

    // Apport de catégorie « salaire » → synchronise le revenu mensuel du profil (Calendrier → Trophées)
    if (kind === 'income' && budgetForm.category === 'salaire') {
      const gState = gamificationService.getState();
      gamificationService.patchState({
        profile: { ...(gState.profile || {}), monthlyNetIncome: amt, incomeUpdatedAt: new Date().toISOString() },
      });
      setProfileIncome(amt);
    }
    setBudgetDialogOpen(false);
  };
  const handleDeleteBudget = (id) => {
    dataService.deleteBudgetEntry(id);
    setBudgetDeleteConfirm(null);
    toast.success(tc('entryDeleted'));
    // Mise à jour directe : pas de rechargement depuis le stockage
    setBudgetEntries(prev => prev.filter(e => e.id !== id));
  };

  // ─── Calendar note CRUD ───────────────────────────────────────────────────
  const openAddNote = (prefillDate) => {
    setEditingNote(null);
    setNoteForm({ ...emptyNoteForm(), _date: prefillDate || selectedDay || today() });
    setNoteDialogOpen(true);
  };
  const openEditNote = (note) => {
    setEditingNote(note);
    setNoteForm({ text: note.text, color: note.color, _date: note.date });
    setNoteDialogOpen(true);
  };
  const saveNote = () => {
    if (!noteForm.text.trim()) { toast.error(L('Le texte de la note est requis.', 'Note text is required.')); return; }
    if (editingNote) {
      dataService.updateCalendarNote(editingNote.id, { text: noteForm.text, color: noteForm.color });
      toast.success(L('Note modifiée', 'Note updated'));
      setCalendarNotes(prev => prev.map(n =>
        n.id === editingNote.id ? { ...n, text: noteForm.text, color: noteForm.color } : n
      ));
    } else {
      const newNote = dataService.createCalendarNote({ date: noteForm._date, text: noteForm.text, color: noteForm.color });
      toast.success(L('Note ajoutée', 'Note added'));
      setCalendarNotes(prev => [...prev, newNote]);
    }
    setNoteDialogOpen(false);
    // Fermer le dialog journée uniquement lors d'une création (pas d'une édition),
    // pour que l'utilisateur retrouve la liste des événements après une modification.
    if (!editingNote) setDayDialogOpen(false);
  };
  const handleDeleteNote = (id) => {
    dataService.deleteCalendarNote(id);
    setNoteDeleteConfirm(null);
    toast.success(L('Note supprimée', 'Note deleted'));
    setCalendarNotes(prev => prev.filter(n => n.id !== id));
  };

  // ─── Programmed movement CRUD ─────────────────────────────────────────────
  const openAddPm = () => {
    setEditingPm(null);
    setPmForm({ ...emptyPmForm(), portfolio_id: portfolios[0]?.id || "" });
    setPmDialogOpen(true);
  };
  const openEditPm = (pm) => {
    setEditingPm(pm);
    setPmForm({
      portfolio_id: pm.portfolio_id, type: pm.type, amount: String(pm.amount),
      fees_pct: String(pm.fees_pct || 0), asset_type: pm.asset_type || "",
      note: pm.note || "", frequency: pm.frequency, next_date: pm.next_date,
      auto_apply: pm.auto_apply,
    });
    setPmDialogOpen(true);
  };
  const savePm = () => {
    if (!pmForm.portfolio_id) { toast.error(tc('portfolioRequired')); return; }
    const amt = parseFloat(pmForm.amount);
    if (!amt || amt <= 0) { toast.error(tc('amountInvalid')); return; }
    if (!pmForm.next_date) { toast.error(tc('dateRequired')); return; }
    const data = { ...pmForm, amount: amt, fees_pct: parseFloat(pmForm.fees_pct) || 0 };
    if (editingPm) {
      dataService.updateProgrammedMovement(editingPm.id, data);
      toast.success(tc('pmUpdated'));
    } else {
      dataService.createProgrammedMovement(data);
      toast.success(tc('pmCreated'));
    }
    setPmDialogOpen(false);
    refresh();
  };
  const handleDeletePm = (id) => {
    dataService.deleteProgrammedMovement(id);
    setPmDeleteConfirm(null);
    toast.success(tc('pmDeleted'));
    refresh();
  };
  const handleApplyPm = (id) => {
    try {
      dataService.applyProgrammedMovement(id);
      toast.success(tc('pmApplied'));
      setPmApplyConfirm(null);
      refresh();
    } catch (e) { toast.error(e.message); }
  };

  // ─── Budget analytics ─────────────────────────────────────────────────────
  const budgetAnalytics = useMemo(() => {
    const now = new Date();
    const todayStrLocal  = now.toISOString().split('T')[0];
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

    const byCategory = {};       // DÉPENSES uniquement (camembert)
    let incomeTotal = 0;          // APPORTS (revenus) → capacité, hors camembert
    let hasSalaireEntry = false;
    monthBudget.forEach(e => {
      if (isIncomeEntry(e)) {
        incomeTotal += e.amount || 0;
        if (e.category === 'salaire') hasSalaireEntry = true;
      } else {
        byCategory[e.category] = (byCategory[e.category] || 0) + (e.amount || 0);
      }
    });
    // Add investment movements from dashboard transactions for this month
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    const investedFromTx = transactions
      .filter(tx => tx.type === "deposit" && tx.date.startsWith(prefix))
      .reduce((s, tx) => s + (tx.net_amount || tx.amount || 0), 0);
    byCategory.investissement = (byCategory.investissement || 0) + investedFromTx;

    // Compte chèque deposits → boost monthly income base (not shown as pie slice)
    // Compte chèque withdrawals → each as its own labeled slice (label = note or "Autre")
    // Current month: only count occurrences up to today (confirmed expenses)
    // Future months: count all scheduled occurrences
    // Uses ccMonthOccurrences (all month occurrences, past + future) so that past
    // occurrences of the current month are not silently dropped.
    ccMonthOccurrences
      .filter(occ => !isCurrentMonth || occ.occurrence_date <= todayStrLocal)
      .forEach(occ => {
        if (occ.type === 'deposit') {
          incomeTotal += (occ.amount || 0); // apport CC → capacité
        } else {
          const sliceKey = occ.note?.trim() || 'Autre';
          byCategory[sliceKey] = (byCategory[sliceKey] || 0) + (occ.amount || 0);
        }
      });

    // Capacité du mois = apports (salaire + autres revenus) ; le salaire du profil
    // sert de base si aucune entrée « salaire » explicite n'est saisie.
    const salary        = incomeTotal + (hasSalaireEntry ? 0 : (profileIncome || 0));
    const totalInvested = byCategory.investissement || 0;
    const ratio         = salary > 0 ? Math.round((totalInvested / salary) * 100) : null;

    // Pie : dépenses uniquement (les apports n'y figurent pas)
    const pieData = Object.entries(byCategory)
      .filter(([cat, v]) => v > 0)
      .map(([cat, v]) => ({ name: cat, value: Math.round(v * 100) / 100 }));

    const totalExpenses = pieData.reduce((s, d) => s + d.value, 0);

    // Déficit : seulement pour le mois en cours (les mois futurs ont des données incomplètes)
    const deficit = salary > 0 && totalExpenses > salary && isCurrentMonth
      ? Math.round((totalExpenses - salary) * 100) / 100
      : null;

    return { byCategory, salary, totalInvested, ratio, pieData, totalExpenses, deficit, isCurrentMonth };
  }, [monthBudget, transactions, year, month, profileIncome, ccMonthOccurrences]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Liste exhaustive de tous les mouvements du mois ──────────────────────
  // Inclut : entrées budget, transactions portefeuille, occurrences régulières.
  const allMonthMovements = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    const list = [];

    // 1. Entrées budget manuelles (dépenses + apports). Pour une occurrence récurrente,
    //    on rattache l'édition/suppression à l'entrée de base.
    monthBudget.forEach(be => {
      const inc  = isIncomeEntry(be);
      const base = be._base_id ? (budgetEntries.find(x => x.id === be._base_id) || be) : be;
      const isRec = (be.recurrence && be.recurrence !== 'none') || be._recurring;
      list.push({
        id:         'b_' + be.id,
        date:       be.date,
        category:   be.category,
        customLabel: be.custom_label || '',
        type:       inc ? tc('income') : tc('expense'),
        amount:     be.amount,
        isPositive: inc,
        note:       isRec ? '↻' : null,
        source:     'budget',
        _be:        base,
      });
    });

    // 2. Transactions portefeuilles (mouvements importés du tableau de bord)
    transactions
      .filter(tx => tx.date && tx.date.startsWith(prefix))
      .forEach(tx => {
        const isDeposit = tx.type === 'deposit';
        list.push({
          id:          't_' + tx.id,
          date:        tx.date,
          category:    null,
          customLabel: tx.portfolioName || '?',
          type:        isDeposit ? L('Versement', 'Deposit') : L('Retrait', 'Withdrawal'),
          amount:      tx.net_amount || tx.amount || 0,
          isPositive:  isDeposit,
          note:        tx.note || null,
          source:      'transaction',
          color:       portfolios.find(p => p.id === tx.portfolio_id)?.color || null,
        });
      });

    // 3. Occurrences de mouvements réguliers tombant dans ce mois
    // • CC : ccMonthOccurrences (toutes dates — passées ET futures — car les CC ne génèrent
    //        pas de transactions via syncRegularMovements)
    // • Non-CC : pmOccurrences filtrés non-CC (futures seulement, les passées sont déjà
    //        dans les transactions portfeuille de la section 2)
    const todayStr    = new Date().toISOString().split('T')[0];
    const regularOccs = [
      ...ccMonthOccurrences,
      ...pmOccurrences.filter(occ => occ.portfolio_id !== 'compte_cheque'),
    ];
    regularOccs.forEach(occ => {
      const isCompteChq = occ.portfolio_id === 'compte_cheque';
      const port        = isCompteChq ? null : portfolios.find(p => p.id === occ.portfolio_id);
      const noteLabel   = occ.note?.trim() || null;
      const portLabel   = isCompteChq
        ? (noteLabel || 'Autre')
        : (port?.name || '?');
      const isDeposit   = occ.type === 'deposit';
      const isFuture    = occ.occurrence_date > todayStr;
      list.push({
        id:          'r_' + occ.id + '_' + occ.occurrence_date,
        date:        occ.occurrence_date,
        category:    null,
        customLabel: isCompteChq
          ? `${portLabel} — 🏠 Compte chèque`
          : `🔄 ${noteLabel || portLabel}`,
        type:        isDeposit ? tc('income') : tc('expense'),
        amount:      occ.amount,
        isPositive:  isDeposit,
        note:        occ.note || null,
        source:      isCompteChq ? 'cc_regular' : 'regular',
        color:       isCompteChq ? null : (port?.color || null),
        isFuture,
        isCompteChq,
      });
    });

    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [monthBudget, transactions, pmOccurrences, ccMonthOccurrences, portfolios, year, month, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Overdue reminders ────────────────────────────────────────────────────
  const overdueReminders = useMemo(
    () => reminders.filter(r => r.date < today()),
    [reminders]
  );

  // ─── Day dialog events ────────────────────────────────────────────────────
  // ─── Regroupement multi-actifs : un mouvement logique = un seul événement ───
  // Les sous-transactions d'un mouvement multi-actifs partagent movement_group_id
  // (ou, pour les données antérieures, même enveloppe/date/type/note). On les fusionne
  // en un seul chip avec la répartition affichée en note compacte.
  const groupEvents = (evts) => {
    const groups = new Map();
    const out = [];
    for (const e of evts) {
      if (e.kind === "deposit" || e.kind === "withdrawal") {
        const tx = e.tx;
        const key = tx.movement_group_id
          ? `g:${tx.movement_group_id}`
          : `h:${tx.portfolio_id}|${tx.date}|${tx.type}|${(tx.note || '').replace(/^\[Mouvement récurrent\]\s*/, '').trim()}`;
        let g = groups.get(key);
        if (!g) { g = { kind: "movement", type: tx.type, txs: [] }; groups.set(key, g); out.push(g); }
        g.txs.push(tx);
      } else {
        out.push(e);
      }
    }
    return out;
  };

  const assetLabel = (type) => {
    if (!type) return "—";
    const lbl = t(`assetTypes.${type}`);
    return lbl && !lbl.startsWith("assetTypes.") ? lbl : type;
  };

  // Récap d'un mouvement groupé : nom, couleur de l'enveloppe, total, répartition multi-actifs.
  const movementInfo = (g) => {
    const first = g.txs[0] || {};
    const isDeposit = g.type === "deposit";
    const amtOf = (tx) => isDeposit ? (tx.net_amount ?? tx.amount ?? 0) : (tx.amount ?? 0);
    const total = g.txs.reduce((s, tx) => s + amtOf(tx), 0);
    const color = first.portfolioColor || (isDeposit ? "#10b981" : "#ef4444");
    const name = (first.note && first.note.replace(/^\[Mouvement récurrent\]\s*/, '').trim())
      || first.portfolioName || "Mouvement";
    const allocations = g.txs.length > 1
      ? g.txs.map(tx => ({ label: assetLabel(tx.asset_type), amount: amtOf(tx) }))
      : [];
    const breakdown = (allocations.length && total > 0)
      ? allocations.map(a => `${Math.round(a.amount / total * 100)}% ${a.label}`).join(' / ')
      : null;
    return { isDeposit, total, color, name, allocations, breakdown };
  };

  const selectedDayEvents = selectedDay ? groupEvents(eventsByDate[selectedDay] || []) : [];

  // ─── Chip rendering helpers ───────────────────────────────────────────────
  // Chip = petit rectangle arrondi lisible (texte tronqué), remplace les pastilles.
  const Chip = ({ bg, color = "#ffffff", title, children }) => (
    <span
      title={title}
      className="block w-full truncate rounded px-1.5 py-0.5 text-[9px] font-medium leading-tight"
      style={{ backgroundColor: bg, color }}
    >
      {children}
    </span>
  );

  // Couleurs des événements Fructificare (calibration & défi en ambre)
  const CALENDAR_EVENT_COLORS = {
    fiscal:      '#f97316',
    calibration: '#f59e0b',
    streak:      '#ef4444',
    challenge:   '#f59e0b',
    review:      '#6366f1',
    portfolio:   '#14b8a6',
  };

  const EventChip = ({ evt }) => {
    if (evt.kind === "movement") {
      const { isDeposit, total, color, name, breakdown } = movementInfo(evt);
      const sign = isDeposit ? '+' : '−';
      const title = `${name} : ${sign}${fmt(total)}${breakdown ? ` · ${breakdown}` : ''}`;
      return <Chip bg={color} title={title}>{name} {sign}{fmt(total)}</Chip>;
    }
    if (evt.kind === "reminder") {
      const isDone = (evt.rem.dismissed_dates || []).includes(evt.rem.date);
      const isOverdue = !isDone && evt.rem.date < today();
      const bg = isDone ? '#9ca3af' : isOverdue ? '#ef4444' : '#f59e0b';
      return <Chip bg={bg} title={isDone ? `✓ ${remLabel(evt.rem)}` : remLabel(evt.rem)}>{isDone ? '✓ ' : ''}{remLabel(evt.rem)}</Chip>;
    }
    if (evt.kind === "programmed") {
      const isCC = evt.pm.portfolio_id === 'compte_cheque';
      const isDeposit = evt.pm.type === 'deposit';
      const envColor = !isCC ? (portfolios.find(p => p.id === evt.pm.portfolio_id)?.color || null) : null;
      const bg = envColor || (isCC ? (isDeposit ? '#10b981' : '#f97316') : (isDeposit ? '#10b981' : '#ef4444'));
      const label = (evt.pm.note?.trim()) || (isCC ? L('Compte chèque', 'Current account') : L('Programmé', 'Scheduled'));
      const sign = isDeposit ? '+' : '−';
      return <Chip bg={bg} title={`${label} : ${sign}${fmt(evt.pm.amount)}`}>{label} {sign}{fmt(evt.pm.amount)}</Chip>;
    }
    if (evt.kind === "budget") {
      const bg = BUDGET_COLORS[evt.be.category] || '#a855f7';
      const label = catLabel(evt.be.category);
      return <Chip bg={bg} title={`${label} : ${fmt(evt.be.amount)}`}>{label} {fmt(evt.be.amount)}</Chip>;
    }
    if (evt.kind === "calendarEvent") {
      const bg = CALENDAR_EVENT_COLORS[evt.ce.category] || '#6b7280';
      return <Chip bg={bg} title={evt.ce.title}>{evt.ce.title}</Chip>;
    }
    if (evt.kind === "note") {
      const preview = evt.note.text.length > 20 ? evt.note.text.slice(0, 20) + '…' : evt.note.text;
      return <Chip bg={evt.note.color} color="#1f2937" title={`📝 ${evt.note.text}`}>📝 {preview}</Chip>;
    }
    if (evt.kind === "objective") {
      const label = evt.obj.label || '';
      let progress = null;
      try { progress = objectiveService.getObjectiveProgress(evt.obj); } catch (_) {}
      const pct = progress ? Math.min(100, Math.round(progress.progressPercent || 0)) : 0;
      const titleText = progress
        ? `🎯 ${label}\n${fmt(progress.currentAmount)} / ${fmt(progress.targetAmount)} — ${pct}%`
        : `🎯 ${label}`;
      return <Chip bg="#8b5cf6" title={titleText}>🎯 {label}</Chip>;
    }
    return null;
  };

  const catLabel = (cat) => {
    const map = { salaire: tc("catSalaire"), loyer: tc("catLoyer"), nourriture: tc("catNourriture"), charges: tc("catCharges"), loisirs: tc("catLoisirs"), investissement: tc("catInvestissement"), autre: tc("catAutre") };
    return map[cat] || cat;
  };

  const freqLabel = (freq) => {
    const map = { monthly: tc("freqMonthly"), quarterly: tc("freqQuarterly"), semi_annual: tc("freqSemiAnnual"), annual: tc("freqAnnual"), once: tc("freqOnce") };
    return map[freq] || freq;
  };

  const ratioLabel = (ratio) => {
    if (ratio === null) return tc("ratioNone");
    if (ratio >= 30) return tc("ratioExcellent");
    if (ratio >= 20) return tc("ratioGood");
    if (ratio >= 10) return tc("ratioOk");
    return tc("ratioLow");
  };

  const todayStr = today();

  // ─── §5/§6 — Rappels curatés : défi du mois en tête + rappels spécifiques au mois ──
  // Dérivé du mois RÉEL courant → les rappels d'un mois passé disparaissent automatiquement
  // (aucune accumulation), et le défi du mois apparaît toujours en premier.
  const monthCurated = (() => {
    const items = [];
    const realNow = new Date();
    const realPrefix = `${realNow.getFullYear()}-${String(realNow.getMonth() + 1).padStart(2, '0')}`;
    if (gamificationEnabled) {
      try {
        const ch = require('../services/challengeService').default.getCurrentChallenge();
        if (ch) items.push({
          id: 'challenge', kind: 'challenge', color: '#f59e0b',
          label: (lang === 'en' ? ch.titleEn : ch.titleFr) || L('Défi du mois', 'Monthly challenge'), period: L('Ce mois-ci', 'This month'), done: !!ch.isCompleted,
        });
      } catch (_) {}
    }
    try {
      const evts = calendarService.generateCalendarEvents(realNow.getFullYear(), realNow.getFullYear());
      evts
        .filter(e => e.date && e.date.startsWith(realPrefix) && !e.autoHide
          && ['fiscal', 'review', 'calibration'].includes(e.category))
        .sort((a, b) => a.date.localeCompare(b.date))
        .forEach(e => items.push({
          id: e.id, kind: e.category, color: CALENDAR_EVENT_COLORS[e.category] || '#6366f1',
          label: e.title, period: fmtDate(e.date), done: false,
        }));
    } catch (_) {}
    return items;
  })();

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight">{tc("title")}</h1>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs shrink-0"
          onClick={() => {
            try {
              calendarService.exportToICS();
              toast.success(L('Calendrier exporté (.ics)', 'Calendar exported (.ics)'));
            } catch (e) {
              toast.error(L('Erreur export calendrier', 'Calendar export error'));
            }
          }}
          title={L('Exporter le calendrier Fructificare vers votre agenda (.ics)', 'Export the Fructificare calendar to your agenda (.ics)')}
        >
          <Download className="w-3.5 h-3.5" />
          {L('Exporter .ics', 'Export .ics')}
        </Button>
      </div>

      {/* ── Overdue reminders banner ── */}
      {overdueReminders.length > 0 && (
        <Card className="border-red-500/40 bg-red-50/60 dark:bg-red-950/20">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-red-700 dark:text-red-300 text-sm mb-1">{tc("overdueReminders")} ({overdueReminders.length})</p>
              <div className="flex flex-wrap gap-2">
                {overdueReminders.map(rem => (
                  <div key={rem.id} className="flex items-center gap-1.5 bg-white dark:bg-card rounded-md px-2 py-1 border border-red-200/60 text-xs">
                    <BellRing className="w-3 h-3 text-red-500" />
                    <span className="font-medium">{remLabel(rem)}</span>
                    <span className="text-muted-foreground">({fmtDate(rem.date)})</span>
                    <button onClick={() => handleDismissReminder(rem.id)} className="ml-1 text-emerald-600 hover:text-emerald-700" title={tc("dismissReminder")}>
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Calendar card ── */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-2">
          {/* Month navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={prevMonth} title={tc("prevMonth")}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h2 className="font-heading font-bold text-xl min-w-[200px] text-center capitalize">
                {monthLabel} {year}
              </h2>
              <Button variant="ghost" size="icon" onClick={nextMonth} title={tc("nextMonth")}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToday}>
                <CalendarDays className="w-3.5 h-3.5 mr-1.5" />{tc("today")}
              </Button>
              {/* Year jump */}
              <Input
                type="number"
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                className="w-20 h-8 text-sm text-center"
                min={2000} max={2100}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {L(["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"], ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]).map(d => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {d}
              </div>
            ))}
          </div>
          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {grid.map((dateStr, idx) => {
              const isToday = dateStr === todayStr;
              const isCurrentMonth = dateStr !== null;
              const events = dateStr ? groupEvents(eventsByDate[dateStr] || []) : [];
              const maxChips = 3;
              const overflow = events.length > maxChips ? events.length - maxChips : 0;
              return (
                <div
                  key={idx}
                  onClick={() => { if (dateStr) { setSelectedDay(dateStr); setDayDialogOpen(true); } }}
                  className={`min-h-[90px] p-1.5 border-b border-r border-border/50 transition-colors
                    ${isCurrentMonth ? "cursor-pointer hover:bg-accent/50" : "bg-muted/20"}
                    ${isToday ? "bg-primary/8 ring-1 ring-inset ring-primary/30" : ""}
                  `}
                >
                  {dateStr && (
                    <>
                      <span className={`text-xs font-semibold leading-none mb-1 inline-flex items-center justify-center w-6 h-6 rounded-full
                        ${isToday ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
                        {new Date(dateStr + "T12:00:00").getDate()}
                      </span>
                      <div className="flex flex-col gap-0.5 mt-0.5">
                        {events.slice(0, maxChips).map((evt, ei) => (
                          <EventChip key={ei} evt={evt} />
                        ))}
                        {overflow > 0 && (
                          <span className="block text-[9px] font-medium text-muted-foreground pl-0.5">
                            +{overflow}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-t border-border/50 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />{tc("depositEvent")}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" />{tc("withdrawalEvent")}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />{L('Rappel', 'Reminder')}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />{tc("programmedEvent")}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-purple-500 inline-block" />{L('Budget', 'Budget')}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" />{L('Événement Fructificare', 'Fructificare event')}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-violet-500 inline-block" />{L('Objectif', 'Goal')}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block ring-1 ring-white dark:ring-card" />{L('Note', 'Note')}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block" />{L('Compte chèque', 'Current account')}</span>
          </div>
        </CardContent>
      </Card>

      {/* ── Pillars tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="reminders" className="flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5" />{tc("tabReminders")}
            {reminders.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{reminders.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="movements" className="flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" />{tc("tabMovements")}
            {regularMovements.filter(rm => (rm.status === 'active' && (!rm.end_date || rm.end_date >= todayStr))).length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                {regularMovements.filter(rm => (rm.status === 'active' && (!rm.end_date || rm.end_date >= todayStr))).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="budget" className="flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />{tc("tabBudget")}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Reminders ── */}
        <TabsContent value="reminders" className="mt-4">
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="font-heading text-lg flex items-center gap-2">
                  <Bell className="w-5 h-5 text-amber-500" />{tc("tabReminders")}
                </CardTitle>
                <Button size="sm" onClick={openAddReminder} className="gap-1.5">
                  <Plus className="w-4 h-4" />{tc("addReminder")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* §5/§6 — Défi du mois (toujours en tête) + rappels spécifiques au mois courant */}
              {monthCurated.length > 0 && (
                <div className="space-y-2 mb-3">
                  {monthCurated.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border border-l-4 border-border bg-card" style={{ borderLeftColor: item.color }}>
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} aria-hidden="true" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-medium text-sm ${item.done ? 'line-through text-muted-foreground' : ''}`}>{item.label}</span>
                          {item.kind === 'challenge' && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{L('Défi du mois', 'Monthly challenge')}</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{item.period}</div>
                      </div>
                      <Badge variant="outline" className={`text-[10px] ${item.done ? 'text-emerald-600 border-emerald-400' : 'text-muted-foreground'}`}>
                        {item.done ? L('Fait', 'Done') : L('À venir', 'Upcoming')}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
              {reminders.length === 0 ? (
                monthCurated.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">{tc("addReminder")} pour commencer</p>
                ) : null
              ) : (
                <div className="space-y-2">
                  {reminders.map(rem => {
                    // « Fait » : l'occurrence courante du rappel a été validée (✓)
                    const isDone = (rem.dismissed_dates || []).includes(rem.date);
                    const isOverdue = !isDone && rem.date < todayStr;
                    const isAuto = rem.type === "calibration";
                    return (
                      <div key={rem.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors
                        ${isDone ? "border-border bg-muted/30 opacity-50" : isOverdue ? "border-red-300/60 bg-red-50/40 dark:bg-red-950/20" : "border-border bg-card"}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                          ${isDone ? "bg-muted" : isOverdue ? "bg-red-100 dark:bg-red-900/30" : "bg-amber-100 dark:bg-amber-900/30"}`}>
                          {isAuto ? <RotateCcw className={`w-4 h-4 ${isDone ? 'text-muted-foreground' : 'text-amber-600'}`} /> : <Bell className={`w-4 h-4 ${isDone ? 'text-muted-foreground' : 'text-amber-600'}`} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-medium text-sm ${isDone ? 'line-through text-muted-foreground' : ''}`}>{remLabel(rem)}</span>
                            {isAuto && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{tc("calReminderAuto")}</Badge>}
                            {isDone && <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-emerald-600 border-emerald-400">{L('Fait', 'Done')}</Badge>}
                            {isOverdue && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{L('En retard', 'Overdue')}</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {fmtDate(rem.date)} · {rem.recurrence !== "none" ? `${L('Récurrence :', 'Recurrence:')} ${rem.recurrence === "monthly" ? tc("recurrenceMonthly") : tc("recurrenceYearly")}` : L("Unique", "One-off")}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {!isDone && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:text-emerald-700" onClick={() => handleDismissReminder(rem.id)} title={tc("dismissReminder")}>
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                          {!isAuto && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditReminder(rem)}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          )}
                          {reminderDeleteConfirm === rem.id ? (
                            <div className="flex items-center gap-1">
                              <Button variant="destructive" size="sm" className="h-7 text-xs px-2" onClick={() => handleDeleteReminder(rem.id)}>Confirmer</Button>
                              <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setReminderDeleteConfirm(null)}>Annuler</Button>
                            </div>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 hover:text-destructive" onClick={() => setReminderDeleteConfirm(rem.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 2: Mouvements réguliers actifs ── */}
        <TabsContent value="movements" className="mt-4">
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="font-heading text-lg flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-blue-500" />
                  <GlossaryTerm id="mouvement">{L('Mouvements réguliers', 'Regular movements')}</GlossaryTerm>
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setRegularMovementsPanelOpen(true)}
                  disabled={portfolios.length === 0}
                >
                  <RotateCcw className="w-4 h-4" />
                  {L('Gérer', 'Manage')}
                </Button>
              </div>
              {portfolios.length === 0 && (
                <CardDescription className="text-amber-600 dark:text-amber-400 flex items-center gap-1 text-xs mt-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> {L("Créez d'abord une enveloppe depuis le tableau de bord", 'First create an envelope from the dashboard')}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {regularMovements.filter(rm => (rm.status === 'active' && (!rm.end_date || rm.end_date >= todayStr))).length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <p>{L('Aucun mouvement régulier actif.', 'No active regular movement.')}</p>
                  <Button
                    variant="link"
                    className="mt-1 text-sm"
                    onClick={() => setRegularMovementsPanelOpen(true)}
                    disabled={portfolios.length === 0}
                  >
                    {L('Créer un mouvement régulier', 'Create a regular movement')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {regularMovements
                    .filter(rm => (rm.status === 'active' && (!rm.end_date || rm.end_date >= todayStr)))
                    .sort((a, b) => a.start_date.localeCompare(b.start_date))
                    .map(rm => {
                      const portfolio = portfolios.find(p => p.id === rm.portfolio_id);
                      const isDeposit = rm.type === 'deposit';
                      const RECURRENCE_LABELS = {
                        monthly: L('Mensuelle', 'Monthly'), quarterly: L('Trimestrielle', 'Quarterly'),
                        semi_annual: L('Semestrielle', 'Semi-annual'), annual: L('Annuelle', 'Annual'),
                      };
                      // Libellé principal : note pour CC, nom enveloppe sinon
                      const rmLabel = rm.portfolio_id === 'compte_cheque'
                        ? (rm.note?.trim() || L('Autre', 'Other'))
                        : (portfolio?.name || '?');

                      return (
                        <div
                          key={rm.id}
                          className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card transition-colors"
                          style={{ backgroundColor: envTintBg(portfolio?.color), color: envTextColor(portfolio?.color) }}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                            ${isDeposit ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                            {isDeposit
                              ? <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                              : <ArrowUpRight  className="w-4 h-4 text-red-600" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{rmLabel}</span>
                              <span className={`font-semibold text-sm ${isDeposit ? 'text-emerald-600' : 'text-red-600'}`}>
                                {isDeposit ? '+' : '-'}{fmt(rm.amount)}
                              </span>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {RECURRENCE_LABELS[rm.recurrence] || rm.recurrence}
                              </Badge>
                            </div>
                            <div className="text-xs mt-0.5" style={{ color: envMutedTextColor(portfolio?.color) }}>
                              {L('Depuis le', 'Since')} {fmtDate(rm.start_date)}
                              {rm.end_date ? ` · ${L("Jusqu'au", 'Until')} ${fmtDate(rm.end_date)}` : ` · ${L('En cours', 'Ongoing')}`}
                              {rm.note && ` · ${rm.note}`}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 flex-shrink-0"
                            onClick={() => setRegularMovementsPanelOpen(true)}
                            title={L('Modifier dans le gestionnaire', 'Edit in the manager')}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 3: Budget ── */}
        <TabsContent value="budget" className="mt-4">
          <div className="space-y-4">
            {/* Investment ratio highlight */}
            {budgetAnalytics.salary > 0 && (
              <Card className={`border shadow-sm ${budgetAnalytics.ratio >= 20 ? "border-emerald-400/50 bg-emerald-50/40 dark:bg-emerald-950/20" : "border-amber-400/50 bg-amber-50/40 dark:bg-amber-950/20"}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${budgetAnalytics.ratio >= 20 ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-amber-100 dark:bg-amber-900/30"}`}>
                    <TrendingUp className={`w-6 h-6 ${budgetAnalytics.ratio >= 20 ? "text-emerald-600" : "text-amber-600"}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className={`text-3xl font-bold font-heading ${budgetAnalytics.ratio >= 20 ? "text-emerald-600" : "text-amber-600"}`}>
                        {budgetAnalytics.ratio ?? 0}%
                      </span>
                      <span className="text-sm text-muted-foreground">{tc("investmentRatio")}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {tc("investmentRatioLabel", { pct: budgetAnalytics.ratio ?? 0 })} · {ratioLabel(budgetAnalytics.ratio)}
                    </p>
                    <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                      <span>{L('Salaire :', 'Salary:')} {fmt(budgetAnalytics.salary)}</span>
                      <span>{L('Investi :', 'Invested:')} {fmt(budgetAnalytics.totalInvested)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* ── Liste exhaustive de tous les mouvements du mois ── */}
              <Card className="border border-border shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-heading text-base flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-purple-500" />
                      {monthLabel} {year}
                    </CardTitle>
                    <Button size="sm" variant="outline" onClick={() => openAddBudget()} className="gap-1 h-8 text-xs">
                      <Plus className="w-3.5 h-3.5" />{tc("addBudgetEntry")}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="px-3">
                  {allMonthMovements.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">{L('Aucun mouvement ce mois-ci', 'No movement this month')}</p>
                  ) : (
                    <div className="space-y-0.5">
                      {allMonthMovements.map((item) => {
                        const isPast   = item.date < todayStr;
                        const isToday  = item.date === todayStr;
                        /* Label affiché : catégorie traduite pour les entrées budget, nom enveloppe sinon */
                        const label = item.category
                          ? catLabel(item.category) + (item.customLabel ? ` — ${item.customLabel}` : '')
                          : item.customLabel;
                        /* Couleur de la pastille selon la source */
                        const dotColor = item.category
                          ? (BUDGET_COLORS[item.category] || '#94a3b8')
                          : item.color
                            ? item.color // entrée d'investissement → couleur de l'enveloppe
                            : item.source === 'transaction'
                              ? (item.isPositive ? '#10b981' : '#ef4444')
                              : item.source === 'cc_regular'
                                ? (item.isPositive ? '#10b981' : '#f97316') // orange pour retrait CC
                                : '#3b82f6'; // regular non-CC → bleu
                        /* Badge de type */
                        const badgeCls = item.source === 'budget'
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                          : item.source === 'transaction'
                            ? (item.isPositive
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300')
                            : item.source === 'cc_regular'
                              ? (item.isPositive
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300')
                              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
                        return (
                          <div
                            key={item.id}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm group
                              ${isPast  ? 'opacity-55' : ''}
                              ${item.isFuture ? 'opacity-60' : ''}
                              ${isToday ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : 'hover:bg-accent/30'}
                            `}
                            style={{ backgroundColor: envTintBg(item.color), color: envTextColor(item.color) }}
                          >
                            {/* Pastille couleur source */}
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                            {/* Date */}
                            <span className="text-xs shrink-0 w-16" style={{ color: envMutedTextColor(item.color) }}>{fmtDate(item.date)}</span>
                            {/* Label */}
                            <span className="flex-1 truncate font-medium">{label}</span>
                            {item.isFuture && (item.source === 'regular' || item.source === 'cc_regular') && (
                              <span className="text-[9px] font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded px-1 py-0.5 shrink-0">
                                {L('programmé', 'scheduled')}
                              </span>
                            )}
                            {/* Type badge */}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${badgeCls}`}>
                              {item.type}
                            </span>
                            {/* Montant — vert pour les apports/revenus, rouge pour les dépenses */}
                            <span className="font-semibold text-sm shrink-0" style={{ color: envGainColor(item.color, item.isPositive) }}>
                              {item.isPositive ? '+' : '−'}{fmt(item.amount)}
                            </span>
                            {/* Note */}
                            {item.note && (
                              <span className="text-xs text-muted-foreground truncate max-w-[72px] hidden sm:block" title={displayNote(item.note, lang)}>
                                · {displayNote(item.note, lang)}
                              </span>
                            )}
                            {/* Actions (entrées budget uniquement) */}
                            {item._be && (
                              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditBudget(item._be)}>
                                  <Edit2 className="w-3 h-3" />
                                </Button>
                                {budgetDeleteConfirm === item._be.id ? (
                                  <>
                                    <Button variant="destructive" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => handleDeleteBudget(item._be.id)}>✓</Button>
                                    <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => setBudgetDeleteConfirm(null)}>✗</Button>
                                  </>
                                ) : (
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/70 hover:text-destructive" onClick={() => setBudgetDeleteConfirm(item._be.id)}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {/* Totaux récapitulatifs */}
                      <div className="pt-2 mt-1 border-t border-border space-y-0.5 text-xs text-muted-foreground">
                        <div className="flex justify-between font-semibold text-sm text-foreground">
                          <span>{L('Total dépenses / investissements', 'Total expenses / investments')}</span>
                          <span>{fmt(budgetAnalytics.totalExpenses)}</span>
                        </div>
                        {budgetAnalytics.salary > 0 && (
                          <div className="flex justify-between">
                            <span>{L('Salaire', 'Salary')}</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">+{fmt(budgetAnalytics.salary)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── Camembert répartition du budget (hors salaire) ── */}
              <Card className="border border-border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="font-heading text-base flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />{L('Répartition du budget', 'Budget breakdown')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Message si salaire non renseigné */}
                  {budgetAnalytics.salary === 0 && budgetAnalytics.pieData.length > 0 && (
                    <p className="text-xs text-muted-foreground mb-3 px-3 py-2 rounded-md bg-muted/50 border border-border">
                      {L('Renseignez votre salaire pour voir les pourcentages.', 'Enter your salary to see the percentages.')}{' '}
                      <Link to="/settings" className="underline text-primary hover:text-primary/80">
                        {L('Accéder aux paramètres', 'Go to settings')}
                      </Link>
                    </p>
                  )}

                  {budgetAnalytics.pieData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">{L('Aucune dépense ce mois-ci', 'No expense this month')}</p>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                          <Pie
                            data={budgetAnalytics.pieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={85}
                            labelLine={false}
                          >
                            {budgetAnalytics.pieData.map((entry, idx) => (
                              <Cell key={idx} fill={BUDGET_COLORS[entry.name] || "#94a3b8"} />
                            ))}
                          </Pie>
                          {/* Tooltip personnalisé : montant + % du salaire */}
                          <RechartTooltip
                            wrapperStyle={{ opacity: 1 }}
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const { name, value } = payload[0];
                              const sal = budgetAnalytics.salary;
                              // Afficher % seulement si salaire connu ET pas de déficit global
                              const pct = sal > 0 && !budgetAnalytics.deficit
                                ? Math.round((value / sal) * 100)
                                : null;
                              return (
                                <div style={{
                                  background: 'hsl(var(--card))',
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: 8,
                                  padding: '8px 12px',
                                  fontSize: 12,
                                  opacity: 1,
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                }}>
                                  <div style={{ fontWeight: 600, marginBottom: 4, color: 'hsl(var(--foreground))' }}>
                                    {catLabel(name)}
                                  </div>
                                  <div style={{ color: 'hsl(var(--foreground))' }}>{fmt(value)}</div>
                                  {pct !== null && (
                                    <div style={{ color: 'hsl(var(--muted-foreground))' }}>
                                      {pct}% du salaire
                                    </div>
                                  )}
                                </div>
                              );
                            }}
                          />
                          <Legend formatter={(name) => catLabel(name)} />
                        </PieChart>
                      </ResponsiveContainer>

                      {/* Indicateur de déficit (mois en cours uniquement) */}
                      {budgetAnalytics.deficit !== null && (
                        <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                          <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                            Déficit ce mois : -{fmt(budgetAnalytics.deficit)}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ════ Dialogs ════════════════════════════════════════════════════════ */}

      {/* Day detail dialog */}
      <Dialog open={dayDialogOpen} onOpenChange={setDayDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              {selectedDay ? fmtDate(selectedDay) : ""}
            </DialogTitle>
          </DialogHeader>
          {selectedDayEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{tc("noEvents")}</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {selectedDayEvents.map((evt, i) => {
                if (evt.kind === "movement") {
                  const { isDeposit, total, color, name, allocations } = movementInfo(evt);
                  return (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border border-l-4 border-border bg-card" style={{ borderLeftColor: color }}>
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isDeposit ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                        {isDeposit ? <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowUpRight className="w-3.5 h-3.5 text-red-600" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium flex items-center gap-1.5">
                          <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
                          <span className="truncate">{name}</span>
                        </div>
                        <div className={`text-xs font-semibold ${isDeposit ? "text-emerald-600" : "text-red-600"}`}>
                          {isDeposit ? "+" : "−"}{fmt(total)}
                        </div>
                        {allocations.length > 0 && (
                          <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                            {allocations.map(a => `${a.label} ${fmt(a.amount)} (${total > 0 ? Math.round(a.amount / total * 100) : 0}%)`).join(' · ')}
                          </div>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px]">{isDeposit ? tc("depositEvent") : tc("withdrawalEvent")}</Badge>
                    </div>
                  );
                }
                if (evt.kind === "reminder") {
                  return (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border border-amber-200/60 bg-amber-50/40 dark:bg-amber-950/20">
                      <Bell className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <span className="text-sm flex-1">{remLabel(evt.rem)}</span>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { handleDismissReminder(evt.rem.id); setDayDialogOpen(false); }}>
                        <Check className="w-3 h-3" />{tc("dismissReminder")}
                      </Button>
                    </div>
                  );
                }
                if (evt.kind === "programmed") {
                  const isCC      = evt.pm.portfolio_id === 'compte_cheque';
                  const port      = isCC ? null : portfolios.find(p => p.id === evt.pm.portfolio_id);
                  const isD       = evt.pm.type === 'deposit';
                  const noteText  = evt.pm.note?.trim();
                  // Label : pour CC, note ou "Compte chèque" ; pour non-CC, nom enveloppe
                  const portLabel = isCC
                    ? (noteText || '🏠 Compte chèque')
                    : (port?.name || '?');
                  // Couleurs : CC retrait → rouge, CC dépôt → vert, non-CC → bleu
                  const colorCls  = !isCC
                    ? 'border-blue-200/60 bg-blue-50/40 dark:bg-blue-950/20'
                    : isD
                      ? 'border-emerald-200/60 bg-emerald-50/40 dark:bg-emerald-950/20'
                      : 'border-orange-200/60 bg-orange-50/40 dark:bg-orange-950/20';
                  const iconCls   = !isCC
                    ? 'bg-blue-100 dark:bg-blue-900/30'
                    : isD
                      ? 'bg-emerald-100 dark:bg-emerald-900/30'
                      : 'bg-orange-100 dark:bg-orange-900/30';
                  const amtCls    = !isCC
                    ? 'text-blue-700 dark:text-blue-300'
                    : isD
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-orange-700 dark:text-orange-300';
                  const iconEl    = !isCC
                    ? (isD ? <ArrowDownLeft className="w-3.5 h-3.5 text-blue-600" /> : <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />)
                    : isD
                      ? <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                      : <ArrowUpRight  className="w-3.5 h-3.5 text-orange-600" />;
                  return (
                    <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg border ${colorCls}`}>
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${iconCls}`}>
                        {iconEl}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">
                          {portLabel}
                          {isCC && noteText && <span className="text-muted-foreground font-normal"> — 🏠 {L('Compte chèque', 'Current account')}</span>}
                        </div>
                        <div className={`text-xs ${amtCls} font-semibold`}>
                          {isD ? '+' : '−'}{fmt(evt.pm.amount)} · {freqLabel(evt.pm.recurrence)}
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-[10px] ${
                        !isCC ? 'border-blue-300 text-blue-600'
                          : isD ? 'border-emerald-300 text-emerald-600'
                          : 'border-orange-300 text-orange-600'
                      }`}>
                        {isCC ? 'Compte chèque' : tc("programmedEvent")}
                      </Badge>
                    </div>
                  );
                }
                if (evt.kind === "budget") {
                  return (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border border-purple-200/60 bg-purple-50/40 dark:bg-purple-950/20">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: BUDGET_COLORS[evt.be.category] }} />
                      <div className="flex-1">
                        <span className="text-sm">{catLabel(evt.be.category)}{evt.be.custom_label ? ` — ${evt.be.custom_label}` : ""}</span>
                      </div>
                      <span className="text-sm font-semibold">{fmt(evt.be.amount)}</span>
                    </div>
                  );
                }
                if (evt.kind === "calendarEvent") {
                  // Couleur par catégorie (défi → ambre, calibration → ambre, etc.)
                  const ceColor = CALENDAR_EVENT_COLORS[evt.ce.category] || '#6366f1';
                  return (
                    <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg border border-l-4 border-border bg-card" style={{ borderLeftColor: ceColor }}>
                      <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: ceColor }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium" style={{ color: ceColor }}>{evt.ce.title}</div>
                        {evt.ce.description && (
                          <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{evt.ce.description}</div>
                        )}
                      </div>
                    </div>
                  );
                }
                if (evt.kind === "objective") {
                  let progress = null;
                  try { progress = objectiveService.getObjectiveProgress(evt.obj); } catch (_) {}
                  const pct = progress ? Math.min(100, Math.round(progress.progressPercent || 0)) : 0;
                  return (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border border-violet-200/60 bg-violet-50/40 dark:bg-violet-950/20">
                      <span className="text-xl flex-shrink-0" aria-hidden>{evt.obj.icon || '🎯'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-violet-800 dark:text-violet-200">{evt.obj.label}</div>
                        {progress && (
                          <div className="text-xs text-violet-600 dark:text-violet-400 mt-0.5">
                            {fmt(progress.currentAmount)} / {fmt(progress.targetAmount)} — {pct}%
                          </div>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px] border-violet-300 text-violet-600 shrink-0">Objectif</Badge>
                    </div>
                  );
                }
                if (evt.kind === "note") {
                  return (
                    <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg border border-border bg-card group">
                      <span className="w-3 h-3 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: evt.note.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm whitespace-pre-wrap break-words">{evt.note.text}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditNote(evt.note)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        {noteDeleteConfirm === evt.note.id ? (
                          <div className="flex items-center gap-1">
                            <Button variant="destructive" size="sm" className="h-7 text-[10px] px-1.5" onClick={() => handleDeleteNote(evt.note.id)}>✓</Button>
                            <Button variant="ghost" size="sm" className="h-7 text-[10px] px-1.5" onClick={() => setNoteDeleteConfirm(null)}>✗</Button>
                          </div>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/70 hover:text-destructive" onClick={() => setNoteDeleteConfirm(evt.note.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          )}
          <DialogFooter className="gap-2 flex-wrap sm:justify-between">
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" onClick={() => { openAddBudget(selectedDay); setDayDialogOpen(false); }} className="gap-1 text-xs">
                <Plus className="w-3.5 h-3.5" />Budget
              </Button>
              <Button variant="outline" size="sm" onClick={() => openAddNote(selectedDay)} className="gap-1 text-xs">
                <StickyNote className="w-3.5 h-3.5" />Note
              </Button>
              <Button variant="outline" size="sm" onClick={() => { openAddReminder(selectedDay); setDayDialogOpen(false); }} className="gap-1 text-xs">
                <Bell className="w-3.5 h-3.5" />{L('Rappel', 'Reminder')}
              </Button>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setDayDialogOpen(false)}>{t("common.close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reminder dialog */}
      <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">{editingReminder ? tc("editReminder") : tc("addReminder")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{tc("reminderLabel")}</Label>
              <Input value={reminderForm.label} onChange={e => setReminderForm({ ...reminderForm, label: e.target.value })} placeholder={L('Ex: Vérifier mon PEA', 'e.g. Check my PEA')} />
            </div>
            <div>
              <Label>{tc("reminderDate")}</Label>
              <Input type="date" value={reminderForm.date} onChange={e => setReminderForm({ ...reminderForm, date: e.target.value })} />
            </div>
            <div>
              <Label>{tc("reminderRecurrence")}</Label>
              <Select value={reminderForm.recurrence} onValueChange={v => setReminderForm({ ...reminderForm, recurrence: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tc("recurrenceNone")}</SelectItem>
                  <SelectItem value="monthly">{tc("recurrenceMonthly")}</SelectItem>
                  <SelectItem value="yearly">{tc("recurrenceYearly")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setReminderDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={saveReminder}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Budget entry dialog — onglets : Ajouter/Modifier · Historique (mouvements budget uniquement) */}
      <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">{editingBudget ? tc("editBudgetEntry") : tc("addBudgetEntry")}</DialogTitle>
          </DialogHeader>
          <Tabs value={budgetTab} onValueChange={setBudgetTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="add">{editingBudget ? tc("editBudgetEntry") : tc("addBudgetEntry")}</TabsTrigger>
              <TabsTrigger value="history">{L('Historique', 'History')}{budgetEntries.length > 0 ? ` (${budgetEntries.length})` : ''}</TabsTrigger>
            </TabsList>

            {/* ── Onglet AJOUTER / MODIFIER ── */}
            <TabsContent value="add" className="mt-4">
              <div className="space-y-4">
                {/* Catégorie (remplace le champ note) */}
                <div>
                  <Label>{tc("budgetCategory")}</Label>
                  <Select value={budgetForm.category} onValueChange={v => setBudgetForm({ ...budgetForm, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BUDGET_CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat}>
                          <span className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: BUDGET_COLORS[cat] }} />
                            {catLabel(cat)}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {budgetForm.category === "autre" && (
                  <div>
                    <Label>{L('Libellé personnalisé', 'Custom label')}</Label>
                    <Input value={budgetForm.custom_label} onChange={e => setBudgetForm({ ...budgetForm, custom_label: e.target.value })} placeholder={L('Ex: Abonnement salle de sport', 'e.g. Gym membership')} />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{tc("budgetAmount")} (€)</Label>
                    <Input type="text" inputMode="decimal" value={budgetForm.amount} onChange={e => setBudgetForm({ ...budgetForm, amount: e.target.value })} placeholder={L('Ex : 800', 'e.g. 800')} />
                  </div>
                  <div>
                    <Label>{tc("budgetDate")}</Label>
                    <Input type="date" value={budgetForm.date} onChange={e => setBudgetForm({ ...budgetForm, date: e.target.value })} />
                  </div>
                </div>
                {/* Récurrence */}
                <div>
                  <Label>{L('Récurrence', 'Recurrence')}</Label>
                  <Select value={budgetForm.recurrence} onValueChange={v => setBudgetForm({ ...budgetForm, recurrence: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{L('Aucune (ponctuel)', 'None (one-off)')}</SelectItem>
                      <SelectItem value="weekly">{L('Hebdomadaire', 'Weekly')}</SelectItem>
                      <SelectItem value="monthly">{L('Mensuelle', 'Monthly')}</SelectItem>
                      <SelectItem value="quarterly">{L('Trimestrielle', 'Quarterly')}</SelectItem>
                      <SelectItem value="yearly">{L('Annuelle', 'Yearly')}</SelectItem>
                    </SelectContent>
                  </Select>
                  {budgetForm.recurrence !== 'none' && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {L('Appliqué automatiquement à tous les mois / trimestres / années suivants.', 'Applied automatically to every following month / quarter / year.')}
                    </p>
                  )}
                </div>
                {/* Compte associé implicite */}
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5" /> {L('Compte associé : Compte chèque', 'Linked account: Current account')}
                </p>
              </div>
              <DialogFooter className="gap-2 sm:gap-2 mt-4">
                <Button variant="secondary" onClick={() => setBudgetDialogOpen(false)}>{t("common.cancel")}</Button>
                <Button className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5" onClick={() => saveBudget('expense')}>
                  <ArrowUpRight className="w-4 h-4" /> {L('Dépenses', 'Expense')}
                </Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5" onClick={() => saveBudget('income')}>
                  <ArrowDownLeft className="w-4 h-4" /> {L('Apports', 'Income')}
                </Button>
              </DialogFooter>
            </TabsContent>

            {/* ── Onglet HISTORIQUE — uniquement les mouvements budget (jamais les récurrents d'enveloppe) ── */}
            <TabsContent value="history" className="mt-4">
              {budgetEntries.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  <Wallet className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>{L('Aucun mouvement budget enregistré.', 'No budget movement recorded.')}</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                  {[...budgetEntries].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).map(be => {
                    const isIncome = isIncomeEntry(be);
                    const color    = BUDGET_COLORS[be.category] || '#94a3b8';
                    const label    = catLabel(be.category) + (be.custom_label ? ` — ${be.custom_label}` : '');
                    const recLabel = {
                      weekly:    L('Hebdomadaire', 'Weekly'),
                      monthly:   L('Mensuelle', 'Monthly'),
                      quarterly: L('Trimestrielle', 'Quarterly'),
                      yearly:    L('Annuelle', 'Yearly'),
                    }[be.recurrence];
                    return (
                      <div key={be.id} className="rounded-lg border border-border bg-card p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm truncate">{label}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isIncome ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'}`}>
                                  {isIncome ? L('Apport', 'Income') : L('Dépense', 'Expense')}
                                </span>
                                {recLabel && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">{recLabel}</span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(be.date)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={`font-semibold text-sm ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {isIncome ? '+' : '−'}{fmt(be.amount)}
                            </span>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditBudget(be)} title={L('Modifier', 'Edit')}>
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            {budgetDeleteConfirm === be.id ? (
                              <div className="flex items-center gap-1">
                                <Button size="sm" className="h-7 text-xs px-2 bg-rose-600 hover:bg-rose-700 text-white" onClick={() => handleDeleteBudget(be.id)}>{L('Supprimer', 'Delete')}</Button>
                                <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setBudgetDeleteConfirm(null)}>{L('Annuler', 'Cancel')}</Button>
                              </div>
                            ) : (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 hover:text-destructive" onClick={() => setBudgetDeleteConfirm(be.id)} title={L('Supprimer', 'Delete')}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Programmed movement dialog */}
      <Dialog open={pmDialogOpen} onOpenChange={setPmDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">{editingPm ? tc("editProgrammedMovement") : tc("addProgrammedMovement")}</DialogTitle>
            <DialogDescription>{L('Planifiez un versement ou retrait récurrent sur une enveloppe.', 'Schedule a recurring deposit or withdrawal on an envelope.')}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>{L('Enveloppe', 'Envelope')}</Label>
              <Select value={pmForm.portfolio_id} onValueChange={v => setPmForm({ ...pmForm, portfolio_id: v })}>
                <SelectTrigger><SelectValue placeholder={L('Choisir une enveloppe', 'Choose an envelope')} /></SelectTrigger>
                <SelectContent>
                  {portfolios.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{L('Type', 'Type')}</Label>
              <Select value={pmForm.type} onValueChange={v => setPmForm({ ...pmForm, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">{L('Versement', 'Deposit')}</SelectItem>
                  <SelectItem value="withdrawal">{L('Retrait', 'Withdrawal')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{L('Montant (€)', 'Amount (€)')}</Label>
              <Input type="number" min="0" step="0.01" value={pmForm.amount} onChange={e => setPmForm({ ...pmForm, amount: e.target.value })} />
            </div>
            <div>
              <Label>{tc("pmFrequency")}</Label>
              <Select value={pmForm.frequency} onValueChange={v => setPmForm({ ...pmForm, frequency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PM_FREQUENCIES.map(f => <SelectItem key={f} value={f}>{freqLabel(f)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{tc("pmNextDate")}</Label>
              <Input type="date" value={pmForm.next_date} onChange={e => setPmForm({ ...pmForm, next_date: e.target.value })} />
            </div>
            <div>
              <Label>{L('Frais (%)', 'Fees (%)')}</Label>
              <Input type="number" min="0" step="0.01" value={pmForm.fees_pct} onChange={e => setPmForm({ ...pmForm, fees_pct: e.target.value })} />
            </div>
            <div>
              <Label>{L('Note (optionnel)', 'Note (optional)')}</Label>
              <Input value={pmForm.note} onChange={e => setPmForm({ ...pmForm, note: e.target.value })} placeholder={L('Ex: Épargne mensuelle', 'e.g. Monthly savings')} />
            </div>
            <div className="col-span-2 flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">{tc("pmAutoApply")}</p>
                <p className="text-xs text-muted-foreground">{tc("pmAutoApplyHint")}</p>
              </div>
              <Switch checked={pmForm.auto_apply} onCheckedChange={v => setPmForm({ ...pmForm, auto_apply: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPmDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={savePm}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Panneau Mouvements réguliers ── */}
      <RegularMovementsPanel
        open={regularMovementsPanelOpen}
        onClose={() => setRegularMovementsPanelOpen(false)}
        portfolios={portfolios}
        onSaved={refresh}
      />

      {/* ── Dialogue Note calendrier ── */}
      <Dialog open={noteDialogOpen} onOpenChange={(v) => { if (!v) setNoteDialogOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-amber-500" />
              {editingNote ? L('Modifier la note', 'Edit note') : `${L('Note du', 'Note for')} ${noteForm._date ? fmtDate(noteForm._date) : ''}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            {/* Zone de texte */}
            <div className="space-y-1">
              <Label>{L('Note', 'Note')} <span className="text-destructive">*</span></Label>
              <textarea
                value={noteForm.text}
                onChange={e => setNoteForm({ ...noteForm, text: e.target.value })}
                maxLength={500}
                rows={4}
                placeholder={L('Votre note...', 'Your note...')}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                           placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
              <div className="flex justify-end text-[10px] text-muted-foreground">
                {noteForm.text.length}/500
              </div>
            </div>
            {/* Pastilles couleur */}
            <div className="space-y-1.5">
              <Label>{L('Couleur', 'Colour')}</Label>
              <div className="flex flex-wrap gap-2">
                {NOTE_COLORS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onClick={() => setNoteForm({ ...noteForm, color: c.value })}
                    className={`w-7 h-7 rounded-full transition-all ${
                      noteForm.color === c.value
                        ? 'ring-2 ring-offset-2 ring-foreground/60 scale-110'
                        : 'hover:scale-105 opacity-80'
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setNoteDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={saveNote} disabled={!noteForm.text.trim()}>
              {editingNote ? 'Modifier' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

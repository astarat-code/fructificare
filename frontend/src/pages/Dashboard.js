// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import dataService from "../services/dataService";
import { useLanguage } from "../context/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Switch } from "../components/ui/switch";
import { Checkbox } from "../components/ui/checkbox";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ComposedChart, AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Plus, Briefcase, TrendingUp, ArrowDownLeft, ArrowUpRight, ChevronRight, Bookmark, Trash2, Edit2, Wallet, Target, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, RefreshCw, LayoutDashboard, ShieldCheck } from "lucide-react";
import TotalFeesCard from "../components/ui/TotalFeesCard";
import ColorSwatchPicker from "../components/ui/ColorSwatchPicker";
import AnnualYieldChart from "../components/ui/AnnualYieldChart";
import EnvelopeEvolutionChart from "../components/ui/EnvelopeEvolutionChart";
import { envTintBg, envTextColor, envMutedTextColor, envGainColor } from "../lib/utils";
import { getTaxMaturity, taxMaturityLabels } from "../lib/taxMaturity";
import QuestProgress             from "../components/gamification/QuestProgress";
import MonthlyChallengeWidget    from "../components/gamification/MonthlyChallengeWidget";
import StreakDisplay             from "../components/gamification/StreakDisplay";
import gamificationService       from "../services/gamificationService";
import challengeService          from "../services/challengeService";
import questService              from "../services/questService";
import RegularMovementsPanel     from "../components/RegularMovementsPanel";
import CalibrationModal          from "../components/CalibrationModal";
import Disclaimer, { DIETZ_NOTE } from "../components/ui/Disclaimer";
import GlossaryTerm from "../components/ui/GlossaryTerm";


// Assombrit une couleur hex (ton plus foncé pour les lignes de versements).
function darkenHex(hex, factor = 0.72) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || '');
  if (!m) return hex || '#374151';
  const n = parseInt(m[1], 16);
  const r = Math.round(((n >> 16) & 255) * factor);
  const g = Math.round(((n >> 8) & 255) * factor);
  const b = Math.round((n & 255) * factor);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
const TYPES = ["PEA", "CTO", "assurance_vie", "PER", "compte_réglementé", "custom"];

/**
 * Wrapper collapsible pour les widgets de gamification du Dashboard.
 * - done=true  → section masquée automatiquement (toutes tâches réalisées)
 * - expanded   → affiche le widget enfant complet
 * - collapsed  → affiche uniquement la bande titre (~40 px)
 * Les styles [&>*]: enlèvent la bordure/ombre redondante du Card enfant.
 */
function CollapsibleGamifSection({ icon, title, summary, expanded, onToggle, done, children, isHighlight }) {
  const [pulseActive, setPulseActive] = useState(isHighlight ? true : false);

  useEffect(() => {
    if (!isHighlight) return;
    const t = setTimeout(() => setPulseActive(false), 2200);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const styleId = 'highlight-pulse-style';
    if (!document.getElementById(styleId)) {
      const el = document.createElement('style');
      el.id = styleId;
      el.textContent = `@keyframes highlightPulse { 0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,0.5)} 50%{box-shadow:0 0 0 6px rgba(16,185,129,0)} }`;
      document.head.appendChild(el);
    }
  }, []);

  if (done) return null;
  return (
    <div
      className={`rounded-lg border overflow-hidden transition-shadow ${
        isHighlight
          ? `border-emerald-500/60 dark:border-emerald-600/40 shadow-md ${pulseActive ? 'shadow-emerald-400/50 dark:shadow-emerald-600/40' : 'shadow-emerald-300/20'}`
          : 'border-border bg-card shadow-sm'
      }`}
      style={pulseActive && isHighlight ? { animation: 'highlightPulse 1.1s ease-in-out 2' } : {}}
    >
      {/* Bande cliquable (~40 px) */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${
          isHighlight
            ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 dark:from-emerald-700 dark:to-emerald-600 hover:from-emerald-700 hover:to-emerald-600 dark:hover:from-emerald-800 dark:hover:to-emerald-700'
            : 'hover:bg-muted/30'
        }`}
        aria-expanded={expanded}
      >
        <span className="text-sm leading-none select-none">{icon}</span>
        <span className={`font-semibold text-sm flex-1 ${isHighlight ? 'text-white' : 'text-foreground'}`}>{title}</span>
        <span className={`text-xs mr-1 truncate max-w-[180px] ${isHighlight ? 'text-emerald-100' : 'text-muted-foreground'}`}>{summary}</span>
        {expanded
          ? <ChevronUp   className={`w-4 h-4 shrink-0 ${isHighlight ? 'text-emerald-100' : 'text-muted-foreground'}`} />
          : <ChevronDown className={`w-4 h-4 shrink-0 ${isHighlight ? 'text-emerald-100' : 'text-muted-foreground'}`} />}
      </button>
      {/* Contenu déplié */}
      {expanded && (
        <div className="border-t border-border [&>*]:border-0 [&>*]:shadow-none [&>*]:rounded-none">
          {children}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { t, lang } = useLanguage();
  const L = (fr, en) => (lang === 'en' ? en : fr);
  const navigate = useNavigate();
  const [portfolios, setPortfolios] = useState([]);
  const [feeModalOpen, setFeeModalOpen] = useState(false);
  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [historyData, setHistoryData] = useState({ data: [], series: [] });
  const [assetHistoryData, setAssetHistoryData] = useState({ data: [], series: [] });
  const [assetStats, setAssetStats] = useState({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [templateDialogOpen,    setTemplateDialogOpen]    = useState(false);
  const [regularMovementsOpen,  setRegularMovementsOpen]  = useState(false);
  const [form, setForm] = useState({ name: "", color: "", type: "PEA", annual_fees_pct: 0, annual_fees_type: "percent", annual_return_rate: "", contract_start_date: "", include_in_tax_report: true, regulated_subtype: "livret_a" });
  const [templateForm, setTemplateForm] = useState({ name: "", portfolio_id: "", fees_pct: 0, fees_type: "percent", annual_fees_pct: 0, asset_type: "" });
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [customAssetTypes, setCustomAssetTypes] = useState([]);
  const [tplMultiAssetMode, setTplMultiAssetMode] = useState(false);
  const [tplMultiAssetAllocations, setTplMultiAssetAllocations] = useState([]);
  const [tplMultiAssetModalOpen, setTplMultiAssetModalOpen] = useState(false);
  const [templateTab, setTemplateTab] = useState("list");
  const [viewByAsset, setViewByAsset] = useState(true); // Par défaut: vue par actif
  const [allocRealValue, setAllocRealValue] = useState(false); // false = versements, true = valeur réelle (calibrée)
  const [chartRealValue, setChartRealValue] = useState(false); // idem pour le graphique d'évolution (épargne cumulée)
  // §4 — inclure les livrets réglementés dans la « Valeur totale » et le rendement global
  // (AFFICHAGE uniquement ; le rapport fiscal les traite toujours à part). Défaut : ON.
  const [includeLivrets, setIncludeLivrets] = useState(() => dataService.getAppPreferences().includeRegulatedInPerf !== false);
  const barChartScrollRef = useRef(null);

  // ── Calibration ───────────────────────────────────────────────────────────
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [calibrationDate, setCalibrationDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [calibrationValues, setCalibrationValues] = useState({});   // { [portfolioId]: { totalValue: '', assetValues: {} } }
  const [calibrationExpanded, setCalibrationExpanded] = useState({});// { [portfolioId]: bool }
  const [calibrationOverdue, setCalibrationOverdue] = useState(false);
  const [calibrationSelected, setCalibrationSelected] = useState({}); // { [portfolioId]: bool }
  const [portfolioAssetTypes, setPortfolioAssetTypes] = useState({}); // { [portfolioId]: string[] }
  const [portfolioTemplatePositions, setPortfolioTemplatePositions] = useState({}); // { [portfolioId]: TemplatePosition[] }
  // ── Calibration modal tabs (fix 5) ────────────────────────────────────────
  const [calModalTab, setCalModalTab] = useState('saisie');            // 'saisie' | 'historique'
  const [editingCalibrationId, setEditingCalibrationId] = useState(null); // id when modifying existing entry
  const [calDeleteConfirm, setCalDeleteConfirm] = useState(null);      // id pending inline delete confirm
  const [calibrationDateOverrides, setCalibrationDateOverrides] = useState({}); // { [portfolioId]: string } — date spécifique par enveloppe
  const [calibrationConfirmed,    setCalibrationConfirmed]    = useState({}); // { [portfolioId]: bool } — feedback "Calibration enregistrée"

  // ── Gamification sections collapsibles ────────────────────────────────────
  // Défaut : toutes ouvertes. Persiste dans localStorage['dashboardSections'].
  const [gamifSections, _setGamifSections] = useState({ quests: true, challenge: false });
  // Tick pour re-rendre les en-têtes résumés quand la gamification évolue
  const [, setGamifTick] = useState(0);

  const refresh = useCallback(() => {
    const ps = dataService.getPortfolios();
    setPortfolios(ps);
    setTemplates(dataService.getAllMovementTemplates());
    setCustomAssetTypes(dataService.getCustomAssetTypes());
    const history = dataService.getAllPortfoliosHistory(includeLivrets, chartRealValue);
    setHistoryData(history || { data: [], series: [] });
    const assetHistory = dataService.getAllAssetsHistory(includeLivrets, chartRealValue);
    setAssetHistoryData(assetHistory || { data: [], series: [] });
    setAssetStats(dataService.getAssetTypeStats());
    // Calibration
    setCalibrationOverdue(dataService.needsCalibration());
    const assetMap = {};
    const tplPosMap = {};
    ps.forEach(p => {
      assetMap[p.id] = dataService.getPortfolioAssetTypes(p.id);
      tplPosMap[p.id] = dataService.getPortfolioTemplatePositions(p.id);
    });
    setPortfolioAssetTypes(assetMap);
    setPortfolioTemplatePositions(tplPosMap);
    // §6 — calibration-based history
    setCalibrationHistoryData(dataService.getAllPortfoliosHistoryWithCalibration(includeLivrets) || { data: [], series: [], hasCalibration: false });
  }, [includeLivrets, chartRealValue]);
  
  useEffect(() => { refresh(); }, [refresh]);

  // Propagation réactive : rafraîchit les données (donc les graphiques) quand une
  // enveloppe change ailleurs — ex. modification de couleur depuis la page enveloppe.
  useEffect(() => {
    const unsub = gamificationService.onEvent('portfoliosChanged', () => refresh());
    return unsub;
  }, [refresh]);

  // Défi décembre (Prompt 9) : marquer "portfolioPnL" comme vu au montage du tableau de bord
  useEffect(() => {
    try {
      const gState = gamificationService.getState();
      if (!gState.viewOpened?.portfolioPnL) {
        gamificationService.patchState({
          viewOpened: { ...(gState.viewOpened || {}), portfolioPnL: true },
        });
        challengeService.checkMonthlyChallenge().catch(() => {});
      }
      // Mission 3 (mars) : le camembert d'allocation d'actifs est affiché sur le tableau de bord
      challengeService.markVisit('viewAllocationPie');
    } catch (_) {}
  }, []);

  // ── Helpers pour les sections collapsibles ────────────────────────────────
  const setGamifSections = useCallback((updater) => {
    _setGamifSections(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try { localStorage.setItem('dashboardSections', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const toggleSection = useCallback((key) => {
    setGamifSections(prev => ({ ...prev, [key]: !prev[key] }));
  }, [setGamifSections]);

  // Abonnement aux événements gamification pour mettre à jour les résumés des en-têtes
  // et réagir immédiatement au toggle gamificationEnabled
  useEffect(() => {
    const bump = () => setGamifTick(v => v + 1);
    const unsubs = [
      gamificationService.onEvent('questCompleted',     bump),
      gamificationService.onEvent('challengeCompleted', bump),
      gamificationService.onEvent('progressUpdated',    bump),
      gamificationService.onEvent('preferencesUpdated', bump),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  // Scroller le graphique à droite (dates récentes) après le chargement des données
  useEffect(() => {
    if (barChartScrollRef.current) {
      const dataLength = viewByAsset ? assetHistoryData.data.length : historyData.data.length;
      if (dataLength > 0) {
        setTimeout(() => {
          if (barChartScrollRef.current) {
            barChartScrollRef.current.scrollLeft = barChartScrollRef.current.scrollWidth;
          }
        }, 100);
      }
    }
  }, [historyData.data.length, assetHistoryData.data.length, viewByAsset]);

  // §Fix-3 — Use latest calibration value per portfolio when available, else net deposits
  const nonRegPortfolios    = portfolios.filter(p => p.type !== 'compte_réglementé');
  const regulatedPortfolios = portfolios.filter(p => p.type === 'compte_réglementé');
  // §4 — Périmètre de performance : livrets réglementés inclus (défaut) ou exclus (réglage OFF).
  const perfPortfolios = includeLivrets ? portfolios : nonRegPortfolios;
  const globalYield = dataService.computeGlobalYield(perfPortfolios);
  const totalValue = globalYield
    ? globalYield.totalPortfolioValue
    : perfPortfolios.reduce((s, p) => s + (p.balance || 0), 0);
  // Total livrets réglementés : valeur calibrée si dispo, sinon solde (versements).
  // Affiché en ligne séparée UNIQUEMENT quand ils sont exclus de la performance.
  const regulatedTotal = regulatedPortfolios.reduce((s, p) => {
    const lastCal = dataService.getCalibrations(p.id).slice(-1)[0];
    return s + (lastCal ? lastCal.total_value : (p.balance || 0));
  }, 0);
  const totalDeposits     = perfPortfolios.reduce((s, p) => s + (p.total_deposits || 0), 0);
  const totalWithdrawals  = perfPortfolios.reduce((s, p) => s + (p.total_withdrawals || 0), 0);
  const regulatedDeposits = regulatedPortfolios.reduce((s, p) => s + (p.total_deposits || 0), 0);
  const totalFees = portfolios.reduce((s, p) => s + (p.total_fees || 0), 0);
  // Répartition des frais par enveloppe (frais > 0), triée par total décroissant.
  const feeBreakdown = [...portfolios]
    .filter(p => (p.total_fees || 0) > 0.005)
    .sort((a, b) => (b.total_fees || 0) - (a.total_fees || 0));
  const totalCash = portfolios.reduce((s, p) => s + (p.cash_balance || 0), 0);
  // Répartition des espèces par enveloppe (seules celles qui en détiennent), triée par
  // montant décroissant — même logique que feeBreakdown juste au-dessus.
  const cashBreakdown = [...portfolios]
    .filter(p => (p.cash_balance || 0) > 0.005)
    .sort((a, b) => (b.cash_balance || 0) - (a.cash_balance || 0));
  
  // Existe-t-il au moins une calibration ? (active le mode « Valeur réelle »)
  const hasAnyCalibration = portfolios.some(p => dataService.getCalibrations(p.id).length > 0);
  // « Valeur réelle » effective si activée ET si une calibration existe (vues enveloppe ET actif).
  const useRealValueAlloc = allocRealValue && hasAnyCalibration;
  const useRealValueChart = chartRealValue && hasAnyCalibration;

  // Données pour le camembert par enveloppe.
  // Versements (défaut) → p.balance ; Valeur réelle → dernière calibration (repli versements).
  const pieDataEnvelopes = portfolios
    // §4 — livrets réglementés inclus dans la répartition seulement si le réglage est actif
    .filter(p => includeLivrets || p.type !== 'compte_réglementé')
    .map(p => {
      const lastCal = useRealValueAlloc ? dataService.getCalibrations(p.id).slice(-1)[0] : null;
      const value = lastCal ? lastCal.total_value : p.balance;
      return { name: p.name, value, color: p.color, id: p.id };
    })
    .filter(d => d.value > 0);

  // Données pour le camembert par type d'actif (versements ou valeur réelle calibrée).
  const pieDataAssets = Object.entries(dataService.getAssetAllocation(useRealValueAlloc))
    .filter(([type, v]) => v > 0 && (includeLivrets || type !== 'livret_réglementé'))
    .map(([type, v]) => ({
      name: type === 'non_defini' ? 'Non défini' : t(`assetTypes.${type}`),
      value: Math.round(v),
      type,
    }));

  const handleCreate = () => {
    try {
      dataService.createPortfolio(form);
      toast.success(t("common.success"));
      setDialogOpen(false);
      setForm({ name: "", color: "", type: "PEA", annual_fees_pct: 0, annual_fees_type: "percent", annual_return_rate: "", contract_start_date: "", include_in_tax_report: true });
      refresh();
    } catch (e) { toast.error(e.message); }
  };

  const handleCreateOrUpdateTemplate = () => {
    if (!templateForm.name || !templateForm.portfolio_id) {
      toast.error(L('Nom et enveloppe requis', 'Name and envelope required'));
      return;
    }
    if (tplMultiAssetMode && tplMultiAssetAllocations.length > 0) {
      const totalPct = tplMultiAssetAllocations.reduce((s, a) => s + (parseFloat(a.pct) || 0), 0);
      if (Math.abs(totalPct - 100) > 0.01) {
        toast.error(L('Les pourcentages multi-actifs doivent totaliser 100%', 'Multi-asset percentages must total 100%'));
        return;
      }
    }
    try {
      const data = {
        ...templateForm,
        asset_type: tplMultiAssetMode ? null : (templateForm.asset_type || null),
        multi_asset_allocations: tplMultiAssetMode && tplMultiAssetAllocations.length > 0 ? tplMultiAssetAllocations : null,
      };
      if (editingTemplate) {
        dataService.updateMovementTemplate(editingTemplate.id, data);
        toast.success(t("common.success"));
        setEditingTemplate(null);
      } else {
        dataService.createMovementTemplate(data);
        toast.success(t("common.success"));
      }
      setTemplateForm({ name: "", portfolio_id: "", fees_pct: 0, fees_type: "percent", annual_fees_pct: 0, asset_type: "" });
      setTplMultiAssetMode(false);
      setTplMultiAssetAllocations([]);
      setTemplateTab("list");
      refresh();
    } catch (e) { toast.error(e.message); }
  };

  const editTemplate = (tpl) => {
    setEditingTemplate(tpl);
    setTemplateForm({
      name: tpl.name,
      portfolio_id: tpl.portfolio_id,
      fees_pct: tpl.fees_pct,
      fees_type: tpl.fees_type === 'euro' ? 'euro' : 'percent',
      annual_fees_pct: tpl.annual_fees_pct,
      asset_type: tpl.asset_type || "",
    });
    if (tpl.multi_asset_allocations && tpl.multi_asset_allocations.length > 0) {
      setTplMultiAssetMode(true);
      setTplMultiAssetAllocations(tpl.multi_asset_allocations);
    } else {
      setTplMultiAssetMode(false);
      setTplMultiAssetAllocations([]);
    }
    setTemplateTab("create");
  };

  const deleteTemplate = (id) => {
    dataService.deleteMovementTemplate(id);
    toast.success(t("common.success"));
    refresh();
  };

  const cancelEditTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({ name: "", portfolio_id: "", fees_pct: 0, fees_type: "percent", annual_fees_pct: 0, asset_type: "" });
    setTplMultiAssetMode(false);
    setTplMultiAssetAllocations([]);
    setTemplateTab("list");
  };

  const openTemplateDialog = () => {
    setTemplateTab(templates.length > 0 ? "list" : "create");
    setEditingTemplate(null);
    setTemplateForm({ name: "", portfolio_id: "", fees_pct: 0, fees_type: "percent", annual_fees_pct: 0, asset_type: "" });
    setTplMultiAssetMode(false);
    setTplMultiAssetAllocations([]);
    setTemplateDialogOpen(true);
  };

  const fmt = (v) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);

  // ── Calibration helpers ───────────────────────────────────────────────────
  const openCalibrationModal = () => {
    // Pre-fill total values from portfolio balances
    const vals = {};
    const sel  = {};
    portfolios.forEach(p => {
      vals[p.id] = { totalValue: String(p.balance || ''), assetValues: {} };
      sel[p.id]  = true; // all checked by default
    });
    setCalibrationValues(vals);
    setCalibrationSelected(sel);
    setCalibrationExpanded({});
    setCalibrationDate(new Date().toISOString().split("T")[0]);
    setEditingCalibrationId(null);
    setCalModalTab('saisie');
    setCalDeleteConfirm(null);
    setCalibrationDateOverrides({});
    setCalibrationConfirmed({});
    setCalibrationOpen(true);
  };

  // Pre-fill the entry form from a historical calibration entry for editing
  const startEditCalibration = (cal) => {
    setEditingCalibrationId(cal.id);
    setCalibrationDate(cal.date);
    const assetValues = {};
    if (cal.asset_breakdown) {
      cal.asset_breakdown.forEach(item => {
        const key = item.template_id || item.asset_type;
        if (key) assetValues[key] = String(item.value);
      });
    }
    setCalibrationValues(prev => ({
      ...prev,
      [cal.portfolio_id]: { totalValue: String(cal.total_value), assetValues },
    }));
    if (cal.asset_breakdown && cal.asset_breakdown.length > 0) {
      setCalibrationExpanded(prev => ({ ...prev, [cal.portfolio_id]: true }));
    }
    setCalModalTab('saisie');
  };

  const setPortfolioCalibValue = (portfolioId, key, value) => {
    setCalibrationValues(prev => ({
      ...prev,
      [portfolioId]: { ...prev[portfolioId], [key]: value },
    }));
  };

  // §9 — setAssetCalibValue by template_id instead of just assetType
  const setAssetCalibValue = (portfolioId, key, value) => {
    setCalibrationValues(prev => ({
      ...prev,
      [portfolioId]: {
        ...prev[portfolioId],
        assetValues: { ...(prev[portfolioId]?.assetValues || {}), [key]: value },
      },
    }));
  };

  const toggleCalibExpanded = (portfolioId) => {
    setCalibrationExpanded(prev => ({ ...prev, [portfolioId]: !prev[portfolioId] }));
  };

  // Sum of Level 2 rows
  const assetBreakdownSum = (portfolioId) => {
    const av = calibrationValues[portfolioId]?.assetValues || {};
    return Object.values(av).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  };

  // Helper: build asset breakdown for a portfolio from form state
  const buildAssetBreakdown = (pId) => {
    if (!calibrationExpanded[pId]) return null;
    const av = calibrationValues[pId]?.assetValues || {};
    const tplPositions = portfolioTemplatePositions[pId] || [];
    if (tplPositions.length > 0) {
      const items = tplPositions
        .map(pos => ({ template_id: pos.template_id, asset_type: pos.asset_type || 'autre', name: pos.name, value: parseFloat(av[pos.template_id]) || 0 }))
        .filter(item => item.value > 0);
      return items.length > 0 ? items : null;
    }
    const types = portfolioAssetTypes[pId] || [];
    const items = types
      .map(at => ({ asset_type: at, value: parseFloat(av[at]) || 0 }))
      .filter(item => item.value > 0);
    return items.length > 0 ? items : null;
  };

  const saveCalibration = () => {
    // Edit mode: replace the single entry being modified
    if (editingCalibrationId) {
      const existingCal = dataService.getCalibrations().find(c => c.id === editingCalibrationId);
      if (existingCal) {
        const pId = existingCal.portfolio_id;
        const entry = calibrationValues[pId];
        const totalValue = parseFloat(entry?.totalValue);
        if (!isNaN(totalValue) && totalValue >= 0) {
          dataService.deleteCalibration(editingCalibrationId);
          dataService.addCalibration({
            portfolio_id: pId,
            date: calibrationDate,
            total_value: totalValue,
            asset_breakdown: buildAssetBreakdown(pId),
          });
          toast.success(L('Calibration mise à jour ✓', 'Calibration updated ✓'));
          refresh();
        } else {
          toast.error(L('Valeur invalide.', 'Invalid value.'));
        }
      }
      setEditingCalibrationId(null);
      setCalibrationOpen(false);
      return;
    }

    // Normal mode: save only checked portfolios that have a value
    let savedCount = 0;
    portfolios.forEach(p => {
      if (!calibrationSelected[p.id]) return; // skip unchecked envelopes
      const entry = calibrationValues[p.id];
      if (!entry) return;
      const totalValue = parseFloat(entry.totalValue);
      if (isNaN(totalValue) || totalValue < 0) return;

      dataService.addCalibration({
        portfolio_id: p.id,
        date: calibrationDate,
        total_value: totalValue,
        asset_breakdown: buildAssetBreakdown(p.id),
      });
      savedCount++;
    });

    if (savedCount > 0) {
      toast.success(L(`${savedCount} enveloppe${savedCount > 1 ? 's' : ''} calibrée${savedCount > 1 ? 's' : ''} ✓`, `${savedCount} envelope${savedCount > 1 ? 's' : ''} calibrated ✓`));
      refresh();
    } else {
      toast.error(L('Aucune valeur saisie.', 'No value entered.'));
    }
    setCalibrationOpen(false);
  };
  
  // ── Calibration individuelle par enveloppe ──────────────────────────────
  const saveCalibrationForPortfolio = (portfolioId) => {
    const entry = calibrationValues[portfolioId];
    if (!entry) return;
    const totalValue = parseFloat(entry.totalValue);
    if (isNaN(totalValue) || totalValue < 0) { toast.error(L('Valeur invalide.', 'Invalid value.')); return; }
    const effectiveDate = calibrationDateOverrides[portfolioId] || calibrationDate;
    dataService.addCalibration({
      portfolio_id: portfolioId,
      date: effectiveDate,
      total_value: totalValue,
      asset_breakdown: buildAssetBreakdown(portfolioId),
    });
    refresh();
    // Feedback visuel 2 secondes
    setCalibrationConfirmed(prev => ({ ...prev, [portfolioId]: true }));
    setTimeout(() => setCalibrationConfirmed(prev => ({ ...prev, [portfolioId]: false })), 2000);
    // Mettre à jour le "Dernier:" affiché dans la ligne (le refresh() s'en charge)
  };

  // §4 — globalYield est calculé plus haut (périmètre selon le réglage « inclure les livrets »).
  // Rendement annuel par année civile (hors réglementés) — histogramme (4b)
  const annualYieldData = dataService.computeAnnualYields(null);

  // §6 — Portfolio history with calibration (deposits solid + calibrated dotted)
  const [calibrationHistoryData, setCalibrationHistoryData] = useState({ data: [], series: [], hasCalibration: false });
  // Vue du graphique d'évolution : false = synthétique (défaut), true = détaillée
  const [chartDetailView, setChartDetailView] = useState(false);

  // Mois réels de calibration par enveloppe (points sur la courbe calibrée — vue détaillée)
  const calMonthsBySeries = {};
  (calibrationHistoryData.series || []).forEach(s => {
    calMonthsBySeries[s.id] = new Set(dataService.getCalibrations(s.id).map(c => c.date.slice(0, 7)));
  });

  // Données du graphique selon le mode de vue
  const currentChartData = viewByAsset ? assetHistoryData : historyData;
  const currentPieData = viewByAsset ? pieDataAssets : pieDataEnvelopes;
  // Couleur d'une série « enveloppe » par id ; repli sur la palette par index.
  const colorForEnvId = (envId, i) => {
    const pal = dataService.getEnvelopePalette();
    return portfolios.find(p => p.id === envId)?.color || pal[i % pal.length];
  };

  // Nombre de mouvements récurrents actifs — calculé une seule fois par rendu
  // pour éviter deux appels dataService (avec JSON-parse) dans le même JSX.
  const activeMovementsCount = dataService.getRegularMovements().filter(rm => rm.status === 'active').length;

  // Domaine Y pour l'axe fixe du bar chart
  const barYMax = (() => {
    if (!currentChartData.data.length || !currentChartData.series.length) return 1000;
    const max = currentChartData.data.reduce((m, d) => {
      const total = currentChartData.series.reduce((s, ser) => s + (d[ser.id] || 0), 0);
      return Math.max(m, total);
    }, 0);
    return Math.max(1000, Math.ceil(max * 1.1 / 500) * 500);
  })();

  // ── Données pour les en-têtes résumés des sections gamification ─────────
  // gamifEnabled est relu à chaque render (gamifTick le déclenche sur preferencesUpdated)
  const gamifEnabled  = gamificationService.getState()?.preferences?.gamificationEnabled !== false;
  const _questState   = questService.getCurrentQuestState();
  const _challenge    = challengeService.getCurrentChallenge();

  // Texte résumé affiché dans la bande quand la section est repliée
  const questSummary = _questState.allDone
    ? (lang === 'fr' ? '✓ Toutes complétées' : '✓ All completed')
    : lang === 'fr'
      ? `${_questState.completedCount}/${questService.QUEST_CATALOG.length} complétées`
      : `${_questState.completedCount}/${questService.QUEST_CATALOG.length} completed`;

  const _daysRemaining = challengeService.getDaysRemainingInMonth();
  const challengeSummary = _challenge?.isCompleted
    ? L('✓ Défi complété', '✓ Challenge completed')
    : L(`${_daysRemaining} j restants`, `${_daysRemaining} ${_daysRemaining > 1 ? 'days' : 'day'} left`);

  // Conditions d'auto-masquage
  const questDone    = _questState.allDone === true;
  const challengeDone = _challenge?.isCompleted === true;

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      {/* ── Sections gamification — masquées si gamificationEnabled = false ── */}
      {gamifEnabled && (
        <>
          {/* Tutoriel */}
          <CollapsibleGamifSection
            icon="🎓"
            title={lang === 'fr' ? 'Tutoriel' : 'Tutorial'}
            summary={questSummary}
            expanded={gamifSections.quests}
            onToggle={() => toggleSection('quests')}
            done={questDone}
            isHighlight={!questDone}
          >
            <QuestProgress />
          </CollapsibleGamifSection>

          {/* Défi du mois */}
          <CollapsibleGamifSection
            icon="🏆"
            title={L("Défi du mois", "Challenge of the month")}
            summary={challengeSummary}
            expanded={gamifSections.challenge}
            onToggle={() => toggleSection('challenge')}
            done={challengeDone}
          >
            <MonthlyChallengeWidget />
          </CollapsibleGamifSection>

        </>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="w-8 h-8 text-primary shrink-0" />
          <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight">{t("dashboard.title")}</h1>
          <StreakDisplay />
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Calibration button */}
          {portfolios.length > 0 && (
            <Button
              variant={calibrationOverdue ? "default" : "outline"}
              className={`shadow-sm ${calibrationOverdue ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-500 animate-pulse" : ""}`}
              onClick={openCalibrationModal}
              data-testid="calibration-btn"
            >
              <Target className="w-4 h-4 mr-2" />
              {L('Calibrer mes enveloppes', 'Calibrate my envelopes')}
              {calibrationOverdue && <span className="ml-2 w-2 h-2 rounded-full bg-white inline-block" />}
            </Button>
          )}

          {/* Mouvements récurrents */}
          <Button
            variant="outline"
            className="shadow-sm"
            data-testid="regular-movements-btn"
            onClick={() => setRegularMovementsOpen(true)}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {L('Mouvements récurrents', 'Recurring movements')}
            {activeMovementsCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeMovementsCount}
              </Badge>
            )}
          </Button>

          {/* Movement Template Dialog (modèles d'actifs — accès depuis PortfolioDetail) */}
          <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
            <DialogContent className="sm:max-w-lg" data-testid="template-dialog">
              <DialogHeader>
                <DialogTitle className="font-heading">{t("dashboard.movementTemplates")}</DialogTitle>
                <DialogDescription>{t("dashboard.templateDesc")}</DialogDescription>
              </DialogHeader>
              
              <Tabs value={templateTab} onValueChange={setTemplateTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="list" data-testid="template-list-tab">{t("dashboard.templateList")} ({templates.length})</TabsTrigger>
                  <TabsTrigger value="create" data-testid="template-create-tab">{editingTemplate ? t("common.edit") : t("common.create")}</TabsTrigger>
                </TabsList>
                
                <TabsContent value="list" className="mt-4">
                  {templates.length === 0 ? (
                    <div className="text-center py-8">
                      <Bookmark className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                      <p className="text-muted-foreground text-sm">{t("dashboard.noTemplates")}</p>
                      <Button variant="link" onClick={() => setTemplateTab("create")} className="mt-2">{t("dashboard.createFirst")}</Button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {templates.map(tpl => {
                        const p = portfolios.find(x => x.id === tpl.portfolio_id);
                        return (
                          <div key={tpl.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/50 hover:bg-accent transition-colors" data-testid={`template-item-${tpl.id}`}>
                            <div className="flex-1">
                              <p className="font-medium text-sm">{tpl.name}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {p && <Badge variant="outline" className="text-xs">{p.name}</Badge>}
                                {tpl.asset_type && <Badge variant="secondary" className="text-xs">{t(`assetTypes.${tpl.asset_type}`)}</Badge>}
                                <span className="text-xs text-muted-foreground">{tpl.fees_pct}% {t("dashboard.templateFeesPct").toLowerCase()}</span>
                                {tpl.annual_fees_pct > 0 && <span className="text-xs text-muted-foreground">• {tpl.annual_fees_pct}% {t("dashboard.templateAnnualFees").toLowerCase()}</span>}
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editTemplate(tpl)} data-testid={`edit-template-${tpl.id}`}>
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteTemplate(tpl.id)} data-testid={`delete-template-${tpl.id}`}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="create" className="mt-4 space-y-4">
                  <div><Label>{t("dashboard.templateName")}</Label><Input value={templateForm.name} onChange={e => setTemplateForm({...templateForm, name: e.target.value})} placeholder={L("Ex: ETF World", "e.g. World ETF")} data-testid="template-name-input" /></div>
                  <div><Label>{t("dashboard.templatePortfolio")}</Label>
                    <Select value={templateForm.portfolio_id} onValueChange={v => setTemplateForm({...templateForm, portfolio_id: v})}>
                      <SelectTrigger data-testid="template-portfolio-select"><SelectValue placeholder={L("Sélectionner...", "Select...")} /></SelectTrigger>
                      <SelectContent>{portfolios.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({t(`types.${p.type}`)})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("dashboard.templateAssetType")}</Label>
                    {!tplMultiAssetMode && (
                      <Select value={templateForm.asset_type || "none"} onValueChange={v => setTemplateForm({...templateForm, asset_type: v === "none" ? "" : v})}>
                        <SelectTrigger data-testid="template-asset-type-select"><SelectValue placeholder={L("Sélectionner...", "Select...")} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-- Aucun --</SelectItem>
                          {dataService.ASSET_TYPES.filter(type => type !== 'autre').map(type => (
                            <SelectItem key={type} value={type}>{t(`assetTypes.${type}`)}</SelectItem>
                          ))}
                          {customAssetTypes.map(type => (
                            <SelectItem key={`custom_${type}`} value={type}>{type}</SelectItem>
                          ))}
                          <SelectItem value="autre">{t("assetTypes.autre")}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        id="tpl-multi-asset"
                        checked={tplMultiAssetMode}
                        onChange={e => {
                          setTplMultiAssetMode(e.target.checked);
                          if (!e.target.checked) setTplMultiAssetAllocations([]);
                        }}
                        className="h-4 w-4 cursor-pointer"
                      />
                      <label htmlFor="tpl-multi-asset" className="text-sm cursor-pointer">{L("Types d'actifs multiples", 'Multiple asset types')}</label>
                      {tplMultiAssetMode && (
                        <Button variant="outline" size="sm" onClick={() => setTplMultiAssetModalOpen(true)} className="ml-2">
                          {L('Configurer', 'Configure')} ({tplMultiAssetAllocations.length} {L('type', 'type')}{tplMultiAssetAllocations.length !== 1 ? 's' : ''})
                        </Button>
                      )}
                    </div>
                    {tplMultiAssetMode && tplMultiAssetAllocations.length > 0 && (() => {
                      const totalPct = tplMultiAssetAllocations.reduce((s, a) => s + (parseFloat(a.pct) || 0), 0);
                      return (
                        <p className={`text-xs mt-1 ${Math.abs(totalPct - 100) < 0.01 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {L('Total :', 'Total:')} {totalPct.toFixed(0)} % {Math.abs(totalPct - 100) < 0.01 ? '✓' : L('(doit être 100%)', '(must be 100%)')}
                        </p>
                      );
                    })()}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>{templateForm.fees_type === 'euro' ? 'Frais versement (€)' : t("dashboard.templateFeesPct")}</Label>
                      <div className="flex items-center gap-1">
                        <Input type="number" step="0.01" min="0" value={templateForm.fees_pct} onChange={e => setTemplateForm({...templateForm, fees_pct: e.target.value})} data-testid="template-fees-input" className="flex-1 min-w-0" />
                        <div className="flex rounded-md border border-input overflow-hidden shrink-0 h-9">
                          <button type="button" onClick={() => setTemplateForm({...templateForm, fees_type: 'percent'})} className={`px-2 text-sm ${templateForm.fees_type !== 'euro' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>%</button>
                          <button type="button" onClick={() => setTemplateForm({...templateForm, fees_type: 'euro'})} className={`px-2 text-sm ${templateForm.fees_type === 'euro' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>€</button>
                        </div>
                      </div>
                    </div>
                    <div><Label>{t("dashboard.templateAnnualFees")}</Label><Input type="number" step="0.01" min="0" value={templateForm.annual_fees_pct} onChange={e => setTemplateForm({...templateForm, annual_fees_pct: e.target.value})} data-testid="template-annual-fees-input" /></div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    {editingTemplate && <Button variant="secondary" onClick={cancelEditTemplate}>{t("common.cancel")}</Button>}
                    <Button onClick={handleCreateOrUpdateTemplate} disabled={!templateForm.name || !templateForm.portfolio_id} className="flex-1" data-testid="confirm-template-btn">
                      {editingTemplate ? t("common.save") : t("common.create")}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>

          {/* Template Multi-Asset Modal */}
          <Dialog open={tplMultiAssetModalOpen} onOpenChange={setTplMultiAssetModalOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-heading">{L("Répartition par type d'actif", 'Breakdown by asset type')}</DialogTitle>
                <DialogDescription>{L('Cochez les types et saisissez les pourcentages (total = 100%)', 'Check the types and enter the percentages (total = 100%)')}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {[...dataService.ASSET_TYPES.filter(type => type !== 'autre'), ...customAssetTypes, 'autre'].map(type => {
                  const alloc = tplMultiAssetAllocations.find(a => a.assetType === type);
                  const checked = !!alloc;
                  const displayName = dataService.ASSET_TYPES.includes(type) ? t(`assetTypes.${type}`) : type;
                  return (
                    <div key={type} className="space-y-1">
                      <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/30">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => {
                            if (e.target.checked) {
                              setTplMultiAssetAllocations([...tplMultiAssetAllocations, { assetType: type, customName: '', pct: 0 }]);
                            } else {
                              setTplMultiAssetAllocations(tplMultiAssetAllocations.filter(a => a.assetType !== type));
                            }
                          }}
                          className="h-4 w-4 cursor-pointer flex-shrink-0"
                        />
                        <span className="flex-1 text-sm">{displayName}</span>
                        {checked && (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number" min="0" max="100" step="1"
                              value={alloc.pct}
                              onChange={e => setTplMultiAssetAllocations(tplMultiAssetAllocations.map(a =>
                                a.assetType === type ? { ...a, pct: parseFloat(e.target.value) || 0 } : a
                              ))}
                              className="w-20 h-8 text-sm"
                            />
                            <span className="text-sm text-muted-foreground">%</span>
                          </div>
                        )}
                      </div>
                      {checked && type === 'autre' && (
                        <div className="ml-7 pl-2">
                          <Input
                            placeholder={L("Nom du type d'actif...", 'Asset type name...')}
                            value={alloc.customName || ''}
                            onChange={e => setTplMultiAssetAllocations(tplMultiAssetAllocations.map(a =>
                              a.assetType === 'autre' ? { ...a, customName: e.target.value } : a
                            ))}
                            className="h-8 text-sm"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {tplMultiAssetAllocations.length > 0 && (() => {
                const total = tplMultiAssetAllocations.reduce((s, a) => s + (parseFloat(a.pct) || 0), 0);
                return (
                  <p className={`text-sm font-medium ${Math.abs(total - 100) < 0.01 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {L('Total :', 'Total:')} {total.toFixed(0)} % {Math.abs(total - 100) < 0.01 ? '✓' : L('— manque ', '— missing ') + (100 - total).toFixed(0) + ' %'}
                  </p>
                );
              })()}
              <DialogFooter>
                <Button onClick={() => setTplMultiAssetModalOpen(false)}>{t("common.save")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Portfolio Dialog */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 shadow-md" data-testid="create-portfolio-btn">
                <Plus className="w-4 h-4 mr-2" /> {t("dashboard.createPortfolio")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md" data-testid="create-portfolio-dialog">
              <DialogHeader>
                <DialogTitle className="font-heading">{t("dashboard.createPortfolio")}</DialogTitle>
                <DialogDescription>{t("portfolio.name")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div><Label>{t("portfolio.name")}</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} data-testid="portfolio-name-input" /></div>
                <div>
                  <Label>{L('Couleur', 'Colour')}</Label>
                  <ColorSwatchPicker
                    value={form.color || (dataService.getEnvelopePalette().find(c => !portfolios.some(p => p.color === c)) || dataService.getEnvelopePalette()[0])}
                    onChange={(c) => setForm({ ...form, color: c })}
                    className="mt-1.5"
                  />
                </div>
                <div><Label>{t("portfolio.type")}</Label>
                  <Select value={form.type} onValueChange={v => setForm({...form, type: v, annual_fees_pct: v === 'compte_réglementé' ? 0 : form.annual_fees_pct, regulated_subtype: v === 'compte_réglementé' ? 'livret_a' : form.regulated_subtype, include_in_tax_report: v === 'compte_réglementé' ? false : true, annual_return_rate: v === 'compte_réglementé' ? String(dataService.DEFAULT_RATES?.['compte_réglementé'] ?? 2.4) : (form.type === 'compte_réglementé' ? '' : form.annual_return_rate)})}>
                    <SelectTrigger data-testid="portfolio-type-select"><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map(ty => <SelectItem key={ty} value={ty}>{t(`types.${ty}`)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {/* Sous-type + rendement cible pour compte réglementé */}
                {form.type === 'compte_réglementé' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Sous-type</Label>
                      <Select value={form.regulated_subtype} onValueChange={v => setForm({...form, regulated_subtype: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="livret_a">Livret A</SelectItem>
                          <SelectItem value="ldds">LDDS</SelectItem>
                          <SelectItem value="lep">LEP</SelectItem>
                          <SelectItem value="autre">{L("Autre livret réglementé", "Other regulated savings account")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>{t("portfolio.annualRate")}</Label>
                      <Input type="number" step="0.1" value={form.annual_return_rate} onChange={e => setForm({...form, annual_return_rate: e.target.value})} data-testid="portfolio-reg-rate-input" />
                    </div>
                  </div>
                )}
                <div><Label>{t("portfolio.contractStart")}</Label><Input type="date" value={form.contract_start_date} onChange={e => setForm({...form, contract_start_date: e.target.value})} data-testid="portfolio-date-input" /></div>
                {form.type !== 'compte_réglementé' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>{form.annual_fees_type === 'euro' ? L('Frais annuels (€/an)', 'Annual fees (€/yr)') : t("portfolio.annualFees")}</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number" step="0.1"
                          value={form.annual_fees_pct}
                          onChange={e => setForm({...form, annual_fees_pct: e.target.value})}
                          data-testid="portfolio-fees-input"
                          className="flex-1 min-w-0"
                        />
                        <div className="flex rounded-md border border-input overflow-hidden shrink-0 h-9">
                          <button type="button" onClick={() => setForm({...form, annual_fees_type: 'percent'})} className={`px-2 text-sm ${form.annual_fees_type !== 'euro' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>%</button>
                          <button type="button" onClick={() => setForm({...form, annual_fees_type: 'euro'})} className={`px-2 text-sm ${form.annual_fees_type === 'euro' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>€</button>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label>{t("portfolio.annualRate")}</Label>
                      <Input type="number" step="0.1" placeholder="Auto" value={form.annual_return_rate} onChange={e => setForm({...form, annual_return_rate: e.target.value})} data-testid="portfolio-rate-input" />
                    </div>
                  </div>
                )}
                {form.type !== 'compte_réglementé' && (
                  <div className="flex items-center gap-3 pt-1">
                    <input
                      type="checkbox"
                      id="create-fiscal-checkbox"
                      checked={form.include_in_tax_report !== false}
                      onChange={e => setForm({...form, include_in_tax_report: e.target.checked})}
                      data-testid="portfolio-tax-report-checkbox"
                    />
                    <Label htmlFor="create-fiscal-checkbox" className="cursor-pointer font-normal">
                      {t("portfolio_tax.includeInReport") || "Inclure dans mon rapport fiscal"}
                    </Label>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
                <Button onClick={handleCreate} disabled={!form.name} data-testid="confirm-create-btn">{t("common.create")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards — 3-column layout: [Valeur totale] [Mouvements] [Frais+Cash stacked] */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* §4 — Total value + global yield (wider) */}
        <Card className="border border-border shadow-sm hover:shadow-md transition-all duration-300" data-testid="summary-card-0">
          <CardContent className="p-5">
            <div className="flex items-center justify-between min-w-0">
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="text-sm text-muted-foreground font-medium truncate">{t("dashboard.totalValue")}</p>
                <p className="text-base sm:text-lg lg:text-xl xl:text-2xl font-heading font-bold mt-1 tabular-nums truncate text-primary">{fmt(totalValue)}</p>
                {globalYield && (
                  <p className={`text-sm font-semibold mt-1 tabular-nums ${globalYield.totalGain >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {globalYield.totalGain >= 0 ? '+' : ''}{fmt(globalYield.totalGain)} · {globalYield.yieldPct >= 0 ? '+' : ''}{globalYield.yieldPct}%
                  </p>
                )}
                {/* Rendement money-weighted annualisé (XIRR) depuis l'origine — livrets exclus */}
                {globalYield && globalYield.xirrPct != null && (
                  <p
                    className={`text-[11px] mt-0.5 tabular-nums cursor-help ${globalYield.xirrPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                    title={L("Rendement réel de votre argent investi depuis l'origine, tenant compte des dates et montants de vos versements (Dietz modifiée).", "Real return on your invested money since inception, accounting for the dates and amounts of your deposits (Modified Dietz).")}
                  >
                    {globalYield.xirrPct >= 0 ? '+' : ''}{globalYield.xirrPct}%/{L('an', 'yr')} <span className="text-muted-foreground font-normal">{L("depuis l'origine", 'since inception')}</span>
                  </p>
                )}
                {/* §4 — note explicative quand la valeur calibrée est sous les versements */}
                {globalYield && globalYield.totalGain < 0 && (
                  <p className="text-[10px] text-muted-foreground/80 mt-0.5 leading-snug">
                    {L('Valeur calibrée inférieure aux versements — performance négative à ce jour', 'Calibrated value below deposits — negative performance to date')}
                  </p>
                )}
                {!includeLivrets && regulatedTotal > 0 && (
                  <p
                    className="text-xs text-muted-foreground mt-1 pt-1 border-t border-border/50 truncate cursor-help"
                    title={L("Les livrets réglementés sont exclus du calcul de performance et affichés séparément.", "Regulated savings accounts are excluded from the performance calculation and shown separately.")}
                  >
                    {L('Livrets réglementés :', 'Regulated savings:')} {fmt(regulatedTotal)}
                  </p>
                )}
                {/* §4 — Réglage : inclure les livrets réglementés dans la performance (affichage seulement) */}
                {regulatedPortfolios.length > 0 && (
                  <label className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50 cursor-pointer">
                    <Switch
                      checked={includeLivrets}
                      onCheckedChange={(v) => { setIncludeLivrets(v); dataService.saveAppPreferences({ includeRegulatedInPerf: v }); }}
                      className="scale-75 origin-left shrink-0"
                    />
                    <span
                      className="text-[11px] text-muted-foreground leading-snug"
                      title={L("Affichage uniquement : inclut les livrets réglementés dans la valeur totale, le rendement et les graphiques. N'affecte pas le rapport fiscal, qui les traite toujours séparément.", "Display only: includes regulated savings in total value, yield and charts. Does not affect the tax report, which always treats them separately.")}
                    >
                      {L('Inclure les livrets réglementés dans la performance', 'Include regulated savings in performance')}
                    </span>
                  </label>
                )}
              </div>
              <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center flex-shrink-0 ml-2">
                <Briefcase className="w-5 h-5 text-primary" strokeWidth={1.5} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* §5 — Merged deposits + withdrawals (wider) */}
        <Card className="border border-border shadow-sm hover:shadow-md transition-all duration-300" data-testid="summary-card-1">
          <CardContent className="p-5">
            <div className="flex items-start justify-between min-w-0">
              <div className="min-w-0 flex-1 overflow-hidden space-y-1">
                <p className="text-sm text-muted-foreground font-medium">{L('Mouvements', 'Movements')}</p>
                <div className="flex items-center gap-1.5">
                  <ArrowDownLeft className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-base font-semibold tabular-nums text-emerald-600 truncate">{fmt(totalDeposits)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ArrowUpRight className="w-4 h-4 text-rose-500 shrink-0" />
                  <span className="text-base font-semibold tabular-nums text-rose-500 truncate">{fmt(totalWithdrawals)}</span>
                </div>
                <div className="border-t pt-0.5">
                  <span className="text-sm text-muted-foreground">{L('Net :', 'Net:')} </span>
                  <span className={`text-sm font-semibold tabular-nums ${totalDeposits - totalWithdrawals >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{fmt(totalDeposits - totalWithdrawals)}</span>
                </div>
                {!includeLivrets && regulatedDeposits > 0 && (
                  <p
                    className="text-xs text-muted-foreground pt-0.5 truncate cursor-help"
                    title={L("Les livrets réglementés sont exclus du calcul de performance et affichés séparément.", "Regulated savings accounts are excluded from the performance calculation and shown separately.")}
                  >
                    {L('dont livrets réglementés :', 'incl. regulated savings:')} {fmt(regulatedDeposits)}
                  </p>
                )}
              </div>
              <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center flex-shrink-0 ml-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" strokeWidth={1.5} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right column: Frais + Cash stacked compactly */}
        <div className="sm:col-span-2 lg:col-span-1 grid grid-cols-2 lg:grid-cols-1 gap-4">
          {/* Total fees — composant partagé */}
          <div data-testid="summary-card-2">
            <TotalFeesCard
              totalFees={totalFees}
              label={t("dashboard.totalFees")}
              onExpand={() => { setFeeModalOpen(true); try { challengeService.markVisit('viewFeeDetail'); } catch (_) {} }}
              expandLabel={t("dashboard.feeBreakdownTitle") || "Détail des frais par enveloppe"}
            />
          </div>

          {/* Détail des frais par enveloppe */}
          <Dialog open={feeModalOpen} onOpenChange={setFeeModalOpen}>
            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("dashboard.feeBreakdownTitle") || "Détail des frais par enveloppe"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                {feeBreakdown.length === 0 && (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    {t("dashboard.noFees") || "Aucuns frais enregistrés pour le moment."}
                  </p>
                )}
                {feeBreakdown.map((p) => {
                  const annual   = p.annual_fees_accumulated || 0;
                  const movement = p.transaction_fees || 0;
                  const total    = p.total_fees || 0;
                  return (
                    <div
                      key={p.id}
                      className="rounded-lg border border-border p-3"
                      style={{ backgroundColor: envTintBg(p.color), color: envTextColor(p.color) }}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color || '#9CA3AF' }} />
                        <span className="text-sm font-semibold truncate">{p.name}</span>
                      </div>
                      <div className="space-y-1 text-xs pl-[18px]">
                        {/* Couleur explicite : la tuile porte la couleur de l'enveloppe. */}
                        <div className="flex justify-between gap-3">
                          <span style={{ color: envMutedTextColor(p.color) }}>{t("dashboard.annualFeesLabel") || "Frais annuels"}</span>
                          <span className="tabular-nums">{fmt(annual)}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span style={{ color: envMutedTextColor(p.color) }}>{t("dashboard.movementFeesLabel") || "Frais de versement/retrait"}</span>
                          <span className="tabular-nums">{fmt(movement)}</span>
                        </div>
                        <div className="flex justify-between gap-3 pt-1 mt-1 border-t border-border/60">
                          <span className="font-semibold">{t("common.total") || "Total"}</span>
                          <span className="tabular-nums font-bold text-amber-600 dark:text-amber-400">{fmt(total)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between items-center gap-3 border-t pt-3 mt-1">
                <span className="text-sm font-bold">{t("dashboard.grandTotalFees") || "Total général"}</span>
                <span className="text-base font-heading font-bold tabular-nums text-amber-600 dark:text-amber-400">{fmt(totalFees)}</span>
              </div>
            </DialogContent>
          </Dialog>

          {/* Total cash — compact, cliquable vers le détail par enveloppe (comme les frais).
              Le libellé reste un GlossaryTerm : on n'ouvre donc le détail QUE depuis la
              carte, sans intercepter le clic sur le terme du glossaire. */}
          <Card
            className="border border-border shadow-sm transition-all duration-300 hover:shadow-md cursor-pointer hover:border-blue-400/60 hover:bg-accent/30"
            onClick={() => setCashModalOpen(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCashModalOpen(true); } }}
            aria-label={t("dashboard.cashBreakdownTitle")}
            data-testid="summary-card-3"
          >
            <CardContent className="p-3">
              <div className="flex items-center justify-between min-w-0">
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="text-xs text-muted-foreground font-medium truncate"><GlossaryTerm id="especes">{t("dashboard.totalCash")}</GlossaryTerm></p>
                  <p className="text-sm sm:text-base font-heading font-bold mt-0.5 tabular-nums truncate text-blue-600 dark:text-blue-400">{fmt(totalCash)}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                  <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-blue-600 dark:text-blue-400" strokeWidth={1.5} />
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" strokeWidth={2} aria-hidden="true" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Détail des espèces par enveloppe */}
          <Dialog open={cashModalOpen} onOpenChange={setCashModalOpen}>
            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("dashboard.cashBreakdownTitle")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                {cashBreakdown.length === 0 && (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    {t("dashboard.noCash")}
                  </p>
                )}
                {cashBreakdown.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-lg border border-border p-3 flex items-center justify-between gap-3"
                    style={{ backgroundColor: envTintBg(p.color), color: envTextColor(p.color) }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color || '#9CA3AF' }} />
                      <span className="text-sm font-semibold truncate">{p.name}</span>
                    </div>
                    {/* Pas de couleur imposée : la ligne porte déjà une teinte propre à
                        l'enveloppe et une couleur de texte calculée pour contraster avec
                        elle. Forcer du bleu rendait le montant illisible sur une enveloppe
                        aux tons chauds. */}
                    <span className="text-sm tabular-nums font-bold flex-shrink-0">
                      {fmt(p.cash_balance || 0)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center gap-3 border-t pt-3 mt-1">
                <span className="text-sm font-bold">{t("dashboard.grandTotalCash")}</span>
                <span className="text-base font-heading font-bold tabular-nums text-blue-600 dark:text-blue-400">{fmt(totalCash)}</span>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {portfolios.length === 0 ? (
        <Card className="border-dashed border-2 border-border"><CardContent className="p-12 text-center">
          <Briefcase className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">{t("dashboard.noPortfolios")}</p>
        </CardContent></Card>
      ) : (
        <>
          {/* §6 — Évolution des enveloppes (composant partagé avec le simulateur) */}
          {calibrationHistoryData.data.length > 1 && (
            <EnvelopeEvolutionChart
              historyData={calibrationHistoryData}
              getColor={colorForEnvId}
              calMonthsBySeries={calMonthsBySeries}
              detailView={chartDetailView}
              onToggleView={() => setChartDetailView(v => !v)}
              title={t("dashboard.evolutionChart")}
              emptyHint={lang === 'en' ? "Calibrate your envelopes to display the real portfolio value." : "Calibrez vos enveloppes pour afficher la valeur réelle du portefeuille."}
            />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Pie Chart with Switch */}
            <Card className="lg:col-span-5 border border-border shadow-sm" data-testid="allocation-chart">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <CardTitle className="font-heading text-lg">
                    {viewByAsset ? t("dashboard.allocationAssets") : t("dashboard.allocation")}
                  </CardTitle>
                  <div className="flex flex-col items-start sm:items-end gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{t("dashboard.viewByEnvelope")}</span>
                      <Switch
                        checked={viewByAsset}
                        onCheckedChange={setViewByAsset}
                        data-testid="view-switch-pie"
                      />
                      <span className="text-xs text-muted-foreground">{t("dashboard.viewByAsset")}</span>
                    </div>
                    {/* Base d'allocation : versements vs valeur réelle (vues enveloppe ET actif) */}
                    <div
                      className="flex items-center gap-2"
                      title={!hasAnyCalibration
                        ? L('Aucune calibration disponible — calibrez vos enveloppes pour activer cette vue.', 'No calibration available — calibrate your envelopes to enable this view.')
                        : ''}
                    >
                      <span className={`text-xs ${!allocRealValue ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{L('Versements', 'Deposits')}</span>
                      <Switch
                        checked={useRealValueAlloc}
                        disabled={!hasAnyCalibration}
                        onCheckedChange={setAllocRealValue}
                        data-testid="alloc-value-switch"
                      />
                      <span className={`text-xs ${useRealValueAlloc ? 'text-foreground font-medium' : 'text-muted-foreground'} ${!hasAnyCalibration ? 'opacity-50' : ''}`}>{L('Valeur réelle', 'Real value')}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {currentPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={currentPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                        {currentPieData.map((d, i) => <Cell key={i} fill={viewByAsset ? dataService.getAssetColor(d.type, i) : (d?.color || dataService.getEnvelopePalette()[i % dataService.getEnvelopePalette().length])} />)}
                      </Pie>
                      <Tooltip
                        formatter={(v, name) => {
                          const total = currentPieData.reduce((s, d) => s + d.value, 0);
                          const pct = total > 0 ? Math.round(v / total * 100) : 0;
                          return [`${fmt(v)} — ${pct} %`, name];
                        }}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                        wrapperStyle={{ opacity: 1 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-muted-foreground text-center py-8">{t("dashboard.noPortfolios")}</p>}
                {useRealValueAlloc && (
                  <p className="text-[11px] text-muted-foreground/80 text-center mt-2 leading-snug">
                    {L('Basé sur les calibrations les plus récentes. Les versements seuls sont affichés pour les enveloppes non calibrées.',
                       'Based on the most recent calibrations. Deposits only are shown for uncalibrated envelopes.')}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Portfolio Table — §3: envelope count as subtitle */}
            <Card className="lg:col-span-7 border border-border shadow-sm" data-testid="portfolio-table">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="font-heading text-lg">{t("dashboard.portfolios")}</CardTitle>
                  <Badge variant="secondary">{portfolios.length} {L('enveloppe', 'envelope')}{portfolios.length !== 1 ? 's' : ''}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Table><TableHeader><TableRow>
                  <TableHead>{t("portfolio.name")}</TableHead><TableHead>{t("portfolio.type")}</TableHead>
                  <TableHead className="text-right">{t("portfolio.balance")}</TableHead>
                  <TableHead className="text-right">{t("portfolio.deposits")}</TableHead><TableHead className="hidden sm:table-cell"></TableHead>
                </TableRow></TableHeader>
                <TableBody>{portfolios.map((p) => {
                  // Plus/moins-value latente (%) : (valeur calibrée − capital net investi) / capital net investi
                  const lastCal  = dataService.getCalibrations(p.id).slice(-1)[0];
                  const invested = (p.total_deposits || 0) - (p.total_withdrawals || 0);
                  // Livrets réglementés exclus de la plus/moins-value (section 3a)
                  const gainPct  = (p.type !== 'compte_réglementé' && lastCal && invested > 0)
                    ? ((lastCal.total_value - invested) / invested) * 100
                    : null;
                  // « Solde » = valeur calibrée la plus récente si l'enveloppe est calibrée,
                  // sinon le solde des versements (cohérent avec la plus-value affichée).
                  const soldeValue = lastCal ? lastCal.total_value : p.balance;
                  // Maturité fiscale : PEA > 5 ans, assurance vie > 8 ans
                  const maturity   = getTaxMaturity(p);
                  const matLabels  = taxMaturityLabels(maturity, lang === 'en');
                  return (
                  <TableRow
                    key={p.id}
                    className="group cursor-pointer hover:!bg-accent/50 transition-colors"
                    onClick={() => navigate(`/portfolio/${p.id}`)}
                    data-testid={`portfolio-row-${p.id}`}
                    // Ligne pleine dans la couleur de l'enveloppe + texte à contraste auto.
                    // Liseré vert en style inline (et non via une classe) : TableBody
                    // remet `border-0` sur la dernière ligne, qui l'effacerait.
                    style={{
                      backgroundColor: envTintBg(p.color),
                      color: envTextColor(p.color),
                      ...(matLabels ? { borderLeft: '4px solid #10B981' } : {}),
                    }}
                  >
                    <TableCell className="font-medium">
                      <div>
                        <span>{p.name}</span>
                        {matLabels && (
                          // Pastille pleine (et non icône colorée nue) : la ligne peut
                          // prendre n'importe quelle couleur d'enveloppe, un vert sur
                          // vert deviendrait invisible.
                          <span
                            className="inline-flex items-center align-middle ml-1.5 rounded-full bg-emerald-500 p-0.5"
                            title={matLabels.tooltip}
                            aria-label={matLabels.badge}
                            data-testid={`tax-mature-${p.id}`}
                          >
                            <ShieldCheck className="w-3 h-3 text-white" />
                          </span>
                        )}
                        {p.regulated_subtype && p.type === 'compte_réglementé' && (
                          // Couleur explicite : la ligne porte la couleur de l'enveloppe,
                          // le gris du thème y est illisible (fond clair comme foncé).
                          <span className="block text-xs mt-0.5" style={{ color: envMutedTextColor(p.color) }}>
                            {p.regulated_subtype === 'livret_a' ? 'Livret A' : p.regulated_subtype === 'ldds' ? 'LDDS' : p.regulated_subtype === 'lep' ? 'LEP' : 'Autre livret'}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{t(`types.${p.type}`)}</Badge></TableCell>
                    <TableCell className="text-right font-mono tabular-nums font-medium">
                      <div>{fmt(soldeValue)}</div>
                      {gainPct !== null && (
                        <div className="text-xs font-normal" style={{ color: envGainColor(p.color, gainPct >= 0) }}>
                          {gainPct >= 0 ? '+' : '−'}{Math.abs(gainPct).toFixed(1)} %
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums" style={{ color: envMutedTextColor(p.color) }}>{fmt(p.net_deposits)}</TableCell>
                    <TableCell className="hidden sm:table-cell text-right">
                      <Button variant="ghost" size="sm" data-testid={`view-portfolio-${p.id}`}><ChevronRight className="w-4 h-4" /></Button>
                    </TableCell>
                  </TableRow>
                  );
                })}</TableBody></Table>
                {/* Légende de l'indicateur de maturité fiscale — affichée seulement
                    si au moins une enveloppe a franchi son seuil. */}
                {portfolios.some(p => getTaxMaturity(p)?.isMature) && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    {L("Enveloppe assez ancienne pour bénéficier de sa fiscalité avantageuse (PEA > 5 ans, assurance vie > 8 ans).",
                       "Envelope old enough to benefit from its favourable tax treatment (PEA > 5 yrs, life insurance > 8 yrs).")}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Bar Chart - Cumulative Savings with Switch */}
          {currentChartData && currentChartData.data && currentChartData.data.length > 0 && currentChartData.series && currentChartData.series.length > 0 && (
            <Card className="border border-border shadow-sm mt-6" data-testid="cumulative-savings-chart">
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <CardTitle className="font-heading text-lg">
                    {useRealValueChart
                      ? (viewByAsset ? L('Valeur réelle par actif', 'Real value by asset') : L('Valeur réelle par enveloppe', 'Real value by envelope'))
                      : (viewByAsset ? t("dashboard.cumulativeSavingsAssets") : t("dashboard.cumulativeSavings"))}
                  </CardTitle>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{t("dashboard.viewByEnvelope")}</span>
                      <Switch
                        checked={viewByAsset}
                        onCheckedChange={setViewByAsset}
                        data-testid="view-switch-bar"
                      />
                      <span className="text-xs text-muted-foreground">{t("dashboard.viewByAsset")}</span>
                    </div>
                    {/* Base d'affichage : versements cumulés vs valeur réelle (calibrée) */}
                    <div
                      className="flex items-center gap-2"
                      title={!hasAnyCalibration
                        ? L('Aucune calibration disponible — calibrez vos enveloppes pour activer cette vue.', 'No calibration available — calibrate your envelopes to enable this view.')
                        : ''}
                    >
                      <span className={`text-xs ${!useRealValueChart ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{L('Versements', 'Deposits')}</span>
                      <Switch
                        checked={useRealValueChart}
                        disabled={!hasAnyCalibration}
                        onCheckedChange={setChartRealValue}
                        data-testid="chart-value-switch"
                      />
                      <span className={`text-xs ${useRealValueChart ? 'text-foreground font-medium' : 'text-muted-foreground'} ${!hasAnyCalibration ? 'opacity-50' : ''}`}>{L('Valeur réelle', 'Real value')}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Légende fixe en haut */}
                <div className="flex flex-wrap gap-4 mb-4 pb-3 border-b border-border">
                  {currentChartData.series.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-sm"
                        style={{ backgroundColor: viewByAsset ? dataService.getAssetColor(s.name, i) : colorForEnvId(s.id, i) }}
                      />
                      <span className="text-sm font-medium">
                        {viewByAsset && s.name !== 'non_defini' ? t(`assetTypes.${s.name}`) : (s.name === 'non_defini' ? 'Non défini' : s.name)}
                      </span>
                    </div>
                  ))}
                </div>
                
                {/* Deux panneaux : axe Y fixe + zone de défilement */}
                <div className="flex gap-0">
                  {/* Panneau Y-axis fixe */}
                  <div style={{ width: 58, flexShrink: 0 }}>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={currentChartData.data} margin={{ top: 5, right: 0, bottom: 50, left: 5 }}>
                        <YAxis
                          tick={{ fontSize: 10 }}
                          stroke="hsl(var(--muted-foreground))"
                          tickFormatter={v => `${(v/1000).toFixed(0)}k`}
                          domain={[0, barYMax]}
                          width={52}
                        />
                        {currentChartData.series.map(s => (
                          <Bar key={s.id} dataKey={s.id} fill="transparent" stackId="stack" />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Panneau scrollable */}
                  <div
                    ref={barChartScrollRef}
                    className="overflow-x-auto pb-2 flex-1 scrollbar-thick"
                  >
                    <div style={{ minWidth: Math.max(600, currentChartData.data.length * 25) }}>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={currentChartData.data} barCategoryGap="8%">
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="month"
                            tick={{ fontSize: 9 }}
                            stroke="hsl(var(--muted-foreground))"
                            interval={0}
                            angle={-45}
                            textAnchor="end"
                            height={50}
                          />
                          <YAxis hide domain={[0, barYMax]} />
                          <Tooltip
                            formatter={(v, name) => [fmt(v), viewByAsset && name !== 'non_defini' ? t(`assetTypes.${name}`) : (name === 'non_defini' ? 'Non défini' : name)]}
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 8
                            }}
                            wrapperStyle={{ opacity: 1 }}
                            labelStyle={{ fontWeight: 'bold', marginBottom: 4 }}
                          />
                          {currentChartData.series.map((s, i) => (
                            <Bar
                              key={s.id}
                              dataKey={s.id}
                              stackId="stack"
                              fill={viewByAsset ? dataService.getAssetColor(s.name, i) : colorForEnvId(s.id, i)}
                              name={s.name}
                              radius={i === currentChartData.series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
                {currentChartData.data.length > 13 && (
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    {L('← Faites défiler horizontalement pour voir les mois précédents →', '← Scroll horizontally to see earlier months →')}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* §4b — Histogramme du rendement annuel du portefeuille (hors réglementés) */}
          <Card className="border border-border shadow-sm mt-6" data-testid="annual-yield-chart">
            <CardHeader>
              <CardTitle className="font-heading text-lg"><GlossaryTerm id="rendement_annuel">{L('Rendement annuel du portefeuille', 'Portfolio annual return')}</GlossaryTerm></CardTitle>
            </CardHeader>
            <CardContent>
              <AnnualYieldChart data={annualYieldData} height={260} />
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Calibration Modal ─────────────────────────────────────────────── */}
      <CalibrationModal
        open={calibrationOpen}
        onClose={() => setCalibrationOpen(false)}
        onSaved={refresh}
      />

      {/* ── Mouvements récurrents ────────────────────────────────────────── */}
      <RegularMovementsPanel
        open={regularMovementsOpen}
        onClose={() => setRegularMovementsOpen(false)}
        portfolios={portfolios}
        onSaved={refresh}
      />
      <Disclaimer />
    </div>
  );
}

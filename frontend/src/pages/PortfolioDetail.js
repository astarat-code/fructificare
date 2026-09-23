// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import dataService   from "../services/dataService";
import challengeService from "../services/challengeService";
import gamificationService from "../services/gamificationService";
import questService  from "../services/questService";
import { useLanguage } from "../context/LanguageContext";
import Disclaimer from "../components/ui/Disclaimer";
import CalibrationModal from "../components/CalibrationModal";
import { DIETZ_NOTE } from "../components/ui/Disclaimer";
import { signeFrais } from "../lib/transactionFees";
import { versementsPea } from "../lib/peaCap";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Switch } from "../components/ui/switch";
import ColorSwatchPicker from "../components/ui/ColorSwatchPicker";
import AnnualYieldChart from "../components/ui/AnnualYieldChart";
import { envTintBg, envTextColor, envMutedTextColor } from "../lib/utils";
import GlossaryTerm from "../components/ui/GlossaryTerm";

// Variantes de teinte d'une couleur hex (assombrir / éclaircir) pour les courbes.
function _shadeHex(hex, factor) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || "");
  if (!m) return hex || "#7C3AED";
  const n = parseInt(m[1], 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (factor < 1) { r *= factor; g *= factor; b *= factor; }
  else { const f = factor - 1; r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  const ch = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${((1 << 24) + (ch(r) << 16) + (ch(g) << 8) + ch(b)).toString(16).slice(1)}`;
}
const darkenHex = (hex) => _shadeHex(hex, 0.7);
const lightenHex = (hex) => _shadeHex(hex, 1.35);
import { toast } from "sonner";
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Trash2, Edit2, RefreshCw, BarChart3, TableIcon, AlertTriangle, Wallet, TrendingUp, TrendingDown, Target, Settings, ArrowUpDown, Info } from "lucide-react";
import RegularMovementsPanel from "../components/RegularMovementsPanel";
import DocumentsSection from "../components/DocumentsSection";
import { displayNote } from "../lib/displayNote";

// ── Formateur monétaire partagé ───────────────────────────────────────────────
const fmt = (v) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v ?? 0);


// ── Tuile "Rendements par actif" — composant réutilisé en haut de page ET dans §10 ──
// flat=true : pas de conteneur bordé (pour l'insertion directe dans un CardContent de tuile)
// flat=false (défaut) : boîte avec bordure et fond, pour la grille §10
function PnlAssetCard({ item, label, flat = false }) {
  const { lang } = useLanguage();
  const L = (fr, en) => (lang === 'en' ? en : fr);
  if (item.warning) {
    const inner = (
      <>
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="text-sm font-medium capitalize flex-1 min-w-0 truncate">{label}</span>
        </div>
        <div className="text-xs text-muted-foreground space-y-0.5">
          <div className="flex justify-between">
            <span><GlossaryTerm id="calibration">{L('Valeur calibrée', 'Calibrated value')}</GlossaryTerm></span>
            <span className="tabular-nums font-medium text-foreground">{fmt(item.currentValue)}</span>
          </div>
          <p className="text-amber-600 dark:text-amber-400 pt-0.5">{item.warning}</p>
        </div>
      </>
    );
    if (flat) return <div className="space-y-1">{inner}</div>;
    return (
      <div className="rounded-lg border border-amber-300/60 p-3 space-y-1 bg-amber-50/50 dark:bg-amber-950/20 h-full">
        {inner}
      </div>
    );
  }
  const inner = (
    <>
      <div className="flex items-center justify-between gap-1">
        <span className="text-sm font-medium capitalize flex-1 min-w-0 truncate">{label}</span>
        <Badge
          variant="outline"
          className={`text-xs shrink-0 ${item.pnl >= 0 ? 'text-emerald-600 border-emerald-400' : 'text-rose-600 border-rose-400'}`}
        >
          {item.pnl >= 0 ? '+' : ''}{item.pnlPct.toFixed(1)}%
        </Badge>
      </div>
      <div className="text-xs text-muted-foreground space-y-0.5">
        <div className="flex justify-between">
          <span><GlossaryTerm id="valeur_actuelle">{L('Valeur actuelle', 'Current value')}</GlossaryTerm></span>
          <span className="tabular-nums font-medium text-foreground">{fmt(item.currentValue)}</span>
        </div>
        <div className="flex justify-between">
          <span><GlossaryTerm id="cout_total">{L('Coût total', 'Total cost')}</GlossaryTerm></span>
          <span className="tabular-nums">{fmt(item.costBasis)}</span>
        </div>
        <div className={`flex justify-between font-semibold ${item.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          <span><GlossaryTerm id="pnl">PNL</GlossaryTerm></span>
          <span className="tabular-nums">{item.pnl >= 0 ? '+' : ''}{fmt(item.pnl)}</span>
        </div>
        {item.mixed && (
          <p className="text-amber-600 text-xs pt-0.5 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            {L('Calcul mixte — certains mouvements sans quantité renseignée', 'Mixed calculation — some movements have no quantity')}
          </p>
        )}
      </div>
    </>
  );
  if (flat) return <div className="space-y-1">{inner}</div>;
  return (
    <div className="rounded-lg border p-3 space-y-1 bg-accent/30 h-full">
      {inner}
    </div>
  );
}

export default function PortfolioDetail({ dataSource = null, scope = null, portfolioId: pidProp = null, backHref = "/" } = {}) {
  // Source de données : adaptateur (simulation) ou dataService (tableau de bord, défaut).
  // Permet de réutiliser CETTE page à l'identique pour une enveloppe de simulation.
  const ds = useMemo(() => dataSource || dataService, [dataSource]);
  const params = useParams();
  const id = pidProp || params.id;
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const L = (fr, en) => (lang === 'en' ? en : fr); // libellés codés en dur → bilingues
  const [portfolio, setPortfolio] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [showDataTable, setShowDataTable] = useState(false);
  const [customAssetTypes, setCustomAssetTypes] = useState([]);
  
  // Date d'aujourd'hui pour les valeurs par défaut (format YYYY-MM-DD)
  const getTodayString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const today = getTodayString();
  
  const [txForm, setTxForm] = useState({
    date: today,
    amount: "",
    note: "",
    fees_pct: "",
    fees_type: "percent",
    fee_direction: "deducted", // 'deducted' = frais déduits du montant · 'added' = frais en plus
    annual_fees_pct: "",
    annual_fees_type: "percent",
    template_id: "",
    asset_type: "",
    custom_asset_type: "",
    quantity: "",
    unit_price: "",
  });

  // Panneau "Mouvements réguliers"
  const [regularMovementsOpen, setRegularMovementsOpen] = useState(false);
  // Deux panneaux distincts : mouvements types (modèles réutilisables) et
  // mouvements récurrents (versements/retraits programmés). Ils n'ont rien en commun.
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(null);
  // Calibration (simulation uniquement — le tableau de bord calibre depuis sa page d'accueil)
  const [calibDialog, setCalibDialog] = useState(false);
  const [calibForm, setCalibForm] = useState({ date: "", total_value: "" });
  const [fullCalibOpen, setFullCalibOpen] = useState(false); // modale complète (tableau de bord)
  const [deletePortfolioDialog, setDeletePortfolioDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editTxDialog, setEditTxDialog] = useState(null);
  const [editTxForm, setEditTxForm] = useState({});
  // Choix de financement d'un achat quand des espèces sont disponibles
  const [cashChoice, setCashChoice] = useState(null); // null | { type, keepInCash }

  // Multi-actifs
  const [multiAssetMode, setMultiAssetMode] = useState(false);
  const [multiAssetAllocations, setMultiAssetAllocations] = useState([]);
  const [multiAssetModalOpen, setMultiAssetModalOpen] = useState(false);

  // Pagination de l'historique
  const [txPage, setTxPage] = useState(0);
  const TX_PAGE_SIZE = 100;

  // Tri de l'historique (par défaut : date décroissante = plus récent en haut)
  const [txSort, setTxSort] = useState({ key: 'date', dir: 'desc' });
  const handleSort = (key) => {
    setTxPage(0);
    setTxSort(prev => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      // Date : on commence par décroissant ; autres colonnes : croissant.
      : { key, dir: key === 'date' ? 'desc' : 'asc' });
  };

  // Dialogue de confirmation pour les ventes (conserver en espèces ou non)
  const [withdrawalConfirmDialog, setWithdrawalConfirmDialog] = useState(false);

  const [realYieldData, setRealYieldData] = useState(null);
  const [pnlByAsset, setPnlByAsset] = useState([]);
  const [calYieldByMonth,  setCalYieldByMonth]  = useState({});
  const [allPortfolios,    setAllPortfolios]    = useState([]);

  // §B — Courbe "Rendement cible" : mémorisée par enveloppe dans localStorage
  const [showTargetCurve, setShowTargetCurve] = useState(() => {
    try { return localStorage.getItem(`fructificare_targetCurve_${id}`) === 'true'; } catch { return false; }
  });
  const handleTargetCurveToggle = (val) => {
    setShowTargetCurve(val);
    try { localStorage.setItem(`fructificare_targetCurve_${id}`, val ? 'true' : 'false'); } catch {}
    // Mission 11 (novembre) : affichage du rendement cible activé
    if (val) { try { challengeService.markVisit('targetCurveActivated'); } catch (_) {} }
  };

  const refresh = useCallback(() => {
    const p = ds.getPortfolio(id);
    setPortfolio(p);
    setAllPortfolios(ds.getPortfolios());
    setTransactions(ds.getTransactions(id));
    setTemplates(ds.getMovementTemplates(id));
    // §1 — only calibrated history (no theoretical)
    const realHist = ds.getPortfolioRealHistory(id);
    // Keep only points that have a realValue (calibrated) — or all for the table
    setHistoryData(realHist);
    setCustomAssetTypes(ds.getCustomAssetTypes());
    setRealYieldData(ds.computeRealYield(id));
    setPnlByAsset(ds.getPortfolioPnlByAsset(id));
    // §2 — per-interval yields for tooltip
    const yields = ds.getPortfolioCalibrationYields(id);
    const byMonth = {};
    yields.forEach(y => { byMonth[y.month] = y; });
    setCalYieldByMonth(byMonth);
    if (p) setEditForm({ name: p.name, color: p.color || "", annual_fees_pct: p.annual_fees_pct, annual_fees_type: p.annual_fees_type === 'euro' ? 'euro' : 'percent', annual_return_rate: p.annual_return_rate, contract_start_date: p.contract_start_date || "", include_in_tax_report: p.include_in_tax_report !== false });
  }, [id, ds]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleTemplateSelect = (tplId) => {
    if (!tplId || tplId === "none") {
      setTxForm(f => ({ ...f, template_id: "", fees_pct: "", fees_type: "percent", fee_direction: "deducted", annual_fees_pct: "", annual_fees_type: "percent", asset_type: "" }));
      setMultiAssetMode(false);
      setMultiAssetAllocations([]);
      return;
    }
    const tpl = templates.find(t => t.id === tplId);
    if (tpl) {
      setTxForm(f => ({
        ...f,
        template_id: tplId,
        fees_pct: tpl.fees_pct || "",
        fees_type: tpl.fees_type === 'euro' ? 'euro' : 'percent',
        fee_direction: tpl.fee_direction === 'added' ? 'added' : 'deducted',
        annual_fees_pct: tpl.annual_fees_pct || "",
        annual_fees_type: tpl.annual_fees_type === 'euro' ? 'euro' : 'percent',
        asset_type: tpl.asset_type || "",
        note: tpl.name || f.note,
      }));
      if (tpl.multi_asset_allocations && tpl.multi_asset_allocations.length > 0) {
        setMultiAssetMode(true);
        // Les modèles stockent { type, pct } ; le formulaire multi-actifs de cette
        // page travaille en { assetType, customName, pct }. Normaliser pour que la
        // répartition soit réellement appliquée (sinon asset_type undefined → exclu du camembert).
        setMultiAssetAllocations(tpl.multi_asset_allocations.map((a) => ({
          assetType:  a.assetType ?? a.type,
          customName: a.customName || '',
          pct:        a.pct,
        })));
      } else {
        setMultiAssetMode(false);
        setMultiAssetAllocations([]);
      }
    }
  };

  const resetTxForm = () => {
    setTxForm({
      date: today,
      amount: "",
      note: "",
      fees_pct: "",
      fees_type: "percent",
      fee_direction: "deducted",
      annual_fees_pct: "",
      annual_fees_type: "percent",
      recurrence: "none",
      end_date: today,
      template_id: "",
      asset_type: "",
      custom_asset_type: "",
      quantity: "",
      unit_price: "",
    });
    setMultiAssetMode(false);
    setMultiAssetAllocations([]);
    setTxPage(0);
  };

  const addTransaction = (type, keepInCash = false, fundingSource = null) => {
    if (!txForm.amount || parseFloat(txForm.amount) <= 0) return toast.error(t('portfolio.amountInvalid'));

    // Validation: date du mouvement ne peut pas être antérieure à la date d'ouverture de l'enveloppe
    if (portfolio.contract_start_date && txForm.date < portfolio.contract_start_date) {
      return toast.error(t("portfolio.dateBeforeContractError"));
    }

    // Validation: date de fin ne peut pas être dans le futur
    if (txForm.recurrence && txForm.recurrence !== "none") {
      const endDate = new Date(txForm.end_date);
      const todayDate = new Date(today);
      if (endDate > todayDate) {
        return toast.error(t("portfolio.endDateFutureError") || "La date de fin ne peut pas être dans le futur");
      }
      if (portfolio.contract_start_date && txForm.end_date < portfolio.contract_start_date) {
        return toast.error(t("portfolio.dateBeforeContractError") || "La date ne peut pas être antérieure à la date d'ouverture de l'enveloppe");
      }
    }

    // Achat avec des espèces disponibles → demander à l'utilisateur la source de
    // financement (espèces internes vs argent extérieur) plutôt que de puiser
    // automatiquement dans les espèces. Le choix est mémorisé dans `fundingSource`.
    if (type === 'deposit' && fundingSource == null && (portfolio.cash_balance || 0) > 0) {
      setCashChoice({ type, keepInCash });
      return;
    }

    // Mode multi-actifs
    if (multiAssetMode && multiAssetAllocations.length > 0) {
      const totalPct = multiAssetAllocations.reduce((s, a) => s + (parseFloat(a.pct) || 0), 0);
      if (Math.abs(totalPct - 100) > 0.01) {
        return toast.error(t('portfolio.percentagesTotal100'));
      }
      try {
        const grossAmount = parseFloat(txForm.amount);
        const annualType  = txForm.annual_fees_type === 'euro' ? 'euro' : 'percent';
        const annualInput = parseFloat(txForm.annual_fees_pct) || 0;
        // Un seul groupe pour ce mouvement multi-actifs → 1 chip sur le calendrier
        const groupId = `mg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        for (const alloc of multiAssetAllocations) {
          const allocAmount = Math.round(grossAmount * alloc.pct / 100 * 100) / 100;
          if (allocAmount <= 0) continue;
          const resolvedAssetType = alloc.assetType === 'autre' && alloc.customName?.trim()
            ? alloc.customName.trim()
            : alloc.assetType;
          // Frais annuels € FIXES : répartis au prorata entre les actifs (somme = frais du mouvement).
          // Frais annuels % : taux identique sur chaque actif (appliqué à son montant).
          const allocAnnual = annualType === 'euro' && grossAmount > 0
            ? Math.round(annualInput * (allocAmount / grossAmount) * 100) / 100
            : annualInput;
          const txData = {
            date: txForm.date,
            amount: allocAmount,
            type,
            note: txForm.note,
            fees_pct: parseFloat(txForm.fees_pct) || 0,
            fees_type: txForm.fees_type,
            fee_direction: txForm.fee_direction,
            annual_fees_pct: allocAnnual,
            annual_fees_type: annualType,
            template_id: txForm.template_id || null,
            recurrence: txForm.recurrence,
            end_date: txForm.end_date,
            asset_type: resolvedAssetType,
            custom_asset_type: null,
            movement_group_id: groupId,
            keep_in_cash: type === 'withdrawal' ? keepInCash : false,
            funding_source: fundingSource,
          };
          if (txForm.recurrence && txForm.recurrence !== "none") {
            ds.createRecurringTransactions(id, txData);
          } else {
            ds.createTransaction(id, txData);
          }
        }
        toast.success(t("common.success") + " (multi-actifs)");
        resetTxForm();
        refresh();
      } catch (e) { toast.error(e.message); }
      return;
    }

    try {
      // Résoudre le type d'actif : si "autre" avec nom custom, utiliser le nom comme type direct
      const resolvedAssetType = txForm.asset_type === 'autre' && txForm.custom_asset_type.trim()
        ? txForm.custom_asset_type.trim()
        : txForm.asset_type || null;
      const txData = {
        date: txForm.date,
        amount: parseFloat(txForm.amount),
        type,
        note: txForm.note,
        fees_pct: parseFloat(txForm.fees_pct) || 0,
        fees_type: txForm.fees_type,
        fee_direction: txForm.fee_direction,
        annual_fees_pct: parseFloat(txForm.annual_fees_pct) || 0,
        annual_fees_type: txForm.annual_fees_type === 'euro' ? 'euro' : 'percent',
        template_id: txForm.template_id || null,
        recurrence: txForm.recurrence,
        end_date: txForm.end_date,
        asset_type: resolvedAssetType,
        custom_asset_type: null,
        // Espèces: uniquement pour les ventes
        keep_in_cash: type === 'withdrawal' ? keepInCash : false,
        // Source de financement choisie pour un achat quand des espèces sont dispo
        funding_source: fundingSource,
        // Quantité / prix unitaire (optionnels)
        quantity:   txForm.quantity   !== "" ? txForm.quantity   : null,
        unit_price: txForm.unit_price !== "" ? txForm.unit_price : null,
      };

      if (txForm.recurrence && txForm.recurrence !== "none") {
        ds.createRecurringTransactions(id, txData);
        toast.success(t("common.success") + " (récurrent)");
      } else {
        const newTx = ds.createTransaction(id, txData);
        if (type === 'withdrawal' && keepInCash) {
          toast.success(`${t("common.success")} - ${fmt(newTx.net_amount)} ${t("portfolio.keepInCash").toLowerCase()}`);
        } else if (type === 'deposit' && newTx.from_cash_amount > 0) {
          toast.success(`${t("common.success")} - ${fmt(newTx.from_cash_amount)} ${t("portfolio.fromCash")}, ${fmt(newTx.new_funds_amount)} ${t("portfolio.newFunds")}`);
        } else {
          toast.success(t("common.success"));
        }
      }

      // ── Q4 : mouvement avec frais enregistré ─────────────────────────────
      try {
        const feesPct       = parseFloat(txForm.fees_pct)       || 0;
        const annualFeesPct = parseFloat(txForm.annual_fees_pct) || 0;
        if (feesPct > 0 || annualFeesPct > 0) {
          questService.trackFlag('movementWithFeesAdded');
        }
      } catch (_) {}

      resetTxForm();
      refresh();
    } catch (e) { toast.error(e.message); }
  };

  // Ouvre le dialogue de confirmation pour une vente
  const handleWithdrawalClick = () => {
    if (!txForm.amount || parseFloat(txForm.amount) <= 0) return toast.error(t('portfolio.amountInvalid'));
    setWithdrawalConfirmDialog(true);
  };
  
  // Exécute la vente avec le choix de l'utilisateur
  const confirmWithdrawal = (keepInCash) => {
    setWithdrawalConfirmDialog(false);
    addTransaction('withdrawal', keepInCash);
  };

  const deleteTx = (target) => {
    // Cible = id (ligne simple) OU ligne groupée multi-actifs (toutes ses sous-transactions).
    const ids = (target && target._members)
      ? target._members.map(m => m.id)
      : [typeof target === 'object' ? target.id : target];
    ids.forEach(tid => ds.deleteTransaction(id, tid));
    toast.success(t("common.success"));
    setDeleteDialog(null);
    refresh();
  };

  const openEditTx = (tx) => {
    setEditTxForm({
      id: tx.id,
      date: tx.date,
      amount: tx.amount,
      type: tx.type,
      note: tx.note || "",
      fees_pct: tx.fees_type === 'euro' ? (tx.fees_amount || 0) : (tx.fees_pct || 0),
      fees_type: tx.fees_type === 'euro' ? 'euro' : 'percent',
      fee_direction: tx.fee_direction === 'added' ? 'added' : 'deducted',
      annual_fees_pct: tx.annual_fees_pct || 0,
      annual_fees_type: tx.annual_fees_type === 'euro' ? 'euro' : 'percent',
      asset_type: tx.asset_type || "",
      custom_asset_type: tx.custom_asset_type || "",
    });
    setEditTxDialog(tx.id);
  };

  const saveEditTx = () => {
    try {
      ds.updateTransaction(id, editTxForm.id, {
        date: editTxForm.date,
        amount: parseFloat(editTxForm.amount),
        note: editTxForm.note,
        fees_pct: parseFloat(editTxForm.fees_pct) || 0,
        fees_type: editTxForm.fees_type,
        fee_direction: editTxForm.fee_direction === 'added' ? 'added' : 'deducted',
        annual_fees_pct: parseFloat(editTxForm.annual_fees_pct) || 0,
        annual_fees_type: editTxForm.annual_fees_type === 'euro' ? 'euro' : 'percent',
        asset_type: editTxForm.asset_type || null,
        custom_asset_type: editTxForm.asset_type === 'autre' ? editTxForm.custom_asset_type : null,
      });
      toast.success(t("common.success"));
      setEditTxDialog(null);
      refresh();
    } catch (e) { toast.error(e.message); }
  };

  const updatePortfolio = () => {
    try {
      // Trophée « Maître fiscal » : comparer l'impact des frais en simulation. On mémorise
      // que l'utilisateur a modifié les frais d'une enveloppe dans une simulation.
      if (scope?.type === 'simulation') {
        const feesChanged =
          (parseFloat(editForm.annual_fees_pct) || 0) !== (parseFloat(portfolio.annual_fees_pct) || 0) ||
          (editForm.annual_fees_type || 'percent') !== (portfolio.annual_fees_type || 'percent');
        if (feesChanged) {
          try {
            const ft = gamificationService.getState().firstTime || {};
            gamificationService.patchState({ firstTime: { ...ft, simFeeChanged: true } });
          } catch (_) { /* état gamification indisponible */ }
        }
      }
      ds.updatePortfolio(id, { name: editForm.name, color: editForm.color || undefined, annual_fees_pct: parseFloat(editForm.annual_fees_pct) || 0, annual_fees_type: editForm.annual_fees_type, annual_return_rate: parseFloat(editForm.annual_return_rate) || 0, contract_start_date: editForm.contract_start_date || null, include_in_tax_report: editForm.include_in_tax_report !== false });
      toast.success(t("common.success")); setEditDialog(false); refresh();
    } catch (e) { toast.error(e.message); }
  };

  if (!portfolio) return <div className="text-center py-12"><p className="text-muted-foreground">{L('Portfolio introuvable', 'Portfolio not found')}</p><Link to={backHref}><Button className="mt-4">{t("portfolio.back")}</Button></Link></div>;

  // §B — Rendement cible : capitalisation composée de CHAQUE versement depuis sa
  // propre date (les retraits sont soustraits, capitalisés au même taux).
  //   targetValue(t) = Σ versements_i ≤ t : montant_i × (1 + taux)^((t − date_i)/365,25 j)
  // La courbe démarre à la date de création de l'enveloppe (0 € avant le 1er flux)
  // et couvre toute la largeur du graphique.
  const hasTargetRate = (portfolio.annual_return_rate || 0) > 0;
  // Point de départ de la courbe cible. ATTENTION : portfolio.created_date est la date
  // de création de l'ENREGISTREMENT dans l'app (new Date().toISOString() — souvent bien
  // postérieure aux mouvements réels rétro-saisis), ce qui décalait la courbe vers la
  // droite. On prend donc le mois le plus ancien entre la création de l'enveloppe et le
  // 1er point d'historique (= 1er mouvement réel), pour couvrir tout le graphique.
  const creationMonth   = (portfolio.created_date || portfolio.contract_start_date || '').slice(0, 7);
  const firstHistMonth  = historyData.length ? historyData[0].month : null;
  const curveStartMonth = [creationMonth, firstHistMonth].filter(Boolean).sort()[0] || firstHistMonth;
  // Couleur de l'enveloppe (propagée aux courbes et points du graphique)
  const envColor = portfolio.color || '#7C3AED';
  // Rendement annuel par année civile de cette enveloppe — histogramme (4c)
  const envAnnualYields = ds.computeAnnualYields(id);

  // Fix 3 — gap series + target curve injected when switch is on
  const gapHistoryData = (() => {
    const showCurve = showTargetCurve && hasTargetRate;
    const rate = (portfolio.annual_return_rate || 0) / 100; // ex. 0.07
    // Flux réels triés par date (les transactions de calibration sont exclues)
    const isCalTx = (t) =>
      t.isCalibration === true || t.type === 'calibration' || (t.note || '').toLowerCase().includes('calibration');
    const flows = showCurve
      ? transactions
          .filter(t => !isCalTx(t))
          .map(t => ({
            date:   t.date,
            signed: (t.type === 'deposit' ? 1 : -1) * (t.net_amount ?? t.amount ?? 0),
          }))
          .sort((a, b) => a.date.localeCompare(b.date))
      : [];
    const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;
    const result = historyData.map(row => {
      const gap = row.realValue != null ? Math.max(0, row.realValue - (row.deposits ?? 0)) : null;
      if (!showCurve) return { ...row, gap };
      if (curveStartMonth && row.month < curveStartMonth) return { ...row, gap, targetValue: null };
      // Un point par mois, évalué au dernier jour du mois (midi — évite les bascules DST)
      const [ry, rm] = row.month.split('-').map(Number);
      const tEnd = new Date(ry, rm, 0, 12);
      let target = 0;
      for (const f of flows) {
        const fd = new Date(f.date + 'T12:00:00');
        if (fd > tEnd) break;
        target += f.signed * Math.pow(1 + rate, (tEnd - fd) / MS_PER_YEAR);
      }
      return { ...row, gap, targetValue: Math.round(Math.max(0, target) * 100) / 100 };
    });
    // Diagnostic (#4) — vérifie que la courbe démarre bien au 1er mouvement, pas à created_date.
    if (showCurve && process.env.NODE_ENV !== 'production') {
      const pts = result.filter(r => r.targetValue != null);
      console.debug('[Courbe cible] diagnostic', {
        created_date: portfolio.created_date, creationMonth, firstHistMonth, curveStartMonth,
        totalRows: result.length, targetPoints: pts.length,
        firstTargetMonth: pts[0]?.month ?? null, lastTargetMonth: pts[pts.length - 1]?.month ?? null,
      });
    }
    return result;
  })();

  // En contexte simulation, la tuile « Total frais » reflète les frais PROJETÉS à
  // l'horizon (frais de versement + drain de frais annuels), cohérents avec la vue
  // d'ensemble de la simulation. Hors simulation, on garde le total stocké.
  const projectedFees = ds.getProjectedFees ? ds.getProjectedFees(id) : null;

  // Historique trié selon la colonne active. Valeur d'extraction par clé de tri.
  const sortValue = (tx, key) => {
    switch (key) {
      case 'date':        return tx.date || '';
      case 'type':        return tx.type || '';
      case 'asset_type':  return (tx.asset_type === 'autre' && tx.custom_asset_type)
                                   ? tx.custom_asset_type
                                   : (tx.asset_type ? (t(`assetTypes.${tx.asset_type}`) || tx.asset_type) : '');
      case 'amount':      return tx.amount || 0;
      case 'fees':        return tx.fees_amount || 0;
      case 'annual_fees': return tx.annual_fees_pct || 0;
      case 'net':         return (tx.type === 'deposit' ? 1 : -1) * (tx.net_amount || tx.amount || 0);
      case 'note':        return (tx.note || '').toLowerCase();
      default:            return '';
    }
  };
  const sortedTransactions = [...transactions].sort((a, b) => {
    const va = sortValue(a, txSort.key);
    const vb = sortValue(b, txSort.key);
    let cmp;
    if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
    else cmp = String(va).localeCompare(String(vb), 'fr');
    // Départage stable par date décroissante puis par id.
    if (cmp === 0) cmp = String(b.date || '').localeCompare(String(a.date || ''));
    if (cmp === 0) cmp = String(a.id).localeCompare(String(b.id));
    return txSort.dir === 'asc' ? cmp : -cmp;
  });

  // En-tête de colonne triable : flèche indiquant la colonne et le sens actifs.
  const SortHead = ({ col, children, className = '' }) => (
    <TableHead className={`cursor-pointer select-none hover:text-foreground ${className}`} onClick={() => handleSort(col)}>
      <span className={`inline-flex items-center gap-1 ${className.includes('text-right') ? 'flex-row-reverse' : ''}`}>
        {children}
        <ArrowUpDown className={`w-3 h-3 shrink-0 ${txSort.key === col ? 'text-primary' : 'text-muted-foreground/40'}`} />
        {txSort.key === col && <span className="text-[10px] text-primary">{txSort.dir === 'asc' ? '▲' : '▼'}</span>}
      </span>
    </TableHead>
  );

  const peaCapLabel = portfolio.type === "PEA" ? (() => {
    const verse = versementsPea(transactions);
    const pct = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(verse / dataService.PEA_MAX * 100);
    return t("portfolio.peaCap")
      .replace("{verse}", fmt(verse))
      .replace("{plafond}", `${dataService.PEA_MAX.toLocaleString('fr-FR')} €`)
      .replace("{pct}", pct);
  })() : null;

  return (
    <div className="space-y-6" data-testid="portfolio-detail-page">
      <div className="flex items-center gap-3">
        <Link to={backHref}><Button variant="ghost" size="icon" data-testid="back-btn"><ArrowLeft className="w-5 h-5" /></Button></Link>
        {/* Bandeau d'en-tête teinté dans la couleur de l'enveloppe (opacité adaptée au thème) */}
        <div className="flex-1 rounded-xl px-4 py-3" style={{ backgroundColor: envTintBg(envColor, true), color: envTextColor(envColor) }}>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-tight">{portfolio.name}</h1>
            <Badge variant="secondary">{t(`types.${portfolio.type}`)}</Badge>
            <Button variant="ghost" size="icon" onClick={() => { setEditDialog(true); try { challengeService.markVisit('visitEnvelopeEdit'); } catch (_) {} }} data-testid="edit-portfolio-btn"><Edit2 className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => setDeletePortfolioDialog(true)} data-testid="delete-portfolio-btn" className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
            {/* §5 — Calibrer : disponible dans le contexte simulation (alimente la courbe + le rendement « depuis l'origine » de la simulation) */}
            {scope?.type === 'simulation' && (
              <Button variant="outline" size="sm" className="h-7 text-xs ml-1" onClick={() => { setCalibForm({ date: today, total_value: String(portfolio.balance || "") }); setCalibDialog(true); }} data-testid="sim-calibrate-btn">
                {L('Calibrer', 'Calibrate')}
              </Button>
            )}
          </div>
          {/* Couleur explicite (et non text-muted-foreground) : le bandeau prend la
              couleur de l'enveloppe, le gris du thème y devient illisible. */}
          <p className="text-sm mt-1" style={{ color: envMutedTextColor(envColor) }}><GlossaryTerm id="rendement_cible">{t("portfolio.annualRate")}</GlossaryTerm>: {portfolio.annual_return_rate}% | <GlossaryTerm id="frais_gestion">{t("portfolio.annualFees")}</GlossaryTerm>: {portfolio.annual_fees_type === 'euro' ? `${portfolio.annual_fees_pct} ${L('€/an', '€/yr')}` : `${portfolio.annual_fees_pct}%`}{portfolio.type === "PEA" && ` | ${peaCapLabel}`}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Première tuile : Rendements (si calibration disponible) ou Solde en fallback */}
        {(() => {
          const totalItem = pnlByAsset.find(x => x.asset_type === '_total')
            || (pnlByAsset.length === 1 ? pnlByAsset[0] : null);
          if (totalItem) {
            const label = totalItem.asset_type === '_total'
              ? (portfolio.name || L('Enveloppe complète', 'Whole envelope'))
              : (t(`assetTypes.${totalItem.asset_type}`) || totalItem.asset_type);
            return (
              <Card className="border border-border shadow-sm" style={{ borderColor: envColor }}>
                <CardContent className="p-5">
                  <PnlAssetCard item={totalItem} label={label} flat />
                </CardContent>
              </Card>
            );
          }
          return (
            <Card className="border border-border shadow-sm" style={{ borderColor: envColor }}>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">{t("portfolio.balance")}</p>
                <p className="text-2xl font-heading font-bold mt-1 tabular-nums text-primary">{fmt(portfolio.balance)}</p>
              </CardContent>
            </Card>
          );
        })()}
        {/* Tuiles 2-4 : Versements (capital net en place) + Frais + Espèces.
            « Versements » (AFFICHAGE) = total versé − retraits réels externes ; les ventes
            conservées en espèces restent en place. Détail versé / vendu en sous-lignes.
            N.B. : le calcul du rendement/PNL (tuile Rendement) reste inchangé. */}
        {[
          {
            label: <GlossaryTerm id="versements">{t("portfolio.deposits")}</GlossaryTerm>,
            value: fmt(portfolio.net_deposits),
            color: "text-emerald-600 dark:text-emerald-400",
            tip: L(
              "Versements = capital net réellement en place dans l'enveloppe (total versé − retraits réels). Une vente dont le produit reste en espèces à l'intérieur n'est pas un retrait ici. L'écart avec la valeur réelle calibrée est votre plus/moins-value.",
              "Deposits = net capital actually placed in the envelope (total deposited − real withdrawals). A sale whose proceeds stay as internal cash is not a withdrawal here. The gap with the calibrated real value is your gain/loss."
            ),
            subs: [
              L(`Total versé : ${fmt(portfolio.gross_deposits)}`, `Total bought: ${fmt(portfolio.gross_deposits)}`),
              L(`Total vendu : ${fmt(portfolio.total_sold)}`, `Total sold: ${fmt(portfolio.total_sold)}`),
            ],
          },
          { label: <GlossaryTerm id="frais_gestion">{t("portfolio.totalFees")}</GlossaryTerm>,     value: fmt(projectedFees ? projectedFees.total : (portfolio.total_fees || 0)),      color: "text-amber-600 dark:text-amber-400" },
          { label: <GlossaryTerm id="especes">{t("portfolio.cashBalance")}</GlossaryTerm>,   value: fmt(portfolio.cash_balance || 0),   color: "text-blue-600 dark:text-blue-400", icon: <Wallet className="w-4 h-4" /> },
        ].map((c, i) => (
          <Card key={i} className="border border-border shadow-sm" style={{ borderColor: envColor }}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                {c.icon}{c.label}
                {c.tip && <Info className="w-3.5 h-3.5 opacity-60 cursor-help shrink-0" title={c.tip} />}
              </p>
              <p className={`text-2xl font-heading font-bold mt-1 tabular-nums ${c.color}`}>{c.value}</p>
              {c.subs && c.subs.map((s, j) => (
                <p key={j} className="text-xs text-muted-foreground mt-0.5 tabular-nums">{s}</p>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Documents liés à l'enveloppe (encadré compact → fenêtre liste ; pas en simulation) */}
      {!dataSource && <DocumentsSection portfolioId={portfolio.id} compact />}

      <Card className="border border-border shadow-sm" style={{ borderColor: envColor }} data-testid="add-transaction-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-lg">{t("portfolio.addTransaction")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-6">
            {/* ── COLONNE GAUCHE — informations principales ─────────────────── */}
            <div className="flex-1 space-y-4">
              <div>
                <Label>{t("portfolio.date")}</Label>
                {/* Le composant Input (type="date") fournit déjà son propre bouton « Auj. ». */}
                <Input
                  type="date"
                  value={txForm.date}
                  min={portfolio.contract_start_date || undefined}
                  max={today}
                  onChange={e => setTxForm({...txForm, date: e.target.value})}
                  data-testid="tx-date-input"
                />
              </div>

              <div><Label>{t("portfolio.amount")}</Label><Input type="number" step="0.01" min="0.01" placeholder="0.00" value={txForm.amount} onChange={e => setTxForm({...txForm, amount: e.target.value})} data-testid="tx-amount-input" /></div>

              {/* Quantité + Prix unitaire (optionnels) */}
              {!multiAssetMode && !['fond_euro', 'immobilier'].includes(txForm.asset_type) && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="flex items-center gap-1">{L('Quantité', 'Quantity')} <span className="text-xs text-muted-foreground font-normal">({L('opt.', 'opt.')})</span></Label>
                    <Input type="number" step="any" min="0" placeholder="ex: 10" value={txForm.quantity}
                      onChange={e => { const qty = e.target.value; const up = txForm.unit_price; const newAmount = qty !== '' && up !== '' ? String(Math.round(parseFloat(qty) * parseFloat(up) * 100) / 100) : txForm.amount; setTxForm(f => ({ ...f, quantity: qty, amount: newAmount })); }}
                      data-testid="tx-quantity-input" />
                  </div>
                  <div>
                    <Label className="flex items-center gap-1">{L('Prix unitaire (€)', 'Unit price (€)')} <span className="text-xs text-muted-foreground font-normal">({L('opt.', 'opt.')})</span></Label>
                    <Input type="number" step="any" min="0" placeholder="ex: 145.30" value={txForm.unit_price}
                      onChange={e => { const up = e.target.value; const qty = txForm.quantity; const newAmount = qty !== '' && up !== '' ? String(Math.round(parseFloat(qty) * parseFloat(up) * 100) / 100) : txForm.amount; setTxForm(f => ({ ...f, unit_price: up, amount: newAmount })); }}
                      data-testid="tx-unit-price-input" />
                  </div>
                  {txForm.quantity !== '' && txForm.unit_price !== '' && (
                    <p className="col-span-full text-xs text-blue-600 dark:text-blue-400">{L('Montant calculé automatiquement :', 'Amount computed automatically:')} {fmt(parseFloat(txForm.quantity || 0) * parseFloat(txForm.unit_price || 0))}</p>
                  )}
                </div>
              )}

              {/* Type d'actif */}
              <div>
                <Label>{t("portfolio.assetType")}</Label>
                <Select value={txForm.asset_type || "none"} onValueChange={v => setTxForm({...txForm, asset_type: v === "none" ? "" : v, custom_asset_type: ""})}>
                  <SelectTrigger data-testid="tx-asset-type-select"><SelectValue placeholder="--" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">--</SelectItem>
                    {ds.ASSET_TYPES.filter(type => type !== 'autre').map(type => (
                      <SelectItem key={type} value={type}>{t(`assetTypes.${type}`)}</SelectItem>
                    ))}
                    {customAssetTypes.map(type => (
                      <SelectItem key={`custom_${type}`} value={type}>{type}</SelectItem>
                    ))}
                    <SelectItem value="autre">{t("assetTypes.autre")}</SelectItem>
                  </SelectContent>
                </Select>
                {!multiAssetMode && txForm.asset_type === 'autre' && (
                  <div className="mt-2">
                    <Input
                      value={txForm.custom_asset_type}
                      onChange={e => setTxForm({...txForm, custom_asset_type: e.target.value})}
                      placeholder={L("Précisez le type d'actif (ex: ETF World)...", "Specify the asset type (e.g. World ETF)...")}
                      data-testid="tx-custom-asset-input"
                    />
                    <p className="text-xs text-muted-foreground mt-1">{L("Ce nom sera créé comme type d'actif réutilisable.", "This name will be saved as a reusable asset type.")}</p>
                  </div>
                )}
              </div>

              {/* Types d'actifs multiples */}
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="checkbox"
                  id="multi-asset-mode"
                  checked={multiAssetMode}
                  onChange={e => { setMultiAssetMode(e.target.checked); if (!e.target.checked) setMultiAssetAllocations([]); }}
                  className="h-4 w-4 cursor-pointer"
                />
                <label htmlFor="multi-asset-mode" className="text-sm cursor-pointer">{L("Types d'actifs multiples", 'Multiple asset types')}</label>
                {multiAssetMode && (
                  <Button variant="outline" size="sm" onClick={() => setMultiAssetModalOpen(true)}>
                    {L('Configurer', 'Configure')} ({multiAssetAllocations.length} {L('type', 'type')}{multiAssetAllocations.length !== 1 ? 's' : ''})
                  </Button>
                )}
                {multiAssetMode && multiAssetAllocations.length > 0 && (() => {
                  const totalPct = multiAssetAllocations.reduce((s, a) => s + (parseFloat(a.pct) || 0), 0);
                  return (
                    <span className={`text-xs ${Math.abs(totalPct - 100) < 0.01 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {totalPct.toFixed(0)} % {Math.abs(totalPct - 100) < 0.01 ? '✓' : '(doit être 100%)'}
                    </span>
                  );
                })()}
              </div>

              <div>
                <Label>Note <span className="text-xs text-muted-foreground font-normal">({L('opt.', 'opt.')})</span></Label>
                <Textarea rows={2} placeholder={t("portfolio.note")} value={txForm.note} onChange={e => setTxForm({...txForm, note: e.target.value})} data-testid="tx-note-input" />
              </div>
            </div>

            {/* ── Séparateur vertical fin (1px) ─────────────────────────────── */}
            <div className="hidden lg:block w-px bg-border self-stretch shrink-0" />

            {/* ── COLONNE DROITE — métadonnées ──────────────────────────────── */}
            <div className="flex-1 space-y-4">
              {/* Boutons au-dessus de la section droite */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setTemplatesOpen(true)} className="gap-1.5 flex-1" data-testid="manage-templates-btn">
                  <Settings className="w-3.5 h-3.5" /> {t("portfolio.movementTemplates") || "Mouvements types"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setRegularMovementsOpen(true)} className="gap-1.5 flex-1" data-testid="regular-movements-portfolio-btn">
                  <RefreshCw className="w-3.5 h-3.5" /> {t("portfolio.recurringMovements")}
                </Button>
              </div>

              {/* Frais de transaction (%/€) + sens des frais */}
              <div>
                <Label>{txForm.fees_type === 'euro' ? L('Frais de transaction (€)', 'Transaction fees (€)') : L('Frais de transaction (%)', 'Transaction fees (%)')}</Label>
                <div className="flex items-center gap-1">
                  <Input type="number" step="0.01" min="0" placeholder="0" value={txForm.fees_pct} onChange={e => setTxForm({...txForm, fees_pct: e.target.value})} data-testid="tx-fees-input" className="flex-1 min-w-0" />
                  <div className="flex rounded-md border border-input overflow-hidden shrink-0 h-9">
                    <button type="button" onClick={() => setTxForm({...txForm, fees_type: 'percent'})} className={`px-2 text-sm ${txForm.fees_type !== 'euro' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>%</button>
                    <button type="button" onClick={() => setTxForm({...txForm, fees_type: 'euro'})} className={`px-2 text-sm ${txForm.fees_type === 'euro' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>€</button>
                  </div>
                </div>
                {/* Item 3 — sens des frais (déduits / ajoutés) */}
                <div className="mt-2 flex rounded-md border border-input overflow-hidden text-xs" data-testid="tx-fee-direction">
                  <button type="button" onClick={() => setTxForm({...txForm, fee_direction: 'deducted'})} className={`flex-1 px-2 py-1.5 ${txForm.fee_direction !== 'added' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>
                    {L('Frais déduits du montant', 'Fees deducted from amount')}
                  </button>
                  <button type="button" onClick={() => setTxForm({...txForm, fee_direction: 'added'})} className={`flex-1 px-2 py-1.5 border-l border-input ${txForm.fee_direction === 'added' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>
                    {L('Frais ajoutés au montant', 'Fees added to amount')}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {txForm.fee_direction === 'added'
                    ? L("Les frais s'ajoutent au montant total sorti ou entré.", 'Fees are added on top of the total amount out or in.')
                    : L('Les frais sont prélevés sur le montant reçu ou envoyé.', 'Fees are taken from the amount received or sent.')}
                </p>
              </div>

              {/* Frais annuels (%/€) */}
              <div>
                <Label>{txForm.annual_fees_type === 'euro' ? L('Frais annuels (€)', 'Annual fees (€)') : t("portfolio.annualFeesPctTx")}</Label>
                <div className="flex items-center gap-1">
                  <Input type="number" step="0.01" min="0" placeholder="0" value={txForm.annual_fees_pct} onChange={e => setTxForm({...txForm, annual_fees_pct: e.target.value})} data-testid="tx-annual-fees-input" className="flex-1 min-w-0" />
                  <div className="flex rounded-md border border-input overflow-hidden shrink-0 h-9">
                    <button type="button" onClick={() => setTxForm({...txForm, annual_fees_type: 'percent'})} className={`px-2 text-sm ${txForm.annual_fees_type !== 'euro' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>%</button>
                    <button type="button" onClick={() => setTxForm({...txForm, annual_fees_type: 'euro'})} className={`px-2 text-sm ${txForm.annual_fees_type === 'euro' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>€</button>
                  </div>
                </div>
              </div>

              {/* Mouvement type */}
              <div>
                <Label className="mb-1.5 block">{t("portfolio.movementTemplate")}</Label>
                {templates.length > 0 ? (
                  <Select value={txForm.template_id || "none"} onValueChange={handleTemplateSelect}>
                    <SelectTrigger data-testid="tx-template-select"><SelectValue placeholder="--" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">--</SelectItem>
                      {templates.map(tpl => <SelectItem key={tpl.id} value={tpl.id}>{tpl.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-xs text-muted-foreground">{L('Aucun mouvement type. Utilisez le bouton « Mouvements types » ci-dessus pour en créer un.', 'No movement template. Use the “Movement templates” button above to create one.')}</p>
                )}
              </div>
            </div>
          </div>
          
          {txForm.amount && parseFloat(txForm.fees_pct) > 0 && (() => {
            const amt    = parseFloat(txForm.amount) || 0;
            const feeVal = parseFloat(txForm.fees_pct) || 0;
            const feeAmt = txForm.fees_type === 'euro' ? feeVal : amt * feeVal / 100;
            const lbl    = txForm.fees_type === 'euro' ? `${feeVal} €` : `${feeVal}%`;
            const net    = txForm.fee_direction === 'added' ? amt + feeAmt : amt - feeAmt;
            return (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg text-sm">
                <span className="text-amber-700 dark:text-amber-400">
                  {t("portfolio.feesPreview")}: {fmt(feeAmt)} ({lbl})
                  → {t("portfolio.netAmount")}: {fmt(net)}
                  {txForm.fee_direction === 'added' && ` (${L('frais en plus', 'fees on top')})`}
                </span>
              </div>
            );
          })()}
          
          {/* Affichage de l'utilisation des espèces pour les achats */}
          {txForm.amount && parseFloat(txForm.amount) > 0 && (portfolio.cash_balance || 0) > 0 && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-sm">
              <span className="text-blue-700 dark:text-blue-400 flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                {(() => {
                  const _amt = parseFloat(txForm.amount) || 0;
                  const _fee = parseFloat(txForm.fees_pct) || 0;
                  const _feeAmt = txForm.fees_type === 'euro' ? _fee : _amt * _fee / 100;
                  const netAmount = txForm.fee_direction === 'added' ? _amt + _feeAmt : _amt - _feeAmt;
                  const cash = portfolio.cash_balance || 0;
                  if (cash >= netAmount) {
                    return `${t("portfolio.deposit")}: ${fmt(netAmount)} ${t("portfolio.fromCash")} (${fmt(cash)} disponible)`;
                  } else {
                    return `${t("portfolio.deposit")}: ${fmt(cash)} ${t("portfolio.fromCash")} + ${fmt(netAmount - cash)} ${t("portfolio.newFunds")}`;
                  }
                })()}
              </span>
            </div>
          )}
          
          <div className="flex flex-wrap gap-3 mt-4">
            <Button onClick={() => addTransaction("deposit")} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 flex-1 sm:flex-none" data-testid="deposit-btn">
              <ArrowDownLeft className="w-4 h-4 mr-2" /> {t("portfolio.deposit")}
            </Button>
            <Button onClick={handleWithdrawalClick} className="bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-500/20 flex-1 sm:flex-none" data-testid="withdrawal-btn">
              <ArrowUpRight className="w-4 h-4 mr-2" /> {t("portfolio.withdrawal")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* §1+§2 — Evolution Chart + §4c histogramme rendement annuel (même rangée, défilement horizontal si besoin) */}
      <div className="flex gap-4 overflow-x-auto pb-2">
      <Card className="border border-border shadow-sm flex-1 min-w-[460px]" style={{ borderColor: envColor }} data-testid="evolution-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              {t("portfolio.evolution")}
              {realYieldData && (() => {
                // Fix 4 — inceptionYield comme figure principale (plus stable)
                const primary = realYieldData.inceptionYield ?? realYieldData.lastIntervalYield;
                const isPos   = primary >= 0;
                return (
                  <div className="flex flex-col gap-0.5 ml-2" data-testid="real-yield-badge">
                    <Badge
                      variant="outline"
                      title={L("Rendement réel de votre argent investi depuis l'origine, tenant compte des dates et montants de vos versements (Dietz modifiée).", 'Real money-weighted return since inception, accounting for the dates and amounts of your deposits (Modified Dietz).')}
                      className={`text-xs cursor-help ${isPos ? 'text-emerald-600 border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' : 'text-rose-600 border-rose-400 bg-rose-50 dark:bg-rose-950/30'}`}
                    >
                      {isPos ? <TrendingUp className="w-3 h-3 mr-1 inline" /> : <TrendingDown className="w-3 h-3 mr-1 inline" />}
                      {isPos ? '+' : ''}{primary}%/{L('an', 'yr')}
                      <span className="ml-1 font-normal opacity-70">{L("depuis l'origine", 'since inception')}</span>
                    </Badge>
                    {realYieldData.inceptionYield != null && realYieldData.lastIntervalYield != null && (
                      <span className="text-xs text-muted-foreground pl-0.5">
                        {L('Dernière période :', 'Latest period:')} {realYieldData.lastIntervalYield >= 0 ? '+' : ''}{realYieldData.lastIntervalYield}%
                        {' '}({new Date(realYieldData.startDate).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { month: 'short', year: '2-digit' })} › {new Date(realYieldData.endDate).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { month: 'short', year: '2-digit' })})
                      </span>
                    )}
                  </div>
                );
              })()}
            </CardTitle>
            <div className="flex items-center gap-3 flex-wrap justify-end">
              {/* Courbe "Rendement cible" — visible uniquement en mode graphique */}
              {!showDataTable && (
                <div
                  className={`flex items-center gap-1.5 ${!hasTargetRate ? 'cursor-not-allowed' : ''}`}
                  title={!hasTargetRate
                    ? L("Configurez un rendement cible dans les paramètres de l'enveloppe pour activer cette option.", "Set a target return in the envelope settings to enable this option.")
                    : ''}
                >
                  <span className={`text-xs ${hasTargetRate ? 'text-muted-foreground' : 'text-muted-foreground/40'}`}>
                    {L('Rendement cible', 'Target return')}
                  </span>
                  <Switch
                    checked={showTargetCurve && hasTargetRate}
                    onCheckedChange={handleTargetCurveToggle}
                    disabled={!hasTargetRate}
                    data-testid="target-curve-switch"
                  />
                </div>
              )}
              {/* Bascule graphique / tableau */}
              <div className="flex items-center gap-2">
                <BarChart3 className={`w-4 h-4 ${!showDataTable ? 'text-primary' : 'text-muted-foreground'}`} />
                <Switch checked={showDataTable} onCheckedChange={setShowDataTable} data-testid="chart-table-switch" />
                <TableIcon className={`w-4 h-4 ${showDataTable ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!showDataTable ? (
            historyData.some(d => d.realValue != null) ? (
              <>
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={gapHistoryData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    {/* §2 — custom tooltip: reconstruct calibrated value from deposits + gap */}
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length) return null;
                        const cal = calYieldByMonth[label];
                        const depEntry = payload.find(e => e.dataKey === 'deposits');
                        const gapEntry = payload.find(e => e.dataKey === 'gap');
                        const tgtEntry = payload.find(e => e.dataKey === 'targetValue');
                        const dep = depEntry?.value ?? null;
                        const gap = gapEntry?.value ?? null;
                        const calibratedValue = (dep != null && gap != null) ? dep + gap : null;
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm">
                            <p className="font-semibold mb-1">{label}</p>
                            {calibratedValue != null && (
                              <p className="text-violet-600">{L('Valeur calibrée :', 'Calibrated value:')} {fmt(calibratedValue)}</p>
                            )}
                            {dep != null && (
                              <p className="text-slate-500">{L('Versements cumulés :', 'Cumulative deposits:')} {fmt(dep)}</p>
                            )}
                            {tgtEntry?.value != null && (
                              <p className="text-purple-400">
                                {L(`Rendement cible (${portfolio.annual_return_rate}%/an) :`, `Target return (${portfolio.annual_return_rate}%/yr):`)} {fmt(tgtEntry.value)}
                              </p>
                            )}
                            {cal && cal.yieldPct != null && (
                              <p className={`font-medium mt-1 ${cal.yieldPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {L('Rendement :', 'Return:')} {cal.yieldPct >= 0 ? '+' : ''}{cal.yieldPct}%
                                {cal.gainEur != null && <span className="text-xs text-muted-foreground ml-1">({cal.gainEur >= 0 ? '+' : ''}{fmt(cal.gainEur)})</span>}
                              </p>
                            )}
                          </div>
                        );
                      }}
                    />
                    <Legend />
                    {/* Deposits: transparent stacked base — stroked at the deposits line */}
                    <Area
                      stackId="stack"
                      type="monotone"
                      dataKey="deposits"
                      stroke={darkenHex(envColor)}
                      strokeWidth={1.5}
                      fill="none"
                      dot={false}
                      name={L('Versements cumulés', 'Cumulative deposits')}
                    />
                    {/* Gap (calibratedValue − deposits): fills the band between curves */}
                    <Area
                      stackId="stack"
                      type="linear"
                      dataKey="gap"
                      stroke={envColor}
                      strokeWidth={2.5}
                      fill={envColor}
                      fillOpacity={0.25}
                      dot={(props) => {
                        const { cx, cy, payload } = props;
                        if (payload.gap == null) return null;
                        return <circle key={`dot-cal-${payload.month}`} cx={cx} cy={cy} r={4} fill={envColor} stroke="white" strokeWidth={2} />;
                      }}
                      activeDot={{ r: 6, fill: envColor, stroke: 'white', strokeWidth: 2 }}
                      name={L('Valeur calibrée', 'Calibrated value')}
                      connectNulls={true}
                    />
                    {/* §B — Courbe cible en pointillés (si switch activé) */}
                    {showTargetCurve && hasTargetRate && (
                      <Line
                        type="monotone"
                        dataKey="targetValue"
                        stroke={lightenHex(envColor)}
                        strokeWidth={1.5}
                        strokeDasharray="6 3"
                        dot={false}
                        name={L(`Rendement cible (${portfolio.annual_return_rate} %/an)`, `Target return (${portfolio.annual_return_rate} %/yr)`)}
                        connectNulls={true}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
                <p className="text-xs text-muted-foreground text-center mt-1 flex items-center justify-center gap-1">
                  <Target className="w-3 h-3 text-violet-500" />
                  {L('Les points ● correspondent aux dates de calibration — passez la souris pour voir le rendement de chaque période.', 'The ● points are calibration dates — hover to see each period\'s return.')}
                </p>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <Target className="w-10 h-10 text-muted-foreground/30" />
                <p className="text-muted-foreground text-sm max-w-xs">
                  {L('Aucune calibration disponible — calibrez votre enveloppe pour afficher son évolution réelle.', 'No calibration available — calibrate your envelope to display its real evolution.')}
                </p>
              </div>
            )
          ) : (
            <div className="overflow-x-auto max-h-[320px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("portfolio.month")}</TableHead>
                    <TableHead className="text-right">{t("portfolio.netDeposits")}</TableHead>
                    <TableHead className="text-right">{L('Valeur réelle', 'Real value')}</TableHead>
                    <TableHead className="text-right" title={L('Valeur − versements cumulés (plus-value latente depuis l’origine)', 'Value − cumulative deposits (unrealised gain since inception)')}>{L('Plus-value cumulée', 'Cumulative gain')}</TableHead>
                    <TableHead className="text-right" title={DIETZ_NOTE[lang === 'en' ? 'en' : 'fr']}>{L('Rendement (période)', 'Return (period)')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyData.filter(r => r.realValue != null || calYieldByMonth[r.month]).map((row, i) => {
                    const cal = calYieldByMonth[row.month];
                    // Une ligne est une VRAIE calibration si elle figure dans calYieldByMonth ;
                    // sinon (valeur présente mais pas de calibration) c'est un mois INTERPOLÉ.
                    const isRealCal   = !!cal;
                    const interpolated = row.realValue != null && !isRealCal;
                    const cumGain     = row.realValue != null ? row.realValue - (row.deposits ?? 0) : null;
                    const interpCls   = interpolated ? 'italic opacity-50' : '';
                    const interpTitle = interpolated ? L('Valeur interpolée entre deux calibrations réelles (non saisie)', 'Interpolated between two real calibrations (not entered)') : undefined;
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-sm">{row.month}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-emerald-600">{fmt(row.deposits)}</TableCell>
                        <TableCell className={`text-right font-mono tabular-nums text-violet-600 ${interpCls}`} title={interpTitle}>
                          {row.realValue != null ? fmt(row.realValue) : '—'}
                        </TableCell>
                        <TableCell className={`text-right font-mono tabular-nums text-xs ${cumGain == null ? 'text-muted-foreground' : (cumGain >= 0 ? 'text-emerald-600' : 'text-rose-600')} ${interpCls}`} title={interpTitle}>
                          {cumGain != null ? `${cumGain >= 0 ? '+' : ''}${fmt(cumGain)}` : '—'}
                        </TableCell>
                        <TableCell className={`text-right font-mono tabular-nums text-xs ${cal?.yieldPct != null ? (cal.yieldPct >= 0 ? 'text-emerald-600' : 'text-rose-600') : 'text-muted-foreground'}`}>
                          {cal?.yieldPct != null ? (
                            <>
                              {cal.yieldPct >= 0 ? '+' : ''}{cal.yieldPct}%
                              {cal.gainEur != null && <span className="text-muted-foreground"> · {cal.gainEur >= 0 ? '+' : ''}{fmt(cal.gainEur)}</span>}
                            </>
                          ) : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <p className="text-[11px] text-muted-foreground leading-snug mt-2">
                {L(
                  'Les valeurs en italique sont interpolées entre deux calibrations réelles (non saisies). « Plus-value cumulée » = valeur − versements cumulés depuis l’origine ; « Rendement (période) » = performance entre deux calibrations (Dietz modifiée), nette des versements de la période.',
                  'Italic values are interpolated between two real calibrations (not entered). “Cumulative gain” = value − cumulative deposits since inception; “Return (period)” = performance between two calibrations (Modified Dietz), net of the period’s deposits.',
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      {/* §4c — Histogramme du rendement annuel de l'enveloppe */}
      <Card className="border border-border shadow-sm flex-1 min-w-[340px]" style={{ borderColor: envColor }} data-testid="env-annual-yield-chart">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="font-heading text-lg"><GlossaryTerm id="rendement_annuel">{L('Rendement annuel', 'Annual return')}</GlossaryTerm></CardTitle>
          {/* Raccourci de calibration scopé à cette enveloppe (comme « Calibrer mes enveloppes ») */}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5 shrink-0"
            onClick={() => {
              // Tableau de bord : modale de calibration complète focalisée sur cette
              // enveloppe (les autres grisées). Simulation : dialogue simplifié scopé sim.
              if (scope?.type === 'simulation') { setCalibForm({ date: today, total_value: String(portfolio.balance || "") }); setCalibDialog(true); }
              else setFullCalibOpen(true);
            }}
            data-testid="annual-yield-calibrate-btn"
          >
            <Target className="w-3.5 h-3.5" />
            {t("portfolio.calibrate")}
          </Button>
        </CardHeader>
        <CardContent>
          <AnnualYieldChart data={envAnnualYields} height={300} />
        </CardContent>
      </Card>
      </div>

      {/* §10 — Rendements par actif (détail par sous-actif ; _total est déjà dans la tuile supérieure) */}
      {pnlByAsset.filter(x => x.asset_type !== '_total').length > 0 && (
        <Card className="border border-border shadow-sm" style={{ borderColor: envColor }} data-testid="pnl-by-asset-card">
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-violet-500" />
              <GlossaryTerm id="pnl">{L('Rendements par actif', 'Returns by asset')}</GlossaryTerm>
              <span className="text-sm font-normal text-muted-foreground">
                {L('(dernière calibration détaillée)', '(latest detailed calibration)')}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pnlByAsset
                .filter(x => x.asset_type !== '_total')
                .map(item => {
                  const label = t(`assetTypes.${item.asset_type}`) || item.asset_type;
                  return <PnlAssetCard key={item.asset_type} item={item} label={label} />;
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Totaux par note */}
      {(() => {
        const txsWithNotes = transactions.filter(tx => tx.note && tx.note.trim());
        if (txsWithNotes.length === 0) return null;
        const noteGroups = {};
        txsWithNotes.forEach(tx => {
          const note = tx.note.trim();
          if (!noteGroups[note]) noteGroups[note] = { net: 0, fees: 0, units: 0, withQty: 0, count: 0, priceCost: 0, priceUnits: 0, txns: [] };
          // Total net par note = CAPITAL INVESTI identifié par la note : il AUGMENTE à
          // chaque versement/achat (y compris un achat financé par les espèces internes)
          // et DIMINUE à chaque retrait/vente (espèces conservées OU sortie d'enveloppe).
          // Ex. Disney : achat +10 (montant 9 + 1 € de frais ajoutés) puis vente −10 = 0.
          const v = tx.net_amount ?? tx.amount;
          noteGroups[note].net  += tx.type === 'deposit' ? v : -v;
          noteGroups[note].fees += tx.fees_amount || 0;
          noteGroups[note].txns.push(tx);
          // Total des unités achetées (uniquement les mouvements dont la quantité est renseignée)
          noteGroups[note].count += 1;
          const q  = parseFloat(tx.quantity);
          const up = parseFloat(tx.unit_price);
          if (tx.quantity != null && tx.quantity !== '' && !isNaN(q)) {
            noteGroups[note].units   += q;
            noteGroups[note].withQty += 1;
            // Prix d'achat moyen pondéré : uniquement les mouvements ayant AUSSI un prix unitaire
            if (tx.unit_price != null && tx.unit_price !== '' && !isNaN(up)) {
              noteGroups[note].priceCost  += q * up;
              noteGroups[note].priceUnits += q;
            }
          }
        });
        // Ajouter les frais annuels de gestion cumulés (portés par les transactions) au total des frais.
        Object.values(noteGroups).forEach(g => {
          g.fees = Math.round((g.fees + dataService.getTransactionAnnualFees(g.txns)) * 100) / 100;
        });
        const sortedGroups = Object.entries(noteGroups).sort(([, a], [, b]) => Math.abs(b.net) - Math.abs(a.net));
        const fmtUnits = (u) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 4 }).format(u);
        return (
          <Card className="border border-border shadow-sm" style={{ borderColor: envColor }}>
            <CardHeader><CardTitle className="font-heading text-lg">{L('Totaux par note', 'Totals by note')}</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sortedGroups.map(([note, { net, fees, units, withQty, count, priceCost, priceUnits }]) => {
                  // « Unités partielles » : certains mouvements de cette note ont une quantité, d'autres non.
                  const partialUnits = withQty > 0 && withQty < count;
                  // Prix d'achat moyen pondéré (si au moins un mouvement a quantité ET prix unitaire)
                  const avgPrice = priceUnits > 0 ? priceCost / priceUnits : null;
                  return (
                  <div key={note} className="flex flex-wrap justify-between items-center gap-x-4 gap-y-1 p-2 rounded-lg bg-accent/30">
                    <span className="text-sm font-medium truncate max-w-full sm:max-w-[40%]">{displayNote(note, lang)}</span>
                    <div className="flex items-center gap-4 shrink-0 font-mono tabular-nums text-sm font-medium">
                      {withQty > 0 && (
                        <span
                          className={partialUnits ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}
                          title={partialUnits ? L("Total partiel : tous les mouvements de cette note n'ont pas de quantité renseignée.", 'Partial total: not all movements for this note have a quantity.') : undefined}
                        >
                          {L('Total unités :', 'Total units:')} {fmtUnits(units)}{partialUnits ? ' ⚠' : ''}
                        </span>
                      )}
                      {avgPrice != null && (
                        <span className="text-foreground" title={L("Prix d'achat moyen pondéré des mouvements ayant un nombre d'unités et un prix unitaire renseignés.", 'Weighted average purchase price of movements with both quantity and unit price.')}>
                          <GlossaryTerm id="pam">{L('PAM', 'Avg price')}</GlossaryTerm> : {fmt(avgPrice)}
                        </span>
                      )}
                      <span className={net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                        {L('Total net :', 'Net total:')} {net >= 0 ? '+' : ''}{fmt(net)}
                      </span>
                      <span className="text-amber-600 dark:text-amber-400">
                        {L('Total frais :', 'Total fees:')} {fmt(fees)}
                      </span>
                    </div>
                    {partialUnits && (
                      <p className="w-full text-xs text-rose-600 dark:text-rose-400 font-normal">
                        {L(
                          `⚠ Total d'unités partiel : ${count - withQty} mouvement${count - withQty > 1 ? 's' : ''} de cette note sans quantité renseignée.`,
                          `⚠ Partial unit total: ${count - withQty} movement${count - withQty > 1 ? 's' : ''} for this note without a quantity.`,
                        )}
                      </p>
                    )}
                  </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <Card className="border border-border shadow-sm" style={{ borderColor: envColor }} data-testid="transactions-table">
        <CardHeader><CardTitle className="font-heading text-lg">{t("portfolio.transactions")} ({transactions.length})</CardTitle></CardHeader>
        <CardContent>
          {transactions.length === 0 ? <p className="text-muted-foreground text-center py-8">{t("tax.noMovements")}</p> : (
            <div className="overflow-x-auto">
              <Table><TableHeader><TableRow>
                <SortHead col="date">{t("portfolio.date")}</SortHead>
                <SortHead col="type">Type</SortHead>
                <SortHead col="asset_type">{t("portfolio.assetType")}</SortHead>
                <SortHead col="amount" className="text-right">{t("portfolio.grossAmount")}</SortHead>
                <SortHead col="fees" className="text-right">{t("portfolio.fees")}</SortHead>
                <SortHead col="annual_fees" className="text-right">{t("portfolio.annualFeesPctTx")}</SortHead>
                <SortHead col="net" className="text-right">{t("portfolio.netAmount")}</SortHead>
                <SortHead col="note" className="hidden sm:table-cell">{t("portfolio.note")}</SortHead>
                <TableHead className="text-right">{t("common.actions")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>{sortedTransactions.slice(txPage * TX_PAGE_SIZE, (txPage + 1) * TX_PAGE_SIZE).map((tx) => (
                <TableRow key={tx.id} data-testid={`tx-row-${tx.id}`} className={tx.from_recurring_id ? 'opacity-80' : ''}>
                  <TableCell className="font-mono text-sm">{tx.date}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge className={tx.type === "deposit" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"}>
                        {tx.type === "deposit" ? t("portfolio.deposit") : t("portfolio.withdrawal")}
                      </Badge>
                      {/* Indicateur poche espèces */}
                      {tx.type === 'withdrawal' && tx.keep_in_cash && (
                        <Badge variant="outline" className="text-xs text-blue-600 border-blue-300 flex items-center gap-1 w-fit">
                          <Wallet className="w-3 h-3" /> {L('Espèces', 'Cash')}
                        </Badge>
                      )}
                      {tx.type === 'deposit' && tx.from_cash_amount > 0 && (
                        <span className="text-xs text-blue-600">
                          {fmt(tx.from_cash_amount)} espèces
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {tx.asset_type ? (
                      <Badge variant="outline" className="text-xs">
                        {tx.asset_type === 'autre' && tx.custom_asset_type
                          ? tx.custom_asset_type
                          : t(`assetTypes.${tx.asset_type}`)}
                      </Badge>
                    ) : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    <div>{fmt(tx.amount)}</div>
                    {/* Quantité × prix unitaire, si renseignés par l'utilisateur */}
                    {(tx.quantity != null || tx.unit_price != null) && (
                      <div className="text-xs font-normal text-muted-foreground">
                        {tx.quantity != null ? `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 4 }).format(tx.quantity)} u` : ''}
                        {tx.quantity != null && tx.unit_price != null ? ' × ' : ''}
                        {tx.unit_price != null ? fmt(tx.unit_price) : ''}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-amber-600">
                    {/* Signe selon le sens réel des frais (voir fraisAjoutes) : « + » quand
                        ils s'ajoutent au montant, « − » quand ils en sont déduits. */}
                    {tx.fees_amount > 0
                      ? `${signeFrais(tx)}${fmt(tx.fees_amount)}`
                      : "-"}
                    {tx.fees_pct > 0 && <span className="text-xs text-muted-foreground ml-1">({tx.fees_pct}%)</span>}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-purple-600">
                    {(tx.annual_fees_pct || 0) > 0 ? `${tx.annual_fees_pct}${tx.annual_fees_type === 'euro' ? ' €/an' : '%'}` : "-"}
                  </TableCell>
                  <TableCell className={`text-right font-mono tabular-nums font-medium ${tx.type === "deposit" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {tx.type === "deposit" ? "+" : "-"}{fmt(tx.net_amount || tx.amount)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground text-sm max-w-[150px] truncate">
                    {tx.from_recurring_id && (
                      <span className="text-[9px] font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded px-1 py-0.5 mr-1">
                        🔄
                      </span>
                    )}
                    <span className={tx.from_recurring_id ? 'italic' : ''}>{displayNote(tx.note, lang)}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEditTx(tx)} data-testid={`edit-tx-${tx.id}`}><Edit2 className="w-4 h-4 text-muted-foreground hover:text-primary" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteDialog(tx.id)} data-testid={`delete-tx-${tx.id}`}><Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}</TableBody></Table>
            </div>
          )}
          {transactions.length > TX_PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
              <span className="text-sm text-muted-foreground">
                {txPage * TX_PAGE_SIZE + 1}–{Math.min((txPage + 1) * TX_PAGE_SIZE, transactions.length)} sur {transactions.length}
              </span>
              <div className="flex gap-2">
                {txPage > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setTxPage(txPage - 1)}>
                    {L('← Page précédente', '← Previous page')}
                  </Button>
                )}
                {(txPage + 1) * TX_PAGE_SIZE < transactions.length && (
                  <Button variant="outline" size="sm" onClick={() => setTxPage(txPage + 1)}>
                    {L('Page suivante →', 'Next page →')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      {/* Choix de financement d'un achat quand des espèces sont disponibles */}
      <Dialog open={!!cashChoice} onOpenChange={(o) => { if (!o) setCashChoice(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              {L('Financer cet achat', 'Fund this purchase')}
            </DialogTitle>
            <DialogDescription>
              {L(
                `Cette enveloppe dispose de ${fmt(portfolio.cash_balance || 0)} en espèces (issues de ventes). Souhaitez-vous les utiliser pour cet achat, ou apporter de l'argent extérieur ?`,
                `This envelope holds ${fmt(portfolio.cash_balance || 0)} in cash (from sales). Use it for this purchase, or bring in outside money?`
              )}
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {L(
              "« Utiliser les espèces » puise en priorité dans le compte espèces (le reste éventuel est complété par de l'argent extérieur) et n'augmente pas le total versé. « Argent extérieur » conserve les espèces et compte comme un nouveau versement.",
              "“Use cash” draws from the cash account first (any remainder is topped up with outside money) and does not increase total deposits. “Outside money” keeps the cash and counts as a new deposit."
            )}
          </p>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="secondary"
              onClick={() => { const c = cashChoice; setCashChoice(null); addTransaction(c.type, c.keepInCash, 'external'); }}
              data-testid="funding-external-btn"
            >
              {L('Argent extérieur', 'Outside money')}
            </Button>
            <Button
              onClick={() => { const c = cashChoice; setCashChoice(null); addTransaction(c.type, c.keepInCash, 'cash'); }}
              data-testid="funding-cash-btn"
            >
              {L('Utiliser les espèces', 'Use cash')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* §5 — Calibration (tableau de bord ou simulation, scopée à cette enveloppe) */}
      <Dialog open={calibDialog} onOpenChange={setCalibDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">{`Calibrer « ${portfolio.name} »`}</DialogTitle>
            <DialogDescription>
              {scope?.type === 'simulation'
                ? "Enregistrez la valeur réelle simulée à une date donnée. Alimente la courbe d'évolution et le rendement « depuis l'origine » de la simulation."
                : "Enregistrez la valeur réelle de cette enveloppe à une date donnée. Alimente la courbe d'évolution et le rendement « depuis l'origine »."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>{t("portfolio.date")}</Label><Input type="date" max={today} value={calibForm.date} onChange={e => setCalibForm({ ...calibForm, date: e.target.value })} /></div>
            <div><Label>{L('Valeur totale (€)', 'Total value (€)')}</Label><Input type="text" inputMode="decimal" value={calibForm.total_value} onChange={e => setCalibForm({ ...calibForm, total_value: e.target.value })} placeholder={L('Ex : 12 500', 'e.g. 12,500')} /></div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCalibDialog(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => {
              const v = parseFloat(String(calibForm.total_value).replace(',', '.'));
              if (!calibForm.date || !v || v <= 0) { toast.error(t('portfolio.amountInvalid') || 'Valeur invalide'); return; }
              // Une calibration constate une valeur passée : jamais de date future.
              if (calibForm.date > today) {
                toast.error(L('Une calibration ne peut pas être datée dans le futur.', 'A calibration cannot be dated in the future.'));
                return;
              }
              ds.addCalibration({ portfolio_id: id, date: calibForm.date, total_value: v });
              toast.success(t('common.success'));
              setCalibDialog(false);
              refresh();
            }} data-testid="confirm-sim-calibrate-btn">{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent><DialogHeader><DialogTitle>{t("portfolio.confirmDelete")}</DialogTitle><DialogDescription>{t("portfolio.confirmDelete")}</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="secondary" onClick={() => setDeleteDialog(null)}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={() => deleteTx(deleteDialog)} data-testid="confirm-delete-tx-btn">{t("portfolio.delete")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent><DialogHeader><DialogTitle className="font-heading">{t("portfolio.edit")}</DialogTitle><DialogDescription>{t("portfolio.name")}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t("portfolio.name")}</Label><Input value={editForm.name || ""} onChange={e => setEditForm({...editForm, name: e.target.value})} /></div>
            <div>
              <Label>Couleur</Label>
              <ColorSwatchPicker value={editForm.color || ""} onChange={(c) => setEditForm({ ...editForm, color: c })} className="mt-1.5" />
            </div>
            <div><Label>{t("portfolio.annualRate")}</Label><Input type="number" step="0.1" value={editForm.annual_return_rate || ""} onChange={e => setEditForm({...editForm, annual_return_rate: e.target.value})} /></div>
            <div>
              <Label>{editForm.annual_fees_type === 'euro' ? L('Frais annuels (€/an)', 'Annual fees (€/yr)') : t("portfolio.annualFees")}</Label>
              <div className="flex items-center gap-1">
                <Input type="number" step="0.1" value={editForm.annual_fees_pct || ""} onChange={e => setEditForm({...editForm, annual_fees_pct: e.target.value})} className="flex-1 min-w-0" />
                <div className="flex rounded-md border border-input overflow-hidden shrink-0 h-9">
                  <button type="button" onClick={() => setEditForm({...editForm, annual_fees_type: 'percent'})} className={`px-2 text-sm ${editForm.annual_fees_type !== 'euro' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>%</button>
                  <button type="button" onClick={() => setEditForm({...editForm, annual_fees_type: 'euro'})} className={`px-2 text-sm ${editForm.annual_fees_type === 'euro' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>€</button>
                </div>
              </div>
            </div>
            <div><Label>{t("portfolio.contractStart")}</Label><Input type="date" value={editForm.contract_start_date || ""} onChange={e => setEditForm({...editForm, contract_start_date: e.target.value})} /></div>
            <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-accent/30">
              <input
                type="checkbox"
                id="include-tax-report"
                checked={editForm.include_in_tax_report !== false}
                onChange={e => setEditForm({...editForm, include_in_tax_report: e.target.checked})}
                className="mt-0.5 h-4 w-4 rounded border-border cursor-pointer"
              />
              <div>
                <label htmlFor="include-tax-report" className="text-sm font-medium cursor-pointer">{t("portfolio_tax.includeInReport")}</label>
                <p className="text-xs text-muted-foreground mt-0.5">{t("portfolio_tax.includeInReportHint")}</p>
              </div>
            </div>
          </div>
          <DialogFooter><Button variant="secondary" onClick={() => setEditDialog(false)}>{t("common.cancel")}</Button>
            <Button onClick={updatePortfolio} data-testid="save-portfolio-btn">{t("common.save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTxDialog} onOpenChange={() => setEditTxDialog(null)}>
        <DialogContent><DialogHeader><DialogTitle className="font-heading">{t("portfolio.editTransaction")}</DialogTitle><DialogDescription>{t("portfolio.editTransaction")}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t("portfolio.date")}</Label><Input type="date" value={editTxForm.date || ""} onChange={e => setEditTxForm({...editTxForm, date: e.target.value})} /></div>
            <div><Label>{t("portfolio.amount")}</Label><Input type="number" step="0.01" value={editTxForm.amount || ""} onChange={e => setEditTxForm({...editTxForm, amount: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{editTxForm.fees_type === 'euro' ? 'Frais (€)' : t("portfolio.feesPct")}</Label>
                <div className="flex items-center gap-1">
                  <Input type="number" step="0.01" value={editTxForm.fees_pct || ""} onChange={e => setEditTxForm({...editTxForm, fees_pct: e.target.value})} className="flex-1 min-w-0" />
                  <div className="flex rounded-md border border-input overflow-hidden shrink-0 h-9">
                    <button type="button" onClick={() => setEditTxForm({...editTxForm, fees_type: 'percent'})} className={`px-2 text-sm ${editTxForm.fees_type !== 'euro' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>%</button>
                    <button type="button" onClick={() => setEditTxForm({...editTxForm, fees_type: 'euro'})} className={`px-2 text-sm ${editTxForm.fees_type === 'euro' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>€</button>
                  </div>
                </div>
              </div>
              <div>
                <Label>{editTxForm.annual_fees_type === 'euro' ? L('Frais annuels (€)', 'Annual fees (€)') : t("portfolio.annualFeesPctTx")}</Label>
                <div className="flex items-center gap-1">
                  <Input type="number" step="0.01" value={editTxForm.annual_fees_pct || ""} onChange={e => setEditTxForm({...editTxForm, annual_fees_pct: e.target.value})} className="flex-1 min-w-0" />
                  <div className="flex rounded-md border border-input overflow-hidden shrink-0 h-9">
                    <button type="button" onClick={() => setEditTxForm({...editTxForm, annual_fees_type: 'percent'})} className={`px-2 text-sm ${editTxForm.annual_fees_type !== 'euro' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>%</button>
                    <button type="button" onClick={() => setEditTxForm({...editTxForm, annual_fees_type: 'euro'})} className={`px-2 text-sm ${editTxForm.annual_fees_type === 'euro' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>€</button>
                  </div>
                </div>
              </div>
            </div>
            {/* Sens des frais (déduits / ajoutés) — cohérent avec le formulaire d'ajout */}
            <div>
              <div className="flex rounded-md border border-input overflow-hidden text-xs" data-testid="edit-tx-fee-direction">
                <button type="button" onClick={() => setEditTxForm({...editTxForm, fee_direction: 'deducted'})} className={`flex-1 px-2 py-1.5 ${editTxForm.fee_direction !== 'added' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>
                  {L('Frais déduits du montant', 'Fees deducted from amount')}
                </button>
                <button type="button" onClick={() => setEditTxForm({...editTxForm, fee_direction: 'added'})} className={`flex-1 px-2 py-1.5 border-l border-input ${editTxForm.fee_direction === 'added' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>
                  {L('Frais ajoutés au montant', 'Fees added to amount')}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {editTxForm.fee_direction === 'added'
                  ? L("Les frais s'ajoutent au montant total sorti ou entré.", 'Fees are added on top of the total amount out or in.')
                  : L('Les frais sont prélevés sur le montant reçu ou envoyé.', 'Fees are taken from the amount received or sent.')}
              </p>
            </div>
            <div><Label>{t("portfolio.assetType")}</Label>
              <Select value={editTxForm.asset_type || "none"} onValueChange={v => setEditTxForm({...editTxForm, asset_type: v === "none" ? "" : v, custom_asset_type: ""})}>
                <SelectTrigger><SelectValue placeholder="--" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">--</SelectItem>
                  {ds.ASSET_TYPES.filter(type => type !== 'autre').map(type => (
                    <SelectItem key={type} value={type}>{t(`assetTypes.${type}`)}</SelectItem>
                  ))}
                  {customAssetTypes.map(type => (
                    <SelectItem key={`custom_${type}`} value={type}>{type}</SelectItem>
                  ))}
                  <SelectItem value="autre">{t("assetTypes.autre")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editTxForm.asset_type === 'autre' && (
              <div>
                <Label>{t("portfolio.assetType")} — {t("assetTypes.autre")}</Label>
                <Input value={editTxForm.custom_asset_type || ""} onChange={e => setEditTxForm({...editTxForm, custom_asset_type: e.target.value})} placeholder={L("Nom personnalisé...", "Custom name...")} />
              </div>
            )}
            <div><Label>{t("portfolio.note")}</Label><Textarea value={editTxForm.note || ""} onChange={e => setEditTxForm({...editTxForm, note: e.target.value})} /></div>
          </div>
          <DialogFooter><Button variant="secondary" onClick={() => setEditTxDialog(null)}>{t("common.cancel")}</Button>
            <Button onClick={saveEditTx} data-testid="save-tx-btn">{t("common.save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de suppression de l'enveloppe */}
      <Dialog open={deletePortfolioDialog} onOpenChange={setDeletePortfolioDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {t("portfolio.deletePortfolio") || "Supprimer l'enveloppe"}
            </DialogTitle>
            <DialogDescription>
              {(() => {
                const impact = ds.getPortfolioDeletionImpact(id);
                const pl = (n) => (n > 1 ? 's' : '');
                const base = L(
                  `Êtes-vous sûr de vouloir supprimer l'enveloppe "${portfolio?.name}" ? Cette action est irréversible.`,
                  `Are you sure you want to delete the envelope "${portfolio?.name}"? This action cannot be undone.`,
                );
                const parts = [];
                if (impact.movements > 0) parts.push(L(`${impact.movements} mouvement${pl(impact.movements)} programmé${pl(impact.movements)}`, `${impact.movements} scheduled movement${pl(impact.movements)}`));
                if (impact.calibrations > 0) parts.push(`${impact.calibrations} calibration${pl(impact.calibrations)}`);
                if (parts.length === 0) return base;
                return L(
                  `${base} Cette enveloppe contient ${parts.join(' et ')} qui seront également supprimés.`,
                  `${base} This envelope contains ${parts.join(' and ')}, which will also be deleted.`,
                );
              })()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeletePortfolioDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                ds.deletePortfolio(id);
                toast.success(t("portfolio.deleteSuccess") || "Portefeuille supprimé");
                navigate(backHref);
              }}
              data-testid="confirm-delete-portfolio-btn"
            >
              {t("portfolio.confirmDeletePortfolio") || "Oui, supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog de confirmation pour les ventes (conserver en espèces ou non) */}
      <Dialog open={withdrawalConfirmDialog} onOpenChange={setWithdrawalConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Wallet className="w-5 h-5 text-blue-600" />
              {t("portfolio.withdrawalConfirmTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("portfolio.withdrawalConfirmDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {/* Option: Conserver en espèces */}
            <button
              onClick={() => confirmWithdrawal(true)}
              className="w-full p-4 rounded-lg border-2 border-blue-200 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all text-left group"
              data-testid="keep-in-cash-option"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-foreground group-hover:text-blue-700 dark:group-hover:text-blue-400">
                    {t("portfolio.keepInCash")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("portfolio.keepInCashHint")}
                  </p>
                </div>
              </div>
            </button>
            
            {/* Option: Ne pas conserver (sortie d'argent) */}
            <button
              onClick={() => confirmWithdrawal(false)}
              className="w-full p-4 rounded-lg border-2 border-rose-200 hover:border-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all text-left group"
              data-testid="dont-keep-in-cash-option"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center">
                  <ArrowUpRight className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <p className="font-medium text-foreground group-hover:text-rose-700 dark:group-hover:text-rose-400">
                    {t("portfolio.dontKeepInCash")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("portfolio.dontKeepInCashHint")}
                  </p>
                </div>
              </div>
            </button>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setWithdrawalConfirmDialog(false)}>
              {t("common.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal multi-actifs */}
      <Dialog open={multiAssetModalOpen} onOpenChange={setMultiAssetModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">{L("Répartition par type d'actif", 'Breakdown by asset type')}</DialogTitle>
            <DialogDescription>{L('Cochez les types et saisissez les pourcentages (total = 100%)', 'Check the types and enter the percentages (total = 100%)')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
            {[...ds.ASSET_TYPES.filter(type => type !== 'autre'), ...customAssetTypes, 'autre'].map(type => {
              const alloc = multiAssetAllocations.find(a => a.assetType === type);
              const checked = !!alloc;
              const displayName = ds.ASSET_TYPES.includes(type) ? t(`assetTypes.${type}`) : type;
              return (
                <div key={type} className="space-y-1">
                  <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/30">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={e => {
                        if (e.target.checked) {
                          setMultiAssetAllocations([...multiAssetAllocations, { assetType: type, customName: '', pct: 0 }]);
                        } else {
                          setMultiAssetAllocations(multiAssetAllocations.filter(a => a.assetType !== type));
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
                          onChange={e => setMultiAssetAllocations(multiAssetAllocations.map(a =>
                            a.assetType === type ? { ...a, pct: parseFloat(e.target.value) || 0 } : a
                          ))}
                          className="w-20 h-8 text-sm"
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    )}
                  </div>
                  {checked && type === 'autre' && (
                    <div className="ml-7 pl-2 pb-1">
                      <Input
                        placeholder={L("Nom du type d'actif (ex: ETF World)...", 'Asset type name (e.g. World ETF)...')}
                        value={alloc.customName || ''}
                        onChange={e => setMultiAssetAllocations(multiAssetAllocations.map(a =>
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
          {multiAssetAllocations.length > 0 && (() => {
            const total = multiAssetAllocations.reduce((s, a) => s + (parseFloat(a.pct) || 0), 0);
            return (
              <p className={`text-sm font-medium ${Math.abs(total - 100) < 0.01 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {L('Total :', 'Total:')} {total.toFixed(0)} % {Math.abs(total - 100) < 0.01 ? '✓' : L('— manque ', '— missing ') + (100 - total).toFixed(0) + ' %'}
              </p>
            );
          })()}
          <DialogFooter>
            <Button onClick={() => setMultiAssetModalOpen(false)}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Mouvements récurrents ────────────────────────────────────────── */}
      <RegularMovementsPanel
        open={regularMovementsOpen}
        onClose={() => setRegularMovementsOpen(false)}
        portfolioId={portfolio?.id || null}
        portfolios={allPortfolios}
        onSaved={refresh}
        scope={scope}
        dataSource={dataSource}
      />
      {/* ── Mouvements types (panneau indépendant) ───────────────────────── */}
      <RegularMovementsPanel
        mode="templates"
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        portfolioId={portfolio?.id || null}
        portfolios={allPortfolios}
        onSaved={refresh}
        scope={scope}
        dataSource={dataSource}
      />
      {/* Modale de calibration complète (tableau de bord) — focalisée sur cette enveloppe */}
      {scope?.type !== 'simulation' && (
        <CalibrationModal
          open={fullCalibOpen}
          onClose={() => setFullCalibOpen(false)}
          onSaved={refresh}
          focusedEnvelopeId={id}
        />
      )}
      <Disclaimer />
    </div>
  );
}

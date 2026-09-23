// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import dataService       from "../services/dataService";
import challengeService  from "../services/challengeService";
import gamificationService from "../services/gamificationService";
import { useLanguage } from "../context/LanguageContext";
import Disclaimer from "../components/ui/Disclaimer";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import GlossaryTerm from "../components/ui/GlossaryTerm";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Calendar } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import { toast } from "sonner";
import { BarChart, Bar, Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, ReferenceLine, ReferenceDot } from "recharts";
import EnvelopeEvolutionChart from "../components/ui/EnvelopeEvolutionChart";
import {
  ArrowLeft, Plus, Briefcase, TrendingUp, ArrowDownLeft, ArrowUpRight,
  Trash2, Flame, TrendingDown, RotateCcw, Edit2, Percent, Settings2, Zap, CalendarIcon, ChevronRight, RefreshCw
} from "lucide-react";
import TotalFeesCard from "../components/ui/TotalFeesCard";
import RegularMovementsPanel from "../components/RegularMovementsPanel";
import { makeDataSource } from "../lib/portfolioDataSource";
import { envTintBg, envTextColor, envMutedTextColor, envGainColor } from "../lib/utils";

const COLORS = ["#059669", "#D97706", "#0284C7", "#7C3AED", "#DB2777", "#EA580C", "#14B8A6", "#8B5CF6"];
const TYPES = ["PEA", "CTO", "assurance_vie", "PER", "custom"];
const DEFAULT_RATES = { PEA: 8, CTO: 8, assurance_vie: 4, PER: 4, custom: 0 };

// Bornes du curseur d'horizon de projection (constantes par session).
const CURRENT_YEAR = new Date().getFullYear();
const MAX_YEAR     = CURRENT_YEAR + 50;

export default function SimulationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const L = (fr, en) => (lang === 'en' ? en : fr);
  // Adaptateur scopé à CETTE simulation → le panneau des mouvements récurrents agit
  // sur les enveloppes de la simulation (et non sur le tableau de bord réel).
  const simDataSource = useMemo(() => makeDataSource({ type: 'simulation', simId: id }), [id]);
  const [regularMovementsOpen, setRegularMovementsOpen] = useState(false);

  const [simulation, setSimulation] = useState(null);
  const [stats, setStats] = useState(null);
  const [historyData, setHistoryData] = useState({ data: [], series: [], crossoverPoint: null });
  
  const [createDialog, setCreateDialog] = useState(false);
  const [deleteSimDialog, setDeleteSimDialog] = useState(false);
  const [newPortfolio, setNewPortfolio] = useState({ 
    name: "", 
    type: "PEA", 
    annual_return_rate: 8, 
    annual_fees_pct: 0,
    contract_start_date: new Date().toISOString().split('T')[0],
  });
  
  // Date cible pour le graphique (par défaut aujourd'hui)
  const [targetDate, setTargetDate] = useState(new Date().toISOString().substring(0, 7));
  const [targetDateOpen, setTargetDateOpen] = useState(false);

  // Slider d'année cible — bornes CURRENT_YEAR / MAX_YEAR au niveau module
  // L'année sélectionnée est dérivée de targetDate (bidirectionnel)
  const selectedYear = parseInt(targetDate.substring(0, 4), 10);
  const handleSliderYear = (year) => {
    const month = targetDate.substring(5, 7); // conserver le mois courant
    setTargetDate(`${year}-${month}`);
  };
  
  // Switch bâtonnets enveloppes/actifs (par actif par défaut)
  const [barViewByAsset, setBarViewByAsset] = useState(true);
  // Vue du graphique d'évolution partagé : false = synthétique, true = détaillée
  const [chartDetailView, setChartDetailView] = useState(false);
  // Modale de détail des frais par enveloppe (à la date cible)
  const [feeBreakdownOpen, setFeeBreakdownOpen] = useState(false);

  // FIRE settings
  const [fireSettingsDialog, setFireSettingsDialog] = useState(false);
  const [fireForm, setFireForm] = useState({
    monthly_need: 2500,
    target_return_rate: 4,
  });
  
  // Stress Test settings
  const [stressTestDialog, setStressTestDialog] = useState(false);
  const [stressTestDate, setStressTestDate] = useState(new Date().toISOString().split('T')[0]);
  const [stressTestMinRate, setStressTestMinRate] = useState(4); // Seuil de rendement minimum pour appliquer -20%
  
  // Inflation toggle
  const [inflationEnabled, setInflationEnabled] = useState(false);
  const [inflationRate, setInflationRate] = useState(2.5);
  const [inflationSettingsDialog, setInflationSettingsDialog] = useState(false);

  const barChartScrollRef = useRef(null);

  // Refs pour la persistance de l'horizon de projection
  // _projRestored    : garantit que la restauration n'a lieu qu'une fois par montage
  // _saveProjEnabled : évite de sauvegarder la valeur restaurée (serait un aller-retour inutile)
  // _saveProjTimer   : handle du debounce 500 ms (item 6 — throttle des sauvegardes slider)
  const _projRestored    = useRef(false);
  const _saveProjEnabled = useRef(false);
  const _saveProjTimer   = useRef(null);
  // Étiquette d'année du curseur, mise à jour en direct pendant le glissement SANS
  // provoquer de re-render (fluidité) ; la valeur n'est validée qu'au relâchement.
  const _sliderLabelRef  = useRef(null);

  const fmt = (v) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);

  const refresh = useCallback(() => {
    const sim = dataService.getSimulation(id);
    if (!sim) {
      navigate("/simulation/portfolios");
      return;
    }
    setSimulation(sim);
    setStats(dataService.getSimulationStats(id));
    
    // Charger les paramètres FIRE GLOBAUX (source unique de vérité, partagée avec Trophées)
    const _fire = dataService.getFireSettings();
    setFireForm({
      monthly_need: _fire.monthly_need,
      target_return_rate: _fire.withdrawal_rate,
    });
    
    // Charger les paramètres d'inflation
    if (sim.inflation_settings) {
      setInflationEnabled(sim.inflation_settings.enabled || false);
      setInflationRate(sim.inflation_settings.rate || 2.5);
    }
    
    // Charger les paramètres de stress test
    if (sim.stress_test_settings) {
      setStressTestMinRate(sim.stress_test_settings.min_rate || 4);
    }

    // ── Restaurer l'horizon de projection mémorisé (une seule fois par montage) ──
    if (!_projRestored.current) {
      _projRestored.current = true;
      if (sim.lastProjectionYears != null && sim.lastProjectionYears > 0) {
        const restoreYear  = CURRENT_YEAR + sim.lastProjectionYears;
        const currentMonth = new Date().toISOString().substring(5, 7);
        setTargetDate(`${Math.min(restoreYear, MAX_YEAR)}-${currentMonth}`);
      }
      // Activer la sauvegarde après ce cycle de rendu pour ne pas persister la valeur
      // restaurée comme si l'utilisateur venait de la modifier.
      setTimeout(() => { _saveProjEnabled.current = true; }, 0);
    }

    // Calculer l'historique pour le graphique
    calculateHistoryData(sim);
    // calculateHistoryData volontairement hors des deps : l'inclure recréerait
    // `refresh` à chaque changement de targetDate (via sa dépendance à targetDate)
    // et l'effet [refresh] relancerait un refresh() complet à chaque cran du curseur,
    // annulant le débounce de l'effet [targetDate] ci-dessous. Le recalcul du graphe
    // sur changement d'horizon est déjà géré là-bas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, navigate]);

  // Calcul de l'historique avec intérêts composés MENSUELS
  // Utilise la formule d'annuité: FV = PV × (1 + r)^n + PMT × ((1 + r)^n - 1) / r
  // Où r = taux mensuel net (rendement - frais - inflation si activée) / 12
  const calculateHistoryData = (sim) => {
    if (!sim || !sim.transactions.length) {
      setHistoryData({ data: [], series: [], crossoverPoint: null });
      return;
    }

    // Fonction fv locale (équivalent numpy_financial.fv)
    const fv = (rate, nper, pmt, pv) => {
      if (rate === 0) {
        return pv + pmt * nper;
      }
      const factor = Math.pow(1 + rate, nper);
      return pv * factor + pmt * ((factor - 1) / rate);
    };

    // Récupérer les paramètres d'inflation DIRECTEMENT depuis la simulation
    const useInflation = sim.inflation_settings?.enabled || false;
    const inflRate = sim.inflation_settings?.rate || 2.5;

    // Trouver la plage de mois
    const allTxDates = sim.transactions.map(t => t.date.substring(0, 7));
    const minMonth = allTxDates.reduce((a, b) => a < b ? a : b);
    const maxTxMonth = allTxDates.reduce((a, b) => a > b ? a : b);
    
    // Par défaut, le graphique va jusqu'à aujourd'hui ou jusqu'à la date cible
    const today = new Date().toISOString().substring(0, 7);
    // Utiliser targetDate si spécifié et supérieur à aujourd'hui
    let maxMonth = today;
    if (targetDate > today) {
      maxMonth = targetDate;
    }
    // Si des transactions futures existent au-delà de la date cible, étendre
    if (maxTxMonth > maxMonth) {
      maxMonth = maxTxMonth;
    }
    
    // Générer tous les mois entre min et max
    const sortedMonths = [];
    let [year, month] = minMonth.split('-').map(Number);
    const [endYear, endMonth] = maxMonth.split('-').map(Number);
    
    while (year < endYear || (year === endYear && month <= endMonth)) {
      sortedMonths.push(`${year}-${String(month).padStart(2, '0')}`);
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }

    // Accumulateurs de frais (mutés depuis l'intérieur du .map())
    let totalAnnualFeeDrain = 0;

    const series = sim.portfolios.map((p, idx) => {
      const pTxns = sim.transactions.filter(t => t.portfolio_id === p.id).sort((a, b) => a.date.localeCompare(b.date));
      
      // Taux de base de l'enveloppe
      const baseAnnualRate = (p.annual_return_rate || 0) / 100;
      const envelopeAnnualFees = (p.annual_fees_pct || 0) / 100;
      const annualInflation = useInflation ? (inflRate / 100) : 0;
      
      // Pour chaque transaction, on va calculer sa contribution avec son propre taux de frais
      // Structure: { amount, monthlyRate, startMonth }
      const txContributions = [];
      
      let totalDeposits = 0;     // Somme des versements nets (ne compte PAS les stress_crash)
      let totalPortfolio = 0;    // Valeur totale avec intérêts composés
      let totalInterest = 0;     // Intérêts générés cumulés
      let pAnnualFeeDrain = 0;   // Frais annuels cumulés de CETTE enveloppe (jusqu'à l'horizon)

      const values = {};
      const deposits = {};
      const interests = {};
      
      sortedMonths.forEach((monthKey, index) => {
        // Calculer les transactions du mois
        const monthTxns = pTxns.filter(t => t.date.substring(0, 7) === monthKey);
        let monthCrashLoss = 0;
        
        monthTxns.forEach(t => {
          const netAmount = t.net_amount || t.amount;
          if (t.type === 'deposit') {
            // Versements cumulés (AFFICHAGE) = capital net en place (hors rachats espèces).
            totalDeposits += (t.new_funds_amount != null ? t.new_funds_amount : netAmount);
            // Frais annuels propres à cette transaction + frais de l'enveloppe
            const txAnnualFees = ((t.annual_fees_pct || 0) / 100) + envelopeAnnualFees;
            const txNetAnnualRate = Math.max(0, baseAnnualRate - txAnnualFees - annualInflation);
            // Taux mensuel EFFECTIF exact : (1+mensuel)^12 = (1+annuel).
            const txMonthlyRate = (1 + txNetAnnualRate) > 0 ? Math.pow(1 + txNetAnnualRate, 1 / 12) - 1 : txNetAnnualRate / 12;
            txContributions.push({
              amount: netAmount,
              monthlyRate: txMonthlyRate,
              annualFeeRate: txAnnualFees,   // stocké pour calculer le drain mensuel
              startMonthIndex: index,
              currentValue: netAmount,
            });
          } else if (t.type === 'stress_crash') {
            monthCrashLoss += netAmount;
          } else {
            // Retrait : ne réduit les versements cumulés (AFFICHAGE) que s'il sort réellement
            // de l'enveloppe (une vente conservée en espèces reste en place).
            if (!t.keep_in_cash) totalDeposits -= netAmount;
            let remaining = netAmount;
            for (let i = txContributions.length - 1; i >= 0 && remaining > 0; i--) {
              const contrib = txContributions[i];
              if (contrib.currentValue <= remaining) {
                remaining -= contrib.currentValue;
                contrib.currentValue = 0;
              } else {
                contrib.currentValue -= remaining;
                remaining = 0;
              }
            }
          }
        });
        
        // Calculer les intérêts pour chaque contribution active
        const previousTotalPortfolio = totalPortfolio;
        totalPortfolio = 0;
        
        txContributions.forEach(contrib => {
          if (contrib.currentValue > 0) {
            const monthsHeld = index - contrib.startMonthIndex;
            if (monthsHeld > 0) {
              // Drain de frais annuels ce mois (avant capitalisation) — total ET par enveloppe
              const monthDrain = contrib.currentValue * ((contrib.annualFeeRate || 0) / 12);
              totalAnnualFeeDrain += monthDrain;
              pAnnualFeeDrain     += monthDrain;
              // Capitaliser cette contribution au taux net
              contrib.currentValue = contrib.currentValue * (1 + contrib.monthlyRate);
            }
            totalPortfolio += contrib.currentValue;
          }
        });
        
        // Calculer les intérêts générés ce mois
        if (index > 0) {
          const monthlyDeposits = monthTxns.filter(t => t.type === 'deposit').reduce((s, t) => s + (t.net_amount || t.amount), 0);
          const monthlyWithdrawals = monthTxns.filter(t => t.type === 'withdrawal').reduce((s, t) => s + (t.net_amount || t.amount), 0);
          const monthInterest = totalPortfolio - previousTotalPortfolio - monthlyDeposits + monthlyWithdrawals;
          if (monthInterest > 0) totalInterest += monthInterest;
        }
        
        // Appliquer le crash : réduction proportionnelle de toutes les contributions
        if (monthCrashLoss > 0 && totalPortfolio > 0) {
          const effectiveLoss = Math.min(monthCrashLoss, totalPortfolio);
          const crashRatio = effectiveLoss / totalPortfolio;
          txContributions.forEach(contrib => {
            contrib.currentValue = Math.max(0, contrib.currentValue * (1 - crashRatio));
          });
          totalPortfolio = Math.max(0, totalPortfolio - effectiveLoss);
          totalInterest = Math.max(0, totalPortfolio - totalDeposits);
        }
        
        // Éviter les valeurs négatives
        if (totalPortfolio < 0) totalPortfolio = 0;
        if (totalInterest < 0) totalInterest = 0;
        
        values[monthKey] = Math.round(totalPortfolio * 100) / 100;
        deposits[monthKey] = Math.round(totalDeposits * 100) / 100;
        // Intérêts = valeur du portefeuille - versements cumulés
        interests[monthKey] = Math.round(Math.max(0, totalPortfolio - totalDeposits) * 100) / 100;
      });
      
      // Frais de versement cumulés de cette enveloppe (jusqu'à l'horizon)
      const pTxFees = pTxns
        .filter(t => t.type === 'deposit' && t.date.substring(0, 7) <= maxMonth)
        .reduce((s, t) => s + (t.fees_amount || 0), 0);
      return {
        name: p.name, id: p.id, values, deposits, interests,
        color: p.color || COLORS[idx % COLORS.length],
        txFees: Math.round(pTxFees * 100) / 100,
        annualFees: Math.round(pAnnualFeeDrain * 100) / 100,
      };
    });

    // Créer les données pour le graphique
    let crossoverPoint = null;
    let previousInterestBelowDeposits = true;
    
    // Pour le switch par actif : calculer les totaux par type d'actif
    const assetTypeTotals = {};
    
    const data = sortedMonths.map(month => {
      const point = { month };
      let totalPortfolio = 0;
      let totalDeposits = 0;
      let totalInterest = 0;
      
      // Réinitialiser les totaux par actif pour ce mois
      const monthAssetTotals = {};
      
      series.forEach(s => {
        point[s.id] = s.values[month] || 0;
        totalPortfolio += s.values[month] || 0;
        totalDeposits += s.deposits[month] || 0;
        totalInterest += s.interests[month] || 0;
        
        // Calculer les totaux par type d'actif à partir des transactions
        const pTxns = sim.transactions.filter(t => 
          t.portfolio_id === s.id && 
          t.date.substring(0, 7) <= month
        );
        
        pTxns.forEach(tx => {
          const assetType = tx.asset_type || 'non_classé';
          if (!monthAssetTotals[assetType]) monthAssetTotals[assetType] = 0;
          if (tx.type === 'deposit') {
            monthAssetTotals[assetType] += tx.net_amount || tx.amount;
          } else if (tx.type === 'withdrawal') {
            monthAssetTotals[assetType] -= tx.net_amount || tx.amount;
          }
        });
      });
      
      // Ajouter les données par actif au point
      Object.keys(monthAssetTotals).forEach(assetType => {
        point[`asset_${assetType}`] = Math.max(0, Math.round(monthAssetTotals[assetType] * 100) / 100);
        if (!assetTypeTotals[assetType]) assetTypeTotals[assetType] = true;
      });
      
      point.total = Math.round(totalPortfolio * 100) / 100;
      point.totalDeposits = Math.round(totalDeposits * 100) / 100;
      point.netInterest = Math.round(totalInterest * 100) / 100;
      
      // Détecter le crossover point (quand les intérêts dépassent les versements)
      if (previousInterestBelowDeposits && totalInterest > totalDeposits && !crossoverPoint) {
        crossoverPoint = { month, interest: totalInterest, deposits: totalDeposits };
      }
      previousInterestBelowDeposits = totalInterest <= totalDeposits;
      
      return point;
    });
    
    // Créer la liste des types d'actifs pour le graphique
    const assetTypes = Object.keys(assetTypeTotals).map(type => ({
      id: `asset_${type}`,
      name: type === 'non_classé' ? 'Non classé' : type,
      type: type
    }));

    // ── Frais totaux & impact ─────────────────────────────────────────────────
    // 1. Frais de versement : fees_amount déjà déduit dans net_amount à la saisie
    const totalTxFees = sim.transactions
      .filter(t => t.type === 'deposit')
      .reduce((sum, t) => sum + (t.fees_amount || 0), 0);

    // 2. Impact global des frais : valeur finale sans aucun frais annuels
    let finalValueNoFees = 0;
    sim.portfolios.forEach(p => {
      const pTxns2 = sim.transactions
        .filter(t => t.portfolio_id === p.id)
        .sort((a, b) => a.date.localeCompare(b.date));
      const _nfAnnual = (p.annual_return_rate || 0) / 100 - (useInflation ? inflRate / 100 : 0);
      // Taux mensuel EFFECTIF exact : (1+mensuel)^12 = (1+annuel).
      const noFeeMonthlyRate = Math.max(0, (1 + _nfAnnual) > 0 ? Math.pow(1 + _nfAnnual, 1 / 12) - 1 : _nfAnnual / 12);
      const nfContribs = [];
      sortedMonths.forEach((monthKey, index) => {
        const mTxns = pTxns2.filter(t => t.date.substring(0, 7) === monthKey);
        mTxns.forEach(t => {
          if (t.type === 'deposit') {
            // montant brut (sans déduction des frais de versement)
            nfContribs.push({ v: t.amount || 0, si: index });
          } else if (t.type === 'withdrawal') {
            let rem = t.net_amount || t.amount;
            for (let i = nfContribs.length - 1; i >= 0 && rem > 0; i--) {
              if (nfContribs[i].v <= rem) { rem -= nfContribs[i].v; nfContribs[i].v = 0; }
              else { nfContribs[i].v -= rem; rem = 0; }
            }
          }
        });
        nfContribs.forEach(c => { if (c.v > 0 && index > c.si) c.v *= (1 + noFeeMonthlyRate); });
      });
      finalValueNoFees += nfContribs.reduce((s, c) => s + c.v, 0);
    });
    const finalValueWithFees = data[data.length - 1]?.total || 0;
    const feeImpact = Math.max(0, Math.round((finalValueNoFees - finalValueWithFees) * 100) / 100);

    // Détail des frais PAR ENVELOPPE à l'horizon, trié du plus élevé au plus faible.
    const feesByEnvelope = series
      .map(s => ({
        id: s.id, name: s.name, color: s.color,
        txFees: s.txFees || 0,
        annualFees: s.annualFees || 0,
        total: Math.round(((s.txFees || 0) + (s.annualFees || 0)) * 100) / 100,
      }))
      .filter(e => e.total > 0.005)
      .sort((a, b) => b.total - a.total);

    setHistoryData({ data, series, crossoverPoint, assetTypes, totalTxFees, totalAnnualFeeDrain, feeImpact, feesByEnvelope });

    // ── Q6 : tracker "projection long terme avec versement mensuel" ────────────
    // Déclenché à chaque recalcul du graphique (changement de targetDate ou refresh)
    try {
      const targetMs     = new Date(targetDate + '-01').getTime();
      const nowMs        = Date.now();
      const horizonYrs   = Math.max(0, (targetMs - nowMs) / (365.25 * 24 * 3600 * 1000));
      const txList       = sim.transactions || [];
      const totalDeposit = txList
        .filter(t => t.type === 'deposit')
        .reduce((sum, t) => sum + (t.net_amount || t.amount || 0), 0);
      dataService.trackLongTermProjection(horizonYrs, totalDeposit);
    } catch (_) {}

    // ── Q7 : frais non nuls dans le simulateur → flag simulatorFeesModified ──────
    try {
      const idx          = gamificationService.getState().currentQuestIndex ?? 1;
      const hasAnnualFees = (sim.portfolios || []).some(p => (p.annual_fees_pct || 0) > 0);
      const hasTxFees     = (sim.transactions || []).some(t => (t.fees_pct || 0) > 0 || (t.fees_amount || 0) > 0);
      if (hasAnnualFees || hasTxFees) {
        dataService.trackSimulatorFeesModified();
      }
    } catch (_) {}
  };

  useEffect(() => {
    refresh();
  }, [refresh]);


  // Recalculer le graphique quand la date cible change (sans recharger la simulation).
  // DÉBOUNCE 150 ms : le curseur d'horizon peut déclencher des dizaines de recalculs/seconde.
  // La projection complète est coûteuse (mois × enveloppes × contributions) ; on ne la relance
  // qu'une fois le déplacement stabilisé → le curseur reste fluide, le graphique suit juste après.
  useEffect(() => {
    if (!simulation) return;
    const th = setTimeout(() => calculateHistoryData(simulation), 150);
    return () => clearTimeout(th);
  }, [targetDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persister l'horizon de projection dans la simulation quand l'utilisateur bouge le curseur.
  // ITEM 6 — DEBOUNCE 500 ms : le slider peut déclencher cet effet plusieurs dizaines de
  // fois par seconde ; on n'écrit en localStorage qu'une fois le déplacement stabilisé.
  useEffect(() => {
    if (!_saveProjEnabled.current || !simulation) return;
    clearTimeout(_saveProjTimer.current);
    _saveProjTimer.current = setTimeout(() => {
      const yr        = parseInt(targetDate.substring(0, 4), 10);
      const projYears = yr > CURRENT_YEAR ? yr - CURRENT_YEAR : null;
      try {
        dataService.updateSimulation(simulation.id, { lastProjectionYears: projYears });
        // Prolonger les récurrents SANS date de fin (y compris importés) jusqu'à l'horizon :
        // matérialise les occurrences futures jusqu'à la date cible. Idempotent (dates manquantes
        // uniquement). Debouncé 500 ms → reste fluide même en déplaçant le curseur rapidement.
        const applied = dataService.syncSimulationRegularMovements(simulation.id, `${targetDate}-28`);
        if (applied > 0) refresh(); // recharge la simulation + recalcule chart/tuiles/historique
      } catch (_) {}
    }, 500);
    return () => clearTimeout(_saveProjTimer.current);
  }, [targetDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll automatique à droite du graphique
  useEffect(() => {
    if (barChartScrollRef.current && historyData.data.length > 0) {
      setTimeout(() => {
        if (barChartScrollRef.current) {
          barChartScrollRef.current.scrollLeft = barChartScrollRef.current.scrollWidth;
        }
      }, 100);
    }
  }, [historyData.data.length]);

  const handleCreatePortfolio = () => {
    if (!newPortfolio.name.trim()) {
      toast.error(t("simulation.nameRequired") || "Nom requis");
      return;
    }
    try {
      dataService.addSimulationPortfolio(id, newPortfolio);
      toast.success(t("common.success"));
      setCreateDialog(false);
      setNewPortfolio({ name: "", type: "PEA", annual_return_rate: 8, annual_fees_pct: 0, contract_start_date: new Date().toISOString().split('T')[0] });
      refresh();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleDeleteSimulation = () => {
    try {
      dataService.deleteSimulation(id);
      toast.success(t("common.success"));
      navigate("/simulation/portfolios");
    } catch (e) {
      toast.error(e.message);
    }
  };

  // Sauvegarder les paramètres FIRE
  const handleSaveFireSettings = () => {
    try {
      // Paramètres FIRE GLOBAUX (partagés avec la page Trophées — source unique)
      dataService.updateFireSettings({
        monthly_need: parseFloat(fireForm.monthly_need) || 2500,
        withdrawal_rate: parseFloat(fireForm.target_return_rate) || 4,
      });
      toast.success(t("common.success"));
      setFireSettingsDialog(false);

      // ── Défi mensuel (Prompt 9) ──────────────────────────────────────────────
      // Calculer l'âge FIRE approximatif à partir du crossoverPoint et de la date de naissance
      try {
        let fireTargetAge = null;
        const cp = historyData?.crossoverPoint;
        if (cp?.month) {
          const gState     = gamificationService.getState();
          const birthDate  = gState.profile?.birthDate;
          if (birthDate) {
            const fireDate    = new Date(cp.month + '-01');
            const birth       = new Date(birthDate);
            const ageAtFire   = Math.floor(
              (fireDate.getTime() - birth.getTime()) / (365.25 * 24 * 3600 * 1000)
            );
            if (ageAtFire > 0) fireTargetAge = ageAtFire;
          }
        }
        challengeService.trackFireSimulation(fireTargetAge);
      } catch (_) {}

      refresh();
    } catch (e) {
      toast.error(e.message);
    }
  };

  // Toggle inflation - switch direct sans dialogue
  const toggleInflation = () => {
    const newEnabled = !inflationEnabled;
    setInflationEnabled(newEnabled);
    
    try {
      dataService.updateSimulation(id, {
        inflation_settings: {
          enabled: newEnabled,
          rate: inflationRate,
        }
      });
      toast.success(newEnabled 
        ? (t("simulation.inflationEnabled") || `Inflation activée (${inflationRate}%)`)
        : (t("simulation.inflationDisabled") || "Inflation désactivée")
      );
      refresh();
    } catch (e) {
      toast.error(e.message);
    }
  };

  // Sauvegarder les paramètres d'inflation
  const handleSaveInflationSettings = () => {
    try {
      const parsedRate = parseFloat(inflationRate) || 2.5;
      dataService.updateSimulation(id, {
        inflation_settings: {
          enabled: inflationEnabled,
          rate: parsedRate,
        }
      });
      toast.success(t("common.success"));
      setInflationSettingsDialog(false);

      // ── Défi mensuel (Prompt 9) : inflation ≥ 4 % et horizon ≥ 20 ans ──────
      if (inflationEnabled) {
        try {
          // Calculer l'horizon en années depuis la date cible de projection
          const targetMs  = new Date(targetDate + '-01').getTime();
          const nowMs     = Date.now();
          const horizonYears = Math.max(0, (targetMs - nowMs) / (365.25 * 24 * 3600 * 1000));
          challengeService.trackHighInflationSimulation(parsedRate, horizonYears);
        } catch (_) {}
        // ── Mission 12 (décembre) : enveloppes importées + option inflation activée ──
        try {
          const simNow = dataService.getSimulation(id);
          if ((simNow?.portfolios || []).some(p => p.original_id)) {
            challengeService.markVisit('simInflationImport');
          }
        } catch (_) {}
      }

      refresh();
    } catch (e) {
      toast.error(e.message);
    }
  };

  // Vérifier si un stress test est actif
  const hasActiveStressTest = () => {
    if (!simulation) return false;
    return simulation.transactions.some(t => t.note && t.note.includes('Stress Test'));
  };

  // Toggle Stress Test - switch direct sans confirmation pour annuler
  const toggleStressTest = () => {
    try {
      const sim = dataService.getSimulation(id);
      if (!sim) return;
      
      // Vérifier si un stress test existe déjà
      const stressTestTxs = sim.transactions.filter(t => t.note && t.note.includes('Stress Test'));
      
      if (stressTestTxs.length > 0) {
        // Annuler le stress test - switch direct sans confirmation
        stressTestTxs.forEach(tx => {
          dataService.deleteSimulationTransaction(id, tx.id);
        });
        toast.success(t("simulation.stressTestCancelled") || "Stress Test annulé");
        refresh();
      } else {
        // Ouvrir le dialogue pour configurer le stress test
        setStressTestDialog(true);
      }
    } catch (e) {
      toast.error(e.message);
    }
  };

  // Appliquer le Stress Test en calculant la valeur réelle (avec intérêts composés) par type d'actif
  // Ordre d'application : -20% actions/ETF/obligations, puis -50% crypto
  // Le crash s'applique d'abord sur les intérêts, puis sur le capital si insuffisant
  const handleApplyStressTest = () => {
    try {
      const sim = dataService.getSimulation(id);
      if (!sim) return;

      let crashCount = 0;
      let totalCrashAmount = 0; // pour recordStressTestResult
      const crashDateStr = stressTestDate; // "YYYY-MM-DD"
      const crashMonth = crashDateStr.substring(0, 7); // "YYYY-MM"

      // Fonction fv locale (intérêts composés mensuels)
      const fv = (rate, nper, pmt, pv) => {
        if (rate === 0) return pv + pmt * nper;
        const factor = Math.pow(1 + rate, nper);
        return pv * factor + pmt * ((factor - 1) / rate);
      };

      sim.portfolios.forEach(portfolio => {
        const baseAnnualRate = (portfolio.annual_return_rate || 0) / 100;
        const envelopeAnnualFees = (portfolio.annual_fees_pct || 0) / 100;

        // Toutes les transactions de l'enveloppe, hors stress_crash existants
        const portfolioTxns = sim.transactions
          .filter(t =>
            t.portfolio_id === portfolio.id &&
            t.type !== 'stress_crash'
          )
          .sort((a, b) => a.date.localeCompare(b.date));

        if (!portfolioTxns.length) return;

        // Déterminer la plage de mois à simuler : du premier dépôt jusqu'au mois du crash
        const allDates = portfolioTxns.map(t => t.date.substring(0, 7));
        const minMonth = allDates.reduce((a, b) => a < b ? a : b);
        // Le max est le plus tard entre la dernière transaction et la date du crash
        const maxTxMonth = allDates.reduce((a, b) => a > b ? a : b);
        const effectiveCrashMonth = maxTxMonth > crashMonth ? maxTxMonth : crashMonth;
        const [minY, minM] = minMonth.split('-').map(Number);
        const [endY, endMNum] = effectiveCrashMonth.split('-').map(Number);

        const sortedMonths = [];
        let [y, m] = [minY, minM];
        while (y < endY || (y === endY && m <= endMNum)) {
          sortedMonths.push(`${y}-${String(m).padStart(2, '0')}`);
          m++;
          if (m > 12) { m = 1; y++; }
        }

        // Contributions composées par type d'actif
        // Chaque contribution: { amount (capital initial), monthlyRate, startMonthIndex, currentValue }
        const assetContribs = {}; // assetType -> [{amount, monthlyRate, startMonthIndex, currentValue}]
        // Versements nets cumulés par actif (base capital réelle, hors intérêts composés)
        const assetNetDeposits = {}; // assetType -> net deposits

        sortedMonths.forEach((monthKey, index) => {
          const monthTxns = portfolioTxns.filter(t => t.date.substring(0, 7) === monthKey);

          monthTxns.forEach(tx => {
            const netAmount = tx.net_amount || tx.amount || 0;
            const assetType = (tx.asset_type === 'autre' && tx.custom_asset_type)
              ? tx.custom_asset_type
              : (tx.asset_type || 'non_defini');

            if (!assetContribs[assetType]) assetContribs[assetType] = [];
            if (!assetNetDeposits[assetType]) assetNetDeposits[assetType] = 0;

            if (tx.type === 'deposit') {
              const txAnnualFees = ((tx.annual_fees_pct || 0) / 100) + envelopeAnnualFees;
              const monthlyRate = Math.max(0, baseAnnualRate - txAnnualFees) / 12;
              assetContribs[assetType].push({
                amount: netAmount,
                monthlyRate,
                startMonthIndex: index,
                currentValue: netAmount,
              });
              assetNetDeposits[assetType] += netAmount;
            } else if (tx.type === 'withdrawal') {
              // Retirer proportionnellement du dernier entré pour cet actif
              let remaining = netAmount;
              const contribs = assetContribs[assetType] || [];
              for (let i = contribs.length - 1; i >= 0 && remaining > 0; i--) {
                if (contribs[i].currentValue <= remaining) {
                  remaining -= contribs[i].currentValue;
                  contribs[i].currentValue = 0;
                } else {
                  contribs[i].currentValue -= remaining;
                  remaining = 0;
                }
              }
              assetNetDeposits[assetType] -= netAmount;
            }
          });

          // Capitaliser toutes les contributions actives pour ce mois
          Object.values(assetContribs).forEach(contribs => {
            contribs.forEach(contrib => {
              if (contrib.currentValue > 0 && index > contrib.startMonthIndex) {
                contrib.currentValue *= (1 + contrib.monthlyRate);
              }
            });
          });
        });

        // Appliquer le crash par type d'actif dans l'ordre : actions/ETF/obligations d'abord, puis crypto
        const crashOrder = [
          { types: ['action', 'etf', 'obligation'], percent: 0.20 },
          { types: ['crypto'], percent: 0.50 },
        ];

        crashOrder.forEach(({ types, percent }) => {
          types.forEach(assetType => {
            const contribs = assetContribs[assetType] || [];
            const totalValue = contribs.reduce((s, c) => s + c.currentValue, 0);
            if (totalValue <= 0) return;

            // Base capital = versements nets (pas de sur-estimation due aux intérêts)
            const totalCapital = Math.max(0, assetNetDeposits[assetType] || 0);
            const totalInterest = Math.max(0, totalValue - totalCapital);
            // Le crash s'applique sur le capital (les intérêts sont absorbés en premier)
            const crashAmount = Math.round(Math.min(totalCapital * percent, totalValue) * 100) / 100;
            const crashFromInterest = Math.min(totalInterest, crashAmount);
            const crashFromCapital = Math.max(0, crashAmount - crashFromInterest);
            const crashLabel = `${t(`assetTypes.${assetType}`)} -${Math.round(percent * 100)}%`;
            const noteDetail = crashFromCapital > 0
              ? `Stress Test - ${crashLabel} (intérêts: -${fmt(crashFromInterest)}, capital: -${fmt(crashFromCapital)})`
              : `Stress Test - ${crashLabel}`;

            dataService.addSimulationTransaction(id, portfolio.id, {
              date: stressTestDate,
              amount: crashAmount.toString(),
              fees_pct: "0",
              note: noteDetail,
              type: "stress_crash",
              asset_type: assetType,
            });
            totalCrashAmount += crashAmount;
            crashCount++;
          });
        });
      });

      dataService.updateSimulation(id, {
        stress_test_settings: { applied_date: stressTestDate },
      });

      dataService.trackStressTestLaunched();
      // ── Défi mensuel juillet (Prompt 9) : stress test sévère appliqué ──────
      try { challengeService.trackSevereStressTest(); } catch (_) {}
      // ── Mission 6 (juin) : un stress test a été lancé ───────────────────────
      try { challengeService.markVisit('stressTest'); } catch (_) {}
      // ── Trophées antifragile / bunker (#6) ──────────────────────────────────
      try {
        const currentTotalValue = stats?.totalValue || 0;
        if (currentTotalValue > 0) {
          const lossPct = Math.round((totalCrashAmount / currentTotalValue) * 100 * 10) / 10;
          require('../services/trophyService').default.recordStressTestResult(lossPct);
        }
      } catch (_) {}
      toast.success(t("simulation.stressTestApplied") || `Stress Test appliqué (${crashCount} type(s) d'actifs impactés)`);
      setStressTestDialog(false);
      refresh();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!simulation) return null;

  // Calculer les gains totaux (intérêts nets)
  const totalNetInterest = historyData.data.length > 0
    ? historyData.data[historyData.data.length - 1].netInterest
    : 0;

  // Crossover point
  const crossoverPoint = historyData.crossoverPoint;

  // Dernier point du graphique → totaux affichés dans les cards résumé
  const historyLastPoint = historyData.data.length > 0 ? historyData.data[historyData.data.length - 1] : null;
  const displayDeposits = historyLastPoint?.totalDeposits ?? stats?.totalDeposits ?? 0;
  const displayTotal = historyLastPoint?.total ?? stats?.totalValue ?? 0;
  const totalFees = (historyData.totalTxFees ?? 0) + (historyData.totalAnnualFeeDrain ?? 0);

  // Valeurs PROJETÉES par enveloppe à l'horizon (dernier point de la projection) :
  //  • solde     = valeur simulée (avec intérêts composés) à la date cible
  //  • versements = versements cumulés à l'horizon (récurrents en cours inclus)
  const horizonByEnv = {};
  if (historyLastPoint) {
    (historyData.series || []).forEach(s => {
      horizonByEnv[s.id] = {
        value:    historyLastPoint[s.id] ?? 0,
        deposits: s.deposits?.[historyLastPoint.month] ?? 0,
      };
    });
  }

  // ── FIRE PROJETÉ à la date cible ──────────────────────────────────────────
  // Le % FIRE et les revenus passifs sont calculés sur la valeur PROJETÉE
  // (displayTotal), et non sur la valeur courante : ils se mettent donc à jour
  // quand on déplace le curseur d'horizon.
  const fireRate          = stats?.fireRate ?? 4;
  const projAnnualIncome  = displayTotal * (fireRate / 100);
  const projMonthlyIncome = projAnnualIncome / 12;
  const projFireProgress  = (stats?.fireTarget > 0) ? Math.min(100, (displayTotal / stats.fireTarget) * 100) : 0;
  const isFireOn          = stats ? projAnnualIncome >= stats.annualNeed : false;

  // Domaine Y du graphique en bâtonnets (pour l'axe Y fixe)
  const yMaxRaw = historyData.data.reduce((m, d) => Math.max(m, d.total || 0), 0);
  const yMax = Math.max(1000, Math.ceil(yMaxRaw * 1.15 / 1000) * 1000);

  // Point de données correspondant à l'année sélectionnée (dernier mois de cette année dans les données)
  const targetYearPoints = historyData.data.filter(d => d.month && d.month.startsWith(String(selectedYear)));
  const targetYearPoint  = targetYearPoints.length > 0 ? targetYearPoints[targetYearPoints.length - 1] : null;
  const targetYearMonth  = targetYearPoint?.month ?? null;

  // Types d'actifs personnalisés depuis les transactions de la simulation
  const simCustomAssetTypes = simulation
    ? [...new Set(simulation.transactions.flatMap(tx => {
        if (tx.asset_type === 'autre' && tx.custom_asset_type) return [tx.custom_asset_type];
        if (tx.asset_type && !dataService.ASSET_TYPES.includes(tx.asset_type) && tx.asset_type !== 'non_defini') return [tx.asset_type];
        return [];
      }))]
    : [];

  // ── Évolution des enveloppes (graphique partagé avec le tableau de bord) ────
  // Reforme historyData (projection avec inflation/stress appliqués) au format
  // attendu par EnvelopeEvolutionChart : par enveloppe `${id}_cal` (valeur PROJETÉE)
  // + `${id}_dep` (versements cumulés), plus les totaux. hasCalibration=true →
  // la courbe « valeur » (noire) est tracée par-dessus les versements (ambre).
  const simColorForEnvId = (envId, i) =>
    (simulation.portfolios.find(p => p.id === envId)?.color) || COLORS[i % COLORS.length];
  const evolutionHistory = {
    hasCalibration: true,
    series: (historyData.series || []).map(s => ({ id: s.id, name: s.name })),
    data: (historyData.data || []).map(row => {
      const nr = { month: row.month, total_cal: row.total, total_dep: row.totalDeposits };
      (historyData.series || []).forEach(s => {
        nr[`${s.id}_cal`] = row[s.id] ?? 0;
        nr[`${s.id}_dep`] = s.deposits?.[row.month] ?? 0;
      });
      return nr;
    }),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link to="/simulation/portfolios">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold flex items-center gap-2">
              {simulation.name}
              {isFireOn && (
                <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white animate-pulse">
                  <Flame className="w-3 h-3 mr-1" /> FIRE ON
                </Badge>
              )}
            </h1>
            <p className="text-muted-foreground text-sm">{simulation.portfolios.length} {L('enveloppe(s)', 'envelope(s)')}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Bouton Inflation - Switch direct + Configuration */}
          <div className="flex">
            <Button 
              variant="outline" 
              onClick={toggleInflation}
              className={`rounded-r-none border-r-0 ${inflationEnabled ? "text-blue-600 hover:text-blue-700 border-blue-300 hover:border-blue-400 bg-blue-50" : "text-muted-foreground hover:text-blue-600 border-border hover:border-blue-300"}`}
              data-testid="inflation-toggle-btn"
            >
              <Percent className="w-4 h-4 mr-2" />
              {inflationEnabled ? `Inflation ${inflationRate}%` : "Inflation OFF"}
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setInflationSettingsDialog(true)}
              className={`rounded-l-none ${inflationEnabled ? "text-blue-600 hover:text-blue-700 border-blue-300 hover:border-blue-400 bg-blue-50" : "text-muted-foreground hover:text-blue-600 border-border hover:border-blue-300"}`}
              data-testid="inflation-settings-btn"
              title={t("simulation.inflationSettings") || "Paramètres Inflation"}
            >
              <Settings2 className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Bouton FIRE Settings */}
          <Button variant="outline" onClick={() => setFireSettingsDialog(true)} className="text-amber-600 hover:text-amber-700 border-amber-300 hover:border-amber-400" data-testid="fire-settings-btn">
            <Flame className="w-4 h-4 mr-2" /> {t("simulation.fireSettings") || "Paramètres FIRE"}
          </Button>
          
          {/* Bouton Stress Test - Switch direct pour annuler */}
          <Button 
            variant="outline" 
            onClick={toggleStressTest}
            onContextMenu={(e) => { e.preventDefault(); if (!hasActiveStressTest()) setStressTestDialog(true); }}
            className={hasActiveStressTest() ? "text-green-600 hover:text-green-700 border-green-300 hover:border-green-400 bg-green-50" : "text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"} 
            data-testid="stress-test-btn"
            title={hasActiveStressTest() ? "Cliquer pour annuler" : "Clic droit pour configurer"}
          >
            {hasActiveStressTest() ? <RotateCcw className="w-4 h-4 mr-2" /> : <TrendingDown className="w-4 h-4 mr-2" />}
            {hasActiveStressTest() ? (t("simulation.cancelStressTest") || "Annuler Crash") : (t("simulation.stressTest") || "Stress Test")}
          </Button>
          
          <Button variant="outline" onClick={() => setDeleteSimDialog(true)} className="text-destructive hover:text-destructive" data-testid="delete-sim-btn">
            <Trash2 className="w-4 h-4 mr-2" /> {t("simulation.deleteSimulation") || "Supprimer"}
          </Button>
        </div>
      </div>

      {/* Crossover Point Banner */}
      {crossoverPoint && (
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl p-4 text-white shadow-lg" data-testid="crossover-banner">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold flex items-center gap-2">
                <GlossaryTerm id="crossover">Crossover Point</GlossaryTerm> atteint !
                <Badge className="bg-white/20 text-white">{crossoverPoint.month}</Badge>
              </h3>
              <p className="text-white/80 text-sm">
                Vos intérêts cumulés ({fmt(crossoverPoint.interest)}) dépassent vos versements ({fmt(crossoverPoint.deposits)})
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats FIRE */}
      {stats && (
        <>
          {/* Célébration FIRE ON */}
          {isFireOn && (
            <div className="relative z-10 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-6 text-white shadow-lg" data-testid="fire-celebration">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                    <Flame className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-heading font-bold">{t("simulation.fireAchieved") || "Indépendance financière atteinte !"}</h2>
                    <p className="text-white/80 mt-1">
                      {L(`Vos revenus passifs (${fmt(projMonthlyIncome)}/mois) couvrent vos besoins (${fmt(stats.monthlyNeed)}/mois)`,
                        `Your passive income (${fmt(projMonthlyIncome)}/month) covers your needs (${fmt(stats.monthlyNeed)}/month)`)}
                    </p>
                  </div>
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-4xl font-heading font-bold">{projFireProgress.toFixed(0)}%</p>
                  <p className="text-white/80 text-sm">{t("simulation.fireExcess") || "Excédent"}: {fmt(projMonthlyIncome - stats.monthlyNeed)}{L('/mois', '/month')}</p>
                </div>
              </div>
            </div>
          )}
          
          <div className={`grid grid-cols-2 sm:grid-cols-5 gap-4 relative z-10 ${isFireOn ? 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 p-4 rounded-xl border border-amber-200 dark:border-amber-800' : ''}`}>
            {/* Portefeuille total — chiffre le plus important : mis en avant (bordure + taille) */}
            <Card className="border-2 border-primary shadow-md ring-1 ring-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-primary">{t("simulation.totalPortfolio") || "Portefeuille total"}</p>
                <p className="text-2xl font-heading font-extrabold mt-1 tabular-nums text-primary">{fmt(displayTotal)}</p>
              </CardContent>
            </Card>
            <Card className="border border-border shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{t("simulation.totalDeposits") || "Total versé"}</p>
                <p className="text-lg font-heading font-bold mt-1 tabular-nums text-emerald-600">{fmt(displayDeposits)}</p>
              </CardContent>
            </Card>
            <Card className="border border-border shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{t("simulation.netInterest") || "Intérêts nets"}</p>
                <p className={`text-lg font-heading font-bold mt-1 tabular-nums ${totalNetInterest >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
                  {totalNetInterest >= 0 ? '+' : ''}{fmt(totalNetInterest)}
                </p>
                {displayDeposits > 0 && (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {totalNetInterest >= 0 ? '+' : ''}{((totalNetInterest / displayDeposits) * 100).toFixed(1)} %
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className={`border shadow-sm ${isFireOn ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/50' : 'border-border'}`}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Flame className="w-3 h-3" /> FIRE
                </p>
                <p className="text-lg font-heading font-bold mt-1 tabular-nums">
                  {projFireProgress.toFixed(0)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {fmt(projMonthlyIncome)}{L('/mois', '/month')}
                </p>
              </CardContent>
            </Card>
            <Card className="border border-border shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground"><GlossaryTerm id="fire">{t("simulation.fireTarget") || "Objectif FIRE"}</GlossaryTerm></p>
                <p className="text-lg font-heading font-bold mt-1 tabular-nums text-amber-600">{fmt(stats.fireTarget)}</p>
                <p className="text-xs text-muted-foreground">
                  {t("simulation.fireNeed") || "Besoin"}: {fmt(stats.monthlyNeed)}{L('/mois', '/month')}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ── Frais totaux — composant partagé avec le tableau de bord ── */}
          <div className="relative z-10">
            <TotalFeesCard
              totalFees={totalFees}
              label={t("simulation.totalFees") || "Frais totaux"}
              detail={
                totalFees > 0
                  ? `${t("simulation.feesEntry") || "versement"}${L(' :', ':')} ${fmt(historyData.totalTxFees ?? 0)} · ${t("simulation.feesAnnual") || "annuels"}${L(' :', ':')} ${fmt(historyData.totalAnnualFeeDrain ?? 0)}`
                  : null
              }
              impact={
                (historyData.feeImpact ?? 0) > 0
                  ? `${t("simulation.feeImpact") || "soit"} ${fmt(historyData.feeImpact)} ${t("simulation.feeImpactSuffix") || "de moins à terme"}`
                  : null
              }
              onExpand={(historyData.feesByEnvelope || []).length > 0 ? () => setFeeBreakdownOpen(true) : null}
              expandLabel={L('Détail des frais par enveloppe', 'Fee breakdown by envelope')}
            />
          </div>
        </>
      )}

      {/* Liste des enveloppes — même présentation que le tableau de bord (lignes teintées,
          colonnes Nom / Type / Solde / Versements, clic sur toute la ligne → fiche détaillée).
          Les actions de gestion (modifier / supprimer / ajouter un mouvement) apparaissent au survol. */}
      <Card className="border border-border shadow-sm relative z-10" data-testid="sim-portfolio-table">
        <CardHeader>
          <div className="flex flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CardTitle className="font-heading text-lg">{t("dashboard.portfolios")}</CardTitle>
              <Badge variant="secondary">{simulation.portfolios.length} {L('enveloppe', 'envelope')}{simulation.portfolios.length !== 1 ? 's' : ''}</Badge>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* Mouvements récurrents — même menu que sur les enveloppes, scopé à la simulation */}
              <Button
                variant="outline"
                className="shadow-sm"
                data-testid="sim-regular-movements-btn"
                onClick={() => setRegularMovementsOpen(true)}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {L('Mouvements récurrents', 'Recurring movements')}
              </Button>
              <Button onClick={() => setCreateDialog(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md" data-testid="create-sim-portfolio-btn">
                <Plus className="w-4 h-4 mr-2" /> {t("simulation.addSimulation")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {simulation.portfolios.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>{t("dashboard.noPortfolios")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table><TableHeader><TableRow>
                <TableHead>{t("portfolio.name")}</TableHead><TableHead>{t("portfolio.type")}</TableHead>
                <TableHead className="text-right">{t("portfolio.balance")}</TableHead>
                <TableHead className="text-right">{t("portfolio.deposits")}</TableHead><TableHead className="hidden sm:table-cell"></TableHead>
              </TableRow></TableHeader>
              <TableBody>{simulation.portfolios.map((p) => {
                // Sim : « Solde » = valeur PROJETÉE à l'horizon (intérêts compris) ;
                // « Versements » = versements cumulés à l'horizon (récurrents en cours inclus).
                // Rendement % = (valeur projetée − versements projetés) / versements projetés.
                const h          = horizonByEnv[p.id];
                const soldeProj  = h ? h.value    : (p.balance || 0);
                const depProj    = h ? h.deposits : ((p.total_deposits || 0) - (p.total_withdrawals || 0));
                const gainPct    = depProj > 0 ? (soldeProj - depProj) / depProj * 100 : null;
                return (
                <TableRow
                  key={p.id}
                  className="group cursor-pointer hover:!bg-accent/50 transition-colors"
                  onClick={() => navigate(`/simulation/portfolios/${id}/envelope/${p.id}`)}
                  data-testid={`sim-portfolio-row-${p.id}`}
                  style={{ backgroundColor: envTintBg(p.color), color: envTextColor(p.color) }}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} aria-hidden="true" />
                      {p.name}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{t(`types.${p.type}`)}</Badge></TableCell>
                  <TableCell className="text-right font-mono tabular-nums font-medium">
                    <div>{fmt(soldeProj)}</div>
                    {gainPct !== null && (
                      <div className="text-xs font-normal" style={{ color: envGainColor(p.color, gainPct >= 0) }}>
                        {gainPct >= 0 ? '+' : '−'}{Math.abs(gainPct).toFixed(1)} %
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums" style={{ color: envMutedTextColor(p.color) }}>{fmt(depProj)}</TableCell>
                  <TableCell className="hidden sm:table-cell text-right">
                    {/* Ligne épurée comme le tableau de bord : navigation au clic, gestion sur la fiche détaillée */}
                    <ChevronRight className="w-4 h-4 text-muted-foreground inline-block" />
                  </TableCell>
                </TableRow>
                );
              })}</TableBody></Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Évolution des enveloppes — graphique partagé avec le tableau de bord (valeurs PROJETÉES).
          Les contrôles de projection (date cible + slider d'année) pilotent l'horizon. */}
      {historyData.data.length > 0 && (
        <div className="space-y-3 relative z-10">
          {/* Contrôles de projection : date cible + slider d'année */}
          <Card className="border border-border shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Label className="text-sm whitespace-nowrap">{t("simulation.targetDate") || "Date cible"}:</Label>
                  <Popover open={targetDateOpen} onOpenChange={setTargetDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-44 justify-start gap-2 font-normal"
                        data-testid="target-date-input"
                      >
                        <CalendarIcon className="h-4 w-4 shrink-0" />
                        {(() => {
                          const [y, mo] = targetDate.split('-').map(Number);
                          return new Date(y, mo - 1, 1).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', { month: 'long', year: 'numeric' });
                        })()}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        selected={(() => { const [y, mo] = targetDate.split('-').map(Number); return new Date(y, mo - 1, 1); })()}
                        onSelect={day => {
                          if (day) {
                            const y = day.getFullYear();
                            const mo = String(day.getMonth() + 1).padStart(2, '0');
                            setTargetDate(`${y}-${mo}`);
                            setTargetDateOpen(false);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <span className="text-xs text-muted-foreground">{t("simulation.projectionHorizonHint")}</span>
              </div>
              {/* ── Slider d'année cible ────────────────────────────────────── */}
              <div className="space-y-1 px-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>{CURRENT_YEAR}</span>
                  <span className="font-semibold text-primary text-sm">
                    <span ref={_sliderLabelRef}>{selectedYear}</span>
                    {targetYearPoint && (
                      <span className="ml-2 font-normal text-xs text-muted-foreground">
                        — {fmt(targetYearPoint.total ?? 0)}
                      </span>
                    )}
                  </span>
                  <span>{MAX_YEAR}</span>
                </div>
                {/* Curseur non contrôlé : pendant le glissement on met à jour l'étiquette via
                    une ref (aucun re-render → fluide) ; la date cible n'est validée qu'au
                    relâchement (souris/tactile/clavier), déclenchant alors un seul recalcul.
                    `key` force la resynchronisation du curseur si targetDate change ailleurs. */}
                <input
                  key={`year-slider-${selectedYear}`}
                  type="range"
                  min={CURRENT_YEAR}
                  max={MAX_YEAR}
                  step={1}
                  defaultValue={selectedYear}
                  onChange={e => { if (_sliderLabelRef.current) _sliderLabelRef.current.textContent = e.target.value; }}
                  onMouseUp={e => handleSliderYear(parseInt(e.target.value, 10))}
                  onTouchEnd={e => handleSliderYear(parseInt(e.target.value, 10))}
                  onKeyUp={e => handleSliderYear(parseInt(e.target.value, 10))}
                  className="w-full h-2 rounded-full cursor-pointer accent-primary"
                  data-testid="year-slider"
                />
              </div>
            </CardContent>
          </Card>

          {/* Graphique d'évolution partagé : vue synthétique / détaillée + couleurs des enveloppes */}
          <EnvelopeEvolutionChart
            historyData={evolutionHistory}
            getColor={simColorForEnvId}
            detailView={chartDetailView}
            onToggleView={() => setChartDetailView(v => !v)}
            title={t("simulation.evolutionEnvelopes")}
            valueLegendLabel={t("simulation.projectedValue")}
            depositsLegendLabel={t("simulation.cumulativeDeposits")}
          />
        </div>
      )}

      {/* Graphique détaillé en bâtonnets avec axe Y fixe (Fix 10) */}
      {historyData.data.length > 0 && historyData.series.length > 0 && (
        <Card className="border border-border shadow-sm relative z-10">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                {t("dashboard.evolutionChart")}
                {inflationEnabled && (
                  <Badge variant="outline" className="text-blue-600 border-blue-300">
                    <Percent className="w-3 h-3 mr-1" /> Inflation {inflationRate}%
                  </Badge>
                )}
                {crossoverPoint && (
                  <Badge className="bg-emerald-500 text-white">
                    <Zap className="w-3 h-3 mr-1" /> Crossover
                  </Badge>
                )}
              </CardTitle>
              {/* Switch enveloppes/actifs pour les bâtonnets */}
              <div className="flex items-center gap-2 text-sm">
                <span className={!barViewByAsset ? "font-medium" : "text-muted-foreground"}>{t("dashboard.viewByEnvelope")}</span>
                <Switch checked={barViewByAsset} onCheckedChange={setBarViewByAsset} data-testid="bar-view-switch" />
                <span className={barViewByAsset ? "font-medium" : "text-muted-foreground"}>{t("dashboard.viewByAsset")}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Légende fixe */}
            <div className="flex flex-wrap gap-4 mb-4 pb-3 border-b border-border">
              {!barViewByAsset ? (
                historyData.series.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: s.color || COLORS[i % COLORS.length] }} />
                    <span className="text-sm font-medium">{s.name}</span>
                  </div>
                ))
              ) : (
                (historyData.assetTypes || []).map((a, i) => (
                  <div key={a.id} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-sm font-medium">{t(`assetTypes.${a.type}`) || a.name}</span>
                  </div>
                ))
              )}
              <div className="flex items-center gap-2">
                <div className="w-4 h-[3px] bg-sky-500 rounded" />
                <span className="text-sm text-muted-foreground">{t("simulation.totalPortfolio") || "Total portefeuille"}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-[3px] bg-emerald-500 rounded" />
                <span className="text-sm text-muted-foreground">{t("simulation.cumulativeDeposits") || "Versements cumulés"}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-[3px] bg-amber-500 rounded" />
                <span className="text-sm text-muted-foreground">{t("simulation.netInterest") || "Intérêts nets"}</span>
              </div>
            </div>

            {/* Deux panneaux : axe Y fixe à gauche + graphique scrollable à droite */}
            <div className="flex">
              {/* Panneau Y-axis fixe */}
              <div style={{ width: 55, flexShrink: 0, overflow: 'hidden' }}>
                <ResponsiveContainer width={55} height={300}>
                  <ComposedChart data={historyData.data} margin={{ top: 5, right: 0, bottom: 50, left: 0 }}>
                    <YAxis
                      tick={{ fontSize: 10 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={v => `${(v/1000).toFixed(0)}k`}
                      domain={[0, yMax]}
                      width={55}
                    />
                    <Bar dataKey="total" fill="transparent" opacity={0} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              {/* Graphique scrollable sans axe Y */}
              <div ref={barChartScrollRef} className="overflow-x-auto pb-2 flex-1" style={{ scrollbarWidth: 'thin' }}>
                <div style={{ minWidth: Math.max(600, historyData.data.length * 25) }}>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={historyData.data} barCategoryGap="8%" margin={{ top: 5, right: 10, bottom: 50, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" interval={0} angle={-45} textAnchor="end" height={50} />
                      <YAxis hide domain={[0, yMax]} />
                      <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      {crossoverPoint && (
                        <ReferenceLine x={crossoverPoint.month} stroke="#10b981" strokeWidth={2} strokeDasharray="6 3" />
                      )}
                      {/* Bâtonnets empilés */}
                      {!barViewByAsset ? (
                        historyData.series.map((s, i) => (
                          <Bar key={s.id} dataKey={s.id} stackId="stack" fill={s.color || COLORS[i % COLORS.length]} name={s.name} radius={i === historyData.series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                        ))
                      ) : (
                        (historyData.assetTypes || []).map((a, i) => (
                          <Bar key={a.id} dataKey={a.id} stackId="stack" fill={COLORS[i % COLORS.length]} name={t(`assetTypes.${a.type}`) || a.name} radius={i === (historyData.assetTypes?.length || 1) - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                        ))
                      )}
                      {/* Courbe total portefeuille (Fix 10) */}
                      <Line type="monotone" dataKey="total" stroke="#0284C7" strokeWidth={2} dot={false} name={t("simulation.totalPortfolio") || "Total portefeuille"} />
                      {/* Courbe versements cumulés */}
                      <Line type="monotone" dataKey="totalDeposits" stroke="#10b981" strokeWidth={2} dot={false} name={t("simulation.cumulativeDeposits") || "Versements cumulés"} />
                      {/* Courbe intérêts nets */}
                      <Line type="monotone" dataKey="netInterest" stroke="#f59e0b" strokeWidth={2} dot={false} name={t("simulation.netInterest") || "Intérêts nets"} />
                      {/* Pastille crossover */}
                      {crossoverPoint && (
                        <ReferenceDot x={crossoverPoint.month} y={crossoverPoint.interest} r={8} fill="#10b981" stroke="#fff" strokeWidth={2} />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog création enveloppe */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">{t("simulation.addSimulation")}</DialogTitle>
            <DialogDescription>{t("simulation.createPortfolioDesc") || "Ajoutez une enveloppe fictive à cette simulation"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("portfolio.name")}</Label>
              <Input value={newPortfolio.name} onChange={e => setNewPortfolio({...newPortfolio, name: e.target.value})} data-testid="sim-portfolio-name-input" />
            </div>
            <div>
              <Label>{t("portfolio.type")}</Label>
              <Select value={newPortfolio.type} onValueChange={v => setNewPortfolio({...newPortfolio, type: v, annual_return_rate: DEFAULT_RATES[v] || 8})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map(ty => <SelectItem key={ty} value={ty}>{t(`types.${ty}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("portfolio.annualRate")}</Label>
              <Input type="number" step="0.1" value={newPortfolio.annual_return_rate} onChange={e => setNewPortfolio({...newPortfolio, annual_return_rate: parseFloat(e.target.value) || 0})} />
            </div>
            <div>
              <Label>{t("portfolio.annualFees")}</Label>
              <Input type="number" step="0.1" value={newPortfolio.annual_fees_pct} onChange={e => setNewPortfolio({...newPortfolio, annual_fees_pct: parseFloat(e.target.value) || 0})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCreateDialog(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleCreatePortfolio} className="bg-emerald-600 hover:bg-emerald-700" data-testid="confirm-create-sim-portfolio-btn">{t("common.create")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog détail des frais par enveloppe (à la date cible) */}
      <Dialog open={feeBreakdownOpen} onOpenChange={setFeeBreakdownOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">{L('Détail des frais par enveloppe', 'Fee breakdown by envelope')}</DialogTitle>
            <DialogDescription>
              Frais cumulés (versement + annuels) à l'horizon {selectedYear}, du plus élevé au plus faible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {(historyData.feesByEnvelope || []).map(e => (
              <div key={e.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-l-4 border-border bg-card" style={{ borderLeftColor: e.color }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: e.color }} aria-hidden="true" />
                  <span className="text-sm font-medium truncate">{e.name}</span>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-400">{fmt(e.total)}</div>
                  <div className="text-[11px] text-muted-foreground tabular-nums">
                    versement {fmt(e.txFees)} · annuels {fmt(e.annualFees)}
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 px-2.5 pt-2 mt-1 border-t border-border font-semibold text-sm">
              <span>Total</span>
              <span className="tabular-nums text-amber-600 dark:text-amber-400">{fmt(totalFees)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setFeeBreakdownOpen(false)}>{t("common.close") || "Fermer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog suppression simulation */}
      <Dialog open={deleteSimDialog} onOpenChange={setDeleteSimDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading text-destructive">{t("simulation.deleteSimulation")}</DialogTitle>
            <DialogDescription>{t("simulation.deleteSimulationConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteSimDialog(false)}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={handleDeleteSimulation} data-testid="confirm-delete-sim-btn">{t("simulation.confirmDelete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Dialog paramètres FIRE */}
      <Dialog open={fireSettingsDialog} onOpenChange={setFireSettingsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2 text-amber-600">
              <Flame className="w-5 h-5" />
              <GlossaryTerm id="fire">{t("simulation.fireSettings") || "Paramètres FIRE"}</GlossaryTerm>
            </DialogTitle>
            <DialogDescription>
              {t("simulation.fireSettingsDesc") || "Configurez vos objectifs d'indépendance financière"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("simulation.monthlyNeed") || "Besoins mensuels (€)"}</Label>
              <Input 
                type="number" 
                step="100" 
                value={fireForm.monthly_need} 
                onChange={e => setFireForm({...fireForm, monthly_need: e.target.value})} 
                data-testid="fire-monthly-need"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("simulation.monthlyNeedHint") || "Montant mensuel dont vous avez besoin pour vivre"}
              </p>
            </div>
            <div>
              <Label>{t("simulation.targetReturnRate") || "Taux de retrait sûr (%)"}</Label>
              <Input 
                type="number" 
                step="0.1" 
                value={fireForm.target_return_rate} 
                onChange={e => setFireForm({...fireForm, target_return_rate: e.target.value})} 
                data-testid="fire-return-rate"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("simulation.targetReturnRateHint") || "Généralement 4% (règle des 4%)"}
              </p>
            </div>
            <div className="bg-accent/50 rounded-lg p-4">
              <p className="text-sm font-medium">{t("simulation.fireCalculation") || "Calcul FIRE"}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("simulation.fireFormula") || "Capital nécessaire = Besoins annuels ÷ Taux de retrait"}
              </p>
              <p className="text-lg font-bold mt-2 text-amber-600">
                {fmt((parseFloat(fireForm.monthly_need) || 0) * 12 / ((parseFloat(fireForm.target_return_rate) || 4) / 100))}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setFireSettingsDialog(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSaveFireSettings} className="bg-amber-600 hover:bg-amber-700" data-testid="confirm-fire-settings-btn">
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Stress Test */}
      <Dialog open={stressTestDialog} onOpenChange={setStressTestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2 text-red-600">
              <TrendingDown className="w-5 h-5" />
              <GlossaryTerm id="stress_test">{t("simulation.stressTest") || "Stress Test - Crash Boursier"}</GlossaryTerm>
            </DialogTitle>
            <DialogDescription>
              {t("simulation.stressTestDesc") || "Simulez un crash boursier pour tester la résilience de votre patrimoine"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("simulation.stressTestDate") || "Date du crash"}</Label>
              <Input 
                type="date" 
                value={stressTestDate} 
                onChange={e => setStressTestDate(e.target.value)} 
                data-testid="stress-test-date"
              />
            </div>
            <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-4 border border-red-200 dark:border-red-800">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">{t("simulation.stressTestImpact") || "Impact du crash par type d'actif"}</p>
              <ul className="text-sm text-red-600 dark:text-red-500 mt-2 space-y-1">
                <li className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" />
                  {t("simulation.stressTestCrypto") || "Crypto-monnaies"}{L(' :', ':')} <strong>-50%</strong>
                </li>
                <li className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" />
                  {t("simulation.stressTestStocks") || "Actions et Obligations"}{L(' :', ':')} <strong>-20%</strong>
                </li>
              </ul>
              <p className="text-xs text-muted-foreground mt-3">
                {L("Les autres types d'actifs (fonds euros, immobilier, SCPI, or, exotique) ne sont pas affectés.", 'Other asset types (euro funds, real estate, SCPI, gold, exotic) are not affected.')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setStressTestDialog(false)}>{t("common.cancel")}</Button>
            <Button 
              onClick={handleApplyStressTest} 
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-stress-test-btn"
            >
              <TrendingDown className="w-4 h-4 mr-2" /> {t("simulation.applyStressTest") || "Appliquer le crash"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog paramètres Inflation */}
      <Dialog open={inflationSettingsDialog} onOpenChange={setInflationSettingsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2 text-blue-600">
              <Percent className="w-5 h-5" />
              <GlossaryTerm id="inflation">{t("simulation.inflationSettings") || "Paramètres Inflation"}</GlossaryTerm>
            </DialogTitle>
            <DialogDescription>
              {t("simulation.inflationSettingsDesc") || "L'inflation réduit le rendement réel de vos placements"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>{t("simulation.inflationEnabled") || "Activer l'inflation"}</Label>
              <Switch 
                checked={inflationEnabled} 
                onCheckedChange={setInflationEnabled}
                data-testid="inflation-switch"
              />
            </div>
            <div>
              <Label>{t("simulation.inflationRate") || "Taux d'inflation annuel (%)"}</Label>
              <Input 
                type="number" 
                step="0.1" 
                value={inflationRate} 
                onChange={e => setInflationRate(parseFloat(e.target.value) || 2.5)} 
                data-testid="inflation-rate-input"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("simulation.inflationRateHint") || "Généralement entre 2% et 3% par an"}
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                {t("simulation.inflationExplanation") || "Comment ça marche ?"}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-500 mt-2">
                {t("simulation.inflationExplanationDesc") || "L'inflation est soustraite du rendement annuel net. Exemple : 8% rendement - 0.5% frais - 2.5% inflation = 5% rendement réel."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setInflationSettingsDialog(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSaveInflationSettings} className="bg-blue-600 hover:bg-blue-700" data-testid="confirm-inflation-settings-btn">
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mouvements récurrents scopés à la simulation (même panneau que les enveloppes) */}
      <RegularMovementsPanel
        open={regularMovementsOpen}
        onClose={() => setRegularMovementsOpen(false)}
        portfolios={simulation.portfolios}
        dataSource={simDataSource}
        onSaved={refresh}
      />

      <Disclaimer simulation />
    </div>
  );
}

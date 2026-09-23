// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import dataService from "../services/dataService";
import { useLanguage } from "../context/LanguageContext";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { toast } from "sonner";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, ReferenceLine, ResponsiveContainer } from "recharts";
import { Plus, ArrowLeft, TrendingUp, Briefcase, Flame, Trash2 } from "lucide-react";
import { buildYears } from "../lib/rule843";
import Disclaimer from "../components/ui/Disclaimer";

const MONTHS_ABBR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
const DAY_MS = 86400000;

const COLORS       = ["#059669", "#D97706"];
const PROJ_COLOR   = "#7C3AED"; // violet — courbe de projection
const CURRENT_YEAR = new Date().getFullYear();

// Cache en mémoire par simulation, survivant aux re-montages (module scope).
// Clé = id|updated_at|lastProjectionYears — invalidée automatiquement
// par updateSimulation() qui met à jour updated_at à chaque écriture.
// SimulationList ne s'abonne à aucun événement dataService : les mouvements
// récurrents du portefeuille réel ne déclenchent jamais de recalcul ici.
const _statsCache = new Map();
const _makeSimCacheKey = (sim) =>
  `${sim.id}|${sim.updated_at}|${sim.lastProjectionYears ?? ''}`;

const EMPTY_STATS = {
  totalValue: 0, totalGains: 0, chartData: [],
  projected: false, lastProjectionYears: null, isFireOn: false,
};

// Calcul des stats d'une tuile de simulation. Résultat mis en cache ;
// ne recalcule que si id, updated_at ou lastProjectionYears change.
function _computeSimStats(sim) {
  const cacheKey = _makeSimCacheKey(sim);
  if (_statsCache.has(cacheKey)) return _statsCache.get(cacheKey);

  const stats = dataService.getSimulationStats(sim.id);
  if (!stats) {
    const empty = { ...EMPTY_STATS };
    _statsCache.set(cacheKey, empty);
    return empty;
  }

  // ── Données pour le mini-graphique (historique mensuel) ──────────────────
  const rawHistory = [];
  let cumDeposits = 0;
  let cumValue    = 0;

  // Copie triée pour ne pas muter l'objet sim en cache/state. Historique arrêté au mois
  // courant : les occurrences futures des récurrents, matérialisées jusqu'à l'horizon,
  // relèvent de la projection — les mêler à l'historique désordonnait l'axe du temps.
  const nowMonth   = new Date().toISOString().substring(0, 7);
  const sortedTxns = [...sim.transactions]
    .filter(t => t.date && t.date.substring(0, 7) <= nowMonth)
    .sort((a, b) => a.date.localeCompare(b.date));
  const months = {};
  sortedTxns.forEach(t => {
    const m = t.date.substring(0, 7);
    if (!months[m]) months[m] = [];
    months[m].push(t);
  });

  Object.keys(months).sort().forEach(month => {
    months[month].forEach(t => {
      const net = t.net_amount || t.amount;
      if (t.type === 'deposit') { cumDeposits += net; cumValue += net; }
      else                      { cumDeposits -= net; cumValue -= net; }
    });
    rawHistory.push({ month, value: cumValue, deposits: cumDeposits });
  });

  if (rawHistory.length === 0) rawHistory.push({ month: nowMonth, value: 0, deposits: 0 });

  // Sous-échantillonnage : ≤ 120 mois → 1 pt/trimestre, > 120 mois → 1 pt/semestre.
  // Un mini-graphique de 80 px ne bénéficie pas de centaines de points mensuels.
  const nHist = rawHistory.length;
  const step  = nHist > 120 ? 6 : 3;
  const chartData = nHist > 3
    ? rawHistory.filter((_, i) => i % step === 0 || i === nHist - 1)
    : rawHistory;

  // ── Valeur / gains (moteur EXACT de la page de simulation) ─────────────────
  // On utilise `computeSimulationProjection` (mêmes contributions par transaction,
  // mêmes frais, mêmes versements EXTERNES) pour que la tuile affiche EXACTEMENT le
  // même « Portefeuille total » et les mêmes gains que la page détaillée — à l'horizon
  // de projection si défini, sinon à aujourd'hui.
  const lastProjYears = sim.lastProjectionYears || null;
  const targetMonth   = lastProjYears > 0 ? `${CURRENT_YEAR + lastProjYears}-${nowMonth.slice(5, 7)}` : null;

  const proj      = dataService.computeSimulationProjection(sim.id, targetMonth);
  const nowProj   = lastProjYears > 0 ? dataService.computeSimulationProjection(sim.id, null) : proj;
  const displayValue = proj ? proj.totalValue : stats.totalValue;
  const displayGains = proj ? proj.totalGains : stats.totalGains;
  const projected    = lastProjYears > 0 && !!proj;

  if (lastProjYears > 0) {
    const startValue = (nowProj ? nowProj.totalValue : stats.totalValue) || 0;
    const endValue   = displayValue || startValue;
    const targetYear = CURRENT_YEAR + lastProjYears;
    // Courbe : composition au taux annuel IMPLICITE reliant la valeur actuelle à la
    // valeur projetée (points intermédiaires lissés ; les DEUX extrémités sont exactes).
    const impliedRate = (startValue > 0 && endValue > 0)
      ? Math.pow(endValue / startValue, 1 / lastProjYears) - 1
      : 0;
    // La projection part du dernier point d'historique (mois courant), puis un point
    // par 1er janvier : l'axe reste chronologique et sans mois en double.
    const dernier = chartData[chartData.length - 1];
    if (dernier) dernier.proj = Math.round(startValue);
    const projPoints = [];
    for (let yr = CURRENT_YEAR + 1; yr <= targetYear; yr++) {
      projPoints.push({ month: `${yr}-01`, value: null, deposits: null, proj: Math.round(startValue * Math.pow(1 + impliedRate, yr - CURRENT_YEAR)) });
    }
    chartData.push(...projPoints);
  }

  const result = {
    totalValue:          displayValue,
    totalGains:          displayGains,
    chartData,
    // FIRE : sur la valeur affichée (projetée si horizon défini), cohérent avec la page.
    isFireOn:            stats.fireTarget > 0 && displayValue >= stats.fireTarget,
    projected,
    lastProjectionYears: lastProjYears,
  };
  _statsCache.set(cacheKey, result);
  return result;
}

export default function SimulationList() {
  const { t, lang } = useLanguage();
  const L = (fr, en) => (lang === 'en' ? en : fr);
  const navigate = useNavigate();
  const [simulations, setSimulations] = useState([]);
  const [rule843Sims, setRule843Sims] = useState([]);
  const [createDialog, setCreateDialog] = useState(false);
  const [createStep, setCreateStep] = useState('choice'); // 'choice' = type de simulation, 'classic' = options des simulations classiques
  const [newSimName, setNewSimName] = useState("");
  const [simBlank, setSimBlank] = useState(false); // false = importer enveloppes, true = vierge
  // Cible de suppression : { id, type: 'sim' | '843', name } | null
  const [deleteTarget, setDeleteTarget] = useState(null);

  const refresh = useCallback(() => {
    setSimulations(dataService.getSimulations());
    setRule843Sims(dataService.getRule843Sims());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const fmt = (v) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

  // Données des tuiles « Règle 8-4-3 » : mini graphique empilé + repère « Aujourd'hui »
  const rule843Charts = useMemo(() => rule843Sims.map(sim => {
    let data = [];
    try {
      data = buildYears({
        selectedIds: sim.envelopeIds || [], startYear: sim.startYear, startMonth: sim.startMonth,
        monthlyDeposit: sim.monthlyDeposit, annualYield: sim.annualYield, startCapital: sim.startCapital,
      }).map(r => ({ ann: `An ${r.k}`, dep: Math.min(r.cumDep, Math.max(0, r.value)), int: Math.max(0, r.value - r.cumDep) }));
    } catch (_) { data = []; }
    const startMs = new Date(`${sim.startYear}-${String(sim.startMonth).padStart(2, '0')}-01`).getTime();
    const yrs = (Date.now() - startMs) / (365.25 * DAY_MS);
    const todayK = yrs >= 0 && yrs <= 15 ? Math.floor(yrs) : null;
    const title = sim.name || `Règle 8-4-3 — ${MONTHS_ABBR[(sim.startMonth || 1) - 1]} ${sim.startYear}`;
    return { sim, data, todayK, title };
  }), [rule843Sims]);

  // Stats calculées hors du rendu (requestIdleCallback / setTimeout 0).
  // La garde d'identité dans setState évite un re-render quand toutes les
  // entrées sont déjà en cache et le résultat est identique.
  const [allSimStats, setAllSimStats] = useState([]);

  useEffect(() => {
    const schedule = typeof requestIdleCallback !== 'undefined'
      ? requestIdleCallback
      : (fn) => setTimeout(fn, 0);
    const cancel = typeof cancelIdleCallback !== 'undefined'
      ? cancelIdleCallback
      : clearTimeout;
    const handle = schedule(() => {
      const next = simulations.map(_computeSimStats);
      // _computeSimStats retourne le même objet mis en cache pour les sims
      // inchangées → la comparaison d'identité détecte un résultat identique
      // et court-circuite setState pour éviter un re-render inutile.
      setAllSimStats(prev =>
        prev.length === next.length && prev.every((s, i) => s === next[i]) ? prev : next
      );
    });
    return () => cancel(handle);
  }, [simulations]);

  const handleCreateSimulation = (blank = simBlank) => {
    // Nom optionnel : à défaut, on génère un nom par défaut pour ne pas bloquer la création.
    const name = newSimName.trim()
      || (blank
        ? (t("simulation.blankSimulation") || "Simulation vierge")
        : (t("simulation.importEnvelopes") || "Simulation importée"));
    try {
      const sim = dataService.createSimulation(name, { blank });
      dataService.trackSimulationLaunched();
      toast.success(t("common.success"));
      setCreateDialog(false);
      setNewSimName("");
      setSimBlank(false);
      navigate(`/simulation/portfolios/${sim.id}`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  // Suppression d'une simulation (classique ou 8-4-3) après confirmation.
  // Reste sur la page : on rafraîchit simplement les listes.
  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === '843') {
        dataService.deleteRule843Sim(deleteTarget.id);
      } else {
        dataService.deleteSimulation(deleteTarget.id);
      }
      refresh();
      toast.success(L('Simulation supprimée', 'Simulation deleted'));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDeleteTarget(null);
    }
  };

  // Domaine Y unifié pour toutes les tuiles — memoïsé sur allSimStats pour
  // éviter le double reduce à chaque re-render (ex. frappe dans le dialog).
  const chartYMax = useMemo(() => {
    const globalYMax = allSimStats.reduce((max, s) => {
      const localMax = s.chartData.reduce(
        (m, d) => Math.max(m, d.value || 0, d.deposits || 0, d.proj || 0), 0
      );
      return Math.max(max, localMax);
    }, 0);
    return Math.max(1000, Math.ceil(globalYMax * 1.2 / 500) * 500);
  }, [allSimStats]);

  return (
    <div className="space-y-6" data-testid="simulation-list-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/simulation">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-tight">
              {t("simulation.portfolioSimulator") || "Simulateur d'enveloppes"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t("simulation.simulationListDesc") || "Créez et gérez vos scénarios d'investissement"}
            </p>
          </div>
        </div>
      </div>

      {/* Grid des simulations — 2 tuiles par rangée pour des courbes plus lisibles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Cartes des simulations existantes */}
        {simulations.map((sim, simIdx) => {
          // Pendant le premier tick asynchrone, allSimStats peut être vide :
          // on replie sur EMPTY_STATS pour afficher 0 plutôt que planter.
          const stats = allSimStats[simIdx] ?? EMPTY_STATS;
          return (
            <Link key={sim.id} to={`/simulation/portfolios/${sim.id}`} data-testid={`sim-card-${sim.id}`} className="group relative block">
              {/* Bouton de suppression — n'interfère pas avec la navigation du Link */}
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteTarget({ id: sim.id, type: 'sim', name: sim.name }); }}
                className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-background/80 backdrop-blur-sm border border-border text-muted-foreground hover:text-red-600 hover:border-red-400 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
                title={L('Supprimer', 'Delete')}
                aria-label={L('Supprimer la simulation', 'Delete simulation')}
                data-testid={`sim-delete-${sim.id}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <Card className={`border hover:shadow-md transition-all duration-200 cursor-pointer h-full ${stats.isFireOn ? 'border-2 border-amber-500 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20' : 'border-border hover:border-primary/50'}`}>
                <CardContent className="p-4">
                  {/* Nom de la simulation */}
                  <div className="flex items-center gap-2 mb-3">
                    {stats.isFireOn ? (
                      <Flame className="w-4 h-4 text-amber-500" />
                    ) : (
                      <Briefcase className="w-4 h-4 text-primary" />
                    )}
                    <h3 className="font-heading font-semibold text-sm truncate">{sim.name}</h3>
                    {stats.isFireOn && (
                      <span className="text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded font-medium">FIRE</span>
                    )}
                  </div>
                  
                  {/* Mini graphique avec axes — agrandi (2 tuiles/rangée → plus de largeur) */}
                  <div className="h-48 mb-3">
                    {stats.chartData.length > 1 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={stats.chartData} margin={{ top: 4, right: 6, bottom: 0, left: 0 }}>
                          <XAxis
                            dataKey="month"
                            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                            tickLine={false}
                            axisLine={{ stroke: 'hsl(var(--muted-foreground))', strokeOpacity: 0.4 }}
                            interval="preserveStartEnd"
                            height={18}
                          />
                          <YAxis
                            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                            tickLine={false}
                            axisLine={{ stroke: 'hsl(var(--muted-foreground))', strokeOpacity: 0.4 }}
                            tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                            domain={[0, chartYMax]}
                            tickCount={4}
                            width={30}
                          />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke={COLORS[0]}
                            strokeWidth={2}
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="deposits"
                            stroke={COLORS[1]}
                            strokeWidth={1.5}
                            dot={false}
                            strokeDasharray="3 3"
                          />
                          {stats.lastProjectionYears > 0 && (
                            <Line
                              type="monotone"
                              dataKey="proj"
                              stroke={PROJ_COLOR}
                              strokeWidth={1.5}
                              dot={false}
                              strokeDasharray="4 2"
                              connectNulls
                            />
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground/40">
                        <TrendingUp className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  
                  {/* Statistiques — À L'HORIZON de projection si défini (= page détaillée) */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">
                        {t("simulation.totalPortfolio") || "Total"}
                        {stats.projected && <span className="text-violet-600 dark:text-violet-400">&nbsp;{L(`à ${stats.lastProjectionYears} ans`, `in ${stats.lastProjectionYears} yrs`)}</span>}
                      </p>
                      <p className="font-mono font-semibold text-primary">{fmt(stats.totalValue)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t("simulation.totalGains") || "Gains"}</p>
                      <p className={`font-mono font-semibold ${stats.totalGains >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {stats.totalGains >= 0 ? '+' : ''}{fmt(stats.totalGains)}
                      </p>
                    </div>
                  </div>

                  {/* Indicateur d'horizon (les chiffres ci-dessus sont projetés à N ans) */}
                  {stats.lastProjectionYears > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/40 flex items-center gap-1 text-xs text-muted-foreground">
                      <TrendingUp className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                      {L(`Valeurs projetées à ${stats.lastProjectionYears} ans`, `Values projected ${stats.lastProjectionYears} yrs ahead`)}
                    </div>
                  )}

                  {/* Date de création */}
                  <p className="text-xs text-muted-foreground/60 mt-2">
                    {new Date(sim.created_at).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR')}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}

        {/* Tuiles « Règle 8-4-3 » — mini graphique empilé (versements bleus / intérêts verts) */}
        {rule843Charts.map(({ sim, data, todayK, title }) => (
          <Link key={sim.id} to={`/simulation/rule-843/${sim.id}`} data-testid={`rule843-card-${sim.id}`} className="group relative block">
            {/* Bouton de suppression — n'interfère pas avec la navigation du Link */}
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteTarget({ id: sim.id, type: '843', name: title }); }}
              className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-background/80 backdrop-blur-sm border border-border text-muted-foreground hover:text-red-600 hover:border-red-400 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
              title={L('Supprimer', 'Delete')}
              aria-label={L('Supprimer la simulation', 'Delete simulation')}
              data-testid={`rule843-delete-${sim.id}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <Card className="border border-border hover:border-primary/50 hover:shadow-md transition-all duration-200 cursor-pointer h-full">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <h3 className="font-heading font-semibold text-sm truncate">{title}</h3>
                  <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium shrink-0">8-4-3</span>
                </div>
                <div className="h-48">
                  {data.length > 1 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data} margin={{ top: 4, right: 6, bottom: 0, left: 0 }}>
                        <XAxis dataKey="ann" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} interval={2} tickLine={false} axisLine={{ stroke: 'hsl(var(--muted-foreground))', strokeOpacity: 0.4 }} height={16} />
                        <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={26} />
                        <Bar dataKey="dep" stackId="a" fill="#3B82F6" />
                        <Bar dataKey="int" stackId="a" fill="#10B981" radius={[2, 2, 0, 0]} />
                        {todayK != null && (
                          <ReferenceLine x={`An ${todayK}`} stroke="hsl(var(--foreground))" strokeDasharray="3 2"
                            label={{ value: "Auj.", position: 'top', fontSize: 8, fill: 'hsl(var(--muted-foreground))' }} />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground/40"><TrendingUp className="w-8 h-8" /></div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground/60 mt-2">{new Date(sim.created_at).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR')}</p>
              </CardContent>
            </Card>
          </Link>
        ))}

        {/* Carte pour ajouter une simulation */}
        <Card
          className="border-2 border-dashed border-border hover:border-primary/50 hover:bg-accent/30 transition-all duration-200 cursor-pointer h-full min-h-[180px]"
          onClick={() => { setSimBlank(false); setNewSimName(""); setCreateStep('choice'); setCreateDialog(true); }}
          data-testid="create-simulation-card"
        >
          <CardContent className="p-4 h-full flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Plus className="w-6 h-6 text-primary" />
            </div>
            <p className="font-medium text-sm">
              {t("simulation.createSimulation") || "Nouvelle simulation"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("simulation.createSimulationHint") || "Créer un nouveau scénario"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de création */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">
              {t("simulation.createSimulation") || "Nouvelle simulation"}
            </DialogTitle>
            <DialogDescription>
              {t("simulation.createSimulationDesc") || "Donnez un nom à votre simulation et choisissez son point de départ."}
            </DialogDescription>
          </DialogHeader>
          {createStep === 'choice' ? (
            /* ── Étape 1 : type de simulation ── */
            <div className="py-4 space-y-2">
              <button
                type="button"
                onClick={() => setCreateStep('classic')}
                className="w-full text-left rounded-lg border p-3 transition-colors border-border hover:bg-accent/30"
                data-testid="sim-option-classic"
              >
                <p className="text-sm font-medium">{L('Simulation classique', 'Classic simulation')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{L("Importez vos enveloppes actuelles ou partez d'une simulation vierge.", 'Import your current envelopes or start from a blank simulation.')}</p>
              </button>
              {/* Simulation pédagogique « Règle 8-4-3 » (page dédiée, lecture seule) */}
              <button
                type="button"
                onClick={() => { setCreateDialog(false); navigate('/simulation/rule-843'); }}
                className="w-full text-left rounded-lg border p-3 transition-colors border-border hover:bg-accent/30"
                data-testid="sim-option-rule843"
              >
                <p className="text-sm font-medium">{L('Règle 8-4-3', '8-4-3 rule')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{L("Visualisez la puissance des intérêts composés sur 15 ans et découvrez quand votre épargne s'emballe vraiment.", 'Visualise the power of compound interest over 15 years and discover when your savings really take off.')}</p>
              </button>
            </div>
          ) : (
            /* ── Étape 2 : options des simulations classiques ── */
            <>
              <button
                type="button"
                onClick={() => setCreateStep('choice')}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors -mt-1"
                data-testid="sim-back-to-choice"
              >
                <ArrowLeft className="w-4 h-4" /> {L('Retour', 'Back')}
              </button>
              <div className="py-3 space-y-4">
                <div>
                  <Label>{t("simulation.simulationName") || "Nom de la simulation"} <span className="text-muted-foreground font-normal">{L('(optionnel)', '(optional)')}</span></Label>
                  <Input
                    value={newSimName}
                    onChange={(e) => setNewSimName(e.target.value)}
                    placeholder={t("simulation.simulationNamePlaceholder") || "Ex: Scénario optimiste 2030"}
                    data-testid="sim-name-input"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateSimulation(simBlank)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("simulation.startingEnvelopes") || "Enveloppes de départ"}</Label>
                  <button
                    type="button"
                    onClick={() => handleCreateSimulation(false)}
                    className="w-full text-left rounded-lg border p-3 transition-colors border-border hover:bg-accent/30"
                    data-testid="sim-option-import"
                  >
                    <p className="text-sm font-medium">{t("simulation.importEnvelopes") || "Importer mes enveloppes actuelles"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("simulation.importEnvelopesDesc") || "Pré-remplit la simulation avec toutes vos enveloppes du tableau de bord."}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCreateSimulation(true)}
                    className="w-full text-left rounded-lg border p-3 transition-colors border-border hover:bg-accent/30"
                    data-testid="sim-option-blank"
                  >
                    <p className="text-sm font-medium">{t("simulation.blankSimulation") || "Partir d'une simulation vierge"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("simulation.blankSimulationDesc") || "Crée une simulation vide ; vous ajoutez les enveloppes manuellement."}</p>
                  </button>
                </div>
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setCreateDialog(false)}>
                  {t("common.cancel")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation de suppression d'une simulation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {L('Supprimer cette simulation ?', 'Delete this simulation?')}
            </DialogTitle>
            <DialogDescription>
              {L('Cette action est irréversible.', 'This action cannot be undone.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              {L('Annuler', 'Cancel')}
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleConfirmDelete}
              data-testid="sim-delete-confirm"
            >
              {L('Supprimer', 'Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Disclaimer simulation />
    </div>
  );
}

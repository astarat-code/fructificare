// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * Rule843.js — the educational "8-4-3 rule" simulation (read-only).
 *
 * The configuration is persisted (dataService.rule843_sims) so that it appears as a tile in
 * the simulation list; the projection is recomputed on display.
 * Modifies NO dashboard data.
 */

import { useState, useMemo, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import dataService from "../services/dataService";
import gamificationService from "../services/gamificationService";
import { useLanguage } from "../context/LanguageContext";
import Disclaimer from "../components/ui/Disclaimer";
import GlossaryTerm from "../components/ui/GlossaryTerm";
import { computeBlend, buildYears, buildMonths } from "../lib/rule843";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer,
} from "recharts";
import { ArrowLeft, Rocket, Snowflake, TrendingUp, Pencil } from "lucide-react";

const DEPOSIT_COLOR  = "#3B82F6";
const INTEREST_COLOR = "#10B981";
const DAY_MS = 86400000;

const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_ABBR_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
const MONTHS_ABBR_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function Rule843() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const isEn = lang === 'en';
  const L = (fr, en) => (isEn ? en : fr);
  const months = isEn ? MONTHS_EN : MONTHS_FR;
  const monthsAbbr = isEn ? MONTHS_ABBR_EN : MONTHS_ABBR_FR;
  const fmt = (v) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);
  const fmtPct = (v) => v == null ? '—' : `${v > 0 ? '+' : ''}${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v)} %`;

  const envelopes = useMemo(() => dataService.getPortfolios().filter(p => p.type !== 'compte_réglementé'), []);
  const existing = useMemo(() => (id ? dataService.getRule843Sim(id) : null), [id]);

  // ── État initial : depuis la simulation chargée, sinon valeurs par défaut ──
  const init = useMemo(() => {
    if (existing) {
      const ids = (existing.envelopeIds || []).filter(x => envelopes.some(e => e.id === x));
      return {
        selectedIds: ids.length ? ids : envelopes.map(e => e.id),
        startYear: existing.startYear, startMonth: existing.startMonth,
        monthlyDeposit: existing.monthlyDeposit, annualYield: existing.annualYield,
        startCapital: existing.startCapital ?? '',
        name: existing.name || '',
      };
    }
    const allIds = envelopes.map(e => e.id);
    const b = computeBlend(allIds);
    const sd = b.minDate ? b.minDate.slice(0, 7).split('-').map(Number) : [new Date().getFullYear(), 1];
    return {
      selectedIds: allIds, startYear: sd[0], startMonth: sd[1],
      monthlyDeposit: b.monthlyDeposit || 300, annualYield: b.blendedYield || 7, startCapital: '', name: '',
    };
  }, [existing, envelopes]);

  const [selectedIds, setSelectedIds]     = useState(init.selectedIds);
  const [startYear, setStartYear]         = useState(init.startYear);
  const [startMonth, setStartMonth]       = useState(init.startMonth);
  const [monthlyDeposit, setMonthlyDeposit] = useState(init.monthlyDeposit);
  const [annualYield, setAnnualYield]     = useState(init.annualYield);
  const [startCapital, setStartCapital]   = useState(init.startCapital);
  const [name, setName]                   = useState(init.name);
  const [simId, setSimId]                 = useState(existing ? existing.id : null);
  const [launched, setLaunched]           = useState(!!existing);
  const [configOpen, setConfigOpen]       = useState(!existing);

  // Re-synchronise l'état si l'on navigue directement vers une AUTRE simulation 843
  // sauvegardée (l'instance du composant peut persister lors d'un changement de :id).
  useEffect(() => {
    if (!id || id === simId) return;
    const ex = dataService.getRule843Sim(id);
    if (!ex) return;
    const ids = (ex.envelopeIds || []).filter(x => envelopes.some(e => e.id === x));
    setSelectedIds(ids.length ? ids : envelopes.map(e => e.id));
    setStartYear(ex.startYear); setStartMonth(ex.startMonth);
    setMonthlyDeposit(ex.monthlyDeposit); setAnnualYield(ex.annualYield);
    setStartCapital(ex.startCapital ?? '');
    setName(ex.name || ''); setSimId(ex.id); setLaunched(true); setConfigOpen(false);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-pré-remplir versement + rendement quand la sélection change (config ouverte, non chargée)
  useEffect(() => {
    if (existing || selectedIds.length === 0) return;
    const b = computeBlend(selectedIds);
    setMonthlyDeposit(b.monthlyDeposit || 0);
    setAnnualYield(b.blendedYield || 0);
  }, [selectedIds, existing]);

  // Capital de départ « automatique » = TOTAL VERSÉ (versements − retraits) à la date An 0,
  // additionné sur toutes les enveloppes sélectionnées, importé du portefeuille.
  const autoStartCapital = useMemo(() => {
    const date = `${startYear}-${String(startMonth).padStart(2, '0')}-01`;
    let sum = 0;
    selectedIds.forEach(pid => {
      dataService.getTransactions(pid).forEach(tx => {
        if ((tx.type === 'deposit' || tx.type === 'withdrawal') && tx.date <= date) {
          sum += (tx.type === 'deposit' ? 1 : -1) * (tx.net_amount ?? tx.amount ?? 0);
        }
      });
    });
    return Math.max(0, Math.round(sum));
  }, [selectedIds, startYear, startMonth]);

  // Le capital de départ suit AUTOMATIQUEMENT le total versé à l'An 0 : il se met à jour
  // dès que l'on change la date An 0 ou la sélection d'enveloppes. Une saisie manuelle
  // reste conservée tant que ces paramètres ne changent pas (autoStartCapital inchangé).
  useEffect(() => {
    if (existing) return;
    setStartCapital(autoStartCapital);
  }, [autoStartCapital, existing]);

  const rows = useMemo(
    () => buildYears({ selectedIds, startYear, startMonth, monthlyDeposit, annualYield, startCapital }),
    [selectedIds, startYear, startMonth, monthlyDeposit, annualYield, startCapital],
  );
  const calMonths = useMemo(
    () => buildMonths({ rows, startYear, startMonth, annualYield }),
    [rows, startYear, startMonth, annualYield],
  );

  const birthDate = gamificationService.getState()?.profile?.birthDate || null;
  const ageAt = (date) => birthDate ? Math.floor((new Date(date) - new Date(birthDate)) / (365.25 * DAY_MS)) : null;

  const toggleEnv = (idv) => setSelectedIds(prev => prev.includes(idv) ? prev.filter(x => x !== idv) : [...prev, idv]);

  const displayName = name || `${L('Règle 8-4-3', '8-4-3 Rule')} — ${months[startMonth - 1]} ${startYear}`;

  // Persistance à « Lancer » : crée/met à jour la simulation et replie la config.
  const handleLaunch = () => {
    const saved = dataService.saveRule843Sim({ id: simId, name, envelopeIds: selectedIds, startYear, startMonth, monthlyDeposit, annualYield, startCapital });
    setSimId(saved.id);
    setLaunched(true);
    setConfigOpen(false);
    if (!id || id !== saved.id) navigate(`/simulation/rule-843/${saved.id}`, { replace: true });
  };

  const chartData = rows.map(r => ({
    ann: `An ${r.k}`,
    dep: Math.min(r.cumDep, Math.max(0, r.value)),
    int: Math.max(0, r.value - r.cumDep),
  }));
  const yMax = Math.max(1000, ...rows.map(r => Math.max(r.value, r.cumDep)));

  const startMs = new Date(`${startYear}-${String(startMonth).padStart(2, '0')}-01`).getTime();
  const yearsToToday = (Date.now() - startMs) / (365.25 * DAY_MS);
  const todayK = yearsToToday >= 0 && yearsToToday <= 15 ? Math.floor(yearsToToday) : null;

  const phase = (k) => rows[k] || { cumDep: 0, value: 0, interest: 0 };
  const p8 = phase(8), p12 = phase(12), p15 = phase(15);

  const PhaseCard = ({ icon, badge, subtitle, ageDate, deposited, depositedLabel, interest, interestLabel, total }) => (
    <Card className="border border-border shadow-sm flex-1">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">{icon}</span>
          <div><p className="text-lg font-heading font-bold leading-none">{badge}</p><p className="text-[11px] text-muted-foreground">{subtitle}</p></div>
        </div>
        {ageAt(ageDate) != null && (
          <p className="text-xs text-muted-foreground mt-2">{L('Vous aurez', 'You will be')} <span className="font-semibold text-foreground">{ageAt(ageDate)} {L('ans', 'years old')}</span></p>
        )}
        <div className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">{depositedLabel}</span><span className="font-mono tabular-nums text-blue-600">{fmt(deposited)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{interestLabel}</span><span className="font-mono tabular-nums text-emerald-600">{fmt(interest)}</span></div>
        </div>
        <div className="mt-3 pt-2 border-t border-border">
          <p className="text-[11px] text-muted-foreground">{L('Total portefeuille', 'Total portfolio')}</p>
          <p className="text-2xl font-heading font-extrabold tabular-nums text-primary">{fmt(total)}</p>
        </div>
      </CardContent>
    </Card>
  );

  const gainPct15 = p15.cumDep > 0 ? (p15.interest / p15.cumDep) * 100 : null;

  return (
    <div className="space-y-6" data-testid="rule-843-page">
      <div className="flex items-center gap-3">
        <Link to="/simulation/portfolios"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-tight">{L('Règle 8-4-3', '8-4-3 Rule')}</h1>
          <p className="text-muted-foreground text-sm">{L('La puissance des intérêts composés sur 15 ans', 'The power of compound interest over 15 years')}</p>
        </div>
      </div>

      {/* ── Configuration (repliable après le 1er lancement) ── */}
      <Card className="border border-border shadow-sm">
        {configOpen ? (
          <>
            <CardHeader><CardTitle className="font-heading text-lg">{L('Configuration', 'Configuration')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-1.5 block">{L('Nom (optionnel)', 'Name (optional)')}</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder={displayName} data-testid="rule843-name-input" />
              </div>
              <div>
                <Label className="mb-1.5 block">{L('Enveloppes à inclure', 'Envelopes to include')}</Label>
                {envelopes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{L('Aucune enveloppe disponible.', 'No envelope available.')}</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {envelopes.map(e => (
                      <label key={e.id} className="flex items-center gap-2 rounded-lg border border-border p-2 cursor-pointer hover:bg-accent/30">
                        <Checkbox checked={selectedIds.includes(e.id)} onCheckedChange={() => toggleEnv(e.id)} />
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: e.color || '#9CA3AF' }} />
                        <span className="text-sm truncate">{e.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label className="mb-1.5 block">{L('Date de départ (An 0)', 'Start date (Year 0)')}</Label>
                  <div className="flex gap-2">
                    <Select value={String(startMonth)} onValueChange={v => setStartMonth(parseInt(v))}>
                      <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{months.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input type="number" className="w-24" value={startYear} min="1990" max="2100" onChange={e => setStartYear(parseInt(e.target.value) || startYear)} />
                  </div>
                </div>
                <div>
                  <Label className="mb-1.5 block">{L('Capital de départ (€)', 'Starting capital (€)')}</Label>
                  <Input type="number" min="0" step="100" value={startCapital} onChange={e => setStartCapital(e.target.value)} data-testid="rule843-startcapital-input" />
                  <p className="text-[11px] text-muted-foreground mt-1">{L('Pré-rempli avec les versements du portefeuille importé à l’An 0. Modifiable.', 'Pre-filled with the imported portfolio deposits at Year 0. Editable.')}</p>
                </div>
                <div>
                  <Label className="mb-1.5 block">{L('Versement mensuel (€)', 'Monthly deposit (€)')}</Label>
                  <Input type="number" min="0" step="10" value={monthlyDeposit} onChange={e => setMonthlyDeposit(e.target.value)} data-testid="rule843-monthly-input" />
                </div>
                <div>
                  <Label className="mb-1.5 block"><GlossaryTerm id="rendement_annuel">{L('Rendement annuel (%)', 'Annual yield (%)')}</GlossaryTerm></Label>
                  <Input type="number" step="0.1" value={annualYield} onChange={e => setAnnualYield(e.target.value)} data-testid="rule843-yield-input" />
                </div>
              </div>
              <Button onClick={handleLaunch} className="bg-primary hover:bg-primary/90" data-testid="rule843-launch-btn">
                <TrendingUp className="w-4 h-4 mr-2" /> {L('Lancer la simulation', 'Run simulation')}
              </Button>
            </CardContent>
          </>
        ) : (
          // Résumé compact (config repliée)
          <CardContent className="p-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-medium">{displayName}</span>
            <span className="text-muted-foreground">{selectedIds.length} {L('enveloppe', 'envelope')}{selectedIds.length > 1 ? 's' : ''}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{L('Départ', 'Start')} {months[startMonth - 1]} {startYear}</span>
            {parseFloat(startCapital) > 0 && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{L('Capital', 'Capital')} {fmt(parseFloat(startCapital))}</span>
              </>
            )}
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{fmt(monthlyDeposit)}/{L('mois', 'mo')}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{fmtPct(parseFloat(annualYield))}/{L('an', 'yr')}</span>
            <Button variant="outline" size="sm" className="ml-auto h-7 text-xs gap-1.5" onClick={() => setConfigOpen(true)} data-testid="rule843-edit-config">
              <Pencil className="w-3 h-3" /> {L('Modifier', 'Edit')}
            </Button>
          </CardContent>
        )}
      </Card>

      {launched && (
        <>
          {/* ── Cartes de phase ── */}
          <div className="flex flex-col md:flex-row gap-4">
            <PhaseCard icon={<TrendingUp className="w-4 h-4" />} badge={L('8 ans', '8 years')}
              subtitle={L('Phase 1 — la traversée du désert', 'Phase 1 — the desert crossing')} ageDate={p8.date}
              deposited={p8.cumDep} depositedLabel={L('Total versé', 'Total deposited')}
              interest={p8.interest} interestLabel={L('Intérêts générés', 'Interest generated')} total={p8.value} />
            <PhaseCard icon={<Rocket className="w-4 h-4" />} badge={L('+ 4 ans', '+ 4 years')}
              subtitle={L('Phase 2 — le décollage', 'Phase 2 — the take-off')} ageDate={p12.date}
              deposited={p12.cumDep - p8.cumDep} depositedLabel={L('Versé en plus (An 9–12)', 'Extra deposited (Y9–12)')}
              interest={p12.interest - p8.interest} interestLabel={L('Intérêts en plus (An 9–12)', 'Extra interest (Y9–12)')} total={p12.value} />
            <PhaseCard icon={<Snowflake className="w-4 h-4" />} badge={L('+ 3 ans', '+ 3 years')}
              subtitle={L("Phase 3 — l'effet boule de neige", 'Phase 3 — the snowball effect')} ageDate={p15.date}
              deposited={p15.cumDep - p12.cumDep} depositedLabel={L('Versé en plus (An 13–15)', 'Extra deposited (Y13–15)')}
              interest={p15.interest - p12.interest} interestLabel={L('Intérêts en plus (An 13–15)', 'Extra interest (Y13–15)')} total={p15.value} />
          </div>

          {/* ── Texte explicatif ── */}
          <div className="rounded-xl border border-border bg-accent/30 p-4 text-sm text-muted-foreground">
            {L(
              "La règle 8-4-3 illustre l'accélération des intérêts composés. En 8 ans vous constituez votre capital de base, en 4 ans supplémentaires vos intérêts doublent, et durant les 3 dernières années les intérêts s'envolent. La vraie magie des intérêts composés commence après l'an 12 — tenez bon !",
              "The 8-4-3 rule illustrates how compound interest accelerates. In 8 years you build your base capital, in 4 more years your interest doubles, and over the last 3 years the interest takes off. The real magic of compounding begins after year 12 — hold on!",
            )}
          </div>

          {/* ── Graphique à barres empilées ── */}
          <Card className="border border-border shadow-sm">
            <CardHeader><CardTitle className="font-heading text-lg">{L('Évolution du portefeuille', 'Portfolio growth')}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={380}>
                <BarChart data={chartData} margin={{ top: 30, right: 12, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="ann" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))"
                    domain={[0, Math.ceil(yMax * 1.1 / 1000) * 1000]}
                    tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k€` : `${v}€`} width={48} />
                  <Tooltip
                    formatter={(v, n) => [fmt(v), n]}
                    labelStyle={{ fontWeight: 700 }}
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend />
                  <Bar dataKey="dep" stackId="a" fill={DEPOSIT_COLOR} name={L('Versements', 'Deposits')} />
                  <Bar dataKey="int" stackId="a" fill={INTEREST_COLOR} name={L('Intérêts générés', 'Interest generated')} radius={[3, 3, 0, 0]} />
                  {todayK != null && (
                    <ReferenceLine x={`An ${todayK}`} stroke="hsl(var(--foreground))" strokeDasharray="4 3"
                      label={{ value: L("Aujourd'hui", 'Today'), position: 'top', fontSize: 11, fontWeight: 600, fill: 'hsl(var(--foreground))' }} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* ── Tuiles de synthèse ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border border-border shadow-sm"><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{L('Apporté pendant 15 ans', 'Deposited over 15 years')}</p>
              <p className="text-2xl font-heading font-bold tabular-nums text-blue-600 mt-1">{fmt(p15.cumDep)}</p>
            </CardContent></Card>
            <Card className="border border-border shadow-sm"><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{L('Total intérêts générés', 'Total interest generated')}</p>
              <p className="text-2xl font-heading font-bold tabular-nums text-emerald-600 mt-1">{fmt(p15.interest)}</p>
              {gainPct15 != null && (
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">{fmtPct(gainPct15)}</p>
              )}
            </CardContent></Card>
            <Card className="border-2 border-primary shadow-md bg-primary/5"><CardContent className="p-4">
              <p className="text-xs font-semibold text-primary">{L('Capital final', 'Final capital')}</p>
              <p className="text-2xl font-heading font-extrabold tabular-nums text-primary mt-1">{fmt(p15.value)}</p>
            </CardContent></Card>
          </div>

          {/* ── Calendrier de progression mensuel (180 mois, pleine largeur) ── */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-lg">{L('Progression mois par mois', 'Month-by-month progress')}</CardTitle>
              <p className="text-xs text-muted-foreground">{L('Vert = passé (gain du mois), ambre = mois en cours. Chaque case = un mois.', 'Green = past (monthly gain), amber = current month. Each cell = one month.')}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {Array.from({ length: 15 }).map((_, yr) => (
                  <div key={yr} className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-[10px] text-muted-foreground text-right leading-tight">{L('An', 'Yr')} {yr}<br />{startYear + Math.floor((startMonth - 1 + yr * 12) / 12)}</span>
                    <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}>
                      {calMonths.slice(yr * 12, yr * 12 + 12).map(mo => (
                        <div
                          key={mo.m}
                          title={`${monthsAbbr[mo.monthIdx]} ${mo.year} — ${fmt(mo.value)}${mo.isPast ? ` · +${fmt(mo.monthGain)} ${L('ce mois', 'this month')}` : ''}`}
                          className={[
                            'h-11 rounded flex flex-col items-center justify-center leading-none border overflow-hidden',
                            mo.isCurrent ? 'bg-amber-400/80 border-amber-500 text-amber-950 font-bold'
                              : mo.isPast ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300/50 text-emerald-700 dark:text-emerald-300'
                              : 'bg-muted/40 border-border text-muted-foreground/50',
                          ].join(' ')}
                        >
                          <span className="text-[10px]">{monthsAbbr[mo.monthIdx]}</span>
                          {mo.isPast && mo.monthGain > 0 && <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">+{fmt(mo.monthGain)}</span>}
                          {mo.isCurrent && <span className="text-[11px] mt-0.5">●</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── Tableau année par année ── */}
          <Card className="border border-border shadow-sm">
            <CardHeader><CardTitle className="font-heading text-lg">{L('Détail année par année', 'Year-by-year detail')}</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>{L('Année', 'Year')}</TableHead>
                    <TableHead className="text-right">{L('Versements cumulés', 'Cumulative deposits')}</TableHead>
                    <TableHead className="text-right">{L("Intérêts de l'année", 'Interest for the year')}</TableHead>
                    <TableHead className="text-right">{L('Total portefeuille', 'Total portfolio')}</TableHead>
                    <TableHead className="text-right">{L('Gains cumulés (%)', 'Cumulative gains (%)')}</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {rows.map(r => (
                      <TableRow key={r.k} className={[
                        r.k >= 13 ? 'bg-emerald-50 dark:bg-emerald-950/20' : '',
                        !r.isPast ? 'italic text-muted-foreground' : '',
                      ].join(' ')}>
                        <TableCell className="font-medium">An {r.k}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums">{fmt(r.cumDep)}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-emerald-600">{fmt(r.intYear)}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums font-semibold">{fmt(r.value)}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-emerald-600">{fmtPct(r.cumGainPct)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {L('Les années en italique sont projetées ; les autres reposent sur vos données réelles (valeurs calibrées ou versements).',
                   'Italic years are projected; the others are based on your real data (calibrated values or deposits).')}
              </p>
            </CardContent>
          </Card>
        </>
      )}

      <Disclaimer simulation />
    </div>
  );
}

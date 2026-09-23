// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * CalibrationModal.jsx — reusable calibration dialog.
 *
 * Used by the dashboard ("Calibrate my envelopes") AND by the envelope page. Tabs "New
 * entry" / "History", one section per envelope (value, date, individual Calibrate button,
 * per-holding detail).
 *
 * Prop `focusedEnvelopeId`: when supplied, only that envelope is interactive; every other
 * one is greyed out (reduced opacity, disabled inputs, no "Calibrate" button). Otherwise,
 * the full multi-envelope behavior of the dashboard.
 *
 * Reads and writes directly through dataService (dashboard data). After each save or
 * deletion, `onSaved()` is called so the parent can refresh its charts.
 */

import { useState, useEffect, useMemo } from "react";
import dataService from "../services/dataService";
import { useLanguage } from "../context/LanguageContext";
import { envTintBg, envTextColor } from "../lib/utils";
import GlossaryTerm from "./ui/GlossaryTerm";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Badge } from "./ui/badge";
import { Target, AlertTriangle, CheckCircle2, ChevronUp, ChevronDown, Edit2, Trash2 } from "lucide-react";

export default function CalibrationModal({ open, onClose, onSaved, focusedEnvelopeId = null }) {
  const { t, lang } = useLanguage();
  const isEn = lang === "en";
  const L = (fr, en) => (isEn ? en : fr);
  const fmt = (v) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v || 0);
  const locale = isEn ? "en-US" : "fr-FR";
  const focused = focusedEnvelopeId != null;

  // Une calibration constate une valeur passée : aucune date future n'est acceptée.
  const todayStr = new Date().toISOString().split("T")[0];
  /** Refuse une date postérieure à aujourd'hui. Retourne true si la date est valide. */
  const assertNotFuture = (d) => {
    if (d && d > todayStr) {
      toast.error(L(
        "Une calibration ne peut pas être datée dans le futur.",
        "A calibration cannot be dated in the future.",
      ));
      return false;
    }
    return true;
  };

  const [tick, setTick] = useState(0);
  const notifySaved = () => { setTick(x => x + 1); if (onSaved) onSaved(); };

  const [calibrationDate, setCalibrationDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [calibrationValues, setCalibrationValues] = useState({});
  const [calibrationExpanded, setCalibrationExpanded] = useState({});
  const [calibrationSelected, setCalibrationSelected] = useState({});
  const [calModalTab, setCalModalTab] = useState("saisie");
  const [editingCalibrationId, setEditingCalibrationId] = useState(null);
  const [calDeleteConfirm, setCalDeleteConfirm] = useState(null);
  const [calibrationDateOverrides, setCalibrationDateOverrides] = useState({});
  const [calibrationConfirmed, setCalibrationConfirmed] = useState({});

  // Données lues à frais (tick invalide le cache après écriture)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const portfolios = useMemo(() => dataService.getPortfolios(), [open, tick]);
  const assetTypesByPid = useMemo(() => {
    const m = {}; portfolios.forEach(p => { m[p.id] = dataService.getPortfolioAssetTypes(p.id); }); return m;
  }, [portfolios]);
  const tplPositionsByPid = useMemo(() => {
    const m = {}; portfolios.forEach(p => { m[p.id] = dataService.getPortfolioTemplatePositions(p.id); }); return m;
  }, [portfolios]);

  // Réinitialisation à l'ouverture
  useEffect(() => {
    if (!open) return;
    setCalibrationDate(new Date().toISOString().split("T")[0]);
    setEditingCalibrationId(null);
    setCalModalTab("saisie");
    setCalDeleteConfirm(null);
    setCalibrationDateOverrides({});
    setCalibrationConfirmed({});
    setCalibrationValues({});
    setCalibrationExpanded({});
    setCalibrationSelected(focused ? { [focusedEnvelopeId]: true } : {});
  }, [open, focused, focusedEnvelopeId]);

  // ── Handlers ────────────────────────────────────────────────────────────────
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
    setCalibrationValues(prev => ({ ...prev, [cal.portfolio_id]: { totalValue: String(cal.total_value), assetValues } }));
    if (cal.asset_breakdown && cal.asset_breakdown.length > 0) {
      setCalibrationExpanded(prev => ({ ...prev, [cal.portfolio_id]: true }));
    }
    setCalModalTab("saisie");
  };

  const setPortfolioCalibValue = (portfolioId, key, value) => {
    setCalibrationValues(prev => ({ ...prev, [portfolioId]: { ...prev[portfolioId], [key]: value } }));
    // Re-saisir la valeur d'une enveloppe efface son message « Calibration enregistrée »
    // (la confirmation réapparaît après un nouvel enregistrement).
    setCalibrationConfirmed(prev => (prev[portfolioId] ? { ...prev, [portfolioId]: false } : prev));
  };

  const setAssetCalibValue = (portfolioId, key, value) =>
    setCalibrationValues(prev => ({
      ...prev,
      [portfolioId]: { ...prev[portfolioId], assetValues: { ...(prev[portfolioId]?.assetValues || {}), [key]: value } },
    }));

  const toggleCalibExpanded = (portfolioId) =>
    setCalibrationExpanded(prev => ({ ...prev, [portfolioId]: !prev[portfolioId] }));

  const assetBreakdownSum = (portfolioId) => {
    const av = calibrationValues[portfolioId]?.assetValues || {};
    return Object.values(av).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  };

  const buildAssetBreakdown = (pId) => {
    if (!calibrationExpanded[pId]) return null;
    const av = calibrationValues[pId]?.assetValues || {};
    const tplPositions = tplPositionsByPid[pId] || [];
    if (tplPositions.length > 0) {
      const items = tplPositions
        .map(pos => ({ template_id: pos.template_id, asset_type: pos.asset_type || "autre", name: pos.name, value: parseFloat(av[pos.template_id]) || 0 }))
        .filter(item => item.value > 0);
      return items.length > 0 ? items : null;
    }
    const types = assetTypesByPid[pId] || [];
    const items = types.map(at => ({ asset_type: at, value: parseFloat(av[at]) || 0 })).filter(item => item.value > 0);
    return items.length > 0 ? items : null;
  };

  const saveCalibrationEdit = () => {
    if (!editingCalibrationId) return;
    const existingCal = dataService.getCalibrations().find(c => c.id === editingCalibrationId);
    if (existingCal) {
      const pId = existingCal.portfolio_id;
      const entry = calibrationValues[pId];
      const totalValue = parseFloat(entry?.totalValue);
      if (!assertNotFuture(calibrationDate)) return;
      if (!isNaN(totalValue) && totalValue >= 0) {
        dataService.deleteCalibration(editingCalibrationId);
        dataService.addCalibration({ portfolio_id: pId, date: calibrationDate, total_value: totalValue, asset_breakdown: buildAssetBreakdown(pId) });
        toast.success(L("Calibration mise à jour ✓", "Calibration updated ✓"));
        notifySaved();
      } else {
        toast.error(L("Valeur invalide.", "Invalid value."));
      }
    }
    setEditingCalibrationId(null);
    setCalModalTab("historique");
  };

  const saveCalibrationForPortfolio = (portfolioId) => {
    const entry = calibrationValues[portfolioId];
    if (!entry) return;
    const totalValue = parseFloat(entry.totalValue);
    if (isNaN(totalValue) || totalValue < 0) { toast.error(L("Valeur invalide.", "Invalid value.")); return; }
    const effectiveDate = calibrationDateOverrides[portfolioId] || calibrationDate;
    if (!assertNotFuture(effectiveDate)) return;
    dataService.addCalibration({ portfolio_id: portfolioId, date: effectiveDate, total_value: totalValue, asset_breakdown: buildAssetBreakdown(portfolioId) });
    notifySaved();
    // Le message « Calibration enregistrée » reste visible jusqu'à la fermeture de la
    // modale (reset à l'ouverture) ou une nouvelle saisie de cette enveloppe — pas de
    // disparition automatique après un délai.
    setCalibrationConfirmed(prev => ({ ...prev, [portfolioId]: true }));
  };

  const historyCount = dataService.getCalibrations().length;

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) { setEditingCalibrationId(null); setCalDeleteConfirm(null); if (onClose) onClose(); } }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="calibration-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Target className="w-5 h-5 text-amber-500" />
            <GlossaryTerm id="calibration">{L("Calibrer mes enveloppes", "Calibrate my envelopes")}</GlossaryTerm>
          </DialogTitle>
          <DialogDescription>
            {focused
              ? L("Enregistrez la valeur réelle de cette enveloppe. Les autres sont grisées.", "Record the real value of this envelope. The others are greyed out.")
              : L("Enregistrez la valeur réelle de vos enveloppes ou consultez l'historique des calibrations passées.", "Record the real value of your envelopes or view your past calibration history.")}
          </DialogDescription>
          {/* Consigne explicite : le rapport fiscal ajoute lui-même les espèces à la
              valeur saisie. Les compter deux fois gonflerait la plus-value estimée. */}
          <p className="text-xs text-muted-foreground">
            {L(
              "Saisissez la valeur de vos positions (titres, cryptos, fonds), hors espèces : les espèces issues de vos ventes non réinvesties sont déjà suivies par Fructificare et s'ajoutent à cette valeur.",
              "Enter the value of your holdings (stocks, crypto, funds), excluding cash: cash from sales you have not reinvested is already tracked by Fructificare and is added to this value.",
            )}
          </p>
        </DialogHeader>

        <Tabs value={calModalTab} onValueChange={setCalModalTab}>
          <TabsList className="w-full">
            <TabsTrigger value="saisie" className="flex-1">
              {editingCalibrationId ? L("✏️ Modifier la calibration", "✏️ Edit calibration") : L("Nouvelle saisie", "New entry")}
            </TabsTrigger>
            <TabsTrigger value="historique" className="flex-1">
              {L("Historique", "History")} ({historyCount})
            </TabsTrigger>
          </TabsList>

          {/* ── Onglet 1 : saisie ── */}
          <TabsContent value="saisie" className="space-y-3 mt-3">
            {editingCalibrationId && (() => {
              const editedCal = dataService.getCalibrations().find(c => c.id === editingCalibrationId);
              const editedPortfolio = portfolios.find(p => p.id === editedCal?.portfolio_id);
              return editedCal ? (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300/50 text-xs text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {L("Modification de la calibration du", "Editing the calibration of")} {new Date(editedCal.date).toLocaleDateString(locale)} {L("pour", "for")} <strong>{editedPortfolio?.name}</strong>. {L("Seule cette enveloppe sera mise à jour.", "Only this envelope will be updated.")}
                </div>
              ) : null;
            })()}

            <div className="flex items-center gap-3 pb-2 border-b">
              <div className="flex-1">
                <Label className="whitespace-nowrap font-medium">{L("Date par défaut", "Default date")}</Label>
                <p className="text-xs text-muted-foreground">{L("Utilisée pour toutes les enveloppes (modifiable individuellement)", "Used for all envelopes (editable individually)")}</p>
              </div>
              <Input type="date" max={todayStr} value={calibrationDate} onChange={e => setCalibrationDate(e.target.value)} className="w-40 shrink-0" data-testid="calibration-date-input" />
            </div>

            <div className="space-y-3">
              {portfolios.map(p => {
                const entry        = calibrationValues[p.id] || { totalValue: "", assetValues: {} };
                const expanded     = !!calibrationExpanded[p.id];
                const assetTypes   = assetTypesByPid[p.id] || [];
                const tplPositions = tplPositionsByPid[p.id] || [];
                const hasAssets    = assetTypes.length > 0;
                const sum          = assetBreakdownSum(p.id);
                const total        = parseFloat(entry.totalValue) || 0;
                const sumOk        = !expanded || Math.abs(sum - total) < 0.01;
                const lastCal      = dataService.getCalibrations(p.id).slice(-1)[0];
                const realYield    = dataService.computeRealYield(p.id);

                const isEditTarget = !editingCalibrationId || dataService.getCalibrations().find(c => c.id === editingCalibrationId)?.portfolio_id === p.id;
                const isFocusTarget = !focused || p.id === focusedEnvelopeId;
                const interactive  = isEditTarget && isFocusTarget;
                // Focalisé (depuis une enveloppe) : griser les autres. En édition : griser hors cible.
                // Depuis le tableau de bord : aucune enveloppe grisée, toutes remplissables.
                const rowDimClass  = focused
                  ? (p.id === focusedEnvelopeId ? "" : "opacity-40 pointer-events-none")
                  : (editingCalibrationId && !isEditTarget ? "opacity-40 pointer-events-none" : "");
                const showCheckbox = false;
                const showPerRow   = !editingCalibrationId && isFocusTarget;

                return (
                  <div key={p.id} className={`rounded-lg border p-3 space-y-2 bg-card transition-opacity ${rowDimClass}`} data-testid={`calibration-row-${p.id}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      {showCheckbox && (
                        <Checkbox
                          checked={!!calibrationSelected[p.id]}
                          onCheckedChange={checked => setCalibrationSelected(prev => ({ ...prev, [p.id]: !!checked }))}
                          className="shrink-0"
                          aria-label={`${L("Inclure", "Include")} ${p.name}`}
                        />
                      )}
                      <span className="font-medium text-sm flex-1 min-w-0 truncate">{p.name}</span>
                      <Badge variant="outline" className="shrink-0">{t(`types.${p.type}`)}</Badge>
                      {lastCal && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {L("Dernier", "Last")}: {new Date(lastCal.date).toLocaleDateString(locale)} — {fmt(lastCal.total_value)}
                        </span>
                      )}
                      {realYield && realYield.inceptionYield != null && (
                        <Badge variant="outline" className={`shrink-0 text-xs ${realYield.inceptionYield >= 0 ? "text-emerald-600 border-emerald-400" : "text-rose-600 border-rose-400"}`}>
                          {L("Rendement réel", "Real return")} {realYield.inceptionYield >= 0 ? "+" : ""}{realYield.inceptionYield}%/{L("an", "yr")}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Label className="text-xs text-muted-foreground w-32 shrink-0">{L("Valeur totale (€)", "Total value (€)")}</Label>
                      <Input
                        type="number" min="0" step="0.01"
                        placeholder={`${L("ex", "e.g.")}: ${fmt(p.balance)}`}
                        value={entry.totalValue}
                        onChange={e => setPortfolioCalibValue(p.id, "totalValue", e.target.value)}
                        disabled={!interactive}
                        className="flex-1 min-w-[100px]"
                        data-testid={`calibration-total-${p.id}`}
                      />
                      {showPerRow && (
                        <>
                          <Input
                            type="date"
                            max={todayStr}
                            value={calibrationDateOverrides[p.id] ?? ""}
                            onChange={e => setCalibrationDateOverrides(prev => ({ ...prev, [p.id]: e.target.value }))}
                            className="w-44 shrink-0 text-sm text-muted-foreground"
                            title={`${L("Date spécifique pour", "Specific date for")} ${p.name}`}
                          />
                          <Button
                            type="button" size="sm" variant="secondary"
                            className="h-9 px-3 shrink-0 bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-300 border-amber-300/50"
                            onClick={() => saveCalibrationForPortfolio(p.id)}
                            disabled={!entry.totalValue}
                            data-testid={`calibration-save-${p.id}`}
                          >
                            <Target className="w-3 h-3 mr-1.5" />
                            {L("Calibrer", "Calibrate")}
                          </Button>
                        </>
                      )}
                    </div>

                    {showPerRow && calibrationConfirmed[p.id] && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 pl-[8.5rem]">
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        {L("Calibration enregistrée", "Calibration saved")}
                      </p>
                    )}

                    {(tplPositions.length > 0 || hasAssets) && (
                      <div>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => toggleCalibExpanded(p.id)} data-testid={`calibration-expand-${p.id}`}>
                          {expanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                          {expanded
                            ? L("Masquer le détail", "Hide detail")
                            : `${L("Détailler par position", "Detail by position")} (${tplPositions.length > 0 ? `${tplPositions.length} ${L("mouvement", "template")}${tplPositions.length > 1 ? "s" : ""}` : L("types d'actifs", "asset types")})`}
                        </Button>
                        {expanded && (
                          <div className="mt-2 space-y-1 pl-2 border-l-2 border-accent">
                            {tplPositions.length > 0 ? (
                              tplPositions.map(pos => (
                                <div key={pos.template_id} className="flex items-center gap-2">
                                  <div className="flex flex-col min-w-0 w-40 shrink-0">
                                    <span className="text-xs font-medium truncate">{pos.name}</span>
                                    {pos.asset_type && <span className="text-xs text-muted-foreground">{t(`assetTypes.${pos.asset_type}`) || pos.asset_type}</span>}
                                    {pos.total_quantity > 0 && <span className="text-xs text-blue-600">{pos.total_quantity} {L("unités", "units")}</span>}
                                  </div>
                                  <Input type="number" min="0" step="0.01" placeholder={L("Valeur (€)", "Value (€)")}
                                    value={entry.assetValues?.[pos.template_id] || ""}
                                    onChange={e => setAssetCalibValue(p.id, pos.template_id, e.target.value)}
                                    disabled={!interactive}
                                    className="flex-1 h-7 text-sm"
                                    data-testid={`calibration-tpl-${p.id}-${pos.template_id}`}
                                  />
                                </div>
                              ))
                            ) : (
                              assetTypes.map(at => (
                                <div key={at} className="flex items-center gap-2">
                                  <Label className="text-xs w-32 shrink-0 capitalize">{t(`assetTypes.${at}`) || at}</Label>
                                  <Input type="number" min="0" step="0.01" placeholder="0"
                                    value={entry.assetValues?.[at] || ""}
                                    onChange={e => setAssetCalibValue(p.id, at, e.target.value)}
                                    disabled={!interactive}
                                    className="flex-1 h-7 text-sm"
                                    data-testid={`calibration-asset-${p.id}-${at}`}
                                  />
                                </div>
                              ))
                            )}
                            <div className={`flex items-center gap-1 text-xs pt-1 ${sumOk ? "text-emerald-600" : "text-amber-600"}`}>
                              {sumOk
                                ? <><CheckCircle2 className="w-3 h-3" /> {L("Somme :", "Sum:")} {fmt(sum)} — {L("cohérente", "consistent")}</>
                                : <><AlertTriangle className="w-3 h-3" /> {L("Somme :", "Sum:")} {fmt(sum)} ≠ {L("total", "total")} {fmt(total)} — {L("veuillez ajuster", "please adjust")}</>}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <DialogFooter>
              <Button variant="secondary" onClick={() => { setEditingCalibrationId(null); if (onClose) onClose(); }}>
                {editingCalibrationId ? L("Annuler", "Cancel") : L("Fermer", "Close")}
              </Button>
              {editingCalibrationId && (
                <Button onClick={saveCalibrationEdit} className="bg-amber-500 hover:bg-amber-600 text-white" data-testid="save-calibration-btn">
                  <Target className="w-4 h-4 mr-2" />
                  {L("Mettre à jour", "Update")}
                </Button>
              )}
            </DialogFooter>
          </TabsContent>

          {/* ── Onglet 2 : historique ── */}
          <TabsContent value="historique" className="mt-3">
            {(() => {
              const existingIds = new Set(portfolios.map(p => p.id));
              const allCals = dataService.getCalibrations()
                .filter(c => existingIds.has(c.portfolio_id))
                .slice().reverse();
              if (allCals.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                    <Target className="w-8 h-8 text-muted-foreground/30" />
                    <p className="text-muted-foreground text-sm">{L("Aucune calibration enregistrée.", "No calibration recorded.")}</p>
                  </div>
                );
              }
              return (
                <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                  {allCals.map(cal => {
                    const portfolio = portfolios.find(p => p.id === cal.portfolio_id);
                    const isLevel2 = cal.asset_breakdown && cal.asset_breakdown.length > 0;
                    const isPendingDelete = calDeleteConfirm === cal.id;
                    return (
                      <div key={cal.id} className="flex items-center gap-2 p-2 rounded-lg border bg-card" style={{ backgroundColor: envTintBg(portfolio?.color || "#94A3B8"), color: envTextColor(portfolio?.color || "#94A3B8") }}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium tabular-nums">{new Date(cal.date).toLocaleDateString(locale)}</span>
                            <Badge variant="outline" className="text-xs">{portfolio?.name ?? "—"}</Badge>
                            <Badge variant="outline" className={`text-xs ${isLevel2 ? "text-violet-600 border-violet-400" : "text-slate-500"}`}>
                              {isLevel2 ? L("Niv. 2", "Lvl 2") : L("Niv. 1", "Lvl 1")}
                            </Badge>
                          </div>
                          <p className="text-sm font-semibold tabular-nums mt-0.5">{fmt(cal.total_value)}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {isPendingDelete ? (
                            <>
                              <span className="text-xs text-destructive font-medium">{L("Confirmer ?", "Confirm?")}</span>
                              <Button size="sm" variant="destructive" className="h-7 px-2 text-xs"
                                onClick={() => { dataService.deleteCalibration(cal.id); setCalDeleteConfirm(null); notifySaved(); }}>
                                {L("Oui", "Yes")}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setCalDeleteConfirm(null)}>
                                {L("Non", "No")}
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => startEditCalibration(cal)}>
                                <Edit2 className="w-3 h-3 mr-1" />{L("Modifier", "Edit")}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10" onClick={() => setCalDeleteConfirm(cal.id)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

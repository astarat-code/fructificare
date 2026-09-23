// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import challengeService from "../services/challengeService";
import questService from "../services/questService";
import dataService from "../services/dataService";
import { useLanguage } from "../context/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import GlossaryTerm from "../components/ui/GlossaryTerm";
import { 
  ArrowLeft, Calculator, Wallet, TrendingUp, FileText, 
  Euro, Percent, Info, AlertCircle, CheckCircle2, Gift
} from "lucide-react";

// Constantes fiscales (janvier 2026)
const PS_RATE = 0.186;      // Prélèvements sociaux 18,6 % (LF 2026)
const IR_RATE = 0.128;      // Impôt sur le revenu PFU 12,8 %
const FLAT_TAX = 0.314;     // Flat Tax 31,4 % (12,8 % IR + 18,6 % PS)
const IR_AV_REDUIT = 0.075; // IR réduit AV 7.5%
const ABATTEMENT_SOLO = 4600;
const ABATTEMENT_COUPLE = 9200;

export default function TaxSimulator() {
  const { t, lang } = useLanguage();
  
  const fmt = (v) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);
  const fmtPct = (v) => `${(v * 100).toFixed(1)}%`;

  // PEA State
  const [peaForm, setPeaForm] = useState({
    totalValue: "",
    totalDeposits: "",
    holdingYears: "5",
  });
  const [peaResult, setPeaResult] = useState(null);

  // CTO/Crypto State
  const [ctoForm, setCtoForm] = useState({
    totalValue: "",
    totalDeposits: "",
    isCrypto: false,
  });
  const [ctoResult, setCtoResult] = useState(null);

  // ── Vue ouverte (#15) : flag viewOpened.taxSimulator ────────────────────────
  useEffect(() => {
    try { questService.trackViewOpened('taxSimulator'); } catch (_) {}
  }, []);

  // ── Défi septembre (Prompt 9) : comparaison PEA vs CTO ─────────────────────
  const [peaCalcDone, setPeaCalcDone] = useState(false);
  const [ctoCalcDone, setCtoCalcDone] = useState(false);
  useEffect(() => {
    // Mission 9 (septembre) — une simulation a été lancée dans le simulateur fiscal
    if (peaCalcDone || ctoCalcDone) {
      try { challengeService.markVisit('taxSimRun'); } catch (_) {}
    }
    if (peaCalcDone && ctoCalcDone) {
      try { challengeService.trackFiscalPEACTOComparison(); } catch (_) {}
      // ── Quête Q10 — comparaison PEA vs CTO complétée ─────────────────────
      try { dataService.trackFiscalComparisonDone(); } catch (_) {}
    }
  }, [peaCalcDone, ctoCalcDone]);

  // Assurance Vie State
  const [avForm, setAvForm] = useState({
    totalValue: "",
    totalDeposits: "",
    holdingYears: "8",
    situation: "single", // single ou couple
  });
  const [avResult, setAvResult] = useState(null);

  // Calculer l'imposition PEA
  const calculatePEA = () => {
    setPeaCalcDone(true);
    const totalValue = parseFloat(peaForm.totalValue) || 0;
    const totalDeposits = parseFloat(peaForm.totalDeposits) || 0;
    const holdingYears = parseInt(peaForm.holdingYears) || 0;
    
    const gains = Math.max(0, totalValue - totalDeposits);
    
    if (gains <= 0) {
      setPeaResult({
        gains: 0,
        ps: 0,
        ir: 0,
        totalTax: 0,
        netValue: totalValue,
        taxRate: 0,
        message: t("simulation.taxSim.noGains"),
      });
      return;
    }
    
    let ps, ir, totalTax, taxRate, message;
    
    if (holdingYears >= 5) {
      // PEA > 5 ans : uniquement PS
      ps = gains * PS_RATE;
      ir = 0;
      totalTax = ps;
      taxRate = PS_RATE;
      message = t("simulation.taxSim.peaOver5");
    } else {
      // PEA < 5 ans : Flat Tax
      ps = gains * PS_RATE;
      ir = gains * IR_RATE;
      totalTax = gains * FLAT_TAX;
      taxRate = FLAT_TAX;
      message = t("simulation.taxSim.peaUnder5");
    }
    
    setPeaResult({
      gains,
      ps,
      ir,
      totalTax,
      netValue: totalValue - totalTax,
      taxRate,
      message,
    });
    // ── Recommandation fiscale (#7) — PEA optimal si ≥ 5 ans ─────────────────
    if (holdingYears >= 5) {
      try { require('../services/trophyService').default.recordFiscalRecommendation('PEA'); } catch (_) {}
    }
    // ── Quête Q9 — simulation fiscale complétée ───────────────────────────────
    try { dataService.trackFiscalSimulationDone(); } catch (_) {}
  };

  // Calculer l'imposition CTO/Crypto
  const calculateCTO = () => {
    setCtoCalcDone(true);
    const totalValue = parseFloat(ctoForm.totalValue) || 0;
    const totalDeposits = parseFloat(ctoForm.totalDeposits) || 0;
    
    const gains = Math.max(0, totalValue - totalDeposits);
    
    if (gains <= 0) {
      setCtoResult({
        gains: 0,
        ps: 0,
        ir: 0,
        totalTax: 0,
        netValue: totalValue,
        taxRate: 0,
        message: t("simulation.taxSim.noGains"),
      });
      return;
    }
    
    // CTO et Crypto : Flat Tax 31,4%
    const ps = gains * PS_RATE;
    const ir = gains * IR_RATE;
    const totalTax = gains * FLAT_TAX;
    
    setCtoResult({
      gains,
      ps,
      ir,
      totalTax,
      netValue: totalValue - totalTax,
      taxRate: FLAT_TAX,
      message: ctoForm.isCrypto
        ? t("simulation.taxSim.cryptoFlat")
        : t("simulation.taxSim.ctoFlat"),
    });
    // ── Quête Q9a — plus-value CTO ≥ 1 000 € ────────────────────────────────
    try { dataService.trackFiscalSimulationDone(); } catch (_) {}
    try {
      if (gains >= 1000) {
        questService.trackFlag('fiscalSimCTOOver1000');
      }
    } catch (_) {}
  };

  // Calculer l'imposition Assurance Vie + rachat sans impôt
  const calculateAV = () => {
    const totalValue = parseFloat(avForm.totalValue) || 0;
    const totalDeposits = parseFloat(avForm.totalDeposits) || 0;
    const holdingYears = parseInt(avForm.holdingYears) || 0;
    const abattement = avForm.situation === "single" ? ABATTEMENT_SOLO : ABATTEMENT_COUPLE;
    
    const gains = Math.max(0, totalValue - totalDeposits);
    
    if (gains <= 0) {
      setAvResult({
        gains: 0,
        ps: 0,
        ir: 0,
        totalTax: 0,
        netValue: totalValue,
        taxRate: 0,
        message: t("simulation.taxSim.noGains"),
        maxWithdrawalNoTax: totalValue,
        abattement,
      });
      return;
    }
    
    let ps, ir, totalTax, taxRate, message;
    
    // PS sur tous les gains
    ps = gains * PS_RATE;
    
    if (holdingYears < 8) {
      // AV < 8 ans : Flat Tax
      ir = gains * IR_RATE;
      totalTax = gains * FLAT_TAX;
      taxRate = FLAT_TAX;
      message = t("simulation.taxSim.avUnder8");
    } else {
      // AV >= 8 ans : régime favorable
      if (totalDeposits <= 150000) {
        // Versements <= 150 000€
        if (gains <= abattement) {
          ir = 0;
          totalTax = ps;
          taxRate = PS_RATE;
          message = t("simulation.taxSim.avOver8UnderAbat");
        } else {
          ir = (gains - abattement) * IR_AV_REDUIT;
          totalTax = ps + ir;
          taxRate = totalTax / gains;
          message = t("simulation.taxSim.avOver8OverAbat").replace("{abat}", fmt(abattement));
        }
      } else {
        // Versements > 150 000€
        const ratio150k = 150000 / totalDeposits;
        const part150k = gains * ratio150k;
        const partExcess = gains * (1 - ratio150k);
        
        if (gains <= abattement) {
          ir = 0;
          totalTax = ps;
          taxRate = PS_RATE;
          message = t("simulation.taxSim.avOver8UnderAbat");
        } else {
          const irPart150k = Math.max(0, part150k - abattement) * IR_AV_REDUIT;
          const irPartExcess = partExcess * IR_RATE;
          ir = irPart150k + irPartExcess;
          totalTax = ps + ir;
          taxRate = totalTax / gains;
          message = t("simulation.taxSim.avOver8Over150k");
        }
      }
    }
    
    // Calcul du montant maximum rachetable sans payer d'IR (uniquement PS)
    // Formule : maxWithdrawal = (abattement × totalValue) / gains
    let maxWithdrawalNoTax = 0;
    if (holdingYears >= 8 && gains > 0) {
      if (gains > abattement) {
        maxWithdrawalNoTax = (abattement * totalValue) / gains;
      } else {
        maxWithdrawalNoTax = totalValue; // Tout peut être retiré sans IR (PS s'applique quand même)
      }
    }
    
    setAvResult({
      gains,
      ps,
      ir,
      totalTax,
      netValue: totalValue - totalTax,
      taxRate,
      message,
      maxWithdrawalNoTax,
      abattement,
    });
    // ── Recommandation fiscale (#7) — Assurance-Vie optimale si ≥ 8 ans ──────
    if (holdingYears >= 8) {
      try { require('../services/trophyService').default.recordFiscalRecommendation('assurance_vie'); } catch (_) {}
    }
    // ── Quête Q9 — simulation fiscale complétée ───────────────────────────────
    try { dataService.trackFiscalSimulationDone(); } catch (_) {}
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/simulation/portfolios">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold" data-testid="tax-simulator-title">
              {t("simulation.taxSimulator") || "Simulateur d'imposition"}
            </h1>
            <p className="text-muted-foreground">
              {t("simulation.taxSimulatorDesc") || "Estimez l'impact fiscal de vos placements"}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pea" className="space-y-6" onValueChange={(tab) => {
        // ── Q9b : visite de l'onglet Documentation fiscale ──────────────────
        if (tab === 'doc') {
          try { questService.trackViewOpened('fiscalSimDocumentation'); } catch (_) {}
        }
      }}>
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="pea" data-testid="tab-pea">
            <Wallet className="w-4 h-4 mr-2 hidden sm:inline" /> {t("simulation.taxSim.tabPea")}
          </TabsTrigger>
          <TabsTrigger value="cto" data-testid="tab-cto">
            <TrendingUp className="w-4 h-4 mr-2 hidden sm:inline" /> {t("simulation.taxSim.tabCto")}
          </TabsTrigger>
          <TabsTrigger value="av" data-testid="tab-av">
            <Euro className="w-4 h-4 mr-2 hidden sm:inline" /> {t("simulation.taxSim.tabAv")}
          </TabsTrigger>
          <TabsTrigger value="doc" data-testid="tab-doc">
            <FileText className="w-4 h-4 mr-2 hidden sm:inline" /> {t("simulation.taxSim.tabDoc")}
          </TabsTrigger>
        </TabsList>

        {/* PEA Tab */}
        <TabsContent value="pea" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Formulaire PEA */}
            <Card className="border border-border shadow-sm">
              <CardHeader>
                <CardTitle className="font-heading flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-primary" />
                  <GlossaryTerm id="pea">{t("simulation.taxSim.peaTitle")}</GlossaryTerm>
                </CardTitle>
                <CardDescription>
                  {t("simulation.taxSim.peaDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>{t("simulation.taxSim.peaCurrentValue")}</Label>
                  <Input 
                    type="number" 
                    value={peaForm.totalValue}
                    onChange={e => setPeaForm({...peaForm, totalValue: e.target.value})}
                    placeholder="Ex: 50000"
                    data-testid="pea-total-value"
                  />
                </div>
                <div>
                  <Label>{t("simulation.taxSim.peaTotalDeposits")}</Label>
                  <Input 
                    type="number" 
                    value={peaForm.totalDeposits}
                    onChange={e => setPeaForm({...peaForm, totalDeposits: e.target.value})}
                    placeholder="Ex: 40000"
                    data-testid="pea-total-deposits"
                  />
                </div>
                <div>
                  <Label>{t("simulation.taxSim.peaHoldingYears")}</Label>
                  <Select value={peaForm.holdingYears} onValueChange={v => setPeaForm({...peaForm, holdingYears: v})}>
                    <SelectTrigger data-testid="pea-holding-years">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1,2,3,4,5,6,7,8,9,10,15,20].map(y => (
                        <SelectItem key={y} value={y.toString()}>{y} {y > 1 ? t("simulation.taxSim.years") : t("simulation.taxSim.year")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={calculatePEA} className="w-full" data-testid="calculate-pea-btn">
                  <Calculator className="w-4 h-4 mr-2" /> {t("simulation.taxSim.calculate")}
                </Button>
              </CardContent>
            </Card>

            {/* Résultats PEA */}
            <Card className="border border-border shadow-sm">
              <CardHeader>
                <CardTitle className="font-heading">{t("simulation.taxSim.results")}</CardTitle>
              </CardHeader>
              <CardContent>
                {peaResult ? (
                  <div className="space-y-4">
                    <div className="bg-accent/50 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground mb-1"><GlossaryTerm id="plus_value">{t("simulation.taxSim.capitalGains")}</GlossaryTerm></p>
                      <p className="text-2xl font-bold font-mono text-emerald-600">{fmt(peaResult.gains)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground"><GlossaryTerm id="prelevements_sociaux">{t("simulation.taxSim.socialCharges")}</GlossaryTerm></p>
                        <p className="font-mono font-semibold text-amber-600">{fmt(peaResult.ps)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t("simulation.taxSim.incomeTax")}</p>
                        <p className="font-mono font-semibold text-amber-600">{fmt(peaResult.ir)}</p>
                      </div>
                    </div>
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold">{t("simulation.taxSim.totalTax")}</span>
                        <span className="text-xl font-bold font-mono text-red-600">{fmt(peaResult.totalTax)}</span>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-lg font-semibold">{t("simulation.taxSim.netValue")}</span>
                        <span className="text-xl font-bold font-mono text-emerald-600">{fmt(peaResult.netValue)}</span>
                      </div>
                      <Badge variant="outline" className="mt-3">
                        {t("simulation.taxSim.effectiveRate")}{lang === "en" ? ":" : " :"} {fmtPct(peaResult.taxRate)}
                      </Badge>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-blue-700 dark:text-blue-400">{peaResult.message}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calculator className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>{t("simulation.taxSim.enterData")}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Info box PEA */}
          <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-emerald-200 dark:border-emerald-800">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-emerald-800 dark:text-emerald-400">{t("simulation.taxSim.peaAdvantage")}</p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-500 mt-1">
                    {t("simulation.taxSim.peaAdvantageDesc")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <TaxDisclaimer t={t} />
        </TabsContent>

        {/* CTO/Crypto Tab */}
        <TabsContent value="cto" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Formulaire CTO */}
            <Card className="border border-border shadow-sm">
              <CardHeader>
                <CardTitle className="font-heading flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <GlossaryTerm id="cto">{t("simulation.taxSim.ctoTitle")}</GlossaryTerm>
                </CardTitle>
                <CardDescription>
                  {t("simulation.taxSim.ctoDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>{t("simulation.taxSim.ctoCurrentValue")}</Label>
                  <Input 
                    type="number" 
                    value={ctoForm.totalValue}
                    onChange={e => setCtoForm({...ctoForm, totalValue: e.target.value})}
                    placeholder="Ex: 30000"
                    data-testid="cto-total-value"
                  />
                </div>
                <div>
                  <Label>{t("simulation.taxSim.ctoTotalDeposits")}</Label>
                  <Input 
                    type="number" 
                    value={ctoForm.totalDeposits}
                    onChange={e => setCtoForm({...ctoForm, totalDeposits: e.target.value})}
                    placeholder="Ex: 20000"
                    data-testid="cto-total-deposits"
                  />
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <input 
                    type="checkbox" 
                    id="isCrypto" 
                    checked={ctoForm.isCrypto}
                    onChange={e => setCtoForm({...ctoForm, isCrypto: e.target.checked})}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <Label htmlFor="isCrypto" className="cursor-pointer">{t("simulation.taxSim.isCrypto")}</Label>
                </div>
                <Button onClick={calculateCTO} className="w-full" data-testid="calculate-cto-btn">
                  <Calculator className="w-4 h-4 mr-2" /> {t("simulation.taxSim.calculate")}
                </Button>
              </CardContent>
            </Card>

            {/* Résultats CTO */}
            <Card className="border border-border shadow-sm">
              <CardHeader>
                <CardTitle className="font-heading">{t("simulation.taxSim.results")}</CardTitle>
              </CardHeader>
              <CardContent>
                {ctoResult ? (
                  <div className="space-y-4">
                    <div className="bg-accent/50 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground mb-1"><GlossaryTerm id="plus_value">{t("simulation.taxSim.capitalGains")}</GlossaryTerm></p>
                      <p className="text-2xl font-bold font-mono text-emerald-600">{fmt(ctoResult.gains)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground"><GlossaryTerm id="prelevements_sociaux">{t("simulation.taxSim.socialCharges")}</GlossaryTerm></p>
                        <p className="font-mono font-semibold text-amber-600">{fmt(ctoResult.ps)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t("simulation.taxSim.incomeTax")} (12,8%)</p>
                        <p className="font-mono font-semibold text-amber-600">{fmt(ctoResult.ir)}</p>
                      </div>
                    </div>
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold">{t("simulation.taxSim.totalTax")} (31,4%)</span>
                        <span className="text-xl font-bold font-mono text-red-600">{fmt(ctoResult.totalTax)}</span>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-lg font-semibold">{t("simulation.taxSim.netValue")}</span>
                        <span className="text-xl font-bold font-mono text-emerald-600">{fmt(ctoResult.netValue)}</span>
                      </div>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-amber-700 dark:text-amber-400">{ctoResult.message}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calculator className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>{t("simulation.taxSim.enterData")}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Info box CTO */}
          <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-800 dark:text-amber-400">{t("simulation.taxSim.ctoAdvantage")}</p>
                  <p className="text-sm text-amber-700 dark:text-amber-500 mt-1">
                    {t("simulation.taxSim.ctoAdvantageDesc")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <TaxDisclaimer t={t} />
        </TabsContent>

        {/* Assurance Vie Tab */}
        <TabsContent value="av" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Formulaire AV */}
            <Card className="border border-border shadow-sm">
              <CardHeader>
                <CardTitle className="font-heading flex items-center gap-2">
                  <Euro className="w-5 h-5 text-primary" />
                  <GlossaryTerm id="assurance_vie">{t("simulation.taxSim.avTitle")}</GlossaryTerm>
                </CardTitle>
                <CardDescription>
                  {t("simulation.taxSim.avDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>{t("simulation.taxSim.avCurrentValue")}</Label>
                  <Input 
                    type="number" 
                    value={avForm.totalValue}
                    onChange={e => setAvForm({...avForm, totalValue: e.target.value})}
                    placeholder="Ex: 100000"
                    data-testid="av-total-value"
                  />
                </div>
                <div>
                  <Label>{t("simulation.taxSim.avTotalDeposits")}</Label>
                  <Input 
                    type="number" 
                    value={avForm.totalDeposits}
                    onChange={e => setAvForm({...avForm, totalDeposits: e.target.value})}
                    placeholder="Ex: 80000"
                    data-testid="av-total-deposits"
                  />
                </div>
                <div>
                  <Label>{t("simulation.taxSim.avHoldingYears")}</Label>
                  <Select value={avForm.holdingYears} onValueChange={v => setAvForm({...avForm, holdingYears: v})}>
                    <SelectTrigger data-testid="av-holding-years">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1,2,3,4,5,6,7,8,9,10,15,20,25,30].map(y => (
                        <SelectItem key={y} value={y.toString()}>{y} {y > 1 ? t("simulation.taxSim.years") : t("simulation.taxSim.year")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("simulation.taxSim.avSituation")}</Label>
                  <Select value={avForm.situation} onValueChange={v => setAvForm({...avForm, situation: v})}>
                    <SelectTrigger data-testid="av-situation">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">{t("simulation.taxSim.avSingle")}</SelectItem>
                      <SelectItem value="couple">{t("simulation.taxSim.avCouple")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={calculateAV} className="w-full" data-testid="calculate-av-btn">
                  <Calculator className="w-4 h-4 mr-2" /> {t("simulation.taxSim.calculate")}
                </Button>
              </CardContent>
            </Card>

            {/* Résultats AV */}
            <Card className="border border-border shadow-sm">
              <CardHeader>
                <CardTitle className="font-heading">{t("simulation.taxSim.results")}</CardTitle>
              </CardHeader>
              <CardContent>
                {avResult ? (
                  <div className="space-y-4">
                    <div className="bg-accent/50 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground mb-1"><GlossaryTerm id="plus_value">{t("simulation.taxSim.capitalGains")}</GlossaryTerm></p>
                      <p className="text-2xl font-bold font-mono text-emerald-600">{fmt(avResult.gains)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground"><GlossaryTerm id="prelevements_sociaux">{t("simulation.taxSim.socialCharges")}</GlossaryTerm></p>
                        <p className="font-mono font-semibold text-amber-600">{fmt(avResult.ps)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t("simulation.taxSim.incomeTax")}</p>
                        <p className="font-mono font-semibold text-amber-600">{fmt(avResult.ir)}</p>
                      </div>
                    </div>
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold">{t("simulation.taxSim.totalTax")}</span>
                        <span className="text-xl font-bold font-mono text-red-600">{fmt(avResult.totalTax)}</span>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-lg font-semibold">{t("simulation.taxSim.netValue")}</span>
                        <span className="text-xl font-bold font-mono text-emerald-600">{fmt(avResult.netValue)}</span>
                      </div>
                      <Badge variant="outline" className="mt-3">
                        {t("simulation.taxSim.effectiveRate")}{lang === "en" ? ":" : " :"} {fmtPct(avResult.taxRate)}
                      </Badge>
                    </div>
                    
                    {/* Rachat sans impôt */}
                    {parseInt(avForm.holdingYears) >= 8 && avResult.maxWithdrawalNoTax > 0 && (
                      <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 rounded-lg p-4 border border-emerald-300 dark:border-emerald-700">
                        <div className="flex items-start gap-3">
                          <Gift className="w-5 h-5 text-emerald-600 mt-0.5" />
                          <div>
                            <p className="font-semibold text-emerald-800 dark:text-emerald-400">
                              {t("simulation.taxSim.avWithdrawalNoTax")}
                            </p>
                            <p className="text-2xl font-bold font-mono text-emerald-600 mt-1">
                              {fmt(avResult.maxWithdrawalNoTax)}
                            </p>
                            <p className="text-xs text-emerald-700 dark:text-emerald-500 mt-1">
                              {t("simulation.taxSim.avWithdrawalNoTaxDesc")}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-blue-700 dark:text-blue-400">{avResult.message}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calculator className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>{t("simulation.taxSim.enterData")}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Info box AV */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-blue-800 dark:text-blue-400">{t("simulation.taxSim.avAdvantage")}</p>
                  <ul className="text-sm text-blue-700 dark:text-blue-500 mt-1 space-y-1">
                    <li>• {t("simulation.taxSim.avAdvantageList1")}</li>
                    <li>• {t("simulation.taxSim.avAdvantageList2")}</li>
                    <li>• {t("simulation.taxSim.avAdvantageList3")}</li>
                    <li>• {t("simulation.taxSim.avAdvantageList4")}</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
          <TaxDisclaimer t={t} />
        </TabsContent>

        {/* Documentation Tab */}
        <TabsContent value="doc" className="space-y-6">
          <Card className="border border-border shadow-sm">
            <CardHeader>
              <CardTitle className="font-heading flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                {t("simulation.taxSim.docTitle")}
              </CardTitle>
              <CardDescription>
                {t("simulation.taxSim.docDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <TaxDocumentation t={t} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Mentions légales communes aux onglets de simulation (PEA, CTO, assurance vie).
 * Reprend la note affichée en bas de l'onglet Documentation, pour qu'aucun
 * résultat chiffré ne soit lu sans son avertissement.
 */
function TaxDisclaimer({ t }) {
  return (
    <div className="pt-2">
      <p className="text-xs text-muted-foreground border-t pt-4">
        <strong>Note :</strong> {t("simulation.taxSim.docDisclaimer")}
      </p>
    </div>
  );
}

// Composant Documentation - Contenu éditable dans ce fichier
function TaxDocumentation({ t }) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-heading font-bold text-primary mb-3">{t("simulation.taxSim.docRatesTitle")}</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-accent/50">
                <th className="border p-2 text-left">{t("simulation.taxSim.docRateType")}</th>
                <th className="border p-2 text-left">{t("simulation.taxSim.docRateValue")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border p-2">{t("simulation.taxSim.docPS")}</td>
                <td className="border p-2 font-mono">18,6%</td>
              </tr>
              <tr>
                <td className="border p-2">{t("simulation.taxSim.docIR")}</td>
                <td className="border p-2 font-mono">12,8%</td>
              </tr>
              <tr className="bg-accent/30">
                <td className="border p-2 font-semibold">{t("simulation.taxSim.docFlatTax")}</td>
                <td className="border p-2 font-mono font-semibold">31,4%</td>
              </tr>
              <tr>
                <td className="border p-2">{t("simulation.taxSim.docIRAV")}</td>
                <td className="border p-2 font-mono">7,5%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-heading font-bold text-primary mb-3">{t("simulation.taxSim.docPEATitle")}</h2>
        <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-4 space-y-2">
          <p><strong>{t("simulation.taxSim.docPEACap")}</strong> 150 000 €</p>
          <p><strong>{t("simulation.taxSim.docPEABefore5")}</strong> {t("simulation.taxSim.docPEABefore5Desc")}</p>
          <p><strong>{t("simulation.taxSim.docPEAAfter5")}</strong> {t("simulation.taxSim.docPEAAfter5Desc")}</p>
          <p className="text-sm text-muted-foreground">
            {t("simulation.taxSim.docPEANote")}
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-heading font-bold text-primary mb-3">{t("simulation.taxSim.docCTOTitle")}</h2>
        <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-4 space-y-2">
          <p><strong>{t("simulation.taxSim.docCTONoCap")}</strong></p>
          <p><strong>{t("simulation.taxSim.docCTOTax")}</strong> {t("simulation.taxSim.docCTOTaxDesc")}</p>
          <p><strong>{t("simulation.taxSim.docCTOOption")}</strong> {t("simulation.taxSim.docCTOOptionDesc")}</p>
          <p className="text-sm text-muted-foreground">
            {t("simulation.taxSim.docCTONote")}
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-heading font-bold text-primary mb-3">{t("simulation.taxSim.docCryptoTitle")}</h2>
        <div className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-4 space-y-2">
          <p><strong>{t("simulation.taxSim.docCryptoTax")}</strong> {t("simulation.taxSim.docCryptoTaxDesc")}</p>
          <p><strong>{t("simulation.taxSim.docCryptoTrigger")}</strong> {t("simulation.taxSim.docCryptoTriggerDesc")}</p>
          <p><strong>{t("simulation.taxSim.docCryptoExchange")}</strong> {t("simulation.taxSim.docCryptoExchangeDesc")}</p>
          <p className="text-sm text-muted-foreground">
            {t("simulation.taxSim.docCryptoNote")}
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-heading font-bold text-primary mb-3">{t("simulation.taxSim.docAVTitle")}</h2>
        <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 space-y-3">
          <div>
            <p className="font-semibold">{t("simulation.taxSim.docAVBefore8")}</p>
            <p>{t("simulation.taxSim.docAVBefore8Desc")}</p>
          </div>
          <div>
            <p className="font-semibold">{t("simulation.taxSim.docAVAfter8")}</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>{t("simulation.taxSim.docAVAfter8List1")}</li>
              <li>{t("simulation.taxSim.docAVAfter8List2")}</li>
              <li>{t("simulation.taxSim.docAVAfter8List3")}</li>
            </ul>
          </div>
          <div className="mt-3 p-3 bg-white/50 dark:bg-black/20 rounded border">
            <p className="font-semibold text-emerald-700 dark:text-emerald-400">{t("simulation.taxSim.docAVFormula")}</p>
            <p className="text-sm mt-1">
              <code className="bg-accent px-2 py-1 rounded">{t("simulation.taxSim.docAVFormulaCode")}</code>
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {t("simulation.taxSim.docAVFormulaNote")}
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-heading font-bold text-primary mb-3">{t("simulation.taxSim.docTipsTitle")}</h2>
        <ul className="space-y-2">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-1 flex-shrink-0" />
            <span>{t("simulation.taxSim.docTip1")}</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-1 flex-shrink-0" />
            <span>{t("simulation.taxSim.docTip2")}</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-1 flex-shrink-0" />
            <span>{t("simulation.taxSim.docTip3")}</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-1 flex-shrink-0" />
            <span>{t("simulation.taxSim.docTip4")}</span>
          </li>
        </ul>
      </section>

      <p className="text-xs text-muted-foreground border-t pt-4 mt-6">
        <strong>Note :</strong> {t("simulation.taxSim.docDisclaimer")}
      </p>
    </div>
  );
}

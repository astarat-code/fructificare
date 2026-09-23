// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
import { useLanguage } from "../context/LanguageContext";
import { Card, CardContent } from "../components/ui/card";
import { Link } from "react-router-dom";
import { Briefcase, Calculator, TrendingUp, ArrowRight } from "lucide-react";

export default function Simulation() {
  const { t } = useLanguage();

  return (
    <div className="space-y-8" data-testid="simulation-page">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight mb-3">
          {t("simulation.title")}
        </h1>
        <p className="text-muted-foreground">
          {t("simulation.subtitle") || "Projetez l'évolution de votre patrimoine et simulez différents scénarios"}
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* Simulateur d'enveloppes */}
        <Link to="/simulation/portfolios" data-testid="sim-portfolios-btn">
          <Card className="border-2 border-border hover:border-primary/50 hover:shadow-lg transition-all duration-300 cursor-pointer h-full group">
            <CardContent className="p-8 flex flex-col items-center text-center h-full">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Briefcase className="w-8 h-8 text-primary" />
              </div>
              <h2 className="font-heading text-xl font-bold mb-2">
                {t("simulation.portfolioSimulator") || "Simulateur d'enveloppes"}
              </h2>
              <p className="text-muted-foreground text-sm flex-1">
                {t("simulation.portfolioSimulatorDesc") || "Créez des scénarios d'investissement, projetez vos enveloppes dans le futur et atteignez l'indépendance financière (FIRE)"}
              </p>
              <div className="mt-4 flex items-center gap-2 text-primary font-medium text-sm group-hover:gap-3 transition-all">
                <span>{t("simulation.access") || "Accéder"}</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Simulateur d'imposition */}
        <Link to="/simulation/tax" data-testid="sim-tax-btn">
          <Card className="border-2 border-border hover:border-amber-500/50 hover:shadow-lg transition-all duration-300 cursor-pointer h-full group">
            <CardContent className="p-8 flex flex-col items-center text-center h-full">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4 group-hover:bg-amber-500/20 transition-colors">
                <Calculator className="w-8 h-8 text-amber-600" />
              </div>
              <h2 className="font-heading text-xl font-bold mb-2">
                {t("simulation.taxSimulator") || "Simulateur d'imposition"}
              </h2>
              <p className="text-muted-foreground text-sm flex-1">
                {t("simulation.taxSimulatorDesc") || "Estimez l'impact fiscal de vos retraits et optimisez votre stratégie de sortie"}
              </p>
              <div className="mt-4 flex items-center gap-2 text-amber-600 font-medium text-sm group-hover:gap-3 transition-all">
                <span>{t("simulation.access") || "Accéder"}</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

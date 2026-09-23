// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * SimulationEnvelopeDetail.js — detailed page of a SIMULATION envelope.
 *
 * An exact replica of the dashboard's envelope page: the SAME PortfolioDetail component is
 * rendered, plugged into a data adapter scoped to the simulation (isolated namespace). No
 * action here touches the dashboard.
 *
 * The projection horizon (the target date stored on the simulation) is passed to the
 * adapter: the charts then extend the envelope's value into the future, compounding at the
 * envelope's TARGET RETURN.
 */

import { useMemo } from "react";
import { useParams } from "react-router-dom";
import PortfolioDetail from "./PortfolioDetail";
import dataService from "../services/dataService";
import { makeDataSource } from "../lib/portfolioDataSource";

export default function SimulationEnvelopeDetail() {
  const { simId, portfolioId } = useParams();

  const scope = useMemo(() => {
    const sim = dataService.getSimulation(simId);
    const years = sim?.lastProjectionYears || 0;
    // Horizon = fin de l'année cible (granularité année, comme la valeur persistée par le curseur)
    const projectionTargetMonth = years > 0
      ? `${new Date().getFullYear() + years}-12`
      : null;
    return { type: "simulation", simId, projectionTargetMonth };
  }, [simId]);

  const dataSource = useMemo(() => makeDataSource(scope), [scope]);

  return (
    <PortfolioDetail
      dataSource={dataSource}
      scope={scope}
      portfolioId={portfolioId}
      backHref={`/simulation/portfolios/${simId}`}
    />
  );
}

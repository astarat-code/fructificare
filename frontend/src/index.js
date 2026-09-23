// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// ── Journaux de debug : neutralisés en production (item 7c) ───────────────────
// console.warn / console.error restent actifs pour la visibilité des erreurs.
// En développement, tous les logs restent disponibles.
if (process.env.NODE_ENV === "production") {
  const noop = () => {};
  // eslint-disable-next-line no-console -- c'est ici qu'on neutralise console.log
  console.log = noop;
  console.debug = noop;
  console.info = noop;
}

import gamificationService from "@/services/gamificationService";
import trophyService from "@/services/trophyService";
import questService from "@/services/questService";
import objectiveService from "@/services/objectiveService";
import challengeService from "@/services/challengeService";

// Charger l'état de gamification avant le premier rendu
gamificationService.loadState();

// Abonner le vérificateur de trophées au bus d'événements XP
trophyService.initTrophyWatcher();

// Abonner le vérificateur de quêtes au bus d'événements XP
questService.initQuestWatcher();

// Abonner le vérificateur d'objectifs au bus d'événements XP
objectiveService.initObjectiveWatcher();

// Abonner le vérificateur de défis mensuels au bus d'événements XP (Prompt 9)
challengeService.initChallengeWatcher();

// La vérification initiale des quêtes est différée après le premier rendu par
// App (deferredStartup, item 7b) — elle n'est plus exécutée ici pour ne pas
// bloquer la peinture initiale.

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

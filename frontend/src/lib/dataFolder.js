// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * dataFolder.js — The data folder: automatic backups (save/) and imported PDFs
 * (documents imp/).
 *
 * By default it is the application folder; the user can pick another one at first launch
 * or from File > Data folder & encryption…
 *
 * The choice belongs to the native side (src-tauri/src/dossier_donnees.rs): the frontend
 * can ask for the native folder picker and apply what the user picked there, but never
 * hands over a path. That is what keeps a compromised script from widening its own disk
 * access.
 */

function isTauri() {
  return typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;
}

async function invoke(commande, args) {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke(commande, args);
}

// Une seule lecture partagée : le chargement de la sauvegarde et l'assistant de
// bienvenue la demandent tous deux au démarrage.
let _info = null;

/**
 * @param {{ refresh?: boolean }} [opts]
 * @returns {Promise<null | { root:string, defaultRoot:string, custom:boolean,
 *   firstRun:boolean, available:boolean, defaultHasBackups:boolean }>}
 *   null hors de l'application de bureau.
 */
export function getDataFolderInfo({ refresh = false } = {}) {
  if (!isTauri()) return Promise.resolve(null);
  if (!_info || refresh) {
    _info = invoke('data_folder_info').catch((e) => { _info = null; throw e; });
  }
  return _info;
}

/**
 * Racine des données. Lève une erreur si le dossier choisi est introuvable (disque externe
 * débranché…) : l'application ne doit alors ni lire un dossier vide comme s'il était le
 * bon, ni y recréer une sauvegarde qui passerait ensuite pour la plus récente.
 */
export async function getDataRoot() {
  const info = await getDataFolderInfo();
  if (!info.available) throw new Error(`Dossier de données introuvable : ${info.root}`);
  return info.root;
}

/**
 * Ouvre le sélecteur de dossier natif. Rien n'est appliqué tant que applyDataFolder()
 * n'est pas appelée.
 * @returns {Promise<null | { root:string, hasBackups:boolean, isDefault:boolean, isCurrent:boolean }>}
 */
export function pickDataFolder(english) {
  return invoke('data_folder_pick', { english: !!english });
}

/**
 * @param {'choice'|'default'} target  le dossier choisi, ou celui de l'application
 * @param {'move'|'use'} mode  déplacer les données actuelles, ou reprendre celles du dossier
 * @returns {Promise<{ info:object, moved:number, leftBehind:number }>}
 */
export async function applyDataFolder(target, mode) {
  const bilan = await invoke('data_folder_apply', { target, mode });
  _info = Promise.resolve(bilan.info);
  return bilan;
}

/** Ouvre le dossier des données — ou celui des documents — dans l'explorateur. */
export function openDataFolder(documents = false) {
  return invoke('data_folder_open', { documents });
}

/** Ouvre un document importé avec le lecteur PDF du système (chemin revalidé côté natif). */
export function openDocumentFile(relPath) {
  return invoke('document_open', { relPath });
}

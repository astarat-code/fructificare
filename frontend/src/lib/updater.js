// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * updater.js — Looking for a new version of the application.
 *
 * This is the only thing in Fructificare that touches the Internet, and it does so from
 * the native side (src-tauri/src/mise_a_jour.rs): the webview itself still cannot open
 * any connection. The check reads a public file attached to the latest GitHub release;
 * nothing is sent.
 *
 * Two settings, both kept on this computer only (they must be readable before the data
 * file is unlocked, and they describe the machine, not the portfolio):
 *   • whether the daily automatic check is allowed (on unless the user turned it off);
 *   • the date of the last automatic check, so that it runs at most once a day.
 */

const CLE_ACTIVE = 'fructificare_update_check';
const CLE_DERNIERE = 'fructificare_update_last_check';

const lire = (cle) => { try { return localStorage.getItem(cle); } catch { return null; } };
const ecrire = (cle, valeur) => { try { localStorage.setItem(cle, valeur); } catch { /* stockage indisponible */ } };

export function isTauri() {
  return typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;
}

async function invoke(commande, args) {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke(commande, args);
}

/** La recherche automatique quotidienne est-elle autorisée ? */
export function isAutoCheckEnabled() {
  return lire(CLE_ACTIVE) !== '0';
}

export function setAutoCheckEnabled(active) {
  ecrire(CLE_ACTIVE, active ? '1' : '0');
}

const aujourdHui = () => new Date().toISOString().slice(0, 10);

/** Vrai si aucune recherche automatique n'a encore eu lieu aujourd'hui. */
export function isAutoCheckDue() {
  return isTauri() && isAutoCheckEnabled() && lire(CLE_DERNIERE) !== aujourdHui();
}

export function markAutoCheckDone() {
  ecrire(CLE_DERNIERE, aujourdHui());
}

/**
 * @returns {Promise<null | { version: string, courante: string, installable: boolean }>}
 *   null si l'application est à jour. Lève une erreur si la recherche a échoué
 *   (pas de connexion, serveur injoignable).
 */
export function checkForUpdate() {
  return invoke('update_check');
}

/**
 * Télécharge et installe la mise à jour, puis relance l'application.
 * @param {(recu: number, total: number|null) => void} [onProgress]
 */
export async function installUpdate(onProgress) {
  const { listen } = await import('@tauri-apps/api/event');
  const arreter = await listen('update-progress', (e) => {
    const [recu, total] = e.payload || [];
    onProgress?.(recu || 0, total ?? null);
  });
  try {
    await invoke('update_install');
  } finally {
    arreter();
  }
}

/** Ouvre la page de téléchargement dans le navigateur. */
export function openDownloadPage() {
  return invoke('update_open_page');
}

/** Nom de l'événement qui demande une recherche manuelle (menu Aide, Paramètres). */
export const EVENEMENT_RECHERCHE = 'fructificare-check-update';

export function requestManualCheck() {
  window.dispatchEvent(new Event(EVENEMENT_RECHERCHE));
}

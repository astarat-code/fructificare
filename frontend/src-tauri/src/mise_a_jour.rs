// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
//! Mises à jour : recherche d'une nouvelle version, téléchargement et installation.
//!
//! C'est la SEULE partie de l'application qui se connecte à Internet. Elle lit un fichier
//! public (`latest.json`, joint à la dernière version publiée sur GitHub) et, si
//! l'utilisateur l'accepte, télécharge l'installateur correspondant. Rien n'est envoyé :
//! ni donnée du patrimoine, ni identifiant, ni statistique. Comme pour toute connexion,
//! le serveur voit l'adresse IP de l'ordinateur.
//!
//! Tout se passe ici, côté natif, et non dans la webview :
//!   - la CSP de la webview continue d'interdire toute connexion sortante ;
//!   - l'adresse interrogée est fixée dans `tauri.conf.json`, un script ne peut ni la
//!     changer ni en choisir une autre ;
//!   - l'installateur téléchargé n'est exécuté que si sa signature correspond à la clé
//!     publique embarquée dans l'application (vérification faite par le plugin).

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_updater::UpdaterExt;

/// Page de téléchargement, pour les installations qui ne se mettent pas à jour seules.
const PAGE_TELECHARGEMENT: &str = "https://github.com/astarat-code/fructificare/releases/latest";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MiseAJour {
    /// Version proposée.
    version: String,
    /// Version installée.
    courante: String,
    /// L'application peut-elle se remplacer elle-même ? Sinon, on renvoie vers la page
    /// de téléchargement.
    installable: bool,
}

/// L'application sait-elle se remplacer sur place ?
///   - Windows : oui, par l'installateur NSIS ;
///   - Linux : seulement en AppImage (un paquet .deb appartient au gestionnaire de paquets) ;
///   - macOS : non, la version publiée est une image disque non signée par Apple.
fn installable() -> bool {
    if cfg!(target_os = "windows") {
        true
    } else if cfg!(target_os = "linux") {
        std::env::var_os("APPIMAGE").is_some()
    } else {
        false
    }
}

/// Cherche une version plus récente. `None` : l'application est à jour.
#[tauri::command]
pub async fn update_check(app: AppHandle) -> Result<Option<MiseAJour>, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let trouvee = updater.check().await.map_err(|e| e.to_string())?;
    Ok(trouvee.map(|u| MiseAJour {
        version: u.version.clone(),
        courante: u.current_version.clone(),
        installable: installable(),
    }))
}

/// Télécharge la nouvelle version, vérifie sa signature, l'installe et relance
/// l'application. L'avancement est émis sur l'événement `update-progress` sous la forme
/// `[octets reçus, taille totale ou null]`.
///
/// Le frontend doit avoir enregistré les données AVANT d'appeler cette commande : sous
/// Windows, l'installateur ferme l'application dès qu'il démarre.
#[tauri::command]
pub async fn update_install(app: AppHandle) -> Result<(), String> {
    if !installable() {
        return Err("Cette installation ne se met pas à jour seule.".into());
    }
    let updater = app.updater().map_err(|e| e.to_string())?;
    let update = updater
        .check()
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Aucune mise à jour disponible.".to_string())?;

    let mut recu: u64 = 0;
    let emetteur = app.clone();
    update
        .download_and_install(
            move |morceau, total| {
                recu += morceau as u64;
                let _ = emetteur.emit("update-progress", (recu, total));
            },
            || {},
        )
        .await
        .map_err(|e| e.to_string())?;
    app.restart();
}

/// Ouvre la page de téléchargement dans le navigateur. L'adresse est fixe : la webview
/// n'a aucun moyen d'en faire ouvrir une autre (voir capabilities/default.json).
#[tauri::command]
pub fn update_open_page(app: AppHandle) -> Result<(), String> {
    app.opener()
        .open_url(PAGE_TELECHARGEMENT, None::<&str>)
        .map_err(|e| e.to_string())
}

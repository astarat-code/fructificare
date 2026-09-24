// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
//! Fructificare — Tauri entry point (desktop).
//!
//! Builds the native menu bar (File / Edit / View / Help, preceded on macOS by the
//! application menu), translated to the display language, and relays every click to the
//! frontend through the `menu-action` event (the logic — saving, theme, language,
//! navigation — lives on the React side, where the application's state is).

use tauri::menu::{Menu, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Runtime, Url, WebviewWindowBuilder};

/// Décide si une navigation de la webview est autorisée.
///
/// SÉCURITÉ (B-02) : l'interface est servie localement par Tauri ; aucune navigation
/// vers l'extérieur n'est légitime. Sans ce garde, la webview accepte n'importe quelle
/// destination — un script hostile (dépendance compromise) pourrait alors soit exfiltrer
/// des données en poussant la fenêtre vers `https://attaquant/?d=…` (la CSP ne régit pas
/// la navigation), soit remplacer l'application par une fausse page réclamant la phrase
/// secrète. Le routage interne (react-router) passe par l'API History et NE déclenche
/// pas ce handler : seules les navigations réelles sont filtrées.
fn navigation_autorisee(url: &Url) -> bool {
    match url.scheme() {
        // Origine servie par Tauri (macOS / Linux).
        "tauri" => url.host_str() == Some("localhost"),
        // Sous Windows, l'origine locale est http(s)://tauri.localhost, interceptée par
        // l'application. SANS PORT : avec un port explicite, l'interception ne s'applique
        // plus et « tauri.localhost » se résout vers la boucle locale — la requête
        // atteindrait alors n'importe quel service à l'écoute sur ce port.
        "http" | "https" => {
            let locale = url.host_str() == Some("tauri.localhost") && url.port().is_none();
            locale || serveur_de_developpement(url)
        }
        _ => false,
    }
}

/// Serveur de développement (`npm start`), autorisé uniquement dans un build de debug.
/// En version publiée, « localhost » n'a aucune raison d'être atteint.
#[cfg(debug_assertions)]
fn serveur_de_developpement(url: &Url) -> bool {
    url.host_str() == Some("localhost") && url.port() == Some(3000)
}

#[cfg(not(debug_assertions))]
fn serveur_de_developpement(_url: &Url) -> bool {
    false
}

/// Construit la barre de menu native dans la langue d'affichage.
///
/// Les identifiants d'items ne dépendent pas de la langue : le frontend les traite déjà.
fn construire_menu<R: Runtime>(handle: &AppHandle<R>, anglais: bool) -> tauri::Result<Menu<R>> {
    let l = |fr: &'static str, en: &'static str| if anglais { en } else { fr };

    // ── Fichier ────────────────────────────────────────────────────────
    #[allow(unused_mut)]
    let mut file = SubmenuBuilder::new(handle, l("Fichier", "File"))
        .item(&MenuItemBuilder::with_id("new", l("Nouveau", "New")).accelerator("CmdOrCtrl+N").build(handle)?)
        .separator()
        .item(
            &MenuItemBuilder::with_id("save", l("Sauvegarder", "Save"))
                .accelerator("CmdOrCtrl+S")
                .build(handle)?,
        )
        .item(&MenuItemBuilder::with_id("export", l("Exporter une sauvegarde…", "Export a backup…")).build(handle)?)
        .item(&MenuItemBuilder::with_id("import", l("Importer une sauvegarde…", "Import a backup…")).build(handle)?)
        .item(&MenuItemBuilder::with_id("recent-files", l("Fichiers récents…", "Recent files…")).build(handle)?)
        .separator()
        .item(&MenuItemBuilder::with_id("settings", l("Paramètres", "Settings")).build(handle)?);
    // Sur macOS, « Quitter » appartient au menu de l'application (voir plus bas).
    #[cfg(not(target_os = "macos"))]
    {
        file = file
            .separator()
            .item(&PredefinedMenuItem::quit(handle, Some(l("Quitter", "Quit")))?);
    }
    let file = file.build()?;

    // ── Éditer ─────────────────────────────────────────────────────────
    #[allow(unused_mut)]
    let mut edit = SubmenuBuilder::new(handle, l("Éditer", "Edit"));
    // La webview de macOS n'exécute ⌘Z, ⌘X, ⌘C, ⌘V et ⌘A que si le menu Édition porte ces
    // commandes : sans elles, impossible de coller une phrase secrète ou un montant.
    // Windows et Linux gèrent ces raccourcis dans la webview elle-même.
    #[cfg(target_os = "macos")]
    {
        edit = edit
            .item(&PredefinedMenuItem::undo(handle, Some(l("Annuler", "Undo")))?)
            .item(&PredefinedMenuItem::redo(handle, Some(l("Rétablir", "Redo")))?)
            .separator()
            .item(&PredefinedMenuItem::cut(handle, Some(l("Couper", "Cut")))?)
            .item(&PredefinedMenuItem::copy(handle, Some(l("Copier", "Copy")))?)
            .item(&PredefinedMenuItem::paste(handle, Some(l("Coller", "Paste")))?)
            .item(&PredefinedMenuItem::select_all(handle, Some(l("Tout sélectionner", "Select All")))?)
            .separator();
    }
    let edit = edit
        .item(&MenuItemBuilder::with_id("glossary", l("Glossaire", "Glossary")).build(handle)?)
        .build()?;

    // ── Affichage : deux sous-menus, Thèmes puis Langues ───────────────
    let themes = SubmenuBuilder::new(handle, l("Thèmes", "Themes"))
        .item(&MenuItemBuilder::with_id("theme-dark", l("Thème sombre", "Dark theme")).build(handle)?)
        .item(&MenuItemBuilder::with_id("theme-light", l("Thème clair", "Light theme")).build(handle)?)
        .build()?;
    let langues = SubmenuBuilder::new(handle, l("Langues", "Languages"))
        .item(&MenuItemBuilder::with_id("lang-fr", "Français").build(handle)?)
        .item(&MenuItemBuilder::with_id("lang-en", "English").build(handle)?)
        .build()?;
    let view = SubmenuBuilder::new(handle, l("Affichage", "View"))
        .item(&themes)
        .item(&langues)
        .build()?;

    // ── Aide ───────────────────────────────────────────────────────────
    let help = SubmenuBuilder::new(handle, l("Aide", "Help"))
        .item(&MenuItemBuilder::with_id("manual", l("Manuel d'utilisation", "User manual")).build(handle)?)
        .build()?;

    #[allow(unused_mut)]
    let mut barre = MenuBuilder::new(handle);
    // Sur macOS, le premier menu est toujours celui de l'application, titré d'après elle :
    // sans ce menu dédié, « Fichier » en prendrait la place.
    #[cfg(target_os = "macos")]
    {
        let application = SubmenuBuilder::new(handle, "Fructificare")
            .item(&PredefinedMenuItem::about(handle, Some(l("À propos de Fructificare", "About Fructificare")), None)?)
            .separator()
            .item(&PredefinedMenuItem::services(handle, Some(l("Services", "Services")))?)
            .separator()
            .item(&PredefinedMenuItem::hide(handle, Some(l("Masquer Fructificare", "Hide Fructificare")))?)
            .item(&PredefinedMenuItem::hide_others(handle, Some(l("Masquer les autres", "Hide Others")))?)
            .item(&PredefinedMenuItem::show_all(handle, Some(l("Tout afficher", "Show All")))?)
            .separator()
            .item(&PredefinedMenuItem::quit(handle, Some(l("Quitter Fructificare", "Quit Fructificare")))?)
            .build()?;
        barre = barre.item(&application);
    }
    barre.items(&[&file, &edit, &view, &help]).build()
}

/// Traduit la barre de menu quand l'utilisateur change de langue. Toute valeur autre
/// que « en » retombe sur le français : l'argument ne sert qu'à choisir des libellés fixes.
#[tauri::command]
fn set_menu_language(app: AppHandle, lang: String) -> Result<(), String> {
    let menu = construire_menu(&app, lang == "en").map_err(|e| e.to_string())?;
    app.set_menu(menu).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        // Français au démarrage ; le frontend retraduit dès que la langue du fichier est connue.
        .menu(|handle| construire_menu(handle, false))
        .invoke_handler(tauri::generate_handler![set_menu_language])
        .on_menu_event(|app, event| {
            // Relaie l'identifiant de l'item cliqué au frontend.
            let _ = app.emit("menu-action", event.id().as_ref());
        })
        .setup(|app| {
            // La fenêtre est déclarée dans tauri.conf.json avec « create: false » : on la
            // construit ici pour lui attacher le garde de navigation (voir B-02), que la
            // création automatique ne permet pas de poser.
            let config = app
                .config()
                .app
                .windows
                .first()
                .cloned()
                .expect("la fenêtre « main » doit être déclarée dans tauri.conf.json");
            let handle = app.handle().clone();
            WebviewWindowBuilder::from_config(&handle, &config)?
                .on_navigation(navigation_autorisee)
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("erreur au lancement de Fructificare");
}

#[cfg(test)]
mod tests {
    use super::navigation_autorisee;
    use tauri::Url;

    fn url(s: &str) -> Url {
        Url::parse(s).unwrap()
    }

    #[test]
    fn autorise_uniquement_l_origine_locale() {
        assert!(navigation_autorisee(&url("tauri://localhost/")));
        assert!(navigation_autorisee(&url("http://tauri.localhost/index.html")));
        assert!(navigation_autorisee(&url("https://tauri.localhost/settings")));
    }

    #[test]
    #[cfg(debug_assertions)]
    fn le_serveur_de_developpement_reste_accessible_en_debug() {
        assert!(navigation_autorisee(&url("http://localhost:3000/")));
    }

    #[test]
    fn refuse_l_exterieur_et_les_autres_schemas() {
        // Exfiltration : la donnée voyagerait dans l'URL d'un site externe.
        assert!(!navigation_autorisee(&url("https://attaquant.example/?d=patrimoine")));
        assert!(!navigation_autorisee(&url("http://evil.example/")));
        // Ouverture d'un exécutable local par la navigation.
        assert!(!navigation_autorisee(&url("file:///C:/Windows/System32/cmd.exe")));
        assert!(!navigation_autorisee(&url("mailto:x@example.com")));
    }

    #[test]
    fn pas_de_confusion_de_suffixe_sur_l_hote() {
        // Un hôte qui CONTIENT « tauri.localhost » sans lui être égal doit être refusé.
        assert!(!navigation_autorisee(&url("https://tauri.localhost.attaquant.example/")));
        assert!(!navigation_autorisee(&url("https://xtauri.localhost/")));
        assert!(!navigation_autorisee(&url("tauri://attaquant.example/")));
    }

    #[test]
    fn un_port_explicite_sort_de_l_application() {
        // Avec un port, tauri.localhost n'est plus intercepté : il vise la boucle locale.
        assert!(!navigation_autorisee(&url("http://tauri.localhost:9999/?d=patrimoine")));
        // Hors serveur de développement, aucun port de localhost n'est légitime.
        assert!(!navigation_autorisee(&url("http://localhost:9999/?d=patrimoine")));
        assert!(!navigation_autorisee(&url("http://localhost/")));
    }

    #[test]
    #[cfg(not(debug_assertions))]
    fn la_version_publiee_refuse_le_serveur_de_developpement() {
        assert!(!navigation_autorisee(&url("http://localhost:3000/")));
    }
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
//! Data folder: where automatic backups (`save/`) and imported PDFs (`documents imp/`) live.
//!
//! By default it is the application folder. At first launch — and later from
//! File > Data folder & encryption… — the user can pick another location instead; a
//! `Fructificare` subfolder is then created there.
//!
//! SECURITY: the webview's disk access is bounded by the `fs:scope` of the capability file.
//! A folder chosen by the user cannot be listed there, so it is added to the scope at
//! runtime. The choice is therefore owned by this module alone: the folder comes from a
//! native dialog opened here, the configuration file lives outside the webview's scope,
//! and no command accepts a path from the frontend. Otherwise a compromised script could
//! point the "data folder" at the user's whole profile and read it from the next launch on.

use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_fs::FsExt;
use tauri_plugin_opener::OpenerExt;

/// Fichier de configuration, dans le dossier de configuration de l'application. Il reste
/// HORS de la portée fs de la webview (seuls quelques sous-dossiers y figurent) : la
/// webview ne peut ni le lire ni le réécrire. N'ajoutez jamais « $APPDATA/** » à fs:scope —
/// sous Windows, dossier de configuration et dossier de données sont le même.
const FICHIER_CONFIG: &str = "data-folder.json";
/// Sous-dossier créé dans l'emplacement choisi par l'utilisateur.
const NOM_DOSSIER: &str = "Fructificare";
/// Sous-dossiers gérés par l'application, et eux seuls, déplacés lors d'un changement de
/// dossier (avec les anciens noms, que le frontend migre ensuite).
const SOUS_DOSSIERS: [&str; 4] = ["save", "sauvegarde", "documents imp", "documents importés"];
const DOSSIERS_SAUVEGARDES: [&str; 2] = ["save", "sauvegarde"];
const RACINES_DOCUMENTS: [&str; 2] = ["documents imp", "documents importés"];

#[derive(Default, Serialize, Deserialize)]
struct Config {
    /// `None` : dossier de l'application.
    root: Option<PathBuf>,
}

/// Dernier dossier choisi dans la boîte de dialogue native, en attente de confirmation.
/// C'est la SEULE source d'un dossier personnalisé : voir l'en-tête du module.
#[derive(Default)]
pub struct Choix(Mutex<Option<PathBuf>>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Info {
    root: PathBuf,
    default_root: PathBuf,
    custom: bool,
    /// Aucune configuration et aucune donnée : l'assistant de bienvenue doit s'ouvrir.
    first_run: bool,
    /// Faux si le dossier choisi est introuvable (disque externe débranché, par exemple).
    available: bool,
    default_has_backups: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Candidat {
    root: PathBuf,
    has_backups: bool,
    is_default: bool,
    is_current: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Bilan {
    info: Info,
    moved: usize,
    left_behind: usize,
}

#[derive(Deserialize, Clone, Copy, PartialEq, Debug)]
#[serde(rename_all = "lowercase")]
pub enum Cible {
    Choice,
    Default,
}

#[derive(Deserialize, Clone, Copy, PartialEq, Debug)]
#[serde(rename_all = "lowercase")]
pub enum Mode {
    /// Déplacer les données actuelles vers le nouveau dossier (qui n'en contient pas).
    Move,
    /// Reprendre les sauvegardes que contient déjà le nouveau dossier.
    Use,
}

// ── Emplacements ─────────────────────────────────────────────────────────────

fn dossier_application(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

fn chemin_config(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_config_dir().map_err(|e| e.to_string())?.join(FICHIER_CONFIG))
}

/// `None` si aucun choix n'a encore été fait. Un fichier illisible vaut « dossier de
/// l'application » : mieux vaut ouvrir le dossier par défaut que redemander un choix.
fn lire_config(app: &AppHandle) -> Option<Config> {
    let texte = fs::read_to_string(chemin_config(app).ok()?).ok()?;
    Some(serde_json::from_str::<Config>(&texte).unwrap_or_default())
}

fn ecrire_config(app: &AppHandle, config: &Config) -> Result<(), String> {
    let chemin = chemin_config(app)?;
    if let Some(parent) = chemin.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let texte = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    // Écriture puis renommage : une coupure ne laisse jamais un fichier à moitié écrit.
    let temporaire = chemin.with_extension("json.tmp");
    fs::write(&temporaire, texte).map_err(|e| e.to_string())?;
    fs::rename(&temporaire, &chemin).map_err(|e| e.to_string())
}

/// Dossier personnalisé enregistré, s'il est acceptable. Une configuration modifiée à la
/// main vers un chemin relatif est ignorée.
fn racine_personnalisee(config: &Option<Config>) -> Option<PathBuf> {
    config.as_ref()?.root.clone().filter(|r| chemin_acceptable(r))
}

fn racine_courante(app: &AppHandle) -> Result<PathBuf, String> {
    match racine_personnalisee(&lire_config(app)) {
        Some(racine) => Ok(racine),
        None => dossier_application(app),
    }
}

/// Absolu, et sans « .. » : `starts_with` compare des composants, pas des chemins résolus.
fn chemin_acceptable(chemin: &Path) -> bool {
    chemin.is_absolute() && !chemin.components().any(|c| matches!(c, Component::ParentDir))
}

/// Le dossier choisi reçoit un sous-dossier « Fructificare », sauf s'il en est déjà un
/// (on retrouve alors un dossier de données existant, sur une clé USB par exemple).
fn racine_pour(choisi: &Path) -> PathBuf {
    let deja = choisi
        .file_name()
        .map(|n| n.to_string_lossy().eq_ignore_ascii_case(NOM_DOSSIER))
        .unwrap_or(false);
    if deja {
        choisi.to_path_buf()
    } else {
        choisi.join(NOM_DOSSIER)
    }
}

/// L'un contient l'autre sans lui être égal : déplacer les données de l'un vers l'autre
/// reviendrait à copier un dossier dans lui-même.
fn imbriques(a: &Path, b: &Path) -> bool {
    a != b && (a.starts_with(b) || b.starts_with(a))
}

fn contient_sauvegardes(racine: &Path) -> bool {
    DOSSIERS_SAUVEGARDES.iter().any(|sous| {
        fs::read_dir(racine.join(sous))
            .map(|entrees| {
                entrees.flatten().any(|e| {
                    e.file_type().map(|t| t.is_file()).unwrap_or(false)
                        && e.file_name().to_string_lossy().to_ascii_lowercase().ends_with(".json")
                })
            })
            .unwrap_or(false)
    })
}

fn contient_donnees(racine: &Path) -> bool {
    contient_sauvegardes(racine) || RACINES_DOCUMENTS.iter().any(|d| racine.join(d).is_dir())
}

fn info(app: &AppHandle) -> Result<Info, String> {
    let defaut = dossier_application(app)?;
    let config = lire_config(app);
    let personnalisee = racine_personnalisee(&config);
    let racine = personnalisee.clone().unwrap_or_else(|| defaut.clone());
    Ok(Info {
        available: personnalisee.is_none() || racine.is_dir(),
        custom: personnalisee.is_some(),
        first_run: config.is_none() && !contient_donnees(&defaut),
        default_has_backups: contient_sauvegardes(&defaut),
        default_root: defaut,
        root: racine,
    })
}

/// Ouvre la portée fs de la webview sur le dossier personnalisé enregistré. Appelée au
/// démarrage, avant la création de la fenêtre.
pub fn autoriser_au_demarrage(app: &AppHandle) {
    if let Some(racine) = racine_personnalisee(&lire_config(app)) {
        let _ = app.fs_scope().allow_directory(&racine, true);
    }
}

// ── Déplacement ──────────────────────────────────────────────────────────────

/// Copie récursive qui n'écrase jamais rien. Les liens symboliques sont ignorés : on ne
/// recopie que ce que l'application a elle-même écrit. Renvoie les fichiers source copiés.
fn copier_arbre(source: &Path, cible: &Path, copies: &mut Vec<PathBuf>) -> io::Result<()> {
    match fs::symlink_metadata(source) {
        Ok(m) if m.is_dir() => {}
        Ok(_) => return Ok(()),
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(()),
        Err(e) => return Err(e),
    }
    fs::create_dir_all(cible)?;
    for entree in fs::read_dir(source)? {
        let entree = entree?;
        let genre = entree.file_type()?; // ne suit pas les liens
        let destination = cible.join(entree.file_name());
        if genre.is_dir() {
            copier_arbre(&entree.path(), &destination, copies)?;
        } else if genre.is_file() && !destination.exists() {
            let taille = fs::copy(entree.path(), &destination)?;
            if fs::metadata(&destination)?.len() != taille {
                return Err(io::Error::other("copie incomplète"));
            }
            copies.push(entree.path());
        }
    }
    Ok(())
}

/// Supprime les dossiers devenus vides, du plus profond au plus haut. Un dossier qui
/// contient encore un fichier (non copié, ou verrouillé) reste en place.
fn supprimer_dossiers_vides(dossier: &Path) {
    if let Ok(entrees) = fs::read_dir(dossier) {
        for entree in entrees.flatten() {
            if entree.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                supprimer_dossiers_vides(&entree.path());
            }
        }
    }
    let _ = fs::remove_dir(dossier);
}

/// Déplace les sous-dossiers gérés de `ancienne` vers `nouvelle`. Tout est copié AVANT
/// que quoi que ce soit ne soit supprimé : une erreur en route laisse les données
/// d'origine intactes. Renvoie les fichiers source copiés, à supprimer ensuite.
fn deplacer(ancienne: &Path, nouvelle: &Path) -> io::Result<Vec<PathBuf>> {
    let mut copies = Vec::new();
    for sous in SOUS_DOSSIERS {
        copier_arbre(&ancienne.join(sous), &nouvelle.join(sous), &mut copies)?;
    }
    Ok(copies)
}

fn nettoyer_ancienne(ancienne: &Path, copies: &[PathBuf]) -> usize {
    let mut restes = 0;
    for fichier in copies {
        if fs::remove_file(fichier).is_err() {
            restes += 1; // PDF ouvert dans un lecteur, par exemple : la copie existe déjà
        }
    }
    for sous in SOUS_DOSSIERS {
        supprimer_dossiers_vides(&ancienne.join(sous));
    }
    restes
}

/// Vérifie qu'on peut écrire dans le dossier avant d'y déplacer quoi que ce soit.
fn verifier_ecriture(racine: &Path) -> io::Result<()> {
    fs::create_dir_all(racine)?;
    let sonde = racine.join(".fructificare-test");
    fs::write(&sonde, b"ok")?;
    fs::remove_file(&sonde)
}

// ── Commandes ────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn data_folder_info(app: AppHandle) -> Result<Info, String> {
    info(&app)
}

/// Ouvre le sélecteur de dossier natif et retient le choix, sans rien appliquer encore.
#[tauri::command]
pub async fn data_folder_pick(
    app: AppHandle,
    choix: State<'_, Choix>,
    english: bool,
) -> Result<Option<Candidat>, String> {
    let titre = if english {
        "Where should Fructificare keep your data?"
    } else {
        "Où Fructificare doit-il ranger vos données ?"
    };
    let mut dialogue = app.dialog().file().set_title(titre);
    if let Some(fenetre) = app.get_webview_window("main") {
        dialogue = dialogue.set_parent(&fenetre);
    }
    if let Ok(documents) = app.path().document_dir() {
        dialogue = dialogue.set_directory(documents);
    }
    let (envoi, reception) = std::sync::mpsc::channel();
    dialogue.pick_folder(move |dossier| {
        let _ = envoi.send(dossier);
    });
    let choisi = tauri::async_runtime::spawn_blocking(move || reception.recv().ok().flatten())
        .await
        .map_err(|e| e.to_string())?;
    let Some(choisi) = choisi else { return Ok(None) };
    let choisi = choisi.into_path().map_err(|e| e.to_string())?;
    if !chemin_acceptable(&choisi) {
        return Err("invalid_folder".into());
    }

    let defaut = dossier_application(&app)?;
    let courante = racine_courante(&app)?;
    let racine = if choisi == defaut { defaut.clone() } else { racine_pour(&choisi) };
    if imbriques(&racine, &defaut) || imbriques(&racine, &courante) {
        return Err("nested_folder".into());
    }

    let candidat = Candidat {
        has_backups: contient_sauvegardes(&racine),
        is_default: racine == defaut,
        is_current: racine == courante,
        root: racine.clone(),
    };
    *choix.0.lock().map_err(|e| e.to_string())? = Some(racine);
    Ok(Some(candidat))
}

/// Applique le dossier choisi (ou revient au dossier de l'application) : déplace les
/// données si demandé, enregistre la configuration et ouvre la portée fs.
#[tauri::command]
pub async fn data_folder_apply(
    app: AppHandle,
    choix: State<'_, Choix>,
    target: Cible,
    mode: Mode,
) -> Result<Bilan, String> {
    let defaut = dossier_application(&app)?;
    let nouvelle = match target {
        Cible::Default => defaut.clone(),
        Cible::Choice => choix
            .0
            .lock()
            .map_err(|e| e.to_string())?
            .take()
            .ok_or("no_choice")?,
    };
    let ancienne = racine_courante(&app)?;
    let personnalisee = nouvelle != defaut;

    if mode == Mode::Move && nouvelle != ancienne && contient_sauvegardes(&nouvelle) {
        // Deux historiques mélangés : c'est la reprise (« use ») qui convient ici.
        return Err("target_has_backups".into());
    }

    // Copies et suppressions hors du fil principal : des centaines de PDF peuvent
    // prendre plusieurs secondes, la fenêtre doit rester fluide.
    let (a, n) = (ancienne.clone(), nouvelle.clone());
    let deplaces = tauri::async_runtime::spawn_blocking(move || -> io::Result<Vec<PathBuf>> {
        verifier_ecriture(&n)?;
        if mode == Mode::Move && a != n {
            return deplacer(&a, &n);
        }
        Ok(Vec::new())
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    ecrire_config(&app, &Config { root: personnalisee.then(|| nouvelle.clone()) })?;
    if personnalisee {
        app.fs_scope().allow_directory(&nouvelle, true).map_err(|e| e.to_string())?;
    }

    let moved = deplaces.len();
    let left_behind = if deplaces.is_empty() {
        0
    } else {
        tauri::async_runtime::spawn_blocking(move || nettoyer_ancienne(&ancienne, &deplaces))
            .await
            .map_err(|e| e.to_string())?
    };
    Ok(Bilan { info: info(&app)?, moved, left_behind })
}

/// Ouvre le dossier des données (ou celui des documents) dans l'explorateur de fichiers.
#[tauri::command]
pub fn data_folder_open(app: AppHandle, documents: bool) -> Result<(), String> {
    let mut dossier = racine_courante(&app)?;
    if documents {
        dossier = dossier.join(RACINES_DOCUMENTS[0]);
    }
    fs::create_dir_all(&dossier).map_err(|e| e.to_string())?;
    app.opener()
        .open_path(dossier.to_string_lossy(), None::<&str>)
        .map_err(|e| e.to_string())
}

/// Segments d'un chemin de document valide : « <racine documents>/<slug>/<fichier>.pdf ».
/// Même règle que `_relPathSegments` dans documentService.js — ce chemin vient d'une
/// sauvegarde JSON qui a pu être fabriquée par un tiers.
fn segments_document(chemin: &str) -> Option<[&str; 3]> {
    let parties: Vec<&str> = chemin.split('/').filter(|s| !s.is_empty()).collect();
    let [racine, slug, fichier] = parties[..] else { return None };
    let segment_valide = |s: &str| {
        let mut car = s.chars();
        matches!(car.next(), Some(c) if c.is_ascii_alphanumeric())
            && car.all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | ' ' | '-'))
    };
    let valide = RACINES_DOCUMENTS.contains(&racine)
        && segment_valide(slug)
        && segment_valide(fichier)
        && fichier.to_ascii_lowercase().ends_with(".pdf");
    valide.then_some([racine, slug, fichier])
}

/// Ouvre un document importé avec le lecteur PDF du système.
///
/// L'ouverture passe par ici plutôt que par la permission `opener:allow-open-path` : la
/// liste blanche de cette permission est figée à la compilation et ne peut pas désigner
/// un dossier choisi par l'utilisateur. Seul un fichier .pdf ordinaire du dossier des
/// données est ouvert (ShellExecute EXÉCUTE un .exe, un .bat ou un .lnk).
#[tauri::command]
pub fn document_open(app: AppHandle, rel_path: String) -> Result<(), String> {
    let segments = segments_document(&rel_path).ok_or("invalid_path")?;
    let chemin = segments.iter().fold(racine_courante(&app)?, |p, s| p.join(s));
    match fs::symlink_metadata(&chemin) {
        Ok(m) if m.is_file() => {}
        _ => return Err("not_found".into()),
    }
    app.opener()
        .open_path(chemin.to_string_lossy(), None::<&str>)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temporaire(nom: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("fructificare-test-{}-{nom}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn un_sous_dossier_fructificare_est_cree_sauf_s_il_existe_deja() {
        assert_eq!(racine_pour(Path::new("/media/usb")), PathBuf::from("/media/usb/Fructificare"));
        assert_eq!(racine_pour(Path::new("/media/usb/Fructificare")), PathBuf::from("/media/usb/Fructificare"));
        assert_eq!(racine_pour(Path::new("/media/usb/fructificare")), PathBuf::from("/media/usb/fructificare"));
    }

    #[test]
    fn des_dossiers_imbriques_sont_refuses() {
        let app = Path::new("/home/a/.local/share/app.fructificare.desktop");
        assert!(imbriques(&app.join("save/Fructificare"), app));
        assert!(imbriques(Path::new("/home/a/.local/share"), app));
        assert!(!imbriques(app, app));
        assert!(!imbriques(Path::new("/home/a/Documents/Fructificare"), app));
    }

    #[test]
    fn un_chemin_relatif_ou_remontant_est_refuse() {
        assert!(!chemin_acceptable(Path::new("Fructificare")));
        assert!(!chemin_acceptable(&std::env::temp_dir().join("..").join("Fructificare")));
        assert!(chemin_acceptable(&std::env::temp_dir().join("Fructificare")));
    }

    #[test]
    fn chemins_de_documents() {
        assert!(segments_document("documents imp/pea-a1b2/2026-01-05_releve.pdf").is_some());
        assert!(segments_document("documents importés/global/releve.PDF").is_some());
        for refuse in [
            "documents imp/../../evil.pdf",
            "documents imp/pea/../evil.pdf",
            "documents imp/pea/script.bat",
            "documents imp/pea/raccourci.pdf.lnk",
            "documents imp/pea/sous/releve.pdf",
            "documents imp/.cache/releve.pdf",
            "save/pea/releve.pdf",
            "documents imp/pea/C:releve.pdf",
            "documents imp/pea\\..\\evil.pdf",
        ] {
            assert!(segments_document(refuse).is_none(), "{refuse} devrait être refusé");
        }
    }

    #[test]
    fn le_deplacement_copie_tout_avant_de_supprimer_et_n_ecrase_rien() {
        let base = temporaire("deplacement");
        let (ancienne, nouvelle) = (base.join("ancienne"), base.join("nouvelle"));
        fs::create_dir_all(ancienne.join("save")).unwrap();
        fs::create_dir_all(ancienne.join("documents imp/pea-a1b2")).unwrap();
        fs::create_dir_all(ancienne.join("EBWebView")).unwrap();
        fs::write(ancienne.join("save/save-2026-09-01-1200.json"), "{}").unwrap();
        fs::write(ancienne.join("documents imp/pea-a1b2/releve.pdf"), "%PDF").unwrap();
        fs::write(ancienne.join("EBWebView/profil"), "x").unwrap();
        // Un fichier déjà présent à destination n'est pas écrasé, et sa source reste.
        fs::create_dir_all(nouvelle.join("documents imp/pea-a1b2")).unwrap();
        fs::write(nouvelle.join("documents imp/pea-a1b2/releve.pdf"), "deja").unwrap();

        let copies = deplacer(&ancienne, &nouvelle).unwrap();
        assert_eq!(copies.len(), 1);
        assert_eq!(fs::read_to_string(nouvelle.join("save/save-2026-09-01-1200.json")).unwrap(), "{}");
        assert_eq!(fs::read_to_string(nouvelle.join("documents imp/pea-a1b2/releve.pdf")).unwrap(), "deja");
        // Rien n'est supprimé tant que le nettoyage n'a pas été demandé.
        assert!(ancienne.join("save/save-2026-09-01-1200.json").exists());

        assert_eq!(nettoyer_ancienne(&ancienne, &copies), 0);
        assert!(!ancienne.join("save").exists());
        assert!(ancienne.join("documents imp/pea-a1b2/releve.pdf").exists());
        // Ce qui n'appartient pas aux sous-dossiers gérés ne bouge pas.
        assert!(ancienne.join("EBWebView/profil").exists());
        assert!(!nouvelle.join("EBWebView").exists());
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn detection_des_sauvegardes() {
        let base = temporaire("detection");
        assert!(!contient_sauvegardes(&base));
        fs::create_dir_all(base.join("save")).unwrap();
        fs::write(base.join("save/notes.txt"), "x").unwrap();
        assert!(!contient_sauvegardes(&base));
        fs::write(base.join("save/save-2026-09-01-1200.json"), "{}").unwrap();
        assert!(contient_sauvegardes(&base));
        let _ = fs::remove_dir_all(&base);
    }
}

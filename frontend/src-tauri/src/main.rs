// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
// Prevents a Windows console from opening alongside the window in release mode.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// SÉCURITÉ (B-05) — détournement de DLL, second volet.
///
/// Le drapeau `/DEPENDENTLOADFLAG` posé dans build.rs protège les DLL importées
/// STATIQUEMENT. Il ne couvre pas celles chargées plus tard, par leur nom : la
/// bibliothèque de fenêtrage (tao) charge ainsi `uxtheme.dll`, qui n'est pas une
/// « KnownDLL ». Sans cet appel, Windows la chercherait d'abord dans le dossier de
/// l'exécutable — celui de « Téléchargements » pour la version autonome — où une DLL
/// piégée du même nom serait chargée dans le processus, avec accès aux données
/// déchiffrées.
///
/// L'appel doit précéder toute création de fenêtre : c'est la première instruction
/// de `main`.
#[cfg(windows)]
fn restreindre_recherche_dll() {
    const LOAD_LIBRARY_SEARCH_SYSTEM32: u32 = 0x0000_0800;

    #[link(name = "kernel32")]
    extern "system" {
        fn SetDefaultDllDirectories(directory_flags: u32) -> i32;
    }

    // SAFETY : appel Win32 sans pointeur ni tampon ; il ne modifie que l'ordre de
    // recherche des DLL de ce processus. En cas d'échec (renvoie 0), l'ordre par défaut
    // reste en place : l'application démarre quand même, protégée par le seul drapeau
    // de build.rs pour les imports statiques.
    unsafe {
        SetDefaultDllDirectories(LOAD_LIBRARY_SEARCH_SYSTEM32);
    }
}

fn main() {
    #[cfg(windows)]
    restreindre_recherche_dll();

    fructificare_lib::run();
}

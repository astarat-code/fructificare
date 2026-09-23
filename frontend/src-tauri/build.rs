// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
fn main() {
    // SÉCURITÉ (B-05) — détournement de DLL.
    //
    // Certaines DLL importées (dwmapi.dll, bcryptprimitives.dll) sont, par défaut,
    // cherchées d'abord dans le dossier de l'exécutable AVANT System32. Une DLL piégée
    // du même nom, déposée à côté du .exe — typiquement dans « Téléchargements » —
    // serait donc chargée AU LANCEMENT, avant même main(), avec accès aux données
    // déchiffrées en mémoire.
    //
    // /DEPENDENTLOADFLAG:0x800 (LOAD_LIBRARY_SEARCH_SYSTEM32) inscrit dans l'en-tête du
    // binaire l'ordre de ne résoudre les dépendances statiques que depuis System32. Le
    // drapeau agit à la charge du binaire, là où un appel runtime (SetDefaultDllDirectories)
    // arriverait trop tard pour les imports statiques. Ne s'applique qu'aux binaires
    // (`-bins`), sur la cible MSVC de Windows.
    if std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc") {
        println!("cargo:rustc-link-arg-bins=/DEPENDENTLOADFLAG:0x800");
    }

    tauri_build::build();
}

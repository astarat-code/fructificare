// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
import { createContext, useContext, useState, useCallback, useEffect } from "react";
import translations from "../i18n";
import dataService from "../services/dataService";
import gamificationService from "../services/gamificationService";
import { systemLanguage } from "../lib/systemLanguage";

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  // Lit la langue sauvegardée dans le JSON ; au premier lancement, celle du système
  const [lang, setLangState] = useState(() => {
    try {
      return dataService.getAppPreferences().language || systemLanguage();
    } catch (_) {
      return systemLanguage();
    }
  });

  // Quand un fichier est chargé, appliquer la langue sauvegardée dedans
  useEffect(() => {
    const unsub = gamificationService.onEvent('appPreferencesLoaded', (prefs) => {
      if (prefs?.language && (prefs.language === 'fr' || prefs.language === 'en')) {
        setLangState(prefs.language);
      }
    });
    return unsub;
  }, []);

  const t = useCallback(
    (path) => {
      const keys = path.split(".");
      let val = translations[lang];
      for (const k of keys) {
        val = val?.[k];
      }
      // If key not found: return last segment of path (useful for custom asset type names)
      if (val !== undefined && val !== null && val !== '') return val;
      const lastKey = path.includes('.') ? path.split('.').pop() : path;
      return lastKey;
    },
    [lang]
  );

  // Setter public : met à jour l'état React ET persiste dans le JSON
  const setLang = useCallback((l) => {
    setLangState(l);
    try { dataService.saveAppPreferences({ language: l }); } catch (_) {}
  }, []);

  const toggleLang = () => setLang(lang === "fr" ? "en" : "fr");

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);

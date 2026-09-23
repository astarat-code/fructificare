// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * systemLanguage — display language used until the user picks one.
 *
 * French when the system's display language is French (fr, fr-FR, fr-BE, fr-CA…),
 * English for every other language: the application only exists in these two, and a
 * non-French speaker is more likely to read English than French.
 *
 * WebView2 reports the Windows display language in `navigator.language`. Only the first
 * preferred language counts: a French keyboard layout or a secondary language does not
 * make the system French.
 */
export function systemLanguage() {
  try {
    const first = (navigator.languages && navigator.languages[0]) || navigator.language || '';
    return first.toLowerCase().startsWith('fr') ? 'fr' : 'en';
  } catch (_) {
    return 'fr';
  }
}

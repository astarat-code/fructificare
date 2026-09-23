// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * GlossaryTerm.jsx — a clickable financial term that opens an explanation bubble.
 *
 * Usage:  <GlossaryTerm id="pea">PEA</GlossaryTerm>
 *         <GlossaryTerm id="plus_value" />        (the label comes from the glossary)
 *
 * The rendering depends on the display mode chosen in the Settings:
 *   • "discovery" mode (default) → the term is dotted-underlined and clickable;
 *   • "expert" mode              → the term renders as plain text, without decoration.
 *
 * In expert mode no listener and no popover are mounted: the interface stays strictly
 * identical to what it was before the glossary existed.
 */

import { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { useLanguage } from '../../context/LanguageContext';
import { getTerm } from '../../lib/glossary';
import dataService from '../../services/dataService';
import gamificationService from '../../services/gamificationService';
import { BookOpen } from 'lucide-react';

/** Mode « découverte » actif ? Défaut : oui (pensé pour le débutant). */
export function isDiscoveryMode() {
  try {
    return dataService.getAppPreferences()?.discoveryMode !== false;
  } catch (_) {
    return true;
  }
}

/**
 * Hook d'abonnement au mode d'affichage — re-rend le composant quand la
 * préférence change dans les Paramètres, sans rechargement de page.
 */
export function useDiscoveryMode() {
  const [on, setOn] = useState(isDiscoveryMode);
  useEffect(() => {
    const sync = () => setOn(isDiscoveryMode());
    const unsubs = [
      gamificationService.onEvent('preferencesUpdated', sync),
      gamificationService.onEvent('appPreferencesLoaded', sync),
    ];
    return () => unsubs.forEach(u => u());
  }, []);
  return on;
}

export default function GlossaryTerm({ id, children, className = '' }) {
  const { lang } = useLanguage();
  const discovery = useDiscoveryMode();
  const isEn = lang === 'en';
  const entry = getTerm(id);

  const label = children ?? (entry ? (isEn ? entry.termEn : entry.termFr) : id);

  // Mode expert, ou terme inconnu : rendu neutre, sans interaction.
  if (!discovery || !entry) {
    return <span className={className}>{label}</span>;
  }

  const titre  = isEn ? entry.termEn  : entry.termFr;
  const court  = isEn ? entry.shortEn : entry.shortFr;
  const detail = isEn ? entry.detailEn : entry.detailFr;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={`inline underline decoration-dotted decoration-primary/60 underline-offset-2
                      hover:decoration-primary hover:text-primary transition-colors cursor-help
                      text-left ${className}`}
          aria-label={isEn ? `Definition of ${titre}` : `Définition de ${titre}`}
          data-testid={`glossary-term-${id}`}
        >
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96 max-w-[calc(100vw-2rem)] text-base" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary shrink-0" />
            <span className="font-semibold">{titre}</span>
          </div>

          <p className="leading-relaxed">{court}</p>

          {detail && (
            <p className="text-[15px] text-muted-foreground leading-relaxed">{detail}</p>
          )}

          {entry.formula && (
            <p className="text-sm font-mono bg-muted/60 rounded px-2.5 py-2 leading-snug">
              {(isEn && entry.formulaEn) || entry.formula}
            </p>
          )}

          <p className="text-xs text-muted-foreground/70 pt-1.5 border-t border-border">
            {isEn
              ? 'Full glossary in the left menu · turn these bubbles off in Settings'
              : 'Glossaire complet dans le menu de gauche · désactivable dans les Paramètres'}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

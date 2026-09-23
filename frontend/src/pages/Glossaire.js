// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * Glossaire.js — the "Glossary" page.
 *
 * Shows every term of `lib/glossary.js`, grouped by theme, with a search field. It is the
 * unfolded version of the contextual help bubbles; both read the same source.
 */

import { useState, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import Disclaimer from '../components/ui/Disclaimer';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/switch';
import { BookOpen, Search, Sparkles } from 'lucide-react';
import { GLOSSARY, CATEGORIES, CATEGORY_ORDER } from '../lib/glossary';
import { useDiscoveryMode } from '../components/ui/GlossaryTerm';
import dataService from '../services/dataService';
import gamificationService from '../services/gamificationService';

export default function Glossaire() {
  const { lang } = useLanguage();
  const isEn = lang === 'en';
  const L = (fr, en) => (isEn ? en : fr);
  const [query, setQuery] = useState('');
  const discovery = useDiscoveryMode();

  const handleDiscoveryToggle = (on) => {
    dataService.saveAppPreferences({ discoveryMode: on });
    gamificationService.dispatchEvent('preferencesUpdated', { discoveryMode: on });
  };

  // Filtrage : le terme, la phrase courte et le détail sont tous cherchables.
  const resultats = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GLOSSARY;
    return GLOSSARY.filter(g => {
      const champs = [
        g.termFr, g.termEn, g.shortFr, g.shortEn, g.detailFr, g.detailEn,
      ].filter(Boolean).join(' ').toLowerCase();
      return champs.includes(q);
    });
  }, [query]);

  const parCategorie = useMemo(() => {
    const key = isEn ? 'termEn' : 'termFr';
    const map = {};
    CATEGORY_ORDER.forEach(c => { map[c] = []; });
    resultats.forEach(g => { (map[g.category] = map[g.category] || []).push(g); });
    Object.values(map).forEach(list =>
      list.sort((a, b) => a[key].localeCompare(b[key], isEn ? 'en' : 'fr')));
    return map;
  }, [resultats, isEn]);

  return (
    <div className="space-y-6" data-testid="glossaire-page">

      {/* ── En-tête ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-primary shrink-0" />
          <div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight">
              {L('Glossaire', 'Glossary')}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {L(`${GLOSSARY.length} termes financiers expliqués simplement`,
                 `${GLOSSARY.length} financial terms explained simply`)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Mode d'affichage ────────────────────────────────────────────── */}
      <Card className="border border-border shadow-sm">
        <CardContent className="p-4 flex items-start justify-between gap-4">
          <div className="flex gap-3 flex-1">
            <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-base font-medium">
                {L('Mode découverte', 'Discovery mode')}
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {L("Activé, les termes financiers deviennent cliquables dans toute l'application et ouvrent une bulle d'explication. Désactivez-le (mode expert) pour une interface épurée — cette page reste accessible.",
                   'When on, financial terms become clickable throughout the application and open an explanation bubble. Turn it off (expert mode) for a cleaner interface — this page stays available.')}
              </p>
              <p className="text-sm font-medium text-primary">
                {discovery
                  ? L('Actuel : découverte', 'Current: discovery')
                  : L('Actuel : expert', 'Current: expert')}
              </p>
            </div>
          </div>
          <Switch
            checked={discovery}
            onCheckedChange={handleDiscoveryToggle}
            className="shrink-0 mt-0.5"
            data-testid="glossary-discovery-switch"
          />
        </CardContent>
      </Card>

      {/* ── Recherche ───────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={L('Rechercher un terme…', 'Search a term…')}
          className="pl-9"
          data-testid="glossary-search"
        />
      </div>

      {/* ── Termes ──────────────────────────────────────────────────────── */}
      {resultats.length === 0 ? (
        <Card className="border-dashed border-2 border-border">
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">
              {L('Aucun terme ne correspond à votre recherche.', 'No term matches your search.')}
            </p>
          </CardContent>
        </Card>
      ) : (
        CATEGORY_ORDER.map(catId => {
          const entrees = parCategorie[catId] || [];
          if (entrees.length === 0) return null;
          return (
            <section key={catId} className="space-y-3">
              <h2 className="font-heading text-lg font-bold text-primary">
                {isEn ? CATEGORIES[catId].en : CATEGORIES[catId].fr}
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {entrees.map(g => (
                  <Card key={g.id} className="border border-border shadow-sm" id={`terme-${g.id}`}>
                    <CardContent className="p-5 space-y-2.5">
                      <h3 className="font-semibold text-lg">
                        {isEn ? g.termEn : g.termFr}
                      </h3>
                      <p className="text-base leading-relaxed">
                        {isEn ? g.shortEn : g.shortFr}
                      </p>
                      {(isEn ? g.detailEn : g.detailFr) && (
                        <p className="text-[15px] text-muted-foreground leading-relaxed">
                          {isEn ? g.detailEn : g.detailFr}
                        </p>
                      )}
                      {g.formula && (
                        <p className="text-sm font-mono bg-muted/60 rounded px-2.5 py-2 leading-snug">
                          {(isEn && g.formulaEn) || g.formula}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          );
        })
      )}

      <Disclaimer />
    </div>
  );
}

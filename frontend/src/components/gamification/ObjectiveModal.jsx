// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * ObjectiveModal.jsx — Modal de création / édition d'un objectif personnel
 *
 * Props :
 *   open        {boolean}       — contrôle l'ouverture
 *   onClose     {() => void}    — fermeture (annulation)
 *   objective   {object|null}   — null = création, objet existant = édition
 *   onSaved     {() => void}    — appelé après une sauvegarde réussie
 */

import { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import objectiveService, { OBJECTIVE_ICONS } from "../../services/objectiveService";
import dataService from "../../services/dataService";
import { useLanguage } from "../../context/LanguageContext";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Retourne demain au format "YYYY-MM-DD" pour l'attribut `min` du date picker. */
function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

/** Formate un nombre en euros (arrondi). */
function fmtEur(v) {
  if (!v && v !== 0) return '';
  return new Intl.NumberFormat('fr-FR', {
    style:                 'currency',
    currency:              'EUR',
    maximumFractionDigits: 0,
  }).format(v);
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT
// ═══════════════════════════════════════════════════════════════════════════════

export default function ObjectiveModal({ open, onClose, objective, onSaved }) {
  const { lang } = useLanguage();
  const L = (fr, en) => (lang === 'en' ? en : fr);
  const isEdit = !!objective;

  // ── État local ─────────────────────────────────────────────────────────────
  const [label,   setLabel]   = useState('');
  const [amount,  setAmount]  = useState('');
  const [date,    setDate]    = useState('');
  const [icon,    setIcon]    = useState('other');
  const [linked,  setLinked]  = useState(['ALL']);
  const [error,   setError]   = useState(null);
  const [saving,  setSaving]  = useState(false);

  // ── Portfolios disponibles ─────────────────────────────────────────────────
  let portfolios = [];
  try { portfolios = dataService.getPortfolios(); } catch (_) {}

  // ── Réinitialisation à l'ouverture ─────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (objective) {
      setLabel(objective.label || '');
      setAmount(String(objective.targetAmount ?? ''));
      setDate(objective.targetDate || '');
      setIcon(objective.icon || 'other');
      setLinked(objective.linkedEnvelopes || ['ALL']);
    } else {
      setLabel('');
      setAmount('');
      setDate('');
      setIcon('other');
      setLinked(['ALL']);
    }
    setError(null);
    setSaving(false);
  }, [open, objective]);

  // ── Gestion des enveloppes liées ────────────────────────────────────────────
  const isAll = linked.includes('ALL');

  function handleToggleAll() {
    if (isAll) {
      // Décocher "Total du portefeuille" → activer la sélection individuelle
      // On part d'une liste vide ; l'utilisateur choisit ensuite ses enveloppes.
      // Si aucun portfolio n'existe, on ne peut pas décocher.
      if (portfolios.length > 0) setLinked([]);
    } else {
      // Cocher "Total du portefeuille" → désélectionne tout le reste
      setLinked(['ALL']);
    }
  }

  function handleToggleEnvelope(id) {
    if (isAll) {
      // Sortir du mode ALL → sélection individuelle
      setLinked([id]);
    } else if (linked.includes(id)) {
      const next = linked.filter(x => x !== id);
      // Si on décoche tout → revenir à ALL
      setLinked(next.length > 0 ? next : ['ALL']);
    } else {
      setLinked([...linked, id]);
    }
  }

  // ── Sauvegarde ──────────────────────────────────────────────────────────────
  function handleSave() {
    setError(null);
    // Validation : au moins une enveloppe doit être sélectionnée
    if (!isEdit && !isAll && linked.length === 0) {
      setError('Sélectionnez au moins une enveloppe ou cochez "Total du portefeuille".');
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        objectiveService.updateObjective(objective.id, {
          label,
          targetAmount: amount !== '' ? parseFloat(amount) : undefined,
          targetDate:   date || null,
          icon,
        });
      } else {
        objectiveService.createObjective({
          label,
          targetAmount:    amount !== '' ? parseFloat(amount) : 0,
          linkedEnvelopes: linked,
          targetDate:      date || null,
          icon,
        });
      }
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e.message || L('Une erreur est survenue.', 'An error occurred.'));
    } finally {
      setSaving(false);
    }
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit
              ? L('✏️ Modifier l\'objectif', '✏️ Edit goal')
              : L('🎯 Nouvel objectif', '🎯 New goal')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">

          {/* ── Sélecteur d'icône ─────────────────────────────────────────── */}
          <div className="space-y-2">
            <label className="text-sm font-medium block">{L('Icône', 'Icon')}</label>
            <div className="grid grid-cols-6 gap-1.5">
              {Object.entries(OBJECTIVE_ICONS).map(([key, { emoji, label: iconLabel }]) => (
                <button
                  key={key}
                  type="button"
                  title={iconLabel}
                  onClick={() => setIcon(key)}
                  className={[
                    'flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg border text-center',
                    'transition-all duration-150',
                    icon === key
                      ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40'
                      : 'border-border hover:border-muted-foreground/60 hover:bg-accent/50',
                  ].join(' ')}
                >
                  <span className="text-xl leading-none">{emoji}</span>
                  <span className="text-[9px] text-muted-foreground leading-tight">{iconLabel}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Libellé ───────────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium block">
              {L('Libellé', 'Label')} <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              maxLength={60}
              placeholder={L("Ex : Achat d'un appartement", 'e.g. Buying an apartment')}
              autoFocus={!isEdit}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                         placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex justify-end text-[10px] text-muted-foreground">
              {label.length}/60
            </div>
          </div>

          {/* ── Montant cible ─────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium block">
              {L('Montant cible (€)', 'Target amount (€)')} <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={e => setAmount(e.target.value.replace(/,/g, '.'))}
              placeholder={L('Ex : 200 000', 'e.g. 200,000')}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                         placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {amount && parseFloat(amount) > 0 && (
              <p className="text-xs text-muted-foreground">{fmtEur(parseFloat(amount))}</p>
            )}
          </div>

          {/* ── Enveloppes liées (création uniquement) ───────────────────── */}
          {!isEdit && (
            <div className="space-y-2">
              <label className="text-sm font-medium block">
                {L('Enveloppes liées', 'Linked envelopes')} <span className="text-destructive">*</span>
              </label>
              <div className="space-y-1 max-h-44 overflow-y-auto rounded-md border border-border p-2">

                {/* Option "Total du portefeuille" */}
                <label className="flex items-center gap-2.5 cursor-pointer py-1.5 px-2 rounded
                                  hover:bg-accent text-sm select-none">
                  <input
                    type="checkbox"
                    checked={isAll}
                    onChange={handleToggleAll}
                    className="rounded shrink-0"
                  />
                  <span className="font-medium flex-1">🌐 {L('Total du portefeuille', 'Total portfolio')}</span>
                </label>

                {portfolios.length > 0 && (
                  <div className="border-t border-border/60 mt-1 pt-1 space-y-0.5">
                    {portfolios.map(p => (
                      <label
                        key={p.id}
                        className={[
                          'flex items-center gap-2.5 cursor-pointer py-1.5 px-2 rounded',
                          'hover:bg-accent text-sm select-none',
                          isAll ? 'opacity-40 pointer-events-none' : '',
                        ].join(' ')}
                      >
                        <input
                          type="checkbox"
                          checked={!isAll && linked.includes(p.id)}
                          disabled={isAll}
                          onChange={() => handleToggleEnvelope(p.id)}
                          className="rounded shrink-0"
                        />
                        <span className="flex-1 truncate">{p.name || `Enveloppe ${p.id}`}</span>
                        <span className="text-xs text-muted-foreground font-mono shrink-0">
                          {fmtEur(p.balance || 0)}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {portfolios.length === 0 && (
                  <p className="text-xs text-muted-foreground py-3 text-center">
                    {L('Aucune enveloppe trouvée. Créez-en une depuis le Tableau de bord.', 'No envelope found. Create one from the Dashboard.')}
                  </p>
                )}
              </div>
              {!isAll && linked.length === 0 && portfolios.length > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {L('Sélectionnez au moins une enveloppe ci-dessus.', 'Select at least one envelope above.')}
                </p>
              )}
              {!isAll && linked.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {L(`${linked.length} enveloppe${linked.length > 1 ? 's' : ''} sélectionnée${linked.length > 1 ? 's' : ''}.`,
                     `${linked.length} envelope${linked.length > 1 ? 's' : ''} selected.`)}
                </p>
              )}
            </div>
          )}

          {/* Message informatif en mode édition */}
          {isEdit && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
              ℹ️ {L('Les enveloppes liées ne peuvent pas être modifiées après la création.', 'Linked envelopes cannot be changed after creation.')}
            </p>
          )}

          {/* ── Date cible (optionnelle) ──────────────────────────────────── */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium block">
              {L('Date cible', 'Target date')}
              <span className="text-muted-foreground text-xs font-normal ml-1">{L('(optionnel)', '(optional)')}</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              min={getTomorrow()}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {date && (
              <p className="text-xs text-muted-foreground">
                {L('Échéance :', 'Due:')} {new Date(date).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                })}
              </p>
            )}
          </div>

          {/* ── Erreur ───────────────────────────────────────────────────── */}
          {error && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 border
                            border-destructive/30 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Boutons ───────────────────────────────────────────────────── */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              {L('Annuler', 'Cancel')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !label.trim() || !amount || (!isEdit && !isAll && linked.length === 0)}
            >
              {saving ? L('Enregistrement…', 'Saving…') : isEdit ? L('Mettre à jour', 'Update') : L("Créer l'objectif", 'Create goal')}
            </Button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}

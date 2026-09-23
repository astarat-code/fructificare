// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * RegularMovementsPanel.jsx
 *
 * Management panel for regular movements (recurring deposits / withdrawals).
 * Reachable from the dashboard and from every envelope page.
 *
 * Props:
 *   open        {boolean}     — open state
 *   onClose     {() => void}  — close
 *   portfolioId {string|null} — pre-selects an envelope (envelope page)
 *   portfolios  {Array}       — available envelopes
 *   onSaved     {() => void}  — callback after creation / edit
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button }   from './ui/button';
import { Input }    from './ui/input';
import { Label }    from './ui/label';
import { Badge }    from './ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { toast } from 'sonner';
import {
  Plus, RefreshCw, Edit2, Square, History,
  ArrowDownLeft, ArrowUpRight, Info,
  Trash2, FileText, ChevronLeft, XCircle, X,
} from 'lucide-react';
import dataService from '../services/dataService';
import { envTintBg, envTextColor, envMutedTextColor, envGainColor } from '../lib/utils';
import { useLanguage } from '../context/LanguageContext';

// ── Helpers ────────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().split('T')[0];

const fmt = (v) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v ?? 0);

const fmtDate = (iso, lang) =>
  iso ? new Date(iso + 'T12:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR') : '';

const RECURRENCE_LABELS = {
  fr: { monthly: 'Mensuelle', quarterly: 'Trimestrielle', semi_annual: 'Semestrielle', annual: 'Annuelle' },
  en: { monthly: 'Monthly',   quarterly: 'Quarterly',     semi_annual: 'Semi-annual',  annual: 'Annual'  },
};

function emptyForm(portfolioId = '') {
  return {
    portfolio_id:      portfolioId,
    type:              'deposit',
    amount:            '',
    start_date:        today(),
    recurrence:        'monthly',
    end_date:          '',
    note:              '',
    asset_type:        '',
    multi_asset:       false,
    asset_allocations: [], // [{ type: string, pct: number }] — pour multi-actifs
    fees_pct:          '', // frais de transaction appliqués à chaque occurrence
    fees_type:         'percent', // 'percent' | 'euro'
    fee_direction:     'deducted', // 'deducted' = frais déduits du montant · 'added' = en plus
    annual_fees_pct:   '', // frais annuels de gestion (accumulés selon la durée de détention)
    annual_fees_type:  'percent', // 'percent' (%/an) | 'euro' (€/an fixe)
  };
}

// ── Composant principal ────────────────────────────────────────────────────────

export default function RegularMovementsPanel({
  open,
  onClose,
  portfolioId = null,
  portfolios  = [],
  onSaved,
  dataSource  = null, // adaptateur scopé (simulation) ; défaut = dataService (tableau de bord)
  scope       = null,
  initialTab  = 'create', // onglet ouvert à l'affichage ('create' | 'history')
  // 'recurring' → panneau des mouvements récurrents (onglets Créer + Historique)
  // 'templates' → panneau des mouvements types SEUL, sans onglet (fiche enveloppe)
  mode        = 'recurring',
}) {
  // Récurrents & modèles isolés par scope (simulation vs tableau de bord)
  const ds = dataSource || dataService;
  const { lang, t } = useLanguage();
  const L = (fr, en) => (lang === 'en' ? en : fr);
  const templatesOnly = mode === 'templates';
  const [tab,         setTab]         = useState(templatesOnly ? 'templates' : initialTab);

  // À chaque ouverture, se positionner sur l'onglet demandé par l'appelant.
  useEffect(() => {
    if (open) setTab(templatesOnly ? 'templates' : initialTab);
  }, [open, initialTab, templatesOnly]);
  const [movements,   setMovements]   = useState([]);
  const [form,        setForm]        = useState(() => emptyForm(portfolioId || ''));
  const [editingId,   setEditingId]   = useState(null);

  // Mission 1 (janvier) : visite du panneau des mouvements récurrents (à l'ouverture)
  useEffect(() => {
    if (open) { try { require('../services/challengeService').default.markVisit('visitRecurring'); } catch (_) {} }
  }, [open]);
  const [stopConfirm,     setStopConfirm]     = useState(null); // id en attente de confirmation d'arrêt
  const [deleteRmConfirmId, setDeleteRmConfirmId] = useState(null); // id en attente de confirmation de suppression
  const [multiAssetModalOpen, setMultiAssetModalOpen] = useState(false); // modal répartition multi-actifs (mouvement récurrent)
  const [tplMultiAssetModalOpen, setTplMultiAssetModalOpen] = useState(false); // modal répartition multi-actifs (mouvement type)
  const [noteSyncPrompt, setNoteSyncPrompt] = useState(null); // { payload, linkedCount } — choix portée maj note
  const [editOriginalNote, setEditOriginalNote] = useState(''); // note d'origine capturée à l'ouverture de l'édition

  const [templates,         setTemplates]         = useState([]);
  const [templateSubView,   setTemplateSubView]   = useState('list'); // 'list' | 'form'
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [deleteConfirmId,   setDeleteConfirmId]   = useState(null);
  const [templateForm,      setTemplateForm]      = useState({
    name:              '',
    portfolio_id:      portfolioId || '',
    asset_type:        'autre',
    multi_asset:       false,
    asset_allocations: [],
    fees_pct:          '0',
    fees_type:         'percent',
    fee_direction:     'deducted',
    annual_fees_pct:   '0',
    annual_fees_type:  'percent',
  });
  // Sélection transitoire de l'import « mouvement type » dans le formulaire récurrent
  const [importTplId, setImportTplId] = useState('');

  // ── Chargement ──────────────────────────────────────────────────────────────
  const refreshList = () => setMovements(ds.getRegularMovements());

  useEffect(() => {
    if (open) {
      refreshList();
      refreshTemplates();
      if (!editingId) {
        setForm(emptyForm(portfolioId || ''));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, portfolioId]);

  // ── Sauvegarde ──────────────────────────────────────────────────────────────
  // Exécute réellement la sauvegarde. noteScope : 'future' | 'all' | null
  // (null = pas de propagation de note aux occurrences existantes).
  const _commitSave = (payload, noteScope) => {
    try {
      if (editingId) {
        ds.updateRegularMovement(editingId, payload);
        if (noteScope) ds.applyNoteToRecurringOccurrences(editingId, payload.note, noteScope);
        toast.success(L('Mouvement régulier modifié', 'Regular movement updated'));
      } else {
        ds.createRegularMovement(payload);
        toast.success(L('Mouvement régulier créé', 'Regular movement created'));
      }
      refreshList();
      onSaved?.();
      setEditingId(null);
      setEditOriginalNote('');
      setForm(emptyForm(portfolioId || ''));
      setNoteSyncPrompt(null);
      setTab('history');
    } catch (e) {
      toast.error(e.message || L('Erreur lors de la sauvegarde', 'Error while saving'));
    }
  };

  const handleSave = () => {
    if (!form.portfolio_id) { toast.error(L('Sélectionnez une enveloppe ou le compte chèque', 'Select an envelope or the current account')); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error(L('Montant invalide', 'Invalid amount')); return; }
    if (!form.start_date) { toast.error(L('Date de début requise', 'Start date required')); return; }

    const payload = {
      portfolio_id:      form.portfolio_id,
      type:              form.type,
      amount:            parseFloat(form.amount),
      start_date:        form.start_date,
      recurrence:        form.recurrence,
      end_date:          form.end_date || null,
      note:              form.note   || null,
      asset_types:       form.multi_asset
                           ? form.asset_allocations.map(a => a.type)
                           : (form.asset_type ? [form.asset_type] : []),
      asset_allocations: form.multi_asset ? form.asset_allocations : [],
      fees_pct:          parseFloat(String(form.fees_pct).replace(',', '.')) || 0,
      fees_type:         form.fees_type === 'euro' ? 'euro' : 'percent',
      fee_direction:     form.fee_direction === 'added' ? 'added' : 'deducted',
      annual_fees_pct:   parseFloat(String(form.annual_fees_pct).replace(',', '.')) || 0,
      annual_fees_type:  form.annual_fees_type === 'euro' ? 'euro' : 'percent',
    };

    // Édition : le modal de portée ne se déclenche QUE si, à la sauvegarde,
    // le contenu de la note diffère réellement de la note d'origine (capturée
    // à l'ouverture du formulaire) ET que des occurrences sont déjà enregistrées.
    // Jamais à l'ouverture du formulaire, au focus du champ ou pendant la saisie.
    if (editingId) {
      const noteChanged = (editOriginalNote || '').trim() !== (form.note || '').trim();
      if (noteChanged) {
        const linked = getLinkedTxInfo(editingId);
        if (linked.count > 0) {
          setNoteSyncPrompt({ payload, linkedCount: linked.count });
          return;
        }
      }
    }

    // Note inchangée (ou aucune occurrence) → sauvegarde silencieuse
    _commitSave(payload, null);
  };

  // ── Modifier ────────────────────────────────────────────────────────────────
  const handleEdit = (rm) => {
    setEditingId(rm.id);
    setEditOriginalNote(rm.note || ''); // référence pour détecter un vrai changement de note
    const hasAllocations = (rm.asset_allocations?.length || 0) > 0;
    setForm({
      portfolio_id:      rm.portfolio_id,
      type:              rm.type,
      amount:            String(rm.amount),
      start_date:        rm.start_date,
      recurrence:        rm.recurrence,
      end_date:          rm.end_date || '',
      note:              rm.note    || '',
      asset_type:        hasAllocations ? '' : (rm.asset_types?.[0] || ''),
      multi_asset:       hasAllocations || (rm.asset_types?.length || 0) > 1,
      asset_allocations: rm.asset_allocations || [],
      fees_pct:          rm.fees_pct ? String(rm.fees_pct) : '',
      fees_type:         rm.fees_type === 'euro' ? 'euro' : 'percent',
      fee_direction:     rm.fee_direction === 'added' ? 'added' : 'deducted',
      annual_fees_pct:   rm.annual_fees_pct ? String(rm.annual_fees_pct) : '',
      annual_fees_type:  rm.annual_fees_type === 'euro' ? 'euro' : 'percent',
    });
    setTab('create');
  };

  // ── Arrêter ─────────────────────────────────────────────────────────────────
  const handleStop = (id) => {
    try {
      ds.stopRegularMovement(id);
      toast.success(L('Mouvement régulier arrêté', 'Regular movement stopped'));
      refreshList();
      onSaved?.();
      setStopConfirm(null);
    } catch (e) {
      toast.error(e.message);
    }
  };

  // ── Supprimer définitivement (mouvements arrêtés) — avec cascade ───────────
  const handleDeleteRm = (id) => {
    try {
      const { deletedTxCount } = ds.deleteRegularMovement(id);
      const msg = deletedTxCount > 0
        ? L(`Mouvement supprimé (${deletedTxCount} transaction${deletedTxCount > 1 ? 's' : ''} retirée${deletedTxCount > 1 ? 's' : ''} de l'historique)`,
            `Movement deleted (${deletedTxCount} transaction${deletedTxCount > 1 ? 's' : ''} removed from history)`)
        : L('Mouvement régulier supprimé', 'Regular movement deleted');
      toast.success(msg);
      refreshList();
      onSaved?.();
      setDeleteRmConfirmId(null);
    } catch (e) {
      toast.error(e.message);
    }
  };

  // ── Transactions liées à un mouvement récurrent (compte + montant cumulé) ────
  const getLinkedTxInfo = (rmId) => {
    try {
      const txs = ds.getAllTransactions().filter(tx => tx.from_recurring_id === rmId);
      const totalAmount = txs.reduce((sum, tx) => sum + Math.abs(tx.net_amount ?? tx.amount ?? 0), 0);
      return { count: txs.length, totalAmount };
    } catch (_) {
      return { count: 0, totalAmount: 0 };
    }
  };

  // ── Annuler la modification ─────────────────────────────────────────────────
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditOriginalNote('');
    setForm(emptyForm(portfolioId || ''));
  };

  // ── Importer un mouvement type dans le formulaire récurrent ─────────────────
  // Pré-remplit le type d'actif (ou la répartition multi-actifs) et, à défaut,
  // la note à partir du modèle. Le montant, le sens (versement/retrait) et la
  // récurrence ne sont pas portés par le modèle et restent à la main de l'utilisateur.
  const handleImportTemplate = (tplId) => {
    const tpl = templates.find((t) => t.id === tplId);
    if (!tpl) return;
    const allocs  = Array.isArray(tpl.multi_asset_allocations) ? tpl.multi_asset_allocations : [];
    const isMulti = allocs.length > 0;
    setForm((f) => ({
      ...f,
      note:              f.note?.trim() ? f.note : (tpl.name || ''),
      multi_asset:       isMulti,
      asset_type:        isMulti ? '' : (tpl.asset_type || ''),
      asset_allocations: isMulti ? allocs.map((a) => ({ type: a.type, pct: a.pct })) : [],
      // Reprendre les frais de transaction du modèle
      fees_pct:          (tpl.fees_pct ?? '') !== '' ? String(tpl.fees_pct) : f.fees_pct,
      fees_type:         tpl.fees_type === 'euro' ? 'euro' : 'percent',
      fee_direction:     tpl.fee_direction === 'added' ? 'added' : 'deducted',
      // Reprendre les frais annuels du modèle
      annual_fees_pct:   (tpl.annual_fees_pct ?? '') !== '' ? String(tpl.annual_fees_pct) : f.annual_fees_pct,
      annual_fees_type:  tpl.annual_fees_type === 'euro' ? 'euro' : 'percent',
    }));
    toast.success(L(`Modèle « ${tpl.name} » importé`, `Template “${tpl.name}” imported`));
  };

  // ── Handlers mouvements types ───────────────────────────────────────────────
  const refreshTemplates = () => setTemplates(ds.getAllMovementTemplates());

  const emptyTemplateForm = () => ({
    name:              '',
    portfolio_id:      portfolioId || '',
    asset_type:        'autre',
    multi_asset:       false,
    asset_allocations: [],
    fees_pct:          '0',
    fees_type:         'percent',
    fee_direction:     'deducted',
    annual_fees_pct:   '0',
    annual_fees_type:  'percent',
  });

  // Même liste et mêmes libellés que le formulaire de mouvement (dataService.ASSET_TYPES).
  const ASSET_TYPE_LABELS = Object.fromEntries(
    dataService.ASSET_TYPES.map(type => [type, t(`assetTypes.${type}`)]),
  );

  const handleSaveTemplate = () => {
    if (!templateForm.name.trim())       { toast.error(L('Nom requis', 'Name required'));            return; }
    if (!templateForm.portfolio_id)      { toast.error(L('Enveloppe requise', 'Envelope required'));     return; }
    if (!templateForm.multi_asset && !templateForm.asset_type) { toast.error(L("Type d'actif requis", 'Asset type required')); return; }
    if (templateForm.multi_asset) {
      const total = templateForm.asset_allocations.reduce((s, a) => s + (parseFloat(a.pct) || 0), 0);
      if (templateForm.asset_allocations.length === 0) { toast.error(L("Configurez au moins un type d'actif", 'Configure at least one asset type')); return; }
      if (Math.abs(total - 100) >= 0.01)               { toast.error(L('La répartition doit totaliser 100 %', 'Allocation must total 100%')); return; }
    }
    const payload = {
      name:            templateForm.name.trim(),
      portfolio_id:    templateForm.portfolio_id,
      asset_type:      templateForm.multi_asset ? null : templateForm.asset_type,
      multi_asset_allocations: templateForm.multi_asset ? templateForm.asset_allocations : null,
      fees_pct:        parseFloat(templateForm.fees_pct) || 0,
      fees_type:       templateForm.fees_type,
      fee_direction:   templateForm.fee_direction === 'added' ? 'added' : 'deducted',
      annual_fees_pct: parseFloat(templateForm.annual_fees_pct) || 0,
      annual_fees_type: templateForm.annual_fees_type === 'euro' ? 'euro' : 'percent',
    };
    try {
      if (editingTemplateId) {
        ds.updateMovementTemplate(editingTemplateId, payload);
        toast.success(L('Modèle modifié', 'Template updated'));
      } else {
        ds.createMovementTemplate(payload);
        toast.success(L('Modèle créé', 'Template created'));
      }
      refreshTemplates();
      onSaved?.();
      setEditingTemplateId(null);
      setTemplateForm(emptyTemplateForm());
      setTemplateSubView('list');
    } catch (e) {
      toast.error(e.message || L('Erreur', 'Error'));
    }
  };

  const handleEditTemplate = (tpl) => {
    setEditingTemplateId(tpl.id);
    setTemplateForm({
      name:              tpl.name,
      portfolio_id:      tpl.portfolio_id,
      asset_type:        tpl.asset_type || 'autre',
      multi_asset:       !!(tpl.multi_asset_allocations?.length),
      asset_allocations: tpl.multi_asset_allocations || [],
      fees_pct:          String(tpl.fees_pct ?? 0),
      fees_type:         tpl.fees_type === 'euro' ? 'euro' : 'percent',
      fee_direction:     tpl.fee_direction === 'added' ? 'added' : 'deducted',
      annual_fees_pct:   String(tpl.annual_fees_pct ?? 0),
      annual_fees_type:  tpl.annual_fees_type === 'euro' ? 'euro' : 'percent',
    });
    setTemplateSubView('form');
  };

  const handleDeleteTemplate = (id) => {
    try {
      ds.deleteMovementTemplate(id);
      toast.success(L('Modèle supprimé', 'Template deleted'));
      refreshTemplates();
      onSaved?.();
      setDeleteConfirmId(null);
    } catch (e) {
      toast.error(e.message || L('Erreur', 'Error'));
    }
  };

  // ── Fermeture du panneau ────────────────────────────────────────────────────
  const handleClose = () => {
    handleCancelEdit();
    setTemplateSubView('list');
    setEditingTemplateId(null);
    setTemplateForm(emptyTemplateForm());
    setDeleteConfirmId(null);
    onClose();
  };

  // ── Validation du formulaire récurrent ──────────────────────────────────────
  // Les 5 champs obligatoires : enveloppe, type, montant > 0, date de début, récurrence.
  // La date de fin et la note sont optionnelles.
  const isFormValid =
    !!form.portfolio_id &&
    !!form.type &&
    !!form.amount && parseFloat(form.amount) > 0 &&
    !!form.start_date &&
    !!form.recurrence;

  // ── Liste triée : mouvements EN COURS d'abord, terminés en dessous, puis par
  //    date de début décroissante. « Terminé » = arrêté manuellement OU date de fin
  //    dépassée (même règle que l'affichage) → un mouvement auquel on ajoute une date
  //    de fin passée bascule automatiquement sous les mouvements en cours.
  const _isDone = (rm) => rm.status === 'stopped' || (!!rm.end_date && rm.end_date < today());
  const sortedMovements = [...movements].sort((a, b) => {
    const da = _isDone(a), db = _isDone(b);
    if (da !== db) return da ? 1 : -1;
    return b.start_date.localeCompare(a.start_date);
  });

  const activeCount = movements.filter(rm => rm.status === 'active').length;

  // ── Rendu ───────────────────────────────────────────────────────────────────
  return (
    <>
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            {templatesOnly
              ? <><FileText  className="w-5 h-5 text-primary" />{L('Mouvements types', 'Movement templates')}</>
              : <><RefreshCw className="w-5 h-5 text-primary" />{L('Mouvements récurrents', 'Recurring movements')}</>}
          </DialogTitle>
          <DialogDescription>
            {templatesOnly
              ? L('Créez des modèles réutilisables pour saisir vos mouvements plus vite.', 'Create reusable templates to record your movements faster.')
              : L('Gérez vos versements et retraits récurrents sur vos enveloppes.', 'Manage your recurring deposits and withdrawals on your envelopes.')}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          {/* Panneau « mouvements types » : ouvert seul depuis la fiche enveloppe,
              sans onglet — les deux notions sont indépendantes. */}
          {!templatesOnly && (
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">
                {editingId
                  ? <><Edit2 className="w-3.5 h-3.5 mr-1.5" />{L('Modifier', 'Edit')}</>
                  : <><Plus  className="w-3.5 h-3.5 mr-1.5" />{L('Créer un récurrent', 'New recurring')}</>
                }
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="w-3.5 h-3.5 mr-1.5" />
                {L('Historique', 'History')}
                {activeCount > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                    {activeCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              ONGLET MOUVEMENTS TYPES
          ══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="templates" className="mt-4">
            {templateSubView === 'list' ? (
              /* ── Liste ── */
              <div className="space-y-3">
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => { setEditingTemplateId(null); setTemplateForm(emptyTemplateForm()); setTemplateSubView('form'); }}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    {L('Créer un modèle', 'New template')}
                  </Button>
                </div>

                {templates.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>{L('Aucun mouvement type créé.', 'No template created yet.')}</p>
                    <Button variant="link" className="mt-1" onClick={() => setTemplateSubView('form')}>
                      {L('Créer le premier', 'Create the first one')}
                    </Button>
                  </div>
                ) : (
                  templates.map((tpl) => {
                    const portfolio = portfolios.find((p) => p.id === tpl.portfolio_id);
                    return (
                      <div
                        key={tpl.id}
                        className="rounded-lg border bg-card p-4 space-y-2"
                        // Ligne pleine dans la couleur de l'enveloppe liée + texte à contraste auto
                        style={{ backgroundColor: envTintBg(portfolio?.color || '#94A3B8'), color: envTextColor(portfolio?.color || '#94A3B8') }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{tpl.name}</p>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {portfolio && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {portfolio.name}
                                </Badge>
                              )}
                              {tpl.asset_type && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {ASSET_TYPE_LABELS[tpl.asset_type] || tpl.asset_type}
                                </Badge>
                              )}
                              {tpl.multi_asset_allocations?.length > 0 && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {L('Multi-actifs', 'Multi-asset')}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs mt-1" style={{ color: envMutedTextColor(portfolio?.color || '#94A3B8') }}>
                              {L('Frais versement :', 'Deposit fees:')} {tpl.fees_pct ?? 0} {tpl.fees_type === 'euro' ? '€' : '%'} · {L('Frais annuels :', 'Annual fees:')} {tpl.annual_fees_pct ?? 0} {tpl.annual_fees_type === 'euro' ? '€' : '%'}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditTemplate(tpl)} title={L('Modifier', 'Edit')}>
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            {deleteConfirmId === tpl.id ? (
                              <div className="flex items-center gap-1">
                                <Button size="sm" className="h-7 text-xs px-2 bg-rose-600 hover:bg-rose-700 text-white" onClick={() => handleDeleteTemplate(tpl.id)}>
                                  {L('Supprimer', 'Delete')}
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setDeleteConfirmId(null)}>
                                  {L('Annuler', 'Cancel')}
                                </Button>
                              </div>
                            ) : (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-600" onClick={() => setDeleteConfirmId(tpl.id)} title={L('Supprimer', 'Delete')}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              /* ── Formulaire ── */
              <div className="space-y-4">
                <Button variant="ghost" size="sm" className="mb-2 -ml-2 text-muted-foreground" onClick={() => { setTemplateSubView('list'); setEditingTemplateId(null); }}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  {L('Retour à la liste', 'Back to list')}
                </Button>

                {/* Nom */}
                <div>
                  <Label>{L('Nom du mouvement', 'Movement name')} *</Label>
                  <Input
                    placeholder={L('Ex : Versement ETF World mensuel', 'e.g. Monthly World ETF deposit')}
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  />
                </div>

                {/* Enveloppe */}
                <div>
                  <Label>{L('Enveloppe liée', 'Linked envelope')} *</Label>
                  <Select
                    value={templateForm.portfolio_id}
                    onValueChange={(v) => setTemplateForm({ ...templateForm, portfolio_id: v })}
                    disabled={!!portfolioId}
                  >
                    <SelectTrigger><SelectValue placeholder={L('Sélectionner une enveloppe…', 'Select an envelope…')} /></SelectTrigger>
                    <SelectContent>
                      {portfolios.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Multi-actifs */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="checkbox"
                      id="multi-asset"
                      checked={templateForm.multi_asset}
                      onChange={(e) => setTemplateForm({ ...templateForm, multi_asset: e.target.checked, asset_allocations: e.target.checked ? templateForm.asset_allocations : [] })}
                      className="w-4 h-4 rounded border-border"
                    />
                    <Label htmlFor="multi-asset" className="cursor-pointer font-normal">
                      {L("Types d'actifs multiples", 'Multiple asset types')}
                    </Label>
                    {templateForm.multi_asset && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs ml-1"
                        onClick={() => setTplMultiAssetModalOpen(true)}
                      >
                        {L('Configurer', 'Configure')} ({templateForm.asset_allocations.length} {L('type', 'type')}{templateForm.asset_allocations.length !== 1 ? 's' : ''})
                      </Button>
                    )}
                  </div>
                  {/* Résumé de la répartition */}
                  {templateForm.multi_asset && templateForm.asset_allocations.length > 0 && (() => {
                    const total = templateForm.asset_allocations.reduce((s, a) => s + (parseFloat(a.pct) || 0), 0);
                    return (
                      <p className={`text-xs ml-6 ${Math.abs(total - 100) < 0.01 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {templateForm.asset_allocations.map(a => `${ASSET_TYPE_LABELS[a.type] || a.type} ${a.pct} %`).join(' · ')}
                        {Math.abs(total - 100) >= 0.01 && L(` — total ${total.toFixed(0)} % (doit être 100 %)`, ` — total ${total.toFixed(0)}% (must be 100%)`)}
                      </p>
                    );
                  })()}
                </div>

                {/* Type d'actif (si pas multi) */}
                {!templateForm.multi_asset && (
                  <div>
                    <Label>{L("Type d'actif", 'Asset type')} *</Label>
                    <Select
                      value={templateForm.asset_type}
                      onValueChange={(v) => setTemplateForm({ ...templateForm, asset_type: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(ASSET_TYPE_LABELS).map(([val, lbl]) => (
                          <SelectItem key={val} value={val}>{lbl}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Frais */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{templateForm.fees_type === 'euro' ? L('Frais de versement/retrait (€)', 'Deposit/withdrawal fees (€)') : L('Frais de versement/retrait (%)', 'Deposit/withdrawal fees (%)')}</Label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number" min="0" step="0.01" placeholder="0"
                        value={templateForm.fees_pct}
                        onChange={(e) => setTemplateForm({ ...templateForm, fees_pct: e.target.value })}
                        className="flex-1 min-w-0"
                      />
                      <div className="flex rounded-md border border-input overflow-hidden shrink-0 h-9">
                        <button type="button" onClick={() => setTemplateForm({ ...templateForm, fees_type: 'percent' })} className={`px-2 text-sm ${templateForm.fees_type !== 'euro' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>%</button>
                        <button type="button" onClick={() => setTemplateForm({ ...templateForm, fees_type: 'euro' })} className={`px-2 text-sm ${templateForm.fees_type === 'euro' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>€</button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label>{templateForm.annual_fees_type === 'euro' ? L('Frais annuels (€)', 'Annual fees (€)') : L('Frais annuels (%)', 'Annual fees (%)')}</Label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number" min="0" step="0.01" placeholder="0"
                        value={templateForm.annual_fees_pct}
                        onChange={(e) => setTemplateForm({ ...templateForm, annual_fees_pct: e.target.value })}
                        className="flex-1 min-w-0"
                      />
                      <div className="flex rounded-md border border-input overflow-hidden shrink-0 h-9">
                        <button type="button" onClick={() => setTemplateForm({ ...templateForm, annual_fees_type: 'percent' })} className={`px-2 text-sm ${templateForm.annual_fees_type !== 'euro' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>%</button>
                        <button type="button" onClick={() => setTemplateForm({ ...templateForm, annual_fees_type: 'euro' })} className={`px-2 text-sm ${templateForm.annual_fees_type === 'euro' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>€</button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sens des frais (déduits / ajoutés) */}
                <div>
                  <div className="flex rounded-md border border-input overflow-hidden text-xs">
                    <button type="button" onClick={() => setTemplateForm({ ...templateForm, fee_direction: 'deducted' })} className={`flex-1 px-2 py-1.5 ${templateForm.fee_direction !== 'added' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>
                      {L('Frais déduits du montant', 'Fees deducted from amount')}
                    </button>
                    <button type="button" onClick={() => setTemplateForm({ ...templateForm, fee_direction: 'added' })} className={`flex-1 px-2 py-1.5 border-l border-input ${templateForm.fee_direction === 'added' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>
                      {L('Frais ajoutés au montant', 'Fees added to amount')}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {templateForm.fee_direction === 'added'
                      ? L("Les frais s'ajoutent au montant total sorti ou entré.", 'Fees are added on top of the total amount out or in.')
                      : L('Les frais sont prélevés sur le montant reçu ou envoyé.', 'Fees are taken from the amount received or sent.')}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => { setTemplateSubView('list'); setEditingTemplateId(null); }}>
                    {L('Annuler', 'Cancel')}
                  </Button>
                  <Button
                    onClick={handleSaveTemplate}
                    disabled={!templateForm.name.trim() || !templateForm.portfolio_id}
                    className="flex-1"
                  >
                    {editingTemplateId ? L('Enregistrer les modifications', 'Save changes') : L('Créer le modèle', 'Create template')}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════════════
              ONGLET 1 — FORMULAIRE
          ══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="create" className="mt-4 space-y-4">

            {/* Enveloppe */}
            <div>
              <Label>{L('Enveloppe', 'Envelope')} *</Label>
              <Select
                value={form.portfolio_id}
                onValueChange={(v) => setForm({ ...form, portfolio_id: v })}
                disabled={!!portfolioId} // verrouillé si ouvert depuis une enveloppe
              >
                <SelectTrigger>
                  <SelectValue placeholder={L('Sélectionner une enveloppe…', 'Select an envelope…')} />
                </SelectTrigger>
                <SelectContent>
                  {/* Les dépenses courantes « Compte chèque » sont désormais gérées
                      exclusivement dans l'onglet Budget du calendrier. */}
                  {portfolios.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type : Versement / Retrait */}
            <div>
              <Label>{L('Type', 'Type')} *</Label>
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, type: 'deposit' })}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border text-sm font-medium transition-colors ${
                    form.type === 'deposit'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-transparent border-border text-muted-foreground hover:bg-accent'
                  }`}
                >
                  <ArrowDownLeft className="w-4 h-4" /> {L('Versement', 'Deposit')}
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, type: 'withdrawal' })}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border text-sm font-medium transition-colors ${
                    form.type === 'withdrawal'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-transparent border-border text-muted-foreground hover:bg-accent'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4" /> {L('Retrait', 'Withdrawal')}
                </button>
              </div>
            </div>

            {/* Montant + Frais de transaction */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>{L('Montant (€)', 'Amount (€)')} *</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder={L('Ex : 200', 'e.g. 200')}
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div>
                <Label>{form.fees_type === 'euro' ? L('Frais de transaction (€)', 'Transaction fees (€)') : L('Frais de transaction (%)', 'Transaction fees (%)')}</Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number" min="0" step="0.01" placeholder="0"
                    value={form.fees_pct}
                    onChange={(e) => setForm({ ...form, fees_pct: e.target.value })}
                    className="flex-1 min-w-0"
                  />
                  <div className="flex rounded-md border border-input overflow-hidden shrink-0 h-9">
                    <button type="button" onClick={() => setForm({ ...form, fees_type: 'percent' })} className={`px-2 text-sm ${form.fees_type !== 'euro' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>%</button>
                    <button type="button" onClick={() => setForm({ ...form, fees_type: 'euro' })} className={`px-2 text-sm ${form.fees_type === 'euro' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>€</button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">{L('Appliqués à chaque occurrence.', 'Applied to each occurrence.')}</p>
              </div>
            </div>

            {/* Sens des frais (déduits / ajoutés) */}
            <div>
              <div className="flex rounded-md border border-input overflow-hidden text-xs">
                <button type="button" onClick={() => setForm({ ...form, fee_direction: 'deducted' })} className={`flex-1 px-2 py-1.5 ${form.fee_direction !== 'added' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>
                  {L('Frais déduits du montant', 'Fees deducted from amount')}
                </button>
                <button type="button" onClick={() => setForm({ ...form, fee_direction: 'added' })} className={`flex-1 px-2 py-1.5 border-l border-input ${form.fee_direction === 'added' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>
                  {L('Frais ajoutés au montant', 'Fees added to amount')}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {form.fee_direction === 'added'
                  ? L("Les frais s'ajoutent au montant total sorti ou entré.", 'Fees are added on top of the total amount out or in.')
                  : L('Les frais sont prélevés sur le montant reçu ou envoyé.', 'Fees are taken from the amount received or sent.')}
              </p>
            </div>

            {/* Frais annuels de gestion */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>{form.annual_fees_type === 'euro' ? L('Frais annuels (€)', 'Annual fees (€)') : L('Frais annuels (%)', 'Annual fees (%)')}</Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number" min="0" step="0.01" placeholder="0"
                    value={form.annual_fees_pct}
                    onChange={(e) => setForm({ ...form, annual_fees_pct: e.target.value })}
                    className="flex-1 min-w-0"
                  />
                  <div className="flex rounded-md border border-input overflow-hidden shrink-0 h-9">
                    <button type="button" onClick={() => setForm({ ...form, annual_fees_type: 'percent' })} className={`px-2 text-sm ${form.annual_fees_type !== 'euro' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>%</button>
                    <button type="button" onClick={() => setForm({ ...form, annual_fees_type: 'euro' })} className={`px-2 text-sm ${form.annual_fees_type === 'euro' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}>€</button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">{L('Ajoutés aux frais de l’enveloppe (accumulés selon la durée de détention).', 'Added to the envelope fees (accrued over the holding period).')}</p>
              </div>
            </div>

            {/* Date de début + Récurrence */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>{L('Date de début', 'Start date')} *</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>{L('Récurrence', 'Recurrence')} *</Label>
                <Select
                  value={form.recurrence}
                  onValueChange={(v) => setForm({ ...form, recurrence: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">{RECURRENCE_LABELS[lang === 'en' ? 'en' : 'fr'].monthly}</SelectItem>
                    <SelectItem value="quarterly">{RECURRENCE_LABELS[lang === 'en' ? 'en' : 'fr'].quarterly}</SelectItem>
                    <SelectItem value="semi_annual">{RECURRENCE_LABELS[lang === 'en' ? 'en' : 'fr'].semi_annual}</SelectItem>
                    <SelectItem value="annual">{RECURRENCE_LABELS[lang === 'en' ? 'en' : 'fr'].annual}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date de fin */}
            <div>
              <Label>
                {L('Date de fin', 'End date')}{' '}
                <span className="text-muted-foreground font-normal">{L('(optionnel)', '(optional)')}</span>
              </Label>
              <Input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
              {!form.end_date && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  {L('Aucune — reconduit automatiquement selon la récurrence', 'None — renewed automatically per the recurrence')}
                </p>
              )}
            </div>

            {/* Note */}
            <div>
              <Label>
                {L('Note', 'Note')}{' '}
                <span className="text-muted-foreground font-normal">{L('(optionnel, max 200 car.)', '(optional, max 200 chars.)')}</span>
              </Label>
              <Input
                type="text"
                maxLength={200}
                placeholder={L('Ex : Épargne programmée mensuelle', 'e.g. Monthly scheduled savings')}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>

            {/* Type d'actif — optionnel, masqué pour Compte chèque */}
            {form.portfolio_id && form.portfolio_id !== 'compte_cheque' && (
              <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {L("Type d'actif", 'Asset type')}{' '}
                  <span className="normal-case font-normal">{L('(optionnel)', '(optional)')}</span>
                </p>

                {/* Importer un mouvement type — pré-remplit le type d'actif / la répartition multi-actifs */}
                {(() => {
                  const importable = templates.filter((t) => t.portfolio_id === form.portfolio_id);
                  if (importable.length === 0) return null;
                  return (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Label className="font-normal text-sm text-muted-foreground whitespace-nowrap">
                        <FileText className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                        {L('Importer un mouvement type', 'Import a template')}
                      </Label>
                      <Select
                        value={importTplId}
                        onValueChange={(v) => { handleImportTemplate(v); setImportTplId(''); }}
                      >
                        <SelectTrigger className="h-8 text-xs flex-1 min-w-[160px]">
                          <SelectValue placeholder={L('Choisir un modèle…', 'Choose a template…')} />
                        </SelectTrigger>
                        <SelectContent>
                          {importable.map((tpl) => (
                            <SelectItem key={tpl.id} value={tpl.id}>
                              {tpl.name}
                              {tpl.multi_asset_allocations?.length
                                ? L(' · multi-actifs', ' · multi-asset')
                                : (tpl.asset_type ? ` · ${ASSET_TYPE_LABELS[tpl.asset_type] || tpl.asset_type}` : '')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })()}

                {/* Multi-actifs */}
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="checkbox"
                    id="rm-multi-asset"
                    checked={form.multi_asset}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        multi_asset:       e.target.checked,
                        asset_type:        '',
                        asset_allocations: [],
                      })
                    }
                    className="w-4 h-4 rounded border-border"
                  />
                  <Label htmlFor="rm-multi-asset" className="cursor-pointer font-normal text-sm">
                    {L("Types d'actifs multiples", 'Multiple asset types')}
                  </Label>
                  {form.multi_asset && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs ml-1"
                      onClick={() => setMultiAssetModalOpen(true)}
                    >
                      {L('Configurer', 'Configure')} ({form.asset_allocations.length} {L('type', 'type')}{form.asset_allocations.length !== 1 ? 's' : ''})
                    </Button>
                  )}
                </div>

                {/* Résumé de la répartition sous la checkbox */}
                {form.multi_asset && form.asset_allocations.length > 0 && (() => {
                  const total = form.asset_allocations.reduce((s, a) => s + (parseFloat(a.pct) || 0), 0);
                  return (
                    <p className={`text-xs ml-6 ${Math.abs(total - 100) < 0.01 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {form.asset_allocations.map(a => `${ASSET_TYPE_LABELS[a.type] || a.type} ${a.pct} %`).join(' · ')}
                      {Math.abs(total - 100) >= 0.01 && L(` — total ${total.toFixed(0)} % (doit être 100 %)`, ` — total ${total.toFixed(0)}% (must be 100%)`)}
                    </p>
                  );
                })()}

                {/* Sélecteur si pas multi */}
                {!form.multi_asset && (
                  <Select
                    value={form.asset_type}
                    onValueChange={(v) => setForm({ ...form, asset_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={L("Sélectionner un type d'actif…", 'Select an asset type…')} />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ASSET_TYPE_LABELS).map(([val, lbl]) => (
                        <SelectItem key={val} value={val}>{lbl}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              {editingId && (
                <Button variant="outline" onClick={handleCancelEdit}>
                  {L('Annuler', 'Cancel')}
                </Button>
              )}
              <Button
                onClick={handleSave}
                disabled={!isFormValid}
                className="flex-1"
              >
                {editingId ? L('Enregistrer les modifications', 'Save changes') : L('Créer le mouvement régulier', 'Create regular movement')}
              </Button>
            </div>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════════════
              ONGLET 2 — HISTORIQUE
          ══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="history" className="mt-4">
            {sortedMovements.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                <RefreshCw className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>{L('Aucun mouvement régulier créé.', 'No regular movement created yet.')}</p>
                <Button variant="link" className="mt-1" onClick={() => setTab('create')}>
                  {L('Créer le premier', 'Create the first one')}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedMovements.map((rm) => {
                  const portfolio    = portfolios.find((p) => p.id === rm.portfolio_id);
                  // Dépense courante non liée à une enveloppe d'investissement → « Compte chèque »
                  // (libellé + teinte neutre, car non rattachée à la couleur d'une enveloppe).
                  const isCompteCheque = rm.portfolio_id === 'compte_cheque';
                  const rowTintColor   = isCompteCheque ? '#94A3B8' : portfolio?.color;
                  const isStopped    = rm.status === 'stopped';
                  // "Terminé" = arrêté manuellement OU date de fin dépassée
                  const isCompleted  = isStopped || (!!rm.end_date && rm.end_date < today());
                  const isDeposit    = rm.type === 'deposit';
                  // Calculé uniquement quand la confirmation de suppression est active
                  const linkedInfo   = isCompleted && deleteRmConfirmId === rm.id
                    ? getLinkedTxInfo(rm.id)
                    : { count: 0, totalAmount: 0 };
                  const linkedCount  = linkedInfo.count;
                  const linkedAmount = linkedInfo.totalAmount;

                  return (
                    <div
                      key={rm.id}
                      // Mouvement terminé : bordure en pointillés plutôt qu'une opacité
                      // globale — la teinte de l'enveloppe reste lisible et le texte
                      // garde son contraste automatique.
                      className={`rounded-lg border p-4 space-y-2 transition-colors ${
                        isCompleted ? 'border-dashed border-border/70' : 'border-border bg-card'
                      }`}
                      // Terminé : bordure pointillés + opacité 40 % (la teinte d'enveloppe,
                      // pleine, est ainsi fortement atténuée) ; actif : rendu normal.
                      style={{
                        backgroundColor: envTintBg(rowTintColor),
                        color: isCompleted ? envMutedTextColor(rowTintColor) : envTextColor(rowTintColor),
                        opacity: isCompleted ? 0.4 : undefined,
                      }}
                    >
                      {/* ── Ligne principale ── */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {/* Icône type */}
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isDeposit
                              ? 'bg-emerald-100 dark:bg-emerald-900/30'
                              : 'bg-rose-100 dark:bg-rose-900/30'
                          }`}>
                            {isDeposit
                              ? <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                              : <ArrowUpRight  className="w-4 h-4 text-rose-600" />
                            }
                          </div>

                          <div className="min-w-0 flex-1">
                            {/* Badges */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">
                                {portfolio?.name || (isCompteCheque ? L('🏠 Compte chèque', '🏠 Current account') : '—')}
                              </span>
                              <span className="font-semibold text-sm" style={{ color: envGainColor(rowTintColor, isDeposit) }}>
                                {isDeposit ? '+' : '-'}{fmt(rm.amount)}
                              </span>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {RECURRENCE_LABELS[lang === 'en' ? 'en' : 'fr'][rm.recurrence] || rm.recurrence}
                              </Badge>
                              {isCompleted && (
                                <Badge className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground border border-border font-medium">
                                  {L('Terminé', 'Ended')}
                                </Badge>
                              )}
                            </div>
                            {/* Détails */}
                            {/* Couleur explicite à contraste auto sur la teinte de l'enveloppe. */}
                            <div className="text-xs mt-0.5" style={{ color: envMutedTextColor(rowTintColor) }}>
                              {L('Du', 'From')} {fmtDate(rm.start_date, lang)}
                              {rm.end_date ? ` ${L('au', 'to')} ${fmtDate(rm.end_date, lang)}` : L(' — En cours', ' — Ongoing')}
                              {rm.note && ` · ${rm.note}`}
                            </div>
                          </div>
                        </div>

                        {/* ── Actions (seulement si actif) ── */}
                        {!isCompleted && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEdit(rm)}
                              title={L('Modifier', 'Edit')}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>

                            {stopConfirm === rm.id ? (
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  className="h-7 text-xs px-2 bg-amber-600 hover:bg-amber-700 text-white"
                                  onClick={() => handleStop(rm.id)}
                                >
                                  {L('Confirmer', 'Confirm')}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs px-2"
                                  onClick={() => setStopConfirm(null)}
                                >
                                  {L('Annuler', 'Cancel')}
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-amber-600 hover:text-amber-700"
                                onClick={() => setStopConfirm(rm.id)}
                                title={L('Arrêter ce mouvement régulier', 'Stop this regular movement')}
                              >
                                <Square className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        )}

                        {/* ── Terminé : Modifier + Supprimer (les deux restent visibles) ── */}
                        {isCompleted && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {deleteRmConfirmId === rm.id ? (
                              <div className="flex flex-col items-end gap-1.5">
                                {linkedCount > 0 && (
                                  <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium text-right leading-tight max-w-[220px]">
                                    {L(`Supprimera aussi ${linkedCount} transaction${linkedCount > 1 ? 's' : ''} (${fmt(linkedAmount)}) de « ${portfolio?.name} ». Confirmer ?`,
                                       `Will also delete ${linkedCount} transaction${linkedCount > 1 ? 's' : ''} (${fmt(linkedAmount)}) from “${portfolio?.name}”. Confirm?`)}
                                  </p>
                                )}
                                {linkedCount === 0 && (
                                  <p className="text-[11px] text-muted-foreground text-right leading-tight max-w-[220px]">
                                    {L('Aucune transaction liée. Supprimer ?', 'No linked transaction. Delete?')}
                                  </p>
                                )}
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs px-2 bg-rose-600 hover:bg-rose-700 text-white"
                                    onClick={() => handleDeleteRm(rm.id)}
                                    aria-label={L('Supprimer le mouvement récurrent', 'Delete regular movement')}
                                  >
                                    {linkedCount > 0 ? L(`Supprimer (et ses ${linkedCount} trans.)`, `Delete (and its ${linkedCount} trans.)`) : L('Supprimer', 'Delete')}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs px-2"
                                    onClick={() => setDeleteRmConfirmId(null)}
                                  >
                                    {L('Annuler', 'Cancel')}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleEdit(rm)}
                                  title={L('Modifier', 'Edit')}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-rose-400 hover:text-rose-600"
                                  onClick={() => setDeleteRmConfirmId(rm.id)}
                                  aria-label={L('Supprimer le mouvement récurrent', 'Delete regular movement')}
                                  title={L('Supprimer ce mouvement terminé', 'Delete this ended movement')}
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ── Audit trail des modifications ── */}
                      {rm.historique_modifications?.length > 0 && (
                        <div className="mt-1 space-y-0.5 pl-11 border-t border-border/50 pt-2">
                          {rm.historique_modifications.map((mod, i) => (
                            <p key={i} className="text-[11px]" style={{ color: envMutedTextColor(rowTintColor) }}>
                              {mod.champ === 'montant'
                                ? L(`Montant modifié le ${fmtDate(mod.date, lang)} : ${fmt(mod.ancienneValeur)} → ${fmt(mod.nouvelleValeur)}`,
                                    `Amount changed on ${fmtDate(mod.date, lang)}: ${fmt(mod.ancienneValeur)} → ${fmt(mod.nouvelleValeur)}`)
                                : L(`${mod.champ} modifié le ${fmtDate(mod.date, lang)}`, `${mod.champ} changed on ${fmtDate(mod.date, lang)}`)
                              }
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

    {/* -- MODAL -- Répartition par type d'actif (multi-actifs) ---------- */}
    <Dialog open={multiAssetModalOpen} onOpenChange={setMultiAssetModalOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading">{L("Répartition par type d'actif", 'Breakdown by asset type')}</DialogTitle>
          <DialogDescription>
            {L('Cochez les types et saisissez les pourcentages. Le total doit être égal à 100 %.', 'Check the types and enter the percentages. The total must equal 100%.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
          {Object.entries(ASSET_TYPE_LABELS).map(([type, label]) => {
            const alloc   = form.asset_allocations.find(a => a.type === type);
            const checked = !!alloc;
            return (
              <div key={type} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/30">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={e => {
                    if (e.target.checked) {
                      setForm(f => ({
                        ...f,
                        asset_allocations: [...f.asset_allocations, { type, pct: 0 }],
                      }));
                    } else {
                      setForm(f => ({
                        ...f,
                        asset_allocations: f.asset_allocations.filter(a => a.type !== type),
                      }));
                    }
                  }}
                  className="h-4 w-4 cursor-pointer flex-shrink-0"
                />
                <span className="flex-1 text-sm">{label}</span>
                {checked && (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={alloc.pct}
                      onChange={e =>
                        setForm(f => ({
                          ...f,
                          asset_allocations: f.asset_allocations.map(a =>
                            a.type === type ? { ...a, pct: parseFloat(String(e.target.value).replace(',', '.')) || 0 } : a
                          ),
                        }))
                      }
                      className="w-16 h-8 rounded-md border border-input bg-background px-2 text-sm text-right"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Total */}
        {form.asset_allocations.length > 0 && (() => {
          const total = form.asset_allocations.reduce((s, a) => s + (parseFloat(a.pct) || 0), 0);
          return (
            <p className={`text-sm font-medium ${Math.abs(total - 100) < 0.01 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {L('Total :', 'Total:')} {total.toFixed(0)} %{' '}
              {Math.abs(total - 100) < 0.01
                ? '✓'
                : L(`— manque ${(100 - total).toFixed(0)} %`, `— missing ${(100 - total).toFixed(0)}%`)}
            </p>
          );
        })()}

        <DialogFooter>
          <Button onClick={() => setMultiAssetModalOpen(false)}>{L('Enregistrer', 'Save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* -- MODAL -- Répartition par type d'actif (mouvement type) -------- */}
    <Dialog open={tplMultiAssetModalOpen} onOpenChange={setTplMultiAssetModalOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading">{L("Répartition par type d'actif", 'Breakdown by asset type')}</DialogTitle>
          <DialogDescription>
            {L('Cochez les types et saisissez les pourcentages. Le total doit être égal à 100 %.', 'Check the types and enter the percentages. The total must equal 100%.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
          {Object.entries(ASSET_TYPE_LABELS).map(([type, label]) => {
            const alloc   = templateForm.asset_allocations.find(a => a.type === type);
            const checked = !!alloc;
            return (
              <div key={type} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/30">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={e => {
                    if (e.target.checked) {
                      setTemplateForm(f => ({
                        ...f,
                        asset_allocations: [...f.asset_allocations, { type, pct: 0 }],
                      }));
                    } else {
                      setTemplateForm(f => ({
                        ...f,
                        asset_allocations: f.asset_allocations.filter(a => a.type !== type),
                      }));
                    }
                  }}
                  className="h-4 w-4 cursor-pointer flex-shrink-0"
                />
                <span className="flex-1 text-sm">{label}</span>
                {checked && (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={alloc.pct}
                      onChange={e =>
                        setTemplateForm(f => ({
                          ...f,
                          asset_allocations: f.asset_allocations.map(a =>
                            a.type === type ? { ...a, pct: parseFloat(String(e.target.value).replace(',', '.')) || 0 } : a
                          ),
                        }))
                      }
                      className="w-16 h-8 rounded-md border border-input bg-background px-2 text-sm text-right"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Total */}
        {templateForm.asset_allocations.length > 0 && (() => {
          const total = templateForm.asset_allocations.reduce((s, a) => s + (parseFloat(a.pct) || 0), 0);
          return (
            <p className={`text-sm font-medium ${Math.abs(total - 100) < 0.01 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {L('Total :', 'Total:')} {total.toFixed(0)} %{' '}
              {Math.abs(total - 100) < 0.01
                ? '✓'
                : L(`— manque ${(100 - total).toFixed(0)} %`, `— missing ${(100 - total).toFixed(0)}%`)}
            </p>
          );
        })()}

        <DialogFooter>
          <Button onClick={() => setTplMultiAssetModalOpen(false)}>{L('Enregistrer', 'Save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* -- Portée de mise à jour de la note (occurrences) --------------------
        Superposition autonome (fond assombri + carte centrée) : évite les
        conflits de z-index/overlay d'un Dialog imbriqué dans un autre Dialog. */}
    {noteSyncPrompt && (
      <div
        className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50"
        onClick={() => setNoteSyncPrompt(null)}
      >
        <div
          className="bg-card border border-border rounded-lg shadow-xl w-full max-w-md p-5 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-heading font-semibold text-base">{L('Mettre à jour la note', 'Update the note')}</h3>
            <button
              type="button"
              onClick={() => setNoteSyncPrompt(null)}
              className="text-muted-foreground hover:text-foreground shrink-0"
              aria-label={L('Fermer', 'Close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            {L(
              `Cette note est liée à ${noteSyncPrompt?.linkedCount} occurrence${(noteSyncPrompt?.linkedCount || 0) > 1 ? 's' : ''} déjà enregistrée${(noteSyncPrompt?.linkedCount || 0) > 1 ? 's' : ''} dans l'historique. Souhaitez-vous mettre à jour uniquement les occurrences futures ou également les occurrences passées ?`,
              `This note is linked to ${noteSyncPrompt?.linkedCount} occurrence${(noteSyncPrompt?.linkedCount || 0) > 1 ? 's' : ''} already recorded in the history. Do you want to update only future occurrences or also past ones?`
            )}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => _commitSave(noteSyncPrompt.payload, 'future')}
            >
              {L('Uniquement les occurrences futures', 'Future occurrences only')}
            </Button>
            <Button
              className="flex-1"
              onClick={() => _commitSave(noteSyncPrompt.payload, 'all')}
            >
              {L('Mettre à jour toutes les occurrences', 'Update all occurrences')}
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

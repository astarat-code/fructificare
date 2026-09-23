// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
import { useState, useEffect, useCallback } from "react";
import dataService from "../services/dataService";
import documentService from "../services/documentService";
import { useLanguage } from "../context/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "./ui/dialog";
import { FileText, Plus, ExternalLink, Trash2, AlertTriangle, ChevronRight, Pencil, FolderOpen } from "lucide-react";
import { toast } from "sonner";

const todayISO = () => new Date().toISOString().split("T")[0];

const fmtDate = (iso, isEn) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return isEn ? `${y}-${m}-${d}` : `${d}/${m}/${y}`;
};

/**
 * Section « Documents » réutilisable.
 *   - Mode enveloppe  : <DocumentsSection portfolioId={id} compact />  → encadré compact
 *       (nombre de documents) qui ouvre une fenêtre listant les documents.
 *   - Mode global     : <DocumentsSection global />  → liste complète en ligne.
 */
export default function DocumentsSection({ portfolioId = null, global = false, compact = false }) {
  const { lang } = useLanguage();
  const isEn = lang === "en";
  const L = (fr, en) => (isEn ? en : fr);

  const [docs, setDocs] = useState([]);
  const [missing, setMissing] = useState({});          // id → chemin attendu si introuvable
  const [listOpen, setListOpen] = useState(false);     // fenêtre liste (mode compact)
  const [addOpen, setAddOpen] = useState(false);
  const [pending, setPending] = useState(null);        // fichier choisi en attente du formulaire
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ date: todayISO(), type: "releve_compte", typeLabel: "", name: "", portfolioId: portfolioId || "" });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingDoc, setEditingDoc] = useState(null);  // document en cours de modification (métadonnées)

  const portfolios = dataService.getPortfolios();
  const typeById = Object.fromEntries(dataService.DOCUMENT_TYPES.map(t => [t.id, t]));
  const portfolioName = (pid) => portfolios.find(p => p.id === pid)?.name || L("Global", "Global");

  const refresh = useCallback(() => {
    const all = global ? dataService.getDocuments() : dataService.getDocumentsForPortfolio(portfolioId);
    setDocs([...all].sort(
      (a, b) => (b.date || "").localeCompare(a.date || "") || (b.created_at || "").localeCompare(a.created_at || "")
    ));
  }, [global, portfolioId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Vérifie l'existence réelle de chaque fichier (met en évidence les « Fichier introuvable »).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const m = {};
      for (const d of docs) {
        // eslint-disable-next-line no-await-in-loop
        const ok = await documentService.documentExists(d);
        // eslint-disable-next-line no-await-in-loop
        if (!ok) m[d.id] = await documentService.getExpectedPath(d);
      }
      if (!cancelled) setMissing(m);
    })();
    return () => { cancelled = true; };
  }, [docs]);

  const openPicker = async () => {
    let picked;
    try {
      picked = await documentService.pickPdf();
    } catch (e) {
      toast.error(L("Impossible d'ouvrir le sélecteur de fichier.", "Could not open the file picker."));
      return;
    }
    if (!picked) return; // annulé
    setEditingDoc(null); // ajout (pas une modification)
    setPending(picked);
    setForm({
      date: todayISO(),
      type: "releve_compte",
      typeLabel: "",
      name: picked.baseName || "",
      portfolioId: portfolioId || "",
    });
    setAddOpen(true);
  };

  const confirmAdd = async () => {
    if (!pending || saving) return;
    setSaving(true);
    const name = (form.name || "").trim() || pending.baseName || "document";
    const pid = form.portfolioId || null;
    const portfolio = pid ? portfolios.find(p => p.id === pid) : null;
    const slug = portfolio ? dataService.getPortfolioSlug(portfolio) : "global";
    const date = form.date || todayISO();
    const id = documentService.genDocumentId();
    const filename = `${date}_${dataService.slugify(name)}.pdf`;
    try {
      const { persisted, relPath } = await documentService.saveDocument({ id, slug, filename, source: pending.source });
      dataService.addDocument({
        id,
        date,
        type: form.type,
        type_label: form.type === "autre" ? (form.typeLabel || "").trim() : "",
        name,
        original_filename: pending.originalFilename || filename,
        portfolio_id: pid,
        rel_path: relPath,
        filename,
        created_at: new Date().toISOString(),
      });
      toast.success(L("Document ajouté.", "Document added."));
      if (!persisted) {
        toast.info(L("Ouverture native disponible dans la version bureau.", "Native opening is available in the desktop version."));
      }
      setAddOpen(false);
      setPending(null);
      refresh();
    } catch (e) {
      toast.error(L("Échec de l'enregistrement du document. ", "Failed to save the document. ") + (e?.message || ""));
    } finally {
      setSaving(false);
    }
  };

  // Modifier un document existant : rouvre le même formulaire, pré-rempli (sans re-choisir de fichier).
  const openEdit = (doc) => {
    setEditingDoc(doc);
    setPending(null);
    setForm({
      date: doc.date || todayISO(),
      type: doc.type || "releve_compte",
      typeLabel: doc.type_label || "",
      name: doc.name || "",
      portfolioId: doc.portfolio_id || "",
    });
    setAddOpen(true);
  };

  const confirmEdit = async () => {
    if (!editingDoc || saving) return;
    setSaving(true);
    const name = (form.name || "").trim() || editingDoc.name || "document";
    const pid = form.portfolioId || null;
    const portfolio = pid ? portfolios.find(p => p.id === pid) : null;
    const slug = portfolio ? dataService.getPortfolioSlug(portfolio) : "global";
    const date = form.date || todayISO();
    const filename = `${date}_${dataService.slugify(name)}.pdf`;
    try {
      // Déplace/renomme le fichier si l'enveloppe (dossier) OU le nom/date change.
      const { relPath } = await documentService.moveDocument({ relPath: editingDoc.rel_path, newSlug: slug, newFilename: filename });
      dataService.updateDocument(editingDoc.id, {
        date,
        type: form.type,
        type_label: form.type === "autre" ? (form.typeLabel || "").trim() : "",
        name,
        portfolio_id: pid,
        rel_path: relPath,
        filename,
      });
      toast.success(L("Document mis à jour.", "Document updated."));
      setAddOpen(false);
      setEditingDoc(null);
      refresh();
    } catch (e) {
      toast.error(L("Échec de la mise à jour. ", "Update failed. ") + (e?.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const openFolder = async () => {
    const res = await documentService.openDocumentsFolder();
    if (!res.ok) {
      toast.info(L("Ouverture du dossier disponible dans la version bureau.", "Opening the folder is available in the desktop version."));
    }
  };

  const handleOpen = async (doc) => {
    const res = await documentService.openDocument(doc);
    if (res.ok) {
      if (res.browserDownload) {
        toast.info(L("Ouverture native disponible dans la version bureau — téléchargement lancé.", "Native opening is available in the desktop version — download started."));
      }
      return;
    }
    if (res.reason === "invalid_path") {
      // Chemin refusé par la validation de documentService : la sauvegarde a été altérée.
      toast.error(L(
        "Ce document référence un emplacement invalide et n'a pas été ouvert. Supprimez-le puis réimportez le PDF.",
        "This document points to an invalid location and was not opened. Delete it, then re-import the PDF.",
      ));
    } else if (res.reason === "not_found") {
      toast.error(L(`Fichier introuvable : ${res.path}`, `File not found: ${res.path}`));
    } else if (res.reason === "open_error") {
      toast.error(L(`Impossible d'ouvrir le document : ${res.error || ""}`, `Could not open the document: ${res.error || ""}`));
    } else {
      toast.info(L("Ouverture native disponible dans la version bureau.", "Native opening is available in the desktop version."));
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try { await documentService.deleteDocumentFile(deleteTarget); } catch (_) { /* fichier déjà absent */ }
    dataService.removeDocument(deleteTarget.id);
    setDeleteTarget(null);
    refresh();
    toast.success(L("Document supprimé.", "Document deleted."));
  };

  const typeLabel = (doc) => {
    if (doc.type === "autre") return doc.type_label || L("Autre", "Other");
    const t = typeById[doc.type];
    return t ? L(t.fr, t.en) : doc.type;
  };

  // Liste des documents (empty state ou <ul>) — partagée entre l'affichage en ligne
  // et la fenêtre du mode compact.
  const listBody = docs.length === 0 ? (
    <p className="text-sm text-muted-foreground py-4 text-center">
      {L("Aucun document. Ajoutez vos relevés, avis d'opéré, documents fiscaux (PDF).",
         "No documents yet. Add your statements, trade confirmations, tax documents (PDF).")}
    </p>
  ) : (
    <ul className="divide-y divide-border">
      {docs.map((doc) => {
        const notFound = Object.prototype.hasOwnProperty.call(missing, doc.id);
        return (
          <li key={doc.id} className="flex items-center gap-3 py-2.5">
            <span className="text-xs tabular-nums text-muted-foreground shrink-0 w-20">{fmtDate(doc.date, isEn)}</span>
            <Badge variant="outline" className="shrink-0 text-[11px] font-normal">{typeLabel(doc)}</Badge>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate flex items-center gap-1.5">
                {doc.name}
                {notFound && (
                  <span
                    className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-[11px] font-normal cursor-help shrink-0"
                    title={L(`Fichier introuvable. Chemin attendu : ${missing[doc.id]}`,
                             `File not found. Expected path: ${missing[doc.id]}`)}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> {L("Fichier introuvable", "File not found")}
                  </span>
                )}
              </p>
              {global && (
                <p className="text-xs text-muted-foreground truncate">{portfolioName(doc.portfolio_id)}</p>
              )}
            </div>
            <Button variant="ghost" size="sm" className="shrink-0" onClick={() => handleOpen(doc)} title={L("Ouvrir", "Open")}>
              <ExternalLink className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="shrink-0" onClick={() => openEdit(doc)} title={L("Modifier", "Edit")}>
              <Pencil className="w-4 h-4 text-muted-foreground" />
            </Button>
            <Button variant="ghost" size="sm" className="shrink-0 text-rose-600 hover:text-rose-700" onClick={() => setDeleteTarget(doc)} title={L("Supprimer", "Delete")}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </li>
        );
      })}
    </ul>
  );

  const addButton = (
    <div className="flex items-center gap-2">
      {documentService.isTauri() && (
        <Button size="sm" variant="outline" onClick={openFolder} title={L("Ouvrir le dossier des documents importés", "Open the imported-documents folder")}>
          <FolderOpen className="w-4 h-4 mr-1" /> {L("Dossier", "Folder")}
        </Button>
      )}
      <Button size="sm" onClick={openPicker} data-testid="add-document-btn">
        <Plus className="w-4 h-4 mr-1" /> {L("Ajouter un document", "Add a document")}
      </Button>
    </div>
  );

  // Contenu principal : encadré compact cliquable (page enveloppe) OU liste en ligne (page globale).
  const mainContent = compact ? (
    <>
      <Card
        className="border border-border shadow-sm cursor-pointer transition-colors hover:bg-accent/40"
        onClick={() => setListOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setListOpen(true); } }}
        data-testid="documents-compact-card"
      >
        <CardContent className="p-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="w-5 h-5 text-primary shrink-0" strokeWidth={1.5} />
            <span className="font-heading text-lg">{L("Documents", "Documents")}</span>
            <Badge variant="secondary" className="tabular-nums">{docs.length}</Badge>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
        </CardContent>
      </Card>

      {/* Fenêtre listant tous les documents */}
      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" strokeWidth={1.5} />
              {L("Documents", "Documents")} ({docs.length})
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-end">{addButton}</div>
          <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1">{listBody}</div>
        </DialogContent>
      </Dialog>
    </>
  ) : (
    <Card className="border border-border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="font-heading text-lg flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" strokeWidth={1.5} />
          {L("Documents", "Documents")}
        </CardTitle>
        {addButton}
      </CardHeader>
      <CardContent>{listBody}</CardContent>
    </Card>
  );

  return (
    <>
      {mainContent}

      {/* ── Formulaire d'ajout / de modification ───────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={(o) => { if (!o) { setAddOpen(false); setPending(null); setEditingDoc(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDoc ? L("Modifier le document", "Edit document") : L("Ajouter un document", "Add a document")}</DialogTitle>
            <DialogDescription>
              {editingDoc
                ? L("Modifiez le nom, la date, le type ou l'enveloppe. Le fichier est déplacé si l'enveloppe change.",
                    "Change the name, date, type or envelope. The file is moved if the envelope changes.")
                : (pending?.originalFilename
                    ? L(`Fichier sélectionné : ${pending.originalFilename}`, `Selected file: ${pending.originalFilename}`)
                    : "")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{L("Date", "Date")}</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <Label>{L("Type de document", "Document type")}</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {dataService.DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{L(t.fr, t.en)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.type === "autre" && (
              <div>
                <Label>{L("Libellé du type", "Type label")}</Label>
                <Input value={form.typeLabel} onChange={(e) => setForm({ ...form, typeLabel: e.target.value })}
                       placeholder={L("ex : Attestation fiscale", "e.g. Tax certificate")} />
              </div>
            )}
            <div>
              <Label>{L("Nom", "Name")}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>{L("Enveloppe liée", "Linked envelope")}</Label>
              <Select value={form.portfolioId || "__global__"} onValueChange={(v) => setForm({ ...form, portfolioId: v === "__global__" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__global__">{L("Aucune (document global)", "None (global document)")}</SelectItem>
                  {portfolios.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); setPending(null); setEditingDoc(null); }}>{L("Annuler", "Cancel")}</Button>
            <Button onClick={editingDoc ? confirmEdit : confirmAdd} disabled={saving}>{L("Enregistrer", "Save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirmation de suppression ───────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{L("Supprimer le document ?", "Delete document?")}</DialogTitle>
            <DialogDescription>
              {L(`« ${deleteTarget?.name} » sera supprimé définitivement du disque. Cette action est irréversible.`,
                 `"${deleteTarget?.name}" will be permanently deleted from disk. This cannot be undone.`)}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>{L("Annuler", "Cancel")}</Button>
            <Button variant="destructive" onClick={confirmDelete}>{L("Supprimer", "Delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

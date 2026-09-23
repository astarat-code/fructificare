// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * DocumentsPage.js — global documents view.
 *
 * Lists every document (all envelopes + global documents). The reusable DocumentsSection
 * component handles adding, opening and deleting.
 */

import { useLanguage } from "../context/LanguageContext";
import DocumentsSection from "../components/DocumentsSection";
import documentService from "../services/documentService";
import { FolderOpen } from "lucide-react";

export default function DocumentsPage() {
  const { lang } = useLanguage();
  const L = (fr, en) => (lang === "en" ? en : fr);

  return (
    <div className="space-y-6" data-testid="documents-page">
      <div className="flex items-center gap-3">
        <FolderOpen className="w-8 h-8 text-primary shrink-0" />
        <div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight">
            {L("Documents", "Documents")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {L("Vos documents financiers (relevés, avis d'opéré, documents fiscaux), stockés localement sur votre appareil.",
               "Your financial documents (statements, trade confirmations, tax documents), stored locally on your device.")}
          </p>
        </div>
      </div>

      {!documentService.isTauri() && (
        <p className="text-xs text-muted-foreground rounded-md border border-border bg-accent/30 px-3 py-2">
          {L("Mode navigateur : l'ouverture native des PDF et le stockage permanent sur disque sont disponibles dans la version bureau.",
             "Browser mode: native PDF opening and permanent on-disk storage are available in the desktop version.")}
        </p>
      )}

      <DocumentsSection global />
    </div>
  );
}

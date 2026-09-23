// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
import { useState } from "react";
import dataService from "../services/dataService";
import { useLanguage } from "../context/LanguageContext";
import Disclaimer from "../components/ui/Disclaimer";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { toast } from "sonner";
import { FileText, Download, AlertTriangle, ShieldCheck } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import challengeService from "../services/challengeService";
import questService     from "../services/questService";
import { Checkbox } from "../components/ui/checkbox";
import { buildPerformanceSection, hasCalibrationForYear } from "../lib/performanceReport";
import { saveFileWithDialog } from "../lib/saveFile";
import { getTaxMaturity, taxMaturityLabels } from "../lib/taxMaturity";
import { signeFrais } from "../lib/transactionFees";
import { estRetraitImposable } from "../lib/taxableWithdrawal";
import { VIOLET } from "../lib/pdfTheme";
import GlossaryTerm from "../components/ui/GlossaryTerm";
import { displayNote } from "../lib/displayNote";

export default function TaxReport() {
  const { t, lang } = useLanguage();
  const isEn = lang === 'en';
  // Format de date localisé pour le PDF : MM/DD/YYYY (EN) ou DD/MM/YYYY (FR).
  const fmtDatePdf = (d) => {
    if (!d) return '';
    const [y, m, day] = String(d).slice(0, 10).split('-');
    if (!y || !m || !day) return String(d);
    return isEn ? `${m}/${day}/${y}` : `${day}/${m}/${y}`;
  };
  const [year, setYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState(null);
  const [includePerf, setIncludePerf] = useState(false);

  // Rapport enrichi : nécessite au moins une calibration datée de l'année sélectionnée
  const hasCalForYear = hasCalibrationForYear(parseInt(year));

  const fetchReport = () => {
    setReport(dataService.getTaxReport(parseInt(year)));
    dataService.trackFiscalSimulationDone();
  };

  const downloadPdf = async () => {
    try {
      const doc = new jsPDF();
      const enhanced = includePerf && hasCalForYear;

      // ── Rapport de performance enrichi (pages 1-4), puis section fiscale ────
      if (enhanced) {
        buildPerformanceSection(doc, parseInt(year), { t, lang });
        doc.addPage();
      }
      const pageHeight = doc.internal.pageSize.height;
      const pageWidth  = doc.internal.pageSize.width;
      const margin     = 14;
      const maxY       = pageHeight - 30;
      // Crypto : l'impôt porte sur l'année des cessions, la déclaration a lieu l'année suivante.
      const noteCrypto = t('tax.cryptoDeclarationNote')
        .replace('{annee}', String(year))
        .replace('{suivante}', String(parseInt(year) + 1));

      // ── Helper : résout le type d'actif effectif d'une transaction ──────────
      const resolveAt = tx =>
        (tx.asset_type === 'autre' && tx.custom_asset_type)
          ? tx.custom_asset_type
          : (tx.asset_type || 'non_defini');

      // ── Helper : label lisible pour un type d'actif ──────────────────────────
      const atLabel = at => {
        if (!at || at === 'non_defini') return '-';
        // Utilise les traductions de l'application si disponibles
        const key = `assetTypes.${at}`;
        const translated = t(key);
        // t() retourne la clé si absente — on détecte ça et on capitalise à la place
        if (translated === key) return at.charAt(0).toUpperCase() + at.slice(1);
        return translated;
      };

      // ── En-tête répétée sur les pages 2+ ────────────────────────────────────
      const addHeader = () => {
        doc.setFontSize(10);
        doc.setTextColor(239, 173, 36);
        doc.text("Fructificare", margin, 12);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`${t('tax.title')} ${year}`, margin, 17);
        doc.setDrawColor(239, 173, 36);
        doc.setLineWidth(0.3);
        doc.line(margin, 20, pageWidth - margin, 20);
      };

      // ── Saut de page automatique ──────────────────────────────────────────────
      const checkPageBreak = (currentY, neededSpace) => {
        if (currentY + neededSpace > maxY) {
          doc.addPage();
          addHeader();
          return 28;
        }
        return currentY;
      };

      // ── En-tête principale (première page) ─────────────────────────────────
      doc.setFontSize(22);
      doc.setTextColor(239, 173, 36);
      doc.text("Fructificare", margin, 18);
      doc.setFontSize(14);
      doc.setTextColor(100, 100, 100);
      doc.text(`${t('tax.title')} ${year}`, margin, 28);
      doc.setFontSize(9);
      doc.text(`${isEn ? 'Generated on' : 'Généré le'} ${fmtDatePdf(new Date().toISOString().slice(0, 10))}`, margin, 35);

      // ── Liste des enveloppes concernées (Prompt 9C) ─────────────────────────
      doc.setFontSize(7.5);
      doc.setTextColor(80, 80, 80);
      const envStr   = report.map(i => `${i.portfolio.name} (${i.portfolio.type.toUpperCase()})`).join('  •  ');
      const envLabel = `${t('tax.envelopesList')} : ${envStr}`;
      const envLines = doc.splitTextToSize(envLabel, pageWidth - 2 * margin);
      doc.text(envLines, margin, 43);
      const envBlockH = envLines.length * 4;

      // Ligne de séparation
      doc.setDrawColor(...VIOLET);
      doc.setLineWidth(0.5);
      doc.line(margin, 43 + envBlockH + 2, pageWidth - margin, 43 + envBlockH + 2);

      let y = 43 + envBlockH + 10;

      // ── Synthèse par type d'actif (Prompt 9B) ─────────────────────────────
      // Calculer les PV pro-ratées par actif pour chaque enveloppe
      const synthByType = {};
      report.forEach(item => {
        // Les livrets réglementés sont exclus de CETTE synthèse : elle récapitule
        // l'imposition, et y agréger des plus-values exonérées gonflerait un total que
        // l'on peut reporter sur une déclaration. Le livret garde sa fiche détaillée
        // plus bas, avec ses intérêts et la mention d'exonération.
        if (item.is_tax_exempt) return;
        const wdTotal  = item.year_withdrawals;
        const gainRatio = wdTotal > 0 ? item.estimated_gains / wdTotal : 0;
        const taxTotal  = item.tax.total_tax;
        const taxRatio  = item.estimated_gains > 0 ? taxTotal / item.estimated_gains : 0;

        item.year_transactions
          .filter(tx => estRetraitImposable(tx, item.portfolio.type))
          .forEach(tx => {
            const at   = resolveAt(tx);
            const net  = tx.net_amount || tx.amount;
            const gains = net * gainRatio;
            const tax   = gains * taxRatio;
            if (!synthByType[at]) synthByType[at] = { withdrawals: 0, gains: 0, tax: 0 };
            synthByType[at].withdrawals += net;
            synthByType[at].gains       += gains;
            synthByType[at].tax         += tax;
          });
      });

      const synthEntries = Object.entries(synthByType);
      if (synthEntries.length > 0) {
        y = checkPageBreak(y, 18 + synthEntries.length * 6 + 16);

        doc.setFontSize(11);
        doc.setTextColor(...VIOLET);
        doc.text(t('tax.synthesisTitle'), margin, y);
        y += 6;

        const totWd    = synthEntries.reduce((s, [, d]) => s + d.withdrawals, 0);
        const totGains = synthEntries.reduce((s, [, d]) => s + d.gains,       0);
        const totTax   = synthEntries.reduce((s, [, d]) => s + d.tax,         0);

        const synthRows = synthEntries.map(([at, d]) => {
          const cryptoNote = at === 'crypto' ? ` (${t('tax.cryptoRegime')})` : '';
          return [
            atLabel(at) + cryptoNote,
            `${d.withdrawals.toFixed(2)} €`,
            `${d.gains.toFixed(2)} €`,
            `${d.tax.toFixed(2)} €`,
          ];
        });

        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [[
            t('tax.assetTypeColumn'),
            t('tax.synthesisWithdrawals'),
            t('tax.synthesisGains'),
            t('tax.synthesisImposition'),
          ]],
          body: [
            ...synthRows,
            [
              { content: t('tax.synthesisTotal'), styles: { fontStyle: 'bold' } },
              { content: `${totWd.toFixed(2)} €`,    styles: { fontStyle: 'bold', halign: 'right' } },
              { content: `${totGains.toFixed(2)} €`, styles: { fontStyle: 'bold', halign: 'right' } },
              { content: `${totTax.toFixed(2)} €`,   styles: { fontStyle: 'bold', halign: 'right' } },
            ],
          ],
          theme: 'grid',
          headStyles: { fillColor: VIOLET, textColor: 255, fontSize: 8 },
          styles: { fontSize: 7, cellPadding: 2 },
          columnStyles: {
            0: { cellWidth: 70 },
            1: { cellWidth: 32, halign: 'right' },
            2: { cellWidth: 32, halign: 'right' },
            3: { cellWidth: 32, halign: 'right' },
          },
          // Sans footStyles, le pied garde le vert par défaut de jspdf-autotable.
          footStyles: { fillColor: [241, 245, 249] },
          foot: [[{
            content: `${t('tax.taxRatesRef')} : PS ${(dataService.PS_RATE * 100).toFixed(1)} %  |  IR ${(dataService.IR_RATE * 100).toFixed(1)} %  |  PFU ${(dataService.FLAT_TAX * 100).toFixed(1)} %`,
            colSpan: 4,
            styles: { fontSize: 6, textColor: [100, 100, 100], halign: 'right', fontStyle: 'italic' },
          }]],
          showFoot: 'lastPage',
        });
        y = doc.lastAutoTable.finalY + 10;
      }

      // ── Détail par enveloppe ─────────────────────────────────────────────────
      report.forEach((item, idx) => {
        y = checkPageBreak(y, 30);

        // Titre de l'enveloppe
        doc.setFontSize(13);
        doc.setTextColor(...VIOLET);
        doc.text(`${idx + 1}. ${item.portfolio.name} (${item.portfolio.type.toUpperCase()})`, margin, y);
        y += 8;
        doc.setTextColor(0, 0, 0);

        // ── Maturité fiscale (PEA > 5 ans, assurance vie > 8 ans) ─────────────
        // Évaluée au 31/12 de l'année du rapport, cohérent avec le calcul d'impôt.
        const matLabels = taxMaturityLabels(
          getTaxMaturity(item.portfolio, new Date(`${year}-12-31`)),
          isEn
        );
        if (matLabels) {
          y = checkPageBreak(y, 10);
          doc.setFontSize(8);
          doc.setTextColor(5, 150, 105);
          doc.setFont(undefined, 'bold');
          // Pas de symbole hors WinAnsi (police PDF standard) : le gras suffit.
          const matLines = doc.splitTextToSize(
            `${matLabels.badge} - ${matLabels.tooltip}`,
            pageWidth - 2 * margin
          );
          doc.text(matLines, margin, y);
          doc.setFont(undefined, 'normal');
          y += matLines.length * 4 + 3;
          doc.setTextColor(0, 0, 0);
        }

        // ── Tableau des transactions — avec colonne "Type d'actif" (Prompt 9A) ──
        if (item.year_transactions.length > 0) {
          autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin, bottom: 30 },
            head: [[
              t('portfolio.date'),
              t('portfolio.type') || 'Type',
              t('tax.assetTypeColumn'),
              t('portfolio.grossAmount'),
              t('portfolio.fees'),
              t('portfolio.netAmount'),
              t('portfolio.note') || 'Note',
            ]],
            body: item.year_transactions.map(tx => {
              const typeLabel = tx.type === 'deposit' ? t('portfolio.deposit') : t('portfolio.withdrawal');
              return [
                fmtDatePdf(tx.date),
                typeLabel,
                atLabel(resolveAt(tx)),
                `${tx.amount.toFixed(2)} €`,
                // Signe selon le sens réel des frais (ajoutés ou déduits) — voir transactionFees.
                tx.fees_amount > 0 ? `${signeFrais(tx)}${tx.fees_amount.toFixed(2)} € (${tx.fees_pct}%)` : '-',
                `${(tx.net_amount || tx.amount).toFixed(2)} €`,
                (displayNote(tx.note, lang) || '').substring(0, 20),
              ];
            }),
            theme: 'striped',
            headStyles: { fillColor: VIOLET, textColor: 255, fontSize: 8 },
            styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
            columnStyles: {
              0: { cellWidth: 20 },
              1: { cellWidth: 18 },
              2: { cellWidth: 22 },
              3: { cellWidth: 24, halign: 'right' },
              4: { cellWidth: 26, halign: 'right' },
              5: { cellWidth: 24, halign: 'right' },
              6: { cellWidth: 'auto' },
            },
            didParseCell: function(data) {
              if (data.section === 'body' && data.column.index === 1) {
                const raw = data.cell.raw;
                if (raw === t('portfolio.withdrawal') || raw === 'Vente' || raw === 'Withdrawal') {
                  data.cell.styles.textColor = [220, 38, 38];
                  data.cell.styles.fontStyle  = 'bold';
                }
              }
            },
            showHead: 'everyPage',
          });
          y = doc.lastAutoTable.finalY + 8;
        }

        // ── Résumé dans un cadre ──────────────────────────────────────────────
        // Les lignes d'imposition (plus-values, PS, IR, total) ne sont tracées que
        // pour les types dotés d'un régime fiscal — une enveloppe personnalisée ou
        // un livret réglementé n'affiche que ses flux.
        const hasTaxRules = item.tax.has_rules !== false;

        const leftCol  = margin + 5;
        const rightCol = pageWidth / 2 + 5;
        const boxW     = pageWidth - 2 * margin;

        // Hauteur du cadre calculée d'après son contenu réel
        doc.setFontSize(7);
        const detailLines = doc.splitTextToSize(item.tax.details || '', boxW - 10);
        // Livret réglementé : une phrase explicite sur l'absence d'imposition s'ajoute
        // sous le détail, pour que le PDF se suffise à lui-même.
        const exemptLines = item.is_tax_exempt
          ? doc.splitTextToSize(t('tax.exemptNote'), boxW - 10)
          : [];
        // Crypto : l'impôt porte sur l'année des cessions mais se règle l'année suivante.
        const cryptoLines = item.has_taxable_crypto
          ? doc.splitTextToSize(noteCrypto, boxW - 10)
          : [];
        // Hauteur déduite de la mise en page réelle, et non d'un décompte approximatif :
        // TROIS lignes à deux colonnes sont toujours tracées (versements, retraits, frais).
        // L'ancienne formule n'en comptait que deux sans régime fiscal, ce qui rabotait le
        // cadre d'environ 7 mm — assez discret avec une seule ligne de texte, franchement
        // visible dès que la mention d'exonération en ajoute deux.
        //   • 7 mm  : hauteur avant la 1re ligne, puis 7 mm entre chaque ligne ;
        //   • 3,5 mm par ligne de texte (police 7) ;
        //   • bloc de totaux (police 8) uniquement pour les enveloppes imposables.
        // Espèces non réinvesties : affichées seulement quand il y en a, sur une ligne
        // en plus (elles complètent la valeur calibrée et entrent dans l'assiette).
        const cashPocket = item.cash_balance || 0;
        const aDesEspeces = cashPocket > 0.005;
        const apresLignes = 7 + 2 * 7 + (aDesEspeces ? 7 : 0) + (hasTaxRules ? 8 : 7);
        const hauteurTextes = (detailLines.length + exemptLines.length + cryptoLines.length) * 3.5;
        const hauteurTotaux = hasTaxRules ? 3 + 5 : 0;
        const boxH = apresLignes + hauteurTextes + hauteurTotaux + 3; // 3 mm de marge basse

        y = checkPageBreak(y, boxH + 6);

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(margin, y, boxW, boxH, 2, 2, 'FD');

        let summaryY = y + 7;

        /** Écrit une paire libellé/valeur colorée sur une colonne. */
        const cell = (label, value, col, valueRgb, bold = false) => {
          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          doc.text(label, col, summaryY);
          doc.setTextColor(...valueRgb);
          if (bold) doc.setFont(undefined, 'bold');
          doc.text(value, col + (col === leftCol ? 42 : 50), summaryY);
          if (bold) doc.setFont(undefined, 'normal');
        };

        cell(`${t('tax.yearDeposits')}:`,    `${item.year_deposits.toFixed(2)} €`,    leftCol,  [5, 150, 105], true);
        cell(`${t('tax.allTimeDeposits')}:`, `${item.all_time_deposits.toFixed(2)} €`, rightCol, [0, 0, 0]);
        summaryY += 7;

        cell(`${t('tax.yearWithdrawals')} :`, `${item.year_withdrawals.toFixed(2)} €`, leftCol, [220, 38, 38], true);
        // Solde actuel = dernière calibration si elle existe, sinon versements nets
        // (marqué « ~ » pour signaler une valeur estimée et non constatée).
        const soldeStr = item.is_calibrated
          ? `${item.current_value.toFixed(2)} €`
          : `~ ${item.current_value.toFixed(2)} €`;
        cell(`${t('tax.currentBalance')}:`, soldeStr, rightCol, [5, 150, 105], true);
        summaryY += 7;

        if (hasTaxRules) {
          cell(`${t('tax.estimatedGains')}:`, `${item.estimated_gains.toFixed(2)} €`, leftCol, [0, 0, 0]);
          cell(`${t('tax.yearFees')}:`, `${item.year_fees.toFixed(2)} €`, rightCol, [217, 119, 6]);
          summaryY += 8;
        } else {
          cell(`${t('tax.yearFees')}:`, `${item.year_fees.toFixed(2)} €`, leftCol, [217, 119, 6]);
          // Les intérêts d'un livret sont acquis sans retrait : on les affiche en face,
          // en vert, pour montrer que l'enveloppe produit bien un rendement.
          if (item.is_tax_exempt) {
            const interetStr = item.is_calibrated
              ? `${item.exempt_interest.toFixed(2)} €`
              : `~ ${item.exempt_interest.toFixed(2)} €`;
            cell(`${t('tax.exemptInterestShort')}:`, interetStr, rightCol, [5, 150, 105], true);
          }
          summaryY += 7;
        }

        if (aDesEspeces) {
          cell(`${t('tax.cashPocket')}:`, `${cashPocket.toFixed(2)} €`, leftCol, [37, 99, 235]);
          summaryY += 7;
        }

        doc.setFontSize(7);
        doc.setTextColor(80, 80, 80);
        detailLines.forEach((line, i) => doc.text(line, leftCol, summaryY + i * 3.5));
        summaryY += detailLines.length * 3.5;
        if (cryptoLines.length > 0) {
          doc.setTextColor(37, 99, 235);
          cryptoLines.forEach((line, i) => doc.text(line, leftCol, summaryY + i * 3.5));
          summaryY += cryptoLines.length * 3.5;
          doc.setTextColor(80, 80, 80);
        }
        if (exemptLines.length > 0) {
          doc.setTextColor(5, 150, 105);
          exemptLines.forEach((line, i) => doc.text(line, leftCol, summaryY + i * 3.5));
          summaryY += exemptLines.length * 3.5;
          doc.setTextColor(80, 80, 80);
        }
        summaryY += 3;

        if (hasTaxRules) {
          doc.setFontSize(8);
          doc.setTextColor(0, 0, 0);
          doc.text(
            `${t('tax.socialCharges')}: ${item.tax.social_charges.toFixed(2)} €  |  ${t('tax.incomeTax')}: ${item.tax.income_tax.toFixed(2)} €  |  ${t('tax.totalTax')}: ${item.tax.total_tax.toFixed(2)} €`,
            leftCol,
            summaryY,
          );
        }

        y += boxH + 8;
      });

      // ── Pied de page sur toutes les pages ────────────────────────────────────
      const totalPages = doc.internal.getNumberOfPages();
      const footerLabel = enhanced ? `Rapport ${year}` : `${t('tax.title')} ${year}`;
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`Fructificare — ${footerLabel} — Page ${i}/${totalPages}`, margin, pageHeight - 10);
      }

      const pdfName = enhanced ? `Fructificare_Rapport_${year}.pdf` : `fructificare_rapport_fiscal_${year}.pdf`;
      const res = await saveFileWithDialog({
        data: new Uint8Array(doc.output("arraybuffer")),
        defaultPath: pdfName,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
        open: true,
        mime: "application/pdf",
      });
      if (res.cancelled) return; // annulé par l'utilisateur → ne pas comptabiliser
      dataService.trackFiscalReportGenerated();
      challengeService.trackFiscalReportGenerated();
      // Mission 4 (avril) — rapport fiscal pour l'année de référence = année courante − 1
      challengeService.trackFiscalReportForYear(year);
      questService.trackFlag('q11FiscalReportGenerated');
      toast.success(t("common.success"));
    } catch (e) {
      console.error("PDF Error:", e);
      toast.error(e.message);
    }
  };

  const fmt = (v) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);

  return (
    <div className="space-y-6" data-testid="tax-report-page">
      <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight">{t("tax.title")}</h1>
      <Card className="border border-border shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1"><Label>{t("tax.selectYear")}</Label><Input type="number" min="2000" max="2099" value={year} onChange={e => setYear(e.target.value)} data-testid="tax-year-input" /></div>
            <Button onClick={fetchReport} className="bg-primary hover:bg-primary/90" data-testid="generate-report-btn"><FileText className="w-4 h-4 mr-2" /> {t("tax.title")}</Button>
            {report && <Button onClick={downloadPdf} variant="secondary" data-testid="download-pdf-btn"><Download className="w-4 h-4 mr-2" /> {t("tax.exportPdf")}</Button>}
          </div>
          {/* Rapport de performance enrichi (opt-in) */}
          <div
            className="mt-4"
            title={!hasCalForYear ? "Aucune calibration disponible pour cette année — calibrez vos enveloppes pour activer cette option." : undefined}
          >
            <div className="flex items-center gap-2">
              <Checkbox
                id="include-perf-report"
                checked={includePerf && hasCalForYear}
                disabled={!hasCalForYear}
                onCheckedChange={(v) => setIncludePerf(!!v)}
                data-testid="include-perf-checkbox"
              />
              <Label htmlFor="include-perf-report" className={`cursor-pointer ${!hasCalForYear ? 'text-muted-foreground opacity-60 cursor-not-allowed' : ''}`}>
                {lang === 'en' ? 'Include the detailed performance report (charts and analyses)' : 'Inclure le rapport de performance détaillé (graphiques et analyses)'}
              </Label>
            </div>
            <p className="text-xs text-muted-foreground mt-1 ml-6">
              {lang === 'en' ? 'Requires calibrations for the selected year.' : "Nécessite des calibrations renseignées pour l'année sélectionnée."}
            </p>
          </div>
        </CardContent>
      </Card>

      {report && (report.length === 0 ? (
        <Card className="border-dashed border-2 border-border"><CardContent className="p-12 text-center"><p className="text-muted-foreground">{t("tax.noMovements")}</p></CardContent></Card>
      ) : report.map((item, idx) => {
        // Maturité fiscale évaluée au 31/12 de l'année du rapport
        const matLabels = taxMaturityLabels(getTaxMaturity(item.portfolio, new Date(`${year}-12-31`)), isEn);
        return (
        <Card
          key={idx}
          className={`border border-border shadow-sm ${matLabels ? 'border-l-4 border-l-emerald-500' : ''}`}
          data-testid={`tax-portfolio-${idx}`}
        >
          <CardHeader><div className="flex items-center gap-3 flex-wrap"><CardTitle className="font-heading text-lg">{item.portfolio.name}</CardTitle><Badge variant="secondary">{t(`types.${item.portfolio.type}`)}</Badge>
            {matLabels && (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1" title={matLabels.tooltip}>
                <ShieldCheck className="w-3.5 h-3.5" />
                {matLabels.badge}
              </Badge>
            )}
          </div></CardHeader>
          <CardContent className="space-y-4">
            {item.year_transactions.length > 0 && (
              <Table><TableHeader><TableRow><TableHead>{t("portfolio.date")}</TableHead><TableHead>Type</TableHead><TableHead className="text-right">{t("portfolio.amount")}</TableHead><TableHead className="hidden sm:table-cell">{t("portfolio.note")}</TableHead></TableRow></TableHeader>
              <TableBody>{item.year_transactions.map((tx, i) => (
                <TableRow key={i} className={tx.type === "withdrawal" ? "bg-rose-50 dark:bg-rose-950/20" : ""}>
                  <TableCell className="font-mono text-sm">{tx.date}</TableCell>
                  <TableCell>
                    <Badge className={tx.type === "deposit" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"}>
                      {tx.type === "deposit" ? t("portfolio.deposit") : t("portfolio.withdrawal")}
                    </Badge>
                    {estRetraitImposable(tx, item.portfolio.type) && (
                      <Badge variant="outline" className="ml-2 text-xs border-rose-300 text-rose-600">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {t("tax.withdrawalWarning")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className={`text-right font-mono tabular-nums ${tx.type === "deposit" ? "text-emerald-600" : "text-rose-600 font-bold"}`}>{tx.type === "deposit" ? "+" : "-"}{fmt(tx.amount)}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">{displayNote(tx.note, lang)}</TableCell>
                </TableRow>))}</TableBody></Table>
            )}
            <Separator />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div><p className="text-xs text-muted-foreground">{t("tax.yearDeposits")}</p><p className="font-mono font-bold tabular-nums text-emerald-600">{fmt(item.year_deposits)}</p></div>
              <div className="bg-rose-50 dark:bg-rose-950/20 p-2 rounded-lg -m-2">
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {t("tax.yearWithdrawals")}
                </p>
                <p className="font-mono font-bold tabular-nums text-rose-600">{fmt(item.year_withdrawals)}</p>
              </div>
              <div><p className="text-xs text-muted-foreground">{t("tax.allTimeDeposits")}</p><p className="font-mono font-bold tabular-nums">{fmt(item.all_time_deposits)}</p></div>
              {item.cash_balance > 0.005 && (
                <div>
                  <p className="text-xs text-muted-foreground">{t("tax.cashPocket")}</p>
                  <p className="font-mono font-bold tabular-nums text-blue-600 dark:text-blue-400">{fmt(item.cash_balance)}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">{t("tax.currentBalance")}</p>
                <p
                  className="font-mono font-bold tabular-nums text-primary"
                  title={item.is_calibrated ? undefined : (isEn ? 'Estimated from net deposits — no calibration recorded.' : 'Estimé d’après les versements nets — aucune calibration enregistrée.')}
                >
                  {item.is_calibrated ? '' : '~ '}{fmt(item.current_value)}
                </p>
              </div>
            </div>
            <Separator />
            <div className="bg-accent/50 rounded-lg p-4">
              <h4 className="font-heading font-semibold mb-2"><GlossaryTerm id="fiscalite">{t("tax.taxDetails")}</GlossaryTerm></h4>
              <p className="text-sm text-muted-foreground mb-3">{item.tax.details}</p>
              {item.has_taxable_crypto && (
                <p className="text-sm text-blue-700 dark:text-blue-400 mb-3">
                  {t('tax.cryptoDeclarationNote')
                    .replace('{annee}', String(year))
                    .replace('{suivante}', String(parseInt(year) + 1))}
                </p>
              )}
              {/* Livret réglementé : pas d'imposition à déclarer, mais des intérêts bien
                  réels. On les montre, en indiquant sans ambiguïté qu'ils sont exonérés. */}
              {item.is_tax_exempt && (
                <div className="mb-3 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 p-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      {t("tax.taxExemptBadge")}
                    </Badge>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{t("tax.exemptInterest")}</p>
                      <p className="font-mono font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                        {item.is_calibrated ? '' : '~ '}{fmt(item.exempt_interest)}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{t("tax.exemptNote")}</p>
                </div>
              )}
              {/* Lignes d'imposition masquées pour les enveloppes sans régime fiscal
                  pré-calculé (personnalisées, livrets réglementés). */}
              {item.tax.has_rules !== false && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div><p className="text-xs text-muted-foreground"><GlossaryTerm id="plus_value">{t("tax.estimatedGains")}</GlossaryTerm></p><p className="font-mono font-bold tabular-nums">{fmt(item.estimated_gains)}</p></div>
                  <div><p className="text-xs text-muted-foreground"><GlossaryTerm id="prelevements_sociaux">{t("tax.socialCharges")}</GlossaryTerm></p><p className="font-mono font-bold tabular-nums">{fmt(item.tax.social_charges)}</p></div>
                  <div><p className="text-xs text-muted-foreground">{t("tax.incomeTax")}</p><p className="font-mono font-bold tabular-nums">{fmt(item.tax.income_tax)}</p></div>
                  <div><p className="text-xs text-muted-foreground">{t("tax.totalTax")}</p><p className="font-mono font-bold tabular-nums text-destructive">{fmt(item.tax.total_tax)}</p></div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        );
      }))}
      <Disclaimer />
    </div>
  );
}

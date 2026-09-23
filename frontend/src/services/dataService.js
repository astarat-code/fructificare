// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
const DEFAULT_RATES = { PEA: 8, CTO: 8, assurance_vie: 4, PER: 4, custom: 0, compte_réglementé: 2.4 };

// Types d'actifs disponibles
// Liste UNIQUE des types d'actifs, proposée par tous les formulaires (mouvement, mouvement
// type, récurrent, répartition multi-actifs, calibration). Libellés : i18n `assetTypes.*`.
const ASSET_TYPES = ['fond_euro', 'obligation', 'action', 'etf', 'crypto', 'immobilier', 'scpi', 'or', 'exotique', 'autre'];
const PEA_MAX = 150000;

// ── Palettes de couleurs des enveloppes ──────────────────────────────────────
// Source unique de vérité : ces couleurs correspondent à celles des graphiques.
// Tout composant doit importer la palette depuis ce service (jamais en dur).
// Deux styles au choix (préférence appPreferences.colorStyle) :
//   • 'classic' → ENVELOPE_PALETTE (palette d'origine, vive et saturée)
//   • défaut / 'pastel' → PASTEL_PALETTE (palette pastel moderne)
// Les deux palettes sont ALIGNÉES PAR INDICE (même teinte, saturation différente),
// ce qui permet de basculer les couleurs des enveloppes existantes d'un style à
// l'autre en un clic (voir applyColorStyle). Les couleurs personnalisées (hors
// palette) ne sont jamais modifiées.
const ENVELOPE_PALETTE = ['#059669', '#D97706', '#0284C7', '#7C3AED', '#DB2777', '#EA580C', '#14B8A6', '#8B5CF6', '#6366F1', '#EC4899'];
// ── Palette « pastel » par défaut ─────────────────────────────────────────────
// Tons sourds, modernes et sérieux — adaptés à un logiciel d'investissement.
// Alignée par indice sur ENVELOPE_PALETTE (permet la bascule classique ↔ pastel).
// Sauge · Acier · Indigo · Sarcelle · Ambre · Terracotta · Prune · Ardoise · Olive · Lavande
const PASTEL_PALETTE = ['#5FA88D', '#5B8CB8', '#7C7FC0', '#4FA6A0', '#CBA25C', '#C8846E', '#B079A0', '#7E93AD', '#97A65E', '#A07EB8'];
/** Couleur de police par défaut sur fond de couleur d'enveloppe (foncée). */
const ENVELOPE_TEXT_COLOR = '#05040D';

/** Palette active selon la préférence de style (défaut = pastel). */
function _activePalette() {
  return _appPreferences.colorStyle === 'classic' ? ENVELOPE_PALETTE : PASTEL_PALETTE;
}

/** Palette active exposée aux composants (sélecteur de couleur, défauts de formulaire). */
function getEnvelopePalette() {
  return [..._activePalette()];
}

// ── Couleurs des TYPES D'ACTIFS (diagrammes) ─────────────────────────────────
// Mapping STABLE type → indice de palette : chaque type d'actif garde la même
// couleur sur tous les diagrammes, et cette couleur provient de la palette
// ACTIVE (pastel ou classique) → cohérence graphique avec les enveloppes.
const ASSET_TYPE_INDEX = {
  action:     1,  // acier
  obligation: 0,  // sauge
  fond_euro:  8,  // olive
  immobilier: 5,  // terracotta
  crypto:     2,  // indigo
  etf:        3,  // turquoise
  or:         4,  // ambre
  exotique:   6,  // prune
  autre:      7,  // ardoise
  scpi:       9,  // lavande
};

/**
 * Couleur stable d'un type d'actif, issue de la palette active.
 * 'non_defini' / type absent → gris neutre. Type personnalisé → indice dérivé
 * (hash stable) pour rester constant d'un rendu à l'autre.
 * @param {string} type
 * @param {number} [i=0] repli positionnel
 */
function getAssetColor(type, i = 0) {
  if (!type || type === 'non_defini') return '#94A3B8';
  const palette = _activePalette();
  let idx = ASSET_TYPE_INDEX[type];
  if (idx == null) {
    let h = 0;
    for (let k = 0; k < String(type).length; k++) h = (h * 31 + String(type).charCodeAt(k)) >>> 0;
    idx = h % palette.length;
  }
  return palette[idx % palette.length] || palette[i % palette.length];
}

/**
 * Bascule le style de couleurs et re-mappe les couleurs des enveloppes existantes
 * d'une palette à l'autre PAR INDICE (classique ↔ pastel). Les couleurs hors
 * palette (personnalisées) sont préservées. Persiste et retourne le nb d'enveloppes
 * recolorées.
 * @param {'classic'|'pastel'} style
 */
function applyColorStyle(style) {
  const target = style === 'classic' ? 'classic' : 'pastel';
  _appPreferences = { ..._appPreferences, colorStyle: target };
  const from = target === 'classic' ? PASTEL_PALETTE   : ENVELOPE_PALETTE;
  const to   = target === 'classic' ? ENVELOPE_PALETTE : PASTEL_PALETTE;
  const lc = (c) => (c || '').toLowerCase();
  let recolored = 0;
  (_currentData.portfolios || []).forEach(p => {
    if (!p || !p.color) return;
    const idx = from.findIndex(c => lc(c) === lc(p.color));
    if (idx !== -1 && to[idx]) { p.color = to[idx]; recolored++; }
  });
  saveData();
  return recolored;
}

/** Retourne la 1re couleur de palette non utilisée ; cycle si toutes sont prises. */
function _nextEnvelopeColor(existing) {
  const palette = _activePalette();
  const used = new Set((existing || []).map(p => p && p.color).filter(Boolean));
  return palette.find(c => !used.has(c)) || palette[(existing || []).length % palette.length];
}

/** Affecte une couleur de palette à toute enveloppe sans couleur (mutation en place). */
function _ensurePortfolioColors(portfolios) {
  if (!Array.isArray(portfolios)) return;
  const palette = _activePalette();
  const used = new Set(portfolios.map(p => p && p.color).filter(Boolean));
  let i = 0;
  for (const p of portfolios) {
    if (p && !p.color) {
      let c = palette.find(col => !used.has(col));
      if (!c) { c = palette[i % palette.length]; i++; }
      p.color = c;
      used.add(c);
    }
  }
}

// ── Taux fiscaux centraux — mis à jour janvier 2026 ──────────────────────────
// Ne jamais dupliquer ces valeurs en dur dans d'autres fichiers ; importer depuis ici.
const PS_RATE  = 0.186; // 18,6 % — prélèvements sociaux (loi de finances 2026)
const IR_RATE  = 0.128; // 12,8 % — impôt sur le revenu (PFU)
const FLAT_TAX = 0.314; // 31,4 % — Prélèvement Forfaitaire Unique (12,8 % IR + 18,6 % PS)

// ============ FORMULES D'INTÉRÊTS COMPOSÉS (équivalent numpy_financial) ============

/**
 * Taux mensuel EFFECTIF exact tel que (1 + mensuel)^12 = (1 + annuel).
 * Ainsi un « 8 %/an » donne pile +8 % après 12 mois (et non 8,30 % avec un simple /12).
 * @param {number} annual — taux annuel en DÉCIMAL (0.08 = 8 %). Peut être négatif.
 */
function _effMonthlyRate(annual) {
  return (1 + annual) > 0 ? Math.pow(1 + annual, 1 / 12) - 1 : annual / 12;
}

/**
 * Calcul de la valeur future avec intérêts composés
 * Équivalent à numpy_financial.fv(rate, nper, pmt, pv)
 * 
 * Formule: FV = PV * (1 + r)^n + PMT * ((1 + r)^n - 1) / r
 * 
 * @param {number} rate - Taux d'intérêt par période (ex: 0.08/12 pour 8% annuel mensuel)
 * @param {number} nper - Nombre de périodes
 * @param {number} pmt - Versement par période (positif = versement)
 * @param {number} pv - Valeur présente / capital initial (positif = investissement)
 * @returns {number} - Valeur future
 */
function fv(rate, nper, pmt, pv) {
  if (rate === 0) {
    return pv + pmt * nper;
  }
  const factor = Math.pow(1 + rate, nper);
  return pv * factor + pmt * ((factor - 1) / rate);
}

/**
 * Calcul des intérêts composés avec capitalisation mensuelle
 * 
 * @param {number} initialCapital - Capital initial
 * @param {number} monthlyPayment - Versement mensuel
 * @param {number} annualRate - Taux de rendement annuel (ex: 8 pour 8%)
 * @param {number} annualFees - Frais annuels (ex: 0.5 pour 0.5%)
 * @param {number} months - Nombre de mois
 * @returns {object} - { totalValue, totalDeposits, totalInterest }
 */
function calculateCompoundInterest(initialCapital, monthlyPayment, annualRate, annualFees, months) {
  // Taux mensuel EFFECTIF net : (1+mensuel)^12 = (1+annuel net)
  const netAnnualRate = (annualRate - annualFees) / 100;
  const monthlyRate = _effMonthlyRate(netAnnualRate);
  
  // Calcul avec la formule d'intérêts composés
  const futureValue = fv(monthlyRate, months, monthlyPayment, initialCapital);
  const totalDeposits = initialCapital + (monthlyPayment * months);
  const totalInterest = futureValue - totalDeposits;
  
  return {
    totalValue: Math.round(futureValue * 100) / 100,
    totalDeposits: Math.round(totalDeposits * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
  };
}

// ============ RÈGLES DE TAXATION PAR TYPE DE PORTEFEUILLE ============
// Mis à jour janvier 2026 : PS = 18.6%, Flat tax = 31,4%

/**
 * Calcul de l'imposition selon le type de portefeuille
 * 
 * @param {string} type - Type de portefeuille (PEA, CTO, Crypto, assurance_vie, PER)
 * @param {number} totalValue - Valeur totale du portefeuille
 * @param {number} totalDeposits - Total des versements
 * @param {number} holdingYears - Nombre d'années de détention
 * @returns {object} - { grossGains, tax, netValue, taxRate }
 */
function calculateTaxation(type, totalValue, totalDeposits, holdingYears = 5) {
  const grossGains = Math.max(0, totalValue - totalDeposits);
  let tax = 0;
  let taxRate = 0;
  let taxDetails = '';
  
  if (grossGains <= 0) {
    return { grossGains: 0, tax: 0, netValue: totalValue, taxRate: 0, taxDetails: 'Aucun gain' };
  }
  
  switch (type) {
    case 'PEA':
      // PEA après 5 ans: 18.6% prélèvements sociaux uniquement
      // PEA avant 5 ans: 31,4% flat tax
      if (holdingYears >= 5) {
        taxRate = PS_RATE;
        taxDetails = 'PEA > 5 ans: 18.6% PS';
      } else {
        taxRate = FLAT_TAX;
        taxDetails = 'PEA < 5 ans: 31,4% PFU';
      }
      tax = grossGains * taxRate;
      break;
      
    case 'CTO':
      // CTO: 31,4% flat tax (12.8% IR + 18.6% PS)
      taxRate = FLAT_TAX;
      tax = grossGains * taxRate;
      taxDetails = 'CTO: 31,4% PFU';
      break;
      
    case 'assurance_vie': {
      // Assurance Vie après 8 ans:
      // - 18.6% PS sur tous les gains
      // - 7.5% IR sur gains > 4600€ (célibataire) ou 9200€ (couple)
      // Avant 8 ans: 31,4% PFU
      const ps = grossGains * PS_RATE;
      
      if (holdingYears >= 8) {
        const abattement = 4600; // Abattement annuel (célibataire)
        if (totalDeposits < 150000) {
          if (grossGains <= abattement) {
            tax = ps;
            taxDetails = `AV > 8 ans: 18.6% PS (gains < abatt. ${abattement}€)`;
          } else {
            const ir = (grossGains - abattement) * 0.075;
            tax = ps + ir;
            taxDetails = `AV > 8 ans: 18.6% PS + 7.5% IR (abatt. ${abattement}€)`;
          }
        } else {
          // Versements > 150 000€
          const part150k = (150000 / totalDeposits) * grossGains;
          const partExcedent = ((totalDeposits - 150000) / totalDeposits) * grossGains;
          if (grossGains <= abattement) {
            tax = ps;
            taxDetails = `AV > 8 ans (>150k€): 18.6% PS`;
          } else {
            const ir = ((part150k - abattement) * 0.075) + (partExcedent * 0.128);
            tax = ps + ir;
            taxDetails = `AV > 8 ans (>150k€): 18.6% PS + IR mixte`;
          }
        }
        taxRate = tax / grossGains;
      } else {
        taxRate = FLAT_TAX;
        tax = grossGains * taxRate;
        taxDetails = 'AV < 8 ans: 31,4% PFU';
      }
      break;
    }
      
    case 'PER':
      // PER: les gains sont imposés au barème progressif de l'IR lors du retrait
      // Simplification: on considère 31,4% comme pour CTO
      taxRate = FLAT_TAX;
      tax = grossGains * taxRate;
      taxDetails = 'PER: 31,4% (estimation)';
      break;
      
    default:
      taxRate = 0;
      tax = 0;
      taxDetails = 'Non imposé';
  }
  
  return {
    grossGains: Math.round(grossGains * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    netValue: Math.round((totalValue - tax) * 100) / 100,
    taxRate: Math.round(taxRate * 10000) / 100, // En pourcentage
    taxDetails,
  };
}

import storageService from './storageService';
import gamificationService from './gamificationService';
import { validateBackup } from './importValidation';
import documentService from './documentService';
import { versementsPea } from '../lib/peaCap';
import { estRetraitImposable } from '../lib/taxableWithdrawal';
import { plusValuesDeLAnnee } from '../lib/plusValuesRachats';
import { getTaxMaturity } from '../lib/taxMaturity';
import { systemLanguage } from '../lib/systemLanguage';
// questService est importé lazily (évite la dépendance circulaire questService → dataService)
function _getQuestService() {
  try { return require('./questService').default; } catch (_) { return null; }
}
// trophyService est importé lazily (évite la dépendance circulaire trophyService → dataService)
function _getTrophyService() {
  try { return require('./trophyService').default; } catch (_) { return null; }
}
// healthScoreService est importé lazily (évite la dépendance circulaire healthScoreService → dataService)
function _getHealthScoreService() {
  try { return require('./healthScoreService').default; } catch (_) { return null; }
}

// ============ IN-MEMORY DATA (JSON export/import is the sole persistence) ============

let _currentData = { portfolios: [], transactions: [], movement_templates: [], calibrations: [], reminders: [], budget_entries: [], programmed_movements: [], calendar_notes: [], regular_movements: [], rule843_sims: [], documents: [], fire_settings: { monthly_need: 2500, withdrawal_rate: 4 } };
let _simulationsData = { simulations: [] };
// Cache des stats de simulation : évite de recalculer une simulation déjà calculée
// (les services Trophées/Notifications bouclent sur TOUTES les simulations à chaque
// événement de gamification, même hors de la page Simulation). Clé invalidée par
// updated_at de la simulation + paramètres FIRE globaux.
const _simStatsCache = new Map();
let _hasUnsavedChanges = false;
// Set to true when a loaded JSON had no regular_movements (old format) and movements existed in memory
let _regularMovementsResetOnLastLoad = false;
let _logs = [];

// ── Préférences applicatives (thème + langue) ────────────────────────────────
// Persistées dans le JSON principal sous la clé "appPreferences".
// Valeur null = non encore définie (utilise le défaut du composant). Sauf la langue, qui
// suit celle du système tant que l'utilisateur n'en a pas choisi une.
// colorStyle : null/'pastel' = palette pastel moderne ; 'classic' = palette d'origine vive.
// includeRegulatedInPerf : inclure les livrets réglementés dans la « Valeur totale » et
//   le rendement global du tableau de bord (défaut : true — AFFICHAGE uniquement, sans
//   effet sur le rapport fiscal, qui traite toujours les livrets séparément).
let _appPreferences = { theme: null, language: systemLanguage(), colorStyle: null, includeRegulatedInPerf: true };

function getAppPreferences() {
  return { ..._appPreferences };
}

function saveAppPreferences(patch) {
  _appPreferences = { ..._appPreferences, ...patch };
  saveData(); // debounce 2 s via storageService
}

function _restoreAppPreferences(saved) {
  _appPreferences = { ..._appPreferences, ...saved };
  // Un fichier enregistré avant tout choix de langue porte « language: null » : sans ce
  // garde, il écraserait la langue du système et l'application repasserait en français.
  if (_appPreferences.language !== 'fr' && _appPreferences.language !== 'en') {
    _appPreferences.language = systemLanguage();
  }
  try { gamificationService.dispatchEvent('appPreferencesLoaded', { ..._appPreferences }); } catch (_) {}
}

// ============ DOCUMENTS (PDF locaux) ============
// Seules les MÉTADONNÉES sont stockées ici et dans le JSON ; les PDF vivent sur disque
// (documents/…), gérés par documentService. Forme d'un document :
//   { id, date:'YYYY-MM-DD', type, type_label, name, original_filename,
//     portfolio_id:string|null, rel_path:'documents/slug/fichier.pdf', filename, created_at }

const DOCUMENT_TYPES = [
  { id: 'releve_compte',  fr: 'Relevé de compte / Relevé de titres', en: 'Account / securities statement' },
  { id: 'avis_opere',     fr: "Avis d'opéré",                          en: 'Trade confirmation' },
  { id: 'releve_fiscal',  fr: 'Relevé fiscal / IFU',                   en: 'Tax statement / IFU' },
  { id: 'rapport_annuel', fr: "Rapport annuel / Document d'information", en: 'Annual report / KID' },
  { id: 'autre',          fr: 'Autre',                                 en: 'Other' },
];

/** Transforme un texte en slug (sans accents, minuscules, tirets). */
function slugify(str) {
  return (str || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // retire les accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'document';
}

/**
 * Nom de sous-dossier d'une enveloppe, dans « documents imp ».
 *
 * CONFIDENTIALITÉ : ce nom est dérivé de l'IDENTIFIANT, jamais du nom de l'enveloppe.
 * Les PDF qu'il contient (relevés, avis d'opéré, IFU) ne sont pas chiffrés ; un nom
 * comme « trade-republic-f529 » aurait révélé le courtier de l'utilisateur à la simple
 * lecture de l'explorateur de fichiers, sans même ouvrir un document.
 *
 * L'identifiant est un UUID : unique par construction, et il ne dit rien.
 */
function getPortfolioSlug(portfolio) {
  if (!portfolio) return 'global';
  const id = String(portfolio.id || '').replace(/[^A-Za-z0-9-]/g, '');
  return id ? `env-${id}` : 'global';
}

/**
 * Aligne les dossiers de documents sur le nommage neutre (voir getPortfolioSlug).
 *
 * Migration ponctuelle, à lancer une fois au démarrage : les installations créées
 * avant ce changement ont des dossiers portant le nom de l'enveloppe, ce qui révèle
 * le courtier dans l'explorateur de fichiers alors que les PDF ne sont pas chiffrés.
 *
 * @returns {Promise<{ deplaces:number, echecs:number }>}
 */
async function migrateDocumentFolders() {
  const documents = getDocuments();
  if (documents.length === 0) return { deplaces: 0, echecs: 0 };

  const parId = new Map(getPortfolios().map(p => [p.id, p]));
  const slugAttendu = (portfolioId) =>
    (portfolioId && parId.has(portfolioId) ? getPortfolioSlug(parId.get(portfolioId)) : 'global');

  const { updated, deplaces, echecs } = await documentService.migrateDocumentFolders(documents, slugAttendu);
  if (updated.length > 0) {
    const nouveaux = new Map(updated.map(u => [u.id, u.rel_path]));
    _currentData.documents = documents.map(d =>
      (nouveaux.has(d.id) ? { ...d, rel_path: nouveaux.get(d.id) } : d));
    saveData();
    addLog(`DOCUMENT_FOLDERS_MIGRATED: ${deplaces} deplace(s), ${echecs} echec(s)`);
  }
  return { deplaces, echecs };
}

function getDocuments() {
  return _currentData.documents || [];
}

function getDocumentsForPortfolio(portfolioId) {
  return (_currentData.documents || []).filter(d => d.portfolio_id === portfolioId);
}

function addDocument(meta) {
  if (!Array.isArray(_currentData.documents)) _currentData.documents = [];
  _currentData.documents.push(meta);
  addLog(`DOCUMENT_ADDED: ${meta.id} (${meta.type})`);
  saveData();
  return meta;
}

function removeDocument(id) {
  const before = (_currentData.documents || []).length;
  _currentData.documents = (_currentData.documents || []).filter(d => d.id !== id);
  if (_currentData.documents.length !== before) {
    addLog(`DOCUMENT_REMOVED: ${id}`);
    saveData();
  }
}

function updateDocument(id, patch) {
  const docs = _currentData.documents || [];
  const i = docs.findIndex(d => d.id === id);
  if (i < 0) return null;
  docs[i] = { ...docs[i], ...patch };
  addLog(`DOCUMENT_UPDATED: ${id}`);
  saveData();
  return docs[i];
}

/**
 * Indique à createTransaction de NE PAS déclencher le hook gamification
 * (utilisé par createRecurringTransactions qui déclenche le hook une seule fois
 * pour l'ensemble de la série, quelle que soit le nombre d'occurrences).
 */
let _gamificationBatchMode = false;

function getData() {
  return _currentData;
}

/**
 * Supprime les calibrations orphelines (dont l'enveloppe n'existe plus).
 * Garantit qu'aucun historique de calibration d'une enveloppe supprimée ne
 * réapparaît, y compris pour des données antérieures à la suppression en cascade.
 */
function _pruneOrphanCalibrations() {
  const ids  = new Set((_currentData.portfolios || []).map(p => p.id));
  const cals = _currentData.calibrations || [];
  const kept = cals.filter(c => ids.has(c.portfolio_id));
  if (kept.length !== cals.length) {
    _currentData.calibrations = kept;
  }
}

function setData(data) {
  _currentData = {
    portfolios: data.portfolios || [],
    transactions: data.transactions || [],
    movement_templates: data.movement_templates || [],
    calibrations: data.calibrations || [],
    reminders: data.reminders || [],
    budget_entries: data.budget_entries || [],
    programmed_movements: data.programmed_movements || [],
    calendar_notes: data.calendar_notes || [],
    regular_movements: data.regular_movements || [],
    rule843_sims: data.rule843_sims || [],
    documents: data.documents || [],
    fire_settings: data.fire_settings || { monthly_need: 2500, withdrawal_rate: 4 },
  };
  _pruneOrphanCalibrations();
  // Restaurer les préférences applicatives si présentes
  if (data.appPreferences && typeof data.appPreferences === 'object') {
    _restoreAppPreferences(data.appPreferences);
  }
}

function saveData() {
  _hasUnsavedChanges = true;
  // Auto-save différé (debounce 2 s) via storageService
  storageService.scheduleSave(() => JSON.stringify(buildExportPayload(), null, 2));
}

// Le profil (revenu, naissance, allocation cible) et les autres champs sensibles de la
// gamification ne sont plus écrits en clair dans localStorage (B-04) : leur seul support
// durable est la sauvegarde JSON. On demande donc à gamificationService de déclencher une
// réécriture de cette sauvegarde dès qu'un tel champ change. Sens unique : dataService
// importe gamificationService, jamais l'inverse.
// (Le `typeof` protège les harnais de test qui évaluent ce fichier après avoir retiré ses
// imports — gamificationService y est alors un identifiant non déclaré.)
if (typeof gamificationService !== 'undefined' && gamificationService.setPersistHook) {
  gamificationService.setPersistHook(saveData);
}

function hasUnsavedChanges() {
  return _hasUnsavedChanges;
}

function markAsSaved() {
  _hasUnsavedChanges = false;
}

// ============ LOGS ============

/**
 * Journal de diagnostic, exportable par l'utilisateur depuis les Paramètres.
 *
 * NE JAMAIS Y ÉCRIRE DE DONNÉE SENSIBLE : ni montant, ni nom d'enveloppe, ni nom de
 * fichier. Ce journal est exporté en texte clair — y compris quand le chiffrement des
 * sauvegardes est actif — et c'est typiquement le fichier qu'on transmet à un tiers
 * pour signaler une anomalie. Un identifiant et un type d'opération suffisent à
 * reconstituer un enchaînement.
 */
function addLog(msg) {
  _logs.push({ timestamp: new Date().toISOString(), message: msg });
  if (_logs.length > 5000) _logs = _logs.slice(-5000);
}

function getLogs() {
  return [..._logs];
}

// ============ FILE SAVE/LOAD ============

/**
 * Diagnostic de taille du JSON de sauvegarde (perf démarrage — item 7d).
 * Retourne { bytes, kb, breakdown } ; `breakdown` (Ko par clé de 1er niveau,
 * trié décroissant) n'est calculé que si la taille dépasse 500 Ko.
 */
function getDataSizeDiagnostic() {
  try {
    const payload = buildExportPayload();
    const sizeOf = (o) => {
      const s = JSON.stringify(o);
      return (typeof Blob !== 'undefined') ? new Blob([s]).size : s.length;
    };
    const bytes = sizeOf(payload);
    const info = { bytes, kb: Math.round(bytes / 1024), breakdown: null };
    if (bytes > 500 * 1024) {
      const breakdown = {};
      for (const key of Object.keys(payload)) breakdown[key] = Math.round(sizeOf(payload[key]) / 1024);
      info.breakdown = Object.fromEntries(Object.entries(breakdown).sort((a, b) => b[1] - a[1]));
    }
    return info;
  } catch { return null; }
}

/** Journalise la taille du JSON au démarrage ; alerte (console.warn) si > 500 Ko. */
function logDataSizeDiagnostic() {
  const info = getDataSizeDiagnostic();
  if (!info) return;
  if (info.breakdown) {
    console.warn(`[storage] Sauvegarde volumineuse : ${info.kb} Ko (> 500 Ko). Répartition par clé (Ko) :`, info.breakdown);
  } else {
    console.info(`[storage] Taille de la sauvegarde : ${info.kb} Ko`);
  }
}

/**
 * Construit le payload d'export (objet JS, non sérialisé).
 * Utilisé par downloadDataAsFile() et storageService.scheduleSave().
 */
function buildExportPayload() {
  const portfolios = getPortfolios();
  const { transactions, movement_templates, calibrations } = getData();
  return {
    portfolios: portfolios.map(p => ({
      ...p,
      saved_total_deposits:    p.total_deposits,
      saved_total_withdrawals: p.total_withdrawals,
      saved_balance:           p.balance,
      saved_total_fees:        p.total_fees,
    })),
    transactions:         transactions,
    movement_templates:   movement_templates   || [],
    calibrations:         calibrations         || [],
    // ── Calendar data ────────────────────────────────────────────────────────
    // reminders            → rappels utilisateur + rappel auto de calibration
    // budget_entries       → dépenses/apports du budget mensuel (entry_type: 'expense'|'income')
    // programmed_movements → mouvements planifiés récurrents liés aux enveloppes
    // ─────────────────────────────────────────────────────────────────────────
    reminders:            getData().reminders            || [],
    budget_entries:       getData().budget_entries       || [],
    programmed_movements: getData().programmed_movements || [],
    calendar_notes:       getData().calendar_notes       || [],
    regular_movements:    getData().regular_movements    || [],
    rule843_sims:         getData().rule843_sims         || [],
    documents:            getData().documents            || [],
    fire_settings:        getData().fire_settings        || { monthly_need: 2500, withdrawal_rate: 4 },
    simulations:          _simulationsData.simulations   || [],
    // ── Gamification (état complet, séparé des données financières) ──────────
    gamification:         gamificationService.exportForJSON(),
    // ── Préférences applicatives (thème + langue) — restaurées au chargement ─
    appPreferences:       { ..._appPreferences },
    export_date:          new Date().toISOString(),
    version:              '2.4',
  };
}

async function downloadDataAsFile() {
  // Passe par storageService : si le chiffrement est actif, le fichier téléchargé doit
  // l'être aussi — sinon l'export serait une copie en clair de tout le patrimoine.
  const payload = await storageService.serializeForExport(
    JSON.stringify(buildExportPayload(), null, 2),
  );
  const blob = new Blob([payload], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `fructificare_data_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  addLog('DATA_EXPORTED: fichier téléchargé');
  markAsSaved();
}

/**
 * Applique un objet de sauvegarde déjà parsé (JSON) à l'état de l'application :
 * enveloppes, transactions, calibrations, simulations, gamification, préférences.
 * @param {object} data — payload de sauvegarde
 * @param {{ save?: boolean }} [opts] — save=true : réécrit immédiatement une sauvegarde
 *        (import manuel) ; save=false : chargement au démarrage (on ne réécrit pas).
 * @returns {object|null} les données appliquées, ou null si le format est invalide.
 */
// Bilan du dernier import : nombre d'entrees ecartees par collection, pour affichage.
let _lastImportReport = { dropped: {}, totalDropped: 0 };

/** Bilan d'assainissement du dernier appel a applyImportedData(). */
function getLastImportReport() {
  return { ..._lastImportReport, dropped: { ..._lastImportReport.dropped } };
}

function applyImportedData(rawData, { save = true } = {}) {
  if (!rawData || !Array.isArray(rawData.portfolios)) return null;

  // Assainissement AVANT toute lecture : voir importValidation.js. Les entrees
  // structurellement invalides sont ecartees et comptees, pas propagees.
  const { data, dropped, totalDropped } = validateBackup(rawData);
  _lastImportReport = { dropped, totalDropped };
  if (totalDropped > 0) {
    addLog(`IMPORT_SANITIZED: ${totalDropped} entree(s) ecartee(s) — ${JSON.stringify(dropped)}`);
  }

  const cleanPortfolios = data.portfolios.map(p => ({
    id: p.id,
    name: p.name,
    type: p.type,
    created_date: p.created_date,
    contract_start_date: p.contract_start_date,
    annual_fees_pct: parseFloat(p.annual_fees_pct) || 0,
    annual_fees_type: p.annual_fees_type === 'euro' ? 'euro' : 'percent',
    annual_return_rate: parseFloat(p.annual_return_rate) || DEFAULT_RATES[p.type] || 0,
    regulated_subtype: p.regulated_subtype ?? null,
    include_in_tax_report: p.include_in_tax_report !== false,
    color: p.color || null,
  }));
  _ensurePortfolioColors(cleanPortfolios);

  const hadMovementsInMemory = getRegularMovements().length > 0;
  _regularMovementsResetOnLastLoad = hadMovementsInMemory && !Array.isArray(data.regular_movements);

  const importedData = {
    portfolios: cleanPortfolios,
    transactions: data.transactions || [],
    movement_templates: data.movement_templates || [],
    calibrations: data.calibrations || [],
    reminders: data.reminders || [],
    budget_entries: data.budget_entries || [],
    programmed_movements: data.programmed_movements || [],
    calendar_notes: data.calendar_notes || [],
    regular_movements: data.regular_movements || [],
    rule843_sims: data.rule843_sims || [],
    documents: data.documents || [],
    fire_settings: data.fire_settings || { monthly_need: 2500, withdrawal_rate: 4 },
  };

  _currentData = importedData;
  _pruneOrphanCalibrations();

  if (data.simulations && Array.isArray(data.simulations)) {
    _simulationsData = { simulations: data.simulations };
  }
  addLog(`DATA_LOADED: ${importedData.portfolios.length} portfolios, ${importedData.transactions.length} transactions, ${(importedData.calibrations || []).length} calibrations`);

  if (data.gamification) {
    gamificationService.importFromJSON(data.gamification);
  }
  if (data.appPreferences && typeof data.appPreferences === 'object') {
    _restoreAppPreferences(data.appPreferences);
  }

  if (save) storageService.save(JSON.stringify(buildExportPayload(), null, 2));
  return importedData;
}

function loadDataFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = await storageService.deserializeImported(e.target.result);
        const result = applyImportedData(data, { save: true });
        if (result) resolve(result);
        else reject(new Error('Format de fichier invalide - pas de portfolios'));
      } catch (err) {
        reject(new Error('Erreur de parsing JSON: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
    reader.readAsText(file);
  });
}

/**
 * Charge au DÉMARRAGE la sauvegarde la plus récente (Tauri : dossier save/ ;
 * navigateur FSA : dernier fichier configuré). Sans effet en mode fallback.
 * @returns {Promise<object|null>} les données chargées, ou null si aucune.
 */
async function loadMostRecentSave() {
  try {
    const data = await storageService.load();
    if (data && Array.isArray(data.portfolios)) {
      // save:false — on vient de charger, inutile de réécrire la sauvegarde.
      return applyImportedData(data, { save: false });
    }
  } catch (e) {
    addLog('BOOT_LOAD_ERROR: ' + (e?.message || e));
  }
  return null;
}

function hasData() {
  return _currentData.portfolios.length > 0 || _currentData.transactions.length > 0;
}

function clearAllData() {
  _currentData = { portfolios: [], transactions: [], movement_templates: [], calibrations: [], reminders: [], budget_entries: [], programmed_movements: [], calendar_notes: [], regular_movements: [], rule843_sims: [], documents: [], fire_settings: { monthly_need: 2500, withdrawal_rate: 4 } };
  _simulationsData = { simulations: [] };
  _simStatsCache.clear();
  addLog('DATA_CLEARED');
}

/**
 * Réinitialisation COMPLÈTE de toutes les données applicatives, puis persistance
 * de l'état vide (évite qu'une ancienne sauvegarde ne réapparaisse au prochain
 * chargement / que les mouvements récurrents ou programmés ne se ré-appliquent).
 *
 * Supprime : enveloppes, historique des mouvements, calibrations, mouvements
 * récurrents (tableau de bord ET simulations), mouvements types (tableau de bord
 * ET simulations — inclus dans les objets simulation), mouvements programmés,
 * entrées de budget, rappels, notes de calendrier, ainsi que TOUTES les simulations.
 * La progression (gamification) et les préférences (thème/langue) sont conservées.
 */
function fullReset() {
  clearAllData();          // vide _currentData (récurrents + types + programmés + budget…) et _simulationsData
  _hasUnsavedChanges = true;
  saveData();              // persiste l'état vide via storageService
  addLog('FULL_RESET: toutes les données applicatives ont été supprimées');
}

// Réinitialiser tous les portefeuilles (supprimer les transactions, calibrations et simulations)
function resetAllPortfolios() {
  const store = getData();
  // Garder les portefeuilles mais supprimer transactions ET calibrations
  store.transactions = [];
  store.calibrations = [];
  saveData();
  _simulationsData = { simulations: [] };

  addLog('PORTFOLIOS_RESET: Toutes les transactions, calibrations et simulations ont été supprimées');
}

// ============ PORTFOLIOS ============

/**
 * Frais annuels de gestion cumulés portés par les TRANSACTIONS elles-mêmes
 * (indépendamment des frais annuels de l'enveloppe) :
 *   • mode 'percent' : montant net × (taux/100) × années détenues, par transaction.
 *   • mode 'euro'    : montant fixe €/an appliqué UNE seule fois par mouvement source
 *                      (from_recurring_id) — jamais par occurrence — sur la durée de
 *                      détention depuis la 1re occurrence.
 * Fonction pure (dépend uniquement des transactions passées) : réutilisable pour les
 * totaux par note et par enveloppe.
 * @param {Array} txns — transactions (ou sous-ensemble, ex. filtré par note)
 * @param {Date}  [nowRef] — date de référence (défaut : aujourd'hui)
 * @returns {number} frais annuels cumulés (€)
 */
function getTransactionAnnualFees(txns, nowRef) {
  const today = nowRef || new Date();
  let acc = 0;
  const euroGroups = {};
  (txns || []).forEach(t => {
    if (t.type !== 'deposit') return;
    if (t.annual_fees_type === 'euro') {
      const euro = parseFloat(t.annual_fees_pct) || 0;
      if (euro <= 0) return;
      // Regrouper par mouvement source : un récurrent (from_recurring_id), sinon un
      // mouvement multi-actifs (movement_group_id), sinon la transaction seule. Les
      // sous-transactions d'un même mouvement d'une même date sont ainsi additionnées
      // et le frais fixe n'est compté qu'UNE fois pour tout le mouvement.
      const key = t.from_recurring_id || t.movement_group_id || `tx_${t.id}`;
      if (!euroGroups[key]) euroGroups[key] = { perDate: {}, firstDate: t.date };
      const g = euroGroups[key];
      g.perDate[t.date] = (g.perDate[t.date] || 0) + euro;
      if (t.date < g.firstDate) g.firstDate = t.date;
    } else {
      const rate = (parseFloat(t.annual_fees_pct) || 0) / 100;
      if (rate <= 0) return;
      const txDate = new Date(t.date);
      const monthsHeld = Math.max(0, (today.getFullYear() - txDate.getFullYear()) * 12 + (today.getMonth() - txDate.getMonth()));
      acc += (t.net_amount ?? t.amount ?? 0) * rate * (monthsHeld / 12);
    }
  });
  Object.values(euroGroups).forEach(g => {
    const euroPerYear = g.perDate[g.firstDate] || 0;
    const fd = new Date(g.firstDate);
    const monthsHeld = Math.max(0, (today.getFullYear() - fd.getFullYear()) * 12 + (today.getMonth() - fd.getMonth()));
    acc += euroPerYear * (monthsHeld / 12);
  });
  return Math.round(acc * 100) / 100;
}

function getPortfolios() {
  const { portfolios, transactions } = getData();
  _ensurePortfolioColors(portfolios); // garantit une couleur stable sur chaque enveloppe
  return portfolios.map(p => {
    const txns = transactions.filter(t => t.portfolio_id === p.id);
    // Pour les versements: on prend le montant net (après frais). `deps` = tous les
    // dépôts (sert au solde/pool d'actifs), y compris les achats financés par les espèces.
    const deps = txns.filter(t => t.type === 'deposit').reduce((s, t) => s + (t.net_amount || t.amount), 0);
    // Pour les retraits: le solde diminue du montant brut (frais inclus car sortis de l'enveloppe).
    const wdsGross = txns.filter(t => t.type === 'withdrawal').reduce((s, t) => s + (t.amount || 0), 0);

    // ── Flux EXTERNES vs INTERNES (dérivés du modèle espèces) ─────────────────────
    //   • Versement externe = NOUVEAUX fonds entrant de l'extérieur (part hors espèces).
    //     Un achat financé par les espèces internes n'est PAS un versement.
    //   • Vente externe = argent qui SORT de l'enveloppe (retrait hors « conservé en espèces »).
    //     Une vente dont le produit reste en espèces à l'intérieur n'est PAS une vente externe.
    const externalDeps = txns.filter(t => t.type === 'deposit')
      .reduce((s, t) => s + (t.new_funds_amount != null ? t.new_funds_amount : (t.net_amount || t.amount)), 0);
    const internalBuys = txns.filter(t => t.type === 'deposit' && t.from_cash_amount)
      .reduce((s, t) => s + (t.from_cash_amount || 0), 0);
    const externalWds = txns.filter(t => t.type === 'withdrawal' && !t.keep_in_cash)
      .reduce((s, t) => s + (t.net_amount || t.amount), 0);
    const internalSells = txns.filter(t => t.type === 'withdrawal' && t.keep_in_cash)
      .reduce((s, t) => s + (t.net_amount || t.amount), 0);
    
    // Frais de transaction (achat/vente)
    const transactionFees = txns.reduce((s, t) => s + (t.fees_amount || 0), 0);
    
    // Frais annuels cumulés.
    //  • Mode "percent" (défaut) : (taux transaction + taux enveloppe) × montant × années détenues.
    //  • Mode "euro" : le taux enveloppe ne s'applique PAS par dépôt ; un montant fixe €/an
    //    est ajouté une seule fois sur la durée de détention (depuis le 1er versement).
    const today = new Date();
    const envEuroMode   = p.annual_fees_type === 'euro';
    const envAnnualRate = envEuroMode ? 0 : (parseFloat(p.annual_fees_pct || 0) / 100);
    const envAnnualEuro = envEuroMode ? (parseFloat(p.annual_fees_pct || 0)) : 0;
    let annualFeesAccumulated = 0;

    // Frais annuels % de l'ENVELOPPE : appliqués à chaque versement au prorata de la durée détenue.
    if (envAnnualRate > 0) {
      txns.forEach(t => {
        if (t.type === 'deposit') {
          const txDate = new Date(t.date);
          const monthsHeld = Math.max(0, (today.getFullYear() - txDate.getFullYear()) * 12 + (today.getMonth() - txDate.getMonth()));
          annualFeesAccumulated += (t.net_amount || t.amount) * envAnnualRate * (monthsHeld / 12);
        }
      });
    }

    // Frais annuels portés par les TRANSACTIONS (% par tx + € une fois par mouvement source).
    annualFeesAccumulated += getTransactionAnnualFees(txns, today);

    // Frais annuels fixes (€/an) de l'enveloppe : appliqués une seule fois sur la durée de détention.
    if (envAnnualEuro > 0) {
      const firstDepDate = txns.filter(t => t.type === 'deposit').map(t => t.date).sort()[0];
      if (firstDepDate) {
        const fd = new Date(firstDepDate);
        const monthsHeld = Math.max(0, (today.getFullYear() - fd.getFullYear()) * 12 + (today.getMonth() - fd.getMonth()));
        annualFeesAccumulated += envAnnualEuro * (monthsHeld / 12);
      }
    }
    
    const totalFees = Math.round((transactionFees + annualFeesAccumulated) * 100) / 100;
    
    // Espèces: calculer le solde en espèces
    // Vente conservée en espèces → crédit = montant brut − frais de transaction
    // (les frais sortent toujours des espèces, quel que soit le sens des frais).
    // Achat financé par les espèces (from_cash_amount) → diminue le solde espèces.
    const cashFromSales = txns
      .filter(t => t.type === 'withdrawal' && t.keep_in_cash)
      .reduce((s, t) => s + ((t.amount || 0) - (t.fees_amount || 0)), 0);
    const cashUsedForPurchases = txns
      .filter(t => t.type === 'deposit' && t.from_cash_amount)
      .reduce((s, t) => s + (t.from_cash_amount || 0), 0);
    const cashBalance = Math.round((cashFromSales - cashUsedForPurchases) * 100) / 100;
    
    return {
      ...p,
      // « Versements » / « Ventes » = flux EXTERNES uniquement (hors recyclage interne des espèces).
      total_deposits: Math.round(externalDeps * 100) / 100,
      total_withdrawals: Math.round(externalWds * 100) / 100,
      // AFFICHAGE « Versements » : capital net en place = versements − retraits RÉELS
      // (externes). Les ventes conservées en espèces ne sont PAS déduites ici (l'argent
      // reste sur l'enveloppe). N.B. : n'affecte QUE l'affichage — le calcul des
      // rendements/PNL continue de traiter une vente-espèces comme un retrait.
      net_deposits: Math.round((externalDeps - externalWds) * 100) / 100,
      // Détail des transferts internes (affiché en sous-ligne des tuiles Versements / Ventes).
      internal_buys: Math.round(internalBuys * 100) / 100,
      internal_sells: Math.round(internalSells * 100) / 100,
      // Cumul de TOUS les dépôts nets (pool d'actifs), avant distinction externe/interne.
      // Sert de « Total versé » (tous les achats, y compris ceux financés par les espèces).
      gross_deposits: Math.round(deps * 100) / 100,
      // « Total vendu » = TOUTES les ventes nettes (sorties externes + conservées en espèces).
      // Total versé − Total vendu = capital net investi (base de la plus/moins-value).
      total_sold: Math.round((externalWds + internalSells) * 100) / 100,
      // Le solde = tous les versements nets - retraits bruts (car les frais de retrait sortent de l'enveloppe)
      balance: Math.round((deps - wdsGross) * 100) / 100,
      total_fees: totalFees,
      transaction_fees: Math.round(transactionFees * 100) / 100,
      annual_fees_accumulated: Math.round(annualFeesAccumulated * 100) / 100,
      cash_balance: cashBalance,
      transaction_count: txns.length
    };
  });
}

function getPortfolio(id) { return getPortfolios().find(p => p.id === id); }

function createPortfolio(data) {
  const store = getData();
  const p = {
    id: crypto.randomUUID(), name: data.name, type: data.type,
    regulated_subtype: data.type === 'compte_réglementé' ? (data.regulated_subtype || 'autre') : null,
    created_date: new Date().toISOString(),
    contract_start_date: data.contract_start_date || new Date().toISOString().split('T')[0],
    annual_fees_pct: data.type === 'compte_réglementé' ? 0 : (parseFloat(data.annual_fees_pct) || 0),
    annual_fees_type: data.annual_fees_type === 'euro' ? 'euro' : 'percent', // 'percent' (%/an) | 'euro' (€/an fixe)
    annual_return_rate: data.annual_return_rate != null && data.annual_return_rate !== '' ? parseFloat(data.annual_return_rate) : (DEFAULT_RATES[data.type] ?? 0),
    // Les comptes réglementés ne génèrent pas de plus-values imposables → toujours false.
    // Pour les autres types, respecter le choix de l'utilisateur (défaut true).
    include_in_tax_report: data.type === 'compte_réglementé' ? false : (data.include_in_tax_report !== false),
    // Couleur : choix utilisateur, sinon 1re couleur de palette libre (jamais imposée)
    color: data.color || _nextEnvelopeColor(store.portfolios),
  };
  store.portfolios.push(p);
  saveData();
  addLog(`PORTFOLIO_CREATED: ${p.id} (${p.type})`);
  // Gamification — création d'enveloppe
  gamificationService.onEnvelopeCreated();
  // Vérification explicite de Q1 (en plus du watcher xpAwarded)
  try { _getQuestService()?.checkCurrentQuest(); } catch (_) {}
  // Score de santé — recalcul différé
  try { _getHealthScoreService()?.scheduleRefresh(); } catch (_) {}
  return p;
}

function updatePortfolio(id, updates) {
  const store = getData();
  const idx = store.portfolios.findIndex(p => p.id === id);
  if (idx === -1) throw new Error('Portfolio introuvable');
  store.portfolios[idx] = { ...store.portfolios[idx], ...updates };
  saveData();
  addLog(`PORTFOLIO_UPDATED: ${id}`);
  // Propagation réactive : permet aux pages montées (tableau de bord) de se
  // rafraîchir immédiatement — ex. changement de couleur reflété sur tous les
  // graphiques sans rechargement.
  try { gamificationService.dispatchEvent('portfoliosChanged', { id, updates }); } catch (_) {}
  return store.portfolios[idx];
}

/**
 * Compte les données liées à une enveloppe (pour la boîte de confirmation
 * de suppression). N'effectue aucune suppression.
 */
function getPortfolioDeletionImpact(id) {
  const store = getData();
  return {
    movements:     (store.regular_movements || []).filter(rm => rm.portfolio_id === id).length,
    calibrations:  (store.calibrations || []).filter(c => c.portfolio_id === id).length,
    transactions:  (store.transactions || []).filter(t => t.portfolio_id === id).length,
    templates:     (store.movement_templates || []).filter(m => m.portfolio_id === id).length,
  };
}

function deletePortfolio(id) {
  const store = getData();
  const impact = getPortfolioDeletionImpact(id);
  store.portfolios         = store.portfolios.filter(p => p.id !== id);
  store.transactions       = store.transactions.filter(t => t.portfolio_id !== id);
  store.movement_templates = (store.movement_templates || []).filter(m => m.portfolio_id !== id);
  // Cascade : mouvements programmés (récurrents) + calibrations associés
  store.regular_movements  = (store.regular_movements || []).filter(rm => rm.portfolio_id !== id);
  store.calibrations       = (store.calibrations || []).filter(c => c.portfolio_id !== id);
  saveData();
  addLog(`PORTFOLIO_DELETED: ${id} (cascade: ${impact.transactions} tx, ${impact.movements} récurrents, ${impact.calibrations} calibrations)`);
  // Gamification — réévaluer les trophées non-permanents après suppression (#11)
  try { _getTrophyService()?.checkAllTrophies(); } catch (_) {}
  // Score de santé — recalcul différé
  try { _getHealthScoreService()?.scheduleRefresh(); } catch (_) {}
  return impact;
}

// ============ MOVEMENT TEMPLATES ============

function getMovementTemplates(portfolioId) {
  const { movement_templates } = getData();
  if (!portfolioId) return movement_templates || [];
  return (movement_templates || []).filter(m => m.portfolio_id === portfolioId);
}

function getAllMovementTemplates() {
  const { movement_templates } = getData();
  return movement_templates || [];
}

function createMovementTemplate(data) {
  const store = getData();
  if (!store.movement_templates) store.movement_templates = [];
  const mt = {
    id: crypto.randomUUID(),
    name: data.name,
    portfolio_id: data.portfolio_id,
    fees_pct: parseFloat(data.fees_pct) || 0,
    fees_type: data.fees_type === 'euro' ? 'euro' : 'percent',
    fee_direction: data.fee_direction === 'added' ? 'added' : 'deducted',
    annual_fees_pct: parseFloat(data.annual_fees_pct) || 0,
    annual_fees_type: data.annual_fees_type === 'euro' ? 'euro' : 'percent',
    asset_type: data.asset_type || null,
    multi_asset_allocations: data.multi_asset_allocations || null,
    created_at: new Date().toISOString(),
  };
  store.movement_templates.push(mt);
  saveData();
  addLog(`MOVEMENT_TEMPLATE_CREATED: ${mt.id}`);
  // Gamification — ajout d'actif
  gamificationService.onAssetAdded();
  // Vérification explicite de Q1 (en plus du watcher xpAwarded)
  try { _getQuestService()?.checkCurrentQuest(); } catch (_) {}
  return mt;
}

function updateMovementTemplate(id, updates) {
  const store = getData();
  const idx = (store.movement_templates || []).findIndex(m => m.id === id);
  if (idx === -1) throw new Error('Mouvement type introuvable');
  store.movement_templates[idx] = { ...store.movement_templates[idx], ...updates };
  saveData();
  addLog(`MOVEMENT_TEMPLATE_UPDATED: ${id}`);
  return store.movement_templates[idx];
}

function deleteMovementTemplate(id) {
  const store = getData();
  store.movement_templates = (store.movement_templates || []).filter(m => m.id !== id);
  saveData();
  addLog(`MOVEMENT_TEMPLATE_DELETED: ${id}`);
}

// ============ TRANSACTIONS ============

function getTransactions(portfolioId) {
  const { transactions } = getData();
  return transactions.filter(t => t.portfolio_id === portfolioId).sort((a, b) => b.date.localeCompare(a.date));
}

function getAllTransactions() {
  return getData().transactions || [];
}

function createTransaction(portfolioId, tx) {
  const store = getData();
  const portfolio = store.portfolios.find(p => p.id === portfolioId);
  if (!portfolio) throw new Error('Enveloppe introuvable');
  
  const amount = parseFloat(tx.amount);
  // Frais : en pourcentage (défaut) ou en montant fixe en € selon fees_type.
  // En mode "euro", la valeur saisie (tx.fees_pct) est directement le montant des frais.
  const feesType = tx.fees_type === 'euro' ? 'euro' : 'percent';
  const feeInput = parseFloat(tx.fees_pct) || 0;
  const feesPct = feesType === 'percent' ? feeInput : 0;
  const feesAmount = feesType === 'euro'
    ? Math.round(feeInput * 100) / 100
    : Math.round(amount * feesPct / 100 * 100) / 100;
  // Sens des frais de transaction (le montant BRUT saisi reste `amount` dans les deux cas) :
  //   'deducted' (défaut) → net = montant brut − frais (frais prélevés sur le montant)
  //   'added'            → net = montant brut + frais (frais payés en plus, intégrés au net)
  // Le MONTANT des frais (feesAmount) est identique dans les deux cas.
  const feeDirection = tx.fee_direction === 'added' ? 'added' : 'deducted';
  const netAmount = Math.round((feeDirection === 'added' ? amount + feesAmount : amount - feesAmount) * 100) / 100;
  
  // Calculer le solde espèces actuel
  const txns = store.transactions.filter(t => t.portfolio_id === portfolioId);
  const cashFromSales = txns
    .filter(t => t.type === 'withdrawal' && t.keep_in_cash)
    .reduce((s, t) => s + ((t.amount || 0) - (t.fees_amount || 0)), 0);
  const cashUsedForPurchases = txns
    .filter(t => t.type === 'deposit' && t.from_cash_amount)
    .reduce((s, t) => s + (t.from_cash_amount || 0), 0);
  const currentCashBalance = Math.round((cashFromSales - cashUsedForPurchases) * 100) / 100;
  
  // Variables pour la logique de poche espèces
  let fromCashAmount = 0;
  let newFundsAmount = netAmount;
  
  // Logique de poche espèces pour les achats (deposits)
  // `funding_source` (optionnel) permet à l'utilisateur de choisir la source de
  // financement quand des espèces sont disponibles :
  //   • 'external' → ne PAS puiser dans les espèces (apport d'argent extérieur) ;
  //   • 'cash' ou absent → espèces utilisées en priorité (comportement par défaut,
  //     rétro-compatible avec les mouvements récurrents/modèles/imports).
  if (tx.type === 'deposit') {
    const preferCash = tx.funding_source !== 'external';
    // Si on a des espèces disponibles et que l'utilisateur ne demande pas l'apport
    // extérieur, les utiliser en priorité
    if (preferCash && currentCashBalance > 0) {
      if (currentCashBalance >= netAmount) {
        // Le solde espèces couvre tout l'achat
        fromCashAmount = netAmount;
        newFundsAmount = 0;
      } else {
        // Le solde espèces couvre partiellement, le reste vient de nouveaux fonds
        fromCashAmount = currentCashBalance;
        newFundsAmount = netAmount - currentCashBalance;
      }
    }
  }
  
  if (portfolio.type === 'PEA' && tx.type === 'deposit') {
    // Pour le PEA, seuls les nouveaux fonds comptent pour le plafond
    const totalDeps = versementsPea(store.transactions, portfolioId);
    if (totalDeps + newFundsAmount > PEA_MAX) throw new Error(`PEA: plafond dépassé. Reste: ${(PEA_MAX - totalDeps).toFixed(2)} €`);
  }
  
  const newTx = {
    id: crypto.randomUUID(), 
    portfolio_id: portfolioId,
    date: tx.date, 
    amount: amount,
    fees_pct: feesPct,
    fees_amount: feesAmount,
    fees_type: feesType,
    fee_direction: feeDirection,   // 'deducted' | 'added'
    net_amount: netAmount,
    annual_fees_pct: parseFloat(tx.annual_fees_pct) || 0, // Frais annuels de gestion
    annual_fees_type: tx.annual_fees_type === 'euro' ? 'euro' : 'percent', // 'percent' (%/an) | 'euro' (€/an fixe)
    type: tx.type,
    note: tx.note || '',
    template_id: tx.template_id || null,
    asset_type: tx.asset_type || null,
    custom_asset_type: tx.custom_asset_type || null, // Pour le type "autre"
    // Regroupe les sous-transactions d'UN mouvement multi-actifs (1 chip calendrier)
    movement_group_id: tx.movement_group_id || null,
    // Espèces
    keep_in_cash: tx.type === 'withdrawal' ? (tx.keep_in_cash || false) : false,
    from_cash_amount: tx.type === 'deposit' ? fromCashAmount : 0,
    new_funds_amount: tx.type === 'deposit' ? newFundsAmount : 0,
    // Quantité / prix unitaire (optionnels — actions, crypto, obligations…)
    quantity: tx.quantity != null && tx.quantity !== '' ? parseFloat(tx.quantity) : null,
    unit_price: tx.unit_price != null && tx.unit_price !== '' ? parseFloat(tx.unit_price) : null,
    created_at: new Date().toISOString(),
  };
  store.transactions.push(newTx);
  saveData();

  // Log détaillé
  let logMsg = `TRANSACTION: ${tx.type} ${amount}€ (frais: ${feesAmount}€, net: ${netAmount}€) enveloppe=${portfolioId}`;
  if (tx.asset_type) logMsg += ` actif=${tx.asset_type}`;
  if (tx.type === 'withdrawal' && tx.keep_in_cash) logMsg += ` [conservé en espèces]`;
  if (tx.type === 'deposit' && fromCashAmount > 0) logMsg += ` [${fromCashAmount}€ depuis espèces, ${newFundsAmount}€ nouveaux fonds]`;
  addLog(logMsg);

  // Gamification — mouvement enregistré (une seule fois, sauf si en mode batch récurrent)
  if (!_gamificationBatchMode) {
    gamificationService.onMovementRecorded();
  }
  // Score de santé — recalcul différé
  try { _getHealthScoreService()?.scheduleRefresh(); } catch (_) {}

  return newTx;
}

// Fonction pour ajouter des mois correctement sans débordement
function addMonths(date, months) {
  const result = new Date(date);
  const targetMonth = result.getMonth() + months;
  result.setMonth(targetMonth);
  
  // Si le mois résultant n'est pas celui attendu (débordement), 
  // revenir au dernier jour du mois cible
  const expectedMonth = ((date.getMonth() + months) % 12 + 12) % 12;
  if (result.getMonth() !== expectedMonth) {
    // Revenir au dernier jour du mois précédent
    result.setDate(0);
  }
  return result;
}

// Formatter une date en YYYY-MM-DD (format local, sans décalage UTC)
function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createRecurringTransactions(portfolioId, tx) {
  const freq = tx.recurrence;
  if (!freq || freq === 'none') {
    // Traitement simple : le hook est géré dans createTransaction
    return [createTransaction(portfolioId, tx)];
  }

  // Parser les dates en utilisant l'heure locale pour éviter les problèmes de fuseau horaire
  const parseLocalDate = (dateStr) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const startDate = parseLocalDate(tx.date);
  const endDate = parseLocalDate(tx.end_date);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate < startDate) {
    throw new Error('Dates invalides');
  }

  const results = [];
  const createdMonths = new Set(); // Pour éviter les doublons
  let iterCount = 0;

  // Désactiver le hook de gamification dans createTransaction pour les séries récurrentes
  // (on l'appellera une seule fois à la fin, quelle que soit le nombre d'occurrences)
  _gamificationBatchMode = true;

  try {
    while (iterCount <= 1000) { // Limite de sécurité
      let current;

      if (freq === 'monthly') {
        current = addMonths(startDate, iterCount);
      } else if (freq === 'quarterly') {
        current = addMonths(startDate, iterCount * 3);
      } else if (freq === 'semi_annual') {
        current = addMonths(startDate, iterCount * 6);
      } else if (freq === 'annual') {
        current = new Date(startDate);
        current.setFullYear(startDate.getFullYear() + iterCount);
      } else {
        break;
      }

      // Vérifier si on dépasse la date de fin
      if (current > endDate) {
        break;
      }

      // Créer une clé unique pour ce mois (pour éviter les doublons)
      const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;

      if (!createdMonths.has(monthKey)) {
        createdMonths.add(monthKey);
        const dateTx = { ...tx, date: formatDateLocal(current) };
        results.push(createTransaction(portfolioId, dateTx));
      }

      iterCount++;
    }
  } catch (e) {
    // En cas d'erreur (ex: plafond PEA), annuler toutes les transactions déjà créées
    if (results.length > 0) {
      const store = getData();
      const createdIds = new Set(results.map(t => t.id));
      store.transactions = store.transactions.filter(t => !createdIds.has(t.id));
      saveData();
    }
    _gamificationBatchMode = false;
    throw e; // Relancer l'erreur pour que l'UI l'affiche
  }

  _gamificationBatchMode = false;

  // Gamification — compter la série récurrente comme UN SEUL mouvement
  if (results.length > 0) {
    gamificationService.onMovementRecorded();
  }

  addLog(`RECURRING: ${results.length} transactions créées (${freq})`);
  return results;
}

function updateTransaction(portfolioId, txId, updates) {
  const store = getData();
  const idx = store.transactions.findIndex(t => t.id === txId && t.portfolio_id === portfolioId);
  if (idx === -1) throw new Error('Transaction introuvable');
  
  const oldTx = store.transactions[idx];
  const amount = parseFloat(updates.amount) || oldTx.amount;
  // Frais : % (défaut) ou montant fixe € selon fees_type (conserve le mode existant).
  const feesType = (updates.fees_type ?? oldTx.fees_type) === 'euro' ? 'euro' : 'percent';
  const feeInput = (updates.fees_pct !== undefined && updates.fees_pct !== '')
    ? (parseFloat(updates.fees_pct) || 0)
    : (feesType === 'euro' ? (oldTx.fees_amount || 0) : (oldTx.fees_pct || 0));
  const feesPct = feesType === 'percent' ? feeInput : 0;
  const feesAmount = feesType === 'euro'
    ? Math.round(feeInput * 100) / 100
    : Math.round(amount * feesPct / 100 * 100) / 100;
  const feeDirection = (updates.fee_direction ?? oldTx.fee_direction) === 'added' ? 'added' : 'deducted';
  const netAmount = Math.round((feeDirection === 'added' ? amount + feesAmount : amount - feesAmount) * 100) / 100;

  store.transactions[idx] = {
    ...oldTx,
    ...updates,
    amount,
    fees_pct: feesPct,
    fees_amount: feesAmount,
    fees_type: feesType,
    fee_direction: feeDirection,
    net_amount: netAmount,
    annual_fees_pct: parseFloat(updates.annual_fees_pct) ?? oldTx.annual_fees_pct ?? 0,
    annual_fees_type: (updates.annual_fees_type ?? oldTx.annual_fees_type) === 'euro' ? 'euro' : 'percent',
    asset_type: updates.asset_type ?? oldTx.asset_type ?? null,
    custom_asset_type: updates.custom_asset_type ?? oldTx.custom_asset_type ?? null,
    // Espèces: conserver ou mettre à jour
    keep_in_cash: updates.keep_in_cash ?? oldTx.keep_in_cash ?? false,
    from_cash_amount: oldTx.from_cash_amount ?? 0,
    new_funds_amount: oldTx.new_funds_amount ?? 0,
  };
  saveData();
  addLog(`TRANSACTION_UPDATED: ${txId}`);
  return store.transactions[idx];
}

function deleteTransaction(portfolioId, txId) {
  const store = getData();
  store.transactions = store.transactions.filter(t => !(t.id === txId && t.portfolio_id === portfolioId));
  saveData();
  addLog(`TRANSACTION_DELETED: ${txId}`);
  // Gamification — réévaluer les trophées non-permanents après suppression (#10)
  try { _getTrophyService()?.checkAllTrophies(); } catch (_) {}
  // Score de santé — recalcul différé
  try { _getHealthScoreService()?.scheduleRefresh(); } catch (_) {}
}

// ============ PORTFOLIO HISTORY ============

/**
 * Détecte si une transaction est liée à une calibration (flag explicite ou données legacy).
 * Utilisé pour exclure ces flux du calcul du rendement annualisé (XIRR) et de la courbe
 * "Versements cumulés", qui ne doivent refléter que les flux réels de l'utilisateur.
 *
 * Détecte :
 *   - tx.isCalibration === true  (flag explicite, données récentes)
 *   - tx.type === 'calibration'  (données legacy < v4.3)
 *   - tx.note contient 'calibration' (données legacy créées automatiquement)
 */
function _isCalibrationTx(tx) {
  if (!tx) return false;
  if (tx.isCalibration === true) return true;
  if (tx.type === 'calibration') return true;
  const note = (tx.note || '').toLowerCase();
  return note.includes('calibration');
}

/**
 * Calcul de l'historique d'un portefeuille avec intérêts composés MENSUELS
 * Prend en compte les frais annuels propres à chaque transaction + les frais de l'enveloppe
 */
function getPortfolioHistory(portfolioId) {
  const portfolio = getPortfolio(portfolioId);
  if (!portfolio) return [];

  const transactions = getTransactions(portfolioId);
  // Exclure les transactions de calibration : elles ne représentent pas des flux réels
  // et fausseraient la courbe "Versements cumulés" ainsi que la valeur théorique.
  const sorted = [...transactions].filter(t => !_isCalibrationTx(t)).sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length) return [];
  
  // Taux de base de l'enveloppe
  const baseAnnualRate = (portfolio.annual_return_rate || 0) / 100;
  // En mode "euro", les frais annuels d'enveloppe ne sont pas un taux : on les déduit
  // séparément (montant fixe €/an) du capital, et le taux appliqué à la croissance est 0.
  const envEuroMode = portfolio.annual_fees_type === 'euro';
  const envelopeAnnualFees = envEuroMode ? 0 : (portfolio.annual_fees_pct || 0) / 100;
  const envAnnualEuro = envEuroMode ? (parseFloat(portfolio.annual_fees_pct) || 0) : 0;
  
  // Trouver tous les mois entre la première transaction et aujourd'hui
  const minMonth = sorted[0].date.substring(0, 7);
  const today = new Date().toISOString().substring(0, 7);
  
  const sortedMonths = [];
  let [year, month] = minMonth.split('-').map(Number);
  const [endYear, endMonth] = today.split('-').map(Number);
  
  while (year < endYear || (year === endYear && month <= endMonth)) {
    sortedMonths.push(`${year}-${String(month).padStart(2, '0')}`);
    month++;
    if (month > 12) { month = 1; year++; }
  }
  
  // Pour chaque transaction, on calcule sa contribution avec son propre taux
  const txContributions = [];
  
  let totalDeposits = 0;    // Somme des versements nets
  
  return sortedMonths.map((monthKey, index) => {
    // Calculer les transactions du mois
    const monthTxns = sorted.filter(t => t.date.substring(0, 7) === monthKey);
    
    monthTxns.forEach(t => { 
      if (t.type === "deposit") {
        // Achat = capital déployé dans les actifs (au montant net investi).
        const net = t.net_amount || t.amount;
        // Courbe « Versements cumulés » (AFFICHAGE) = capital net en place : on n'ajoute
        // que les nouveaux fonds (un rachat depuis les espèces internes n'est pas un
        // versement). N'affecte pas la valeur projetée (txContributions, au montant net).
        totalDeposits += (t.new_funds_amount != null ? t.new_funds_amount : net);

        // Frais annuels propres à cette transaction (uniquement en % ; le mode € n'est
        // pas un taux et est déduit séparément) + frais de l'enveloppe
        const txAnnualRatePct = t.annual_fees_type === 'euro' ? 0 : ((t.annual_fees_pct || 0) / 100);
        const txAnnualFees = txAnnualRatePct + envelopeAnnualFees;
        const txNetAnnualRate = Math.max(0, baseAnnualRate - txAnnualFees);
        const txMonthlyRate = _effMonthlyRate(txNetAnnualRate);

        txContributions.push({
          amount: net,
          monthlyRate: txMonthlyRate,
          startMonthIndex: index,
          currentValue: net
        });
      } else {
        // Vente : le capital projeté (txContributions) diminue toujours du montant brut.
        // La courbe « Versements cumulés » (AFFICHAGE), elle, ne baisse que pour un retrait
        // réel — une vente conservée en espèces reste en place et n'y est pas déduite.
        const gross = t.amount || t.net_amount;
        if (!t.keep_in_cash) totalDeposits -= (t.net_amount || t.amount);

        let remaining = gross;
        for (let i = txContributions.length - 1; i >= 0 && remaining > 0; i--) {
          const contrib = txContributions[i];
          if (contrib.currentValue <= remaining) {
            remaining -= contrib.currentValue;
            contrib.currentValue = 0;
          } else {
            contrib.currentValue -= remaining;
            remaining = 0;
          }
        }
      }
    });
    
    // Calculer les intérêts pour chaque contribution active
    let totalValue = 0;
    txContributions.forEach(contrib => {
      if (contrib.currentValue > 0) {
        const monthsHeld = index - contrib.startMonthIndex;
        if (monthsHeld > 0) {
          // Capitaliser cette contribution
          contrib.currentValue = contrib.currentValue * (1 + contrib.monthlyRate);
        }
        totalValue += contrib.currentValue;
      }
    });
    
    if (totalValue < 0) totalValue = 0;

    // Mode "euro" : déduire le cumul des frais annuels fixes (€/an) depuis le début.
    if (envAnnualEuro > 0) {
      totalValue = Math.max(0, totalValue - envAnnualEuro * (index / 12));
    }

    return {
      month: monthKey,
      deposits: Math.round(totalDeposits * 100) / 100,
      value: Math.round(totalValue * 100) / 100
    };
  });
}

// ============ ALL PORTFOLIOS HISTORY ============

/**
 * Calcul de l'historique de tous les portefeuilles avec SOLDES RÉELS
 * (versements cumulés sans rendement théorique - pour le graphique du Dashboard)
 */
function getAllPortfoliosHistory(includeRegulated = true, useRealValue = false) {
  const portfolios = getPortfolios().filter(p => includeRegulated || p.type !== 'compte_réglementé');
  if (portfolios.length === 0) return { data: [], series: [] };
  
  const { transactions } = getData();
  if (transactions.length === 0) return { data: [], series: [] };
  
  // Trouver la plage de mois (première transaction → aujourd'hui)
  const allTxDates = transactions.map(t => t.date.substring(0, 7));
  const minMonth = allTxDates.reduce((a, b) => a < b ? a : b);
  const today = new Date().toISOString().substring(0, 7);
  
  // Générer tous les mois
  const sortedMonths = [];
  let [year, month] = minMonth.split('-').map(Number);
  const [endYear, endMonth] = today.split('-').map(Number);
  
  while (year < endYear || (year === endYear && month <= endMonth)) {
    sortedMonths.push(`${year}-${String(month).padStart(2, '0')}`);
    month++;
    if (month > 12) { month = 1; year++; }
  }
  
  if (sortedMonths.length === 0) return { data: [], series: [] };
  
  const series = portfolios.map(p => {
    const pTxns = transactions.filter(t => t.portfolio_id === p.id).sort((a, b) => a.date.localeCompare(b.date));
    
    // Solde réel = versements - retraits (sans intérêts composés)
    let totalBalance = 0;
    const values = {};
    
    sortedMonths.forEach((monthKey) => {
      // Calculer les transactions du mois
      const monthTxns = pTxns.filter(t => t.date.substring(0, 7) === monthKey);
      
      monthTxns.forEach(t => {
        if (t.type === 'deposit') {
          // Capital net en place : uniquement les nouveaux fonds (hors rachats espèces).
          totalBalance += (t.new_funds_amount != null ? t.new_funds_amount : (t.net_amount || t.amount));
        } else if (!t.keep_in_cash) {
          // Retrait réel (hors « conservé en espèces », qui reste dans l'enveloppe).
          totalBalance -= (t.net_amount || t.amount);
        }
      });

      if (totalBalance < 0) totalBalance = 0;
      values[monthKey] = Math.round(totalBalance * 100) / 100;
    });

    // Mode « Valeur réelle » : on remplace le solde des versements par la valeur
    // calibrée (interpolée) quand elle est disponible, pour que l'évolution colle
    // aux totaux réels des enveloppes. Avant la 1ère calibration (realValue null),
    // on conserve le solde des versements.
    if (useRealValue) {
      getPortfolioRealHistory(p.id).forEach(pt => {
        if (pt.realValue != null && values[pt.month] !== undefined) {
          values[pt.month] = Math.round(pt.realValue * 100) / 100;
        }
      });
    }

    return { name: p.name, id: p.id, values };
  });
  
  const data = sortedMonths.map(month => {
    const point = { month };
    let total = 0;
    series.forEach(s => {
      point[s.id] = s.values[month] || 0;
      total += s.values[month] || 0;
    });
    point.total = Math.round(total * 100) / 100;
    return point;
  });
  
  return { data, series: series.map(s => ({ name: s.name, id: s.id })) };
}

// ============ SIMULATION ============

function runSimulation(params) {
  let balance = parseFloat(params.initial_balance) || 0;
  let totalDeposits = parseFloat(params.total_deposits) || 0;
  const annualRate = parseFloat(params.annual_return_rate) || 0;
  const annualFees = parseFloat(params.annual_fees_pct) || 0;
  const netAnnualRate = annualRate - annualFees;
  const monthlyRate = _effMonthlyRate(netAnnualRate / 100);
  const monthlyInflation = (parseFloat(params.inflation_rate) || 0) / 100 / 12;
  const monthlyContrib = parseFloat(params.monthly_contribution) || 0;
  const transactionFeesPct = parseFloat(params.transaction_fees_pct) || 0;
  const years = parseInt(params.years) || 10;
  const results = [];
  let cumFees = 0, inflFactor = 1;
  
  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) {
      let contrib = monthlyContrib;
      if (params.portfolio_type === 'PEA' && totalDeposits + contrib > PEA_MAX) {
        contrib = Math.max(0, PEA_MAX - totalDeposits);
      }
      
      const txFees = contrib * transactionFeesPct / 100;
      const netContrib = contrib - txFees;
      cumFees += txFees;
      
      totalDeposits += netContrib;
      balance += netContrib;
      balance += balance * monthlyRate;
      inflFactor *= (1 + monthlyInflation);
    }
    results.push({ 
      year: y, 
      total_deposits: Math.round(totalDeposits * 100) / 100, 
      portfolio_value: Math.round(balance * 100) / 100, 
      real_value: Math.round(balance / inflFactor * 100) / 100, 
      gains: Math.round((balance - totalDeposits) * 100) / 100, 
      cumulative_fees: Math.round(cumFees * 100) / 100 
    });
  }
  return results;
}

function runMultiSimulation(portfolioConfigs, globalParams) {
  const years = parseInt(globalParams.years) || 10;
  const inflationRate = parseFloat(globalParams.inflation_rate) || 2.5;
  const monthlyInflation = inflationRate / 100 / 12;
  
  const simulations = portfolioConfigs.map(config => {
    const p = config.portfolio;
    const monthlyContrib = parseFloat(config.monthly_contribution) || 0;
    const annualRate = p.annual_return_rate || 0;
    const annualFees = p.annual_fees_pct || 0;
    const netMonthlyRate = _effMonthlyRate((annualRate - annualFees) / 100);
    
    let balance = p.balance || 0;
    let totalDeposits = p.total_deposits || 0;
    const results = [];
    
    for (let y = 1; y <= years; y++) {
      for (let m = 0; m < 12; m++) {
        let contrib = monthlyContrib;
        if (p.type === 'PEA' && totalDeposits + contrib > PEA_MAX) {
          contrib = Math.max(0, PEA_MAX - totalDeposits);
        }
        totalDeposits += contrib;
        balance += contrib;
        balance *= (1 + netMonthlyRate);
      }
      results.push({
        year: y,
        portfolio_value: Math.round(balance * 100) / 100,
        total_deposits: Math.round(totalDeposits * 100) / 100,
      });
    }
    
    return { 
      portfolio: p, 
      results,
      final_value: results[results.length - 1].portfolio_value,
    };
  });
  
  const combined = [];
  let inflFactor = 1;
  for (let y = 1; y <= years; y++) {
    let totalVal = 0, totalDeps = 0;
    simulations.forEach(s => {
      const r = s.results[y - 1];
      totalVal += r.portfolio_value;
      totalDeps += r.total_deposits;
    });
    inflFactor *= Math.pow(1 + monthlyInflation, 12);
    combined.push({
      year: y,
      portfolio_value: Math.round(totalVal * 100) / 100,
      total_deposits: Math.round(totalDeps * 100) / 100,
      real_value: Math.round(totalVal / inflFactor * 100) / 100,
      gains: Math.round((totalVal - totalDeps) * 100) / 100,
    });
  }
  
  const pieData = simulations.map(s => ({
    name: s.portfolio.name,
    value: s.final_value,
  }));
  
  return { simulations, combined, pieData };
}

// ============ TAX ============
// Mis à jour janvier 2026 : PS = 18.6%, Flat tax = 31,4%

/** Types d'enveloppe dotés d'un régime fiscal pré-calculé par l'application. */
const TAXED_TYPES = ['PEA', 'CTO', 'Crypto', 'assurance_vie', 'PER'];

function calculateTax(type, totalDeps, totalWds, gains, contractStart, year) {
  // PS_RATE, IR_RATE, FLAT_TAX sont définis en haut du module
  // `has_rules` : false pour les enveloppes personnalisées et les livrets
  // réglementés — l'UI et le PDF masquent alors les lignes d'imposition.
  // Libellé du régime appliqué, dans la langue d'affichage (repris par l'écran et le PDF).
  const L = (fr, en) => (_appPreferences.language === 'en' ? en : fr);
  const tax = { portfolio_type: type, has_rules: TAXED_TYPES.includes(type), total_deposits: Math.round(totalDeps * 100) / 100, total_withdrawals: Math.round(totalWds * 100) / 100, gains: Math.round(Math.max(0, gains) * 100) / 100, social_charges: 0, income_tax: 0, total_tax: 0, details: '' };
  if (!tax.has_rules) {
    tax.details = type === 'compte_réglementé'
      ? L('Livret réglementé : intérêts exonérés d\'impôt et de prélèvements sociaux.', 'Regulated savings account: interest exempt from income tax and social charges.')
      : L('Enveloppe personnalisée : aucun régime fiscal pré-calculé.', 'Custom envelope: no pre-calculated tax regime.');
    return tax;
  }
  if (gains <= 0) {
    tax.details = totalWds > 0
      ? L('Retraits sans plus-value sur la période : pas d\'imposition.', 'Withdrawals with no gain over the period: no tax.')
      : L('Aucun retrait cette année : pas d\'imposition à déclarer.', 'No withdrawal this year: no tax to declare.');
    return tax;
  }

  if (type === 'PEA') {
    // Après 5 ans de détention, les plus-values d'un PEA échappent à l'impôt sur le
    // revenu : seuls les prélèvements sociaux restent dus. L'ancienneté est celle
    // affichée par le badge de maturité, évaluée au 31/12 de l'année du rapport.
    const maturite = getTaxMaturity({ type, contract_start_date: contractStart }, new Date(`${year}-12-31`));
    if (maturite && maturite.isMature) {
      tax.social_charges = +(gains * PS_RATE).toFixed(2);
      tax.income_tax = 0;
      tax.total_tax = tax.social_charges;
      tax.details = L(`PEA de plus de 5 ans (${maturite.years} ans) : plus-values exonérées d'impôt sur le revenu ; seuls les prélèvements sociaux de 18,6 % sont dus.`,
        `PEA over 5 years old (${maturite.years} yrs): gains exempt from income tax; only the 18.6% social charges are due.`);
    } else {
      tax.social_charges = +(gains * PS_RATE).toFixed(2);
      tax.income_tax = +(gains * IR_RATE).toFixed(2);
      tax.total_tax = +(gains * FLAT_TAX).toFixed(2);
      tax.details = maturite
        ? L(`PEA de moins de 5 ans (${maturite.years} ans) : Flat tax 31,4 % (IR 12,8 % + PS 18,6 %) sur les plus-values lors du retrait.`,
          `PEA under 5 years old (${maturite.years} yrs): 31.4% flat tax (12.8% IT + 18.6% SC) on gains at withdrawal.`)
        : L("PEA : Flat tax 31,4 % (IR 12,8 % + PS 18,6 %) sur les plus-values lors du retrait (date d'ouverture non renseignée : exonération après 5 ans non appliquée).",
          'PEA: 31.4% flat tax (12.8% IT + 18.6% SC) on gains at withdrawal (start date not entered: the exemption after 5 years is not applied).');
    }
  }
  else if (type === 'CTO' || type === 'Crypto') { 
    tax.social_charges = +(gains * PS_RATE).toFixed(2); 
    tax.income_tax = +(gains * IR_RATE).toFixed(2); 
    tax.total_tax = +(gains * FLAT_TAX).toFixed(2); 
    tax.details = L(`${type} : Flat tax 31,4 % (IR 12,8 % + PS 18,6 %) sur les plus-values.`, `${type}: 31.4% flat tax (12.8% IT + 18.6% SC) on gains.`); 
  }
  else if (type === 'assurance_vie') {
    let cy = 0; try { cy = year - new Date(contractStart).getFullYear(); } catch {}
    if (cy < 8) { 
      tax.social_charges = +(gains * PS_RATE).toFixed(2); 
      tax.income_tax = +(gains * IR_RATE).toFixed(2); 
      tax.total_tax = +(gains * FLAT_TAX).toFixed(2); 
      tax.details = L(`Assurance vie (contrat < 8 ans, ${cy} ans) : 31,4 % (IR 12,8 % + PS 18,6 %).`, `Life insurance (contract < 8 years, ${cy} yrs): 31.4% (12.8% IT + 18.6% SC).`); 
    }
    else {
      const social = +(gains * PS_RATE).toFixed(2);
      const taxable = Math.max(0, gains - 4600);
      if (taxable <= 0) { 
        tax.social_charges = social; 
        tax.total_tax = social; 
        tax.details = L(`Assurance vie (≥ 8 ans) : Plus-values sous l'abattement de 4 600 €. Seuls les PS 18,6 % s'appliquent.`, `Life insurance (≥ 8 years): gains below the €4,600 allowance. Only the 18.6% SC apply.`); 
      }
      else { 
        let ir; 
        if (totalDeps <= 150000) { 
          ir = +(taxable * 0.075).toFixed(2); 
          tax.details = L(`Assurance vie (≥ 8 ans, versements ≤ 150k €) : Abattement 4 600 €, puis 7,5 % IR + 18,6 % PS.`, `Life insurance (≥ 8 years, deposits ≤ €150k): €4,600 allowance, then 7.5% IT + 18.6% SC.`); 
        } else { 
          const r = Math.min(150000, totalDeps) / totalDeps; 
          ir = +((taxable * r * 0.075 + taxable * (1 - r) * IR_RATE)).toFixed(2); 
          tax.details = L(`Assurance vie (≥ 8 ans, versements > 150k €) : 7,5 % sur 150k € + 12,8 % au-delà, PS 18,6 %.`, `Life insurance (≥ 8 years, deposits > €150k): 7.5% on €150k + 12.8% above, 18.6% SC.`); 
        }
        tax.social_charges = social; 
        tax.income_tax = ir; 
        tax.total_tax = +(social + ir).toFixed(2); 
      }
    }
  }
  else if (type === 'PER') { 
    tax.social_charges = +(gains * PS_RATE).toFixed(2); 
    tax.income_tax = +(gains * IR_RATE).toFixed(2); 
    tax.total_tax = +(gains * FLAT_TAX).toFixed(2); 
    tax.details = L('PER : Flat tax 31,4 % (IR 12,8 % + PS 18,6 %).', 'PER: 31.4% flat tax (12.8% IT + 18.6% SC).'); 
  }
  return tax;
}

function getTaxReport(year) {
  // Livrets réglementés : ils n'ont pas de régime fiscal à déclarer, mais l'utilisateur
  // veut pouvoir les voir figurer au rapport — avec la mention de leur exonération — pour
  // disposer d'une vue complète de son patrimoine. Leur `include_in_tax_report` est forcé
  // à false à la création ; c'est donc la préférence « Inclure les livrets réglementés »
  // du tableau de bord qui commande, sauf si l'utilisateur a explicitement coché la case
  // sur un livret en particulier (ce choix-là prime).
  const inclureLivrets = getAppPreferences().includeRegulatedInPerf !== false;
  const portfolios = getPortfolios().filter(p => {
    if (p.type === 'compte_réglementé') return inclureLivrets || p.include_in_tax_report === true;
    return p.include_in_tax_report !== false;
  });
  const { transactions } = getData();
  return portfolios.map(p => {
    const txns = transactions.filter(t => t.portfolio_id === p.id);
    const yTxns = txns.filter(t => t.date.startsWith(String(year)));
    // Versements de l'année = ARGENT EXTÉRIEUR entré (même définition que
    // `total_deposits`, qui sert de base au calcul de plus-value). Compter aussi les
    // achats repayés avec les espèces de l'enveloppe affichait un total annuel
    // supérieur au total historique, et mélangeait deux bases dans le même encadré.
    const deps = yTxns.filter(t => t.type === 'deposit')
      .reduce((s, t) => s + (t.new_funds_amount != null ? t.new_funds_amount : (t.net_amount || t.amount)), 0);
    // Retraits IMPOSABLES de l'année (règle partagée avec l'affichage — voir le module).
    const wds = yTxns
      .filter(t => estRetraitImposable(t, p.type))
      .reduce((s, t) => s + (t.net_amount || t.amount), 0);
    const yearFees = yTxns.reduce((s, t) => s + (t.fees_amount || 0), 0);

    // Valeur actuelle de l'enveloppe : dernière calibration si elle existe, sinon
    // le solde des versements. Sans calibration, `balance + total_withdrawals`
    // vaut exactement `total_deposits` → la quote-part de plus-value est nulle,
    // ce qui est le comportement voulu (aucune valorisation connue).
    const lastCal      = getCalibrations(p.id).slice(-1)[0];
    const currentValue = lastCal ? lastCal.total_value : p.balance;

    // Plus-values contenues dans les retraits de l'année — règle des rachats partiels,
    // appliquée retrait par retrait (versements nets et valeur au jour du retrait) :
    // voir lib/plusValuesRachats.js et scripts/test-plus-values.js.
    const cash = p.cash_balance || 0;
    const { gains } = plusValuesDeLAnnee({
      transactions: txns,
      calibrations: getCalibrations(p.id),
      typeEnveloppe: p.type,
      annee: year,
    });
    // Livret réglementé : les intérêts sont acquis chaque année et ne dépendent pas d'un
    // retrait. La quote-part de plus-value ci-dessus (règle des rachats partiels) n'a donc
    // pas de sens ici ; on expose l'écart entre la valeur actuelle et les versements nets,
    // c'est-à-dire les intérêts accumulés. Sans calibration, `currentValue` vaut le solde
    // des versements : l'écart est nul, ce qui est honnête (aucune valorisation connue).
    const isExonere = p.type === 'compte_réglementé';
    const versementsNets = (p.total_deposits || 0) - (p.total_withdrawals || 0);
    const interetsExoneres = isExonere
      ? Math.max(0, (currentValue || 0) - versementsNets)
      : 0;

    return {
      portfolio: p,
      is_tax_exempt: isExonere,
      exempt_interest: +interetsExoneres.toFixed(2),
      year_deposits: +deps.toFixed(2),
      year_withdrawals: +wds.toFixed(2),
      year_fees: +yearFees.toFixed(2),
      year_transactions: yTxns.sort((a, b) => a.date.localeCompare(b.date)),
      all_time_deposits: p.total_deposits,
      all_time_withdrawals: p.total_withdrawals,
      balance: p.balance,
      current_value: +(currentValue || 0).toFixed(2),
      // Espèces non réinvesties, affichées à part : elles complètent la valeur calibrée
      // (positions détenues) et entrent dans la valeur retenue pour la plus-value.
      cash_balance: +cash.toFixed(2),
      // Cessions d'actifs numériques imposables cette année : elles se déclarent
      // l'année suivante, ce que le rapport doit dire pour ne pas induire en erreur.
      has_taxable_crypto: yTxns.some(t => t.asset_type === 'crypto' && estRetraitImposable(t, p.type)),
      is_calibrated: !!lastCal,
      estimated_gains: +Math.max(0, gains).toFixed(2),
      tax: calculateTax(p.type, p.total_deposits, wds, gains, p.contract_start_date, year)
    };
  });
}

// ============ EXPORT / IMPORT ============

function exportJSON() { return getData(); }
function importJSON(json) {
  const d = {
    portfolios: json.portfolios || [],
    transactions: json.transactions || [],
    movement_templates: json.movement_templates || [],
    documents: json.documents || []
  };
  setData(d);
  addLog(`DATA_IMPORTED: ${d.portfolios.length} portfolios, ${d.transactions.length} transactions`); 
}

// ============ SIMULATIONS MANAGEMENT ============

function saveSimulations() {
  _hasUnsavedChanges = true;
  storageService.scheduleSave(() => JSON.stringify(buildExportPayload(), null, 2));
}

function getSimulations() {
  return _simulationsData.simulations || [];
}

function getSimulation(id) {
  return _simulationsData.simulations.find(s => s.id === id);
}

/**
 * Crée une simulation.
 * @param {string} name
 * @param {{ blank?: boolean }} [options] — blank=true → simulation vierge
 *        (aucune enveloppe pré-remplie). Par défaut, importe les enveloppes
 *        et transactions actuelles du tableau de bord.
 */
function createSimulation(name, options = {}) {
  const blank = options.blank === true;
  // COPIE PROFONDE obligatoire : les enveloppes de simulation sont fictives et
  // totalement isolées du tableau de bord. Un clone superficiel (spread) partagerait
  // les tableaux imbriqués (ex. asset_allocations) par référence ; éditer la simulation
  // pourrait alors muter une enveloppe réelle. JSON-clone car données sérialisables.
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // Mode « importer » : copier les enveloppes + transactions existantes.
  // Mode « vierge » : démarrer sans aucune enveloppe.
  const existingPortfolios = blank ? [] : getPortfolios().map(p => {
    // Démarrer la simulation sur la DERNIÈRE VALEUR CALIBRÉE de l'enveloppe
    // (cohérent avec la « Valeur totale » et le solde affichés sur le tableau de bord),
    // et non sur le solde brut des versements.
    const lastCal = getCalibrations(p.id).slice(-1)[0];
    const calibratedValue = lastCal ? lastCal.total_value : (p.balance || 0);
    // Rendement cible par défaut d'une enveloppe IMPORTÉE = son rendement réel calibré
    // (depuis l'origine, annualisé). On poursuit ainsi la tendance historique pour la
    // projection ; reste librement modifiable. À défaut de calibration, on garde le taux importé.
    const ry = computeRealYield(p.id);
    const targetRate = (ry && ry.inceptionYield != null) ? ry.inceptionYield : p.annual_return_rate;
    return {
      ...clone(p),
      id: `sim_${p.id}`, // Préfixer pour différencier
      original_id: p.id,
      balance: calibratedValue,
      annual_return_rate: targetRate,
      // Les livrets réglementés sont importés comme enveloppes à part entière ;
      // ils restent identifiables par leur `type === 'compte_réglementé'`, ce qui permet
      // d'appliquer la même convention d'exclusion de performance que le tableau de bord.
    };
  });

  const existingTransactions = blank ? [] : getData().transactions.map(t => ({
    ...clone(t),
    id: `sim_${t.id}`,
    portfolio_id: `sim_${t.portfolio_id}`,
    original_id: t.id,
  }));

  // Calibrations / récurrents / modèles du tableau de bord, importés en COPIES PROFONDES
  // indépendantes (nouveaux id, portfolio_id préfixé). Les éditer dans la simulation
  // ne touche jamais les originaux. compte_cheque exclu (géré par le budget, hors enveloppes).
  const _dashPids = blank ? new Set() : new Set(getPortfolios().map(p => p.id));
  const existingCalibrations = blank ? [] : (getData().calibrations || [])
    .filter(c => _dashPids.has(c.portfolio_id))
    .map(c => ({ ...clone(c), id: `sim_${c.id}`, portfolio_id: `sim_${c.portfolio_id}`, original_id: c.id }));
  const existingRegularMovements = blank ? [] : getRegularMovements()
    .filter(rm => _dashPids.has(rm.portfolio_id))
    .map(rm => ({ ...clone(rm), id: `sim_${rm.id}`, portfolio_id: `sim_${rm.portfolio_id}`, original_id: rm.id }));
  const existingTemplates = blank ? [] : getAllMovementTemplates()
    .filter(tpl => _dashPids.has(tpl.portfolio_id))
    .map(tpl => ({ ...clone(tpl), id: `sim_${tpl.id}`, portfolio_id: `sim_${tpl.portfolio_id}`, original_id: tpl.id }));

  const simulation = {
    id: `simulation_${Date.now()}`,
    name,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    portfolios: existingPortfolios,
    transactions: existingTransactions,
    // Espace de noms simulation : isolé des données du tableau de bord
    calibrations: existingCalibrations,
    regular_movements: existingRegularMovements,
    movement_templates: existingTemplates,
    // Paramètres FIRE par défaut
    fire_settings: {
      target_return_rate: 4, // 4% rendement cible
      monthly_need: 2500, // 2500€/mois
    },
    // Paramètres de stress test
    stress_test: null, // { date, applied: true/false }
    // Horizon de projection mémorisé (en années depuis l'année courante)
    lastProjectionYears: null,
  };
  
  _simulationsData.simulations.push(simulation);
  saveSimulations();
  addLog(`SIMULATION_CREATED: ${simulation.id}`);
  // Gamification Q7 — vérifier si ≥ 2 simulations existent maintenant
  try { _getQuestService()?.checkCurrentQuest(); } catch (_) {}
  return simulation;
}

function updateSimulation(id, updates) {
  const index = _simulationsData.simulations.findIndex(s => s.id === id);
  if (index === -1) throw new Error("Simulation non trouvée");
  
  _simulationsData.simulations[index] = {
    ..._simulationsData.simulations[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  saveSimulations();
  addLog(`SIMULATION_UPDATED: ${id}`);
  return _simulationsData.simulations[index];
}

function deleteSimulation(id) {
  const index = _simulationsData.simulations.findIndex(s => s.id === id);
  if (index === -1) throw new Error("Simulation non trouvée");
  
  const name = _simulationsData.simulations[index].name;
  _simulationsData.simulations.splice(index, 1);
  saveSimulations();
  addLog(`SIMULATION_DELETED: ${id}`);
}

// Ajouter un portefeuille à une simulation
function addSimulationPortfolio(simulationId, portfolioData) {
  const sim = getSimulation(simulationId);
  if (!sim) throw new Error("Simulation non trouvée");
  
  const portfolio = {
    id: `sim_portfolio_${Date.now()}`,
    name: portfolioData.name,
    type: portfolioData.type || 'PEA',
    balance: 0,
    total_deposits: 0,
    total_withdrawals: 0,
    total_fees: 0,
    annual_return_rate: portfolioData.annual_return_rate || DEFAULT_RATES[portfolioData.type] || 8,
    annual_fees_pct: portfolioData.annual_fees_pct || 0,
    annual_fees_type: portfolioData.annual_fees_type === 'euro' ? 'euro' : 'percent',
    contract_start_date: portfolioData.contract_start_date || new Date().toISOString().split('T')[0],
    created_at: new Date().toISOString(),
  };
  
  sim.portfolios.push(portfolio);
  updateSimulation(simulationId, { portfolios: sim.portfolios });
  return portfolio;
}

// Supprimer un portefeuille d'une simulation
function deleteSimulationPortfolio(simulationId, portfolioId) {
  const sim = getSimulation(simulationId);
  if (!sim) throw new Error("Simulation non trouvée");
  
  sim.portfolios = sim.portfolios.filter(p => p.id !== portfolioId);
  sim.transactions = sim.transactions.filter(t => t.portfolio_id !== portfolioId);
  updateSimulation(simulationId, { portfolios: sim.portfolios, transactions: sim.transactions });
}

// Ajouter une transaction à une simulation (dates futures autorisées)
function addSimulationTransaction(simulationId, portfolioId, txData) {
  const sim = getSimulation(simulationId);
  if (!sim) throw new Error("Simulation non trouvée");
  
  const portfolio = sim.portfolios.find(p => p.id === portfolioId);
  if (!portfolio) throw new Error("Portefeuille non trouvé");
  
  // Frais : pourcentage (défaut) ou montant fixe en € selon fees_type — aligné sur createTransaction.
  const amount    = parseFloat(txData.amount);
  const feesType  = txData.fees_type === 'euro' ? 'euro' : 'percent';
  const feeInput  = parseFloat(txData.fees_pct) || 0;
  const fees_pct  = feesType === 'percent' ? feeInput : 0;
  const fees_amount = feesType === 'euro'
    ? Math.round(feeInput * 100) / 100
    : Math.round(amount * fees_pct / 100 * 100) / 100;
  // Sens des frais : 'deducted' (défaut) net = brut − frais ; 'added' net = brut + frais.
  const feeDirection = txData.fee_direction === 'added' ? 'added' : 'deducted';
  const net_amount = Math.round((feeDirection === 'added' ? amount + fees_amount : amount - fees_amount) * 100) / 100;
  // Pour un retrait : net reçu = montant − frais (cohérent avec le tableau de bord)
  const balanceDelta = txData.type === 'deposit' ? net_amount : net_amount;

  // Validation plafond PEA (150 000 €) - compte uniquement les vrais dépôts
  if (portfolio.type === 'PEA' && txData.type === 'deposit') {
    const existingDeposits = sim.transactions
      .filter(t => t.portfolio_id === portfolioId && t.type === 'deposit')
      .reduce((sum, t) => sum + (t.net_amount || t.amount), 0);
    if (existingDeposits + net_amount > PEA_MAX) {
      const remaining = Math.max(0, PEA_MAX - existingDeposits);
      throw new Error(`PEA: plafond de ${PEA_MAX.toLocaleString('fr-FR')} € dépassé. Reste disponible: ${remaining.toLocaleString('fr-FR')} €`);
    }
  }

  const transaction = {
    id: `sim_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    portfolio_id: portfolioId,
    date: txData.date,
    type: txData.type,
    amount: amount,
    fees_pct: fees_pct,
    fees_amount: fees_amount,
    fees_type: feesType,
    fee_direction: feeDirection,
    net_amount: net_amount,
    annual_fees_pct: parseFloat(txData.annual_fees_pct) || 0,
    annual_fees_type: txData.annual_fees_type === 'euro' ? 'euro' : 'percent',
    note: txData.note || '',
    template_id: txData.template_id || null,
    asset_type: txData.asset_type || null,
    custom_asset_type: txData.custom_asset_type || null,
    movement_group_id: txData.movement_group_id || null,
    keep_in_cash: txData.type === 'withdrawal' ? (txData.keep_in_cash || false) : false,
    quantity: txData.quantity != null && txData.quantity !== '' ? parseFloat(txData.quantity) : null,
    unit_price: txData.unit_price != null && txData.unit_price !== '' ? parseFloat(txData.unit_price) : null,
    created_at: new Date().toISOString(),
  };

  sim.transactions.push(transaction);

  // Mettre à jour le solde du portefeuille
  if (txData.type === 'deposit') {
    portfolio.balance        = Math.round(((portfolio.balance || 0) + balanceDelta) * 100) / 100;
    portfolio.total_deposits = Math.round(((portfolio.total_deposits || 0) + net_amount) * 100) / 100;
    portfolio.total_fees     = Math.round(((portfolio.total_fees || 0) + fees_amount) * 100) / 100;
  } else if (txData.type === 'stress_crash') {
    portfolio.balance        = Math.round(((portfolio.balance || 0) - amount) * 100) / 100;
  } else {
    portfolio.balance           = Math.round(((portfolio.balance || 0) - amount) * 100) / 100;
    portfolio.total_withdrawals = Math.round(((portfolio.total_withdrawals || 0) + amount) * 100) / 100;
  }

  updateSimulation(simulationId, { portfolios: sim.portfolios, transactions: sim.transactions });
  return transaction;
}

// Supprimer une transaction d'une simulation
function deleteSimulationTransaction(simulationId, transactionId) {
  const sim = getSimulation(simulationId);
  if (!sim) throw new Error("Simulation non trouvée");
  
  const tx = sim.transactions.find(t => t.id === transactionId);
  if (!tx) throw new Error("Transaction non trouvée");
  
  const portfolio = sim.portfolios.find(p => p.id === tx.portfolio_id);
  if (portfolio) {
    if (tx.type === 'deposit') {
      portfolio.balance -= tx.net_amount;
      portfolio.total_deposits -= tx.net_amount;
      portfolio.total_fees -= tx.fees_amount;
    } else if (tx.type === 'stress_crash') {
      // Annuler le stress_crash : restaurer le solde
      portfolio.balance += tx.amount;
    } else {
      portfolio.balance += tx.amount;
      portfolio.total_withdrawals -= tx.amount;
    }
  }
  
  sim.transactions = sim.transactions.filter(t => t.id !== transactionId);
  updateSimulation(simulationId, { portfolios: sim.portfolios, transactions: sim.transactions });
}

// Créer des transactions récurrentes dans une simulation (dates futures autorisées)
function addSimulationRecurringTransactions(simulationId, portfolioId, txData) {
  const freq = txData.recurrence;
  if (!freq || freq === 'none') {
    return [addSimulationTransaction(simulationId, portfolioId, txData)];
  }
  
  const sim = getSimulation(simulationId);
  if (!sim) throw new Error("Simulation non trouvée");
  
  const portfolio = sim.portfolios.find(p => p.id === portfolioId);
  if (!portfolio) throw new Error("Portefeuille non trouvé");
  
  // Parser les dates en utilisant l'heure locale
  const parseLocalDate = (dateStr) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };
  
  const startDate = parseLocalDate(txData.date);
  const endDate = parseLocalDate(txData.end_date);
  
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate < startDate) {
    throw new Error('Dates invalides');
  }
  
  const results = [];
  const createdMonths = new Set();
  let iterCount = 0;
  
  while (iterCount <= 1000) {
    let current;
    
    if (freq === 'monthly') {
      current = addMonths(startDate, iterCount);
    } else if (freq === 'quarterly') {
      current = addMonths(startDate, iterCount * 3);
    } else if (freq === 'semi_annual') {
      current = addMonths(startDate, iterCount * 6);
    } else if (freq === 'annual') {
      current = new Date(startDate);
      current.setFullYear(startDate.getFullYear() + iterCount);
    } else {
      break;
    }
    
    if (current > endDate) break;
    
    const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
    
    if (!createdMonths.has(monthKey)) {
      createdMonths.add(monthKey);
      const dateTx = { ...txData, date: formatDateLocal(current) };
      results.push(addSimulationTransaction(simulationId, portfolioId, dateTx));
    }
    
    iterCount++;
  }
  
  addLog(`SIMULATION_RECURRING: ${results.length} transactions créées (${freq})`);
  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIMULATION — espace de noms isolé : moteur de calcul réutilisé sur données sim +
// CRUD calibrations / modèles / récurrents scopés à une simulation.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Exécute `fn` en faisant pointer temporairement _currentData sur les données de la
 * simulation. Permet de réutiliser À L'IDENTIQUE tout le moteur de calcul
 * (computeRealYield, getPortfolioRealHistory, computeAnnualYields, getPortfolioPnlByAsset…)
 * sur des données de simulation. fn DOIT être synchrone et en LECTURE SEULE.
 */
function _withSimData(simulationId, fn) {
  const sim = getSimulation(simulationId);
  if (!sim) return fn();
  const saved = _currentData;
  _currentData = {
    ...saved,
    portfolios:         sim.portfolios || [],
    transactions:       sim.transactions || [],
    calibrations:       sim.calibrations || [],
    movement_templates: sim.movement_templates || [],
    regular_movements:  sim.regular_movements || [],
  };
  try { return fn(); }
  finally { _currentData = saved; }
}

function updateSimulationPortfolio(simulationId, portfolioId, updates) {
  const sim = getSimulation(simulationId);
  if (!sim) throw new Error('Simulation non trouvée');
  const idx = (sim.portfolios || []).findIndex(p => p.id === portfolioId);
  if (idx === -1) throw new Error('Enveloppe non trouvée');
  sim.portfolios[idx] = { ...sim.portfolios[idx], ...updates };
  updateSimulation(simulationId, { portfolios: sim.portfolios });
  return sim.portfolios[idx];
}

// Édition d'une transaction de simulation = suppression + ré-ajout (recalcule frais/net & solde).
function updateSimulationTransaction(simulationId, transactionId, updates) {
  const sim = getSimulation(simulationId);
  if (!sim) throw new Error('Simulation non trouvée');
  const tx = (sim.transactions || []).find(t => t.id === transactionId);
  if (!tx) throw new Error('Transaction non trouvée');
  const portfolioId = tx.portfolio_id;
  const merged = { ...tx, ...updates };
  deleteSimulationTransaction(simulationId, transactionId);
  return addSimulationTransaction(simulationId, portfolioId, merged);
}

// ── Calibrations de simulation (même modèle que addCalibration) ────────────────
function getSimulationCalibrations(simulationId, portfolioId) {
  const sim = getSimulation(simulationId);
  if (!sim) return [];
  const cals = (sim.calibrations || []).filter(c => !portfolioId || c.portfolio_id === portfolioId);
  return [...cals].sort((a, b) => a.date.localeCompare(b.date));
}
function addSimulationCalibration(simulationId, cal) {
  const sim = getSimulation(simulationId);
  if (!sim) throw new Error('Simulation non trouvée');
  if (!sim.calibrations) sim.calibrations = [];
  const entry = {
    id: `sim_cal_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    portfolio_id: cal.portfolio_id,
    date: cal.date,
    total_value: parseFloat(cal.total_value) || 0,
    asset_breakdown: cal.asset_breakdown || null,
    created_at: new Date().toISOString(),
  };
  sim.calibrations.push(entry);
  updateSimulation(simulationId, { calibrations: sim.calibrations });
  return entry;
}
function deleteSimulationCalibration(simulationId, calId) {
  const sim = getSimulation(simulationId);
  if (!sim) return;
  sim.calibrations = (sim.calibrations || []).filter(c => c.id !== calId);
  updateSimulation(simulationId, { calibrations: sim.calibrations });
}

// ── Modèles (mouvements types) de simulation ───────────────────────────────────
function getSimulationMovementTemplates(simulationId, portfolioId) {
  const sim = getSimulation(simulationId);
  if (!sim) return [];
  const tpls = sim.movement_templates || [];
  return portfolioId ? tpls.filter(m => m.portfolio_id === portfolioId) : tpls;
}
function createSimulationMovementTemplate(simulationId, data) {
  const sim = getSimulation(simulationId);
  if (!sim) throw new Error('Simulation non trouvée');
  if (!sim.movement_templates) sim.movement_templates = [];
  const mt = {
    id: `sim_tpl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    name: data.name,
    portfolio_id: data.portfolio_id,
    fees_pct: parseFloat(data.fees_pct) || 0,
    fees_type: data.fees_type === 'euro' ? 'euro' : 'percent',
    annual_fees_pct: parseFloat(data.annual_fees_pct) || 0,
    annual_fees_type: data.annual_fees_type === 'euro' ? 'euro' : 'percent',
    asset_type: data.asset_type || null,
    multi_asset_allocations: data.multi_asset_allocations || null,
    created_at: new Date().toISOString(),
  };
  sim.movement_templates.push(mt);
  updateSimulation(simulationId, { movement_templates: sim.movement_templates });
  return mt;
}
function updateSimulationMovementTemplate(simulationId, id, updates) {
  const sim = getSimulation(simulationId);
  if (!sim) throw new Error('Simulation non trouvée');
  const idx = (sim.movement_templates || []).findIndex(m => m.id === id);
  if (idx === -1) throw new Error('Modèle introuvable');
  sim.movement_templates[idx] = { ...sim.movement_templates[idx], ...updates };
  updateSimulation(simulationId, { movement_templates: sim.movement_templates });
  return sim.movement_templates[idx];
}
function deleteSimulationMovementTemplate(simulationId, id) {
  const sim = getSimulation(simulationId);
  if (!sim) return;
  sim.movement_templates = (sim.movement_templates || []).filter(m => m.id !== id);
  updateSimulation(simulationId, { movement_templates: sim.movement_templates });
}

// ── Mouvements récurrents de simulation ────────────────────────────────────────
function getSimulationRegularMovements(simulationId) {
  const sim = getSimulation(simulationId);
  return sim ? (sim.regular_movements || []) : [];
}
function createSimulationRegularMovement(simulationId, data) {
  const sim = getSimulation(simulationId);
  if (!sim) throw new Error('Simulation non trouvée');
  if (!sim.regular_movements) sim.regular_movements = [];
  const rm = {
    id: `sim_rm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    portfolio_id: data.portfolio_id,
    type: data.type || 'deposit',
    amount: parseFloat(data.amount) || 0,
    start_date: data.start_date,
    recurrence: data.recurrence || 'monthly',
    end_date: data.end_date || null,
    note: data.note || null,
    asset_types: Array.isArray(data.asset_types) ? data.asset_types : [],
    asset_allocations: Array.isArray(data.asset_allocations) ? data.asset_allocations : [],
    fees_pct: parseFloat(data.fees_pct) || 0,
    fees_type: data.fees_type === 'euro' ? 'euro' : 'percent',
    annual_fees_pct: parseFloat(data.annual_fees_pct) || 0,
    annual_fees_type: data.annual_fees_type === 'euro' ? 'euro' : 'percent',
    status: 'active',
    created_at: new Date().toISOString(),
  };
  sim.regular_movements.push(rm);
  updateSimulation(simulationId, { regular_movements: sim.regular_movements });
  try { syncSimulationRegularMovements(simulationId); } catch (_) {}
  return rm;
}
function updateSimulationRegularMovement(simulationId, id, updates) {
  const sim = getSimulation(simulationId);
  if (!sim) throw new Error('Simulation non trouvée');
  const idx = (sim.regular_movements || []).findIndex(rm => rm.id === id);
  if (idx === -1) throw new Error('Mouvement récurrent introuvable');
  sim.regular_movements[idx] = {
    ...sim.regular_movements[idx],
    ...updates,
    asset_allocations: updates.asset_allocations !== undefined
      ? updates.asset_allocations
      : (sim.regular_movements[idx].asset_allocations || []),
  };
  updateSimulation(simulationId, { regular_movements: sim.regular_movements });
  try { syncSimulationRegularMovements(simulationId); } catch (_) {}
  return sim.regular_movements[idx];
}
function stopSimulationRegularMovement(simulationId, id) {
  const todayStr = new Date().toISOString().split('T')[0];
  return updateSimulationRegularMovement(simulationId, id, { end_date: todayStr, status: 'stopped' });
}
function deleteSimulationRegularMovement(simulationId, id) {
  const sim = getSimulation(simulationId);
  if (!sim) return { deletedTxCount: 0 };
  const linked = (sim.transactions || []).filter(t => t.from_recurring_id === id);
  sim.transactions     = (sim.transactions || []).filter(t => t.from_recurring_id !== id);
  sim.regular_movements = (sim.regular_movements || []).filter(rm => rm.id !== id);
  updateSimulation(simulationId, { transactions: sim.transactions, regular_movements: sim.regular_movements });
  return { deletedTxCount: linked.length };
}
/**
 * Matérialise les occurrences des récurrents actifs dans sim.transactions (multi-actifs groupés).
 * @param {string} [untilDate] — borne supérieure 'YYYY-MM-DD'. Par défaut aujourd'hui ;
 *   le curseur de date cible passe la date cible pour PROLONGER les récurrents sans date de fin
 *   (occurrences futures jusqu'à l'horizon). Idempotent : ne crée que les dates manquantes.
 */
function syncSimulationRegularMovements(simulationId, untilDate) {
  const sim = getSimulation(simulationId);
  if (!sim) return 0;
  const rms = (sim.regular_movements || []).filter(rm => rm.status === 'active');
  const todayStr = new Date().toISOString().split('T')[0];
  // Les récurrents AVEC date de fin ne sont jamais prolongés au-delà de leur fin ;
  // ceux SANS date de fin sont prolongés jusqu'à l'horizon (untilDate) s'il dépasse aujourd'hui.
  untilDate = untilDate && untilDate > todayStr ? untilDate : todayStr;
  let applied = 0;
  let changed = false;

  // ── TRIM : retirer les occurrences FUTURES matérialisées AU-DELÀ de l'horizon ──
  // Sans ça, revenir à une date plus proche laisserait la courbe / les valeurs / les frais
  // bloqués sur l'horizon le plus lointain déjà atteint. On ne retire que les occurrences
  // récurrentes futures (date > horizon ET > aujourd'hui) en annulant leur effet sur le solde.
  const toRemove = (sim.transactions || []).filter(t =>
    t.from_recurring_id && t.date > untilDate && t.date > todayStr
  );
  if (toRemove.length) {
    const removeIds = new Set(toRemove.map(t => t.id));
    for (const t of toRemove) {
      const p = (sim.portfolios || []).find(pp => pp.id === t.portfolio_id);
      if (!p) continue;
      const amount = t.amount || 0;
      const net    = t.net_amount != null ? t.net_amount : amount;
      const fee    = t.fees_amount || 0;
      if (t.type === 'deposit') {
        // Symétrique de la matérialisation : le solde/versements ont reçu le NET
        p.balance        = Math.round(((p.balance || 0) - net) * 100) / 100;
        p.total_deposits = Math.round(((p.total_deposits || 0) - net) * 100) / 100;
        p.total_fees     = Math.round(((p.total_fees || 0) - fee) * 100) / 100;
      } else if (t.type === 'withdrawal') {
        p.balance           = Math.round(((p.balance || 0) + amount) * 100) / 100;
        p.total_withdrawals = Math.round(((p.total_withdrawals || 0) - amount) * 100) / 100;
        p.total_fees        = Math.round(((p.total_fees || 0) - fee) * 100) / 100;
      }
    }
    sim.transactions = (sim.transactions || []).filter(t => !removeIds.has(t.id));
    changed = true;
  }
  for (const rm of rms) {
    try {
      const allDates = _generateRecurringOccurrences(rm, untilDate);
      if (!allDates.length) continue;
      // Reconnaître AUSSI les occurrences importées (leur from_recurring_id pointe encore
      // sur l'id du tableau de bord = rm.original_id) afin de NE PAS les re-matérialiser → pas de doublon.
      const existing = new Set((sim.transactions || [])
        .filter(t => t.from_recurring_id === rm.id || (rm.original_id && t.from_recurring_id === rm.original_id))
        .map(t => t.date));
      const toApply = allDates.filter(d => !existing.has(d));
      if (!toApply.length) continue;
      const portfolio = (sim.portfolios || []).find(p => p.id === rm.portfolio_id);
      if (!portfolio) continue;
      // Frais de transaction du récurrent appliqués à CHAQUE occurrence (net de frais).
      const feesType = rm.fees_type === 'euro' ? 'euro' : 'percent';
      const feeInput = parseFloat(rm.fees_pct) || 0;
      const feeDirection = rm.fee_direction === 'added' ? 'added' : 'deducted';
      const annualFeesType = rm.annual_fees_type === 'euro' ? 'euro' : 'percent';
      const annualFeeInput = parseFloat(rm.annual_fees_pct) || 0;
      for (const date of toApply) {
        const amount   = parseFloat(rm.amount) || 0;
        const totalFee = feesType === 'euro'
          ? Math.min(feeInput, amount)
          : Math.round(amount * feeInput / 100 * 100) / 100;
        const netTotal = Math.round((feeDirection === 'added' ? amount + totalFee : amount - totalFee) * 100) / 100;
        const allocations = (rm.asset_allocations && rm.asset_allocations.length > 0)
          ? rm.asset_allocations
          : [{ type: rm.asset_types?.[0] || 'autre', pct: 100 }];
        const createdAt = new Date().toISOString();
        const groupId = allocations.length > 1 ? `${rm.id}_${date}` : null;
        if (!sim.transactions) sim.transactions = [];
        for (const alloc of allocations) {
          const allocAmount = Math.round(amount * ((alloc.pct ?? 100) / 100) * 100) / 100;
          // Frais répartis proportionnellement à l'allocation
          const allocFee = amount > 0 ? Math.round(totalFee * (allocAmount / amount) * 100) / 100 : 0;
          const allocNet = Math.round((feeDirection === 'added' ? allocAmount + allocFee : allocAmount - allocFee) * 100) / 100;
          const allocAnnualEuro = (annualFeesType === 'euro' && amount > 0)
            ? Math.round(annualFeeInput * (allocAmount / amount) * 100) / 100
            : 0;
          sim.transactions.push({
            id: `sim_tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            portfolio_id: rm.portfolio_id,
            type: rm.type,
            amount: allocAmount,
            fees_pct: feesType === 'percent' ? feeInput : 0,
            fees_amount: allocFee,
            fees_type: feesType,
            fee_direction: feeDirection,
            annual_fees_pct: annualFeesType === 'percent' ? annualFeeInput : allocAnnualEuro,
            annual_fees_type: annualFeesType,
            net_amount: allocNet,
            date,
            note: `[Mouvement récurrent]${rm.note ? ' ' + rm.note : ''}`,
            asset_type: alloc.type || 'autre',
            movement_group_id: groupId,
            from_recurring_id: rm.id,
            created_at: createdAt,
          });
        }
        if (rm.type === 'deposit') {
          // Net investi (frais déduits) → cohérent avec une simulation « nette de frais »
          portfolio.balance        = Math.round(((portfolio.balance || 0) + netTotal) * 100) / 100;
          portfolio.total_deposits = Math.round(((portfolio.total_deposits || 0) + netTotal) * 100) / 100;
          portfolio.total_fees     = Math.round(((portfolio.total_fees || 0) + totalFee) * 100) / 100;
        } else {
          portfolio.balance           = Math.round(((portfolio.balance || 0) - amount) * 100) / 100;
          portfolio.total_withdrawals = Math.round(((portfolio.total_withdrawals || 0) + amount) * 100) / 100;
          portfolio.total_fees        = Math.round(((portfolio.total_fees || 0) + totalFee) * 100) / 100;
        }
        applied++;
      }
    } catch (e) { console.warn('[SimRecurring] sync error', rm.id, e); }
  }
  if (applied > 0 || changed) updateSimulation(simulationId, { portfolios: sim.portfolios, transactions: sim.transactions });
  return applied + (changed ? 1 : 0);
}

// Calculer l'historique d'un portefeuille de simulation
function getSimulationPortfolioHistory(simulationId, portfolioId) {
  const sim = getSimulation(simulationId);
  if (!sim) return [];
  
  const portfolio = sim.portfolios.find(p => p.id === portfolioId);
  if (!portfolio) return [];
  
  const transactions = sim.transactions.filter(t => t.portfolio_id === portfolioId);
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length) return [];
  
  const annualRate = (portfolio.annual_return_rate || 0) / 100;
  // Mode "euro" : pas de taux annuel d'enveloppe (évite de lire un montant € comme un %).
  const annualFees = (portfolio.annual_fees_type === 'euro') ? 0 : (portfolio.annual_fees_pct || 0) / 100;
  const netAnnualRate = annualRate - annualFees;
  
  const months = {};
  sorted.forEach(t => { 
    const m = t.date.substring(0, 7); 
    if (!months[m]) months[m] = []; 
    months[m].push(t); 
  });
  
  const sortedMonths = Object.keys(months).sort();
  let cumDeps = 0;
  let theoVal = 0;
  let interestOnly = 0; // Intérêts seuls
  let startOfYearValue = 0;
  let lastYear = null;
  
  return sortedMonths.map((month) => {
    const currentYear = month.substring(0, 4);
    
    if (lastYear !== null && currentYear !== lastYear) {
      const interest = startOfYearValue * netAnnualRate;
      theoVal += interest;
      interestOnly += interest;
      startOfYearValue = theoVal;
    }
    
    lastYear = currentYear;
    
    months[month].forEach(t => { 
      const net = t.net_amount || t.amount;
      if (t.type === "deposit") { 
        cumDeps += net; 
        theoVal += net;
        if (startOfYearValue === 0) startOfYearValue = net;
      } else { 
        cumDeps -= net; 
        theoVal -= net; 
      } 
    });
    
    return { 
      month, 
      deposits: Math.round(cumDeps * 100) / 100, 
      value: Math.round(theoVal * 100) / 100,
      interest: Math.round(interestOnly * 100) / 100,
    };
  });
}

// Calculer les statistiques globales d'une simulation.
// `targetMonth` (optionnel, 'YYYY-MM') : PROJETTE la valeur à cet horizon futur (même
// moteur par enveloppe que la page de simulation) ; sinon valeur « à aujourd'hui ».
function getSimulationStats(simulationId, targetMonth = null) {
  const sim = getSimulation(simulationId);
  if (!sim) return null;

  // ── Cache : ne recalcule que si la simulation ou les paramètres FIRE changent.
  // updated_at est mis à jour à chaque updateSimulation (transactions, inflation, stress…).
  const _fire = getFireSettings();
  const _cacheKey = `${sim.id}|${sim.updated_at || ''}|${_fire.monthly_need}|${_fire.withdrawal_rate}|${targetMonth || ''}`;
  const _cached = _simStatsCache.get(_cacheKey);
  if (_cached) return _cached;

  // Récupérer les paramètres d'inflation
  const useInflation = sim.inflation_settings?.enabled || false;
  const inflRate = sim.inflation_settings?.rate || 2.5;
  
  // Calculer les valeurs réelles avec intérêts composés mensuels (formule fv)
  let totalDeposits = 0;  // Somme des versements nets (sans stress_crash)
  let totalValue = 0;     // Valeur totale avec intérêts composés
  
  sim.portfolios.forEach(portfolio => {
    const pTxns = sim.transactions
      .filter(t => t.portfolio_id === portfolio.id)
      .sort((a, b) => a.date.localeCompare(b.date));
    
    // Taux mensuel net = (rendement - frais - inflation si activée) / 12
    const annualRate = (portfolio.annual_return_rate || 0) / 100;
    const annualFees = (portfolio.annual_fees_type === 'euro') ? 0 : (portfolio.annual_fees_pct || 0) / 100;
    const annualInflation = useInflation ? (inflRate / 100) : 0;
    const netAnnualRate = Math.max(0, annualRate - annualFees - annualInflation);
    const monthlyRate = _effMonthlyRate(netAnnualRate);
    
    // Trouver tous les mois concernés
    if (pTxns.length === 0) return;
    
    const txDates = pTxns.map(t => t.date.substring(0, 7));
    const minMonth = txDates.reduce((a, b) => a < b ? a : b);
    const today = new Date().toISOString().substring(0, 7);
    // Horizon : dernier mouvement, aujourd'hui, ou l'horizon de projection demandé.
    const floor = (targetMonth && targetMonth > today) ? targetMonth : today;
    let maxMonth = txDates.reduce((a, b) => a > b ? a : b);
    if (floor > maxMonth) maxMonth = floor;
    
    // Générer les mois
    const months = [];
    let [year, month] = minMonth.split('-').map(Number);
    const [endYear, endMonth] = maxMonth.split('-').map(Number);
    
    while (year < endYear || (year === endYear && month <= endMonth)) {
      months.push(`${year}-${String(month).padStart(2, '0')}`);
      month++;
      if (month > 12) { month = 1; year++; }
    }
    
    let portfolioValue = 0;
    let portfolioDeposits = 0;
    
    months.forEach((monthKey, index) => {
      // Calculer les versements du mois
      const monthTxns = pTxns.filter(t => t.date.substring(0, 7) === monthKey);
      let monthDeposits = 0;
      let monthCrashLoss = 0;
      
      monthTxns.forEach(t => {
        const netAmount = t.net_amount || t.amount;
        if (t.type === 'deposit') {
          portfolioDeposits += netAmount;
          monthDeposits += netAmount;
        } else if (t.type === 'stress_crash') {
          // Le stress_crash ne modifie PAS les versements
          monthCrashLoss += netAmount;
        } else {
          portfolioDeposits -= netAmount;
          monthDeposits -= netAmount;
        }
      });
      
      // Premier mois : juste les versements
      if (index === 0) {
        portfolioValue = monthDeposits;
      } else {
        // Mois suivants : capitaliser puis ajouter les nouveaux versements
        portfolioValue = fv(monthlyRate, 1, 0, portfolioValue) + monthDeposits;
      }
      
      // Appliquer le crash après les calculs
      if (monthCrashLoss > 0) {
        portfolioValue -= monthCrashLoss;
      }
      
      if (portfolioValue < 0) portfolioValue = 0;
    });
    
    totalDeposits += portfolioDeposits;
    totalValue += portfolioValue;
  });
  
  totalDeposits = Math.round(totalDeposits * 100) / 100;
  totalValue = Math.round(totalValue * 100) / 100;
  const totalGains = Math.round((totalValue - totalDeposits) * 100) / 100;
  
  // Calcul FIRE: rendement annuel estimé
  const avgRate = sim.portfolios.length > 0 
    ? sim.portfolios.reduce((s, p) => s + (p.annual_return_rate || 0), 0) / sim.portfolios.length
    : 4;
  // FIRE : paramètres GLOBAUX partagés (_fire récupéré en tête pour la clé de cache)
  const fireRate = _fire.withdrawal_rate || 4;
  const monthlyNeed = _fire.monthly_need || 2500;
  const annualNeed = monthlyNeed * 12;

  // Montant nécessaire pour être FIRE: annualNeed / (fireRate/100)
  const fireTarget = annualNeed / (fireRate / 100);
  const annualIncome = totalValue * (fireRate / 100);
  const monthlyIncome = annualIncome / 12;
  const isFireOn = annualIncome >= annualNeed;
  const fireProgress = Math.min(100, (totalValue / fireTarget) * 100);

  const result = {
    totalDeposits,
    totalValue,
    totalGains,
    avgRate,
    fireTarget,
    fireRate,
    annualIncome,
    monthlyIncome,
    isFireOn,
    fireProgress,
    monthlyNeed,
    annualNeed,
  };
  // Mémoriser (cache borné pour éviter toute croissance illimitée).
  if (_simStatsCache.size > 100) _simStatsCache.delete(_simStatsCache.keys().next().value);
  _simStatsCache.set(_cacheKey, result);
  return result;
}

/**
 * Valeur / versements / gains PROJETÉS d'une simulation à un horizon donné, calculés
 * avec le MÊME moteur que la page de simulation (SimulationDetail) : contributions par
 * transaction (taux propre à chacune = rendement − frais de la transaction − frais de
 * l'enveloppe − inflation), versements = capital net EXTERNE (nouveaux fonds, hors
 * recyclage espèces), stress-crash proportionnel. → la tuile récapitulative affiche
 * EXACTEMENT les mêmes chiffres que la page détaillée.
 *   ⚠ Toute évolution du moteur de projection de SimulationDetail doit être répercutée ici.
 * @param {string} simulationId
 * @param {string|null} targetMonth — 'YYYY-MM' ; sinon horizon = max(dernier mvt, aujourd'hui)
 * @returns {{ totalValue, totalDeposits, totalGains } | null}
 */
function computeSimulationProjection(simulationId, targetMonth = null) {
  const sim = getSimulation(simulationId);
  if (!sim) return null;

  const useInflation    = sim.inflation_settings?.enabled || false;
  const inflRate        = sim.inflation_settings?.rate || 2.5;
  const annualInflation = useInflation ? (inflRate / 100) : 0;
  const today           = new Date().toISOString().substring(0, 7);

  // Borne de calcul : la date cible si elle est future, sinon aujourd'hui. Les occurrences
  // de récurrents déjà matérialisées AU-DELÀ (horizon plus lointain choisi auparavant)
  // sont ignorées : sans cela, la valeur « aujourd'hui » valait celle de l'horizon.
  const limit = (targetMonth && targetMonth > today) ? targetMonth : today;
  let totalValue = 0, totalDeposits = 0;

  (sim.portfolios || []).forEach(p => {
    const pTxns = (sim.transactions || [])
      .filter(t => t.portfolio_id === p.id && t.date.substring(0, 7) <= limit)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (pTxns.length === 0) return;

    const baseAnnualRate     = (p.annual_return_rate || 0) / 100;
    const envelopeAnnualFees = (p.annual_fees_pct || 0) / 100;

    // Horizon de l'enveloppe : 1er mouvement → borne de calcul (cible future, sinon aujourd'hui)
    const txMonths = pTxns.map(t => t.date.substring(0, 7));
    const minMonth = txMonths.reduce((a, b) => a < b ? a : b);
    let maxMonth   = txMonths.reduce((a, b) => a > b ? a : b);
    if (limit > maxMonth) maxMonth = limit;

    const months = [];
    let [y, m] = minMonth.split('-').map(Number);
    const [ey, em] = maxMonth.split('-').map(Number);
    while (y < ey || (y === ey && m <= em)) { months.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } }

    const txContributions = [];
    let pDeposits = 0, portfolioValue = 0;

    months.forEach((monthKey, index) => {
      const monthTxns = pTxns.filter(t => t.date.substring(0, 7) === monthKey);
      let monthCrashLoss = 0;

      monthTxns.forEach(t => {
        const netAmount = t.net_amount || t.amount;
        if (t.type === 'deposit') {
          pDeposits += (t.new_funds_amount != null ? t.new_funds_amount : netAmount);
          const txAnnualFees    = ((t.annual_fees_pct || 0) / 100) + envelopeAnnualFees;
          const txNetAnnualRate = Math.max(0, baseAnnualRate - txAnnualFees - annualInflation);
          const txMonthlyRate   = (1 + txNetAnnualRate) > 0 ? Math.pow(1 + txNetAnnualRate, 1 / 12) - 1 : txNetAnnualRate / 12;
          txContributions.push({ monthlyRate: txMonthlyRate, startMonthIndex: index, currentValue: netAmount });
        } else if (t.type === 'stress_crash') {
          monthCrashLoss += netAmount;
        } else {
          if (!t.keep_in_cash) pDeposits -= netAmount;
          let remaining = netAmount;
          for (let i = txContributions.length - 1; i >= 0 && remaining > 0; i--) {
            const c = txContributions[i];
            if (c.currentValue <= remaining) { remaining -= c.currentValue; c.currentValue = 0; }
            else { c.currentValue -= remaining; remaining = 0; }
          }
        }
      });

      portfolioValue = 0;
      txContributions.forEach(c => {
        if (c.currentValue > 0) {
          if (index - c.startMonthIndex > 0) c.currentValue = c.currentValue * (1 + c.monthlyRate);
          portfolioValue += c.currentValue;
        }
      });

      if (monthCrashLoss > 0 && portfolioValue > 0) {
        const effLoss = Math.min(monthCrashLoss, portfolioValue);
        const ratio   = effLoss / portfolioValue;
        txContributions.forEach(c => { c.currentValue = Math.max(0, c.currentValue * (1 - ratio)); });
        portfolioValue = Math.max(0, portfolioValue - effLoss);
      }
      if (portfolioValue < 0) portfolioValue = 0;
    });

    // Arrondi par enveloppe AVANT de sommer (identique à SimulationDetail, où
    // values[mois]/deposits[mois] sont arrondis puis agrégés) → total identique.
    totalValue    += Math.round(portfolioValue * 100) / 100;
    totalDeposits += Math.round(pDeposits * 100) / 100;
  });

  totalValue    = Math.round(totalValue * 100) / 100;
  totalDeposits = Math.round(totalDeposits * 100) / 100;
  return { totalValue, totalDeposits, totalGains: Math.round((totalValue - totalDeposits) * 100) / 100 };
}

// Exporter les simulations dans le JSON principal
function exportSimulationsToJSON() {
  return _simulationsData;
}

// Importer les simulations depuis un JSON
function importSimulationsFromJSON(json) {
  if (json && json.simulations) {
    _simulationsData = json;
    saveSimulations();
  }
}

// Obtenir les types d'actifs personnalisés (utilisés dans les transactions)
function getCustomAssetTypes() {
  const { transactions } = getData();
  const custom = new Set();
  transactions.forEach(tx => {
    const at = tx.asset_type;
    if (at && !ASSET_TYPES.includes(at) && at !== 'non_defini') {
      custom.add(at);
    }
    // Compatibilité ancienne version : autre + custom_asset_type
    if (at === 'autre' && tx.custom_asset_type) {
      custom.add(tx.custom_asset_type);
    }
  });
  return Array.from(custom);
}

// Résoudre le type d'actif effectif (gère l'ancien format autre + custom_asset_type)
function resolveAssetType(tx) {
  // Les livrets réglementés forment leur propre catégorie d'actif (jamais « Non défini »).
  if (tx.portfolio_id) {
    const p = (_currentData.portfolios || []).find(pp => pp.id === tx.portfolio_id);
    if (p && p.type === 'compte_réglementé') return 'livret_réglementé';
  }
  if (tx.asset_type === 'autre' && tx.custom_asset_type) {
    return tx.custom_asset_type;
  }
  return tx.asset_type || 'non_defini';
}

// Obtenir les statistiques par type d'actif
function getAssetTypeStats() {
  const { transactions } = getData();
  const stats = {};

  ASSET_TYPES.forEach(type => {
    stats[type] = { deposits: 0, withdrawals: 0, balance: 0, count: 0 };
  });
  stats['non_defini'] = { deposits: 0, withdrawals: 0, balance: 0, count: 0 };

  transactions.forEach(tx => {
    const statKey = resolveAssetType(tx);
    if (!stats[statKey]) {
      stats[statKey] = { deposits: 0, withdrawals: 0, balance: 0, count: 0 };
    }

    if (tx.type === 'deposit') {
      const net = tx.net_amount || tx.amount;
      stats[statKey].deposits += net;
      stats[statKey].balance += net;
    } else if (tx.type === 'withdrawal') {
      const gross = tx.amount || tx.net_amount;
      const net = tx.net_amount || tx.amount;
      stats[statKey].withdrawals += net;
      stats[statKey].balance -= gross;
    }
    stats[statKey].count++;
  });

  // Arrondir les valeurs
  Object.keys(stats).forEach(key => {
    stats[key].deposits = Math.round(stats[key].deposits * 100) / 100;
    stats[key].withdrawals = Math.round(stats[key].withdrawals * 100) / 100;
    stats[key].balance = Math.round(stats[key].balance * 100) / 100;
  });

  return stats;
}

/**
 * Répartition par type d'actif, sur base des VERSEMENTS ou de la VALEUR RÉELLE.
 * @param {boolean} useRealValue
 *   false → soldes des versements (== getAssetTypeStats().balance).
 *   true  → valeur réelle par enveloppe :
 *           • calibration avec détail par actif (niveau 2) → valeurs réelles par actif ;
 *           • calibration totale seule (niveau 1) → total réparti au prorata des versements ;
 *           • enveloppe non calibrée → soldes des versements (repli).
 * @returns {Object<string, number>} { assetType: value }
 */
function getAssetAllocation(useRealValue) {
  const totals = {};
  const add = (type, v) => {
    const k = type || 'non_defini';
    totals[k] = (totals[k] || 0) + v;
  };

  if (!useRealValue) {
    const stats = getAssetTypeStats();
    Object.entries(stats).forEach(([type, s]) => { if (s.balance > 0) add(type, s.balance); });
    return totals;
  }

  getPortfolios().forEach(p => {
    const cals    = getCalibrations(p.id);
    const lastCal = cals.length ? cals[cals.length - 1] : null;

    // Composition par actif de l'enveloppe, base versements (hors transactions de calibration)
    const envAsset = {};
    getTransactions(p.id).filter(t => !_isCalibrationTx(t)).forEach(t => {
      const k   = resolveAssetType(t) || 'non_defini';
      const net = t.net_amount ?? t.amount ?? 0;
      if (t.type === 'deposit')         envAsset[k] = (envAsset[k] || 0) + net;
      else if (t.type === 'withdrawal') envAsset[k] = (envAsset[k] || 0) - (t.amount ?? t.net_amount ?? 0);
    });
    const depTotal = Object.values(envAsset).reduce((s, v) => s + Math.max(0, v), 0);

    if (lastCal) {
      const calBreakdown = [...cals].reverse().find(c => c.asset_breakdown && c.asset_breakdown.length > 0);
      if (calBreakdown) {
        // Niveau 2 : valeurs réelles par actif
        calBreakdown.asset_breakdown.forEach(item => { if (item.value > 0) add(item.asset_type, item.value); });
      } else if (depTotal > 0) {
        // Niveau 1 : total réparti au prorata des versements par actif
        Object.entries(envAsset).forEach(([k, v]) => { if (v > 0) add(k, lastCal.total_value * (v / depTotal)); });
      } else {
        add('non_defini', lastCal.total_value);
      }
    } else {
      // Non calibrée : soldes des versements
      Object.entries(envAsset).forEach(([k, v]) => { if (v > 0) add(k, v); });
    }
  });

  return totals;
}

// Obtenir l'historique par type d'actif
function getAllAssetsHistory(includeRegulated = true, useRealValue = false) {
  let { transactions } = getData();
  if (!includeRegulated) {
    const regIds = new Set((getData().portfolios || []).filter(p => p.type === 'compte_réglementé').map(p => p.id));
    transactions = transactions.filter(t => !regIds.has(t.portfolio_id));
  }
  if (transactions.length === 0) return { data: [], series: [] };
  
  // Trouver la plage de mois
  const allTxDates = transactions.map(t => t.date.substring(0, 7));
  const minMonth = allTxDates.reduce((a, b) => a < b ? a : b);
  const today = new Date().toISOString().substring(0, 7);
  
  // Générer tous les mois
  const sortedMonths = [];
  let [year, month] = minMonth.split('-').map(Number);
  const [endYear, endMonth] = today.split('-').map(Number);
  
  while (year < endYear || (year === endYear && month <= endMonth)) {
    sortedMonths.push(`${year}-${String(month).padStart(2, '0')}`);
    month++;
    if (month > 12) { month = 1; year++; }
  }
  
  if (sortedMonths.length === 0) return { data: [], series: [] };
  
  // Calculer les valeurs cumulées par type d'actif (y compris types personnalisés)
  const allAssetTypes = [...new Set([...ASSET_TYPES, 'non_defini', ...transactions.map(t => resolveAssetType(t))])];
  let series;

  if (useRealValue) {
    // Mode « Valeur réelle » : par mois, on répartit la valeur calibrée de CHAQUE
    // enveloppe sur ses actifs au prorata des versements (même logique que le
    // camembert « répartition des actifs »), puis on agrège par type d'actif.
    // → le total par mois colle aux valeurs réelles des enveloppes.
    const portfolios = getPortfolios().filter(p => includeRegulated || p.type !== 'compte_réglementé');
    const assetValues = {}; // assetType -> { month -> valeur réelle }

    portfolios.forEach(p => {
      const pTxns = transactions
        .filter(t => t.portfolio_id === p.id && !_isCalibrationTx(t))
        .sort((a, b) => a.date.localeCompare(b.date));
      const realByMonth = {};
      getPortfolioRealHistory(p.id).forEach(pt => { realByMonth[pt.month] = pt.realValue; });

      const assetBal = {}; // solde cumulé des versements par actif (enveloppe)
      sortedMonths.forEach(monthKey => {
        pTxns.filter(t => t.date.substring(0, 7) === monthKey).forEach(t => {
          const a = resolveAssetType(t);
          if (t.type === 'deposit') {
            assetBal[a] = (assetBal[a] || 0) + (t.new_funds_amount != null ? t.new_funds_amount : (t.net_amount || t.amount));
          } else if (!t.keep_in_cash) {
            assetBal[a] = (assetBal[a] || 0) - (t.net_amount || t.amount);
          }
        });
        const balTotal = Object.values(assetBal).reduce((s, v) => s + Math.max(0, v), 0);
        const rv = realByMonth[monthKey];
        // Avant la 1ère calibration (rv null) : on garde le solde des versements.
        const scale = (rv != null && balTotal > 0) ? rv / balTotal : 1;
        Object.entries(assetBal).forEach(([a, v]) => {
          if (v > 0) {
            if (!assetValues[a]) assetValues[a] = {};
            assetValues[a][monthKey] = (assetValues[a][monthKey] || 0) + v * scale;
          }
        });
      });
    });

    series = Object.keys(assetValues).map(assetType => ({
      name: assetType,
      id: assetType,
      values: Object.fromEntries(
        Object.entries(assetValues[assetType]).map(([m, v]) => [m, Math.round(v * 100) / 100])
      ),
    }));
  } else {
    series = allAssetTypes.map(assetType => {
      const aTxns = transactions
        .filter(t => resolveAssetType(t) === assetType)
        .sort((a, b) => a.date.localeCompare(b.date));

      let totalValue = 0;
      const values = {};

      sortedMonths.forEach(monthKey => {
        const monthTxns = aTxns.filter(t => t.date.substring(0, 7) === monthKey);

        monthTxns.forEach(t => {
          if (t.type === 'deposit') {
            totalValue += (t.new_funds_amount != null ? t.new_funds_amount : (t.net_amount || t.amount));
          } else if (t.type === 'withdrawal' && !t.keep_in_cash) {
            totalValue -= t.net_amount || t.amount;
          }
        });

        if (totalValue < 0) totalValue = 0;
        values[monthKey] = Math.round(totalValue * 100) / 100;
      });

      return { name: assetType, id: assetType, values };
    });
  }

  const data = sortedMonths.map(month => {
    const point = { month };
    let total = 0;
    series.forEach(s => {
      point[s.id] = s.values[month] || 0;
      total += s.values[month] || 0;
    });
    point.total = Math.round(total * 100) / 100;
    return point;
  });
  
  // Ne garder que les séries qui ont des données
  const filteredSeries = series.filter(s => Object.values(s.values).some(v => v > 0));
  
  return { data, series: filteredSeries.map(s => ({ name: s.name, id: s.id })) };
}

// ============ GLOBAL PORTFOLIO YIELD (§4) ============

/**
 * Calcule le rendement global du portefeuille en utilisant les dernières calibrations.
 * Retourne null si aucune calibration n'existe.
 *
 * @param {Array} [portfolioList] — liste optionnelle de portefeuilles à inclure.
 *   Si absent, utilise tous les portefeuilles. Permet d'exclure les comptes
 *   réglementés du calcul de performance (healthScoreService).
 */
function computeGlobalYield(portfolioList) {
  const portfolios = portfolioList || getPortfolios();
  const today = new Date().toISOString().split('T')[0];
  // totalPortfolioValue: calibrated value if calibration exists, else net deposits (balance proxy)
  let totalPortfolioValue = 0;
  let totalInvested = 0;
  let hasCalibration = false;
  let incWSum = 0, incWRet = 0; // « depuis l'origine » (Dietz annualisé) pondéré par la valeur actuelle

  portfolios.forEach(p => {
    const pCals = (_currentData.calibrations || []).filter(c => c.portfolio_id === p.id).sort((a, b) => a.date.localeCompare(b.date));
    const txns  = (_currentData.transactions || []).filter(t => t.portfolio_id === p.id);
    // Argent EXTERNE net réellement investi (hors recyclage interne des espèces) :
    // somme des flux externes (versements + / retraits externes −).
    const netDeposits = _envelopeFlows(txns.filter(t => !_isCalibrationTx(t))).reduce((s, f) => s + f.amount, 0);
    totalInvested += netDeposits;

    if (pCals.length === 0) {
      // No calibration — use net deposits as proxy for current value
      totalPortfolioValue += netDeposits;
    } else {
      hasCalibration = true;
      const firstCal = pCals[0];
      const lastCal  = pCals[pCals.length - 1];
      totalPortfolioValue += lastCal.total_value;
      // « Depuis l'origine » : Dietz modifiée annualisée sur base COÛT (ancrée au
      // 1er versement, pas à la 1ère calibration — évite la perte fantôme quand la
      // 1ère calibration surestime le capital réellement versé à sa date), pondérée
      // par la valeur actuelle (livrets exclus). Cohérent avec computeRealYield.
      if (p.type !== 'compte_réglementé') {
        const flows     = _envelopeFlows(txns.filter(t => !_isCalibrationTx(t)));
        const lifeFlows = flows.filter(f => f.date <= lastCal.date);
        let ann = null;
        if (lifeFlows.length > 0) {
          const anchor = new Date(new Date(lifeFlows[0].date).getTime() - 86400000).toISOString().split('T')[0];
          const years  = _daysBetween(anchor, lastCal.date) / 365.25;
          const raw    = modifiedDietz(0, lastCal.total_value, lifeFlows, anchor, lastCal.date);
          if (raw != null && years > 0) { const b = 1 + raw; ann = b > 0 ? Math.pow(b, 1 / years) - 1 : raw / years; }
        } else if (firstCal.total_value > 0) {
          const end   = today > firstCal.date ? today : lastCal.date;
          const years = _daysBetween(firstCal.date, end) / 365.25;
          const raw   = modifiedDietz(firstCal.total_value, lastCal.total_value, flows, firstCal.date, end);
          if (raw != null && years > 0) { const b = 1 + raw; ann = b > 0 ? Math.pow(b, 1 / years) - 1 : raw / years; }
        }
        if (ann != null) {
          const w = Math.max(0, lastCal.total_value);
          incWSum += w; incWRet += ann * w;
        }
      }
    }
  });

  if (!hasCalibration) return null;
  if (totalInvested === 0) return null;

  // « Depuis l'origine » annualisé (Dietz modifiée), pondéré par la valeur actuelle.
  const xirrPct = incWSum > 0 ? Math.round((incWRet / incWSum) * 10000) / 100 : null;

  const totalGain = totalPortfolioValue - totalInvested;
  return {
    totalGain:            Math.round(totalGain            * 100) / 100,
    totalInvested:        Math.round(totalInvested        * 100) / 100,
    totalPortfolioValue:  Math.round(totalPortfolioValue  * 100) / 100,
    // rétro-compat alias
    totalCalibratedValue: Math.round(totalPortfolioValue  * 100) / 100,
    yieldPct:             Math.round(totalGain / totalInvested * 10000) / 100,
    xirrPct, // « depuis l'origine » annualisé (Dietz modifiée — nom de champ conservé)
  };
}

// ============ PARAMÈTRES FIRE GLOBAUX (source unique de vérité) ============

/**
 * Paramètres FIRE partagés entre le simulateur et la page Trophées.
 * @returns {{ monthly_need:number, withdrawal_rate:number }}
 */
function getFireSettings() {
  const fs = getData().fire_settings || {};
  const mn = parseFloat(fs.monthly_need);
  const wr = parseFloat(fs.withdrawal_rate);
  return {
    monthly_need:    Number.isFinite(mn) && mn > 0 ? mn : 2500,
    withdrawal_rate: Number.isFinite(wr) && wr > 0 ? wr : 4,
  };
}

/**
 * Met à jour les paramètres FIRE globaux et persiste.
 * @param {{ monthly_need?:number|string, withdrawal_rate?:number|string }} patch
 * @returns {{ monthly_need:number, withdrawal_rate:number }} nouveaux paramètres
 */
function updateFireSettings(patch = {}) {
  const cur = getFireSettings();
  const mn  = parseFloat(patch.monthly_need);
  const wr  = parseFloat(patch.withdrawal_rate);
  const next = {
    monthly_need:    Number.isFinite(mn) && mn > 0 ? mn : cur.monthly_need,
    withdrawal_rate: Number.isFinite(wr) && wr > 0 ? wr : cur.withdrawal_rate,
  };
  _currentData.fire_settings = next;
  saveData();
  return next;
}

/**
 * Progression FIRE basée sur la valeur ACTUELLE du portefeuille (TOUTES les enveloppes,
 * livrets réglementés inclus) et les paramètres FIRE globaux.
 *   Capital nécessaire = (besoins mensuels × 12) / taux de retrait
 *   Capital actuel     = Σ valeur calibrée actuelle de toutes les enveloppes
 *   Progression        = Capital actuel / Capital nécessaire × 100
 * @returns {{ monthly_need, withdrawal_rate, capitalNecessaire, capitalActuel, fireProgress }}
 */
function computeFireProgress() {
  const { monthly_need, withdrawal_rate } = getFireSettings();
  const capitalNecessaire = withdrawal_rate > 0 ? (monthly_need * 12) / (withdrawal_rate / 100) : 0;

  // Somme TOTALE du portefeuille : toutes les enveloppes, y compris les livrets réglementés.
  let capitalActuel = 0;
  getPortfolios()
    .forEach(p => {
      const cals = getCalibrations(p.id);
      const lastVal = cals.length ? cals[cals.length - 1].total_value : (p.balance || 0);
      capitalActuel += Math.max(0, lastVal || 0);
    });
  capitalActuel = Math.round(capitalActuel * 100) / 100;

  const fireProgress = capitalNecessaire > 0
    ? Math.min(100, (capitalActuel / capitalNecessaire) * 100)
    : 0;

  return {
    monthly_need,
    withdrawal_rate,
    capitalNecessaire: Math.round(capitalNecessaire * 100) / 100,
    capitalActuel,
    fireProgress:      Math.round(fireProgress * 100) / 100,
  };
}

// ============ ALL PORTFOLIOS HISTORY WITH CALIBRATION (§6) ============

/**
 * Retourne l'historique enrichi : pour chaque enveloppe, deux séries :
 *   {portfolioId}_dep   = versements cumulés (courbe solide)
 *   {portfolioId}_cal   = valeur calibrée interpolée (courbe pointillée)
 * Et deux séries agrégées :
 *   total_dep   = somme de tous les versements
 *   total_cal   = somme de toutes les valeurs calibrées
 */
function getAllPortfoliosHistoryWithCalibration(includeRegulated = true) {
  // §4 — Les livrets réglementés sont inclus dans le graphique d'évolution quand le
  // réglage de performance est actif (défaut), sinon exclus (comportement d'origine).
  const portfolios = getPortfolios().filter(p => includeRegulated || p.type !== 'compte_réglementé');
  if (portfolios.length === 0) return { data: [], series: [] };

  const { transactions } = getData();
  if (transactions.length === 0) return { data: [], series: [] };

  const allTxDates = transactions.map(t => t.date.substring(0, 7));
  const minMonth   = allTxDates.reduce((a, b) => a < b ? a : b);
  const today      = new Date().toISOString().substring(0, 7);

  const sortedMonths = [];
  let [year, month] = minMonth.split('-').map(Number);
  const [endYear, endMonth] = today.split('-').map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    sortedMonths.push(`${year}-${String(month).padStart(2, '0')}`);
    month++;
    if (month > 12) { month = 1; year++; }
  }
  if (sortedMonths.length === 0) return { data: [], series: [] };

  const seriesInfo = [];

  portfolios.forEach(p => {
    const pTxns = transactions.filter(t => t.portfolio_id === p.id).sort((a, b) => a.date.localeCompare(b.date));

    // Deposits timeline (cumulative)
    let totalDep = 0;  // « Versements nets » (courbe orange) = capital net en place
    let totalAll = 0;  // repli de VALEUR pour enveloppe non calibrée = tous flux nets
    const depValues = {};
    const allFlowValues = {};
    sortedMonths.forEach(mk => {
      const mTxns = pTxns.filter(t => t.date.substring(0, 7) === mk);
      mTxns.forEach(t => {
        const net = t.net_amount || t.amount || 0;
        // Versements cumulés (AFFICHAGE) = capital net en place (nouveaux fonds − retraits
        // réels). Les ventes/rachats espèces (recyclage interne) restent dans l'enveloppe.
        if (t.type === 'deposit')             totalDep += (t.new_funds_amount != null ? t.new_funds_amount : net);
        else if (!t.keep_in_cash)             totalDep -= net;
        // Valeur de repli d'une enveloppe NON calibrée = somme de TOUS les flux nets
        // (identique à computeGlobalYield / la tuile « Valeur totale »).
        totalAll += (t.type === 'deposit' ? net : -net);
      });
      depValues[mk]     = Math.round(totalDep * 100) / 100;
      allFlowValues[mk] = Math.round(totalAll * 100) / 100;
    });

    // Calibrated timeline (from getPortfolioRealHistory)
    const realHistory = getPortfolioRealHistory(p.id);
    const calValues = {};
    realHistory.forEach(pt => { if (pt.realValue != null) calValues[pt.month] = pt.realValue; });

    seriesInfo.push({ id: p.id, name: p.name, depValues, allFlowValues, calValues });
  });

  // Au moins une enveloppe a-t-elle une valeur calibrée ? (sinon la courbe de valeur
  // serait identique aux versements → inutile de l'afficher).
  const anyCalibration = seriesInfo.some(s => Object.keys(s.calValues).length > 0);

  const data = sortedMonths.map(mk => {
    const point = { month: mk };
    let totalDep = 0;
    let totalCal = 0;

    seriesInfo.forEach(s => {
      const dep = s.depValues[mk] || 0;
      point[`${s.id}_dep`] = dep;
      totalDep += dep;

      // Valeur réelle de l'enveloppe = valeur calibrée si disponible, sinon repli sur
      // la somme de TOUS les flux nets (enveloppe non calibrée valorisée EXACTEMENT
      // comme la tuile « Valeur totale » — computeGlobalYield). La courbe de valeur
      // inclut donc toutes les enveloppes ET colle au total affiché.
      const calV = s.calValues[mk];
      const value = calV != null ? calV : (s.allFlowValues[mk] ?? 0);
      point[`${s.id}_cal`] = value;
      totalCal += value;
    });

    point.total_dep = Math.round(totalDep * 100) / 100;
    point.total_cal = anyCalibration ? Math.round(totalCal * 100) / 100 : null;
    return point;
  });

  return {
    data,
    series: seriesInfo.map(s => ({ name: s.name, id: s.id })),
    hasCalibration: anyCalibration,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MÉTHODE DE DIETZ MODIFIÉE — socle UNIQUE de tous les calculs de rendement
// (même méthode que Yomoni). Net de frais : les flux utilisent net_amount.
// ─────────────────────────────────────────────────────────────────────────────

/** Nombre de jours (réels) entre deux dates 'YYYY-MM-DD'. */
function _daysBetween(d0, d1) {
  return (new Date(d1).getTime() - new Date(d0).getTime()) / (24 * 3600 * 1000);
}

/**
 * Flux d'une enveloppe pour Dietz — mesure le rendement des ACTIFS investis.
 *   • ACHAT (dépôt)  → +net : capital déployé dans les actifs.
 *   • VENTE (retrait) → −net : capital retiré des actifs — Y COMPRIS une vente
 *     « conservée en espèces » : les espèces ne sont PLUS investies, la vente est
 *     donc un RETRAIT (et non une moins-value). Un rachat ultérieur depuis les
 *     espèces est un nouvel achat (+), qui redéploie le capital.
 * La valeur calibrée ne mesure que les actifs → les espèces sortent naturellement
 * du calcul de rendement et de PNL.
 */
function _envelopeFlows(txns) {
  const getV = t => t.net_amount ?? t.amount ?? 0;
  return (txns || [])
    .filter(t => t.type === 'deposit' || t.type === 'withdrawal')
    .map(t => ({ date: t.date, amount: t.type === 'deposit' ? getV(t) : -getV(t) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Valeur d'une enveloppe à une date : calibration exacte, sinon interpolation
 * linéaire entre les deux calibrations réelles encadrantes. JAMAIS d'extrapolation :
 * null avant la 1ère calibration ; valeur de la dernière calibration tenue à plat après.
 * @param {Array} cals — calibrations triées par date croissante
 */
function _valueOnDate(cals, dateStr) {
  if (!cals || cals.length === 0) return null;
  if (dateStr < cals[0].date) return null;                 // pas d'extrapolation avant
  const last = cals[cals.length - 1];
  if (dateStr >= last.date) return last.total_value;       // tenue à plat après la dernière
  for (let i = 0; i < cals.length; i++) {
    if (cals[i].date === dateStr) return cals[i].total_value;
    if (cals[i].date > dateStr) {
      const before = cals[i - 1], after = cals[i];
      const t0 = new Date(before.date).getTime();
      const t1 = new Date(after.date).getTime();
      const t  = new Date(dateStr).getTime();
      return before.total_value + (after.total_value - before.total_value) * ((t - t0) / (t1 - t0));
    }
  }
  return last.total_value;
}

/**
 * Méthode de Dietz modifiée — rendement de PÉRIODE (non annualisé), net de frais.
 *   T             = jours(periodStart → periodEnd)
 *   netFlows      = Σ flux
 *   gain          = endValue − startValue − netFlows
 *   weightedFlows = Σ flux × (T − jours(start→flux)) / T   (poids début de période)
 *   denominator   = startValue + weightedFlows
 *   rendement     = gain / denominator        (null si denominator ≤ 0)
 * Seuls les flux STRICTEMENT après periodStart et jusqu'à periodEnd comptent
 * (ceux ≤ periodStart sont déjà reflétés dans startValue).
 *
 * @param {number} startValue, endValue
 * @param {Array<{date:string, amount:number}>} flows — amount>0 versement, <0 retrait
 * @param {string} periodStart, periodEnd — 'YYYY-MM-DD'
 * @returns {number|null} rendement de période (0,05 = +5 %) ou null
 */
function modifiedDietz(startValue, endValue, flows, periodStart, periodEnd) {
  const T = _daysBetween(periodStart, periodEnd);
  if (!(T > 0)) return null;
  const inFlows  = (flows || []).filter(f => f.date > periodStart && f.date <= periodEnd);
  const netFlows = inFlows.reduce((s, f) => s + f.amount, 0);
  const gain     = endValue - startValue - netFlows;
  const weighted = inFlows.reduce((s, f) => s + f.amount * ((T - _daysBetween(periodStart, f.date)) / T), 0);
  const denom    = startValue + weighted;
  if (denom <= 0) return null;
  return gain / denom;
}

/**
 * Moyenne géométrique des rendements annuels (Dietz) — « rendement annuel moyen ».
 *   (Π (1 + r_Y))^(1/N) − 1, N = nb d'années (l'année courante comptée au prorata).
 * @param {Array<{ yieldPct:number, ytd?:boolean }>} annual
 * @returns {number|null}
 */
function _geometricMeanAnnual(annual) {
  if (!annual || annual.length === 0) return null;
  const now    = new Date();
  const yStart = new Date(now.getFullYear(), 0, 1).getTime();
  const frac   = Math.min(1, Math.max(1 / 365.25, (now.getTime() - yStart) / (365.25 * 24 * 3600 * 1000)));
  let product = 1, n = 0;
  for (const a of annual) {
    const r = a.yieldPct / 100;
    if (1 + r <= 0) return null;          // perte totale → moyenne géométrique indéfinie
    product *= (1 + r);
    n += a.ytd ? frac : 1;
  }
  if (n <= 0) return null;
  return Math.pow(product, 1 / n) - 1;
}

// ============ CALIBRATION YIELDS PER INTERVAL (§2 tooltip) ============

/**
 * Rendement de chaque intervalle de calibration d'une enveloppe — Dietz modifiée,
 * en % BRUT de la période (non annualisé) + gain absolu en €.
 * @returns {Array<{ month, value, yieldPct:number|null, gainEur:number|null, isAnnualized:boolean }>}
 */
function getPortfolioCalibrationYields(portfolioId) {
  const cals = getCalibrations(portfolioId); // triées par date croissante
  if (cals.length === 0) return [];

  const flows = _envelopeFlows(getTransactions(portfolioId).filter(t => !_isCalibrationTx(t)));

  return cals.map((cal, i) => {
    const month = cal.date.substring(0, 7);
    if (i === 0) return { month, value: cal.total_value, yieldPct: null, gainEur: null, isAnnualized: false };

    const prev = cals[i - 1];
    if (prev.total_value <= 0 || cal.date <= prev.date) {
      return { month, value: cal.total_value, yieldPct: null, gainEur: null, isAnnualized: false };
    }

    const r = modifiedDietz(prev.total_value, cal.total_value, flows, prev.date, cal.date);
    if (r == null) return { month, value: cal.total_value, yieldPct: null, gainEur: null, isAnnualized: false };
    const inInterval = flows.filter(f => f.date > prev.date && f.date <= cal.date).reduce((s, f) => s + f.amount, 0);
    const gainEur = cal.total_value - prev.total_value - inInterval;
    return {
      month,
      value:    cal.total_value,
      yieldPct: Math.round(r * 10000) / 100,
      gainEur:  Math.round(gainEur * 100) / 100,
      isAnnualized: false,
    };
  });
}

// ============ TEMPLATE POSITIONS FOR CALIBRATION LEVEL 2 (§9) ============

/**
 * Retourne les positions (mouvements types) d'une enveloppe avec leurs quantités cumulées.
 */
function getPortfolioTemplatePositions(portfolioId) {
  const templates = getMovementTemplates(portfolioId);
  const txns = (_currentData.transactions || []).filter(t => t.portfolio_id === portfolioId);

  return templates.map(tpl => {
    const tplTxns = txns.filter(t => t.template_id === tpl.id);
    const totalQty = tplTxns
      .filter(t => t.type === 'deposit' && t.quantity != null)
      .reduce((s, t) => s + (t.quantity || 0), 0)
      - tplTxns
        .filter(t => t.type === 'withdrawal' && t.quantity != null)
        .reduce((s, t) => s + (t.quantity || 0), 0);

    const totalInvested = tplTxns
      .filter(t => t.type === 'deposit')
      .reduce((s, t) => s + (t.net_amount || t.amount || 0), 0);

    return {
      template_id: tpl.id,
      name:         tpl.name,
      asset_type:   tpl.asset_type,
      total_quantity: Math.max(0, totalQty),
      total_invested: Math.round(totalInvested * 100) / 100,
    };
  });
}

// ============ CALIBRATIONS ============

/**
 * Retourne toutes les calibrations d'une enveloppe, triées par date croissante.
 * Si aucun portfolioId, retourne toutes les calibrations.
 */
function getCalibrations(portfolioId) {
  const cals = _currentData.calibrations || [];
  const filtered = portfolioId ? cals.filter(c => c.portfolio_id === portfolioId) : cals;
  return [...filtered].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Ajoute une calibration (append-only).
 * @param {{
 *   portfolio_id: string,
 *   date: string,           // 'YYYY-MM-DD'
 *   total_value: number,
 *   asset_breakdown: Array<{ asset_type: string, value: number }> | null
 * }} cal
 */
function addCalibration(cal) {
  if (!_currentData.calibrations) _currentData.calibrations = [];

  // Garde-fou métier : une calibration constate une valeur observée, elle ne peut
  // donc pas être datée dans le futur. L'UI borne déjà les champs de saisie ;
  // ce contrôle protège les autres points d'entrée (import, adaptateur simulation).
  const _todayStr = new Date().toISOString().split('T')[0];
  if (cal.date && cal.date > _todayStr) {
    throw new Error('Une calibration ne peut pas être datée dans le futur.');
  }

  const entry = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `cal_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    portfolio_id: cal.portfolio_id,
    date: cal.date,
    total_value: cal.total_value,
    asset_breakdown: cal.asset_breakdown || null,
    created_at: new Date().toISOString(),
  };
  _currentData.calibrations.push(entry);
  saveData();
  addLog(`CALIBRATION_ADDED: portfolio ${cal.portfolio_id} au ${cal.date}`);

  // Gamification — première calibration (flag unique) + calibration mensuelle
  gamificationService.onFirstTimeAction('envelopeCalibration', 50, 'first_calibration');
  gamificationService.handleMonthlyCalibration();
  // Q10 — flag dédié pour la quête "Calibrer une enveloppe"
  try { _getQuestService()?.trackFlag('envelopeCalibrated'); } catch (_) {}

  return entry;
}

/**
 * Supprime une calibration par id.
 */
function deleteCalibration(id) {
  if (!_currentData.calibrations) return;
  _currentData.calibrations = _currentData.calibrations.filter(c => c.id !== id);
  saveData();
}

/**
 * Retourne true si l'une des enveloppes a besoin d'une calibration :
 * - Jamais calibrée, ou dernière calibration > 30 jours
 * Si portfolioId fourni, vérifie uniquement cette enveloppe.
 */
function needsCalibration(portfolioId) {
  const portfolios = portfolioId
    ? [getPortfolio(portfolioId)].filter(Boolean)
    : getPortfolios();

  const now = Date.now();
  const MS_30D = 30 * 24 * 3600 * 1000;

  for (const p of portfolios) {
    const cals = getCalibrations(p.id);
    if (cals.length === 0) return true;
    const last = cals[cals.length - 1];
    if (now - new Date(last.date).getTime() > MS_30D) return true;
  }
  return false;
}

/**
 * Calcule deux rendements annualisés réels pour une enveloppe (Modified Dietz simplifiée).
 *
 * A) lastIntervalYield — entre les deux DERNIÈRES calibrations (performance récente).
 * B) inceptionYield   — de la PREMIÈRE à la DERNIÈRE calibration (performance globale, plus stable).
 *
 * Fix 3 : priorité de champ uniforme — net_amount ?? amount pour dépôts ET retraits.
 * Fix 4 : expose les deux métriques au lieu de la seule dernière période.
 *
 * @returns {{
 *   annualizedYield:   number,        // alias de lastIntervalYield (rétro-compatibilité)
 *   lastIntervalYield: number,
 *   inceptionYield:    number | null, // null si une seule calibration (impossible d'annualiser)
 *   startDate: string, endDate: string,
 *   startValue: number, endValue: number,
 *   netDeposits: number, periodYears: number,
 * } | null}
 */
function computeRealYield(portfolioId) {
  const cals = getCalibrations(portfolioId); // triées par date croissante
  if (cals.length < 2) return null;
  if (cals[0].total_value <= 0) return null;

  const flows    = _envelopeFlows(getTransactions(portfolioId).filter(t => !_isCalibrationTx(t)));
  const firstCal = cals[0];
  const lastCal  = cals[cals.length - 1];
  const cal1     = cals[cals.length - 2]; // avant-dernière calibration (dernier intervalle)
  const cal2     = lastCal;
  const today    = new Date().toISOString().split('T')[0];

  // ── Dernière période : Dietz modifiée BRUTE du dernier intervalle ──────────
  let lastIntervalYield = null;
  if (cal1.total_value > 0 && cal2.date > cal1.date) {
    const r = modifiedDietz(cal1.total_value, cal2.total_value, flows, cal1.date, cal2.date);
    if (r != null) lastIntervalYield = r * 100;
  }

  // ── Depuis l'origine : Dietz modifiée sur la VIE ENTIÈRE, annualisée ──────────
  // Ancrée au 1er VERSEMENT (capital investi : 0 → valeur finale), et NON à la 1ère
  // calibration. Motif : si la 1ère calibration reflète un capital supérieur aux
  // versements déjà enregistrés à sa date (ex. valeur d'ouverture saisie, ou
  // versements datés plus tard), l'ancrer produirait une PERTE FANTÔME — les
  // versements postérieurs seraient soustraits d'une valeur de départ qui les
  // contient déjà. Sur base coût, le signe est toujours cohérent avec le PNL.
  let inceptionYield = null;
  const lifeFlows = flows.filter(f => f.date <= lastCal.date);
  if (lifeFlows.length > 0 && lastCal.total_value != null) {
    const originAnchor = new Date(new Date(lifeFlows[0].date).getTime() - 86400000).toISOString().split('T')[0];
    const yearsLife    = _daysBetween(originAnchor, lastCal.date) / 365.25;
    const rawLife      = modifiedDietz(0, lastCal.total_value, lifeFlows, originAnchor, lastCal.date);
    if (rawLife != null && yearsLife > 0) {
      const b = 1 + rawLife;
      inceptionYield = (b > 0 ? Math.pow(b, 1 / yearsLife) - 1 : rawLife / yearsLife) * 100;
    }
  } else {
    // Repli (aucune transaction) : Dietz calibration-à-calibration classique.
    const endDate = today > firstCal.date ? today : lastCal.date;
    const years   = _daysBetween(firstCal.date, endDate) / 365.25;
    const raw     = modifiedDietz(firstCal.total_value, lastCal.total_value, flows, firstCal.date, endDate);
    if (raw != null && years > 0) {
      const b = 1 + raw;
      inceptionYield = (b > 0 ? Math.pow(b, 1 / years) - 1 : raw / years) * 100;
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    console.debug('[Rendement] Dietz modifiée (base coût)', portfolioId, {
      depuisOrigine: {
        origin: lifeFlows[0]?.date ?? firstCal.date,
        endValue: lastCal.total_value, endDate: lastCal.date,
        costBasis: Math.round(lifeFlows.reduce((s, f) => s + f.amount, 0) * 100) / 100,
        annualisedPct: inceptionYield != null ? Math.round(inceptionYield * 100) / 100 : null,
      },
      dernierIntervallePct: lastIntervalYield != null ? Math.round(lastIntervalYield * 100) / 100 : null,
    });
  }

  if (inceptionYield == null && lastIntervalYield == null) return null;

  const lastNet = flows.filter(f => f.date > cal1.date && f.date <= cal2.date).reduce((s, f) => s + f.amount, 0);
  return {
    annualizedYield:   lastIntervalYield != null ? Math.round(lastIntervalYield * 100) / 100 : null, // rétro-compat
    lastIntervalYield: lastIntervalYield != null ? Math.round(lastIntervalYield * 100) / 100 : null,  // % BRUT de l'intervalle
    inceptionYield:    inceptionYield != null ? Math.round(inceptionYield * 100) / 100 : null,        // %/an annualisé
    startDate:   cal1.date,
    endDate:     cal2.date,
    startValue:  cal1.total_value,
    endValue:    cal2.total_value,
    netDeposits: Math.round(lastNet * 100) / 100,
    periodYears: Math.round((_daysBetween(cal1.date, cal2.date) / 365.25) * 100) / 100,
  };
}

/**
 * « Rendement annuel moyen » d'une enveloppe = moyenne GÉOMÉTRIQUE de ses
 * rendements annuels (Dietz). Cohérent par construction avec les barres de
 * l'histogramme (c'est leur chaînage géométrique).
 *   (Π (1 + r_Y))^(1/N) − 1, N = nb d'années (année courante comptée au prorata).
 * @returns {{ cagrPct:number, years:number, currentValue:number } | null}
 */
function computeEnvelopeCAGR(portfolioId) {
  const annual = computeAnnualYields(portfolioId);
  if (!annual || annual.length === 0) return null;
  const g = _geometricMeanAnnual(annual);
  if (g == null) return null;
  const cals = getCalibrations(portfolioId);

  if (process.env.NODE_ENV !== 'production') {
    console.debug('[Dietz] rendement annuel moyen (moyenne géométrique)', portfolioId, {
      annees:         annual.map(a => ({ an: a.year, pct: a.yieldPct, gainEur: a.gainEur, ytd: a.ytd })),
      moyenneGeomPct: Math.round(g * 10000) / 100,
    });
  }

  return {
    cagrPct:      Math.round(g * 10000) / 100,
    years:        annual.length,
    currentValue: cals.length ? cals[cals.length - 1].total_value : 0,
  };
}

/**
 * Rendement annuel moyen du PORTEFEUILLE = moyenne géométrique des rendements
 * annuels agrégés (Dietz, livrets réglementés exclus). Cohérent avec l'histogramme
 * global du tableau de bord.
 * @returns {{ weightedCAGRPct:number, count:number } | null}
 */
function computeWeightedCAGR() {
  const annual = computeAnnualYields(null);
  if (!annual || annual.length === 0) return null;
  const g = _geometricMeanAnnual(annual);
  if (g == null) return null;
  const count = getPortfolios().filter(p => p.type !== 'compte_réglementé' && getCalibrations(p.id).length >= 2).length;
  return {
    weightedCAGRPct: Math.round(g * 10000) / 100,
    count,
  };
}

/**
 * Ancre de fin d'année : la calibration RÉELLE la plus proche du 31 décembre de Y,
 * recherchée dans [1er août Y .. 31 mai Y+1] (≈ ±5 mois) et jamais future.
 * Les fenêtres de recherche de deux années consécutives sont disjointes → chaque
 * calibration ne peut ancrer qu'une seule fin d'année.
 * @returns {object|null}
 */
function _yearEndAnchor(cals, Y, todayStr) {
  const lo = `${Y}-08-01`, hi = `${Y + 1}-05-31`, dec31 = `${Y}-12-31`;
  const cands = (cals || []).filter(c => c.date >= lo && c.date <= hi && c.date <= todayStr);
  if (!cands.length) return null;
  return cands.reduce((best, c) =>
    Math.abs(_daysBetween(dec31, c.date)) < Math.abs(_daysBetween(dec31, best.date)) ? c : best);
}

/**
 * Fenêtre « intervalle réel le plus proche » bornant l'année Y — ou null si impossible.
 * Stratégie (aucune valeur interpolée) : l'année Y est mesurée entre la calibration de
 * clôture de l'année PRÉCÉDENTE (= son ouverture) et sa propre calibration de clôture,
 * chacune étant la calibration réelle la plus proche du 31 décembre correspondant.
 * La durée de fenêtre est bornée à [~5 .. ~16,5 mois] : on écarte ainsi les fenêtres
 * trop courtes (collision) ET les calibrations trop clairsemées (fenêtre trop longue →
 * cas type « deux calibrations à 2,5 ans d'écart »). Fonctionne quelle que soit la
 * cadence de calibration (fin d'année, milieu d'année annuel, mensuel, trimestriel…).
 * Cas particulier de la PREMIÈRE année calibrée : il n'existe pas de clôture pour
 * l'année précédente (l'utilisateur n'a pas de valeur avant sa 1ère calibration).
 * On utilise alors la 1ère calibration de l'année Y comme ouverture (barre partielle),
 * afin d'afficher malgré tout le rendement mesuré sur la partie suivie de l'année.
 * `partial=true` si la fenêtre couvre nettement moins d'un an (année en cours, 1ère
 * année, etc.).
 * @returns {{ opening, closing, partial } | null}
 */
function _yearRealWindow(cals, Y, todayStr) {
  const closing = _yearEndAnchor(cals, Y, todayStr);
  if (!closing) return null;
  let opening = _yearEndAnchor(cals, Y - 1, todayStr); // clôture de Y-1 = ouverture de Y
  let firstYearProxy = false;
  if (!opening) {
    // Aucune clôture pour Y-1 : 1ère année calibrée → 1ère calibration de Y avant la clôture.
    const within = cals.filter(c => c.date >= `${Y}-01-01` && c.date < closing.date);
    if (!within.length) return null;
    opening = within[0];
    firstYearProxy = true;
  }
  if (closing.date <= opening.date) return null;
  const days = _daysBetween(opening.date, closing.date);
  // Plancher abaissé à ~3 mois pour autoriser un intervalle intra-annuel (1ère année),
  // plafond ~16,5 mois pour écarter les calibrations trop clairsemées.
  if (days < 90 || days > 500) return null;
  return { opening, closing, partial: firstYearProxy || days < 305 };
}

/**
 * Rendement annuel (par année civile) — Dietz modifiée de PÉRIODE (non annualisée),
 * calculée UNIQUEMENT entre calibrations RÉELLES bornant l'année (jamais sur des
 * valeurs interpolées : voir `_yearRealWindow`). Une année sans calibration réelle
 * proche de ses bornes n'a AUCUNE barre (au lieu d'une barre fantôme interpolée).
 *   • enveloppe : Dietz entre la calibration d'ouverture et de clôture de l'année.
 *   • portefeuille (portfolioId = null) : pondéré par la valeur d'ouverture de chaque
 *     enveloppe (livrets réglementés exclus).
 * Fournit aussi le gain absolu de la période en € (gainEur = endValue − startValue − fluxNets).
 *
 * @param {string|null} portfolioId — enveloppe ciblée, ou null = total (hors réglementés)
 * @returns {Array<{ year:number, yieldPct:number, gainEur:number, ytd:boolean }>}
 */
function computeAnnualYields(portfolioId) {
  const allPf = getPortfolios();
  const scope = portfolioId
    ? allPf.filter(p => p.id === portfolioId)
    : allPf.filter(p => p.type !== 'compte_réglementé');
  if (scope.length === 0) return [];

  // Au moins DEUX calibrations réelles sont nécessaires pour borner une année.
  const data = scope.map(p => ({
    cals:  getCalibrations(p.id),
    flows: _envelopeFlows(getTransactions(p.id).filter(t => !_isCalibrationTx(t))),
  })).filter(d => d.cals.length >= 2);
  if (data.length === 0) return [];

  const minYear  = parseInt(data.flatMap(d => d.cals.map(c => c.date)).reduce((a, b) => (a < b ? a : b)).slice(0, 4), 10);
  const maxYear  = new Date().getFullYear();
  const todayStr = new Date().toISOString().split('T')[0];

  const results = [];
  for (let Y = minYear; Y <= maxYear; Y++) {
    let denomSum = 0, gainSum = 0, contributors = 0;
    for (const d of data) {
      const win = _yearRealWindow(d.cals, Y, todayStr);
      if (!win) continue; // pas de bornes réelles proches de l'année → pas de barre
      const startValue = win.opening.total_value;
      const endValue   = win.closing.total_value;
      if (!(startValue > 0)) continue;
      const T = _daysBetween(win.opening.date, win.closing.date);
      if (!(T > 0)) continue;
      const inFlows  = d.flows.filter(f => f.date > win.opening.date && f.date <= win.closing.date);
      const netFlows = inFlows.reduce((s, f) => s + f.amount, 0);
      const weighted = inFlows.reduce((s, f) => s + f.amount * ((T - _daysBetween(win.opening.date, f.date)) / T), 0);
      const denom    = startValue + weighted;   // capital moyen réellement au travail (Dietz)
      if (denom <= 0) continue;
      // Rendement annuel du PORTEFEUILLE = Dietz modifiée AGRÉGÉE (money-weighted) :
      // Σ gains / Σ dénominateurs. Chaque enveloppe est pondérée par le capital
      // réellement investi sur la fenêtre (versements de milieu d'année inclus), et
      // NON par sa seule valeur d'ouverture — sinon une enveloppe ouverte petite mais
      // fortement abondée puis en perte serait sous-pondérée et le % contredirait le
      // gain € (signe opposé). Pour une seule enveloppe, Σgain/Σdenom = la Dietz simple.
      gainSum  += (endValue - startValue - netFlows);
      denomSum += denom;
      contributors++;
    }
    if (contributors === 0 || denomSum <= 0) continue;
    results.push({
      year:     Y,
      yieldPct: Math.round((gainSum / denomSum) * 10000) / 100,
      gainEur:  Math.round(gainSum * 100) / 100,
      // « YTD / année en cours » = uniquement l'année civile en cours (rendement à date).
      // Sert aussi à pondérer cette année au prorata dans la moyenne géométrique.
      ytd:      Y === maxYear,
    });
  }
  return results;
}

/**
 * Retourne l'historique d'une enveloppe enrichi d'une courbe réelle (`realValue`)
 * construite par interpolation linéaire entre les points de calibration.
 * Les points antérieurs à la 1ère calibration ont realValue = null.
 *
 * @returns {Array<{ month: string, deposits: number, value: number, realValue: number|null }>}
 */
function getPortfolioRealHistory(portfolioId) {
  const base = getPortfolioHistory(portfolioId);
  if (!base.length) return base;

  const cals = getCalibrations(portfolioId);
  if (!cals.length) {
    return base.map(p => ({ ...p, realValue: null }));
  }

  // Index calibrations by month key (YYYY-MM)
  const calByMonth = {};
  cals.forEach(c => {
    const key = c.date.substring(0, 7);
    // Keep latest calibration for that month
    if (!calByMonth[key] || c.date > calByMonth[key].date) {
      calByMonth[key] = c;
    }
  });

  const firstCalMonth = cals[0].date.substring(0, 7);

  return base.map((point, idx) => {
    if (point.month < firstCalMonth) return { ...point, realValue: null };

    // Exact calibration point?
    if (calByMonth[point.month]) {
      return { ...point, realValue: calByMonth[point.month].total_value };
    }

    // Find surrounding calibration months for interpolation
    const monthsBefore = Object.keys(calByMonth).filter(m => m <= point.month).sort();
    const monthsAfter  = Object.keys(calByMonth).filter(m => m >  point.month).sort();

    if (!monthsBefore.length) return { ...point, realValue: null };

    const prevKey = monthsBefore[monthsBefore.length - 1];
    const prevCal = calByMonth[prevKey];

    if (!monthsAfter.length) {
      // After the last calibration: flat (no extrapolation)
      return { ...point, realValue: prevCal.total_value };
    }

    const nextKey = monthsAfter[0];
    const nextCal = calByMonth[nextKey];

    // Linear interpolation on month index
    const totalMonths = base.findIndex(p => p.month === nextKey) - base.findIndex(p => p.month === prevKey);
    const elapsed     = idx - base.findIndex(p => p.month === prevKey);
    const t = totalMonths > 0 ? elapsed / totalMonths : 0;
    const realValue = prevCal.total_value + t * (nextCal.total_value - prevCal.total_value);

    return { ...point, realValue: Math.round(realValue * 100) / 100 };
  });
}

/**
 * Valeur calibrée (interpolée) d'une enveloppe à une date donnée — sans extrapolation :
 * null avant la 1ère calibration, dernière valeur tenue à plat après la dernière.
 * Utilisé notamment par la page « Règle 8-4-3 » (lecture seule).
 * @param {string} portfolioId
 * @param {string} dateStr — 'YYYY-MM-DD'
 * @returns {number|null}
 */
function getPortfolioValueOnDate(portfolioId, dateStr) {
  return _valueOnDate(getCalibrations(portfolioId), dateStr);
}

/**
 * Retourne les types d'actifs réellement utilisés dans les transactions d'une enveloppe.
 * @returns {string[]}
 */
function getPortfolioAssetTypes(portfolioId) {
  const txns = getTransactions(portfolioId);
  const types = new Set();
  txns.forEach(t => {
    const type = resolveAssetType(t);
    if (type) types.add(type);
  });
  return [...types];
}

/**
 * Calcule la PNL par type d'actif pour une enveloppe — §8.
 * Gère trois cas :
 *   A — Mouvements avec quantité + prix unitaire → WAC
 *   B — Mouvements montant seul → money-weighted
 *   C — Mixte (A + B sur le même actif)
 *
 * @returns {Array<{
 *   asset_type:   string,
 *   currentValue: number,
 *   costBasis:    number,
 *   pnl:          number,
 *   pnlPct:       number,
 *   mixed:        boolean,   // true = calcul mixte
 * }>}
 */
function getPortfolioPnlByAsset(portfolioId) {
  // Exclure les transactions de calibration du calcul du coût de revient
  const txns = getTransactions(portfolioId).filter(t => !_isCalibrationTx(t));
  const cals = getCalibrations(portfolioId);

  // Fix 3 — priorité de champ uniforme (net_amount ?? amount) pour dépôts ET retraits
  const getVal = t => t.net_amount ?? t.amount ?? 0;
  // Fix 1 — normalisation du type d'actif pour la comparaison (trim + lowercase)
  const normAt = s => (s || '').trim().toLowerCase();

  // Dernière calibration avec breakdown (Level 2) ou sans (Level 1)
  const calWithBreakdown = [...cals].reverse().find(c => c.asset_breakdown && c.asset_breakdown.length > 0);
  const lastCal = cals.length > 0 ? cals[cals.length - 1] : null;

  if (!lastCal) return [];

  // Niveau 1 uniquement : une seule ligne pour toute l'enveloppe
  if (!calWithBreakdown) {
    // Coût de revient des ACTIFS = tous les achats − toutes les ventes (nettes).
    // Une vente conservée en espèces est un RETRAIT (l'argent n'est plus investi) : elle
    // réduit le capital investi et n'est donc PAS comptée comme une moins-value. Un
    // rachat depuis les espèces est un achat qui redéploie le capital.
    const deps = txns.filter(t => t.type === 'deposit')
      .reduce((s, t) => s + getVal(t), 0);
    const wds  = txns.filter(t => t.type === 'withdrawal')
      .reduce((s, t) => s + getVal(t), 0);
    const invested = deps - wds; // capital net dans les actifs (allow negative)
    // Valeur = actifs calibrés uniquement (les espèces sont déjà sorties via les retraits).
    const pnl    = lastCal.total_value - invested;
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
    return [{
      asset_type:   '_total',
      currentValue: Math.round(lastCal.total_value * 100) / 100,
      costBasis:    Math.round(invested * 100) / 100,
      pnl:          Math.round(pnl * 100) / 100,
      pnlPct:       Math.round(pnlPct * 100) / 100,
      mixed:        false,
    }];
  }

  const refDate  = calWithBreakdown.date;
  const txnsUpTo = txns.filter(t => t.date <= refDate);

  const results = [];

  calWithBreakdown.asset_breakdown.forEach(item => {
    const at           = item.asset_type;
    const currentValue = item.value;

    // Fix 1 — normaliser les deux côtés de la comparaison
    const atNorm  = normAt(at);
    const atTxns  = txnsUpTo.filter(t => normAt(resolveAssetType(t) || 'autre') === atNorm);
    const wacTxns = atTxns.filter(t => t.quantity != null && t.unit_price != null);
    const amtTxns = atTxns.filter(t => t.quantity == null || t.unit_price == null);
    const mixed   = wacTxns.length > 0 && amtTxns.length > 0;

    // Fix 1 — aucune transaction associée : avertissement, pas de PNL fantasmé
    if (atTxns.length === 0) {
      results.push({
        asset_type:   at,
        currentValue: Math.round(currentValue * 100) / 100,
        costBasis:    null,
        pnl:          null,
        pnlPct:       null,
        mixed:        false,
        warning:      "Aucune transaction associée — PNL non calculé",
      });
      return;
    }

    let pnl = 0;
    let costBasis = 0;

    if (wacTxns.length > 0 && amtTxns.length === 0) {
      // Cas A — WAC pur
      let totalQty  = 0;
      let totalCost = 0;
      wacTxns.filter(t => t.type === 'deposit').forEach(t => {
        totalQty  += t.quantity;
        totalCost += t.quantity * t.unit_price + (t.fees_amount || 0);
      });
      wacTxns.filter(t => t.type === 'withdrawal').forEach(t => {
        const wac  = totalQty > 0 ? totalCost / totalQty : 0;
        totalQty  -= t.quantity;
        totalCost -= t.quantity * wac;
      });
      costBasis = totalCost; // may be negative if over-sold (unusual but allowed)
      pnl       = currentValue - costBasis;

    } else if (amtTxns.length > 0 && wacTxns.length === 0) {
      // Cas B — money-weighted pur
      // Fix 2 : inclure les frais dans le coût de base, comme en Cas A
      const deposited = amtTxns.filter(t => t.type === 'deposit')
        .reduce((s, t) => s + getVal(t) + (t.fees_amount || 0), 0);
      const withdrawn = amtTxns.filter(t => t.type === 'withdrawal')
        .reduce((s, t) => s + getVal(t), 0);
      costBasis = deposited - withdrawn; // allow negative (more withdrawn than deposited)
      pnl       = currentValue - costBasis;

    } else if (mixed) {
      // Cas C — mixte
      // Portion WAC
      let wacQty  = 0;
      let wacCost = 0;
      wacTxns.filter(t => t.type === 'deposit').forEach(t => {
        wacQty  += t.quantity;
        wacCost += t.quantity * t.unit_price + (t.fees_amount || 0);
      });
      wacTxns.filter(t => t.type === 'withdrawal').forEach(t => {
        const wac  = wacQty > 0 ? wacCost / wacQty : 0;
        wacQty  -= t.quantity;
        wacCost -= t.quantity * wac;
      });
      const wacInvested = wacCost;

      // Portion montant seul — Fix 2 : frais inclus
      const amtDeposited = amtTxns.filter(t => t.type === 'deposit')
        .reduce((s, t) => s + getVal(t) + (t.fees_amount || 0), 0);
      const amtWithdrawn = amtTxns.filter(t => t.type === 'withdrawal')
        .reduce((s, t) => s + getVal(t), 0);
      const amtInvested = amtDeposited - amtWithdrawn;

      const totalAtInvested = wacInvested + amtInvested;
      const proportion  = totalAtInvested > 0 ? amtInvested / totalAtInvested : 0;
      const amtCalValue = currentValue * proportion;
      const wacCalValue = currentValue * (1 - proportion);

      costBasis = Math.round((wacInvested + amtInvested) * 100) / 100;
      pnl       = (wacCalValue - wacInvested) + (amtCalValue - amtInvested);
    }

    const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
    results.push({
      asset_type:   at,
      currentValue: Math.round(currentValue * 100) / 100,
      costBasis:    Math.round(costBasis    * 100) / 100,
      pnl:          Math.round(pnl          * 100) / 100,
      pnlPct:       Math.round(pnlPct       * 100) / 100,
      mixed,
    });
  });

  return results;
}

// ============ REMINDERS ============

function getReminders() {
  // Copie défensive (cf getCalendarNotes) : empêche le doublon à la création.
  return [...(getData().reminders || [])];
}

function createReminder(data) {
  const reminder = {
    id: Math.random().toString(36).substr(2, 9),
    label: data.label,
    date: data.date,
    recurrence: data.recurrence || 'none',
    dismissed_dates: [],
    type: data.type || 'custom',
    notificationSent: false,
    created_at: new Date().toISOString(),
  };
  const store = getData();
  if (!store.reminders) store.reminders = [];
  store.reminders.push(reminder);
  saveData();
  addLog(`REMINDER_CREATED: ${reminder.label}`);
  return reminder;
}

function updateReminder(id, updates) {
  const store = getData();
  if (!store.reminders) return;
  const idx = store.reminders.findIndex(r => r.id === id);
  if (idx === -1) throw new Error('Rappel introuvable');
  store.reminders[idx] = { ...store.reminders[idx], ...updates };
  saveData();
}

function deleteReminder(id) {
  const store = getData();
  if (!store.reminders) return;
  store.reminders = store.reminders.filter(r => r.id !== id);
  saveData();
  addLog(`REMINDER_DELETED: ${id}`);
}

function dismissReminder(id) {
  const store = getData();
  if (!store.reminders) return;
  const rem = store.reminders.find(r => r.id === id);
  if (!rem) throw new Error('Rappel introuvable');
  if (!rem.dismissed_dates) rem.dismissed_dates = [];
  if (!rem.dismissed_dates.includes(rem.date)) rem.dismissed_dates.push(rem.date);
  // Advance next_date for recurring reminders
  if (rem.recurrence === 'monthly') {
    const d = new Date(rem.date + 'T12:00:00');
    d.setMonth(d.getMonth() + 1);
    rem.date = d.toISOString().split('T')[0];
  } else if (rem.recurrence === 'yearly') {
    const d = new Date(rem.date + 'T12:00:00');
    d.setFullYear(d.getFullYear() + 1);
    rem.date = d.toISOString().split('T')[0];
  }
  saveData();
}

// Synchronise le rappel automatique de calibration mensuelle
function syncCalibrationReminder() {
  const store = getData();
  if (!store.reminders) store.reminders = [];
  const cals = store.calibrations || [];
  let lastCalDate = null;
  if (cals.length > 0) {
    lastCalDate = [...cals].sort((a, b) => b.date.localeCompare(a.date))[0].date;
  }
  const today = new Date();
  // Dates LOCALES : toISOString() ramènerait minuit heure locale à la veille en France.
  const jourLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  let nextDate;
  if (lastCalDate) {
    const lastDay = new Date(lastCalDate + 'T12:00:00').getDate();
    const candidate = new Date(today.getFullYear(), today.getMonth(), lastDay);
    if (candidate <= today) candidate.setMonth(candidate.getMonth() + 1);
    nextDate = jourLocal(candidate);
  } else {
    const candidate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    nextDate = jourLocal(candidate);
  }
  let calRem = store.reminders.find(r => r.type === 'calibration');
  if (!calRem) {
    calRem = { id: 'cal-auto', label: 'Calibration mensuelle', date: nextDate, recurrence: 'monthly', dismissed_dates: [], type: 'calibration', created_at: new Date().toISOString() };
    store.reminders.push(calRem);
    saveData();
  } else if (calRem.date <= today.toISOString().split('T')[0]) {
    calRem.date = nextDate;
    saveData();
  }
  return calRem;
}

// ============ CALENDAR NOTES ============

function getCalendarNotes() {
  // Copie défensive : évite que l'état React partage la référence de
  // _currentData.calendar_notes (sinon createCalendarNote pousse dans le même
  // tableau et l'ajout local devient un doublon).
  return [...(getData().calendar_notes || [])];
}

function getCalendarNotesForDate(date) {
  return getCalendarNotes().filter(n => n.date === date);
}

function createCalendarNote(data) {
  const note = {
    id:         crypto.randomUUID(),
    date:       data.date,
    text:       (data.text || '').slice(0, 500),
    color:      data.color || '#f59e0b',
    created_at: new Date().toISOString(),
  };
  const store = getData();
  if (!store.calendar_notes) store.calendar_notes = [];
  store.calendar_notes.push(note);
  saveData();
  addLog(`CALENDAR_NOTE_CREATED: ${note.date}`);
  return note;
}

function updateCalendarNote(id, updates) {
  const store = getData();
  if (!store.calendar_notes) return;
  const idx = store.calendar_notes.findIndex(n => n.id === id);
  if (idx === -1) throw new Error('Note introuvable');
  store.calendar_notes[idx] = {
    ...store.calendar_notes[idx],
    text:  updates.text  !== undefined ? (updates.text || '').slice(0, 500) : store.calendar_notes[idx].text,
    color: updates.color !== undefined ? updates.color : store.calendar_notes[idx].color,
  };
  saveData();
}

function deleteCalendarNote(id) {
  const store = getData();
  if (!store.calendar_notes) return;
  store.calendar_notes = store.calendar_notes.filter(n => n.id !== id);
  saveData();
  addLog(`CALENDAR_NOTE_DELETED: ${id}`);
}

// ============ BUDGET ENTRIES ============

function getBudgetEntries() {
  // Copie défensive (cf getCalendarNotes) : empêche le doublon à la création.
  return [...(getData().budget_entries || [])];
}

function getBudgetEntriesForMonth(year, month) {
  const prefix     = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthStart = new Date(year, month, 1);
  const monthEnd   = new Date(year, month + 1, 0);
  const out = [];
  for (const e of getBudgetEntries()) {
    const rec = e.recurrence || 'none';
    if (rec === 'none') {
      if (e.date.startsWith(prefix)) out.push(e);
      continue;
    }
    // Entrée récurrente : générer les occurrences tombant dans le mois demandé.
    const start = new Date(e.date + 'T12:00:00');
    if (monthEnd < start) continue; // pas encore commencé
    const pushOcc = (d) => {
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      out.push({ ...e, id: `${e.id}__${ds}`, date: ds, _base_id: e.id, _recurring: true });
    };
    if (rec === 'weekly') {
      const d = new Date(start);
      while (d <= monthEnd) {
        if (d >= monthStart) pushOcc(new Date(d));
        d.setDate(d.getDate() + 7);
      }
    } else {
      const monthsDiff = (year - start.getFullYear()) * 12 + (month - start.getMonth());
      if (monthsDiff < 0) continue;
      const matches = rec === 'monthly'   ? true
        : rec === 'quarterly' ? monthsDiff % 3 === 0
        : rec === 'yearly'    ? monthsDiff % 12 === 0
        : false;
      if (matches) {
        const day = Math.min(start.getDate(), monthEnd.getDate());
        pushOcc(new Date(year, month, day));
      }
    }
  }
  return out;
}

function createBudgetEntry(data) {
  const entry = {
    id: Math.random().toString(36).substr(2, 9),
    date: data.date,
    category: data.category || 'autre',
    custom_label: data.custom_label || null,
    amount: parseFloat(data.amount) || 0,
    // kind : 'expense' (dépense, compte dans le camembert) ou 'income' (apport, augmente la capacité)
    kind: data.kind === 'income' ? 'income' : 'expense',
    // recurrence : 'none' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
    recurrence: data.recurrence || 'none',
    created_at: new Date().toISOString(),
  };
  const store = getData();
  if (!store.budget_entries) store.budget_entries = [];
  store.budget_entries.push(entry);
  saveData();
  addLog(`BUDGET_ENTRY_CREATED: ${entry.category}`);
  return entry;
}

function updateBudgetEntry(id, updates) {
  const store = getData();
  if (!store.budget_entries) return;
  const idx = store.budget_entries.findIndex(e => e.id === id);
  if (idx === -1) throw new Error('Entrée budget introuvable');
  store.budget_entries[idx] = { ...store.budget_entries[idx], ...updates };
  saveData();
}

function deleteBudgetEntry(id) {
  const store = getData();
  if (!store.budget_entries) return;
  store.budget_entries = store.budget_entries.filter(e => e.id !== id);
  saveData();
}

// ============ REGULAR MOVEMENTS ============
// Modèle "Mouvements réguliers" : versements / retraits récurrents programmés.
// Un mouvement régulier ne génère qu'un seul incrément XP (onMovementRecorded),
// quel que soit son nombre d'occurrences futures.

function getRegularMovements() {
  return getData().regular_movements || [];
}

function getRegularMovementsByPortfolio(portfolioId) {
  return getRegularMovements().filter(rm => rm.portfolio_id === portfolioId);
}

function createRegularMovement(data) {
  const rm = {
    id:                      crypto.randomUUID(),
    portfolio_id:            data.portfolio_id,
    type:                    data.type || 'deposit',            // 'deposit' | 'withdrawal'
    amount:                  parseFloat(data.amount) || 0,
    start_date:              data.start_date || new Date().toISOString().split('T')[0],
    recurrence:              data.recurrence || 'monthly',      // 'monthly'|'quarterly'|'semi_annual'|'annual'
    end_date:                data.end_date || null,
    note:                    data.note || null,
    asset_types:             Array.isArray(data.asset_types) ? data.asset_types : [],
    asset_allocations:       Array.isArray(data.asset_allocations) ? data.asset_allocations : [],
    // Frais de transaction appliqués à CHAQUE occurrence (% ou montant fixe €)
    fees_pct:                parseFloat(data.fees_pct) || 0,
    fees_type:               data.fees_type === 'euro' ? 'euro' : 'percent',
    fee_direction:           data.fee_direction === 'added' ? 'added' : 'deducted',
    // Frais annuels de gestion propagés à chaque occurrence (accumulés selon la durée de détention)
    annual_fees_pct:         parseFloat(data.annual_fees_pct) || 0,
    annual_fees_type:        data.annual_fees_type === 'euro' ? 'euro' : 'percent',
    status:                  'active',
    historique_modifications: [],
    created_at:              new Date().toISOString(),
  };
  const store = getData();
  if (!store.regular_movements) store.regular_movements = [];
  store.regular_movements.push(rm);
  saveData();
  addLog(`REGULAR_MOVEMENT_CREATED: ${rm.type} @ ${rm.recurrence}`);
  // Appliquer immédiatement les occurrences passées (start_date <= aujourd'hui)
  try { syncRegularMovements(); } catch (e) { console.warn('[Recurring] sync after create error:', e); }
  // Notifier les composants abonnés (calendrier, budget)
  try { gamificationService.dispatchEvent('recurringMovementsUpdated', {}); } catch (_) {}
  // Gamification — 1 seul mouvement enregistré (peu importe le nb d'occurrences)
  gamificationService.onMovementRecorded();
  try { _getQuestService()?.checkCurrentQuest(); } catch (_) {}
  // Score de santé — recalcul différé
  try { _getHealthScoreService()?.scheduleRefresh(); } catch (_) {}
  return rm;
}

function updateRegularMovement(id, updates) {
  const store = getData();
  const idx = (store.regular_movements || []).findIndex(rm => rm.id === id);
  if (idx === -1) throw new Error('Mouvement régulier introuvable');
  const existing = store.regular_movements[idx];
  // Audit trail : tracer les modifications de montant
  const auditEntries = [];
  if (updates.amount !== undefined && parseFloat(updates.amount) !== existing.amount) {
    auditEntries.push({
      date:          new Date().toISOString().split('T')[0],
      champ:         'montant',
      ancienneValeur: existing.amount,
      nouvelleValeur: parseFloat(updates.amount),
    });
  }
  store.regular_movements[idx] = {
    ...existing,
    ...updates,
    amount:                  updates.amount !== undefined ? parseFloat(updates.amount) : existing.amount,
    asset_allocations:       updates.asset_allocations !== undefined
                               ? updates.asset_allocations
                               : (existing.asset_allocations || []),
    historique_modifications: [...(existing.historique_modifications || []), ...auditEntries],
  };
  const updated = store.regular_movements[idx];

  // ── Resync des transactions si le mouvement reste actif et des paramètres
  // clés ont changé (montant, date de début, récurrence, type).
  // Ne s'applique pas aux mouvements compte_cheque (pas de transactions).
  const isStillActive   = updated.status === 'active';
  const historyAffected = updates.amount !== undefined
                       || updates.start_date !== undefined
                       || updates.recurrence !== undefined
                       || updates.type !== undefined
                       || updates.fees_pct !== undefined
                       || updates.fees_type !== undefined
                       || updates.annual_fees_pct !== undefined
                       || updates.annual_fees_type !== undefined;
  if (isStillActive && historyAffected && updated.portfolio_id !== 'compte_cheque') {
    _resyncMovementTransactions(id); // inclut saveData()
  } else {
    saveData();
  }

  addLog(`REGULAR_MOVEMENT_UPDATED: ${id}`);
  // Notifier les composants abonnés (calendrier, budget)
  try { gamificationService.dispatchEvent('recurringMovementsUpdated', {}); } catch (_) {}
  return updated;
}

function stopRegularMovement(id) {
  const todayStr = new Date().toISOString().split('T')[0];
  return updateRegularMovement(id, { end_date: todayStr, status: 'stopped' });
}

/**
 * Supprime un mouvement récurrent et toutes les transactions qu'il a générées.
 *
 * Cascade :
 *   1. Identifie les transactions dont `from_recurring_id === id`.
 *   2. Inverse leur impact sur le solde / total_deposits / total_withdrawals de l'enveloppe.
 *   3. Supprime ces transactions.
 *   4. Supprime le mouvement récurrent lui-même.
 *
 * @param {string} id — identifiant du mouvement récurrent à supprimer
 * @returns {{ deletedTxCount: number }} — nombre de transactions supprimées en cascade
 */
function deleteRegularMovement(id) {
  const store = getData();
  if (!store.regular_movements) return { deletedTxCount: 0 };

  // ── 1. Trouver les transactions liées ──────────────────────────────────────
  const linkedTxs = (store.transactions || []).filter(tx => tx.from_recurring_id === id);

  // ── 2. Inverser l'impact sur les soldes ────────────────────────────────────
  if (linkedTxs.length > 0) {
    const portfolioMap = {};
    (store.portfolios || []).forEach(p => { portfolioMap[p.id] = p; });

    for (const tx of linkedTxs) {
      const portfolio = portfolioMap[tx.portfolio_id];
      if (!portfolio) continue;

      const amount    = tx.amount    || 0;
      const netAmount = tx.net_amount != null ? tx.net_amount : amount;

      if (tx.type === 'deposit') {
        portfolio.balance         = Math.round(((portfolio.balance         || 0) - netAmount) * 100) / 100;
        portfolio.total_deposits  = Math.round(((portfolio.total_deposits  || 0) - amount)    * 100) / 100;
        portfolio.total_fees      = Math.round(((portfolio.total_fees      || 0) - (tx.fees_amount || 0)) * 100) / 100;
      } else {
        // withdrawal
        portfolio.balance           = Math.round(((portfolio.balance           || 0) + netAmount) * 100) / 100;
        portfolio.total_withdrawals = Math.round(((portfolio.total_withdrawals || 0) - amount)    * 100) / 100;
      }
    }

    // ── 3. Supprimer les transactions liées ───────────────────────────────────
    store.transactions = store.transactions.filter(tx => tx.from_recurring_id !== id);
  }

  // ── 4. Supprimer le mouvement récurrent ────────────────────────────────────
  store.regular_movements = store.regular_movements.filter(rm => rm.id !== id);

  saveData();
  addLog(`REGULAR_MOVEMENT_DELETED: ${id} (cascade: ${linkedTxs.length} tx supprimée(s))`);
  // Notifier les composants abonnés (calendrier, budget)
  try { gamificationService.dispatchEvent('recurringMovementsUpdated', {}); } catch (_) {}
  // Recalcul du score de santé différé
  try { require('./healthScoreService').default.scheduleRefresh(); } catch (_) {}

  return { deletedTxCount: linkedTxs.length };
}

/**
 * Propage la note d'un mouvement récurrent sur ses occurrences déjà enregistrées.
 * @param {string} id     — id du mouvement récurrent
 * @param {string} note   — nouvelle note (peut être vide → null)
 * @param {'future'|'all'} scope — 'future' : occurrences à partir d'aujourd'hui ;
 *                                 'all' : toutes les occurrences (passées incluses)
 * @returns {{ updated: number }}
 */
function applyNoteToRecurringOccurrences(id, note, scope = 'future') {
  const store = getData();
  const todayStr = new Date().toISOString().split('T')[0];
  const cleanNote = (note && note.trim()) ? note.trim() : null;
  let updated = 0;
  (store.transactions || []).forEach(tx => {
    if (tx.from_recurring_id !== id) return;
    if (scope === 'future' && tx.date < todayStr) return;
    tx.note = cleanNote;
    updated++;
  });
  if (updated > 0) {
    saveData();
    try { gamificationService.dispatchEvent('recurringMovementsUpdated', {}); } catch (_) {}
  }
  return { updated };
}

/** Ajoute N mois à une date YYYY-MM-DD, en gérant le débordement de fin de mois. */
function _addMonthsRM(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  const targetMonth = d.getMonth() + n;
  d.setMonth(targetMonth);
  // Corriger si le jour a débordé (ex : 31 jan + 1 mois → 3 mars au lieu de 28 fév)
  if (d.getMonth() !== ((targetMonth % 12 + 12) % 12)) d.setDate(0);
  return d.toISOString().split('T')[0];
}

/** Calcule la prochaine occurrence selon la récurrence d'un mouvement régulier. */
function _rmNextDate(dateStr, recurrence) {
  switch (recurrence) {
    case 'weekly': {
      const d = new Date(dateStr + 'T12:00:00');
      d.setDate(d.getDate() + 7);
      return d.toISOString().split('T')[0];
    }
    case 'monthly':     return _addMonthsRM(dateStr,  1);
    case 'quarterly':   return _addMonthsRM(dateStr,  3);
    case 'semi_annual': return _addMonthsRM(dateStr,  6);
    case 'annual':      return _addMonthsRM(dateStr, 12);
    default:            return null;
  }
}

/**
 * Génère toutes les dates d'occurrence d'un mouvement récurrent
 * de sa date de début jusqu'à `untilDate` (inclus).
 * @param {object} rm — regular movement object
 * @param {string} untilDate — 'YYYY-MM-DD'
 * @returns {string[]} — tableau de dates 'YYYY-MM-DD'
 */
function _generateRecurringOccurrences(rm, untilDate) {
  const dates = [];
  let current = rm.start_date;
  const endBound = rm.end_date && rm.end_date < untilDate ? rm.end_date : untilDate;
  let iterations = 0;
  // Garde-fou contre une boucle infinie seulement : 500 échéances ne couvraient que
  // neuf ans et demi d'une série hebdomadaire.
  while (current <= endBound && iterations < 20000) {
    dates.push(current);
    const next = _rmNextDate(current, rm.recurrence);
    if (!next || next === current) break;
    current = next;
    iterations++;
  }
  return dates;
}

/**
 * Supprime toutes les transactions liées à un mouvement récurrent, inverse
 * leur impact sur le solde/totaux de l'enveloppe, puis rappelle syncRegularMovements
 * pour les recréer selon les nouveaux paramètres (start_date, amount, recurrence…).
 *
 * Utilisé par updateRegularMovement quand des paramètres clés changent.
 * Ne s'applique pas aux mouvements compte_cheque (pas de transactions).
 *
 * @param {string} id — identifiant du mouvement récurrent
 */
function _resyncMovementTransactions(id) {
  const store = getData();
  const rm = (store.regular_movements || []).find(r => r.id === id);
  if (!rm || rm.portfolio_id === 'compte_cheque') return;

  // ── 1. Supprimer les transactions liées et inverser leur impact sur les soldes ─
  const linkedTxs = (store.transactions || []).filter(tx => tx.from_recurring_id === id);
  if (linkedTxs.length > 0) {
    const portfolioMap = {};
    (store.portfolios || []).forEach(p => { portfolioMap[p.id] = p; });

    for (const tx of linkedTxs) {
      const portfolio = portfolioMap[tx.portfolio_id];
      if (!portfolio) continue;
      const amount    = tx.amount    || 0;
      const netAmount = tx.net_amount != null ? tx.net_amount : amount;
      if (tx.type === 'deposit') {
        portfolio.balance        = Math.round(((portfolio.balance        || 0) - netAmount) * 100) / 100;
        portfolio.total_deposits = Math.round(((portfolio.total_deposits || 0) - amount)    * 100) / 100;
        portfolio.total_fees     = Math.round(((portfolio.total_fees     || 0) - (tx.fees_amount || 0)) * 100) / 100;
      } else {
        portfolio.balance           = Math.round(((portfolio.balance           || 0) + netAmount) * 100) / 100;
        portfolio.total_withdrawals = Math.round(((portfolio.total_withdrawals || 0) - amount)    * 100) / 100;
      }
    }
    store.transactions = store.transactions.filter(tx => tx.from_recurring_id !== id);
  }

  // ── 2. Réappliquer toutes les occurrences passées avec les nouveaux paramètres ─
  syncRegularMovements();

  // ── 3. Garantir la sauvegarde même si syncRegularMovements n'a rien créé ─────
  // (ex : nouvelle start_date dans le futur → aucune occurrence passée)
  saveData();

  // ── 4. Log dev ────────────────────────────────────────────────────────────────
}

/**
 * Applique automatiquement les occurrences passées des mouvements récurrents
 * qui n'ont pas encore été enregistrées dans l'historique des transactions.
 *
 * - Les occurrences sont identifiées via le champ `from_recurring_id` sur les transactions.
 * - Ne déclenche PAS `onMovementRecorded()` (gamification) — une seule occurrence par mouvement est déjà comptée à la création.
 * - Appelé depuis App.js au démarrage.
 *
 * @param {object|null} catchUpReport — contexte « rattrapage » (runRecurringCatchUp) :
 *   { applied: [], capped: [] } à alimenter. Sa présence ACTIVE le plafond de
 *   rattrapage à 24 mois (jamais appliqué hors rattrapage pour ne pas tronquer
 *   les resynchronisations d'édition sur des mouvements anciens).
 * @returns {number} — nombre d'occurrences nouvellement enregistrées
 */
function syncRegularMovements(catchUpReport = null) {
  const store   = getData();
  const rms     = (store.regular_movements || []).filter(rm => rm.status === 'active');
  const todayStr = new Date().toISOString().split('T')[0];
  // Plafond de rattrapage : 24 mois en arrière maximum par mouvement (sauvegardes très anciennes)
  let capStr = null;
  if (catchUpReport) {
    const capD = new Date();
    capD.setMonth(capD.getMonth() - 24);
    capStr = capD.toISOString().split('T')[0];
  }
  let appliedCount = 0;

  for (const rm of rms) {
    try {
      // Dates d'occurrences passées (start_date → today inclus)
      const allDates = _generateRecurringOccurrences(rm, todayStr);
      if (allDates.length === 0) continue;

      // Dates déjà enregistrées pour ce mouvement récurrent
      const existingDates = new Set(
        (store.transactions || [])
          .filter(tx => tx.from_recurring_id === rm.id)
          .map(tx => tx.date)
      );

      let toApply = allDates.filter(d => !existingDates.has(d));
      if (toApply.length === 0) continue;

      // Plafond de rattrapage (contexte runRecurringCatchUp uniquement) : ne pas
      // reconstruire plus de 24 mois d'historique par mouvement.
      if (capStr) {
        const skipped = toApply.filter(d => d < capStr).length;
        if (skipped > 0) {
          toApply = toApply.filter(d => d >= capStr);
          catchUpReport.capped.push({ label: rm.note || 'Mouvement récurrent', skipped });
          if (toApply.length === 0) continue;
        }
      }

      if (process.env.NODE_ENV !== 'production') {
        const label = rm.note ? `'${rm.note}'` : rm.id;
        console.debug(`[Récurrent] ${toApply.length} occurrence(s) à enregistrer pour ${label}`);
      }

      for (const date of toApply) {
        const portfolio = (store.portfolios || []).find(p => p.id === rm.portfolio_id);
        if (!portfolio) continue;

        const amount    = parseFloat(rm.amount) || 0;
        // Frais de transaction du récurrent appliqués à chaque occurrence (% ou € fixe)
        const feesType  = rm.fees_type === 'euro' ? 'euro' : 'percent';
        const feeInput  = parseFloat(rm.fees_pct) || 0;
        const totalFee  = feesType === 'euro'
          ? Math.min(feeInput, amount)
          : Math.round(amount * feeInput / 100 * 100) / 100;
        // Sens des frais du récurrent : 'deducted' (défaut) net = brut − frais ; 'added' net = brut + frais.
        const feeDirection = rm.fee_direction === 'added' ? 'added' : 'deducted';
        const netAmount = Math.round((feeDirection === 'added' ? amount + totalFee : amount - totalFee) * 100) / 100;

        // Frais annuels de gestion du récurrent, propagés à chaque occurrence
        // ('percent' = taux %/an accumulé sur le montant net ; 'euro' = montant fixe €/an).
        const annualFeesType = rm.annual_fees_type === 'euro' ? 'euro' : 'percent';
        const annualFeeInput = parseFloat(rm.annual_fees_pct) || 0;

        if (!store.transactions) store.transactions = [];

        // ── Résolution des types d'actifs ────────────────────────────────────
        // Multi-actifs : une sous-transaction par allocation avec le montant
        // proportionnel et le bon asset_type.
        // Actif unique / fallback : une seule transaction.
        const allocations = (rm.asset_allocations && rm.asset_allocations.length > 0)
          ? rm.asset_allocations                                     // [{ type, pct }, …]
          : [{ type: rm.asset_types?.[0] || 'autre', pct: 100 }];   // actif unique ou fallback

        const createdAt = new Date().toISOString();
        // Un seul groupe par occurrence : les sous-transactions multi-actifs
        // s'affichent comme UN seul chip sur le calendrier.
        const groupId = allocations.length > 1 ? `${rm.id}_${date}` : null;
        for (const alloc of allocations) {
          const allocAmount = Math.round(amount * ((alloc.pct ?? 100) / 100) * 100) / 100;
          const allocFee    = amount > 0 ? Math.round(totalFee * (allocAmount / amount) * 100) / 100 : 0;
          const allocNet    = Math.round((feeDirection === 'added' ? allocAmount + allocFee : allocAmount - allocFee) * 100) / 100;
          // Frais annuels : taux % identique par allocation ; montant € réparti au prorata.
          const allocAnnualEuro = (annualFeesType === 'euro' && amount > 0)
            ? Math.round(annualFeeInput * (allocAmount / amount) * 100) / 100
            : 0;
          store.transactions.push({
            id:                crypto.randomUUID(),
            portfolio_id:      rm.portfolio_id,
            type:              rm.type,
            amount:            allocAmount,
            fees_pct:          feesType === 'percent' ? feeInput : 0,
            fees_amount:       allocFee,
            fees_type:         feesType,
            fee_direction:     feeDirection,
            annual_fees_pct:   annualFeesType === 'percent' ? annualFeeInput : allocAnnualEuro,
            annual_fees_type:  annualFeesType,
            net_amount:        allocNet,
            date:              date,
            note:              `[Mouvement récurrent]${rm.note ? ' ' + rm.note : ''}`,
            asset_type:        alloc.type || 'autre',
            movement_group_id: groupId,
            from_recurring_id: rm.id,
            auto_applied:      true, // appliqué automatiquement (occurrence récurrente)
            created_at:        createdAt,
          });
        }

        // Bookkeeping : dernière occurrence appliquée sur le mouvement récurrent
        if (!rm.last_applied_date || date > rm.last_applied_date) rm.last_applied_date = date;
        if (catchUpReport) {
          catchUpReport.applied.push({
            date,
            type:   rm.type,
            amount: amount,
            label:  rm.note || `Récurrent — ${portfolio.name}`,
            portfolio: portfolio.name,
          });
        }

        if (process.env.NODE_ENV !== 'production') {
          console.debug(
            '[AssetAllocation] occurrence', date, '— mouvement', rm.id,
            '— répartition:', allocations.map(a => `${a.type} ${a.pct}%`).join(', ')
          );
        }

        // ── Solde mis à jour UNE SEULE FOIS avec le montant net de frais ─────
        if (rm.type === 'deposit') {
          portfolio.balance        = Math.round(((portfolio.balance        || 0) + netAmount) * 100) / 100;
          portfolio.total_deposits = Math.round(((portfolio.total_deposits || 0) + netAmount) * 100) / 100;
          portfolio.total_fees     = Math.round(((portfolio.total_fees     || 0) + totalFee)  * 100) / 100;
        } else {
          portfolio.balance           = Math.round(((portfolio.balance           || 0) - amount)   * 100) / 100;
          portfolio.total_withdrawals = Math.round(((portfolio.total_withdrawals || 0) + amount)   * 100) / 100;
          portfolio.total_fees        = Math.round(((portfolio.total_fees        || 0) + totalFee) * 100) / 100;
        }

        appliedCount++;
      }
    } catch (e) {
      console.warn('[Recurring] sync error for', rm.id, e);
    }
  }

  if (appliedCount > 0) {
    saveData();
    addLog(`RECURRING_SYNC: ${appliedCount} nouvelles occurrences enregistrées`);
  }

  return appliedCount;
}

/**
 * Génère les occurrences futures des mouvements réguliers actifs
 * dans une fenêtre de `months` mois à partir d'aujourd'hui.
 * Chaque occurrence inclut toutes les propriétés du mouvement + `occurrence_date`.
 *
 * L'occurrence du jour est incluse tant qu'elle n'est pas appliquée, mais
 * syncRegularMovements l'enregistre dès aujourd'hui : on écarte donc les dates
 * qui ont déjà leur transaction, sinon le jour J affiche le versement ET
 * l'occurrence programmée (et le budget du mois le compte deux fois).
 */
function getRegularMovementOccurrences(months = 12) {
  const rms      = getRegularMovements().filter(rm => rm.status === 'active');
  const todayStr = new Date().toISOString().split('T')[0];
  const endD     = new Date();
  endD.setMonth(endD.getMonth() + months);
  const endStr   = endD.toISOString().split('T')[0];
  const result   = [];
  const dejaAppliquees = new Set(
    (getData().transactions || [])
      .filter(tx => tx.from_recurring_id)
      .map(tx => `${tx.from_recurring_id}|${tx.date}`)
  );

  for (const rm of rms) {
    let current    = rm.start_date;
    let iterations = 0;
    // Garde-fou large : on part de la date de DÉBUT de la série. Un plafond à 120
    // échéances faisait disparaître du calendrier toute série mensuelle de plus de
    // dix ans (ou hebdomadaire de plus de deux ans), qui n'atteignait jamais aujourd'hui.
    while (current <= endStr && iterations < 20000) {
      // Ignorer les dates passées et dépasser la date de fin du mouvement
      if (current >= todayStr) {
        if (rm.end_date && current > rm.end_date) break;
        if (!dejaAppliquees.has(`${rm.id}|${current}`)) result.push({ ...rm, occurrence_date: current });
      }
      const next = _rmNextDate(current, rm.recurrence);
      if (!next) break;
      current = next;
      iterations++;
    }
  }
  return result;
}

/**
 * Génère toutes les occurrences d'un mois calendaire spécifique
 * pour tous les mouvements réguliers actifs, passées ou futures.
 * Contrairement à getRegularMovementOccurrences, ne filtre pas sur todayStr.
 * Utilisé pour les vues budget (liste + camembert) du mois consulté.
 *
 * @param {number} year  — ex: 2026
 * @param {number} month — 0-indexé (0 = janvier … 11 = décembre)
 * @returns {Array<{...rm, occurrence_date: string}>}
 */
function getRegularMovementOccurrencesForMonth(year, month) {
  const rms      = getRegularMovements().filter(rm => rm.status === 'active');
  const m        = month + 1; // 1-indexed
  const firstDay = `${year}-${String(m).padStart(2, '0')}-01`;
  // Dernier jour du mois en date LOCALE (toISOString() donnerait la veille en France).
  const lastDay  = `${year}-${String(m).padStart(2, '0')}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`;
  const result   = [];

  for (const rm of rms) {
    if (rm.start_date > lastDay) continue;              // starts after the month → skip
    if (rm.end_date && rm.end_date < firstDay) continue; // ended before the month → skip

    const allDates = _generateRecurringOccurrences(rm, lastDay);
    for (const date of allDates) {
      if (date >= firstDay) {
        result.push({ ...rm, occurrence_date: date });
      }
    }
  }
  return result;
}

// ============ SIMULATIONS « RÈGLE 8-4-3 » (lecture seule, config persistée) ============
// Ne stocke QUE la configuration (enveloppes sélectionnées, date de départ, versement
// mensuel, rendement, nom). La projection est recalculée à l'affichage — aucune donnée
// du tableau de bord n'est modifiée.

function getRule843Sims() {
  return getData().rule843_sims || [];
}

function getRule843Sim(id) {
  return (getData().rule843_sims || []).find(s => s.id === id) || null;
}

/**
 * Crée ou met à jour une simulation « Règle 8-4-3 ».
 * @param {{ id?:string, name?:string, envelopeIds:string[], startYear:number, startMonth:number, monthlyDeposit:number, annualYield:number }} cfg
 * @returns {object} la config enregistrée (avec id)
 */
function saveRule843Sim(cfg) {
  const store = getData();
  if (!store.rule843_sims) store.rule843_sims = [];
  const now = new Date().toISOString();
  const clean = {
    name:           cfg.name || '',
    envelopeIds:    Array.isArray(cfg.envelopeIds) ? cfg.envelopeIds : [],
    startYear:      parseInt(cfg.startYear) || new Date().getFullYear(),
    startMonth:     parseInt(cfg.startMonth) || 1,
    monthlyDeposit: parseFloat(cfg.monthlyDeposit) || 0,
    annualYield:    parseFloat(cfg.annualYield) || 0,
    startCapital:   (cfg.startCapital === '' || cfg.startCapital == null || isNaN(parseFloat(cfg.startCapital))) ? null : parseFloat(cfg.startCapital),
  };
  const idx = cfg.id ? store.rule843_sims.findIndex(s => s.id === cfg.id) : -1;
  let entry;
  if (idx >= 0) {
    entry = { ...store.rule843_sims[idx], ...clean, updated_at: now };
    store.rule843_sims[idx] = entry;
  } else {
    entry = {
      id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `r843_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      ...clean, created_at: now, updated_at: now,
    };
    store.rule843_sims.push(entry);
  }
  saveData();
  return entry;
}

function deleteRule843Sim(id) {
  const store = getData();
  if (!store.rule843_sims) return;
  store.rule843_sims = store.rule843_sims.filter(s => s.id !== id);
  saveData();
}

// ============ PROGRAMMED MOVEMENTS ============

function getProgrammedMovements() {
  return getData().programmed_movements || [];
}

function createProgrammedMovement(data) {
  const pm = {
    id: Math.random().toString(36).substr(2, 9),
    portfolio_id: data.portfolio_id,
    type: data.type || 'deposit',
    amount: parseFloat(data.amount) || 0,
    fees_pct: parseFloat(data.fees_pct) || 0,
    asset_type: data.asset_type || null,
    note: data.note || '',
    frequency: data.frequency || 'monthly',
    next_date: data.next_date,
    auto_apply: data.auto_apply || false,
    applied_dates: [],
    created_at: new Date().toISOString(),
  };
  const store = getData();
  if (!store.programmed_movements) store.programmed_movements = [];
  store.programmed_movements.push(pm);
  saveData();
  addLog(`PROGRAMMED_MOVEMENT_CREATED: ${pm.type} on ${pm.next_date}`);
  return pm;
}

function updateProgrammedMovement(id, updates) {
  const store = getData();
  if (!store.programmed_movements) return;
  const idx = store.programmed_movements.findIndex(p => p.id === id);
  if (idx === -1) throw new Error('Mouvement programmé introuvable');
  store.programmed_movements[idx] = { ...store.programmed_movements[idx], ...updates };
  saveData();
}

function deleteProgrammedMovement(id) {
  const store = getData();
  if (!store.programmed_movements) return;
  store.programmed_movements = store.programmed_movements.filter(p => p.id !== id);
  saveData();
  addLog(`PROGRAMMED_MOVEMENT_DELETED: ${id}`);
}

function _advancePMDate(pm) {
  const d = new Date(pm.next_date + 'T12:00:00');
  if (pm.frequency === 'weekly') d.setDate(d.getDate() + 7);
  else if (pm.frequency === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (pm.frequency === 'quarterly') d.setMonth(d.getMonth() + 3);
  else if (pm.frequency === 'semi_annual') d.setMonth(d.getMonth() + 6);
  else if (pm.frequency === 'annual') d.setFullYear(d.getFullYear() + 1);
  else return null;
  return d.toISOString().split('T')[0];
}

function applyProgrammedMovement(id) {
  const store = getData();
  if (!store.programmed_movements) throw new Error('Aucun mouvement programmé');
  const pm = store.programmed_movements.find(p => p.id === id);
  if (!pm) throw new Error('Mouvement programmé introuvable');
  const tx = createTransaction(pm.portfolio_id, {
    type: pm.type, amount: pm.amount, fees_pct: pm.fees_pct, date: pm.next_date,
    note: (pm.note ? pm.note + ' ' : '') + '[automatique]',
    asset_type: pm.asset_type,
  });
  if (!pm.applied_dates) pm.applied_dates = [];
  pm.applied_dates.push(pm.next_date);
  const nextDate = _advancePMDate(pm);
  if (nextDate) {
    pm.next_date = nextDate;
  } else {
    store.programmed_movements = store.programmed_movements.filter(p => p.id !== id);
  }
  saveData();
  addLog(`PROGRAMMED_MOVEMENT_APPLIED: ${pm.type}`);
  return tx;
}

function checkAndApplyAutoMovements() {
  const store = getData();
  if (!store.programmed_movements) return [];
  const today = new Date().toISOString().split('T')[0];
  const dueIds = (store.programmed_movements)
    .filter(pm => pm.auto_apply && pm.next_date <= today)
    .map(pm => pm.id);
  const applied = [];
  for (const id of dueIds) {
    try { applied.push(applyProgrammedMovement(id)); } catch (e) { /* skip */ }
  }
  return applied;
}

/**
 * Rattrapage des mouvements récurrents au chargement (démarrage OU import JSON).
 *
 * 1. Tableau de bord : applique toutes les occurrences récurrentes manquées
 *    (start_date → aujourd'hui), plafonnées à 24 mois par mouvement, en dédupliquant
 *    via l'historique (from_recurring_id + date) — idempotent.
 * 2. Mouvements programmés (calendrier) :
 *    - « Appliquer automatiquement » ACTIVÉ → toutes les échéances passées sont appliquées ;
 *    - désactivé → signalés « en attente d'application manuelle » (aucune écriture).
 * 3. Simulations : matérialise les occurrences manquantes jusqu'à aujourd'hui SANS
 *    rogner les occurrences futures déjà matérialisées par le curseur d'horizon.
 *
 * Mouvement ou enveloppe supprimé(e) → ignoré silencieusement (résolutions internes).
 *
 * @returns {{ applied: Array, pending: Array, capped: Array, simApplied: number,
 *             periodStart: string, periodEnd: string }}
 */
function runRecurringCatchUp() {
  const todayStr = new Date().toISOString().split('T')[0];
  const report = { applied: [], pending: [], capped: [], simApplied: 0, periodStart: todayStr, periodEnd: todayStr };

  // ── 1. Récurrents du tableau de bord (toujours appliqués automatiquement) ────
  try { syncRegularMovements(report); } catch (e) { console.warn('[CatchUp] dashboard sync error:', e); }

  // ── 2. Mouvements programmés du calendrier ───────────────────────────────────
  try {
    const pms = getData().programmed_movements || [];
    // Échéances passées SANS auto-application → en attente d'application manuelle
    pms.filter(pm => !pm.auto_apply && pm.next_date <= todayStr).forEach(pm => {
      report.pending.push({ date: pm.next_date, type: pm.type, amount: pm.amount, label: pm.note || 'Mouvement programmé' });
    });
    // Auto-application : boucler tant que des échéances restent dues (une occurrence
    // par mouvement et par passe — next_date avance à chaque application).
    let guard = 0;
    while (guard++ < 60) {
      const batch = checkAndApplyAutoMovements();
      if (!batch.length) break;
      batch.forEach(tx => {
        report.applied.push({
          date:   tx.date,
          type:   tx.type,
          amount: tx.amount,
          label:  (tx.note || 'Mouvement programmé').replace(' [automatique]', '').replace('[automatique]', '').trim() || 'Mouvement programmé',
        });
      });
    }
  } catch (e) { console.warn('[CatchUp] programmed error:', e); }

  // ── 3. Simulations : rattrapage additif jusqu'à aujourd'hui ──────────────────
  // untilDate = max(aujourd'hui, horizon récurrent déjà matérialisé) → le TRIM de
  // syncSimulationRegularMovements est un no-op (rien au-delà de cet horizon).
  try {
    for (const sim of (getSimulations() || [])) {
      const horizon = (sim.transactions || [])
        .filter(t => t.from_recurring_id)
        .reduce((m, t) => (t.date > m ? t.date : m), todayStr);
      report.simApplied += syncSimulationRegularMovements(sim.id, horizon) || 0;
    }
  } catch (e) { console.warn('[CatchUp] simulations error:', e); }

  // Période couverte (récapitulatif)
  const dates = [...report.applied, ...report.pending].map(x => x.date).sort();
  if (dates.length) report.periodStart = dates[0];

  const total = report.applied.length + report.simApplied;
  if (total > 0) addLog(`RECURRING_CATCHUP: ${report.applied.length} appliquée(s), ${report.simApplied} en simulation, ${report.pending.length} en attente`);
  return report;
}

function getUpcomingProgrammedOccurrences(months = 12) {
  const pms = getProgrammedMovements();
  const occurrences = [];
  const today = new Date();
  const endDate = new Date(today);
  endDate.setMonth(endDate.getMonth() + months);
  for (const pm of pms) {
    let current = new Date(pm.next_date + 'T12:00:00');
    let iterations = 0;
    while (current <= endDate && iterations < 60) {
      occurrences.push({ ...pm, occurrence_date: current.toISOString().split('T')[0] });
      const next = _advancePMDate({ ...pm, next_date: current.toISOString().split('T')[0] });
      if (!next) break;
      current = new Date(next + 'T12:00:00');
      iterations++;
    }
  }
  return occurrences;
}

const dataService = {
  ENVELOPE_PALETTE,
  PASTEL_PALETTE,
  ENVELOPE_TEXT_COLOR,
  getEnvelopePalette,
  getAssetColor,
  applyColorStyle,
  getDataSizeDiagnostic,
  logDataSizeDiagnostic,
  getPortfolios, getPortfolio, createPortfolio, updatePortfolio, deletePortfolio, getPortfolioDeletionImpact,
  getTransactionAnnualFees,
  getTransactions, getAllTransactions, createTransaction, createRecurringTransactions, updateTransaction, deleteTransaction,
  getMovementTemplates, getAllMovementTemplates, createMovementTemplate, updateMovementTemplate, deleteMovementTemplate,
  getPortfolioHistory, getAllPortfoliosHistory, getAssetTypeStats, getAssetAllocation, getAllAssetsHistory,
  runSimulation, runMultiSimulation, calculateTax, getTaxReport,
  exportJSON, importJSON, getLogs, addLog,
  getData, setData,
  downloadDataAsFile, loadDataFromFile, applyImportedData, getLastImportReport, loadMostRecentSave, hasData, clearAllData, resetAllPortfolios, fullReset,
  hasUnsavedChanges, markAsSaved,
  // Migration helpers — detect when regular_movements were absent in an imported JSON
  getRegularMovementsResetFlag: () => _regularMovementsResetOnLastLoad,
  clearRegularMovementsResetFlag: () => { _regularMovementsResetOnLastLoad = false; },
  // App preferences (thème + langue)
  getAppPreferences, saveAppPreferences,
  // Documents (PDF locaux)
  DOCUMENT_TYPES, slugify, getPortfolioSlug, migrateDocumentFolders,
  getDocuments, getDocumentsForPortfolio, addDocument, removeDocument, updateDocument,
  // Simulations
  getSimulations, getSimulation, createSimulation, updateSimulation, deleteSimulation,
  addSimulationPortfolio, deleteSimulationPortfolio, updateSimulationPortfolio,
  addSimulationTransaction, addSimulationRecurringTransactions, deleteSimulationTransaction, updateSimulationTransaction,
  getSimulationPortfolioHistory, getSimulationStats, computeSimulationProjection,
  exportSimulationsToJSON, importSimulationsFromJSON,
  // Simulation — espace de noms isolé (calibrations / modèles / récurrents + contexte de calcul)
  _withSimData,
  getSimulationCalibrations, addSimulationCalibration, deleteSimulationCalibration,
  getSimulationMovementTemplates, createSimulationMovementTemplate, updateSimulationMovementTemplate, deleteSimulationMovementTemplate,
  getSimulationRegularMovements, createSimulationRegularMovement, updateSimulationRegularMovement,
  stopSimulationRegularMovement, deleteSimulationRegularMovement, syncSimulationRegularMovements,
  // Nouvelles fonctions financières
  fv, calculateCompoundInterest, calculateTaxation,
  // Types d'actifs personnalisés
  getCustomAssetTypes, resolveAssetType,
  // Calibrations
  getCalibrations, addCalibration, deleteCalibration,
  needsCalibration, computeRealYield, computeGlobalYield, computeEnvelopeCAGR, computeWeightedCAGR, computeAnnualYields,
  getFireSettings, updateFireSettings, computeFireProgress,
  getPortfolioRealHistory, getPortfolioAssetTypes, getPortfolioPnlByAsset, getPortfolioValueOnDate,
  getRule843Sims, getRule843Sim, saveRule843Sim, deleteRule843Sim,
  getPortfolioCalibrationYields, getAllPortfoliosHistoryWithCalibration,
  getPortfolioTemplatePositions,
  // Reminders
  getReminders, createReminder, updateReminder, deleteReminder, dismissReminder, syncCalibrationReminder,
  // Calendar notes
  getCalendarNotes, getCalendarNotesForDate, createCalendarNote, updateCalendarNote, deleteCalendarNote,
  // Budget entries
  getBudgetEntries, getBudgetEntriesForMonth, createBudgetEntry, updateBudgetEntry, deleteBudgetEntry,
  // Regular movements (mouvements réguliers)
  getRegularMovements, getRegularMovementsByPortfolio,
  createRegularMovement, updateRegularMovement, stopRegularMovement, deleteRegularMovement, applyNoteToRecurringOccurrences,
  getRegularMovementOccurrences, getRegularMovementOccurrencesForMonth, syncRegularMovements, runRecurringCatchUp,
  // Programmed movements
  getProgrammedMovements, createProgrammedMovement, updateProgrammedMovement, deleteProgrammedMovement,
  applyProgrammedMovement, checkAndApplyAutoMovements, getUpcomingProgrammedOccurrences,
  // Export
  buildExportPayload,
  // Gamification — hooks UI (à appeler depuis les pages)
  trackSimulationLaunched:      () => gamificationService.onFirstTimeAction('simulation',        25, 'first_simulation'),
  trackStressTestLaunched:      () => gamificationService.onFirstTimeAction('stressTest',        40, 'first_stress_test'),
  trackFiscalSimulationDone:    () => gamificationService.onFirstTimeAction('fiscalSimulation',  50, 'first_fiscal_simulation'),
  trackFiscalReportGenerated:   () => gamificationService.onFirstTimeAction('fiscalReport',      60, 'first_fiscal_report'),
  // Quêtes tutoriel — trackers de premières actions (Prompt 5)
  trackLongTermProjection:  (horizonYears = 0, monthlyContrib = 0) => {
    try {
      // Stocker le contexte de la dernière simulation pour la condition de Q6
      gamificationService.patchState({
        lastSimulation: { horizonYears, monthlyContribution: monthlyContrib },
      });
      // Positionner le flag firstTime si les conditions sont remplies (retro-compat)
      if (horizonYears >= 10 && monthlyContrib > 0) {
        // trackFirstTime est idempotent : si le flag est déjà positionné il retourne
        // sans appeler checkCurrentQuest(). On force l'appel après pour couvrir
        // le cas où currentQuestIndex est devenu 6 entre deux sessions.
        _getQuestService()?.trackFirstTime('longTermProjection');
      }
      // Toujours déclencher le check (conditions remplies ou non)
      _getQuestService()?.checkCurrentQuest();
    } catch(_) {}
  },
  trackComparedTERValues:   () => { try { _getQuestService()?.trackFirstTime('comparedTERValues'); } catch(_){} },
  trackFiscalPFUSimulation: () => { try { _getQuestService()?.trackFirstTime('fiscalPFUSimulation'); } catch(_){} },
  trackFiscalComparison:    () => { try { _getQuestService()?.trackFirstTime('fiscalComparison'); } catch(_){} },
  // Q7 — frais non nuls dans le simulateur (déclenché depuis calculateHistoryData dans SimulationDetail)
  trackSimulatorFeesModified: () => { try { _getQuestService()?.trackFlag('simulatorFeesModified'); } catch(_){} },
  // Q10 — simulation PEA vs CTO complétée dans le simulateur fiscal
  trackFiscalComparisonDone: () => { try { _getQuestService()?.trackFlag('fiscalComparisonDone'); } catch(_){} },
  // Constantes
  ASSET_TYPES, PEA_MAX, DEFAULT_RATES,
  // Taux fiscaux centraux (janvier 2026)
  PS_RATE, IR_RATE, FLAT_TAX,
};
export default dataService;

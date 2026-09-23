// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * avatarService.js — The user's avatar, indexed on TOTAL CAPITAL.
 *
 * Total capital = the sum, over every envelope, of:
 *   • the value of the last calibration if the envelope is calibrated;
 *   • otherwise the balance of net deposits.
 *
 * THE EPIC — 19 tiers from €0 to €750,000, in 5 chapters (the Awakening, the Journey,
 * Knighthood, the Conquest, the Stars). From one tier to the next, capital is multiplied by
 * 1.5 to 2: each stage takes a comparable effort. Every tier carries a motto saluting the
 * ground covered.
 *
 * LEGEND — beyond €1,000,000, the 19 tiers play out again in gold, with a thin ring, up to
 * €1,000,000,000. Gold is reserved for the Legend: no avatar is gold before the million.
 *
 * The tier is never stored: it is recomputed from the capital on every display. Changing
 * the list therefore requires no data migration.
 *
 * PUBLIC API:
 *   getTotalCapital()            → number
 *   getAvatarForCapital(capital) → AvatarInfo
 *   getCurrentAvatar()           → AvatarInfo
 *   AVATAR_STEPS                 → standard tiers (read-only)
 *   PRESTIGE_STEPS               → Legend tiers (read-only)
 *   PRESTIGE_THRESHOLD           → 1,000,000
 */

import dataService from './dataService';

/** Capital à partir duquel les avatars passent en or, avec liseré. */
export const PRESTIGE_THRESHOLD = 1_000_000;

/** Les cinq chapitres de l'épopée (l'identifiant sert à la couleur de l'avatar). */
export const CHAPITRES = {
  1: { fr: "L'Éveil",       en: 'The Awakening' },
  2: { fr: 'Le Voyage',     en: 'The Journey' },
  3: { fr: 'La Chevalerie', en: 'Knighthood' },
  4: { fr: 'La Conquête',   en: 'The Conquest' },
  5: { fr: 'Les Étoiles',   en: 'The Stars' },
};

/**
 * Les 19 paliers standards. `threshold` = capital total à partir duquel l'avatar
 * est attribué ; `tier` = clé de l'icône (avatarIcons.js).
 * `legendeFr` : libellé du même palier en Légende, écrit en entier pour respecter
 * les accords (« Premiers pas légendaires »).
 */
const AVATAR_STEPS = [
  // ── I. L'Éveil ──────────────────────────────────────────────────────────────
  { threshold:       0, tier: 'premiers_pas',  chapitre: 1,
    labelFr: 'Premiers pas',   legendeFr: 'Premiers pas légendaires', labelEn: 'First steps',
    deviseFr: 'Toute fortune commence par un premier pas.',
    deviseEn: 'Every fortune begins with a first step.' },
  { threshold:     500, tier: 'jeune_pousse',  chapitre: 1,
    labelFr: 'Jeune pousse',   legendeFr: 'Jeune pousse légendaire',  labelEn: 'Sprout',
    deviseFr: 'Vos premiers euros prennent racine.',
    deviseEn: 'Your first euros are taking root.' },
  { threshold:   1_000, tier: 'sac_au_dos',    chapitre: 1,
    labelFr: 'Sac au dos',     legendeFr: 'Sac au dos légendaire',    labelEn: 'Backpack',
    deviseFr: "1 000 € : l'aventure commence vraiment.",
    deviseEn: '€1,000: the adventure truly begins.' },
  { threshold:   2_000, tier: 'boussole',      chapitre: 1,
    labelFr: 'Boussole',       legendeFr: 'Boussole légendaire',      labelEn: 'Compass',
    deviseFr: 'Vous savez où vous allez.',
    deviseEn: 'You know where you are heading.' },

  // ── II. Le Voyage ───────────────────────────────────────────────────────────
  { threshold:   3_000, tier: 'carte',         chapitre: 2,
    labelFr: 'Carte du monde', legendeFr: 'Carte du monde légendaire', labelEn: 'World map',
    deviseFr: 'Le chemin se dessine sous vos pas.',
    deviseEn: 'The path takes shape beneath your feet.' },
  { threshold:   5_000, tier: 'feu_de_camp',   chapitre: 2,
    labelFr: 'Feu de camp',    legendeFr: 'Feu de camp légendaire',   labelEn: 'Campfire',
    deviseFr: '5 000 € : une halte bien méritée.',
    deviseEn: '€5,000: a well-earned rest.' },
  { threshold:   7_500, tier: 'monture',       chapitre: 2,
    labelFr: 'Monture',        legendeFr: 'Monture légendaire',       labelEn: 'Steed',
    deviseFr: 'Vous prenez de la vitesse.',
    deviseEn: 'You are picking up speed.' },
  { threshold:  10_000, tier: 'bouclier',      chapitre: 2,
    labelFr: 'Bouclier',       legendeFr: 'Bouclier légendaire',      labelEn: 'Shield',
    deviseFr: '10 000 € : un vrai rempart contre les imprévus.',
    deviseEn: '€10,000: a real shield against the unexpected.' },

  // ── III. La Chevalerie ──────────────────────────────────────────────────────
  { threshold:  15_000, tier: 'epee',          chapitre: 3,
    labelFr: 'Épée',           legendeFr: 'Épée légendaire',          labelEn: 'Sword',
    deviseFr: 'Armé pour les batailles à venir.',
    deviseEn: 'Armed for the battles ahead.' },
  { threshold:  20_000, tier: 'forteresse',    chapitre: 3,
    labelFr: 'Forteresse',     legendeFr: 'Forteresse légendaire',    labelEn: 'Fortress',
    deviseFr: 'Votre place forte sort de terre.',
    deviseEn: 'Your stronghold rises from the ground.' },
  { threshold:  30_000, tier: 'tresor',        chapitre: 3,
    labelFr: 'Trésor',         legendeFr: 'Trésor légendaire',        labelEn: 'Treasure',
    deviseFr: 'Le coffre commence à se remplir.',
    deviseEn: 'The chest is starting to fill up.' },
  { threshold:  50_000, tier: 'dragon',        chapitre: 3,
    labelFr: 'Dragon',         legendeFr: 'Dragon légendaire',        labelEn: 'Dragon',
    deviseFr: '50 000 € : vous avez dompté le dragon.',
    deviseEn: '€50,000: you have tamed the dragon.' },

  // ── IV. La Conquête ─────────────────────────────────────────────────────────
  { threshold:  75_000, tier: 'grand_large',   chapitre: 4,
    labelFr: 'Grand large',    legendeFr: 'Grand large légendaire',   labelEn: 'Open sea',
    deviseFr: 'Cap vers les horizons lointains.',
    deviseEn: 'Setting sail for distant horizons.' },
  { threshold: 100_000, tier: 'sommet',        chapitre: 4,
    labelFr: 'Sommet',         legendeFr: 'Sommet légendaire',        labelEn: 'Summit',
    deviseFr: 'Les premiers 100 000 € sont les plus durs : c’est fait.',
    deviseEn: 'The first €100,000 is the hardest: done.' },
  { threshold: 150_000, tier: 'diamant',       chapitre: 4,
    labelFr: 'Diamant',        legendeFr: 'Diamant légendaire',       labelEn: 'Diamond',
    deviseFr: 'Pression, patience… et un diamant.',
    deviseEn: 'Pressure, patience… and a diamond.' },
  { threshold: 200_000, tier: 'couronne',      chapitre: 4,
    labelFr: 'Couronne',       legendeFr: 'Couronne légendaire',      labelEn: 'Crown',
    deviseFr: 'Le royaume est à vous.',
    deviseEn: 'The kingdom is yours.' },

  // ── V. Les Étoiles ──────────────────────────────────────────────────────────
  { threshold: 300_000, tier: 'decollage',     chapitre: 5,
    labelFr: 'Décollage',      legendeFr: 'Décollage légendaire',     labelEn: 'Lift-off',
    deviseFr: 'Les intérêts composés prennent le relais.',
    deviseEn: 'Compound interest takes over.' },
  { threshold: 500_000, tier: 'orbite',        chapitre: 5,
    labelFr: 'Orbite',         legendeFr: 'Orbite légendaire',        labelEn: 'Orbit',
    deviseFr: 'Un demi-million : vous changez d’orbite.',
    deviseEn: 'Half a million: you have reached a new orbit.' },
  { threshold: 750_000, tier: 'etoile_filante', chapitre: 5,
    labelFr: 'Étoile filante', legendeFr: 'Étoile filante légendaire', labelEn: 'Shooting star',
    deviseFr: 'Le million est en vue.',
    deviseEn: 'The million is in sight.' },
];

/**
 * Seuils de la Légende : même rythme régulier, de 1 M€ à 1 Md€ (19 paliers), alignés
 * un à un sur AVATAR_STEPS (même icône). Chaque palier a SA devise : celles des
 * paliers standards citent leurs propres montants (« Le million est en vue ») et
 * deviendraient fausses une fois reprises en Légende. La devise est écrite à côté du
 * seuil qu'elle évoque, pour qu'un changement de montant ne passe pas inaperçu.
 */
const PRESTIGE_TIERS = [
  { threshold:     1_000_000, deviseFr: 'Le million ! Une nouvelle légende commence.',
                              deviseEn: 'A million! A new legend begins.' },
  { threshold:     1_500_000, deviseFr: 'Votre fortune reprend racine, plus profond encore.',
                              deviseEn: 'Your fortune takes root again, deeper than ever.' },
  { threshold:     2_000_000, deviseFr: '2 millions : l’aventure reprend, en plus grand.',
                              deviseEn: '€2 million: the adventure resumes, on a grander scale.' },
  { threshold:     3_000_000, deviseFr: 'Votre cap ne dévie plus.',
                              deviseEn: 'Your course no longer wavers.' },
  { threshold:     5_000_000, deviseFr: '5 millions : le monde entier tient sur votre carte.',
                              deviseEn: '€5 million: the whole world fits on your map.' },
  { threshold:     7_500_000, deviseFr: 'Un feu qui ne s’éteint plus.',
                              deviseEn: 'A fire that never goes out.' },
  { threshold:    10_000_000, deviseFr: '10 millions : votre élan est irrésistible.',
                              deviseEn: '€10 million: your momentum is unstoppable.' },
  { threshold:    15_000_000, deviseFr: 'Votre rempart protège désormais des générations.',
                              deviseEn: 'Your shield now protects generations.' },
  { threshold:    20_000_000, deviseFr: 'Une lame forgée dans la patience.',
                              deviseEn: 'A blade forged in patience.' },
  { threshold:    30_000_000, deviseFr: 'Une citadelle que rien n’ébranle.',
                              deviseEn: 'A citadel nothing can shake.' },
  { threshold:    50_000_000, deviseFr: '50 millions : un trésor digne des légendes.',
                              deviseEn: '€50 million: a treasure worthy of legend.' },
  { threshold:    75_000_000, deviseFr: 'Le dragon veille désormais sur votre or.',
                              deviseEn: 'The dragon now guards your gold.' },
  { threshold:   100_000_000, deviseFr: '100 millions : aucun horizon ne vous arrête.',
                              deviseEn: '€100 million: no horizon can stop you.' },
  { threshold:   150_000_000, deviseFr: 'Au-dessus des nuages, il n’y a plus que vous.',
                              deviseEn: 'Above the clouds, it is just you.' },
  { threshold:   200_000_000, deviseFr: '200 millions : un joyau sans égal.',
                              deviseEn: '€200 million: a jewel without equal.' },
  { threshold:   300_000_000, deviseFr: 'Plus qu’un royaume : un empire.',
                              deviseEn: 'More than a kingdom: an empire.' },
  { threshold:   500_000_000, deviseFr: 'Un demi-milliard : cap sur l’hyperespace.',
                              deviseEn: 'Half a billion: next stop, hyperspace.' },
  { threshold:   750_000_000, deviseFr: 'Le milliard est en vue.',
                              deviseEn: 'The billion is in sight.' },
  { threshold: 1_000_000_000, deviseFr: 'Un milliard : votre étoile brille pour toujours.',
                              deviseEn: 'A billion: your star shines forever.' },
];

if (PRESTIGE_TIERS.length !== AVATAR_STEPS.length) {
  throw new Error('avatarService : la Légende doit compter autant de paliers que l’épopée');
}

const PRESTIGE_STEPS = AVATAR_STEPS.map((s, i) => ({
  ...s,
  threshold:  PRESTIGE_TIERS[i].threshold,
  deviseFr:   PRESTIGE_TIERS[i].deviseFr,
  deviseEn:   PRESTIGE_TIERS[i].deviseEn,
  labelFr:    s.legendeFr,
  labelEn:    `Legendary ${s.labelEn.charAt(0).toLowerCase()}${s.labelEn.slice(1)}`,
  isPrestige: true,
}));

/** Tous les paliers, du plus petit au plus grand. */
const ALL_STEPS = [
  ...AVATAR_STEPS.map(s => ({ ...s, isPrestige: false })),
  ...PRESTIGE_STEPS,
];

/**
 * Capital total de l'utilisateur : valeur calibrée quand elle existe, sinon
 * solde des versements nets. Toutes les enveloppes comptent, livrets inclus.
 *
 * @returns {number} capital total en euros (0 si aucune enveloppe)
 */
export function getTotalCapital() {
  try {
    const portfolios = dataService.getPortfolios() || [];
    return portfolios.reduce((sum, p) => {
      const lastCal = dataService.getCalibrations(p.id).slice(-1)[0];
      return sum + (lastCal ? (lastCal.total_value || 0) : (p.balance || 0));
    }, 0);
  } catch (_) {
    return 0;
  }
}

/**
 * Avatar correspondant à un capital donné.
 *
 * @param {number} capital
 * @returns {{
 *   tier: string, chapitre: number, isGolden: boolean, isPrestige: boolean,
 *   labelFr: string, labelEn: string, deviseFr: string, deviseEn: string,
 *   threshold: number, nextThreshold: number|null,
 *   index: number, total: number,
 * }}
 */
export function getAvatarForCapital(capital) {
  const c = Number.isFinite(capital) ? Math.max(0, capital) : 0;

  // Dernier palier dont le seuil est atteint
  let idx = 0;
  for (let i = ALL_STEPS.length - 1; i >= 0; i--) {
    if (c >= ALL_STEPS[i].threshold) { idx = i; break; }
  }

  const step = ALL_STEPS[idx];
  return {
    tier:          step.tier,
    chapitre:      step.chapitre,
    // L'or est réservé à la Légende.
    isGolden:      step.isPrestige,
    isPrestige:    step.isPrestige,
    labelFr:       step.labelFr,
    labelEn:       step.labelEn,
    deviseFr:      step.deviseFr,
    deviseEn:      step.deviseEn,
    threshold:     step.threshold,
    nextThreshold: idx < ALL_STEPS.length - 1 ? ALL_STEPS[idx + 1].threshold : null,
    index:         idx,
    total:         ALL_STEPS.length,
  };
}

/** Avatar courant de l'utilisateur. */
export function getCurrentAvatar() {
  return getAvatarForCapital(getTotalCapital());
}

const avatarService = {
  getTotalCapital,
  getAvatarForCapital,
  getCurrentAvatar,
  AVATAR_STEPS,
  PRESTIGE_STEPS,
  ALL_STEPS,
  PRESTIGE_THRESHOLD,
  CHAPITRES,
};

export { AVATAR_STEPS, PRESTIGE_STEPS, ALL_STEPS };
export default avatarService;

/**
 * Dérivation des tokens d'un programme à partir de ses deux couleurs
 * (miroir de backend/apps/noyau/theme.py ; cas de référence partagés : shared/token-fixtures.json).
 */
const NOIR = '#000000';
const BLANC = '#FFFFFF';
const TEXTE_FONCE = '#141414';

export function hexVersRgb(couleur) {
  let h = couleur.replace('#', '');
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16));
}

export function rgbVersHex(rgb) {
  return (
    '#' +
    rgb
      .map((v) =>
        Math.round(Math.max(0, Math.min(255, v)))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
      .toUpperCase()
  );
}

/** Mélange `a` avec `poids` (0–1) de `b`. */
export function melanger(a, b, poids) {
  const x = hexVersRgb(a);
  const y = hexVersRgb(b);
  return rgbVersHex(x.map((v, i) => v * (1 - poids) + y[i] * poids));
}

export function luminance(couleur) {
  const [r, g, b] = hexVersRgb(couleur).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Blanc ou #141414 selon le meilleur contraste. */
export function couleurSur(fond) {
  return contraste(fond, BLANC) >= contraste(fond, TEXTE_FONCE) ? BLANC : TEXTE_FONCE;
}

export const estHexValide = (c) => /^#[0-9a-f]{6}$/i.test(c || '');

export function deriverTokens(principale, secondaire) {
  const p = principale.toUpperCase();
  const s = secondaire.toUpperCase();
  return {
    primary: p,
    secondary: s,
    primary_hover: melanger(p, NOIR, 0.15),
    primary_soft: melanger(p, BLANC, 0.88),
    secondary_soft: melanger(s, BLANC, 0.85),
    on_primary: couleurSur(p),
    on_secondary: couleurSur(s),
    header: melanger(p, BLANC, 0.86),
  };
}

/** Variables CSS (--p, --s…) à poser sur la racine d'un écran thématisé. */
export function variablesCss(principale, secondaire) {
  const t = deriverTokens(principale, secondaire);
  return {
    '--p': t.primary,
    '--s': t.secondary,
    '--ph': t.primary_hover,
    '--ps': t.primary_soft,
    '--ss': t.secondary_soft,
    '--op': t.on_primary,
    '--os': t.on_secondary,
    '--hd': t.header,
  };
}

/** Variables CSS depuis les tokens renvoyés par l'API ({p, s, ph, ps, ss, op, os, hd}). */
export function variablesDepuisApi(tokens) {
  if (!tokens) return {};
  return Object.fromEntries(Object.entries(tokens).map(([k, v]) => [`--${k}`, v]));
}

/** Contrôles de contraste WCAG affichés dans l'éditeur de programme. */
export function controlesContraste(principale, secondaire) {
  const t = deriverTokens(principale, secondaire);
  const graphite = '#0B0C0D';
  return [
    {
      cle: 'onp',
      label: 'Texte « on-primary » sur la principale',
      ratio: contraste(t.primary, t.on_primary),
      min: 4.5,
    },
    { cle: 'pblanc', label: 'Principale en texte sur blanc', ratio: contraste(t.primary, BLANC), min: 4.5 },
    {
      cle: 'sg',
      label: 'Secondaire sur fond graphite (cadre de visée)',
      ratio: contraste(t.secondary, graphite),
      min: 3,
    },
    {
      cle: 'ons',
      label: 'Texte « on-secondary » sur la secondaire',
      ratio: contraste(t.secondary, t.on_secondary),
      min: 4.5,
    },
  ].map((c) => ({ ...c, ok: c.ratio >= c.min }));
}

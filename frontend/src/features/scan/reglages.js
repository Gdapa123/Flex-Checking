/** Réglages du poste de scan, mémorisés sur l'appareil (localStorage). */
const CLE = 'fc-scan-reglages';

export const MODES_SCAN = [
  { value: 'QR_CAMERA', label: 'QR caméra', icone: 'camera' },
  { value: 'DOUCHETTE', label: 'Douchette', icone: 'barcode' },
  { value: 'CODE', label: 'Code 4 chiffres', icone: 'hash' },
  { value: 'MANUEL', label: 'Manuel', icone: 'search' },
];

export const APPAREILS = [
  { value: 'AUTO', label: 'Auto' },
  { value: 'TELEPHONE', label: 'Téléphone' },
  { value: 'TABLETTE', label: 'Borne' },
  { value: 'ORDINATEUR', label: 'Ordinateur' },
];

export const POSTES_SUGGERES = ['Accueil principal', 'Borne 1', 'Borne 2', 'Poste ordinateur', 'Entrée VIP'];

const DEFAUT = {
  evenementId: null,
  poste: 'Accueil principal',
  mode: 'QR_CAMERA',
  appareil: 'AUTO',
  duree: null,
  son: null,
  vibration: null,
  camera: 'environment',
};

export function lireReglages() {
  try {
    return { ...DEFAUT, ...JSON.parse(localStorage.getItem(CLE) || '{}') };
  } catch {
    return { ...DEFAUT };
  }
}

export function ecrireReglages(maj) {
  const r = { ...lireReglages(), ...maj };
  try {
    localStorage.setItem(CLE, JSON.stringify(r));
  } catch {
    /* stockage indisponible (navigation privée) : réglages en mémoire seulement */
  }
  return r;
}

/** Disposition détectée : téléphone (< 640 px), borne (tactile 768–1279 px), ordinateur. */
export function appareilDetecte() {
  if (typeof window === 'undefined') return 'TELEPHONE';
  const w = window.innerWidth;
  const tactile = window.matchMedia?.('(pointer: coarse)').matches;
  if (w < 640) return 'TELEPHONE';
  if (tactile && w < 1280) return 'TABLETTE';
  return 'ORDINATEUR';
}

export function appareilEffectif(reglages) {
  if (reglages.mode === 'DOUCHETTE') return 'ORDINATEUR';
  return reglages.appareil === 'AUTO' ? appareilDetecte() : reglages.appareil;
}

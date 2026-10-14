/** Réglages du poste de scan, mémorisés sur l'appareil (localStorage). */
const CLE = 'fc-scan-reglages';

export const MODES_SCAN = [
  { value: 'QR_CAMERA', label: 'QR caméra', icone: 'camera', aide: 'La caméra lit le QR code' },
  { value: 'DOUCHETTE', label: 'Douchette', icone: 'barcode', aide: 'Lecteur branché à l’ordinateur' },
  { value: 'CODE', label: 'Code 4 chiffres', icone: 'hash', aide: 'Code de secours de l’email' },
  { value: 'MANUEL', label: 'Manuel', icone: 'search', aide: 'Recherche par nom' },
];

export const APPAREILS = [
  { value: 'AUTO', label: 'Auto', icone: 'refresh', aide: 'S’adapte à l’appareil' },
  { value: 'TELEPHONE', label: 'Téléphone', icone: 'smartphone', aide: 'Un hôte scanne les invités' },
  { value: 'TABLETTE', label: 'Borne', icone: 'tablet', aide: 'Libre-service pour les invités' },
  { value: 'ORDINATEUR', label: 'Ordinateur', icone: 'monitor', aide: 'Webcam ou douchette' },
];

// noms de poste proposés : un par appareil (« Borne », « Téléphone »… relèvent du réglage « Écran »)
export const POSTES_SUGGERES = ['Accueil principal', 'Accueil 2', 'Accueil 3', 'Entrée VIP'];

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

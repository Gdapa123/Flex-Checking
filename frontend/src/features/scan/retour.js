/** Retours sonores (Web Audio API) et vibrations, désactivables. */
let ctx = null;

function contexte() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** À appeler lors d'un geste utilisateur (débloque l'audio sur iOS). */
export function debloquerAudio() {
  contexte();
}

function bip(c, frequence, debut, duree, type = 'sine', volume = 0.18) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = frequence;
  g.gain.setValueAtTime(0.0001, c.currentTime + debut);
  g.gain.exponentialRampToValueAtTime(volume, c.currentTime + debut + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + debut + duree);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + debut);
  o.stop(c.currentTime + debut + duree + 0.02);
}

const SONS = {
  PRESENT: (c) => {
    bip(c, 880, 0, 0.12);
    bip(c, 1320, 0.12, 0.18);
  },
  DEJA_EMARGE: (c) => {
    bip(c, 660, 0, 0.14, 'triangle');
    bip(c, 660, 0.2, 0.14, 'triangle');
  },
  ERREUR: (c) => bip(c, 220, 0, 0.35, 'square', 0.12),
  ATTENTE: (c) => bip(c, 520, 0, 0.2, 'triangle'),
};

const VIBRATIONS = { PRESENT: [60], DEJA_EMARGE: [80, 60, 80], ERREUR: [200, 80, 200], ATTENTE: [40, 40, 40] };

export function signaler(type, { son = true, vibration = true } = {}) {
  const cle =
    type === 'CODE_INVALIDE' || type === 'AUTRE_EVENEMENT' ? 'ERREUR' : type === 'HORS_LIGNE' ? 'ATTENTE' : type;
  if (son) {
    try {
      const c = contexte();
      if (c) SONS[cle]?.(c);
    } catch {
      /* audio indisponible */
    }
  }
  if (vibration && navigator.vibrate) navigator.vibrate(VIBRATIONS[cle] || [50]);
}

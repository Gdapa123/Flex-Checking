import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';

/**
 * Lecture continue des QR codes avec la caméra (caméra arrière par défaut), sans action de l'hôte.
 * États : autorisation | demarrage | actif | refus | aucune | occupee | erreur | inactif.
 * La caméra est libérée proprement à la sortie (stop des pistes).
 */
export default function useCamera({ actif, facing = 'environment', onDetect }) {
  const videoRef = useRef(null);
  const controles = useRef(null);
  const rappel = useRef(onDetect);
  const [etat, setEtat] = useState('inactif');
  const [torche, setTorche] = useState(false);
  const [torcheDispo, setTorcheDispo] = useState(false);
  const [demande, setDemande] = useState(0);
  rappel.current = onDetect;

  const arreter = useCallback(() => {
    try {
      controles.current?.stop();
    } catch {
      /* déjà arrêtée */
    }
    controles.current = null;
    const flux = videoRef.current?.srcObject;
    flux?.getTracks?.().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setTorche(false);
  }, []);

  useEffect(() => {
    if (!actif) {
      arreter();
      setEtat('inactif');
      return undefined;
    }
    let annule = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setEtat('aucune');
        return;
      }
      if (demande === 0 && navigator.permissions?.query) {
        try {
          const p = await navigator.permissions.query({ name: 'camera' });
          if (p.state === 'prompt') return setEtat('autorisation');
          if (p.state === 'denied') return setEtat('refus');
        } catch {
          /* API non supportée (Safari) : on tente directement */
        }
      }
      setEtat('demarrage');
      // après un écran d'état (autorisation, refus…), la <video> n'est montée qu'au rendu suivant
      for (let i = 0; i < 10 && !videoRef.current && !annule; i++) {
        await new Promise((ok) => requestAnimationFrame(ok));
      }
      if (annule) return;
      try {
        const lecteur = new BrowserQRCodeReader(undefined, {
          delayBetweenScanAttempts: 120,
          delayBetweenScanSuccess: 300,
        });
        const c = await lecteur.decodeFromConstraints(
          { audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          videoRef.current,
          (resultat) => {
            if (resultat) rappel.current?.(resultat.getText());
          },
        );
        if (annule) {
          c.stop();
          return;
        }
        controles.current = c;
        setTorcheDispo(typeof c.switchTorch === 'function');
        setEtat('actif');
      } catch (e) {
        if (annule) return;
        const nom = e?.name || '';
        if (nom === 'NotAllowedError' || nom === 'SecurityError') setEtat('refus');
        else if (nom === 'NotFoundError' || nom === 'OverconstrainedError') setEtat('aucune');
        else if (nom === 'NotReadableError' || nom === 'AbortError') setEtat('occupee');
        else setEtat('erreur');
      }
    })();
    return () => {
      annule = true;
      arreter();
    };
  }, [actif, facing, demande, arreter]);

  useEffect(() => arreter, [arreter]);

  const basculerTorche = useCallback(async () => {
    if (!controles.current?.switchTorch) return false;
    try {
      await controles.current.switchTorch(!torche);
      setTorche(!torche);
      return true;
    } catch {
      return false;
    }
  }, [torche]);

  /** Relance après un geste utilisateur (bouton « Autoriser la caméra » ou « Réessayer »). */
  const demarrer = useCallback(() => setDemande((n) => n + 1), []);

  return { videoRef, etat, torche, torcheDispo, basculerTorche, demarrer };
}

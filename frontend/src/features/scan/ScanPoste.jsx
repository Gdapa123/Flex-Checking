import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { heure, MODES, nombre } from '../../lib/format';
import { useSecours } from '../../lib/tempsReel';
import useTitre from '../../lib/useTitre';
import ThemeScope from '../../theme/ThemeScope';
import Icon from '../../components/ui/Icon';
import Logo from '../../components/ui/Logo';
import Segmente from '../../components/ui/Segmente';
import Spinner from '../../components/ui/Spinner';
import {
  BadgeGraphite,
  CadreVisee,
  FeuilleAnnulation,
  FeuilleReglages,
  PastilleDetection,
  PointLecture,
  ResultatPanneau,
  ResultatPleinEcran,
  VueCode,
  VueEtatCamera,
  VueRecherche,
} from './composants';
import * as file from './fileHorsLigne';
import { appareilEffectif, ecrireReglages, lireReglages } from './reglages';
import { signaler } from './retour';
import useCamera from './useCamera';
import { useEvenementsScan } from './useEvenementsScan';
import useWakeLock from './useWakeLock';

const ANTI_REBOND_MS = 3000;
const CLE_HISTO = (id) => `fc-scan-historique-${id}`;

function lireSession(cle, defaut) {
  try {
    return JSON.parse(sessionStorage.getItem(cle) || 'null') ?? defaut;
  } catch {
    return defaut;
  }
}
function ecrireSession(cle, valeur) {
  try {
    sessionStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    /* stockage indisponible */
  }
}

/** Construit l'affichage d'un résultat serveur (ou hors ligne). */
function presenterResultat(r, { mode, poste }) {
  const nom = r.invite?.nomComplet || '';
  const h = r.presentLe ? heure(r.presentLe) : heure(new Date());
  switch (r.resultat) {
    case 'PRESENT':
      return {
        type: 'PRESENT',
        titre: 'Présence enregistrée',
        nom,
        meta: [h, MODES[mode], r.invite?.entreprise].filter(Boolean).join(' · '),
        note: r.magazineEnvoye ? 'Email n°2 envoyé · magazine du programme' : '',
      };
    case 'DEJA_EMARGE':
      return {
        type: 'DEJA_EMARGE',
        titre: `Déjà émargé à ${h}`,
        nom,
        meta: ['Premier passage : ' + h, MODES[r.mode] || '', r.poste].filter(Boolean).join(' · '),
      };
    case 'AUTRE_EVENEMENT':
      return {
        type: 'AUTRE_EVENEMENT',
        titre: 'Cet invité appartient à un autre événement',
        nom: '',
        meta: `Inscrit à la ${r.evenementAutre}`,
      };
    case 'HORS_LIGNE':
      return {
        type: 'HORS_LIGNE',
        titre: 'Enregistré, vérification à la reconnexion',
        nom: '',
        meta: `Hors ligne · ${h} · ${poste}. Le passage sera vérifié et synchronisé automatiquement.`,
      };
    default:
      return {
        type: 'CODE_INVALIDE',
        titre: 'Code invalide',
        nom: '',
        meta: 'Ce code n’est pas reconnu. Proposez le code à 4 chiffres ou la recherche par nom.',
      };
  }
}

export default function ScanPoste() {
  const { id } = useParams();
  const evenementId = Number(id);
  const { data: evenements, isLoading } = useEvenementsScan();
  const evenement = evenements?.find((e) => e.id === evenementId);
  useTitre(evenement ? `Scan · ${evenement.nomAffiche}` : 'Scan');
  if (isLoading) {
    return (
      <div
        className="univers-scan flex min-h-[100dvh] items-center justify-center bg-g-fond text-g-texte"
        role="status"
        aria-label="Chargement"
      >
        <Spinner taille={28} />
      </div>
    );
  }
  if (!evenement) return <Navigate to="/scan" replace />;
  return <Poste evenement={evenement} />;
}

function Poste({ evenement }) {
  const naviguer = useNavigate();
  const qc = useQueryClient();
  const secours = useSecours(5000);
  const evenementId = evenement.id;
  const [reglages, setReglages] = useState(lireReglages);
  const appareil = appareilEffectif(reglages);
  const { data: global } = useQuery({
    queryKey: ['parametres-scan'],
    queryFn: () => api.get('/parametres/scan/'),
    staleTime: 300_000,
  });
  const duree = reglages.duree ?? global?.dureeResultatScan ?? 3;
  const son = reglages.son ?? global?.sonActif ?? true;
  const vibration = reglages.vibration ?? global?.vibrationActif ?? true;

  const vueInitiale = reglages.mode === 'CODE' ? 'code' : reglages.mode === 'MANUEL' ? 'recherche' : 'camera';
  const [vue, setVue] = useState(vueInitiale);
  const [entreeOrdinateur, setEntreeOrdinateur] = useState(reglages.mode === 'DOUCHETTE' ? 'douchette' : 'webcam');
  const [phase, setPhase] = useState('attente');
  const [resultat, setResultat] = useState(null);
  const [progression, setProgression] = useState(0);
  const [pause, setPause] = useState(false);
  const [historique, setHistorique] = useState(() => lireSession(CLE_HISTO(evenementId), []));
  const [dernier, setDernier] = useState(() => lireSession(`fc-scan-dernier-${evenementId}`, null));
  const [compteurs, setCompteurs] = useState({ presents: evenement.nbPresents, inscrits: evenement.nbInscrits });
  const [enLigne, setEnLigne] = useState(navigator.onLine);
  const [enAttente, setEnAttente] = useState(0);
  const [feuille, setFeuille] = useState(null); // 'reglages' | 'annulation'
  const [annulationEnCours, setAnnulationEnCours] = useState(false);
  const [toast, setToast] = useState(null);
  const [chiffres, setChiffres] = useState('');
  const [q, setQ] = useState('');
  const [facing, setFacing] = useState(reglages.camera || 'environment');
  const [valeurDouchette, setValeurDouchette] = useState('');
  const dernierScan = useRef({ valeur: '', t: 0 });
  const occupe = useRef(false);
  const douchette = useRef(null);

  useWakeLock(true);

  const majReglages = (maj) => setReglages(ecrireReglages(maj));
  const afficherToast = useCallback((m) => {
    setToast(m);
    setTimeout(() => setToast((t) => (t === m ? null : t)), 2600);
  }, []);

  useEffect(() => {
    ecrireSession(CLE_HISTO(evenementId), historique.slice(0, 40));
  }, [historique, evenementId]);
  useEffect(() => {
    ecrireSession(`fc-scan-dernier-${evenementId}`, dernier);
  }, [dernier, evenementId]);

  // Compteurs temps réel (WebSocket ; interrogation toutes les 5 s en secours)
  const { data: recents } = useQuery({
    queryKey: ['recents', evenementId],
    queryFn: () => api.get(`/evenements/${evenementId}/emargements/recents/`),
    refetchInterval: secours,
    enabled: enLigne,
  });
  useEffect(() => {
    if (recents) setCompteurs({ presents: recents.presents, inscrits: recents.inscrits });
  }, [recents]);

  // ------------------------------------------------------------------ hors ligne
  const rafraichirAttente = useCallback(
    () =>
      file
        .compter(evenementId)
        .then(setEnAttente)
        .catch(() => {}),
    [evenementId],
  );
  const synchroniser = useCallback(async () => {
    if (!navigator.onLine) return;
    const faits = await file.synchroniser(evenementId, (payload) =>
      api.post(`/evenements/${evenementId}/emargement/`, payload),
    );
    if (faits.length) {
      const dernierOk = faits[faits.length - 1].resultat;
      setCompteurs({ presents: dernierOk.presents, inscrits: dernierOk.inscrits });
      setHistorique((h) =>
        h.map((x) => {
          const f = faits.find((y) => y.id === x.fileId);
          return f ? { ...x, type: f.resultat.resultat, nom: f.resultat.invite?.nomComplet || x.nom } : x;
        }),
      );
      afficherToast(`${faits.length} ${faits.length > 1 ? 'émargements synchronisés' : 'émargement synchronisé'}`);
      qc.invalidateQueries({ queryKey: ['recents', evenementId] });
    }
    rafraichirAttente();
  }, [evenementId, afficherToast, qc, rafraichirAttente]);

  useEffect(() => {
    rafraichirAttente();
    const on = () => {
      setEnLigne(true);
      synchroniser();
    };
    const off = () => setEnLigne(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const t = setInterval(() => navigator.onLine && synchroniser(), 15000);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      clearInterval(t);
    };
  }, [synchroniser, rafraichirAttente]);

  // ------------------------------------------------------------------ émargement
  const afficher = useCallback(
    (res, mode) => {
      const vu = presenterResultat(res, { mode, poste: reglages.poste });
      setResultat(vu);
      setPhase('resultat');
      setProgression(0);
      setPause(false);
      signaler(vu.type, { son, vibration });
      setHistorique((h) =>
        [
          {
            cle: `${Date.now()}-${Math.random()}`,
            heure: heure(new Date()),
            nom: vu.nom || (vu.type === 'HORS_LIGNE' ? 'Passage hors ligne' : 'QR code non reconnu'),
            type: vu.type,
            mode: MODES[mode],
            fileId: res.fileId,
          },
          ...h,
        ].slice(0, 40),
      );
      if (res.resultat === 'PRESENT') {
        setDernier({
          emargementId: res.emargementId,
          nom: res.invite.nomComplet,
          heure: heure(res.presentLe),
          mode: MODES[mode],
        });
      }
      if (res.presents !== undefined) setCompteurs({ presents: res.presents, inscrits: res.inscrits });
    },
    [reglages.poste, son, vibration],
  );

  const emarger = useCallback(
    async (donnees, mode) => {
      if (occupe.current) return;
      occupe.current = true;
      setPhase('detection');
      const payload = { ...donnees, mode, poste: reglages.poste, appareil, dateClient: new Date().toISOString() };
      const debut = Date.now();
      try {
        if (!navigator.onLine) throw new TypeError('hors ligne');
        const r = await api.post(`/evenements/${evenementId}/emargement/`, payload);
        await new Promise((ok) => setTimeout(ok, Math.max(0, 250 - (Date.now() - debut))));
        afficher(r, mode);
      } catch (e) {
        if (e instanceof TypeError || e?.status >= 500) {
          const item = await file.ajouter(evenementId, payload);
          rafraichirAttente();
          setEnLigne(navigator.onLine);
          afficher({ resultat: 'HORS_LIGNE', fileId: item.id }, mode);
        } else {
          setPhase('attente');
          afficherToast(
            e?.status === 429
              ? 'Trop de tentatives de code. Patientez une minute.'
              : 'Émargement impossible. Réessayez.',
          );
        }
      } finally {
        occupe.current = false;
      }
    },
    [appareil, evenementId, reglages.poste, afficher, afficherToast, rafraichirAttente],
  );

  // Retour automatique à la caméra après la durée réglée (pause au toucher)
  useEffect(() => {
    if (phase !== 'resultat' || pause) return undefined;
    const t = setInterval(() => {
      setProgression((p) => {
        const n = p + 0.05 / duree;
        if (n >= 1) {
          clearInterval(t);
          setPhase('attente');
          setResultat(null);
          return 0;
        }
        return n;
      });
    }, 50);
    return () => clearInterval(t);
  }, [phase, pause, duree]);

  // ------------------------------------------------------------------ lecture QR (caméra) avec anti-rebond
  const surDetection = useCallback(
    (texte) => {
      const maintenant = Date.now();
      if (phase !== 'attente' || feuille || occupe.current) return; // caméra en pause pendant le résultat
      if (texte === dernierScan.current.valeur && maintenant - dernierScan.current.t < ANTI_REBOND_MS) return;
      dernierScan.current = { valeur: texte, t: maintenant };
      emarger({ qrToken: texte.trim() }, 'QR_CAMERA');
    },
    [phase, feuille, emarger],
  );

  const cameraVoulue =
    vue === 'camera' && (appareil !== 'ORDINATEUR' || entreeOrdinateur === 'webcam') && phase !== 'resultat';
  const camera = useCamera({ actif: cameraVoulue, facing, onDetect: surDetection });
  const etatCamera = camera.etat;
  const vueEtatCamera =
    vue === 'camera' && ['autorisation', 'refus', 'aucune', 'occupee', 'erreur'].includes(etatCamera) && cameraVoulue;

  // ------------------------------------------------------------------ douchette (champ toujours focalisé)
  const modeDouchette = appareil === 'ORDINATEUR' && entreeOrdinateur === 'douchette' && vue === 'camera';
  useEffect(() => {
    if (!modeDouchette || feuille) return undefined;
    const t = setInterval(() => {
      if (douchette.current && document.activeElement !== douchette.current)
        douchette.current.focus({ preventScroll: true });
    }, 400);
    return () => clearInterval(t);
  }, [modeDouchette, feuille]);

  const validerDouchette = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const v = valeurDouchette.trim();
    setValeurDouchette('');
    if (!v) return;
    if (/^\d{4}$/.test(v)) emarger({ code: v }, 'DOUCHETTE');
    else emarger({ qrToken: v }, 'DOUCHETTE');
  };

  // ------------------------------------------------------------------ code à 4 chiffres
  const toucheCode = (t) => {
    if (occupe.current) return;
    if (t === 'del') return setChiffres((c) => c.slice(0, -1));
    if (t === 'ok') {
      if (chiffres.length === 4) valider(chiffres);
      return;
    }
    if (chiffres.length >= 4) return;
    const n = chiffres + t;
    setChiffres(n);
    if (n.length === 4) setTimeout(() => valider(n), 220);
  };
  const valider = (code) => {
    setChiffres('');
    setVue('camera');
    emarger({ code }, 'CODE');
  };
  useEffect(() => {
    if (vue !== 'code') return undefined;
    const clavier = (e) => {
      if (/^\d$/.test(e.key)) toucheCode(e.key);
      else if (e.key === 'Backspace') toucheCode('del');
      else if (e.key === 'Enter') toucheCode('ok');
    };
    window.addEventListener('keydown', clavier);
    return () => window.removeEventListener('keydown', clavier);
  });

  // ------------------------------------------------------------------ recherche par nom
  const borne = appareil === 'TABLETTE';
  const rechercheActive = vue === 'recherche' && (!borne || q.trim().length >= 3);
  const { data: recherche, isFetching } = useQuery({
    queryKey: ['scan-recherche', evenementId, q.trim()],
    queryFn: () => api.get(`/evenements/${evenementId}/invites/`, { q: q.trim(), taille: 25, tri: 'nom' }),
    enabled: rechercheActive && enLigne,
    placeholderData: (p) => p,
    staleTime: 3000,
  });
  const emargerManuel = (inv) => {
    setVue('camera');
    setQ('');
    emarger({ inviteId: inv.id }, 'MANUEL');
  };

  // ------------------------------------------------------------------ annulation du dernier
  const annulerDernier = async () => {
    if (!dernier) return;
    setAnnulationEnCours(true);
    try {
      const r = await api.post(`/emargements/${dernier.emargementId}/annulation/`, {
        motif: 'Annulation depuis le scan',
      });
      setCompteurs({ presents: r.presents, inscrits: r.inscrits });
      setHistorique((h) => [
        { cle: `u${Date.now()}`, heure: heure(new Date()), nom: dernier.nom, type: 'ANNULE', mode: 'Annulation' },
        ...h,
      ]);
      afficherToast(`Émargement annulé · ${dernier.nom} est de nouveau Inscrit`);
      setDernier(null);
      setFeuille(null);
    } catch (e) {
      afficherToast(e?.data?.detail || 'Annulation impossible. Réessayez.');
    } finally {
      setAnnulationEnCours(false);
    }
  };

  const outils = {
    code: () => setVue('code'),
    recherche: () => setVue('recherche'),
    annuler: () => setFeuille('annulation'),
    torche: async () => {
      const ok = await camera.basculerTorche();
      afficherToast(
        ok ? (camera.torche ? 'Torche éteinte' : 'Torche allumée') : 'Torche non disponible sur cet appareil',
      );
    },
    camera: () => {
      const f = facing === 'environment' ? 'user' : 'environment';
      setFacing(f);
      majReglages({ camera: f });
      afficherToast(f === 'environment' ? 'Caméra arrière' : 'Caméra avant');
    },
    reglages: () => setFeuille('reglages'),
  };

  const commun = {
    evenement,
    reglages,
    compteurs,
    enLigne,
    enAttente,
    phase,
    camera,
    dernier,
    historique,
    outils,
    entreeOrdinateur,
    setEntreeOrdinateur: (m) => {
      setEntreeOrdinateur(m);
      majReglages({ mode: m === 'douchette' ? 'DOUCHETTE' : 'QR_CAMERA' });
    },
    douchette,
    valeurDouchette,
    setValeurDouchette,
    validerDouchette,
    resultat,
    progression,
    pause,
    duree,
    basculerPause: () => setPause((p) => !p),
  };

  let contenu;
  if (vue === 'code')
    contenu = <VueCode chiffres={chiffres} onTouche={toucheCode} onRetour={() => setVue('camera')} borne={borne} />;
  else if (vue === 'recherche')
    contenu = (
      <VueRecherche
        q={q}
        onQ={setQ}
        borne={borne}
        enCours={phase === 'detection'}
        chargement={isFetching && !recherche}
        total={recherche?.total ?? 0}
        resultats={(recherche?.resultats || []).map((r) => ({ ...r, heure: heure(r.presentLe) }))}
        onEmarger={emargerManuel}
        onRetour={() => {
          setQ('');
          setVue('camera');
        }}
      />
    );
  else if (vueEtatCamera)
    contenu = (
      <VueEtatCamera
        etat={etatCamera}
        onAutoriser={camera.demarrer}
        onCode={() => setVue('code')}
        onRecherche={() => setVue('recherche')}
        onDouchette={() => {
          majReglages({ mode: 'DOUCHETTE', appareil: 'ORDINATEUR' });
          setEntreeOrdinateur('douchette');
        }}
      />
    );
  else if (appareil === 'TABLETTE') contenu = <DispositionBorne {...commun} />;
  else if (appareil === 'ORDINATEUR') contenu = <DispositionOrdinateur {...commun} />;
  else contenu = <DispositionTelephone {...commun} />;

  const pleinEcran = phase === 'resultat' && resultat && appareil !== 'ORDINATEUR';

  return (
    <ThemeScope
      tokens={evenement.tokens}
      className="univers-scan fixed inset-0 flex flex-col overflow-hidden bg-g-fond text-g-texte"
    >
      <div className="relative flex min-h-0 flex-1 flex-col">
        {contenu}
        <div aria-live="assertive" role="alert" className="contents">
          {pleinEcran && (
            <ResultatPleinEcran
              resultat={resultat}
              appareil={appareil}
              progression={progression}
              pause={pause}
              duree={duree}
              onBasculer={() => setPause((p) => !p)}
            />
          )}
        </div>
        {feuille === 'annulation' && (
          <FeuilleAnnulation
            dernier={dernier}
            enCours={annulationEnCours}
            onAnnuler={annulerDernier}
            onFermer={() => setFeuille(null)}
          />
        )}
        {feuille === 'reglages' && (
          <FeuilleReglages
            duree={duree}
            onDuree={(d) => majReglages({ duree: d })}
            son={son}
            onSon={(v) => majReglages({ son: v })}
            vibration={vibration}
            onVibration={(v) => majReglages({ vibration: v })}
            onChanger={() => naviguer('/scan')}
            onAnnulation={() => setFeuille('annulation')}
            onFermer={() => setFeuille(null)}
          />
        )}
        {toast && (
          <div role="status" className="pointer-events-none absolute bottom-24 left-4 right-4 z-40 flex justify-center">
            <div className="flex animate-in-up items-center gap-2.5 rounded-[12px] bg-g-texte px-4 py-3 text-[15px] font-medium text-g-fond shadow-feuille">
              <Icon nom="checkCircle" className="text-[18px] text-succes" />
              {toast}
            </div>
          </div>
        )}
      </div>
    </ThemeScope>
  );
}

/* ================================================================== Bandeau hors ligne (S10) */
function BandeauHorsLigne({ enLigne, enAttente, taille = 'sm' }) {
  if (enLigne && !enAttente) return null;
  const texte = enLigne
    ? `Synchronisation en cours · ${enAttente} émargement${enAttente > 1 ? 's' : ''} en attente.`
    : `La lecture continue. ${enAttente ? `${enAttente} émargement${enAttente > 1 ? 's seront synchronisés' : ' sera synchronisé'}` : 'Les émargements seront synchronisés'} au retour du réseau.`;
  return (
    <div
      role="status"
      className={`flex items-start gap-2.5 bg-avert text-blanc ${taille === 'lg' ? 'px-8 py-3 text-[16px]' : 'px-4 py-2.5 text-[14px] leading-[1.4]'}`}
    >
      <Icon nom={enLigne ? 'refresh' : 'wifiOff'} className="mt-px text-[18px]" />
      <span>
        <strong className="font-semibold">{enLigne ? 'Reconnexion.' : 'Hors ligne.'}</strong> {texte}
      </span>
    </div>
  );
}

function Compteur({ compteurs, grand }) {
  return (
    <span className={`font-bold tabular-nums tracking-[-0.02em] ${grand ? 'text-[28px]' : 'text-[24px]'}`}>
      {nombre(compteurs.presents)}
      <span className="font-medium text-g-texte-2"> / {nombre(compteurs.inscrits)}</span>
    </span>
  );
}

function Video({ camera, facing }) {
  return (
    <video
      ref={camera.videoRef}
      muted
      playsInline
      aria-hidden="true"
      className={`absolute inset-0 h-full w-full object-cover ${camera.etat === 'actif' ? 'opacity-100' : 'opacity-0'} ${facing === 'user' ? '-scale-x-100' : ''}`}
    />
  );
}

/* ================================================================== S2 · Téléphone */
function DispositionTelephone({ evenement, reglages, compteurs, enLigne, enAttente, phase, camera, dernier, outils }) {
  const facing = reglages.camera || 'environment';
  const libelleMode = MODES[reglages.mode] || 'QR caméra';
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="entete-scan flex items-center gap-3 border-b border-g-bordure py-2.5 pl-4 pr-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold">{evenement.nomAffiche}</div>
          <div className="text-[13px] text-g-texte-2">
            {reglages.poste} · {libelleMode}
          </div>
        </div>
        <div className="text-right leading-[1.1]">
          <Compteur compteurs={compteurs} />
          <div className="text-[12px] text-g-texte-2">présents</div>
        </div>
        <button
          type="button"
          onClick={outils.reglages}
          aria-label="Réglages"
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-bouton border border-g-bordure bg-g-eleve text-[20px] text-g-texte"
        >
          <Icon nom="sliders" />
        </button>
      </header>
      <BandeauHorsLigne enLigne={enLigne} enAttente={enAttente} />
      <div className="relative flex-1 overflow-hidden bg-[radial-gradient(ellipse_at_50%_45%,var(--g-eleve)_0%,var(--g-sombre)_60%,var(--g-fond)_100%)]">
        <Video camera={camera} facing={facing} />
        <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
          <span className="inline-flex h-8 items-center gap-2 rounded-full border border-g-bordure bg-g-voile px-3 text-[13px] font-medium">
            <PointLecture />
          </span>
          <span className="text-[13px] text-g-texte-2">{facing === 'user' ? 'Caméra avant' : 'Caméra arrière'}</span>
        </div>
        <div className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2">
          <CadreVisee phase={phase} />
        </div>
        <div className="absolute left-6 right-6 flex justify-center text-center" style={{ top: 'calc(44% + 142px)' }}>
          {phase === 'detection' ? (
            <PastilleDetection />
          ) : camera.etat === 'demarrage' ? (
            <span className="inline-flex items-center gap-2 text-[15px] text-g-texte-2">
              <Spinner taille={16} />
              Démarrage de la caméra…
            </span>
          ) : (
            <p className="m-0 max-w-[300px] text-[16px] leading-[1.5] [text-wrap:pretty]">
              Invitez la personne à tendre son téléphone avec le QR code : la lecture est automatique
            </p>
          )}
        </div>
      </div>
      {dernier && (
        <div className="flex items-center gap-2.5 border-t border-g-bordure bg-g-sombre px-4 py-2.5 text-[14px]">
          <span className="text-g-texte-2">Dernier</span>
          <span className="min-w-0 flex-1 truncate font-semibold">{dernier.nom}</span>
          <span className="tabular-nums text-g-texte-2">{dernier.heure}</span>
          <BadgeGraphite type="PRESENT" className="!h-6 !px-2" />
        </div>
      )}
      <nav
        aria-label="Outils de secours"
        className="grid grid-cols-5 border-t border-g-bordure bg-g-surface px-1.5 pb-2.5 pt-1.5"
      >
        {[
          { cle: 'code', label: 'Code', icone: 'hash' },
          { cle: 'recherche', label: 'Rechercher', icone: 'search' },
          { cle: 'annuler', label: 'Annuler', icone: 'undo' },
          { cle: 'torche', label: 'Torche', icone: 'flash', presse: camera.torche, dispo: camera.torcheDispo },
          { cle: 'camera', label: 'Caméra', icone: 'switchCam' },
        ].map((t) => (
          <button
            key={t.cle}
            type="button"
            onClick={outils[t.cle]}
            aria-pressed={t.cle === 'torche' ? !!t.presse : undefined}
            aria-disabled={t.cle === 'torche' && !t.dispo ? true : undefined}
            className={`flex min-h-[60px] cursor-pointer flex-col items-center justify-center gap-1 rounded-bouton border-0 text-[12px] font-medium active:bg-g-eleve ${t.presse ? 'bg-s text-g-fond' : 'bg-transparent text-g-texte'} ${t.cle === 'torche' && !t.dispo ? 'opacity-50' : ''}`}
          >
            <Icon nom={t.icone} className="text-[22px]" />
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ================================================================== S11 · Tablette borne */
function DispositionBorne({ evenement, reglages, compteurs, enLigne, enAttente, phase, camera, outils }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="entete-scan flex items-center gap-5 border-b border-g-bordure px-8 py-5">
        <Logo variante="blanc" hauteur={40} />
        <span className="flex-1 text-[20px] font-semibold">{evenement.nomAffiche}</span>
        <span className="inline-flex h-9 items-center gap-2 rounded-full border border-g-bordure px-3.5 text-[15px]">
          <PointLecture />
        </span>
        <Compteur compteurs={compteurs} grand />
      </header>
      <BandeauHorsLigne enLigne={enLigne} enAttente={enAttente} taille="lg" />
      <div className="relative grid flex-1 items-center gap-12 overflow-hidden bg-[radial-gradient(ellipse_at_72%_50%,var(--g-eleve)_0%,var(--g-fond)_65%)] px-16 py-10 [grid-template-columns:minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="relative z-[1] flex flex-col gap-5">
          <span className="text-[20px] text-g-texte-2">Bienvenue</span>
          <h1 className="m-0 text-[clamp(48px,6.5vw,76px)] font-bold leading-none tracking-[-0.035em] [text-wrap:balance]">
            Présentez votre QR code
          </h1>
          <p className="m-0 max-w-[520px] text-[22px] leading-[1.45] text-g-texte-2">
            Tendez l’écran de votre téléphone face à la tablette. La lecture est automatique.
          </p>
          <div className="flex h-12 items-center">{phase === 'detection' && <PastilleDetection grand />}</div>
        </div>
        <div className="relative flex justify-center">
          <div className="relative h-[380px] w-[380px] overflow-hidden rounded-carte">
            <Video camera={camera} facing={reglages.camera} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <CadreVisee phase={phase} taille={380} coin={84} epaisseur={5} rayon={16} grand />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 border-t border-g-bordure bg-g-sombre px-8 pb-7 pt-5">
        <button
          type="button"
          onClick={outils.code}
          className="flex h-[76px] flex-1 cursor-pointer items-center justify-center gap-3 rounded-bouton border border-g-bordure bg-g-surface text-[20px] font-semibold text-g-texte active:bg-g-eleve"
        >
          <Icon nom="hash" className="text-[26px]" />
          Saisir mon code à 4 chiffres
        </button>
        <button
          type="button"
          onClick={outils.recherche}
          className="flex h-[76px] flex-1 cursor-pointer items-center justify-center gap-3 rounded-bouton border border-g-bordure bg-g-surface text-[20px] font-semibold text-g-texte active:bg-g-eleve"
        >
          <Icon nom="search" className="text-[26px]" />
          Rechercher mon nom
        </button>
        <button
          type="button"
          onClick={outils.reglages}
          aria-label="Espace hôte"
          className="flex h-[76px] w-[76px] cursor-pointer items-center justify-center rounded-bouton border border-g-bordure bg-transparent text-[24px] text-g-texte-2"
        >
          <Icon nom="lock" />
        </button>
      </div>
    </div>
  );
}

/* ================================================================== S12 · Ordinateur (douchette / webcam) */
function DispositionOrdinateur(props) {
  const {
    evenement,
    reglages,
    compteurs,
    enLigne,
    enAttente,
    phase,
    camera,
    historique,
    outils,
    entreeOrdinateur,
    setEntreeOrdinateur,
    douchette,
    valeurDouchette,
    setValeurDouchette,
    validerDouchette,
    resultat,
    progression,
    pause,
    duree,
    basculerPause,
  } = props;
  const taux = compteurs.inscrits ? Math.round((compteurs.presents / compteurs.inscrits) * 100) : 0;
  const afficheResultat = phase === 'resultat' && resultat;
  const libellesHisto = useMemo(() => historique.slice(0, 14), [historique]);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="entete-scan flex flex-wrap items-center gap-5 border-b border-g-bordure px-7 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="text-[18px] font-semibold">{evenement.nomAffiche}</div>
          <div className="text-[14px] text-g-texte-2">Poste ordinateur · {reglages.poste}</div>
        </div>
        <div className="rounded-moyen border border-g-bordure bg-g-fond">
          <Segmente
            variante="graphite"
            label="Lecteur"
            valeur={entreeOrdinateur}
            onChange={setEntreeOrdinateur}
            taille="sm"
            className="!border-0 !bg-transparent"
            options={[
              { value: 'douchette', label: 'Douchette' },
              { value: 'webcam', label: 'Webcam' },
            ]}
          />
        </div>
        <div className="text-right leading-[1.1]">
          <span className="text-[30px] font-bold tabular-nums tracking-[-0.02em]">
            {nombre(compteurs.presents)}
            <span className="font-medium text-g-texte-2"> / {nombre(compteurs.inscrits)}</span>
          </span>
          <div className="text-[13px] text-g-texte-2">présents · {taux} %</div>
        </div>
        <button
          type="button"
          onClick={outils.reglages}
          aria-label="Réglages"
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-bouton border border-g-bordure bg-g-eleve text-[20px] text-g-texte"
        >
          <Icon nom="sliders" />
        </button>
      </header>
      <BandeauHorsLigne enLigne={enLigne} enAttente={enAttente} />
      <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto px-7 py-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,1fr)]">
        <div className="flex min-h-0 flex-col gap-4">
          {entreeOrdinateur === 'douchette' ? (
            <div className="flex flex-col gap-3 rounded-[12px] border border-g-bordure bg-g-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="douchette" className="text-[16px] font-semibold">
                  Scannez le QR code avec la douchette
                </label>
                <span className="inline-flex items-center gap-2 text-[14px] text-g-succes-clair">
                  <PointLecture>Champ actif en permanence</PointLecture>
                </span>
              </div>
              <div className="flex h-[60px] items-center gap-3 rounded-moyen border-2 border-s bg-g-fond px-4">
                <Icon nom="barcode" className="text-[24px] text-g-texte-2" />
                <input
                  id="douchette"
                  ref={douchette}
                  value={valeurDouchette}
                  onChange={(e) => setValeurDouchette(e.target.value)}
                  onKeyDown={validerDouchette}
                  placeholder="En attente d’un scan…"
                  autoComplete="off"
                  autoFocus
                  spellCheck={false}
                  className="min-w-0 flex-1 border-0 bg-transparent font-mono text-[20px] font-medium text-g-texte outline-none"
                />
                {phase === 'detection' && <Spinner taille={20} className="text-g-detect" />}
              </div>
            </div>
          ) : (
            <div className="relative flex h-[300px] items-center justify-center overflow-hidden rounded-[12px] border border-g-bordure bg-[radial-gradient(ellipse_at_50%_50%,var(--g-eleve)_0%,var(--g-fond)_75%)]">
              <Video camera={camera} facing={reglages.camera} />
              <span className="absolute left-3.5 top-3.5 inline-flex h-[30px] items-center gap-2 rounded-full border border-g-bordure bg-g-voile px-3 text-[13px]">
                <PointLecture>Webcam · lecture automatique</PointLecture>
              </span>
              <CadreVisee phase={phase} taille={200} coin={44} />
            </div>
          )}
          <div aria-live="assertive" className="contents">
            {afficheResultat ? (
              <ResultatPanneau
                resultat={resultat}
                progression={progression}
                pause={pause}
                duree={duree}
                onBasculer={basculerPause}
              />
            ) : (
              <div className="flex min-h-[240px] flex-1 flex-col items-center justify-center gap-3 rounded-[12px] border border-dashed border-g-bordure p-6 text-center text-g-texte-2">
                <Icon nom="scan" className="text-[40px] text-s" />
                <span className="text-[20px] font-semibold text-g-texte">En attente du prochain passage</span>
                <span className="max-w-[380px] text-[15px]">
                  Le résultat s’affiche ici dès la lecture du QR code, sans aucune action.
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {[
              { cle: 'code', label: 'Code à 4 chiffres', icone: 'hash' },
              { cle: 'recherche', label: 'Recherche par nom', icone: 'search' },
              { cle: 'annuler', label: 'Annuler le dernier', icone: 'undo' },
            ].map((t) => (
              <button
                key={t.cle}
                type="button"
                onClick={outils[t.cle]}
                className="flex h-12 cursor-pointer items-center gap-2 rounded-bouton border border-g-bordure bg-g-surface px-4 text-[15px] font-medium text-g-texte hover:bg-g-eleve"
              >
                <Icon nom={t.icone} className="text-[18px]" />
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <section
          aria-label="Derniers passages"
          className="flex min-h-[320px] flex-col rounded-[12px] border border-g-bordure bg-g-surface"
        >
          <div className="flex items-center justify-between border-b border-g-bordure px-5 py-4">
            <h2 className="m-0 text-[16px] font-semibold">Derniers passages</h2>
            <span className="text-[14px] text-g-texte-2">
              {historique.length} {historique.length > 1 ? 'passages' : 'passage'}
            </span>
          </div>
          {historique.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2.5 p-8 text-center text-g-texte-2">
              <Icon nom="inbox" className="text-[32px]" />
              <span className="text-[15px]">Aucun passage pour le moment.</span>
            </div>
          ) : (
            <ol className="m-0 flex-1 list-none overflow-y-auto p-0">
              {libellesHisto.map((h) => (
                <li key={h.cle} className="flex animate-in-up items-center gap-3 border-b border-g-eleve px-5 py-3">
                  <span className="w-11 text-[14px] tabular-nums text-g-texte-2">{h.heure}</span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-semibold">{h.nom}</span>
                    <span className="text-[13px] text-g-texte-2">{h.mode}</span>
                  </div>
                  <BadgeGraphite type={h.type} />
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

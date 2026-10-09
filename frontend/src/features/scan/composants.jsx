import { useRef } from 'react';
import Icon from '../../components/ui/Icon';
import Interrupteur from '../../components/ui/Interrupteur';
import Segmente from '../../components/ui/Segmente';
import useFocusTrap from '../../components/ui/useFocusTrap';

/* ------------------------------------------------------------------ Cadre de visée */
export function CadreVisee({ taille = 236, coin = 52, epaisseur = 4, rayon = 14, phase, grand = false }) {
  const detecte = phase === 'detection';
  const couleur = detecte ? 'var(--g-detect)' : 'var(--s)';
  const coins = [
    { left: 0, top: 0, borderTop: 1, borderLeft: 1, r: 'TopLeft' },
    { right: 0, top: 0, borderTop: 1, borderRight: 1, r: 'TopRight' },
    { left: 0, bottom: 0, borderBottom: 1, borderLeft: 1, r: 'BottomLeft' },
    { right: 0, bottom: 0, borderBottom: 1, borderRight: 1, r: 'BottomRight' },
  ];
  return (
    <div
      className="relative animate-breathe transition-colors duration-150"
      style={{
        width: taille,
        height: taille,
        borderRadius: rayon,
        background: detecte ? 'var(--g-detect-doux)' : 'transparent',
      }}
    >
      {coins.map((c, i) => (
        <div
          key={i}
          className="absolute transition-colors duration-150"
          style={{
            width: coin,
            height: coin,
            left: c.left,
            right: c.right,
            top: c.top,
            bottom: c.bottom,
            borderTop: c.borderTop ? `${epaisseur}px solid ${couleur}` : undefined,
            borderBottom: c.borderBottom ? `${epaisseur}px solid ${couleur}` : undefined,
            borderLeft: c.borderLeft ? `${epaisseur}px solid ${couleur}` : undefined,
            borderRight: c.borderRight ? `${epaisseur}px solid ${couleur}` : undefined,
            [`border${c.r}Radius`]: rayon,
          }}
        />
      ))}
      {phase === 'attente' && (
        <div
          className="ligne-scan absolute left-[8%] right-[8%] animate-scanline rounded-sm"
          style={{ height: grand ? 3 : 2 }}
        />
      )}
      {detecte && (
        <div
          className="absolute inset-0 flex animate-pop items-center justify-center text-g-detect"
          style={{ fontSize: grand ? 96 : 56 }}
        >
          <Icon nom="qr" />
        </div>
      )}
    </div>
  );
}

export function PastilleDetection({ grand = false }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-g-detect bg-g-detect-badge font-semibold text-g-detect-clair ${grand ? 'h-12 gap-3 px-5 text-[18px]' : 'h-10 gap-2.5 px-4 text-[15px]'}`}
    >
      <span
        className="animate-spin rounded-full border-2 border-g-detect border-r-transparent [animation-duration:.6s]"
        style={{ width: grand ? 18 : 16, height: grand ? 18 : 16 }}
      />
      QR code détecté · vérification…
    </span>
  );
}

export function PointLecture({ children = 'Lecture automatique' }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-2 w-2 animate-blink rounded-full bg-g-detect" />
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ Résultat */
export const STYLES_RESULTAT = {
  PRESENT: { fond: 'bg-succes', icone: 'check' },
  DEJA_EMARGE: { fond: 'bg-avert', icone: 'alert' },
  CODE_INVALIDE: { fond: 'bg-erreur', icone: 'xCircle' },
  AUTRE_EVENEMENT: { fond: 'bg-erreur', icone: 'xCircle' },
  HORS_LIGNE: { fond: 'bg-avert', icone: 'wifiOff' },
};

const TAILLES_RESULTAT = {
  TABLETTE: { icone: 132, iconeF: 68, titre: 38, nom: 84, meta: 24, note: 18, cd: 18, gap: 20 },
  TELEPHONE: { icone: 88, iconeF: 46, titre: 24, nom: 42, meta: 17, note: 15, cd: 15, gap: 14 },
};

function BarreProgression({ progression, pause, duree, taille }) {
  const reste = Math.max(0, Math.ceil((1 - progression) * duree));
  return (
    <div className="flex flex-col gap-2.5">
      <div className="h-1.5 overflow-hidden rounded-[3px] bg-blanc-26">
        <div className="h-full bg-blanc" style={{ width: `${Math.round(progression * 100)}%` }} />
      </div>
      <div className="flex items-center justify-center gap-2" style={{ fontSize: taille }}>
        <Icon nom={pause ? 'play' : 'pause'} className="text-[18px]" />
        {pause
          ? 'En pause · touchez pour reprendre'
          : `Retour à la caméra dans ${reste} s · touchez pour mettre en pause`}
      </div>
    </div>
  );
}

/** S4 · Résultat plein écran, lisible à 2 mètres (téléphone et borne). */
export function ResultatPleinEcran({ resultat, appareil, progression, pause, duree, onBasculer }) {
  const s = STYLES_RESULTAT[resultat.type];
  const t = TAILLES_RESULTAT[appareil === 'TABLETTE' ? 'TABLETTE' : 'TELEPHONE'];
  return (
    <div
      onClick={onBasculer}
      className={`absolute inset-0 z-20 flex animate-fade-in cursor-pointer flex-col text-blanc [animation-duration:.15s] ${s.fond}`}
    >
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center" style={{ gap: t.gap }}>
        <div
          className="flex animate-pop items-center justify-center rounded-full bg-blanc-18"
          style={{ width: t.icone, height: t.icone, fontSize: t.iconeF }}
        >
          <Icon nom={s.icone} />
        </div>
        <div className="max-w-[90%] font-semibold leading-[1.2] [text-wrap:balance]" style={{ fontSize: t.titre }}>
          {resultat.titre}
        </div>
        {resultat.nom && (
          <div
            className="max-w-[95%] font-bold leading-[1.02] tracking-[-0.03em] [text-wrap:balance]"
            style={{ fontSize: t.nom }}
          >
            {resultat.nom}
          </div>
        )}
        <div className="max-w-[560px] leading-[1.45]" style={{ fontSize: t.meta }}>
          {resultat.meta}
        </div>
        {resultat.note && (
          <span
            className="inline-flex min-h-9 items-center gap-2 rounded-full bg-blanc-18 px-3.5 py-1 font-medium"
            style={{ fontSize: t.note }}
          >
            <Icon nom="mail" className="text-[18px]" />
            {resultat.note}
          </span>
        )}
      </div>
      <div className="px-6 pb-7">
        <BarreProgression progression={progression} pause={pause} duree={duree} taille={t.cd} />
      </div>
    </div>
  );
}

/** Résultat dans le panneau de l'ordinateur (S12). */
export function ResultatPanneau({ resultat, progression, pause, duree, onBasculer }) {
  const s = STYLES_RESULTAT[resultat.type];
  return (
    <div
      onClick={onBasculer}
      className={`flex min-h-[240px] flex-1 animate-in-up cursor-pointer flex-col gap-3 rounded-[12px] p-8 text-blanc [animation-duration:.2s] ${s.fond}`}
    >
      <div className="flex items-center gap-3.5">
        <span className="flex h-14 w-14 animate-pop items-center justify-center rounded-full bg-blanc-18 text-[30px]">
          <Icon nom={s.icone} />
        </span>
        <span className="text-[26px] font-semibold">{resultat.titre}</span>
      </div>
      {resultat.nom && <div className="text-[56px] font-bold leading-[1.05] tracking-[-0.03em]">{resultat.nom}</div>}
      <div className="text-[19px]">{resultat.meta}</div>
      {resultat.note && (
        <span className="inline-flex h-[34px] items-center gap-2 self-start rounded-full bg-blanc-18 px-3 text-[15px] font-medium">
          <Icon nom="mail" className="text-[16px]" />
          {resultat.note}
        </span>
      )}
      <div className="mt-auto">
        <BarreProgression progression={progression} pause={pause} duree={duree} taille={14} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Badges graphite */
export const BADGES_HISTORIQUE = {
  PRESENT: ['bg-g-succes-badge text-g-succes-clair', 'check', 'Présent'],
  DEJA_EMARGE: ['bg-g-avert-badge text-g-avert-clair', 'alert', 'Déjà émargé'],
  CODE_INVALIDE: ['bg-g-erreur-badge text-g-erreur-clair', 'xCircle', 'Invalide'],
  AUTRE_EVENEMENT: ['bg-g-erreur-badge text-g-erreur-clair', 'xCircle', 'Autre événement'],
  ANNULE: ['bg-g-eleve text-g-texte', 'undo', 'Annulé'],
  HORS_LIGNE: ['bg-g-avert-badge text-g-avert-clair', 'clock', 'En attente de synchronisation'],
};

export function BadgeGraphite({ type, children, className = '' }) {
  const [cls, icone, label] = BADGES_HISTORIQUE[type] || BADGES_HISTORIQUE.PRESENT;
  return (
    <span
      className={`inline-flex h-[26px] items-center gap-[5px] whitespace-nowrap rounded-full px-[9px] text-[12px] font-semibold ${cls} ${className}`}
    >
      <Icon nom={icone} className="text-[12px]" />
      {children || label}
    </span>
  );
}

/* ------------------------------------------------------------------ En-tête secondaire (code, recherche) */
export function BarreRetour({ titre, onRetour }) {
  return (
    <div className="flex items-center gap-2 border-b border-g-bordure bg-g-surface px-3 py-2.5">
      <button
        type="button"
        onClick={onRetour}
        aria-label="Retour"
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-moyen border-0 bg-transparent text-[22px] text-g-texte"
      >
        <Icon nom="arrowL" />
      </button>
      <h1 className="m-0 text-[17px] font-semibold">{titre}</h1>
    </div>
  );
}

/* ------------------------------------------------------------------ S5 · Code à 4 chiffres */
export function VueCode({ chiffres, onTouche, onRetour, borne }) {
  const K = borne
    ? { box: 88, boxH: 104, digit: 48, key: 120, keyH: 84, keyF: 32 }
    : { box: 64, boxH: 76, digit: 36, key: 96, keyH: 64, keyF: 26 };
  const touches = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
  return (
    <div className="flex min-h-0 flex-1 flex-col border-t-[6px] border-p">
      <BarreRetour titre="Code à 4 chiffres" onRetour={onRetour} />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-5 py-6">
        <p className="m-0 max-w-[340px] text-center text-[16px] text-g-texte-2">
          {borne
            ? 'Le code figure dans votre email d’invitation, sous le QR code.'
            : 'Le code figure dans l’email d’invitation, sous le QR code.'}
        </p>
        <div className="flex gap-3" aria-live="polite" aria-label={`${chiffres.length} chiffre(s) saisi(s) sur 4`}>
          {[0, 1, 2, 3].map((k) => (
            <div
              key={k}
              className="flex items-center justify-center rounded-[12px] border-2 bg-g-surface font-bold tabular-nums transition-colors"
              style={{
                width: K.box,
                height: K.boxH,
                fontSize: K.digit,
                borderColor: k === chiffres.length ? 'var(--s)' : chiffres[k] ? 'var(--champ)' : 'var(--g-bordure)',
              }}
            >
              {chiffres[k] || ''}
            </div>
          ))}
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(3, ${K.key}px)` }}>
          {touches.map((t) => {
            const ok = t === 'ok' && chiffres.length === 4;
            return (
              <button
                key={t}
                type="button"
                onClick={() => onTouche(t)}
                aria-label={t === 'del' ? 'Effacer' : t === 'ok' ? 'Valider' : t}
                className={`flex cursor-pointer items-center justify-center rounded-[12px] border border-g-bordure font-semibold transition-[transform,background] duration-75 active:scale-95 ${ok ? 'bg-p text-op' : 'bg-g-surface text-g-texte'}`}
                style={{ height: K.keyH, fontSize: K.keyF }}
              >
                {t === 'del' ? <Icon nom="backspace" /> : t === 'ok' ? <Icon nom="check" /> : t}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ S6 · Recherche par nom */
export function VueRecherche({ q, onQ, resultats, total, chargement, onEmarger, onRetour, borne, enCours }) {
  const court = borne && q.trim().length < 3;
  return (
    <div className="flex min-h-0 flex-1 flex-col border-t-[6px] border-p">
      <div className="flex flex-col gap-3 border-b border-g-bordure bg-g-surface px-4 pb-4 pt-2.5">
        <div className="-ml-1 flex items-center gap-2">
          <button
            type="button"
            onClick={onRetour}
            aria-label="Retour"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-moyen border-0 bg-transparent text-[22px] text-g-texte"
          >
            <Icon nom="arrowL" />
          </button>
          <h1 className="m-0 text-[17px] font-semibold">{borne ? 'Rechercher mon nom' : 'Recherche par nom'}</h1>
        </div>
        <div
          data-fw="1"
          className="flex h-[52px] items-center gap-2.5 rounded-moyen border border-texte-2 bg-g-fond px-3.5"
        >
          <Icon nom="search" className="text-[20px] text-g-texte-2" />
          <input
            aria-label={borne ? 'Votre nom ou prénom' : 'Nom, prénom ou email'}
            value={q}
            onChange={(e) => onQ(e.target.value)}
            placeholder={borne ? 'Votre nom ou prénom' : 'Nom, prénom ou email'}
            autoFocus
            className="min-w-0 flex-1 border-0 bg-transparent text-[17px] text-g-texte outline-none"
          />
        </div>
      </div>
      <div className="mx-auto w-full max-w-[760px] flex-1 overflow-y-auto">
        <p className="m-0 px-4 pb-1 pt-3 text-[14px] text-g-texte-2" aria-live="polite">
          {court
            ? 'Saisissez au moins 3 lettres de votre nom.'
            : chargement
              ? 'Recherche…'
              : q.trim()
                ? `${total} ${total > 1 ? 'résultats' : 'résultat'}`
                : `Tous les invités · ${total}`}
        </p>
        {!court && !chargement && total === 0 && (
          <div className="flex flex-col items-center gap-2.5 px-6 py-12 text-center">
            <Icon nom="search" className="text-[36px] text-g-texte-2" />
            <span className="text-[17px] font-semibold">Aucun invité trouvé</span>
            <span className="max-w-[300px] text-[15px] text-g-texte-2">
              {borne
                ? 'Vérifiez l’orthographe ou adressez-vous à l’accueil.'
                : 'Vérifiez l’orthographe ou essayez avec l’adresse email.'}
            </span>
          </div>
        )}
        {!court &&
          resultats.map((r) => (
            <div key={r.id} className="flex items-center gap-3 border-b border-g-surface px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[16px] font-semibold">{r.nomComplet}</span>
                <span className="truncate text-[14px] text-g-texte-2">
                  {borne ? r.entreprise || 'Particulier' : `${r.entreprise || 'Particulier'} · ${r.email}`}
                </span>
              </div>
              {r.statut === 'PRESENT' ? (
                <BadgeGraphite type="PRESENT" className="!h-7 !px-2.5 !text-[13px]">
                  Présent · {r.heure}
                </BadgeGraphite>
              ) : (
                <>
                  <span className="hidden h-7 items-center gap-1.5 rounded-full bg-g-eleve px-2.5 text-[13px] font-medium sm:inline-flex">
                    <span className="h-[7px] w-[7px] rounded-full bg-g-texte-2" />
                    Inscrit
                  </span>
                  <button
                    type="button"
                    onClick={() => onEmarger(r)}
                    disabled={enCours}
                    className="btn-principal h-11 cursor-pointer rounded-moyen border-0 px-4 text-[15px] font-semibold active:scale-[.96] disabled:opacity-60"
                  >
                    {borne ? 'C’est moi' : 'Émarger'}
                  </button>
                </>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ S9 · États de la caméra */
export function VueEtatCamera({ etat, onAutoriser, onCode, onRecherche, onDouchette }) {
  const ETATS = {
    autorisation: {
      icone: 'camera',
      tuile: 'bg-g-eleve text-g-texte',
      titre: 'Autoriser l’accès à la caméra',
      texte: 'La caméra lit les QR codes automatiquement. Aucune image n’est enregistrée.',
      actions: [
        { label: 'Autoriser la caméra', icone: 'camera', principal: true, onClick: onAutoriser },
        { label: 'Saisir un code à 4 chiffres', icone: 'hash', onClick: onCode },
      ],
    },
    refus: {
      icone: 'cameraOff',
      tuile: 'bg-g-avert-tuile text-g-avert-clair',
      titre: 'Accès à la caméra refusé',
      texte:
        'Ouvrez les réglages du navigateur, autorisez la caméra pour ce site, puis réessayez. En attendant, utilisez le code ou la recherche.',
      actions: [
        { label: 'Réessayer', icone: 'refresh', principal: true, onClick: onAutoriser },
        { label: 'Code à 4 chiffres', icone: 'hash', onClick: onCode },
        { label: 'Recherche par nom', icone: 'search', onClick: onRecherche },
      ],
    },
    aucune: {
      icone: 'cameraOff',
      tuile: 'bg-g-eleve text-g-texte',
      titre: 'Aucune caméra détectée',
      texte: 'Branchez une douchette ou poursuivez avec le code à 4 chiffres et la recherche par nom.',
      actions: [
        { label: 'Passer en mode Douchette', icone: 'barcode', principal: true, onClick: onDouchette },
        { label: 'Code à 4 chiffres', icone: 'hash', onClick: onCode },
      ],
    },
    occupee: {
      icone: 'cameraOff',
      tuile: 'bg-g-avert-tuile text-g-avert-clair',
      titre: 'Caméra déjà utilisée',
      texte:
        'Une autre application ou un autre onglet utilise la caméra. Fermez-le puis réessayez, ou poursuivez avec le code.',
      actions: [
        { label: 'Réessayer', icone: 'refresh', principal: true, onClick: onAutoriser },
        { label: 'Code à 4 chiffres', icone: 'hash', onClick: onCode },
      ],
    },
    erreur: {
      icone: 'cameraOff',
      tuile: 'bg-g-avert-tuile text-g-avert-clair',
      titre: 'La caméra n’a pas pu démarrer',
      texte: 'Réessayez ou poursuivez avec le code à 4 chiffres et la recherche par nom.',
      actions: [
        { label: 'Réessayer', icone: 'refresh', principal: true, onClick: onAutoriser },
        { label: 'Code à 4 chiffres', icone: 'hash', onClick: onCode },
      ],
    },
  };
  const e = ETATS[etat];
  if (!e) return null;
  return (
    <div className="flex flex-1 flex-col border-t-[6px] border-p">
      <div className="flex flex-1 animate-in-up flex-col items-center justify-center gap-4 px-6 py-8 text-center">
        <div className={`flex h-[72px] w-[72px] items-center justify-center rounded-carte text-[34px] ${e.tuile}`}>
          <Icon nom={e.icone} />
        </div>
        <h2 className="m-0 max-w-[360px] text-[24px] font-bold tracking-[-0.02em]">{e.titre}</h2>
        <p className="m-0 max-w-[340px] text-[16px] leading-[1.55] text-g-texte-2">{e.texte}</p>
        <div className="mt-2 flex w-full max-w-[340px] flex-col gap-2.5">
          {e.actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              className={`flex h-[52px] cursor-pointer items-center justify-center gap-2.5 rounded-[12px] text-[16px] font-semibold ${a.principal ? 'border-0 bg-p text-op' : 'border border-g-bordure bg-transparent text-g-texte'}`}
            >
              <Icon nom={a.icone} className="text-[20px]" />
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Feuilles (S7, S8) */
function Feuille({ label, onFermer, children }) {
  const ref = useRef(null);
  useFocusTrap(ref, true, onFermer);
  return (
    <div
      className="absolute inset-0 z-30 flex animate-fade-in items-end justify-center bg-voile-scan"
      onClick={onFermer}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="box-border flex w-full max-w-[520px] animate-sheet flex-col gap-5 rounded-t-carte border border-b-0 border-g-bordure bg-g-surface px-5 pb-7 pt-6 shadow-feuille outline-none"
      >
        {children}
      </div>
    </div>
  );
}

export function FeuilleAnnulation({ dernier, enCours, onAnnuler, onFermer }) {
  return (
    <Feuille label="Annuler le dernier émargement" onFermer={onFermer}>
      <div className="h-1 w-10 self-center rounded-sm bg-g-bordure" />
      <h2 className="m-0 text-[20px] font-bold tracking-[-0.01em]">Annuler le dernier émargement ?</h2>
      {dernier ? (
        <>
          <div className="flex items-center gap-3 rounded-[12px] border border-g-bordure bg-g-fond px-4 py-3.5">
            <Icon nom="userCheck" className="text-[22px] text-g-succes-clair" />
            <div className="min-w-0 flex-1">
              <div className="text-[16px] font-semibold">{dernier.nom}</div>
              <div className="text-[14px] text-g-texte-2">
                {dernier.heure} · {dernier.mode}
              </div>
            </div>
          </div>
          <p className="m-0 text-[15px] leading-[1.5] text-g-texte-2">
            L’invité repassera au statut « Inscrit ». L’email n°2 déjà envoyé ne sera pas rappelé.
          </p>
          <button
            type="button"
            onClick={onAnnuler}
            disabled={enCours}
            className="flex h-[52px] cursor-pointer items-center justify-center gap-2.5 rounded-[12px] border-0 bg-erreur text-[16px] font-semibold text-blanc disabled:opacity-60"
          >
            <Icon nom="undo" className="text-[20px]" />
            Annuler l’émargement
          </button>
        </>
      ) : (
        <p className="m-0 text-[15px] text-g-texte-2">Aucun émargement récent à annuler.</p>
      )}
      <button
        type="button"
        onClick={onFermer}
        data-autofocus
        className="h-[52px] cursor-pointer rounded-[12px] border border-g-bordure bg-transparent text-[16px] font-semibold text-g-texte"
      >
        Fermer
      </button>
    </Feuille>
  );
}

export function FeuilleReglages({
  duree,
  onDuree,
  son,
  onSon,
  vibration,
  onVibration,
  onChanger,
  onAnnulation,
  onFermer,
}) {
  return (
    <Feuille label="Réglages du scan" onFermer={onFermer}>
      <h2 className="m-0 text-[20px] font-bold">Réglages du scan</h2>
      <div className="flex flex-col gap-2">
        <span id="duree-label" className="text-[15px] font-medium">
          Durée d’affichage du résultat
        </span>
        <Segmente
          variante="graphite"
          grille
          labelledBy="duree-label"
          valeur={duree}
          onChange={onDuree}
          options={[2, 3, 5].map((d) => ({ value: d, label: `${d} s` }))}
        />
      </div>
      <div className="flex flex-col">
        <Interrupteur actif={son} onChange={onSon} label="Son au scan" univers="graphite" />
        <Interrupteur actif={vibration} onChange={onVibration} label="Vibration au scan" univers="graphite" />
      </div>
      <button
        type="button"
        onClick={onChanger}
        className="flex h-[52px] cursor-pointer items-center justify-center gap-2.5 rounded-[12px] border border-g-bordure bg-transparent text-[16px] font-semibold text-g-texte"
      >
        <Icon nom="switchCam" className="text-[20px]" />
        Changer d’événement ou de mode
      </button>
      <button
        type="button"
        onClick={onAnnulation}
        className="flex h-[52px] cursor-pointer items-center justify-center gap-2.5 rounded-[12px] border border-g-bordure bg-transparent text-[16px] font-semibold text-g-texte"
      >
        <Icon nom="undo" className="text-[20px]" />
        Annuler le dernier émargement
      </button>
    </Feuille>
  );
}

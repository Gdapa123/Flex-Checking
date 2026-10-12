import { useState } from 'react';
import Bouton from './Bouton';
import Icon from './Icon';

/** Message d'échec de chargement : distingue la saturation (503) d'une coupure réseau ou d'une panne serveur. */
export function messageChargement(e) {
  if (!e) return 'Le chargement a échoué.';
  if (e.status === 503) return 'Service momentanément saturé, réessayez dans une minute.';
  if (e.status === 429) return 'Trop de requêtes. Patientez un instant puis réessayez.';
  if (e.status === 403) return 'Vous n’avez pas accès à ces informations.';
  if (e.status === 0 || e instanceof TypeError || !e.status)
    return 'Connexion au serveur impossible. Vérifiez le réseau.';
  return 'Le chargement a échoué. Réessayez.';
}

/**
 * État d'erreur avec bouton « Réessayer ». `pleinePage` : écran entier (avant que le thème soit connu, palette MDE) ;
 * sinon carte insérée dans la page. `compact` : bandeau d'une ligne (données périmées toujours affichées).
 */
export default function EtatErreur({
  erreur,
  onReessayer,
  titre = 'Chargement impossible',
  texte,
  pleinePage = false,
  compact = false,
}) {
  const [enCours, setEnCours] = useState(false);
  const reessayer = async () => {
    if (!onReessayer || enCours) return;
    setEnCours(true);
    try {
      await onReessayer();
    } finally {
      setEnCours(false);
    }
  };
  const message = messageChargement(erreur);

  if (compact)
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-bloc border border-erreur-bord bg-erreur-doux px-3.5 py-2.5 text-[14px] text-erreur"
      >
        <Icon nom="alertCircle" className="text-[18px]" />
        <span className="min-w-0 flex-1">{message} Les données affichées peuvent ne pas être à jour.</span>
        {onReessayer && (
          <Bouton variante="destructif-doux" taille="sm" icone="refresh" chargement={enCours} onClick={reessayer}>
            Réessayer
          </Bouton>
        )}
      </div>
    );

  const carte = (
    <section
      role="alert"
      className={`flex flex-col items-center gap-3 rounded-carte border bg-surface px-6 py-8 text-center ${
        pleinePage ? 'border-mde-bordure shadow-carte-mde' : 'border-bordure-carte shadow-carte'
      }`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-erreur-doux text-[24px] text-erreur">
        <Icon nom="alertCircle" />
      </div>
      {pleinePage ? (
        <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em]">{titre}</h1>
      ) : (
        <h2 className="m-0 text-[19px] font-bold tracking-[-0.015em]">{titre}</h2>
      )}
      <p className={`m-0 max-w-[380px] text-[15px] leading-[1.55] ${pleinePage ? 'text-mde-texte-2' : 'text-texte-2'}`}>
        {texte && <>{texte} </>}
        {message}
      </p>
      {onReessayer && (
        <Bouton
          variante={pleinePage ? 'mde' : 'secondaire'}
          icone="refresh"
          chargement={enCours}
          onClick={reessayer}
          className="mt-1"
        >
          Réessayer
        </Bouton>
      )}
    </section>
  );
  if (!pleinePage) return carte;
  return (
    <main className="univers-mde flex min-h-[100dvh] items-center justify-center border-t-[6px] border-mde-bordeaux bg-mde-surface px-4 text-mde-texte">
      <div className="w-full max-w-[460px]">{carte}</div>
    </main>
  );
}

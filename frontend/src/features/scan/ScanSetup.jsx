import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMoi } from '../auth/useMoi';
import { dateCourte, nombre } from '../../lib/format';
import useTitre from '../../lib/useTitre';
import ThemeScope from '../../theme/ThemeScope';
import Icon from '../../components/ui/Icon';
import Logo from '../../components/ui/Logo';
import Segmente from '../../components/ui/Segmente';
import Squelette from '../../components/ui/Squelette';
import { debloquerAudio } from './retour';
import { APPAREILS, MODES_SCAN, POSTES_SUGGERES, ecrireReglages, lireReglages } from './reglages';
import { useEvenementsScan } from './useEvenementsScan';

/** S1 · Démarrer l'émargement : événement, poste, mode (mémorisés sur l'appareil). */
export default function ScanSetup() {
  useTitre('Démarrer l’émargement');
  const naviguer = useNavigate();
  const { data: moi } = useMoi();
  const { data: evenements, isLoading, error } = useEvenementsScan();
  const [r, setR] = useState(lireReglages);
  const choisi = evenements?.find((e) => e.id === r.evenementId) || evenements?.[0];

  useEffect(() => {
    if (evenements?.length === 1 && r.evenementId !== evenements[0].id)
      setR((x) => ({ ...x, evenementId: evenements[0].id }));
  }, [evenements, r.evenementId]);

  const demarrer = () => {
    if (!choisi) return;
    debloquerAudio();
    ecrireReglages({ ...r, evenementId: choisi.id, poste: r.poste.trim() || 'Accueil principal' });
    naviguer(`/scan/${choisi.id}`);
  };

  return (
    <ThemeScope
      tokens={choisi?.tokens}
      className="univers-scan fond-setup-scan flex min-h-[100dvh] flex-col text-g-texte"
    >
      <div className="mx-auto box-border flex w-full max-w-[560px] animate-in-up flex-col gap-7 px-5 py-6">
        <div className="flex items-center justify-between gap-3">
          <Logo variante="blanc" hauteur={36} />
          {moi && (
            <span className="text-[14px] text-g-texte-2">
              {moi.nom.split(' ')[0]} {moi.nom.split(' ')[1]?.[0] ? `${moi.nom.split(' ')[1][0]}.` : ''} · Hôte
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-[30px] font-bold tracking-[-0.028em]">Démarrer l’émargement</h1>
          <p className="m-0 text-[16px] text-g-texte-2">Choisissez la cérémonie, le poste puis le mode de lecture.</p>
        </div>

        <div role="radiogroup" aria-label="Événement" className="flex flex-col gap-2">
          <span className="text-[14px] font-semibold text-g-texte-2">Événement</span>
          {isLoading && [1, 2].map((k) => <Squelette key={k} className="h-16 !rounded-bouton opacity-20" />)}
          {error && (
            <p className="m-0 text-[15px] text-g-erreur-clair">
              Impossible de charger les événements. Vérifiez le réseau.
            </p>
          )}
          {evenements?.length === 0 && (
            <p className="m-0 rounded-bouton bg-g-surface p-4 text-[15px] text-g-texte-2">
              Aucune cérémonie à venir ne vous est affectée. Contactez la direction des événements.
            </p>
          )}
          {evenements?.map((e) => {
            const on = choisi?.id === e.id;
            return (
              <button
                key={e.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setR({ ...r, evenementId: e.id })}
                className={`box-border flex min-h-16 cursor-pointer items-center gap-3.5 rounded-bouton border-2 bg-g-surface px-4 py-3 text-left text-g-texte shadow-scan transition-colors ${on ? 'border-g-texte' : 'border-g-bordure'}`}
              >
                <span className="h-9 w-3 flex-none rounded" style={{ background: e.tokens.p }} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[16px] font-semibold">{e.nomAffiche}</span>
                  <span className="text-[14px] text-g-texte-2">
                    {dateCourte(e.date)} · {nombre(e.nbInscrits)} inscrits
                  </span>
                </span>
                <span
                  className={`flex h-6 w-6 flex-none items-center justify-center rounded-full border-2 text-[14px] text-g-fond ${on ? 'border-g-texte bg-g-texte' : 'border-texte-2'}`}
                >
                  {on && <Icon nom="check" />}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="poste" className="text-[14px] font-semibold text-g-texte-2">
            Poste
          </label>
          <div
            data-fw="1"
            className="flex h-[52px] items-center gap-2.5 rounded-moyen border border-texte-2 bg-g-fond px-3.5"
          >
            <Icon nom="monitor" className="text-[20px] text-g-texte-2" />
            <input
              id="poste"
              value={r.poste}
              maxLength={60}
              autoComplete="off"
              onChange={(e) => setR({ ...r, poste: e.target.value })}
              placeholder="Accueil principal"
              aria-describedby="postes-suggeres"
              className="min-w-0 flex-1 border-0 bg-transparent text-[17px] text-g-texte outline-none placeholder:text-g-texte-2"
            />
          </div>
          {/* Suggestions intégrées (la liste native du navigateur s'affiche en blanc, hors du thème) */}
          <div id="postes-suggeres" role="group" aria-label="Postes suggérés" className="flex flex-wrap gap-2">
            {POSTES_SUGGERES.map((p) => {
              const on = r.poste.trim() === p;
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setR({ ...r, poste: p })}
                  className={`h-9 cursor-pointer rounded-full border px-3.5 text-[14px] font-medium ${on ? 'border-g-texte bg-g-texte text-g-fond' : 'border-texte-2 bg-transparent text-g-texte-2 hover:text-g-texte'}`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        <div role="radiogroup" aria-label="Mode d’émargement" className="flex flex-col gap-2">
          <span className="text-[14px] font-semibold text-g-texte-2">Mode d’émargement</span>
          <div className="grid grid-cols-2 gap-2">
            {MODES_SCAN.map((m) => {
              const on = r.mode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setR({ ...r, mode: m.value })}
                  className={`box-border flex min-h-[88px] cursor-pointer flex-col gap-2.5 rounded-[12px] border-2 bg-g-surface px-4 py-3.5 text-left text-g-texte ${on ? 'border-g-texte' : 'border-g-bordure'}`}
                >
                  <span className={`text-[22px] ${on ? 'text-s' : 'text-g-texte-2'}`}>
                    <Icon nom={m.icone} />
                  </span>
                  <span className="text-[15px] font-semibold">{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span id="appareil-label" className="text-[14px] font-semibold text-g-texte-2">
            Disposition de l’écran
          </span>
          <Segmente
            variante="graphite"
            labelledBy="appareil-label"
            grille
            taille="sm"
            valeur={r.appareil}
            onChange={(a) => setR({ ...r, appareil: a })}
            options={APPAREILS}
          />
        </div>

        <button
          type="button"
          onClick={demarrer}
          disabled={!choisi}
          className="btn-principal flex h-14 cursor-pointer items-center justify-center gap-2.5 rounded-[12px] border-0 text-[17px] font-semibold active:scale-[.98] disabled:opacity-50"
        >
          <Icon nom="scan" className="text-[20px]" />
          Démarrer l’émargement
        </button>
      </div>
    </ThemeScope>
  );
}

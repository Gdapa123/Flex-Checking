import { useEffect, useRef } from 'react';
import Icon from '../../components/ui/Icon';
import { dateLongue } from '../../lib/format';

/**
 * Écran d'accueil du lien d'inscription : explique les étapes avant de commencer.
 * L'étape « magazine » n'apparaît que si le programme envoie l'email n°2.
 */
export default function Presentation({ ev, onCommencer }) {
  const titre = useRef(null);
  useEffect(() => {
    titre.current?.focus({ preventScroll: true });
  }, []);

  const etapes = [
    {
      icone: 'qr',
      titre: 'Je m’inscris',
      texte:
        'Je remplis le formulaire en une minute et je reçois aussitôt par email mon QR code et mon code à 4 chiffres.',
    },
    {
      icone: 'scan',
      titre: 'Le jour de la graduation',
      texte:
        'Je présente mon QR code à l’accueil : il est scanné en une seconde. Le code à 4 chiffres sert de secours.',
    },
    ...(ev.magazineActif
      ? [
          {
            icone: 'book',
            titre: 'Je reçois le magazine',
            texte: `Une fois ma présence enregistrée, je reçois par email le lien du magazine de la ${ev.nomAffiche}.`,
          },
        ]
      : []),
  ];

  return (
    <>
      <main className="relative mx-auto -mt-8 flex w-full max-w-[560px] flex-1 flex-col px-3 pb-2 sm:-mt-10 sm:pb-8">
        <section
          aria-labelledby="titre-etapes"
          className="flex animate-in-up flex-col gap-4 rounded-carte border border-bordure-carte bg-surface px-4 py-5 shadow-carte sm:gap-5 sm:px-6 sm:py-7"
        >
          <div className="flex flex-col gap-1">
            <h2
              id="titre-etapes"
              ref={titre}
              tabIndex={-1}
              className="m-0 text-[17px] font-semibold tracking-[-0.01em] outline-none sm:text-[20px]"
            >
              Comment ça se passe ?
            </h2>
            <p className="m-0 text-[13px] text-texte-2 sm:text-[15px]">
              {etapes.length} étapes simples, de l’inscription au jour J.
            </p>
          </div>
          <ol className="m-0 flex list-none flex-col p-0">
            {etapes.map((e, i) => {
              const derniere = i === etapes.length - 1;
              return (
                <li key={e.titre} className="flex gap-3.5">
                  <div className="flex flex-col items-center">
                    <span className="btn-principal flex h-9 w-9 flex-none items-center justify-center rounded-full text-[15px] font-bold">
                      {i + 1}
                    </span>
                    {!derniere && <span aria-hidden="true" className="my-1 w-0.5 flex-1 rounded-full bg-ps" />}
                  </div>
                  <div className={`flex min-w-0 flex-col gap-1 pt-1.5 ${derniere ? '' : 'pb-4 sm:pb-5'}`}>
                    <span className="flex items-center gap-2 text-[15px] font-semibold sm:text-[16px]">
                      <Icon nom={e.icone} className="text-[17px] text-p" />
                      {e.titre}
                    </span>
                    <span className="text-[13.5px] leading-[1.5] text-texte-2 sm:text-[15px]">{e.texte}</span>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="m-0 flex items-start gap-2 rounded-moyen bg-fond px-3 py-2.5 text-[12.5px] leading-[1.45] text-texte-3 sm:text-[14px]">
            <Icon nom="clock" className="mt-0.5 text-[15px] text-texte-2" />
            <span>
              Inscriptions ouvertes jusqu’au {dateLongue(ev.dateLimiteInscription, false)}, dans la limite des places
              disponibles.
            </span>
          </p>
        </section>
      </main>

      <div className="sticky bottom-0 z-10 -mt-7 bg-gradient-to-b from-transparent via-fond via-45% to-fond px-4 pb-3 pt-5 sm:pb-4 sm:pt-6">
        <div className="mx-auto max-w-[560px]">
          <button
            type="button"
            onClick={onCommencer}
            className="btn-principal flex h-[52px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-bouton border-0 pl-5 pr-2 text-[16px] font-semibold active:scale-[.98] sm:h-14"
          >
            <span className="flex-1 text-left">Commencer mon inscription</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-moyen bg-blanc-18 text-[18px]">
              <Icon nom="arrowR" />
            </span>
          </button>
        </div>
      </div>
    </>
  );
}

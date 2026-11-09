import { useId, useState } from 'react';
import Icon from '../../components/ui/Icon';

/**
 * Guide « Comment ça se passe ? » au-dessus du formulaire d'inscription, replié par défaut : le formulaire est
 * visible dès l'ouverture du lien. L'étape « magazine » n'apparaît que si la cérémonie envoie l'email n°2.
 */
export default function Presentation({ ev }) {
  const [ouvert, setOuvert] = useState(false);
  const idContenu = useId();

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
      texte: 'Je présente mon QR code à l’accueil : il est scanné rapidement. Le code à 4 chiffres sert de secours.',
    },
    ...(ev.magazineActif
      ? [
          {
            icone: 'book',
            titre: 'Je reçois le magazine',
            texte: `Une fois ma présence enregistrée, je reçois par email le lien du magazine de la promotion ${ev.nomAffiche.replace(/^Graduation\s+/i, '')}.`,
          },
        ]
      : []),
  ];

  return (
    <section className="animate-in-up overflow-hidden rounded-carte border border-bordure-carte bg-surface shadow-carte">
      <h2 className="m-0">
        <button
          type="button"
          aria-expanded={ouvert}
          aria-controls={idContenu}
          onClick={() => setOuvert((v) => !v)}
          className="flex min-h-12 w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-4 py-3 text-left sm:px-5"
        >
          <Icon nom="info" className="flex-none text-[18px] text-p" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15px] font-semibold tracking-[-0.01em] text-texte sm:text-[17px]">
              Comment ça se passe ?
            </span>
            <span className="text-[12.5px] font-normal text-texte-2 sm:text-[14px]">
              {etapes.length} étapes, de l’inscription au jour J
            </span>
          </span>
          <Icon nom={ouvert ? 'chevU' : 'chevD'} className="flex-none text-[18px] text-texte-2" />
        </button>
      </h2>
      {ouvert && (
        <div id={idContenu} className="flex flex-col gap-4 border-t border-bordure-carte px-4 py-4 sm:px-5 sm:py-5">
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
            <span>Inscriptions ouvertes jusqu’au jour de la cérémonie, dans la limite des places disponibles.</span>
          </p>
        </div>
      )}
    </section>
  );
}

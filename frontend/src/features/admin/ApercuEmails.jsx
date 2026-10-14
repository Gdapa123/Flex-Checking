import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import Badge from '../../components/ui/Badge';
import Carte from '../../components/ui/Carte';
import Icon from '../../components/ui/Icon';
import Squelette from '../../components/ui/Squelette';
import EtatErreur from '../../components/ui/EtatErreur';

const EMAILS = [
  {
    cle: 'INVITATION',
    numero: 'Email n°1',
    nom: 'Invitation',
    icone: 'mail',
    moment: 'Envoyé à l’inscription',
    statut: ['INSCRIT', 'Inscrit'],
  },
  {
    cle: 'MAGAZINE',
    numero: 'Email n°2',
    nom: 'Magazine',
    icone: 'book',
    moment: 'Envoyé à l’arrivée sur place',
    statut: ['PRESENT', 'Présent'],
  },
];

/** A7 · Aperçu en lecture seule des deux emails du programme. */
export default function ApercuEmails({ ev }) {
  const { data, error, refetch } = useQuery({
    queryKey: ['apercu-emails', ev.id],
    queryFn: () => api.get(`/evenements/${ev.id}/apercu-emails/`),
  });
  if (error) return <EtatErreur titre="Aperçu indisponible" erreur={error} onReessayer={() => refetch()} />;
  const magazineActif = ev.magazineActif !== false;
  return (
    <div className="grid items-start gap-6 min-[1240px]:grid-cols-2">
      {EMAILS.map((e) =>
        e.cle === 'MAGAZINE' && !magazineActif ? (
          <Carte
            key={e.cle}
            as="section"
            aria-label={`${e.numero} · ${e.nom}`}
            className="flex flex-col gap-4 p-5 sm:p-6"
          >
            <EnteteEmail email={e} />
            <p className="m-0 rounded-champ bg-subtil p-4 text-[15px] leading-relaxed text-texte-3">
              Le magazine est désactivé pour ce programme : seul l’email d’invitation est envoyé.
            </p>
          </Carte>
        ) : (
          <Carte
            key={e.cle}
            as="section"
            aria-label={`${e.numero} · ${e.nom}`}
            className="flex min-w-0 flex-col overflow-hidden"
          >
            <div className="flex flex-col gap-4 p-5 sm:p-6">
              <EnteteEmail email={e} />
              <div className="flex flex-col gap-1 rounded-champ bg-subtil px-4 py-3">
                <span className="text-[12px] font-semibold uppercase tracking-[.06em] text-texte-2">Objet</span>
                <div className="text-[15px] font-semibold leading-snug text-texte">
                  {data ? data[e.cle].objet : <Squelette className="h-5 w-3/4" />}
                </div>
              </div>
            </div>
            <div className="border-t border-bordure-carte bg-fond p-3 sm:p-5">
              {data ? (
                <iframe
                  title={`Aperçu · ${e.numero} · ${e.nom}`}
                  srcDoc={data[e.cle].html}
                  sandbox=""
                  className="mx-auto block h-[1000px] w-full max-w-[640px] rounded-moyen border border-bordure-carte bg-surface"
                />
              ) : (
                <Squelette className="mx-auto h-[900px] max-w-[640px] !rounded-moyen" />
              )}
            </div>
          </Carte>
        ),
      )}
    </div>
  );
}

function EnteteEmail({ email }) {
  return (
    <div className="flex items-start gap-4">
      <span className="flex h-12 w-12 flex-none items-center justify-center rounded-champ bg-p text-[22px] text-white">
        <Icon nom={email.icone} />
      </span>
      <div className="flex min-w-0 flex-col gap-2">
        <h2 className="m-0 flex flex-wrap items-baseline gap-x-2 text-[19px] font-bold leading-tight tracking-[-0.01em]">
          {email.nom}
          <span className="text-[14px] font-semibold text-texte-2">{email.numero}</span>
        </h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[14px] text-texte-3">
          <span className="inline-flex items-center gap-1.5">
            <Icon nom="clock" className="text-[15px] text-texte-2" />
            {email.moment}
          </span>
          <span className="inline-flex items-center gap-1.5">
            statut
            <Badge type={email.statut[0]} taille="sm">
              {email.statut[1]}
            </Badge>
          </span>
        </div>
      </div>
    </div>
  );
}

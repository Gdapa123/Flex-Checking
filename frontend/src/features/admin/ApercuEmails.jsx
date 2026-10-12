import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import Carte from '../../components/ui/Carte';
import Squelette from '../../components/ui/Squelette';
import EtatErreur from '../../components/ui/EtatErreur';

/** A7 · Aperçu en lecture seule des deux emails du programme. */
export default function ApercuEmails({ ev }) {
  const { data, error, refetch } = useQuery({
    queryKey: ['apercu-emails', ev.id],
    queryFn: () => api.get(`/evenements/${ev.id}/apercu-emails/`),
  });
  if (error) return <EtatErreur titre="Aperçu indisponible" erreur={error} onReessayer={() => refetch()} />;
  const emails = [['INVITATION', 'Email n°1 · à l’inscription · statut « Inscrit »']];
  if (ev.magazineActif !== false) emails.push(['MAGAZINE', 'Email n°2 · sur place · statut « Présent »']);
  return (
    <div className="flex flex-wrap items-start justify-center gap-8">
      {ev.magazineActif === false && (
        <Carte className="w-full p-5 text-[15px] text-texte-2">
          L’email n°2 (magazine) est désactivé pour ce programme : seuls les emails d’invitation sont envoyés.
        </Carte>
      )}
      {emails.map(([cle, titre]) => (
        <section key={cle} className="flex w-[600px] max-w-full flex-col gap-3" aria-label={titre}>
          <div className="flex flex-col gap-0.5 px-1">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[.04em] text-texte-2">{titre}</span>
            <span className="text-[15px] font-semibold">Objet : {data?.[cle].objet || '…'}</span>
          </div>
          {data ? (
            <iframe
              title={titre}
              srcDoc={data[cle].html}
              sandbox=""
              className="h-[1100px] w-full rounded-carte border border-bordure-carte bg-subtil shadow-carte"
            />
          ) : (
            <Squelette className="h-[900px] !rounded-carte" />
          )}
        </section>
      ))}
    </div>
  );
}

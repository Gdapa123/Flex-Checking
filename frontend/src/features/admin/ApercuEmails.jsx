import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import Carte from '../../components/ui/Carte';
import Squelette from '../../components/ui/Squelette';

/** A7 · Aperçu en lecture seule des deux emails du programme. */
export default function ApercuEmails({ ev }) {
  const { data, error } = useQuery({
    queryKey: ['apercu-emails', ev.id],
    queryFn: () => api.get(`/evenements/${ev.id}/apercu-emails/`),
  });
  if (error) return <Carte className="p-6 text-erreur">Aperçu indisponible.</Carte>;
  return (
    <div className="flex flex-wrap items-start justify-center gap-8">
      {[
        ['INVITATION', 'Email n°1 · à l’inscription · statut « Inscrit »'],
        ['MAGAZINE', 'Email n°2 · sur place · statut « Présent »'],
      ].map(([cle, titre]) => (
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

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, messageErreur } from '../../lib/api';
import { jourHeure, MODES } from '../../lib/format';
import { useSecours } from '../../lib/tempsReel';
import { erreursParChamp, formaterTelephone, schemaInvite } from '../../lib/schemas';
import Bouton from '../../components/ui/Bouton';
import Champ from '../../components/ui/Champ';
import Icon from '../../components/ui/Icon';
import PanneauLateral from '../../components/ui/PanneauLateral';
import Segmente from '../../components/ui/Segmente';
import Spinner from '../../components/ui/Spinner';
import Squelette from '../../components/ui/Squelette';
import { useToast } from '../../components/ui/Toasts';
import { BadgeStatut } from './badges';
import { BoutonPresence } from './GestionInvites';

const ICONES_HISTO = {
  INSCRIPTION: ['file', 'ok'],
  EMAIL_ENVOYE: ['mail', 'ok'],
  EMAIL_EN_ATTENTE: ['clock', 'attente'],
  EMAIL_ECHEC: ['alert', 'avert'],
  EMARGEMENT: ['userCheck', 'ok'],
  ANNULATION: ['undo', 'erreur'],
  MODIFICATION: ['edit', 'neutre'],
};
const TONS = {
  ok: 'bg-succes-doux text-succes border-succes-doux',
  attente: 'bg-surface text-texte-2 border-champ-doux',
  avert: 'bg-avert-doux text-avert border-avert-doux',
  erreur: 'bg-erreur-doux text-erreur border-erreur-doux',
  neutre: 'bg-subtil text-texte border-subtil',
};

/** A5 · Fiche invité : actions, fiche (modifiable), QR et code, historique complet. */
export default function PanneauInvite({ id, onFermer, basculerPresence, invalider }) {
  const toast = useToast();
  const [edition, setEdition] = useState(null);
  const [erreurs, setErreurs] = useState({});
  const [envoi, setEnvoi] = useState(false);
  const secours = useSecours(5000);
  const {
    data: inv,
    refetch,
    error,
  } = useQuery({ queryKey: ['invite', id], queryFn: () => api.get(`/invites/${id}/`), refetchInterval: secours });
  const { data: histo, refetch: refetchHisto } = useQuery({
    queryKey: ['historique', id],
    queryFn: () => api.get(`/invites/${id}/historique/`),
    refetchInterval: secours,
  });
  const recharger = () => {
    refetch();
    refetchHisto();
    invalider();
  };

  const renvoyer = async () => {
    try {
      await api.post(`/invites/${id}/renvoi-email/`, { type: 'INVITATION' });
      toast(`Invitation renvoyée à ${inv.email}.`);
      recharger();
    } catch (e) {
      toast(messageErreur(e), 'erreur');
    }
  };

  const enregistrer = async () => {
    const r = schemaInvite.safeParse(edition);
    const er = erreursParChamp(r);
    setErreurs(er);
    if (Object.keys(er).length) return;
    setEnvoi(true);
    try {
      await api.patch(`/invites/${id}/`, edition);
      toast('Fiche mise à jour.');
      setEdition(null);
      recharger();
    } catch (e) {
      if (e.status === 400)
        setErreurs(Object.fromEntries(Object.entries(e.data).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
      else toast(messageErreur(e), 'erreur');
    } finally {
      setEnvoi(false);
    }
  };

  const champs = inv
    ? [
        ['Email', inv.email],
        ['Téléphone', inv.telephone],
        ['Entreprise', inv.entreprise || '—'],
        ['Fonction', inv.fonction || '—'],
        ['Événement', inv.evenementNom],
        ['Source', inv.source === 'MANUEL' ? 'Ajout manuel' : 'Formulaire'],
        ['Inscrit le', jourHeure(inv.inscritLe)],
        ['Présence', inv.presentLe ? `${jourHeure(inv.presentLe)} · ${MODES[inv.modeEmargement]}` : '—'],
      ]
    : [];

  return (
    <PanneauLateral ouvert label={inv ? `Fiche de ${inv.nomComplet}` : 'Fiche invité'} onFermer={onFermer}>
      <div className="flex items-start gap-3 border-b border-t-[6px] border-b-bordure border-t-p bg-gradient-to-b from-hd to-surface px-6 py-5">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {inv ? (
            <>
              <h2 className="m-0 text-[22px] font-bold tracking-[-0.02em]">{inv.nomComplet}</h2>
              <span className="self-start">
                <BadgeStatut statut={inv.statut} />
              </span>
            </>
          ) : (
            <Squelette className="h-7 w-2/3" />
          )}
        </div>
        <button
          type="button"
          onClick={onFermer}
          aria-label="Fermer"
          data-autofocus
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-moyen border-0 bg-transparent text-[22px] text-texte hover:bg-subtil"
        >
          <Icon nom="x" />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
        {error && (
          <p role="alert" className="m-0 text-erreur">
            Invité introuvable.
          </p>
        )}
        {inv && !edition && (
          <>
            <div className="flex flex-wrap gap-2">
              <BoutonPresence
                invite={inv}
                grand
                onClick={async () => {
                  await basculerPresence(inv);
                  recharger();
                }}
              />
              <Bouton variante="secondaire" icone="send" onClick={renvoyer} className="!border-champ">
                Renvoyer l’invitation
              </Bouton>
              <Bouton
                variante="fantome"
                icone="edit"
                onClick={() => {
                  setErreurs({});
                  setEdition({
                    civilite: inv.civilite,
                    nom: inv.nom,
                    prenom: inv.prenom,
                    email: inv.email,
                    telephone: inv.telephone.replace('+225 ', ''),
                    entreprise: inv.entreprise,
                    fonction: inv.fonction,
                  });
                }}
              >
                Modifier
              </Bouton>
            </div>
            <section className="flex flex-col gap-3" aria-labelledby="t-fiche">
              <h3 id="t-fiche" className="m-0 text-[15px] font-semibold">
                Fiche
              </h3>
              <dl className="m-0 grid grid-cols-[120px_1fr] gap-x-4 gap-y-2.5 text-[15px]">
                {champs.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-texte-2">{k}</dt>
                    <dd className="m-0 min-w-0 [overflow-wrap:anywhere] tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section
              className="flex items-center gap-5 rounded-carte border border-bordure-carte p-4"
              aria-labelledby="t-qr"
            >
              <img
                src={`/api/invites/${id}/qr.png`}
                alt={`QR code d’accès de ${inv.nomComplet}`}
                width={120}
                height={120}
                className="h-[120px] w-[120px] rounded-petit border border-bordure-carte"
              />
              <div className="flex flex-col gap-1">
                <h3 id="t-qr" className="m-0 text-[15px] font-semibold">
                  QR code et code de secours
                </h3>
                <span className="text-[36px] font-bold tracking-[.18em] tabular-nums">{inv.code}</span>
                <span className="text-[13px] text-texte-2">Le QR code n’encode qu’un jeton anonyme.</span>
              </div>
            </section>
            <section className="flex flex-col gap-3" aria-labelledby="t-histo">
              <h3 id="t-histo" className="m-0 text-[15px] font-semibold">
                Historique
              </h3>
              {!histo ? (
                <Spinner className="text-texte-2" />
              ) : (
                <ol className="m-0 flex list-none flex-col p-0">
                  {histo.map((h, i) => {
                    const [icone, ton] = ICONES_HISTO[h.type] || ['info', 'neutre'];
                    const dernier = i === histo.length - 1;
                    return (
                      <li key={i} className="flex gap-3.5">
                        <div className="flex flex-col items-center">
                          <span
                            className={`flex h-7 w-7 flex-none items-center justify-center rounded-full border text-[14px] ${TONS[ton]}`}
                          >
                            <Icon nom={icone} />
                          </span>
                          <span className={`min-h-[18px] w-0.5 flex-1 ${dernier ? 'bg-transparent' : 'bg-bordure'}`} />
                        </div>
                        <div className="flex flex-col pb-[18px] pt-[3px]">
                          <span className="text-[15px] font-semibold">{h.libelle}</span>
                          <span className="text-[13px] text-texte-2">
                            {[jourHeure(h.date), h.detail].filter(Boolean).join(' · ')}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                  {inv.statut === 'INSCRIT' && (
                    <li className="flex gap-3.5">
                      <span className="flex h-7 w-7 flex-none rounded-full border border-champ-doux bg-surface" />
                      <div className="flex flex-col pt-[3px]">
                        <span className="text-[15px] font-medium text-texte-2">Statut « Présent »</span>
                        <span className="text-[13px] text-texte-2">En attente du passage</span>
                      </div>
                    </li>
                  )}
                </ol>
              )}
            </section>
          </>
        )}
        {inv && edition && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span id="ed-civ" className="text-[15px] font-medium">
                Civilité *
              </span>
              <Segmente
                labelledBy="ed-civ"
                grille
                className="max-w-[220px]"
                valeur={edition.civilite}
                onChange={(v) => setEdition({ ...edition, civilite: v })}
                options={[
                  { value: 'MME', label: 'Mme' },
                  { value: 'M', label: 'M.' },
                ]}
              />
            </div>
            {[
              ['nom', 'Nom *'],
              ['prenom', 'Prénom *'],
              ['email', 'Email *'],
              ['telephone', 'Téléphone (+225) *'],
              ['entreprise', 'Entreprise · facultatif'],
              ['fonction', 'Fonction · facultatif'],
            ].map(([k, l]) => (
              <Champ
                key={k}
                label={l}
                hauteur={46}
                value={edition[k] || ''}
                erreur={erreurs[k]}
                onChange={(e) =>
                  setEdition({
                    ...edition,
                    [k]: k === 'telephone' ? formaterTelephone(e.target.value) : e.target.value,
                  })
                }
              />
            ))}
            <div className="flex justify-end gap-2">
              <Bouton variante="secondaire" onClick={() => setEdition(null)}>
                Annuler
              </Bouton>
              <Bouton chargement={envoi} onClick={enregistrer}>
                Enregistrer
              </Bouton>
            </div>
          </div>
        )}
      </div>
    </PanneauLateral>
  );
}

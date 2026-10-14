import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, messageErreur } from '../../lib/api';
import { jourHeure, nombre } from '../../lib/format';
import { useSecours } from '../../lib/tempsReel';
import Badge from '../../components/ui/Badge';
import Bouton from '../../components/ui/Bouton';
import Carte from '../../components/ui/Carte';
import Dialogue from '../../components/ui/Dialogue';
import Icon from '../../components/ui/Icon';
import Squelette from '../../components/ui/Squelette';
import EtatErreur from '../../components/ui/EtatErreur';
import { useToast } from '../../components/ui/Toasts';

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
  {
    cle: 'SONDAGE',
    numero: 'Email n°3',
    nom: 'Sondage de satisfaction',
    icone: 'star',
    moment: 'Envoyé le lendemain à 8 h, ouvert 24 h',
    statut: ['PRESENT', 'Présent'],
  },
];
const DESACTIVE = {
  MAGAZINE: 'Le magazine est désactivé pour ce programme : seul l’email d’invitation est envoyé.',
  SONDAGE: 'Le sondage de satisfaction est désactivé pour ce programme (réglage du super admin, écran Programmes).',
};
const RENVOI = {
  INVITATION:
    'L’invitation repart vers chaque invité en échec, avec le même QR code. Si l’adresse est erronée, corrigez-la d’abord dans la fiche de l’invité.',
  MAGAZINE:
    'Le magazine repart vers chaque invité présent en échec. Les invités dont la présence a été annulée sont ignorés.',
  SONDAGE:
    'Le sondage repart vers chaque invité en échec, avec le même lien. Les liens déjà clos (24 h) ou déjà utilisés sont ignorés.',
};
const ECHECS_VISIBLES = 5;

/** A7 · Suivi des trois emails : compteurs, échecs à renvoyer, email de test, aperçu. */
export default function SuiviEmails({ ev }) {
  const secours = useSecours(15_000);
  const { data, error, refetch } = useQuery({
    queryKey: ['suivi-emails', ev.id],
    queryFn: () => api.get(`/evenements/${ev.id}/suivi-emails/`),
    // rechargé par le temps réel (sujet « statistiques » à chaque changement d'email) ; interrogation de secours sinon
    refetchInterval: secours,
  });
  if (error) return <EtatErreur titre="Suivi indisponible" erreur={error} onReessayer={() => refetch()} />;
  return (
    <div className="grid items-start gap-6 min-[1240px]:grid-cols-2">
      {EMAILS.map((e) => (
        <CarteEmail key={e.cle} ev={ev} email={e} suivi={data?.[e.cle]} />
      ))}
    </div>
  );
}

function CarteEmail({ ev, email, suivi }) {
  const [apercu, setApercu] = useState(false);
  const [test, setTest] = useState(false);
  const toast = useToast();
  const inactif = email.cle !== 'INVITATION' && suivi?.actif === false;
  const titre = `${email.numero} · ${email.nom}`;

  const envoyerTest = async () => {
    setTest(true);
    try {
      const r = await api.post(`/evenements/${ev.id}/suivi-emails/test/`, { type: email.cle });
      toast(`Email de test envoyé à ${r.destinataire}.`);
    } catch (e) {
      toast(messageErreur(e), 'erreur');
    } finally {
      setTest(false);
    }
  };

  return (
    <Carte as="section" aria-label={titre} className="flex min-w-0 flex-col overflow-hidden">
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <EnteteEmail email={email} />
          {!inactif && (
            <Bouton variante="secondaire" taille="sm" icone="send" chargement={test} onClick={envoyerTest}>
              M’envoyer un test
            </Bouton>
          )}
        </div>
        {inactif ? (
          <p className="m-0 rounded-champ bg-subtil p-4 text-[15px] leading-relaxed text-texte-3">
            {DESACTIVE[email.cle]}
          </p>
        ) : (
          <>
            <Compteurs suivi={suivi} />
            {suivi && <Echecs ev={ev} email={email} suivi={suivi} />}
          </>
        )}
      </div>
      {!inactif && (
        <div className="border-t border-bordure-carte">
          <button
            type="button"
            aria-expanded={apercu}
            onClick={() => setApercu((v) => !v)}
            className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 border-0 bg-transparent px-5 text-left text-[15px] font-semibold text-texte hover:bg-fond sm:px-6"
          >
            <span className="inline-flex items-center gap-2">
              <Icon nom="eye" className="text-[18px] text-texte-2" />
              {apercu ? 'Masquer l’aperçu' : 'Voir l’aperçu de l’email'}
            </span>
            <Icon nom={apercu ? 'chevU' : 'chevD'} className="text-[18px] text-texte-2" />
          </button>
          {apercu && <Apercu ev={ev} email={email} />}
        </div>
      )}
    </Carte>
  );
}

function Compteurs({ suivi }) {
  const cases = [
    ['Envoyés', suivi?.envoyes, 'text-succes'],
    ['En attente', suivi?.attente, 'text-avert'],
    ['En échec', suivi?.echecs, 'text-erreur'],
  ].map(([l, v, c]) => [l, v, v ? c : 'text-texte']);
  return (
    <dl className="m-0 grid grid-cols-3 gap-2 sm:gap-3">
      {cases.map(([libelle, valeur, couleur]) => (
        <div key={libelle} className="flex flex-col gap-1 rounded-champ bg-subtil px-3 py-3 sm:px-4">
          <dt className="text-[13px] font-medium text-texte-3">{libelle}</dt>
          <dd className={`m-0 text-[26px] font-bold leading-none tracking-[-0.02em] ${couleur}`}>
            {suivi ? nombre(valeur) : <Squelette className="h-[26px] w-10" />}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Echecs({ ev, email, suivi }) {
  const [tout, setTout] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const toast = useToast();
  const qc = useQueryClient();
  const base = `/admin/evenements/${ev.id}/invites`;

  if (!suivi.echecs) {
    return (
      <p className="m-0 flex items-center gap-2 text-[15px] text-texte-3">
        <Icon nom="checkCircle" className="text-[18px] text-succes" />
        Aucun échec d’envoi.
      </p>
    );
  }

  const liste = tout ? suivi.listeEchecs : suivi.listeEchecs.slice(0, ECHECS_VISIBLES);
  const reste = suivi.echecs - liste.length;
  const renvoyer = async () => {
    setConfirmer(false);
    setEnvoi(true);
    try {
      const r = await api.post(`/evenements/${ev.id}/suivi-emails/renvoyer-echecs/`, { type: email.cle });
      toast(
        r.traites
          ? `${nombre(r.traites)} email${r.traites > 1 ? 's' : ''} remis en file d’envoi.`
          : 'Aucun email à renvoyer.',
      );
      qc.invalidateQueries({ queryKey: ['suivi-emails', ev.id] });
      qc.invalidateQueries({ queryKey: ['statistiques', ev.id] });
    } catch (e) {
      toast(messageErreur(e), 'erreur');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-champ border border-erreur-bord bg-erreur-doux p-4">
      <div className="flex items-start gap-2.5">
        <Icon nom="alertCircle" className="mt-0.5 flex-none text-[18px] text-erreur" />
        <p className="m-0 text-[15px] font-semibold text-texte">
          {suivi.echecs > 1
            ? `${nombre(suivi.echecs)} invités n’ont pas reçu cet email`
            : '1 invité n’a pas reçu cet email'}
        </p>
      </div>
      <ul className="m-0 flex list-none flex-col divide-y divide-erreur-bord rounded-moyen bg-surface p-0">
        {liste.map((x) => (
          <li key={x.inviteId} className="flex flex-col gap-0.5 px-3 py-2.5">
            <Link
              to={`${base}?fiche=${x.inviteId}`}
              className="self-start text-[14px] font-semibold text-texte underline-offset-2 hover:underline"
            >
              {x.nomComplet}
            </Link>
            <span className="break-all text-[13px] text-texte-3">{x.email}</span>
            <span className="text-[12.5px] text-texte-2">
              {x.erreur || 'Erreur inconnue'} · {x.tentatives} tentative{x.tentatives > 1 ? 's' : ''} ·{' '}
              {jourHeure(x.le)}
            </span>
          </li>
        ))}
      </ul>
      {(reste > 0 || tout) && suivi.listeEchecs.length > ECHECS_VISIBLES && (
        <button
          type="button"
          onClick={() => setTout((v) => !v)}
          className="cursor-pointer self-start border-0 bg-transparent p-0 text-[14px] font-semibold text-texte underline underline-offset-[3px]"
        >
          {tout
            ? 'Réduire la liste'
            : `Afficher ${nombre(Math.min(reste, suivi.listeEchecs.length - liste.length))} de plus`}
        </button>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Bouton taille="sm" icone="refresh" chargement={envoi} onClick={() => setConfirmer(true)}>
          Renvoyer {suivi.echecs > 1 ? `les ${nombre(suivi.echecs)} emails` : 'l’email'}
        </Bouton>
        {email.cle === 'INVITATION' && (
          <Link
            to={`${base}?email1=ECHEC`}
            className="flex min-h-10 items-center px-2 text-[14px] font-semibold text-texte underline underline-offset-[3px]"
          >
            Voir dans la liste des invités
          </Link>
        )}
      </div>
      <Dialogue
        univers="programme"
        ouvert={confirmer}
        tonalite="info"
        icone="send"
        titre={suivi.echecs > 1 ? `Renvoyer ${nombre(suivi.echecs)} emails ?` : 'Renvoyer l’email ?'}
        onFermer={() => setConfirmer(false)}
        actions={
          <>
            <Bouton variante="secondaire" onClick={() => setConfirmer(false)}>
              Annuler
            </Bouton>
            <Bouton icone="send" onClick={renvoyer}>
              Renvoyer
            </Bouton>
          </>
        }
      >
        {RENVOI[email.cle]}
      </Dialogue>
    </div>
  );
}

function Apercu({ ev, email }) {
  const { data, error, refetch } = useQuery({
    queryKey: ['apercu-emails', ev.id],
    queryFn: () => api.get(`/evenements/${ev.id}/apercu-emails/`),
  });
  if (error) return <EtatErreur titre="Aperçu indisponible" erreur={error} onReessayer={() => refetch()} />;
  return (
    <div className="flex flex-col gap-4 border-t border-bordure-carte bg-fond p-3 sm:p-5">
      <div className="flex flex-col gap-1 rounded-champ bg-surface px-4 py-3">
        <span className="text-[12px] font-semibold uppercase tracking-[.06em] text-texte-2">Objet</span>
        <div className="text-[15px] font-semibold leading-snug text-texte">
          {data ? data[email.cle].objet : <Squelette className="h-5 w-3/4" />}
        </div>
      </div>
      {data ? (
        <iframe
          title={`Aperçu · ${email.numero} · ${email.nom}`}
          srcDoc={data[email.cle].html}
          sandbox=""
          className="mx-auto block h-[1000px] w-full max-w-[640px] rounded-moyen border border-bordure-carte bg-surface"
        />
      ) : (
        <Squelette className="mx-auto h-[900px] w-full max-w-[640px] !rounded-moyen" />
      )}
      <p className="m-0 text-center text-[13px] text-texte-2">
        Exemple rempli avec une invitée fictive. Les textes se modifient dans Paramètres (super admin).
      </p>
    </div>
  );
}

function EnteteEmail({ email }) {
  return (
    <div className="flex min-w-0 items-start gap-4">
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

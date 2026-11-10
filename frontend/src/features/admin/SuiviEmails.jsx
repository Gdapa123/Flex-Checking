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
// l'email n°2 n'est jamais désactivé (envoyé à tout invité présent depuis le 2026-11-10) : seul le sondage peut l'être
const DESACTIVE = {
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
const LIGNES_VISIBLES = 8;
const LIBELLE_TYPE = { INVITATION: 'Invitation', MAGAZINE: 'Magazine', SONDAGE: 'Sondage' };

/**
 * A7 · Suivi des emails. En tête : les invités à contacter (email non reçu ou probablement non reçu, avec la cause
 * et l'action utile) ; puis une carte par email (compteurs, renvoi groupé des échecs) ; aperçu et email de test
 * repliés dans chaque carte.
 */
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
    <div className="flex flex-col gap-6">
      <AContacter ev={ev} donnees={data?.aContacter} />
      <div className="grid items-start gap-6 min-[1240px]:grid-cols-2">
        {EMAILS.map((e) => (
          <CarteEmail key={e.cle} ev={ev} email={e} suivi={data?.[e.cle]} />
        ))}
      </div>
      <p className="m-0 text-[13px] leading-relaxed text-texte-2">
        « Envoyés » signifie accepté par le serveur d’envoi : la réception n’est pas garantie. Une adresse mal tapée ou
        un email refusé plus tard apparaît dans « Invités à contacter » dès que la cause est connue.
      </p>
    </div>
  );
}

function AContacter({ ev, donnees }) {
  const [tout, setTout] = useState(false);
  if (!donnees) {
    return (
      <Carte as="section" aria-label="Invités à contacter" className="flex flex-col gap-3 p-5 sm:p-6">
        <Squelette className="h-6 w-56" />
        <Squelette className="h-16 w-full" />
      </Carte>
    );
  }
  if (!donnees.total) {
    return (
      <Carte as="section" aria-label="Invités à contacter" className="flex items-start gap-4 p-5 sm:p-6">
        <span className="flex h-12 w-12 flex-none items-center justify-center rounded-champ bg-succes-doux text-[22px] text-succes">
          <Icon nom="checkCircle" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-[19px] font-bold leading-tight">Aucun invité à contacter</h2>
          <p className="m-0 text-[15px] text-texte-3">
            Aucun échec d’envoi, aucun email bloqué, aucune adresse qui semble mal tapée.
          </p>
        </div>
      </Carte>
    );
  }
  const lignes = tout ? donnees.invites : donnees.invites.slice(0, LIGNES_VISIBLES);
  const aCorriger = donnees.invites.filter((x) => x.action === 'CORRIGER').length;
  return (
    <Carte as="section" aria-labelledby="titre-a-contacter" className="flex flex-col overflow-hidden">
      <div className="flex flex-col gap-3 p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-champ bg-avert-doux text-[22px] text-avert">
            <Icon nom="users" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id="titre-a-contacter" className="m-0 text-[19px] font-bold leading-tight">
              Invités à contacter <span className="text-texte-2">· {nombre(donnees.total)}</span>
            </h2>
            <p className="m-0 text-[15px] text-texte-3">
              {aCorriger
                ? `${nombre(aCorriger)} adresse${aCorriger > 1 ? 's' : ''} à corriger ou à confirmer avec l’invité, puis renvoyer.`
                : 'Un renvoi suffit : les adresses ne sont pas en cause.'}
            </p>
          </div>
        </div>
        {donnees.causesEnvoi > 0 && (
          <p className="m-0 flex items-start gap-2 rounded-champ border border-avert-bord bg-avert-doux p-3 text-[14px] leading-relaxed text-texte">
            <Icon nom="info" className="mt-0.5 flex-none text-[17px] text-avert" />
            {donnees.causesEnvoi > 1
              ? `Pour ${nombre(donnees.causesEnvoi)} invités, le problème vient de l’envoi, pas de leur adresse.`
              : 'Pour 1 invité, le problème vient de l’envoi, pas de son adresse.'}{' '}
            Renvoyez une fois l’envoi rétabli ; si cela se répète, prévenez la direction des événements.
          </p>
        )}
      </div>
      <ul className="m-0 flex list-none flex-col divide-y divide-bordure-carte border-t border-bordure-carte p-0">
        {lignes.map((x) => (
          <LigneContact key={x.inviteId} ev={ev} ligne={x} />
        ))}
      </ul>
      {donnees.invites.length > LIGNES_VISIBLES && (
        <button
          type="button"
          onClick={() => setTout((v) => !v)}
          className="min-h-12 cursor-pointer border-0 border-t border-bordure-carte bg-transparent px-5 text-left text-[14px] font-semibold text-texte underline underline-offset-[3px] hover:bg-fond sm:px-6"
        >
          {tout ? 'Réduire la liste' : `Afficher les ${nombre(donnees.invites.length)} invités`}
        </button>
      )}
      {donnees.total > donnees.invites.length && (
        <p className="m-0 border-t border-bordure-carte px-5 py-3 text-[13px] text-texte-2 sm:px-6">
          {nombre(donnees.invites.length)} premiers affichés sur {nombre(donnees.total)}.
        </p>
      )}
    </Carte>
  );
}

function LigneContact({ ev, ligne }) {
  const [envoi, setEnvoi] = useState(false);
  const toast = useToast();
  const qc = useQueryClient();
  const fiche = `/admin/evenements/${ev.id}/invites?fiche=${ligne.inviteId}`;
  // type à renvoyer : celui du premier problème qui n'est ni une adresse douteuse ni un envoi déjà en file (un
  // envoi « bloqué » est repris automatiquement : le renvoyer créerait un doublon), sinon l'invitation
  const aRenvoyer = ligne.problemes.find((p) => p.code !== 'ADRESSE_DOUTEUSE' && p.code !== 'BLOQUE');
  const typeRenvoi = aRenvoyer?.type || 'INVITATION';
  const seulementEnFile = !ligne.suggestion && ligne.problemes.every((p) => p.code === 'BLOQUE');

  const executer = async (action, message) => {
    setEnvoi(true);
    try {
      await action();
      toast(message);
    } catch (e) {
      toast(messageErreur(e), 'erreur');
    } finally {
      // rechargé même après un échec partiel (adresse corrigée, renvoi refusé) : l'écran montre l'état réel
      qc.invalidateQueries({ queryKey: ['suivi-emails', ev.id] });
      qc.invalidateQueries({ queryKey: ['statistiques', ev.id] });
      setEnvoi(false);
    }
  };
  const renvoyer = () =>
    executer(
      () => api.post(`/invites/${ligne.inviteId}/renvoi-email/`, { type: typeRenvoi }),
      `${LIBELLE_TYPE[typeRenvoi]} renvoyé${typeRenvoi === 'INVITATION' ? 'e' : ''} à ${ligne.nomComplet}.`,
    );
  const corrigerEtRenvoyer = () =>
    executer(
      async () => {
        await api.patch(`/invites/${ligne.inviteId}/`, { email: ligne.suggestion });
        // l'email en échec (magazine d'un invité présent, par exemple), sinon l'invitation
        await api.post(`/invites/${ligne.inviteId}/renvoi-email/`, { type: typeRenvoi });
      },
      `Adresse corrigée en ${ligne.suggestion}, ${LIBELLE_TYPE[typeRenvoi].toLowerCase()} renvoyé${typeRenvoi === 'INVITATION' ? 'e' : ''}.`,
    );

  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link to={fiche} className="text-[15px] font-semibold text-texte underline-offset-2 hover:underline">
            {ligne.nomComplet}
          </Link>
          <Badge type={ligne.statut} taille="sm">
            {ligne.statut === 'PRESENT' ? 'Présent' : 'Inscrit'}
          </Badge>
        </div>
        <span className="break-all text-[14px] text-texte-3">
          {ligne.email}
          {ligne.suggestion && (
            <>
              {' '}
              → <strong className="text-texte">{ligne.suggestion}</strong> ?
            </>
          )}
        </span>
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
          {ligne.problemes.map((p) => (
            <li key={`${p.code}-${p.type}`} className="text-[13px] text-texte-2" title={p.detail || undefined}>
              <span className={p.cote === 'adresse' ? 'font-semibold text-erreur' : 'font-semibold text-avert'}>
                {p.libelle}
              </span>
              {' · '}
              {LIBELLE_TYPE[p.type]}
              {p.le ? ` · ${jourHeure(p.le)}` : ''}
            </li>
          ))}
        </ul>
        {ligne.telephone && (
          <a
            href={`tel:${ligne.telephone.replace(/\s/g, '')}`}
            className="inline-flex items-center gap-1.5 self-start text-[14px] font-semibold text-texte underline-offset-2 hover:underline"
          >
            <Icon nom="smartphone" className="text-[16px] text-texte-2" />
            {ligne.telephone}
          </a>
        )}
      </div>
      <div className="flex flex-none flex-wrap gap-2">
        {ligne.suggestion ? (
          <Bouton taille="sm" icone="send" chargement={envoi} onClick={corrigerEtRenvoyer}>
            Corriger et renvoyer
          </Bouton>
        ) : ligne.action === 'CORRIGER' ? (
          <Link
            to={fiche}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-champ border border-champ px-3 text-[14px] font-semibold text-texte hover:bg-fond"
          >
            <Icon nom="edit" className="text-[16px]" />
            Corriger l’adresse
          </Link>
        ) : seulementEnFile ? (
          <span className="inline-flex min-h-10 items-center text-[14px] text-texte-2">Nouvel essai automatique</span>
        ) : (
          <Bouton variante="secondaire" taille="sm" icone="refresh" chargement={envoi} onClick={renvoyer}>
            Renvoyer
          </Bouton>
        )}
      </div>
    </li>
  );
}

function CarteEmail({ ev, email, suivi }) {
  const [ouvert, setOuvert] = useState(false);
  const inactif = email.cle !== 'INVITATION' && suivi?.actif === false;
  const titre = `${email.numero} · ${email.nom}`;

  return (
    <Carte as="section" aria-label={titre} className="flex min-w-0 flex-col overflow-hidden">
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <EnteteEmail email={email} />
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
            aria-expanded={ouvert}
            onClick={() => setOuvert((v) => !v)}
            className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 border-0 bg-transparent px-5 text-left text-[14px] font-medium text-texte-3 hover:bg-fond sm:px-6"
          >
            <span className="inline-flex items-center gap-2">
              <Icon nom="eye" className="text-[17px] text-texte-2" />
              Aperçu et email de test
            </span>
            <Icon nom={ouvert ? 'chevU' : 'chevD'} className="text-[17px] text-texte-2" />
          </button>
          {ouvert && <Apercu ev={ev} email={email} />}
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

/** Échecs de cet email : renvoi groupé (le détail, invité par invité, est dans « Invités à contacter »). */
function Echecs({ ev, email, suivi }) {
  const [confirmer, setConfirmer] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const toast = useToast();
  const qc = useQueryClient();

  if (!suivi.echecs) return null;

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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-champ border border-erreur-bord bg-erreur-doux px-4 py-3">
      <p className="m-0 flex items-center gap-2 text-[15px] font-semibold text-texte">
        <Icon nom="alertCircle" className="flex-none text-[18px] text-erreur" />
        {suivi.echecs > 1
          ? `${nombre(suivi.echecs)} invités n’ont pas reçu cet email`
          : '1 invité n’a pas reçu cet email'}
      </p>
      <Bouton taille="sm" icone="refresh" chargement={envoi} onClick={() => setConfirmer(true)}>
        Renvoyer {suivi.echecs > 1 ? `les ${nombre(suivi.echecs)} emails` : 'l’email'}
      </Bouton>
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
  const [test, setTest] = useState(false);
  const toast = useToast();
  const { data, error, refetch } = useQuery({
    queryKey: ['apercu-emails', ev.id],
    queryFn: () => api.get(`/evenements/${ev.id}/apercu-emails/`),
  });
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
  if (error) return <EtatErreur titre="Aperçu indisponible" erreur={error} onReessayer={() => refetch()} />;
  return (
    <div className="flex flex-col gap-4 border-t border-bordure-carte bg-fond p-3 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-[13px] text-texte-2">Vérifiez le rendu dans votre propre messagerie :</p>
        <Bouton variante="secondaire" taille="sm" icone="send" chargement={test} onClick={envoyerTest}>
          M’envoyer un test
        </Bouton>
      </div>
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

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, messageErreur } from '../../lib/api';
import { dateCourte } from '../../lib/format';
import { telecharger } from '../../lib/telechargement';
import Bouton from '../../components/ui/Bouton';
import Carte from '../../components/ui/Carte';
import Dialogue from '../../components/ui/Dialogue';
import DialogueSuppression from '../../components/ui/DialogueSuppression';
import Icon from '../../components/ui/Icon';
import Interrupteur from '../../components/ui/Interrupteur';
import Squelette from '../../components/ui/Squelette';
import { useToast } from '../../components/ui/Toasts';
import { PageSuper } from './SuperApp';
import ErreurChargement from './ErreurChargement';
import { CHAMP_MDE, useAdmins, useEvenements, useProgrammes } from './donnees';

const CHAMPS = [
  ['date', 'Date', 'date'],
  ['heureDebut', 'Heure de début', 'time'],
  ['heureAccueil', 'Heure d’accueil', 'time'],
  ['capacite', 'Capacité', 'number'],
  ['dateLimiteInscription', 'Date limite d’inscription', 'date'],
  ['lieu', 'Lieu', 'text'],
  ['lienCarte', 'Lien de l’itinéraire (carte)', 'url'],
];

const VIDE = {
  programme: '',
  date: '',
  heureDebut: '18:00',
  heureAccueil: '17:15',
  capacite: 200,
  dateLimiteInscription: '',
  lieu: '',
  lienCarte: '',
  inscriptionsOuvertes: true,
  admins: [],
};

/** SA5 · Cérémonies (événements) : création et modification, inscriptions, admins affectés, lien et QR d'inscription. */
export default function Evenements() {
  const { id } = useParams();
  const naviguer = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: evenements, error: erreurListe, refetch } = useEvenements();
  const { data: programmes = [] } = useProgrammes();
  const { data: admins = [] } = useAdmins();
  const nouveau = id === 'nouveau';
  // sans identifiant : première cérémonie de la liste ; identifiant inconnu : « introuvable » (jamais une autre)
  const courant = nouveau ? null : id ? evenements?.find((e) => String(e.id) === id) : evenements?.[0];
  const introuvable = Boolean(id && !nouveau && evenements && !courant);
  const [d, setD] = useState(null);
  const [erreurs, setErreurs] = useState({});
  const [envoi, setEnvoi] = useState(false);
  const [regen, setRegen] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const [qrVersion, setQrVersion] = useState(0);
  const [initial, setInitial] = useState(null);
  const [sortie, setSortie] = useState(null); // destination en attente si le formulaire a des modifications
  const modifie = Boolean(d && initial && JSON.stringify(d) !== initial);

  useEffect(() => {
    setErreurs({});
    let valeur = null;
    if (nouveau) valeur = { ...VIDE, programme: programmes.find((p) => p.actif)?.id || '' };
    else if (courant)
      valeur = {
        ...courant,
        heureDebut: courant.heureDebut.slice(0, 5),
        heureAccueil: courant.heureAccueil.slice(0, 5),
      };
    setD(valeur);
    setInitial(valeur && JSON.stringify(valeur));
  }, [nouveau, courant?.id, programmes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // changer de cérémonie ou en créer une ne doit pas perdre silencieusement une saisie en cours
  const allerA = (chemin) => (modifie ? setSortie(chemin) : naviguer(chemin));

  const invaliderTout = (evenementId) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['evenements'] }),
      evenementId && qc.invalidateQueries({ queryKey: ['evenement', String(evenementId)] }),
      evenementId && qc.invalidateQueries({ queryKey: ['apercu-emails', evenementId] }),
      evenementId && qc.invalidateQueries({ queryKey: ['statistiques', evenementId] }),
    ]);

  const enregistrer = async () => {
    setEnvoi(true);
    setErreurs({});
    const corps = {
      programme: Number(d.programme),
      date: d.date,
      heureDebut: d.heureDebut,
      heureAccueil: d.heureAccueil,
      capacite: Number(d.capacite),
      dateLimiteInscription: d.dateLimiteInscription,
      lieu: d.lieu,
      lienCarte: d.lienCarte,
      inscriptionsOuvertes: d.inscriptionsOuvertes,
      admins: d.admins,
    };
    try {
      const r = nouveau ? await api.post('/evenements/', corps) : await api.patch(`/evenements/${d.id}/`, corps);
      await invaliderTout(r.id);
      setInitial(JSON.stringify(d));
      toast(nouveau ? `${r.nomAffiche} créée` : 'Cérémonie enregistrée');
      if (nouveau) naviguer(`/super/evenements/${r.id}`);
    } catch (e) {
      if (e.status === 400 && e.data && !e.data.detail) {
        const champs = Object.fromEntries(
          Object.entries(e.data).map(([k, v]) => [k, Array.isArray(v) ? String(v[0]) : String(v)]),
        );
        setErreurs(champs);
        // erreurs sans champ affiché (non_field_errors, code…) : signalées aussi en toast
        const autre = champs.nonFieldErrors || champs.non_field_errors;
        if (autre) toast(autre, 'erreur');
      } else toast(messageErreur(e), 'erreur');
    } finally {
      setEnvoi(false);
    }
  };

  const supprimer = async (confirmation) => {
    try {
      await api.delete(`/evenements/${d.id}/`, { params: { confirmation } });
      setInitial(null);
      await qc.invalidateQueries({ queryKey: ['evenements'] });
      toast(`${courant.nomAffiche} supprimé`);
      setSuppression(false);
      naviguer('/super/evenements');
    } catch (e) {
      toast(messageErreur(e), 'erreur');
    }
  };

  const regenerer = async () => {
    try {
      await api.post(`/evenements/${d.id}/regenerer-slug/`);
      await invaliderTout(d.id);
      setQrVersion((v) => v + 1);
      toast('Nouveau lien d’inscription généré. L’ancien n’accepte plus d’inscriptions.');
    } catch (e) {
      toast(messageErreur(e), 'erreur');
    }
    setRegen(false);
  };

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(courant.lienInscription);
      toast('Lien d’inscription copié');
    } catch {
      toast('Copie impossible : sélectionnez le lien manuellement.', 'erreur');
    }
  };

  const adminsLibres = admins.filter((a) => a.actif && !d?.admins.includes(a.id));

  return (
    <PageSuper titre="Cérémonies" action="Nouvelle cérémonie" onAction={() => allerA('/super/evenements/nouveau')}>
      {erreurListe && !evenements && <ErreurChargement erreur={erreurListe} onReessayer={refetch} />}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          {!evenements && [1, 2, 3].map((k) => <Squelette key={k} className="h-[68px] !rounded-[12px]" />)}
          {evenements?.map((e) => {
            const on = !nouveau && courant?.id === e.id;
            return (
              <button
                key={e.id}
                type="button"
                aria-pressed={on}
                onClick={() => allerA(`/super/evenements/${e.id}`)}
                className={`box-border flex cursor-pointer items-center gap-3 rounded-bouton bg-surface px-4 py-3.5 text-left text-mde-texte border transition-[border-color,box-shadow] ${on ? 'border-mde-bordeaux ring-1 ring-mde-bordeaux' : 'border-mde-bordure hover:border-mde-champ hover:shadow-carte-mde'}`}
              >
                <span className="h-9 w-1.5 rounded-[3px]" style={{ background: e.tokens.p }} />
                <span className="flex flex-1 flex-col">
                  <span className="text-[15px] font-semibold">{e.nomAffiche}</span>
                  <span className="text-[13px] text-mde-texte-2">{dateCourte(e.date)}</span>
                </span>
              </button>
            );
          })}
        </div>

        {introuvable && (
          <Carte mde role="alert" className="flex flex-col items-start gap-3 p-6">
            <h2 className="m-0 text-[20px] font-bold tracking-[-0.02em]">Cérémonie introuvable</h2>
            <p className="m-0 text-[15px] text-mde-texte-2">
              Elle a peut-être été supprimée. Choisissez une cérémonie dans la liste.
            </p>
            <Link to="/super/evenements" className="inline-flex min-h-11 items-center font-semibold">
              Voir toutes les cérémonies
            </Link>
          </Carte>
        )}

        {d && (
          <Carte mde as="section" className="flex min-w-0 flex-col gap-5 p-6" aria-labelledby="t-ev">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="t-ev" className="m-0 text-[20px] font-bold tracking-[-0.02em]">
                {nouveau ? 'Nouvelle cérémonie' : courant?.nomAffiche}
              </h2>
              {!nouveau && courant && (
                <Link
                  to={`/admin/evenements/${courant.id}`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-bouton border border-mde-champ bg-surface px-3.5 text-[14px] font-semibold text-mde-texte no-underline hover:bg-mde-survol hover:text-mde-texte"
                >
                  <Icon nom="chart" className="text-[16px]" />
                  Tableau de bord
                </Link>
              )}
            </div>
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
              <label className="flex flex-col gap-2 text-[15px] font-medium">
                Programme
                <select
                  value={d.programme}
                  onChange={(e) => setD({ ...d, programme: e.target.value })}
                  className={CHAMP_MDE}
                >
                  {programmes
                    .filter((p) => p.actif || p.id === Number(d.programme))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nom}
                      </option>
                    ))}
                </select>
                {erreurs.programme && <span className="text-[14px] font-normal text-erreur">{erreurs.programme}</span>}
              </label>
              {CHAMPS.map(([k, l, type]) => (
                <label
                  key={k}
                  className={`flex flex-col gap-2 text-[15px] font-medium ${k === 'lieu' || k === 'lienCarte' ? 'sm:col-span-2' : ''}`}
                >
                  {l}
                  <input
                    type={type}
                    value={d[k] ?? ''}
                    min={type === 'number' ? 1 : undefined}
                    onChange={(e) => setD({ ...d, [k]: e.target.value })}
                    className={CHAMP_MDE}
                  />
                  {erreurs[k] && <span className="text-[14px] font-normal text-erreur">{erreurs[k]}</span>}
                </label>
              ))}
            </div>
            <div className="rounded-[12px] border border-mde-bordure px-4">
              <Interrupteur
                actif={d.inscriptionsOuvertes}
                onChange={(v) => setD({ ...d, inscriptionsOuvertes: v })}
                univers="mde"
                label="Inscriptions ouvertes"
                description="Fermées automatiquement après la date limite ou quand la capacité est atteinte."
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[15px] font-medium">Admins affectés</span>
              <div className="flex flex-wrap items-center gap-2">
                {d.admins.map((aid) => {
                  const a = admins.find((x) => x.id === aid);
                  if (!a) return null;
                  return (
                    <span
                      key={aid}
                      className="inline-flex h-11 items-center gap-1 rounded-full border border-mde-bordure bg-mde-survol py-0 pl-3.5 pr-0.5 text-[14px] font-medium"
                    >
                      {a.nom}
                      <button
                        type="button"
                        aria-label={`Retirer ${a.nom}`}
                        onClick={() => setD({ ...d, admins: d.admins.filter((x) => x !== aid) })}
                        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-[14px] text-mde-texte-2 hover:bg-mde-bordure-ligne"
                      >
                        <Icon nom="x" />
                      </button>
                    </span>
                  );
                })}
                {adminsLibres.length > 0 && (
                  <select
                    aria-label="Affecter un admin"
                    value=""
                    onChange={(e) => e.target.value && setD({ ...d, admins: [...d.admins, Number(e.target.value)] })}
                    className="h-11 rounded-full border border-dashed border-mde-champ bg-surface px-3 text-[14px] font-medium text-mde-texte"
                  >
                    <option value="">+ Affecter un admin</option>
                    {adminsLibres.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nom}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {erreurs.admins && <span className="text-[14px] text-erreur">{erreurs.admins}</span>}
            </div>

            {!nouveau && courant && (
              <div className="flex flex-wrap items-center gap-5 rounded-carte border border-mde-bordure-carte bg-mde-surface p-4 shadow-carte-mde">
                <div className="rounded-moyen border border-mde-bordure bg-surface p-2">
                  <img
                    src={`/api/evenements/${courant.id}/qr-inscription.png?v=${qrVersion}-${courant.slugInscription}`}
                    alt="QR code d’inscription"
                    width={132}
                    height={132}
                    className="block h-[132px] w-[132px]"
                  />
                </div>
                <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-2.5">
                  <span className="text-[15px] font-semibold">Lien et QR code d’inscription</span>
                  <div className="flex gap-2">
                    <div className="flex h-11 min-w-0 flex-1 items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-moyen border border-mde-bordure bg-surface px-3 font-mono text-[14px] font-medium">
                      {courant.lienInscription}
                    </div>
                    <Bouton
                      variante="mde-secondaire"
                      icone="copy"
                      taille="md"
                      onClick={copier}
                      className="!text-[14px]"
                    >
                      Copier
                    </Bouton>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        telecharger(`/evenements/${courant.id}/qr-inscription.png`, { defaut: 'qr-inscription.png' })
                      }
                      className="flex h-11 cursor-pointer items-center gap-1.5 border-0 bg-transparent px-3 text-[14px] font-semibold text-mde-texte underline underline-offset-[3px]"
                    >
                      <Icon nom="download" className="text-[16px]" />
                      Télécharger le QR code (PNG)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegen(true)}
                      className="flex h-11 cursor-pointer items-center gap-1.5 border-0 bg-transparent px-3 text-[14px] font-semibold text-mde-texte underline underline-offset-[3px]"
                    >
                      <Icon nom="refresh" className="text-[16px]" />
                      Régénérer le lien
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="flex flex-wrap justify-between gap-2 border-t border-mde-bordure pt-2">
              {!nouveau ? (
                <Bouton variante="fantome" icone="trash" className="!text-erreur" onClick={() => setSuppression(true)}>
                  Supprimer la cérémonie
                </Bouton>
              ) : (
                <span />
              )}
              <Bouton variante="mde" chargement={envoi} onClick={enregistrer} className="px-[18px]">
                {nouveau ? 'Créer la cérémonie' : 'Enregistrer la cérémonie'}
              </Bouton>
            </div>
          </Carte>
        )}
      </div>
      <Dialogue
        ouvert={regen}
        titre="Régénérer le lien d’inscription ?"
        onFermer={() => setRegen(false)}
        actions={
          <>
            <Bouton variante="mde-secondaire" onClick={() => setRegen(false)} data-autofocus>
              Annuler
            </Bouton>
            <Bouton variante="destructif" onClick={regenerer}>
              Régénérer
            </Bouton>
          </>
        }
      >
        L’ancien lien et l’ancien QR code n’accepteront plus de nouvelles inscriptions. Les invités déjà inscrits
        gardent l’accès à leurs infos pratiques (agenda, itinéraire) depuis les liens de leurs emails.
      </Dialogue>
      <Dialogue
        ouvert={Boolean(sortie)}
        titre="Quitter sans enregistrer ?"
        onFermer={() => setSortie(null)}
        actions={
          <>
            <Bouton variante="mde-secondaire" onClick={() => setSortie(null)} data-autofocus>
              Continuer la saisie
            </Bouton>
            <Bouton
              variante="destructif"
              onClick={() => {
                const chemin = sortie;
                setSortie(null);
                setInitial(null);
                naviguer(chemin);
              }}
            >
              Abandonner les modifications
            </Bouton>
          </>
        }
      >
        Les modifications de cette cérémonie ne sont pas enregistrées.
      </Dialogue>
      <DialogueSuppression
        ouvert={suppression}
        titre={`Supprimer ${courant?.nomAffiche} ?`}
        nomAConfirmer={courant?.nbInscrits ? courant.nomAffiche : undefined}
        onConfirmer={supprimer}
        onFermer={() => setSuppression(false)}
      >
        {courant?.nbInscrits
          ? `Suppression définitive de la cérémonie et de ses ${courant.nbInscrits} invités (inscriptions, emails, émargements). Pensez à exporter la liste avant si besoin.`
          : 'Cette cérémonie n’a aucun invité. Sa suppression est définitive.'}
      </DialogueSuppression>
    </PageSuper>
  );
}

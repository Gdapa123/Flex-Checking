import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, messageErreur } from '../../lib/api';
import { dateCourte } from '../../lib/format';
import { telecharger } from '../../lib/telechargement';
import Bouton from '../../components/ui/Bouton';
import Carte from '../../components/ui/Carte';
import Dialogue from '../../components/ui/Dialogue';
import Icon from '../../components/ui/Icon';
import Interrupteur from '../../components/ui/Interrupteur';
import Squelette from '../../components/ui/Squelette';
import { useToast } from '../../components/ui/Toasts';
import { PageSuper } from './SuperApp';
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

/** SA5 · Événements : création et modification, inscriptions, admins affectés, lien et QR d'inscription. */
export default function Evenements() {
  const { id } = useParams();
  const naviguer = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: evenements } = useEvenements();
  const { data: programmes = [] } = useProgrammes();
  const { data: admins = [] } = useAdmins();
  const nouveau = id === 'nouveau';
  const courant = nouveau ? null : evenements?.find((e) => String(e.id) === id) || evenements?.[0];
  const [d, setD] = useState(null);
  const [erreurs, setErreurs] = useState({});
  const [envoi, setEnvoi] = useState(false);
  const [regen, setRegen] = useState(false);
  const [qrVersion, setQrVersion] = useState(0);

  useEffect(() => {
    setErreurs({});
    if (nouveau) setD({ ...VIDE, programme: programmes.find((p) => p.actif)?.id || '' });
    else if (courant)
      setD({
        ...courant,
        heureDebut: courant.heureDebut.slice(0, 5),
        heureAccueil: courant.heureAccueil.slice(0, 5),
      });
  }, [nouveau, courant?.id, programmes.length]); // eslint-disable-line react-hooks/exhaustive-deps

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
      await qc.invalidateQueries({ queryKey: ['evenements'] });
      toast(nouveau ? `${r.nomAffiche} créé` : 'Événement enregistré');
      if (nouveau) naviguer(`/super/evenements/${r.id}`);
    } catch (e) {
      if (e.status === 400)
        setErreurs(Object.fromEntries(Object.entries(e.data).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
      else toast(messageErreur(e), 'erreur');
    } finally {
      setEnvoi(false);
    }
  };

  const regenerer = async () => {
    try {
      await api.post(`/evenements/${d.id}/regenerer-slug/`);
      await qc.invalidateQueries({ queryKey: ['evenements'] });
      setQrVersion((v) => v + 1);
      toast('Nouveau lien d’inscription généré. L’ancien lien ne fonctionne plus.');
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
    <PageSuper titre="Événements" action="Nouvel événement" onAction={() => naviguer('/super/evenements/nouveau')}>
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
                onClick={() => naviguer(`/super/evenements/${e.id}`)}
                className={`box-border flex cursor-pointer items-center gap-3 rounded-bouton bg-surface px-4 py-3.5 text-left text-mde-texte ${on ? 'border-2 border-mde-bordeaux' : 'border border-mde-bordure'}`}
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

        {d && (
          <Carte mde as="section" className="flex min-w-0 flex-col gap-5 p-6" aria-labelledby="t-ev">
            <h2 id="t-ev" className="m-0 text-[20px] font-bold tracking-[-0.02em]">
              {nouveau ? 'Nouvel événement' : courant?.nomAffiche}
            </h2>
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
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-mde-bordure bg-mde-survol py-0 pl-3 pr-1 text-[14px] font-medium"
                    >
                      {a.nom}
                      <button
                        type="button"
                        aria-label={`Retirer ${a.nom}`}
                        onClick={() => setD({ ...d, admins: d.admins.filter((x) => x !== aid) })}
                        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-[14px] text-mde-texte-2"
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
                    className="h-9 rounded-full border border-dashed border-mde-champ bg-surface px-3 text-[14px] font-medium text-mde-texte"
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
                      className="flex h-10 cursor-pointer items-center gap-1.5 border-0 bg-transparent px-3 text-[14px] font-semibold text-mde-texte underline underline-offset-[3px]"
                    >
                      <Icon nom="download" className="text-[16px]" />
                      Télécharger le QR code (PNG)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegen(true)}
                      className="flex h-10 cursor-pointer items-center gap-1.5 border-0 bg-transparent px-3 text-[14px] font-semibold text-mde-texte underline underline-offset-[3px]"
                    >
                      <Icon nom="refresh" className="text-[16px]" />
                      Régénérer le lien
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 border-t border-mde-bordure pt-2">
              <Bouton variante="mde" chargement={envoi} onClick={enregistrer} className="px-[18px]">
                {nouveau ? 'Créer l’événement' : 'Enregistrer l’événement'}
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
        L’ancien lien et l’ancien QR code d’inscription cesseront immédiatement de fonctionner. Les invités déjà
        inscrits ne sont pas concernés.
      </Dialogue>
    </PageSuper>
  );
}

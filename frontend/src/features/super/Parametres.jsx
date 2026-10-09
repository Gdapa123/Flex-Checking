import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, messageErreur } from '../../lib/api';
import Bouton from '../../components/ui/Bouton';
import Carte from '../../components/ui/Carte';
import Interrupteur from '../../components/ui/Interrupteur';
import Segmente from '../../components/ui/Segmente';
import Squelette from '../../components/ui/Squelette';
import { useToast } from '../../components/ui/Toasts';
import { PageSuper } from './SuperApp';
import { CHAMP_MDE, useProgrammes } from './donnees';

const VARIABLES = [
  '{civilite}',
  '{prenom}',
  '{nom}',
  '{programme}',
  '{annee}',
  '{date}',
  '{lieu}',
  '{qr_code}',
  '{code}',
  '{lien_magazine}',
];

/** SA7 · Paramètres : modèles d'emails avec aperçu, durée du scan, son, vibration. */
export default function Parametres() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: p } = useQuery({ queryKey: ['parametres'], queryFn: () => api.get('/parametres/') });
  const { data: programmes = [] } = useProgrammes();
  const [d, setD] = useState(null);
  const [onglet, setOnglet] = useState(1);
  const [programme, setProgramme] = useState('');
  const [apercu, setApercu] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const zone = useRef(null);

  useEffect(() => {
    if (p && !d) setD(p);
  }, [p, d]);

  const objet = d?.[`objetEmail${onglet}`] ?? '';
  const corps = d?.[`corpsEmail${onglet}`] ?? '';

  // aperçu HTML réel (rendu serveur), différé de 400 ms
  useEffect(() => {
    if (!d) return undefined;
    const t = setTimeout(async () => {
      try {
        setApercu(
          await api.post('/parametres/apercu-email/', {
            type: onglet === 1 ? 'INVITATION' : 'MAGAZINE',
            objet,
            corps,
            ...(programme ? { programme: Number(programme) } : {}),
          }),
        );
      } catch {
        setApercu(null);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [objet, corps, onglet, programme, d]);

  const inserer = (v) => {
    const el = zone.current;
    const debut = el?.selectionStart ?? corps.length;
    const fin = el?.selectionEnd ?? corps.length;
    const n = corps.slice(0, debut) + v + corps.slice(fin);
    setD({ ...d, [`corpsEmail${onglet}`]: n });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(debut + v.length, debut + v.length);
    });
  };

  const enregistrer = async () => {
    setEnvoi(true);
    try {
      const r = await api.patch('/parametres/', {
        objetEmail1: d.objetEmail1,
        corpsEmail1: d.corpsEmail1,
        objetEmail2: d.objetEmail2,
        corpsEmail2: d.corpsEmail2,
        dureeResultatScan: d.dureeResultatScan,
        sonActif: d.sonActif,
        vibrationActif: d.vibrationActif,
      });
      setD(r);
      qc.invalidateQueries({ queryKey: ['parametres-scan'] });
      toast('Paramètres enregistrés');
    } catch (e) {
      toast(messageErreur(e), 'erreur');
    } finally {
      setEnvoi(false);
    }
  };

  if (!d)
    return (
      <PageSuper titre="Paramètres">
        <Squelette className="h-[520px] !rounded-carte" />
      </PageSuper>
    );

  return (
    <PageSuper titre="Paramètres">
      <Carte mde as="section" className="flex flex-col gap-5 p-6" aria-labelledby="t-modeles">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="t-modeles" className="m-0 text-[17px] font-semibold">
            Modèles des emails
          </h2>
          <div role="tablist" aria-label="Email" className="flex gap-0.5 rounded-moyen bg-mde-survol p-[3px]">
            {[1, 2].map((n) => (
              <button
                key={n}
                type="button"
                role="tab"
                aria-selected={onglet === n}
                onClick={() => setOnglet(n)}
                className={`h-[38px] cursor-pointer rounded-petit border-0 px-3.5 text-[14px] font-semibold text-mde-texte ${onglet === n ? 'bg-surface shadow-onglet' : 'bg-transparent'}`}
              >
                Email n°{n} · {n === 1 ? 'inscription' : 'sur place'}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,360px),1fr))' }}>
          <div className="flex flex-col gap-3.5" role="tabpanel">
            <label className="flex flex-col gap-2 text-[15px] font-medium">
              Objet
              <input
                value={objet}
                onChange={(e) => setD({ ...d, [`objetEmail${onglet}`]: e.target.value })}
                className={CHAMP_MDE}
              />
            </label>
            <label className="flex flex-col gap-2 text-[15px] font-medium">
              Contenu
              <textarea
                ref={zone}
                rows={12}
                value={corps}
                onChange={(e) => setD({ ...d, [`corpsEmail${onglet}`]: e.target.value })}
                className="resize-y rounded-moyen border border-mde-champ px-3.5 py-3 text-[15px] leading-[1.6] text-mde-texte outline-none focus:border-mde-bordeaux focus:shadow-[0_0_0_3px_var(--mde-focus)]"
              />
            </label>
            <div className="flex flex-col gap-2">
              <span className="text-[14px] text-mde-texte-2">Insérer une variable</span>
              <div className="flex flex-wrap gap-1.5">
                {VARIABLES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => inserer(v)}
                    className="h-8 cursor-pointer rounded-petit border border-mde-bordure bg-mde-surface px-2.5 font-mono text-[13px] font-medium text-mde-texte hover:bg-mde-creme"
                  >
                    {v}
                  </button>
                ))}
              </div>
              <p className="m-0 text-[13px] leading-[1.5] text-mde-texte-2">
                {onglet === 1
                  ? '{qr_code} place la carte « QR code et code de secours ». Les infos pratiques et les boutons Agenda et Itinéraire sont toujours ajoutés.'
                  : '{lien_magazine} place la carte « Lire le magazine ».'}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[14px] text-mde-texte-2">Aperçu avec des données d’exemple</span>
              <select
                aria-label="Programme de l’aperçu"
                value={programme}
                onChange={(e) => setProgramme(e.target.value)}
                className="h-9 rounded-petit border border-mde-champ bg-surface px-2 text-[14px] text-mde-texte"
              >
                <option value="">Programme par défaut</option>
                {programmes.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nom}
                  </option>
                ))}
              </select>
            </div>
            <div className="overflow-hidden rounded-[12px] border border-bordure bg-fond">
              <div className="border-t-[6px] border-mde-bordeaux bg-mde-entete px-5 py-3 text-[15px] font-semibold text-texte">
                {apercu?.objet || '…'}
              </div>
              {apercu ? (
                <iframe
                  title="Aperçu de l’email"
                  srcDoc={apercu.html}
                  sandbox=""
                  className="block h-[620px] w-full border-0 bg-subtil"
                />
              ) : (
                <Squelette className="m-3 h-[600px]" />
              )}
            </div>
          </div>
        </div>
      </Carte>

      <Carte
        mde
        as="section"
        className="flex flex-wrap items-center justify-between gap-5 p-6"
        aria-labelledby="t-duree"
      >
        <div className="flex max-w-[520px] flex-col gap-1">
          <h2 id="t-duree" className="m-0 text-[17px] font-semibold">
            Durée d’affichage des résultats de scan
          </h2>
          <p className="m-0 text-[15px] text-mde-texte-2">
            Temps avant le retour automatique à la caméra. Toucher l’écran met le résultat en pause.
          </p>
        </div>
        <Segmente
          label="Durée"
          variante="mde"
          taille="lg"
          valeur={d.dureeResultatScan}
          onChange={(v) => setD({ ...d, dureeResultatScan: v })}
          options={[2, 3, 5].map((n) => ({ value: n, label: `${n} s` }))}
        />
      </Carte>

      <Carte mde as="section" className="flex flex-col gap-1 p-6" aria-labelledby="t-retour">
        <h2 id="t-retour" className="m-0 mb-1 text-[17px] font-semibold">
          Retours au scan
        </h2>
        <Interrupteur
          actif={d.sonActif}
          onChange={(v) => setD({ ...d, sonActif: v })}
          univers="mde"
          label="Son au scan"
          description="Activé par défaut ; désactivable sur chaque appareil."
        />
        <Interrupteur
          actif={d.vibrationActif}
          onChange={(v) => setD({ ...d, vibrationActif: v })}
          univers="mde"
          label="Vibration au scan"
          description="Sur les téléphones compatibles."
        />
        <p className="m-0 mt-2 text-[14px] text-mde-texte-2">
          Expéditeur des emails : <strong className="font-semibold text-mde-texte">{d.expediteur}</strong>
        </p>
      </Carte>

      <div className="flex justify-end">
        <Bouton variante="mde" chargement={envoi} onClick={enregistrer} className="px-[18px]">
          Enregistrer les paramètres
        </Bouton>
      </div>
    </PageSuper>
  );
}

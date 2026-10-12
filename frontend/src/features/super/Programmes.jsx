import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, messageErreur } from '../../lib/api';
import { controlesContraste, deriverTokens, estHexValide } from '../../theme/tokens';
import ThemeScope from '../../theme/ThemeScope';
import Bouton from '../../components/ui/Bouton';
import Carte from '../../components/ui/Carte';
import Dialogue from '../../components/ui/Dialogue';
import Icon from '../../components/ui/Icon';
import Interrupteur from '../../components/ui/Interrupteur';
import Logo from '../../components/ui/Logo';
import Squelette from '../../components/ui/Squelette';
import { useToast } from '../../components/ui/Toasts';
import { CadreVisee } from '../scan/composants';
import { PageSuper } from './SuperApp';
import { CHAMP_MDE, useProgrammes } from './donnees';

const VIDE = {
  nom: '',
  couleurPrincipale: '#2F3A8F',
  couleurSecondaire: '#3CC4B0',
  magazineActif: false,
  lienMagazine: '',
  actif: true,
};

/** SA3 / SA4 · Programmes : couleurs avec aperçu en direct, contraste WCAG, magazine, activation. */
export default function Programmes() {
  const { id } = useParams();
  const naviguer = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: programmes } = useProgrammes();
  const nouveau = id === 'nouveau';
  const courant = nouveau ? null : programmes?.find((p) => String(p.id) === id) || programmes?.[0];
  const [d, setD] = useState(null);
  const [erreurs, setErreurs] = useState({});
  const [dialogue, setDialogue] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    setErreurs({});
    if (nouveau) setD({ ...VIDE });
    else if (courant) setD({ ...courant });
  }, [nouveau, courant?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const valide = d && estHexValide(d.couleurPrincipale) && estHexValide(d.couleurSecondaire);
  const t = valide ? deriverTokens(d.couleurPrincipale, d.couleurSecondaire) : null;
  const controles = valide ? controlesContraste(d.couleurPrincipale, d.couleurSecondaire) : [];
  const alerte = controles.find((c) => c.cle === 'pblanc' && !c.ok);

  const enregistrer = async () => {
    setEnvoi(true);
    setErreurs({});
    try {
      const corps = {
        nom: d.nom,
        couleurPrincipale: d.couleurPrincipale,
        couleurSecondaire: d.couleurSecondaire,
        magazineActif: d.magazineActif,
        lienMagazine: d.lienMagazine,
      };
      const r = nouveau ? await api.post('/programmes/', corps) : await api.patch(`/programmes/${d.id}/`, corps);
      await qc.invalidateQueries({ queryKey: ['programmes'] });
      qc.invalidateQueries({ queryKey: ['evenements'] });
      toast(nouveau ? `Programme ${r.nom} créé` : `Couleurs du programme ${r.nom} enregistrées`);
      if (nouveau) naviguer(`/super/programmes/${r.id}`);
    } catch (e) {
      if (e.status === 400)
        setErreurs(Object.fromEntries(Object.entries(e.data).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
      else toast(messageErreur(e), 'erreur');
    } finally {
      setEnvoi(false);
    }
  };

  const basculerActivation = async () => {
    try {
      await api.patch(`/programmes/${d.id}/`, { actif: !d.actif });
      await qc.invalidateQueries({ queryKey: ['programmes'] });
      toast(`Programme ${d.nom} ${d.actif ? 'désactivé' : 'réactivé'}`);
    } catch (e) {
      toast(messageErreur(e), 'erreur');
    }
    setDialogue(null);
  };

  const supprimer = async () => {
    try {
      await api.delete(`/programmes/${d.id}/`);
      await qc.invalidateQueries({ queryKey: ['programmes'] });
      toast(`Programme ${d.nom} supprimé`);
      naviguer('/super/programmes');
    } catch (e) {
      toast(messageErreur(e), 'erreur');
    }
    setDialogue(null);
  };

  const majCouleur = (k, v) => setD({ ...d, [k]: (v.startsWith('#') ? v : `#${v}`).toUpperCase().slice(0, 7) });

  return (
    <PageSuper titre="Programmes" action="Nouveau programme" onAction={() => naviguer('/super/programmes/nouveau')}>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          {!programmes && [1, 2, 3, 4].map((k) => <Squelette key={k} className="h-[70px] !rounded-[12px]" />)}
          {programmes?.map((p) => {
            const on = !nouveau && courant?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => naviguer(`/super/programmes/${p.id}`)}
                className={`box-border flex cursor-pointer items-center gap-3.5 rounded-bouton bg-surface px-4 py-3.5 text-left text-mde-texte ${on ? 'border-2 border-mde-bordeaux' : 'border border-mde-bordure'} ${p.actif ? '' : 'opacity-60'}`}
              >
                <span className="flex flex-none overflow-hidden rounded-petit border border-mde-bordure">
                  <span className="h-10 w-[22px]" style={{ background: p.couleurPrincipale }} />
                  <span className="h-10 w-[22px]" style={{ background: p.couleurSecondaire }} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[16px] font-semibold">{p.nom}</span>
                  <span className="text-[13px] tabular-nums text-mde-texte-2">
                    {p.couleurPrincipale} · {p.couleurSecondaire}
                  </span>
                </span>
                <span
                  className={`inline-flex h-6 items-center gap-[5px] rounded-full px-2 text-[12px] font-semibold ${p.actif ? 'bg-succes-doux text-succes' : 'bg-mde-bordure-ligne text-mde-texte-2'}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${p.actif ? 'bg-succes' : 'bg-mde-texte-2'}`} />
                  {p.actif ? 'Actif' : 'Désactivé'}
                </span>
              </button>
            );
          })}
        </div>

        {d && (
          <Carte mde as="section" className="flex min-w-0 animate-in-up flex-col gap-6 p-6" aria-labelledby="t-prog">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="t-prog" className="m-0 text-[20px] font-bold tracking-[-0.02em]">
                {nouveau ? 'Nouveau programme' : `Programme ${d.nom}`}
              </h2>
              {!nouveau && <span className="text-[14px] text-mde-texte-2">{d.nbEvenements} événement(s)</span>}
            </div>

            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
              <label className="flex flex-col gap-2 text-[15px] font-medium">
                Nom du programme
                <input
                  value={d.nom}
                  onChange={(e) => setD({ ...d, nom: e.target.value })}
                  className={CHAMP_MDE}
                  placeholder="EMBA"
                />
                {erreurs.nom && <span className="text-[14px] font-normal text-erreur">{erreurs.nom}</span>}
              </label>
              {[
                ['couleurPrincipale', 'Couleur principale', 'Liseré, bouton principal, éléments actifs'],
                ['couleurSecondaire', 'Couleur secondaire', 'Cadre de visée, accents. Jamais en texte sur blanc.'],
              ].map(([k, l, aide]) => (
                <div key={k} className="flex flex-col gap-2">
                  <label htmlFor={k} className="text-[15px] font-medium">
                    {l}
                  </label>
                  <div
                    data-fw="1"
                    className="flex h-12 items-center gap-2.5 rounded-moyen border border-mde-champ px-1.5"
                  >
                    <input
                      type="color"
                      aria-label={`${l} (sélecteur)`}
                      value={estHexValide(d[k]) ? d[k] : '#000000'}
                      onChange={(e) => majCouleur(k, e.target.value)}
                      className="h-9 w-9 cursor-pointer border-0 bg-transparent p-0"
                    />
                    <input
                      id={k}
                      value={d[k]}
                      onChange={(e) => majCouleur(k, e.target.value)}
                      className="min-w-0 flex-1 border-0 bg-transparent font-mono text-[16px] font-medium uppercase text-mde-texte outline-none"
                    />
                  </div>
                  <span
                    className={`text-[13px] ${erreurs[k] || !estHexValide(d[k]) ? 'text-erreur' : 'text-mde-texte-2'}`}
                  >
                    {erreurs[k] || (!estHexValide(d[k]) ? 'Couleur au format #RRGGBB attendue.' : aide)}
                  </span>
                </div>
              ))}
            </div>

            {t && (
              <div className="flex flex-col gap-2.5">
                <span className="text-[15px] font-semibold">Tokens dérivés</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['primary-hover', t.primary_hover],
                    ['primary-soft', t.primary_soft],
                    ['secondary-soft', t.secondary_soft],
                    ['on-primary', t.on_primary],
                    ['on-secondary', t.on_secondary],
                    ['en-tête', t.header],
                  ].map(([k, c]) => (
                    <div
                      key={k}
                      className="flex h-9 items-center gap-2 rounded-petit border border-mde-bordure py-0 pl-1.5 pr-2.5 text-[13px]"
                    >
                      <span className="h-6 w-6 rounded-puce border border-mde-bordure" style={{ background: c }} />
                      <span className="font-medium">{k}</span>
                      <span className="font-mono text-mde-texte-2">{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {t && (
              <div className="flex flex-col gap-2.5">
                <span className="text-[15px] font-semibold">Contrôle des contrastes</span>
                {controles.map((c) => (
                  <div
                    key={c.cle}
                    className={`flex items-center gap-3 rounded-moyen px-3 py-2.5 text-[15px] ${c.ok ? 'bg-succes-fond' : 'bg-erreur-doux'}`}
                  >
                    <Icon
                      nom={c.ok ? 'checkCircle' : 'alertCircle'}
                      className={`text-[18px] ${c.ok ? 'text-succes' : 'text-erreur'}`}
                    />
                    <span className="flex-1">{c.label}</span>
                    <span className="font-semibold tabular-nums">{c.ratio.toFixed(1).replace('.', ',')}:1</span>
                    <span
                      className={`w-[92px] text-right text-[13px] font-semibold ${c.ok ? 'text-succes' : 'text-erreur'}`}
                    >
                      {c.ok ? (c.min >= 4.5 ? 'AA texte' : 'AA éléments') : 'Insuffisant'}
                    </span>
                  </div>
                ))}
                {alerte && (
                  <div
                    role="alert"
                    className="flex gap-2.5 rounded-moyen border border-erreur-bord bg-erreur-doux px-3.5 py-3 text-[15px] leading-[1.45] text-erreur-texte"
                  >
                    <Icon nom="alertCircle" className="text-[20px] text-erreur" />
                    <span>
                      La couleur principale ne permet pas un texte blanc lisible (4,5:1 minimum). Le texte des boutons
                      passera automatiquement en #141414, ou choisissez une teinte plus foncée.
                    </span>
                  </div>
                )}
              </div>
            )}

            {t && (
              <div className="flex flex-col gap-2.5">
                <span className="text-[15px] font-semibold">Aperçu en direct</span>
                <ThemeScope
                  principale={d.couleurPrincipale}
                  secondaire={d.couleurSecondaire}
                  className="grid gap-3 text-texte"
                  style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}
                >
                  <div className="overflow-hidden rounded-[12px] border border-bordure bg-fond">
                    <div className="flex flex-col gap-1.5 border-t-[6px] border-p bg-gradient-to-b from-hd to-fond p-4">
                      <span className="text-[12px] text-texte-2">Formulaire invité</span>
                      <span className="text-[20px] font-bold tracking-[-0.025em]">Graduation {d.nom || '…'} 2026</span>
                    </div>
                    <div className="flex flex-col gap-2.5 px-4 pb-4">
                      <div className="grid w-[140px] grid-cols-2 gap-1 rounded-moyen bg-subtil p-1">
                        <span className="flex h-[30px] items-center justify-center rounded-[7px] bg-p text-[13px] font-semibold text-op">
                          Mme
                        </span>
                        <span className="flex h-[30px] items-center justify-center text-[13px] font-semibold">M.</span>
                      </div>
                      <div className="flex h-10 items-center justify-center rounded-moyen bg-p text-[14px] font-semibold text-op">
                        Confirmer mon inscription
                      </div>
                      <span className="self-start rounded-full bg-ps px-2.5 py-1 text-[13px] font-semibold text-p">
                        Élément actif
                      </span>
                    </div>
                  </div>
                  <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 overflow-hidden rounded-[12px] border-t-[6px] border-p bg-g-fond p-5">
                    <CadreVisee phase="attente" taille={110} coin={28} epaisseur={3} rayon={10} />
                    <span className="text-[12px] text-g-texte-2">Cadre de visée · scan</span>
                  </div>
                  <div className="overflow-hidden rounded-[12px] border border-bordure bg-fond">
                    <div className="entete-degrade flex flex-col gap-3 p-4">
                      <Logo variante={t.on_primary === '#FFFFFF' ? 'blanc' : 'rouge'} hauteur={26} />
                      <span className="text-[18px] font-extrabold tracking-[-0.03em]">
                        Graduation {d.nom || '…'} 2026
                      </span>
                      <span className="h-1 w-10 rounded-sm bg-s" />
                    </div>
                    <div className="p-3">
                      <div className="rounded-[10px] border border-bordure-carte bg-surface p-3 text-[12px] text-texte-3">
                        Email n°1 · invitation
                      </div>
                    </div>
                  </div>
                </ThemeScope>
              </div>
            )}

            <div className="flex flex-col gap-2 border-t border-mde-bordure pt-4">
              <span className="text-[15px] font-semibold">Email n°2 · magazine</span>
              <label className="flex flex-col gap-2 text-[15px] font-medium">
                Lien du magazine
                <input
                  type="url"
                  value={d.lienMagazine}
                  onChange={(e) => setD({ ...d, lienMagazine: e.target.value })}
                  placeholder="https://mde.ci/magazine/…"
                  className={CHAMP_MDE}
                />
                {erreurs.lienMagazine && (
                  <span className="text-[14px] font-normal text-erreur">{erreurs.lienMagazine}</span>
                )}
              </label>
              <Interrupteur
                actif={d.magazineActif}
                onChange={(v) => setD({ ...d, magazineActif: v })}
                univers="mde"
                label="Envoyer l’email n°2 au passage « Présent »"
                description="Une seule fois par invité, avec le lien du magazine."
              />
            </div>

            <div className="flex flex-wrap justify-between gap-2 border-t border-mde-bordure pt-2">
              <div className="flex flex-wrap gap-2">
                {!nouveau && (
                  <Bouton
                    variante="mde-secondaire"
                    icone="power"
                    onClick={() => (d.actif ? setDialogue('desactiver') : basculerActivation())}
                  >
                    {d.actif ? 'Désactiver le programme' : 'Réactiver le programme'}
                  </Bouton>
                )}
                {!nouveau && d.nbEvenements === 0 && (
                  <Bouton
                    variante="fantome"
                    icone="trash"
                    className="!text-erreur"
                    onClick={() => setDialogue('supprimer')}
                  >
                    Supprimer
                  </Bouton>
                )}
              </div>
              <Bouton variante="mde" chargement={envoi} disabled={!valide} onClick={enregistrer} className="px-[18px]">
                {nouveau ? 'Créer le programme' : 'Enregistrer'}
              </Bouton>
            </div>
          </Carte>
        )}
      </div>
      <Dialogue
        ouvert={dialogue === 'desactiver'}
        titre={`Désactiver le programme ${d?.nom} ?`}
        onFermer={() => setDialogue(null)}
        actions={
          <>
            <Bouton variante="mde-secondaire" onClick={() => setDialogue(null)} data-autofocus>
              Annuler
            </Bouton>
            <Bouton variante="destructif" onClick={basculerActivation}>
              Désactiver
            </Bouton>
          </>
        }
      >
        Les événements existants et leurs données restent consultables. Aucun nouvel événement ne pourra être créé avec
        ce programme tant qu’il est désactivé.
      </Dialogue>
      <Dialogue
        ouvert={dialogue === 'supprimer'}
        titre={`Supprimer le programme ${d?.nom} ?`}
        tonalite="erreur"
        icone="trash"
        onFermer={() => setDialogue(null)}
        actions={
          <>
            <Bouton variante="mde-secondaire" onClick={() => setDialogue(null)} data-autofocus>
              Annuler
            </Bouton>
            <Bouton variante="destructif" onClick={supprimer}>
              Supprimer
            </Bouton>
          </>
        }
      >
        Ce programme n’a aucun événement. Sa suppression est définitive.
      </Dialogue>
    </PageSuper>
  );
}

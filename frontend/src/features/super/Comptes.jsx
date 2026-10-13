import { useId, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, messageErreur } from '../../lib/api';
import { jourHeure } from '../../lib/format';
import Bouton from '../../components/ui/Bouton';
import BoutonIcone from '../../components/ui/BoutonIcone';
import Carte from '../../components/ui/Carte';
import Dialogue from '../../components/ui/Dialogue';
import DialogueSuppression from '../../components/ui/DialogueSuppression';
import Icon from '../../components/ui/Icon';
import Squelette from '../../components/ui/Squelette';
import { useToast } from '../../components/ui/Toasts';
import { useMoi } from '../auth/useMoi';
import { PageSuper } from './SuperApp';
import { CHAMP_MDE, useAdmins, useEvenements } from './donnees';

/**
 * SA6 · Comptes admins : création (mot de passe temporaire affiché une fois), modification, désactivation,
 * réinitialisation, suppression, affectations.
 */
export default function Comptes() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: admins } = useAdmins();
  const { data: evenements = [] } = useEvenements();
  const [formulaire, setFormulaire] = useState(null); // création ({ id: undefined }) ou modification d'un compte
  const [erreurs, setErreurs] = useState({});
  const [envoi, setEnvoi] = useState(false);
  const idFormulaire = useId();
  const [mdp, setMdp] = useState(null);
  const [confirmer, setConfirmer] = useState(null);
  const [suppression, setSuppression] = useState(null);
  const { data: moi } = useMoi();
  const aujourdHui = new Date().toISOString().slice(0, 10);
  const colonnes = evenements.filter((e) => e.date >= aujourdHui).sort((a, b) => a.date.localeCompare(b.date));
  const rafraichir = () => {
    qc.invalidateQueries({ queryKey: ['admins'] });
    qc.invalidateQueries({ queryKey: ['evenements'] });
  };

  const affecter = async (admin, ev) => {
    const ids = admin.evenements.includes(ev.id)
      ? admin.evenements.filter((x) => x !== ev.id)
      : [...admin.evenements, ev.id];
    try {
      await api.patch(`/admins/${admin.id}/`, { evenements: ids });
      rafraichir();
    } catch (e) {
      toast(messageErreur(e), 'erreur');
    }
  };

  const ouvrirFormulaire = (valeur) => {
    setErreurs({});
    setFormulaire(valeur);
  };

  const enregistrer = async () => {
    if (envoi) return;
    setErreurs({});
    setEnvoi(true);
    const { id, nom, email, role } = formulaire;
    try {
      if (id) {
        const r = await api.patch(`/admins/${id}/`, { nom, email, role });
        toast(`Compte modifié · ${r.nom}`);
      } else {
        const r = await api.post('/admins/', formulaire);
        setMdp({ nom: r.nom, email: r.email, mdp: r.motDePasseTemporaire });
      }
      setFormulaire(null);
      rafraichir();
    } catch (e) {
      if (e.status === 400 && e.data && !e.data.detail)
        setErreurs(Object.fromEntries(Object.entries(e.data).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
      else toast(messageErreur(e), 'erreur');
    } finally {
      setEnvoi(false);
    }
  };

  const executer = async () => {
    const { type, admin } = confirmer;
    try {
      if (type === 'mdp') {
        const r = await api.post(`/admins/${admin.id}/reinitialiser-mot-de-passe/`);
        setMdp({ nom: admin.nom, email: admin.email, mdp: r.motDePasseTemporaire });
      } else {
        await api.patch(`/admins/${admin.id}/`, { actif: !admin.actif });
        toast(`Compte ${admin.actif ? 'désactivé' : 'réactivé'} · ${admin.nom}`);
      }
      rafraichir();
    } catch (e) {
      toast(messageErreur(e), 'erreur');
    }
    setConfirmer(null);
  };

  const supprimer = async () => {
    try {
      await api.delete(`/admins/${suppression.id}/`);
      toast(`Compte supprimé · ${suppression.nom}`);
      rafraichir();
      setSuppression(null);
    } catch (e) {
      toast(messageErreur(e), 'erreur');
    }
  };

  return (
    <PageSuper
      titre="Comptes admins"
      action="Créer un compte"
      onAction={() => ouvrirFormulaire({ nom: '', email: '', role: 'ADMIN', evenements: [] })}
    >
      <Carte mde as="section" className="overflow-hidden" aria-labelledby="t-comptes">
        <div className="border-b border-mde-bordure px-5 py-4">
          <h2 id="t-comptes" className="m-0 text-[17px] font-semibold">
            Comptes et affectation aux cérémonies
          </h2>
        </div>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-[15px]">
            <thead>
              <tr className="bg-mde-entete text-[13px] text-mde-texte-2">
                <th className="px-5 py-3 text-left font-semibold">Compte</th>
                <th className="p-3 text-left font-semibold">Rôle</th>
                <th className="p-3 text-left font-semibold">Statut</th>
                {colonnes.map((e) => (
                  <th key={e.id} className="px-2 py-3 text-center text-[12px] font-semibold">
                    <div className="flex flex-col items-center gap-1">
                      <span className="h-1 w-4 rounded-sm" style={{ background: e.tokens.p }} />
                      {e.programmeNom} {e.annee}
                    </div>
                  </th>
                ))}
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!admins &&
                [1, 2, 3].map((k) => (
                  <tr key={k}>
                    <td colSpan={colonnes.length + 4} className="px-5 py-3.5">
                      <Squelette />
                    </td>
                  </tr>
                ))}
              {admins?.map((a) => (
                <tr key={a.id} className="border-t border-mde-bordure-ligne transition-colors hover:bg-mde-entete">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mde-creme text-[13px] font-semibold">
                        {a.initiales}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-semibold">{a.nom}</span>
                        <span className="text-[13px] text-mde-texte-2">{a.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">{a.role === 'SUPER_ADMIN' ? 'Super admin' : 'Admin'}</td>
                  <td className="p-3">
                    <span
                      className={`inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[13px] font-semibold ${a.actif ? (a.doitChangerMotDePasse ? 'bg-avert-fond text-avert' : 'bg-succes-doux text-succes') : 'bg-mde-bordure-ligne text-mde-texte-2'}`}
                    >
                      <Icon
                        nom={a.actif ? (a.doitChangerMotDePasse ? 'clock' : 'check') : 'power'}
                        className="text-[13px]"
                      />
                      {a.actif ? (a.doitChangerMotDePasse ? 'Mot de passe temporaire' : 'Actif') : 'Désactivé'}
                    </span>
                    {a.derniereConnexion && (
                      <div className="mt-1 text-[12px] text-mde-texte-2">Vu le {jourHeure(a.derniereConnexion)}</div>
                    )}
                  </td>
                  {colonnes.map((e) => (
                    <td key={e.id} className="p-2 text-center">
                      {a.role === 'SUPER_ADMIN' ? (
                        <span
                          className="text-[13px] text-mde-texte-2"
                          title="Le super admin voit toutes les cérémonies"
                        >
                          Tous
                        </span>
                      ) : (
                        <label className="inline-flex h-11 w-11 cursor-pointer items-center justify-center">
                          <input
                            type="checkbox"
                            aria-label={`${a.nom} · ${e.nomAffiche}`}
                            checked={a.evenements.includes(e.id)}
                            onChange={() => affecter(a, e)}
                            className="h-[18px] w-[18px] cursor-pointer accent-mde-bordeaux"
                          />
                        </label>
                      )}
                    </td>
                  ))}
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <BoutonIcone
                        icone="edit"
                        libelle={`Modifier le compte de ${a.nom}`}
                        onClick={() => ouvrirFormulaire({ id: a.id, nom: a.nom, email: a.email, role: a.role })}
                      />
                      <BoutonIcone
                        icone="key"
                        libelle={`Réinitialiser le mot de passe de ${a.nom}`}
                        onClick={() => setConfirmer({ type: 'mdp', admin: a })}
                      />
                      {/* son propre compte : ni désactivation ni suppression (refusées par le serveur) */}
                      {moi?.id !== a.id && (
                        <BoutonIcone
                          icone="power"
                          libelle={`${a.actif ? 'Désactiver' : 'Réactiver'} le compte de ${a.nom}`}
                          onClick={() => setConfirmer({ type: 'actif', admin: a })}
                        />
                      )}
                      {moi?.id !== a.id && (
                        <BoutonIcone
                          icone="trash"
                          variante="danger"
                          libelle={`Supprimer le compte de ${a.nom}`}
                          onClick={() => setSuppression(a)}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Carte>

      <Dialogue
        ouvert={!!formulaire}
        titre={formulaire?.id ? `Modifier le compte de ${formulaire.nom || '…'}` : 'Créer un compte'}
        icone={formulaire?.id ? 'edit' : 'userPlus'}
        tonalite="info"
        onFermer={() => setFormulaire(null)}
        actions={
          <>
            <Bouton variante="mde-secondaire" onClick={() => setFormulaire(null)}>
              Annuler
            </Bouton>
            <Bouton variante="mde" type="submit" form={idFormulaire} chargement={envoi}>
              {formulaire?.id ? 'Enregistrer' : 'Créer le compte'}
            </Bouton>
          </>
        }
      >
        {formulaire && (
          <form
            id={idFormulaire}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              enregistrer();
            }}
            className="flex flex-col gap-3 text-mde-texte"
          >
            {!formulaire.id && <p className="m-0">Un mot de passe temporaire sera généré et affiché une seule fois.</p>}
            {[
              ['nom', 'Nom complet', 'text'],
              ['email', 'Email', 'email'],
            ].map(([k, l, t]) => (
              <label key={k} className="flex flex-col gap-1.5 text-[15px] font-medium">
                {l}
                <input
                  type={t}
                  value={formulaire[k]}
                  data-autofocus={k === 'nom' || undefined}
                  onChange={(e) => setFormulaire({ ...formulaire, [k]: e.target.value })}
                  className={CHAMP_MDE}
                />
                {erreurs[k] && <span className="text-[14px] font-normal text-erreur">{erreurs[k]}</span>}
              </label>
            ))}
            <label className="flex flex-col gap-1.5 text-[15px] font-medium">
              Rôle
              <select
                value={formulaire.role}
                disabled={formulaire.id === moi?.id}
                onChange={(e) => setFormulaire({ ...formulaire, role: e.target.value })}
                className={CHAMP_MDE}
              >
                <option value="ADMIN">Admin (cérémonies affectées)</option>
                <option value="SUPER_ADMIN">Super admin</option>
              </select>
              {formulaire.id === moi?.id && (
                <span className="text-[13px] font-normal text-mde-texte-2">
                  Vous ne pouvez pas changer votre propre rôle.
                </span>
              )}
              {erreurs.role && <span className="text-[14px] font-normal text-erreur">{erreurs.role}</span>}
            </label>
            {(erreurs.nonFieldErrors || erreurs.evenements) && (
              <p role="alert" className="m-0 text-[14px] text-erreur">
                {erreurs.nonFieldErrors || erreurs.evenements}
              </p>
            )}
          </form>
        )}
      </Dialogue>

      <Dialogue
        ouvert={!!confirmer}
        titre={
          confirmer?.type === 'mdp'
            ? `Réinitialiser le mot de passe de ${confirmer?.admin.nom} ?`
            : `${confirmer?.admin.actif ? 'Désactiver' : 'Réactiver'} le compte de ${confirmer?.admin.nom} ?`
        }
        onFermer={() => setConfirmer(null)}
        actions={
          <>
            <Bouton variante="mde-secondaire" onClick={() => setConfirmer(null)} data-autofocus>
              Annuler
            </Bouton>
            <Bouton
              variante={confirmer?.type === 'actif' && confirmer?.admin.actif ? 'destructif' : 'mde'}
              onClick={executer}
            >
              Confirmer
            </Bouton>
          </>
        }
      >
        {confirmer?.type === 'mdp'
          ? 'Un nouveau mot de passe temporaire sera généré ; l’ancien ne fonctionnera plus. Il devra être changé à la prochaine connexion.'
          : confirmer?.admin.actif
            ? 'Le compte ne pourra plus se connecter. Son historique reste dans le journal.'
            : 'Le compte pourra de nouveau se connecter.'}
      </Dialogue>

      <Dialogue
        ouvert={!!mdp}
        titre="Mot de passe temporaire"
        icone="lock"
        tonalite="info"
        fermable={false}
        onFermer={() => setMdp(null)}
        actions={
          <Bouton variante="mde" onClick={() => setMdp(null)} data-autofocus>
            J’ai noté le mot de passe
          </Bouton>
        }
      >
        {mdp && (
          <div className="flex flex-col gap-3">
            <p className="m-0">
              Transmettez ce mot de passe à {mdp.nom} ({mdp.email}). Il ne sera plus jamais affiché et devra être changé
              à la première connexion.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex h-12 flex-1 items-center rounded-moyen border border-mde-bordure bg-mde-surface px-3.5 font-mono text-[18px] font-semibold tracking-wider text-mde-texte">
                {mdp.mdp}
              </code>
              <Bouton
                variante="mde-secondaire"
                icone="copy"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(mdp.mdp);
                    toast('Mot de passe copié');
                  } catch {
                    toast('Copie impossible : sélectionnez le mot de passe et copiez-le manuellement.', 'erreur');
                  }
                }}
              >
                Copier
              </Bouton>
            </div>
          </div>
        )}
      </Dialogue>
      <DialogueSuppression
        ouvert={!!suppression}
        titre={`Supprimer le compte de ${suppression?.nom} ?`}
        onConfirmer={supprimer}
        onFermer={() => setSuppression(null)}
      >
        Le compte ne pourra plus se connecter et disparaît de la liste. Les émargements qu’il a enregistrés restent dans
        l’historique des invités (« Compte supprimé »). Pour une simple pause, préférez « Désactiver ».
      </DialogueSuppression>
    </PageSuper>
  );
}

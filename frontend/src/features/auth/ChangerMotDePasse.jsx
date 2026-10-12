import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, messageErreur } from '../../lib/api';
import Bouton from '../../components/ui/Bouton';
import Champ from '../../components/ui/Champ';
import Logo from '../../components/ui/Logo';
import { useDeconnexion } from './useMoi';

/** Changement obligatoire du mot de passe temporaire à la première connexion. */
export default function ChangerMotDePasse({ univers }) {
  const [v, setV] = useState({ actuel: '', nouveau: '', confirmation: '' });
  const [err, setErr] = useState({});
  const [envoi, setEnvoi] = useState(false);
  const qc = useQueryClient();
  const naviguer = useNavigate();
  const deconnexion = useDeconnexion();
  const [sortie, setSortie] = useState(false);
  const mde = univers === 'mde';
  const maj = (k) => (e) => setV({ ...v, [k]: e.target.value });

  const soumettre = async (e) => {
    e.preventDefault();
    const er = {};
    if (!v.actuel) er.actuel = 'Indiquez le mot de passe temporaire.';
    if (v.nouveau.length < 10) er.nouveau = '10 caractères minimum.';
    if (v.nouveau !== v.confirmation) er.confirmation = 'Les deux mots de passe ne correspondent pas.';
    setErr(er);
    if (Object.keys(er).length) return;
    setEnvoi(true);
    try {
      await api.post('/auth/mot-de-passe/', { actuel: v.actuel, nouveau: v.nouveau });
      await qc.invalidateQueries({ queryKey: ['moi'] });
    } catch (ex) {
      setErr({
        actuel: ex.data?.actuel?.[0],
        nouveau: ex.data?.nouveau?.[0] || (!ex.data?.actuel && messageErreur(ex)),
      });
      setEnvoi(false);
    }
  };

  // Sortie possible sans le mot de passe temporaire (poste partagé, mauvais compte)
  const seDeconnecter = async () => {
    setSortie(true);
    try {
      await deconnexion();
    } finally {
      naviguer(mde ? '/super/connexion' : '/connexion', { replace: true });
    }
  };

  return (
    <main
      className={`flex min-h-screen items-center justify-center border-t-[6px] px-4 py-10 ${mde ? 'univers-mde border-mde-bordeaux bg-mde-nuit' : 'border-texte'}`}
    >
      <form
        onSubmit={soumettre}
        noValidate
        className={`flex w-full max-w-[420px] animate-in-up flex-col gap-5 rounded-carte border p-6 sm:p-8 ${
          mde
            ? 'border-mde-bordure-carte bg-mde-surface text-mde-texte'
            : 'border-bordure-carte bg-surface shadow-carte'
        }`}
      >
        <Logo hauteur={40} />
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-[24px] font-bold tracking-[-0.02em]">Choisissez votre mot de passe</h1>
          <p className="m-0 text-[15px] text-texte-2">
            Le mot de passe temporaire doit être remplacé avant de continuer.
          </p>
        </div>
        <Champ
          label="Mot de passe temporaire"
          type="password"
          autoComplete="current-password"
          value={v.actuel}
          onChange={maj('actuel')}
          erreur={err.actuel}
          hauteur={48}
          univers={univers}
        />
        <Champ
          label="Nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          value={v.nouveau}
          onChange={maj('nouveau')}
          erreur={err.nouveau}
          aide="10 caractères minimum."
          hauteur={48}
          univers={univers}
        />
        <Champ
          label="Confirmation"
          type="password"
          autoComplete="new-password"
          value={v.confirmation}
          onChange={maj('confirmation')}
          erreur={err.confirmation}
          hauteur={48}
          univers={univers}
        />
        <Bouton type="submit" taille="xl" variante={mde ? 'mde' : 'principal'} chargement={envoi}>
          Enregistrer et continuer
        </Bouton>
        <Bouton
          type="button"
          variante={mde ? 'mde-secondaire' : 'secondaire'}
          icone="logout"
          chargement={sortie}
          onClick={seDeconnecter}
        >
          Ce n’est pas mon compte · Se déconnecter
        </Bouton>
      </form>
    </main>
  );
}

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, messageErreur } from '../../lib/api';
import Bouton from '../../components/ui/Bouton';
import Champ from '../../components/ui/Champ';
import Icon from '../../components/ui/Icon';

/**
 * Adresse de retour après connexion : uniquement un chemin interne à l'application. Refuse « //hôte »,
 * « /\\hôte » et tout schéma (redirection ouverte vers un site tiers).
 */
export function cheminInterne(chemin) {
  if (typeof chemin !== 'string' || !chemin.startsWith('/')) return null;
  if (/^\/[\\/]/.test(chemin) || chemin.includes('\\')) return null;
  if ([...chemin].some((c) => c.charCodeAt(0) < 32)) return null; // caractères de contrôle
  return chemin;
}

/** Formulaire email + mot de passe commun aux deux connexions. */
export default function FormulaireConnexion({ univers, destination, enTete, piedDePage }) {
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const naviguer = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const mde = univers === 'mde';

  const soumettre = async (e) => {
    e.preventDefault();
    if (envoi) return;
    setErreur('');
    if (!email.trim() || !mdp) {
      setErreur('Indiquez votre email et votre mot de passe.');
      return;
    }
    setEnvoi(true);
    try {
      const moi = await api.post('/auth/connexion/', { email: email.trim(), motDePasse: mdp });
      qc.setQueryData(['moi'], moi);
      const depuis = cheminInterne(location.state?.depuis);
      naviguer(depuis || destination(moi), { replace: true });
    } catch (err) {
      setErreur(err.status === 401 ? 'Email ou mot de passe incorrect.' : messageErreur(err));
      setEnvoi(false);
    }
  };

  return (
    <form
      onSubmit={soumettre}
      noValidate
      className={`relative box-border flex w-full max-w-[400px] animate-in-up flex-col gap-5 rounded-carte border p-6 sm:p-8 ${
        mde
          ? 'border-mde-bordure-carte bg-mde-surface text-mde-texte shadow-connexion'
          : 'border-bordure-carte bg-surface shadow-carte'
      }`}
    >
      {enTete}
      {erreur && (
        <p
          role="alert"
          className="m-0 flex items-start gap-2 rounded-[12px] border border-erreur-bord bg-erreur-doux p-3 text-[15px] text-erreur-texte"
        >
          <Icon nom="alertCircle" className="mt-0.5 text-[18px] text-erreur" />
          {erreur}
        </p>
      )}
      <Champ
        label="Email"
        type="email"
        autoComplete="username"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        hauteur={48}
        univers={univers}
      />
      <Champ
        label="Mot de passe"
        type="password"
        autoComplete="current-password"
        value={mdp}
        onChange={(e) => setMdp(e.target.value)}
        hauteur={48}
        univers={univers}
      />
      <Bouton
        type="submit"
        taille="xl"
        variante={mde ? 'mde' : 'principal'}
        chargement={envoi}
        className={mde ? '' : '!bg-texte !text-blanc !shadow-none'}
      >
        {envoi ? 'Connexion…' : 'Se connecter'}
      </Bouton>
      {piedDePage}
    </form>
  );
}

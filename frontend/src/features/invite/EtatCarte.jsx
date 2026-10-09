import { useState } from 'react';
import { api } from '../../lib/api';
import { dateLongue } from '../../lib/format';
import Bouton from '../../components/ui/Bouton';
import { useToast } from '../../components/ui/Toasts';
import { IconeTuile } from './commun';

const CONTACT = 'mailto:evenements@mde.ci';

/** I4 à I7 · écrans d'état (fermé, complet, date limite, déjà inscrit). */
export default function EtatCarte({ ev, etat, email, onAutreAdresse }) {
  const toast = useToast();
  const [envoi, setEnvoi] = useState(false);
  const nom = ev.nomAffiche;
  const ETATS = {
    FERME: {
      icone: 'lock',
      titre: 'Les inscriptions sont fermées',
      texte: `Les inscriptions à la ${nom} sont closes. Pour toute demande, contactez l’équipe événementielle de MDE Business School.`,
    },
    DATE_LIMITE: {
      icone: 'clock',
      titre: 'La date limite d’inscription est dépassée',
      texte: `La date limite d’inscription à la ${nom} était fixée au ${dateLongue(ev.dateLimiteInscription, false)}. Pour toute demande, contactez l’équipe événementielle de MDE Business School.`,
    },
    COMPLET: {
      icone: 'users',
      titre: 'L’événement est complet',
      texte: `Toutes les places de la ${nom} ont été attribuées. Contactez l’équipe MDE pour être informé(e) si une place se libère.`,
    },
    DEJA_INSCRIT: {
      icone: 'mail',
      titre: 'Cette adresse est déjà inscrite',
      texte: `Une inscription à la ${nom} existe déjà avec cette adresse email. Nous pouvons vous renvoyer votre invitation.`,
    },
  };
  const e = ETATS[etat] || ETATS.FERME;
  const deja = etat === 'DEJA_INSCRIT';

  const renvoyer = async () => {
    if (envoi) return;
    setEnvoi(true);
    try {
      const r = await api.post(`/public/evenements/${ev.slug}/renvoi-qr/`, { email });
      toast(r.detail);
    } catch (err) {
      toast(
        err.status === 429
          ? 'Trop de demandes de renvoi. Réessayez dans une heure.'
          : 'Envoi impossible pour le moment. Réessayez.',
        'erreur',
      );
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <main className="relative mx-auto -mt-10 max-w-[560px] px-3 pb-10">
      <section className="flex animate-in-up flex-col items-center gap-4 rounded-carte border border-bordure-carte bg-surface px-6 py-8 text-center shadow-carte">
        <IconeTuile nom={e.icone} />
        <h2 className="m-0 text-[24px] font-bold tracking-[-0.02em] [text-wrap:balance]">{e.titre}</h2>
        <p className="m-0 max-w-[400px] text-[16px] leading-[1.55] text-texte-2 [text-wrap:pretty]">{e.texte}</p>
        {deja && (
          <Bouton taille="xl" icone="send" chargement={envoi} onClick={renvoyer} className="mt-2 rounded-moyen px-6">
            {envoi ? 'Envoi en cours…' : 'Renvoyer mon QR code'}
          </Bouton>
        )}
        {deja ? (
          <Bouton variante="secondaire" taille="lg" onClick={onAutreAdresse} className="text-[16px]">
            Utiliser une autre adresse
          </Bouton>
        ) : (
          <a
            href={CONTACT}
            className="flex h-12 items-center rounded-moyen border border-champ bg-surface px-5 text-[16px] font-semibold text-texte no-underline hover:bg-fond hover:text-texte"
          >
            Contacter MDE
          </a>
        )}
      </section>
    </main>
  );
}

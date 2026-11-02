import { dateLongue } from '../../lib/format';
import { IconeTuile } from './commun';

const CONTACT = 'mailto:evenements@mde.ci';

/** I4 à I6 · écrans d'état (fermé, complet, date limite). L'écran I7 « déjà inscrit » n'existe plus : une
 * adresse déjà inscrite reçoit la même réponse qu'une inscription réussie (ADR-005). */
export default function EtatCarte({ ev, etat }) {
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
  };
  const e = ETATS[etat] || ETATS.FERME;
  return (
    <main className="relative mx-auto -mt-10 max-w-[560px] px-3 pb-10">
      <section className="flex animate-in-up flex-col items-center gap-4 rounded-carte border border-bordure-carte bg-surface px-6 py-8 text-center shadow-carte">
        <IconeTuile nom={e.icone} />
        <h2 className="m-0 text-[24px] font-bold tracking-[-0.02em] [text-wrap:balance]">{e.titre}</h2>
        <p className="m-0 max-w-[400px] text-[16px] leading-[1.55] text-texte-2 [text-wrap:pretty]">{e.texte}</p>
        <a
          href={CONTACT}
          className="flex h-12 items-center rounded-bouton border border-champ bg-surface px-5 text-[16px] font-semibold text-texte no-underline hover:bg-fond hover:text-texte"
        >
          Contacter MDE
        </a>
      </section>
    </main>
  );
}

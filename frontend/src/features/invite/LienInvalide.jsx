import Icon from '../../components/ui/Icon';
import Logo from '../../components/ui/Logo';
import useTitre from '../../lib/useTitre';

/** I8 · Lien invalide : repli sur la palette MDE. */
export default function LienInvalide() {
  useTitre('Lien invalide');
  return (
    <div className="univers-mde min-h-[100dvh] border-t-[6px] border-mde-bordeaux bg-mde-surface text-mde-texte">
      <div className="entete-mde entete-mde-invalide px-5 pb-14 pt-[22px]">
        <div className="mx-auto max-w-[560px]">
          <Logo variante="blanc" hauteur={40} />
        </div>
      </div>
      <main className="mx-auto -mt-8 max-w-[560px] px-3 pb-10">
        <section className="flex animate-in-up flex-col items-center gap-4 rounded-carte border border-mde-bordure bg-surface px-6 py-8 text-center shadow-carte-mde">
          <div className="flex h-14 w-14 items-center justify-center rounded-[12px] bg-mde-jaune-clair text-[26px] text-mde-texte">
            <Icon nom="link" />
          </div>
          <h1 className="m-0 text-[24px] font-bold tracking-[-0.02em]">Ce lien n’est plus valide</h1>
          <p className="m-0 max-w-[400px] text-[16px] leading-[1.55] text-mde-texte-2 [text-wrap:pretty]">
            Le lien d’inscription utilisé est incorrect ou a expiré. Vérifiez l’adresse reçue ou contactez l’équipe
            événementielle de MDE Business School.
          </p>
          <a
            href="https://mde.ci"
            className="mt-2 flex h-[52px] items-center gap-2 rounded-moyen bg-mde-bordeaux px-6 text-[16px] font-semibold text-blanc no-underline transition-colors hover:bg-mde-bordeaux-survol hover:text-blanc"
          >
            Aller sur mde.ci
            <Icon nom="external" className="text-[18px]" />
          </a>
        </section>
      </main>
    </div>
  );
}

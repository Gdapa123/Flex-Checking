import Icon from '../../components/ui/Icon';
import Logo from '../../components/ui/Logo';
import useTitre from '../../lib/useTitre';
import FormulaireConnexion from './FormulaireConnexion';

/** SA1 · Connexion super admin (univers MDE). */
export default function ConnexionSuper() {
  useTitre('Super admin');
  return (
    <main className="univers-mde relative flex min-h-screen items-center justify-center overflow-hidden border-t-[6px] border-mde-bordeaux bg-mde-nuit px-4 py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 hachures-plein opacity-5" />
      <FormulaireConnexion
        univers="mde"
        destination={() => '/super'}
        enTete={
          <>
            <div className="flex items-center justify-between gap-3">
              <Logo hauteur={40} />
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-mde-jaune px-2.5 text-[13px] font-semibold text-mde-texte">
                <Icon nom="shield" className="text-[14px]" />
                Super admin
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <h1 className="m-0 text-[26px] font-bold tracking-[-0.025em]">Configuration globale</h1>
              <p className="m-0 text-[15px] text-mde-texte-2">Accès réservé à l’équipe MDE Business School.</p>
            </div>
          </>
        }
      />
    </main>
  );
}

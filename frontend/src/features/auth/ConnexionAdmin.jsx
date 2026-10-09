import { useState } from 'react';
import Logo from '../../components/ui/Logo';
import useTitre from '../../lib/useTitre';
import FormulaireConnexion from './FormulaireConnexion';

/** A1 · Connexion admin. */
export default function ConnexionAdmin() {
  useTitre('Connexion');
  const [aide, setAide] = useState(false);
  return (
    <main className="flex min-h-screen items-center justify-center border-t-[6px] border-texte px-4 py-10">
      <FormulaireConnexion
        univers="programme"
        destination={(moi) => (moi.role === 'SUPER_ADMIN' ? '/super' : '/admin')}
        enTete={
          <>
            <Logo hauteur={40} />
            <div className="flex flex-col gap-1">
              <h1 className="m-0 text-[26px] font-bold tracking-[-0.025em]">Espace administrateur</h1>
              <p className="m-0 text-[15px] text-texte-2">Flex’Checking · cérémonies de graduation</p>
            </div>
          </>
        }
        piedDePage={
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => setAide((a) => !a)}
              aria-expanded={aide}
              className="min-h-[44px] cursor-pointer border-0 bg-transparent text-center text-[15px] text-texte underline underline-offset-[3px]"
            >
              Mot de passe oublié ?
            </button>
            {aide && (
              <p
                role="status"
                className="m-0 rounded-[12px] bg-subtil p-3 text-center text-[14px] leading-[1.5] text-texte-2"
              >
                Contactez la direction des événements MDE : elle réinitialisera votre mot de passe depuis l’espace super
                admin.
              </p>
            )}
          </div>
        }
      />
    </main>
  );
}

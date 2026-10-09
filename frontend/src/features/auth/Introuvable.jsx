import { Link } from 'react-router-dom';
import Logo from '../../components/ui/Logo';
import useTitre from '../../lib/useTitre';

export default function Introuvable() {
  useTitre('Page introuvable');
  return (
    <main className="univers-mde flex min-h-screen items-center justify-center border-t-[6px] border-mde-bordeaux bg-mde-surface px-4 text-mde-texte">
      <div className="flex max-w-[420px] flex-col items-center gap-4 text-center">
        <Logo hauteur={44} />
        <h1 className="m-0 text-[26px] font-bold tracking-[-0.02em]">Page introuvable</h1>
        <p className="m-0 text-[16px] text-mde-texte-2">L’adresse demandée n’existe pas ou n’est plus disponible.</p>
        <Link to="/connexion" className="font-semibold">
          Aller à la connexion
        </Link>
      </div>
    </main>
  );
}

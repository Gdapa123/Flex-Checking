import { Link, useLocation } from 'react-router-dom';
import Logo from '../../components/ui/Logo';
import useTitre from '../../lib/useTitre';

// retour adapté à l'espace de l'adresse demandée
const RETOURS = [
  ['/super', '/super', 'Retour à l’espace super admin'],
  ['/admin', '/admin', 'Retour à vos cérémonies'],
  ['/scan', '/scan', 'Retour au scan'],
];

export default function Introuvable() {
  useTitre('Page introuvable');
  const { pathname } = useLocation();
  const [, lien, libelle] = RETOURS.find(([prefixe]) => pathname.startsWith(prefixe)) || [
    null,
    '/connexion',
    'Aller à la connexion',
  ];
  return (
    <main className="univers-mde flex min-h-screen items-center justify-center border-t-[6px] border-mde-bordeaux bg-mde-surface px-4 text-mde-texte">
      <div className="flex max-w-[420px] flex-col items-center gap-4 text-center">
        <Logo hauteur={44} />
        <h1 className="m-0 text-[26px] font-bold tracking-[-0.02em]">Page introuvable</h1>
        <p className="m-0 text-[16px] text-mde-texte-2">L’adresse demandée n’existe pas ou n’est plus disponible.</p>
        <Link to={lien} className="inline-flex min-h-11 items-center font-semibold">
          {libelle}
        </Link>
      </div>
    </main>
  );
}

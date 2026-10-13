/** Lien « Aller au contenu » : premier élément atteint au clavier, il saute la navigation latérale. */
export default function LienEvitement({ cible = 'contenu' }) {
  return (
    <a href={`#${cible}`} className="lien-evitement">
      Aller au contenu
    </a>
  );
}

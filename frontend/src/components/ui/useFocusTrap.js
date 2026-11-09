import { useEffect, useRef } from 'react';

const FOCUSABLES =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Piège le focus dans un dialogue, ferme sur Échap et rend le focus à l'élément d'origine.
 * `onFermer` est lu via une référence : les appelants passent souvent une fonction fléchée recréée à chaque
 * rendu ; dans les dépendances de l'effet, elle relançait l'effet à chaque frappe dans un champ, ce qui
 * renvoyait le curseur sur le premier élément du dialogue.
 */
export default function useFocusTrap(ref, actif, onFermer) {
  const fermer = useRef(onFermer);
  useEffect(() => {
    fermer.current = onFermer;
  });

  useEffect(() => {
    if (!actif || !ref.current) return undefined;
    const origine = document.activeElement;
    const noeud = ref.current;
    const premier = noeud.querySelector('[data-autofocus]') || noeud.querySelector(FOCUSABLES);
    (premier || noeud).focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key === 'Escape' && fermer.current) {
        e.stopPropagation();
        fermer.current();
      }
      if (e.key !== 'Tab') return;
      const els = [...noeud.querySelectorAll(FOCUSABLES)].filter((el) => el.offsetParent !== null);
      if (!els.length) return;
      const [a, z] = [els[0], els[els.length - 1]];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    noeud.addEventListener('keydown', onKey);
    return () => {
      noeud.removeEventListener('keydown', onKey);
      if (origine && origine.focus) origine.focus({ preventScroll: true });
    };
  }, [actif, ref]);
}

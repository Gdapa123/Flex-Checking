import { forwardRef, useId } from 'react';
import Icon from './Icon';

/** Champ de saisie du design : libellé visible, préfixe +225, état valide, erreur sous le champ. */
const Champ = forwardRef(function Champ(
  {
    label,
    note,
    prefixe,
    erreur,
    valide = false,
    id,
    hauteur = 50,
    univers = 'programme',
    className = '',
    aide,
    ...input
  },
  ref,
) {
  const auto = useId();
  const domId = id || auto;
  const idErreur = `${domId}-erreur`;
  const bordure = erreur
    ? 'border-erreur bg-erreur-champ'
    : univers === 'mde'
      ? 'border-mde-champ bg-surface'
      : 'border-champ bg-surface';
  return (
    <div className={`flex min-w-0 flex-col gap-2 ${className}`}>
      {label && (
        <label htmlFor={domId} className="flex items-baseline gap-1.5 text-[15px] font-medium">
          {label}
          {note && <span className="text-[14px] font-normal text-texte-2">{note}</span>}
        </label>
      )}
      <div
        data-fw="1"
        className={`relative flex items-stretch overflow-hidden rounded-champ border shadow-champ transition-[border-color,box-shadow] ${bordure}`}
        style={{ height: hauteur }}
      >
        {prefixe && (
          <span className="flex items-center border-r border-bordure bg-subtil px-3 text-[16px] font-medium text-texte">
            {prefixe}
          </span>
        )}
        <input
          ref={ref}
          id={domId}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={erreur ? idErreur : aide ? `${domId}-aide` : undefined}
          className="min-w-0 flex-1 border-0 bg-transparent pl-3.5 pr-10 text-[16px] text-texte outline-none placeholder:text-texte-2"
          {...input}
        />
        {valide && !erreur && (
          <span
            className="absolute right-3 top-1/2 -mt-2.5 animate-pop text-[20px] text-succes"
            aria-label="Champ valide"
          >
            <Icon nom="checkCircle" />
          </span>
        )}
      </div>
      {aide && !erreur && (
        <p id={`${domId}-aide`} className="m-0 text-[13px] text-texte-2">
          {aide}
        </p>
      )}
      {erreur && (
        <p id={idErreur} className="m-0 flex items-start gap-1.5 text-[14px] leading-[1.4] text-erreur">
          <Icon nom="alertCircle" className="mt-px text-[16px]" />
          {erreur}
        </p>
      )}
    </div>
  );
});

export default Champ;

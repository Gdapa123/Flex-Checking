import { variablesCss, variablesDepuisApi } from './tokens';

/**
 * Pose les variables CSS du programme sur un conteneur. Les écrans « programme »
 * (invité, admin, scan) s'enveloppent dans ce composant ; le super admin utilise l'univers MDE fixe.
 */
export default function ThemeScope({
  tokens,
  principale,
  secondaire,
  className = '',
  children,
  as: Tag = 'div',
  style,
  ...rest
}) {
  const variables = tokens ? variablesDepuisApi(tokens) : principale ? variablesCss(principale, secondaire) : {};
  return (
    <Tag className={className} style={{ ...style, ...variables }} {...rest}>
      {children}
    </Tag>
  );
}

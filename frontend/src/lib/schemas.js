/** Schémas Zod : mêmes règles que le backend (apps/noyau/validation.py). */
import { z } from 'zod';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export const champNom = (libelle) =>
  z.string().trim().min(2, `Indiquez votre ${libelle}.`).max(80, '80 caractères maximum.');

export const champEmail = z
  .string()
  .trim()
  .min(1, 'Indiquez votre adresse email.')
  .regex(EMAIL_RE, 'Adresse email invalide, par exemple nom@entreprise.ci.');

export const champTelephone = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .pipe(
    z
      .string()
      .min(1, 'Indiquez votre numéro de téléphone.')
      .length(10, 'Le numéro doit comporter 10 chiffres, par exemple 07 12 34 56 78.'),
  );

export const champCivilite = z.enum(['MME', 'M'], {
  errorMap: () => ({ message: 'Choisissez une civilité.' }),
});

export const schemaInvite = z.object({
  civilite: champCivilite,
  nom: champNom('nom'),
  prenom: champNom('prénom'),
  email: champEmail,
  telephone: champTelephone,
  entreprise: z.string().trim().max(120).optional().default(''),
  fonction: z.string().trim().max(120).optional().default(''),
});

/** Tous les champs sont obligatoires, entreprise et fonction comprises (inscription et ajout manuel). */
export const schemaInviteComplet = schemaInvite.extend({
  entreprise: z.string().trim().min(2, 'Indiquez votre entreprise.').max(120, '120 caractères maximum.'),
  fonction: z.string().trim().min(2, 'Indiquez votre fonction.').max(120, '120 caractères maximum.'),
});

export const schemaInscription = schemaInviteComplet.extend({
  consentementDonnees: z.literal(true, {
    errorMap: () => ({ message: 'Cochez cette case pour continuer.' }),
  }),
});

/** Erreurs Zod → { champ: message } (premier message par champ). */
export function erreursParChamp(resultat) {
  if (resultat.success) return {};
  const e = {};
  for (const issue of resultat.error.issues) {
    const k = issue.path[0];
    if (k && !e[k]) e[k] = issue.message;
  }
  return e;
}

/** Valide un seul champ (validation à la sortie du champ). */
export function erreurChamp(schema, champ, valeurs) {
  const r = schema.safeParse(valeurs);
  return erreursParChamp(r)[champ] || '';
}

/** « 0712345678 » → « 07 12 34 56 78 » pendant la saisie. */
export function formaterTelephone(v) {
  const d = v.replace(/\D/g, '').slice(0, 10);
  return d.replace(/(\d{2})(?=\d)/g, '$1 ');
}

export const schemaCouleur = z.string().regex(/^#[0-9a-f]{6}$/i, 'Couleur au format #RRGGBB attendue.');

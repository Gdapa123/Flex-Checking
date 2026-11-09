/** Schémas Zod : mêmes règles que le backend (apps/noyau/validation.py). */
import { z } from 'zod';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
// texte sur plusieurs lignes (miroir de validation.CONTROLE_MULTILIGNE_RE) : sauts de ligne et tabulation admis
// eslint-disable-next-line no-control-regex
export const CONTROLE_MULTILIGNE_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;

// QR code d'invitation : exactement le jeton du serveur (miroir de validation.QR_TOKEN_RE, 32 caractères base64 URL)
export const QR_TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;

/**
 * Nature du contenu lu par la caméra ou la douchette, avant tout envoi au serveur.
 * Un QR code étranger n'est jamais ouvert ni affiché (il peut contenir un lien piégé).
 * @returns {'invitation' | 'inscription' | 'lien' | 'inconnu'}
 */
export function natureQr(texte) {
  const v = (texte || '').trim();
  if (QR_TOKEN_RE.test(v)) return 'invitation';
  if (/^[a-z][a-z0-9+.-]*:/i.test(v) || /^www\./i.test(v)) {
    // affiche d'inscription d'une cérémonie (lien public « …/i/<slug> » du même site). Comparaison sur le nom
    // d'hôte sans « www. » ni protocole : le lien imprimé vient de APP_PUBLIC_URL, pas de l'adresse du poste
    try {
      const url = new URL(v);
      const hote = (h) => h.toLowerCase().replace(/^www\./, '');
      if (hote(url.hostname) === hote(window.location.hostname) && /^\/i\/[^/]+\/?$/.test(url.pathname))
        return 'inscription';
    } catch {
      /* lien mal formé : traité comme un lien quelconque */
    }
    return 'lien';
  }
  return 'inconnu';
}

// conseil affiché sur l'écran « QR code non reconnu » (le contenu lu n'est jamais affiché)
export const MESSAGES_QR = {
  inscription:
    'QR code d’inscription, pas une invitation. Demandez le QR code reçu par email ou proposez le code à 4 chiffres.',
  lien: 'Ce QR code contient un lien, ce n’est pas une invitation : ne l’ouvrez pas. Proposez le code à 4 chiffres ou la recherche par nom.',
  inconnu: 'Ce n’est pas une invitation Flex’Checking. Proposez le code à 4 chiffres ou la recherche par nom.',
};

export const champNom = (libelle) =>
  z
    .string({ error: `Indiquez votre ${libelle}.` })
    .trim()
    .min(2, `Indiquez votre ${libelle}.`)
    .max(80, '80 caractères maximum.');

export const champEmail = z
  .string({ error: 'Indiquez votre adresse email.' })
  .trim()
  .min(1, 'Indiquez votre adresse email.')
  .regex(EMAIL_RE, 'Adresse email invalide, par exemple nom@entreprise.ci.')
  // ASCII uniquement, comme le serveur (une variante accentuée serait confondue avec l'adresse sans accent)
  .refine((v) => /^[\x20-\x7e]*$/.test(v), 'Adresse email invalide, par exemple nom@entreprise.ci.');

export const champTelephone = z
  .string({ error: 'Indiquez votre numéro de téléphone.' })
  .transform((v) => v.replace(/\D/g, ''))
  .pipe(
    z
      .string()
      .min(1, 'Indiquez votre numéro de téléphone.')
      .length(10, 'Le numéro doit comporter 10 chiffres, par exemple 07 12 34 56 78.'),
  );

export const champCivilite = z.enum(['MME', 'M'], { error: 'Choisissez une civilité.' });

export const schemaInvite = z.object({
  civilite: champCivilite,
  nom: champNom('nom'),
  prenom: champNom('prénom'),
  email: champEmail,
  telephone: champTelephone,
  entreprise: z.string().trim().max(120).optional().default(''),
  fonction: z.string().trim().max(120).optional().default(''),
});

/** Tous les champs sont obligatoires, entreprise et fonction comprises (inscription, ajout manuel et modification). */
export const schemaInviteComplet = schemaInvite.extend({
  entreprise: z
    .string({ error: 'Indiquez votre entreprise.' })
    .trim()
    .min(2, 'Indiquez votre entreprise.')
    .max(120, '120 caractères maximum.'),
  fonction: z
    .string({ error: 'Indiquez votre fonction.' })
    .trim()
    .min(2, 'Indiquez votre fonction.')
    .max(120, '120 caractères maximum.'),
});

export const schemaInscription = schemaInviteComplet.extend({
  consentementDonnees: z.literal(true, { error: 'Cochez cette case pour continuer.' }),
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

/** Paramètres « Données personnelles » (miroir de ParametresSerializer : 1 à 60 mois, email facultatif). */
export const schemaDonneesPersonnelles = z.object({
  dureeConservationMois: z.coerce
    .number({ error: 'Indiquez un nombre de mois.' })
    .int('Indiquez un nombre entier de mois.')
    .min(1, 'Au moins 1 mois.')
    .max(60, 'Au plus 60 mois.'),
  contactDonnees: z.union([z.literal(''), z.string().trim().regex(EMAIL_RE, 'Adresse email invalide.')]),
});

export const schemaCouleur = z.string().regex(/^#[0-9a-f]{6}$/i, 'Couleur au format #RRGGBB attendue.');

/** Lien facultatif (magazine, brochure, carte d'invitation) : miroir de `validation.valider_lien`. */
// eslint-disable-next-line no-control-regex
const LIEN_RE = /^https?:\/\/[^\s/$.?#][^\s\x00-\x1f\x7f]*$/i;
export const schemaLien = z.union([
  z.literal(''),
  z.string().trim().regex(LIEN_RE, 'Lien invalide : il doit commencer par https://'),
]);

/** Liens de l'email n°2 d'une cérémonie (SA5) ; la carte d'invitation est un fichier (`lib/carteInvitation.js`). */
export const schemaLiensCeremonie = z.object({
  lienMagazine: schemaLien,
  lienBrochure: schemaLien,
});

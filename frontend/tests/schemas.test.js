import { describe, expect, it } from 'vitest';
import {
  erreurChamp,
  erreursParChamp,
  formaterTelephone,
  natureQr,
  schemaInscription,
  schemaInviteComplet,
} from '../src/lib/schemas';

const OK = {
  civilite: 'MME',
  nom: 'Kouassi',
  prenom: 'Aya',
  email: 'aya.kouassi@sib.ci',
  telephone: '07 12 34 56 78',
  entreprise: 'MDE Business School',
  fonction: 'Directeur des SI',
  consentementDonnees: true,
};

describe('schéma d’inscription (mêmes règles que le backend)', () => {
  it('accepte une inscription valide', () => {
    expect(schemaInscription.safeParse(OK).success).toBe(true);
  });
  it('refuse les champs invalides avec les messages du design', () => {
    const e = erreursParChamp(
      schemaInscription.safeParse({ ...OK, civilite: '', prenom: '', email: 'aya@orange', telephone: '07 12 34' }),
    );
    expect(e.civilite).toBe('Choisissez une civilité.');
    expect(e.prenom).toBe('Indiquez votre prénom.');
    expect(e.email).toBe('Adresse email invalide, par exemple nom@entreprise.ci.');
    expect(e.telephone).toBe('Le numéro doit comporter 10 chiffres, par exemple 07 12 34 56 78.');
  });
  it('exige entreprise et fonction (tous les champs sont obligatoires)', () => {
    const e = erreursParChamp(schemaInscription.safeParse({ ...OK, entreprise: ' ', fonction: '' }));
    expect(e.entreprise).toBe('Indiquez votre entreprise.');
    expect(e.fonction).toBe('Indiquez votre fonction.');
  });
  it('refuse les liens dans les champs repris par l’invitation (miroir de validation.LIEN_RE_NOM / LIEN_RE_TEXTE)', () => {
    const e = erreursParChamp(
      schemaInscription.safeParse({
        ...OK,
        prenom: 'Réglez sur https://payer-mde.co',
        nom: 'payer-mde.co',
        entreprise: 'www.x.ci',
        fonction: 'voir http://x',
      }),
    );
    for (const champ of ['prenom', 'nom', 'entreprise', 'fonction'])
      expect(e[champ]).toBe('Les liens et adresses ne sont pas acceptés dans ce champ.');
    const noms = { ...OK, prenom: 'J.-B. Marie', nom: 'N’Guessan-Koffi', entreprise: 'Jumia.ci' };
    expect(schemaInscription.safeParse(noms).success).toBe(true);
  });
  it('exige le consentement', () => {
    expect(erreurChamp(schemaInscription, 'consentementDonnees', { ...OK, consentementDonnees: false })).toMatch(
      /Cochez cette case/,
    );
  });
  it('formate le téléphone pendant la saisie', () => {
    expect(formaterTelephone('0712345678999')).toBe('07 12 34 56 78');
    expect(formaterTelephone('07-12')).toBe('07 12');
  });

  it('refuse les adresses non ASCII, comme le serveur', () => {
    expect(schemaInscription.safeParse({ ...OK, email: 'marie@mdé.ci' }).success).toBe(false);
  });

  it('modification : entreprise et fonction absentes refusées avec un message en français', () => {
    const e = erreursParChamp(schemaInviteComplet.safeParse({ ...OK, entreprise: null, fonction: '  ' }));
    expect(e).toEqual({ entreprise: 'Indiquez votre entreprise.', fonction: 'Indiquez votre fonction.' });
  });
});

describe('nature d’un QR code lu au scan (miroir de validation.QR_TOKEN_RE)', () => {
  const jeton = 'Ab3_-xYz0123456789abcdefghijKLMN'; // 32 caractères base64 URL, comme secrets.token_urlsafe(24)

  it('reconnaît un QR code d’invitation, espaces compris', () => {
    expect(jeton).toHaveLength(32);
    expect(natureQr(jeton)).toBe('invitation');
    expect(natureQr(`  ${jeton}\n`)).toBe('invitation');
  });

  it('refuse un format proche mais différent', () => {
    expect(natureQr(jeton.slice(1))).toBe('inconnu');
    expect(natureQr(`${jeton}A`)).toBe('inconnu');
    expect(natureQr(`${jeton.slice(1)}/`)).toBe('inconnu');
    expect(natureQr('')).toBe('inconnu');
    expect(natureQr(undefined)).toBe('inconnu');
  });

  it('signale un lien sans jamais le traiter comme une invitation', () => {
    expect(natureQr('https://site-piege.example/connexion')).toBe('lien');
    expect(natureQr('javascript:alert(1)')).toBe('lien');
    expect(natureQr('WIFI:S:reseau;T:WPA;P:secret;;')).toBe('lien');
    expect(natureQr('www.site-piege.example')).toBe('lien');
    // même chemin qu'une affiche d'inscription, mais sur un autre site
    expect(natureQr('https://site-piege.example/i/master-2026')).toBe('lien');
  });

  it('reconnaît l’affiche d’inscription du même site', () => {
    expect(natureQr(`${window.location.origin}/i/master-2026`)).toBe('inscription');
    expect(natureQr(`${window.location.origin}/i/master-2026/autre`)).toBe('lien');
    // lien imprimé depuis APP_PUBLIC_URL : protocole, port et « www. » peuvent différer de l'adresse du poste
    const { hostname } = window.location;
    expect(natureQr(`https://www.${hostname}/i/master-2026`)).toBe('inscription');
    expect(natureQr(`http://${hostname.toUpperCase()}:8080/i/master-2026`)).toBe('inscription');
    expect(natureQr(`https://${hostname}.site-piege.example/i/master-2026`)).toBe('lien');
  });
});

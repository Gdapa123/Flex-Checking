import { describe, expect, it } from 'vitest';
import { erreurChamp, erreursParChamp, formaterTelephone, schemaInscription } from '../src/lib/schemas';

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
  it('exige le consentement', () => {
    expect(erreurChamp(schemaInscription, 'consentementDonnees', { ...OK, consentementDonnees: false })).toMatch(
      /accord/,
    );
  });
  it('formate le téléphone pendant la saisie', () => {
    expect(formaterTelephone('0712345678999')).toBe('07 12 34 56 78');
    expect(formaterTelephone('07-12')).toBe('07 12');
  });
});

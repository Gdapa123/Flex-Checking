import { afterEach, describe, expect, it, vi } from 'vitest';
import { chargerListe, decrireFiltres, htmlListe, MAX_IMPRESSION } from '../src/features/invites/impression';
import { api } from '../src/lib/api';

const ligne = (i, extra = {}) => ({
  id: i,
  nomComplet: `Mme Aya KOUASSI ${i}`,
  fonction: 'Directrice',
  entreprise: 'SIB',
  presentLe: null,
  modeEmargement: null,
  evenementNom: 'PMD 2026',
  ...extra,
});

describe('impression de la liste', () => {
  afterEach(() => vi.restoreAllMocks());

  it('échappe les données (aucun HTML d’un invité interprété)', () => {
    const html = htmlListe({
      titre: 'Liste des présents',
      sousTitre: 'présents',
      lignes: [ligne(1, { nomComplet: '<img src=x onerror=alert(1)>', entreprise: 'A & B' })],
      total: 1,
      avecEvenement: false,
    });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('A &amp; B');
    expect(html).not.toMatch(/<script/i);
  });

  it('présence : heure et mode, ou case à cocher ; colonne cérémonie hors cérémonie', () => {
    const html = htmlListe({
      titre: 't',
      sousTitre: '',
      lignes: [ligne(1, { presentLe: '2026-11-16T18:42:00Z', modeEmargement: 'CODE' }), ligne(2)],
      total: 2,
      avecEvenement: true,
    });
    expect(html).toContain('18h42');
    expect(html).toContain('class="case"');
    expect(html).toContain('<th>Cérémonie</th>');
    expect(html).toContain('Directrice');
  });

  it('signale une liste tronquée', () => {
    const html = htmlListe({ titre: 't', sousTitre: '', lignes: [ligne(1)], total: 5, avecEvenement: false });
    expect(html).toContain('Liste limitée aux 1 premiers sur 5');
  });

  it('charge toutes les pages filtrées, triées par nom, sans dépasser le plafond', async () => {
    const get = vi.spyOn(api, 'get').mockImplementation(async (base, p) => ({
      total: 230,
      // une ligne répétée d'une page à l'autre (inscription pendant le chargement) n'est imprimée qu'une fois
      resultats: Array.from({ length: p.page < 3 ? 100 : 31 }, (_, i) =>
        ligne((p.page - 1) * 100 + i - (p.page === 3)),
      ),
    }));
    const r = await chargerListe('/evenements/1/invites/', { statut: 'PRESENT', q: '' });
    expect(r.lignes).toHaveLength(230);
    expect(get).toHaveBeenCalledTimes(3);
    expect(r.lignes.map((l) => l.id)).toEqual(Array.from({ length: 230 }, (_, i) => i));
    expect(get.mock.calls[0][1]).toMatchObject({ statut: 'PRESENT', tri: 'nom', taille: 100, page: 1 });
    expect(MAX_IMPRESSION).toBeGreaterThanOrEqual(1000);
  });

  it('nomme la cérémonie filtrée dans la vue globale', () => {
    expect(decrireFiltres({ statut: 'PRESENT' }, 3, 'Graduation PMD 2026')).toMatch(/^Graduation PMD 2026 · présents/);
  });

  it('décrit les filtres', () => {
    expect(decrireFiltres({ statut: 'PRESENT', q: 'koné' }, 12)).toMatch(
      /^présents · recherche « koné » · 12 personnes/,
    );
  });
});

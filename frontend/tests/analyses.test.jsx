import { describe, expect, it } from 'vitest';
import { REQUETES_PAR_SUJET } from '../src/lib/tempsReel';

describe('temps réel des analyses', () => {
  it('recharge les analyses quand les événements ou les erreurs changent', () => {
    expect(REQUETES_PAR_SUJET.evenements).toContainEqual(['analytique']);
    expect(REQUETES_PAR_SUJET.erreurs).toContainEqual(['analytique-technique']);
  });
});

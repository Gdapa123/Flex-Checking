import { describe, expect, it, vi } from 'vitest';
import { arreterLecteur } from '../src/features/scan/useCamera.js';

describe('arreterLecteur', () => {
  it('prend en charge le rejet asynchrone de stop() (torche refusée : « setPhotoOptions failed »)', async () => {
    const erreur = Object.assign(new Error('setPhotoOptions failed'), { name: 'UnknownError' });
    const promesse = Promise.reject(erreur);
    const capture = vi.spyOn(promesse, 'catch');
    arreterLecteur({ stop: () => promesse });
    expect(capture).toHaveBeenCalledOnce();
    await expect(capture.mock.results[0].value).resolves.toBeUndefined();
  });

  it('accepte un stop() synchrone qui lève, ou aucun lecteur', () => {
    expect(() =>
      arreterLecteur({
        stop: () => {
          throw new Error('déjà arrêté');
        },
      }),
    ).not.toThrow();
    expect(() => arreterLecteur(null)).not.toThrow();
  });
});

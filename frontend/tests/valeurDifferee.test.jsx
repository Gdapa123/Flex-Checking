import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useValeurDifferee from '../src/lib/useValeurDifferee';

describe('useValeurDifferee (recherche à la frappe)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('ne recopie la saisie qu’après 300 ms sans frappe', () => {
    const { result, rerender } = renderHook(({ v }) => useValeurDifferee(v, 300), { initialProps: { v: '' } });
    for (const v of ['k', 'ko', 'kou', 'koua']) {
      rerender({ v });
      act(() => vi.advanceTimersByTime(100)); // frappe rapide : jamais 300 ms d'affilée
      expect(result.current).toBe('');
    }
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe('koua');
  });

  it('efface tout de suite quand la saisie est vidée', () => {
    const { result, rerender } = renderHook(({ v }) => useValeurDifferee(v, 300), { initialProps: { v: 'kouassi' } });
    expect(result.current).toBe('kouassi');
    rerender({ v: '' });
    expect(result.current).toBe('');
    rerender({ v: 'aya' });
    expect(result.current).toBe(''); // pas l'ancienne recherche « kouassi »
    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBe('aya');
  });
});

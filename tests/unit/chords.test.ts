import { describe, expect, it } from 'vitest';
import { parseChord, parseProgression, splitLabel } from '../../src/core/theory/chords';

const pcs = (token: string) => parseChord(token)?.pitchClasses;

describe('parseChord', () => {
  it('parses every quality from the brief', () => {
    const cases: Record<string, number[]> = {
      C: [0, 4, 7], Am: [9, 0, 4], G7: [7, 11, 2, 5], Cmaj7: [0, 4, 7, 11], Dm7: [2, 5, 9, 0],
      CmMaj7: [0, 3, 7, 11], Bm7b5: [11, 2, 5, 9], 'Bm7(b5)': [11, 2, 5, 9], 'Bø': [11, 2, 5, 9],
      Bdim: [11, 2, 5], Bdim7: [11, 2, 5, 8], Caug: [0, 4, 8], 'C+': [0, 4, 8], Csus2: [0, 2, 7],
      Csus4: [0, 5, 7], E7sus4: [4, 9, 11, 2], C6: [0, 4, 7, 9], Am6: [9, 0, 4, 6], Cadd9: [0, 4, 7, 2],
      Amadd9: [9, 0, 4, 11], G9: [7, 11, 2, 5, 9], Am9: [9, 0, 4, 7, 11], Cmaj9: [0, 4, 7, 11, 2], E5: [4, 11],
    };
    for (const [token, expected] of Object.entries(cases)) expect(pcs(token), token).toEqual(expected);
  });

  it('accepts #, ♯, b and ♭', () => {
    expect(parseChord('F#m')?.root).toBe(6);
    expect(parseChord('F♯m')?.root).toBe(6);
    expect(parseChord('Bb7')?.root).toBe(10);
    expect(parseChord('B♭7')?.root).toBe(10);
    expect(parseChord('Cb')?.root).toBe(11);
  });

  it('reads the slash bass', () => {
    expect(parseChord('C/G')?.bass).toBe(7);
    expect(parseChord('E/G#')?.bass).toBe(8);
    expect(parseChord('Am')?.bass).toBe(9);
  });

  it('reads durations in beats, default 4', () => {
    expect(parseChord('Am')?.beats).toBe(4);
    expect(parseChord('E7:2')?.beats).toBe(2);
    expect(parseChord('A:8')?.beats).toBe(8);
    expect(parseChord('A:1.5')?.beats).toBe(1.5);
  });

  it('keeps M7 major and m7 minor', () => {
    expect(parseChord('CM7')?.quality).toBe('maj7');
    expect(parseChord('Cm7')?.quality).toBe('m7');
  });

  it('rejects unknown chords and bad durations', () => {
    for (const bad of ['H', 'Cxyz', 'C:0', 'C:-1', 'C:abc', 'C:2:3', 'c', 'C/H', '']) expect(parseChord(bad), bad).toBeNull();
  });
});

describe('parseProgression', () => {
  it('keeps valid chords and reports the invalid ones without blocking', () => {
    const r = parseProgression('Am Dm7 Xq G7 Cmaj7 Bm7b5:2 E7:2 A:8 zz');
    expect(r.chords.map((c) => c.label)).toEqual(['Am', 'Dm7', 'G7', 'Cmaj7', 'Bm7b5', 'E7', 'A']);
    expect(r.invalid).toEqual(['Xq', 'zz']);
  });
});

describe('splitLabel', () => {
  it('splits root and quality for the title', () => {
    expect(splitLabel('Dm7')).toEqual(['D', 'm7']);
    expect(splitLabel('Bbm7b5')).toEqual(['B♭', 'm7b5']);
    expect(splitLabel('F#')).toEqual(['F♯', '']);
  });
});

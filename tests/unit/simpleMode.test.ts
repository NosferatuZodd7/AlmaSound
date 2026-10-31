import { describe, expect, it } from 'vitest';
import { appendChord, nextBeats, progressionTokens, removeToken, setTokenBeats } from '../../src/core/progressionText';
import { parseChord } from '../../src/core/theory/chords';
import { ALL_KEYS, diatonicChords, IDEAS, ideaText, keyFromId, keyId, tonicName } from '../../src/core/theory/keys';

const labels = (tonic: number, mode: 'major' | 'minor') => diatonicChords({ tonic, mode }).map((c) => c.label);

describe('keys', () => {
  it('builds the seven chords of major and minor keys', () => {
    expect(labels(0, 'major')).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']);
    expect(labels(9, 'minor')).toEqual(['Am', 'Bdim', 'C', 'Dm', 'E', 'F', 'G']);
  });

  it('spells with the key’s sharps or flats', () => {
    expect(labels(5, 'major')).toEqual(['F', 'Gm', 'Am', 'Bb', 'C', 'Dm', 'Edim']);
    expect(labels(4, 'major')).toEqual(['E', 'F#m', 'G#m', 'A', 'B', 'C#m', 'D#dim']);
    expect(labels(6, 'major')[0]).toBe('F#');
    expect(labels(0, 'minor')).toEqual(['Cm', 'Ddim', 'Eb', 'Fm', 'G', 'Ab', 'Bb']);
  });

  it('every chord of every key is understood by the parser', () => {
    for (const k of ALL_KEYS) for (const c of diatonicChords(k)) expect(parseChord(c.label), `${tonicName(k)} ${k.mode}: ${c.label}`).not.toBeNull();
  });

  it('round-trips key ids', () => {
    for (const k of ALL_KEYS) expect(keyFromId(keyId(k))).toEqual(k);
  });

  it('applies ideas in a key', () => {
    const pop = IDEAS.find((i) => i.id === 'pop')!;
    const jazz = IDEAS.find((i) => i.id === 'jazz')!;
    expect(ideaText(pop, { tonic: 7, mode: 'major' })).toBe('G D Em C');
    expect(ideaText(jazz, { tonic: 0, mode: 'major' })).toBe('Dm G C:8');
    expect(ideaText(IDEAS.find((i) => i.id === 'andalusian')!, { tonic: 9, mode: 'minor' })).toBe('Am G F E');
  });
});

describe('progression text editing', () => {
  it('lists tokens with durations and flags invalid ones', () => {
    expect(progressionTokens('Am G:2  Xq')).toEqual([
      { label: 'Am', beats: 4, valid: true },
      { label: 'G', beats: 2, valid: true },
      { label: 'Xq', beats: 4, valid: false },
    ]);
  });

  it('appends, removes and retimes chords', () => {
    expect(appendChord('', 'C')).toBe('C');
    expect(appendChord('C G', 'Am', 2)).toBe('C G Am:2');
    expect(removeToken('C G Am', 1)).toBe('C Am');
    expect(setTokenBeats('C G Am', 1, 8)).toBe('C G:8 Am');
    expect(setTokenBeats('C G:2 Am', 1, 4)).toBe('C G Am');
  });

  it('cycles durations 4 → 2 → 1 → 8 → 4', () => {
    expect([4, 2, 1, 8, 3].map(nextBeats)).toEqual([2, 1, 8, 4, 4]);
  });
});

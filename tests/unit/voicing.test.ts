import { describe, expect, it } from 'vitest';
import { parseChord } from '../../src/core/theory/chords';
import { bassNote, voiceProgression, voiceUpper, voicingCost } from '../../src/core/theory/voicing';
import { mod12 } from '../../src/core/theory/notes';

const chord = (t: string) => parseChord(t)!;

describe('voiceUpper', () => {
  it('voices Am from the reference as A3 C4 E4 A4', () => {
    expect(voiceUpper([9, 0, 4], 9)).toEqual([57, 60, 64, 69]);
  });

  it('keeps every note in range and covers the chord', () => {
    for (const t of ['C', 'G7', 'Bm7b5', 'F#dim7', 'Ebaug', 'Dsus2', 'Bbmaj9', 'D5', 'E5']) {
      const c = chord(t);
      const v = voiceUpper(c.pitchClasses, c.root);
      expect(v.every((m) => m >= 55 && m <= 72), t).toBe(true);
      expect(v.every((m) => c.pitchClasses.includes(mod12(m))), t).toBe(true);
      expect([...v].sort((a, b) => a - b), t).toEqual(v);
    }
  });

  it('drops the fifth of five-note chords', () => {
    const c = chord('G9'); // G B D F A → D omitted
    const v = voiceUpper(c.pitchClasses, c.root);
    expect(new Set(v.map(mod12))).toEqual(new Set([7, 11, 5, 9]));
  });

  it('chooses the minimum-cost voicing', () => {
    const prev = [57, 60, 64, 69];
    const c = chord('Dm7');
    const best = voiceUpper(c.pitchClasses, c.root, prev);
    // Brute force over all chord-note quadruples in range gives no cheaper option.
    const notes = [];
    for (let m = 55; m <= 72; m++) if (c.pitchClasses.includes(mod12(m))) notes.push(m);
    let min = Infinity;
    for (const a of notes) for (const b of notes) for (const cc of notes) for (const d of notes)
      if (a < b && b < cc && cc < d && new Set([a, b, cc, d].map(mod12)).size === 4) min = Math.min(min, voicingCost([a, b, cc, d], prev));
    expect(voicingCost(best, prev)).toBe(min);
  });

  it('penalises a top voice above B♭4 and adjacent minor seconds', () => {
    expect(voicingCost([57, 60, 64, 71], [57, 60, 64, 71])).toBe(1);
    expect(voicingCost([59, 60, 64, 67], [59, 60, 64, 67])).toBe(3);
  });

  it('falls back to unisons when the range is too thin (D5)', () => {
    const c = chord('D5');
    const v = voiceUpper(c.pitchClasses, c.root);
    expect(new Set(v.map(mod12))).toEqual(new Set([2, 9]));
  });
});

describe('bass and progression', () => {
  it('puts the bass in E2–D♯3', () => {
    expect(bassNote(4)).toBe(40);
    expect(bassNote(3)).toBe(51);
    expect(bassNote(9)).toBe(45);
  });

  it('orders voices top first, bass last, and uses the slash bass', () => {
    const [am, cg] = voiceProgression([chord('Am'), chord('C/G')]);
    expect(am).toEqual([69, 64, 60, 57, 45]);
    expect(cg).toHaveLength(5);
    expect(cg[4]).toBe(43); // G2
  });
});

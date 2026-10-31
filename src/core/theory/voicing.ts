import { mod12 } from './notes';

/** Upper voices live in G3–C5, the bass in E2–D♯3 (MIDI). */
export const UPPER_RANGE = { low: 55, high: 72 } as const;
export const BASS_LOW = 40;
/** Reference for the first chord, lowest voice first. */
export const FIRST_REFERENCE: readonly number[] = [57, 60, 64, 69];
const TOP_SOFT_LIMIT = 70; // B♭4

/** Cost of moving from `prev` to `v` (both 4 notes, lowest first), as in the brief. */
export function voicingCost(v: readonly number[], prev: readonly number[]): number {
  let cost = 0;
  for (let i = 0; i < 4; i++) cost += Math.abs(v[i] - prev[i]);
  for (let i = 0; i < 3; i++) if (v[i + 1] - v[i] === 1) cost += 3;
  if (v[3] > TOP_SOFT_LIMIT) cost += 1;
  return cost;
}

/**
 * Picks the 4 upper notes (lowest first) closest to `prev`. Every note belongs to the chord and
 * all required pitch classes are covered; chords with more than 4 notes drop the fifth.
 */
export function voiceUpper(pitchClasses: readonly number[], root: number, prev: readonly number[] = FIRST_REFERENCE): number[] {
  let need = [...new Set(pitchClasses)];
  if (need.length > 4) need = need.filter((pc) => pc !== mod12(root + 7));
  const allowed = new Set(pitchClasses);
  const notes: number[] = [];
  for (let m = UPPER_RANGE.low; m <= UPPER_RANGE.high; m++) if (allowed.has(mod12(m))) notes.push(m);

  // Distinct notes first; unisons only when the range has too few chord notes (e.g. D5).
  for (const step of [1, 0]) {
    let best: number[] | null = null;
    let bestCost = Infinity;
    for (let a = 0; a < notes.length; a++)
      for (let b = a + step; b < notes.length; b++)
        for (let c = b + step; c < notes.length; c++)
          for (let d = c + step; d < notes.length; d++) {
            const v = [notes[a], notes[b], notes[c], notes[d]];
            const have = new Set(v.map(mod12));
            if (!need.every((pc) => have.has(pc))) continue;
            const cost = voicingCost(v, prev);
            if (cost < bestCost) {
              bestCost = cost;
              best = v;
            }
          }
    if (best) return best;
  }
  throw new Error(`No voicing for pitch classes ${pitchClasses.join(',')}`);
}

export const bassNote = (bassPc: number): number => BASS_LOW + mod12(bassPc - mod12(BASS_LOW));

/** Voice count: 4 upper voices + bass. */
export const VOICE_COUNT = 5;

/**
 * Voices a whole progression. Each result is ordered as drawn: top voice first, bass last.
 */
export function voiceProgression(chords: readonly { pitchClasses: readonly number[]; root: number; bass: number }[]): number[][] {
  let prev: readonly number[] = FIRST_REFERENCE;
  return chords.map((c) => {
    const upper = voiceUpper(c.pitchClasses, c.root, prev);
    prev = upper;
    return [...upper].reverse().concat(bassNote(c.bass));
  });
}

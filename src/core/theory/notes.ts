/** Pitch class (0 = C … 11 = B) of a natural note letter. */
export const LETTER_PC: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/**
 * Note-name tables per notation. Only international names exist today; a Latin table
 * (Dó, Ré, Mi…) can be added here later without touching callers.
 */
const NOTATIONS = {
  international: ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'],
} as const;

export type Notation = keyof typeof NOTATIONS;

export const mod12 = (n: number): number => ((n % 12) + 12) % 12;

export function pitchClassName(pc: number, notation: Notation = 'international'): string {
  return NOTATIONS[notation][mod12(pc)];
}

/** Scientific pitch name, MIDI 60 = C4. */
export function noteName(midi: number, notation: Notation = 'international'): string {
  return pitchClassName(midi, notation) + (Math.floor(midi / 12) - 1);
}

export const midiToFrequency = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

import { mod12 } from './notes';

export type KeyMode = 'major' | 'minor';

export interface Key {
  tonic: number;
  mode: KeyMode;
}

export interface DiatonicChord {
  /** Chord name as typed in a progression, e.g. "Bb" or "F#m" (ASCII accidentals). */
  label: string;
  /** Roman numeral of the degree, e.g. "IV" or "vii°". */
  numeral: string;
}

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/** Usual name of each key's tonic (what musicians write in a key signature). */
const TONIC_NAMES: Record<KeyMode, string[]> = {
  major: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'],
  minor: ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'],
};

/** Keys whose signature uses flats, by tonic pitch class. */
const FLAT_KEYS: Record<KeyMode, ReadonlySet<number>> = {
  major: new Set([1, 3, 5, 8, 10]),
  minor: new Set([0, 2, 3, 5, 7, 10]),
};

const DEGREES: Record<KeyMode, { offsets: number[]; suffixes: string[]; numerals: string[] }> = {
  major: { offsets: [0, 2, 4, 5, 7, 9, 11], suffixes: ['', 'm', 'm', '', '', 'm', 'dim'], numerals: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] },
  // Natural minor with a major V (harmonic minor), which sounds like "coming home".
  minor: { offsets: [0, 2, 3, 5, 7, 8, 10], suffixes: ['m', 'dim', '', 'm', '', '', ''], numerals: ['i', 'ii°', 'III', 'iv', 'V', 'VI', 'VII'] },
};

/** All 24 keys, majors first, each in chromatic order. */
export const ALL_KEYS: readonly Key[] = (['major', 'minor'] as const).flatMap((mode) => Array.from({ length: 12 }, (_, tonic) => ({ tonic, mode })));

export const keyId = (k: Key): string => `${k.tonic}-${k.mode}`;
export const keyFromId = (id: string): Key => {
  const [tonic, mode] = id.split('-');
  return { tonic: mod12(Number(tonic) || 0), mode: mode === 'minor' ? 'minor' : 'major' };
};

export const tonicName = (k: Key): string => TONIC_NAMES[k.mode][mod12(k.tonic)];

/** The seven chords of a key, spelled with the key's sharps or flats. */
export function diatonicChords(k: Key): DiatonicChord[] {
  const names = FLAT_KEYS[k.mode].has(mod12(k.tonic)) ? FLATS : SHARPS;
  const d = DEGREES[k.mode];
  return d.offsets.map((off, i) => {
    const root = mod12(k.tonic + off);
    // The tonic keeps its usual spelling (e.g. F# major, not Gb).
    const name = i === 0 ? tonicName(k) : names[root];
    return { label: name + d.suffixes[i], numeral: d.numerals[i] };
  });
}

export interface ProgressionIdea {
  id: string;
  /** Degrees, 0-based (0 = I/i). */
  degrees: number[];
  /** Beats per chord, same length as degrees. */
  beats: number[];
}

/** Well-known progressions, applied in any key. Names are translated (simple.ideas.<id>). */
export const IDEAS: readonly ProgressionIdea[] = [
  { id: 'pop', degrees: [0, 4, 5, 3], beats: [4, 4, 4, 4] },
  { id: 'ballad', degrees: [5, 3, 0, 4], beats: [4, 4, 4, 4] },
  { id: 'fifties', degrees: [0, 5, 3, 4], beats: [4, 4, 4, 4] },
  { id: 'canon', degrees: [0, 4, 5, 2, 3, 0, 3, 4], beats: [4, 4, 4, 4, 4, 4, 4, 4] },
  { id: 'jazz', degrees: [1, 4, 0], beats: [4, 4, 8] },
  { id: 'andalusian', degrees: [0, 6, 5, 4], beats: [4, 4, 4, 4] },
];

/** An idea as progression text in a key, e.g. "C G Am F". */
export function ideaText(idea: ProgressionIdea, k: Key): string {
  const chords = diatonicChords(k);
  return idea.degrees.map((d, i) => withBeats(chords[d].label, idea.beats[i])).join(' ');
}

export const withBeats = (label: string, beats: number): string => (beats === 4 ? label : `${label}:${beats}`);
